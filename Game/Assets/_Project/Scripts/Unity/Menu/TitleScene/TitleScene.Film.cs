using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using UnityEngine;

namespace PixelVocabFlight
{
    // The film: loading the WWC1/WWC2 file (header and cues are read by CinemaFilm, shared with Tools/AudioChecks), decoding one frame at a
    // time, the cue list. All little-endian:
    //   'W','W','C','1' or '2', u16 width, height, fps, frameCount, loopStart, paletteCount, cueCount,
    //   paletteCount x (R,G,B), cueCount x (WWC1: u8 kind, u16 frame; WWC2: u8 kind, u16 frame, i8 pan, u8 level, u8 dur),
    //   (frameCount+1) x u32 frame offsets (from the start of the data),
    //   data: per frame raw DEFLATE of width*height palette indices, rows top to bottom.
    // The bytes and textures belong to the instance (no statics), so a disabled Domain Reload cannot leave a dead object behind.
    public sealed partial class TitleScene
    {
        private const string FilmPath = "Cinema/title_intro";
        private static readonly Color32 Sky = new Color32(0x2A, 0x35, 0x50, 255);

        private bool loaded;
        private int width = 480, height = 270, fps = 30, dataStart, shown = -1;
        private byte[] data, indices;
        private uint[] offsets;
        private Color32[] palette = new Color32[256], pixels;
        private Texture2D texture;
        private int[] cueFrame = new int[0];
        private byte[] cueKind = new byte[0];
        private int cueDone;
        private readonly Queue<int> pending = new Queue<int>();
        private float barsOffTime = -1, titleTime = -1;
        private readonly List<float> shotStarts = new List<float>();

        private IReadOnlyList<CinemaCue> cueList = new CinemaCue[0];

        // Every intro cue with its pan, level and duration (what the soundtrack is built from).
        public IReadOnlyList<CinemaCue> Cues => cueList;
        public int FilmVersion { get; private set; }
        public int FrameCount { get; private set; }
        public int LoopStart { get; private set; }
        public int Fps => fps;
        public Vector2Int FilmSize => new Vector2Int(width, height);
        public bool FilmLoaded => loaded;
        public float IntroSeconds => loaded ? LoopStart / (float)fps : 10;
        public int ShotCount => shotStarts.Count;
        // Frame on screen: the intro plays once, then [LoopStart, FrameCount) repeats.
        public int Frame => !loaded ? 0 : Time < IntroSeconds ? Mathf.Clamp(Mathf.FloorToInt(Time * fps), 0, LoopStart - 1)
            : LoopStart + Mathf.FloorToInt((Time - IntroSeconds) * fps) % (FrameCount - LoopStart);
        // 0-based index of the current shot (the last one in the loop).
        public int Shot { get { int n = 0; for (int i = 0; i < cueDone; i++) if (cueKind[i] == CueShot) n++; return Mathf.Max(0, n - 1); } }
        public int Explosions { get { int n = 0; for (int i = 0; i < cueDone; i++) if (cueKind[i] == CueBoom || cueKind[i] == CueBigBoom) n++; return n; } }
        // Middle of shot i in seconds (the shot ends where the next one starts, or when the intro does).
        public float ShotMid(int i) => i < 0 || i >= shotStarts.Count ? -1 : (shotStarts[i] + (i + 1 < shotStarts.Count ? shotStarts[i + 1] : IntroSeconds)) / 2;
        // Time of the first cue of this kind, -1 when the film has none.
        public float CueTime(int kind) { for (int i = 0; i < cueKind.Length; i++) if (cueKind[i] == kind) return cueFrame[i] / (float)fps; return -1; }

        // Next cue crossed since the last call (the game plays the sound); false when there is none.
        public bool TakeCue(out int kind)
        {
            kind = 0;
            if (pending.Count == 0) return false;
            kind = pending.Dequeue();
            return true;
        }

        private void Advance(bool enqueue)
        {
            int frame = Time < IntroSeconds ? Mathf.FloorToInt(Time * fps) : int.MaxValue;
            while (cueDone < cueKind.Length && cueFrame[cueDone] <= frame)
            {
                if (enqueue) pending.Enqueue(cueKind[cueDone]);
                cueDone++;
            }
        }

        private void Fail(string why)
        {
            if (missing.Add(FilmPath)) Debug.LogWarning("Màn hình chờ không nạp được phim " + FilmPath + ": " + why + ". Dùng nền trời đặc.");
            loaded = false;
        }

        private void LoadFilm()
        {
            try
            {
                var asset = Resources.Load<TextAsset>(FilmPath);
                if (!asset) { Fail("thiếu file"); return; }
                var d = asset.bytes;
                if (!CinemaFilm.TryParse(d, out var info, out string why)) { Fail(why); return; }
                int w = info.Width, h = info.Height, f = info.Fps, frames = info.FrameCount, loop = info.LoopStart, offsetsAt = info.OffsetsAt;
                dataStart = info.DataStart;
                for (int i = 0, p = info.PaletteAt; i < info.Colours; i++, p += 3) palette[i] = new Color32(d[p], d[p + 1], d[p + 2], 255);
                var kinds = new List<byte>(); var at = new List<int>();
                foreach (var cue in info.Cues) { kinds.Add((byte)cue.Kind); at.Add(cue.Frame); }   // only the intro has cues; the loop is silent
                var table = new uint[frames + 1];
                for (int i = 0; i <= frames; i++, offsetsAt += 4)
                {
                    table[i] = System.BitConverter.ToUInt32(d, offsetsAt);
                    if (i > 0 && table[i] < table[i - 1] || (long)dataStart + table[i] > d.Length) { Fail("bảng offset sai"); return; }
                }
                data = d; offsets = table; width = w; height = h; fps = f; FrameCount = frames; LoopStart = loop;
                indices = new byte[w * h]; pixels = new Color32[w * h];
                cueKind = kinds.ToArray(); cueFrame = at.ToArray(); cueList = info.Cues; FilmVersion = info.Version;
                for (int i = 0; i < cueKind.Length; i++)
                {
                    float time = cueFrame[i] / (float)fps;
                    if (cueKind[i] == CueShot) shotStarts.Add(time);
                    else if (cueKind[i] == CueTitle && titleTime < 0) titleTime = time;
                    else if (cueKind[i] == CueBarsOff && barsOffTime < 0) barsOffTime = time;
                }
                loaded = true;
            }
            catch (System.Exception exception) { Fail(exception.Message); }
            finally
            {
                texture = new Texture2D(width, height, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "Title film" };
                if (pixels == null) pixels = new Color32[width * height];
                FillSky();
            }
        }

        private void FillSky()
        {
            for (int i = 0; i < pixels.Length; i++) pixels[i] = Sky;
            texture.SetPixels32(pixels); texture.Apply(false);
            shown = -1;
        }

        // Decode this frame into the texture (only when it changed). Unity's rows start at the bottom, the file's at the top.
        private void Show(int frame)
        {
            if (!loaded || frame == shown) return;
            try
            {
                int start = dataStart + (int)offsets[frame], length = (int)(offsets[frame + 1] - offsets[frame]), got = 0;
                using (var stream = new MemoryStream(data, start, length, false))
                using (var inflate = new DeflateStream(stream, CompressionMode.Decompress))
                {
                    while (got < indices.Length)
                    {
                        int n = inflate.Read(indices, got, indices.Length - got);
                        if (n <= 0) throw new InvalidDataException("khung " + frame + " thiếu dữ liệu");
                        got += n;
                    }
                }
                for (int y = 0; y < height; y++)
                {
                    int from = y * width, to = (height - 1 - y) * width;
                    for (int x = 0; x < width; x++) pixels[to + x] = palette[indices[from + x]];
                }
                texture.SetPixels32(pixels); texture.Apply(false);
                shown = frame;
            }
            catch (System.Exception exception)
            {
                Fail(exception.Message); FillSky();
            }
        }
    }
}

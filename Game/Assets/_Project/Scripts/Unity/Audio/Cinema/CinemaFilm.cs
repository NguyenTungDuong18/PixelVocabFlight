using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Cue kinds of the title film (TitleScene.CueX mirror these).
    public static class CinemaKind
    {
        public const int Shot = 0, Burst = 1, Boom = 2, BigBoom = 3, Whoosh = 4, Flak = 5, Title = 6, BarsOff = 7, Hit = 8,
            Cannon = 9, Gunners = 10, FlakNear = 11, HeavyPass = 12, Rumble = 13, Fire = 14, Fireball = 15;
    }

    // One cue of the film: the moment a sound starts to be heard. Pan -100 (left) .. 100 (right), Level 0..200 (100 = standard),
    // Dur in 1/30 s (0 = the default of the kind). WWC1 cues have Pan 0, Level 100, Dur 0.
    public sealed class CinemaCue
    {
        public int Kind, Frame, Pan, Level = 100, Dur;
        public CinemaCue() { }
        public CinemaCue(int kind, int frame, int pan = 0, int level = 100, int dur = 0) { Kind = kind; Frame = frame; Pan = pan; Level = level; Dur = dur; }
        public double Time(int fps) => Frame / (double)fps;
    }

    // Header and cue table of the film file. Pure bytes, so the game, the smoke test and Tools/AudioChecks read the same way.
    //   'W','W','C','1' or 'W','W','C','2', u16 width, height, fps, frameCount, loopStart, paletteCount, cueCount, palette (R,G,B),
    //   cues (WWC1: u8 kind, u16 frame; WWC2: u8 kind, u16 frame, i8 pan, u8 level, u8 dur), (frameCount+1) x u32 offsets, data.
    public sealed class CinemaFilmInfo
    {
        public int Version, Width, Height, Fps, FrameCount, LoopStart, Colours, PaletteAt, OffsetsAt, DataStart;
        public readonly List<CinemaCue> Cues = new List<CinemaCue>();   // only the intro (frame < LoopStart), ascending
    }

    public static class CinemaFilm
    {
        private static int U16(byte[] d, int at) => d[at] | d[at + 1] << 8;

        public static bool TryParse(byte[] d, out CinemaFilmInfo info, out string error)
        {
            info = null; error = null;
            if (d == null || d.Length < 18 || d[0] != 'W' || d[1] != 'W' || d[2] != 'C' || (d[3] != '1' && d[3] != '2')) { error = "sai chữ ký"; return false; }
            var f = new CinemaFilmInfo { Version = d[3] - '0', Width = U16(d, 4), Height = U16(d, 6), Fps = U16(d, 8), FrameCount = U16(d, 10), LoopStart = U16(d, 12), Colours = U16(d, 14) };
            int cues = U16(d, 16), cueSize = f.Version == 2 ? 6 : 3;
            if (f.Width == 0 || f.Height == 0 || f.Fps == 0 || f.Colours == 0 || f.Colours > 256 || f.LoopStart == 0 || f.LoopStart >= f.FrameCount) { error = "tiêu đề không hợp lệ"; return false; }
            f.PaletteAt = 18;
            int cuesAt = f.PaletteAt + f.Colours * 3;
            f.OffsetsAt = cuesAt + cues * cueSize;
            f.DataStart = f.OffsetsAt + (f.FrameCount + 1) * 4;
            if (f.DataStart > d.Length) { error = "file bị cụt"; return false; }
            for (int i = 0, p = cuesAt; i < cues; i++, p += cueSize)
            {
                int frame = U16(d, p + 1);
                if (frame >= f.LoopStart) continue;   // only the intro has cues; the loop is silent
                var cue = new CinemaCue { Kind = d[p], Frame = frame };
                if (f.Version == 2) { cue.Pan = (sbyte)d[p + 3]; cue.Level = d[p + 4]; cue.Dur = d[p + 5]; }
                f.Cues.Add(cue);
            }
            // Stable sort by frame (the file is already ascending; this only guards a hand-made one).
            for (int i = 1; i < f.Cues.Count; i++)
            {
                var c = f.Cues[i]; int j = i - 1;
                while (j >= 0 && f.Cues[j].Frame > c.Frame) { f.Cues[j + 1] = f.Cues[j]; j--; }
                f.Cues[j + 1] = c;
            }
            info = f;
            return true;
        }
    }
}

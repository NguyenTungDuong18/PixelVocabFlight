using System;
using System.Collections.Generic;
using UnityEngine;

namespace PixelVocabFlight
{
    // Loads the frame-by-frame pixel art produced by Tools/PixelForge.
    // Each animation frame is its own PNG: Resources/Pixel/<Group>/<name>_<frame>.png,
    // described by Resources/Pixel/pixel-manifest.json (size, fps, loop, nine-slice border).
    public static class PixelSprites
    {
#pragma warning disable 0649 // Assigned by JsonUtility.
        [Serializable] private sealed class Entry { public string name, path; public int frames, width, height, border, anchorX, anchorY, footW, footH; public float fps; public bool loop = true; }
        [Serializable] private sealed class Manifest { public string version; public Entry[] sprites; }
#pragma warning restore 0649

        private static Dictionary<string, Entry> entries;
        private static readonly Dictionary<string, Sprite[]> cache = new Dictionary<string, Sprite[]>();
        public static string Version { get; private set; }
        public static int LoadedFrames { get; private set; }

        private static Dictionary<string, Entry> Entries
        {
            get
            {
                if (entries != null) return entries;
                var json = Resources.Load<TextAsset>("Pixel/pixel-manifest");
                if (!json) throw new InvalidOperationException("Thiếu Pixel/pixel-manifest.json. Chạy node Tools/PixelForge/forge.cjs.");
                var manifest = JsonUtility.FromJson<Manifest>(json.text);
                entries = new Dictionary<string, Entry>();
                foreach (var e in manifest.sprites) entries[e.name] = e;
                Version = manifest.version;
                return entries;
            }
        }

        public static bool Has(string name) => Entries.ContainsKey(name);
        public static IEnumerable<string> Names => Entries.Keys;
        private static Entry Find(string name) => Entries.TryGetValue(name, out var e) ? e : throw new InvalidOperationException("Thiếu sprite pixel: " + name);
        public static int FrameCount(string name) => Find(name).frames;
        public static float Duration(string name) { var e = Find(name); return e.frames / Mathf.Max(.01f, e.fps); }
        public static Vector2 Size(string name, float scale) { var e = Find(name); return new Vector2(e.width * scale, e.height * scale); }

        // World models and characters (0.15): anchor in image px from the top-left; footprint in tiles for this facing. 0 when absent.
        public static Vector2Int Anchor(string name) { var e = Find(name); return new Vector2Int(e.anchorX, e.anchorY); }
        public static Vector2Int Foot(string name) { var e = Find(name); return new Vector2Int(e.footW, e.footH); }

        public static Sprite[] Frames(string name)
        {
            if (cache.TryGetValue(name, out var frames)) return frames;
            var e = Find(name);
            frames = new Sprite[e.frames];
            var border = new Vector4(e.border, e.border, e.border, e.border);
            for (int i = 0; i < e.frames; i++)
            {
                var texture = Resources.Load<Texture2D>("Pixel/" + e.path + "_" + i);
                if (!texture) throw new InvalidOperationException("Thiếu khung hình: Pixel/" + e.path + "_" + i);
                // Pre-blurred "_blur" twins are soft by design; bilinear keeps them smooth when scaled 2x.
                texture.filterMode = e.name.EndsWith("_blur", StringComparison.Ordinal) ? FilterMode.Bilinear : FilterMode.Point;
                texture.wrapMode = TextureWrapMode.Clamp;
                frames[i] = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, .5f), 100, 0, SpriteMeshType.FullRect, border);
                frames[i].name = e.name + "_" + i;
                LoadedFrames++;
            }
            cache[name] = frames;
            return frames;
        }

        public static Sprite Get(string name, int frame = 0) { var f = Frames(name); return f[Mathf.Clamp(frame, 0, f.Length - 1)]; }

        public static int FrameAt(string name, float seconds)
        {
            var e = Find(name);
            int i = Mathf.FloorToInt(Mathf.Max(0, seconds) * e.fps);
            return e.loop ? i % e.frames : Mathf.Min(i, e.frames - 1);
        }

        public static Sprite At(string name, float seconds) => Get(name, FrameAt(name, seconds));

        public static Texture2D Texture(string name, int frame = 0) => Get(name, frame).texture;
    }
}

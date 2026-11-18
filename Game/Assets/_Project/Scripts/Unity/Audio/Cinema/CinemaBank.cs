using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace PixelVocabFlight
{
    // The recordings of the intro soundtrack (Game/Assets/_Project/Audio/SFX/Cinema/Resources/CinemaSfx/*.bytes, WAV files; where they come from is in
    // LICENSE.md next to them, how they are made in Tools/AudioImport). Pure C#: the game parses them on the mixing thread and Tools/AudioChecks
    // reads the same files from disk. A "kit" has several slices (variants of one sound) so repeated shots never repeat exactly.
    //   loops   (one stereo recording that repeats seamlessly): engine (fighter), bomber (bomber stream hum), wind, fire
    //   long    windlong (18 s of wind that is not a loop: the menu bed cuts random pieces out of it, see CinemaMenuBed)
    //   kits    mg_a (single .50 shots of one gun; the last slice is the decay after the last shot), mg_b (stretches of a thick burst),
    //           cannon (heavy cannon shots with their tails), hit_a (bullets on metal), hit_b (bright rings of metal),
    //           flak (distant blasts), flaknear (close blasts), boom (medium blasts), bigboom (huge blasts, stereo), rumble (bombs far below),
    //           flyby (a fighter passing), heavy (a bomber passing)
    //   single  roar (flames roaring past, stereo), ring (ringing in the ears, already fading out)
    public sealed class CinemaBank
    {
        public static readonly string[] Required =
        {
            "engine", "bomber", "wind", "fire", "mg_a", "mg_b", "cannon", "hit_a", "hit_b", "flak", "flaknear", "boom", "bigboom", "roar", "rumble", "ring", "flyby", "heavy", "windlong",
        };

        // Kits: the sounds that must have at least this many slices.
        public static readonly Dictionary<string, int> MinSlices = new Dictionary<string, int>
        {
            { "mg_a", 8 }, { "mg_b", 3 }, { "cannon", 3 }, { "hit_a", 5 }, { "hit_b", 3 }, { "flak", 2 }, { "flaknear", 2 }, { "boom", 2 }, { "bigboom", 2 }, { "rumble", 3 }, { "flyby", 1 }, { "heavy", 1 },
        };

        private readonly Dictionary<string, CinemaSample> map = new Dictionary<string, CinemaSample>();

        public CinemaSample this[string name]
        {
            get
            {
                if (!map.TryGetValue(name, out var s)) throw new KeyNotFoundException("thiếu mẫu âm thanh '" + name + "'");
                return s;
            }
        }

        public bool Has(string name) => map.ContainsKey(name);
        public int Count => map.Count;
        public IEnumerable<string> Names => map.Keys;
        public double TotalSeconds => map.Values.Sum(s => s.Seconds);
        public long TotalFrames => map.Values.Sum(s => (long)s.Length);

        // The names (of Required) that are missing, or kits with too few slices; empty when the bank is complete.
        public string Problems()
        {
            var bad = new List<string>();
            foreach (string n in Required)
            {
                if (!map.TryGetValue(n, out var s)) { bad.Add(n + " (thiếu)"); continue; }
                if (s.Rate != CinemaDsp.Rate) bad.Add(n + " (tần số " + s.Rate + ")");
                if (MinSlices.TryGetValue(n, out int k) && s.Slices < k) bad.Add(n + " (" + s.Slices + "/" + k + " đoạn)");
            }
            return string.Join(", ", bad);
        }

        public void Add(string name, CinemaSample s) { map[name] = s; }

        // 'files' maps the name without extension to the bytes of a WAV file. A file that cannot be read stops the whole bank (so a bad import is loud).
        public static CinemaBank FromBytes(IEnumerable<KeyValuePair<string, byte[]>> files)
        {
            var bank = new CinemaBank();
            foreach (var f in files) bank.map[f.Key] = CinemaWav.Read(f.Value, f.Key);
            return bank;
        }

        public static CinemaBank FromFolder(string dir)
        {
            var list = new List<KeyValuePair<string, byte[]>>();
            foreach (string path in Directory.GetFiles(dir))
            {
                string ext = Path.GetExtension(path).ToLowerInvariant();
                if (ext == ".bytes" || ext == ".wav") list.Add(new KeyValuePair<string, byte[]>(Path.GetFileNameWithoutExtension(path), File.ReadAllBytes(path)));
            }
            return FromBytes(list);
        }

        // ---- A sound of the bank ready to mix (copies; the bank itself is never changed) ----

        // A random slice of a kit played at 'ratio' times the speed (pitch and length change; 1 = as recorded).
        public CinemaSample Take(string name, Rng r, double ratio = 1, int not = -1)
        {
            var k = this[name]; int n = k.Slices;
            if (n == 0) return Pitched(k, ratio);
            int pick = r.Int(0, n - 1); if (n > 1 && pick == not) pick = (pick + 1) % n;
            return Pitched(k.Slice(pick), ratio);
        }

        public int PickIndex(string name, Rng r, int not = -1)
        {
            int n = this[name].Slices; if (n <= 1) return 0;
            int pick = r.Int(0, n - 1); if (pick == not) pick = (pick + 1 + r.Int(0, n - 2)) % n;
            return pick;
        }

        public CinemaSample Take(string name, int slice, double ratio = 1) => Pitched(this[name].Slice(slice), ratio);

        // Every slice of a kit as a sound of its own, made once (read-only for the callers).
        private readonly Dictionary<string, CinemaSample[]> sliced = new Dictionary<string, CinemaSample[]>();

        public CinemaSample[] All(string name)
        {
            lock (sliced)
            {
                if (sliced.TryGetValue(name, out var a)) return a;
                var k = this[name]; a = new CinemaSample[Math.Max(1, k.Slices)];
                for (int i = 0; i < a.Length; i++) a[i] = k.Slices == 0 ? k : k.Slice(i);
                sliced[name] = a;
                return a;
            }
        }

        public static CinemaSample Pitched(CinemaSample s, double ratio)
        {
            if (Math.Abs(ratio - 1) < 1e-4) return s;
            var l = CinemaDsp.Resample(s.L, ratio);
            return s.Mono ? CinemaSample.FromMono(l, s.Rate) : CinemaSample.FromStereo(l, CinemaDsp.Resample(s.R, ratio), s.Rate);
        }
    }
}

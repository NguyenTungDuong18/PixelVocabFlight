using PixelVocabFlight;
using static Proc;

// The recipe of the bank: which part of which recording becomes which sound, and how it is prepared (cut, EQ, loop, fade). Everything the
// game plays is here, so `build` rebuilds the whole bank from the MP3 files alone. Levels in the files are only relative (the game
// normalises each sound again); every file peaks around -1 dBFS.
static partial class Recipe
{
    const int Rate = CinemaDsp.Rate;
    static string srcDir;
    static readonly Dictionary<string, CinemaSample> cache = new Dictionary<string, CinemaSample>();
    static readonly SortedDictionary<string, CinemaSample> outs = new SortedDictionary<string, CinemaSample>();
    static readonly List<string> log = new List<string>();

    // ---- sources ----
    static CinemaSample Src(string id)
    {
        if (cache.TryGetValue(id, out var s)) return s;
        string file = Find(id);
        s = Source.Load(file);
        // A trimmed MP3 (made by `trim`) has the time of its first kept frame in a sidecar: pad so the times of the recipe stay the original ones.
        string side = file + ".start";
        if (File.Exists(side))
        {
            int pad = (int)(double.Parse(File.ReadAllText(side).Trim()) * Rate);
            var l = new float[pad + s.Length]; Array.Copy(s.L, 0, l, pad, s.Length);
            var r = s.Mono ? l : new float[pad + s.Length]; if (!s.Mono) Array.Copy(s.R, 0, r, pad, s.Length);
            s = new CinemaSample { L = l, R = r };
        }
        cache[id] = s;
        return s;
    }

    public static string Find(string id)
    {
        foreach (string dir in new[] { srcDir, Environment.GetEnvironmentVariable("WW_SFX_PROBE") })
        {
            if (dir == null || !Directory.Exists(dir)) continue;
            var m = Directory.GetFiles(dir, id + "_*.mp3", SearchOption.AllDirectories);
            if (m.Length > 0) return m[0];
        }
        throw new FileNotFoundException("không thấy nguồn " + id + " trong " + srcDir);
    }

    static float[] Mono(string id)
    {
        var s = Src(id);
        if (s.Mono) return Copy(s.L);
        var m = new float[s.Length]; for (int i = 0; i < m.Length; i++) m[i] = (s.L[i] + s.R[i]) * .5f;
        return m;
    }

    static float[] Chan(string id, int c) { var s = Src(id); return Copy(c == 0 ? s.L : s.R); }

    // ---- building blocks ----
    static void Out(string name, CinemaSample s, string note)
    {
        outs[name] = s;
        var m = Scan.Mono(s); var p = Scan.Spectrum(m, 0, m.Length);
        log.Add(string.Format("{0,-10} {1,6:0.00} s {2,-6} {3,6} KB  peak {4,5:0.0}  rms {5,6:0.0}  centroid {6,5:0}  <120 {7,4:0%}  120-1k {8,4:0%}  1-5k {9,4:0%}  >5k {10,4:0%}  tonal {11,3:0%}{12}  | {13}",
            name, s.Seconds, s.Mono ? "mono" : "stereo", (44 + m.Length * (s.Mono ? 2 : 4)) / 1024, Scan.Db(Peak(m)), Scan.Db(Rms(m)), Scan.Centroid(p), Scan.Band(p, 0, 120), Scan.Band(p, 120, 1000),
            Scan.Band(p, 1000, 5000), Scan.Band(p, 5000, 30000), Scan.TonalFraction(m, 0, m.Length), s.Slices > 0 ? "  " + s.Slices + " slices" : "", note));
    }

    static CinemaSample Stereo2(float[] l, float[] r) => CinemaSample.FromStereo(l, r);

    // A kit: slices one after another with 5 ms of silence, one common level (the loudest slice peaks at -1 dBFS), one file.
    static CinemaSample Kit(IList<float[]> slices, bool stereoR = false, IList<float[]> right = null)
    {
        float peak = 0; foreach (var s in slices) peak = Math.Max(peak, Peak(s));
        if (right != null) foreach (var s in right) peak = Math.Max(peak, Peak(s));
        float g = (float)CinemaDsp.Db(-1) / peak, gap = 0; int gapN = (int)(.005 * Rate);
        int n = 0; foreach (var s in slices) n += s.Length + gapN;
        var l = new float[n]; var r = right != null ? new float[n] : l;
        var start = new int[slices.Count]; var len = new int[slices.Count]; int at = 0;
        for (int k = 0; k < slices.Count; k++)
        {
            start[k] = at; len[k] = slices[k].Length;
            for (int i = 0; i < len[k]; i++) { l[at + i] = slices[k][i] * g; if (right != null) r[at + i] = right[k][i] * g; }
            at += len[k] + gapN;
        }
        _ = gap;
        return new CinemaSample { L = l, R = r, SliceStart = start, SliceLength = len };
    }

    // Runs 'f' over x as if the loop went on for ever (the seam keeps the filter state of the other end).
    static float[] Periodic(float[] x, Action<float[]> f)
    {
        var t = new float[x.Length * 2]; Array.Copy(x, 0, t, 0, x.Length); Array.Copy(x, 0, t, x.Length, x.Length);
        f(t);
        var y = new float[x.Length]; Array.Copy(t, x.Length, y, 0, x.Length);
        return y;
    }

    // Loop of 'len' seconds from the source channels at the start (between 'from' and 'to', stepping 'step' s) where the seam matches best.
    static float[][] BestLoop(Func<double, float[][]> channelsAt, double from, double to, double step, double len, double xf, double search, out double corr, out double used, out double at)
    {
        float[][] best = null; corr = -2; used = len; at = from;
        for (double s = from; s <= to + 1e-9; s += step)
        {
            var c = channelsAt(s);
            var l = Loop(c, 0, len, xf, search, out double r, out double u);
            if (r > corr) { corr = r; best = l; used = u; at = s; }
        }
        return best;
    }

    // Window of one channel starting at s (long enough for a loop of 'len' with the search and cross-fade).
    static float[] Win(float[] x, double s, double len, double xf, double search) => Cut(x, s, s + len + xf + search + .05);

    // The first attack inside [a, b]: the first 2 ms where the envelope reaches 'frac' of the loudest one in the window. Returns the sample.
    static int Attack(float[] x, double a, double b, double frac = .35)
    {
        int i0 = (int)(a * Rate), i1 = Math.Min(x.Length, (int)(b * Rate)), w = Rate / 500; double max = 0;
        var env = new List<double>();
        for (int i = i0; i + w <= i1; i += w) { double e = 0; for (int j = 0; j < w; j++) e += Math.Abs(x[i + j]); env.Add(e / w); max = Math.Max(max, env[^1]); }
        for (int k = 0; k < env.Count; k++) if (env[k] >= max * frac) return Math.Max(0, i0 + k * w - Rate / 200);
        return i0;
    }

    // One event: starts at the attack found in [a, b], lasts 'len' s, fades out over 'outMs'.
    static float[] Ev(float[] x, double a, double b, double len, double outMs, double frac = .35)
    {
        int at = Attack(x, a, b, frac), n = Math.Min((int)(len * Rate), x.Length - at); var y = new float[n]; Array.Copy(x, at, y, 0, n);
        return Fade(y, 1.5, outMs);
    }

    public static int Build(string src, string dst)
    {
        srcDir = src;
        if (!Directory.Exists(src) && Environment.GetEnvironmentVariable("WW_SFX_PROBE") == null) { Console.WriteLine("Không thấy thư mục nguồn " + src); return 2; }
        var watch = System.Diagnostics.Stopwatch.StartNew();
        void Step(string name, Action a) { var w = System.Diagnostics.Stopwatch.StartNew(); a(); Console.Error.WriteLine("  " + name + ": " + w.Elapsed.TotalSeconds.ToString("0.0") + " s"); }
        Step("vòng lặp", Loops);
        Step("súng", Guns);
        Step("nổ", Blasts);
        Step("lướt qua", Passes);
        Directory.CreateDirectory(dst);
        foreach (var old in Directory.GetFiles(dst, "*.bytes")) File.Delete(old);
        long total = 0;
        foreach (var kv in outs) { var bytes = CinemaWav.Write(kv.Value); File.WriteAllBytes(Path.Combine(dst, kv.Key + ".bytes"), bytes); total += bytes.Length; }
        foreach (string line in log) Console.WriteLine(line);
        Console.WriteLine("{0} file, {1:0.00} MB, {2:0.0} s -> {3}", outs.Count, total / 1048576.0, watch.Elapsed.TotalSeconds, dst);
        Console.WriteLine("Trình tự cần: " + string.Join(", ", CinemaBank.Required));
        var missing = CinemaBank.Required.Where(n => !outs.ContainsKey(n)).ToList();
        if (missing.Count > 0) { Console.WriteLine("THIẾU: " + string.Join(", ", missing)); return 1; }
        return total > 17L * 1048576 ? 1 : 0;
    }
}

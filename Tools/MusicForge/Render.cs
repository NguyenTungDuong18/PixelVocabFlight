using PixelVocabFlight;

namespace MusicForge;

public sealed class Result
{
    public float[] IntroL, IntroR, LoopL, LoopR;
    public Dictionary<Bus, (float[] l, float[] r)> LoopStems = new();
    public List<string> Log = new();
}

// Plays the score, mixes the buses (EQ + reverb send), folds the loop so its tail wraps to its start, sets the level and writes the WAVs.
public static class Render
{
    const double TargetLufs = -18, CeilingDb = -1.3;
    static readonly Dictionary<Bus, double> Send = new() { [Bus.Strings] = .30, [Bus.Brass] = .20, [Bus.Perc] = .14, [Bus.Color] = .32 };
    static readonly Dictionary<Bus, double> BusDb = new() { [Bus.Strings] = 0, [Bus.Brass] = -1, [Bus.Perc] = -2, [Bus.Color] = -2 };
    const int Pre = Mix.Rate, Tail = 12 * Mix.Rate;

    public static Result Run(string cache, bool stems)
    {
        Bank.Root = cache;
        if (!File.Exists(Path.Combine(cache, "Timpani.sfz"))) throw new Exception("chưa có mẫu: chạy lệnh fetch trước");
        var res = new Result();
        var intro = Score.Intro(); var loop = Score.Loop();
        Say(res, $"nốt: intro {intro.Count}, loop {loop.Count}");
        var (iBus, iLog) = Play(cache, intro, Mix.IntroN, 1);
        var (lBus, lLog) = Play(cache, loop, Mix.LoopN, 2);
        foreach (var s in iLog.Concat(lLog)) Say(res, s);
        var iMix = MixBuses(iBus, Mix.IntroN, null);
        var lMix = MixBuses(lBus, Mix.LoopN, res.LoopStems);
        // Intro: exactly 4 bars. Its tail is not added to the loop: instead (below) its last beats become the loop's own last beats, so the
        // loop start (which already holds the loop's wrapped tail) follows the intro exactly as it follows itself.
        res.IntroL = new float[Mix.IntroN]; res.IntroR = new float[Mix.IntroN];
        Array.Copy(iMix.l, Pre, res.IntroL, 0, Mix.IntroN); Array.Copy(iMix.r, Pre, res.IntroR, 0, Mix.IntroN);
        res.LoopL = Fold(lMix.l, Mix.LoopN); res.LoopR = Fold(lMix.r, Mix.LoopN);
        foreach (var b in res.LoopStems.Keys.ToList()) { var s = res.LoopStems[b]; res.LoopStems[b] = (Fold(s.l, Mix.LoopN), Fold(s.r, Mix.LoopN)); }
        // Level: the loop sets one gain for both files; then a look-ahead limiter catches the fff peaks.
        double lufs = Meter.Lufs(res.LoopL, res.LoopR, true), g = Mix.Db(TargetLufs - lufs);
        Say(res, $"loudness trước chỉnh: {lufs:0.0} LUFS, gain {Mix.ToDb(g):+0.0;-0.0} dB, đỉnh trước limiter loop {Mix.ToDb(Meter.Peak(res.LoopL, res.LoopR) * g):0.0} dBFS, intro {Mix.ToDb(Meter.Peak(res.IntroL, res.IntroR) * g):0.0} dBFS");
        foreach (var a in new[] { res.IntroL, res.IntroR, res.LoopL, res.LoopR }) for (int i = 0; i < a.Length; i++) a[i] *= (float)g;
        foreach (var s in res.LoopStems.Values) foreach (var a in new[] { s.l, s.r }) for (int i = 0; i < a.Length; i++) a[i] *= (float)g;
        double grL = Limiter.Run(res.LoopL, res.LoopR, CeilingDb, true);
        // Intro bar 4 beat 2 -> 3: equal-power crossfade into the loop's bar 88 (same D-major swell); from beat 3 on, the samples are the loop's.
        int xa = Mix.IntroN - 3 * Mix.BeatN, xb = Mix.IntroN - 2 * Mix.BeatN - Mix.BeatN / 8, off = Mix.LoopN - Mix.IntroN;
        for (int i = xa; i < Mix.IntroN; i++)
        {
            double a = Math.Clamp((double)(i - xa) / (xb - xa), 0, 1); float ga = (float)Math.Cos(a * Math.PI / 2), gb = (float)Math.Sin(a * Math.PI / 2);
            res.IntroL[i] = res.IntroL[i] * ga + res.LoopL[i + off] * gb; res.IntroR[i] = res.IntroR[i] * ga + res.LoopR[i + off] * gb;
        }
        double grI = Limiter.Run(res.IntroL, res.IntroR, CeilingDb, false);
        Say(res, $"limiter: giảm tối đa loop {grL:0.0} dB, intro {grI:0.0} dB; loudness sau: loop {Meter.Lufs(res.LoopL, res.LoopR, true):0.0} LUFS, intro {Meter.Lufs(res.IntroL, res.IntroR):0.0} LUFS");
        foreach (var a in new[] { res.IntroL, res.IntroR, res.LoopL, res.LoopR })
            foreach (var v in a) if (!float.IsFinite(v)) throw new Exception("NaN/Inf trong bản trộn");
        if (!stems) res.LoopStems.Clear();
        return res;
    }

    static void Say(Result r, string s) { Console.WriteLine(s); r.Log.Add(s); }

    // Renders every instrument (in parallel, each deterministic) into its bus. Buffers: 1 s pre-roll + length + 12 s tail.
    static (Dictionary<Bus, (float[] l, float[] r)>, List<string>) Play(string cache, List<Note> notes, int length, int seed)
    {
        int n = Pre + length + Tail;
        var buses = Enum.GetValues<Bus>().ToDictionary(b => b, b => (l: new float[n], r: new float[n]));
        var log = new List<string>();
        var groups = notes.GroupBy(x => x.Inst).ToList();
        // Batches of 8 tracks render in parallel, then add into the buses in catalog order (float sums are order-dependent: same bytes every run).
        foreach (var batch in groups.OrderBy(g => Array.IndexOf(Catalog.All, Catalog.Get(g.Key))).Chunk(8))
        {
            var tracks = batch.AsParallel().AsOrdered().Select(grp =>
            {
                var inst = Catalog.Get(grp.Key);
                var p = new Player(inst, cache, seed * 1000 + Array.IndexOf(Catalog.All, inst));
                var tl = new float[n]; var tr = new float[n];
                foreach (var note in grp.OrderBy(x => x.Beat).ThenBy(x => x.Key)) p.Play(note, tl, tr, Pre);
                // A recording pushed more than 4 semitones sounds wrong (formants): the score must move such notes by an octave.
                if (p.MaxShift > 4 || p.Warnings.Count > 0) throw new Exception($"{inst.Name}: dịch cao độ {p.MaxShift} cung nửa > 4 hoặc nốt ngoài dải: {string.Join("; ", p.Warnings)}");
                return (inst, count: grp.Count(), p.MaxShift, tl, tr);
            }).ToList();
            foreach (var (inst, count, shift, tl, tr) in tracks)
            {
                var bus = buses[inst.Bus];
                for (int i = 0; i < n; i++) { bus.l[i] += tl[i]; bus.r[i] += tr[i]; }
                log.Add($"  {inst.Name,-10} {count,5} nốt, đỉnh {Mix.ToDb(Meter.Peak(tl, tr)),6:0.0} dB, dịch cao độ tối đa {shift:0} cung nửa");
            }
        }
        return (buses, log);
    }

    // Bus EQ (high-pass 38 Hz, -2 dB at 220 Hz; brass -1.5 dB at 3 kHz), bus level, reverb send; returns the sum and (optionally) stems.
    static (float[] l, float[] r) MixBuses(Dictionary<Bus, (float[] l, float[] r)> buses, int length, Dictionary<Bus, (float[] l, float[] r)> stems)
    {
        int n = buses.First().Value.l.Length;
        var sumL = new float[n]; var sumR = new float[n];
        var done = buses.AsParallel().Select(kv =>
        {
            var (l, r) = kv.Value;
            foreach (var x in new[] { l, r })
            {
                Bq.HighPass(38).Run(x); Bq.Peak(220, -2, .9).Run(x);
                if (kv.Key == Bus.Brass) Bq.Peak(3000, -1.5, 1.2).Run(x);
                float g = (float)Mix.Db(BusDb[kv.Key]); for (int i = 0; i < n; i++) x[i] *= g;
            }
            var (wl, wr) = Reverb.Run(l, r);
            float s = (float)Send[kv.Key];
            for (int i = 0; i < n; i++) { l[i] += wl[i] * s; r[i] += wr[i] * s; }
            return kv;
        }).ToList();
        foreach (var kv in done.OrderBy(kv => kv.Key))
        {
            for (int i = 0; i < n; i++) { sumL[i] += kv.Value.l[i]; sumR[i] += kv.Value.r[i]; }
            if (stems != null) stems[kv.Key] = kv.Value;
        }
        return (sumL, sumR);
    }

    // Circular render: every sample of the linear buffer lands at (t mod loop length), so the pre-roll and the tail wrap around.
    static float[] Fold(float[] x, int len)
    {
        var o = new float[len];
        for (int j = 0; j < x.Length; j++) o[(((j - Pre) % len) + len) % len] += x[j];
        return o;
    }

    public static void Write(Result r, string dir)
    {
        Directory.CreateDirectory(dir);
        Save(Path.Combine(dir, "title_intro.wav"), r.IntroL, r.IntroR, 1);
        Save(Path.Combine(dir, "title_loop.wav"), r.LoopL, r.LoopR, 2);
        Console.WriteLine("đã ghi " + dir);
    }

    public static void WritePreview(Result r, string dir)
    {
        int extra = 20 * Mix.Rate, n = Mix.IntroN + Mix.LoopN + extra;
        var l = new float[n]; var rr = new float[n];
        Array.Copy(r.IntroL, 0, l, 0, Mix.IntroN); Array.Copy(r.IntroR, 0, rr, 0, Mix.IntroN);
        Array.Copy(r.LoopL, 0, l, Mix.IntroN, Mix.LoopN); Array.Copy(r.LoopR, 0, rr, Mix.IntroN, Mix.LoopN);
        Array.Copy(r.LoopL, 0, l, Mix.IntroN + Mix.LoopN, extra); Array.Copy(r.LoopR, 0, rr, Mix.IntroN + Mix.LoopN, extra);
        Save(Path.Combine(dir, "full_preview.wav"), l, rr, 3);
        r.Log.Add("RMS stem theo đoạn (dBFS)   A      B      C      D      E      F      G");
        int[] edges = { 1, 9, 25, 33, 49, 65, 81, 89 };
        foreach (var (b, s) in r.LoopStems)
        {
            Save(Path.Combine(dir, $"stem_loop_{b.ToString().ToLowerInvariant()}.wav"), s.l, s.r, 4 + (int)b);
            r.Log.Add($"  {b,-8}               " + string.Join(" ", Enumerable.Range(0, 7).Select(k => $"{Mix.ToDb(Meter.Rms(s.l, s.r, (edges[k] - 1) * Mix.BarN, (edges[k + 1] - 1) * Mix.BarN)),6:0.0}")));
        }
        File.WriteAllLines(Path.Combine(dir, "render.txt"), r.Log);
    }

    // 16-bit with TPDF dither (+-1 LSB), deterministic.
    static void Save(string path, float[] l, float[] r, int seed)
    {
        var rng = new Random(seed); float lsb = 1f / 32768;
        var dl = new float[l.Length]; var dr = new float[r.Length];
        for (int i = 0; i < l.Length; i++)
        {
            dl[i] = l[i] + (float)(rng.NextDouble() - rng.NextDouble()) * lsb;
            dr[i] = r[i] + (float)(rng.NextDouble() - rng.NextDouble()) * lsb;
        }
        File.WriteAllBytes(path, CinemaWav.Write(CinemaSample.FromStereo(dl, dr, Mix.Rate)));
    }
}

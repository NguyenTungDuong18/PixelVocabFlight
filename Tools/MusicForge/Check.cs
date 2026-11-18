using PixelVocabFlight;

namespace MusicForge;

// Assert-based checks on the two WAVs of the contract; prints and saves the measurements (check.txt in the report folder).
public static class Check
{
    static readonly (string name, int from, int to)[] Sections = { ("A", 1, 8), ("B", 9, 24), ("C", 25, 32), ("D", 33, 48), ("E", 49, 64), ("F", 65, 80), ("G", 81, 88) };

    public static int Run(string dir, string reportDir)
    {
        var lines = new List<string>(); int fails = 0;
        void Say(string s) { Console.WriteLine(s); lines.Add(s); }
        void Assert(bool ok, string what) { Say((ok ? "  OK   " : "  LỖI  ") + what); if (!ok) fails++; }

        var intro = Load(Path.Combine(dir, "title_intro.wav"), out byte[] ib); var loop = Load(Path.Combine(dir, "title_loop.wav"), out byte[] lb);
        Say($"thư mục: {dir}");
        Say($"title_intro.wav {ib.Length / 1e6:0.00} MB, title_loop.wav {lb.Length / 1e6:0.00} MB");
        Assert(intro.Rate == 44100 && loop.Rate == 44100 && !intro.Mono && !loop.Mono && ib[34] == 16 && lb[34] == 16, "PCM 16-bit stereo 44 100 Hz");
        Assert(intro.Length == Mix.IntroN, $"intro dài {intro.Length} mẫu (cần {Mix.IntroN} = 4 ô)");
        Assert(loop.Length == Mix.LoopN, $"loop dài {loop.Length} mẫu (cần {Mix.LoopN} = 88 ô = 211,2 s)");
        foreach (var (nm, s) in new[] { ("intro", intro), ("loop", loop) })
        {
            double pk = Meter.Peak(s.L, s.R);
            Assert(Mix.ToDb(pk) <= -1.0, $"{nm}: đỉnh {Mix.ToDb(pk):0.00} dBFS <= -1");
            bool finite = s.L.All(float.IsFinite) && s.R.All(float.IsFinite);
            int run = 0, maxRun = 0; foreach (var v in s.L.Concat(s.R)) { run = Math.Abs(v) >= .9999f ? run + 1 : 0; maxRun = Math.Max(maxRun, run); }
            Assert(finite && maxRun < 3, $"{nm}: không NaN, không mẫu kẹt ở biên (chuỗi dài nhất {maxRun})");
        }
        double lufs = Meter.Lufs(loop.L, loop.R, true), lufsI = Meter.Lufs(intro.L, intro.R);
        Assert(Math.Abs(lufs + 18) <= 1, $"loop: {lufs:0.0} LUFS tích hợp (mục tiêu -18 ± 1); intro {lufsI:0.0} LUFS");

        // Silence: 50 ms windows under -60 dBFS, joined circularly.
        int w = Mix.Rate / 20, nw = loop.Length / w, longest = 0, cur = 0;
        for (int k = 0; k < 2 * nw; k++)
        {
            int a = (k % nw) * w; bool quiet = Mix.ToDb(Meter.Rms(loop.L, loop.R, a, a + w)) < -60;
            cur = quiet ? cur + 1 : 0; longest = Math.Max(longest, Math.Min(cur, nw));
        }
        Assert(longest * .05 <= 1.0, $"loop: đoạn im (< -60 dBFS) dài nhất {longest * .05:0.00} s <= 1 s");

        // Seams: loop end -> loop start, intro end -> loop start.
        Seam(Say, Assert, "nối vòng (cuối loop -> đầu loop)", loop.L, loop.R, loop.L, loop.R);
        Seam(Say, Assert, "nối intro -> loop", intro.L, intro.R, loop.L, loop.R);

        // Sections.
        Say("RMS theo đoạn (dBFS) và phân bố phổ (dB so với tổng đoạn: <120 Hz | 120-500 | 500-2k | 2k-6k | >6k):");
        var rms = new Dictionary<string, double>();
        var bands = Bands(loop);
        foreach (var (nm, a, b) in Sections)
        {
            int s0 = (a - 1) * Mix.BarN, s1 = b * Mix.BarN; double r = Mix.ToDb(Meter.Rms(loop.L, loop.R, s0, s1)); rms[nm] = r;
            double tot = bands.Sum(x => x.e[nm]);
            Say($"  {nm} ô {a,2}-{b,2}: RMS {r,6:0.0} | " + string.Join(" | ", bands.Select(x => $"{Mix.ToDb(Math.Sqrt(x.e[nm] / tot)),5:0.0}")));
        }
        Say("RMS theo ô: " + string.Join(" ", Enumerable.Range(0, Mix.LoopBars).Select(i => $"{Mix.ToDb(Meter.Rms(loop.L, loop.R, i * Mix.BarN, (i + 1) * Mix.BarN)):0}")));
        foreach (var (q, l) in new[] { ("A", "D"), ("A", "F"), ("E", "D"), ("E", "F") })
            Assert(rms[q] + 3 <= rms[l], $"đoạn {q} ({rms[q]:0.0}) nhỏ hơn {l} ({rms[l]:0.0}) ít nhất 3 dB");
        // In game the music plays at ~x0.49 over menu wind at ~-32 dBFS RMS: the quiet sections must stay audible.
        Assert(rms["A"] >= -28 && rms["A"] <= -24 && rms["A"] + 1 <= rms["B"], $"đoạn A {rms["A"]:0.0} dBFS trong -28..-24 và nhỏ hơn B ({rms["B"]:0.0})");
        Assert(rms["E"] >= -30, $"đoạn E {rms["E"]:0.0} dBFS >= -30");
        double hit = Mix.ToDb(Meter.Rms(intro.L, intro.R, 0, Mix.Rate / 2)), end = Mix.ToDb(Meter.Rms(intro.L, intro.R, 2 * Mix.BarN, 3 * Mix.BarN));
        Assert(hit > end + 6, $"intro: cú hit 0-0,5 s {hit:0.0} dBFS, ô 3 {end:0.0} dBFS (tắt dần sau cú hit)");
        // The intro's last 2 beats are the loop's last 2 beats (only the dither differs), so intro -> loop joins like loop -> loop.
        double diff = 0; int tail = 2 * Mix.BeatN;
        for (int i = 0; i < tail; i++)
        {
            int a = Mix.IntroN - tail + i, b = Mix.LoopN - tail + i;
            diff = Math.Max(diff, Math.Max(Math.Abs(intro.L[a] - loop.L[b]), Math.Abs(intro.R[a] - loop.R[b])));
        }
        Assert(diff <= 4.0 / 32768, $"intro: 2 phách cuối trùng 2 phách cuối của loop (sai khác lớn nhất {diff * 32768:0} LSB)");
        Assert(Mix.ToDb(Math.Max(Math.Abs(intro.L[0]), Math.Abs(intro.R[0]))) < -30 && Mix.ToDb(Meter.Rms(intro.L, intro.R, 0, 441)) > -40,
            $"intro: mẫu 0 không click ({Mix.ToDb(Math.Abs(intro.L[0])):0} dB), tiếng hit vào ngay trong 10 ms đầu ({Mix.ToDb(Meter.Rms(intro.L, intro.R, 0, 441)):0.0} dBFS)");

        Say(fails == 0 ? "KẾT QUẢ: ĐẠT" : $"KẾT QUẢ: {fails} LỖI");
        Directory.CreateDirectory(reportDir);
        File.WriteAllLines(Path.Combine(reportDir, "check.txt"), lines);
        return fails == 0 ? 0 : 1;
    }

    static CinemaSample Load(string path, out byte[] bytes) { bytes = File.ReadAllBytes(path); return CinemaWav.Read(bytes, Path.GetFileName(path)); }

    static void Seam(Action<string> say, Action<bool, string> assert, string what, float[] aL, float[] aR, float[] bL, float[] bR)
    {
        int n = aL.Length; double jump = Math.Max(Math.Abs(aL[n - 1] - bL[0]), Math.Abs(aR[n - 1] - bR[0]));
        double step = 0;
        for (int i = n - 2048; i < n - 1; i++) step = Math.Max(step, Math.Max(Math.Abs(aL[i + 1] - aL[i]), Math.Abs(aR[i + 1] - aR[i])));
        for (int i = 0; i < 2047; i++) step = Math.Max(step, Math.Max(Math.Abs(bL[i + 1] - bL[i]), Math.Abs(bR[i + 1] - bR[i])));
        assert(jump <= step * 1.5 + 2.0 / 32768, $"{what}: bước nhảy ở mối nối {jump:0.00000} <= 1,5 x bước lớn nhất quanh đó ({step:0.00000})");
        int h = Mix.Rate / 2; double e = Mix.ToDb(Meter.Rms(aL, aR, n - h, n)), s = Mix.ToDb(Meter.Rms(bL, bR, 0, h));
        assert(Math.Abs(e - s) <= 6, $"{what}: RMS 0,5 s cuối {e:0.0} dB, 0,5 s đầu {s:0.0} dB (chênh {Math.Abs(e - s):0.0} <= 6)");
    }

    // Energy per band and section, from a mono sum split by 4th-order crossovers.
    static List<(string band, Dictionary<string, double> e)> Bands(CinemaSample s)
    {
        int n = s.Length; var mono = new float[n]; for (int i = 0; i < n; i++) mono[i] = (s.L[i] + s.R[i]) * .5f;
        double[] edges = { 120, 500, 2000, 6000 };
        var res = new List<(string, Dictionary<string, double>)>();
        for (int b = 0; b <= edges.Length; b++)
        {
            var x = (float[])mono.Clone();
            if (b > 0) { Bq.HighPass(edges[b - 1]).Run(x); Bq.HighPass(edges[b - 1]).Run(x); }
            if (b < edges.Length) { Bq.LowPass(edges[b]).Run(x); Bq.LowPass(edges[b]).Run(x); }
            var d = new Dictionary<string, double>();
            foreach (var (nm, a, z) in Sections) { double e = 0; for (int i = (a - 1) * Mix.BarN; i < z * Mix.BarN; i++) e += x[i] * (double)x[i]; d[nm] = e; }
            res.Add((b.ToString(), d));
        }
        return res;
    }
}

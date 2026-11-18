using System.Numerics;
using PixelVocabFlight;

// Measurements of a source (or a finished sample): levels and spectrum per window, onsets, and two warnings: syllabic modulation (a voice)
// and persistent narrow tones in 2-8 kHz (a bird). The thresholds are heuristics; they only point at the places worth another look.
static class Scan
{
    const int Rate = CinemaDsp.Rate;

    public static void Fft(Complex[] a)
    {
        int n = a.Length;
        for (int i = 1, j = 0; i < n; i++)
        {
            int bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) (a[i], a[j]) = (a[j], a[i]);
        }
        for (int len = 2; len <= n; len <<= 1)
        {
            double ang = -2 * Math.PI / len; var wl = new Complex(Math.Cos(ang), Math.Sin(ang));
            for (int i = 0; i < n; i += len)
            {
                var w = Complex.One;
                for (int k = 0; k < len / 2; k++) { var u = a[i + k]; var v = a[i + k + len / 2] * w; a[i + k] = u + v; a[i + k + len / 2] = u - v; w *= wl; }
            }
        }
    }

    public static float[] Mono(CinemaSample s)
    {
        if (s.Mono) return s.L;
        var m = new float[s.Length]; for (int i = 0; i < m.Length; i++) m[i] = (s.L[i] + s.R[i]) * .5f;
        return m;
    }

    public static double Db(double v) => 20 * Math.Log10(Math.Max(v, 1e-9));

    // Averaged power spectrum of x[from..to) (Hann, 4096, half overlap); bin k = k * Rate / 4096 Hz.
    public static double[] Spectrum(float[] x, int from, int to)
    {
        const int N = 4096; var p = new double[N / 2 + 1]; int frames = 0; var buf = new Complex[N];
        for (int s = from; s == from || s + N <= to; s += N / 2)
        {
            for (int i = 0; i < N; i++) { int j = s + i; buf[i] = j < to && j < x.Length ? x[j] * (.5 - .5 * Math.Cos(2 * Math.PI * i / N)) : 0; }
            Fft(buf);
            for (int k = 0; k <= N / 2; k++) p[k] += buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary;
            frames++;
        }
        for (int k = 0; k < p.Length; k++) p[k] /= frames;
        return p;
    }

    public static double Centroid(double[] p)
    {
        double s = 0, w = 0; for (int k = 1; k < p.Length; k++) { double f = k * (double)Rate / 4096; s += f * p[k]; w += p[k]; }
        return w > 0 ? s / w : 0;
    }

    public static double Band(double[] p, double lo, double hi)
    {
        double a = 0, all = 0; for (int k = 1; k < p.Length; k++) { double f = k * (double)Rate / 4096; all += p[k]; if (f >= lo && f < hi) a += p[k]; }
        return all > 0 ? a / all : 0;
    }

    public static double RmsOf(float[] x, int a, int z)
    {
        a = Math.Max(0, a); z = Math.Min(x.Length, z); if (z <= a) return 0;
        double s = 0; for (int i = a; i < z; i++) s += (double)x[i] * x[i];
        return Math.Sqrt(s / (z - a));
    }

    // Fraction of 2048-sample frames in [from, to) whose 2-8 kHz band holds a single sharp tone (peak / mean power > 25) that carries at least
    // 3 % of the frame's energy: the signature of a bird (or a whistle), not of noise (a noise peak is only about 5 x the mean).
    public static double TonalFraction(float[] x, int from, int to)
    {
        const int N = 2048; var buf = new Complex[N]; int frames = 0, hits = 0;
        for (int s = from; s + N <= to && s + N <= x.Length; s += N / 2)
        {
            for (int i = 0; i < N; i++) buf[i] = x[s + i] * (.5 - .5 * Math.Cos(2 * Math.PI * i / N));
            Fft(buf);
            double all = 0, band = 0, max = 0; int lo = (int)(2000.0 * N / Rate), hi = (int)(8000.0 * N / Rate);
            for (int k = 1; k < N / 2; k++) { double p = buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary; all += p; if (k >= lo && k < hi) { band += p; max = Math.Max(max, p); } }
            frames++;
            if (all > 1e-9 && band / (hi - lo) > 0 && max / (band / (hi - lo)) > 25 && max > all * .03) hits++;
        }
        return frames == 0 ? 0 : hits / (double)frames;
    }

    // Share of the envelope modulation (1-16 Hz) of the 300-3000 Hz band that sits at 3-6 Hz, the rate of syllables. Speech is usually > 0.55;
    // an engine or a blast is not. Needs about 2.5 s to be meaningful.
    public static double SyllableShare(float[] x, int from, int to)
    {
        var hp = new Biquad(Filt.High, 300); var lp = new Biquad(Filt.Low, 3000);
        int step = Rate / 100, n = (to - from) / step; if (n < 128) return 0;
        var env = new double[n]; double acc = 0; int c = 0, o = 0;
        for (int i = from; i < to && o < n; i++)
        {
            acc += Math.Abs(lp.Tick(hp.Tick(x[i]))); c++;
            if (c == step) { env[o++] = acc / step; acc = 0; c = 0; }
        }
        int M = 256; var buf = new Complex[M]; double mean = 0; int m = Math.Min(M, n);
        for (int i = 0; i < m; i++) mean += env[i]; mean /= m;
        for (int i = 0; i < M; i++) buf[i] = i < m ? (env[i] - mean) * (.5 - .5 * Math.Cos(2 * Math.PI * i / m)) : 0;
        Fft(buf);
        double tot = 0, syl = 0;
        for (int k = 1; k < M / 2; k++) { double f = k * 100.0 / M, p = buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary; if (f >= 1 && f <= 16) tot += p; if (f >= 3 && f <= 6) syl += p; }
        return tot > 0 ? syl / tot : 0;
    }

    public static void Run(string path, double win, double hop, double from, double to)
    {
        var s = Source.Load(path); var x = Mono(s);
        double total = x.Length / (double)Rate; if (to <= 0 || to > total) to = total;
        Console.WriteLine(Path.GetFileName(path) + "  " + total.ToString("0.0") + " s " + (s.Mono ? "mono" : "stereo") + "  peak " + Db(x.Max(Math.Abs)).ToString("0.0") + " dB");
        Console.WriteLine("   t      peak   rms  centroid  <120 120-1k 1-5k  >5k  birds voice");
        for (double t = from; t + win <= to + 1e-6; t += hop)
        {
            int a = (int)(t * Rate), z = (int)((t + win) * Rate);
            var seg = new float[Math.Min(z, x.Length) - a]; Array.Copy(x, a, seg, 0, seg.Length);
            var p = Spectrum(seg, 0, seg.Length);
            double pk = 0; foreach (float v in seg) pk = Math.Max(pk, Math.Abs(v));
            Console.WriteLine("{0,6:0.00} {1,6:0.0} {2,6:0.0} {3,7:0} {4,6:0%} {5,5:0%} {6,5:0%} {7,5:0%}  {8,4:0%} {9,5:0.00}", t, Db(pk), Db(RmsOf(seg, 0, seg.Length)), Centroid(p),
                Band(p, 0, 120), Band(p, 120, 1000), Band(p, 1000, 5000), Band(p, 5000, 30000), TonalFraction(seg, 0, seg.Length), win >= 2.4 ? SyllableShare(seg, 0, seg.Length) : -1);
        }
    }

    // Onsets: moments where the 5 ms envelope rises by 12 dB over the previous 20 ms and is above -40 dBFS (less than 'gap' seconds apart are merged).
    public static List<int> Onsets(float[] x, double gap = .04, double riseDb = 12, double floorDb = -40)
    {
        int w = (int)(.005 * Rate), back = (int)(.02 * Rate); var res = new List<int>();
        int n = x.Length / w; var e = new double[n];
        for (int i = 0; i < n; i++) e[i] = RmsOf(x, i * w, (i + 1) * w);
        for (int i = 4; i < n; i++)
        {
            double before = 1e-9; for (int k = 1; k <= back / w; k++) before = Math.Max(before, e[i - k]);
            if (Db(e[i]) > floorDb && Db(e[i]) - Db(before) > riseDb)
            {
                int at = i * w; if (res.Count > 0 && at - res[^1] < gap * Rate) continue;
                res.Add(at);
            }
        }
        return res;
    }
}

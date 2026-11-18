using System.Numerics;
using PixelVocabFlight;

// Measurements on rendered audio: levels, spectrum (Welch), rhythm, seams, clipping.
static class Analysis
{
    public const int Rate = CinemaDsp.Rate;

    public static float[] Mono(Stereo s)
    {
        var m = new float[s.Length];
        for (int i = 0; i < m.Length; i++) m[i] = (s.L[i] + s.R[i]) * .5f;
        return m;
    }

    public static float[] MonoOfInterleaved(float[] x)
    {
        var m = new float[x.Length / 2];
        for (int i = 0; i < m.Length; i++) m[i] = (x[2 * i] + x[2 * i + 1]) * .5f;
        return m;
    }

    public static double DbOf(double v) => 20 * Math.Log10(Math.Max(v, 1e-9));

    static void Fft(Complex[] a)
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
            double ang = -2 * Math.PI / len;
            var wl = new Complex(Math.Cos(ang), Math.Sin(ang));
            for (int i = 0; i < n; i += len)
            {
                var w = Complex.One;
                for (int k = 0; k < len / 2; k++)
                {
                    var u = a[i + k]; var v = a[i + k + len / 2] * w;
                    a[i + k] = u + v; a[i + k + len / 2] = u - v; w *= wl;
                }
            }
        }
    }

    // Average power spectrum (Welch, Hann, 4096 points, half overlap). Bin k is k * Rate / 4096 Hz.
    public static double[] Spectrum(float[] x)
    {
        const int N = 4096;
        var p = new double[N / 2 + 1]; int frames = 0;
        var win = new double[N]; for (int i = 0; i < N; i++) win[i] = .5 - .5 * Math.Cos(2 * Math.PI * i / N);
        var buf = new Complex[N];
        for (int start = 0; start == 0 || start + N <= x.Length; start += N / 2)
        {
            for (int i = 0; i < N; i++) buf[i] = start + i < x.Length ? x[start + i] * win[i] : 0;
            Fft(buf);
            for (int k = 0; k <= N / 2; k++) p[k] += buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary;
            frames++;
        }
        for (int k = 0; k < p.Length; k++) p[k] /= frames;
        return p;
    }

    public static double Centroid(double[] p)
    {
        double s = 0, w = 0;
        for (int k = 1; k < p.Length; k++) { double f = k * (double)Rate / 4096; s += f * p[k]; w += p[k]; }
        return w > 0 ? s / w : 0;
    }

    // Fraction of energy in [lo, hi) Hz.
    public static double Band(double[] p, double lo, double hi)
    {
        double a = 0, all = 0;
        for (int k = 1; k < p.Length; k++) { double f = k * (double)Rate / 4096; all += p[k]; if (f >= lo && f < hi) a += p[k]; }
        return all > 0 ? a / all : 0;
    }

    // Absolute energy below 120 Hz (a 4th order low-pass, then the sum of squares): compares how big the low end of two sounds is.
    public static double LowEnergy(float[] x, double hz = 120)
    {
        var a = new Biquad(Filt.Low, hz); var b = new Biquad(Filt.Low, hz); double e = 0;
        foreach (float v in x) { float y = b.Tick(a.Tick(v)); e += (double)y * y; }
        return e;
    }

    // Number of envelope peaks and the average rate between the first and the last one.
    public static double PeakRate(float[] x, double minGap, double frac, out int count)
    {
        int smooth = (int)(.002 * Rate); var env = new float[x.Length]; float e = 0, k = 1f / smooth;
        for (int i = 0; i < x.Length; i++) { e += (Math.Abs(x[i]) - e) * k; env[i] = e; }
        float max = env.Max(), thr = (float)(max * frac);
        var peaks = new List<int>(); int gap = (int)(minGap * Rate);
        for (int i = 1; i < env.Length - 1; i++)
        {
            if (env[i] < thr || env[i] < env[i - 1] || env[i] <= env[i + 1]) continue;
            if (peaks.Count > 0 && i - peaks[^1] < gap) { if (env[i] > env[peaks[^1]]) peaks[^1] = i; continue; }
            peaks.Add(i);
        }
        count = peaks.Count;
        return peaks.Count < 2 ? 0 : (peaks.Count - 1) / ((peaks[^1] - peaks[0]) / (double)Rate);
    }

    // Jump across the loop seam compared with the 99.9th percentile of the ordinary steps.
    public static double SeamRatio(float[] x)
    {
        var d = new float[x.Length - 1];
        for (int i = 0; i < d.Length; i++) d[i] = Math.Abs(x[i + 1] - x[i]);
        var sorted = (float[])d.Clone(); Array.Sort(sorted);
        double p = sorted[(int)(sorted.Length * .999)];
        return Math.Abs(x[0] - x[^1]) / Math.Max(p, 1e-9);
    }

    // Fraction of 2048-sample frames whose 2-8 kHz band holds one sharp tone (peak / mean power > 25, at least 3 % of the frame's energy):
    // a bird or a whistle, not noise (a noise peak is about 5 x the mean).
    public static double TonalFraction(float[] x)
    {
        const int N = 2048; var buf = new Complex[N]; int frames = 0, hits = 0;
        int lo = (int)(2000.0 * N / Rate), hi = (int)(8000.0 * N / Rate);
        for (int s = 0; s + N <= x.Length; s += N / 2)
        {
            for (int i = 0; i < N; i++) buf[i] = x[s + i] * (.5 - .5 * Math.Cos(2 * Math.PI * i / N));
            Fft(buf);
            double all = 0, band = 0, max = 0;
            for (int k = 1; k < N / 2; k++) { double p = buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary; all += p; if (k >= lo && k < hi) { band += p; max = Math.Max(max, p); } }
            frames++;
            if (all > 1e-9 && max / (band / (hi - lo)) > 25 && max > all * .03) hits++;
        }
        return frames == 0 ? 0 : hits / (double)frames;
    }

    // Share of the 1-16 Hz modulation of the 300-3000 Hz band's envelope that sits at 3-6 Hz (the rate of syllables), over the first 2.5 s.
    public static double SyllableShare(float[] x)
    {
        var hp = new Biquad(Filt.High, 300); var lp = new Biquad(Filt.Low, 3000);
        int step = Rate / 100, n = Math.Min(x.Length / step, 256); if (n < 128) return 0;
        var env = new double[n]; double acc = 0; int c = 0, o = 0;
        for (int i = 0; i < x.Length && o < n; i++) { acc += Math.Abs(lp.Tick(hp.Tick(x[i]))); if (++c == step) { env[o++] = acc / step; acc = 0; c = 0; } }
        const int M = 256; var buf = new Complex[M]; double mean = env.Take(n).Average();
        for (int i = 0; i < M; i++) buf[i] = i < n ? (env[i] - mean) * (.5 - .5 * Math.Cos(2 * Math.PI * i / n)) : 0;
        Fft(buf);
        double tot = 0, syl = 0;
        for (int k = 1; k < M / 2; k++) { double f = k * 100.0 / M, p = buf[k].Real * buf[k].Real + buf[k].Imaginary * buf[k].Imaginary; if (f >= 1 && f <= 16) tot += p; if (f >= 3 && f <= 6) syl += p; }
        return tot > 0 ? syl / tot : 0;
    }

    public static bool HasBad(float[] x) { foreach (float v in x) if (float.IsNaN(v) || float.IsInfinity(v)) return true; return false; }

    // Longest run of samples at (almost) full scale.
    public static int FlatRun(float[] x)
    {
        int best = 0, run = 0;
        foreach (float v in x) { if (Math.Abs(v) >= .999f) { run++; best = Math.Max(best, run); } else run = 0; }
        return best;
    }

    public static double Peak(float[] x) { float p = 0; foreach (float v in x) p = Math.Max(p, Math.Abs(v)); return p; }

    public static double Rms(float[] x, double from, double to)
    {
        int a = (int)Math.Max(0, Math.Min(x.Length, from * Rate)), z = (int)Math.Max(0, Math.Min(x.Length, to * Rate));
        if (z <= a) return 0;
        double s = 0; for (int i = a; i < z; i++) s += (double)x[i] * x[i];
        return Math.Sqrt(s / (z - a));
    }

    // Largest absolute sample in [from, to) seconds.
    public static double PeakIn(float[] x, double from, double to)
    {
        int a = (int)Math.Max(0, Math.Min(x.Length, from * Rate)), z = (int)Math.Max(0, Math.Min(x.Length, to * Rate));
        float p = 0; for (int i = a; i < z; i++) p = Math.Max(p, Math.Abs(x[i]));
        return p;
    }

    // RMS per 'window' seconds (the envelope).
    public static double[] Envelope(float[] x, double window = .05)
    {
        int w = (int)(window * Rate), n = x.Length / w; var e = new double[n];
        for (int k = 0; k < n; k++) { double s = 0; for (int i = k * w; i < (k + 1) * w; i++) s += (double)x[i] * x[i]; e[k] = Math.Sqrt(s / w); }
        return e;
    }

    // Normalised (Pearson) correlation of a series with itself 'lag' steps later: 1 = the envelope repeats exactly, 0 = unrelated.
    public static double Correlation(double[] e, int lag)
    {
        int n = e.Length - lag; if (n < 10) return 0;
        double ma = 0, mb = 0; for (int i = 0; i < n; i++) { ma += e[i]; mb += e[i + lag]; }
        ma /= n; mb /= n;
        double ab = 0, aa = 1e-18, bb = 1e-18;
        for (int i = 0; i < n; i++) { double a = e[i] - ma, b = e[i + lag] - mb; ab += a * b; aa += a * a; bb += b * b; }
        return ab / Math.Sqrt(aa * bb);
    }

    // 16-bit stereo PCM WAV.
    public static void WriteWav(string path, float[] interleaved)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
        using var w = new BinaryWriter(File.Create(path));
        int bytes = interleaved.Length * 2;
        w.Write("RIFF".ToCharArray()); w.Write(36 + bytes); w.Write("WAVEfmt ".ToCharArray()); w.Write(16); w.Write((short)1); w.Write((short)2);
        w.Write(Rate); w.Write(Rate * 4); w.Write((short)4); w.Write((short)16); w.Write("data".ToCharArray()); w.Write(bytes);
        foreach (float v in interleaved) w.Write((short)Math.Round(Math.Max(-1, Math.Min(1, v)) * 32767));
    }
}

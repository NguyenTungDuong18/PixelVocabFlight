using NLayer;
using PixelVocabFlight;

// Decoding and resampling of the source MP3 files (offline, once). Everything is float, 44.1 kHz.
static class Source
{
    public const int Rate = CinemaDsp.Rate;

    // Decoded file: L and R (the same array when the file is mono).
    public static CinemaSample Load(string path)
    {
        using var mp3 = new MpegFile(path);
        int ch = mp3.Channels, rate = mp3.SampleRate;
        var all = new List<float>(rate * ch * 60); var buf = new float[ch * 4096];
        int n;
        while ((n = mp3.ReadSamples(buf, 0, buf.Length)) > 0) for (int i = 0; i < n; i++) all.Add(buf[i]);
        int frames = all.Count / ch;
        var l = new float[frames]; var r = ch == 2 ? new float[frames] : l;
        for (int i = 0; i < frames; i++) { l[i] = all[i * ch]; if (ch == 2) r[i] = all[i * ch + 1]; }
        var s = new CinemaSample { Rate = rate, L = l, R = r };
        return rate == Rate ? s : Resample(s, Rate);
    }

    // Windowed-sinc resampling (32 taps each side), keeping mono as mono.
    public static CinemaSample Resample(CinemaSample s, int to)
    {
        if (s.Rate == to) return s;
        float[] one(float[] x) => Resample(x, s.Rate, to);
        var l = one(s.L);
        return new CinemaSample { Rate = to, L = l, R = s.Mono ? l : one(s.R) };
    }

    // The input and output rates are whole numbers, so the fractional positions repeat every 'up' output samples: one kernel per phase.
    public static float[] Resample(float[] x, double from, double to)
    {
        long a = (long)from, b = (long)to, g = Gcd(a, b), down = a / g, up = b / g;
        double cut = Math.Min(1, to / from) * .96; int taps = 32;
        var kernel = new double[up][];
        for (int p = 0; p < up; p++)
        {
            kernel[p] = new double[2 * taps]; double frac = (double)(p * down % up) / up;   // position inside the input sample
            for (int k = -taps + 1; k <= taps; k++)
            {
                double t = frac - k, arg = t * cut * Math.PI, sinc = Math.Abs(arg) < 1e-9 ? 1 : Math.Sin(arg) / arg, w = .5 + .5 * Math.Cos(Math.PI * t / taps);
                kernel[p][k + taps - 1] = sinc * cut * w;
            }
        }
        int n = (int)((long)x.Length * up / down); var y = new float[n];
        for (int i = 0; i < n; i++)
        {
            long pos = (long)i * down; int c = (int)(pos / up); var kern = kernel[i % up]; double sum = 0;
            for (int k = -taps + 1; k <= taps; k++) { int j = c + k; if (j >= 0 && j < x.Length) sum += x[j] * kern[k + taps - 1]; }
            y[i] = (float)sum;
        }
        return y;
    }

    static long Gcd(long a, long b) { while (b != 0) (a, b) = (b, a % b); return a; }
}

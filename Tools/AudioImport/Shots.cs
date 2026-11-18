using PixelVocabFlight;

// Finding single shots inside a recording of a burst: peaks of the 1.2 kHz high-passed envelope (smoothed over 1 ms), at least minGap apart
// and above 'frac' of the loudest peak in the range. Returns the sample of each shot's start (the envelope has just risen: 'lead' back from the peak).
static class Shots
{
    const int Rate = CinemaDsp.Rate;

    public static List<int> Find(float[] x, int from, int to, double minGap, double frac, double hpHz = 1200, double lead = .003)
    {
        from = Math.Max(0, from); to = Math.Min(x.Length, to);
        var hp = new Biquad(Filt.High, hpHz); var hp2 = new Biquad(Filt.High, hpHz);
        int sm = Rate / 1000, n = (to - from) / sm; var env = new float[n];
        for (int i = 0; i < n; i++) { float a = 0; for (int j = 0; j < sm; j++) a += Math.Abs(hp2.Tick(hp.Tick(x[from + i * sm + j]))); env[i] = a / sm; }
        float max = 0; foreach (float v in env) max = Math.Max(max, v);
        var res = new List<int>(); int gap = (int)(minGap * 1000);
        for (int i = 1; i < n - 1; i++)
        {
            if (env[i] < max * frac || env[i] < env[i - 1] || env[i] < env[i + 1]) continue;
            int last = res.Count > 0 ? (res[^1] - from) / sm : -1000000;
            if (i - last < gap) { if (env[i] > env[last]) res[^1] = from + i * sm; continue; }
            res.Add(from + i * sm);
        }
        for (int k = 0; k < res.Count; k++) res[k] = Math.Max(0, res[k] - (int)(lead * Rate));
        return res;
    }

    public static void Print(float[] x, int from, int to, double minGap, double frac, double hpHz)
    {
        var list = Find(x, from, to, minGap, frac, hpHz);
        Console.WriteLine(list.Count + " tiếng");
        for (int i = 0; i < list.Count; i++)
        {
            double t = list[i] / (double)Rate, dt = i > 0 ? (list[i] - list[i - 1]) / (double)Rate : 0;
            Console.Write(t.ToString("0.000") + (i > 0 ? "(" + (dt * 1000).ToString("0") + ")" : "") + " ");
        }
        Console.WriteLine();
    }
}

namespace MusicForge;

public static class Mix
{
    public const int Rate = 44100;
    public const double Bpm = 100, Beat = 60 / Bpm;           // 0.6 s
    public const int BeatN = 26460, BarN = 4 * BeatN;          // 105 840 samples per bar
    public const int IntroBars = 4, LoopBars = 88;
    public const int IntroN = IntroBars * BarN, LoopN = LoopBars * BarN;   // 423 360 and 9 313 920 (the contract with the game)
    public static double Db(double db) => Math.Pow(10, db / 20);
    public static double ToDb(double x) => 20 * Math.Log10(Math.Max(x, 1e-12));
}

// RBJ biquad (direct form I), double state.
public sealed class Bq
{
    double b0, b1, b2, a1, a2, x1, x2, y1, y2;
    Bq(double b0, double b1, double b2, double a0, double a1, double a2) { this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; }
    static (double w, double c, double s) W(double f) { double w = 2 * Math.PI * f / Mix.Rate; return (w, Math.Cos(w), Math.Sin(w)); }
    public static Bq HighPass(double f, double q = .7071) { var (_, c, s) = W(f); double a = s / (2 * q); return new((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + a, -2 * c, 1 - a); }
    public static Bq LowPass(double f, double q = .7071) { var (_, c, s) = W(f); double a = s / (2 * q); return new((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + a, -2 * c, 1 - a); }
    public static Bq Peak(double f, double db, double q)
    {
        var (_, c, s) = W(f); double A = Math.Pow(10, db / 40), a = s / (2 * q);
        return new(1 + a * A, -2 * c, 1 - a * A, 1 + a / A, -2 * c, 1 - a / A);
    }
    public static Bq HighShelf(double f, double db, double q)
    {
        var (_, c, s) = W(f); double A = Math.Pow(10, db / 40), a = s / (2 * q), sq = 2 * Math.Sqrt(A) * a;
        return new(A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq),
                   (A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq);
    }
    public double Tick(double x) { double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
    public void Run(float[] x) { for (int i = 0; i < x.Length; i++) x[i] = (float)Tick(x[i]); }
}

// 8-line feedback delay network (Householder matrix), RT60 ~2.2 s, 25 ms pre-delay, a few early reflections, HF damping.
public static class Reverb
{
    static readonly int[] Lines = { 1427, 1637, 1847, 2053, 2311, 2539, 2803, 3061 };

    public static (float[] l, float[] r) Run(float[] inL, float[] inR, double rt60 = 2.2)
    {
        int n = inL.Length, pre = (int)(.025 * Mix.Rate);
        var outL = new float[n]; var outR = new float[n];
        var hp = new[] { Bq.HighPass(160), Bq.HighPass(160) }; var lp = new[] { Bq.LowPass(7000), Bq.LowPass(7000) };
        var bufs = Lines.Select(d => new double[d]).ToArray(); var idx = new int[8]; var damp = new double[8];
        var g = Lines.Select(d => Math.Pow(10, -3.0 * d / (rt60 * Mix.Rate))).ToArray();
        int[] erT = { 311, 487, 709, 953, 1291, 1607 }; double[] erG = { .42, .36, .3, .26, .2, .16 };
        var o = new double[8];
        for (int i = 0; i < n; i++)
        {
            int j = i - pre;
            double xl = j >= 0 ? hp[0].Tick(inL[j]) : 0, xr = j >= 0 ? hp[1].Tick(inR[j]) : 0;
            double el = 0, er = 0;
            for (int k = 0; k < erT.Length; k++) { int q = j - erT[k]; if (q < 0) continue; if ((k & 1) == 0) el += erG[k] * inL[q]; else er += erG[k] * inR[q]; }
            double sum = 0;
            for (int k = 0; k < 8; k++)
            {
                double y = bufs[k][idx[k]];
                damp[k] += .55 * (y - damp[k]);         // one-pole lowpass in the loop: highs die first
                o[k] = damp[k] * g[k]; sum += o[k];
            }
            double h = sum * 2 / 8;
            for (int k = 0; k < 8; k++)
            {
                double inp = (k < 4 ? xl : xr) * .35;
                bufs[k][idx[k]] = o[k] - h + inp;
                if (++idx[k] == Lines[k]) idx[k] = 0;
            }
            double wl = o[0] - o[2] + o[4] - o[6], wr = o[1] - o[3] + o[5] - o[7];
            outL[i] = (float)lp[0].Tick(wl * .5 + el); outR[i] = (float)lp[1].Tick(wr * .5 + er);
        }
        return (outL, outR);
    }
}

public static class Meter
{
    // ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks, 75 % overlap, -70 LUFS and -10 LU gates). circular = also the blocks over the seam.
    public static double Lufs(float[] l, float[] r, bool circular = false)
    {
        int n = l.Length, blk = (int)(.4 * Mix.Rate), hop = blk / 4;
        var ms = new double[n];
        foreach (var (x, ch) in new[] { (l, 0), (r, 1) })
        {
            var a = Bq.HighShelf(1681.974450955533, 3.999843853973347, .7071752369554196); var b = Bq.HighPass(38.13547087602444, .5003270373238773);
            int warm = circular ? Math.Min(n, Mix.Rate * 2) : 0;
            for (int i = n - warm; i < n; i++) b.Tick(a.Tick(x[i]));
            for (int i = 0; i < n; i++) { double y = b.Tick(a.Tick(x[i])); ms[i] += y * y; }
        }
        var z = new List<double>();
        int end = circular ? n : n - blk;
        for (int s = 0; s <= end; s += hop)
        {
            double e = 0; for (int i = 0; i < blk; i++) e += ms[(s + i) % n];
            z.Add(e / blk);
        }
        static double L(double v) => -.691 + 10 * Math.Log10(Math.Max(v, 1e-20));
        var g1 = z.Where(v => L(v) > -70).ToList(); if (g1.Count == 0) return -70;
        double rel = L(g1.Average()) - 10;
        var g2 = g1.Where(v => L(v) > rel).ToList();
        return L(g2.Average());
    }

    public static double Rms(float[] l, float[] r, int a, int b)
    {
        double e = 0; for (int i = a; i < b; i++) e += l[i] * (double)l[i] + r[i] * (double)r[i];
        return Math.Sqrt(e / (2.0 * Math.Max(1, b - a)));
    }

    public static double Peak(float[] l, float[] r) { double p = 0; for (int i = 0; i < l.Length; i++) p = Math.Max(p, Math.Max(Math.Abs(l[i]), Math.Abs(r[i]))); return p; }
}

// Look-ahead peak limiter (5 ms look-ahead, 150 ms release). circular: the gain curve wraps over the end (the loop).
public static class Limiter
{
    public static double Run(float[] l, float[] r, double ceilingDb, bool circular)
    {
        int n = l.Length, la = (int)(.005 * Mix.Rate); float ceil = (float)Mix.Db(ceilingDb);
        var need = new float[n];
        for (int i = 0; i < n; i++) { float p = Math.Max(Math.Abs(l[i]), Math.Abs(r[i])); need[i] = p > ceil ? ceil / p : 1; }
        // m[i] = min(need[i .. i+la])
        var m = new float[n]; var dq = new LinkedList<int>();
        int total = circular ? n + la : n;
        for (int k = total - 1; k >= -0; k--)
        {
            int i = k % n; float v = k < n || circular ? need[i] : 1;
            while (dq.Count > 0 && need[dq.Last.Value % n] >= v) dq.RemoveLast();
            dq.AddLast(k);
            while (dq.First.Value > k + la) dq.RemoveFirst();
            if (k < n) m[k] = need[dq.First.Value % n];
        }
        double rel = 1 - Math.Exp(-1 / (.15 * Mix.Rate));
        var rr = new float[n]; double g = 1;
        for (int pass = 0; pass < (circular ? 2 : 1); pass++)
            for (int i = 0; i < n; i++) { g = Math.Min(m[i], g + (1 - g) * rel); rr[i] = (float)g; }
        double sum = 0, minG = 1; var win = new Queue<float>();
        for (int k = circular ? n - la : 0; k < n; k++) { win.Enqueue(rr[k]); sum += rr[k]; }   // pre-fill (circular) so g[i] = mean(rr[i-la+1..i])
        if (!circular) { win.Clear(); sum = 0; for (int k = 0; k < la; k++) { win.Enqueue(1f); sum += 1; } }
        var gain = new float[n];
        for (int i = 0; i < n; i++)
        {
            win.Enqueue(rr[i]); sum += rr[i]; sum -= win.Dequeue();
            gain[i] = (float)(sum / la); minG = Math.Min(minG, gain[i]);
        }
        for (int i = 0; i < n; i++) { l[i] *= gain[i]; r[i] *= gain[i]; }
        return Mix.ToDb(minG);
    }
}

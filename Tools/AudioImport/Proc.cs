using PixelVocabFlight;

// Small offline editing tools for the recipe: cutting, EQ (RBJ filters), fades, level, loops, pitch, mixing. All on float arrays at 44.1 kHz.
static class Proc
{
    const int Rate = CinemaDsp.Rate;

    public enum Kind { Low, High, LowShelf, HighShelf, Peak }

    // RBJ cookbook biquad (the game's Biquad has no shelves).
    sealed class Bq
    {
        double b0, b1, b2, a1, a2, x1, x2, y1, y2;
        public Bq(Kind k, double f, double gainDb = 0, double q = .7071)
        {
            double w = 2 * Math.PI * Math.Min(f, Rate * .45) / Rate, cs = Math.Cos(w), sn = Math.Sin(w), al = sn / (2 * q), A = Math.Pow(10, gainDb / 40), a0;
            switch (k)
            {
                case Kind.Low: b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
                case Kind.High: b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
                case Kind.Peak: b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break;
                default:
                {
                    double s2 = 2 * Math.Sqrt(A) * al;
                    if (k == Kind.LowShelf)
                    {
                        b0 = A * ((A + 1) - (A - 1) * cs + s2); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s2);
                        a0 = (A + 1) + (A - 1) * cs + s2; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s2;
                    }
                    else
                    {
                        b0 = A * ((A + 1) + (A - 1) * cs + s2); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s2);
                        a0 = (A + 1) - (A - 1) * cs + s2; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s2;
                    }
                    break;
                }
            }
            b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
        }
        public float Tick(float x) { double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return (float)y; }
    }

    // In-place filter; 'passes' runs it several times (a steeper slope).
    public static float[] Eq(float[] x, Kind k, double f, double gainDb = 0, double q = .7071, int passes = 1)
    {
        for (int p = 0; p < passes; p++) { var b = new Bq(k, f, gainDb, q); for (int i = 0; i < x.Length; i++) x[i] = b.Tick(x[i]); }
        return x;
    }

    public static float[] Cut(float[] x, double a, double b)
    {
        int i0 = Math.Max(0, (int)Math.Round(a * Rate)), i1 = Math.Min(x.Length, (int)Math.Round(b * Rate));
        var y = new float[Math.Max(0, i1 - i0)]; Array.Copy(x, i0, y, 0, y.Length);
        return y;
    }

    public static float[] Copy(float[] x) => (float[])x.Clone();

    public static float[] Fade(float[] x, double inMs, double outMs)
    {
        int a = (int)(inMs * Rate / 1000), z = (int)(outMs * Rate / 1000);
        for (int i = 0; i < a && i < x.Length; i++) x[i] *= (float)(.5 - .5 * Math.Cos(Math.PI * i / a));
        for (int i = 0; i < z && i < x.Length; i++) x[x.Length - 1 - i] *= (float)(.5 - .5 * Math.Cos(Math.PI * i / z));
        return x;
    }

    public static float Peak(float[] x) { float p = 0; foreach (float v in x) p = Math.Max(p, Math.Abs(v)); return p; }
    public static double Rms(float[] x) { double s = 0; foreach (float v in x) s += (double)v * v; return Math.Sqrt(s / Math.Max(1, x.Length)); }
    public static float[] Gain(float[] x, double db) { float g = (float)CinemaDsp.Db(db); for (int i = 0; i < x.Length; i++) x[i] *= g; return x; }
    public static float[] NormPeak(float[] x, double db) { float p = Peak(x); if (p > 1e-9f) Gain(x, db - 20 * Math.Log10(p)); return x; }
    public static float[] NormRms(float[] x, double db) { double r = Rms(x); if (r > 1e-9) Gain(x, db - 20 * Math.Log10(r)); return x; }

    public static float[] Reverse(float[] x) { var y = (float[])x.Clone(); Array.Reverse(y); return y; }

    // y += x * gain at sample 'at' (grows nothing: clipped to y).
    public static void MixInto(float[] y, int at, float[] x, double db = 0)
    {
        float g = (float)CinemaDsp.Db(db);
        for (int i = Math.Max(0, -at); i < x.Length && at + i < y.Length; i++) y[at + i] += x[i] * g;
    }

    public static float[] Mix(params (float[] x, double db)[] parts)
    {
        int n = parts.Max(p => p.x.Length); var y = new float[n];
        foreach (var p in parts) MixInto(y, 0, p.x, p.db);
        return y;
    }

    // Plays x at 'ratio' speed (pitch and length change), cubic interpolation.
    public static float[] Pitch(float[] x, double ratio)
    {
        int n = (int)(x.Length / ratio); var y = new float[n];
        for (int i = 0; i < n; i++)
        {
            double p = i * ratio; int k = (int)p; float f = (float)(p - k);
            float y0 = k > 0 ? x[k - 1] : x[0], y1 = x[k], y2 = k + 1 < x.Length ? x[k + 1] : 0, y3 = k + 2 < x.Length ? x[k + 2] : 0;
            float c1 = .5f * (y2 - y0), c2 = y0 - 2.5f * y1 + 2 * y2 - .5f * y3, c3 = .5f * (y3 - y0) + 1.5f * (y1 - y2);
            y[i] = ((c3 * f + c2) * f + c1) * f + y1;
        }
        return y;
    }

    // Seamless loop of 'len' seconds starting at 'start': looks for the length (within +-'search' s) at which the start of the loop and the
    // piece that would follow its end are most alike, then cross-fades the two over 'xf' seconds. Several channels share the length.
    // Returns the loops and the correlation found (1 = identical).
    public static float[][] Loop(float[][] src, double start, double len, double xf, double search, out double corr, out double used)
    {
        int s0 = (int)(start * Rate), n0 = (int)(len * Rate), X = (int)(xf * Rate), S = (int)(search * Rate);
        int need = s0 + n0 + S + X + 1;
        foreach (var c in src) if (c.Length < need) throw new InvalidOperationException("nguồn quá ngắn cho vòng lặp " + start + "+" + len);
        var mono = new float[need]; foreach (var c in src) for (int i = 0; i < need; i++) mono[i] += c[i] / src.Length;
        int bestL = n0; double best = -2;
        for (int d = -S; d <= S; d += 4)
        {
            int L = n0 + d; double ab = 0, aa = 1e-12, bb = 1e-12;
            for (int i = 0; i < X; i += 2) { double a = mono[s0 + i], b = mono[s0 + L + i]; ab += a * b; aa += a * a; bb += b * b; }
            double r = ab / Math.Sqrt(aa * bb);
            if (r > best) { best = r; bestL = L; }
        }
        corr = best; used = bestL / (double)Rate;
        var res = new float[src.Length][];
        for (int c = 0; c < src.Length; c++)
        {
            var o = new float[bestL];
            for (int i = 0; i < bestL; i++)
            {
                if (i < X)
                {
                    double u = (double)i / X, g1, g2;
                    if (best > .5) { g1 = u; g2 = 1 - u; } else { g1 = Math.Sin(u * Math.PI / 2); g2 = Math.Cos(u * Math.PI / 2); }
                    o[i] = (float)(src[c][s0 + i] * g1 + src[c][s0 + bestL + i] * g2);
                }
                else o[i] = src[c][s0 + i];
            }
            res[c] = o;
        }
        return res;
    }

    // Splits x at 'starts' into slices that end at the next start (or after 'maxLen' s), with a 1.5 ms fade-in and a fade-out of 'outMs'.
    public static List<float[]> SliceAt(float[] x, IList<int> starts, double maxLen, double outMs, double preMs = 2, int lastExtend = 0)
    {
        var res = new List<float[]>();
        for (int k = 0; k < starts.Count; k++)
        {
            int a = Math.Max(0, starts[k] - (int)(preMs * Rate / 1000)), z = k + 1 < starts.Count ? starts[k + 1] - (int)(preMs * Rate / 1000) : Math.Min(x.Length, a + (int)(maxLen * Rate));
            if (k + 1 == starts.Count && lastExtend > 0) z = Math.Min(x.Length, a + lastExtend);
            z = Math.Min(z, a + (int)(maxLen * Rate)); z = Math.Min(z, x.Length);
            if (z - a < Rate / 100) continue;
            var s = new float[z - a]; Array.Copy(x, a, s, 0, s.Length);
            res.Add(Fade(s, 1.5, outMs));
        }
        return res;
    }

    // Ear-friendly index of the loudest 20 ms of x (sample number).
    public static int LoudestAt(float[] x, double window = .02)
    {
        int w = (int)(window * Rate), best = 0; double max = -1;
        for (int i = 0; i + w <= x.Length; i += w / 4) { double e = 0; for (int j = 0; j < w; j++) e += (double)x[i + j] * x[i + j]; if (e > max) { max = e; best = i + w / 2; } }
        return best;
    }
}

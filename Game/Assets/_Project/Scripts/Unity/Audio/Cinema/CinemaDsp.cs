using System;

namespace PixelVocabFlight
{
    // Pure C# (no UnityEngine): the building blocks of the intro soundtrack, shared with Tools/AudioChecks. 44.1 kHz.
    public enum Filt { Low, High, Band }

    // Seeded random numbers (every sound is deterministic).
    public sealed class Rng
    {
        private readonly Random random;
        public Rng(int seed) { random = new Random(seed); }
        public double U() => random.NextDouble();
        public float White() => (float)(random.NextDouble() * 2 - 1);
        public double Range(double a, double b) => a + (b - a) * random.NextDouble();
        public int Int(int a, int b) => random.Next(a, b + 1);
        public double Sign() => random.Next(2) == 0 ? -1 : 1;
    }

    // RBJ biquad; Tune() keeps the state so a filter can sweep.
    public sealed class Biquad
    {
        private double b0, b1, b2, a1, a2, x1, x2, y1, y2;
        public Biquad(Filt kind, double f, double q = 0.7071) { Tune(kind, f, q); }

        public void Tune(Filt kind, double f, double q = 0.7071)
        {
            double fc = Math.Max(1, Math.Min(f, CinemaDsp.Rate * 0.45));
            double w = 2 * Math.PI * fc / CinemaDsp.Rate, cs = Math.Cos(w), al = Math.Sin(w) / (2 * q), a0 = 1 + al;
            switch (kind)
            {
                case Filt.Low: b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; break;
                case Filt.High: b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; break;
                default: b0 = al; b1 = 0; b2 = -al; break;
            }
            b0 /= a0; b1 /= a0; b2 /= a0; a1 = -2 * cs / a0; a2 = (1 - al) / a0;
        }

        public float Tick(float x)
        {
            double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x; y2 = y1; y1 = y;
            return (float)y;
        }

        public void Reset() { x1 = x2 = y1 = y2 = 0; }
    }

    // Two channels; mono sounds are copied into both so the channels can be changed independently.
    public sealed class Stereo
    {
        public readonly float[] L, R;
        public Stereo(int n) { L = new float[n]; R = new float[n]; }
        public int Length => L.Length;
        public static Stereo FromMono(float[] m) { var s = new Stereo(m.Length); Array.Copy(m, s.L, m.Length); Array.Copy(m, s.R, m.Length); return s; }

        public float Peak()
        {
            float p = 0;
            for (int i = 0; i < L.Length; i++) { p = Math.Max(p, Math.Abs(L[i])); p = Math.Max(p, Math.Abs(R[i])); }
            return p;
        }

        public void Scale(double g) { float f = (float)g; for (int i = 0; i < L.Length; i++) { L[i] *= f; R[i] *= f; } }

        public void Normalize(double peakDb)
        {
            float p = Peak();
            if (p > 1e-9f) Scale(CinemaDsp.Db(peakDb) / p);
        }

        // Adds a mono layer to both channels, or panned (p = -1..1; the part below 120 Hz stays in the middle).
        public void AddMono(int at, float[] m, double gain, double pan = 0)
        {
            if (Math.Abs(pan) < .02) { CinemaDsp.Add(L, at, m, gain); CinemaDsp.Add(R, at, m, gain); return; }
            CinemaDsp.Balance(pan, out double gl, out double gr);
            var low = new float[m.Length]; var lp = new Biquad(Filt.Low, 120);
            for (int i = 0; i < m.Length; i++) low[i] = lp.Tick(m[i]);
            var high = new float[m.Length];
            for (int i = 0; i < m.Length; i++) high[i] = m[i] - low[i];
            CinemaDsp.Add(L, at, low, gain); CinemaDsp.Add(R, at, low, gain);
            CinemaDsp.Add(L, at, high, gain * gl); CinemaDsp.Add(R, at, high, gain * gr);
        }

        // Adds another stereo sound with a balance (pan -1..1).
        public void AddStereo(int at, Stereo s, double gain, double pan = 0)
        {
            CinemaDsp.Balance(pan, out double gl, out double gr);
            CinemaDsp.Add(L, at, s.L, gain * gl); CinemaDsp.Add(R, at, s.R, gain * gr);
        }
    }

    public static class CinemaDsp
    {
        public const int Rate = 44100;
        private static readonly float[] SinTab = MakeSin();

        private static float[] MakeSin()
        {
            var t = new float[4098];
            for (int i = 0; i < t.Length; i++) t[i] = (float)Math.Sin(2 * Math.PI * i / 4096.0);
            return t;
        }

        public static int N(double seconds) => (int)Math.Round(seconds * Rate);
        public static double Db(double db) => Math.Pow(10, db / 20);
        public static double ToDb(double lin) => 20 * Math.Log10(Math.Max(lin, 1e-12));

        // Sine of a phase given in cycles.
        public static float Sin(double cycles)
        {
            double x = cycles - Math.Floor(cycles), p = x * 4096;
            int i = (int)p; float f = (float)(p - i), a = SinTab[i];
            return a + (SinTab[i + 1] - a) * f;
        }

        // Constant-power-ish pan law for p in -1..1: centre gives 1/1, the far side stays at 1 and the near side falls.
        public static void Balance(double p, out double left, out double right)
        {
            double a = (Math.Max(-1, Math.Min(1, p)) + 1) * Math.PI / 4;
            left = Math.Min(1, Math.Sqrt(2) * Math.Cos(a)); right = Math.Min(1, Math.Sqrt(2) * Math.Sin(a));
        }

        // The recording played at 'ratio' times the speed (pitch and length change), cubic interpolation; the end is faded out over 2 ms.
        public static float[] Resample(float[] x, double ratio)
        {
            int n = Math.Max(1, (int)(x.Length / ratio)); var y = new float[n];
            for (int i = 0; i < n; i++)
            {
                double p = i * ratio; int k = (int)p; float f = (float)(p - k);
                float y0 = k > 0 ? x[k - 1] : x[0], y1 = x[Math.Min(k, x.Length - 1)], y2 = k + 1 < x.Length ? x[k + 1] : 0, y3 = k + 2 < x.Length ? x[k + 2] : 0;
                float c1 = .5f * (y2 - y0), c2 = y0 - 2.5f * y1 + 2 * y2 - .5f * y3, c3 = .5f * (y3 - y0) + 1.5f * (y1 - y2);
                y[i] = ((c3 * f + c2) * f + c1) * f + y1;
            }
            FadeTail(y);
            return y;
        }

        // Steeper filters: 'passes' second-order sections one after another, in place.
        public static float[] Filter(float[] x, Filt kind, double hz, int passes = 2, double q = 0.7071)
        {
            for (int p = 0; p < passes; p++) { var f = new Biquad(kind, hz, q); for (int i = 0; i < x.Length; i++) x[i] = f.Tick(x[i]); }
            return x;
        }

        // Linear fade-in over 'seconds' (softens the front of a far-away sound), in place.
        public static float[] FadeIn(float[] x, double seconds)
        {
            int n = Math.Min(x.Length, N(seconds));
            for (int i = 0; i < n; i++) x[i] *= (float)i / n;
            return x;
        }

        // Cosine fade-out over the last 'seconds', in place.
        public static float[] FadeOut(float[] x, double seconds)
        {
            int n = Math.Min(x.Length, N(seconds));
            for (int i = 0; i < n; i++) x[x.Length - 1 - i] *= (float)(.5 - .5 * Math.Cos(Math.PI * i / n));
            return x;
        }

        public static float Peak(float[] b) { float p = 0; for (int i = 0; i < b.Length; i++) p = Math.Max(p, Math.Abs(b[i])); return p; }

        public static double Rms(float[] b, int from, int count)
        {
            from = Math.Max(0, from); int end = Math.Min(b.Length, from + count);
            if (end <= from) return 0;
            double s = 0; for (int i = from; i < end; i++) s += (double)b[i] * b[i];
            return Math.Sqrt(s / (end - from));
        }

        public static void Normalize(float[] b, double peakDb)
        {
            float p = Peak(b);
            if (p < 1e-9f) return;
            float g = (float)(Db(peakDb) / p);
            for (int i = 0; i < b.Length; i++) b[i] *= g;
        }

        public static void NormalizeRms(float[] b, double rmsDb)
        {
            double r = Rms(b, 0, b.Length);
            if (r < 1e-9) return;
            float g = (float)(Db(rmsDb) / r);
            for (int i = 0; i < b.Length; i++) b[i] *= g;
        }

        public static void Add(float[] dst, int at, float[] src, double gain)
        {
            float g = (float)gain;
            int from = Math.Max(0, -at), to = Math.Min(src.Length, dst.Length - at);
            for (int i = from; i < to; i++) dst[at + i] += src[i] * g;
        }

        // Knee clipper: linear up to the knee, then tanh towards the limit (never exceeds the limit).
        public static float SoftClip(float x, float knee, float limit)
        {
            float a = Math.Abs(x);
            if (a <= knee) return x;
            float y = knee + (limit - knee) * (float)Math.Tanh((a - knee) / (limit - knee));
            return x < 0 ? -y : y;
        }

        public static void SoftClip(float[] b, float knee, float limit) { for (int i = 0; i < b.Length; i++) b[i] = SoftClip(b[i], knee, limit); }

        public static float Sat(float x, double drive) => (float)(Math.Tanh(drive * x) / Math.Tanh(drive));

        // 2 ms cosine fade at the end so a cut layer never clicks.
        private static void FadeTail(float[] x)
        {
            int n = Math.Min(x.Length, N(.002));
            for (int i = 0; i < n; i++) x[x.Length - 1 - i] *= (float)(.5 - .5 * Math.Cos(Math.PI * i / n));
        }

        // ---- Layers (peak 1, returned) ----
        // A sine sweeping geometrically f0 -> f1 over 'sweep' seconds, attack then exp(-t/tau) (tau <= 0: flat).
        public static float[] SineLayer(double len, double f0, double f1, double sweep, double attack, double tau, double phase = 0)
        {
            int n = N(len); var x = new float[n];
            double ph = phase, f = f0, decay = tau > 0 ? Math.Exp(-1.0 / (tau * Rate)) : 1, env = 1;
            double ln = f0 > 0 && f1 > 0 ? Math.Log(f1 / f0) : 0;
            for (int i = 0; i < n; i++)
            {
                if ((i & 7) == 0 && sweep > 0) f = f0 * Math.Exp(ln * Math.Min(1, (double)i / Rate / sweep));
                ph += f / Rate;
                double a = attack > 0 ? Math.Min(1, (double)i / Rate / attack) : 1;
                x[i] = (float)(Sin(ph) * env * a); env *= decay;
            }
            FadeTail(x); Unit(x);
            return x;
        }

        // White (or leaky-integrated "brown") noise through a filter whose cutoff sweeps geometrically fc0 -> fc1.
        public static float[] NoiseLayer(Rng r, double len, Filt kind, double fc0, double q, double fc1, double sweep, double attack, double tau, bool brown = false)
        {
            int n = N(len); var x = new float[n];
            var filter = new Biquad(kind, fc0, q);
            double decay = tau > 0 ? Math.Exp(-1.0 / (tau * Rate)) : 1, env = 1, brownState = 0, ln = fc1 > 0 && fc0 > 0 ? Math.Log(fc1 / fc0) : 0;
            for (int i = 0; i < n; i++)
            {
                if ((i & 15) == 0 && sweep > 0) filter.Tune(kind, fc0 * Math.Exp(ln * Math.Min(1, (double)i / Rate / sweep)), q);
                double w = r.White();
                if (brown) { brownState = brownState * .997 + w * .0774; w = brownState * 7.2; }
                double a = attack > 0 ? Math.Min(1, (double)i / Rate / attack) : 1;
                x[i] = (float)(filter.Tick((float)w) * env * a); env *= decay;
            }
            FadeTail(x); Unit(x);
            return x;
        }

        private static void Unit(float[] x)
        {
            float p = Peak(x);
            if (p < 1e-12f) return;
            float g = 1 / p;
            for (int i = 0; i < x.Length; i++) x[i] *= g;
        }

        // Adds a unit layer at sample 'at' with the given peak (optionally saturated).
        public static void Commit(float[] dst, int at, float[] layer, double amp, double sat = 0)
        {
            int from = Math.Max(0, -at), to = Math.Min(layer.Length, dst.Length - at);
            double norm = sat > 0 ? Math.Tanh(sat) : 1;
            for (int i = from; i < to; i++)
            {
                double v = layer[i];
                if (sat > 0) v = Math.Tanh(sat * v) / norm;
                dst[at + i] += (float)(v * amp);
            }
        }

        public static void Sine(float[] dst, int at, double len, double f0, double f1, double sweep, double attack, double tau, double amp, double sat = 0)
            => Commit(dst, at, SineLayer(len, f0, f1, sweep, attack, tau), amp, sat);

        public static void Noise(float[] dst, int at, Rng r, double len, Filt kind, double fc0, double q, double fc1, double sweep, double attack, double tau, double amp, bool brown = false, double sat = 0)
            => Commit(dst, at, NoiseLayer(r, len, kind, fc0, q, fc1, sweep, attack, tau, brown), amp, sat);

        // A struck body: a damped sine ring ("RES(f, tau)"), lasting about five time constants.
        public static void Res(float[] dst, int at, double f, double tau, double amp, double phase = 0)
            => Commit(dst, at, SineLayer(tau * 5, f, f, 0, 0, tau, phase), amp);

        public static void Saturate(float[] x, double drive)
        {
            for (int i = 0; i < x.Length; i++) x[i] = Sat(x[i], drive);
        }

        // Non-recursive echoes: adds copies of the signal delayed by each tap, low-passed.
        public static void Taps(float[] x, double[] delaysMs, double gain, double lpHz)
        {
            var src = (float[])x.Clone();
            foreach (double ms in delaysMs)
            {
                int d = N(ms / 1000); var lp = new Biquad(Filt.Low, lpHz); float g = (float)gain;
                for (int i = d; i < x.Length; i++) x[i] += lp.Tick(src[i - d]) * g;
            }
        }

        // One recursive echo (feedback through a low-pass).
        public static void Echo(float[] x, double delayMs, double feedback, double lpHz)
        {
            int d = N(delayMs / 1000); var lp = new Biquad(Filt.Low, lpHz); float g = (float)feedback;
            for (int i = d; i < x.Length; i++) x[i] += lp.Tick(x[i - d]) * g;
        }

        // Feedback comb with a delay that slides from ms0 to ms1: rings at 1/delay (the tearing of metal).
        public static void Comb(float[] x, double ms0, double ms1, double feedback)
        {
            var y = new float[x.Length];
            for (int i = 0; i < x.Length; i++)
            {
                double d = (ms0 + (ms1 - ms0) * i / Math.Max(1, x.Length - 1)) / 1000 * Rate, pos = i - d;
                float past = 0;
                if (pos >= 0) { int k = (int)pos; float f = (float)(pos - k); past = y[k] + ((k + 1 < i ? y[k + 1] : y[k]) - y[k]) * f; }
                y[i] = x[i] + (float)feedback * past;
            }
            Array.Copy(y, x, x.Length);
        }

        // Runs a filter twice over a periodic buffer and keeps the second pass, so the loop seam stays clean.
        public static void PeriodicFilter(float[] x, Biquad f)
        {
            for (int i = 0; i < x.Length; i++) f.Tick(x[i]);
            for (int i = 0; i < x.Length; i++) x[i] = f.Tick(x[i]);
        }

        // Equal-power crossfade that turns a noisy segment of length n + xf into a seamless loop of length n.
        public static float[] LoopFromSegment(float[] seg, int n)
        {
            int xf = seg.Length - n; var o = new float[n];
            for (int i = 0; i < n; i++)
            {
                if (i < xf)
                {
                    double u = (double)i / xf;
                    o[i] = seg[i] * (float)Math.Sin(u * Math.PI / 2) + seg[n + i] * (float)Math.Cos(u * Math.PI / 2);
                }
                else o[i] = seg[i];
            }
            return o;
        }

        public static void RemoveMean(float[] x)
        {
            double m = 0; for (int i = 0; i < x.Length; i++) m += x[i];
            float f = (float)(m / x.Length);
            for (int i = 0; i < x.Length; i++) x[i] -= f;
        }

        // Cubic Hermite read of a looping buffer at a fractional position.
        public static float ReadLoop(float[] loop, double pos)
        {
            int n = loop.Length, i1 = (int)pos; float f = (float)(pos - i1);
            int i0 = i1 == 0 ? n - 1 : i1 - 1, i2 = i1 + 1 >= n ? i1 + 1 - n : i1 + 1, i3 = i2 + 1 >= n ? i2 + 1 - n : i2 + 1;
            float y0 = loop[i0], y1 = loop[i1], y2 = loop[i2], y3 = loop[i3];
            float c1 = .5f * (y2 - y0), c2 = y0 - 2.5f * y1 + 2 * y2 - .5f * y3, c3 = .5f * (y3 - y0) + 1.5f * (y1 - y2);
            return ((c3 * f + c2) * f + c1) * f + y1;
        }
    }
}

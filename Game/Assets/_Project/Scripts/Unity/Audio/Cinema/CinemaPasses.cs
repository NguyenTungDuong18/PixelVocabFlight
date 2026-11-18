using System;

namespace PixelVocabFlight
{
    // Fly-bys with a real Doppler shift: the engine loop is read at ratio c / (c - v * s / sqrt(s^2 + d^2)) (s = distance still to go to the
    // closest point), the level follows 1 / distance. The cue is the moment of closest approach, so the approach starts before it. A recording
    // of a real aeroplane passing (the bank's "flyby" and "heavy" kits), aligned on its loudest moment, rides on top for the rush of air and the
    // body that a looped engine cannot give.
    public static class CinemaPasses
    {
        private const double C = 343;

        private static double Ratio(double s, double v, double d) => C / (C - v * s / Math.Sqrt(s * s + d * d));

        // Length of a fighter pass in seconds (0.8 - 1.2) and where the closest point falls inside it.
        public static double WhooshTotal(int durFrames) => durFrames > 0 ? Math.Max(.8, Math.Min(1.2, durFrames / 30.0)) : 1.0;
        public static double WhooshClosest(int durFrames) => WhooshTotal(durFrames) * .6;
        public const double HeavyTotal = 1.8, HeavyClosest = .85;

        // Index of the loudest 30 ms of a recording.
        private static int Loudest(float[] x)
        {
            int w = CinemaDsp.N(.03), best = 0; double max = -1;
            for (int i = 0; i + w <= x.Length; i += w / 3)
            {
                double e = 0; for (int j = 0; j < w; j++) e += (double)x[i + j] * x[i + j];
                if (e > max) { max = e; best = i + w / 2; }
            }
            return best;
        }

        // Writes a recording into y so that its loudest moment falls on 'closest' (seconds); 'gain' scales it. Per-sample so the pan can follow.
        private static float[] Aligned(CinemaSample rec, double closest, int n, double gain)
        {
            var y = new float[n]; int off = CinemaDsp.N(closest) - Loudest(rec.L);
            for (int i = Math.Max(0, off); i < n && i - off < rec.Length; i++) y[i] = rec.L[i - off] * (float)gain;
            return y;
        }

        // (12) A fighter skimming past the lens (v = 120 m/s, d = 15 m: the pitch falls from x1.54 to x0.74). The pan sweeps from the
        // opposite side to the side in 'pan' (the side the plane flies off to). Peak -8 dBFS.
        public static Stereo Whoosh(CinemaBank bank, Rng r, Stereo engine, int pan, int durFrames)
        {
            double total = WhooshTotal(durFrames), tc = WhooshClosest(durFrames);
            int n = CinemaDsp.N(total + .25), len = engine.Length;
            var s = new Stereo(n);
            var kit = bank.All("flyby"); var rec = Aligned(CinemaBank.Pitched(kit[r.Int(0, kit.Length - 1)], 1 + r.Range(-.04, .04)), tc, n, .3);
            CinemaDsp.FadeOut(rec, .08);
            const double V = 120, D = 15;
            double pos = r.U() * len, side = pan >= 0 ? 1 : -1, extent = Math.Min(1, .5 + Math.Abs(pan) / 200.0) * .9;
            var air = new Biquad(Filt.Band, 3000, 1.2); var lp = new Biquad(Filt.Low, 18000);
            for (int i = 0; i < n; i++)
            {
                double t = (double)i / CinemaDsp.Rate, sm = V * (tc - t), dist = Math.Sqrt(sm * sm + D * D), ratio = Ratio(sm, V, D), g = D / dist;
                pos += ratio; while (pos >= len) pos -= len;
                if ((i & 15) == 0)
                {
                    air.Tune(Filt.Band, 1900 * ratio, 1.2);
                    lp.Tune(Filt.Low, t < tc ? 18000 : Math.Max(3000, 18000 * Math.Exp(-(t - tc) / .08)));
                }
                float eng = .5f * (CinemaDsp.ReadLoop(engine.L, pos) + CinemaDsp.ReadLoop(engine.R, pos));
                float y = lp.Tick((float)(eng * g + air.Tick(r.White()) * Math.Pow(g, .6) * .4) + rec[i]) * (float)Math.Min(1, t / .05);
                CinemaDsp.Balance(side * extent * Math.Tanh((t - tc) / .2), out double gl, out double gr);
                s.L[i] = y * (float)gl; s.R[i] = y * (float)gr;
            }
            s.Normalize(-8);
            return s;
        }

        // (13) A four-engine bomber passing just overhead (v = 90 m/s, d = 40 m: x1.35 down to x0.79), with a strong sub (30-80 Hz) that
        // stays in the middle, propeller wash, the recording of a real bomber passing, and the skin of the cockpit shaking (a 300 Hz ring). Peak -6 dBFS.
        public static Stereo HeavyPass(CinemaBank bank, Rng r, Stereo bomber, int pan)
        {
            int n = CinemaDsp.N(HeavyTotal + .2), len = bomber.Length;
            var s = new Stereo(n);
            const double V = 90, D = 40, Tc = HeavyClosest;
            var kit = bank.All("heavy"); var rec = Aligned(CinemaBank.Pitched(kit[r.Int(0, kit.Length - 1)], 1 + r.Range(-.03, .03)), Tc, n, .5);
            CinemaDsp.FadeOut(rec, .15);
            double pos = r.U() * len, ph55 = 0, ph32 = 0, side = pan >= 0 ? 1 : -1, extent = Math.Min(1, .3 + Math.Abs(pan) / 250.0) * .45;
            var wash = new Biquad(Filt.Band, 330, .7);
            for (int i = 0; i < n; i++)
            {
                double t = (double)i / CinemaDsp.Rate, sm = V * (Tc - t), dist = Math.Sqrt(sm * sm + D * D), ratio = Ratio(sm, V, D), g = D / dist;
                pos += ratio; while (pos >= len) pos -= len;
                if ((i & 15) == 0) wash.Tune(Filt.Band, 330 * ratio, .7);
                ph55 += 55 * ratio / CinemaDsp.Rate; ph32 += 32 * ratio / CinemaDsp.Rate;
                float centre = (float)((CinemaDsp.Sin(ph55) * .9 + CinemaDsp.Sin(ph32) * .6) * Math.Pow(g, .7) * .6 + CinemaDsp.Sin(120 * t) * .1 * Math.Pow(g, 3)) + rec[i];
                float noise = wash.Tick(r.White()) * (float)(Math.Pow(g, .5) * .6);
                CinemaDsp.Balance(side * extent * Math.Tanh((t - Tc) / .4), out double gl, out double gr);
                float fade = (float)Math.Min(1, t / .06) * (float)Math.Min(1, (n - i) / (double)CinemaDsp.N(.15));
                s.L[i] = (CinemaDsp.ReadLoop(bomber.L, pos) * (float)g + noise) * (float)gl * fade + centre * fade;
                s.R[i] = (CinemaDsp.ReadLoop(bomber.R, pos) * (float)g + noise) * (float)gr * fade + centre * fade;
            }
            var ring = new float[CinemaDsp.N(.8)];
            CinemaDsp.Res(ring, 0, 300, .15, .12);
            CinemaDsp.Add(s.L, CinemaDsp.N(Tc), ring, 1); CinemaDsp.Add(s.R, CinemaDsp.N(Tc), ring, 1);
            s.Normalize(-6);
            return s;
        }
    }
}

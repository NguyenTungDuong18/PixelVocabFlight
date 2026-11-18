using System;

namespace PixelVocabFlight
{
    // Explosions of the intro from recordings of real blasts, layered the way a blast is built: crack and punch (the recording), a sub below
    // 120 Hz (a sine sweeping down; the old sound tracks the recordings come from had no bass), body, tail (the recording's decay), debris.
    // Far flak is a soft "thup" (low-passed, its front softened, an echo behind it), near flak a crack with shrapnel ticking on the skin, the
    // burning engine a medium blast with a sub, the fuel tank or wing a huge stereo blast with a long sub below 45 Hz. Also the roaring flight
    // through the fireball, the far bomb rumble and the logo hit. Peaks follow the sheet: far flak -14 dBFS, near flak -6, engine fire -8,
    // big blast -1 (after soft clipping).
    public static class CinemaBlasts
    {
        // A random slice of a mono kit at a pitch within +-'spread' of 1, into a new array of at least 'length' samples.
        private static float[] Piece(CinemaBank bank, string kit, Rng r, double spread, int length, out int index, int not = -1)
        {
            var all = bank.All(kit); index = r.Int(0, all.Length - 1); if (index == not && all.Length > 1) index = (index + 1) % all.Length;
            var s = all[index]; double ratio = 1 + r.Range(-spread, spread);
            var x = Math.Abs(ratio - 1) < 1e-4 ? (float[])s.L.Clone() : CinemaDsp.Resample(s.L, ratio);
            if (x.Length >= length) return x;
            var y = new float[length]; Array.Copy(x, y, x.Length);
            return y;
        }

        // (7) Flak far away: a distant burst, nothing sharp in front.
        public static float[] FlakFar(CinemaBank bank, Rng r)
        {
            var b = Piece(bank, "flak", r, .06, CinemaDsp.N(1.3), out _);
            CinemaDsp.Filter(b, Filt.High, 110, 2); CinemaDsp.Filter(b, Filt.Low, 1100, 2); CinemaDsp.FadeIn(b, .006);   // far away: the sub is gone, the thump is mid
            CinemaDsp.Sine(b, 0, .5, 140, 80, .15, 0, .1, .15 * CinemaDsp.Peak(b));
            CinemaDsp.Echo(b, 90, .3, 800);
            CinemaDsp.FadeOut(b, .3);
            CinemaDsp.Normalize(b, -14);
            return b;
        }

        // (8) Flak bursting close: a recorded blast with its crack, a thump under it, and 12-30 shrapnel ticks on the skin (80-500 ms,
        // thinning out) around the head.
        public static Stereo FlakNear(CinemaBank bank, Rng r)
        {
            int n = CinemaDsp.N(1.3);
            var m = Piece(bank, "flaknear", r, .05, n, out _);
            CinemaDsp.FadeOut(m, .3);
            CinemaDsp.Sine(m, 0, .3, 160, 70, .09, 0, .07, .35 * CinemaDsp.Peak(m), 1.5);
            var s = Stereo.FromMono(m);
            var ticks = bank.All("hit_a"); var rings = bank.All("hit_b");
            int count = r.Int(12, 30);
            for (int k = 0; k < count; k++)
            {
                double t = .08 + .42 * Math.Pow(r.U(), 1.8), pan = r.Range(-.9, .9);
                var tick = new float[CinemaDsp.N(.3)];
                var src = k % 7 == 3 ? ticks[r.Int(0, ticks.Length - 1)] : rings[r.Int(0, rings.Length - 1)];
                CinemaDsp.Add(tick, 0, CinemaDsp.Resample(src.L, r.Range(1.1, 1.7)), r.Range(.15, .4) * (k % 7 == 3 ? 1.5 : 1));
                s.AddMono(CinemaDsp.N(t), tick, 1, pan);
            }
            s.Normalize(-6);
            return s;
        }

        // (9) An engine catching fire: a recorded medium blast, a sinking thump under it.
        public static float[] Boom(CinemaBank bank, Rng r)
        {
            var b = Piece(bank, "boom", r, .06, CinemaDsp.N(1.6), out _);
            CinemaDsp.FadeOut(b, .4);
            CinemaDsp.Sine(b, 0, .7, 90, 50, .1, 0, .09, .5 * CinemaDsp.Peak(b));
            CinemaDsp.Normalize(b, -8);
            return b;
        }

        // (10) A big blast right beside us (fuel tank, a wing torn off), about 5 s. Two recorded huge blasts one on the other, a long sub
        // (45 -> 28 Hz, saturated so small speakers hear its harmonics) and metal falling in the debris; soft-clipped so the body is dense.
        public static Stereo BigBoom(CinemaBank bank, Rng r)
        {
            int n = CinemaDsp.N(5.6); var s = new Stereo(n);
            var all = bank.All("bigboom"); int a = r.Int(0, all.Length - 1), b = (a + 1 + r.Int(0, all.Length - 2)) % all.Length;
            double ra = 1 + r.Range(-.03, .03), rb = 1 + r.Range(-.04, .04);
            var sa = BankPitch(all[a], ra); var sb = BankPitch(all[b], rb);
            CinemaDsp.Add(s.L, 0, sa.L, 1); CinemaDsp.Add(s.R, 0, sa.R, 1);
            CinemaDsp.Add(s.L, CinemaDsp.N(.012), sb.L, .6); CinemaDsp.Add(s.R, CinemaDsp.N(.012), sb.R, .6);
            var sub = new float[n];
            CinemaDsp.Sine(sub, 0, 2.4, 45, 28, .5, .008, .6, .5, 2.5);
            CinemaDsp.Sine(sub, 0, .7, 120, 55, .12, 0, .14, .5);
            CinemaDsp.Add(s.L, 0, sub, 1); CinemaDsp.Add(s.R, 0, sub, 1);
            var rings = bank.All("hit_b"); int pieces = r.Int(14, 24);
            for (int k = 0; k < pieces; k++)
            {
                double t = r.Range(.2, 2.2), pan = r.Range(-.9, .9);
                var grain = new float[CinemaDsp.N(.4)];
                CinemaDsp.Add(grain, 0, CinemaDsp.Resample(rings[r.Int(0, rings.Length - 1)].L, r.Range(.7, 1.4)), r.Range(.08, .22));
                s.AddMono(CinemaDsp.N(t), grain, 1, pan);
            }
            s.Normalize(3.5);
            CinemaDsp.SoftClip(s.L, .5f, 1f); CinemaDsp.SoftClip(s.R, .5f, 1f);
            s.Normalize(-1);
            return s;
        }

        private static CinemaSample BankPitch(CinemaSample s, double ratio) => CinemaBank.Pitched(s, ratio);

        // (11, second part) Flying through the fireball: the roar swells 0.3 -> 0.8 -> 0.2 with a 15-30 Hz flutter, then the ringing in the ears
        // (a recording, already dying away) fades over 1.8 s. The muffling of the other sounds is done by the mix.
        public static Stereo Fireball(CinemaBank bank, Rng r, int durFrames)
        {
            double d = durFrames / 30.0; int n = CinemaDsp.N(d + 1.8);
            var s = new Stereo(n);
            var roar = bank["roar"]; int need = CinemaDsp.N(d + .15), room = Math.Max(1, roar.Length - need);
            int from = r.Int(0, room - 1);
            for (int ch = 0; ch < 2; ch++)
            {
                var src = ch == 0 ? roar.L : roar.R; var dst = ch == 0 ? s.L : s.R;
                double fl = r.Range(15, 30), ph = r.U();
                for (int i = 0; i < need && from + i < src.Length; i++)
                {
                    double t = (double)i / CinemaDsp.Rate, u = Math.Min(1, t / d);
                    double env = u < .4 ? .3 + .5 * (u / .4) : .8 - .6 * ((u - .4) / .6);
                    if (t > d) env *= Math.Max(0, 1 - (t - d) / .15);
                    if ((i & 1023) == 0) fl = Math.Max(15, Math.Min(30, fl + r.White() * 2));
                    ph += fl / CinemaDsp.Rate;
                    dst[i] = (float)(src[from + i] * env * (1 + .5 * CinemaDsp.Sin(ph)));
                }
            }
            s.Normalize(-7);
            var ring = bank["ring"].L; int at = CinemaDsp.N(d * .5), fade = CinemaDsp.N(.3);
            for (int i = 0; i < ring.Length && at + i < n; i++)
            {
                float v = ring[i] * .05f * Math.Min(1, (n - at - i) / (float)fade);
                s.L[at + i] += v; s.R[at + i] += v;
            }
            return s;
        }

        // (15) Bombs falling on a city far below: a low rumble (recordings of distant bombing, low-passed) with a sub and a few thumps,
        // nothing above 250 Hz. Peak -18 dBFS.
        public static float[] Rumble(CinemaBank bank, Rng r, int durFrames)
        {
            double d = durFrames / 30.0; var b = new float[CinemaDsp.N(d + .7)];
            int last = -1; double at = 0; int laid = 0;
            while (at < d && laid < 6)
            {
                var p = Piece(bank, "rumble", r, .1, 1, out last, last);
                CinemaDsp.Add(b, CinemaDsp.N(at), CinemaDsp.FadeOut(p, .25), laid == 0 ? 1 : .8);
                at += p.Length / (double)CinemaDsp.Rate * .55; laid++;
            }
            CinemaDsp.Filter(b, Filt.Low, 250, 2);
            double amp = CinemaDsp.Peak(b);
            CinemaDsp.Sine(b, 0, d + .5, 38, 38, 0, .1, 0, .25 * amp);
            for (double t = r.Range(.02, .1); t < d; t += r.Range(.18, .45))
                CinemaDsp.Sine(b, CinemaDsp.N(t), .6, 70, 38, .15, 0, .15, .3 * amp * r.Range(.6, 1));
            float fade = (float)CinemaDsp.N(.3);
            for (int i = 0; i < b.Length; i++) b[i] *= Math.Min(1, (b.Length - i) / fade);
            CinemaDsp.Normalize(b, -18);
            return b;
        }

        // The logo hit ("braam"): detuned saws on D1 and D2 plus a fifth, different detuning left and right, through a low-pass that closes,
        // a centre sub and an impact thud, saturated. About 3 s. Peak -2 dBFS.
        public static Stereo Title(Rng r)
        {
            int n = CinemaDsp.N(3.2); var s = new Stereo(n);
            double[] hz = { 36.71, 36.71, 36.71, 73.42, 73.42, 73.42, 55.0 }, amp = { .5, .4, .4, .35, .3, .3, .25 };
            double[][] detune = { new[] { 1.0, 1.007, .993, 1.0, 1.012, .988, 1.0 }, new[] { 1.0, .996, 1.011, 1.0, .991, 1.016, 1.0 } };
            for (int ch = 0; ch < 2; ch++)
            {
                var dst = ch == 0 ? s.L : s.R; var phase = new double[hz.Length]; double lp = 0;
                for (int i = 0; i < n; i++)
                {
                    double t = (double)i / CinemaDsp.Rate, saw = 0;
                    for (int h = 0; h < hz.Length; h++)
                    {
                        phase[h] += hz[h] * detune[ch][h] / CinemaDsp.Rate; if (phase[h] >= 1) phase[h] -= 1;
                        saw += (2 * phase[h] - 1) * amp[h];
                    }
                    lp += (saw - lp) * (.16 - .14 * Math.Min(1, t / 1.8));
                    dst[i] = (float)(lp * 1.6 * Math.Min(1, t / .012) * Math.Exp(-t * 1.2));
                }
            }
            var centre = new float[n];
            CinemaDsp.Sine(centre, 0, 3, 36.71, 36.71, 0, 0, .9, .8);
            CinemaDsp.Commit(centre, 0, CinemaDsp.NoiseLayer(r, .5, Filt.Low, 650, .7, 650, 0, 0, .055), .5);
            s.AddMono(0, centre, 1);
            for (int i = 0; i < n; i++)
            {
                double fade = Math.Min(1, (n - i) / (double)CinemaDsp.N(.3));
                s.L[i] = (float)(Math.Tanh(1.2 * s.L[i]) * fade); s.R[i] = (float)(Math.Tanh(1.2 * s.R[i]) * fade);
            }
            s.Normalize(-2);
            return s;
        }
    }
}

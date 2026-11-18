using System;

namespace PixelVocabFlight
{
    // Guns of the intro, built from recordings: our wing .50s (single Browning shots laid end to end at 13-16 a second, fast, hard and bright),
    // the enemy's cannon (slower, pitched down, heavy, with a sub under every round), the bombers' defensive guns far away, and bullets
    // striking metal. Every shot varies: another slice of the kit, pitch +-5 %, level +-12 %, time +-2 ms, so nothing repeats exactly.
    public static class CinemaGuns
    {
        // Adds a recorded slice (mono kits) into b at 'at', at 'pitch' times the speed and 'amp' times the level.
        private static void Put(float[] b, int at, CinemaSample s, double pitch, double amp)
        {
            var x = Math.Abs(pitch - 1) < 1e-4 ? s.L : CinemaDsp.Resample(s.L, pitch);
            CinemaDsp.Add(b, at, x, amp);
        }

        // One .50 shot (slice 0 .. n-2 of mg_a; the last slice is the decay) with the chest thump of the gun under it.
        private static int Shot(float[] b, int at, CinemaBank bank, Rng r, double pitch, double amp, int not, bool sub = true)
        {
            var kit = bank.All("mg_a"); int idx = r.Int(0, kit.Length - 2); if (idx == not) idx = (idx + 1) % (kit.Length - 1);
            Put(b, at, kit[idx], pitch, amp);
            if (sub) CinemaDsp.Sine(b, at, .2, 75 * pitch, 60 * pitch, .05, .002, .045, .07 * amp);
            return idx;
        }

        // A train of shots of one gun at 'rate' per second; the first shot starts at 'phase' seconds.
        private static void Train(float[] b, CinemaBank bank, Rng r, double rate, double phase, double seconds, double amp, double pitch, bool sub = true)
        {
            int last = -1;
            for (double t = phase; t < seconds; t += 1 / rate)
                last = Shot(b, Math.Max(0, CinemaDsp.N(t + r.Range(-.0015, .0015))), bank, r, pitch * (1 + r.Range(-.05, .05)), amp * (1 + r.Range(-.12, .12)), last, sub);
        }

        // The decay of the last shot (the last slice of mg_a), a little under the burst.
        private static void Tail(float[] b, CinemaBank bank, double at, double amp)
        {
            var kit = bank.All("mg_a"); CinemaDsp.Add(b, CinemaDsp.N(at), kit[kit.Length - 1].L, amp);
        }

        // One gun alone (14.5 shots a second), peak -10 dBFS: the reference of the rhythm.
        public static float[] WingGun(CinemaBank bank, Rng r, int durFrames)
        {
            double d = durFrames / 30.0; var b = new float[CinemaDsp.N(d + .75)];
            Train(b, bank, r, 14.5, 0, d, 1, 1);
            Tail(b, bank, d, .8);
            CinemaDsp.Normalize(b, -10);
            return b;
        }

        // (4) Our wing guns: three .50s slightly out of step (14.5, 13.3 and 15.6 a second) plus a stretch of a thick burst underneath.
        public static float[] WingGuns(CinemaBank bank, Rng r, int durFrames)
        {
            double d = durFrames / 30.0; var b = new float[CinemaDsp.N(d + .75)];
            Train(b, bank, r, 14.5, 0, d, 1, 1);
            Train(b, bank, r, 13.3, r.Range(.2, .7) / 13.3, d, .6, 1 + r.Range(-.03, .03), false);
            Train(b, bank, r, 15.6, r.Range(.2, .7) / 15.6, d, .5, 1 + r.Range(-.03, .03), false);
            var thick = bank.All("mg_b"); double laid = 0; int last = -1;
            while (laid < d)
            {
                int k = r.Int(0, thick.Length - 1); if (k == last) k = (k + 1) % thick.Length; last = k;
                var piece = thick[k]; int n = (int)Math.Min(piece.Length, (d - laid + .05) * CinemaDsp.Rate);
                var cut = new float[n]; Array.Copy(piece.L, cut, n); CinemaDsp.Add(b, CinemaDsp.N(laid), CinemaDsp.FadeOut(cut, .02), .4);
                laid += piece.Length / (double)CinemaDsp.Rate - .02;
            }
            Tail(b, bank, d, .8);
            CinemaDsp.Normalize(b, -10);
            return b;
        }

        // The enemy's cannon: one round of the kit pitched down, with a sub under it.
        private static void CannonShot(float[] b, int at, CinemaBank bank, Rng r, double pitch, double amp)
        {
            var kit = bank.All("cannon"); var s = kit[r.Int(0, kit.Length - 1)];
            Put(b, at, s, pitch * .9, amp);
            CinemaDsp.Sine(b, at, .3, 120 * pitch, 55 * pitch, .1, .002, .09, .45 * amp);
        }

        // (5) The enemy's cannon: 9.5 rounds a second, even, heavy, the level growing over the burst (the fighter is coming at us). Peak -9 dBFS.
        public static float[] Cannon(CinemaBank bank, Rng r, int durFrames, bool rampUp = true)
        {
            double d = durFrames / 30.0; var b = new float[CinemaDsp.N(d + 1.5)];
            double period = 1 / 9.5;
            for (double t = 0; t < d; t += period)
            {
                double ramp = rampUp ? .6 + .4 * Math.Min(1, t / d) : 1;
                CannonShot(b, Math.Max(0, CinemaDsp.N(t + r.Range(-.002, .002))), bank, r, 1 + r.Range(-.05, .05), ramp * (1 + r.Range(-.1, .1)));
            }
            CinemaDsp.Normalize(b, -9);
            return b;
        }

        // (6) The bombers' defensive guns, far away: .50 shots without the chest thump, band-limited (400 Hz - 2.5 kHz), with a 25 ms echo;
        // 8 voices of 12.5 shots a second out of step with each other, narrow pan. Peak -15 dBFS.
        public static Stereo FarGuns(CinemaBank bank, Rng r, int durFrames)
        {
            double d = durFrames / 30.0; int n = CinemaDsp.N(d + .7);
            var s = new Stereo(n);
            for (int v = 0; v < 8; v++)
            {
                var vb = new float[n];
                double pitch = 1 + r.Range(-.06, .06), pan = r.Range(-.35, .35), phase = r.U() / 12.5; int last = -1;
                for (double t = phase; t < d; t += 1 / 12.5)
                    last = Shot(vb, Math.Max(0, CinemaDsp.N(t + r.Range(-.002, .002))), bank, r, pitch * (1 + r.Range(-.03, .03)), 1 + r.Range(-.12, .12), last, false);
                var hp = new Biquad(Filt.High, 400); var hp2 = new Biquad(Filt.High, 400); var lp = new Biquad(Filt.Low, 2500);
                for (int i = 0; i < n; i++) vb[i] = lp.Tick(hp2.Tick(hp.Tick(vb[i])));
                CinemaDsp.Taps(vb, new[] { 25.0 }, .5, 4000);
                s.AddMono(0, vb, .35 * (.6 + .4 * r.U()), pan);
            }
            s.Normalize(-15);
            return s;
        }

        // (14) Bullets striking sheet metal: 3-6 hits in 0.2 s, each a recorded impact, often with a ring of the struck plate and a dull thunk. Peak -8 dBFS.
        public static float[] Hits(CinemaBank bank, Rng r)
        {
            var b = new float[CinemaDsp.N(.9)];
            var impacts = bank.All("hit_a"); var rings = bank.All("hit_b");
            int count = r.Int(3, 6), last = -1;
            for (int k = 0; k < count; k++)
            {
                int at = CinemaDsp.N(.2 * (k + r.Range(0, .8)) / count), idx = r.Int(0, impacts.Length - 1); if (idx == last) idx = (idx + 1) % impacts.Length; last = idx;
                double amp = r.Range(.6, 1);
                Put(b, at, impacts[idx], r.Range(.9, 1.15), amp);
                if (r.U() < .6) Put(b, at, rings[r.Int(0, rings.Length - 1)], r.Range(.9, 1.2), amp * .3);
                CinemaDsp.Sine(b, at, .15, 180, 180, 0, 0, .025, .3 * amp);
            }
            CinemaDsp.Normalize(b, -8);
            return b;
        }
    }
}

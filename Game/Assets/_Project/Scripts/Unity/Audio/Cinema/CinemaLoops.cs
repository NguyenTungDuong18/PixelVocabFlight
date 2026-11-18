using System;

namespace PixelVocabFlight
{
    // Seamless stereo loops of the intro, taken from the bank's recordings (44.1 kHz): our fighter's Merlin engine, the bomber stream's hum,
    // high-altitude wind, burning fuel. The loops are made to repeat without a click when the bank is built (Tools/AudioImport); here they are
    // only set to a common level, and the cockpit and "pushed hard" versions of the engine and the whistle of the wind are derived by filtering.
    public static class CinemaLoops
    {
        private static void NormRms(Stereo s, double db)
        {
            double r = Math.Sqrt((CinemaDsp.Rms(s.L, 0, s.Length) * CinemaDsp.Rms(s.L, 0, s.Length) + CinemaDsp.Rms(s.R, 0, s.Length) * CinemaDsp.Rms(s.R, 0, s.Length)) / 2);
            if (r > 1e-9) s.Scale(CinemaDsp.Db(db) / r);
        }

        private static Stereo Loop(CinemaBank bank, string name, double db)
        {
            var s = bank[name].ToStereo();
            NormRms(s, db);
            return s;
        }

        // (1) Our fighter's engine: a Merlin with the propeller's blade slap (about 4.1 s).
        public static Stereo EngineV12(CinemaBank bank) => Loop(bank, "engine", -22);

        // The engine heard from inside the cockpit: darker, more low end (same loop length, so it can share a read position).
        public static Stereo EngineCabin(Stereo bright)
        {
            var s = new Stereo(bright.Length);
            for (int ch = 0; ch < 2; ch++)
            {
                var src = ch == 0 ? bright.L : bright.R; var dst = ch == 0 ? s.L : s.R;
                var a = (float[])src.Clone(); var b = (float[])src.Clone();
                CinemaDsp.PeriodicFilter(a, new Biquad(Filt.Low, 1100)); CinemaDsp.PeriodicFilter(a, new Biquad(Filt.Low, 1100));
                CinemaDsp.PeriodicFilter(b, new Biquad(Filt.Low, 190)); CinemaDsp.PeriodicFilter(b, new Biquad(Filt.Low, 190));
                for (int i = 0; i < dst.Length; i++) dst[i] = a[i] + b[i] * 1.6f;
            }
            NormRms(s, -22);
            return s;
        }

        // The engine pushed hard (scene 6): saturated, then softened.
        public static Stereo EngineGrit(Stereo bright)
        {
            var s = new Stereo(bright.Length);
            for (int ch = 0; ch < 2; ch++)
            {
                var src = ch == 0 ? bright.L : bright.R; var dst = ch == 0 ? s.L : s.R;
                float p = CinemaDsp.Peak(src);
                for (int i = 0; i < dst.Length; i++) dst[i] = CinemaDsp.Sat(src[i] / p * 1.2f, 4);
                CinemaDsp.PeriodicFilter(dst, new Biquad(Filt.Low, 3200));
            }
            NormRms(s, -22);
            return s;
        }

        // (2) Hum of a bomber stream (8 s).
        public static Stereo BomberHum(CinemaBank bank) => Loop(bank, "bomber", -20);

        // (3) High-altitude wind (10 s, high-passed, no rumble) and its whistle: the same wind through a narrow band around 2.3 kHz.
        public sealed class WindSet { public Stereo Wind, Whistle; }

        public static WindSet Wind(CinemaBank bank)
        {
            var set = new WindSet { Wind = Loop(bank, "wind", -26), Whistle = new Stereo(bank["wind"].Length) };
            for (int ch = 0; ch < 2; ch++)
            {
                var src = ch == 0 ? set.Wind.L : set.Wind.R; var dst = ch == 0 ? set.Whistle.L : set.Whistle.R;
                Array.Copy(src, dst, src.Length);
                var f1 = new Biquad(Filt.Band, 2300, 5); var f2 = new Biquad(Filt.Band, 2300, 5);
                CinemaDsp.PeriodicFilter(dst, f1); CinemaDsp.PeriodicFilter(dst, f2);
            }
            NormRms(set.Whistle, -26);
            return set;
        }

        // Menu bed: 18 s of wind that is not a loop (pieces are cut out of it), at the level of the wind loop.
        public static Stereo WindLong(CinemaBank bank) => Loop(bank, "windlong", -26);

        // Menu bed: the bomber stream very far away: the hum below 220 Hz (a loop), at the level of the wind loop.
        public static Stereo FarHum(CinemaBank bank)
        {
            var s = BomberHum(bank);
            foreach (var x in new[] { s.L, s.R }) { CinemaDsp.PeriodicFilter(x, new Biquad(Filt.Low, 220)); CinemaDsp.PeriodicFilter(x, new Biquad(Filt.Low, 220)); }
            NormRms(s, -26);
            return s;
        }

        // (16) Burning fuel: the roar of a big fire with the crackle of burning wood and metal (6 s).
        public static Stereo Fire(CinemaBank bank) => Loop(bank, "fire", -20);
    }
}

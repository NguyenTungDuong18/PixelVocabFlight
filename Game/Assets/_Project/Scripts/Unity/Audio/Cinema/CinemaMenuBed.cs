using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // The sound behind the main menu. It never repeats: nothing here is a loop that is heard as one.
    //   wind    two voices cross-fade (equal power, 1.5-2.5 s); each plays a random 6-12 s piece of a recording (the 18 s "windlong" or the 10 s wind
    //           loop) from a random place, +-3% in pitch, +-2 dB, sometimes with left and right swapped
    //   hum     the bomber stream far off (the bomber loop under 220 Hz), 18 dB below the wind, cut into 8-14 s pieces the same way and swelling slowly
    //   events  every 1.5-6 s a far sound (flak, a blast, bombs far below, the bombers' guns) from a few pre-made, low-passed variants, panned
    //           within +-0.7, at a random level; a fifth of them come as a group of 2-3 close together
    // Pure C# so the game (a streaming AudioClip pulls Mix on the audio thread) and Tools/AudioChecks render the very same thing. Kit = the material,
    // made once on a worker thread and read-only afterwards; the instance holds the running state (seeded: same seed, same sound).
    public sealed class CinemaMenuBed
    {
        public const double WindRmsDb = -30, HumBelowWindDb = -18, EventPeakDb = -19;   // dBFS of the wind, dB under the wind, dBFS of a loud event
        private const double RegionRmsDb = -26;                                            // the level CinemaLoops gives the wind and the far hum
        public const int Flak = 0, Boom = 1, Rumble = 2, Guns = 3, Kinds = 4;
        private static readonly double[] KindWeight = { .38, .17, .2, .25 }, KindDb = { 0, -2, -3, -4 };
        private static readonly int[] Variants = { 6, 4, 4, 4 };

        public sealed class Region { public float[] L, R; public bool Loop; public double Seconds => L.Length / (double)CinemaDsp.Rate; }

        public sealed class Kit
        {
            public Region[] Wind; public double[] WindWeight; public Region Hum;
            public float[][][] Events;   // [kind][variant]: mono, peak 1, already dulled by distance
        }

        public struct Entry { public double Time; public string What; public double A, B; }

        // ---- Material (heavy: about half a second) ----
        public static Kit Prepare(CinemaBank bank, int seed)
        {
            var r = new Rng(seed);
            var longWind = CinemaLoops.WindLong(bank); var loopWind = CinemaLoops.Wind(bank).Wind; var hum = CinemaLoops.FarHum(bank);
            var kit = new Kit
            {
                Wind = new[] { new Region { L = longWind.L, R = longWind.R }, new Region { L = loopWind.L, R = loopWind.R, Loop = true } },
                WindWeight = new[] { .65, .35 },
                Hum = new Region { L = hum.L, R = hum.R, Loop = true },
                Events = new float[Kinds][][],
            };
            for (int k = 0; k < Kinds; k++)
            {
                kit.Events[k] = new float[Variants[k]][];
                for (int v = 0; v < Variants[k]; v++) kit.Events[k][v] = MakeEvent(bank, r, k);
            }
            return kit;
        }

        private static float[] MakeEvent(CinemaBank bank, Rng r, int kind)
        {
            float[] x; double lo, hi;
            switch (kind)
            {
                case Flak: x = CinemaBlasts.FlakFar(bank, r); lo = 600; hi = 1300; break;
                case Boom: x = CinemaBlasts.Boom(bank, r); lo = 350; hi = 900; break;
                case Rumble: x = CinemaBlasts.Rumble(bank, r, r.Int(24, 40)); lo = 200; hi = 300; break;
                default:
                {
                    var s = CinemaGuns.FarGuns(bank, r, r.Int(10, 24)); x = new float[s.Length];
                    for (int i = 0; i < x.Length; i++) x[i] = (s.L[i] + s.R[i]) * .5f;
                    lo = 900; hi = 1800; break;
                }
            }
            CinemaDsp.Filter(x, Filt.Low, r.Range(lo, hi), 2);   // the further away, the duller
            CinemaDsp.FadeIn(x, .01); CinemaDsp.FadeOut(x, .25);
            CinemaDsp.Normalize(x, 0);
            return x;
        }

        // ---- Running state ----
        private sealed class Seg { public Region R; public bool Swap; public double Pos, Step, Gain; public long Age, Len, FadeIn, OutFade; }

        private sealed class Layer
        {
            public Region[] Regions; public double[] Weights;
            public double SegMin, SegMax, FadeMin, FadeMax, Pitch, LevelDb, BaseDb;
            public Seg Cur, Next;
        }

        private sealed class Voice { public float[] D; public double Pos, Step; public float GL, GR; }

        private readonly Kit kit;
        private readonly Rng rng;
        private readonly int outRate;
        private readonly double rateRatio;   // bank frames per output frame
        private readonly Layer wind, hum;
        private readonly Voice[] voices = new Voice[12];
        private readonly int[] lastVariant = { -1, -1, -1, -1 };
        private readonly double humPhaseA, humPhaseB;
        private long frame, nextEvent;
        private int followUps, burstKind;
        private double humMod = 1;
        private volatile int events, windChanges, humChanges;

        // Read by the game's tests and by Tools/AudioChecks (counters are written on the audio thread only).
        public double Seconds => frame / (double)outRate;
        public int EventCount => events;
        public int WindChanges => windChanges;
        public int HumChanges => humChanges;
        public List<Entry> Log;   // set it before the first Mix to record what happens (tools only)

        public CinemaMenuBed(Kit kit, int seed, int outputRate = CinemaDsp.Rate)
        {
            this.kit = kit; outRate = outputRate; rateRatio = CinemaDsp.Rate / (double)outputRate; rng = new Rng(seed);
            wind = new Layer { Regions = kit.Wind, Weights = kit.WindWeight, SegMin = 6, SegMax = 12, FadeMin = 1.5, FadeMax = 2.5, Pitch = .03, LevelDb = 2, BaseDb = WindRmsDb - RegionRmsDb };
            hum = new Layer { Regions = new[] { kit.Hum }, Weights = new[] { 1.0 }, SegMin = 8, SegMax = 14, FadeMin = 2, FadeMax = 3, Pitch = .02, LevelDb = 1.5, BaseDb = WindRmsDb + HumBelowWindDb - RegionRmsDb };
            humPhaseA = rng.U() * 6.2832; humPhaseB = rng.U() * 6.2832;
            nextEvent = (long)(rng.Range(1.2, 3) * outRate);
        }

        private Seg NewSeg(Layer ly, long fadeIn)
        {
            var s = new Seg { FadeIn = fadeIn };
            double pick = rng.U() * Sum(ly.Weights), acc = 0; int ri = 0;
            for (int i = 0; i < ly.Regions.Length; i++) { acc += ly.Weights[i]; if (pick <= acc) { ri = i; break; } }
            s.R = ly.Regions[ri];
            double pitch = 1 + rng.Range(-ly.Pitch, ly.Pitch), dur = rng.Range(ly.SegMin, ly.SegMax), span = s.R.Seconds;
            if (s.R.Loop) s.Pos = rng.U() * s.R.L.Length;
            else { dur = Math.Min(dur, (span - .1) / pitch); s.Pos = rng.Range(0, span - .05 - dur * pitch) * CinemaDsp.Rate; }
            s.Step = pitch * rateRatio; s.Len = (long)(dur * outRate);
            s.OutFade = Math.Min(s.Len / 3, (long)(rng.Range(ly.FadeMin, ly.FadeMax) * outRate));   // = the fade-in of the piece that follows
            s.Gain = CinemaDsp.Db(ly.BaseDb + rng.Range(-ly.LevelDb, ly.LevelDb)); s.Swap = rng.U() < .5;
            if (Log != null) Log.Add(new Entry { Time = Seconds, What = ly == wind ? "wind" : "hum", A = dur, B = s.OutFade / (double)outRate });
            return s;
        }

        private static double Sum(double[] w) { double s = 0; foreach (double v in w) s += v; return s; }

        private static void Read(Seg s, out float l, out float r)
        {
            var reg = s.R; int n = reg.L.Length, i = (int)s.Pos, j = i + 1; float f = (float)(s.Pos - i);
            if (j >= n) j = reg.Loop ? j - n : n - 1;
            float a = reg.L[i], b = reg.R[i];
            l = a + (reg.L[j] - a) * f; r = b + (reg.R[j] - b) * f;
            if (s.Swap) { float t = l; l = r; r = t; }
        }

        // Equal-power envelope of a piece: sin in over its fade-in, cos out over the last OutFade frames.
        private static float Env(Seg s)
        {
            float g = 1;
            if (s.Age < s.FadeIn) g = (float)Math.Sin(Math.PI / 2 * s.Age / s.FadeIn);
            long rem = s.Len - s.Age;
            if (rem < s.OutFade) g *= (float)Math.Sin(Math.PI / 2 * rem / s.OutFade);
            return g * (float)s.Gain;
        }

        private static void Advance(Seg s)
        {
            s.Age++; s.Pos += s.Step;
            if (s.R.Loop && s.Pos >= s.R.L.Length) s.Pos -= s.R.L.Length;
        }

        private void Step(Layer ly, out float l, out float r)
        {
            var c = ly.Cur ?? (ly.Cur = NewSeg(ly, 0));
            if (ly.Next == null && c.Len - c.Age <= c.OutFade)
            {
                ly.Next = NewSeg(ly, c.OutFade);
                if (ly == wind) windChanges++; else humChanges++;
            }
            Read(c, out l, out r); float g = Env(c); l *= g; r *= g;
            Advance(c);
            if (ly.Next != null)
            {
                Read(ly.Next, out float nl, out float nr); float ng = Env(ly.Next); l += nl * ng; r += nr * ng;
                Advance(ly.Next);
            }
            if (c.Age >= c.Len) { ly.Cur = ly.Next; ly.Next = null; }
        }

        private int PickKind()
        {
            double u = rng.U() * Sum(KindWeight), acc = 0;
            for (int k = 0; k < Kinds; k++) { acc += KindWeight[k]; if (u <= acc) return k; }
            return Flak;
        }

        // One far sound; a group is the first sound plus 1-2 follow-ups of the same kind a moment later, a little quieter each.
        private void Fire()
        {
            bool follow = followUps > 0;
            int kind = follow ? burstKind : PickKind();
            if (follow) followUps--; else { followUps = rng.U() < .22 ? rng.Int(1, 2) : 0; burstKind = kind; }
            var set = kit.Events[kind]; int v = rng.Int(0, set.Length - 1);
            if (v == lastVariant[kind] && set.Length > 1) v = (v + 1) % set.Length;
            lastVariant[kind] = v;
            double pan = rng.Range(-.7, .7), db = EventPeakDb + KindDb[kind] + rng.Range(-9, 0) - (follow ? 3 : 0);
            CinemaDsp.Balance(pan, out double gl, out double gr);
            double g = CinemaDsp.Db(db);
            for (int i = 0; i < voices.Length; i++)
            {
                if (voices[i] != null) continue;
                voices[i] = new Voice { D = set[v], Pos = 0, Step = (1 + rng.Range(-.04, .04)) * rateRatio, GL = (float)(g * gl), GR = (float)(g * gr) };
                break;
            }
            events++;
            if (Log != null) Log.Add(new Entry { Time = Seconds, What = "event", A = kind, B = pan });
            nextEvent = frame + (long)((followUps > 0 ? rng.Range(.12, .5) : rng.Range(1.5, 6)) * outRate);
        }

        // Writes 'frames' stereo frames (interleaved) into data, replacing what was there.
        public void Mix(float[] data, int frames)
        {
            long fadeFrames = (long)(.3 * outRate);
            for (int n = 0; n < frames; n++)
            {
                if ((frame & 255) == 0)
                {
                    double t = frame / (double)outRate;
                    humMod = CinemaDsp.Db(3 * (.6 * Math.Sin(t / 23 * 6.2832 + humPhaseA) + .4 * Math.Sin(t / 13.7 * 6.2832 + humPhaseB)));   // swells and ebbs by +-3 dB
                }
                if (frame >= nextEvent) Fire();
                Step(wind, out float l, out float r);
                Step(hum, out float hl, out float hr);
                float m = (float)humMod; l += hl * m; r += hr * m;
                for (int i = 0; i < voices.Length; i++)
                {
                    var v = voices[i]; if (v == null) continue;
                    int k = (int)v.Pos;
                    if (k + 1 >= v.D.Length) { voices[i] = null; continue; }
                    float a = v.D[k], x = a + (v.D[k + 1] - a) * (float)(v.Pos - k);
                    l += x * v.GL; r += x * v.GR; v.Pos += v.Step;
                }
                float start = frame < fadeFrames ? frame / (float)fadeFrames : 1;
                data[2 * n] = CinemaDsp.SoftClip(l * start, .6f, .9f); data[2 * n + 1] = CinemaDsp.SoftClip(r * start, .6f, .9f);
                frame++;
            }
        }
    }
}

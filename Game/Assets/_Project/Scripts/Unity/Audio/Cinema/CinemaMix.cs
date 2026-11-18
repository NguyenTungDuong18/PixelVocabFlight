using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // The two baked stems of the intro (interleaved stereo, 44.1 kHz, intro + 3 s so echoes ring past the end) and the wind loop.
    //   Ambience: our engine, the bomber hum, extra wind, burning fuel. Ducking, the "pre-suck" before big blasts and the muffling are baked in.
    //   Effects: guns, flak, blasts, hits, fly-bys, the logo hit.
    public sealed class CinemaStems
    {
        public const int Rate = CinemaDsp.Rate, Channels = 2;
        public float[] Ambience, Effects, Wind;
        public double Seconds;
        internal float[] DuckGain;      // linear, one value per 5 ms
        internal const double DuckStep = .005;

        public int Frames => Ambience.Length / Channels;

        // How much the background is pressed down at film time t (1 = not at all); the game applies it to the running wind loop.
        public float Duck(float t)
        {
            if (DuckGain == null || DuckGain.Length == 0 || t <= 0) return 1;
            double x = t / DuckStep; int i = (int)x;
            if (i >= DuckGain.Length - 1) return DuckGain[DuckGain.Length - 1];
            return DuckGain[i] + (DuckGain[i + 1] - DuckGain[i]) * (float)(x - i);
        }

        public double AmbienceRms(double from, double to) => StemRms(Ambience, from, to);
        public double EffectsRms(double from, double to) => StemRms(Effects, from, to);

        private static double StemRms(float[] b, double from, double to)
        {
            int a = Math.Max(0, (int)(from * Rate)) * Channels, z = Math.Min(b.Length, (int)(to * Rate) * Channels);
            if (z <= a) return 0;
            double s = 0; for (int i = a; i < z; i++) s += (double)b[i] * b[i];
            return Math.Sqrt(s / (z - a));
        }
    }

    public static class CinemaMix
    {
        public const float WindLoopVolume = .5f;   // volume of the running wind loop (the story uses it too)
        public const double TailSeconds = 3;
        private const double OpeningRumble = 7;   // level of the far rumble under the first seconds (Rumble peaks at -18 dBFS)

        // ---- Scene beds (scene n = n-th Shot cue). dB relative to each loop's own level; -90 = silent. ----
        // Fields: engine (bright, cabin, grit) a->b, bomber, wind, whistle; engine speed a->b (1 = as recorded).
        private struct Bed
        {
            public double EngB0, EngB1, Cab0, Cab1, Grit0, Grit1, Bomb0, Bomb1, Wind0, Wind1, Whis0, Whis1, Rate0, Rate1;
        }

        private const double Off = -90;
        private static readonly Bed[] Beds =
        {
            // 1 head-on with the bomber stream: the hum is there from the first sample and swells, no engine of ours yet
            new Bed { EngB0 = Off, EngB1 = Off, Cab0 = Off, Cab1 = Off, Grit0 = Off, Grit1 = Off, Bomb0 = -6, Bomb1 = -2, Wind0 = -12, Wind1 = -12, Whis0 = Off, Whis1 = Off, Rate0 = 1, Rate1 = 1 },
            // 2 four fighters roll and dive past the lens: the engine climbs three semitones, the hum falls back 8 dB
            new Bed { EngB0 = -2, EngB1 = -2, Cab0 = Off, Cab1 = Off, Grit0 = Off, Grit1 = Off, Bomb0 = -11, Bomb1 = -11, Wind0 = -12, Wind1 = -12, Whis0 = Off, Whis1 = Off, Rate0 = 1, Rate1 = 1.189 },
            // 3 chasing a fighter: engine loud and steady, the hum swells (we are diving into it)
            new Bed { EngB0 = 0, EngB1 = 0, Cab0 = Off, Cab1 = Off, Grit0 = Off, Grit1 = Off, Bomb0 = -9, Bomb1 = -2, Wind0 = -14, Wind1 = -14, Whis0 = Off, Whis1 = Off, Rate0 = 1, Rate1 = 1 },
            // 4 telephoto along the bomber: the hum is the main sound
            new Bed { EngB0 = -14, EngB1 = -14, Cab0 = Off, Cab1 = Off, Grit0 = Off, Grit1 = Off, Bomb0 = 0, Bomb1 = 0, Wind0 = -12, Wind1 = -12, Whis0 = Off, Whis1 = Off, Rate0 = 1, Rate1 = 1 },
            // 5 inside our cockpit: more bass, wind whistling on the glass
            new Bed { EngB0 = Off, EngB1 = Off, Cab0 = 0, Cab1 = 0, Grit0 = Off, Grit1 = Off, Bomb0 = -20, Bomb1 = -20, Wind0 = -16, Wind1 = -16, Whis0 = -10, Whis1 = -10, Rate0 = 1, Rate1 = 1 },
            // 6 banking, the horizon tilts: the engine growls two semitones up and distorts, the wind roars
            new Bed { EngB0 = Off, EngB1 = Off, Cab0 = Off, Cab1 = Off, Grit0 = 0, Grit1 = 0, Bomb0 = -18, Bomb1 = -18, Wind0 = -6, Wind1 = -6, Whis0 = Off, Whis1 = Off, Rate0 = 1.122, Rate1 = 1.14 },
            // 7 the enemy blows up ahead, through the fireball: as 5
            new Bed { EngB0 = Off, EngB1 = Off, Cab0 = 0, Cab1 = 0, Grit0 = Off, Grit1 = Off, Bomb0 = -20, Bomb1 = -20, Wind0 = -14, Wind1 = -14, Whis0 = -10, Whis1 = -10, Rate0 = 1, Rate1 = 1.06 },
            // 8 out of the smoke: the wind opens up, a small even engine, the hum far off
            new Bed { EngB0 = -12, EngB1 = -14, Cab0 = Off, Cab1 = Off, Grit0 = Off, Grit1 = Off, Bomb0 = -14, Bomb1 = -14, Wind0 = -6, Wind1 = -6, Whis0 = Off, Whis1 = Off, Rate0 = 1, Rate1 = 1 },
        };

        private struct DuckEvent { public double Start, Attack, Hold, Release, Depth; }
        private sealed class Muffle { public double[] T, Hz; public bool Effects; }

        private sealed class Curve
        {
            private readonly List<double> ts = new List<double>(), vs = new List<double>();
            private int cur;
            public double Max = double.NegativeInfinity;
            public void Add(double t, double v)
            {
                if (ts.Count > 0 && t <= ts[ts.Count - 1]) t = ts[ts.Count - 1] + 1e-6;
                ts.Add(t); vs.Add(v); Max = Math.Max(Max, v);
            }
            public double At(double t)
            {
                if (ts.Count == 0) return 0;
                if (t <= ts[0]) return vs[0];
                while (cur + 1 < ts.Count && ts[cur + 1] <= t) cur++;
                if (cur + 1 >= ts.Count) return vs[ts.Count - 1];
                double u = (t - ts[cur]) / (ts[cur + 1] - ts[cur]);
                return vs[cur] + (vs[cur + 1] - vs[cur]) * u;
            }
        }

        private sealed class Layer { public Stereo Loop; public Curve Gain = new Curve(), Rate; public double Offset; }

        private static double Lin(double db) => db <= -80 ? 0 : CinemaDsp.Db(db);

        // openingRumble false: only what the cues ask for (the timing checks of Tools/AudioChecks render one cue alone).
        public static CinemaStems Render(IList<CinemaCue> cues, int fps, double introSeconds, CinemaBank bank, bool openingRumble = true)
        {
            int n = CinemaDsp.N(introSeconds + TailSeconds);
            // Loops (each built once).
            var bright = CinemaLoops.EngineV12(bank);
            var bomber = CinemaLoops.BomberHum(bank);
            var wind = CinemaLoops.Wind(bank);
            var fire = CinemaLoops.Fire(bank);

            // Scenes from the Shot cues.
            var starts = new List<double>(); double title = double.PositiveInfinity;
            foreach (var c in cues)
            {
                if (c.Kind == CinemaKind.Shot) starts.Add(c.Time(fps));
                else if (c.Kind == CinemaKind.Title && c.Time(fps) < title) title = c.Time(fps);
            }
            starts.Sort();
            if (starts.Count == 0 || starts[0] > .05) starts.Insert(0, 0);
            double endBed = double.IsPositiveInfinity(title) ? introSeconds : title;

            var layers = new[]
            {
                new Layer { Loop = bright, Rate = new Curve() },
                new Layer { Loop = CinemaLoops.EngineCabin(bright), Rate = null },
                new Layer { Loop = CinemaLoops.EngineGrit(bright), Rate = null },
                new Layer { Loop = bomber },
                new Layer { Loop = wind.Wind, Offset = 3.1 * CinemaDsp.Rate },
                new Layer { Loop = wind.Whistle, Offset = 1.3 * CinemaDsp.Rate },
            };
            var rate = layers[0].Rate; layers[1].Rate = layers[2].Rate = rate;
            for (int i = 0; i < starts.Count; i++)
            {
                var bed = Beds[Math.Min(i, Beds.Length - 1)];
                double s0 = starts[i], s1 = i + 1 < starts.Count ? starts[i + 1] : introSeconds + 1;
                double a = i == 0 ? s0 : s0 + .02, b = Math.Max(a + .01, s1 - .02);
                double[,] ab = { { bed.EngB0, bed.EngB1 }, { bed.Cab0, bed.Cab1 }, { bed.Grit0, bed.Grit1 }, { bed.Bomb0, bed.Bomb1 }, { bed.Wind0, bed.Wind1 }, { bed.Whis0, bed.Whis1 } };
                for (int l = 0; l < layers.Length; l++) { layers[l].Gain.Add(a, ab[l, 0]); layers[l].Gain.Add(b, ab[l, 1]); }
                rate.Add(a, bed.Rate0); rate.Add(b, bed.Rate1);
            }

            var ambL = new float[n]; var ambR = new float[n];
            foreach (var layer in layers)
            {
                if (layer.Gain.Max <= -80) continue;
                double pos = layer.Offset % layer.Loop.Length; int len = layer.Loop.Length;
                var gain = layer.Gain;
                for (int i = 0; i < n; i++)
                {
                    double t = (double)i / CinemaDsp.Rate;
                    pos += layer.Rate != null ? layer.Rate.At(t) : 1; while (pos >= len) pos -= len;
                    double g = Lin(gain.At(t)) * BedFade(t, endBed);
                    if (g < 1e-5) continue;
                    ambL[i] += CinemaDsp.ReadLoop(layer.Loop.L, pos) * (float)g;
                    ambR[i] += CinemaDsp.ReadLoop(layer.Loop.R, pos) * (float)g;
                }
            }

            // One-shots.
            var fx = new Stereo(n); var post = new Stereo(n);
            // The film opens on the bomber stream: bombs far below rumble from the first sample (fading in over 0.15 s) so the first half second is not thin.
            if (openingRumble)
            {
                var opening = CinemaBlasts.Rumble(bank, new Rng(6999), 40); CinemaDsp.FadeIn(opening, .15);
                fx.AddMono(0, opening, OpeningRumble, 0);
            }
            var ducks = new List<DuckEvent>(); var muffles = new List<Muffle>();
            for (int ci = 0; ci < cues.Count; ci++)
            {
                var cue = cues[ci]; double t = cue.Time(fps), level = cue.Level / 100.0, pan = cue.Pan / 100.0 * .7;
                int at = CinemaDsp.N(t), dur = cue.Dur;
                var r = new Rng(7000 + ci * 31 + cue.Kind);
                int scene = 0; for (int k = 0; k < starts.Count; k++) if (starts[k] <= t + .001) scene = k;
                switch (cue.Kind)
                {
                    case CinemaKind.Burst:
                        dur = dur > 0 ? dur : 12;
                        fx.AddMono(at, CinemaGuns.WingGuns(bank, r, dur), level, pan);
                        ducks.Add(new DuckEvent { Start = t, Attack = .02, Hold = dur / 30.0, Release = .25, Depth = 3 });
                        break;
                    case CinemaKind.Boom:
                        fx.AddMono(at, CinemaBlasts.Boom(bank, r), level, pan);
                        ducks.Add(new DuckEvent { Start = t, Attack = .01, Hold = .15, Release = .9, Depth = 6 });
                        break;
                    case CinemaKind.BigBoom:
                        fx.AddStereo(at, CinemaBlasts.BigBoom(bank, r), level, pan);
                        ducks.Add(new DuckEvent { Start = t - .09, Attack = .015, Hold = .275, Release = 1.4, Depth = 14 });   // pre-suck: the bed is already down 60 ms before the cue
                        muffles.Add(new Muffle { T = new[] { t - .09, t - .07, t + .15, t + .75 }, Hz = new[] { 20000.0, 1500, 1500, 20000 } });
                        if (scene == 3)   // scene 4: the slow motion drags the bed down and dull for a third of a second
                            muffles.Add(new Muffle { T = new[] { t, t + .03, t + .35, t + .62 }, Hz = new[] { 20000.0, 450, 450, 20000 } });
                        break;
                    case CinemaKind.Whoosh:
                        fx.AddStereo(at - CinemaDsp.N(CinemaPasses.WhooshClosest(dur)), CinemaPasses.Whoosh(bank, r, bright, cue.Pan, dur), level);
                        break;
                    case CinemaKind.Flak:
                        fx.AddMono(at, CinemaBlasts.FlakFar(bank, r), level, pan * .4);
                        break;
                    case CinemaKind.Title:
                        fx.AddStereo(at, CinemaBlasts.Title(r), level);
                        break;
                    case CinemaKind.Hit:
                        fx.AddMono(at, CinemaGuns.Hits(bank, r), level, pan);
                        break;
                    case CinemaKind.Cannon:
                        dur = dur > 0 ? dur : 12;
                        fx.AddMono(at, CinemaGuns.Cannon(bank, r, dur), level, pan);
                        break;
                    case CinemaKind.Gunners:
                        dur = dur > 0 ? dur : 20;
                        fx.AddStereo(at, CinemaGuns.FarGuns(bank, r, dur), level, pan * .4);
                        break;
                    case CinemaKind.FlakNear:
                        fx.AddStereo(at, CinemaBlasts.FlakNear(bank, r), level, pan);
                        ducks.Add(new DuckEvent { Start = t, Attack = .01, Hold = .15, Release = .9, Depth = 9 });
                        break;
                    case CinemaKind.HeavyPass:
                        fx.AddStereo(at - CinemaDsp.N(CinemaPasses.HeavyClosest), CinemaPasses.HeavyPass(bank, r, bomber, cue.Pan), level);
                        ducks.Add(new DuckEvent { Start = t - .5, Attack = .3, Hold = .5, Release = .6, Depth = 4 });
                        break;
                    case CinemaKind.Rumble:
                        dur = dur > 0 ? dur : 45;
                        fx.AddMono(at, CinemaBlasts.Rumble(bank, r, dur), level, pan * .4);
                        break;
                    case CinemaKind.Fireball:
                    {
                        dur = dur > 0 ? dur : 15;
                        double hold = Math.Max(.5, dur / 30.0);
                        post.AddStereo(at, CinemaBlasts.Fireball(bank, r, dur), level);
                        muffles.Add(new Muffle { T = new[] { t, t + .08, t + hold, t + hold + 1.2, t + hold + 2.2 }, Hz = new[] { 20000.0, 900, 900, 8000, 20000 }, Effects = true });
                        ducks.Add(new DuckEvent { Start = t, Attack = .05, Hold = hold, Release = 1.2, Depth = 10 });
                        break;
                    }
                    case CinemaKind.Fire:
                    {
                        dur = dur > 0 ? dur : 30;
                        double d = dur / 30.0, off = r.U() * fire.Length;
                        int from = Math.Max(0, at), to = Math.Min(n, at + CinemaDsp.N(d));
                        double pos = off, g0 = level * CinemaDsp.Db(-2);
                        for (int i = from; i < to; i++)
                        {
                            double tt = (double)(i - at) / CinemaDsp.Rate, env = Math.Min(1, tt / .1) * Math.Min(1, (d - tt) / .1);
                            pos += 1; while (pos >= fire.Length) pos -= fire.Length;
                            ambL[i] += CinemaDsp.ReadLoop(fire.L, pos) * (float)(g0 * env); ambR[i] += CinemaDsp.ReadLoop(fire.R, pos) * (float)(g0 * env);
                        }
                        break;
                    }
                }
            }

            // Ducking curve (shared with the game's wind loop), then applied to the ambience.
            var duck = new float[(int)((introSeconds + TailSeconds) / CinemaStems.DuckStep) + 2];
            for (int k = 0; k < duck.Length; k++)
            {
                double t = k * CinemaStems.DuckStep, db = 0;
                foreach (var e in ducks) db = Math.Max(db, e.Depth * Shape(t - e.Start, e));
                duck[k] = (float)CinemaDsp.Db(-db);
            }
            for (int i = 0; i < n; i++)
            {
                double x = i / (double)CinemaDsp.Rate / CinemaStems.DuckStep; int k = (int)x;
                float g = k + 1 < duck.Length ? duck[k] + (duck[k + 1] - duck[k]) * (float)(x - k) : duck[duck.Length - 1];
                ambL[i] *= g; ambR[i] *= g;
            }
            Muffled(ambL, ambR, muffles, false);
            Muffled(fx.L, fx.R, muffles, true);
            for (int i = 0; i < n; i++) { fx.L[i] += post.L[i]; fx.R[i] += post.R[i]; }
            CinemaDsp.SoftClip(ambL, .4f, .55f); CinemaDsp.SoftClip(ambR, .4f, .55f);
            CinemaDsp.SoftClip(fx.L, .6f, .8f); CinemaDsp.SoftClip(fx.R, .6f, .8f);

            return new CinemaStems
            {
                Ambience = Interleave(ambL, ambR), Effects = Interleave(fx.L, fx.R), Wind = Interleave(wind.Wind.L, wind.Wind.R),
                Seconds = introSeconds + TailSeconds, DuckGain = duck,
            };
        }

        // After the Title cue everything but the wind settles in 1.2 s (the film's own wind loop carries on).
        private static double BedFade(double t, double end)
        {
            if (t <= end) return 1;
            double f = Math.Max(0, 1 - (t - end) / 1.2);
            return f * f * (3 - 2 * f);
        }

        private static double Shape(double x, DuckEvent e)
        {
            if (x < 0) return 0;
            if (x < e.Attack) return x / e.Attack;
            if (x < e.Attack + e.Hold) return 1;
            return Math.Max(0, 1 - (x - e.Attack - e.Hold) / e.Release);
        }

        // A time-varying low-pass over a bus where a muffle event is active (the filter keeps running so it never clicks when it engages).
        private static void Muffled(float[] l, float[] r, List<Muffle> events, bool effects)
        {
            var mine = events.FindAll(m => !m.Effects || effects);
            if (mine.Count == 0) return;
            var fl = new Biquad(Filt.Low, 20000); var fr = new Biquad(Filt.Low, 20000);
            double fc = 20000; bool active = false;
            for (int i = 0; i < l.Length; i++)
            {
                if ((i & 31) == 0)
                {
                    double t = (double)i / CinemaDsp.Rate, hz = 20000;
                    foreach (var m in mine) hz = Math.Min(hz, Cutoff(m, t));
                    active = hz < 19000;
                    if (Math.Abs(hz - fc) > fc * .01) { fl.Tune(Filt.Low, hz); fr.Tune(Filt.Low, hz); fc = hz; }
                }
                float a = fl.Tick(l[i]), b = fr.Tick(r[i]);
                if (active) { l[i] = a; r[i] = b; }
            }
        }

        private static double Cutoff(Muffle m, double t)
        {
            if (t <= m.T[0] || t >= m.T[m.T.Length - 1]) return 20000;
            int k = 0; while (t > m.T[k + 1]) k++;
            double u = (t - m.T[k]) / Math.Max(1e-6, m.T[k + 1] - m.T[k]);
            return m.Hz[k] * Math.Pow(m.Hz[k + 1] / m.Hz[k], u);
        }

        private static float[] Interleave(float[] l, float[] r)
        {
            var o = new float[l.Length * 2];
            for (int i = 0; i < l.Length; i++) { o[2 * i] = l[i]; o[2 * i + 1] = r[i]; }
            return o;
        }
    }
}

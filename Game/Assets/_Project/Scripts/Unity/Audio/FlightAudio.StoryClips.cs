using UnityEngine;

namespace PixelVocabFlight
{
    // Synthesis of the story sounds (22.05 kHz mono). Loops are built to repeat without a click: noise needs nothing,
    // tonal drones use whole numbers of cycles per loop. The wind and the old intro ids (engines, burst, boom, bigboom, whoosh, flak, hit,
    // title) come from Audio/Cinema (44.1 kHz stereo) through CinemaClips.ForStoryId.
    public sealed partial class FlightAudio
    {
        private const int StoryRate = 22050;

        private static AudioClip BuildStoryClip(string id)
        {
            if (CinemaClips.IsStoryId(id))
            {
                var bank = StoryBank();
                var film = bank != null ? CinemaClips.ForStoryId(id, bank) : null;
                if (film != null) return MakeStereo(id, CinemaClips.Interleave(film));
                return Make(id, new float[StoryRate / 10]);   // no recordings: a short silence rather than a wrong sound (the warning is in the log)
            }
            switch (id)
            {
                case "rain": return Make(id, Rain(4f));
                case "radio": return Make(id, Radio(8f));
                case "frogs": return Make(id, Frogs(6f));
                case "clock": return Make(id, Clock(2f));
                case "drone": return Make(id, Drone(4f));
                case "tin_touch": return Make(id, TinTouch(1.6f));
                case "tin_open": return Make(id, TinOpen(3.2f));
                case "cloth": return Make(id, Cloth(.7f));
                case "note": return Make(id, Note(2.8f));
                default: return Make("clack", TypeKey(.05f));
            }
        }

        private static AudioClip Make(string name, float[] samples)
        {
            var clip = AudioClip.Create("Story " + name, samples.Length, 1, StoryRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        // Interleaved stereo at 44.1 kHz.
        private static AudioClip MakeStereo(string name, float[] interleaved)
        {
            var clip = AudioClip.Create("Story " + name, interleaved.Length / 2, 2, CinemaDsp.Rate, false);
            clip.SetData(interleaved, 0);
            return clip;
        }

        private static float Noise(System.Random random) => (float)random.NextDouble() * 2 - 1;

        // Rain on window glass, heard from inside: soft hiss with a low rumble and sparse drops.
        private static float[] Rain(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(101);
            float fast = 0, slow = 0;
            for (int i = 0; i < s.Length; i++)
            {
                fast += (Noise(random) - fast) * .4f;
                slow += (fast - slow) * .03f;
                s[i] = (fast - slow * .8f) * .5f + slow * .6f;
            }
            for (int d = 0; d < (int)(seconds * 18); d++)
            {
                int at = random.Next(s.Length - 600); float pitch = 1400 + random.Next(1800), level = .06f + (float)random.NextDouble() * .12f;
                for (int k = 0; k < 500; k++) s[at + k] += Mathf.Sin(k * pitch * 2 * Mathf.PI / StoryRate) * Mathf.Exp(-k * .018f) * level;
            }
            return s;
        }

        // An old radio: a man reading the news. Voiced syllables through two formants, band-limited, with static.
        // The syllables change at random, so it sounds like speech and never like a word; no music.
        private static float[] Radio(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(202);
            float phase = 0, y11 = 0, y12 = 0, y21 = 0, y22 = 0, high = 0, pitch = 118;
            int i = 0;
            while (i < s.Length)
            {
                // A phrase: 4-9 syllables, then a breath.
                int syllables = 4 + random.Next(6);
                pitch = 105 + random.Next(40);
                for (int k = 0; k < syllables && i < s.Length; k++)
                {
                    int length = (int)(StoryRate * (.11f + (float)random.NextDouble() * .12f));
                    float f1 = 380 + random.Next(420), f2 = 900 + random.Next(1300), level = .5f + (float)random.NextDouble() * .5f, drift = (float)random.NextDouble() * .2f - .1f;
                    Resonator(f1, 110, out float a1, out float b1, out float c1);
                    Resonator(f2, 160, out float a2, out float b2, out float c2);
                    for (int n = 0; n < length && i < s.Length; n++, i++)
                    {
                        float t = (float)n / length, envelope = Mathf.Sin(Mathf.PI * t); envelope *= envelope;
                        phase += pitch * (1 + drift * t) / StoryRate;
                        float pulse = 0; if (phase >= 1) { phase -= 1; pulse = 1; }
                        float f = a1 * pulse + b1 * y11 + c1 * y12; y12 = y11; y11 = f;
                        float g = a2 * pulse + b2 * y21 + c2 * y22; y22 = y21; y21 = g;
                        float voice = (f * 1.4f + g) * envelope * level;
                        high += (voice - high) * .08f;               // telephone band: drop the lows
                        s[i] = Mathf.Clamp((voice - high) * .9f + Noise(random) * .03f, -1, 1) * .55f;
                    }
                }
                int breath = (int)(StoryRate * (.25f + (float)random.NextDouble() * .35f));
                for (int n = 0; n < breath && i < s.Length; n++, i++) s[i] = Noise(random) * .03f;
            }
            return s;
        }

        // Two-pole resonator coefficients: y = a x + b y1 + c y2.
        private static void Resonator(float frequency, float bandwidth, out float a, out float b, out float c)
        {
            float r = Mathf.Exp(-Mathf.PI * bandwidth / StoryRate);
            b = 2 * r * Mathf.Cos(2 * Mathf.PI * frequency / StoryRate); c = -r * r; a = (1 - r) * 3;
        }

        // Night frogs by the canal: trilled calls of two or three kinds, near and far.
        private static float[] Frogs(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(303);
            int calls = (int)(seconds * 4);
            for (int c = 0; c < calls; c++)
            {
                int kind = random.Next(3), start = random.Next(s.Length - StoryRate / 2);
                float carrier = kind == 0 ? 1050 + random.Next(250) : kind == 1 ? 620 + random.Next(120) : 1500 + random.Next(300);
                float rate = kind == 1 ? 14 : 26, length = kind == 1 ? .28f : .4f, level = (c % 3 == 0 ? .22f : .08f) + (float)random.NextDouble() * .08f;
                int n = (int)(StoryRate * length);
                for (int k = 0; k < n && start + k < s.Length; k++)
                {
                    float t = (float)k / n, pulse = Mathf.Pow(Mathf.Max(0, Mathf.Sin(2 * Mathf.PI * rate * t * length)), 2);
                    s[start + k] += Mathf.Sin(2 * Mathf.PI * carrier * k / StoryRate) * pulse * Mathf.Sin(Mathf.PI * t) * level;
                }
            }
            return s;
        }

        // A wall clock: tick, then a lower tock a second later (2 s loop).
        private static float[] Clock(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(404);
            for (int beat = 0; beat < 2; beat++)
            {
                int start = (int)(StoryRate * beat * seconds / 2);
                float pitch = beat == 0 ? 2800 : 1900, decay = beat == 0 ? .0012f : .0016f;
                for (int k = 0; k < 900 && start + k < s.Length; k++)
                    s[start + k] += (Mathf.Sin(2 * Mathf.PI * pitch * k / StoryRate) * .6f + Noise(random) * .25f) * Mathf.Exp(-k * decay * 4f);
            }
            return s;
        }

        // The deep drone of a bomber stream: low sines in whole cycles (4 s loop) with a slow beat, and engine rumble.
        private static float[] Drone(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(505);
            float[] hz = { 48f, 48.75f, 72f, 96.5f, 120.25f };
            float[] amp = { .5f, .4f, .3f, .22f, .12f };
            float rumble = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, sum = 0;
                for (int h = 0; h < hz.Length; h++) sum += Mathf.Sin(2 * Mathf.PI * hz[h] * t) * amp[h];
                rumble += (Noise(random) - rumble) * .02f;
                float swell = .8f + .2f * Mathf.Sin(2 * Mathf.PI * .5f * t);
                s[i] = (sum * .6f + rumble * 3.2f) * swell * .45f;
            }
            return s;
        }

        // Fleshy knock: low-passed noise body + a short click (flesh or wood). cutoff in Hz, decay in 1/s, attack in s (soft skin 3-6 ms, hard knock ~1 ms).
        private static void Thump(float[] s, float at, float level, float cutoff, float decay, int seed, float attack = .0012f)
        {
            var random = new System.Random(seed);
            float a = 1 - Mathf.Exp(-2 * Mathf.PI * cutoff / StoryRate), l1 = 0, l2 = 0;
            int start = (int)(at * StoryRate), n = (int)(StoryRate * Mathf.Min(.4f, 8f / decay));
            for (int k = 0; k < n && start + k < s.Length; k++)
            {
                float t = (float)k / StoryRate;
                l1 += (Noise(random) - l1) * a; l2 += (l1 - l2) * a;
                float body = (l2 * 7f + Mathf.Sin(2 * Mathf.PI * cutoff * .4f * t) * .35f) * Mathf.Exp(-t * decay) * Mathf.Min(1, t / attack);
                s[start + k] += (body + Noise(random) * Mathf.Exp(-t * 700) * .4f * Mathf.Min(1, t / attack)) * level;
            }
        }

        // Thin tin shell: several inharmonic modes (pitch scaled by `pitch`), each fading at its own rate; a 1 ms noise tick opens it.
        private static void Ring(float[] s, float at, float level, float pitch, float[] hz, float[] amp, float[] decay, int seed)
        {
            var random = new System.Random(seed);
            int start = (int)(at * StoryRate), n = (int)(StoryRate * .5f);
            for (int k = 0; k < n && start + k < s.Length; k++)
            {
                float t = (float)k / StoryRate, v = 0;
                for (int m = 0; m < hz.Length; m++) v += Mathf.Sin(2 * Mathf.PI * hz[m] * pitch * t) * amp[m] * Mathf.Exp(-t * decay[m]);
                s[start + k] += (v + Noise(random) * Mathf.Exp(-t * 1500) * 1.2f) * level;
            }
        }

        // Band-passed noise (a resonator sweeping hz0 -> hz1): cloth, tin rubbing on tin, hinge squeal. gate = depth of the
        // jittery saw (stick-slip, 0 = none) at gateHz; rise > 0 swells like k^rise and stops short, rise = 0 is a soft hump.
        private static void Scrape(float[] s, float at, float length, float level, float hz0, float hz1, float bandwidth, float gate, float gateHz, float rise, int seed)
        {
            var random = new System.Random(seed);
            int start = (int)(at * StoryRate), n = (int)(StoryRate * length);
            float y1 = 0, y2 = 0, a = 0, b = 0, c = 0, saw = 0;
            for (int k = 0; k < n && start + k < s.Length; k++)
            {
                float t = (float)k / StoryRate, p = (float)k / n;
                if ((k & 31) == 0) Resonator(Mathf.Lerp(hz0, hz1, p), bandwidth, out a, out b, out c);
                float f = a * Noise(random) + b * y1 + c * y2; y2 = y1; y1 = f;
                float env = rise > 0 ? Mathf.Pow(p, rise) * Mathf.Min(1, (n - k) / (StoryRate * .015f)) : Mathf.Pow(Mathf.Sin(Mathf.PI * p), 2);
                saw += gateHz * (1 + .3f * Mathf.Sin(t * 61)) / StoryRate; saw -= (int)saw;
                s[start + k] += f * env * level * (1 - gate * saw);
            }
        }

        private static void Normalize(float[] s, float peak)
        {
            float max = 0;
            foreach (float v in s) max = Mathf.Max(max, Mathf.Abs(v));
            if (max > 0) for (int i = 0; i < s.Length; i++) s[i] *= peak / max;
        }

        private static readonly float[] TinHz = { 1150, 1730, 2410, 3330, 4570, 5900 };
        private static readonly float[] TinAmp = { .5f, .4f, .35f, .25f, .2f, .12f };
        private static readonly float[] TinDecay = { 22, 28, 34, 42, 55, 70 };

        // Hands closing on a biscuit tin (cut_open_tin_hand @8, beat 3 s): the right palm and fingertips slap the
        // right wall at 0.75 s (frame 6), the tin shivers and the base shifts on the wood (0.875-1.0 s), the left hand
        // lands softer at 1.125 s (frame 9). Each touch is followed by a sleeve rustle.
        private static float[] TinTouch(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            Thump(s, .75f, .9f, 380, 55, 11, .005f);                 // skin, not a hard knock: 5 ms attack
            Ring(s, .75f, .05f, 1f, TinHz, TinAmp, TinDecay, 12);    // tin ring about 12 dB under the body
            Scrape(s, .78f, .1f, .05f, 3000, 2200, 2500, 0, 0, 0, 13);
            Scrape(s, .88f, .12f, .04f, 240, 180, 300, .5f, 45, 0, 14);
            Thump(s, 1.125f, .8f, 300, 50, 15, .004f);
            Ring(s, 1.125f, .03f, .93f, TinHz, TinAmp, TinDecay, 16);
            Scrape(s, 1.155f, .09f, .04f, 2800, 2000, 2500, 0, 0, 0, 17);
            Normalize(s, .6f);
            return s;
        }

        private static readonly float[] LidHz = { 420, 1340, 2600 };       // lid ring, modes 1 : 3.2 : 6.2
        private static readonly float[] LidAmp = { .6f, .4f, .25f };

        // The stuck lid (cut_open_tin_lid @8, beat 4 s): sleeve rustle as the right hand comes round (0.25-0.6 s); at
        // 0.625 s (frame 5) the fingertips hook the rolled rim (nail "tach") and the thumb pad lands on the front wall (dull
        // tap); then the uneven strain: three small tin ticks, growing, at 0.75 s (frame 6), 1.0 s (frame 8) and 1.125 s
        // (frame 9, with a faint "tonk" of flexing tin); frame 7 is silent. The lid snaps off at 1.25 s (frame 10, the
        // loudest event: tick + air "p" + ringing lid), a short hinge squeal, the finger pads catch the underside at
        // 1.375 s (frame 11) and push it to the stop at 1.875 s (frame 15), the fingers slide off at 2.0 s (frame 16), and
        // the hand settles on the table: middle and ring tips at 2.625 s (frame 21), heel and the other tips at 2.75 s
        // (frame 22, the main thump), the thumb's side at 2.875 s (frame 23).
        private static float[] TinOpen(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            Scrape(s, .25f, .35f, .05f, 2600, 3400, 2500, 0, 0, 0, 21);
            Ring(s, .625f, .5f, 1.55f, TinHz, TinAmp, new[] { 90f, 100, 110, 120, 140, 160 }, 22);
            Thump(s, .64f, .35f, 320, 60, 38, .004f);               // thumb pad on the front wall
            Scrape(s, .75f, .008f, .2f, 2000, 2000, 1500, 0, 0, 0, 23);
            Scrape(s, 1.0f, .01f, .42f, 2800, 2800, 1500, 0, 0, 0, 24);
            Scrape(s, 1.125f, .012f, .8f, 3500, 3500, 1500, 0, 0, 0, 25);
            Ring(s, 1.125f, .12f, 1f, new[] { 260f, 420, 580 }, new[] { .6f, .45f, .3f }, new[] { 38f, 45, 55 }, 31);
            Ring(s, 1.25f, 1f, 1f, TinHz, TinAmp, TinDecay, 26);
            Ring(s, 1.25f, .45f, 1f, LidHz, LidAmp, new[] { 12f, 16, 22 }, 32);
            Thump(s, 1.25f, .7f, 900, 120, 27);
            Thump(s, 1.25f, .5f, 200, 90, 33);                      // air "p", ~30 ms
            Scrape(s, 1.27f, .3f, .1f, 2700, 2000, 160, .6f, 55, 0, 28);
            Thump(s, 1.375f, .55f, 300, 70, 39, .005f);             // finger pads catch the underside
            Ring(s, 1.375f, .08f, 1f, LidHz, LidAmp, new[] { 20f, 26, 32 }, 35);
            Ring(s, 1.875f, .4f, 1.4f, TinHz, TinAmp, new[] { 60f, 70, 80, 95, 110, 130 }, 29);
            Ring(s, 1.875f, .25f, 1f, LidHz, LidAmp, new[] { 9f, 12, 16 }, 34);
            Scrape(s, 2.0f, .06f, .05f, 1800, 1200, 1500, 0, 0, 0, 37);
            Thump(s, 2.625f, .2f, 220, 45, 36, .006f);
            Thump(s, 2.75f, .8f, 170, 32, 30);
            Thump(s, 2.875f, .25f, 200, 40, 40, .006f);
            Normalize(s, .7f);
            return s;
        }

        // A handkerchief pulled off its nail: two soft swishes of filtered noise.
        private static float[] Cloth(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(808);
            float low = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / s.Length;
                low += (Noise(random) - low) * .22f;
                float swish1 = Mathf.Pow(Mathf.Max(0, Mathf.Sin(Mathf.PI * Mathf.Clamp01(t / .6f))), 2);
                float swish2 = .6f * Mathf.Pow(Mathf.Max(0, Mathf.Sin(Mathf.PI * Mathf.Clamp01((t - .4f) / .55f))), 2);
                s[i] = low * (swish1 + (t > .4f ? swish2 : 0)) * .45f;
            }
            return s;
        }

        // A single soft note (G4), the "one note of music" of the story: a bell-like pluck with a long fade.
        private static float[] Note(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, attack = Mathf.Min(1, t / .015f);
                float v = Mathf.Sin(2 * Mathf.PI * 392 * t) * Mathf.Exp(-t * 1.5f)
                        + Mathf.Sin(2 * Mathf.PI * 784 * t) * .3f * Mathf.Exp(-t * 2.4f)
                        + Mathf.Sin(2 * Mathf.PI * 1176 * t) * .1f * Mathf.Exp(-t * 3.5f);
                s[i] = v * attack * .38f * Mathf.Clamp01((seconds - t) / .3f);
            }
            return s;
        }

        // One typewriter key.
        private static float[] TypeKey(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(909);
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate;
                s[i] = (Mathf.Sin(2 * Mathf.PI * 1800 * t) * .4f + Noise(random) * .3f) * Mathf.Exp(-t * 110);
            }
            return s;
        }
    }
}

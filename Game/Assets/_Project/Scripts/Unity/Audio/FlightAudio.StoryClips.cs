using UnityEngine;

namespace PixelVocabFlight
{
    // Synthesis of the story sounds (22.05 kHz mono). Loops are built to repeat without a click: noise needs nothing,
    // tonal drones use whole numbers of cycles per loop.
    public sealed partial class FlightAudio
    {
        private const int StoryRate = 22050;

        private static AudioClip BuildStoryClip(string id)
        {
            switch (id)
            {
                case "rain": return Make(id, Rain(4f));
                case "radio": return Make(id, Radio(8f));
                case "frogs": return Make(id, Frogs(6f));
                case "clock": return Make(id, Clock(2f));
                case "drone": return Make(id, Drone(4f));
                case "wind": return Make(id, Wind(6f));
                case "engines": return Make(id, Engines(4f));
                case "burst": return Make(id, Burst(.7f));
                case "boom": return Make(id, Boom(1.5f));
                case "bigboom": return Make(id, BigBoom(1.8f));
                case "whoosh": return Make(id, Whoosh(.6f));
                case "flak": return Make(id, Flak(.35f));
                case "hit": return Make(id, Hit(.3f));
                case "title": return Make(id, TitleHit(2.4f));
                case "tin_touch": return Make(id, TinTouch(1.7f));
                case "tin_open": return Make(id, TinOpen(2.9f));
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

        // Night wind: low-passed noise that swells and falls (6 s loop).
        private static float[] Wind(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(606);
            float low = 0, mid = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate;
                float n = Noise(random);
                low += (n - low) * .015f; mid += (n - mid) * .06f;
                s[i] = (low * 6f + (mid - low) * .8f) * (.55f + .45f * Mathf.Sin(2 * Mathf.PI * t / seconds + .5f)) * .5f;
            }
            return s;
        }

        // Two radial engines of a dogfight (4 s loop): buzzing sawtooth stacks at 88 and 94 Hz (whole cycles), beating slowly.
        private static float[] Engines(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(1010);
            float low = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, sum = 0;
                for (int h = 1; h <= 6; h++) sum += (Mathf.Sin(2 * Mathf.PI * 88 * h * t) + Mathf.Sin(2 * Mathf.PI * 94 * h * t + h)) / h;
                low += (Noise(random) - low) * .05f;
                s[i] = (sum * .16f + low * 1.2f) * (.85f + .15f * Mathf.Sin(2 * Mathf.PI * 2 * t)) * .5f;
            }
            return s;
        }

        // An aircraft blowing up: a sharp crack, then low-passed noise rolling off over a sub thump that sinks from 70 to 35 Hz.
        private static float[] Boom(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(1212);
            float low = 0, phase = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate;
                low += (Noise(random) - low) * Mathf.Lerp(.5f, .06f, Mathf.Clamp01(t / .5f));   // the noise darkens as it fades
                phase += Mathf.Lerp(70, 35, Mathf.Clamp01(t / 1.2f)) / StoryRate;
                float crack = Noise(random) * Mathf.Exp(-t * 60);
                s[i] = Mathf.Clamp((crack * .6f + low * 1.6f * Mathf.Exp(-t * 3.2f) + Mathf.Sin(2 * Mathf.PI * phase) * .7f * Mathf.Exp(-t * 2.4f)) * .7f, -1, 1);
            }
            return s;
        }

        // A short burst of machine guns: eight cracks 55 ms apart, each a noise snap on a low thump.
        private static float[] Burst(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(1111);
            for (int shot = 0; shot < 8; shot++)
            {
                int start = (int)(StoryRate * shot * .055f);
                for (int k = 0; k < 1400 && start + k < s.Length; k++)
                    s[start + k] += (Noise(random) * .55f + Mathf.Sin(2 * Mathf.PI * 170 * k / StoryRate) * .45f) * Mathf.Exp(-k * .006f);
            }
            return s;
        }

        // Two palms meeting the sides of a biscuit tin (cut_open_tin_hand @8: the right hand at frame 10,
        // the left three frames later at 13): two soft knocks, each with a faint metal ring.
        private static float[] TinTouch(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            for (int i = 0; i < s.Length; i++)
            {
                float v = 0;
                foreach (float at in new[] { 1.25f, 1.625f })
                {
                    float t = (float)i / StoryRate - at;
                    if (t < 0) continue;
                    v += Mathf.Sin(2 * Mathf.PI * 140 * t) * Mathf.Exp(-t * 60) * .45f
                       + (Mathf.Sin(2 * Mathf.PI * 1650 * t) * .3f + Mathf.Sin(2 * Mathf.PI * 2480 * t) * .18f) * Mathf.Exp(-t * 48);
                }
                s[i] = v;
            }
            return s;
        }

        // The stuck lid (cut_open_tin_lid @8): the pinch takes hold at frame 8 (1.0 s); then stick-slip
        // groans in bursts while the hand heaves, louder each try; at frame 20 (2.5 s) it lets go with a
        // short ring.
        private static float[] TinOpen(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(707);
            float phase = 0;
            const float Start = 1f, Pop = 2.5f;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, v = 0;
                if (t >= Start && t < Pop - .03f)
                {
                    float k = (t - Start) / (Pop - Start);
                    phase += (520 + 520 * k + Mathf.Sin(t * 37) * 40) / StoryRate;
                    float stick = .5f + .5f * Mathf.Sin(2 * Mathf.PI * 13 * t);
                    float tries = Mathf.Max(0, Mathf.Sin(2 * Mathf.PI * 2 * (t - Start)));   // one groan per heave, two a second
                    v += (Mathf.Sin(2 * Mathf.PI * phase) * .3f + Noise(random) * .07f) * stick * tries * (.35f + .65f * k) * Mathf.Min(1, (Pop - .03f - t) / .06f);
                }
                else if (t >= Pop)
                {
                    float p = t - Pop;
                    v += (Mathf.Sin(2 * Mathf.PI * 1100 * p) * .45f + Mathf.Sin(2 * Mathf.PI * 2300 * p) * .25f + Noise(random) * .12f) * Mathf.Exp(-p * 38);
                }
                s[i] = v;
            }
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

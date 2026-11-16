using UnityEngine;

namespace PixelVocabFlight
{
    // One-shots of the title film's cues (see TitleScene cues), made like the other story clips (22.05 kHz mono, cased in StoryClips).
    public sealed partial class FlightAudio
    {
        private static float Smooth(float u) { u = Mathf.Clamp01(u); return u * u * (3 - 2 * u); }

        // A big explosion: crack, a sub punch sinking from 60 to 40 Hz, dark noise rolling off, and a slow rumble that keeps rolling.
        private static float[] BigBoom(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(2121);
            float low = 0, rumble = 0, phase = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate;
                low += (Noise(random) - low) * Mathf.Lerp(.45f, .025f, Mathf.Clamp01(t / .6f));
                rumble += (Noise(random) - rumble) * .006f;
                phase += Mathf.Lerp(60, 40, Mathf.Clamp01(t)) / StoryRate;
                float crack = Noise(random) * Mathf.Exp(-t * 45);
                float roll = rumble * 14 * Mathf.Exp(-t * 1.4f) * (.65f + .35f * Mathf.Sin(2 * Mathf.PI * 7 * t));
                float v = crack * .5f + low * 3.5f * Mathf.Exp(-t * 2f) + roll + Mathf.Sin(2 * Mathf.PI * phase) * .9f * Mathf.Exp(-t * 2.2f);
                s[i] = Mathf.Clamp(v * .6f, -1, 1) * Mathf.Clamp01((seconds - t) / .15f);
            }
            return s;
        }

        // A fighter passing close: band-passed noise sweeping down (the Doppler fall) with an engine buzz dropping from 210 to 120 Hz.
        private static float[] Whoosh(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(2222);
            float low = 0, band = 0, phase = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, u = t / seconds;
                float envelope = Mathf.Pow(Mathf.Sin(Mathf.PI * Mathf.Pow(u, .75f)), 2);   // swells fast, peaks at about 40%, falls away
                float f = 2 * Mathf.Sin(Mathf.PI * Mathf.Lerp(2600, 500, Smooth(u)) / StoryRate);
                low += f * band;
                float high = Noise(random) - low - .3f * band;
                band += f * high;
                phase += Mathf.Lerp(210, 120, Smooth(u)) / StoryRate;
                float buzz = 0;
                for (int h = 1; h <= 5; h++) buzz += Mathf.Sin(2 * Mathf.PI * h * phase) / h;
                s[i] = Mathf.Clamp((band * .38f + buzz * .3f) * envelope, -1, 1);
            }
            return s;
        }

        // Flak bursting far away: a dry low thump with a little dull noise, no sharp edge.
        private static float[] Flak(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(2323);
            float low = 0, phase = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate;
                low += (Noise(random) - low) * .1f;
                phase += Mathf.Lerp(95, 45, Mathf.Clamp01(t / .25f)) / StoryRate;
                float v = Mathf.Sin(2 * Mathf.PI * phase) * .8f * Mathf.Exp(-t * 14) + low * 3.5f * Mathf.Exp(-t * 16) + Noise(random) * .15f * Mathf.Exp(-t * 140);
                s[i] = Mathf.Clamp(v * .8f, -1, 1) * Mathf.Clamp01((seconds - t) / .05f);
            }
            return s;
        }

        // Bullets striking metal: four short rings at slightly different pitches within 0.2 s.
        private static float[] Hit(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(2424);
            float[] at = { 0, .04f, .085f, .15f }, pitch = { 1, 1.21f, .83f, 1.1f }, level = { 1, .8f, .9f, .6f };
            for (int i = 0; i < s.Length; i++)
            {
                float v = 0;
                for (int n = 0; n < at.Length; n++)
                {
                    float t = (float)i / StoryRate - at[n];
                    if (t < 0) continue;
                    float p = pitch[n];
                    v += ((Mathf.Sin(2 * Mathf.PI * 1850 * p * t) * .4f + Mathf.Sin(2 * Mathf.PI * 3130 * p * t) * .3f + Mathf.Sin(2 * Mathf.PI * 4720 * p * t) * .18f) * Mathf.Exp(-t * 140)
                        + Noise(random) * .35f * Mathf.Exp(-t * 400)) * level[n];
                }
                s[i] = Mathf.Clamp(v * .7f, -1, 1);
            }
            return s;
        }

        // The logo hit of a trailer ("braam"): detuned sawtooth stacks on D1 and D2 (plus a fifth) through a low-pass that closes, a sub sine and
        // an impact thud, saturated, dying away over about two seconds.
        private static float[] TitleHit(float seconds)
        {
            var s = new float[(int)(StoryRate * seconds)];
            var random = new System.Random(2525);
            float[] hz = { 36.71f, 36.71f * 1.007f, 36.71f * .993f, 73.42f, 73.42f * 1.012f, 73.42f * .988f, 55f };
            float[] amp = { .5f, .4f, .4f, .35f, .3f, .3f, .25f };
            var phase = new float[hz.Length];
            float lp = 0, thud = 0;
            for (int i = 0; i < s.Length; i++)
            {
                float t = (float)i / StoryRate, saw = 0;
                for (int h = 0; h < hz.Length; h++)
                {
                    phase[h] += hz[h] / StoryRate; if (phase[h] >= 1) phase[h] -= 1;
                    saw += (2 * phase[h] - 1) * amp[h];
                }
                lp += (saw - lp) * Mathf.Lerp(.3f, .04f, Mathf.Clamp01(t / 1.8f));
                thud += (Noise(random) - thud) * .2f;
                float envelope = Mathf.Min(1, t / .012f);
                float v = lp * 1.6f * envelope * Mathf.Exp(-t * 1.2f) + Mathf.Sin(2 * Mathf.PI * 36.71f * t) * .8f * Mathf.Exp(-t * 1.1f) + thud * 2 * Mathf.Exp(-t * 18);
                s[i] = (float)System.Math.Tanh(v * 1.2f) * .85f * Mathf.Clamp01((seconds - t) / .25f);
            }
            return s;
        }
    }
}

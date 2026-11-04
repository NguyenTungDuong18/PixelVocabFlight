using System.Collections.Generic;
using UnityEngine;

namespace PixelVocabFlight
{
    public sealed class FlightAudio : MonoBehaviour
    {
        private AudioSource voice;
        private AudioSource effects;
        private readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        private readonly Queue<string> recentClips = new Queue<string>();
        private AudioClip good;
        private AudioClip wrong;
        private AudioClip pickup;
        private AudioClip missileReject;
        private AudioClip engine, lockWarning, gunfire, boost;
        public int LockWarningCount { get; private set; }
        public int EngineStarts { get; private set; }
        public int MissileRejectCount { get; private set; }
        public int PronunciationCount { get; private set; }
        public bool Muted { get; private set; }

        public void Initialize(VocabularyEntry[] entries)
        {
            voice = gameObject.AddComponent<AudioSource>();
            effects = gameObject.AddComponent<AudioSource>();
            voice.volume = 0.9f;
            effects.volume = 0.22f;
            good = Tone("Confirmed", 680, 1100, 0.17f);
            wrong = Tone("Retry", 170, 95, 0.12f);
            pickup = Tone("Pickup", 900, 1500, 0.15f);
            missileReject = Tone("Missile rejected", 290, 140, .16f);
            engine = Engine("Engine start", 5.8f);
            lockWarning = Beeps("Lock warning", 1320, 3, .07f, .05f);
            gunfire = Rattle("Enemy guns", 6, .045f);
            boost = Tone("Rocket boost", 220, 900, .45f);
        }

        public float Say(VocabularyEntry entry)
        {
            voice.Stop();
            string key = string.IsNullOrEmpty(entry.audioKey) ? entry.word : entry.audioKey;
            if (!clips.TryGetValue(key, out var clip) || !clip)
            {
                clip = Resources.Load<AudioClip>("Pronunciation/" + key);
                if (!clip) { Debug.LogWarning("Thiếu phát âm: " + entry.word); return 0.8f; }
                clips[key] = clip;
                recentClips.Enqueue(key);
                if (recentClips.Count > 32)
                {
                    string oldest = recentClips.Dequeue();
                    if (clips.TryGetValue(oldest,out var oldClip)) Resources.UnloadAsset(oldClip);
                    clips.Remove(oldest);
                }
            }
            voice.clip = clip;
            voice.Play();
            PronunciationCount++;
            return clip.length;
        }

        public void Success() => effects.PlayOneShot(good);
        public void Wrong() => effects.PlayOneShot(wrong);
        public void MissileReject() { MissileRejectCount++; effects.PlayOneShot(missileReject, .7f); }
        public void Pickup() => effects.PlayOneShot(pickup);
        public void Engine() { EngineStarts++; effects.PlayOneShot(engine, 1.4f); }
        public void LockWarning() { LockWarningCount++; effects.PlayOneShot(lockWarning, .8f); }
        public void Gunfire() => effects.PlayOneShot(gunfire, .9f);
        public void Boost() => effects.PlayOneShot(boost, .8f);
        public void Pause(bool paused) { if (paused) { voice.Pause(); effects.Pause(); } else { voice.UnPause(); effects.UnPause(); } }
        public void Stop() { voice.Stop(); effects.Stop(); }

        public void ToggleMute()
        {
            Muted = !Muted;
            voice.mute = effects.mute = Muted;
        }

        // Radial engine start: irregular coughs that settle into a steady, rising drone ("tu tu").
        private static AudioClip Engine(string name, float duration)
        {
            const int rate = 22050;
            var samples = new float[(int)(rate * duration)];
            var random = new System.Random(44);
            float phase = 0, firing = 0, humPhase = 0;
            for (int i = 0; i < samples.Length; i++)
            {
                float t = (float)i / rate, spin = Mathf.Clamp01(t / 1.3f);
                // Cylinder firings: slow uneven pops at first, then a continuous buzz.
                float rpm = Mathf.Lerp(5, 38, spin * spin);
                phase += rpm / rate;
                if (phase >= 1) { phase -= 1; firing = t < 1.1f && random.NextDouble() < .3 ? 0 : 1; }
                float pop = firing * Mathf.Exp(-phase * (t < 1.1f ? 9 : 3));
                // The drone climbs in pitch through the long take-off roll.
                float pitch = Mathf.Lerp(55, 120, spin) + 70 * Mathf.Clamp01((t - 1.3f) / 3.6f);
                humPhase += pitch / rate;
                float hum = Mathf.Sign(Mathf.Sin(humPhase * Mathf.PI * 2)) * .35f * spin;
                float noise = ((float)random.NextDouble() * 2 - 1) * .5f;
                float fade = Mathf.Clamp01((duration - t) / .6f);
                samples[i] = (pop * (.6f + noise * .6f) + hum * .5f) * .3f * fade;
            }
            var clip = AudioClip.Create(name, samples.Length, 1, rate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private static AudioClip Beeps(string name, float frequency, int count, float on, float off)
        {
            const int rate = 22050;
            var samples = new float[(int)(rate * count * (on + off))];
            for (int i = 0; i < samples.Length; i++)
            {
                float t = (float)i / rate, local = t % (on + off);
                samples[i] = local < on ? Mathf.Sign(Mathf.Sin(t * Mathf.PI * 2 * frequency)) * .2f : 0;
            }
            var clip = AudioClip.Create(name, samples.Length, 1, rate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private static AudioClip Rattle(string name, int rounds, float spacing)
        {
            const int rate = 22050;
            var samples = new float[(int)(rate * (rounds * spacing + .08f))];
            var random = new System.Random(7);
            for (int i = 0; i < samples.Length; i++)
            {
                float t = (float)i / rate, local = t % spacing;
                float envelope = t < rounds * spacing ? Mathf.Exp(-local * 90) : 0;
                samples[i] = ((float)random.NextDouble() * 2 - 1) * envelope * .3f;
            }
            var clip = AudioClip.Create(name, samples.Length, 1, rate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private static AudioClip Tone(string name, float start, float end, float duration)
        {
            const int rate = 22050;
            var samples = new float[(int)(rate * duration)];
            float phase = 0;
            for (int i = 0; i < samples.Length; i++)
            {
                float t = (float)i / samples.Length;
                phase += Mathf.Lerp(start, end, t) / rate;
                samples[i] = Mathf.Sign(Mathf.Sin(phase * Mathf.PI * 2)) * (1 - t) * 0.22f;
            }
            var clip = AudioClip.Create(name, samples.Length, 1, rate, false);
            clip.SetData(samples, 0);
            return clip;
        }
    }
}

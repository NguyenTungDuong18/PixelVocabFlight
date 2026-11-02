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
            return clip.length;
        }

        public void Success() => effects.PlayOneShot(good);
        public void Wrong() => effects.PlayOneShot(wrong);
        public void Pickup() => effects.PlayOneShot(pickup);
        public void Pause(bool paused) { if (paused) { voice.Pause(); effects.Pause(); } else { voice.UnPause(); effects.UnPause(); } }
        public void Stop() { voice.Stop(); effects.Stop(); }

        public void ToggleMute()
        {
            Muted = !Muted;
            voice.mute = effects.mute = Muted;
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

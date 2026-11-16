using System.Collections.Generic;
using UnityEngine;

namespace PixelVocabFlight
{
    // Sounds of the story, named by the ids in StoryBeat.Sounds. Loops (rain, radio, frogs, clock, drone, wind) fade
    // in and out; "-id" fades a loop away; "silence" stops every loop at once; one-shots are tin_touch, tin_open, cloth, note.
    // Clips are made in code on first use (FlightAudio.StoryClips.cs). No music, and the radio never says a clear word.
    public sealed partial class FlightAudio
    {
        private sealed class Loop { public AudioSource Source; public float Target, Rate; }

        private static readonly Dictionary<string, float> LoopVolume = new Dictionary<string, float>
        {
            { "rain", .5f }, { "radio", .3f }, { "frogs", .35f }, { "clock", .22f }, { "drone", .6f }, { "wind", .22f }, { "engines", .3f },
        };
        private readonly Dictionary<string, Loop> loops = new Dictionary<string, Loop>();
        private readonly Dictionary<string, AudioClip> storyClips = new Dictionary<string, AudioClip>();
        private AudioSource storyShot;
        // Settings volumes (0-1): master x effects scale every one-shot (voice, effects, story shots), master x ambient the loops.
        private float masterGain = 1, ambientGain = 1, effectsGain = 1;
        public float MasterGain => masterGain;
        public float AmbientGain => ambientGain;
        public float EffectsGain => effectsGain;

        public int StorySoundCount { get; private set; }
        public int ClackCount { get; private set; }
        public string LastStorySound { get; private set; } = "";
        // Test hooks: is this loop audible (target volume > 0) / what volume is it heading to.
        public bool StoryLoopOn(string id) => loops.TryGetValue(id, out var l) && l.Target > 0;
        public float StoryLoopTarget(string id) => loops.TryGetValue(id, out var l) ? l.Target : 0;
        public bool StoryLoopPlaying(string id) => loops.TryGetValue(id, out var l) && l.Source && l.Source.isPlaying;

        private void InitializeStory()
        {
            storyShot = gameObject.AddComponent<AudioSource>();
            storyShot.volume = .8f;
        }

        public void StorySound(string id)
        {
            if (string.IsNullOrEmpty(id) || storyShot == null) return;
            LastStorySound = id; StorySoundCount++;
            if (id[0] == '-') { SetLoop(id.Substring(1), 0, 1.2f); return; }
            switch (id)
            {
                case "silence": foreach (var name in new List<string>(loops.Keys)) SetLoop(name, 0, .15f); storyShot.Stop(); break;
                case "frogs_low": SetLoop("frogs", .12f, 1.5f); break;
                case "drone": SetLoop("drone", LoopVolume["drone"], 9f); break;   // swells slowly and covers the frogs
                case "burst": Shot("burst", .8f); break;
                case "boom": Shot("boom", .9f); break;
                case "bigboom": Shot("bigboom", 1f); break;
                case "whoosh": Shot("whoosh", .8f); break;
                case "flak": Shot("flak", .7f); break;
                case "hit": Shot("hit", .7f); break;
                case "title": Shot("title", 1f); break;
                case "tin_touch": Shot("tin_touch", .9f); break;
                case "tin_open": Shot("tin_open", .9f); break;
                case "cloth": Shot("cloth", .8f); break;
                case "note": Shot("note", .7f); break;
                default:
                    if (LoopVolume.TryGetValue(id, out float volume)) SetLoop(id, volume, 1.5f);
                    else Debug.LogWarning("Âm thanh truyện không biết: " + id);
                    break;
            }
        }

        // One typewriter key (Text beats in "type" style).
        public void Clack() { ClackCount++; Shot("clack", .35f); }

        // Percent values from GameSettings (applied at once, also to loops already playing).
        public void ApplyVolumes(int master, int ambient, int effectsPercent)
        {
            masterGain = Mathf.Clamp01(master / 100f); ambientGain = Mathf.Clamp01(ambient / 100f); effectsGain = Mathf.Clamp01(effectsPercent / 100f);
            if (voice) voice.volume = .9f * masterGain * effectsGain;
            if (effects) effects.volume = .22f * masterGain * effectsGain;
            if (storyShot) storyShot.volume = .8f * masterGain * effectsGain;
        }

        public void StopStory()
        {
            foreach (var loop in loops.Values) { loop.Target = 0; if (loop.Source) { loop.Source.volume = 0; loop.Source.Stop(); } }
            if (storyShot) storyShot.Stop();
        }

        private void MuteStory(bool muted)
        {
            if (storyShot) storyShot.mute = muted;
            foreach (var loop in loops.Values) if (loop.Source) loop.Source.mute = muted;
        }

        private void Shot(string id, float volume)
        {
            if (storyShot) storyShot.PlayOneShot(StoryClip(id), volume);
        }

        private void SetLoop(string id, float target, float seconds)
        {
            if (!loops.TryGetValue(id, out var loop))
            {
                if (target <= 0) return;
                var source = gameObject.AddComponent<AudioSource>();
                source.clip = StoryClip(id); source.loop = true; source.volume = 0; source.mute = Muted;
                loop = new Loop { Source = source };
                loops[id] = loop;
            }
            loop.Target = target;
            loop.Rate = Mathf.Abs(target - loop.Source.volume) / Mathf.Max(.01f, seconds);
            if (target > 0 && !loop.Source.isPlaying) loop.Source.Play();
        }

        private void Update()
        {
            foreach (var loop in loops.Values)
            {
                if (!loop.Source || !loop.Source.isPlaying) continue;
                loop.Source.volume = Mathf.MoveTowards(loop.Source.volume, loop.Target * masterGain * ambientGain, Mathf.Max(loop.Rate, .05f) * Time.unscaledDeltaTime);
                if (loop.Target <= 0 && loop.Source.volume <= 0) loop.Source.Stop();
            }
        }

        private AudioClip StoryClip(string id)
        {
            if (!storyClips.TryGetValue(id, out var clip) || !clip) { clip = BuildStoryClip(id); storyClips[id] = clip; }
            return clip;
        }
    }
}

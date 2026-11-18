using System.Collections.Generic;
using UnityEngine;

namespace PixelVocabFlight
{
    // Sounds of the story, named by the ids in StoryBeat.Sounds. Loops (rain, radio, frogs, clock, drone, wind) fade
    // in and out; "-id" fades a loop away; "silence" stops every loop at once; one-shots are tin_touch, tin_open, cloth, note.
    // Clips are made in code on first use (FlightAudio.StoryClips.cs). No music, and the radio never says a clear word.
    public sealed partial class FlightAudio
    {
        private sealed class Loop { public AudioSource Source; public float Target, Rate, Level; }   // Level: the fading volume (with master and ambient); the wind is also pressed down by the intro (CinemaDuck)

        private static readonly Dictionary<string, float> LoopVolume = new Dictionary<string, float>
        {
            { "rain", .5f }, { "radio", .3f }, { "frogs", .35f }, { "clock", .22f }, { "drone", .6f }, { "wind", CinemaMix.WindLoopVolume }, { "engines", .3f },
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
        public void ApplyVolumes(int master, int ambient, int effectsPercent, int music = GameSettings.DefaultMusic)
        {
            masterGain = Mathf.Clamp01(master / 100f); ambientGain = Mathf.Clamp01(ambient / 100f); effectsGain = Mathf.Clamp01(effectsPercent / 100f);
            musicGain = Mathf.Clamp01(music / 100f);
            if (voice) voice.volume = .9f * masterGain * effectsGain;
            if (effects) effects.volume = .22f * masterGain * effectsGain;
            if (storyShot) storyShot.volume = .8f * masterGain * effectsGain;
        }

        public void StopStory()
        {
            foreach (var loop in loops.Values) { loop.Target = 0; loop.Level = 0; if (loop.Source) { loop.Source.volume = 0; loop.Source.Stop(); } }
            if (storyShot) storyShot.Stop();
            EndCinema();
            StopMusic();     // fades out in 1.2 s
            StopMenuBed();   // fades out in 0.3 s (the loops above are cut at once)
        }

        private void MuteStory(bool muted)
        {
            MuteCinema(muted); MuteBed(muted); MuteMusic(muted);
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
            loop.Rate = Mathf.Abs(target - loop.Level) / Mathf.Max(.01f, seconds);
            if (target > 0 && !loop.Source.isPlaying) loop.Source.Play();
        }

        private void Update()
        {
            UpdateCinema(); UpdateMenuBed(); UpdateMusic();
            foreach (var pair in loops)
            {
                var loop = pair.Value;
                if (!loop.Source || !loop.Source.isPlaying) continue;
                loop.Level = Mathf.MoveTowards(loop.Level, loop.Target * masterGain * ambientGain, Mathf.Max(loop.Rate, .05f) * Time.unscaledDeltaTime);
                loop.Source.volume = loop.Level * (pair.Key == "wind" ? cinemaDuck : 1);
                if (loop.Target <= 0 && loop.Level <= 0) loop.Source.Stop();
            }
        }

        private AudioClip StoryClip(string id)
        {
            if (!storyClips.TryGetValue(id, out var clip) || !clip)
            {
                // The intro's own wind (same samples as the stems were built around) when the soundtrack is already built.
                clip = id == "wind" && cinema != null && cinema.Wind != null ? MakeStereo(id, cinema.Wind) : BuildStoryClip(id);
                storyClips[id] = clip;
            }
            return clip;
        }
    }
}

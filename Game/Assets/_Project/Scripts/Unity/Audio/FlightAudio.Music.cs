using System.Collections.Generic;
using UnityEngine;

namespace PixelVocabFlight
{
    // The title music (Audio/Music/Resources/Music/title_intro.wav, title_loop.wav; WAV 44.1 kHz stereo made by another tool, imported by
    // Editor/MusicImporter.cs). The intro (423 360 samples, 9.6 s) starts on its first beat exactly when the logo hits (the Title cue of the film)
    // and plays once; the loop (9 313 920 samples) is scheduled on the audio clock at the end of the intro, to the sample, and repeats for ever.
    // Skipping the intro before the logo starts the intro at once; skipping after it leaves the music running. The menu keeps playing it over the menu
    // bed; leaving the menu fades it out in 1.2 s; coming back from the story plays the loop from its start, fading in over 2 s. Volume: master x music
    // setting x MusicBase (x a 3 dB dip around the big blast right after the logo); mute and pause are respected. Missing files: one warning, no music.
    public sealed partial class FlightAudio
    {
        public const string MusicIntroPath = "Music/title_intro", MusicLoopPath = "Music/title_loop";
        public const int MusicIntroSamples = 423360, MusicLoopSamples = 9313920;
        private const float MusicBase = .7f, MusicFadeOut = 1.2f, MusicLead = .25f, MusicDuckGain = .708f;

        private bool musicPrepared;
        private AudioClip musicIntroClip, musicLoopClip;
        private AudioSource musicIntroSource, musicLoopSource;
        private bool musicWanted;          // a music session is running (false while it only fades out)
        private float musicLevel, musicFade = 1, musicDuck = 1, musicDuckTarget = 1, musicGain = GameSettings.DefaultMusic / 100f;
        private double musicTitleAt = -1, musicDuckFrom = -1, musicDuckTo = -1;   // film seconds: the logo hit, the dip around the big blast after it

        // Test hooks.
        public bool MusicMissing { get; private set; }
        public bool MusicWanted => musicWanted;
        public float MusicLevel => musicLevel;
        public float MusicGain => musicGain;
        public int MusicStarts { get; private set; }
        public int MusicIntroSamplesLoaded => musicIntroClip ? musicIntroClip.samples : 0;
        public int MusicLoopSamplesLoaded => musicLoopClip ? musicLoopClip.samples : 0;
        public bool MusicLoopLooping => musicLoopSource && musicLoopSource.loop;
        public bool MusicIntroPlaying => musicIntroSource && musicIntroSource.isPlaying;
        public bool MusicLoopPlaying => musicLoopSource && musicLoopSource.isPlaying;
        public float MusicIntroTime => musicIntroSource ? musicIntroSource.time : -1;
        public double MusicBeginDsp { get; private set; }    // dsp time of the intro's first sample (when it was scheduled for)
        public double MusicLoopDsp { get; private set; }     // dsp time the loop was scheduled for
        public double MusicIntroSeconds => musicIntroClip ? musicIntroClip.samples / (double)musicIntroClip.frequency : 0;
        public double MusicVolume => musicIntroSource ? musicIntroSource.volume : (musicLoopSource ? musicLoopSource.volume : 0);
        private bool HasMusic => musicIntroClip || musicLoopClip;

        // Loads the clips (once) and finds the logo hit and the big blast after it in the film's cues.
        private void PrepareMusic(IReadOnlyList<CinemaCue> cues, int fps)
        {
            if (musicPrepared) return;
            musicPrepared = true;
            if (cues != null)
            {
                foreach (var c in cues) if (c.Kind == CinemaKind.Title && (musicTitleAt < 0 || c.Time(fps) < musicTitleAt)) musicTitleAt = c.Time(fps);
                foreach (var c in cues)
                    if (c.Kind == CinemaKind.BigBoom && c.Time(fps) >= musicTitleAt - .1 && musicTitleAt >= 0 && musicDuckFrom < 0) { musicDuckFrom = c.Time(fps) - .05; musicDuckTo = c.Time(fps) + .6; }
            }
            musicIntroClip = Resources.Load<AudioClip>(MusicIntroPath); musicLoopClip = Resources.Load<AudioClip>(MusicLoopPath);
            if (musicIntroClip) musicIntroClip.LoadAudioData();
            if (musicLoopClip) musicLoopClip.LoadAudioData();
            if (!musicIntroClip || !musicLoopClip)
            {
                MusicMissing = true;
                Debug.LogWarning("Thiếu nhạc nền (" + (musicIntroClip ? "" : MusicIntroPath + " ") + (musicLoopClip ? "" : MusicLoopPath) + "): game chạy không nhạc");
            }
        }

        private void MusicSources()
        {
            if (musicIntroSource) return;
            musicIntroSource = gameObject.AddComponent<AudioSource>(); musicLoopSource = gameObject.AddComponent<AudioSource>();
            musicIntroSource.playOnAwake = musicLoopSource.playOnAwake = false;
        }

        private void StopMusicNow()
        {
            if (musicIntroSource) { musicIntroSource.Stop(); musicLoopSource.Stop(); }
            musicWanted = false; musicLevel = 0;
        }

        // From the film clock: called every frame of the intro. Schedules the intro on the audio clock a little before the logo hit and dips the music under the big blast.
        private void MusicTick(float filmTime)
        {
            musicDuckTarget = musicDuckFrom >= 0 && filmTime >= musicDuckFrom && filmTime <= musicDuckTo ? MusicDuckGain : 1;
            if (musicWanted || !HasMusic || musicTitleAt < 0 || filmTime < musicTitleAt - MusicLead) return;
            StartMusic(musicTitleAt - filmTime);
        }

        // delay: seconds until the first beat should sound (negative: it is already late, the clip starts that far in).
        private void StartMusic(double delay)
        {
            if (!HasMusic) return;
            MusicSources(); StopMusicNow();
            double wait = System.Math.Max(delay, .05), offset = wait - delay;   // PlayScheduled needs a little lead
            double begin = AudioSettings.dspTime + wait - offset;               // the dsp time of the intro's sample 0
            double introLen = musicIntroClip ? musicIntroClip.samples / (double)musicIntroClip.frequency : 0;
            musicWanted = true; musicLevel = 1; musicFade = 1; MusicStarts++;
            MusicBeginDsp = begin; MusicLoopDsp = begin + introLen;
            if (musicIntroClip && offset < introLen)
            {
                musicIntroSource.clip = musicIntroClip; musicIntroSource.loop = false; musicIntroSource.time = (float)offset;
                musicIntroSource.PlayScheduled(AudioSettings.dspTime + wait);
                if (musicLoopClip) musicIntroSource.SetScheduledEndTime(begin + introLen);
            }
            if (musicLoopClip) PlayLoop(MusicLoopDsp > AudioSettings.dspTime + .05 ? MusicLoopDsp : AudioSettings.dspTime + .05);
            ApplyMusicVolume();
        }

        private void PlayLoop(double at)
        {
            musicLoopSource.clip = musicLoopClip; musicLoopSource.loop = true; musicLoopSource.time = 0;
            musicLoopSource.PlayScheduled(at);
        }

        // Back from the story: the loop from its start, no intro, fading in.
        public void StartMenuMusic(float fadeIn)
        {
            if (!musicLoopClip) return;
            MusicSources(); StopMusicNow();
            musicWanted = true; musicLevel = 0; musicFade = Mathf.Max(.05f, fadeIn); MusicStarts++;
            MusicBeginDsp = MusicLoopDsp = AudioSettings.dspTime + .05;
            PlayLoop(MusicLoopDsp);
            ApplyMusicVolume();
        }

        public void StopMusic(float fadeOut = MusicFadeOut) { if (musicWanted) { musicWanted = false; musicFade = Mathf.Max(.05f, fadeOut); } }

        // The intro ended without the music having started (skipped before the logo, or the cue was missed): start it now.
        private void MusicIntroOver()
        {
            if (!musicWanted && HasMusic) StartMusic(.05);
        }

        private void PauseMusic(bool paused)
        {
            if (!musicIntroSource) return;
            if (paused) { musicIntroSource.Pause(); musicLoopSource.Pause(); } else { musicIntroSource.UnPause(); musicLoopSource.UnPause(); }
        }

        private void MuteMusic(bool muted) { if (musicIntroSource) musicIntroSource.mute = musicLoopSource.mute = muted; }

        private void ApplyMusicVolume()
        {
            if (!musicIntroSource) return;
            musicIntroSource.volume = musicLoopSource.volume = musicLevel * masterGain * musicGain * MusicBase * musicDuck;
            musicIntroSource.mute = musicLoopSource.mute = Muted;
        }

        private void UpdateMusic()
        {
            if (!musicIntroSource) return;
            musicLevel = Mathf.MoveTowards(musicLevel, musicWanted ? 1 : 0, Time.unscaledDeltaTime / musicFade);
            musicDuck = Mathf.MoveTowards(musicDuck, musicDuckTarget, 12 * Time.unscaledDeltaTime);
            ApplyMusicVolume();
            if (!musicWanted && musicLevel <= 0 && (musicIntroSource.isPlaying || musicLoopSource.isPlaying)) { musicIntroSource.Stop(); musicLoopSource.Stop(); }
        }
    }
}

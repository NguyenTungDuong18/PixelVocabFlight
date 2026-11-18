using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace PixelVocabFlight
{
    // The soundtrack of the title film. CinemaMix (Audio/Cinema, pure C#) bakes two stereo 44.1 kHz stems (Ambience, Effects) from the film's
    // cues on a background thread when the game starts; here they become two AudioSources that play together (PlayScheduled) and are kept
    // within 0.08 s of the film clock. The running "wind" loop stays a real loop and is pressed down by CinemaStems.Duck(film time).
    // The film itself waits on its first frame until the stems are ready (FlightGame.UpdateBoot, at most 6 s); a stem that is still not ready then joins later, at the right film time. Skipping the intro or leaving the menu fades
    // both out in 0.15 s; reaching the natural end lets the echoes ring out (the stems are 3 s longer than the intro). No statics.
    public sealed partial class FlightAudio
    {
        private const float SyncTolerance = .08f, StemFade = .15f, StemLead = .05f;

        private Task<CinemaStems> cinemaTask;
        private CinemaStems cinema;
        private bool cinemaFailed, cinemaWanted, cinemaStarted, cinemaTicked;
        private AudioClip ambienceClip, effectsClip;
        private AudioSource ambienceSource, effectsSource;
        private float cinemaFade, cinemaFilmTime, cinemaPlayhead, cinemaDuck = 1;

        // Test hooks.
        public CinemaStems Cinema => cinema;
        public bool CinemaReady => cinema != null;
        public bool CinemaFailed => cinemaFailed;
        public bool CinemaPending => cinemaTask != null && cinema == null && !cinemaFailed;   // being built: the film waits (FlightGame.UpdateBoot)
        public float CinemaReadySeconds { get; private set; } = -1;   // from asking for the stems until they were ready (-1: not yet)
        public bool CinemaPlaying => cinemaStarted && cinemaWanted && cinema != null && cinemaPlayhead < cinema.Seconds;
        public bool CinemaStemsActive => cinemaStarted;   // the sources exist and are playing or fading out
        public int CinemaStarts { get; private set; }
        public int CinemaResyncs { get; private set; }
        public float CinemaFade => cinemaFade;
        public float CinemaDuck => cinemaDuck;
        public float CinemaSourceTime => ambienceSource ? ambienceSource.time : -1;
        public float CinemaPlayhead => cinemaPlayhead;
        public bool CinemaSourcesPlaying => ambienceSource && effectsSource && ambienceSource.isPlaying && effectsSource.isPlaying;

        // Builds the stems on a worker thread (once). The cue list is copied: the thread never touches game objects.
        public void PrepareIntro(IReadOnlyList<CinemaCue> cues, int fps, float introSeconds)
        {
            PrepareMusic(cues, fps);   // the title music: clips and the film time of the logo hit
            if (cinemaTask != null || cinema != null || cues == null || cues.Count == 0) return;
            var copy = new List<CinemaCue>(cues.Count);
            foreach (var c in cues) copy.Add(new CinemaCue(c.Kind, c.Frame, c.Pan, c.Level, c.Dur));
            var watch = System.Diagnostics.Stopwatch.StartNew();
            var raw = sharedBank == null ? LoadBankFiles() : null;   // only the bytes are read here; parsing and mixing happen on the worker
            cinemaLoadSeconds = watch.Elapsed.TotalSeconds; cinemaAskedAt = Time.realtimeSinceStartup;
            cinemaTask = Task.Run(() =>
            {
                var worker = System.Diagnostics.Stopwatch.StartNew();
                var bank = sharedBank ?? CinemaBank.FromBytes(raw);
                string problems = bank.Problems();
                if (problems.Length > 0) throw new System.IO.InvalidDataException("bộ mẫu âm thanh phim thiếu: " + problems);
                sharedBank = bank;
                cinemaParseSeconds = worker.Elapsed.TotalSeconds; worker.Restart();
                var stems = CinemaMix.Render(copy, fps, introSeconds, bank);
                cinemaRenderSeconds = worker.Elapsed.TotalSeconds;
                return stems;
            });
        }

        private double cinemaLoadSeconds, cinemaParseSeconds, cinemaRenderSeconds;   // measured for the log line (written on the worker before the task completes)
        private float cinemaAskedAt;

        // The recordings of the intro (Audio/SFX/Cinema/Resources/CinemaSfx/*.bytes, WAV files). Pure data, so it may outlive a play session.
        private static volatile CinemaBank sharedBank;
        public const string BankFolder = "CinemaSfx";

        private static List<KeyValuePair<string, byte[]>> LoadBankFiles()
        {
            var list = new List<KeyValuePair<string, byte[]>>();
            foreach (var asset in Resources.LoadAll<TextAsset>(BankFolder))
            {
                list.Add(new KeyValuePair<string, byte[]>(asset.name, asset.bytes));
                Resources.UnloadAsset(asset);
            }
            return list;
        }

        // The bank for the story sounds (the wind loop and the old intro ids) made on the main thread at first use, unless the intro already built it.
        private static CinemaBank StoryBank()
        {
            if (sharedBank != null) return sharedBank;
            try
            {
                var bank = CinemaBank.FromBytes(LoadBankFiles());
                string problems = bank.Problems();
                if (problems.Length > 0) { Debug.LogWarning("Bộ mẫu âm thanh phim thiếu: " + problems); return null; }
                return sharedBank = bank;
            }
            catch (System.Exception e) { Debug.LogWarning("Không đọc được bộ mẫu âm thanh phim: " + e.Message); return null; }
        }

        // Test hooks for the bank.
        public static bool CinemaBankLoaded => sharedBank != null;
        public static CinemaBank CinemaBankForTest => sharedBank;

        // Called every frame while the intro plays (film time in seconds).
        public void IntroTick(float filmTime)
        {
            cinemaWanted = true; cinemaFilmTime = filmTime; cinemaPlayhead = filmTime; cinemaTicked = true;
            cinemaDuck = cinema != null ? cinema.Duck(filmTime) : 1;
            MusicTick(filmTime);
            TryStartStems();   // the very frame the film runs, so the sound starts with the first picture
            if (!cinemaStarted || !ambienceSource || !ambienceSource.isPlaying) return;
            if (Mathf.Abs(ambienceSource.time - filmTime) > SyncTolerance)
            {
                float at = Mathf.Clamp(filmTime, 0, ambienceClip.length - .02f);
                ambienceSource.time = at; effectsSource.time = at; CinemaResyncs++;
            }
        }

        // The intro is over. Skipped: fade the stems out. Played to the end: they ring out (and never start if they were not built in time).
        // The menu bed takes over: after the natural end it swells in under the echoes (and the intro's wind loop fades out), after a skip it is there at once.
        public void IntroEnded(bool skipped)
        {
            cinemaDuck = 1; musicDuckTarget = 1;
            if (skipped || !cinemaStarted) cinemaWanted = false;
            MusicIntroOver();   // skipped before the logo: the music starts now; otherwise it is already running
            StartMenuBed(skipped ? .4f : 2.5f);
            SetLoop("wind", 0, skipped ? .4f : 2.5f);
        }

        private void EndCinema() { cinemaDuck = 1; cinemaWanted = false; }

        private void MuteCinema(bool muted)
        {
            if (ambienceSource) ambienceSource.mute = muted;
            if (effectsSource) effectsSource.mute = muted;
        }

        private void UpdateCinema()
        {
            if (cinema == null && !cinemaFailed && cinemaTask != null && cinemaTask.IsCompleted)
            {
                if (cinemaTask.IsFaulted) { cinemaFailed = true; Debug.LogWarning("Không dựng được âm thanh phim mở màn: " + cinemaTask.Exception?.GetBaseException().Message); }
                else
                {
                    cinema = cinemaTask.Result;
                    ambienceClip = MakeStereo("Intro ambience", cinema.Ambience); effectsClip = MakeStereo("Intro effects", cinema.Effects);
                    CinemaReadySeconds = Time.realtimeSinceStartup - cinemaAskedAt;
                    Debug.Log("Âm thanh phim mở màn sẵn sàng sau " + CinemaReadySeconds.ToString("0.00") + " s (đọc file " + cinemaLoadSeconds.ToString("0.00") + " s trên luồng chính, parse bộ mẫu "
                        + cinemaParseSeconds.ToString("0.00") + " s, dựng stem " + cinemaRenderSeconds.ToString("0.00") + " s trên luồng nền)");
                    StartBedKit();   // the menu bed's material is made while the intro plays
                }
            }
            if (!cinemaTicked && cinemaStarted) cinemaPlayhead += Time.unscaledDeltaTime;   // after the natural end nobody ticks: follow the clock
            cinemaTicked = false;
            if (cinema == null) return;
            TryStartStems();
            cinemaFade = Mathf.MoveTowards(cinemaFade, cinemaWanted ? 1 : 0, Time.unscaledDeltaTime / StemFade);
            if (!cinemaStarted) return;
            ambienceSource.volume = cinemaFade * masterGain * ambientGain;
            effectsSource.volume = cinemaFade * masterGain * effectsGain;
            if ((!cinemaWanted && cinemaFade <= 0) || cinemaPlayhead >= cinema.Seconds) StopStems();
        }

        private void TryStartStems()
        {
            if (cinema != null && cinemaWanted && !cinemaStarted && cinemaFilmTime < cinema.Seconds - 3) StartStems();
        }

        private void StartStems()
        {
            if (!ambienceSource) { ambienceSource = gameObject.AddComponent<AudioSource>(); effectsSource = gameObject.AddComponent<AudioSource>(); }
            ambienceSource.clip = ambienceClip; effectsSource.clip = effectsClip;
            ambienceSource.loop = effectsSource.loop = false;
            ambienceSource.volume = effectsSource.volume = 0;
            ambienceSource.mute = effectsSource.mute = Muted;
            float offset = Mathf.Clamp(cinemaFilmTime + StemLead, 0, ambienceClip.length - .02f);
            ambienceSource.time = effectsSource.time = offset;
            double when = AudioSettings.dspTime + StemLead;
            ambienceSource.PlayScheduled(when); effectsSource.PlayScheduled(when);
            cinemaStarted = true; cinemaFade = 1; cinemaPlayhead = cinemaFilmTime; CinemaStarts++;   // nothing was sounding, so no fade-in is needed
            ambienceSource.volume = masterGain * ambientGain; effectsSource.volume = masterGain * effectsGain;
        }

        private void StopStems()
        {
            if (ambienceSource) { ambienceSource.Stop(); effectsSource.Stop(); }
            cinemaStarted = false; cinemaFade = 0;
        }
    }
}

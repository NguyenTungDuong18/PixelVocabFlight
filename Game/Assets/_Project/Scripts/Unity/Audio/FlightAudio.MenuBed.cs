using System.Threading.Tasks;
using UnityEngine;

namespace PixelVocabFlight
{
    // The sound behind the main menu (after the intro and when coming back from the story): CinemaMenuBed (Audio/Cinema, pure C#) mixes it
    // on the audio thread, forever and without a loop you can hear (wind pieces cross-fading, a far bomber hum, far flak and blasts at random
    // times); here it is one streaming AudioClip on one AudioSource on the ambient bus (master x ambient volume, mute, pause). Its material
    // (Kit) is made on a worker thread as soon as the intro's stems are built. Starting it fades in; StopStory() fades it out in 0.3 s.
    // If the material cannot be made the old wind loop plays instead. No statics (Domain Reload is off).
    public sealed partial class FlightAudio
    {
        private const float BedFadeOut = .3f;

        private Task<CinemaMenuBed.Kit> bedKitTask;
        private CinemaMenuBed.Kit bedKit;
        private bool bedKitFailed, bedWanted, bedFallback;
        private AudioSource bedSource;
        private AudioClip bedClip;
        private volatile CinemaMenuBed bedEngine;   // read by the audio thread; replaced on the main thread only
        private float bedLevel, bedFade = 1;

        // Test hooks.
        public bool MenuBedWanted => bedWanted;
        public bool MenuBedPlaying => bedWanted && bedSource && bedSource.isPlaying && bedEngine != null;
        public float MenuBedLevel => bedLevel;
        public bool MenuBedFailed => bedKitFailed;
        public double MenuBedSeconds => bedEngine != null ? bedEngine.Seconds : 0;   // how long the audio thread has mixed it (0 = no sound device pulls)
        public int MenuBedEvents => bedEngine != null ? bedEngine.EventCount : 0;
        public int MenuBedWindChanges => bedEngine != null ? bedEngine.WindChanges : 0;
        public int MenuBedStarts { get; private set; }

        // fadeIn: seconds from silence to full.
        public void StartMenuBed(float fadeIn)
        {
            bedWanted = true; bedFade = Mathf.Max(.05f, fadeIn);
            if (bedKit == null && bedKitTask == null) StartBedKit();
        }

        public void StopMenuBed(float fadeOut = BedFadeOut) { if (bedWanted) bedFade = Mathf.Max(.05f, fadeOut); bedWanted = false; }

        // Makes the material on a worker thread: from the bank the intro already built, or from the bank files if there was no intro.
        private void StartBedKit()
        {
            if (bedKitTask != null || bedKit != null) return;
            var bank = sharedBank; var raw = bank == null ? LoadBankFiles() : null;
            int seed = unchecked((int)System.DateTime.UtcNow.Ticks) ^ System.Environment.TickCount;
            bedKitTask = Task.Run(() =>
            {
                bank ??= CinemaBank.FromBytes(raw);
                string problems = bank.Problems();
                if (problems.Length > 0) throw new System.IO.InvalidDataException("bộ mẫu âm thanh phim thiếu: " + problems);
                sharedBank = bank;
                return CinemaMenuBed.Prepare(bank, seed);
            });
        }

        private void PauseBed(bool paused)
        {
            if (!bedSource) return;
            if (paused) bedSource.Pause(); else bedSource.UnPause();
        }

        private void MuteBed(bool muted) { if (bedSource) bedSource.mute = muted; }

        private void UpdateMenuBed()
        {
            if (bedKit == null && bedKitTask != null && bedKitTask.IsCompleted && !bedKitFailed)
            {
                if (bedKitTask.IsFaulted) { bedKitFailed = true; Debug.LogWarning("Không dựng được nền âm thanh menu: " + bedKitTask.Exception?.GetBaseException().Message); }
                else bedKit = bedKitTask.Result;
            }
            if (bedWanted && bedKitFailed && !bedFallback) { bedFallback = true; SetLoop("wind", LoopVolume["wind"], 1.5f); }   // no bed: the plain wind loop
            if (!bedWanted) bedFallback = false;
            if (bedWanted && bedKit != null && bedEngine == null) BeginBed();
            float target = bedWanted && bedEngine != null ? 1 : 0;
            bedLevel = Mathf.MoveTowards(bedLevel, target, Time.unscaledDeltaTime / bedFade);
            if (bedSource) bedSource.volume = bedLevel * masterGain * ambientGain;
            if (!bedWanted && bedLevel <= 0 && bedEngine != null) { bedEngine = null; bedSource.Stop(); }
        }

        private void BeginBed()
        {
            int rate = AudioSettings.outputSampleRate;
            if (!bedSource)
            {
                bedSource = gameObject.AddComponent<AudioSource>();
                bedSource.loop = true; bedSource.playOnAwake = false;
            }
            if (!bedClip || bedClip.frequency != rate)
                bedClip = AudioClip.Create("Menu bed", rate * 60, 2, rate, true, ReadBed);   // streamed: ReadBed is called on the audio thread, over and over
            bedSource.clip = bedClip; bedSource.volume = 0; bedSource.mute = Muted;
            bedLevel = 0;
            bedEngine = new CinemaMenuBed(bedKit, unchecked((int)System.DateTime.UtcNow.Ticks * 31) ^ System.Environment.TickCount, rate);
            bedSource.Play();
            MenuBedStarts++;
        }

        // Audio thread: no Unity API here.
        private void ReadBed(float[] data)
        {
            var engine = bedEngine;
            if (engine == null) { System.Array.Clear(data, 0, data.Length); return; }
            engine.Mix(data, data.Length / 2);
        }
    }
}

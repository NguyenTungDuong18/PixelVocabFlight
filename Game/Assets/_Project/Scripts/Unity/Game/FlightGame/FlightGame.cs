using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame : MonoBehaviour
    {
        // Base = walkable airbase (main screen). Vocabulary = word-set screen opened from the professor.
        private enum Mode { Base, Vocabulary, Launching, Intro, Flying, Paused, Dying, Results, Error }
        public const float IntroSeconds = 1.4f;
        private float introTime;
        private VocabularyEntry[] launchPool;
        private Mode mode;
        private VocabularyCatalog catalog;
        private ProfileStore profile;
        private FlightAudio audioPlayer;
        private FlightView view;
        private ContinuousFlight flight;
        private FlightProgress progress = new FlightProgress();
        private Keyboard keyboard;
        private string typed = "", bestKey;
        private VocabularyFilter selection = new VocabularyFilter();
        private int previewPage, firstTry;
        private VocabularyEntry[] flightPool;
        private float nextSubmit, nextBackspace, voiceRemaining, endingTimer, blipTimer;
        private int seenSteps;
        private readonly Queue<VocabularyEntry> speech = new Queue<VocabularyEntry>();
        private readonly List<VocabularyEntry> reviewWords = new List<VocabularyEntry>();
        private readonly HashSet<string> mistakes = new HashSet<string>();
        private bool smokeMode;
        // Base (0.15): missions, the walkable world and the dialogue walker. Rules live in Scripts/World.
        private MissionLog missions;
        private BaseWorld world;
        private DialogueRunner dialogue;
        public FlightEnvironment StartingEnvironment { get; private set; } = FlightEnvironment.Jungle;

        private void Start()
        {
            Application.targetFrameRate = 60; QualitySettings.vSyncCount = 0;
            view = new FlightView(this);
            try
            {
                smokeMode = Array.IndexOf(System.Environment.GetCommandLineArgs(), "--smoke-test") >= 0;
                if (smokeMode) { Application.runInBackground = true; InputSystem.settings.backgroundBehavior = InputSettings.BackgroundBehavior.IgnoreFocus; }
                catalog = new VocabularyCatalog(); profile = new ProfileStore(smokeMode);
                StartingEnvironment = (FlightEnvironment)Mathf.Clamp(profile.Profile.startingEnvironment, 0, 3);
                selection = profile.Profile.selection ?? new VocabularyFilter();
                selection.topics = selection.topics ?? Array.Empty<string>();
                selection.minimumLevel = Mathf.Clamp(selection.minimumLevel, 0, 4);
                selection.maximumLevel = Mathf.Clamp(selection.maximumLevel, selection.minimumLevel, 4);
                if (profile.Profile.fullLibraryVersion < 1)
                {
                    profile.Profile.selectionBeforeFullLibrary = profile.Profile.selection;
                    selection = new VocabularyFilter { to = catalog.Entries.Length };
                    profile.Profile.selection = selection; profile.Profile.fullLibraryVersion = 1; profile.Save();
                }
                if (selection.to == int.MaxValue) selection.to = catalog.Filter(selection).Length;
                missions = new MissionLog(BaseContent.Missions) { Completed = Math.Max(0, profile.Profile.missionsCompleted), LastScore = Math.Max(0, profile.Profile.lastScore) };
                world = new BaseWorld(AirbaseMap.Create(), missions);
                dialogue = new DialogueRunner(BaseContent.Dialogues);
                view.Base.Build(world);
                audioPlayer = gameObject.AddComponent<FlightAudio>(); audioPlayer.Initialize(catalog.Entries);
                keyboard = smokeMode ? InputSystem.AddDevice<Keyboard>("Wordwing QA keyboard") : Keyboard.current;
                if (keyboard != null) keyboard.onTextInput += ReceiveCharacter;
                EnterBase(true, false);
                if (smokeMode) StartCoroutine(SmokeTest());
            }
            catch (Exception exception) { SetMode(Mode.Error); view.ShowError(exception.Message); Debug.LogException(exception); if (smokeMode) Application.Quit(1); }
        }

        private void OnDestroy() { if (keyboard != null) keyboard.onTextInput -= ReceiveCharacter; Time.timeScale = 1; Cursor.visible = true; }
        private void OnApplicationFocus(bool focused) { if (!focused && mode == Mode.Flying && !smokeMode) TogglePause(); }

        // The base is only drawn (and only takes input) in Mode.Base.
        private void SetMode(Mode value) { mode = value; if (view != null) view.Base.Visible = value == Mode.Base; }

        private bool Pressed(params Key[] keys)
        {
            if (keyboard == null) return false;
            foreach (var key in keys) if (keyboard[key].wasPressedThisFrame) return true;
            return false;
        }

        private bool Held(params Key[] keys)
        {
            if (keyboard == null) return false;
            foreach (var key in keys) if (keyboard[key].isPressed) return true;
            return false;
        }

        private void Update()
        {
            if (view == null) return;
            bool escape = keyboard != null && keyboard.escapeKey.wasPressedThisFrame;
            if (mode == Mode.Base) { UpdateBase(escape); return; }
            if (escape) TogglePause();
            if (mode == Mode.Vocabulary || mode == Mode.Error) return;
            if (mode == Mode.Results)
            {
                view.Board.Animate(Time.unscaledDeltaTime, null, StartingEnvironment);
                // Results: Enter (or the button) reports back and returns to the base.
                if (Time.unscaledTime >= nextSubmit && Pressed(Key.Enter, Key.NumpadEnter)) CompleteSortie();
                return;
            }
            if (mode == Mode.Launching)
            {
                view.Board.Animate(Time.unscaledDeltaTime, null, StartingEnvironment);
                if (view.AnimateTakeOff(Time.unscaledDeltaTime)) BeginFlight(launchPool);
                return;
            }
            if (mode == Mode.Intro)
            {
                // The sortie clock does not run while the fighter climbs into position.
                // Capped step: the hitch right after loading the sortie must not skip the climb-in.
                introTime += Mathf.Min(Time.deltaTime, 1 / 30f);
                view.AnimateIntro(introTime / IntroSeconds);
                view.Board.Animate(Time.deltaTime, flight, StartingEnvironment);
                view.SetInput(typed, !flight.Driving); view.Refresh(flight);
                if (introTime >= IntroSeconds) { view.FinishIntro(); SetMode(Mode.Flying); nextSubmit = Time.unscaledTime + .1f; }
                return;
            }
            if (mode == Mode.Dying)
            {
                view.Board.Animate(Time.deltaTime, flight, StartingEnvironment); endingTimer -= Time.deltaTime;
                if (endingTimer <= 0) EndFlight(); return;
            }
            if (mode != Mode.Flying) return;
            if (keyboard != null && keyboard.tabKey.wasPressedThisFrame) ToggleControlMode();
            flight.MovePlayer(view.Board.PointerX(flight.PlayerX));
            Cursor.visible = !flight.Driving || !view.Board.PointerOverField || view.Board.PointerOverMissile;
            flight.Tick(Time.deltaTime);
            DrainEvents();
            view.Board.Animate(Time.deltaTime, flight, StartingEnvironment);
            if (progress.IsOver)
            {
                view.Refresh(flight);
                if (progress.Health <= 0) { SetMode(Mode.Dying); endingTimer = .7f; Cursor.visible = true; }
                else EndFlight();
                return;
            }
            if (!flight.Driving && !view.PartOfSpeechOpen)
            {
                HandleEditing();
                if (keyboard != null && (keyboard.enterKey.wasPressedThisFrame || keyboard.numpadEnterKey.wasPressedThisFrame)) Submit();
            }
            voiceRemaining -= Time.deltaTime;
            if (voiceRemaining <= 0 && speech.Count > 0) voiceRemaining = audioPlayer.Say(speech.Dequeue()) + .15f;
            view.SetInput(typed, !flight.Driving);
            view.Refresh(flight);
        }
    }
}

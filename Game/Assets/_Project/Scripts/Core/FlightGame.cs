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
        private enum Mode { Menu, Flying, Paused, Dying, Results, Error }
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
        private float nextSubmit, nextBackspace, voiceRemaining, endingTimer;
        private readonly Queue<VocabularyEntry> speech = new Queue<VocabularyEntry>();
        private readonly List<VocabularyEntry> reviewWords = new List<VocabularyEntry>();
        private readonly HashSet<string> mistakes = new HashSet<string>();
        private bool smokeMode;
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
                audioPlayer = gameObject.AddComponent<FlightAudio>(); audioPlayer.Initialize(catalog.Entries);
                keyboard = smokeMode ? InputSystem.AddDevice<Keyboard>("Wordwing QA keyboard") : Keyboard.current;
                if (keyboard != null) keyboard.onTextInput += ReceiveCharacter;
                ReturnToMenu();
                if (smokeMode) StartCoroutine(SmokeTest());
            }
            catch (Exception exception) { mode = Mode.Error; view.ShowError(exception.Message); Debug.LogException(exception); if (smokeMode) Application.Quit(1); }
        }

        private void OnDestroy() { if (keyboard != null) keyboard.onTextInput -= ReceiveCharacter; Time.timeScale = 1; Cursor.visible = true; }
        private void OnApplicationFocus(bool focused) { if (!focused && mode == Mode.Flying && !smokeMode) TogglePause(); }

        private void Update()
        {
            if (view == null) return;
            if (keyboard != null && keyboard.escapeKey.wasPressedThisFrame) TogglePause();
            if (mode == Mode.Menu || mode == Mode.Results)
            { view.Board.Animate(Time.unscaledDeltaTime, null, StartingEnvironment); view.AnimateHangar(Time.unscaledDeltaTime, StartingEnvironment); return; }
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
                if (progress.Health <= 0) { mode = Mode.Dying; endingTimer = .7f; Cursor.visible = true; }
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
            view.SetInput(typed, !flight.Driving && flight.Target != null);
            view.Refresh(flight);
        }

        private void HandleEditing()
        {
            if (keyboard == null) return;
            if (keyboard.ctrlKey.isPressed && keyboard.aKey.wasPressedThisFrame) typed = "";
            if (keyboard.backspaceKey.wasPressedThisFrame) { Backspace(); nextBackspace = Time.unscaledTime + .42f; }
            else if (keyboard.backspaceKey.isPressed && Time.unscaledTime >= nextBackspace) { Backspace(); nextBackspace = Time.unscaledTime + .05f; }
        }
        private void Backspace() { if (typed.Length > 0) typed = typed.Substring(0, typed.Length - 1); }
        private void ReceiveCharacter(char value)
        {
            if (mode != Mode.Flying || flight == null || flight.Driving || flight.Target == null || view.PartOfSpeechOpen || typed.Length >= 40) return;
            if (keyboard != null && (keyboard.ctrlKey.isPressed || keyboard.leftMetaKey.isPressed || keyboard.rightMetaKey.isPressed)) return;
            if (char.IsLetterOrDigit(value) || value == ' ' || value == '-' || value == '\'' || value == '.') typed += value;
        }

        public void ChooseStartingEnvironment(int index) { StartingEnvironment = (FlightEnvironment)Mathf.Clamp(index, 0, 3); profile.Profile.startingEnvironment = (int)StartingEnvironment; profile.Save(); ShowHangar(); }
        public void OpenVocabulary() => ShowMenu();
        public void ChooseCollection(string collection) { selection.collection = collection; ResetSelectionRange(); }
        public void SelectFullOxford() { selection = new VocabularyFilter { to = catalog.Entries.Length }; previewPage = 0; SaveSelection(); ShowMenu(); }
        public void ChooseLevel(bool minimum, int value)
        {
            if (minimum) { selection.minimumLevel = value; selection.maximumLevel = Math.Max(value, selection.maximumLevel); }
            else { selection.maximumLevel = value; selection.minimumLevel = Math.Min(value, selection.minimumLevel); }
            ResetSelectionRange();
        }
        public void ToggleTopic(string topic)
        {
            var topics = selection.topics.ToList();
            if (topic == "all") topics.Clear(); else if (topics.Contains(topic)) topics.Remove(topic); else topics.Add(topic);
            selection.topics = topics.ToArray(); ResetSelectionRange();
        }
        public void ChooseRangeSize(int size) { selection.from = 1; selection.to = Math.Min(size, catalog.Filter(selection).Length); previewPage = 0; SaveSelection(); ShowMenu(); }
        private void ResetSelectionRange() { selection.from = 1; selection.to = catalog.Filter(selection).Length; previewPage = 0; SaveSelection(); ShowMenu(); }
        private void SaveSelection() { profile.Profile.selection = selection; profile.Save(); }
        public void ApplyMenuSearch() { if (view.Setup == null) return; selection.search = view.Setup.Search.text.Trim(); ResetSelectionRange(); }
        private bool ReadRange(out string error)
        {
            error = null; int from = selection.from, to = selection.to;
            if (view.Setup != null && (!int.TryParse(view.Setup.From.text, out from) || !int.TryParse(view.Setup.To.text, out to))) { error = "Hãy nhập hai số thứ tự hợp lệ."; return false; }
            try { VocabularyQuery.Range(catalog.Filter(selection), from, to); }
            catch (ArgumentException exception) { error = exception.Message; return false; }
            selection.from = from; selection.to = to; return true;
        }
        public void ApplyMenuRange() { if (!ReadRange(out var error)) { ShowMenu(error); return; } previewPage = (selection.from - 1) / 8; SaveSelection(); ShowMenu(); }
        public void ChangePreviewPage(int amount) { previewPage = Mathf.Clamp(previewPage + amount, 0, Math.Max(0, (catalog.Filter(selection).Length - 1) / 8)); ShowMenu(); }
        public void ShowVocabularyCredits() => view.ShowCredits();
        private void ShowMenu(string error = null) => view.ShowMenu(catalog, selection, catalog.Filter(selection), previewPage, error);
        private void ShowHangar() => view.ShowHangar(selection, catalog.Filter(selection).Length, StartingEnvironment);

        public void ReturnToMenu()
        {
            mode = Mode.Menu; Time.timeScale = 1; Cursor.visible = true; typed = "";
            audioPlayer?.Stop(); speech.Clear(); view.Board.Clear(); flight = null; ShowHangar();
        }

        public void StartFlight()
        {
            if (catalog == null || mode == Mode.Error) return;
            if (view.Setup != null && view.Setup.Search.text.Trim() != (selection.search ?? "")) { ApplyMenuSearch(); return; }
            if (!ReadRange(out var error)) { ShowMenu(error); return; }
            var pool = VocabularyQuery.Range(catalog.Filter(selection), selection.from, selection.to);
            string poolError = ValidateFlightPool(pool);
            if (poolError != null) { ShowMenu(poolError); return; }
            audioPlayer.Stop(); speech.Clear(); voiceRemaining = 0; Time.timeScale = 1;
            // New rules have a separate leaderboard from the old three-aircraft waves.
            bestKey = "collision-v2:" + StartingEnvironment + ":" + VocabularyQuery.SelectionKey(pool);
            flightPool = pool; SaveSelection();
            flight = new ContinuousFlight(pool, System.Environment.TickCount, StartingEnvironment);
            progress = flight.Progress; firstTry = 0; mistakes.Clear(); reviewWords.Clear(); typed = "";
            mode = Mode.Flying; view.Board.Clear(); view.Board.SetEnvironment(StartingEnvironment);
            view.NewFlight((selection.collection == "oxford3000" ? "OXFORD 3000" : "OXFORD 5000") + " / " + pool.Length + " MỤC");
            DrainEvents(); view.Refresh(flight); nextSubmit = Time.unscaledTime + .2f;
            EventSystem.current?.SetSelectedGameObject(null);
        }

        public static string ValidateFlightPool(VocabularyEntry[] pool)
        {
            string error = QuestionDeck.ValidatePool(pool); if (error != null) return error;
            // A four-choice missile must never introduce vocabulary outside the user's selection.
            var choices = new List<VocabularyEntry>();
            foreach (var entry in pool) { if (choices.All(e => QuestionDeck.DistinctAnswers(e, entry))) choices.Add(entry); if (choices.Count == 4) return null; }
            return "Cần ít nhất 4 từ phân biệt để tạo bốn lựa chọn tên lửa. Hãy mở rộng khoảng từ.";
        }

        public void ToggleControlMode()
        {
            if (mode != Mode.Flying) return;
            flight.SetDriving(!flight.Driving); typed = "";
            view.Feedback(flight.Driving ? "LÁI: rê chuột trái/phải để đón R+. Tab để chuyển sang bắn." : "BẮN: máy bay đứng yên. Gõ từ + Enter; chọn từ loại nếu là máy bay sa mạc.");
            EventSystem.current?.SetSelectedGameObject(null); view.Refresh(flight);
        }

        public void RollMeaning()
        {
            if (mode != Mode.Flying) return;
            if (!flight.Roll()) view.Feedback(flight.Rolls <= 0 ? "Hết lượt đổi. Lái máy bay đón icon R+ để nhận thêm." : "Cần ít nhất hai máy bay để đổi nghĩa.", true);
            else { DrainEvents(); view.Feedback("Đã đổi nghĩa. Máy bay cũ vẫn còn trên màn hình."); }
            EventSystem.current?.SetSelectedGameObject(null);
        }

        public void Submit()
        {
            if (mode != Mode.Flying || flight.Driving || view.PartOfSpeechOpen || Time.unscaledTime < nextSubmit || GameRules.Normalize(typed).Length == 0) return;
            nextSubmit = Time.unscaledTime + .25f; EventSystem.current?.SetSelectedGameObject(null);
            bool hit = flight.Submit(typed, view.SelectedPartOfSpeech);
            if (hit) typed = "";
            DrainEvents(); view.Refresh(flight);
        }

        public void AnswerMissile(int id, int choice)
        {
            if (mode != Mode.Flying) return;
            flight.AnswerMissile(id, choice); DrainEvents(); view.Refresh(flight);
            EventSystem.current?.SetSelectedGameObject(null);
        }

        private void DrainEvents()
        {
            FlightEvent ev;
            while ((ev = flight.PopEvent()) != null)
            {
                switch (ev.Kind)
                {
                    case FlightEventKind.Retarget: typed = ""; view.SetQuestion(ev.Entry, flight.TargetChanges); break;
                    case FlightEventKind.Wrong:
                    case FlightEventKind.MissileWrong:
                        if (ev.Entry != null) { mistakes.Add(ev.Entry.id); if (!reviewWords.Any(e => e.id == ev.Entry.id)) reviewWords.Add(ev.Entry); }
                        if (ev.Kind == FlightEventKind.MissileWrong) { view.Board.FlashMissile(ev.EntityId); audioPlayer.MissileReject(); }
                        else audioPlayer.Wrong();
                        view.Feedback("Chưa đúng. Kiểm tra từ, từ loại hoặc lựa chọn tên lửa.", true); break;
                    case FlightEventKind.Hit:
                        view.Board.Hit(ev.X, ev.Y, ev.Value == 0, flight.PlayerX);
                        if (ev.Value > 0) { audioPlayer.Success(); view.Feedback("Đã phá khiên băng. Nghĩa chuyển sang một máy bay khác."); }
                        break;
                    case FlightEventKind.Kill:
                        bool first = !mistakes.Contains(ev.Entry.id); if (first) firstTry++;
                        view.Log(ev.Entry, true); audioPlayer.Success();
                        if (ev.ShouldPronounce) speech.Enqueue(ev.Entry);
                        profile.Record(ev.Entry, true, first, bestKey, progress.Score);
                        view.Feedback(ev.Entry.word + "  +" + ev.Value + " điểm"); break;
                    case FlightEventKind.Pickup:
                        audioPlayer.Pickup(); view.Feedback(ev.Supply == SupplyKind.Roll ? "Đón R+ thành công: +1 lượt đổi nghĩa." : ev.Supply == SupplyKind.Fuel ? "+50 xăng" : "+1 kim loại / hồi 1 máu (tối đa 5)"); break;
                    case FlightEventKind.MissileBlast:
                        view.Board.Blast(ev.X, ev.Y); audioPlayer.Success(); view.Feedback("Tên lửa nổ! Máy bay trong vòng nổ bị hạ, kể cả còn khiên."); break;
                    case FlightEventKind.MissileFailure:
                        view.Feedback("Sai 3 lần: tên lửa tăng tốc! Sang LÁI để né; trúng mất 2 kim loại.", true); break;
                    case FlightEventKind.AircraftImpact:
                    case FlightEventKind.MissileImpact:
                        view.Board.Burst(ev.X, ev.Y, UiKit.Coral, 20); audioPlayer.Wrong();
                        view.Feedback((ev.Kind == FlightEventKind.MissileImpact ? "Tên lửa trúng!" : "Máy bay địch đâm trúng!") + " −" + ev.Value + " kim loại / còn " + progress.Metal + "/5 máu.", true);
                        if (ev.Entry != null && !reviewWords.Any(e => e.id == ev.Entry.id)) reviewWords.Add(ev.Entry);
                        break;
                }
            }
        }

        public void TogglePause()
        {
            if (mode == Mode.Flying) { mode = Mode.Paused; Time.timeScale = 0; Cursor.visible = true; audioPlayer.Pause(true); view.ShowPause(); }
            else if (mode == Mode.Paused) { mode = Mode.Flying; Time.timeScale = 1; audioPlayer.Pause(false); view.HideOverlay(); nextSubmit = Time.unscaledTime + .25f; }
        }
        public void ToggleMute() { if (!audioPlayer) return; audioPlayer.ToggleMute(); view.SetMuted(audioPlayer.Muted); EventSystem.current?.SetSelectedGameObject(null); }
        private void EndFlight() { mode = Mode.Results; Cursor.visible = true; view.ShowResults(progress, firstTry, profile.Best(bestKey), reviewWords); }

        private IEnumerator SmokeType(string value)
        {
            typed = ""; foreach (char c in value) InputSystem.QueueTextEvent(keyboard, c);
            yield return null; InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.Enter));
            yield return null; InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null;
        }

        private IEnumerator SmokeKey(Key key)
        {
            InputSystem.QueueStateEvent(keyboard, new KeyboardState(key)); yield return null;
            InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null;
        }
    }
}

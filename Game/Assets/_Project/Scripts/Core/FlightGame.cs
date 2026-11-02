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
    public sealed class FlightGame : MonoBehaviour
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
            Cursor.visible = !flight.Driving || !view.Board.PointerOverField;
            flight.Tick(Time.deltaTime);
            DrainEvents();
            view.Board.Animate(Time.deltaTime, flight, StartingEnvironment);
            if (progress.IsOver)
            {
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
            bestKey = "continuous-v1:" + StartingEnvironment + ":" + VocabularyQuery.SelectionKey(pool);
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
                        if (ev.Entry != null) { mistakes.Add(ev.Entry.id); if (!reviewWords.Any(e => e.id == ev.Entry.id)) reviewWords.Add(ev.Entry); }
                        audioPlayer.Wrong(); view.Feedback("Chưa đúng. Kiểm tra từ, từ loại hoặc lựa chọn tên lửa.", true); break;
                    case FlightEventKind.Hit:
                        view.Board.Hit(ev.X, ev.Y, ev.Value == 0, flight.PlayerX);
                        if (ev.Value > 0) { audioPlayer.Success(); view.Feedback("Đã phá khiên băng. Nghĩa chuyển sang một máy bay khác."); }
                        break;
                    case FlightEventKind.Kill:
                        bool first = !mistakes.Contains(ev.Entry.id); if (first) firstTry++;
                        view.Log(ev.Entry, true); audioPlayer.Success(); speech.Enqueue(ev.Entry);
                        profile.Record(ev.Entry, true, first, bestKey, progress.Score);
                        view.Feedback(ev.Entry.word + "  +" + ev.Value + " điểm"); break;
                    case FlightEventKind.Pickup:
                        audioPlayer.Pickup(); view.Feedback(ev.Supply == SupplyKind.Roll ? "Đón R+ thành công: +1 lượt đổi nghĩa." : ev.Supply == SupplyKind.Fuel ? "+50 xăng" : "+1 kim loại"); break;
                    case FlightEventKind.MissileBlast:
                        view.Board.Blast(ev.X, ev.Y); audioPlayer.Success(); view.Feedback("Tên lửa nổ! Máy bay trong vòng nổ bị hạ, kể cả còn khiên."); break;
                    case FlightEventKind.MissileFailure:
                        view.Board.FatalMissile(ev.X, ev.Y, flight.PlayerX);
                        view.Feedback("Sai tên lửa 3 lần: máy bay bị phá hủy.", true); break;
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

        private IEnumerator SmokeTest()
        {
            // Bounded checks in a real built player, separate save file and deterministic fixtures.
            string[] args = System.Environment.GetCommandLineArgs(); int at = Array.IndexOf(args, "--smoke-output");
            string output = at >= 0 && at + 1 < args.Length ? args[at + 1] : Application.persistentDataPath;
            Directory.CreateDirectory(output); var checks = new List<string>();
            SelectFullOxford(); ReturnToMenu();
            yield return new WaitForSecondsRealtime(.4f);
            bool captured = view.Capture(Path.Combine(output, "01-hangar.png"));
            SelectFullOxford(); yield return null;
            checks.Add(selection.to == catalog.Entries.Length ? "full-library:PASS" : "full-library:FAIL");
            captured &= view.Capture(Path.Combine(output, "02-vocabulary.png"));
            selection.minimumLevel = selection.maximumLevel = 2; selection.topics = new[] { "food" }; ResetSelectionRange();
            checks.Add(catalog.Filter(selection).All(e => e.cefr == "B1" && e.topics.Contains("food")) ? "filter:PASS" : "filter:FAIL");
            SelectFullOxford(); StartingEnvironment = FlightEnvironment.Desert; StartFlight(); yield return new WaitForSecondsRealtime(.5f);
            var qaMouse = InputSystem.AddDevice<Mouse>("Wordwing QA pointer");
            InputSystem.QueueStateEvent(qaMouse, new MouseState { position = view.Board.ScreenPoint(.22f, .6f) });
            yield return null; yield return null;
            checks.Add(Math.Abs(flight.PlayerX - .22f) < .01 ? "mouse-controls-horizontal-drive:PASS" : "mouse-controls-horizontal-drive:FAIL");
            int initial = flight.Enemies.Count; int targetId = flight.Target.Id;
            flight.Tick(10.1f); DrainEvents();
            checks.Add(flight.Enemies.Count == initial + 2 && flight.Target.Id == targetId ? "continuous-spawn-sticky-target:PASS" : "continuous-spawn-sticky-target:FAIL");
            yield return SmokeType(flight.Target.Entry.word);
            checks.Add(progress.Correct == 0 ? "driving-blocks-fire:PASS" : "driving-blocks-fire:FAIL");
            yield return SmokeKey(Key.Tab);
            float fixedX = flight.PlayerX;
            InputSystem.QueueStateEvent(qaMouse, new MouseState { position = view.Board.ScreenPoint(.82f, .4f) });
            yield return null; yield return null;
            checks.Add(!flight.Driving && Math.Abs(flight.PlayerX-fixedX)<.001 ? "tab-switches-mode-and-freezes-position:PASS" : "tab-switches-mode-and-freezes-position:FAIL");
            view.SelectPartOfSpeech(""); yield return SmokeType(flight.Target.Entry.word);
            checks.Add(progress.Correct == 0 && progress.WrongAttempts == 1 ? "desert-requires-pos:PASS" : "desert-requires-pos:FAIL");
            view.SelectPartOfSpeech(flight.Target.Entry.pos); yield return new WaitForSecondsRealtime(.3f); yield return SmokeType(flight.Target.Entry.word);
            checks.Add(progress.Correct == 1 && flight.Enemies.Count >= 2 ? "typing-kill-retains-other-aircraft:PASS" : "typing-kill-retains-other-aircraft:FAIL");
            yield return null; captured &= view.Capture(Path.Combine(output, "03-desert.png"));
            int old = flight.Target.Id; int rolls = flight.Rolls; RollMeaning();
            checks.Add(flight.Target.Id != old && flight.Rolls == rolls - 1 ? "roll:PASS" : "roll:FAIL");
            TogglePause(); double time = progress.ActiveSeconds; yield return new WaitForSecondsRealtime(.3f);
            checks.Add(progress.ActiveSeconds == time ? "pause:PASS" : "pause:FAIL");
            captured &= view.Capture(Path.Combine(output, "04-paused.png")); TogglePause();
            ReturnToMenu(); StartingEnvironment = FlightEnvironment.Ice; StartFlight(); flight.Tick(10); DrainEvents(); ToggleControlMode();
            var shield = flight.Target; yield return new WaitForSecondsRealtime(.3f); yield return SmokeType(shield.Entry.word);
            checks.Add(flight.Enemies.Contains(shield) && shield.Health == 1 && flight.Target != shield ? "ice-shield-and-retarget:PASS" : "ice-shield-and-retarget:FAIL");
            yield return null; captured &= view.Capture(Path.Combine(output, "05-ice.png"));
            ReturnToMenu(); StartingEnvironment = FlightEnvironment.Jungle; StartFlight(); flight.Tick(24); DrainEvents();
            yield return null; captured &= view.Capture(Path.Combine(output, "06-jungle.png"));
            ReturnToMenu(); StartingEnvironment = FlightEnvironment.Ocean; StartFlight();
            // Seeded ocean fixture guarantees a carrier in the bounded QA run.
            flight = new ContinuousFlight(flightPool, 42, FlightEnvironment.Ocean); progress = flight.Progress;
            int guard = 0; while (flight.Missiles.Count < 2 && guard++ < 300) flight.Tick(1);
            DrainEvents(); flight.SetDriving(false); view.Refresh(flight); yield return null;
            captured &= view.Capture(Path.Combine(output, "07-ocean-missiles.png"));
            bool ocean = flight.Carriers.Count > 0 && flight.Missiles.Count >= 2;
            checks.Add(ocean ? "ocean-carrier-missiles:PASS" : "ocean-carrier-missiles:FAIL");
            if (ocean)
            {
                var missile = flight.Missiles[0]; AnswerMissile(missile.Id, missile.CorrectIndex); yield return null;
                captured &= view.Capture(Path.Combine(output, "08-blast.png"));
                checks.Add(!flight.Missiles.Contains(missile) ? "missile-correct:PASS" : "missile-correct:FAIL");
                missile = flight.Missiles[0]; int wrong = (missile.CorrectIndex + 1) % 4;
                AnswerMissile(missile.Id, wrong); AnswerMissile(missile.Id, wrong);
                checks.Add(!progress.IsOver && missile.WrongAttempts == 2 ? "missile-two-errors-survive:PASS" : "missile-two-errors-survive:FAIL");
                AnswerMissile(missile.Id, wrong); yield return new WaitForSecondsRealtime(.9f);
                checks.Add(mode == Mode.Results ? "missile-third-error-gameover:PASS" : "missile-third-error-gameover:FAIL");
            }
            yield return null; captured &= view.Capture(Path.Combine(output, "09-results.png"));
            checks.Add(captured ? "screenshots:PASS" : "screenshots:FAIL");
            File.WriteAllText(Path.Combine(output, "smoke-report.json"), "{\n  \"version\": \"0.4.0\",\n  \"checks\": [" + string.Join(",", checks.Select(c => "\"" + c + "\"")) + "]\n}");
            Application.Quit(checks.Any(c => c.EndsWith(":FAIL")) ? 1 : 0);
        }

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

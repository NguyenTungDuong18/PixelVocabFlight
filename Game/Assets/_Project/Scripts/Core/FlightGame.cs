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
        private enum Mode { Menu, Launching, Intro, Flying, Paused, Dying, Results, Error }
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
            {
                view.Board.Animate(Time.unscaledDeltaTime, null, StartingEnvironment); view.AnimateHangar(Time.unscaledDeltaTime, StartingEnvironment);
                HandleMenuKeys();
                return;
            }
            if (mode == Mode.Launching)
            {
                view.Board.Animate(Time.unscaledDeltaTime, null, StartingEnvironment); view.AnimateHangar(Time.unscaledDeltaTime, StartingEnvironment);
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
                if (introTime >= IntroSeconds) { view.FinishIntro(); mode = Mode.Flying; nextSubmit = Time.unscaledTime + .1f; }
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
            view.SetInput(typed, !flight.Driving);
            view.Refresh(flight);
        }

        // Title screen shortcuts: 1-4 battlefield, Enter take off, V vocabulary. Results: Enter flies again.
        // Only active on the hangar/results screens so typing in the vocabulary search field is unaffected.
        private void HandleMenuKeys()
        {
            if (keyboard == null || Time.unscaledTime < nextSubmit) return;
            bool enter = keyboard.enterKey.wasPressedThisFrame || keyboard.numpadEnterKey.wasPressedThisFrame;
            if (mode == Mode.Results) { if (enter) StartFlight(); return; }
            if (!view.HangarVisible) return;
            var digits = new[] { keyboard.digit1Key, keyboard.digit2Key, keyboard.digit3Key, keyboard.digit4Key };
            var numpad = new[] { keyboard.numpad1Key, keyboard.numpad2Key, keyboard.numpad3Key, keyboard.numpad4Key };
            for (int i = 0; i < 4; i++) if (digits[i].wasPressedThisFrame || numpad[i].wasPressedThisFrame) { ChooseStartingEnvironment(i); return; }
            if (keyboard.vKey.wasPressedThisFrame) OpenVocabulary();
            else if (enter) TakeOff();
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
            if (mode != Mode.Flying || flight == null || view.PartOfSpeechOpen) return;
            if (keyboard != null && (keyboard.ctrlKey.isPressed || keyboard.leftMetaKey.isPressed || keyboard.rightMetaKey.isPressed)) return;
            // Digits never occur in Oxford headwords, so 1-4 always pick a choice on the open rocket.
            if (value >= '1' && value <= '4' && view.Board.OpenMissileId != 0) { ChooseMissileAnswer(view.Board.OpenMissileId, value - '1'); return; }
            if (flight.Driving || flight.Target == null || typed.Length >= 40) return;
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
            audioPlayer?.Stop(); speech.Clear(); view.Board.Clear(); flight = null; view.FinishIntro(); ShowHangar();
        }

        // Validates the selection; on failure the vocabulary screen explains why and null is returned.
        private VocabularyEntry[] PrepareFlightPool()
        {
            if (catalog == null || mode == Mode.Error) return null;
            if (view.Setup != null && view.Setup.Search.text.Trim() != (selection.search ?? "")) { ApplyMenuSearch(); return null; }
            if (!ReadRange(out var error)) { ShowMenu(error); return null; }
            var pool = VocabularyQuery.Range(catalog.Filter(selection), selection.from, selection.to);
            string poolError = ValidateFlightPool(pool);
            if (poolError != null) { ShowMenu(poolError); return null; }
            return pool;
        }

        // CẤT CÁNH from the hangar: panels slide away and the fighter takes off before the sortie.
        public void TakeOff()
        {
            if (mode != Mode.Menu || !view.HangarVisible) { StartFlight(); return; }
            var pool = PrepareFlightPool();
            if (pool == null) return;
            launchPool = pool; mode = Mode.Launching; Cursor.visible = true;
            view.BeginTakeOff(); audioPlayer.Engine();
            EventSystem.current?.SetSelectedGameObject(null);
        }

        // Straight into the battle intro (BAY LẠI on the results screen, or from the vocabulary screen).
        public void StartFlight()
        {
            if (mode == Mode.Launching || mode == Mode.Intro) return;
            var pool = PrepareFlightPool();
            if (pool != null) BeginFlight(pool);
        }

        private void BeginFlight(VocabularyEntry[] pool)
        {
            audioPlayer.Stop(); speech.Clear(); voiceRemaining = 0; Time.timeScale = 1;
            // New rules have a separate leaderboard from the old three-aircraft waves.
            bestKey = "interaction-v3:" + StartingEnvironment + ":" + VocabularyQuery.SelectionKey(pool);
            flightPool = pool; SaveSelection();
            flight = new ContinuousFlight(pool, System.Environment.TickCount, StartingEnvironment);
            progress = flight.Progress; firstTry = 0; mistakes.Clear(); reviewWords.Clear(); typed = "";
            mode = Mode.Intro; introTime = 0; view.Board.Clear(); view.Board.SetEnvironment(StartingEnvironment);
            view.NewFlight((selection.collection == "oxford3000" ? "OXFORD 3000" : "OXFORD 5000") + " / " + pool.Length + " MỤC");
            view.BeginIntro();
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

        // Tab / lever: switching to BẮN puts the keyboard straight into the typing slot (no click needed).
        public void ToggleControlMode()
        {
            if (mode != Mode.Flying) return;
            SetDriving(!flight.Driving);
        }

        public void FocusTyping() { if (mode == Mode.Flying && flight.Driving) SetDriving(false); else EventSystem.current?.SetSelectedGameObject(null); }

        private void SetDriving(bool driving)
        {
            flight.SetDriving(driving); typed = "";
            view.Feedback(driving ? "LÁI: rê chuột trái/phải để đón R+. TAB để chuyển sang bắn." : "BẮN: gõ ngay từ tiếng Anh + ENTER · phím 1–4 chọn đáp án tên lửa.");
            EventSystem.current?.SetSelectedGameObject(null); view.SetInput(typed, !driving); view.Refresh(flight);
        }

        // Missile tags (click or keys 1-4). Answering needs the guns, so it switches to BẮN first.
        public void ChooseMissileAnswer(int id, int choice)
        {
            if (mode != Mode.Flying) return;
            if (flight.Driving) SetDriving(false);
            var missile = flight.Missiles.FirstOrDefault(m => m.Id == id);
            if (missile == null || !missile.Answerable) return;
            if (!flight.AnswerMissile(id, choice)) view.Board.MarkWrongChoice(id, choice);
            DrainEvents(); view.Refresh(flight);
            EventSystem.current?.SetSelectedGameObject(null);
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
                        if (ev.Source == KillSource.MissileBlast)
                        {
                            view.Board.Burst(ev.X, ev.Y, UiKit.Orange);
                            view.Feedback("Nổ dây chuyền +" + ev.Value + " điểm");
                            break;
                        }
                        goto case FlightEventKind.MissileSolved;
                    case FlightEventKind.MissileSolved:
                        bool first = !mistakes.Contains(ev.Entry.id); if (first) firstTry++;
                        view.Log(ev.Entry, true); audioPlayer.Success();
                        if (ev.ShouldPronounce) speech.Enqueue(ev.Entry);
                        profile.Record(ev.Entry, true, first, bestKey, progress.Score);
                        view.Feedback(ev.Entry.word + "  +" + ev.Value + " điểm"); break;
                    case FlightEventKind.Pickup:
                        audioPlayer.Pickup(); view.Feedback(ev.Supply == SupplyKind.Roll ? "Đón R+ thành công: +1 lượt đổi nghĩa." : ev.Supply == SupplyKind.Fuel ? "+50 xăng" : "+1 kim loại: sửa 1 giáp (tối đa 5)"); break;
                    case FlightEventKind.MissileBlast:
                        view.Board.Blast(ev.X, ev.Y); audioPlayer.Success(); view.Feedback("Tên lửa nổ! Máy bay trong vòng nổ bị hạ, kể cả còn khiên."); break;
                    case FlightEventKind.MissileFailure:
                        view.Feedback("Sai 3 lần: tên lửa khóa mục tiêu và sắp tăng tốc! Trúng mất 2 giáp.", true); break;
                    case FlightEventKind.AircraftLock:
                        audioPlayer.LockWarning();
                        view.Feedback("CẢNH BÁO: " + ev.Entry.word.ToUpperInvariant() + " đang khóa mục tiêu! Gõ đúng để hạ trước khi nó bắn.", true); break;
                    case FlightEventKind.AircraftFire:
                        view.Board.EnemyFire(ev.EntityId); audioPlayer.Gunfire(); break;
                    case FlightEventKind.MissileLock:
                        audioPlayer.LockWarning();
                        view.Feedback("Tên lửa đã khóa mục tiêu! Chọn đáp án ngay (phím 1–4).", true); break;
                    case FlightEventKind.MissileBoost:
                        audioPlayer.Boost(); view.Feedback("Tên lửa tăng tốc lao tới — không thể né!", true); break;
                    case FlightEventKind.AircraftImpact:
                    case FlightEventKind.MissileImpact:
                        view.Board.Impact(ev.X, ev.Y); audioPlayer.Wrong();
                        view.Feedback((ev.Kind == FlightEventKind.MissileImpact ? "Tên lửa trúng!" : "Trúng loạt đạn đuổi!") + " -" + ev.Value + " giáp / còn " + progress.Metal + "/5.", true);
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
        private void EndFlight() { profile.RecordBest(bestKey, progress.Score); audioPlayer.Stop(); speech.Clear(); mode = Mode.Results; Cursor.visible = true; view.ShowResults(progress, firstTry, profile.Best(bestKey), reviewWords); }

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

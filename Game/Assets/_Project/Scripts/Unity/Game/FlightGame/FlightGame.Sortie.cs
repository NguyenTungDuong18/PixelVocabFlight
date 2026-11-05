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
        // ---------------- Sortie ----------------
        // E at SKYLARK with an active mission: the take-off cutscene, then the battle intro.
        private void BoardAircraft()
        {
            if (mode != Mode.Base || missions.Active == null) return;
            var pool = PrepareFlightPool(out string error);
            if (pool == null)
            {
                SetMode(Mode.Vocabulary); ShowMenu(error ?? "Bộ từ chưa hợp lệ. Hãy chọn lại trước khi cất cánh.");
                return;
            }
            if (dialogue.Open) CloseDialogue();
            StartingEnvironment = (FlightEnvironment)Mathf.Clamp(missions.Environment, 0, 3);
            profile.Profile.startingEnvironment = (int)StartingEnvironment; SaveMissions();
            launchPool = pool; SetMode(Mode.Launching); Cursor.visible = true;
            view.BeginTakeOff(); audioPlayer.Engine();
            EventSystem.current?.SetSelectedGameObject(null);
        }

        private void BeginFlight(VocabularyEntry[] pool)
        {
            audioPlayer.Stop(); speech.Clear(); voiceRemaining = 0; Time.timeScale = 1;
            // New rules have a separate leaderboard from the old three-aircraft waves.
            bestKey = "interaction-v3:" + StartingEnvironment + ":" + VocabularyQuery.SelectionKey(pool);
            flightPool = pool; SaveSelection();
            flight = new ContinuousFlight(pool, System.Environment.TickCount, StartingEnvironment);
            progress = flight.Progress; firstTry = 0; mistakes.Clear(); reviewWords.Clear(); typed = "";
            SetMode(Mode.Intro); introTime = 0; view.Board.Clear(); view.Board.SetEnvironment(StartingEnvironment);
            view.NewFlight((selection.collection == "oxford3000" ? "OXFORD 3000" : "OXFORD 5000") + " / " + pool.Length + " MỤC");
            view.BeginIntro();
            DrainEvents(); view.Refresh(flight); nextSubmit = Time.unscaledTime + .2f;
            EventSystem.current?.SetSelectedGameObject(null);
        }

        // VỀ CĂN CỨ on the results screen: the mission is reported (Completed + last score) and saved.
        public void CompleteSortie()
        {
            if (mode != Mode.Results) return;
            missions.Complete(progress.Score); SaveMissions();
            EnterBase(false, true);
            view.Base.ShowHint("Đã báo cáo " + UiKit.Number(progress.Score) + " điểm. Gặp Giáo sư Whitmore để nhận chuyến huấn luyện mới.");
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


        public void TogglePause()
        {
            if (mode == Mode.Flying) { SetMode(Mode.Paused); Time.timeScale = 0; Cursor.visible = true; audioPlayer.Pause(true); view.ShowPause(); }
            else if (mode == Mode.Paused) { SetMode(Mode.Flying); Time.timeScale = 1; audioPlayer.Pause(false); view.HideOverlay(); nextSubmit = Time.unscaledTime + .25f; }
        }
        public void ToggleMute() { if (!audioPlayer) return; audioPlayer.ToggleMute(); view.SetMuted(audioPlayer.Muted); EventSystem.current?.SetSelectedGameObject(null); }
        private void EndFlight()
        {
            profile.RecordBest(bestKey, progress.Score); audioPlayer.Stop(); speech.Clear(); SetMode(Mode.Results); Cursor.visible = true;
            view.ShowResults(progress, firstTry, profile.Best(bestKey), reviewWords);
            nextSubmit = Time.unscaledTime + .4f; // A late Enter from typing must not skip the report.
        }
    }
}

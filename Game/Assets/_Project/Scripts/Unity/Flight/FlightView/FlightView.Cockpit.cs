using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightView
    {
        public void NewFlight(string selectedTopic)
        {
            history.Clear(); recent.text = ""; topic.text = selectedTopic; HideOverlay();
            Feedback("LÁI: rê chuột ngang để đón R+. TAB để chuyển sang BẮN.");
        }
        public void SelectPartOfSpeech(string value) => pos.SetValueWithoutNotify(Math.Max(0, Array.IndexOf(posValues, value)));
        public void SetQuestion(VocabularyEntry entry, int number)
        {
            question.text = entry?.meaning ?? "Đang chờ máy bay tiếp theo…";
            kind.text = ""; SelectPartOfSpeech("");
        }

        // focused = BẮN mode: the typed word with a blinking caret right after the last letter.
        // LÁI mode shows only the "NHẬP ĐỂ BẮN" placeholder, with no caret.
        public void SetInput(string value, bool focused)
        {
            if (value == null) value = "";
            inputFrame.sprite = PixelSprites.Get(focused ? "ui_input_focus" : "ui_input");
            placeholder.enabled = !focused;
            // The caret restarts solid whenever the text or the mode changes, then blinks.
            if (value != lastInput || focused != lastFocused) { lastInput = value; lastFocused = focused; caretTimer = 0; }
            caretTimer += Time.unscaledDeltaTime;
            inputText.text = focused ? value : "";
            // Long words shrink instead of running past the slot.
            int size = UiKit.Px(22);
            inputText.fontSize = size;
            float width = MeasureWidth(inputText, inputText.text);
            while (width > 428 && size > UiKit.Px(12)) { size -= 2; inputText.fontSize = size; width = MeasureWidth(inputText, inputText.text); }
            float caretHeight = Mathf.Round(size * .78f / 2) * 2;
            caret.rectTransform.sizeDelta = new Vector2(4, caretHeight);
            caret.rectTransform.anchoredPosition = new Vector2(Mathf.Round(inputText.rectTransform.anchoredPosition.x + width + 2), -Mathf.Round((52 - caretHeight) / 2));
            caret.enabled = focused && caretTimer % 1.06f < .6f;
        }
        public void Feedback(string value, bool error = false) { feedback.text = value; feedback.color = error ? UiKit.Coral : UiKit.Mint; }
        public void Log(VocabularyEntry entry, bool correct)
        {
            history.Insert(0, entry.word + " — " + entry.meaning); if (history.Count > 2) history.RemoveAt(2);
            recent.text = "HẠ: " + history[0];
        }
        public void Refresh(ContinuousFlight flight)
        {
            var p = flight.Progress;
            float delta = Time.unscaledDeltaTime;
            score.text = p.Score.ToString("000000"); combo.text = "COMBO ×" + GameRules.ComboMultiplier(p.Streak).ToString("0.00") + "  /  ĐÚNG " + p.Correct;
            bool blink = Time.unscaledTime % .5f < .25f;
            for (int i = 0; i < lamps.Length; i++)
                lamps[i].sprite = PixelSprites.Get(i >= p.Metal ? "ui_lamp_off" : p.Metal <= 1 ? (blink ? "ui_lamp_red" : "ui_lamp_off") : p.Metal == 2 ? "ui_lamp_red" : p.Metal == 3 ? "ui_lamp_amber" : "ui_lamp_green");
            armorLabel.text = "GIÁP " + p.Metal + "/" + FlightProgress.MaximumMetal;
            armorLabel.color = p.Metal <= 2 ? UiKit.Coral : Brass;
            fuelAngle = Mathf.MoveTowards(fuelAngle, -135 + 270 * Mathf.Clamp01(p.Fuel / 100), 220 * delta); PointNeedle(fuelNeedle, fuelAngle);
            fuelValue.text = Mathf.CeilToInt(p.Fuel) + "%"; fuelValue.color = p.Fuel < 20 ? UiKit.Coral : UiKit.Cream;
            float multiplier = GameRules.SpeedMultiplier(p.ActiveSeconds);
            speedAngle = Mathf.MoveTowards(speedAngle, -135 + 270 * Mathf.Clamp01((multiplier - 1) / .5f), 120 * delta); PointNeedle(speedNeedle, speedAngle);
            speedValue.text = Mathf.RoundToInt(multiplier * 100) + "%";
            int seconds = (int)p.ActiveSeconds;
            PointNeedle(clockNeedle, seconds % 60 * 6);
            clockValue.text = (seconds / 60).ToString("00") + ":" + (seconds % 60).ToString("00");
            supplyLabel.text = p.Powered ? "CƯỜNG HÓA " + Mathf.CeilToInt(p.PowerSeconds) + "s · ĐIỂM ×1.5" : "Kim loại sửa 1 giáp\nTiếp tế " + p.UpgradePickups + "/5 → cường hóa";
            supplyLabel.color = p.Powered ? UiKit.Mint : UiKit.Cream;
            region.text = EnvironmentNames[(int)flight.Environment] + "  /  " + flight.Enemies.Count + " MÁY BAY";
            int remaining = Mathf.CeilToInt(ContinuousFlight.EnvironmentDuration - (float)(p.ActiveSeconds % ContinuousFlight.EnvironmentDuration));
            wave.text = "Đổi vùng sau " + remaining / 60 + ":" + (remaining % 60).ToString("00") + " · " + (flight.WaitingForDistinctWord ? "Đã dùng hết đáp án phân biệt trên màn hình" : "Máy bay tiếp: " + flight.SpawnIn.ToString("0.0") + "s");
            modeHint.text = flight.Driving ? "ĐANG LÁI  ·  TAB → BẮN" : "ĐANG BẮN  ·  TAB → LÁI";
            leverPosition = Mathf.MoveTowards(leverPosition, flight.Driving ? 0 : 2, delta * 14);
            lever.sprite = PixelSprites.Get("ui_lever", Mathf.RoundToInt(leverPosition));
            fireButton.interactable = !flight.Driving && flight.Target != null;
            rollLabel.text = "ĐỔI NGHĨA (" + flight.Rolls + ")"; rollButton.interactable = flight.CanRoll;
            pos.interactable = !flight.Driving && flight.Target?.RequiresPartOfSpeech == true;
            var locking = flight.Enemies.Where(e => e.Phase == EnemyPhase.Locking).OrderBy(e => e.LockRemaining).FirstOrDefault();
            bool boosting = flight.Missiles.Any(m => m.Phase == MissilePhase.Boost);
            if (locking != null || boosting)
            {
                recent.text = boosting ? "!! TÊN LỬA TĂNG TỐC !!" : "!! BỊ KHÓA · " + Mathf.Max(0, locking.LockRemaining).ToString("0.0") + "s !!";
                recent.color = blink ? UiKit.Coral : UiKit.Orange;
            }
            else { recent.text = history.Count > 0 ? "HẠ: " + history[0] : ""; recent.color = PhosphorDim; }
            kind.text = flight.Target == null ? "Chưa có mục tiêu. Đồng hồ sinh máy bay vẫn chạy."
                : flight.Target.Phase == EnemyPhase.Locking ? "MỤC TIÊU ĐANG KHÓA BẠN: gõ đúng để hạ trước khi nó bắn!"
                : flight.Target.RequiresPartOfSpeech ? "MÁY BAY SA MẠC: cần chọn đúng từ loại."
                : flight.Target.Health > 1 ? "KHIÊN BĂNG: cần hai lần trúng. Mỗi lần trúng sẽ đổi nghĩa."
                : "Gõ từ tiếng Anh tương ứng rồi nhấn ENTER.";
        }
        public void SetMuted(bool muted) { muteLabel.text = muted ? "ÂM: TẮT" : "ÂM: BẬT"; muteIcon.sprite = PixelSprites.Get(muted ? "icon_sound_off" : "icon_sound_on"); }
    }
}

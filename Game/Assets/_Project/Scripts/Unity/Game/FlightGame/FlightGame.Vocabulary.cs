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
        // ---------------- Vocabulary screen ----------------
        public void OpenVocabulary() { if (mode != Mode.Base && mode != Mode.Vocabulary) return; if (dialogue.Open) CloseDialogue(); SetMode(Mode.Vocabulary); ShowMenu(); }
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
        public void ShowVocabularyCredits() { if (mode == Mode.Vocabulary) view.ShowCredits(); }
        // The word-set screen only exists in Mode.Vocabulary; selection changes elsewhere just save.
        private void ShowMenu(string error = null) { if (mode == Mode.Vocabulary) view.ShowMenu(catalog, selection, catalog.Filter(selection), previewPage, error); }

        // XONG on the word-set screen: keep a valid selection and walk back out onto the base.
        public void FinishVocabulary()
        {
            if (mode != Mode.Vocabulary) return;
            var pool = PrepareFlightPool(out string error);
            if (pool == null) { if (error != null) ShowMenu(error); return; }
            SaveSelection(); ReturnToBase();
            view.Base.ShowHint("Đã lưu bộ " + UiKit.Number(pool.Length) + " từ cho chuyến bay tới.");
        }

        // Validates the selection. Null + error when it is unusable; null without error when a pending
        // search was applied first (the vocabulary screen already shows the new result).
        private VocabularyEntry[] PrepareFlightPool(out string error)
        {
            error = null;
            if (catalog == null || mode == Mode.Error) return null;
            if (view.Setup != null && view.Setup.Search.text.Trim() != (selection.search ?? "")) { ApplyMenuSearch(); return null; }
            if (!ReadRange(out error)) return null;
            var pool = VocabularyQuery.Range(catalog.Filter(selection), selection.from, selection.to);
            error = ValidateFlightPool(pool);
            return error == null ? pool : null;
        }
    }
}

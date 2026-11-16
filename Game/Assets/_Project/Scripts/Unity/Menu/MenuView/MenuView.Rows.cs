using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // The rows of a page: plain rows, tall save cards (with a small "XÓA" button), slider rows and choice rows.
    // Missing UI sprites fall back to older frames (ui_card, ui_panel) or to plain blocks, so a page is always usable.
    public sealed partial class MenuView
    {
        private const float RowWidth = 920, CardWidth = 1000, SliderWidth = 300;

        private sealed class Row
        {
            public MenuEntry Item; public RectTransform Rect; public Image Frame, Track, Knob, Secondary;
            public Text Label, Value, Detail, SecondaryLabel;
            public string Normal, Chosen;
            public bool Paper, Metal;        // Paper: ink text on a paper frame; Metal: ui_menu_option (cream text, amber when chosen)
            public float X, Y, W, H;         // resting place (top-left, canvas px)
            public float Slide, Reveal;      // chosen-row shift to the right (main page), 0..1 slide-in progress
        }

        private static readonly Color Amber = UiKit.Hex("F2B65A");
        private const float SlideIn = .45f, SlideDelay = .09f, ChosenShift = 56, ChosenEase = .12f;
        private readonly List<Row> rows = new List<Row>();
        private float built, refreshedAt;
        public int Selected { get; private set; }
        public bool SecondaryFocus { get; private set; }
        public int ItemCount => rows.Count;
        public string ItemText(int i) => i >= 0 && i < rows.Count ? rows[i].Item.Text : "";
        public string ItemDetail(int i) => i >= 0 && i < rows.Count ? rows[i].Item.Detail ?? "" : "";
        public string ItemValue(int i) => i >= 0 && i < rows.Count && rows[i].Item.Value != null ? rows[i].Item.Value() : "";
        public bool ItemEnabled(int i) => i >= 0 && i < rows.Count && rows[i].Item.Enabled;
        public int ItemFontSize(int i) => i >= 0 && i < rows.Count ? rows[i].Label.fontSize : 0;
        // Where row i is right now on the 1920x1080 canvas (top-left origin); moves while the row slides in or is chosen.
        public Rect ItemRect(int i)
        {
            if (i < 0 || i >= rows.Count) return Rect.zero;
            var rect = rows[i].Rect;
            return new Rect(rect.anchoredPosition.x, -rect.anchoredPosition.y, rect.sizeDelta.x, rect.sizeDelta.y);
        }

        // Every row has finished sliding in (and the chosen one has stepped out).
        public bool RowsSettled { get { foreach (var row in rows) if (row.Reveal < 1 || row.Slide != (!row.Item.Card && rows.IndexOf(row) == Selected ? ChosenShift : 0)) return false; return true; } }

        private void ClearRows()
        {
            foreach (var row in rows) { row.Rect.SetParent(null, false); Object.Destroy(row.Rect.gameObject); }
            rows.Clear(); Selected = 0; SecondaryFocus = false;
            marker.enabled = false;
        }

        // Every page is a column hugging the left edge (x=48). logo: the main menu (logo top-left, rows 600 wide from y=372);
        // other pages are 920 wide under a left-aligned title, save cards 1000 wide.
        private void Build(IList<MenuEntry> items, int selected, bool logo)
        {
            ClearRows();
            built = refreshedAt = time;
            float y = logo ? Mathf.Min(372, 990 - (items.Count * 110 - 14)) : string.IsNullOrEmpty(subtitleLabel.text) ? 210 : 240;   // six rows still end above the footer
            for (int i = 0; i < items.Count; i++)
            {
                var item = items[i];
                float w = item.Card ? CardWidth : logo ? 600 : RowWidth, h = item.Card ? 190 : 96;
                var row = MakeRow(item, i, 48, y, w, h, logo);
                rows.Add(row);
                y += h + (item.Card ? 20 : logo ? 14 : 16);
            }
            Selected = Mathf.Clamp(selected, 0, Mathf.Max(0, rows.Count - 1));
            if (rows.Count > 0 && !rows[Selected].Item.Enabled) Move(1);
            RefreshRows();
        }

        private Row MakeRow(MenuEntry item, int index, float x, float y, float w, float h, bool main)
        {
            bool paperChoice = PixelSprites.Has("ui_dialog_choice") && PixelSprites.Has("ui_dialog_choice_selected");
            bool metal = PixelSprites.Has("ui_menu_option") && PixelSprites.Has("ui_menu_option_selected");
            var row = new Row { Item = item, X = x, Y = y, W = w, H = h };
            if (item.Card)
            {
                row.Normal = UiKit.Pick("ui_save_slot", "ui_panel"); row.Chosen = UiKit.Pick("ui_save_slot_selected", row.Normal);
                row.Paper = PixelSprites.Has("ui_save_slot");
            }
            else if (metal) { row.Normal = "ui_menu_option"; row.Chosen = "ui_menu_option_selected"; row.Metal = true; }
            else { row.Normal = UiKit.Pick("ui_dialog_choice", "ui_card"); row.Chosen = UiKit.Pick("ui_dialog_choice_selected", "ui_card_selected"); row.Paper = paperChoice; }
            float slice = row.Normal == "ui_menu_option" || row.Normal == "ui_dialog_choice" || row.Normal == "ui_save_slot" ? 4 : row.Normal == "ui_panel" ? 3 : 2;
            row.Frame = UiKit.Framed("Row " + index, listRoot, x, y, w, h, row.Normal, slice);
            row.Frame.raycastTarget = true;
            row.Rect = row.Frame.rectTransform;
            var button = row.Frame.gameObject.AddComponent<Button>();
            button.targetGraphic = row.Frame; button.transition = Selectable.Transition.None; button.navigation = new Navigation { mode = Navigation.Mode.None };
            button.onClick.AddListener(() => Click(index));
            var hover = row.Frame.gameObject.AddComponent<EventTrigger>();
            var enter = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
            enter.callback.AddListener(_ => Hover(index));
            hover.triggers.Add(enter);
            Color ink = row.Paper ? UiKit.Ink : UiKit.Cream;
            bool slider = item.Slider != null, choice = item.Value != null;
            float textWidth = slider ? w - SliderWidth - 236 : choice ? w - 560 : w - 100;
            if (item.Card)
            {
                row.Label = UiKit.Label(item.Text, row.Rect, 56, 14, w - 300, 64, StoryLayout.ChoiceDesign, ink, false, TextAnchor.MiddleLeft);
                row.Detail = UiKit.Label(item.Detail ?? "", row.Rect, 56, 82, w - 300, 96, StoryLayout.SmallDesign, ink, false, TextAnchor.UpperLeft);
                if (item.Secondary != null)
                {
                    row.Secondary = UiKit.Framed("Secondary", row.Rect, w - 230, (h - 76) / 2, 170, 76, UiKit.Pick("ui_dialog_choice", "ui_card"), 4);
                    row.Secondary.raycastTarget = true;
                    var sb = row.Secondary.gameObject.AddComponent<Button>();
                    sb.targetGraphic = row.Secondary; sb.transition = Selectable.Transition.None; sb.navigation = new Navigation { mode = Navigation.Mode.None };
                    sb.onClick.AddListener(() => { Selected = index; SecondaryFocus = true; ActivateSelected(); });
                    row.SecondaryLabel = UiKit.Label(item.SecondaryText ?? "XÓA", row.Secondary.transform, 0, -1, 170, 76, StoryLayout.SmallDesign, UiKit.Ink, true, TextAnchor.MiddleCenter);
                }
            }
            else
            {
                row.Label = UiKit.Label(item.Text, row.Rect, 56, -1, textWidth, h, StoryLayout.ChoiceDesign, ink, false, TextAnchor.MiddleLeft);
                row.Label.horizontalOverflow = HorizontalWrapMode.Overflow;
            }
            if (slider)
            {
                float tx = w - SliderWidth - 170;
                row.Track = UiKit.Framed("Track", row.Rect, tx, h / 2 - 16, SliderWidth, 32, UiKit.Pick("ui_slider_track", "ui_ink"), 4);
                row.Track.raycastTarget = false;
                if (!PixelSprites.Has("ui_slider_track")) row.Track.color = UiKit.Line;
                row.Knob = UiKit.Box("Knob", row.Rect, tx, h / 2 - 32, 48, 64, Color.white);
                if (PixelSprites.Has("ui_slider_knob")) { row.Knob.sprite = PixelSprites.Get("ui_slider_knob", 0); row.Knob.preserveAspect = true; } else row.Knob.color = UiKit.Mint;
            }
            if (slider || choice)
                row.Value = UiKit.Label("", row.Rect, w - (slider ? 170 : 500), -1, slider ? 130 : 440, h, StoryLayout.ChoiceDesign, ink, false, TextAnchor.MiddleRight);
            return row;
        }

        // Selected row: the "chosen" frame, ink or mint text; disabled rows are faded; sliders move their knob.
        private void RefreshRows()
        {
            float dt = Mathf.Max(0, time - refreshedAt); refreshedAt = time;
            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                bool chosen = i == Selected, primary = chosen && !SecondaryFocus;
                var frame = PixelSprites.Get(primary || (chosen && row.Secondary == null) ? row.Chosen : row.Normal);
                if (row.Frame.sprite != frame) row.Frame.sprite = frame;
                // Slide in from beyond the left edge (ease-out-back, a short delay per row); the chosen row of the main page steps right.
                row.Reveal = Mathf.Clamp01((time - built - i * SlideDelay) / SlideIn);
                float back = row.Reveal - 1, eased = 1 + 2.70158f * back * back * back + 1.70158f * back * back;
                row.Slide = Mathf.MoveTowards(row.Slide, !row.Item.Card && chosen ? ChosenShift : 0, ChosenShift * dt / ChosenEase);
                row.Rect.anchoredPosition = new Vector2(Mathf.Round(Mathf.LerpUnclamped(-(row.W + 100), row.X, eased) + row.Slide), -row.Y);
                Color ink = row.Paper ? UiKit.Ink : chosen ? (row.Metal ? Amber : UiKit.Mint) : UiKit.Cream;
                float alpha = row.Item.Enabled ? 1 : .45f;
                row.Label.color = new Color(ink.r, ink.g, ink.b, alpha);
                if (row.Detail) row.Detail.color = new Color(ink.r, ink.g, ink.b, alpha * .85f);
                if (row.Value) { row.Value.text = row.Item.Value != null ? "<  " + row.Item.Value() + "  >" : Mathf.RoundToInt((row.Item.Slider?.Invoke() ?? 0) * 100).ToString(); row.Value.color = row.Label.color; }
                if (row.Secondary)
                {
                    var side = PixelSprites.Get(chosen && SecondaryFocus ? UiKit.Pick("ui_dialog_choice_selected", "ui_card_selected") : UiKit.Pick("ui_dialog_choice", "ui_card"));
                    if (row.Secondary.sprite != side) row.Secondary.sprite = side;
                }
                if (row.Knob && row.Track)
                {
                    float v = Mathf.Clamp01(row.Item.Slider());
                    row.Knob.rectTransform.anchoredPosition = new Vector2(row.Track.rectTransform.anchoredPosition.x + v * (SliderWidth - 48), row.Knob.rectTransform.anchoredPosition.y);
                }
            }
            // The brass arrow at x=52, in the gap left by the chosen row stepping right (not beside save cards).
            bool arrow = rows.Count > 0 && !rows[Selected].Item.Card && PixelSprites.Has("ui_menu_marker");
            marker.enabled = arrow;
            if (arrow)
            {
                var row = rows[Selected];
                marker.sprite = PixelSprites.At("ui_menu_marker", time);
                marker.color = new Color(1, 1, 1, row.Reveal);
                marker.rectTransform.anchoredPosition = new Vector2(52,-(row.Y + (row.H - 48) / 2));
            }
        }

        public void Move(int delta)
        {
            if (rows.Count == 0) return;
            for (int n = 0; n < rows.Count; n++)
            {
                Selected = (Selected + delta + rows.Count) % rows.Count;
                if (rows[Selected].Item.Enabled) break;
            }
            SecondaryFocus = false;
        }

        // A/D: a slider or choice changes; on a card, D moves to its XÓA button and A back.
        public void Adjust(int delta)
        {
            if (rows.Count == 0) return;
            var item = rows[Selected].Item;
            if (item.Adjust != null) { item.Adjust(delta); return; }
            if (item.Secondary != null) SecondaryFocus = delta > 0;
        }

        public void ActivateSelected()
        {
            if (rows.Count == 0) return;
            var item = rows[Selected].Item;
            if (!item.Enabled) return;
            if (SecondaryFocus && item.Secondary != null) item.Secondary();
            else if (item.Activate != null) item.Activate();
            else if (item.Adjust != null) item.Adjust(1);
        }

        public void Hover(int index) { if (UnityEngine.Time.unscaledTime - pointerMovedAt > .25f) return; if (index >= 0 && index < rows.Count && rows[index].Item.Enabled && index != Selected) { Selected = index; SecondaryFocus = false; } }

        private void Click(int index)
        {
            if (index < 0 || index >= rows.Count || !rows[index].Item.Enabled) return;
            Selected = index; SecondaryFocus = false;
            var row = rows[index];
            if (row.Item.SetSlider != null && row.Track && Mouse.current != null
                && RectTransformUtility.ScreenPointToLocalPointInRectangle(row.Track.rectTransform, Mouse.current.position.ReadValue(), null, out var local))
            {
                float v = (local.x - row.Track.rectTransform.rect.xMin) / Mathf.Max(1, row.Track.rectTransform.rect.width);
                if (v >= -.1f && v <= 1.1f) { row.Item.SetSlider(Mathf.Clamp01(v)); return; }
            }
            ActivateSelected();
        }
    }
}

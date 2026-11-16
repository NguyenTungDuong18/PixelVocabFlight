using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Base dialogue box: portrait, speaker, a typewriter line and numbered choices.
    // Choices appear once the line is fully shown; FlightGame drives keys (1-9, W/S + E/Enter/Space)
    // and buttons call FlightGame.ChooseDialogue. Battlefield choices (mission.accept:N) show card_<env>.
    public sealed class DialogueView
    {
        public const float CharactersPerSecond = 48;
        // Metrics: the airbase box is drawn for a 1440x900 canvas (x3 art); the story one (hd) for 1920x1080 (x4, bigger text).
        private readonly bool hd;
        private readonly float BoxX, BoxY, BoxWidth, BoxHeight, RowHeight, PanelWidth, WidePanelWidth, TopBoxY, NamePlateX, NamePlateY, NamePlateHeight, RowGap;
        private readonly int boxSlice, choiceSlice, bodyDesign, choiceDesign, nameDesign;
        private float BodyLeft => hd ? 300 : 206;
        private static readonly string[] EnvironmentKeys = { "jungle", "desert", "ice", "ocean" };

        private sealed class Row { public RectTransform Rect; public Image Frame, Pointer; public Text Label; }

        private readonly FlightGame game;
        private readonly RectTransform root, choicePanel;
        private readonly Image portrait, choiceFrame, namePlate, nextArrow, boxFrame;
        // Current box rectangle: the story's plain box (narration, an unnamed line over a picture) is a low strip (CompactHeight)
        // at the bottom so it never covers the picture; every other box is the full BoxHeight.
        private const float CompactHeight = 160, CompactMargin = 40;
        private float boxY, boxH;
        private bool wideChoices, topBox;
        private Image portraitFrame;
        private RectTransform bodyRect;
        private string normalBox;
        private bool plain;
        private readonly Text speakerLabel, body;
        private readonly string cardName, cardSelectedName;
        private readonly bool newChoice, newBox;
        private readonly List<Row> rows = new List<Row>();
        private string fullText = "", portraitSprite;
        private float revealed, time;

        public bool Open { get; private set; }
        public bool Typing => Open && VisibleCharacters < fullText.Length;
        public int VisibleCharacters => Mathf.Min(fullText.Length, Mathf.FloorToInt(revealed));
        public int Selected { get; private set; }
        public int ChoiceCount => rows.Count;
        public bool ChoicesVisible => choicePanel.gameObject.activeSelf;
        public int ThumbnailCount { get; private set; }
        public bool NamePlateVisible => namePlate && namePlate.gameObject.activeInHierarchy;
        // The "press to continue" arrow: line fully shown and nothing to choose.
        public bool NextArrowVisible => nextArrow.enabled && nextArrow.gameObject.activeInHierarchy;
        public int BodyFontSize => body.fontSize;
        public string BoxSpriteName => boxFrame.sprite ? boxFrame.sprite.name : "";
        public string SpeakerName { get; private set; } = "";
        public string Line => fullText;
        public string PortraitName => portrait.enabled && portrait.sprite ? portrait.sprite.name : "";
        public string ChoiceText(int index) => index >= 0 && index < rows.Count ? rows[index].Label.text : "";
        public Vector2 ChoiceScreenPoint(int index) =>
            RectTransformUtility.WorldToScreenPoint(null, rows[index].Rect.TransformPoint(rows[index].Rect.rect.center));

        public DialogueView(Transform parent, FlightGame game, bool hd = false)
        {
            this.game = game; this.hd = hd;
            if (hd) { BoxX = 60; BoxY = 744; BoxWidth = 1800; BoxHeight = 288; RowHeight = 106; RowGap = 10; PanelWidth = WidePanelWidth = 1560; TopBoxY = 72; NamePlateX = 300; NamePlateY = -40; NamePlateHeight = 64; boxSlice = 4; choiceSlice = 4; bodyDesign = StoryLayout.BodyDesign; choiceDesign = StoryLayout.ChoiceDesign; nameDesign = StoryLayout.NameDesign; }
            else { BoxX = 40; BoxY = 668; BoxWidth = 1360; BoxHeight = 208; RowHeight = 54; RowGap = 6; PanelWidth = 640; WidePanelWidth = 1100; TopBoxY = 56; NamePlateX = 200; NamePlateY = -30; NamePlateHeight = 48; boxSlice = 3; choiceSlice = 2; bodyDesign = 18; choiceDesign = 18; nameDesign = 15; }
            boxY = BoxY; boxH = BoxHeight;
            root = UiKit.Rect("Dialogue", parent, 0, 0, hd ? StoryLayout.Width : 1440, hd ? StoryLayout.Height : 900);
            // 0.16 frames (ui_dialog_*) when the forge has produced them, else the old panel/ink/card sprites.
            cardName = UiKit.Pick("ui_dialog_choice", "ui_card");
            cardSelectedName = UiKit.Pick("ui_dialog_choice_selected", "ui_card_selected");
            newChoice = PixelSprites.Has("ui_dialog_choice") && PixelSprites.Has("ui_dialog_choice_selected");
            newBox = PixelSprites.Has("ui_dialog_box");
            var box = boxFrame = UiKit.Framed("Dialogue box", root, BoxX, BoxY, BoxWidth, BoxHeight, UiKit.Pick("ui_dialog_box", "ui_panel"), boxSlice);
            box.raycastTarget = true; // Clicks on the box never reach anything behind it.
            if (PixelSprites.Has("ui_dialog_portrait"))
            {
                // 168 px frame (4 px bronze rim x 3), the 48 px portrait drawn at x3 = 144 px inside it.
                if (hd) { portraitFrame = UiKit.Framed("Portrait frame", box.transform, 24, 28, 224, 224, "ui_dialog_portrait", 4); portrait = UiKit.Box("Portrait", box.transform, 40, 44, 192, 192, Color.white); }
                else { portraitFrame = UiKit.Framed("Portrait frame", box.transform, 20, 20, 168, 168, "ui_dialog_portrait", 3); portrait = UiKit.Box("Portrait", box.transform, 32, 32, 144, 144, Color.white); }
            }
            else
            {
                if (hd) { portraitFrame = UiKit.Framed("Portrait frame", box.transform, 26, 30, 208, 208, "ui_ink", 3); portrait = UiKit.Box("Portrait", box.transform, 34, 38, 192, 192, Color.white); }
                else { portraitFrame = UiKit.Framed("Portrait frame", box.transform, 22, 26, 156, 156, "ui_ink", 2); portrait = UiKit.Box("Portrait", box.transform, 28, 32, 144, 144, Color.white); }
            }
            if (PixelSprites.Has("ui_dialog_name"))
            {
                // Name plate straddles the top edge of the box, to the right of the portrait frame.
                namePlate = UiKit.Framed("Name plate", box.transform, NamePlateX, NamePlateY, 160, NamePlateHeight, "ui_dialog_name", boxSlice);
                speakerLabel = UiKit.Label("", namePlate.transform, 0, -2, 160, NamePlateHeight, nameDesign, UiKit.Cream, true, TextAnchor.MiddleCenter);
                speakerLabel.horizontalOverflow = HorizontalWrapMode.Overflow;
            }
            else speakerLabel = hd ? UiKit.Label("", box.transform, 280, 22, 1400, 48, nameDesign, UiKit.Mint, true) : UiKit.Label("", box.transform, 202, 18, 1120, 34, 17, UiKit.Mint, true);
            // The new box is light cream paper (dark Ink text); the old one is a dark panel (Cream text).
            // Wood border is 18 px, so keep >= 24 px free at the bottom and right.
            body = hd ? (newBox ? UiKit.Label("", box.transform, BodyLeft, 56, BoxWidth - BodyLeft - 100, BoxHeight - 104, bodyDesign, UiKit.Ink) : UiKit.Label("", box.transform, BodyLeft - 20, 78, BoxWidth - BodyLeft - 80, BoxHeight - 120, bodyDesign, UiKit.Cream))
                : newBox ? UiKit.Label("", box.transform, 206, 40, BoxWidth - 206 - 66, 144, 18, UiKit.Ink)
                          : UiKit.Label("", box.transform, 202, 56, 1126, 132, 18, UiKit.Cream);
            body.supportRichText = true; body.alignment = TextAnchor.UpperLeft;
            bodyRect = body.rectTransform; normalBox = UiKit.Pick("ui_dialog_box", "ui_panel");
            nextArrow = hd ? UiKit.Box("Next arrow", box.transform, BoxWidth - 96, BoxHeight - 84, 40, 40, Color.white) : UiKit.Box("Next arrow", box.transform, BoxWidth - 54, BoxHeight - 52, 30, 30, Color.white);
            nextArrow.preserveAspect = true; nextArrow.enabled = false;

            // New choice rows float on their own (no backing panel); old ones sit in a ui_panel.
            choiceFrame = UiKit.Framed("Choices", root, BoxX + BoxWidth - PanelWidth, boxY - 12, PanelWidth, 40, "ui_panel", hd ? 4 : 3);
            if (newChoice) choiceFrame.color = Color.clear;
            choiceFrame.raycastTarget = true;
            choicePanel = choiceFrame.rectTransform;
            choicePanel.gameObject.SetActive(false);
            root.gameObject.SetActive(false);
        }

        // speaker: display name (+ role); character: portrait id; choices: the runner's visible choices.
        // plainBox (story narration, text on an object): the box without name plate or portrait (ui_dialog_plain).
        public void Show(string speaker, string character, string text, IReadOnlyList<DialogueChoice> choices, bool plainBox = false)
        {
            Open = true; root.gameObject.SetActive(true);
            SetPlain(plainBox);
            SpeakerName = speaker ?? ""; speakerLabel.text = SpeakerName.ToUpperInvariant();
            if (namePlate && !plainBox)
            {
                // The plate hugs the name: text width plus about 30 px of padding on each side.
                float width = Mathf.Clamp(Mathf.Ceil(speakerLabel.preferredWidth) + 60, 120, 900);
                namePlate.rectTransform.sizeDelta = new Vector2(width, NamePlateHeight);
                speakerLabel.rectTransform.sizeDelta = new Vector2(width, NamePlateHeight);
            }
            fullText = text ?? ""; revealed = 0; Selected = 0;
            // Long lines get a smaller size once, so the layout never changes while the text types out.
            int size = hd ? (fullText.Length > 300 ? 24 : fullText.Length > 220 ? 27 : fullText.Length > 150 ? 30 : bodyDesign) : fullText.Length > 300 ? 14 : fullText.Length > 220 ? 15 : fullText.Length > 150 ? 16 : 18;
            if (UiKit.Wordwing)
            {
                // Wordwing is only sharp at 16 px multiples: 32 when the line fits the box, else 16.
                UiKit.Size(body, bodyDesign); body.text = Escape(fullText);
                size = body.preferredHeight > body.rectTransform.rect.height + 1 ? (hd ? nameDesign : 15) : bodyDesign;
            }
            UiKit.Size(body, size);
            portraitSprite = "portrait_" + character;
            portrait.enabled = !plainBox && PixelSprites.Has(portraitSprite);
            if (!portrait.enabled && !plainBox) Debug.LogWarning("Thiếu chân dung: " + portraitSprite);
            BuildChoices(choices);
            Refresh();
        }

        public bool Plain => plain;

        // Plain box: no name plate, no portrait; the text starts further left.
        private void SetPlain(bool value)
        {
            plain = value;
            string sprite = value ? UiKit.Pick("ui_dialog_plain", normalBox) : normalBox;
            boxFrame.sprite = PixelSprites.Get(sprite);
            portraitFrame.gameObject.SetActive(!value);
            if (namePlate) namePlate.gameObject.SetActive(!value);
            ApplyBox();
            if (!newBox) return;
            float left = value ? (hd ? 90 : 60) : BodyLeft;
            bodyRect.anchoredPosition = new Vector2(left, bodyRect.anchoredPosition.y);
            bodyRect.sizeDelta = new Vector2(BoxWidth - left - (hd ? 100 : 66), bodyRect.sizeDelta.y);
        }

        // Position and size of the box from topBox / plain (the airbase box never changes).
        private void ApplyBox()
        {
            bool compact = hd && plain;
            boxH = compact ? CompactHeight : BoxHeight;
            boxY = topBox ? TopBoxY : compact ? StoryLayout.Height - CompactMargin - CompactHeight : BoxY;
            boxFrame.rectTransform.anchoredPosition = new Vector2(BoxX, -boxY);
            boxFrame.rectTransform.sizeDelta = new Vector2(BoxWidth, boxH);
            if (!hd) return;
            bodyRect.anchoredPosition = new Vector2(bodyRect.anchoredPosition.x, compact ? -28 : -56);
            bodyRect.sizeDelta = new Vector2(bodyRect.sizeDelta.x, compact ? boxH - 56 : boxH - 104);
            nextArrow.rectTransform.anchoredPosition = new Vector2(BoxWidth - 96, -(boxH - 84));
        }

        public void Hide()
        {
            Open = false; fullText = ""; root.gameObject.SetActive(false);
            EventSystem.current?.SetSelectedGameObject(null);
        }

        public void Reveal() { revealed = fullText.Length; Refresh(); }

        public void MoveSelection(int delta)
        {
            if (rows.Count == 0 || Typing) return;
            Selected = (Selected + delta + rows.Count) % rows.Count;
            Refresh();
        }

        public void Hover(int index) { if (index >= 0 && index < rows.Count && !Typing) { Selected = index; Refresh(); } }

        // Advances the typewriter; returns how many letters appeared this frame (for the blip sound).
        public int Animate(float delta)
        {
            if (!Open) return 0;
            time += delta;
            int before = VisibleCharacters;
            if (Typing) revealed += delta * CharactersPerSecond;
            int typed = VisibleCharacters - before;
            Refresh();
            int letters = 0;
            for (int i = before; i < before + typed; i++) if (!char.IsWhiteSpace(fullText[i])) letters++;
            return letters;
        }

        private void BuildChoices(IReadOnlyList<DialogueChoice> choices)
        {
            foreach (var row in rows) Object.Destroy(row.Rect.gameObject);
            rows.Clear(); ThumbnailCount = 0;
            int count = choices?.Count ?? 0;
            float inset = newChoice ? 0 : 14; // new rows have no backing panel
            // Story layout: wide rows, never shrunk text; a long line wraps and its row grows (sized after the loop).
            float panelWidth = wideChoices ? WidePanelWidth : PanelWidth, flow = inset;
            float height = count * RowHeight + (newChoice ? 0 : 28);
            choicePanel.sizeDelta = new Vector2(panelWidth, height);
            choicePanel.anchoredPosition = new Vector2(BoxX + BoxWidth - panelWidth, -(boxY - (newChoice ? 20 : 12) - height));
            for (int i = 0; i < count; i++)
            {
                int index = i;
                var frame = UiKit.Framed("Choice " + (i + 1), choicePanel, inset, wideChoices ? flow : inset + i * RowHeight, panelWidth - 2 * inset, RowHeight - RowGap, cardName, choiceSlice);
                Text number = null;
                frame.raycastTarget = true;
                var button = frame.gameObject.AddComponent<Button>();
                button.targetGraphic = frame; button.transition = Selectable.Transition.None;
                button.navigation = new Navigation { mode = Navigation.Mode.None };
                button.onClick.AddListener(() => game.ChooseDialogue(index));
                var hover = frame.gameObject.AddComponent<EventTrigger>();
                var enter = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
                enter.callback.AddListener(_ => Hover(index));
                hover.triggers.Add(enter);
                // New rows have a wooden tab on the left: plain "N." instead of a keycap, text starts after it.
                float textX = 56, numberX = 0;
                if (newChoice)
                {
                    number = UiKit.Label((i + 1) + ".", frame.transform, hd ? 44 : 28, -1, hd ? 64 : 36, RowHeight - RowGap, choiceDesign, UiKit.Ink, false, TextAnchor.MiddleLeft);
                    textX = numberX = hd ? 120 : 64;
                }
                else
                {
                    var key = UiKit.Framed("Keycap", frame.transform, 10, 7, 34, 34, "ui_keycap", 2);
                    UiKit.Label((i + 1).ToString(), key.transform, 0, -2, 34, 32, 14, UiKit.Ink, true, TextAnchor.MiddleCenter);
                }
                if (DialogueActions.TryParseAccept(choices[i].Action, out _, out int environment) && environment >= 0 && environment < EnvironmentKeys.Length
                    && PixelSprites.Has("card_" + EnvironmentKeys[environment]))
                {
                    var thumb = UiKit.Sprite("Battlefield", frame.transform, numberX > 0 ? numberX : 54, 4, 72, 40, "card_" + EnvironmentKeys[environment]);
                    thumb.preserveAspect = true;
                    textX = (numberX > 0 ? numberX : 54) + 82; ThumbnailCount++;
                }
                string choiceText = choices[i].Text ?? "";
                // The row already prints "N.": drop a number the content wrote itself ("1. Rừng rậm").
                if (newChoice) choiceText = System.Text.RegularExpressions.Regex.Replace(choiceText, @"^\d+\.\s*", "");
                var label = UiKit.Label(choiceText, frame.transform, textX, -1, panelWidth - 2 * inset - textX - (hd ? 40 : 20), RowHeight - RowGap, choiceDesign, newChoice ? UiKit.Ink : UiKit.Cream);
                if (wideChoices)
                {
                    float rowHeight = Mathf.Max(RowHeight - RowGap, Mathf.Ceil(label.preferredHeight) + (hd ? 32 : 16));
                    frame.rectTransform.sizeDelta = new Vector2(panelWidth - 2 * inset, rowHeight);
                    label.rectTransform.sizeDelta = new Vector2(label.rectTransform.sizeDelta.x, rowHeight);
                    if (number) number.rectTransform.sizeDelta = new Vector2(hd ? 64 : 36, rowHeight);
                    flow += rowHeight + RowGap;
                }
                else UiKit.Fit(label, 10, choiceDesign);
                var pointer = UiKit.Box("Pointer", frame.transform, -14, 14, 16, 20, Color.white);
                if (!newChoice && PixelSprites.Has("ui_pointer")) pointer.sprite = PixelSprites.Get("ui_pointer"); else pointer.enabled = false;
                rows.Add(new Row { Rect = frame.rectTransform, Frame = frame, Pointer = pointer, Label = label });
            }
            if (!wideChoices || count == 0) return;
            height = flow - RowGap + inset;
            choicePanel.sizeDelta = new Vector2(panelWidth, height);
            float panelTop = topBox ? boxY + boxH + 14 : boxY - (newChoice ? 20 : 12) - height;
            choicePanel.anchoredPosition = new Vector2(BoxX + BoxWidth - panelWidth, -panelTop);
        }

        // Story layout: choice rows 1100 px wide with wrapped, full-size text; topBox puts the box (name plate, portrait) at
        // the top edge and the choices below it, so a picture's lower part stays visible. The airbase never calls this.
        public void SetStoryLayout(bool top)
        {
            wideChoices = true; topBox = top;
            ApplyBox();
        }

        public float BoxTop => boxY;
        public float BoxCentreY => boxY + boxH / 2;
        public float BoxHeightNow => boxH;
        public int ChoiceFontSize(int index) => index >= 0 && index < rows.Count ? rows[index].Label.fontSize : 0;
        public float ChoiceHeight(int index) => index >= 0 && index < rows.Count ? rows[index].Rect.sizeDelta.y : 0;
        public float ChoiceWidth(int index) => index >= 0 && index < rows.Count ? rows[index].Rect.sizeDelta.x : 0;

        private void Refresh()
        {
            if (!Open) return;
            int shown = VisibleCharacters;
            // The hidden rest keeps its space (transparent), so words never jump between lines.
            body.text = shown >= fullText.Length ? Escape(fullText) : Escape(fullText.Substring(0, shown)) + "<color=#00000000>" + Escape(fullText.Substring(shown)) + "</color>";
            if (portrait.enabled)
            {
                // Mouth flaps while the line types, then an occasional blink.
                int frame = Typing ? Mathf.FloorToInt(time * 8) % 2 : time % 3.4f > 3.25f ? 1 : 0;
                portrait.sprite = PixelSprites.Get(portraitSprite, frame);
            }
            bool arrow = !Typing && rows.Count == 0 && PixelSprites.Has("ui_dialog_next");
            if (nextArrow.enabled != arrow) nextArrow.enabled = arrow;
            if (arrow) nextArrow.sprite = PixelSprites.At("ui_dialog_next", time);
            bool choices = !Typing && rows.Count > 0;
            if (choicePanel.gameObject.activeSelf != choices) choicePanel.gameObject.SetActive(choices);
            for (int i = 0; i < rows.Count; i++)
            {
                bool selected = i == Selected;
                var card = PixelSprites.Get(selected ? cardSelectedName : cardName);
                if (rows[i].Frame.sprite != card) rows[i].Frame.sprite = card;
                rows[i].Label.color = newChoice ? UiKit.Ink : selected ? UiKit.Mint : UiKit.Cream;
                if (rows[i].Pointer.sprite) { rows[i].Pointer.enabled = selected; rows[i].Pointer.sprite = PixelSprites.At("ui_pointer", time); }
            }
        }

        // Rich text is on for the typewriter colour trick; dialogue never uses markup itself.
        private static string Escape(string value) => value.Replace("<", "‹");
    }
}

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
        private const float BoxX = 40, BoxY = 668, BoxWidth = 1360, BoxHeight = 208, RowHeight = 54, PanelWidth = 640;
        private static readonly string[] EnvironmentKeys = { "jungle", "desert", "ice", "ocean" };

        private sealed class Row { public RectTransform Rect; public Image Frame, Pointer; public Text Label; }

        private readonly FlightGame game;
        private readonly RectTransform root, choicePanel;
        private readonly Image portrait, choiceFrame;
        private readonly Text speakerLabel, body;
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
        public string SpeakerName { get; private set; } = "";
        public string Line => fullText;
        public string PortraitName => portrait.enabled && portrait.sprite ? portrait.sprite.name : "";
        public string ChoiceText(int index) => index >= 0 && index < rows.Count ? rows[index].Label.text : "";
        public Vector2 ChoiceScreenPoint(int index) =>
            RectTransformUtility.WorldToScreenPoint(null, rows[index].Rect.TransformPoint(rows[index].Rect.rect.center));

        public DialogueView(Transform parent, FlightGame game)
        {
            this.game = game;
            root = UiKit.Rect("Dialogue", parent, 0, 0, 1440, 900);
            var box = UiKit.Framed("Dialogue box", root, BoxX, BoxY, BoxWidth, BoxHeight, "ui_panel");
            box.raycastTarget = true; // Clicks on the box never reach anything behind it.
            UiKit.Framed("Portrait frame", box.transform, 22, 26, 156, 156, "ui_ink", 2);
            portrait = UiKit.Box("Portrait", box.transform, 28, 32, 144, 144, Color.white);
            speakerLabel = UiKit.Label("", box.transform, 202, 18, 1120, 34, 17, UiKit.Mint, true);
            body = UiKit.Label("", box.transform, 202, 56, 1126, 132, 18, UiKit.Cream);
            body.supportRichText = true; body.alignment = TextAnchor.UpperLeft;

            choiceFrame = UiKit.Framed("Choices", root, BoxX + BoxWidth - PanelWidth, BoxY - 12, PanelWidth, 40, "ui_panel");
            choiceFrame.raycastTarget = true;
            choicePanel = choiceFrame.rectTransform;
            choicePanel.gameObject.SetActive(false);
            root.gameObject.SetActive(false);
        }

        // speaker: display name (+ role); character: portrait id; choices: the runner's visible choices.
        public void Show(string speaker, string character, string text, IReadOnlyList<DialogueChoice> choices)
        {
            Open = true; root.gameObject.SetActive(true);
            SpeakerName = speaker ?? ""; speakerLabel.text = SpeakerName.ToUpperInvariant();
            fullText = text ?? ""; revealed = 0; Selected = 0;
            // Long lines get a smaller size once, so the layout never changes while the text types out.
            int size = fullText.Length > 300 ? 14 : fullText.Length > 220 ? 15 : fullText.Length > 150 ? 16 : 18;
            UiKit.Size(body, size);
            portraitSprite = "portrait_" + character;
            portrait.enabled = PixelSprites.Has(portraitSprite);
            if (!portrait.enabled) Debug.LogWarning("Thiếu chân dung: " + portraitSprite);
            BuildChoices(choices);
            Refresh();
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
            float height = count * RowHeight + 28;
            choicePanel.sizeDelta = new Vector2(PanelWidth, height);
            choicePanel.anchoredPosition = new Vector2(BoxX + BoxWidth - PanelWidth, -(BoxY - 12 - height));
            for (int i = 0; i < count; i++)
            {
                int index = i;
                var frame = UiKit.Framed("Choice " + (i + 1), choicePanel, 14, 14 + i * RowHeight, PanelWidth - 28, RowHeight - 6, "ui_card", 2);
                frame.raycastTarget = true;
                var button = frame.gameObject.AddComponent<Button>();
                button.targetGraphic = frame; button.transition = Selectable.Transition.None;
                button.navigation = new Navigation { mode = Navigation.Mode.None };
                button.onClick.AddListener(() => game.ChooseDialogue(index));
                var hover = frame.gameObject.AddComponent<EventTrigger>();
                var enter = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter };
                enter.callback.AddListener(_ => Hover(index));
                hover.triggers.Add(enter);
                var key = UiKit.Framed("Keycap", frame.transform, 10, 7, 34, 34, "ui_keycap", 2);
                UiKit.Label((i + 1).ToString(), key.transform, 0, -2, 34, 32, 14, UiKit.Ink, true, TextAnchor.MiddleCenter);
                float textX = 56;
                if (DialogueActions.TryParseAccept(choices[i].Action, out _, out int environment) && environment >= 0 && environment < EnvironmentKeys.Length
                    && PixelSprites.Has("card_" + EnvironmentKeys[environment]))
                {
                    var thumb = UiKit.Sprite("Battlefield", frame.transform, 54, 4, 72, 40, "card_" + EnvironmentKeys[environment]);
                    thumb.preserveAspect = true;
                    textX = 136; ThumbnailCount++;
                }
                var label = UiKit.Fit(UiKit.Label(choices[i].Text ?? "", frame.transform, textX, -1, PanelWidth - 28 - textX - 12, RowHeight - 6, 15, UiKit.Cream), 10, 15);
                var pointer = UiKit.Box("Pointer", frame.transform, -14, 14, 16, 20, Color.white);
                if (PixelSprites.Has("ui_pointer")) pointer.sprite = PixelSprites.Get("ui_pointer"); else pointer.enabled = false;
                rows.Add(new Row { Rect = frame.rectTransform, Frame = frame, Pointer = pointer, Label = label });
            }
        }

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
            bool choices = !Typing && rows.Count > 0;
            if (choicePanel.gameObject.activeSelf != choices) choicePanel.gameObject.SetActive(choices);
            for (int i = 0; i < rows.Count; i++)
            {
                bool selected = i == Selected;
                var card = PixelSprites.Get(selected ? "ui_card_selected" : "ui_card");
                if (rows[i].Frame.sprite != card) rows[i].Frame.sprite = card;
                rows[i].Label.color = selected ? UiKit.Mint : UiKit.Cream;
                if (rows[i].Pointer.sprite) { rows[i].Pointer.enabled = selected; rows[i].Pointer.sprite = PixelSprites.At("ui_pointer", time); }
            }
        }

        // Rich text is on for the typewriter colour trick; dialogue never uses markup itself.
        private static string Escape(string value) => value.Replace("<", "‹");
    }
}

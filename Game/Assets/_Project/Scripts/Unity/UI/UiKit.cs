using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public static class UiKit
    {
        public static readonly Color Ink = Hex("191D18");
        public static readonly Color Panel = Hex("30392F");
        public static readonly Color Line = Hex("505944");
        public static readonly Color Muted = Hex("B5BA9B");
        public static readonly Color Cream = Hex("F2E7C9");
        public static readonly Color Mint = Hex("D3BC78");
        public static readonly Color Orange = Hex("E2A75B");
        public static readonly Color Coral = Hex("E58F70");
        // VT323 (SIL OFL) is a pixel typeface with full Vietnamese coverage. Its glyphs are
        // smaller than Arial at the same point size, so design sizes are scaled by 1.3.
        public const float FontScale = 1.3f;
        public const float SliceScale = 3, ButtonSliceScale = 2;
        private static Font font;
        public static bool PixelFontLoaded { get; private set; }

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString("#" + hex, out Color color);
            return color;
        }

        // Main (Vietnamese) font: WordwingVi, then VT323, then an OS font.
        public static Font Font
        {
            get
            {
                if (font) return font;
                font = Resources.Load<Font>("Fonts/WordwingVi");
                if (!font) font = Resources.Load<Font>("Fonts/VT323-Regular");
                PixelFontLoaded = font;
                if (!font) font = Font.CreateDynamicFontFromOSFont(new[] { "Arial", "Segoe UI", "Liberation Sans" }, 24);
                if (!font) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                return font;
            }
        }

        // English words (enemy plates, typing box, vocabulary list): WordwingEn, else the main font.
        public static Font EnglishFont
        {
            get
            {
                if (!englishFont) englishFont = Resources.Load<Font>("Fonts/WordwingEn");
                return englishFont ? englishFont : Font;
            }
        }
        private static Font englishFont;

        public static Text English(Text text) { text.font = EnglishFont; return text; }

        // The new sprite when the forge produced it, else the old one.
        public static string Pick(string preferred, string fallback) => PixelSprites.Has(preferred) ? preferred : fallback;

        // Vietnamese digit grouping (5.981), the same as BaseContent.Variables in dialogue text.
        private static readonly System.Globalization.NumberFormatInfo VietnameseNumbers =
            new System.Globalization.NumberFormatInfo { NumberGroupSeparator = ".", NumberDecimalSeparator = "," };
        public static string Number(int value) => value.ToString("N0", VietnameseNumbers);

        // Wordwing fonts have a 16 px em and are only crisp at multiples of 16 (16, 32, 48...).
        public static bool Wordwing => Font && Font.name.StartsWith("Wordwing");
        public const int WordwingStep = 16;

        // Design sizes 9-15 -> 16, 16-27 -> 32, 28-39 -> 48 ... (the +.25 biases the rounding upwards). Other fonts: size x 1.3.
        public static int Px(int designSize) => Wordwing
            ? WordwingStep * Mathf.Max(1, Mathf.RoundToInt(designSize * FontScale / WordwingStep + .25f))
            : Mathf.RoundToInt(designSize * FontScale);
        public static void Size(Text text, int designSize) => text.fontSize = Px(designSize);
        // Next smaller size for shrink-to-fit loops (whole 16 steps for Wordwing, 2 px otherwise).
        public static int StepDown(int size) => Wordwing ? size - WordwingStep : size - 2;

        public static Text Fit(Text text, int minimum, int maximum)
        {
            if (!Wordwing) { text.resizeTextForBestFit = true; text.resizeTextMinSize = Px(minimum); text.resizeTextMaxSize = Px(maximum); return text; }
            // Wordwing: no Unity best-fit (it makes odd sizes); try the largest step, then 16-px steps down to the minimum.
            text.resizeTextForBestFit = false;
            var fit = text.gameObject.GetComponent<DiscreteFit>() ?? text.gameObject.AddComponent<DiscreteFit>();
            fit.Setup(text, Px(minimum), Px(maximum));
            return text;
        }

        // Re-picks the largest size that fits whenever the text or the box changes.
        private sealed class DiscreteFit : MonoBehaviour
        {
            private Text text;
            private int minimum, maximum;
            private string lastText;
            private Vector2 lastSize;

            public void Setup(Text target, int min, int max) { text = target; minimum = min; maximum = max; Apply(); }
            private void LateUpdate()
            {
                if (text && (text.text != lastText || text.rectTransform.rect.size != lastSize)) Apply();
            }

            private void Apply()
            {
                lastText = text.text; lastSize = text.rectTransform.rect.size;
                int size = maximum;
                for (; size > minimum; size -= WordwingStep)
                {
                    text.fontSize = size;
                    // Wrapping text only has to fit in height (long words break by character and add lines).
                    bool wide = text.horizontalOverflow == HorizontalWrapMode.Wrap || text.preferredWidth <= lastSize.x + 1;
                    if (wide && text.preferredHeight <= lastSize.y + 1) break;
                }
                text.fontSize = Mathf.Max(size, minimum);
            }
        }

        public static RectTransform Rect(string name, Transform parent, float x, float y, float width, float height)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0, 1);
            rect.anchoredPosition = new Vector2(x, -y);
            rect.sizeDelta = new Vector2(width, height);
            return rect;
        }

        public static Image Box(string name, Transform parent, float x, float y, float w, float h, Color color)
        {
            var image = Rect(name, parent, x, y, w, h).gameObject.AddComponent<Image>();
            image.color = color;
            image.raycastTarget = false;
            if (name == "Dialog" || name == "Telemetry" || name == "Question panel") Slice(image, "ui_panel");
            return image;
        }

        // Nine-slice pixel frame; border pixels are enlarged by an integer factor.
        public static Image Slice(Image image, string sprite, float scale = SliceScale, int frame = 0)
        {
            image.sprite = PixelSprites.Get(sprite, frame);
            image.type = Image.Type.Sliced;
            image.pixelsPerUnitMultiplier = 1 / scale;
            image.color = Color.white;
            return image;
        }

        public static Image Framed(string name, Transform parent, float x, float y, float w, float h, string sprite, float scale = SliceScale)
            => Slice(Box(name, parent, x, y, w, h, Color.white), sprite, scale);

        public static Image Sprite(string name, Transform parent, float x, float y, float w, float h, string sprite, int frame = 0)
        {
            var image = Box(name, parent, x, y, w, h, Color.white);
            image.sprite = PixelSprites.Get(sprite, frame);
            image.preserveAspect = true;
            return image;
        }

        public static Image Icon(string sprite, Transform parent, float x, float y, float size = 24) => Sprite("Icon " + sprite, parent, x, y, size, size, sprite);

        public static Text Label(string value, Transform parent, float x, float y, float w, float h,
            int size, Color color, bool bold = false, TextAnchor alignment = TextAnchor.MiddleLeft)
        {
            var text = Rect(value.Length > 28 ? value.Substring(0, 28) : value, parent, x, y, w, h).gameObject.AddComponent<Text>();
            text.font = Font;
            text.fontSize = Px(size);
            text.color = color;
            // VT323 has a single weight; synthetic bold smears pixel stems, so it is only used with the fallback font.
            text.fontStyle = bold && !PixelFontLoaded ? FontStyle.Bold : FontStyle.Normal;
            text.alignment = alignment;
            text.lineSpacing = .9f;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.supportRichText = false;
            text.raycastTarget = false;
            text.text = value;
            return text;
        }

        public static string StyleFor(Color background)
            => background == Mint || background == Orange ? "gold" : background == Cream ? "cream" : background == Coral ? "red" : "olive";

        public static Button Button(string label, Transform parent, float x, float y, float w, float h,
            Color background, Color foreground, UnityEngine.Events.UnityAction onClick)
            => Button(label, parent, x, y, w, h, StyleFor(background), foreground, onClick);

        public static Button Button(string label, Transform parent, float x, float y, float w, float h,
            string style, Color foreground, UnityEngine.Events.UnityAction onClick)
        {
            var image = Box(label, parent, x, y, w, h, Color.white);
            string sprite = "ui_button_" + style;
            Slice(image, sprite, ButtonSliceScale);
            image.raycastTarget = true;
            var button = image.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.transition = Selectable.Transition.SpriteSwap;
            button.spriteState = new SpriteState
            {
                highlightedSprite = PixelSprites.Get(sprite, 1),
                pressedSprite = PixelSprites.Get(sprite, 2),
                selectedSprite = PixelSprites.Get(sprite, 0),
                disabledSprite = PixelSprites.Get("ui_button_olive", 2)
            };
            button.navigation = new Navigation { mode = Navigation.Mode.None };
            button.onClick.AddListener(onClick);
            Label(label, image.transform, 8, -1, w - 16, h, 19, foreground, true, TextAnchor.MiddleCenter);
            return button;
        }

        public static InputField Input(string value, string placeholder, Transform parent, float x, float y, float w, float h, bool number = false)
        {
            var image = Framed("Input " + placeholder, parent, x, y, w, h, "ui_ink", ButtonSliceScale);
            image.raycastTarget = true;
            var field = image.gameObject.AddComponent<InputField>();
            field.targetGraphic = image;
            field.textComponent = Label("", image.transform, 12, 0, w - 24, h, 18, Cream);
            field.placeholder = Label(placeholder, image.transform, 12, 0, w - 24, h, 16, Muted);
            field.textComponent.verticalOverflow = VerticalWrapMode.Truncate;
            field.contentType = number ? InputField.ContentType.IntegerNumber : InputField.ContentType.Standard;
            field.lineType = InputField.LineType.SingleLine;
            field.characterLimit = number ? 6 : 80;
            field.text = value;
            field.caretWidth = 3;
            field.customCaretColor = true; field.caretColor = Mint;
            field.selectionColor = new Color(Mint.r, Mint.g, Mint.b, 0.35f);
            return field;
        }

        public static Dropdown Select(string[] options, int selected, Transform parent, float x, float y, float w, float h, UnityEngine.Events.UnityAction<int> changed)
        {
            var image = Framed("Select", parent, x, y, w, h, "ui_ink", ButtonSliceScale);
            image.raycastTarget = true;
            var dropdown = image.gameObject.AddComponent<Dropdown>();
            dropdown.targetGraphic = image;
            dropdown.captionText = Label("", image.transform, 12, 0, w - 42, h, 18, Cream, true);
            Label("v", image.transform, w - 31, 0, 22, h, 19, Mint, false, TextAnchor.MiddleCenter);
            var template = Framed("Template", image.transform, 0, h + 2, w, 174, "ui_panel", 2).rectTransform;
            var viewport = Box("Viewport", template, 4, 4, w - 8, 166, Color.clear).rectTransform;
            viewport.gameObject.AddComponent<RectMask2D>();
            var content = Rect("Content", viewport, 0, 0, w - 8, 34);
            var item = Box("Item", content, 0, 0, w - 8, 34, Line);
            item.raycastTarget = true;
            var toggle = item.gameObject.AddComponent<Toggle>();
            toggle.targetGraphic = item;
            toggle.graphic = Box("Selected", item.transform, 8, 12, 8, 8, Mint);
            dropdown.itemText = Label("", item.transform, 28, 0, w - 46, 34, 17, Cream);
            var scroll = template.gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = content;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            dropdown.template = template;
            template.gameObject.SetActive(false);
            dropdown.AddOptions(new System.Collections.Generic.List<string>(options));
            dropdown.SetValueWithoutNotify(selected);
            dropdown.onValueChanged.AddListener(changed);
            return dropdown;
        }
    }
}

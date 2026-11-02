using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public static class UiKit
    {
        public static readonly Color Ink = Hex("0B1720");
        public static readonly Color Panel = Hex("11252D");
        public static readonly Color Line = Hex("25404A");
        public static readonly Color Muted = Hex("8CA7AF");
        public static readonly Color Cream = Hex("F2EBD8");
        public static readonly Color Mint = Hex("A6E7CC");
        public static readonly Color Orange = Hex("F0B779");
        public static readonly Color Coral = Hex("F18D7C");
        private static Font font;

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString("#" + hex, out Color color);
            return color;
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
            return image;
        }

        public static Text Label(string value, Transform parent, float x, float y, float w, float h,
            int size, Color color, bool bold = false, TextAnchor alignment = TextAnchor.MiddleLeft)
        {
            if (!font)
            {
                font = Font.CreateDynamicFontFromOSFont(new[] { "Arial", "Segoe UI", "Liberation Sans" }, 24);
                if (!font) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }
            var text = Rect(value.Length > 28 ? value.Substring(0, 28) : value, parent, x, y, w, h).gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.color = color;
            text.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Truncate;
            text.supportRichText = false;
            text.raycastTarget = false;
            text.text = value;
            return text;
        }

        public static Button Button(string label, Transform parent, float x, float y, float w, float h,
            Color background, Color foreground, UnityEngine.Events.UnityAction onClick)
        {
            var image = Box(label, parent, x, y, w, h, background);
            image.raycastTarget = true;
            var button = image.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.13f, 1.13f, 1.13f, 1);
            colors.pressedColor = new Color(0.75f, 0.85f, 0.82f, 1);
            colors.selectedColor = Color.white;
            button.colors = colors;
            button.navigation = new Navigation { mode = Navigation.Mode.None };
            button.onClick.AddListener(onClick);
            Label(label, image.transform, 8, 0, w - 16, h, 19, foreground, true, TextAnchor.MiddleCenter);
            return button;
        }

        public static InputField Input(string value, string placeholder, Transform parent, float x, float y, float w, float h, bool number = false)
        {
            var image = Box("Input " + placeholder,parent,x,y,w,h,Ink);
            image.raycastTarget = true;
            var field = image.gameObject.AddComponent<InputField>();
            field.targetGraphic = image;
            field.textComponent = Label("",image.transform,12,0,w-24,h,18,Cream);
            field.placeholder = Label(placeholder,image.transform,12,0,w-24,h,16,Muted);
            field.contentType = number ? InputField.ContentType.IntegerNumber : InputField.ContentType.Standard;
            field.lineType = InputField.LineType.SingleLine;
            field.characterLimit = number ? 6 : 80;
            field.text = value;
            field.selectionColor = new Color(Mint.r,Mint.g,Mint.b,0.35f);
            return field;
        }

        public static Dropdown Select(string[] options,int selected,Transform parent,float x,float y,float w,float h,UnityEngine.Events.UnityAction<int> changed)
        {
            var image = Box("Select",parent,x,y,w,h,Ink);
            image.raycastTarget = true;
            var dropdown = image.gameObject.AddComponent<Dropdown>();
            dropdown.targetGraphic = image;
            dropdown.captionText = Label("",image.transform,12,0,w-42,h,18,Cream,true);
            Label("▾",image.transform,w-31,0,22,h,19,Mint);
            var template = Box("Template",image.transform,0,h+2,w,174,Panel).rectTransform;
            var viewport = Box("Viewport",template,0,0,w,174,Panel).rectTransform;
            viewport.gameObject.AddComponent<RectMask2D>();
            var content = Rect("Content",viewport,0,0,w,34);
            var item = Box("Item",content,0,0,w,34,Line);
            item.raycastTarget = true;
            var toggle = item.gameObject.AddComponent<Toggle>();
            toggle.targetGraphic = item;
            toggle.graphic = Box("Selected",item.transform,8,12,8,8,Mint);
            dropdown.itemText = Label("",item.transform,28,0,w-38,34,17,Cream);
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

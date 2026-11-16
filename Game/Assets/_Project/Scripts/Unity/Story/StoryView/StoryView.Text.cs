using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Text beats: a black screen. "ink" draws the handwritten sprite (see Picture), "type" types the characters one by
    // one like a typewriter, anything else shows the lines at once.
    public sealed partial class StoryView
    {
        public const float TypeCharactersPerSecond = 16;

        private RectTransform textGroup;
        private Text textLabel;
        private string fullText = "";
        private float revealed, typeSpeed;

        public bool TextVisible => textGroup.gameObject.activeSelf;
        public string FullText => fullText;
        public int TypedLength => Mathf.Min(fullText.Length, Mathf.FloorToInt(revealed));

        private void BuildText()
        {
            textGroup = UiKit.Rect("Text beat", root, 0, 0, StoryLayout.Width, StoryLayout.Height);
            textLabel = UiKit.Label("", textGroup, 80, 390, 1760, 300, 40, UiKit.Cream, false, TextAnchor.MiddleCenter);
            textLabel.supportRichText = true; textLabel.verticalOverflow = VerticalWrapMode.Overflow;
            textGroup.gameObject.SetActive(false);
        }

        private void ShowText(StoryBeat beat)
        {
            // Handwriting needs its sprite; without it the line is typed slowly so the screen is never empty.
            bool ink = beat.TextStyle == "ink";
            if (ink && Ready(beat.Sprite)) { ShowPicture(beat); return; }
            fullText = beat.Lines == null ? "" : string.Join("\n", beat.Lines);
            if (fullText.Length == 0) return;
            typeSpeed = ink ? 8 : beat.TextStyle == "type" ? TypeCharactersPerSecond : 10000;
            revealed = 0;
            textGroup.gameObject.SetActive(true);
            Render();
        }

        private void HideText() { fullText = ""; revealed = 0; if (textGroup) textGroup.gameObject.SetActive(false); }

        private void AnimateText(float dt)
        {
            if (fullText.Length == 0 || TypedLength >= fullText.Length) return;
            int before = TypedLength;
            revealed += dt * typeSpeed;
            for (int i = before; i < TypedLength; i++) if (!char.IsWhiteSpace(fullText[i])) TypedThisFrame++;
            Render();
        }

        // The hidden rest keeps its space (transparent) so the centred line does not shift while typing.
        private void Render()
        {
            int shown = TypedLength;
            string visible = fullText.Substring(0, shown).Replace("<", "‹"), rest = fullText.Substring(shown).Replace("<", "‹");
            textLabel.text = rest.Length == 0 ? visible : visible + "<color=#00000000>" + rest + "</color>";
        }
    }
}

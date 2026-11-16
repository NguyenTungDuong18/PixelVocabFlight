using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // HUD of the story: the hint line of the beat (kept on screen while the player can act), toasts, and the end card.
    public sealed partial class StoryView
    {
        private const float ToastSeconds = 2.6f;

        private CanvasGroup hintGroup, toastGroup;
        private RectTransform hintRect;
        private const float HintTop = 64, HintHeight = 112, HintBottom = StoryLayout.Height - 28 - HintHeight;
        private Text hintLabel, toastLabel, endLabel, endPrompt;
        private RectTransform endGroup;
        private string hintText = "";
        private float toastTimer;

        public string HintText => hintText;
        public bool HintVisible => hintGroup.alpha > .5f;
        public string ToastText => toastTimer > 0 ? toastLabel.text : "";
        public bool EndVisible => endGroup.gameObject.activeSelf;
        public string EndText => endLabel.text;

        private Text badgeLabel;
        // Trial mode (a segment picked from the list; nothing is saved): its number and name in the corner.
        public string BadgeText => badgeLabel.text;
        public void SetBadge(string text) { badgeLabel.text = text ?? ""; }

        private void BuildHint()
        {
            badgeLabel = UiKit.Label("", root, 960, 8, 930, 48, StoryLayout.SmallDesign, UiKit.Muted, false, TextAnchor.MiddleRight);
            var panel = UiKit.Framed("Story hint", root, 210, HintTop, 1500, HintHeight, "ui_panel", 4);
            hintRect = panel.rectTransform;
            hintGroup = panel.gameObject.AddComponent<CanvasGroup>(); hintGroup.alpha = 0;
            hintLabel = UiKit.Fit(UiKit.Label("", panel.transform, 40, 0, 1420, 112, StoryLayout.ChoiceDesign, UiKit.Cream, false, TextAnchor.MiddleCenter), StoryLayout.NameDesign, StoryLayout.ChoiceDesign);
        }

        private void BuildToast()
        {
            var plate = UiKit.Framed("Story toast", root, 460, 170, 1000, 84, "ui_plate", 4);
            toastGroup = plate.gameObject.AddComponent<CanvasGroup>(); toastGroup.alpha = 0;
            toastLabel = UiKit.Fit(UiKit.Label("", plate.transform, 20, -1, 960, 84, StoryLayout.ChoiceDesign, UiKit.Cream, true, TextAnchor.MiddleCenter), StoryLayout.NameDesign, StoryLayout.ChoiceDesign);
        }

        private void BuildEnd()
        {
            endGroup = UiKit.Rect("End card", root, 0, 0, StoryLayout.Width, StoryLayout.Height);
            UiKit.Box("End rule top", endGroup, 560, 360, 800, 4, UiKit.Line);
            endLabel = UiKit.Label("", endGroup, 120, 400, 1680, 260, StoryLayout.BodyDesign, UiKit.Cream, false, TextAnchor.UpperCenter);
            UiKit.Box("End rule bottom", endGroup, 560, 700, 800, 4, UiKit.Line);
            endPrompt = UiKit.Label("[ENTER]  Về màn hình chính", endGroup, 0, 760, StoryLayout.Width, 64, StoryLayout.ChoiceDesign, UiKit.Mint, true, TextAnchor.MiddleCenter);
            endGroup.gameObject.SetActive(false);
        }

        private void ShowEnd(StoryBeat beat)
        {
            endLabel.text = beat.Lines == null ? "" : string.Join("\n", beat.Lines);
            endGroup.gameObject.SetActive(true);
        }

        private void HideEnd() { if (endGroup) endGroup.gameObject.SetActive(false); }

        // In a room the hint sits at the bottom (the top of the picture is the wall with its hanging objects); elsewhere at the top,
        // under the corner badge.
        public void SetHint(string text)
        {
            hintText = text ?? ""; hintLabel.text = hintText;
            float y = Current != null && Current.Kind == StoryBeatKind.Map ? HintBottom : HintTop;
            hintRect.anchoredPosition = new Vector2(hintRect.anchoredPosition.x, -y);
        }

        public void ShowToast(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            toastLabel.text = text; toastTimer = ToastSeconds; toastGroup.alpha = 1;
        }

        private void ClearToast() { toastTimer = 0; toastGroup.alpha = 0; }

        private void AnimateHud(float dt)
        {
            // The hint stays while the player can act: not during a dialogue, a fade or an auto-advancing frame's caption.
            bool show = hintText.Length > 0 && !Dialogue.Open && !Transitioning && Current != null && Current.Kind != StoryBeatKind.End;
            hintGroup.alpha = Mathf.MoveTowards(hintGroup.alpha, show ? 1 : 0, dt * 4);
            toastTimer = Mathf.Max(0, toastTimer - dt);
            toastGroup.alpha = Mathf.Clamp01(toastTimer / .4f);
            if (endGroup.gameObject.activeSelf) endPrompt.enabled = time % 1.1f < .75f;
        }
    }
}

using UnityEngine;

namespace PixelVocabFlight
{
    // What Unity draws over the film: the letterbox (108 px bars from the start, retracting in 0.7 s from the BarsOff cue) with the skip
    // hint, and the logo, which slams in at the Title cue. Both are functions of the clock, so a jump (Finish) lands on the right picture.
    public sealed partial class TitleScene
    {
        private static readonly Vector2 LogoCorner = new Vector2(64, 48);   // top-left of the final logo (x4)

        private static float Ease(float u) { u = Mathf.Clamp01(u); return u * u * (3 - 2 * u); }

        // Whole-number scale of the logo n film frames after the Title cue: x6 for 2 frames, x5 for 2, then x4.
        public static int LogoScaleAt(int frames) => frames < 2 ? 6 : frames < 4 ? 5 : 4;

        private void Overlays(float t)
        {
            bool intro = t < IntroSeconds;
            barHeight = !intro ? 0 : barsOffTime < 0 || t < barsOffTime ? BarHeight : Mathf.Round(Mathf.Lerp(BarHeight, 0, Ease((t - barsOffTime) / .7f)));
            bool bars = barHeight > .5f;
            barTop.enabled = barBottom.enabled = bars;
            barTop.rectTransform.sizeDelta = barBottom.rectTransform.sizeDelta = new Vector2(W, barHeight);
            barBottom.rectTransform.anchoredPosition = new Vector2(0, -(H - barHeight));
            hint.enabled = bars;
            hint.color = new Color(UiKit.Cream.r, UiKit.Cream.g, UiKit.Cream.b, .8f * barHeight / BarHeight);

            // The logo appears at the Title cue (at the end of the intro when the film has none).
            bool shownNow = !intro || (titleTime >= 0 && t >= titleTime);
            LogoAlpha = shownNow ? 1 : 0;
            LogoScale = intro && shownNow ? LogoScaleAt(Mathf.FloorToInt((t - titleTime) * fps)) : 4;
            float alpha = ShowLogo ? LogoAlpha : 0;
            var size = logoSize * (LogoScale / 4f);
            var centre = LogoCorner + logoSize / 2;   // the slam grows around the centre of the final rectangle
            logo.rectTransform.sizeDelta = size;
            logo.rectTransform.anchoredPosition = new Vector2(Mathf.Round(centre.x - size.x / 2), -Mathf.Round(centre.y - size.y / 2));
            logo.color = logo.sprite ? new Color(1, 1, 1, alpha) : Color.clear;
            logoText.color = new Color(UiKit.Cream.r, UiKit.Cream.g, UiKit.Cream.b, alpha);
        }
    }
}

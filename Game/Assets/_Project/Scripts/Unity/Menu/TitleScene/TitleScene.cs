using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // The intro and the background of the main menu: a pre-rendered pixel film (Resources/Cinema/title_intro.bytes, format WWC1,
    // 480x270 at 30 fps; see TitleScene.Film.cs) played full screen at x4. Frames [0, LoopStart) are the intro (about 10 s, any key
    // skips it); frames [LoopStart, FrameCount) loop behind the menu. Shake, flashes, impact frames and sun glare are baked into the
    // frames. Unity only draws the letterbox with the skip hint and the logo slam, and turns the film's cues (gunfire, explosions,
    // the logo hit...) into sounds through TakeCue. No file: a flat sky colour, one warning, MissingSprites lists "Cinema/title_intro".
    // Partial files: Film (loading, decoding, cues), Overlay (letterbox, logo).
    public sealed partial class TitleScene
    {
        // Cue kinds in the film file.
        public const int CueShot = 0, CueBurst = 1, CueBoom = 2, CueBigBoom = 3, CueWhoosh = 4, CueFlak = 5, CueTitle = 6, CueBarsOff = 7, CueHit = 8;

        private const float W = StoryLayout.Width, H = StoryLayout.Height;
        private const float BarHeight = 108;

        private readonly RectTransform root;
        private readonly RawImage screen;
        private readonly Image barTop, barBottom, logo;
        private readonly Text logoText, hint;
        private readonly HashSet<string> missing = new HashSet<string>();
        private readonly Vector2 logoSize;
        private float barHeight;

        public float Time { get; private set; }
        public bool Finished => Time >= IntroSeconds;
        public bool Visible { get => root.gameObject.activeSelf; set { if (root.gameObject.activeSelf != value) root.gameObject.SetActive(value); } }
        public IReadOnlyCollection<string> MissingSprites => missing;
        public bool ShowLogo = true;
        // Test hooks.
        public bool LetterboxVisible => barHeight > .5f;
        public float LogoAlpha { get; private set; }
        public int LogoScale { get; private set; } = 4;

        public TitleScene(Transform parent)
        {
            root = UiKit.Rect("Title scene", parent, 0, 0, W, H);
            screen = UiKit.Rect("Film", root, 0, 0, W, H).gameObject.AddComponent<RawImage>();
            screen.raycastTarget = false;
            LoadFilm();
            screen.texture = texture;

            barTop = UiKit.Box("Letterbox top", root, 0, 0, W, BarHeight, Color.black);
            barBottom = UiKit.Box("Letterbox bottom", root, 0, H - BarHeight, W, BarHeight, Color.black);
            hint = UiKit.Label("Nhấn phím bất kỳ để bỏ qua", root, 0, H - BarHeight + 26, W - 64, 56, StoryLayout.SmallDesign, UiKit.Cream, false, TextAnchor.MiddleRight);
            bool hasLogo = false;
            try { hasLogo = PixelSprites.Has("logo") && PixelSprites.Frames("logo").Length > 0; }
            catch (System.InvalidOperationException exception) { Debug.LogWarning(exception.Message); }
            if (!hasLogo) { missing.Add("logo"); Debug.LogWarning("Màn hình chờ thiếu sprite: logo"); }
            logoSize = hasLogo ? PixelSprites.Size("logo", StoryLayout.Scale) : new Vector2(656, 272);
            logo = UiKit.Box("Logo", root, 64, 48, logoSize.x, logoSize.y, Color.white);
            if (hasLogo) { logo.sprite = PixelSprites.Get("logo", 0); logo.preserveAspect = true; }
            else logo.color = Color.clear;
            logoText = UiKit.Label("WORDWING", root, 64, 48, 900, 160, 60, UiKit.Cream, true, TextAnchor.MiddleLeft);
            logoText.enabled = !hasLogo;
            Restart();
        }

        public void Restart() { Time = 0; pending.Clear(); cueDone = 0; Advance(true); Layout(); }

        // Jump to the start of the loop (a key was pressed, or back from the story): no letterbox, logo shown, skipped cues are not played.
        public void Finish() { Time = IntroSeconds; pending.Clear(); Advance(false); Layout(); }

        public void Animate(float dt) { Time += dt; Advance(true); Layout(); }

        private void Layout() { Show(Frame); Overlays(Time); }
    }
}

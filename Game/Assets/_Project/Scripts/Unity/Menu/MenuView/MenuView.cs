using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Every screen outside the story itself, in the 1920x1080 shell canvas: the intro, the main menu, the save slots, the
    // segment list, the settings and the pause panel. A page is a title plus a column of MenuEntry rows; FlightGame.Menu
    // builds the pages and reads the keys, this class only draws and reports. Partial files: Rows (widgets).
    public sealed partial class MenuView
    {
        private readonly RectTransform root, listRoot;
        private readonly Image backdrop, dim, footerStrip, marker;
        private readonly Text titleLabel, subtitleLabel, footerLabel;
        private float time;
        private Vector2 lastPointer;
        private float pointerMovedAt = -10;

        public TitleScene Scene { get; }
        public bool Visible { get => root.gameObject.activeSelf; set { if (root.gameObject.activeSelf != value) root.gameObject.SetActive(value); } }
        public string PageTitle => titleLabel.text;
        public string Subtitle => subtitleLabel.text;
        public string FooterText => footerLabel.text;
        public bool DimVisible => dim.enabled;
        public bool SceneVisible => Scene.Visible;

        public MenuView(Transform parent, FlightGame game)
        {
            root = UiKit.Rect("Menu", parent, 0, 0, StoryLayout.Width, StoryLayout.Height);
            backdrop = UiKit.Box("Menu backdrop", root, -2000, -2000, 5920, 5080, Color.black);
            backdrop.raycastTarget = true;
            Scene = new TitleScene(root);
            dim = UiKit.Box("Menu dim", root, -2000, -2000, 5920, 5080, new Color(0, 0, 0, .7f));
            dim.raycastTarget = true; dim.enabled = false;
            // Sub-pages hug the left edge like the main page (the hero sits right of centre): title and subtitle start at x=48.
            titleLabel = UiKit.Label("", root, 48, 70, 1000, 80, StoryLayout.BodyDesign, UiKit.Cream, true, TextAnchor.MiddleLeft);
            subtitleLabel = UiKit.Label("", root, 48, 150, 1000, 56, StoryLayout.NameDesign, UiKit.Cream, false, TextAnchor.MiddleLeft);
            // Page text sits on bright cloud: a hard dark drop shadow one source pixel (4 px) down-right keeps it readable.
            foreach (var label in new[] { titleLabel, subtitleLabel })
            {
                var shadow = label.gameObject.AddComponent<Shadow>();
                shadow.effectColor = new Color(.05f, .07f, .12f, .9f); shadow.effectDistance = new Vector2(4, -4);
            }
            listRoot = UiKit.Rect("Menu list", root, 0, 0, StoryLayout.Width, StoryLayout.Height);
            marker = UiKit.Box("Row marker", listRoot, 0, 0, 48, 48, Color.white);   // 12 px source x4, beside the chosen row
            marker.enabled = false;
            // Key hints: a metal strip (ui_menu_footer; a dark strip before the forge) with 48 px cream text so they read on the bright clouds.
            footerStrip = UiKit.Box("Footer strip", root, 0, 996, StoryLayout.Width, 84, new Color(0, 0, 0, .6f));
            if (PixelSprites.Has("ui_menu_footer")) UiKit.Slice(footerStrip, "ui_menu_footer", 4);
            footerLabel = UiKit.Label("", root, 0, 1004, StoryLayout.Width, 68, StoryLayout.ChoiceDesign, UiKit.Cream, false, TextAnchor.MiddleCenter);
            root.gameObject.SetActive(false);
        }

        // The intro: the scene alone, no rows.
        public void ShowBoot()
        {
            Visible = true; Scene.Visible = true; Scene.Restart();
            backdrop.enabled = true; dim.enabled = false;
            ClearRows(); titleLabel.text = subtitleLabel.text = ""; footerLabel.text = "";
            footerStrip.enabled = false;   // the skip hint lives in the intro's letterbox (TitleScene)
        }

        // A page over the scene (overlay false) or over the story (overlay true: dimmed, no scene, no backdrop).
        public void ShowPage(string title, IList<MenuEntry> items, int selected = 0, bool overlay = false, string subtitle = "", bool logo = false)
        {
            Visible = true;
            Scene.Visible = !overlay; backdrop.enabled = !overlay; dim.enabled = overlay;
            Scene.ShowLogo = logo;   // sub-pages start high and would cover the logo
            footerStrip.enabled = true;
            titleLabel.text = title ?? ""; subtitleLabel.text = subtitle ?? "";
            footerLabel.text = "W/S: chọn   ·   Enter: xác nhận   ·   A/D: chỉnh   ·   Esc: quay lại";
            Build(items, selected, logo);
        }

        public void Hide() { ClearRows(); Visible = false; }

        // The pointer counts as moved (and may select a row by hovering) only when it really moved; a rebuilt page under a resting
        // pointer must not take the selection away from the keyboard.
        private void TrackPointer()
        {
            if (UnityEngine.InputSystem.Mouse.current == null) return;
            var p = UnityEngine.InputSystem.Mouse.current.position.ReadValue();
            if (p != lastPointer) { lastPointer = p; pointerMovedAt = UnityEngine.Time.unscaledTime; }
        }

        public void Animate(float dt)
        {
            TrackPointer();
            time += dt;
            if (!Visible) return;
            if (Scene.Visible) Scene.Animate(dt);
            RefreshRows();
        }

        // Pause over the story keeps the scene frozen (it is hidden); only the rows animate.
        public void AnimateRows(float dt) { TrackPointer(); time += dt; if (Visible) RefreshRows(); }
    }
}

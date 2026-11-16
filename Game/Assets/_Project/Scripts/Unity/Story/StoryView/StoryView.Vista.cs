using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Vista: the player picks a far object. Every hotspot has a thin frame (hit box in picture px x3); the chosen one
    // is bright with a plate "[E] Xem <label>". A/D or the mouse choose, E or a click uses it.
    public sealed partial class StoryView
    {
        private sealed class HotFrame { public StoryHotspot Spot; public Image[] Edges; }

        private const float PlateHeight = 72;
        private readonly List<HotFrame> hot = new List<HotFrame>();
        private RectTransform hotLayer;
        private Image hotPlate;
        private Text hotLabel;
        private int selected;

        public int HotspotCount => hot.Count;
        public int SelectedIndex => selected;
        public string SelectedHotspot => selected >= 0 && selected < hot.Count ? hot[selected].Spot.Id : null;
        public string SelectedLabelText => hotPlate && hotPlate.gameObject.activeInHierarchy ? hotLabel.text : "";
        // Test hook: the frames and plate are on screen (hidden while a dialogue is open).
        public bool HotspotsVisible => hotLayer && hotLayer.gameObject.activeInHierarchy;

        private void EnsureHotLayer()
        {
            if (hotLayer) return;
            hotLayer = UiKit.Rect("Hotspots", pictureGroup, 0, 0, StoryLayout.Width, StoryLayout.Height);
            hotPlate = UiKit.Framed("Hotspot plate", hotLayer, 0, 0, 300, PlateHeight, "ui_plate", 4);
            hotLabel = UiKit.Label("", hotPlate.transform, 0, -1, 300, PlateHeight, StoryLayout.ChoiceDesign, UiKit.Cream, true, TextAnchor.MiddleCenter);
            hotLabel.horizontalOverflow = HorizontalWrapMode.Overflow;
        }

        private void ShowHotspots(StoryBeat beat)
        {
            HideHotspots();
            if (beat.Hotspots == null || beat.Hotspots.Length == 0) return;
            EnsureHotLayer();
            hotLayer.gameObject.SetActive(true);
            hotLayer.SetAsLastSibling();   // the picture layers were rebuilt after it
            foreach (var spot in beat.Hotspots)
            {
                var frame = new HotFrame { Spot = spot, Edges = new Image[4] };
                float x = spot.X * PictureScale, y = spot.Y * PictureScale, w = spot.W * PictureScale, h = spot.H * PictureScale, t = PictureScale;
                frame.Edges[0] = UiKit.Box("Top", hotLayer, x, y, w, t, Color.white);
                frame.Edges[1] = UiKit.Box("Bottom", hotLayer, x, y + h - t, w, t, Color.white);
                frame.Edges[2] = UiKit.Box("Left", hotLayer, x, y, t, h, Color.white);
                frame.Edges[3] = UiKit.Box("Right", hotLayer, x + w - t, y, t, h, Color.white);
                hot.Add(frame);
            }
            hotPlate.transform.SetAsLastSibling();
            // Start on the first object not seen yet.
            selected = 0;
            for (int i = 0; i < hot.Count; i++) if (!Seen(hot[i].Spot.Id)) { selected = i; break; }
            AnimateVista();
        }

        private void HideHotspots()
        {
            foreach (var frame in hot) foreach (var edge in frame.Edges) Destroy(edge.gameObject);
            hot.Clear(); selected = 0;
            if (hotLayer) hotLayer.gameObject.SetActive(false);
        }

        public void MoveHotspot(int delta) { if (hot.Count > 0) selected = (selected + delta + hot.Count) % hot.Count; }
        public void SelectHotspot(int index) { if (index >= 0 && index < hot.Count) selected = index; }

        // Index of the hotspot under a screen point (mouse), -1 for none.
        public int HotspotAt(Vector2 screenPoint)
        {
            if (hot.Count == 0 || !RectTransformUtility.ScreenPointToLocalPointInRectangle(root, screenPoint, null, out var local)) return -1;
            float x = local.x, y = -local.y;   // root pivot is its top-left corner
            for (int i = 0; i < hot.Count; i++)
            {
                var s = hot[i].Spot;
                if (x >= s.X * PictureScale && x < (s.X + s.W) * PictureScale && y >= s.Y * PictureScale && y < (s.Y + s.H) * PictureScale) return i;
            }
            return -1;
        }

        private void AnimateVista()
        {
            if (hot.Count == 0) return;
            // Frames and the "[E] Xem" plate are only for choosing; while a dialogue is open they would sit on top of it.
            bool show = !Dialogue.Open;
            if (hotLayer.gameObject.activeSelf != show) hotLayer.gameObject.SetActive(show);
            if (!show) return;
            float pulse = .65f + .35f * Mathf.Sin(time * 6);
            for (int i = 0; i < hot.Count; i++)
            {
                bool chosen = i == selected;
                var color = chosen ? new Color(UiKit.Cream.r, UiKit.Cream.g, UiKit.Cream.b, pulse) : Seen(hot[i].Spot.Id) ? new Color(UiKit.Mint.r, UiKit.Mint.g, UiKit.Mint.b, .3f) : new Color(1, 1, 1, .28f);
                foreach (var edge in hot[i].Edges) edge.color = color;
            }
            var spot = hot[selected].Spot;
            hotLabel.text = "[E] Xem " + spot.Label + (Seen(spot.Id) ? "  (đã xem)" : "");
            float width = Mathf.Ceil(hotLabel.preferredWidth) + 64;
            hotPlate.rectTransform.sizeDelta = new Vector2(width, PlateHeight);
            hotLabel.rectTransform.sizeDelta = new Vector2(width, PlateHeight);
            float left = Mathf.Clamp(spot.X * PictureScale + spot.W * PictureScale / 2 - width / 2, 8, StoryLayout.Width - width - 8);
            float top = Mathf.Max(8, spot.Y * PictureScale - PlateHeight - 10);
            hotPlate.rectTransform.anchoredPosition = new Vector2(Mathf.Round(left), -Mathf.Round(top));
        }
    }
}

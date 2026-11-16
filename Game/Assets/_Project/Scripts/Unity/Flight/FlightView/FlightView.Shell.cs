using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightView
    {
        // The story, the intro and every menu live in their own canvas: 1920x1080 reference (StoryLayout), always 16:9, drawn
        // above the airbase canvas. CanvasScaler Expand scales it to fit the window; any other window shape shows black bars
        // (the layout rect stays 16:9 and every full-screen layer has a black backdrop that reaches past it).
        private Canvas shellCanvas;
        public Canvas ShellCanvas => shellCanvas;
        // The 1920x1080 layout rect (for the smoke test: its on-screen shape must be 16:9).
        public RectTransform ShellLayout { get; private set; }

        private RectTransform CreateShell()
        {
            var go = new GameObject("Story interface", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            shellCanvas = go.GetComponent<Canvas>(); shellCanvas.renderMode = RenderMode.ScreenSpaceOverlay; shellCanvas.sortingOrder = 20;
            var scaler = go.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = StoryLayout.Size; scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            var layout = UiKit.Rect("Shell layout", go.transform, 0, 0, StoryLayout.Width, StoryLayout.Height);
            layout.anchorMin = layout.anchorMax = layout.pivot = new Vector2(.5f, .5f); layout.anchoredPosition = Vector2.zero;
            ShellLayout = layout;
            return layout;
        }

        // The 16:9 area on screen in pixels (x, y, width, height), from the layout rect's corners.
        public Rect ShellScreenRect
        {
            get
            {
                var corners = new Vector3[4];
                ShellLayout.GetWorldCorners(corners);
                return new Rect(corners[0].x, corners[0].y, corners[2].x - corners[0].x, corners[2].y - corners[0].y);
            }
        }
    }
}

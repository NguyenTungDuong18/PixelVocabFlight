using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Cut and Vista: the background sprite and the animated layers over it, plus the caption and the close-up.
    public sealed partial class StoryView
    {
        private static readonly Color MissingBackdrop = new Color(.05f, .06f, .1f, 1);
        private sealed class Layer { public Image Image; public string Name; }

        private RectTransform pictureGroup;
        private CanvasGroup pictureAlpha;
        private Image pictureBack, closeUp;
        private readonly List<Layer> layers = new List<Layer>();
        // Time per sprite name. A sprite used by two beats in a row keeps its clock: the lid stays open in P1.06 and
        // the rain does not restart.
        private Dictionary<string, float> clocks = new Dictionary<string, float>();
        private bool captionOpen;

        public bool PictureVisible => pictureGroup.gameObject.activeSelf;
        public bool CaptionOpen => captionOpen;
        public string BackgroundName => layers.Count > 0 ? layers[0].Name : "";
        public int LayerCount => layers.Count;
        public bool HasLayer(string name) => layers.Exists(l => l.Name == name);
        public string LayerSpriteName(string name) { var l = layers.Find(x => x.Name == name); return l != null && l.Image.sprite ? l.Image.sprite.name : ""; }
        public bool CloseUpVisible => closeUp.enabled;
        public string CloseUpName { get; private set; } = "";

        private void BuildPicture()
        {
            pictureGroup = UiKit.Rect("Picture", root, 0, 0, StoryLayout.Width, StoryLayout.Height);
            pictureAlpha = pictureGroup.gameObject.AddComponent<CanvasGroup>();
            pictureBack = UiKit.Box("Picture back", pictureGroup, 0, 0, StoryLayout.Width, StoryLayout.Height, Color.black);
            pictureGroup.gameObject.SetActive(false);
        }

        private void BuildCloseUp()
        {
            closeUp = UiKit.Box("Close-up", root, 0, 0, StoryLayout.Width, StoryLayout.Height, Color.white);
            closeUp.preserveAspect = false; closeUp.enabled = false;
        }

        // sprite + Layers of the beat, all 480x270 art px drawn at 1920x1080. A Text beat in "ink" style uses it too.
        private void ShowPicture(StoryBeat beat)
        {
            pictureGroup.gameObject.SetActive(true);
            pictureAlpha.alpha = 1;
            foreach (var layer in layers) Destroy(layer.Image.gameObject);
            layers.Clear();
            var names = new List<string>();
            if (beat.Sprite != null) names.Add(beat.Sprite);
            if (beat.Layers != null) names.AddRange(beat.Layers);
            var next = new Dictionary<string, float>();
            foreach (var name in names)
            {
                next[name] = clocks.TryGetValue(name, out float t) ? t : 0;
                if (!Ready(name)) continue;
                var image = UiKit.Box("Layer " + name, pictureGroup, 0, 0, StoryLayout.Width, StoryLayout.Height, Color.white);
                image.sprite = PixelSprites.Get(name, 0); image.preserveAspect = false;
                layers.Add(new Layer { Image = image, Name = name });
            }
            clocks = next;
            // Cut and Vista pictures need their background; Text "ink" draws over black.
            bool backgroundMissing = beat.Kind != StoryBeatKind.Text && beat.Sprite != null && !Ready(beat.Sprite);
            pictureBack.color = backgroundMissing ? MissingBackdrop : Color.black;
        }

        private static void Destroy(GameObject target) { target.SetActive(false); Object.Destroy(target); }

        private void HidePicture() { if (pictureGroup) pictureGroup.gameObject.SetActive(false); }

        private void AnimatePicture(float dt)
        {
            if (!pictureGroup.gameObject.activeSelf) return;
            var keys = new List<string>(clocks.Keys);
            foreach (var key in keys) clocks[key] += dt;
            foreach (var layer in layers) layer.Image.sprite = PixelSprites.At(layer.Name, clocks[layer.Name]);
            // The handwritten line fades away over the last second of its frame.
            if (Current.Kind == StoryBeatKind.Text && Current.Seconds > 0) pictureAlpha.alpha = Mathf.Clamp01(Current.Seconds - BeatTime);
        }

        // Cut caption: the plain box (no name, no portrait) with the unnamed line.
        private void ShowCaption(StoryBeat beat)
        {
            if (beat.Lines == null || beat.Lines.Length == 0) return;
            Dialogue.Show("", null, string.Join("\n", beat.Lines), null, true);
            captionOpen = true;
        }

        // Close-up behind the dialogue of a touched object (StoryHotspot.Cut); null hides it.
        public void ShowCloseUp(string sprite)
        {
            CloseUpName = sprite ?? "";
            if (sprite == null || !Ready(sprite)) { closeUp.enabled = false; return; }
            closeUp.sprite = PixelSprites.Get(sprite, 0); closeUp.enabled = true;
        }

        public void HideCloseUp() { CloseUpName = ""; if (closeUp) closeUp.enabled = false; }
    }
}

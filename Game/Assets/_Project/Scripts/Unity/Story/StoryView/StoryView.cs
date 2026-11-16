using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Act 0 screens (FlightGame Mode.Story). Draws the current StoryBeat of Act0Content: black text, cut-ins and vistas
    // (480x300 art drawn 3x), the walkable room (a BaseView in story mode) and the dialogue box. Only reads state;
    // FlightGame owns the StoryRunner, input and sound. Partial files: Text, Picture (cut + vista), Vista (hotspots),
    // Map, Staging (who sits where), Hud (hint, toast, end card).
    public sealed partial class StoryView
    {
        public const float FadeSeconds = .2f;   // fade to black and back = 0.4 s per change of frame
        public const float PictureScale = StoryLayout.Scale;   // tranh 480x270 px -> 1920x1080 (StoryLayout)

        private enum Fade { None, Out, In }

        private readonly RectTransform root;
        private readonly Image fadeImage;
        private readonly HashSet<string> missing = new HashSet<string>();
        private readonly Dictionary<string, bool> ready = new Dictionary<string, bool>();
        private StoryBeat pending;
        private Fade fade;
        private float fadeAlpha = 1, time;

        public StoryView(Transform parent, RectTransform canvasRect, FlightGame game)
        {
            root = UiKit.Rect("Story", parent, 0, 0, StoryLayout.Width, StoryLayout.Height);
            var back = UiKit.Box("Story backdrop", root, -2000, -2000, 5920, 5080, Color.black);
            back.raycastTarget = true;   // clicks never reach the airbase UI underneath
            BuildPicture();
            map = new BaseView(root, canvasRect, true);
            BuildCloseUp();
            BuildText();
            BuildEnd();
            BuildHint();
            Dialogue = new DialogueView(root, game, true);
            BuildToast();
            fadeImage = UiKit.Box("Story fade", root, -2000, -2000, 5920, 5080, Color.black);
            root.gameObject.SetActive(false);
        }

        public bool Visible { get => root.gameObject.activeSelf; set { if (root.gameObject.activeSelf != value) root.gameObject.SetActive(value); } }
        public DialogueView Dialogue { get; }
        public BaseView Map => map;
        // FlightGame sets these: the beat is about to be shown (world, sound and dialogue are set up there, then Show runs).
        public Action<StoryBeat> OnSwap;
        public Func<string, bool> Seen = id => false;

        public StoryBeat Current { get; private set; }
        public float BeatTime { get; private set; }
        public bool Transitioning => fade != Fade.None;
        public string BeatId => Current?.Id ?? "";
        public float FadeAlpha => fadeAlpha;
        // Letters typed this frame (the typewriter click).
        public int TypedThisFrame { get; private set; }
        // Names of sprites the beats asked for that are not in the manifest (art not forged yet).
        public IReadOnlyCollection<string> MissingSprites
        {
            get
            {
                var all = new SortedSet<string>(missing);
                foreach (var name in map.MissingNames) all.Add(name);
                return all;
            }
        }

        // Goes to black, shows the beat (OnSwap), then fades back in. Called again while fading: the newest beat wins.
        public void Begin(StoryBeat beat)
        {
            pending = beat;
            fade = Fade.Out;
        }

        // A fresh start (entering Mode.Story): nothing shown, the first beat appears from black.
        public void Reset()
        {
            Current = null; pending = null; fade = Fade.None; fadeAlpha = 1; BeatTime = 0;
            HideAll(); map.Reset(); mapWorld = null; Dialogue.Hide(); ClearToast(); SetHint(null); SetBadge(null);
        }

        public void Animate(float dt)
        {
            TypedThisFrame = 0;
            if (fade == Fade.Out)
            {
                fadeAlpha = Mathf.Min(1, fadeAlpha + dt / FadeSeconds);
                if (fadeAlpha >= 1)
                {
                    var beat = pending; pending = null; fade = Fade.In;
                    if (beat != null) OnSwap?.Invoke(beat);
                }
            }
            else if (fade == Fade.In)
            {
                fadeAlpha = Mathf.Max(0, fadeAlpha - dt / FadeSeconds);
                if (fadeAlpha <= 0) fade = Fade.None;
            }
            fadeImage.color = new Color(0, 0, 0, fadeAlpha);
            fadeImage.enabled = fadeAlpha > 0.001f;
            if (Current == null) return;
            time += dt; BeatTime += dt;
            AnimatePicture(dt);
            AnimateText(dt);
            AnimateMap(dt);
            AnimateVista();
            AnimateHud(dt);
        }

        // Called at the middle of the fade, with the world of the beat (null when the beat has no map).
        public void Show(StoryBeat beat, BaseWorld world)
        {
            Current = beat; BeatTime = 0;
            HideAll();
            // Over a vista or other picture the box goes to the top edge: the characters lie at the bottom of the picture.
            Dialogue.SetStoryLayout(beat.Kind == StoryBeatKind.Vista || (beat.Kind == StoryBeatKind.Dialogue && beat.Map == null && beat.Sprite != null));
            switch (beat.Kind)
            {
                case StoryBeatKind.Text: ShowText(beat); break;
                case StoryBeatKind.Cut: ShowPicture(beat); ShowCaption(beat); break;
                case StoryBeatKind.Vista: ShowPicture(beat); ShowHotspots(beat); break;
                case StoryBeatKind.Map: ShowMap(beat, world); break;
                case StoryBeatKind.Dialogue:
                    if (beat.Map != null) ShowMap(beat, world);
                    else if (beat.Sprite != null) ShowPicture(beat);
                    break;
                case StoryBeatKind.End: ShowEnd(beat); break;
            }
            SetHint(beat.Hint);
        }

        private void HideAll()
        {
            HidePicture(); HideText(); HideMap(); HideHotspots(); HideCloseUp(); HideEnd();
            if (captionOpen) { Dialogue.Hide(); captionOpen = false; }
        }

        // A sprite the beat names; missing ones are skipped with a warning (once) and listed in MissingSprites.
        private bool Ready(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            if (ready.TryGetValue(name, out bool ok)) return ok;
            ok = false;
            try { ok = PixelSprites.Has(name) && PixelSprites.Frames(name).Length > 0; }
            catch (InvalidOperationException exception) { Debug.LogWarning(exception.Message); }
            ready[name] = ok;
            if (!ok) { missing.Add(name); Debug.LogWarning("Màn truyện thiếu sprite: " + name); }
            return ok;
        }
    }
}

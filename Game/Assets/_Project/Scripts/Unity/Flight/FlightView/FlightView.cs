using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightView
    {
        // The cockpit panel art (Tools/PixelForge/ui.cjs, COCKPIT) is 720x124 px shown at 2x below the field.
        private const float CockpitTop = 652, TakeOffSeconds = 5.7f;
        // Take-off roll: engine start, then distance = RollAcceleration * t^2 (display px) along the runway.
        // The camera starts following once the fighter has moved FollowAfter px up the screen.
        private const float EngineStartSeconds = 1.3f, RollAcceleration = 260, FollowAfter = 160, FollowSeconds = 3.6f, TileHeight = 960;
        private static readonly Color Phosphor = UiKit.Hex("8CF59A"), PhosphorDim = UiKit.Hex("3FA457"), Brass = UiKit.Hex("E3C77A");
        private readonly FlightGame game;
        private readonly Canvas canvas;
        private readonly RectTransform root, overlay, header, cockpit;
        private readonly CanvasGroup headerGroup, cockpitGroup;
        private readonly Image curtain;
        private readonly Text score, combo, supplyLabel, armorLabel, question, kind, feedback, wave, topic, region, recent, modeHint;
        private readonly Text fuelValue, speedValue, clockValue;
        private readonly Image fuelNeedle, speedNeedle, clockNeedle, lever;
        private readonly Image[] lamps = new Image[FlightProgress.MaximumMetal];
        private readonly Image inputFrame, caret;
        private readonly Text inputText, placeholder;
        private readonly Text muteLabel, rollLabel;
        private readonly Image muteIcon;
        private readonly Button fireButton, rollButton;
        private readonly Dropdown pos;
        private float fuelAngle = 135, speedAngle = -135, leverPosition, caretTimer;
        private string lastInput = "";
        private bool lastFocused;
        // Take-off cutscene (airfield strip + runway) state.
        private Image airfieldScene, takeOffHero, takeOffHeroShadow;
        private RawImage airfieldClouds;
        private RectTransform takeOffTag, airfieldWorld;
        private float launchScroll;
        private readonly List<(Image image, float age, Vector2 velocity)> puffs = new List<(Image, float, Vector2)>();
        private float airfieldTime, propellerTime, launchTime = -1, puffTimer;
        private readonly List<string> history = new List<string>();
        private readonly string[] posValues = { "", "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "exclamation", "auxiliary verb", "modal verb", "linking verb", "definite article", "indefinite article", "ordinal number", "infinitive marker" };
        private readonly string[] posLabels = { "TỪ LOẠI…", "Danh từ", "Động từ", "Tính từ", "Trạng từ", "Đại từ", "Giới từ", "Liên từ", "Từ hạn định", "Số từ", "Thán từ", "Trợ động từ", "Động từ khuyết thiếu", "Động từ nối", "Mạo từ xác định", "Mạo từ bất định", "Số thứ tự", "Dấu nguyên mẫu (to)" };
        public FlightBoardView Board { get; }
        public VocabularySetupView Setup { get; private set; }
        // 0.15: the walkable airbase (main screen) and its dialogue box.
        public BaseView Base { get; }
        public DialogueView Dialogue { get; }
        public bool TakeOffVisible => airfieldWorld;
        public bool OverlayVisible => overlay.gameObject.activeSelf;
        public bool PartOfSpeechOpen => pos.transform.Find("Dropdown List") != null;
        public string SelectedPartOfSpeech => posValues[pos.value];
        // Test hooks for the cockpit and the take-off sequence.
        public float HudAlpha => cockpitGroup.alpha;
        public float CurtainAlpha => curtain.color.a;
        public bool CaretVisible => caret.enabled;
        public bool PlaceholderVisible => placeholder.enabled;
        public string InputSpriteName => inputFrame.sprite ? inputFrame.sprite.name : "";
        public string InputText => inputText.text;
        public float CaretGap => caret.rectTransform.anchoredPosition.x - (inputText.rectTransform.anchoredPosition.x + MeasureWidth(inputText, inputText.text));
        public bool Launching => launchTime >= 0;
        public float TakeOffElapsed => Mathf.Max(0, launchTime);
        public Vector2 TakeOffHeroPosition => takeOffHero ? takeOffHero.rectTransform.anchoredPosition : Vector2.zero;
        public Vector2 TakeOffHeroSize => takeOffHero ? takeOffHero.rectTransform.sizeDelta : Vector2.zero;
        public int TakeOffSmokePuffs => puffs.Count;
        public float TakeOffScroll => launchScroll;
        public static readonly string[] EnvironmentNames = { "RỪNG RẬM", "SA MẠC", "BĂNG GIÁ", "BIỂN" };

        public FlightView(FlightGame game)
        {
            this.game = game;
            var go = new GameObject("Flight interface", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvas = go.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1440, 900); scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            root = UiKit.Rect("Layout", go.transform, 0, 0, 1440, 900);
            root.anchorMin = root.anchorMax = root.pivot = new Vector2(.5f, .5f); root.anchoredPosition = Vector2.zero;
            if (!EventSystem.current) new GameObject("Input events", typeof(EventSystem), typeof(InputSystemUIInputModule));
            UiKit.Box("Background", root, -1000, -1000, 3440, 2900, UiKit.Ink);

            // ---- Header strip (fades in with the cockpit at the start of a sortie) ----
            header = UiKit.Rect("Header", root, 0, 0, 1440, 100);
            headerGroup = header.gameObject.AddComponent<CanvasGroup>();
            UiKit.Sprite("Logo", header, 40, 14, 168, 68, "logo");
            region = UiKit.Label("FLIGHT COMMAND", header, 240, 20, 470, 32, 18, UiKit.Mint, true);
            wave = UiKit.Label("Mỗi vùng 3 phút", header, 240, 54, 470, 26, 12, UiKit.Muted);
            UiKit.Icon("icon_medal", header, 735, 26, 36);
            score = UiKit.Label("000000", header, 782, 18, 200, 42, 30, UiKit.Cream, true);
            combo = UiKit.Label("COMBO ×1.00", header, 782, 58, 300, 24, 13, UiKit.Mint, true);
            var mute = UiKit.Button("ÂM: BẬT", header, 1092, 29, 152, 44, "olive", UiKit.Muted, game.ToggleMute);
            muteLabel = mute.GetComponentInChildren<Text>(); muteLabel.alignment = TextAnchor.MiddleRight; muteLabel.rectTransform.sizeDelta -= new Vector2(10, 0);
            muteIcon = UiKit.Icon("icon_sound_on", mute.transform, 12, 10, 24);
            var pause = UiKit.Button("ESC: DỪNG", header, 1256, 29, 144, 44, "olive", UiKit.Cream, game.TogglePause);
            UiKit.Icon("icon_pause", pause.transform, 10, 10, 24);
            pause.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleRight;
            UiKit.Box("Divider", header, 40, 91, 1360, 2, UiKit.Line);

            Board = new FlightBoardView(root, game);

            // ---- Cockpit instrument panel ----
            cockpit = UiKit.Rect("Cockpit", root, 0, CockpitTop, 1440, 248);
            cockpitGroup = cockpit.gameObject.AddComponent<CanvasGroup>();
            var panel = UiKit.Sprite("Instrument panel", cockpit, 0, 0, 1440, 248, "cockpit_panel");
            panel.preserveAspect = false;
            // Leather coaming: sortie, last radio message, control mode.
            topic = Shadowed(UiKit.Label("OXFORD 5000", cockpit, 18, 1, 340, 24, 11, UiKit.Hex("E8D3A8"), true));
            feedback = Shadowed(UiKit.Fit(UiKit.Label("", cockpit, 372, 1, 696, 24, 12, UiKit.Mint, true, TextAnchor.MiddleCenter), 9, 12));
            modeHint = Shadowed(UiKit.Label("ĐANG LÁI · TAB", cockpit, 1080, 1, 342, 24, 12, UiKit.Hex("E8D3A8"), true, TextAnchor.MiddleRight));
            // Gauges: fuel (left), airspeed and sweep clock (right).
            fuelNeedle = Gauge("Fuel", 42, 48, "XĂNG", out fuelValue);
            speedNeedle = Gauge("Airspeed", 582, 48, null, out speedValue);
            clockNeedle = Gauge("Clock", 644, 48, null, out clockValue);
            // Armour warning lamps and the brass supply placard.
            for (int i = 0; i < lamps.Length; i++) lamps[i] = UiKit.Sprite("Armor lamp " + (i + 1), cockpit, 164 + i * 34, 48, 28, 28, "ui_lamp_green");
            armorLabel = UiKit.Label("GIÁP 5/5", cockpit, 166, 88, 164, 20, 11, Brass, true);
            supplyLabel = UiKit.Fit(UiKit.Label("", cockpit, 166, 106, 164, 42, 9, UiKit.Cream), 7, 9);
            rollButton = UiKit.Button("ĐỔI NGHĨA (3)", cockpit, 30, 168, 304, 52, "olive", UiKit.Mint, game.RollMeaning);
            rollLabel = rollButton.GetComponentInChildren<Text>(); UiKit.Size(rollLabel, 15);
            UiKit.Icon("icon_radio", rollButton.transform, 14, 14, 24);
            // Decoder CRT: the Vietnamese meaning of the current target.
            UiKit.Label("ĐIỆN ĐÀI · GIẢI MÃ MỤC TIÊU", cockpit, 384, 46, 340, 18, 10, PhosphorDim, true);
            recent = UiKit.Label("", cockpit, 724, 46, 336, 18, 10, PhosphorDim, true, TextAnchor.MiddleRight);
            question = UiKit.Fit(UiKit.Label("Sẵn sàng cất cánh?", cockpit, 384, 64, 672, 62, 30, Phosphor, true, TextAnchor.MiddleCenter), 14, 30);
            var glow = question.gameObject.AddComponent<Outline>(); glow.effectColor = new Color(.3f, 1, .45f, .18f); glow.effectDistance = new Vector2(2, -2);
            kind = UiKit.Fit(UiKit.Label("", cockpit, 384, 122, 672, 20, 11, PhosphorDim, false, TextAnchor.MiddleCenter), 8, 11);
            var scan = UiKit.Box("Scanlines", cockpit, 370, 46, 700, 98, Color.white);
            scan.sprite = PixelSprites.Get("ui_scanline"); PixelSprites.Texture("ui_scanline").wrapMode = TextureWrapMode.Repeat;
            scan.type = Image.Type.Tiled; scan.pixelsPerUnitMultiplier = .5f;
            // Typing box: framed slot, prompt, text, caret and placeholder.
            inputFrame = UiKit.Framed("Typing", cockpit, 362, 168, 488, 52, "ui_input", 2);
            inputFrame.raycastTarget = true;
            var focusButton = inputFrame.gameObject.AddComponent<Button>();
            focusButton.transition = Selectable.Transition.None; focusButton.navigation = new Navigation { mode = Navigation.Mode.None };
            focusButton.onClick.AddListener(game.FocusTyping);
            UiKit.Label(">", inputFrame.transform, 14, -1, 20, 52, 20, Brass, true, TextAnchor.MiddleCenter);
            inputText = UiKit.Label("", inputFrame.transform, 38, -1, 436, 52, 22, UiKit.Cream);
            inputText.horizontalOverflow = HorizontalWrapMode.Overflow;
            placeholder = UiKit.Label("NHẬP ĐỂ BẮN", inputFrame.transform, 38, -1, 436, 52, 18, UiKit.Muted);
            caret = UiKit.Box("Caret", inputFrame.transform, 38, 14, 4, 24, Brass);
            pos = UiKit.Select(posLabels, 0, cockpit, 866, 170, 212, 48, _ => EventSystem.current?.SetSelectedGameObject(null));
            pos.template.anchoredPosition = new Vector2(0, 176); // Open upwards, within the viewport.
            UiKit.Size(pos.captionText, 15);
            fireButton = UiKit.Button("BẮN   [ENTER]", cockpit, 1110, 170, 312, 48, "red", UiKit.Cream, game.Submit);
            UiKit.Size(fireButton.GetComponentInChildren<Text>(), 20);
            // Mode lever: up = LÁI (drive), down = BẮN (fire).
            lever = UiKit.Sprite("Mode lever", cockpit, 1356, 36, 64, 116, "ui_lever");
            lever.preserveAspect = false; lever.raycastTarget = true;
            var leverButton = lever.gameObject.AddComponent<Button>();
            leverButton.transition = Selectable.Transition.None; leverButton.navigation = new Navigation { mode = Navigation.Mode.None };
            leverButton.onClick.AddListener(game.ToggleControlMode);

            // Walkable base above the flight layers; menus, results and the take-off use the overlay on top of it.
            Base = new BaseView(root, (RectTransform)canvas.transform);
            Dialogue = new DialogueView(Base.Root, game);

            overlay = UiKit.Box("Overlay", root, 0, 0, 1440, 900, new Color(.07f, .085f, .065f, 1f)).rectTransform;
            overlay.GetComponent<Image>().raycastTarget = true;
            curtain = UiKit.Box("Curtain", root, -1000, -1000, 3440, 2900, new Color(0, 0, 0, 0));
        }

        private static Text Shadowed(Text text)
        {
            var shadow = text.gameObject.AddComponent<Shadow>(); shadow.effectColor = new Color(0, 0, 0, .8f); shadow.effectDistance = new Vector2(2, -2);
            return text;
        }

        // Gauge centre in art px of the panel; the needle sprite is 56x56 art px (112 display px).
        private Image Gauge(string name, float cx, float cy, string caption, out Text value)
        {
            float x = cx * 2, y = cy * 2;
            if (caption != null) UiKit.Label(caption, cockpit, x - 34, y - 24, 68, 14, 8, UiKit.Muted, true, TextAnchor.MiddleCenter);
            value = UiKit.Label("", cockpit, x - 36, y + 28, 72, 16, 10, UiKit.Cream, true, TextAnchor.MiddleCenter);
            var needle = UiKit.Sprite(name + " needle", cockpit, x - 56, y - 56, 112, 112, "gauge_needle");
            return needle;
        }

        private static void PointNeedle(Image needle, float degrees)
            => needle.sprite = PixelSprites.Get("gauge_needle", Mathf.RoundToInt(Mathf.Repeat(degrees, 360) / 7.5f) % 48);

        private static float MeasureWidth(Text text, string value)
        {
            if (string.IsNullOrEmpty(value)) return 0;
            var settings = text.GetGenerationSettings(new Vector2(10000, text.rectTransform.rect.height));
            settings.horizontalOverflow = HorizontalWrapMode.Overflow; settings.resizeTextForBestFit = false;
            // Measure with a sentinel so trailing spaces count.
            float with = text.cachedTextGeneratorForLayout.GetPreferredWidth(value + "|", settings);
            float sentinel = text.cachedTextGeneratorForLayout.GetPreferredWidth("|", settings);
            return (with - sentinel) / text.pixelsPerUnit;
        }

        private void ClearOverlay()
        {
            Setup = null; airfieldScene = takeOffHero = takeOffHeroShadow = null; airfieldClouds = null;
            takeOffTag = airfieldWorld = null; launchScroll = 0; puffs.Clear(); launchTime = -1; pos.Hide();
            // Cockpit controls stay inert behind menus and the base so Enter can never open or press them there; Refresh re-enables them in flight.
            pos.interactable = fireButton.interactable = rollButton.interactable = false;
            EventSystem.current?.SetSelectedGameObject(null);
            for (int i = overlay.childCount - 1; i >= 0; i--) { var child = overlay.GetChild(i).gameObject; child.SetActive(false); UnityEngine.Object.Destroy(child); }
            overlay.gameObject.SetActive(true);
        }

        private RectTransform ClearOverlay(float x, float y, float width, float height)
        {
            ClearOverlay();
            return UiKit.Box("Dialog", overlay, x, y, width, height, UiKit.Panel).rectTransform;
        }

        public bool Capture(string path)
        {
            var camera = Camera.main; var previousMode = canvas.renderMode; var previousCamera = canvas.worldCamera;
            var previousTarget = camera.targetTexture; var previousActive = RenderTexture.active;
            var targetTexture = RenderTexture.GetTemporary(1280, 800, 24, RenderTextureFormat.ARGB32); Texture2D image = null;
            try
            {
                canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = camera; canvas.planeDistance = 1; camera.targetTexture = targetTexture;
                Canvas.ForceUpdateCanvases(); var request = new UniversalRenderPipeline.SingleCameraRequest { destination = targetTexture };
                if (RenderPipeline.SupportsRenderRequest(camera, request)) RenderPipeline.SubmitRenderRequest(camera, request); else camera.Render();
                RenderTexture.active = targetTexture; image = new Texture2D(1280, 800, TextureFormat.RGB24, false);
                image.ReadPixels(new Rect(0, 0, 1280, 800), 0, 0); image.Apply(); File.WriteAllBytes(path, image.EncodeToPNG()); return true;
            }
            catch (Exception exception) { Debug.LogException(exception); return false; }
            finally
            {
                canvas.renderMode = previousMode; canvas.worldCamera = previousCamera; camera.targetTexture = previousTarget; RenderTexture.active = previousActive;
                RenderTexture.ReleaseTemporary(targetTexture); if (image) UnityEngine.Object.Destroy(image);
            }
        }
    }
}

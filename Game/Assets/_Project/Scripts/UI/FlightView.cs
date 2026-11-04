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
    public sealed class FlightView
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
        // Title screen (hangar) animation state.
        private Image hangarScene, hangarHero, hangarHeroShadow, hangarPointer;
        private RawImage hangarClouds;
        private RectTransform hangarBrand, hangarBoard, hangarHelp, hangarTag, hangarWorld;
        private float launchScroll;
        private readonly List<Image> squadron = new List<Image>();
        private readonly List<(Image image, float age, Vector2 velocity)> puffs = new List<(Image, float, Vector2)>();
        private float hangarTime, propellerTime, launchTime = -1, puffTimer;
        private int hangarSelected;
        private readonly List<string> history = new List<string>();
        private readonly string[] posValues = { "", "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "exclamation", "auxiliary verb", "modal verb", "linking verb", "definite article", "indefinite article", "ordinal number", "infinitive marker" };
        private readonly string[] posLabels = { "TỪ LOẠI…", "Danh từ", "Động từ", "Tính từ", "Trạng từ", "Đại từ", "Giới từ", "Liên từ", "Từ hạn định", "Số từ", "Thán từ", "Trợ động từ", "Động từ khuyết thiếu", "Động từ nối", "Mạo từ xác định", "Mạo từ bất định", "Số thứ tự", "Dấu nguyên mẫu (to)" };
        public FlightBoardView Board { get; }
        public VocabularySetupView Setup { get; private set; }
        public bool HangarVisible { get; private set; }
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
        public float HangarBoardX => hangarBoard ? hangarBoard.anchoredPosition.x : 0;
        public float HangarBrandX => hangarBrand ? hangarBrand.anchoredPosition.x : 0;
        public Vector2 HangarHeroPosition => hangarHero ? hangarHero.rectTransform.anchoredPosition : Vector2.zero;
        public Vector2 HangarHeroSize => hangarHero ? hangarHero.rectTransform.sizeDelta : Vector2.zero;
        public int HangarSmokePuffs => puffs.Count;
        public float HangarScroll => launchScroll;
        public static readonly string[] EnvironmentNames = { "RỪNG RẬM", "SA MẠC", "BĂNG GIÁ", "BIỂN" };
        private static readonly string[] EnvironmentKeys = { "jungle", "desert", "ice", "ocean" };
        private static readonly string[] EnvironmentRules =
        {
            "Rừng nhiệt đới · máy bay địch xuất hiện dày hơn 30%.",
            "Bắc Phi · gõ đúng từ VÀ chọn đúng từ loại.",
            "Mặt trận mùa đông · địch có khiên băng, cần trúng 2 lần.",
            "Thái Bình Dương · tàu sân bay phóng rocket 4 lựa chọn."
        };

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
            Setup = null; HangarVisible = false; hangarScene = hangarHero = hangarHeroShadow = hangarPointer = null; hangarClouds = null;
            hangarBrand = hangarBoard = hangarHelp = hangarTag = hangarWorld = null; launchScroll = 0; squadron.Clear(); puffs.Clear(); launchTime = -1; pos.Hide();
            // Cockpit controls stay inert behind menus so Enter can never open or press them there; Refresh re-enables them in flight.
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

        // ---------------- Title screen: top-down airbase, battlefield cards, take-off ----------------
        public void ShowHangar(VocabularyFilter filter, int available, FlightEnvironment environment)
        {
            ClearOverlay();
            SetCurtain(0); SetHudAlpha(1);
            HangarVisible = true; hangarSelected = (int)environment;
            // The airfield is a tall strip the camera can follow: airbase, then the base edge with its
            // perimeter fence, then runway cut through the jungle (PixelForge runway.cjs, 4x scale).
            hangarWorld = UiKit.Rect("Airfield", overlay, 0, 0, 1440, 900);
            hangarScene = UiKit.Sprite("Airbase", hangarWorld, 0, 0, 1440, 900, "title_airbase");
            hangarScene.preserveAspect = false;
            UiKit.Sprite("Base edge", hangarWorld, 0, -TileHeight, 1440, TileHeight, "title_runway_edge").preserveAspect = false;
            for (int k = 0; k < 3; k++) UiKit.Sprite("Jungle runway", hangarWorld, 0, -TileHeight * (k + 2), 1440, TileHeight, "title_runway_jungle").preserveAspect = false;
            // Parked hero fighter on the runway, scene scale 4x (same sprite as in flight).
            hangarHeroShadow = UiKit.Sprite("Hero shadow", overlay, 588 + 6, 500 + 8, 128, 128, "fighter_shadow");
            hangarHero = UiKit.Sprite("Hero fighter", overlay, 588, 500, 128, 128, "fighter_level");
            for (int i = 0; i < 3; i++)
            {
                squadron.Add(UiKit.Sprite("Squadron shadow", overlay, 0, 0, 96, 96, "fighter_shadow"));
                squadron.Add(UiKit.Sprite("Squadron fighter", overlay, 0, 0, 96, 96, "fighter_level"));
            }
            var clouds = new GameObject("Clouds", typeof(RectTransform), typeof(RawImage));
            var cloudRect = clouds.GetComponent<RectTransform>(); cloudRect.SetParent(overlay, false);
            cloudRect.anchorMin = cloudRect.anchorMax = cloudRect.pivot = new Vector2(0, 1); cloudRect.anchoredPosition = Vector2.zero; cloudRect.sizeDelta = new Vector2(1440, 900);
            hangarClouds = clouds.GetComponent<RawImage>(); hangarClouds.raycastTarget = false;
            var cloudTexture = PixelSprites.Texture("title_clouds"); cloudTexture.wrapMode = TextureWrapMode.Repeat; hangarClouds.texture = cloudTexture;
            var tag = UiKit.Framed("Hero tag", overlay, 500, 640, 304, 34, "ui_plate", 2);
            hangarTag = tag.rectTransform; tag.gameObject.AddComponent<CanvasGroup>();
            UiKit.Label("SKYLARK MK.I  ·  PHI CÔNG 01", tag.transform, 0, 0, 304, 34, 14, UiKit.Mint, true, TextAnchor.MiddleCenter);

            // Brand block.
            var brand = UiKit.Framed("Brand", overlay, 28, 24, 400, 214, "ui_panel");
            hangarBrand = brand.rectTransform;
            UiKit.Sprite("Logo", brand.transform, 32, 18, 336, 136, "logo");
            UiKit.Label("PHI ĐỘI TỪ VỰNG  ·  1944", brand.transform, 0, 154, 400, 26, 16, UiKit.Mint, true, TextAnchor.MiddleCenter);
            UiKit.Label("Bắn hạ máy bay địch bằng từ vựng Oxford", brand.transform, 0, 180, 400, 22, 12, UiKit.Muted, false, TextAnchor.MiddleCenter);

            // Mission board.
            var boardImage = UiKit.Framed("Mission board", overlay, 900, 24, 512, 852, "ui_panel");
            hangarBoard = boardImage.rectTransform; var board = boardImage.transform;
            UiKit.Icon("icon_radio", board, 26, 24, 30);
            UiKit.Label("LỆNH XUẤT KÍCH", board, 66, 18, 420, 40, 26, UiKit.Cream, true);
            UiKit.Label("CHỌN CHIẾN TRƯỜNG  ·  PHÍM 1 – 4", board, 28, 60, 460, 24, 12, UiKit.Mint, true);
            for (int i = 0; i < 4; i++)
            {
                int index = i; bool selected = i == hangarSelected; float y = 94 + i * 124;
                var cardImage = UiKit.Framed("Battlefield " + EnvironmentNames[i], board, 24, y, 464, 112, selected ? "ui_card_selected" : "ui_card");
                cardImage.raycastTarget = true;
                var card = cardImage.gameObject.AddComponent<Button>();
                card.targetGraphic = cardImage; card.navigation = new Navigation { mode = Navigation.Mode.None };
                var colors = card.colors; colors.highlightedColor = new Color(1, .95f, .8f); colors.pressedColor = new Color(.8f, .8f, .75f); colors.selectedColor = Color.white; card.colors = colors;
                card.onClick.AddListener(() => game.ChooseStartingEnvironment(index));
                UiKit.Sprite("Thumbnail", cardImage.transform, 14, 20, 128, 72, "card_" + EnvironmentKeys[i]);
                var key = UiKit.Framed("Hotkey", cardImage.transform, 8, 12, 30, 30, "ui_keycap", 2);
                UiKit.Label((i + 1).ToString(), key.transform, 0, -2, 30, 28, 15, UiKit.Ink, true, TextAnchor.MiddleCenter);
                UiKit.Label(EnvironmentNames[i], cardImage.transform, 158, 12, 290, 34, 22, selected ? UiKit.Mint : UiKit.Cream, true);
                UiKit.Label(EnvironmentRules[i], cardImage.transform, 158, 46, 290, 40, 13, selected ? UiKit.Cream : UiKit.Muted);
                if (selected)
                {
                    UiKit.Label("ĐÃ CHỌN", cardImage.transform, 158, 84, 200, 20, 11, UiKit.Mint, true);
                    hangarPointer = UiKit.Sprite("Selected pointer", board, 4, y + 42, 16, 20, "ui_pointer");
                }
            }
            int count = filter.from >= 1 && filter.to <= available && filter.to >= filter.from ? filter.to - filter.from + 1 : 0;
            string[] facts = { count.ToString("N0") + " TỪ", "5 GIÁP", "3 ĐỔI", "3:00/VÙNG" };
            string[] factIcons = { "icon_target", "icon_armor", "icon_radio", "icon_clock" };
            for (int i = 0; i < 4; i++)
            {
                UiKit.Icon(factIcons[i], board, 28 + i * 116, 600, 22);
                UiKit.Label(facts[i], board, 54 + i * 116, 596, 88, 30, 12, UiKit.Mint, true);
            }
            UiKit.Box("Divider", board, 24, 638, 464, 2, UiKit.Line);
            var vocabulary = UiKit.Button("CHUẨN BỊ BỘ TỪ   [V]", board, 24, 656, 464, 56, "olive", UiKit.Cream, game.OpenVocabulary);
            UiKit.Size(vocabulary.GetComponentInChildren<Text>(), 18);
            var launch = UiKit.Button("CẤT CÁNH   [ENTER]", board, 24, 726, 464, 78, "gold", UiKit.Ink, game.TakeOff);
            UiKit.Size(launch.GetComponentInChildren<Text>(), 27);
            launch.interactable = count >= 4;
            UiKit.Label("PHIÊN BẢN 0.14  ·  PIXEL SQUADRON", board, 24, 814, 464, 22, 11, UiKit.Muted, true, TextAnchor.MiddleCenter);

            // Controls strip.
            var helpImage = UiKit.Framed("Controls", overlay, 28, 790, 852, 86, "ui_panel");
            hangarHelp = helpImage.rectTransform; var help = helpImage.transform;
            string[] keys = { "CHUỘT", "TAB", "ENTER", "1 – 4" };
            string[] actions = { "lái trái / phải", "lái / bắn (tự vào ô gõ)", "bắn từ đã gõ", "chọn đáp án tên lửa" };
            for (int i = 0; i < 4; i++)
            {
                float x = 22 + i * 206;
                var cap = UiKit.Framed("Key " + keys[i], help, x, 22, 78, 40, "ui_keycap", 2);
                UiKit.Label(keys[i], cap.transform, 0, -2, 78, 36, 13, UiKit.Ink, true, TextAnchor.MiddleCenter);
                UiKit.Label(actions[i], help, x + 86, 18, 116, 48, 12, UiKit.Cream);
            }
            AnimateHangar(0, environment);
        }

        public void AnimateHangar(float delta, FlightEnvironment environment)
        {
            hangarTime += delta;
            if (!hangarScene) return;
            hangarScene.sprite = PixelSprites.At("title_airbase", hangarTime);
            // Idle engines tick over slowly; during take-off the propeller spins up.
            float rev = Launching ? Mathf.Lerp(.12f, 1.8f, Mathf.Clamp01(launchTime / EngineStartSeconds)) : .12f;
            propellerTime += delta * rev;
            hangarHero.sprite = PixelSprites.At("fighter_level", propellerTime);
            if (hangarPointer) hangarPointer.sprite = PixelSprites.At("ui_pointer", hangarTime);
            // Clouds drift slowly and, during the take-off roll, stream past a little faster than the ground.
            hangarClouds.uvRect = new Rect(Mathf.Round(hangarTime * 4) / 360f, (Mathf.Round(launchScroll * 1.25f / 4) - Mathf.Round(hangarTime * 2.5f)) / 225f, 1, 1);
            // A three-ship formation passes over the field every 14 seconds.
            float cycle = hangarTime % 14, t = cycle / 5;
            for (int i = 0; i < 3; i++)
            {
                var shadow = squadron[i * 2]; var plane = squadron[i * 2 + 1];
                bool visible = t < 1.2f && !Launching; shadow.enabled = plane.enabled = visible;
                if (!visible) continue;
                float x = 380 + (i == 0 ? 0 : i == 1 ? -104 : 104), y = 980 - t * 1250 + (i == 0 ? 0 : 84);
                plane.rectTransform.anchoredPosition = new Vector2(Mathf.Round(x / 4) * 4, -Mathf.Round(y / 4) * 4);
                shadow.rectTransform.anchoredPosition = plane.rectTransform.anchoredPosition + new Vector2(36, -60);
                plane.sprite = PixelSprites.At("fighter_level", hangarTime + i * .1f);
            }
            for (int i = puffs.Count - 1; i >= 0; i--)
            {
                var (image, age, velocity) = puffs[i];
                age += delta;
                if (age >= PixelSprites.Duration("fx_smoke") || !image) { if (image) UnityEngine.Object.Destroy(image.gameObject); puffs.RemoveAt(i); continue; }
                image.sprite = PixelSprites.At("fx_smoke", age);
                image.rectTransform.anchoredPosition += velocity * delta;
                image.rectTransform.sizeDelta += Vector2.one * 26 * delta;
                puffs[i] = (image, age, velocity);
            }
        }

        public void BeginTakeOff() { if (HangarVisible) launchTime = 0; puffTimer = 0; }

        private static float Smooth(float t) { t = Mathf.Clamp01(t); return t * t * (3 - 2 * t); }

        // CẤT CÁNH: cards slide out to both sides, the engine coughs to life ("tu tu"), the fighter makes a long
        // take-off roll with the camera following it out of the airbase onto the jungle runway, lifts off
        // (grows, shadow drops away) and the screen fades to black.
        // Returns true when the screen is fully dark and the sortie can begin.
        public bool AnimateTakeOff(float delta)
        {
            if (!Launching || !hangarHero) return true;
            launchTime += Mathf.Min(delta, .05f);
            float t = launchTime;
            float slide = Mathf.Clamp01(t / .55f); slide *= slide;
            hangarBrand.anchoredPosition = new Vector2(Mathf.Round(28 - 470 * slide), -24);
            hangarBoard.anchoredPosition = new Vector2(Mathf.Round(900 + 560 * slide), -24);
            hangarHelp.anchoredPosition = new Vector2(Mathf.Round(28 - 900 * slide), -790);
            hangarTag.GetComponent<CanvasGroup>().alpha = 1 - Mathf.Clamp01(t / .3f);
            float roll = Mathf.Max(0, t - EngineStartSeconds), distance = RollAcceleration * roll * roll;
            float followed = Mathf.Min(distance, RollAcceleration * FollowSeconds * FollowSeconds);
            launchScroll = Mathf.Max(0, followed - FollowAfter);
            hangarWorld.anchoredPosition = new Vector2(0, -Mathf.Round(launchScroll / 4) * 4);
            float lift = Smooth((t - 3.7f) / 1.3f);
            float size = 128 * (1 + .6f * lift);
            // On screen the fighter first moves up a little, then holds while the ground streams past,
            // and after lift-off climbs away ahead of the camera.
            float cy = 564 - (distance - launchScroll);
            var jitter = t < EngineStartSeconds + .1f && Mathf.Repeat(t, .22f) < .07f ? new Vector2(UnityEngine.Random.Range(-2, 3), UnityEngine.Random.Range(-1, 2)) * 2 : Vector2.zero;
            if (lift < 1) jitter += new Vector2(Mathf.Round(Mathf.Sin(t * 90) * (1 - lift)), 0);
            hangarHero.rectTransform.sizeDelta = new Vector2(size, size);
            hangarHero.rectTransform.anchoredPosition = new Vector2(Mathf.Round(652 - size / 2), -Mathf.Round(cy - size / 2)) + jitter;
            var shadowOffset = Vector2.Lerp(new Vector2(6, -8), new Vector2(84, -120), lift);
            hangarHeroShadow.rectTransform.sizeDelta = new Vector2(128, 128) * (1 + .15f * lift);
            hangarHeroShadow.rectTransform.anchoredPosition = new Vector2(652 - 64, -(cy - 64)) + shadowOffset;
            hangarHeroShadow.color = new Color(1, 1, 1, 1 - .7f * lift);
            puffTimer -= delta;
            if (t > .12f && t < 4.2f && puffTimer <= 0)
            {
                bool starting = t < EngineStartSeconds;
                puffTimer = starting ? (Mathf.Repeat(t, .22f) < .1f ? .04f : .16f) : .06f;
                for (int side = -1; side <= 1; side += 2)
                {
                    // Exhaust puffs stay where they were blown out, so they trail behind the rolling fighter.
                    float s = 22 + (starting ? 10 : 0);
                    var puff = UiKit.Sprite("Exhaust", hangarWorld, 652 + side * 22 * size / 128 - s / 2, cy - 18 * size / 128 - s / 2 - launchScroll, s, s, "fx_smoke");
                    puff.preserveAspect = false;
                    puffs.Add((puff, 0, new Vector2(side * UnityEngine.Random.Range(14, 40), starting ? -30 : 20)));
                }
            }
            SetCurtain(Smooth((t - 4.7f) / .95f));
            return t >= TakeOffSeconds;
        }

        public void SetCurtain(float alpha) => curtain.color = new Color(0, 0, 0, Mathf.Clamp01(alpha));
        public void SetHudAlpha(float alpha) { headerGroup.alpha = cockpitGroup.alpha = Mathf.Clamp01(alpha); }

        // Battle intro: the screen opens from black, the fighter climbs in from the bottom edge,
        // the ground drifts out of focus and the instruments fade up.
        public void BeginIntro() { SetCurtain(1); SetHudAlpha(0); Board.IntroLift = 1; Board.Focus = 0; }
        public void AnimateIntro(float t)
        {
            SetCurtain(1 - Smooth(t / .45f));
            float climb = 1 - Mathf.Clamp01(t / .9f);
            Board.IntroLift = climb * climb * climb;
            Board.Focus = Smooth((t - .25f) / .75f);
            SetHudAlpha(Smooth((t - .3f) / .7f));
        }
        public void FinishIntro() { SetCurtain(0); SetHudAlpha(1); Board.IntroLift = 0; Board.Focus = 1; }

        public void ShowMenu(VocabularyCatalog catalog, VocabularyFilter filter, VocabularyEntry[] filtered, int page, string error = null)
        {
            var panel = ClearOverlay(40, 70, 1360, 750);
            Setup = new VocabularySetupView(game, panel, catalog, filter, filtered, page, error);
            UiKit.Sprite("Logo", overlay, 40, 4, 148, 60, "logo");
            UiKit.Size(UiKit.Button("<< HANGAR", overlay, 60, 836, 180, 46, "olive", UiKit.Cream, game.ReturnToMenu).GetComponentInChildren<Text>(), 15);
            UiKit.Label("CEFR Oxford · Nghĩa Việt nhập tự động cần rà soát · Chủ đề do game phân loại.\nGiữ toàn bộ lựa chọn trong chuyến bay; tên lửa cũng dùng bộ từ đã chọn.", overlay, 270, 833, 1100, 53, 13, UiKit.Muted);
        }

        public void ShowCredits()
        {
            var panel = ClearOverlay(210, 100, 1020, 700);
            UiKit.Label("NGUỒN DỮ LIỆU VÀ GIẤY PHÉP", panel, 35, 25, 950, 54, 29, UiKit.Cream, true);
            string text = "Danh mục từ, từ loại và CEFR: Oxford Learner’s Dictionaries, Oxford 3000/5000.\nhttps://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000\nĐây không phải sản phẩm Oxford chính thức; không sao chép định nghĩa hoặc audio Oxford.\n\n" +
                "Dữ liệu từ điển: thichhoc.com (thichhoc-dict), giấy phép CC BY-SA 4.0.\nhttps://github.com/thichhoc-org/thichhoc-dict\nNguồn gốc: WordNet 3.1 (Princeton), CMUdict (CMU), Wiktionary.\nĐã chọn/lược nghĩa, ghép danh mục CEFR, thêm chủ đề và mục biên soạn.\n\n" +
                "Phần nghĩa Việt phái sinh giữ CC BY-SA 4.0; ghi nguồn và giấy phép đầy đủ nằm trong Attribution đi kèm game. Nguồn beta chưa được duyệt toàn bộ.\n\n" +
                "Phát âm: giọng máy Microsoft David en-US tạo cục bộ. Chủ đề do game phân loại.\nĐồ họa 0.14: máy bay, tàu, rocket, buồng lái, địa hình, động vật, hiệu ứng và sân bay là pixel art vẽ bằng mã (Tools/PixelForge), lưu từng khung hình. Bối cảnh hư cấu lấy cảm hứng Thế chiến II.\nPhông chữ VT323 (The VT323 Project Authors), giấy phép SIL Open Font License 1.1.";
            UiKit.Label(text, panel, 35, 96, 950, 500, 17, UiKit.Muted);
            UiKit.Button("QUAY LẠI CHỌN BỘ TỪ", panel, 35, 616, 950, 52, "gold", UiKit.Ink, game.OpenVocabulary);
        }
        public void HideOverlay() { ClearOverlay(); overlay.gameObject.SetActive(false); EventSystem.current?.SetSelectedGameObject(null); }
        public void ShowPause()
        {
            var panel = ClearOverlay(400, 250, 640, 400);
            UiKit.Icon("icon_pause", panel, 40, 44, 36);
            UiKit.Label("TẠM NGỪNG XUẤT KÍCH", panel, 90, 35, 520, 60, 30, UiKit.Cream, true);
            UiKit.Label("Máy bay, tàu, tên lửa, vật phẩm và thời gian đều dừng.\nNhấn ESC hoặc TIẾP TỤC khi sẵn sàng.", panel, 40, 116, 560, 70, 18, UiKit.Muted);
            UiKit.Button("TIẾP TỤC   [ESC]", panel, 40, 220, 560, 62, "gold", UiKit.Ink, game.TogglePause);
            UiKit.Button("VỀ HANGAR", panel, 40, 300, 560, 50, "olive", UiKit.Cream, game.ReturnToMenu);
        }
        public void ShowResults(FlightProgress progress, int firstTry, int best, List<VocabularyEntry> missed)
        {
            var panel = ClearOverlay(255, 120, 930, 660);
            SetCurtain(0);
            UiKit.Icon("icon_medal", panel, 40, 30, 30);
            UiKit.Label("BÁO CÁO SAU NHIỆM VỤ", panel, 80, 29, 800, 34, 16, UiKit.Orange, true);
            UiKit.Label(progress.Health <= 0 ? "HẾT GIÁP. MÁY BAY BỊ BẮN HẠ." : "HẾT NHIÊN LIỆU. HẠ CÁNH KHẨN CẤP.", panel, 40, 76, 850, 67, 30, UiKit.Cream, true);
            UiKit.Label(progress.Score.ToString("N0"), panel, 40, 156, 380, 90, 64, UiKit.Mint, true);
            UiKit.Label("ĐIỂM CHUYẾN BAY", panel, 43, 248, 350, 27, 13, UiKit.Muted, true);
            UiKit.Label("TRẢ LỜI ĐÚNG: " + progress.Correct + "  (đúng ngay lần đầu: " + firstTry + ")\nHẠ BẰNG VỤ NỔ: " + progress.BlastKills + "\nKỶ LỤC BỘ NÀY: " + best.ToString("N0"), panel, 450, 160, 440, 100, 18, UiKit.Cream, true);
            UiKit.Label("Sai " + progress.WrongAttempts + " lần · Đã học thêm sau mỗi lần thử.", panel, 40, 296, 850, 34, 16, UiKit.Muted);
            UiKit.Box("Divider", panel, 40, 345, 850, 2, UiKit.Line);
            UiKit.Label("TỪ CẦN XEM LẠI", panel, 40, 362, 850, 27, 13, UiKit.Orange, true);
            string review = missed.Count == 0 ? "Chưa có từ trả lời sai. Hãy tiếp tục ở chuyến bay sau." : string.Join("\n", missed.Take(4).Select(e => e.word + " — " + e.meaning));
            UiKit.Label(review, panel, 40, 396, 850, 140, 18, UiKit.Cream);
            UiKit.Button("BAY LẠI   [ENTER]", panel, 40, 566, 410, 60, "gold", UiKit.Ink, game.StartFlight);
            UiKit.Button("VỀ HANGAR", panel, 470, 566, 420, 60, "olive", UiKit.Cream, game.ReturnToMenu);
        }
        public void ShowError(string message)
        {
            var panel = ClearOverlay(330, 275, 780, 350);
            SetCurtain(0);
            UiKit.Label("KHÔNG THỂ NẠP CHUYẾN BAY", panel, 35, 30, 710, 60, 28, UiKit.Coral, true);
            UiKit.Label(message, panel, 35, 116, 710, 170, 20, UiKit.Cream);
        }
        public void NewFlight(string selectedTopic)
        {
            history.Clear(); recent.text = ""; topic.text = selectedTopic; HideOverlay();
            Feedback("LÁI: rê chuột ngang để đón R+. TAB để chuyển sang BẮN.");
        }
        public void SelectPartOfSpeech(string value) => pos.SetValueWithoutNotify(Math.Max(0, Array.IndexOf(posValues, value)));
        public void SetQuestion(VocabularyEntry entry, int number)
        {
            question.text = entry?.meaning ?? "Đang chờ máy bay tiếp theo…";
            kind.text = ""; SelectPartOfSpeech("");
        }

        // focused = BẮN mode: the typed word with a blinking caret right after the last letter.
        // LÁI mode shows only the "NHẬP ĐỂ BẮN" placeholder, with no caret.
        public void SetInput(string value, bool focused)
        {
            if (value == null) value = "";
            inputFrame.sprite = PixelSprites.Get(focused ? "ui_input_focus" : "ui_input");
            placeholder.enabled = !focused;
            // The caret restarts solid whenever the text or the mode changes, then blinks.
            if (value != lastInput || focused != lastFocused) { lastInput = value; lastFocused = focused; caretTimer = 0; }
            caretTimer += Time.unscaledDeltaTime;
            inputText.text = focused ? value : "";
            // Long words shrink instead of running past the slot.
            int size = UiKit.Px(22);
            inputText.fontSize = size;
            float width = MeasureWidth(inputText, inputText.text);
            while (width > 428 && size > UiKit.Px(12)) { size -= 2; inputText.fontSize = size; width = MeasureWidth(inputText, inputText.text); }
            float caretHeight = Mathf.Round(size * .78f / 2) * 2;
            caret.rectTransform.sizeDelta = new Vector2(4, caretHeight);
            caret.rectTransform.anchoredPosition = new Vector2(Mathf.Round(inputText.rectTransform.anchoredPosition.x + width + 2), -Mathf.Round((52 - caretHeight) / 2));
            caret.enabled = focused && caretTimer % 1.06f < .6f;
        }
        public void Feedback(string value, bool error = false) { feedback.text = value; feedback.color = error ? UiKit.Coral : UiKit.Mint; }
        public void Log(VocabularyEntry entry, bool correct)
        {
            history.Insert(0, entry.word + " — " + entry.meaning); if (history.Count > 2) history.RemoveAt(2);
            recent.text = "HẠ: " + history[0];
        }
        public void Refresh(ContinuousFlight flight)
        {
            var p = flight.Progress;
            float delta = Time.unscaledDeltaTime;
            score.text = p.Score.ToString("000000"); combo.text = "COMBO ×" + GameRules.ComboMultiplier(p.Streak).ToString("0.00") + "  /  ĐÚNG " + p.Correct;
            bool blink = Time.unscaledTime % .5f < .25f;
            for (int i = 0; i < lamps.Length; i++)
                lamps[i].sprite = PixelSprites.Get(i >= p.Metal ? "ui_lamp_off" : p.Metal <= 1 ? (blink ? "ui_lamp_red" : "ui_lamp_off") : p.Metal == 2 ? "ui_lamp_red" : p.Metal == 3 ? "ui_lamp_amber" : "ui_lamp_green");
            armorLabel.text = "GIÁP " + p.Metal + "/" + FlightProgress.MaximumMetal;
            armorLabel.color = p.Metal <= 2 ? UiKit.Coral : Brass;
            fuelAngle = Mathf.MoveTowards(fuelAngle, -135 + 270 * Mathf.Clamp01(p.Fuel / 100), 220 * delta); PointNeedle(fuelNeedle, fuelAngle);
            fuelValue.text = Mathf.CeilToInt(p.Fuel) + "%"; fuelValue.color = p.Fuel < 20 ? UiKit.Coral : UiKit.Cream;
            float multiplier = GameRules.SpeedMultiplier(p.ActiveSeconds);
            speedAngle = Mathf.MoveTowards(speedAngle, -135 + 270 * Mathf.Clamp01((multiplier - 1) / .5f), 120 * delta); PointNeedle(speedNeedle, speedAngle);
            speedValue.text = Mathf.RoundToInt(multiplier * 100) + "%";
            int seconds = (int)p.ActiveSeconds;
            PointNeedle(clockNeedle, seconds % 60 * 6);
            clockValue.text = (seconds / 60).ToString("00") + ":" + (seconds % 60).ToString("00");
            supplyLabel.text = p.Powered ? "CƯỜNG HÓA " + Mathf.CeilToInt(p.PowerSeconds) + "s · ĐIỂM ×1.5" : "Kim loại sửa 1 giáp\nTiếp tế " + p.UpgradePickups + "/5 → cường hóa";
            supplyLabel.color = p.Powered ? UiKit.Mint : UiKit.Cream;
            region.text = EnvironmentNames[(int)flight.Environment] + "  /  " + flight.Enemies.Count + " MÁY BAY";
            int remaining = Mathf.CeilToInt(ContinuousFlight.EnvironmentDuration - (float)(p.ActiveSeconds % ContinuousFlight.EnvironmentDuration));
            wave.text = "Đổi vùng sau " + remaining / 60 + ":" + (remaining % 60).ToString("00") + " · " + (flight.WaitingForDistinctWord ? "Đã dùng hết đáp án phân biệt trên màn hình" : "Máy bay tiếp: " + flight.SpawnIn.ToString("0.0") + "s");
            modeHint.text = flight.Driving ? "ĐANG LÁI  ·  TAB → BẮN" : "ĐANG BẮN  ·  TAB → LÁI";
            leverPosition = Mathf.MoveTowards(leverPosition, flight.Driving ? 0 : 2, delta * 14);
            lever.sprite = PixelSprites.Get("ui_lever", Mathf.RoundToInt(leverPosition));
            fireButton.interactable = !flight.Driving && flight.Target != null;
            rollLabel.text = "ĐỔI NGHĨA (" + flight.Rolls + ")"; rollButton.interactable = flight.CanRoll;
            pos.interactable = !flight.Driving && flight.Target?.RequiresPartOfSpeech == true;
            var locking = flight.Enemies.Where(e => e.Phase == EnemyPhase.Locking).OrderBy(e => e.LockRemaining).FirstOrDefault();
            bool boosting = flight.Missiles.Any(m => m.Phase == MissilePhase.Boost);
            if (locking != null || boosting)
            {
                recent.text = boosting ? "!! TÊN LỬA TĂNG TỐC !!" : "!! BỊ KHÓA · " + Mathf.Max(0, locking.LockRemaining).ToString("0.0") + "s !!";
                recent.color = blink ? UiKit.Coral : UiKit.Orange;
            }
            else { recent.text = history.Count > 0 ? "HẠ: " + history[0] : ""; recent.color = PhosphorDim; }
            kind.text = flight.Target == null ? "Chưa có mục tiêu. Đồng hồ sinh máy bay vẫn chạy."
                : flight.Target.Phase == EnemyPhase.Locking ? "MỤC TIÊU ĐANG KHÓA BẠN: gõ đúng để hạ trước khi nó bắn!"
                : flight.Target.RequiresPartOfSpeech ? "MÁY BAY SA MẠC: cần chọn đúng từ loại."
                : flight.Target.Health > 1 ? "KHIÊN BĂNG: cần hai lần trúng. Mỗi lần trúng sẽ đổi nghĩa."
                : "Gõ từ tiếng Anh tương ứng rồi nhấn ENTER.";
        }
        public void SetMuted(bool muted) { muteLabel.text = muted ? "ÂM: TẮT" : "ÂM: BẬT"; muteIcon.sprite = PixelSprites.Get(muted ? "icon_sound_off" : "icon_sound_on"); }

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

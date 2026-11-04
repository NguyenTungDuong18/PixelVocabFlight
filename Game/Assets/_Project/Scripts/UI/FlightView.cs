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
        private readonly FlightGame game;
        private readonly Canvas canvas;
        private readonly RectTransform root, overlay;
        private readonly Text score, combo, clock, speed, fuelValue, supplyLabel, question, kind, input, feedback, wave, topic, region, recent;
        private readonly Image fuelFill;
        private readonly Image[] hullCells = new Image[FlightProgress.MaximumMetal];
        private readonly Text muteLabel, controlLabel, rollLabel;
        private readonly Image muteIcon;
        private readonly Button fireButton, rollButton;
        private readonly Dropdown pos;
        // Title screen (hangar) animation state.
        private Image hangarScene, hangarHero, hangarPointer;
        private RawImage hangarClouds;
        private readonly List<Image> squadron = new List<Image>();
        private float hangarTime;
        private int hangarSelected;
        private readonly List<string> history = new List<string>();
        private readonly string[] posValues = { "", "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "exclamation", "auxiliary verb", "modal verb", "linking verb", "definite article", "indefinite article", "ordinal number", "infinitive marker" };
        private readonly string[] posLabels = { "CHỌN TỪ LOẠI…", "Danh từ", "Động từ", "Tính từ", "Trạng từ", "Đại từ", "Giới từ", "Liên từ", "Từ hạn định", "Số từ", "Thán từ", "Trợ động từ", "Động từ khuyết thiếu", "Động từ nối", "Mạo từ xác định", "Mạo từ bất định", "Số thứ tự", "Dấu nguyên mẫu (to)" };
        public FlightBoardView Board { get; }
        public VocabularySetupView Setup { get; private set; }
        public bool HangarVisible { get; private set; }
        public bool PartOfSpeechOpen => pos.transform.Find("Dropdown List") != null;
        public string SelectedPartOfSpeech => posValues[pos.value];
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
            UiKit.Sprite("Logo", root, 40, 14, 168, 68, "logo");
            region = UiKit.Label("FLIGHT COMMAND", root, 240, 20, 470, 32, 18, UiKit.Mint, true);
            wave = UiKit.Label("Mỗi vùng 3 phút", root, 240, 54, 470, 26, 12, UiKit.Muted);
            UiKit.Icon("icon_medal", root, 735, 26, 36);
            score = UiKit.Label("000000", root, 782, 18, 200, 42, 30, UiKit.Cream, true);
            combo = UiKit.Label("COMBO ×1.00", root, 782, 58, 300, 24, 13, UiKit.Mint, true);
            var mute = UiKit.Button("ÂM: BẬT", root, 1092, 29, 152, 44, "olive", UiKit.Muted, game.ToggleMute);
            muteLabel = mute.GetComponentInChildren<Text>(); muteLabel.alignment = TextAnchor.MiddleRight; muteLabel.rectTransform.sizeDelta -= new Vector2(10, 0);
            muteIcon = UiKit.Icon("icon_sound_on", mute.transform, 12, 10, 24);
            var pause = UiKit.Button("ESC: DỪNG", root, 1256, 29, 144, 44, "olive", UiKit.Cream, game.TogglePause);
            UiKit.Icon("icon_pause", pause.transform, 10, 10, 24);
            pause.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleRight;
            UiKit.Box("Divider", root, 40, 91, 1360, 2, UiKit.Line);
            Board = new FlightBoardView(root, game);
            UiKit.Box("Telemetry", root, 40, 655, 1360, 42, UiKit.Panel);
            UiKit.Icon("icon_armor", root, 58, 664, 24);
            UiKit.Label("GIÁP", root, 88, 660, 50, 30, 13, UiKit.Cream, true);
            for (int i = 0; i < hullCells.Length; i++) hullCells[i] = UiKit.Sprite("Armor cell " + (i + 1), root, 140 + i * 19, 664, 16, 24, "ui_cell_full");
            UiKit.Icon("icon_fuel", root, 252, 664, 24);
            fuelValue = UiKit.Label("XĂNG 100%", root, 282, 660, 116, 30, 14, UiKit.Mint, true);
            UiKit.Framed("Fuel track", root, 400, 667, 112, 16, "ui_ink", 1);
            fuelFill = UiKit.Box("Fuel level", root, 403, 670, 106, 10, UiKit.Mint);
            UiKit.Icon("icon_radio", root, 536, 664, 24);
            supplyLabel = UiKit.Label("Kim loại sửa 1 giáp", root, 566, 660, 420, 30, 13, UiKit.Muted);
            UiKit.Icon("icon_clock", root, 1000, 664, 24);
            clock = UiKit.Label("00:00", root, 1030, 660, 90, 30, 16, UiKit.Cream, true);
            UiKit.Icon("icon_speed", root, 1180, 664, 24);
            speed = UiKit.Label("TỐC ĐỘ 100%", root, 1210, 660, 176, 30, 13, UiKit.Muted, true, TextAnchor.MiddleRight);
            UiKit.Box("Question panel", root, 40, 705, 1360, 151, UiKit.Panel);
            UiKit.Icon("icon_radio", root, 64, 718, 20);
            UiKit.Label("ĐIỆN ĐÀI / GIẢI MÃ MỤC TIÊU", root, 92, 714, 480, 26, 12, UiKit.Muted, true);
            question = UiKit.Fit(UiKit.Label("Sẵn sàng cất cánh?", root, 64, 744, 510, 60, 31, UiKit.Cream, true), 15, 31);
            kind = UiKit.Label("", root, 64, 808, 510, 34, 13, UiKit.Muted);
            UiKit.Framed("Typing", root, 598, 730, 402, 54, "ui_ink", UiKit.ButtonSliceScale);
            input = UiKit.Fit(UiKit.Label("Chế độ LÁI", root, 614, 732, 374, 50, 25, UiKit.Cream), 14, 25);
            fireButton = UiKit.Button("BẮN [ENTER]", root, 1012, 730, 150, 54, "gold", UiKit.Ink, game.Submit);
            controlLabel = UiKit.Button("LÁI / TAB", root, 1174, 730, 206, 54, "cream", UiKit.Ink, game.ToggleControlMode).GetComponentInChildren<Text>();
            UiKit.Fit(controlLabel, 12, 19);
            pos = UiKit.Select(posLabels, 0, root, 598, 800, 232, 38, _ => EventSystem.current?.SetSelectedGameObject(null));
            pos.template.anchoredPosition = new Vector2(0, 176); // Open upwards, within the viewport.
            UiKit.Size(pos.captionText, 15);
            rollButton = UiKit.Button("ĐỔI NGHĨA (3)", root, 844, 800, 204, 38, "olive", UiKit.Mint, game.RollMeaning);
            rollLabel = rollButton.GetComponentInChildren<Text>(); UiKit.Size(rollLabel, 15);
            feedback = UiKit.Fit(UiKit.Label("", root, 1064, 794, 316, 50, 13, UiKit.Muted), 10, 13);
            topic = UiKit.Label("OXFORD 5000", root, 40, 865, 320, 25, 12, UiKit.Muted, true);
            recent = UiKit.Label("LÁI: rê chuột ngang  ·  TAB: đổi chế độ  ·  BẮN: gõ từ + ENTER", root, 380, 865, 1020, 25, 12, UiKit.Muted, false, TextAnchor.MiddleRight);
            overlay = UiKit.Box("Overlay", root, 0, 0, 1440, 900, new Color(.07f, .085f, .065f, 1f)).rectTransform;
            overlay.GetComponent<Image>().raycastTarget = true;
        }

        private void ClearOverlay()
        {
            Setup = null; HangarVisible = false; hangarScene = hangarHero = hangarPointer = null; hangarClouds = null; squadron.Clear(); pos.Hide();
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
            HangarVisible = true; hangarSelected = (int)environment;
            hangarScene = UiKit.Sprite("Airbase", overlay, 0, 0, 1440, 900, "title_airbase");
            hangarScene.preserveAspect = false;
            // Parked hero fighter on the runway, scene scale 4x (same sprite as in flight).
            UiKit.Sprite("Hero shadow", overlay, 588 + 6, 500 + 8, 128, 128, "fighter_shadow");
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
            UiKit.Label("SKYLARK MK.I  ·  PHI CÔNG 01", tag.transform, 0, 0, 304, 34, 14, UiKit.Mint, true, TextAnchor.MiddleCenter);

            // Brand block.
            var brand = UiKit.Framed("Brand", overlay, 28, 24, 400, 214, "ui_panel");
            UiKit.Sprite("Logo", brand.transform, 32, 18, 336, 136, "logo");
            UiKit.Label("PHI ĐỘI TỪ VỰNG  ·  1944", brand.transform, 0, 154, 400, 26, 16, UiKit.Mint, true, TextAnchor.MiddleCenter);
            UiKit.Label("Bắn hạ máy bay địch bằng từ vựng Oxford", brand.transform, 0, 180, 400, 22, 12, UiKit.Muted, false, TextAnchor.MiddleCenter);

            // Mission board.
            var board = UiKit.Framed("Mission board", overlay, 900, 24, 512, 852, "ui_panel").transform;
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
            var launch = UiKit.Button("CẤT CÁNH   [ENTER]", board, 24, 726, 464, 78, "gold", UiKit.Ink, game.StartFlight);
            UiKit.Size(launch.GetComponentInChildren<Text>(), 27);
            launch.interactable = count >= 4;
            UiKit.Label("PHIÊN BẢN 0.13  ·  PIXEL SQUADRON", board, 24, 814, 464, 22, 11, UiKit.Muted, true, TextAnchor.MiddleCenter);

            // Controls strip.
            var help = UiKit.Framed("Controls", overlay, 28, 790, 852, 86, "ui_panel").transform;
            string[] keys = { "CHUỘT", "TAB", "ENTER", "ESC" };
            string[] actions = { "lái trái / phải", "lái / bắn", "bắn từ đã gõ", "tạm dừng" };
            for (int i = 0; i < 4; i++)
            {
                float x = 22 + i * 206;
                var cap = UiKit.Framed("Key " + keys[i], help, x, 22, 78, 40, "ui_keycap", 2);
                UiKit.Label(keys[i], cap.transform, 0, -2, 78, 36, 13, UiKit.Ink, true, TextAnchor.MiddleCenter);
                UiKit.Label(actions[i], help, x + 86, 22, 116, 40, 12, UiKit.Cream);
            }
            AnimateHangar(0, environment);
        }

        public void AnimateHangar(float delta, FlightEnvironment environment)
        {
            hangarTime += delta;
            if (!hangarScene) return;
            hangarScene.sprite = PixelSprites.At("title_airbase", hangarTime);
            hangarHero.sprite = PixelSprites.At("fighter_level", hangarTime);
            if (hangarPointer) hangarPointer.sprite = PixelSprites.At("ui_pointer", hangarTime);
            hangarClouds.uvRect = new Rect(Mathf.Round(hangarTime * 4) / 360f, -Mathf.Round(hangarTime * 2.5f) / 225f, 1, 1);
            // A three-ship formation passes over the field every 14 seconds.
            float cycle = hangarTime % 14, t = cycle / 5;
            for (int i = 0; i < 3; i++)
            {
                var shadow = squadron[i * 2]; var plane = squadron[i * 2 + 1];
                bool visible = t < 1.2f; shadow.enabled = plane.enabled = visible;
                if (!visible) continue;
                float x = 380 + (i == 0 ? 0 : i == 1 ? -104 : 104), y = 980 - t * 1250 + (i == 0 ? 0 : 84);
                plane.rectTransform.anchoredPosition = new Vector2(Mathf.Round(x / 4) * 4, -Mathf.Round(y / 4) * 4);
                shadow.rectTransform.anchoredPosition = plane.rectTransform.anchoredPosition + new Vector2(36, -60);
                plane.sprite = PixelSprites.At("fighter_level", hangarTime + i * .1f);
            }
        }

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
                "Phát âm: giọng máy Microsoft David en-US tạo cục bộ. Chủ đề do game phân loại.\nĐồ họa 0.13: toàn bộ máy bay, tàu, rocket, hiệu ứng, giao diện và sân bay là pixel art vẽ bằng mã (Tools/PixelForge), lưu từng khung hình. Bối cảnh hư cấu lấy cảm hứng Thế chiến II.\nPhông chữ VT323 (The VT323 Project Authors), giấy phép SIL Open Font License 1.1.";
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
            UiKit.Label("KHÔNG THỂ NẠP CHUYẾN BAY", panel, 35, 30, 710, 60, 28, UiKit.Coral, true);
            UiKit.Label(message, panel, 35, 116, 710, 170, 20, UiKit.Cream);
        }
        public void NewFlight(string selectedTopic) { history.Clear(); topic.text = selectedTopic; HideOverlay(); Feedback("LÁI: rê chuột ngang để đón R+. TAB để chuyển sang BẮN."); }
        public void SelectPartOfSpeech(string value) => pos.SetValueWithoutNotify(Math.Max(0, Array.IndexOf(posValues, value)));
        public void SetQuestion(VocabularyEntry entry, int number)
        {
            question.text = entry?.meaning ?? "Đang chờ máy bay tiếp theo…";
            kind.text = ""; SelectPartOfSpeech("");
        }
        public void SetInput(string value, bool accepting)
        {
            input.text = accepting ? (value.Length == 0 ? "Gõ từ tiếng Anh…" : value) + (Time.unscaledTime % 1 < .55f ? "_" : "") : "LÁI · nhấn TAB để chuyển sang BẮN";
            input.color = accepting && value.Length > 0 ? UiKit.Cream : UiKit.Muted;
        }
        public void Feedback(string value, bool error = false) { feedback.text = value; feedback.color = error ? UiKit.Coral : UiKit.Mint; }
        public void Log(VocabularyEntry entry, bool correct)
        {
            history.Insert(0, entry.word + " — " + entry.meaning); if (history.Count > 2) history.RemoveAt(2);
            recent.text = string.Join("   /   ", history);
        }
        public void Refresh(ContinuousFlight flight)
        {
            var p = flight.Progress;
            score.text = p.Score.ToString("000000"); combo.text = "COMBO ×" + GameRules.ComboMultiplier(p.Streak).ToString("0.00") + "  /  ĐÚNG " + p.Correct;
            for (int i = 0; i < hullCells.Length; i++) hullCells[i].sprite = PixelSprites.Get(i >= p.Metal ? "ui_cell_empty" : p.Metal <= 2 ? "ui_cell_low" : "ui_cell_full");
            fuelValue.text = "XĂNG " + Mathf.CeilToInt(p.Fuel) + "%";
            fuelFill.rectTransform.sizeDelta = new Vector2(Mathf.Round(106 * p.Fuel / 100 / 2) * 2, 10); fuelFill.color = p.Fuel < 20 ? UiKit.Coral : UiKit.Mint;
            supplyLabel.text = p.Powered ? "CƯỜNG HÓA " + Mathf.CeilToInt(p.PowerSeconds) + "s · ĐIỂM ×1.5" : "Kim loại sửa 1 giáp · tiếp tế " + p.UpgradePickups + "/5 để cường hóa";
            supplyLabel.color = p.Powered ? UiKit.Mint : UiKit.Muted;
            int seconds = (int)p.ActiveSeconds; clock.text = (seconds / 60).ToString("00") + ":" + (seconds % 60).ToString("00");
            speed.text = "TỐC ĐỘ " + Mathf.RoundToInt(GameRules.SpeedMultiplier(p.ActiveSeconds) * 100) + "%";
            region.text = EnvironmentNames[(int)flight.Environment] + "  /  " + flight.Enemies.Count + " MÁY BAY";
            int remaining = Mathf.CeilToInt(ContinuousFlight.EnvironmentDuration - (float)(p.ActiveSeconds % ContinuousFlight.EnvironmentDuration));
            wave.text = "Đổi vùng sau " + remaining / 60 + ":" + (remaining % 60).ToString("00") + " · " + (flight.WaitingForDistinctWord ? "Đã dùng hết đáp án phân biệt trên màn hình" : "Máy bay tiếp: " + flight.SpawnIn.ToString("0.0") + "s");
            controlLabel.text = flight.Driving ? "ĐANG LÁI [TAB]" : "ĐANG BẮN [TAB]";
            fireButton.interactable = !flight.Driving && flight.Target != null;
            rollLabel.text = "ĐỔI NGHĨA (" + flight.Rolls + ")"; rollButton.interactable = flight.CanRoll;
            pos.interactable = !flight.Driving && flight.Target?.RequiresPartOfSpeech == true;
            kind.text = flight.Target == null ? "Chưa có mục tiêu. Đồng hồ sinh máy bay vẫn chạy." : flight.Target.RequiresPartOfSpeech ? "MÁY BAY SA MẠC: cần chọn đúng từ loại." : flight.Target.Health > 1 ? "KHIÊN BĂNG: cần hai lần trúng. Mỗi lần trúng sẽ đổi nghĩa." : "Gõ đúng từ tiếng Anh tương ứng rồi nhấn ENTER.";
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

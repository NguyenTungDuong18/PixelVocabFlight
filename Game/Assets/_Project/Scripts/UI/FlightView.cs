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
        private readonly Text score, combo, clock, speed, health, fuelValue, metal, power, question, kind, input, feedback, wave, topic, region, recent;
        private readonly Image fuelFill;
        private readonly Text muteLabel, controlLabel, rollLabel;
        private readonly Button fireButton, rollButton;
        private readonly Dropdown pos;
        private ScrollingTerrain hangarTerrain;
        private readonly List<string> history = new List<string>();
        private readonly string[] posValues = { "", "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "number", "exclamation", "auxiliary verb", "modal verb", "linking verb", "definite article", "indefinite article", "ordinal number", "infinitive marker" };
        private readonly string[] posLabels = { "CHỌN TỪ LOẠI…", "Danh từ", "Động từ", "Tính từ", "Trạng từ", "Đại từ", "Giới từ", "Liên từ", "Từ hạn định", "Số từ", "Thán từ", "Trợ động từ", "Động từ khuyết thiếu", "Động từ nối", "Mạo từ xác định", "Mạo từ bất định", "Số thứ tự", "Dấu nguyên mẫu (to)" };
        public FlightBoardView Board { get; }
        public VocabularySetupView Setup { get; private set; }
        public bool PartOfSpeechOpen => pos.transform.Find("Dropdown List") != null;
        public string SelectedPartOfSpeech => posValues[pos.value];
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
            UiKit.Box("Brand mark", root, 40, 27, 5, 34, UiKit.Mint);
            UiKit.Label("WORDWING", root, 60, 21, 260, 45, 31, UiKit.Cream, true);
            region = UiKit.Label("CONTINUOUS FLIGHT", root, 340, 22, 430, 30, 17, UiKit.Mint, true);
            wave = UiKit.Label("Mỗi vùng 3 phút", root, 340, 56, 430, 26, 12, UiKit.Muted);
            score = UiKit.Label("000000", root, 790, 22, 175, 38, 30, UiKit.Cream, true);
            combo = UiKit.Label("COMBO ×1.00", root, 790, 59, 230, 23, 13, UiKit.Mint, true);
            muteLabel = UiKit.Button("ÂM: BẬT", root, 1112, 29, 132, 42, UiKit.Panel, UiKit.Muted, game.ToggleMute).GetComponentInChildren<Text>();
            UiKit.Button("ESC / DỪNG", root, 1256, 29, 144, 42, UiKit.Panel, UiKit.Cream, game.TogglePause);
            UiKit.Box("Divider", root, 40, 91, 1360, 1, UiKit.Line);
            Board = new FlightBoardView(root, game);
            UiKit.Box("Telemetry", root, 40, 657, 1360, 37, UiKit.Panel);
            health = UiKit.Label("GIÁP 03", root, 53, 660, 126, 30, 14, UiKit.Cream, true);
            fuelValue = UiKit.Label("XĂNG 100%", root, 190, 660, 146, 30, 14, UiKit.Mint, true);
            UiKit.Box("Fuel track", root, 337, 672, 100, 5, UiKit.Line);
            fuelFill = UiKit.Box("Fuel level", root, 337, 672, 100, 5, UiKit.Mint);
            metal = UiKit.Label("KIM LOẠI 0/5", root, 463, 660, 174, 30, 14, UiKit.Cream, true);
            power = UiKit.Label("5 mảnh → cường hóa 12s", root, 651, 660, 290, 30, 13, UiKit.Muted);
            clock = UiKit.Label("00:00", root, 1000, 660, 124, 30, 15, UiKit.Cream, true, TextAnchor.MiddleRight);
            speed = UiKit.Label("TỐC ĐỘ 100%", root, 1144, 660, 242, 30, 13, UiKit.Muted, true, TextAnchor.MiddleRight);
            UiKit.Box("Question panel", root, 40, 705, 1360, 151, UiKit.Panel);
            UiKit.Box("Accent", root, 40, 705, 4, 151, UiKit.Mint);
            UiKit.Label("NGHĨA CẦN TÌM  /  CÁC MÁY BAY KHÁC BẤT TỬ", root, 62, 715, 510, 24, 12, UiKit.Muted, true);
            question = UiKit.Label("Sẵn sàng cất cánh?", root, 62, 744, 510, 60, 31, UiKit.Cream, true);
            question.resizeTextForBestFit = true; question.resizeTextMinSize = 15; question.resizeTextMaxSize = 31;
            kind = UiKit.Label("", root, 62, 810, 510, 32, 13, UiKit.Muted);
            UiKit.Box("Typing", root, 598, 730, 402, 54, UiKit.Ink);
            input = UiKit.Label("Chế độ LÁI", root, 612, 732, 376, 50, 25, UiKit.Cream);
            input.resizeTextForBestFit = true; input.resizeTextMinSize = 14; input.resizeTextMaxSize = 25;
            fireButton = UiKit.Button("BẮN ↵", root, 1012, 730, 126, 54, UiKit.Mint, UiKit.Ink, game.Submit);
            controlLabel = UiKit.Button("LÁI / Tab", root, 1150, 730, 230, 54, UiKit.Orange, UiKit.Ink, game.ToggleControlMode).GetComponentInChildren<Text>();
            pos = UiKit.Select(posLabels, 0, root, 598, 800, 232, 38, _ => EventSystem.current?.SetSelectedGameObject(null));
            pos.template.anchoredPosition = new Vector2(0, 176); // Open upwards, within the viewport.
            pos.captionText.fontSize = 15;
            rollButton = UiKit.Button("ĐỔI NGHĨA (3)", root, 844, 800, 204, 38, UiKit.Line, UiKit.Mint, game.RollMeaning);
            rollLabel = rollButton.GetComponentInChildren<Text>(); rollLabel.fontSize = 15;
            feedback = UiKit.Label("", root, 1064, 794, 313, 50, 13, UiKit.Muted);
            feedback.resizeTextForBestFit = true; feedback.resizeTextMinSize = 10; feedback.resizeTextMaxSize = 13;
            topic = UiKit.Label("OXFORD 5000", root, 40, 865, 320, 25, 12, UiKit.Muted, true);
            recent = UiKit.Label("LÁI: rê chuột ngang  ·  Tab: đổi chế độ  ·  BẮN: gõ từ + Enter", root, 380, 865, 1020, 25, 12, UiKit.Muted, false, TextAnchor.MiddleRight);
            overlay = UiKit.Box("Overlay", root, 0, 0, 1440, 900, new Color(.025f, .06f, .08f, .96f)).rectTransform;
            overlay.GetComponent<Image>().raycastTarget = true;
        }

        private RectTransform ClearOverlay(float x, float y, float width, float height)
        {
            Setup = null; hangarTerrain = null; pos.Hide();
            for (int i = overlay.childCount - 1; i >= 0; i--) { var child = overlay.GetChild(i).gameObject; child.SetActive(false); UnityEngine.Object.Destroy(child); }
            overlay.gameObject.SetActive(true);
            return UiKit.Box("Dialog", overlay, x, y, width, height, UiKit.Panel).rectTransform;
        }

        public void ShowHangar(VocabularyFilter filter, int available, FlightEnvironment environment)
        {
            var panel = ClearOverlay(75, 80, 1290, 740);
            UiKit.Label("WORDWING / HANGAR", panel, 32, 20, 900, 35, 16, UiKit.Mint, true);
            UiKit.Label("MÁY BAY ĐÃ SẴN SÀNG.", panel, 32, 60, 1100, 54, 35, UiKit.Cream, true);
            var preview = UiKit.Box("Pilot preview", panel, 32, 136, 510, 488, UiKit.Ink).rectTransform;
            preview.gameObject.AddComponent<RectMask2D>(); hangarTerrain = new ScrollingTerrain(preview, 510, 488);
            UiKit.Label("01 / YOUR AIRCRAFT", preview, 24, 17, 450, 26, 14, UiKit.Mint, true);
            for (int i = 0; i < 7; i++) UiKit.Box("Hangar runway", preview, 252, 65 + i * 53, 4, 24, new Color(1, 1, 1, .13f));
            UiKit.Box("Pilot preview aircraft", preview, 151, 110, 208, 208, Color.white).sprite = PixelAircraft.Create(true);
            UiKit.Label("SKYLARK / 01", preview, 35, 354, 440, 39, 25, UiKit.Cream, true, TextAnchor.MiddleCenter);
            UiKit.Label("Di chuyển ngang bằng chuột\nĐổi sang BẮN để nhập từ tiếng Anh", preview, 35, 403, 440, 58, 17, UiKit.Muted, false, TextAnchor.MiddleCenter);
            UiKit.Label("VÙNG BẮT ĐẦU", panel, 580, 135, 650, 26, 13, UiKit.Muted, true);
            string[] descriptions = { "Sinh máy bay nhanh hơn 30%", "Nhập từ + chọn đúng từ loại", "Khiên băng: cần hai lần bắn đúng", "Tàu sân bay + tên lửa bốn lựa chọn" };
            for (int i = 0; i < 4; i++)
            {
                int selected = i; float y = 175 + i * 70;
                var button = UiKit.Button(EnvironmentNames[i], panel, 580, y, 250, 53, (int)environment == i ? UiKit.Mint : UiKit.Line, (int)environment == i ? UiKit.Ink : UiKit.Cream, () => game.ChooseStartingEnvironment(selected));
                button.GetComponentInChildren<Text>().fontSize = 18;
                UiKit.Label(descriptions[i], panel, 850, y, 400, 53, 16, UiKit.Muted);
            }
            int count = filter.from >= 1 && filter.to <= available && filter.to >= filter.from ? filter.to - filter.from + 1 : 0;
            UiKit.Label("Mỗi môi trường 3 phút · chuyển nền dần trong 6 giây.\nLuân phiên: Rừng → Sa mạc → Băng → Biển.", panel, 580, 465, 660, 60, 17, UiKit.Muted);
            UiKit.Label("BỘ HỌC: " + count.ToString("N0") + " MỤC  ·  3 LƯỢT ĐỔI MIỄN PHÍ", panel, 580, 537, 660, 34, 17, UiKit.Mint, true);
            UiKit.Button("CHỌN TỪ VỰNG / CHỦ ĐỀ", panel, 580, 586, 660, 49, UiKit.Line, UiKit.Cream, game.OpenVocabulary);
            UiKit.Button("CẤT CÁNH →", panel, 580, 653, 660, 55, UiKit.Mint, UiKit.Ink, game.StartFlight);
            UiKit.Label("BẢN 0.4 / CHUYẾN BAY LIÊN TỤC", panel, 32, 659, 510, 35, 13, UiKit.Muted, true);
        }

        public void AnimateHangar(float delta, FlightEnvironment environment) => hangarTerrain?.Animate(delta, environment, .25f);

        public void ShowMenu(VocabularyCatalog catalog, VocabularyFilter filter, VocabularyEntry[] filtered, int page, string error = null)
        {
            var panel = ClearOverlay(40, 70, 1360, 750);
            Setup = new VocabularySetupView(game, panel, catalog, filter, filtered, page, error);
            UiKit.Button("← HANGAR", overlay, 60, 838, 180, 43, UiKit.Line, UiKit.Cream, game.ReturnToMenu).GetComponentInChildren<Text>().fontSize = 14;
            UiKit.Label("CEFR Oxford · Nghĩa Việt nhập tự động cần rà soát · Chủ đề do game phân loại.\nGiữ toàn bộ lựa chọn trong chuyến bay; tên lửa cũng dùng bộ từ đã chọn.", overlay, 270, 833, 1100, 53, 13, UiKit.Muted);
        }

        public void ShowCredits()
        {
            var panel = ClearOverlay(210, 115, 1020, 670);
            UiKit.Label("NGUỒN DỮ LIỆU VÀ GIẤY PHÉP", panel, 35, 25, 950, 54, 29, UiKit.Cream, true);
            string text = "Danh mục từ, từ loại và CEFR: Oxford Learner’s Dictionaries, Oxford 3000/5000.\nhttps://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000\nĐây không phải sản phẩm Oxford chính thức; không sao chép định nghĩa hoặc audio Oxford.\n\n" +
                "Dữ liệu từ điển: thichhoc.com (thichhoc-dict), giấy phép CC BY-SA 4.0.\nhttps://github.com/thichhoc-org/thichhoc-dict\nNguồn gốc: WordNet 3.1 (Princeton), CMUdict (CMU), Wiktionary.\nĐã chọn/lược nghĩa, ghép danh mục CEFR, thêm chủ đề và mục biên soạn.\n\n" +
                "Phần nghĩa Việt phái sinh giữ CC BY-SA 4.0; ghi nguồn và giấy phép đầy đủ nằm trong Attribution đi kèm game. Nguồn beta chưa được duyệt toàn bộ.\n\n" +
                "Phát âm: giọng máy Microsoft David en-US tạo cục bộ. Chủ đề do game phân loại. Nền và máy bay pixel được tạo bằng mã trong game.";
            UiKit.Label(text, panel, 35, 100, 950, 465, 18, UiKit.Muted);
            UiKit.Button("QUAY LẠI CHỌN BỘ TỪ", panel, 35, 586, 950, 52, UiKit.Mint, UiKit.Ink, game.OpenVocabulary);
        }
        public void HideOverlay() { Setup = null; hangarTerrain = null; overlay.gameObject.SetActive(false); EventSystem.current?.SetSelectedGameObject(null); }
        public void ShowPause()
        {
            var panel = ClearOverlay(400, 260, 640, 380);
            UiKit.Label("TẠM DỪNG CHUYẾN BAY", panel, 40, 35, 560, 60, 30, UiKit.Cream, true);
            UiKit.Label("Máy bay, tàu, tên lửa, vật phẩm và thời gian đều dừng.\nNhấn Escape hoặc tiếp tục khi sẵn sàng.", panel, 40, 116, 560, 70, 19, UiKit.Muted);
            UiKit.Button("TIẾP TỤC", panel, 40, 220, 560, 58, UiKit.Mint, UiKit.Ink, game.TogglePause);
            UiKit.Button("VỀ HANGAR", panel, 40, 295, 560, 46, UiKit.Line, UiKit.Cream, game.ReturnToMenu);
        }
        public void ShowResults(FlightProgress progress, int firstTry, int best, List<VocabularyEntry> missed)
        {
            var panel = ClearOverlay(255, 130, 930, 640);
            UiKit.Box("Accent", panel, 0, 0, 930, 4, UiKit.Orange);
            UiKit.Label("CHUYẾN BAY ĐÃ KẾT THÚC", panel, 40, 29, 850, 34, 15, UiKit.Orange, true);
            UiKit.Label(progress.Health <= 0 ? "TÊN LỬA ĐÃ PHÁ HỦY MÁY BAY." : "HẾT NHIÊN LIỆU.", panel, 40, 80, 850, 67, 30, UiKit.Cream, true);
            UiKit.Label(progress.Score.ToString("N0"), panel, 40, 160, 360, 90, 67, UiKit.Mint, true);
            UiKit.Label("ĐIỂM CHUYẾN BAY", panel, 43, 251, 350, 27, 13, UiKit.Muted, true);
            UiKit.Label("HẠ ĐÚNG: " + progress.Correct + "\nKỶ LỤC BỘ NÀY: " + best.ToString("N0"), panel, 450, 174, 400, 80, 21, UiKit.Cream, true);
            UiKit.Label("Sai " + progress.WrongAttempts + " lần · Đã học thêm sau mỗi lần thử.", panel, 40, 301, 850, 34, 17, UiKit.Muted);
            UiKit.Box("Divider", panel, 40, 353, 850, 1, UiKit.Line);
            UiKit.Label("TỪ CẦN XEM LẠI", panel, 40, 373, 850, 27, 13, UiKit.Orange, true);
            string review = missed.Count == 0 ? "Chưa có từ trả lời sai. Hãy tiếp tục ở chuyến bay sau." : string.Join("\n", missed.Take(4).Select(e => e.word + " — " + e.meaning));
            UiKit.Label(review, panel, 40, 411, 850, 120, 19, UiKit.Cream);
            UiKit.Button("BAY LẠI", panel, 40, 551, 410, 55, UiKit.Mint, UiKit.Ink, game.StartFlight);
            UiKit.Button("VỀ HANGAR", panel, 470, 551, 420, 55, UiKit.Line, UiKit.Cream, game.ReturnToMenu);
        }
        public void ShowError(string message)
        {
            var panel = ClearOverlay(330, 275, 780, 350);
            UiKit.Label("KHÔNG THỂ NẠP CHUYẾN BAY", panel, 35, 30, 710, 60, 28, UiKit.Coral, true);
            UiKit.Label(message, panel, 35, 116, 710, 170, 20, UiKit.Cream);
        }
        public void NewFlight(string selectedTopic) { history.Clear(); topic.text = selectedTopic; HideOverlay(); Feedback("LÁI: rê chuột ngang để đón R+. Tab để chuyển sang BẮN."); }
        public void SelectPartOfSpeech(string value) => pos.SetValueWithoutNotify(Math.Max(0, Array.IndexOf(posValues, value)));
        public void SetQuestion(VocabularyEntry entry, int number)
        {
            question.text = entry?.meaning ?? "Đang chờ máy bay tiếp theo…";
            kind.text = ""; SelectPartOfSpeech("");
        }
        public void SetInput(string value, bool accepting)
        {
            input.text = accepting ? (value.Length == 0 ? "Gõ từ tiếng Anh…" : value) + (Time.unscaledTime % 1 < .55f ? " ▏" : "") : "LÁI / Tab để chuyển sang BẮN";
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
            score.text = p.Score.ToString("000000"); combo.text = "COMBO ×" + GameRules.ComboMultiplier(p.Streak).ToString("0.00") + "  /  HẠ " + p.Correct;
            health.text = "GIÁP " + p.Health.ToString("00");
            fuelValue.text = "XĂNG " + Mathf.CeilToInt(p.Fuel) + "%";
            fuelFill.rectTransform.sizeDelta = new Vector2(100 * p.Fuel / 100, 5); fuelFill.color = p.Fuel < 20 ? UiKit.Coral : UiKit.Mint;
            metal.text = "KIM LOẠI " + p.Metal + "/5";
            power.text = p.Powered ? "CƯỜNG HÓA " + Mathf.CeilToInt(p.PowerSeconds) + "s / ĐIỂM ×1.5" : "5 mảnh → cường hóa 12s";
            int seconds = (int)p.ActiveSeconds; clock.text = (seconds / 60).ToString("00") + ":" + (seconds % 60).ToString("00");
            speed.text = "TỐC ĐỘ " + Mathf.RoundToInt(GameRules.SpeedMultiplier(p.ActiveSeconds) * 100) + "%";
            region.text = EnvironmentNames[(int)flight.Environment] + "  /  " + flight.Enemies.Count + " MÁY BAY";
            int remaining = Mathf.CeilToInt(ContinuousFlight.EnvironmentDuration - (float)(p.ActiveSeconds % ContinuousFlight.EnvironmentDuration));
            wave.text = "Đổi vùng sau " + remaining / 60 + ":" + (remaining % 60).ToString("00") + " · " + (flight.WaitingForDistinctWord ? "Đã dùng hết đáp án phân biệt trên màn hình" : "Máy bay tiếp: " + flight.SpawnIn.ToString("0.0") + "s");
            controlLabel.text = flight.Driving ? "LÁI  →  BẮN / Tab" : "BẮN  →  LÁI / Tab";
            fireButton.interactable = !flight.Driving && flight.Target != null;
            rollLabel.text = "ĐỔI NGHĨA (" + flight.Rolls + ")"; rollButton.interactable = flight.CanRoll;
            pos.interactable = !flight.Driving && flight.Target?.RequiresPartOfSpeech == true;
            kind.text = flight.Target == null ? "Chưa có mục tiêu. Đồng hồ sinh máy bay vẫn chạy." : flight.Target.RequiresPartOfSpeech ? "MÁY BAY SA MẠC: cần chọn đúng từ loại." : flight.Target.Health > 1 ? "KHIÊN BĂNG: cần hai lần trúng. Mỗi lần trúng sẽ đổi nghĩa." : "Gõ đúng từ tiếng Anh tương ứng rồi nhấn Enter.";
        }
        public void SetMuted(bool muted) => muteLabel.text = muted ? "ÂM: TẮT" : "ÂM: BẬT";

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

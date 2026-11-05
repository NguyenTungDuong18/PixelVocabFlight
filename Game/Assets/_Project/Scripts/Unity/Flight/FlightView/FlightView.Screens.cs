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
        public void ShowMenu(VocabularyCatalog catalog, VocabularyFilter filter, VocabularyEntry[] filtered, int page, string error = null)
        {
            var panel = ClearOverlay(40, 70, 1360, 750);
            Setup = new VocabularySetupView(game, panel, catalog, filter, filtered, page, error);
            UiKit.Sprite("Logo", overlay, 40, 4, 148, 60, "logo");
            UiKit.Size(UiKit.Button("<< CĂN CỨ", overlay, 60, 836, 180, 46, "olive", UiKit.Cream, game.ReturnToBase).GetComponentInChildren<Text>(), 15);
            UiKit.Label("CEFR Oxford · Nghĩa Việt nhập tự động cần rà soát · Chủ đề do game phân loại.\nGiữ toàn bộ lựa chọn trong chuyến bay; tên lửa cũng dùng bộ từ đã chọn.", overlay, 270, 833, 1100, 53, 13, UiKit.Muted);
        }

        public void ShowCredits()
        {
            var panel = ClearOverlay(210, 100, 1020, 700);
            UiKit.Label("NGUỒN DỮ LIỆU VÀ GIẤY PHÉP", panel, 35, 25, 950, 54, 29, UiKit.Cream, true);
            string text = "Danh mục từ, từ loại và CEFR: Oxford Learner’s Dictionaries, Oxford 3000/5000.\nhttps://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000\nĐây không phải sản phẩm Oxford chính thức; không sao chép định nghĩa hoặc audio Oxford.\n\n" +
                "Dữ liệu từ điển: thichhoc.com (thichhoc-dict), giấy phép CC BY-SA 4.0.\nhttps://github.com/thichhoc-org/thichhoc-dict\nNguồn gốc: WordNet 3.1 (Princeton), CMUdict (CMU), Wiktionary.\nĐã chọn/lược nghĩa, ghép danh mục CEFR, thêm chủ đề và mục biên soạn.\n\n" +
                "Phần nghĩa Việt phái sinh giữ CC BY-SA 4.0; ghi nguồn và giấy phép đầy đủ nằm trong Attribution đi kèm game. Nguồn beta chưa được duyệt toàn bộ.\n\n" +
                "Phát âm: giọng máy Microsoft David en-US tạo cục bộ. Chủ đề do game phân loại.\nĐồ họa 0.15: máy bay, tàu, rocket, buồng lái, địa hình, động vật, hiệu ứng, căn cứ, công trình, khí tài và nhân vật là pixel art vẽ bằng mã (Tools/PixelForge), lưu từng khung hình. Bối cảnh hư cấu lấy cảm hứng Thế chiến II.\nPhông chữ VT323 (The VT323 Project Authors), giấy phép SIL Open Font License 1.1.";
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
            UiKit.Button("VỀ CĂN CỨ (GIỮ NHIỆM VỤ)", panel, 40, 300, 560, 50, "olive", UiKit.Cream, game.ReturnToBase);
        }
        public void ShowResults(FlightProgress progress, int firstTry, int best, List<VocabularyEntry> missed)
        {
            var panel = ClearOverlay(255, 120, 930, 660);
            SetCurtain(0);
            UiKit.Icon("icon_medal", panel, 40, 30, 30);
            UiKit.Label("BÁO CÁO SAU NHIỆM VỤ", panel, 80, 29, 800, 34, 16, UiKit.Orange, true);
            UiKit.Label(progress.Health <= 0 ? "HẾT GIÁP. MÁY BAY BỊ BẮN HẠ." : "HẾT NHIÊN LIỆU. HẠ CÁNH KHẨN CẤP.", panel, 40, 76, 850, 67, 30, UiKit.Cream, true);
            UiKit.Label(UiKit.Number(progress.Score), panel, 40, 156, 380, 90, 64, UiKit.Mint, true);
            UiKit.Label("ĐIỂM CHUYẾN BAY", panel, 43, 248, 350, 27, 13, UiKit.Muted, true);
            UiKit.Label("TRẢ LỜI ĐÚNG: " + progress.Correct + "  (đúng ngay lần đầu: " + firstTry + ")\nHẠ BẰNG VỤ NỔ: " + progress.BlastKills + "\nKỶ LỤC BỘ NÀY: " + UiKit.Number(best), panel, 450, 160, 440, 100, 18, UiKit.Cream, true);
            UiKit.Label("Sai " + progress.WrongAttempts + " lần · Đã học thêm sau mỗi lần thử.", panel, 40, 296, 850, 34, 16, UiKit.Muted);
            UiKit.Box("Divider", panel, 40, 345, 850, 2, UiKit.Line);
            UiKit.Label("TỪ CẦN XEM LẠI", panel, 40, 362, 850, 27, 13, UiKit.Orange, true);
            string review = missed.Count == 0 ? "Chưa có từ trả lời sai. Hãy tiếp tục ở chuyến bay sau." : string.Join("\n", missed.Take(4).Select(e => e.word + " — " + e.meaning));
            UiKit.Label(review, panel, 40, 396, 850, 140, 18, UiKit.Cream);
            UiKit.Label("Kết quả sẽ được báo về Giáo sư Whitmore.", panel, 40, 572, 420, 48, 14, UiKit.Muted);
            ResultsButton = UiKit.Button("VỀ CĂN CỨ   [ENTER]", panel, 470, 566, 420, 60, "gold", UiKit.Ink, game.CompleteSortie);
        }
        // Test hook: the single results button (VỀ CĂN CỨ).
        public Button ResultsButton { get; private set; }
        public void ShowError(string message)
        {
            var panel = ClearOverlay(330, 275, 780, 350);
            SetCurtain(0);
            UiKit.Label("KHÔNG THỂ NẠP CHUYẾN BAY", panel, 35, 30, 710, 60, 28, UiKit.Coral, true);
            UiKit.Label(message, panel, 35, 116, 710, 170, 20, UiKit.Cream);
        }
    }
}

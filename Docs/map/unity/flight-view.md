# FlightView: header, cockpit, overlay, màn phụ

Code: thư mục `Scripts/Unity/Flight/FlightView/` (partial class), mọi màn hình ngoài sân chơi:

- `FlightView.cs`: field, constructor dựng header + cockpit, helper (`Gauge`, `ClearOverlay`…), `Capture`.
- `FlightView.Cockpit.cs`: `NewFlight`, `SelectPartOfSpeech`, `SetQuestion`, `SetInput`, `Feedback`, `Log`, `Refresh`, `SetMuted`.
- `FlightView.Screens.cs`: `ShowMenu`, `ShowCredits`, `HideOverlay`, `ShowPause`, `ShowResults`, `ShowError`.
- `FlightView.TakeOff.cs`: cất cánh và vào trận (`takeoff-intro.md`).

Sân chơi: `board.md`. Hằng cockpit phải khớp `Tools/PixelForge/ui/cockpit.cjs`: `ops/sync-constants.md`.

## Cấu trúc

- Canvas và header (CanvasGroup: tên bộ từ, điểm, nút pause/mute).
- `Board` (FlightBoardView).
- **Cockpit** (CanvasGroup) tại y = 652 (`CockpitTop`), 1440×248. Ảnh nền `cockpit_panel` 720×124 vẽ ×2.
- Overlay (pause/kết quả/lỗi) và curtain (màn đen).
- Con: `Base` (BaseView), `Dialogue` (DialogueView), `Setup` (VocabularySetupView).

## Cockpit (tọa độ = hằng `COCKPIT` trong `ui.cjs` ×2)

- Ba đồng hồ: xăng E–F, tốc độ 100–150%, giờ bay. Kim là `gauge_needle` 48 khung, 7,5° mỗi khung.
- 5 đèn GIÁP: xanh ≥4, vàng 3, đỏ 2, đỏ nhấp nháy 1.
- Bảng đồng: số giáp, tiếp tế, cường hóa; nút ĐỔI NGHĨA.
- **Màn CRT:** nghĩa tiếng Việt, loại câu hỏi, dòng `recent` (cảnh báo khóa, máy bay vừa hạ), scanline.
- **Khe gõ:** `ui_input` / `ui_input_focus`; placeholder `NHẬP ĐỂ BẮN` khi LÁI; **dấu nháy là Image riêng**, đặt theo độ rộng chữ đo bằng `TextGenerator` (`MeasureWidth`, ký tự canh "|" để tính cả khoảng trắng cuối), cách chữ 2 px, nhấp nháy.
- Dropdown từ loại POS (mở lên trên, chỉ bật ở Sa mạc), nút đỏ BẮN [ENTER], cần gạt LÁI/BẮN.

## Màn khác

`ShowMenu(catalog, filter, filtered, page, error)` (tạo `VocabularySetupView`; chỉ vẽ khi `Mode.Vocabulary`), `ShowCredits`, `ShowPause` (có "VỀ CĂN CỨ (GIỮ NHIỆM VỤ)"), `ShowResults(...)` (nút duy nhất "VỀ CĂN CỨ"), `ShowError(msg)`, `SetMuted`. Hangar cũ đã gỡ ở 0.15.

## Mỗi khung khi bay

`SetInput(value, focused)`, `Refresh(flight)` (đồng hồ, đèn, CRT, nút). Thuộc tính `PartOfSpeechOpen`. `Capture(path)` chụp ảnh cho smoke.

**Test hook:** `HudAlpha, CurtainAlpha, CaretVisible, PlaceholderVisible, CaretGap, TakeOffElapsed, TakeOffHeroPosition, TakeOffHeroSize, TakeOffSmokePuffs, TakeOffScroll, TakeOffVisible, OverlayVisible, ResultsButton`.

**Lưu ý:** `ClearOverlay` vô hiệu hóa pos/fire/roll và bỏ chọn, để Enter không mở dropdown.

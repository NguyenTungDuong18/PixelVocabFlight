# UiKit và VocabularySetupView

Code: `Scripts/Unity/UI/UiKit.cs`, `Scripts/Unity/UI/VocabularySetupView.cs` (91 dòng).

## `UiKit`: dựng UI bằng code

- **Bảng màu:** `Ink, Panel, Line, Muted, Cream, Mint, Orange, Coral`, `Hex("RRGGBB")`.
- **Font:** `Font` nạp `Fonts/WordwingVi` (font pixel tự sinh, `node Tools/PixelForge/fonts.cjs`), thiếu thì VT323, rồi font OS (static, tự kiểm tra `if (font)`). `EnglishFont` = `Fonts/WordwingEn` (kiểu máy chữ đơn cách) cho mọi chỗ hiện hoặc gõ từ tiếng Anh, gán bằng `English(text)`: plate trên máy bay địch, ô gõ cockpit, thẻ đáp án tên lửa, cột từ ở màn chọn từ vựng. `FontScale = 1.3`.
- **Cỡ chữ:** font Wordwing (em 16 px) chỉ sắc ở bội của 16. Khi `Wordwing` true: `Px(design)` = `16 × max(1, round(design·1.3/16 + 0.25))` (9–15 → 16, 16–27 → 32, 28–39 → 48); `Fit(text, min, max)` dùng component `DiscreteFit` (thử từ `Px(max)` giảm từng 16, không dùng Best Fit); `StepDown(size)` cho ô gõ. Font khác giữ cỡ lẻ và Best Fit như cũ. Importer: `SelectedArtImporter.ConfigureFont` đặt `Fonts/Wordwing*.ttf` sang `HintedRaster`.
- **Builder** (tọa độ pixel tham chiếu, gốc ở góc trên trái của parent):
  - Khung, nền: `Rect(name, parent, x, y, w, h)`, `Box(...)`, `Slice(...)` (9-slice), `Framed(...)`.
  - Hình: `Sprite(...)`, `Icon(...)`. Chữ: `Label(text, parent, x, y, w, h, size, color, bold, anchor)`.
  - `Button(text, parent, x, y, w, h, bg, fg, onClick)`: kiểu olive/gold/cream/red, đổi sprite khi hover/nhấn.
  - `Input(...)`: InputField thật, chỉ dùng ở màn từ vựng. `Select(options, value, ...)`: Dropdown.

## `VocabularySetupView`: màn "CHUẨN BỊ ĐIỆN MẬT"

- **Cột trái:** 01 danh mục OXFORD 5000 / 3000; 02 khoảng CEFR (hai Dropdown); 03 chủ đề chọn nhiều (16, có "Tất cả"); 04 khoảng thứ tự từ/đến, nút 20/50/100/TẤT CẢ, ÁP DỤNG KHOẢNG.
- **Cột phải:** ô tìm kiếm + TÌM, số mục khớp, nút TOÀN BỘ OXFORD 5000; bảng xem trước 8 dòng/trang (#, từ/từ loại, CEFR, nghĩa), phân trang `<` `>`; dòng trạng thái và nút XONG / "<< CĂN CỨ".
- Mọi nút gọi API công khai của `FlightGame` (`flight-game.md`).

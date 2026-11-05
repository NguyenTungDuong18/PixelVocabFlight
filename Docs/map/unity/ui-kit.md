# UiKit và VocabularySetupView

Code: `Scripts/Unity/UI/UiKit.cs`, `Scripts/Unity/UI/VocabularySetupView.cs` (91 dòng).

## `UiKit`: dựng UI bằng code

- **Bảng màu:** `Ink, Panel, Line, Muted, Cream, Mint, Orange, Coral`, `Hex("RRGGBB")`.
- **Font:** `Font` (VT323, static, tự kiểm tra `if (font)`), `FontScale = 1.3`, `Px(size)`, `Fit(text, min, max)`.
- **Builder** (tọa độ pixel tham chiếu, gốc ở góc trên trái của parent):
  - Khung, nền: `Rect(name, parent, x, y, w, h)`, `Box(...)`, `Slice(...)` (9-slice), `Framed(...)`.
  - Hình: `Sprite(...)`, `Icon(...)`. Chữ: `Label(text, parent, x, y, w, h, size, color, bold, anchor)`.
  - `Button(text, parent, x, y, w, h, bg, fg, onClick)`: kiểu olive/gold/cream/red, đổi sprite khi hover/nhấn.
  - `Input(...)`: InputField thật, chỉ dùng ở màn từ vựng. `Select(options, value, ...)`: Dropdown.

## `VocabularySetupView`: màn "CHUẨN BỊ ĐIỆN MẬT"

- **Cột trái:** 01 danh mục OXFORD 5000 / 3000; 02 khoảng CEFR (hai Dropdown); 03 chủ đề chọn nhiều (16, có "Tất cả"); 04 khoảng thứ tự từ/đến, nút 20/50/100/TẤT CẢ, ÁP DỤNG KHOẢNG.
- **Cột phải:** ô tìm kiếm + TÌM, số mục khớp, nút TOÀN BỘ OXFORD 5000; bảng xem trước 8 dòng/trang (#, từ/từ loại, CEFR, nghĩa), phân trang `<` `>`; dòng trạng thái và nút XONG / "<< CĂN CỨ".
- Mọi nút gọi API công khai của `FlightGame` (`flight-game.md`).

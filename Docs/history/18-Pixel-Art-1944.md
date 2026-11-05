# 0.13 — Pixel art Thế chiến II, màn hình chờ mới và rà soát logic

Ngày: 04/11/2026. Trạng thái: đã build Windows và chạy smoke test trên bản build thật (xem mục Kiểm tra).

## 1. Rà soát logic so với quy ước game hiện nay

Đã đọc toàn bộ mã (`Core`, `UI`, `Aircraft`, `Art`, `Audio`, `Vocabulary`, `Persistence`, `Editor`) và dữ liệu 5.981 mục.

**Đã nhất quán, giữ nguyên**

- Mô phỏng tách khỏi hiển thị; bước mô phỏng tối đa 0,05 s nên va chạm không bị "xuyên" khi tụt khung hình; va chạm quét theo chuyển động tương đối.
- Sau khi trúng đòn có 0,65 s bất tử, nhấp nháy thân máy bay (i-frame) — đúng quy ước game hành động.
- Hitbox người chơi bán kính 47 px nhỏ hơn tổng kích thước hình của hai máy bay (≈74 px) → va chạm "dễ tha", đúng xu hướng game bắn máy bay.
- Có cảnh báo 1,2 s trước khi địch lao tới; có thể né bằng chế độ LÁI → sát thương luôn tránh được.
- Tốc độ tăng 10%/phút, trần 150%, không nhân lãi kép; pause, menu, mất focus đều dừng thời gian.
- Điểm, combo (×0,25 mỗi 5 câu, tối đa ×2), cường hóa ×1,5 và nhiên liệu đều nằm trong lõi thuần, có 30.533 kiểm tra tự động.
- Dữ liệu: cả 5.981 từ đều gõ được bằng bộ ký tự game nhận; 17 từ loại trong dữ liệu đều có trong ô chọn từ loại → không có câu hỏi "không thể trả lời".

**Đã sửa**

| Vấn đề | Trước | Sau |
|---|---|---|
| Một chỉ số có ba tên | HUD ghi "MÁU" và "KIM LOẠI 5/5" cùng lúc, hangar ghi "5 GIÁP", thông báo ghi "−2 kim loại / còn 3/5 máu" | Thống nhất là **GIÁP**; kim loại là vật phẩm sửa 1 giáp; HUD chỉ hiện 5 ô giáp một lần |
| Hiệu ứng bắn lệch bối cảnh | Tia laser xanh | Đạn vạch từ hai súng cánh, chớp nòng, rồi mới nổ khi đạn tới |
| Phản hồi khi trúng đòn yếu | Vài ô vuông màu | Nổ 8 khung hình + rung màn hình 0,3 s |
| Tàu sân bay lẽ ra phải có sóng mũi | Chỉ có gợn tròn | Sóng mũi và bọt đuôi tàu chỉ hiện khi tàu di chuyển |
| Khiên băng không báo đã trúng | Vòng tròn biến mất | Máy bay đổi sang khung hình hư hại: động cơ cháy, khói |
| Màn hình chờ khó chọn nhanh | Chỉ dùng chuột | Phím **1–4** chọn chiến trường, **Enter** cất cánh, **V** chuẩn bị bộ từ; màn kết quả: **Enter** bay lại |
| Ký tự font không hỗ trợ | → ← ↵ ▾ ✓ ▏ − dựa vào font hệ thống | Thay bằng ký tự ASCII hoặc icon pixel |
| Mã chết, ảnh thừa trong bản build | `PixelAircraft.cs`, `UserArt.cs`, `WarVisuals.cs`; 13 ảnh lớn trong `Resources` dù không còn dùng | Đã xóa mã chết; 13 ảnh đều đã có bản giống hệt trong `SourceAssets`, nên gỡ khỏi `Resources` |
| Script build giữ file đã xóa | `Copy-Item` chỉ chép đè | `Build-Windows.ps1` xóa bản sao cũ rồi chép lại |

**Ghi nhận, chưa đổi (thuộc thiết kế, cần chơi thử để quyết)**

- Mọi máy bay địch đều lao vào người chơi sau 18 s, kể cả máy bay không phải mục tiêu. Ở BĂNG GIÁ (cần 2 lần trúng, đổi mục tiêu sau mỗi lần trúng) người chơi dễ phải liên tục chuyển LÁI/BẮN. Nên chơi thử để cân bằng.
- Tàu sân bay phóng "rocket" chọn đáp án: không đúng lịch sử Thế chiến II, chấp nhận được vì là game arcade hư cấu.
- `FlightProgress.Miss()` không còn được gọi trong luật hiện tại (chỉ dùng trong kiểm tra).
- `CanvasScaler` co giãn theo tỉ lệ không nguyên (1280×800 → 0,89), nên một số "pixel" hiển thị lệch 1 px. Muốn pixel tuyệt đối đều cần đổi bố cục sang tỉ lệ nguyên.

## 2. Bộ đồ họa pixel mới

Tất cả được vẽ bằng mã trong `Tools/PixelForge` (Node.js + sharp đã có sẵn), trên lưới pixel thật, bảng màu thời chiến (ô liu, kaki, thép, xám hải quân, đỏ sẫm). Không dùng ảnh ngoài. Mỗi khung hình là một file PNG riêng:

```
Game/Assets/_Project/Art/Resources/Pixel/<Nhóm>/<tên>_<khung>.png
Game/Assets/_Project/Art/Resources/Pixel/pixel-manifest.json   (kích thước, fps, lặp, viền 9-slice)
SourceAssets/PixelArt/Pixel1944/preview-*.png                   (bảng xem trước phóng 4 lần)
```

63 hoạt ảnh, 158 khung hình:

| Nhóm | Nội dung |
|---|---|
| Aircraft | Tiêm kích người chơi 32×32: bay thẳng / nghiêng trái / nghiêng phải × 4 khung cánh quạt, bóng đổ. Oanh tạc cơ hai động cơ 48×40 với 4 bộ sơn theo chiến trường (rừng, sa mạc, băng, biển) × bình thường / hư hại (cháy, khói) |
| Naval | Tàu sân bay 32×112: radar quay, đèn nháy, khói ống khói; sóng mũi, bọt đuôi |
| Weapons | Rocket thường / rocket quá nhiệt (sau 3 lần sai) có lửa đuôi; đạn vạch; chớp nòng |
| Supplies | Can xăng, tấm giáp + cờ lê, hộp vô tuyến R+ (đèn ăng-ten nháy) |
| Effects | Nổ 8 khung, tia lửa, khói, sóng xung kích, khiên băng, bọt nước |
| UI | Khung 9-slice (panel tán đinh, ô nhập, thẻ, phím), nút ô liu / vàng / kem / đỏ × 3 trạng thái, ô giáp, 13 icon |
| Title | Logo WORDWING có huy hiệu cánh, 4 ảnh thẻ chiến trường, sân bay nhìn từ trên xuống (4 khung: đèn đường băng chạy, đèn tháp, ống gió), lớp mây cuộn |

Hướng: mọi đơn vị vẽ mũi hướng lên; game xoay khi chạy. Trong trận, đơn vị hiển thị ở tỉ lệ nguyên 2×; màn hình chờ dùng 4×.

Phông chữ: **VT323** (SIL OFL 1.1), đủ toàn bộ chữ tiếng Việt có dấu. Giấy phép: `Game/Assets/StreamingAssets/Attribution/VT323-OFL.txt`.

Sửa đồ họa: chỉnh `Tools/PixelForge/units.cjs` hoặc `ui.cjs`, chạy `node Tools/PixelForge/forge.cjs`. Công cụ giữ file `.meta` của khung hình còn tồn tại nên Unity không đổi GUID.

## 3. Màn hình chờ mới

- Nền là sân bay dã chiến 1944 nhìn từ trên xuống, có máy bay của người chơi đỗ trên đường băng (cánh quạt quay), mây trôi và tốp 3 máy bay bay ngang định kỳ.
- Bảng **LỆNH XUẤT KÍCH** bên phải: 4 thẻ chiến trường lớn có ảnh minh họa, phím tắt 1–4, luật riêng ghi rõ một dòng; thẻ đang chọn có khung vàng và mũi tên nhấp nháy.
- Tóm tắt nhanh: số từ, 5 giáp, 3 lượt đổi, 3:00 mỗi vùng.
- Nút **CHUẨN BỊ BỘ TỪ [V]** và nút lớn **CẤT CÁNH [ENTER]**; nút cất cánh bị khóa nếu bộ từ dưới 4 mục.
- Dải phím điều khiển ở dưới: CHUỘT / TAB / ENTER / ESC.

## 4. Kiểm tra

1. `node Tools/PixelForge/forge.cjs`: 63 hoạt ảnh, 158 file khung hình.
2. `dotnet build Tools/UnityCompileChecks`: 0 lỗi, 0 cảnh báo.
3. `dotnet run --project Tools/RulesChecks`: PASS 30.533 kiểm tra luật chơi và dữ liệu + 13 kiểm tra tương tác.
4. `Tools/Build-Windows.ps1`: build thành công.
5. `Tools/Test-Windows.ps1 -OutputFolder Smoke-Pixel-0.13`: PASS 54/54 kiểm tra trên bản build thật, gồm các kiểm tra mới: nạp đủ 158 khung, nạp font pixel, màn hình chờ hiển thị, phím 1–4, khung cánh quạt đổi theo thời gian, bộ sơn sa mạc, đạn vạch + nổ, khung hư hại khi trúng khiên băng, pause đóng băng hoạt ảnh. Ảnh chụp nằm trong `Tools/Smoke-Pixel-0.13/`.

Chưa làm: chơi thử bằng người thật để đánh giá độ khó và độ dễ đọc ở nhiều độ phân giải.

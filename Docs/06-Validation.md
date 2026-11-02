# Kết quả kiểm tra prototype 0.1

Ngày kiểm tra: 02/11/2026. Unity Editor 6000.6.7f1, bản Windows 64-bit, Mono.

## Kết quả đã xác minh

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Luật tốc độ, chuẩn hóa đáp án, điểm, combo, xăng, cường hóa và tính toàn vẹn dữ liệu | 112 trường hợp đạt | `Tools/RulesChecks/Program.cs` và kết quả chạy `dotnet run` |
| Biên dịch và xuất Windows | Thành công, Unity trả mã 0 | `Tools/unity-build-isolated.log` |
| Từ của máy bay khác không hạ mục tiêu | Đạt | `Tools/Smoke/smoke-report.json`: `wrongTargetImmune = true` |
| Nhập chữ và Enter qua Unity Input System | Sáu câu được giải quyết đúng | `completedAnswers = 6`, tổng điểm ở lần kiểm tra 1193 |
| Đủ kim loại kích hoạt cường hóa | Đạt | `metalUpgrade = true` |
| Pause dừng đồng hồ và nhiên liệu | Đạt | `pauseFrozen = true` |
| Mất ba giáp mở màn kết quả | Đạt | `gameOver = true` |
| Tạo ảnh từ camera game | Đạt | `screenshotsCaptured = true`, năm file PNG |
| File phát âm | 40 file WAV có header RIFF hợp lệ, không rỗng | `Game/Assets/_Project/Audio/Pronunciation/US/Resources/Pronunciation` |
| Kiểm tra hình ảnh | Đã xem menu, trận chơi, pause, cường hóa và kết quả | PNG trong `Tools/Smoke` |

Kiểm tra gameplay gửi sự kiện chữ và Enter vào một bàn phím QA của Unity Input System, dùng cùng đường xử lý với gameplay. File tiến độ QA được lưu riêng, không ghi kỷ lục thử vào hồ sơ người chơi.

## Hình ảnh

- `Tools/Smoke/01-menu.png`: chọn chủ đề và số mục.
- `Tools/Smoke/02-flight.png`: ba máy bay, nghĩa Việt, ô nhập và HUD.
- `Tools/Smoke/03-paused.png`: tạm dừng.
- `Tools/Smoke/04-upgrade.png`: đang cường hóa.
- `Tools/Smoke/05-results.png`: điểm và từ cần xem lại.

Các ảnh được dựng bằng camera sang RenderTexture để không phụ thuộc việc cửa sổ QA ẩn có được Windows trình bày ra màn hình hay không. Đây là ảnh nội dung Unity thực sự render, không phải ảnh mô phỏng dựng lại bên ngoài.

## Giới hạn kiểm tra

Công cụ điều khiển cửa sổ Windows không kết nối được trong phiên này nên chưa có lượt chơi thủ công bằng chuột/bàn phím vật lý. Đã kiểm tra đường xử lý nhập bằng sự kiện Unity và xem ảnh render của bản game.

Chưa chạy một buổi chơi 30–60 phút hoặc thử trên máy Windows thứ hai. Quy tắc tăng tốc đến trần được kiểm tra tự động theo các mốc thời gian, chưa phải ghi nhận một lượt chơi thực kéo dài sáu phút.

File phát âm được tạo bằng giọng hệ thống và kiểm tra định dạng/nạp vào game; chưa có bước nghe duyệt thủ công toàn bộ 40 mục. Chất lượng bản dịch và phân loại CEFR cần được duyệt cho bộ học chính thức.

Log khi chụp camera có cảnh báo shader hậu kỳ URP không được dùng/đã bị loại khỏi build. Không có exception gameplay trong lượt kiểm tra đạt; hiệu ứng hậu kỳ này không được sử dụng trong giao diện prototype.

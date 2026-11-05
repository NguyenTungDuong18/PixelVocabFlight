# Bảng điều khiển người chơi

Code xử lý phím: `Scripts/Unity/Game/FlightGame/FlightGame.cs` (`Update`), `FlightGame.Base.cs` (căn cứ, hội thoại), `FlightGame.Sortie.cs` (`ReceiveCharacter`), xem `unity/flight-game.md`.

| Phím / thao tác | Nơi | Tác dụng |
| --- | --- | --- |
| Phím bất kỳ | Thẻ tiêu đề | Ẩn thẻ |
| WASD / mũi tên, Shift | Căn cứ | Đi / chạy |
| E / Space / Enter | Căn cứ | Tương tác (nói chuyện, lên máy bay) |
| 1–9, W/S ↑/↓, E/Enter/Space, chuột | Hội thoại | Chọn lựa chọn; chữ đang chạy thì hiện hết |
| Esc | Hội thoại | Đóng (ở căn cứ Esc không pause) |
| Enter | Kết quả | VỀ CĂN CỨ (hoàn thành nhiệm vụ) |
| Tab | Trận | Đổi LÁI ↔ BẮN; vào BẮN thì khe gõ có focus ngay |
| Chuột | Trận, LÁI | Di chuyển máy bay theo X |
| Gõ chữ + Enter | Trận, BẮN | Bắn mục tiêu điện đài |
| Backspace (giữ để lặp), Ctrl+A | Trận, BẮN | Sửa chữ |
| 1–4 / bấm thẻ | Khi có tên lửa mở đáp án | Chọn đáp án; tự chuyển sang BẮN |
| Nút ĐỔI NGHĨA | Trận | `Roll()`: tốn 1 lượt, đổi mục tiêu |
| Ô từ loại | Sa mạc | Bắt buộc chọn đúng `pos` |
| Esc | Trận | Pause / tiếp tục |

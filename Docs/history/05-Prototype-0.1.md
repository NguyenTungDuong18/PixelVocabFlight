# WORDWING — bản chơi thử 0.1

Tài liệu lịch sử của bản đầu. Bản hiện tại đã bổ sung danh mục Oxford và bộ lọc CEFR; xem [hướng dẫn 0.2](07-Oxford-Library.md). Phần giới hạn dữ liệu 40 từ bên dưới chỉ mô tả bản 0.1.

## Chạy game

- Bản Windows: mở `Builds/Windows/Wordwing.exe` và giữ toàn bộ các file cạnh .exe.
- Trong Unity: mở `Game`, mở scene `Assets/_Project/Scenes/Flight.unity`, rồi nhấn Play.
- Nếu Editor đang mở từ trước và chưa thấy file mới, quay lại cửa sổ Editor để Unity nhập các thay đổi.

## Cách chơi

1. Chọn chủ đề Đồ ăn hoặc Du lịch và số mục trong tập học.
2. Chọn Cất cánh.
3. Đọc nghĩa tiếng Việt phía dưới, tìm từ tương ứng trên ba máy bay.
4. Gõ từ rồi nhấn Enter hoặc nút Bắn.
5. Chỉ câu trả lời khớp nghĩa hiện tại mới hạ được máy bay. Từ khác đang hiện cũng không được tính.
6. Đúng thì có điểm, nghe phát âm và nhận kim loại. Sai thì mất combo, có thể sửa trong thời gian còn lại.
7. Mục tiêu vượt vạch phòng thủ thì mất một giáp. Các máy bay còn lại không gây mất giáp khi bay qua.

Máy bay người chơi tự giữ vị trí. Không cần nhấp chọn mục tiêu hoặc né bằng chuột trong prototype.

## Phím

| Phím | Tác dụng |
|---|---|
| Chữ cái | Nhập đáp án |
| Backspace | Xóa ký tự cuối, giữ để xóa liên tục |
| Ctrl+A | Xóa nhanh nội dung đang nhập |
| Enter | Gửi câu trả lời |
| Escape | Tạm dừng/tiếp tục |

Khi mất focus, game tự tạm dừng. Nút âm thanh bật/tắt cả giọng đọc và hiệu ứng.

## Luật đang dùng

- 3 giáp và 100 xăng ban đầu.
- Tốc độ tăng 10% tốc độ gốc mỗi phút, tối đa 150% từ phút 5.
- Sai hoặc bỏ lỡ làm mất combo; cứ 5 câu đúng liên tiếp tăng 0,25, tối đa x2.
- Mỗi lần hạ đúng nhận một mảnh kim loại. Đủ 5 kích hoạt 12 giây cường hóa: điểm x1,5 và tiêu hao xăng giảm một nửa.
- Sau mỗi 3 lần hạ đúng xuất hiện bình xăng hồi **50**. Đây là mức cân bằng thử đã điều chỉnh từ đề xuất 40 ban đầu để phù hợp đường bay chậm.
- Vật phẩm tự bay về phía người chơi. Không có đạn lan bỏ qua yêu cầu gõ đúng.
- Bộ từ lặp vô hạn theo thứ tự xáo trộn; mục tiêu không lặp ngay giữa hai vòng.
- Tiến độ từ vựng và kỷ lục được lưu tại `%USERPROFILE%\AppData\LocalLow\PixelVocabFlight\Wordwing\pilot-profile.json`.

## Nội dung của bản thử

24 mục chủ đề Đồ ăn và 16 mục Du lịch. Đây là dữ liệu tự biên soạn, **chưa xác minh CEFR và không phải bộ Oxford chính thức**. Vì vậy chưa có lựa chọn B1 trong bản này. Các cách viết tương đương được chấp nhận khi có khai báo, ví dụ `yogurt` và `yoghurt`.

Phát âm dùng file WAV tạo từ giọng Microsoft David Desktop en-US trên Windows, phát offline. Phiên âm IPA, lựa chọn giọng UK, bộ lọc CEFR và quy trình duyệt nội dung hoàn chỉnh thuộc giai đoạn tiếp theo.

Đồ họa máy bay và hiệu ứng được tạo bằng mã C#, theo phong cách pixel. Prototype dùng từng nhóm ba máy bay cho một câu hỏi để kiểm chứng cơ chế trước khi mở rộng bộ điều phối nhiều máy bay.

Màn kết quả liệt kê tối đa bốn từ cần xem lại. Bài ôn riêng không hiện đáp án, chọn khoảng thứ tự tùy ý, nhiều chủ đề cùng lúc và lịch ôn chưa có trong bản 0.1.

## Mã nguồn

- `Scripts/Core/FlightGame.cs`: điều phối menu, trận chơi, nhập phím và chuyển câu.
- `Scripts/Core/GameRules.cs`, `FlightProgress.cs`: luật tính điểm, tốc độ và tài nguyên.
- `Scripts/Vocabulary/`: nạp dữ liệu và chọn đáp án.
- `Scripts/Aircraft/FlightBoardView.cs`: máy bay, nền cuộn, bắn và vật phẩm.
- `Scripts/UI/`: HUD, menu, pause và kết quả.
- `Scripts/Art/PixelAircraft.cs`: tạo sprite pixel bằng mã.
- `Scripts/Audio/FlightAudio.cs`: phát âm và hiệu ứng.
- `Scripts/Persistence/ProfileStore.cs`: lưu tiến độ.

## Build và kiểm tra

Trong Editor, chọn `Wordwing → Build Windows prototype` sau khi đã có scene. Hoặc chạy `Tools/Build-Windows.ps1` để build từ bản sao làm việc, không phải đóng Editor đang mở.

`Tools/BuildWorkspace` là cache làm việc do công cụ sinh ra. Nguồn chính luôn là `Game` ở thư mục gốc; không chỉnh mã trong bản sao này.

`Tools/Generate-Pronunciation.ps1` tạo lại audio từ giọng hệ thống. `Tools/RulesChecks` kiểm tra luật và dữ liệu bằng .NET. Tùy chọn dòng lệnh `--smoke-test --smoke-output <thư mục>` dành cho kiểm tra tự động bản game, dùng file tiến độ QA riêng và tự thoát khi hoàn tất.

# 0.11 — Mô hình chuyển động và tương tác

Ngày kiểm tra: 04/11/2026. Trạng thái: mã nguồn đã sửa và kiểm thử logic; chưa xuất được bản Windows mới do Unity Editor không có license hợp lệ (exit 198).

## Thay đổi

- Lái chuột đặt đích đến; máy bay bay ngang với tốc độ tối đa 0,85 chiều rộng sân/giây. Chuyển sang BẮN dừng ngay tại vị trí hiện tại.
- Va chạm dùng chuyển động tương đối của địch và người chơi trên từng bước tối đa 0,05 giây. Việc kéo chuột qua địch không còn bỏ qua đường di chuyển.
- Sau va chạm, người chơi có 0,65 giây bảo vệ, hiển thị bằng nhấp nháy thân máy bay. Vật thể va chạm vẫn bị loại bỏ; không trừ máu hoặc phát âm thanh tổn thương lặp trong thời gian bảo vệ.
- Máy bay và tên lửa xuất phát ở đầu boong tàu (cách tâm 88 pixel theo chiều dọc sân), thay vì cùng xuất hiện tại tâm thân tàu. Tàu là vật thể mặt nước; máy bay/tên lửa là lớp trên không nên không có va chạm thân tàu với máy bay.
- Giữ tỷ lệ sprite người chơi, địch và tên lửa. Căn tâm người chơi với vị trí mô phỏng; popup tên lửa được đặt trên lớp người chơi để không bị che nút chọn.
- Mỗi tên lửa giải đúng ghi nhận đúng một câu trả lời. Máy bay chết vì nổ lan cho 25 điểm mỗi chiếc, không tăng số câu đúng, combo hay tiến độ học từ chưa trả lời.
- Lưu kỷ lục cuối chuyến, gồm cả điểm nổ lan. Dùng khóa bảng điểm interaction-v3 để không so sánh điểm với luật cũ.
- Xóa âm thanh/hàng đợi phát âm khi kết thúc chuyến; đặt lại hiệu ứng hover và vệt nước khi bắt đầu lại.
- Bỏ qua giá trị thời gian/con trỏ NaN hoặc vô hạn để tránh trạng thái lỗi hoặc vòng lặp không kết thúc.

## Kết quả kiểm tra thực tế

1. `dotnet run --project Tools/RulesChecks`: PASS 30.533 kiểm tra gameplay, dữ liệu và lựa chọn từ; trong đó có 13 kiểm tra hồi quy tương tác mới. Đây là số assertion, không phải 30.533 kịch bản chơi độc lập.
2. `dotnet build Tools/UnityCompileChecks --nologo`: thành công, 0 warning / 0 error. Công cụ dùng .NET 8 và thư viện Unity/package đã có trong máy; chỉ kiểm tra khả năng biên dịch C#, không thay thế Unity import/build/runtime.
3. `Tools/Build-Windows.ps1`: thất bại trước bước build do `No valid Unity Editor license found. Please activate your license.` (exit 198).
4. Chưa chạy được smoke test hoặc xem ảnh render của mã 0.11. Các ảnh Smoke-Heading và file Builds/Windows/Wordwing.exe đang có thuộc bản trước, không phải bằng chứng kiểm tra 0.11.

## Kiểm chứng còn lại trước khi phát hành

- Kích hoạt license hợp lệ cho Unity Editor 6000.6.7f1 qua Unity Hub, rồi chạy `Tools/Build-Windows.ps1`.
- Chạy bản Windows mới với `--smoke-test --smoke-output <thư-mục-kết-quả>`; kiểm tra mọi mục trong smoke-report.json đều PASS và xem ảnh tạo ra. Bộ smoke đã được cập nhật theo tốc độ lái và thời gian bảo vệ mới nhưng chưa thực thi được.
- Chơi thử các chế độ LÁI/BẮN, sa mạc, băng và biển; kiểm tra tốc độ né, tỷ lệ sprite, tâm va chạm, popup, âm thanh, pause/resume, game over và lưu tiến độ trên bản build thật.
- Thử bản đóng gói trên máy Windows sạch, nhiều độ phân giải, rồi đánh giá độ khó với người chơi thực tế.
- Hồ sơ nguồn asset hiện ghi player/carrier là ảnh người dùng cung cấp, âm đọc được tạo bằng giọng hệ thống, và dữ liệu nghĩa còn cần rà soát. Hồ sơ hiện chưa đủ để kết luận mọi nội dung đã sẵn sàng phát hành thương mại; cần hoàn tất hồ sơ nguồn/quyền dùng và duyệt chất lượng từ vựng.

Không đánh dấu bản này là hoàn chỉnh để phát hành cho đến khi các mục trên được xác nhận.

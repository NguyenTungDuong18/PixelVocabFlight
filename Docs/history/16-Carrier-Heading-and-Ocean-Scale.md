# WORDWING 0.10 — Mũi tàu đúng hướng và giảm zoom biển

## Tàu sân bay

- Khi vào và đứng thả quân, mũi tàu hướng về phía người chơi.
- Sau 20 giây thả quân, tàu chọn mép gần hơn rồi **xoay tại chỗ khoảng 2,5 giây**, giữ nguyên tâm thân tàu.
- Chỉ sau khi mũi đã đạt đúng hướng ra mép, tàu mới tăng tốc nhẹ và chạy chéo theo hướng đó. Hướng vận tốc và hướng mũi dùng cùng một giá trị trong mô phỏng, thay cho cách nghiêng hình 12 độ trong khi đường đi độc lập như bản trước.
- Khi qua giữa bản đồ, tàu tiếp tục cùng đường đi và vận tốc, không bẻ ngang đột ngột. Vệt nước xuất hiện phía đuôi theo hướng tàu. Tàu ngừng thả quân suốt lúc xoay và rời đi.

## Nền biển

Ba ảnh biển gốc được hiển thị ở **65% kích thước so với bản 0.9**, tương đương giảm phóng đại khoảng **35%**. Tỉ lệ ảnh giữ nguyên. Mép lớp ảnh được làm mềm để hòa vào phần nước xung quanh.

Đã tạo thêm một nền biển panorama rộng bằng **imagegen tích hợp**, dựa trên phong cách/màu/sóng của cả ba ảnh. Lớp này phủ kín vùng bay phía sau ảnh gốc và cuộn độc lập; không kéo giãn ảnh dọc để lấp chỗ trống. Sóng, cá và chi tiết nền có quy mô nhỏ hơn. Hiệu ứng ánh nước, gợn nước, chuyển cảnh và vệt tàu tiếp tục hoạt động.

- Ảnh mới: `Game/Assets/_Project/Art/Resources/Ocean/OceanWide.png`.
- Bản chuẩn bị: `SourceAssets/PixelArt/Prepared/OceanWide.png`.
- Prompt đầy đủ: `SourceAssets/PixelArt/Prepared/Prompt-Ocean-Wide.md`.
- Ba ảnh gốc giữ nguyên trong `SourceAssets/PixelArt/Ocean/` và tài nguyên Unity.

## Kiểm tra

`dotnet run --project Tools/RulesChecks/RulesChecks.csproj` đạt **30.520 kiểm tra**. Có kiểm tra tàu xoay dần nhưng không đổi tâm, quay đúng hướng rồi mới chạy, hướng vận tốc trùng hướng mũi, chuyển giai đoạn mượt, cả hướng trái/phải và các cơ chế cũ.

Bản Windows đạt **45/45 kiểm tra tích hợp** bằng thiết bị giả lập Unity Input System. Đã xem ảnh tàu đang xoay, tàu chạy theo mũi và nền biển đã giảm zoom; có xác nhận tâm hình trùng tâm vật lý và góc hình trùng góc vận tốc. Báo cáo ở `Tools/Smoke-Heading/`. Không phải kiểm thử thủ công bằng thiết bị vật lý.

# WORDWING 0.6 — Nhịp sinh 12 giây, tên lửa gọn và phát âm

## Thay đổi

- Nhịp sinh máy bay cơ bản và nhịp máy bay từ tàu sân bay là **12 giây**. Rừng giữ +30% tốc độ sinh, tương đương **12 / 1,3 ≈ 9,23 giây**. Tàu vẫn thử bắn tên lửa mỗi 5 giây với xác suất 50%.
- Chỉ xếp hàng đọc từ khi **người chơi trực tiếp nhập đúng và bắn hạ máy bay**. Máy bay bị hạ do vòng nổ tên lửa vẫn được tính điểm, nhưng không đưa từ vào hàng đợi phát âm. Phá khiên băng lần đầu chưa hạ máy bay nên chưa đọc.
- Tên lửa mặc định hiển thị hình và **nghĩa Việt**, không tự mở bốn đáp án.
- **Rê chuột vào tên lửa** để mở bảng bốn từ. Bảng đứng yên ở vị trí mở trong khi tên lửa vẫn di chuyển, giúp bấm đáp án. Rê từ tên lửa sang bảng sẽ giữ bảng mở; rời cả hai thì bảng đóng sau khoảng 0,16 giây. Mỗi lúc chỉ mở một bảng.
- Trong chế độ lái vẫn có thể rê vào để xem, nhưng cần **Tab sang BẮN** để chọn đáp án. Con trỏ hiện khi ở trên tên lửa/bảng.
- Chọn sai: tên lửa **giật ngang nhẹ**, nháy sắc đỏ và viền đỏ quanh nó trong khoảng **0,36 giây**, kèm tiếng báo ngắn, nhỏ. Tên lửa tiếp tục bay, không nổ vì đáp án sai và không trừ máu ngay.
- Trả lời đúng vẫn làm tên lửa nổ lan. Luật ba lỗi khiến tên lửa tăng tốc, va trúng mất hai kim loại, và năm kim loại làm máu tiếp tục áp dụng như bản 0.5.

## Hai hình người dùng chọn

Đã đưa đúng hai ảnh được chỉ định vào game:

| Vai trò | File nguồn | File trong Unity |
|---|---|---|
| Máy bay địch | `stealth-bomber-pixel-art-style-260nw-2646708681.jpg` | `Game/Assets/_Project/Art/Resources/Art/UserEnemy.png` |
| Tên lửa | `missile-pixel-art-style-260nw-2514365451.jpg` | `Game/Assets/_Project/Art/Resources/Art/UserMissile.png` |

Bản gốc nằm trong `SourceAssets/PixelArt/UserSelected/`, khớp SHA-256 với file người dùng cung cấp. Tuy có đuôi `.jpg`, nội dung thực tế của cả hai là **WebP**. Đã chuyển sang PNG để Unity đọc được, giữ metadata và đối chiếu toàn bộ điểm ảnh sau giải mã khớp tuyệt đối, bao gồm nền trắng và dòng nguồn Shutterstock. Công cụ và báo cáo tại `Tools/ArtImport/convert.cjs` và `conversion-report.json`. Ảnh được nạp nguyên kích thước, lọc Point để phù hợp đồ họa pixel. Máy bay băng vẫn có vòng khiên, máy bay sa mạc vẫn yêu cầu từ loại, và máy bay chuẩn bị lao vẫn có cảnh báo đỏ.

## Kiểm tra

- `dotnet run --project Tools/RulesChecks/RulesChecks.csproj`: **30.483 kiểm tra đạt**. Có xác nhận riêng việc hạ trực tiếp có yêu cầu đọc, nhiều máy bay bị nổ lan đều không yêu cầu đọc, và từng lỗi tên lửa phát sự kiện phản hồi đúng chiếc, không phát sự kiện nổ.
- Bản Windows đạt **31/31 kiểm tra tích hợp** bằng đầu vào chuột/bàn phím giả lập của Unity Input System, bao gồm rê vào, đưa chuột qua nút đáp án, bấm sai thật qua uGUI, kiểm tra âm báo/viền đỏ, rê ra đóng bảng và vòng nổ hạ nhiều máy bay không thêm phát âm. Đã xem ảnh hiển thị hai model, tên lửa gọn, popup khi hover và viền đỏ khi sai. Hồ sơ QA tách khỏi hồ sơ chơi thật.
- Báo cáo và ảnh giao diện thực được lưu trong `Tools/Smoke-Hover-Final/`. Không phải kiểm thử bằng chuột/bàn phím vật lý.

Chạy bản mới bằng `Builds/Windows/Wordwing.exe`, hoặc mở project Unity như cũ.

# WORDWING 0.8 — Sprite trong suốt, hành trình tàu và giảm tốc tên lửa

## Hình ảnh

Theo lựa chọn của người dùng, máy bay địch và tên lửa dùng **sprite pixel mới tự tạo bằng imagegen tích hợp**, tông xanh, nền alpha trong suốt. Đây là thiết kế mới, thay cho ảnh stock nền trắng trước đây. Bản gốc cũ và ghi nguồn được giữ nguyên trong thư mục nguồn.

- Máy bay địch: `Game/Assets/_Project/Art/Resources/Art/UserEnemy.png`.
- Tên lửa: `Game/Assets/_Project/Art/Resources/Art/UserMissile.png`.
- Bản chuẩn bị và prompt đầy đủ: `SourceAssets/PixelArt/Prepared/Prompts-Enemy-Missile-Original.md`.
- Kiểm tra alpha và bản sao: `Tools/ArtImport/player-carrier-report.json`, hiện kiểm tra cả bốn model.

Công cụ chuyển ảnh stock cũ `Tools/ArtImport/convert.cjs` chỉ ghi ra `SourceAssets/PixelArt/ConvertedReference/`, tránh ghi đè sprite đang dùng trong game.

## Hành trình tàu sân bay

Các mốc 80% và 50% được tính **từ phía người chơi ở dưới màn hình hướng lên trên**. Tương ứng, tâm tàu dừng ở 20% chiều cao tính từ mép trên, sau đó tiến tới giữa màn hình.

1. **Vào vị trí:** tàu đi vào từ phía trên, chưa thả máy bay hay thử bắn tên lửa khi đang vào.
2. **Thả quân:** tới mốc 80%, tàu đứng yên trong **đúng 20 giây**. Một máy bay cất cánh khi tàu vừa tới; chiếc tiếp theo sau 12 giây. Tàu thử bắn tên lửa ở giây 5, 10, 15 và 20, mỗi lần xác suất 50%.
3. **Tiến tới giữa bản đồ:** hết 20 giây, ngừng thả quân và bắn tên lửa; tàu từ từ tiến tới mốc 50%, mất khoảng 10 giây.
4. **Rời bản đồ:** từ giữa bản đồ, tàu đi ngang tới mép trái hoặc phải gần hơn. Tàu nằm nửa trái đi trái; nửa phải đi phải; đúng chính giữa chọn trái. Tàu chỉ bị loại sau khi ra ngoài màn hình hoàn toàn.

Máy bay/tên lửa đã thả tiếp tục hoạt động sau khi tàu rời vị trí. Hình tàu vẫn dùng mẫu số 78, hiển thị ở lớp dưới máy bay. Vị trí mô phỏng là tâm tàu, tương ứng tâm hình trên màn hình.

## Tốc độ tên lửa

Tốc độ cơ bản còn **80% bản trước**: từ 0,035 xuống 0,028 đơn vị chiều ngang vùng bay/giây. Mức tăng tốc theo thời gian và cơ chế tăng tốc sau ba lần sai vẫn hoạt động; cả hai trường hợp đều chịu mức giảm 20% này. Giữ sát thương hai kim loại khi va trúng, popup khi rê chuột, phản hồi sai và nổ lan khi chọn đúng.

## Kiểm tra

`dotnet run --project Tools/RulesChecks/RulesChecks.csproj` đạt **30.508 kiểm tra**. Có kiểm tra vận tốc thực giảm 20%, tàu không thả quân khi đang vào, đứng yên đủ 20 giây, số lần cất cánh/thử bắn, ngừng bắn khi tiến ra, chọn đúng cả hai mép trái/phải, ra ngoài mới loại, và các cơ chế cũ.

Bản Windows đạt **37/37 kiểm tra tích hợp** bằng thiết bị chuột/bàn phím giả lập của Unity Input System; đã xem ảnh sprite trong suốt và tàu ở hai vị trí dừng/rời đi. Báo cáo và ảnh giao diện nằm tại `Tools/Smoke-Carrier-Route/`. Các bài kiểm tra thời gian/hành trình dùng mô phỏng nhanh, không phải chờ 20 giây thực hoặc thử thủ công bằng thiết bị vật lý.

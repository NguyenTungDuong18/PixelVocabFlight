# Pixel Vocab Flight

**Bản 0.14 — Buồng lái & khóa mục tiêu:** thanh chỉ số dưới cùng thành bảng điều khiển phi công (đồng hồ xăng/tốc độ/giờ bay, đèn GIÁP, màn CRT hiện nghĩa tiếng Việt, cần gạt LÁI/BẮN). Khe gõ chỉ hiện NHẬP ĐỂ BẮN khi đang lái; nhấn Tab là vào thẳng khe gõ với dấu nháy sát chữ. Máy bay địch vừa lao chậm tới vừa thò súng ra từ từ, khóa mục tiêu rồi bắn loạt đạn đuổi không né được và nghiêng cánh bay khỏi màn hình; tên lửa khóa mục tiêu rồi tăng tốc lao tới. Bốn ô đáp án tên lửa tách rời, bật lớn dần từ thân tên lửa, chọn bằng chuột hoặc phím 1–4. Nền rừng/sa mạc/băng được vẽ chi tiết với động vật, đoàn xe, tàu hỏa và làm mờ khi chiến đấu (biển giữ nét). Bấm CẤT CÁNH: bảng trượt sang hai bên, máy bay nổ máy, lăn bánh một quãng dài với camera đi theo từ căn cứ ra đường băng xuyên rừng, rồi cất cánh, màn hình tối dần; vào trận máy bay bay lên từ mép dưới và HUD hiện dần. Đã build Windows và qua 72/72 smoke test. Xem [báo cáo 0.14](Docs/19-Cockpit-Lock-On-Blur.md).

**Bản 0.13 — Pixel 1944:** toàn bộ máy bay, tàu, rocket, tiếp tế, hiệu ứng và giao diện được vẽ lại thành pixel art lấy cảm hứng Thế chiến II, lưu từng khung hình trong `Game/Assets/_Project/Art/Resources/Pixel`. Màn hình chờ mới là sân bay dã chiến nhìn từ trên xuống, chọn chiến trường bằng phím 1–4 và cất cánh bằng Enter. Đã thống nhất thuật ngữ GIÁP, đổi tia laser thành đạn vạch, thêm rung màn hình khi trúng đòn. Đã build Windows và qua 54/54 smoke test. Xem [báo cáo 0.13](Docs/18-Pixel-Art-1944.md); vẽ lại đồ họa bằng `node Tools/PixelForge/forge.cjs`. Các mục phiên bản cũ bên dưới giữ lại để tra lịch sử.

Game bắn máy bay pixel art học từ vựng tiếng Anh, viết bằng C# và Unity.

**Trạng thái:** bản 0.10 sửa tàu xoay mũi tại chỗ trước khi rời đi, thân tàu đi đúng hướng mũi. Nền biển gốc được giảm kích thước khoảng 35%, có thêm lớp biển rộng đồng phong cách để phủ kín hai bên. Xem [thay đổi và kiểm tra 0.10](Docs/16-Carrier-Heading-and-Ocean-Scale.md). Giữ thời gian thả quân 20 giây, nhịp sinh 12 giây, tên lửa giảm tốc 20%, hiệu ứng nước, sprite trong suốt và đủ 5.981 mục học Oxford.

Tên hiển thị trong game: **WORDWING**. Thư mục dự án vẫn là `PixelVocabFlight`.

## Bắt đầu

1. Mở Unity Hub, chọn **Add / Add project from disk**.
2. Chọn thư mục `Game` bên trong thư mục này, không chọn thư mục gốc `PixelVocabFlight`.
3. Dùng Unity Editor **6000.6.7f1**, là phiên bản đã có trên máy khi khởi tạo.
4. Đợi Unity hoàn tất nhập asset và package ở lần mở đầu.
5. Mở scene `Assets/_Project/Scenes/Flight.unity`, rồi nhấn Play.

Bản chạy độc lập nằm ở `Builds/Windows/Wordwing.exe`. Đọc [thay đổi tên lửa và phát âm bản 0.6](Docs/12-Missile-Hover-and-Audio.md), [máu và va chạm bản 0.5](Docs/11-Metal-Health.md) và [môi trường, chọn từ bản 0.4](Docs/10-Continuous-Flight.md). Trong chuyến bay, rê chuột ngang để lái; nhấn **Tab** hoặc công tắc để chuyển sang bắn, rồi gõ từ + **Enter**. Sa mạc cần chọn thêm từ loại. Tên lửa gần nhất tự mở bốn ô đáp án (chuột hoặc phím 1–4). Địch khóa mục tiêu thì phải gõ đúng để hạ trước khi nó bắn — đòn đánh không thể né. Xem [hướng dẫn thư viện và chọn bộ học](Docs/07-Oxford-Library.md). Tài liệu phiên bản cũ lưu lại lịch sử; ưu tiên luật của phiên bản mới hơn.

Xem [đối chiếu trọn bộ và thay đổi bản 0.3](Docs/09-Full-Oxford-5000.md). Mở lại game sau khi cập nhật; nút **TOÀN BỘ OXFORD 5000** chọn toàn kho bằng một lần bấm.

Phạm vi hiện tại là danh mục Oxford 3000/5000, không phải toàn bộ từ điển Oxford. Mức CEFR lấy theo mục từ/từ loại từ trang Oxford; nghĩa Việt từ nguồn mở và phần biên soạn của dự án, còn cần rà soát chất lượng. Chủ đề do game phân loại.

## Các thư mục chính

| Thư mục | Nội dung |
|---|---|
| `Game/` | Project mở bằng Unity: mã C#, scene, prefab, asset và cấu hình |
| `Docs/` | Kế hoạch game, giải thích cấu trúc và hướng dẫn sử dụng |
| `SourceAssets/` | File thiết kế gốc, audio gốc và bảng biên soạn từ vựng |
| `Builds/Windows/` | Nơi xuất bản game Windows khi đã có bản chơi được |
| `Tools/` | Công cụ hỗ trợ và nhật ký khởi tạo |

Đọc [kế hoạch](Docs/01-Game-Plan.md), [cấu trúc thư mục](Docs/02-Folder-Structure.md) và [hướng dẫn mở dự án](Docs/03-Getting-Started.md).

Chỉ giữ một bản asset dùng trong game dưới `Game/Assets/_Project`. File vẽ hoặc bản ghi gốc nằm trong `SourceAssets`, để Unity không phải nhập những file không dùng khi chạy game.

Không xóa hoặc đổi tên file `.meta` riêng lẻ. Sau khi Unity đã nhập asset, di chuyển asset trong cửa sổ Project của Unity để giữ liên kết scene và prefab.

Ngày tạo: 02/11/2026.

# Pixel Vocab Flight

Game bắn máy bay pixel art học từ vựng tiếng Anh, viết bằng C# và Unity.

**Trạng thái:** bản 0.4 chuyển sang chuyến bay liên tục: sinh một máy bay mỗi 5 giây, bốn môi trường luân phiên mỗi 3 phút, chế độ lái/bắn, tên lửa, vật phẩm ngẫu nhiên và lượt đổi nghĩa. Có hangar xem máy bay trước khi cất cánh. Kho Oxford 5000 vẫn có 5.981 mục học, nghĩa Việt, phát âm offline và bộ lọc CEFR/chủ đề/khoảng thứ tự.

Tên hiển thị trong game: **WORDWING**. Thư mục dự án vẫn là `PixelVocabFlight`.

## Bắt đầu

1. Mở Unity Hub, chọn **Add / Add project from disk**.
2. Chọn thư mục `Game` bên trong thư mục này, không chọn thư mục gốc `PixelVocabFlight`.
3. Dùng Unity Editor **6000.6.7f1**, là phiên bản đã có trên máy khi khởi tạo.
4. Đợi Unity hoàn tất nhập asset và package ở lần mở đầu.
5. Mở scene `Assets/_Project/Scenes/Flight.unity`, rồi nhấn Play.

Bản chạy độc lập nằm ở `Builds/Windows/Wordwing.exe`. Đọc [luật chơi và kiểm tra bản 0.4](Docs/10-Continuous-Flight.md). Trong chuyến bay, rê chuột ngang để lái; nhấn **Tab** hoặc công tắc để chuyển sang bắn, rồi gõ từ + **Enter**. Sa mạc cần chọn thêm từ loại. Xem [hướng dẫn thư viện và chọn bộ học](Docs/07-Oxford-Library.md). Tài liệu 0.1–0.3 lưu lại lịch sử; cơ chế theo đợt trong bản đầu đã được thay thế.

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

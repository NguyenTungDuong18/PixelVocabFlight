# WORDWING 0.9 — Nền biển từ ảnh và tàu rời đi mượt

## Ba ảnh nền biển

Đưa nguyên ba ảnh người dùng cung cấp vào tài nguyên của game:

| Nguồn | Tài nguyên Unity |
|---|---|
| `ChatGPT Image Nov 2, 2026, 02_59_54 PM-1.png` | `Game/Assets/_Project/Art/Resources/Ocean/Ocean01.png` |
| `699aa16c-2d8b-45bf-be60-7da814164d27.png` | `Game/Assets/_Project/Art/Resources/Ocean/Ocean02.png` |
| `d5c9719d-f583-4b7b-b119-6b4ee37271d8.png` | `Game/Assets/_Project/Art/Resources/Ocean/Ocean03.png` |

Bản gốc lưu ở `SourceAssets/PixelArt/Ocean/`; các bản trong Unity khớp SHA-256 với bản gốc. Game nạp tài nguyên đã đóng gói, không phụ thuộc file ngoài Downloads. Báo cáo tại `Tools/ArtImport/ocean-report.json`.

Ảnh được trình bày bằng UV giữ nguyên tỉ lệ, cuộn từ dưới lên trong phần ảnh đang xem để tạo cảm giác nền trôi xuống. Mỗi cảnh kéo dài khoảng 30 giây thời gian hoạt ảnh; năm giây cuối chuyển dần sang ảnh kế tiếp. Chuỗi ba cảnh lặp lại, không có đường ghép ảnh cứng. Bộ lọc Point giữ phong cách pixel. Nền được giảm độ sáng để chữ và máy bay vẫn rõ.

Thêm ánh lấp lánh nhỏ biến đổi nhẹ, gợn nước mở rộng rồi tan và vệt nước khi tàu di chuyển. Các lớp nền/hiệu ứng nằm dưới tàu, máy bay, tên lửa và bảng chữ. Nền biển vẫn chuyển dần với môi trường khác trong sáu giây; chu kỳ mỗi môi trường ba phút được giữ.

## Tàu rời đi theo đường chéo

Sau 20 giây thả quân, tàu tăng tốc nhẹ từ trạng thái đứng yên, vừa tiến dọc vừa lệch về bên gần hơn. Đường đi được ghép từ hai đường cong Bézier có cùng vị trí và vận tốc ở mốc giữa bản đồ. Vì vậy không có đoạn đứng lại hoặc đổi hướng vuông góc tại điểm chuyển giai đoạn.

Tàu tiếp tục hơi chéo tới mép đã chọn, nghiêng hình nhẹ và mượt theo hướng rời đi. Tàu không thả thêm máy bay/tên lửa trong lúc rời vị trí. Hai chặng rời đi dài tối đa khoảng 18 giây; tàu bị loại khi ra ngoài màn hình hoàn toàn. Các mốc 80% và 50% vẫn tính từ phía người chơi hướng lên trên.

## Kiểm tra

- Kiểm tra dữ liệu/luật chơi: **30.512 kiểm tra đạt**, thêm kiểm tra di chuyển chéo trước mốc giữa bản đồ và vận tốc liên tục khi chuyển chặng ở cả hai hướng trái/phải.
- Kiểm tra bản sao cả ba ảnh và kích thước phù hợp Unity bằng `node Tools/ArtImport/verify-ocean.cjs`.
- Bản Windows đạt **41/41 kiểm tra tích hợp** bằng đầu vào giả lập Unity Input System, có ảnh chụp ba cảnh biển, popup tên lửa và tàu rời vị trí. Nền biển sinh bằng mã trước đây đã được ẩn để không hằn đảo/vòng tròn lên ảnh mới. Báo cáo và ảnh ở `Tools/Smoke-Ocean/`; không phải kiểm thử bằng chuột/bàn phím vật lý.

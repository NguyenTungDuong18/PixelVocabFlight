# WORDWING 0.7 — Máy bay người chơi và tàu sân bay 78

- Máy bay người chơi: chọn chiếc **xanh lá, nhìn từ trên xuống ở góc dưới trái** trong `maybayta.jpg`. Cùng một sprite được dùng trong hangar và khi bay.
- Tàu sân bay: dùng mẫu **78** trong `Pixel-Art Aircraft Carrier 78.png`, thay phần hình vẽ hình khối cũ. Tàu nằm dưới lớp máy bay và giữ nguyên hành vi cất cánh/bắn tên lửa.
- Hai ảnh được chuẩn bị bằng công cụ **imagegen tích hợp** để có nền trong suốt. Đây là các bản tách nền do AI chuẩn bị, không phải bản trích xuất đảm bảo khớp từng điểm ảnh. Đã xem hình kết quả và giữ các đặc điểm chính của mẫu người dùng chọn.
- Không thay luật chơi, thời gian sinh, máu, vật phẩm hay từ vựng trong bản này.

## File trong dự án

| Nội dung | Đường dẫn |
|---|---|
| Bản sao ảnh gốc | `SourceAssets/PixelArt/UserSelected/maybayta.jpg` |
| Bản sao ảnh gốc tàu | `SourceAssets/PixelArt/UserSelected/Pixel-Art Aircraft Carrier 78.png` |
| Sprite người chơi | `Game/Assets/_Project/Art/Resources/Art/UserPlayer.png` |
| Sprite tàu | `Game/Assets/_Project/Art/Resources/Art/UserCarrier.png` |
| Bản chuẩn bị và prompt đầy đủ | `SourceAssets/PixelArt/Prepared/Prompts-Player-Carrier.md` |
| Kiểm tra alpha và bản sao | `Tools/ArtImport/player-carrier-report.json` |

Ảnh được nạp từ tài nguyên đóng gói, không đọc từ Downloads khi chạy. Có thể xóa hai file nằm ngoài thư mục dự án sau khi giữ bản game/dự án này.

Build Windows 0.7 đạt **32/32 kiểm tra tích hợp**, dùng đầu vào giả lập Unity Input System. Đã xem ảnh hangar với máy bay xanh và màn biển với tàu 78: nền ảnh trong suốt, ảnh được nạp trong bản đóng gói. Báo cáo và ảnh nằm tại `Tools/Smoke-Player-Carrier/`. Không phải kiểm thử thủ công bằng thiết bị vật lý.

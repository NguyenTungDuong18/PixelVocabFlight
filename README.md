# Pixel Vocab Flight

Game bắn máy bay pixel art học từ vựng tiếng Anh, viết bằng C# và Unity.

**Trạng thái:** đang chuẩn bị cấu trúc dự án. Hiện có project Unity 2D nền và các thư mục để phát triển; chưa có cơ chế chơi tùy chỉnh hoặc bản game hoàn chỉnh.

## Bắt đầu

1. Mở Unity Hub, chọn **Add / Add project from disk**.
2. Chọn thư mục `Game` bên trong thư mục này, không chọn thư mục gốc `PixelVocabFlight`.
3. Dùng Unity Editor **6000.6.7f1**, là phiên bản đã có trên máy khi khởi tạo.
4. Đợi Unity hoàn tất nhập asset và package ở lần mở đầu.

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

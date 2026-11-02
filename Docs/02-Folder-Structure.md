# Cấu trúc thư mục

```text
PixelVocabFlight/
|-- README.md
|-- .gitignore
|-- Game/                         Project mở bằng Unity
|   |-- Assets/
|   |   |-- _Project/             Nội dung riêng của game
|   |   |   |-- Scripts/
|   |   |   |   |-- Art/          Sprite pixel tạo bằng C#
|   |   |   |   |-- Core/
|   |   |   |   |-- Aircraft/
|   |   |   |   |-- Combat/
|   |   |   |   |-- Typing/
|   |   |   |   |-- Vocabulary/
|   |   |   |   |-- Items/
|   |   |   |   |-- Scoring/
|   |   |   |   |-- Audio/
|   |   |   |   |-- UI/
|   |   |   |   `-- Persistence/
|   |   |   |-- Scenes/
|   |   |   |   `-- Flight.unity  Scene của prototype
|   |   |   |-- Editor/          Công cụ tạo scene và build
|   |   |   |-- Prefabs/
|   |   |   |   |-- Aircraft/
|   |   |   |   |-- Items/
|   |   |   |   |-- UI/
|   |   |   |   `-- Effects/
|   |   |   |-- Art/
|   |   |   |   |-- Sprites/
|   |   |   |   |   |-- Aircraft/
|   |   |   |   |   |-- Items/
|   |   |   |   |   `-- Environment/
|   |   |   |   |-- Animations/
|   |   |   |   |-- Materials/
|   |   |   |   `-- Fonts/
|   |   |   |-- Audio/
|   |   |   |   |-- Music/
|   |   |   |   |-- SFX/
|   |   |   |   `-- Pronunciation/
|   |   |   |       |-- UK/
|   |   |   |       `-- US/
|   |   |   |-- Data/
|   |   |   |   |-- Vocabulary/
|   |   |   |   |   `-- Resources/prototype-vocabulary.json
|   |   |   |   `-- Settings/
|   |   |   `-- UI/
|   |   |       `-- Textures/
|   |   `-- ...                   File có sẵn từ template Unity
|   |-- Packages/                 Danh sách package và phiên bản
|   |-- ProjectSettings/          Cấu hình Unity
|   `-- ...                       Cache Unity tự sinh khi mở
|-- Docs/
|   |-- 01-Game-Plan.md
|   |-- 02-Folder-Structure.md
|   |-- 03-Getting-Started.md
|   |-- 04-Asset-Sources.md
|   |-- 05-Prototype-0.1.md
|   |-- 06-Validation.md
|   |-- 07-Oxford-Library.md
|   |-- 08-Oxford-Validation.md
|   `-- 09-Full-Oxford-5000.md
|-- SourceAssets/                 File gốc để biên tập
|   |-- PixelArt/
|   |-- Audio/
|   `-- Vocabulary/
|       `-- vocabulary-template.csv
|-- Builds/
|   `-- Windows/                  Bản .exe và các file đi kèm sau này
`-- Tools/                        Script hỗ trợ và log cục bộ
    |-- Build-Windows.ps1
    |-- Generate-Pronunciation.ps1
    |-- RulesChecks/
    |-- Smoke/                    Ảnh và báo cáo kiểm tra
    `-- BuildWorkspace/           Bản sao/cache để build khi Editor đang mở
```

## Đặt file ở đâu?

| Loại file | Nơi đặt |
|---|---|
| Mã C# xử lý máy bay | `Game/Assets/_Project/Scripts/Aircraft` |
| Mã gõ và kiểm tra đáp án | `Game/Assets/_Project/Scripts/Typing` |
| Màn menu, trận chơi | `Game/Assets/_Project/Scenes` |
| Máy bay/vật phẩm mẫu tái sử dụng | `Game/Assets/_Project/Prefabs` |
| PNG đã xuất dùng trong game | `Game/Assets/_Project/Art/Sprites` |
| File vẽ gốc, ví dụ .aseprite | `SourceAssets/PixelArt` |
| WAV/OGG dùng trong game | `Game/Assets/_Project/Audio` |
| Bản ghi gốc để chỉnh sửa | `SourceAssets/Audio` |
| Bảng biên soạn từ vựng | `SourceAssets/Vocabulary` |
| Dữ liệu từ vựng đã kiểm tra dùng khi chạy | `Game/Assets/_Project/Data/Vocabulary` |
| Ghi chú luật chơi và thiết kế | `Docs` |
| Bản game phát cho người chơi | `Builds/Windows` |

Không cần tự tạo file C# trống cho mọi thư mục. Chỉ thêm lớp khi bắt đầu tính năng. Không đưa nội dung game vào Library, Temp, Logs hoặc UserSettings; đây là các thư mục Unity tự quản lý.

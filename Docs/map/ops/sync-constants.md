# Hằng số phải đồng bộ giữa JS (ảnh) và C# (code)

Đọc trước khi sửa art hoặc hằng số liên quan.

| Nội dung | JS (`Tools/PixelForge` hoặc `Tools/Vocabulary`) | C# |
| --- | --- | --- |
| Bố cục cockpit (đồng hồ, đèn, CRT, khe gõ, POS, nút bắn, cần gạt) | `COCKPIT` trong `ui/cockpit.cjs` (pixel ảnh 720×124) | `Unity/Flight/FlightView/FlightView.cs` (×2, gốc `CockpitTop = 652`) |
| Đường sông/đường xe/đường ray trên ô nền | `terrain/common.cjs` (`jungleRiverX`, `iceRiverX`), tọa độ đường trong `terrain/{jungle,desert,ice}.cjs` | `Unity/Rendering/Wildlife.cs` (`JungleRoadX 603, DesertPisteX 563, IceRailX 594`, công thức sông) |
| Kích thước ô nền | `TW 680`, `TH 560` | `ScrollingTerrain.TileWidth 1360 / TileHeight 1120`, `Wildlife.TileRows 560` |
| Đường băng cất cánh | `runway.cjs` (x 140–185, ô cao 480 px ảnh) | `FlightView.TileHeight 960`, vị trí ô trong `hangarWorld` |
| Số khung súng | `units/aircraft.cjs` `GUN_DEPLOY_FRAMES` (9 + 2) | `FlightBoardView.GunDeployFrames = 9` |
| Số khung kim đồng hồ | `gauge_needle` 48 khung | `FlightView` (7,5° mỗi khung) |
| Chân đế model (ô, hướng S) | `world/*.cjs` `def(id, group, foot, …)` → manifest `footW/footH` | `Logic/World/WorldModels.cs` `FootW/FootH` (RulesChecks đối chiếu) |
| Kích thước ô thế giới | 16 px ảnh (`voxel.cjs`, `ground.cjs`) | `BaseView` ×3 = 48 px tham chiếu |
| Khung nhân vật | 24×32, anchor (12,30), idle/walk/run 8 khung, contact khung 0 và 4 | `BaseView` (đọc khung, fps từ manifest), RulesChecks |
| Thư mục phát âm | `Generate-Pronunciation.ps1` (chữ cái đầu của `word`) | `Logic/Vocabulary/PronunciationPath.cs` (RulesChecks kiểm tra đủ file) |
| Thư mục sprite Ground (readable) | `folderFor` giữ nhóm `Ground/` | `Editor/SelectedArtImporter.cs` (`/Ground/`) |
| Phiên bản | `forge.cjs VERSION` (0.15.0) | `PrototypeBuild` bundleVersion, `smoke-report.json` version, `WorldChecks` |

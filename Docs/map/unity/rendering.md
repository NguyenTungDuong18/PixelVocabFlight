# Rendering: nạp sprite, nền cuộn, wildlife, biển

Code: `Scripts/Unity/Rendering/`. Hằng số phải khớp JS: `ops/sync-constants.md`.

| File | Nội dung |
| --- | --- |
| `PixelSprites.cs` | Nạp `Resources/Pixel/pixel-manifest.json` (tên, **đường dẫn đầy đủ** trong thư mục Pixel, số khung, kích thước, fps, loop, border, anchor, foot). Khung nạp bằng `Resources.Load("Pixel/" + path + "_" + i)`, nên thư mục con nào cũng được. API: `Frames(name)`, `Get(name, i)`, `At(name, time)`, `FrameAt`, `Duration`, `Size`, `Anchor`, `Foot`, `Texture`, `Has`, `Names`. `Sprite.Create`, lọc point (bilinear với `_blur`), có cache; `ResetStatics` khi vào Play (Domain Reload tắt) |
| `ScrollingTerrain.cs` | 4 ô nền dọc (`TileWidth 1360`, `TileHeight 1120` = ảnh 680×560 ×2) cuộn liên tục. Mỗi ô có bản **mờ** `terrain_<env>_blur` dưới và bản **nét** `terrain_<env>` trên; `Focus` điều alpha bản nét. Đổi vùng crossfade 6 giây. Ocean giao cho `OceanBackdrop`. Chứa và cuộn `Wildlife` |
| `Wildlife.cs` | Động vật/phương tiện trôi theo nền. `enum Path { Free, River, Circle }`. Hằng **phải khớp `terrain/common.cjs`** (sông) và ô từng vùng `terrain/<vùng>.cjs` (đường): `Art 2, TileRows 560, JungleRoadX 603, DesertPisteX 563, IceRailX 594`; đường sông tính bằng cùng công thức `jungleRiverX`/`iceRiverX`. Rừng: `actor_elephant, egret, sampan, truck_jungle, buffalo`; Sa mạc: `camel, vulture, tank_desert, truck_desert`; Băng: `reindeer, wolf, crow, locomotive + wagon + steam`. Mỗi actor có bản `_blur` |
| `OceanBackdrop.cs` (136 dòng) | 3 ảnh biển (`PixelTerrain.Get(Ocean, 0..2)`) crossfade mỗi 30 giây, cộng lớp rộng `OceanWide` (variant 3, lặp ngang) phủ hai bên, RectMask mềm. 30 đốm lấp lánh, gợn sóng `Wake(x, y)`. `AnimationSeconds`, `CurrentImage`. Biển **không mờ**. Static `wideTexture/ring` tự kiểm tra `if (obj)` |
| `PixelTerrain.cs` (64 dòng) | Sinh texture ô 384×160 bằng code (bản cũ), cache 7 ô. Hiện chủ yếu cho Ocean variant và smoke |

**Thêm chiến trường hoặc actor:** ô mới viết `terrain/<vùng>.cjs` rồi thêm vào `build` của `terrain.cjs` (tự sinh `_blur`); actor thêm vào `ACTORS` trong `terrain/actors.cjs` → forge → thêm vào bảng actor trong `Wildlife.cs`, đồng bộ tọa độ đường/sông. Vùng mới phải sửa enum `FlightEnvironment` và mọi chỗ `% 4`.

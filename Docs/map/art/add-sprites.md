# Công thức: thêm sprite, model, nhân vật

## Sprite thường (máy bay, hiệu ứng, UI…)

1. Viết hàm vẽ trong module phù hợp (`units/<loại>.cjs`, `ui/<phần>.cjs`, `terrain/<vùng>.cjs`…) và export nó, gom qua file gốc (`units.cjs`, `ui.cjs`…), rồi `add('Group', 'name', frames, {fps, loop})`. Đặt tên theo tiền tố của nhóm để vào đúng thư mục (`sprite-folders.md`).
2. `node Tools/PixelForge/forge.cjs`, soát contact sheet trong `SourceAssets/PixelArt/Pixel1944/`.
3. C#: `PixelSprites.At("name", time)` hoặc `Get("name", i)`. Unity tự import theo `SelectedArtImporter`.

## Model mới cho bản đồ căn cứ

1. Thêm `def(...)` trong `world/<loại>.cjs` (buildings/installations/props/vehicles/aircraft; loại mới thì tạo file và thêm `require` vào `world.cjs`) với id có tiền tố `bld_`/`prop_`/`veh_`/`air_`, chạy forge. Model tự vào `World/<loại>/<id>/`.
2. Thêm `ModelDef` cùng id và cùng chân đế trong `Scripts/Logic/World/WorldModels.cs`.
3. Đặt vào map bằng `Add(...)` trong `AirbaseMap.cs` (hoặc map mới).
4. RulesChecks (nhóm manifest) báo nếu thiếu hướng hoặc lệch chân đế.

## NPC mới

1. Thêm tham số vào `CHARACTERS` (`characters/roster.cjs`), chạy forge → `Characters/<who>/`.
2. Thêm vào `BaseContent.Roster` + một `DialogueGraph`, rồi `AddNpc` trên map.
3. Thêm check đi tới NPC trong `Tools/RulesChecks/World/WorldChecks.Movement.cs` nếu cần.

## Sửa cockpit

1. Sửa `COCKPIT` và vẽ trong `ui/cockpit.cjs`.
2. Sửa tọa độ tương ứng ×2 trong `Scripts/Unity/Flight/FlightView/FlightView.cs` (`ops/sync-constants.md`).
3. Forge, build, xem ảnh smoke `02b-cockpit-typing`.

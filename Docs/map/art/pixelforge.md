# PixelForge: lệnh, đầu ra, manifest

**Lệnh:** `node Tools/PixelForge/forge.cjs` từ thư mục gốc (khoảng 1,5 phút). Cần `sharp`, nạp từ `Tools/ArtImport/node_modules/sharp`. Gặp `EBUSY` là có tiến trình khác đang mở PNG, chạy lại sau. **Không sửa tay** PNG trong `Art/Resources/Pixel`.

## Đầu ra

- Khung: `Game/Assets/_Project/Art/Resources/Pixel/<thư mục>/<name>_<i>.png`. Thư mục do `folderFor()` chọn theo tên sprite: `sprite-folders.md`.
- `pixel-manifest.json`: `{version: "0.15.0", sprites: [{name, path, frames, width, height, fps, loop, border, anchorX, anchorY, footW, footH}]}`. `path` là đường dẫn đầy đủ (không đuôi khung) dưới `Pixel/`, nên code C# chỉ cần tên sprite. Hiện có **1.222 animation / 2.895 khung**.
- `anchorX/anchorY`: góc dưới trái chân đế (model) hoặc điểm chân (nhân vật), theo **mép pixel**. Chân đế chiếm x ∈ [anchorX, anchorX + footW·16), y ∈ [anchorY − footH·16, anchorY). Pivot Unity = (anchorX/w, (h − anchorY)/h). `footW/footH` theo hướng của chính sprite. Không có thì ghi 0.
- Contact sheet: `SourceAssets/PixelArt/Pixel1944/preview-<group>.png`, `preview-world-<module>.png` (một ảnh cho mỗi module trong `world/`; 4 hướng, lưới 16 px, chân đế tô sáng), preview nhân vật và ô nền. Ảnh rất cao, nên cắt từng đoạn bằng sharp rồi mới xem bằng Read.
- **Xem nhanh một module mà không chạy forge:** `node Tools/PixelForge/preview-models.cjs <module> <out.png> [scale] [idRegex]`. Lệnh này chỉ nạp module đó, in kích thước, anchor và thời gian render, và không ghi vào `Art/Resources`, nên nhiều agent có thể dùng song song. Chỉ chạy `forge.cjs` một lần khi mọi người đã sửa xong.

## Dọn khi sinh lại

- Xóa mọi PNG cũ nhưng **giữ `.meta`** của khung vẫn còn sinh ở cùng đường dẫn (GUID ổn định). `.meta` của khung không còn sinh bị xóa; `.meta` của thư mục được giữ khi thư mục còn tồn tại.
- Thư mục rỗng (sprite đổi tên/bị xóa) bị xóa cùng `.meta` của nó. Thư mục mới: Unity tự tạo `.meta` khi mở project hoặc khi build.
- Đổi tên sprite hoặc đổi quy tắc thư mục làm khung đổi chỗ thì `.meta` cũ mất, Unity cấp GUID mới. Không sao, vì code nạp sprite theo đường dẫn, không theo GUID.

## Các file trong `Tools/PixelForge/`

| File | Vai trò |
| --- | --- |
| `forge.cjs` | Điểm vào. `add(group, name, frames, {fps, loop, border, anchor, foot})` kiểm tra trùng tên, cùng kích thước khung, chân đế nằm trong sprite; `folderFor` chọn thư mục. Thứ tự: `buildUnits()` → `UI.build` → `T.build` → `RW.build` → `C.build` → `G.build` → `W.build`. `VERSION` |
| `lib.cjs` (166) | `Canvas` (put/rect/blit/scaled/silhouette/fill/png), bảng màu `PAL` (OL olive, CR cream, GD gold, ST steel, GL glass, RD red, WD wood, NV navy, FI fire, SM smoke, GR grass, SN sand, SW snow, IC ice, WT water), `hex`, nhiễu `hash/noise/fbm/tileFbm`, `dither`, font `FONT5/text5` |
| `units.cjs` + `units/` | `aircraft.cjs` (cánh quạt, tiêm kích, bomber, bank, súng `GUN_DEPLOY_FRAMES`), `carrier.cjs`, `rocket.cjs`, `supplies.cjs`, `effects.cjs`; `units.cjs` chỉ gom export. Nội dung: tiêm kích, bomber 4 livery (thường/damaged/bank), `bomberGunFrames` (11: 9 thò súng + 2 chớp lửa), tàu sân bay và sóng, rocket/hot/boost, tracer, enemy_tracer, muzzle, tiếp tế, nổ/khói/tia lửa/sóng xung kích/khiên băng/bắn nước, `fx_lock_reticle` |
| `ui.cjs` + `ui/` | `widgets.cjs` (nine-slice, nút, ô, icon, logo, `card_*`), `title.cjs` (`title_airbase`, mây), `cockpit.cjs` (**hằng `COCKPIT`**, đồng hồ, đèn, cần gạt, khe gõ); `ui.cjs` giữ `build`. Nội dung: panel, nút, ô, đèn, keycap, icon, logo, `card_*`, `title_airbase`, `title_clouds`, **`cockpit_panel` theo hằng `COCKPIT`**, `gauge_needle`, `ui_lever`, `ui_input(_focus)`, `ui_scanline`, `ui_pointer` |
| `terrain.cjs` + `terrain/` | `common.cjs` (`TW/TH`, `jungleRiverX`/`iceRiverX`, `Wrap`, cây/lều/hố, `blur`), `jungle.cjs`, `desert.cjs`, `ice.cjs`, `actors.cjs` (`ACTORS`). Ô `terrain_jungle/desert/ice` 680×560 và `_blur` (3 lượt box blur, giảm bão hòa, tối nhẹ). Actor wildlife. Export `build, jungleRiverX, iceRiverX, TW, TH, PAD, Wrap, crown, palm, hut, crater` |
| `runway.cjs` (188) | `title_runway_jungle` (ô lặp liền) và `title_runway_edge` (bìa rừng, hàng rào dòng 146, barie, chốt gác…; vai đường `shoulderTo 150`). Đường băng x 140–185, vạch giữa mỗi 16 dòng, đèn x 139/186 |
| `voxel.cjs` / `world.cjs` + `world/` / `characters.cjs` + `characters/` / `ground.cjs` | Model voxel, nhân vật, ô nền căn cứ: `models-characters.md` |

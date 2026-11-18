# Công thức: thêm sprite, model, nhân vật

Mọi hình tạo mới hoặc sửa phải đạt `quality-bar.md` (tiêu chuẩn chất lượng và checklist duyệt, kèm ảnh trước/sau).

## Sprite thường (máy bay, hiệu ứng, UI…)

1. Viết hàm vẽ trong module phù hợp (`units/<loại>.cjs`, `ui/<phần>.cjs`, `terrain/<vùng>.cjs`…) và export nó, gom qua file gốc (`units.cjs`, `ui.cjs`…), rồi `add('Group', 'name', frames, {fps, loop})`. Đặt tên theo tiền tố của nhóm để vào đúng thư mục (`sprite-folders.md`). Sprite thuộc Effects, Ground, Naval, Terrain, Title, Weapons hoặc UI phải khớp một chủ đề trong `SPRITE_THEME` (model: `MODEL_THEME`) của `forge.cjs`, nếu không forge báo lỗi.
2. `node Tools/PixelForge/forge.cjs`, soát contact sheet trong `SourceAssets/PixelArt/Pixel1944/`.
3. C#: `PixelSprites.At("name", time)` hoặc `Get("name", i)`. Unity tự import theo `SelectedArtImporter`.

## Model mới cho bản đồ căn cứ

1. Thêm `def(...)` trong `world/<module>.cjs` (module mới thì tạo file và thêm tên vào `MODULES` trong `world.cjs`) với id có tiền tố `bld_`/`prop_`/`veh_`/`air_`, chạy forge. Model tự vào `World/<loại>/<chủ đề>/<id>/`.
2. Thêm `ModelDef` cùng id và cùng chân đế trong `Scripts/Logic/World/WorldModels.cs`.
3. Đặt vào map bằng `Add(...)` trong `AirbaseMap.cs` (hoặc map mới).
4. RulesChecks (nhóm manifest) báo nếu thiếu hướng hoặc lệch chân đế.

## NPC mới

1. Thêm tham số vào `CHARACTERS` (`characters/roster.cjs`), chạy forge → `Characters/<who>/`.
2. Thêm vào `BaseContent.Roster` + một `DialogueGraph`, rồi `AddNpc` trên map.
3. Thêm check đi tới NPC trong `Tools/RulesChecks/World/WorldChecks.Movement.cs` nếu cần.

## Vẽ tay bằng LibreSprite/Aseprite (`aseprite.cjs`)

File `SourceAssets/Aseprite/**/<tên sprite>.ase` **thay** khung vẽ bằng code của sprite cùng tên mỗi lần chạy forge (tên, thư mục, manifest giữ nguyên; C# không đổi).

1. Lấy bản code làm nền: `node Tools/PixelForge/aseprite.cjs export <tên|regex>...` (vd. `chr_engineer_work_s`, `"chr_engineer_.*"`). File ra `SourceAssets/Aseprite/<thư mục sprite>/<tên>.ase`, đủ khung, đúng fps, lưới 16 px. Đã có `.ase` thì bỏ qua, không ghi đè bản vẽ tay.
2. Mở bằng LibreSprite, vẽ, lưu (Ctrl+S, giữ đuôi `.ase`). Layer ẩn bị bỏ, layer hiện được gộp lại.
3. `node Tools/PixelForge/forge.cjs`: log in `hand-drawn: <tên> (n frames, fps)`. `aseprite.cjs list` liệt kê mọi bản vẽ tay.

Luật:
- **Giữ nguyên kích thước khung** (sai thì forge dừng, vì điểm neo và chân đế tính theo kích thước code). Số khung và thời gian khung lấy từ file (fps = 1000 / thời gian trung bình).
- Sprite có số khung đồng bộ với C# (`bomber_guns`, model trong bảng contract RulesChecks như `bld_radar` 8 khung, nhân vật 8 khung) thì giữ số khung, hoặc sửa C# theo (`ops/sync-constants.md`).
- Khi có `.ase`, sửa code của sprite đó không còn tác dụng. Muốn quay về bản code: xóa file `.ase` rồi chạy forge.
- Tên file không khớp sprite nào: forge cảnh báo và bỏ qua.
- Tìm exe: biến môi trường `LIBRESPRITE`, rồi `~/Downloads/LibreSprite/libresprite.exe`, `C:/Program Files/LibreSprite/`, Aseprite. Chỉ cần exe khi có file `.ase`.

## Tay ở cảnh mở: lưới Blender (`Tools/BlenderForge/`)

Hai bàn tay của `cut_open_tin_hand`/`cut_open_tin_lid` là lưới tay MakeHuman (CC0, `Tools/BlenderForge/makehuman/`, giấy phép trong `LICENSE.md`). Blender chỉ dựng hình; màu, ánh sáng cửa sổ, viền mực vẫn do code vẽ.

1. Tư thế vẫn sửa trong `story/openingHands.cjs` và `story/hand.cjs`.
2. `node Tools/BlenderForge/render.cjs`: xuất khớp xương từng khung, chạy Blender nền (`opening_hands.py`): xoay lòng bàn tay theo khung tay code, mỗi đốt ngón chĩa theo đốt code, cẳng tay nằm trong ống tay áo. Ghi G-buffer vào `SourceAssets/Blender/OpeningHands/` (`*_pos/nrm/idao/depth.png` + `meta.json`, khoảng 2 phút).
3. Forge (`story/blenderHands.cjs`): điểm tay Blender nằm trước cảnh code thì thay vào, rồi tô bằng `shadeHand`. Bóng tay lấy từ bản đồ bóng `depth`. Da cẳng tay lọt sau mép ống tay áo bị bỏ.

Luật:
- `meta.json` giữ mã băm của tư thế. Sửa tư thế mà chưa render lại thì forge cảnh báo và quay về tay SDF vẽ bằng code (vẫn chạy được khi máy không có Blender).
- Tìm Blender: biến `BLENDER`, rồi `~/Tools/blender/*/blender.exe` (bản portable 4.2 LTS, không cần cài).
- Xem thử bản render có ánh sáng: `node Tools/BlenderForge/render.cjs preview lid:16,hand:19` → `Tools/BlenderForge/preview/` (không dùng trong game).
- Lưới được đặt tư thế bằng JS (`story/handRig.cjs`: skinning dual-quaternion, trọng số ngón cứng theo đốt; `story/handSolve.cjs`: giải tư thế theo điểm chạm, có giới hạn khớp). Blender chỉ nhận đỉnh lưới rồi render. Điểm chạm từng khung khai trong bảng `CONTACTS` của `openingHands.cjs`.
- Kiểm sau khi sửa tư thế: `node Tools/BlenderForge/handChecks.cjs --js` (nhanh, không cần Blender); bản đầy đủ: `render.cjs`, forge, `render.cjs verts`, rồi `handChecks.cjs --png [-v]`. Có 10 check, in PASS/FAIL:
  1. Không xuyên (≥ −0,3 px).
  2. Điểm chạm nằm trong 0..1 px.
  3. Điểm ghim trượt ≤ 0,5 px/khung.
  4. Đốt cứng (≤ 3 %).
  5. Giới hạn khớp và tỉ lệ DIP/PIP.
  6. Mượt; khung giữ trùng từng pixel.
  7. Tay nghỉ: xếp tầng, lòng vòm, ngón cái cách trục ngón trỏ ≤ 19 px.
  8. 8b xòe ≤ 10°; 8c tay giữ/nghỉ khép ngón (khe ≤ 5 px, hình chiếu ngón ≤ 75 %, ngón cái lộ ≥ 150 px); 8d ngón không ép thì PIP ≥ 15°.
- Chuyển động tay không dùng run mỗi khung (ở 8 fps thành lắc đều, nhìn giả); lực thể hiện bằng khung giữ y hệt, bước nhích, `press`/`tendon`. Độ mở khi với tay nằm ở ngón cái, bốn ngón luôn khép và hơi gập.

## Sửa cockpit

1. Sửa `COCKPIT` và vẽ trong `ui/cockpit.cjs`.
2. Sửa tọa độ tương ứng ×2 trong `Scripts/Unity/Flight/FlightView/FlightView.cs` (`ops/sync-constants.md`).
3. Forge, build, xem ảnh smoke `02b-cockpit-typing`.

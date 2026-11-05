# Model voxel, nhân vật, ô nền căn cứ (0.15)

Code: `Tools/PixelForge/voxel.cjs`, `world.cjs` + `world/`, `characters.cjs` + `characters/`, `ground.cjs`. Phía C#: `logic/world.md` (`WorldModels`), `unity/base-view.md`.

| File | Vai trò |
| --- | --- |
| `voxel.cjs` | Bộ dựng voxel: 1 voxel = 1 px, x đông, y nam, z lên, mặt trước = +y. Primitive box/cyl/cone/ellipsoid/vault/mái hai dốc/hip/pyramid/line, khoét cửa, decal chữ. Vật liệu có texture. Chiếu xiên `screenX = x, screenY = y − z`, z-buffer, ánh sáng trên-trái, dither Bayer, bóng tự đổ, viền, bóng đổ mềm. Quay thật 90° quanh z ra 4 hướng |
| `world.cjs` + `world/` | `world.cjs` nạp các module trong mảng `MODULES` theo thứ tự (= thứ tự manifest), gắn `spec.module` cho mỗi model và gọi `extra(add)` của module (sprite không phải model, ví dụ `fx_leaves_*`). `world/common.cjs`: ramp, vật liệu, helper xây dựng, `MODELS` + `def`. Mỗi module chỉ được `require` `lib`, `voxel`, `common`, nên helper dùng chung giữa hai module (buildings↔quarters, props↔clutter, aircraft↔fleet) là bản chép: sửa một bên thì phải chép sang bên kia. **247 model**: `def(id, group, foot, height, build, {frames, fps, animated, overlay, margin})`. Export `build(add)`, `MODELS`, `renderModel`. Cờ, ống gió, khói, lá rơi luôn bay sang phải màn hình ở mọi hướng |

**Module trong `world/`** (số model; id có ★ đang dùng trên map, phải khớp `WorldModels.cs`):

| Module | Nội dung |
| --- | --- |
| `buildings` (9★) | hangar, tháp chỉ huy, HQ, doanh trại, nhà ăn, y tế, trường, xưởng, kho |
| `quarters` (16) | Nissen 2 cỡ, doanh trại gỗ/gạch chữ L, HQ lớn có cờ, CLB sĩ quan, nhà ăn lớn, căng-tin, bệnh viện lều/gạch, nhà nguyện, nhà tắm, bưu điện, 2 cottage, ga-ra |
| `installations` (9★) | kho xăng/đạn, radar, điện đài, tháp canh/nước, chốt gác, pháo AA, lều |
| `storage` (16) | `bld_store_*` (gạch có bến bốc hàng, Quonset, thép, lạnh, phụ tùng, gỗ, ngụy trang), `bld_shed_*`, `bld_tank_*`, `bld_bunker_mag_*`, `bld_depot_drums` |
| `factory` (23) | `bld_factory_*`: hội trường lắp ráp 18×12 mái răng cưa, xưởng cánh/thân/động cơ/sơn, lò hơi có ống khói, văn phòng có tháp đồng hồ, cổng, kho nhôm, căng-tin; `prop_jig_*`, `prop_gantry*` |
| `airfield` (26) | hangar T2 18×12 (mở/đóng), Bellman, blister 2 cỡ, hangar gỗ; `bld_tower_*` 3 kiểu, `bld_terminal`, `bld_ops_block`, `bld_fire_station`, `bld_met_office`, ụ đất, lô cốt; `prop_airfield_*` đèn, đèn hiệu, chữ T, ô tín hiệu |
| `props` (12★) | bao cát, phuy, thùng, can, cột cờ, ống gió, đèn pha, cột đèn, biển, ghế, dây thép gai, barie |
| `clutter` (36) | thùng gỗ, thùng/hộp đạn, phuy (màu, nằm, kim tự tháp, pallet, đổ dầu), can, pallet, bạt, bom, lốp, ụ bao cát, hàng rào, biển cảnh báo, bao thư, kiện thả dù |
| `workshop` (29) | đồ của kỹ sư: bàn thợ 3 kiểu, hòm và xe đồ nghề, động cơ hình sao/V12, giá cánh quạt, tời, máy hàn/nén khí/phát điện, thang, kích, máy tiện/khoan, đe, lò rèn, giá, bàn vẽ, bảng đen, phát minh (Tesla, dynamo, phòng thí nghiệm) |
| `nature` (40, 3★) | `prop_tree_*` (sồi, mùa thu, bạch dương, dương, liễu, táo, anh đào, thông, cọ, chuối, rừng, cây chết, cây cháy; đung đưa 4 khung @3), `prop_bush_*`, `prop_plant_*`, `prop_rock_*`, `prop_log_*`, `prop_stump_*`; `extra`: `fx_leaves_{green,autumn,palm}`, `fx_petals` |
| `vehicles` (7★) | jeep, xe tải, xe xăng, tăng, pháo AA, pháo, mô tô |
| `aircraft` (3★) | `air_fighter`, `air_transport`, `air_bomber_enemy` |
| `fleet` (21) | `air_brawler*`, `air_lancer*`, `air_seagull*`, `air_raider_enemy`, `air_fortress*` (10×8), `air_striker*`, `air_trident*`, `air_flyingboat`, `air_biplane_trainer`, `air_liaison*`, `air_glider`, `air_repair`, `air_wreck` |
| `characters.cjs` + `characters/` | `characters.cjs`: preview + `build`. `characters/palette.cjs` (khung 24×32, ramp `M`), `roster.cjs` (`CHARACTERS`), `masks.cjs` (đầu, tóc, mũ, kính), `body.cjs` (đầu, chân, thân, khăn, tay), `figure.cjs` (đồ cầm, ghép dáng, lật), `cycles.cjs` (idle/walk/run/talk, `fx_dust`, bóng, dấu nhiệm vụ), `portraits.cjs`. **Rig chung** (`CHARACTERS`: skin, hair, hairStyle, top/topStyle, pants, shoes, hat, held, glasses, goggles, scarf, medals, portrait…). 7 nhân vật × 4 hướng (W lật từ E; `engineer` (kỹ sư 19 tuổi, tóc vàng đuôi ngựa, có `chr_engineer_work_*` 8 khung @10) chưa có trong roster C#) × idle 8 khung @5 (thở, chớp mắt khung 6) / walk 8 @16 / run 8 @20. Contact ở khung 0 và 4; run nghiêng người, có khung bay. Pose: `bob`, `head` (trễ 1 khung), `chest`, `lean`, `blink`; khăn pilot bay theo. Thêm `chr_professor_talk_s`, `fx_dust` (16×8, anchor 8,7, 5 khung @14, không lặp), `chr_shadow`, `fx_quest_marker`, `portrait_<cid>` 48×48. `writePreviews` |
| `ground.cjs` | Ô 16×16 lát liền: `tile_grass/dirt/concrete/asphalt` (4 biến thể), `tile_sand` (2), `tile_runway` (5: trơn, vạch giữa **sát mép phải ô**, mép trái, mép phải, ngưỡng), `tile_water` (4), `tile_fence` 16×24 anchor (0,24) (7 kiểu). `writePreviews` |

Khung nhân vật 24×32, anchor (12,30). Tìm model bằng Grep `def('<id>'` trong `Tools/PixelForge/world/`; tham số nhân vật ở `characters/roster.cjs`. Module con chỉ được dùng tên từ module đứng trước nó (không require vòng).

Cách thêm model, NPC, sprite: `add-sprites.md`.

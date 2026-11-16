# Thư mục sprite (tự chọn theo tên)

Quy tắc nằm trong `folderFor(group, name, isModel)` của `Tools/PixelForge/forge.cjs`. Thêm sprite đúng tiền tố tên là nó tự vào đúng thư mục; code C# không cần biết thư mục (manifest lưu đường dẫn).

```text
Art/Resources/Pixel/
├─ pixel-manifest.json
├─ Aircraft/Fighter/          fighter_*                      (máy bay người chơi khi bay)
├─ Aircraft/Bomber/<livery>/  bomber_<jungle|desert|ice|ocean>_* (thường, damaged, bank); Bomber/Shared: shadow, guns
├─ Weapons/                   Rocket (rocket*), Guns (tracer, enemy_tracer, muzzle_flash)
├─ Effects/                   Combat (nổ, khói, tia lửa, sóng xung kích, khiên, bắn nước, reticle; thư viện pixelfx: fx_explosion_barrel/dirt, fx_splash_big, fx_burning), Base (quest_marker, dust; thư viện: fx_fire_*, fx_poof, fx_spark_arc, fx_tesla_arcs), Nature (fx_leaves_*, fx_petals; thư viện: fx_bird, fx_butterfly)
├─ Ground/                    Natural (grass, dirt, sand, water), Paved (concrete, asphalt, runway), Fence
├─ Terrain/                   Jungle, Desert, Ice (ô + bản _blur)
├─ Title/                     Logo, Cards (card_*), Airbase (title_airbase, title_clouds), Runway (title_runway_*)
├─ Naval/Carrier/             carrier, bow_wave, stern_wake
├─ Supplies/<loại>/           supply_<fuel|metal|roll>
├─ Portraits/<nhân vật>/      portrait_<who>
├─ UI/Cockpit/                cockpit_panel, gauge_needle, ui_lamp_*, ui_lever
├─ UI/Icons/                  icon_*
├─ UI/Buttons/ Cells/ Input/ Dialog/ Menu/ Panels/   ui_button_*, ui_cell_*, ui_input*+ui_scanline, ui_dialog_* (khung hội thoại), ui_slider_*+ui_save_slot*+ui_menu_* (menu chính), panel/ink/plate/keycap/card/pointer
├─ Wildlife/<con vật>/        actor_<x> + actor_<x>_blur     (vd. Wildlife/elephant/)
├─ Characters/<nhân vật>/     chr_<who>_<anim>_<dir>         (pilot, professor, guard, mechanic, medic, officer)
├─ Characters/Shared/         chr_* không theo mẫu trên (chr_shadow)
└─ World/<loại>/<chủ đề>/<model id>/   model voxel 4 hướng _s/_e/_n/_w (247 model)
   ├─ Buildings/  Factory (17) Hangars (7) Hospital (3) Barracks (7) Mess (3) Command (5) Airfield (8)
   │              Fuel (3) Storage (13) Defense (9) Village (4) Utility (4)
   ├─ Props/      Factory (6) Airfield (11) Lab (5) Workshop (24) Trees (21) Plants (12) RocksLogs (7)
   │              Drums (13) Ordnance (4) Supplies (14) Defense (9) Street (7)
   ├─ Vehicles/   Transport (4) Armor (3)
   └─ Aircraft/   Fighters (9) Bombers (7) Transport (6) Wrecks (2)   (máy bay đỗ ở căn cứ)
```

- **Model** (sprite có `foot`) bắt buộc có tiền tố `bld_`, `prop_`, `veh_` hoặc `air_`; thiếu thì forge báo lỗi. Thêm loại model mới: thêm vào `MODEL_CATEGORY` trong `forge.cjs`.
- **Chủ đề** chọn theo bảng `MODEL_THEME` trong `forge.cjs`: regex đầu tiên khớp id thắng, nên thứ tự quan trọng (vd. `bld_factory_canteen` vào Factory chứ không vào Mess, `prop_bench_work` vào Workshop chứ không vào Street). Model không khớp chủ đề nào thì forge báo lỗi. Model mới đặt tên theo tiền tố có sẵn (vd. `bld_medical_*` tự vào Hospital), hoặc thêm một dòng vào bảng.
- Nhóm không phải model chia theo bảng `SPRITE_THEME` (cùng luật regex đầu tiên khớp). Sprite mới trong Effects, Ground, Naval, Terrain, Title, Weapons hoặc UI mà không khớp chủ đề nào thì forge báo lỗi: thêm một dòng vào bảng. Không cần sửa C#.
- `SelectedArtImporter` áp cho mọi cấp thư mục dưới `Pixel/`; ô nền phải nằm trong đường dẫn có `/Ground/` (để readable).

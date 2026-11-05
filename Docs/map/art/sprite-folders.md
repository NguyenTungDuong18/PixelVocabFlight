# Thư mục sprite (tự chọn theo tên)

Quy tắc nằm trong `folderFor(group, name, isModel)` của `Tools/PixelForge/forge.cjs`. Thêm sprite đúng tiền tố tên là nó tự vào đúng thư mục; code C# không cần biết thư mục (manifest lưu đường dẫn).

```text
Art/Resources/Pixel/
├─ pixel-manifest.json
├─ Aircraft/Fighter/          fighter_*                      (máy bay người chơi khi bay)
├─ Aircraft/Bomber/           bomber_*                       (địch: 4 livery, damaged, bank, guns, shadow)
├─ Weapons/  Effects/  Naval/  Supplies/  Terrain/  Title/  Ground/  Portraits/   (nhóm nhỏ, giữ phẳng)
├─ UI/Cockpit/                cockpit_panel, gauge_needle, ui_lamp_*, ui_lever
├─ UI/Icons/                  icon_*
├─ UI/Widgets/                ui_* còn lại (panel, nút, ô, keycap, input, card, pointer…)
├─ Wildlife/<con vật>/        actor_<x> + actor_<x>_blur     (vd. Wildlife/elephant/)
├─ Characters/<nhân vật>/     chr_<who>_<anim>_<dir>         (pilot, professor, guard, mechanic, medic, officer)
├─ Characters/Shared/         chr_* không theo mẫu trên (chr_shadow)
└─ World/<loại>/<model id>/   model voxel 4 hướng _s/_e/_n/_w
   ├─ Buildings/bld_*/        (18 model)
   ├─ Props/prop_*/           (15)
   ├─ Vehicles/veh_*/         (7)
   └─ Aircraft/air_*/         (3, máy bay đỗ ở căn cứ)
```

- **Model** (sprite có `foot`) bắt buộc có tiền tố `bld_`, `prop_`, `veh_` hoặc `air_`; thiếu thì forge báo lỗi. Thêm loại model mới: thêm vào `MODEL_CATEGORY` trong `forge.cjs`.
- Nhóm phẳng mà phình to (khoảng >40 file): thêm một nhánh trong `folderFor` để chia theo tiền tố. Không cần sửa C#.
- `SelectedArtImporter` áp cho mọi cấp thư mục dưới `Pixel/`; ô nền phải nằm trong đường dẫn có `/Ground/` (để readable).

# FlightBoardView: vẽ sân chơi

Code: thư mục `Scripts/Unity/Flight/FlightBoardView/` (partial class): `FlightBoardView.cs` (lớp visual, field, constructor, chuột, `Clear`, `Animate`, `SyncSupplies`), `.Aircraft.cs` (`SyncReticle`, `SyncEnemies`, `EnemyFire`, `SyncShots`, `CreateDamageFrame`), `.Carriers.cs` (`SyncCarriers`), `.Missiles.cs` (thẻ đáp án tên lửa: `CreateMissile`, `SyncMissiles`, `AnimateChoices`, `FlashMissile`, `MarkWrongChoice`), `.Effects.cs` (`AddEffect`, `Explode`, `Hit`, `Burst`, `Impact`, `Blast`). Đọc state từ `ContinuousFlight` (`logic/flight-state.md`). Tên sprite: `art/sprite-catalog.md`.

**Hằng số:** `Width 1360`, `Height 548`, `ArtScale 2` (mọi sprite vẽ ×2), `GunDeployFrames 9` (phải khớp `bomber_guns`), `ChoiceWidth 156`, `ChoiceHeight 40`, `ChoiceOpenSeconds .42`.

**Lớp nền:** `ScrollingTerrain` (đất liền) và `OceanBackdrop` (biển), crossfade theo `Environment`. `Focus` điều độ mờ (`rendering.md`).

**Người chơi:** `fighter_level`, hoặc `fighter_bank_left/right` khi di chuyển; bóng `fighter_shadow`; đạn `tracer`, `muzzle_flash`.

**Máy bay địch:**
- Sprite `bomber_<env>` (`_damaged` khi khiên băng vỡ), `bomber_<env>_bank_left/right` khi Departing; bóng `bomber_shadow`.
- Khi khóa: overlay `bomber_guns`, khung = `LockProgress × 9` (khung 9–10 là chớp lửa); thanh khóa và chữ `KHÓA MỤC TIÊU x.xs`; thân xoay theo vận tốc; nháy đỏ khi còn 1,5 giây.
- Nhãn nghĩa trên đầu máy bay; mục tiêu điện đài được làm nổi. Ở Băng có `fx_ice_shield`.

**Đạn địch:** `enemy_tracer`. **Thước ngắm** `fx_lock_reticle` (8 khung) khép dần khi `PlayerLockedOn`, đỏ nhấp nháy khi khóa xong.

**Tàu sân bay:** `carrier`, `carrier_bow_wave`, `carrier_stern_wake`, xoay theo `HeadingDegrees`; gọi `OceanBackdrop.Wake`.

**Tên lửa:**
- Sprite theo phase: `rocket` (Cruise), `rocket_hot` (Locking, rung), `rocket_boost` (Boost).
- 4 thẻ đáp án: `Button` 156×40 có keycap `ui_keycap` 1–4; bật ra từ tâm tên lửa với `EaseOutBack`, lệch pha, xếp 2×2, gần mép thì dồn về một phía. `interactable = Answerable && !Wrong` (không đặt false lúc đang lớn, sẽ hiện xám).
- `OpenMissileId`: tên lửa đang rê chuột, hoặc gần nhất còn trả lời được. `MarkWrongChoice`: thẻ rung, viền đỏ, khóa.

**Tiếp tế:** `supply_fuel`, `supply_metal`, `supply_roll`.

**Hiệu ứng:** `Hit`, `Burst` (`fx_explosion`, `fx_spark`, `fx_smoke`), `Impact` (rung màn hình), `Blast` (`fx_shockwave`), `EnemyFire`, `FlashMissile`, `fx_splash` trên biển.

**Hàm khác:** `Animate(dt, flight|null, env)`, `PointerX(current)`, `PointerOverField`, `PointerOverMissile`, `IntroLift(t)`, `Focus` (0 nét → 1 mờ).

**Test accessor:** `EnemyGunsVisible, ReticleSpriteName, VisibleShots, MissileSpriteName, OpenMissileId, MissileChoiceScale, MissileChoiceAnchored, MissileChoicesFullyOpen, VisibleMissilePopupCount, PointerOverMissile, GroundSpriteName, GroundSharpAlpha, Wildlife`.

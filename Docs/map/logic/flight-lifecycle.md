# ContinuousFlight: vòng đời máy bay, đạn, tên lửa, tàu, tiếp tế

Code: `Advance` trong `Scripts/Logic/Flight/ContinuousFlight/ContinuousFlight.cs` gọi lần lượt `AdvanceEnemies`, `AdvanceShots` (`.Aircraft.cs`), `AdvanceCarriers` (`.Carriers.cs`), `AdvanceMissiles` (`.Missiles.cs`), `AdvanceSupplies` (`.Supplies.cs`). Hằng số: `flight-constants.md`. Phía vẽ: `unity/board.md`.

## Máy bay địch

1. **Patrol:** trượt về X của slot đội hình (`.07 + slot%8 × .122`, 8 slot mỗi hàng); hạ Y với `PatrolSpeed × SpeedMultiplier`, tối đa .56. Khi `Age ≥ 18`: sang Locking, `FireY = clamp(Y + .1, .62, .70)`, phát `AircraftLock`, `Prioritize(enemy)` (thành mục tiêu điện đài).
2. **Locking (4,5 giây):** X trôi về phía người chơi (hệ số .3/s); Y tới `FireY` đúng lúc `LockRemaining` về 0 (chuyển động liên tục). Hết giờ → `Fire(enemy)`: 3 `ShotState` có Age âm so le, lưu `DepartStartSpeed`, `DepartDirection` (về mép gần), phát `AircraftFire`.
3. **Departing:** ngoặt smoothstep 1,1 giây (góc tối đa 1,75 rad); tốc độ tăng từ `DepartStartSpeed` lên .7 trong 1,2 giây; ra khỏi sân → `Evaded`.

## Đạn

Nội suy tuyến tính từ điểm bắn tới **vị trí hiện tại** của người chơi trong .42 giây; chạm thì `ImpactDamage(1)` (có grace) → `AircraftImpact`.

## Tên lửa

1. **Cruise:** `Aim` lại mỗi bước, nhân `SpeedMultiplier`.
2. Tới `MissileTerminalY` hoặc `Failed` → **Locking:** tốc độ ×.25, 1,2 hoặc 0,6 giây.
3. **Boost:** tốc độ tăng tới 1,6, lao thẳng vào người chơi. Chạm → `ImpactDamage(2)` → `MissileImpact`.

## Tàu sân bay

Entering (tới Y .2) → Deploying (20 giây) → Turning (2,5 giây xoay mũi tại chỗ) → Advancing (quỹ đạo `t*t*(2−t)` về mép, Y tới .62) → Exiting (khi Y ≥ .5). Ra ngoài X ∉ [−.12, 1.12] thì bị xóa.

## Tiếp tế

- Mỗi Kill có 10% rơi Fuel hoặc Metal; tự bay về người chơi trong 1,2 giây (Fuel +50).
- Mỗi 5 giây 10% rơi hộp Roll ở hàng trên; phải **LÁI** chạm vào mới nhặt (+1 Rolls).

## Chọn từ và mục tiêu

- `SpawnAircraft` rút từ "bag" xáo trộn, bỏ qua từ trùng đáp án với máy bay đang có (`QuestionDeck.DistinctAnswers`). Không tìm được → `WaitingForDistinctWord`.
- `Retarget`: ưu tiên máy bay Locking có `LockRemaining` nhỏ nhất; nếu không có thì ngẫu nhiên, khác từ trước.

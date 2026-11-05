# ContinuousFlight: enum, lớp state, API

Code: enum và lớp state ở `Scripts/Logic/Flight/FlightTypes.cs`; mô phỏng thuần (trái tim luật chơi) ở thư mục `Scripts/Logic/Flight/ContinuousFlight/` (partial class): `ContinuousFlight.cs` (hằng, field, API công khai, `Tick`, `Advance`, `Aim`, `ImpactDamage`), `.Aircraft.cs` (máy bay địch, đạn, `Fire`, `SpawnAircraft`), `.Missiles.cs` (`AdvanceMissiles`, `AnswerMissile`), `.Carriers.cs` (`AdvanceCarrier`, `LaunchMissile`), `.Supplies.cs` (`AdvanceSupplies`, `AddSupply`), `.Answers.cs` (túi từ, `Retarget`, `Roll`, `Submit`, `Kill`). Hằng số: `flight-constants.md`. Vòng đời từng loại actor: `flight-lifecycle.md`. Test: `Tools/RulesChecks/Combat/`.

## Enum

- `FlightEnvironment { Jungle, Desert, Ice, Ocean }` (thêm vùng mới thì sửa mọi chỗ `% 4`)
- `SupplyKind { Fuel, Metal, Roll }`, `KillSource { PlayerShot, MissileBlast }`
- `CarrierPhase { Entering, Deploying, Turning, Advancing, Exiting }`
- `EnemyPhase { Patrol, Locking, Departing }`, `MissilePhase { Cruise, Locking, Boost }`
- `FlightEventKind { Spawn, Hit, Kill, Wrong, Retarget, Pickup, MissileBlast, MissileFailure, AircraftImpact, MissileImpact, Evaded, MissileWrong, MissileSolved, AircraftLock, AircraftFire, MissileLock, MissileBoost }`

## Lớp state (field public, view đọc trực tiếp)

| Lớp | Field quan trọng |
| --- | --- |
| `EnemyState` | `Id, FormationSlot, Entry, X, Y, Age, VelocityX/Y, Phase, LockRemaining, DepartSeconds, FireY, DepartStartSpeed, DepartDirection, Health, Environment`. Tính sẵn: `RequiresPartOfSpeech` (Desert), `Attacking`, `Departing`, `LockProgress` (0→1 trong Locking, 1 khi Departing) |
| `ShotState` | `Id, SourceId, Entry, StartX/Y, X, Y, Age` (âm = chờ bắn trong loạt), `InFlight` |
| `CarrierState` | Vị trí, `HeadingDegrees, DepartureHeading`, các timer, `Phase, ExitDirection`, số máy bay và tên lửa đã phóng |
| `MissileState` | `Id, Choices[4], CorrectIndex, WrongAttempts, Phase, PhaseSeconds`, `Failed` (≥3 lần sai), `Answerable` (= !Failed && Phase != Boost), `Answer` |
| `SupplyState` | `Id, Kind, X, Y, Age` |
| `FlightEvent` | `Kind, Entry, X, Y, Value, EntityId, Source, Supply`, `ShouldPronounce` |

## API công khai

- `Tick(dt)`, `MovePlayer(x)` (kẹp .045..955), `SetDriving(bool)`.
- `Submit(answer, pos)`: sai → `Progress.Wrong` + Wrong. Đúng → Hit, Health−−, rồi Kill hoặc Retarget. Máy bay có khiên đang Locking vẫn giữ làm mục tiêu.
- `AnswerMissile(id, choice)`: đúng → MissileSolved + MissileBlast, giết mọi địch trong `BlastRadius` (bỏ qua khiên băng, +25, không phát âm). Sai → MissileWrong; đủ 3 lần → MissileFailure.
- `Roll()`, `PopEvent()`.
- Thuộc tính: `Enemies, Carriers, Missiles, Supplies, Shots, Target, Driving, PlayerX, Rolls` (khởi đầu 3), `CanRoll, TargetChanges, Environment` (tính từ `ActiveSeconds`), `SpawnInterval, SpawnIn, WaitingForDistinctWord, PlayerLockedOn, ImpactGraceRemaining, Progress`.

## Thêm sự kiện gameplay

1. Thêm giá trị vào `FlightEventKind`, gọi `Emit(...)` trong mô phỏng.
2. Xử lý trong `FlightGame.DrainEvents` (`unity/flight-game.md`).
3. Thêm check RulesChecks và/hoặc smoke (`unity/smoke-test.md`).

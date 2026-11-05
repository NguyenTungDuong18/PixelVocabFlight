# ContinuousFlight: hằng số luật chơi

Code: `Scripts/Logic/Flight/ContinuousFlight/ContinuousFlight.cs`. Đổi hằng thì cập nhật kỳ vọng trong `Tools/RulesChecks/Combat/` và chạy lại RulesChecks.

| Hằng | Giá trị | Ý nghĩa |
| --- | --- | --- |
| `EnvironmentDuration` | 180 | Giây mỗi chiến trường |
| `AircraftSpawnSeconds` | 12 | Nhịp sinh (Rừng ÷1,3). Ở Biển 20% lần sinh là tàu sân bay |
| `AircraftAttackAge` | 18 | Tuổi máy bay khi bắt đầu khóa |
| `AircraftLockSeconds` | 4,5 | Thời gian khóa = thời gian thò súng |
| `ShotBurst`, `ShotSpacing`, `ShotTravelSeconds` | 3, .09, .42 | Loạt đạn: số viên, khoảng cách, thời gian bay |
| `DepartTurnSeconds` | 1,1 | Thời gian ngoặt khi rời đi |
| `PatrolSpeed` | .022 | Chiều cao sân mỗi giây khi tuần tra, nhân `SpeedMultiplier`. Y bị chặn ở .56 |
| `FireRowMin/Max` | .62 / .70 | Hàng bắn |
| `PlayerSpeed` | .85 | Bề rộng sân mỗi giây |
| `PlayerY` | .92 | |
| `FieldAspect` | 548/1360 | Quy đổi khoảng cách theo Y |
| `ImpactGraceSeconds` | .65 | Miễn thương sau khi trúng đòn |
| `MissileSpeedFactor` | .8 | Tốc độ bay thường = .035×.8 |
| `MissileTerminalY` | PlayerY − .2 | Tới đây thì tên lửa khóa |
| `MissileLockSeconds` | 1,2 | 0,6 nếu đã sai 3 lần (`MissileFailedLockSeconds`) |
| `MissileBoostSpeed` | 1,6 | Bề rộng sân mỗi giây; nhanh hơn người chơi nên luôn trúng |
| `BlastRadius` | .09 | Bán kính nổ khi trả lời đúng tên lửa |
| `CarrierDeploymentY/ExitY` | .2 / .5 | |
| `CarrierDeploymentDuration` | 20 | Mỗi 12 giây thả một máy bay, mỗi 5 giây có 50% phóng tên lửa |
| `CarrierEntry/Advance/ExitSpeed` | .055 / .03 / .085 | |
| `CarrierRetreatDuration`, `CarrierTurnDuration` | 18, 2,5 | |
| `CarrierLaunchOffsetY` | 88/548 | Điểm phóng tính từ tâm tàu |

Tốc độ tăng theo thời gian: `GameRules.SpeedMultiplier` (`progress-rules.md`).

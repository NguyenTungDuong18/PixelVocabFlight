# Sau 0.15: sắp xếp lại thư mục và chia nhỏ file (chưa đổi số phiên bản)

Không đổi gameplay. Mục tiêu: dễ tìm, dễ sửa, dễ mở rộng, và AI chỉ cần đọc đúng file nhỏ liên quan.

## Thư mục

- `Scripts/` tách thành `Logic/` (C# thuần, assembly `Wordwing.Logic`, RulesChecks tự biên dịch cả thư mục) và `Unity/` (view, MonoBehaviour, I/O).
- Sprite PixelForge tự vào thư mục con theo tiền tố tên (`Docs/map/art/sprite-folders.md`).
- File phát âm chia theo chữ cái đầu của từ (`PronunciationPath`).
- Bản đồ tài liệu chia thành `Docs/map/<mảng>/<chủ đề>.md`, mục lục ở `Docs/00-Codebase-Map.md`.

## Chia nhỏ file

| Trước | Sau |
| --- | --- |
| `ContinuousFlight.cs` (578 dòng) | `Logic/Flight/FlightTypes.cs` (enum + state) và `Logic/Flight/ContinuousFlight/` (lõi, Aircraft, Missiles, Carriers, Supplies, Answers). `Advance` gọi `AdvanceEnemies/Shots/Carriers/Missiles/Supplies` |
| `FlightGame.cs` (566) | `Unity/Game/FlightGame/` (lõi, Base, Vocabulary, Sortie, Events) |
| `FlightGame.Verification.cs` (418, một coroutine 380 dòng) | `SmokeTest()` điều phối các giai đoạn `SmokeBase`, `SmokeProfessor`, `SmokeTakeOff`, `SmokeCockpit`, `SmokeEnemyAircraft`, `SmokeRocket`, `SmokeCarrier`, `SmokeResults` trong `FlightGame.Smoke.{Base,Sortie,Combat,Helpers}.cs` |
| `FlightView.cs` (484) | `Unity/Flight/FlightView/` (lõi, Cockpit, Screens, TakeOff) |
| `FlightBoardView.cs` (540) | `Unity/Flight/FlightBoardView/` (lõi, Aircraft, Carriers, Missiles, Effects) |
| `BaseView.cs` (613) | `Unity/Base/BaseView/` (lõi, Build, Characters, Dust, Hud) |
| `WorldChecks.cs` (578), `CombatChecks.cs` (230) | `Tools/RulesChecks/World/` và `Combat/`, mỗi nhóm check là một hàm `CheckX()` |
| `world.cjs` (1.325) | `world/{common,buildings,installations,props,vehicles,aircraft}.cjs` |
| `characters.cjs` (1.194) | `characters/{palette,roster,masks,body,figure,cycles,portraits}.cjs` |
| `units.cjs`, `ui.cjs`, `terrain.cjs` | `units/`, `ui/` (`cockpit.cjs` giữ `COCKPIT`), `terrain/` |

Quy ước cho phần mới: `Docs/map/overview/folders.md` (mục "Chia file khi class hoặc module lớn lên").

## Kiểm chứng

- PixelForge: hash 1.287 file đầu ra (PNG, contact sheet, manifest đã sắp xếp) giống hệt trước khi tách.
- `dotnet build Tools/UnityCompileChecks`: 0 lỗi, 0 cảnh báo.
- RulesChecks: 13 interaction, 16.572 walkable, 47.121 gameplay, 1.238 manifest (như trước).
- Build Windows + smoke: 113/113 PASS, cùng danh sách và thứ tự check.

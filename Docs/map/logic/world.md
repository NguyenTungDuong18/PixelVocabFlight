# World: bản đồ căn cứ, NPC, hội thoại, nhiệm vụ

Code: `Scripts/Logic/World/` (C# thuần, từ 0.15). Phía vẽ: `unity/base-view.md`. Test: `Tools/RulesChecks/World/` (`WorldChecks.cs` điều phối `Run()`; `.Map.cs` model + bản đồ, `.Movement.cs` di chuyển + tương tác, `.Dialogue.cs` hội thoại + nhiệm vụ, `.Manifest.cs` `RunManifest`, `.Pathing.cs` BFS/đi bộ).

| File | Nội dung |
| --- | --- |
| `WorldModels.cs` | `Facing {S,E,N,W}`, `Facings` (Delta/Opposite/Toward), `ModelKind`, `ModelDef {Id, Name, Kind, FootW, FootH, Solid, Frames, Group}`. Danh mục **43 model**. `Footprint(m, f)` đổi W/H ở E/W. `SpriteName(id, f)` = `id_s|e|n|w` |
| `MapDef.cs` | `Ground`, `Placement {Id, Model, Label, Facing, X, Y, Tag}`, `NpcDef`, `MapArea`, `MapDef`: ô nền, biến thể đường băng và hàng rào, placement, NPC, khu vực, spawn, `AircraftReturn*`, `FootprintOf`, `SortKey`, `TileVariant`, `SolidTile`. Helper dựng map: `FillGround`, `FenceRect`, `OpenGate`, `Add`, `AddIfFree`, `AddNpc`, `AddArea` |
| `AirbaseMap.cs` | `Create()`: căn cứ 72×52, 283 placement. Spawn (17.5, 28.5) quay N; Giáo sư (17.5, 25) trước `bld_academy`; `skylark` (`air_fighter`, E, 48,19, tag `player-aircraft`); AircraftReturn (50, 23.6) |
| `BaseWorld.cs` | `WalkSpeed 4`, `RunSpeed 6.5` ô/giây; hộp chân ±.3 × ±.18; `InteractRange 1.5`; `ZoneRange 3`. `Tick` (chuẩn hóa đi chéo, trượt dọc tường, chia bước chống xuyên), `Blocked`, `Interact`, `EndDialogue`, `PlacePlayer`, `NearestKind/Id`, `PromptText`, `CurrentZone`, `PopEvent`. `WorldEventKind {DialogueOpened, BoardAircraft, Hint, ZoneEntered}`. NPC đứng yên, khi nói quay về phía người chơi |
| `Dialogue.cs` | `DialogueGraph` (bắt đầu ở `"start"`; node không có Text là **router**, tự đi theo lựa chọn hợp lệ đầu tiên), `DialogueChoice {Text, Next, Action, Condition}`, `DialogueRunner` (`Start`, `Text(vars)`, `Choices`, `Choose(i, apply)`, `Close`). `DialogueActions` (`end`, `vocab.open`, `mission.cancel`, `mission.accept:N`), `DialogueConditions` (`mission.active`, `!…`, `completed>0`) |
| `Missions.cs` | `MissionDef`, `MissionLog` (`Active`, `Environment`, `Completed`, `LastScore`, `Accept`, `Cancel`, `Complete`, `Apply(action)`, `Condition(cond)`, `ObjectiveText`). Nhiệm vụ đang nhận **không** được lưu vào hồ sơ |
| `BaseContent.cs` | `PlayerName "Phi công 01"`. Roster 5 NPC: `professor` (Giáo sư Whitmore), `guard` (Lính gác Tâm), `mechanic` (Thợ máy Bảy), `medic` (Y tá Lan), `officer` (Đại tá Phong). Lời thoại, nhiệm vụ `vocab-sortie`, `Variables` ({wordCount}, {lastScore}, {environment}, {completed}), `SpeakerName/SpeakerCharacter` |

`ProfileStore.PilotProfile` lưu `missionsCompleted` và `lastScore` (`unity/data.md`).

## Mở rộng

- **Model mới trên bản đồ:** `art/add-sprites.md`.
- **NPC mới:** thêm vào `CHARACTERS` (`characters.cjs`) → forge → thêm vào `BaseContent.Roster` + một `DialogueGraph` → `AddNpc` trên map.
- **Bản đồ mới:** viết `XxxMap.Create()` cạnh `AirbaseMap.cs` dùng helper của `MapDef`; thêm check đi lại được vào `WorldChecks`.

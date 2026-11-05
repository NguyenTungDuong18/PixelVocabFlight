# 00 · Bản đồ mã nguồn WORDWING (cho phiên làm việc mới)

> Mục đích: đọc file này là đủ biết game có gì, file nào làm gì, nằm ở đâu, hằng số nào chi phối luật chơi. Chỉ mở source khi cần sửa đúng chỗ đó.
> Trạng thái mô tả: **bản 0.15.0** (smoke 113 check; RulesChecks 47.121 gameplay + căn cứ, 13 interaction, 1.238 manifest). Khi thay đổi lớn, cập nhật lại file này.
> 0.15 thêm **căn cứ đi lại được** (§5.9 World, §8 PixelForge model voxel và nhân vật). Màn hangar cũ (thẻ chiến trường, phím 1–4) đã bị gỡ.
> Số dòng ghi bên cạnh file là để ước lượng; vị trí cụ thể nên tìm bằng Grep theo tên hàm hoặc hằng số.

---

## 1. Game là gì

**WORDWING** là game bắn máy bay pixel art phong cách Thế chiến II (1944), nhìn từ trên xuống, dùng để học từ vựng Oxford 5000.

**Từ 0.15, màn chính là căn cứ** (góc nhìn 3/4 kiểu RPG):
- Phi công 01 đi bằng WASD, giữ Shift để chạy, nhấn E để tương tác.
- Nói chuyện với Giáo sư Whitmore để nhận nhiệm vụ `vocab-sortie` và chọn chiến trường. Lựa chọn "Chọn bộ từ vựng" mở màn chọn từ.
- Ra SKYLARK MK.I ở sân đỗ, nhấn E: hoạt cảnh cất cánh, rồi vào trận.
- Kết quả → VỀ CĂN CỨ → nhiệm vụ hoàn thành.
- Phần bay bên dưới là một nhiệm vụ trong căn cứ.

- Người chơi lái một tiêm kích ở đáy màn hình. Máy bay ném bom địch mang **nghĩa tiếng Việt** của một từ, hiện trên màn CRT của buồng lái.
- Người chơi **gõ từ tiếng Anh** rồi nhấn Enter để bắn hạ máy bay đang là mục tiêu điện đài.
- Có hai chế độ, nhấn **Tab** để đổi:
  - **LÁI:** chuột di chuyển máy bay theo trục X, để nhặt tiếp tế.
  - **BẮN:** gõ chữ vào khe gõ.
- Máy bay địch tuần tra 18 giây rồi khóa mục tiêu 4,5 giây và bắn một loạt đạn **không né được** (−1 GIÁP). Muốn tránh thì phải gõ đúng trước khi hết giờ.
- Trên biển, tàu sân bay địch phóng **tên lửa có 4 đáp án**. Chọn bằng chuột hoặc phím 1–4:
  - Đúng: tên lửa nổ, hạ cả máy bay địch xung quanh.
  - Sai 3 lần: tên lửa khóa mục tiêu, tăng tốc và đâm trúng (−2 GIÁP).
- **Tài nguyên:**
  - **XĂNG** cạn thì kết thúc.
  - **GIÁP** (metal, tối đa 5) về 0 thì rơi máy bay.
  - Nhặt **5 mảnh metal** được **cường hóa** 12 giây: ×1,5 điểm, xăng hao một nửa.
  - Nhặt hộp **ĐỔI NGHĨA** (roll) để đổi sang mục tiêu khác.
- **Chiến trường** đổi mỗi 180 giây theo vòng Rừng → Sa mạc → Băng → Biển, bắt đầu từ vùng đã chọn ở hangar:
  - Rừng: máy bay sinh nhanh hơn 30%.
  - Sa mạc: phải chọn đúng từ loại.
  - Băng: máy bay có khiên, cần bắn 2 phát.
  - Biển: tàu sân bay xuất hiện và phóng tên lửa.
- Kết thúc trận có màn kết quả: điểm, kỷ lục và các từ cần ôn. Phát âm từ vừa hạ bằng file WAV giọng US.

Tên hiển thị: **WORDWING**. Thư mục dự án: `PixelVocabFlight`. Namespace C#: `PixelVocabFlight` (editor: `PixelVocabFlight.Editor`). Giao diện toàn bộ bằng tiếng Việt.

---

## 2. Công nghệ và quy ước cốt lõi

| Mục | Giá trị |
| --- | --- |
| Engine | Unity **6000.6.7f1**, URP 2D (URP 17.6.0) |
| Input | Input System **1.20.1**. Không dùng InputField thật cho khe gõ; ký tự đến từ `Keyboard.onTextInput` |
| UI | uGUI legacy `Text` (ugui 2.6.0). **Toàn bộ UI dựng bằng code** trong `UiKit`/`FlightView`, không có prefab UI |
| Canvas | CanvasScaler, độ phân giải tham chiếu **1440×900**, chế độ Expand |
| Sân chơi | 1360×548 px tại (40,103), có RectMask2D. Tọa độ logic chuẩn hóa 0..1 (`X` theo bề rộng, `Y` từ trên xuống, `PlayerY = .92`) |
| Font | VT323 (`Art/Resources/Fonts/VT323-Regular.ttf`), `UiKit.FontScale = 1.3`, quy đổi bằng `UiKit.Px()` |
| Scene | Chỉ có `Game/Assets/_Project/Scenes/Flight.unity`. `FlightGame` là MonoBehaviour duy nhất điều phối |
| Sprite | PNG từng khung, sinh bằng **PixelForge** (Node.js), nạp bằng `Resources` + `Sprite.Create`, lọc point. Riêng tên kết thúc `_blur` lọc bilinear |
| Dữ liệu | `Resources/oxford-vocabulary.json` (5,5 MB, 5.981 mục), đọc bằng `JsonUtility` |
| Lưu | `Application.persistentDataPath/pilot-profile.json`. Khi chạy smoke test: `qa-profile.json` |

**Nguyên tắc kiến trúc:** toàn bộ luật chơi, bộ đếm thời gian và xác suất nằm trong lớp **thuần C#** `ContinuousFlight` + `FlightProgress` + `GameRules`. Các lớp này không tham chiếu Unity, nên `Tools/RulesChecks` kiểm thử được bằng `dotnet run`. Lớp view chỉ đọc state để vẽ và nhận sự kiện qua `PopEvent()`.

---

## 3. Cây thư mục

```text
PixelVocabFlight/
├─ CLAUDE.md                     ← quy tắc nhanh cho Claude Code (tự nạp)
├─ README.md                     ← mô tả theo phiên bản (đoạn trên cùng = bản mới nhất)
├─ Docs/
│  ├─ 00-Codebase-Map.md         ← FILE NÀY
│  └─ 01..19-*.md                ← lịch sử thiết kế/kiểm tra từng phiên bản (xem §17)
├─ Builds/Windows/Wordwing.exe   ← bản build Windows mới nhất
├─ SourceAssets/                 ← nguồn KHÔNG vào build
│  ├─ PixelArt/Pixel1944/        ← ảnh xem trước (contact sheet) do PixelForge sinh
│  ├─ PixelArt/{Ocean,Prepared,UserSelected,War1944}/ ← ảnh gốc cũ/ảnh người dùng chọn (biển, prompt)
│  ├─ Vocabulary/Oxford/         ← dữ liệu thô Oxford + từ điển (xem §9)
│  ├─ Vocabulary/vocabulary-template.csv
│  └─ Audio/                     ← (trống)
├─ Tools/                        ← công cụ build/test/sinh tài nguyên (xem §12)
└─ Game/                         ← Unity project
   ├─ Packages/manifest.json
   ├─ ProjectSettings/
   └─ Assets/
      ├─ StreamingAssets/Attribution/*.txt   ← giấy phép (VT323 OFL, từ điển ThichHoc, art...)
      └─ _Project/
         ├─ Scenes/Flight.unity
         ├─ Scripts/{Core,UI,Aircraft,Art,Audio,Vocabulary,Persistence,World}/   ← xem §5 (World = căn cứ, thuần C#, §5.9)
         │   (các thư mục Combat, Items, Scoring, Typing tồn tại nhưng TRỐNG)
         ├─ Editor/{PrototypeBuild.cs, SelectedArtImporter.cs}
         ├─ Art/Resources/Pixel/<Group>/<name>_<i>.png + pixel-manifest.json   ← SINH TỰ ĐỘNG
         ├─ Art/Resources/Fonts/VT323-Regular.ttf
         ├─ Art/{Animations,Materials,Sprites/*}   ← trống / không dùng
         ├─ Audio/Pronunciation/US/Resources/Pronunciation/<audioKey>.wav  (4.998 file)
         ├─ Audio/{Music,SFX}              ← trống (âm thanh hiệu ứng tạo bằng code)
         ├─ Data/Vocabulary/Resources/{oxford-vocabulary.json, prototype-vocabulary.json}
         └─ Prefabs/*, UI/Textures         ← trống
```

---

## 4. Kiến trúc runtime và luồng dữ liệu

```text
                ┌───────────────── FlightGame (MonoBehaviour, partial) ─────────────────┐
 Keyboard ────► │ Update(): state machine Mode, phím, gõ chữ, DrainEvents()             │
 (onTextInput)  │ FlightGame.Verification.cs: --smoke-test coroutine                    │
                └──┬───────────────┬──────────────────┬──────────────────┬──────────────┘
                   │ Tick/Submit/  │ đọc state         │ Say/Tone/Engine  │ Save
                   ▼ AnswerMissile ▼                   ▼                  ▼
        ContinuousFlight      FlightView (UI tổng)   FlightAudio      ProfileStore
        ├─ FlightProgress     ├─ header, cockpit,     (AudioSource,   (pilot-profile.json)
        ├─ GameRules          │  hangar, take-off,    clip tạo bằng
        └─ QuestionDeck       │  intro, pause,        code + WAV)
            ▲                 │  results, credits
            │ pool từ         └─ Board = FlightBoardView (sân chơi)
  VocabularyCatalog                ├─ ScrollingTerrain (nền rừng/sa mạc/băng + Wildlife)
  + VocabularyQuery                ├─ OceanBackdrop (nền biển động)
                                   └─ PixelSprites (nạp sprite từ manifest)
```

**Căn cứ (`Mode.Base`, từ 0.15):**
- `FlightGame` giữ `MissionLog`, `BaseWorld` (map `AirbaseMap.Create()`) và `DialogueRunner(BaseContent.Dialogues)`.
- Mỗi khung:
  1. Đọc WASD/mũi tên/Shift → `world.Tick`.
  2. E/Space/Enter → `world.Interact()`.
  3. Rút `WorldEvent`:
     - `DialogueOpened` → `runner.Start(graph, missions.Condition)` và `view.Dialogue`.
     - `BoardAircraft` → kiểm tra bộ từ → `StartingEnvironment = missions.Environment` → `view.BeginTakeOff()`.
     - `Hint` / `ZoneEntered` → HUD.
  4. `view.Base` vẽ.
- Chọn hội thoại: `runner.Choose(i, apply)`. `missions.Apply` xử lý `mission.accept:N` và `mission.cancel`; `vocab.open` → `Mode.Vocabulary`.

**Một khung hình khi đang bay (`Mode.Flying`):**

1. Tab → `ToggleControlMode()`.
2. `flight.MovePlayer(Board.PointerX(...))`.
3. `flight.Tick(dt)`: chia bước tối đa 0,05 giây, gọi `Advance`.
4. `DrainEvents()`: lấy `FlightEvent` ra để phát âm thanh, chạy hiệu ứng của Board và cập nhật dòng tin CRT.
5. `Board.Animate(dt, flight, env)`.
6. Nếu đang BẮN: `HandleEditing` (Backspace giữ lặp, Ctrl+A xóa) và Enter → `Submit()`.
7. Hàng đợi phát âm `speech`.
8. `view.SetInput(typed, focused)` và `view.Refresh(flight)`.

---

## 5. Từng file script (`Game/Assets/_Project/Scripts`, tổng khoảng 3.900 dòng)

### 5.1 `Core/`

#### `FlightGame.cs` (khoảng 565 dòng): bộ điều phối duy nhất

**`enum Mode { Base, Vocabulary, Launching, Intro, Flying, Paused, Dying, Results, Error }`**, `IntroSeconds = 1.4f`. `SetMode()` bật/tắt `view.Base`.

**`Start()`:**
- Đặt 60 FPS.
- Tạo `FlightView`.
- Nhận cờ `--smoke-test`: bật `runInBackground`, thêm thiết bị bàn phím ảo "Wordwing QA keyboard".
- Nạp `VocabularyCatalog` và `ProfileStore`.
- Chuyển hồ sơ cũ sang toàn bộ thư viện một lần (`fullLibraryVersion < 1`).
- Tạo `FlightAudio`.
- Tạo `MissionLog` (nạp `missionsCompleted`/`lastScore` từ hồ sơ), `BaseWorld(AirbaseMap.Create())`, `DialogueRunner`, rồi `EnterBase(title: true)`.
- Lỗi khởi động → `Mode.Error` + `view.ShowError`.

**`Update()` theo Mode:**

| Mode | Việc làm mỗi khung |
| --- | --- |
| Base | Thẻ tiêu đề (phím bất kỳ để ẩn). Nếu hội thoại mở: 1–9, W/S, E/Enter/Space, Esc. Nếu không: WASD/mũi tên + Shift → `world.Tick`, E/Space/Enter → `Interact`, rút `WorldEvent`. Sau khi vào Base, tương tác bị khóa 0,2 giây |
| Vocabulary | Màn chọn từ (`VocabularySetupView`); "XONG" → `FinishVocabulary` (kiểm tra bộ từ) → Base; "<< CĂN CỨ" → Base |
| Launching | `view.AnimateTakeOff(dt)`; trả `true` khi xong → `BeginFlight(launchPool)` |
| Intro | `introTime += min(dt, 1/30)`, `AnimateIntro(t/IntroSeconds)`. **Không Tick mô phỏng** (đồng hồ trận đứng yên). Hết thì `FinishIntro` → Flying |
| Flying | xem §4 |
| Dying | chờ 0,7 giây (`endingTimer`) → `EndFlight()` |
| Results | Enter / nút VỀ CĂN CỨ → `CompleteSortie()`: `missions.Complete(score)`, lưu, về Base đứng ở `AircraftReturn` |
| Esc | Đóng hội thoại ở Base (ở Base không pause). Trong trận `TogglePause()`; pause có thêm "VỀ CĂN CỨ (GIỮ NHIỆM VỤ)". Mất focus cửa sổ cũng tự pause |

**Đã gỡ ở 0.15:** `ReturnToMenu`, `ShowHangar`, `TakeOff`, `StartFlight`, `ChooseStartingEnvironment`, `HandleMenuKeys` (phím 1–4/V/Enter của hangar cũ).

**Gõ chữ (`ReceiveCharacter`):**
- Bỏ qua khi đang giữ Ctrl/Meta.
- **Chữ số 1–4 khi có tên lửa đang mở đáp án** (`Board.OpenMissileId != 0`) → `ChooseMissileAnswer`. Từ Oxford không có chữ số nên không xung đột.
- Chỉ nhận chữ khi đang BẮN và có Target. Ký tự hợp lệ: chữ, số, cách, `-`, `'`, `.`. Tối đa 40 ký tự.

**API công khai mà UI gọi:**
- Căn cứ: `ChooseDialogue(index)`, `ReturnToBase()`, `CompleteSortie()`.
- Từ vựng: `OpenVocabulary` (chỉ từ Base / hội thoại), `ChooseCollection`, `SelectFullOxford`, `ChooseLevel`, `ToggleTopic`, `ChooseRangeSize`, `ApplyMenuSearch`, `ApplyMenuRange`, `ChangePreviewPage`, `ShowVocabularyCredits`, `FinishVocabulary`.
- Bắt đầu trận:
  - `WorldEvent.BoardAircraft`: chuẩn bị pool (lỗi → mở màn chọn từ kèm thông báo), `StartingEnvironment = missions.Environment`, `Mode.Launching`, `audio.Engine()`, `view.BeginTakeOff()`.
  - `BeginFlight(pool)`: tạo `ContinuousFlight(pool, seed, StartingEnvironment)`, `view.BeginIntro`.
- Trong trận: `ToggleControlMode`, `FocusTyping`, `ChooseMissileAnswer(id, choice)` (tự chuyển sang BẮN; sai → `Board.MarkWrongChoice`), `RollMeaning`, `Submit`, `TogglePause`, `ToggleMute`.
- `ValidateFlightPool(pool)` (static): cần ít nhất 4 mục có đáp án phân biệt.

**`DrainEvents()`:** ánh xạ từng `FlightEventKind` sang âm thanh, hiệu ứng và dòng tin CRT:

| Sự kiện | Phản ứng |
| --- | --- |
| Kill | Từ vào hàng phát âm nếu `ShouldPronounce` (chỉ khi người chơi bắn hạ) |
| Wrong / MissileWrong | Ghi vào `mistakes` / `reviewWords` |
| AircraftLock / MissileLock | Tiếng bíp cảnh báo |
| AircraftFire | Tiếng súng, `Board.EnemyFire` |
| MissileBoost | Tiếng tăng tốc |
| Impact | Rung màn hình |

**Khóa kỷ lục:** `"interaction-v3:" + env + ":" + SelectionKey`.

**Hỗ trợ smoke test:** `SmokeType(string)` và `SmokeKey(Key)` bơm phím qua bàn phím ảo.

#### `FlightGame.Verification.cs` (khoảng 290 dòng): smoke test trong bản build

- Coroutine `SmokeTest()` chạy khi có `--smoke-test`, đi qua toàn bộ luồng game và ghi `smoke-report.json` (`version`, `checks[]` dạng `"mô tả:PASS"`) cùng ảnh chụp vào thư mục `--smoke-output`.
- **Helper:**
  - `SmokeFixture(env)`: dựng trận cố định.
  - `SmokeHeal()`: hồi đầy giáp.
  - `SmokeAdvanceSafe(sec)`: tua mô phỏng an toàn.
  - `SmokeClearOtherHazards(missileId)`.
  - `SmokeWatchdog`: hết **120 giây** thì ghi `watchdog-failure.txt` và thoát mã lỗi.
- **Smoke 0.15:** **113 check** (thêm 3 check hoạt cảnh: bước chân khớp khung contact, sprite chạy, bụi).
  - Phần căn cứ: thẻ tiêu đề, nền ghép từ ô readable (mode phải là "cpu"), giữ D đi sang đông, Shift chạy, nhà chặn đường, y-sort trước/sau công trình.
  - Phần tương tác: prompt và hint ở máy bay khi chưa có lệnh, hội thoại giáo sư (chữ chạy, chân dung, lựa chọn, Esc), màn chọn từ → XONG, chuột/S/phím số chọn lựa chọn, nhận nhiệm vụ Sa mạc, lên máy bay → cất cánh → trận đúng chiến trường → kết quả → về căn cứ.
- **Ảnh chụp 0.15 theo thứ tự:**
  - Căn cứ: `00a-base-title`, `00b-base-overview`, `00c-base-walk`, `00c2-base-run`, `00d-professor-dialogue`, `00e-mission-battlefield`, `00f-board-aircraft`, `00g-base-motorpool`, `00h-base-airfield`.
  - Cất cánh: `01c-takeoff-engine-start`, `01d-takeoff-roll-leaving-base`, `01d2-takeoff-jungle-runway`, `01e-liftoff`. Đã bỏ `01-hangar` và `01b-hangar-ocean-selected`.
  - Từ vựng (mở từ giáo sư), vào trận, khe gõ: `02-vocabulary`, `02a-intro-climb`, `02b-cockpit-typing`.
  - Chiến trường, pause, nổ: `03-desert`, `03a-pause`, `03b-explosion`, `04-ice`.
  - Máy bay địch: `05-lock-on`, `05b-homing-burst`, `06-damaged-hull`.
  - Tên lửa: `07a-missile-tags-opening`, `07b-missile-tags-open`, `07c-wrong-answer-red-edges`, `07d-silent-blast`, `08-missile-damage`, `08a-rocket-boost`.
  - Kết quả: `09-results`.
  - Tàu sân bay: `10-carrier-deploying`, `10a-carrier-diagonal`, `10b-carrier-turning`, `11-carrier-exiting`.
  - Về căn cứ: `12-back-at-base`.
- **Khi thêm tính năng:** thêm check ở đây và tăng số kỳ vọng trong README hoặc Docs nếu cần.

#### `ContinuousFlight.cs` (khoảng 580 dòng): mô phỏng thuần, trái tim của luật chơi

**Enum:**
- `FlightEnvironment { Jungle, Desert, Ice, Ocean }`
- `SupplyKind { Fuel, Metal, Roll }`
- `KillSource { PlayerShot, MissileBlast }`
- `CarrierPhase { Entering, Deploying, Turning, Advancing, Exiting }`
- `EnemyPhase { Patrol, Locking, Departing }`
- `MissilePhase { Cruise, Locking, Boost }`
- `FlightEventKind { Spawn, Hit, Kill, Wrong, Retarget, Pickup, MissileBlast, MissileFailure, AircraftImpact, MissileImpact, Evaded, MissileWrong, MissileSolved, AircraftLock, AircraftFire, MissileLock, MissileBoost }`

**Lớp state** (field public, view đọc trực tiếp):

| Lớp | Field quan trọng |
| --- | --- |
| `EnemyState` | `Id, FormationSlot, Entry, X, Y, Age, VelocityX/Y, Phase, LockRemaining, DepartSeconds, FireY, DepartStartSpeed, DepartDirection, Health, Environment`. Thuộc tính tính sẵn: `RequiresPartOfSpeech` (Desert), `Attacking`, `Departing`, `LockProgress` (0→1 trong Locking, 1 khi Departing) |
| `ShotState` | `Id, SourceId, Entry, StartX/Y, X, Y, Age` (âm = chờ bắn trong loạt), `InFlight` |
| `CarrierState` | Vị trí, `HeadingDegrees, DepartureHeading`, các timer, `Phase, ExitDirection`, số máy bay và tên lửa đã phóng |
| `MissileState` | `Id, Choices[4], CorrectIndex, WrongAttempts, Phase, PhaseSeconds`, `Failed` (≥3 lần sai), `Answerable` (= !Failed && Phase != Boost), `Answer` |
| `SupplyState` | `Id, Kind, X, Y, Age` |
| `FlightEvent` | `Kind, Entry, X, Y, Value, EntityId, Source, Supply`, `ShouldPronounce` |

**Hằng số** (đổi luật thì sửa ở đây và chạy lại RulesChecks):

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
| `MissileSpeedFactor` | .8 | Tốc độ bay tầm thường = .035×.8 |
| `MissileTerminalY` | PlayerY − .2 | Tới đây thì tên lửa khóa |
| `MissileLockSeconds` | 1,2 | 0,6 nếu đã sai 3 lần (`MissileFailedLockSeconds`) |
| `MissileBoostSpeed` | 1,6 | Bề rộng sân mỗi giây; nhanh hơn người chơi nên luôn trúng |
| `BlastRadius` | .09 | Bán kính nổ khi trả lời đúng tên lửa |
| `CarrierDeploymentY/ExitY` | .2 / .5 | |
| `CarrierDeploymentDuration` | 20 | Mỗi 12 giây thả một máy bay, mỗi 5 giây có 50% phóng tên lửa |
| `CarrierEntry/Advance/ExitSpeed` | .055 / .03 / .085 | |
| `CarrierRetreatDuration`, `CarrierTurnDuration` | 18, 2,5 | |
| `CarrierLaunchOffsetY` | 88/548 | Điểm phóng tính từ tâm tàu |

**API công khai:**
- `Tick(dt)`, `MovePlayer(x)` (kẹp trong .045..955), `SetDriving(bool)`.
- `Submit(answer, pos)`: sai → `Progress.Wrong` + sự kiện Wrong. Đúng → Hit, Health−−, rồi Kill hoặc Retarget. Máy bay có khiên đang Locking thì vẫn giữ làm mục tiêu.
- `AnswerMissile(id, choice)`: đúng → MissileSolved + MissileBlast, giết mọi địch trong `BlastRadius` (bỏ qua khiên băng, được +25, không phát âm). Sai → MissileWrong, đủ 3 lần thì MissileFailure.
- `Roll()`, `PopEvent()`.
- Thuộc tính: `Enemies, Carriers, Missiles, Supplies, Shots, Target, Driving, PlayerX, Rolls` (khởi đầu 3), `CanRoll, TargetChanges, Environment` (tính từ `ActiveSeconds`), `SpawnInterval, SpawnIn, WaitingForDistinctWord, PlayerLockedOn, ImpactGraceRemaining, Progress`.

**Vòng đời máy bay địch:**

1. **Patrol:**
   - Trượt về X của slot đội hình (`.07 + slot%8 × .122`), 8 slot mỗi hàng.
   - Hạ Y với tốc độ `PatrolSpeed × SpeedMultiplier`, tối đa .56.
   - Khi `Age ≥ 18`: sang Locking, đặt `FireY = clamp(Y + .1, .62, .70)`, phát `AircraftLock`, `Prioritize(enemy)` (thành mục tiêu điện đài).
2. **Locking (4,5 giây):**
   - X trôi về phía người chơi (hệ số .3/s).
   - Y tiến tới `FireY` đúng lúc `LockRemaining` về 0 (chuyển động liên tục, không đứng yên).
   - Hết giờ → `Fire(enemy)`: tạo 3 `ShotState` có Age âm so le, lưu `DepartStartSpeed` và `DepartDirection` (về mép gần), phát `AircraftFire`.
3. **Departing:**
   - Ngoặt theo smoothstep trong 1,1 giây (góc tối đa 1,75 rad).
   - Tốc độ tăng từ `DepartStartSpeed` lên .7 trong 1,2 giây.
   - Ra khỏi sân → `Evaded`.

**Đạn:** nội suy tuyến tính từ điểm bắn tới **vị trí hiện tại** của người chơi trong .42 giây, chạm thì `ImpactDamage(1)` (có grace) → `AircraftImpact`.

**Tên lửa:**
1. **Cruise:** `Aim` lại mỗi bước, nhân `SpeedMultiplier`.
2. Tới `MissileTerminalY` hoặc `Failed` → **Locking:** tốc độ ×.25, kéo dài 1,2 hoặc 0,6 giây.
3. **Boost:** tốc độ tăng dần tới 1,6, lao thẳng vào người chơi. Chạm thì `ImpactDamage(2)` → `MissileImpact`.

**Tàu sân bay:**
1. Entering: tới Y .2.
2. Deploying: 20 giây.
3. Turning: 2,5 giây xoay mũi tại chỗ.
4. Advancing: quỹ đạo `t*t*(2−t)` về mép, Y tới .62.
5. Exiting: khi Y ≥ .5. Ra ngoài X ∉ [−.12, 1.12] thì bị xóa.

**Tiếp tế:**
- Mỗi lần Kill có 10% rơi Fuel hoặc Metal; món này tự bay về người chơi trong 1,2 giây (Fuel +50).
- Mỗi 5 giây có 10% rơi hộp Roll ở hàng trên. Hộp trôi xuống, phải **LÁI** chạm vào mới nhặt được (+1 Rolls).

**Chọn từ:**
- `SpawnAircraft` rút từ "bag" xáo trộn, bỏ qua từ trùng đáp án với máy bay đang có (`QuestionDeck.DistinctAnswers`).
- Không tìm được thì đặt `WaitingForDistinctWord`.

**`Retarget`:** ưu tiên máy bay đang Locking có `LockRemaining` nhỏ nhất; nếu không có thì chọn ngẫu nhiên, khác từ trước đó.

#### `FlightProgress.cs`: tài nguyên và điểm

- **Trạng thái:** `Score, Fuel (0..100), Metal/Health (0..5), Streak, Correct, WrongAttempts, Missed, ActiveSeconds, PowerSeconds, Powered, IsOver`.
- `Tick(dt)`: tăng giờ bay, hao xăng .12/s (một nửa khi Powered), giảm PowerSeconds, xăng hết thì IsOver.
- `ResolveCorrect(word, answerSeconds, window)` → điểm (`GameRules.ScoreFor` × combo × 1,5 nếu Powered), Streak++.
- `ResolveBlastKill()` → +25.
- `Wrong()`: Streak = 0, không trừ giáp.
- `CollectMetal()`: giáp chưa đầy thì +1. Đếm 5 mảnh thì bật Power 12 giây.
- `Damage(n)` → số giáp mất; về 0 thì IsOver.
- `CollectFuel(n)` kẹp ở 100. `Miss()` = Damage(1) và Missed++.

#### `GameRules.cs`

- `SpeedMultiplier(sec)` = 1 + 0,1 mỗi phút tròn, tối đa 1,5.
- `Normalize(s)`: trim, lowercase, gộp khoảng trắng.
- `Matches(answer, entry)`: so khớp chính xác `word` hoặc `acceptedSpellings`, không chấp nhận sai chính tả.
- `ComboMultiplier(streak)`: +0,25 mỗi 5 câu đúng liên tiếp, tối đa ×2.
- `ScoreFor(word, seconds, window, streak, powered)`: (100 + 5·số chữ cái + thưởng tốc độ tới 50) × combo × (1,5 nếu cường hóa). Ví dụ: "apple" trả lời ngay = 175.

### 5.2 `Vocabulary/`

| File | Nội dung |
| --- | --- |
| `VocabularyEntry.cs` | `[Serializable] VocabularyEntry`: `id, word, meaning, partOfSpeech` (tiếng Việt), `topic, acceptedSpellings[], order, pos` (n/v/adj/adv…, dùng cho ô từ loại ở Sa mạc), `cefr` (A1..C1), `oxford3000, topics[], sourceUrl, audioKey, meaningSource, meaningReview, dictionaryId, allMeanings[], ambiguityKeys[], playable`. Kèm `VocabularyFile { entries[], topics[] … }` và `VocabularyTopic { id, name }` |
| `VocabularyCatalog.cs` | Nạp `Resources.Load<TextAsset>("oxford-vocabulary")`, kiểm tra không trùng id, rồi cung cấp `Entries`, `Topics`, `Filter(VocabularyFilter)`, `TopicName(id)` |
| `VocabularyQuery.cs` | `VocabularyFilter { collection = "oxford5000"/"oxford3000", minimumLevel, maximumLevel (0–4 = A1–C1), topics[], search, from, to }`. `VocabularyQuery.Levels`, `Filter` (chỉ `playable`, sắp theo `order`), `Range`, `SelectionKey` (sha256 của danh sách id, dùng làm khóa kỷ lục) |
| `QuestionDeck.cs` | `DistinctAnswers(a, b)`: hai mục không được trùng chữ, chính tả thay thế, nghĩa hoặc `ambiguityKeys` (tránh câu hỏi mơ hồ). `ValidatePool`, `Next` (3 lựa chọn, kiểu cũ) |

### 5.3 `Persistence/ProfileStore.cs`

- `PilotProfile { version = 1, selection (VocabularyFilter), fullLibraryVersion, startingEnvironment, selectionBeforeFullLibrary, bests[] (key/score), words[] (WordRecord thống kê từng từ) }`.
- Hàm: `Best(key)`, `Record(...)`, `RecordBest(key, score)`.
- `Save()` ghi **atomic**: `.tmp` rồi `File.Replace`, giữ `.bak`.
- Đường dẫn `persistentDataPath/pilot-profile.json`; smoke dùng `qa-profile.json` để không đụng hồ sơ thật.

### 5.4 `UI/`

#### `UiKit.cs`: bộ dựng UI bằng code

- **Bảng màu:** `Ink, Panel, Line, Muted, Cream, Mint, Orange, Coral`, `Hex("RRGGBB")`.
- **Font:** `Font` (VT323), `FontScale = 1.3`, `Px(size)`, `Fit(text, min, max)` (best fit).
- **Builder** (tọa độ theo pixel tham chiếu, gốc ở góc trên trái của parent):
  - Khung và nền: `Rect(name, parent, x, y, w, h)`, `Box(...)`, `Slice(...)` (9-slice sprite), `Framed(...)`.
  - Hình: `Sprite(...)`, `Icon(...)`.
  - Chữ: `Label(text, parent, x, y, w, h, size, color, bold, anchor)`.
  - Điều khiển:
    - `Button(text, parent, x, y, w, h, bg, fg, onClick)`: các kiểu olive/gold/cream/red, đổi sprite khi hover hoặc nhấn.
    - `Input(...)`: InputField thật, chỉ dùng ở màn từ vựng.
    - `Select(options, value, ...)`: Dropdown.

#### `FlightView.cs` (khoảng 580 dòng): mọi màn hình ngoài sân chơi

**Cấu trúc:**
- Canvas và header (CanvasGroup: tên bộ từ, điểm, nút pause/mute).
- `Board` (FlightBoardView).
- **Cockpit** (CanvasGroup) tại y = 652 (`CockpitTop`), kích thước 1440×248. Ảnh nền `cockpit_panel` 720×124 vẽ ở tỉ lệ 2×.
- Overlay (pause/kết quả/lỗi) và curtain (màn đen).

**Nội dung cockpit** (tọa độ lấy từ hằng `COCKPIT` trong `ui.cjs` ×2):
- Ba đồng hồ: xăng E–F, tốc độ 100–150%, giờ bay. Kim là sprite `gauge_needle` 48 khung, mỗi khung 7,5°.
- 5 đèn GIÁP: xanh khi ≥4, vàng khi 3, đỏ khi 2, đỏ nhấp nháy khi 1.
- Bảng đồng hiện số giáp, tiếp tế, cường hóa; nút ĐỔI NGHĨA.
- **Màn CRT:** nghĩa tiếng Việt, loại câu hỏi, dòng `recent` (cảnh báo khóa, máy bay vừa hạ), scanline.
- **Khe gõ:**
  - Sprite `ui_input` / `ui_input_focus`.
  - Placeholder `NHẬP ĐỂ BẮN` hiện khi LÁI.
  - **Dấu nháy là một Image riêng**, đặt theo độ rộng chữ đo bằng `TextGenerator` (`MeasureWidth`, dùng ký tự canh "|" để tính cả khoảng trắng cuối). Luôn cách chữ 2 px, nhấp nháy.
- Dropdown từ loại POS (mở lên trên, chỉ bật ở Sa mạc), nút đỏ BẮN [ENTER], cần gạt LÁI/BẮN.

**Hangar cũ đã bị gỡ ở 0.15.** Không còn brand, bảng thẻ chiến trường, dải phím hay phi đội bay ngang. Màn chính giờ là `BaseView` (§5.4b).

**Cất cánh** (`BeginTakeOff`, `AnimateTakeOff(dt) → bool`), được dùng làm cutscene sau khi lên máy bay ở căn cứ:
- `BeginTakeOff()` dựng lại cảnh `title_airbase` + runway + mây + máy bay + tag, mở dần từ màn đen trong 0,45 giây. `AnimateTakeOff` gộp cả phần animate hangar cũ.
- **Hằng số:** `TakeOffSeconds 5.7`, `EngineStartSeconds 1.3`, `RollAcceleration 260`, `FollowAfter 160`, `FollowSeconds 3.6`, `TileHeight 960`.
- **Container `hangarWorld`:** sân bay ở y = 0, `title_runway_edge` ở y = −960, trên đó 3 ô `title_runway_jungle` nối tiếp.
- `launchScroll` là vị trí camera: máy bay lăn, camera bám theo sau khi máy bay đi được 160 px.
- **Diễn biến:**
  - Khói xả sinh trong world space nên ở lại phía sau.
  - Nhấc bánh trong khoảng 3,7–5,0 giây: máy bay to dần, bóng tách xa.
  - Curtain tối dần từ giây 4,7.
- **Lưu ý:** `ClearOverlay` vô hiệu hóa pos/fire/roll và bỏ chọn, để phím Enter ở hangar không mở dropdown.

**Vào trận** (`BeginIntro`, `AnimateIntro(t)`, `FinishIntro`): curtain mở ra, máy bay bay lên từ mép dưới (`Board.IntroLift`), nền mờ dần (`Focus`), header và cockpit fade 0→1.

**Màn khác:** `ShowMenu(catalog, filter, filtered, page, error)` (tạo `VocabularySetupView`, biến `Setup`; chỉ vẽ khi `Mode.Vocabulary`, nút "XONG" và "<< CĂN CỨ"), `ShowCredits`, `ShowPause` (có "VỀ CĂN CỨ (GIỮ NHIỆM VỤ)"), `ShowResults(...)` (nút duy nhất "VỀ CĂN CỨ", đã bỏ BAY LẠI), `ShowError(msg)`, `SetMuted`.

**Mỗi khung khi bay:** `SetInput(value, focused)`, `Refresh(flight)` (đồng hồ, đèn, CRT, nút). Thuộc tính `PartOfSpeechOpen`, `Base` (BaseView), `Dialogue` (DialogueView). `Capture(path)` chụp ảnh cho smoke test.

**Test hook:** `HudAlpha, CurtainAlpha, CaretVisible, PlaceholderVisible, CaretGap, TakeOffElapsed, TakeOffHeroPosition, TakeOffHeroSize, TakeOffSmokePuffs, TakeOffScroll, TakeOffVisible, OverlayVisible, ResultsButton`.

#### 5.4b `BaseView.cs` (khoảng 490 dòng) và `DialogueView.cs` (khoảng 170 dòng): căn cứ (0.15)

**`BaseView`** là con của layout `FlightView`, nằm dưới overlay và curtain.
- **Nền:** ghép một lần thành texture 1152×832 (72×52 ô × 16 px), vẽ ×3 (1 ô = 48 px tham chiếu).
  - Biến thể ô lấy theo `MapDef.TileVariant`; đường băng theo `RunwayVariant`.
  - Đọc pixel bằng CPU (`GetPixels32`, cần `isReadable`; xem `SelectedArtImporter`). Dự phòng bằng `Graphics.CopyTexture`, cuối cùng là màu phẳng.
  - Smoke đọc mode này (phải là "cpu").
- **Vật thể:** mỗi placement là một Image riêng, pivot = anchor của sprite, đặt tại điểm thế giới (X, Y + fh). Hàng rào là sprite `tile_fence` riêng.
- **Y-sort:** xếp tĩnh theo `SortKey`. Nhân vật (người chơi + NPC, mỗi người có `chr_shadow`) được chèn lại mỗi khung theo Y chân; chỉ gọi `SetSiblingIndex` khi thứ tự đổi.
- **Hoạt cảnh nhân vật:** `idle_<dir>` (thở, chớp mắt), `walk_<dir>`, `run_<dir>` khi giữ Shift (thiếu run thì về walk). Giáo sư dùng `chr_professor_talk_s` khi nói.
  - Mỗi actor có `StridePhase` (0..1 chu kỳ). Mỗi khung cộng `delta / Duration(sprite)`, rồi lấy khung `floor(phase × frames)` bằng `PixelSprites.Get`.
  - Đổi walk↔run hoặc đổi hướng thì giữ nguyên phase. Bắt đầu đi thì phase = 0. Dừng thì người chơi reset `IdleTime` (NPC giữ offset riêng).
  - **Khung contact 0 và frames/2:** mỗi lần người chơi chạm đất thì `PlayerSteps++`. `FlightGame` phát `Footstep` khi giá trị này tăng (đã bỏ `stepTimer`).
  - **Bụi `fx_dust`:** sinh khi chạy và chạm đất, khi vừa bắt đầu chạy, hoặc khi quay ngược 180°. Vị trí lệch 0,2 ô về phía sau, nằm ở `shadowLayer`, pool 8 Image. Test hook: `DustPuffs`, `ActiveDust`.
- Radar, cờ, ống gió, khói nhà ăn chạy theo `PixelSprites.At`.
- **Camera:** bám người chơi, kẹp trong map, snap 3 px. Canvas lồng + RectMask2D.
- **HUD:**
  - Bảng nhiệm vụ trên trái, bảng phi công trên phải (số chuyến, điểm gần nhất).
  - Nhãn khu vực, dòng Hint 4,2 giây, prompt `[E] …`, `fx_quest_marker`.
  - Dải phím, thẻ tiêu đề.
- Thiếu sprite thì bỏ qua và ghi `Debug.LogWarning`.

**`DialogueView`:**
- **Hộp:** `ui_panel` tại (40,668), 1360×208.
- **Người nói:** chân dung `portrait_<cid>` 144 px (mấp máy miệng khi chữ chạy), tên viết hoa kèm vai trò.
- **Chữ:** hiện dần 48 ký tự/giây. Phần chưa hiện vẫn chiếm chỗ (trong suốt) nên chữ không nhảy dòng.
- **Lựa chọn:** bảng phía trên bên phải, chỉ hiện khi chữ đã hiện hết.
  - Keycap 1–n; lựa chọn `mission.accept:N` kèm `card_<env>`.
  - Dòng đang chọn dùng `ui_card_selected` + `ui_pointer`. Rê chuột thì đổi dòng chọn, bấm thì gọi `FlightGame.ChooseDialogue`.
- **Âm thanh:** `FlightAudio.Blip(pitch)` khi chữ chạy (giáo sư dùng 0,8), `Footstep(running)` khi đi.

#### `VocabularySetupView.cs` (91 dòng): màn "CHUẨN BỊ ĐIỆN MẬT"

**Cột trái:**
- 01: danh mục OXFORD 5000 / 3000.
- 02: khoảng CEFR, hai Dropdown.
- 03: chủ đề, chọn nhiều (16 chủ đề, trong đó có "Tất cả").
- 04: khoảng thứ tự từ/đến, các nút 20/50/100/TẤT CẢ, nút ÁP DỤNG KHOẢNG.

**Cột phải:**
- Ô tìm kiếm + nút TÌM, số mục khớp, nút TOÀN BỘ OXFORD 5000.
- Bảng xem trước 8 dòng mỗi trang (#, từ/từ loại, CEFR, nghĩa), phân trang `<` `>`.
- Dòng trạng thái và nút CẤT CÁNH (bật khi chọn ≥4 mục; gọi `StartFlight`).

Mọi nút gọi lại API công khai của `FlightGame`.

### 5.5 `Aircraft/FlightBoardView.cs` (khoảng 540 dòng): vẽ sân chơi

**Hằng số:** `Width 1360`, `Height 548`, `ArtScale 2` (mọi sprite vẽ ×2), `GunDeployFrames 9`, `ChoiceWidth 156`, `ChoiceHeight 40`, `ChoiceOpenSeconds .42`.

**Lớp nền:** `ScrollingTerrain` (đất liền) và `OceanBackdrop` (biển), crossfade theo `Environment`. `Focus` điều khiển độ mờ.

**Người chơi:** `fighter_level`, hoặc `fighter_bank_left/right` khi đang di chuyển; bóng `fighter_shadow`; đạn `tracer` và `muzzle_flash` khi bắn.

**Máy bay địch:**
- **Sprite:** `bomber_<env>` (`_damaged` khi khiên băng vỡ), `bomber_<env>_bank_left/right` khi Departing; bóng `bomber_shadow`.
- **Khi khóa:**
  - Overlay `bomber_guns`, khung = `LockProgress × 9`; khung 9–10 là chớp lửa lúc bắn.
  - Thanh khóa và chữ `KHÓA MỤC TIÊU x.xs` dưới nhãn.
  - Thân xoay theo vận tốc; nháy đỏ khi còn 1,5 giây.
- **Nhãn:** chữ nghĩa hoặc mục tiêu trên đầu máy bay; mục tiêu điện đài được làm nổi bật. Ở Băng có `fx_ice_shield`.

**Đạn địch:** `enemy_tracer`. **Thước ngắm** `fx_lock_reticle` (8 khung) khép dần về người chơi khi `PlayerLockedOn`, đỏ nhấp nháy khi khóa xong.

**Tàu sân bay:** `carrier`, `carrier_bow_wave`, `carrier_stern_wake`, xoay theo `HeadingDegrees`; gọi `OceanBackdrop.Wake`.

**Tên lửa:**
- Sprite theo phase: `rocket` (Cruise), `rocket_hot` (Locking, rung), `rocket_boost` (Boost).
- **4 thẻ đáp án:**
  - Mỗi thẻ là một `Button` 156×40 có keycap `ui_keycap` ghi số 1–4.
  - Bật ra từ tâm tên lửa với `EaseOutBack`, lệch pha nhau, xếp 2×2. Gần mép thì dồn hai cột về một phía.
  - `interactable = Answerable && !Wrong`, để thẻ không bị xám lúc đang lớn.
- **Tên lửa được mở đáp án** (`OpenMissileId`): tên lửa đang rê chuột, hoặc tên lửa gần nhất còn trả lời được.
- `MarkWrongChoice` làm thẻ rung, viền đỏ và khóa lại.

**Tiếp tế:** `supply_fuel`, `supply_metal`, `supply_roll`.

**Hiệu ứng:** `Hit`, `Burst` (`fx_explosion`, `fx_spark`, `fx_smoke`), `Impact` (rung màn hình), `Blast` (`fx_shockwave`), `EnemyFire`, `FlashMissile`, `fx_splash` trên biển.

**Hàm khác:** `Animate(dt, flight|null, env)`, `PointerX(current)`, `PointerOverField`, `PointerOverMissile`, `IntroLift(t)`, `Focus` (0 nét → 1 mờ).

**Test accessor:** `EnemyGunsVisible, ReticleSpriteName, VisibleShots, MissileSpriteName, OpenMissileId, MissileChoiceScale, MissileChoiceAnchored, MissileChoicesFullyOpen, VisibleMissilePopupCount, PointerOverMissile, GroundSpriteName, GroundSharpAlpha, Wildlife`.

### 5.6 `Art/`

| File | Nội dung |
| --- | --- |
| `PixelSprites.cs` | Nạp `Resources/Pixel/pixel-manifest.json` (tên, đường dẫn, số khung, kích thước, fps, loop, border). API: `Frames(name)`, `Get(name, i)`, `At(name, time)` (theo fps/loop), `FrameAt`, `Duration`, `Size`, `Texture`, `Has`, `Names`. Sprite tạo bằng `Sprite.Create`, lọc point (bilinear với `_blur`), có cache |
| `ScrollingTerrain.cs` | 4 ô nền dọc (`TileWidth 1360`, `TileHeight 1120` = ảnh 680×560 ×2) cuộn liên tục. Mỗi ô có bản **mờ** (`terrain_<env>_blur`) bên dưới và bản **nét** (`terrain_<env>`) làm con phía trên; `Focus` điều alpha của bản nét. Đổi vùng crossfade 6 giây. Ocean giao cho `OceanBackdrop`. Chứa và cuộn `Wildlife` |
| `Wildlife.cs` | Động vật và phương tiện trôi theo nền. `enum Path { Free, River, Circle }`. Hằng số **phải khớp `terrain.cjs`**: `Art 2, TileRows 560, JungleRoadX 603, DesertPisteX 563, IceRailX 594`; đường sông rừng và băng tính lại bằng cùng công thức với `jungleRiverX`/`iceRiverX`. Actor theo vùng: Rừng có `actor_elephant, egret, sampan, truck_jungle, buffalo`; Sa mạc có `camel, vulture, tank_desert, truck_desert`; Băng có `reindeer, wolf, crow, locomotive + wagon + steam`. Mỗi actor có bản `_blur` |
| `OceanBackdrop.cs` (136 dòng) | Nền biển dùng 3 ảnh biển (`PixelTerrain.Get(Ocean, 0..2)`) crossfade mỗi 30 giây, cộng lớp rộng `OceanWide` (variant 3, lặp ngang) phủ hai bên, RectMask mềm. Có 30 đốm lấp lánh và gợn sóng (`Wake(x, y)`). `AnimationSeconds`, `CurrentImage`. Biển **không mờ** |
| `PixelTerrain.cs` (64 dòng) | Sinh texture ô 384×160 bằng code (bản cũ), cache 7 ô. Hiện chủ yếu dùng cho Ocean variant (OceanBackdrop) và smoke test |

### 5.7 `Audio/FlightAudio.cs`

- Hai AudioSource: giọng đọc và hiệu ứng.
- `Initialize(entries)`; `Say(entry)` → độ dài clip, nạp `Resources/Pronunciation/<audioKey>`, cache tối đa 32 clip.
- **Clip tạo bằng code:**
  - `Tone`: good, wrong, pickup, missileReject.
  - `Engine()`: 5,8 giây, tiếng nổ rời rạc rồi thành tiếng gầm, cao độ tăng dần (`humPhase`).
  - `Beeps`: cảnh báo khóa.
  - `Rattle`: tiếng súng địch; thêm tiếng tăng tốc tên lửa.
- `ToggleMute`, `Muted`, `Stop`.
- **Bộ đếm cho test:** `MissileRejectCount, PronunciationCount, LockWarningCount, EngineStarts`, `BlipCount`, `FootstepCount`.
- 0.15 thêm `Blip(pitch)` (bíp khi chữ hội thoại chạy, cache clip theo cao độ) và `Footstep(running)`.

### 5.8 `Editor/`

| File | Nội dung |
| --- | --- |
| `PrototypeBuild.cs` | `PixelVocabFlight.Editor.PrototypeBuild.BuildWindows`: đọc tham số `-wordwingBuildOutput`, đặt `bundleVersion = "0.15.0"`, gọi `ConfigurePixelArt` (áp cả cấu hình importer, kể cả `isReadable` cho Ground) (yêu cầu ≥300 khung pixel và font VT323, nếu thiếu thì dừng build), rồi build scene Flight ra exe |
| `SelectedArtImporter.cs` | AssetPostprocessor cho thư mục Pixel: lọc point (bilinear với `_blur_`), không nén, max size 2048, không mipmap. Texture mây đặt Repeat. **Đường dẫn chứa `/Ground/` bật `isReadable`** (BaseView ghép nền bằng CPU). `GetVersion() = 2` |

### 5.9 `World/` (0.15): căn cứ, thuần C# (không `UnityEngine`, được link vào RulesChecks)

| File | Nội dung |
| --- | --- |
| `WorldModels.cs` | `Facing {S,E,N,W}`, `Facings` (Delta/Opposite/Toward), `ModelKind`, `ModelDef {Id, Name, Kind, FootW, FootH, Solid, Frames, Group}`. Danh mục **43 model**. `Footprint(m, f)` đổi chỗ W/H ở E/W. `SpriteName(id, f)` = `id_s|e|n|w` |
| `MapDef.cs` | `Ground`, `Placement {Id, Model, Label, Facing, X, Y, Tag}`, `NpcDef`, `MapArea`, `MapDef`: ô nền, biến thể đường băng và hàng rào, placement, NPC, khu vực, spawn, `AircraftReturn*`, `FootprintOf`, `SortKey`, `TileVariant`, `SolidTile`. Có helper dựng map (`FillGround`, `FenceRect`, `OpenGate`, `Add`, `AddIfFree`, `AddNpc`, `AddArea`) |
| `AirbaseMap.cs` | `Create()`: căn cứ 72×52, 283 placement. Spawn (17.5, 28.5) quay N; Giáo sư (17.5, 25) trước `bld_academy`; `skylark` (`air_fighter`, E, 48,19, tag `player-aircraft`); AircraftReturn (50, 23.6) |
| `BaseWorld.cs` | `WalkSpeed 4`, `RunSpeed 6.5` ô/giây; hộp chân ±.3 × ±.18; `InteractRange 1.5`; `ZoneRange 3`. `Tick` (chuẩn hóa đi chéo, trượt dọc tường, chia bước chống xuyên), `Blocked`, `Interact`, `EndDialogue`, `PlacePlayer`, `NearestKind/Id`, `PromptText`, `CurrentZone`, `PopEvent`. `WorldEventKind {DialogueOpened, BoardAircraft, Hint, ZoneEntered}`. NPC đứng yên, khi nói thì quay về phía người chơi |
| `Dialogue.cs` | `DialogueGraph` (bắt đầu ở `"start"`; node không có Text là **router**, tự đi theo lựa chọn hợp lệ đầu tiên), `DialogueChoice {Text, Next, Action, Condition}`, `DialogueRunner` (`Start`, `Text(vars)`, `Choices`, `Choose(i, apply)`, `Close`). `DialogueActions` (`end`, `vocab.open`, `mission.cancel`, `mission.accept:N`), `DialogueConditions` (`mission.active`, `!…`, `completed>0`) |
| `Missions.cs` | `MissionDef`, `MissionLog` (`Active`, `Environment`, `Completed`, `LastScore`, `Accept`, `Cancel`, `Complete`, `Apply(action)`, `Condition(cond)`, `ObjectiveText`). Nhiệm vụ đang nhận **không** được lưu vào hồ sơ |
| `BaseContent.cs` | `PlayerName "Phi công 01"`. Roster 5 NPC: `professor` (Giáo sư Whitmore), `guard` (Lính gác Tâm), `mechanic` (Thợ máy Bảy), `medic` (Y tá Lan), `officer` (Đại tá Phong). Lời thoại, nhiệm vụ `vocab-sortie`, `Variables` ({wordCount}, {lastScore}, {environment}, {completed}), `SpeakerName/SpeakerCharacter` |

`ProfileStore.PilotProfile` có thêm `missionsCompleted` và `lastScore`.

---

## 6. Bảng điều khiển người chơi

| Phím / thao tác | Nơi | Tác dụng |
| --- | --- | --- |
| Phím bất kỳ | Thẻ tiêu đề | Ẩn thẻ |
| WASD / mũi tên, Shift | Căn cứ | Đi / chạy |
| E / Space / Enter | Căn cứ | Tương tác (nói chuyện, lên máy bay) |
| 1–9, W/S ↑/↓, E/Enter/Space, chuột | Hội thoại | Chọn lựa chọn; nếu chữ đang chạy thì hiện hết |
| Esc | Hội thoại | Đóng (ở căn cứ Esc không pause) |
| Enter | Kết quả | VỀ CĂN CỨ (hoàn thành nhiệm vụ) |
| Tab | Trận | Đổi LÁI ↔ BẮN; vào BẮN thì khe gõ có focus ngay |
| Chuột | Trận, LÁI | Di chuyển máy bay theo X |
| Gõ chữ + Enter | Trận, BẮN | Bắn mục tiêu điện đài |
| Backspace (giữ để lặp), Ctrl+A | Trận, BẮN | Sửa chữ |
| 1–4 / bấm thẻ | Khi có tên lửa mở đáp án | Chọn đáp án; tự chuyển sang BẮN |
| Nút ĐỔI NGHĨA | Trận | `Roll()`: tốn 1 lượt, đổi mục tiêu |
| Ô từ loại | Sa mạc | Bắt buộc chọn đúng `pos` |
| Esc | Trận | Pause / tiếp tục |

---

## 7. Dữ liệu từ vựng: nguồn và pipeline

- **Nguồn thô:** `SourceAssets/Vocabulary/Oxford/`
  - `oxford-wordlist.html`, `oxford-index.json`, `dictionary-matches.json`, `dictionary-tree.json`.
  - `spelling-aliases.json`, `curated-overrides.tsv`, `pdf-supplements.json`, `missing-meanings.json`.
  - `coverage-report.json`, `LICENSE-DATA.txt`, `Raw/`.
- **`Tools/Prepare-Oxford-Data.cjs`:** đọc wordlist HTML (từ, từ loại, CEFR, cờ Oxford 3000, URL), có thể fetch từ điển. Kiểm tra ≥5000 mục, CEFR hợp lệ. Ghi index.
- **`Tools/Build-Oxford-Vocabulary.cjs`:** ghép index, từ điển (nghĩa tiếng Việt từ từ điển ThichHoc) và alias, gán 16 chủ đề bằng danh sách từ khóa (food, travel, work, education, technology, health, nature, people, home, clothing, sports, arts, society, feelings, time, general), dịch từ loại sang tiếng Việt. Xuất `Game/Assets/_Project/Data/Vocabulary/Resources/oxford-vocabulary.json`.
- **`Tools/Generate-Pronunciation.ps1`:** dùng System.Speech, giọng **Microsoft David Desktop**, Rate −1, ghi `<audioKey>.wav` vào `Audio/Pronunciation/US/Resources/Pronunciation/`. Bỏ qua file đã có. Tham số `-Prototype` dùng bộ 40 từ.
- **`prototype-vocabulary.json`:** 40 danh từ (24 food, 16 travel). RulesChecks dùng nó để kiểm tra dữ liệu.
- **`Tools/PdfAudit/`** (`extract.mjs`, `reconcile.mjs`): đối chiếu với PDF Oxford để tạo `pdf-supplements.json`.

---

## 8. Pixel art: PixelForge

**Lệnh:** `node Tools/PixelForge/forge.cjs`, chạy từ thư mục gốc dự án. Cần `sharp`, được nạp từ `Tools/ArtImport/node_modules/sharp`.

**Đầu ra:**
- `Game/Assets/_Project/Art/Resources/Pixel/<Group>/<name>_<i>.png`.
- `pixel-manifest.json`: `{version: "0.15.0", sprites: [{name, path, frames, width, height, fps, loop, border, anchorX, anchorY, footW, footH}]}`. Hiện có **385 animation / 1.257 khung**. Forge chạy khoảng 30 giây; nếu gặp `EBUSY` thì có tiến trình khác đang mở PNG, chạy lại sau.
- `anchorX/anchorY`: góc dưới trái chân đế (model) hoặc điểm chân (nhân vật), tính theo **mép pixel**. Chân đế chiếm x ∈ [anchorX, anchorX + footW·16), y ∈ [anchorY − footH·16, anchorY). Pivot trong Unity = (anchorX/w, (h − anchorY)/h). `footW/footH` tính theo hướng của chính sprite. Sprite không có các giá trị này thì ghi 0.
- Contact sheet trong `SourceAssets/PixelArt/Pixel1944/preview-*.png`.

**Cách dọn khi sinh lại:** forge xóa mọi PNG cũ, nhưng **giữ `.meta`** của khung vẫn còn được sinh (GUID ổn định). `.meta` của khung không còn sinh thì bị xóa.

| File | Vai trò |
| --- | --- |
| `forge.cjs` | Điểm vào. Hàm `add(group, name, frames, {fps, loop, border, anchor, foot})` kiểm tra trùng tên, cùng kích thước khung, và chân đế phải nằm trong sprite. `buildUnits()` → `UI.build` → `T.build` → `RW.build` → `C.build` (characters) → `G.build` (ground) → `W.build` (world). Ghi `preview-world-{buildings,props,vehicles,aircraft}.png` (4 hướng, lưới 16 px, chân đế tô sáng) và gọi `writePreviews` của C/G. `VERSION` |
| `voxel.cjs` (0.15) | Bộ dựng voxel: 1 voxel = 1 px, x đông, y nam, z lên, mặt trước = +y. Primitive box/cyl/cone/ellipsoid/vault/mái hai dốc/hip/pyramid/line, khoét cửa, decal chữ. Vật liệu có texture. Chiếu xiên `screenX = x, screenY = y − z` có z-buffer, ánh sáng trên-trái, dither Bayer, bóng tự đổ, viền, bóng đổ mềm. Quay thật 90° quanh z ra 4 hướng |
| `world.cjs` (0.15) | **43 model độc lập**: `def(id, group, foot, height, build, {frames, fps, animated, overlay, margin})`. Export `build(add)`, `MODELS`, `renderModel`. Cờ, ống gió, khói luôn bay sang phải màn hình ở mọi hướng |
| `characters.cjs` (0.15) | **Rig nhân vật chung** (`CHARACTERS`: skin, hair, hairStyle, top/topStyle, pants, shoes, hat, held, glasses, goggles, scarf, medals, portrait…). 6 nhân vật × 4 hướng (W lật từ E) × idle 8 khung @5 (thở, chớp mắt ở khung 6) / walk 8 @16 / run 8 @20. Walk và run có contact ở khung 0 và 4, run nghiêng người và có khung bay. Pose tách các offset `bob` (thân), `head` (trễ 1 khung), `chest`, `lean`, `blink`; khăn pilot bay theo. `chr_professor_talk_s`, `fx_dust` (Effects, 16×8, anchor 8,7, 5 khung @14, không lặp), `chr_shadow`, `fx_quest_marker`, `portrait_<cid>` 48×48. `writePreviews` |
| `ground.cjs` (0.15) | Ô 16×16 lát liền: `tile_grass/dirt/concrete/asphalt` (4 biến thể), `tile_sand` (2), `tile_runway` (5: trơn, vạch giữa **sát mép phải ô** — `AirbaseMap` đặt ở cột ngay trái tâm đường băng rộng 6 ô, mép trái, mép phải, ngưỡng), `tile_water` (4), `tile_fence` 16×24 anchor (0,24) (7: ngang, dọc, TL, TR, BL, BR, cột cổng). `writePreviews` (ô thử ghép) |
| `lib.cjs` (166) | `Canvas` (put/rect/blit/scaled/silhouette/fill/png), bảng màu `PAL` (các dải OL olive, CR cream, GD gold, ST steel, GL glass, RD red, WD wood, NV navy, FI fire, SM smoke, GR grass, SN sand, SW snow, IC ice, WT water), `hex`, nhiễu `hash/noise/fbm/tileFbm`, `dither`, font pixel `FONT5/text5` |
| `units.cjs` (507) | Tiêm kích, bomber 4 livery (thường/damaged/bank), `bomberGunFrames` (11 khung: 9 thò súng + 2 chớp lửa), tàu sân bay và sóng, rocket/hot/boost, tracer, enemy_tracer, muzzle, tiếp tế, hiệu ứng nổ/khói/tia lửa/sóng xung kích/khiên băng/bắn nước, `fx_lock_reticle` |
| `ui.cjs` (384) | Panel, nút (olive/gold/cream/red), ô, đèn, keycap, icon, logo, thẻ chiến trường `card_*`, `title_airbase` (đã bỏ ngưỡng đường băng phía trên để nối với runway), `title_clouds`, **`cockpit_panel` theo hằng `COCKPIT`**, `gauge_needle`, `ui_lever`, `ui_input(_focus)`, `ui_scanline`, `ui_pointer` |
| `terrain.cjs` (500) | Ô `terrain_jungle/desert/ice` 680×560 và bản `_blur` (3 lượt box blur, giảm bão hòa, tối nhẹ). Actor wildlife. Export `build, jungleRiverX, iceRiverX, TW, TH, PAD, Wrap, crown, palm, hut, crater` |
| `runway.cjs` (188) | `title_runway_jungle` (ô lặp liền: rừng, suối chảy qua cống, cọ) và `title_runway_edge` (bìa rừng, hàng rào ở dòng 146, barie, chốt gác, ụ bao cát, xe tải, thùng, hố pháo cao xạ, lều, phuy, xe jeep; vai đường hòa vào sân bay bằng `shoulderTo 150`). Hình học đường băng: x 140–185, vạch giữa mỗi 16 dòng, đèn ở x 139/186 |

**Nhóm sprite hiện có:**
- **Aircraft:**
  - Tiêm kích: `fighter_level`, `fighter_bank_left/right`, `fighter_shadow`.
  - Bomber: `bomber_{jungle,desert,ice,ocean}`, mỗi livery có thêm `_damaged`, `_bank_left`, `_bank_right`.
  - Phụ: `bomber_shadow`, `bomber_guns`.
- **Weapons:** `rocket`, `rocket_hot`, `rocket_boost`, `tracer`, `enemy_tracer`, `muzzle_flash`.
- **Naval:** `carrier`, `carrier_bow_wave`, `carrier_stern_wake`.
- **Supplies:** `supply_fuel`, `supply_metal`, `supply_roll`.
- **Effects:** `fx_explosion`, `fx_spark`, `fx_smoke`, `fx_shockwave`, `fx_ice_shield`, `fx_splash`, `fx_lock_reticle`.
- **Terrain:** `terrain_{jungle,desert,ice}` cùng bản `_blur`.
- **Wildlife:** `actor_{buffalo,camel,crow,egret,elephant,locomotive,reindeer,sampan,steam,tank_desert,truck_desert,truck_jungle,vulture,wagon,wolf}` cùng bản `_blur`.
- **Title:** `title_airbase`, `title_clouds`, `title_runway_edge`, `title_runway_jungle`, `logo`, `card_{jungle,desert,ice,ocean}`.
- **UI:**
  - Khung: `cockpit_panel`, `ui_panel`, `ui_card(_selected)`, `ui_plate`, `ui_ink`.
  - Nút và điều khiển: `ui_button_{olive,gold,cream,red}`, `ui_keycap`, `ui_lever`, `ui_input(_focus)`.
  - Đồng hồ và đèn: `gauge_needle`, `ui_lamp_{off,green,amber,red}`, `ui_cell_{empty,low,full}`.
  - Khác: `ui_scanline`, `ui_pointer`.
  - Icon: `icon_{armor,arrow_left,arrow_right,check,clock,fuel,medal,pause,radio,sound_off,sound_on,speed,target}`.
- **World / Vehicles / Aircraft (0.15, model 4 hướng `_s/_e/_n/_w`):**
  - `bld_*` ×18, `prop_*` ×15 (group World).
  - `veh_*` ×7 (group Vehicles).
  - `air_fighter`, `air_transport`, `air_bomber_enemy` (group Aircraft).
  - Danh sách đầy đủ ở `WorldModels.cs` / `Docs/20-Military-Base.md`.
- **Characters:** `chr_<pilot|professor|guard|mechanic|medic|officer>_<idle|walk|run>_<s|e|n|w>`, `chr_professor_talk_s`, `chr_shadow`.
- **Portraits:** `portrait_<cid>`.
- **Ground:** `tile_*`.
- **Effects:** thêm `fx_quest_marker`, `fx_dust`.

**Thêm model mới cho bản đồ:**
1. Thêm công thức `def(...)` trong `world.cjs`, chạy forge.
2. Thêm `ModelDef` cùng id và cùng chân đế trong `WorldModels.cs`.
3. Đặt vào map bằng `Add(...)`.
4. RulesChecks (nhóm manifest) sẽ báo nếu thiếu hướng hoặc lệch chân đế.

**Thêm NPC mới:**
1. Thêm tham số vào `CHARACTERS` (`characters.cjs`), chạy forge.
2. Thêm vào `BaseContent.Roster` + một `DialogueGraph`, rồi `AddNpc` trên map.

**Thêm sprite mới:**
1. Viết hàm vẽ trong file `.cjs` phù hợp, rồi `add('Group', 'name', frames, {fps, loop})`.
2. Chạy forge. Trong C# dùng `PixelSprites.At("name", time)` hoặc `Get("name", i)`.
3. Unity tự import theo `SelectedArtImporter`.

---

## 9. Hằng số phải đồng bộ giữa JS (ảnh) và C# (code)

| Nội dung | JS | C# |
| --- | --- | --- |
| Bố cục cockpit (vị trí đồng hồ, đèn, CRT, khe gõ, POS, nút bắn, cần gạt) | `COCKPIT` trong `ui.cjs` (pixel ảnh 720×124) | `FlightView` (×2, gốc tại `CockpitTop = 652`) |
| Đường sông/đường xe/đường ray trên ô nền | `terrain.cjs` (`jungleRiverX`, `iceRiverX`, tọa độ đường) | `Wildlife.cs` (`JungleRoadX 603, DesertPisteX 563, IceRailX 594`, công thức sông) |
| Kích thước ô nền | `TW 680`, `TH 560` | `ScrollingTerrain.TileWidth 1360 / TileHeight 1120`, `Wildlife.TileRows 560` |
| Đường băng cất cánh | `runway.cjs` (x 140–185, ô cao 480 px ảnh) | `FlightView.TileHeight 960`, vị trí xếp ô trong `hangarWorld` |
| Số khung súng | `bomberGunFrames` (9 + 2) | `FlightBoardView.GunDeployFrames = 9` |
| Số khung kim đồng hồ | `gauge_needle` 48 khung | `FlightView` (7,5° mỗi khung) |
| Chân đế model (ô, hướng S) | `world.cjs` `def(id, group, foot, …)` → manifest `footW/footH` | `WorldModels.cs` `FootW/FootH` (RulesChecks đối chiếu) |
| Kích thước ô thế giới | 16 px ảnh (`voxel.cjs`, `ground.cjs`) | `BaseView` ×3 = 48 px tham chiếu |
| Khung nhân vật | 24×32, anchor (12,30), idle 8 / walk 8 / run 8 khung, contact ở khung 0 và 4 | `BaseView` (đọc số khung và fps từ manifest), RulesChecks |
| Phiên bản | `forge.cjs VERSION` (0.15.0) | `PrototypeBuild` bundleVersion, `smoke-report.json` version |

---

## 10. Build và kiểm thử

Chạy từ thư mục gốc `C:\Users\Admin\Downloads\PixelVocabFlight`.

| Lệnh | Thời gian | Kiểm tra gì |
| --- | --- | --- |
| `node Tools/PixelForge/forge.cjs` | Vài giây | Sinh lại toàn bộ sprite |
| `dotnet build Tools/UnityCompileChecks` | Khoảng 10 giây | Biên dịch mọi `.cs` trong Scripts + Editor với DLL Unity. Phải được **0 lỗi / 0 cảnh báo** |
| `cd Tools/RulesChecks && dotnet run` | Khoảng 30 giây | Kiểm thử logic thuần. In ra 13 interaction, 16.572 walkable base, 47.121 gameplay/Oxford/căn cứ, 1.238 world sprite manifest |
| `powershell -File Tools/Build-Windows.ps1` | **Khoảng 10 phút** | Sao chép `Game/{Assets,Packages,ProjectSettings}` sang `Tools/BuildWorkspace/Game`, build batchmode, ghi `Builds/Windows/Wordwing.exe`, log `Tools/unity-build-isolated.log`. Sau đó chép ngược `.meta` mới, scene và settings nếu nguồn không đổi trong lúc build |
| `powershell -File Tools/Test-Windows.ps1 -OutputFolder Smoke-X` | Khoảng 1 phút | Chạy exe với `--smoke-test` ở 1280×800, đọc `Tools/Smoke-X/smoke-report.json`, báo lỗi nếu có check không PASS. Ảnh và `player.log` nằm cùng thư mục |

**RulesChecks** (`Tools/RulesChecks/`):
- `Program.cs`: GameRules, FlightProgress, dữ liệu prototype/Oxford.
- `CombatChecks.cs` (230 dòng): ContinuousFlight, gồm khóa, bắn, rời đi, tên lửa, tàu và nổ.
- `InteractionChecks.cs` (63 dòng).
- `WorldChecks.cs` (0.15):
  - `Run()` kiểm tra bản đồ: trong bounds, không chồng, hàng rào/cổng/đường băng; BFS từ spawn tới mọi NPC và máy bay; mô phỏng đi bộ thật.
  - Kiểm tra va chạm, đi chéo, chạy, tương tác, toàn bộ luồng hội thoại và nhiệm vụ.
  - `RunManifest(path)` đối chiếu `pixel-manifest.json`: đủ 4 hướng, `footW/footH`, số khung, anchor trong sprite, `anchorX + footW·16 ≤ width`, nhân vật, chân dung, `tile_*`, version.
- `RulesChecks.csproj` (net8.0) link trực tiếp các file thuần của game: `GameRules.cs`, `FlightProgress.cs`, `ContinuousFlight.cs`, `VocabularyEntry.cs`, `VocabularyQuery.cs`, `QuestionDeck.cs` và 7 file `World/*.cs`. **File mới mà RulesChecks cần thì phải thêm vào csproj này**, và file đó không được dùng `UnityEngine`.

**UnityCompileChecks** include `Scripts/**/*.cs` và `Editor/**/*.cs`, tham chiếu DLL trong `$(UnityEditorPath)/Data/Managed` và `Game/Library/ScriptAssemblies` (URP, InputSystem, UI). Vì vậy cần Unity đã mở hoặc build project ít nhất một lần để có `Library`.

**Thứ tự kiểm tra chuẩn sau khi sửa:** forge (nếu đổi ảnh) → compile check → RulesChecks → Build → Test. Sau đó xem ảnh smoke bằng Read để soát hình.

---

## 11. Bẫy và kinh nghiệm (đọc trước khi sửa)

**Môi trường shell:**
- **Bash heredoc (`<<EOF`) bị lỗi** trong môi trường này. Muốn ghi file thì dùng tool Write; muốn chạy script phức tạp thì viết `.cjs` vào scratchpad rồi `node file.cjs`.
- **Backtick trong `node -e` dưới bash bị hỏng.** Tránh template string trong `-e`.
- **Không có Python.** Dùng Node (có `sharp`) để xử lý ảnh, ghép hoặc cắt screenshot.

**Smoke test:**
- **Thư mục smoke không tự dọn.** Xóa hoặc dùng thư mục mới trước khi chạy, nếu không file cũ như `watchdog-failure.txt` sẽ gây nhầm.
- Check nào lấy mẫu hoạt cảnh thì phải `yield` ít nhất một khung sau khi bắt đầu, và nên **poll tới điều kiện** thay vì chờ cứng (máy chậm, khung đầu sau load bị khựng).
- Test tên lửa phải reset `Phase = Cruise, PhaseSeconds = 0, WrongAttempts = 0`, rồi Tick .01 trước khi đo vị trí thẻ, nếu không sẽ gặp `KeyNotFoundException` vì tên lửa đã sang Locking/Boost.

**Hành vi game cần giữ:**
- `IntroSeconds` cộng bằng `min(dt, 1/30)` để khựng sau load không làm mất hoạt cảnh vào trận.
- Ở menu, Enter có thể kích hoạt control UI đang được chọn. `ClearOverlay` phải bỏ chọn và tắt `interactable` của pos/fire/roll.
- Căn cứ: E/Enter vừa là phím tương tác vừa là phím xác nhận hội thoại. Sau khi vào Base, tương tác bị khóa 0,2 giây để Enter ở màn kết quả không mở hội thoại ngay. Smoke phải chờ qua khoảng khóa này.
- Nền căn cứ cần texture Ground **readable**. Nếu sửa `SelectedArtImporter` thì tăng `GetVersion()` để Unity import lại.
- Scratchpad dùng chung giữa các agent chạy song song. Đặt tên thư mục riêng để không ghi đè lẫn nhau.
- Thẻ tên lửa: không được đặt `interactable = false` trong lúc lớn (sẽ hiện sprite xám); dùng `Answerable && !Wrong`.
- Digit 1–4 luôn ưu tiên chọn đáp án tên lửa khi có tên lửa mở.

**Kiến trúc:**
- Logic mới đặt trong `ContinuousFlight`/`FlightProgress` (không dùng `UnityEngine`) để RulesChecks test được. View chỉ đọc state.
- Thư mục `Scripts/{Combat,Items,Scoring,Typing}` và `Prefabs/*` trống. Đừng tìm code ở đó.
- `Tools/apply-war-*.cjs`, `refine-war-visuals.cjs` và `SourceAssets/PixelArt/War1944` là di sản 0.12 (art cũ), không còn dùng trong pipeline.
- `Tools/Smoke-*` là kết quả chạy các bản cũ. Bản mới nhất là `Tools/Smoke-Anim2-0.15`.

**Quy ước làm việc với người dùng:**
- Báo cáo bằng **tiếng Việt**.
- **Không commit** nếu người dùng chưa yêu cầu.

---

## 12. Công cụ khác trong `Tools/`

| Mục | Ghi chú |
| --- | --- |
| `ArtImport/` | Chỉ để có `node_modules/sharp` |
| `BuildWorkspace/Game` | Bản sao project dùng để build (bị ghi đè mỗi lần build); không sửa ở đây |
| `UnityCompileChecks/` | csproj biên dịch kiểm tra (DLL Unity trong thư mục cài editor + `Game/Library/ScriptAssemblies`) |
| `PdfAudit/` | `extract.mjs` trích văn bản PDF Oxford 3000/5000 chính thức; `reconcile.mjs` đối chiếu với `oxford-index.json` để tìm mục thiếu hoặc lệch (Node, có node_modules riêng) |
| `*.log` | Log build/smoke cũ |

---

## 13. Công thức sửa thường gặp

- **Đổi luật hoặc thời gian đòn đánh:**
  1. Sửa hằng hoặc nhánh trong `ContinuousFlight.Advance`.
  2. Cập nhật kỳ vọng trong `Tools/RulesChecks/CombatChecks.cs`.
  3. Nếu ảnh hưởng hình ảnh, kiểm tra `FlightBoardView` (ví dụ `LockProgress` điều khiển súng).
  4. Chạy smoke.
- **Thêm sự kiện gameplay:**
  1. Thêm giá trị vào `FlightEventKind`, gọi `Emit(...)` trong mô phỏng.
  2. Xử lý trong `FlightGame.DrainEvents` (âm thanh, hiệu ứng, CRT).
  3. Thêm check vào Verification.
- **Thêm chiến trường hoặc actor:**
  1. Vẽ trong `terrain.cjs` (ô + `_blur`, actor + `_blur`), chạy forge.
  2. Thêm vào bảng actor trong `Wildlife.cs`, đồng bộ tọa độ đường hoặc sông.
  3. Với vùng mới, phải sửa enum `FlightEnvironment` và mọi chỗ `% 4`.
- **Sửa cockpit:**
  1. Sửa `COCKPIT` và vẽ trong `ui.cjs`.
  2. Sửa tọa độ tương ứng ×2 trong `FlightView`.
  3. Chạy forge, build, xem ảnh `02b-cockpit-typing`.
- **Sửa hoạt cảnh cất cánh:**
  1. Ảnh nằm trong `runway.cjs` / `ui.cjs` (`title_airbase`).
  2. Thời gian nằm ở các hằng của `FlightView` (§5.4).
  3. Kiểm tra bằng ảnh `01c`…`01e`.
- **Đổi dữ liệu từ:**
  1. Sửa nguồn trong `SourceAssets/Vocabulary/Oxford`, chạy `node Tools/Build-Oxford-Vocabulary.cjs`.
  2. Chạy `Generate-Pronunciation.ps1` nếu có từ mới.
  3. Chạy RulesChecks (kiểm tra dữ liệu).
- **Lên phiên bản:**
  1. Đổi version ở `forge.cjs`, `PrototypeBuild.cs` và Verification (`smoke-report`).
  2. Thêm `Docs/NN-*.md`, đoạn đầu README, rồi cập nhật file này.

---

## 14. Lịch sử phiên bản (Docs)

| File | Nội dung |
| --- | --- |
| 01-Game-Plan | Ý tưởng và luật ban đầu |
| 02-Folder-Structure | Cấu trúc thư mục ban đầu |
| 03-Getting-Started | Mở project bằng Unity Hub |
| 04-Asset-Sources | Nguồn tài nguyên và giấy phép |
| 05-Prototype-0.1 | Bản mẫu đầu tiên |
| 06-Validation | Kiểm tra bản mẫu |
| 07-Oxford-Library / 08-Oxford-Validation / 09-Full-Oxford-5000 | Thư viện Oxford, bộ lọc, đủ 5.981 mục |
| 10-Continuous-Flight | Chuyển sang dòng máy bay liên tục (`ContinuousFlight`) |
| 11-Metal-Health | Metal = giáp, cường hóa |
| 12-Missile-Hover-and-Audio | Tên lửa 4 đáp án, rê chuột, âm thanh |
| 13-Player-and-Carrier-Art / 14-Carrier-Route-and-Transparent-Sprites | Art người chơi/tàu, lộ trình tàu |
| 15-Ocean-Background-and-Smooth-Departure / 16-Carrier-Heading-and-Ocean-Scale | Nền biển, tàu xoay mũi (0.10) |
| 17-Interaction-Polish | Đánh bóng tương tác |
| 18-Pixel-Art-1944 | 0.13: PixelForge, art 1944, hangar mới (54/54 smoke) |
| 19-Cockpit-Lock-On-Blur | 0.14: buồng lái, khóa mục tiêu không né được, nền mờ và wildlife, cất cánh và vào trận (72/72 smoke) |
| 20-Military-Base | 0.15: căn cứ đi lại được (WASD), 43 model voxel 4 hướng, rig nhân vật, NPC, hội thoại, nhiệm vụ từ Giáo sư Whitmore (110 smoke) |

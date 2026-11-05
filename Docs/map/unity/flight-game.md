# FlightGame: bộ điều phối duy nhất

Code: thư mục `Scripts/Unity/Game/FlightGame/` (partial class; scene gắn MonoBehaviour qua GUID của `FlightGame.cs`, nên file chính phải giữ tên và `.meta`):

- `FlightGame.cs`: field, `Start`, `OnDestroy`, `SetMode`, phím, `Update`.
- `FlightGame.Base.cs`: đi lại, hội thoại, nhiệm vụ, `ReturnToBase`/`EnterBase`.
- `FlightGame.Vocabulary.cs`: màn chọn bộ từ, `PrepareFlightPool`.
- `FlightGame.Sortie.cs`: `BoardAircraft`, `BeginFlight`, `CompleteSortie`, gõ/bắn, tên lửa, roll, `TogglePause`, `ToggleMute`, `EndFlight`.
- `FlightGame.Events.cs`: `DrainEvents` (FlightEvent → view/âm thanh).
- Smoke: `FlightGame.Verification.cs` + `FlightGame.Smoke.*.cs` (`smoke-test.md`). Luồng một khung: `overview/runtime.md`.

**`enum Mode { Base, Vocabulary, Launching, Intro, Flying, Paused, Dying, Results, Error }`**, `IntroSeconds = 1.4f`. `SetMode()` bật/tắt `view.Base`.

## `Start()`

Đặt 60 FPS → tạo `FlightView` → cờ `--smoke-test` (bật `runInBackground`, thêm bàn phím ảo "Wordwing QA keyboard") → nạp `VocabularyCatalog`, `ProfileStore` → chuyển hồ sơ cũ sang toàn bộ thư viện một lần (`fullLibraryVersion < 1`) → tạo `FlightAudio` → `MissionLog` (nạp `missionsCompleted`/`lastScore`), `BaseWorld(AirbaseMap.Create())`, `DialogueRunner` → `EnterBase(title: true)`. Lỗi → `Mode.Error` + `view.ShowError`.

## `Update()` theo Mode

| Mode | Việc làm mỗi khung |
| --- | --- |
| Base | Thẻ tiêu đề (phím bất kỳ để ẩn). Hội thoại mở: 1–9, W/S, E/Enter/Space, Esc. Không: WASD/mũi tên + Shift → `world.Tick`, E/Space/Enter → `Interact`, rút `WorldEvent`. Sau khi vào Base, tương tác khóa 0,2 giây |
| Vocabulary | `VocabularySetupView`; "XONG" → `FinishVocabulary` (kiểm tra bộ từ) → Base; "<< CĂN CỨ" → Base |
| Launching | `view.AnimateTakeOff(dt)`; `true` khi xong → `BeginFlight(launchPool)` |
| Intro | `introTime += min(dt, 1/30)`, `AnimateIntro(t/IntroSeconds)`. **Không Tick mô phỏng**. Hết → `FinishIntro` → Flying |
| Flying | xem `overview/runtime.md` |
| Dying | chờ 0,7 giây (`endingTimer`) → `EndFlight()` |
| Results | Enter / VỀ CĂN CỨ → `CompleteSortie()`: `missions.Complete(score)`, lưu, về Base đứng ở `AircraftReturn` |
| Esc | Đóng hội thoại ở Base (Base không pause). Trong trận `TogglePause()`; pause có "VỀ CĂN CỨ (GIỮ NHIỆM VỤ)". Mất focus cửa sổ cũng tự pause |

## Gõ chữ (`ReceiveCharacter`)

- Bỏ qua khi giữ Ctrl/Meta.
- **Chữ số 1–4 khi có tên lửa mở đáp án** (`Board.OpenMissileId != 0`) → `ChooseMissileAnswer` (từ Oxford không có chữ số).
- Chỉ nhận chữ khi đang BẮN và có Target. Ký tự hợp lệ: chữ, số, cách, `-`, `'`, `.`. Tối đa 40.

## API công khai UI gọi

- Căn cứ: `ChooseDialogue(index)`, `ReturnToBase()`, `CompleteSortie()`.
- Từ vựng: `OpenVocabulary`, `ChooseCollection`, `SelectFullOxford`, `ChooseLevel`, `ToggleTopic`, `ChooseRangeSize`, `ApplyMenuSearch`, `ApplyMenuRange`, `ChangePreviewPage`, `ShowVocabularyCredits`, `FinishVocabulary`.
- Bắt đầu trận: `WorldEvent.BoardAircraft` → chuẩn bị pool (lỗi → mở màn chọn từ), `StartingEnvironment = missions.Environment`, `Mode.Launching`, `audio.Engine()`, `view.BeginTakeOff()`. `BeginFlight(pool)` → `ContinuousFlight(pool, seed, StartingEnvironment)`, `view.BeginIntro`.
- Trong trận: `ToggleControlMode`, `FocusTyping`, `ChooseMissileAnswer(id, choice)` (tự sang BẮN; sai → `Board.MarkWrongChoice`), `RollMeaning`, `Submit`, `TogglePause`, `ToggleMute`.
- `ValidateFlightPool(pool)` (static): cần ít nhất 4 mục có đáp án phân biệt.

## `DrainEvents()`

| Sự kiện | Phản ứng |
| --- | --- |
| Kill | Từ vào hàng phát âm nếu `ShouldPronounce` (chỉ khi người chơi bắn hạ) |
| Wrong / MissileWrong | Ghi vào `mistakes` / `reviewWords` |
| AircraftLock / MissileLock | Bíp cảnh báo |
| AircraftFire | Tiếng súng, `Board.EnemyFire` |
| MissileBoost | Tiếng tăng tốc |
| Impact | Rung màn hình |

Khóa kỷ lục: `"interaction-v3:" + env + ":" + SelectionKey`. Smoke: `SmokeType(string)`, `SmokeKey(Key)` bơm phím qua bàn phím ảo.

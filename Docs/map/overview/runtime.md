# Kiến trúc runtime: ai gọi ai, một khung hình

```text
                ┌───────────────── FlightGame (Unity/Game, MonoBehaviour, partial) ─────┐
 Keyboard ────► │ Update(): state machine Mode, phím, gõ chữ, DrainEvents()             │
 (onTextInput)  │ FlightGame.Smoke.*.cs: --smoke-test coroutines                        │
                └──┬───────────────┬──────────────────┬──────────────────┬──────────────┘
                   │ Tick/Submit/  │ đọc state         │ Say/Tone/Engine  │ Save
                   ▼ AnswerMissile ▼                   ▼                  ▼
        ContinuousFlight      FlightView (UI tổng)   FlightAudio      ProfileStore
        ├─ FlightProgress     ├─ header, cockpit,     (AudioSource,   (pilot-profile.json)
        ├─ GameRules          │  take-off, intro,     clip tạo bằng
        └─ QuestionDeck       │  pause, results       code + WAV)
            ▲                 └─ Board = FlightBoardView (sân chơi)
            │ pool từ              ├─ ScrollingTerrain (+ Wildlife)
  VocabularyCatalog                ├─ OceanBackdrop
  + VocabularyQuery                └─ PixelSprites (nạp sprite từ manifest)
```

## Căn cứ (`Mode.Base`)

- `FlightGame` giữ `MissionLog`, `BaseWorld` (map `AirbaseMap.Create()`) và `DialogueRunner(BaseContent.Dialogues)`.
- Mỗi khung:
  1. WASD/mũi tên/Shift → `world.Tick`.
  2. E/Space/Enter → `world.Interact()`.
  3. Rút `WorldEvent`: `DialogueOpened` → `runner.Start(graph, missions.Condition)` + `view.Dialogue`; `BoardAircraft` → kiểm tra bộ từ → `StartingEnvironment = missions.Environment` → `view.BeginTakeOff()`; `Hint`/`ZoneEntered` → HUD.
  4. `view.Base` vẽ.
- Chọn hội thoại: `runner.Choose(i, apply)`. `missions.Apply` xử lý `mission.accept:N`, `mission.cancel`; `vocab.open` → `Mode.Vocabulary`.

## Một khung khi bay (`Mode.Flying`)

1. Tab → `ToggleControlMode()`.
2. `flight.MovePlayer(Board.PointerX(...))`.
3. `flight.Tick(dt)`: chia bước tối đa 0,05 giây, gọi `Advance`.
4. `DrainEvents()`: `FlightEvent` → âm thanh, hiệu ứng Board, dòng tin CRT.
5. `Board.Animate(dt, flight, env)`.
6. Đang BẮN: `HandleEditing` (Backspace giữ lặp, Ctrl+A) và Enter → `Submit()`.
7. Hàng đợi phát âm `speech`.
8. `view.SetInput(typed, focused)`, `view.Refresh(flight)`.

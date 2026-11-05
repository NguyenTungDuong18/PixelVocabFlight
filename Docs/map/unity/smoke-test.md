# Smoke test trong bản build (FlightGame.Verification)

Code: thư mục `Scripts/Unity/Game/FlightGame/`:

- `FlightGame.Verification.cs`: `SmokeTest()` điều phối (kiểm tra sprite/font đầu tiên, rồi gọi lần lượt từng giai đoạn, ghi report), `SmokeResults`.
- `FlightGame.Smoke.Base.cs`: `SmokeBase` (title, đi/chạy, va chạm, y-sort, SKYLARK chưa có lệnh), `SmokeProfessor` (hội thoại, màn từ vựng, nhận nhiệm vụ).
- `FlightGame.Smoke.Sortie.cs`: `SmokeTakeOff` (khu xe, sân bay, cất cánh, intro), `SmokeCockpit` (lái/gõ, trả lời, roll, pause, khiên băng).
- `FlightGame.Smoke.Combat.cs`: `SmokeEnemyAircraft`, `SmokeRocket`, `SmokeCarrier`.
- `FlightGame.Smoke.Helpers.cs`: state chung (`smokeChecks`, `smokeOutput`, `smokeCaptured`, `smokeMouse`), `Check`, `SmokeCapture`, `SmokeFixture`, `SmokeHeal`, `SmokeAdvanceSafe`, `SmokeClearOtherHazards`, `SmokeWatchdog`, `SmokeType`, `SmokeKey`.

Thêm check: đặt vào giai đoạn tương ứng; mảng mới thì viết coroutine `SmokeX()` trong file `FlightGame.Smoke.X.cs` và gọi nó trong `SmokeTest()`. Mỗi giai đoạn tự lấy lại biến nó cần (`world.Map`, `world.Npc(...)`), không dựa vào biến cục bộ của giai đoạn khác. Lệnh chạy: `ops/build-test.md`. Bẫy khi viết check: `ops/traps.md`.

- Coroutine `SmokeTest()` chạy khi có `--smoke-test`, đi qua toàn bộ luồng game, ghi `smoke-report.json` (`version`, `checks[]` dạng `"mô tả:PASS"`) và ảnh chụp vào `--smoke-output`.
- **Helper:** `SmokeFixture(env)` (trận cố định), `SmokeHeal()`, `SmokeAdvanceSafe(sec)`, `SmokeClearOtherHazards(missileId)`, `SmokeWatchdog` (hết **120 giây** ghi `watchdog-failure.txt` và thoát mã lỗi).
- **0.15: 113 check.**
  - Căn cứ: thẻ tiêu đề, nền ghép từ ô readable (mode phải là "cpu"), giữ D đi sang đông, Shift chạy, nhà chặn đường, y-sort trước/sau công trình, bước chân khớp khung contact, sprite chạy, bụi.
  - Tương tác: prompt và hint ở máy bay khi chưa có lệnh, hội thoại giáo sư (chữ chạy, chân dung, lựa chọn, Esc), màn chọn từ → XONG, chuột/S/phím số chọn lựa chọn, nhận nhiệm vụ Sa mạc, lên máy bay → cất cánh → trận đúng chiến trường → kết quả → về căn cứ.
  - Phát âm: `direct-shot-pronounces-word`, `blast-multikill-does-not-pronounce-words`.

## Ảnh chụp theo thứ tự

- Căn cứ: `00a-base-title`, `00b-base-overview`, `00c-base-walk`, `00c2-base-run`, `00d-professor-dialogue`, `00e-mission-battlefield`, `00f-board-aircraft`, `00g-base-motorpool`, `00h-base-airfield`.
- Cất cánh: `01c-takeoff-engine-start`, `01d-takeoff-roll-leaving-base`, `01d2-takeoff-jungle-runway`, `01e-liftoff`.
- Từ vựng, vào trận, khe gõ: `02-vocabulary`, `02a-intro-climb`, `02b-cockpit-typing`.
- Chiến trường, pause, nổ: `03-desert`, `03a-pause`, `03b-explosion`, `04-ice`.
- Máy bay địch: `05-lock-on`, `05b-homing-burst`, `06-damaged-hull`.
- Tên lửa: `07a-missile-tags-opening`, `07b-missile-tags-open`, `07c-wrong-answer-red-edges`, `07d-silent-blast`, `08-missile-damage`, `08a-rocket-boost`.
- Kết quả: `09-results`. Tàu: `10-carrier-deploying`, `10a-carrier-diagonal`, `10b-carrier-turning`, `11-carrier-exiting`. Về căn cứ: `12-back-at-base`.

**Khi thêm tính năng:** thêm check ở đây (hoặc RulesChecks) và cập nhật số check kỳ vọng trong `CLAUDE.md`/README.

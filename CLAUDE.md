# WORDWING (PixelVocabFlight): hướng dẫn cho Claude Code

Game bắn máy bay pixel art 1944 để học từ vựng Oxford 5000. Viết bằng Unity 6000.6.7f1 (URP 2D, Input System, uGUI dựng bằng code). Phiên bản hiện tại: **0.15.0**. Màn chính là căn cứ đi lại được (WASD, NPC, hội thoại, nhiệm vụ); chế độ bay là một nhiệm vụ nhận từ Giáo sư Whitmore.

**Đọc mục lục `Docs/00-Codebase-Map.md` trước, rồi chỉ mở đúng file `Docs/map/<mảng>/<chủ đề>.md` cần dùng (đừng đọc cả thư mục).** Các file đó mô tả từng file, hằng số, luồng dữ liệu, pipeline art và các bẫy, nên không cần đọc lại toàn bộ `src`. Chỉ mở file nguồn cần sửa.

## Quy tắc

- Trả lời và báo cáo bằng **tiếng Việt**. Text trong game cũng là tiếng Việt.
- **Không commit hoặc push** khi người dùng chưa yêu cầu.
- `Game/Assets/_Project/Scripts/Logic/**` là C# thuần (assembly `Wordwing.Logic`, cấm `UnityEngine`; RulesChecks tự biên dịch cả thư mục): luật bay ở `Logic/Flight/`, căn cứ ở `Logic/World/`, từ vựng ở `Logic/Vocabulary/`. `Scripts/Unity/**` (view, MonoBehaviour) chỉ đọc state và nhận `FlightEvent`/`WorldEvent` qua `PopEvent()`. Đổi luật bay thì cập nhật `Tools/RulesChecks/Combat/`; đổi căn cứ thì `Tools/RulesChecks/World/`.
- Class lớn được chia `partial` trong thư mục cùng tên (vd. `Unity/Flight/FlightView/FlightView.Cockpit.cs`); module PixelForge lớn chia thư mục con (`world/`, `characters/`, `units/`, `ui/`, `terrain/`). Thêm phần mới thì tạo file con theo cùng quy ước, đừng nhồi vào file chính (`Docs/map/overview/folders.md`).
- File mới đặt theo `Docs/map/overview/folders.md`; sprite tự vào thư mục con theo tiền tố tên (`Docs/map/art/sprite-folders.md`).
- **Không sửa tay** sprite trong `Game/Assets/_Project/Art/Resources/Pixel`. Sửa file `Tools/PixelForge/*.cjs` rồi chạy `node Tools/PixelForge/forge.cjs`.
- Giữ đồng bộ hằng số giữa JS và C# (xem `Docs/map/ops/sync-constants.md`):
  - `COCKPIT` (`ui/cockpit.cjs`) ↔ `FlightView`
  - Tọa độ đường và sông (`terrain/common.cjs` + ô từng vùng) ↔ `Wildlife.cs`
  - Đường băng (`runway.cjs`) ↔ `FlightView`
  - Số khung `bomber_guns` (`units/aircraft.cjs`) ↔ `FlightBoardView.GunDeployFrames`
  - Chân đế model (`def(...)` trong `world/*.cjs`) ↔ `WorldModels.cs` (RulesChecks đối chiếu qua manifest)
- Tính năng mới cần có check trong `Scripts/Unity/Game/FlightGame/FlightGame.Smoke.*.cs` (smoke test) hoặc RulesChecks.
- Khi có thay đổi lớn hoặc lên phiên bản:
  - Thêm `Docs/history/NN-*.md` và đoạn đầu `README.md`.
  - Cập nhật file tương ứng trong `Docs/map/` (và mục lục `Docs/00-Codebase-Map.md` nếu thêm file).

## Đội agent

Khi người dùng muốn sửa hoặc thêm tính năng, dùng skill `wordwing-team` (`.claude/skills/wordwing-team/SKILL.md`). Skill này chia việc cho các agent `ww-rules`, `ww-view`, `ww-pixel`, `ww-vocab`, `ww-verify` (`.claude/agents/`). Việc nhỏ trong một mảng thì tự làm trực tiếp.

## Lệnh (chạy từ thư mục gốc dự án)

```text
node Tools/PixelForge/forge.cjs                       # sinh lại sprite + manifest + preview
dotnet build Tools/UnityCompileChecks                 # biên dịch mọi .cs; yêu cầu 0 lỗi, 0 cảnh báo
cd Tools/RulesChecks && dotnet run                    # test logic thuần (47.121 + 13 + 1.238 manifest checks)
powershell -File Tools/Build-Windows.ps1              # khoảng 10 phút → Builds/Windows/Wordwing.exe
powershell -File Tools/Test-Windows.ps1 -OutputFolder <tên>   # smoke 113 checks + ảnh trong Tools/Smoke/<tên>
```

- Xóa hoặc dùng thư mục smoke mới trước mỗi lần chạy, vì thư mục này không tự dọn.
- Xem ảnh chụp bằng Read để soát hình.

## Bẫy môi trường

- Bash heredoc (`<<EOF`) **không chạy được**. Ghi file bằng tool Write; script phức tạp thì viết `.cjs` vào scratchpad rồi chạy `node`.
- Không dùng backtick trong `node -e` dưới bash.
- File `.ignore` ở gốc làm Grep bỏ qua `*.meta`, `*.wav`, PNG sprite, `oxford-vocabulary.json` và JSON Oxford thô. Muốn tìm trong đó thì truyền thẳng đường dẫn file vào Grep.
- **Không có Python.** Xử lý ảnh bằng Node + `Tools/ArtImport/node_modules/sharp`.
- `Tools/BuildWorkspace/Game` là bản sao dùng để build, bị ghi đè mỗi lần build. Đừng sửa ở đó.
- **Domain Reload đang tắt** trong Editor: static giữ `Sprite`/`Texture` tạo lúc chạy phải kiểm tra `if (obj)` hoặc reset bằng `[RuntimeInitializeOnLoadMethod(SubsystemRegistration)]` (xem `PixelSprites.ResetStatics`), nếu không lần Play thứ 2 báo "object has been destroyed".

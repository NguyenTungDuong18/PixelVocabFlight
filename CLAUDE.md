# WORDWING (PixelVocabFlight): hướng dẫn cho Claude Code

Game bắn máy bay pixel art 1944 để học từ vựng Oxford 5000. Viết bằng Unity 6000.6.7f1 (URP 2D, Input System, uGUI dựng bằng code). Phiên bản hiện tại: **0.15.0**. Màn chính là căn cứ đi lại được (WASD, NPC, hội thoại, nhiệm vụ); chế độ bay là một nhiệm vụ nhận từ Giáo sư Whitmore.

**Đọc `Docs/00-Codebase-Map.md` trước.** File đó mô tả từng file, hằng số, luồng dữ liệu, pipeline art và các bẫy, nên không cần đọc lại toàn bộ `src`. Chỉ mở file nguồn cần sửa.

## Quy tắc

- Trả lời và báo cáo bằng **tiếng Việt**. Text trong game cũng là tiếng Việt.
- **Không commit hoặc push** khi người dùng chưa yêu cầu.
- Luật chơi chỉ nằm trong các file thuần C# (không `using UnityEngine`): `Scripts/Core/ContinuousFlight.cs`, `FlightProgress.cs`, `GameRules.cs`. View (`FlightView`, `FlightBoardView`) chỉ đọc state và nhận `FlightEvent` qua `PopEvent()`. Đổi luật thì cập nhật `Tools/RulesChecks/CombatChecks.cs`.
- Logic căn cứ (bản đồ, di chuyển, NPC, hội thoại, nhiệm vụ) nằm trong `Scripts/World/*.cs`, cũng là C# thuần; `BaseView`/`DialogueView` chỉ đọc state và nhận `WorldEvent`. Đổi thì cập nhật `Tools/RulesChecks/WorldChecks.cs`.
- **Không sửa tay** sprite trong `Game/Assets/_Project/Art/Resources/Pixel`. Sửa file `Tools/PixelForge/*.cjs` rồi chạy `node Tools/PixelForge/forge.cjs`.
- Giữ đồng bộ hằng số giữa JS và C# (xem mục 9 của bản đồ):
  - `COCKPIT` (`ui.cjs`) ↔ `FlightView`
  - Tọa độ đường và sông (`terrain.cjs`) ↔ `Wildlife.cs`
  - Đường băng (`runway.cjs`) ↔ `FlightView`
  - Số khung `bomber_guns` ↔ `FlightBoardView.GunDeployFrames`
  - Chân đế model (`world.cjs`) ↔ `WorldModels.cs` (RulesChecks đối chiếu qua manifest)
- Tính năng mới cần có check trong `Scripts/Core/FlightGame.Verification.cs` (smoke test) hoặc RulesChecks.
- Khi có thay đổi lớn hoặc lên phiên bản:
  - Thêm `Docs/NN-*.md` và đoạn đầu `README.md`.
  - Cập nhật `Docs/00-Codebase-Map.md`.

## Đội agent

Khi người dùng muốn sửa hoặc thêm tính năng, dùng skill `wordwing-team` (`.claude/skills/wordwing-team/SKILL.md`). Skill này chia việc cho các agent `ww-rules`, `ww-view`, `ww-pixel`, `ww-vocab`, `ww-verify` (`.claude/agents/`). Việc nhỏ trong một mảng thì tự làm trực tiếp.

## Lệnh (chạy từ thư mục gốc dự án)

```text
node Tools/PixelForge/forge.cjs                       # sinh lại sprite + manifest + preview
dotnet build Tools/UnityCompileChecks                 # biên dịch mọi .cs; yêu cầu 0 lỗi, 0 cảnh báo
cd Tools/RulesChecks && dotnet run                    # test logic thuần (47.121 + 13 + 1.238 manifest checks)
powershell -File Tools/Build-Windows.ps1              # khoảng 10 phút → Builds/Windows/Wordwing.exe
powershell -File Tools/Test-Windows.ps1 -OutputFolder Smoke-<tên>   # smoke 113 checks + ảnh trong Tools/Smoke-<tên>
```

- Xóa hoặc dùng thư mục smoke mới trước mỗi lần chạy, vì thư mục này không tự dọn.
- Xem ảnh chụp bằng Read để soát hình.

## Bẫy môi trường

- Bash heredoc (`<<EOF`) **không chạy được**. Ghi file bằng tool Write; script phức tạp thì viết `.cjs` vào scratchpad rồi chạy `node`.
- Không dùng backtick trong `node -e` dưới bash.
- **Không có Python.** Xử lý ảnh bằng Node + `Tools/ArtImport/node_modules/sharp`.
- `Tools/BuildWorkspace/Game` là bản sao dùng để build, bị ghi đè mỗi lần build. Đừng sửa ở đó.
- Các thư mục `Scripts/{Combat,Items,Scoring,Typing}` và `Prefabs/*` đang trống.
- `Tools/apply-war-*.cjs` và `refine-war-visuals.cjs` là di sản cũ, không còn dùng.

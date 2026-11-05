# Build và kiểm thử

Chạy từ thư mục gốc dự án.

| Lệnh | Thời gian | Kiểm tra gì |
| --- | --- | --- |
| `node Tools/PixelForge/forge.cjs` | Khoảng 30 giây | Sinh lại toàn bộ sprite |
| `dotnet build Tools/UnityCompileChecks` | Khoảng 10 giây | Biên dịch `Scripts/Logic` thành assembly riêng (`Logic/Wordwing.Logic.csproj`, netstandard2.1, C# 9, không DLL Unity), rồi `Scripts/Unity` + `Editor` với DLL Unity. Phải **0 lỗi / 0 cảnh báo** |
| `cd Tools/RulesChecks && dotnet run` | Khoảng 30 giây | Test logic thuần: 13 interaction, 16.572 walkable base, 47.121 gameplay/Oxford/căn cứ (gồm đủ file phát âm), 1.238 world sprite manifest |
| `powershell -File Tools/Build-Windows.ps1` | **Khoảng 10 phút** | Chép `Game/{Assets,Packages,ProjectSettings}` sang `Tools/BuildWorkspace/Game`, build batchmode ra `Builds/Windows/Wordwing.exe`, log `Tools/unity-build-isolated.log`. Sau đó chép ngược `.meta` mới, scene và settings nếu nguồn không đổi trong lúc build |
| `powershell -File Tools/Test-Windows.ps1 -OutputFolder <tên>` | Khoảng 1 phút | Chạy exe với `--smoke-test` ở 1280×800, đọc `Tools/Smoke/<tên>/smoke-report.json`, báo lỗi nếu có check không PASS (113 check). Ảnh và `player.log` cùng thư mục |

**Thứ tự chuẩn sau khi sửa:** forge (nếu đổi ảnh) → compile check → RulesChecks → Build → Test → xem ảnh smoke bằng Read.

## RulesChecks (`Tools/RulesChecks/`)

- `RulesChecks.csproj` (net8.0) include **glob `Scripts/Logic/**/*.cs`**: file logic mới tự được biên dịch và dùng được trong test.
- `Program.cs`: GameRules, FlightProgress, dữ liệu prototype/Oxford, file phát âm.
- `Combat/` (`CombatChecks.cs` điều phối + helper `New`/`Heal`/`Calm`/`AdvanceSafely`/`OceanWithMissile`): `.Answers.cs` (giáp, trả lời, roll), `.Aircraft.cs` (tấn công, đổi vùng), `.Missiles.cs`, `.Spawns.cs` (tiếp tế, tàu sân bay).
- `InteractionChecks.cs` (63 dòng).
- `World/` (`WorldChecks.cs` + `.Map`, `.Movement`, `.Dialogue`, `.Manifest`, `.Pathing`): `Run()` kiểm tra bản đồ (bounds, chồng lấn, hàng rào/cổng/đường băng; BFS từ spawn tới mọi NPC và máy bay; mô phỏng đi bộ), va chạm, đi chéo, chạy, tương tác, hội thoại, nhiệm vụ. `RunManifest(path)` đối chiếu `pixel-manifest.json`: đủ 4 hướng, `footW/footH`, số khung, anchor trong sprite, nhân vật, chân dung, `tile_*`, version.

**UnityCompileChecks** tham chiếu DLL trong `$(UnityEditorPath)/Data/Managed` và `Game/Library/ScriptAssemblies` (URP, InputSystem, UI), nên Unity phải mở hoặc build project ít nhất một lần để có `Library`.

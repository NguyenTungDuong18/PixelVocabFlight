# Thư mục `Tools/`

| Mục | Ghi chú |
| --- | --- |
| `Build-Windows.ps1`, `Test-Windows.ps1` | Build exe và chạy smoke (`build-test.md`) |
| `PixelForge/` | Sinh sprite (`art/pixelforge.md`) |
| `RulesChecks/` | Test luật thuần C# (`build-test.md`) |
| `UnityCompileChecks/` (+ `Logic/`) | Biên dịch kiểm tra, tách assembly Logic giống Unity |
| `Vocabulary/` | Pipeline từ vựng: `Prepare-Oxford-Data.cjs`, `Build-Oxford-Vocabulary.cjs`, `Generate-Pronunciation.ps1`, `PdfAudit/` (`data/vocabulary-pipeline.md`) |
| `ArtImport/` | Cung cấp `node_modules/sharp` cho PixelForge và script xử lý ảnh. Script `convert`/`verify-*` và report là di sản 0.7–0.10 (`Attribution/USER-SELECTED-ART.txt` trỏ tới report) |
| `BuildWorkspace/Game` | Bản sao project để build (ghi đè mỗi lần build); không sửa ở đây |
| `Smoke/<tên>` | Ảnh + `smoke-report.json` + `player.log` mỗi lần smoke (gitignore) |
| `*.log` | Log build (gitignore) |

Công cụ mới: đặt trong thư mục con theo mảng (như `Tools/Vocabulary/`), script dùng đường dẫn tương đối từ `__dirname`/`$PSScriptRoot`, và thêm một dòng vào bảng này.

# Cây thư mục và quy ước đặt file

```text
PixelVocabFlight/
├─ CLAUDE.md                 quy tắc nhanh cho Claude Code (tự nạp)
├─ README.md                 mô tả theo phiên bản (đoạn trên cùng = bản mới nhất)
├─ WORDWING.code-workspace   mở trong VS Code
├─ .ignore                   Grep/VS Code search bỏ qua .meta, wav, PNG sprite, JSON dữ liệu lớn
├─ .claude/{agents,skills}/  đội agent ww-* và skill wordwing-team
├─ Docs/
│  ├─ 00-Codebase-Map.md     mục lục (đọc trước)
│  ├─ map/<mảng>/<chủ đề>.md bản đồ chi tiết, mỗi file một chủ đề
│  └─ history/NN-*.md        báo cáo từng phiên bản
├─ Builds/Windows/Wordwing.exe          (gitignore)
├─ SourceAssets/             nguồn KHÔNG vào build
│  ├─ PixelArt/Pixel1944/    contact sheet do PixelForge sinh
│  ├─ PixelArt/{Ocean,Prepared,UserSelected,War1944}/   ảnh gốc cũ, prompt
│  └─ Vocabulary/Oxford/     dữ liệu Oxford thô + từ điển
├─ Tools/
│  ├─ Build-Windows.ps1, Test-Windows.ps1
│  ├─ PixelForge/            forge.cjs + module; module lớn có thư mục con world/ characters/ units/ ui/ terrain/
│  ├─ RulesChecks/           Program.cs, InteractionChecks.cs, Combat/, World/
│  ├─ UnityCompileChecks/(+ Logic/)
│  ├─ Vocabulary/            Prepare-Oxford, Build-Oxford, Generate-Pronunciation, PdfAudit/
│  ├─ ArtImport/             node_modules/sharp
│  └─ Smoke/<tên>/  BuildWorkspace/     kết quả tự sinh (gitignore)
└─ Game/                     Unity project (mở thư mục này bằng Unity Hub)
   ├─ .vscode/               settings + Attach to Unity
   └─ Assets/
      ├─ Settings/           URP 2D, Renderer2D, InputSystem_Actions
      ├─ StreamingAssets/Attribution/*.txt  giấy phép
      └─ _Project/
         ├─ Scenes/Flight.unity
         ├─ Scripts/
         │  ├─ Logic/        Wordwing.Logic.asmdef, C# thuần
         │  │  ├─ Flight/    FlightTypes, ContinuousFlight/ (partial), FlightProgress, GameRules
         │  │  ├─ World/     AirbaseMap, BaseContent, BaseWorld, Dialogue, MapDef, Missions, WorldModels
         │  │  └─ Vocabulary/ VocabularyEntry, VocabularyQuery, QuestionDeck, PronunciationPath
         │  └─ Unity/        MonoBehaviour, view, I/O
         │     ├─ Game/      FlightGame/ (partial: lõi, Base, Vocabulary, Sortie, Events, Verification + Smoke.*)
         │     ├─ Flight/    FlightView/, FlightBoardView/ (partial)
         │     ├─ Base/      BaseView/ (partial), DialogueView
         │     ├─ UI/        UiKit, VocabularySetupView
         │     ├─ Rendering/ PixelSprites, PixelTerrain, ScrollingTerrain, OceanBackdrop, Wildlife
         │     ├─ Audio/     FlightAudio
         │     └─ Data/      VocabularyCatalog, ProfileStore
         ├─ Editor/          PrototypeBuild, SelectedArtImporter
         ├─ Art/Resources/Pixel/   SINH TỰ ĐỘNG, xem art/sprite-folders.md
         ├─ Art/Resources/Fonts/VT323-Regular.ttf
         ├─ Audio/Pronunciation/US/Resources/Pronunciation/<a..z|_>/<audioKey>.wav  (4.998 file)
         └─ Data/Vocabulary/Resources/{oxford-vocabulary.json, prototype-vocabulary.json}
```

## Đặt file mới ở đâu

| Thứ cần thêm | Nơi đặt |
| --- | --- |
| Luật, state, tính toán không cần Unity | `Scripts/Logic/<Flight|World|Vocabulary>/`, hoặc mảng mới `Scripts/Logic/<Mảng>/` |
| Màn hình, vẽ, âm thanh, đọc/ghi file | `Scripts/Unity/<Game|Flight|Base|UI|Rendering|Audio|Data>/` |
| Chế độ chơi mới | cặp thư mục `Logic/<Mode>/` + `Unity/<Mode>/`, và một file `Docs/map/{logic,unity}/<mode>.md` |
| Sprite, model, nhân vật | sửa `Tools/PixelForge/*.cjs` (không thêm PNG tay); thư mục con tự chọn theo tên |
| Ảnh gốc, prompt | `SourceAssets/PixelArt/` |
| Dữ liệu từ | `SourceAssets/Vocabulary/`, rồi chạy pipeline (`data/vocabulary-pipeline.md`) |
| Báo cáo phiên bản | `Docs/history/NN-*.md` |

## Chia file khi class hoặc module lớn lên

Mục tiêu: mỗi file một việc, khoảng dưới 250 dòng, để tìm và sửa chỉ cần mở đúng một file nhỏ.

- **C#:** dùng `partial class` trong thư mục cùng tên class: `<Class>/<Class>.cs` giữ field, constructor, API chính; phần khác đặt `<Class>.<Phần>.cs` (vd. `Scripts/Unity/Flight/FlightView/FlightView.Cockpit.cs`, `Scripts/Logic/Flight/ContinuousFlight/ContinuousFlight.Missiles.cs`). MonoBehaviour (`FlightGame`) phải giữ file chính cùng tên và `.meta` (GUID trong scene). File `.cs` mới trong Unity cần `.meta` (Unity tự tạo khi mở Editor).
- **Method dài:** tách thành hàm con theo giai đoạn (vd. `Advance` → `AdvanceEnemies/…`; `SmokeTest` → `SmokeBase/SmokeRocket/…`; RulesChecks `Run` → `CheckMap/CheckMissiles/…`). Biến dùng chung giữa giai đoạn chuyển thành field, hoặc mỗi giai đoạn tự lấy lại.
- **RulesChecks:** `Combat/`, `World/` là `partial static class`; nhóm check mới = hàm `CheckX()` trong file phù hợp, gọi từ `Run()`.
- **PixelForge:** `<module>.cjs` là điểm vào (giữ API và `build` cho `forge.cjs`), phần vẽ nằm trong `<module>/<phần>.cjs`. Module con chỉ `require` module đứng trước nó (không vòng); `world.cjs` nạp `world/*.cjs` theo thứ tự, thứ tự đó là thứ tự model trong manifest.

Di chuyển asset trong Unity thì luôn chuyển kèm `.meta` (hoặc dùng cửa sổ Project) để giữ GUID.

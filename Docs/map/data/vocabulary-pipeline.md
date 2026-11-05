# Dữ liệu từ vựng: nguồn và pipeline

Phía code: `logic/vocabulary.md` (kiểu dữ liệu, lọc), `unity/data.md` (nạp JSON), `unity/audio.md` (phát âm).

- **Nguồn thô:** `SourceAssets/Vocabulary/Oxford/`
  - `oxford-wordlist.html`, `oxford-index.json`, `dictionary-matches.json`, `dictionary-tree.json`.
  - `spelling-aliases.json`, `curated-overrides.tsv`, `pdf-supplements.json`, `missing-meanings.json`.
  - `coverage-report.json`, `LICENSE-DATA.txt`, `Raw/`.
  - JSON/HTML ở đây bị `.ignore`: muốn Grep thì truyền thẳng đường dẫn file. `curated-overrides.tsv` thì tìm bình thường.
- **`Tools/Vocabulary/Prepare-Oxford-Data.cjs`:** đọc wordlist HTML (từ, từ loại, CEFR, cờ Oxford 3000, URL), có thể fetch từ điển. Kiểm tra ≥5000 mục, CEFR hợp lệ. Ghi index.
- **`Tools/Vocabulary/Build-Oxford-Vocabulary.cjs`:** ghép index, từ điển (nghĩa tiếng Việt từ ThichHoc) và alias, gán 16 chủ đề bằng từ khóa (food, travel, work, education, technology, health, nature, people, home, clothing, sports, arts, society, feelings, time, general), dịch từ loại sang tiếng Việt. Xuất `Game/Assets/_Project/Data/Vocabulary/Resources/oxford-vocabulary.json` (không sửa tay file này).
- **`Tools/Vocabulary/Generate-Pronunciation.ps1`:** System.Speech, giọng **Microsoft David Desktop**, Rate −1, ghi `<chữ cái đầu>/<audioKey>.wav` vào `Audio/Pronunciation/US/Resources/Pronunciation/` (cùng quy tắc `PronunciationPath`). Bỏ qua file đã có. `-Prototype` dùng bộ 40 từ.
- **`prototype-vocabulary.json`:** 40 danh từ (24 food, 16 travel), RulesChecks dùng để kiểm tra dữ liệu.
- **`Tools/Vocabulary/PdfAudit/`** (`extract.mjs`, `reconcile.mjs`, có node_modules riêng): đối chiếu PDF Oxford để tạo `pdf-supplements.json`.

## Công thức: đổi dữ liệu từ

1. Sửa nguồn trong `SourceAssets/Vocabulary/Oxford` (thường là `curated-overrides.tsv`), chạy `node Tools/Vocabulary/Build-Oxford-Vocabulary.cjs`.
2. Có từ mới: `powershell -File Tools/Vocabulary/Generate-Pronunciation.ps1`.
3. Chạy RulesChecks (kiểm tra nghĩa, CEFR, chủ đề, đủ file phát âm đúng đường dẫn).

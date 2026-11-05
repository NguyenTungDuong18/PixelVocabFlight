# Vocabulary (logic): mục từ, lọc, bộ câu hỏi, đường dẫn phát âm

Code: `Scripts/Logic/Vocabulary/`. Nạp file JSON nằm ở phía Unity: `unity/data.md`. Nguồn dữ liệu và pipeline: `data/vocabulary-pipeline.md`.

| File | Nội dung |
| --- | --- |
| `VocabularyEntry.cs` | `[Serializable] VocabularyEntry`: `id, word, meaning, partOfSpeech` (tiếng Việt), `topic, acceptedSpellings[], order, pos` (n/v/adj/adv…, dùng cho ô từ loại ở Sa mạc), `cefr` (A1..C1), `oxford3000, topics[], sourceUrl, audioKey, meaningSource, meaningReview, dictionaryId, allMeanings[], ambiguityKeys[], playable`. Kèm `VocabularyFile { entries[], topics[] … }` và `VocabularyTopic { id, name }` |
| `VocabularyQuery.cs` | `VocabularyFilter { collection = "oxford5000"/"oxford3000", minimumLevel, maximumLevel (0–4 = A1–C1), topics[], search, from, to }`. `VocabularyQuery.Levels`, `Filter` (chỉ `playable`, sắp theo `order`), `Range`, `SelectionKey` (sha256 danh sách id, làm khóa kỷ lục) |
| `QuestionDeck.cs` | `DistinctAnswers(a, b)`: hai mục không được trùng chữ, chính tả thay thế, nghĩa hoặc `ambiguityKeys` (tránh câu hỏi mơ hồ). `ValidatePool`, `Next` (3 lựa chọn, kiểu cũ) |
| `PronunciationPath.cs` | `Key(entry)` = `audioKey` (hoặc `word`), `Folder(word)` = chữ cái đầu a–z (khác thì `_`), `Resource(entry)` = `<folder>/<key>`. Dùng bởi `FlightAudio`, RulesChecks; `Generate-Pronunciation.ps1` dùng cùng quy tắc |

Test: `Tools/RulesChecks/Program.cs` (dữ liệu Oxford, lọc, câu hỏi, đủ file phát âm ở đúng đường dẫn).

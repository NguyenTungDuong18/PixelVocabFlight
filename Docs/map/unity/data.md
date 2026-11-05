# Data: nạp từ vựng và lưu hồ sơ

Code: `Scripts/Unity/Data/`. Kiểu dữ liệu từ (thuần C#): `logic/vocabulary.md`.

## `VocabularyCatalog.cs`

Nạp `Resources.Load<TextAsset>("oxford-vocabulary")` (`Data/Vocabulary/Resources/`), kiểm tra không trùng id, cung cấp `Entries`, `Topics`, `Filter(VocabularyFilter)`, `TopicName(id)`.

## `ProfileStore.cs`

- `PilotProfile { version = 1, selection (VocabularyFilter), fullLibraryVersion, startingEnvironment, selectionBeforeFullLibrary, bests[] (key/score), words[] (WordRecord thống kê từng từ), missionsCompleted, lastScore }`.
- `Best(key)`, `Record(...)`, `RecordBest(key, score)`.
- `Save()` ghi **atomic**: `.tmp` rồi `File.Replace`, giữ `.bak`.
- Đường dẫn `persistentDataPath/pilot-profile.json`; smoke dùng `qa-profile.json` để không đụng hồ sơ thật.

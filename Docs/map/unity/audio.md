# FlightAudio: phát âm và hiệu ứng âm thanh

Code: `Scripts/Unity/Audio/FlightAudio.cs`. Đường dẫn phát âm: `logic/vocabulary.md` (`PronunciationPath`). Sinh WAV: `data/vocabulary-pipeline.md`.

- Hai AudioSource: giọng đọc và hiệu ứng.
- `Initialize(entries)`; `Say(entry)` → độ dài clip. Nạp `Resources/Pronunciation/` + `PronunciationPath.Resource(entry)` (= `<chữ cái đầu>/<audioKey>`), cache tối đa 32 clip.
- File WAV: `Game/Assets/_Project/Audio/Pronunciation/US/Resources/Pronunciation/<a..z|_>/<audioKey>.wav` (4.998 file, 25 thư mục). Giọng khác (ví dụ UK) thì thêm thư mục song song `Audio/Pronunciation/UK/Resources/...` và chọn theo cài đặt.
- **Clip tạo bằng code (không có file):** `Tone` (good, wrong, pickup, missileReject), `Engine()` (5,8 giây, nổ rời rạc rồi gầm, cao độ tăng dần), `Beeps` (cảnh báo khóa), `Rattle` (súng địch), tiếng tăng tốc tên lửa, `Blip(pitch)` (chữ hội thoại chạy, cache theo cao độ), `Footstep(running)`.
- `ToggleMute`, `Muted`, `Stop`.
- **Bộ đếm cho test:** `MissileRejectCount, PronunciationCount, LockWarningCount, EngineStarts, BlipCount, FootstepCount`.
- Âm thanh dạng file mới (nhạc, SFX thu sẵn): đặt ở `Audio/<Music|SFX>/<nhóm>/Resources/...` và nạp theo đường dẫn tương đối như phát âm.

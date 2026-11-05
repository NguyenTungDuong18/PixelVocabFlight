# Bẫy và kinh nghiệm (đọc khi gặp lỗi lạ)

## Môi trường shell

- **Bash heredoc (`<<EOF`) bị lỗi.** Ghi file bằng tool Write; script phức tạp viết `.cjs` vào scratchpad rồi `node file.cjs`.
- **Backtick trong `node -e` dưới bash bị hỏng.** Tránh template string trong `-e`.
- **Không có Python.** Dùng Node (`Tools/ArtImport/node_modules/sharp`) để xử lý ảnh.
- File `.ps1` phải giữ ASCII (Windows PowerShell 5.1 đọc UTF-8 không BOM thành ANSI).
- Scratchpad dùng chung giữa các agent chạy song song: đặt thư mục riêng.

## Tìm kiếm

- `.ignore` ở gốc làm Grep (ripgrep) và VS Code search bỏ qua `*.meta`, `*.wav`, `*.ttf`, `*.pdf`, PNG trong `Art/Resources/Pixel`, `oxford-vocabulary.json`, JSON/HTML thô trong `SourceAssets/Vocabulary/Oxford`, `package-lock.json`. Cần tìm trong các file này thì truyền thẳng đường dẫn file. Glob có pattern cụ thể vẫn thấy chúng.

## Smoke test

- **Thư mục smoke không tự dọn.** Dùng thư mục mới (`-OutputFolder <tên>` → `Tools/Smoke/<tên>`), nếu không file cũ như `watchdog-failure.txt` gây nhầm.
- Check lấy mẫu hoạt cảnh phải `yield` ít nhất một khung sau khi bắt đầu và **poll tới điều kiện** thay vì chờ cứng.
- Test tên lửa phải reset `Phase = Cruise, PhaseSeconds = 0, WrongAttempts = 0`, rồi Tick .01 trước khi đo thẻ, nếu không gặp `KeyNotFoundException`.

## Hành vi game cần giữ

- `IntroSeconds` cộng bằng `min(dt, 1/30)` để khựng sau load không làm mất hoạt cảnh vào trận.
- Ở menu, Enter có thể kích hoạt control UI đang chọn: `ClearOverlay` phải bỏ chọn và tắt `interactable` của pos/fire/roll.
- Căn cứ: E/Enter vừa tương tác vừa xác nhận hội thoại. Sau khi vào Base, tương tác khóa 0,2 giây; smoke phải chờ qua.
- Thẻ tên lửa: không đặt `interactable = false` lúc đang lớn (hiện xám); dùng `Answerable && !Wrong`.
- Digit 1–4 luôn ưu tiên chọn đáp án tên lửa khi có tên lửa mở.
- Nền căn cứ cần texture Ground **readable**. Sửa `SelectedArtImporter` thì tăng `GetVersion()`.

## Unity

- **Domain Reload đang tắt** (`EditorSettings.asset`, `m_EnterPlayModeOptions: 1`): static sống qua các lần Play, còn object tạo lúc chạy (`Sprite.Create`, `new Texture2D`) bị hủy. Static giữ object Unity phải kiểm tra `if (obj)` hoặc reset trong `[RuntimeInitializeOnLoadMethod(SubsystemRegistration)]` (như `PixelSprites.ResetStatics`). Static hiện có: `PixelSprites.cache`, `PixelTerrain.cache`, `OceanBackdrop.wideTexture/ring`, `UiKit.font`.
- `Scripts/Logic` là assembly riêng: không dùng được `UnityEngine`, và member `internal` ở Logic không thấy được từ `Scripts/Unity` (và ngược lại). Cần truy cập thì để `public`.
- Di chuyển asset thì chuyển kèm `.meta` để giữ GUID (scene tham chiếu script bằng GUID).
- `SourceAssets/PixelArt/War1944` là di sản 0.12, không còn dùng.

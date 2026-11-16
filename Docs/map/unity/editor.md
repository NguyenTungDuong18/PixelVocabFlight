# Editor: build và importer

Code: `Game/Assets/_Project/Editor/` (Assembly-CSharp-Editor). Lệnh build: `ops/build-test.md`.

| File | Nội dung |
| --- | --- |
| `PrototypeBuild.cs` | `PixelVocabFlight.Editor.PrototypeBuild.BuildWindows`: đọc `-wordwingBuildOutput`, đặt `bundleVersion = "0.15.0"`, gọi `ConfigurePixelArt` (mọi khung trong manifest phải tồn tại, áp cấu hình importer kể cả `isReadable` cho Ground; yêu cầu ≥300 khung và font VT323, thiếu thì dừng build), rồi build scene Flight ra exe |
| `SelectedArtImporter.cs` | AssetPostprocessor cho mọi file dưới `Art/Resources/Pixel/` (mọi cấp thư mục con): Texture Type **Sprite** (Single, 16 PPU = 1 ô nền / 1 unit, pivot giữa) để kéo thả vào scene hoặc cửa sổ Animation xem thử; game vẫn nạp `Texture2D` và tự `Sprite.Create` với pivot từ manifest. Lọc point (bilinear với `_blur_`), không nén, max size 2048, không mipmap. Texture có `title_clouds` đặt Repeat. **Đường dẫn chứa `/Ground/` bật `isReadable`** (BaseView ghép nền bằng CPU). `GetVersion() = 3`; sửa `Configure` thì tăng số này để Unity import lại |

# Bản đồ mã nguồn WORDWING (mục lục)

> Bản **0.15.0**: smoke 344 check; RulesChecks 49.857 gameplay + căn cứ, 13 interaction, 16.588 walkable, 2.720 story, 1.576 manifest. Thư viện 247 model căn cứ (43 đang đặt trên map).
> **Người dùng muốn sửa một thứ cụ thể (lời thoại, cảnh, bàn tay, phòng, menu, save…)? Mở [overview/where-to-edit.md](map/overview/where-to-edit.md) trước**: bảng "muốn sửa gì → file nào".
> **Cách đọc tiết kiệm token:** chỉ mở đúng một file trong bảng dưới. Mỗi file một chủ đề, dưới khoảng 5 KB. Thư mục tài liệu soi gương thư mục code: code ở `Scripts/Logic/World/` thì đọc `map/logic/world.md`, code ở `Scripts/Unity/Flight/` thì đọc `map/unity/` (`flight-view.md`, `board.md`…).
> Số dòng ghi trong file là để ước lượng; vị trí cụ thể nên tìm bằng Grep theo tên hàm hoặc hằng.

## Tổng quan — `map/overview/`

| File | Mở khi |
| --- | --- |
| [where-to-edit.md](map/overview/where-to-edit.md) | **tra nhanh**: yêu cầu sửa X → mở file Y (truyện, hình, menu, save) |
| [game.md](map/overview/game.md) | cần hiểu game chơi thế nào |
| [tech.md](map/overview/tech.md) | công nghệ, Canvas, tọa độ, **quy tắc tách Logic/Unity** |
| [folders.md](map/overview/folders.md) | cây thư mục, **file mới đặt ở đâu** |
| [runtime.md](map/overview/runtime.md) | ai gọi ai, một khung hình chạy thế nào |
| [controls.md](map/overview/controls.md) | phím, chuột |

## Logic thuần C# — `Scripts/Logic/` → `map/logic/`

| File | Mở khi |
| --- | --- |
| [flight-state.md](map/logic/flight-state.md) | enum, lớp state, API `ContinuousFlight`, thêm `FlightEvent` |
| [flight-constants.md](map/logic/flight-constants.md) | bảng hằng số luật chơi (thời gian, tốc độ, bán kính) |
| [flight-lifecycle.md](map/logic/flight-lifecycle.md) | vòng đời máy bay, đạn, tên lửa, tàu, tiếp tế, chọn mục tiêu |
| [progress-rules.md](map/logic/progress-rules.md) | xăng, giáp, điểm, combo, so khớp đáp án |
| [world.md](map/logic/world.md) | bản đồ căn cứ, NPC, hội thoại, nhiệm vụ |
| [vocabulary.md](map/logic/vocabulary.md) | mục từ, lọc, câu hỏi, đường dẫn phát âm |

## Phía Unity — `Scripts/Unity/`, `Editor/` → `map/unity/`

| File | Mở khi |
| --- | --- |
| [flight-game.md](map/unity/flight-game.md) | state machine `Mode`, phím, API UI gọi, `DrainEvents` |
| [smoke-test.md](map/unity/smoke-test.md) | check smoke, danh sách ảnh chụp |
| [flight-view.md](map/unity/flight-view.md) | header, cockpit, CRT, khe gõ, pause, kết quả |
| [takeoff-intro.md](map/unity/takeoff-intro.md) | hoạt cảnh cất cánh, vào trận |
| [board.md](map/unity/board.md) | sân chơi: vẽ máy bay, tên lửa, thẻ đáp án, hiệu ứng |
| [base-view.md](map/unity/base-view.md) | vẽ căn cứ, hoạt cảnh nhân vật, hộp hội thoại |
| [story-view.md](map/unity/story-view.md) | màn truyện Hồi 0: Text, Cut, Vista, phòng, hội thoại, fade, âm thanh |
| [menu-save-settings.md](map/unity/menu-save-settings.md) | intro không chiến, màn hình chính, 3 ô save, chọn đoạn, cài đặt, tạm dừng, Full HD |
| [ui-kit.md](map/unity/ui-kit.md) | builder UI, màn chọn từ |
| [rendering.md](map/unity/rendering.md) | nạp sprite, nền cuộn, wildlife, biển |
| [audio.md](map/unity/audio.md) | phát âm, âm thanh tạo bằng code |
| [data.md](map/unity/data.md) | nạp JSON từ vựng, hồ sơ lưu |
| [editor.md](map/unity/editor.md) | build editor, importer sprite |

## Thiết kế — `Docs/design/` (khung, chờ duyệt)

| File | Nội dung |
| --- | --- |
| [story.md](design/story.md) | kịch bản: thế giới Velmark, nhân vật, các hồi, vòng lặp chương, câu hỏi chờ trả lời |
| [world-map.md](design/world-map.md) | bản đồ Brandhaven 512 × 384 ô, 16 khu, trình tự mở khóa (+ `world-map.svg`) |
| [art-direction.md](design/art-direction.md) | **bắt buộc khi vẽ:** mức sàn chất lượng, luật đa dạng, 12 phong cách kiến trúc, nhân vật, xe, vũ khí |

## Art — `Tools/PixelForge/`, `Art/Resources/Pixel/` → `map/art/`

| File | Mở khi |
| --- | --- |
| [pixelforge.md](map/art/pixelforge.md) | lệnh forge, manifest, cách dọn, các file `.cjs` |
| [sprite-folders.md](map/art/sprite-folders.md) | sprite nằm thư mục nào, quy tắc tự chia |
| [sprite-catalog.md](map/art/sprite-catalog.md) | tra tên sprite |
| [models-characters.md](map/art/models-characters.md) | model voxel, rig nhân vật, ô nền căn cứ |
| [add-sprites.md](map/art/add-sprites.md) | công thức thêm sprite, model, NPC, sửa cockpit |
| [cinema.md](map/art/cinema.md) | **phim mở màn dựng sẵn** (`Tools/PixelForge/cinema/`): cảnh quay, model máy bay, hiệu ứng, lệnh `film.cjs` |
| [quality-bar.md](map/art/quality-bar.md) | **tiêu chuẩn chất lượng bắt buộc** cho model, nhân vật, hiệu ứng, khung UI, chữ + checklist duyệt |

## Dữ liệu và vận hành

| File | Mở khi |
| --- | --- |
| [data/vocabulary-pipeline.md](map/data/vocabulary-pipeline.md) | dữ liệu Oxford, nghĩa, sinh phát âm |
| [ops/build-test.md](map/ops/build-test.md) | lệnh build/test, RulesChecks gồm gì |
| [ops/sync-constants.md](map/ops/sync-constants.md) | **trước khi sửa art hoặc hằng số**: cặp JS↔C# phải khớp |
| [ops/traps.md](map/ops/traps.md) | gặp lỗi lạ; bẫy shell, smoke, Domain Reload, assembly |
| [ops/tools.md](map/ops/tools.md) | thư mục `Tools/` có gì |
| [ops/recipes.md](map/ops/recipes.md) | công thức sửa thường gặp, thêm mảng mới |
| [ops/history.md](map/ops/history.md) | báo cáo các phiên bản trong `Docs/history/` |

## Quy tắc giữ tài liệu

- Thêm file code ở mảng đã có: cập nhật file `.md` tương ứng của mảng đó.
- Thêm mảng mới: tạo file `.md` mới trong thư mục tương ứng và thêm một dòng vào bảng trên.
- File vượt khoảng 5 KB thì tách theo chủ đề con.

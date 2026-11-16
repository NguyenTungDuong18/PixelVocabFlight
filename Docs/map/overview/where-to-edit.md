# Tra nhanh: người dùng muốn sửa gì thì mở file nào

Mở đúng 1–2 file trong bảng rồi tìm bằng Grep theo mã khung (vd. `m1.P1.10`), tên sprite hoặc tên hàm. Đừng đọc cả thư mục.
Đường dẫn gọn: `Logic/` = `Game/Assets/_Project/Scripts/Logic/`, `Unity/` = `Game/Assets/_Project/Scripts/Unity/`, `PF/` = `Tools/PixelForge/`, `vault` = `C:\Users\Admin\Documents\Obsidian Vault\story\`.

## Kịch bản và nội dung truyện (Hồi 0)

| Muốn sửa | Mở |
| --- | --- |
| Lời thoại, cảnh, thứ tự khung **trên giấy** (nguồn gốc) | `vault/Hồi 0 - Cảnh mở.md`, `vault/Hồi 0 - M1 - Buổi bay cuối.md`… (bảng 11 cột, xem `vault/Cách đọc bảng kịch bản.md`) |
| Khung cảnh mở `open.P1.01–07` (thời lượng, chữ, sprite dùng) | `Logic/Story/Act0Content.Opening.cs` |
| Khung M1 `m1.P1.01–16` (loại khung, hotspot, đồ vật bắt buộc xem) | `Logic/Story/Act0Content.M1Beats.cs` |
| Hội thoại M1 P1.02–P1.07 (tường, ảnh, khăn tay, chuyện Floris) | `Logic/Story/Act0Content.M1Part1.cs` |
| Hội thoại M1 P1.08–P1.16 (sơ đồ thi, lựa chọn giọng/cái tôi, mái nhà, vụ cá cược) | `Logic/Story/Act0Content.M1Part2.cs` |
| Danh sách đoạn chơi (0.1, 0.2, 0.3), tên nhân vật nói, thẻ End | `Logic/Story/Act0Content.cs` |
| Bố cục phòng nội trú: vị trí giường, bàn, đồ treo tường, chỗ Daan ngồi, đường Daan ra cửa sổ | `Logic/Story/DormRoomMap.cs` (+ check `Tools/RulesChecks/Story/StoryChecks.Map.cs`) |
| Cờ truyện (`flag.set:` …), cái tôi | `Logic/Story/StoryFlags.cs`, cú pháp hành động ở `Logic/World/` (Dialogue) |
| Luật chạy khung: Advance, nhảy đoạn, Snapshot/Restore | `Logic/Story/StoryRunner.cs`, kiểu dữ liệu ở `StoryBeat.cs` |
| Kích thước chân đế / tên hiển thị model phòng | `Logic/World/WorldModels.cs` (phải khớp `def(...)` trong `PF/world/dorm.cjs`) |

## Hình (sprite) — sửa code rồi chạy `node Tools/PixelForge/forge.cjs`

| Muốn sửa | Mở |
| --- | --- |
| Đăng ký tên, số khung, fps của tranh truyện | `PF/story.cjs` |
| Cảnh mở: nền bàn, nắp hộp, **bóng mưa** (`fx_rain_shadow`), chữ viết tay | `PF/story/opening.cjs` |
| Cảnh mở: hai tay từng khung (tay phải ôm cao, tay trái cầm hông hộp, đến sau, kẹp mép nắp, gồng run, bật nắp, rút tay) | `PF/story/openingHands.cjs` (`handScenes` 20 khung, `lidScenes` 30 khung; độ run `shiver`/`quiver`, góc nắp `LID`) |
| Khung xương tay, tay trái (`left`), ngón ôm theo va chạm (`wrap`, `clear`, `aimThumb`) | `PF/story/hand.cjs` (sửa xong chạy `node Tools/BlenderForge/render.cjs` rồi forge) |
| Lưới tay thật (MakeHuman CC0, render bằng Blender), cách đặt xương theo tư thế | `Tools/BlenderForge/opening_hands.py`; ghép vào cảnh: `PF/story/blenderHands.cjs` + `sceneCells` trong `PF/story/opening.cjs` (`art/add-sprites.md`) |
| Chất da tay (mảng phẳng, gân, tĩnh mạch, nếp khớp) | `shadeHand` trong `PF/story/tin.cjs` |
| Tiếng chạm hộp / nắp kẹt rồi bật (khớp khung 10 và 13 của tay, khung 20 của nắp) | `Unity/Audio/FlightAudio.StoryClips.cs` (`TinTouch`, `TinOpen`) |
| Hộp thiếc, nắp, 6 món đồ bên trong | `PF/story/tin.cjs` |
| Cận cảnh ảnh chú Floris, mẩu giấy khăn tay | `PF/story/m1cuts.cjs` |
| Cảnh mái nhà, đèn làng, đoàn bom đêm, máy bay số 7 | `PF/story/m1roof.cjs` |
| **Phim mở màn** (intro 10 s + nền menu): cảnh quay, góc máy, lúc nổ, cue âm thanh | `PF/cinema/shots.cjs`, rồi chạy `node Tools/PixelForge/cinema/film.cjs` (`map/art/cinema.md`) |
| Phim mở màn: model máy bay / hiệu ứng nổ, flak, khói, đạn vạch / trời và mây / lóa, bloom | `PF/cinema/models.cjs` / `fx.cjs` / `sky.cjs`, `world.cjs` / `post.cjs` |
| Bảng màu, kích thước tranh 480×270 | `PF/story/common.cjs`; bộ dựng 3D `PF/story/scene3d.cjs`; phông chữ viết tay `PF/story/script.cjs` |
| Đồ trong phòng nội trú (`prop_dorm_*`, đồ treo tường, cửa sổ, thảm), sàn gỗ | `PF/world/dorm.cjs` |
| Dáng đi/chạy/ngồi của Jonas trẻ (`pilot_young`) và Daan | `PF/characters/cycles.cjs`, danh sách nhân vật `PF/characters/roster.cjs` |
| Chân dung Jonas trẻ, Daan | `PF/characters/portraits_youth.cjs` |
| Thẻ ô lưu, thanh trượt âm lượng (`ui_save_slot*`, `ui_slider_*`) | `PF/ui/menu.cjs` |
| Hộp thoại không tên (`ui_dialog_plain`), khung thoại | `PF/ui/dialog.cjs` |

Ảnh đã forge nằm ở `Game/Assets/_Project/Art/Resources/Pixel/` (không sửa tay). Tiêu chuẩn: `map/art/quality-bar.md`.

## Hiển thị, âm thanh, menu trong Unity

| Muốn sửa | Mở |
| --- | --- |
| Kích thước Full HD, tỉ lệ ×4, cỡ chữ phần truyện | `Unity/Story/StoryLayout.cs` |
| Vẽ tranh toàn màn hình, lớp phủ, fade | `Unity/Story/StoryView/StoryView.Picture.cs` |
| Khung chữ (màn đen, máy chữ) | `Unity/Story/StoryView/StoryView.Text.cs` |
| Cảnh vista (mái nhà) và hotspot | `Unity/Story/StoryView/StoryView.Vista.cs` |
| Cảnh phòng đi lại được, Daan đi ra cửa sổ | `Unity/Story/StoryView/StoryView.Map.cs`, `.Staging.cs` |
| Lời nhắc, nhãn đoạn "CHƠI THỬ" | `Unity/Story/StoryView/StoryView.Hud.cs` |
| Hộp thoại (cao thấp, vị trí, chữ) | `Unity/Base/DialogueView.cs` |
| Thứ tự vẽ sàn / tường / vật, ô 64 px | `Unity/Base/BaseView/` (`BaseView.Build.cs`, `BaseView.Story.cs`) |
| Âm thanh truyện (mưa, radio, ếch, tiếng nắp hộp) | `Unity/Flight/FlightAudio.Story.cs`, `FlightAudio.StoryClips.cs` |
| Luồng truyện: vào khung, phím, tự lưu | `Unity/Game/FlightGame/FlightGame.Story.cs` |
| Màn hình chính, Chơi mới/Tiếp tục/Tải hồ sơ/Chọn đoạn/Cài đặt/Tạm dừng | `Unity/Game/FlightGame/FlightGame.Menu.cs` (luồng), `Unity/Menu/MenuView/` (vẽ hàng, thẻ) |
| Phát phim mở màn, letterbox, logo đập vào, cue → âm thanh | `Unity/Menu/TitleScene/` (`TitleScene.Film.cs` giải mã, `TitleScene.Overlay.cs`), `FlightGame.Menu.cs` (`PlayCue`), clip ở `Unity/Audio/FlightAudio.CinemaClips.cs` |
| Khung lựa chọn menu (`ui_menu_option*`, marker, footer) | `PF/ui/menu.cjs`; bố cục lệch trái, trượt vào: `Unity/Menu/MenuView/MenuView.Rows.cs` |
| File save `story-save-1..3.json` | `Unity/Data/StorySaves.cs` |
| `settings.json` (âm lượng, độ phân giải, toàn màn hình) | `Unity/Data/GameSettings.cs` |
| Smoke test truyện / menu | `Unity/Game/FlightGame/FlightGame.Smoke.Story*.cs`, `FlightGame.Smoke.Menu.cs` |

Chi tiết hơn: `map/unity/story-view.md`, `map/unity/menu-save-settings.md`.

## Luồng cũ (căn cứ + bay gõ từ, chỉ vào bằng `--legacy`)

Dùng bảng chính trong `Docs/00-Codebase-Map.md` (flight-*, board, base-view, world, vocabulary).

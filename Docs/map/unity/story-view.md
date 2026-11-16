# StoryView: màn truyện (Hồi 0)

Code: `Scripts/Unity/Story/StoryView/` (partial): `StoryView.cs` (chuyển khung, fade), `.Picture.cs` (Cut, lớp hoạt ảnh, chú thích, cận cảnh), `.Text.cs` (chữ máy chữ), `.Vista.cs` (hotspot chọn bằng A/D, chuột), `.Map.cs` (phòng), `.Staging.cs` (diễn xuất phòng nội trú), `.Hud.cs` (dòng Hint, toast, thẻ End). Điều khiển và âm thanh: `Game/FlightGame/FlightGame.Story.cs`. Kích thước dùng chung: `Story/StoryLayout.cs` (1920×1080, ×4, tranh 480×270, ô 64 px, cỡ chữ). Màn hình chờ, menu, save, cài đặt: `menu-save-settings.md`. Dữ liệu và luật: `Scripts/Logic/Story/` (`StoryBeat`, `StoryRunner`, `Act0Content.*`, `DormRoomMap`; chưa có file bản đồ riêng).

## Vào và ra

- Khởi động bình thường: Intro (`Mode.Boot`) → màn hình chính (`Mode.Menu`) → `EnterStory(snapshot, slot, playSeconds)` (Tiếp tục, Chơi mới, Chọn đoạn). **`--legacy`** vào căn cứ cũ (`EnterBase`, canvas 1440×900). **`--smoke-test`** vẫn bắt đầu ở căn cứ, chạy toàn bộ check cũ, rồi `SmokeStory()` và `SmokeMenu()` (`smoke-test.md`).
- `FlightView.Story` = `StoryView`, trong **canvas riêng** `FlightView.ShellCanvas` (`FlightView.Shell.cs`): tham chiếu 1920×1080, `CanvasScaler` Expand, `sortingOrder` 20, layout 16:9 canh giữa; cửa sổ khác tỉ lệ (smoke 1280×800) thì hai viền đen (các lớp toàn màn có nền đen vươn ra ngoài). `FlightView.Capture` đưa cả canvas này sang camera khi chụp. Có `BaseView` riêng (chế độ story, ×4) và `DialogueView` riêng (chế độ `hd`).
- Esc mở bảng tạm dừng (`menu-save-settings.md`): story đứng yên, vòng lặp âm thanh môi trường vẫn chạy. Enter ở thẻ End: tự lưu và về màn hình chính. Chế độ thử (chọn đoạn, `storySlot = -1`) hiện góc phải `CHƠI THỬ · số  tên đoạn` và không lưu.
- `StoryEventKind.SegmentStarted` → `SaveStory()` (chỉ khi `storySlot >= 0`). Sau `Restore`/`JumpTo` hàng đợi sự kiện bị xóa, nên khung vào đoạn nào thì `EnterStoryBeat` dựng lại world (nhảy vào `m1_roof` thì `storyWorld = null`).

## Luồng một khung

`StoryRunner` (Logic) giữ khung hiện tại và phát `BeatStarted`. `FlightGame.UpdateStory` rút sự kiện → `view.Story.Begin(beat)`: **fade đen 0,2 giây ra + 0,2 giây vào = 0,4 giây**. Giữa lúc tối, `StoryView` gọi `OnSwap` = `FlightGame.EnterStoryBeat(beat)`: dựng/giữ `BaseWorld` (cùng `Map` id thì giữ nguyên, không spawn lại; `LockPlayer` = `beat.LockPlayer` hoặc khung Dialogue), gọi `view.Story.Show`, phát `Sounds`, mở `beat.Dialogue`. Phím chỉ có tác dụng khi hết fade và sau 0,3 giây (`StoryInputLock`). Thời gian dùng `min(dt, 1/30)`. `storySpeed` (smoke đặt 5) nhân lên mọi đồng hồ truyện.

## Mỗi loại khung vẽ thế nào (canvas 1920×1080; tranh 480×270 vẽ ×4 = toàn màn)

| Loại | Vẽ | Điều khiển |
| --- | --- | --- |
| Text `ink` | nền đen + sprite `Sprite` (480×270 ×4), mờ dần trong giây cuối. Thiếu sprite: gõ chữ chậm bằng font Wordwing cỡ 30 | tự hết `Seconds` |
| Text `type` | chữ giữa màn (80,390,1760×300, cỡ thiết kế 40 = 64 px), gõ 16 ký tự/giây, ký tự chưa hiện trong suốt; mỗi ký tự một tiếng gõ máy chữ | tự hết |
| Text trống (P1.02) | màn đen | tự hết |
| Cut | `Sprite` + `Layers` (Image 1920×1080 theo thứ tự, `PixelSprites.At` theo đồng hồ riêng mỗi tên). Sprite dùng ở hai khung liền nhau giữ đồng hồ (nắp hộp đứng ở khung cuối ở P1.06, mưa không bắt đầu lại). `Lines` hiện ở hộp `ui_dialog_plain` (không tên, không chân dung) | tự hết |
| Vista | như Cut + khung mảnh quanh mỗi hotspot (X,Y,W,H ×4), cái đang chọn sáng nhịp, kèm bảng `[E] Xem <nhãn>` ở trên | A/D hoặc mũi tên trái/phải, chuột rê, E/Space/Enter hoặc click |
| Map | `BaseView` chế độ story (không HUD căn cứ), nền ngoài map đen, map nhỏ hơn màn thì canh giữa (m1_dorm 14×11 ô × 64 px = 896×704 giữa màn). Vật ba lớp: `Floor` (thảm) trong `floorLayer` dưới bóng và nhân vật; `Wall` (đồ treo tường, cửa sổ) sort ngay sau tường sau và trước mọi nhân vật; `Object` y-sort như cũ (`base-view.md`). Lời nhắc `[E] Xem <tên>` chỉ cho vật `runner.Active(id)` | WASD đi, Shift chạy, E/Space/Enter tương tác |
| Dialogue | hộp `DialogueView` (hd) ở (60,744) 1800×288, thân chữ 48 px, tên 32 px, chân dung 192 px. Có `Map`: vẽ trên phòng (khóa người chơi). Có `Sprite`: vẽ trên tranh + `Layers`. Lời `""` dùng `ui_dialog_plain` ở dạng **hộp thấp** 160 px sát đáy (cách đáy 40 px) để không che tranh; Jonas/Daan có tên + `portrait_<SpeakerCharacter>`. Nút chỉ "tiếp" (`Act0Content.IsContinueOnly`) hiện mũi tên, lựa chọn thật hiện phiếu | E/Space/Enter/click: hiện đủ dòng rồi tiếp; 1-9 hoặc W/S + E chọn |
| End | chữ `EndCardText` giữa màn giữa hai đường kẻ, `[ENTER]  Về màn hình chính` nhấp nháy | Enter |

- **Vị trí hộp thoại:** `Dialogue.SetStoryLayout(top)` mỗi khung. Nền là Vista hoặc Dialogue có `Sprite` thì hộp ở **mép trên** (y=72, bảng tên, chân dung và phiếu chọn đi theo, phiếu nằm dưới hộp), vì nhân vật nằm ở mép dưới tranh; còn lại (phòng, Cut) ở mép dưới như cũ. Phiếu chọn trong Story rộng 1560 px, chữ 48 px (cỡ thiết kế 28), câu dài xuống dòng và phiếu cao lên (không co chữ).
- **Hotspot vista:** khung và bảng `[E] Xem …` (cỡ thiết kế 28, bảng cao 72) ẩn khi hộp thoại mở, hiện lại khi đóng.
- **Cận cảnh hotspot:** `StoryHotspot.Cut` (`runner.CutFor(id)`) hiện Image 1920×1080 trên phòng, dưới hộp thoại, tới khi hộp thoại đóng.
- **Dòng Hint** (`beat.Hint`): bảng `ui_panel` 1500×112 x=210; trong phòng (khung Map) ở **đáy** y=940 (đầu tường có đồ treo), nơi khác ở y=64 dưới nhãn góc, hiện suốt khung khi người chơi hành động được, ẩn lúc fade và lúc có hộp thoại. **Toast** (`ExitLockedToast`...): `ui_plate` (460,170) 1000×84, 2,6 giây.
- Thiếu sprite: bỏ qua + `Debug.LogWarning` một lần, ghi vào `MissingSprites` (gồm cả của `BaseView`); nền thiếu thì phủ xanh đen.

## Diễn xuất phòng nội trú (`StoryView.Staging.cs`, không có trong dữ liệu)

- Daan: `chr_daan_sit_s` từ m1.P1.01 tới P1.11 (kể cả khung Map); khi dựng phòng, Daan được đưa lên giường bằng một `NpcWalkTo` tốc độ rất lớn tới (`DaanSeatX/Y` = 11,5 / 6). Jonas: `chr_pilot_young_sit_s` ở P1.06, P1.07, P1.10, P1.11 (đặt ở `SeatX/SeatY` = 2,5 / 6, mép chân giường: y=6 bằng khóa y-sort của giường nên vẽ đè lên giường, không đứng cạnh), `chr_pilot_young_hands_s` ở P1.09. Khung Map (tự do đi) bỏ tư thế Jonas và đặt cậu đứng lại ở (`StandX/Y` = 3,6 / 5).
- P1.12: gọi `NpcWalkTo` Daan theo `DormRoomMap.DaanWindowRoute`, tốc độ `DaanWalkSpeed`. Khi `WorldEvent.NpcArrived`: `prop_dorm_window` sang khung 1 (mở; `BaseView.HoldPlacement` chặn nó tự chạy vòng khung) và ẩn Daan. Người chơi dùng `window` (Exit) để sang vista.

## Âm thanh

`FlightAudio.StorySound(id)`: vòng lặp `rain`, `radio` (giọng đọc tin lọc dải hẹp, không rõ chữ, không nhạc), `frogs`/`frogs_low`, `clock`, `drone`, `wind`; một lần `tin_touch`, `tin_open`, `cloth`, `note`; `-id` tắt mờ dần, `silence` tắt hết. Chi tiết: `audio.md`.

## Sprite tham chiếu

Truyện (đều 480×270): `cut_open_tin_bg`, `fx_rain_shadow`, `cut_open_tin_hand`, `cut_open_tin_lid`, `cut_open_ink`, `cut_m1_floris_photo`, `cut_m1_handkerchief_note`, `vista_m1_roof`, `fx_village_lights`, `fx_bomber_stream_night`, `tile_floor_wood`, `ui_dialog_plain`. Phòng: các model `bld_dorm_*`, `prop_dorm_*`, `prop_wall_mailmap`... (qua `WorldModels`). Nhân vật: `chr_pilot_young_{idle,walk,run}_*`, `chr_daan_*`, `chr_pilot_young_sit_s`, `chr_daan_sit_s`, `chr_pilot_young_hands_s`, `portrait_pilot_young`, `portrait_daan`. Dùng lại: `chr_shadow`, `fx_dust`, `ui_plate`, `ui_panel`, `ui_dialog_*`.

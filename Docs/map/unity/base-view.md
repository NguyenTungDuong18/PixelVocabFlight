# BaseView và DialogueView: vẽ căn cứ

Code: thư mục `Scripts/Unity/Base/BaseView/` (partial class): `BaseView.cs` (field, constructor, `Animate` mỗi khung, camera), `.Build.cs` (dựng bản đồ một lần: nền, model, hàng rào, actor), `.Characters.cs` (sprite nhân vật, bước chân, y-sort), `.Dust.cs` (bụi khi chạy), `.Hud.cs` (prompt [E], zone, hint, title card). `Scripts/Unity/Base/DialogueView.cs` (khoảng 170 dòng). Logic căn cứ: `logic/world.md`.

## `BaseView`

Con của layout `FlightView`, nằm dưới overlay và curtain.

- **Nền:** ghép một lần thành texture 1152×832 (72×52 ô × 16 px), vẽ ×3 (1 ô = 48 px tham chiếu). Biến thể ô theo `MapDef.TileVariant`, đường băng theo `RunwayVariant`. Đọc pixel bằng CPU (`GetPixels32`, cần `isReadable`, xem `editor.md`); dự phòng `Graphics.CopyTexture`, cuối cùng màu phẳng. Smoke đọc mode này (phải là "cpu").
- **Vật thể:** mỗi placement là một Image, pivot = anchor của sprite, đặt tại (X, Y + fh). Hàng rào là sprite `tile_fence`. Lệch chân đế manifest với `WorldModels` thì `Debug.LogWarning`.
- **Y-sort:** xếp tĩnh theo `SortKey`. Nhân vật (người chơi + NPC, mỗi người có `chr_shadow`) chèn lại mỗi khung theo Y chân; chỉ `SetSiblingIndex` khi thứ tự đổi.
- **Hoạt cảnh nhân vật:** `idle_<dir>` (thở, chớp mắt), `walk_<dir>`, `run_<dir>` khi Shift (thiếu run thì về walk). Giáo sư dùng `chr_professor_talk_s` khi nói.
  - `StridePhase` (0..1) cộng `delta / Duration(sprite)` mỗi khung, khung = `floor(phase × frames)`. Đổi walk↔run hoặc hướng giữ phase; bắt đầu đi phase = 0; dừng thì reset `IdleTime` (NPC giữ offset riêng).
  - Khung contact 0 và frames/2 → `PlayerSteps++`; `FlightGame` phát `Footstep` khi tăng.
  - **Bụi `fx_dust`:** khi chạy và chạm đất, khi bắt đầu chạy, hoặc quay ngược 180°. Lệch 0,2 ô về sau, ở `shadowLayer`, pool 8 Image. Test hook `DustPuffs`, `ActiveDust`.
- Radar, cờ, ống gió, khói nhà ăn chạy theo `PixelSprites.At`.
- **Camera:** bám người chơi, kẹp trong map, snap 3 px. Canvas lồng + RectMask2D.
- **HUD:** bảng nhiệm vụ trên trái, bảng phi công trên phải; nhãn khu vực, Hint 4,2 giây, prompt `[E] …`, `fx_quest_marker`; dải phím, thẻ tiêu đề.
- Thiếu sprite thì bỏ qua và `Debug.LogWarning`.
- **Ba lớp vật (`Placement.Layer`):** `Floor` (thảm) vào `floorLayer`, nằm dưới bóng nhân vật và mọi vật Object; `Wall` (đồ treo tường, cửa sổ) vào lớp y-sort nhưng khóa sort = khóa của Object nó chồng lên (`WallKey`, tường sau) với `Order = 1`, nên vẽ ngay sau tường sau và trước mọi nhân vật; `Object` y-sort như cũ. Hook test: `IsFloorItem(id)`, `PlacementDrawIndex`. Chế độ story dùng `tileSize = 64`, `scale = 4`, tham chiếu 1920×1080 (field, không phải const; căn cứ giữ 48/3/1440×900); lời nhắc `[E]` cỡ thiết kế 28 trên bảng cao 72.
- **Dùng cho truyện (0.16):** `BaseView.Story.cs` + tham số. `new BaseView(parent, canvas, story: true)`: nền ngoài map đen, ẩn HUD căn cứ (`Animate` thoát sau lời nhắc), không cảnh báo thiếu hàng rào. `Build(world, playerCharacter)` dựng map bất kỳ (người chơi theo `Act0Content.PlayerCharacter = "pilot_young"`; map nhỏ hơn màn thì camera canh giữa). `Reset()` bỏ map đã dựng để `Build` lại map khác. `Ground.WoodFloor` → `tile_floor_wood`, `Ground.Void` không sprite, đen. Lời nhắc `InteractKind.Story` tìm vật theo tag `story:<id>` (`map.FindTag`). NPC đang `Walking` dùng chu kỳ đi. Hook diễn xuất: `SetPose(actorId, sprite)` (người chơi là `"pilot"`), `ClearPoses`, `HideActor`, `HoldPlacement(id, frame)` (giữ model nhiều khung ở một khung, vd. cửa sổ mái), test: `IsBuilt`, `MissingNames`, `PlacementSpriteName`, `ActorVisible`.

## `DialogueView`

Có sprite `ui_dialog_*` thì dùng bố cục mới dưới đây; thiếu (chưa forge) thì về bố cục cũ (`ui_panel`, `ui_ink`, `ui_card*`, keycap, `ui_pointer`, chữ Cream). `UiKit.Pick(mới, cũ)` chọn sprite.

- **Hộp:** `ui_dialog_box` (giấy kem, khung gỗ, scale 3) tại (40,668), 1360×208. Chữ thoại màu `UiKit.Ink`, tại (206,40) 1088×144, cỡ 32, tràn thì 16.
- **Người nói:** khung `ui_dialog_portrait` 168×168 tại (20,20) scale 3; chân dung `portrait_<cid>` 144 px tại (32,32) (mấp máy miệng khi chữ chạy). Tên trên bảng `ui_dialog_name` (olive, chữ Cream cỡ 16) cao 48, vắt qua mép trên hộp (200,−30), rộng theo chữ + 60.
- **Chữ:** 48 ký tự/giây; phần chưa hiện vẫn chiếm chỗ (trong suốt) nên không nhảy dòng. Hiện hết và không có lựa chọn thì mũi tên `ui_dialog_next` 30×30 nhún ở (1306,156).
- **Lựa chọn:** hàng phiếu `ui_dialog_choice` / `_selected` (scale 2, cao 48) nằm trên hộp, chỉ hiện khi chữ hiện hết. Nhãn "N." ở x=28, chữ từ x=64 (có `card_<env>` của `mission.accept:N` thì chữ từ x=146). Rê chuột đổi dòng, bấm gọi `FlightGame.ChooseDialogue`. Hook smoke: `NextArrowVisible`, `NamePlateVisible`, `BoxSpriteName`, `BodyFontSize`.
- **Hộp trơn (truyện):** `Show(speaker, character, text, choices, plainBox: true)` dùng `ui_dialog_plain` (thiếu thì `ui_dialog_box`), ẩn ô tên và khung chân dung, chữ bắt đầu từ x=60. `Plain` là hook test. `StoryView` có `DialogueView` riêng; nút chọn gọi `FlightGame.ChooseDialogue` (chuyển sang `ChooseStoryDialogue` khi `Mode.Story`).
- **Âm thanh:** `FlightAudio.Blip(pitch)` khi chữ chạy (giáo sư 0,8), `Footstep(running)` khi đi.

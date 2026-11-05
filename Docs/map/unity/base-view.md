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

## `DialogueView`

- **Hộp:** `ui_panel` tại (40,668), 1360×208.
- **Người nói:** chân dung `portrait_<cid>` 144 px (mấp máy miệng khi chữ chạy), tên viết hoa kèm vai trò.
- **Chữ:** 48 ký tự/giây; phần chưa hiện vẫn chiếm chỗ (trong suốt) nên không nhảy dòng.
- **Lựa chọn:** bảng trên phải, chỉ hiện khi chữ hiện hết. Keycap 1–n; `mission.accept:N` kèm `card_<env>`. Dòng đang chọn dùng `ui_card_selected` + `ui_pointer`; rê chuột đổi dòng, bấm gọi `FlightGame.ChooseDialogue`.
- **Âm thanh:** `FlightAudio.Blip(pitch)` khi chữ chạy (giáo sư 0,8), `Footstep(running)` khi đi.

# 24. Cutscene mở đầu điện ảnh và menu chính mới (sau 0.15)

## Người chơi thấy gì

Mở game là một cảnh không chiến dài khoảng 10 giây, gồm 6 cú máy cắt liên tục. Có viền đen kiểu điện ảnh, rung máy quay theo bội 4 px và chớp trắng ngay ở các cú cắt có vụ nổ.

| # | Thời gian | Góc máy | Nội dung |
|---|---|---|---|
| 1 | 0,00–1,80 | Toàn cảnh ngang | 3 oanh tạc cơ Kruland bay giữa các cụm flak đen, tiêm kích ta lao vào; 1,35 s một oanh tạc cơ nổ |
| 2 | 1,80–3,10 | Đuổi theo, sau đuôi | Biển mây phối cảnh, vệt tốc độ; đạn vạch từ hai cánh hội tụ, địch trúng đạn, bốc cháy |
| 3 | 3,10–4,10 | Đối đầu | Địch lao thẳng vào camera, phóng to theo bậc ×1→×4, súng lóe, đạn vạch bay ra mép |
| 4 | 4,10–5,40 | Cận ngang | Máy bay ta sát camera bắn, mây cuộn rất nhanh; địch xa nổ ×3 kèm mảnh vụn |
| 5 | 5,40–6,60 | Toàn cảnh thấp | Xác địch rơi kéo vệt cháy và khói, vụ nổ lớn thứ hai, flak lác đác |
| 6 | 6,60–10,0 | Hero shot | Máy bay ta góc 3/4 trước từ xa tiến tới (16 khung raymarch lại ở mỗi cỡ), rồi giữ khoảng cách và "thở"; viền đen thu vào, logo hiện ở góc trên-trái |

Sau 10 giây, cảnh 6 tiếp tục làm nền menu. Thỉnh thoảng có một tiêm kích nhỏ bay ngang ở xa. Các hàng lựa chọn nằm **lệch trái sát mép**, trượt vào từ mép trái lần lượt từng hàng (ease-out-back 0,45 s, trễ 0,09 s mỗi hàng). Hàng đang chọn trượt ra thêm 56 px, có mũi tên ▶ đồng thau. Trang con (Cài đặt, hồ sơ, Chọn đoạn, Tạm dừng) cũng lệch trái.

Khung lựa chọn được vẽ lại thành tấm thép sơn olive dày:

- Gờ vát 3 tầng, ke góc có đinh tán đồng, sơn tróc và gỉ.
- Tab sọc vàng-đen ở viền trái, có đèn.
- Trạng thái chọn có viền đồng thau, đường sáng hổ phách `#F2B65A` và đèn cam sáng.
- Thanh gợi ý phím dưới đáy là dải kim loại có đinh tán.

Hộp thoại truyện (`ui_dialog_*`) giữ nguyên.

Âm thanh: tiếng `burst` lúc 1,95 · 2,40 · 3,35 · 4,30 s. Tiếng nổ `boom` (tổng hợp trong `FlightAudio.StoryClips.cs`) lúc 1,35 · 5,05 · 6,05 s.

## File

- Unity: `Unity/Menu/TitleScene/` (`TitleScene.cs`, `.Shots.cs` lịch cảnh, `.Fx.cs` nổ/khói/đạn/rung/chớp/letterbox; thay cho `Menu/TitleScene.cs`), `Unity/Menu/MenuView/MenuView*.cs` (bố cục lệch trái, trượt vào, marker, footer), `FlightGame.Menu.cs` (`TakeBoom`), `FlightAudio.Story*.cs` (`boom`), smoke `FlightGame.Smoke.Menu.cs`.
- PixelForge:
  - `story/intro.cjs`: máy quay tùy ý `camera(az, el, bank)`, 3 model SDF chi tiết Velmark/Kruland/oanh tạc cơ. Thêm `title_intro_chase`, `_enemy_tail`, `_enemy_hit`, `_enemy_head`, `_hero_approach`, `_hero`, `_bomber_far`; 9 sprite cũ không đổi pixel nào.
  - `story/introFx.cjs` (mới): `title_intro_fx_explosion` 160×160 16 khung, `_flak`, `_debris`, `_fire_trail`, `_smoke_puff`, `_sparks`, `_tracer_head`, `_speed_radial`, `_speed_side`, `_wisp`.
  - `story/introBg.cjs` (mới): `title_intro_bg_chase`, `_head`, `_hero`, `_hero_clouds`.
  - `ui/menu.cjs`: `ui_menu_option`, `ui_menu_option_selected`, `ui_menu_marker`, `ui_menu_footer`. `forge.cjs` thêm `ui_menu_*` vào thư mục `UI/Menu/`.
- Smoke: thay 3 ảnh intro cũ bằng `menu-intro-1-establish` … `menu-intro-6-hero`. Có check từng cảnh (`menu-intro-shot-1..6`), menu nằm sát mép trái sau khi trượt vào, phím bất kỳ nhảy tới cảnh giữ. Ảnh trang con được chụp sau khi hàng trượt xong.

## Quy ước mới

Được lấy model 3D trên Hugging Face làm mẫu. Chỉ đưa lưới vào pipeline khi giấy phép cho phép (`map/art/quality-bar.md` mục 1).

## Tham khảo

- Wikipedia: Tracer ammunition; Supermarine Spitfire (early Merlin-powered variants); Messerschmitt Bf 109; Heinkel He 111; North American B-25 Mitchell.
- battleofbritain1940.com/supermarine-spitfire · historyofwar.org/articles/weapons_spitfire_mkI.html · dingeraviation.net/spitfire · warbirdsresourcegroup.org/LRG/bf109_variants_F.html (nhị diện 6,53°).
- Flak: nationalmuseum.af.mil (fact sheet 196233), worldwarwings.com/how-flak-worked. Nổ nhiên liệu: veterans.gc.ca/en/node/710250.
- Dựng phim: filmindependent.org (biên tập Top Gun: Maverick), wfdd.org và screendaily.com (máy quay trên không trong Dunkirk), các bài về độ dài cú máy (ASL).
- Màu trời theo độ cao: stevealbers.net/albers/allsky/skycolor.html.

# 0.15: căn cứ quân sự đi lại được, NPC, hội thoại, nhiệm vụ

Màn hình chính không còn là bảng chọn chiến trường. Người chơi điều khiển **Phi công 01** đi lại trong một căn cứ không quân năm 1944. Muốn bay phải gặp **Giáo sư Whitmore** để nhận nhiệm vụ huấn luyện từ vựng. Chế độ bay cũ giữ nguyên luật và giờ là một nhiệm vụ trong căn cứ.

## Luồng chơi

1. Vào game ở **căn cứ**, có thẻ tiêu đề WORDWING. Nhấn phím bất kỳ để bắt đầu.
2. Đi tới Giáo sư Whitmore, đứng trước Trường huấn luyện ngoại ngữ (ngay phía bắc điểm xuất phát). Có dấu **!** vàng trên đầu khi chưa có nhiệm vụ.
3. Nhấn **E** để nói chuyện. Các lựa chọn:
   - **Nhận nhiệm vụ huấn luyện:** chọn 1 trong 4 chiến trường (thẻ Rừng / Sa mạc / Băng / Biển).
   - **Chọn bộ từ vựng:** mở màn chọn từ cũ. Nút **XONG** đưa về căn cứ.
   - **Hỏi về các chiến trường**, hoặc **Tạm biệt**.
   - Khi đã có nhiệm vụ: đổi chiến trường, hủy nhiệm vụ, chọn bộ từ, hoặc đi ngay.
4. Ra **SKYLARK MK.I** ở sân đỗ, nhấn **E** để lên máy bay. Chạy hoạt cảnh cất cánh cũ (sân bay + đường băng xuyên rừng), rồi vào trận như 0.14.
   - Chưa có lệnh mà tương tác máy bay thì có thông báo bảo đi gặp Giáo sư.
5. Hết trận, màn kết quả có nút **VỀ CĂN CỨ** (Enter). Nhiệm vụ được ghi hoàn thành, người chơi đứng cạnh máy bay. Muốn bay tiếp thì phải nhận lệnh lần nữa.
6. Trong pause có thêm **VỀ CĂN CỨ (GIỮ NHIỆM VỤ)**.

## Điều khiển ở căn cứ

| Phím | Tác dụng |
| --- | --- |
| WASD / mũi tên | Đi (4 hướng, đi chéo đã chuẩn hóa) |
| Shift | Chạy |
| E / Space / Enter | Tương tác; trong hội thoại thì xác nhận, hoặc hiện hết câu đang chạy |
| 1–9, W/S, chuột | Chọn lựa chọn hội thoại |
| Esc | Đóng hội thoại (ở căn cứ không pause) |

## NPC

| NPC | Vị trí | Vai trò |
| --- | --- | --- |
| Giáo sư Whitmore | Trường huấn luyện ngoại ngữ | Giao nhiệm vụ bay, mở màn chọn từ |
| Lính gác Tâm | Cổng nam | Lời thoại (chỗ cho nhiệm vụ sau này) |
| Thợ máy Bảy | Cạnh SKYLARK ở sân đỗ | Lời thoại |
| Y tá Lan | Trạm y tế | Lời thoại |
| Đại tá Phong | Sở chỉ huy | Lời thoại |

## Bản đồ căn cứ (`AirbaseMap`, 72×52 ô, 1 ô = 16 px ảnh = 48 px màn hình)

- Vành đai hàng rào có cổng ở phía nam. Rừng bao quanh, tháp canh ở 4 góc.
- **Sân đỗ bê tông:** 2 nhà chứa máy bay, SKYLARK và 2 tiêm kích khác, máy bay vận tải, máy bay ném bom địch bị thu giữ, xe bồn, ống gió.
- **Đường băng dọc** ở phía đông, có đường lăn nối với sân đỗ. Tháp chỉ huy, kho nhiên liệu, kho đạn ở phía đông nam.
- **Trung tâm:** Sở chỉ huy, sân điều lệnh với cột cờ, radar, trạm điện đài.
- **Khu ở:** 2 doanh trại Quonset, nhà ăn, tháp nước, trạm y tế, Trường huấn luyện ngoại ngữ.
- **Khu nam:** đường chính từ cổng, chốt gác, bãi xe (jeep, xe tải, xe tăng, lựu pháo, mô tô), xưởng sửa chữa, kho quân nhu, lều dã chiến, ao nước.
- **Phòng thủ:** 3 ụ pháo cao xạ, pháo cao xạ di động, đèn pha, dây thép gai, bao cát.
- Tổng cộng 283 vật thể được đặt, dùng đủ 43 model.

## Model tách rời, 4 hướng

Mỗi công trình, đạo cụ, xe và máy bay là **một model độc lập**, render thành 4 sprite `<id>_s|_e|_n|_w`. Model được dựng bằng **voxel** (`Tools/PixelForge/voxel.cjs` + `world.cjs`) và quay thật 90° nên mặt sau là mặt sau thật. Muốn đặt model lên bản đồ khác chỉ cần thêm dữ liệu, không phải vẽ lại.

| Nhóm | Model |
| --- | --- |
| Công trình (18) | `bld_control_tower, bld_hq, bld_hangar, bld_barracks, bld_mess_hall, bld_medical, bld_academy, bld_workshop, bld_warehouse, bld_fuel_depot, bld_ammo_bunker, bld_radar` (quay 8 khung), `bld_radio_hut, bld_watchtower, bld_water_tower, bld_guardhouse, bld_aa_emplacement, bld_tent` |
| Đạo cụ (15) | `prop_sandbags, prop_barrels, prop_crates, prop_jerrycans, prop_flagpole` (6 khung), `prop_windsock` (6 khung), `prop_searchlight, prop_lamp_post, prop_signpost, prop_bench, prop_barbed_wire, prop_gate_barrier, prop_tree_palm, prop_tree_jungle, prop_bush` |
| Khí tài (7) | `veh_jeep, veh_truck, veh_fuel_truck, veh_tank, veh_aa_gun, veh_artillery, veh_motorcycle` |
| Máy bay đỗ (3) | `air_fighter` (SKYLARK, ta), `air_transport` (ta), `air_bomber_enemy` (địch) |

Kích thước chân đế khai báo ở `WorldModels.cs` và ghi vào manifest (`footW, footH`, theo hướng; E/W đổi chỗ). RulesChecks đối chiếu hai bên.

**Quy ước anchor:** `anchorX, anchorY` là góc dưới trái chân đế, tính theo mép pixel. Chân đế chiếm x ∈ [anchorX, anchorX + footW·16), y ∈ [anchorY − footH·16, anchorY). Sprite được phép vượt ra ngoài chân đế (mái, ăng-ten, bóng đổ).

## Nhân vật (rig chung)

`Tools/PixelForge/characters.cjs` dựng mọi nhân vật từ **một rig có tham số**: da, tóc và kiểu tóc, áo và kiểu áo, quần, giày, mũ, đồ cầm tay, kính, râu, khăn, huân chương… Thêm NPC mới chỉ cần thêm một mục vào `CHARACTERS`.

- 6 nhân vật: `pilot` (nam 22 tuổi, tóc nâu, áo bay da, khăn trắng, kính bay trên trán), `professor`, `guard`, `mechanic`, `medic`, `officer`.
- Mỗi nhân vật có `chr_<cid>_idle_<dir>` (2 khung), `chr_<cid>_walk_<dir>` (4 khung) và `portrait_<cid>` (48×48, 2 khung). Khung 24×32, anchor (12, 30).
- Thêm `chr_professor_talk_s` (cử chỉ khi nói), `chr_shadow` và `fx_quest_marker`.
- Ô nền (`ground.cjs`): `tile_grass/dirt/concrete/asphalt/sand/runway/water`, kèm `tile_fence` cao 24 px.

## Kiến trúc code

| Lớp | File | Vai trò |
| --- | --- | --- |
| Thuần C# (`Scripts/World/`) | `WorldModels.cs` | Danh mục 43 model, chân đế, hướng |
| | `MapDef.cs`, `AirbaseMap.cs` | Bản đồ: ô nền, hàng rào, placement, NPC, khu vực, điểm spawn. Bản đồ mới = một `MapDef` mới |
| | `BaseWorld.cs` | Di chuyển, va chạm hộp chân, tương tác, khu vực, hàng đợi `WorldEvent` |
| | `Dialogue.cs` | Đồ thị hội thoại: node router, lựa chọn có `Condition`, `Action`, biến `{wordCount}` |
| | `Missions.cs` | `MissionLog`: nhận, đổi chiến trường, hủy, hoàn thành |
| | `BaseContent.cs` | Danh sách NPC, lời thoại, nhiệm vụ `vocab-sortie` |
| Unity | `UI/BaseView.cs` | Ghép nền thành texture, y-sort, camera bám, HUD (nhiệm vụ, khu vực, gợi ý, dấu !) |
| | `UI/DialogueView.cs` | Hộp thoại có chân dung, chữ hiện dần, lựa chọn 1–n (kèm thẻ chiến trường) |
| | `Core/FlightGame.cs` | Thêm `Mode.Base`, `Mode.Vocabulary`; xử lý `WorldEvent` và action hội thoại |

**Mở rộng về sau:**
- NPC mới: thêm tham số rig, rồi `BaseContent.Roster` + một `DialogueGraph`.
- Nhiệm vụ mới: thêm `MissionDef` + action mới trong `MissionLog.Apply`.
- Bản đồ mới: thêm một `MapDef` dùng lại các model sẵn có.

## Kiểm tra

- RulesChecks có thêm khoảng 16.572 check căn cứ:
  - Bản đồ không chồng vật thể; từ điểm xuất phát đi tới được mọi NPC và máy bay.
  - Va chạm, đi chéo, chạy.
  - Tương tác, hội thoại và nhiệm vụ.
- RulesChecks có thêm 1.088 check đối chiếu manifest: đủ 4 hướng, chân đế, anchor, số khung, nhân vật, chân dung, ô nền.
- Smoke test có 110 check (0.14 có 72), ảnh mới `00a…00h` và `12-back-at-base`.

**Kết quả 0.15.0:**
- Forge: 360 animation / 820 khung.
- Compile: 0 lỗi / 0 cảnh báo.
- RulesChecks PASS: 13 + 16.572 + 47.121 + 1.088.
- Build Windows OK.
- **Smoke 110/110 PASS** (`Tools/Smoke-Base-0.15c`).

Lượt soát ảnh đã sửa:
- Dải phím bị tràn chữ.
- Lề HUD.
- Số dùng dấu chấm "5.981".
- Thông báo cũ còn che ảnh smoke.
- Thẻ tiêu đề tối hơn và không còn đè phi công.
- Bóng nhân vật to và đậm hơn.
- Đèn pha bị mái xưởng che.
- Vạch giữa đường băng lệch nửa ô.
- Smoke luôn bắt đầu từ hồ sơ QA mới (tất định).
- Câu chào của giáo sư khi điểm bằng 0.

**Còn để sau:**
- Hướng E/W của công trình không thấy mặt bên do phép chiếu `screenX = x`; cửa chính chỉ lộ qua bậc thềm, mái hiên, biển.
- Mô tô 16 px còn ít chi tiết.
- Nhiệm vụ đang nhận chưa được lưu vào hồ sơ: thoát game giữa chừng thì mất nhiệm vụ đang nhận, nhưng vẫn giữ số chuyến và điểm.
- Các công trình chưa vào được bên trong.

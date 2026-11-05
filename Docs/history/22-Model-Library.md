# Sau 0.15: thư viện model căn cứ (247 model)

Không đổi gameplay hay số phiên bản (vẫn 0.15.0). Toàn bộ model voxel của căn cứ được vẽ lại theo hướng ấm áp, dễ đọc kiểu Stardew Valley nhưng giữ chất căn cứ không quân 1944. Thư viện tăng từ 43 lên **247 model**, mỗi model có 4 hướng. Chưa đặt model mới lên bản đồ: chúng nằm trong thư viện, chờ đợt mở rộng căn cứ.

## Đã làm

- **Vẽ lại 43 model đang dùng**, giữ id, chân đế và số khung: nhà, công trình phụ, vật nhỏ, máy bay. Thêm máng xối, ống thoát nước, cửa sổ dán băng chống vỡ, hộp hoa, bao cát, cỏ chân tường, vết gỉ, rêu, xe đạp dựng tường… Riêng `prop_tree_palm`, `prop_tree_jungle` và `prop_bush` giờ đung đưa (4 khung @3), C# (`WorldModels.cs`) và RulesChecks đã cập nhật theo.
- **Model mới** (mỗi nhóm nằm trong một module `Tools/PixelForge/world/*.cjs`):
  - `quarters` (16 model): Nissen hai cỡ, doanh trại gỗ và gạch, HQ lớn có cờ, câu lạc bộ sĩ quan, nhà ăn lớn, bệnh viện lều và bệnh viện gạch, nhà nguyện, nhà tắm, bưu điện, cottage, ga-ra.
  - `storage` (16 model): kho gạch có bến bốc hàng, Quonset, kho thép, kho lạnh, kho phụ tùng, kho gỗ, kho ngụy trang, bãi bồn nhiên liệu, kho đạn nửa chìm, lán.
  - `factory` (23 model): nhà máy máy bay gồm hội trường lắp ráp 18×12 ô mái răng cưa, các xưởng cánh, thân, động cơ (có phòng thử) và sơn dope, lò hơi có ống khói cao, văn phòng có tháp đồng hồ, cổng, kho nhôm, căng-tin, giá lắp ráp, cầu trục.
  - `airfield` (26 model): sân bay lớn gồm hangar T2 18×12 ô (bản mở có máy bay bên trong và bản đóng), Bellman, blister, hangar gỗ, 3 kiểu tháp chỉ huy (kiểu Rougham và Lavenham), nhà ga, khối điều hành, trạm cứu hỏa, trạm khí tượng, ụ đất chữ U, lô cốt, đèn đường băng, đèn hiệu quay, chữ T, ô tín hiệu.
  - `fleet` (21 model): máy bay đỗ cảm hứng từ P-47, P-51, Corsair (có bản gập cánh), Zero, B-17, B-25, Avenger, Catalina, Stearman và Cub, thêm tàu lượn, máy bay đang sửa và xác máy bay. Có nhiều livery.
  - `clutter` (36 model): thùng gỗ, thùng đạn, phuy nhiều màu, phuy nằm, phuy xếp kim tự tháp, phuy trên pallet, phuy đổ dầu, can xăng, pallet, bạt, giá bom, xe đẩy bom, lốp, ụ bao cát, hàng rào, biển cảnh báo, bao thư, kiện thả dù.
  - `workshop` (29 model): đồ của kỹ sư gồm bàn thợ, hòm đồ nghề, động cơ hình sao và V12 trên giá, giá cánh quạt, giàn tời, máy hàn có tia lửa, máy nén khí, máy phát điện, thang, kích, máy tiện, máy khoan, đe, lò rèn, giá phụ tùng, bàn vẽ blueprint, bảng đen, cuộn Tesla, dynamo, bàn thí nghiệm.
  - `nature` (40 model): 13 loài cây có biến thể (sồi, mùa thu, bạch dương, dương, liễu, táo, anh đào, thông, cọ, chuối, rừng, cây chết, cây cháy do bom), bụi rậm, hàng rào cây, dương xỉ, cỏ, lau sậy, hoa dại, đá, gốc cây, khúc gỗ.
- **Hiệu ứng lá rơi**: `fx_leaves_green`, `fx_leaves_autumn`, `fx_leaves_palm`, `fx_petals` (48×64, 12 khung @10, lặp, trôi sang phải theo gió).
- **Nhân vật kỹ sư thiên tài** `engineer`: 19 tuổi, tóc vàng buộc đuôi ngựa, kính bảo hộ, tàn nhang, áo liền quần xanh dầu, thắt lưng đồ nghề, cầm cờ-lê lớn. Có đủ idle, walk, run 4 hướng, chân dung, và thêm hoạt cảnh `chr_engineer_work_*` (vung cờ-lê, có tia lửa). Chưa có trong `BaseContent.Roster`.
- **Pipeline**:
  - `world.cjs` nạp module theo mảng `MODULES` và gọi `extra(add)` cho các sprite không phải model.
  - Forge ghi `preview-world-<module>.png` cho từng module.
  - Thêm `Tools/PixelForge/preview-models.cjs` để xem một module mà không chạy forge, nên nhiều agent sửa song song được.

## Tham khảo

- Hangar T2 và Bellman: [dunsfoldairfield.org](https://dunsfoldairfield.org/type-t2-hangars), [Newcastle HER](https://sitelines.newcastle.gov.uk/index.php/SMR/4928).
- Blister hangar, nhà Nissen, tháp chỉ huy: [Lavenham](https://heritage.suffolk.gov.uk/Monument/MSF25642), [Rougham](https://heritage.suffolk.gov.uk/Monument/MSF22877).
- Thợ máy lắp cánh quạt bằng tời: [ảnh USAF](https://uk.forceswarrecords.com/document/32185947).
- Sách TM "Aircraft mechanics tools" (1945): [UNT](https://mocat.library.unt.edu/catalog/603-ch1380).

## Kiểm tra

- Forge: 1.222 animation, 2.895 khung (trước là 385 / 1.257).
- `dotnet build Tools/UnityCompileChecks`: 0 lỗi, 0 cảnh báo.
- RulesChecks đều PASS: 13 tương tác, 16.572 walkable, 47.121 gameplay/Oxford, 1.238 manifest.
- Build Windows thành công. Smoke **113/113 PASS** (`Tools/Smoke/art-remaster`); ảnh căn cứ hiển thị đúng chân đế, không có model nào đè nhau, cây cọ đung đưa.

## Còn lại

- Đặt model mới lên bản đồ: thêm `ModelDef` vào `WorldModels.cs` (đúng chân đế, xem bảng trong `Docs/map/art/models-characters.md`) rồi `Add(...)` trong map.
- Đưa `engineer` vào roster và hội thoại; đặt `fx_leaves_*` lên tán cây trong `BaseView`.
- Helper dùng chung giữa hai module (buildings↔quarters, props↔clutter, aircraft↔fleet) đang là bản chép. Sửa một bên thì phải chép sang bên kia.

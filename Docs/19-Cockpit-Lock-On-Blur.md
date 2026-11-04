# 0.14: buồng lái, khóa mục tiêu, nền mờ, cất cánh

## Bảng điều khiển buồng lái

Dải chỉ số và khung gõ cũ được thay bằng một bảng điều khiển phi công (`cockpit_panel`, 720×124 px, hiển thị ở tỉ lệ 2×). Bảng vẽ trong `Tools/PixelForge/ui.cjs`; hằng số `COCKPIT` là bố cục chung giữa ảnh và code `FlightView`.

| Vị trí | Thiết bị | Nội dung |
| --- | --- | --- |
| Gờ da phía trên | Ba dòng chữ | Bộ từ đang học (trái), tin điện đài mới nhất (giữa), chế độ LÁI/BẮN (phải) |
| Trái | Đồng hồ xăng E–F | Kim 48 khung (`gauge_needle`), có vùng đỏ |
| Trái | 5 đèn GIÁP | Xanh khi ≥4, vàng khi 3, đỏ khi 2, đỏ nhấp nháy khi 1 |
| Trái | Bảng đồng | Số giáp, tiếp tế, cường hóa |
| Trái dưới | Nút ĐỔI NGHĨA | Không đổi luật |
| Giữa | Màn CRT phosphor xanh | Nghĩa tiếng Việt, gợi ý, cảnh báo khóa mục tiêu, máy bay vừa hạ |
| Giữa dưới | Khe gõ | `>`, chữ đang gõ và dấu nháy |
| Giữa dưới | Ô từ loại | Mở lên trên, chỉ bật khi gặp máy bay sa mạc |
| Phải | Đồng hồ tốc độ 100–150% và đồng hồ giờ bay | Kim giây quét theo thời gian bay |
| Phải | Cần gạt LÁI/BẮN | Có thể bấm chuột |
| Phải dưới | Nút đỏ BẮN [ENTER] | Có viền sọc cảnh báo |

### Khe gõ

- **Chế độ LÁI:** chỉ hiện `NHẬP ĐỂ BẮN`, không có dấu nháy.
- **Chế độ BẮN** (nhấn **Tab**, gạt cần, hoặc bấm vào khe):
  - Placeholder biến mất, khung viền vàng sáng lên.
  - Dấu nháy hiện ngay và nhấp nháy.
  - Bàn phím gõ thẳng vào khe, không cần chỉ chuột.
- **Vị trí dấu nháy:** là một khối riêng, đặt theo độ rộng đo thật của chữ (`TextGenerator`), luôn cách chữ cuối 2 px. Khoảng trắng cuối cũng được tính.
- **Từ dài:** chữ tự thu nhỏ thay vì tràn khỏi khe.

## Không thể né đòn

### Máy bay địch

1. **Tuần tra** 18 giây, hạ độ cao chậm (0,022 chiều cao sân mỗi giây).
2. **Khóa mục tiêu** trong 4,5 giây. Máy bay **không đứng yên**:
   - Nó tiếp tục lao chậm về phía người chơi và tới hàng bắn (62–70% chiều cao sân) đúng lúc súng ra hết.
   - Nắp khoang súng mở, rồi hai nòng súng trượt ra **từ từ suốt 4,5 giây**, mỗi khung một pixel (`bomber_guns`: 9 khung thò ra + 2 khung chớp lửa).
   - Thân máy bay xoay về phía người chơi.
   - Thanh khóa và đồng hồ `KHÓA MỤC TIÊU x.xs` hiện dưới nhãn.
   - Còn 1,5 giây thì thân máy bay nháy đỏ.
3. **Thước ngắm** (`fx_lock_reticle`, 8 khung) khép dần vào thân máy bay người chơi. Khi khóa xong, thước ngắm chuyển đỏ và nhấp nháy.
4. **Bắn loạt 3 viên đạn vạch đỏ** (`enemy_tracer`):
   - Đạn nội suy tới **vị trí hiện tại** của người chơi nên luôn trúng.
   - Mỗi loạt trừ 1 giáp, có thời gian miễn thương 0,65 giây.
5. **Rời đi ngay:** bắn xong là ngoặt luôn, giữ tốc độ đang bay rồi tăng tốc. Máy bay nghiêng cánh (`bomber_<vùng>_bank_left/right`) và bay ra khỏi khung hình.

Máy bay đang khóa sẽ được ưu tiên làm mục tiêu điện đài. Gõ đúng trước khi hết giờ sẽ hạ được nó và ngăn loạt đạn.

### Tên lửa

1. **Bay tầm thường** (`rocket`), luôn chỉnh hướng theo người chơi. Có thể trả lời.
2. **Khóa mục tiêu** khi đến gần, hoặc ngay sau 3 lần chọn sai (`rocket_hot`, rung thân):
   - Kéo dài 1,2 giây; 0,6 giây nếu đã sai 3 lần.
   - Vẫn trả lời được nếu chưa sai đủ 3 lần.
3. **Tăng tốc** (`rocket_boost`):
   - Lửa đuôi lớn gấp ba, khói dày.
   - Bay tới 1,6 bề rộng màn hình mỗi giây và đuổi theo người chơi.
   - Trúng thì mất 2 giáp.

### Bốn ô đáp án tên lửa

- **Cách xuất hiện:**
  - Bốn thẻ chữ độc lập, kích thước 156×40.
  - Bật ra từ giữa thân tên lửa, lớn dần với hiệu ứng *ease-out-back*, lệch pha nhau.
  - Xếp 2×2 quanh tên lửa. Gần mép màn hình thì dồn cả hai cột sang một bên.
- **Tên lửa được mở đáp án:** tên lửa gần nhất có thể trả lời, hoặc tên lửa đang được rê chuột.
- **Cách chọn:**
  - Bấm vào thẻ, hoặc nhấn phím **1–4** (từ Oxford không chứa chữ số).
  - Nếu đang LÁI, chọn đáp án sẽ tự chuyển sang BẮN.
- **Khi chọn sai:** thẻ đó rung, đỏ đi và bị khóa.

## Nền mờ và cảnh vật sống

### Địa hình

`Tools/PixelForge/terrain.cjs` vẽ ba ô nền 680×560 px nối liền theo chiều dọc:

- **Rừng:**
  - Tán cây dày với sông bùn và ruộng bậc thang.
  - Hai làng nhà sàn, đường đất và hố bom.
- **Sa mạc:**
  - Đồi cát đổ bóng mịn, cao nguyên đá.
  - Hai ốc đảo có cọ, nhà đất và ruộng tưới.
  - Đường xe có dấu xích, xác xe tăng và ụ pháo.
- **Băng giá:**
  - Tuyết có vệt gió, sông và hồ đóng băng có lều câu cá.
  - Đường ray, chiến hào zig-zag.
  - Hai làng gỗ có khói ống khói, rừng thông.

### Ảnh mờ và độ nét

- **Ảnh mờ dựng sẵn:** mỗi ô nền có một bản `_blur` làm bằng ba lượt box blur, giảm bão hòa và tối nhẹ. Bản mờ được lọc bilinear.
- **Hai lớp ảnh:** `ScrollingTerrain` đặt ảnh nét chồng lên ảnh mờ, điều khiển bằng `Focus`:
  - Lúc cất cánh: 0 (nét).
  - Khi chiến đấu: 1 (mờ).
- **Biển:** giữ nền nước động sắc nét như cũ.

### Cảnh vật sống (`Wildlife.cs`)

Cảnh vật trôi theo nền và bám theo sông hoặc đường vẽ sẵn trong ảnh:

- **Rừng:**
  - Đàn voi đi dọc bờ sông, đàn cò bay chữ V.
  - Thuyền tam bản trên sông, đoàn xe tải trên đường đất, trâu.
- **Sa mạc:**
  - Đoàn lạc đà, kền kền lượn vòng.
  - Đoàn xe tăng và xe tải chạy trên đường xe.
- **Băng giá:**
  - Đàn tuần lộc và sói, quạ.
  - Đoàn tàu hơi nước nhả khói.

Mỗi con vật hoặc phương tiện có bản khung hình mờ riêng.

## Cất cánh và vào trận

### Cất cánh (khoảng 5,7 giây)

1. Nhấn **CẤT CÁNH**.
2. Thẻ thương hiệu và bảng hướng dẫn trượt sang trái; bảng nhiệm vụ trượt sang phải.
3. Động cơ khởi động kêu "tu tu":
   - Âm thanh tạo bằng code, từng tiếng nổ rời rạc rồi thành tiếng gầm đều.
   - Máy bay rung và nhả khói ở ống xả.
   - Cánh quạt quay nhanh dần.
4. Máy bay lăn một quãng dài, khoảng 3,4 màn hình. **Camera đi theo máy bay**:
   - Cảnh lùi dần từ sân bay qua hàng rào, chốt gác, ụ bao cát và lều trại của căn cứ (`title_runway_edge`).
   - Sau đó là đường băng xuyên rừng rậm, có suối chảy qua cống dưới đường băng (`title_runway_jungle`, ô lặp liền mạch). Cả hai ô vẽ trong `Tools/PixelForge/runway.cjs`.
   - Khói ống xả ở lại phía sau, mây trôi nhanh hơn mặt đất.
   - Tiếng động cơ cao dần theo tốc độ.
5. Máy bay cất cánh: to dần và bóng tách xa.
6. Màn hình tối dần.

### Vào trận (1,4 giây)

- Đồng hồ trận **không chạy** trong lúc này.
- Màn đen mở ra.
- Máy bay người chơi bay lên từ mép dưới vào vị trí.
- Mặt đất mờ dần.
- Đầu trang và buồng lái hiện dần từ trong suốt đến rõ.

**BAY LẠI** ở màn kết quả vào thẳng phần này.

## Kiểm tra

Smoke test 0.14 viết lại các kiểm tra lao tới, né và rê chuột cũ theo luật mới. Bổ sung các kiểm tra:

- **Cất cánh:** các thẻ trượt sang hai bên, có khói động cơ, máy bay lăn bánh, cất cánh, màn hình tối dần.
- **Vào trận:**
  - Máy bay xuất hiện dưới mép, đồng hồ đứng yên trong lúc vào trận.
  - HUD hiện dần.
  - Nền và cảnh vật mờ.
- **Khe gõ:**
  - Chế độ LÁI chỉ hiện placeholder.
  - Tab tự vào khe gõ, dấu nháy cách chữ 2 px.
- **Máy bay địch:**
  - Báo khóa mục tiêu, súng trượt ra, có thước ngắm.
  - Bắn rồi nghiêng ra khỏi khung hình.
  - Loạt đạn không né được, trừ 1 giáp.
- **Tên lửa:**
  - Bốn thẻ lớn dần từ thân tên lửa và không chồng nhau.
  - Phím số chọn đáp án.
  - Tăng tốc không né được, trừ 2 giáp.

Lệnh kiểm tra:

```text
node Tools/PixelForge/forge.cjs
dotnet build Tools/UnityCompileChecks
cd Tools/RulesChecks && dotnet run
powershell -File Tools/Build-Windows.ps1
powershell -File Tools/Test-Windows.ps1 -OutputFolder Smoke-Pixel-0.14
```

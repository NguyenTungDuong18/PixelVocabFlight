# Định hướng mỹ thuật: đa dạng và mức chất lượng (bắt buộc)

File này bổ sung `Docs/map/art/quality-bar.md`:
- `quality-bar.md` quy định **từng hình phải đẹp tới đâu** (tông, viền, bóng, ánh sáng, checklist).
- File này quy định **các hình phải khác nhau thế nào**, và **mức sàn chất lượng** cho từng loại.
Hình mới phải đạt cả hai. Mục `[?An]` chờ câu trả lời ở cuối file.

Vấn đề cần sửa (người dùng nhận xét): nhà hiện nay giống nhau, toàn khối chữ nhật dài hẹp, mái ngói hình kim tự tháp. Xe và vũ khí cũng vậy. Bối cảnh châu Âu thời Thế chiến 2 có kiến trúc rất đa dạng, mỗi tòa một màu sắc riêng; game phải thể hiện được điều đó.

## 1. Mức sàn chất lượng

**Mốc so sánh:** hiệu ứng lửa trại `fx_fire_camp` (pixelfx `fire/campfire`). Mọi hình mới phải đạt **bằng hoặc hơn** mốc này về độ chi tiết, ánh sáng và chuyển động, ở cùng cỡ hiển thị. Lửa trại có:
- **Nhiều lớp:** củi bắt chéo có vân và 3 tông, lớp than hồng, ngọn lửa liếm và bùng, tia lửa bắn, tàn lửa bay lên, khói cuộn.
- **Ánh sáng:** quầng sáng ấm hắt lên củi và mặt đất.
- **Chuyển động:** 30 khung @10 fps lặp liền 3 giây; mỗi lớp chuyển động theo nhịp riêng nên không lặp lộ.

Quy đổi thành mức sàn cho từng loại:

| Loại | Mức sàn |
| --- | --- |
| Hiệu ứng lặp (lửa, khói, nước, điện) | ≥ 20 khung, ≥ 2 giây mỗi vòng, ≥ 3 lớp chuyển động riêng (thân, hạt, khói/ánh sáng), có quầng sáng nếu phát sáng |
| Hiệu ứng một lần (nổ, va chạm, bụi) | Pha rõ: báo trước hoặc chớp → bùng → tan; tan chậm hơn bùng; có mảnh vỡ hoặc hạt bay theo quán tính |
| Công trình | ≥ 1 chi tiết động (khói, cờ, đèn, dây phơi, quạt thông gió…), ≥ 3 vật liệu khác nhau, ≥ 1 điểm sáng ấm, đạt toàn bộ checklist `quality-bar.md` |
| Nhân vật | Bóng dáng riêng (mục 4), idle có thở và chớp mắt, đồ cầm có quán tính |
| Xe, máy bay, vũ khí | Bóng dáng riêng (mục 5), ≥ 1 chi tiết động (cánh quạt, khói xả, đèn, xích, nòng giật), vết dùng (dầu, bùn, sơn tróc), dấu hiệu phe rõ |

Người dùng có thể đưa thêm ảnh hoặc ví dụ làm mốc `[?A1]`. Mốc mới được ghi vào bảng này.

## 2. Luật đa dạng cho công trình

1. **Không lặp bóng dáng:** trong một khung nhìn khoảng 40 × 25 ô phải có ≥ 3 kiểu mái và ≥ 2 kiểu mặt bằng. Hai nhà cạnh nhau không được trùng cả phong cách lẫn màu.
2. **Hạn mức mái chóp (hip / kim tự tháp):** ≤ 20% số công trình. Mái hai dốc trơn ≤ 30%. Phần còn lại dùng các kiểu ở mục 3.
3. **Mặt bằng không chỉ là chữ nhật dài:** dùng L, T, U, sân trong, khối chính kèm tháp, khối bậc thang, nhà tròn hoặc bát giác (cối xay, tháp nước), dãy nhà liền kề chung tường (làng).
4. **Chiều cao khác nhau:** khu dân cư trộn nhà 1, 2 và 3 tầng; mỗi khu có ít nhất một điểm mốc cao (tháp chuông, tháp nước, cối xay, tháp chỉ huy, ống khói nhà máy).
5. **Mỗi công trình có một "chữ ký" riêng:** một chi tiết chỉ nhà đó có (tháp đồng hồ, cửa sổ lồi, ban công sắt, mái hiên sọc, biển hiệu vẽ tay, tranh tường, cửa sổ tròn, giàn hoa…). Ghi chữ ký vào chú thích `def(...)`.
6. **Màu riêng cho từng nhà:** mỗi phong cách có ≥ 3 biến thể màu (tường, cửa, cửa chớp, khung cửa sổ). Nhà cùng phong cách đặt gần nhau phải khác biến thể.
7. **Đúng chức năng:** nhìn hình đoán được nhà dùng để làm gì (lò bánh có ống khói và biển bánh mì, ga có mái hiên sân ga và đồng hồ, xưởng có cửa lớn và cần trục…).
8. **Mức hư hại theo cốt truyện:** công trình ở khu có thể bị bom có bản `_damaged` (mái thủng, tường cháy, giàn giáo) dùng cùng chân đế.

## 3. Danh mục phong cách kiến trúc

Velmark là nước ven Biển Bắc pha trộn Hà Lan, Bắc Đức, Bỉ và Pháp. Mỗi công trình mới chọn **một** phong cách dưới đây và ghi mã vào chú thích `def`.

| Mã | Phong cách | Dấu hiệu nhận dạng | Mái | Vật liệu và màu | Dùng ở |
| --- | --- | --- | --- | --- | --- |
| VL-1 | Nhà khung gỗ lộ (kiểu Bắc Đức) | khung gỗ sẫm chéo trên tường trát, tầng trên nhô ra | hai dốc rất dốc, đầu hồi quay ra đường | trát kem, vàng nhạt, xanh nhạt; gỗ nâu đen | làng |
| VL-2 | Gạch đầu hồi bậc thang (Hà Lan, Bỉ) | đầu hồi bậc thang hoặc đầu hồi cổ chai, cửa sổ cao có ô chia, móc tời ở đỉnh hồi | hai dốc sau hồi | gạch đỏ, nâu, vàng; khung cửa trắng hoặc xanh lá | quảng trường, kho kênh, trường ngoại ngữ |
| VL-3 | Mansard Pháp | mái gãy hai tầng có cửa sổ mái, ban công sắt, bậc tam cấp | Mansard xám đá phiến | đá vôi kem, mái xám xanh, cửa xanh navy | dinh thự, tòa thị chính, khách sạn |
| VL-4 | Gạch Gothic (Biển Bắc) | tháp nhọn, cửa sổ vòm nhọn, trụ đỡ, hoa văn gạch | dốc, tháp chóp nhọn | gạch đỏ sẫm, ngói xanh rêu hoặc đồng xanh | nhà thờ, hội quán |
| VL-5 | Trang trại dài (Hallenhaus) | nhà và chuồng chung một mái, cửa lớn ở đầu hồi, mái gần chạm đất | mái lá hoặc ngói rất thấp, đầu hồi cắt (jerkinhead) | gạch và gỗ, mái lá vàng xám | trang trại |
| VL-6 | Nhà mái lá ven biển | tường trắng thấp, mái lá dày, cửa sổ nhỏ, cửa chớp màu | mái lá tròn mép | trắng vôi, cửa chớp xanh dương, đỏ hoặc xanh lá | bờ biển, làng chài |
| VL-7 | Hiện đại 1930 (Art Deco, Streamline) | góc bo tròn, cửa sổ dải ngang, mái bằng có lan can, tháp kính cầu thang | mái bằng | trát trắng hoặc kem, viền xanh hoặc đỏ, chữ nổi | đài chỉ huy, nhà ga sân bay, rạp chiếu, trạm cứu hỏa |
| VL-8 | Bê tông phòng thủ | khối dày, góc vát, lỗ châu mai, sơn ngụy trang loang | mái bằng dày, phủ đất | bê tông xám, sơn ngụy trang nâu-xanh | lô cốt, radar, kho bom |
| VL-9 | Quân sự tạm (Nissen, Quonset, Romney, Laing, Maycrete) | mái vòm tôn gợn sóng, đầu hồi gạch hoặc gỗ, nhà ván tiền chế | vòm, hai dốc thấp | tôn xám, xanh tối, đen hắc ín; gạch tạm | khu ở, khu sinh hoạt, kho |
| VL-10 | Công nghiệp | mái răng cưa, cửa trượt lớn, ống khói cao, cầu trục, khung thép | răng cưa, vòm thép, mái thấp dốc một phía | gạch vàng hoặc đỏ, thép sơn, kính bám bụi | hangar, xưởng, kho xăng, ga |
| VL-11 | Mốc cảnh quan | cối xay gió (thân bát giác, cánh quay), tháp nước, hải đăng, cầu kênh mở được | tùy mốc | tùy mốc, màu nổi bật | làng, ga, bờ biển |
| VL-12 | Đổ nát | mái thủng thấy xà, tường cháy đen, giàn giáo, gạch vụn, bạt che | mái hở | tông phong cách gốc, ám khói | khu bị bom, bản `_damaged` |

**Kiểu mái được dùng** (để đạt luật 2): hai dốc, đầu hồi bậc thang, đầu hồi cổ chai, đầu hồi cắt, Mansard, gambrel, mái lá tròn mép, vòm tôn, răng cưa, mái bằng có lan can, mái dốc một phía, tháp chóp nhọn, chóp củ hành nhỏ (tháp chuông), mái chóp (giới hạn ≤ 20%).

## 4. Đa dạng nhân vật

- Mỗi NPC có **bóng dáng riêng** nhận ra khi chỉ còn bóng đen: dáng người (cao gầy, thấp đậm, già khom), mũ (mũ phi công, mũ lưỡi trai, mũ beret, mũ y tá, mũ sắt, khăn trùm), đồ cầm (cờ-lê, sách, túi, khay, súng, bản đồ).
- Màu áo theo **phe và nghề:** Velmark (phe ta, màu riêng `[?A2]`), Anh (xanh xám RAF), Mỹ (olive, nâu), dân thường (màu ấm, đa dạng), phe Kruland (xám lạnh, không dùng phù hiệu có thật).
- Dân làng có ít nhất 6 kiểu người khác nhau về tuổi, dáng và trang phục; không nhân bản một NPC đổi màu áo.
- Hành động riêng theo vai trò: thợ máy vặn ốc, y tá băng bó, lính gác đổi chân, giáo sư đọc sách… (mỗi NPC chính ≥ 1 hoạt cảnh làm việc như `chr_engineer_work`).

## 5. Đa dạng xe, máy bay, vũ khí

- **Theo phe:** mỗi phe có phù hiệu, bảng màu sơn và kiểu dáng riêng (thiết kế giả tưởng lấy cảm hứng từ hình khối thời đó, không chép nguyên mẫu có tên thật nếu là phe giả tưởng). Ví dụ: Velmark có vòng tròn cam-xanh `[?A2]`; Kruland có hình thoi xám-đỏ.
- **Theo vai trò, mỗi vai trò ≥ 2 kiểu khác bóng dáng:**
  - Máy bay: tiêm kích, ném bom nhẹ, ném bom nặng, vận tải, trinh sát, thủy phi cơ, huấn luyện.
  - Xe: jeep, xe tải, xe bồn, xe cứu thương, xe cứu hỏa, máy kéo máy bay, xe tăng, xe bọc thép, mô tô, xe đạp.
  - Vũ khí trên mặt đất: pháo phòng không nhẹ và nặng, súng máy phòng không 4 nòng, pháo dã chiến, đèn pha, súng trường và súng ngắn cho nhân vật.
- **Bóng dáng khác nhau thật:** khác số động cơ, kiểu cánh (thẳng, gãy, cánh mòng biển), đuôi (đơn, kép), mũi (kính, đặc), bánh (bánh xe, xích, nửa xích). Không chỉ đổi màu.
- **Dấu vết dùng:** vết dầu sau động cơ, bùn ở bánh, sơn tróc mép, số hiệu và tên riêng vẽ trên mũi (nose art), bản sửa chữa có tấm vá khác màu.

## 6. Cách áp dụng

- Trước khi vẽ: chọn mã phong cách (mục 3), ghi chữ ký riêng (luật 5) và biến thể màu (luật 6). Gọi `ww-research` lấy tư liệu thật cho phong cách đó.
- Khi duyệt: ngoài checklist `quality-bar.md`, kiểm tra thêm:
  - Có trùng bóng dáng với nhà, xe hay nhân vật đã có không? Đặt cạnh nhau trong ảnh so sánh.
  - Hạn mức mái và luật khung nhìn (luật 1, 2) còn đúng không khi đặt lên bản đồ.
  - Có đạt mức sàn ở mục 1 không? So với `fx_fire_camp` ở cùng tỉ lệ.
- Model cũ không đạt luật đa dạng thì vẽ lại khi khu của nó được làm (theo trình tự trong `world-map.md`).

## Câu hỏi cho người dùng

- **A1. Mốc chất lượng:** ngoài lửa trại pixelfx, bạn có ảnh hay game nào làm mốc cho nhà, nhân vật, xe không (gửi ảnh chụp để tôi phân tích, không chép)?
- **A2. Màu nhận diện của Velmark:** bạn muốn màu quốc gia là gì (ví dụ cam và xanh biển)? Dùng cho cờ, phù hiệu máy bay, quân phục.
  - **Chốt tạm 11/11/2026 (Claude đề xuất, chờ bạn duyệt):** cờ ba dải ngang cam cháy, trắng ngà, xanh biển đậm. Phù hiệu máy bay: vòng tròn cam, viền xanh biển, tâm trắng. Quân phục: xanh biển xám, băng tay cam. Các chỗ ghi `[?A2]` ở trên đọc theo dòng này.
- **A3. Mật độ chi tiết:** bạn thích cảnh dày đồ vật (mỗi góc đều có đồ kể chuyện) hay thoáng, dễ đọc hơn?
- **A4. Mùa:** có vẽ biến thể mùa đông (tuyết trên mái, cây trụi lá) cho mọi công trình không? Việc này nhân đôi số sprite.
  - **Chốt tạm 11/11/2026 (Claude đề xuất, chờ bạn duyệt):** không nhân đôi. Tuyết là lớp phủ PixelForge sinh tự động trên mái và mặt đất, cộng hạt tuyết rơi. Chỉ vẽ tay bản mùa đông cho thứ người chơi nhìn gần (cồn cát, mộ, máy bay cháy dở). Xem Q9 trong `<vault>/story/Tổng quan.md` mục 9.

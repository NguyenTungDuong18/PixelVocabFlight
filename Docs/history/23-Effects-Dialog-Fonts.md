# Sau 0.15: hiệu ứng chuẩn pixelfx, khung hội thoại, hai bộ chữ, khu y tế

Không đổi gameplay hay số phiên bản (vẫn 0.15.0). Nâng chất lượng hình theo chuẩn của [pixelfx](https://github.com/patch-gg/pixelfx) (MIT): hiệu ứng nhiều tầng sáng, viền mực sạch, chuyển động có đà. Khu y tế là bản thử chất lượng để người dùng quyết định có vẽ lại cả căn cứ theo chuẩn này không.

## Đã làm

- **Hiệu ứng pixelfx** (`Tools/PixelForge/pfx.cjs` + `vendor/pixelfx/`, chép từ commit a8415968, kèm LICENSE/NOTICE). 12 sprite thư viện, chưa đặt lên map:
  - Lửa: `fx_fire_brazier`, `fx_fire_torch`, `fx_fire_camp`, `fx_burning` (chỉ lửa, option `fireOnly` thêm vào bản chép).
  - Sinh vật: `fx_bird` (chim sẻ nâu), `fx_butterfly` (bướm cam).
  - Khác: `fx_poof`, `fx_spark_arc`, `fx_tesla_arcs` (chỉ tia điện, option `coil: false`), `fx_explosion_barrel`, `fx_explosion_dirt`, `fx_splash_big`.
- **Vẽ lại mọi hiệu ứng đang dùng**, giữ tên, kích thước khung và loop (C# đặt chúng vào khung chữ nhật cố định):
  - Nổ có chớp trắng, khối lửa liền và khói mờ thật thay cho đốm tròn và lưới dither.
  - Tia lửa, khói, sóng xung kích, khiên băng, bắn nước, ống ngắm, chớp nòng, vệt đạn, luồng phụt tên lửa, lá rơi.
  - `fx_quest_marker` lên 16×24, 12 khung, có tia lấp lánh. `fx_dust` 6 khung.
  - `fx_explosion` vẫn 8 khung (smoke kiểm tra), `fx_lock_reticle` vẫn 8 khung (0–5 theo tiến độ khóa).
- **Khung hội thoại** (`ui/dialog.cjs`): `ui_dialog_box` (khung gỗ óc chó, ke đồng thau, giấy kem), `_portrait` (vành đồng), `_name` (bảng men olive), `_choice`/`_selected` (phiếu giấy có tab gỗ), `_next` (mũi tên đồng nhún). `DialogueView` dựng bố cục mới, thiếu sprite thì về bố cục cũ. Lựa chọn tự đánh số "N." và bỏ số có sẵn trong nội dung.
- **Hai bộ chữ pixel** (`node Tools/PixelForge/fonts.cjs`, ghi TTF bằng Node thuần):
  - `WordwingVi`: chữ bo tròn cho giao diện và hội thoại, đủ 134 chữ Việt có dấu, dấu chồng tách rõ.
  - `WordwingEn`: máy chữ đơn cách 1944 cho mọi chỗ hiện hoặc gõ từ tiếng Anh (plate máy bay địch, ô gõ, thẻ tên lửa, bảng từ vựng).
  - 318 glyph mỗi bộ. Lệnh tự quét ký tự trong code và dữ liệu từ vựng, thiếu thì báo lỗi.
  - Chỉ sắc ở cỡ bội 16, nên `UiKit.Px` làm tròn về bội 16 và `Fit` co theo bước 16 (`DiscreteFit`). Importer đặt `HintedRaster`. VT323 giữ làm dự phòng.
- **Khu y tế** (tư liệu do `ww-research` tra: RAF Station Sick Quarters, bệnh viện dã chiến lều, station hospital Mỹ ở Anh, Army Nurse Corps 1944):
  - `bld_medical` (đang trên map, 6×5): nhà gạch mái ngói chữ thập đỏ, annex Nissen, ống khói có khói, cờ, dây phơi băng gạc, biển SICK QUARTERS, bao cát, cáng, xe lăn, bình oxy. Nay **4 khung @6** (`WorldModels.cs` và contract RulesChecks đã sửa theo).
  - `bld_medical_tent` (10×7): lều ward vách cuộn thấy giường bên trong, lều tiếp nhận có ống khói lò, bạt chữ thập đỏ trải đất, cáng, đèn bão.
  - `bld_medical_hospital` (12×7): khối hành chính gạch hai tầng, ward gạch và ward Nissen nối hành lang, bãi đỗ xe cứu thương Dodge WC-54.
  - Y tá Lan: đầm sọc seersucker, mũ y tá trắng, túi cứu thương, bỏ băng tay. Chân dung mới đổ bóng mềm. Rig chung chỉ thêm tùy chọn (`stripe`, `held: 'medbag'`, `portrait.soft`); 6 nhân vật còn lại giống hệt từng pixel.

## Tham khảo

- pixelfx: [github.com/patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) (MIT, Patch và Hugo Duprez).
- Station Sick Quarters: [Silverstone](https://her.northamptonshire.gov.uk/Monument/MNN166889), [Metfield](https://heritage.suffolk.gov.uk/Monument/MSF49682).
- Bệnh viện Mỹ ở Anh: [Odstock](https://salisburyhealthcarehistory.uk/odstocks-beginnings-american-field-hospital/), [65th General](https://exhibits.mclibrary.duke.edu/sixty-fifth/life.html).
- Lều y tế: [med-dept.com](https://med-dept.com/articles/ww2-medical-tentage). Xe cứu thương: [Dodge WC series](https://en.wikipedia.org/wiki/Dodge_WC_series).
- Đồng phục y tá: [seersucker ANC](https://stewartsmilitaryantiques.com/us-wwii-army-nurse-seersucker-dress.23818.archive.htm), [QAIMNS](https://www.qaranc.co.uk/qarancgreyuniform.php).

## Kiểm tra

- Forge: 1.240 animation, 3.276 khung. Fonts: 318 + 318 glyph.
- `dotnet build Tools/UnityCompileChecks`: 0 lỗi, 0 cảnh báo.
- RulesChecks đều PASS (manifest: `fx_dust` 6 khung, `fx_quest_marker` 12 khung, `bld_medical` 4 khung).
- Build Windows thành công. Smoke **119/119 PASS** (`Tools/Smoke/hospital-dialog-fonts`), có check mới: font chính là WordwingVi, font Anh là WordwingEn, hộp thoại dùng khung mới, cỡ chữ là bội 16, mũi tên "tiếp" ẩn khi đang chạy chữ hoặc có lựa chọn.

## Còn lại

- Vẽ lại phần còn lại của căn cứ theo chuẩn này nếu người dùng duyệt khu y tế.
- Đặt hiệu ứng thư viện lên map (lửa phuy, chim, bướm, tia điện ở phòng thí nghiệm…).
- Chữ thập trên mái bị lệch ở hướng E/N/W (đẹp nhất ở hướng S, hướng đang dùng trên map).
- Màn kết quả vẫn ghi từ tiếng Anh bằng font Việt (dòng trộn Anh–Việt).

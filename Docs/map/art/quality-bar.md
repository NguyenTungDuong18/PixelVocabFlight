# Tiêu chuẩn chất lượng hình (bắt buộc)

Mọi model, nhân vật, chân dung, hiệu ứng, khung UI và glyph chữ, khi **tạo mới hoặc sửa**, phải đạt tiêu chuẩn này. Chuẩn tham chiếu: hiệu ứng của [pixelfx](https://github.com/patch-gg/pixelfx) (bản chép trong `Tools/PixelForge/vendor/pixelfx/`) và bản vẽ lại khu y tế (`bld_medical*`, `medic`, `Docs/history/23-Effects-Dialog-Fonts.md`). Luật đa dạng (phong cách kiến trúc, bóng dáng, màu riêng) và mức sàn theo từng loại: `Docs/design/art-direction.md`. Một sprite "chạy được" nhưng chưa đạt các mục dưới đây thì **chưa xong**.

Phong cách chung: căn cứ không quân năm 1944, ấm áp, dễ đọc kiểu nông trại pixel, nhưng chất liệu và đồ vật phải đúng thời chiến. Ánh sáng chiếu từ **trên-trái**, ban ngày, tông ấm.

## 1. Luật chung cho mọi hình

1. **Tư liệu thật trước khi vẽ.** Vật thể dựa trên đời thật (công trình, xe, máy bay, quân phục, dụng cụ) thì gọi `ww-research` trước và ghi nguồn vào mục Tham khảo của `Docs/history/NN-*.md`. Không lấy sprite, nhân vật, bảng màu hay bố cục của game khác làm mẫu.
   - **Model tham khảo trên Hugging Face** (`huggingface.co`: model hoặc dataset 3D như mesh `.glb/.gltf/.obj/.fbx/.ply`, các bộ kiểu Objaverse, ảnh dựng sẵn) được phép dùng.
     - Xem để lấy hình dáng, tỉ lệ, chi tiết: luôn được.
     - Đưa lưới vào pipeline (dựng bằng Blender như tay MakeHuman, `Tools/BlenderForge/`): chỉ khi giấy phép cho dùng thương mại và sửa đổi (CC0, CC-BY, MIT, Apache-2.0…). Giấy phép NC/ND, không ghi giấy phép, hoặc art lấy từ game khác thì chỉ xem tham khảo, không đưa vào.
     - Đưa vào thì lưu file gốc kèm `LICENSE.md` trong `Tools/BlenderForge/<tên>/` và ghi link, tác giả, giấy phép vào mục Tham khảo của `Docs/history/NN-*.md` (CC-BY bắt buộc ghi công). Màu, ánh sáng, viền mực vẫn vẽ bằng code theo chuẩn này; không để lộ nguyên texture gốc.
     - Chỉ tải file mesh/ảnh vào thư mục tạm riêng; không chạy code, notebook hay file pickle (`.bin`, `.pt`, `.pkl`) từ repo trên đó.
2. **Mỗi vật liệu có 3–4 tông:** tối, thường, sáng, cộng viền sáng 1 px ở mép hướng nắng (mép mái, góc tường, cạnh kim loại). Cấm tô một mảng một màu phẳng lớn hơn khoảng 6×6 px mà không có vân, dither hay chuyển tông.
3. **Viền mực sạch:** viền ngoài tối liền mạch, không đứt, không lởm chởm; viền trong mảnh hơn hoặc nhạt hơn viền ngoài. Không để pixel lẻ (pixel mồ côi) ở mép.
4. **Bóng đổ hai tầng:** bóng đặc sát chân và bóng mềm xa hơn, đổ về phía dưới-phải.
5. **Bề mặt có "lịch sử":** ít nhất 2 dấu vết trong số: gỉ, rêu chân tường, bùn, vết dầu, sơn bong, miếng vá, vệt nước ở máng xối. Đồ quân sự không bóng loáng như mới.
6. **Điểm sáng ấm:** công trình có ít nhất một nguồn sáng ấm (cửa sổ, đèn, lò) màu khoảng `#F2B65A` để có điểm nhấn giữa tông lạnh của kẽm, bạt, kim loại.
7. **Kể chuyện bằng đồ vật:** công trình có đồ vật phụ đặt lệch, không thẳng hàng tuyệt đối, cho biết ai dùng chỗ này (cáng dựa tường, phuy, dây phơi, xe đậu…), nhưng không lấn ra ngoài chân đế.
8. **Đọc được ở 1×:** soát ở tỉ lệ thật, không chỉ ở ảnh phóng to. Chi tiết 1 px lấm tấm mà ở 1× thành nhiễu thì gộp lại hoặc bỏ.
9. **Bảng màu:** dùng `PAL`/ramp có sẵn trong `lib.cjs` và `world/common.cjs`; ramp mới đặt tên rõ và dùng lại, không rải hex lẻ khắp hàm vẽ.
10. **Xác định:** mọi ngẫu nhiên lấy từ `hash/noise` hoặc seed, không dùng `Math.random()`. Chạy forge hai lần phải ra cùng ảnh.

## 2. Model voxel (`world/*.cjs`)

- **Hình khối nhận dạng được** ngay từ bóng đen: không phải một khối hộp đơn. Có ít nhất một khối phụ thấp hơn hoặc lệch (nhà phụ, hiên, mái hắt, hành lang).
- **Chi tiết kiến trúc tối thiểu:** máng xối hoặc ống thoát, khung cửa sổ có kính phản sáng, cửa có bậc hoặc lối đi, mái có vân (ngói, tôn gợn, bạt nếp gấp).
- **Chuyển động nhỏ lặp 4 khung** khi hợp lý (khói ống khói, cờ, dây phơi, đèn chập chờn, cửa lều lay): 4 khung @6 fps, loop. Model đang đặt trên map mà đổi số khung thì phải sửa cùng lúc `WorldModels.cs` và bảng contract trong `Tools/RulesChecks/World/WorldChecks.cs`.
- **4 hướng đều đẹp,** riêng hướng đang dùng trên map phải đẹp nhất. Chữ, biển, chữ thập trên mái phải đọc đúng (không ngược, không méo) ở hướng đó.
- **Không voxel ngoài lưới** (forge cảnh báo `[voxel] … outside the grid` là lỗi phải sửa với model mới hoặc model đang sửa).
- **Giữ id và chân đế** của model đang trên map. Đổi chân đế là việc riêng, phải đồng bộ C#.
- Helper dùng chung giữa hai module thì chép theo khối đánh dấu (`// ---------- Medical kit` … `End medical kit`), sửa một bên phải chép sang bên kia.

## 3. Nhân vật và chân dung (`characters/`)

- Giữ khung 24×32, anchor (12,30), idle 8 @5, walk 8 @16, run 8 @20, W lật từ E.
- **Đọc được vai trò ở 24×32** qua 2–3 dấu hiệu lớn (mũ, màu áo, đồ cầm), bỏ chi tiết nhỏ hơn 2 px (nút, huy hiệu, cầu vai).
- **Chuyển động có trọng lượng:** idle có thở ngực 1 px và chớp mắt; walk có contact ở khung 0 và 4, đầu trễ 1 khung; đồ cầm có quán tính (túi trĩu khi đứng, lắc nhẹ khi đi).
- **Rig dùng chung:** tính năng mới phải là tùy chọn (chỉ chạy khi nhân vật khai báo). Sau khi sửa rig, so pixel cả roster: nhân vật không khai báo tùy chọn mới phải **0 pixel khác**.
- **Chân dung** 48×48: bóng mặt mềm bằng dither, sáng trên-trái, mắt có mống và điểm sáng, tóc có lọn, nền ấm. Tham chiếu: `portrait_medic` (`portrait.soft`).

## 4. Hiệu ứng (`units/effects.cjs`, `pfx.cjs`, `characters/cycles.cjs`, `world/nature.cjs`)

- **Dải màu nóng → nguội:** lõi trắng → vàng → cam → đỏ → khói xám. Dùng `kit.FIRE` / `kit.SMOKE` trong `pfx.cjs`, không tự chế dải mới cho lửa.
- **Ánh sáng là lớp riêng:** quầng sáng (light) 1–3 px quanh lửa, tia lửa, tia điện; trên nền trong suốt nó thành viền sáng mờ.
- **Đà chuyển động:** bùng nhanh (1–2 khung), tan chậm. Hiệu ứng nổ mở đầu bằng khung chớp trắng. Không có khung nào chỉ là "đốm tròn phóng to" của khung trước.
- **Khói mờ thật** (alpha), không dùng lưới dither ô cờ cho khói.
- **Lửa là khối liền** (`kit.flames`), không phải các chấm tròn rời.
- **Canvas nhỏ (8–16 px):** ưu tiên hình rõ ở 1×; tia 1 px chỉ dùng khi có lõi sáng đi kèm, không để lấm tấm tan biến.
- **Giữ tên, kích thước canvas và loop** của hiệu ứng C# đang dùng (C# đặt chúng vào khung chữ nhật cố định; đổi canvas làm lệch cỡ pixel). Đổi số khung thì Grep tên sprite trong `Scripts/` và `Tools/RulesChecks/` trước. Ràng buộc hiện có: `fx_explosion` 8 khung, `fx_lock_reticle` 8 khung (0–5 theo tiến độ khóa, 6–7 nhấp nháy), `bomber_guns` theo `GunDeployFrames`, `fx_dust` 16×8 anchor (8,7).
- **Hiệu ứng lấy từ pixelfx:** đi qua `pfx.cjs` (render 10–12 fps, cắt theo hộp bao chung, anchor = origin), đổi `palette` cho hợp tông ấm ban ngày, không đưa hình nộm (actor) của họ vào game. Sửa file trong `vendor/` thì đánh dấu `WORDWING:` và ghi vào `vendor/pixelfx/README.md`.

## 5. Khung UI (`ui/`)

- Nine-slice: mọi chi tiết (đinh tán, ke góc, vân, ố) nằm ở **góc và viền**; vùng bị kéo giãn phải đều để không thành vệt (`assertSliceable` trong `ui/dialog.cjs` kiểm việc này).
- Chất liệu thời chiến: gỗ, đồng thau, giấy kem, men sơn olive, kim loại sơn. Nền và chữ tương phản rõ: giấy sáng đi với `UiKit.Ink`, nền tối đi với `UiKit.Cream`.
- Trạng thái chọn/hover khác biệt bằng cả độ sáng và viền (không chỉ đổi màu chữ).

## 6. Chữ (`fonts/`)

- Nét 1 px đều, khoảng chữ 1 px, dấu câu cân. Dấu tiếng Việt chồng (ấ ầ ẩ ẫ ậ, Ẩ Ể Ổ) tách rõ, không dính chữ hay dính nhau.
- Thêm chữ hoặc chuỗi mới trong game: chạy `node Tools/PixelForge/fonts.cjs`; lệnh báo thiếu ký tự thì vẽ thêm glyph, không bỏ qua.
- Trong Unity chỉ dùng cỡ bội 16 (`UiKit.Px`, `UiKit.Fit` đã làm tròn). Không bật Best Fit, không dùng synthetic bold với font Wordwing.

## 7. Quy trình duyệt (bắt buộc trước khi báo xong)

1. **Ảnh trước/sau** đặt cạnh nhau, cùng tỉ lệ: render bản cũ **trước khi sửa**. Model: `preview-models.cjs` scale 3, đủ 4 hướng và các khung động. Nhân vật: idle/walk/run 4 hướng và chân dung. Hiệu ứng: mọi khung trên cả nền trời (màn bay) và nền cỏ (căn cứ); có thể dùng script so sánh với hiệu ứng pixelfx cùng loại.
2. **Soát ở 1×** (hoặc ảnh smoke trong game), không chỉ ảnh phóng to.
3. **Tự chấm theo checklist** dưới đây; mục nào không đạt thì sửa tiếp, không báo xong.
4. **Kiểm tra máy:** forge không lỗi và không cảnh báo voxel mới; RulesChecks PASS; thay đổi hiện trong game thì build và smoke, soát ảnh smoke liên quan.
5. Báo cáo kèm đường dẫn ảnh trước/sau để người dùng duyệt.

### Checklist

| # | Câu hỏi | Áp dụng |
| --- | --- | --- |
| 1 | Nhận ra vật thể chỉ từ bóng đen? | model, nhân vật |
| 2 | Mỗi vật liệu có 3–4 tông và viền sáng hướng nắng? | tất cả |
| 3 | Viền mực liền, không pixel mồ côi? | tất cả |
| 4 | Có bóng đổ hai tầng? | model, nhân vật |
| 5 | Có ít nhất 2 dấu vết "lịch sử"? | model |
| 6 | Có điểm sáng ấm? | công trình |
| 7 | Chuyển động có đà (bùng nhanh, tan chậm / quán tính)? | hiệu ứng, nhân vật, model động |
| 8 | Khói mờ thật, lửa là khối liền, nổ có khung chớp trắng? | hiệu ứng |
| 9 | Đọc rõ ở 1×, không nhiễu lấm tấm? | tất cả |
| 10 | Giữ tên, canvas, anchor, chân đế, số khung mà C# cần (hoặc đã đồng bộ C# và RulesChecks)? | tất cả |
| 11 | Rig/helper dùng chung không làm đổi hình khác (so pixel)? | nhân vật, model |
| 12 | Có ảnh trước/sau và nguồn tư liệu? | tất cả |

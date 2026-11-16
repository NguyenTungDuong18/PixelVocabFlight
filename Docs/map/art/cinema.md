# Phim mở màn dựng sẵn (`Tools/PixelForge/cinema/`)

Intro 10 giây và nền menu **không còn là sprite**: đó là một đoạn phim pixel 480×270, 30 fps, dựng từng khung bằng bộ dựng 3D phần mềm viết bằng Node rồi đóng gói thành một file cho Unity phát (`Unity/Menu/TitleScene/`, xem `unity/menu-save-settings.md`).

```text
node Tools/PixelForge/cinema/film.cjs                      # dựng 540 khung (~35 s trên 14 nhân) + ghi Art/Resources/Cinema/title_intro.bytes (~21 MB)
node Tools/PixelForge/cinema/film.cjs --frames 100-140 --step 4 --sheet <thư mục>   # bảng 3×4 khung 1:1 để soát, không ghi file game
node Tools/PixelForge/cinema/film.cjs --frames 129 --png <thư mục>                  # một khung phóng ×2
```

Forge **không** chạy bước này. Sửa bất kỳ file nào dưới đây thì chạy lại `film.cjs` (không tham số) trước khi build. Lưới máy bay được lưu đệm ở `%TEMP%/wordwing-cinema-<hash của models.cjs>`.

## File

| File | Việc |
| --- | --- |
| `core.cjs` | vector, nhiễu xác định, camera phối cảnh (`makeCam`: pos, target, roll, fov), `flyBasis`, **bảng màu phim** (`RAMPS` → `PALETTE` ≤ 256 màu, `nearest` + Bayer) |
| `sky.cjs` | bộ đệm khung, vòm trời hoàng hôn (`SUN` thấp ở hướng +x), mây ti, biển mây `deckH` (lặp mỗi `DECK_P` = 2400 m theo y), mây khối = cầu impostor trộn độ sâu, tô theo pháp tuyến màn hình |
| `world.cjs` | trường mây: `deck(off)` (một chu kỳ lặp lại), `FAR` (tháp mây giông, cột khói), `cumulus`/`tower`/`column` |
| `models.cjs` | máy bay dạng SDF + hàm sơn: `velmark` (ta), `kruland` (địch), `heavy` (oanh tạc cơ 4 động cơ, đuôi kép) và các mảnh vỡ `heavy_wing/_body/_tail`, `kruland_wing/_body`; `meshes()` biến SDF thành lưới (surface nets) + 3 mức LOD |
| `mesh.cjs` | tô tam giác vào G-buffer, tô bóng trễ (sơn tính theo từng pixel, nắng + trời + đèn điểm của lửa), viền mực, đĩa cánh quạt, nét chữ thập cho máy bay xa |
| `fx.cjs` | lớp trong suốt (khói `s`, lửa `f` → bộ đệm nhiệt, sáng cộng `g`, vạch `l`, dải hơi `t`, mảnh `d`) và thư viện hiệu ứng **thuần theo thời gian**: `explosion`, `flak`, `smokeTrail`, `fireJet`, `tracers`, `hit`, `contrail` |
| `post.cjs` | nhiệt → dải lửa, bloom, vệt ngang, chớp, khung impact, lệch màu, trắng mây / lửa / khói phủ ống kính (`wash`), vòng ngắm (`sight`), vignette, **lượng tử về bảng màu** |
| `shots.cjs` | **kịch bản**: `STARTS` (mốc 8 cảnh), `shot1`…`shot8`, `CUE_T` (cue âm thanh/logo), `sceneAt(khung)` |
| `film.cjs` | dựng song song bằng worker, bảng xem, đóng gói `WWC1` |

## Muốn sửa gì

| Muốn sửa | Mở |
| --- | --- |
| Thời lượng, thứ tự, góc máy, đường bay, lúc nổ của một cảnh | `shots.cjs` hàm `shotN` (u = giây tính từ đầu cảnh) |
| Lúc phát tiếng súng/nổ/whoosh, lúc logo đập vào, lúc thu letterbox | `shots.cjs` `CUE_T` (giây) |
| Hình dáng, màu sơn máy bay | `models.cjs` (`velSdf`/`velPaint`, `krSdf`/`krPaint`, `hvSdf`/`hvPaint`) |
| Dáng vụ nổ, flak, khói, đạn vạch | `fx.cjs` nửa dưới |
| Màu trời, mây, độ mù | `sky.cjs` (`K`, `FOG`), ramp `sky`/`cloud` trong `core.cjs` |
| Độ lóa, bloom, độ rung dither | `post.cjs` |

## Bẫy

- **Vòng lặp menu (khung 300–539) phải khép kín:** mọi thứ trong `shot8` chạy theo đồng hồ tuần hoàn `tl` (chu kỳ `LOOP` = 8 s): nhấp nhô dùng số chu kỳ nguyên, mây trượt đúng một `DECK_P`, flak/nổ xa dùng `tau = (tl - pha) mod LOOP` và phải tắt trước khi hết chu kỳ. Thứ chỉ xảy ra một lần đặt trong nhánh `t < INTRO`.
- Hiệu ứng không có trạng thái: vị trí tính từ tuổi `tau`, không cộng dồn giữa các khung. Đừng dùng `Math.random()`.
- Thêm màu mới thì thêm vào `RAMPS` (tổng ≤ 256); vật không có màu gần trong bảng sẽ bị hút sang ramp khác (ví dụ mây ngả xanh olive).
- Cue phải nằm trước khung `LOOP_START`; smoke test yêu cầu ≥ 6 cue Shot, 1 cue Title, 1 cue BarsOff, ≥ 3 cue nổ.
- Định dạng `WWC1` (đầu `film.cjs`) là hợp đồng với `TitleScene.Film.cs`: đổi thì sửa cả hai.
- `Tools/PixelForge/story/intro.cjs`, `introFx.cjs`, `introBg.cjs` là intro sprite cũ: còn trên đĩa nhưng không được forge gọi.

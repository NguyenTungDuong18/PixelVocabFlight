# Phim mở màn dựng sẵn (`Tools/PixelForge/cinema/`)

Intro 10 giây và nền menu **không còn là sprite**: đó là một đoạn phim pixel 480×270, 30 fps, dựng từng khung bằng bộ dựng 3D phần mềm viết bằng Node rồi đóng gói thành một file cho Unity phát (`Unity/Menu/TitleScene/`, xem `unity/menu-save-settings.md`).

```text
node Tools/PixelForge/cinema/film.cjs                      # dựng 540 khung (khoảng 1 phút trên 14 nhân) + ghi Art/Resources/Cinema/title_intro.bytes (~22 MB)
node Tools/PixelForge/cinema/film.cjs --frames 100-140 --step 4 --sheet <thư mục>   # bảng 3×4 khung 1:1 để soát, không ghi file game
node Tools/PixelForge/cinema/film.cjs --frames 129 --png <thư mục>                  # một khung phóng ×2
```

Forge **không** chạy bước này. Sửa bất kỳ file nào dưới đây thì chạy lại `film.cjs` (không tham số) trước khi build. Lưới máy bay được lưu đệm ở `%TEMP%/wordwing-cinema-<hash của models.cjs>`.

## File

| File | Việc |
| --- | --- |
| `core.cjs` | vector, nhiễu xác định, camera phối cảnh (`makeCam`: pos, target, roll, fov), `flyBasis`, **bảng màu phim** (`RAMPS` → `PALETTE` ≤ 256 màu, `nearest` + Bayer) |
| `sky.cjs` | bộ đệm khung, vòm trời hoàng hôn (`SUN` thấp ở hướng +x), mây ti, **tầng mây rách** `deckH`/`deckCov` (lặp mỗi `DECK_P` = 2400 m theo y; `clearing` = khoảng trống trên cảng ở cảnh 1–7; `portHoleE` = lỗ mây cố định trên cảng nam ở loop), dựng tia xuống mặt đất và mặt nước (gọi `ground.cjs`; nước theo Fresnel: nhìn chúc xuống thì tối chàm, nhìn xiên thì sáng hồng; gợn, lấp lánh, vệt phản chiếu lửa, phản chiếu cột khói), vệt nắng trên biển, bóng mây và bóng cột khói |
| `clouds.cjs` | `drawClouds`: mây khối = cầu impostor dò theo tia, fbm uốn hình, đáy phẳng chìm vào tầng mây, mép mềm (alpha theo độ dày, buffer `ca`), bóng tự đổ, viền bạc theo múi, mờ khí quyển riêng; khói cột (kind 2) dùng ramp `smoke` |
| `ground.cjs` | **bản đồ chiến trường** ở z = `ZG` (−1200 m): bờ biển bắc–nam (biển phía đông), sông, cảng (`PORT`: bể cảng có tàu, bến răng lược, cầu gãy, bồn dầu, nhà thờ, khu phố cháy rụi), **cảng nam** `SP` (cửa sông ngang, bến răng lược, bể, đê, kho, cần cẩu, bãi bể dầu, tàu cháy/lật/chạy) = vùng `LOOP_PORT` mà camera loop nhìn thấy, khu phố nhìn xa theo khối nhà (cháy / cháy rụi / mái tối), dải đất cháy, vật liệu đất/nước/lửa, danh sách cột khói `COLS` |
| `world.cjs` | trường mây: `deck(off)` (một chu kỳ lặp lại, cho cảnh 8; tan các puff che đường nhìn xuống cảng), `deckWorld()` (cảnh 1–7), `FAR` (tháp mây giông), `deckField`/`massAt` (ô mây gom thành mảng liền theo trường khối), `cumulus`/`tower` |
| `battle.cjs` | **sự kiện hậu cảnh** theo thời gian, gọi từ `sceneAt` qua `populate(sc, { t, shot, loopT })`: cột khói cuộn (`plume`), chuỗi bom (`chain`), nổ bồn dầu/tàu (`blowUp`), ụ cao xạ 2 cm/3,7 cm theo trận địa (`guns`: dòng đạn vạch là chuỗi hạt cong theo nòng lia, tự huỷ thành đốm khói, chớp nòng), máy bay cháy rơi; `CUES` = cue âm thanh loại 13 (ì ầm bom) |
| `models.cjs` | máy bay dạng SDF + hàm sơn: `velmark` (ta), `kruland` (địch), `heavy` (oanh tạc cơ 4 động cơ, đuôi kép) và các mảnh vỡ `heavy_wing/_body/_tail`, `kruland_wing/_body`; `meshes()` biến SDF thành lưới (surface nets) + 3 mức LOD |
| `mesh.cjs` | tô tam giác vào G-buffer, tô bóng trễ (sơn tính theo từng pixel, nắng + trời + đèn điểm của lửa), viền mực, đĩa cánh quạt, nét chữ thập cho máy bay xa |
| `fx.cjs` | lớp trong suốt (khói `s` có `core`/`bot`/`hollow`, lửa `f` → bộ đệm nhiệt, sáng cộng `g`, vạch `l`, dải hơi `t`, mảnh `d`, vòng sóng `o`, lưỡi lửa `k`, khúc xạ `w`, vệt ngang ống kính `h`) và thư viện hiệu ứng **thuần theo thời gian**: `explosion` (nhiều lớp; `o.kind` = `big`/`mid`/`far`, `o.pre` tiền chớp, `o.age`/`o.soot` cho slow-motion), `flak`, `smokeTrail`, `fireJet`, `tracers`, `hit`, `contrail`; `kickAt` = cú giật máy quay |
| `post.cjs` | nhiệt → dải lửa, bloom (`post.bloom`), ngả hổ phách (`post.amber`), vệt ngang, chớp, khung impact, lệch màu, trắng mây / lửa / khói phủ ống kính (`wash`, nhiều lớp có `speed`/`scale`/`streak`), vòng ngắm (`sight`), vignette, **lượng tử về bảng màu** |
| `shots.cjs` | **kịch bản**: `STARTS` (mốc 8 cảnh), `shot1`…`shot8`, `CUE_LIST` (cue âm thanh/logo: `{ k, t, pan, level, dur }`), `KICK` + `sc.kicks` (cú giật theo từng vụ nổ), `warp4`/`hitStop` (giữ khung, slow-motion), `sceneAt(khung)` |
| `film.cjs` | dựng song song bằng worker, áp rung nền `sc.shake` và cú giật `sc.kicks`, bảng xem, đóng gói `WWC2` |
| `viewer.html` | **xem phim ngoài game**: mở bằng trình duyệt, kéo thả `title_intro.bytes` (đọc WWC1/WWC2), tua từng khung, hiện cue; chọn thêm file WAV của `Tools/AudioChecks` để phát đồng bộ |

## Muốn sửa gì

| Muốn sửa | Mở |
| --- | --- |
| Thời lượng, thứ tự, góc máy, đường bay, lúc nổ của một cảnh | `shots.cjs` hàm `shotN` (u = giây tính từ đầu cảnh) |
| Lúc phát tiếng súng/nổ/whoosh, lúc logo đập vào, lúc thu letterbox | `shots.cjs` `CUE_LIST` (giây, pan, level, dur); ì ầm bom xa: `battle.cjs` `CUES` |
| Độ mạnh, tần số, độ dài cú giật máy quay khi nổ | `shots.cjs` `KICK` (preset `wing`, `ahead`, `engine`, `flaknear`, `flakmid`, `far`, `hit`); rung nền: `sc.shake` trong từng `shotN` |
| Hình dáng, màu sơn máy bay | `models.cjs` (`velSdf`/`velPaint`, `krSdf`/`krPaint`, `hvSdf`/`hvPaint`) |
| Dáng vụ nổ, flak, khói, đạn vạch | `fx.cjs` nửa dưới |
| Thành phố cảng, bờ biển, sông, vị trí cột khói | `ground.cjs` (`PORT` cho cảnh 1–7, `SP`/`LOOP_PORT` cho cảnh 8 và nền menu, `COLS`) |
| Hình khối, ánh sáng mây khối | `world.cjs` (`deckField`, `cumulus`, `tower`), `clouds.cjs` |
| Màu nước, phản chiếu lửa trên nước | `sky.cjs` `drawSky` đoạn "the ground" |
| Chuỗi bom, nổ bồn dầu, cao xạ, máy bay cháy rơi ở hậu cảnh | `battle.cjs` |
| Màu trời, mây, độ phủ mây, độ mù, vệt nắng trên biển | `sky.cjs` (`K`, `FOG`, `deckCov`), ramp `sky`/`cloud`/`land`/`rubble`/`soot`/`ember`/`port`/`dock`/`flak` trong `core.cjs` |
| Độ lóa, bloom, độ rung dither | `post.cjs` |

## Cue âm thanh (`WWC2`)

Mỗi cue 6 byte: `u8 kind, u16 khung, i8 pan (−100 trái … +100 phải), u8 level (0–200, 100 chuẩn), u8 dur (khung; 0 = mặc định của loại)`. Cue là lúc tiếng **bắt đầu nghe thấy**: tiếng sát đặt đúng khung hình, tiếng xa trễ 0,3–0,8 s. Loại (`KIND` trong `shots.cjs` ↔ `TitleScene.Cue…` ↔ `CinemaKind`): 0 shot, 1 burst (súng ta), 2 boom, 3 bigboom, 4 whoosh, 5 flak, 6 title, 7 barsoff, 8 hit, 9 cannon (pháo địch), 10 gunners (súng tự vệ xa), 11 flaknear, 12 heavypass, 13 rumble (bom dưới đất), 14 fire, 15 fireball. Âm thanh được trộn sẵn từ danh sách cue này (`unity/audio.md`).

## Bẫy

- **Vòng lặp menu (khung 300–539) phải khép kín:** mọi thứ trong `shot8` chạy theo đồng hồ tuần hoàn `tl` (chu kỳ `LOOP` = 8 s): nhấp nhô dùng số chu kỳ nguyên, mây trượt đúng một `DECK_P`, flak/nổ xa dùng `tau = (tl - pha) mod LOOP` và phải tắt trước khi hết chu kỳ. Thứ chỉ xảy ra một lần đặt trong nhánh `t < INTRO`. Cú giật (`sc.kicks`) không bao giờ áp từ khung 300.
- **Mặt đất trong vòng lặp đứng yên:** khi `sc.deck.loop` bật, chỉ tầng mây, puff mây và bóng mây trên đất trượt theo `sc.deck.off` (phải lặp theo y đúng `DECK_P`); mặt đất, lớp khói thấp, cảng nam, ụ pháo, chuỗi bom và cột khói theo toạ độ thế giới, chỉ lặp theo thời gian. Đổi `LOOP_PORT` thì lỗ mây (`portHoleE`, `deck()`) tự theo vì đọc lúc chạy; giữ cảng ở phần ba dưới phải, tránh vùng logo/menu (x < 130 trên 480) và thanh hướng dẫn cuối menu (y ≥ 249).
- Hiệu ứng không có trạng thái: vị trí tính từ tuổi `tau`, không cộng dồn giữa các khung. Đừng dùng `Math.random()`.
- Thêm màu mới thì thêm vào `RAMPS` (tổng ≤ 256, hiện 224); vật không có màu gần trong bảng sẽ bị hút sang ramp khác (ví dụ mây ngả xanh olive).
- Cue phải nằm trước khung `LOOP_START`; smoke test yêu cầu ≥ 6 cue Shot, 1 cue Title, 1 cue BarsOff, ≥ 3 cue nổ.
- Chớp trắng toàn khung ≤ 3 khung liên tiếp và cách nhau ≥ 0,5 s; rung do nổ ≤ 1,3 s, roll ≤ 1°, tần số ≤ 10 Hz (phim 30 fps).
- Định dạng `WWC2` (đầu `film.cjs`) là hợp đồng với `Audio/Cinema/CinemaFilm.cs` (đọc cả `WWC1`) và `viewer.html`: đổi thì sửa cả ba.
- Sửa cue hoặc thời điểm nổ thì chạy lại `Tools/AudioChecks` để nghe bản trộn mới.
- `Tools/PixelForge/story/intro.cjs`, `introFx.cjs`, `introBg.cjs` là intro sprite cũ: còn trên đĩa nhưng không được forge gọi.

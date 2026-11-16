# 25. Phim mở màn dựng sẵn từng khung (sau 0.15)

## Người chơi thấy gì

Mười giây mở game được làm lại hoàn toàn thành một đoạn phim pixel 480×270, 30 khung/giây, dựng từng khung bằng camera 3D thật (không còn ghép sprite lên nền). Bối cảnh: hoàng hôn trên biển mây, một dòng hơn 140 oanh tạc cơ hạng nặng Kruland bị tiêm kích Velmark chặn đánh giữa lưới flak.

| # | Giây | Cảnh | Góc máy | Cháy nổ, hiệu ứng |
|---|---|---|---|---|
| 1 | 0,0–1,6 | Xuyên mây, đối đầu cả dòng oanh tạc cơ xếp tầng tới chân trời | tele 30°, bay ngược chiều; động cơ một chiếc lao thẳng vào ống kính làm "cú quét" chuyển cảnh | flak nổ khắp trời, vệt ngưng tụ, một chiếc trúng đạn bốc lửa |
| 2 | 1,6–2,6 | Bốn tiêm kích ta lật ngửa bổ nhào từ phía mặt trời | góc thấp nhìn lên, máy bay lướt cách ống kính 10 m rồi máy whip theo xuống đàn oanh tạc | lóa nắng, rung |
| 3 | 2,6–3,9 | Xả súng đối đầu vào chiếc dẫn đầu | bám đuôi lệch vai | chớp nòng, đạn vạch cam của ta và xanh của xạ thủ địch, flak nổ sát, động cơ địch bùng cháy |
| 4 | 3,9–4,7 | Cánh oanh tạc cơ nổ đứt | tele ngang 27°, slow-motion nửa tốc độ 0,33 s | 1 khung impact hai màu, cầu lửa, nổ thứ cấp, cánh xoay rơi, tiêm kích ta quét qua tiền cảnh |
| 5 | 4,7–5,7 | Bị ba tiêm kích xám phục kích từ phía mặt trời | camera trên mũi máy bay, có vòng ngắm | đạn vạch xanh bay thẳng vào ống kính, tia lửa trên cánh, địch gầm qua hai bên |
| 6 | 5,7–7,0 | Quần vòng, chân trời nghiêng 75° | camera gắn thân máy bay ta | vệt hơi đầu cánh, loạt đầu trượt, loạt sau trúng, địch bốc cháy |
| 7 | 7,0–8,2 | Địch nổ ngay trước mũi, ta bay xuyên cầu lửa | POV qua vòng ngắm | khung impact, lửa rồi khói phủ kín ống kính, mảnh cánh xoay sượt qua |
| 8 | 8,2–10 | Thoát khỏi khói: tiêm kích ta dẫn đội, trận đánh phía sau | rộng 39°, ổn định dần | logo đập vào ở 8,95 s cùng một oanh tạc cơ nổ phía xa; letterbox thu từ 8,65 s |

Sau 10 giây là đoạn lặp 8 giây (240 khung) khép kín làm nền menu: máy bay ta ở bên phải, đàn oanh tạc cùng flak, đạn vạch và ba vụ nổ xa lặp lại phía sau, biển mây trôi.

Âm thanh theo cue nằm trong file phim: `burst`, `boom`, và 5 clip tổng hợp mới `bigboom`, `whoosh`, `flak`, `hit`, `title`.

## Kỹ thuật

- **Bộ dựng** `Tools/PixelForge/cinema/` (Node, không phụ thuộc mới): vòm trời theo hướng nhìn, biển mây + mây khối bằng cầu impostor trộn độ sâu, máy bay SDF → lưới tam giác 4 mức LOD với hàm sơn tính theo pixel, tô bóng trễ, hiệu ứng hạt thuần theo thời gian, bloom, rồi lượng tử về bảng 180 màu với dither Bayer. Chi tiết: `Docs/map/art/cinema.md`.
- **Model mới:** oanh tạc cơ hạng nặng Kruland (4 động cơ, đuôi kép, mũi kính, 3 tháp súng) và các mảnh vỡ cắt từ SDF. Velmark và Kruland giữ hình dáng cũ, thêm phi công, bể tản nhiệt, cột ăng-ten.
- **File phim** `Art/Resources/Cinema/title_intro.bytes` (định dạng `WWC1`: bảng màu, cue, mỗi khung nén DEFLATE riêng, ~21 MB). Unity giải nén từng khung vào một texture 480×270 (`Unity/Menu/TitleScene/TitleScene.Film.cs`).
- Intro sprite cũ (`title_intro_*`, 191 PNG) không còn được forge sinh; mã nguồn `Tools/PixelForge/story/intro*.cjs` vẫn giữ trên đĩa.

## Lệnh

```text
node Tools/PixelForge/cinema/film.cjs      # dựng lại phim + ghi file game (chạy sau khi sửa cinema/*.cjs)
```

## Tham khảo (ngôn ngữ điện ảnh, không sao chép hình)

- Dunkirk, camera gắn cánh và buồng lái: [British Cinematographer](https://britishcinematographer.co.uk/?p=8616), [ASC](https://theasc.com/articles/dunkirk-wrangling-two-large-formats), [DGA Quarterly](https://www.dga.org/craft/dgaq/issues/1703-summer-2017/wwii-dunkirk).
- Masters of the Air, rung máy nhiều lớp và flak: [IBC](https://ibc.org/features/behind-the-scenes-masters-of-the-air/10805.article), [Art of VFX](https://artofvfx.com/masters-of-the-air-vfx-breakdown-by-dneg).
- Nhịp cắt trailer: [Stephen Follows](https://stephenfollows.com/many-shots-average-movie/), [Derek Lieu](https://derek-lieu-yrd2.squarespace.com/blog/2023/4/23/more-trailer-editing-is-not-better-trailer-editing).
- Impact frame, smear: [Bloop](https://www.bloopanimation.com/the-art-of-smear-frames/). Quỹ đạo kiểu Itano: [animetudes](https://animetudes.com/2021/04/23/graviton-gainax-and-the-itano-school/).
- Giải phẫu vụ nổ: [realtimevfx](https://realtimevfx.com/t/stylized-frag-launcher-explosion-overwatch-inspiration-breakdown-posted/1894?page=2). Rung máy kiểu trauma: [GDC Vault](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing).
- Combat box, flak, đạn vạch, contrail: [Combat box](https://en.wikipedia.org/wiki/Combat_box), [AF Museum](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/1513340/combat-box-bomber-formations), [American Air Museum](https://www.americanairmuseum.com/media/4748), [Tracer](https://en.wikipedia.org/wiki/Tracer_round), [AMS Glossary](https://glossarystaging.ametsoc.net/wiki/Aerodynamic_trail).

# 26. Phim mở màn: cháy nổ nhiều lớp, chiến trường bên dưới, âm thanh trộn sẵn (sau 0.15)

## Người chơi thấy và nghe gì

Tám cảnh, đường máy quay, đường bay và nhịp cắt của phim mở màn (mục 25) giữ nguyên. Ba thứ được làm lại:

- **Vụ nổ nhiều lớp.** Mỗi vụ nổ giờ đi qua: nhiên liệu phun và đốm lửa báo trước, chớp lõi 2–3 khung, cầu lửa nở tới 80% trong 3 khung, lửa cuộn ba tầng màu, lưỡi lửa tỏa gai, một vòng sóng xung kích có khúc xạ, khói đen cuộn có lõi đỏ và đáy hắt cam, tia lửa, tàn lửa lơ lửng, mảnh vỡ lớn kéo đuôi lửa rồi khói, dòng nhiên liệu cháy rơi thành vệt. Nổ phụ lệch 0,1–0,3 giây. Hai cú lớn nhất (cánh oanh tạc cơ nổ đứt, tiêm kích nổ trước mũi) giữ hình 2 khung. Flak có lõi đỏ nháy và cụm khói đen kiểu bỏng ngô. Lửa động cơ có ba tầng và phụt ngược.
- **Rung có trọng lượng.** Mọi vụ nổ và flak sát trong intro hất máy quay ra xa tâm nổ rồi dao động tắt dần như lò xo (7,5–10 Hz), kèm nghiêng nhẹ (≤ 1°) và zoom vài phần trăm; mạnh nhất khoảng 10 px ở cú nổ trước mũi. Nổ xa rung nhẹ và đến trễ. Đoạn lặp nền menu không rung.
- **Biết đang đánh ở đâu.** Tầng mây đặc thành mây rách; bên dưới (thấp hơn máy bay khoảng 4 km) là một thành phố cảng ven biển của Velmark đang bị ném bom: bờ biển chạy bắc–nam với biển phía mặt trời, sông, bể cảng có tàu cháy và tàu lật, bến răng lược, kho cháy, cụm bồn dầu cháy, cầu gãy, khu phố cháy rụi quanh nhà thờ. Ba cột khói dầu khổng lồ vươn tới độ cao máy bay rồi tỏa hình đe theo gió tây; chuỗi bom nổ lan qua thành phố, bồn dầu và tàu phát nổ, ụ cao xạ chớp nòng và bắn đạn vạch lên, một oanh tạc cơ cháy rơi kéo vệt khói xuống đất.
- **Âm thanh làm lại toàn bộ**, 44,1 kHz stereo: động cơ tiêm kích ta, tiếng ù có phách của đàn oanh tạc cơ, gió chỉ còn dải cao, súng máy của ta (13 phát/giây, đanh), pháo địch (11 phát/giây, trầm và nặng), súng tự vệ lách tách từ xa, flak xa và flak sát có mảnh đạn gõ vỏ, nổ vừa, nổ lớn có tiếng kim loại xé và mảnh vỡ rít, bay xuyên cầu lửa có đoạn bịt tai và ù tai, ì ầm bom dưới thành phố, máy bay lướt qua có Doppler. Nền tự hạ xuống ngay trước và sau cú nổ lớn; tiếng lệch trái phải theo vị trí trên màn hình.

## Kỹ thuật

- **Phim** (`Tools/PixelForge/cinema/`): `fx.cjs` thêm primitive `k` (lưỡi lửa), `w` (khúc xạ), `h` (vệt ngang ống kính) và các tùy chọn của khói/lửa; `explosion` có ba cỡ. `shots.cjs`: `KICK` + `sc.kicks` (cú giật, `film.cjs` áp lên máy quay), `hitStop`/`warp4`, `CUE_LIST`. File mới `ground.cjs` (bản đồ chiến trường, dựng tia từ `sky.cjs`) và `battle.cjs` (sự kiện hậu cảnh và cue ì ầm bom). Bảng màu 180 → 208. Dựng cả phim khoảng 1 phút; file khoảng 22 MB.
- **Định dạng `WWC2`:** cue 6 byte (`kind, khung, pan, level, dur`), 16 loại cue. Bộ đọc nhận cả `WWC1`.
- **Âm thanh trộn sẵn:** `Scripts/Unity/Audio/Cinema/` là bộ tổng hợp thuần C#; `CinemaMix.Render` đọc cue của phim và trả hai stem (nền, hiệu ứng) đã có pan, ducking, hút âm trước nổ lớn và bịt tai. `FlightAudio.Cinema.cs` dựng stem trên luồng nền lúc khởi động và phát đồng bộ với phim. `FlightAudio.CinemaClips.cs` bị xóa. Tiếng gió mới cũng thay cho gió trong truyện (dùng chung vòng `wind`).
- **Công cụ mới:**
  - `Tools/AudioChecks`: ghi bản trộn ra WAV để nghe không cần build, in số đo từng âm và tự kiểm.
  - `Tools/PixelForge/cinema/viewer.html`: xem phim trong trình duyệt, tua từng khung, hiện cue, phát kèm WAV.

## Lệnh

```text
node Tools/PixelForge/cinema/film.cjs                      # dựng lại phim + ghi file game
cd Tools/AudioChecks && dotnet run -- ../Smoke/audio-intro  # bản trộn âm thanh ra WAV + số đo + tự kiểm
```

## Tham khảo (học nguyên lý, không sao chép hình hay âm)

- Giải phẫu vụ nổ nhiều lớp: [realtimevfx, breakdown 18 lớp](https://realtimevfx.com/t/stylized-frag-launcher-explosion-overwatch-inspiration-breakdown-posted/1894?page=2), [realtimevfx, explosion timing](https://realtimevfx.com/t/best-resources-to-learn-about-explosion-timing/30835), [Vitrina](https://vitrina.ai/blog/realistic-fire-explosion-vfx-simulation-techniques/).
- Rung máy quay: [Eiserloh, GDC 2016](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing), [ví dụ trauma của Bevy](https://docs.rs/bevy/0.17.3/src/2d_screen_shake/2d_screen_shake.rs.html), [StraySpark](https://www.strayspark.studio/blog/camera-shake-game-feel-without-motion-sickness), [DNEG, Masters of the Air](https://beforesandafters.com/2024/04/17/we-asked-ourselves-at-the-beginning-do-we-go-for-something-that-feels-right-or-that-is-right/); giữ khung: [uhiyama-lab](https://uhiyama-lab.com/en/notes/unity/unity-game-feel-hit-feedback/).
- Flak và máy bay nổ thật: [398th BG, màu cụm flak](https://398th.org/History/Veterans/History/Bohn_ColoredFlak.html), [B-17 "Wee Willie"](https://theaviationist.com/2025/08/11/b-17g-wee-willie/).
- Thành phố và cảng bị ném bom nhìn từ trên cao (ảnh phạm vi công cộng, chỉ học hình khối): [Ploiești 1943](https://commons.wikimedia.org/wiki/File:B-24_Liberators_Passing_Through_Target_Area_During_Polesti_Raid_on_August_1,_1943.jpg), [nhà máy lọc dầu Creditul Minier](https://commons.wikimedia.org/wiki/File:Creditul_Minier_refinery_fires_after_being_bombed_by_U.S._B-24_Liberator_airplanes_(27459493330).jpg), [cảng Hamburg-Steinwerder](https://commons.wikimedia.org/wiki/File:Hamburg-Steinwerder,_Royal_Air_Force_Bomber_Command,_1942-1945_CL3395.jpg); báo cáo tổ bay: [IBCC](https://ibccdigitalarchive.lincoln.ac.uk/collections/document/30164).
- Cột khói dầu và vệt nắng trên biển: [Buncefield fire](https://en.wikipedia.org/wiki/Buncefield_fire), [NOAA, sun glitter](https://psl.noaa.gov/outreach/education/science/glitter).
- Tổng hợp âm thanh: Andy Farnell, *Designing Sound*, các bài thực hành [nổ](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical31.html), [súng](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical30.html), [quạt/cánh quạt](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical23.html); tốc độ bắn: [M2 Browning](https://en.wikipedia.org/wiki/M2_Browning), [MG 151](https://en.wikipedia.org/wiki/MG_151_cannon).

Phần lớn thông số theo từng lớp (thời lượng, kích thước, tần số, mức âm) là suy luận từ các nguồn trên rồi chỉnh trên khung hình và số đo, không phải số đo thực tế.

# 27. Phim mở màn: bến cảng rõ, mây mới, đạn phòng không thật, âm thanh bằng bản ghi thật (sau 0.15)

Người dùng chê bản 26: âm thanh tổng hợp nghe giả, không có độ nặng; bến cảng khó thấy, nhất là ở cảnh cuối làm nền menu; đạn phòng không bắn từ dưới đất lên và mây trông giả. Máy quay, đường bay, nhịp cắt và model máy bay giữ nguyên.

## Người chơi thấy và nghe gì

- **Bến cảng ở nền menu.** Camera của cảnh 8 nhìn về phía nam, nơi trước đây không có cảng. Giờ ở phần ba dưới phải của khung có cảng nam của cùng thành phố:
  - cửa sông sáng chạy ngang màn hình;
  - bến răng lược 4 ngón, 3 bể, đê, kho mái dài (một số đang cháy), cần cẩu đổ bóng dài;
  - bãi bể dầu có hai bể cháy;
  - tàu cháy trong vũng dầu, tàu lật, tàu đang chạy để lại vệt nước;
  - một cột khói dầu dẫn mắt từ cảng lên trời.
- **Mặt đất trong vòng lặp đứng yên.** Chỉ mây trượt. Ở độ cao 4 km thì trong 8 giây mặt đất gần như không trôi.
- **Nước** theo Fresnel: nhìn chúc xuống (cảnh 2) thì nước tối chàm, nhìn xiên thì sáng hồng phản chiếu trời hoàng hôn. Mặt nước có gợn, lấp lánh, vệt lửa phản chiếu kéo dọc về phía máy quay, bóng kè và phản chiếu cột khói. Khu phố nhìn từ xa thành các khối nhà: đang cháy, đã cháy rụi, hoặc mái tối.
- **Đạn phòng không** thôi là que cam đứt nét. Có hai cỡ ụ là 2 cm và 3,7 cm, xếp theo trận địa:
  - nòng lia nên mỗi dòng đạn vạch là một chuỗi hạt cong liền, các dòng trong cùng một ụ gần song song;
  - hạt mờ dần theo độ cao, đạn tự huỷ ở các độ cao khác nhau thành đốm khói nhỏ;
  - có chớp nòng.
- **Mây** thôi là các chùm cầu tròn:
  - các ô mây gom thành mảng liền, đáy phẳng chìm vào tầng mây, mép mềm tan dần;
  - múi lớn nhỏ chồng nhau, viền bạc phía nắng, mặt khuất tím-xanh, có bóng tự đổ, xa thì mờ dần;
  - tầng mây mở một lỗ cố định trên cảng ở nền menu.
- **Âm thanh là bản ghi thật**, lấy 27 bản ghi trên Freesound (25 CC0, 2 CC BY):
  - động cơ Merlin thật;
  - đội hình oanh tạc cơ;
  - súng máy .50 ghép từng phát (khoảng 14,5 phát/s);
  - pháo tự động 25 mm hạ cao độ cho pháo địch;
  - flak, nổ vừa, nổ lớn;
  - lửa gầm;
  - ì ầm bom xa;
  - gió rít, đạn gõ kim loại, ù tai;
  - máy bay lướt qua.

  Mỗi tiếng ghép lớp: thân là bản ghi, bên dưới thêm một lớp sub tổng hợp 38–120 Hz để bù phần bass mà các bản ghi phim cũ bị thiếu. Mỗi phát súng hay vụ nổ được lấy một đoạn khác nhau và lệch cao độ ±5% nên không phát nào giống hệt phát nào. Tiếng ở xa được lọc thông thấp và làm mềm đầu tiếng.

## Kỹ thuật

- `Tools/PixelForge/cinema/`:
  - `ground.cjs`: cảng nam `SP`, hằng `LOOP_PORT`, khu phố theo khối nhà, thêm cột khói.
  - `battle.cjs`: viết lại `guns`.
  - `sky.cjs`: nước theo Fresnel, mặt đất ở loop dùng toạ độ thế giới, `portHoleE`, tầng mây có ô cuộn.
  - `clouds.cjs` mới, tách `drawClouds` ra khỏi `sky.cjs`.
  - `world.cjs`: `deckField`/`massAt`, viết lại `cumulus` và `tower`.
  - `core.cjs`: thêm ramp `port`, `dock`, `flak`, đổi ramp `cloud`. Bảng màu 208 → 224.
  - Thời gian dựng mỗi khung tăng khoảng 30%.
- Âm thanh:
  - Bộ mẫu `Audio/SFX/Cinema/Resources/CinemaSfx/*.bytes` gồm 18 file WAV PCM 16-bit 44,1 kHz đổi đuôi, tổng 13,35 MB.
  - Nguồn và giấy phép từng file ghi ở `Audio/SFX/Cinema/LICENSE.md`. MP3 gốc nằm ở `SourceAssets/Audio/Cinema/`.
  - `Tools/AudioImport` (.NET, NLayer chỉ dùng trong tool này) giải mã MP3, cắt đoạn, lọc và ghép vòng lặp. Công thức cho từng tiếng ở `Recipe*.cs`.
  - `CinemaWav`/`CinemaBank` (C# thuần) đọc bộ mẫu. Hàm trộn đổi thành `CinemaMix.Render(cues, fps, introSeconds, bank)`.
  - Game nạp bộ mẫu bằng `Resources.LoadAll<TextAsset>("CinemaSfx")` trên luồng chính, còn giải mã và trộn chạy trên luồng nền (khoảng 0,5 s trên .NET). Nạp lỗi thì đặt `CinemaFailed` và ghi log cảnh báo.
- Kiểm tra:
  - AudioChecks có 52 check: bộ mẫu đủ file, mỗi tiếng khác nhau rõ, súng ta nhanh hơn pháo địch, gió không có trầm, có hút âm trước nổ lớn, vòng lặp nối liền.
  - Smoke thêm 2 check: `menu-intro-recordings-bank-loads-every-file-and-kit`, `menu-intro-stems-carry-sound-and-are-not-silent`.

## Lệnh

```text
node Tools/PixelForge/cinema/film.cjs
dotnet build Tools/AudioImport -c Release && dotnet Tools/AudioImport/bin/Release/net8.0/AudioImport.dll build   # dựng lại bộ mẫu từ SourceAssets/Audio/Cinema
cd Tools/AudioChecks && dotnet run -c Release -- ../Smoke/audio-intro
```

## Ghi nguồn (CC BY)

- "Two Spitfires Flyby" by Fight2FlyPhoto, Freesound, CC BY 3.0 (https://freesound.org/people/Fight2FlyPhoto/sounds/142901/)
- "AIR Lancaster By1" by Geldart, Freesound, CC BY 4.0 (https://freesound.org/people/Geldart/sounds/325563/)

25 bản ghi còn lại là CC0. Tác giả gồm craigsmith (thư viện hiệu ứng phim Hollywood thập niên 1930–40, số hoá từ phim quang học), qubodup (trích từ video quân đội Mỹ, phạm vi công cộng), squashy555, swiftoid, theoneandtruelybitch, Nox_Sound, SamsterBirdies, dbdarby và surrey_film. Giấy phép đã được kiểm trên trang Freesound của từng file ngày 17/11/2026.

## Tham khảo hình

- Đạn vạch nhìn từ trên xuống: ảnh Hamburg 30–31/1/1943, IWM C 3371 (https://commons.wikimedia.org/wiki/File:Attack_on_Hamburg.jpg). Số liệu súng: NavWeaps 2 cm Flak 30/38 (https://navweaps.com/Weapons/WNGER_20mm-65_c30.htm), Bofors 40 mm (https://en.wikipedia.org/wiki/Bofors_40_mm_Automatic_Gun_L/60).
- Tàu và nước nhìn xiên: ảnh Rabaul 2/11/1943, NH 95560 (https://commons.wikimedia.org/wiki/File:NH_95560_Simpson_Harbor,_Rabaul,_New_Britain.jpg).
- Mây: Schneider, "The Real-time Volumetric Cloudscapes of Horizon Zero Dawn", SIGGRAPH 2015, gồm Beer, powder, Henyey-Greenstein và cách phân cấp hình khối (https://www.advances.realtimerendering.com/s2015/). Pixel art: Slynyrd Pixelblog 2 (https://slynyrd.com/blog/2018/2/15/pixelblog-2-texture).
- Độ nặng âm thanh (ghép lớp transient, thân, đuôi, sub; nổ xa mất cao tần trước): Pixflow (https://pixflow.net/blog/explosion-sound-effects-a-complete-guide), CRIWARE (https://blog.criware.com/?p=2289).

Màu đạn vạch và phần lớn thông số px là quyết định thiết kế, quy đổi từ các nguồn trên. Không phải số đo thực tế.

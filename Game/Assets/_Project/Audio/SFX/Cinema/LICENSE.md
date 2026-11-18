# Âm thanh phim mở màn: nguồn và giấy phép

Bộ mẫu trong `Resources/CinemaSfx/*.bytes` (WAV PCM 16-bit 44,1 kHz) được dựng từ các bản ghi trên Freesound (https://freesound.org),
chỉ dùng giấy phép **CC0 1.0** hoặc **CC BY (3.0/4.0)**. Bản ghi gốc (MP3 xem trước chất lượng cao) nằm ở `SourceAssets/Audio/Cinema/`
(file dài đã cắt bớt khung MP3 quanh phần dùng, kèm `*.mp3.start`). Tái tạo toàn bộ bộ mẫu:

```text
dotnet build Tools/AudioImport -c Release
dotnet Tools/AudioImport/bin/Release/net8.0/AudioImport.dll build        # đọc SourceAssets/Audio/Cinema, ghi Resources/CinemaSfx
```

Công thức cắt/xử lý từng tiếng nằm trong `Tools/AudioImport/Recipe*.cs`. Mọi bản dùng đều **đã chỉnh sửa**: cắt đoạn, lọc (EQ), fade, ghép vòng
lặp liền, đảo ngược (tiếng ù tai), trộn hai bản ghi, thêm lớp sub/chém cánh quạt tổng hợp (không phải bản ghi).
Giấy phép ghi dưới đây đã được kiểm trên trang Freesound của từng file ngày 17/11/2026 (25 CC0, 2 CC BY); không file nào có tiếng người, giọng AI hay nhạc (theo phân tích tự động, chưa nghe bằng tai).

## Cần ghi nguồn (CC BY)

- "Two Spitfires Flyby" by Fight2FlyPhoto, Freesound, CC BY 3.0 (https://freesound.org/people/Fight2FlyPhoto/sounds/142901/)
- "AIR Lancaster By1" by Geldart, Freesound, CC BY 4.0 (https://freesound.org/people/Geldart/sounds/325563/)

## Bảng nguồn

Trang mỗi file: `https://freesound.org/people/<tác giả>/sounds/<id>/`.

| Mẫu trong game | id | Tác giả | Tên | Giấy phép | Đoạn dùng (giây) | Xử lý |
|---|---|---|---|---|---|---|
| `engine` (vòng 4,1 s) | 276597 | squashy555 | merlin engine | CC0 | khoảng 48 (tự chọn chỗ nối khớp nhất trong 42-66) | lọc cao 28 Hz, ghép vòng, thêm chém cánh quạt 55,5 Hz tổng hợp -17 dB |
| `bomber` (vòng 8 s) | 437892 | craigsmith | Bombers Fly in Formation | CC0 | khoảng 8,5 + 2,9 (trái/phải khác lúc) | lọc 32 Hz-7,5 kHz, ghép vòng |
| | 437863 | craigsmith | 4 Engine Prop Steady | CC0 | cùng khoảng, -4 dB | trộn dưới lớp trên, thêm sin 62-104 Hz tổng hợp -9 dB |
| `wind` (vòng 10 s) | 117610 | swiftoid | Wind Howl 2 | CC0 | khoảng 8-18 (trái), 24-34 (phải) | lọc cao 420 Hz, shelf +9 dB trên 1,8 kHz, thấp 13 kHz |
| | 481148 | craigsmith | Big Cold Winter Wind | CC0 | 24-34 và 44-54, -8 dB | trộn dưới |
| `windlong` (18 s, không vòng; nền menu) | 117610 | swiftoid | Wind Howl 2 | CC0 | 35-53 (trái), 38-56 (phải) | cùng lọc với `wind`, fade 20 ms hai đầu |
| | 481148 | craigsmith | Big Cold Winter Wind | CC0 | 2-20 và 46-64, -8 dB | trộn dưới |
| `fire` (vòng 6 s) | 698209 | theoneandtruelybitch | Fire Large Roar And Hiss With Crackles | CC0 | khoảng 33-39 (trái), 40-46 (phải) | lọc cao 35 Hz, ghép vòng |
| | 483323 | craigsmith | Fires Burn Wood and Metal Crackling | CC0 | 15-21 và 45-51 | lọc cao 500 Hz, trộn ngang mức tiếng gầm |
| `mg_a` (22 tiếng đơn + đuôi) | 160355 | qubodup | Avenger 50 cal | CC0 | 0,92-2,30 (tách từng phát) + đuôi 0,55 s | lọc cao 70 Hz, fade |
| `mg_b` (7 loạt 0,8 s) | 183656 | qubodup | 50 Caliber MG | CC0 | 7 chỗ bắt đầu loạt trong 0-35 | lọc cao 90 Hz |
| `cannon` (5 phát) | 854186 | qubodup | Autocannon Three Shot Burst | CC0 | 0,02-2,0 (3 phát) | lọc cao 40 Hz, low shelf +4 dB 140 Hz |
| | 187767 | qubodup | Cannon shot | CC0 | 0,15-1,45 và 6,4-7,7 | như trên |
| `hit_a` (14 cú) | 675944 | craigsmith | 50 cal Browning bullet impacts | CC0 | 0,3-8,3, tách từng cú | lọc cao 120 Hz |
| `hit_b` (8 tiếng) | 486296 | craigsmith | Metal Clanks Hits | CC0 | 0,01-9, tách từng tiếng | lọc 400 Hz-9 kHz |
| `flak` (4 quả) | 674897 | craigsmith | Incoming shells; explosions | CC0 | quanh 0,2; 4,0; 11,2; 19,2 (mỗi quả 1,4 s) | lọc cao 40 Hz |
| `flaknear` (5 tiếng) | 675611 | craigsmith | Cannon fire; shells fall nearby | CC0 | 0,08-1,0 và 2,0-2,8 | lọc cao 40 Hz |
| | 239137 | qubodup | Artillery gunfire | CC0 | quanh 0; 3,1; 5,1 (mỗi phát 1,1 s) | như trên |
| `boom` (3 vụ) | 560510 | Nox_Sound | Explosion debris (short) | CC0 | quanh 0; 3,0; 8,0 (mỗi vụ 1,8 s) | lọc cao 35 Hz |
| `bigboom` (3 vụ, stereo) | 741174 | qubodup | Huge explosion | CC0 | 0-5,5 | lọc cao 20 Hz, fade 1,5 s |
| | 592000 | SamsterBirdies | Large explosion | CC0 | 0-4,5 | như trên |
| | 741173 | qubodup | Big explosion | CC0 | 0-5,0 | như trên |
| `roar` (4 s, stereo) | 674903 | craigsmith | Nitrate vault explode with roaring fire | CC0 | 16-20 (trái), 24-28 (phải) | lọc cao 35 Hz |
| | 698209 | theoneandtruelybitch | Fire Large Roar And Hiss With Crackles | CC0 | 60-64 / 66-70, -3 dB | trộn |
| `rumble` (5 đoạn) | 438693 | craigsmith | Distant Explosions | CC0 | 5,0-8,3; 9,5-12,8; 70-73,3; 75-78,3; 80-83,3 | lọc 25-350 Hz, fade 0,4 s |
| `ring` | 365956 | dbdarby | Ear Ringing After Explosion | CC0 | 5,0-8,9 | **đảo ngược** (tiếng ù tai tắt dần), lọc cao 500 Hz |
| `flyby` (2) | 437796 | craigsmith | WWII Fighter By with Whoosh | CC0 | 0-1,3 | lọc cao 90 Hz |
| | 142901 | Fight2FlyPhoto | Two Spitfires Flyby | **CC BY 3.0** | 17,6-20,0 | lọc cao 90 Hz |
| `heavy` (2) | 162240 | surrey_film | Lancaster flyover | CC0 | 7,2-10,8 | lọc cao 35 Hz, low shelf +5 dB |
| | 325563 | Geldart | AIR Lancaster By1 | **CC BY 4.0** | 32,4-36,0 | lọc cao 28 Hz, low shelf +3 dB |

## Không phải bản ghi

Vài lớp nhỏ vẫn tổng hợp bằng code trong `Scripts/Unity/Audio/Cinema/` để bù phần bass mà nguồn băng quang học (Craig Smith) không có: sin trượt 80-40 Hz
dưới nổ, 120-55 Hz dưới pháo và flak gần, 45-28 Hz dưới nổ lớn, 38 Hz dưới ì ầm, 75 Hz nhẹ dưới mỗi phát súng máy, và tiếng "braam" của logo (cue Title).

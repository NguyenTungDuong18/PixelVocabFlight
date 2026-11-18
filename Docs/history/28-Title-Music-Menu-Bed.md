# 28. Nhạc nền tự sáng tác, intro có tiếng từ khung đầu, nền menu không lặp (sau 0.15)

Người dùng báo hai lỗi: đầu intro có một đoạn chỉ nghe tiếng gió, và nền menu lặp âm thanh theo vòng. Người dùng cũng muốn có nhạc nền tự sáng tác. Các lựa chọn đã duyệt:
- dàn nhạc hùng tráng kiểu nhạc phim Thế chiến 2;
- vang lên lúc logo hiện rồi chạy ở menu;
- soạn nốt bằng code và dựng bằng mẫu nhạc cụ thu thật;
- dài 3–4 phút.

## Người chơi nghe gì

- **Intro có tiếng từ khung đầu.** Trước đây phim chạy ngay trong khi âm thanh còn đang dựng ở luồng nền. Trong build, việc dựng mất 1,7–2,1 s, nên những giây đầu chỉ có vòng gió. Giờ phim đứng ở khung 0 cho tới khi âm thanh sẵn sàng (tối đa 6 s). Cảnh 1 cũng có tiếng oanh tạc cơ to hơn (−6 → −2 dB) và một lớp ì ầm bom xa ngay từ đầu.
- **Nền menu không lặp.** Vòng gió 10 s cũ được thay bằng `CinemaMenuBed`, sinh liên tục theo seed thời gian:
  - gió là hai giọng đan chéo, mỗi giọng lấy đoạn 6–12 s ngẫu nhiên từ `windlong` hoặc vòng gió;
  - tiếng ù oanh tạc cơ rất xa;
  - sự kiện xa ngẫu nhiên mỗi 1,5–6 s (flak, nổ, bom ì ầm, súng phòng không), đôi khi thành cụm.
- **Nhạc nền** (Sol thứ, ♩ = 100):
  - cú hit tutti đúng lúc logo hiện (t = 8,95 s);
  - intro 4 ô, rồi thân 88 ô (211,2 s) lặp liền ở menu;
  - các đoạn: A ostinato → B hành khúc (horn nêu chủ đề) → C xây dựng → D chủ đề trưởng ở Si giáng → E lắng (harp, chuông, trumpet solo) → F cao trào ở Đô trưởng → G dâng trên Rê trưởng rồi quay về đầu.

  Vào story thì nhạc tắt dần trong 1,2 s. Quay lại menu thì nhạc phát lại từ đầu phần lặp. Trang Cài đặt có thêm thanh "Âm lượng nhạc" (mặc định 70).

## Kỹ thuật

- `Tools/MusicForge` (.NET 8) gồm sampler SFZ tự viết:
  - round robin, áp `volume` theo vùng, đổi cao độ Hermite tối đa 4 nửa cung;
  - crossfade lớp velocity theo đường dynamics, legato giả, humanize;
  - chồng lớp kèn đồng để giả ensemble.

  Ngoài ra có reverb FDN 8 đường trễ, EQ bus và render vòng tròn để đuôi vang quấn về đầu phần lặp. Bản nhạc viết trong `Score*.cs`, mỗi đoạn một file.
- Mẫu nhạc cụ lấy từ VSCO 2 Community Edition (CC0), 900 MB, tải về `Tools/MusicForge/samples/` (nằm ngoài git). Repo chỉ giữ hai bản render:
  - `Audio/Music/Resources/Music/title_intro.wav`: 423 360 mẫu;
  - `Audio/Music/Resources/Music/title_loop.wav`: 9 313 920 mẫu.

  Cả hai là PCM16 stereo 44,1 kHz, khoảng −18 LUFS. Hai phách cuối của intro trùng với cuối phần lặp, nên chỗ nối intro → lặp giống hệt chỗ nối lặp → lặp.
- `FlightAudio.Music.cs` hẹn giờ phát intro bằng `PlayScheduled` theo cue Title. Phần lặp được hẹn sample-exact ngay sau intro. Nhạc giảm 3 dB quanh vụ nổ lớn ở 9,3 s.
- `Editor/MusicImporter.cs` đặt cài đặt nén: Vorbis 0,75, Compressed In Memory.
- Âm lượng nhạc = fade × master × music × 0,7.
- Nền menu nằm ở `Audio/Cinema/CinemaMenuBed.cs` (C# thuần) và `FlightAudio.MenuBed.cs` (AudioClip streaming). Bộ mẫu có thêm `windlong` (19 file, 16,4 MB).
- Kiểm tra:
  - AudioChecks có 66 check, gồm độ to 0,5 s đầu intro và tương quan ở độ trễ 8 s và 10 s của nền menu 90 s (< 0,5).
  - Smoke thêm các check `menu-intro-has-sound-from-the-first-frame`, `menu-bed-*`, `menu-music-*` và `menu-settings-music-volume-*`.
  - `MusicForge check` kiểm độ dài, đỉnh, mối nối và mức từng đoạn.

## Lệnh

```text
dotnet run --project Tools/MusicForge -c Release -- fetch            # tải mẫu VSCO 2 CE cần dùng (một lần)
dotnet run --project Tools/MusicForge -c Release -- build            # soạn + dựng → Audio/Music/Resources/Music/*.wav
dotnet run --project Tools/MusicForge -c Release -- check            # tự kiểm hai WAV
dotnet run --project Tools/MusicForge -c Release -- preview Tools/Smoke/music-r1   # bản nghe thử + stem
```

## Nguồn

- VSCO 2 Community Edition, Versilian Studios, CC0 1.0: https://github.com/sgossner/VSCO-2-CE
- Bản nhạc là sáng tác riêng cho WORDWING. Giai điệu đã được đối chiếu bằng trí nhớ với các chủ đề nổi tiếng (Dam Busters, 633 Squadron, Band of Brothers…), chưa có ai nghe bằng tai. Ba nốt đầu D-G-Bb là hợp âm rải thứ phổ biến, nên người dùng nên nghe để xác nhận.
- Kỹ thuật dựng, reverb và mix tham khảo: Freeverb và FDN (https://ccrma.stanford.edu/~jos/pasp/Freeverb.html); mục tiêu độ to theo Wwise (https://www.audiokinetic.com/en/blog/wwise-hdr-overview-and-best-practices-for-game-mixing).

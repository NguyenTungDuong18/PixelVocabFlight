# Nhạc nền màn hình chính: nguồn và giấy phép

`Resources/Music/title_intro.wav` (4 ô, phát một lần lúc logo hiện) và `Resources/Music/title_loop.wav` (88 ô = 211,2 s, lặp liền)
là **bản nhạc tự sáng tác cho WORDWING** (chủ đề, hòa âm, phối khí viết bằng code trong `Tools/MusicForge/Score*.cs`), dựng offline
bằng sampler tự viết trên các bản thu nhạc cụ thật.

## Mẫu nhạc cụ

- **Versilian Studios Chamber Orchestra 2 – Community Edition (VSCO 2 CE)**, Sam Gossner / Versilian Studios,
  giấy phép **CC0 1.0** (public domain): https://github.com/sgossner/VSCO-2-CE (nhánh `SFZ`).
  Dùng: dàn dây (violin/viola/cello section: susVib, tremolo, spiccato; contrabass: sus, tremolo, pizz), kèn (F horn sus/stac,
  trumpet sus/stac, tenor trombone sus/stac, tuba sus), timpani (hit + roll), snare, bass drum, crash, suspended cymbal (hit + swell), gong,
  harp, tubular bells.
- Không dùng nguồn nào khác (không SSO, VPO, Philharmonia). Mẫu thô không nằm trong repo; WAV trong game là bản trộn đã xử lý.

## Dựng lại

```text
dotnet run --project Tools/MusicForge -c Release -- fetch      # tải ~900 MB mẫu VSCO cần dùng vào Tools/MusicForge/samples (git-ignored)
dotnet run --project Tools/MusicForge -c Release -- build      # ghi 2 WAV ở đây (kết quả giống hệt nhau từng byte mỗi lần chạy)
dotnet run --project Tools/MusicForge -c Release -- check      # tự kiểm độ dài, đỉnh, loudness, mối nối; báo cáo ở Tools/Smoke/music-r1/check.txt
```

Hợp đồng với game: 44 100 Hz, PCM 16-bit stereo, ♩ = 100 (1 ô = 105 840 mẫu); intro đúng 423 360 mẫu, loop đúng 9 313 920 mẫu;
khoảng −18 LUFS, đỉnh ≤ −1 dBFS. 2 phách cuối của intro trùng 2 phách cuối của loop, nên intro → loop nối giống hệt loop → loop
(đuôi vang của loop đã được quấn về đầu loop).

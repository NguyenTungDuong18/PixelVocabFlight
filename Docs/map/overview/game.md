# Game là gì

**WORDWING** là game bắn máy bay pixel art phong cách Thế chiến II (1944), nhìn từ trên xuống, dùng để học từ vựng Oxford 5000. Tên hiển thị: **WORDWING**. Thư mục dự án: `PixelVocabFlight`. Namespace C#: `PixelVocabFlight` (editor: `PixelVocabFlight.Editor`). Giao diện toàn bộ bằng tiếng Việt.

## Căn cứ (màn chính từ 0.15, góc nhìn 3/4 kiểu RPG)

- Phi công 01 đi bằng WASD, giữ Shift để chạy, nhấn E để tương tác.
- Nói chuyện với Giáo sư Whitmore để nhận nhiệm vụ `vocab-sortie` và chọn chiến trường. Lựa chọn "Chọn bộ từ vựng" mở màn chọn từ.
- Ra SKYLARK MK.I ở sân đỗ, nhấn E: hoạt cảnh cất cánh, rồi vào trận.
- Kết quả → VỀ CĂN CỨ → nhiệm vụ hoàn thành.

## Chế độ bay (một nhiệm vụ trong căn cứ)

- Người chơi lái tiêm kích ở đáy màn hình. Máy bay ném bom địch mang **nghĩa tiếng Việt** của một từ, hiện trên màn CRT của buồng lái.
- **Gõ từ tiếng Anh** + Enter để bắn hạ máy bay đang là mục tiêu điện đài.
- **Tab** đổi chế độ: **LÁI** (chuột di chuyển theo X, nhặt tiếp tế) và **BẮN** (gõ chữ).
- Máy bay địch tuần tra 18 giây rồi khóa mục tiêu 4,5 giây và bắn loạt đạn **không né được** (−1 GIÁP). Muốn tránh phải gõ đúng trước khi hết giờ.
- Trên biển, tàu sân bay phóng **tên lửa có 4 đáp án** (chuột hoặc phím 1–4). Đúng: nổ, hạ cả máy bay xung quanh. Sai 3 lần: tên lửa khóa, tăng tốc, đâm trúng (−2 GIÁP).
- **Tài nguyên:** XĂNG cạn thì hết trận; GIÁP (tối đa 5) về 0 thì rơi; 5 mảnh metal → **cường hóa** 12 giây (×1,5 điểm, xăng hao một nửa); hộp **ĐỔI NGHĨA** đổi mục tiêu.
- **Chiến trường** đổi mỗi 180 giây: Rừng → Sa mạc → Băng → Biển, bắt đầu từ vùng đã chọn.
  - Rừng: sinh nhanh hơn 30%. Sa mạc: phải chọn đúng từ loại. Băng: máy bay có khiên, cần 2 phát. Biển: tàu sân bay và tên lửa.
- Hết trận: điểm, kỷ lục, các từ cần ôn. Phát âm từ vừa hạ bằng WAV giọng US.

Luật chi tiết: `Docs/map/logic/`. Phím: `Docs/map/overview/controls.md`.

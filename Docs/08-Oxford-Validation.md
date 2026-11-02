# Kiểm tra bản 0.2 — Oxford và chọn tập học

Ngày: 02/11/2026. Unity 6000.6.7f1, Windows 64-bit, Mono. Build thành công, mã thoát 0. Bản chạy: `Builds/Windows/Wordwing.exe`.

## Dữ liệu

- 5.975 mục từ/từ loại, 5.975 ID phân biệt, 4.957 dạng viết không phân biệt hoa/thường.
- Tất cả mục có nghĩa Việt, CEFR A1–C1, nhóm chủ đề, URL nguồn Oxford và file phát âm được tham chiếu.
- 4.957 clip phát âm offline; chỉ nạp khi cần, cache giới hạn 32 clip.
- 488 mục được ghi đè bằng phần biên soạn của dự án; phần lớn nghĩa còn lại được nhập tự động từ nguồn beta.
- Nhóm Đồ ăn + đúng B1 có 9 mục theo phân loại hiện tại của game.

## Kiểm tra luật/dữ liệu

`dotnet run --project Tools/RulesChecks/RulesChecks.csproj`: **24.388 kiểm tra đạt**.

Bao gồm: ID đồng hình không trùng, đầy đủ nghĩa và audio, mã CEFR và chủ đề hợp lệ, lọc Oxford 3000, giao trình độ với hợp chủ đề, tìm Anh/Việt, khoảng lấy sau bộ lọc và gồm cả hai đầu, chặn khoảng sai, tạo câu hỏi trong đúng tập chọn, không trùng cách viết/biến thể đã khai báo và tránh các khóa nghĩa trùng đã biết. Toàn bộ mục trong một tập được hỏi trước khi lặp.

Kiểm tra khả năng tạo câu hỏi cho cả danh mục mất khoảng 26 ms ở lần chạy ghi nhận trên máy này. Không dùng đây làm cam kết hiệu năng trên mọi máy.

## Kiểm tra bản game Windows

Chạy `--smoke-test` với bàn phím QA của Unity Input System và sự kiện nhập của uGUI. Báo cáo: `Tools/Smoke-Oxford/smoke-report.json`.

| Trường hợp | Kết quả |
|---|---|
| Danh sách CEFR mở được | Đã xem ảnh |
| Đồ ăn + B1 chỉ có các mục B1 thuộc Đồ ăn | Đạt |
| Nhập 2 và 7 vào hai ô khoảng | Đạt |
| Khoảng 2–7 chọn đúng sáu mục | Đạt |
| Nhập và tìm ingredient trong bộ đang lọc | Đạt |
| Trận chỉ sinh mục tiêu/đáp án trong sáu mục đã chọn | Đạt |
| Gõ đúng từ của máy bay khác không hạ mục tiêu | Đạt |
| Sáu câu đúng được ghi điểm | Đạt |
| Cường hóa sau đủ kim loại | Đạt |
| Pause không tiêu hao xăng/thời gian | Đạt |
| Mất ba giáp mở màn kết quả | Đạt |
| Dựng ảnh từ camera game | Đạt |

Đã xem ảnh: toàn bộ thư viện, dropdown CEFR, Đồ ăn B1, khoảng được tô chọn, tìm kiếm, màn nguồn/giấy phép và màn chơi. Các file nằm trong `Tools/Smoke-Oxford`.

## Giới hạn

Không có kiểm tra thao tác bằng thiết bị vật lý trong phiên này. Luồng nhập được kiểm tra bằng sự kiện vào các thành phần UI/Input System của game và ảnh camera, không dựng lại giao diện bằng công cụ bên ngoài.

Độ đầy đủ kỹ thuật không đồng nghĩa toàn bộ nghĩa Việt đã được người biên tập duyệt. Chủ đề còn nhiều mục Tổng quát. Audio giọng máy chưa được nghe duyệt toàn bộ hoặc tách mọi trường hợp đồng hình khác âm. Các giới hạn này có ghi trên giao diện/tài liệu.

Danh mục được nhập là Oxford 3000/5000; không gọi đây là toàn bộ từ điển Oxford.

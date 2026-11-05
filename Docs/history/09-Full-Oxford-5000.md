# Bản 0.3 — chọn trọn bộ Oxford 5000

## Thay đổi chính

- Mở bản 0.3 lần đầu sẽ chọn **toàn bộ Oxford 5000**, A1–C1, mọi chủ đề, không có tìm kiếm, từ mục 1 đến hết kho.
- Lựa chọn bộ học của bản trước được giữ trong `selectionBeforeFullLibrary` trong hồ sơ, trước khi chuyển mặc định sang trọn bộ. Những lần sau vẫn nhớ lựa chọn mới của người chơi.
- Nút **TOÀN BỘ OXFORD 5000** xóa các giới hạn về CEFR, chủ đề, tìm kiếm và khoảng, rồi chọn toàn kho.
- Khi đổi danh mục, CEFR, chủ đề hoặc tìm kiếm, mặc định chọn **hết các mục khớp bộ lọc**. Không tự giới hạn ở 50 nữa.
- Muốn học ít hơn vẫn có thể nhập khoảng hoặc dùng nút nhanh 20/50/100.

## Đối chiếu độ đầy đủ

Danh mục HTML trên website Oxford đã được đối chiếu thêm với hai PDF tải trực tiếp từ Oxford:

- https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
- https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000.pdf

PDF Oxford 5000 chứa phần bổ sung cho Oxford 3000, nên phải đối chiếu cả hai file để xét trọn bộ.

Kết quả: **không còn từ nào trong hai PDF vắng khỏi kho chạy của game**, sau khi chuẩn hóa viết hoa, dấu nhãn hiệu và chú thích phân biệt nghĩa. Báo cáo có thể kiểm tra tại `SourceAssets/Vocabulary/Oxford/pdf-reconciliation.json`.

Đã bổ sung `proceedings`, cùng các mục nghĩa riêng cho bank/bờ sông, light/nhẹ, rest/nghỉ ngơi, rock/nhạc rock và race/chủng tộc. Mỗi bổ sung giữ URL PDF và số trang nguồn. Các nghĩa cùng cách viết vẫn được gõ bằng từ tiếng Anh, không phải gõ chú thích.

Kho chạy hiện có **5.981 mục học** và **4.958 dạng viết không phân biệt hoa/thường**. Một từ có thể có nhiều từ loại hoặc nghĩa; “Oxford 5000” là tên bộ tham chiếu. Không thêm các từ ngoài nguồn để ép số dạng viết thành 5.000.

Hai PDF đang tải về có tổng cộng 5.001 dòng mục từ được trích từ bốn cột mỗi trang; sau xử lý biến thể, chú thích và các mục lặp sẽ có số dạng viết khác số dòng. Vì vậy báo cáo công bố cả số dòng tham chiếu, số dạng viết và số mục học, không dùng các số này thay thế nhau.

## Khác biệt metadata giữa các nguồn

Có 19 trường hợp từ loại/mức CEFR trong PDF khác danh mục website đang dùng, chẳng hạn cách ghi động từ khuyết thiếu hoặc trường hợp PDF ghi `diplomatic` như danh từ. Các từ đó đều đã có trong kho.

Game giữ metadata website hiện hành cho các trường hợp này; không tạo một từ loại hoặc mức mới chỉ để làm khớp số đếm. Báo cáo lưu nguyên dòng PDF và các bản ghi website tương ứng trong `referenceMetadataDifferences` để tiếp tục rà soát.

Kết luận “không còn từ thiếu” nói về độ phủ **từ trong danh mục**, không phải khẳng định mọi từ loại, nghĩa và CEFR giữa hai nguồn hoàn toàn giống nhau.

## Công cụ và cách kiểm chứng

1. `Tools/PdfAudit/extract.mjs`: đọc chữ và tọa độ từ các PDF chính thức bằng PDF.js, không chạy JavaScript nhúng trong PDF.
2. `Tools/PdfAudit/reconcile.mjs`: dựng lại bốn cột, xử lý dòng xuống hàng, chú thích đồng hình, từ loại và CEFR; đối chiếu với kho.
3. `SourceAssets/Vocabulary/Oxford/pdf-supplements.json`: các bổ sung có nguồn và nghĩa Việt do dự án biên soạn.
4. `Tools/Prepare-Oxford-Data.cjs` và `Build-Oxford-Vocabulary.cjs`: tạo lại dữ liệu chạy từ nguồn.
5. `Tools/RulesChecks`: kiểm tra độ phủ, mục bổ sung, audio, dữ liệu và bộ lọc.

Audio tăng lên 4.958 clip riêng theo dạng viết. Các mục nghĩa mới dùng lại audio khi cùng cách viết.

## Chất lượng nội dung

Nguồn nghĩa Việt và giấy phép giữ như bản 0.2: thichhoc-dict CC BY-SA 4.0 cùng các phần biên soạn của game. Nhiều nghĩa nhập tự động vẫn cần rà soát. Chủ đề là phân loại của game; phần Tổng quát còn lớn. Giọng máy chưa được nghe duyệt theo từng nghĩa/từ loại.

Đây là toàn bộ danh mục tham chiếu Oxford 3000/5000 đã đối chiếu, không phải toàn bộ mục từ của mọi sản phẩm từ điển Oxford.

## Kết quả xác minh bản Windows

- Build Windows 0.3.0 thành công, Unity trả mã 0.
- **29.420 kiểm tra đạt**, bao gồm kiểm tra trực tiếp từng từ trích từ PDF có trong dữ liệu chơi.
- Lượt kiểm tra bản game trả mã 0; `fullLibrarySelection`, `fullLibraryFlight` và `fullFilteredSelection` đều `true`.
- Đã vào chuyến bay với đủ 5.981 mục và trả lời đúng một câu, sau đó thử lại bộ lọc B1/Đồ ăn, khoảng 2–7, nhập tìm kiếm, điểm, cường hóa, pause và Game Over.
- Ảnh và báo cáo nằm ở `Tools/Smoke-FullOxford`. `01-menu.png` hiển thị chọn 1–5981; `01-full-library-flight.png` ghi nhận màn chơi với toàn kho.
- Việc nhập được kiểm tra bằng sự kiện UI/Input System của game; chưa có lượt chơi bằng thiết bị vật lý trong phiên này. Nghĩa Việt và phát âm không được xem là đã duyệt toàn bộ chỉ vì các kiểm tra kỹ thuật đạt.

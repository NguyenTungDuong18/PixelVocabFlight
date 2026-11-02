# Nguồn nội dung và quyền sử dụng

Chưa thêm nhạc của bên thứ ba. Nguồn của bản hiện tại và prototype ban đầu được ghi dưới đây.
 
Bản 0.2: đã thêm metadata danh mục Oxford 3000/5000 (từ, từ loại, CEFR, URL); nghĩa Việt từ thichhoc-dict và phần biên soạn của dự án. Chi tiết tại [07-Oxford-Library.md](07-Oxford-Library.md). Không thêm định nghĩa hoặc audio từ điển Oxford. Bảng dưới giữ nguồn của bản prototype đầu.

Template 2D nền được lấy từ bộ cài Unity Editor 6000.6.7f1 trên máy. File package và thiết lập đi kèm được Unity quản lý theo phiên bản project.

Khi thêm nội dung, ghi nguồn ở bảng sau và giữ điều kiện sử dụng/giấy phép đi kèm nếu có:

| File hoặc gói | Tác giả/nguồn | URL | Giấy phép/quyền dùng | Ghi chú |
|---|---|---|---|---|
| Sprite máy bay, hình vật phẩm và hiệu ứng | Mã C# của dự án | `Scripts/Art/PixelAircraft.cs`, `Scripts/Aircraft/FlightBoardView.cs` | Tạo riêng cho dự án | Không dùng hình tải từ bên ngoài |
| 40 mục từ thử và nghĩa Việt | Biên soạn riêng cho prototype | `Data/Vocabulary/Resources/prototype-vocabulary.json` | Nội dung thử của dự án | Chưa xác minh mức CEFR, không gắn nhãn Oxford |
| Phát âm WAV en-US | Microsoft David Desktop qua Windows System.Speech | Giọng có sẵn trên máy | Tạo cục bộ cho prototype | Không sao chép audio từ từ điển Oxford |
| Hiệu ứng âm thanh ngắn | Tổng hợp bằng C# | `Scripts/Audio/FlightAudio.cs` | Tạo riêng cho dự án | Không có nhạc nền ở bản 0.1 |
| Chữ giao diện | Font hệ thống Windows | Arial/Segoe UI khi chạy | Không đóng gói file font hệ thống | Có font dựng sẵn làm phương án dự phòng |

## Từ vựng

CSV mẫu chỉ chứa tên các cột. Dữ liệu thử hiện nằm trong JSON của game và không được gắn nhãn CEFR/Oxford. Với dữ liệu học chính thức về sau, lưu nguồn, phạm vi mức CEFR, nghĩa được chọn và tình trạng duyệt.

Không mặc định quyền tra cứu từ điển đồng nghĩa với quyền sao chép/đóng gói lại nội dung. Khi lựa chọn nguồn Oxford, xác minh quyền dùng định nghĩa, audio, bản dịch và dữ liệu offline theo sản phẩm thực tế.

## Audio và đồ họa

Ghi riêng quyền sử dụng bản ghi và hình vẽ, kể cả nội dung mua hoặc tạo bằng công cụ. Không đưa API key, mật khẩu hoặc token vào Assets và bản build.

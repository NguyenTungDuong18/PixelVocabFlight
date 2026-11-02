# Mở dự án và làm việc

## Unity Hub

1. Mở Hub, chọn **Add / Add project from disk** hoặc mục tương đương trong giao diện.
2. Chọn `C:\Users\Admin\Downloads\PixelVocabFlight\Game`.
3. Mở bằng Editor `6000.6.7f1`.
4. Đợi nạp package và nhập asset; lần đầu có thể lâu hơn.
5. Nội dung riêng của game sẽ nằm ở `Assets/_Project`.

Project được khởi tạo từ template 2D có sẵn cùng Editor. Scene và cấu hình của template được giữ để mở dự án; chưa có gameplay riêng được thêm trong bước tạo thư mục.

## VS Code

Có thể mở thư mục `PixelVocabFlight` để xem cả tài liệu và mã, hoặc mở `Game` khi tập trung lập trình. Nếu Unity chưa liên kết VS Code, chọn trình soạn thảo trong **Edit → Preferences → External Tools** khi bắt đầu viết mã.

## Quản lý file

- Đưa file gốc vào SourceAssets, bản xuất dùng khi chạy vào Assets/_Project.
- Sau khi Unity tạo `.meta`, giữ `.meta` đi cùng asset. Di chuyển asset trong cửa sổ Project của Unity.
- Không chỉnh package hoặc cấu hình do Unity sinh khi chưa có mục đích cụ thể.
- Library/Temp/Logs là dữ liệu cục bộ, không phải bản sao lưu mã nguồn.
- Khi chia sẻ dự án để tiếp tục phát triển, cần Assets cùng `.meta`, Packages và ProjectSettings.
- Bản game phát hành gồm toàn bộ thư mục build, không chỉ riêng file .exe.

## Bước phát triển kế tiếp

Tạo scene gameplay thử với ba máy bay, từ trên thân, nghĩa Việt dưới màn hình và ô nhập. Kiểm chứng luật chọn mục tiêu trước khi làm đồ họa hoàn chỉnh.

Tài liệu Unity về khởi tạo project từ dòng lệnh:
https://docs.unity.com/en-us/engine/6000.6/manual/unity-editor/command-line-arguments/editor

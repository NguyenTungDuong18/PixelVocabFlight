# WORDWING 0.5 — Nhịp sinh 10 giây, máu kim loại và va chạm

## Luật hiện tại

- Mỗi chuyến bắt đầu với **5 kim loại**, tương đương **5 máu**. Thanh máu gồm năm ô kim loại và số `KIM LOẠI n/5`, cùng dùng một giá trị. Về 0 là thua.
- Máy bay sinh cơ bản mỗi **10 giây**, vẫn có một chiếc ngay khi cất cánh. Rừng giữ đặc tính sinh nhanh hơn 30% nên nhịp là **10 / 1,3 ≈ 7,69 giây**. Máy bay từ tàu sân bay cũng cách nhau 10 giây; chu kỳ thử bắn tên lửa của tàu vẫn 5 giây, xác suất 50%.
- Máy bay địch tiếp cận rồi, sau khoảng **18 giây tồn tại**, báo đỏ chuẩn bị lao tới trong **1,2 giây**. Nó khóa hướng tới vị trí người chơi lúc chuẩn bị lao, sau đó lao theo hướng đó. Có thể đổi sang lái và di chuyển ngang để né.
- Máy bay đâm trúng mất **1 kim loại**. Máy bay đã gây va chạm bị loại bỏ, không gây sát thương lặp và không cho điểm/vật phẩm. Máy bay khác đang bất tử với chữ gõ vẫn có thể đâm người chơi. Nếu chiếc bị loại là mục tiêu đang hỏi, nghĩa đổi ngay sang máy bay còn sống.
- Nếu né được, máy bay tiếp tục bay qua rồi rời màn hình. Khi mục tiêu đang hỏi bay ra ngoài, nghĩa cũng chuyển sang máy bay còn sống.
- Tên lửa từ tàu **di chuyển thật về phía vị trí đã ngắm**, không đứng chờ trả lời vô hạn. Trúng người chơi mất **2 kim loại**, không tự kết thúc chuyến bay khi còn máu. Có thể né tên lửa bằng lái ngang.
- Ví dụ: `5 → 3` khi trúng tên lửa; tiếp tục trúng máy bay còn `2`; trúng thêm tên lửa về `0` và thua. Máu không xuống số âm.
- Bốn lựa chọn vẫn hoạt động khi đang bắn: trả lời đúng trước khi tên lửa va chạm sẽ làm nổ vòng tròn và hạ địch xung quanh như cũ.
- Sai tên lửa **ba lần**: khóa đáp án của tên lửa đó, tên lửa tăng tốc ×4. Đây là một cuộc lao tới có thể né; chỉ trừ hai kim loại khi thực sự va chạm. Luật này thay thế việc sai ba lần là thua ngay trong bản 0.4.
- Vật phẩm vẫn có **10% cơ hội rơi** khi hạ máy bay, chỉ xăng hoặc kim loại. Nhặt kim loại hồi **1 máu**, tối đa **5**. Cường hóa vẫn kích hoạt sau mỗi năm lần nhặt kim loại, dùng bộ đếm tiếp tế riêng; **không tiêu hao kim loại đang làm máu**.
- Hết xăng vẫn kết thúc chuyến bay. Chu kỳ môi trường 3 phút, nền chuyển dần, học từ/từ loại, khiên băng, roll và điều khiển lái/bắn tiếp tục hoạt động.

## Kiểm tra

`dotnet run --project Tools/RulesChecks/RulesChecks.csproj` đạt **30.480 kiểm tra**. Có kiểm tra mới cho nhịp sinh 10 giây, rừng +30%, năm máu đầu trận, sát thương 1/2, hồi máu và giới hạn, không tiêu máu khi cường hóa, máy bay/tên lửa thực sự tiến tới, cảnh báo lao, né thành công, mục tiêu bị va chạm được đổi, chỉ gây sát thương một lần, hết máu thì thua và kiểm tra đoạn đường bay để tránh bỏ qua va chạm khi khung hình chậm.

Kiểm tra hồi quy vẫn bao gồm danh mục Oxford, phát âm, bộ lọc, bốn môi trường, khiên, roll, nổ lan và vật phẩm. Mẫu 1.000 seed cho 100 lần rơi vật phẩm (50 xăng/50 kim loại); 400 seed cho 74 tàu ở chu kỳ đầu và 38/74 tàu bắn tên lửa ở lần thử đầu.

Bản Windows đạt **21/21 kiểm tra tích hợp**, với đầu vào chuột/bàn phím giả lập qua Unity Input System và hồ sơ QA riêng. Đã xem ảnh thanh máu năm ô, cảnh báo lao, máu còn 4 sau máy bay đâm, còn 3 sau tên lửa trúng và màn hình thua khi về 0. Ảnh giao diện và báo cáo nằm tại `Tools/Smoke-Health/`. Đây không phải lượt thử thủ công bằng thiết bị vật lý.

Build bằng `Tools/Build-Windows.ps1`; chạy `Builds/Windows/Wordwing.exe`. Máy nhận bản build không cần Unity, nhưng cần cả thư mục Windows đi kèm.

# Lịch sử phiên bản (`Docs/history/`)

Mỗi file ghi lại một phiên bản; luật của bản mới hơn được ưu tiên. Chỉ mở khi cần lý do thiết kế cũ.

| File | Nội dung |
| --- | --- |
| 01-Game-Plan | Ý tưởng và luật ban đầu |
| 03-Getting-Started | Mở project bằng Unity Hub |
| 04-Asset-Sources | Nguồn tài nguyên và giấy phép |
| 05-Prototype-0.1 / 06-Validation | Bản mẫu đầu tiên và kiểm tra |
| 07-Oxford-Library / 08-Oxford-Validation / 09-Full-Oxford-5000 | Thư viện Oxford, bộ lọc, đủ 5.981 mục |
| 10-Continuous-Flight | Dòng máy bay liên tục (`ContinuousFlight`) |
| 11-Metal-Health | Metal = giáp, cường hóa |
| 12-Missile-Hover-and-Audio | Tên lửa 4 đáp án, rê chuột, âm thanh |
| 13-Player-and-Carrier-Art / 14-Carrier-Route-and-Transparent-Sprites | Art người chơi/tàu, lộ trình tàu |
| 15-Ocean-Background-and-Smooth-Departure / 16-Carrier-Heading-and-Ocean-Scale | Nền biển, tàu xoay mũi (0.10) |
| 17-Interaction-Polish | Đánh bóng tương tác |
| 18-Pixel-Art-1944 | 0.13: PixelForge, art 1944 (54/54 smoke) |
| 19-Cockpit-Lock-On-Blur | 0.14: buồng lái, khóa mục tiêu, nền mờ, wildlife, cất cánh (72/72 smoke) |
| 20-Military-Base | 0.15: căn cứ đi lại được, 43 model voxel, rig nhân vật, NPC, hội thoại, nhiệm vụ (110 smoke) |
| 21-Codebase-Restructure | sau 0.15: sắp xếp thư mục, chia nhỏ class/module lớn thành partial và module con (113 smoke) |
| 22-Model-Library | sau 0.15: vẽ lại model căn cứ, thư viện 247 model (nhà máy, sân bay lớn, kho, máy bay, cây, đồ vật), lá rơi, kỹ sư (113 smoke) |

Sau 0.15 (chưa lên số phiên bản): sắp xếp lại thư mục. `Scripts/` tách `Logic/` (assembly `Wordwing.Logic`) và `Unity/`; sprite chia thư mục con theo tên; phát âm chia theo chữ cái đầu; bản đồ tài liệu chia thành `Docs/map/<mảng>/<chủ đề>.md`.

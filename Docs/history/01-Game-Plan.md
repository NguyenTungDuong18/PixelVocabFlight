# Kế hoạch phát triển Pixel Vocab Flight

Ngày lập: 02/11/2026. Đây là kế hoạch, không phải danh sách tính năng đã hoàn thành. Các số cân bằng ngoài yêu cầu tốc độ đều là đề xuất cần chơi thử.

## 1. Yêu cầu đã ghi nhận

- Game C#, đồ họa pixel 2D, góc nhìn từ trên xuống.
- Chuyến bay vô hạn, có điểm và vật phẩm hỗ trợ trên đường bay.
- Máy bay địch mang các từ tiếng Anh trên thân.
- Một nghĩa tiếng Việt xuất hiện ở bảng phía dưới màn hình.
- Chỉ máy bay có từ khớp nghĩa đó được phép bị bắn; các máy bay khác miễn sát thương.
- Người chơi gõ đúng từ tiếng Anh để hạ mục tiêu.
- Sau mỗi lần hạ, tự động đọc từ vừa học.
- Trước mỗi chuyến bay, được chọn khoảng từ vựng, chủ đề và mức CEFR, ví dụ đồ ăn + B1.
- Tốc độ ban đầu chậm, mỗi phút tăng thêm 10% tốc độ gốc, tối đa tăng 50%.

Mục tiêu học tập là nhận diện nghĩa, luyện chính tả và nghe âm của từ. Vì từ tiếng Anh được in trên máy bay, trả lời đúng trong trận chưa đủ chứng minh khả năng nhớ lại từ khi không có đáp án gợi ý.

## 2. Phạm vi bản đầu

Unity + C#, Windows, bàn phím vật lý, một người chơi, lưu tiến độ trên máy. Dùng Editor 6000.6.7f1 đang cài trên máy; không tự nâng phiên bản trong quá trình làm.

Tập trung vào một bộ từ nhỏ đã kiểm tra, một nền cuộn và một vòng chơi hoàn chỉnh. Tài khoản, chơi mạng, bảng xếp hạng online và bản điện thoại để sau.

## 3. Vòng chơi và điều khiển

1. Chọn bộ từ, trình độ, chủ đề và giọng đọc.
2. Xem hướng dẫn ngắn, bắt đầu chuyến bay.
3. Trên màn hình có khoảng 3–5 máy bay mang các từ khác nhau.
4. Game chọn một mục tiêu nội bộ và hiện nghĩa Việt tương ứng.
5. Người chơi gõ vào ô trả lời; nhấn Enter để gửi.
6. Đúng: máy bay mục tiêu nổ, cộng điểm, nhận vật phẩm nếu đủ điều kiện và nghe phát âm.
7. Sai: mục tiêu không bị hạ, mất combo; còn thời gian thì được sửa.
8. Hết máu hoặc nhiên liệu thì kết thúc và chuyển sang kết quả/ôn tập.

Máy bay người chơi tự giữ vị trí ở bản đầu. Nếu thêm điều khiển sau này, dùng phím mũi tên để không trùng WASD với chữ đang gõ. Backspace để sửa; Escape để pause.

Chỉ chấm đáp án khi Enter, không hiện phản hồi đúng/sai theo từng ký tự vì sẽ làm lộ mục tiêu. Không phân biệt chữ hoa/thường, bỏ khoảng trắng thừa đầu/cuối; không tự sửa chính tả. Biến thể Anh-Anh/Anh-Mỹ chỉ chấp nhận khi được khai báo trong dữ liệu.

## 4. Giữ bí mật đáp án và xử lý máy bay không thể bắn

Không tô sáng mục tiêu đúng, thay màu khiên hoặc hiện đường ngắm trước khi trả lời. Tất cả nhãn máy bay có cùng phong cách. Trạng thái được phép bắn chỉ nằm trong logic.

Chỉ mục tiêu của câu hỏi hiện tại gây mất máu nếu đi qua vạch thất bại. Các máy bay khác bay qua mà không gây sát thương. Nếu cho mọi chiếc gây sát thương trong khi chỉ một chiếc được bắn, sẽ có tình huống người chơi không thể tránh mất máu.

Máy bay khác có thể được chọn cho câu hỏi kế tiếp nếu còn đủ quãng đường để đọc và gõ. Không chọn một chiếc đã quá gần đáy. Bộ điều phối chọn trong nhóm ứng viên hợp lệ và bổ sung máy bay khi cần; tránh luôn chọn chiếc thấp nhất hoặc mới sinh vì sẽ tạo mẹo đoán bằng vị trí.

Mỗi câu hỏi chỉ được giải quyết một lần. Nhấn Enter liên tục, animation nổ hoặc nhiều callback không được cộng điểm hay trừ máu hai lần. Khi câu hỏi đổi, xóa chuỗi nhập cũ.

## 5. Tốc độ theo thời gian

```text
multiplier = 1 + 0.10 * min(floor(activeSeconds / 60), 5)
enemySpeed = initialSpeed * multiplier
```

| Thời gian chơi | Hệ số |
|---|---:|
| 0 đến trước 1 phút | 1,0 |
| 1 đến trước 2 phút | 1,1 |
| 2 đến trước 3 phút | 1,2 |
| 3 đến trước 4 phút | 1,3 |
| 4 đến trước 5 phút | 1,4 |
| Từ phút 5 | 1,5 |

Không nhân lãi kép 1,1 qua mỗi phút. Áp dụng nấc mới cho cả máy bay đang bay và mới sinh. Pause, menu và mất focus không tính thời gian chơi.

Từ phút 5, giữ trần 150%; không âm thầm tăng thêm mật độ theo thời gian. Hiệu ứng làm chậm nếu được thêm sẽ là hệ số tạm thời riêng, hết hạn thì quay về đúng nấc cơ bản.

## 6. Độ dài từ và thời gian trả lời

CEFR và tốc độ gõ là hai thiết lập riêng. Một người hiểu B1 vẫn có thể gõ chậm.

Đề xuất thời gian tối thiểu = thời gian nhận diện + số ký tự / tốc độ nhập đã chọn. Ví dụ thử ban đầu: 2 giây nhận diện, 2 ký tự/giây.

Bộ điều phối chỉ ra câu hỏi nếu mục tiêu còn đủ thời gian, kể cả khi sắp tăng nấc tốc độ hoặc hiệu ứng làm chậm sắp hết. Nếu từ quá dài, điều chỉnh cấu hình đường bay hoặc báo chưa hỗ trợ trước chuyến bay; không tự cắt thời gian xuống mức không thể gõ.

Khởi điểm để thử: đường bay toàn màn hình khoảng 22 giây ở tốc độ gốc, khoảng 14,7 giây tại trần 150%. Cần xác minh thực tế bằng các từ dài nhất trong bộ thử.

## 7. Máu, xăng và kim loại

| Thành phần | Đề xuất ban đầu |
|---|---|
| Máu | 3; bỏ lỡ một mục tiêu mất 1 |
| Xăng | 100/100, tiêu hao 1 đơn vị/giây chơi |
| Bình xăng | Bảo đảm rơi sau mỗi 3 lần hạ đúng, hồi 40, tối đa 100 |
| Kim loại | Mỗi lần hạ đúng nhận 1; đủ 5 kích hoạt cường hóa |
| Cường hóa | 12 giây, điểm x1,5, tiêu hao xăng giảm một nửa, hiệu ứng bắn nổi bật |

Vật phẩm xuất hiện tại vị trí máy bay bị hạ, trôi theo đường bay rồi được hút về máy bay người chơi. Tự thu ở bản đầu để không thêm thao tác chuột giữa lúc gõ.

Cường hóa vẫn yêu cầu nhập đúng từ. Không có đạn lan tự hạ máy bay miễn sát thương. Nếu tích đủ kim loại khi đang cường hóa, cộng thời gian, tối đa 24 giây còn lại; không nhân chồng hệ số điểm.

Phải thử nguồn xăng với thời gian trả lời và phát âm thực tế. 3 câu, mỗi câu tối đa khoảng 10 giây trả lời + 3 giây đọc/chuyển câu, tiêu hao gần 39 xăng; hồi 40 là giá trị khởi điểm. Nếu tăng độ dài từ, phải cân bằng lại. Không phụ thuộc hoàn toàn vào rơi xăng ngẫu nhiên gây chết dù chơi tốt.

Khiên hấp thụ một lần bỏ lỡ và vật phẩm làm chậm là phần mở rộng sau khi xăng/kim loại ổn định.

## 8. Điểm và combo

Đề xuất điểm gốc một lần hạ: `100 + 5 × số chữ cái`, thêm tối đa 50 điểm cho tốc độ trả lời, rồi nhân combo và cường hóa.

Combo tăng 0,25 sau mỗi 5 câu đúng liên tiếp, tối đa x2. Tính điểm lượt hiện tại bằng hệ số hiện có, sau đó cập nhật combo cho lượt tiếp. Sai hoặc bỏ lỡ đặt combo về x1.

Không cộng điểm cho việc đứng chờ hoặc gõ sai. Lưu kỷ lục riêng theo tập từ, tốc độ gõ, chế độ và phiên bản luật; không so chung thành tích của các cấu hình khác nhau.

## 9. Chọn tập học

- Chọn đúng một mức CEFR, một khoảng mức, hoặc toàn bộ đến một mức.
- Chọn chủ đề; nhiều chủ đề mặc định lấy hợp các chủ đề rồi giao với CEFR.
- Chọn số lượng trong số mục thực sự có hoặc chọn danh sách thủ công.
- Hỗ trợ khoảng thứ tự trong danh sách đã lọc, ví dụ mục 21–50.
- Chọn từ mới, từ từng sai, từ đến lịch ôn hoặc trộn.
- Xem trước danh sách và số lượng trước khi bắt đầu.

“Đồ ăn + đúng B1” khác “Đồ ăn + từ A1 đến B1”. Không tự thêm từ ngoài bộ lọc để đủ số lượng. Chọn 30 mục nghĩa là chuyến bay lặp trong tập 30 mục, không kết thúc sau 30 máy bay.

Nếu không đủ 3 đáp án phân biệt được, thông báo rõ hoặc chuyển sang chế độ luyện riêng. Không cố sinh các đáp án gây mơ hồ.

## 10. Nguồn từ và chất lượng dữ liệu

Oxford 3000 gồm từ cốt lõi A1–B2; Oxford 5000 bổ sung thêm 2.000 từ B2–C1. Cần phân biệt mức gán cho mục từ/loại từ với mức gán cho một nghĩa cụ thể; không tự coi mọi nghĩa của một từ đều cùng cấp.

Đơn vị học là một nghĩa có định danh: mục từ, loại từ, nghĩa Việt, CEFR có nguồn, chủ đề, các biến thể hợp lệ, phiên âm, audio UK/US và thông tin quyền sử dụng.

Không cho hai máy bay có cùng cách viết cùng xuất hiện. Không đưa hai đáp án đều phù hợp với nghĩa Việt vào cùng một câu hỏi. Thêm loại từ hoặc ngữ cảnh ngắn khi cần. Các trường hợp đồng nghĩa cần duyệt thủ công.

Không mặc định có thể sao chép hàng loạt định nghĩa/audio Oxford và đóng gói offline. FAQ Oxford Dictionaries API hiện nêu lưu/cache hoặc dùng offline cần Enterprise license. Phải kiểm tra sản phẩm và quyền dùng phù hợp; không giả định API có sẵn toàn bộ Anh–Việt + CEFR + chủ đề cần thiết.

Prototype có thể dùng dữ liệu tự biên soạn được phép sử dụng, nhưng phải ghi rõ nguồn và không giới thiệu đó là bộ Oxford chính thức. Bộ phát hành theo yêu cầu Oxford cần nguồn được phép dùng. Bảng CSV hiện tại chỉ có tiêu đề để biên soạn, chưa có từ được xác nhận.

Nguồn tham khảo:

- https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000
- https://www.oxfordlearnersdictionaries.com/us/topic/category/food-and-drink
- https://developer.oxforddictionaries.com/faq

## 11. Phát âm và âm thanh

Phát từ vừa hạ, giảm nhẹ nhạc/tiếng nổ để nghe rõ. Có thanh âm lượng riêng cho nhạc, hiệu ứng và giọng đọc.

Chuẩn bị file audio trước để chơi offline; không gọi mạng sau mỗi phát bắn. Nguồn thu âm hoặc TTS cần có quyền sử dụng. Từ có cách đọc khác theo loại từ phải được duyệt theo ngữ cảnh.

Không để giọng đọc chồng nhau. Mở câu hỏi mới sau khi đọc xong và nghỉ ngắn; khi đó chỉ chọn máy bay còn đủ thời gian. Tính thời gian này vào nhiên liệu. Kiểm tra đủ file trước trận, không treo khi thiếu âm thanh.

Một lựa chọn kỹ thuật tạo file TTS cần đánh giá điều kiện dùng: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis

## 12. Pixel art và giao diện

Khởi điểm: khung 16:9, hình ảnh tham chiếu 640×360, máy bay khoảng 32×32 hoặc 48×48. Xác nhận kích thước trước khi làm toàn bộ sprite. Nền biển/bầu trời ít chi tiết để đọc chữ.

Nhãn từ gắn trên thân hoặc bảng tên sát thân máy bay, giữ ngang khi máy bay nghiêng. Tránh chồng nhãn. Font nghĩa Việt phải có đủ dấu và đọc rõ; có thể dùng chữ độ phân giải cao trên nền pixel.

HUD trên: điểm, combo, thời gian, tốc độ. Góc: máu, xăng, kim loại và buff. Giữa: máy bay/vật phẩm. Bảng dưới: nghĩa Việt, loại từ và ô nhập. Thêm tùy chọn giảm rung, không dùng màu làm dấu hiệu duy nhất.

Asset tối thiểu: một máy bay người chơi, ba mẫu địch, nền cuộn, xăng, kim loại, đạn, nổ, động cơ, icon HUD và font hợp lệ.

## 13. Màn hình và lưu tiến độ

Menu chính → chuẩn bị chuyến bay → hướng dẫn/đếm ngược → chơi → kết quả → ôn tập hoặc chơi lại.

Mất focus tự pause. Pause dừng di chuyển, xăng và thời gian hiệu ứng. Tiếp tục có đếm ngược ngắn, tránh nhận Enter còn giữ từ menu.

Lưu cài đặt, kỷ lục và lịch sử theo nghĩa: số lần gặp, đúng lần đầu, sửa rồi đúng, bỏ lỡ, thời gian trả lời và lần luyện gần nhất. Lưu ở thư mục dữ liệu người dùng của game; không ghi save vào Assets hoặc ghi lại file mỗi frame.

Một lần đúng không đánh dấu “đã thuộc”. Ôn cuối chuyến bay có bài chỉ hiện nghĩa Việt, yêu cầu gõ mà không nhìn thấy đáp án. Từ sai quay lại sau vài câu khác; bộ điều phối tránh lặp một từ liên tiếp khi tập còn đủ lớn.

## 14. Trách nhiệm các nhóm mã nguồn

| Nhóm | Trách nhiệm dự kiến |
|---|---|
| Core | Phiên chơi, trạng thái và đồng hồ |
| Aircraft | Sinh máy bay, di chuyển, chọn ứng viên |
| Combat | Giải quyết hạ/bỏ lỡ và khóa kết quả |
| Typing | Ô nhập và kiểm tra chuỗi |
| Vocabulary | Nạp, lọc, chọn nghĩa và theo dõi tiến độ |
| Items | Xăng, kim loại, hiệu ứng tạm thời |
| Scoring | Điểm và combo |
| Audio | Điều phối phát âm, nhạc và hiệu ứng |
| UI | Menu, HUD, pause và kết quả |
| Persistence | Save, phiên bản dữ liệu và phục hồi |

Đây là phân chia để phát triển tiếp; chưa có các lớp gameplay được viết trong lần tạo cấu trúc này.

## 15. Lộ trình có bản chơi được ở mỗi mốc

| Mốc | Sản phẩm | Tiêu chí |
|---|---|---|
| 0 | Cấu trúc và project Unity 2D | Mở được project, biết vị trí mọi nhóm file |
| 1 | Prototype ba máy bay bằng hình tạm | Đúng nghĩa mới hạ, không lộ đáp án, gõ/Enter hoạt động |
| 2 | Vòng chơi hoàn chỉnh | Vô hạn, tốc độ, máu, xăng, kim loại, điểm và Game Over |
| 3 | Học từ vựng | Bộ lọc, phát âm, lưu tiến độ và ôn sau trận |
| 4 | Hoàn thiện pixel art | Chữ rõ, không chồng nhãn, hiệu ứng và âm thanh ổn |
| 5 | Bản Windows | Kiểm thử dài, sửa lỗi, đóng gói và hướng dẫn |

Ước lượng cho một người quen Unity: khoảng 2–4 ngày cho prototype, vài tuần cho bản nhỏ hoàn chỉnh tùy chất lượng đồ họa và nội dung. Ước lượng lại sau mốc 1; thời gian biên soạn/xin quyền dữ liệu tách riêng.

## 16. Kiểm thử và nghiệm thu

- Kiểm tra biên 60, 120, 180, 240 và 300 giây; sau phút 5 giữ 150%.
- Pause không làm mất xăng hoặc hết buff.
- Gõ đúng từ của máy bay khác không hạ được máy bay.
- Enter và vượt vạch cùng một bước chỉ giải quyết câu hỏi một lần theo thứ tự xác định.
- Máy bay không phải mục tiêu vượt vạch không gây sát thương.
- Từ dài vẫn có đủ thời gian ở trần tốc độ.
- Không có nhóm đáp án trùng hoặc nghĩa mơ hồ chưa duyệt.
- Nguồn xăng cho phép lượt chơi tốt duy trì lâu, không ép chết do random.
- Audio phát đủ, không chồng, không cần mạng trong trận.
- Thử 30–60 phút hoặc mô phỏng dài để kiểm tra lặp từ, bộ nhớ và sinh máy bay.
- Đóng/mở lại vẫn còn tiến độ; save lỗi có đường phục hồi.
- Bản xuất Windows chạy trên máy không có Unity Editor.

Mốc tiếp theo: prototype ba máy bay, một nghĩa Việt và cơ chế gõ đúng để hạ. Chưa cần đồ họa hoàn chỉnh trước khi kiểm chứng luật này.

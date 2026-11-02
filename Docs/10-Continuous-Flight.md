# WORDWING 0.4 — Chuyến bay liên tục

Ngày: 02/11/2026. Bản Windows: `Builds/Windows/Wordwing.exe`.

## Cách chơi

1. Vào hangar để xem máy bay và chọn môi trường bắt đầu.
2. Chọn **CHỌN TỪ VỰNG / CHỦ ĐỀ** nếu muốn đổi Oxford 3000/5000, CEFR, chủ đề, tìm kiếm hoặc khoảng thứ tự. Kho vẫn giữ đủ 5.981 mục học. Cần ít nhất bốn đáp án phân biệt để có bốn lựa chọn tên lửa.
3. Cất cánh trong chế độ **LÁI**. Rê chuột trong vùng bay để di chuyển ngang; trục dọc cố định, vị trí ngang được giới hạn trong vùng cho phép. Khi con trỏ nằm trong vùng bay, máy bay thay cho con trỏ.
4. Nhấn **Tab** hoặc công tắc màu cam để sang **BẮN**. Máy bay đứng yên ở vị trí vừa chuyển. Nhập từ tiếng Anh tương ứng với nghĩa Việt và nhấn **Enter**, hoặc nút **BẮN**.
5. Máy bay sa mạc cần chọn thêm từ loại trong danh sách. Danh sách mở lên trên, có thể cuộn; gồm đủ 17 loại có trong dữ liệu Oxford.
6. Dùng **ĐỔI NGHĨA** để chuyển sang một mục khác đang hiện diện. Nếu chưa có nghĩa khác để đổi thì nút chưa hoạt động và không trừ lượt.
7. Trong biển, chọn một trong bốn từ quanh tên lửa. Nếu có nhiều tên lửa, dùng **ĐỔI TL →** hoặc bấm dấu **!** để xem tên lửa khác. Chỉ có thể trả lời trong chế độ bắn.
8. **Escape** tạm dừng hoặc tiếp tục. Khi mất focus, game tự tạm dừng.

## Máy bay và nghĩa Việt

- Có một máy bay ngay lúc bắt đầu. Sau đó một máy bay xuất hiện mỗi 5 giây; không chờ trả lời hay đọc xong phát âm.
- Máy bay cũ vẫn hiện diện khi máy bay mới xuất hiện. Khi đến vùng giữ đội hình, chúng ở lại cho đến khi bị hạ. Đã bỏ cơ chế hết thời gian thì xóa đợt/mất giáp.
- Nghĩa Việt không tự thay đổi vì sinh thêm máy bay hoặc đổi môi trường. Chỉ máy bay tương ứng với nghĩa đang hỏi nhận sát thương từ thao tác nhập chữ.
- Mỗi lần bắn trúng sẽ chọn ngẫu nhiên một máy bay khác làm mục tiêu. Nếu chỉ còn một máy bay còn sống thì có thể giữ máy bay đó; nếu không còn máy bay thì chờ lần sinh tiếp theo.
- Máy bay băng nhận lần trúng đầu chỉ mất khiên, chưa tính hạ gục; lần thứ hai mới bị hạ. Sau lần đầu nghĩa vẫn chuyển sang mục tiêu khác nếu có.
- Khi bộ học nhỏ đã có mặt hết trên màn hình, game có thể lặp lại đúng mục học đó để tiếp tục sinh máy bay mỗi 5 giây. Chỉ chiếc được chọn nội bộ làm mục tiêu nhận đạn; các bản sao vẫn giữ bất tử. Các từ khác cách viết nhưng có đáp án/ý nghĩa trùng đã biết được tránh xuất hiện cùng nhau.
- Vụ nổ tên lửa bỏ qua trạng thái bất tử và khiên băng. Nếu hạ đúng máy bay đang được hỏi, nghĩa đổi ngay sang máy bay còn sống.
- Sau mỗi lần hạ máy bay, game xếp hàng đọc từ bằng audio offline. Không làm dừng đồng hồ sinh địch. Tốc độ vẫn tăng cộng thêm 10% tốc độ ban đầu mỗi phút, tối đa +50%.

## Bốn môi trường

Mỗi môi trường tồn tại **180 giây**. Nền cuộn liên tục; khi đổi vùng, nền cũ chuyển dần sang nền mới trong **6 giây**. Vòng lặp: **Rừng → Sa mạc → Băng → Biển → Rừng**. Có thể chọn điểm bắt đầu vòng lặp tại hangar.

| Vùng | Đặc tính máy bay mới |
|---|---|
| Rừng rậm | Tốc độ sinh cao hơn 30%: khoảng `5 / 1,3 = 3,846` giây/máy bay. Máy bay cánh dài, hai cụm động cơ. |
| Sa mạc | Phải nhập đúng từ và chọn đúng từ loại. Máy bay cánh quét màu cát. |
| Băng | Máy bay bọc giáp màu lạnh, có vòng khiên; hai lần trúng mới bị hạ. |
| Biển | Máy bay hải quân đuôi kép; mỗi lượt sinh có 20% xuất hiện tàu sân bay kèm máy bay cất cánh. |

Máy bay đã xuất hiện giữ đặc tính vùng gốc khi đổi môi trường. Nền và hình máy bay được tạo bằng mã pixel; nền có độ tương phản thấp để chữ dễ đọc.

Vùng quan sát rộng 1.360 đơn vị giao diện, tăng khoảng 31% chiều ngang so với bản cũ. Thân máy bay địch giảm từ 124 còn 58 đơn vị. Khi rất đông, máy bay được thu nhỏ thêm và đội hình giãn theo số hàng; không xóa máy bay để tạo chỗ.

## Tàu sân bay và tên lửa

- Tàu ở lớp phía dưới máy bay, trôi qua vùng bay trong khoảng 40 giây. Mỗi 5 giây tàu cho máy bay cất cánh và độc lập có **50%** bắn một tên lửa. Tàu đã xuất hiện tiếp tục hoạt động khi nền đổi vùng, cho đến khi trôi ra ngoài.
- Tên lửa có nghĩa Việt và **bốn từ tiếng Anh** thuộc đúng bộ học đã chọn, không thêm từ ngoài bộ lọc.
- Trả lời đúng: tên lửa nổ thành vòng tròn bán kính khoảng 122 đơn vị giao diện. Máy bay trong vòng nổ bị hạ, cả máy bay bất tử hoặc còn khiên. Vị trí kiểm tra sát thương trùng với vị trí tên lửa trên màn hình.
- Mỗi tên lửa có bộ đếm lỗi riêng. Hai lần sai đầu vẫn được thử; lần thứ ba khiến tên lửa lao vào máy bay và thua ngay, dù còn xăng/giáp. Có chuyển động lao tới trước màn hình kết quả.
- Khi nhiều tên lửa cùng tồn tại, chỉ mở bộ bốn đáp án của tên lửa đang xem để tránh các bảng che nhau. Các tên lửa còn lại vẫn tồn tại, có dấu **!**, không tự bị xóa khi đổi bảng.

## Vật phẩm và lượt đổi

- Mỗi máy bay bị hạ có đúng **10% cơ hội** rơi vật phẩm; nếu có, chọn xăng hoặc kim loại với tỉ lệ 50/50. Mỗi lần hạ tối đa một vật phẩm, kể cả do vòng nổ.
- Xăng/kim loại rơi tại chỗ máy bay bị hạ rồi được hút về người chơi sau khoảng 1,2 giây. Xăng thêm 50, tối đa 100. Kim loại thêm một mảnh; đủ năm mảnh đổi lấy 12 giây cường hóa, điểm ×1,5 và tiêu hao xăng giảm nửa. Có thể nối thời gian đến tối đa 24 giây.
- Đã bỏ việc mỗi lần hạ tự cho kim loại và cứ ba lần hạ chắc chắn cho xăng.
- Để phù hợp vật phẩm hiếm, tiêu hao cơ bản còn **0,12 xăng/giây**. Không tiếp tế thì đầy bình kéo dài khoảng 13 phút 53 giây.
- Bắt đầu mỗi chuyến có **ba lượt đổi nghĩa**. Không tự nhận thêm theo thời gian hoặc khi hạ máy bay.
- Độc lập với việc hạ địch, mỗi 5 giây có **10% cơ hội** sinh icon **R+** ở vị trí ngang ngẫu nhiên. Icon trôi xuống; chỉ nhận thêm một lượt nếu đang **LÁI** và đưa máy bay đến đúng vị trí khi icon đi qua. Chỉ bấm icon hoặc đứng ở chế độ bắn không thu được lượt. Icon bị bỏ lỡ sẽ trôi ra ngoài.

## Dữ liệu và lưu tiến độ

Giữ nguyên bộ Oxford, nghĩa Việt, phát âm và các bộ lọc. Vùng bắt đầu được lưu cùng hồ sơ; không xóa bộ học hoặc thống kê từ cũ. Kỷ lục lối chơi liên tục được lưu riêng theo bộ từ và vùng bắt đầu, tránh trộn với điểm của cơ chế ba máy bay cũ.

Các nghĩa Việt nhập tự động vẫn cần rà soát; chủ đề là phân loại của game. Xem `09-Full-Oxford-5000.md` và màn hình nguồn/giấy phép.

## Kiểm tra

- Chạy `dotnet run --project Tools/RulesChecks/RulesChecks.csproj`: **30.457 kiểm tra đạt**, gồm dữ liệu Oxford, chọn khoảng/chủ đề, đồng hồ sinh, bộ học bốn từ vẫn sinh liên tục, mục tiêu không tự mất, từ loại, khiên, tỉ lệ vật phẩm, bắt icon, giới hạn điều khiển và tên lửa.
- Thử 1.000 lần hạ với seed cố định: 90 lần rơi vật phẩm, gồm 47 xăng/43 kim loại; không lần nào rơi cả hai. Đây là phép lấy mẫu xác nhận, không phải cam kết mọi 1.000 lần chơi đều rơi đúng số đó.
- Thử 400 seed biển: 78 lượt có tàu ở lần sinh đầu; 38/78 tàu bắn tên lửa ở chu kỳ bắn đầu, phù hợp các xác suất 20%/50% đã đặt.
- Bản Windows đạt **16/16 kiểm tra tích hợp** trong `Tools/Smoke-Continuous/`, ảnh chụp từ giao diện game thực. Có xác nhận con trỏ chuột điều khiển đúng vị trí ngang và phím Tab khóa vị trí khi chuyển sang bắn. Dùng thiết bị bàn phím/chuột giả lập của Unity Input System; không phải kiểm thử thủ công bằng chuột/bàn phím vật lý. Báo cáo chi tiết ở `smoke-report.json`.
- Có kiểm tra bản thư viện đầy đủ, Food + B1, nhập từ, chọn từ loại, chuyển chế độ, giữ máy bay cũ, đổi nghĩa, dừng thời gian, khiên băng, tàu/tên lửa, đúng đáp án và thua ở lỗi thứ ba. Hồ sơ QA riêng với hồ sơ người chơi.
- Build Windows bằng `Tools/Build-Windows.ps1`, trong bản sao riêng để không khóa Unity Editor người dùng đang mở.

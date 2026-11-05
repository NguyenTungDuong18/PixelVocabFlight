---
name: wordwing-team
description: Điều phối một "đội" subagent chuyên biệt để sửa, thêm hoặc đánh bóng tính năng trong game WORDWING (PixelVocabFlight, Unity). Phân tích yêu cầu, chia việc theo mảng (luật chơi C# thuần, view/UI/âm thanh Unity, pixel art PixelForge, dữ liệu từ vựng, kiểm thử/build), giao cho agent ww-* chạy song song khi độc lập, rồi kiểm tra và tổng hợp. Dùng skill này mỗi khi người dùng muốn sửa, thêm, đổi, cân bằng, vẽ lại, fix bug hay lên phiên bản bất kỳ thứ gì trong game: luật chơi, máy bay, tên lửa, tàu sân bay, cockpit, hangar, cất cánh, sprite, nền, từ vựng, phát âm, điểm, giáp, xăng, smoke test, kể cả khi họ không nhắc tới "agent" hay "skill". Không dùng cho câu hỏi chỉ cần giải thích code.
---

# WORDWING team: chia việc cho agent chuyên biệt

Mục tiêu: một yêu cầu sửa game được tách thành các phần việc theo đúng mảng chuyên môn, mỗi phần do một agent `ww-*` đã có sẵn kiến thức mảng đó thực hiện, chạy song song khi có thể, rồi được kiểm chứng bằng chuỗi kiểm tra chuẩn của dự án trước khi báo lại cho người dùng.

Bạn (agent chính) là **người điều phối**: lập kế hoạch, viết "hợp đồng" giữa các mảng, giao việc, chuyển lỗi về đúng người, cập nhật tài liệu và báo cáo. Bạn không cần tự viết hết code.

Báo cáo với người dùng bằng **tiếng Việt**. **Không commit / push** nếu người dùng chưa yêu cầu.

## Đội hình

| Agent | Mảng | Sở hữu (chỉ agent này được sửa) |
| --- | --- | --- |
| `ww-rules` | Logic thuần C#: luật bay, điểm, thời gian, xác suất; căn cứ, NPC, hội thoại, nhiệm vụ | `Scripts/Logic/Flight/**`, `Scripts/Logic/World/**`, `Tools/RulesChecks/**` |
| `ww-view` | Mọi thứ Unity: điều phối, UI, sân chơi, nền, âm thanh, lưu hồ sơ, editor, smoke test | `Scripts/Unity/**` (trừ `Unity/Data/VocabularyCatalog.cs`), `Editor/**` |
| `ww-pixel` | Sprite pixel art sinh bằng code | `Tools/PixelForge/*.cjs` (và đầu ra forge sinh tự động) |
| `ww-vocab` | Dữ liệu từ vựng, nghĩa, chủ đề, phát âm, lọc/chọn từ | `SourceAssets/Vocabulary/**`, `Tools/Vocabulary/{Prepare-Oxford-Data,Build-Oxford-Vocabulary}.cjs`, `Tools/Vocabulary/Generate-Pronunciation.ps1`, `Scripts/Logic/Vocabulary/**`, `Scripts/Unity/Data/VocabularyCatalog.cs`, `Data/Vocabulary/**`, `Audio/Pronunciation/**` |
| `ww-verify` | Chạy kiểm tra, build, smoke, soát ảnh. **Không sửa source** | Chỉ ghi vào `Tools/Smoke/*` và scratchpad |

(`Scripts/...` = `Game/Assets/_Project/Scripts/...`, `Editor/...` = `Game/Assets/_Project/Editor/...`.)

Lý do chia theo quyền sở hữu file: các agent chạy cùng lúc trên **cùng một thư mục làm việc** (không dùng worktree, vì `Tools/UnityCompileChecks` cần `Game/Library` vốn không nằm trong git). Hai agent cùng sửa một file sẽ ghi đè nhau. Vì vậy mỗi file chỉ có một chủ trong một lượt chạy.

## Quy trình

### Bước 0: Nắm bối cảnh

- Nếu chưa có trong ngữ cảnh, đọc mục lục `Docs/00-Codebase-Map.md` rồi chỉ mở file `Docs/map/<mảng>/<chủ đề>.md` liên quan (không đọc cả thư mục; `logic/` và `unity/` cho code, `art/` cho sprite, `ops/` cho build, bẫy và công thức sửa).
- Đọc đúng hàm hoặc đoạn liên quan trong source để kế hoạch dựa trên code thật, không đoán.

### Bước 1: Phân loại quy mô (để không tốn công vô ích)

- **Nhỏ**: một mảng, vài dòng (đổi một hằng số, sửa một chuỗi text, chỉnh màu). → **Tự làm trực tiếp**, không spawn agent, sau đó chỉ cần chạy kiểm tra nhanh (bước 4a) và báo cáo. Spawn agent cho việc nhỏ chỉ thêm chi phí và chậm hơn.
- **Vừa**: 2–3 mảng hoặc một mảng nhưng nhiều file. → Lập kế hoạch, giao agent, chạy luôn không cần hỏi.
- **Lớn**: tính năng mới, đổi luật lớn, chiến trường mới, lên phiên bản. → Trình bày kế hoạch ngắn (mảng nào làm gì, có build hay không) và chờ người dùng đồng ý trước khi giao việc.

Nếu yêu cầu mơ hồ ở điểm ảnh hưởng thiết kế (ví dụ "làm khó hơn" nhưng không rõ khó ở đâu), hỏi một câu ngắn có gợi ý, thay vì đoán rồi bắt cả đội làm lại.

### Bước 2: Viết hợp đồng (contract)

Đây là phần quan trọng nhất. Các agent chạy song song không nhìn thấy nhau, nên mọi thứ chúng cần thống nhất phải được bạn chốt trước, bằng tên và giá trị cụ thể:

- Field / thuộc tính / enum mới mà `ww-rules` thêm và `ww-view` sẽ đọc (tên chính xác, kiểu, ý nghĩa, đơn vị).
- `FlightEventKind` mới: tên, khi nào phát, `Value`/`EntityId` mang gì; `ww-view` xử lý trong `DrainEvents`.
- Sprite mới: tên, group, số khung, kích thước, fps, loop. `ww-pixel` vẽ, `ww-view` dùng `PixelSprites.At/Get`.
- **Hằng số phải đồng bộ JS ↔ C#** (`Docs/map/ops/sync-constants.md`): tọa độ `COCKPIT` (`ui/cockpit.cjs` ↔ `FlightView` ×2, gốc `CockpitTop = 652`), đường/sông (`terrain/*.cjs` ↔ `Wildlife.cs`), đường băng (`runway.cjs` ↔ `FlightView`), số khung `bomber_guns` (↔ `FlightBoardView.GunDeployFrames`), số khung `gauge_needle`, version. Ghi rõ con số cho **cả hai** agent.
- Text tiếng Việt hiển thị trong game (người dùng sẽ thấy, nên chốt một lần).
- Check mới cần thêm: RulesChecks (`ww-rules`) hay smoke `FlightGame.Smoke.*.cs` (`ww-view`), và ảnh smoke mới (tên file).

Nếu một thay đổi cần sửa file thuộc mảng khác (ví dụ luật mới cần một dòng trong `FlightGame.DrainEvents`), giao phần đó cho chủ file thay vì để agent kia "tiện tay" sửa.

### Bước 3: Giao việc

- Gọi `Agent` với `subagent_type` là tên agent (`ww-rules`, `ww-view`, `ww-pixel`, `ww-vocab`). Các agent **độc lập về file** thì gọi **trong cùng một lượt** để chạy song song.
- Thường mọi implementer có thể chạy song song ngay vì đã có hợp đồng. Chỉ tách thành hai đợt khi một bên thật sự cần đầu ra của bên kia (ví dụ `ww-view` cần đo kích thước sprite mà `ww-pixel` mới sinh); khi đó cho đợt sau chạy sau khi đợt trước báo xong.
- Mỗi prompt giao việc (agent khởi động không có ngữ cảnh hội thoại, nên prompt phải tự đủ):
  1. Yêu cầu gốc của người dùng (nguyên văn) và mục tiêu của phần việc này.
  2. Phần hợp đồng liên quan, nguyên văn.
  3. Danh sách file được phép sửa (và nhắc không sửa file ngoài danh sách; nếu cần thì ghi vào báo cáo).
  4. Điều kiện xong: ví dụ "RulesChecks pass", "forge chạy không lỗi", "biên dịch được theo hợp đồng".
  5. Yêu cầu báo cáo theo mẫu: file đã sửa, tóm tắt thay đổi, giả định đã đặt, việc cần mảng khác làm, kết quả kiểm tra đã chạy.
- Có thể nhắc người dùng một dòng: đang giao cho những agent nào.

### Bước 4: Kiểm chứng

Sau khi các implementer báo xong, giao cho `ww-verify`:

- **4a. Kiểm tra nhanh** (luôn chạy): forge (nếu `ww-pixel` có sửa) → `dotnet build Tools/UnityCompileChecks` (yêu cầu 0 lỗi, 0 cảnh báo) → `cd Tools/RulesChecks && dotnet run`.
- **4b. Build + smoke** (khoảng 10 + 1 phút): chạy khi thay đổi ảnh hưởng runtime Unity (view, UI, sprite, âm thanh, luồng game) hoặc khi lên phiên bản. Bỏ qua nếu chỉ đổi luật thuần đã có RulesChecks phủ, hoặc người dùng bảo bỏ qua. Cho `ww-verify` biết những ảnh smoke nào cần soát kỹ (ví dụ `02b-cockpit-typing` khi sửa cockpit).
- Chỉ chạy **một** `ww-verify` mỗi lúc: build dùng chung `Tools/BuildWorkspace` và exe.

**Vòng sửa lỗi**: `ww-verify` trả về lỗi kèm file:dòng. Chuyển lỗi cho đúng chủ file — ưu tiên `SendMessage` tới agent đã làm phần đó (nó vẫn giữ ngữ cảnh), nếu không được thì spawn lại với mô tả lỗi. Rồi kiểm tra lại. Sau khoảng 3 vòng vẫn lỗi thì dừng và báo người dùng kèm chẩn đoán, đừng lặp mãi.

### Bước 5: Tự soát và tài liệu

- Xem `git diff --stat` và lướt diff: có file nào ngoài phạm vi bị sửa không, hằng số JS/C# có khớp nhau không, text có đúng tiếng Việt không.
- Thay đổi lớn hoặc lên phiên bản (theo `CLAUDE.md`): bạn tự cập nhật `Docs/00-Codebase-Map.md`, thêm `Docs/history/NN-*.md` (số tiếp theo) và đoạn đầu `README.md`. Làm việc này ở cuối để tài liệu khớp code đã qua kiểm tra.

### Bước 6: Báo cáo cho người dùng

Ngắn gọn, tiếng Việt:

```
## Đã làm
- <thay đổi người chơi cảm nhận được>, kèm file chính (`path:line`)

## Ai làm gì
- ww-rules: …  · ww-view: …  · ww-pixel: …  (chỉ liệt kê agent đã dùng)

## Kiểm tra
- Compile: 0 lỗi / 0 cảnh báo · RulesChecks: N checks PASS · Smoke: x/y PASS (hoặc: chưa chạy, vì …)
- Ảnh đã soát: …

## Cần bạn quyết định / lưu ý
- … (nếu không có thì bỏ mục này)
```

Báo đúng sự thật: check nào fail thì nói fail kèm output; bước nào bỏ qua thì nói bỏ qua và lý do.

## Chế độ "chỉ lập kế hoạch"

Nếu người dùng nói "lên kế hoạch", "xem trước", "chưa làm", hoặc muốn biết sẽ chia việc ra sao: dừng sau Bước 2, trình bày kế hoạch + hợp đồng, không spawn agent, không sửa file.

## Ví dụ phân việc

**"Thêm máy bay địch loại mới ở Sa mạc, bay zigzag, bắn 5 viên"**
→ Lớn. `ww-rules`: thêm loại địch, quỹ đạo, loạt 5 viên + RulesChecks. `ww-pixel`: sprite `bomber_desert_raider` (+ bank, damaged). `ww-view`: vẽ loại mới, smoke check + ảnh. Hợp đồng chốt tên enum/field, tên sprite và số khung. Có build + smoke.

**"Đổi thời gian khóa mục tiêu từ 4,5 xuống 4 giây"**
→ Nhỏ, tự làm: `AircraftLockSeconds` trong `ContinuousFlight.cs` + kỳ vọng trong `Tools/RulesChecks/Combat/`, chạy RulesChecks. Lưu ý `bomber_guns` chạy theo `LockProgress` nên không cần sửa ảnh.

**"Thêm nút tắt nhạc nền vào cockpit"**
→ Vừa. `ww-pixel`: sửa `cockpit_panel` + `COCKPIT` trong `ui/cockpit.cjs`. `ww-view`: nút trong `FlightView` theo đúng tọa độ ×2 trong hợp đồng, logic trong `FlightAudio`. Build + smoke, soát `02b-cockpit-typing`.

**"Sửa nghĩa tiếng Việt của từ 'bank' cho rõ hơn"**
→ Nhỏ hoặc vừa: `ww-vocab` (sửa `curated-overrides.tsv`, chạy `Build-Oxford-Vocabulary.cjs`), rồi RulesChecks kiểm tra dữ liệu. Không cần build nếu người dùng không muốn.

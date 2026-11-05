# Công thức sửa thường gặp

| Việc | Các bước |
| --- | --- |
| Đổi luật hoặc thời gian đòn đánh | Sửa hằng trong `ContinuousFlight.cs` hoặc nhánh trong `Advance<Loại>` của file partial tương ứng (`logic/flight-lifecycle.md`) → cập nhật `Tools/RulesChecks/Combat/` → nếu ảnh hưởng hình, kiểm tra `FlightBoardView` (vd. `LockProgress` điều khiển súng) → smoke |
| Thêm sự kiện gameplay | `logic/flight-state.md` (cuối file) |
| Thêm chiến trường hoặc actor | `unity/rendering.md` (cuối file) |
| Thêm sprite, model, NPC; sửa cockpit | `art/add-sprites.md` |
| Thêm bản đồ căn cứ mới | `logic/world.md` (mục Mở rộng) |
| Sửa hoạt cảnh cất cánh | Ảnh trong `runway.cjs` / `ui/title.cjs` (`title_airbase`); thời gian ở hằng của `FlightView` (`unity/takeoff-intro.md`); kiểm tra ảnh `01c`…`01e` |
| Đổi dữ liệu từ | `data/vocabulary-pipeline.md` (cuối file) |
| Thêm chế độ chơi / mảng mới | Logic thuần vào `Scripts/Logic/<Mảng>/` (tự vào RulesChecks), view vào `Scripts/Unity/<Mảng>/`; thêm `Docs/map/logic/<mảng>.md` + `Docs/map/unity/<mảng>.md` và một dòng ở mục lục |
| Lên phiên bản | Đổi version ở `forge.cjs`, `PrototypeBuild.cs`, Verification (`smoke-report`), `WorldChecks`; thêm `Docs/history/NN-*.md`, đoạn đầu README, cập nhật `history.md` |

**Giữ tài liệu nhỏ:** mỗi file trong `Docs/map/` một chủ đề, nên dưới khoảng 5 KB. File phình to thì tách theo chủ đề con và thêm dòng vào `Docs/00-Codebase-Map.md`.

# Hoạt cảnh cất cánh và vào trận

Code: `Scripts/Unity/Flight/FlightView/FlightView.TakeOff.cs` (`BeginTakeOff`, `AnimateTakeOff`, `BeginIntro`, `AnimateIntro`, `FinishIntro`). Ảnh: `runway.cjs`, `ui/title.cjs` (`title_airbase`). Kiểm tra bằng ảnh smoke `01c`…`01e`, `02a`.

## Cất cánh (cutscene sau khi lên máy bay ở căn cứ)

- `BeginTakeOff()` dựng cảnh `title_airbase` + runway + mây + máy bay + tag, mở dần từ màn đen trong 0,45 giây. `AnimateTakeOff(dt) → bool`.
- **Hằng số:** `TakeOffSeconds 5.7`, `EngineStartSeconds 1.3`, `RollAcceleration 260`, `FollowAfter 160`, `FollowSeconds 3.6`, `TileHeight 960`.
- **Container `hangarWorld`:** sân bay ở y = 0, `title_runway_edge` ở y = −960, trên đó 3 ô `title_runway_jungle` nối tiếp.
- `launchScroll` là vị trí camera: máy bay lăn, camera bám theo khi máy bay đi được 160 px.
- **Diễn biến:** khói xả sinh trong world space nên ở lại phía sau; nhấc bánh trong 3,7–5,0 giây (máy bay to dần, bóng tách xa); curtain tối dần từ giây 4,7.

## Vào trận

`BeginIntro`, `AnimateIntro(t)`, `FinishIntro`: curtain mở, máy bay bay lên từ mép dưới (`Board.IntroLift`), nền mờ dần (`Focus`), header và cockpit fade 0→1. Thời gian do `FlightGame.IntroSeconds` (1,4 giây) điều khiển, cộng `min(dt, 1/30)`.

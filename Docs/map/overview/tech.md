# Công nghệ và quy ước cốt lõi

| Mục | Giá trị |
| --- | --- |
| Engine | Unity **6000.6.7f1**, URP 2D (URP 17.6.0) |
| Input | Input System **1.20.1**. Khe gõ không dùng InputField thật; ký tự đến từ `Keyboard.onTextInput` |
| UI | uGUI legacy `Text` (ugui 2.6.0). **Toàn bộ UI dựng bằng code** (`UiKit`, `FlightView`), không có prefab UI |
| Canvas | CanvasScaler, tham chiếu **1440×900**, chế độ Expand |
| Sân chơi | 1360×548 px tại (40,103), RectMask2D. Tọa độ logic chuẩn hóa 0..1 (`X` theo bề rộng, `Y` từ trên xuống, `PlayerY = .92`) |
| Font | VT323 (`Art/Resources/Fonts/VT323-Regular.ttf`), `UiKit.FontScale = 1.3`, quy đổi bằng `UiKit.Px()` |
| Scene | Chỉ có `Game/Assets/_Project/Scenes/Flight.unity`. `FlightGame` là MonoBehaviour điều phối duy nhất |
| Sprite | PNG từng khung do **PixelForge** (Node.js) sinh, nạp bằng `Resources` + `Sprite.Create`, lọc point (tên kết thúc `_blur` lọc bilinear) |
| Dữ liệu | `Resources/oxford-vocabulary.json` (5,5 MB, 5.981 mục), đọc bằng `JsonUtility` |
| Lưu | `Application.persistentDataPath/pilot-profile.json`. Smoke test dùng `qa-profile.json` |

## Kiến trúc: tách Logic và Unity

- `Scripts/Logic/` = **assembly riêng `Wordwing.Logic`** (`Wordwing.Logic.asmdef`, `noEngineReferences: true`). Luật chơi, bộ đếm thời gian, xác suất, căn cứ, hội thoại, nhiệm vụ, lọc từ. Lỡ `using UnityEngine` ở đây thì Unity báo lỗi biên dịch ngay.
- `Scripts/Unity/` = Assembly-CSharp (tự tham chiếu Logic). View chỉ **đọc state** để vẽ và nhận sự kiện qua `PopEvent()` (`FlightEvent`, `WorldEvent`).
- `Tools/RulesChecks` biên dịch **toàn bộ** `Scripts/Logic/**/*.cs` (glob) và test bằng `dotnet run`. File logic mới tự được đưa vào, không phải khai báo.
- Logic không được dùng member `internal` của phía Unity và ngược lại (hai assembly khác nhau). `UnityCompileChecks` biên dịch tách hai assembly để bắt lỗi này.

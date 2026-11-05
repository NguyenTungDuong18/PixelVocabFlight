# FlightProgress và GameRules: tài nguyên, điểm, so khớp

## `Scripts/Logic/Flight/FlightProgress.cs`

- **Trạng thái:** `Score, Fuel (0..100), Metal/Health (0..5), Streak, Correct, WrongAttempts, Missed, ActiveSeconds, PowerSeconds, Powered, IsOver`.
- `Tick(dt)`: tăng giờ bay, hao xăng .12/s (một nửa khi Powered), giảm PowerSeconds, hết xăng thì IsOver.
- `ResolveCorrect(word, answerSeconds, window)` → điểm (`GameRules.ScoreFor` × combo × 1,5 nếu Powered), Streak++.
- `ResolveBlastKill()` → +25.
- `Wrong()`: Streak = 0, không trừ giáp.
- `CollectMetal()`: giáp chưa đầy thì +1. Đếm 5 mảnh thì bật Power 12 giây.
- `Damage(n)` → số giáp mất; về 0 thì IsOver. `CollectFuel(n)` kẹp ở 100. `Miss()` = Damage(1) và Missed++.

## `Scripts/Logic/Flight/GameRules.cs`

- `SpeedMultiplier(sec)` = 1 + 0,1 mỗi phút tròn, tối đa 1,5.
- `Normalize(s)`: trim, lowercase, gộp khoảng trắng.
- `Matches(answer, entry)`: khớp chính xác `word` hoặc `acceptedSpellings`, không chấp nhận sai chính tả.
- `ComboMultiplier(streak)`: +0,25 mỗi 5 câu đúng liên tiếp, tối đa ×2.
- `ScoreFor(word, seconds, window, streak, powered)`: (100 + 5·số chữ cái + thưởng tốc độ tới 50) × combo × (1,5 nếu cường hóa). Ví dụ "apple" trả lời ngay = 175.

Test: `Tools/RulesChecks/Program.cs`.

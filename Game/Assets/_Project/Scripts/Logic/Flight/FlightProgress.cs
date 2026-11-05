using System;

namespace PixelVocabFlight
{
    // Pure gameplay state: Unity only advances this while a flight is running.
    public sealed class FlightProgress
    {
        public double ActiveSeconds { get; private set; }
        public float Fuel { get; private set; } = 100;
        public const int MaximumMetal = 5;
        public int Health => Metal;
        public int Score { get; private set; }
        public int Correct { get; private set; }
        public int BlastKills { get; private set; }
        public int WrongAttempts { get; private set; }
        public int Missed { get; private set; }
        public int Streak { get; private set; }
        public int Metal { get; private set; } = MaximumMetal;
        public int UpgradePickups { get; private set; }
        public float PowerSeconds { get; private set; }
        public bool IsOver => Health <= 0 || Fuel <= 0;
        public bool Powered => PowerSeconds > 0;

        public void Tick(float delta)
        {
            if (IsOver || delta <= 0 || float.IsNaN(delta) || float.IsInfinity(delta)) return;
            ActiveSeconds += delta;
            float boostedPart = Math.Min(delta, PowerSeconds);
            Fuel = Math.Max(0, Fuel - (delta - boostedPart * 0.5f) * 0.12f);
            PowerSeconds = Math.Max(0, PowerSeconds - delta);
        }

        public void Wrong()
        {
            if (IsOver) return;
            WrongAttempts++;
            Streak = 0;
        }

        public int ResolveCorrect(string word, double responseSeconds, double budget)
        {
            if (IsOver) return 0;
            int earned = GameRules.ScoreFor(word, responseSeconds, budget, Streak, Powered);
            Score += earned;
            Correct++;
            Streak++;
            return earned;
        }

        public int ResolveBlastKill()
        {
            if (IsOver) return 0;
            BlastKills++;
            Score += 25;
            return 25;
        }

        public void CollectMetal()
        {
            if (IsOver) return;
            Metal = Math.Min(MaximumMetal, Metal + 1);
            UpgradePickups++;
            if (UpgradePickups >= 5)
            {
                UpgradePickups = 0;
                PowerSeconds = Math.Min(24, PowerSeconds + 12);
            }
        }

        public int Damage(int amount)
        {
            if (IsOver || amount <= 0) return 0;
            int lost = Math.Min(Metal, amount);
            Metal -= lost;
            Streak = 0;
            return lost;
        }

        public void CollectFuel(float amount)
        {
            if (!IsOver) Fuel = Math.Min(100, Fuel + Math.Max(0, amount));
        }

        public void Miss()
        {
            if (IsOver) return;
            Damage(1);
            Missed++;
            Streak = 0;
        }
    }
}

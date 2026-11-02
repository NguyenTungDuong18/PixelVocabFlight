using System;

namespace PixelVocabFlight
{
    // Pure gameplay state: Unity only advances this while a flight is running.
    public sealed class FlightProgress
    {
        public double ActiveSeconds { get; private set; }
        public float Fuel { get; private set; } = 100;
        public int Health { get; private set; } = 3;
        public int Score { get; private set; }
        public int Correct { get; private set; }
        public int WrongAttempts { get; private set; }
        public int Missed { get; private set; }
        public int Streak { get; private set; }
        public int Metal { get; private set; }
        public float PowerSeconds { get; private set; }
        public bool IsOver => Health <= 0 || Fuel <= 0;
        public bool Powered => PowerSeconds > 0;

        public void Tick(float delta)
        {
            if (IsOver || delta <= 0) return;
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

        public void CollectMetal()
        {
            if (IsOver) return;
            Metal++;
            if (Metal >= 5)
            {
                Metal -= 5;
                PowerSeconds = Math.Min(24, PowerSeconds + 12);
            }
        }

        public void Lose() { Health = 0; Streak = 0; }

        public void CollectFuel(float amount)
        {
            if (!IsOver) Fuel = Math.Min(100, Fuel + Math.Max(0, amount));
        }

        public void Miss()
        {
            if (IsOver) return;
            Health = Math.Max(0, Health - 1);
            Missed++;
            Streak = 0;
        }
    }
}

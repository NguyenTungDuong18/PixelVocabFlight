using System;
using System.Linq;

namespace PixelVocabFlight
{
    public static class GameRules
    {
        public static float SpeedMultiplier(double activeSeconds)
            => 1f + 0.1f * Math.Min((int)(Math.Max(0, activeSeconds) / 60), 5);

        public static string Normalize(string answer)
            => (answer ?? string.Empty).Trim().ToLowerInvariant();

        public static bool Matches(string answer, VocabularyEntry entry)
        {
            string normalized = Normalize(answer);
            return normalized.Length > 0 && (normalized == Normalize(entry.word) ||
                (entry.acceptedSpellings != null && entry.acceptedSpellings.Any(s => Normalize(s) == normalized)));
        }

        public static float ComboMultiplier(int streak) => 1f + Math.Min(Math.Max(streak, 0) / 5, 4) * 0.25f;

        public static int ScoreFor(string word, double responseSeconds, double budget, int streak, bool powered)
        {
            int letters = word.Count(char.IsLetter);
            double fraction = Math.Max(0, Math.Min(1, 1 - responseSeconds / Math.Max(0.01, budget)));
            int bonus = (int)Math.Round(50 * fraction, MidpointRounding.AwayFromZero);
            return (int)Math.Floor((100 + 5 * letters + bonus) * ComboMultiplier(streak) * (powered ? 1.5 : 1));
        }
    }
}

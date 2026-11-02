using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed class QuestionDeck
    {
        private readonly VocabularyEntry[] entries;
        private readonly Random random;
        private readonly Queue<VocabularyEntry> bag = new Queue<VocabularyEntry>();
        private string previousWord;

        public QuestionDeck(VocabularyEntry[] entries, int seed)
        {
            string error = ValidatePool(entries);
            if (error != null) throw new ArgumentException(error);
            this.entries = entries;
            random = new Random(seed);
        }

        public static bool DistinctAnswers(VocabularyEntry a, VocabularyEntry b)
        {
            if (GameRules.Normalize(a.word) == GameRules.Normalize(b.word) || GameRules.Normalize(a.meaning) == GameRules.Normalize(b.meaning)) return false;
            if (GameRules.Matches(a.word,b) || GameRules.Matches(b.word,a)) return false;
            return a.ambiguityKeys == null || b.ambiguityKeys == null || !a.ambiguityKeys.Intersect(b.ambiguityKeys).Any();
        }

        public static string ValidatePool(VocabularyEntry[] pool)
        {
            if (pool == null || pool.Select(e => GameRules.Normalize(e.word)).Distinct().Count() < 3)
                return "Cần ít nhất 3 từ khác cách viết. Hãy mở rộng khoảng từ hoặc bộ lọc.";
            foreach (var target in pool)
            {
                bool enough = false;
                var candidates = new List<VocabularyEntry>();
                foreach (var candidate in pool)
                {
                    if (!DistinctAnswers(target,candidate)) continue;
                    if (candidates.Any(first=>DistinctAnswers(first,candidate))) { enough = true; break; }
                    candidates.Add(candidate);
                }
                if (!enough) return "Khoảng từ có các đáp án trùng hoặc gần nghĩa. Hãy chọn thêm từ để có ba đáp án phân biệt.";
            }
            return null;
        }

        public VocabularyEntry[] Next(out int targetIndex)
        {
            if (bag.Count == 0)
            {
                var shuffled = entries.OrderBy(_ => random.Next()).ToList();
                if (shuffled[0].word == previousWord)
                {
                    int different = shuffled.FindIndex(e => e.word != previousWord);
                    var swap = shuffled[0]; shuffled[0] = shuffled[different]; shuffled[different] = swap;
                }
                foreach (var entry in shuffled) bag.Enqueue(entry);
            }
            var target = bag.Dequeue();
            previousWord = target.word;
            var shuffledOptions = entries.Where(e => DistinctAnswers(target,e)).OrderBy(_ => random.Next()).ToArray();
            VocabularyEntry first = null, second = null;
            foreach (var a in shuffledOptions)
            {
                second = shuffledOptions.FirstOrDefault(b => DistinctAnswers(a,b));
                if (second != null) { first = a; break; }
            }
            if (second == null) throw new InvalidOperationException("Không đủ đáp án phân biệt.");
            targetIndex = random.Next(3);
            var options = new List<VocabularyEntry> {first,second};
            options.Insert(targetIndex,target);
            return options.ToArray();
        }
    }
}

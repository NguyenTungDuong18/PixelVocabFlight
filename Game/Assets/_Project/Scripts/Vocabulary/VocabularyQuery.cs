using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace PixelVocabFlight
{
    [Serializable]
    public sealed class VocabularyFilter
    {
        public string collection = "oxford5000";
        public int minimumLevel;
        public int maximumLevel = 4;
        public string[] topics = Array.Empty<string>();
        public string search = "";
        public int from = 1;
        public int to = int.MaxValue;
    }

    public static class VocabularyQuery
    {
        public static readonly string[] Levels = { "A1", "A2", "B1", "B2", "C1" };

        public static VocabularyEntry[] Filter(IEnumerable<VocabularyEntry> entries, VocabularyFilter filter)
        {
            return entries.Where(e => e.playable && (filter.collection != "oxford3000" || e.oxford3000))
                .Where(e => Array.IndexOf(Levels, e.cefr) >= filter.minimumLevel && Array.IndexOf(Levels, e.cefr) <= filter.maximumLevel)
                .Where(e => filter.topics == null || filter.topics.Length == 0 ||
                    (e.topics != null && filter.topics.Any(t => e.topics.Contains(t))))
                .Where(e => string.IsNullOrWhiteSpace(filter.search) ||
                    e.word.IndexOf(filter.search.Trim(), StringComparison.OrdinalIgnoreCase) >= 0 ||
                    e.meaning.IndexOf(filter.search.Trim(), StringComparison.OrdinalIgnoreCase) >= 0)
                .OrderBy(e => e.order).ToArray();
        }

        public static VocabularyEntry[] Range(VocabularyEntry[] filtered, int from, int to)
        {
            if (from < 1 || to < from || to > filtered.Length)
                throw new ArgumentException("Khoảng phải nằm trong 1–" + filtered.Length + " và số đầu không lớn hơn số cuối.");
            return filtered.Skip(from - 1).Take(to - from + 1).ToArray();
        }

        public static string SelectionKey(VocabularyEntry[] selected)
        {
            using (var sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(string.Join("\n", selected.Select(e => e.id).OrderBy(id => id, StringComparer.Ordinal))));
                return "oxford-v1:" + BitConverter.ToString(hash, 0, 12).Replace("-", "").ToLowerInvariant();
            }
        }
    }
}

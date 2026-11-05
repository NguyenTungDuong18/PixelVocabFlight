using System;
using System.Linq;
using UnityEngine;

namespace PixelVocabFlight
{
    public sealed class VocabularyCatalog
    {
        public VocabularyEntry[] Entries { get; }
        public VocabularyTopic[] Topics { get; }
        public string Version { get; }

        public VocabularyCatalog()
        {
            TextAsset json = Resources.Load<TextAsset>("oxford-vocabulary");
            if (!json) throw new InvalidOperationException("Không tìm thấy danh mục từ vựng Oxford.");
            VocabularyFile file = JsonUtility.FromJson<VocabularyFile>(json.text);
            Entries = file.entries ?? Array.Empty<VocabularyEntry>();
            Topics = file.topics ?? Array.Empty<VocabularyTopic>();
            Version = file.version;
            if (Entries.Length < 3 || Entries.Any(e => string.IsNullOrWhiteSpace(e.id) || string.IsNullOrWhiteSpace(e.word) || string.IsNullOrWhiteSpace(e.meaning)))
                throw new InvalidOperationException("Bộ từ vựng thiếu dữ liệu.");
            if (Entries.Select(e => e.id).Distinct().Count() != Entries.Length)
                throw new InvalidOperationException("Bộ từ có mã mục trùng.");
        }

        public VocabularyEntry[] Filter(VocabularyFilter filter) => VocabularyQuery.Filter(Entries, filter);
        public string TopicName(string id) => Topics.FirstOrDefault(t => t.id == id)?.name ?? id;
    }
}

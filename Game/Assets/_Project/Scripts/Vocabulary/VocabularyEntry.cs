using System;

namespace PixelVocabFlight
{
    [Serializable]
    public sealed class VocabularyEntry
    {
        public string id;
        public string word;
        public string meaning;
        public string partOfSpeech;
        public string topic;
        public string[] acceptedSpellings;
        public int order;
        public string pos;
        public string cefr;
        public bool oxford3000;
        public string[] topics;
        public string sourceUrl;
        public string audioKey;
        public string meaningSource;
        public string meaningReview;
        public string dictionaryId;
        public string[] allMeanings;
        public string[] ambiguityKeys;
        public bool playable;
    }

    [Serializable]
    public sealed class VocabularyFile
    {
        public string source;
        public string version;
        public VocabularyTopic[] topics;
        public VocabularyEntry[] entries;
    }

    [Serializable]
    public sealed class VocabularyTopic
    {
        public string id;
        public string name;
    }
}

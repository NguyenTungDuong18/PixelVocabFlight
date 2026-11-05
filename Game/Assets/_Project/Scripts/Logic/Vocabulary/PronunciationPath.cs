namespace PixelVocabFlight
{
    // Pronunciation WAVs live in Resources/Pronunciation/<first letter of the word>/<audioKey>.wav ("_" when not a–z),
    // so no folder holds thousands of files. Tools/Vocabulary/Generate-Pronunciation.ps1 must use the same rule.
    public static class PronunciationPath
    {
        public static string Key(VocabularyEntry entry) => string.IsNullOrEmpty(entry.audioKey) ? entry.word : entry.audioKey;

        public static string Folder(string word)
        {
            char c = string.IsNullOrEmpty(word) ? '_' : char.ToLowerInvariant(word[0]);
            return c >= 'a' && c <= 'z' ? c.ToString() : "_";
        }

        // Path under Resources/Pronunciation, without extension.
        public static string Resource(VocabularyEntry entry) => Folder(entry.word) + "/" + Key(entry);
    }
}

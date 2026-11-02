using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace PixelVocabFlight
{
    [Serializable]
    public sealed class WordRecord
    {
        public string id;
        public int correct;
        public int firstTry;
        public int missed;
    }

    [Serializable]
    public sealed class BestRecord
    {
        public string key;
        public int score;
    }

    [Serializable]
    public sealed class PilotProfile
    {
        public int version = 1;
        public VocabularyFilter selection = new VocabularyFilter();
        public int fullLibraryVersion;
        public int startingEnvironment;
        public VocabularyFilter selectionBeforeFullLibrary;
        public List<BestRecord> bests = new List<BestRecord>();
        public List<WordRecord> words = new List<WordRecord>();
    }

    public sealed class ProfileStore
    {
        private readonly string path;
        public PilotProfile Profile { get; private set; }

        public ProfileStore(bool isolated = false)
        {
            path = Path.Combine(Application.persistentDataPath, isolated ? "qa-profile.json" : "pilot-profile.json");
            Profile = Read(path) ?? Read(path + ".bak") ?? new PilotProfile();
        }

        private static PilotProfile Read(string file)
        {
            try
            {
                if (!File.Exists(file)) return null;
                var profile = JsonUtility.FromJson<PilotProfile>(File.ReadAllText(file));
                return profile != null && profile.version == 1 && profile.bests != null && profile.words != null ? profile : null;
            }
            catch (Exception exception) when (exception is IOException || exception is ArgumentException)
            {
                Debug.LogWarning("Không đọc được tiến độ: " + exception.Message);
                return null;
            }
        }

        public int Best(string key) => Profile.bests.Find(r => r.key == key)?.score ?? 0;

        public void Record(VocabularyEntry entry, bool correct, bool firstTry, string key, int score)
        {
            var word = Profile.words.Find(w => w.id == entry.id);
            if (word == null) { word = new WordRecord { id = entry.id }; Profile.words.Add(word); }
            if (correct) { word.correct++; if (firstTry) word.firstTry++; }
            else word.missed++;
            var best = Profile.bests.Find(r => r.key == key);
            if (best == null) { best = new BestRecord { key = key }; Profile.bests.Add(best); }
            best.score = Math.Max(best.score, score);
            Save();
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path + ".tmp", JsonUtility.ToJson(Profile, true));
                if (File.Exists(path)) File.Replace(path + ".tmp", path, path + ".bak");
                else File.Move(path + ".tmp", path);
            }
            catch (Exception exception) when (exception is IOException || exception is UnauthorizedAccessException)
            {
                Debug.LogWarning("Không ghi được tiến độ: " + exception.Message);
            }
        }
    }
}

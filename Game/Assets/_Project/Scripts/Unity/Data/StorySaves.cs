using System;
using System.IO;
using UnityEngine;

namespace PixelVocabFlight
{
    // One save slot: where the story restarts (the first beat of the segment) with the flags, the play time and when it was
    // saved. Stored as story-save-1.json ... story-save-3.json. A broken file counts as an empty slot.
    [Serializable]
    public sealed class StorySaveData
    {
        public int version = 1;
        public string beatId;
        public string[] flagNames = new string[0];
        public int[] flagValues = new int[0];
        public float playSeconds;
        public string savedAt;      // "yyyy-MM-dd HH:mm" local time, for display
        public long savedTicks;     // UTC ticks, to find the newest slot

        public static StorySaveData From(StorySnapshot snapshot, float playSeconds)
        {
            var data = new StorySaveData { beatId = snapshot.BeatId, playSeconds = playSeconds, savedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm"), savedTicks = DateTime.UtcNow.Ticks };
            data.flagNames = new string[snapshot.Flags.Count]; data.flagValues = new int[snapshot.Flags.Count];
            int i = 0;
            foreach (var pair in snapshot.Flags) { data.flagNames[i] = pair.Key; data.flagValues[i++] = pair.Value; }
            return data;
        }

        public StorySnapshot ToSnapshot()
        {
            var snapshot = new StorySnapshot { BeatId = beatId };
            int n = Math.Min(flagNames?.Length ?? 0, flagValues?.Length ?? 0);
            for (int i = 0; i < n; i++) snapshot.Flags[flagNames[i]] = flagValues[i];
            return snapshot;
        }

        // The segment the save starts in (null when the beat is unknown: the file is then treated as broken).
        public StorySegment Segment { get { foreach (var s in Act0Content.Segments) if (s.FirstBeatId == beatId) return s; return null; } }

        public string PlayTimeText
        {
            get { int t = Mathf.Max(0, Mathf.FloorToInt(playSeconds)); return (t / 3600) + ":" + (t / 60 % 60).ToString("00") + ":" + (t % 60).ToString("00"); }
        }
    }

    public sealed class StorySaves
    {
        public const int Slots = 3;
        private readonly string folder;

        public StorySaves(string folder) { this.folder = folder; }

        public string PathOf(int slot) => Path.Combine(folder, "story-save-" + (slot + 1) + ".json");

        public StorySaveData Load(int slot)
        {
            try
            {
                string path = PathOf(slot);
                if (slot < 0 || slot >= Slots || !File.Exists(path)) return null;
                var data = JsonUtility.FromJson<StorySaveData>(File.ReadAllText(path));
                return data != null && data.Segment != null ? data : null;
            }
            catch (Exception exception) { Debug.LogWarning("Hồ sơ " + (slot + 1) + " hỏng, coi như trống: " + exception.Message); return null; }
        }

        public void Save(int slot, StorySaveData data)
        {
            if (slot < 0 || slot >= Slots || data == null) return;
            try { Directory.CreateDirectory(folder); File.WriteAllText(PathOf(slot), JsonUtility.ToJson(data, true)); }
            catch (Exception exception) { Debug.LogWarning("Không lưu được hồ sơ " + (slot + 1) + ": " + exception.Message); }
        }

        public void Delete(int slot)
        {
            try { if (slot >= 0 && slot < Slots && File.Exists(PathOf(slot))) File.Delete(PathOf(slot)); }
            catch (Exception exception) { Debug.LogWarning("Không xóa được hồ sơ " + (slot + 1) + ": " + exception.Message); }
        }

        public bool Any { get { for (int i = 0; i < Slots; i++) if (Load(i) != null) return true; return false; } }

        // Slot with the newest save time, -1 when none.
        public int Latest()
        {
            int best = -1; long ticks = long.MinValue;
            for (int i = 0; i < Slots; i++)
            {
                var data = Load(i);
                if (data != null && data.savedTicks >= ticks) { best = i; ticks = data.savedTicks; }
            }
            return best;
        }
    }
}

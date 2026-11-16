using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Act 0 (wave 1): the opening scene (7 frames) and M1 part 1 "Đêm 9/5, phòng nội trú" (16 frames) plus an end card.
    // Source: the story tables "Hồi 0 - Cảnh mở" and "Hồi 0 - M1 - Buổi bay cuối" (spoken lines copied verbatim).
    // Data lives in the Act0Content.*.cs partial files: Opening (beats), M1Beats (beats), M1Part1 / M1Part2 (dialogues).
    public static partial class Act0Content
    {
        public const string EndCardText = "Hết phần dựng thử: Cảnh mở và M1 Phần 1.\nPhần tiếp theo của Hồi 0 đang được dựng.";
        // Character id of the walking pilot in story maps (sprites chr_pilot_young_*, portrait_pilot_young).
        public const string PlayerCharacter = "pilot_young";
        public const string DormMapId = DormRoomMap.Id;

        // Speaker ids used by DialogueNode.Speaker. Narrator "" = a line without name or portrait (narration, text on an object).
        private const string J = "jonas", D = "daan", N = "";

        private static IReadOnlyList<StoryBeat> script;
        private static IReadOnlyDictionary<string, DialogueGraph> dialogues;

        // 23 beats + the End beat, in play order. Shared, treat as read-only.
        public static IReadOnlyList<StoryBeat> Script => script ?? (script = BuildScript());

        // The segments the player can start from, in script order. Every one plays when jumped into (nothing but flags carries over).
        public static IReadOnlyList<StorySegment> Segments { get; } = new[]
        {
            new StorySegment { Id = "open", Number = "0.1", Title = "Cảnh mở", FirstBeatId = "open.P1.01" },
            new StorySegment { Id = "m1_dorm", Number = "0.2", Title = "M1 · Đêm 9/5 · Phòng nội trú", FirstBeatId = "m1.P1.01" },
            new StorySegment { Id = "m1_roof", Number = "0.3", Title = "M1 · Đêm 9/5 · Trên mái nhà", FirstBeatId = "m1.P1.13" },
        };

        public static IReadOnlyDictionary<string, DialogueGraph> Dialogues => dialogues ?? (dialogues = BuildDialogues());

        // A fresh map each call (the caller owns it). Null for an unknown id.
        public static MapDef Map(string id) => id == DormRoomMap.Id ? DormRoomMap.Create() : null;

        public static string SpeakerName(string speakerId) => speakerId == J ? "Jonas" : speakerId == D ? "Daan" : "";

        // Character id for portrait_<cid>; null for the narrator.
        public static string SpeakerCharacter(string speakerId) => speakerId == J ? PlayerCharacter : speakerId == D ? "daan" : null;

        // True when the node only asks to continue: no choice has text, so the view advances on Enter/Space/E.
        public static bool IsContinueOnly(IReadOnlyList<DialogueChoice> choices)
        {
            if (choices == null || choices.Count == 0) return false;
            foreach (var c in choices) if (!string.IsNullOrEmpty(c.Text)) return false;
            return true;
        }

        private static List<StoryBeat> BuildScript()
        {
            var beats = new List<StoryBeat>();
            beats.AddRange(OpeningBeats());
            beats.AddRange(M1Beats());
            beats.Add(new StoryBeat
            {
                Id = "end", Kind = StoryBeatKind.End, Lines = EndCardText.Split('\n'), Sounds = new[] { "-drone", "silence" },
            });
            return beats;
        }

        private static Dictionary<string, DialogueGraph> BuildDialogues()
        {
            var graphs = new Dictionary<string, DialogueGraph>();
            foreach (var g in M1Part1Dialogues()) graphs.Add(g.Id, g);
            foreach (var g in M1Part2Dialogues()) graphs.Add(g.Id, g);
            return graphs;
        }

        private static StoryHotspot Obj(string id, string label, string dialogue, string cut = null) =>
            new StoryHotspot { Id = id, Label = label, Dialogue = dialogue, Cut = cut };

        private static StoryHotspot Far(string id, string label, string dialogue, int x, int y, int w, int h) =>
            new StoryHotspot { Id = id, Label = label, Dialogue = dialogue, X = x, Y = y, W = w, H = h };
    }
}

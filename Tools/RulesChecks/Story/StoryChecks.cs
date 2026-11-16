using PixelVocabFlight;
using System.Text.Json;

// Story mode (Act 0 wave 1): flags, script data, dialogue graphs, the dormitory map and a full playthrough of the runner.
internal static partial class StoryChecks
{
    private static readonly string[] ExpectedIds =
    {
        "open.P1.01", "open.P1.02", "open.P1.03", "open.P1.04", "open.P1.05", "open.P1.06", "open.P1.07",
        "m1.P1.01", "m1.P1.02", "m1.P1.03", "m1.P1.04", "m1.P1.05", "m1.P1.06", "m1.P1.07", "m1.P1.08", "m1.P1.09",
        "m1.P1.10", "m1.P1.11", "m1.P1.12", "m1.P1.13", "m1.P1.14", "m1.P1.15", "m1.P1.16", "end",
    };
    private static readonly string[] StoryObjects =
    {
        "wall_mailmap", "photo_floris", "handkerchief", "sketchbook_floris", "poster_airline", "notebook_english",
        "letter_daan_mother", "exam_diagram", "window",
    };
    private static readonly HashSet<string> KnownSounds = new HashSet<string>
    { "rain", "radio", "frogs", "frogs_low", "silence", "tin_touch", "tin_open", "drone", "clock", "cloth", "note", "wind" };
    private static readonly HashSet<string> Speakers = new HashSet<string> { "", "jonas", "daan" };

    private static int checks;
    private static void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }

    public static int Run()
    {
        checks = 0;
        CheckFlags();
        CheckScript();
        CheckDialogues();
        CheckDormMap();
        CheckDormLayers();
        CheckDaanRoute();
        CheckRunnerRules();
        CheckPlaythrough();
        CheckSegments();
        Console.WriteLine("PASS: " + checks + " story checks.");
        return checks;
    }

    private static void CheckFlags()
    {
        var f = new StoryFlags();
        Check(f.Get("a") == 0 && !f.Has("a") && f.Get(null) == 0, "missing flag reads 0");
        f.Set("a", 3); f.Add("a", -1); f.Add("b", 5);
        Check(f.Get("a") == 2 && f.Has("a") && f.Get("b") == 5, "set and add");
        f.Set("", 1); f.Set("bad name", 1); f.Add(null, 1);
        Check(f.All.Count == 2, "invalid names are ignored");
        Check(f.Apply("flag.set:c=7") && f.Get("c") == 7 && f.Apply("flag.add:c=-9") && f.Get("c") == -2, "apply set and add");
        Check(!f.Apply("mission.cancel") && !f.Apply(null) && !f.Apply("flag.set:=1") && !f.Apply("flag.set:a=x") && !f.Apply("flag.add:a") && !f.Apply("flag.set:a b=1") && f.Get("a") == 2, "apply refuses other actions and bad syntax");
        Check(f.Condition(null) && f.Condition("flag:a") && !f.Condition("flag:zz") && f.Condition("!flag:zz") && !f.Condition("!flag:a"), "plain and negated conditions");
        Check(f.Condition("flag:a>=2") && !f.Condition("flag:a>2") && f.Condition("flag:a<3") && f.Condition("flag:a<=2") && f.Condition("flag:a==2") && f.Condition("flag:a!=3") && f.Condition("flag:c<0") && f.Condition("!flag:a>=3"), "comparison conditions");
        Check(!f.Condition("flag:a>=") && !f.Condition("flag:") && !f.Condition("pride") && !f.Condition("flag:a>=x"), "malformed conditions are false");
        Check(DialogueActions.IsValid("flag.set:x=1") && DialogueActions.IsValid("flag.add:x=-2") && !DialogueActions.IsValid("flag.set:x") && !DialogueActions.IsValid("flag.add:=1") && !DialogueActions.IsValid("flag.set:x=y"), "dialogue actions accept flag syntax");
        Check(DialogueConditions.IsKnown("flag:x") && DialogueConditions.IsKnown("!flag:x>=2") && !DialogueConditions.IsKnown("flag:") && !DialogueConditions.IsKnown("flag:x>=a"), "dialogue conditions accept flag syntax");
        Check(DialogueActions.IsValid("mission.cancel") && !DialogueActions.IsValid("launch") && DialogueConditions.IsKnown("completed>0") && !DialogueConditions.IsKnown("weather>0"), "old action and condition rules unchanged");
    }

    private static void CheckScript()
    {
        var script = Act0Content.Script;
        Check(script.Select(b => b.Id).SequenceEqual(ExpectedIds), "beat ids are unique and follow the frame order (7 opening + 16 M1 + end)");
        Check(script.Last().Kind == StoryBeatKind.End && string.Join("\n", script.Last().Lines) == Act0Content.EndCardText, "script ends with the end card");
        Check(Act0Content.EndCardText == "Hết phần dựng thử: Cảnh mở và M1 Phần 1.\nPhần tiếp theo của Hồi 0 đang được dựng.", "end card text");
        Check(script.Take(7).Select(b => b.Seconds).SequenceEqual(new float[] { 5, 2, 4, 3, 4, 3, 3 }), "opening durations follow the table (P1.05 lasts 4 s so the lid animation can finish)");
        Check(script[0].Lines.Single() == "Hồi ấy tôi tưởng bầu trời là của mình." && script[0].Sprite == "cut_open_ink" && script[0].TextStyle == "ink", "opening sentence on the ink sprite");
        Check(script[5].Lines.Single() == "Anh giữ hết à." && script[5].TextStyle == "plain", "unnamed voice line");
        Check(script[6].Lines.Single() == "Brandhaven, Velmark. Ngày 9 tháng 5 năm 1940." && script[6].TextStyle == "type", "typewriter date");
        Check(script[7].Seconds == 4 && script[7].LockPlayer && script[7].Map == Act0Content.DormMapId, "M1 opens with a 4 s locked wide shot");
        var map = Act0Content.Map(Act0Content.DormMapId);
        foreach (var b in script)
        {
            string where = b.Id;
            Check(b.Seconds >= 0 && (b.Sounds == null || b.Sounds.All(s => KnownSounds.Contains(s.TrimStart('-')))), "known sound ids: " + where);
            foreach (var sprite in SpritesOf(b)) Check(sprite.StartsWith("cut_") || sprite.StartsWith("vista_") || sprite.StartsWith("fx_"), "story sprite prefix: " + where + " " + sprite);
            switch (b.Kind)
            {
                case StoryBeatKind.Text: Check(b.Lines != null && b.Sprite == null == (b.TextStyle != "ink") && b.Seconds > 0, "text beat: " + where); break;
                case StoryBeatKind.Cut: Check(b.Sprite != null && b.Layers != null && b.Seconds > 0, "cut beat: " + where); break;
                case StoryBeatKind.Map: Check(b.Map != null && Act0Content.Map(b.Map) != null, "map beat has a known map: " + where); break;
                case StoryBeatKind.Vista: Check(b.Sprite == "vista_m1_roof", "vista beat on the roof sprite: " + where); break;
                case StoryBeatKind.Dialogue: Check(b.Dialogue != null && (b.Map != null) != (b.Sprite != null), "dialogue beat has a graph and exactly one backdrop (map or sprite): " + where); break;
                case StoryBeatKind.End: Check(b.Lines != null && b.Lines.Length == 2 && b.Seconds == 0, "end beat: " + where); break;
            }
            Check(b.Dialogue == null || Act0Content.Dialogues.ContainsKey(b.Dialogue), "beat dialogue exists: " + where);
            var ids = (b.Hotspots ?? new StoryHotspot[0]).Select(h => h.Id).ToArray();
            Check(ids.Distinct().Count() == ids.Length, "hotspot ids unique: " + where);
            foreach (var h in b.Hotspots ?? new StoryHotspot[0])
            {
                Check(h.Dialogue == null || Act0Content.Dialogues.ContainsKey(h.Dialogue), "hotspot dialogue exists: " + where + " " + h.Id);
                Check(!string.IsNullOrEmpty(h.Label), "hotspot label: " + where + " " + h.Id);
                if (b.Kind == StoryBeatKind.Vista) Check(h.W > 0 && h.H > 0 && h.X >= 0 && h.Y >= 0 && h.X + h.W <= 480 && h.Y + h.H <= 270, "vista hotspot inside 480x270: " + where + " " + h.Id);
                if (b.Kind == StoryBeatKind.Map) Check(map.FindTag(BaseWorld.StoryTagPrefix + h.Id) != null, "map hotspot is a story placement: " + where + " " + h.Id);
            }
            foreach (var r in b.Required ?? new string[0]) Check(ids.Contains(r) && r != b.Exit, "required id is a hotspot: " + where + " " + r);
            if (b.Exit != null && b.Kind == StoryBeatKind.Map) Check(map.FindTag(BaseWorld.StoryTagPrefix + b.Exit) != null, "exit is a story placement: " + where);
            bool ends = b.Seconds > 0 || b.Kind == StoryBeatKind.End || b.Kind == StoryBeatKind.Dialogue || b.Exit != null || (b.Required != null && b.Required.Length > 0) || b.Dialogue != null;
            Check(ends, "beat has a way to end: " + where);
        }
        var vista = script.Single(b => b.Id == "m1.P1.13").Hotspots;
        Check(vista.Select(h => (h.Id, h.X, h.Y, h.W, h.H)).SequenceEqual(new[] { ("water_tower", 300, 44, 60, 90), ("airfield_grass", 120, 116, 150, 46), ("plane_seven", 200, 98, 60, 36) }), "vista hotspot boxes follow the sprite contract");
        Check(script.Single(b => b.Id == "m1.P1.16").Layers.SequenceEqual(new[] { "fx_village_lights", "fx_bomber_stream_night" }), "bomber stream layer at P1.16");
        Check(Act0Content.SpeakerName("jonas") == "Jonas" && Act0Content.SpeakerName("daan") == "Daan" && Act0Content.SpeakerName("") == "", "speaker names");
        Check(Act0Content.SpeakerCharacter("jonas") == "pilot_young" && Act0Content.SpeakerCharacter("daan") == "daan" && Act0Content.SpeakerCharacter("") == null, "speaker characters");
        Check(Act0Content.Map("nowhere") == null, "unknown map id");
    }

    internal static IEnumerable<string> SpritesOf(StoryBeat b)
    {
        if (b.Sprite != null) yield return b.Sprite;
        foreach (var l in b.Layers ?? new string[0]) yield return l;
        foreach (var h in b.Hotspots ?? new StoryHotspot[0]) if (h.Cut != null) yield return h.Cut;
    }
}

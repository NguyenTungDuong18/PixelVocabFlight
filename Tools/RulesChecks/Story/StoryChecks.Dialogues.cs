using PixelVocabFlight;

internal static partial class StoryChecks
{
    private static void CheckDialogues()
    {
        var graphs = Act0Content.Dialogues;
        var used = new HashSet<string>();
        foreach (var b in Act0Content.Script)
        {
            if (b.Dialogue != null) used.Add(b.Dialogue);
            foreach (var h in b.Hotspots ?? new StoryHotspot[0]) if (h.Dialogue != null) used.Add(h.Dialogue);
        }
        Check(used.SetEquals(graphs.Keys), "every dialogue graph is used by a beat and every beat graph exists");
        foreach (var pair in graphs)
        {
            var graph = pair.Value;
            Check(graph.Id == pair.Key && graph.Nodes.ContainsKey(DialogueGraph.StartNode), "graph id and start node: " + pair.Key);
            foreach (var node in graph.Nodes)
            {
                string where = pair.Key + "/" + node.Key;
                var n = node.Value;
                Check(n.Id == node.Key && !n.IsRouter && Speakers.Contains(n.Speaker) && !string.IsNullOrWhiteSpace(n.Text), "node id, speaker and text: " + where);
                Check(n.Choices != null && n.Choices.Length >= 1 && n.Choices.Length <= 5, "1-5 choices: " + where);
                bool linear = Act0Content.IsContinueOnly(n.Choices);
                Check(linear ? n.Choices.Length == 1 : n.Choices.All(c => !string.IsNullOrWhiteSpace(c.Text)), "a node either continues or has only worded choices: " + where);
                foreach (var c in n.Choices)
                {
                    Check(c.Next == null || c.Next == DialogueGraph.EndNode || graph.Nodes.ContainsKey(c.Next), "next node exists: " + where + " -> " + c.Next);
                    Check(DialogueActions.IsValid(c.Action) && (c.Action == null || StoryFlags.IsAction(c.Action)), "action is a flag action: " + where);
                    Check(DialogueConditions.IsKnown(c.Condition), "condition understood: " + where);
                }
            }
            var seen = new HashSet<string> { DialogueGraph.StartNode };
            var queue = new Queue<string>(seen);
            while (queue.Count > 0)
                foreach (var c in graph.Nodes[queue.Dequeue()].Choices)
                    if (c.Next != null && graph.Nodes.ContainsKey(c.Next) && seen.Add(c.Next)) queue.Enqueue(c.Next);
            Check(seen.SetEquals(graph.Nodes.Keys), "every node reachable from start: " + pair.Key);
        }
        // Spoken lines copied from the table, spot checks.
        bool Says(string graph, string speaker, string text) => graphs[graph].Nodes.Values.Any(n => n.Speaker == speaker && n.Text == text);
        Check(Says("m1_photo", "jonas", "Sáng Chủ nhật nào chú cũng bay qua tháp chuông, lắc cánh hai cái, thả cho mình một lá thư buộc vào khăn tay."), "P1.04 inner voice");
        Check(Says("m1_handkerchief", "daan", "Lại nhìn cái đó à. Ba năm rồi đấy."), "P1.05 Daan");
        Check(Says("m1_unlucky", "daan", "Chú cậu chắc cũng nghĩ thế.") && Says("m1_unlucky", "", "Jonas không trả lời."), "P1.07");
        Check(Says("m1_hesitate", "jonas", "Cậu chần chừ. Trên trời chần chừ là chết.") && Says("m1_hesitate", "daan", "Còn cậu thì chẳng bao giờ chần chừ."), "P1.09");
        Check(Says("m1_propeller", "daan", "Tớ vẫn chưa bay bù được hai tuần bị cấm hôm ấy đâu nhé."), "P1.11");
        Check(Says("m1_water_tower", "daan", "Nấc thứ mười hai.") && Says("m1_airfield", "daan", "Tớ thì thầy dặn mười phút. Rồi thầy đứng nhìn theo cho tới lúc tớ đáp."), "P1.13");
        Check(Says("m1_first_word", "daan", "Sky.") && graphs["m1_first_word"].Nodes.Count == 4 && Says("m1_drone", "jonas", "Không phải của mình. Mình không có nhiều máy bay thế."), "P1.15 and P1.16");
        var tone = graphs["m1_tone"].Nodes["start"].Choices;
        Check(tone.Length == 2 && tone[0].Action == "flag.add:pride=1" && tone[1].Action == "flag.add:pride=-1", "P1.10 moves pride by +1 / -1");
        var tell = graphs["m1_floris_story"].Nodes["start"].Choices;
        Check(tell.Length == 2 && tell[0].Text == "Kể tiếp" && tell[1].Next == null, "P1.06 optional branch");
    }

    // Leaving rules of the runner on a small synthetic script.
    private static void CheckRunnerRules()
    {
        StoryBeat Map(string id, StoryHotspot[] spots, string[] required, string exit) =>
            new StoryBeat { Id = id, Kind = StoryBeatKind.Map, Map = "m1_dorm", Hotspots = spots, Required = required, Exit = exit };
        StoryHotspot Spot(string id, string graph) => new StoryHotspot { Id = id, Label = id, Dialogue = graph };
        var script = new[]
        {
            Map("a", new[] { Spot("x", null), Spot("y", "gy") }, new[] { "x", "y" }, "door"),
            Map("b", new[] { Spot("p", "gp") }, new[] { "p" }, null),
            new StoryBeat { Id = "c", Kind = StoryBeatKind.Vista, Dialogue = "gc" },
            new StoryBeat { Id = "d", Kind = StoryBeatKind.Dialogue, Dialogue = "gd", Map = "m1_dorm" },
            new StoryBeat { Id = "e", Kind = StoryBeatKind.End },
        };
        var runner = new StoryRunner(script, new StoryFlags());
        StoryEvent e;
        Check(runner.PopEvent(out e) && e.Kind == StoryEventKind.BeatStarted && e.Beat.Id == "a" && !runner.PopEvent(out _), "first beat is announced once");
        Check(runner.Active("x") && runner.Active("door") && !runner.Active("p") && !runner.Active(null), "only the beat's objects are usable");
        Check(runner.Interact("p") == null && runner.Interact("nothing") == null && runner.Interact(null) == null && runner.Index == 0, "unknown objects do nothing");
        Check(runner.Interact("door") == null && runner.Index == 0 && runner.PopEvent(out e) && e.Kind == StoryEventKind.Toast && e.Text == StoryRunner.ExitLockedToast && !runner.Seen("door"), "exit stays locked until Required are seen");
        Check(runner.Interact("x") == null && runner.Seen("x") && !runner.CanExit && runner.Index == 0, "object without dialogue is just seen");
        Check(runner.Interact("y") == "gy" && runner.Seen("y") && runner.CanExit && runner.Index == 0, "object with dialogue returns its graph");
        runner.DialogueClosed();
        Check(runner.Index == 0, "an exit beat does not end on its own");
        Check(runner.Interact("door") == null && runner.Current.Id == "b" && runner.PopEvent(out e) && e.Kind == StoryEventKind.BeatStarted && e.Beat.Id == "b", "exit with no dialogue advances at once");
        Check(!runner.Seen("x") && !runner.CanExit, "seen ids are per beat");
        Check(runner.Interact("p") == "gp" && runner.Current.Id == "b", "last required object opens its dialogue first");
        runner.DialogueClosed();
        Check(runner.Current.Id == "c", "no exit: the beat ends when the last required dialogue closes");
        runner.DialogueClosed();
        Check(runner.Current.Id == "d", "own dialogue closing ends a Vista beat with Dialogue and nothing else to do");
        runner.DialogueClosed();
        Check(runner.Current.Id == "e" && !runner.Finished, "Dialogue beat ends when its graph closes");
        runner.Advance();
        var kinds = new List<StoryEventKind>();
        while (runner.PopEvent(out e)) kinds.Add(e.Kind);
        Check(runner.Finished && runner.Current == null && kinds.Count(k => k == StoryEventKind.Finished) == 1 && kinds.Last() == StoryEventKind.Finished, "finished once after the last beat");
        runner.Advance(); runner.DialogueClosed();
        Check(runner.Finished && runner.Interact("x") == null && !runner.PopEvent(out _), "a finished runner is inert");
        var withExitDialogue = new StoryRunner(new[] { Map("m", new[] { Spot("w", "gw") }, null, "w"), new StoryBeat { Id = "n", Kind = StoryBeatKind.End } }, new StoryFlags());
        Check(withExitDialogue.Interact("w") == "gw" && withExitDialogue.Index == 0, "exit with dialogue waits for the dialogue");
        withExitDialogue.DialogueClosed();
        Check(withExitDialogue.Current.Id == "n", "exit with dialogue advances when it closes");
        Check(new StoryRunner(new StoryBeat[0], new StoryFlags()).Finished, "empty script is finished");
    }

    private static List<string> Visited, SegmentsStarted;

    // Plays the script (from the first beat, or jumping to startBeat) through the public runner API with real DialogueRunner walks.
    private static (StoryFlags flags, StoryRunner runner) Play(int toneChoice, int storyChoice, string startBeat = null)
    {
        var flags = new StoryFlags();
        var runner = new StoryRunner(Act0Content.Script, flags);
        if (startBeat != null) runner.JumpTo(startBeat);
        var dialogue = new DialogueRunner(Act0Content.Dialogues);
        Visited = new List<string>();
        SegmentsStarted = new List<string>();
        void Talk(string graph)
        {
            dialogue.Start(graph, flags.Condition);
            for (int guard = 0; dialogue.Open && guard < 50; guard++)
            {
                var choices = dialogue.Choices;
                int pick = Act0Content.IsContinueOnly(choices) ? 0 : graph == "m1_tone" ? toneChoice : storyChoice;
                dialogue.Choose(pick, a => Check(flags.Apply(a), "dialogue action applies: " + a));
            }
            Check(!dialogue.Open, "dialogue ends: " + graph);
            runner.DialogueClosed();
        }
        for (int guard = 0; !runner.Finished && guard < 100; guard++)
        {
            var beat = runner.Current;
            Visited.Add(beat.Id);
            // Events of this beat: BeatStarted first, then SegmentStarted when it opens a segment (anything else here would be a leak).
            Check(runner.PopEvent(out var started) && started.Kind == StoryEventKind.BeatStarted && started.Beat == beat, "beat announced: " + beat.Id);
            while (runner.PopEvent(out var extra))
            {
                Check(extra.Kind == StoryEventKind.SegmentStarted && extra.Beat == beat && extra.Segment.FirstBeatId == beat.Id, "only SegmentStarted follows BeatStarted: " + beat.Id);
                SegmentsStarted.Add(extra.Segment.Id);
            }
            if (beat.Seconds > 0 || beat.Kind == StoryBeatKind.End) runner.Advance();
            else
            {
                if (beat.Dialogue != null) Talk(beat.Dialogue);
                foreach (var h in beat.Hotspots ?? new StoryHotspot[0])
                {
                    if (runner.Current != beat) break;
                    Check(runner.Active(h.Id), "hotspot is active: " + beat.Id + " " + h.Id);
                    string graph = runner.Interact(h.Id);
                    Check(graph == h.Dialogue && runner.Seen(h.Id) || runner.Current != beat, "interact returns the hotspot dialogue: " + h.Id);
                    if (graph != null) Talk(graph);
                }
                if (runner.Current == beat && beat.Exit != null)
                {
                    string graph = runner.Interact(beat.Exit);
                    if (graph != null) Talk(graph);
                }
            }
            Check(runner.Finished || runner.Current != beat, "beat ends: " + beat.Id);
        }
        return (flags, runner);
    }

    private static void CheckPlaythrough()
    {
        foreach (int tone in new[] { 0, 1 })
            foreach (int story in new[] { 0, 1 })
            {
                var (flags, runner) = Play(tone, story);
                string branch = "tone " + tone + ", story " + story;
                Check(runner.Finished && runner.Current == null, "script finishes (" + branch + ")");
                Check(Visited.SequenceEqual(ExpectedIds), "every beat visited once in order (" + branch + ")");
                Check(flags.Get(Act0Content.PrideFlag) == (tone == 0 ? 1 : -1) && flags.All.Count == 1, "pride moves with the tone choice only (" + branch + ")");
                Check(flags.Condition(tone == 0 ? "flag:pride>0" : "flag:pride<0") && !flags.Condition(tone == 0 ? "flag:pride<0" : "flag:pride>0"), "pride condition (" + branch + ")");
            }
    }
}

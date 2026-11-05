using PixelVocabFlight;
using System.Text.Json;

internal static partial class WorldChecks
{
    private static void CheckDialogueData()
    {
        // --- Dialogue data ---
        foreach (var pair in BaseContent.Dialogues)
        {
            var graph = pair.Value;
            Check(graph.Id == pair.Key && graph.Nodes.ContainsKey(DialogueGraph.StartNode), "dialogue has a start node: " + pair.Key);
            foreach (var node in graph.Nodes)
            {
                string where = pair.Key + "/" + node.Key;
                Check(node.Value.Id == node.Key && node.Value.Choices != null && node.Value.Choices.Length > 0 && node.Value.Choices.Length <= 5, "node id and 1–5 choices: " + where);
                if (node.Value.IsRouter)
                {
                    Check(node.Value.Choices.All(c => c.Text == null && c.Action == null) && node.Value.Choices.Last().Condition == null, "router always routes: " + where);
                }
                else
                {
                    Check(node.Value.Speaker == pair.Key || node.Value.Speaker == BaseContent.PlayerCharacter, "speaker is the NPC or pilot: " + where);
                    Check(node.Value.Choices.All(c => !string.IsNullOrWhiteSpace(c.Text)), "choices have text: " + where);
                }
                foreach (var choice in node.Value.Choices)
                {
                    Check(choice.Next == null || choice.Next == DialogueGraph.EndNode || graph.Nodes.ContainsKey(choice.Next), "next node exists: " + where + " → " + choice.Next);
                    Check(choice.Action == null || ContractActions.Contains(choice.Action), "action in the contract set: " + where + " " + choice.Action);
                    Check(DialogueActions.IsValid(choice.Action), "action parses: " + where);
                    Check(choice.Condition == null || ContractConditions.Contains(choice.Condition), "condition in the contract set: " + where);
                    Check(DialogueConditions.IsKnown(choice.Condition), "condition understood: " + where);
                }
            }
            Check(Reached(graph).SetEquals(graph.Nodes.Keys), "every node reachable from start: " + pair.Key);
        }
        foreach (var npc in BaseContent.Roster.Values) Check(BaseContent.Dialogues.ContainsKey(npc.Dialogue), "roster dialogue exists: " + npc.Id);
        Check(BaseContent.Missions.Count == 1 && BaseContent.Missions["vocab-sortie"].Title == "Huấn luyện điện mật" && BaseContent.Missions["vocab-sortie"].Giver == "professor"
            && BaseContent.Missions["vocab-sortie"].Objective == "Ra SKYLARK MK.I ở sân đỗ và nhấn E để cất cánh.", "vocab-sortie mission");
        foreach (var mission in BaseContent.Missions.Values) Check(BaseContent.Roster.ContainsKey(mission.Giver), "mission giver exists: " + mission.Id);
    }

    private static void CheckProfessorFlow()
    {
        // --- Professor flow ---
        var missions = new MissionLog();
        Check(missions.Active == null && missions.ObjectiveText == "Gặp Giáo sư Whitmore để nhận nhiệm vụ." && missions.StatusOf("vocab-sortie") == MissionStatus.Available, "no mission at start");
        var runner = new DialogueRunner(BaseContent.Dialogues);
        var vars = BaseContent.Variables(missions, 1234);
        Check(!runner.Open && runner.Current == null && runner.Choices.Count == 0 && runner.Choose(0) == null, "closed runner is inert");
        runner.Start("professor", missions.Condition);
        Check(runner.Open && runner.Current.Id == "start_first" && runner.Current.Speaker == "professor" && runner.Text(vars).Contains("Good morning"), "first visit greeting");
        int Find(string text) { var list = runner.Choices; for (int i = 0; i < list.Count; i++) if (list[i].Text.StartsWith(text, StringComparison.Ordinal)) return i; return -1; }
        Check(runner.Choices.Select(c => c.Text).SequenceEqual(new[] { "Nhận nhiệm vụ huấn luyện", "Chọn bộ từ vựng", "Hỏi về các chiến trường", "Tạm biệt" }), "professor idle choices");
        Check(runner.Choose(Find("Hỏi về")) == null && runner.Current.Id == "about_env" && runner.Text(vars).Contains("Băng giá"), "ask about battlefields");
        runner.Choose(Find("Quay lại"));
        Check(runner.Current.Id == "start_first", "back to the greeting");
        Check(runner.Choose(Find("Nhận nhiệm vụ")) == null && runner.Current.Id == "pick_env", "accept leads to battlefield choice");
        Check(runner.Text(vars) == "Chọn chiến trường cho chuyến bay này. Bộ từ hiện có 1.234 mục.", "word count variable");
        Check(runner.Choices.Count == 5 && runner.Choices[0].Text.StartsWith("1. Rừng rậm", StringComparison.Ordinal) && runner.Choices[3].Text.StartsWith("4. Biển", StringComparison.Ordinal), "four battlefields plus back");
        string action = runner.Choose(Find("3. Băng giá"));
        Check(action == "mission.accept:2" && missions.Apply(action), "ice battlefield action");
        Check(missions.Active != null && missions.Active.Id == "vocab-sortie" && missions.Environment == 2 && missions.StatusOf("vocab-sortie") == MissionStatus.Active, "mission active on the ice front");
        Check(missions.ObjectiveText == "Ra SKYLARK MK.I ở sân đỗ và nhấn E để cất cánh.", "objective while active");
        Check(runner.Current.Id == "accepted" && runner.Text(vars) == "Tốt. Ra SKYLARK MK.I ở sân đỗ và cất cánh. Good luck, pilot!", "accepted line");
        Check(runner.Choose(0) == null && !runner.Open && runner.Current == null, "dialogue ends after accepting");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_active" && runner.Text(vars).Contains("(Băng giá)"), "active branch names the battlefield");
        Check(runner.Choices.Select(c => c.Text).SequenceEqual(new[] { "Đổi chiến trường", "Hủy nhiệm vụ", "Chọn bộ từ vựng", "Đi ngay" }), "active choices");
        runner.Choose(Find("Đổi chiến trường"));
        runner.Choose(Find("Quay lại"));
        Check(runner.Current.Id == "start_active", "back from battlefield choice returns to the active branch");
        runner.Choose(Find("Đổi chiến trường"));
        missions.Apply(runner.Choose(Find("2. Sa mạc")));
        Check(missions.Environment == 1 && missions.Active != null, "changing battlefield keeps the mission");
        runner.Close();
        Check(!runner.Open, "close");
        runner.Start("professor", missions.Condition);
        Check(runner.Choose(Find("Chọn bộ từ vựng")) == "vocab.open" && !runner.Open, "vocabulary action closes the dialogue");
        runner.Start("professor", missions.Condition);
        action = runner.Choose(Find("Hủy nhiệm vụ"));
        Check(action == "mission.cancel" && missions.Apply(action) && missions.Active == null && !runner.Open, "cancel ends the mission");
        Check(missions.ObjectiveText == "Gặp Giáo sư Whitmore để nhận nhiệm vụ.", "idle objective after cancel");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_first", "idle branch after cancel");
        runner.Close();
        missions.Accept("vocab-sortie", 3);
        missions.Complete(1234);
        Check(missions.Completed == 1 && missions.LastScore == 1234 && missions.Active == null, "complete records the sortie");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_back" && runner.Text(vars).Contains("1.234 điểm") && runner.Text(vars).Contains("1 chuyến"), "returning greeting quotes the last score");
        runner.Close();
        var applyFirst = new MissionLog();
        runner.Start("professor", applyFirst.Condition);
        runner.Choose(Find("Nhận nhiệm vụ"));
        Check(runner.Choose(Find("1. Rừng"), a => applyFirst.Apply(a)) == "mission.accept:0" && applyFirst.Active != null && applyFirst.Environment == 0, "choose can apply the action itself");

        // Mission log edge cases.
        var edge = new MissionLog();
        Check(!edge.Accept("vocab-sortie", -1) && !edge.Accept("vocab-sortie", 4) && !edge.Accept("missing", 0) && !edge.Accept(null, 0) && edge.Active == null, "invalid accepts are rejected");
        Check(!edge.Apply("vocab.open") && !edge.Apply(null) && !edge.Apply("mission.accept:9") && edge.Active == null, "non-mission actions are not applied");
        Check(edge.Apply("mission.accept:vocab-sortie:3") && edge.Environment == 3, "long accept form");
        Check(edge.Condition("mission.active") && !edge.Condition("!mission.active") && edge.Condition("mission.active:vocab-sortie") && !edge.Condition("completed>0") && edge.Condition("completed==0"), "conditions");
        edge.Completed = 4; edge.LastScore = 50;
        Check(edge.Condition("completed>=4") && edge.Condition("lastScore<51") && edge.Condition("environment!=1") && !edge.Condition("unknown>0") && edge.Condition(null), "comparison conditions");
        Check(!DialogueConditions.IsKnown("weather>0") && DialogueConditions.IsKnown("!completed>0"), "known conditions");
        Check(DialogueActions.IsValid(null) && DialogueActions.IsValid("mission.accept:3") && !DialogueActions.IsValid("mission.accept:4") && !DialogueActions.IsValid("mission.accept:") && !DialogueActions.IsValid("launch"), "action validation");
        Check(DialogueRunner.Substitute("A {x} {unknown} {", n => n == "x" ? "1" : null) == "A 1 {unknown} {", "unknown variables stay");
        Check(BaseContent.EnvironmentName(0) == "Rừng rậm" && BaseContent.EnvironmentName(3) == "Biển" && BaseContent.SpeakerName("pilot") == "Phi công 01" && BaseContent.SpeakerName("medic") == "Y tá Lan" && BaseContent.SpeakerCharacter("officer") == "officer", "content helpers");
        bool missingGraph = false;
        try { runner.Start("nobody", edge.Condition); } catch (KeyNotFoundException) { missingGraph = true; }
        Check(missingGraph, "unknown dialogue throws");

        // Side NPCs react to progress.
        var side = new MissionLog();
        runner.Start("mechanic", side.Condition);
        Check(runner.Current.Id == "idle" && runner.Text(vars).Contains("SKYLARK đã đổ đầy xăng"), "mechanic without orders");
        side.Accept("vocab-sortie", 0);
        runner.Start("mechanic", side.Condition);
        Check(runner.Current.Id == "ready", "mechanic with orders");
        runner.Start("officer", side.Condition);
        Check(runner.Current.Id == "rookie", "officer greets a rookie");
        side.Complete(10);
        runner.Start("officer", side.Condition);
        Check(runner.Current.Id == "veteran" && runner.Text(BaseContent.Variables(side, 0)).Contains("1 chuyến"), "officer greets a veteran");
        runner.Start("guard", side.Condition);
        Check(runner.Text(vars).Contains("Không ai ra khỏi cổng khi chưa có lệnh"), "guard line");
        runner.Start("medic", side.Condition);
        Check(runner.Text(vars).Contains("Trúng đạn thì về đây"), "medic line");
    }

    private static HashSet<string> Reached(DialogueGraph graph)
    {
        var seen = new HashSet<string> { DialogueGraph.StartNode };
        var queue = new Queue<string>(seen);
        while (queue.Count > 0)
            foreach (var choice in graph.Nodes[queue.Dequeue()].Choices)
                if (choice.Next != null && choice.Next != DialogueGraph.EndNode && graph.Nodes.ContainsKey(choice.Next) && seen.Add(choice.Next)) queue.Enqueue(choice.Next);
        return seen;
    }
}

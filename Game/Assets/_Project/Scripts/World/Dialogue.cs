using System;
using System.Collections.Generic;
using System.Text;

namespace PixelVocabFlight
{
    // Next null or "end" closes the dialogue. Condition null always shows the choice.
    public sealed class DialogueChoice
    {
        public string Text, Next, Action, Condition;
    }

    // Speaker is an NPC id or "pilot". A node without Text is a router: it silently follows its first
    // choice whose Condition holds (router choices carry no Text or Action).
    public sealed class DialogueNode
    {
        public string Id, Speaker, Text;
        public DialogueChoice[] Choices;

        public bool IsRouter => string.IsNullOrEmpty(Text);
    }

    // Conversation graph; it always starts at node "start".
    public sealed class DialogueGraph
    {
        public const string StartNode = "start";
        public const string EndNode = "end";

        public string Id;
        public Dictionary<string, DialogueNode> Nodes;

        public DialogueGraph() { Nodes = new Dictionary<string, DialogueNode>(); }

        public DialogueGraph(string id, params DialogueNode[] nodes) : this()
        {
            Id = id;
            foreach (var node in nodes) Nodes.Add(node.Id, node);
        }
    }

    public static class DialogueActions
    {
        public const string End = "end";
        public const string VocabOpen = "vocab.open";
        public const string MissionCancel = "mission.cancel";
        public const string MissionAcceptPrefix = "mission.accept:";

        public static string Accept(int environment) => MissionAcceptPrefix + environment;

        // "mission.accept:<env>" or "mission.accept:<missionId>:<env>" with env 0..3. missionId is null in the short form.
        public static bool TryParseAccept(string action, out string missionId, out int environment)
        {
            missionId = null; environment = -1;
            if (action == null || !action.StartsWith(MissionAcceptPrefix, StringComparison.Ordinal)) return false;
            string rest = action.Substring(MissionAcceptPrefix.Length);
            int colon = rest.LastIndexOf(':');
            if (colon >= 0) { missionId = rest.Substring(0, colon); rest = rest.Substring(colon + 1); if (missionId.Length == 0) return false; }
            if (rest.Length != 1 || rest[0] < '0' || rest[0] >= '0' + MissionLog.EnvironmentCount) return false;
            environment = rest[0] - '0';
            return true;
        }

        // Null (no action) is valid.
        public static bool IsValid(string action) =>
            action == null || action == End || action == VocabOpen || action == MissionCancel || TryParseAccept(action, out _, out _);
    }

    public static class DialogueConditions
    {
        private static readonly string[] operators = { ">=", "<=", "==", "!=", ">", "<" };
        private static readonly string[] variables = { "completed", "lastScore", "environment" };

        public static bool TryParseComparison(string condition, out string variable, out string op, out int value)
        {
            variable = null; op = null; value = 0;
            if (condition == null) return false;
            foreach (var candidate in operators)
            {
                int at = condition.IndexOf(candidate, StringComparison.Ordinal);
                if (at <= 0) continue;
                variable = condition.Substring(0, at).Trim();
                op = candidate;
                return int.TryParse(condition.Substring(at + candidate.Length).Trim(), out value);
            }
            return false;
        }

        // True when MissionLog.Condition understands the condition (null means "always").
        public static bool IsKnown(string condition)
        {
            if (condition == null) return true;
            condition = condition.Trim();
            if (condition.StartsWith("!", StringComparison.Ordinal)) return IsKnown(condition.Substring(1));
            if (condition == "mission.active" || condition.StartsWith("mission.active:", StringComparison.Ordinal)) return true;
            return TryParseComparison(condition, out string variable, out _, out _) && Array.IndexOf(variables, variable) >= 0;
        }
    }

    // Walks a DialogueGraph. The caller applies returned actions (MissionLog.Apply, opening the vocabulary screen...).
    public sealed class DialogueRunner
    {
        private const int MaxRouterHops = 16;
        private readonly IReadOnlyDictionary<string, DialogueGraph> graphs;
        private Func<string, bool> condition;

        public DialogueRunner(IReadOnlyDictionary<string, DialogueGraph> graphs)
        {
            this.graphs = graphs ?? throw new ArgumentNullException(nameof(graphs));
        }

        public bool Open { get; private set; }
        public DialogueNode Current { get; private set; }
        public DialogueGraph Graph { get; private set; }
        public string Speaker => Current?.Speaker;

        public void Start(string graphId, Func<string, bool> condition)
        {
            if (graphId == null || !graphs.TryGetValue(graphId, out var graph)) throw new KeyNotFoundException("Unknown dialogue: " + graphId);
            Graph = graph;
            this.condition = condition;
            Open = true;
            Enter(DialogueGraph.StartNode);
        }

        // Current text with {name} tokens replaced; unknown tokens (variable returns null) stay as written.
        public string Text(Func<string, string> variable)
        {
            if (Current == null) return "";
            return Substitute(Current.Text, variable);
        }

        public static string Substitute(string text, Func<string, string> variable)
        {
            if (string.IsNullOrEmpty(text) || variable == null || text.IndexOf('{') < 0) return text ?? "";
            var result = new StringBuilder(text.Length + 16);
            for (int i = 0; i < text.Length; i++)
            {
                int close = text[i] == '{' ? text.IndexOf('}', i + 1) : -1;
                if (close < 0) { result.Append(text[i]); continue; }
                string value = variable(text.Substring(i + 1, close - i - 1));
                if (value == null) result.Append(text, i, close - i + 1);
                else result.Append(value);
                i = close;
            }
            return result.ToString();
        }

        public IReadOnlyList<DialogueChoice> Choices
        {
            get
            {
                var visible = new List<DialogueChoice>();
                if (!Open || Current?.Choices == null) return visible;
                foreach (var choice in Current.Choices) if (Holds(choice.Condition)) visible.Add(choice);
                return visible;
            }
        }

        public string Choose(int index) => Choose(index, null);

        // Same as Choose(index) but applies the action before moving on, so the next node sees its effect.
        public string Choose(int index, Action<string> apply)
        {
            var visible = Choices;
            if (index < 0 || index >= visible.Count) return null;
            var choice = visible[index];
            if (choice.Action != null) apply?.Invoke(choice.Action);
            if (choice.Action == DialogueActions.End) Close();
            else Enter(choice.Next);
            return choice.Action;
        }

        public void Close()
        {
            Open = false;
            Current = null;
        }

        private bool Holds(string test) => test == null || condition == null || condition(test);

        private void Enter(string nodeId)
        {
            for (int hop = 0; hop < MaxRouterHops; hop++)
            {
                if (nodeId == null || nodeId == DialogueGraph.EndNode || !Graph.Nodes.TryGetValue(nodeId, out var node)) { Close(); return; }
                if (!node.IsRouter) { Current = node; return; }
                nodeId = null;
                if (node.Choices != null)
                    foreach (var route in node.Choices)
                        if (Holds(route.Condition)) { nodeId = route.Next; break; }
            }
            Close();
        }
    }
}

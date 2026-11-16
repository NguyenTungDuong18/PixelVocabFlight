using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Story flags and hidden stats (pride...): name -> int. Missing flags read as 0.
    // Dialogue actions: "flag.set:<name>=<int>", "flag.add:<name>=<±int>".
    // Dialogue conditions: "flag:<name>" (non-zero), "flag:<name><op><int>" with op > >= < <= == !=, and "!<condition>".
    public sealed class StoryFlags
    {
        public const string ConditionPrefix = "flag:";
        public const string SetPrefix = "flag.set:";
        public const string AddPrefix = "flag.add:";

        private readonly Dictionary<string, int> values = new Dictionary<string, int>();

        public IReadOnlyDictionary<string, int> All => values;

        public int Get(string name) => name != null && values.TryGetValue(name, out int v) ? v : 0;
        public bool Has(string name) => Get(name) != 0;
        public void Set(string name, int value) { if (ValidName(name)) values[name] = value; }
        public void Add(string name, int delta) { if (ValidName(name)) values[name] = Get(name) + delta; }
        public void Clear() => values.Clear();

        // Returns true when the action is a flag action and has been applied.
        public bool Apply(string action)
        {
            if (!TryParseAction(action, out bool add, out string name, out int value)) return false;
            if (add) Add(name, value); else Set(name, value);
            return true;
        }

        public bool Condition(string condition)
        {
            if (string.IsNullOrEmpty(condition)) return true;
            condition = condition.Trim();
            if (condition.StartsWith("!", StringComparison.Ordinal)) return !Condition(condition.Substring(1));
            if (!TryParseCondition(condition, out string name, out string op, out int value)) return false;
            int actual = Get(name);
            switch (op)
            {
                case null: return actual != 0;
                case ">": return actual > value;
                case ">=": return actual >= value;
                case "<": return actual < value;
                case "<=": return actual <= value;
                case "==": return actual == value;
                default: return actual != value;
            }
        }

        public static bool IsAction(string action) => TryParseAction(action, out _, out _, out _);

        // Syntax only (the leading "!" is handled by the caller).
        public static bool IsCondition(string condition) => condition != null && TryParseCondition(condition.Trim(), out _, out _, out _);

        public static bool ValidName(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            foreach (char c in name) if (!(char.IsLetterOrDigit(c) || c == '_' || c == '.')) return false;
            return true;
        }

        private static bool TryParseAction(string action, out bool add, out string name, out int value)
        {
            add = false; name = null; value = 0;
            if (action == null) return false;
            string prefix = action.StartsWith(SetPrefix, StringComparison.Ordinal) ? SetPrefix : action.StartsWith(AddPrefix, StringComparison.Ordinal) ? AddPrefix : null;
            if (prefix == null) return false;
            add = prefix == AddPrefix;
            string rest = action.Substring(prefix.Length);
            int eq = rest.IndexOf('=');
            if (eq <= 0) return false;
            name = rest.Substring(0, eq);
            return ValidName(name) && int.TryParse(rest.Substring(eq + 1), out value);
        }

        // op is null for the plain "flag:<name>" form.
        private static bool TryParseCondition(string condition, out string name, out string op, out int value)
        {
            name = null; op = null; value = 0;
            if (!condition.StartsWith(ConditionPrefix, StringComparison.Ordinal)) return false;
            string rest = condition.Substring(ConditionPrefix.Length);
            if (ValidName(rest)) { name = rest; return true; }
            if (!DialogueConditions.TryParseComparison(rest, out name, out op, out value)) return false;
            return ValidName(name);
        }
    }
}

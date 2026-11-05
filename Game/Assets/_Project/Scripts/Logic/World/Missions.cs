using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    public enum MissionStatus { Available, Active }

    // A mission an NPC can hand out. Giver is an NPC id.
    public sealed class MissionDef
    {
        public string Id, Title, Giver, Objective;
    }

    // Mission progress of the pilot. Only one mission is active at a time; Environment is a FlightEnvironment index.
    public sealed class MissionLog
    {
        public const string IdleObjective = "Gặp Giáo sư Whitmore để nhận nhiệm vụ.";
        public const int EnvironmentCount = 4;

        private readonly IReadOnlyDictionary<string, MissionDef> catalog;

        public MissionLog() : this(BaseContent.Missions) { }

        public MissionLog(IReadOnlyDictionary<string, MissionDef> catalog)
        {
            this.catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        }

        public IReadOnlyDictionary<string, MissionDef> Catalog => catalog;
        // Mission used by the short action form "mission.accept:<env>".
        public string DefaultMission { get; set; } = BaseContent.VocabSortie;

        public MissionDef Active { get; private set; }
        public int Environment { get; private set; }
        public int Completed { get; set; }
        public int LastScore { get; set; }

        public string ObjectiveText => Active != null ? Active.Objective : IdleObjective;

        public MissionStatus StatusOf(string missionId) => Active != null && Active.Id == missionId ? MissionStatus.Active : MissionStatus.Available;

        // Accepting again while active switches the battlefield of the active mission.
        public bool Accept(string missionId, int environment)
        {
            if (missionId == null || environment < 0 || environment >= EnvironmentCount) return false;
            if (!catalog.TryGetValue(missionId, out var mission)) return false;
            Active = mission;
            Environment = environment;
            return true;
        }

        public void Cancel() => Active = null;

        public void Complete(int score)
        {
            Active = null;
            Completed++;
            LastScore = score;
        }

        // Applies a dialogue action that concerns missions: "mission.accept:<env>", "mission.accept:<id>:<env>",
        // "mission.cancel". Returns false for anything else (e.g. "vocab.open", which the view handles).
        public bool Apply(string action)
        {
            if (action == "mission.cancel") { Cancel(); return true; }
            if (DialogueActions.TryParseAccept(action, out string missionId, out int environment))
                return Accept(missionId ?? DefaultMission, environment);
            return false;
        }

        // Standard dialogue conditions: "mission.active", "!<condition>", "<variable><op><int>"
        // where variable is completed, lastScore or environment and op is >, >=, <, <=, == or !=.
        public bool Condition(string condition)
        {
            if (string.IsNullOrEmpty(condition)) return true;
            condition = condition.Trim();
            if (condition.StartsWith("!", StringComparison.Ordinal)) return !Condition(condition.Substring(1));
            if (condition == "mission.active") return Active != null;
            if (condition.StartsWith("mission.active:", StringComparison.Ordinal)) return Active != null && Active.Id == condition.Substring(15);
            if (!DialogueConditions.TryParseComparison(condition, out string variable, out string op, out int value)) return false;
            int actual;
            switch (variable)
            {
                case "completed": actual = Completed; break;
                case "lastScore": actual = LastScore; break;
                case "environment": actual = Environment; break;
                default: return false;
            }
            switch (op)
            {
                case ">": return actual > value;
                case ">=": return actual >= value;
                case "<": return actual < value;
                case "<=": return actual <= value;
                case "==": return actual == value;
                default: return actual != value;
            }
        }
    }
}

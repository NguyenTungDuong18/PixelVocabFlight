using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Base content: NPC roster, missions and Vietnamese dialogue. New NPCs, missions or conversations go here.
    public static class BaseContent
    {
        public const string PlayerName = "Phi công 01";
        public const string PlayerCharacter = "pilot";
        public const string VocabSortie = "vocab-sortie";
        public const string NoOrdersHint = "Chưa có lệnh bay. Hãy gặp Giáo sư Whitmore ở Trường huấn luyện ngoại ngữ.";

        public static readonly string[] EnvironmentNames = { "Rừng rậm", "Sa mạc", "Băng giá", "Biển" };

        public static string EnvironmentName(int environment) =>
            environment >= 0 && environment < EnvironmentNames.Length ? EnvironmentNames[environment] : EnvironmentNames[0];

        private static readonly Dictionary<string, NpcDef> roster = Index(new[]
        {
            Npc("professor", "Giáo sư Whitmore", "Trưởng khoa ngoại ngữ"),
            Npc("guard", "Lính gác Tâm", "Gác cổng"),
            Npc("mechanic", "Thợ máy Bảy", "Tổ bảo dưỡng"),
            Npc("medic", "Y tá Lan", "Trạm y tế"),
            Npc("officer", "Đại tá Phong", "Chỉ huy căn cứ"),
        });

        private static readonly Dictionary<string, MissionDef> missions = new Dictionary<string, MissionDef>
        {
            [VocabSortie] = new MissionDef
            {
                Id = VocabSortie,
                Title = "Huấn luyện điện mật",
                Giver = "professor",
                Objective = "Ra SKYLARK MK.I ở sân đỗ và nhấn E để cất cánh.",
            },
        };

        private static readonly Dictionary<string, DialogueGraph> dialogues = IndexGraphs(
            Professor(), Guard(), Mechanic(), Medic(), Officer());

        // NPC templates by id (position 0,0); maps place them with Place().
        public static IReadOnlyDictionary<string, NpcDef> Roster => roster;
        public static IReadOnlyDictionary<string, DialogueGraph> Dialogues => dialogues;
        public static IReadOnlyDictionary<string, MissionDef> Missions => missions;

        // Copy of a roster NPC standing at (x, y).
        public static NpcDef Place(string npcId, float x, float y, Facing facing)
        {
            var t = roster[npcId];
            return new NpcDef { Id = t.Id, Name = t.Name, Role = t.Role, Character = t.Character, Dialogue = t.Dialogue, X = x, Y = y, Facing = facing };
        }

        // Display name of a dialogue speaker id ("pilot" or an NPC id).
        public static string SpeakerName(string speaker) =>
            speaker == PlayerCharacter ? PlayerName : speaker != null && roster.TryGetValue(speaker, out var npc) ? npc.Name : speaker;

        // Character id for a speaker, used for portrait_<cid>.
        public static string SpeakerCharacter(string speaker) =>
            speaker != null && roster.TryGetValue(speaker, out var npc) ? npc.Character : PlayerCharacter;

        // Text variables: {wordCount}, {lastScore}, {environment}, {completed}.
        public static Func<string, string> Variables(MissionLog log, int wordCount) => name =>
        {
            switch (name)
            {
                case "wordCount": return wordCount.ToString("N0", Vietnamese);
                case "lastScore": return log.LastScore.ToString("N0", Vietnamese);
                case "environment": return EnvironmentName(log.Environment);
                case "completed": return log.Completed.ToString("N0", Vietnamese);
                default: return null;
            }
        };

        private static readonly System.Globalization.NumberFormatInfo Vietnamese =
            new System.Globalization.NumberFormatInfo { NumberGroupSeparator = ".", NumberDecimalSeparator = "," };

        private static NpcDef Npc(string id, string name, string role) =>
            new NpcDef { Id = id, Name = name, Role = role, Character = id, Dialogue = id };

        private static Dictionary<string, NpcDef> Index(NpcDef[] npcs)
        {
            var index = new Dictionary<string, NpcDef>();
            foreach (var npc in npcs) index.Add(npc.Id, npc);
            return index;
        }

        private static Dictionary<string, DialogueGraph> IndexGraphs(params DialogueGraph[] graphs)
        {
            var index = new Dictionary<string, DialogueGraph>();
            foreach (var graph in graphs) index.Add(graph.Id, graph);
            return index;
        }

        // --- Small builders so conversations read like a script ---

        private static DialogueNode Say(string id, string speaker, string text, params DialogueChoice[] choices) =>
            new DialogueNode { Id = id, Speaker = speaker, Text = text, Choices = choices };

        private static DialogueNode Route(string id, params DialogueChoice[] routes) =>
            new DialogueNode { Id = id, Choices = routes };

        private static DialogueChoice Go(string text, string next, string action = null, string condition = null) =>
            new DialogueChoice { Text = text, Next = next, Action = action, Condition = condition };

        private static DialogueChoice When(string condition, string next) => new DialogueChoice { Next = next, Condition = condition };
        private static DialogueChoice Otherwise(string next) => new DialogueChoice { Next = next };

        private static DialogueGraph Professor()
        {
            const string who = "professor";
            DialogueChoice[] idleChoices =
            {
                Go("Nhận nhiệm vụ huấn luyện", "pick_env"),
                Go("Chọn bộ từ vựng", DialogueGraph.EndNode, DialogueActions.VocabOpen),
                Go("Hỏi về các chiến trường", "about_env"),
                Go("Tạm biệt", DialogueGraph.EndNode),
            };
            return new DialogueGraph(who,
                Route("start",
                    When("mission.active", "start_active"),
                    When("completed>0", "start_back"),
                    Otherwise("start_first")),
                Say("start_first", who,
                    "À, cậu là phi công mới đấy à? Good morning. Tôi là Whitmore, phụ trách ngoại ngữ của căn cứ. " +
                    "Trên trời, lệnh và điện mật đều bằng tiếng Anh. Phi công không đọc kịp thì không về kịp.",
                    idleChoices),
                Say("start_back", who,
                    "Welcome back. Chuyến trước cậu được {lastScore} điểm, tổng cộng {completed} chuyến huấn luyện. " +
                    "Mỗi chuyến bay là một bài học. Điện mật ngoài chiến trường không chờ ai cả.",
                    idleChoices),
                Say("about_env", who,
                    "Có bốn chiến trường. Rừng rậm: máy bay địch dày hơn. Sa mạc: phải chọn đúng từ loại. " +
                    "Băng giá: địch có khiên, phải bắn trúng hai lần. Biển: tàu sân bay phóng tên lửa bốn đáp án. " +
                    "Cứ mỗi ba phút, mặt trận lại chuyển sang vùng kế tiếp.",
                    Go("Nhận nhiệm vụ huấn luyện", "pick_env"),
                    Go("Quay lại", "start")),
                Say("pick_env", who,
                    "Chọn chiến trường cho chuyến bay này. Bộ từ hiện có {wordCount} mục.",
                    Go("1. Rừng rậm (máy bay địch dày hơn 30%)", "accepted", DialogueActions.Accept(0)),
                    Go("2. Sa mạc (phải chọn đúng từ loại)", "accepted", DialogueActions.Accept(1)),
                    Go("3. Băng giá (địch có khiên, trúng 2 lần)", "accepted", DialogueActions.Accept(2)),
                    Go("4. Biển (tàu sân bay phóng tên lửa 4 đáp án)", "accepted", DialogueActions.Accept(3)),
                    Go("Quay lại", "start")),
                Say("accepted", who,
                    "Tốt. Ra SKYLARK MK.I ở sân đỗ và cất cánh. Good luck, pilot!",
                    Go("Rõ, thưa giáo sư.", DialogueGraph.EndNode)),
                Say("start_active", who,
                    "Máy bay của cậu đang chờ ở sân đỗ ({environment}). Đừng để thợ máy phải hâm nóng động cơ lần thứ hai.",
                    Go("Đổi chiến trường", "pick_env"),
                    Go("Hủy nhiệm vụ", DialogueGraph.EndNode, DialogueActions.MissionCancel),
                    Go("Chọn bộ từ vựng", DialogueGraph.EndNode, DialogueActions.VocabOpen),
                    Go("Đi ngay", DialogueGraph.EndNode)));
        }

        private static DialogueGraph Guard()
        {
            const string who = "guard";
            return new DialogueGraph(who,
                Say("start", who,
                    "Đứng lại! À, phi công. Không ai ra khỏi cổng khi chưa có lệnh. " +
                    "Về sau Đại tá sẽ giao việc tuần tra, lúc đó tôi mới mở barie cho.",
                    Go("Ngoài kia có gì?", "outside"),
                    Go("Rõ.", DialogueGraph.EndNode)),
                Say("outside", who,
                    "Rừng, muỗi và lính bắn tỉa. Cứ ở trong hàng rào cho lành.",
                    Go("Cảm ơn anh.", DialogueGraph.EndNode)));
        }

        private static DialogueGraph Mechanic()
        {
            const string who = "mechanic";
            return new DialogueGraph(who,
                Route("start",
                    When("mission.active", "ready"),
                    Otherwise("idle")),
                Say("idle", who,
                    "SKYLARK đã đổ đầy xăng. Nhận lệnh từ Giáo sư Whitmore rồi ra đây.",
                    Go("Máy bay ổn chứ?", "parts"),
                    Go("Tôi đi ngay.", DialogueGraph.EndNode)),
                Say("ready", who,
                    "Có lệnh rồi à? Động cơ đã nóng. Lên buồng lái, nhấn E là cất cánh.",
                    Go("Cảm ơn anh Bảy.", DialogueGraph.EndNode)),
                Say("parts", who,
                    "Ổn, nhưng kho phụ tùng sắp cạn. Về sau tôi sẽ nhờ cậu tìm ít bu-gi với dây cáp.",
                    Go("Cứ gọi tôi.", DialogueGraph.EndNode)));
        }

        private static DialogueGraph Medic()
        {
            const string who = "medic";
            return new DialogueGraph(who,
                Say("start", who,
                    "Trúng đạn thì về đây, nhưng tốt nhất là đừng trúng.",
                    Go("Trạm có thiếu gì không?", "supplies"),
                    Go("Tôi sẽ cẩn thận.", DialogueGraph.EndNode)),
                Say("supplies", who,
                    "Thiếu băng gạc và thuốc sốt rét. Về sau có chuyến chở thuốc, tôi sẽ báo cậu.",
                    Go("Hẹn chị.", DialogueGraph.EndNode)));
        }

        private static DialogueGraph Officer()
        {
            const string who = "officer";
            return new DialogueGraph(who,
                Route("start",
                    When("completed>0", "veteran"),
                    Otherwise("rookie")),
                Say("rookie", who,
                    "Phi đội cần những phi công đọc điện nhanh. Học cho tốt. Giáo sư Whitmore đang chờ cậu ở trường huấn luyện.",
                    Go("Rõ, thưa Đại tá!", DialogueGraph.EndNode)),
                Say("veteran", who,
                    "Tôi nghe nói cậu đã bay {completed} chuyến. Cứ giữ phong độ, sắp tới sẽ có nhiệm vụ thật dành cho cậu.",
                    Go("Sẵn sàng, thưa Đại tá!", DialogueGraph.EndNode)));
        }
    }
}

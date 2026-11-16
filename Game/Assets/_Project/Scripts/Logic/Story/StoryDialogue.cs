using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Builders for story dialogue graphs. A line node has one choice without Text (click/Enter to continue);
    // Act0Content.IsContinueOnly tells the view to treat it that way. Speaker "" is narration or text on an object.
    internal static class StoryDialogue
    {
        // Linear graph: nodes start, n1, n2... in order; the last one closes the dialogue.
        public static DialogueGraph Lines(string id, params (string speaker, string text)[] lines)
        {
            var nodes = new List<DialogueNode>();
            for (int i = 0; i < lines.Length; i++)
                nodes.Add(Line(Name(i), lines[i].speaker, lines[i].text, i + 1 < lines.Length ? Name(i + 1) : null));
            return new DialogueGraph(id, nodes.ToArray());
        }

        public static string Name(int index) => index == 0 ? DialogueGraph.StartNode : "n" + index;

        public static DialogueNode Line(string id, string speaker, string text, string next) =>
            new DialogueNode { Id = id, Speaker = speaker, Text = text, Choices = new[] { new DialogueChoice { Next = next } } };

        // Node that asks the player to choose.
        public static DialogueNode Ask(string id, string speaker, string text, params DialogueChoice[] choices) =>
            new DialogueNode { Id = id, Speaker = speaker, Text = text, Choices = choices };

        public static DialogueChoice Pick(string text, string next, string action = null) =>
            new DialogueChoice { Text = text, Next = next, Action = action };
    }
}

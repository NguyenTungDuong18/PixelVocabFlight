using System.Collections.Generic;

namespace PixelVocabFlight
{
    public enum StoryBeatKind { Text, Cut, Map, Vista, Dialogue, End }

    // An object the player can examine in a beat. Map beats: Id is the "story:<id>" tag of a placement (X..H stay 0).
    // Vista beats: X, Y, W, H is the hit box in pixels of the 480x270 picture. Dialogue is a graph id or null.
    // Cut is a close-up sprite shown behind the dialogue while it is open (null = none).
    public sealed class StoryHotspot
    {
        public string Id, Label, Dialogue, Cut;
        public int X, Y, W, H;
    }

    // One frame of the script (a row of the story table). See Act0Content for the data.
    //   Text      black screen with Lines (TextStyle "ink" draws sprite Sprite instead, "type" types the characters).
    //   Cut       Sprite + animated Layers, Lines as the caption (TextStyle "plain" = box without name or portrait).
    //   Map       walkable Map (same Map id as the previous beat = keep the world), Hotspots are the usable objects.
    //   Vista     Sprite + Layers, the player picks a Hotspot.
    //   Dialogue  Dialogue graph opens at once and the beat ends when it closes. Map != null: drawn over that map;
    //             Sprite != null: drawn over that picture (+ Layers).
    //   End       closing card with Lines.
    // Seconds > 0: the beat ends by itself after that many seconds. Otherwise it ends by Dialogue, Required or Exit.
    public sealed class StoryBeat
    {
        public string Id;
        public StoryBeatKind Kind;
        public float Seconds;
        public string Sprite;
        public string[] Layers;
        public string[] Lines;
        public string TextStyle;
        public string[] Sounds;
        public string Map;
        public string Dialogue;
        public StoryHotspot[] Hotspots;
        public string[] Required;
        public string Exit;
        public string Hint;
        public bool LockPlayer;
    }

    // A numbered, named part of the script the player can start from (see Act0Content.Segments).
    // Number is shown to the player ("0.2"), Title is the name, FirstBeatId is where the segment begins.
    public sealed class StorySegment
    {
        public string Id, Number, Title, FirstBeatId;
    }

    // What the view saves: the first beat of the current segment plus a copy of the flags.
    public sealed class StorySnapshot
    {
        public string BeatId;
        public Dictionary<string, int> Flags = new Dictionary<string, int>();
    }

    // BeatStarted: Beat. Toast: Text. Finished: the script is over.
    // SegmentStarted: Segment and Beat (the first beat of the segment), sent right after that beat's BeatStarted; a good time to save.
    public enum StoryEventKind { BeatStarted, Toast, Finished, SegmentStarted }

    public sealed class StoryEvent
    {
        public StoryEventKind Kind;
        public string Text;
        public StoryBeat Beat;
        public StorySegment Segment;
    }
}

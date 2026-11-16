using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Walks the script. The view reports what the player did and reads Current:
    //  - Seconds > 0: the view counts the time and calls Advance().
    //  - Interact(id): the player used an object/hotspot; open the returned dialogue graph (if any) and call
    //    DialogueClosed() when it closes.
    //  - Kind Dialogue (or Map/Vista with Dialogue) opens beat.Dialogue by itself; call DialogueClosed() when it closes.
    // Rules for leaving a beat (Seconds == 0):
    //  - Exit set: Interact(Exit) leaves once every Required id has been seen (after its dialogue closes).
    //  - Exit null and Required set: the beat ends when the last Required object has been seen and its dialogue closed.
    //  - Exit null, Required empty, Dialogue set: the beat ends when that dialogue closes.
    // Seen ids are per beat; an object is usable only if it is one of the beat's Hotspots (or its Exit).
    public sealed class StoryRunner
    {
        public const string ExitLockedToast = "Còn vài thứ cần xem trước đã.";

        private readonly IReadOnlyList<StoryBeat> script;
        private readonly HashSet<string> seen = new HashSet<string>();
        private readonly Queue<StoryEvent> events = new Queue<StoryEvent>();
        private bool objectDialogue, exitPending;

        // segmentOf[i] = index into segments of the segment that beat i belongs to (-1 before the first segment).
        private readonly IReadOnlyList<StorySegment> segments;
        private readonly int[] segmentOf;

        // segments null: Act0Content.Segments (entries whose FirstBeatId is not in the script are ignored).
        public StoryRunner(IReadOnlyList<StoryBeat> script, StoryFlags flags, IReadOnlyList<StorySegment> segments = null)
        {
            this.script = script ?? throw new ArgumentNullException(nameof(script));
            Flags = flags ?? throw new ArgumentNullException(nameof(flags));
            this.segments = segments ?? Act0Content.Segments;
            segmentOf = new int[script.Count];
            int current = -1;
            for (int i = 0; i < script.Count; i++)
            {
                for (int s = 0; s < this.segments.Count; s++) if (this.segments[s].FirstBeatId == script[i].Id) current = s;
                segmentOf[i] = current;
            }
            if (script.Count == 0) { Finished = true; events.Enqueue(new StoryEvent { Kind = StoryEventKind.Finished }); }
            else Start();
        }

        public StoryFlags Flags { get; }
        public int Index { get; private set; }
        public bool Finished { get; private set; }
        public StoryBeat Current => Finished ? null : script[Index];

        // The segment holding the current beat (the last one's after the end); null when the script has no segments.
        public StorySegment Segment
        {
            get
            {
                if (script.Count == 0) return null;
                int s = segmentOf[Math.Min(Index, script.Count - 1)];
                return s < 0 ? null : segments[s];
            }
        }

        // Jumps to any beat: forgets what was seen, drops queued events and announces the beat. Unknown id: the first beat.
        public void JumpTo(string beatId)
        {
            if (script.Count == 0) return;
            int target = 0;
            for (int i = 0; i < script.Count; i++) if (script[i].Id == beatId) { target = i; break; }
            events.Clear();
            Finished = false;
            Index = target;
            Start();
        }

        // First beat of the current segment (the first beat of the script outside any segment) and a copy of the flags.
        public StorySnapshot Snapshot()
        {
            var snap = new StorySnapshot { BeatId = Segment?.FirstBeatId ?? (script.Count > 0 ? script[0].Id : null) };
            foreach (var pair in Flags.All) snap.Flags[pair.Key] = pair.Value;
            return snap;
        }

        // Sets the flags to the snapshot's, then jumps to its beat (unknown BeatId: the first beat).
        public void Restore(StorySnapshot snapshot)
        {
            if (snapshot == null) return;
            Flags.Clear();
            if (snapshot.Flags != null) foreach (var pair in snapshot.Flags) Flags.Set(pair.Key, pair.Value);
            JumpTo(snapshot.BeatId);
        }

        // Every Required id of the current beat has been seen.
        public bool CanExit
        {
            get
            {
                var beat = Current;
                if (beat?.Required == null) return true;
                foreach (var id in beat.Required) if (!seen.Contains(id)) return false;
                return true;
            }
        }

        public bool Seen(string id) => seen.Contains(id);

        // Can the player use this object right now? (Feed BaseWorld.StoryActive with it.)
        public bool Active(string id) => Hotspot(id) != null || (id != null && id == Current?.Exit);

        // Close-up sprite shown behind the dialogue of a hotspot, or null.
        public string CutFor(string id) => Hotspot(id)?.Cut;

        public void Advance()
        {
            if (Finished) return;
            Index++;
            if (Index >= script.Count)
            {
                Finished = true;
                seen.Clear(); objectDialogue = exitPending = false;
                events.Enqueue(new StoryEvent { Kind = StoryEventKind.Finished });
                return;
            }
            Start();
        }

        // Marks the object as seen and returns the dialogue graph id to open (null: nothing to open).
        public string Interact(string id)
        {
            var beat = Current;
            if (beat == null || id == null) return null;
            var hotspot = Hotspot(id);
            bool exit = id == beat.Exit;
            if (hotspot == null && !exit) return null;
            if (exit && !CanExit)
            {
                events.Enqueue(new StoryEvent { Kind = StoryEventKind.Toast, Text = ExitLockedToast });
                return null;
            }
            seen.Add(id);
            string graph = hotspot?.Dialogue;
            if (graph != null)
            {
                objectDialogue = true;
                exitPending = exit;
                return graph;
            }
            if (exit) Advance();
            else AdvanceIfDone(beat);
            return null;
        }

        // The view reports that the dialogue it opened (an object's or the beat's own) has closed.
        public void DialogueClosed()
        {
            var beat = Current;
            if (beat == null) return;
            if (beat.Kind == StoryBeatKind.Dialogue) { Advance(); return; }
            if (objectDialogue)
            {
                objectDialogue = false;
                if (exitPending) { exitPending = false; Advance(); }
                else AdvanceIfDone(beat);
                return;
            }
            if (beat.Dialogue != null && beat.Exit == null && beat.Seconds <= 0 && CanExit) Advance();
        }

        public bool PopEvent(out StoryEvent e)
        {
            if (events.Count == 0) { e = null; return false; }
            e = events.Dequeue();
            return true;
        }

        private void Start()
        {
            seen.Clear(); objectDialogue = exitPending = false;
            var beat = script[Index];
            events.Enqueue(new StoryEvent { Kind = StoryEventKind.BeatStarted, Beat = beat });
            var segment = Segment;
            if (segment != null && segment.FirstBeatId == beat.Id) events.Enqueue(new StoryEvent { Kind = StoryEventKind.SegmentStarted, Beat = beat, Segment = segment });
        }

        // Exit null + Required set: finishing the last required object ends the beat.
        private void AdvanceIfDone(StoryBeat beat)
        {
            if (beat.Exit == null && beat.Seconds <= 0 && beat.Required != null && beat.Required.Length > 0 && CanExit) Advance();
        }

        private StoryHotspot Hotspot(string id)
        {
            var hotspots = Current?.Hotspots;
            if (hotspots == null || id == null) return null;
            foreach (var h in hotspots) if (h.Id == id) return h;
            return null;
        }
    }
}

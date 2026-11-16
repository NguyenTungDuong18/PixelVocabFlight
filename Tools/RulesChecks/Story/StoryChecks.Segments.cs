using PixelVocabFlight;

// Numbered segments: data, jumping into each one, snapshot / restore.
internal static partial class StoryChecks
{
    private static void CheckSegments()
    {
        var segs = Act0Content.Segments;
        var script = Act0Content.Script;
        Check(segs.Select(s => (s.Id, s.Number, s.Title, s.FirstBeatId)).SequenceEqual(new[]
        {
            ("open", "0.1", "Cảnh mở", "open.P1.01"),
            ("m1_dorm", "0.2", "M1 · Đêm 9/5 · Phòng nội trú", "m1.P1.01"),
            ("m1_roof", "0.3", "M1 · Đêm 9/5 · Trên mái nhà", "m1.P1.13"),
        }), "segment table: id, number, title, first beat");
        var starts = segs.Select(s => script.ToList().FindIndex(b => b.Id == s.FirstBeatId)).ToArray();
        Check(starts[0] == 0 && starts.Zip(starts.Skip(1), (a, b) => a >= 0 && a < b).All(ok => ok), "segments start at the first beat and follow script order");

        // Segment follows the beat index.
        var runner = new StoryRunner(script, new StoryFlags());
        for (int i = 0; i < script.Count; i++)
        {
            runner.JumpTo(script[i].Id);
            int expected = starts.Count(s => s <= i) - 1;
            Check(runner.Index == i && runner.Segment == segs[expected], "segment of beat " + script[i].Id + " is " + segs[expected].Id);
        }

        // Every segment plays to the end when jumped into, on both branches of both choices.
        for (int s = 0; s < segs.Count; s++)
            foreach (int tone in new[] { 0, 1 })
                foreach (int story in new[] { 0, 1 })
                {
                    string where = segs[s].Id + " (tone " + tone + ", story " + story + ")";
                    var (flags, played) = Play(tone, story, segs[s].FirstBeatId);
                    Check(played.Finished && played.Current == null, "jump into " + where + " reaches Finished");
                    Check(Visited.SequenceEqual(ExpectedIds.Skip(starts[s])), "jump into " + where + " visits every later beat once, in order");
                    Check(SegmentsStarted.SequenceEqual(segs.Skip(s).Select(x => x.Id)), "SegmentStarted once per segment entered from " + where);
                    bool pride = s <= 1;   // the tone choice (P1.10) lives in M1 dorm
                    Check(pride ? flags.Get(Act0Content.PrideFlag) == (tone == 0 ? 1 : -1) : flags.All.Count == 0, "flags after " + where);
                    Check(played.Segment == segs[^1], "after the end the segment stays the last one");
                }
        Play(0, 0);
        Check(SegmentsStarted.SequenceEqual(segs.Select(x => x.Id)), "SegmentStarted fires exactly 3 times when played from the start");

        // Jumping into the middle of a segment announces only the beat; unknown ids go to the first beat; Seen is forgotten.
        var mid = new StoryRunner(script, new StoryFlags());
        mid.JumpTo("m1.P1.03");
        Check(mid.PopEvent(out var e) && e.Kind == StoryEventKind.BeatStarted && e.Beat.Id == "m1.P1.03" && !mid.PopEvent(out _), "jump mid-segment sends one BeatStarted and drops older events");
        mid.Interact("poster_airline");
        Check(mid.Seen("poster_airline"), "object seen");
        mid.JumpTo("m1.P1.03");
        Check(!mid.Seen("poster_airline") && mid.Index == 7 + 2, "jump forgets what was seen");
        mid.JumpTo("no.such.beat");
        Check(mid.Index == 0 && !mid.Finished && mid.Segment == segs[0], "unknown beat id jumps to the first beat");
        mid.JumpTo("end"); mid.Advance();
        Check(mid.Finished, "reached the end");
        mid.JumpTo("m1.P1.13");
        Check(!mid.Finished && mid.Current.Id == "m1.P1.13" && mid.PopEvent(out e) && e.Kind == StoryEventKind.BeatStarted && mid.PopEvent(out e) && e.Kind == StoryEventKind.SegmentStarted && e.Segment == segs[2] && !mid.PopEvent(out _), "jump after the end revives the runner (no stale Finished event)");

        // Snapshot: first beat of the current segment + a copy of the flags.
        var f1 = new StoryFlags();
        var a = new StoryRunner(script, f1);
        a.JumpTo("m1.P1.08");
        f1.Set("pride", 1); f1.Set("extra", 7);
        var snap = a.Snapshot();
        Check(snap.BeatId == "m1.P1.01" && snap.Flags.Count == 2 && snap.Flags["pride"] == 1 && snap.Flags["extra"] == 7, "snapshot = segment start + flags");
        f1.Set("pride", -1);
        Check(snap.Flags["pride"] == 1, "snapshot flags are a copy");
        a.JumpTo("m1.P1.14");
        Check(a.Snapshot().BeatId == "m1.P1.13", "snapshot in the roof segment starts at P1.13");
        a.JumpTo("open.P1.04");
        Check(a.Snapshot().BeatId == "open.P1.01", "snapshot in the opening starts at its first beat");

        // Restore: flags replaced (not merged), back at the segment start, SegmentStarted announced.
        var f2 = new StoryFlags();
        f2.Set("junk", 9); f2.Set("pride", 5);
        var b = new StoryRunner(script, f2);
        b.JumpTo("m1.P1.16");
        b.Restore(snap);
        Check(f2.All.Count == 2 && f2.Get("pride") == 1 && f2.Get("extra") == 7 && f2.Get("junk") == 0, "restore replaces the flags");
        Check(b.Current.Id == "m1.P1.01" && b.Segment == segs[1] && !b.Finished, "restore returns to the start of the segment");
        Check(b.PopEvent(out e) && e.Kind == StoryEventKind.BeatStarted && e.Beat.Id == "m1.P1.01" && b.PopEvent(out e) && e.Kind == StoryEventKind.SegmentStarted && e.Segment == segs[1] && !b.PopEvent(out _), "restore announces the beat and the segment once");
        b.Restore(new StorySnapshot { BeatId = "nonsense", Flags = new Dictionary<string, int> { ["only"] = 1 } });
        Check(b.Index == 0 && f2.All.Count == 1 && f2.Get("only") == 1, "unknown snapshot beat restores to the first beat");
        b.Restore(new StorySnapshot { BeatId = null, Flags = null });
        Check(b.Index == 0 && f2.All.Count == 0, "empty snapshot restores to the first beat with no flags");
        int before = b.Index;
        b.Restore(null);
        Check(b.Index == before, "null snapshot is ignored");
        var c = new StoryRunner(script, new StoryFlags());
        c.Restore(a.Snapshot());
        Check(c.Segment == segs[0] && c.Current.Id == "open.P1.01", "restore of an opening snapshot");

        // A script without segments: no Segment, snapshot starts at the first beat.
        var plain = new StoryRunner(new[] { new StoryBeat { Id = "x", Kind = StoryBeatKind.End }, new StoryBeat { Id = "y", Kind = StoryBeatKind.End } }, new StoryFlags());
        plain.Advance();
        Check(plain.Segment == null && plain.Snapshot().BeatId == "x" && plain.PopEvent(out e) && e.Kind == StoryEventKind.BeatStarted, "no segments: Segment null, snapshot at the first beat");
        Check(new StoryRunner(new StoryBeat[0], new StoryFlags()).Segment == null && new StoryRunner(new StoryBeat[0], new StoryFlags()).Snapshot().BeatId == null, "empty script has no segment");
    }
}

namespace MusicForge;

public sealed partial class Score
{
    // C, bars 25-32 (mp -> f): the build. A descending bass G-F-Eb-D-C-Bb to a dominant F pedal (of Bb, the key of D); trumpet bugle
    // calls answered by horns; violin tremolo crescendo; snare and timpani rolls into the climax.
    void SectionC()
    {
        var prog = Prog(25, "Gm Gm/F Eb Eb/D Cm Gm/Bb F F");
        var d = new Dyn((25, 62), (29, 76), (31, 92), (33, 112));
        Pad("vlnTrem", prog, 67, 84, 3, d);
        Pad("vlaTrem", prog, 55, 69, 2, d);
        Line("vc", 25, "G3:4 | F3:4 | Eb3:4 | D3:4 | C3:4 | Bb2:4 | F2:4 | F2:4", d);
        Line("cb", 25, "G2:4 | F2:4 | Eb2:4 | D2:4 | C2:4 | Bb1:4 | F1:4 | F1:4", d);
        Line("tpt", 25, "r:1 G4:.5s Bb4:.5s D5:2 | r:4 | r:1 G4:.5s Bb4:.5s Eb5:2 | r:4 | C5:1 Eb5:.5s C5:.5s G5:2 | F5:1 Eb5:.5 D5:.5 Bb4:2 | A4+C5:4 | C5+F5:4",
            new Dyn((25, 72), (29, 84), (31, 96), (33, 116)), stac: "tptStac");
        Line("hn", 25, "r:4 | r:1 D4:.5s C4:.5s Bb3:2 | r:4 | r:1 Eb4:.5s D4:.5s Bb3:2", new Dyn((25, 68), (29, 76)), stac: "hnStac");
        var brass = Prog(29, "Cm Gm/Bb F F");
        Pad("hn", brass, 53, 64, 3, new Dyn((29, 74), (31, 90), (33, 112)));
        Pad("tbn", brass, 41, 58, 3, new Dyn((29, 70), (31, 88), (33, 112)));
        Bass("tba", brass, 29, 41, new Dyn((29, 70), (33, 110)));
        for (int bar = 25; bar <= 30; bar++) Snare(bar, bar == 28 ? MarchRoll : March, new Dyn((25, 58), (31, 74)));
        Roll("snareRoll", B(31), 8, 39, 62, 118);
        Kick(25, 30, new[] { 1.0, 3.0 }, new Dyn((25, 64), (31, 80)));
        Kick(31, 32, new[] { 1.0, 2.0, 3.0, 4.0 }, new Dyn((31, 72), (33, 104)));
        TimpOnChords(Prog(25, "Gm Gm/F Eb Eb/D Cm Gm/Bb"), new[] { 0.0 }, new Dyn((25, 72), (31, 88)));
        Roll("timpRoll", B(31), 8, Pitch.Parse("F2"), 60, 120);
        Swell(B(33), 112, 50);
    }
}

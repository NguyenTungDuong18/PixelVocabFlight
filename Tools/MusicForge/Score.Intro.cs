namespace MusicForge;

public sealed partial class Score
{
    // Intro, 4 bars (9.6 s), played once. Sample 0 = the logo: a tutti G-minor hit, then the head of the theme in trumpets, the answer in
    // horns over Eb, and a dominant (D) bar with a timpani roll that hands over to section A of the loop.
    void IntroHit()
    {
        void X(string inst, int key, double v0, double v1, double len = 4) { var n = Add(inst, 0, len, key, v0, v1); n.Exact = true; }
        // The hit (all on sample 0).
        X("tba", Pitch.Parse("G1"), Ff, Mf);
        foreach (var k in new[] { "G2", "D3", "G3" }) X("tbn", Pitch.Parse(k), Ff, Mf);
        foreach (var k in new[] { "G3", "Bb3", "D4" }) X("hn", Pitch.Parse(k), Ff, Mf);
        foreach (var k in new[] { "G4", "D5" }) X("tpt", Pitch.Parse(k), Ff, Mp, 3);
        foreach (var k in new[] { "Bb2", "D3", "G3" }) X("vcSpic", Pitch.Parse(k), Fff, Fff);
        X("timp", Pitch.Parse("G2"), Fff, Fff); X("bd", 36, Fff, Fff); X("crash", 49, Ff + 5, Ff); X("gong", 46, F, F);
        X("cbPizz", Pitch.Parse("G1"), Fff, Fff);

        var prog = Prog(1, "Gm Gm Eb D");
        var trem = new Dyn((1, Ff + 4), (1.4, 84), (2, 66), (3, 52), (4, 52), (4.75, 104));
        Pad("vlnTrem", prog, 67, 81, 3, trem);
        Pad("vlaTrem", prog, 55, 67, 2, trem);
        Bass("vcTrem", prog, 43, 54, trem); Bass("cb", prog, 31, 43, new Dyn((1, Ff), (2, 60), (4, 52), (4.75, 100)));
        foreach (var n in Notes.Where(n => n.Beat == 0)) n.Exact = true;

        // Bar 2: the head of the theme (trumpets); bar 3: the answer (horns) over Eb, with the bell.
        Line("tpt", 2, "D4:1.5 G4:.5 Bb4:2", new Dyn((2, Mf), (3, F - 6)));
        Line("hn", 3, "G3:1.5 Bb3:.5 Eb4:2", new Dyn((3, Mf - 4), (4, Mp)));
        Hit("bells", B(3), Pitch.Parse("G4"), Mp);
        Figure("harp", Prog(2, "Gm"), 43, new[] { 0, 2, 10, 11, 12, 20, 21, 22, 30, 22, 21, 20, 12, 11, 10, 2 }, .25, new Dyn((2, P), (3, Mp)), new double[] { 6, 0, 0, 0 });
        // Bar 4: D major swells like the end of the loop (bar 88). Render.Run crossfades the intro, during beat 2 of this bar, into the
        // loop's own last 3 beats (the stab on beat 3 and the breath on beat 4), so intro -> loop joins exactly like loop -> loop.
        var swell = new Dyn((4, Mp), (4.75, Ff));
        foreach (var k in new[] { "D3", "F#3", "A3" }) Add("hn", B(4), 3, Pitch.Parse(k), swell.At(B(4)), swell.At(B(4, 4)));
        foreach (var k in new[] { "D2", "A2" }) Add("tbn", B(4), 3, Pitch.Parse(k), swell.At(B(4)), swell.At(B(4, 4)));
        Roll("timpRoll", B(4), 3, Pitch.Parse("D3"), Mp, Ff);
        Roll("snareRoll", B(4, 2), 2, 39, Mp, Ff);
        Figure("harp", Prog(4, "D"), 50, new[] { 0, 1, 2, 10, 11, 12, 20, 21 }, .25, new Dyn((4, Mp), (4.5, Mf)), new double[] { 4, 0 });
    }
}

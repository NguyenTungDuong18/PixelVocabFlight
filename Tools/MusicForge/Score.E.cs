namespace MusicForge;

public sealed partial class Score
{
    // E, bars 49-64 (pp -> mp): the calm. No snare. A trio tune in violins over harp arpeggios and a horn counter-line, then a solo
    // trumpet takes it while the violins float a high descant. Bars 63-64: horns, trombones and a timpani roll swell into F.
    void SectionE()
    {
        var prog = Prog(49, LyricHarmony + " " + LyricHarmony);
        var d = new Dyn((49, 50), (53, 54), (57, 58), (61, 62), (63, 64), (64, 66));
        Line("vln", 49, Lyric, new Dyn((49, 62), (53, 68), (56, 64)));
        Line("tptSolo", 57, Lyric, new Dyn((57, 62), (61, 70), (64, 66)));
        Line("vln", 57, "G5:4 | F5:4 | Eb5:4 | F5:4 | D5:4 | G5:4 | Eb5:4 | F5:2 D5:2", new Dyn((57, 30), (61, 36), (64, 42)));
        Line("hn", 49, "G3:4 | F3:4 | G3:2 Bb3:2 | A3:4 | G3:2 D4:2 | Bb3:4 | C4:2 Eb4:2 | D4:4", new Dyn((49, 52), (56, 60)));
        Pad("hn", Prog(57, "Eb Bb/D Cm7 F Gm Eb Ab"), 50, 62, 2, new Dyn((57, 34), (63, 46)));
        Pad("vla", prog, 51, 65, 2, d);
        Bass("vc", prog, 36, 50, d);
        Bass("cb", prog, 28, 40, new Dyn((49, Pp), (63, 44)));
        Figure("harp", prog, 41, new[] { 0, 2, 10, 11, 12, 20, 12, 11 }, .5, new Dyn((49, 46), (57, 50), (64, 56)), new double[] { 6, 0, 0, 2, 0, 0, 0, 0 });
        foreach (var (bar, note) in new[] { (49, "G4"), (53, "D5"), (57, "G4"), (61, "D5") }) Hit("bells", B(bar), Pitch.Parse(note), 44);
        Roll("timpRoll", B(56), 4, Pitch.Parse("Bb2"), 26, 40);
        // Lift into F.
        var lift = new Dyn((64, 54), (65, 104));
        Pad("hn", Prog(64, "Bb"), 50, 64, 3, lift);
        Pad("tbn", Prog(64, "Bb"), 41, 58, 3, lift);
        Add("tba", B(64), 4, Pitch.Parse("Bb1"), 50, 100);
        Roll("timpRoll", B(64), 4, Pitch.Parse("Bb2"), 40, 112);
        Swell(B(65), 110, 48);
    }
}

namespace MusicForge;

public sealed partial class Score
{
    // B, bars 9-24 (mf -> f): the march. Horns in unison sing the whole theme; violins take over the spiccato ostinato; violas and
    // cellos answer with a slow counter-line; light snare and bass drum. Bars 17-24: trumpets join the horns, trombones and tuba enter.
    void SectionB()
    {
        var prog = Prog(9, ThemeMinorHarmony + " " + ThemeMinorHarmony);
        var d1 = new Dyn((9, 78), (16, 84), (17, 86), (24, 94), (25, 92));
        Line("hn", 9, ThemeMinor, d1, -12);
        Line("hn", 17, ThemeMinor, d1, -12);
        Line("tpt", 17, ThemeMinor, new Dyn((17, 76), (24, 86)));
        Figure("vlnSpic", prog, Pitch.Parse("G4"), Ostinato, .5, new Dyn((9, 64), (17, 70), (25, 76)), OstinatoAccents);
        const string viola = "Bb3:4 | Bb3:2 C4:2 | Eb4:2 D4:2 | D4:2 C4:2 | Bb3:4 | Bb3:2 G3:2 | G3:2 F#3:2 | G3:4";
        const string cello = "G2:2 F2:2 | Eb2:2 D2:2 | C2:2 D2:2 | D2:4 | G2:2 F2:2 | Eb2:2 C2:2 | C2:2 D2:2 | G2:4";
        var ds = new Dyn((9, 64), (17, 72), (25, 80));
        Line("vla", 9, viola, ds); Line("vla", 17, viola, ds);
        Line("vc", 9, cello, ds); Line("vc", 17, cello, ds);
        Bass("cbPizz", Prog(9, ThemeMinorHarmony), Pitch.Parse("G1"), Pitch.Parse("F#2"), d1, hits: new[] { 0.0, 2.0 });
        Bass("cb", Prog(17, ThemeMinorHarmony), Pitch.Parse("G1"), Pitch.Parse("F#2"), new Dyn((17, 66), (25, 78)));
        Pad("tbn", Prog(17, ThemeMinorHarmony), 43, 60, 3, new Dyn((17, 60), (25, 74)));
        Bass("tba", Prog(17, ThemeMinorHarmony), 31, 43, new Dyn((17, 58), (25, 72)));
        var ds2 = new Dyn((9, 56), (17, 62), (24, 72));
        for (int bar = 9; bar <= 24; bar++) Snare(bar, bar < 17 ? (bar == 16 ? MarchRoll : MarchLight) : (bar % 4 == 0 ? MarchRoll : March), ds2);
        Kick(9, 24, new[] { 1.0, 3.0 }, new Dyn((9, 60), (25, 74)));
        TimpOnChords(Prog(9, ThemeMinorHarmony + " " + ThemeMinorHarmony), new[] { 0.0 }, new Dyn((9, 66), (25, 78)));
        Swell(B(25), 72, 48);
    }
}

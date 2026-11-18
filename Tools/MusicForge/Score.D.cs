namespace MusicForge;

public sealed partial class Score
{
    // D, bars 33-48 (f -> ff -> p): first climax. The theme turns major (Bb): trumpets + violins in unison, violas an octave below,
    // horns and trombones in chords, tuba and basses. Bars 41-48: the second strain; from bar 45 everything thins out to p.
    void SectionD()
    {
        var p1 = Prog(33, ThemeMajorHarmony); var p2 = Prog(41, "Eb Bb/D Cm Gm Eb F/A Bb/D F");
        var d = new Dyn((33, 104), (40, 112), (41, 116), (44.5, 114), (46, 80), (48, 50), (49, 42));
        Line("tpt", 33, ThemeMajor, d);
        Line("tpt", 41, "G5:2 F5:1 Eb5:1 | F5:1.5 D5:.5 Bb4:2 | Eb5:2 D5:1 C5:1 | D5:3 Bb4:1", d);
        Line("vln", 33, ThemeMajor, d, gainDb: 2);
        Line("vln", 41, StrainTwo, d, gainDb: 2);
        Line("vla", 33, ThemeMajor, d, -12);
        Line("vla", 41, StrainTwo, d, -12);
        var all = p1.Concat(p2).ToList();
        Pad("hn", all, 50, 64, 3, d);
        Pad("tbn", Prog(33, ThemeMajorHarmony + " Eb Bb/D Cm Gm"), 41, 60, 3, d);
        Bass("tba", Prog(33, ThemeMajorHarmony + " Eb Bb/D Cm Gm"), 29, 41, d);
        Bass("vc", all, 41, 52, d);
        Bass("cb", all, 29, 40, d);
        for (int bar = 33; bar <= 44; bar++) Snare(bar, bar == 40 || bar == 44 ? MarchRoll : March, new Dyn((33, 84), (41, 92), (45, 86)));
        Kick(33, 44, new[] { 1.0, 3.0 }, new Dyn((33, 90), (45, 96)));
        TimpOnChords(Prog(33, ThemeMajorHarmony + " Eb Bb/D Cm Gm"), new[] { 0.0, 2.0 }, new Dyn((33, 92), (45, 100)), 8);
        Hit("crash", B(33), 49, 112); Hit("crash", B(41), 49, 108);
        Hit("susCym", B(37), 51, 84);
    }
}

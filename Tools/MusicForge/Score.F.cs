namespace MusicForge;

public sealed partial class Score
{
    // F, bars 65-80 (f -> ff -> fff): final climax, a step higher in C major. Tutti: trumpets + violins on the theme, violas an octave
    // below, horns/trombones in chords, full snare, bass drum on every beat, crashes at 65/69/73/77.
    const string FinalStrain =
        "A5:2 G5:1 F5:1 | G5:1.5 E5:.5 C5:2 | F5:2 E5:1 D5:1 | E5:3 C5:1 | F5:2 A5:2 | G5:3 E5:1 | F5:1.5 E5:.5 D5:2 | D5:2 B4:1 D5:1";

    void SectionF()
    {
        var h1 = "C F Dm,G G C F Dm7,G C"; var h2 = "F C/E Dm Am F Em Dm7 G";
        var all = Prog(65, h1 + " " + h2);
        var d = new Dyn((65, 102), (72, 112), (73, 114), (80, 124), (81, 124));
        Line("tpt", 65, ThemeMajor, d, 2);
        Line("tpt", 73, FinalStrain, d);
        Line("vln", 65, ThemeMajor, d, 2, gainDb: 2);
        Line("vln", 73, FinalStrain, d, gainDb: 2);
        Line("vla", 65, ThemeMajor, d, 2 - 12);
        Line("vla", 73, FinalStrain, d, -12);
        Pad("hn", all, 52, 64, 3, d);
        Pad("tbn", all, 41, 60, 3, d);
        Bass("tba", all, 29, 41, d);
        Bass("vc", all, 41, 52, d);
        Bass("cb", all, 29, 40, d);
        for (int bar = 65; bar <= 80; bar++) Snare(bar, bar % 4 == 0 ? MarchRoll : March, new Dyn((65, 92), (73, 98), (81, 106)));
        Kick(65, 80, new[] { 1.0, 2.0, 3.0, 4.0 }, new Dyn((65, 88), (81, 104)));
        TimpOnChords(all, new[] { 0.0, 2.0 }, new Dyn((65, 98), (81, 112)), 8);
        foreach (int bar in new[] { 65, 69, 73, 77 }) Hit("crash", B(bar), 49, bar < 73 ? 112 : 122);
        Swell(B(81), 118, 48);
    }
}

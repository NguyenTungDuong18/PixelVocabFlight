namespace MusicForge;

public sealed partial class Score
{
    // G, bars 81-88 (ff -> cut): arrival on C, the motif climbs C - Eb - F, then four bars of D major (the dominant of G minor) swell
    // to a stab on bar 88 beat 3; beat 4 is the cut (only the reverb tail rings, and the circular render wraps it into bar 1: A, G minor).
    void SectionG()
    {
        var head = Prog(81, "C C Eb F");
        var d = new Dyn((81, 122), (84, 114), (85, 96), (88.5, 126));
        Line("tpt", 81, "C5+G5:4 | G4:1.5 C5:.5 E5:2 | Bb4:1.5 Eb5:.5 G5:2 | C5:1.5 F5:.5 A5:2", d);
        Line("vln", 81, "C5+G5:4 | G4:1.5 C5:.5 E5:2 | Bb4:1.5 Eb5:.5 G5:2 | C5:1.5 F5:.5 A5:2", d, gainDb: 1);
        Pad("vla", head, 55, 67, 2, d);
        Pad("hn", head, 52, 64, 3, d);
        Pad("tbn", head, 41, 60, 3, d);
        Bass("tba", head, 29, 41, d); Bass("vc", head, 41, 52, d); Bass("cb", head, 29, 40, d);
        for (int bar = 81; bar <= 84; bar++) Snare(bar, March, new Dyn((81, 104), (85, 96)));
        Kick(81, 84, new[] { 1.0, 3.0 }, d);
        TimpOnChords(head, new[] { 0.0, 2.0 }, d, 6);
        Hit("crash", B(81), 49, 124); Hit("gong", B(81), 46, 108);

        // D pedal: bars 85-88 to beat 3 (14 beats), crescendo, then the stab.
        double s = B(85), cut = B(88, 3), len = cut - s;
        var up = new Dyn((85, 92), (88.5, 124));
        void Hold(string inst, params string[] keys) { foreach (var k in keys) Add(inst, s, len, Pitch.Parse(k), up.At(s), up.At(cut)); }
        Hold("tpt", "A4", "D5"); Hold("hn", "D3", "F#3", "A3"); Hold("tbn", "D2", "A2", "D3"); Hold("tba", "D2");
        Hold("vlnTrem", "A4", "D5", "F#5"); Hold("vlaTrem", "D4", "A4"); Hold("vcTrem", "D2", "D3"); Hold("cbTrem", "D1");
        Roll("timpRoll", s, len, Pitch.Parse("D3"), 70, 124);
        Roll("snareRoll", B(87), cut - B(87), 39, 70, 120);
        Swell(cut, 120, 50);
        foreach (var k in new[] { "A4", "D5" }) Hit("tptStac", cut, Pitch.Parse(k), Fff);
        foreach (var k in new[] { "D3", "F#3", "A3" }) Hit("hnStac", cut, Pitch.Parse(k), Fff);
        foreach (var k in new[] { "D2", "A2", "D3" }) Hit("tbnStac", cut, Pitch.Parse(k), Fff);
        foreach (var k in new[] { "D5", "A5" }) Hit("vlnSpic", cut, Pitch.Parse(k), Fff);
        foreach (var k in new[] { "D3", "A3" }) Hit("vcSpic", cut, Pitch.Parse(k), Fff);
        Hit("cbPizz", cut, Pitch.Parse("D2"), Fff);
        Hit("timp", cut, Pitch.Parse("D3"), Fff); Hit("bd", cut, 36, Fff);
    }
}

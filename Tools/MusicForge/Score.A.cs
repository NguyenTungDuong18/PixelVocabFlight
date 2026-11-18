namespace MusicForge;

public sealed partial class Score
{
    // A, bars 1-8 (p -> mf): the engine starts. Spiccato ostinato in violas and cellos (violins join an octave up from bar 3), bass
    // pizzicato over a soft held bass, a timpani heartbeat, a high violin pedal; from bar 5 a solo horn states the question half of the theme.
    // Kept audible over the menu wind (in game: music x0.49, wind ~ -32 dBFS RMS), but under B.
    void SectionA()
    {
        var prog = Prog(1, "Gm Gm Eb D Gm Eb Cm,D D");
        var d = new Dyn((1, 58), (5, 66), (8, 74), (9, 76));
        Figure("vlaSpic", prog, Pitch.Parse("G3"), Ostinato, .5, d, OstinatoAccents);
        Figure("vcSpic", prog, Pitch.Parse("G2"), Ostinato, .5, new Dyn((1, 56), (5, 64), (9, 72)), OstinatoAccents);
        Figure("vlnSpic", Prog(3, "Eb D Gm Eb Cm,D D"), Pitch.Parse("G4"), Ostinato, .5, new Dyn((3, 44), (5, 52), (9, 62)), OstinatoAccents);
        Bass("cbPizz", prog, Pitch.Parse("G1"), Pitch.Parse("F#2"), d, hits: new[] { 0.0 });
        Bass("cb", prog, Pitch.Parse("G1"), Pitch.Parse("F#2"), new Dyn((1, 44), (5, 52), (9, 60)));
        foreach (var (beat, len, ch) in prog)
        {
            if (len < 4 && beat % 4 != 0) continue;
            Hit("timp", beat, Timp(ch), d.At(beat) + 6); Hit("timp", beat + .5, Timp(ch), d.At(beat) - 4);   // lub-dub
        }
        Add("vln", B(1), 16, Pitch.Parse("D5"), 50, 56);
        Pad("vln", Prog(5, "Gm Eb Cm,D D"), 67, 79, 2, new Dyn((5, 48), (8, 58)));
        Line("hnSolo", 5, "D3:1.5 G3:.5 Bb3:2 | G3:1.5 Bb3:.5 Eb4:2 | D4:.75 C4:.25 Bb3:1 A3:.75 G3:.25 A3:1 | Bb3:.5 A3:.5 F#3:2 r:1",
            new Dyn((5, 78), (7, 88), (8.5, 80)), gainDb: 3);
        Swell(B(9), 66, 47);
    }
}

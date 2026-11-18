namespace MusicForge;

// The WORDWING theme (original, written for this game) and the shared building blocks of the sections.
//
// Motif M1: a dotted rise of a fourth and a third, then a held note — "D. G Bb—" — answered a step higher on the sixth degree
// "G. Bb Eb—" (the Eb is the poignant minor sixth). Question phrase ends on the leading tone (F#), answer on the tonic.
// Heard: intro (head only), A (solo horn), B (horns, then horns + trumpets), D (major, in Bb), F (major, in C), G (head on C, Eb, F).
public sealed partial class Score
{
    // G minor, 8 bars. Harmony: Gm | Eb | Cm D | D | Gm | Eb | Cm D7 | Gm
    public const string ThemeMinor =
        "D4:1.5 G4:.5 Bb4:2 | G4:1.5 Bb4:.5 Eb5:2 | D5:.75 C5:.25 Bb4:1 A4:.75 G4:.25 A4:1 | Bb4:.5 A4:.5 F#4:2 r:1 | " +
        "D4:1.5 G4:.5 Bb4:2 | G4:1.5 Bb4:.5 Eb5:1.5 D5:.5 | C5:1.5 Bb4:.5 A4:1 F#4:1 | G4:3 r:1";
    public const string ThemeMinorHarmony = "Gm Eb Cm,D D Gm Eb Cm,D7 Gm";

    // Bb major, 8 bars (transpose +2 for C major). Harmony: Bb | Eb | Cm F | F | Bb | Eb | Cm7 F | Bb
    public const string ThemeMajor =
        "F4:1.5 Bb4:.5 D5:2 | Bb4:1.5 D5:.5 G5:2 | G5:.75 F5:.25 Eb5:1 C5:.75 Bb4:.25 C5:1 | D5:.5 C5:.5 A4:2 r:1 | " +
        "F4:1.5 Bb4:.5 D5:2 | Bb4:1.5 D5:.5 G5:1.5 F5:.5 | Eb5:1.5 D5:.5 C5:1 A4:1 | Bb4:3 r:1";
    public const string ThemeMajorHarmony = "Bb Eb Cm,F F Bb Eb Cm7,F Bb";

    // Second strain, Bb major: four bars that climb back down from the high G, then a falling close. Harmony: Eb Bb/D Cm Gm | Eb F/A Bb/D F
    public const string StrainTwo =
        "G5:2 F5:1 Eb5:1 | F5:1.5 D5:.5 Bb4:2 | Eb5:2 D5:1 C5:1 | D5:3 Bb4:1 | " +
        "C5:2 Bb4:1 G4:1 | A4:2 C5:2 | Bb4:2 F4:2 | A4:4";

    // Trio for the calm section E (Eb major colour, Ab = borrowed bVII of Bb). Harmony: Eb Bb/D Cm7 F | Gm Eb Ab Bb
    public const string Lyric =
        "Bb4:3 G4:1 | F4:2 Bb4:1 C5:1 | Eb5:3 D5:.5 C5:.5 | C5:2 A4:2 | Bb4:3 D5:1 | Eb5:2 D5:1 C5:1 | C5:3 Bb4:.5 Ab4:.5 | Bb4:4";
    public const string LyricHarmony = "Eb Bb/D Cm7 F Gm Eb Ab Bb";

    // Snare bars (16ths): march, march with a roll into the next bar, light march.
    public const string March = "F.gg A.x. x.gg A.x.", MarchRoll = "F.gg A.x. x.gg RRRR", MarchLight = "A... x.g. x... x.gx";

    static readonly int[] Ostinato = { 0, 2, 1, 2, 0, 2, 1, 2 };            // root-fifth-third-fifth in eighths
    static readonly double[] OstinatoAccents = { 12, -6, 0, 8, -6, 0, 6, -4 }; // 3+3+2 lilt

    // Timpani pitch for a chord: its bass note in the drums' good range (36-50), nearest the middle.
    static int Timp(Ch ch) => Enumerable.Range(38, 13).Where(k => k % 12 == ch.Bass).OrderBy(k => Math.Abs(k - 45)).First();

    void TimpOnChords(List<(double beat, double len, Ch ch)> prog, double[] beats, Dyn dyn, double accent = 0)
    {
        foreach (var (beat, len, ch) in prog) foreach (var b in beats) if (b < len) Hit("timp", beat + b, Timp(ch), dyn.At(beat + b) + (b == 0 ? accent : 0));
    }

    void Kick(int from, int to, double[] beats, Dyn dyn)
    {
        for (int bar = from; bar <= to; bar++) foreach (var b in beats) Hit("bd", B(bar, b), 36, dyn.At(B(bar, b)) + (b == 1 ? 6 : 0));
    }

    public static List<Note> Intro() { var s = new Score(); s.IntroHit(); return s.Notes; }

    public static List<Note> Loop()
    {
        var s = new Score();
        // A and B get a section gain on top of their dynamics: the quiet start must carry over the menu wind (velocity alone changes timbre more than level).
        s.Lift(s.SectionA, 6); s.Lift(s.SectionB, 2.5); s.SectionC(); s.SectionD(); s.SectionE(); s.SectionF(); s.SectionG();
        return s.Notes;
    }

    void Lift(Action section, double db) { int from = Notes.Count; section(); for (int i = from; i < Notes.Count; i++) Notes[i].GainDb += db; }
}

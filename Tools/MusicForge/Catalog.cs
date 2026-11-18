namespace MusicForge;

public enum Bus { Strings, Brass, Perc, Color }

// How one instrument of the orchestra is played: which VSCO SFZ, where it sits on stage, and how the sampler shapes its notes.
public sealed class Inst
{
    public string Name, Sfz;
    public int[] Keys;              // only these keys of the SFZ (GM percussion map); null = all
    public Bus Bus;
    public bool OneShot;            // plays the whole sample (hits, pizz, spiccato, staccato); otherwise held for the note length (loops if needed)
    public double Pan, GainDb, Width = .75;
    public double AttackLoud = .01, AttackSoft = .01;   // extra fade-in (s) at ff / at pp: soft string and brass entries swell in
    public double Release = -1;     // note-off fade (s); <0 = the SFZ's ampeg_release
    public double Lead;             // starts this many seconds before the beat (slow bowed/blown attacks speak on the beat)
    public int Copies = 1;          // stacked takes (other samples / layers / round robins) to fake a section
    public double SpreadMs = 15, DetuneCents = 6, PanSpread = .15;
    public double SoftLayerDb;      // lifts the softest recorded layer where the SFZ leaves a jump at the layer change (see `calib`)
    public double DarkHz = 0;     // >0: lowpass at pp that opens to ~5x at ff (brass/strings get brighter as they get louder)
    public double HumanMs = 10, HumanVel = 5, HumanCents = 3;
}

public static class Catalog
{
    static readonly int[] Snare = { 37, 38, 39, 40, 41 }, Kick = { 36 }, Crash = { 49 }, SusCym = { 51 }, Swell = { 47, 48, 50 }, Gong = { 46 };

    public static readonly Inst[] All =
    {
        // Strings (classic seating: violins left, violas centre, cellos/basses right).
        new() { Name = "vln",      Sfz = "ViolinEnsSusVib.sfz", Bus = Bus.Strings, Pan = -.45, AttackLoud = .05, AttackSoft = .28, Release = .7, Lead = .06, Copies = 2, SpreadMs = 18, DetuneCents = 5, DarkHz = 2600 },
        new() { Name = "vlnTrem",  Sfz = "ViolinEnsTrem.sfz",   Bus = Bus.Strings, Pan = -.40, AttackLoud = .03, AttackSoft = .35, Release = .5, Lead = .02, Copies = 2, DarkHz = 3000 },
        new() { Name = "vlnSpic",  Sfz = "ViolinEnsSpic.sfz",   Bus = Bus.Strings, Pan = -.45, OneShot = true, HumanMs = 6 },
        new() { Name = "vla",      Sfz = "ViolaEnsSusVib.sfz",  Bus = Bus.Strings, Pan = .10, AttackLoud = .05, AttackSoft = .28, Release = .7, Lead = .06, Copies = 2, DarkHz = 2200 },
        new() { Name = "vlaTrem",  Sfz = "ViolaEnsTrem.sfz",    Bus = Bus.Strings, Pan = .10, AttackLoud = .03, AttackSoft = .35, Release = .5, Lead = .02, DarkHz = 2600 },
        new() { Name = "vlaSpic",  Sfz = "ViolaEnsSpic.sfz",    Bus = Bus.Strings, Pan = .10, OneShot = true, HumanMs = 6 },
        new() { Name = "vc",       Sfz = "CelloEnsSusVib.sfz",  Bus = Bus.Strings, Pan = .35, AttackLoud = .05, AttackSoft = .25, Release = .7, Lead = .06, Copies = 2, DarkHz = 1800 },
        new() { Name = "vcTrem",   Sfz = "CelloEnsTrem.sfz",    Bus = Bus.Strings, Pan = .35, AttackLoud = .03, AttackSoft = .35, Release = .5, Lead = .02, DarkHz = 2200 },
        new() { Name = "vcSpic",   Sfz = "CelloEnsSpic.sfz",    Bus = Bus.Strings, Pan = .35, OneShot = true, HumanMs = 6 },
        new() { Name = "cb",       Sfz = "ContrabassSusVB.sfz", Bus = Bus.Strings, Pan = .45, AttackLoud = .06, AttackSoft = .25, Release = .6, Lead = .05, Copies = 2, SpreadMs = 20, DetuneCents = 7, DarkHz = 900 },
        new() { Name = "cbTrem",   Sfz = "ContrabassTrem.sfz",  Bus = Bus.Strings, Pan = .45, AttackLoud = .03, AttackSoft = .3, Release = .5, Copies = 2, DarkHz = 1200 },
        new() { Name = "cbPizz",   Sfz = "ContrabassPizz.sfz",  Bus = Bus.Strings, Pan = .45, OneShot = true, Copies = 2, SpreadMs = 12, HumanMs = 5 },
        // Brass: VSCO has solo players only, so every line stacks >= 3 takes (other samples, layers, round robins) into a section.
        new() { Name = "hn",       Sfz = "FHornSus.sfz",        Bus = Bus.Brass, Pan = -.20, AttackLoud = .02, AttackSoft = .12, Release = .45, Lead = .03, Copies = 3, SpreadMs = 18, DetuneCents = 7, PanSpread = .2, DarkHz = 1300 },
        new() { Name = "hnSolo",   Sfz = "FHornSus.sfz",        Bus = Bus.Brass, Pan = -.22, AttackLoud = .03, AttackSoft = .14, Release = .6, Lead = .04, Copies = 1, DarkHz = 1200 },
        new() { Name = "hnStac",  Sfz = "FHornStac.sfz",       Bus = Bus.Brass, Pan = -.20, OneShot = true, Copies = 3, SpreadMs = 12, DetuneCents = 6, PanSpread = .2, HumanMs = 6 },
        new() { Name = "tpt",      Sfz = "TrumpetSus.sfz",      Bus = Bus.Brass, Pan = .18, GainDb = -4,AttackLoud = .01, AttackSoft = .10, Release = .35, Lead = .02, Copies = 3, SpreadMs = 16, DetuneCents = 6, PanSpread = .16, DarkHz = 1800 },
        new() { Name = "tptSolo",  Sfz = "TrumpetSus.sfz",      Bus = Bus.Brass, Pan = .15, AttackLoud = .02, AttackSoft = .14, Release = .5, Lead = .03, Copies = 1, DarkHz = 1600 },
        new() { Name = "tptStac",  Sfz = "TrumpetStac.sfz",     Bus = Bus.Brass, Pan = .18, OneShot = true, Copies = 3, SpreadMs = 10, DetuneCents = 5, PanSpread = .16, HumanMs = 5 },
        new() { Name = "tbn",      Sfz = "TromboneSus.sfz",     Bus = Bus.Brass, Pan = .30, AttackLoud = .02, AttackSoft = .12, Release = .45, Lead = .03, Copies = 3, SpreadMs = 18, DetuneCents = 7, PanSpread = .18, DarkHz = 1100 },
        new() { Name = "tbnStac",  Sfz = "TromboneStac.sfz",    Bus = Bus.Brass, Pan = .30, OneShot = true, Copies = 3, SpreadMs = 10, DetuneCents = 5, PanSpread = .18, HumanMs = 5 },
        new() { Name = "tba",      Sfz = "TubaSus.sfz",         Bus = Bus.Brass, Pan = .38, AttackLoud = .03, AttackSoft = .12, Release = .5, Lead = .03, Copies = 2, SpreadMs = 14, DetuneCents = 5, DarkHz = 700 },
        // Percussion.
        new() { Name = "timp",     Sfz = "Timpani.sfz",         Bus = Bus.Perc, Pan = -.05, OneShot = true, Width = .9, HumanMs = 4, HumanCents = 0, SoftLayerDb = 14 },
        new() { Name = "timpRoll", Sfz = "TimpaniRolls.sfz",    Bus = Bus.Perc, Pan = -.05, AttackLoud = .05, AttackSoft = .2, Release = .9, Width = .9, HumanMs = 0, HumanCents = 0 },
        new() { Name = "snare",    Sfz = "GM-StylePerc.sfz", Keys = Snare,  Bus = Bus.Perc, Pan = .12, OneShot = true, Width = .6, HumanMs = 4, HumanVel = 6, HumanCents = 0 },
        new() { Name = "snareRoll",Sfz = "GM-StylePerc.sfz", Keys = Snare,  Bus = Bus.Perc, Pan = .12, AttackLoud = .02, AttackSoft = .15, Release = .25, Width = .6, HumanMs = 0, HumanCents = 0 },
        new() { Name = "bd",       Sfz = "GM-StylePerc.sfz", Keys = Kick,   Bus = Bus.Perc, Pan = -.08, OneShot = true, Width = .9, HumanMs = 4, HumanVel = 5, HumanCents = 0 },
        new() { Name = "crash",    Sfz = "GM-StylePerc.sfz", Keys = Crash,  Bus = Bus.Perc, Pan = .22, OneShot = true, Width = 1, HumanMs = 3, HumanCents = 0 },
        new() { Name = "susCym",   Sfz = "GM-StylePerc.sfz", Keys = SusCym, Bus = Bus.Perc, Pan = -.22, OneShot = true, Width = 1, HumanMs = 3, HumanCents = 0 },
        new() { Name = "swell",    Sfz = "GM-StylePerc.sfz", Keys = Swell,  Bus = Bus.Perc, Pan = -.22, OneShot = true, Width = 1, HumanMs = 0, HumanCents = 0 },
        new() { Name = "gong",     Sfz = "GM-StylePerc.sfz", Keys = Gong,   Bus = Bus.Perc, Pan = 0, OneShot = true, Width = 1, HumanMs = 0, HumanCents = 0 },
        // Colour.
        new() { Name = "harp",     Sfz = "Harp.sfz",            Bus = Bus.Color, GainDb = 6, Pan = -.55, OneShot = true, HumanMs = 8 },
        new() { Name = "bells",    Sfz = "TubularBells.sfz",    Bus = Bus.Color, Pan = .30, OneShot = true, HumanMs = 3, HumanCents = 0 },
    };

    public static Inst Get(string name) => All.FirstOrDefault(i => i.Name == name) ?? throw new Exception("không có nhạc cụ " + name);

    public static IEnumerable<string> SfzFiles() => All.Select(i => i.Sfz).Distinct();

    // One entry per SFZ: the union of the keys its instruments use (null = the whole file).
    public static IEnumerable<(string sfz, int[] keys)> SfzKeyFilters() =>
        All.GroupBy(i => i.Sfz).Select(g => (g.Key, g.Any(i => i.Keys == null) ? null : g.SelectMany(i => i.Keys).Distinct().ToArray()));
}

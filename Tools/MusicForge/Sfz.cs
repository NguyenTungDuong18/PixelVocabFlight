using System.Globalization;
using System.Text.RegularExpressions;

namespace MusicForge;

// One <region> of an SFZ file, with the <control>/<global>/<group> opcodes it inherits already merged in.
public sealed class Region
{
    public string Sample;          // path relative to the sample cache, '/' separated (default_path + sample)
    public int LoKey, HiKey, Center, LoVel = 0, HiVel = 127;
    public double VolumeDb, Tune, Attack = .001, Release = .5;
    public int SeqLength = 1, SeqPosition = 1;
    public double LoRand = 0, HiRand = 1;
    public double VelCenter => (LoVel + HiVel) / 2.0;
}

// SFZ-lite: reads only what VSCO 2 CE uses (sample, key/vel ranges, keycenter, volume, tune, ampeg_attack/release, seq_*, lo/hirand).
// The file is data from the internet: it is parsed, never executed.
public static class Sfz
{
    public static List<Region> Parse(string text)
    {
        var regions = new List<Region>();
        var control = new Dictionary<string, string>(); var global = new Dictionary<string, string>();
        var group = new Dictionary<string, string>(); Dictionary<string, string> region = null;
        Dictionary<string, string> cur = control;
        void Flush()
        {
            if (region == null) return;
            var all = new Dictionary<string, string>(global);
            foreach (var kv in group) all[kv.Key] = kv.Value;
            foreach (var kv in region) all[kv.Key] = kv.Value;
            if (!all.TryGetValue("sample", out var s)) { region = null; return; }
            string path = ((control.TryGetValue("default_path", out var dp) ? dp : "") + s).Replace('\\', '/');
            var r = new Region { Sample = path };
            int key = all.TryGetValue("key", out var k) ? NoteNumber(k) : -1;
            r.LoKey = all.TryGetValue("lokey", out var lk) ? NoteNumber(lk) : key;
            r.HiKey = all.TryGetValue("hikey", out var hk) ? NoteNumber(hk) : key;
            r.Center = all.TryGetValue("pitch_keycenter", out var pc) ? NoteNumber(pc) : key >= 0 ? key : r.LoKey;
            if (all.TryGetValue("lovel", out var lv)) r.LoVel = int.Parse(lv);
            if (all.TryGetValue("hivel", out var hv)) r.HiVel = int.Parse(hv);
            if (all.TryGetValue("volume", out var vo)) r.VolumeDb = D(vo);
            if (all.TryGetValue("tune", out var tu)) r.Tune = D(tu);
            if (all.TryGetValue("ampeg_attack", out var aa)) r.Attack = D(aa);
            if (all.TryGetValue("ampeg_release", out var ar)) r.Release = D(ar);
            if (all.TryGetValue("seq_length", out var sl)) r.SeqLength = int.Parse(sl);
            if (all.TryGetValue("seq_position", out var sp)) r.SeqPosition = int.Parse(sp);
            if (all.TryGetValue("lorand", out var lr)) r.LoRand = D(lr);
            if (all.TryGetValue("hirand", out var hr)) r.HiRand = D(hr);
            if (r.LoKey >= 0 && r.HiKey >= r.LoKey) regions.Add(r);
            region = null;
        }
        // Strip comments, then walk headers and opcode=value pairs (values may contain spaces only for 'sample', which runs to end of line).
        foreach (var raw in text.Split('\n'))
        {
            string line = raw; int c = line.IndexOf("//", StringComparison.Ordinal); if (c >= 0) line = line[..c];
            line = line.Trim(); if (line.Length == 0) continue;
            foreach (Match m in Regex.Matches(line, @"<(\w+)>|(\w+)=(.*?)(?=\s+\w+=|\s*<|$)"))
            {
                if (m.Groups[1].Success)
                {
                    Flush();
                    switch (m.Groups[1].Value)
                    {
                        case "control": cur = control; break;
                        case "global": global = new(); cur = global; break;
                        case "group": group = new(); cur = group; break;
                        case "region": region = new(); cur = region; break;
                        default: cur = new(); break;   // <master>, <curve>...: ignored
                    }
                }
                else cur[m.Groups[2].Value] = m.Groups[3].Value.Trim();
            }
        }
        Flush();
        return regions;
    }

    static double D(string s) => double.Parse(s, CultureInfo.InvariantCulture);

    // "60", "c4", "c#4", "db4" -> MIDI note (SFZ: c4 = 60).
    public static int NoteNumber(string s)
    {
        if (int.TryParse(s, out int n)) return n;
        return Pitch.Parse(s, sfzOctave: true);
    }
}

public static class Pitch
{
    // Note names in scores use scientific pitch (C4 = 60, middle C). Accepts "G4", "Bb3", "F#5", "Eb2".
    public static int Parse(string s, bool sfzOctave = false)
    {
        s = s.Trim(); int i = 0;
        int pc = char.ToUpperInvariant(s[i++]) switch { 'C' => 0, 'D' => 2, 'E' => 4, 'F' => 5, 'G' => 7, 'A' => 9, 'B' => 11, _ => throw new FormatException("note " + s) };
        while (i < s.Length && (s[i] == '#' || s[i] == 'b')) { pc += s[i] == '#' ? 1 : -1; i++; }
        int oct = int.Parse(s[i..], CultureInfo.InvariantCulture);
        return (oct + 1) * 12 + pc;
    }
}

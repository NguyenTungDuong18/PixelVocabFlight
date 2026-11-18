using System.Globalization;

namespace MusicForge;

// The score builder. Sections live in Score.<Section>.cs; this file holds the vocabulary they are written in:
// bars/beats, dynamics curves, melodic lines in note names, chord symbols with automatic voice leading, and percussion patterns.
// Bar 1 beat 1 = beat 0 of the piece being built (the intro and the loop are built separately).
public sealed partial class Score
{
    public readonly List<Note> Notes = new();
    public const int Pp = 30, P = 48, Mp = 64, Mf = 80, F = 100, Ff = 115, Fff = 126;

    public static double B(double bar, double beat = 1) => (bar - 1) * 4 + (beat - 1);

    // ---- dynamics: piecewise linear in bars (9 = downbeat of bar 9, 9.5 = its middle)
    public sealed class Dyn
    {
        readonly (double beat, double vel)[] pts;
        public Dyn(params (double bar, double vel)[] p) { pts = p.Select(x => (B(x.bar), x.vel)).OrderBy(x => x.Item1).ToArray(); }
        public static implicit operator Dyn(double v) => new Dyn((1, v));
        public double At(double beat)
        {
            if (beat <= pts[0].beat) return pts[0].vel;
            for (int i = 1; i < pts.Length; i++)
                if (beat <= pts[i].beat) return pts[i - 1].vel + (pts[i].vel - pts[i - 1].vel) * (beat - pts[i - 1].beat) / (pts[i].beat - pts[i - 1].beat);
            return pts[^1].vel;
        }
    }

    // ---- one note
    public Note Add(string inst, double beat, double len, int key, double vel, double velEnd = -1, double gainDb = 0)
    {
        Catalog.Get(inst);
        var n = new Note { Inst = inst, Beat = beat, Len = len, Key = key, Vel = vel, VelEnd = velEnd, GainDb = gainDb };
        Notes.Add(n); return n;
    }

    // ---- melodic line: "D4:1.5 G4:.5 Bb4:2 | ...", "r:1" = rest, "D4+F4:2" = double stop, suffix "s" = short (played by `stac`),
    // suffix "!" = accent. Each '|' must close a full 4-beat bar (checked). Steps of <= 2 semitones without a rest are slurred.
    public void Line(string inst, double bar, string text, Dyn dyn, int transpose = 0, string stac = null, double gainDb = 0, double startBeat = 1)
    {
        double t = B(bar, startBeat), barStart = B(bar);
        List<Note> prev = null; double prevEnd = -1;
        foreach (var raw in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (raw == "|")
            {
                if (Math.Abs(t - barStart - 4) > 1e-6) throw new Exception($"{inst} ô {barStart / 4 + 1}: ô dài {t - barStart} phách, không phải 4 ({text})");
                barStart = t; continue;
            }
            string tok = raw; bool accent = tok.EndsWith('!'); if (accent) tok = tok[..^1];
            bool shortN = tok.EndsWith('s') && stac != null && tok.Contains(':'); if (shortN) tok = tok[..^1];
            var parts = tok.Split(':'); double len = double.Parse(parts[1], CultureInfo.InvariantCulture);
            if (parts[0] != "r")
            {
                var cur = new List<Note>();
                foreach (var name in parts[0].Split('+'))
                {
                    int key = Pitch.Parse(name) + transpose;
                    double v = dyn.At(t) + (accent ? 12 : 0);
                    var n = Add(shortN ? stac : inst, t, len, key, v, len >= 2 && !shortN ? dyn.At(t + len) + (accent ? 6 : 0) : -1, gainDb);
                    cur.Add(n);
                }
                if (!shortN && prev != null && Math.Abs(prevEnd - t) < 1e-6 && prev.Count == cur.Count && Math.Abs(prev[0].Key - cur[0].Key) <= 2 && prev[0].Key != cur[0].Key)
                {
                    foreach (var p in prev) p.LegatoOut = true;
                    foreach (var c in cur) c.Legato = true;
                }
                prev = shortN ? null : cur; prevEnd = t + len;
            }
            else prev = null;
            t += len;
        }
    }

    // ---- harmony
    public sealed record Ch(string Sym, int Root, int[] Tones, int Bass);

    public static Ch Chord(string sym)
    {
        string body = sym, bass = null; int sl = sym.IndexOf('/'); if (sl > 0) { body = sym[..sl]; bass = sym[(sl + 1)..]; }
        int i = 1; while (i < body.Length && (body[i] == '#' || body[i] == 'b')) i++;
        int root = Pc(body[..i]); string q = body[i..];
        int[] iv = q switch
        {
            "" => new[] { 0, 4, 7 }, "m" => new[] { 0, 3, 7 }, "7" => new[] { 0, 4, 7, 10 }, "m7" => new[] { 0, 3, 7, 10 },
            "maj7" => new[] { 0, 4, 7, 11 }, "6" => new[] { 0, 4, 7, 9 }, "m6" => new[] { 0, 3, 7, 9 }, "sus4" => new[] { 0, 5, 7 }, "5" => new[] { 0, 7 },
            _ => throw new Exception("hợp âm lạ: " + sym)
        };
        return new Ch(sym, root, iv.Select(x => (root + x) % 12).ToArray(), bass != null ? Pc(bass) : root);
    }

    static int Pc(string name) => ((Pitch.Parse(name + "4") % 12) + 12) % 12;

    // "Gm Eb Cm,D D" from `bar`: one chord per bar, a comma splits the bar evenly.
    public static List<(double beat, double len, Ch ch)> Prog(int bar, string s)
    {
        var list = new List<(double, double, Ch)>(); double t = B(bar);
        foreach (var cell in s.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (cell == "|") continue;
            var parts = cell.Split(','); double len = 4.0 / parts.Length;
            foreach (var p in parts) { list.Add((t, len, Chord(p))); t += len; }
        }
        return list;
    }

    // Closest voicing to the previous one: n chord tones in [lo, hi], root and third present, neighbours <= 9 semitones apart.
    static int[] Voice(Ch ch, int lo, int hi, int n, int[] prev)
    {
        var keys = Enumerable.Range(lo, hi - lo + 1).Where(k => ch.Tones.Contains(((k % 12) + 12) % 12)).ToArray();
        int[] best = null; double bestScore = double.MaxValue; double center = (lo + hi) / 2.0;
        void Rec(int start, List<int> cur)
        {
            if (cur.Count == n)
            {
                var pcs = cur.Select(k => k % 12).ToHashSet();
                if (!pcs.Contains(ch.Tones[0])) return;
                if (ch.Tones.Length > 2 && n >= 2 && !pcs.Contains(ch.Tones[1])) return;
                if (n >= 3 && pcs.Count < Math.Min(3, ch.Tones.Length)) return;
                double sc = prev != null && prev.Length == n ? cur.Select((k, i) => Math.Abs(k - prev[i])).Sum() : cur.Sum(k => Math.Abs(k - center)) * .5;
                if (ch.Tones.Length > 3 && n >= 4 && !pcs.Contains(ch.Tones[3])) sc += 3;
                sc += Math.Abs(cur.Average() - center) * .15;
                if (sc < bestScore) { bestScore = sc; best = cur.ToArray(); }
                return;
            }
            for (int j = start; j < keys.Length; j++)
            {
                if (cur.Count > 0 && (keys[j] - cur[^1] > 9 || keys[j] == cur[^1])) { if (keys[j] - cur[^1] > 9) break; continue; }
                cur.Add(keys[j]); Rec(j + 1, cur); cur.RemoveAt(cur.Count - 1);
            }
        }
        Rec(0, new List<int>());
        return best ?? throw new Exception($"không xếp được {ch.Sym} trong {lo}-{hi} với {n} bè");
    }

    // Sustained chords, voice-led; a voice that keeps its pitch is held over the chord change.
    public void Pad(string inst, List<(double beat, double len, Ch ch)> prog, int lo, int hi, int voices, Dyn dyn, double gainDb = 0, double gap = 0)
    {
        int[] prev = null; var held = new Note[voices];
        foreach (var (beat, len, ch) in prog)
        {
            var v = Voice(ch, lo, hi, voices, prev);
            for (int i = 0; i < voices; i++)
            {
                if (held[i] != null && held[i].Key == v[i] && gap == 0) { held[i].Len += len; held[i].VelEnd = dyn.At(beat + len); continue; }
                held[i] = Add(inst, beat, len - gap, v[i], dyn.At(beat), dyn.At(beat + len), gainDb);
            }
            prev = v;
        }
    }

    // Chord bass (slash bass if given) in [lo, hi], sustained or on given beats of each chord.
    public void Bass(string inst, List<(double beat, double len, Ch ch)> prog, int lo, int hi, Dyn dyn, double gainDb = 0, double[] hits = null, double hitLen = 0)
    {
        Note held = null;
        foreach (var (beat, len, ch) in prog)
        {
            int k = Enumerable.Range(lo, 12).First(x => x % 12 == ch.Bass); if (k > hi) k -= 12;
            if (hits == null)
            {
                if (held != null && held.Key == k) { held.Len += len; held.VelEnd = dyn.At(beat + len); continue; }
                held = Add(inst, beat, len, k, dyn.At(beat), dyn.At(beat + len), gainDb);
            }
            else foreach (var h in hits) if (h < len) Add(inst, beat + h, hitLen > 0 ? hitLen : len - h, k, dyn.At(beat + h), -1, gainDb);
        }
    }

    // Repeating figure on chord tones: each step is an index into the chord's tones (0 root, 1 third, 2 fifth, 3 seventh; +10 = an octave up)
    // placed upward from `lo`. accents[i % accents.Length] is added to the velocity.
    public void Figure(string inst, List<(double beat, double len, Ch ch)> prog, int lo, int[] steps, double step, Dyn dyn, double[] accents, double gainDb = 0)
    {
        foreach (var (beat, len, ch) in prog)
        {
            int count = (int)Math.Round(len / step);
            for (int i = 0; i < count; i++)
            {
                int s = steps[i % steps.Length], deg = s % 10, oct = s / 10;
                int pc = ch.Tones[Math.Min(deg, ch.Tones.Length - 1)];
                int k = Enumerable.Range(lo, 12).First(x => x % 12 == pc) + 12 * oct;
                double t = beat + i * step;
                Add(inst, t, step, k, dyn.At(t) + accents[i % accents.Length], -1, gainDb);
            }
        }
    }

    // ---- percussion
    public Note Hit(string inst, double beat, int key, double vel, double gainDb = 0) => Add(inst, beat, .5, key, vel, -1, gainDb);

    public Note Roll(string inst, double beat, double len, int key, double v0, double v1, double gainDb = 0) => Add(inst, beat, len, key, v0, v1, gainDb);

    // Suspended-cymbal swell whose loudest point lands on `beat` (47 short ~1 bar, 48 medium, 50 long).
    public void Swell(double beat, double vel, int key = 48) { var n = Hit("swell", beat, key, vel); n.AlignPeak = true; }

    // Military snare, one bar of 16ths: F flam accent, A accent, x tap, g ghost, d drag (ruff), R buzz roll (joined), . rest.
    public void Snare(int bar, string pattern, Dyn dyn)
    {
        pattern = pattern.Replace(" ", "");
        if (pattern.Length != 16) throw new Exception("snare cần 16 ô: " + pattern);
        double t0 = B(bar);
        for (int i = 0; i < 16; i++)
        {
            double t = t0 + i * .25, v = dyn.At(t);
            switch (pattern[i])
            {
                case 'F': Hit("snare", t - .05, 38, v - 30); Hit("snare", t, 38, v + 14); break;
                case 'A': Hit("snare", t, 38, v + 14); break;
                case 'x': Hit("snare", t, 38, v); break;
                case 'g': Hit("snare", t, 38, v - 26); break;
                case 'd': Hit("snare", t - .1, 38, v - 30); Hit("snare", t - .05, 38, v - 26); Hit("snare", t, 38, v + 6); break;
                case 'R':
                    int j = i; while (j < 16 && pattern[j] == 'R') j++;
                    Roll("snareRoll", t, (j - i) * .25, 39, v - 8, dyn.At(t0 + j * .25) + 4);
                    i = j - 1; break;
            }
        }
    }
}

using PixelVocabFlight;
using static Proc;

// Seamless loops: the fighter's engine, the bomber stream, the wind, the fire.
static partial class Recipe
{
    static void Loops()
    {
        var w = System.Diagnostics.Stopwatch.StartNew(); Engine(); Console.Error.WriteLine("  engine " + w.Elapsed.TotalSeconds); Bomber(); Console.Error.WriteLine("  bomber " + w.Elapsed.TotalSeconds); Wind(); Console.Error.WriteLine("  wind " + w.Elapsed.TotalSeconds); WindLong(); Fire();
    }

    // Our fighter: a Rolls-Royce Merlin running on a test stand (276597, CC0; steady stretch around 45-70 s). The stand has no propeller, so the
    // blade slap (3 blades, 18.5 turns a second = 55.5 Hz, the blades slightly out of step at 18.5 Hz) is added as noise bursts, 17 dB under.
    static void Engine()
    {
        const double len = 4, xf = .3, search = .12;
        var m = Src("276597");
        var loops = BestLoop(s => new[] { Win(m.L, s, len, xf, search), Win(m.R, s, len, xf, search) }, 42, 66, 2, len, xf, search, out double corr, out double used, out double at);
        double sec = loops[0].Length / (double)Rate, f = Math.Round(sec * 55.5) / sec, fm = Math.Round(sec * 18.5) / sec;
        var rng = new Rng(5);
        for (int c = 0; c < 2; c++)
        {
            loops[c] = Periodic(loops[c], t => Eq(t, Kind.High, 28, 0, .7071, 2));
            var chop = new float[loops[c].Length]; double ph = rng.U() * 6.28;
            var bp = new Biquad(Filt.Band, 520, 1.1);
            int pulses = (int)Math.Round(sec * f);
            for (int k = 0; k < pulses; k++)
            {
                double t = (k + rng.Range(-.04, .04)) / f, amp = (1 + .5 * Math.Sin(2 * Math.PI * fm * t + ph)) * (1 + rng.Range(-.15, .15));
                int a = (int)(t * Rate), n = (int)(.004 * Rate);
                for (int i = 0; i < n; i++) chop[((a + i) % chop.Length + chop.Length) % chop.Length] += (float)(bp.Tick(rng.White()) * amp * Math.Exp(-i / (.0012 * Rate)));
            }
            Gain(NormRms(chop, 0), Scan.Db(Rms(loops[c])) - 17);
            for (int i = 0; i < chop.Length; i++) loops[c][i] += chop[i];
        }
        float p = Math.Max(Peak(loops[0]), Peak(loops[1])); Gain(loops[0], -20 * Math.Log10(p) - 1); Gain(loops[1], -20 * Math.Log10(p) - 1);
        Out("engine", Stereo2(loops[0], loops[1]), "276597 từ " + at + " s, độ khớp mối " + corr.ToString("0.00") + ", dài " + used.ToString("0.000") + " s, + chém cánh quạt 55,5 Hz");
    }

    // The bomber stream: two recordings of steady formation hum (437892 and 437863, CC0), the left and right taken from different moments,
    // plus a stack of 62-104 Hz sines (whole cycles per loop) 9 dB under for the weight that the optical sound track left out.
    static void Bomber()
    {
        const double len = 8, xf = .5, search = .15;
        var a = Mono("437892"); var b = Mono("437863");
        var loops = BestLoop(s =>
        {
            var l = Win(a, s, len, xf, search); var r = Win(a, s + 2.9, len, xf, search);
            var bl = Win(b, s + 1.3, len, xf, search); var br = Win(b, s + 7, len, xf, search);
            Gain(bl, -4); Gain(br, -4);
            for (int i = 0; i < l.Length; i++) { l[i] += bl[i]; r[i] += br[i]; }
            return new[] { l, r };
        }, 3.5, 10.4, 1, len, xf, search, out double corr, out double used, out double at);
        double sec = loops[0].Length / (double)Rate;
        var rng = new Rng(11);
        double[] hz = { 62, 66.5, 71.5, 77, 84, 93.5, 104 };
        for (int c = 0; c < 2; c++)
        {
            loops[c] = Periodic(loops[c], t => { Eq(t, Kind.High, 32, 0, .7071, 2); Eq(t, Kind.Low, 7500, 0, .7071, 2); });
            var sub = new float[loops[c].Length];
            foreach (double h in hz)
            {
                double f = Math.Round(h * sec) / sec, ph = rng.U(), am = Math.Round(.25 * sec) / sec, ap = rng.U(); double amp = rng.Range(.7, 1);
                for (int i = 0; i < sub.Length; i++) { double t = (double)i / Rate; sub[i] += (float)(amp * (1 + .2 * Math.Sin(2 * Math.PI * am * t + ap)) * Math.Sin(2 * Math.PI * (f * t + ph))); }
            }
            Gain(NormRms(sub, 0), Scan.Db(Rms(loops[c])) - 9);
            for (int i = 0; i < sub.Length; i++) loops[c][i] += sub[i];
        }
        float p = Math.Max(Peak(loops[0]), Peak(loops[1])); Gain(loops[0], -20 * Math.Log10(p) - 1); Gain(loops[1], -20 * Math.Log10(p) - 1);
        Out("bomber", Stereo2(loops[0], loops[1]), "437892 + 437863 từ " + at + " s, độ khớp " + corr.ToString("0.00") + ", dài " + used.ToString("0.000") + " s, + sin 62-104 Hz");
    }

    // High wind: "Wind Howl 2" (117610, CC0) with a winter wind (481148, CC0) under it. Taken high-passed at 420 Hz (steep), brightened above
    // 2 kHz (+9 dB) and rolled off at 13 kHz: a clear, light wind, no rumble underneath.
    static void Wind()
    {
        const double len = 10, xf = .6, search = .2;
        var w = Src("117610"); var c = Mono("481148");
        var loops = BestLoop(s =>
        {
            var l = Win(w.L, s, len, xf, search); var r = Win(w.R, s + 16, len, xf, search);
            var cl = Win(c, 20 + (s - 4), len, xf, search); var cr = Win(c, 40 + (s - 4), len, xf, search); Gain(cl, -8); Gain(cr, -8);
            for (int i = 0; i < l.Length; i++) { l[i] += cl[i]; r[i] += cr[i]; }
            return new[] { l, r };
        }, 4, 10, 2, len, xf, search, out double corr, out double used, out double at);
        for (int k = 0; k < 2; k++)
        {
            loops[k] = Periodic(loops[k], t => { Eq(t, Kind.High, 420, 0, .7071, 2); Eq(t, Kind.HighShelf, 1800, 9); Eq(t, Kind.Low, 13000, 0, .7071, 1); });
        }
        float p = Math.Max(Peak(loops[0]), Peak(loops[1])); Gain(loops[0], -20 * Math.Log10(p) - 1); Gain(loops[1], -20 * Math.Log10(p) - 1);
        Out("wind", Stereo2(loops[0], loops[1]), "117610 từ " + at + " s (+ 481148), độ khớp " + corr.ToString("0.00") + ", dài " + used.ToString("0.000") + " s, lọc cao 420 Hz, shelf +9 dB trên 1,8 kHz");
    }

    // Long wind for the menu bed (it plays random 6-12 s pieces of it, never looping): the same two recordings and the same EQ as `wind`, taken
    // from parts the loop does not use (117610 at 35-53 / 38-56 s, 481148 at 2-20 / 46-64 s under it at -8 dB). Not a loop: only the ends are faded.
    static void WindLong()
    {
        const double len = 18;
        var w = Src("117610"); var c = Mono("481148");
        var l = Cut(w.L, 35, 35 + len); var r = Cut(w.R, 38, 38 + len);
        var cl = Cut(c, 2, 2 + len); var cr = Cut(c, 46, 46 + len); Gain(cl, -8); Gain(cr, -8);
        for (int i = 0; i < l.Length; i++) { l[i] += cl[i]; r[i] += cr[i]; }
        foreach (var x in new[] { l, r }) { Eq(x, Kind.High, 420, 0, .7071, 2); Eq(x, Kind.HighShelf, 1800, 9); Eq(x, Kind.Low, 13000, 0, .7071, 1); Fade(x, 20, 20); }
        float p = Math.Max(Peak(l), Peak(r)); Gain(l, -20 * Math.Log10(p) - 1); Gain(r, -20 * Math.Log10(p) - 1);
        Out("windlong", Stereo2(l, r), "117610 từ 35 và 38 s + 481148 từ 2 và 46 s, không ghép vòng, dài " + len + " s, cùng lọc với wind");
    }

    // Burning fuel: the steady roar of a big fire (698209, CC0) with the crackle of burning wood and metal (483323, CC0) over it.
    static void Fire()
    {
        const double len = 6, xf = .4, search = .1;
        var roar = Src("698209"); var crack = Mono("483323");
        var loops = BestLoop(s =>
        {
            var l = Win(roar.L, s, len, xf, search); var r = Win(roar.R, s + 7, len, xf, search);
            var ca = Win(crack, 12 + (s - 30), len, xf, search); var cb = Win(crack, 42 + (s - 30), len, xf, search);
            Eq(ca, Kind.High, 500, 0, .7071, 1); Eq(cb, Kind.High, 500, 0, .7071, 1);
            double rr = Math.Max(Rms(l), 1e-9), g = .9 * rr / Math.Max(Rms(ca), 1e-9), gb = .9 * rr / Math.Max(Rms(cb), 1e-9);   // the crackle at about the level of the roar
            for (int i = 0; i < l.Length; i++) { l[i] += (float)(ca[i] * g); r[i] += (float)(cb[i] * gb); }
            return new[] { l, r };
        }, 30, 36, 1, len, xf, search, out double corr, out double used, out double at);
        for (int k = 0; k < 2; k++) loops[k] = Periodic(loops[k], t => Eq(t, Kind.High, 35, 0, .7071, 2));
        float p = Math.Max(Peak(loops[0]), Peak(loops[1])); Gain(loops[0], -20 * Math.Log10(p) - 1); Gain(loops[1], -20 * Math.Log10(p) - 1);
        Out("fire", Stereo2(loops[0], loops[1]), "698209 từ " + at + " s + 483323, độ khớp " + corr.ToString("0.00") + ", dài " + used.ToString("0.000") + " s");
    }
}

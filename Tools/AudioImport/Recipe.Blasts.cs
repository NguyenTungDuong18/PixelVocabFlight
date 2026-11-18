using PixelVocabFlight;
using static Proc;

// Explosions: flak, medium and huge blasts, the roaring of flames, bombs far below, and the ringing in the ears.
static partial class Recipe
{
    static void Blasts()
    {
        Flak(); Booms(); Roar(); Rumble(); Ring();
    }

    // flak: four bass-heavy shell bursts (674897, CC0); flaknear: shell blasts with a crack (675611, CC0) and three artillery rounds (239137, CC0).
    static void Flak()
    {
        var a = Mono("674897");
        var far = new List<float[]> { Ev(a, .2, .7, 1.4, 250, .3), Ev(a, 4.0, 4.6, 1.4, 250, .3), Ev(a, 11.1, 11.3, 1.4, 250), Ev(a, 19.1, 19.3, 1.4, 250) };
        foreach (var x in far) Eq(x, Kind.High, 40, 0, .7071, 1);
        Out("flak", Kit(far), "674897 bốn quả nổ");

        var b = Mono("675611"); var c = Mono("239137");
        var near = new List<float[]> { Ev(b, .08, .3, .9, 150), Ev(b, 2.0, 2.3, .8, 150), Ev(c, 0, .1, 1.1, 180), Ev(c, 3.05, 3.15, 1.1, 180), Ev(c, 5.1, 5.2, 1.1, 180) };
        foreach (var x in near) Eq(x, Kind.High, 40, 0, .7071, 1);
        Out("flaknear", Kit(near), "675611 (2) + 239137 (3)");
    }

    // boom: the three separate blasts of 560510 (CC0). bigboom: three huge blasts with a deep decay (741174, 592000, 741173; all CC0), stereo.
    static void Booms()
    {
        var d = Mono("560510");
        var boom = new List<float[]> { Ev(d, .0, .1, 1.8, 300), Ev(d, 3.0, 3.1, 1.8, 300), Ev(d, 8.0, 8.1, 1.8, 300) };
        foreach (var x in boom) Eq(x, Kind.High, 35, 0, .7071, 1);
        Out("boom", Kit(boom), "560510 ba vụ nổ");

        var l = new List<float[]>(); var r = new List<float[]>();
        foreach (var (id, len) in new[] { ("741174", 5.5), ("592000", 4.5), ("741173", 5.0) })
        {
            var s = Src(id); int at = Attack(s.L, 0, .2, .3), n = Math.Min((int)(len * Rate), s.Length - at);
            var cl = new float[n]; var cr = new float[n]; Array.Copy(s.L, at, cl, 0, n); Array.Copy(s.R, at, cr, 0, n);
            Fade(cl, 1.5, 1500); Fade(cr, 1.5, 1500); Eq(cl, Kind.High, 20, 0, .7071, 1); Eq(cr, Kind.High, 20, 0, .7071, 1);
            l.Add(cl); r.Add(cr);
        }
        Out("bigboom", Kit(l, false, r), "741174 + 592000 + 741173");
    }

    // The roar of flames to fly through (the burning vault 674903 and the big fire 698209; CC0), stereo, 4 s, not a loop.
    static void Roar()
    {
        var v = Mono("674903"); var f = Src("698209");
        var l = Cut(v, 16, 20); var r = Cut(v, 24, 28); var fl = Cut(f.L, 60, 64); var fr = Cut(f.R, 66, 70);
        Gain(fl, -3); Gain(fr, -3);
        for (int i = 0; i < l.Length; i++) { l[i] += fl[i]; r[i] += fr[i]; }
        Eq(l, Kind.High, 35, 0, .7071, 2); Eq(r, Kind.High, 35, 0, .7071, 2);
        float p = Math.Max(Peak(l), Peak(r)); Gain(l, -20 * Math.Log10(p) - 1); Gain(r, -20 * Math.Log10(p) - 1);
        Fade(l, 5, 5); Fade(r, 5, 5);
        Out("roar", Stereo2(l, r), "674903 (16-20 s, 24-28 s) + 698209");
    }

    // Bombs falling on a city far below: five 3.3 s stretches of low rumble (438693, CC0), low-passed at 350 Hz.
    static void Rumble()
    {
        var a = Mono("438693");
        var k = new List<float[]>();
        foreach (double t in new[] { 5.0, 9.5, 70.0, 75.0, 80.0 })
        {
            var x = Cut(a, t, t + 3.3); Eq(x, Kind.High, 25, 0, .7071, 2); Eq(x, Kind.Low, 350, 0, .7071, 2); Fade(x, 400, 400); k.Add(x);
        }
        Out("rumble", Kit(k), "438693 năm đoạn");
    }

    // The ringing in the ears (365956, CC0): the recording swells over nine seconds, played backwards it dies away.
    static void Ring()
    {
        var m = Mono("365956"); var x = Reverse(Cut(m, 5, 8.9));
        Eq(x, Kind.High, 500, 0, .7071, 2); NormPeak(x, -1); Fade(x, 3, 300);
        Out("ring", CinemaSample.FromMono(x), "365956 [5-8,9 s] đảo ngược");
    }
}

using PixelVocabFlight;
using static Proc;

// Guns and what bullets do to metal.
static partial class Recipe
{
    static void Guns()
    {
        MachineGuns(); Cannon(); Hits();
    }

    // mg_a: single shots of an aircraft .50 Browning (160355, CC0), cut from a steady burst of 66 ms between shots; the last slice is the decay
    // after the last shot. mg_b: stretches of 0.8 s of a thick, brighter burst (183656, CC0) to lay under it. Mono.
    static void MachineGuns()
    {
        var a = Mono("160355");
        var all = Shots.Find(a, (int)(.5 * Rate), (int)(2.6 * Rate), .03, .3, 1200);
        var starts = all.Where(s => s >= (int)(.9 * Rate) && s <= (int)(2.32 * Rate)).ToList();
        var shots = SliceAt(a, starts, .075, 4, 2, (int)(.55 * Rate));
        foreach (var s in shots) Eq(s, Kind.High, 70, 0, .7071, 1);
        var tail = shots[^1]; Fade(tail, 1, 160);
        Out("mg_a", Kit(shots), "160355 " + shots.Count + " tiếng đơn (" + (starts[0] / (double)Rate).ToString("0.00") + "-" + (starts[^1] / (double)Rate).ToString("0.00") + " s), đoạn cuối là đuôi");

        var b = Mono("183656"); Eq(b, Kind.High, 90, 0, .7071, 2);
        var onsets = Shots.Find(b, 0, (int)(35 * Rate), .03, .3, 1200);
        var bursts = new List<int>(); int last = -1000000;
        foreach (int o in onsets) { if (o - last > (int)(.5 * Rate)) bursts.Add(o); last = o; }
        var pieces = new List<float[]>();
        foreach (int s0 in bursts.Take(7))
        {
            int n = Math.Min((int)(.8 * Rate), b.Length - s0); var p = new float[n]; Array.Copy(b, s0, p, 0, n);
            pieces.Add(Fade(p, 2, 40));
        }
        Out("mg_b", Kit(pieces), "183656 " + pieces.Count + " loạt dài 0,8 s");
    }

    // Heavy 25 mm (854186, CC0) and 37 mm-class (187767, CC0) cannon shots with their tails. A low shelf makes them heavier.
    static void Cannon()
    {
        var a = Mono("854186"); var b = Mono("187767");
        var s = new List<float[]>
        {
            Fade(Cut(a, .022, .30), 1.5, 25), Fade(Cut(a, .296, .58), 1.5, 25), Fade(Cut(a, .576, 2.0), 1.5, 120),
            Ev(b, .15, .3, 1.3, 140), Ev(b, 6.4, 6.5, 1.3, 140),
        };
        foreach (var x in s) { Eq(x, Kind.High, 40, 0, .7071, 1); Eq(x, Kind.LowShelf, 140, 4); }
        Out("cannon", Kit(s), "854186 (3 phát) + 187767 (2 phát)");
    }

    // Bullets striking sheet metal: hit_a from 50 cal impacts (675944, CC0), hit_b the bright ringing of struck metal (486296, CC0).
    static void Hits()
    {
        var a = Mono("675944"); var onsA = Shots.Find(a, (int)(.3 * Rate), (int)(8.3 * Rate), .06, .2, 1500);
        var sa = SliceAt(a, onsA, .3, 40).Where(x => x.Length >= (int)(.1 * Rate)).Take(14).ToList();
        foreach (var x in sa) Eq(x, Kind.High, 120, 0, .7071, 1);
        Out("hit_a", Kit(sa), "675944 " + sa.Count + " cú trúng");

        var b = Mono("486296"); var onsB = Shots.Find(b, (int)(.01 * Rate), (int)(9 * Rate), .12, .25, 2500);
        var sb = SliceAt(b, onsB, .35, 70).Where(x => x.Length >= (int)(.15 * Rate)).Take(8).ToList();
        foreach (var x in sb) { Eq(x, Kind.High, 400, 0, .7071, 1); Eq(x, Kind.Low, 9000, 0, .7071, 1); }
        Out("hit_b", Kit(sb), "486296 " + sb.Count + " tiếng gõ kim loại");
    }
}

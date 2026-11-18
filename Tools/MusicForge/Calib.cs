namespace MusicForge;

// Level of one note per instrument across velocities: shows whether the SFZ layer volumes + crossfade give a smooth, rising curve.
public static class Calib
{
    public static int Run(string cache)
    {
        Bank.Root = cache;
        int[] vels = { 20, 35, 50, 60, 64, 70, 85, 100, 115, 127 };
        Console.WriteLine("nhạc cụ      phím | RMS dBFS ở vel " + string.Join(" ", vels.Select(v => v.ToString().PadLeft(5))));
        foreach (var inst in Catalog.All)
        {
            int key = inst.Name switch
            {
                "snare" => 38, "snareRoll" => 39, "bd" => 36, "crash" => 49, "susCym" => 51, "swell" => 48, "gong" => 46,
                "timp" or "timpRoll" => 43, "cb" or "cbTrem" or "cbPizz" => 43, "tba" => 41, "tbn" or "tbnStac" => 53,
                "hn" or "hnSolo" or "hnStac" => 57, "tpt" or "tptSolo" or "tptStac" => 70, "vc" or "vcTrem" or "vcSpic" => 55,
                "vla" or "vlaTrem" or "vlaSpic" => 62, "bells" => 67, "harp" => 67, _ => 72
            };
            var row = new List<string>();
            foreach (var v in vels)
            {
                var p = new Player(inst, cache, 1); int n = 3 * Mix.Rate; var l = new float[n]; var r = new float[n];
                p.Play(new Note { Inst = inst.Name, Beat = 0, Len = 3, Key = key, Vel = v, Exact = true }, l, r, 0);
                int a = inst.OneShot ? 0 : Mix.Rate / 2, b = inst.OneShot ? Mix.Rate / 2 : (int)(1.6 * Mix.Rate);
                row.Add($"{Mix.ToDb(Meter.Rms(l, r, a, b)),5:0}");
            }
            Console.WriteLine($"{inst.Name,-12} {key,4} | {string.Join(" ", row)}");
        }
        return 0;
    }
}

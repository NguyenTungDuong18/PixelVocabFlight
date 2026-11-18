using System.Globalization;
using PixelVocabFlight;

// Offline importer of the intro's recorded sounds (MP3 from Freesound, see Game/Assets/_Project/Audio/SFX/Cinema/LICENSE.md).
//   dotnet run -c Release -- build [--src <folder of MP3>] [--out <folder for the .bytes WAV files>]   builds the bank (default folders below)
//   dotnet run -c Release -- scan <file.mp3> [window s] [hop s] [from s] [to s]                          levels, spectrum, bird/voice warnings
//   dotnet run -c Release -- onsets <file.mp3> [from s] [to s]                                           where the loud events start
// Default source: <repo>/SourceAssets/Audio/Cinema ; default output: <repo>/Game/Assets/_Project/Audio/SFX/Cinema/Resources/CinemaSfx
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
string root = FindRoot();
string srcDir = Path.Combine(root, "SourceAssets", "Audio", "Cinema"), outDir = Path.Combine(root, "Game", "Assets", "_Project", "Audio", "SFX", "Cinema", "Resources", "CinemaSfx");
var rest = new List<string>();
for (int i = 1; i < args.Length; i++)
{
    if (args[i] == "--src" && i + 1 < args.Length) srcDir = Path.GetFullPath(args[++i]);
    else if (args[i] == "--out" && i + 1 < args.Length) outDir = Path.GetFullPath(args[++i]);
    else rest.Add(args[i]);
}
double Arg(int i, double d) => i < rest.Count ? double.Parse(rest[i]) : d;
switch (args.Length > 0 ? args[0] : "")
{
    case "scan":
    {
        string f = Resolve(rest[0]);
        Scan.Run(f, Arg(1, 1), Arg(2, Arg(1, 1)), Arg(3, 0), Arg(4, 0));
        return 0;
    }
    case "onsets":
    {
        var s = Source.Load(Resolve(rest[0])); var x = Scan.Mono(s); double a = Arg(1, 0), z = Arg(2, 1e9);
        foreach (int o in Scan.Onsets(x)) { double t = o / (double)CinemaDsp.Rate; if (t >= a && t <= z) Console.Write(t.ToString("0.000") + " "); }
        Console.WriteLine();
        return 0;
    }
    case "env":     // env <file> [from] [to] [bin s]   RMS dB per bin, as one line of integers (dB below 0)
    {
        var s = Source.Load(Resolve(rest[0])); var x = Scan.Mono(s); double a = Arg(1, 0), z = Math.Min(Arg(2, 1e4), x.Length / (double)CinemaDsp.Rate), bin = Arg(3, .1);
        for (double t = a; t < z; t += bin)
        {
            if ((int)Math.Round((t - a) / bin) % 20 == 0) Console.Write("\n" + t.ToString("0.0").PadLeft(6) + ": ");
            Console.Write((-(int)Math.Round(Scan.Db(Scan.RmsOf(x, (int)(t * CinemaDsp.Rate), (int)((t + bin) * CinemaDsp.Rate))))).ToString().PadLeft(3));
        }
        Console.WriteLine();
        return 0;
    }
    case "trim":    // trim <in.mp3> <out.mp3> <from s> <to s>: keeps only the frames around the part the recipe uses (+ out.mp3.start)
        return Mp3Trim.Run(rest[0], rest[1], double.Parse(rest[2]), double.Parse(rest[3])) ? 0 : 1;
    case "shots":   // shots <file> [from] [to] [min gap s] [fraction of max] [high-pass Hz]
    {
        var s = Source.Load(Resolve(rest[0])); var x = Scan.Mono(s);
        Shots.Print(x, (int)(Arg(1, 0) * CinemaDsp.Rate), (int)(Arg(2, 1e4) * CinemaDsp.Rate), Arg(3, .04), Arg(4, .25), Arg(5, 1200));
        return 0;
    }
    case "build":
        return Recipe.Build(srcDir, outDir);
    default:
        Console.WriteLine("dùng: build | scan <mp3> [cửa sổ] [bước] [từ] [đến] | onsets <mp3> [từ] [đến]   (--src, --out)");
        return 2;
}

string Resolve(string p)
{
    if (File.Exists(p)) return Path.GetFullPath(p);
    var inSrc = Directory.Exists(srcDir) ? Directory.GetFiles(srcDir, p + "*.mp3", SearchOption.AllDirectories) : new string[0];
    if (inSrc.Length > 0) return inSrc[0];
    string probe = Environment.GetEnvironmentVariable("WW_SFX_PROBE");
    if (probe != null && Directory.Exists(probe)) { var m = Directory.GetFiles(probe, p + "*.mp3", SearchOption.AllDirectories); if (m.Length > 0) return m[0]; }
    throw new FileNotFoundException(p);
}

static string FindRoot()
{
    var d = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (d != null && !Directory.Exists(Path.Combine(d.FullName, "Game", "Assets"))) d = d.Parent;
    return d?.FullName ?? Directory.GetCurrentDirectory();
}

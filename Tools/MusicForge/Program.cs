using System.Globalization;
using MusicForge;

// WORDWING title music: an original orchestral score written as code (Score*.cs), played by an SFZ-lite sampler on VSCO 2 CE (CC0)
// recordings, mixed through an FDN reverb, and written as two WAVs that the game chains: title_intro (once, on the logo) + title_loop.
//   dotnet run --project Tools/MusicForge -c Release -- fetch                 download the needed SFZ + WAV into Tools/MusicForge/samples (git-ignored)
//   dotnet run --project Tools/MusicForge -c Release -- build [--out <dir>]   render title_intro.wav + title_loop.wav (default: the game's Music folder)
//   dotnet run --project Tools/MusicForge -c Release -- preview <dir>         build into <dir> + full_preview.wav (intro + loop + 20 s of the loop again) + stems
//   dotnet run --project Tools/MusicForge -c Release -- check [<dir>]         assert-based checks on the two WAVs; writes check.txt into <dir>
//   dotnet run --project Tools/MusicForge -c Release -- calib                 per-instrument level vs velocity (are the SFZ layers balanced?)
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
string root = FindRoot();
string cache = Path.Combine(root, "Tools", "MusicForge", "samples");
string gameDir = Path.Combine(root, "Game", "Assets", "_Project", "Audio", "Music", "Resources", "Music");
string outDir = null;
var rest = new List<string>();
for (int i = 1; i < args.Length; i++)
{
    if (args[i] == "--out" && i + 1 < args.Length) outDir = Path.GetFullPath(args[++i]);
    else rest.Add(args[i]);
}
switch (args.Length > 0 ? args[0] : "")
{
    case "fetch": return Fetch.Run(cache);
    case "build":
    {
        var r = Render.Run(cache, stems: false);
        Render.Write(r, outDir ?? gameDir);
        return 0;
    }
    case "preview":
    {
        string dir = rest.Count > 0 ? Path.GetFullPath(rest[0]) : outDir ?? Path.Combine(root, "Tools", "Smoke", "music-r1");
        var r = Render.Run(cache, stems: true);
        Render.Write(r, dir);
        Render.WritePreview(r, dir);
        return Check.Run(dir, dir);
    }
    case "check":
    {
        string dir = rest.Count > 0 ? Path.GetFullPath(rest[0]) : outDir ?? gameDir;
        return Check.Run(dir, Path.Combine(root, "Tools", "Smoke", "music-r1"));
    }
    case "calib": return Calib.Run(cache);
    default:
        Console.WriteLine("lệnh: fetch | build [--out <dir>] | preview <dir> | check [<dir>] | calib");
        return 1;
}

static string FindRoot()
{
    for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        if (Directory.Exists(Path.Combine(d.FullName, "Game", "Assets")) && Directory.Exists(Path.Combine(d.FullName, "Tools"))) return d.FullName;
    for (var d = new DirectoryInfo(Directory.GetCurrentDirectory()); d != null; d = d.Parent)
        if (Directory.Exists(Path.Combine(d.FullName, "Game", "Assets")) && Directory.Exists(Path.Combine(d.FullName, "Tools"))) return d.FullName;
    throw new Exception("không tìm thấy thư mục gốc dự án");
}

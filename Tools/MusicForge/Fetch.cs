using System.Text.Json;

namespace MusicForge;

// Downloads only the SFZ files and WAV samples the score uses from VSCO 2 Community Edition (CC0, https://github.com/sgossner/VSCO-2-CE,
// branch SFZ) into Tools/MusicForge/samples (git-ignored). Files are data: WAV/SFZ are only read, nothing in them is run.
public static class Fetch
{
    const string Repo = "sgossner/VSCO-2-CE", Branch = "SFZ";

    public static int Run(string cache)
    {
        Directory.CreateDirectory(cache);
        using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("MusicForge/1.0");
        // The git tree gives the real (case-sensitive) path and size of every file; SFZ paths do not always match the case on disk.
        string treeFile = Path.Combine(cache, "tree.json");
        if (!File.Exists(treeFile))
            File.WriteAllText(treeFile, http.GetStringAsync($"https://api.github.com/repos/{Repo}/git/trees/{Branch}?recursive=1").Result);
        var tree = new Dictionary<string, (string path, long size)>(StringComparer.OrdinalIgnoreCase);
        using (var doc = JsonDocument.Parse(File.ReadAllText(treeFile)))
            foreach (var e in doc.RootElement.GetProperty("tree").EnumerateArray())
                if (e.GetProperty("type").GetString() == "blob")
                    tree[e.GetProperty("path").GetString()] = (e.GetProperty("path").GetString(), e.GetProperty("size").GetInt64());

        var want = new List<(string path, long size)>();
        foreach (var sfz in Catalog.SfzFiles())
        {
            if (!tree.TryGetValue(sfz, out var t)) throw new Exception("không có trong VSCO: " + sfz);
            want.Add(t);
        }
        Download(http, cache, want);
        want.Clear();
        foreach (var (sfz, keys) in Catalog.SfzKeyFilters())
            foreach (var r in Sfz.Parse(File.ReadAllText(Path.Combine(cache, sfz))))
            {
                if (keys != null && !keys.Any(k => k >= r.LoKey && k <= r.HiKey)) continue;
                if (!tree.TryGetValue(r.Sample, out var t)) { Console.WriteLine("  thiếu mẫu (bỏ qua): " + r.Sample); continue; }
                if (!want.Contains(t)) want.Add(t);
            }
        Download(http, cache, want);
        long total = Directory.EnumerateFiles(cache, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);
        Console.WriteLine($"cache: {total / 1e6:0.0} MB ở {cache}");
        return 0;
    }

    static void Download(HttpClient http, string cache, List<(string path, long size)> files)
    {
        var todo = files.Where(f => { var p = Local(cache, f.path); return !File.Exists(p) || new FileInfo(p).Length != f.size; }).ToList();
        Console.WriteLine($"tải {todo.Count}/{files.Count} file ({todo.Sum(f => f.size) / 1e6:0.0} MB)");
        int done = 0;
        Parallel.ForEach(todo, new ParallelOptions { MaxDegreeOfParallelism = 8 }, f =>
        {
            string url = $"https://raw.githubusercontent.com/{Repo}/{Branch}/" + string.Join("/", f.path.Split('/').Select(Uri.EscapeDataString));
            for (int attempt = 1; ; attempt++)
            {
                try
                {
                    var bytes = http.GetByteArrayAsync(url).Result;
                    if (bytes.Length != f.size) throw new Exception($"sai kích thước {bytes.Length} != {f.size}");
                    string p = Local(cache, f.path); Directory.CreateDirectory(Path.GetDirectoryName(p));
                    File.WriteAllBytes(p + ".part", bytes); File.Move(p + ".part", p, true);
                    break;
                }
                catch (Exception e) when (attempt < 4) { Console.WriteLine($"  thử lại {f.path}: {e.GetBaseException().Message}"); Thread.Sleep(2000 * attempt); }
            }
            int n = Interlocked.Increment(ref done);
            if (n % 50 == 0) Console.WriteLine($"  {n}/{todo.Count}");
        });
    }

    public static string Local(string cache, string path) => Path.Combine(cache, path.Replace('/', Path.DirectorySeparatorChar));
}

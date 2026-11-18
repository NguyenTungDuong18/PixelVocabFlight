using System.Diagnostics;
using System.Globalization;
using PixelVocabFlight;

// Renders the intro soundtrack outside Unity, writes WAV files to listen to, measures every sound and exits non-zero when a check fails.
//   dotnet run -- <output folder> [--demo] [--film <title_intro.bytes>]
// --demo uses a built-in cue list with every cue kind (0-15) instead of the film file (which may still be WWC1 with kinds 0-8 only).
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
string outDir = null, filmPath = null, bankDir = null; bool demo = false;
for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--demo") demo = true;
    else if (args[i] == "--bank" && i + 1 < args.Length) bankDir = args[++i];
    else if (args[i] == "--film" && i + 1 < args.Length) filmPath = args[++i];
    else outDir ??= args[i];
}
outDir ??= Path.Combine(Directory.GetCurrentDirectory(), "out");
bankDir ??= FindBank();
int passes = 0, fails = 0;
void Check(bool ok, string name, string detail = "")
{
    if (ok) passes++; else fails++;
    Console.WriteLine((ok ? "PASS " : "FAIL ") + name + (detail.Length > 0 ? "  [" + detail + "]" : ""));
}

// ---- Cues ----
int fps = 30; double intro = 10; var cues = new List<CinemaCue>();
if (demo) { cues = DemoCues(); Console.WriteLine("Cue: danh sách dựng sẵn (--demo), " + cues.Count + " cue"); }
else
{
    filmPath ??= FindFilm();
    if (filmPath == null || !File.Exists(filmPath)) { Console.WriteLine("Không tìm thấy file phim; dùng --film <đường dẫn> hoặc --demo"); return 2; }
    if (!CinemaFilm.TryParse(File.ReadAllBytes(filmPath), out var info, out var error)) { Console.WriteLine("Không đọc được phim: " + error); return 2; }
    fps = info.Fps; intro = info.LoopStart / (double)fps; cues = info.Cues;
    Console.WriteLine("Cue: " + filmPath + " (WWC" + info.Version + "), " + cues.Count + " cue, " + intro.ToString("0.00") + " s");
}
Console.WriteLine(string.Join(" ", cues.Select(c => c.Kind + "@" + c.Time(fps).ToString("0.00"))));

// ---- Parser check on a hand-made WWC2 array ----
{
    var b = new List<byte> { (byte)'W', (byte)'W', (byte)'C', (byte)'2' };
    void U16(int v) { b.Add((byte)(v & 255)); b.Add((byte)(v >> 8)); }
    U16(480); U16(270); U16(30); U16(12); U16(8); U16(1); U16(3);
    b.AddRange(new byte[] { 1, 2, 3 });
    b.AddRange(new byte[] { 1, 5, 0, 156, 200, 18 });          // Burst, frame 5, pan -100, level 200, dur 18
    b.AddRange(new byte[] { 3, 1, 0, 100, 100, 0 });           // BigBoom, frame 1 (sorted first), pan 100, level 100
    b.AddRange(new byte[] { 6, 9, 0, 0, 0, 0 });               // frame 9 >= loopStart 8: dropped
    for (int i = 0; i < 26; i++) U16(0);                       // 13 offsets (u32 each)
    bool ok = CinemaFilm.TryParse(b.ToArray(), out var f, out _) && f.Version == 2 && f.Cues.Count == 2 && f.Cues[0].Kind == 3 && f.Cues[0].Frame == 1 && f.Cues[0].Pan == 100 && f.Cues[0].Level == 100
        && f.Cues[1].Kind == 1 && f.Cues[1].Pan == -100 && f.Cues[1].Level == 200 && f.Cues[1].Dur == 18;
    Check(ok, "WWC2: cue 6 byte (kind, frame, pan, level, dur) đọc đúng, sắp theo khung, bỏ cue >= loopStart");
}

// ---- The bank of recordings: all files there, readable, within the size budget ----
Console.WriteLine("Bộ mẫu: " + bankDir);
var bankWatch = Stopwatch.StartNew();
CinemaBank bank = null; string bankError = null;
try { bank = CinemaBank.FromFolder(bankDir); } catch (Exception e) { bankError = e.Message; }
bankWatch.Stop();
Check(bank != null, "bộ mẫu đọc được toàn bộ file WAV trong thư mục", bankError ?? (bank.Count + " file, " + bankWatch.Elapsed.TotalSeconds.ToString("0.00") + " s"));
if (bank == null) { Console.WriteLine("AudioChecks: " + passes + " PASS, " + fails + " FAIL"); return 1; }
Check(bank.Problems().Length == 0, "bộ mẫu đủ " + CinemaBank.Required.Length + " file bắt buộc, đủ số đoạn của từng kit", bank.Problems());
long bankBytes = Directory.GetFiles(bankDir, "*.bytes").Sum(f => new FileInfo(f).Length);
Check(bankBytes <= 17L * 1048576, "tổng dung lượng bộ mẫu <= 17 MB", (bankBytes / 1048576.0).ToString("0.00") + " MB");
Check(CinemaBank.Required.All(n => bank[n].Rate == CinemaDsp.Rate && Analysis.Peak(bank[n].L) > .05 && Analysis.Peak(bank[n].L) <= 1.0 && !Analysis.HasBad(bank[n].L) && !Analysis.HasBad(bank[n].R)), "mọi mẫu 44,1 kHz, không im lặng, không vỡ số");
Console.WriteLine("Mẫu: " + string.Join("  ", CinemaBank.Required.Select(n => n + " " + bank[n].Seconds.ToString("0.0") + "s" + (bank[n].Slices > 0 ? "/" + bank[n].Slices : ""))));
foreach (var name in new[] { "engine", "bomber", "wind", "fire" })
{
    var m = Analysis.Mono(bank[name].ToStereo()); double tonal = Analysis.TonalFraction(m), syl = Analysis.SyllableShare(m);
    Check(tonal < .05 && syl < .6, "vòng lặp " + name + " không có chim hót hay tiếng người (tông hẹp 2-8 kHz < 5%, nhịp âm tiết 3-6 Hz < 60%)", "tông " + tonal.ToString("0%") + ", âm tiết " + syl.ToString("0.00"));
}

Console.WriteLine();
Console.WriteLine("{0,-10}{1,6}{2,8}{3,8}{4,9}{5,7}{6,8}{7,8}{8,7}{9,7}{10,8}", "mẫu gốc", "giây", "đỉnh dB", "RMS dB", "trọng tâm", "<120", "120-800", "0.8-6k", ">6k", "chim", "âm tiết");
foreach (var name in CinemaBank.Required)
{
    var m = Analysis.Mono(bank[name].ToStereo()); var spec = Analysis.Spectrum(m);
    Console.WriteLine("{0,-10}{1,6:0.0}{2,8:0.0}{3,8:0.0}{4,9:0}{5,7:0%}{6,8:0%}{7,8:0%}{8,7:0%}{9,7:0%}{10,8:0.00}", name, bank[name].Seconds, Analysis.DbOf(Analysis.Peak(m)), Analysis.DbOf(Analysis.Rms(m, 0, 1e9)),
        Analysis.Centroid(spec), Analysis.Band(spec, 0, 120), Analysis.Band(spec, 120, 800), Analysis.Band(spec, 800, 6000), Analysis.Band(spec, 6000, 30000), Analysis.TonalFraction(m), Analysis.SyllableShare(m));
}
Console.WriteLine();
// ---- Render ----
var watch = Stopwatch.StartNew();
var stems = CinemaMix.Render(cues, fps, intro, bank);
watch.Stop();
double renderSeconds = watch.Elapsed.TotalSeconds;
Console.WriteLine("CinemaMix.Render: " + renderSeconds.ToString("0.00") + " s (một luồng, lần chạy đầu gồm JIT)");
long allocated = GC.GetAllocatedBytesForCurrentThread();
var watch2 = Stopwatch.StartNew(); CinemaMix.Render(cues, fps, intro, bank); watch2.Stop();
Console.WriteLine("CinemaMix.Render lần 2: " + watch2.Elapsed.TotalSeconds.ToString("0.00") + " s, cấp phát " + ((GC.GetAllocatedBytesForCurrentThread() - allocated) / 1048576) + " MB");

// ---- Full mix = both stems + the running wind loop (volume .5, ducked, fading in over 1.5 s as the game does) ----
int frames = stems.Frames; var mix = new float[frames * 2];
for (int i = 0; i < frames; i++)
{
    double t = (double)i / CinemaDsp.Rate, wv = CinemaMix.WindLoopVolume * stems.Duck((float)t) * Math.Min(1, t / 1.5);
    int w = i % (stems.Wind.Length / 2);
    for (int c = 0; c < 2; c++) mix[2 * i + c] = stems.Ambience[2 * i + c] + stems.Effects[2 * i + c] + (float)(stems.Wind[2 * w + c] * wv);
}
Analysis.WriteWav(Path.Combine(outDir, "title_intro.wav"), mix);
Analysis.WriteWav(Path.Combine(outDir, "title_intro_ambience.wav"), stems.Ambience);
Analysis.WriteWav(Path.Combine(outDir, "title_intro_effects.wav"), stems.Effects);

// ---- Solo sounds ----
var info2 = new Dictionary<string, (Stereo s, float[] mono, double[] spec)>();
Console.WriteLine();
Console.WriteLine("{0,-14}{1,6}{2,8}{3,8}{4,9}{5,7}{6,8}{7,8}{8,7}", "âm", "giây", "đỉnh dB", "RMS dB", "trọng tâm", "<120", "120-800", "0.8-6k", ">6k");
foreach (var name in CinemaClips.Names)
{
    var s = CinemaClips.Solo(name, bank);
    var mono = Analysis.Mono(s); var spec = Analysis.Spectrum(mono);
    info2[name] = (s, mono, spec);
    float[] il = CinemaClips.Interleave(s);
    if (CinemaClips.IsLoop(name)) il = il.Concat(il).ToArray();   // two turns, to hear the seam
    Analysis.WriteWav(Path.Combine(outDir, "solo", name + ".wav"), il);
    double peak = Math.Max(Analysis.Peak(s.L), Analysis.Peak(s.R));
    double rms = Math.Sqrt((Analysis.Rms(s.L, 0, 1e9) * Analysis.Rms(s.L, 0, 1e9) + Analysis.Rms(s.R, 0, 1e9) * Analysis.Rms(s.R, 0, 1e9)) / 2);
    Console.WriteLine("{0,-14}{1,6:0.00}{2,8:0.0}{3,8:0.0}{4,9:0}{5,7:0.0%}{6,8:0.0%}{7,8:0.0%}{8,7:0.0%}", name, s.Length / (double)CinemaDsp.Rate, Analysis.DbOf(peak), Analysis.DbOf(rms),
        Analysis.Centroid(spec), Analysis.Band(spec, 0, 120), Analysis.Band(spec, 120, 800), Analysis.Band(spec, 800, 6000), Analysis.Band(spec, 6000, 30000));
}
if (args.Contains("--trace")) for (double s = 3.3; s < 4.2; s += .05) Console.WriteLine("trace " + s.ToString("0.00") + " duck " + Analysis.DbOf(stems.Duck((float)s)).ToString("0.0") + " nen " + Analysis.DbOf(stems.AmbienceRms(s, s + .05)).ToString("0.0"));
Console.WriteLine();

// ---- Checks ----
bool anyBad = Analysis.HasBad(stems.Ambience) || Analysis.HasBad(stems.Effects) || Analysis.HasBad(stems.Wind) || info2.Values.Any(v => Analysis.HasBad(v.s.L) || Analysis.HasBad(v.s.R));
Check(!anyBad, "không có NaN/Inf trong mọi âm và hai stem");
double mixPeak = Analysis.Peak(mix), ambPeak = Analysis.Peak(stems.Ambience), fxPeak = Analysis.Peak(stems.Effects);
Check(mixPeak <= .98, "đỉnh bản trộn <= 0,98", "mix " + mixPeak.ToString("0.000") + ", ambience " + ambPeak.ToString("0.000") + ", effects " + fxPeak.ToString("0.000"));
Check(ambPeak <= .9 && fxPeak <= .9, "mỗi stem đỉnh <= 0,9 (soft-clip)");
Check(Analysis.FlatRun(mix) < 3 && Analysis.FlatRun(stems.Ambience) < 3 && Analysis.FlatRun(stems.Effects) < 3 && info2.Values.All(v => Analysis.FlatRun(v.s.L) < 3 && Analysis.FlatRun(v.s.R) < 3), "không có đoạn bị cắt phẳng");
Check(Math.Abs(stems.Seconds - (intro + 3)) < 1e-6 && stems.Frames == CinemaDsp.N(intro + 3), "stem dài intro + 3 giây", stems.Seconds.ToString("0.00"));

var windSpec = info2["wind"].spec; double windCentroid = Analysis.Centroid(windSpec), windLow = Analysis.Band(windSpec, 0, 200);
Check(windCentroid > 1000 && windLow < .02, "gió sáng: trọng tâm phổ > 1 kHz và gần như không có năng lượng < 200 Hz (không ù trầm)", windCentroid.ToString("0") + " Hz, <200 Hz " + windLow.ToString("0.00%"));
double bomberCentroid = Analysis.Centroid(info2["bomber_hum"].spec);
Check(bomberCentroid < 400, "ù oanh tạc cơ: trọng tâm < 400 Hz", bomberCentroid.ToString("0") + " Hz");

double gunRate = Analysis.PeakRate(info2["mg_single"].mono, .04, .3, out int gunPeaks), cannonRate = Analysis.PeakRate(info2["cannon_single"].mono, .05, .3, out int cannonPeaks);
Check(gunRate >= 13 && gunRate <= 16, "nhịp súng ta 13-16 phát/s (đếm đỉnh bao hình, một khẩu)", gunRate.ToString("0.0") + "/s, " + gunPeaks + " đỉnh");
Check(cannonRate >= 9 && cannonRate <= 12, "nhịp pháo địch 9-12 phát/s", cannonRate.ToString("0.0") + "/s, " + cannonPeaks + " đỉnh");
double gunCentroid = Analysis.Centroid(info2["mg_single"].spec), cannonCentroid = Analysis.Centroid(info2["cannon_single"].spec);
Check(cannonCentroid < gunCentroid, "thân pháo địch thấp hơn súng ta", cannonCentroid.ToString("0") + " Hz < " + gunCentroid.ToString("0") + " Hz");
Check(gunRate > cannonRate * 1.25, "nhịp súng ta nhanh hơn pháo địch rõ (>= 1,25 lần)", gunRate.ToString("0.0") + "/s vs " + cannonRate.ToString("0.0") + "/s");
{
    // The kinds of sound must differ from each other: distance between feature vectors (log centroid, three band shares) of every pair of different sounds.
    var set = new[] { "engine_v12", "bomber_hum", "wind", "fire", "burst", "cannon", "gunners", "hit", "flak", "flaknear", "boom", "bigboom", "rumble", "whoosh", "heavypass" };
    double[] Vec(string n) { var sp = info2[n].spec; return new[] { Math.Log2(Analysis.Centroid(sp) / 100) / 4, Analysis.Band(sp, 0, 120), Analysis.Band(sp, 120, 800), Analysis.Band(sp, 800, 6000) }; }
    double best = 1e9; string pair = "";
    for (int a = 0; a < set.Length; a++) for (int b = a + 1; b < set.Length; b++)
    {
        var u = Vec(set[a]); var v = Vec(set[b]); double d = Math.Sqrt(u.Zip(v, (x, y) => (x - y) * (x - y)).Sum());
        if (d < best) { best = d; pair = set[a] + " ~ " + set[b]; }
    }
    Check(best > .1, "các loại tiếng khác nhau rõ (khoảng cách đặc trưng phổ giữa mọi cặp > 0,1)", "gần nhất " + pair + " = " + best.ToString("0.000"));
}

double eBig = Analysis.LowEnergy(info2["bigboom"].mono), eBoom = Analysis.LowEnergy(info2["boom"].mono), eFlak = Analysis.LowEnergy(info2["flak"].mono);
Check(eBig > eBoom && eBoom > eFlak, "năng lượng < 120 Hz: bigboom > boom > flak", "bigboom " + eBig.ToString("0.0") + ", boom " + eBoom.ToString("0.0") + ", flak " + eFlak.ToString("0.00"));
Check(eBig > eBoom * 3, "bigboom có sub nặng hơn hẳn boom (>= 3 lần)", (eBig / eBoom).ToString("0.0") + "x");
Check(Analysis.Band(info2["rumble"].spec, 800, 30000) < .02, "ì ầm bom xa không có cao tần (> 800 Hz < 2%)", Analysis.Band(info2["rumble"].spec, 800, 30000).ToString("0.00%"));
Check(Analysis.Centroid(info2["gunners"].spec) > 500 && Analysis.Band(info2["gunners"].spec, 0, 250) < .05,"súng tự vệ xa: lách tách nhỏ, không trầm", Analysis.Centroid(info2["gunners"].spec).ToString("0") + " Hz");

foreach (var name in CinemaClips.Names.Where(CinemaClips.IsLoop))
{
    var s = info2[name].s; double a = Analysis.SeamRatio(s.L), b = Analysis.SeamRatio(s.R);
    Check(a <= 1.25 && b <= 1.25, "vòng lặp " + name + " nối liền (nhảy ở mối nối / bước thường)", a.ToString("0.00") + " / " + b.ToString("0.00"));
}

var amb = Analysis.MonoOfInterleaved(stems.Ambience); var fxm = Analysis.MonoOfInterleaved(stems.Effects);
Console.WriteLine("Mức theo từng giây (RMS dB):  " + string.Join("  ", Enumerable.Range(0, (int)Math.Ceiling(intro + 3)).Select(s => s + "s nền " + Analysis.DbOf(Analysis.Rms(amb, s, s + 1)).ToString("0") + "/hiệu ứng " + Analysis.DbOf(Analysis.Rms(fxm, s, s + 1)).ToString("0"))));
foreach (var cue in cues.Where(c => c.Kind == CinemaKind.BigBoom))
{
    double t = cue.Time(fps), before = stems.AmbienceRms(t - .1, t), earlier = stems.AmbienceRms(t - .4, t - .1);   // the same stereo function the smoke test uses
    Check(Analysis.DbOf(before) <= Analysis.DbOf(earlier) - 3, "pre-suck: nền (stereo) 100 ms trước bigboom@" + t.ToString("0.00") + " thấp hơn >= 3 dB so với 300 ms trước đó", Analysis.DbOf(before).ToString("0.0") + " dB vs " + Analysis.DbOf(earlier).ToString("0.0") + " dB");
    Check(stems.Duck((float)t) < CinemaDsp.Db(-12) + .001, "duck tại bigboom@" + t.ToString("0.00") + " <= -12 dB", Analysis.DbOf(stems.Duck((float)t)).ToString("0.0") + " dB");
}
// Timing: the first cue of each kind rendered alone (the real film is too dense to tell its own onset from the tails of its neighbours).
foreach (int kind in new[] { CinemaKind.BigBoom, CinemaKind.Boom, CinemaKind.FlakNear, CinemaKind.Hit })
{
    var cue = cues.FirstOrDefault(c => c.Kind == kind);
    if (cue == null) continue;
    int frame = Math.Max(fps / 3, cue.Frame);   // a third of a second of silence before it
    var alone = new List<CinemaCue> { new CinemaCue(CinemaKind.Shot, 0), new CinemaCue(kind, frame, cue.Pan, cue.Level, cue.Dur) };
    var solo = CinemaMix.Render(alone, fps, intro, bank, false);
    var fx1 = Analysis.MonoOfInterleaved(solo.Effects); double t = frame / (double)fps;
    double early = Analysis.PeakIn(fx1, 0, t - .0005), after = Analysis.PeakIn(fx1, t, t + .03);
    Check(early < .003 && after > .02, "tiếng kind " + kind + " bắt đầu đúng khung cue, không đến trước (dựng riêng)", "đỉnh " + Analysis.DbOf(early).ToString("0.0") + " dB trước, " + Analysis.DbOf(after).ToString("0.0") + " dB sau");
}
foreach (var name in new[] { "flak", "flaknear", "boom", "bigboom", "hit", "burst", "cannon" })
{
    double first = Analysis.PeakIn(info2[name].mono, 0, .03), all = Analysis.PeakIn(info2[name].mono, 0, 100);
    Check(first >= all * .2, "âm " + name + " bắt đầu ngay mẫu đầu (không có khoảng lặng dẫn)", (first / all).ToString("0.00"));
}
double titleAt = cues.Where(c => c.Kind == CinemaKind.Title).Select(c => c.Time(fps)).DefaultIfEmpty(-1).First();
if (titleAt > 0)
{
    double before = Analysis.Rms(amb, titleAt - .5, titleAt - .1), after = Analysis.Rms(amb, titleAt + 1.4, titleAt + 1.9);
    Check(after < before * .1, "sau cue Title nền lắng hẳn (động cơ, ù, gió trong stem) trong 1,2 s", Analysis.DbOf(before).ToString("0.0") + " dB -> " + Analysis.DbOf(after).ToString("0.0") + " dB");
}
Check(stems.Duck(0) > .99f && Enumerable.Range(0, 130).All(k => stems.Duck(k * .1f) <= 1.0001f && stems.Duck(k * .1f) > 0), "Duck(t) nằm trong (0, 1]");
Check(renderSeconds < 2, "CinemaMix.Render < 2 s (một luồng, gồm JIT)", renderSeconds.ToString("0.00") + " s");
{
    // The first half second must not be thin: the whole mix (both stems + the wind loop fading in over 1.5 s, as the game plays it).
    var mm = Analysis.MonoOfInterleaved(mix);
    double r0 = Analysis.Rms(mm, 0, .5), r1 = Analysis.Rms(mm, .5, 1.5);
    Check(Analysis.DbOf(r0) >= Analysis.DbOf(r1) - 6, "mở màn dày: RMS 0-0,5 s của bản trộn không nhỏ hơn RMS 0,5-1,5 s quá 6 dB", Analysis.DbOf(r0).ToString("0.0") + " dB vs " + Analysis.DbOf(r1).ToString("0.0") + " dB");
    double a0 = Analysis.Rms(Analysis.MonoOfInterleaved(stems.Ambience), 0, .5), e0 = Analysis.Rms(Analysis.MonoOfInterleaved(stems.Effects), 0, .5);
    Check(Analysis.DbOf(Math.Sqrt(a0 * a0 + e0 * e0)) > -45, "mở màn có tiếng ngay trong hai stem (không kể vòng gió): RMS 0-0,5 s > -45 dB", Analysis.DbOf(a0).ToString("0.0") + " nền, " + Analysis.DbOf(e0).ToString("0.0") + " hiệu ứng");
    Console.WriteLine("Mở màn: RMS 0-0,25 s " + Analysis.DbOf(Analysis.Rms(mm, 0, .25)).ToString("0.0") + " dB, 0,25-0,5 s " + Analysis.DbOf(Analysis.Rms(mm, .25, .5)).ToString("0.0") + " dB, 0,5-1,5 s " + Analysis.DbOf(r1).ToString("0.0") + " dB");
}

// ---- The menu bed: never loops (rendered with the very code the game runs on its audio thread) ----
{
    var kitWatch = Stopwatch.StartNew();
    var kit = CinemaMenuBed.Prepare(bank, 7);
    kitWatch.Stop();
    Check(kitWatch.Elapsed.TotalSeconds < 3, "CinemaMenuBed.Prepare < 3 s (luồng nền, gồm JIT)", kitWatch.Elapsed.TotalSeconds.ToString("0.00") + " s");
    float[] Render(int seed, double seconds, int rate, List<CinemaMenuBed.Entry> log = null)
    {
        var bedEngine = new CinemaMenuBed(kit, seed, rate) { Log = log };
        int total = (int)Math.Round(seconds * rate), block = 1000; var all = new float[total * 2]; var tmp = new float[block * 2];
        for (int at = 0; at < total; at += block)
        {
            int n = Math.Min(block, total - at); bedEngine.Mix(tmp, n); Array.Copy(tmp, 0, all, at * 2, n * 2);
        }
        return all;
    }
    var log = new List<CinemaMenuBed.Entry>();
    var bedMix = Render(20260617, 90, CinemaDsp.Rate, log);
    Analysis.WriteWav(Path.Combine(outDir, "menu_bed_90s.wav"), bedMix);
    var bedMono = Analysis.MonoOfInterleaved(bedMix);
    double bedRms = Analysis.Rms(bedMono, 0, 90), introRms = Analysis.Rms(Analysis.MonoOfInterleaved(mix), 0, intro);
    Check(!Analysis.HasBad(bedMix) && Analysis.Peak(bedMix) <= .98 && Analysis.FlatRun(bedMix) < 3, "nền menu 90 s: không NaN, đỉnh <= 0,98, không cắt phẳng", "đỉnh " + Analysis.Peak(bedMix).ToString("0.000"));
    Check(Analysis.DbOf(bedRms) > -45 && Analysis.DbOf(bedRms) < Analysis.DbOf(introRms) - 6, "nền menu có tiếng (RMS > -45 dB) và nhỏ hơn intro >= 6 dB", Analysis.DbOf(bedRms).ToString("0.0") + " dB vs intro " + Analysis.DbOf(introRms).ToString("0.0") + " dB");
    var env = Analysis.Envelope(bedMono);
    double c8 = Analysis.Correlation(env, 160), c10 = Analysis.Correlation(env, 200), cMax = 0; int cLag = 0;
    for (int lag = 80; lag <= 600; lag++) { double c = Analysis.Correlation(env, lag); if (c > cMax) { cMax = c; cLag = lag; } }
    Check(c8 < .5 && c10 < .5, "nền menu không lặp: tương quan đường bao (50 ms) ở độ trễ 8 s và 10 s < 0,5", "8 s " + c8.ToString("0.00") + ", 10 s " + c10.ToString("0.00") + "; cao nhất trong 4-30 s " + cMax.ToString("0.00") + " ở " + (cLag * .05).ToString("0.0") + " s");
    // The test must be able to see a loop: the old 10 s wind loop repeated for 90 s.
    {
        var w = stems.Wind; var old = new float[CinemaDsp.N(90)]; int wl = w.Length / 2;
        for (int i = 0; i < old.Length; i++) old[i] = (w[2 * (i % wl)] + w[2 * (i % wl) + 1]) * .5f;
        var oe = Analysis.Envelope(old); int lag = (int)Math.Round(wl / (double)CinemaDsp.Rate / .05);
        double co = Analysis.Correlation(oe, lag);
        Check(co > .9, "đối chứng: vòng gió cũ 10 s lặp 90 s bị phát hiện (tương quan đường bao ở một vòng > 0,9)", co.ToString("0.00") + " ở " + (lag * .05).ToString("0.00") + " s");
    }
    var ev = log.Where(e => e.What == "event").ToList(); var gaps = new List<double>();
    for (int i = 1; i < ev.Count; i++) gaps.Add(ev[i].Time - ev[i - 1].Time);
    Check(ev.Count >= 12 && ev.Count <= 60 && ev[0].Time >= 1.2 && ev[0].Time <= 3.1, "nền menu: sự kiện xa 12-60 trong 90 s, cái đầu tiên ở 1,2-3 s", ev.Count + " sự kiện, đầu ở " + (ev.Count > 0 ? ev[0].Time.ToString("0.00") : "-") + " s");
    Check(gaps.Max() <= 6.02 && gaps.Count(g => g >= 1.49) >= 8 && gaps.Count(g => g < .6) >= 1 && gaps.Where(g => g >= .6).Min() >= 1.49, "sự kiện xa cách nhau 1,5-6 s, đôi khi một cụm gần nhau (< 0,6 s)", "xa nhất " + gaps.Max().ToString("0.00") + " s, cụm " + gaps.Count(g => g < .6));
    Check(ev.All(e => Math.Abs(e.B) <= .7) && ev.Select(e => (int)e.A).Distinct().Count() >= 3 && ev.Count(e => e.B < -.2) >= 3 && ev.Count(e => e.B > .2) >= 3, "sự kiện xa: pan trong ±0,7 cả hai phía, >= 3 loại tiếng", "loại " + string.Join(",", ev.Select(e => (int)e.A).Distinct().OrderBy(k => k)));
    var ws = log.Where(e => e.What == "wind").ToList(); var hs = log.Where(e => e.What == "hum").ToList();
    Check(ws.Count >= 7 && ws.All(w => w.A >= 6 && w.A <= 12 && w.B >= 1.5 && w.B <= 2.5) && ws.Zip(ws.Skip(1), (a, b) => b.Time > a.Time + 3).All(x => x), "gió nền menu: đoạn 6-12 s, đan chéo 1,5-2,5 s, đổi đoạn thường xuyên", ws.Count + " đoạn trong 90 s");
    Check(hs.Count >= 5 && hs.All(h => h.A >= 8 && h.A <= 14), "ù đội hình xa: đoạn 8-14 s, đổi đoạn thường xuyên", hs.Count + " đoạn");
    var other = Render(99, 6, CinemaDsp.Rate); var same = Render(20260617, 6, CinemaDsp.Rate);
    double dotAB = 0, dotAA = 1e-18, dotBB = 1e-18; for (int i = 0; i < other.Length; i++) { dotAB += other[i] * bedMix[i]; dotAA += other[i] * other[i]; dotBB += bedMix[i] * bedMix[i]; }
    bool identical = true; for (int i = 0; i < same.Length; i++) if (same[i] != bedMix[i]) { identical = false; break; }
    Check(identical && Math.Abs(dotAB / Math.Sqrt(dotAA * dotBB)) < .5, "nền menu: cùng seed ra đúng cùng âm, seed khác ra âm khác (mỗi lần mở game khác nhau)", "tương quan hai seed " + (dotAB / Math.Sqrt(dotAA * dotBB)).ToString("0.00"));
    var at48 = Render(20260617, 30, 48000); double r44 = Analysis.Rms(bedMono, 0, 30);
    var m48 = Analysis.MonoOfInterleaved(at48); double r48 = Math.Sqrt(m48.Select(v => (double)v * v).Sum() / m48.Length);
    Check(Math.Abs(Analysis.DbOf(r48) - Analysis.DbOf(r44)) < 1.5 && !Analysis.HasBad(at48), "nền menu ở 48 kHz cùng độ to với 44,1 kHz (đọc mẫu theo tỉ lệ)", Analysis.DbOf(r48).ToString("0.0") + " dB vs " + Analysis.DbOf(r44).ToString("0.0") + " dB");
    Console.WriteLine("Nền menu: RMS " + Analysis.DbOf(bedRms).ToString("0.0") + " dB, đỉnh " + Analysis.DbOf(Analysis.Peak(bedMix)).ToString("0.0") + " dB; sự kiện lúc " + string.Join(" ", ev.Take(14).Select(e => e.Time.ToString("0.0") + "/" + (int)e.A)) + " ...");
}

Console.WriteLine();
Console.WriteLine("Đã ghi: " + Path.GetFullPath(Path.Combine(outDir, "title_intro.wav")) + " (+ _ambience, _effects, solo/*.wav)");
Console.WriteLine("AudioChecks: " + passes + " PASS, " + fails + " FAIL");
return fails == 0 ? 0 : 1;

static string FindFilm()
{
    var d = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (d != null && !Directory.Exists(Path.Combine(d.FullName, "Game", "Assets"))) d = d.Parent;
    return d == null ? null : Path.Combine(d.FullName, "Game", "Assets", "_Project", "Art", "Resources", "Cinema", "title_intro.bytes");
}

// Every cue kind 0-15, eight scenes in ten seconds, like the film is meant to be.
static List<CinemaCue> DemoCues()
{
    var l = new List<CinemaCue>();
    void Add(double t, int kind, int pan = 0, int level = 100, int dur = 0) => l.Add(new CinemaCue(kind, (int)Math.Round(t * 30), pan, level, dur));
    foreach (double t in new[] { 0, 1.3, 2.4, 3.7, 5.0, 6.2, 7.2, 8.1 }) Add(t, CinemaKind.Shot);
    Add(.4, CinemaKind.Flak, -40, 70); Add(.8, CinemaKind.Flak, 30, 90);
    Add(1.6, CinemaKind.Whoosh, 80); Add(1.5, CinemaKind.Flak, -20, 60); Add(2.0, CinemaKind.Whoosh, -80);
    Add(2.45, CinemaKind.Gunners, 40, 60, 20); Add(2.7, CinemaKind.Burst, 0, 100, 18); Add(3.0, CinemaKind.Cannon, 10, 90, 12); Add(3.4, CinemaKind.Hit, 10);
    Add(3.75, CinemaKind.Rumble, -50, 60, 45); Add(4.1, CinemaKind.HeavyPass, 30); Add(4.5, CinemaKind.BigBoom); Add(4.52, CinemaKind.Hit, 20, 80);
    Add(5.1, CinemaKind.Burst, 0, 100, 12); Add(5.4, CinemaKind.Cannon, -30, 110, 20); Add(5.7, CinemaKind.Hit, -20); Add(5.8, CinemaKind.Fire, 0, 80, 30);
    Add(6.3, CinemaKind.Rumble, 50, 50, 30); Add(6.4, CinemaKind.Whoosh, -70); Add(6.8, CinemaKind.Boom, 40);
    Add(7.3, CinemaKind.FlakNear, 50); Add(7.6, CinemaKind.BigBoom); Add(7.62, CinemaKind.Fireball, 0, 100, 15);
    Add(8.3, CinemaKind.Flak, 70, 40); Add(8.4, CinemaKind.Gunners, -60, 50, 25); Add(8.8, CinemaKind.Title); Add(9.2, CinemaKind.BarsOff);
    l.Sort((a, b) => a.Frame.CompareTo(b.Frame));
    return l;
}

static string FindBank()
{
    var d = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (d != null && !Directory.Exists(Path.Combine(d.FullName, "Game", "Assets"))) d = d.Parent;
    return d == null ? "CinemaSfx" : Path.Combine(d.FullName, "Game", "Assets", "_Project", "Audio", "SFX", "Cinema", "Resources", "CinemaSfx");
}

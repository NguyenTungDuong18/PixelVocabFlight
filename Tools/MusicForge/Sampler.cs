using System.Collections.Concurrent;


namespace MusicForge;

// One note of the score. Beat 0 = bar 1 beat 1 of the piece being rendered (intro or loop); 1 beat = 0.6 s at 100 bpm.
public sealed class Note
{
    public string Inst;
    public double Beat, Len;        // in beats; Len is ignored by one-shot instruments
    public int Key;                 // MIDI, C4 = 60
    public double Vel, VelEnd = -1; // 1..127; VelEnd >= 0 ramps the dynamic over the note (crossfades the recorded layers)
    public bool Legato, LegatoOut;  // slurred from / into the neighbouring note of the same line
    public bool Exact;              // no humanize and no early start (the logo hit on sample 0)
    public bool AlignPeak;          // place the sample's loudest point on Beat (cymbal swells)
    public double GainDb, Pan = double.NaN;
    public override string ToString() => $"{Inst} b{Beat / 4 + 1:0.00} k{Key} v{Vel:0}";
}

public sealed class Smp
{
    public float[] L, R; public int N;
    public int LoopS, LoopE, Xf;    // sustain loop for notes longer than the recording (LoopE = 0: none)
    public int PeakAt;              // loudest 46 ms frame (swells)
}

// Loads each WAV once (thread-safe), trims the silence before the attack and finds a sustain loop.
public static class Bank
{
    public static string Root;
    static readonly ConcurrentDictionary<string, Lazy<Smp>> cache = new();
    public static Smp Get(string rel) => cache.GetOrAdd(rel, r => new Lazy<Smp>(() => Load(r))).Value;

    static Smp Load(string rel)
    {
        var (wl, wr, rate) = Wav.Read(File.ReadAllBytes(Fetch.Local(Root, rel)), rel);
        if (rate != Mix.Rate) throw new Exception(rel + ": cần 44,1 kHz");
        var w = (L: wl, R: wr); int n = wl.Length; float peak = 1e-9f;
        for (int i = 0; i < n; i++) peak = Math.Max(peak, Math.Max(Math.Abs(w.L[i]), Math.Abs(w.R[i])));
        float thr = peak * 0.0056f;   // -45 dB under the sample's peak = where the sound starts
        int first = 0; while (first < n - 1 && Math.Abs(w.L[first]) < thr && Math.Abs(w.R[first]) < thr) first++;
        int start = Math.Max(0, first - 88);   // keep 2 ms before the attack
        var s = new Smp { N = n - start, L = w.L[start..], R = w.R[start..] };
        // 46 ms RMS frames, hop 23 ms.
        const int F = 2048, H = 1024; int frames = Math.Max(1, (s.N - F) / H);
        var env = new double[frames];
        for (int k = 0; k < frames; k++)
        {
            double e = 0; for (int i = k * H; i < k * H + F; i++) { double m = (s.L[i] + s.R[i]) * .5; e += m * m; }
            env[k] = Math.Sqrt(e / F);
        }
        int pk = 0; for (int k = 1; k < frames; k++) if (env[k] > env[pk]) pk = k;
        s.PeakAt = pk * H + F / 2;
        // Sustain loop: the body level is the median of 0.3 s .. 70 %; the loop ends where the level last stays above body - 6 dB.
        int a = (int)(.3 * Mix.Rate / H), z = (int)(frames * .7);
        if (z - a > 10)
        {
            var body = env[a..z].OrderBy(x => x).ToArray(); double med = body[body.Length / 2];
            int e = z; while (e + 1 < frames && env[e + 1] >= med * .5) e++;
            int E = Math.Min(e * H + F / 2, s.N - 4410);
            int len = Math.Min((int)(1.6 * Mix.Rate), E - (int)(.35 * Mix.Rate));
            if (len > (int)(.5 * Mix.Rate)) { s.LoopE = E; s.LoopS = E - len; s.Xf = Math.Min((int)(.35 * Mix.Rate), (int)(len * .4)); }
        }
        return s;
    }
}

// Plays the notes of one instrument into a stereo track. Deterministic: one seeded RNG and round-robin counter per instrument.
public sealed class Player
{
    public const double VelTrack = .75;   // share of the SFZ's velocity->gain curve (100 % = (v/127)^2) kept on top of the layer changes
    readonly Inst inst; readonly List<Region> regions; readonly int[] centers; readonly int minKey, maxKey;
    readonly Random rng; readonly Dictionary<int, int> rr = new();
    public readonly List<string> Warnings = new();
    public double MaxShift;

    public Player(Inst inst, string cache, int seed)
    {
        this.inst = inst;
        regions = Sfz.Parse(File.ReadAllText(Path.Combine(cache, inst.Sfz)))
            .Where(r => inst.Keys == null || inst.Keys.Any(k => k >= r.LoKey && k <= r.HiKey)).ToList();
        if (regions.Count == 0) throw new Exception(inst.Name + ": SFZ không có vùng nào");
        centers = regions.Select(r => r.Center).Distinct().OrderBy(c => c).ToArray();
        minKey = regions.Min(r => r.LoKey); maxKey = regions.Max(r => r.HiKey);
        rng = new Random(seed);
    }

    double U() => rng.NextDouble();
    double G() => (U() + U() + U() - 1.5) * 2 / 1.5;   // ~normal, |x| <= 2

    public void Play(Note n, float[] outL, float[] outR, int origin)
    {
        int key = n.Key;
        if (inst.Keys == null && (key < minKey - 4 || key > maxKey + 4))
        {
            int k2 = key; while (k2 < minKey) k2 += 12; while (k2 > maxKey) k2 -= 12;
            Warnings.Add($"{n}: ngoài dải {minKey}-{maxKey}, chuyển quãng 8 -> {k2}"); key = k2;
        }
        double sec = n.Beat * Mix.Beat;
        double v0 = n.Vel, v1 = n.VelEnd >= 0 ? n.VelEnd : n.Vel;
        if (!n.Exact) { double h = G() * inst.HumanVel * .5; v0 += h; v1 += h; }
        v0 = Math.Clamp(v0, 1, 127); v1 = Math.Clamp(v1, 1, 127);
        double lead = n.Exact || n.Legato || inst.OneShot ? 0 : inst.Lead * (1.6 - Math.Min(v0, v1) / 127);
        // Copies use the nearest other recordings (other key centres), a softer/louder layer and the next round robin.
        int[] near = centers.Where(c => Math.Abs(c - key) <= 4).OrderBy(c => Math.Abs(c - key)).ThenBy(c => c).ToArray();
        for (int c = 0; c < inst.Copies; c++)
        {
            List<Region> pool;
            if (c == 0 || near.Length < 2) pool = regions.Where(r => key >= r.LoKey && key <= r.HiKey).ToList();
            else pool = regions.Where(r => r.Center == near[c % near.Length]).ToList();
            if (pool.Count == 0)
            {
                int best = centers.OrderBy(x => Math.Abs(x - key)).First();
                pool = regions.Where(r => r.Center == best).ToList();
            }
            int count = rr.TryGetValue(key, out int q) ? q : 0; rr[key] = count + 1;
            int seqLen = pool.Max(r => r.SeqLength), pos = count % seqLen + 1;
            double rnd = U();
            pool = pool.Where(r => (r.SeqLength == 1 || r.SeqPosition == pos) && rnd >= r.LoRand && rnd < r.HiRand).ToList();
            if (pool.Count == 0) continue;
            double dv = c == 0 ? 0 : c % 2 == 1 ? -11 : 9;
            double dt = n.Exact ? 0 : G() * inst.HumanMs * .0005 + (c == 0 ? 0 : (.3 + .7 * U()) * inst.SpreadMs * .001);
            double cents = n.Exact ? 0 : G() * inst.HumanCents * .5 + (c == 0 ? 0 : (U() * 2 - 1) * inst.DetuneCents);
            double pan = (double.IsNaN(n.Pan) ? inst.Pan : n.Pan) + (c == 0 ? 0 : (c % 2 == 1 ? -1 : 1) * inst.PanSpread * (.5 + .5 * U()));
            double copyGain = c == 0 ? 0 : -1.5;
            int at = origin + (int)Math.Round((sec + dt - lead) * Mix.Rate);
            if (n.AlignPeak)
            {
                var r0 = pool[0]; at -= (int)(Bank.Get(r0.Sample).PeakAt / Math.Pow(2, (key - r0.Center) / 12.0));
            }
            double lenSec = n.Len * Mix.Beat + lead;
            Voice(n, pool, key, Math.Clamp(v0 + dv, 1, 127), Math.Clamp(v1 + dv, 1, 127), cents, pan, copyGain, at, lenSec, outL, outR);
        }
    }

    void Voice(Note n, List<Region> pool, int key, double v0, double v1, double cents, double pan, double gainDb,
               int at, double lenSec, float[] outL, float[] outR)
    {
        // Velocity layers of this sample position, softest first.
        var layers = pool.GroupBy(r => r.LoVel).OrderBy(g => g.Key).Select(g => g.First()).ToArray();
        bool oneShot = inst.OneShot;
        double[] wts(double v)
        {
            var w = new double[layers.Length];
            if (layers.Length == 1) { w[0] = 1; return w; }
            if (oneShot) { int j = 0; while (j < layers.Length - 1 && v > layers[j].HiVel) j++; w[j] = 1; return w; }
            if (v <= layers[0].VelCenter) { w[0] = 1; return w; }
            if (v >= layers[^1].VelCenter) { w[^1] = 1; return w; }
            for (int j = 0; j < layers.Length - 1; j++)
                if (v < layers[j + 1].VelCenter)
                {
                    double a = (v - layers[j].VelCenter) / (layers[j + 1].VelCenter - layers[j].VelCenter);
                    w[j] = Math.Cos(a * Math.PI / 2); w[j + 1] = Math.Sin(a * Math.PI / 2); return w;
                }
            w[^1] = 1; return w;
        }
        var wa = wts(v0); var wb = wts(v1);
        int noteLen = (int)(lenSec * Mix.Rate);
        double rel = n.LegatoOut ? .14 : inst.Release >= 0 ? inst.Release : Math.Min(layers[0].Release, 3);
        double att = n.Exact ? .002 : n.Legato ? .05 : inst.AttackSoft + (inst.AttackLoud - inst.AttackSoft) * Math.Clamp((v0 - 30) / 85, 0, 1);
        int attN = Math.Max(1, (int)(att * Mix.Rate)), relN = (int)(rel * Mix.Rate);
        double mid = .5, wid = inst.Width * .5;
        double th = (Math.Clamp(pan, -1, 1) + 1) * Math.PI / 4; float gl = (float)(Math.Cos(th) * Math.Sqrt(2)), gr = (float)(Math.Sin(th) * Math.Sqrt(2));
        for (int j = 0; j < layers.Length; j++)
        {
            if (wa[j] < 1e-4 && wb[j] < 1e-4) continue;
            var reg = layers[j]; var s = Bank.Get(reg.Sample);
            double shift = key - reg.Center; MaxShift = Math.Max(MaxShift, Math.Abs(shift));
            double ratio = Math.Pow(2, (shift + (cents + reg.Tune) / 100) / 12);
            double p = n.Legato ? .08 * Mix.Rate : 0;
            int total = oneShot ? (int)((s.N - 3 - p) / ratio) : noteLen + relN;
            float lpY0 = 0, lpY1 = 0; float g = 0, lpA = 1;
            for (int i = 0; i < total; i++, p += ratio)
            {
                if ((i & 63) == 0)
                {
                    double f = noteLen > 0 ? Math.Min(1, (double)i / noteLen) : 1, v = v0 + (v1 - v0) * f;
                    double w = wa[j] + (wb[j] - wa[j]) * f;   // weights follow the dynamic curve
                    if (v0 != v1) w = wts(v)[j];
                    double db = reg.VolumeDb + VelTrack * 40 * Math.Log10(v / 127) + inst.GainDb + n.GainDb + gainDb
                              + (reg.LoVel == 0 && reg.HiVel < 127 ? inst.SoftLayerDb : 0);
                    g = (float)(w * Math.Pow(10, db / 20));
                    if (inst.DarkHz > 0) { double fc = Math.Min(18000, inst.DarkHz * Math.Pow(6, (v - 20) / 107)); lpA = (float)(1 - Math.Exp(-2 * Math.PI * fc / Mix.Rate)); }
                }
                double pp = p;
                float l, r;
                if (!oneShot && s.LoopE > 0 && pp >= s.LoopE - s.Xf)
                {
                    int ll = s.LoopE - s.LoopS;
                    if (pp >= s.LoopE) pp = s.LoopS + (pp - s.LoopS) % ll;
                    if (pp >= s.LoopE - s.Xf)
                    {
                        double a = (pp - (s.LoopE - s.Xf)) / s.Xf; float ca = (float)Math.Cos(a * Math.PI / 2), sa = (float)Math.Sin(a * Math.PI / 2);
                        l = ca * Herm(s.L, pp) + sa * Herm(s.L, pp - ll); r = ca * Herm(s.R, pp) + sa * Herm(s.R, pp - ll);
                    }
                    else { l = Herm(s.L, pp); r = Herm(s.R, pp); }
                }
                else
                {
                    if (pp >= s.N - 3) break;
                    l = Herm(s.L, pp); r = Herm(s.R, pp);
                }
                float env = 1;
                if (i < attN) { float x = (float)i / attN; env = x * x * (3 - 2 * x); }
                if (!oneShot && i >= noteLen) { env *= (float)Math.Exp(-6.9 * (i - noteLen) / relN); }
                if (lpA < 1) { lpY0 += lpA * (l - lpY0); lpY1 += lpA * (r - lpY1); l = lpY0; r = lpY1; }
                float m = (float)((l + r) * mid), sd = (float)((l - r) * wid);
                int o = at + i; if (o < 0 || o >= outL.Length) continue;
                float k = g * env;
                outL[o] += (m + sd) * gl * k; outR[o] += (m - sd) * gr * k;
            }
        }
    }

    static float Herm(float[] x, double p)
    {
        int i = (int)p; float f = (float)(p - i);
        float xm1 = x[i > 0 ? i - 1 : 0], x0 = x[i], x1 = x[i + 1], x2 = x[i + 2];
        float c = (x1 - xm1) * .5f, v = x0 - x1, w = c + v, a = w + v + (x2 - x0) * .5f, b = w + a;
        return ((a * f - b) * f + c) * f + x0;
    }
}

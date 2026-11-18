// Keeps the frames of an MP3 file that cover [from, to] seconds (minus one second of lead-in for the decoder's bit reservoir) and writes
// <out>.mp3 plus <out>.mp3.start (the time of the first kept frame), so the recipe keeps using the original times. Used to keep long
// recordings in SourceAssets/Audio/Cinema small: only the part the bank uses is stored.
static class Mp3Trim
{
    static readonly int[] BitrateV1L3 = { 0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0 };
    static readonly int[] BitrateV2L3 = { 0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0 };
    static readonly int[] RateV1 = { 44100, 48000, 32000, 0 };

    public static bool Run(string input, string output, double from, double to)
    {
        var d = File.ReadAllBytes(input);
        int p = 0;
        if (d.Length > 10 && d[0] == 'I' && d[1] == 'D' && d[2] == '3') p = 10 + ((d[6] << 21) | (d[7] << 14) | (d[8] << 7) | d[9]);
        var frames = new List<(int at, int len, double t)>(); double t = 0;
        while (p + 4 <= d.Length)
        {
            if (d[p] != 0xFF || (d[p + 1] & 0xE0) != 0xE0) { p++; continue; }
            int version = (d[p + 1] >> 3) & 3, layer = (d[p + 1] >> 1) & 3, br = d[p + 2] >> 4, sr = (d[p + 2] >> 2) & 3, pad = (d[p + 2] >> 1) & 1;
            if (version == 1 || layer != 1 || br == 0 || br == 15 || sr == 3) { p++; continue; }   // only Layer III
            bool v1 = version == 3; int rate = RateV1[sr] / (version == 3 ? 1 : version == 2 ? 2 : 4);
            int kbps = v1 ? BitrateV1L3[br] : BitrateV2L3[br], samples = v1 ? 1152 : 576, len = (v1 ? 144 : 72) * kbps * 1000 / rate + pad;
            if (p + len > d.Length) break;
            frames.Add((p, len, t)); t += samples / (double)rate; p += len;
        }
        if (frames.Count == 0) return false;
        int first = frames.FindIndex(f => f.t >= from - 1.0), last = frames.FindLastIndex(f => f.t <= to + .3);
        if (first < 0) first = 0; if (last < first) last = frames.Count - 1;
        using (var o = File.Create(output)) for (int k = first; k <= last; k++) o.Write(d, frames[k].at, frames[k].len);
        File.WriteAllText(output + ".start", frames[first].t.ToString("0.#####", System.Globalization.CultureInfo.InvariantCulture));
        return true;
    }
}

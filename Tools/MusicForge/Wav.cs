namespace MusicForge;

// Reads the VSCO WAVs (PCM 16 or 24-bit, 1-2 channels; some are 24-bit, which the game's CinemaWav does not read). Data only.
public static class Wav
{
    public static (float[] l, float[] r, int rate) Read(byte[] d, string name)
    {
        if (d.Length < 44 || d[0] != 'R' || d[1] != 'I' || d[2] != 'F' || d[3] != 'F') throw new InvalidDataException(name + ": không phải WAV");
        int ch = 0, rate = 0, bits = 0, fmt = 0, at = -1, len = 0;
        for (int p = 12; p + 8 <= d.Length;)
        {
            int n = BitConverter.ToInt32(d, p + 4); string id = System.Text.Encoding.ASCII.GetString(d, p, 4); int body = p + 8;
            if (n < 0 || body + n > d.Length) n = d.Length - body;
            if (id == "fmt ") { fmt = BitConverter.ToUInt16(d, body); ch = BitConverter.ToUInt16(d, body + 2); rate = BitConverter.ToInt32(d, body + 4); bits = BitConverter.ToUInt16(d, body + 14); }
            else if (id == "data") { at = body; len = n; }
            p = body + n + (n & 1);
        }
        if (at < 0 || ch < 1 || ch > 2 || !(fmt == 1 || fmt == 0xFFFE) || (bits != 16 && bits != 24)) throw new InvalidDataException($"{name}: định dạng {fmt}/{bits}-bit/{ch} kênh không hỗ trợ");
        int bp = bits / 8, frames = len / (bp * ch);
        var l = new float[frames]; var r = ch == 2 ? new float[frames] : l;
        for (int i = 0, q = at; i < frames; i++)
            for (int c = 0; c < ch; c++, q += bp)
            {
                float v = bits == 16 ? BitConverter.ToInt16(d, q) / 32768f : ((d[q] << 8 | d[q + 1] << 16 | d[q + 2] << 24) >> 8) / 8388608f;
                if (c == 0) l[i] = v; else r[i] = v;
            }
        return (l, r, rate);
    }
}

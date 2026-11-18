using System;
using System.Collections.Generic;
using System.IO;

namespace PixelVocabFlight
{
    // One recorded sound of the intro bank: 44.1 kHz float samples (R is the same array as L for a mono recording) and, for a "kit" (many
    // short variants of one sound in a single file), the slices that mark each variant.
    public sealed class CinemaSample
    {
        public int Rate = CinemaDsp.Rate;
        public float[] L, R;
        public int[] SliceStart = new int[0], SliceLength = new int[0];

        public bool Mono => ReferenceEquals(L, R);
        public int Length => L.Length;
        public double Seconds => (double)L.Length / Rate;
        public int Slices => SliceStart.Length;

        public static CinemaSample FromMono(float[] m, int rate = CinemaDsp.Rate) => new CinemaSample { L = m, R = m, Rate = rate };
        public static CinemaSample FromStereo(float[] l, float[] r, int rate = CinemaDsp.Rate) => new CinemaSample { L = l, R = r, Rate = rate };

        // A variant of a kit as a sound of its own (a copy).
        public CinemaSample Slice(int k)
        {
            int a = SliceStart[k], n = SliceLength[k];
            var l = new float[n]; Array.Copy(L, a, l, 0, n);
            if (Mono) return FromMono(l, Rate);
            var r = new float[n]; Array.Copy(R, a, r, 0, n);
            return FromStereo(l, r, Rate);
        }

        public Stereo ToStereo()
        {
            var s = new Stereo(L.Length); Array.Copy(L, s.L, L.Length); Array.Copy(R, s.R, L.Length);
            return s;
        }
    }

    // Reads and writes the bank's WAV files (PCM 16-bit, or 32-bit float on reading; pure C# so the game and the tools share it). A private
    // chunk 'slic' (u32 count, then u32 start and u32 length in frames for each) carries the slices of a kit; other programs ignore it.
    public static class CinemaWav
    {
        public static CinemaSample Read(byte[] d, string name = "wav")
        {
            if (d == null || d.Length < 44 || d[0] != 'R' || d[1] != 'I' || d[2] != 'F' || d[3] != 'F' || d[8] != 'W' || d[9] != 'A' || d[10] != 'V' || d[11] != 'E')
                throw new InvalidDataException(name + ": không phải file WAV");
            int ch = 0, rate = 0, bits = 0, format = 0, dataAt = -1, dataLen = 0, slicAt = -1;
            for (int p = 12; p + 8 <= d.Length;)
            {
                int len = BitConverter.ToInt32(d, p + 4);
                string id = "" + (char)d[p] + (char)d[p + 1] + (char)d[p + 2] + (char)d[p + 3];
                int body = p + 8;
                if (len < 0 || body + len > d.Length) len = Math.Max(0, d.Length - body);   // a cut file: keep what is there
                if (id == "fmt ")
                {
                    format = BitConverter.ToUInt16(d, body); ch = BitConverter.ToUInt16(d, body + 2);
                    rate = BitConverter.ToInt32(d, body + 4); bits = BitConverter.ToUInt16(d, body + 14);
                }
                else if (id == "data") { dataAt = body; dataLen = len; }
                else if (id == "slic") slicAt = body;
                p = body + len + (len & 1);
            }
            if (dataAt < 0 || ch < 1 || ch > 2 || !((format == 1 && bits == 16) || (format == 3 && bits == 32)))
                throw new InvalidDataException(name + ": cần WAV PCM 16-bit hoặc float 32-bit, 1-2 kênh");
            int bytesPer = bits / 8, frames = dataLen / (bytesPer * ch);
            var l = new float[frames]; var r = ch == 2 ? new float[frames] : l;
            for (int i = 0, q = dataAt; i < frames; i++)
            {
                for (int c = 0; c < ch; c++, q += bytesPer)
                {
                    float v = bits == 16 ? BitConverter.ToInt16(d, q) / 32768f : BitConverter.ToSingle(d, q);
                    if (c == 0) l[i] = v; else r[i] = v;
                }
            }
            var s = new CinemaSample { Rate = rate, L = l, R = r };
            if (slicAt >= 0)
            {
                int count = BitConverter.ToInt32(d, slicAt);
                s.SliceStart = new int[count]; s.SliceLength = new int[count];
                for (int k = 0; k < count; k++)
                {
                    s.SliceStart[k] = BitConverter.ToInt32(d, slicAt + 4 + 8 * k); s.SliceLength[k] = BitConverter.ToInt32(d, slicAt + 8 + 8 * k);
                    if (s.SliceStart[k] < 0 || s.SliceLength[k] <= 0 || s.SliceStart[k] + s.SliceLength[k] > frames) throw new InvalidDataException(name + ": đoạn cắt " + k + " nằm ngoài file");
                }
            }
            return s;
        }

        public static byte[] Write(CinemaSample s)
        {
            int ch = s.Mono ? 1 : 2, frames = s.Length, bytes = frames * ch * 2, slic = s.Slices > 0 ? 8 + 4 + 8 * s.Slices : 0;
            using var m = new MemoryStream(44 + bytes + slic);
            using var w = new BinaryWriter(m);
            w.Write(new[] { 'R', 'I', 'F', 'F' }); w.Write(36 + bytes + slic); w.Write(new[] { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
            w.Write(16); w.Write((short)1); w.Write((short)ch); w.Write(s.Rate); w.Write(s.Rate * ch * 2); w.Write((short)(ch * 2)); w.Write((short)16);
            w.Write(new[] { 'd', 'a', 't', 'a' }); w.Write(bytes);
            for (int i = 0; i < frames; i++)
            {
                w.Write(Pcm(s.L[i]));
                if (ch == 2) w.Write(Pcm(s.R[i]));
            }
            if (slic > 0)
            {
                w.Write(new[] { 's', 'l', 'i', 'c' }); w.Write(4 + 8 * s.Slices); w.Write(s.Slices);
                for (int k = 0; k < s.Slices; k++) { w.Write(s.SliceStart[k]); w.Write(s.SliceLength[k]); }
            }
            w.Flush();
            return m.ToArray();
        }

        private static short Pcm(float v) => (short)Math.Round(Math.Max(-1f, Math.Min(1f, v)) * 32767);
    }
}

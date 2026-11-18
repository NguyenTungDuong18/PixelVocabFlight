using PixelVocabFlight;
using static Proc;

// Aeroplanes passing: the loudest moment of a recorded fly-by, cut around it.
static partial class Recipe
{
    static void Passes()
    {
        // flyby: a fighter at the lens. 437796 (CC0, the first 1.3 s) and two Spitfires (142901, CC BY 3.0, 17.6-20 s around the closest point).
        var a = Mono("437796"); var b = Mono("142901");
        var fa = Cut(a, 0, 1.3); var fb = Cut(b, 17.6, 20.0);
        Eq(fa, Kind.High, 90, 0, .7071, 1); Eq(fb, Kind.High, 90, 0, .7071, 1);
        Fade(fa, 5, 120); Fade(fb, 250, 400);
        Out("flyby", Kit(new List<float[]> { fa, fb }), "437796 [0-1,3 s] + 142901 [17,6-20 s]");

        // heavy: four-engine bombers right overhead. 162240 (CC0, around 9 s) and Lancaster (325563, CC BY 4.0, around 34 s; stereo, mono here).
        var c = Mono("162240"); var d = Mono("325563");
        var ha = Cut(c, 7.2, 10.8); var hb = Cut(d, 32.4, 36.0);
        Eq(ha, Kind.High, 35, 0, .7071, 1); Eq(hb, Kind.High, 28, 0, .7071, 1); Eq(ha, Kind.LowShelf, 130, 5); Eq(hb, Kind.LowShelf, 130, 3);
        Fade(ha, 300, 500); Fade(hb, 300, 500);
        Out("heavy", Kit(new List<float[]> { ha, hb }), "162240 [7,2-10,8 s] + 325563 [32,4-36 s]");
    }
}

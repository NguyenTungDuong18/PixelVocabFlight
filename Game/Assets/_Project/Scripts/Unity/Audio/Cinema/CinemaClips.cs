using System;

namespace PixelVocabFlight
{
    // Each intro sound on its own: for the story ids (StorySound("bigboom") ...) and for Tools/AudioChecks, which writes and measures them.
    public static class CinemaClips
    {
        // Names of the solo sounds in order; loops first.
        public static readonly string[] Names =
        {
            "engine_v12", "engine_cabin", "engine_grit", "bomber_hum", "wind", "whistle", "fire",
            "mg_single", "burst", "cannon_single", "cannon", "gunners", "hit",
            "flak", "flaknear", "boom", "bigboom", "fireball", "rumble",
            "whoosh", "heavypass", "title",
        };

        public static bool IsLoop(string name) => Array.IndexOf(Names, name) >= 0 && Array.IndexOf(Names, name) < 7;

        // The sound with typical settings (the length of the cue as the film would give it).
        public static Stereo Solo(string name, CinemaBank bank)
        {
            var r = new Rng(900 + name.Length * 13 + name[0]);
            switch (name)
            {
                case "engine_v12": return CinemaLoops.EngineV12(bank);
                case "engine_cabin": return CinemaLoops.EngineCabin(CinemaLoops.EngineV12(bank));
                case "engine_grit": return CinemaLoops.EngineGrit(CinemaLoops.EngineV12(bank));
                case "bomber_hum": return CinemaLoops.BomberHum(bank);
                case "wind": return CinemaLoops.Wind(bank).Wind;
                case "whistle": return CinemaLoops.Wind(bank).Whistle;
                case "fire": return CinemaLoops.Fire(bank);
                case "mg_single": return Stereo.FromMono(CinemaGuns.WingGun(bank, r, 30));
                case "burst": return Stereo.FromMono(CinemaGuns.WingGuns(bank, r, 30));
                case "cannon_single": return Stereo.FromMono(CinemaGuns.Cannon(bank, r, 30, false));
                case "cannon": return Stereo.FromMono(CinemaGuns.Cannon(bank, r, 30));
                case "gunners": return CinemaGuns.FarGuns(bank, r, 30);
                case "hit": return Stereo.FromMono(CinemaGuns.Hits(bank, r));
                case "flak": return Stereo.FromMono(CinemaBlasts.FlakFar(bank, r));
                case "flaknear": return CinemaBlasts.FlakNear(bank, r);
                case "boom": return Stereo.FromMono(CinemaBlasts.Boom(bank, r));
                case "bigboom": return CinemaBlasts.BigBoom(bank, r);
                case "fireball": return CinemaBlasts.Fireball(bank, r, 15);
                case "rumble": return Stereo.FromMono(CinemaBlasts.Rumble(bank, r, 45));
                case "whoosh": return CinemaPasses.Whoosh(bank, r, CinemaLoops.EngineV12(bank), 80, 0);
                case "heavypass": return CinemaPasses.HeavyPass(bank, r, CinemaLoops.BomberHum(bank), 40);
                case "title": return CinemaBlasts.Title(r);
                default: return null;
            }
        }

        // The ids of StoryBeat.Sounds that belong to the film (the old intro one-shots keep playing if a story asks for them).
        public static bool IsStoryId(string id)
        {
            switch (id) { case "wind": case "engines": case "burst": case "boom": case "bigboom": case "whoosh": case "flak": case "hit": case "title": return true; default: return false; }
        }

        public static Stereo ForStoryId(string id, CinemaBank bank)
        {
            switch (id)
            {
                case "wind": return CinemaLoops.Wind(bank).Wind;
                case "engines": return CinemaLoops.EngineV12(bank);
                case "burst": case "boom": case "bigboom": case "whoosh": case "flak": case "hit": case "title": return Solo(id, bank);
                default: return null;
            }
        }

        public static float[] Interleave(Stereo s)
        {
            var o = new float[s.Length * 2];
            for (int i = 0; i < s.Length; i++) { o[2 * i] = s.L[i]; o[2 * i + 1] = s.R[i]; }
            return o;
        }
    }
}

using PixelVocabFlight;
using System.Text.Json;

internal static partial class WorldChecks
{
    // Manifest sync is its own group: the pixel pipeline may lag behind, so it reports every missing sprite at once.
    public static int RunManifest(string manifestPath)
    {
        int checks = 0;
        var problems = new List<string>();
        var missing = new List<string>();
        void Check(bool pass, string message) { checks++; if (!pass) problems.Add(message); }

        var sprites = new Dictionary<string, JsonElement>();
        using var doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
        foreach (var sprite in doc.RootElement.GetProperty("sprites").EnumerateArray())
            sprites[sprite.GetProperty("name").GetString()] = sprite.Clone();
        int Int(JsonElement e, string field) => e.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
        bool Has(string name)
        {
            checks++;
            if (sprites.ContainsKey(name)) return true;
            missing.Add(name);
            return false;
        }
        void Frames(string name, int frames) { if (Has(name)) Check(Int(sprites[name], "frames") == frames, name + " has " + frames + " frames (manifest " + Int(sprites[name], "frames") + ")"); }

        Check(doc.RootElement.GetProperty("version").GetString() == "0.15.0", "manifest version 0.15.0");
        foreach (var m in WorldModels.All)
        {
            int frames = -1;
            foreach (var f in Facings.All)
            {
                string name = WorldModels.SpriteName(m.Id, f);
                if (!Has(name)) continue;
                var e = sprites[name];
                var foot = WorldModels.Footprint(m, f);
                Check(Int(e, "footW") == foot.w && Int(e, "footH") == foot.h, name + " footprint " + foot.w + "×" + foot.h + " (manifest " + Int(e, "footW") + "×" + Int(e, "footH") + ")");
                Check(Int(e, "anchorY") > 0 && Int(e, "anchorX") >= 0 && Int(e, "anchorX") <= Int(e, "width") && Int(e, "anchorY") <= Int(e, "height"), name + " anchor inside the sprite");
                Check(Int(e, "width") >= foot.w * 16 && Int(e, "anchorX") + foot.w * 16 <= Int(e, "width"), name + " sprite wide enough for its footprint");
                if (frames < 0) frames = Int(e, "frames");
                Check(Int(e, "frames") == frames, m.Id + " has the same frame count in all facings");
            }
            if (frames >= 0) Check(frames == m.Frames, m.Id + " has " + m.Frames + " frames (manifest " + frames + ")");
        }
        var characters = new List<string> { BaseContent.PlayerCharacter };
        characters.AddRange(BaseContent.Roster.Values.Select(n => n.Character));
        foreach (var cid in characters.Distinct())
        {
            foreach (var f in Facings.All)
            {
                // 0.15 animation polish: 8-frame breathing idle (blink on frame 6), 8-frame walk and run
                // cycles whose contact frames are 0 and 4 (BaseView syncs footsteps and dust to them).
                Frames("chr_" + cid + "_idle_" + WorldModels.Suffix(f), 8);
                Frames("chr_" + cid + "_walk_" + WorldModels.Suffix(f), 8);
                Frames("chr_" + cid + "_run_" + WorldModels.Suffix(f), 8);
                foreach (var state in new[] { "idle", "walk", "run" })
                {
                    string name = "chr_" + cid + "_" + state + "_" + WorldModels.Suffix(f);
                    Check(sprites.ContainsKey(name), name + " exists");
                    if (sprites.ContainsKey(name)) Check(Int(sprites[name], "width") == 24 && Int(sprites[name], "height") == 32 && Int(sprites[name], "anchorX") == 12 && Int(sprites[name], "anchorY") == 30, name + " is 24×32 anchored at 12,30");
                }
            }
            Frames("portrait_" + cid, 2);
            if (sprites.ContainsKey("portrait_" + cid)) Check(Int(sprites["portrait_" + cid], "width") == 48 && Int(sprites["portrait_" + cid], "height") == 48, "portrait_" + cid + " is 48×48");
        }
        Frames("chr_professor_talk_s", 4);
        Frames("chr_shadow", 1);
        Check(Has("fx_dust"), "fx_dust exists");
        Frames("fx_dust", 5);
        if (Has("fx_dust")) Check(Int(sprites["fx_dust"], "width") == 16 && Int(sprites["fx_dust"], "height") == 8 && Int(sprites["fx_dust"], "anchorX") == 8 && Int(sprites["fx_dust"], "anchorY") == 7, "fx_dust is 16×8 anchored at 8,7");
        Frames("fx_quest_marker", 6);
        foreach (var tile in new[] { ("tile_grass", 4), ("tile_dirt", 4), ("tile_concrete", 4), ("tile_asphalt", 4), ("tile_sand", 2), ("tile_runway", 5), ("tile_water", 4), ("tile_fence", 7) })
            Frames(tile.Item1, tile.Item2);

        if (missing.Count > 0) problems.Insert(0, missing.Count + " sprite(s) missing from pixel-manifest.json: " + string.Join(", ", missing));
        if (problems.Count > 0)
        {
            foreach (var p in problems) Console.WriteLine("MANIFEST FAIL: " + p);
            throw new Exception("FAIL: manifest sync (" + problems.Count + " problem(s), " + missing.Count + " missing sprite(s))");
        }
        Console.WriteLine("PASS: " + checks + " world sprite manifest checks.");
        return checks;
    }
}

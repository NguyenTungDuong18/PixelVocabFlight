using PixelVocabFlight;
using System.Text.Json;

internal static partial class StoryChecks
{
    private static void CheckDormMap()
    {
        var map = Act0Content.Map(Act0Content.DormMapId);
        Check(map.Id == "m1_dorm" && map.Width == 14 && map.Height == 11, "dormitory map is m1_dorm, 14x11");
        // 12x8 walkable boards, everything else Void and solid.
        int boards = 0;
        for (int y = 0; y < map.Height; y++)
            for (int x = 0; x < map.Width; x++)
            {
                var g = map.GroundAt(x, y);
                Check(g == Ground.WoodFloor || g == Ground.Void, "dormitory ground is boards or void at " + x + "," + y);
                if (g == Ground.Void) Check(map.SolidTile(x, y), "void blocks at " + x + "," + y);
                if (g == Ground.WoodFloor) boards++;
            }
        Check(Enumerable.Range(1, 12).All(x => Enumerable.Range(2, 8).All(y => map.GroundAt(x, y) == Ground.WoodFloor)), "12x8 boards inside the room");
        Check(Enumerable.Range(0, 14).All(x => map.GroundAt(x, 0) == Ground.Void && map.GroundAt(x, 10) == Ground.Void), "void above the back wall and below the room");
        Check(!map.AreaFree(0, 0, 1, 1), "void is not free");
        // Placements: known models, inside the map, no overlaps, not on void.
        Check(map.Placements.Select(p => p.Id).Distinct().Count() == map.Placements.Count, "unique placement ids");
        // Each draw layer keeps its own owners: Wall objects hang over the wall's footprint and Floor objects lie under Objects, by design.
        var owners = new Dictionary<PlacementLayer, Dictionary<(int, int), string>>
        {
            [PlacementLayer.Object] = new(), [PlacementLayer.Floor] = new(), [PlacementLayer.Wall] = new(),
        };
        foreach (var p in map.Placements)
        {
            Check(WorldModels.TryGet(p.Model, out _), "model is in WorldModels: " + p.Id + " " + p.Model);
            var f = map.FootprintOf(p);
            var owner = owners[p.Layer];
            Check(f.x >= 0 && f.y >= 0 && f.x + f.w <= map.Width && f.y + f.h <= map.Height, "placement inside the map: " + p.Id);
            for (int y = f.y; y < f.y + f.h; y++)
                for (int x = f.x; x < f.x + f.w; x++)
                {
                    Check(owner.TryAdd((x, y), p.Id), "footprints in one layer do not overlap: " + p.Id + " / " + (owner.TryGetValue((x, y), out var other) ? other : "") + " at " + x + "," + y);
                    Check(map.GroundAt(x, y) == Ground.WoodFloor, "placement stands on boards: " + p.Id);
                }
        }
        var expected = new Dictionary<string, (string model, int w, int h, bool solid)>
        {
            ["bld_dorm_wall"] = ("bld_dorm_wall", 12, 1, true), ["bld_dorm_wall_side"] = ("bld_dorm_wall_side", 1, 8, true),
            ["prop_dorm_window"] = ("prop_dorm_window", 2, 1, false), ["prop_dorm_bed_jonas"] = ("prop_dorm_bed_jonas", 2, 3, true),
            ["prop_dorm_bed_daan"] = ("prop_dorm_bed_daan", 2, 3, true), ["prop_dorm_desk"] = ("prop_dorm_desk", 3, 2, true),
            ["prop_dorm_chair"] = ("prop_dorm_chair", 1, 1, true), ["prop_dorm_trunk"] = ("prop_dorm_trunk", 2, 1, true),
            ["prop_dorm_rug"] = ("prop_dorm_rug", 3, 2, false), ["prop_wall_mailmap"] = ("prop_wall_mailmap", 2, 1, false),
            ["prop_photo_floris"] = ("prop_photo_floris", 1, 1, false), ["prop_handkerchief_nail"] = ("prop_handkerchief_nail", 1, 1, false),
            ["prop_sketchbook_floris"] = ("prop_sketchbook_floris", 1, 1, false), ["prop_poster_airline"] = ("prop_poster_airline", 2, 1, false),
            ["prop_notebook_english"] = ("prop_notebook_english", 1, 1, true), ["prop_letter_daan_mother"] = ("prop_letter_daan_mother", 1, 1, false),
        };
        foreach (var pair in expected)
        {
            Check(WorldModels.TryGet(pair.Key, out var m) && m.FootW == pair.Value.w && m.FootH == pair.Value.h && m.Solid == pair.Value.solid && m.Frames >= 1, "Act 0 model matches the sprite contract: " + pair.Key);
            Check(map.Placements.Any(p => p.Model == pair.Key), "dormitory uses model: " + pair.Key);
        }
        Check(WorldModels.Get("prop_dorm_window").Frames == 2, "window has two frames (closed, open)");
        Check(WorldModels.All.Count == 43 + expected.Count, "43 airbase models + 16 Act 0 models");
        // Story objects.
        var tags = map.Placements.Select(BaseWorld.StoryIdOf).Where(id => id != null).ToList();
        Check(tags.Count == StoryObjects.Length && tags.OrderBy(t => t).SequenceEqual(StoryObjects.OrderBy(t => t)), "story objects: " + string.Join(",", tags));
        Check(BaseWorld.StoryIdOf(new Placement { Tag = "story:" }) == null && BaseWorld.StoryIdOf(new Placement { Tag = "player-aircraft" }) == null && BaseWorld.StoryIdOf(new Placement()) == null, "story tag parsing");
        var daan = map.FindNpc("daan");
        Check(daan != null && daan.Character == "daan" && daan.Dialogue == null && map.Npcs.Count == 1, "Daan is the only NPC and has no dialogue graph");

        // Reachability and real walking.
        var world = new BaseWorld(map, new MissionLog());
        Check(!world.Blocked(map.SpawnX, map.SpawnY) && map.SpawnFacing == Facing.N, "spawn is free");
        var reach = WorldChecks.Reachable(world, map.SpawnX, map.SpawnY);
        int reached = 0;
        for (int x = 0; x < map.Width; x++) for (int y = 0; y < map.Height; y++) if (reach[x, y]) { reached++; Check(map.GroundAt(x, y) == Ground.WoodFloor, "void is out of reach: " + x + "," + y); }
        Check(reached > 40, "a good part of the room is walkable: " + reached);
        Check(WorldChecks.Goal(world, reach, (x, y) => WorldChecks.Dist(x, y, daan.X, daan.Y) <= BaseWorld.InteractRange) != null, "Daan is within interaction range of a reachable tile");
        foreach (var p in map.Placements)
        {
            string id = BaseWorld.StoryIdOf(p);
            if (id == null) continue;
            Check(WorldChecks.Goal(world, reach, (x, y) => world.DistanceToFootprint(p, x, y) <= BaseWorld.InteractRange) != null, "story object reachable: " + id);
        }
        var walker = new BaseWorld(map, new MissionLog());
        foreach (var p in map.Placements)
        {
            string id = BaseWorld.StoryIdOf(p);
            if (id == null) continue;
            walker.StoryActive = s => s == id;
            Check(WorldChecks.Walk(walker, (x, y) => walker.DistanceToFootprint(p, x, y) <= BaseWorld.InteractRange * .7f), "pilot walks to " + id);
            Check(walker.NearestKind == InteractKind.Story && walker.NearestId == id && walker.PromptText == "[E] Xem " + p.DisplayName, "story prompt near " + id);
            while (walker.PopEvent() != null) { }
            walker.Interact();
            var ev = walker.PopEvent();
            Check(ev != null && ev.Kind == WorldEventKind.StoryInteract && ev.EntityId == id && ev.NpcId == id && ev.Text == id && walker.PopEvent() == null, "E sends StoryInteract for " + id);
        }
        walker.StoryActive = s => false;
        walker.Tick(1 / 30f, 0, 0, false);
        Check(walker.NearestKind == InteractKind.None, "inactive story objects offer nothing");
        walker.StoryActive = null;
        walker.Tick(1 / 30f, 0, 0, false);
        Check(walker.NearestKind == InteractKind.Story, "no filter: every story object is usable");
        Check(walker.NearestKind != InteractKind.Npc, "Daan (no graph) is never offered for talking");

        // The room cannot be left.
        foreach (var dir in new[] { (-1f, 0f), (1f, 0f), (0f, -1f), (0f, 1f) })
        {
            var w = new BaseWorld(map, new MissionLog());
            for (int i = 0; i < 300; i++) w.Tick(1 / 30f, dir.Item1, dir.Item2, true);
            Check(w.PlayerX >= 1 + BaseWorld.BodyHalfWidth - .01f && w.PlayerX <= 13 - BaseWorld.BodyHalfWidth + .01f && w.PlayerY >= 2 + BaseWorld.BodyHalfDepth - .01f && w.PlayerY <= 10 - BaseWorld.BodyHalfDepth + .01f, "pilot stays inside the room walking " + dir);
        }

        // LockPlayer freezes movement and interaction.
        var locked = new BaseWorld(map, new MissionLog()) { LockPlayer = true };
        float lx = locked.PlayerX, ly = locked.PlayerY;
        for (int i = 0; i < 30; i++) locked.Tick(1 / 30f, 1, 1, true);
        locked.Interact();
        Check(locked.PlayerX == lx && locked.PlayerY == ly && !locked.Moving && locked.PopEvent() == null, "LockPlayer freezes the pilot");
        locked.LockPlayer = false;
        locked.Tick(.5f, 1, 0, false);
        Check(locked.PlayerX > lx, "pilot moves again after the lock");
    }

    // Draw layers: the rug lies on the floor, wall objects hang on the back wall (row y=1); neither blocks, row y=2 is open floor.
    private static void CheckDormLayers()
    {
        var map = Act0Content.Map(Act0Content.DormMapId);
        var world = new BaseWorld(map, new MissionLog());
        var wallIds = new[] { "window", "wall_mailmap", "photo_floris", "handkerchief", "sketchbook_floris", "letter_daan_mother", "poster_airline" };
        Check(new Placement().Layer == PlacementLayer.Object && map.Find("desk").Layer == PlacementLayer.Object, "Layer defaults to Object");
        foreach (var p in map.Placements)
        {
            var expected = p.Id == "rug" ? PlacementLayer.Floor : wallIds.Contains(p.Id) ? PlacementLayer.Wall : PlacementLayer.Object;
            Check(p.Layer == expected, "placement layer: " + p.Id + " is " + expected);
            if (p.Layer == PlacementLayer.Wall) Check(p.Y == 1 && map.FootprintOf(p).h == 1, "wall object sits on the wall row y=1: " + p.Id);
        }
        var crate = map.Find("notebook_english");
        Check(crate.Layer == PlacementLayer.Object && crate.X == 10 && crate.Y == 3 && WorldModels.Get(crate.Model).Solid, "the crate stays a solid Object at (10,3), beside the head of Daan's bed, out of its headboard sprite");
        Check(!WorldModels.Get("prop_dorm_window").Solid, "the window model is not solid");

        // The solid grid is made of void and solid Objects only (a solid Wall or Floor model would not count).
        for (int y = 0; y < map.Height; y++)
            for (int x = 0; x < map.Width; x++)
            {
                bool expected = map.GroundAt(x, y) == Ground.Void || map.Placements.Any(p => p.Layer == PlacementLayer.Object && WorldModels.Get(p.Model).Solid && Covers(map, p, x, y));
                Check(map.SolidTile(x, y) == expected, "solid grid ignores Wall and Floor layers at " + x + "," + y);
            }
        var solidModel = new MapDef("t", "t", 4, 4, Ground.WoodFloor);
        solidModel.Add("w", "prop_dorm_bed_jonas", Facing.S, 0, 0, layer: PlacementLayer.Wall);
        solidModel.Add("f", "prop_dorm_desk", Facing.S, 1, 2, layer: PlacementLayer.Floor);
        solidModel.Add("o", "prop_dorm_chair", Facing.S, 3, 0);
        Check(!solidModel.SolidTile(0, 0) && !solidModel.SolidTile(1, 2) && !solidModel.SolidTile(3, 3) && solidModel.SolidTile(3, 0), "a solid model on Wall or Floor never blocks, on Object it does");

        // The rug can be walked over everywhere; the whole row y=2 is open.
        var rug = map.Find("rug");
        var rf = map.FootprintOf(rug);
        for (int y = rf.y; y < rf.y + rf.h; y++) for (int x = rf.x; x < rf.x + rf.w; x++) Check(!map.SolidTile(x, y) && !world.Blocked(x + .5f, y + .5f), "rug tile is open floor: " + x + "," + y);
        var reach = WorldChecks.Reachable(world, map.SpawnX, map.SpawnY);
        for (int x = 1; x <= 12; x++)
            Check(!map.SolidTile(x, 2) && reach[x, 2], "row y=2 is walkable: x=" + x);

        // No board tile in the room looks walkable and is not: every tile outside a solid Object's footprint (Daan's own tile aside) is reachable.
        var daan = map.FindNpc("daan");
        int open = 0;
        for (int y = 2; y <= 9; y++)
            for (int x = 1; x <= 12; x++)
            {
                if (map.Placements.Any(p => p.Layer == PlacementLayer.Object && WorldModels.Get(p.Model).Solid && Covers(map, p, x, y))) continue;
                if (x == (int)daan.X && y == (int)daan.Y) continue;
                open++;
                Check(reach[x, y], "board tile that looks open is reachable: " + x + "," + y);
            }
        Check(open > 50, "plenty of open boards: " + open);

        // From row y=2 the pilot can use every wall object and the window.
        foreach (var p in map.Placements.Where(q => q.Layer == PlacementLayer.Wall))
        {
            string id = BaseWorld.StoryIdOf(p);
            var spot = WorldChecks.Goal(world, reach, (x, y) => y < 3 && world.DistanceToFootprint(p, x, y) <= BaseWorld.InteractRange);
            Check(spot != null, "usable from row y=2: " + id);
            var w = new BaseWorld(map, new MissionLog()) { StoryActive = s => s == id };
            w.PlacePlayer(spot.Value.x + .5f, spot.Value.y + .5f, Facing.N);
            Check(w.NearestKind == InteractKind.Story && w.NearestId == id, "pilot on row y=2 is offered " + id);
            w.Interact();
            var ev = w.PopEvent();
            Check(ev != null && ev.Kind == WorldEventKind.StoryInteract && ev.EntityId == id, "E on row y=2 uses " + id);
        }
    }

    private static bool Covers(MapDef map, Placement p, int x, int y)
    {
        var f = map.FootprintOf(p);
        return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h;
    }

    // P1.12: Daan walks to the window along the route in DormRoomMap; routes are straight, ordered and send NpcArrived once.
    private static void CheckDaanRoute()
    {
        var map = Act0Content.Map(Act0Content.DormMapId);
        var world = new BaseWorld(map, new MissionLog());
        var daan = world.Npc("daan");
        Check(!world.NpcWalkTo("nobody", 5, 5, 2) && !world.NpcWalkTo("daan", 5, 5, 0) && !world.NpcWalkTo("daan", -1, 5, 2) && !world.NpcWalkTo("daan", 5, 99, 2) && !world.NpcWalkTo("daan", float.NaN, 5, 2) && !daan.Walking, "bad walk requests are refused");
        float length = 0, px = daan.X, py = daan.Y;
        foreach (var (x, y) in DormRoomMap.DaanWindowRoute)
        {
            Check(world.NpcWalkTo("daan", x, y, DormRoomMap.DaanWalkSpeed), "route leg accepted");
            Check(!WorldChecks.StaticBlocked(map, x, y), "route waypoint is on open floor: " + x + "," + y);
            length += WorldChecks.Dist(px, py, x, y); px = x; py = y;
        }
        Check(daan.Walking, "Daan is walking");
        var window = map.Find("window");
        var last = DormRoomMap.DaanWindowRoute[^1];
        Check(world.DistanceToFootprint(window, last.x, last.y) <= 1f, "the route ends at the window");
        Check(last.x >= window.X && last.x <= window.X + 2 && last.y >= window.Y + 1 && last.y < 3 && !world.Blocked(last.x, last.y), "Daan ends on the open floor right under the window (row y=2)");
        int ticks = 0;
        var arrived = new List<string>();
        while (daan.Walking && ticks < 600)
        {
            world.Tick(1 / 30f, 0, 0, false);
            ticks++;
            for (var e = world.PopEvent(); e != null; e = world.PopEvent()) if (e.Kind == WorldEventKind.NpcArrived) arrived.Add(e.EntityId);
        }
        Check(!daan.Walking && Math.Abs(daan.X - last.x) < .001f && Math.Abs(daan.Y - last.y) < .001f, "Daan reaches the window");
        Check(arrived.SequenceEqual(new[] { "daan" }), "NpcArrived sent once, after the last leg");
        Check(Math.Abs(ticks / 30f - length / DormRoomMap.DaanWalkSpeed) < .1f, "walk takes length / speed seconds (" + ticks / 30f + " s)");
        // Walking continues while the pilot stands still, and the pilot can walk while Daan moves.
        var w2 = new BaseWorld(map, new MissionLog());
        w2.NpcWalkTo("daan", 10f, 4.6f, 2.5f);
        float x0 = w2.PlayerX;
        w2.Tick(.2f, 1, 0, false);
        Check(w2.PlayerX > x0 && w2.Npc("daan").X < 10.7f && w2.Npc("daan").Facing == Facing.W, "pilot and Daan move in the same tick, Daan faces his direction");
    }

    // Full-screen story sprites are 480x270 (x4 = 1920x1080). Sprites not in the manifest yet only warn.
    // Ratchet: while NO story sprite is 480x270 yet (the forge has not run since the size change) the old 480x300 only warns,
    // with a count; as soon as one sprite is 480x270 every story sprite must be, and anything else FAILs.
    public static int RunManifest(string manifestPath)
    {
        var names = new SortedSet<string>();
        foreach (var b in Act0Content.Script) foreach (var s in SpritesOf(b)) names.Add(s);
        var sprites = new Dictionary<string, JsonElement>();
        using var doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
        foreach (var sprite in doc.RootElement.GetProperty("sprites").EnumerateArray()) sprites[sprite.GetProperty("name").GetString()] = sprite.Clone();
        var pending = new List<string>();
        var old = new List<string>();
        int found = 0, current = 0;
        var sizes = new List<(string name, int w, int h)>();
        foreach (var name in names)
        {
            if (!sprites.TryGetValue(name, out var e)) { pending.Add(name); continue; }
            found++;
            sizes.Add((name, e.GetProperty("width").GetInt32(), e.GetProperty("height").GetInt32()));
        }
        bool forged = sizes.Any(s => s.w == 480 && s.h == 270);   // the ratchet: after the first 480x270 sprite everything is strict
        foreach (var (name, w, h) in sizes)
        {
            if (w == 480 && h == 270) { current++; continue; }
            if (!forged && w == 480 && h == 300) { old.Add(name); continue; }
            throw new Exception("FAIL: story sprite " + name + " must be 480x270 (manifest " + w + "x" + h + ")");
        }
        if (pending.Count > 0) Console.WriteLine("WARNING: " + pending.Count + " story sprite(s) not in pixel-manifest.json yet (waiting for the forge): " + string.Join(", ", pending));
        if (old.Count > 0) Console.WriteLine("WARNING: " + old.Count + " story sprite(s) still 480x300 (waiting for the forge to make them 480x270): " + string.Join(", ", old));
        Console.WriteLine("PASS: " + names.Count + " story sprite references (" + found + " in the manifest, " + current + " at 480x270).");
        return found;
    }
}

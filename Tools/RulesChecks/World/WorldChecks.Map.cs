using PixelVocabFlight;
using System.Text.Json;

internal static partial class WorldChecks
{
    private static void CheckModels()
    {
        // --- Model catalogue ---
        Check(WorldModels.All.Count == 43 && WorldModels.All.Select(m => m.Id).Distinct().Count() == 43, "43 world models with unique ids");
        foreach (var m in WorldModels.All)
            Check(m.FootW > 0 && m.FootH > 0 && !string.IsNullOrWhiteSpace(m.Name) && m.Frames > 0, "model footprint, name and frames: " + m.Id);
        foreach (var c in Contract)
        {
            Check(WorldModels.TryGet(c.id, out var m), "contract model exists: " + c.id);
            Check(m.FootW == c.w && m.FootH == c.h && m.Solid == c.solid && m.Name == c.name && m.Frames == c.frames, "model matches contract table: " + c.id);
            string prefix = c.id.Substring(0, 4);
            var kind = prefix == "bld_" ? ModelKind.Building : prefix == "prop" ? ModelKind.Prop : prefix == "veh_" ? ModelKind.Vehicle : ModelKind.Aircraft;
            Check(m.Kind == kind, "model kind follows id prefix: " + c.id);
        }
        bool unknownThrows = false;
        try { WorldModels.Get("bld_missing"); } catch (KeyNotFoundException) { unknownThrows = true; }
        Check(unknownThrows, "unknown model id throws");
        var hangar = WorldModels.Get("bld_hangar");
        Check(WorldModels.Footprint(hangar, Facing.S) == (10, 8) && WorldModels.Footprint(hangar, Facing.N) == (10, 8), "S/N footprint as declared");
        Check(WorldModels.Footprint(hangar, Facing.E) == (8, 10) && WorldModels.Footprint(hangar, Facing.W) == (8, 10), "E/W footprint swaps width and depth");
        Check(WorldModels.SpriteName("bld_hq", Facing.S) == "bld_hq_s" && WorldModels.SpriteName("bld_hq", Facing.E) == "bld_hq_e"
            && WorldModels.SpriteName("bld_hq", Facing.N) == "bld_hq_n" && WorldModels.SpriteName("bld_hq", Facing.W) == "bld_hq_w", "sprite suffixes s/e/n/w");
        Check((int)Facing.S == 0 && (int)Facing.E == 1 && (int)Facing.N == 2 && (int)Facing.W == 3, "facing values fixed by contract");
        Check(Facings.Toward(1, 0) == Facing.E && Facings.Toward(-1, .2f) == Facing.W && Facings.Toward(0, -1) == Facing.N && Facings.Toward(.1f, 1) == Facing.S, "facing toward a direction");
    }

    private static void CheckMap()
    {
        // --- Airbase map ---
        var map = AirbaseMap.Create();
        Check(map.Width == 72 && map.Height == 52, "airbase is 72×52");
        Check(map.Placements.Select(p => p.Id).Distinct().Count() == map.Placements.Count, "unique placement ids");
        var owner = new string[map.Width, map.Height];
        foreach (var p in map.Placements)
        {
            var f = map.FootprintOf(p);
            Check(f.x >= 0 && f.y >= 0 && f.x + f.w <= map.Width && f.y + f.h <= map.Height, "placement inside the map: " + p.Id);
            for (int y = f.y; y < f.y + f.h; y++)
                for (int x = f.x; x < f.x + f.w; x++)
                {
                    if (x < 0 || y < 0 || x >= map.Width || y >= map.Height) continue;
                    Check(owner[x, y] == null, "footprints do not overlap: " + p.Id + " / " + owner[x, y] + " at " + x + "," + y);
                    owner[x, y] = p.Id;
                    Check(map.GroundAt(x, y) != Ground.Water, "nothing placed on water: " + p.Id);
                    Check(p.Model == "prop_gate_barrier" || map.FenceVariant(x, y) < 0, "only the gate barrier sits on the fence line: " + p.Id);
                }
        }
        Check(map.Placements.Count(p => p.Tag == MapDef.PlayerAircraftTag) == 1, "exactly one player-aircraft placement");
        var skylark = map.FindTag(MapDef.PlayerAircraftTag);
        Check(skylark.Model == "air_fighter" && skylark.Facing == Facing.E && skylark.DisplayName == "SKYLARK MK.I", "player aircraft is a SKYLARK facing east");
        foreach (var m in WorldModels.All) Check(map.Placements.Any(p => p.Model == m.Id), "airbase shows model: " + m.Id);
        Check(map.Placements.Count(p => p.Model == "bld_hangar" && p.Facing == Facing.E) == 2, "two hangars facing the apron");
        Check(map.Placements.Count(p => p.Model == "bld_watchtower") == 4 && map.Placements.Count(p => p.Model == "bld_aa_emplacement") >= 3, "watchtowers and AA sites");
        Check(map.Find("academy").Facing == Facing.S && map.Find("hq").Facing == Facing.S, "academy and HQ face south");
        Check(map.Placements.Any(p => p.Model == "air_bomber_enemy" && p.DisplayName == "Máy bay địch bị thu giữ"), "captured bomber label");

        // Fence ring closed except the 3-tile south gate.
        for (int x = 3; x <= 68; x++)
        {
            Check(map.FenceVariant(x, 3) >= 0, "north fence closed at x " + x);
            bool gate = x >= 30 && x <= 32;
            Check(gate ? map.FenceVariant(x, 48) == -1 : map.FenceVariant(x, 48) >= 0, "south fence and gate at x " + x);
        }
        for (int y = 3; y <= 48; y++) Check(map.FenceVariant(3, y) >= 0 && map.FenceVariant(68, y) >= 0, "side fences closed at y " + y);
        Check(map.FenceVariant(3, 3) == 2 && map.FenceVariant(68, 3) == 3 && map.FenceVariant(3, 48) == 4 && map.FenceVariant(68, 48) == 5, "fence corners");
        Check(map.FenceVariant(29, 48) == 6 && map.FenceVariant(33, 48) == 6 && map.FenceVariant(40, 3) == 0 && map.FenceVariant(3, 20) == 1, "fence pieces and gate posts");
        Check(map.Find("gate_barrier").X == 30 && map.Find("gate_barrier").Y == 48 && !WorldModels.Get("prop_gate_barrier").Solid, "open barrier in the gate");
        for (int y = 0; y < map.Height; y++)
            for (int x = 0; x < map.Width; x++)
            {
                bool runway = x >= 58 && x <= 63 && y >= 4 && y <= 47;
                Check((map.GroundAt(x, y) == Ground.Runway) == runway, "runway ground at " + x + "," + y);
                int v = map.RunwayVariant(x, y);
                Check(v >= 0 && v <= 4 && (runway || v == 0), "runway variant range at " + x + "," + y);
                Check(map.FenceVariant(x, y) >= -1 && map.FenceVariant(x, y) <= 6, "fence variant range at " + x + "," + y);
            }
        Check(map.RunwayVariant(58, 20) == 2 && map.RunwayVariant(63, 20) == 3 && map.RunwayVariant(60, 4) == 4 && map.RunwayVariant(61, 47) == 4, "runway edges and thresholds");
        Check(Enumerable.Range(6, 40).Count(y => map.RunwayVariant(60, y) == 1) == 20, "dashed centre line every other tile");
        Check(Enumerable.Range(52, 6).All(x => map.GroundAt(x, 20) == Ground.Asphalt && map.GroundAt(x, 21) == Ground.Asphalt), "taxiway joins apron and runway");
        Check(map.GroundAt(31, 40) == Ground.Asphalt && map.GroundAt(45, 15) == Ground.Concrete && map.GroundAt(8, 42) == Ground.Water, "road, apron and pond ground");
        for (int i = 0; i < 64; i++) Check(MapDef.TileVariant(i, 2 * i + 1, 4) == MapDef.TileVariant(i, 2 * i + 1, 4) && MapDef.TileVariant(i, i, 4) < 4 && MapDef.TileVariant(i, i, 1) == 0, "deterministic tile variant " + i);
        Check(Enumerable.Range(0, 64).Select(i => MapDef.TileVariant(i, 7, 4)).Distinct().Count() == 4, "tile variants vary");

        // NPCs.
        Check(map.Npcs.Select(n => n.Id).OrderBy(id => id).SequenceEqual(new[] { "guard", "mechanic", "medic", "officer", "professor" }), "five base NPCs");
        foreach (var n in map.Npcs)
        {
            var template = BaseContent.Roster[n.Id];
            Check(n.Name == template.Name && n.Role == template.Role && n.Character == n.Id && n.Dialogue == n.Id, "NPC matches roster: " + n.Id);
            Check(BaseContent.Dialogues.ContainsKey(n.Dialogue), "NPC dialogue exists: " + n.Id);
            Check(!StaticBlocked(map, n.X, n.Y), "NPC stands on open ground: " + n.Id);
        }
        Check(BaseContent.Roster["professor"].Name == "Giáo sư Whitmore" && BaseContent.Roster["guard"].Name == "Lính gác Tâm" && BaseContent.Roster["mechanic"].Name == "Thợ máy Bảy"
            && BaseContent.Roster["medic"].Name == "Y tá Lan" && BaseContent.Roster["officer"].Name == "Đại tá Phong" && BaseContent.PlayerName == "Phi công 01", "NPC and player names");
        var professorDef = map.FindNpc("professor");
        var academy = map.FootprintOf(map.Find("academy"));
        Check(professorDef.X > academy.x && professorDef.X < academy.x + academy.w && professorDef.Y > academy.y + academy.h && professorDef.Y < academy.y + academy.h + 1.5f, "professor stands at the academy door");
        Check(map.SpawnFacing == Facing.N && Near(map.SpawnX, professorDef.X) && map.SpawnY - professorDef.Y >= 3 && map.SpawnY - professorDef.Y <= 4, "spawn 3–4 tiles south of the professor, facing north");

        // Reachability from spawn.
        var world = new BaseWorld(map, new MissionLog());
        Check(!world.Blocked(map.SpawnX, map.SpawnY), "spawn not blocked");
        Check(!world.Blocked(map.AircraftReturnX, map.AircraftReturnY), "aircraft return spot not blocked");
        Check(world.DistanceToFootprint(skylark, map.AircraftReturnX, map.AircraftReturnY) <= BaseWorld.InteractRange, "aircraft return spot is next to the aircraft");
        var reach = Reachable(world, map.SpawnX, map.SpawnY);
        Check(reach[(int)map.AircraftReturnX, (int)map.AircraftReturnY], "aircraft return spot reachable from spawn");
        foreach (var n in map.Npcs)
            Check(Goal(world, reach, (x, y) => Dist(x, y, n.X, n.Y) <= BaseWorld.InteractRange) != null, "NPC reachable from spawn: " + n.Id);
        Check(Goal(world, reach, (x, y) => world.DistanceToFootprint(skylark, x, y) <= BaseWorld.InteractRange) != null, "player aircraft reachable from spawn");
        Check(!reach[1, 1] && !reach[70, 25], "jungle outside the fence is out of reach");

        // Walk there with real ticks, following the tile path.
        var walker = new BaseWorld(map, new MissionLog());
        Check(Walk(walker, (x, y) => Dist(x, y, professorDef.X, professorDef.Y) <= BaseWorld.InteractRange * .9f)
            && walker.NearestKind == InteractKind.Npc && walker.NearestId == "professor", "pilot walks from spawn to the professor");
        Check(Walk(walker, (x, y) => world.DistanceToFootprint(skylark, x, y) <= BaseWorld.InteractRange * .7f)
            && walker.NearestKind == InteractKind.Aircraft && walker.NearestId == skylark.Id, "pilot walks from the academy to the aircraft");
        var zones = new List<string>();
        for (var e = walker.PopEvent(); e != null; e = walker.PopEvent()) if (e.Kind == WorldEventKind.ZoneEntered) zones.Add(e.Text);
        Check(zones.Contains("Trường huấn luyện ngoại ngữ") && zones.Count >= 3 && zones.All(z => !string.IsNullOrEmpty(z)), "zones announced along the way");
    }
}

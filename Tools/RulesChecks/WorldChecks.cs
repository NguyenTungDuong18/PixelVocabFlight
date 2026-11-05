using PixelVocabFlight;
using System.Text.Json;

// Walkable base (0.15.0): model catalogue, airbase map, movement, interaction, dialogue and missions.
internal static class WorldChecks
{
    // Contract table 3.2: id, footprint for facing S, solid, display name, frames.
    private static readonly (string id, int w, int h, bool solid, string name, int frames)[] Contract =
    {
        ("bld_control_tower", 5, 5, true, "Tháp chỉ huy", 1), ("bld_hq", 8, 5, true, "Sở chỉ huy", 1),
        ("bld_hangar", 10, 8, true, "Nhà chứa máy bay", 1), ("bld_barracks", 8, 4, true, "Doanh trại", 1),
        ("bld_mess_hall", 7, 5, true, "Nhà ăn", 4), ("bld_medical", 6, 5, true, "Trạm y tế", 1),
        ("bld_academy", 7, 5, true, "Trường huấn luyện ngoại ngữ", 1), ("bld_workshop", 7, 5, true, "Xưởng sửa chữa", 1),
        ("bld_warehouse", 7, 5, true, "Kho quân nhu", 1), ("bld_fuel_depot", 5, 4, true, "Kho nhiên liệu", 1),
        ("bld_ammo_bunker", 5, 4, true, "Kho đạn", 1), ("bld_radar", 3, 3, true, "Trạm radar", 8),
        ("bld_radio_hut", 3, 3, true, "Trạm điện đài", 1), ("bld_watchtower", 2, 2, true, "Tháp canh", 1),
        ("bld_water_tower", 3, 3, true, "Tháp nước", 1), ("bld_guardhouse", 3, 3, true, "Chốt gác", 1),
        ("bld_aa_emplacement", 4, 4, true, "Ụ pháo cao xạ", 1), ("bld_tent", 3, 3, true, "Lều dã chiến", 1),
        ("prop_sandbags", 3, 1, true, "Bao cát", 1), ("prop_barrels", 1, 1, true, "Thùng phuy", 1),
        ("prop_crates", 2, 1, true, "Thùng gỗ", 1), ("prop_jerrycans", 1, 1, true, "Can xăng", 1),
        ("prop_flagpole", 1, 1, true, "Cột cờ", 6), ("prop_windsock", 1, 1, true, "Ống gió", 6),
        ("prop_searchlight", 1, 1, true, "Đèn pha", 1), ("prop_lamp_post", 1, 1, true, "Cột đèn", 1),
        ("prop_signpost", 1, 1, true, "Biển chỉ dẫn", 1), ("prop_bench", 2, 1, true, "Ghế dài", 1),
        ("prop_barbed_wire", 2, 1, true, "Dây thép gai", 1), ("prop_gate_barrier", 3, 1, false, "Barie cổng", 1),
        ("prop_tree_palm", 2, 2, true, "Cây cọ", 1), ("prop_tree_jungle", 2, 2, true, "Cây rừng", 1),
        ("prop_bush", 1, 1, false, "Bụi cây", 1), ("veh_jeep", 2, 3, true, "Xe jeep", 1),
        ("veh_truck", 2, 4, true, "Xe tải", 1), ("veh_fuel_truck", 2, 4, true, "Xe bồn", 1),
        ("veh_tank", 3, 4, true, "Xe tăng", 1), ("veh_aa_gun", 2, 2, true, "Pháo cao xạ", 1),
        ("veh_artillery", 2, 3, true, "Lựu pháo", 1), ("veh_motorcycle", 1, 2, true, "Mô tô", 1),
        ("air_fighter", 4, 4, true, "SKYLARK MK.I", 1), ("air_transport", 6, 5, true, "Máy bay vận tải", 1),
        ("air_bomber_enemy", 6, 5, true, "Máy bay ném bom địch", 1),
    };

    private static readonly HashSet<string> ContractActions = new HashSet<string>
    { "mission.accept:0", "mission.accept:1", "mission.accept:2", "mission.accept:3", "mission.cancel", "vocab.open", "end" };
    private static readonly HashSet<string> ContractConditions = new HashSet<string> { "mission.active", "!mission.active", "completed>0" };

    public static int Run()
    {
        int checks = 0;
        void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }
        bool Near(float a, float b, float eps = .0005f) => Math.Abs(a - b) <= eps;

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

        // --- Movement ---
        var walk = new BaseWorld(map, new MissionLog());
        var warehouse = map.FootprintOf(map.Find("warehouse"));
        float wallY = warehouse.y + warehouse.h;
        walk.PlacePlayer(39.5f, wallY + 1f, Facing.S);
        for (int i = 0; i < 40; i++) walk.Tick(1 / 30f, 0, -1, false);
        Check(walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f && walk.PlayerY < wallY + BaseWorld.BodyHalfDepth + .02f && Near(walk.PlayerX, 39.5f), "walking into a building stops flush at its wall");
        Check(walk.PlayerFacing == Facing.N && walk.Moving && !walk.Running, "facing and walking state");
        float before = walk.PlayerX;
        walk.Tick(.1f, 1, -1, false);
        Check(walk.PlayerX > before + .2f && walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f, "diagonal into a wall slides along it");
        walk.Tick(.1f, 0, 0, false);
        Check(!walk.Moving && !walk.Running, "no input means standing");
        walk.PlacePlayer(39.5f, wallY + 1.5f, Facing.S);
        for (int i = 0; i < 20; i++) walk.Tick(.25f, 0, -1, true);
        Check(walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f, "long frames cannot tunnel through a wall");
        var lamp = map.Find("lamp_road_2");
        walk.PlacePlayer(lamp.X + .5f, lamp.Y + 3f, Facing.N);
        for (int i = 0; i < 20; i++) walk.Tick(.25f, 0, -1, true);
        Check(walk.PlayerY >= lamp.Y + 1 + BaseWorld.BodyHalfDepth - .001f, "a 1×1 prop blocks a sprinting pilot");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, 1, 1, false);
        Check(Near(Dist(walk.PlayerX, walk.PlayerY, 28f, 21.5f), BaseWorld.WalkSpeed * .1f) && Near(walk.PlayerX - 28f, walk.PlayerY - 21.5f), "diagonal walking is normalised");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, 1, 0, true);
        Check(Near(walk.PlayerX - 28f, BaseWorld.RunSpeed * .1f) && walk.Running && walk.PlayerFacing == Facing.E, "running is faster than walking");
        Check(BaseWorld.RunSpeed > BaseWorld.WalkSpeed, "run speed above walk speed");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, .5f, 0, false);
        Check(Near(walk.PlayerX - 28f, BaseWorld.WalkSpeed * .05f), "analog input below 1 walks slower");
        var coarse = new BaseWorld(map, new MissionLog()); var fine = new BaseWorld(map, new MissionLog());
        coarse.PlacePlayer(27f, 20.5f, Facing.S); fine.PlacePlayer(27f, 20.5f, Facing.S);
        coarse.Tick(.2f, 1, .5f, false);
        for (int i = 0; i < 20; i++) fine.Tick(.01f, 1, .5f, false);
        Check(Near(coarse.PlayerX, fine.PlayerX, .001f) && Near(coarse.PlayerY, fine.PlayerY, .001f), "movement agrees across frame rates");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(float.NaN, 1, 0, false); walk.Tick(-1, 1, 0, false); walk.Tick(.1f, float.NaN, float.PositiveInfinity, false);
        Check(Near(walk.PlayerX, 28f) && Near(walk.PlayerY, 21.5f) && !float.IsNaN(walk.PlayerX), "invalid time and input do not move the pilot");
        Check(walk.Blocked(-.1f, 10) && walk.Blocked(10, map.Height) && walk.Blocked(map.FenceVariant(3, 20) >= 0 ? 3.5f : 0, 20.5f), "map edges and fence block");
        Check(walk.Blocked(8.5f, 42.5f), "pond water blocks");
        var gateBarrier = map.Find("gate_barrier");
        Check(!walk.Blocked(31.5f, 48.5f) && map.PlacementAt(31, 48) == gateBarrier, "open barrier can be walked through");
        Check(walk.Blocked(professorDef.X + .4f, professorDef.Y + .2f), "NPCs block the pilot");
        walk.PlacePlayer(professorDef.X, professorDef.Y + 2f, Facing.N);
        for (int i = 0; i < 60; i++) walk.Tick(1 / 30f, 0, -1, false);
        Check(walk.PlayerY >= professorDef.Y + 2 * BaseWorld.BodyHalfDepth - .001f && walk.PlayerY < professorDef.Y + 2 * BaseWorld.BodyHalfDepth + .02f, "pilot stops at an NPC");

        // --- Interaction ---
        var log = new MissionLog();
        var talk = new BaseWorld(map, log);
        talk.PlacePlayer(professorDef.X, professorDef.Y + 1f, Facing.N);
        Check(talk.NearestKind == InteractKind.Npc && talk.NearestId == "professor" && talk.PromptText == "[E] Nói chuyện với Giáo sư Whitmore", "prompt next to the professor");
        while (talk.PopEvent() != null) { }
        talk.Interact();
        var opened = talk.PopEvent();
        Check(opened != null && opened.Kind == WorldEventKind.DialogueOpened && opened.NpcId == "professor" && opened.Text == "professor", "interacting opens the professor's dialogue");
        var professor = talk.Npc("professor");
        Check(professor.Talking && professor.Facing == Facing.S && talk.PlayerFacing == Facing.N && talk.InDialogue, "professor turns to the pilot while talking");
        Check(talk.PromptText == null && talk.NearestKind == InteractKind.None, "no prompt during dialogue");
        float frozen = talk.PlayerY;
        talk.Tick(.2f, 0, 1, true);
        Check(talk.PlayerY == frozen && !talk.Moving, "pilot cannot walk away mid-dialogue");
        talk.Interact();
        Check(talk.PopEvent() == null, "no second dialogue while one is open");
        talk.EndDialogue();
        Check(!professor.Talking && professor.Facing == professorDef.Facing && talk.NearestId == "professor", "ending the dialogue releases the professor");
        var medicDef = map.FindNpc("medic");
        talk.PlacePlayer(medicDef.X - 1f, medicDef.Y, Facing.E);
        talk.Interact();
        var medicEvent = talk.PopEvent();
        while (medicEvent != null && medicEvent.Kind == WorldEventKind.ZoneEntered) medicEvent = talk.PopEvent();
        Check(medicEvent != null && medicEvent.NpcId == "medic" && talk.Npc("medic").Facing == Facing.W, "other NPCs face the pilot from the side");
        talk.EndDialogue();
        talk.PlacePlayer(map.AircraftReturnX, map.AircraftReturnY, map.AircraftReturnFacing);
        while (talk.PopEvent() != null) { }
        Check(talk.NearestKind == InteractKind.Aircraft && talk.NearestId == skylark.Id && talk.PromptText == "[E] SKYLARK MK.I", "aircraft prompt without orders");
        talk.Interact();
        var hint = talk.PopEvent();
        Check(hint != null && hint.Kind == WorldEventKind.Hint && hint.Text == "Chưa có lệnh bay. Hãy gặp Giáo sư Whitmore ở Trường huấn luyện ngoại ngữ.", "aircraft without orders gives a hint");
        Check(log.Accept(BaseContent.VocabSortie, 1), "accept mission");
        Check(talk.PromptText == "[E] Lên máy bay SKYLARK MK.I", "aircraft prompt with orders");
        talk.Interact();
        var board = talk.PopEvent();
        Check(board != null && board.Kind == WorldEventKind.BoardAircraft && board.Text == skylark.Id, "aircraft with orders boards");
        talk.PlacePlayer(28f, 21.5f, Facing.S);
        Check(talk.NearestKind == InteractKind.None && talk.PromptText == null, "nothing to interact with on the parade ground");
        while (talk.PopEvent() != null) { }
        talk.Interact();
        Check(talk.PopEvent() == null, "interacting with nothing emits nothing");

        var zone = new BaseWorld(map, new MissionLog());
        zone.PlacePlayer(professorDef.X, professorDef.Y + 1.5f, Facing.N);
        var entered = zone.PopEvent();
        Check(zone.CurrentZone == "Trường huấn luyện ngoại ngữ" && entered != null && entered.Kind == WorldEventKind.ZoneEntered && entered.Text == zone.CurrentZone, "zone label of the nearest building");
        zone.PlacePlayer(professorDef.X, professorDef.Y + 1.6f, Facing.N);
        Check(zone.PopEvent() == null, "same zone is not announced twice");
        zone.PlacePlayer(55f, 15f, Facing.S);
        Check(zone.CurrentZone == "Sân đỗ", "named area when no building is near");
        Check(zone.ZoneAt(skylark.X + 1, skylark.Y + 1) != skylark.DisplayName, "aircraft are not zones");

        // --- Dialogue data ---
        foreach (var pair in BaseContent.Dialogues)
        {
            var graph = pair.Value;
            Check(graph.Id == pair.Key && graph.Nodes.ContainsKey(DialogueGraph.StartNode), "dialogue has a start node: " + pair.Key);
            foreach (var node in graph.Nodes)
            {
                string where = pair.Key + "/" + node.Key;
                Check(node.Value.Id == node.Key && node.Value.Choices != null && node.Value.Choices.Length > 0 && node.Value.Choices.Length <= 5, "node id and 1–5 choices: " + where);
                if (node.Value.IsRouter)
                {
                    Check(node.Value.Choices.All(c => c.Text == null && c.Action == null) && node.Value.Choices.Last().Condition == null, "router always routes: " + where);
                }
                else
                {
                    Check(node.Value.Speaker == pair.Key || node.Value.Speaker == BaseContent.PlayerCharacter, "speaker is the NPC or pilot: " + where);
                    Check(node.Value.Choices.All(c => !string.IsNullOrWhiteSpace(c.Text)), "choices have text: " + where);
                }
                foreach (var choice in node.Value.Choices)
                {
                    Check(choice.Next == null || choice.Next == DialogueGraph.EndNode || graph.Nodes.ContainsKey(choice.Next), "next node exists: " + where + " → " + choice.Next);
                    Check(choice.Action == null || ContractActions.Contains(choice.Action), "action in the contract set: " + where + " " + choice.Action);
                    Check(DialogueActions.IsValid(choice.Action), "action parses: " + where);
                    Check(choice.Condition == null || ContractConditions.Contains(choice.Condition), "condition in the contract set: " + where);
                    Check(DialogueConditions.IsKnown(choice.Condition), "condition understood: " + where);
                }
            }
            Check(Reached(graph).SetEquals(graph.Nodes.Keys), "every node reachable from start: " + pair.Key);
        }
        foreach (var npc in BaseContent.Roster.Values) Check(BaseContent.Dialogues.ContainsKey(npc.Dialogue), "roster dialogue exists: " + npc.Id);
        Check(BaseContent.Missions.Count == 1 && BaseContent.Missions["vocab-sortie"].Title == "Huấn luyện điện mật" && BaseContent.Missions["vocab-sortie"].Giver == "professor"
            && BaseContent.Missions["vocab-sortie"].Objective == "Ra SKYLARK MK.I ở sân đỗ và nhấn E để cất cánh.", "vocab-sortie mission");
        foreach (var mission in BaseContent.Missions.Values) Check(BaseContent.Roster.ContainsKey(mission.Giver), "mission giver exists: " + mission.Id);

        // --- Professor flow ---
        var missions = new MissionLog();
        Check(missions.Active == null && missions.ObjectiveText == "Gặp Giáo sư Whitmore để nhận nhiệm vụ." && missions.StatusOf("vocab-sortie") == MissionStatus.Available, "no mission at start");
        var runner = new DialogueRunner(BaseContent.Dialogues);
        var vars = BaseContent.Variables(missions, 1234);
        Check(!runner.Open && runner.Current == null && runner.Choices.Count == 0 && runner.Choose(0) == null, "closed runner is inert");
        runner.Start("professor", missions.Condition);
        Check(runner.Open && runner.Current.Id == "start_first" && runner.Current.Speaker == "professor" && runner.Text(vars).Contains("Good morning"), "first visit greeting");
        int Find(string text) { var list = runner.Choices; for (int i = 0; i < list.Count; i++) if (list[i].Text.StartsWith(text, StringComparison.Ordinal)) return i; return -1; }
        Check(runner.Choices.Select(c => c.Text).SequenceEqual(new[] { "Nhận nhiệm vụ huấn luyện", "Chọn bộ từ vựng", "Hỏi về các chiến trường", "Tạm biệt" }), "professor idle choices");
        Check(runner.Choose(Find("Hỏi về")) == null && runner.Current.Id == "about_env" && runner.Text(vars).Contains("Băng giá"), "ask about battlefields");
        runner.Choose(Find("Quay lại"));
        Check(runner.Current.Id == "start_first", "back to the greeting");
        Check(runner.Choose(Find("Nhận nhiệm vụ")) == null && runner.Current.Id == "pick_env", "accept leads to battlefield choice");
        Check(runner.Text(vars) == "Chọn chiến trường cho chuyến bay này. Bộ từ hiện có 1.234 mục.", "word count variable");
        Check(runner.Choices.Count == 5 && runner.Choices[0].Text.StartsWith("1. Rừng rậm", StringComparison.Ordinal) && runner.Choices[3].Text.StartsWith("4. Biển", StringComparison.Ordinal), "four battlefields plus back");
        string action = runner.Choose(Find("3. Băng giá"));
        Check(action == "mission.accept:2" && missions.Apply(action), "ice battlefield action");
        Check(missions.Active != null && missions.Active.Id == "vocab-sortie" && missions.Environment == 2 && missions.StatusOf("vocab-sortie") == MissionStatus.Active, "mission active on the ice front");
        Check(missions.ObjectiveText == "Ra SKYLARK MK.I ở sân đỗ và nhấn E để cất cánh.", "objective while active");
        Check(runner.Current.Id == "accepted" && runner.Text(vars) == "Tốt. Ra SKYLARK MK.I ở sân đỗ và cất cánh. Good luck, pilot!", "accepted line");
        Check(runner.Choose(0) == null && !runner.Open && runner.Current == null, "dialogue ends after accepting");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_active" && runner.Text(vars).Contains("(Băng giá)"), "active branch names the battlefield");
        Check(runner.Choices.Select(c => c.Text).SequenceEqual(new[] { "Đổi chiến trường", "Hủy nhiệm vụ", "Chọn bộ từ vựng", "Đi ngay" }), "active choices");
        runner.Choose(Find("Đổi chiến trường"));
        runner.Choose(Find("Quay lại"));
        Check(runner.Current.Id == "start_active", "back from battlefield choice returns to the active branch");
        runner.Choose(Find("Đổi chiến trường"));
        missions.Apply(runner.Choose(Find("2. Sa mạc")));
        Check(missions.Environment == 1 && missions.Active != null, "changing battlefield keeps the mission");
        runner.Close();
        Check(!runner.Open, "close");
        runner.Start("professor", missions.Condition);
        Check(runner.Choose(Find("Chọn bộ từ vựng")) == "vocab.open" && !runner.Open, "vocabulary action closes the dialogue");
        runner.Start("professor", missions.Condition);
        action = runner.Choose(Find("Hủy nhiệm vụ"));
        Check(action == "mission.cancel" && missions.Apply(action) && missions.Active == null && !runner.Open, "cancel ends the mission");
        Check(missions.ObjectiveText == "Gặp Giáo sư Whitmore để nhận nhiệm vụ.", "idle objective after cancel");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_first", "idle branch after cancel");
        runner.Close();
        missions.Accept("vocab-sortie", 3);
        missions.Complete(1234);
        Check(missions.Completed == 1 && missions.LastScore == 1234 && missions.Active == null, "complete records the sortie");
        runner.Start("professor", missions.Condition);
        Check(runner.Current.Id == "start_back" && runner.Text(vars).Contains("1.234 điểm") && runner.Text(vars).Contains("1 chuyến"), "returning greeting quotes the last score");
        runner.Close();
        var applyFirst = new MissionLog();
        runner.Start("professor", applyFirst.Condition);
        runner.Choose(Find("Nhận nhiệm vụ"));
        Check(runner.Choose(Find("1. Rừng"), a => applyFirst.Apply(a)) == "mission.accept:0" && applyFirst.Active != null && applyFirst.Environment == 0, "choose can apply the action itself");

        // Mission log edge cases.
        var edge = new MissionLog();
        Check(!edge.Accept("vocab-sortie", -1) && !edge.Accept("vocab-sortie", 4) && !edge.Accept("missing", 0) && !edge.Accept(null, 0) && edge.Active == null, "invalid accepts are rejected");
        Check(!edge.Apply("vocab.open") && !edge.Apply(null) && !edge.Apply("mission.accept:9") && edge.Active == null, "non-mission actions are not applied");
        Check(edge.Apply("mission.accept:vocab-sortie:3") && edge.Environment == 3, "long accept form");
        Check(edge.Condition("mission.active") && !edge.Condition("!mission.active") && edge.Condition("mission.active:vocab-sortie") && !edge.Condition("completed>0") && edge.Condition("completed==0"), "conditions");
        edge.Completed = 4; edge.LastScore = 50;
        Check(edge.Condition("completed>=4") && edge.Condition("lastScore<51") && edge.Condition("environment!=1") && !edge.Condition("unknown>0") && edge.Condition(null), "comparison conditions");
        Check(!DialogueConditions.IsKnown("weather>0") && DialogueConditions.IsKnown("!completed>0"), "known conditions");
        Check(DialogueActions.IsValid(null) && DialogueActions.IsValid("mission.accept:3") && !DialogueActions.IsValid("mission.accept:4") && !DialogueActions.IsValid("mission.accept:") && !DialogueActions.IsValid("launch"), "action validation");
        Check(DialogueRunner.Substitute("A {x} {unknown} {", n => n == "x" ? "1" : null) == "A 1 {unknown} {", "unknown variables stay");
        Check(BaseContent.EnvironmentName(0) == "Rừng rậm" && BaseContent.EnvironmentName(3) == "Biển" && BaseContent.SpeakerName("pilot") == "Phi công 01" && BaseContent.SpeakerName("medic") == "Y tá Lan" && BaseContent.SpeakerCharacter("officer") == "officer", "content helpers");
        bool missingGraph = false;
        try { runner.Start("nobody", edge.Condition); } catch (KeyNotFoundException) { missingGraph = true; }
        Check(missingGraph, "unknown dialogue throws");

        // Side NPCs react to progress.
        var side = new MissionLog();
        runner.Start("mechanic", side.Condition);
        Check(runner.Current.Id == "idle" && runner.Text(vars).Contains("SKYLARK đã đổ đầy xăng"), "mechanic without orders");
        side.Accept("vocab-sortie", 0);
        runner.Start("mechanic", side.Condition);
        Check(runner.Current.Id == "ready", "mechanic with orders");
        runner.Start("officer", side.Condition);
        Check(runner.Current.Id == "rookie", "officer greets a rookie");
        side.Complete(10);
        runner.Start("officer", side.Condition);
        Check(runner.Current.Id == "veteran" && runner.Text(BaseContent.Variables(side, 0)).Contains("1 chuyến"), "officer greets a veteran");
        runner.Start("guard", side.Condition);
        Check(runner.Text(vars).Contains("Không ai ra khỏi cổng khi chưa có lệnh"), "guard line");
        runner.Start("medic", side.Condition);
        Check(runner.Text(vars).Contains("Trúng đạn thì về đây"), "medic line");

        Console.WriteLine("PASS: " + checks + " walkable base checks.");
        return checks;
    }

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

    private static float Dist(float ax, float ay, float bx, float by) => (float)Math.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

    // Static collision only (tiles, water, fence), for NPC standing spots.
    private static bool StaticBlocked(MapDef map, float x, float y)
    {
        for (int ty = (int)Math.Floor(y - BaseWorld.BodyHalfDepth); ty <= (int)Math.Floor(y + BaseWorld.BodyHalfDepth - 1e-4f); ty++)
            for (int tx = (int)Math.Floor(x - BaseWorld.BodyHalfWidth); tx <= (int)Math.Floor(x + BaseWorld.BodyHalfWidth - 1e-4f); tx++)
                if (map.SolidTile(tx, ty)) return true;
        return false;
    }

    private static readonly (int dx, int dy)[] Steps = { (1, 0), (-1, 0), (0, 1), (0, -1) };

    // Moving between two tile centres is safe if the feet box is free along the segment.
    private static bool Passable(BaseWorld world, int x, int y, int dx, int dy)
    {
        for (int k = 1; k <= 4; k++)
            if (world.Blocked(x + .5f + dx * k * .25f, y + .5f + dy * k * .25f)) return false;
        return true;
    }

    private static int[,] Parents(BaseWorld world, float fromX, float fromY)
    {
        var map = world.Map;
        var parent = new int[map.Width, map.Height];
        for (int x = 0; x < map.Width; x++) for (int y = 0; y < map.Height; y++) parent[x, y] = -2;
        var queue = new Queue<(int x, int y)>();
        int sx = (int)fromX, sy = (int)fromY;
        parent[sx, sy] = -1;
        queue.Enqueue((sx, sy));
        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            foreach (var (dx, dy) in Steps)
            {
                int nx = x + dx, ny = y + dy;
                if (!map.InBounds(nx, ny) || parent[nx, ny] != -2 || !Passable(world, x, y, dx, dy)) continue;
                parent[nx, ny] = y * map.Width + x;
                queue.Enqueue((nx, ny));
            }
        }
        return parent;
    }

    private static bool[,] Reachable(BaseWorld world, float fromX, float fromY)
    {
        var parent = Parents(world, fromX, fromY);
        var reach = new bool[world.Map.Width, world.Map.Height];
        for (int x = 0; x < world.Map.Width; x++) for (int y = 0; y < world.Map.Height; y++) reach[x, y] = parent[x, y] != -2;
        return reach;
    }

    private static (int x, int y)? Goal(BaseWorld world, bool[,] reach, Func<float, float, bool> goal)
    {
        for (int y = 0; y < world.Map.Height; y++)
            for (int x = 0; x < world.Map.Width; x++)
                if (reach[x, y] && goal(x + .5f, y + .5f)) return (x, y);
        return null;
    }

    // Steers the pilot with Tick() along the BFS path from its tile to the nearest goal tile.
    private static bool Walk(BaseWorld world, Func<float, float, bool> goal)
    {
        float startX = world.PlayerX, startY = world.PlayerY;
        var parent = Parents(world, startX, startY);
        var path = new List<(int x, int y)>();
        var queue = new Queue<(int x, int y)>();
        var seen = new HashSet<(int, int)>();
        queue.Enqueue(((int)startX, (int)startY)); seen.Add(((int)startX, (int)startY));
        (int x, int y)? target = null;
        while (queue.Count > 0 && target == null)
        {
            var (x, y) = queue.Dequeue();
            if (goal(x + .5f, y + .5f)) { target = (x, y); break; }
            foreach (var (dx, dy) in Steps)
            {
                int nx = x + dx, ny = y + dy;
                if (world.Map.InBounds(nx, ny) && parent[nx, ny] != -2 && seen.Add((nx, ny)) && parent[nx, ny] == y * world.Map.Width + x) queue.Enqueue((nx, ny));
            }
        }
        if (target == null) return false;
        for (var t = target.Value; ; )
        {
            path.Insert(0, t);
            int p = parent[t.x, t.y];
            if (p < 0) break;
            t = (p % world.Map.Width, p / world.Map.Width);
        }
        const float dt = 1 / 30f;
        float stepLength = BaseWorld.RunSpeed * dt;
        foreach (var tile in path)
        {
            float tx = tile.x + .5f, ty = tile.y + .5f;
            for (int i = 0; i < 200 && Dist(world.PlayerX, world.PlayerY, tx, ty) > .001f; i++)
            {
                float dx = tx - world.PlayerX, dy = ty - world.PlayerY, d = Dist(world.PlayerX, world.PlayerY, tx, ty);
                float scale = 1 / Math.Max(d, stepLength);
                world.Tick(dt, dx * scale, dy * scale, true);
            }
            if (Dist(world.PlayerX, world.PlayerY, tx, ty) > .01f) return false;
        }
        world.Tick(dt, 0, 0, false);
        return goal(world.PlayerX, world.PlayerY);
    }

    private static HashSet<string> Reached(DialogueGraph graph)
    {
        var seen = new HashSet<string> { DialogueGraph.StartNode };
        var queue = new Queue<string>(seen);
        while (queue.Count > 0)
            foreach (var choice in graph.Nodes[queue.Dequeue()].Choices)
                if (choice.Next != null && choice.Next != DialogueGraph.EndNode && graph.Nodes.ContainsKey(choice.Next) && seen.Add(choice.Next)) queue.Enqueue(choice.Next);
        return seen;
    }
}

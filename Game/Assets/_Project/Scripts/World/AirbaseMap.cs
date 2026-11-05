namespace PixelVocabFlight
{
    // Home airbase, 72×52 tiles. Fence ring x 3..68, y 3..48 with the main gate at x 30..32 on the south side;
    // runway x 58..63; apron x 38..57, y 8..30; living quarters north-west; HQ in the centre; motor pool south.
    // Every coordinate below is the top-left tile of a footprint (see WorldModels for sizes).
    public static class AirbaseMap
    {
        public const string Id = "airbase";
        public const int Width = 72, Height = 52;
        public const string PlayerAircraftId = "skylark";

        public static MapDef Create()
        {
            var map = new MapDef(Id, "Căn cứ không quân", Width, Height)
            {
                SpawnX = 17.5f, SpawnY = 28.5f, SpawnFacing = Facing.N,
                AircraftReturnX = 50f, AircraftReturnY = 23.6f, AircraftReturnFacing = Facing.S,
            };
            PaintGround(map);
            map.FenceRect(3, 3, 68, 48);
            map.OpenGate(30, 48, 3);
            Placements(map);
            Npcs(map);
            Areas(map);
            Forest(map);
            return map;
        }

        private static void PaintGround(MapDef map)
        {
            // Roads and yards first; later fills win.
            map.FillGround(5, 25, 20, 2, Ground.Dirt);        // path in front of medical post and academy
            map.FillGround(15, 10, 2, 15, Ground.Dirt);       // path between barracks and mess hall
            map.FillGround(25, 19, 13, 9, Ground.Dirt);       // parade ground in front of HQ
            map.FillGround(18, 32, 12, 10, Ground.Dirt);      // motor pool
            map.FillGround(8, 38, 10, 2, Ground.Dirt);        // workshop yard
            map.FillGround(47, 37, 11, 11, Ground.Dirt);      // fuel and ammunition yard
            map.FillGround(48, 42, 10, 6, Ground.Sand);       // ammunition bunker berm
            map.FillGround(6, 40, 6, 6, Ground.Sand);         // pond shore
            map.FillGround(7, 41, 4, 4, Ground.Water);        // pond
            map.FillGround(30, 28, 3, 24, Ground.Asphalt);    // main road: gate (y 48) to parade ground
            map.FillGround(33, 28, 5, 2, Ground.Asphalt);     // service road to the apron
            map.FillGround(38, 8, 20, 23, Ground.Concrete);   // apron
            map.FillGround(52, 20, 6, 2, Ground.Asphalt);     // taxiway to the runway
            Runway(map, 58, 4, 6, 44);
        }

        // Runway markings: left/right edge lines, dashed centre line, threshold bars at both ends.
        private static void Runway(MapDef map, int x, int y, int w, int h)
        {
            map.FillGround(x, y, w, h, Ground.Runway);
            int centre = x + w / 2 - 1;
            for (int j = y; j < y + h; j++)
            {
                bool threshold = j < y + 2 || j >= y + h - 2;
                for (int i = x; i < x + w; i++)
                {
                    int variant = 0;
                    if (i == x) variant = 2;
                    else if (i == x + w - 1) variant = 3;
                    else if (threshold) variant = 4;
                    else if (i == centre && (j - y) % 2 == 0) variant = 1;
                    map.SetRunwayVariant(i, j, variant);
                }
            }
        }

        private static void Placements(MapDef map)
        {
            // Watchtowers in the four inner corners.
            map.Add("watchtower_nw", "bld_watchtower", Facing.S, 4, 4);
            map.Add("watchtower_ne", "bld_watchtower", Facing.S, 66, 4);
            map.Add("watchtower_sw", "bld_watchtower", Facing.S, 4, 46);
            map.Add("watchtower_se", "bld_watchtower", Facing.S, 66, 46);

            // Living quarters (north-west).
            map.Add("barracks_1", "bld_barracks", Facing.S, 6, 5, "Doanh trại số 1");
            map.Add("barracks_2", "bld_barracks", Facing.S, 6, 11, "Doanh trại số 2");
            map.Add("mess_hall", "bld_mess_hall", Facing.S, 18, 5);
            map.Add("water_tower", "bld_water_tower", Facing.S, 19, 12);
            map.Add("medical", "bld_medical", Facing.S, 6, 19);
            map.Add("academy", "bld_academy", Facing.S, 14, 19);
            map.Add("bench_academy", "prop_bench", Facing.S, 21, 27);
            map.Add("lamp_academy", "prop_lamp_post", Facing.S, 13, 24);
            map.Add("lamp_medical", "prop_lamp_post", Facing.S, 5, 24);
            map.Add("barrels_mess", "prop_barrels", Facing.S, 25, 7);
            map.Add("crates_mess", "prop_crates", Facing.S, 25, 9);
            map.Add("palm_quarters", "prop_tree_palm", Facing.S, 23, 13);
            map.Add("bush_academy_w", "prop_bush", Facing.S, 13, 21);
            map.Add("bush_academy_e", "prop_bush", Facing.S, 21, 22);
            map.Add("bench_quarters", "prop_bench", Facing.S, 9, 16);

            // Centre: headquarters, parade ground, radar and radio.
            map.Add("hq", "bld_hq", Facing.S, 27, 13);
            map.Add("flagpole", "prop_flagpole", Facing.S, 31, 23);
            map.Add("radar", "bld_radar", Facing.S, 28, 6);
            map.Add("radio_hut", "bld_radio_hut", Facing.S, 32, 7);
            map.Add("signpost_parade", "prop_signpost", Facing.S, 29, 27);
            map.Add("lamp_parade_w", "prop_lamp_post", Facing.S, 25, 19);
            map.Add("lamp_parade_e", "prop_lamp_post", Facing.S, 37, 19);
            map.Add("aa_north", "bld_aa_emplacement", Facing.S, 40, 4);
            map.Add("sandbags_radar", "prop_sandbags", Facing.S, 28, 10);

            // Apron and airfield.
            map.Add("hangar_1", "bld_hangar", Facing.E, 38, 9, "Nhà chứa máy bay số 1");
            map.Add("hangar_2", "bld_hangar", Facing.E, 38, 21, "Nhà chứa máy bay số 2");
            map.Add("fighter_a", "air_fighter", Facing.E, 47, 9);
            map.Add("fighter_b", "air_fighter", Facing.E, 47, 14);
            map.Add(PlayerAircraftId, "air_fighter", Facing.E, 48, 19, tag: MapDef.PlayerAircraftTag);
            map.Add("transport", "air_transport", Facing.E, 52, 8);
            map.Add("captured_bomber", "air_bomber_enemy", Facing.S, 47, 25, "Máy bay địch bị thu giữ");
            map.Add("fuel_truck", "veh_fuel_truck", Facing.N, 54, 22);
            map.Add("jerrycans_apron", "prop_jerrycans", Facing.S, 56, 24);
            map.Add("barrels_apron", "prop_barrels", Facing.S, 56, 25);
            map.Add("crates_hangar", "prop_crates", Facing.S, 44, 7);
            map.Add("windsock", "prop_windsock", Facing.S, 57, 5);
            map.Add("control_tower", "bld_control_tower", Facing.S, 52, 32);
            map.Add("fuel_depot", "bld_fuel_depot", Facing.S, 51, 38);
            map.Add("ammo_bunker", "bld_ammo_bunker", Facing.S, 50, 43);
            map.Add("sandbags_bunker_w", "prop_sandbags", Facing.E, 48, 43);
            map.Add("sandbags_bunker_e", "prop_sandbags", Facing.W, 56, 43);
            map.Add("sandbags_bunker_s", "prop_sandbags", Facing.S, 50, 47);
            map.Add("aa_runway", "bld_aa_emplacement", Facing.W, 64, 24);
            map.Add("aa_gun_runway", "veh_aa_gun", Facing.W, 64, 38);
            map.Add("searchlight_runway", "prop_searchlight", Facing.W, 65, 12);
            map.Add("sandbags_runway", "prop_sandbags", Facing.E, 66, 30);

            // South: main gate, motor pool, workshop, stores and tents.
            map.Add("gate_barrier", "prop_gate_barrier", Facing.S, 30, 48);
            map.Add("guardhouse", "bld_guardhouse", Facing.S, 34, 44);
            map.Add("sandbags_gate", "prop_sandbags", Facing.S, 26, 46);
            map.Add("searchlight_gate", "prop_searchlight", Facing.S, 37, 46);
            map.Add("wire_gate_w1", "prop_barbed_wire", Facing.S, 22, 47);
            map.Add("wire_gate_w2", "prop_barbed_wire", Facing.S, 24, 47);
            map.Add("wire_gate_e1", "prop_barbed_wire", Facing.S, 38, 47);
            map.Add("wire_gate_e2", "prop_barbed_wire", Facing.S, 40, 47);
            map.Add("lamp_road_1", "prop_lamp_post", Facing.S, 29, 31);
            map.Add("lamp_road_2", "prop_lamp_post", Facing.S, 33, 31);
            map.Add("lamp_road_3", "prop_lamp_post", Facing.S, 29, 43);
            map.Add("lamp_road_4", "prop_lamp_post", Facing.S, 33, 37);
            map.Add("jeep", "veh_jeep", Facing.S, 19, 33);
            map.Add("truck", "veh_truck", Facing.S, 22, 33);
            map.Add("tank", "veh_tank", Facing.S, 25, 33);
            map.Add("artillery", "veh_artillery", Facing.S, 19, 38);
            map.Add("motorcycle", "veh_motorcycle", Facing.S, 22, 39);
            map.Add("jeep_2", "veh_jeep", Facing.E, 25, 39);
            map.Add("workshop", "bld_workshop", Facing.S, 9, 32);
            map.Add("barrels_workshop", "prop_barrels", Facing.S, 16, 37);
            map.Add("crates_workshop", "prop_crates", Facing.S, 12, 39);
            map.Add("jerrycans_workshop", "prop_jerrycans", Facing.S, 8, 37);
            map.Add("warehouse", "bld_warehouse", Facing.S, 36, 32);
            map.Add("crates_warehouse", "prop_crates", Facing.S, 43, 35);
            map.Add("barrels_warehouse", "prop_barrels", Facing.S, 43, 34);
            map.Add("tent_1", "bld_tent", Facing.S, 36, 39);
            map.Add("tent_2", "bld_tent", Facing.S, 40, 39);
            map.Add("tent_3", "bld_tent", Facing.S, 44, 39);
            map.Add("aa_west", "bld_aa_emplacement", Facing.S, 4, 28);
            map.Add("searchlight_west", "prop_searchlight", Facing.E, 8, 29); // x 8: west of the workshop roof (9..15) so the base stays visible
            map.Add("bush_pond_1", "prop_bush", Facing.S, 12, 42);
            map.Add("bush_pond_2", "prop_bush", Facing.S, 6, 46);
            map.Add("palm_pond", "prop_tree_palm", Facing.S, 13, 44);
        }

        private static void Npcs(MapDef map)
        {
            map.AddNpc(BaseContent.Place("professor", 17.5f, 25f, Facing.S));   // academy door
            map.AddNpc(BaseContent.Place("medic", 9f, 25f, Facing.S));          // medical post door
            map.AddNpc(BaseContent.Place("officer", 31f, 19f, Facing.S));       // HQ steps
            map.AddNpc(BaseContent.Place("guard", 33.5f, 46.5f, Facing.W));     // beside the gate road
            map.AddNpc(BaseContent.Place("mechanic", 53f, 24f, Facing.W));      // by the pilot's aircraft
        }

        private static void Areas(MapDef map)
        {
            map.AddArea("Khu doanh trại", 4, 4, 22, 24);
            map.AddArea("Sân điều lệnh", 25, 19, 13, 9);
            map.AddArea("Sân đỗ", 38, 8, 20, 23);
            map.AddArea("Đường băng", 58, 4, 6, 44);
            map.AddArea("Bãi xe", 18, 32, 12, 10);
            map.AddArea("Khu kho nhiên liệu", 47, 37, 11, 11);
            map.AddArea("Cổng chính", 27, 44, 9, 8);
        }

        // Jungle ring outside the fence: staggered 2×2 trees so no corridor runs along the outside.
        private static void Forest(MapDef map)
        {
            for (int x = 0; x < Width; x += 2)
            {
                bool even = (x / 2) % 2 == 0;
                Tree(map, x, even ? 0 : 1);
                Tree(map, x, even ? 49 : 50);
            }
            for (int y = 2; y < Height - 2; y += 2)
            {
                bool even = (y / 2) % 2 == 0;
                Tree(map, even ? 0 : 1, y);
                Tree(map, even ? 69 : 70, y);
            }
            // Undergrowth in the gaps (walk-through).
            for (int y = 0; y < Height; y++)
                for (int x = 0; x < Width; x++)
                    if ((x < 3 || x > 68 || y < 3 || y > 48) && MapDef.TileHash(x, y) % 3 == 0 && Wild(map, x, y, 1, 1))
                        map.Add("bush_" + x + "_" + y, "prop_bush", Facing.S, x, y);
        }

        private static void Tree(MapDef map, int x, int y)
        {
            if (!Wild(map, x, y, 2, 2)) return;
            string model = MapDef.TileHash(x, y) % 3 == 0 ? "prop_tree_palm" : "prop_tree_jungle";
            map.Add("tree_" + x + "_" + y, model, (Facing)(MapDef.TileHash(y, x) % 4), x, y);
        }

        // Free grass outside the fence.
        private static bool Wild(MapDef map, int x, int y, int w, int h)
        {
            if (!map.AreaFree(x, y, w, h)) return false;
            for (int j = y; j < y + h; j++)
                for (int i = x; i < x + w; i++)
                    if (map.GroundAt(i, j) != Ground.Grass) return false;
            return true;
        }
    }
}

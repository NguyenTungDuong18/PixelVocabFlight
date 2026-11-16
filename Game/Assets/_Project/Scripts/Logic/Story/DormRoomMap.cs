namespace PixelVocabFlight
{
    // M1 dormitory room: 12x8 walkable tiles on WoodFloor (x 1..12, y 2..9) inside a 14x11 map; everything else is Void.
    // Back wall (12x1) on row y=1, side walls (1x8) on x=0 and x=13. The wall objects (map, photo, window...) hang on the
    // back wall: Layer Wall on row y=1, on top of the wall's footprint, never solid, so the whole row y=2 is open floor. The rug is Layer Floor. Jonas' side is on the left (x 1..5), Daan's on the right (x 9..12), the
    // window in the middle. Objects the story can use carry Tag "story:<id>". Footprints are top-left tiles (see WorldModels).
    //
    //   y1   [ back wall + Wall layer: mail mail . photo hand sketch [window] . letter poster poster . ]
    //   y2 w | . . . . . . . . . . . . | w
    //   y3..5  bed bed . rug rug rug . . . crate bed bed   (beds x1-2 and x11-12, y 3..5; the rug is Floor, y 3..4; crate = notebook_english, Object, solid, (10,3))
    //   y6     trunk trunk . desk desk desk . . . . trunk trunk   (desk x5-7, y 6..7)
    //   y8     . . . . . chair . . . . . .
    public static class DormRoomMap
    {
        public const string Id = "m1_dorm";
        public const int Width = 14, Height = 11;
        public const string DaanId = "daan";
        // Daan climbs out of the window at P1.12: queue these legs with BaseWorld.NpcWalkTo (straight lines, no pathfinding).
        // The last point is on the floor right under the window (row y=2 is open floor).
        public static readonly (float x, float y)[] DaanWindowRoute = { (10f, 4.6f), (7f, 2.6f) };
        public const float DaanWalkSpeed = 2.5f;

        public static MapDef Create()
        {
            var map = new MapDef(Id, "Phòng nội trú", Width, Height, Ground.Void)
            {
                SpawnX = 6.5f, SpawnY = 5f, SpawnFacing = Facing.N,
                AircraftReturnX = 6.5f, AircraftReturnY = 5f,
            };
            map.FillGround(0, 1, Width, 9, Ground.WoodFloor);   // row 0 and row 10 stay Void (wall sprites overflow into them)
            map.AddArea("Phòng nội trú", 1, 2, 12, 8);

            // Walls share the room's name, so the zone label never changes inside the room (no zone toasts).
            map.Add("wall_back", "bld_dorm_wall", Facing.S, 1, 1, "Phòng nội trú");
            map.Add("wall_left", "bld_dorm_wall_side", Facing.S, 0, 2, "Phòng nội trú");
            map.Add("wall_right", "bld_dorm_wall_side", Facing.S, 13, 2, "Phòng nội trú");

            // Wall layer: hangs on the back wall (row y=1), drawn after every character, never blocks.
            const PlacementLayer W = PlacementLayer.Wall;
            map.Add("window", "prop_dorm_window", Facing.S, 6, 1, tag: "story:window", layer: W);
            // Jonas' wall (left).
            map.Add("wall_mailmap", "prop_wall_mailmap", Facing.S, 1, 1, tag: "story:wall_mailmap", layer: W);
            map.Add("photo_floris", "prop_photo_floris", Facing.S, 3, 1, tag: "story:photo_floris", layer: W);
            map.Add("handkerchief", "prop_handkerchief_nail", Facing.S, 4, 1, tag: "story:handkerchief", layer: W);
            map.Add("sketchbook_floris", "prop_sketchbook_floris", Facing.S, 5, 1, tag: "story:sketchbook_floris", layer: W);
            // Daan's wall (right).
            map.Add("letter_daan_mother", "prop_letter_daan_mother", Facing.S, 9, 1, tag: "story:letter_daan_mother", layer: W);
            map.Add("poster_airline", "prop_poster_airline", Facing.S, 10, 1, tag: "story:poster_airline", layer: W);
            // The wooden crate beside the head of Daan's bed stands on the floor: Object, solid. x 10 y 3 keeps it out of the
            // bed's headboard sprite (at x 12 y 2 the headboard covered it) and leaves row y=2 fully open.
            map.Add("notebook_english", "prop_notebook_english", Facing.S, 10, 3, tag: "story:notebook_english");

            map.Add("rug", "prop_dorm_rug", Facing.S, 5, 3, layer: PlacementLayer.Floor);
            map.Add("bed_jonas", "prop_dorm_bed_jonas", Facing.S, 1, 3);
            map.Add("bed_daan", "prop_dorm_bed_daan", Facing.S, 11, 3);
            map.Add("trunk_jonas", "prop_dorm_trunk", Facing.S, 1, 6);
            map.Add("trunk_daan", "prop_dorm_trunk", Facing.S, 11, 6);
            map.Add("desk", "prop_dorm_desk", Facing.S, 5, 6, tag: "story:exam_diagram");
            map.Add("chair", "prop_dorm_chair", Facing.S, 6, 8);

            // Daan sits on the edge of his bed (x 10.7 is just outside the bed footprint, so the bed sprite cannot cover him); he has no dialogue graph (the story talks through Dialogue beats).
            map.AddNpc(new NpcDef { Id = DaanId, Name = "Daan", Role = "Bạn cùng phòng", Character = "daan", X = 10.7f, Y = 4.6f, Facing = Facing.W });
            return map;
        }
    }
}

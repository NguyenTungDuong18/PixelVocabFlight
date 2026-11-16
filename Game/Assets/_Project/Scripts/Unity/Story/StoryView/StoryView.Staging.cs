namespace PixelVocabFlight
{
    // Acting of the M1 dormitory that is not in the story data (Hồi 0 - M1 Phần 1, column "Nhân vật"): who sits where
    // in which frame, Jonas' hands in P1.09, Daan climbing out of the window in P1.12.
    public sealed partial class StoryView
    {
        public const string JonasSit = "chr_pilot_young_sit_s", JonasHands = "chr_pilot_young_hands_s", DaanSit = "chr_daan_sit_s";
        // Feet points on the foot edge of each bed (bed y 3..6): y = 6 sorts the actor in front of the bed model, so he
        // is drawn sitting on the blanket at the edge instead of standing beside it. Jonas' bed is x 1..3, Daan's x 11..13.
        public const float SeatX = 2.5f, SeatY = 6f, DaanSeatX = 11.5f, DaanSeatY = 6f;
        // Where Jonas stands up to (beside his bed) when a frame gives the control back.
        public const float StandX = 3.6f, StandY = 5f;
        public const string WindowId = "window";

        private bool playerSeated;

        private static bool InRange(string id, string first, string last) =>
            string.CompareOrdinal(id, first) >= 0 && string.CompareOrdinal(id, last) <= 0;

        // Once per built dormitory: Daan starts on his bed (he spawns beside it; a very fast walk puts him there).
        private void StageDormBuilt(BaseWorld world)
        {
            playerSeated = false;
            if (world.Map.Id != DormRoomMap.Id) return;
            world.NpcWalkTo(DormRoomMap.DaanId, DaanSeatX, DaanSeatY, 1000f);
            world.Tick(.05f, 0, 0, false);
        }

        private void ApplyStaging(StoryBeat beat, BaseWorld world)
        {
            map.ClearPoses();
            if (world.Map.Id != DormRoomMap.Id) return;
            string id = beat.Id;
            // Daan reads on his bed, then sits cross-legged while they talk (P1.01-P1.11).
            if (InRange(id, "m1.P1.01", "m1.P1.11")) map.SetPose(DormRoomMap.DaanId, DaanSit);
            bool hands = id == "m1.P1.09";
            bool seated = id == "m1.P1.06" || id == "m1.P1.07" || id == "m1.P1.10" || id == "m1.P1.11";
            if (seated || hands)
            {
                world.PlacePlayer(SeatX, SeatY, Facing.S);
                map.SetPose("pilot", hands ? JonasHands : JonasSit);
                playerSeated = true;
            }
            else if (playerSeated)
            {
                world.PlacePlayer(StandX, StandY, Facing.E);   // standing up from the bed
                playerSeated = false;
            }
            if (id == "m1.P1.12")
                foreach (var leg in DormRoomMap.DaanWindowRoute) world.NpcWalkTo(DormRoomMap.DaanId, leg.x, leg.y, DormRoomMap.DaanWalkSpeed);
        }

        // BaseWorld.NpcArrived: Daan reached the window; he climbs out and the window stands open.
        public void OnNpcArrived(string npcId)
        {
            if (npcId != DormRoomMap.DaanId || !map.IsBuilt || Current == null || Current.Id != "m1.P1.12") return;
            map.HoldPlacement(WindowId, 1);
            map.HideActor(DormRoomMap.DaanId, true);
        }
    }
}

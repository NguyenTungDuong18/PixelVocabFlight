using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Hồi 0 - M1 Phần 1 (P1.01-P1.16): the beats. The rows where the player "touches" an object are Map beats gated by
    // Required (P1.02-P1.05, P1.08); the talking rows are Dialogue beats drawn over the room (P1.06-P1.11) or over the roof.
    public static partial class Act0Content
    {
        private const string Room = DormRoomMap.Id, Roof = "vista_m1_roof", Lights = "fx_village_lights";

        private static StoryBeat[] M1Beats() => new[]
        {
            // P1.01 open from black; 4 s locked, then the player gets control (the next beat keeps the same world).
            new StoryBeat
            {
                Id = "m1.P1.01", Kind = StoryBeatKind.Map, Map = Room, Seconds = 4, LockPlayer = true,
                Hint = "Dùng WASD để đi lại. Lại gần đồ vật rồi bấm E để xem.", Sounds = new[] { "frogs", "clock" },
            },
            // P1.02 Jonas' wall: the route map and Floris' sketchbook (the photo and handkerchief come in P1.04, P1.05).
            new StoryBeat
            {
                Id = "m1.P1.02", Kind = StoryBeatKind.Map, Map = Room, Hint = "Xem những thứ chú Floris để lại trên tường của Jonas.",
                Hotspots = new[] { Obj("wall_mailmap", "Bản đồ tuyến thư", "m1_mailmap"), Obj("sketchbook_floris", "Sổ vẽ của chú Floris", "m1_sketchbook") },
                Required = new[] { "wall_mailmap", "sketchbook_floris" },
            },
            // P1.03 Daan's wall.
            new StoryBeat
            {
                Id = "m1.P1.03", Kind = StoryBeatKind.Map, Map = Room, Hint = "Xem ba món trên tường của Daan.",
                Hotspots = new[]
                {
                    Obj("poster_airline", "Áp phích hãng bay", "m1_poster"), Obj("notebook_english", "Sổ tay tiếng Anh", "m1_notebook"),
                    Obj("letter_daan_mother", "Thư của mẹ Daan", "m1_letter"),
                },
                Required = new[] { "poster_airline", "notebook_english", "letter_daan_mother" },
            },
            // P1.04 touch the photo of Floris (close-up with the back side).
            new StoryBeat
            {
                Id = "m1.P1.04", Kind = StoryBeatKind.Map, Map = Room, Hint = "Xem tấm ảnh trên tường của Jonas.", Sounds = new[] { "note" },
                Hotspots = new[] { Obj("photo_floris", "Ảnh chú Floris", "m1_photo", "cut_m1_floris_photo") },
                Required = new[] { "photo_floris" },
            },
            // P1.05 touch the handkerchief; Floris' last note.
            new StoryBeat
            {
                Id = "m1.P1.05", Kind = StoryBeatKind.Map, Map = Room, Hint = "Xem chiếc khăn tay đóng đinh trên tường.", Sounds = new[] { "cloth" },
                Hotspots = new[] { Obj("handkerchief", "Khăn tay", "m1_handkerchief", "cut_m1_handkerchief_note") },
                Required = new[] { "handkerchief" },
            },
            // P1.06 optional story: Jonas sits on the bed (choice "Kể tiếp").
            new StoryBeat { Id = "m1.P1.06", Kind = StoryBeatKind.Dialogue, Map = Room, Dialogue = "m1_floris_story", Sounds = new[] { "frogs_low" } },
            new StoryBeat { Id = "m1.P1.07", Kind = StoryBeatKind.Dialogue, Map = Room, Dialogue = "m1_unlucky" },
            // P1.08 the exam diagram on the desk.
            new StoryBeat
            {
                Id = "m1.P1.08", Kind = StoryBeatKind.Map, Map = Room, Hint = "Xem sơ đồ bài thi trải trên bàn học.",
                Hotspots = new[] { Obj("exam_diagram", "Sơ đồ bài thi", "m1_exam") },
                Required = new[] { "exam_diagram" },
            },
            // P1.09 Jonas shows with a pencil (animation chr_pilot_young_hands_s).
            new StoryBeat { Id = "m1.P1.09", Kind = StoryBeatKind.Dialogue, Map = Room, Dialogue = "m1_hesitate" },
            // P1.10 the first choice of the game: pride +1 / -1.
            new StoryBeat { Id = "m1.P1.10", Kind = StoryBeatKind.Dialogue, Map = Room, Dialogue = "m1_tone" },
            new StoryBeat { Id = "m1.P1.11", Kind = StoryBeatKind.Dialogue, Map = Room, Dialogue = "m1_propeller" },
            // P1.12 Daan walks to the window (route DormRoomMap.DaanWindowRoute, speed DormRoomMap.DaanWalkSpeed) and climbs out;
            // the player follows by using the window.
            new StoryBeat
            {
                Id = "m1.P1.12", Kind = StoryBeatKind.Map, Map = Room, Exit = "window", Sounds = new[] { "-clock", "frogs", "wind" },
                Hint = "Đi theo Daan: lại gần cửa sổ rồi bấm E.",
            },
            // P1.13 on the roof: look at three far things.
            new StoryBeat
            {
                Id = "m1.P1.13", Kind = StoryBeatKind.Vista, Sprite = Roof, Layers = new[] { Lights },
                Hint = "Chọn một thứ ở xa bằng A/D hoặc chuột, rồi bấm E để xem.",
                Hotspots = new[]
                {
                    Far("water_tower", "Tháp nước", "m1_water_tower", 300, 44, 60, 90),
                    Far("airfield_grass", "Bãi cỏ sân bay", "m1_airfield", 120, 116, 150, 46),
                    Far("plane_seven", "Chiếc máy bay dưới trăng", "m1_plane", 200, 98, 60, 36),
                },
                Required = new[] { "water_tower", "airfield_grass", "plane_seven" },
            },
            new StoryBeat { Id = "m1.P1.14", Kind = StoryBeatKind.Dialogue, Sprite = Roof, Layers = new[] { Lights }, Dialogue = "m1_london_bet" },
            // P1.15 one note of music when Daan reads the first word.
            new StoryBeat
            {
                Id = "m1.P1.15", Kind = StoryBeatKind.Dialogue, Sprite = Roof, Layers = new[] { Lights }, Dialogue = "m1_first_word",
                Sounds = new[] { "note" },
            },
            // P1.16 near dawn: frogs go quiet, a deep drone, a stream of bombers across the moon; Jonas speaks (own dialogue).
            new StoryBeat
            {
                Id = "m1.P1.16", Kind = StoryBeatKind.Vista, Sprite = Roof, Layers = new[] { Lights, "fx_bomber_stream_night" },
                Dialogue = "m1_drone", Sounds = new[] { "-frogs", "drone" },
            },
        };
    }
}

using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Hồi 0 - Cảnh mở (P1.01-P1.07, about 24 s, no interaction). Durations follow the "Khung hình" column.
    public static partial class Act0Content
    {
        private const string TinBg = "cut_open_tin_bg", Rain = "fx_rain_shadow";

        private static StoryBeat[] OpeningBeats() => new[]
        {
            // P1.01 handwritten sentence, no sound at all.
            new StoryBeat
            {
                Id = "open.P1.01", Kind = StoryBeatKind.Text, Seconds = 5, TextStyle = "ink", Sprite = "cut_open_ink",
                Lines = new[] { "Hồi ấy tôi tưởng bầu trời là của mình." }, Sounds = new[] { "silence" },
            },
            // P1.02 black screen; rain and a radio whose words cannot be understood (no music).
            new StoryBeat { Id = "open.P1.02", Kind = StoryBeatKind.Text, Seconds = 2, Lines = new string[0], Sounds = new[] { "rain", "radio" } },
            // P1.03 the biscuit tin on the table.
            new StoryBeat { Id = "open.P1.03", Kind = StoryBeatKind.Cut, Seconds = 4, Sprite = TinBg, Layers = new[] { Rain } },
            // P1.04 both hands come in and take the tin by its sides (the two palms knock at 1.25 s).
            new StoryBeat
            {
                Id = "open.P1.04", Kind = StoryBeatKind.Cut, Seconds = 3, Sprite = TinBg,
                Layers = new[] { Rain, "cut_open_tin_hand" }, Sounds = new[] { "tin_touch" },
            },
            // P1.05 the left hand braces, the right pinches the lid's front edge and strains (it shakes, the lid will not give),
            // then it springs open at 2.5 s and the six things inside show; 4 s so the animation (30 frames @8) finishes and rests.
            new StoryBeat
            {
                Id = "open.P1.05", Kind = StoryBeatKind.Cut, Seconds = 4, Sprite = TinBg,
                Layers = new[] { Rain, "cut_open_tin_lid" }, Sounds = new[] { "tin_open" },
            },
            // P1.06 frozen last picture of P1.05; the unnamed voice line, radio off, rain stays.
            new StoryBeat
            {
                Id = "open.P1.06", Kind = StoryBeatKind.Cut, Seconds = 3, Sprite = TinBg, TextStyle = "plain",
                Layers = new[] { Rain, "cut_open_tin_lid" }, Lines = new[] { "Anh giữ hết à." }, Sounds = new[] { "-radio" },
            },
            // P1.07 the first date the game states; rain cuts out, silence until the frogs of M1.
            new StoryBeat
            {
                Id = "open.P1.07", Kind = StoryBeatKind.Text, Seconds = 3, TextStyle = "type",
                Lines = new[] { "Brandhaven, Velmark. Ngày 9 tháng 5 năm 1940." }, Sounds = new[] { "-rain", "-radio", "silence" },
            },
        };
    }
}

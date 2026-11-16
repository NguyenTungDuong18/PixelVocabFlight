using UnityEngine;

namespace PixelVocabFlight
{
    // The one place that says how big the story and the menus are drawn: a 1920x1080 reference canvas (Full HD, 16:9),
    // 1 art pixel = 4 screen pixels, full-screen pictures 480x270 art px. Other window shapes get black bars (see
    // FlightView.Shell). The airbase and sorties (--legacy) keep their own 1440x900 / x3 and never read this.
    public static class StoryLayout
    {
        public const float Width = 1920, Height = 1080, Scale = 4, TileSize = 16 * Scale;
        public const int ArtWidth = 480, ArtHeight = 270;

        public static Vector2 Size => new Vector2(Width, Height);

        // The fonts are only crisp in steps of 16 px (Wordwing): the design size that gives each text role its pixel size.
        // Body text 48 px, choices / prompts / menu rows 48 px (fallback font 36 px), names and footers 32 px.
        public const int BodyDesign = 34, ChoiceDesign = 28, NameDesign = 22, SmallDesign = 22;
    }
}

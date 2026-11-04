using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Land battlefields use PixelForge ground tiles (680x560 art px, shown at 2x) that tile vertically.
    // Each tile has a sharp image over its blurred twin; Focus fades the sharp one out during flight
    // so the player looks at the aircraft. A second tile pair crossfades the next biome. The ocean
    // keeps its own animated sharp water (OceanBackdrop).
    public sealed class ScrollingTerrain
    {
        public const float TileWidth = 1360, TileHeight = 1120;
        private static readonly string[] Keys = { "jungle", "desert", "ice", "ocean" };
        private readonly Image[] blurred = new Image[4], sharp = new Image[4];
        private float offset, blend = 1;
        private FlightEnvironment previous = (FlightEnvironment)(-1);
        private FlightEnvironment fadingFrom = (FlightEnvironment)(-1);
        private readonly OceanBackdrop ocean;
        public Wildlife Wildlife { get; }
        // 0 = sharp ground (take-off), 1 = fully out of focus (combat).
        public float Focus { get; set; } = 1;
        // Screen y (downwards) of the top edge of tile 0; Wildlife maps actors onto tile rows with it.
        public float Offset => offset;
        public float OceanAnimationSeconds => ocean.AnimationSeconds;
        public int OceanImageIndex => ocean.CurrentImage;
        public string GroundSpriteName => blurred[2].sprite ? blurred[2].sprite.name : "";
        public float SharpAlpha => sharp[2].color.a;
        public void Wake(float x, float y) => ocean.Wake(x, y);

        public ScrollingTerrain(Transform parent, float width, float height)
        {
            var layers = UiKit.Rect("Terrain layers", parent, 0, 0, width, height);
            for (int i = 0; i < 4; i++)
            {
                blurred[i] = UiKit.Box("Ground (soft focus)", layers, 0, 0, TileWidth, TileHeight, Color.clear);
                sharp[i] = UiKit.Box("Ground (sharp)", blurred[i].transform, 0, 0, TileWidth, TileHeight, Color.clear);
            }
            Wildlife = new Wildlife(layers, width, height, this);
            ocean = new OceanBackdrop(layers, width, height);
        }

        private static string Name(FlightEnvironment environment) => "terrain_" + Keys[(int)environment];

        private void Assign(int i, FlightEnvironment environment)
        {
            bool land = environment != FlightEnvironment.Ocean;
            blurred[i].sprite = land ? PixelSprites.Get(Name(environment) + "_blur") : null;
            sharp[i].sprite = land ? PixelSprites.Get(Name(environment)) : null;
        }

        public void Animate(float delta, FlightEnvironment environment, float multiplier)
        {
            if (previous != environment)
            {
                fadingFrom = previous;
                for (int i = 0; i < 2; i++) { Assign(i, previous == (FlightEnvironment)(-1) ? environment : previous); Assign(i + 2, environment); }
                blend = previous == (FlightEnvironment)(-1) ? 1 : 0; previous = environment;
            }
            blend = Mathf.Clamp01(blend + delta / 6);
            offset = (offset + delta * 24 * multiplier) % TileHeight;
            for (int i = 0; i < 4; i++)
            {
                blurred[i].rectTransform.anchoredPosition = new Vector2(0, i % 2 == 0 ? -offset : TileHeight - offset);
                float alpha = blurred[i].sprite ? (i < 2 ? 1 - blend : blend) : 0;
                blurred[i].color = new Color(1, 1, 1, alpha);
                sharp[i].color = new Color(1, 1, 1, alpha * (1 - Focus));
            }
            float sea = environment == FlightEnvironment.Ocean ? blend : fadingFrom == FlightEnvironment.Ocean ? 1 - blend : 0;
            ocean.Animate(delta, sea, multiplier);
            Wildlife.Animate(delta, environment, 24 * multiplier, Focus, blend);
        }

        public void Snap(FlightEnvironment environment)
        {
            previous = fadingFrom = environment; blend = 1;
            for (int i = 0; i < 4; i++) Assign(i, environment);
            Wildlife.Clear(); Wildlife.Populate(environment);
        }
    }
}

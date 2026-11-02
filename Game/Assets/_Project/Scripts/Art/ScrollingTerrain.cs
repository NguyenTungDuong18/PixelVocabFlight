using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Generated pixel terrain scrolls in pairs; a second pair crossfades the next biome.
    public sealed class ScrollingTerrain
    {
        private readonly Image[] tiles = new Image[4];
        private readonly Sprite[] textures = new Sprite[4];
        private readonly float height;
        private float offset, blend = 1;
        private FlightEnvironment previous = (FlightEnvironment)(-1);
        private FlightEnvironment fadingFrom = (FlightEnvironment)(-1);
        private readonly OceanBackdrop ocean;
        public float OceanAnimationSeconds => ocean.AnimationSeconds;
        public int OceanImageIndex => ocean.CurrentImage;
        public void Wake(float x,float y)=>ocean.Wake(x,y);

        public ScrollingTerrain(Transform parent, float width, float height)
        {
            this.height = height;
            var layers=UiKit.Rect("Terrain layers",parent,0,0,width,height);
            for (int i = 0; i < 4; i++) textures[i] = Generate((FlightEnvironment)i);
            for (int i = 0; i < 4; i++) tiles[i] = UiKit.Box("Scrolling terrain", layers, 0, 0, width, height, Color.clear);
            ocean=new OceanBackdrop(layers,width,height);
        }

        public void Animate(float delta, FlightEnvironment environment, float multiplier)
        {
            if (previous != environment)
            {
                fadingFrom=previous;
                for (int i = 0; i < 2; i++) { tiles[i].sprite = previous == (FlightEnvironment)(-1) ? textures[(int)environment] : textures[(int)previous]; tiles[i + 2].sprite = textures[(int)environment]; }
                blend = previous == (FlightEnvironment)(-1) ? 1 : 0; previous = environment;
            }
            blend = Mathf.Clamp01(blend + delta / 6);
            offset = (offset + delta * 24 * multiplier) % height;
            for (int i = 0; i < 4; i++)
            {
                tiles[i].rectTransform.anchoredPosition = new Vector2(0, i % 2 == 0 ? -offset : height - offset);
                bool suppliedOcean=tiles[i].sprite==textures[(int)FlightEnvironment.Ocean];
                tiles[i].color = new Color(1, 1, 1, suppliedOcean?0:.46f * (i < 2 ? 1 - blend : blend));
            }
            float sea=environment==FlightEnvironment.Ocean?blend:fadingFrom==FlightEnvironment.Ocean?1-blend:0;
            ocean.Animate(delta,sea,multiplier);
        }

        public void Snap(FlightEnvironment environment)
        {
            previous = fadingFrom = environment; blend = 1;
            foreach (var tile in tiles) tile.sprite = textures[(int)environment];
        }

        private static Sprite Generate(FlightEnvironment environment)
        {
            const int w = 320, h = 128;
            var texture = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Repeat };
            var random = new System.Random(190 + (int)environment);
            var pixels = new Color[w * h];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                float noise = Mathf.PerlinNoise(x * .055f + 7, y * .055f + (int)environment * 10);
                Color color;
                if (environment == FlightEnvironment.Jungle)
                {
                    float river = 150 + Mathf.Sin(y * Mathf.PI * 2 / h) * 28;
                    color = Mathf.Abs(x - river) < 7 ? UiKit.Hex("376D79") : Color.Lerp(UiKit.Hex("173C30"), UiKit.Hex("57805A"), noise);
                    if ((x / 5 + y / 4) % 3 == 0 && noise > .43f) color *= .75f;
                }
                else if (environment == FlightEnvironment.Desert)
                {
                    float dunes = Mathf.Sin(x * .07f + Mathf.Sin(y * Mathf.PI * 2 / h) * 2) * .5f + .5f;
                    color = Color.Lerp(UiKit.Hex("876A42"), UiKit.Hex("D4AA65"), dunes * .55f + noise * .45f);
                    if (random.NextDouble() < .009) color = UiKit.Hex("604C37");
                }
                else if (environment == FlightEnvironment.Ice)
                {
                    color = Color.Lerp(UiKit.Hex("739AA9"), UiKit.Hex("C1D9DC"), noise);
                    int crack = (int)(90 + Mathf.Sin(y * Mathf.PI * 4 / h) * 11 + y % 15);
                    if (Mathf.Abs(x - crack) < 2 || Mathf.Abs(x - crack - 130) < 2) color = UiKit.Hex("476B82");
                }
                else
                {
                    color = Color.Lerp(UiKit.Hex("194B64"), UiKit.Hex("3C8196"), noise);
                    if (y % 13 == 0 && (x + y * 3) % 31 < 17) color = UiKit.Hex("699DA5");
                    float island = Mathf.Pow((x - 262) / 23f, 2) + Mathf.Pow((y - 63) / 17f, 2);
                    if (island < 1) color = island > .72f ? UiKit.Hex("B3A46D") : UiKit.Hex("4F7754");
                }
                pixels[y * w + x] = color;
            }
            texture.SetPixels(pixels); texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, w, h), new Vector2(.5f, .5f));
        }
    }
}

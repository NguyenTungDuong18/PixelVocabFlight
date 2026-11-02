using UnityEngine;

namespace PixelVocabFlight
{
    public static class PixelAircraft
    {
        private static Sprite playerSprite;
        private static Sprite opponentSprite;
        private static readonly Sprite[] environmentSprites = new Sprite[4];

        public static Sprite CreateEnemy(FlightEnvironment environment)
        {
            int index = (int)environment;
            if (environmentSprites[index]) return environmentSprites[index];
            var texture = new Texture2D(40, 40, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            var pixels = new Color[1600];
            Color main = UiKit.Cream, shadow = UiKit.Hex("273D49"), accent = UiKit.Coral;
            void Block(int x, int y, int w, int h, Color color)
            {
                for (int yy = Mathf.Max(0, y); yy < Mathf.Min(40, y + h); yy++)
                    for (int xx = Mathf.Max(0, x); xx < Mathf.Min(40, x + w); xx++) pixels[yy * 40 + xx] = color;
            }
            Block(16, 3, 8, 32, shadow); Block(18, 3, 4, 34, main);
            if (environment == FlightEnvironment.Jungle)
            {
                Block(2, 15, 36, 6, shadow); Block(3, 17, 34, 3, main);
                Block(8, 11, 4, 17, main); Block(28, 11, 4, 17, main);
                Block(5, 27, 10, 2, accent); Block(25, 27, 10, 2, accent);
                Block(12, 5, 16, 3, main);
            }
            else if (environment == FlightEnvironment.Desert)
            {
                for (int row = 0; row < 5; row++) { Block(3 + row * 3, 11 + row * 3, 34 - row * 6, 3, main); }
                Block(10, 4, 20, 3, main); Block(3, 11, 4, 4, accent); Block(33, 11, 4, 4, accent);
            }
            else if (environment == FlightEnvironment.Ice)
            {
                Block(13, 8, 14, 24, main); Block(3, 13, 34, 10, shadow); Block(5, 15, 30, 6, main);
                Block(7, 11, 6, 15, main); Block(27, 11, 6, 15, main);
                Block(8, 21, 4, 3, UiKit.Mint); Block(28, 21, 4, 3, UiKit.Mint);
            }
            else
            {
                Block(7, 13, 26, 5, main); Block(3, 10, 7, 5, main); Block(30, 10, 7, 5, main);
                Block(12, 3, 4, 9, main); Block(24, 3, 4, 9, main); Block(9, 18, 3, 5, accent); Block(28, 18, 3, 5, accent);
            }
            Block(18, 25, 4, 7, shadow); Block(19, 27, 2, 4, UiKit.Hex("75C5D2"));
            texture.SetPixels(pixels); texture.Apply();
            return environmentSprites[index] = Sprite.Create(texture, new Rect(0, 0, 40, 40), new Vector2(.5f, .5f), 40);
        }
        public static Sprite Create(bool friendly)
        {
            Sprite cached = friendly ? playerSprite : opponentSprite;
            if (cached) return cached;
            var texture = new Texture2D(40, 40, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            var pixels = new Color[1600];
            Color shadow = UiKit.Hex("172E3B");
            Color main = friendly ? UiKit.Mint : UiKit.Cream;
            Color mid = friendly ? UiKit.Hex("62AFA4") : UiKit.Hex("B6B2A0");
            Color accent = friendly ? UiKit.Hex("D3F9DA") : UiKit.Coral;
            void Block(int x, int y, int w, int h, Color color)
            {
                for (int yy = y; yy < y + h; yy++)
                    for (int xx = x; xx < x + w; xx++) pixels[yy * 40 + xx] = color;
            }
            Block(17, 3, 8, 31, shadow);
            Block(4, 13, 34, 8, shadow);
            Block(1, 11, 7, 7, shadow);
            Block(33, 11, 6, 7, shadow);
            Block(11, 4, 20, 5, shadow);
            Block(17, 5, 6, 30, main);
            Block(18, 35, 4, 3, main);
            Block(6, 15, 29, 5, main);
            Block(2, 13, 7, 4, main);
            Block(32, 13, 6, 4, main);
            Block(12, 6, 17, 3, main);
            Block(20, 8, 3, 23, mid);
            Block(18, 23, 4, 8, shadow);
            Block(18, 26, 3, 4, UiKit.Hex("75C5D2"));
            Block(3, 14, 3, 2, accent);
            Block(34, 14, 3, 2, accent);
            Block(10, 15, 3, 4, accent);
            Block(27, 15, 3, 4, accent);
            Block(18, 2, 4, 3, accent);
            texture.SetPixels(pixels);
            texture.Apply();
            Sprite sprite = Sprite.Create(texture, new Rect(0, 0, 40, 40), new Vector2(0.5f, 0.5f), 40);
            if (friendly) playerSprite = sprite; else opponentSprite = sprite;
            return sprite;
        }
    }
}

using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Generated pixel terrain scrolls in pairs; a second pair crossfades the next biome.
    public sealed class ScrollingTerrain
    {
        private readonly Image[] tiles = new Image[4];
        private static readonly Sprite[] textures = new Sprite[4];
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
            for (int i = 0; i < 4; i++) if(!textures[i]) textures[i] = Generate((FlightEnvironment)i);
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
                tiles[i].color = new Color(1, 1, 1, suppliedOcean?0:.85f * (i < 2 ? 1 - blend : blend));
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
            var texture=PixelTerrain.Get(environment);
            return Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f));
        }
    }
}

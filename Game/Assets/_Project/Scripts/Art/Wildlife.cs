using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Animals, convoys and trains that live on the scrolling ground below the dogfight.
    // They ride the ground scroll, follow river/road lines baked into the PixelForge tiles
    // (Tools/PixelForge/terrain.cjs) and switch to blurred frames together with the ground.
    public sealed class Wildlife
    {
        private enum Path { Free, River, Circle }
        private sealed class Actor
        {
            public Image Image; public string Anim; public FlightEnvironment Environment;
            public Vector2 Position, Velocity, Centre; public float Rotation, Age, Phase, Radius, Angle, Spin, Offset, Life;
            public Path Path; public bool Steam;
        }
        // Mirrors terrain.cjs: tile 680x560 art px at 2x; road/rail x in art px.
        private const float Art = 2, TileRows = 560, JungleRoadX = 603, DesertPisteX = 563, IceRailX = 594;
        private static float JungleRiverX(float row) => 250 + 46 * Mathf.Sin(2 * Mathf.PI * row / TileRows) + 22 * Mathf.Sin(4 * Mathf.PI * row / TileRows + 1.3f);

        private readonly RectTransform layer;
        private readonly float width, height;
        private readonly ScrollingTerrain ground;
        private readonly List<Actor> actors = new List<Actor>();
        private readonly System.Random random = new System.Random(1944);
        private float spawnTimer = 1.5f, steamTimer, focus = 1;
        private FlightEnvironment current;
        public int Count => actors.Count;
        public bool UsesBlurredFrames => focus > .5f;
        public IEnumerable<string> SpriteNames { get { foreach (var a in actors) if (a.Image.sprite) yield return a.Image.sprite.name; } }

        public Wildlife(Transform parent, float width, float height, ScrollingTerrain ground)
        {
            this.width = width; this.height = height; this.ground = ground;
            layer = UiKit.Rect("Wildlife", parent, 0, 0, width, height);
        }

        private float R(float a, float b) => a + (float)random.NextDouble() * (b - a);
        private float Row(float y) => Mathf.Repeat((y - ground.Offset) / Art, TileRows);

        public void Clear()
        {
            foreach (var a in actors) Object.Destroy(a.Image.gameObject);
            actors.Clear(); spawnTimer = 1;
        }

        private Actor Add(string anim, Vector2 position, Vector2 velocity, float rotation, Path path = Path.Free)
        {
            var size = PixelSprites.Size("actor_" + anim, Art);
            var image = UiKit.Sprite("Actor " + anim, layer, 0, 0, size.x, size.y, "actor_" + anim);
            image.rectTransform.pivot = new Vector2(.5f, .5f);
            image.preserveAspect = false;
            var actor = new Actor { Image = image, Anim = anim, Environment = current, Position = position, Velocity = velocity, Rotation = rotation, Phase = R(0, 2), Path = path };
            actors.Add(actor);
            return actor;
        }

        // Prepopulates the visible ground so the field is never empty on arrival.
        public void Populate(FlightEnvironment environment)
        {
            current = environment;
            for (int i = 0; i < 3; i++) { Spawn(environment, R(40, height - 60)); }
        }

        private void Spawn(FlightEnvironment environment, float y = -90)
        {
            if (environment == FlightEnvironment.Ocean || actors.Count > 46) return;
            float roll = R(0, 1);
            if (environment == FlightEnvironment.Jungle)
            {
                if (roll < .3f)
                {
                    int side = random.Next(2) == 0 ? -1 : 1, count = random.Next(3, 6);
                    for (int i = 0; i < count; i++) { var a = Add("elephant", new Vector2(0, y + i * 40), new Vector2(0, -9), 0, Path.River); a.Offset = side * R(50, 64); }
                }
                else if (roll < .55f)
                {
                    float angle = R(-.5f, .5f) + (random.Next(2) == 0 ? 0 : Mathf.PI); var dir = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                    float x = dir.x > 0 ? -60 : width + 60, sy = R(40, height * .6f);
                    for (int i = 0; i < 7; i++) { int rank = (i + 1) / 2, wing = i % 2 == 0 ? 1 : -1; var offset = -dir * rank * 26 + new Vector2(-dir.y, dir.x) * wing * rank * 20; Add("egret", new Vector2(x, sy) + offset, dir * 62 + new Vector2(0, -24), 0); }
                }
                else if (roll < .72f) { var a = Add("sampan", new Vector2(0, y), new Vector2(0, random.Next(2) == 0 ? -14 : 10), 0, Path.River); a.Offset = R(-8, 8); }
                else if (roll < .88f) { bool north = random.Next(2) == 0; for (int i = 0; i < 3; i++) Add("truck_jungle", new Vector2(JungleRoadX * Art, y - i * 52 * (north ? -1 : 1)), new Vector2(0, north ? -34 : 16), north ? 0 : 180); }
                else for (int i = 0; i < 3; i++) Add("buffalo", new Vector2(R(900, 1130), y + R(-30, 30)), new Vector2(R(-2, 2), R(-3, 3)), 90 * random.Next(4));
            }
            else if (environment == FlightEnvironment.Desert)
            {
                if (roll < .4f)
                {
                    bool east = random.Next(2) == 0; float x = east ? -40 : width + 40;
                    for (int i = 0, n = random.Next(4, 7); i < n; i++) Add("camel", new Vector2(x - (east ? 1 : -1) * i * 34, y + i * 3), new Vector2(east ? 13 : -13, 0), east ? -90 : 90);
                }
                else if (roll < .7f)
                {
                    var centre = new Vector2(R(180, width - 260), y - 40);
                    for (int i = 0; i < 3; i++) { var a = Add("vulture", centre, Vector2.zero, 0, Path.Circle); a.Centre = centre; a.Radius = R(46, 78); a.Angle = i * 2.1f; a.Spin = R(.55f, .8f) * (i == 1 ? -1 : 1); }
                }
                else for (int i = 0; i < 4; i++) Add(i % 2 == 0 ? "tank_desert" : "truck_desert", new Vector2(DesertPisteX * Art, y + i * 60), new Vector2(0, -26), 0);
            }
            else
            {
                if (roll < .4f)
                {
                    bool east = random.Next(2) == 0; float x = east ? -50 : width + 50, dir = east ? 1 : -1;
                    for (int i = 0, n = random.Next(5, 9); i < n; i++) Add("reindeer", new Vector2(x - dir * R(0, 120), R(30, height * .7f)), new Vector2(dir * R(42, 50), -18), east ? -90 : 90);
                    if (random.Next(2) == 0) for (int i = 0; i < 3; i++) Add("wolf", new Vector2(x - dir * (190 + i * 30), R(60, height * .6f)), new Vector2(dir * 52, -18), east ? -90 : 90);
                }
                else if (roll < .65f)
                {
                    float angle = R(0, Mathf.PI * 2); var dir = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                    var start = new Vector2(width * .5f, height * .5f) - dir * (width * .6f);
                    for (int i = 0; i < 6; i++) Add("crow", start + new Vector2(R(-40, 40), R(-30, 30)), dir * R(48, 58) + new Vector2(0, -24), 0);
                }
                else
                {
                    bool north = random.Next(2) == 0;
                    float speed = north ? -44 : 14, sign = north ? 1 : -1;
                    var loco = Add("locomotive", new Vector2(IceRailX * Art, y), new Vector2(0, speed), north ? 0 : 180);
                    loco.Steam = true;
                    for (int i = 0; i < 4; i++) Add("wagon", new Vector2(IceRailX * Art, y + sign * (66 + i * 56)), new Vector2(0, speed), north ? 0 : 180);
                }
            }
        }

        public void Animate(float delta, FlightEnvironment environment, float scroll, float focus, float blend)
        {
            this.focus = focus;
            if (environment != current) current = environment;
            spawnTimer -= delta;
            if (spawnTimer <= 0) { spawnTimer = R(2.8f, 5.5f); Spawn(environment); }
            steamTimer += delta; bool puff = steamTimer >= .22f; if (puff) steamTimer = 0;
            for (int i = actors.Count - 1; i >= 0; i--)
            {
                var a = actors[i];
                a.Age += delta;
                if (a.Path == Path.Circle)
                {
                    a.Centre.y += scroll * delta; a.Angle += a.Spin * delta;
                    a.Position = a.Centre + new Vector2(Mathf.Cos(a.Angle), Mathf.Sin(a.Angle)) * a.Radius;
                    var tangent = new Vector2(-Mathf.Sin(a.Angle), Mathf.Cos(a.Angle)) * Mathf.Sign(a.Spin);
                    a.Rotation = Vector2.SignedAngle(Vector2.up, new Vector2(tangent.x, -tangent.y));
                }
                else
                {
                    a.Position += (a.Velocity + new Vector2(0, scroll)) * delta;
                    if (a.Path == Path.River)
                    {
                        float row = Row(a.Position.y), ahead = Row(a.Position.y - 8);
                        a.Position.x = JungleRiverX(row) * Art + a.Offset;
                        float slope = (JungleRiverX(ahead) - JungleRiverX(row)) * Art;
                        a.Rotation = Vector2.SignedAngle(Vector2.up, new Vector2(slope, 8)) + (a.Velocity.y > 0 ? 180 : 0);
                    }
                    else if (a.Anim == "egret" || a.Anim == "crow") a.Rotation = Vector2.SignedAngle(Vector2.up, new Vector2(a.Velocity.x, -a.Velocity.y));
                }
                if (a.Steam && puff)
                {
                    var nose = new Vector2(Mathf.Sin(a.Rotation * Mathf.Deg2Rad) * -30, -Mathf.Cos(a.Rotation * Mathf.Deg2Rad) * 30);
                    var s = Add("steam", a.Position + nose, new Vector2(R(-6, 6), -a.Velocity.y * .6f - 8), 0);
                    s.Life = PixelSprites.Duration("actor_steam"); s.Environment = a.Environment;
                }
                bool gone = a.Position.y > height + 140 || a.Position.y < -420 || a.Position.x < -200 || a.Position.x > width + 200 || (a.Life > 0 && a.Age >= a.Life);
                float fade = a.Environment == environment ? blend : 1 - blend;
                if (a.Environment != environment && fade <= .01f) gone = true;
                if (gone) { Object.Destroy(a.Image.gameObject); actors.RemoveAt(i); continue; }
                string anim = "actor_" + a.Anim + (focus > .5f ? "_blur" : "");
                a.Image.sprite = PixelSprites.At(anim, a.Age + a.Phase);
                a.Image.rectTransform.anchoredPosition = new Vector2(Mathf.Round(a.Position.x), -Mathf.Round(a.Position.y));
                a.Image.rectTransform.localEulerAngles = new Vector3(0, 0, a.Rotation);
                a.Image.color = new Color(1, 1, 1, fade);
            }
        }
    }
}

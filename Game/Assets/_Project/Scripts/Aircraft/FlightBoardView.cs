using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed class FlightBoardView
    {
        public const float Width = 1360, Height = 548;
        private sealed class EnemyVisual { public RectTransform Root; public Image Shield, Body; public Text Threat; }
        private sealed class MissileVisual
        {
            public RectTransform Root, Marker;
            public Text Status;
            public Button[] Buttons;
            public Image Body, Feedback;
            public float Flash;
        }
        private sealed class Effect { public RectTransform Rect; public float Remaining, Lifetime; public Vector2 Velocity; }
        private readonly RectTransform field, player;
        private readonly Image flame;
        private readonly Sprite friendly, ring, damageFrame;
        private readonly FlightGame game;
        private readonly ScrollingTerrain terrain;
        private readonly Dictionary<int, EnemyVisual> enemies = new Dictionary<int, EnemyVisual>();
        private readonly Dictionary<int, RectTransform> carriers = new Dictionary<int, RectTransform>();
        private readonly Dictionary<int, MissileVisual> missiles = new Dictionary<int, MissileVisual>();
        private readonly Dictionary<int, RectTransform> supplies = new Dictionary<int, RectTransform>();
        private readonly List<Effect> effects = new List<Effect>();
        private int focusedMissile;
        private float hoverGrace;
        private float wakeTimer;
        public float OceanAnimationSeconds=>terrain.OceanAnimationSeconds;
        public int OceanImageIndex=>terrain.OceanImageIndex;
        public float CarrierVisualAngle(int id)=>carriers[id].localEulerAngles.z;
        public Vector2 CarrierVisualScreenCenter(int id)=>RectTransformUtility.WorldToScreenPoint(null,carriers[id].TransformPoint(Vector3.zero));
        public int OpenMissileId => focusedMissile;
        public int VisibleMissilePopupCount => missiles.Values.Count(v => v.Root.gameObject.activeSelf);
        public int BlastEffects { get; private set; }
        public bool PointerOverMissile => missiles.Values.Any(v => ContainsPointer(v.Marker) || (v.Root.gameObject.activeSelf && ContainsPointer(v.Root)));
        public bool IsMissileFlashing(int id) => missiles.TryGetValue(id, out var visual) && visual.Flash > 0;
        public Vector2 MissilePopupChoiceScreenPoint(int id, int choice) => RectTransformUtility.WorldToScreenPoint(null, missiles[id].Buttons[choice].transform.TransformPoint(new Vector3(78,-17)));
        public void SetEnvironment(FlightEnvironment environment) => terrain.Snap(environment);

        public FlightBoardView(Transform parent, FlightGame game)
        {
            this.game = game;
            field = UiKit.Box("Wide flight field", parent, 40, 103, Width, Height, UiKit.Hex("102C34")).rectTransform;
            field.gameObject.AddComponent<RectMask2D>();
            terrain = new ScrollingTerrain(field, Width, Height);
            friendly = UserArt.Player;
            ring = CreateRing();
            damageFrame = CreateDamageFrame();
            player = UiKit.Rect("Pilot aircraft", field, Width * .5f - 33, Height * ContinuousFlight.PlayerY - 30, 66, 66);
            flame = UiKit.Box("Engine", player, 29, 48, 8, 20, UiKit.Orange);
            UiKit.Box("Player", player, 0, 0, 66, 66, Color.white).sprite = friendly;
            UiKit.Label("YOU", player, -10, 62, 86, 18, 11, UiKit.Mint, true, TextAnchor.MiddleCenter);
        }

        public bool PointerOverField => MousePosition(out _);
        private bool MousePosition(out Vector2 local)
        {
            local = Vector2.zero;
            var mouse = UnityEngine.InputSystem.Mouse.current;
            if (mouse == null) return false;
            var position = mouse.position.ReadValue();
            if (!RectTransformUtility.RectangleContainsScreenPoint(field, position, null)) return false;
            return RectTransformUtility.ScreenPointToLocalPointInRectangle(field, position, null, out local);
        }
        public float PointerX(float fallback) => MousePosition(out var point) ? point.x / Width : fallback;
        public Vector2 ScreenPoint(float x, float y) => RectTransformUtility.WorldToScreenPoint(null, field.TransformPoint(new Vector3(x * Width, -y * Height)));

        public void Clear()
        {
            foreach (var e in enemies.Values) Object.Destroy(e.Root.gameObject);
            foreach (var e in carriers.Values) Object.Destroy(e.gameObject);
            foreach (var e in missiles.Values) { Object.Destroy(e.Root.gameObject); Object.Destroy(e.Marker.gameObject); }
            foreach (var e in supplies.Values) Object.Destroy(e.gameObject);
            foreach (var e in effects) Object.Destroy(e.Rect.gameObject);
            enemies.Clear(); carriers.Clear(); missiles.Clear(); supplies.Clear(); effects.Clear(); focusedMissile = 0; BlastEffects = 0;
        }

        public void Animate(float delta, ContinuousFlight flight, FlightEnvironment menuEnvironment)
        {
            terrain.Animate(delta, flight?.Environment ?? menuEnvironment, flight == null ? .2f : GameRules.SpeedMultiplier(flight.Progress.ActiveSeconds));
            flame.rectTransform.sizeDelta = new Vector2(flight?.Progress.Powered == true ? 12 : 8, 19 + Mathf.Sin(Time.unscaledTime * 20) * 4);
            if (flight != null)
            {
                Place(player, flight.PlayerX, ContinuousFlight.PlayerY, 33, 30);
                SyncEnemies(flight); SyncCarriers(flight,delta); SyncMissiles(flight, delta); SyncSupplies(flight);
                player.SetAsLastSibling();
            }
            for (int i = effects.Count - 1; i >= 0; i--)
            {
                var effect = effects[i]; effect.Remaining -= delta;
                if (effect.Remaining <= 0) { Object.Destroy(effect.Rect.gameObject); effects.RemoveAt(i); continue; }
                effect.Rect.anchoredPosition += effect.Velocity * delta;
                var image = effect.Rect.GetComponent<Image>();
                if (image) { var color = image.color; color.a = effect.Remaining / effect.Lifetime; image.color = color; }
            }
        }

        private static void Place(RectTransform rect, float x, float y, float ox = 0, float oy = 0)
            => rect.anchoredPosition = new Vector2(x * Width - ox, -y * Height + oy);

        private void SyncEnemies(ContinuousFlight flight)
        {
            foreach (int id in enemies.Keys.Where(id => !flight.Enemies.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(enemies[id].Root.gameObject); enemies.Remove(id); }
            foreach (var enemy in flight.Enemies)
            {
                if (!enemies.TryGetValue(enemy.Id, out var visual))
                {
                    var root = UiKit.Rect("Enemy " + enemy.Entry.word, field, 0, 0, 146, 88);
                    var shield = UiKit.Box("Ice shield", root, 27, -16, 92, 92, UiKit.Hex("A4DDE9")); shield.sprite = ring;
                    var body = UiKit.Box("Selected bomber artwork", root, 32, -14, 82, 88, Color.white); body.sprite = UserArt.Enemy;
                    body.rectTransform.pivot = new Vector2(.5f, .5f); body.rectTransform.anchoredPosition = new Vector2(73, -30);
                    body.rectTransform.localEulerAngles = new Vector3(0, 0, 180);
                    var plate = UiKit.Box("English word", root, 0, 43, 146, 26, UiKit.Ink);
                    var word = UiKit.Label(enemy.Entry.word, plate.transform, 4, 0, 138, 26, 19, UiKit.Cream, true, TextAnchor.MiddleCenter);
                    word.resizeTextForBestFit = true; word.resizeTextMinSize = 10; word.resizeTextMaxSize = 19;
                    var threat = UiKit.Label("", root, 0, 69, 146, 15, 10, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    visual = new EnemyVisual { Root = root, Shield = shield, Body = body, Threat = threat }; enemies.Add(enemy.Id, visual);
                }
                visual.Shield.gameObject.SetActive(enemy.Health > 1);
                float scale = Mathf.Clamp(Mathf.Sqrt(40f / Mathf.Max(40, flight.Enemies.Count)), .55f, 1);
                visual.Root.localScale = new Vector3(scale, scale, 1);
                Place(visual.Root, enemy.X, enemy.Y, 73 * scale, 30 * scale);
                visual.Threat.text = enemy.Charging ? (enemy.ChargeDelay > 0 ? "! CHUẨN BỊ LAO TỚI !" : "LAO TỚI / NÉ!") : enemy.RequiresPartOfSpeech ? "+ TỪ LOẠI" : enemy.Environment == FlightEnvironment.Ice ? "BĂNG" : "";
                visual.Body.color = enemy.Charging && Time.unscaledTime % .3f < .15f ? UiKit.Coral : Color.white;
                visual.Body.rectTransform.localEulerAngles = new Vector3(0, 0, enemy.Charging ? Vector2.SignedAngle(Vector2.up, new Vector2(enemy.VelocityX * Width, -enemy.VelocityY * Height)) : 180);
            }
        }

        private void SyncCarriers(ContinuousFlight flight,float delta)
        {
            wakeTimer+=delta;bool wake=wakeTimer>=.35f;if(wake)wakeTimer=0;
            foreach (int id in carriers.Keys.Where(id => !flight.Carriers.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(carriers[id].gameObject); carriers.Remove(id); }
            foreach (var carrier in flight.Carriers)
            {
                if (!carriers.TryGetValue(carrier.Id, out var rect))
                {
                    rect = UiKit.Rect("Carrier 78", field, 0, 0, 144, 204);
                    rect.pivot = new Vector2(.5f,.5f);
                    var body = UiKit.Box("Selected carrier artwork", rect, 0, 0, 144, 204, Color.white);
                    body.sprite = UserArt.Carrier;
                    body.preserveAspect = true;
                    carriers.Add(carrier.Id, rect); rect.SetSiblingIndex(1);
                }
                Place(rect, carrier.X, carrier.Y);
                rect.localEulerAngles=new Vector3(0,0,180+carrier.HeadingDegrees);
                if(wake&&(Mathf.Abs(carrier.VelocityX)+Mathf.Abs(carrier.VelocityY)>.002f))
                {
                    float angle=carrier.HeadingDegrees*Mathf.Deg2Rad;
                    terrain.Wake(carrier.X-Mathf.Sin(angle)*95/Width,carrier.Y-Mathf.Cos(angle)*95/Height);
                }
            }
        }

        private static bool ContainsPointer(RectTransform rect)
        {
            var mouse = UnityEngine.InputSystem.Mouse.current;
            return mouse != null && RectTransformUtility.RectangleContainsScreenPoint(rect, mouse.position.ReadValue(), null);
        }

        public void FlashMissile(int id)
        {
            if (missiles.TryGetValue(id, out var visual)) visual.Flash = .36f;
        }

        private void SyncMissiles(ContinuousFlight flight, float delta)
        {
            foreach (int id in missiles.Keys.Where(id => !flight.Missiles.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(missiles[id].Root.gameObject); Object.Destroy(missiles[id].Marker.gameObject); missiles.Remove(id); }
            if (!flight.Missiles.Any(m => m.Id == focusedMissile && !m.Failed)) focusedMissile = 0;
            foreach (var missile in flight.Missiles)
            {
                if (!missiles.TryGetValue(missile.Id, out var visual))
                {
                    var marker = UiKit.Rect("Missile compact " + missile.Id, field, 0, 0, 188, 120);
                    var body = UiKit.Box("Selected missile artwork", marker, 54, 0, 80, 86, Color.white);
                    body.sprite = UserArt.Missile;
                    body.rectTransform.pivot = new Vector2(.5f,.5f); body.rectTransform.anchoredPosition = new Vector2(94,-43);
                    var plate = UiKit.Box("Vietnamese on missile", marker, 2, 34, 184, 46, UiKit.Ink);
                    var clue = UiKit.Label(missile.Answer.meaning, plate.transform, 4, 1, 176, 44, 17, UiKit.Orange, true, TextAnchor.MiddleCenter);
                    clue.resizeTextForBestFit = true; clue.resizeTextMinSize = 10; clue.resizeTextMaxSize = 17;
                    var feedback = UiKit.Box("Wrong answer red edges", marker, -3, -7, 194, 113, Color.clear);
                    feedback.sprite = damageFrame;

                    var popup = UiKit.Box("Missile hover choices " + missile.Id, field, 0, 0, 342, 143, UiKit.Hex("172935")).rectTransform;
                    var title = UiKit.Label("CHỌN TỪ TIẾNG ANH", popup, 10, 4, 322, 25, 12, UiKit.Muted, true);
                    var buttons = new Button[4];
                    for (int i = 0; i < 4; i++)
                    {
                        int choice = i, id = missile.Id;
                        buttons[i] = UiKit.Button(missile.Choices[i].word, popup, 9+(i%2)*167, 34+(i/2)*39, 157, 34, UiKit.Line, UiKit.Cream, () => game.AnswerMissile(id,choice));
                        var label = buttons[i].GetComponentInChildren<Text>();
                        label.resizeTextForBestFit = true; label.resizeTextMinSize = 10; label.resizeTextMaxSize = 16;
                    }
                    var status = UiKit.Label("", popup, 10, 113, 322, 24, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    popup.gameObject.SetActive(false);
                    visual = new MissileVisual { Root=popup, Marker=marker, Body=body, Feedback=feedback, Status=status, Buttons=buttons };
                    missiles.Add(missile.Id,visual);
                }
                Place(visual.Marker,missile.X,missile.Y,94,43);
                visual.Flash = Mathf.Max(0,visual.Flash-delta);
                float flash = visual.Flash/.36f;
                float shake = Mathf.Sin(visual.Flash*90)*5*flash;
                visual.Body.rectTransform.anchoredPosition = new Vector2(94+shake,-43);
                visual.Body.rectTransform.localEulerAngles = new Vector3(0,0,Vector2.SignedAngle(new Vector2(1,1),new Vector2(missile.VelocityX*Width,-missile.VelocityY*Height)));
                visual.Body.color = flash>0 ? Color.Lerp(Color.white,UiKit.Coral,flash*.6f) : missile.Failed ? UiKit.Coral : Color.white;
                visual.Feedback.color = new Color(1,.12f,.08f,.85f*flash);
                visual.Status.text = (flight.Driving ? "Tab: sang BẮN để chọn · " : "") + "SAI " + missile.WrongAttempts + "/3";
                foreach (var button in visual.Buttons) button.interactable = !flight.Driving && !missile.Failed;
                visual.Marker.SetAsLastSibling();
            }

            bool overOpen = focusedMissile != 0 && missiles.TryGetValue(focusedMissile,out var open) &&
                (ContainsPointer(open.Marker) || (open.Root.gameObject.activeSelf && ContainsPointer(open.Root)));
            if (overOpen) hoverGrace=.16f;
            else
            {
                var hovered = flight.Missiles.LastOrDefault(m => !m.Failed && ContainsPointer(missiles[m.Id].Marker));
                if (hovered != null)
                {
                    focusedMissile=hovered.Id;hoverGrace=.16f;
                    // Freeze the popup where it opens while the actual projectile keeps flying.
                    float x=Mathf.Clamp(hovered.X*Width-171,8,Width-350);
                    float y=hovered.Y*Height+55;
                    if(y+143>Height-8)y=hovered.Y*Height-175;
                    missiles[focusedMissile].Root.anchoredPosition=new Vector2(x,-Mathf.Clamp(y,8,Height-151));
                }
                else { hoverGrace-=delta; if(hoverGrace<=0)focusedMissile=0; }
            }
            foreach(var pair in missiles)
            {
                pair.Value.Root.gameObject.SetActive(pair.Key==focusedMissile);
                if(pair.Key==focusedMissile)pair.Value.Root.SetAsLastSibling();
            }
        }

        private static Sprite CreateDamageFrame()
        {
            var texture=new Texture2D(64,64,TextureFormat.RGBA32,false){filterMode=FilterMode.Bilinear};
            for(int y=0;y<64;y++)for(int x=0;x<64;x++)
            {
                float edge=Mathf.Min(Mathf.Min(x,63-x),Mathf.Min(y,63-y));
                texture.SetPixel(x,y,new Color(1,1,1,Mathf.Clamp01(1-edge/13)));
            }
            texture.Apply();return Sprite.Create(texture,new Rect(0,0,64,64),new Vector2(.5f,.5f));
        }

        private void SyncSupplies(ContinuousFlight flight)
        {
            foreach (int id in supplies.Keys.Where(id => !flight.Supplies.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(supplies[id].gameObject); supplies.Remove(id); }
            foreach (var supply in flight.Supplies)
            {
                if (!supplies.TryGetValue(supply.Id, out var rect))
                {
                    rect = UiKit.Box("Supply " + supply.Kind, field, 0, 0, 42, 34, UiKit.Ink).rectTransform;
                    UiKit.Label(supply.Kind == SupplyKind.Roll ? "R+" : supply.Kind == SupplyKind.Fuel ? "F" : "M", rect, 0, 0, 42, 34, 22, supply.Kind == SupplyKind.Fuel ? UiKit.Orange : UiKit.Mint, true, TextAnchor.MiddleCenter);
                    supplies.Add(supply.Id, rect);
                }
                Place(rect, supply.X, supply.Y, 21, 17); rect.SetAsLastSibling();
            }
        }

        public void Hit(float x, float y, bool killed, float playerX)
        {
            var beam = UiKit.Box("Laser", field, playerX * Width, ContinuousFlight.PlayerY * Height, 3, 1, UiKit.Mint).rectTransform;
            Vector2 vector = new Vector2((x - playerX) * Width, (ContinuousFlight.PlayerY - y) * Height);
            beam.pivot = new Vector2(.5f, 0); beam.sizeDelta = new Vector2(3, vector.magnitude);
            beam.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, vector));
            effects.Add(new Effect { Rect = beam, Lifetime = .16f, Remaining = .16f });
            Burst(x, y, killed ? UiKit.Orange : UiKit.Mint, killed ? 14 : 7);
        }

        public void Burst(float x, float y, Color color, int count = 14)
        {
            for (int i = 0; i < count; i++)
            {
                float angle = i * Mathf.PI * 2 / count;
                var p = UiKit.Box("Explosion", field, x * Width, y * Height, 5, 5, color).rectTransform;
                effects.Add(new Effect { Rect = p, Lifetime = .65f, Remaining = .65f, Velocity = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * (45 + i * 5) });
            }
        }

        public void Blast(float x, float y)
        {
            BlastEffects++;
            float radius = ContinuousFlight.BlastRadius * Width;
            var rect = UiKit.Box("Blast radius", field, x * Width - radius, y * Height - radius, radius * 2, radius * 2, UiKit.Orange).rectTransform;
            rect.GetComponent<Image>().sprite = ring;
            effects.Add(new Effect { Rect = rect, Lifetime = .8f, Remaining = .8f }); Burst(x, y, UiKit.Orange, 22);
        }

        public void FatalMissile(float x, float y, float playerX)
        {
            var rocket = UiKit.Box("Incoming fatal missile", field, x * Width, y * Height, 10, 28, UiKit.Coral).rectTransform;
            Vector2 travel = new Vector2((playerX - x) * Width, -(ContinuousFlight.PlayerY - y) * Height);
            rocket.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.down, travel));
            effects.Add(new Effect { Rect = rocket, Lifetime = .65f, Remaining = .65f, Velocity = travel / .65f });
        }

        private static Color Tint(FlightEnvironment environment)
            => environment == FlightEnvironment.Desert ? UiKit.Hex("F7CC8D") : environment == FlightEnvironment.Ice ? UiKit.Hex("A7DDED") : environment == FlightEnvironment.Jungle ? UiKit.Hex("9CCBAD") : UiKit.Hex("BCC9EB");

        private static Sprite CreateRing()
        {
            var texture = new Texture2D(64, 64, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            for (int y = 0; y < 64; y++) for (int x = 0; x < 64; x++)
            { float r = new Vector2(x - 31.5f, y - 31.5f).magnitude; texture.SetPixel(x, y, r > 27 && r < 31 ? Color.white : Color.clear); }
            texture.Apply(); return Sprite.Create(texture, new Rect(0, 0, 64, 64), new Vector2(.5f, .5f));
        }
    }
}

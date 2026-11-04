using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Renders ContinuousFlight state with frame-by-frame pixel sprites (Tools/PixelForge).
    // Units are drawn at an integer 2x art scale; everything faces north and is rotated here.
    public sealed class FlightBoardView
    {
        public const float Width = 1360, Height = 548, ArtScale = 2;
        private static readonly Vector2 ShadowOffset = new Vector2(9, -13);
        private sealed class EnemyVisual { public RectTransform Root; public Image Shield, Body, Shadow, Plate; public Text Threat; public float Phase; }
        private sealed class CarrierVisual { public RectTransform Root; public Image Body, Bow, Stern; }
        private sealed class MissileVisual
        {
            public RectTransform Root, Marker;
            public Text Status;
            public Button[] Buttons;
            public Image Body, Feedback;
            public float Flash, Age;
        }
        private sealed class Effect
        {
            public RectTransform Rect; public Image Image; public string Anim;
            public float Remaining, Lifetime, Delay, Age; public Vector2 Velocity; public bool Fade;
        }
        private readonly RectTransform field, player;
        private readonly Image playerBody, playerShadow;
        private readonly Vector2 fieldOrigin;
        private float animationTime, previousX = .5f, trailTimer, bankHold, shake;
        private int bank;
        private readonly Sprite damageFrame;
        private readonly FlightGame game;
        private readonly ScrollingTerrain terrain;
        private readonly Dictionary<int, EnemyVisual> enemies = new Dictionary<int, EnemyVisual>();
        private readonly Dictionary<int, CarrierVisual> carriers = new Dictionary<int, CarrierVisual>();
        private readonly Dictionary<int, MissileVisual> missiles = new Dictionary<int, MissileVisual>();
        private readonly Dictionary<int, Image> supplies = new Dictionary<int, Image>();
        private readonly List<Effect> effects = new List<Effect>();
        private int focusedMissile;
        private float hoverGrace;
        private float wakeTimer;
        public string PlayerSpriteName => playerBody.sprite ? playerBody.sprite.name : "";
        public int AnimatedEffects => effects.Count(e => e.Anim != null);
        public float OceanAnimationSeconds => terrain.OceanAnimationSeconds;
        public int OceanImageIndex => terrain.OceanImageIndex;
        public float CarrierVisualAngle(int id) => carriers[id].Root.localEulerAngles.z;
        public Vector2 CarrierVisualScreenCenter(int id) => RectTransformUtility.WorldToScreenPoint(null, carriers[id].Root.TransformPoint(Vector3.zero));
        public string EnemySpriteName(int id) => enemies.TryGetValue(id, out var v) && v.Body.sprite ? v.Body.sprite.name : "";
        public int OpenMissileId => focusedMissile;
        public int VisibleMissilePopupCount => missiles.Values.Count(v => v.Root.gameObject.activeSelf);
        public int BlastEffects { get; private set; }
        public bool PointerOverMissile => missiles.Values.Any(v => ContainsPointer(v.Marker) || (v.Root.gameObject.activeSelf && ContainsPointer(v.Root)));
        public bool IsMissileFlashing(int id) => missiles.TryGetValue(id, out var visual) && visual.Flash > 0;
        public Vector2 MissilePopupChoiceScreenPoint(int id, int choice) => RectTransformUtility.WorldToScreenPoint(null, missiles[id].Buttons[choice].transform.TransformPoint(new Vector3(78, -17)));
        public void SetEnvironment(FlightEnvironment environment) => terrain.Snap(environment);

        public FlightBoardView(Transform parent, FlightGame game)
        {
            this.game = game;
            field = UiKit.Box("Wide flight field", parent, 40, 103, Width, Height, UiKit.Hex("102C34")).rectTransform;
            fieldOrigin = field.anchoredPosition;
            field.gameObject.AddComponent<RectMask2D>();
            terrain = new ScrollingTerrain(field, Width, Height);
            damageFrame = CreateDamageFrame();
            player = UiKit.Rect("Pilot aircraft", field, Width * .5f - 32, Height * ContinuousFlight.PlayerY - 32, 64, 64);
            playerShadow = UiKit.Sprite("Player shadow", player, ShadowOffset.x, -ShadowOffset.y, 64, 64, "fighter_shadow");
            playerBody = UiKit.Sprite("Player", player, 0, 0, 64, 64, "fighter_level");
            UiKit.Label("01", player, -10, 62, 84, 18, 11, UiKit.Mint, true, TextAnchor.MiddleCenter);
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
            foreach (var e in carriers.Values) Object.Destroy(e.Root.gameObject);
            foreach (var e in missiles.Values) { Object.Destroy(e.Root.gameObject); Object.Destroy(e.Marker.gameObject); }
            foreach (var e in supplies.Values) Object.Destroy(e.gameObject);
            foreach (var e in effects) Object.Destroy(e.Rect.gameObject);
            enemies.Clear(); carriers.Clear(); missiles.Clear(); supplies.Clear(); effects.Clear();
            focusedMissile = 0; BlastEffects = 0; hoverGrace = 0; wakeTimer = 0; previousX = .5f; trailTimer = 0; animationTime = 0;
            bank = 0; bankHold = 0; shake = 0; field.anchoredPosition = fieldOrigin;
            playerBody.color = Color.white; playerBody.sprite = PixelSprites.Get("fighter_level");
        }

        public void Animate(float delta, ContinuousFlight flight, FlightEnvironment menuEnvironment)
        {
            terrain.Animate(delta, flight?.Environment ?? menuEnvironment, flight == null ? .2f : GameRules.SpeedMultiplier(flight.Progress.ActiveSeconds));
            animationTime += delta; trailTimer += delta;
            if (flight != null)
            {
                player.gameObject.SetActive(flight.Progress.Health > 0);
                // Bank into horizontal moves; a short hold avoids flicker between frames.
                float velocity = (flight.PlayerX - previousX) / Mathf.Max(.001f, delta); previousX = flight.PlayerX;
                if (Mathf.Abs(velocity) > .08f) { bank = velocity < 0 ? -1 : 1; bankHold = .12f; }
                else if ((bankHold -= delta) <= 0) bank = 0;
                Place(player, flight.PlayerX, ContinuousFlight.PlayerY, 32, 32);
                playerBody.color = flight.ImpactGraceRemaining > 0 && (int)(flight.Progress.ActiveSeconds * 12) % 2 == 0
                    ? new Color(1, 1, 1, .3f) : Color.white;
                SyncEnemies(flight); SyncCarriers(flight, delta); SyncMissiles(flight, delta); SyncSupplies(flight);
                player.SetAsLastSibling();
                if (focusedMissile != 0 && missiles.TryGetValue(focusedMissile, out var popup)) popup.Root.SetAsLastSibling();
            }
            else bank = 0;
            playerBody.sprite = PixelSprites.At(bank < 0 ? "fighter_bank_left" : bank > 0 ? "fighter_bank_right" : "fighter_level", animationTime);
            if (shake > 0)
            {
                shake = Mathf.Max(0, shake - delta);
                float strength = 7 * shake / .3f;
                field.anchoredPosition = fieldOrigin + new Vector2(Mathf.Round(Random.Range(-strength, strength)), Mathf.Round(Random.Range(-strength, strength)));
            }
            else field.anchoredPosition = fieldOrigin;
            for (int i = effects.Count - 1; i >= 0; i--)
            {
                var effect = effects[i];
                if (effect.Delay > 0)
                {
                    effect.Delay -= delta; effect.Image.enabled = effect.Delay <= 0;
                    if (effect.Delay > 0) continue;
                }
                effect.Remaining -= delta; effect.Age += delta;
                if (effect.Remaining <= 0) { Object.Destroy(effect.Rect.gameObject); effects.RemoveAt(i); continue; }
                effect.Rect.anchoredPosition += effect.Velocity * delta;
                if (effect.Anim != null) effect.Image.sprite = PixelSprites.At(effect.Anim, effect.Age);
                if (effect.Fade) { var color = effect.Image.color; color.a = Mathf.Clamp01(effect.Remaining / effect.Lifetime * 1.6f); effect.Image.color = color; }
            }
        }

        private static void Place(RectTransform rect, float x, float y, float ox = 0, float oy = 0)
            => rect.anchoredPosition = new Vector2(x * Width - ox, -y * Height + oy);

        private static string Livery(FlightEnvironment environment) => "bomber_" + environment.ToString().ToLowerInvariant();

        private void SyncEnemies(ContinuousFlight flight)
        {
            foreach (int id in enemies.Keys.Where(id => !flight.Enemies.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(enemies[id].Root.gameObject); enemies.Remove(id); }
            foreach (var enemy in flight.Enemies)
            {
                if (!enemies.TryGetValue(enemy.Id, out var visual))
                {
                    var root = UiKit.Rect("Enemy " + enemy.Entry.word, field, 0, 0, 146, 88);
                    var shadow = UiKit.Sprite("Bomber shadow", root, 25 + ShadowOffset.x, -10 - ShadowOffset.y, 96, 80, "bomber_shadow");
                    var body = UiKit.Sprite("Bomber", root, 25, -10, 96, 80, Livery(enemy.Environment));
                    var shield = UiKit.Sprite("Ice shield", root, 17, -26, 112, 112, "fx_ice_shield");
                    foreach (var image in new[] { shadow, body, shield }) image.rectTransform.pivot = new Vector2(.5f, .5f);
                    shadow.rectTransform.anchoredPosition = new Vector2(73 + ShadowOffset.x, -30 + ShadowOffset.y);
                    body.rectTransform.anchoredPosition = shield.rectTransform.anchoredPosition = new Vector2(73, -30);
                    var plate = UiKit.Framed("English word", root, 0, 76, 146, 28, "ui_plate", 2);
                    UiKit.Fit(UiKit.Label(enemy.Entry.word, plate.transform, 4, -1, 138, 28, 19, UiKit.Cream, true, TextAnchor.MiddleCenter), 10, 19);
                    var threat = UiKit.Label("", root, -20, 104, 186, 16, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    var outline = threat.gameObject.AddComponent<Outline>(); outline.effectColor = new Color(.05f, .06f, .04f, .95f); outline.effectDistance = new Vector2(2, -2);
                    visual = new EnemyVisual { Root = root, Shield = shield, Body = body, Shadow = shadow, Plate = plate, Threat = threat, Phase = enemy.Id * .37f };
                    enemies.Add(enemy.Id, visual);
                }
                bool damaged = enemy.Environment == FlightEnvironment.Ice && enemy.Health == 1;
                visual.Body.sprite = PixelSprites.At(Livery(enemy.Environment) + (damaged ? "_damaged" : ""), animationTime + visual.Phase);
                visual.Shield.gameObject.SetActive(enemy.Health > 1);
                if (enemy.Health > 1) visual.Shield.sprite = PixelSprites.At("fx_ice_shield", animationTime + visual.Phase);
                float scale = Mathf.Clamp(Mathf.Sqrt(40f / Mathf.Max(40, flight.Enemies.Count)), .55f, 1);
                visual.Root.localScale = new Vector3(scale, scale, 1);
                Place(visual.Root, enemy.X, enemy.Y, 73 * scale, 30 * scale);
                visual.Threat.text = enemy.Charging ? (enemy.ChargeDelay > 0 ? "! CHUẨN BỊ LAO TỚI !" : "LAO TỚI / NÉ!") : enemy.RequiresPartOfSpeech ? "+ TỪ LOẠI" : enemy.Environment == FlightEnvironment.Ice ? "KHIÊN BĂNG" : "";
                visual.Body.color = enemy.Charging && animationTime % .3f < .15f ? UiKit.Coral : Color.white;
                float angle = enemy.Charging ? Vector2.SignedAngle(Vector2.up, new Vector2(enemy.VelocityX * Width, -enemy.VelocityY * Height)) : 180;
                visual.Body.rectTransform.localEulerAngles = visual.Shadow.rectTransform.localEulerAngles = new Vector3(0, 0, angle);
            }
        }

        private void SyncCarriers(ContinuousFlight flight, float delta)
        {
            wakeTimer += delta; bool wake = wakeTimer >= .35f; if (wake) wakeTimer = 0;
            foreach (int id in carriers.Keys.Where(id => !flight.Carriers.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(carriers[id].Root.gameObject); carriers.Remove(id); }
            foreach (var carrier in flight.Carriers)
            {
                if (!carriers.TryGetValue(carrier.Id, out var visual))
                {
                    var rect = UiKit.Rect("Carrier", field, 0, 0, 64, 224);
                    rect.pivot = new Vector2(.5f, .5f);
                    visual = new CarrierVisual
                    {
                        Root = rect,
                        Bow = UiKit.Sprite("Bow wave", rect, 0, -2, 64, 48, "carrier_bow_wave"),
                        Stern = UiKit.Sprite("Stern wake", rect, 0, 206, 64, 40, "carrier_stern_wake"),
                        Body = UiKit.Sprite("Carrier hull", rect, 0, 0, 64, 224, "carrier")
                    };
                    carriers.Add(carrier.Id, visual); rect.SetSiblingIndex(1);
                }
                Place(visual.Root, carrier.X, carrier.Y);
                visual.Root.localEulerAngles = new Vector3(0, 0, 180 + carrier.HeadingDegrees);
                bool moving = Mathf.Abs(carrier.VelocityX) + Mathf.Abs(carrier.VelocityY) > .002f;
                visual.Body.sprite = PixelSprites.At("carrier", animationTime + carrier.Id);
                visual.Bow.gameObject.SetActive(moving); visual.Stern.gameObject.SetActive(moving);
                if (moving) { visual.Bow.sprite = PixelSprites.At("carrier_bow_wave", animationTime); visual.Stern.sprite = PixelSprites.At("carrier_stern_wake", animationTime); }
                if (wake && moving)
                {
                    float angle = carrier.HeadingDegrees * Mathf.Deg2Rad;
                    terrain.Wake(carrier.X - Mathf.Sin(angle) * 110 / Width, carrier.Y - Mathf.Cos(angle) * 110 / Height);
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
                    var marker = UiKit.Rect("Missile compact " + missile.Id, field, 0, 0, 188, 132);
                    var body = UiKit.Sprite("Rocket", marker, 82, 7, 24, 72, "rocket");
                    body.rectTransform.pivot = new Vector2(.5f, .5f); body.rectTransform.anchoredPosition = new Vector2(94, -43);
                    var plate = UiKit.Framed("Vietnamese on missile", marker, 2, 78, 184, 46, "ui_plate", 2);
                    UiKit.Fit(UiKit.Label(missile.Answer.meaning, plate.transform, 6, 0, 172, 46, 17, UiKit.Orange, true, TextAnchor.MiddleCenter), 10, 17);
                    var feedback = UiKit.Box("Wrong answer red edges", marker, -3, -7, 194, 113, Color.clear);
                    feedback.sprite = damageFrame; feedback.type = Image.Type.Sliced;

                    var popup = UiKit.Framed("Missile hover choices " + missile.Id, field, 0, 0, 342, 147, "ui_panel", 2).rectTransform;
                    popup.GetComponent<Image>().raycastTarget = true;
                    UiKit.Icon("icon_target", popup, 12, 9, 18);
                    UiKit.Label("CHỌN TỪ TIẾNG ANH", popup, 36, 5, 296, 25, 12, UiKit.Muted, true);
                    var buttons = new Button[4];
                    for (int i = 0; i < 4; i++)
                    {
                        int choice = i, id = missile.Id;
                        buttons[i] = UiKit.Button(missile.Choices[i].word, popup, 9 + (i % 2) * 167, 34 + (i / 2) * 39, 157, 34, "olive", UiKit.Cream, () => game.AnswerMissile(id, choice));
                        UiKit.Fit(buttons[i].GetComponentInChildren<Text>(), 10, 16);
                    }
                    var status = UiKit.Label("", popup, 10, 115, 322, 24, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    popup.gameObject.SetActive(false);
                    visual = new MissileVisual { Root = popup, Marker = marker, Body = body, Feedback = feedback, Status = status, Buttons = buttons };
                    missiles.Add(missile.Id, visual);
                }
                visual.Age += delta;
                Place(visual.Marker, missile.X, missile.Y, 94, 43);
                visual.Flash = Mathf.Max(0, visual.Flash - delta);
                float flash = visual.Flash / .36f;
                float shakeX = Mathf.Sin(visual.Flash * 90) * 5 * flash;
                visual.Body.sprite = PixelSprites.At(missile.Failed ? "rocket_hot" : "rocket", visual.Age);
                visual.Body.rectTransform.anchoredPosition = new Vector2(94 + shakeX, -43);
                visual.Body.rectTransform.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height)));
                visual.Body.color = flash > 0 ? Color.Lerp(Color.white, UiKit.Coral, flash * .6f) : Color.white;
                visual.Feedback.color = new Color(1, .12f, .08f, .85f * flash);
                visual.Status.text = (flight.Driving ? "TAB: sang BẮN để chọn · " : "") + "SAI " + missile.WrongAttempts + "/3";
                foreach (var button in visual.Buttons) button.interactable = !flight.Driving && !missile.Failed;
                if (trailTimer >= .09f)
                {
                    var velocity = new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height).normalized;
                    AddEffect("fx_smoke", missile.X * Width - velocity.x * 40 - 8, missile.Y * Height + velocity.y * 40 - 8, 16, 16, -velocity * 18);
                }
                visual.Marker.SetAsLastSibling();
            }

            if (trailTimer >= .09f) trailTimer = 0;
            bool overOpen = focusedMissile != 0 && missiles.TryGetValue(focusedMissile, out var open) &&
                (ContainsPointer(open.Marker) || (open.Root.gameObject.activeSelf && ContainsPointer(open.Root)));
            if (overOpen) hoverGrace = .16f;
            else
            {
                var hovered = flight.Missiles.LastOrDefault(m => !m.Failed && ContainsPointer(missiles[m.Id].Marker));
                if (hovered != null)
                {
                    focusedMissile = hovered.Id; hoverGrace = .16f;
                    // Freeze the popup where it opens while the actual projectile keeps flying.
                    float x = Mathf.Clamp(hovered.X * Width - 171, 8, Width - 350);
                    float y = hovered.Y * Height + 92;
                    if (y + 147 > Height - 8) y = hovered.Y * Height - 179;
                    missiles[focusedMissile].Root.anchoredPosition = new Vector2(x, -Mathf.Clamp(y, 8, Height - 155));
                }
                else { hoverGrace -= delta; if (hoverGrace <= 0) focusedMissile = 0; }
            }
            foreach (var pair in missiles)
            {
                pair.Value.Root.gameObject.SetActive(pair.Key == focusedMissile);
                if (pair.Key == focusedMissile) pair.Value.Root.SetAsLastSibling();
            }
        }

        private static Sprite CreateDamageFrame()
        {
            // Stepped (not smooth) falloff keeps the warning frame pixel-styled.
            var texture = new Texture2D(32, 32, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            for (int y = 0; y < 32; y++) for (int x = 0; x < 32; x++)
            {
                int edge = Mathf.Min(Mathf.Min(x, 31 - x), Mathf.Min(y, 31 - y));
                texture.SetPixel(x, y, new Color(1, 1, 1, edge == 0 ? 1 : edge == 1 ? .7f : edge <= 3 && (x + y) % 2 == 0 ? .45f : 0));
            }
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, 32, 32), new Vector2(.5f, .5f), 100, 0, SpriteMeshType.FullRect, new Vector4(6, 6, 6, 6));
        }

        private void SyncSupplies(ContinuousFlight flight)
        {
            foreach (int id in supplies.Keys.Where(id => !flight.Supplies.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(supplies[id].gameObject); supplies.Remove(id); }
            foreach (var supply in flight.Supplies)
            {
                string sprite = supply.Kind == SupplyKind.Roll ? "supply_roll" : supply.Kind == SupplyKind.Fuel ? "supply_fuel" : "supply_metal";
                if (!supplies.TryGetValue(supply.Id, out var image))
                {
                    image = UiKit.Sprite("Supply " + supply.Kind, field, 0, 0, 36, 36, sprite);
                    image.rectTransform.pivot = new Vector2(.5f, .5f);
                    supplies.Add(supply.Id, image);
                }
                image.sprite = PixelSprites.At(sprite, supply.Age);
                Place(image.rectTransform, supply.X, supply.Y);
                image.rectTransform.localEulerAngles = new Vector3(0, 0, Mathf.Round(Mathf.Sin(animationTime * 3 + supply.Id) * 2) * 3);
                image.rectTransform.SetAsLastSibling();
            }
        }

        private Effect AddEffect(string anim, float x, float y, float w, float h, Vector2 velocity = default, float rotation = 0, float delay = 0, float lifetime = 0, bool fade = false)
        {
            var image = UiKit.Sprite(anim, field, x, y, w, h, anim);
            image.preserveAspect = false;
            image.enabled = delay <= 0;
            var rect = image.rectTransform;
            if (rotation != 0) { rect.pivot = new Vector2(.5f, .5f); rect.anchoredPosition += new Vector2(w * .5f, -h * .5f); rect.localEulerAngles = new Vector3(0, 0, rotation); }
            float life = lifetime > 0 ? lifetime : PixelSprites.Duration(anim);
            var effect = new Effect { Rect = rect, Image = image, Anim = PixelSprites.FrameCount(anim) > 1 ? anim : null, Remaining = life, Lifetime = life, Delay = delay, Velocity = velocity, Fade = fade };
            effects.Add(effect);
            return effect;
        }

        private void Explode(float x, float y, float scale, float delay = 0)
        {
            float size = 32 * scale;
            AddEffect("fx_explosion", x * Width - size * .5f, y * Height - size * .5f, size, size, delay: delay);
            for (int i = 0; i < 4; i++)
            {
                float angle = (i * 90 + 45 + Random.Range(-20, 20)) * Mathf.Deg2Rad;
                AddEffect("fx_spark", x * Width - 12, y * Height - 12, 24, 24, new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * 90 * scale, delay: delay);
            }
        }

        // WWII fighters fire wing-mounted machine guns: tracers travel to the target, then it bursts.
        public void Hit(float x, float y, bool killed, float playerX)
        {
            const float travel = .14f;
            Vector2 target = new Vector2(x * Width, y * Height);
            for (int gun = -1; gun <= 1; gun += 2)
            {
                Vector2 start = new Vector2(playerX * Width + gun * 16, ContinuousFlight.PlayerY * Height - 10);
                Vector2 path = target - start;
                float angle = Vector2.SignedAngle(Vector2.up, new Vector2(path.x, -path.y));
                for (int round = 0; round < 3; round++)
                    AddEffect("tracer", start.x - 4, start.y - 12, 8, 24, new Vector2(path.x, -path.y) / travel, angle, round * .045f + (gun > 0 ? .02f : 0), travel);
            }
            AddEffect("muzzle_flash", playerX * Width - 16, ContinuousFlight.PlayerY * Height - 48, 32, 32);
            if (killed) Explode(x, y, 3, travel); else AddEffect("fx_spark", target.x - 18, target.y - 18, 36, 36, delay: travel);
        }

        public void Burst(float x, float y, Color color, int count = 14) => Explode(x, y, count >= 20 ? 3 : 2);

        public void Impact(float x, float y) { Explode(x, y, 2.5f); shake = .3f; }

        public void Blast(float x, float y)
        {
            BlastEffects++;
            float diameter = ContinuousFlight.BlastRadius * Width * 2;
            AddEffect("fx_shockwave", x * Width - diameter * .5f, y * Height - diameter * .5f, diameter, diameter);
            Explode(x, y, 3.5f);
            shake = Mathf.Max(shake, .15f);
        }
    }
}

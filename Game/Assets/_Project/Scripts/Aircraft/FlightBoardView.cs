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
        private const int GunDeployFrames = 9;
        private const float ChoiceWidth = 156, ChoiceHeight = 40, ChoiceOpenSeconds = .42f;
        private static readonly Vector2 ShadowOffset = new Vector2(9, -13);
        private sealed class EnemyVisual
        {
            public RectTransform Root; public Image Shield, Body, Shadow, Guns, LockFill; public Text Threat; public CanvasGroup Labels;
            public float Phase, FireTime = -1, Angle = 180;
        }
        private sealed class CarrierVisual { public RectTransform Root; public Image Body, Bow, Stern; }
        private sealed class MissileVisual
        {
            public RectTransform Marker;
            public CanvasGroup PlateGroup;
            public Text Status;
            public Button[] Buttons;
            public float[] Shake = new float[4];
            public bool[] Wrong = new bool[4];
            public Image Body, Feedback;
            public float Flash, Age, Open, SmokeTimer;
        }
        private sealed class Effect
        {
            public RectTransform Rect; public Image Image; public string Anim;
            public float Remaining, Lifetime, Delay, Age; public Vector2 Velocity; public bool Fade;
        }
        private readonly RectTransform field, player;
        private readonly Image playerBody, playerShadow, reticle;
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
        private readonly Dictionary<int, Image> shots = new Dictionary<int, Image>();
        private readonly List<Effect> effects = new List<Effect>();
        private int focusedMissile, hoveredMissile;
        private float hoverGrace;
        private float wakeTimer;
        // 0 = in position; 1 = below the bottom edge (battle intro climbs from here).
        public float IntroLift { get; set; }
        public float Focus { get => terrain.Focus; set => terrain.Focus = value; }
        public string PlayerSpriteName => playerBody.sprite ? playerBody.sprite.name : "";
        public Vector2 PlayerAnchoredPosition => player.anchoredPosition;
        public int AnimatedEffects => effects.Count(e => e.Anim != null);
        public float OceanAnimationSeconds => terrain.OceanAnimationSeconds;
        public int OceanImageIndex => terrain.OceanImageIndex;
        public string GroundSpriteName => terrain.GroundSpriteName;
        public float GroundSharpAlpha => terrain.SharpAlpha;
        public Wildlife Wildlife => terrain.Wildlife;
        public float CarrierVisualAngle(int id) => carriers[id].Root.localEulerAngles.z;
        public Vector2 CarrierVisualScreenCenter(int id) => RectTransformUtility.WorldToScreenPoint(null, carriers[id].Root.TransformPoint(Vector3.zero));
        public string EnemySpriteName(int id) => enemies.TryGetValue(id, out var v) && v.Body.sprite ? v.Body.sprite.name : "";
        public bool EnemyGunsVisible(int id) => enemies.TryGetValue(id, out var v) && v.Guns.enabled;
        public string ReticleSpriteName => reticle.enabled && reticle.sprite ? reticle.sprite.name : "";
        public int VisibleShots => shots.Count;
        public string MissileSpriteName(int id) => missiles.TryGetValue(id, out var v) && v.Body.sprite ? v.Body.sprite.name : "";
        public int OpenMissileId => focusedMissile;
        public int VisibleMissilePopupCount => missiles.Values.Count(v => v.Open > .01f);
        public bool MissileChoicesFullyOpen(int id) => missiles.TryGetValue(id, out var v) && v.Open >= 1;
        public float MissileChoiceScale(int id, int choice) => missiles[id].Buttons[choice].transform.localScale.x;
        public Vector2 MissileChoiceAnchored(int id, int choice) => ((RectTransform)missiles[id].Buttons[choice].transform).anchoredPosition;
        public int BlastEffects { get; private set; }
        public bool PointerOverMissile => missiles.Values.Any(v => ContainsPointer(v.Marker) || v.Buttons.Any(b => b.gameObject.activeSelf && ContainsPointer((RectTransform)b.transform)));
        public bool IsMissileFlashing(int id) => missiles.TryGetValue(id, out var visual) && visual.Flash > 0;
        public Vector2 MissilePopupChoiceScreenPoint(int id, int choice) => RectTransformUtility.WorldToScreenPoint(null, missiles[id].Buttons[choice].transform.position);
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
            reticle = UiKit.Sprite("Lock-on sight", field, 0, 0, 80, 80, "fx_lock_reticle");
            reticle.rectTransform.pivot = new Vector2(.5f, .5f); reticle.enabled = false;
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
            foreach (var e in missiles.Values) DestroyMissile(e);
            foreach (var e in supplies.Values) Object.Destroy(e.gameObject);
            foreach (var e in shots.Values) Object.Destroy(e.gameObject);
            foreach (var e in effects) Object.Destroy(e.Rect.gameObject);
            enemies.Clear(); carriers.Clear(); missiles.Clear(); supplies.Clear(); shots.Clear(); effects.Clear();
            focusedMissile = hoveredMissile = 0; BlastEffects = 0; hoverGrace = 0; wakeTimer = 0; previousX = .5f; trailTimer = 0; animationTime = 0;
            bank = 0; bankHold = 0; shake = 0; field.anchoredPosition = fieldOrigin; reticle.enabled = false; IntroLift = 0;
            playerBody.color = Color.white; playerBody.sprite = PixelSprites.Get("fighter_level");
        }

        private static void DestroyMissile(MissileVisual v)
        {
            Object.Destroy(v.Marker.gameObject); Object.Destroy(v.Status.gameObject);
            foreach (var b in v.Buttons) Object.Destroy(b.gameObject);
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
                float lift = IntroLift * IntroLift * (3 - 2 * IntroLift);
                Place(player, flight.PlayerX, ContinuousFlight.PlayerY + lift * .32f, 32, 32);
                playerBody.color = flight.ImpactGraceRemaining > 0 && (int)(flight.Progress.ActiveSeconds * 12) % 2 == 0
                    ? new Color(1, 1, 1, .3f) : Color.white;
                SyncEnemies(flight); SyncCarriers(flight, delta); SyncMissiles(flight, delta); SyncSupplies(flight); SyncShots(flight);
                player.SetAsLastSibling();
                SyncReticle(flight);
                if (focusedMissile != 0 && missiles.TryGetValue(focusedMissile, out var popup)) { popup.Status.transform.SetAsLastSibling(); foreach (var b in popup.Buttons) b.transform.SetAsLastSibling(); }
            }
            else { bank = 0; reticle.enabled = false; }
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

        // Lock-on sight over the player: brackets close in with the most advanced lock, then blink red.
        private void SyncReticle(ContinuousFlight flight)
        {
            float progress = -1;
            foreach (var e in flight.Enemies) if (e.Phase == EnemyPhase.Locking) progress = Mathf.Max(progress, e.LockProgress);
            foreach (var m in flight.Missiles)
                if (m.Phase == MissilePhase.Locking) progress = Mathf.Max(progress, m.PhaseSeconds / (m.Failed ? ContinuousFlight.MissileFailedLockSeconds : ContinuousFlight.MissileLockSeconds));
                else if (m.Phase == MissilePhase.Boost) progress = 1;
            if (flight.Shots.Count > 0) progress = 1;
            reticle.enabled = progress >= 0 && player.gameObject.activeSelf;
            if (!reticle.enabled) return;
            int frame = progress < .8f ? Mathf.Min(5, Mathf.FloorToInt(progress / .8f * 6)) : 6 + (int)(animationTime * 8) % 2;
            reticle.sprite = PixelSprites.Get("fx_lock_reticle", frame);
            reticle.rectTransform.anchoredPosition = player.anchoredPosition + new Vector2(32, -32);
            reticle.transform.SetAsLastSibling();
        }

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
                    var guns = UiKit.Sprite("Wing guns", body.transform, 0, 0, 96, 80, "bomber_guns");
                    guns.enabled = false;
                    var shield = UiKit.Sprite("Ice shield", root, 17, -26, 112, 112, "fx_ice_shield");
                    foreach (var image in new[] { shadow, body, shield }) image.rectTransform.pivot = new Vector2(.5f, .5f);
                    shadow.rectTransform.anchoredPosition = new Vector2(73 + ShadowOffset.x, -30 + ShadowOffset.y);
                    body.rectTransform.anchoredPosition = shield.rectTransform.anchoredPosition = new Vector2(73, -30);
                    var labels = UiKit.Rect("Labels", root, 0, 0, 146, 88);
                    var group = labels.gameObject.AddComponent<CanvasGroup>(); group.blocksRaycasts = false;
                    var plate = UiKit.Framed("English word", labels, 0, 76, 146, 28, "ui_plate", 2);
                    UiKit.Fit(UiKit.Label(enemy.Entry.word, plate.transform, 4, -1, 138, 28, 19, UiKit.Cream, true, TextAnchor.MiddleCenter), 10, 19);
                    UiKit.Box("Lock track", labels, 13, 106, 120, 6, UiKit.Hex("1A1612"));
                    var fill = UiKit.Box("Lock progress", labels, 14, 107, 0, 4, UiKit.Coral);
                    var threat = UiKit.Label("", labels, -20, 112, 186, 16, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    var outline = threat.gameObject.AddComponent<Outline>(); outline.effectColor = new Color(.05f, .06f, .04f, .95f); outline.effectDistance = new Vector2(2, -2);
                    visual = new EnemyVisual { Root = root, Shield = shield, Body = body, Shadow = shadow, Guns = guns, LockFill = fill, Labels = group, Threat = threat, Phase = enemy.Id * .37f };
                    enemies.Add(enemy.Id, visual);
                }
                bool damaged = enemy.Environment == FlightEnvironment.Ice && enemy.Health == 1;
                string sprite = enemy.Departing ? Livery(enemy.Environment) + (enemy.DepartDirection < 0 ? "_bank_left" : "_bank_right") : Livery(enemy.Environment) + (damaged ? "_damaged" : "");
                visual.Body.sprite = PixelSprites.At(sprite, animationTime + visual.Phase);
                visual.Shield.gameObject.SetActive(enemy.Health > 1 && !enemy.Departing);
                if (enemy.Health > 1) visual.Shield.sprite = PixelSprites.At("fx_ice_shield", animationTime + visual.Phase);
                float scale = Mathf.Clamp(Mathf.Sqrt(40f / Mathf.Max(40, flight.Enemies.Count)), .55f, 1);
                visual.Root.localScale = new Vector3(scale, scale, 1);
                Place(visual.Root, enemy.X, enemy.Y, 73 * scale, 30 * scale);
                // Hatches open and the barrels creep out over the whole lock-on (fully out exactly when it fires),
                // then the muzzles flash while the burst leaves and the bomber breaks away.
                if (enemy.Phase == EnemyPhase.Locking)
                {
                    visual.Guns.enabled = true;
                    visual.Guns.sprite = PixelSprites.Get("bomber_guns", Mathf.Clamp(Mathf.FloorToInt(enemy.LockProgress * GunDeployFrames), 0, GunDeployFrames - 1));
                }
                else if (enemy.Departing && enemy.DepartSeconds < .32f) { visual.Guns.enabled = true; visual.Guns.sprite = PixelSprites.Get("bomber_guns", GunDeployFrames + (int)(animationTime * 24) % 2); }
                else visual.Guns.enabled = false;
                visual.Labels.alpha = enemy.Departing ? Mathf.Max(0, 1 - enemy.DepartSeconds * 4) : 1;
                visual.LockFill.rectTransform.sizeDelta = new Vector2(Mathf.Round(118 * enemy.LockProgress / 2) * 2, 4);
                visual.LockFill.enabled = enemy.Phase == EnemyPhase.Locking;
                visual.Threat.text = enemy.Phase == EnemyPhase.Locking ? "KHÓA MỤC TIÊU " + Mathf.Max(0, enemy.LockRemaining).ToString("0.0") + "s"
                    : enemy.Departing ? "" : enemy.RequiresPartOfSpeech ? "+ TỪ LOẠI" : enemy.Environment == FlightEnvironment.Ice ? "KHIÊN BĂNG" : "";
                bool warn = enemy.Phase == EnemyPhase.Locking && enemy.LockRemaining < 1.5f && animationTime % .24f < .12f;
                visual.Body.color = warn ? Color.Lerp(Color.white, UiKit.Coral, .75f) : Color.white;
                float target = 180;
                if (enemy.Phase == EnemyPhase.Locking)
                    target = Vector2.SignedAngle(Vector2.up, new Vector2((flight.PlayerX - enemy.X) * Width, -(ContinuousFlight.PlayerY - enemy.Y) * Height));
                else if (enemy.Departing) target = Vector2.SignedAngle(Vector2.up, new Vector2(enemy.VelocityX * Width, -enemy.VelocityY * Height));
                visual.Angle = Mathf.MoveTowardsAngle(visual.Angle, target, 240 * Time.unscaledDeltaTime);
                visual.Body.rectTransform.localEulerAngles = visual.Shadow.rectTransform.localEulerAngles = new Vector3(0, 0, visual.Angle);
                if (enemy.Departing) visual.Root.SetAsLastSibling();
            }
        }

        // Called on AircraftFire: muzzle flashes at both wing guns.
        public void EnemyFire(int id)
        {
            if (!enemies.TryGetValue(id, out var visual)) return;
            foreach (var gun in new[] { new Vector3(-13, 28), new Vector3(13, 28) })
            {
                var local = (Vector2)field.InverseTransformPoint(visual.Body.rectTransform.TransformPoint(gun));
                AddEffect("muzzle_flash", local.x - 16, -local.y - 16, 32, 32, rotation: visual.Angle + 180);
            }
        }

        private void SyncShots(ContinuousFlight flight)
        {
            foreach (int id in shots.Keys.Where(id => !flight.Shots.Any(s => s.Id == id && s.InFlight)).ToArray())
            { Object.Destroy(shots[id].gameObject); shots.Remove(id); }
            foreach (var shot in flight.Shots)
            {
                if (!shot.InFlight) continue;
                if (!shots.TryGetValue(shot.Id, out var image))
                {
                    image = UiKit.Sprite("Enemy tracer", field, 0, 0, 8, 30, "enemy_tracer");
                    image.preserveAspect = false; image.rectTransform.pivot = new Vector2(.5f, .5f);
                    shots.Add(shot.Id, image);
                }
                image.rectTransform.anchoredPosition = new Vector2(shot.X * Width, -shot.Y * Height);
                var direction = new Vector2(shot.VelocityX * Width, -shot.VelocityY * Height);
                if (direction.sqrMagnitude > .01f) image.rectTransform.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, direction));
                image.transform.SetAsLastSibling();
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
            return mouse != null && rect && RectTransformUtility.RectangleContainsScreenPoint(rect, mouse.position.ReadValue(), null);
        }

        public void FlashMissile(int id)
        {
            if (missiles.TryGetValue(id, out var visual)) visual.Flash = .36f;
        }

        public void MarkWrongChoice(int id, int choice)
        {
            if (!missiles.TryGetValue(id, out var visual) || choice < 0 || choice > 3) return;
            visual.Wrong[choice] = true; visual.Shake[choice] = .36f;
        }

        private static float EaseOutBack(float t) { const float c = 1.9f; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }

        private MissileVisual CreateMissile(MissileState missile)
        {
            var marker = UiKit.Rect("Missile " + missile.Id, field, 0, 0, 188, 142);
            var body = UiKit.Sprite("Rocket", marker, 82, 7, 24, 72, "rocket");
            body.rectTransform.pivot = new Vector2(.5f, .5f); body.rectTransform.anchoredPosition = new Vector2(94, -43);
            var plateRoot = UiKit.Rect("Meaning", marker, 0, 0, 188, 142);
            var plateGroup = plateRoot.gameObject.AddComponent<CanvasGroup>(); plateGroup.blocksRaycasts = false;
            var plate = UiKit.Framed("Vietnamese on missile", plateRoot, 2, 90, 184, 46, "ui_plate", 2);
            UiKit.Fit(UiKit.Label(missile.Answer.meaning, plate.transform, 6, 0, 172, 46, 17, UiKit.Orange, true, TextAnchor.MiddleCenter), 10, 17);
            var feedback = UiKit.Box("Wrong answer red edges", marker, -3, -7, 194, 150, Color.clear);
            feedback.sprite = damageFrame; feedback.type = Image.Type.Sliced;
            var buttons = new Button[4];
            for (int i = 0; i < 4; i++)
            {
                int choice = i, id = missile.Id;
                // Four separate tags; each pops out of the rocket body and grows to full size.
                var button = UiKit.Button(missile.Choices[i].word, field, 0, 0, ChoiceWidth, ChoiceHeight, "cream", UiKit.Ink, () => game.ChooseMissileAnswer(id, choice));
                var rect = (RectTransform)button.transform; rect.pivot = new Vector2(.5f, .5f);
                var word = button.GetComponentInChildren<Text>();
                word.rectTransform.anchoredPosition = new Vector2(38, 1); word.rectTransform.sizeDelta = new Vector2(ChoiceWidth - 44, ChoiceHeight);
                UiKit.Fit(word, 10, 17);
                var key = UiKit.Framed("Key", rect, 6, 7, 26, 26, "ui_keycap", 2);
                UiKit.Label((i + 1).ToString(), key.transform, 0, -2, 26, 26, 14, UiKit.Ink, true, TextAnchor.MiddleCenter);
                button.gameObject.SetActive(false);
                buttons[i] = button;
            }
            var status = UiKit.Label("", field, 0, 0, 300, 20, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
            status.rectTransform.pivot = new Vector2(.5f, .5f);
            var outline = status.gameObject.AddComponent<Outline>(); outline.effectColor = new Color(.05f, .06f, .04f, .95f); outline.effectDistance = new Vector2(2, -2);
            return new MissileVisual { Marker = marker, Body = body, PlateGroup = plateGroup, Feedback = feedback, Status = status, Buttons = buttons };
        }

        private void SyncMissiles(ContinuousFlight flight, float delta)
        {
            foreach (int id in missiles.Keys.Where(id => !flight.Missiles.Any(e => e.Id == id)).ToArray())
            { DestroyMissile(missiles[id]); missiles.Remove(id); }
            // Choose which rocket shows its four choices: the hovered one, else the closest answerable rocket.
            var hovered = flight.Missiles.LastOrDefault(m => m.Answerable && missiles.TryGetValue(m.Id, out var v) && ContainsPointer(v.Marker));
            if (hovered != null) { hoveredMissile = hovered.Id; hoverGrace = .6f; }
            else if ((hoverGrace -= delta) <= 0) hoveredMissile = 0;
            var focus = flight.Missiles.FirstOrDefault(m => m.Id == hoveredMissile && m.Answerable)
                ?? flight.Missiles.Where(m => m.Answerable).OrderByDescending(m => m.Y).FirstOrDefault();
            // Keep the open set while the pointer is on one of its tags.
            if (focusedMissile != 0 && missiles.TryGetValue(focusedMissile, out var open) && open.Buttons.Any(b => b.gameObject.activeSelf && ContainsPointer((RectTransform)b.transform))
                && flight.Missiles.Any(m => m.Id == focusedMissile && m.Answerable)) focus = flight.Missiles.First(m => m.Id == focusedMissile);
            focusedMissile = focus?.Id ?? 0;
            foreach (var missile in flight.Missiles)
            {
                if (!missiles.TryGetValue(missile.Id, out var visual)) { visual = CreateMissile(missile); missiles.Add(missile.Id, visual); }
                visual.Age += delta;
                Place(visual.Marker, missile.X, missile.Y, 94, 43);
                visual.Flash = Mathf.Max(0, visual.Flash - delta);
                float flash = visual.Flash / .36f;
                float shakeX = Mathf.Sin(visual.Flash * 90) * 5 * flash;
                if (missile.Phase == MissilePhase.Locking) shakeX += Mathf.Round(Mathf.Sin(animationTime * 70) * 2);
                bool boost = missile.Phase == MissilePhase.Boost;
                visual.Body.sprite = PixelSprites.At(boost ? "rocket_boost" : missile.Phase == MissilePhase.Locking || missile.Failed ? "rocket_hot" : "rocket", visual.Age);
                visual.Body.rectTransform.sizeDelta = boost ? new Vector2(32, 112) : new Vector2(24, 72);
                visual.Body.rectTransform.pivot = boost ? new Vector2(.5f, 1 - 18f / 56) : new Vector2(.5f, .5f);
                visual.Body.rectTransform.anchoredPosition = new Vector2(94 + shakeX, -43);
                visual.Body.rectTransform.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height)));
                visual.Body.color = flash > 0 ? Color.Lerp(Color.white, UiKit.Coral, flash * .6f) : Color.white;
                visual.Feedback.color = new Color(1, .12f, .08f, .85f * flash);
                visual.PlateGroup.alpha = boost ? Mathf.Max(0, visual.PlateGroup.alpha - delta * 5) : 1;
                visual.SmokeTimer += delta;
                if (visual.SmokeTimer >= (boost ? .03f : .09f))
                {
                    visual.SmokeTimer = 0;
                    var velocity = new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height).normalized;
                    float back = boost ? 70 : 40, size = boost ? 22 : 16;
                    AddEffect("fx_smoke", missile.X * Width - velocity.x * back - size * .5f, missile.Y * Height + velocity.y * back - size * .5f, size, size, -velocity * 18);
                }
                visual.Marker.SetAsLastSibling();
                AnimateChoices(flight, missile, visual, delta);
            }
        }

        private void AnimateChoices(ContinuousFlight flight, MissileState missile, MissileVisual visual, float delta)
        {
            bool show = missile.Id == focusedMissile && missile.Answerable;
            visual.Open = Mathf.Clamp01(visual.Open + (show ? 1 : -1.6f) * delta / ChoiceOpenSeconds);
            var centre = new Vector2(missile.X * Width, missile.Y * Height);
            float cy = Mathf.Clamp(centre.y, 54, Height - 54);
            float[] columns = centre.x < 190 ? new[] { 100f, 262f } : centre.x > Width - 190 ? new[] { -262f, -100f } : new[] { -102f, 102f };
            for (int i = 0; i < 4; i++)
            {
                var button = visual.Buttons[i]; var rect = (RectTransform)button.transform;
                float local = Mathf.Clamp01((visual.Open - i * .08f) / .68f);
                bool active = local > .01f;
                if (button.gameObject.activeSelf != active) button.gameObject.SetActive(active);
                if (!active) continue;
                float eased = EaseOutBack(local);
                var slot = new Vector2(Mathf.Clamp(centre.x + columns[i % 2], ChoiceWidth * .5f + 4, Width - ChoiceWidth * .5f - 4), cy + (i < 2 ? -24 : 24));
                visual.Shake[i] = Mathf.Max(0, visual.Shake[i] - delta);
                var position = Vector2.LerpUnclamped(centre, slot, eased) + new Vector2(Mathf.Sin(visual.Shake[i] * 80) * 6 * visual.Shake[i] / .36f, 0);
                rect.anchoredPosition = new Vector2(Mathf.Round(position.x), -Mathf.Round(position.y));
                float scale = Mathf.Lerp(.12f, 1, Mathf.Clamp01(eased));
                rect.localScale = new Vector3(scale, scale, 1);
                button.interactable = missile.Answerable && !visual.Wrong[i];
                ((Image)button.targetGraphic).color = visual.Wrong[i] ? new Color(1, .55f, .5f, .75f) : Color.white;
            }
            visual.Status.gameObject.SetActive(visual.Open > .5f || missile.WrongAttempts > 0 || missile.Phase != MissilePhase.Cruise);
            visual.Status.rectTransform.anchoredPosition = new Vector2(Mathf.Clamp(centre.x, 150, Width - 150), -Mathf.Clamp(centre.y + (missile.Phase == MissilePhase.Boost ? -60 : 106), 12, Height - 12));
            visual.Status.text = missile.Phase == MissilePhase.Boost ? "TĂNG TỐC!" : missile.Phase == MissilePhase.Locking ? (missile.Failed ? "KHÓA MỤC TIÊU!" : "KHÓA MỤC TIÊU! CHỌN NGAY · SAI " + missile.WrongAttempts + "/3")
                : (flight.Driving ? "PHÍM 1-4 / BẤM Ô · " : "PHÍM 1-4 · ") + "SAI " + missile.WrongAttempts + "/3";
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

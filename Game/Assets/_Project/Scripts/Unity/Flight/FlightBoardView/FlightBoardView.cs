using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Renders ContinuousFlight state with frame-by-frame pixel sprites (Tools/PixelForge).
    // Units are drawn at an integer 2x art scale; everything faces north and is rotated here.
    public sealed partial class FlightBoardView
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
    }
}

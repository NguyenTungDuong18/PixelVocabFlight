using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed class FlightBoardView
    {
        public const float Width = 1360, Height = 548;
        private sealed class EnemyVisual { public RectTransform Root; public Image Shield; }
        private sealed class MissileVisual { public RectTransform Root; public Text Status; public Button[] Buttons; public RectTransform Marker; }
        private sealed class Effect { public RectTransform Rect; public float Remaining, Lifetime; public Vector2 Velocity; }
        private readonly RectTransform field, player;
        private readonly Image flame;
        private readonly Sprite friendly, ring;
        private readonly FlightGame game;
        private readonly ScrollingTerrain terrain;
        private readonly Dictionary<int, EnemyVisual> enemies = new Dictionary<int, EnemyVisual>();
        private readonly Dictionary<int, RectTransform> carriers = new Dictionary<int, RectTransform>();
        private readonly Dictionary<int, MissileVisual> missiles = new Dictionary<int, MissileVisual>();
        private readonly Dictionary<int, RectTransform> supplies = new Dictionary<int, RectTransform>();
        private readonly List<Effect> effects = new List<Effect>();
        private int focusedMissile;
        public void SetEnvironment(FlightEnvironment environment) => terrain.Snap(environment);

        public FlightBoardView(Transform parent, FlightGame game)
        {
            this.game = game;
            field = UiKit.Box("Wide flight field", parent, 40, 103, Width, Height, UiKit.Hex("102C34")).rectTransform;
            field.gameObject.AddComponent<RectMask2D>();
            terrain = new ScrollingTerrain(field, Width, Height);
            friendly = PixelAircraft.Create(true);
            ring = CreateRing();
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
            enemies.Clear(); carriers.Clear(); missiles.Clear(); supplies.Clear(); effects.Clear(); focusedMissile = 0;
        }

        public void Animate(float delta, ContinuousFlight flight, FlightEnvironment menuEnvironment)
        {
            terrain.Animate(delta, flight?.Environment ?? menuEnvironment, flight == null ? .2f : GameRules.SpeedMultiplier(flight.Progress.ActiveSeconds));
            flame.rectTransform.sizeDelta = new Vector2(flight?.Progress.Powered == true ? 12 : 8, 19 + Mathf.Sin(Time.unscaledTime * 20) * 4);
            if (flight != null)
            {
                Place(player, flight.PlayerX, ContinuousFlight.PlayerY, 33, 30);
                SyncEnemies(flight); SyncCarriers(flight); SyncMissiles(flight); SyncSupplies(flight);
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
                    var shield = UiKit.Box("Ice shield", root, 35, -6, 76, 76, UiKit.Hex("A4DDE9")); shield.sprite = ring;
                    var body = UiKit.Box("Aircraft", root, 44, 1, 58, 58, Tint(enemy.Environment)); body.sprite = PixelAircraft.CreateEnemy(enemy.Environment);
                    body.rectTransform.pivot = new Vector2(.5f, .5f); body.rectTransform.anchoredPosition = new Vector2(73, -30);
                    body.rectTransform.localEulerAngles = new Vector3(0, 0, 180);
                    var plate = UiKit.Box("English word", root, 0, 43, 146, 26, UiKit.Ink);
                    var word = UiKit.Label(enemy.Entry.word, plate.transform, 4, 0, 138, 26, 19, UiKit.Cream, true, TextAnchor.MiddleCenter);
                    word.resizeTextForBestFit = true; word.resizeTextMinSize = 10; word.resizeTextMaxSize = 19;
                    UiKit.Label(enemy.RequiresPartOfSpeech ? "+ TỪ LOẠI" : enemy.Environment == FlightEnvironment.Ice ? "BĂNG" : "", root, 0, 69, 146, 15, 9, UiKit.Muted, true, TextAnchor.MiddleCenter);
                    visual = new EnemyVisual { Root = root, Shield = shield }; enemies.Add(enemy.Id, visual);
                }
                visual.Shield.gameObject.SetActive(enemy.Health > 1);
                float scale = Mathf.Clamp(Mathf.Sqrt(40f / Mathf.Max(40, flight.Enemies.Count)), .55f, 1);
                visual.Root.localScale = new Vector3(scale, scale, 1);
                Place(visual.Root, enemy.X, enemy.Y, 73 * scale, 0);
            }
        }

        private void SyncCarriers(ContinuousFlight flight)
        {
            foreach (int id in carriers.Keys.Where(id => !flight.Carriers.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(carriers[id].gameObject); carriers.Remove(id); }
            foreach (var carrier in flight.Carriers)
            {
                if (!carriers.TryGetValue(carrier.Id, out var rect))
                {
                    rect = UiKit.Rect("Carrier", field, 0, 0, 66, 150);
                    UiKit.Box("Hull", rect, 6, 0, 50, 143, UiKit.Hex("607A82"));
                    UiKit.Box("Deck", rect, 10, 8, 42, 127, UiKit.Hex("344D58"));
                    for (int i = 0; i < 7; i++) UiKit.Box("Runway", rect, 28, 12 + i * 17, 3, 9, UiKit.Cream);
                    UiKit.Box("Bridge", rect, 49, 40, 15, 32, UiKit.Muted);
                    UiKit.Label("CV", rect, 8, 109, 38, 20, 11, UiKit.Cream, true);
                    carriers.Add(carrier.Id, rect); rect.SetSiblingIndex(4);
                }
                Place(rect, carrier.X, carrier.Y, 33, 0);
            }
        }

        private void SyncMissiles(ContinuousFlight flight)
        {
            foreach (int id in missiles.Keys.Where(id => !flight.Missiles.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(missiles[id].Root.gameObject); Object.Destroy(missiles[id].Marker.gameObject); missiles.Remove(id); }
            if (!flight.Missiles.Any(m => m.Id == focusedMissile)) focusedMissile = flight.Missiles.FirstOrDefault()?.Id ?? 0;
            foreach (var missile in flight.Missiles)
            {
                if (!missiles.TryGetValue(missile.Id, out var visual))
                {
                    var root = UiKit.Rect("Missile quiz " + missile.Id, field, 0, 0, 302, 157);
                    UiKit.Box("Missile card", root, 0, 0, 302, 157, UiKit.Hex("172935"));
                    var clue = UiKit.Label(missile.Answer.meaning, root, 8, 1, 286, 42, 16, UiKit.Orange, true, TextAnchor.MiddleCenter);
                    clue.resizeTextForBestFit = true; clue.resizeTextMinSize = 11; clue.resizeTextMaxSize = 16;
                    UiKit.Box("Rocket", root, 145, 71, 12, 34, UiKit.Coral);
                    UiKit.Box("Nose", root, 148, 65, 6, 10, UiKit.Cream);
                    UiKit.Box("Exhaust", root, 147, 105, 8, 12, UiKit.Orange);
                    var buttons = new Button[4];
                    for (int i = 0; i < 4; i++)
                    {
                        int choice = i, id = missile.Id;
                        buttons[i] = UiKit.Button(missile.Choices[i].word, root, i % 2 == 0 ? 6 : 166, 45 + i / 2 * 40, 130, 34, UiKit.Line, UiKit.Cream, () => game.AnswerMissile(id, choice));
                        var label = buttons[i].GetComponentInChildren<Text>(); label.fontSize = 15; label.resizeTextForBestFit = true; label.resizeTextMinSize = 10; label.resizeTextMaxSize = 15;
                    }
                    var status = UiKit.Label("", root, 6, 125, 203, 25, 11, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    UiKit.Button("ĐỔI TL →", root, 214, 127, 81, 24, UiKit.Line, UiKit.Cream, () =>
                    {
                        int current = flight.Missiles.ToList().FindIndex(m => m.Id == focusedMissile);
                        if (flight.Missiles.Count > 0) focusedMissile = flight.Missiles[(current + 1) % flight.Missiles.Count].Id;
                    }).GetComponentInChildren<Text>().fontSize = 10;
                    int markerId = missile.Id;
                    var marker = UiKit.Button("!", field, 0, 0, 30, 38, UiKit.Coral, UiKit.Ink, () => focusedMissile = markerId).GetComponent<RectTransform>();
                    visual = new MissileVisual { Root = root, Status = status, Buttons = buttons, Marker = marker }; missiles.Add(missile.Id, visual);
                }
                bool focused = missile.Id == focusedMissile;
                // The quiz surrounds the actual rocket; blast coordinates match its position.
                float x = Mathf.Clamp(missile.X * Width - 151, 0, Width - 302);
                visual.Root.anchoredPosition = new Vector2(x, -missile.Y * Height + 90);
                visual.Root.gameObject.SetActive(focused); visual.Marker.gameObject.SetActive(!focused);
                Place(visual.Marker, missile.X, missile.Y, 15, 19);
                visual.Marker.SetAsLastSibling();
                visual.Status.text = (flight.Driving ? "SANG BẮN · " : "") + "SAI " + missile.WrongAttempts + "/3 · " + flight.Missiles.Count + " TÊN LỬA";
                foreach (var button in visual.Buttons) button.interactable = !flight.Driving;
                visual.Root.SetAsLastSibling();
            }
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

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // The walkable airbase (FlightGame Mode.Base). One composed ground texture, every model a separate
    // Image placed by its sprite anchor and y-sorted, characters re-sorted each frame, a camera that follows
    // the pilot, plus the base HUD (objective, zone banner, [E] prompt, quest marker, title card, key strip).
    // Only reads BaseWorld / MissionLog state; FlightGame owns input and applies the rules.
    public sealed partial class BaseView
    {
        // 1 tile = 16 art px; everything on the base is drawn 3x, so 1 tile = 48 reference px.
        public const float TileSize = 48, Scale = 3;
        public const int TilePixels = 16;
        private const float SnapStep = 3, CameraLift = 36;
        private const float ZoneSeconds = 2.6f, HintSeconds = 4.2f, TitleFadeSeconds = .45f;
        private static readonly string[] GroundSprites = { "tile_grass", "tile_dirt", "tile_concrete", "tile_asphalt", "tile_sand", "tile_runway", "tile_water" };
        // Flat stand-ins when a ground tile is missing (art not forged yet).
        private static readonly Color32[] GroundColors =
        {
            new Color32(78, 107, 52, 255), new Color32(122, 94, 60, 255), new Color32(138, 138, 128, 255), new Color32(62, 64, 64, 255),
            new Color32(200, 176, 122, 255), new Color32(90, 90, 85, 255), new Color32(61, 110, 136, 255)
        };

        private sealed class Sortable { public RectTransform Rect; public float Key, X; }
        private sealed class Animated { public Image Image; public string Sprite; public float Phase; }
        private sealed class Actor
        {
            public string Id, Character, SpriteName;
            public Image Body, Shadow;
            // StridePhase: 0..1 through the walk/run cycle (contact frames at 0 and 1/2), shared by walk and run
            // so switching gait never makes the legs jump.
            public float StridePhase, IdleTime, X, Y, Key;
            public bool WasMoving, WasRunning;
            public Facing LastFacing;
        }
        private sealed class Puff { public Image Image; public float Age; public bool Live; }

        private const string DustSprite = "fx_dust";
        private const int DustPool = 8;
        private const float DustBehind = .2f;
        // Fallback cycle length when a character has no walk/run sprite (footsteps still keep time).
        private const float FallbackWalkCycle = .5f, FallbackRunCycle = .4f;

        private readonly RectTransform canvasRect, root, viewport, world, shadowLayer, sortLayer, topLayer, hud;
        private readonly RectTransform promptPlate, keyStrip, titleCard;
        private readonly Text promptLabel, objectiveTitle, objectiveText, objectiveDetail, pilotStats, zoneLabel, hintLabel, titlePress;
        private readonly CanvasGroup zoneGroup, hintGroup, titleGroup, objectiveGroup, pilotGroup;
        private readonly Image questMarker;
        private RawImage ground;
        private MapDef map;
        private float mapWidth, mapHeight, time, zoneTimer, hintTimer, titleAlpha;
        private bool built, titleDismissing;
        private readonly List<Sortable> statics = new List<Sortable>();
        private float[] staticKeys = Array.Empty<float>();
        private readonly List<Animated> animated = new List<Animated>();
        private readonly List<Actor> actors = new List<Actor>();
        private readonly List<Actor> order = new List<Actor>();
        private readonly List<int> lastSlots = new List<int>();
        private readonly List<Actor> lastOrder = new List<Actor>();
        private readonly Dictionary<string, Image> placementImages = new Dictionary<string, Image>();
        private readonly HashSet<string> missing = new HashSet<string>();
        private readonly Dictionary<string, bool> ready = new Dictionary<string, bool>();
        private readonly List<Puff> dust = new List<Puff>();
        private Actor player;

        public RectTransform Root => root;
        // Footstep contacts of the pilot (walk/run frames 0 and frames/2); FlightGame plays a step on each increase.
        public int PlayerSteps { get; private set; }
        // Total dust puffs kicked up by the pilot (running contacts, starting to run, 180° turns).
        public int DustPuffs { get; private set; }
        public int ActiveDust { get { int n = 0; foreach (var p in dust) if (p.Live) n++; return n; } }
        public bool Visible { get => root.gameObject.activeSelf; set { if (root.gameObject.activeSelf != value) root.gameObject.SetActive(value); } }
        // Test hooks.
        public bool TitleVisible => titleCard.gameObject.activeSelf;
        public bool TitleDismissing => titleDismissing;
        public string PlayerSpriteName => player != null && player.Body.sprite ? player.Body.sprite.name : "";
        public string NpcSpriteName(string id) { var a = actors.Find(x => x.Id == id); return a != null && a.Body.sprite ? a.Body.sprite.name : ""; }
        public bool PromptVisible => promptPlate.gameObject.activeSelf;
        public string PromptLabel => PromptVisible ? promptLabel.text : "";
        public bool QuestMarkerVisible => questMarker.enabled;
        public string ObjectiveText => objectiveText.text;
        public string HintText => hintLabel.text;
        public bool HintVisible => hintTimer > 0;
        public string ZoneText => zoneLabel.text;
        public bool ZoneVisible => zoneTimer > 0;
        public int PlacementImages => placementImages.Count;
        public int FenceImages { get; private set; }
        public int MissingSprites => missing.Count;
        public string GroundMode { get; private set; } = "";
        public bool HasPlacement(string id) => placementImages.TryGetValue(id, out var image) && image && image.sprite;
        public Vector2 CameraPosition { get; private set; }
        public int PlacementDrawIndex(string id) => placementImages.TryGetValue(id, out var image) && image ? image.transform.GetSiblingIndex() : -1;
        public int PlayerDrawIndex => player != null ? player.Body.transform.GetSiblingIndex() : -1;

        public BaseView(Transform parent, RectTransform canvasRect)
        {
            this.canvasRect = canvasRect;
            root = UiKit.Rect("Base", parent, 0, 0, 1440, 900);
            // The world lives in its own nested canvas so camera movement does not rebuild the HUD.
            viewport = UiKit.Rect("Base viewport", root, 0, 0, 1440, 900);
            viewport.gameObject.AddComponent<Canvas>();
            viewport.gameObject.AddComponent<RectMask2D>();
            var backdrop = UiKit.Box("Base backdrop", viewport, 0, 0, 1440, 900, UiKit.Ink).rectTransform;
            backdrop.anchorMin = Vector2.zero; backdrop.anchorMax = Vector2.one; backdrop.offsetMin = backdrop.offsetMax = Vector2.zero;
            world = UiKit.Rect("Base world", viewport, 0, 0, 100, 100);
            var groundObject = new GameObject("Ground", typeof(RectTransform), typeof(RawImage));
            var groundRect = groundObject.GetComponent<RectTransform>(); groundRect.SetParent(world, false);
            groundRect.anchorMin = groundRect.anchorMax = groundRect.pivot = new Vector2(0, 1); groundRect.anchoredPosition = Vector2.zero;
            ground = groundObject.GetComponent<RawImage>(); ground.raycastTarget = false; ground.color = UiKit.Ink;
            shadowLayer = UiKit.Rect("Shadows", world, 0, 0, 0, 0);
            sortLayer = UiKit.Rect("Y-sorted", world, 0, 0, 0, 0);
            topLayer = UiKit.Rect("World labels", world, 0, 0, 0, 0);

            questMarker = UiKit.Box("Quest marker", topLayer, 0, 0, 24, 48, Color.white); questMarker.enabled = false;
            var plate = UiKit.Framed("Prompt", topLayer, 0, 0, 200, 36, "ui_plate", 2);
            promptPlate = plate.rectTransform;
            promptLabel = UiKit.Label("", plate.transform, 0, -1, 200, 36, 13, UiKit.Cream, true, TextAnchor.MiddleCenter);
            promptLabel.horizontalOverflow = HorizontalWrapMode.Overflow;
            promptPlate.gameObject.SetActive(false);

            // ---- HUD (fixed on screen) ----
            hud = UiKit.Rect("Base HUD", root, 0, 0, 1440, 900);
            var objective = UiKit.Framed("Objective", hud, 20, 18, 480, 112, "ui_panel");
            objectiveGroup = objective.gameObject.AddComponent<CanvasGroup>();
            UiKit.Icon("icon_radio", objective.transform, 26, 16, 26);
            objectiveTitle = UiKit.Fit(UiKit.Label("NHIỆM VỤ", objective.transform, 62, 12, 392, 32, 13, UiKit.Mint, true), 9, 13);
            objectiveText = UiKit.Fit(UiKit.Label("", objective.transform, 26, 44, 428, 38, 15, UiKit.Cream), 10, 15);
            objectiveDetail = UiKit.Fit(UiKit.Label("", objective.transform, 26, 78, 428, 22, 11, UiKit.Muted), 8, 11);

            var pilot = UiKit.Framed("Pilot plate", hud, 1120, 18, 300, 74, "ui_panel");
            pilotGroup = pilot.gameObject.AddComponent<CanvasGroup>();
            UiKit.Icon("icon_medal", pilot.transform, 26, 14, 24);
            UiKit.Label(BaseContent.PlayerName.ToUpperInvariant() + "  ·  SKYLARK", pilot.transform, 58, 8, 216, 30, 13, UiKit.Mint, true);
            pilotStats = UiKit.Fit(UiKit.Label("", pilot.transform, 26, 38, 248, 26, 11, UiKit.Cream), 8, 11);

            var zone = UiKit.Framed("Zone banner", hud, 520, 22, 400, 50, "ui_plate", 2);
            zoneGroup = zone.gameObject.AddComponent<CanvasGroup>(); zoneGroup.alpha = 0;
            zoneLabel = UiKit.Fit(UiKit.Label("", zone.transform, 10, -1, 380, 50, 17, UiKit.Cream, true, TextAnchor.MiddleCenter), 11, 17);

            var hint = UiKit.Framed("Hint", hud, 250, 744, 940, 64, "ui_panel");
            hintGroup = hint.gameObject.AddComponent<CanvasGroup>(); hintGroup.alpha = 0;
            hintLabel = UiKit.Fit(UiKit.Label("", hint.transform, 24, 0, 892, 64, 15, UiKit.Cream, false, TextAnchor.MiddleCenter), 10, 15);

            var keys = UiKit.Framed("Key strip", hud, 20, 830, 640, 54, "ui_panel");
            keyStrip = keys.rectTransform;
            string[] caps = { "WASD", "SHIFT", "E" };
            string[] actions = { "đi", "chạy", "tương tác" };
            float[] widths = { 76, 76, 40 };
            float x = 18;
            for (int i = 0; i < caps.Length; i++)
            {
                var cap = UiKit.Framed("Key " + caps[i], keys.transform, x, 10, widths[i], 34, "ui_keycap", 2);
                UiKit.Label(caps[i], cap.transform, 0, -2, widths[i], 32, 12, UiKit.Ink, true, TextAnchor.MiddleCenter);
                UiKit.Label(actions[i], keys.transform, x + widths[i] + 10, 10, 120, 34, 13, UiKit.Cream);
                x += widths[i] + (i == 2 ? 0 : 128);
            }

            // Title card shown over the base when the game starts.
            var title = UiKit.Box("Title card", hud, -1000, -1000, 3440, 2900, new Color(0, 0, 0, .58f));
            titleCard = title.rectTransform; titleGroup = title.gameObject.AddComponent<CanvasGroup>();
            var titleBody = UiKit.Rect("Title body", titleCard, 1000, 1000, 1440, 900);
            UiKit.Sprite("Logo", titleBody, 474, 70, 492, 204, "logo");
            UiKit.Label("PHI ĐỘI TỪ VỰNG  ·  1944", titleBody, 0, 284, 1440, 40, 22, UiKit.Mint, true, TextAnchor.MiddleCenter);
            UiKit.Label("Căn cứ không quân · học từ vựng Oxford trên từng chuyến xuất kích", titleBody, 0, 326, 1440, 30, 14, UiKit.Muted, false, TextAnchor.MiddleCenter);
            titlePress = UiKit.Label("Nhấn phím bất kỳ để bắt đầu", titleBody, 0, 590, 1440, 44, 22, UiKit.Cream, true, TextAnchor.MiddleCenter);
            UiKit.Label("PHIÊN BẢN 0.15  ·  PIXEL SQUADRON", titleBody, 0, 840, 1440, 28, 11, UiKit.Muted, true, TextAnchor.MiddleCenter);
            titleCard.gameObject.SetActive(false);
            root.gameObject.SetActive(false);
        }

        // ---------------- Per frame ----------------
        public void Animate(float delta, BaseWorld state, bool dialogueOpen)
        {
            if (!built || state == null) return;
            time += delta;
            foreach (var a in animated) if (a.Image) a.Image.sprite = PixelSprites.At(a.Sprite, time + a.Phase);
            UpdateDust(delta);
            UpdateActor(player, state.PlayerX, state.PlayerY, state.PlayerFacing, state.Moving, state.Running, false, delta);
            foreach (var npc in state.Npcs)
            {
                var actor = actors.Find(a => a.Id == npc.Def.Id);
                if (actor != null) UpdateActor(actor, npc.X, npc.Y, npc.Facing, false, false, npc.Talking, delta);
            }
            SortActors();
            UpdateCamera(state.PlayerX, state.PlayerY);
            UpdatePrompt(state, dialogueOpen);
            var professor = state.Npc("professor");
            bool marker = professor != null && state.Missions.Active == null && !professor.Talking && Ready("fx_quest_marker");
            questMarker.enabled = marker;
            if (marker)
            {
                questMarker.sprite = PixelSprites.At("fx_quest_marker", time);
                var size = PixelSprites.Size("fx_quest_marker", Scale);
                questMarker.rectTransform.sizeDelta = size;
                questMarker.rectTransform.anchoredPosition = new Vector2(Snap(professor.X * TileSize - size.x / 2), -Snap(professor.Y * TileSize - 96 - size.y - 6));
            }
            var log = state.Missions;
            objectiveTitle.text = log.Active != null ? "NHIỆM VỤ  ·  " + log.Active.Title.ToUpperInvariant() : "NHIỆM VỤ";
            objectiveText.text = log.ObjectiveText;
            objectiveDetail.text = log.Active != null ? "Chiến trường: " + BaseContent.EnvironmentName(log.Environment) + "  ·  giao bởi Giáo sư Whitmore" : "Trường huấn luyện ngoại ngữ nằm ở khu doanh trại phía tây bắc.";
            pilotStats.text = "Chuyến bay: " + UiKit.Number(log.Completed) + "  ·  Điểm gần nhất: " + UiKit.Number(log.LastScore);
            zoneTimer = Mathf.Max(0, zoneTimer - delta); zoneGroup.alpha = Mathf.Clamp01(zoneTimer / .5f) * Mathf.Clamp01((ZoneSeconds - zoneTimer) / .2f + .01f);
            hintTimer = Mathf.Max(0, hintTimer - delta); hintGroup.alpha = Mathf.Clamp01(hintTimer / .5f);
            bool strip = !dialogueOpen && !TitleVisible;
            if (keyStrip.gameObject.activeSelf != strip) keyStrip.gameObject.SetActive(strip);
            if (TitleVisible)
            {
                if (titleDismissing) titleAlpha -= delta / TitleFadeSeconds;
                titleGroup.alpha = Mathf.Clamp01(titleAlpha);
                // The corner panels stay faded behind the title card.
                objectiveGroup.alpha = pilotGroup.alpha = 1 - .85f * titleGroup.alpha;
                titlePress.enabled = titleDismissing || time % 1.1f < .75f;
                if (titleAlpha <= 0) { titleCard.gameObject.SetActive(false); objectiveGroup.alpha = pilotGroup.alpha = 1; }
            }
        }

        private static float Snap(float value) => Mathf.Round(value / SnapStep) * SnapStep;

        public void SnapCamera(BaseWorld state) { if (built) Animate(0, state, false); }

        private void UpdateCamera(float x, float y)
        {
            var size = canvasRect ? canvasRect.rect.size : new Vector2(1440, 900);
            if (size.x < 1 || size.y < 1) size = new Vector2(1440, 900);
            // The viewport covers the whole visible canvas (CanvasScaler Expand can show more than 1440x900).
            viewport.anchoredPosition = new Vector2(-(size.x - 1440) / 2, (size.y - 900) / 2);
            viewport.sizeDelta = size;
            float cx = x * TileSize - size.x / 2, cy = y * TileSize - CameraLift - size.y / 2;
            cx = mapWidth <= size.x ? (mapWidth - size.x) / 2 : Mathf.Clamp(cx, 0, mapWidth - size.x);
            cy = mapHeight <= size.y ? (mapHeight - size.y) / 2 : Mathf.Clamp(cy, 0, mapHeight - size.y);
            cx = Snap(cx); cy = Snap(cy);
            CameraPosition = new Vector2(cx, cy);
            world.anchoredPosition = new Vector2(-cx, cy);
        }

        public void DismissTitle() { if (TitleVisible) titleDismissing = true; }
    }
}

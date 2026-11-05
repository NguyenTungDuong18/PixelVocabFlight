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
    public sealed class BaseView
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

        // ---------------- Building the map (once) ----------------
        public void Build(BaseWorld state)
        {
            if (built) return;
            built = true; map = state.Map;
            mapWidth = map.Width * TileSize; mapHeight = map.Height * TileSize;
            world.sizeDelta = new Vector2(mapWidth, mapHeight);
            ground.rectTransform.sizeDelta = new Vector2(mapWidth, mapHeight);
            try { BuildGround(); }
            catch (Exception exception) { Debug.LogException(exception); GroundMode = "failed"; }
            foreach (var p in map.Placements)
            {
                try { AddPlacement(p); }
                catch (Exception exception) { Debug.LogWarning("Bỏ qua công trình " + p.Id + ": " + exception.Message); }
            }
            AddFences();
            statics.Sort((a, b) => a.Key != b.Key ? a.Key.CompareTo(b.Key) : a.X.CompareTo(b.X));
            staticKeys = new float[statics.Count];
            for (int i = 0; i < statics.Count; i++) { statics[i].Rect.SetAsLastSibling(); staticKeys[i] = statics[i].Key; }
            player = AddActor("pilot", BaseContent.PlayerCharacter);
            foreach (var npc in state.Npcs) AddActor(npc.Def.Id, npc.Def.Character);
            if (missing.Count > 0) Debug.LogWarning("Căn cứ thiếu " + missing.Count + " sprite: " + string.Join(", ", missing));
            Animate(0, state, false);
        }

        private bool Ready(string name)
        {
            if (ready.TryGetValue(name, out bool ok)) return ok;
            ok = false;
            try { ok = PixelSprites.Has(name) && PixelSprites.Frames(name).Length > 0; }
            catch (InvalidOperationException exception) { Debug.LogWarning(exception.Message); }
            ready[name] = ok;
            if (!ok) missing.Add(name);
            return ok;
        }

        // Anchor in art px; a sprite without one stands on its bottom-left corner.
        private static Vector2 AnchorOf(string sprite, Vector2 size, Vector2 fallback)
        {
            var anchor = PixelSprites.Anchor(sprite);
            return anchor == Vector2Int.zero ? fallback : (Vector2)anchor;
        }

        private void BuildGround()
        {
            int w = map.Width * TilePixels, h = map.Height * TilePixels;
            var texture = new Texture2D(w, h, TextureFormat.RGBA32, false) { name = "Base ground", filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color32[w * h];
            var cache = new Dictionary<Texture2D, Color32[]>();
            var gpu = new List<(Texture2D source, int x, int y)>();
            int flat = 0;
            for (int ty = 0; ty < map.Height; ty++)
                for (int tx = 0; tx < map.Width; tx++)
                {
                    var kind = map.GroundAt(tx, ty);
                    string name = GroundSprites[(int)kind];
                    int ox = tx * TilePixels, oy = h - (ty + 1) * TilePixels;
                    Texture2D source = null;
                    if (Ready(name))
                    {
                        int frames = PixelSprites.FrameCount(name);
                        int variant = kind == Ground.Runway ? Mathf.Clamp(map.RunwayVariant(tx, ty), 0, frames - 1) : MapDef.TileVariant(tx, ty, frames);
                        source = PixelSprites.Texture(name, variant);
                    }
                    var block = source ? TilePixelsOf(source, cache) : null;
                    for (int row = 0; row < TilePixels; row++)
                    {
                        int at = (oy + row) * w + ox;
                        for (int col = 0; col < TilePixels; col++) pixels[at + col] = block != null ? block[row * TilePixels + col] : GroundColors[(int)kind];
                    }
                    if (block != null) continue;
                    if (source) gpu.Add((source, ox, oy)); else flat++;
                }
            texture.SetPixels32(pixels);
            if (gpu.Count == 0) { texture.Apply(false, true); GroundMode = flat == 0 ? "cpu" : "partial-flat"; }
            else
            {
                // Tiles imported without Read/Write: copy them on the GPU instead (same format only).
                texture.Apply(false, false);
                int copied = 0;
                if (SystemInfo.copyTextureSupport != UnityEngine.Rendering.CopyTextureSupport.None)
                    foreach (var (source, x, y) in gpu)
                        if (source.format == texture.format && source.width >= TilePixels && source.height >= TilePixels)
                        { Graphics.CopyTexture(source, 0, 0, 0, 0, TilePixels, TilePixels, texture, 0, 0, x, y); copied++; }
                GroundMode = copied == gpu.Count ? "gpu" : "partial-flat";
                Debug.LogWarning("Ô nền căn cứ không bật Read/Write; đã chép " + copied + "/" + gpu.Count + " ô bằng GPU.");
            }
            if (flat > 0) Debug.LogWarning("Căn cứ: " + flat + " ô nền thiếu sprite, dùng màu phẳng.");
            ground.texture = texture; ground.color = Color.white;
        }

        private static Color32[] TilePixelsOf(Texture2D source, Dictionary<Texture2D, Color32[]> cache)
        {
            if (cache.TryGetValue(source, out var block)) return block;
            block = null;
            if (source.isReadable && source.width >= TilePixels && source.height >= TilePixels)
            {
                if (source.width == TilePixels && source.height == TilePixels) block = source.GetPixels32();
                else
                {
                    var colors = source.GetPixels(0, 0, TilePixels, TilePixels);
                    block = new Color32[colors.Length];
                    for (int i = 0; i < colors.Length; i++) block[i] = colors[i];
                }
            }
            cache[source] = block;
            return block;
        }

        private void AddPlacement(Placement p)
        {
            string sprite = WorldModels.SpriteName(p.Model, p.Facing);
            if (!Ready(sprite)) return;
            var size = PixelSprites.Size(sprite, 1);
            var f = map.FootprintOf(p);
            var foot = PixelSprites.Foot(sprite);
            if (foot != Vector2Int.zero && (foot.x != f.w || foot.y != f.h))
                Debug.LogWarning("Chân đế " + sprite + " trong manifest (" + foot.x + "×" + foot.y + ") khác WorldModels (" + f.w + "×" + f.h + ").");
            // The anchor pixel (bottom-left of the footprint, on the ground) lands on world point (X, Y + fh).
            var anchor = AnchorOf(sprite, size, new Vector2(0, size.y));
            float left = f.x * TileSize - anchor.x * Scale, top = (f.y + f.h) * TileSize - anchor.y * Scale;
            var image = UiKit.Sprite(p.Id, sortLayer, left, top, size.x * Scale, size.y * Scale, sprite);
            image.preserveAspect = false;
            statics.Add(new Sortable { Rect = image.rectTransform, Key = map.SortKey(p), X = f.x });
            placementImages[p.Id] = image;
            if (PixelSprites.FrameCount(sprite) > 1)
                animated.Add(new Animated { Image = image, Sprite = sprite, Phase = MapDef.TileHash(p.X, p.Y) % 997 / 997f * PixelSprites.Duration(sprite) });
        }

        // Fence pieces are 16x24 sprites standing on their tile (anchor 0,24), sorted with the models.
        private void AddFences()
        {
            const string sprite = "tile_fence";
            bool any = false;
            for (int y = 0; y < map.Height; y++)
                for (int x = 0; x < map.Width; x++)
                {
                    int variant = map.FenceVariant(x, y);
                    if (variant < 0) continue;
                    any = true;
                    if (!Ready(sprite)) continue;
                    var size = PixelSprites.Size(sprite, 1);
                    var anchor = AnchorOf(sprite, size, new Vector2(0, size.y));
                    var image = UiKit.Sprite("Fence", sortLayer, x * TileSize - anchor.x * Scale, (y + 1) * TileSize - anchor.y * Scale, size.x * Scale, size.y * Scale, sprite, variant);
                    image.preserveAspect = false;
                    statics.Add(new Sortable { Rect = image.rectTransform, Key = y + 1, X = x });
                    FenceImages++;
                }
            if (!any) Debug.LogWarning("Bản đồ căn cứ không có hàng rào.");
        }

        private Actor AddActor(string id, string character)
        {
            var actor = new Actor { Id = id, Character = character };
            actor.Shadow = UiKit.Box("Shadow " + id, shadowLayer, 0, 0, 72, 96, Color.white);
            actor.Shadow.enabled = Ready("chr_shadow");
            if (actor.Shadow.enabled) actor.Shadow.sprite = PixelSprites.Get("chr_shadow");
            actor.Body = UiKit.Box("Character " + id, sortLayer, 0, 0, 72, 96, Color.white);
            actor.Body.enabled = false;
            actor.IdleTime = MapDef.TileHash(id.Length, id[0]) % 100 / 100f;
            actors.Add(actor);
            return actor;
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

        // stride = the sprite is a walk/run cycle driven by StridePhase (otherwise idle/talk on IdleTime).
        private string CharacterSprite(Actor actor, Facing facing, bool moving, bool running, bool talking, out bool stride)
        {
            stride = false;
            string dir = WorldModels.Suffix(facing), prefix = "chr_" + actor.Character + "_";
            // Only some characters (the professor) have a talking cycle; it is optional for the others.
            if (talking && facing == Facing.S && PixelSprites.Has(prefix + "talk_s") && Ready(prefix + "talk_s")) return prefix + "talk_s";
            if (moving)
            {
                stride = true;
                // The run cycle is optional: without it running falls back to the walk cycle.
                if (running && PixelSprites.Has(prefix + "run_" + dir) && Ready(prefix + "run_" + dir)) return prefix + "run_" + dir;
                if (Ready(prefix + "walk_" + dir)) return prefix + "walk_" + dir;
                stride = false;
            }
            if (Ready(prefix + "idle_" + dir)) return prefix + "idle_" + dir;
            return Ready(prefix + "idle_s") ? prefix + "idle_s" : null;
        }

        private void UpdateActor(Actor actor, float x, float y, Facing facing, bool moving, bool running, bool talking, float delta)
        {
            running &= moving;
            bool isPlayer = actor == player;
            string sprite = CharacterSprite(actor, facing, moving, running, talking, out bool stride);
            int frames = stride ? Mathf.Max(1, PixelSprites.FrameCount(sprite)) : 8;
            int contacts = 0;
            if (moving)
            {
                // Setting off from a stand: the cycle starts on its first contact frame (one step right away).
                if (!actor.WasMoving) { actor.StridePhase = 0; contacts = 1; }
                float cycle = stride ? PixelSprites.Duration(sprite) : running ? FallbackRunCycle : FallbackWalkCycle;
                float before = actor.StridePhase, after = before + delta / Mathf.Max(.01f, cycle);
                contacts += Contacts(before, after, frames);
                actor.StridePhase = after - Mathf.Floor(after);
            }
            else
            {
                // The pilot settles into a fresh breath from the neutral pose; NPCs keep their random offset.
                if (actor.WasMoving && isPlayer) actor.IdleTime = 0; else actor.IdleTime += delta;
                actor.StridePhase = 0;
            }
            actor.X = x; actor.Y = y; actor.Key = y;
            actor.Body.enabled = sprite != null;
            if (sprite != null)
            {
                actor.SpriteName = sprite;
                actor.Body.sprite = stride
                    ? PixelSprites.Get(sprite, Mathf.Clamp(Mathf.FloorToInt(actor.StridePhase * frames), 0, frames - 1))
                    : PixelSprites.At(sprite, actor.IdleTime);
                Place(actor.Body.rectTransform, sprite, x, y);
            }
            if (actor.Shadow.enabled) Place(actor.Shadow.rectTransform, "chr_shadow", x, y);
            if (isPlayer)
            {
                PlayerSteps += contacts;
                // Dust: every running contact, the moment a run starts, and a 180° turn while moving (a skid).
                bool reversed = moving && actor.WasMoving && ((int)actor.LastFacing + 2) % 4 == (int)facing;
                if ((running && contacts > 0) || (running && !actor.WasRunning) || reversed) SpawnDust(x, y, facing);
            }
            actor.WasMoving = moving; actor.WasRunning = running; actor.LastFacing = facing;
        }

        // Contact frames start at phase 0 and (frames/2)/frames; counts every boundary in (before, after],
        // so a long frame that skips over several contacts still counts each of them.
        private static int Contacts(float before, float after, int frames)
        {
            int count = Mathf.FloorToInt(after) - Mathf.FloorToInt(before);
            if (frames >= 2)
            {
                float half = (frames / 2) / (float)frames;
                count += Mathf.FloorToInt(after - half) - Mathf.FloorToInt(before - half);
            }
            return count;
        }

        // Characters: the anchor pixel (centre of the feet) lands on the feet point, snapped to whole art pixels.
        private static void Place(RectTransform rect, string sprite, float x, float y)
        {
            var size = PixelSprites.Size(sprite, 1);
            var anchor = AnchorOf(sprite, size, new Vector2(12, 30));
            rect.sizeDelta = size * Scale;
            rect.anchoredPosition = new Vector2(Snap(x * TileSize - anchor.x * Scale), -Snap(y * TileSize - anchor.y * Scale));
        }

        // ---------------- Dust puffs (fx_dust, optional) ----------------
        private bool DustReady => PixelSprites.Has(DustSprite) && Ready(DustSprite);

        // A puff on the ground a little behind the feet (opposite the facing), fixed in the world.
        private void SpawnDust(float x, float y, Facing facing)
        {
            if (!DustReady) return;
            switch (facing)
            {
                case Facing.E: x -= DustBehind; break;
                case Facing.W: x += DustBehind; break;
                case Facing.N: y += DustBehind; break;
                default: y -= DustBehind; break;
            }
            Puff puff = null;
            foreach (var p in dust) if (!p.Live) { puff = p; break; }
            if (puff == null && dust.Count < DustPool)
            {
                var image = UiKit.Box("Dust", shadowLayer, 0, 0, 48, 24, Color.white);
                image.raycastTarget = false;
                puff = new Puff { Image = image };
                dust.Add(puff);
            }
            if (puff == null) { puff = dust[0]; foreach (var p in dust) if (p.Age > puff.Age) puff = p; }
            puff.Live = true; puff.Age = 0;
            puff.Image.enabled = true;
            puff.Image.sprite = PixelSprites.Get(DustSprite, 0);
            var size = PixelSprites.Size(DustSprite, 1);
            var anchor = AnchorOf(DustSprite, size, new Vector2(size.x / 2, size.y - 1));
            var rect = puff.Image.rectTransform;
            rect.sizeDelta = size * Scale;
            rect.anchoredPosition = new Vector2(Snap(x * TileSize - anchor.x * Scale), -Snap(y * TileSize - anchor.y * Scale));
            DustPuffs++;
        }

        // Each puff plays its frames once, then hides until the pool reuses it.
        private void UpdateDust(float delta)
        {
            if (dust.Count == 0) return;
            float life = PixelSprites.Duration(DustSprite);
            foreach (var p in dust)
            {
                if (!p.Live) continue;
                p.Age += delta;
                if (p.Age >= life) { p.Live = false; p.Image.enabled = false; continue; }
                p.Image.sprite = PixelSprites.At(DustSprite, p.Age);
            }
        }

        // Characters slot in after every static model whose sort key is <= their feet Y.
        private void SortActors()
        {
            order.Clear(); order.AddRange(actors);
            order.Sort((a, b) => a.Key != b.Key ? a.Key.CompareTo(b.Key) : a.X.CompareTo(b.X));
            bool changed = lastOrder.Count != order.Count;
            for (int i = 0; i < order.Count && !changed; i++) changed = lastOrder[i] != order[i] || lastSlots[i] != UpperBound(order[i].Key) + i;
            if (!changed) return;
            foreach (var a in actors) a.Body.rectTransform.SetAsLastSibling();
            lastOrder.Clear(); lastSlots.Clear();
            for (int i = 0; i < order.Count; i++)
            {
                int slot = UpperBound(order[i].Key) + i;
                order[i].Body.rectTransform.SetSiblingIndex(slot);
                lastOrder.Add(order[i]); lastSlots.Add(slot);
            }
        }

        private int UpperBound(float key)
        {
            int lo = 0, hi = staticKeys.Length;
            while (lo < hi) { int mid = (lo + hi) / 2; if (staticKeys[mid] <= key) lo = mid + 1; else hi = mid; }
            return lo;
        }

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

        private void UpdatePrompt(BaseWorld state, bool dialogueOpen)
        {
            string text = dialogueOpen || TitleVisible ? null : state.PromptText;
            bool show = !string.IsNullOrEmpty(text);
            if (promptPlate.gameObject.activeSelf != show) promptPlate.gameObject.SetActive(show);
            if (!show) return;
            float ax, ay;
            if (state.NearestKind == InteractKind.Npc && state.Npc(state.NearestId) != null)
            {
                var npc = state.Npc(state.NearestId);
                ax = npc.X * TileSize; ay = npc.Y * TileSize - 100;
            }
            else
            {
                var p = map.Find(state.NearestId);
                if (p == null) { promptPlate.gameObject.SetActive(false); return; }
                var f = map.FootprintOf(p);
                ax = (f.x + f.w / 2f) * TileSize;
                ay = placementImages.TryGetValue(p.Id, out var image) && image ? -image.rectTransform.anchoredPosition.y + 18 : f.y * TileSize - 24;
            }
            promptLabel.text = text;
            float width = Mathf.Ceil(MeasureWidth(promptLabel, text)) + 36;
            promptPlate.sizeDelta = new Vector2(width, 36);
            promptLabel.rectTransform.sizeDelta = new Vector2(width, 36);
            float left = Mathf.Clamp(ax - width / 2, 6, mapWidth - width - 6), top = Mathf.Clamp(ay - 44, 6, mapHeight - 48);
            promptPlate.anchoredPosition = new Vector2(Snap(left), -Snap(top));
        }

        private static float MeasureWidth(Text text, string value)
        {
            var settings = text.GetGenerationSettings(new Vector2(10000, 40));
            settings.horizontalOverflow = HorizontalWrapMode.Overflow; settings.resizeTextForBestFit = false;
            return text.cachedTextGeneratorForLayout.GetPreferredWidth(value, settings) / Mathf.Max(.01f, text.pixelsPerUnit);
        }

        // ---------------- HUD messages ----------------
        public void ShowZone(string name)
        {
            if (string.IsNullOrEmpty(name)) return;
            zoneLabel.text = name; zoneTimer = ZoneSeconds;
        }

        public void ShowHint(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            hintLabel.text = text; hintTimer = HintSeconds; hintGroup.alpha = 1;
        }

        public void ShowTitle() { titleCard.gameObject.SetActive(true); titleDismissing = false; titleAlpha = 1; titleGroup.alpha = 1; objectiveGroup.alpha = pilotGroup.alpha = .15f; }
        public void ClearHint() { hintTimer = 0; hintGroup.alpha = 0; }
        public void DismissTitle() { if (TitleVisible) titleDismissing = true; }
    }
}

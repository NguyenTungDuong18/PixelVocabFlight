using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // DialogueOpened: NpcId + Text = dialogue graph id. BoardAircraft: Text = placement id.
    // Hint: Text = message. ZoneEntered: Text = zone label.
    // StoryInteract: EntityId (= NpcId = Text) is the id after "story:" in the placement tag, sent when E is pressed near it.
    // NpcArrived: NpcId finished its NpcWalkTo route.
    public enum WorldEventKind { DialogueOpened, BoardAircraft, Hint, ZoneEntered, StoryInteract, NpcArrived }

    public sealed class WorldEvent
    {
        public WorldEventKind Kind;
        public string NpcId, Text;
        public string EntityId => NpcId;
    }

    public enum InteractKind { None, Npc, Aircraft, Story }

    // Live NPC state; Def stays immutable map data.
    public sealed class NpcState
    {
        public NpcDef Def { get; }
        public float X { get; internal set; }
        public float Y { get; internal set; }
        public Facing Facing { get; internal set; }
        public bool Talking { get; internal set; }
        // True while a NpcWalkTo route is running.
        public bool Walking => Route.Count > 0;
        internal readonly List<(float x, float y, float speed)> Route = new List<(float x, float y, float speed)>();

        public NpcState(NpcDef def)
        {
            Def = def;
            X = def.X; Y = def.Y; Facing = def.Facing;
        }
    }

    // Walkable base: pilot movement with tile collision, NPC/aircraft interaction and zone labels.
    // Unity reads the state and drains WorldEvents through PopEvent().
    public sealed class BaseWorld
    {
        public const float WalkSpeed = 4f, RunSpeed = 6.5f;            // tiles per second
        public const float BodyHalfWidth = .3f, BodyHalfDepth = .18f;  // feet collision box
        public const float InteractRange = 1.5f;                       // tiles
        public const float ZoneRange = 3f;                             // tiles to a building footprint
        private const float MaxStep = .05f;                            // tiles per collision sub-step
        private const float DeadZone = .01f;

        private readonly List<NpcState> npcs = new List<NpcState>();
        private readonly Queue<WorldEvent> events = new Queue<WorldEvent>();

        public BaseWorld(MapDef map, MissionLog missions)
        {
            Map = map ?? throw new ArgumentNullException(nameof(map));
            Missions = missions ?? throw new ArgumentNullException(nameof(missions));
            foreach (var npc in map.Npcs) npcs.Add(new NpcState(npc));
            PlayerX = map.SpawnX; PlayerY = map.SpawnY; PlayerFacing = map.SpawnFacing;
            CurrentZone = ZoneAt(PlayerX, PlayerY);
            RefreshNearest();
        }

        public MapDef Map { get; }
        public MissionLog Missions { get; }
        public float PlayerX { get; private set; }
        public float PlayerY { get; private set; }
        public Facing PlayerFacing { get; private set; }
        public bool Moving { get; private set; }
        public bool Running { get; private set; }
        public IReadOnlyList<NpcState> Npcs => npcs;
        public bool InDialogue { get { foreach (var n in npcs) if (n.Talking) return true; return false; } }

        public InteractKind NearestKind { get; private set; }
        public string NearestId { get; private set; }
        public string PromptText => PromptFor(NearestKind, NearestId);
        public string CurrentZone { get; private set; }
        // Shown when the pilot tries to board without orders.
        public string NoOrdersHint { get; set; } = BaseContent.NoOrdersHint;
        // Story mode: the pilot cannot walk or interact while true (cutscene beats).
        public bool LockPlayer { get; set; }
        // Story mode: which "story:<id>" placements can be used right now; null means all of them.
        public Func<string, bool> StoryActive { get; set; }

        public NpcState Npc(string id)
        {
            foreach (var n in npcs) if (n.Def.Id == id) return n;
            return null;
        }

        // Input is -1..1 per axis; diagonals are normalised. Movement is frozen while a dialogue is open.
        public void Tick(float dt, float inputX, float inputY, bool run)
        {
            if (float.IsNaN(dt) || float.IsInfinity(dt) || dt <= 0) return;
            dt = Math.Min(dt, .25f);
            if (float.IsNaN(inputX) || float.IsInfinity(inputX)) inputX = 0;
            if (float.IsNaN(inputY) || float.IsInfinity(inputY)) inputY = 0;
            inputX = Math.Max(-1f, Math.Min(1f, inputX));
            inputY = Math.Max(-1f, Math.Min(1f, inputY));
            MoveNpcs(dt);
            float length = (float)Math.Sqrt(inputX * inputX + inputY * inputY);
            if (InDialogue || LockPlayer || length < DeadZone)
            {
                Moving = Running = false;
                RefreshNearest();
                return;
            }
            if (length > 1) { inputX /= length; inputY /= length; }
            PlayerFacing = FacingFor(inputX, inputY, PlayerFacing);
            Moving = true;
            Running = run;
            float distance = (run ? RunSpeed : WalkSpeed) * dt;
            float travel = distance * Math.Min(1f, length);
            int steps = Math.Max(1, (int)Math.Ceiling(travel / MaxStep));
            float stepX = inputX * distance / steps, stepY = inputY * distance / steps;
            for (int i = 0; i < steps; i++)
            {
                PlayerX = Slide(PlayerX, PlayerY, stepX, true);
                PlayerY = Slide(PlayerX, PlayerY, stepY, false);
            }
            UpdateZone();
            RefreshNearest();
        }

        // Does the feet box centred at (x, y) touch a solid tile, water, fence, NPC or leave the map?
        public bool Blocked(float x, float y)
        {
            float x0 = x - BodyHalfWidth, x1 = x + BodyHalfWidth, y0 = y - BodyHalfDepth, y1 = y + BodyHalfDepth;
            if (x0 < 0 || y0 < 0 || x1 > Map.Width || y1 > Map.Height) return true;
            int tx0 = (int)Math.Floor(x0), tx1 = (int)Math.Floor(x1 - 1e-4f);
            int ty0 = (int)Math.Floor(y0), ty1 = (int)Math.Floor(y1 - 1e-4f);
            for (int ty = ty0; ty <= ty1; ty++)
                for (int tx = tx0; tx <= tx1; tx++)
                    if (Map.SolidTile(tx, ty)) return true;
            foreach (var n in npcs)
                if (Math.Abs(n.X - x) < BodyHalfWidth * 2 && Math.Abs(n.Y - y) < BodyHalfDepth * 2) return true;
            return false;
        }

        // Queues a straight walk (no pathfinding, no collision) for an NPC; several calls make a route that is
        // followed leg by leg. Speed in tiles per second. NpcArrived is sent when the last leg ends.
        public bool NpcWalkTo(string npcId, float x, float y, float speed)
        {
            var npc = Npc(npcId);
            if (npc == null || !(speed > 0) || float.IsNaN(x) || float.IsNaN(y) || float.IsInfinity(x) || float.IsInfinity(y)) return false;
            if (x < 0 || y < 0 || x > Map.Width || y > Map.Height) return false;
            npc.Route.Add((x, y, speed));
            return true;
        }

        private void MoveNpcs(float dt)
        {
            foreach (var n in npcs)
            {
                float budget = dt;
                while (n.Route.Count > 0 && budget > 0)
                {
                    var leg = n.Route[0];
                    float dx = leg.x - n.X, dy = leg.y - n.Y;
                    float d = (float)Math.Sqrt(dx * dx + dy * dy);
                    float reach = leg.speed * budget;
                    if (d > 1e-4f) n.Facing = Facings.Toward(dx, dy);
                    if (d <= reach)
                    {
                        n.X = leg.x; n.Y = leg.y;
                        budget -= leg.speed > 0 ? d / leg.speed : budget;
                        n.Route.RemoveAt(0);
                        if (n.Route.Count == 0) Emit(WorldEventKind.NpcArrived, n.Def.Id, n.Def.Id);
                    }
                    else
                    {
                        n.X += dx / d * reach; n.Y += dy / d * reach;
                        budget = 0;
                    }
                }
            }
        }

        public void Interact()
        {
            if (InDialogue || LockPlayer) return;
            RefreshNearest();
            if (NearestKind == InteractKind.Npc)
            {
                var npc = Npc(NearestId);
                npc.Facing = Facings.Toward(PlayerX - npc.X, PlayerY - npc.Y);
                npc.Talking = true;
                PlayerFacing = Facings.Toward(npc.X - PlayerX, npc.Y - PlayerY);
                Moving = Running = false;
                Emit(WorldEventKind.DialogueOpened, npc.Def.Id, npc.Def.Dialogue);
            }
            else if (NearestKind == InteractKind.Aircraft)
            {
                if (Missions.Active != null) Emit(WorldEventKind.BoardAircraft, null, NearestId);
                else Emit(WorldEventKind.Hint, null, NoOrdersHint);
            }
            else if (NearestKind == InteractKind.Story)
            {
                Emit(WorldEventKind.StoryInteract, NearestId, NearestId);
            }
            RefreshNearest();
        }

        public void EndDialogue()
        {
            foreach (var n in npcs)
            {
                if (!n.Talking) continue;
                n.Talking = false;
                n.Facing = n.Def.Facing;
            }
            RefreshNearest();
        }

        public void PlacePlayer(float x, float y, Facing f)
        {
            PlayerX = x; PlayerY = y; PlayerFacing = f;
            Moving = Running = false;
            UpdateZone();
            RefreshNearest();
        }

        public WorldEvent PopEvent() => events.Count == 0 ? null : events.Dequeue();

        // Building label within ZoneRange (closest footprint wins), otherwise the named map area, otherwise null.
        public string ZoneAt(float x, float y)
        {
            string best = null;
            float bestDistance = ZoneRange;
            foreach (var p in Map.Placements)
            {
                if (WorldModels.Get(p.Model).Kind != ModelKind.Building) continue;
                float d = DistanceToFootprint(p, x, y);
                if (d <= bestDistance) { bestDistance = d; best = p.DisplayName; }
            }
            return best ?? Map.AreaAt(x, y)?.Name;
        }

        // Distance from a point to a placement footprint rectangle (0 inside).
        public float DistanceToFootprint(Placement p, float x, float y)
        {
            var f = Map.FootprintOf(p);
            float dx = Math.Max(Math.Max(f.x - x, 0), x - (f.x + f.w));
            float dy = Math.Max(Math.Max(f.y - y, 0), y - (f.y + f.h));
            return (float)Math.Sqrt(dx * dx + dy * dy);
        }

        private static Facing FacingFor(float x, float y, Facing current)
        {
            bool horizontal = Math.Abs(x) > DeadZone, vertical = Math.Abs(y) > DeadZone;
            // On a diagonal keep the current facing if it is one of the two directions pressed.
            if (horizontal && vertical && Math.Abs(Math.Abs(x) - Math.Abs(y)) < .001f)
            {
                var h = x > 0 ? Facing.E : Facing.W;
                var v = y > 0 ? Facing.S : Facing.N;
                return current == h || current == v ? current : h;
            }
            return Facings.Toward(x, y);
        }

        // Moves along one axis; on contact it stops flush against the obstacle so the other axis can slide.
        private float Slide(float x, float y, float step, bool alongX)
        {
            if (step == 0) return alongX ? x : y;
            float from = alongX ? x : y;
            // Already overlapping (placed inside something): let the pilot walk out.
            if (!BlockedAt(from + step) || BlockedAt(from)) return from + step;
            float lo = 0, hi = 1;
            for (int i = 0; i < 8; i++)
            {
                float mid = (lo + hi) * .5f;
                if (BlockedAt(from + step * mid)) hi = mid; else lo = mid;
            }
            return from + step * lo;

            bool BlockedAt(float value) => alongX ? Blocked(value, y) : Blocked(x, value);
        }

        private void UpdateZone()
        {
            string zone = ZoneAt(PlayerX, PlayerY);
            if (zone == CurrentZone) return;
            CurrentZone = zone;
            if (zone != null) Emit(WorldEventKind.ZoneEntered, null, zone);
        }

        private void RefreshNearest()
        {
            NearestKind = InteractKind.None; NearestId = null;
            if (InDialogue) return;
            float best = InteractRange;
            foreach (var n in npcs)
            {
                if (n.Def.Dialogue == null) continue;   // story-only NPCs (no graph) cannot be talked to
                float dx = n.X - PlayerX, dy = n.Y - PlayerY;
                float d = (float)Math.Sqrt(dx * dx + dy * dy);
                if (d <= best) { best = d; NearestKind = InteractKind.Npc; NearestId = n.Def.Id; }
            }
            foreach (var p in Map.Placements)
            {
                bool aircraft = p.Tag == MapDef.PlayerAircraftTag;
                string storyId = StoryIdOf(p);
                if (!aircraft && storyId == null) continue;
                if (storyId != null && StoryActive != null && !StoryActive(storyId)) continue;
                float d = DistanceToFootprint(p, PlayerX, PlayerY);
                if (d < best || (d <= best && NearestKind == InteractKind.None))
                {
                    best = d;
                    NearestKind = aircraft ? InteractKind.Aircraft : InteractKind.Story;
                    NearestId = aircraft ? p.Id : storyId;
                }
            }
        }

        public const string StoryTagPrefix = "story:";

        // Id after "story:" in the placement tag, or null when the placement is not a story object.
        public static string StoryIdOf(Placement p) =>
            p.Tag != null && p.Tag.Length > StoryTagPrefix.Length && p.Tag.StartsWith(StoryTagPrefix, StringComparison.Ordinal) ? p.Tag.Substring(StoryTagPrefix.Length) : null;

        // Prompt for an interaction target; null for none.
        public string PromptFor(InteractKind kind, string id)
        {
            if (kind == InteractKind.Story) { var s = Map.FindTag(StoryTagPrefix + id); return s == null ? null : "[E] Xem " + s.DisplayName; }
            if (kind == InteractKind.Npc) { var n = Npc(id); return n == null ? null : "[E] Nói chuyện với " + n.Def.Name; }
            if (kind != InteractKind.Aircraft) return null;
            var p = Map.Find(id);
            if (p == null) return null;
            return Missions.Active != null ? "[E] Lên máy bay " + p.DisplayName : "[E] " + p.DisplayName;
        }

        private void Emit(WorldEventKind kind, string npcId, string text) =>
            events.Enqueue(new WorldEvent { Kind = kind, NpcId = npcId, Text = text });
    }
}

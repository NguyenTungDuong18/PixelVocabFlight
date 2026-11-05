using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    public enum Ground { Grass, Dirt, Concrete, Asphalt, Sand, Runway, Water }

    // One model instance on a map. The footprint's top-left tile is (X, Y); Label null means ModelDef.Name.
    public sealed class Placement
    {
        public string Id, Model, Label;
        public Facing Facing;
        public int X, Y;
        public string Tag;

        public ModelDef Def => WorldModels.Get(Model);
        public string DisplayName => Label ?? Def.Name;
    }

    // A non-player character standing on a map. X/Y are the feet in tiles; Dialogue is a DialogueGraph id.
    public sealed class NpcDef
    {
        public string Id, Name, Role, Character, Dialogue;
        public float X, Y;
        public Facing Facing;
    }

    // Named ground area used as a zone label when no building is close (apron, motor pool...).
    public sealed class MapArea
    {
        public string Name;
        public int X, Y, W, H;
        public bool Contains(float x, float y) => x >= X && x < X + W && y >= Y && y < Y + H;
    }

    // Tile map: ground, runway markings, fence, model placements and NPCs. Pure data plus collision queries.
    public sealed class MapDef
    {
        public const string PlayerAircraftTag = "player-aircraft";

        public string Id, Name;
        public int Width, Height;
        public float SpawnX, SpawnY;
        public Facing SpawnFacing = Facing.S;
        // Where the pilot stands after a sortie, next to the aircraft.
        public float AircraftReturnX, AircraftReturnY;
        public Facing AircraftReturnFacing = Facing.S;

        private readonly Ground[] ground;
        private readonly sbyte[] runway;
        private readonly sbyte[] fence;
        private readonly List<Placement> placements = new List<Placement>();
        private readonly List<NpcDef> npcs = new List<NpcDef>();
        private readonly List<MapArea> areas = new List<MapArea>();
        private bool[] solid;

        public MapDef(string id, string name, int width, int height, Ground fill = Ground.Grass)
        {
            if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width));
            Id = id; Name = name; Width = width; Height = height;
            ground = new Ground[width * height];
            runway = new sbyte[width * height];
            fence = new sbyte[width * height];
            for (int i = 0; i < ground.Length; i++) { ground[i] = fill; fence[i] = -1; }
        }

        public IReadOnlyList<Placement> Placements => placements;
        public IReadOnlyList<NpcDef> Npcs => npcs;
        public IReadOnlyList<MapArea> Areas => areas;

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;
        public Ground GroundAt(int x, int y) => InBounds(x, y) ? ground[y * Width + x] : Ground.Grass;
        // 0..4 as tile_runway frames; 0 off the runway.
        public int RunwayVariant(int x, int y) => InBounds(x, y) ? runway[y * Width + x] : 0;
        // -1 no fence, 0..6 as tile_fence frames.
        public int FenceVariant(int x, int y) => InBounds(x, y) ? fence[y * Width + x] : -1;

        // Deterministic variant for plain ground tiles: variant = TileHash(x, y) % frames.
        public static int TileHash(int x, int y)
        {
            unchecked
            {
                uint h = (uint)(x * 73856093) ^ (uint)(y * 19349663);
                h ^= h >> 13; h *= 0x5bd1e995; h ^= h >> 15;
                return (int)(h & 0x7fffffff);
            }
        }

        public static int TileVariant(int x, int y, int frames) => frames <= 1 ? 0 : TileHash(x, y) % frames;

        public (int x, int y, int w, int h) FootprintOf(Placement p)
        {
            var size = WorldModels.Footprint(WorldModels.Get(p.Model), p.Facing);
            return (p.X, p.Y, size.w, size.h);
        }

        // Y-sort key: bottom edge of the footprint (characters use their feet Y).
        public float SortKey(Placement p) => p.Y + FootprintOf(p).h;

        public Placement Find(string id)
        {
            foreach (var p in placements) if (p.Id == id) return p;
            return null;
        }

        public Placement FindTag(string tag)
        {
            foreach (var p in placements) if (p.Tag == tag) return p;
            return null;
        }

        public NpcDef FindNpc(string id)
        {
            foreach (var n in npcs) if (n.Id == id) return n;
            return null;
        }

        public Placement PlacementAt(int x, int y)
        {
            foreach (var p in placements)
            {
                var f = FootprintOf(p);
                if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) return p;
            }
            return null;
        }

        public MapArea AreaAt(float x, float y)
        {
            for (int i = areas.Count - 1; i >= 0; i--) if (areas[i].Contains(x, y)) return areas[i];
            return null;
        }

        // Static blocking: water, fence tiles and solid model footprints. Outside the map is solid.
        public bool SolidTile(int x, int y)
        {
            if (!InBounds(x, y)) return true;
            if (solid == null) BuildSolid();
            return solid[y * Width + x];
        }

        // --- Authoring helpers (used by map builders such as AirbaseMap) ---

        public void SetGround(int x, int y, Ground g) { if (InBounds(x, y)) { ground[y * Width + x] = g; solid = null; } }

        public void FillGround(int x, int y, int w, int h, Ground g)
        {
            for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) SetGround(i, j, g);
        }

        public void SetRunwayVariant(int x, int y, int variant) { if (InBounds(x, y)) runway[y * Width + x] = (sbyte)variant; }

        public void SetFence(int x, int y, int variant) { if (InBounds(x, y)) { fence[y * Width + x] = (sbyte)variant; solid = null; } }

        // Fence ring on the rectangle x0..x1, y0..y1 (inclusive) with proper corner pieces.
        public void FenceRect(int x0, int y0, int x1, int y1)
        {
            for (int x = x0 + 1; x < x1; x++) { SetFence(x, y0, 0); SetFence(x, y1, 0); }
            for (int y = y0 + 1; y < y1; y++) { SetFence(x0, y, 1); SetFence(x1, y, 1); }
            SetFence(x0, y0, 2); SetFence(x1, y0, 3); SetFence(x0, y1, 4); SetFence(x1, y1, 5);
        }

        // Opens `width` tiles of a horizontal fence row starting at x and puts gate posts on both sides.
        public void OpenGate(int x, int y, int width)
        {
            for (int i = x; i < x + width; i++) SetFence(i, y, -1);
            SetFence(x - 1, y, 6); SetFence(x + width, y, 6);
        }

        public Placement Add(Placement p)
        {
            WorldModels.Get(p.Model);
            placements.Add(p); solid = null;
            return p;
        }

        public Placement Add(string id, string model, Facing facing, int x, int y, string label = null, string tag = null) =>
            Add(new Placement { Id = id, Model = model, Facing = facing, X = x, Y = y, Label = label, Tag = tag });

        // Adds the placement only if its footprint is inside the map and touches nothing; used for scattered decoration.
        public bool AddIfFree(string id, string model, Facing facing, int x, int y)
        {
            var size = WorldModels.Footprint(WorldModels.Get(model), facing);
            if (!AreaFree(x, y, size.w, size.h)) return false;
            Add(id, model, facing, x, y);
            return true;
        }

        public bool AreaFree(int x, int y, int w, int h)
        {
            if (x < 0 || y < 0 || x + w > Width || y + h > Height) return false;
            for (int j = y; j < y + h; j++)
                for (int i = x; i < x + w; i++)
                    if (PlacementAt(i, j) != null || FenceVariant(i, j) >= 0 || GroundAt(i, j) == Ground.Water) return false;
            return true;
        }

        public NpcDef AddNpc(NpcDef npc) { npcs.Add(npc); return npc; }

        public MapArea AddArea(string name, int x, int y, int w, int h)
        {
            var area = new MapArea { Name = name, X = x, Y = y, W = w, H = h };
            areas.Add(area);
            return area;
        }

        private void BuildSolid()
        {
            var grid = new bool[Width * Height];
            for (int i = 0; i < grid.Length; i++) grid[i] = ground[i] == Ground.Water || fence[i] >= 0;
            foreach (var p in placements)
            {
                if (!WorldModels.Get(p.Model).Solid) continue;
                var f = FootprintOf(p);
                for (int y = f.y; y < f.y + f.h; y++)
                    for (int x = f.x; x < f.x + f.w; x++)
                        if (InBounds(x, y)) grid[y * Width + x] = true;
            }
            solid = grid;
        }
    }
}

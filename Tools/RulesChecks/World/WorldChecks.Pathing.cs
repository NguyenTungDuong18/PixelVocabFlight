using PixelVocabFlight;
using System.Text.Json;

internal static partial class WorldChecks
{
    private static float Dist(float ax, float ay, float bx, float by) => (float)Math.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

    // Static collision only (tiles, water, fence), for NPC standing spots.
    private static bool StaticBlocked(MapDef map, float x, float y)
    {
        for (int ty = (int)Math.Floor(y - BaseWorld.BodyHalfDepth); ty <= (int)Math.Floor(y + BaseWorld.BodyHalfDepth - 1e-4f); ty++)
            for (int tx = (int)Math.Floor(x - BaseWorld.BodyHalfWidth); tx <= (int)Math.Floor(x + BaseWorld.BodyHalfWidth - 1e-4f); tx++)
                if (map.SolidTile(tx, ty)) return true;
        return false;
    }

    private static readonly (int dx, int dy)[] Steps = { (1, 0), (-1, 0), (0, 1), (0, -1) };

    // Moving between two tile centres is safe if the feet box is free along the segment.
    private static bool Passable(BaseWorld world, int x, int y, int dx, int dy)
    {
        for (int k = 1; k <= 4; k++)
            if (world.Blocked(x + .5f + dx * k * .25f, y + .5f + dy * k * .25f)) return false;
        return true;
    }

    private static int[,] Parents(BaseWorld world, float fromX, float fromY)
    {
        var map = world.Map;
        var parent = new int[map.Width, map.Height];
        for (int x = 0; x < map.Width; x++) for (int y = 0; y < map.Height; y++) parent[x, y] = -2;
        var queue = new Queue<(int x, int y)>();
        int sx = (int)fromX, sy = (int)fromY;
        parent[sx, sy] = -1;
        queue.Enqueue((sx, sy));
        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            foreach (var (dx, dy) in Steps)
            {
                int nx = x + dx, ny = y + dy;
                if (!map.InBounds(nx, ny) || parent[nx, ny] != -2 || !Passable(world, x, y, dx, dy)) continue;
                parent[nx, ny] = y * map.Width + x;
                queue.Enqueue((nx, ny));
            }
        }
        return parent;
    }

    private static bool[,] Reachable(BaseWorld world, float fromX, float fromY)
    {
        var parent = Parents(world, fromX, fromY);
        var reach = new bool[world.Map.Width, world.Map.Height];
        for (int x = 0; x < world.Map.Width; x++) for (int y = 0; y < world.Map.Height; y++) reach[x, y] = parent[x, y] != -2;
        return reach;
    }

    private static (int x, int y)? Goal(BaseWorld world, bool[,] reach, Func<float, float, bool> goal)
    {
        for (int y = 0; y < world.Map.Height; y++)
            for (int x = 0; x < world.Map.Width; x++)
                if (reach[x, y] && goal(x + .5f, y + .5f)) return (x, y);
        return null;
    }

    // Steers the pilot with Tick() along the BFS path from its tile to the nearest goal tile.
    private static bool Walk(BaseWorld world, Func<float, float, bool> goal)
    {
        float startX = world.PlayerX, startY = world.PlayerY;
        var parent = Parents(world, startX, startY);
        var path = new List<(int x, int y)>();
        var queue = new Queue<(int x, int y)>();
        var seen = new HashSet<(int, int)>();
        queue.Enqueue(((int)startX, (int)startY)); seen.Add(((int)startX, (int)startY));
        (int x, int y)? target = null;
        while (queue.Count > 0 && target == null)
        {
            var (x, y) = queue.Dequeue();
            if (goal(x + .5f, y + .5f)) { target = (x, y); break; }
            foreach (var (dx, dy) in Steps)
            {
                int nx = x + dx, ny = y + dy;
                if (world.Map.InBounds(nx, ny) && parent[nx, ny] != -2 && seen.Add((nx, ny)) && parent[nx, ny] == y * world.Map.Width + x) queue.Enqueue((nx, ny));
            }
        }
        if (target == null) return false;
        for (var t = target.Value; ; )
        {
            path.Insert(0, t);
            int p = parent[t.x, t.y];
            if (p < 0) break;
            t = (p % world.Map.Width, p / world.Map.Width);
        }
        const float dt = 1 / 30f;
        float stepLength = BaseWorld.RunSpeed * dt;
        foreach (var tile in path)
        {
            float tx = tile.x + .5f, ty = tile.y + .5f;
            for (int i = 0; i < 200 && Dist(world.PlayerX, world.PlayerY, tx, ty) > .001f; i++)
            {
                float dx = tx - world.PlayerX, dy = ty - world.PlayerY, d = Dist(world.PlayerX, world.PlayerY, tx, ty);
                float scale = 1 / Math.Max(d, stepLength);
                world.Tick(dt, dx * scale, dy * scale, true);
            }
            if (Dist(world.PlayerX, world.PlayerY, tx, ty) > .01f) return false;
        }
        world.Tick(dt, 0, 0, false);
        return goal(world.PlayerX, world.PlayerY);
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class BaseView
    {
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
    }
}

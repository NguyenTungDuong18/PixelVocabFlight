using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class BaseView
    {
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
    }
}

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Hooks used by StoryView: rebuild for another map, staged poses (sitting, gesturing), hidden actors,
    // and a model frozen on one frame (the roof window: closed / open).
    public sealed partial class BaseView
    {
        private readonly Dictionary<string, string> poses = new Dictionary<string, string>();
        private readonly HashSet<string> hiddenActors = new HashSet<string>();

        public bool IsBuilt => built;
        public IReadOnlyCollection<string> MissingNames => missing;
        public string PlacementSpriteName(string id) => placementImages.TryGetValue(id, out var image) && image && image.sprite ? image.sprite.name : "";
        public bool ActorVisible(string id) { var a = actors.Find(x => x.Id == id); return a != null && a.Body && a.Body.gameObject.activeSelf && a.Body.enabled; }

        // Test hook: the model is drawn in the floor layer (under every shadow and character).
        public bool IsFloorItem(string id) => placementImages.TryGetValue(id, out var image) && image && image.transform.parent == floorLayer && floorLayer.GetSiblingIndex() < shadowLayer.GetSiblingIndex();

        // Throws the built map away so Build can run again for another map (domain reload is off: nothing static is kept).
        public void Reset()
        {
            Clear(sortLayer); Clear(shadowLayer); Clear(floorLayer);
            if (ground.texture) Object.Destroy(ground.texture);
            ground.texture = null; ground.color = UiKit.Ink;
            statics.Clear(); staticKeys = System.Array.Empty<float>(); animated.Clear(); actors.Clear(); order.Clear();
            lastSlots.Clear(); lastOrder.Clear(); placementImages.Clear(); dust.Clear(); missing.Clear(); ready.Clear();
            poses.Clear(); hiddenActors.Clear();
            player = null; built = false; FenceImages = 0; PlayerSteps = 0; DustPuffs = 0; GroundMode = "";
        }

        private static void Clear(RectTransform layer)
        {
            // Detach first: the destroyed objects would otherwise still count as siblings until the end of the frame.
            for (int i = layer.childCount - 1; i >= 0; i--) { var child = layer.GetChild(i); child.SetParent(null, false); Object.Destroy(child.gameObject); }
        }

        // The actor ("pilot" = the player) shows this sprite (animated by time) at its world position instead of walk/idle.
        public void SetPose(string actorId, string sprite) { if (sprite == null) poses.Remove(actorId); else poses[actorId] = sprite; }
        public void ClearPoses() => poses.Clear();

        public void HideActor(string id, bool hide)
        {
            var a = actors.Find(x => x.Id == id);
            if (a == null) return;
            if (hide) hiddenActors.Add(id); else hiddenActors.Remove(id);
            a.Body.gameObject.SetActive(!hide); a.Shadow.gameObject.SetActive(!hide);
        }

        // Stops a multi-frame model from cycling and shows one frame (prop_dorm_window: 0 closed, 1 open).
        public void HoldPlacement(string id, int frame)
        {
            if (!placementImages.TryGetValue(id, out var image) || !image) return;
            animated.RemoveAll(a => a.Image == image);
            var p = map.Find(id);
            string sprite = WorldModels.SpriteName(p.Model, p.Facing);
            if (Ready(sprite)) image.sprite = PixelSprites.Get(sprite, frame);
        }

        // Returns true when the actor is hidden or posed (the normal walk/idle logic is skipped).
        private bool UpdatePose(Actor actor, float x, float y)
        {
            if (hiddenActors.Contains(actor.Id)) return true;
            if (!poses.TryGetValue(actor.Id, out var pose) || !Ready(pose)) return false;
            actor.X = x; actor.Y = y; actor.Key = y;
            actor.SpriteName = pose; actor.Body.enabled = true;
            actor.Body.sprite = PixelSprites.At(pose, time);
            Place(actor.Body.rectTransform, pose, x, y);
            if (actor.Shadow.enabled) Place(actor.Shadow.rectTransform, "chr_shadow", x, y);
            actor.WasMoving = actor.WasRunning = false; actor.StridePhase = 0;
            return true;
        }
    }
}

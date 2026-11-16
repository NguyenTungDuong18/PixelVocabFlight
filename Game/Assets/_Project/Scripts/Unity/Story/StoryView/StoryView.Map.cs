using UnityEngine;

namespace PixelVocabFlight
{
    // Map beats (and dialogues drawn over a room): the BaseView in story mode. It is built once per BaseWorld; the next
    // beat on the same map keeps the same world, so nothing respawns. Rooms smaller than the screen are centred on black.
    public sealed partial class StoryView
    {
        private readonly BaseView map;
        private BaseWorld mapWorld;

        public bool MapVisible => map.Visible;
        public BaseWorld World => mapWorld;

        private void ShowMap(StoryBeat beat, BaseWorld world)
        {
            if (world == null) { Debug.LogWarning("Khung " + beat.Id + " cần bản đồ " + beat.Map + " nhưng không có thế giới."); return; }
            if (mapWorld != world || !map.IsBuilt)
            {
                map.Reset();
                map.Build(world, Act0Content.PlayerCharacter);
                mapWorld = world;
                map.HoldPlacement("window", 0);   // prop_dorm_window has 2 frames (closed, open); never cycle them
                StageDormBuilt(world);
            }
            map.Visible = true;
            ApplyStaging(beat, world);
            map.Animate(0, world, false);
        }

        private void HideMap() { if (map != null) map.Visible = false; }

        private void AnimateMap(float dt)
        {
            if (map.Visible && mapWorld != null) map.Animate(dt, mapWorld, Dialogue.Open);
        }
    }
}

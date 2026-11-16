using System;
using System.Collections;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame
    {
        // Text and Cut frames end by themselves: check what is drawn, take the picture, wait for the next frame.
        private IEnumerator SmokeStoryTimed(StoryBeat beat, string shot)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            bool layers = (beat.Layers ?? Array.Empty<string>()).All(l => !PixelSprites.Has(l) || s.HasLayer(l));
            if (beat.Kind == StoryBeatKind.Text) Check(s.PictureVisible || s.TextVisible || beat.Lines.Length == 0, id + "-draws-its-text");
            else Check(s.PictureVisible && layers && (!PixelSprites.Has(beat.Sprite) || s.BackgroundName == beat.Sprite), id + "-draws-picture-and-layers");
            if (beat.Id == "open.P1.06")
            {
                string lid = "cut_open_tin_lid";
                Check(s.CaptionOpen && s.Dialogue.Plain && !s.Dialogue.NamePlateVisible && s.Dialogue.Line == "Anh giữ hết à.", id + "-unnamed-line-in-the-plain-box");
                Check(!PixelSprites.Has(lid) || s.LayerSpriteName(lid) == lid + "_" + (PixelSprites.FrameCount(lid) - 1), id + "-lid-stays-on-its-last-picture");
            }
            if (beat.Id == "open.P1.07")
            {
                storySpeed = 1;   // typing at its real speed
                int before = s.TypedLength, clacks = audioPlayer.ClackCount;
                yield return SmokeUntil(() => s.TypedLength > before + 2, 2);
                Check(smokeOk && s.TextVisible && s.TypedLength < s.FullText.Length && audioPlayer.ClackCount > clacks, id + "-types-one-character-at-a-time");
            }
            float at = Mathf.Max(.8f, Mathf.Min(beat.Seconds * .7f, beat.Seconds - .6f));
            yield return SmokeUntil(() => s.BeatTime >= at || storyRunner.Current != beat, beat.Seconds + 6);
            if (storyRunner.Current == beat)
            {
                if (beat.Id == "open.P1.04") { string hand = "cut_open_tin_hand"; Check(!PixelSprites.Has(hand) || s.LayerSpriteName(hand) == hand + "_" + (PixelSprites.FrameCount(hand) - 1), id + "-hand-rests-on-the-lid"); }
                SmokeCapture(shot);
            }
            yield return SmokeUntil(() => storyRunner.Current != beat, beat.Seconds + 6);
            Check(smokeOk, id + "-ends-by-itself");
            storySpeed = 5;
        }

        // m1.P1.01: the room opens from black and the player cannot move for four seconds.
        private IEnumerator SmokeStoryLocked(StoryBeat beat, string shot)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            Check(s.MapVisible && s.Map.IsBuilt && storyWorld != null && storyWorld.Map.Id == beat.Map && storyWorld.LockPlayer, id + "-room-shown-and-locked");
            Check(s.Map.GroundMode == "cpu" || s.Map.MissingNames.Contains("tile_floor_wood"), id + "-floor-composed:" + s.Map.GroundMode);
            Check(s.Map.MissingNames.Count > 0 || s.Map.PlacementImages == storyWorld.Map.Placements.Count, id + "-every-model-drawn:" + s.Map.PlacementImages + "/" + storyWorld.Map.Placements.Count);
            Check(s.Map.CameraPosition.x < 0 && s.Map.CameraPosition.y < 0, id + "-room-centred-on-black:" + s.Map.CameraPosition);
            float x0 = storyWorld.PlayerX;
            InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.D));
            float from = Time.unscaledTime;
            while (Time.unscaledTime - from < .2f) yield return null;
            InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null;
            Check(Mathf.Abs(storyWorld.PlayerX - x0) < .01f, id + "-pilot-cannot-walk-while-locked");
            yield return SmokeUntil(() => s.HintVisible, 2);
            Check(smokeOk && s.HintText == beat.Hint, id + "-hint-line-shown");
            yield return SmokeUntil(() => s.BeatTime >= 1.8f || storyRunner.Current != beat, 6);
            if (storyRunner.Current == beat) SmokeCapture(shot);
            yield return SmokeUntil(() => storyRunner.Current != beat, 8);
            Check(smokeOk, id + "-hands-over-control-by-itself");
        }

        // Map frames with objects: stand by each one, prompt, E, read its dialogue (close-up behind it when it has one).
        private IEnumerator SmokeStoryObjects(StoryBeat beat)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            yield return SmokeUntil(() => s.BeatTime >= StoryInputLock + .05f, 3);
            if (beat.Id == "m1.P1.02")
            {
                float x0 = storyWorld.PlayerX;
                InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.D));
                float from = Time.unscaledTime;
                while (Time.unscaledTime - from < .25f) yield return null;
                InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null; yield return null;
                Check(storyWorld.PlayerX > x0 + .5f && storyWorld.PlayerFacing == Facing.E, id + "-wasd-walks-once-unlocked");
                yield return SmokeKey(Key.Escape);
                Check(mode == Mode.Story && storyPaused && view.Menu.Visible && view.Menu.PageTitle == "Tạm dừng", id + "-esc-opens-the-pause-panel");
                yield return SmokeKey(Key.Escape);
                Check(mode == Mode.Story && !storyPaused && !view.Menu.Visible && Time.timeScale == 1 && !view.OverlayVisible, id + "-esc-again-resumes");
                Check(s.HintVisible && s.HintText == beat.Hint, id + "-hint-line-shown");
            }
            if (beat.Id == "m1.P1.02") yield return SmokeStoryLayers();
            bool first = true;
            foreach (var spot in beat.Hotspots)
            {
                bool placed = SmokeStandNear(spot.Id);
                yield return null; yield return null;
                Check(placed && s.Map.PromptVisible && s.Map.PromptLabel.StartsWith("[E] Xem"), id + "-" + spot.Id + "-prompt-near-object:" + s.Map.PromptLabel);
                yield return SmokeKey(Key.E);
                yield return SmokeUntil(() => storyDialogue.Open, 3);
                Check(smokeOk && s.Dialogue.Open && (spot.Cut == null || s.CloseUpName == spot.Cut), id + "-" + spot.Id + "-opens-its-dialogue");
                if (first) Check(s.Dialogue.Plain && !s.Dialogue.NamePlateVisible, id + "-narration-uses-the-plain-box");
                yield return SmokeReadDialogue(first ? "story-" + beat.Id + ".png" : null, 0);
                first = false;
                yield return SmokeUntil(() => !s.Dialogue.Open, 3);
                Check(!s.CloseUpVisible, id + "-" + spot.Id + "-close-up-hidden-after");
            }
            yield return SmokeUntil(() => storyRunner.Current != beat, 8);
            Check(smokeOk, id + "-ends-when-every-object-seen");
        }

        // m1.P1.12: Daan walks to the window and climbs out; the player follows by using the window.
        private IEnumerator SmokeStoryWindow(StoryBeat beat, string shot)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            var daan = storyWorld.Npc(DormRoomMap.DaanId);
            Check(daan.Walking && !storyWorld.LockPlayer, id + "-daan-sets-off-for-the-window");
            yield return SmokeUntil(() => !daan.Walking, 10);
            Check(smokeOk && Mathf.Abs(daan.X - DormRoomMap.DaanWindowRoute[1].x) < .05f && Mathf.Abs(daan.Y - DormRoomMap.DaanWindowRoute[1].y) < .05f, id + "-daan-reaches-the-window");
            yield return null; yield return null;
            bool openFrame = !PixelSprites.Has("prop_dorm_window") || PixelSprites.FrameCount("prop_dorm_window") < 2 || s.Map.PlacementSpriteName("window").EndsWith("_1");
            Check(!s.Map.ActorVisible(DormRoomMap.DaanId) && openFrame, id + "-daan-climbs-out-and-the-window-stands-open:" + s.Map.PlacementSpriteName("window"));
            Check(s.HintVisible && s.HintText == beat.Hint, id + "-hint-line-shown");
            SmokeCapture(shot);
            bool placed = SmokeStandNear("window");
            yield return null; yield return null;
            Check(placed && s.Map.PromptVisible && s.Map.PromptLabel.StartsWith("[E] Xem"), id + "-window-prompt:" + s.Map.PromptLabel);
            yield return SmokeUntil(() => s.BeatTime >= StoryInputLock + .05f, 3);
            yield return SmokeKey(Key.E);
            yield return SmokeUntil(() => storyRunner.Current != beat, 8);
            Check(smokeOk, id + "-window-leads-out-to-the-roof");
        }

        // m1.P1.13: pick each far object with A/D and look at it.
        private IEnumerator SmokeStoryVista(StoryBeat beat, string shot)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            Check(s.PictureVisible && s.HotspotCount == beat.Hotspots.Length && s.SelectedHotspot == beat.Hotspots[0].Id && (!PixelSprites.Has(beat.Sprite) || s.BackgroundName == beat.Sprite), id + "-roof-with-three-far-objects");
            yield return SmokeUntil(() => s.BeatTime >= StoryInputLock + .05f && s.HintVisible, 3);
            Check(smokeOk && s.HintText == beat.Hint && s.SelectedLabelText.StartsWith("[E] Xem"), id + "-hint-and-cursor-label");
            SmokeCapture(shot);
            for (int i = 0; i < beat.Hotspots.Length; i++)
            {
                var spot = beat.Hotspots[i];
                Check(s.SelectedHotspot == spot.Id, id + "-d-selects-" + spot.Id);
                yield return SmokeKey(Key.E);
                yield return SmokeUntil(() => storyDialogue.Open, 3);
                Check(smokeOk, id + "-" + spot.Id + "-opens-its-dialogue");
                if (i == 0) Check(s.Dialogue.BoxCentreY < StoryLayout.Height / 2 && !s.HotspotsVisible, id + "-dialogue-box-at-top-and-hotspot-frames-hidden:" + s.Dialogue.BoxTop);
                yield return SmokeReadDialogue(i == 0 ? "story-" + beat.Id + "-dialogue.png" : null, 0);
                if (i == 0) { yield return SmokeUntil(() => s.HotspotsVisible, 2); Check(smokeOk, id + "-hotspot-frames-return-after-the-dialogue"); }
                if (i + 1 < beat.Hotspots.Length) yield return SmokeKey(Key.D);
            }
            yield return SmokeUntil(() => storyRunner.Current != beat, 8);
            Check(smokeOk, id + "-ends-when-every-object-seen");
        }

        // Dialogue frames (over the room or the roof) and the last vista: the dialogue is open from the first moment.
        private IEnumerator SmokeStoryTalk(StoryBeat beat, string shot)
        {
            var s = view.Story;
            string id = "story-" + beat.Id;
            yield return SmokeUntil(() => storyDialogue.Open, 3);
            bool room = beat.Map != null;
            bool layers = (beat.Layers ?? Array.Empty<string>()).All(l => !PixelSprites.Has(l) || s.HasLayer(l));
            Check(smokeOk && (room ? s.MapVisible : s.PictureVisible && layers), id + "-dialogue-over-" + (room ? "the-room" : "the-picture"));
            bool jonas = Act0Content.SpeakerName(storyDialogue.Speaker) == "Jonas";
            if (jonas) Check(s.Dialogue.SpeakerName == "Jonas" && !s.Dialogue.Plain && (!PixelSprites.Has("portrait_pilot_young") || s.Dialogue.PortraitName.StartsWith("portrait_pilot_young")), id + "-jonas-name-and-portrait");
            if (beat.Id == "m1.P1.06")
            {
                Check(s.Dialogue.ChoiceCount == 2 && s.Dialogue.Plain, id + "-offers-keep-telling-or-stop");
                Check(Mathf.Abs(storyWorld.PlayerX - StoryView.SeatX) < .05f && (!PixelSprites.Has(StoryView.JonasSit) || s.Map.PlayerSpriteName.StartsWith(StoryView.JonasSit)), id + "-jonas-sits-on-the-bed:" + s.Map.PlayerSpriteName);
                Check(!PixelSprites.Has(StoryView.DaanSit) || s.Map.NpcSpriteName(DormRoomMap.DaanId).StartsWith(StoryView.DaanSit), id + "-daan-sits:" + s.Map.NpcSpriteName(DormRoomMap.DaanId));
            }
            if (beat.Id == "m1.P1.07") Check(s.Dialogue.Line.StartsWith("Chú bay giỏi.") && jonas, id + "-jonas-line-verbatim");
            if (beat.Id == "m1.P1.09") Check(!PixelSprites.Has(StoryView.JonasHands) || s.Map.PlayerSpriteName.StartsWith(StoryView.JonasHands), id + "-jonas-hands-fly-the-plane:" + s.Map.PlayerSpriteName);
            // Box at the bottom over a room, at the top over a picture (the characters lie at the bottom of the roof picture).
            Check(room == (s.Dialogue.BoxCentreY > StoryLayout.Height / 2), id + "-dialogue-box-position-follows-the-background:" + s.Dialogue.BoxTop);
            // Long choices: wide row, wrapped, same text size as the short one (never shrunk).
            if (beat.Id == "m1.P1.10") Check(s.Dialogue.ChoiceCount == 2 && s.Dialogue.ChoiceFontSize(0) == s.Dialogue.ChoiceFontSize(1) && s.Dialogue.ChoiceFontSize(0) >= 16
                && s.Dialogue.ChoiceWidth(0) >= 1000 && s.Dialogue.ChoiceHeight(0) >= s.Dialogue.ChoiceHeight(1), id + "-long-choice-keeps-its-text-size:" + s.Dialogue.ChoiceFontSize(0) + "/" + s.Dialogue.ChoiceFontSize(1) + " w" + s.Dialogue.ChoiceWidth(0) + " h" + s.Dialogue.ChoiceHeight(0) + "/" + s.Dialogue.ChoiceHeight(1));
            yield return SmokeReadDialogue(shot, 0);
            yield return SmokeUntil(() => storyRunner.Current != beat, 8);
            Check(smokeOk, id + "-ends-when-the-dialogue-closes");
            if (beat.Id == "m1.P1.10") Check(storyFlags.Get(Act0Content.PrideFlag) == Act0Content.PrideStep, id + "-first-tone-raises-pride");
        }

        // The three layers of the room: wall items hang on the wall (drawn after the back wall, before every character, never
        // block the row y=2 under them); the rug is a floor item under every shadow and character and never blocks.
        private IEnumerator SmokeStoryLayers()
        {
            var s = view.Story;
            var map = storyWorld.Map;
            storyWorld.PlacePlayer(2f, 2.4f, Facing.N);
            yield return null; yield return null; yield return null;
            int wall = s.Map.PlacementDrawIndex("wall_back"), item = s.Map.PlacementDrawIndex("wall_mailmap"), player = s.Map.PlayerDrawIndex;
            Check(map.Find("wall_mailmap").Layer == PlacementLayer.Wall && (wall < 0 || item < 0 || (item > wall && player > item)), "story-wall-item-drawn-after-the-wall-and-behind-the-pilot:" + wall + "/" + item + "/" + player);
            Check(!storyWorld.Blocked(2f, 2.4f) && !storyWorld.Blocked(6.5f, 2.3f) && !storyWorld.Blocked(10.5f, 2.3f), "story-row-under-the-wall-items-is-walkable");
            storyWorld.PlacePlayer(6.5f, 3.3f, Facing.N);
            yield return null; yield return null;
            Check(map.Find("rug").Layer == PlacementLayer.Floor && (!s.Map.HasPlacement("rug") || s.Map.IsFloorItem("rug")) && !storyWorld.Blocked(6.5f, 3.3f), "story-rug-is-a-floor-item-under-the-pilot");
            Check(s.Map.PlacementDrawIndex("wall_mailmap") >= 0 && s.Map.PlacementSpriteName("window").Length >= 0, "story-wall-items-built");
        }

        private IEnumerator SmokeStoryEnd(string shot)
        {
            var s = view.Story;
            Check(s.EndVisible && s.EndText == Act0Content.EndCardText, "story-end-card-text");
            yield return SmokeUntil(() => s.BeatTime > .7f, 3);
            SmokeCapture(shot);
            yield return SmokeKey(Key.Enter);
            yield return SmokeUntil(() => mode == Mode.Menu, 8);
            Check(smokeOk && view.Menu.Visible && !view.Story.Visible, "story-end-enter-returns-to-the-main-menu");
        }

        // The second tone of P1.10: a fresh run, skip to the frame (fast, no checks on the way), choose the other line.
        private IEnumerator SmokeStoryOtherChoice()
        {
            var s = view.Story;
            storySpeed = 40;
            EnterStory();
            for (int guard = 0; guard < 900 && storyRunner.Current != null && storyRunner.Current.Id != "m1.P1.10"; guard++)
            {
                if (!s.Transitioning && s.Current == storyRunner.Current) storyRunner.Advance();
                yield return null;
            }
            yield return SmokeUntil(() => storyRunner.Current != null && storyRunner.Current.Id == "m1.P1.10" && s.Current == storyRunner.Current && !s.Transitioning && storyDialogue.Open && s.BeatTime >= StoryInputLock + .05f, 8);
            Check(smokeOk && s.Dialogue.ChoiceCount == 2 && storyFlags.Get(Act0Content.PrideFlag) == 0, "story-m1-p110-second-run-reaches-the-choice");
            yield return SmokeKey(Key.Digit2);
            Check(storyFlags.Get(Act0Content.PrideFlag) == -Act0Content.PrideStep, "story-m1-p110-second-tone-lowers-pride");
            yield return SmokeUntil(() => !s.Dialogue.Typing, 3);
            Check(s.Dialogue.Line.StartsWith("Cậu sẽ đỗ.") && s.Dialogue.SpeakerName == "Jonas", "story-m1-p110-jonas-says-the-second-line");
            yield return SmokeKey(Key.E);
            yield return SmokeUntil(() => !s.Dialogue.Typing, 3);
            Check(s.Dialogue.Line == "Cậu tin hộ tớ đi." && s.Dialogue.SpeakerName == "Daan", "story-m1-p110-daan-answers-the-second-line");
        }
    }
}

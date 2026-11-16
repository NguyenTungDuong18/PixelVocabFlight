using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame
    {
        // Story (Act 0): plays all 24 frames with fake input after the old stages (which start from the airbase).
        // Every frame: entered in order, drawn as its kind says, one screenshot story-<id>.png. Sprites that are not
        // forged yet are only listed (story-sprites-missing:N), they never fail a check. Both choices of P1.10 are played.
        private IEnumerator SmokeStory()
        {
            smokeDeadline += 100; storySpeed = 5;
            EnterStory();
            yield return null; yield return null;
            var shellRect = view.ShellScreenRect;
            Check(Mathf.Abs(shellRect.width / shellRect.height - 16f / 9f) < .02f && shellRect.width <= Screen.width + 1 && shellRect.height <= Screen.height + 1, "story-keeps-16-9-with-black-bars:" + shellRect.width.ToString("0") + "x" + shellRect.height.ToString("0") + " in " + Screen.width + "x" + Screen.height);
            var script = Act0Content.Script;
            Check(mode == Mode.Story && view.Story.Visible && !view.Base.Visible && !view.OverlayVisible && script.Count == 24, "story-mode-starts-with-24-frames:" + script.Count);
            for (int i = 0; i < script.Count; i++)
            {
                var beat = script[i];
                yield return SmokeUntil(() => storyRunner.Current == beat && view.Story.Current == beat && !view.Story.Transitioning, 20);
                bool entered = smokeOk && storyRunner.Index == i;
                Check(entered, "story-" + beat.Id + "-entered");
                if (!entered) break;
                SmokeStorySounds(beat);
                yield return SmokeStoryBeat(beat);
            }
            var missing = view.Story.MissingSprites;
            if (missing.Count > 0)
            {
                Debug.LogWarning("Màn truyện thiếu " + missing.Count + " sprite: " + string.Join(", ", missing));
                File.WriteAllText(Path.Combine(smokeOutput, "story-missing-sprites.txt"), string.Join("\n", missing));
            }
            Check(true, "story-sprites-missing:" + missing.Count);
            yield return SmokeStoryOtherChoice();
            storySpeed = 1;
        }

        private IEnumerator SmokeStoryBeat(StoryBeat beat)
        {
            string shot = "story-" + beat.Id + ".png";
            bool objects = beat.Hotspots != null && beat.Hotspots.Length > 0;
            switch (beat.Kind)
            {
                case StoryBeatKind.Text:
                case StoryBeatKind.Cut: yield return SmokeStoryTimed(beat, shot); break;
                case StoryBeatKind.Map:
                    if (beat.Seconds > 0) yield return SmokeStoryLocked(beat, shot);
                    else if (objects) yield return SmokeStoryObjects(beat);
                    else yield return SmokeStoryWindow(beat, shot);
                    break;
                case StoryBeatKind.Vista:
                    if (objects) yield return SmokeStoryVista(beat, shot); else yield return SmokeStoryTalk(beat, shot);
                    break;
                case StoryBeatKind.Dialogue: yield return SmokeStoryTalk(beat, shot); break;
                case StoryBeatKind.End: yield return SmokeStoryEnd(shot); break;
            }
        }

        // The order of the sounds is part of the script (rain before the radio goes off, silence before the frogs...).
        private void SmokeStorySounds(StoryBeat beat)
        {
            var a = audioPlayer;
            switch (beat.Id)
            {
                case "open.P1.01": Check(!a.StoryLoopOn("rain") && !a.StoryLoopOn("radio") && !a.StoryLoopOn("frogs"), "story-open-p101-no-sound-at-all"); break;
                case "open.P1.02": Check(a.StoryLoopOn("rain") && a.StoryLoopOn("radio"), "story-open-p102-rain-and-radio-start"); break;
                case "open.P1.04": Check(a.LastStorySound == "tin_touch" && a.StoryLoopOn("rain"), "story-open-p104-tin-touch-over-rain"); break;
                case "open.P1.05": Check(a.LastStorySound == "tin_open", "story-open-p105-tin-opens"); break;
                case "open.P1.06": Check(!a.StoryLoopOn("radio") && a.StoryLoopOn("rain"), "story-open-p106-radio-off-rain-stays"); break;
                case "open.P1.07": Check(!a.StoryLoopOn("rain") && !a.StoryLoopOn("radio") && !a.StoryLoopOn("frogs"), "story-open-p107-rain-cuts-out-silence"); break;
                case "m1.P1.01": Check(a.StoryLoopOn("frogs") && a.StoryLoopOn("clock") && !a.StoryLoopOn("rain"), "story-m1-p101-frogs-and-clock"); break;
                case "m1.P1.04": Check(a.LastStorySound == "note", "story-m1-p104-one-note"); break;
                case "m1.P1.05": Check(a.LastStorySound == "cloth", "story-m1-p105-cloth"); break;
                case "m1.P1.06": Check(a.StoryLoopOn("frogs") && a.StoryLoopTarget("frogs") < .2f, "story-m1-p106-frogs-go-quiet"); break;
                case "m1.P1.12": Check(!a.StoryLoopOn("clock") && a.StoryLoopOn("frogs") && a.StoryLoopOn("wind"), "story-m1-p112-clock-off-wind-on"); break;
                case "m1.P1.15": Check(a.LastStorySound == "note", "story-m1-p115-one-note"); break;
                case "m1.P1.16": Check(!a.StoryLoopOn("frogs") && a.StoryLoopOn("drone"), "story-m1-p116-frogs-stop-drone-rises"); break;
                case "end": Check(!a.StoryLoopOn("drone"), "story-end-drone-off"); break;
            }
        }

        // Reads the open dialogue to its end: wait for the line, one screenshot, then E or the choice number.
        private IEnumerator SmokeReadDialogue(string shot, int pick)
        {
            yield return SmokeUntil(() => view.Story.BeatTime >= StoryInputLock + .05f, 3);
            for (int guard = 0; guard < 60 && storyDialogue.Open; guard++)
            {
                yield return SmokeUntil(() => !view.Story.Dialogue.Typing || !storyDialogue.Open, 3);
                if (!storyDialogue.Open) break;
                if (shot != null) { SmokeCapture(shot); shot = null; }
                if (view.Story.Dialogue.ChoiceCount > 0) yield return SmokeKey(StoryDigits[pick]); else yield return SmokeKey(Key.E);
            }
        }

        // Puts the pilot where the prompt of a "story:<id>" object shows (a free spot near its footprint).
        private bool SmokeStandNear(string storyId)
        {
            var p = storyWorld.Map.FindTag(BaseWorld.StoryTagPrefix + storyId);
            if (p == null) return false;
            var spots = new List<(float d, float x, float y)>();
            for (float y = 2f; y <= 9.5f; y += .25f)
                for (float x = 1f; x <= 12.9f; x += .25f)
                {
                    if (storyWorld.Blocked(x, y)) continue;
                    float d = storyWorld.DistanceToFootprint(p, x, y);
                    if (d <= 1.2f) spots.Add((d, x, y));
                }
            spots.Sort((a, b) => a.d.CompareTo(b.d));
            foreach (var spot in spots)
            {
                storyWorld.PlacePlayer(spot.x, spot.y, Facing.N);
                if (storyWorld.NearestKind == InteractKind.Story && storyWorld.NearestId == storyId) return true;
            }
            return false;
        }
    }
}

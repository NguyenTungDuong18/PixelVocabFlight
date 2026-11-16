using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame
    {
        // ---------------- Story (Act 0): the game starts here ----------------
        // StoryRunner (Logic/Story) decides which frame is current; StoryView draws it. This file owns input and sound:
        // WASD/Shift walk and E/Space/Enter use an object in a room; A/D or the mouse pick a far object, E uses it; in a
        // dialogue E/Space/Enter/click continue (or show the whole line), 1-9 or W/S + E choose. Esc: the pause panel.
        private const float StoryInputLock = .3f;   // keys count this long after a frame has appeared
        private static readonly Key[] StoryDigits = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6, Key.Digit7, Key.Digit8, Key.Digit9 };
        private static readonly Key[] StoryNumpad = { Key.Numpad1, Key.Numpad2, Key.Numpad3, Key.Numpad4, Key.Numpad5, Key.Numpad6, Key.Numpad7, Key.Numpad8, Key.Numpad9 };
        private StoryRunner storyRunner;
        private StoryFlags storyFlags;
        private BaseWorld storyWorld;
        private string storyMapId;
        private DialogueRunner storyDialogue;
        // 1 normally; the smoke test raises it so the 27 s of timed frames pass quickly (fades, timers, typing, walking).
        private float storySpeed = 1;
        private int storySeenSteps;
        private Vector2 storyMouse;

        // start null: from the first beat; a snapshot (a save, a segment from the list) restores its flags and jumps to its beat.
        // slot: the save slot to keep writing (-1 = trial, nothing is saved).
        private void EnterStory(StorySnapshot start = null, int slot = -1, float playSeconds = 0)
        {
            storySlot = slot; storyPlaySeconds = playSeconds; storyPaused = false;
            SetMode(Mode.Story); Time.timeScale = 1; Cursor.visible = true; typed = "";
            if (audioPlayer) { audioPlayer.Pause(false); audioPlayer.Stop(); }
            speech.Clear(); view.Board.Clear(); flight = null; view.FinishIntro(); view.HideOverlay();
            if (dialogue.Open) CloseDialogue(); else view.Dialogue.Hide();
            view.Story.Reset();
            StartStory(start);
        }

        // A new runner from the first frame; the first BeatStarted event makes the view fade in.
        private void StartStory(StorySnapshot start = null)
        {
            storyFlags = new StoryFlags();
            storyRunner = new StoryRunner(Act0Content.Script, storyFlags);
            storyDialogue = new DialogueRunner(Act0Content.Dialogues);
            if (start != null) storyRunner.Restore(start);   // flags + jump (queued events are replaced: BeatStarted, SegmentStarted)
            storyWorld = null; storyMapId = null;
            if (audioPlayer) audioPlayer.StopStory();
            view.Story.OnSwap = EnterStoryBeat; view.Story.Seen = id => storyRunner.Seen(id);
            view.Story.Dialogue.Hide(); view.Story.HideCloseUp();
            EventSystem.current?.SetSelectedGameObject(null);
        }

        private void UpdateStory()
        {
            var s = view.Story;
            float dt = Mathf.Min(Time.unscaledDeltaTime, 1 / 30f) * storySpeed;   // capped like the flight intro (hitches never skip a frame)
            // Esc: the pause panel (the story stands still; the ambient loops go on). Esc again or Tiếp tục resumes.
            if (storyPaused) { view.Menu.AnimateRows(dt); MenuInput(); return; }
            if (keyboard != null && keyboard.escapeKey.wasPressedThisFrame) { OpenPause(); return; }
            storyPlaySeconds += Mathf.Min(Time.unscaledDeltaTime, .1f);
            DrainStoryEvents();
            s.Animate(dt);
            int letters = s.Dialogue.Animate(dt);
            blipTimer -= dt;
            if (letters > 0 && storyDialogue.Open && blipTimer <= 0) { audioPlayer.Blip(StoryBlipPitch(storyDialogue.Speaker)); blipTimer = .07f; }
            if (s.TypedThisFrame > 0) audioPlayer.Clack();
            var beat = storyRunner.Current;
            // While fading, or while the view still shows the previous frame, nothing reacts.
            if (beat == null || s.Transitioning || s.Current != beat) return;
            bool ready = s.BeatTime >= StoryInputLock, wasOpen = storyDialogue.Open;
            if (storyWorld != null && beat.Map != null) UpdateStoryWorld(beat, dt, wasOpen, ready);
            if (wasOpen) { if (ready) HandleStoryDialogueKeys(); return; }
            if (storyDialogue.Open) return;   // an object's dialogue has just opened
            if (beat.Seconds > 0)
            {
                if (s.BeatTime >= beat.Seconds) storyRunner.Advance();
                return;
            }
            if (beat.Kind == StoryBeatKind.Vista) UpdateStoryVista(ready);
            else if (beat.Kind == StoryBeatKind.End) { if (s.BeatTime > .6f && Pressed(Key.Enter, Key.NumpadEnter, Key.E, Key.Space)) LeaveStory(); }
            else if ((beat.Kind == StoryBeatKind.Text || beat.Kind == StoryBeatKind.Cut) && ready && Pressed(Key.Enter, Key.NumpadEnter, Key.E, Key.Space)) storyRunner.Advance();
        }

        private static float StoryBlipPitch(string speaker) => speaker == "daan" ? .95f : speaker == "jonas" ? 1.15f : .7f;

        private void DrainStoryEvents()
        {
            while (storyRunner.PopEvent(out var e))
            {
                switch (e.Kind)
                {
                    case StoryEventKind.BeatStarted: view.Story.Begin(e.Beat); break;
                    case StoryEventKind.Toast: view.Story.ShowToast(e.Text); break;
                    case StoryEventKind.SegmentStarted:
                        // A new segment: save (slots only) and, in trial mode, name it in the corner.
                        view.Story.SetBadge(storySlot < 0 ? "CHƠI THỬ · " + e.Segment.Number + "  " + e.Segment.Title : "");
                        SaveStory();
                        break;
                }
            }
        }

        // Called by the view in the middle of the fade: set up the world, the sounds and the dialogue of the frame.
        private void EnterStoryBeat(StoryBeat beat)
        {
            if (beat.Map != null)
            {
                if (storyWorld == null || storyMapId != beat.Map)
                {
                    var map = Act0Content.Map(beat.Map);
                    if (map == null) Debug.LogError("Khung " + beat.Id + ": không có bản đồ " + beat.Map);
                    else
                    {
                        storyWorld = new BaseWorld(map, new MissionLog(BaseContent.Missions)) { StoryActive = id => storyRunner.Active(id) };
                        storyMapId = beat.Map; storySeenSteps = 0;
                    }
                }
                if (storyWorld != null) storyWorld.LockPlayer = beat.LockPlayer || beat.Kind == StoryBeatKind.Dialogue;
            }
            else { storyWorld = null; storyMapId = null; }
            storyDialogue.Close();
            view.Story.Dialogue.Hide(); view.Story.HideCloseUp();
            view.Story.Show(beat, storyWorld);
            if (beat.Sounds != null) foreach (var sound in beat.Sounds) audioPlayer.StorySound(sound);
            if (beat.Dialogue != null) OpenStoryDialogue(beat.Dialogue, null);
        }

        private void UpdateStoryWorld(StoryBeat beat, float dt, bool dialogueOpen, bool ready)
        {
            float x = 0, y = 0; bool run = false;
            bool control = beat.Kind == StoryBeatKind.Map && !dialogueOpen;
            if (control)
            {
                x = (Held(Key.D, Key.RightArrow) ? 1 : 0) - (Held(Key.A, Key.LeftArrow) ? 1 : 0);
                y = (Held(Key.S, Key.DownArrow) ? 1 : 0) - (Held(Key.W, Key.UpArrow) ? 1 : 0);
                run = Held(Key.LeftShift, Key.RightShift);
            }
            storyWorld.Tick(dt, x, y, run);
            if (control && ready && Pressed(Key.E, Key.Space, Key.Enter, Key.NumpadEnter)) storyWorld.Interact();
            WorldEvent e;
            while ((e = storyWorld.PopEvent()) != null)
            {
                if (e.Kind == WorldEventKind.StoryInteract) UseStoryObject(e.EntityId);
                else if (e.Kind == WorldEventKind.NpcArrived) view.Story.OnNpcArrived(e.NpcId);
            }
            int steps = view.Story.Map.PlayerSteps;
            if (steps != storySeenSteps)
            {
                if (steps > storySeenSteps && storyWorld.Moving) audioPlayer.Footstep(storyWorld.Running);
                storySeenSteps = steps;
            }
        }

        private void UpdateStoryVista(bool ready)
        {
            var s = view.Story;
            if (s.HotspotCount == 0) return;
            if (Pressed(Key.A, Key.LeftArrow)) s.MoveHotspot(-1);
            if (Pressed(Key.D, Key.RightArrow)) s.MoveHotspot(1);
            bool click = false;
            if (Mouse.current != null)
            {
                var position = Mouse.current.position.ReadValue();
                if (position != storyMouse) { storyMouse = position; s.SelectHotspot(s.HotspotAt(position)); }
                click = Mouse.current.leftButton.wasPressedThisFrame && s.HotspotAt(position) >= 0;
            }
            if (ready && (click || Pressed(Key.E, Key.Space, Key.Enter, Key.NumpadEnter))) UseStoryObject(s.SelectedHotspot);
        }

        // The player used an object of the frame (room object, far hotspot or the exit): the runner says what to open.
        private void UseStoryObject(string id)
        {
            if (id == null) return;
            string cut = storyRunner.CutFor(id), graph = storyRunner.Interact(id);
            if (graph != null) OpenStoryDialogue(graph, cut);
        }

        private void OpenStoryDialogue(string graphId, string cut)
        {
            try { storyDialogue.Start(graphId, storyFlags.Condition); }
            catch (KeyNotFoundException exception) { Debug.LogWarning(exception.Message); storyRunner.DialogueClosed(); return; }
            if (!storyDialogue.Open) { storyRunner.DialogueClosed(); return; }
            view.Story.ShowCloseUp(cut);
            ShowStoryNode();
        }

        // A node that only continues shows no choice rows (the "next" arrow); a real choice shows its rows.
        private void ShowStoryNode()
        {
            string speaker = storyDialogue.Speaker;
            var choices = storyDialogue.Choices;
            if (Act0Content.IsContinueOnly(choices)) choices = Array.Empty<DialogueChoice>();
            view.Story.Dialogue.Show(Act0Content.SpeakerName(speaker), Act0Content.SpeakerCharacter(speaker), storyDialogue.Text(null), choices, string.IsNullOrEmpty(speaker));
        }

        private void HandleStoryDialogueKeys()
        {
            if (keyboard == null) return;
            var d = view.Story.Dialogue;
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame && d.ChoiceCount == 0)
            {
                if (d.Typing) d.Reveal(); else ChooseStoryDialogue(0);
                return;
            }
            for (int i = 0; i < StoryDigits.Length; i++)
                if (Pressed(StoryDigits[i], StoryNumpad[i])) { if (d.Typing) d.Reveal(); else if (d.ChoiceCount > 0) ChooseStoryDialogue(i); return; }
            if (Pressed(Key.W, Key.UpArrow)) d.MoveSelection(-1);
            if (Pressed(Key.S, Key.DownArrow)) d.MoveSelection(1);
            if (Pressed(Key.E, Key.Space, Key.Enter, Key.NumpadEnter))
            {
                if (d.Typing) d.Reveal(); else ChooseStoryDialogue(d.Selected);
            }
        }

        // Choice button, digit or W/S + E. Flag actions ("flag.add:pride=1") apply before the next node is shown.
        private void ChooseStoryDialogue(int index)
        {
            var d = view.Story.Dialogue;
            if (!storyDialogue.Open || d.Typing) return;
            var choices = storyDialogue.Choices;
            if (choices.Count == 0) storyDialogue.Close();
            else
            {
                if (Act0Content.IsContinueOnly(choices)) index = 0;
                if (index < 0 || index >= choices.Count) return;
                storyDialogue.Choose(index, action => storyFlags.Apply(action));
            }
            EventSystem.current?.SetSelectedGameObject(null);
            if (storyDialogue.Open) ShowStoryNode(); else CloseStoryDialogue();
        }

        private void CloseStoryDialogue()
        {
            storyDialogue.Close();
            view.Story.Dialogue.Hide(); view.Story.HideCloseUp();
            EventSystem.current?.SetSelectedGameObject(null);
            storyRunner.DialogueClosed();
        }
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame : MonoBehaviour
    {
        // ---------------- Base: walking, talking, boarding ----------------
        // WASD / arrows walk, Shift runs, E / Space / Enter interact. In a dialogue: 1-9 pick, W/S + E/Enter/Space
        // confirm (or show the whole line while it is still typing), Esc closes. Esc alone does nothing here.
        private void UpdateBase(bool escape)
        {
            float delta = Mathf.Min(Time.unscaledDeltaTime, .1f);
            // Title card: any key or click fades it out; the pilot can already walk while it fades.
            if (view.Base.TitleVisible && !view.Base.TitleDismissing)
            {
                bool click = Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame;
                if ((keyboard != null && keyboard.anyKey.wasPressedThisFrame) || click) view.Base.DismissTitle();
                world.Tick(delta, 0, 0, false);
                view.Base.Animate(delta, world, false);
                nextSubmit = Time.unscaledTime + .1f; // The dismissing key never interacts as well.
                return;
            }
            if (dialogue.Open)
            {
                if (escape) CloseDialogue();
                else HandleDialogueKeys();
                world.Tick(delta, 0, 0, false);
            }
            else
            {
                float x = (Held(Key.D, Key.RightArrow) ? 1 : 0) - (Held(Key.A, Key.LeftArrow) ? 1 : 0);
                float y = (Held(Key.S, Key.DownArrow) ? 1 : 0) - (Held(Key.W, Key.UpArrow) ? 1 : 0);
                world.Tick(delta, x, y, Held(Key.LeftShift, Key.RightShift));
                if (Time.unscaledTime >= nextSubmit && Pressed(Key.E, Key.Space, Key.Enter, Key.NumpadEnter)) world.Interact();
            }
            DrainWorldEvents();
            if (mode != Mode.Base) return;
            int letters = view.Dialogue.Animate(delta);
            blipTimer -= delta;
            if (letters > 0 && blipTimer <= 0) { audioPlayer.Blip(dialogue.Speaker == "professor" ? .8f : 1.1f); blipTimer = .07f; }
            view.Base.Animate(delta, world, dialogue.Open);
            // Footsteps follow the contact frames of the walk/run cycle: one thud per frame with new contacts.
            if (view.Base.PlayerSteps != seenSteps)
            {
                if (view.Base.PlayerSteps > seenSteps && world.Moving) audioPlayer.Footstep(world.Running);
                seenSteps = view.Base.PlayerSteps;
            }
        }

        private void DrainWorldEvents()
        {
            WorldEvent e;
            while (mode == Mode.Base && (e = world.PopEvent()) != null)
            {
                switch (e.Kind)
                {
                    case WorldEventKind.DialogueOpened: OpenDialogue(e.Text); break;
                    case WorldEventKind.BoardAircraft: BoardAircraft(); break;
                    case WorldEventKind.Hint: view.Base.ShowHint(e.Text); audioPlayer.MissileReject(); break;
                    case WorldEventKind.ZoneEntered: view.Base.ShowZone(e.Text); break;
                }
            }
        }

        private void HandleDialogueKeys()
        {
            if (keyboard == null) return;
            var digits = new[] { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6, Key.Digit7, Key.Digit8, Key.Digit9 };
            var numpad = new[] { Key.Numpad1, Key.Numpad2, Key.Numpad3, Key.Numpad4, Key.Numpad5, Key.Numpad6, Key.Numpad7, Key.Numpad8, Key.Numpad9 };
            for (int i = 0; i < digits.Length; i++)
                if (Pressed(digits[i], numpad[i])) { if (view.Dialogue.Typing) view.Dialogue.Reveal(); else ChooseDialogue(i); return; }
            if (Pressed(Key.W, Key.UpArrow)) view.Dialogue.MoveSelection(-1);
            if (Pressed(Key.S, Key.DownArrow)) view.Dialogue.MoveSelection(1);
            if (Pressed(Key.E, Key.Space, Key.Enter, Key.NumpadEnter))
            {
                if (view.Dialogue.Typing) view.Dialogue.Reveal();
                else ChooseDialogue(view.Dialogue.Selected);
            }
        }

        private void OpenDialogue(string graphId)
        {
            try { dialogue.Start(graphId, missions.Condition); }
            catch (KeyNotFoundException exception) { Debug.LogWarning(exception.Message); world.EndDialogue(); return; }
            if (!dialogue.Open) { world.EndDialogue(); return; }
            ShowDialogueNode();
        }

        private void ShowDialogueNode()
        {
            string speaker = dialogue.Speaker;
            string role = speaker != null && BaseContent.Roster.TryGetValue(speaker, out var npc) ? "  ·  " + npc.Role : "";
            view.Dialogue.Show(BaseContent.SpeakerName(speaker) + role, BaseContent.SpeakerCharacter(speaker),
                dialogue.Text(BaseContent.Variables(missions, SelectedWordCount())), dialogue.Choices);
        }

        private int SelectedWordCount()
        {
            int available = catalog.Filter(selection).Length;
            return selection.from >= 1 && selection.to <= available && selection.to >= selection.from ? selection.to - selection.from + 1 : 0;
        }

        // Dialogue choice (button, digit or W/S + E). Mission actions apply before the next node is shown.
        public void ChooseDialogue(int index)
        {
            if (mode != Mode.Base || !dialogue.Open || view.Dialogue.Typing) return;
            if (index < 0 || index >= dialogue.Choices.Count) return;
            string pending = null;
            dialogue.Choose(index, action =>
            {
                if (missions.Apply(action)) MissionChanged(action);
                else pending = action;
            });
            EventSystem.current?.SetSelectedGameObject(null);
            if (dialogue.Open) ShowDialogueNode(); else CloseDialogue();
            if (pending == DialogueActions.VocabOpen) OpenVocabulary();
        }

        private void MissionChanged(string action)
        {
            if (missions.Active != null && DialogueActions.TryParseAccept(action, out _, out _))
            {
                StartingEnvironment = (FlightEnvironment)Mathf.Clamp(missions.Environment, 0, 3);
                profile.Profile.startingEnvironment = (int)StartingEnvironment; profile.Save();
                audioPlayer.Pickup();
            }
        }

        private void CloseDialogue()
        {
            if (dialogue.Open) dialogue.Close();
            world.EndDialogue(); view.Dialogue.Hide();
            EventSystem.current?.SetSelectedGameObject(null);
        }

        private void SaveMissions()
        {
            profile.Profile.missionsCompleted = missions.Completed; profile.Profile.lastScore = missions.LastScore; profile.Save();
        }

        // Back to the walkable base: from the vocabulary screen, the pause menu (mission kept) or after a sortie.
        public void ReturnToBase() => EnterBase(false, false);

        private void EnterBase(bool title, bool besideAircraft)
        {
            SetMode(Mode.Base); Time.timeScale = 1; Cursor.visible = true; typed = "";
            if (audioPlayer) { audioPlayer.Pause(false); audioPlayer.Stop(); } speech.Clear(); view.Board.Clear(); flight = null; view.FinishIntro(); view.HideOverlay();
            if (dialogue.Open) CloseDialogue(); else view.Dialogue.Hide();
            if (besideAircraft) world.PlacePlayer(world.Map.AircraftReturnX, world.Map.AircraftReturnY, world.Map.AircraftReturnFacing);
            while (world.PopEvent() != null) { }
            if (title) view.Base.ShowTitle();
            view.Base.SnapCamera(world);
            nextSubmit = Time.unscaledTime + .2f;
            EventSystem.current?.SetSelectedGameObject(null);
        }
    }
}

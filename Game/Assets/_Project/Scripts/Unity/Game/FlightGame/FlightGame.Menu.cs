using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.InputSystem;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame
    {
        // ---------------- Intro, main menu, saves, segments, settings, pause ----------------
        // Start: Mode.Boot (intro, any key skips) -> Mode.Menu (main menu and its pages). Pause is a page over Mode.Story.
        // Pages are built here (labels, what each row does); MenuView draws them. Save slots and settings live in
        // profileDir: Application.persistentDataPath, or a sub-folder of the smoke output with --smoke-test.
        private GameSettings settings = new GameSettings();
        private StorySaves saves;
        private string profileDir;
        private Action menuBack;          // Esc on the current page (null: Esc does nothing, e.g. the main menu)
        private bool storyPaused;
        private int storySlot = -1;       // 0..2 = playing a save slot, -1 = trial (a segment picked from the list: nothing is saved)
        private float storyPlaySeconds;

        private string ProfileFolder()
        {
            if (!smokeMode) return Application.persistentDataPath;
            var args = System.Environment.GetCommandLineArgs();
            int at = Array.IndexOf(args, "--smoke-output");
            return Path.Combine(at >= 0 && at + 1 < args.Length ? args[at + 1] : Application.persistentDataPath, "story-profile");
        }

        private void LoadProfile()
        {
            profileDir = ProfileFolder();
            settings = GameSettings.Load(profileDir);
            saves = new StorySaves(profileDir);
            audioPlayer.ApplyVolumes(settings.master, settings.ambient, settings.effects);
            if (!smokeMode) ApplyResolution();   // the smoke window stays 1280x800 whatever the file says
        }

        private void ApplyResolution()
        {
            var size = settings.Size;
            bool native = size.width == Display.main.systemWidth && size.height == Display.main.systemHeight;
            Screen.SetResolution(size.width, size.height, settings.fullscreen ? (native ? FullScreenMode.FullScreenWindow : FullScreenMode.ExclusiveFullScreen) : FullScreenMode.Windowed);
        }

        private void ApplySettings(bool screen)
        {
            settings.Clamped();
            audioPlayer.ApplyVolumes(settings.master, settings.ambient, settings.effects);
            settings.Save(profileDir);
            if (screen && !smokeMode) ApplyResolution();
        }

        private int introBooms;          // explosion sounds played by the intro (smoke test)

        private float MenuDelta => Mathf.Min(Time.unscaledDeltaTime, 1 / 30f) * storySpeed;

        // ---- Intro ----
        private void EnterBoot()
        {
            SetMode(Mode.Boot); Time.timeScale = 1; Cursor.visible = true; typed = "";
            if (audioPlayer) { audioPlayer.Pause(false); audioPlayer.Stop(); }
            speech.Clear(); view.Board.Clear(); flight = null; view.FinishIntro(); view.HideOverlay();
            if (dialogue.Open) CloseDialogue(); else view.Dialogue.Hide();
            storyPaused = false; menuBack = null; introBooms = 0;
            view.Menu.ShowBoot();
            audioPlayer.StorySound("wind"); audioPlayer.StorySound("engines");
        }

        private void UpdateBoot()
        {
            var scene = view.Menu.Scene;
            view.Menu.Animate(MenuDelta);
            while (scene.TakeCue(out int cue)) PlayCue(cue);
            bool skip = (keyboard != null && keyboard.anyKey.wasPressedThisFrame) || (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame);
            if (skip && scene.Time > .2f) scene.Finish();
            if (scene.Finished) EnterMenu();
        }

        // The film's cues become sounds (Shot and BarsOff are silent). The Title cue ends the dogfight: the engines fade, only the wind stays.
        private void PlayCue(int cue)
        {
            switch (cue)
            {
                case TitleScene.CueBurst: audioPlayer.StorySound("burst"); break;
                case TitleScene.CueBoom: introBooms++; audioPlayer.StorySound("boom"); break;
                case TitleScene.CueBigBoom: introBooms++; audioPlayer.StorySound("bigboom"); break;
                case TitleScene.CueWhoosh: audioPlayer.StorySound("whoosh"); break;
                case TitleScene.CueFlak: audioPlayer.StorySound("flak"); break;
                case TitleScene.CueHit: audioPlayer.StorySound("hit"); break;
                case TitleScene.CueTitle: audioPlayer.StorySound("-engines"); audioPlayer.StorySound("title"); break;
            }
        }

        // ---- Main menu ----
        private void EnterMenu()
        {
            bool fromBoot = mode == Mode.Boot;
            SetMode(Mode.Menu); storyPaused = false; Time.timeScale = 1; Cursor.visible = true;
            if (!fromBoot) { audioPlayer.Stop(); view.Menu.ShowBoot(); audioPlayer.StorySound("wind"); }
            view.Menu.Scene.Finish();
            audioPlayer.StorySound("-engines");
            ShowMainMenu();
        }

        private void UpdateMenu()
        {
            view.Menu.Animate(MenuDelta);
            MenuInput();
        }

        // W/S or arrows move, A/D adjust a slider or choice (on a save card: D reaches XÓA), Enter/Space/E use, Esc goes back.
        private void MenuInput()
        {
            var menu = view.Menu;
            if (Pressed(Key.W, Key.UpArrow)) menu.Move(-1);
            if (Pressed(Key.S, Key.DownArrow)) menu.Move(1);
            if (Pressed(Key.A, Key.LeftArrow)) menu.Adjust(-1);
            if (Pressed(Key.D, Key.RightArrow)) menu.Adjust(1);
            if (Pressed(Key.Enter, Key.NumpadEnter, Key.Space, Key.E)) menu.ActivateSelected();
            else if (Pressed(Key.Escape)) menuBack?.Invoke();
        }

        private void ShowMainMenu()
        {
            var items = new List<MenuEntry>();
            bool any = saves.Any;
            if (any) items.Add(new MenuEntry { Text = "Tiếp tục", Activate = ContinueStory });
            items.Add(new MenuEntry { Text = "Chơi mới", Activate = () => ShowSlotsPage(true, 0) });
            if (any) items.Add(new MenuEntry { Text = "Tải hồ sơ", Activate = () => ShowSlotsPage(false, Math.Max(0, saves.Latest())) });
            items.Add(new MenuEntry { Text = "Chọn đoạn", Activate = ShowSegmentsPage });
            items.Add(new MenuEntry { Text = "Cài đặt", Activate = () => ShowSettingsPage(ShowMainMenu) });
            items.Add(new MenuEntry { Text = "Thoát", Activate = Application.Quit });
            menuBack = null;
            view.Menu.ShowPage("", items, 0, false, "", true);
        }

        private void ContinueStory()
        {
            int slot = saves.Latest();
            var data = slot >= 0 ? saves.Load(slot) : null;
            if (data == null) { ShowMainMenu(); return; }
            EnterStory(data.ToSnapshot(), slot, data.playSeconds);
        }

        // ---- Save slots ----
        private void ShowSlotsPage(bool newGame, int selected)
        {
            var items = new List<MenuEntry>();
            for (int i = 0; i < StorySaves.Slots; i++)
            {
                int slot = i; var data = saves.Load(slot);
                string summary = data == null ? "" : data.Segment.Number + "  " + data.Segment.Title;
                items.Add(new MenuEntry
                {
                    Card = true, Text = "HỒ SƠ " + (slot + 1), Enabled = newGame || data != null,
                    Detail = data == null ? "Trống" : summary + "\nThời gian chơi " + data.PlayTimeText + "   ·   Lưu lúc " + data.savedAt,
                    Activate = () =>
                    {
                        if (data == null || !newGame) { if (newGame) EnterStory(null, slot, 0); else EnterStory(data.ToSnapshot(), slot, data.playSeconds); }
                        else ShowConfirm("Ghi đè hồ sơ này?", "Hồ sơ " + (slot + 1) + ": " + summary, () => EnterStory(null, slot, 0), () => ShowSlotsPage(true, slot));
                    },
                    SecondaryText = "XÓA",
                    Secondary = data == null ? (Action)null : () => ShowConfirm("Xóa hồ sơ này?", "Hồ sơ " + (slot + 1) + ": " + summary, () => { saves.Delete(slot); ShowSlotsPage(newGame, slot); }, () => ShowSlotsPage(newGame, slot)),
                });
            }
            items.Add(new MenuEntry { Text = "Quay lại", Activate = ShowMainMenu });
            menuBack = ShowMainMenu;
            view.Menu.ShowPage(newGame ? "Chơi mới: chọn hồ sơ" : "Tải hồ sơ", items, selected, false, newGame ? "Tự lưu ở đầu mỗi đoạn và khi về màn hình chính" : "");
        }

        private void ShowConfirm(string question, string detail, Action yes, Action no)
        {
            var items = new List<MenuEntry> { new MenuEntry { Text = "Có", Activate = yes }, new MenuEntry { Text = "Không", Activate = no } };
            menuBack = no;
            view.Menu.ShowPage(question, items, 1, storyPaused, detail);
        }

        // ---- Segment list (trial: nothing is saved) ----
        private void ShowSegmentsPage()
        {
            var items = new List<MenuEntry>();
            foreach (var segment in Act0Content.Segments)
            {
                var s = segment;
                items.Add(new MenuEntry { Text = s.Number + "   " + s.Title, Activate = () => EnterStory(new StorySnapshot { BeatId = s.FirstBeatId }, -1, 0) });
            }
            items.Add(new MenuEntry { Text = "Quay lại", Activate = ShowMainMenu });
            menuBack = ShowMainMenu;
            view.Menu.ShowPage("Chọn đoạn", items, 0, false, "Chơi thử từ đầu đoạn, không ghi đè hồ sơ nào");
        }

        // ---- Settings (applied at once, saved to settings.json) ----
        private MenuEntry VolumeEntry(string text, Func<int> get, Action<int> set)
        {
            Action<int> apply = v => { set(GameSettings.Step(v)); ApplySettings(false); };
            return new MenuEntry { Text = text, Slider = () => get() / 100f, Adjust = d => apply(get() + d * GameSettings.VolumeStep), SetSlider = f => apply(Mathf.RoundToInt(f * 100)) };
        }

        private void ShowSettingsPage(Action back)
        {
            var items = new List<MenuEntry>
            {
                VolumeEntry("Âm lượng tổng", () => settings.master, v => settings.master = v),
                VolumeEntry("Âm lượng môi trường", () => settings.ambient, v => settings.ambient = v),
                VolumeEntry("Âm lượng hiệu ứng", () => settings.effects, v => settings.effects = v),
                new MenuEntry
                {
                    Text = "Độ phân giải", Value = () => settings.ResolutionText,
                    Adjust = d => { settings.resolution = (settings.resolution + d + GameSettings.Resolutions.Length) % GameSettings.Resolutions.Length; ApplySettings(true); },
                },
                new MenuEntry { Text = "Toàn màn hình", Value = () => settings.fullscreen ? "Bật" : "Tắt", Adjust = d => { settings.fullscreen = !settings.fullscreen; ApplySettings(true); } },
                new MenuEntry { Text = "Quay lại", Activate = () => back() },
            };
            menuBack = () => back();
            view.Menu.ShowPage("Cài đặt", items, 0, storyPaused);
        }

        // ---- Pause over the story ----
        private void OpenPause() { storyPaused = true; ShowPausePage(); }

        private void ClosePause() { storyPaused = false; view.Menu.Hide(); }

        private void ShowPausePage()
        {
            var items = new List<MenuEntry>
            {
                new MenuEntry { Text = "Tiếp tục", Activate = ClosePause },
                new MenuEntry { Text = "Cài đặt", Activate = () => ShowSettingsPage(ShowPausePage) },
                new MenuEntry { Text = "Về màn hình chính", Activate = LeaveStory },
            };
            menuBack = ClosePause;
            view.Menu.ShowPage("Tạm dừng", items, 0, true, storySlot < 0 ? "Chế độ thử: không ghi hồ sơ" : "Hồ sơ " + (storySlot + 1) + " (tự lưu khi về màn hình chính)");
        }

        // Back to the main menu: save first (the first beat of the segment being played, the flags and the time).
        private void LeaveStory() { SaveStory(); EnterMenu(); }

        private void SaveStory()
        {
            if (storySlot < 0 || storyRunner == null || saves == null) return;
            saves.Save(storySlot, StorySaveData.From(storyRunner.Snapshot(), storyPlaySeconds));
        }
    }
}

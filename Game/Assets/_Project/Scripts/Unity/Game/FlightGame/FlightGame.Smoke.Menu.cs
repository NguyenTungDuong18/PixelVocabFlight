using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame
    {
        // Intro, main menu, save slots, segment list, settings and pause. Saves and settings go to the smoke profile folder
        // (<smoke output>/story-profile), never to the user's. Runs at storySpeed 5 after the story stage.
        private IEnumerator SmokeMenu()
        {
            smokeDeadline += 60; storySpeed = 5;
            for (int i = 0; i < StorySaves.Slots; i++) saves.Delete(i);
            var menu = view.Menu;
            var scene = menu.Scene;

            // ---- Intro: the pre-rendered film (Resources/Cinema/title_intro), played at real speed so each shot is sampled in its middle; then the main menu ----
            // Every check reads the film's own data (shot, cue and loop tables), so a missing film makes them FAIL instead of passing silently.
            smokeDeadline += 40; storySpeed = 1;
            EnterBoot();
            yield return null; yield return null;
            Check(mode == Mode.Boot && menu.Visible && scene.Visible && !view.Story.Visible && !scene.Finished && profileDir.StartsWith(smokeOutput), "menu-intro-starts-on-the-title-film");
            Check(scene.FilmLoaded && scene.FilmSize == new Vector2Int(480, 270) && scene.Fps > 0 && scene.LoopStart > 0 && scene.FrameCount > scene.LoopStart && scene.MissingSprites.Count == 0,
                "menu-intro-film-loads-480x270-with-an-intro-and-a-loop:" + scene.FilmSize + "/" + scene.LoopStart + "/" + scene.FrameCount);
            Check(scene.ShotCount >= 6 && scene.CueTime(TitleScene.CueTitle) > 0 && scene.CueTime(TitleScene.CueBarsOff) > 0, "menu-intro-film-has-six-shots-a-title-cue-and-a-bars-cue:" + scene.ShotCount);
            Check(TitleScene.LogoScaleAt(0) == 6 && TitleScene.LogoScaleAt(1) == 6 && TitleScene.LogoScaleAt(2) == 5 && TitleScene.LogoScaleAt(3) == 5 && TitleScene.LogoScaleAt(4) == 4, "menu-intro-logo-slams-x6-x5-then-x4");
            yield return SmokeUntil(() => scene.Time > .5f, 14);
            Check(smokeOk && scene.Frame > 5 && scene.Frame < scene.LoopStart && scene.LetterboxVisible && scene.LogoAlpha == 0, "menu-intro-frames-advance-with-time-letterbox-on-logo-hidden:" + scene.Frame);
            int shots = scene.ShotCount;
            for (int n = 1; n <= shots; n++)
            {
                float mid = scene.ShotMid(n - 1);
                yield return SmokeUntil(() => scene.Time >= mid, 20);
                Check(smokeOk && scene.Shot == n - 1 && scene.Frame < scene.LoopStart, "menu-intro-shot-" + n + "-reached-at-its-middle");
                SmokeCapture("menu-intro-shot-" + n + ".png");
            }
            float titleAt = scene.CueTime(TitleScene.CueTitle), barsAt = scene.CueTime(TitleScene.CueBarsOff);
            yield return SmokeUntil(() => scene.Time >= titleAt + .3f, 20);
            Check(smokeOk && scene.LogoAlpha == 1 && scene.LogoScale == 4 && !audioPlayer.StoryLoopOn("engines"), "menu-intro-title-cue-shows-the-logo-and-fades-the-engines");
            yield return SmokeUntil(() => scene.Time >= Mathf.Max(barsAt + .8f, scene.IntroSeconds - .15f), 20);
            Check(smokeOk && !scene.Finished && !scene.LetterboxVisible && scene.Explosions >= 3 && introBooms == scene.Explosions && audioPlayer.StorySoundCount > 3,
                "menu-intro-letterbox-retracts-and-three-explosions-sound-before-the-end:" + scene.Explosions + "/" + introBooms);
            yield return SmokeUntil(() => mode == Mode.Menu, 10);
            storySpeed = 5;
            Check(smokeOk && scene.Finished && scene.LogoAlpha == 1 && !scene.LetterboxVisible && menu.Visible && scene.Frame >= scene.LoopStart, "menu-intro-ends-on-the-logo-then-the-main-menu");
            Check(menu.ItemCount == 4 && menu.ItemRect(3).xMax < 0, "menu-main-rows-start-off-screen-left");
            yield return null; yield return null;
            Check(menu.ItemCount == 4 && menu.ItemText(0) == "Chơi mới" && menu.ItemText(1) == "Chọn đoạn" && menu.ItemText(2) == "Cài đặt" && menu.ItemText(3) == "Thoát", "menu-main-lists-new-segments-settings-quit-without-saves:" + menu.ItemCount);
            Check(menu.ItemFontSize(0) >= 32, "menu-rows-use-large-text:" + menu.ItemFontSize(0));
            // The rows hug the left edge and slide in from beyond it.
            yield return SmokeUntil(() => menu.RowsSettled, 6);
            bool hugsLeft = smokeOk;
            for (int i = 0; i < menu.ItemCount; i++) { var r = menu.ItemRect(i); hugsLeft &= r.xMin >= 0 && r.xMin < 120 && r.xMax < 760; }
            Check(hugsLeft, "menu-main-rows-sit-against-the-left-edge-after-sliding-in:" + menu.ItemRect(0) + "/" + menu.ItemRect(3));
            SmokeCapture("menu-main.png");
            yield return SmokeKey(Key.S); Check(menu.Selected == 1, "menu-s-moves-down");
            yield return SmokeKey(Key.W); Check(menu.Selected == 0, "menu-w-moves-up");

            // The loop behind the menu: Finish() lands on its first frame (logo shown, no letterbox, no cues replayed), it runs on and wraps back.
            menu.ShowBoot(); scene.Finish(); storySpeed = 1; smokeDeadline += 25;
            Check(scene.Finished && scene.Frame == scene.LoopStart && scene.LogoAlpha == 1 && !scene.LetterboxVisible && !scene.TakeCue(out _), "menu-intro-finish-jumps-to-the-start-of-the-loop");
            yield return SmokeUntil(() => scene.Time >= scene.IntroSeconds + 2, 20);
            Check(smokeOk && scene.Frame >= scene.LoopStart + scene.Fps && scene.Frame < scene.FrameCount, "menu-intro-loop-plays-on:" + scene.Frame);
            SmokeCapture("menu-intro-loop.png");
            storySpeed = 5;
            int lastFrame = scene.Frame; bool wrapped = false, inLoop = true; float wrapEnd = Time.realtimeSinceStartup + 12;
            while (!wrapped && Time.realtimeSinceStartup < wrapEnd)
            {
                yield return null;
                int frame = scene.Frame;
                inLoop &= frame >= scene.LoopStart && frame < scene.FrameCount;
                wrapped = frame < lastFrame; lastFrame = frame;
            }
            Check(wrapped && inLoop && lastFrame - scene.LoopStart <= 8, "menu-intro-loop-wraps-back-to-the-loop-start:" + lastFrame + "/" + scene.LoopStart);

            // Intro: any key skips straight to the menu.
            EnterBoot();
            yield return SmokeUntil(() => scene.Time > .6f, 4);
            yield return SmokeKey(Key.Space);
            yield return SmokeUntil(() => mode == Mode.Menu, 4);
            Check(smokeOk && scene.Finished && scene.Frame >= scene.LoopStart && scene.LogoAlpha == 1 && !scene.LetterboxVisible, "menu-intro-any-key-skips-to-the-loop-with-the-logo");

            // ---- Settings: volumes, resolution, full screen; applied and saved at once ----
            yield return SmokeMenuPick("Cài đặt"); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Cài đặt" && menu.ItemCount == 6 && menu.ItemText(0) == "Âm lượng tổng" && menu.ItemText(3) == "Độ phân giải" && menu.ItemText(4) == "Toàn màn hình", "menu-settings-lists-three-volumes-resolution-fullscreen");
            yield return SmokeKey(Key.A);
            Check(settings.master == 95 && Mathf.Abs(audioPlayer.MasterGain - .95f) < .001f, "menu-settings-master-volume-steps-by-5:" + settings.master);
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.A); yield return SmokeKey(Key.A);
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.A);
            var onDisk = GameSettings.Load(profileDir);
            Check(settings.ambient == 90 && settings.effects == 95 && onDisk.master == 95 && onDisk.ambient == 90 && onDisk.effects == 95 && File.Exists(Path.Combine(profileDir, GameSettings.FileName)), "menu-settings-volumes-saved-to-settings-json");
            Check(Mathf.Abs(audioPlayer.AmbientGain - .9f) < .001f && Mathf.Abs(audioPlayer.EffectsGain - .95f) < .001f, "menu-settings-volumes-reach-the-audio");
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.D);
            Check(settings.resolution == 0 && menu.ItemValue(3) == "1280×720" && GameSettings.Load(profileDir).resolution == 0, "menu-settings-resolution-changes-and-is-saved:" + menu.ItemValue(3));
            yield return SmokeKey(Key.A);
            Check(settings.resolution == GameSettings.DefaultResolution && menu.ItemValue(3) == "1920×1080", "menu-settings-default-resolution-is-full-hd");
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.D);
            Check(!settings.fullscreen && menu.ItemValue(4) == "Tắt", "menu-settings-fullscreen-toggles");
            yield return SmokeKey(Key.D);
            Check(settings.fullscreen, "menu-settings-fullscreen-back-on");
            Check(menu.ItemFontSize(0) >= 32, "menu-settings-rows-use-large-text");
            yield return SmokeMenuShot("menu-settings.png");
            yield return SmokeKey(Key.Escape);
            Check(menu.PageTitle == "" && menu.ItemText(0) == "Chơi mới", "menu-esc-goes-back-to-the-main-menu");

            // ---- New game in slot 2: autosave at the start of the first segment ----
            yield return SmokeMenuPick("Chơi mới"); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Chơi mới: chọn hồ sơ" && menu.ItemCount == 4 && menu.ItemDetail(0) == "Trống" && menu.ItemDetail(1) == "Trống" && menu.ItemDetail(2) == "Trống", "menu-slots-three-empty-cards");
            yield return SmokeMenuShot("menu-slots-empty.png");
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.Enter);
            yield return SmokeUntil(() => mode == Mode.Story && storySlot == 1 && storyRunner.Current != null && storyRunner.Current.Id == "open.P1.01" && view.Story.Current == storyRunner.Current && !view.Story.Transitioning, 8);
            Check(smokeOk && !view.Menu.Visible && view.Story.Visible && view.Story.BadgeText == "", "menu-new-game-starts-the-story-in-slot-2");
            yield return SmokeUntil(() => saves.Load(1) != null, 3);
            var first = saves.Load(1);
            Check(smokeOk && first.beatId == "open.P1.01" && File.Exists(saves.PathOf(1)) && saves.PathOf(1).StartsWith(smokeOutput), "menu-segment-start-saves-slot-2");

            // ---- Pause (Esc): the story stands still ----
            yield return SmokeKey(Key.Escape);
            float frozen = view.Story.BeatTime;
            Check(storyPaused && menu.Visible && menu.PageTitle == "Tạm dừng" && menu.ItemCount == 3 && menu.ItemText(0) == "Tiếp tục" && menu.ItemText(1) == "Cài đặt" && menu.ItemText(2) == "Về màn hình chính" && menu.DimVisible, "menu-esc-opens-the-pause-panel");
            yield return SmokeMenuShot("menu-pause.png");
            float until = Time.unscaledTime + .3f;
            while (Time.unscaledTime < until) yield return null;
            Check(Mathf.Abs(view.Story.BeatTime - frozen) < .001f, "menu-pause-freezes-the-story");
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Cài đặt" && menu.DimVisible, "menu-pause-opens-settings-over-the-story");
            yield return SmokeKey(Key.Escape);
            Check(menu.PageTitle == "Tạm dừng", "menu-pause-settings-esc-returns-to-the-pause-panel");
            yield return SmokeKey(Key.Escape);
            Check(!storyPaused && !menu.Visible, "menu-esc-resumes-the-story");

            // ---- Save at the start of the second segment with a flag, back to the menu, Tiếp tục ----
            storyRunner.JumpTo("m1.P1.01"); storyFlags.Set(Act0Content.PrideFlag, 1);
            yield return SmokeUntil(() => storyRunner.Current.Id == "m1.P1.01" && view.Story.Current == storyRunner.Current && !view.Story.Transitioning, 8);
            yield return SmokeUntil(() => saves.Load(1) != null && saves.Load(1).beatId == "m1.P1.01", 3);
            Check(smokeOk, "menu-reaching-a-new-segment-saves-it");
            yield return SmokeKey(Key.Escape);
            yield return SmokeMenuPick("Về màn hình chính"); yield return SmokeKey(Key.Enter);
            Check(mode == Mode.Menu && menu.ItemText(0) == "Tiếp tục" && menu.ItemCount == 6, "menu-leaving-the-story-shows-continue:" + menu.ItemCount);
            var saved = saves.Load(1);
            Check(saved != null && saved.beatId == "m1.P1.01" && saved.ToSnapshot().Flags[Act0Content.PrideFlag] == 1 && saved.playSeconds > 0 && saved.Segment.Number == "0.2", "menu-save-keeps-segment-flags-and-play-time:" + (saved != null ? saved.PlayTimeText : "none"));
            yield return SmokeMenuShot("menu-main-with-continue.png");
            yield return SmokeKey(Key.Enter);
            yield return SmokeUntil(() => mode == Mode.Story && storySlot == 1 && storyRunner.Current.Id == "m1.P1.01" && view.Story.Current == storyRunner.Current && !view.Story.Transitioning, 8);
            Check(smokeOk && storyFlags.Get(Act0Content.PrideFlag) == 1 && storyPlaySeconds >= saved.playSeconds, "menu-continue-resumes-the-saved-segment-with-its-flags");
            yield return SmokeKey(Key.Escape); yield return SmokeMenuPick("Về màn hình chính"); yield return SmokeKey(Key.Enter);

            // ---- Load page, overwrite question, delete, broken file ----
            yield return SmokeMenuPick("Tải hồ sơ"); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Tải hồ sơ" && !menu.ItemEnabled(0) && menu.ItemEnabled(1) && menu.ItemDetail(1).Contains("0.2") && menu.Selected == 1, "menu-load-page-only-filled-slots-are-usable");
            yield return SmokeMenuShot("menu-slots-filled.png");
            yield return SmokeKey(Key.Escape);
            yield return SmokeMenuPick("Chơi mới"); yield return SmokeKey(Key.Enter);
            yield return SmokeKey(Key.S); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Ghi đè hồ sơ này?" && menu.ItemText(0) == "Có" && menu.ItemText(1) == "Không" && menu.Selected == 1, "menu-overwrite-asks-first");
            yield return SmokeKey(Key.Escape);
            Check(menu.PageTitle == "Chơi mới: chọn hồ sơ" && saves.Load(1) != null, "menu-overwrite-no-keeps-the-save");
            yield return SmokeKey(Key.D);
            Check(menu.SecondaryFocus, "menu-d-reaches-the-delete-button");
            yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Xóa hồ sơ này?", "menu-delete-asks-first");
            yield return SmokeKey(Key.W); yield return SmokeKey(Key.Enter);
            Check(!File.Exists(saves.PathOf(1)) && menu.PageTitle == "Chơi mới: chọn hồ sơ" && menu.ItemDetail(1) == "Trống", "menu-delete-removes-the-save-file");
            File.WriteAllText(saves.PathOf(2), "{ not json");
            Check(saves.Load(2) == null, "menu-broken-save-file-counts-as-empty");
            yield return SmokeKey(Key.Escape);

            // ---- Segment list: every segment starts at its first frame in trial mode and never touches the saves ----
            saves.Save(0, StorySaveData.From(new StorySnapshot { BeatId = "open.P1.01" }, 12));
            long before = saves.Load(0).savedTicks;
            yield return SmokeMenuPick("Chọn đoạn"); yield return SmokeKey(Key.Enter);
            Check(menu.PageTitle == "Chọn đoạn" && menu.ItemCount == Act0Content.Segments.Count + 1 && Act0Content.Segments.Select((s, i) => menu.ItemText(i).Contains(s.Number) && menu.ItemText(i).Contains(s.Title)).All(b => b), "menu-segment-list-shows-numbers-and-names");
            yield return SmokeMenuShot("menu-segments.png");
            for (int i = 0; i < Act0Content.Segments.Count; i++)
            {
                var segment = Act0Content.Segments[i];
                if (menu.PageTitle != "Chọn đoạn") { yield return SmokeMenuPick("Chọn đoạn"); yield return SmokeKey(Key.Enter); }
                for (int k = 0; k < i; k++) yield return SmokeKey(Key.S);
                yield return SmokeKey(Key.Enter);
                yield return SmokeUntil(() => mode == Mode.Story && storyRunner.Current.Id == segment.FirstBeatId && view.Story.Current == storyRunner.Current && !view.Story.Transitioning, 8);
                yield return SmokeUntil(() => view.Story.BadgeText.Contains(segment.Number), 2);
                Check(smokeOk && storySlot == -1 && storyFlags.All.Count == 0 && view.Story.BadgeText.Contains(segment.Title), "menu-segment-" + segment.Number + "-starts-at-its-first-frame-in-trial-mode");
                if (i == Act0Content.Segments.Count - 1) SmokeCapture("menu-trial-" + segment.Id + ".png");
                yield return SmokeKey(Key.Escape); yield return SmokeMenuPick("Về màn hình chính"); yield return SmokeKey(Key.Enter);
            }
            Check(saves.Load(0).savedTicks == before && !File.Exists(saves.PathOf(1)), "menu-trial-mode-never-writes-a-save");
            for (int i = 0; i < StorySaves.Slots; i++) saves.Delete(i);
            storySpeed = 5;
        }

        // A page screenshot once its rows have finished sliding in (keeps the result of the last SmokeUntil).
        private IEnumerator SmokeMenuShot(string fileName)
        {
            bool keep = smokeOk;
            yield return SmokeUntil(() => view.Menu.RowsSettled, 4);
            SmokeCapture(fileName);
            smokeOk = keep;
        }

        // Presses S until the selected row has this text (rows wrap); smokeOk says whether it was found.
        private IEnumerator SmokeMenuPick(string text)
        {
            for (int i = 0; i < 12 && view.Menu.ItemText(view.Menu.Selected) != text; i++) yield return SmokeKey(Key.S);
            smokeOk = view.Menu.ItemText(view.Menu.Selected) == text;
        }
    }
}

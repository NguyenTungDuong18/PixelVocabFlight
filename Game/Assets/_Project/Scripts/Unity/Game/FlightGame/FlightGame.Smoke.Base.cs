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
        // Base: title card, walking/running, solid buildings, SKYLARK without orders.
        private IEnumerator SmokeBase()
        {
            // ---- Base (0.15): the walkable airbase is the main screen ----
            var map=world.Map;
            Check(mode==Mode.Base&&view.Base.Visible&&view.Base.TitleVisible&&!view.TakeOffVisible&&!view.OverlayVisible,"base-is-main-screen-with-title-card");
            Check(view.Base.GroundMode=="cpu","base-ground-composed-from-readable-tiles:"+view.Base.GroundMode);
            Check(view.Base.MissingSprites==0&&view.Base.PlacementImages==map.Placements.Count&&view.Base.FenceImages>=200,"base-models-each-a-separate-sprite:"+view.Base.PlacementImages+"/"+map.Placements.Count+"/fence "+view.Base.FenceImages+"/missing "+view.Base.MissingSprites);
            yield return new WaitForSecondsRealtime(.3f);
            SmokeCapture("00a-base-title.png");
            yield return SmokeKey(Key.Space);
            for(int i=0;i<120&&view.Base.TitleVisible;i++)yield return null;
            Check(!view.Base.TitleVisible&&mode==Mode.Base&&!dialogue.Open,"any-key-dismisses-title-card");
            Check(missions.Active==null&&view.Base.ObjectiveText==MissionLog.IdleObjective&&view.Base.QuestMarkerVisible,"idle-objective-and-quest-marker-over-professor");
            SmokeCapture("00b-base-overview.png");

            // Hold D for half a second: the pilot walks east on the walk cycle and the camera follows.
            world.PlacePlayer(map.SpawnX,map.SpawnY,Facing.N);yield return null;
            float walkFrom=world.PlayerX,cameraFrom=view.Base.CameraPosition.x;int stepsBefore=audioPlayer.FootstepCount,contactsBefore=view.Base.PlayerSteps;
            InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.D));
            float heldFrom=Time.unscaledTime;
            while(Time.unscaledTime-heldFrom<.5f)yield return null;
            Check(world.PlayerX>walkFrom+1&&world.PlayerFacing==Facing.E&&view.Base.PlayerSpriteName.StartsWith("chr_pilot_walk_e"),"hold-d-walks-east-on-walk-frames:"+(world.PlayerX-walkFrom).ToString("0.00")+"/"+view.Base.PlayerSpriteName);
            Check(view.Base.CameraPosition.x>cameraFrom&&Mathf.Abs(view.Base.CameraPosition.x%3)<.01f,"camera-follows-pilot-on-art-pixel-grid");
            Check(audioPlayer.FootstepCount>stepsBefore,"footsteps-while-walking");
            // Footsteps come from the walk cycle's contact frames (0 and frames/2), one thud per contact.
            for(int i=0;i<60&&view.Base.PlayerSteps-contactsBefore<2;i++)yield return null;
            int contactSteps=view.Base.PlayerSteps-contactsBefore,footSteps=audioPlayer.FootstepCount-stepsBefore;
            Check(contactSteps>=2&&Mathf.Abs(contactSteps-footSteps)<=1,"footsteps-follow-contact-frames:"+contactSteps+"/"+footSteps);
            SmokeCapture("00c-base-walk.png");
            InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;yield return null;
            Check(!world.Moving&&view.Base.PlayerSpriteName.StartsWith("chr_pilot_idle_e"),"release-stops-on-idle-frames");
            float runFrom=world.PlayerX;int dustBefore=view.Base.DustPuffs;
            InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.A,Key.LeftShift));
            heldFrom=Time.unscaledTime;
            while(Time.unscaledTime-heldFrom<.4f)yield return null;
            float runSpeed=(runFrom-world.PlayerX)/(Time.unscaledTime-heldFrom);
            Check(world.Running&&world.PlayerFacing==Facing.W&&runSpeed>BaseWorld.WalkSpeed*1.2f,"shift-runs-faster:"+runSpeed.ToString("0.0"));
            Check(world.Running&&view.Base.PlayerSpriteName.StartsWith("chr_pilot_run_"),"running-uses-run-frames:"+view.Base.PlayerSpriteName);
            for(int i=0;i<60&&!(view.Base.DustPuffs>dustBefore&&view.Base.ActiveDust>0);i++)yield return null;
            Check(view.Base.DustPuffs>dustBefore,"running-kicks-up-dust:"+(view.Base.DustPuffs-dustBefore));
            SmokeCapture("00c2-base-run.png");
            InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;yield return null;

            // Buildings are solid: walking north into the academy stops at its south wall.
            var academy=map.Find("academy");var academyFoot=map.FootprintOf(academy);float wall=academyFoot.y+academyFoot.h;
            world.PlacePlayer(academyFoot.x+1.5f,wall+1.2f,Facing.N);yield return null;
            InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.W));
            heldFrom=Time.unscaledTime;
            while(Time.unscaledTime-heldFrom<.45f)yield return null;
            InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;yield return null;
            Check(world.PlayerY>=wall+BaseWorld.BodyHalfDepth-.02f&&world.PlayerY<wall+BaseWorld.BodyHalfDepth+.1f,"buildings-block-the-pilot:"+world.PlayerY.ToString("0.00"));
            Check(view.Base.PlayerDrawIndex>view.Base.PlacementDrawIndex("academy"),"y-sort-pilot-in-front-of-building");
            world.PlacePlayer(academyFoot.x+3.5f,academyFoot.y-.4f,Facing.N);yield return null;yield return null;
            Check(view.Base.PlayerDrawIndex<view.Base.PlacementDrawIndex("academy"),"y-sort-pilot-behind-building");

            // SKYLARK without orders: only a hint.
            world.PlacePlayer(map.AircraftReturnX,map.AircraftReturnY,Facing.N);yield return null;yield return null;
            Check(world.NearestKind==InteractKind.Aircraft&&view.Base.PromptLabel=="[E] SKYLARK MK.I","aircraft-prompt-without-orders");
            yield return SmokeKey(Key.E);
            Check(mode==Mode.Base&&view.Base.HintVisible&&view.Base.HintText==BaseContent.NoOrdersHint,"aircraft-without-orders-shows-hint");
        }

        // Professor: dialogue, vocabulary screen, accepting the training mission.
        private IEnumerator SmokeProfessor()
        {
            // Professor Whitmore: prompt, E opens the dialogue, the line types out, E shows it all, Esc closes.
            var professor=world.Npc("professor");
            world.PlacePlayer(professor.X+.8f,professor.Y+1f,Facing.N);yield return null;yield return null;
            Check(world.NearestKind==InteractKind.Npc&&world.NearestId=="professor"&&view.Base.PromptVisible&&view.Base.PromptLabel=="[E] Nói chuyện với Giáo sư Whitmore","professor-prompt-appears-nearby");
            int blipsBefore=audioPlayer.BlipCount;
            yield return SmokeKey(Key.E);
            Check(dialogue.Open&&view.Dialogue.Open&&world.InDialogue&&professor.Talking&&view.Dialogue.SpeakerName.StartsWith("Giáo sư Whitmore"),"e-opens-professor-dialogue");
            for(int i=0;i<60&&view.Dialogue.VisibleCharacters<8;i++)yield return null;
            Check(view.Dialogue.Typing&&view.Dialogue.VisibleCharacters>0&&!view.Dialogue.ChoicesVisible&&audioPlayer.BlipCount>blipsBefore,"dialogue-line-types-out-with-blips");
            Check(view.Dialogue.PortraitName.StartsWith("portrait_professor")&&view.Base.NpcSpriteName("professor").StartsWith("chr_professor_talk_s"),"professor-portrait-and-talking-gestures");
            yield return SmokeKey(Key.E);
            Check(!view.Dialogue.Typing&&view.Dialogue.ChoicesVisible&&view.Dialogue.ChoiceCount==4&&dialogue.Open,"e-shows-whole-line-then-numbered-choices");
            Check(!view.Base.QuestMarkerVisible&&!view.Base.PromptVisible,"marker-and-prompt-hide-while-talking");
            SmokeCapture("00d-professor-dialogue.png");
            yield return SmokeKey(Key.Escape);
            Check(!dialogue.Open&&!view.Dialogue.Open&&!world.InDialogue&&!professor.Talking,"esc-closes-dialogue");
            yield return SmokeKey(Key.Escape);
            Check(mode==Mode.Base&&Time.timeScale==1&&!view.OverlayVisible,"esc-on-base-does-not-pause");

            // "Chọn bộ từ vựng" (key 2) opens the word-set screen; XONG walks back out.
            yield return SmokeKey(Key.E);yield return SmokeKey(Key.Enter);
            string vocabularyChoice=view.Dialogue.ChoiceText(1);
            yield return SmokeKey(Key.Digit2);
            Check(vocabularyChoice=="Chọn bộ từ vựng"&&mode==Mode.Vocabulary&&view.Setup!=null&&!dialogue.Open&&!view.Base.Visible,"professor-opens-vocabulary-screen");
            Check(view.Setup!=null&&view.Setup.Done.GetComponentInChildren<UnityEngine.UI.Text>().text=="XONG","vocabulary-button-reads-done");
            SelectFullOxford(); yield return null;
            Check(selection.to==catalog.Entries.Length,"full-oxford-library");
            SmokeCapture("02-vocabulary.png");
            selection.minimumLevel=selection.maximumLevel=2;selection.topics=new[]{"food"};ResetSelectionRange();
            Check(catalog.Filter(selection).All(e=>e.cefr=="B1"&&e.topics.Contains("food")),"food-b1-filter");
            SelectFullOxford(); yield return null;
            FinishVocabulary(); yield return null;
            Check(mode==Mode.Base&&view.Base.Visible&&!view.OverlayVisible&&view.Base.HintVisible,"done-returns-to-base");
            yield return new WaitForSecondsRealtime(.3f); // Interaction is briefly locked after entering the base.

            // Accept the training mission: mouse picks "Nhận nhiệm vụ", S + E picks Sa mạc, key 1 closes.
            smokeMouse=InputSystem.AddDevice<Mouse>("Wordwing QA pointer");
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=new Vector2(5,5)});
            world.PlacePlayer(professor.X+.8f,professor.Y+1f,Facing.N);yield return null;yield return null;
            yield return SmokeKey(Key.E);yield return SmokeKey(Key.Space);
            Vector2 choicePoint=view.Dialogue.ChoiceScreenPoint(0);
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=choicePoint});yield return null;yield return null;
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=choicePoint}.WithButton(MouseButton.Left,true));yield return null;
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=choicePoint});yield return null;
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=new Vector2(5,5)});yield return null;yield return null;
            Check(dialogue.Open&&dialogue.Current!=null&&dialogue.Current.Id=="pick_env","mouse-click-picks-dialogue-choice");
            yield return SmokeKey(Key.Enter);
            Check(view.Dialogue.ChoicesVisible&&view.Dialogue.ChoiceCount==5&&view.Dialogue.ThumbnailCount==4&&!view.Dialogue.Line.Contains("{"),"battlefield-choices-show-cards");
            yield return SmokeKey(Key.S);
            Check(view.Dialogue.Selected==1,"s-moves-dialogue-selection");
            SmokeCapture("00e-mission-battlefield.png");
            yield return SmokeKey(Key.E);
            Check(missions.Active!=null&&missions.Environment==(int)FlightEnvironment.Desert&&StartingEnvironment==FlightEnvironment.Desert&&dialogue.Current!=null&&dialogue.Current.Id=="accepted","desert-mission-accepted");
            yield return SmokeKey(Key.Space);yield return SmokeKey(Key.Digit1);
            Check(!dialogue.Open&&!world.InDialogue&&!view.Dialogue.Open,"digit-key-ends-dialogue");
            yield return null;
            Check(view.Base.ObjectiveText==missions.Active.Objective&&!view.Base.QuestMarkerVisible,"objective-updates-and-marker-clears");
        }
    }
}

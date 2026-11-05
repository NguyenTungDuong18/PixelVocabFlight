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
        // Only entered by the explicit --smoke-test flag; all writes use the QA profile.
        private IEnumerator SmokeTest()
        {
            string[] args = System.Environment.GetCommandLineArgs(); int at = Array.IndexOf(args, "--smoke-output");
            string output = at >= 0 && at+1 < args.Length ? args[at+1] : Application.persistentDataPath;
            Directory.CreateDirectory(output); StartCoroutine(SmokeWatchdog(output));
            var checks = new List<string>();
            void Check(bool pass,string name) => checks.Add(name + (pass ? ":PASS" : ":FAIL"));
            SelectFullOxford(); yield return null; yield return null;
            bool captured = true;
            int frameFiles=0;bool everySpriteLoads=true;
            foreach(var name in PixelSprites.Names){var frames=PixelSprites.Frames(name);frameFiles+=frames.Length;everySpriteLoads&=frames.All(f=>f&&f.texture.width>0);}
            Check(everySpriteLoads&&frameFiles>=300&&PixelSprites.FrameCount("fighter_level")==4&&PixelSprites.FrameCount("fx_explosion")==8&&PixelSprites.FrameCount("gauge_needle")==48&&PixelSprites.FrameCount("bomber_guns")==11,"pixel-frame-library-loads:"+frameFiles);
            Check(PixelSprites.Texture("terrain_jungle_blur").filterMode==FilterMode.Bilinear&&PixelSprites.Texture("terrain_jungle").filterMode==FilterMode.Point,"blurred-ground-uses-smooth-filtering");
            Check(UiKit.PixelFontLoaded,"pixel-font-vt323-loaded");
            string propellerBefore=view.Board.PlayerSpriteName;view.Board.Animate(.07f,null,StartingEnvironment);
            Check(propellerBefore!=view.Board.PlayerSpriteName,"propeller-frames-advance");

            // ---- Base (0.15): the walkable airbase is the main screen ----
            var map=world.Map;
            Check(mode==Mode.Base&&view.Base.Visible&&view.Base.TitleVisible&&!view.TakeOffVisible&&!view.OverlayVisible,"base-is-main-screen-with-title-card");
            Check(view.Base.GroundMode=="cpu","base-ground-composed-from-readable-tiles:"+view.Base.GroundMode);
            Check(view.Base.MissingSprites==0&&view.Base.PlacementImages==map.Placements.Count&&view.Base.FenceImages>=200,"base-models-each-a-separate-sprite:"+view.Base.PlacementImages+"/"+map.Placements.Count+"/fence "+view.Base.FenceImages+"/missing "+view.Base.MissingSprites);
            yield return new WaitForSecondsRealtime(.3f);
            captured &= view.Capture(Path.Combine(output,"00a-base-title.png"));
            yield return SmokeKey(Key.Space);
            for(int i=0;i<120&&view.Base.TitleVisible;i++)yield return null;
            Check(!view.Base.TitleVisible&&mode==Mode.Base&&!dialogue.Open,"any-key-dismisses-title-card");
            Check(missions.Active==null&&view.Base.ObjectiveText==MissionLog.IdleObjective&&view.Base.QuestMarkerVisible,"idle-objective-and-quest-marker-over-professor");
            captured &= view.Capture(Path.Combine(output,"00b-base-overview.png"));

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
            captured &= view.Capture(Path.Combine(output,"00c-base-walk.png"));
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
            captured &= view.Capture(Path.Combine(output,"00c2-base-run.png"));
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
            captured &= view.Capture(Path.Combine(output,"00d-professor-dialogue.png"));
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
            captured &= view.Capture(Path.Combine(output,"02-vocabulary.png"));
            selection.minimumLevel=selection.maximumLevel=2;selection.topics=new[]{"food"};ResetSelectionRange();
            Check(catalog.Filter(selection).All(e=>e.cefr=="B1"&&e.topics.Contains("food")),"food-b1-filter");
            SelectFullOxford(); yield return null;
            FinishVocabulary(); yield return null;
            Check(mode==Mode.Base&&view.Base.Visible&&!view.OverlayVisible&&view.Base.HintVisible,"done-returns-to-base");
            yield return new WaitForSecondsRealtime(.3f); // Interaction is briefly locked after entering the base.

            // Accept the training mission: mouse picks "Nhận nhiệm vụ", S + E picks Sa mạc, key 1 closes.
            var mouse=InputSystem.AddDevice<Mouse>("Wordwing QA pointer");
            InputSystem.QueueStateEvent(mouse,new MouseState{position=new Vector2(5,5)});
            world.PlacePlayer(professor.X+.8f,professor.Y+1f,Facing.N);yield return null;yield return null;
            yield return SmokeKey(Key.E);yield return SmokeKey(Key.Space);
            Vector2 choicePoint=view.Dialogue.ChoiceScreenPoint(0);
            InputSystem.QueueStateEvent(mouse,new MouseState{position=choicePoint});yield return null;yield return null;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=choicePoint}.WithButton(MouseButton.Left,true));yield return null;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=choicePoint});yield return null;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=new Vector2(5,5)});yield return null;yield return null;
            Check(dialogue.Open&&dialogue.Current!=null&&dialogue.Current.Id=="pick_env","mouse-click-picks-dialogue-choice");
            yield return SmokeKey(Key.Enter);
            Check(view.Dialogue.ChoicesVisible&&view.Dialogue.ChoiceCount==5&&view.Dialogue.ThumbnailCount==4&&!view.Dialogue.Line.Contains("{"),"battlefield-choices-show-cards");
            yield return SmokeKey(Key.S);
            Check(view.Dialogue.Selected==1,"s-moves-dialogue-selection");
            captured &= view.Capture(Path.Combine(output,"00e-mission-battlefield.png"));
            yield return SmokeKey(Key.E);
            Check(missions.Active!=null&&missions.Environment==(int)FlightEnvironment.Desert&&StartingEnvironment==FlightEnvironment.Desert&&dialogue.Current!=null&&dialogue.Current.Id=="accepted","desert-mission-accepted");
            yield return SmokeKey(Key.Space);yield return SmokeKey(Key.Digit1);
            Check(!dialogue.Open&&!world.InDialogue&&!view.Dialogue.Open,"digit-key-ends-dialogue");
            yield return null;
            Check(view.Base.ObjectiveText==missions.Active.Objective&&!view.Base.QuestMarkerVisible,"objective-updates-and-marker-clears");

            // Equipment and airfield views.
            world.PlacePlayer(24f,37.5f,Facing.S);view.Base.ClearHint();yield return null;yield return null;
            Check(view.Base.HasPlacement("tank")&&view.Base.HasPlacement("jeep")&&view.Base.HasPlacement("truck")&&view.Base.HasPlacement("artillery")&&view.Base.HasPlacement("motorcycle"),"motor-pool-vehicles-rendered");
            captured &= view.Capture(Path.Combine(output,"00g-base-motorpool.png"));
            world.PlacePlayer(50f,34.5f,Facing.E);view.Base.ClearHint();yield return null;yield return null; // West of the control tower, clear of its roof.
            Check(view.Base.HasPlacement("control_tower")&&view.Base.HasPlacement(AirbaseMap.PlayerAircraftId)&&view.Base.HasPlacement("hangar_2")&&view.Base.HasPlacement("windsock"),"airfield-tower-and-aircraft-rendered");
            captured &= view.Capture(Path.Combine(output,"00h-base-airfield.png"));

            // ---- Board SKYLARK: take-off cutscene, then the sortie on the chosen battlefield ----
            world.PlacePlayer(map.AircraftReturnX,map.AircraftReturnY,Facing.N);yield return null;yield return null;
            Check(view.Base.PromptLabel=="[E] Lên máy bay SKYLARK MK.I","aircraft-prompt-with-orders");
            view.Base.ClearHint();yield return null;
            captured &= view.Capture(Path.Combine(output,"00f-board-aircraft.png"));
            int enginesBefore=audioPlayer.EngineStarts;
            yield return SmokeKey(Key.E);
            Check(mode==Mode.Launching&&audioPlayer.EngineStarts==enginesBefore+1&&StartingEnvironment==FlightEnvironment.Desert&&!view.Base.Visible&&view.TakeOffVisible,"boarding-starts-take-off-cutscene");
            float heroStartY=-500;
            for(int i=0;i<400&&mode==Mode.Launching&&view.TakeOffElapsed<.6f;i++)yield return null;
            Check(view.TakeOffElapsed>=.6f&&view.CurtainAlpha<.05f,"take-off-opens-from-black-on-the-airfield");
            captured &= view.Capture(Path.Combine(output,"01c-takeoff-engine-start.png"));
            Check(view.TakeOffSmokePuffs>0,"engine-start-smoke-puffs");
            for(int i=0;i<600&&mode==Mode.Launching&&view.TakeOffScroll<500;i++)yield return null;
            Check(view.TakeOffScroll>=500&&view.TakeOffHeroPosition.y>heroStartY+100&&view.TakeOffHeroSize.x<130,"camera-follows-long-take-off-roll-out-of-the-base");
            captured &= view.Capture(Path.Combine(output,"01d-takeoff-roll-leaving-base.png"));
            for(int i=0;i<600&&mode==Mode.Launching&&view.TakeOffScroll<2000;i++)yield return null;
            Check(view.TakeOffScroll>=2000&&view.CurtainAlpha==0,"long-roll-continues-down-the-jungle-runway");
            captured &= view.Capture(Path.Combine(output,"01d2-takeoff-jungle-runway.png"));
            for(int i=0;i<600&&mode==Mode.Launching&&!(view.TakeOffHeroSize.x>150&&view.CurtainAlpha>.1f);i++)yield return null;
            Check(view.TakeOffHeroSize.x>150&&view.CurtainAlpha>.1f,"fighter-lifts-off-and-screen-darkens");
            captured &= view.Capture(Path.Combine(output,"01e-liftoff.png"));
            for(int i=0;i<300&&mode==Mode.Launching;i++)yield return null;
            yield return null; // BeginFlight runs inside Update; the climb is first drawn on the next frame.
            float introStartY=view.Board.PlayerAnchoredPosition.y;
            Check(mode==Mode.Intro&&view.HudAlpha<.2f&&view.CurtainAlpha>.8f&&introStartY<-FlightBoardView.Height,"sortie-opens-from-black-with-fighter-below-edge");
            yield return new WaitForSecondsRealtime(.55f);
            Check(mode==Mode.Intro&&progress.ActiveSeconds==0&&view.HudAlpha>0&&view.HudAlpha<1,"intro-holds-clock-while-instruments-fade-in");
            captured &= view.Capture(Path.Combine(output,"02a-intro-climb.png"));
            for(int i=0;i<300&&mode==Mode.Intro;i++)yield return null;
            Check(mode==Mode.Flying&&view.HudAlpha==1&&view.CurtainAlpha==0&&view.Board.PlayerAnchoredPosition.y>introStartY+150,"fighter-climbs-into-position-and-hud-visible");
            Check(flight.Environment==FlightEnvironment.Desert,"sortie-uses-mission-battlefield");
            Check(view.Board.Focus==1&&view.Board.GroundSharpAlpha==0&&view.Board.GroundSpriteName.StartsWith("terrain_desert_blur"),"land-background-blurred-in-combat");
            Check(view.Board.Wildlife.Count>0&&view.Board.Wildlife.UsesBlurredFrames&&view.Board.Wildlife.SpriteNames.All(n=>n.Contains("_blur_")),"wildlife-on-ground-blurred:"+view.Board.Wildlife.Count);

            Check(progress.Metal==5&&progress.Health==5,"five-metal-health-at-start");
            Check(!view.CaretVisible&&view.PlaceholderVisible&&view.InputText=="","drive-mode-shows-only-placeholder");
            InputSystem.QueueStateEvent(mouse,new MouseState{position=view.Board.ScreenPoint(.22f,.6f)});
            yield return null;yield return null;
            Check(flight.PlayerX > .22f && flight.PlayerX < .5f,"mouse-drive-has-travel-time");
            yield return new WaitForSecondsRealtime(.4f);
            Check(Math.Abs(flight.PlayerX-.22f)<.01,"mouse-horizontal-drive");
            int initial=flight.Enemies.Count,targetId=flight.Target.Id;
            flight.Tick(12.1f);DrainEvents();
            Check(flight.Enemies.Count==initial+1&&flight.Target.Id==targetId,"twelve-second-spawn-keeps-old-plane");
            yield return null;
            Check(view.Board.EnemySpriteName(targetId).StartsWith("bomber_desert_"),"desert-livery-bomber-rendered");
            yield return SmokeType(flight.Target.Entry.word);Check(progress.Correct==0,"driving-blocks-fire");
            yield return SmokeKey(Key.Tab);float fixedX=flight.PlayerX;
            Check(!flight.Driving&&view.CaretVisible&&!view.PlaceholderVisible&&view.InputSpriteName.StartsWith("ui_input_focus"),"tab-focuses-typing-box-with-caret");
            InputSystem.QueueStateEvent(mouse,new MouseState{position=view.Board.ScreenPoint(.82f,.4f)});
            yield return null;yield return null;
            Check(!flight.Driving&&Math.Abs(flight.PlayerX-fixedX)<.001,"tab-switch-locks-position");
            foreach(char c in "wing")InputSystem.QueueTextEvent(keyboard,c);
            yield return null;yield return null;
            Check(view.InputText=="wing"&&view.CaretVisible&&Math.Abs(view.CaretGap-2)<1.5f,"caret-sits-right-after-text:"+view.CaretGap.ToString("0.0"));
            captured &= view.Capture(Path.Combine(output,"02b-cockpit-typing.png"));
            typed="";
            view.SelectPartOfSpeech("");yield return SmokeType(flight.Target.Entry.word);
            Check(progress.Correct==0&&progress.WrongAttempts==1,"desert-requires-part-of-speech");
            view.SelectPartOfSpeech(flight.Target.Entry.pos);yield return new WaitForSecondsRealtime(.3f);
            int spokenBeforeDirect=audioPlayer.PronunciationCount;
            yield return SmokeType(flight.Target.Entry.word);
            Check(progress.Correct==1&&flight.Enemies.Count==1,"correct-answer-only-removes-target");
            Check(audioPlayer.PronunciationCount>spokenBeforeDirect,"direct-shot-pronounces-word");
            Check(view.Board.AnimatedEffects>0,"tracer-and-explosion-frames-play");
            yield return new WaitForSecondsRealtime(.2f);
            captured &= view.Capture(Path.Combine(output,"03b-explosion.png"));
            flight.Tick(12.1f);DrainEvents();yield return null;
            captured &= view.Capture(Path.Combine(output,"03-desert.png"));
            int old=flight.Target.Id,rolls=flight.Rolls;RollMeaning();
            Check(flight.Target.Id!=old&&flight.Rolls==rolls-1,"roll-meaning");
            TogglePause();double time=progress.ActiveSeconds;string pausedProp=view.Board.PlayerSpriteName;yield return new WaitForSecondsRealtime(.3f);
            captured &= view.Capture(Path.Combine(output,"03a-pause.png"));
            Check(pausedProp==view.Board.PlayerSpriteName,"pause-freezes-model-animation");
            Check(progress.ActiveSeconds==time,"pause-freezes-simulation");TogglePause();

            SmokeFixture(FlightEnvironment.Ice);flight.Tick(12.1f);DrainEvents();flight.SetDriving(false);
            var shield=flight.Target;yield return new WaitForSecondsRealtime(.3f);yield return SmokeType(shield.Entry.word);
            Check(flight.Enemies.Contains(shield)&&shield.Health==1&&flight.Target!=shield,"ice-shield-retarget");
            yield return null;captured &= view.Capture(Path.Combine(output,"04-ice.png"));
            Check(view.Board.EnemySpriteName(shield.Id).StartsWith("bomber_ice_damaged_"),"ice-hit-shows-damaged-frames");

            // ---- Enemy aircraft: guns out, lock-on sight, homing burst, bank away ----
            SmokeFixture(FlightEnvironment.Jungle);flight.SetDriving(false);var attacker=flight.Target;
            int warningsBefore=audioPlayer.LockWarningCount;
            flight.Tick(18.1f);DrainEvents();
            Check(attacker.Phase==EnemyPhase.Locking&&attacker.LockRemaining>0&&flight.Target==attacker&&audioPlayer.LockWarningCount>warningsBefore,"aircraft-lock-warning");
            flight.Tick(1.2f);DrainEvents();yield return null;yield return null;
            Check(view.Board.EnemyGunsVisible(attacker.Id)&&view.Board.ReticleSpriteName.StartsWith("fx_lock_reticle"),"guns-deploy-and-sight-on-player");
            captured &= view.Capture(Path.Combine(output,"05-lock-on.png"));
            for(int i=0;flight.Shots.Count==0&&i<200;i++)flight.Tick(.05f);
            DrainEvents();view.Board.Animate(.12f,flight,FlightEnvironment.Jungle);
            Check(flight.Shots.Count>0&&attacker.Departing&&view.Board.EnemySpriteName(attacker.Id).Contains("_bank_"),"attacker-fires-then-banks-away");
            Check(view.Board.VisibleShots>0,"homing-tracers-rendered");
            captured &= view.Capture(Path.Combine(output,"05b-homing-burst.png"));
            // Try to dodge: drive hard to the far side while the burst is in the air.
            flight.SetDriving(true);float dodgeFrom=flight.PlayerX;flight.MovePlayer(dodgeFrom<.5f?.95f:.05f);
            for(int i=0;flight.Shots.Count>0&&i<100;i++)flight.Tick(.03f);
            DrainEvents();view.Refresh(flight);yield return null;
            Check(progress.Metal==4&&Math.Abs(flight.PlayerX-dodgeFrom)>.05f,"homing-burst-cannot-be-dodged-minus-one-metal");
            captured &= view.Capture(Path.Combine(output,"06-damaged-hull.png"));
            for(int i=0;flight.Enemies.Contains(attacker)&&i<200;i++)flight.Tick(.05f);
            Check(!flight.Enemies.Contains(attacker),"attacker-leaves-the-frame");
            progress.CollectMetal();view.Refresh(flight);Check(progress.Metal==5,"metal-repairs-one-health");

            // ---- Rocket: four separate tags grow out of the body; keys 1-4; lock + boost ----
            SmokeFixture(FlightEnvironment.Ocean);flight.SetDriving(false);
            int guard=0;
            while((flight.Missiles.Count==0||flight.Enemies.Count<2)&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.2f);}
            SmokeHeal();DrainEvents();view.Refresh(flight);
            bool ocean=flight.Missiles.Count>0&&!progress.IsOver;Check(ocean,"carrier-launches-incoming-missile");
            if(ocean)
            {
                Check(PixelTerrain.Get(FlightEnvironment.Ocean,0)&&PixelTerrain.Get(FlightEnvironment.Ocean,1)&&PixelTerrain.Get(FlightEnvironment.Ocean,2),"pixel-ocean-variants-loaded");
                var wide=PixelTerrain.Get(FlightEnvironment.Ocean,3);
                Check(wide&&wide.width/(float)wide.height>2f,"wide-ocean-fill-packaged");
                Check(view.Board.GroundSpriteName=="","ocean-has-no-blurred-land");
                var missile=flight.Missiles.OrderByDescending(m=>m.Y).First();
                SmokeClearOtherHazards(missile.Id);missile.Y=.3f;missile.Phase=MissilePhase.Cruise;missile.PhaseSeconds=0;missile.WrongAttempts=0;flight.Tick(.01f);DrainEvents();
                double speed=Math.Sqrt(missile.VelocityX*missile.VelocityX+Math.Pow(missile.VelocityY*ContinuousFlight.FieldAspect,2));
                Check(Math.Abs(speed-.028)<.00001,"missile-base-speed-reduced-twenty-percent");
                InputSystem.QueueStateEvent(mouse,new MouseState{position=new Vector2(10,10)});
                view.Board.Animate(.06f,flight,FlightEnvironment.Ocean);
                Vector2 centre=new Vector2(missile.X*FlightBoardView.Width,-missile.Y*FlightBoardView.Height);
                Check(view.Board.OpenMissileId==missile.Id&&view.Board.MissileChoiceScale(missile.Id,0)<.9f&&Vector2.Distance(view.Board.MissileChoiceAnchored(missile.Id,0),centre)<90,"tags-start-small-at-rocket-body");
                yield return null;captured &= view.Capture(Path.Combine(output,"07a-missile-tags-opening.png"));
                float waterTime=view.Board.OceanAnimationSeconds;
                yield return new WaitForSecondsRealtime(.75f);
                Check(view.Board.OceanAnimationSeconds>waterTime,"ocean-water-effects-animate");
                bool separate=true;
                for(int i=0;i<4;i++)for(int j=i+1;j<4;j++){var d=view.Board.MissileChoiceAnchored(missile.Id,i)-view.Board.MissileChoiceAnchored(missile.Id,j);separate&=Mathf.Abs(d.x)>=156||Mathf.Abs(d.y)>=40;}
                Check(view.Board.MissileChoicesFullyOpen(missile.Id)&&view.Board.VisibleMissilePopupCount==1&&separate&&Enumerable.Range(0,4).All(i=>Mathf.Abs(view.Board.MissileChoiceScale(missile.Id,i)-1)<.01f),"four-separate-tags-grow-to-full-size");
                captured &= view.Capture(Path.Combine(output,"07b-missile-tags-open.png"));
                int wrongChoice=(missile.CorrectIndex+1)%4;
                int rejectBefore=audioPlayer.MissileRejectCount,blastBefore=view.Board.BlastEffects,healthBeforeWrong=progress.Metal;
                InputSystem.QueueTextEvent(keyboard,(char)('1'+wrongChoice));yield return null;yield return null;
                Check(missile.WrongAttempts==1&&view.Board.IsMissileFlashing(missile.Id)&&typed=="","digit-key-answers-rocket-and-flashes-red");
                Check(audioPlayer.MissileRejectCount==rejectBefore+1,"wrong-answer-plays-subtle-sound");
                Check(flight.Missiles.Contains(missile)&&view.Board.BlastEffects==blastBefore&&progress.Metal==healthBeforeWrong,"wrong-answer-does-not-explode-or-damage-player");
                captured &= view.Capture(Path.Combine(output,"07c-wrong-answer-red-edges.png"));

                foreach(var victim in flight.Enemies.Take(2)){victim.X=missile.X;victim.Y=missile.Y;victim.Age=0;victim.Phase=EnemyPhase.Patrol;}
                int spokenBeforeBlast=audioPlayer.PronunciationCount,queuedBeforeBlast=speech.Count,killsBefore=progress.Correct;
                yield return null;
                Vector2 buttonPoint=view.Board.MissilePopupChoiceScreenPoint(missile.Id,missile.CorrectIndex);
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint}.WithButton(MouseButton.Left,true));yield return null;
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                Check(!flight.Missiles.Contains(missile),"clicking-correct-tag-blasts-rocket");
                Check(progress.Correct==killsBefore+1&&progress.BlastKills>=2&&audioPlayer.PronunciationCount==spokenBeforeBlast&&speech.Count==queuedBeforeBlast,"blast-multikill-does-not-pronounce-words");
                captured &= view.Capture(Path.Combine(output,"07d-silent-blast.png"));
                guard=0;
                while((flight.Missiles.Count==0||flight.Enemies.Count==0)&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.2f);}
                SmokeHeal();DrainEvents();
                if(flight.Missiles.Count>0)
                {
                    missile=flight.Missiles[0];int wrong=(missile.CorrectIndex+1)%4;
                    SmokeClearOtherHazards(missile.Id);int before=progress.Metal;
                    ChooseMissileAnswer(missile.Id,wrong);ChooseMissileAnswer(missile.Id,wrong);ChooseMissileAnswer(missile.Id,wrong);
                    Check(missile.Failed&&!progress.IsOver&&progress.Metal==before,"three-errors-lock-without-instant-death");
                    flight.Tick(.05f);DrainEvents();
                    Check(missile.Phase==MissilePhase.Locking,"failed-rocket-locks-on");
                    for(int i=0;missile.Phase!=MissilePhase.Boost&&i<40;i++)flight.Tick(.05f);
                    DrainEvents();view.Board.Animate(.05f,flight,FlightEnvironment.Ocean);
                    Check(missile.Phase==MissilePhase.Boost&&view.Board.MissileSpriteName(missile.Id).StartsWith("rocket_boost"),"rocket-boosts-with-big-exhaust");
                    yield return null;captured &= view.Capture(Path.Combine(output,"08a-rocket-boost.png"));
                    flight.SetDriving(true);float dodge=flight.PlayerX;flight.MovePlayer(dodge<.5f?.95f:.05f);
                    for(int i=0;flight.Missiles.Contains(missile)&&i<200;i++)flight.Tick(.02f);
                    DrainEvents();view.Refresh(flight);yield return null;
                    Check(progress.Metal==before-2&&!flight.Missiles.Contains(missile),"boosted-rocket-cannot-be-dodged-minus-two-metal");
                    captured &= view.Capture(Path.Combine(output,"08-missile-damage.png"));
                    // End with one actual homing burst at one remaining health.
                    SmokeClearOtherHazards(-1);flight.Tick(ContinuousFlight.ImpactGraceSeconds + .05f);
                    progress.Damage(progress.Metal-1);
                    if(flight.Enemies.Count>0)
                    {
                        attacker=flight.Enemies[0];attacker.Phase=EnemyPhase.Locking;attacker.LockRemaining=.001f;
                        for(int i=0;!progress.IsOver&&i<60;i++)flight.Tick(.05f);
                        DrainEvents();yield return new WaitForSecondsRealtime(.9f);
                        Check(progress.Metal==0&&mode==Mode.Results,"zero-metal-causes-gameover");
                    }
                    else Check(false,"zero-metal-causes-gameover");
                }
                else Check(false,"second-missile-fixture");
            }
            yield return null;captured &= view.Capture(Path.Combine(output,"09-results.png"));
            SmokeFixture(FlightEnvironment.Ocean);flight.SetDriving(false);guard=0;
            while(flight.Carriers.Count==0&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.1f);}
            if(flight.Carriers.Count>0)
            {
                var carrier=flight.Carriers[0];guard=0;
                while(carrier.Phase==CarrierPhase.Entering&&guard++<500){SmokeHeal();flight.Tick(.025f);}
                DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Deploying&&Math.Abs(carrier.Y-.2f)<.001,"carrier-holds-at-eighty-percent-from-player");
                captured &= view.Capture(Path.Combine(output,"10-carrier-deploying.png"));
                SmokeAdvanceSafe(20.1f);
                Check(carrier.Phase==CarrierPhase.Turning&&Math.Abs(carrier.DeploymentSeconds-20)<.001,"carrier-deploys-for-twenty-seconds");
                float turnX=carrier.X,turnY=carrier.Y;
                SmokeAdvanceSafe(1);DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Turning&&Math.Abs(carrier.X-turnX)<.00001f&&Math.Abs(carrier.Y-turnY)<.00001f&&Math.Abs(carrier.HeadingDegrees)>0,"carrier-turns-bow-before-moving");
                Check(Vector2.Distance(view.Board.CarrierVisualScreenCenter(carrier.Id),view.Board.ScreenPoint(carrier.X,carrier.Y))<1,"carrier-rotates-about-physical-centre");
                captured &= view.Capture(Path.Combine(output,"10b-carrier-turning.png"));
                guard=0;while(carrier.Phase==CarrierPhase.Turning&&guard++<200){SmokeHeal();flight.Tick(.025f);}
                float departingX=carrier.X;
                SmokeAdvanceSafe(5);DrainEvents();view.Refresh(flight);yield return null;
                Check(Math.Abs(carrier.X-departingX)>.01f&&carrier.Y>.2f&&carrier.Y<.5f,"carrier-begins-gentle-diagonal-departure");
                float heading=(float)(Math.Atan2(carrier.VelocityX,carrier.VelocityY*ContinuousFlight.FieldAspect)*180/Math.PI);
                Check(Math.Abs(heading-carrier.HeadingDegrees)<.1f&&Math.Abs(Mathf.DeltaAngle(view.Board.CarrierVisualAngle(carrier.Id),180+heading))<.1f,"carrier-bow-and-visual-align-with-travel");
                captured &= view.Capture(Path.Combine(output,"10a-carrier-diagonal.png"));
                int launches=carrier.AircraftLaunched,fireChecks=carrier.MissileChecks;guard=0;
                while(carrier.Phase!=CarrierPhase.Exiting&&guard++<1000){SmokeHeal();flight.Tick(.025f);}
                DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Exiting&&carrier.Y>=.5f&&carrier.Y<.51f&&carrier.ExitDirection==(carrier.X<=.5f?-1:1),"carrier-exits-nearest-edge-at-fifty-percent");
                captured &= view.Capture(Path.Combine(output,"11-carrier-exiting.png"));
                guard=0;while(flight.Carriers.Contains(carrier)&&guard++<500){SmokeHeal();flight.Tick(.025f);}
                Check(!flight.Carriers.Contains(carrier)&&carrier.AircraftLaunched==launches&&carrier.MissileChecks==fireChecks,"carrier-leaves-with-no-launches-after-deployment");
            }
            else Check(false,"carrier-route-fixture");

            // ---- Results: VỀ CĂN CỨ (Enter) reports the sortie to the mission log and returns to the base ----
            SmokeFixture(FlightEnvironment.Desert);yield return null;
            EndFlight();int finalScore=progress.Score,completedBefore=missions.Completed;bool activeBefore=missions.Active!=null;
            yield return null;
            Check(mode==Mode.Results&&view.ResultsButton!=null&&view.ResultsButton.GetComponentInChildren<UnityEngine.UI.Text>().text.StartsWith("VỀ CĂN CỨ"),"results-offer-return-to-base");
            yield return new WaitForSecondsRealtime(.45f);
            yield return SmokeKey(Key.Enter);
            Check(activeBefore&&mode==Mode.Base&&missions.Completed==completedBefore+1&&missions.Active==null&&missions.LastScore==finalScore&&profile.Profile.missionsCompleted==missions.Completed&&profile.Profile.lastScore==finalScore,"results-enter-reports-mission-and-returns-to-base");
            Check(Mathf.Abs(world.PlayerX-map.AircraftReturnX)<.01f&&Mathf.Abs(world.PlayerY-map.AircraftReturnY)<.01f&&view.Base.Visible&&!view.TakeOffVisible&&!view.OverlayVisible,"pilot-stands-beside-aircraft-after-sortie");
            yield return null;
            Check(view.Base.ObjectiveText==MissionLog.IdleObjective&&view.Base.QuestMarkerVisible,"objective-resets-for-next-sortie");
            captured &= view.Capture(Path.Combine(output,"12-back-at-base.png"));
            Check(captured,"rendered-screenshots");
            File.WriteAllText(Path.Combine(output,"smoke-report.json"),"{\n  \"version\": \"0.15.0\",\n  \"checks\": ["+string.Join(",",checks.Select(c=>"\""+c+"\""))+"]\n}");
            Application.Quit(checks.Any(c=>c.EndsWith(":FAIL"))?1:0);
        }

        private void SmokeFixture(FlightEnvironment environment)
        {
            flight=new ContinuousFlight(flightPool,42,environment);progress=flight.Progress;SetMode(Mode.Flying);view.FinishIntro();
            typed="";Time.timeScale=1;audioPlayer.Stop();speech.Clear();view.Board.Clear();view.Board.SetEnvironment(environment);
            bestKey="qa-collision-v2:"+environment;
            view.NewFlight("QA / OXFORD 5000 / "+flightPool.Length+" MỤC");DrainEvents();view.Refresh(flight);
        }
        private void SmokeHeal(){while(progress.Metal<5&&!progress.IsOver)progress.CollectMetal();}
        private void SmokeAdvanceSafe(float duration)
        {
            for(float elapsed=0;elapsed<duration;){float step=Math.Min(.025f,duration-elapsed);SmokeHeal();flight.Tick(step);elapsed+=step;}
        }
        private void SmokeClearOtherHazards(int missileId)
        {
            foreach(var enemy in flight.Enemies){enemy.Age=0;enemy.Phase=EnemyPhase.Patrol;enemy.Y=0;}
            foreach(var missile in flight.Missiles.Where(m=>m.Id!=missileId)){missile.X=.05f;missile.Y=.02f;missile.Phase=MissilePhase.Cruise;missile.PhaseSeconds=0;}
        }
        private IEnumerator SmokeWatchdog(string output)
        {
            yield return new WaitForSecondsRealtime(120);
            File.WriteAllText(Path.Combine(output,"watchdog-failure.txt"),"Runtime verification exceeded 120 seconds. See player log.");
            Application.Quit(1);
        }
    }
}

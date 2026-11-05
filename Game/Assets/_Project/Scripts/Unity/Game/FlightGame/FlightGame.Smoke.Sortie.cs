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
        // Equipment views, boarding SKYLARK, take-off cutscene and battle intro.
        private IEnumerator SmokeTakeOff()
        {
            var map=world.Map;
            // Equipment and airfield views.
            world.PlacePlayer(24f,37.5f,Facing.S);view.Base.ClearHint();yield return null;yield return null;
            Check(view.Base.HasPlacement("tank")&&view.Base.HasPlacement("jeep")&&view.Base.HasPlacement("truck")&&view.Base.HasPlacement("artillery")&&view.Base.HasPlacement("motorcycle"),"motor-pool-vehicles-rendered");
            SmokeCapture("00g-base-motorpool.png");
            world.PlacePlayer(50f,34.5f,Facing.E);view.Base.ClearHint();yield return null;yield return null; // West of the control tower, clear of its roof.
            Check(view.Base.HasPlacement("control_tower")&&view.Base.HasPlacement(AirbaseMap.PlayerAircraftId)&&view.Base.HasPlacement("hangar_2")&&view.Base.HasPlacement("windsock"),"airfield-tower-and-aircraft-rendered");
            SmokeCapture("00h-base-airfield.png");

            // ---- Board SKYLARK: take-off cutscene, then the sortie on the chosen battlefield ----
            world.PlacePlayer(map.AircraftReturnX,map.AircraftReturnY,Facing.N);yield return null;yield return null;
            Check(view.Base.PromptLabel=="[E] Lên máy bay SKYLARK MK.I","aircraft-prompt-with-orders");
            view.Base.ClearHint();yield return null;
            SmokeCapture("00f-board-aircraft.png");
            int enginesBefore=audioPlayer.EngineStarts;
            yield return SmokeKey(Key.E);
            Check(mode==Mode.Launching&&audioPlayer.EngineStarts==enginesBefore+1&&StartingEnvironment==FlightEnvironment.Desert&&!view.Base.Visible&&view.TakeOffVisible,"boarding-starts-take-off-cutscene");
            float heroStartY=-500;
            for(int i=0;i<400&&mode==Mode.Launching&&view.TakeOffElapsed<.6f;i++)yield return null;
            Check(view.TakeOffElapsed>=.6f&&view.CurtainAlpha<.05f,"take-off-opens-from-black-on-the-airfield");
            SmokeCapture("01c-takeoff-engine-start.png");
            Check(view.TakeOffSmokePuffs>0,"engine-start-smoke-puffs");
            for(int i=0;i<600&&mode==Mode.Launching&&view.TakeOffScroll<500;i++)yield return null;
            Check(view.TakeOffScroll>=500&&view.TakeOffHeroPosition.y>heroStartY+100&&view.TakeOffHeroSize.x<130,"camera-follows-long-take-off-roll-out-of-the-base");
            SmokeCapture("01d-takeoff-roll-leaving-base.png");
            for(int i=0;i<600&&mode==Mode.Launching&&view.TakeOffScroll<2000;i++)yield return null;
            Check(view.TakeOffScroll>=2000&&view.CurtainAlpha==0,"long-roll-continues-down-the-jungle-runway");
            SmokeCapture("01d2-takeoff-jungle-runway.png");
            for(int i=0;i<600&&mode==Mode.Launching&&!(view.TakeOffHeroSize.x>150&&view.CurtainAlpha>.1f);i++)yield return null;
            Check(view.TakeOffHeroSize.x>150&&view.CurtainAlpha>.1f,"fighter-lifts-off-and-screen-darkens");
            SmokeCapture("01e-liftoff.png");
            for(int i=0;i<300&&mode==Mode.Launching;i++)yield return null;
            yield return null; // BeginFlight runs inside Update; the climb is first drawn on the next frame.
            float introStartY=view.Board.PlayerAnchoredPosition.y;
            Check(mode==Mode.Intro&&view.HudAlpha<.2f&&view.CurtainAlpha>.8f&&introStartY<-FlightBoardView.Height,"sortie-opens-from-black-with-fighter-below-edge");
            yield return new WaitForSecondsRealtime(.55f);
            Check(mode==Mode.Intro&&progress.ActiveSeconds==0&&view.HudAlpha>0&&view.HudAlpha<1,"intro-holds-clock-while-instruments-fade-in");
            SmokeCapture("02a-intro-climb.png");
            for(int i=0;i<300&&mode==Mode.Intro;i++)yield return null;
            Check(mode==Mode.Flying&&view.HudAlpha==1&&view.CurtainAlpha==0&&view.Board.PlayerAnchoredPosition.y>introStartY+150,"fighter-climbs-into-position-and-hud-visible");
            Check(flight.Environment==FlightEnvironment.Desert,"sortie-uses-mission-battlefield");
            Check(view.Board.Focus==1&&view.Board.GroundSharpAlpha==0&&view.Board.GroundSpriteName.StartsWith("terrain_desert_blur"),"land-background-blurred-in-combat");
            Check(view.Board.Wildlife.Count>0&&view.Board.Wildlife.UsesBlurredFrames&&view.Board.Wildlife.SpriteNames.All(n=>n.Contains("_blur_")),"wildlife-on-ground-blurred:"+view.Board.Wildlife.Count);
        }

        // Cockpit: drive/type modes, answering, roll, pause, ice shield.
        private IEnumerator SmokeCockpit()
        {
            Check(progress.Metal==5&&progress.Health==5,"five-metal-health-at-start");
            Check(!view.CaretVisible&&view.PlaceholderVisible&&view.InputText=="","drive-mode-shows-only-placeholder");
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=view.Board.ScreenPoint(.22f,.6f)});
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
            InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=view.Board.ScreenPoint(.82f,.4f)});
            yield return null;yield return null;
            Check(!flight.Driving&&Math.Abs(flight.PlayerX-fixedX)<.001,"tab-switch-locks-position");
            foreach(char c in "wing")InputSystem.QueueTextEvent(keyboard,c);
            yield return null;yield return null;
            Check(view.InputText=="wing"&&view.CaretVisible&&Math.Abs(view.CaretGap-2)<1.5f,"caret-sits-right-after-text:"+view.CaretGap.ToString("0.0"));
            SmokeCapture("02b-cockpit-typing.png");
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
            SmokeCapture("03b-explosion.png");
            flight.Tick(12.1f);DrainEvents();yield return null;
            SmokeCapture("03-desert.png");
            int old=flight.Target.Id,rolls=flight.Rolls;RollMeaning();
            Check(flight.Target.Id!=old&&flight.Rolls==rolls-1,"roll-meaning");
            TogglePause();double time=progress.ActiveSeconds;string pausedProp=view.Board.PlayerSpriteName;yield return new WaitForSecondsRealtime(.3f);
            SmokeCapture("03a-pause.png");
            Check(pausedProp==view.Board.PlayerSpriteName,"pause-freezes-model-animation");
            Check(progress.ActiveSeconds==time,"pause-freezes-simulation");TogglePause();

            SmokeFixture(FlightEnvironment.Ice);flight.Tick(12.1f);DrainEvents();flight.SetDriving(false);
            var shield=flight.Target;yield return new WaitForSecondsRealtime(.3f);yield return SmokeType(shield.Entry.word);
            Check(flight.Enemies.Contains(shield)&&shield.Health==1&&flight.Target!=shield,"ice-shield-retarget");
            yield return null;SmokeCapture("04-ice.png");
            Check(view.Board.EnemySpriteName(shield.Id).StartsWith("bomber_ice_damaged_"),"ice-hit-shows-damaged-frames");
        }
    }
}

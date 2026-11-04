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
            SelectFullOxford(); ReturnToMenu(); yield return new WaitForSecondsRealtime(.3f);
            bool captured = view.Capture(Path.Combine(output,"01-hangar.png"));
            int frameFiles=0;bool everySpriteLoads=true;
            foreach(var name in PixelSprites.Names){var frames=PixelSprites.Frames(name);frameFiles+=frames.Length;everySpriteLoads&=frames.All(f=>f&&f.texture.width>0);}
            Check(everySpriteLoads&&frameFiles>=300&&PixelSprites.FrameCount("fighter_level")==4&&PixelSprites.FrameCount("fx_explosion")==8&&PixelSprites.FrameCount("gauge_needle")==48&&PixelSprites.FrameCount("bomber_guns")==11,"pixel-frame-library-loads:"+frameFiles);
            Check(PixelSprites.Texture("terrain_jungle_blur").filterMode==FilterMode.Bilinear&&PixelSprites.Texture("terrain_jungle").filterMode==FilterMode.Point,"blurred-ground-uses-smooth-filtering");
            Check(UiKit.PixelFontLoaded,"pixel-font-vt323-loaded");
            Check(view.HangarVisible,"title-screen-visible");
            string propellerBefore=view.Board.PlayerSpriteName;view.Board.Animate(.07f,null,StartingEnvironment);
            Check(propellerBefore!=view.Board.PlayerSpriteName,"propeller-frames-advance");
            yield return SmokeKey(Key.Digit4);
            Check(StartingEnvironment==FlightEnvironment.Ocean&&view.HangarVisible,"hangar-number-key-selects-battlefield");
            captured &= view.Capture(Path.Combine(output,"01b-hangar-ocean-selected.png"));
            yield return SmokeKey(Key.Digit1);
            SelectFullOxford(); yield return null;
            Check(selection.to==catalog.Entries.Length,"full-oxford-library");
            captured &= view.Capture(Path.Combine(output,"02-vocabulary.png"));
            selection.minimumLevel=selection.maximumLevel=2;selection.topics=new[]{"food"};ResetSelectionRange();
            Check(catalog.Filter(selection).All(e=>e.cefr=="B1"&&e.topics.Contains("food")),"food-b1-filter");

            // ---- Take-off: panels slide away, engine starts, fighter rolls, lifts off, fade to the sortie ----
            SelectFullOxford();StartingEnvironment=FlightEnvironment.Desert;ShowHangar();yield return null;
            float heroStartY=view.HangarHeroPosition.y;int enginesBefore=audioPlayer.EngineStarts;
            yield return SmokeKey(Key.Enter);
            Check(mode==Mode.Launching&&audioPlayer.EngineStarts==enginesBefore+1,"enter-starts-take-off-and-engine");
            for(int i=0;i<400&&mode==Mode.Launching&&view.HangarBoardX<1455;i++)yield return null;
            Check(view.HangarBoardX>=1455&&view.HangarBrandX<=-430,"take-off-cards-slide-to-both-sides");
            captured &= view.Capture(Path.Combine(output,"01c-takeoff-engine-start.png"));
            Check(view.HangarSmokePuffs>0,"engine-start-smoke-puffs");
            for(int i=0;i<600&&mode==Mode.Launching&&view.HangarScroll<500;i++)yield return null;
            Check(view.HangarScroll>=500&&view.HangarHeroPosition.y>heroStartY+100&&view.HangarHeroSize.x<130,"camera-follows-long-take-off-roll-out-of-the-base");
            captured &= view.Capture(Path.Combine(output,"01d-takeoff-roll-leaving-base.png"));
            for(int i=0;i<600&&mode==Mode.Launching&&view.HangarScroll<2000;i++)yield return null;
            Check(view.HangarScroll>=2000&&view.CurtainAlpha==0,"long-roll-continues-down-the-jungle-runway");
            captured &= view.Capture(Path.Combine(output,"01d2-takeoff-jungle-runway.png"));
            for(int i=0;i<600&&mode==Mode.Launching&&!(view.HangarHeroSize.x>150&&view.CurtainAlpha>.1f);i++)yield return null;
            Check(view.HangarHeroSize.x>150&&view.CurtainAlpha>.1f,"fighter-lifts-off-and-screen-darkens");
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
            Check(view.Board.Focus==1&&view.Board.GroundSharpAlpha==0&&view.Board.GroundSpriteName.StartsWith("terrain_desert_blur"),"land-background-blurred-in-combat");
            Check(view.Board.Wildlife.Count>0&&view.Board.Wildlife.UsesBlurredFrames&&view.Board.Wildlife.SpriteNames.All(n=>n.Contains("_blur_")),"wildlife-on-ground-blurred:"+view.Board.Wildlife.Count);

            Check(progress.Metal==5&&progress.Health==5,"five-metal-health-at-start");
            Check(!view.CaretVisible&&view.PlaceholderVisible&&view.InputText=="","drive-mode-shows-only-placeholder");
            var mouse=InputSystem.AddDevice<Mouse>("Wordwing QA pointer");
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
            Check(captured,"rendered-screenshots");
            File.WriteAllText(Path.Combine(output,"smoke-report.json"),"{\n  \"version\": \"0.14.0\",\n  \"checks\": ["+string.Join(",",checks.Select(c=>"\""+c+"\""))+"]\n}");
            Application.Quit(checks.Any(c=>c.EndsWith(":FAIL"))?1:0);
        }

        private void SmokeFixture(FlightEnvironment environment)
        {
            flight=new ContinuousFlight(flightPool,42,environment);progress=flight.Progress;mode=Mode.Flying;view.FinishIntro();
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
            yield return new WaitForSecondsRealtime(75);
            File.WriteAllText(Path.Combine(output,"watchdog-failure.txt"),"Runtime verification exceeded seventy-five seconds. See player log.");
            Application.Quit(1);
        }
    }
}

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
            Check(everySpriteLoads&&frameFiles>=150&&PixelSprites.FrameCount("fighter_level")==4&&PixelSprites.FrameCount("fx_explosion")==8,"pixel-frame-library-loads:"+frameFiles);
            Check(UiKit.PixelFontLoaded,"pixel-font-vt323-loaded");
            Check(view.HangarVisible,"title-screen-visible");
            string propellerBefore=view.Board.PlayerSpriteName;view.Board.Animate(.07f,null,StartingEnvironment);
            Check(propellerBefore!=view.Board.PlayerSpriteName,"propeller-frames-advance");
            yield return SmokeKey(Key.Digit4);
            Check(StartingEnvironment==FlightEnvironment.Ocean&&view.HangarVisible,"hangar-number-key-selects-battlefield");
            captured &= view.Capture(Path.Combine(output,"01b-hangar-ocean-selected.png"));
            yield return SmokeKey(Key.Digit1);
            Check(PixelTerrain.Get(FlightEnvironment.Jungle)==PixelTerrain.Get(FlightEnvironment.Jungle),"terrain-textures-reused");
            SelectFullOxford(); yield return null;
            Check(selection.to==catalog.Entries.Length,"full-oxford-library");
            captured &= view.Capture(Path.Combine(output,"02-vocabulary.png"));
            selection.minimumLevel=selection.maximumLevel=2;selection.topics=new[]{"food"};ResetSelectionRange();
            Check(catalog.Filter(selection).All(e=>e.cefr=="B1"&&e.topics.Contains("food")),"food-b1-filter");
            SelectFullOxford();StartingEnvironment=FlightEnvironment.Desert;StartFlight();yield return new WaitForSecondsRealtime(.5f);
            Check(progress.Metal==5&&progress.Health==5,"five-metal-health-at-start");
            var mouse=InputSystem.AddDevice<Mouse>("Wordwing QA pointer");
            InputSystem.QueueStateEvent(mouse,new MouseState{position=view.Board.ScreenPoint(.22f,.6f)});
            yield return null;yield return null;
            Check(flight.PlayerX > .22f && flight.PlayerX < .5f,"mouse-drive-has-travel-time");
            yield return new WaitForSecondsRealtime(.4f);
            Check(Math.Abs(flight.PlayerX-.22f)<.01,"mouse-horizontal-drive");
            int initial=flight.Enemies.Count,targetId=flight.Target.Id;
            flight.Tick(12.1f);DrainEvents();
            Check(flight.Enemies.Count==initial+1&&flight.Target.Id==targetId,"twelve-second-spawn-keeps-old-plane");
            Check(view.Board.EnemySpriteName(targetId).StartsWith("bomber_desert_"),"desert-livery-bomber-rendered");
            yield return SmokeType(flight.Target.Entry.word);Check(progress.Correct==0,"driving-blocks-fire");
            yield return SmokeKey(Key.Tab);float fixedX=flight.PlayerX;
            InputSystem.QueueStateEvent(mouse,new MouseState{position=view.Board.ScreenPoint(.82f,.4f)});
            yield return null;yield return null;
            Check(!flight.Driving&&Math.Abs(flight.PlayerX-fixedX)<.001,"tab-switch-locks-position");
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

            SmokeFixture(FlightEnvironment.Jungle);flight.SetDriving(false);var attacker=flight.Target;
            flight.Tick(18.1f);DrainEvents();yield return null;
            Check(attacker.Charging&&attacker.ChargeDelay>0,"aircraft-charge-warning");
            captured &= view.Capture(Path.Combine(output,"05-charge-warning.png"));
            for(int i=0;flight.Enemies.Contains(attacker)&&i<100;i++)flight.Tick(.05f);
            DrainEvents();view.Refresh(flight);yield return null;
            Check(progress.Metal==4&&!flight.Enemies.Contains(attacker),"aircraft-impact-minus-one-metal");
            captured &= view.Capture(Path.Combine(output,"06-damaged-hull.png"));
            progress.CollectMetal();view.Refresh(flight);Check(progress.Metal==5,"metal-repairs-one-health");

            SmokeFixture(FlightEnvironment.Ocean);flight.SetDriving(false);
            int guard=0;
            while((flight.Missiles.Count==0||flight.Enemies.Count<2)&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.2f);}
            SmokeHeal();DrainEvents();view.Refresh(flight);yield return null;
            bool ocean=flight.Missiles.Count>0&&!progress.IsOver;Check(ocean,"carrier-launches-incoming-missile");
            if(ocean)
            {
                Check(PixelTerrain.Get(FlightEnvironment.Ocean,0)&&PixelTerrain.Get(FlightEnvironment.Ocean,1)&&PixelTerrain.Get(FlightEnvironment.Ocean,2),"pixel-ocean-variants-loaded");
                var wide=PixelTerrain.Get(FlightEnvironment.Ocean,3);
                Check(wide&&wide.width/(float)wide.height>2f,"wide-ocean-fill-packaged");
                float waterTime=view.Board.OceanAnimationSeconds;view.Board.Animate(.5f,flight,FlightEnvironment.Ocean);
                Check(view.Board.OceanAnimationSeconds>waterTime,"ocean-water-effects-animate");
                captured &= view.Capture(Path.Combine(output,"07-ocean-supplied-01.png"));
                view.Board.Animate(35,flight,FlightEnvironment.Ocean);
                int secondImage=view.Board.OceanImageIndex;
                captured &= view.Capture(Path.Combine(output,"07-ocean-supplied-02.png"));
                view.Board.Animate(35,flight,FlightEnvironment.Ocean);
                Check(view.Board.OceanImageIndex!=secondImage,"ocean-cycles-through-supplied-scenes");
                captured &= view.Capture(Path.Combine(output,"07-ocean-supplied-03.png"));
                var missile=flight.Missiles[0];
                double speed=Math.Sqrt(missile.VelocityX*missile.VelocityX+Math.Pow(missile.VelocityY*ContinuousFlight.FieldAspect,2));
                Check(Math.Abs(speed-.028)<.00001,"missile-base-speed-reduced-twenty-percent");
                missile.VelocityX=0;missile.VelocityY=.005f;
                InputSystem.QueueStateEvent(mouse,new MouseState{position=new Vector2(10,10)});
                yield return new WaitForSecondsRealtime(.25f);
                Check(view.Board.VisibleMissilePopupCount==0,"missile-options-hidden-by-default");
                captured &= view.Capture(Path.Combine(output,"07-ocean-compact.png"));
                InputSystem.QueueStateEvent(mouse,new MouseState{position=view.Board.ScreenPoint(missile.X,missile.Y)});
                yield return null;yield return null;
                Check(view.Board.OpenMissileId==missile.Id&&view.Board.VisibleMissilePopupCount==1,"hover-opens-four-options");
                captured &= view.Capture(Path.Combine(output,"07a-missile-hover.png"));
                int wrongChoice=(missile.CorrectIndex+1)%4;
                Vector2 buttonPoint=view.Board.MissilePopupChoiceScreenPoint(missile.Id,wrongChoice);
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                Check(view.Board.OpenMissileId==missile.Id,"hover-panel-remains-open-over-buttons");
                int rejectBefore=audioPlayer.MissileRejectCount,blastBefore=view.Board.BlastEffects,healthBeforeWrong=progress.Metal;
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint}.WithButton(MouseButton.Left,true));yield return null;
                InputSystem.QueueStateEvent(mouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                Check(missile.WrongAttempts==1&&view.Board.IsMissileFlashing(missile.Id),"wrong-click-shakes-and-flashes-red");
                Check(audioPlayer.MissileRejectCount==rejectBefore+1,"wrong-click-plays-subtle-sound");
                Check(flight.Missiles.Contains(missile)&&view.Board.BlastEffects==blastBefore&&progress.Metal==healthBeforeWrong,"wrong-click-does-not-explode-or-damage-player");
                captured &= view.Capture(Path.Combine(output,"07b-wrong-answer-red-edges.png"));
                InputSystem.QueueStateEvent(mouse,new MouseState{position=new Vector2(10,10)});yield return new WaitForSecondsRealtime(.25f);
                Check(view.Board.VisibleMissilePopupCount==0,"leaving-missile-closes-options");

                foreach(var victim in flight.Enemies.Take(2)){victim.X=missile.X;victim.Y=missile.Y;victim.Age=0;victim.Charging=false;}
                int spokenBeforeBlast=audioPlayer.PronunciationCount,queuedBeforeBlast=speech.Count,killsBefore=progress.Correct;
                AnswerMissile(missile.Id,missile.CorrectIndex);
                Check(progress.Correct==killsBefore+1&&progress.BlastKills>=2&&audioPlayer.PronunciationCount==spokenBeforeBlast&&speech.Count==queuedBeforeBlast,"blast-multikill-does-not-pronounce-words");
                yield return null;
                Check(!flight.Missiles.Contains(missile),"correct-missile-answer-blasts");
                captured &= view.Capture(Path.Combine(output,"07c-silent-blast.png"));
                guard=0;
                while((flight.Missiles.Count==0||flight.Enemies.Count==0)&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.2f);}
                SmokeHeal();DrainEvents();
                if(flight.Missiles.Count>0)
                {
                    missile=flight.Missiles[0];int wrong=(missile.CorrectIndex+1)%4;int before=progress.Metal;
                    AnswerMissile(missile.Id,wrong);AnswerMissile(missile.Id,wrong);AnswerMissile(missile.Id,wrong);
                    Check(missile.Failed&&!progress.IsOver&&progress.Metal==before,"three-errors-speed-up-without-instant-death");
                    SmokeClearOtherHazards(missile.Id);
                    missile.X=flight.PlayerX;missile.Y=ContinuousFlight.PlayerY-.2f;missile.VelocityX=0;missile.VelocityY=.3f;
                    flight.Tick(.2f);DrainEvents();view.Refresh(flight);yield return null;
                    Check(progress.Metal==before-2&&!flight.Missiles.Contains(missile),"missile-impact-minus-two-metal");
                    captured &= view.Capture(Path.Combine(output,"08-missile-damage.png"));
                    // End with one actual aircraft impact at one remaining health.
                    SmokeClearOtherHazards(-1);flight.Tick(ContinuousFlight.ImpactGraceSeconds + .05f);
                    progress.Damage(progress.Metal-1);
                    if(flight.Enemies.Count>0)
                    {
                        attacker=flight.Enemies[0];attacker.X=flight.PlayerX;attacker.Y=ContinuousFlight.PlayerY-.12f;
                        attacker.Charging=true;attacker.ChargeDelay=0;attacker.VelocityX=0;attacker.VelocityY=.4f;
                        flight.Tick(.4f);DrainEvents();yield return new WaitForSecondsRealtime(.9f);
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
            File.WriteAllText(Path.Combine(output,"smoke-report.json"),"{\n  \"version\": \"0.13.0\",\n  \"checks\": ["+string.Join(",",checks.Select(c=>"\""+c+"\""))+"]\n}");
            Application.Quit(checks.Any(c=>c.EndsWith(":FAIL"))?1:0);
        }

        private void SmokeFixture(FlightEnvironment environment)
        {
            flight=new ContinuousFlight(flightPool,42,environment);progress=flight.Progress;mode=Mode.Flying;
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
            foreach(var enemy in flight.Enemies){enemy.Age=0;enemy.Charging=false;enemy.Y=0;}
            foreach(var missile in flight.Missiles.Where(m=>m.Id!=missileId)){missile.X=.05f;missile.Y=.05f;missile.VelocityX=0;missile.VelocityY=.01f;}
        }
        private IEnumerator SmokeWatchdog(string output)
        {
            yield return new WaitForSecondsRealtime(40);
            File.WriteAllText(Path.Combine(output,"watchdog-failure.txt"),"Runtime verification exceeded forty seconds. See player log.");
            Application.Quit(1);
        }
    }
}

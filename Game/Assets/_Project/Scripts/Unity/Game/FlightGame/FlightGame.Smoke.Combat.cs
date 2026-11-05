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
        // Enemy aircraft: lock-on, homing burst, bank away.
        private IEnumerator SmokeEnemyAircraft()
        {
            // ---- Enemy aircraft: guns out, lock-on sight, homing burst, bank away ----
            SmokeFixture(FlightEnvironment.Jungle);flight.SetDriving(false);var attacker=flight.Target;
            int warningsBefore=audioPlayer.LockWarningCount;
            flight.Tick(18.1f);DrainEvents();
            Check(attacker.Phase==EnemyPhase.Locking&&attacker.LockRemaining>0&&flight.Target==attacker&&audioPlayer.LockWarningCount>warningsBefore,"aircraft-lock-warning");
            flight.Tick(1.2f);DrainEvents();yield return null;yield return null;
            Check(view.Board.EnemyGunsVisible(attacker.Id)&&view.Board.ReticleSpriteName.StartsWith("fx_lock_reticle"),"guns-deploy-and-sight-on-player");
            SmokeCapture("05-lock-on.png");
            for(int i=0;flight.Shots.Count==0&&i<200;i++)flight.Tick(.05f);
            DrainEvents();view.Board.Animate(.12f,flight,FlightEnvironment.Jungle);
            Check(flight.Shots.Count>0&&attacker.Departing&&view.Board.EnemySpriteName(attacker.Id).Contains("_bank_"),"attacker-fires-then-banks-away");
            Check(view.Board.VisibleShots>0,"homing-tracers-rendered");
            SmokeCapture("05b-homing-burst.png");
            // Try to dodge: drive hard to the far side while the burst is in the air.
            flight.SetDriving(true);float dodgeFrom=flight.PlayerX;flight.MovePlayer(dodgeFrom<.5f?.95f:.05f);
            for(int i=0;flight.Shots.Count>0&&i<100;i++)flight.Tick(.03f);
            DrainEvents();view.Refresh(flight);yield return null;
            Check(progress.Metal==4&&Math.Abs(flight.PlayerX-dodgeFrom)>.05f,"homing-burst-cannot-be-dodged-minus-one-metal");
            SmokeCapture("06-damaged-hull.png");
            for(int i=0;flight.Enemies.Contains(attacker)&&i<200;i++)flight.Tick(.05f);
            Check(!flight.Enemies.Contains(attacker),"attacker-leaves-the-frame");
            progress.CollectMetal();view.Refresh(flight);Check(progress.Metal==5,"metal-repairs-one-health");
        }

        // Rocket tags, wrong/correct answers, boost and game over.
        private IEnumerator SmokeRocket()
        {
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
                InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=new Vector2(10,10)});
                view.Board.Animate(.06f,flight,FlightEnvironment.Ocean);
                Vector2 centre=new Vector2(missile.X*FlightBoardView.Width,-missile.Y*FlightBoardView.Height);
                Check(view.Board.OpenMissileId==missile.Id&&view.Board.MissileChoiceScale(missile.Id,0)<.9f&&Vector2.Distance(view.Board.MissileChoiceAnchored(missile.Id,0),centre)<90,"tags-start-small-at-rocket-body");
                yield return null;SmokeCapture("07a-missile-tags-opening.png");
                float waterTime=view.Board.OceanAnimationSeconds;
                yield return new WaitForSecondsRealtime(.75f);
                Check(view.Board.OceanAnimationSeconds>waterTime,"ocean-water-effects-animate");
                bool separate=true;
                for(int i=0;i<4;i++)for(int j=i+1;j<4;j++){var d=view.Board.MissileChoiceAnchored(missile.Id,i)-view.Board.MissileChoiceAnchored(missile.Id,j);separate&=Mathf.Abs(d.x)>=156||Mathf.Abs(d.y)>=40;}
                Check(view.Board.MissileChoicesFullyOpen(missile.Id)&&view.Board.VisibleMissilePopupCount==1&&separate&&Enumerable.Range(0,4).All(i=>Mathf.Abs(view.Board.MissileChoiceScale(missile.Id,i)-1)<.01f),"four-separate-tags-grow-to-full-size");
                SmokeCapture("07b-missile-tags-open.png");
                int wrongChoice=(missile.CorrectIndex+1)%4;
                int rejectBefore=audioPlayer.MissileRejectCount,blastBefore=view.Board.BlastEffects,healthBeforeWrong=progress.Metal;
                InputSystem.QueueTextEvent(keyboard,(char)('1'+wrongChoice));yield return null;yield return null;
                Check(missile.WrongAttempts==1&&view.Board.IsMissileFlashing(missile.Id)&&typed=="","digit-key-answers-rocket-and-flashes-red");
                Check(audioPlayer.MissileRejectCount==rejectBefore+1,"wrong-answer-plays-subtle-sound");
                Check(flight.Missiles.Contains(missile)&&view.Board.BlastEffects==blastBefore&&progress.Metal==healthBeforeWrong,"wrong-answer-does-not-explode-or-damage-player");
                SmokeCapture("07c-wrong-answer-red-edges.png");

                foreach(var victim in flight.Enemies.Take(2)){victim.X=missile.X;victim.Y=missile.Y;victim.Age=0;victim.Phase=EnemyPhase.Patrol;}
                int spokenBeforeBlast=audioPlayer.PronunciationCount,queuedBeforeBlast=speech.Count,killsBefore=progress.Correct;
                yield return null;
                Vector2 buttonPoint=view.Board.MissilePopupChoiceScreenPoint(missile.Id,missile.CorrectIndex);
                InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=buttonPoint}.WithButton(MouseButton.Left,true));yield return null;
                InputSystem.QueueStateEvent(smokeMouse,new MouseState{position=buttonPoint});yield return null;yield return null;
                Check(!flight.Missiles.Contains(missile),"clicking-correct-tag-blasts-rocket");
                Check(progress.Correct==killsBefore+1&&progress.BlastKills>=2&&audioPlayer.PronunciationCount==spokenBeforeBlast&&speech.Count==queuedBeforeBlast,"blast-multikill-does-not-pronounce-words");
                SmokeCapture("07d-silent-blast.png");
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
                    yield return null;SmokeCapture("08a-rocket-boost.png");
                    flight.SetDriving(true);float dodge=flight.PlayerX;flight.MovePlayer(dodge<.5f?.95f:.05f);
                    for(int i=0;flight.Missiles.Contains(missile)&&i<200;i++)flight.Tick(.02f);
                    DrainEvents();view.Refresh(flight);yield return null;
                    Check(progress.Metal==before-2&&!flight.Missiles.Contains(missile),"boosted-rocket-cannot-be-dodged-minus-two-metal");
                    SmokeCapture("08-missile-damage.png");
                    // End with one actual homing burst at one remaining health.
                    SmokeClearOtherHazards(-1);flight.Tick(ContinuousFlight.ImpactGraceSeconds + .05f);
                    progress.Damage(progress.Metal-1);
                    if(flight.Enemies.Count>0)
                    {
                        var attacker=flight.Enemies[0];attacker.Phase=EnemyPhase.Locking;attacker.LockRemaining=.001f;
                        for(int i=0;!progress.IsOver&&i<60;i++)flight.Tick(.05f);
                        DrainEvents();yield return new WaitForSecondsRealtime(.9f);
                        Check(progress.Metal==0&&mode==Mode.Results,"zero-metal-causes-gameover");
                    }
                    else Check(false,"zero-metal-causes-gameover");
                }
                else Check(false,"second-missile-fixture");
            }
            yield return null;SmokeCapture("09-results.png");
        }

        // Carrier route: hold, deploy, turn, diagonal departure, exit.
        private IEnumerator SmokeCarrier()
        {
            SmokeFixture(FlightEnvironment.Ocean);flight.SetDriving(false);int guard=0;
            while(flight.Carriers.Count==0&&guard++<1000&&!progress.IsOver){SmokeHeal();flight.Tick(.1f);}
            if(flight.Carriers.Count>0)
            {
                var carrier=flight.Carriers[0];guard=0;
                while(carrier.Phase==CarrierPhase.Entering&&guard++<500){SmokeHeal();flight.Tick(.025f);}
                DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Deploying&&Math.Abs(carrier.Y-.2f)<.001,"carrier-holds-at-eighty-percent-from-player");
                SmokeCapture("10-carrier-deploying.png");
                SmokeAdvanceSafe(20.1f);
                Check(carrier.Phase==CarrierPhase.Turning&&Math.Abs(carrier.DeploymentSeconds-20)<.001,"carrier-deploys-for-twenty-seconds");
                float turnX=carrier.X,turnY=carrier.Y;
                SmokeAdvanceSafe(1);DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Turning&&Math.Abs(carrier.X-turnX)<.00001f&&Math.Abs(carrier.Y-turnY)<.00001f&&Math.Abs(carrier.HeadingDegrees)>0,"carrier-turns-bow-before-moving");
                Check(Vector2.Distance(view.Board.CarrierVisualScreenCenter(carrier.Id),view.Board.ScreenPoint(carrier.X,carrier.Y))<1,"carrier-rotates-about-physical-centre");
                SmokeCapture("10b-carrier-turning.png");
                guard=0;while(carrier.Phase==CarrierPhase.Turning&&guard++<200){SmokeHeal();flight.Tick(.025f);}
                float departingX=carrier.X;
                SmokeAdvanceSafe(5);DrainEvents();view.Refresh(flight);yield return null;
                Check(Math.Abs(carrier.X-departingX)>.01f&&carrier.Y>.2f&&carrier.Y<.5f,"carrier-begins-gentle-diagonal-departure");
                float heading=(float)(Math.Atan2(carrier.VelocityX,carrier.VelocityY*ContinuousFlight.FieldAspect)*180/Math.PI);
                Check(Math.Abs(heading-carrier.HeadingDegrees)<.1f&&Math.Abs(Mathf.DeltaAngle(view.Board.CarrierVisualAngle(carrier.Id),180+heading))<.1f,"carrier-bow-and-visual-align-with-travel");
                SmokeCapture("10a-carrier-diagonal.png");
                int launches=carrier.AircraftLaunched,fireChecks=carrier.MissileChecks;guard=0;
                while(carrier.Phase!=CarrierPhase.Exiting&&guard++<1000){SmokeHeal();flight.Tick(.025f);}
                DrainEvents();view.Refresh(flight);yield return null;
                Check(carrier.Phase==CarrierPhase.Exiting&&carrier.Y>=.5f&&carrier.Y<.51f&&carrier.ExitDirection==(carrier.X<=.5f?-1:1),"carrier-exits-nearest-edge-at-fifty-percent");
                SmokeCapture("11-carrier-exiting.png");
                guard=0;while(flight.Carriers.Contains(carrier)&&guard++<500){SmokeHeal();flight.Tick(.025f);}
                Check(!flight.Carriers.Contains(carrier)&&carrier.AircraftLaunched==launches&&carrier.MissileChecks==fireChecks,"carrier-leaves-with-no-launches-after-deployment");
            }
            else Check(false,"carrier-route-fixture");
        }
    }
}

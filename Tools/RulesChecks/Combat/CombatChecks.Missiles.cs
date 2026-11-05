using PixelVocabFlight;

internal static partial class CombatChecks
{
    private static void CheckMissiles()
    {
        var sea=OceanWithMissile();var rocket=sea.Missiles[0];
        double actualSpeed=Math.Sqrt(rocket.VelocityX*rocket.VelocityX+Math.Pow(rocket.VelocityY*ContinuousFlight.FieldAspect,2));
        Check(Math.Abs(actualSpeed-.035*.8)<.00001,"missile velocity is twenty percent slower than previous base speed");
        Check(rocket.Choices.Length==4&&rocket.Choices.All(pool.Contains),"all four missile choices stay inside selected vocabulary");
        Check(!sea.AnswerMissile(rocket.Id,rocket.CorrectIndex),"drive mode cannot answer missile");
        float startY=rocket.Y;sea.Tick(.1f);Check(rocket.Y>startY,"unanswered missile really approaches player");
        sea.SetDriving(false);Calm(sea,rocket);
        Check(sea.AnswerMissile(rocket.Id,(rocket.CorrectIndex+1)%4)==false&&rocket.WrongAttempts==1,"wrong choice is counted on the missile");
        var original=sea.Target;original.X=rocket.X;original.Y=rocket.Y;
        var splash=sea.Enemies.First(e=>e!=original);splash.X=rocket.X;splash.Y=rocket.Y;splash.Health=2;
        var safe=sea.Enemies.First(e=>e!=original&&e!=splash);safe.X=rocket.X<.5f?.95f:.05f;safe.Y=.68f;
        Check(sea.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&!sea.Missiles.Contains(rocket),"correct answer removes missile before impact");
        Check(!sea.Enemies.Contains(original)&&!sea.Enemies.Contains(splash)&&sea.Enemies.Contains(safe),"blast bypasses shield and invulnerability only inside radius");
        Check(sea.Target!=original&&sea.Target!=null,"blast retargets destroyed current answer");
        var blastEvents=new List<FlightEvent>();FlightEvent blastEvent;
        while((blastEvent=sea.PopEvent())!=null)blastEvents.Add(blastEvent);
        Check(blastEvents.Count(e=>e.Kind==FlightEventKind.Kill)>=2&&blastEvents.Where(e=>e.Kind==FlightEventKind.Kill).All(e=>e.Source==KillSource.MissileBlast&&!e.ShouldPronounce),"blast multi-kills never request pronunciation");

        var seeker=OceanWithMissile();rocket=seeker.Missiles[0];Calm(seeker,rocket);
        float aimBefore=rocket.VelocityX;seeker.MovePlayer(rocket.X<.5f?.955f:.045f);for(int i=0;i<20;i++)seeker.Tick(.05f);
        Check(rocket.Phase==MissilePhase.Cruise&&Math.Sign(rocket.VelocityX)==Math.Sign(seeker.PlayerX-rocket.X)&&Math.Abs(rocket.VelocityX-aimBefore)>.0001f,"cruising rocket re-aims at the moving player");
        rocket.Y=ContinuousFlight.MissileTerminalY+.001f;seeker.Tick(.05f);
        Check(rocket.Phase==MissilePhase.Locking&&seeker.PlayerLockedOn,"rocket locks on near the player");
        seeker.SetDriving(false);int correctBefore=seeker.Progress.Correct;
        var lockedRocket=rocket;Check(seeker.AnswerMissile(lockedRocket.Id,lockedRocket.CorrectIndex)&&seeker.Progress.Correct==correctBefore+1,"locking rocket can still be answered");

        var incoming=OceanWithMissile();rocket=incoming.Missiles[0];incoming.SetDriving(false);Calm(incoming,rocket);
        rocket.Y=ContinuousFlight.MissileTerminalY;incoming.Tick(.05f);
        int before=incoming.Progress.Metal;incoming.Tick(ContinuousFlight.MissileLockSeconds-.2f);
        Check(rocket.Phase==MissilePhase.Locking&&incoming.Progress.Metal==before,"lock-on warning comes before the boost");
        incoming.Tick(.25f);Check(rocket.Phase==MissilePhase.Boost&&!rocket.Answerable,"rocket boosts after the lock and can no longer be answered");
        Check(!incoming.AnswerMissile(rocket.Id,rocket.CorrectIndex),"boosting rocket ignores answers");
        incoming.MovePlayer(incoming.PlayerX<.5f?.955f:.045f);incoming.SetDriving(true);incoming.MovePlayer(incoming.PlayerX<.5f?.955f:.045f);
        incoming.Tick(1.5f);
        Check(incoming.Progress.Metal==before-2&&!incoming.Missiles.Contains(rocket),"boosting rocket chases the player and costs exactly two metal");
        incoming.Tick(.1f);Check(incoming.Progress.Metal==before-2,"removed missile cannot damage twice");
        var badAnswers=OceanWithMissile();rocket=badAnswers.Missiles[0];badAnswers.SetDriving(false);Calm(badAnswers,rocket);
        int bad=(rocket.CorrectIndex+1)%4;int beforeWrong=badAnswers.Progress.Metal;
        for(int i=0;i<3;i++)badAnswers.AnswerMissile(rocket.Id,bad);
        var wrongEvents=new List<FlightEvent>();FlightEvent wrongEvent;
        while((wrongEvent=badAnswers.PopEvent())!=null)wrongEvents.Add(wrongEvent);
        Check(wrongEvents.Count(e=>e.Kind==FlightEventKind.MissileWrong&&e.EntityId==rocket.Id)==3&&!wrongEvents.Any(e=>e.Kind==FlightEventKind.MissileBlast),"each missile mistake identifies projectile for shake and never emits explosion");
        Check(rocket.Failed&&!badAnswers.Progress.IsOver&&badAnswers.Progress.Metal==beforeWrong,"three errors trigger the lock without instant health loss");
        Check(!badAnswers.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&badAnswers.Missiles.Contains(rocket),"failed quiz cannot defuse the rocket");
        badAnswers.Tick(.3f);Check(rocket.Phase==MissilePhase.Locking&&badAnswers.Progress.Metal==beforeWrong,"failed rocket locks on briefly first");
        badAnswers.Tick(3);Check(badAnswers.Progress.Metal==beforeWrong-2&&!badAnswers.Missiles.Contains(rocket),"failed rocket boosts and always hits");
        var fatal=OceanWithMissile();rocket=fatal.Missiles[0];fatal.SetDriving(false);Calm(fatal,rocket);fatal.Progress.Damage(4);
        rocket.Phase=MissilePhase.Boost;rocket.PhaseSeconds=0;fatal.Tick(1.5f);
        Check(fatal.Progress.IsOver&&fatal.Progress.Metal==0,"missile clamps one remaining metal to zero and loses");
    }
}

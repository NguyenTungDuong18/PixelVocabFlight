using PixelVocabFlight;

internal static class InteractionChecks
{
    public static int Run(VocabularyEntry[] catalog)
    {
        int checks = 0;
        void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }
        var pool = catalog.Where(e => e.pos == "noun").Take(120).ToArray();
        ContinuousFlight New() => new(pool, 42, FlightEnvironment.Desert);
        var motion = New();
        motion.MovePlayer(.95f);
        Check(motion.PlayerX == .5f, "input sets destination without teleporting");
        motion.Tick(.1f);
        Check(Math.Abs(motion.PlayerX - .585f) < .00001, "movement obeys speed limit");
        motion.SetDriving(false);
        motion.Tick(.2f);
        Check(Math.Abs(motion.PlayerX - .585f) < .00001, "shooting cancels outstanding movement");
        motion.SetDriving(true); motion.MovePlayer(float.NaN); motion.MovePlayer(float.PositiveInfinity);
        double before = motion.Progress.ActiveSeconds;
        motion.Tick(float.NaN); motion.Tick(float.PositiveInfinity); motion.Tick(-1);
        Check(motion.Progress.ActiveSeconds == before && !float.IsNaN(motion.PlayerX), "invalid time and pointer inputs do not corrupt state");
        var coarse = New(); var fine = New();
        coarse.MovePlayer(.9f); fine.MovePlayer(.9f); coarse.Tick(.5f);
        for (int i=0;i<50;i++) fine.Tick(.01f);
        Check(Math.Abs(coarse.PlayerX-fine.PlayerX)<.00001 && coarse.Progress.Health==fine.Progress.Health, "movement agrees across frame rates");

        // Puts an aircraft at the end of its lock so it fires on the next step.
        void Hazard(EnemyState enemy) { enemy.Phase=EnemyPhase.Locking; enemy.LockRemaining=.001f; }
        var chase = New(); Hazard(chase.Target); chase.Tick(.05f); chase.MovePlayer(.95f); chase.Tick(1);
        Check(chase.Progress.Health==4 && chase.PlayerX>.9f && chase.Shots.Count==0, "homing burst follows a moving player");
        var grace = New(); grace.Tick(12.1f);
        foreach(var e in grace.Enemies) Hazard(e);
        grace.Tick(1f);
        Check(grace.Progress.Health==4 && grace.Shots.Count==0, "simultaneous bursts cause one damage during grace");
        grace.Tick(12.1f); Hazard(grace.Enemies.First(e=>!e.Departing)); grace.Tick(1f);
        Check(grace.Progress.Health==3, "damage resumes after grace expires");
        var score = new FlightProgress();
        score.ResolveCorrect("apple",1,20);
        int correct=score.Correct, streak=score.Streak, points=score.Score;
        score.ResolveBlastKill(); score.ResolveBlastKill();
        Check(score.Correct==correct && score.Streak==streak && score.BlastKills==2 && score.Score==points+50, "splash awards combat score without claiming learned words");

        var sea = new ContinuousFlight(pool,42,FlightEnvironment.Ocean);
        for(int i=0;sea.Missiles.Count==0 && i<10000;i++)
        {
            while(sea.Progress.Health<5&&!sea.Progress.IsOver)sea.Progress.CollectMetal();
            sea.Tick(.025f);
        }
        Check(sea.Missiles.Count>0,"missile fixture exists");
        var missile=sea.Missiles[0];
        var carrier=sea.Carriers.First(c=>c.Phase==CarrierPhase.Deploying);
        Check(missile.Y>=carrier.Y+ContinuousFlight.CarrierLaunchOffsetY && missile.Y<carrier.Y+ContinuousFlight.CarrierLaunchOffsetY+.02f,"rocket launches from bow rather than hull centre");
        sea.SetDriving(false);correct=sea.Progress.Correct;
        sea.AnswerMissile(missile.Id,missile.CorrectIndex);
        Check(sea.Progress.Correct==correct+1,"one solved missile counts exactly one learned answer");
        int scoreAfter=sea.Progress.Score;
        Check(!sea.AnswerMissile(missile.Id,missile.CorrectIndex)&&sea.Progress.Score==scoreAfter,"removed missile cannot award points twice");
        Console.WriteLine("PASS: "+checks+" interaction regression checks.");
        return checks;
    }
}


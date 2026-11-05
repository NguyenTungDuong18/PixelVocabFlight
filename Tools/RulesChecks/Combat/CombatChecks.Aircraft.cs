using PixelVocabFlight;

internal static partial class CombatChecks
{
    private static void CheckEnemyAttack()
    {
        var attack=New();var original=attack.Target;
        attack.Tick(17.9f);Check(original.Phase==EnemyPhase.Patrol&&attack.Progress.Metal==5,"approach gives time to answer before attack");
        attack.Tick(.2f);Check(original.Phase==EnemyPhase.Locking&&original.LockRemaining>0&&attack.Target==original&&attack.Progress.Metal==5,"aircraft locks on with a visible warning before firing");
        attack.Tick(ContinuousFlight.AircraftLockSeconds-.4f);Check(original.Phase==EnemyPhase.Locking&&attack.Shots.Count==0,"lock lasts long enough to answer");
        attack.MovePlayer(.955f);
        for(int i=0;i<200&&attack.Enemies.Contains(original);i++)attack.Tick(.05f);
        Check(attack.Progress.Metal==4,"homing burst cannot be dodged and costs exactly one metal");
        Check(!attack.Enemies.Contains(original)&&attack.Shots.Count==0,"attacker banks away off the map after firing");
        Check(attack.Target!=original&&attack.Target!=null,"departed attacker hands the radio to another aircraft");
        Check(attack.Progress.Correct==0&&attack.Progress.Score==0&&attack.Supplies.All(s=>s.Kind==SupplyKind.Roll),"enemy attack awards no kill score or loot");
        // The run-in never stops: during the whole lock the bomber keeps closing, reaches its firing row
        // exactly when the guns are out, fires and breaks away at no less than its run-in speed.
        var runIn=New();original=runIn.Target;runIn.Tick(18.05f);
        bool moving=original.Phase==EnemyPhase.Locking;float lastY=original.Y,fireRow=original.FireY,runSpeed=0;
        while(original.Phase==EnemyPhase.Locking){runIn.Tick(.25f);if(original.Phase==EnemyPhase.Locking){moving&=original.Y>lastY+.001f;lastY=original.Y;runSpeed=original.VelocityY;}}
        Check(moving,"locking aircraft keeps flying towards the player instead of hovering");
        Check(Math.Abs(original.Y-fireRow)<.02f&&fireRow>=ContinuousFlight.FireRowMin&&fireRow<=ContinuousFlight.FireRowMax&&runIn.Shots.Count>0,"guns are ready exactly at the firing row");
        Check(original.Departing&&original.DepartStartSpeed>=.04f&&original.VelocityY>0,"fire and break-away follow without a pause");
        runIn.Tick(.6f);Check(original.Y>fireRow&&Math.Abs(original.VelocityX)>.05f,"after the burst the bomber turns out of the frame");
        var prevent=New();original=prevent.Target;prevent.Tick(18.1f);prevent.SetDriving(false);
        Check(prevent.Submit(original.Entry.word,original.Entry.pos)&&!prevent.Enemies.Contains(original),"locking aircraft can be shot down");
        prevent.Tick(6);Check(prevent.Progress.Metal==5&&prevent.Shots.Count==0,"destroyed attacker never fires");
        var priority=New();priority.Tick(12.1f);var other=priority.Enemies.First(e=>e!=priority.Target);
        foreach(var e in priority.Enemies)e.Age=0;other.Age=ContinuousFlight.AircraftAttackAge-.01f;priority.Tick(.05f);
        Check(other.Phase==EnemyPhase.Locking&&priority.Target==other,"aircraft locking on becomes the radio target");
        var iceLock=New(FlightEnvironment.Ice);original=iceLock.Target;iceLock.Tick(18.1f);iceLock.SetDriving(false);
        Check(iceLock.Submit(original.Entry.word,original.Entry.pos)&&original.Health==1&&iceLock.Target==original,"shield break keeps a locking aircraft on the radio");
        Check(iceLock.Submit(original.Entry.word,original.Entry.pos)&&!iceLock.Enemies.Contains(original),"second hit downs it before it fires");
    }

    private static void CheckEnvironmentCycle()
    {
        var cycling=New(FlightEnvironment.Jungle);AdvanceSafely(cycling,179.8f);
        Check(cycling.Environment==FlightEnvironment.Jungle,"environment lasts three minutes");
        var oldTraits=cycling.Enemies.Where(e=>e.Environment==FlightEnvironment.Jungle).ToArray();
        AdvanceSafely(cycling,.4f);Check(cycling.Environment==FlightEnvironment.Desert,"environment switches after three minutes");
        Check(oldTraits.Any(e=>cycling.Enemies.Contains(e)&&e.Environment==FlightEnvironment.Jungle),"existing enemy retains original trait");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Ice,"ice at six minutes");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Ocean,"ocean at nine minutes");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Jungle,"biome loop repeats");
    }
}

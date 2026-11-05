using PixelVocabFlight;

internal static partial class CombatChecks
{
    private static int checks;
    private static VocabularyEntry[] pool;
    private static void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }

    private static ContinuousFlight New(FlightEnvironment environment=FlightEnvironment.Desert, int seed=42) => new(pool,seed,environment);
    private static void Heal(ContinuousFlight game) { while(game.Progress.Metal<5&&!game.Progress.IsOver)game.Progress.CollectMetal(); }
    // Parks other hazards and waits for bullets and invulnerability to clear, so a fixture measures one hazard only.
    private static void Calm(ContinuousFlight game,MissileState keep)
    {
        foreach(var e in game.Enemies){e.Age=0;e.Phase=EnemyPhase.Patrol;e.Y=0;}
        foreach(var m in game.Missiles.Where(m=>m!=keep)){m.Y=.02f;m.Phase=MissilePhase.Cruise;m.PhaseSeconds=0;}
        for(int i=0;(game.Shots.Count>0||game.ImpactGraceRemaining>0)&&i<60;i++){Heal(game);game.Tick(.05f);}
        Heal(game);
    }
    private static void AdvanceSafely(ContinuousFlight game,float duration)
    {
        for(float elapsed=0;elapsed<duration;)
        { float step=Math.Min(.025f,duration-elapsed);Heal(game);game.Tick(step);elapsed+=step; }
    }
    private static ContinuousFlight OceanWithMissile()
    {
        var game=New(FlightEnvironment.Ocean);
        for(int i=0;(game.Missiles.Count==0||game.Enemies.Count<3)&&i<1000;i++){Heal(game);game.Tick(.2f);}
        Heal(game);Check(game.Missiles.Count>0&&!game.Progress.IsOver,"ocean produces an incoming missile");return game;
    }

    public static int Run(VocabularyEntry[] catalog, VocabularyEntry[] prototype)
    {
        checks = 0;
        pool = catalog.Where(e => e.pos == "noun").Take(120).ToArray();
        CheckMetalHealth();
        CheckAnswers();
        CheckEnemyAttack();
        CheckEnvironmentCycle();
        CheckMissiles();
        var (loot, fuel, metal, rollCatches) = CheckSupplies(prototype);
        var (carrierCount, missileCount) = CheckCarriers();
        Console.WriteLine($"Combat: {loot}/1000 drops ({fuel} fuel/{metal} metal); {carrierCount}/400 carriers; {missileCount}/{carrierCount} missile launches; {rollCatches} roll catches.");
        return checks;
    }
}

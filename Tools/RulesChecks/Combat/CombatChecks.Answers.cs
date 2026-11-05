using PixelVocabFlight;

internal static partial class CombatChecks
{
    private static void CheckMetalHealth()
    {
        var hp=new FlightProgress();
        Check(hp.Metal==5&&hp.Health==5&&!hp.IsOver,"start with exactly five metal health");
        Check(hp.Damage(1)==1&&hp.Metal==4,"aircraft damage costs one metal");
        Check(hp.Damage(2)==2&&hp.Metal==2,"missile damage costs two metal");
        hp.CollectMetal();Check(hp.Metal==3&&hp.Health==3,"metal pickup restores health");
        for(int i=0;i<10;i++)hp.CollectMetal();
        Check(hp.Metal==5&&hp.Powered,"repair cap five; upgrades never consume health");
        Check(hp.Damage(0)==0&&hp.Damage(-2)==0&&hp.Metal==5,"nonpositive damage ignored");
        Check(hp.Damage(99)==5&&hp.Metal==0&&hp.IsOver,"damage clamps to zero and ends flight");
        hp.CollectMetal();Check(hp.Metal==0,"cannot revive after game over");
    }

    private static void CheckAnswers()
    {
        var stream=New();var original=stream.Target;
        Check(stream.Enemies.Count==1&&stream.Rolls==3&&stream.Driving,"one initial aircraft and three rolls");
        stream.Tick(11.9f);Check(stream.Enemies.Count==1,"no second aircraft before twelve seconds");
        stream.Tick(.2f);Check(stream.Enemies.Count==2&&stream.Target==original,"twelve-second spawn preserves target and old plane");
        Check(!stream.Submit(original.Entry.word,original.Entry.pos),"driving cannot fire");
        stream.MovePlayer(10);stream.Tick(.6f);Check(Math.Abs(stream.PlayerX-.955f)<.0001,"horizontal movement clamped");
        stream.SetDriving(false);stream.MovePlayer(.1f);Check(Math.Abs(stream.PlayerX-.955f)<.0001,"shooting locks position");
        Check(!stream.Submit(original.Entry.word,"verb")&&stream.Target==original,"desert requires correct part of speech");
        var distractor=stream.Enemies.First(e=>e!=original);
        Check(!stream.Submit(distractor.Entry.word,"noun")&&stream.Enemies.Contains(distractor),"distractor remains immune to typing");
        Check(stream.Submit(original.Entry.word,original.Entry.pos)&&stream.Enemies.Count==1,"only target dies from correct typing");
        var directEvents=new List<FlightEvent>();FlightEvent directEvent;
        while((directEvent=stream.PopEvent())!=null)directEvents.Add(directEvent);
        Check(directEvents.Count(e=>e.ShouldPronounce)==1&&directEvents.Single(e=>e.Kind==FlightEventKind.Kill).Source==KillSource.PlayerShot,"only directly typed kill requests pronunciation");
        stream.Tick(12.1f);original=stream.Target;int rolls=stream.Rolls;
        Check(stream.Roll()&&stream.Target!=original&&stream.Rolls==rolls-1&&stream.Enemies.Contains(original),"roll switches meaning without deleting plane");
        while(stream.Roll()){} Check(stream.Rolls==0&&!stream.Roll(),"no roll overdraft");
        var jungle=New(FlightEnvironment.Jungle);jungle.Tick(9.3f);
        Check(jungle.Enemies.Count==2&&Math.Abs(jungle.SpawnInterval-12f/1.3f)<.0001,"jungle retains thirty percent faster spawn on twelve-second base");
        var ice=New(FlightEnvironment.Ice);ice.Tick(12.1f);ice.SetDriving(false);original=ice.Target;
        Check(ice.Submit(original.Entry.word,original.Entry.pos)&&original.Health==1&&ice.Enemies.Contains(original)&&ice.Target!=original,"ice first hit breaks shield and changes target");
        while(ice.Target!=original&&ice.Enemies.Count>1)ice.Submit(ice.Target.Entry.word,ice.Target.Entry.pos);
        Check(ice.Submit(original.Entry.word,original.Entry.pos)&&!ice.Enemies.Contains(original),"ice second hit kills");
    }
}

using PixelVocabFlight;

internal static class CombatChecks
{
    public static int Run(VocabularyEntry[] catalog, VocabularyEntry[] prototype)
    {
        int checks = 0;
        void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }
        var pool = catalog.Where(e => e.pos == "noun").Take(120).ToArray();
        ContinuousFlight New(FlightEnvironment environment=FlightEnvironment.Desert, int seed=42) => new(pool,seed,environment);
        void Heal(ContinuousFlight game) { while(game.Progress.Metal<5&&!game.Progress.IsOver)game.Progress.CollectMetal(); }
        void AdvanceSafely(ContinuousFlight game,float duration)
        {
            for(float elapsed=0;elapsed<duration;)
            { float step=Math.Min(.025f,duration-elapsed);Heal(game);game.Tick(step);elapsed+=step; }
        }
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

        var ram=New();original=ram.Target;
        ram.Tick(17.9f);Check(!original.Charging&&ram.Progress.Metal==5,"approach gives time to answer before attack");
        ram.Tick(.2f);Check(original.Charging&&original.ChargeDelay>0&&ram.Progress.Metal==5,"charge has visible warning before movement");
        for(int i=0;i<150&&ram.Enemies.Contains(original);i++)ram.Tick(.05f);
        Check(!ram.Enemies.Contains(original)&&ram.Progress.Metal==4,"real aircraft charge hits and is removed exactly once");
        Check(ram.Target!=original&&ram.Target!=null,"collided target changes meaning immediately");
        Check(ram.Progress.Correct==0&&ram.Progress.Score==0&&ram.Supplies.All(s=>s.Kind==SupplyKind.Roll),"collision awards no kill score or loot");
        var dodge=New();original=dodge.Target;dodge.Tick(18.1f);dodge.MovePlayer(.955f);
        for(int i=0;i<200&&dodge.Enemies.Contains(original);i++)dodge.Tick(.05f);
        Check(!dodge.Enemies.Contains(original)&&dodge.Progress.Metal==5,"moving after aim lock dodges aircraft and it leaves the field");
        var immune=New();immune.Tick(12.1f);var nonTarget=immune.Enemies.First(e=>e!=immune.Target);
        nonTarget.X=immune.PlayerX;nonTarget.Y=ContinuousFlight.PlayerY-.12f;nonTarget.Charging=true;nonTarget.ChargeDelay=0;nonTarget.VelocityX=0;nonTarget.VelocityY=.4f;
        immune.Tick(.3f);Check(immune.Progress.Metal==4&&!immune.Enemies.Contains(nonTarget),"invulnerable non-target aircraft still inflicts collision damage");

        var cycling=New(FlightEnvironment.Jungle);AdvanceSafely(cycling,179.8f);
        Check(cycling.Environment==FlightEnvironment.Jungle,"environment lasts three minutes");
        var oldTraits=cycling.Enemies.Where(e=>e.Environment==FlightEnvironment.Jungle).ToArray();
        AdvanceSafely(cycling,.4f);Check(cycling.Environment==FlightEnvironment.Desert,"environment switches after three minutes");
        Check(oldTraits.Any(e=>cycling.Enemies.Contains(e)&&e.Environment==FlightEnvironment.Jungle),"existing enemy retains original trait");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Ice,"ice at six minutes");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Ocean,"ocean at nine minutes");
        AdvanceSafely(cycling,180);Check(cycling.Environment==FlightEnvironment.Jungle,"biome loop repeats");

        ContinuousFlight OceanWithMissile()
        {
            var game=New(FlightEnvironment.Ocean);
            for(int i=0;(game.Missiles.Count==0||game.Enemies.Count<3)&&i<1000;i++){Heal(game);game.Tick(.2f);}
            Heal(game);Check(game.Missiles.Count>0&&!game.Progress.IsOver,"ocean produces an incoming missile");return game;
        }
        var sea=OceanWithMissile();var rocket=sea.Missiles[0];
        double actualSpeed=Math.Sqrt(rocket.VelocityX*rocket.VelocityX+Math.Pow(rocket.VelocityY*ContinuousFlight.FieldAspect,2));
        Check(Math.Abs(actualSpeed-.035*.8)<.00001,"missile velocity is twenty percent slower than previous base speed");
        Check(rocket.Choices.Length==4&&rocket.Choices.All(pool.Contains),"all four missile choices stay inside selected vocabulary");
        Check(!sea.AnswerMissile(rocket.Id,rocket.CorrectIndex),"drive mode cannot answer missile");
        float startY=rocket.Y;sea.Tick(.1f);Check(rocket.Y>startY,"unanswered missile really approaches player");
        sea.SetDriving(false);
        // Controlled collision fixture uses the same swept physics as live gameplay.
        foreach(var e in sea.Enemies){e.Age=0;e.Charging=false;e.Y=0;}
        original=sea.Target;original.X=rocket.X;original.Y=rocket.Y;
        var splash=sea.Enemies.First(e=>e!=original);splash.X=rocket.X;splash.Y=rocket.Y;splash.Health=2;
        var safe=sea.Enemies.First(e=>e!=original&&e!=splash);safe.X=rocket.X<.5f?.95f:.05f;safe.Y=.68f;
        Check(sea.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&!sea.Missiles.Contains(rocket),"correct answer removes missile before impact");
        Check(!sea.Enemies.Contains(original)&&!sea.Enemies.Contains(splash)&&sea.Enemies.Contains(safe),"blast bypasses shield and invulnerability only inside radius");
        Check(sea.Target!=original&&sea.Target!=null,"blast retargets destroyed current answer");
        var blastEvents=new List<FlightEvent>();FlightEvent blastEvent;
        while((blastEvent=sea.PopEvent())!=null)blastEvents.Add(blastEvent);
        Check(blastEvents.Count(e=>e.Kind==FlightEventKind.Kill)>=2&&blastEvents.Where(e=>e.Kind==FlightEventKind.Kill).All(e=>e.Source==KillSource.MissileBlast&&!e.ShouldPronounce),"blast multi-kills never request pronunciation");

        var incoming=OceanWithMissile();rocket=incoming.Missiles[0];incoming.SetDriving(false);
        foreach(var e in incoming.Enemies){e.Age=0;e.Charging=false;e.Y=0;}
        rocket.X=incoming.PlayerX;rocket.Y=ContinuousFlight.PlayerY-.2f;rocket.VelocityX=0;rocket.VelocityY=.3f;
        int before=incoming.Progress.Metal;incoming.Tick(.7f);
        Check(incoming.Progress.Metal==before-2&&!incoming.Missiles.Contains(rocket),"missile physical impact costs exactly two metal and removes projectile");
        incoming.Tick(.1f);Check(incoming.Progress.Metal==before-2,"removed missile cannot damage twice");
        var badAnswers=OceanWithMissile();rocket=badAnswers.Missiles[0];badAnswers.SetDriving(false);
        int bad=(rocket.CorrectIndex+1)%4;int beforeWrong=badAnswers.Progress.Metal;
        for(int i=0;i<3;i++)badAnswers.AnswerMissile(rocket.Id,bad);
        var wrongEvents=new List<FlightEvent>();FlightEvent wrongEvent;
        while((wrongEvent=badAnswers.PopEvent())!=null)wrongEvents.Add(wrongEvent);
        Check(wrongEvents.Count(e=>e.Kind==FlightEventKind.MissileWrong&&e.EntityId==rocket.Id)==3&&!wrongEvents.Any(e=>e.Kind==FlightEventKind.MissileBlast),"each missile mistake identifies projectile for shake and never emits explosion");
        Check(rocket.Failed&&!badAnswers.Progress.IsOver&&badAnswers.Progress.Metal==beforeWrong,"three errors accelerate missile without instant health loss");
        Check(!badAnswers.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&badAnswers.Missiles.Contains(rocket),"failed quiz cannot defuse accelerated missile");
        foreach(var e in badAnswers.Enemies){e.Age=0;e.Charging=false;e.Y=0;}
        rocket.X=badAnswers.PlayerX;rocket.Y=ContinuousFlight.PlayerY-.2f;rocket.VelocityX=0;rocket.VelocityY=.3f;
        badAnswers.Tick(.2f);Check(badAnswers.Progress.Metal==beforeWrong-2,"failed missile only hurts on physical impact");
        var evadeRocket=OceanWithMissile();rocket=evadeRocket.Missiles[0];
        foreach(var e in evadeRocket.Enemies){e.Age=0;e.Charging=false;e.Y=0;}
        rocket.X=.5f;rocket.Y=.65f;rocket.VelocityX=0;rocket.VelocityY=.3f;
        evadeRocket.MovePlayer(.955f);int dodgeHealth=evadeRocket.Progress.Metal;evadeRocket.Tick(2);
        Check(evadeRocket.Progress.Metal==dodgeHealth&&!evadeRocket.Missiles.Contains(rocket),"missile can be dodged with no metal loss");
        var fatal=OceanWithMissile();rocket=fatal.Missiles[0];fatal.SetDriving(false);fatal.Progress.Damage(4);
        foreach(var e in fatal.Enemies){e.Age=0;e.Charging=false;e.Y=0;}
        rocket.X=fatal.PlayerX;rocket.Y=ContinuousFlight.PlayerY-.2f;rocket.VelocityX=0;rocket.VelocityY=.3f;fatal.Tick(.7f);
        Check(fatal.Progress.IsOver&&fatal.Progress.Metal==0,"missile clamps one remaining metal to zero and loses");

        int loot=0,fuel=0,metal=0;
        for(int i=0;i<1000;i++)
        {
            var trial=New(seed:i);trial.SetDriving(false);trial.Submit(trial.Target.Entry.word,trial.Target.Entry.pos);
            var dropped=trial.Supplies.Where(s=>s.Kind!=SupplyKind.Roll).ToArray();
            Check(dropped.Length<=1,"one kill drops at most fuel OR metal");
            loot+=dropped.Length;if(dropped.Length==1){if(dropped[0].Kind==SupplyKind.Fuel)fuel++;else metal++;}
        }
        Check(loot>65&&loot<140&&fuel>20&&metal>20,"ten-percent exclusive item drops across one thousand seeds");
        var catcher=New();int rollCatches=0;
        for(int i=0;i<2400;i++)
        {
            Heal(catcher);var roll=catcher.Supplies.FirstOrDefault(s=>s.Kind==SupplyKind.Roll);if(roll!=null)catcher.MovePlayer(roll.X);
            catcher.Tick(.05f);FlightEvent ev;while((ev=catcher.PopEvent())!=null)if(ev.Kind==FlightEventKind.Pickup&&ev.Supply==SupplyKind.Roll)rollCatches++;
        }
        Check(rollCatches>0&&catcher.Rolls==3+rollCatches,"driving can still catch drifting roll icons");
        var noCatch=New();noCatch.SetDriving(false);AdvanceSafely(noCatch,120);Check(noCatch.Rolls==3,"shooting cannot collect roll icons");
        var tiny=new ContinuousFlight(prototype.Take(4).ToArray(),42,FlightEnvironment.Desert);
        AdvanceSafely(tiny,100);
        Check(tiny.Enemies.All(e=>prototype.Take(4).Contains(e.Entry))&&tiny.Enemies.Count>0,"small pool keeps spawning only selected entries while attacks leave field");
        int carrierCount=0,missileCount=0;
        for(int seed=0;seed<400;seed++)
        {
            var trial=New(FlightEnvironment.Ocean,seed);trial.Tick(12.1f);if(trial.Carriers.Count==0)continue;
            carrierCount++;var carrier=trial.Carriers[0];
            for(int i=0;carrier.Phase==CarrierPhase.Entering&&i<400;i++){Heal(trial);trial.Tick(.025f);}
            trial.Tick(5.01f);if(carrier.MissilesLaunched>0)missileCount++;
        }
        Check(carrierCount>50&&carrierCount<110,"carrier chance remains twenty percent per twelve-second slot");
        Check(missileCount>carrierCount*.3&&missileCount<carrierCount*.7,"carrier missile chance remains fifty percent every five seconds");
        for(int direction=-1;direction<=1;direction+=2)
        {
            ContinuousFlight route=null;
            for(int seed=0;seed<100;seed++)
            {
                var trial=New(FlightEnvironment.Ocean,seed);trial.Tick(12.1f);
                if(trial.Carriers.Count>0){route=trial;break;}
            }
            Check(route!=null,"carrier route fixture exists");
            var carrier=route.Carriers[0];carrier.X=direction<0?.25f:.75f;
            Check(carrier.Phase==CarrierPhase.Entering&&carrier.AircraftLaunched==0&&carrier.MissileChecks==0,"carrier enters before launching any aircraft or missile");
            for(int i=0;carrier.Phase==CarrierPhase.Entering&&i<400;i++){Heal(route);route.Tick(.025f);}
            Check(carrier.Phase==CarrierPhase.Deploying&&Math.Abs(carrier.Y-.2f)<.0001,"carrier stops at eighty percent measured from player side");
            Check(carrier.AircraftLaunched==1,"one aircraft takes off after carrier arrives");
            AdvanceSafely(route,19.8f);
            Check(carrier.Phase==CarrierPhase.Deploying&&Math.Abs(carrier.Y-.2f)<.0001,"carrier holds its deployment position for the full twenty-second window");
            for(int i=0;carrier.Phase==CarrierPhase.Deploying&&i<30;i++){Heal(route);route.Tick(.025f);}
            Check(carrier.Phase==CarrierPhase.Turning&&Math.Abs(carrier.DeploymentSeconds-20)<.000001,"deployment ends exactly at twenty seconds before turning");
            Check(carrier.AircraftLaunched==2&&carrier.MissileChecks==4,"twenty-second window launches aircraft on arrival and at twelve seconds, tests missiles four times");
            int launches=carrier.AircraftLaunched,checksBefore=carrier.MissileChecks;
            float turnX=carrier.X,turnY=carrier.Y;
            AdvanceSafely(route,1);
            Check(carrier.Phase==CarrierPhase.Turning&&carrier.HeadingDegrees*direction>0&&Math.Abs(carrier.HeadingDegrees)<Math.Abs(carrier.DepartureHeading),"bow turns progressively toward the chosen edge");
            Check(Math.Abs(carrier.X-turnX)<.000001&&Math.Abs(carrier.Y-turnY)<.000001,"turning rotates about stationary ship centre without sideways sliding");
            for(int i=0;carrier.Phase==CarrierPhase.Turning&&i<200;i++){Heal(route);route.Tick(.025f);}
            Check(Math.Abs(carrier.HeadingDegrees-carrier.DepartureHeading)<.0001,"bow reaches departure heading before travel starts");
            float retreatX=carrier.X;
            AdvanceSafely(route,5);
            Check(carrier.Phase==CarrierPhase.Advancing&&carrier.Y>.2f&&carrier.Y<.5f,"carrier slowly advances toward mid-field after deployment");
            Check((carrier.X-retreatX)*direction>0,"carrier departs diagonally before reaching mid-field");
            double travelHeading=Math.Atan2(carrier.VelocityX,carrier.VelocityY*ContinuousFlight.FieldAspect)*180/Math.PI;
            Check(Math.Abs(travelHeading-carrier.HeadingDegrees)<.1,"ship motion follows its bow rather than sliding across the hull");
            Check(carrier.AircraftLaunched==launches&&carrier.MissileChecks==checksBefore,"carrier stops launching as soon as deployment ends");
            float previousVX=0,previousVY=0;
            for(int i=0;carrier.Phase!=CarrierPhase.Exiting&&i<1000;i++)
            {previousVX=carrier.VelocityX;previousVY=carrier.VelocityY;Heal(route);route.Tick(.025f);}
            Check(carrier.Phase==CarrierPhase.Exiting&&carrier.Y>=.5f&&carrier.Y<.51f&&carrier.ExitDirection==direction,"carrier continues toward nearest edge at fifty percent of field");
            Check(Math.Abs(carrier.VelocityX-previousVX)<.003&&Math.Abs(carrier.VelocityY-previousVY)<.003,"mid-field handover preserves velocity without a heading snap");
            float oldX=carrier.X;AdvanceSafely(route,.5f);
            Check((carrier.X-oldX)*direction>0&&carrier.Y>.5f,"carrier continues along a gentle diagonal to the edge");
            for(int i=0;route.Carriers.Contains(carrier)&&i<500;i++){Heal(route);route.Tick(.025f);}
            Check(!route.Carriers.Contains(carrier)&&carrier.AircraftLaunched==launches&&carrier.MissileChecks==checksBefore,"carrier leaves the map without launching while retreating");
        }
        Console.WriteLine($"Combat: {loot}/1000 drops ({fuel} fuel/{metal} metal); {carrierCount}/400 carriers; {missileCount}/{carrierCount} missile launches; {rollCatches} roll catches.");
        return checks;
    }
}

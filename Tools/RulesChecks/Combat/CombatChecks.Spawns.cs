using PixelVocabFlight;

internal static partial class CombatChecks
{
    private static (int loot, int fuel, int metal, int rollCatches) CheckSupplies(VocabularyEntry[] prototype)
    {
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
        return (loot, fuel, metal, rollCatches);
    }

    private static (int carriers, int missiles) CheckCarriers()
    {
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
        return (carrierCount, missileCount);
    }
}

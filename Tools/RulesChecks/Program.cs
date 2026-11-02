using PixelVocabFlight;
using System.Text.Json;

int checks = 0;
void Check(bool result, string description)
{
    checks++;
    if (!result) throw new Exception("FAIL: " + description);
}
bool Close(double a, double b) => Math.Abs(a - b) < 0.0001;

foreach (var pair in new[] { (0d, 1d), (59.999, 1d), (60d, 1.1), (119.999, 1.1), (120d, 1.2), (180d, 1.3), (240d, 1.4), (300d, 1.5), (3600d, 1.5) })
    Check(Close(GameRules.SpeedMultiplier(pair.Item1), pair.Item2), "speed at " + pair.Item1);
var apple = new VocabularyEntry { word = "apple", acceptedSpellings = Array.Empty<string>() };
Check(GameRules.Matches(" APPLE ", apple), "case and surrounding space");
Check(!GameRules.Matches("bread", apple), "a visible distractor is not the answer");
Check(!GameRules.Matches("appl", apple), "no fuzzy spelling");
Check(!GameRules.Matches("", apple), "empty answer rejected");
Check(GameRules.Matches("yoghurt", new VocabularyEntry { word = "yogurt", acceptedSpellings = new[] { "yoghurt" } }), "declared spelling alias");
Check(GameRules.ScoreFor("apple", 0, 10, 0, false) == 175, "score at immediate answer");
Check(GameRules.ScoreFor("apple", 10, 10, 0, false) == 125, "score with no speed bonus");
Check(Close(GameRules.ComboMultiplier(500), 2), "combo cap");
var flight = new FlightProgress();
flight.Tick(10);
Check(Math.Abs(flight.Fuel-98.8)<.001 && Close(flight.ActiveSeconds, 10), "clock and rare-supply fuel balance advance");
for (int i = 0; i < 5; i++) flight.ResolveCorrect("apple", 2, 10);
Check(flight.Correct == 5 && flight.Metal == 0 && !flight.Powered, "correct answers do not guarantee metal");
for(int i=0;i<5;i++)flight.CollectMetal();
Check(flight.Metal==0&&Close(flight.PowerSeconds,12),"five collected metal pieces activate upgrade");
Check(Close(GameRules.ComboMultiplier(flight.Streak), 1.25), "five correct raises combo");
flight.Tick(14);
Check(Math.Abs(flight.Fuel-97.84)<.001 && !flight.Powered, "partial-frame upgrade expires with correct fuel drain");
flight.Wrong();
Check(flight.Streak == 0 && flight.Health == 3 && flight.WrongAttempts == 1, "wrong answer resets combo without damaging hull");
flight.CollectFuel(40);
Check(Close(flight.Fuel, 100), "fuel clamped at 100");
flight.Miss(); flight.Miss(); flight.Miss();
Check(flight.IsOver && flight.Health == 0 && flight.Missed == 3, "three misses end flight");
double endedTime = flight.ActiveSeconds;
flight.Tick(20);
Check(flight.ActiveSeconds == endedTime, "finished flight cannot advance");
Check(flight.ResolveCorrect("apple", 0, 10) == 0, "finished flight cannot award points");
var exhausted = new FlightProgress();
exhausted.Tick(1000);
Check(exhausted.IsOver && exhausted.Fuel == 0, "fuel exhaustion ends flight");
exhausted.Tick(-1);
Check(exhausted.Fuel == 0, "negative delta cannot restore fuel");
string dataPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../Game/Assets/_Project/Data/Vocabulary/Resources/prototype-vocabulary.json"));
var data = JsonSerializer.Deserialize<VocabularyFile>(File.ReadAllText(dataPath), new JsonSerializerOptions { IncludeFields = true });
Check(data.entries.Length == 40, "40 prototype entries");
Check(data.entries.Select(e => e.id).Distinct().Count() == 40, "unique sense identifiers");
Check(data.entries.Select(e => GameRules.Normalize(e.word)).Distinct().Count() == 40, "unique visible words");
Check(data.entries.Count(e => e.topic == "food") == 24 && data.entries.Count(e => e.topic == "travel") == 16, "topic counts");
foreach (var entry in data.entries)
{
    Check(!string.IsNullOrWhiteSpace(entry.meaning) && entry.partOfSpeech == "danh từ", "meaning and part of speech: " + entry.word);
    Check(data.entries.Count(e => e.topic == entry.topic && e.meaning == entry.meaning) == 1, "distinct Vietnamese clue: " + entry.word);
}
string oxfordPath=Path.Combine(Path.GetDirectoryName(dataPath),"oxford-vocabulary.json");
var oxford=JsonSerializer.Deserialize<VocabularyFile>(File.ReadAllText(oxfordPath),new JsonSerializerOptions {IncludeFields=true});
Check(oxford.entries.Length==5981,"all live-list rows plus verified PDF supplements retained");
Check(new VocabularyFilter().to==int.MaxValue,"new study settings request the full library rather than fifty entries");
Check(oxford.entries.Any(e=>e.word=="proceedings"&&e.pos=="noun"&&e.cefr=="C1"),"PDF headword proceedings included");
Check(oxford.entries.Any(e=>e.word=="bank"&&e.cefr=="B1"&&e.meaning=="bờ sông"),"river bank is distinct from financial bank");
Check(oxford.entries.Any(e=>e.word=="rock"&&e.meaning=="nhạc rock"),"rock music is distinct from stone");
Check(oxford.entries.Select(e=>e.id).Distinct().Count()==oxford.entries.Length,"unique homograph-aware IDs");
Check(oxford.entries.All(e=>e.playable),"all rows have a playable Vietnamese prompt");
string audioFolder=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(oxfordPath),"../../../Audio/Pronunciation/US/Resources/Pronunciation"));
foreach(var entry in oxford.entries)
{
    Check(!string.IsNullOrWhiteSpace(entry.meaning),"Vietnamese meaning: "+entry.id);
    Check(VocabularyQuery.Levels.Contains(entry.cefr),"valid source CEFR: "+entry.id);
    Check(entry.topics.Length>0 && entry.topics.All(t=>oxford.topics.Any(topic=>topic.id==t)),"known topics: "+entry.id);
    Check(File.Exists(Path.Combine(audioFolder,entry.audioKey+".wav")),"offline pronunciation: "+entry.id);
}
var filter=new VocabularyFilter {minimumLevel=2,maximumLevel=2,topics=new[]{"food"},from=1,to=3};
var foodB1=VocabularyQuery.Filter(oxford.entries,filter);
Check(foodB1.Length>=3 && foodB1.All(e=>e.cefr=="B1" && e.topics.Contains("food")),"exact Food + B1 intersection");
Check(QuestionDeck.ValidatePool(VocabularyQuery.Range(foodB1,2,7))==null,"Food B1 selected range can form every question");
Check(foodB1.Any(e=>e.word=="ingredient")&&!foodB1.Any(e=>e.word=="water"&&e.pos=="verb"),"Food B1 meaning-specific topic corrections");
var range=VocabularyQuery.Range(foodB1,2,4);
Check(range.Length==3 && range[0].id==foodB1[1].id && range[2].id==foodB1[3].id,"inclusive range after filtering");
bool badRange=false;try {VocabularyQuery.Range(foodB1,0,4);}catch(ArgumentException){badRange=true;}
Check(badRange,"zero-based user range rejected");
badRange=false;try {VocabularyQuery.Range(foodB1,1,foodB1.Length+1);}catch(ArgumentException){badRange=true;}
Check(badRange,"out of bounds range rejected instead of silently expanding");
filter.topics=new[]{"food","travel"};
var union=VocabularyQuery.Filter(oxford.entries,filter);
Check(union.All(e=>e.cefr=="B1" && (e.topics.Contains("food")||e.topics.Contains("travel"))),"topic union followed by CEFR intersection");
filter=new VocabularyFilter {collection="oxford3000"};
Check(VocabularyQuery.Filter(oxford.entries,filter).All(e=>e.oxford3000),"Oxford 3000 membership filter");
filter=new VocabularyFilter {search="passport"};
Check(VocabularyQuery.Filter(oxford.entries,filter).Any(e=>e.word=="passport"),"search English");
filter.search="hộ chiếu";
Check(VocabularyQuery.Filter(oxford.entries,filter).Any(e=>e.word=="passport"),"search Vietnamese");
Check(VocabularyQuery.SelectionKey(foodB1.Take(3).ToArray())!=VocabularyQuery.SelectionKey(foodB1.Skip(1).Take(3).ToArray()),"same-size ranges do not share a high score key");
var deckPool=oxford.entries.Where(e=>e.topics.Contains("food")).Take(60).ToArray();
var deck=new QuestionDeck(deckPool,42);
var seen=new HashSet<string>();
for(int i=0;i<deckPool.Length*2;i++)
{
    var options=deck.Next(out int targetIndex);
    Check(options.Select(e=>GameRules.Normalize(e.word)).Distinct().Count()==3,"no repeated visible spelling");
    Check(QuestionDeck.DistinctAnswers(options[0],options[1])&&QuestionDeck.DistinctAnswers(options[1],options[2])&&QuestionDeck.DistinctAnswers(options[0],options[2]),"distractors have distinct known meanings");
    Check(deckPool.Any(e=>e.id==options[targetIndex].id),"question stays within selected pool");
    if(i<deckPool.Length)seen.Add(options[targetIndex].id);
}
Check(seen.Count==deckPool.Length,"every selected entry is asked once before repeat");
var stopwatch=System.Diagnostics.Stopwatch.StartNew();
Check(QuestionDeck.ValidatePool(oxford.entries)==null,"full catalog can form valid questions");
Console.WriteLine("Full-catalog preflight: "+stopwatch.ElapsedMilliseconds+" ms.");
var streamPool=oxford.entries.Where(e=>e.pos=="noun").Take(120).ToArray();
var stream=new ContinuousFlight(streamPool,42,FlightEnvironment.Desert);
Check(stream.Enemies.Count==1&&stream.Rolls==3&&stream.Driving,"one initial aircraft, three rolls, drive mode");
var original=stream.Target;
stream.Tick(4.9f);Check(stream.Enemies.Count==1,"no extra aircraft before five seconds");
stream.Tick(.2f);Check(stream.Enemies.Count==2&&stream.Target==original,"five-second spawn preserves unanswered target");
stream.Tick(10);Check(stream.Enemies.Count==4&&stream.Target==original,"old aircraft remain through multiple spawn intervals");
Check(!stream.Submit(original.Entry.word,original.Entry.pos)&&stream.Progress.Correct==0,"driving cannot shoot");
stream.MovePlayer(10);Check(Close(stream.PlayerX,.955),"horizontal drive movement clamped");
stream.SetDriving(false);stream.MovePlayer(.1f);Check(Close(stream.PlayerX,.955),"firing freezes player position");
Check(!stream.Submit(original.Entry.word,"verb")&&stream.Target==original,"desert rejects wrong part of speech without changing meaning");
var distractor=stream.Enemies.First(e=>e!=original);
Check(!stream.Submit(distractor.Entry.word,"noun")&&stream.Enemies.Contains(distractor),"invulnerable distractor cannot be shot");
Check(stream.Submit(original.Entry.word,original.Entry.pos)&&!stream.Enemies.Contains(original)&&stream.Enemies.Count==3,"correct desert kill removes only target");
original=stream.Target;int priorRolls=stream.Rolls;
Check(stream.Roll()&&stream.Target!=original&&stream.Enemies.Contains(original)&&stream.Rolls==priorRolls-1,"roll changes target while preserving previous aircraft");
while(stream.Roll()){}
Check(stream.Rolls==0&&!stream.Roll(),"roll cannot spend beyond available charges");
var jungle=new ContinuousFlight(streamPool,42,FlightEnvironment.Jungle);jungle.Tick(3.9f);
Check(jungle.Enemies.Count==2&&Math.Abs(jungle.SpawnInterval-5f/1.3f)<.0001,"jungle spawn rate is thirty percent higher");
var ice=new ContinuousFlight(streamPool,42,FlightEnvironment.Ice);ice.Tick(10.1f);ice.SetDriving(false);original=ice.Target;
Check(ice.Submit(original.Entry.word,original.Entry.pos)&&original.Health==1&&ice.Enemies.Contains(original)&&ice.Target!=original,"ice first hit breaks shield and retargets without killing");
for(int i=0;i<20&&ice.Target!=original;i++)ice.Roll();
while(ice.Target!=original&&ice.Enemies.Count>1)ice.Submit(ice.Target.Entry.word,ice.Target.Entry.pos);
Check(ice.Submit(original.Entry.word,original.Entry.pos)&&!ice.Enemies.Contains(original),"ice second hit kills");
var cycling=new ContinuousFlight(streamPool,42,FlightEnvironment.Jungle);
cycling.Tick(179.8f);Check(cycling.Environment==FlightEnvironment.Jungle,"environment persists for three minutes");
cycling.Tick(.4f);Check(cycling.Environment==FlightEnvironment.Desert,"environment changes after three minutes");
Check(cycling.Enemies.Any(e=>e.Environment==FlightEnvironment.Jungle),"existing aircraft retain original biome traits");
cycling.Tick(180);Check(cycling.Environment==FlightEnvironment.Ice,"cycle reaches ice at six minutes");
cycling.Tick(180);Check(cycling.Environment==FlightEnvironment.Ocean,"cycle reaches ocean at nine minutes");
cycling.Tick(180);Check(cycling.Environment==FlightEnvironment.Jungle,"environment cycle repeats");
var sea=new ContinuousFlight(streamPool,42,FlightEnvironment.Ocean);int timeout=0;
while(sea.Missiles.Count<2&&timeout++<160)sea.Tick(1);
Check(sea.Carriers.Count>0&&sea.Missiles.Count>=2,"ocean produces carriers and independent missiles");
Check(sea.Missiles.All(m=>m.Choices.Length==4&&m.Choices.All(e=>streamPool.Contains(e))),"four missile options stay inside selected pool");
var rocket=sea.Missiles[0];
Check(!sea.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&sea.Missiles.Contains(rocket),"drive mode cannot answer missile");
sea.SetDriving(false);
// Put one target and one shielded immune enemy in the blast; leave another safely outside.
original=sea.Target;original.X=rocket.X;original.Y=rocket.Y;
var splash=sea.Enemies.First(e=>e!=original);splash.X=rocket.X;splash.Y=rocket.Y;splash.Health=2;
var survivor=sea.Enemies.First(e=>e!=original&&e!=splash);survivor.X=rocket.X<.5?.95f:.05f;survivor.Y=.68f;
Check(sea.AnswerMissile(rocket.Id,rocket.CorrectIndex)&&!sea.Missiles.Contains(rocket),"correct missile choice detonates");
Check(!sea.Enemies.Contains(original)&&!sea.Enemies.Contains(splash)&&sea.Enemies.Contains(survivor),"blast kills shield and immune neighbours only within radius");
Check(sea.Target!=original&&sea.Target!=null,"destroyed target meaning updates immediately");
rocket=sea.Missiles[0];int bad=(rocket.CorrectIndex+1)%4;
sea.AnswerMissile(rocket.Id,bad);sea.AnswerMissile(rocket.Id,bad);
Check(!sea.Progress.IsOver&&rocket.WrongAttempts==2,"two missile mistakes survive");
sea.AnswerMissile(rocket.Id,bad);Check(sea.Progress.IsOver&&sea.Progress.Health==0,"third missile mistake immediately loses flight");
var drops=new ContinuousFlight(streamPool,123,FlightEnvironment.Desert);drops.SetDriving(false);
int killed=0,loot=0,fuelDrops=0,metalDrops=0,rollCatches=0;
for(int i=0;i<1000;i++)
{
    drops.Progress.CollectFuel(100);
    if(drops.Target==null)drops.Tick(5.01f);
    var e=drops.Target;int suppliesBefore=drops.Supplies.Count(s=>s.Kind!=SupplyKind.Roll);
    drops.Submit(e.Entry.word,e.Entry.pos);killed++;
    int added=drops.Supplies.Count(s=>s.Kind!=SupplyKind.Roll)-suppliesBefore;
    Check(added>=0&&added<=1,"kill drops at most one fuel OR metal");
    loot+=added;if(added==1){if(drops.Supplies.Last(s=>s.Kind!=SupplyKind.Roll).Kind==SupplyKind.Fuel)fuelDrops++;else metalDrops++;}
    drops.Tick(.05f);
}
Check(loot>65&&loot<140&&fuelDrops>20&&metalDrops>20,"seeded kill drops follow ten-percent rate with both exclusive types");
var catcher=new ContinuousFlight(streamPool,42,FlightEnvironment.Desert);
for(int i=0;i<2400;i++)
{
    var roll=catcher.Supplies.FirstOrDefault(s=>s.Kind==SupplyKind.Roll);
    if(roll!=null)catcher.MovePlayer(roll.X);
    catcher.Tick(.05f);
    FlightEvent ev;while((ev=catcher.PopEvent())!=null)if(ev.Kind==FlightEventKind.Pickup&&ev.Supply==SupplyKind.Roll)rollCatches++;
}
Check(rollCatches>0&&catcher.Rolls==3+rollCatches,"ambient ten-percent rolls require horizontal catch and grant one charge");
var noCatch=new ContinuousFlight(streamPool,42,FlightEnvironment.Desert);noCatch.SetDriving(false);noCatch.Tick(120);
Check(noCatch.Rolls==3,"firing mode never collects a drifting roll");
var smallPool=new ContinuousFlight(data.entries.Take(4).ToArray(),42,FlightEnvironment.Desert);
original=smallPool.Target;smallPool.Tick(40.1f);
Check(smallPool.Enemies.Count==9&&smallPool.Target==original,"four-word pool still spawns every five seconds without deleting old planes");
Check(smallPool.Enemies.All(e=>data.entries.Take(4).Any(p=>p.id==e.Entry.id)),"small-pool repeats never add vocabulary outside selection");
int carrierTrials=400,carriersFound=0,missilesFound=0;
for(int seed=0;seed<carrierTrials;seed++)
{
    var trial=new ContinuousFlight(streamPool,seed,FlightEnvironment.Ocean);trial.Tick(5.1f);
    if(trial.Carriers.Count==0)continue;
    carriersFound++;trial.Tick(5);if(trial.Missiles.Count>0)missilesFound++;
}
Check(carriersFound>50&&carriersFound<110,"ocean carrier spawn is twenty percent per interval across seeds");
Check(missilesFound>carriersFound*.30&&missilesFound<carriersFound*.70,"carrier missile fire is fifty percent per five-second interval across seeds");
Console.WriteLine($"Ocean probabilities: {carriersFound}/{carrierTrials} carriers; {missilesFound}/{carriersFound} first missile launches.");
Console.WriteLine($"Continuous flight: {killed} kills, {loot} item drops ({fuelDrops} fuel/{metalDrops} metal), {rollCatches} roll catches.");
Console.WriteLine("Food B1 entries: "+foodB1.Length+".");
string sourceRoot=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(oxfordPath),"../../../../../../SourceAssets/Vocabulary/Oxford"));
using(var audit=JsonDocument.Parse(File.ReadAllText(Path.Combine(sourceRoot,"pdf-reconciliation.json"))))
{
    Check(audit.RootElement.GetProperty("missingHeadwords").GetArrayLength()==0,"no official PDF headword missing");
    Check(audit.RootElement.GetProperty("pdfHeadwordRows").GetInt32()>=4950,"PDF audit contains complete reference rather than a sample");
}
string ReferenceWord(string value)=>value.Replace("™","").Replace("®","").Normalize(System.Text.NormalizationForm.FormKC).Replace('’','\'').Replace('‐','-').Replace('‑','-').Replace('–','-').ToLowerInvariant().Trim();
var gameWords=oxford.entries.Select(e=>ReferenceWord(e.word)).ToHashSet();
using(var references=JsonDocument.Parse(File.ReadAllText(Path.Combine(sourceRoot,"official-pdf-entries.json"))))
    foreach(var entry in references.RootElement.EnumerateArray())
        foreach(var word in entry.GetProperty("words").EnumerateArray())
            Check(gameWords.Contains(ReferenceWord(word.GetString())),"official PDF word is in playable game data: "+word.GetString());
Console.WriteLine("PASS: " + checks + " gameplay, Oxford-data and selection checks.");

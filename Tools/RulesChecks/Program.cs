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
Check(flight.Correct == 5 && flight.Metal == 5 && !flight.Powered, "correct answers do not guarantee metal or spend health");
for(int i=0;i<5;i++)flight.CollectMetal();
Check(flight.Metal==5&&Close(flight.PowerSeconds,12),"five collected metal pieces activate upgrade without spending health");
Check(Close(GameRules.ComboMultiplier(flight.Streak), 1.25), "five correct raises combo");
flight.Tick(14);
Check(Math.Abs(flight.Fuel-97.84)<.001 && !flight.Powered, "partial-frame upgrade expires with correct fuel drain");
flight.Wrong();
Check(flight.Streak == 0 && flight.Health == 5 && flight.WrongAttempts == 1, "wrong answer resets combo without damaging hull");
flight.CollectFuel(40);
Check(Close(flight.Fuel, 100), "fuel clamped at 100");
flight.Miss(); flight.Miss(); flight.Miss(); flight.Miss(); flight.Miss();
Check(flight.IsOver && flight.Health == 0 && flight.Missed == 5, "five one-point impacts end flight");
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
checks += CombatChecks.Run(oxford.entries, data.entries);
checks += InteractionChecks.Run(oxford.entries);
checks += WorldChecks.Run();
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
// Sprite sync for the walkable base runs last and lists every missing sprite at once.
string manifestPath=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../Game/Assets/_Project/Art/Resources/Pixel/pixel-manifest.json"));
WorldChecks.RunManifest(manifestPath);

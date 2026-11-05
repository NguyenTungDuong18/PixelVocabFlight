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
        // Only entered by the explicit --smoke-test flag; all writes use the QA profile.
        // Stages run in order and share state through the smoke fields (FlightGame.Smoke.Helpers.cs).
        private IEnumerator SmokeTest()
        {
            string[] args = System.Environment.GetCommandLineArgs(); int at = Array.IndexOf(args, "--smoke-output");
            smokeOutput = at >= 0 && at+1 < args.Length ? args[at+1] : Application.persistentDataPath;
            Directory.CreateDirectory(smokeOutput); StartCoroutine(SmokeWatchdog(smokeOutput));
            SelectFullOxford(); yield return null; yield return null;
            smokeChecks.Clear(); smokeCaptured = true;
            int frameFiles=0;bool everySpriteLoads=true;
            foreach(var name in PixelSprites.Names){var frames=PixelSprites.Frames(name);frameFiles+=frames.Length;everySpriteLoads&=frames.All(f=>f&&f.texture.width>0);}
            Check(everySpriteLoads&&frameFiles>=300&&PixelSprites.FrameCount("fighter_level")==4&&PixelSprites.FrameCount("fx_explosion")==8&&PixelSprites.FrameCount("gauge_needle")==48&&PixelSprites.FrameCount("bomber_guns")==11,"pixel-frame-library-loads:"+frameFiles);
            Check(PixelSprites.Texture("terrain_jungle_blur").filterMode==FilterMode.Bilinear&&PixelSprites.Texture("terrain_jungle").filterMode==FilterMode.Point,"blurred-ground-uses-smooth-filtering");
            Check(UiKit.PixelFontLoaded,"pixel-font-vt323-loaded");
            string propellerBefore=view.Board.PlayerSpriteName;view.Board.Animate(.07f,null,StartingEnvironment);
            Check(propellerBefore!=view.Board.PlayerSpriteName,"propeller-frames-advance");

            yield return SmokeBase();
            yield return SmokeProfessor();
            yield return SmokeTakeOff();
            yield return SmokeCockpit();
            yield return SmokeEnemyAircraft();
            yield return SmokeRocket();
            yield return SmokeCarrier();
            yield return SmokeResults();
            Check(smokeCaptured,"rendered-screenshots");
            File.WriteAllText(Path.Combine(smokeOutput,"smoke-report.json"),"{\n  \"version\": \"0.15.0\",\n  \"checks\": ["+string.Join(",",smokeChecks.Select(c=>"\""+c+"\""))+"]\n}");
            Application.Quit(smokeChecks.Any(c=>c.EndsWith(":FAIL"))?1:0);
        }

        // Results: VỀ CĂN CỨ reports the sortie and returns to the base.
        private IEnumerator SmokeResults()
        {
            var map=world.Map;
            // ---- Results: VỀ CĂN CỨ (Enter) reports the sortie to the mission log and returns to the base ----
            SmokeFixture(FlightEnvironment.Desert);yield return null;
            EndFlight();int finalScore=progress.Score,completedBefore=missions.Completed;bool activeBefore=missions.Active!=null;
            yield return null;
            Check(mode==Mode.Results&&view.ResultsButton!=null&&view.ResultsButton.GetComponentInChildren<UnityEngine.UI.Text>().text.StartsWith("VỀ CĂN CỨ"),"results-offer-return-to-base");
            yield return new WaitForSecondsRealtime(.45f);
            yield return SmokeKey(Key.Enter);
            Check(activeBefore&&mode==Mode.Base&&missions.Completed==completedBefore+1&&missions.Active==null&&missions.LastScore==finalScore&&profile.Profile.missionsCompleted==missions.Completed&&profile.Profile.lastScore==finalScore,"results-enter-reports-mission-and-returns-to-base");
            Check(Mathf.Abs(world.PlayerX-map.AircraftReturnX)<.01f&&Mathf.Abs(world.PlayerY-map.AircraftReturnY)<.01f&&view.Base.Visible&&!view.TakeOffVisible&&!view.OverlayVisible,"pilot-stands-beside-aircraft-after-sortie");
            yield return null;
            Check(view.Base.ObjectiveText==MissionLog.IdleObjective&&view.Base.QuestMarkerVisible,"objective-resets-for-next-sortie");
            SmokeCapture("12-back-at-base.png");
        }
    }
}

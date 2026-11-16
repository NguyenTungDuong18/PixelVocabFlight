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
        // Shared smoke state (set by SmokeTest; every stage coroutine appends to the same report).
        private readonly List<string> smokeChecks = new List<string>();
        private string smokeOutput;
        private bool smokeCaptured = true;
        private Mouse smokeMouse;

        // Names go into smoke-report.json as they are: no backslashes (paths) or quotes.
        private void Check(bool pass,string name) => smokeChecks.Add(name.Replace('\\','/').Replace('"','\'') + (pass ? ":PASS" : ":FAIL"));
        private void SmokeCapture(string fileName) => smokeCaptured &= view.Capture(Path.Combine(smokeOutput,fileName));

        private void SmokeFixture(FlightEnvironment environment)
        {
            flight=new ContinuousFlight(flightPool,42,environment);progress=flight.Progress;SetMode(Mode.Flying);view.FinishIntro();
            typed="";Time.timeScale=1;audioPlayer.Stop();speech.Clear();view.Board.Clear();view.Board.SetEnvironment(environment);
            bestKey="qa-collision-v2:"+environment;
            view.NewFlight("QA / OXFORD 5000 / "+flightPool.Length+" MỤC");DrainEvents();view.Refresh(flight);
        }
        private void SmokeHeal(){while(progress.Metal<5&&!progress.IsOver)progress.CollectMetal();}
        private void SmokeAdvanceSafe(float duration)
        {
            for(float elapsed=0;elapsed<duration;){float step=Math.Min(.025f,duration-elapsed);SmokeHeal();flight.Tick(step);elapsed+=step;}
        }
        private void SmokeClearOtherHazards(int missileId)
        {
            foreach(var enemy in flight.Enemies){enemy.Age=0;enemy.Phase=EnemyPhase.Patrol;enemy.Y=0;}
            foreach(var missile in flight.Missiles.Where(m=>m.Id!=missileId)){missile.X=.05f;missile.Y=.02f;missile.Phase=MissilePhase.Cruise;missile.PhaseSeconds=0;}
        }
        // Stages may push the deadline out (the story stage adds time for its 27 s of timed frames).
        private float smokeDeadline;
        private IEnumerator SmokeWatchdog(string output)
        {
            smokeDeadline = Time.realtimeSinceStartup + 120;
            while (Time.realtimeSinceStartup < smokeDeadline) yield return null;
            File.WriteAllText(Path.Combine(output,"watchdog-failure.txt"),"Runtime verification exceeded its time limit (120 s + stage extensions). See player log.");
            Application.Quit(1);
        }

        // Polls until the condition holds or `seconds` of real time pass; smokeOk tells which (nested coroutine, no return value).
        private bool smokeOk;
        private IEnumerator SmokeUntil(Func<bool> condition, float seconds)
        {
            float end = Time.realtimeSinceStartup + seconds;
            while (!condition()) { if (Time.realtimeSinceStartup > end) { smokeOk = false; yield break; } yield return null; }
            smokeOk = true;
        }

        private IEnumerator SmokeType(string value)
        {
            typed = ""; foreach (char c in value) InputSystem.QueueTextEvent(keyboard, c);
            yield return null; InputSystem.QueueStateEvent(keyboard, new KeyboardState(Key.Enter));
            yield return null; InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null;
        }

        private IEnumerator SmokeKey(Key key)
        {
            InputSystem.QueueStateEvent(keyboard, new KeyboardState(key)); yield return null;
            InputSystem.QueueStateEvent(keyboard, new KeyboardState()); yield return null;
        }
    }
}

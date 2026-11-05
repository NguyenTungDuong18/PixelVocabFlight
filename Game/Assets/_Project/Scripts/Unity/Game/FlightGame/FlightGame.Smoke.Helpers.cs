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

        private void Check(bool pass,string name) => smokeChecks.Add(name + (pass ? ":PASS" : ":FAIL"));
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
        private IEnumerator SmokeWatchdog(string output)
        {
            yield return new WaitForSecondsRealtime(120);
            File.WriteAllText(Path.Combine(output,"watchdog-failure.txt"),"Runtime verification exceeded 120 seconds. See player log.");
            Application.Quit(1);
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

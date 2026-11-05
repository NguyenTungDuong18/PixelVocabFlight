using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed partial class ContinuousFlight
    {
        private void AdvanceEnemies(float delta)
        {
            for (int i = enemies.Count - 1; i >= 0 && !Progress.IsOver; i--)
            {
                var enemy = enemies[i];
                enemy.Age += delta;
                if (enemy.Phase == EnemyPhase.Patrol)
                {
                    float homeX = .07f + enemy.FormationSlot % 8 * .122f;
                    float x = enemy.X + (homeX - enemy.X) * Math.Min(1, delta * .8f);
                    float y = Math.Min(.56f, enemy.Y + delta * PatrolSpeed * GameRules.SpeedMultiplier(Progress.ActiveSeconds));
                    enemy.VelocityX = (x - enemy.X) / delta; enemy.VelocityY = (y - enemy.Y) / delta; enemy.X = x; enemy.Y = y;
                    if (enemy.Age >= AircraftAttackAge)
                    {
                        // Lock-on is a slow, steady run in: it reaches its firing row exactly as the guns are fully out.
                        enemy.Phase = EnemyPhase.Locking; enemy.LockRemaining = AircraftLockSeconds;
                        enemy.FireY = Math.Min(FireRowMax, Math.Max(FireRowMin, enemy.Y + .1f));
                        Emit(FlightEventKind.AircraftLock, enemy.Entry, enemy.X, enemy.Y, entityId: enemy.Id);
                        Prioritize(enemy);
                    }
                }
                else if (enemy.Phase == EnemyPhase.Locking)
                {
                    float remaining = Math.Max(delta, enemy.LockRemaining);
                    float aimX = Math.Max(.08f, Math.Min(.92f, PlayerX));
                    float x = enemy.X + (aimX - enemy.X) * Math.Min(1, delta * .3f);
                    float y = enemy.Y + Math.Max(0, enemy.FireY - enemy.Y) * Math.Min(1, delta / remaining);
                    enemy.VelocityX = (x - enemy.X) / delta; enemy.VelocityY = (y - enemy.Y) / delta; enemy.X = x; enemy.Y = y;
                    enemy.LockRemaining -= delta;
                    if (enemy.LockRemaining <= 0) Fire(enemy);
                }
                else
                {
                    // Break away: the bomber turns from the player towards the nearer edge and accelerates off the map.
                    enemy.DepartSeconds += delta;
                    float turn = Math.Min(1, enemy.DepartSeconds / DepartTurnSeconds), angle = turn * turn * (3 - 2 * turn) * 1.75f;
                    // Starts at the run-in speed, so firing and breaking away are one continuous motion.
                    float boost = Math.Min(1, enemy.DepartSeconds / 1.2f);
                    float speed = enemy.DepartStartSpeed + (.7f - enemy.DepartStartSpeed) * boost * boost * (3 - 2 * boost);
                    enemy.VelocityX = enemy.DepartDirection * (float)Math.Sin(angle) * speed;
                    enemy.VelocityY = (float)Math.Cos(angle) * speed / FieldAspect;
                    enemy.X += enemy.VelocityX * delta; enemy.Y += enemy.VelocityY * delta;
                    if (OutsideField(enemy.X, enemy.Y) || enemy.Y < -.2f) { enemies.RemoveAt(i); Emit(FlightEventKind.Evaded, enemy.Entry, entityId: enemy.Id); }
                }
            }
        }

        private void AdvanceShots(float delta)
        {
            for (int i = shots.Count - 1; i >= 0 && !Progress.IsOver; i--)
            {
                var shot = shots[i];
                shot.Age += delta;
                if (shot.Age < 0) continue;
                float t = Math.Min(1, shot.Age / ShotTravelSeconds);
                float x = shot.StartX + (PlayerX - shot.StartX) * t, y = shot.StartY + (PlayerY - shot.StartY) * t;
                shot.VelocityX = (x - shot.X) / delta; shot.VelocityY = (y - shot.Y) / delta; shot.X = x; shot.Y = y;
                if (t < 1) continue;
                shots.RemoveAt(i);
                int lost = ImpactDamage(1);
                if (lost > 0) Emit(FlightEventKind.AircraftImpact, shot.Entry, PlayerX, PlayerY, lost, entityId: shot.SourceId);
            }
        }

        private void Fire(EnemyState enemy)
        {
            for (int k = 0; k < ShotBurst; k++)
                shots.Add(new ShotState { Id = ++serial, SourceId = enemy.Id, Entry = enemy.Entry, StartX = enemy.X, StartY = enemy.Y + .06f, X = enemy.X, Y = enemy.Y + .06f, Age = -k * ShotSpacing });
            Emit(FlightEventKind.AircraftFire, enemy.Entry, enemy.X, enemy.Y, entityId: enemy.Id);
            enemy.Phase = EnemyPhase.Departing; enemy.DepartSeconds = 0; enemy.DepartDirection = enemy.X <= .5f ? -1 : 1;
            enemy.DepartStartSpeed = Math.Max(.04f, (float)Math.Sqrt(enemy.VelocityX * enemy.VelocityX + Math.Pow(enemy.VelocityY * FieldAspect, 2)));
            if (enemy == Target) Retarget(enemy);
        }

        // An aircraft that starts locking on becomes the radio target, so every attack can be stopped by answering in time.
        private void Prioritize(EnemyState enemy)
        {
            if (Target == enemy || (Target != null && Target.Phase == EnemyPhase.Locking)) return;
            Target = enemy; targetAge = 0; TargetChanges++;
            Emit(FlightEventKind.Retarget, enemy.Entry);
        }

        private EnemyState SpawnAircraft(float x = -1, float y = 0)
        {
            if (bag.Count == 0) RefillBag();
            VocabularyEntry entry = null;
            int attempts = bag.Count;
            for (int i = 0; i < attempts; i++)
            {
                var candidate = bag.Dequeue();
                if (enemies.All(e => e.Entry.id == candidate.id || QuestionDeck.DistinctAnswers(e.Entry, candidate))) { entry = candidate; break; }
                bag.Enqueue(candidate);
            }
            // Reuse an exact study entry when a small pool is already on screen. This keeps
            // the continuous stream running without introducing ambiguous alternative words.
            if (entry == null)
            {
                var available = pool.Where(candidate => enemies.All(e => e.Entry.id == candidate.id || QuestionDeck.DistinctAnswers(e.Entry, candidate))).ToArray();
                if (available.Length > 0) entry = available[random.Next(available.Length)];
            }
            WaitingForDistinctWord = entry == null;
            if (entry == null) return null;
            int firstFree = Enumerable.Range(0, enemies.Count + 1).First(s => enemies.All(e => e.FormationSlot != s));
            int row = firstFree / 8;
            var slots = Enumerable.Range(row * 8, 8).Where(s => enemies.All(e => e.FormationSlot != s)).ToArray();
            int slot = x < 0 ? slots[random.Next(slots.Length)] : slots.OrderBy(s => Math.Abs(.07f + s % 8 * .122f - x)).First();
            if (x < 0) x = .07f + slot % 8 * .122f;
            var enemy = new EnemyState { Id = ++serial, FormationSlot = slot, Entry = entry, X = x, Y = y, Environment = Environment, Health = Environment == FlightEnvironment.Ice ? 2 : 1 };
            enemies.Add(enemy);
            Emit(FlightEventKind.Spawn, entry, x, y);
            if (Target == null) Retarget(null);
            return enemy;
        }
    }
}

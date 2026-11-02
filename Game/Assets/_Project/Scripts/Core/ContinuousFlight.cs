using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public enum FlightEnvironment { Jungle, Desert, Ice, Ocean }
    public enum SupplyKind { Fuel, Metal, Roll }
    public enum FlightEventKind { Spawn, Hit, Kill, Wrong, Retarget, Pickup, MissileBlast, MissileFailure }

    public sealed class EnemyState
    {
        public int Id, FormationSlot;
        public VocabularyEntry Entry;
        public float X, Y, Age;
        public int Health;
        public FlightEnvironment Environment;
        public bool RequiresPartOfSpeech => Environment == FlightEnvironment.Desert;
    }

    public sealed class CarrierState
    {
        public int Id;
        public float X, Y, Age, LaunchTimer;
    }

    public sealed class MissileState
    {
        public int Id, CorrectIndex, WrongAttempts;
        public float X, Y;
        public VocabularyEntry[] Choices;
        public VocabularyEntry Answer => Choices[CorrectIndex];
    }

    public sealed class SupplyState
    {
        public int Id;
        public SupplyKind Kind;
        public float X, Y, Age;
    }

    public sealed class FlightEvent
    {
        public FlightEventKind Kind;
        public VocabularyEntry Entry;
        public float X, Y;
        public int Value;
        public SupplyKind Supply;
    }

    // All timers, probabilities and combat rules live here; the Unity view only renders state.
    public sealed class ContinuousFlight
    {
        public const float EnvironmentDuration = 180;
        public const float BlastRadius = .09f;
        public const float FieldAspect = 548f / 1360f;
        public const float PlayerY = .92f;
        private readonly Random random;
        private readonly VocabularyEntry[] pool;
        private readonly Queue<VocabularyEntry> bag = new Queue<VocabularyEntry>();
        private readonly FlightEnvironment initialEnvironment;
        private readonly List<EnemyState> enemies = new List<EnemyState>();
        private readonly List<CarrierState> carriers = new List<CarrierState>();
        private readonly List<MissileState> missiles = new List<MissileState>();
        private readonly List<SupplyState> supplies = new List<SupplyState>();
        private readonly Queue<FlightEvent> events = new Queue<FlightEvent>();
        private float spawnTimer, rollTimer, targetAge;
        private int serial;
        public FlightProgress Progress { get; } = new FlightProgress();
        public IReadOnlyList<EnemyState> Enemies => enemies;
        public IReadOnlyList<CarrierState> Carriers => carriers;
        public IReadOnlyList<MissileState> Missiles => missiles;
        public IReadOnlyList<SupplyState> Supplies => supplies;
        public EnemyState Target { get; private set; }
        public bool Driving { get; private set; } = true;
        public float PlayerX { get; private set; } = .5f;
        public int Rolls { get; private set; } = 3;
        public bool CanRoll => Rolls > 0 && Target != null && enemies.Any(e => e.Entry.id != Target.Entry.id);
        public int TargetChanges { get; private set; }
        public FlightEnvironment Environment => (FlightEnvironment)(((int)initialEnvironment + (int)(Progress.ActiveSeconds / EnvironmentDuration)) % 4);
        public float SpawnInterval => Environment == FlightEnvironment.Jungle ? 5f / 1.3f : 5f;
        public float SpawnIn => Math.Max(0, (1 - spawnTimer) * SpawnInterval);
        public bool WaitingForDistinctWord { get; private set; }

        public ContinuousFlight(VocabularyEntry[] entries, int seed, FlightEnvironment environment)
        {
            if (entries == null || entries.Length < 4) throw new ArgumentException("Cần ít nhất 4 mục từ cho bốn lựa chọn tên lửa.");
            pool = entries;
            random = new Random(seed);
            initialEnvironment = environment;
            SpawnAircraft(.5f, 0);
        }

        public void SetDriving(bool driving) { Driving = driving; }
        public void MovePlayer(float x)
        {
            if (Driving && !Progress.IsOver) PlayerX = Math.Max(.045f, Math.Min(.955f, x));
        }

        public FlightEvent PopEvent() => events.Count == 0 ? null : events.Dequeue();
        private void Emit(FlightEventKind kind, VocabularyEntry entry = null, float x = 0, float y = 0, int value = 0, SupplyKind supply = SupplyKind.Fuel)
            => events.Enqueue(new FlightEvent { Kind = kind, Entry = entry, X = x, Y = y, Value = value, Supply = supply });

        public void Tick(float delta)
        {
            if (Progress.IsOver || delta <= 0) return;
            // Small simulation steps preserve event order and pickup catches during low frame rates.
            while (delta > 0 && !Progress.IsOver)
            {
                float step = Math.Min(.05f, delta);
                Advance(step);
                delta -= step;
            }
        }

        private void Advance(float delta)
        {
            Progress.Tick(delta);
            targetAge += delta;
            spawnTimer += delta / SpawnInterval;
            if (spawnTimer >= 1)
            {
                spawnTimer -= 1;
                if (Environment == FlightEnvironment.Ocean && random.NextDouble() < .2)
                {
                    var carrier = new CarrierState { Id = ++serial, X = .15f + (float)random.NextDouble() * .7f, Y = .02f };
                    carriers.Add(carrier);
                    SpawnAircraft(carrier.X, carrier.Y);
                }
                else SpawnAircraft();
            }
            rollTimer += delta;
            if (rollTimer >= 5)
            {
                rollTimer -= 5;
                if (random.NextDouble() < .1) AddSupply(SupplyKind.Roll, .08f + (float)random.NextDouble() * .84f, 0);
            }
            int formationRows = enemies.Count == 0 ? 5 : Math.Max(5, (enemies.Max(e => e.FormationSlot) / 8) + 1);
            foreach (var enemy in enemies)
            {
                enemy.Age += delta;
                // Unanswered aircraft hold formation inside the field rather than despawning.
                float hold = .72f - enemy.FormationSlot / 8 * (.60f / (formationRows - 1));
                float homeX = .07f + enemy.FormationSlot % 8 * .122f;
                enemy.X += (homeX - enemy.X) * Math.Min(1, delta * .8f);
                enemy.Y = Math.Min(hold, enemy.Y + delta * .035f * GameRules.SpeedMultiplier(Progress.ActiveSeconds));
            }
            for (int i = carriers.Count - 1; i >= 0; i--)
            {
                var carrier = carriers[i];
                carrier.Age += delta;
                carrier.Y += delta * .018f;
                carrier.LaunchTimer += delta;
                if (carrier.LaunchTimer >= 5)
                {
                    carrier.LaunchTimer -= 5;
                    SpawnAircraft(carrier.X, Math.Min(.25f, carrier.Y));
                    if (random.NextDouble() < .5) LaunchMissile(carrier);
                }
                if (carrier.Age >= 40) carriers.RemoveAt(i);
            }
            foreach (var missile in missiles) missile.Y = Math.Min(.48f, missile.Y + delta * .04f);
            for (int i = supplies.Count - 1; i >= 0; i--)
            {
                var supply = supplies[i];
                supply.Age += delta;
                if (supply.Kind == SupplyKind.Roll)
                {
                    supply.Y += delta * .065f;
                    if (Driving && Math.Abs(supply.X - PlayerX) < .045f && Math.Abs(supply.Y - PlayerY) < .04f)
                    { Rolls++; Emit(FlightEventKind.Pickup, x: supply.X, y: supply.Y, supply: supply.Kind); supplies.RemoveAt(i); }
                    else if (supply.Y > 1.06f) supplies.RemoveAt(i);
                }
                else
                {
                    supply.X += (PlayerX - supply.X) * Math.Min(1, delta * 3);
                    supply.Y += (PlayerY - supply.Y) * Math.Min(1, delta * 3);
                    if (supply.Age >= 1.2f)
                    {
                        if (supply.Kind == SupplyKind.Fuel) Progress.CollectFuel(50); else Progress.CollectMetal();
                        Emit(FlightEventKind.Pickup, supply: supply.Kind);
                        supplies.RemoveAt(i);
                    }
                }
            }
        }

        private void RefillBag()
        {
            var shuffled = (VocabularyEntry[])pool.Clone();
            for (int i = shuffled.Length - 1; i > 0; i--) { int j = random.Next(i + 1); var swap = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = swap; }
            foreach (var entry in shuffled) bag.Enqueue(entry);
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
            // the five-second stream running without introducing ambiguous alternative words.
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

        private void Retarget(EnemyState previous)
        {
            var candidates = enemies.Where(e => e != previous && (previous == null || e.Entry.id != previous.Entry.id)).ToArray();
            if (candidates.Length == 0) candidates = enemies.Where(e => e != previous).ToArray();
            Target = candidates.Length > 0 ? candidates[random.Next(candidates.Length)] : enemies.FirstOrDefault();
            targetAge = 0;
            TargetChanges++;
            Emit(FlightEventKind.Retarget, Target?.Entry);
        }

        public bool Roll()
        {
            if (Progress.IsOver || !CanRoll) return false;
            Rolls--;
            Retarget(Target);
            return true;
        }

        public bool Submit(string answer, string partOfSpeech)
        {
            if (Progress.IsOver || Driving || Target == null || GameRules.Normalize(answer).Length == 0) return false;
            if (!GameRules.Matches(answer, Target.Entry) || (Target.RequiresPartOfSpeech && partOfSpeech != Target.Entry.pos))
            { Progress.Wrong(); Emit(FlightEventKind.Wrong, Target.Entry); return false; }
            var hit = Target;
            hit.Health--;
            Emit(FlightEventKind.Hit, hit.Entry, hit.X, hit.Y, hit.Health);
            if (hit.Health <= 0) Kill(hit);
            Retarget(hit);
            return true;
        }

        private void Kill(EnemyState enemy)
        {
            enemies.Remove(enemy);
            int earned = Progress.ResolveCorrect(enemy.Entry.word, targetAge, 20);
            Emit(FlightEventKind.Kill, enemy.Entry, enemy.X, enemy.Y, earned);
            if (random.NextDouble() < .1) AddSupply(random.Next(2) == 0 ? SupplyKind.Fuel : SupplyKind.Metal, enemy.X, enemy.Y);
        }

        private void AddSupply(SupplyKind kind, float x, float y) => supplies.Add(new SupplyState { Id = ++serial, Kind = kind, X = x, Y = y });

        private void LaunchMissile(CarrierState carrier)
        {
            var choices = new List<VocabularyEntry>();
            foreach (var entry in pool.OrderBy(_ => random.Next()))
            {
                if (choices.All(e => QuestionDeck.DistinctAnswers(e, entry))) choices.Add(entry);
                if (choices.Count == 4) break;
            }
            if (choices.Count != 4) return;
            missiles.Add(new MissileState { Id = ++serial, X = carrier.X, Y = Math.Max(.18f, carrier.Y), Choices = choices.ToArray(), CorrectIndex = random.Next(4) });
        }

        public bool AnswerMissile(int id, int choice)
        {
            if (Driving || Progress.IsOver) return false;
            var missile = missiles.Find(m => m.Id == id);
            if (missile == null || choice < 0 || choice > 3) return false;
            if (choice != missile.CorrectIndex)
            {
                missile.WrongAttempts++;
                Progress.Wrong();
                Emit(FlightEventKind.Wrong, missile.Answer);
                if (missile.WrongAttempts >= 3)
                { Progress.Lose(); Emit(FlightEventKind.MissileFailure, missile.Answer, missile.X, missile.Y); }
                return false;
            }
            missiles.Remove(missile);
            Emit(FlightEventKind.MissileBlast, missile.Answer, missile.X, missile.Y);
            bool removedTarget = false;
            foreach (var enemy in enemies.ToArray())
            {
                // Coordinates use field-width units, compensating for the wide playfield.
                float dx = enemy.X - missile.X, dy = (enemy.Y - missile.Y) * FieldAspect;
                if (dx * dx + dy * dy > BlastRadius * BlastRadius) continue;
                removedTarget |= enemy == Target;
                Kill(enemy); // Blast bypasses invulnerability and the ice shield.
            }
            if (removedTarget) Retarget(null);
            return true;
        }
    }
}

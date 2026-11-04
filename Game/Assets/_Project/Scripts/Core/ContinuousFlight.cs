using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public enum FlightEnvironment { Jungle, Desert, Ice, Ocean }
    public enum SupplyKind { Fuel, Metal, Roll }
    public enum KillSource { PlayerShot, MissileBlast }
    public enum CarrierPhase { Entering, Deploying, Turning, Advancing, Exiting }
    public enum FlightEventKind { Spawn, Hit, Kill, Wrong, Retarget, Pickup, MissileBlast, MissileFailure, AircraftImpact, MissileImpact, Evaded, MissileWrong, MissileSolved }

    public sealed class EnemyState
    {
        public int Id, FormationSlot;
        public VocabularyEntry Entry;
        public float X, Y, Age, VelocityX, VelocityY, ChargeDelay;
        public bool Charging;
        public int Health;
        public FlightEnvironment Environment;
        public bool RequiresPartOfSpeech => Environment == FlightEnvironment.Desert;
    }

    public sealed class CarrierState
    {
        public int Id;
        public float X, Y, Age, RetreatStartX, RetreatStartY, VelocityX, VelocityY;
        public float HeadingDegrees, DepartureHeading;
        public double RetreatSeconds, TurnSeconds;
        public double LaunchTimer, FireTimer, DeploymentSeconds;
        public CarrierPhase Phase;
        public int ExitDirection, AircraftLaunched, MissilesLaunched, MissileChecks;
    }

    public sealed class MissileState
    {
        public int Id, CorrectIndex, WrongAttempts;
        public float X, Y, VelocityX, VelocityY;
        public bool Failed => WrongAttempts >= 3;
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
        public int EntityId;
        public KillSource Source;
        public bool ShouldPronounce => Kind == FlightEventKind.Kill && Source == KillSource.PlayerShot;
        public SupplyKind Supply;
    }

    // All timers, probabilities and combat rules live here; the Unity view only renders state.
    public sealed class ContinuousFlight
    {
        public const float EnvironmentDuration = 180;
        public const float BlastRadius = .09f;
        public const float FieldAspect = 548f / 1360f;
        public const float PlayerY = .92f;
        public const float AircraftSpawnSeconds = 12;
        public const float AircraftAttackAge = 18;
        public const float PlayerHitRadius = .035f;
        public const float PlayerSpeed = .85f;
        public const float ImpactGraceSeconds = .65f;
        public const float CarrierLaunchOffsetY = 88f / 548f;
        public const float MissileSpeedFactor = .8f;
        // Map percentages are measured upwards from the player's end of the field.
        public const float CarrierDeploymentY = .2f;
        public const float CarrierExitY = .5f;
        public const float CarrierDeploymentDuration = 20;
        public const float CarrierEntrySpeed = .055f;
        public const float CarrierAdvanceSpeed = .03f;
        public const float CarrierExitSpeed = .085f;
        public const float CarrierRetreatDuration = 18;
        public const float CarrierTurnDuration = 2.5f;
        private readonly Random random;
        private readonly VocabularyEntry[] pool;
        private readonly Queue<VocabularyEntry> bag = new Queue<VocabularyEntry>();
        private readonly FlightEnvironment initialEnvironment;
        private readonly List<EnemyState> enemies = new List<EnemyState>();
        private readonly List<CarrierState> carriers = new List<CarrierState>();
        private readonly List<MissileState> missiles = new List<MissileState>();
        private readonly List<SupplyState> supplies = new List<SupplyState>();
        private readonly Queue<FlightEvent> events = new Queue<FlightEvent>();
        private float spawnTimer, rollTimer, targetAge, desiredPlayerX = .5f, previousPlayerX;
        public float ImpactGraceRemaining { get; private set; }
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
        public float SpawnInterval => Environment == FlightEnvironment.Jungle ? AircraftSpawnSeconds / 1.3f : AircraftSpawnSeconds;
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

        public void SetDriving(bool driving) { Driving = driving; desiredPlayerX = PlayerX; }
        public void MovePlayer(float x)
        {
            if (Driving && !Progress.IsOver && !float.IsNaN(x) && !float.IsInfinity(x)) desiredPlayerX = Math.Max(.045f, Math.Min(.955f, x));
        }

        public FlightEvent PopEvent() => events.Count == 0 ? null : events.Dequeue();
        private void Emit(FlightEventKind kind, VocabularyEntry entry = null, float x = 0, float y = 0, int value = 0, SupplyKind supply = SupplyKind.Fuel, int entityId = 0, KillSource killSource = KillSource.PlayerShot)
            => events.Enqueue(new FlightEvent { Kind = kind, Entry = entry, X = x, Y = y, Value = value, Supply = supply, EntityId = entityId, Source = killSource });

        public void Tick(float delta)
        {
            if (Progress.IsOver || delta <= 0 || float.IsNaN(delta) || float.IsInfinity(delta)) return;
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
            if (Progress.IsOver) return;
            previousPlayerX = PlayerX;
            if (Driving) PlayerX += Math.Max(-PlayerSpeed * delta, Math.Min(PlayerSpeed * delta, desiredPlayerX - PlayerX));
            ImpactGraceRemaining = Math.Max(0, ImpactGraceRemaining - delta);
            targetAge += delta;
            spawnTimer += delta / SpawnInterval;
            if (spawnTimer >= 1)
            {
                spawnTimer -= 1;
                if (Environment == FlightEnvironment.Ocean && random.NextDouble() < .2)
                {
                    var carrier = new CarrierState { Id = ++serial, X = .15f + (float)random.NextDouble() * .7f, Y = -.22f, Phase = CarrierPhase.Entering };
                    carriers.Add(carrier);
                }
                else SpawnAircraft();
            }
            rollTimer += delta;
            if (rollTimer >= 5)
            {
                rollTimer -= 5;
                if (random.NextDouble() < .1) AddSupply(SupplyKind.Roll, .08f + (float)random.NextDouble() * .84f, 0);
            }
            for (int i = enemies.Count - 1; i >= 0 && !Progress.IsOver; i--)
            {
                var enemy = enemies[i];
                enemy.Age += delta;
                float oldX = enemy.X, oldY = enemy.Y;
                if (!enemy.Charging)
                {
                    float homeX = .07f + enemy.FormationSlot % 8 * .122f;
                    enemy.X += (homeX - enemy.X) * Math.Min(1, delta * .8f);
                    enemy.Y = Math.Min(.58f, enemy.Y + delta * .028f * GameRules.SpeedMultiplier(Progress.ActiveSeconds));
                    if (enemy.Age >= AircraftAttackAge)
                    {
                        enemy.Charging = true; enemy.ChargeDelay = 1.2f;
                        Aim(enemy.X, enemy.Y, .11f, out enemy.VelocityX, out enemy.VelocityY);
                    }
                }
                else if (enemy.ChargeDelay > 0) enemy.ChargeDelay = Math.Max(0, enemy.ChargeDelay - delta);
                else
                {
                    float speed = GameRules.SpeedMultiplier(Progress.ActiveSeconds);
                    enemy.X += enemy.VelocityX * delta * speed;
                    enemy.Y += enemy.VelocityY * delta * speed;
                }
                if (HitsPlayer(oldX, oldY, enemy.X, enemy.Y))
                {
                    bool wasTarget = enemy == Target;
                    enemies.RemoveAt(i);
                    int lost = ImpactDamage(1);
                    if (lost > 0) Emit(FlightEventKind.AircraftImpact, enemy.Entry, PlayerX, PlayerY, lost);
                    if (wasTarget) Retarget(null);
                }
                else if (OutsideField(enemy.X, enemy.Y))
                {
                    bool wasTarget = enemy == Target;
                    enemies.RemoveAt(i); Emit(FlightEventKind.Evaded, enemy.Entry);
                    if (wasTarget) Retarget(null);
                }
            }
            if (Progress.IsOver) return;
            for (int i = carriers.Count - 1; i >= 0; i--)
            {
                var carrier = carriers[i];
                carrier.Age += delta;
                float oldX = carrier.X, oldY = carrier.Y;
                AdvanceCarrier(carrier, delta);
                carrier.VelocityX = (carrier.X-oldX)/delta;
                carrier.VelocityY = (carrier.Y-oldY)/delta;
                if (carrier.Phase == CarrierPhase.Exiting && (carrier.X < -.12f || carrier.X > 1.12f)) carriers.RemoveAt(i);
            }
            for (int i = missiles.Count - 1; i >= 0 && !Progress.IsOver; i--)
            {
                var missile = missiles[i];
                float oldX = missile.X, oldY = missile.Y;
                float speed = GameRules.SpeedMultiplier(Progress.ActiveSeconds) * (missile.Failed ? 4 : 1);
                missile.X += missile.VelocityX * delta * speed;
                missile.Y += missile.VelocityY * delta * speed;
                if (HitsPlayer(oldX, oldY, missile.X, missile.Y))
                {
                    missiles.RemoveAt(i);
                    int lost = ImpactDamage(2);
                    if (lost > 0) Emit(FlightEventKind.MissileImpact, missile.Answer, PlayerX, PlayerY, lost);
                }
                else if (OutsideField(missile.X, missile.Y)) { missiles.RemoveAt(i); Emit(FlightEventKind.Evaded); }
            }
            if (Progress.IsOver) return;
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

        private void AdvanceCarrier(CarrierState carrier, float delta)
        {
            double remaining = delta;
            while (remaining > .0000001)
            {
                if (carrier.Phase == CarrierPhase.Entering)
                {
                    double travel = Math.Max(0, (CarrierDeploymentY - carrier.Y) / CarrierEntrySpeed);
                    double step = Math.Min(remaining, travel);
                    carrier.Y = Math.Min(CarrierDeploymentY, carrier.Y + (float)step * CarrierEntrySpeed);
                    remaining -= step;
                    if (travel > step + .000001) return;
                    carrier.Y = CarrierDeploymentY;
                    carrier.Phase = CarrierPhase.Deploying;
                    carrier.DeploymentSeconds = carrier.FireTimer = carrier.LaunchTimer = 0;
                    if (SpawnAircraft(carrier.X, carrier.Y + CarrierLaunchOffsetY) != null) carrier.AircraftLaunched++;
                }
                else if (carrier.Phase == CarrierPhase.Deploying)
                {
                    double step = Math.Min(remaining, CarrierDeploymentDuration - carrier.DeploymentSeconds);
                    carrier.DeploymentSeconds += step; carrier.LaunchTimer += step; carrier.FireTimer += step;
                    remaining -= step;
                    while (carrier.LaunchTimer >= AircraftSpawnSeconds - .000001)
                    {
                        carrier.LaunchTimer = Math.Max(0, carrier.LaunchTimer - AircraftSpawnSeconds);
                        if (SpawnAircraft(carrier.X, carrier.Y + CarrierLaunchOffsetY) != null) carrier.AircraftLaunched++;
                    }
                    while (carrier.FireTimer >= 5 - .000001)
                    {
                        carrier.FireTimer = Math.Max(0, carrier.FireTimer - 5);
                        carrier.MissileChecks++;
                        if (random.NextDouble() < .5 && LaunchMissile(carrier)) carrier.MissilesLaunched++;
                    }
                    if (carrier.DeploymentSeconds < CarrierDeploymentDuration - .000001) return;
                    carrier.DeploymentSeconds = CarrierDeploymentDuration;
                    carrier.RetreatStartX = carrier.X; carrier.RetreatStartY = carrier.Y;
                    carrier.RetreatSeconds = 0;
                    carrier.TurnSeconds = 0;
                    carrier.ExitDirection = carrier.X <= .5f ? -1 : 1;
                    float edgeX=carrier.ExitDirection<0?-.15f:1.15f;
                    carrier.DepartureHeading=(float)(Math.Atan2(edgeX-carrier.X,(.62f-carrier.Y)*FieldAspect)*180/Math.PI);
                    carrier.Phase = CarrierPhase.Turning;
                }
                else if(carrier.Phase==CarrierPhase.Turning)
                {
                    double step=Math.Min(remaining,CarrierTurnDuration-carrier.TurnSeconds);
                    carrier.TurnSeconds+=step;remaining-=step;
                    float t=(float)(carrier.TurnSeconds/CarrierTurnDuration);
                    carrier.HeadingDegrees=carrier.DepartureHeading*t*t*(3-2*t);
                    if(carrier.TurnSeconds<CarrierTurnDuration-.000001)return;
                    carrier.HeadingDegrees=carrier.DepartureHeading;
                    carrier.Phase=CarrierPhase.Advancing;
                }
                else
                {
                    // Finish the in-place turn before accelerating along the bow direction.
                    // The same parametric route continues through the mid-field marker.
                    carrier.RetreatSeconds = Math.Min(CarrierRetreatDuration, carrier.RetreatSeconds + remaining);
                    float endX = carrier.ExitDirection < 0 ? -.15f : 1.15f;
                    float t=(float)(carrier.RetreatSeconds/CarrierRetreatDuration);
                    float progress=t*t*(2-t);
                    carrier.X=carrier.RetreatStartX+(endX-carrier.RetreatStartX)*progress;
                    carrier.Y=carrier.RetreatStartY+(.62f-carrier.RetreatStartY)*progress;
                    carrier.HeadingDegrees=carrier.DepartureHeading;
                    if(carrier.Y>=CarrierExitY)carrier.Phase=CarrierPhase.Exiting;
                    return;
                }
            }
        }

        private void Aim(float x, float y, float speed, out float velocityX, out float velocityY)
        {
            float dx = PlayerX - x, dy = (PlayerY - y) * FieldAspect;
            float distance = (float)Math.Sqrt(dx * dx + dy * dy);
            distance = Math.Max(.001f, distance);
            velocityX = dx / distance * speed;
            velocityY = dy / distance * speed / FieldAspect;
        }

        private static bool OutsideField(float x, float y) => y > 1.12f || x < -.12f || x > 1.12f;

        private int ImpactDamage(int amount)
        {
            if (ImpactGraceRemaining > 0) return 0;
            int lost = Progress.Damage(amount);
            if (lost > 0) ImpactGraceRemaining = ImpactGraceSeconds;
            return lost;
        }

        private bool HitsPlayer(float fromX, float fromY, float toX, float toY)
        {
            // Swept circle test prevents fast rockets tunnelling through the player.
            float dx = toX - fromX - (PlayerX - previousPlayerX), dy = (toY - fromY) * FieldAspect;
            float px = previousPlayerX - fromX, py = (PlayerY - fromY) * FieldAspect;
            float lengthSquared = dx * dx + dy * dy;
            float t = lengthSquared < .0000001f ? 0 : Math.Max(0, Math.Min(1, (px * dx + py * dy) / lengthSquared));
            float closestX = px - t * dx, closestY = py - t * dy;
            return closestX * closestX + closestY * closestY <= PlayerHitRadius * PlayerHitRadius;
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
            if (hit.Health <= 0) Kill(hit, KillSource.PlayerShot);
            Retarget(hit);
            return true;
        }

        private void Kill(EnemyState enemy, KillSource source)
        {
            enemies.Remove(enemy);
            int earned = source == KillSource.PlayerShot
                ? Progress.ResolveCorrect(enemy.Entry.word, targetAge, 20) : Progress.ResolveBlastKill();
            Emit(FlightEventKind.Kill, enemy.Entry, enemy.X, enemy.Y, earned, killSource: source);
            if (random.NextDouble() < .1) AddSupply(random.Next(2) == 0 ? SupplyKind.Fuel : SupplyKind.Metal, enemy.X, enemy.Y);
        }

        private void AddSupply(SupplyKind kind, float x, float y) => supplies.Add(new SupplyState { Id = ++serial, Kind = kind, X = x, Y = y });

        private bool LaunchMissile(CarrierState carrier)
        {
            var choices = new List<VocabularyEntry>();
            foreach (var entry in pool.OrderBy(_ => random.Next()))
            {
                if (choices.All(e => QuestionDeck.DistinctAnswers(e, entry))) choices.Add(entry);
                if (choices.Count == 4) break;
            }
            if (choices.Count != 4) return false;
            var missile = new MissileState { Id = ++serial, X = carrier.X, Y = carrier.Y + CarrierLaunchOffsetY, Choices = choices.ToArray(), CorrectIndex = random.Next(4) };
            Aim(missile.X, missile.Y, .035f * MissileSpeedFactor, out missile.VelocityX, out missile.VelocityY);
            missiles.Add(missile);
            return true;
        }

        public bool AnswerMissile(int id, int choice)
        {
            if (Driving || Progress.IsOver) return false;
            var missile = missiles.Find(m => m.Id == id);
            if (missile == null || missile.Failed || choice < 0 || choice > 3) return false;
            if (choice != missile.CorrectIndex)
            {
                missile.WrongAttempts++;
                Progress.Wrong();
                Emit(FlightEventKind.MissileWrong, missile.Answer, missile.X, missile.Y, missile.WrongAttempts, entityId: missile.Id);
                if (missile.WrongAttempts >= 3)
                { Emit(FlightEventKind.MissileFailure, missile.Answer, missile.X, missile.Y); }
                return false;
            }
            missiles.Remove(missile);
            int earned = Progress.ResolveCorrect(missile.Answer.word, 20, 20);
            Emit(FlightEventKind.MissileSolved, missile.Answer, missile.X, missile.Y, earned, entityId: missile.Id);
            Emit(FlightEventKind.MissileBlast, missile.Answer, missile.X, missile.Y);
            bool removedTarget = false;
            foreach (var enemy in enemies.ToArray())
            {
                // Coordinates use field-width units, compensating for the wide playfield.
                float dx = enemy.X - missile.X, dy = (enemy.Y - missile.Y) * FieldAspect;
                if (dx * dx + dy * dy > BlastRadius * BlastRadius) continue;
                removedTarget |= enemy == Target;
                Kill(enemy, KillSource.MissileBlast); // Blast bypasses invulnerability and the ice shield.
            }
            if (removedTarget) Retarget(null);
            return true;
        }
    }
}

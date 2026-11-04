using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public enum FlightEnvironment { Jungle, Desert, Ice, Ocean }
    public enum SupplyKind { Fuel, Metal, Roll }
    public enum KillSource { PlayerShot, MissileBlast }
    public enum CarrierPhase { Entering, Deploying, Turning, Advancing, Exiting }
    public enum EnemyPhase { Patrol, Locking, Departing }
    public enum MissilePhase { Cruise, Locking, Boost }
    public enum FlightEventKind { Spawn, Hit, Kill, Wrong, Retarget, Pickup, MissileBlast, MissileFailure, AircraftImpact, MissileImpact, Evaded, MissileWrong, MissileSolved, AircraftLock, AircraftFire, MissileLock, MissileBoost }

    public sealed class EnemyState
    {
        public int Id, FormationSlot;
        public VocabularyEntry Entry;
        public float X, Y, Age, VelocityX, VelocityY;
        // Attack: Patrol -> Locking (guns out, sight on the player) -> homing burst -> Departing (banks off the map).
        public EnemyPhase Phase;
        public float LockRemaining, DepartSeconds, FireY, DepartStartSpeed;
        public int DepartDirection;
        public int Health;
        public FlightEnvironment Environment;
        public bool RequiresPartOfSpeech => Environment == FlightEnvironment.Desert;
        public bool Attacking => Phase != EnemyPhase.Patrol;
        public bool Departing => Phase == EnemyPhase.Departing;
        public float LockProgress => Phase == EnemyPhase.Locking ? 1 - LockRemaining / ContinuousFlight.AircraftLockSeconds : Phase == EnemyPhase.Departing ? 1 : 0;
    }

    // One machine-gun round. It interpolates towards the player's current position, so it cannot be dodged.
    public sealed class ShotState
    {
        public int Id, SourceId;
        public VocabularyEntry Entry;
        public float StartX, StartY, X, Y, Age, VelocityX, VelocityY;
        public bool InFlight => Age >= 0;
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
        public float X, Y, VelocityX, VelocityY, PhaseSeconds;
        // Cruise (slow seeker, answerable) -> Locking (sight on the player, still answerable) -> Boost (unstoppable).
        public MissilePhase Phase;
        public bool Failed => WrongAttempts >= 3;
        public bool Answerable => !Failed && Phase != MissilePhase.Boost;
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
        // Locking gives the player time to shoot the attacker down; once it fires the burst always connects.
        public const float AircraftLockSeconds = 4.5f;
        public const int ShotBurst = 3;
        public const float ShotSpacing = .09f, ShotTravelSeconds = .42f;
        public const float DepartTurnSeconds = 1.1f;
        // Patrol descent (field heights/s at x1 speed) and the range of rows where the burst is fired.
        public const float PatrolSpeed = .022f, FireRowMin = .62f, FireRowMax = .7f;
        public const float PlayerSpeed = .85f;
        public const float ImpactGraceSeconds = .65f;
        public const float CarrierLaunchOffsetY = 88f / 548f;
        public const float MissileSpeedFactor = .8f;
        public const float MissileTerminalY = PlayerY - .2f;
        public const float MissileLockSeconds = 1.2f, MissileFailedLockSeconds = .6f;
        // Field widths per second; faster than PlayerSpeed, so a boosting rocket always catches the aircraft.
        public const float MissileBoostSpeed = 1.6f;
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
        private readonly List<ShotState> shots = new List<ShotState>();
        private readonly Queue<FlightEvent> events = new Queue<FlightEvent>();
        private float spawnTimer, rollTimer, targetAge, desiredPlayerX = .5f;
        public float ImpactGraceRemaining { get; private set; }
        private int serial;
        public FlightProgress Progress { get; } = new FlightProgress();
        public IReadOnlyList<EnemyState> Enemies => enemies;
        public IReadOnlyList<CarrierState> Carriers => carriers;
        public IReadOnlyList<MissileState> Missiles => missiles;
        public IReadOnlyList<SupplyState> Supplies => supplies;
        public IReadOnlyList<ShotState> Shots => shots;
        public bool PlayerLockedOn => enemies.Any(e => e.Phase == EnemyPhase.Locking) || missiles.Any(m => m.Phase != MissilePhase.Cruise) || shots.Count > 0;
        public EnemyState Target { get; private set; }
        public bool Driving { get; private set; } = true;
        public float PlayerX { get; private set; } = .5f;
        public int Rolls { get; private set; } = 3;
        public bool CanRoll => Rolls > 0 && Target != null && enemies.Any(e => !e.Departing && e.Entry.id != Target.Entry.id);
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
                float speed = GameRules.SpeedMultiplier(Progress.ActiveSeconds);
                missile.PhaseSeconds += delta;
                if (missile.Phase == MissilePhase.Cruise)
                {
                    // Slow seeker: re-aims every step, so the rocket follows the player instead of flying a fixed line.
                    Aim(missile.X, missile.Y, .035f * MissileSpeedFactor, out missile.VelocityX, out missile.VelocityY);
                    missile.X += missile.VelocityX * delta * speed;
                    missile.Y += missile.VelocityY * delta * speed;
                    if (missile.Y >= MissileTerminalY || missile.Failed)
                    {
                        missile.Phase = MissilePhase.Locking; missile.PhaseSeconds = 0;
                        Emit(FlightEventKind.MissileLock, missile.Answer, missile.X, missile.Y, entityId: missile.Id);
                    }
                }
                else if (missile.Phase == MissilePhase.Locking)
                {
                    Aim(missile.X, missile.Y, .035f * MissileSpeedFactor, out missile.VelocityX, out missile.VelocityY);
                    missile.X += missile.VelocityX * delta * .25f; missile.Y += missile.VelocityY * delta * .25f;
                    if (missile.PhaseSeconds >= (missile.Failed ? MissileFailedLockSeconds : MissileLockSeconds))
                    {
                        missile.Phase = MissilePhase.Boost; missile.PhaseSeconds = 0;
                        Emit(FlightEventKind.MissileBoost, missile.Answer, missile.X, missile.Y, entityId: missile.Id);
                    }
                }
                else
                {
                    // Boost: faster than the player can move and steering straight at the aircraft.
                    float boost = MissileBoostSpeed * Math.Min(1, .35f + missile.PhaseSeconds * 3);
                    float dx = PlayerX - missile.X, dy = (PlayerY - missile.Y) * FieldAspect;
                    float distance = (float)Math.Sqrt(dx * dx + dy * dy), step = boost * delta;
                    if (step < distance)
                    {
                        missile.VelocityX = dx / distance * boost; missile.VelocityY = dy / distance * boost / FieldAspect;
                        missile.X += missile.VelocityX * delta; missile.Y += missile.VelocityY * delta;
                        continue;
                    }
                    missiles.RemoveAt(i);
                    int lost = ImpactDamage(2);
                    if (lost > 0) Emit(FlightEventKind.MissileImpact, missile.Answer, PlayerX, PlayerY, lost, entityId: missile.Id);
                }
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
            var active = enemies.Where(e => !e.Departing && e != previous).ToArray();
            var candidates = active.Where(e => previous == null || e.Entry.id != previous.Entry.id).ToArray();
            if (candidates.Length == 0) candidates = active;
            // Aircraft that are already locking on outrank the rest: the closest to firing is asked first.
            var urgent = candidates.Where(e => e.Phase == EnemyPhase.Locking).OrderBy(e => e.LockRemaining).FirstOrDefault();
            Target = urgent ?? (candidates.Length > 0 ? candidates[random.Next(candidates.Length)] : enemies.FirstOrDefault(e => !e.Departing));
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
            // A shielded aircraft that is locking on stays on the radio after its shield breaks.
            if (hit.Health > 0 && hit.Phase == EnemyPhase.Locking) targetAge = 0;
            else Retarget(hit);
            return true;
        }

        private void Kill(EnemyState enemy, KillSource source)
        {
            enemies.Remove(enemy);
            int earned = source == KillSource.PlayerShot
                ? Progress.ResolveCorrect(enemy.Entry.word, targetAge, 20) : Progress.ResolveBlastKill();
            Emit(FlightEventKind.Kill, enemy.Entry, enemy.X, enemy.Y, earned, killSource: source, entityId: enemy.Id);
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
            if (missile == null || !missile.Answerable || choice < 0 || choice > 3) return false;
            if (choice != missile.CorrectIndex)
            {
                missile.WrongAttempts++;
                Progress.Wrong();
                Emit(FlightEventKind.MissileWrong, missile.Answer, missile.X, missile.Y, missile.WrongAttempts, entityId: missile.Id);
                if (missile.WrongAttempts >= 3)
                { Emit(FlightEventKind.MissileFailure, missile.Answer, missile.X, missile.Y, entityId: missile.Id); }
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

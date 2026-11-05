using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    // All timers, probabilities and combat rules live here; the Unity view only renders state.
    public sealed partial class ContinuousFlight
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
            AdvanceEnemies(delta);
            AdvanceShots(delta);
            if (Progress.IsOver) return;
            AdvanceCarriers(delta);
            AdvanceMissiles(delta);
            if (Progress.IsOver) return;
            AdvanceSupplies(delta);
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
    }
}

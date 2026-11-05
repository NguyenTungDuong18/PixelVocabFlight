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
}

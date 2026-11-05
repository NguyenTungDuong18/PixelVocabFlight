using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed partial class ContinuousFlight
    {
        private void AdvanceMissiles(float delta)
        {
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

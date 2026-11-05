using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed partial class ContinuousFlight
    {
        private void RefillBag()
        {
            var shuffled = (VocabularyEntry[])pool.Clone();
            for (int i = shuffled.Length - 1; i > 0; i--) { int j = random.Next(i + 1); var swap = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = swap; }
            foreach (var entry in shuffled) bag.Enqueue(entry);
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
    }
}

using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed partial class ContinuousFlight
    {
        private void AdvanceCarriers(float delta)
        {
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
    }
}

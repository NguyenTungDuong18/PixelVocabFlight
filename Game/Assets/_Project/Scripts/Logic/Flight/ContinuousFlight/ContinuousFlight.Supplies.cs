using System;
using System.Collections.Generic;
using System.Linq;

namespace PixelVocabFlight
{
    public sealed partial class ContinuousFlight
    {
        private void AdvanceSupplies(float delta)
        {
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

        private void AddSupply(SupplyKind kind, float x, float y) => supplies.Add(new SupplyState { Id = ++serial, Kind = kind, X = x, Y = y });
    }
}

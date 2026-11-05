using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightBoardView
    {
        private void SyncCarriers(ContinuousFlight flight, float delta)
        {
            wakeTimer += delta; bool wake = wakeTimer >= .35f; if (wake) wakeTimer = 0;
            foreach (int id in carriers.Keys.Where(id => !flight.Carriers.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(carriers[id].Root.gameObject); carriers.Remove(id); }
            foreach (var carrier in flight.Carriers)
            {
                if (!carriers.TryGetValue(carrier.Id, out var visual))
                {
                    var rect = UiKit.Rect("Carrier", field, 0, 0, 64, 224);
                    rect.pivot = new Vector2(.5f, .5f);
                    visual = new CarrierVisual
                    {
                        Root = rect,
                        Bow = UiKit.Sprite("Bow wave", rect, 0, -2, 64, 48, "carrier_bow_wave"),
                        Stern = UiKit.Sprite("Stern wake", rect, 0, 206, 64, 40, "carrier_stern_wake"),
                        Body = UiKit.Sprite("Carrier hull", rect, 0, 0, 64, 224, "carrier")
                    };
                    carriers.Add(carrier.Id, visual); rect.SetSiblingIndex(1);
                }
                Place(visual.Root, carrier.X, carrier.Y);
                visual.Root.localEulerAngles = new Vector3(0, 0, 180 + carrier.HeadingDegrees);
                bool moving = Mathf.Abs(carrier.VelocityX) + Mathf.Abs(carrier.VelocityY) > .002f;
                visual.Body.sprite = PixelSprites.At("carrier", animationTime + carrier.Id);
                visual.Bow.gameObject.SetActive(moving); visual.Stern.gameObject.SetActive(moving);
                if (moving) { visual.Bow.sprite = PixelSprites.At("carrier_bow_wave", animationTime); visual.Stern.sprite = PixelSprites.At("carrier_stern_wake", animationTime); }
                if (wake && moving)
                {
                    float angle = carrier.HeadingDegrees * Mathf.Deg2Rad;
                    terrain.Wake(carrier.X - Mathf.Sin(angle) * 110 / Width, carrier.Y - Mathf.Cos(angle) * 110 / Height);
                }
            }
        }
    }
}

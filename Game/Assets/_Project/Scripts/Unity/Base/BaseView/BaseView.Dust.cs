using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class BaseView
    {
        // ---------------- Dust puffs (fx_dust, optional) ----------------
        private bool DustReady => PixelSprites.Has(DustSprite) && Ready(DustSprite);

        // A puff on the ground a little behind the feet (opposite the facing), fixed in the world.
        private void SpawnDust(float x, float y, Facing facing)
        {
            if (!DustReady) return;
            switch (facing)
            {
                case Facing.E: x -= DustBehind; break;
                case Facing.W: x += DustBehind; break;
                case Facing.N: y += DustBehind; break;
                default: y -= DustBehind; break;
            }
            Puff puff = null;
            foreach (var p in dust) if (!p.Live) { puff = p; break; }
            if (puff == null && dust.Count < DustPool)
            {
                var image = UiKit.Box("Dust", shadowLayer, 0, 0, 48, 24, Color.white);
                image.raycastTarget = false;
                puff = new Puff { Image = image };
                dust.Add(puff);
            }
            if (puff == null) { puff = dust[0]; foreach (var p in dust) if (p.Age > puff.Age) puff = p; }
            puff.Live = true; puff.Age = 0;
            puff.Image.enabled = true;
            puff.Image.sprite = PixelSprites.Get(DustSprite, 0);
            var size = PixelSprites.Size(DustSprite, 1);
            var anchor = AnchorOf(DustSprite, size, new Vector2(size.x / 2, size.y - 1));
            var rect = puff.Image.rectTransform;
            rect.sizeDelta = size * Scale;
            rect.anchoredPosition = new Vector2(Snap(x * TileSize - anchor.x * Scale), -Snap(y * TileSize - anchor.y * Scale));
            DustPuffs++;
        }

        // Each puff plays its frames once, then hides until the pool reuses it.
        private void UpdateDust(float delta)
        {
            if (dust.Count == 0) return;
            float life = PixelSprites.Duration(DustSprite);
            foreach (var p in dust)
            {
                if (!p.Live) continue;
                p.Age += delta;
                if (p.Age >= life) { p.Live = false; p.Image.enabled = false; continue; }
                p.Image.sprite = PixelSprites.At(DustSprite, p.Age);
            }
        }
    }
}

using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightBoardView
    {
        private Effect AddEffect(string anim, float x, float y, float w, float h, Vector2 velocity = default, float rotation = 0, float delay = 0, float lifetime = 0, bool fade = false)
        {
            var image = UiKit.Sprite(anim, field, x, y, w, h, anim);
            image.preserveAspect = false;
            image.enabled = delay <= 0;
            var rect = image.rectTransform;
            if (rotation != 0) { rect.pivot = new Vector2(.5f, .5f); rect.anchoredPosition += new Vector2(w * .5f, -h * .5f); rect.localEulerAngles = new Vector3(0, 0, rotation); }
            float life = lifetime > 0 ? lifetime : PixelSprites.Duration(anim);
            var effect = new Effect { Rect = rect, Image = image, Anim = PixelSprites.FrameCount(anim) > 1 ? anim : null, Remaining = life, Lifetime = life, Delay = delay, Velocity = velocity, Fade = fade };
            effects.Add(effect);
            return effect;
        }

        private void Explode(float x, float y, float scale, float delay = 0)
        {
            float size = 32 * scale;
            AddEffect("fx_explosion", x * Width - size * .5f, y * Height - size * .5f, size, size, delay: delay);
            for (int i = 0; i < 4; i++)
            {
                float angle = (i * 90 + 45 + Random.Range(-20, 20)) * Mathf.Deg2Rad;
                AddEffect("fx_spark", x * Width - 12, y * Height - 12, 24, 24, new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * 90 * scale, delay: delay);
            }
        }

        // WWII fighters fire wing-mounted machine guns: tracers travel to the target, then it bursts.
        public void Hit(float x, float y, bool killed, float playerX)
        {
            const float travel = .14f;
            Vector2 target = new Vector2(x * Width, y * Height);
            for (int gun = -1; gun <= 1; gun += 2)
            {
                Vector2 start = new Vector2(playerX * Width + gun * 16, ContinuousFlight.PlayerY * Height - 10);
                Vector2 path = target - start;
                float angle = Vector2.SignedAngle(Vector2.up, new Vector2(path.x, -path.y));
                for (int round = 0; round < 3; round++)
                    AddEffect("tracer", start.x - 4, start.y - 12, 8, 24, new Vector2(path.x, -path.y) / travel, angle, round * .045f + (gun > 0 ? .02f : 0), travel);
            }
            AddEffect("muzzle_flash", playerX * Width - 16, ContinuousFlight.PlayerY * Height - 48, 32, 32);
            if (killed) Explode(x, y, 3, travel); else AddEffect("fx_spark", target.x - 18, target.y - 18, 36, 36, delay: travel);
        }

        public void Burst(float x, float y, Color color, int count = 14) => Explode(x, y, count >= 20 ? 3 : 2);

        public void Impact(float x, float y) { Explode(x, y, 2.5f); shake = .3f; }

        public void Blast(float x, float y)
        {
            BlastEffects++;
            float diameter = ContinuousFlight.BlastRadius * Width * 2;
            AddEffect("fx_shockwave", x * Width - diameter * .5f, y * Height - diameter * .5f, diameter, diameter);
            Explode(x, y, 3.5f);
            shake = Mathf.Max(shake, .15f);
        }
    }
}

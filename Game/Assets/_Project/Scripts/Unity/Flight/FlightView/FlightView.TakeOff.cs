using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightView
    {
        // ---------------- Take-off cutscene: airfield strip, long roll down the jungle runway ----------------
        // Boarding SKYLARK on the base cuts to this scene: the screen opens from black on the parked fighter,
        // the engine coughs to life ("tu tu"), the fighter makes a long take-off roll with the camera following
        // it out of the airbase onto the jungle runway, lifts off (grows, shadow drops away) and fades to black.
        public void BeginTakeOff()
        {
            ClearOverlay();
            SetCurtain(1); SetHudAlpha(1);
            // The airfield is a tall strip the camera can follow: airbase, then the base edge with its
            // perimeter fence, then runway cut through the jungle (PixelForge runway.cjs, 4x scale).
            airfieldWorld = UiKit.Rect("Airfield", overlay, 0, 0, 1440, 900);
            airfieldScene = UiKit.Sprite("Airbase", airfieldWorld, 0, 0, 1440, 900, "title_airbase");
            airfieldScene.preserveAspect = false;
            UiKit.Sprite("Base edge", airfieldWorld, 0, -TileHeight, 1440, TileHeight, "title_runway_edge").preserveAspect = false;
            for (int k = 0; k < 3; k++) UiKit.Sprite("Jungle runway", airfieldWorld, 0, -TileHeight * (k + 2), 1440, TileHeight, "title_runway_jungle").preserveAspect = false;
            // Parked hero fighter on the runway, scene scale 4x (same sprite as in flight).
            takeOffHeroShadow = UiKit.Sprite("Hero shadow", overlay, 588 + 6, 500 + 8, 128, 128, "fighter_shadow");
            takeOffHero = UiKit.Sprite("Hero fighter", overlay, 588, 500, 128, 128, "fighter_level");
            var clouds = new GameObject("Clouds", typeof(RectTransform), typeof(RawImage));
            var cloudRect = clouds.GetComponent<RectTransform>(); cloudRect.SetParent(overlay, false);
            cloudRect.anchorMin = cloudRect.anchorMax = cloudRect.pivot = new Vector2(0, 1); cloudRect.anchoredPosition = Vector2.zero; cloudRect.sizeDelta = new Vector2(1440, 900);
            airfieldClouds = clouds.GetComponent<RawImage>(); airfieldClouds.raycastTarget = false;
            var cloudTexture = PixelSprites.Texture("title_clouds"); cloudTexture.wrapMode = TextureWrapMode.Repeat; airfieldClouds.texture = cloudTexture;
            var tag = UiKit.Framed("Hero tag", overlay, 500, 640, 304, 34, "ui_plate", 2);
            takeOffTag = tag.rectTransform; tag.gameObject.AddComponent<CanvasGroup>();
            UiKit.Label("SKYLARK MK.I  ·  " + BaseContent.PlayerName.ToUpperInvariant(), tag.transform, 0, 0, 304, 34, 14, UiKit.Mint, true, TextAnchor.MiddleCenter);
            launchTime = 0; puffTimer = 0; airfieldTime = 0;
            AnimateTakeOff(0);
        }

        private static float Smooth(float t) { t = Mathf.Clamp01(t); return t * t * (3 - 2 * t); }

        // Returns true when the screen is fully dark and the sortie can begin.
        public bool AnimateTakeOff(float delta)
        {
            if (!Launching || !takeOffHero) return true;
            airfieldTime += delta;
            launchTime += Mathf.Min(delta, .05f);
            float t = launchTime;
            airfieldScene.sprite = PixelSprites.At("title_airbase", airfieldTime);
            // Idle engine ticks over slowly, then the propeller spins up.
            propellerTime += delta * Mathf.Lerp(.12f, 1.8f, Mathf.Clamp01(t / EngineStartSeconds));
            takeOffHero.sprite = PixelSprites.At("fighter_level", propellerTime);
            takeOffTag.GetComponent<CanvasGroup>().alpha = 1 - Smooth((t - .9f) / .4f);
            float roll = Mathf.Max(0, t - EngineStartSeconds), distance = RollAcceleration * roll * roll;
            float followed = Mathf.Min(distance, RollAcceleration * FollowSeconds * FollowSeconds);
            launchScroll = Mathf.Max(0, followed - FollowAfter);
            airfieldWorld.anchoredPosition = new Vector2(0, -Mathf.Round(launchScroll / 4) * 4);
            // Clouds drift slowly and, during the roll, stream past a little faster than the ground.
            airfieldClouds.uvRect = new Rect(Mathf.Round(airfieldTime * 4) / 360f, (Mathf.Round(launchScroll * 1.25f / 4) - Mathf.Round(airfieldTime * 2.5f)) / 225f, 1, 1);
            float lift = Smooth((t - 3.7f) / 1.3f);
            float size = 128 * (1 + .6f * lift);
            // On screen the fighter first moves up a little, then holds while the ground streams past,
            // and after lift-off climbs away ahead of the camera.
            float cy = 564 - (distance - launchScroll);
            var jitter = t < EngineStartSeconds + .1f && Mathf.Repeat(t, .22f) < .07f ? new Vector2(UnityEngine.Random.Range(-2, 3), UnityEngine.Random.Range(-1, 2)) * 2 : Vector2.zero;
            if (lift < 1) jitter += new Vector2(Mathf.Round(Mathf.Sin(t * 90) * (1 - lift)), 0);
            takeOffHero.rectTransform.sizeDelta = new Vector2(size, size);
            takeOffHero.rectTransform.anchoredPosition = new Vector2(Mathf.Round(652 - size / 2), -Mathf.Round(cy - size / 2)) + jitter;
            var shadowOffset = Vector2.Lerp(new Vector2(6, -8), new Vector2(84, -120), lift);
            takeOffHeroShadow.rectTransform.sizeDelta = new Vector2(128, 128) * (1 + .15f * lift);
            takeOffHeroShadow.rectTransform.anchoredPosition = new Vector2(652 - 64, -(cy - 64)) + shadowOffset;
            takeOffHeroShadow.color = new Color(1, 1, 1, 1 - .7f * lift);
            puffTimer -= delta;
            if (t > .12f && t < 4.2f && puffTimer <= 0)
            {
                bool starting = t < EngineStartSeconds;
                puffTimer = starting ? (Mathf.Repeat(t, .22f) < .1f ? .04f : .16f) : .06f;
                for (int side = -1; side <= 1; side += 2)
                {
                    // Exhaust puffs stay where they were blown out, so they trail behind the rolling fighter.
                    float s = 22 + (starting ? 10 : 0);
                    var puff = UiKit.Sprite("Exhaust", airfieldWorld, 652 + side * 22 * size / 128 - s / 2, cy - 18 * size / 128 - s / 2 - launchScroll, s, s, "fx_smoke");
                    puff.preserveAspect = false;
                    puffs.Add((puff, 0, new Vector2(side * UnityEngine.Random.Range(14, 40), starting ? -30 : 20)));
                }
            }
            for (int i = puffs.Count - 1; i >= 0; i--)
            {
                var (image, age, velocity) = puffs[i];
                age += delta;
                if (age >= PixelSprites.Duration("fx_smoke") || !image) { if (image) UnityEngine.Object.Destroy(image.gameObject); puffs.RemoveAt(i); continue; }
                image.sprite = PixelSprites.At("fx_smoke", age);
                image.rectTransform.anchoredPosition += velocity * delta;
                image.rectTransform.sizeDelta += Vector2.one * 26 * delta;
                puffs[i] = (image, age, velocity);
            }
            // Opens from the black cut out of the base, darkens again after lift-off.
            SetCurtain(Mathf.Max(1 - Smooth(t / .45f), Smooth((t - 4.7f) / .95f)));
            return t >= TakeOffSeconds;
        }

        public void SetCurtain(float alpha) => curtain.color = new Color(0, 0, 0, Mathf.Clamp01(alpha));
        public void SetHudAlpha(float alpha) { headerGroup.alpha = cockpitGroup.alpha = Mathf.Clamp01(alpha); }

        // Battle intro: the screen opens from black, the fighter climbs in from the bottom edge,
        // the ground drifts out of focus and the instruments fade up.
        public void BeginIntro() { SetCurtain(1); SetHudAlpha(0); Board.IntroLift = 1; Board.Focus = 0; }
        public void AnimateIntro(float t)
        {
            SetCurtain(1 - Smooth(t / .45f));
            float climb = 1 - Mathf.Clamp01(t / .9f);
            Board.IntroLift = climb * climb * climb;
            Board.Focus = Smooth((t - .25f) / .75f);
            SetHudAlpha(Smooth((t - .3f) / .7f));
        }
        public void FinishIntro() { SetCurtain(0); SetHudAlpha(1); Board.IntroLift = 0; Board.Focus = 1; }
    }
}

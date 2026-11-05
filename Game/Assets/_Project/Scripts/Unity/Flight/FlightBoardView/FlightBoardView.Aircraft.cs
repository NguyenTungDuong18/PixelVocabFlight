using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightBoardView
    {
        // Lock-on sight over the player: brackets close in with the most advanced lock, then blink red.
        private void SyncReticle(ContinuousFlight flight)
        {
            float progress = -1;
            foreach (var e in flight.Enemies) if (e.Phase == EnemyPhase.Locking) progress = Mathf.Max(progress, e.LockProgress);
            foreach (var m in flight.Missiles)
                if (m.Phase == MissilePhase.Locking) progress = Mathf.Max(progress, m.PhaseSeconds / (m.Failed ? ContinuousFlight.MissileFailedLockSeconds : ContinuousFlight.MissileLockSeconds));
                else if (m.Phase == MissilePhase.Boost) progress = 1;
            if (flight.Shots.Count > 0) progress = 1;
            reticle.enabled = progress >= 0 && player.gameObject.activeSelf;
            if (!reticle.enabled) return;
            int frame = progress < .8f ? Mathf.Min(5, Mathf.FloorToInt(progress / .8f * 6)) : 6 + (int)(animationTime * 8) % 2;
            reticle.sprite = PixelSprites.Get("fx_lock_reticle", frame);
            reticle.rectTransform.anchoredPosition = player.anchoredPosition + new Vector2(32, -32);
            reticle.transform.SetAsLastSibling();
        }

        private void SyncEnemies(ContinuousFlight flight)
        {
            foreach (int id in enemies.Keys.Where(id => !flight.Enemies.Any(e => e.Id == id)).ToArray())
            { Object.Destroy(enemies[id].Root.gameObject); enemies.Remove(id); }
            foreach (var enemy in flight.Enemies)
            {
                if (!enemies.TryGetValue(enemy.Id, out var visual))
                {
                    var root = UiKit.Rect("Enemy " + enemy.Entry.word, field, 0, 0, 146, 88);
                    var shadow = UiKit.Sprite("Bomber shadow", root, 25 + ShadowOffset.x, -10 - ShadowOffset.y, 96, 80, "bomber_shadow");
                    var body = UiKit.Sprite("Bomber", root, 25, -10, 96, 80, Livery(enemy.Environment));
                    var guns = UiKit.Sprite("Wing guns", body.transform, 0, 0, 96, 80, "bomber_guns");
                    guns.enabled = false;
                    var shield = UiKit.Sprite("Ice shield", root, 17, -26, 112, 112, "fx_ice_shield");
                    foreach (var image in new[] { shadow, body, shield }) image.rectTransform.pivot = new Vector2(.5f, .5f);
                    shadow.rectTransform.anchoredPosition = new Vector2(73 + ShadowOffset.x, -30 + ShadowOffset.y);
                    body.rectTransform.anchoredPosition = shield.rectTransform.anchoredPosition = new Vector2(73, -30);
                    var labels = UiKit.Rect("Labels", root, 0, 0, 146, 88);
                    var group = labels.gameObject.AddComponent<CanvasGroup>(); group.blocksRaycasts = false;
                    var plate = UiKit.Framed("English word", labels, 0, 76, 146, 28, "ui_plate", 2);
                    UiKit.Fit(UiKit.Label(enemy.Entry.word, plate.transform, 4, -1, 138, 28, 19, UiKit.Cream, true, TextAnchor.MiddleCenter), 10, 19);
                    UiKit.Box("Lock track", labels, 13, 106, 120, 6, UiKit.Hex("1A1612"));
                    var fill = UiKit.Box("Lock progress", labels, 14, 107, 0, 4, UiKit.Coral);
                    var threat = UiKit.Label("", labels, -20, 112, 186, 16, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
                    var outline = threat.gameObject.AddComponent<Outline>(); outline.effectColor = new Color(.05f, .06f, .04f, .95f); outline.effectDistance = new Vector2(2, -2);
                    visual = new EnemyVisual { Root = root, Shield = shield, Body = body, Shadow = shadow, Guns = guns, LockFill = fill, Labels = group, Threat = threat, Phase = enemy.Id * .37f };
                    enemies.Add(enemy.Id, visual);
                }
                bool damaged = enemy.Environment == FlightEnvironment.Ice && enemy.Health == 1;
                string sprite = enemy.Departing ? Livery(enemy.Environment) + (enemy.DepartDirection < 0 ? "_bank_left" : "_bank_right") : Livery(enemy.Environment) + (damaged ? "_damaged" : "");
                visual.Body.sprite = PixelSprites.At(sprite, animationTime + visual.Phase);
                visual.Shield.gameObject.SetActive(enemy.Health > 1 && !enemy.Departing);
                if (enemy.Health > 1) visual.Shield.sprite = PixelSprites.At("fx_ice_shield", animationTime + visual.Phase);
                float scale = Mathf.Clamp(Mathf.Sqrt(40f / Mathf.Max(40, flight.Enemies.Count)), .55f, 1);
                visual.Root.localScale = new Vector3(scale, scale, 1);
                Place(visual.Root, enemy.X, enemy.Y, 73 * scale, 30 * scale);
                // Hatches open and the barrels creep out over the whole lock-on (fully out exactly when it fires),
                // then the muzzles flash while the burst leaves and the bomber breaks away.
                if (enemy.Phase == EnemyPhase.Locking)
                {
                    visual.Guns.enabled = true;
                    visual.Guns.sprite = PixelSprites.Get("bomber_guns", Mathf.Clamp(Mathf.FloorToInt(enemy.LockProgress * GunDeployFrames), 0, GunDeployFrames - 1));
                }
                else if (enemy.Departing && enemy.DepartSeconds < .32f) { visual.Guns.enabled = true; visual.Guns.sprite = PixelSprites.Get("bomber_guns", GunDeployFrames + (int)(animationTime * 24) % 2); }
                else visual.Guns.enabled = false;
                visual.Labels.alpha = enemy.Departing ? Mathf.Max(0, 1 - enemy.DepartSeconds * 4) : 1;
                visual.LockFill.rectTransform.sizeDelta = new Vector2(Mathf.Round(118 * enemy.LockProgress / 2) * 2, 4);
                visual.LockFill.enabled = enemy.Phase == EnemyPhase.Locking;
                visual.Threat.text = enemy.Phase == EnemyPhase.Locking ? "KHÓA MỤC TIÊU " + Mathf.Max(0, enemy.LockRemaining).ToString("0.0") + "s"
                    : enemy.Departing ? "" : enemy.RequiresPartOfSpeech ? "+ TỪ LOẠI" : enemy.Environment == FlightEnvironment.Ice ? "KHIÊN BĂNG" : "";
                bool warn = enemy.Phase == EnemyPhase.Locking && enemy.LockRemaining < 1.5f && animationTime % .24f < .12f;
                visual.Body.color = warn ? Color.Lerp(Color.white, UiKit.Coral, .75f) : Color.white;
                float target = 180;
                if (enemy.Phase == EnemyPhase.Locking)
                    target = Vector2.SignedAngle(Vector2.up, new Vector2((flight.PlayerX - enemy.X) * Width, -(ContinuousFlight.PlayerY - enemy.Y) * Height));
                else if (enemy.Departing) target = Vector2.SignedAngle(Vector2.up, new Vector2(enemy.VelocityX * Width, -enemy.VelocityY * Height));
                visual.Angle = Mathf.MoveTowardsAngle(visual.Angle, target, 240 * Time.unscaledDeltaTime);
                visual.Body.rectTransform.localEulerAngles = visual.Shadow.rectTransform.localEulerAngles = new Vector3(0, 0, visual.Angle);
                if (enemy.Departing) visual.Root.SetAsLastSibling();
            }
        }

        // Called on AircraftFire: muzzle flashes at both wing guns.
        public void EnemyFire(int id)
        {
            if (!enemies.TryGetValue(id, out var visual)) return;
            foreach (var gun in new[] { new Vector3(-13, 28), new Vector3(13, 28) })
            {
                var local = (Vector2)field.InverseTransformPoint(visual.Body.rectTransform.TransformPoint(gun));
                AddEffect("muzzle_flash", local.x - 16, -local.y - 16, 32, 32, rotation: visual.Angle + 180);
            }
        }

        private void SyncShots(ContinuousFlight flight)
        {
            foreach (int id in shots.Keys.Where(id => !flight.Shots.Any(s => s.Id == id && s.InFlight)).ToArray())
            { Object.Destroy(shots[id].gameObject); shots.Remove(id); }
            foreach (var shot in flight.Shots)
            {
                if (!shot.InFlight) continue;
                if (!shots.TryGetValue(shot.Id, out var image))
                {
                    image = UiKit.Sprite("Enemy tracer", field, 0, 0, 8, 30, "enemy_tracer");
                    image.preserveAspect = false; image.rectTransform.pivot = new Vector2(.5f, .5f);
                    shots.Add(shot.Id, image);
                }
                image.rectTransform.anchoredPosition = new Vector2(shot.X * Width, -shot.Y * Height);
                var direction = new Vector2(shot.VelocityX * Width, -shot.VelocityY * Height);
                if (direction.sqrMagnitude > .01f) image.rectTransform.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, direction));
                image.transform.SetAsLastSibling();
            }
        }

        private static Sprite CreateDamageFrame()
        {
            // Stepped (not smooth) falloff keeps the warning frame pixel-styled.
            var texture = new Texture2D(32, 32, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            for (int y = 0; y < 32; y++) for (int x = 0; x < 32; x++)
            {
                int edge = Mathf.Min(Mathf.Min(x, 31 - x), Mathf.Min(y, 31 - y));
                texture.SetPixel(x, y, new Color(1, 1, 1, edge == 0 ? 1 : edge == 1 ? .7f : edge <= 3 && (x + y) % 2 == 0 ? .45f : 0));
            }
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, 32, 32), new Vector2(.5f, .5f), 100, 0, SpriteMeshType.FullRect, new Vector4(6, 6, 6, 6));
        }
    }
}

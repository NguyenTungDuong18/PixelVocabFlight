using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class FlightBoardView
    {
        private static bool ContainsPointer(RectTransform rect)
        {
            var mouse = UnityEngine.InputSystem.Mouse.current;
            return mouse != null && rect && RectTransformUtility.RectangleContainsScreenPoint(rect, mouse.position.ReadValue(), null);
        }

        public void FlashMissile(int id)
        {
            if (missiles.TryGetValue(id, out var visual)) visual.Flash = .36f;
        }

        public void MarkWrongChoice(int id, int choice)
        {
            if (!missiles.TryGetValue(id, out var visual) || choice < 0 || choice > 3) return;
            visual.Wrong[choice] = true; visual.Shake[choice] = .36f;
        }

        private static float EaseOutBack(float t) { const float c = 1.9f; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }

        private MissileVisual CreateMissile(MissileState missile)
        {
            var marker = UiKit.Rect("Missile " + missile.Id, field, 0, 0, 188, 142);
            var body = UiKit.Sprite("Rocket", marker, 82, 7, 24, 72, "rocket");
            body.rectTransform.pivot = new Vector2(.5f, .5f); body.rectTransform.anchoredPosition = new Vector2(94, -43);
            var plateRoot = UiKit.Rect("Meaning", marker, 0, 0, 188, 142);
            var plateGroup = plateRoot.gameObject.AddComponent<CanvasGroup>(); plateGroup.blocksRaycasts = false;
            var plate = UiKit.Framed("Vietnamese on missile", plateRoot, 2, 90, 184, 46, "ui_plate", 2);
            UiKit.Fit(UiKit.Label(missile.Answer.meaning, plate.transform, 6, 0, 172, 46, 17, UiKit.Orange, true, TextAnchor.MiddleCenter), 10, 17);
            var feedback = UiKit.Box("Wrong answer red edges", marker, -3, -7, 194, 150, Color.clear);
            feedback.sprite = damageFrame; feedback.type = Image.Type.Sliced;
            var buttons = new Button[4];
            for (int i = 0; i < 4; i++)
            {
                int choice = i, id = missile.Id;
                // Four separate tags; each pops out of the rocket body and grows to full size.
                var button = UiKit.Button(missile.Choices[i].word, field, 0, 0, ChoiceWidth, ChoiceHeight, "cream", UiKit.Ink, () => game.ChooseMissileAnswer(id, choice));
                var rect = (RectTransform)button.transform; rect.pivot = new Vector2(.5f, .5f);
                var word = button.GetComponentInChildren<Text>();
                word.rectTransform.anchoredPosition = new Vector2(38, 1); word.rectTransform.sizeDelta = new Vector2(ChoiceWidth - 44, ChoiceHeight);
                UiKit.Fit(word, 10, 17);
                var key = UiKit.Framed("Key", rect, 6, 7, 26, 26, "ui_keycap", 2);
                UiKit.Label((i + 1).ToString(), key.transform, 0, -2, 26, 26, 14, UiKit.Ink, true, TextAnchor.MiddleCenter);
                button.gameObject.SetActive(false);
                buttons[i] = button;
            }
            var status = UiKit.Label("", field, 0, 0, 300, 20, 12, UiKit.Coral, true, TextAnchor.MiddleCenter);
            status.rectTransform.pivot = new Vector2(.5f, .5f);
            var outline = status.gameObject.AddComponent<Outline>(); outline.effectColor = new Color(.05f, .06f, .04f, .95f); outline.effectDistance = new Vector2(2, -2);
            return new MissileVisual { Marker = marker, Body = body, PlateGroup = plateGroup, Feedback = feedback, Status = status, Buttons = buttons };
        }

        private void SyncMissiles(ContinuousFlight flight, float delta)
        {
            foreach (int id in missiles.Keys.Where(id => !flight.Missiles.Any(e => e.Id == id)).ToArray())
            { DestroyMissile(missiles[id]); missiles.Remove(id); }
            // Choose which rocket shows its four choices: the hovered one, else the closest answerable rocket.
            var hovered = flight.Missiles.LastOrDefault(m => m.Answerable && missiles.TryGetValue(m.Id, out var v) && ContainsPointer(v.Marker));
            if (hovered != null) { hoveredMissile = hovered.Id; hoverGrace = .6f; }
            else if ((hoverGrace -= delta) <= 0) hoveredMissile = 0;
            var focus = flight.Missiles.FirstOrDefault(m => m.Id == hoveredMissile && m.Answerable)
                ?? flight.Missiles.Where(m => m.Answerable).OrderByDescending(m => m.Y).FirstOrDefault();
            // Keep the open set while the pointer is on one of its tags.
            if (focusedMissile != 0 && missiles.TryGetValue(focusedMissile, out var open) && open.Buttons.Any(b => b.gameObject.activeSelf && ContainsPointer((RectTransform)b.transform))
                && flight.Missiles.Any(m => m.Id == focusedMissile && m.Answerable)) focus = flight.Missiles.First(m => m.Id == focusedMissile);
            focusedMissile = focus?.Id ?? 0;
            foreach (var missile in flight.Missiles)
            {
                if (!missiles.TryGetValue(missile.Id, out var visual)) { visual = CreateMissile(missile); missiles.Add(missile.Id, visual); }
                visual.Age += delta;
                Place(visual.Marker, missile.X, missile.Y, 94, 43);
                visual.Flash = Mathf.Max(0, visual.Flash - delta);
                float flash = visual.Flash / .36f;
                float shakeX = Mathf.Sin(visual.Flash * 90) * 5 * flash;
                if (missile.Phase == MissilePhase.Locking) shakeX += Mathf.Round(Mathf.Sin(animationTime * 70) * 2);
                bool boost = missile.Phase == MissilePhase.Boost;
                visual.Body.sprite = PixelSprites.At(boost ? "rocket_boost" : missile.Phase == MissilePhase.Locking || missile.Failed ? "rocket_hot" : "rocket", visual.Age);
                visual.Body.rectTransform.sizeDelta = boost ? new Vector2(32, 112) : new Vector2(24, 72);
                visual.Body.rectTransform.pivot = boost ? new Vector2(.5f, 1 - 18f / 56) : new Vector2(.5f, .5f);
                visual.Body.rectTransform.anchoredPosition = new Vector2(94 + shakeX, -43);
                visual.Body.rectTransform.localEulerAngles = new Vector3(0, 0, Vector2.SignedAngle(Vector2.up, new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height)));
                visual.Body.color = flash > 0 ? Color.Lerp(Color.white, UiKit.Coral, flash * .6f) : Color.white;
                visual.Feedback.color = new Color(1, .12f, .08f, .85f * flash);
                visual.PlateGroup.alpha = boost ? Mathf.Max(0, visual.PlateGroup.alpha - delta * 5) : 1;
                visual.SmokeTimer += delta;
                if (visual.SmokeTimer >= (boost ? .03f : .09f))
                {
                    visual.SmokeTimer = 0;
                    var velocity = new Vector2(missile.VelocityX * Width, -missile.VelocityY * Height).normalized;
                    float back = boost ? 70 : 40, size = boost ? 22 : 16;
                    AddEffect("fx_smoke", missile.X * Width - velocity.x * back - size * .5f, missile.Y * Height + velocity.y * back - size * .5f, size, size, -velocity * 18);
                }
                visual.Marker.SetAsLastSibling();
                AnimateChoices(flight, missile, visual, delta);
            }
        }

        private void AnimateChoices(ContinuousFlight flight, MissileState missile, MissileVisual visual, float delta)
        {
            bool show = missile.Id == focusedMissile && missile.Answerable;
            visual.Open = Mathf.Clamp01(visual.Open + (show ? 1 : -1.6f) * delta / ChoiceOpenSeconds);
            var centre = new Vector2(missile.X * Width, missile.Y * Height);
            float cy = Mathf.Clamp(centre.y, 54, Height - 54);
            float[] columns = centre.x < 190 ? new[] { 100f, 262f } : centre.x > Width - 190 ? new[] { -262f, -100f } : new[] { -102f, 102f };
            for (int i = 0; i < 4; i++)
            {
                var button = visual.Buttons[i]; var rect = (RectTransform)button.transform;
                float local = Mathf.Clamp01((visual.Open - i * .08f) / .68f);
                bool active = local > .01f;
                if (button.gameObject.activeSelf != active) button.gameObject.SetActive(active);
                if (!active) continue;
                float eased = EaseOutBack(local);
                var slot = new Vector2(Mathf.Clamp(centre.x + columns[i % 2], ChoiceWidth * .5f + 4, Width - ChoiceWidth * .5f - 4), cy + (i < 2 ? -24 : 24));
                visual.Shake[i] = Mathf.Max(0, visual.Shake[i] - delta);
                var position = Vector2.LerpUnclamped(centre, slot, eased) + new Vector2(Mathf.Sin(visual.Shake[i] * 80) * 6 * visual.Shake[i] / .36f, 0);
                rect.anchoredPosition = new Vector2(Mathf.Round(position.x), -Mathf.Round(position.y));
                float scale = Mathf.Lerp(.12f, 1, Mathf.Clamp01(eased));
                rect.localScale = new Vector3(scale, scale, 1);
                button.interactable = missile.Answerable && !visual.Wrong[i];
                ((Image)button.targetGraphic).color = visual.Wrong[i] ? new Color(1, .55f, .5f, .75f) : Color.white;
            }
            visual.Status.gameObject.SetActive(visual.Open > .5f || missile.WrongAttempts > 0 || missile.Phase != MissilePhase.Cruise);
            visual.Status.rectTransform.anchoredPosition = new Vector2(Mathf.Clamp(centre.x, 150, Width - 150), -Mathf.Clamp(centre.y + (missile.Phase == MissilePhase.Boost ? -60 : 106), 12, Height - 12));
            visual.Status.text = missile.Phase == MissilePhase.Boost ? "TĂNG TỐC!" : missile.Phase == MissilePhase.Locking ? (missile.Failed ? "KHÓA MỤC TIÊU!" : "KHÓA MỤC TIÊU! CHỌN NGAY · SAI " + missile.WrongAttempts + "/3")
                : (flight.Driving ? "PHÍM 1-4 / BẤM Ô · " : "PHÍM 1-4 · ") + "SAI " + missile.WrongAttempts + "/3";
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed partial class BaseView
    {
        private void UpdatePrompt(BaseWorld state, bool dialogueOpen)
        {
            string text = dialogueOpen || TitleVisible ? null : state.PromptText;
            bool show = !string.IsNullOrEmpty(text);
            if (promptPlate.gameObject.activeSelf != show) promptPlate.gameObject.SetActive(show);
            if (!show) return;
            float ax, ay;
            if (state.NearestKind == InteractKind.Npc && state.Npc(state.NearestId) != null)
            {
                var npc = state.Npc(state.NearestId);
                ax = npc.X * tileSize; ay = npc.Y * tileSize - 100 * scale / 3;
            }
            else
            {
                // Story objects are found by their "story:<id>" tag (the placement id can differ, e.g. the desk).
                var p = state.NearestKind == InteractKind.Story ? map.FindTag(BaseWorld.StoryTagPrefix + state.NearestId) : map.Find(state.NearestId);
                if (p == null) { promptPlate.gameObject.SetActive(false); return; }
                var f = map.FootprintOf(p);
                ax = (f.x + f.w / 2f) * tileSize;
                ay = placementImages.TryGetValue(p.Id, out var image) && image ? -image.rectTransform.anchoredPosition.y + 18 : f.y * tileSize - 24;
            }
            promptLabel.text = text;
            float width = Mathf.Ceil(MeasureWidth(promptLabel, text)) + promptHeight;
            promptPlate.sizeDelta = new Vector2(width, promptHeight);
            promptLabel.rectTransform.sizeDelta = new Vector2(width, promptHeight);
            float left = Mathf.Clamp(ax - width / 2, 6, mapWidth - width - 6), top = Mathf.Clamp(ay - promptHeight - 8, 6, mapHeight - promptHeight - 12);
            promptPlate.anchoredPosition = new Vector2(Snap(left), -Snap(top));
        }

        private static float MeasureWidth(Text text, string value)
        {
            var settings = text.GetGenerationSettings(new Vector2(10000, 40));
            settings.horizontalOverflow = HorizontalWrapMode.Overflow; settings.resizeTextForBestFit = false;
            return text.cachedTextGeneratorForLayout.GetPreferredWidth(value, settings) / Mathf.Max(.01f, text.pixelsPerUnit);
        }

        // ---------------- HUD messages ----------------
        public void ShowZone(string name)
        {
            if (string.IsNullOrEmpty(name)) return;
            zoneLabel.text = name; zoneTimer = ZoneSeconds;
        }

        public void ShowHint(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            hintLabel.text = text; hintTimer = HintSeconds; hintGroup.alpha = 1;
        }

        public void ShowTitle() { titleCard.gameObject.SetActive(true); titleDismissing = false; titleAlpha = 1; titleGroup.alpha = 1; objectiveGroup.alpha = pilotGroup.alpha = .15f; }
        public void ClearHint() { hintTimer = 0; hintGroup.alpha = 0; }
    }
}

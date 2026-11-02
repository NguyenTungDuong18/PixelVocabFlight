# Player and carrier cutouts — 2026-11-02

Tool: built-in `image_gen.imagegen`, edit mode, `transparent_background: true`.

Source copies: `../UserSelected/maybayta.jpg` and `../UserSelected/Pixel-Art Aircraft Carrier 78.png`.
The original files remain unchanged. These are AI-prepared cutouts based on the supplied images, not a claim of pixel-identical extraction.

Prepared outputs: `UserPlayer.png` and `UserCarrier.png` in this folder.
Runtime copies: `Game/Assets/_Project/Art/Resources/Art/UserPlayer.png` and `UserCarrier.png`.

## Player prompt

Edit target: the supplied sprite sheet. Extract ONLY the green top-down fighter aircraft in the lower-left quadrant, with its nose pointing straight UP. Remove the white background and the other three aircraft. Deliver one isolated fully opaque green aircraft with a genuinely transparent alpha background. Preserve this selected aircraft's exact silhouette, pixel art style, dark outlines, green shades, blue cockpit and red details as closely as possible; no redesign, no added features, no shadow, no text. Centre it on a square canvas with a small clear margin, aircraft fills about 85% of height. This is a cutout for a Unity top-down player sprite. Do not include the red or blue side-view planes or the purple front-view plane.

## Carrier prompt

Edit target: the supplied top-down aircraft carrier marked 78. Remove ONLY the green background surrounding the ship, replacing it with true transparent alpha. Preserve the complete aircraft carrier exactly: its silhouette, grey hull, deck, yellow and white runway markings, both visible number 78 markings, parked jets, helicopter pad, superstructure, masts and small US flag. Keep the bow pointing straight UP and the stern down. Do not redesign, simplify, add objects, crop the ship, change markings or add shadows. Deliver the complete isolated ship centred on a portrait transparent canvas with a small clear margin, ship fills about 94% of image height. Intended as a Unity game sprite.

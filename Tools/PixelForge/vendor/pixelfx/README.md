# pixelfx (vendored)

Source: https://github.com/patch-gg/pixelfx, commit `a84159688af3ca37a4be05a0d422b94451b2e24e`, MIT (see `LICENSE`, `NOTICE.md`).

Copied as is: all of `src/core/`, and from `src/fx/` only the effects PixelForge renders plus each category's `_lib.js`:
`fire/{brazier,torch,campfire}`, `critters/{bird,butterfly}`, `spawn/poof`, `lightning/{spark-arc,tesla-coil}`,
`explosions/{barrel-explosion,dirt-explosion}`, `water/splash`, `status/burning`. `package.json` (`"type": "module"`)
is ours, so Node loads the `.js` files as ES modules (PixelForge `require()`s them, Node >= 22.12).

Used by `Tools/PixelForge/pfx.cjs`: `render()` turns an effect into sprite frames (`fx_fire_*`, `fx_bird`, …), and
the core `Painter` draws the game's own effects (`units/effects.cjs`, `units/rocket.cjs`, `characters/cycles.cjs`,
`world/nature.cjs`).

## Changed from upstream (marked `WORDWING:` in the code)

- `src/fx/lightning/tesla-coil.js`: new option `coil` (default `true`). `coil: false` skips the plinth shadow, the
  copper coil and the steel torus, leaving the arcs, corona, floor zaps and sparks (the game has its own coil model).
- `src/fx/status/burning.js`: new option `fireOnly` (default `false`). `fireOnly: true` skips everything painted on
  the character's own pixels (white flash, orange tint, scorch marks), leaving only flames, sparks, smoke and the
  floor glow. The stand-in body itself is never drawn by `createFx`.

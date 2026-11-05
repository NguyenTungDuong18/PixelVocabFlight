'use strict';
// Battlefield ground tiles (680x560, tile vertically) and the wildlife/vehicles that move over them.
// Every tile and actor also gets a "_blur" twin: during flight the ground is shown out of focus so
// the eye goes to the aircraft. The ocean keeps its own sharp animated water (OceanBackdrop.cs).
//
// Shared layout constants, mirrored in Game/.../Art/ScrollingTerrain.cs (keep in sync):
//   tile: 680 x 560 art px, shown at 2x
//   jungle river centre x(y) = 250 + 46 sin(2πy/H) + 22 sin(4πy/H + 1.3); road x 596..610
//   desert piste x 556..570;  ice railway x 588..600
const {
  TW, TH, jungleRiverX, iceRiverX, Wrap, crown, palm, hut, crater, blur
} = require('./terrain/common.cjs');
const { jungle } = require('./terrain/jungle.cjs');
const { desert } = require('./terrain/desert.cjs');
const { ice } = require('./terrain/ice.cjs');
const { PAD, ACTORS } = require('./terrain/actors.cjs');

function build(add) {
  const tiles = { jungle: jungle(), desert: desert(), ice: ice() };
  for (const [name, tile] of Object.entries(tiles)) {
    add('Terrain', 'terrain_' + name, [tile], { fps: 1 });
    add('Terrain', 'terrain_' + name + '_blur', [blur(tile, 2, true)], { fps: 1 });
  }
  for (const [name, [frames, fps]] of Object.entries(ACTORS)) {
    add('Wildlife', 'actor_' + name, frames, { fps, loop: name !== 'steam' });
    add('Wildlife', 'actor_' + name + '_blur', frames.map(f => blur(f, 2, false)), { fps, loop: name !== 'steam' });
  }
}

module.exports = { build, jungleRiverX, iceRiverX, TW, TH, PAD, Wrap, crown, palm, hut, crater };

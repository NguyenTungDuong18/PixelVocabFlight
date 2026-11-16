'use strict';
// The world of the title cinematic: cloud field (a periodic deck of cumulus over the undercast, far storm
// towers, smoke columns from the burning coast) and formation helpers.
const C = require('./core.cjs');
const { DECK_P } = require('./sky.cjs');
const { ih, clamp } = C;

// puff: [x, y, z, r, height 0..1, kind, seed]
function cumulus(out, cx, cy, r0, seed, kind = 0, z0 = 0) {
  const h = (i, k) => ih(i, k, seed, 301), top = r0 * 1.4;
  const push = (x, y, z, r) => out.push([x, y, z0 + z, r, clamp(.25 + .75 * (z + r * .6) / top), kind, seed * 3.17 + out.length * .61]);
  const nb = 3 + Math.floor(h(0, 0) * 3);
  for (let i = 0; i < nb; i++) { const a = h(i, 1) * C.TAU, d = r0 * .55 * Math.sqrt(h(i, 2)), r = r0 * (.62 + .38 * h(i, 3)); push(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .05, r); }
  const nm = 3 + Math.floor(h(0, 4) * 4);
  for (let i = 0; i < nm; i++) { const a = h(i, 5) * C.TAU, d = r0 * .5 * h(i, 6), r = r0 * (.42 + .3 * h(i, 7)); push(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r0 * (.4 + .3 * h(i, 8)), r); }
  const nt = 1 + Math.floor(h(0, 9) * 3);
  for (let i = 0; i < nt; i++) { const a = h(i, 10) * C.TAU, d = r0 * .28 * h(i, 11), r = r0 * (.26 + .2 * h(i, 12)); push(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r0 * (.8 + .3 * h(i, 13)), r); }
}
// A cumulonimbus: stacked rings, pinched waist, anvil flaring at the top.
function tower(out, cx, cy, baseR, height, seed, kind = 0) {
  const h = (i, k) => ih(i, k, seed, 311), levels = Math.max(5, Math.round(height / (baseR * .42)));
  for (let l = 0; l < levels; l++) {
    const v = l / (levels - 1), prof = v < .78 ? 1 - .5 * Math.sin(v / .78 * Math.PI * .9) * .8 : .62 + (v - .78) / .22 * .9;
    const ringR = baseR * prof * .62, n = Math.max(3, Math.round(5 * prof + 1));
    for (let i = 0; i < n; i++) {
      const a = (i + h(l, i) * .8) / n * C.TAU, d = ringR * (.45 + .6 * h(l * 7 + i, 2)), r = baseR * (.3 + .2 * h(l * 7 + i, 3)) * (.75 + .4 * prof);
      out.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, v * height + r * .2, r, clamp(.15 + .85 * v), kind, seed * 1.31 + l * 7 + i]);
    }
  }
}
// A smoke column leaning with the wind.
function column(out, cx, cy, r0, height, seed) {
  const n = Math.round(height / (r0 * .55));
  for (let i = 0; i < n; i++) {
    const v = i / (n - 1), r = r0 * (.6 + .9 * v) * (.8 + .4 * ih(i, 1, seed, 321));
    out.push([cx + v * v * height * .55 + (ih(i, 2, seed, 321) - .5) * r, cy + v * height * .12 + (ih(i, 3, seed, 321) - .5) * r, v * height, r, clamp(.3 + .7 * v), 2, seed + i]);
  }
}

// One period of the deck (y in [0, DECK_P)), x in [-14 km, 14 km], cumulus 70..260 m with a few big ones.
function deckPeriod() {
  const out = [], cell = 300, ny = DECK_P / cell;
  const bank = (ix, iy) => { const t = iy / ny, n = yy => C.noise2(ix / 4.2 + 5, yy / 3.1, 331); return n(iy) * (1 - t) + n(iy - ny) * t; };
  for (let ix = -46; ix < 46; ix++) for (let iy = 0; iy < ny; iy++) {
    const b = bank(ix, iy);                                          // cumulus gather in banks with open undercast between
    if (b < .5 || ih(ix, iy, 1, 333) > .35 + (b - .5) * 2.2) continue;
    const r0 = 110 + 330 * clamp((b - .5) * 3.3) * (.5 + .5 * ih(ix, iy, 3, 333));
    cumulus(out, (ix + ih(ix, iy, 4, 333)) * cell, (iy + ih(ix, iy, 5, 333)) * cell, r0, ix * 131 + iy * 17);
  }
  return out;
}
const PERIOD = deckPeriod();
// Deck puffs around y0, slid by off = [x, y] (y in whole or fractional periods).
function deck(off = [0, 0], y0 = 0, reach = 7) {
  const out = [], k0 = Math.floor((y0 - off[1]) / DECK_P);
  for (let k = k0 - reach; k <= k0 + reach; k++) for (const p of PERIOD) { const y = p[1] + k * DECK_P + off[1]; if (y >= y0 - 14400 && y < y0 + 14400) out.push([p[0] + off[0], y, p[2], p[3], p[4], p[5], p[6]]); }
  return out;
}
// Far scenery (never moves): storm towers ringing the horizon, smoke columns from the coast under the raid.
const FAR = (() => {
  const out = [];
  tower(out, 30000, -7000, 4600, 9500, 1, 1); tower(out, 27000, 11000, 3600, 7600, 2, 1); tower(out, 17000, 23000, 3800, 8800, 3, 3);
  tower(out, -4000, 31000, 4400, 9800, 4, 3); tower(out, -24000, 12000, 4200, 9000, 5, 3); tower(out, -21000, -17000, 3600, 7400, 6, 3);
  tower(out, 9000, -27000, 4000, 8600, 7, 1); tower(out, 40000, 26000, 5200, 10500, 8, 1); tower(out, -34000, 34000, 5000, 10000, 9, 3);
  tower(out, 14000, -9000, 1500, 3600, 10, 3); tower(out, -9000, 14000, 1700, 3900, 11, 3);
  column(out, 5200, 9000, 320, 2600, 21); column(out, 7400, 5200, 260, 2100, 22); column(out, 3000, 12800, 380, 3000, 23); column(out, 9800, 10400, 300, 2300, 24);
  return out;
})();

module.exports = { cumulus, tower, column, deck, FAR, DECK_P };

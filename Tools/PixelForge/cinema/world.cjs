'use strict';
// The world of the title cinematic: cloud field (a periodic deck of cumulus over the undercast, far storm
// towers; the smoke columns of the burning city are soft puffs, battle.cjs) and formation helpers.
const C = require('./core.cjs');
const { DECK_P, deckCov, portHoleE } = require('./sky.cjs');
const Gr = require('./ground.cjs');
const { ih, clamp, smooth } = C;

// puff: [x, y, z, r, height 0..1, kind, seed, base z]
// A cumulus cell (r0: half width): a flat base (puff[7], drawClouds clips there), 2-4 wide core spheres sunk into it, then
// lobes grown on the upper sides of what is already there, sizes from a power law (many small, a few big), so a cloud reads
// mass -> lobes -> curd (the fbm in drawClouds) instead of a heap of equal balls. Height 0.5-1.1 x its width, lopsided.
// tallIn (0..1, optional): how far it towers (default: by chance, bigger cells more); the base sits just above the deck.
function cumulus(out, cx, cy, r0, seed, kind = 0, z0 = 0, tallIn) {
  const h = (i, k) => ih(i, k, seed, 301), base = z0 + 15, tall = tallIn === undefined ? h(0, 0) * clamp(r0 / 300) : tallIn, top = r0 * (.7 + 1.9 * tall);
  const an = h(0, 1) * Math.PI, ca = Math.cos(an), sa = Math.sin(an), el = .5 + .7 * h(0, 2), S = [];
  const push = (x, y, z, r) => { S.push([x, y, z, r]); out.push([x, y, z, r, clamp(.15 + .85 * (z - base + r * .5) / top), kind, seed * 3.17 + out.length * .61, base]); };
  const nc = 2 + Math.floor(h(0, 3) * 2);
  for (let i = 0; i < nc; i++) {
    const u = (nc > 1 ? i / (nc - 1) - .5 : 0) * 2 * el, v = (h(i, 4) - .5) * .5, r = r0 * (.48 + .22 * h(i, 5)) * (1 - .25 * Math.abs(u));
    push(cx + (u * ca - v * sa) * r0 * .6, cy + (u * sa + v * ca) * r0 * .6, base + r * (-.3 + .45 * h(i, 6)), r);   // sunk: a flat lens, not a ball
  }
  // lobes: a squat cell grows mostly from its core; a tall one (congestus) keeps building on its newest turrets
  const nl = 2 + Math.round(r0 / 40 * (1 + 1.5 * tall));
  for (let i = 0, tries = 0; i < nl && tries < nl * 3; tries++) {
    const u = Math.pow(h(tries, 7), 1.6), q = S[Math.floor((h(tries, 12) < tall ? 1 - u * .999 : u) * S.length)];
    const az = h(tries, 8) * C.TAU, el2 = (.25 + .55 * h(tries, 9) + .2 * tall) * Math.PI / 2;
    const r = q[3] * (.36 + .44 * Math.pow(h(tries, 10), 1.6)), d = q[3] * (.55 + .25 * h(tries, 11));
    const x = q[0] + Math.cos(az) * Math.cos(el2) * d, y = q[1] + Math.sin(az) * Math.cos(el2) * d, z = q[2] + Math.sin(el2) * d;
    if (r < 10 || z + r > base + top || Math.hypot(x - cx, y - cy) > r0 * 1.15) continue;
    push(x, y, z, r); i++;
  }
}
// A cumulonimbus: stacked rings, pinched waist, anvil flaring at the top; then turrets of power-law sizes grown outward
// and upward from the core (crowded toward the crown), so the column reads as towers on towers, not a stack of equal balls.
// Cumulonimbus: a broad near-vertical trunk (no waist, no mushroom cap) that leans a little and widens slightly with height,
// flat floor in the low haze (base 0), a cauliflower crown of many small hard lobes, and on the tallest a thin flat-bottomed
// anvil spreading downwind. drawClouds merges the trunk lobes smoothly (fibrous column) and keeps creases only in the crown.
function tower(out, cx, cy, baseR, height, seed, kind = 0) {
  const h = (i, k) => ih(i, k, seed, 311), levels = Math.max(6, Math.round(height / (baseR * .36))), S = [];
  const push = (x, y, z, r, v, base = 0) => { S.push([x, y, z, r, v]); out.push([x, y, z, r, clamp(.15 + .85 * v), kind, seed * 1.31 + out.length * .37, base]); };
  const lx = (h(0, 30) - .5) * baseR * .5, ly = (h(0, 31) - .5) * baseR * .5;   // lean of the column over its height
  for (let l = 0; l < levels; l++) {
    const v = l / (levels - 1), prof = v < .8 ? .82 + .25 * v : 1.02 * Math.sqrt(1 - .8 * Math.pow((v - .8) / .2, 2));
    const ringR = baseR * prof * .6, n = Math.max(4, Math.round(5 * prof + 1)), ox = cx + lx * v, oy = cy + ly * v;
    for (let i = 0; i < n; i++) {
      const a = (i + h(l, i) * .8) / n * C.TAU, d = ringR * (.5 + .5 * h(l * 7 + i, 2)), r = baseR * (.3 + .14 * h(l * 7 + i, 3)) * (.8 + .3 * prof);
      push(ox + Math.cos(a) * d, oy + Math.sin(a) * d, v * height + r * .2, r, v);
    }
  }
  // crown: small lobes budding off the upper rings (parents strongly biased to the top), each smaller than its parent
  const nl = levels * 5;
  for (let i = 0; i < nl; i++) {
    const q = S[Math.floor(Math.pow(h(i, 20), .3) * S.length)], az = Math.atan2(q[1] - cy, q[0] - cx) + (h(i, 21) - .5) * 2.6, el = (.25 + .7 * h(i, 22)) * Math.PI / 2;
    const r = q[3] * (.2 + .32 * Math.pow(h(i, 23), 1.8)), d = q[3] * (.62 + .25 * h(i, 24));
    push(q[0] + Math.cos(az) * Math.cos(el) * d, q[1] + Math.sin(az) * Math.cos(el) * d, q[2] + Math.sin(el) * d, r, Math.min(1, q[4] + Math.sin(el) * d / height));
  }
  if (height < 10000) return;
  // anvil: a flat-bottomed sheet (the base clip leaves only the top half of each lobe) sheared off the top downwind
  const az = 2.4 + h(0, 40) * .6, zb = height * .97;
  for (let i = 0; i < 26; i++) {
    const u = h(i, 41), s = (.3 + 1.9 * u) * baseR, a = az + (h(i, 42) - .5) * (1.6 - .5 * u);
    push(cx + lx + Math.cos(a) * s, cy + ly + Math.sin(a) * s, zb + baseR * .04, baseR * (.3 - .1 * u) * (.8 + .3 * h(i, 43)), 1, zb);
  }
}
// Deck cumulus, x in [-14 km, 14 km], grown OUT of the deck as continuous masses: a smooth mass field (patches 1-3 km,
// swells of density over ~7 km) is sampled on a 300 m grid and every cell inside it gets an overlapping cumulus, so cells
// fuse into one lumpy sheet with dark creases between them. Toward the rim of a mass the cells shrink and flatten into low
// swells that sink into the deck (drawClouds fades their feet); deep inside some tower (congestus). Open deck or holes lie
// between the masses, never a regular grid of domes. Only where the deck is solid. Periods k0..k1 of DECK_P along y:
// loop (world false) every period is the same (the mass field is blended to tile in y); world shots hash the period in.
function massAt(x, y, world) {
  const n = yy => C.noise2(x / 1700 + 3, yy / 1400, 341) * .65 + C.noise2(x / 650, yy / 600, 342) * .35;
  let m;
  if (world) m = n(y);
  else { const v = y / DECK_P, t = v - Math.floor(v), ya = t * DECK_P; m = .5 + (n(ya) * (1 - t) + n(ya - DECK_P) * t - .5) / Math.hypot(1 - t, t); }   // the blend keeps its contrast
  return m * .75 + C.noise2(x / 7000 + 2, world ? y / 7000 : .5, 343) * .25;
}
function deckField(world, k0, k1) {
  const out = [], cell = 300, ny = DECK_P / cell;
  for (let k = k0; k <= k1; k++) {
    const kh = world ? k * 7919 : 0;
    for (let ix = -46; ix < 46; ix++) for (let iy = 0; iy < ny; iy++) {
      const j = iy + kh, x = (ix + .25 + .5 * ih(ix, j, 4, 333)) * cell, y = (iy + .25 + .5 * ih(ix, j, 5, 333)) * cell + k * DECK_P;
      const m = smooth((massAt(x, y, world) - .47) / .14) * smooth((deckCov(x, y, 30, world) - .45) / .25);
      if (m < .08) continue;
      const r0 = cell * (.45 + 1.2 * m) * (.8 + .4 * ih(ix, j, 3, 333)), tall = Math.pow(m, 1.5) * (ih(ix, j, 6, 333) < .3 ? .7 + .3 * ih(ix, j, 7, 333) : .35 * ih(ix, j, 7, 333));
      cumulus(out, x, y, r0, ix * 131 + iy * 17 + kh, 0, 0, tall);
    }
  }
  return out;
}
const PERIOD = deckField(false, 0, 0);
// shots 1-7 (nothing scrolls): the deck cumulus over the deck that never repeats, -14..14 km round y = 0
let WORLD = null;
const deckWorld = () => WORLD || (WORLD = deckField(true, -6, 5).filter(p => p[1] >= -14400 && p[1] < 14400));
// Deck puffs around y0, slid by off = [x, y] (y in whole or fractional periods). Only the menu loop scrolls this list:
// puffs between its resting camera (shots.cjs shot8, H0 + [8.6, 21.3, 2.2]) and the port (sky.portHoleE) melt away, so
// the window onto the port stays open while the deck slides; puffs leaving the far end of the window shrink out.
const EYE = [8.6, 21.3, 3002.2];
function deck(off = [0, 0], y0 = 0, reach = 7) {
  const out = [], k0 = Math.floor((y0 - off[1]) / DECK_P), rx = Gr.LOOP_PORT.rx * .7;
  for (let k = k0 - reach; k <= k0 + reach; k++) for (const p of PERIOD) {
    const x = p[0] + off[0], y = p[1] + k * DECK_P + off[1]; if (y < y0 - 14400 || y >= y0 + 14400) continue;
    const l = (Gr.ZG - EYE[2]) / (p[2] - EYE[2]), e = portHoleE(EYE[0] + (x - EYE[0]) * l, EYE[1] + (y - EYE[1]) * l);
    const s = smooth((e - .9 * p[3] * l / rx - .55) / .45) * smooth((y - y0 + 14400) / 2000);
    if (s > .12) out.push([x, y, p[2], p[3] * s, p[4], p[5], p[6], p[7]]);
  }
  return out;
}
// Far scenery (never moves): storm towers ringing the horizon.
const FAR = (() => {
  const out = [];
  tower(out, 30000, -7000, 4600, 9500, 1, 1); tower(out, 27000, 11000, 3600, 7600, 2, 1); tower(out, 17000, 23000, 3800, 8800, 3, 3);
  tower(out, -4000, 31000, 4400, 9800, 4, 3); tower(out, -24000, 12000, 4200, 9000, 5, 3); tower(out, -21000, -17000, 3600, 7400, 6, 3);
  tower(out, 9000, -27000, 4000, 8600, 7, 1); tower(out, 40000, 26000, 5200, 10500, 8, 1); tower(out, -34000, 34000, 5000, 10000, 9, 3);
  tower(out, 14000, -9000, 1500, 3600, 10, 3); tower(out, -9000, 14000, 1700, 3900, 11, 3);
  return out;
})();

module.exports = { cumulus, tower, deck, deckWorld, FAR, DECK_P };

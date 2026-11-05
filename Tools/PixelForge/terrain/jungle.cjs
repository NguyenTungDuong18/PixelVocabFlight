'use strict';
// Terrain: jungle tile.
const { PAL, hex, shift, hash, noise, tileFbm } = require('../lib.cjs');
const { ST, WD, GR, SN, WT } = PAL;
const { TW, TH, P, jungleRiverX, Wrap, crown, palm, hut, crater } = require('./common.cjs');

// ---------------- Jungle: rainforest canopy, muddy river, rice terraces, a village and a road ----------------
function jungle() {
  const c = new Wrap(TW, TH);
  c.fill((x, y) => {
    const n = tileFbm(x, y, TW, TH, 101, 3), m = tileFbm(x, y, TW, TH, 102, 10);
    let i = n > .6 ? 2 : n > .46 ? 1 : 0;
    if (m > .58) i++;
    return GR[i];
  });
  const riverW = y => 15 + 4 * P(y, 3, .7);
  const inRiver = (x, y, pad) => Math.abs(x - jungleRiverX(y)) < riverW(y) + pad;
  const paddyL = y => 440 + 7 * P(y, 2, .4) + 4 * P(y, 5), paddyR = y => 574 + 5 * P(y, 3, 1.1);
  const paddy = (x, y) => x > paddyL(y) - 3 && x < paddyR(y) + 2, road = x => x >= 590 && x <= 616;
  // Rice terraces: rows of irregular plots, flooded or green, with raised dikes.
  const PADDY = [hex('#6f9a8a'), hex('#86ad98'), hex('#7fa548'), hex('#93b856'), hex('#a9b85c'), hex('#5f8e3e')];
  for (let row = 0; row < 28; row++) {
    const y0 = row * 20; let x0 = 430;
    while (x0 < 584) {
      const w = 14 + Math.floor(hash(row, x0, 5) * 30), kind = Math.floor(hash(x0, row, 6) * PADDY.length);
      for (let y = y0 - 3; y < y0 + 23; y++) for (let x = x0; x < x0 + w; x++) {
        const top = y0 + Math.round(2 * Math.sin(x * .09 + row)), bottom = y0 + 20 + Math.round(2 * Math.sin(x * .09 + row + 1));
        if (y < top || y >= bottom || x < paddyL(y) || x > paddyR(y)) continue;
        const edgeY = y === top || y === bottom - 1, edgeX = x === x0;
        let col = PADDY[kind];
        if (kind < 2 && hash(x, y, 9) < .05) col = hex('#b8d2c2');
        if (kind >= 2 && (x + y) % 3 === 0) col = shift(col, -1) === col ? hex('#6b8f3b') : col;
        if (edgeY || edgeX) col = y === y0 ? hex('#a4ad6a') : hex('#5d6b3a');
        c.put(x, y, col);
      }
      x0 += w;
    }
  }
  // Village huts and palms on two islands of higher ground among the terraces.
  for (const vy of [70, 352]) {
    for (let yy = -36; yy <= 36; yy++) for (let xx = -50; xx <= 50; xx++) {
      const d = Math.hypot(xx / 46, yy / 34) + (noise((505 + xx) * .15, (vy + yy) * .15, 19) - .5) * .25;
      if (d < 1) c.put(505 + xx, vy + 22 + yy, d > .92 ? hex('#7a6a3e') : hash(xx, yy, 18) < .15 ? hex('#8a7448') : hex('#9d8656'));
    }
    for (let t = 0; t < 1; t += .004) c.put(505 + Math.cos(t * 9) * 30 * t, vy + 22 + t * 40, WD[2]);
    for (let k = 0; k < 7; k++) {
      const hx = 474 + Math.floor(hash(k, vy, 11) * 54), hy = vy + Math.floor(hash(k, vy, 12) * 34);
      hut(c, hx, hy, 12 + (k % 2) * 4, 9, [WD[1], SN[1], SN[2], SN[3]], WD[0]);
    }
    for (let k = 0; k < 6; k++) palm(c, 466 + Math.floor(hash(k, vy, 13) * 80), vy - 6 + Math.floor(hash(k, vy, 14) * 56), 6, k);
  }
  // Dirt road with ruts and puddles.
  for (let y = 0; y < TH; y++) for (let x = 590; x <= 616; x++) {
    const e = Math.abs(x - 603);
    if (e > 12 && hash(x, y, 21) > .5) continue;
    let col = e > 9 ? hex('#6d6a3a') : hash(x, y, 22) < .18 ? WD[2] : WD[3];
    if (e === 4 || e === 3) col = WD[1];
    c.put(x, y, col);
  }
  for (let k = 0; k < 6; k++) { const py = Math.floor(hash(k, 3, 23) * TH); c.ellipse(603 + (k % 2 ? 3 : -3), py, 3, 2, WT[3]); c.put(602, py - 1, WT[5]); }
  // River: depth bands, current streaks, sand banks and rocks.
  for (let y = 0; y < TH; y++) {
    const cx = jungleRiverX(y), w = riverW(y);
    for (let x = Math.floor(cx - w - 5); x <= cx + w + 5; x++) {
      const d = Math.abs(x + .5 - cx);
      if (d < w) {
        let col = d < w * .45 ? hex('#2c5552') : d < w * .8 ? hex('#3b6a5f') : hex('#5a8670');
        if (Math.sin(y * .35 + x * .9 + noise(x * .2, y * .2, 4) * 6) > .93) col = hex('#86ab96');
        c.put(x, y, col);
      } else if (d < w + 3.5 + noise(x * .3, y * .3, 5) * 2) c.put(x, y, d < w + 1.5 ? hex('#a89466') : hex('#8c7a4e'));
    }
  }
  for (let k = 0; k < 10; k++) {
    const ry = Math.floor(hash(k, 1, 25) * TH), rx = jungleRiverX(ry) + (hash(k, 2, 25) - .5) * 18;
    c.put(rx, ry, ST[3]); c.put(rx + 1, ry, ST[2]); c.put(rx, ry + 1, ST[2]); c.put(rx - 1, ry + 1, hex('#b8d2c2'));
  }
  // Canopy: crowns sorted by y so southern trees overlap northern ones.
  const TONES = [
    [GR[0], GR[2], GR[3], GR[5]], [GR[1], GR[2], GR[4], GR[5]],
    [hex('#1d3326'), hex('#2c4a35'), hex('#3f6646'), hex('#5c8a5c')],
    [hex('#2f3a14'), hex('#4b5a1e'), hex('#6c7c2c'), hex('#94a447')]
  ];
  const trees = [];
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(hash(k, 1, 31) * TW), y = Math.floor(hash(k, 2, 31) * TH), r = 3 + Math.pow(hash(k, 3, 31), 2) * 8;
    if (inRiver(x, y, r + 3) || paddy(x, y) || road(x)) continue;
    trees.push({ x, y, r, t: hash(k, 4, 31) < .55 ? 0 : hash(k, 5, 31) < .5 ? 1 : hash(k, 6, 31) < .6 ? 2 : 3, k });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    crown(c, t.x, t.y, t.r, TONES[t.t], 40 + t.k % 7);
    if (t.k % 37 === 0) for (let s = 0; s < 6; s++) c.put(t.x - 2 + hash(s, t.k, 1) * 5, t.y - 2 + hash(s, t.k, 2) * 5, s % 2 ? hex('#e07a8a') : hex('#f2b14a'));
  }
  // Bomb craters in the canopy and a burnt clearing beside the road.
  const SOIL = [WD[0], WD[1], WD[2]];
  for (const [x, y, r] of [[80, 120, 7], [96, 132, 5], [360, 60, 6], [140, 420, 8], [640, 260, 6], [380, 500, 5]]) crater(c, x, y, r, SOIL, hex('#5d4a2a'));
  return c;
}

module.exports = {
  jungle
};

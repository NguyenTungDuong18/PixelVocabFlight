'use strict';
// Terrain: ice tile.
const { PAL, hex, withAlpha, hash, noise, tileFbm } = require('../lib.cjs');
const { ST, WD, SM, SN, SW, IC } = PAL;
const { TW, TH, P, iceRiverX, Wrap, conifer, hut, crater } = require('./common.cjs');

// ---------------- Ice: snowfields, pine forests, frozen river, log village, railway and trenches ----------------
function ice() {
  const c = new Wrap(TW, TH);
  c.fill((x, y) => {
    const n = tileFbm(x, y, TW, TH, 301, 3), m = tileFbm(x, y, TW, TH, 302, 9);
    let i = n > .58 ? 3 : n > .42 ? 2 : 1;
    if (Math.sin(x * .07 - y * .28 + m * 5) > .975) i = Math.min(3, i + 1);
    if (m < .3 && i > 1) i--;
    return SW[i];
  });
  // Frozen river with snow drifts and cracks.
  for (let y = 0; y < TH; y++) {
    const cx = iceRiverX(y), w = 17 + 3 * P(y, 2);
    for (let x = Math.floor(cx - w - 4); x <= cx + w + 4; x++) {
      const d = Math.abs(x + .5 - cx);
      if (d < w) {
        let col = d < w * .6 ? IC[2] : IC[3];
        if (noise(x * .25, y * .12, 307) > .66) col = SW[2];
        c.put(x, y, col);
      } else if (d < w + 3) c.put(x, y, d < w + 1.5 ? SW[0] : SW[1]);
    }
  }
  for (let k = 0; k < 14; k++) {
    let y = hash(k, 1, 309) * TH, x = iceRiverX(y) + (hash(k, 2, 309) - .5) * 20;
    for (let s = 0; s < 14; s++) { c.put(x, y, IC[1]); x += hash(k, s, 310) < .5 ? 1 : -1; y += hash(s, k, 311) < .6 ? 1 : 0; if (Math.abs(x - iceRiverX(y)) > 15) break; }
  }
  // Frozen lake with an ice-fishing camp.
  c.ellipse(96, 300, 52, 32, SW[1]); c.ellipse(96, 300, 48, 29, IC[2]); c.ellipse(90, 296, 34, 18, IC[3]);
  for (const [hx, hy] of [[80, 300], [104, 292], [112, 312]]) { c.ellipse(hx, hy, 2, 1.6, IC[0]); c.put(hx - 2, hy - 2, WD[1]); }
  // Railway: snow-dusted ballast, sleepers and two rails.
  for (let y = 0; y < TH; y++) for (let x = 584; x <= 604; x++) {
    let col = Math.abs(x - 594) > 8 ? (hash(x, y, 321) < .5 ? SW[1] : ST[3]) : hash(x, y, 322) < .3 ? SW[2] : ST[3];
    if (y % 4 === 0 && x >= 588 && x <= 600) col = WD[1];
    if (x === 591 || x === 597) col = ST[4];
    if (Math.abs(x - 594) > 10) continue;
    c.put(x, y, col);
  }
  // Trenches zig-zagging across the snow, lined with sandbags.
  for (const base of [60, 300]) {
    let px = 300, py = base;
    for (let s = 0; s < 14; s++) {
      const nx = px + (s % 2 ? 14 : 16), ny = py + (s % 2 ? 9 : -7);
      for (const o of [-2, 2]) c.line(px, py + o, nx, ny + o, SN[1]);
      c.line(px, py, nx, ny, WD[0]); c.line(px, py + 1, nx, ny + 1, hex('#3a3328'));
      px = nx; py = ny;
    }
  }
  for (const [x, y, r] of [[330, 160, 6], [452, 250, 5], [250, 480, 7], [520, 40, 5]]) crater(c, x, y, r, [hex('#3a3328'), WD[1], hex('#6b6458')], SW[1]);
  // Log village: snow roofs with dark eaves, chimneys, fences and trodden paths.
  for (const vy of [140, 420]) {
    for (let t = 0; t < 1; t += .01) c.ellipse(470 + t * 118, vy + 18 + Math.sin(t * 6) * 4, 2, 1.5, SW[0]);
    for (let k = 0; k < 5; k++) {
      const hx = 444 + k * 24 + (k % 2) * 4, hy = vy + (k % 2 ? 20 : -4);
      for (let y = 0; y < 16; y++) { c.put(hx - 1, hy + y, WD[1]); c.put(hx + 20, hy + y, WD[0]); }
      hut(c, hx, hy, 20, 16, [SW[0], SW[2], SW[3], SW[3]], WD[0]);
      c.put(hx + 14, hy + 4, ST[0]); c.put(hx + 15, hy + 4, ST[0]); c.put(hx + 14, hy + 3, ST[1]);
      for (let s = 0; s < 9; s++) c.ellipse(hx + 15 + s * 1.3, hy + 2 - s * .7, 1 + s * .2, 1 + s * .15, withAlpha(SM[4], 110 - s * 11), true);
    }
    for (let x = 440; x < 560; x += 3) { c.put(x, vy + 44, WD[1]); if (x % 6 === 0) c.put(x, vy + 43, WD[0]); }
    c.rect(530, vy + 30, 8, 5, WD[2]); c.rect(530, vy + 30, 8, 1, SW[3]);
  }
  // Pine forests in noise-defined stands plus scattered single trees.
  const trees = [];
  for (let k = 0; k < 6000; k++) {
    const x = Math.floor(hash(k, 1, 331) * TW), y = Math.floor(hash(k, 2, 331) * TH);
    const dense = tileFbm(x, y, TW, TH, 333, 3) > .47;
    if (!dense && hash(k, 3, 331) > .04) continue;
    if (Math.abs(x - iceRiverX(y)) < 26 || (x > 576 && x < 612) || Math.hypot((x - 96) / 58, (y - 300) / 38) < 1 || (x > 436 && x < 572 && ((y > 120 && y < 200) || (y > 400 && y < 480)))) continue;
    trees.push({ x, y, r: 3.5 + hash(k, 4, 331) * 4.5, k });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) conifer(c, t.x, t.y, t.r, true, t.k % 9);
  return c;
}

module.exports = {
  ice
};

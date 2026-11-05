'use strict';
// Terrain: desert tile.
const { PAL, hex, withAlpha, hash, noise, tileFbm, dither } = require('../lib.cjs');
const { OL, CR, ST, RD, WD, SM, GR, SN, WT } = PAL;
const { TW, TH, TAU, P, Wrap, shade, clamp, palm, crater } = require('./common.cjs');

// ---------------- Desert: wind-carved dunes, rocky plateau, oases, a piste and wrecks ----------------
function desert() {
  const c = new Wrap(TW, TH);
  const h = (x, y) => {
    const n1 = tileFbm(x, y, TW, TH, 201, 2.4), n2 = tileFbm(x, y, TW, TH, 202, 4), n3 = tileFbm(x, y, TW, TH, 203, 6);
    return Math.sin(x * .03 + TAU * 3 * y / TH + 2.4 * n1) + .45 * Math.sin(x * .072 - TAU * 5 * y / TH + 1.8 * n2) + .25 * n3;
  };
  const H = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) H[y * TW + x] = h(x, y);
  const at = (x, y) => H[(((y % TH) + TH) % TH) * TW + clamp(x, 0, TW - 1)];
  c.fill((x, y) => {
    const s = at(x - 2, y - 2) - at(x + 2, y + 2), v = at(x, y);
    const t = clamp(2.3 + s * 7 + v * .35, 0, 4.49), base = Math.floor(t);
    let i = clamp(base + (dither(x, y, t - base) ? 1 : 0), 0, 4);
    if (Math.abs(s) < .06 && Math.sin(x * .9 + y * .55 + noise(x * .1, y * .1, 7) * 5) > .9) i = Math.max(0, i - 1);
    const rock = tileFbm(x, y, TW, TH, 207, 3);
    if (rock > .67) {
      const r = noise(x * .4, y * .4, 9);
      return r > .7 ? WD[3] : r > .45 ? hex('#8a6a42') : r > .25 ? WD[2] : WD[1];
    }
    return SN[i];
  });
  // Boulders on the plateau edges.
  for (let k = 0; k < 160; k++) {
    const x = Math.floor(hash(k, 1, 211) * TW), y = Math.floor(hash(k, 2, 211) * TH);
    if (tileFbm(x, y, TW, TH, 207, 3) < .64) continue;
    const r = 1.5 + hash(k, 3, 211) * 3;
    c.ellipse(x + 2, y + 2, r, r * .8, shade(110), true);
    c.ellipse(x, y, r, r * .8, WD[2]); c.ellipse(x - r * .3, y - r * .3, r * .5, r * .4, WD[4]);
  }
  // Scrub and camel-thorn bushes.
  for (let k = 0; k < 420; k++) {
    const x = Math.floor(hash(k, 4, 212) * TW), y = Math.floor(hash(k, 5, 212) * TH);
    c.paint(x + 1, y + 1, shade(90)); c.put(x, y, hash(k, 6, 212) < .5 ? OL[1] : OL[2]); if (k % 3 === 0) c.put(x + 1, y, OL[3]);
  }
  // Oases: pond, reeds, irrigated plots, palms and flat-roofed mud houses.
  for (const [ox, oy, s] of [[150, 150, 1], [90, 440, .7]]) {
    for (let k = 0; k < 9; k++) { const fx = ox - 50 * s + (k % 3) * 22 * s, fy = oy + 26 * s + Math.floor(k / 3) * 14 * s; c.rect(Math.floor(fx), Math.floor(fy), Math.floor(18 * s), Math.floor(11 * s), k % 2 ? hex('#7b8a3a') : hex('#94a347')); }
    c.ellipse(ox, oy, 34 * s, 22 * s, hex('#7b8a3a'));
    c.ellipse(ox, oy, 26 * s, 16 * s, GR[3]);
    c.ellipse(ox, oy, 20 * s, 12 * s, WT[3]); c.ellipse(ox - 3, oy - 2, 14 * s, 8 * s, WT[4]);
    for (let k = 0; k < 6; k++) c.put(ox - 8 * s + k * 3, oy - 4 * s + (k % 2), WT[5]);
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; palm(c, ox + Math.cos(a) * 30 * s, oy + Math.sin(a) * 20 * s, 7, k + ox); }
    for (let k = 0; k < 5; k++) {
      const hx = Math.floor(ox + 34 * s + (k % 3) * 15), hy = Math.floor(oy - 26 * s + Math.floor(k / 3) * 16);
      c.rect(hx + 4, hy + 4, 12, 10, shade(130), true);
      c.rect(hx, hy, 12, 10, SN[2]); c.rect(hx + 1, hy + 1, 10, 8, SN[4]); c.rect(hx + 1, hy + 1, 10, 1, CR[3]); c.rect(hx + 3, hy + 3, 4, 3, SN[1]);
      c.put(hx + 9, hy + 2, WD[1]);
    }
  }
  // Piste with tyre tracks and telegraph poles casting long shadows.
  for (let y = 0; y < TH; y++) for (let x = 552; x <= 574; x++) {
    const e = Math.abs(x - 563);
    if (e > 9 && hash(x, y, 221) > .45) continue;
    let col = e > 7 ? SN[2] : hash(x, y, 222) < .2 ? SN[1] : WD[3];
    if ((e === 3 || e === 5) && (y + x) % 5 !== 0) col = WD[2];
    c.put(x, y, col);
  }
  for (let y = 0; y < TH; y += 40) { c.line(580, y, 592, y + 6, shade(110), true); c.put(580, y, WD[0]); c.put(580, y - 1, WD[1]); }
  // Tank tracks looping across the dunes.
  for (let t = 0; t < 1; t += .0007) {
    const y = t * TH, x = 330 + 60 * P(y, 1, 2) + 30 * P(y, 3);
    for (const o of [-3, 3]) if (Math.floor(t * 2000) % 3) c.paint(x + o, y, withAlpha(SN[0], 120));
  }
  // Wrecks: a burnt-out tank, a truck, sandbagged gun pit and shell craters.
  const wreck = (x, y) => {
    for (let k = 0; k < 60; k++) { const a = hash(k, x, 1) * TAU, d = hash(k, y, 2) * 13; if (dither(x + k, y, .6)) c.paint(x + 7 + Math.cos(a) * d, y + 5 + Math.sin(a) * d * .7, withAlpha(SM[0], 140)); }
    c.rect(x + 2, y + 2, 15, 10, shade(140), true);
    c.rect(x, y, 15, 10, ST[1]); c.rect(x, y, 15, 2, ST[0]); c.rect(x, y + 8, 15, 2, ST[0]);
    c.rect(x + 3, y + 3, 7, 4, RD[1]); c.put(x + 5, y + 4, SM[1]); c.line(x + 10, y + 5, x + 18, y + 2, ST[0]);
  };
  wreck(470, 300); wreck(240, 40);
  c.rect(380, 470, 10, 16, shade(130), true); c.rect(378, 468, 10, 16, OL[1]); c.rect(379, 469, 8, 6, OL[2]); c.rect(379, 476, 8, 7, SM[1]);
  for (let a = 0; a < 18; a++) { const ang = a / 18 * TAU; c.ellipse(640 + Math.cos(ang) * 9, 400 + Math.sin(ang) * 9, 2.2, 1.6, a % 2 ? SN[3] : SN[1]); }
  c.ellipse(640, 400, 6, 6, SN[1]); c.line(640, 400, 646, 393, ST[0]);
  for (const [x, y, r] of [[300, 210, 6], [520, 120, 5], [420, 520, 7], [60, 300, 5]]) crater(c, x, y, r, [WD[1], WD[2], SN[1]], SN[3]);
  return c;
}

module.exports = {
  desert
};

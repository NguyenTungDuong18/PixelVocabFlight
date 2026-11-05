'use strict';
// UI: animated top-down title airbase and clouds.
const { PAL, K, shift, withAlpha, hash, fbm, tileFbm, dither, Canvas } = require('../lib.cjs');
const U = require('../units.cjs');
const { OL, CR, GD, ST, GL, RD, WD, FI, SM, GR, SN, SW } = PAL;

// ---------- title airbase (360x225, top-down, 4 frames) ----------
function airbase(frame) {
  const W = 360, H = 225, c = new Canvas(W, H);
  c.fill((x, y) => {
    const n = fbm(x * .06, y * .06, 21), m = fbm(x * .4, y * .4, 22);
    let i = n > .62 ? 4 : n > .48 ? 3 : n > .36 ? 2 : 1;
    if (x > 120 && x < 210 && ((x + y >> 3) & 1)) i = Math.min(5, i + (m > .5 ? 1 : 0));
    return m > .72 ? GR[i + 1 > 5 ? 5 : i + 1] : m < .2 ? GR[i - 1] : GR[i];
  });
  const shadow = [8, 18, 4, 105];
  const shade = (x, y, w, h) => c.rect(x + 3, y + 3, w, h, shadow, true);
  // Dirt road from the south-east corner to the apron.
  for (let t = 0; t <= 1; t += .002) {
    const x = 360 - t * 250, y = 225 - Math.sin(t * Math.PI * .5) * 70;
    for (let k = -3; k <= 3; k++) c.put(x, y + k, Math.abs(k) === 3 ? WD[1] : hash(Math.floor(x), Math.floor(y + k), 3) < .2 ? WD[1] : WD[2]);
  }
  // Concrete apron with expansion joints.
  for (let y = 92; y < 182; y++) for (let x = 36; x < 140; x++) c.put(x, y, (x % 13 === 0 || y % 13 === 0) ? ST[2] : hash(x, y, 7) < .08 ? ST[2] : ST[3]);
  // Runway: asphalt, edge lines, centre dashes, threshold bars, tyre marks.
  for (let y = 0; y < H; y++) for (let x = 140; x < 186; x++) {
    let col = hash(x, y, 2) < .1 ? ST[0] : hash(x, y, 5) < .06 ? ST[2] : ST[1];
    if (x === 142 || x === 183) col = CR[1];
    if ((x === 162 || x === 163) && y % 16 < 8) col = CR[2];
    if (y > 208 && y % 2 === 0 && x > 145 && x < 181 && (x - 146) % 5 < 3 && (y < 4 || y > 220 || y % 14 < 12)) col = CR[2];
    if (y > 186 && y < 206 && (x === 156 || x === 157 || x === 168 || x === 169) && hash(y, x, 1) < .6) col = ST[0];
    c.put(x, y, col);
  }
  for (let y = 4; y < H; y += 14) for (const x of [139, 186]) { const lit = (Math.floor(y / 14) + frame) % 4 === 0; c.put(x, y, lit ? FI[4] : GD[1]); if (lit) { c.paint(x - 1, y, withAlpha(FI[3], 120)); c.paint(x + 1, y, withAlpha(FI[3], 120)); } }
  // Taxi line from apron to runway centre.
  for (let x = 100; x < 162; x++) c.put(x, 150, GD[2]);
  // Two curved-roof hangars.
  const hangar = (hx, hy, w, h) => {
    shade(hx, hy, w, h);
    for (let y = hy; y < hy + h; y++) for (let x = hx; x < hx + w; x++) {
      const t = Math.abs((x - hx + .5) / w - .5) * 2, ring = (y - hy) % 3 === 0;
      let col = t < .25 ? ST[4] : t < .55 ? ST[3] : t < .82 ? ST[2] : ST[1];
      if (ring) col = shift(col, -1);
      c.put(x, y, col);
    }
    c.rect(hx + 3, hy + h - 2, w - 6, 2, SM[0]);
    for (let x = hx; x < hx + w; x++) { c.put(x, hy - 1, K); c.put(x, hy + h, K); }
    for (let y = hy; y < hy + h; y++) { c.put(hx - 1, y, K); c.put(hx + w, y, K); }
  };
  hangar(14, 44, 44, 40); hangar(68, 38, 50, 46);
  // Control tower with rotating beacon.
  shade(120, 100, 14, 14); c.rect(120, 100, 14, 14, CR[1]); c.rect(122, 102, 10, 10, GL[1]); c.rect(124, 104, 6, 6, CR[2]);
  c.put(126 + (frame % 2), 106 + (frame >> 1), frame % 2 ? RD[4] : FI[4]);
  // Parked fighters on the apron (same sprite as the player, at scene scale).
  const parked = U.fighterBody(1, 0);
  for (const [px, py] of [[44, 120], [80, 124]]) { c.blit(parked.silhouette([0, 0, 0, 80]), px + 4, py + 5); c.blit(parked, px, py); }
  // Fuel drums and a fuel truck.
  for (let k = 0; k < 6; k++) { const dx = 110 + (k % 3) * 5, dy = 160 + Math.floor(k / 3) * 5; c.ellipse(dx + 2, dy + 2, 2, 2, RD[2]); c.put(dx + 1, dy + 1, RD[4]); }
  shade(44, 160, 22, 9); c.rect(44, 160, 22, 9, OL[2]); c.rect(44, 160, 6, 9, OL[3]); c.rect(46, 161, 3, 3, GL[1]); c.rect(52, 161, 13, 7, RD[2]); c.rect(52, 161, 13, 1, RD[3]);
  // Tents, sandbagged AA pit, windsock and tree lines.
  for (const [tx, ty] of [[196, 60], [196, 84], [196, 108], [214, 72]]) {
    shade(tx, ty, 16, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) c.put(tx + x, ty + y, x < 8 ? OL[3] : OL[2]);
    c.line(tx + 8, ty, tx + 8, ty + 11, OL[1]); c.rect(tx + 6, ty + 11, 4, 1, SM[0]);
  }
  for (const [cx, cy] of [[26, 204], [218, 168]]) {
    for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2; c.ellipse(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8, 2, 1.6, a % 2 ? SN[3] : SN[2]); }
    c.ellipse(cx, cy, 5, 5, GR[1]); c.rect(cx - 1, cy - 1, 3, 3, ST[1]); c.line(cx, cy, cx + 5, cy - 6, ST[0]);
  }
  c.rect(200, 34, 1, 8, ST[3]);
  for (let s = 0; s < 8; s++) c.put(201 + s, 34 + Math.round(Math.sin(s * .7 + frame * 1.4) * .9), (s >> 1) % 2 ? CR[3] : FI[2]);
  const tree = (tx, ty, r) => {
    c.ellipse(tx + 3, ty + 3, r, r, shadow, true);
    c.ellipse(tx, ty, r, r, GR[1]); c.ellipse(tx - r * .2, ty - r * .2, r * .75, r * .75, GR[3]); c.ellipse(tx - r * .35, ty - r * .35, r * .35, r * .35, GR[5]);
  };
  for (let k = 0; k < 90; k++) {
    const tx = hash(k, 1, 31) * W, ty = hash(k, 2, 31) * H, r = 3 + hash(k, 3, 31) * 4;
    const clear = (tx > 6 && tx < 232 && ty > 30 && ty < 186) || (tx > 132 && tx < 194) || (ty > 190 && tx < 60);
    if (!clear) tree(tx, ty, r);
  }
  return c;
}
function clouds() {
  const W = 360, H = 225, c = new Canvas(W, H);
  return c.fill((x, y) => {
    const n = tileFbm(x, y, W, H, 41, 2.2);
    const s = tileFbm((x - 18 + W) % W, (y - 26 + H) % H, W, H, 41, 2.2);
    if (n > .67) return dither(x, y, (n - .67) * 8) ? withAlpha(n > .72 ? CR[3] : SW[3], 130) : withAlpha(SW[2], 55);
    if (s > .67 && dither(x, y, .5)) return [6, 14, 4, 55];
    return null;
  });
}

module.exports = {
  airbase, clouds
};

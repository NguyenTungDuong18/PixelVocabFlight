'use strict';
// Terrain: wildlife and ground vehicles (ACTORS) with blurred twins.
const { PAL, K, hex, ramp, hash, dither, Canvas } = require('../lib.cjs');
const { OL, CR, GD, ST, GL, RD, WD, SM, SN, SW } = PAL;

// ---------------- Actors (all face north; padded so the blurred twin fits the same frame) ----------------
const PAD = 6;
function actor(w, h, draw, frames = 4) {
  return Array.from({ length: frames }, (_, f) => { const c = new Canvas(w + PAD * 2, h + PAD * 2); draw(c, f, PAD, PAD); return c.outline(K); });
}
const EL = ramp('#3e3a37', '#5a5551', '#77716b', '#958e86', '#b4ada4');
const elephant = () => actor(18, 26, (c, f, X, Y) => {
  const step = [0, 1, 0, -1][f];
  for (const [lx, ly, s] of [[4, 11, 1], [13, 11, -1], [4, 20, -1], [13, 20, 1]]) c.ellipse(X + lx + .5, Y + ly + step * s, 1.8, 1.8, EL[0]);
  c.ellipse(X + 9, Y + 15, 6.2, 8.5, EL[2]);
  c.ellipse(X + 8, Y + 13, 3.5, 5, EL[3]);
  c.put(X + 9, Y + 24, EL[1]); c.put(X + 9 + step, Y + 25, EL[0]);
  const ear = [3.4, 4, 3.4, 2.8][f];
  c.ellipse(X + 9 - 4.2, Y + 7, ear, 3.6, EL[1]); c.ellipse(X + 9 + 4.2, Y + 7, ear, 3.6, EL[2]);
  c.ellipse(X + 9, Y + 6, 3.4, 3.2, EL[3]);
  c.put(X + 8, Y + 5, EL[4]);
  c.put(X + 7, Y + 3, CR[3]); c.put(X + 11, Y + 3, CR[3]);
  const sway = [0, 1, 0, -1][f];
  c.put(X + 9 + sway, Y + 2, EL[2]); c.put(X + 9 + sway, Y + 1, EL[2]); c.put(X + 9 + sway * 2, Y, EL[1]);
});
const buffalo = () => actor(12, 18, (c, f, X, Y) => {
  const B = [hex('#2a2420'), hex('#3b3530'), hex('#544b42'), hex('#6d6256')];
  c.ellipse(X + 6, Y + 11, 4.2, 6.5, B[1]); c.ellipse(X + 5, Y + 10, 2.4, 4, B[2]);
  const hy = f % 2 ? 3 : 2;
  c.ellipse(X + 6, Y + hy + 2, 2.4, 2.4, B[2]);
  for (let s = 0; s < 4; s++) { c.put(X + 3 - s, Y + hy + 1 - Math.floor(s / 2), CR[1]); c.put(X + 9 + s, Y + hy + 1 - Math.floor(s / 2), CR[1]); }
  c.put(X + 6, Y + 17, B[0]);
}, 2);
const egret = () => actor(13, 9, (c, f, X, Y) => {
  const span = [6, 5, 2, 5][f], lift = [0, 1, 2, 1][f];
  for (let s = 1; s <= span; s++) { c.put(X + 6 - s, Y + 3 + (s > 3 ? lift : 0), s === span ? CR[1] : CR[3]); c.put(X + 6 + s, Y + 3 + (s > 3 ? lift : 0), s === span ? CR[1] : CR[3]); c.put(X + 6 - s, Y + 4, CR[2]); c.put(X + 6 + s, Y + 4, CR[2]); }
  c.rect(X + 5, Y + 2, 3, 4, PAL.WHITE); c.put(X + 6, Y + 1, PAL.WHITE); c.put(X + 6, Y, GD[3]);
  c.put(X + 6, Y + 6, GD[2]); c.put(X + 6, Y + 7, GD[2]);
});
const sampan = () => actor(7, 20, (c, f, X, Y) => {
  for (let y = 0; y < 20; y++) { const w = y < 4 ? y * .8 : y > 16 ? (19 - y) * .9 : 3.2; for (let x = 0; x < 7; x++) if (Math.abs(x + .5 - 3.5) <= w) c.put(X + x, Y + y, Math.abs(x + .5 - 3.5) > w - 1 ? WD[1] : WD[3]); }
  for (let y = 7; y < 13; y++) for (let x = 1; x < 6; x++) c.put(X + x, Y + y, y % 2 ? SN[2] : SN[3]);
  c.put(X + 3, Y + 15, RD[2]); c.put(X + 3, Y + 14, CR[2]);
  const o = f % 2 ? 1 : -1; c.line(X + 3, Y + 16, X + 3 + o * 3, Y + 19, WD[0]);
}, 2);
const truck = livery => actor(10, 20, (c, f, X, Y) => {
  const T = livery === 'desert' ? [SN[1], SN[2], SN[3]] : livery === 'ice' ? [SW[0], SW[1], SW[2]] : [OL[1], OL[2], OL[3]];
  for (const wy of [4, 13, 17]) for (const wx of [0, 9]) { c.put(X + wx, Y + wy + (f % 2), K); c.put(X + wx, Y + wy + 1 - (f % 2), ST[0]); }
  c.rect(X + 1, Y + 1, 8, 6, T[2]); c.rect(X + 2, Y + 2, 6, 2, GL[1]); c.put(X + 2, Y + 2, GL[3]);
  c.rect(X + 1, Y + 7, 8, 12, T[1]); for (let y = 9; y < 19; y += 3) c.rect(X + 1, Y + y, 8, 1, T[0]);
  c.put(X + 2, Y, GD[3]); c.put(X + 7, Y, GD[3]);
}, 2);
const tank = livery => actor(14, 24, (c, f, X, Y) => {
  const T = livery === 'desert' ? [hex('#6d5631'), hex('#8c7041'), hex('#b08f57'), hex('#cdb07a')] : livery === 'ice' ? [SW[0], SW[1], SW[2], SW[3]] : [OL[1], OL[2], OL[3], OL[4]];
  for (let y = 4; y < 24; y++) for (const x of [0, 1, 12, 13]) c.put(X + x, Y + y, (y + f) % 3 === 0 ? ST[2] : ST[0]);
  c.rect(X + 2, Y + 5, 10, 18, T[1]); c.rect(X + 2, Y + 5, 10, 1, T[2]); c.rect(X + 3, Y + 19, 8, 3, T[0]);
  c.ellipse(X + 7, Y + 12, 4.2, 4.2, T[2]); c.ellipse(X + 6.4, Y + 11.4, 2, 2, T[3]);
  c.rect(X + 6, Y, 2, 9, T[0]); c.put(X + 6, Y, ST[0]); c.put(X + 7, Y, ST[0]);
  c.put(X + 9, Y + 13, ST[0]);
}, 2);
const camel = () => actor(10, 22, (c, f, X, Y) => {
  const C = [SN[0], SN[1], SN[2], SN[3], SN[4]];
  const step = [0, 1, 0, -1][f];
  for (const [lx, ly, s] of [[1, 9, 1], [8, 9, -1], [1, 17, -1], [8, 17, 1]]) c.put(X + lx, Y + ly + step * s, C[0]);
  c.ellipse(X + 5, Y + 14, 3.6, 6, C[2]); c.ellipse(X + 5, Y + 13, 2.4, 2.8, C[4]);
  c.rect(X + 4, Y + 3, 2, 6, C[2]); c.ellipse(X + 5, Y + 2.5, 1.8, 2.2, C[3]); c.put(X + 5, Y, C[1]);
  c.put(X + 5, Y + 20, C[1]);
  c.rect(X + 4, Y + 15, 3, 3, hex('#3b4a6b')); c.put(X + 5, Y + 15, CR[3]);
});
const vulture = () => actor(22, 10, (c, f, X, Y) => {
  const V = [hex('#211a14'), hex('#3a2c20'), hex('#56412e')];
  for (let s = 0; s <= 10; s++) {
    const dy = s > 7 ? (f ? 1 : 0) : 0;
    for (const side of [-1, 1]) { c.put(X + 11 + side * s - (side < 0 ? 1 : 0), Y + 3 + dy, s < 8 ? V[1] : V[0]); c.put(X + 11 + side * s - (side < 0 ? 1 : 0), Y + 4 + dy, V[0]); if (s > 8 && s % 2) c.put(X + 11 + side * s - (side < 0 ? 1 : 0), Y + 5 + dy, V[0]); }
  }
  c.rect(X + 10, Y + 2, 2, 6, V[2]); c.put(X + 10, Y + 1, CR[1]); c.put(X + 11, Y + 1, CR[1]); c.put(X + 10, Y + 8, V[0]); c.put(X + 11, Y + 8, V[0]);
}, 2);
const reindeer = () => actor(10, 18, (c, f, X, Y) => {
  const D = [hex('#3e2c1e'), hex('#5e4430'), hex('#7d5f44')];
  const st = [0, 1, 2, 1][f];
  for (const [lx, ly] of [[1, 8 - st], [8, 8 - st], [1, 15 + st], [8, 15 + st]]) c.put(X + lx, Y + ly, D[0]);
  c.ellipse(X + 5, Y + 11, 3.2, 5.5, D[1]); c.ellipse(X + 4.5, Y + 10, 1.6, 3, D[2]);
  c.ellipse(X + 5, Y + 15.5, 2, 1.4, CR[3]);
  c.rect(X + 4, Y + 3, 2, 4, D[1]); c.put(X + 4, Y + 2, D[2]); c.put(X + 5, Y + 2, D[2]);
  for (const s of [-1, 1]) { c.line(X + 5 + s, Y + 2, X + 5 + s * 4, Y - 1, CR[0]); c.put(X + 5 + s * 3, Y + 1, CR[0]); c.put(X + 5 + s * 2, Y - 1, CR[0]); }
});
const wolf = () => actor(6, 15, (c, f, X, Y) => {
  const W = [hex('#3d4246'), hex('#5f666b'), hex('#8a9196')];
  const st = [0, 1, 2, 1][f];
  for (const [lx, ly] of [[0, 4 - st % 2], [5, 4 - st % 2], [0, 10 + st % 2], [5, 10 + st % 2]]) c.put(X + lx, Y + ly, W[0]);
  c.ellipse(X + 3, Y + 7.5, 2.2, 4.5, W[1]); c.put(X + 3, Y + 6, W[2]);
  c.ellipse(X + 3, Y + 2.2, 1.6, 2, W[2]); c.put(X + 2, Y, W[1]); c.put(X + 4, Y, W[1]);
  c.put(X + 3 + (f % 2), Y + 13, W[1]); c.put(X + 3 + (f % 2), Y + 14, W[0]);
});
const crow = () => actor(10, 6, (c, f, X, Y) => {
  const span = [4, 3, 1, 3][f], lift = [0, 1, 1, 0][f];
  for (let s = 1; s <= span; s++) { c.put(X + 5 - s, Y + 2 + (s > 2 ? lift : 0), hex('#1d1f24')); c.put(X + 4 + s, Y + 2 + (s > 2 ? lift : 0), hex('#1d1f24')); }
  c.rect(X + 4, Y + 1, 2, 4, hex('#2a2d33')); c.put(X + 4, Y, hex('#4a4d55'));
});
const locomotive = () => actor(12, 36, (c, f, X, Y) => {
  c.rect(X + 1, Y + 2, 10, 22, ST[0]);
  for (let y = 3; y < 24; y++) { c.put(X + 2, Y + y, ST[1]); c.put(X + 3, Y + y, ST[2]); if (y % 6 === 0) c.rect(X + 1, Y + y, 10, 1, GD[1]); }
  c.rect(X + 4, Y + 4, 4, 3, ST[1]); c.ellipse(X + 6, Y + 5.5, 1.6, 1.6, K);
  c.rect(X, Y + 24, 12, 7, RD[1]); c.rect(X + 1, Y + 25, 10, 2, RD[2]); c.rect(X + 3, Y + 28, 6, 2, GL[1]);
  c.rect(X + 1, Y + 31, 10, 5, ST[1]); c.rect(X + 2, Y + 32, 8, 3, SM[0]);
  c.rect(X + 1, Y, 10, 2, RD[2]);
}, 1);
const wagon = () => actor(12, 26, (c, f, X, Y) => {
  c.rect(X, Y, 12, 26, WD[1]); for (let y = 2; y < 26; y += 4) c.rect(X, Y + y, 12, 1, WD[0]);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 12; x++) if (hash(x, y, 77) < .55 && (x + y) % 2) c.put(X + x, Y + y, SW[3]);
}, 1);
const steam = () => Array.from({ length: 5 }, (_, f) => {
  const c = new Canvas(16 + PAD * 2, 16 + PAD * 2), r = 2.5 + f * 1.4, d = [1, .9, .7, .45, .25][f];
  return c.fill((x, y) => Math.hypot(x + .5 - 14, y + .5 - 14) <= r && dither(x, y, d) ? (x + y < 28 ? SM[5] : SM[4]) : null);
});

const ACTORS = {
  elephant: [elephant(), 6], buffalo: [buffalo(), 2], egret: [egret(), 10], sampan: [sampan(), 3],
  truck_jungle: [truck('jungle'), 8], tank_desert: [tank('desert'), 8], truck_desert: [truck('desert'), 8],
  camel: [camel(), 5], vulture: [vulture(), 3], reindeer: [reindeer(), 10], wolf: [wolf(), 10], crow: [crow(), 12],
  locomotive: [locomotive(), 1], wagon: [wagon(), 1], steam: [steam(), 6]
};

module.exports = {
  PAD, ACTORS
};

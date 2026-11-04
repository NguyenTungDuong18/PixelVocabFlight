'use strict';
// Battlefield ground tiles (680x560, tile vertically) and the wildlife/vehicles that move over them.
// Every tile and actor also gets a "_blur" twin: during flight the ground is shown out of focus so
// the eye goes to the aircraft. The ocean keeps its own sharp animated water (OceanBackdrop.cs).
//
// Shared layout constants, mirrored in Game/.../Art/ScrollingTerrain.cs (keep in sync):
//   tile: 680 x 560 art px, shown at 2x
//   jungle river centre x(y) = 250 + 46 sin(2πy/H) + 22 sin(4πy/H + 1.3); road x 596..610
//   desert piste x 556..570;  ice railway x 588..600
const { PAL, K, hex, ramp, shift, withAlpha, hash, noise, tileFbm, dither, Canvas } = require('./lib.cjs');
const { OL, CR, GD, ST, GL, RD, WD, SM, GR, SN, SW, IC, WT } = PAL;

const TW = 680, TH = 560;
const TAU = Math.PI * 2;
const P = (y, k = 1, phase = 0) => Math.sin(TAU * k * y / TH + phase);
const jungleRiverX = y => 250 + 46 * P(y) + 22 * P(y, 2, 1.3);
const iceRiverX = y => 190 + 58 * P(y, 1, .5) + 16 * P(y, 3, 2.1);

// Canvas whose y axis wraps, so features drawn across the top/bottom edge tile seamlessly.
class Wrap extends Canvas {
  wy(y) { y = Math.floor(y); return ((y % this.h) + this.h) % this.h; }
  get(x, y) { return super.get(x, this.wy(y)); }
  put(x, y, c) { super.put(x, this.wy(y), c); }
  paint(x, y, c) { super.paint(x, this.wy(y), c); }
}

const shade = a => [10, 18, 12, a];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Rounded crown lit from the north-west; lumpy edge from value noise.
function crown(c, x, y, r, tones, seed, shadowA = 110) {
  c.ellipse(x + r * .5, y + r * .65, r * 1.02, r * .92, shade(shadowA), true);
  const R = Math.ceil(r + 2);
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const d = Math.hypot(xx + .5, yy + .5) / r;
    const n = noise((x + xx) * .45, (y + yy) * .45, seed);
    if (d > .78 + n * .38) continue;
    const l = -((xx + .5) * .62 + (yy + .5) * .78) / r + (1 - d) * .35;
    let i = l > .55 ? 3 : l > .12 ? 2 : l > -.35 ? 1 : 0;
    if (hash(x + xx, y + yy, seed) < .14) i = Math.max(0, i - 1);
    c.put(x + xx, y + yy, tones[Math.min(i, tones.length - 1)]);
  }
}
// Top-down conifer: eight-point star with snow on the lit side and a long low-sun shadow.
function conifer(c, x, y, r, snowy, seed) {
  for (let s = 1; s <= r * 1.6; s++) c.ellipse(x + s * .55, y + s * .45, r * .55, r * .5, [40, 60, 80, 22], true);
  const rot = hash(x, y, seed) * 3;
  const R = Math.ceil(r + 1);
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const a = Math.atan2(yy + .5, xx + .5), d = Math.hypot(xx + .5, yy + .5);
    const reach = r * (.55 + .45 * Math.pow(Math.abs(Math.cos(a * 4 + rot)), .8));
    if (d > reach) continue;
    const l = -((xx + .5) * .6 + (yy + .5) * .8) / r;
    let col = l > .25 ? GR[3] : l > -.2 ? GR[2] : GR[1];
    if (d < 1.2) col = GR[0];
    if (snowy && l > -.1 && hash(x + xx, y + yy, seed + 5) < .55 + l * .4) col = l > .35 ? SW[3] : SW[2];
    c.put(x + xx, y + yy, col);
  }
}
function palm(c, x, y, r, seed) {
  c.line(x + 2, y + 2, x + r + 3, y + r + 4, shade(80), true);
  for (let f = 0; f < 7; f++) {
    const a = f / 7 * TAU + hash(f, x, seed) * .5;
    for (let s = 1; s <= r; s++) {
      const bend = Math.sin(s / r * 1.6) * 1.2;
      const px = x + Math.cos(a) * s - Math.sin(a) * bend, py = y + Math.sin(a) * s + Math.cos(a) * bend;
      c.paint(px + 3, py + 3, shade(60));
      c.put(px, py, s < r * .4 ? OL[2] : (f + s) % 3 ? OL[3] : OL[4]);
      if (s > 2 && s < r - 1 && dither(Math.floor(px), Math.floor(py), .5)) c.put(px + Math.sin(a), py - Math.cos(a), GR[3]);
    }
  }
  c.put(x, y, WD[2]); c.put(x + 1, y, WD[1]);
}
// Gabled roof seen from above: lit northern slope, shaded southern slope, darker eaves.
function hut(c, x, y, w, h, tones, eave) {
  c.rect(x + 3, y + 3, w, h, shade(120), true);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    let col = yy < h / 2 ? tones[2] : tones[1];
    if (yy === Math.floor(h / 2) || yy === Math.floor(h / 2) - 1) col = tones[3];
    if ((xx + yy * 3) % 4 === 0 && hash(x + xx, y + yy, 3) < .5) col = shift(col, -1);
    if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) col = eave;
    c.put(x + xx, y + yy, col);
  }
}
function crater(c, x, y, r, soil, rim) {
  c.ellipse(x, y, r + 2, r + 1.6, withAlpha(rim, 200), true);
  c.ellipse(x, y, r, r * .9, soil[1]);
  c.ellipse(x + .6, y + .7, r * .7, r * .6, soil[0]);
  c.ellipse(x - r * .3, y - r * .35, r * .35, r * .3, soil[2]);
  for (let k = 0; k < 10; k++) { const a = hash(k, x, 7) * TAU, d = r + 2 + hash(k, y, 8) * 4; c.put(x + Math.cos(a) * d, y + Math.sin(a) * d, soil[0]); }
}

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

// ---------------- Separable blur (premultiplied, three box passes ~ Gaussian) ----------------
function blur(src, radius, wrapY, grade = { mul: .86, desat: .15 }) {
  const w = src.w, h = src.h, n = w * h;
  let ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { const p = src.px[i]; if (!p) continue; const a = p[3] / 255; ch[0][i] = p[0] * a; ch[1][i] = p[1] * a; ch[2][i] = p[2] * a; ch[3][i] = a; }
  const pass = (data, horizontal) => {
    const out = new Float32Array(n), len = horizontal ? w : h, lines = horizontal ? h : w, k = 2 * radius + 1;
    for (let l = 0; l < lines; l++) for (let i = 0; i < len; i++) {
      let s = 0;
      for (let o = -radius; o <= radius; o++) {
        let j = i + o;
        if (horizontal) { if (j < 0 || j >= len) continue; s += data[l * w + j]; }
        else { if (wrapY) j = ((j % len) + len) % len; else if (j < 0 || j >= len) continue; s += data[j * w + l]; }
      }
      out[horizontal ? l * w + i : i * w + l] = s / k;
    }
    return out;
  };
  for (let p = 0; p < 3; p++) ch = ch.map(d => pass(pass(d, true), false));
  const out = new Canvas(w, h);
  for (let i = 0; i < n; i++) {
    const a = ch[3][i]; if (a < .004) continue;
    let r = ch[0][i] / a, g = ch[1][i] / a, b = ch[2][i] / a;
    const l = r * .3 + g * .59 + b * .11;
    r = (r + (l - r) * grade.desat) * grade.mul; g = (g + (l - g) * grade.desat) * grade.mul; b = (b + (l - b) * grade.desat) * grade.mul;
    out.px[i] = [Math.round(clamp(r, 0, 255)), Math.round(clamp(g, 0, 255)), Math.round(clamp(b, 0, 255)), Math.round(a * 255)];
  }
  return out;
}

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

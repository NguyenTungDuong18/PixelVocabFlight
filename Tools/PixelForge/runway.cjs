'use strict';
// Take-off strip for the title-screen camera (360x240 art px, shown at 4x like title_airbase).
// title_runway_edge sits directly above the airbase: perimeter fence, revetments and tents give
// way to the forest edge. title_runway_jungle repeats above it: the runway cut through jungle.
// Runway geometry matches ui.cjs airbase(): asphalt x 140..185, centre dashes every 16 rows.
const { PAL, K, hex, withAlpha, hash, fbm, noise, tileFbm, dither } = require('./lib.cjs');
const T = require('./terrain.cjs');
const { OL, CR, GD, ST, RD, WD, SM, GR, SN, WT, FI } = PAL;

const W = 360, H = 240, RX0 = 140, RX1 = 186, SHOULDER = 20;
const mod = (a, n) => ((a % n) + n) % n;
const shade = a => [8, 18, 4, a];
const CANOPY = [GR[0], GR[1], GR[2], GR[3]];
const EMERGENT = [GR[1], GR[2], GR[3], GR[4]];
const SUNLIT = [GR[2], GR[3], GR[4], GR[5]];

// Runway, shoulders and edge lights. gy0 is the global row of tile row 0 (airbase row 0 = 0, upwards negative).
function strip(c, gy0, { culvertY = -1, shoulderTo = H } = {}) {
  for (let y = 0; y < H; y++) {
    const gy = gy0 + y;
    // Mown shoulders with stripes, drainage ditches on the outer edge.
    for (let x = RX0 - SHOULDER; x < RX1 + SHOULDER; x++) {
      if (x >= RX0 && x < RX1) continue;
      // Inside the base the shoulders blend into the mown airfield grass (fence line = shoulderTo).
      if (y >= shoulderTo + Math.floor(hash(x, 0, 44) * 4)) continue;
      const outer = x < RX0 ? x - (RX0 - SHOULDER) : RX1 + SHOULDER - 1 - x;
      let col = (gy >> 3) & 1 ? GR[3] : GR[2];
      if (hash(x, gy, 41) < .12) col = GR[4];
      if (outer <= 1) col = outer === 0 ? GR[0] : GR[1];
      else if (outer === 3) col = hash(x, gy, 42) < .5 ? WT[1] : GR[0];
      c.put(x, y, col);
    }
    for (let x = RX0; x < RX1; x++) {
      let col = hash(x, gy, 2) < .1 ? ST[0] : hash(x, gy, 5) < .06 ? ST[2] : ST[1];
      // Repaired slabs and oil stains.
      if (noise(x * .09, gy * .04, 77) > .7) col = hash(x, gy, 6) < .3 ? ST[2] : hex('#434c51');
      if (noise(x * .3, gy * .3, 78) > .82) col = ST[0];
      if (x === 142 || x === 183) col = CR[1];
      if ((x === 162 || x === 163) && mod(gy, 16) < 8) col = CR[2];
      // Tyre marks on the take-off roll.
      if ((x >= 154 && x <= 158 || x >= 167 && x <= 171) && noise(x * .7, gy * .03, 79) > .62) col = ST[0];
      c.put(x, y, col);
    }
    if (mod(gy, 16) === 4) for (const x of [139, 186]) {
      const lit = hash(0, Math.floor(gy / 16), 43) < .35;
      c.put(x, y, lit ? FI[4] : GD[1]);
      if (lit) { c.paint(x - 1, y, withAlpha(FI[3], 110)); c.paint(x + 1, y, withAlpha(FI[3], 110)); }
    }
    // Distance-to-go boards every 128 rows on the left shoulder.
    if (mod(gy, 128) === 40) {
      const bx = RX0 - 12;
      c.rect(bx + 1, y + 1, 7, 5, shade(110), true); c.rect(bx, y, 7, 5, K); c.rect(bx + 1, y + 1, 5, 3, CR[3]);
      const n = mod(Math.floor(-gy / 128), 9) + 1;
      for (let k = 0; k < n % 4 + 1; k++) c.put(bx + 2 + k, y + 2, K);
    }
  }
  if (culvertY >= 0) for (const x of [RX0 - SHOULDER, RX1 + SHOULDER - 4]) {
    c.rect(x, culvertY - 3, 4, 7, ST[2]); c.rect(x, culvertY - 3, 4, 1, ST[3]); c.rect(x + 1, culvertY - 1, 2, 3, K);
  }
}

// ---------- jungle runway (seamless vertically) ----------
function jungleTile() {
  const c = new T.Wrap(W, H);
  c.fill((x, y) => {
    const n = tileFbm(x, y, W, H, 301, 3), m = tileFbm(x, y, W, H, 302, 9);
    return GR[(n > .58 ? 1 : 0) + (m > .6 ? 1 : 0)];
  });
  // A stream winds under the runway through a culvert.
  const streamY = x => 150 + 9 * Math.sin(x * .035) + 4 * Math.sin(x * .11 + 1);
  for (let x = 0; x < W; x++) {
    const sy = streamY(x);
    for (let d = -4; d <= 4; d++) {
      const col = Math.abs(d) >= 4 ? SN[0] : Math.abs(d) === 3 ? WT[1] : hash(x, d, 51) < .1 ? WT[4] : WT[2];
      c.put(x, sy + d, col);
    }
  }
  const corridor = (x, r) => x + r > RX0 - SHOULDER - 6 && x - r < RX1 + SHOULDER + 6;
  // Dense canopy, darker understorey first, then sunlit crowns and a few emergent giants.
  for (let k = 0; k < 520; k++) {
    const x = hash(k, 1, 61) * W, y = hash(k, 2, 61) * H, r = 3 + hash(k, 3, 61) * 4;
    if (corridor(x, r) || Math.abs(y - streamY(x)) < 3) continue;
    T.crown(c, Math.floor(x), Math.floor(y), r, CANOPY, k, 120);
  }
  for (let k = 0; k < 260; k++) {
    const x = hash(k, 4, 61) * W, y = hash(k, 5, 61) * H, r = 3.5 + hash(k, 6, 61) * 4;
    if (corridor(x, r) || Math.abs(y - streamY(x)) < 5) continue;
    T.crown(c, Math.floor(x), Math.floor(y), r, hash(k, 7, 61) < .3 ? SUNLIT : EMERGENT, k + 900, 110);
  }
  for (let k = 0; k < 9; k++) {
    const left = k % 2 === 0, x = left ? 20 + hash(k, 8, 61) * 80 : 230 + hash(k, 8, 61) * 110, y = hash(k, 9, 61) * H;
    T.crown(c, Math.floor(x), Math.floor(y), 9 + hash(k, 10, 61) * 3, SUNLIT, k + 1500, 140);
  }
  // Palms leaning over the forest edge.
  for (let k = 0; k < 8; k++) {
    const x = k % 2 ? RX1 + SHOULDER + 5 : RX0 - SHOULDER - 6, y = 12 + k * 29 + hash(k, 11, 61) * 10;
    T.palm(c, x, y, 6, k);
  }
  strip(c, 0, { culvertY: Math.round(streamY(RX0)) });
  return c;
}

// ---------- airbase edge -> forest (bottom row joins title_airbase row 0) ----------
function airbaseGrass(x, gy) {
  const n = fbm(x * .06, gy * .06, 21), m = fbm(x * .4, gy * .4, 22);
  let i = n > .62 ? 4 : n > .48 ? 3 : n > .36 ? 2 : 1;
  if (x > 120 && x < 210 && ((x + gy >> 3) & 1)) i = Math.min(5, i + (m > .5 ? 1 : 0));
  return m > .72 ? GR[Math.min(5, i + 1)] : m < .2 ? GR[i - 1] : GR[i];
}
function sandbagRing(c, cx, cy, rx, ry) {
  for (let a = 0; a < 22; a++) {
    const ang = a / 22 * Math.PI * 2;
    c.ellipse(cx + Math.cos(ang) * rx + 1, cy + Math.sin(ang) * ry + 1, 2, 1.6, shade(90), true);
    c.ellipse(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, 2, 1.6, a % 2 ? SN[3] : SN[2]);
  }
}
function revetment(c, x, y, w, h) {
  // U-shaped sandbag wall open towards the runway (east).
  for (let i = 0; i <= w; i += 3) for (const yy of [y, y + h]) { c.ellipse(x + i + 1, yy + 1, 2, 1.5, shade(90), true); c.ellipse(x + i, yy, 2, 1.5, (i >> 1) % 2 ? SN[3] : SN[2]); }
  for (let j = 0; j <= h; j += 3) { c.ellipse(x + 1, y + j + 1, 1.5, 2, shade(90), true); c.ellipse(x, y + j, 1.5, 2, (j >> 1) % 2 ? SN[3] : SN[2]); }
}
function truck(c, x, y) {
  c.rect(x + 3, y + 3, 9, 20, shade(110), true);
  c.rect(x, y, 9, 20, K); c.rect(x + 1, y + 1, 7, 5, OL[3]); c.rect(x + 2, y + 2, 5, 2, hex('#7e9aa2'));
  c.rect(x + 1, y + 7, 7, 12, OL[2]); for (let yy = y + 8; yy < y + 19; yy += 3) c.rect(x + 1, yy, 7, 1, OL[1]);
}
function tent(c, x, y) {
  c.rect(x + 3, y + 3, 16, 12, shade(110), true);
  for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 16; xx++) c.put(x + xx, y + yy, xx < 8 ? OL[3] : OL[2]);
  c.line(x + 8, y, x + 8, y + 11, OL[1]); c.rect(x + 6, y + 11, 4, 1, SM[0]);
}
function edgeTile(jungle) {
  const c = new T.Wrap(W, H);
  // Above a ragged line the forest continues seamlessly from the jungle tile; below it is base grass.
  const boundary = x => 92 + 30 * noise(x * .045, 3.7, 91) + 8 * noise(x * .2, 1.3, 92);
  c.fill((x, y) => y < boundary(x) ? jungle.get(x, y) : airbaseGrass(x, y - H));
  const outside = x => x < RX0 - SHOULDER - 4 || x > RX1 + SHOULDER + 4;
  // Forest edge: crowns thin out towards the base.
  for (let k = 0; k < 340; k++) {
    const x = hash(k, 1, 71) * W, b = boundary(x), y = b - 8 + Math.pow(hash(k, 2, 71), 2.2) * 70, r = 3 + hash(k, 3, 71) * 4;
    if (!outside(x - r) || !outside(x + r) || y > 150) continue;
    T.crown(c, Math.floor(x), Math.floor(y), r, hash(k, 4, 71) < .4 ? EMERGENT : CANOPY, k + 2000, 110);
  }
  // Perimeter fence with a striped barrier on each shoulder.
  const fenceY = 146;
  for (let x = 0; x < W; x++) {
    if (!outside(x)) continue;
    c.put(x, fenceY, hash(x, 0, 72) < .7 ? ST[3] : ST[2]);
    c.paint(x + 1, fenceY + 2, shade(60));
    if (x % 7 === 0) { c.put(x, fenceY - 2, WD[1]); c.put(x, fenceY - 1, WD[2]); c.put(x, fenceY, WD[1]); c.paint(x + 2, fenceY + 2, shade(110)); }
    if (x % 3 === 0 && dither(x, fenceY, .5)) c.put(x, fenceY + 1, ST[2]);
  }
  for (const [x0, dir] of [[RX0 - SHOULDER - 4, 1], [RX1 + SHOULDER + 3, -1]]) {
    c.rect(x0 - 1, fenceY - 3, 3, 4, K); c.rect(x0, fenceY - 2, 1, 2, RD[3]);
    for (let s = 0; s < SHOULDER - 2; s++) c.put(x0 + dir * s, fenceY - 1, (s >> 1) % 2 ? CR[3] : RD[3]);
  }
  // Guard tower at the gate.
  c.rect(RX1 + SHOULDER + 12, fenceY - 18, 14, 14, shade(110), true);
  c.rect(RX1 + SHOULDER + 8, fenceY - 22, 12, 12, K); c.rect(RX1 + SHOULDER + 9, fenceY - 21, 10, 10, WD[2]);
  c.rect(RX1 + SHOULDER + 10, fenceY - 20, 8, 3, WD[3]); c.rect(RX1 + SHOULDER + 12, fenceY - 16, 4, 4, WD[1]);
  // West: revetments with a truck and stacked crates, an AA pit.
  revetment(c, 30, 166, 34, 26); truck(c, 40, 170);
  revetment(c, 74, 196, 30, 24);
  for (let k = 0; k < 6; k++) { const bx = 82 + (k % 3) * 7, by = 202 + Math.floor(k / 3) * 7; c.rect(bx + 2, by + 2, 6, 6, shade(100), true); c.rect(bx, by, 6, 6, K); c.rect(bx + 1, by + 1, 4, 4, WD[3]); c.put(bx + 1, by + 1, WD[4]); }
  sandbagRing(c, 104, 164, 9, 8); c.ellipse(104, 164, 5, 5, GR[1]); c.rect(103, 163, 3, 3, ST[1]); c.line(104, 164, 110, 157, ST[0]); c.line(105, 164, 111, 157, ST[1]);
  // East: tent lines, fuel drums, a jeep on the service track.
  for (let t = 0; t <= 1; t += .003) { const x = RX1 + SHOULDER + 2 + t * 120, y = 236 - t * 50 + Math.sin(t * 6) * 4; for (let k = -2; k <= 2; k++) c.put(x, y + k, Math.abs(k) === 2 ? WD[1] : hash(Math.floor(x), Math.floor(y + k), 73) < .2 ? WD[1] : WD[2]); }
  for (const [tx, ty] of [[232, 162], [254, 162], [276, 162], [232, 182], [254, 182], [300, 200], [322, 200]]) tent(c, tx, ty);
  for (let k = 0; k < 8; k++) { const dx = 300 + (k % 4) * 5, dy = 166 + Math.floor(k / 4) * 5; c.ellipse(dx + 2, dy + 2, 2, 2, RD[2]); c.put(dx + 1, dy + 1, RD[4]); }
  c.rect(276, 218, 8, 12, shade(110), true); c.rect(273, 215, 8, 12, K); c.rect(274, 216, 6, 4, OL[3]); c.rect(274, 220, 6, 6, OL[2]); c.rect(275, 217, 4, 2, hex('#7e9aa2'));
  // Sparse airbase trees below the fence (same style as the airbase).
  for (let k = 0; k < 24; k++) {
    const x = hash(k, 5, 71) * W, y = 154 + hash(k, 6, 71) * 84, r = 3 + hash(k, 7, 71) * 3;
    if (!outside(x - r) || !outside(x + r)) continue;
    if ((x > 22 && x < 120 && y > 156) || (x > 222 && x < 340 && y > 154 && y < 236)) continue;
    T.crown(c, Math.floor(x), Math.floor(y), r, SUNLIT, k + 2600, 100);
  }
  strip(c, -H, { shoulderTo: 150 });
  return c;
}

function build(add) {
  const jungle = jungleTile();
  add('Title', 'title_runway_jungle', [jungle], { fps: 1 });
  add('Title', 'title_runway_edge', [edgeTile(jungle)], { fps: 1 });
}

module.exports = { build };

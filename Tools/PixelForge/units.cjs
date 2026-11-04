'use strict';
// Aircraft, ships, weapons, supplies and effects. All units face north (nose up);
// the game rotates them at runtime, so one set of frames serves every heading.
const { PAL, LIVERY, K, shift, withAlpha, hash, fbm, dither, Canvas, text5 } = require('./lib.cjs');
const { OL, CR, GD, ST, GL, RD, NV, WD, FI, SM, IC, WT } = PAL;

// Propeller seen from above: the disc is edge-on, so blades are horizontal strokes
// whose length follows cos(angle). Three blades repeat every 120 degrees.
function propeller(c, cx, y, radius, frame, blades = 3) {
  for (let x = Math.floor(cx - radius); x < Math.ceil(cx + radius); x++) {
    const o = c.get(x, y);
    if (!o || o === K) c.paint(x, y, [214, 208, 186, 90]);
  }
  for (let b = 0; b < blades; b++) {
    const angle = frame * Math.PI / 6 + b * Math.PI * 2 / blades;
    const reach = radius * Math.cos(angle);
    const steps = Math.round(Math.abs(reach));
    for (let s = 2; s <= steps; s++) {
      const x = Math.floor(cx + Math.sign(reach) * (s - .5));
      c.put(x, y, s === steps ? GD[2] : ST[0]);
    }
  }
}

// ---------------- Player fighter (32x32) ----------------
const WING_F = [[10, 16], [10, 16], [10, 16], [10, 16], [10, 16], [10, 16], [10, 16], [10, 15], [10, 15], [10, 15], [11, 15], [11, 15], [11, 15], [11, 14], [12, 13]];
const TAIL_F = [[25, 28], [25, 28], [25, 28], [25, 28], [25, 28], [26, 28], [26, 27]];
const fuseF = y => y < 4 ? 0 : y <= 7 ? 2 : y <= 19 ? 3 : y <= 23 ? 2 : y <= 30 ? 1 : 0;

function fighterBody(span = 1, tilt = 0) {
  const c = new Canvas(32, 32);
  c.fill((x, y) => {
    const dx = x + .5 - 16, i = Math.floor(Math.abs(dx)), iw = Math.floor(Math.abs(dx) / span);
    let col = null;
    const w = WING_F[iw]; if (w && y >= w[0] && y <= w[1]) col = OL[2];
    const t = TAIL_F[i]; if (t && y >= t[0] && y <= t[1]) col = OL[2];
    const hw = fuseF(y); if (i < hw) col = i === 0 ? OL[3] : i === hw - 1 ? OL[1] : OL[2];
    if (col && fbm(x * .2, y * .2, 11) > .57) col = shift(col, -1);
    return col;
  });
  const sym = (x, y, col) => { c.put(x, y, col); c.put(31 - x, y, col); };
  // Recognition bands, roundels (fictional cream ring, gold centre) and gun ports.
  for (let y = 9; y < 17; y++) for (let x = 0; x < 32; x++) {
    const iw = Math.floor(Math.abs(x + .5 - 16) / span);
    if ((iw === 9 || iw === 10) && c.get(x, y)) c.put(x, y, CR[2]);
  }
  for (let x = 14; x < 18; x++) for (let y = 21; y < 23; y++) c.put(x, y, CR[2]);
  const rx = Math.round(16 - 6.5 * span - .5);
  for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) sym(rx + ox, 13 + oy, CR[2]);
  sym(rx, 13, GD[2]);
  sym(Math.round(16 - 7.5 * span - .5), 9, ST[1]); sym(Math.round(16 - 9.5 * span - .5), 9, ST[1]);
  // Exhaust stubs, cowling, spinner.
  sym(13, 6, ST[1]); sym(13, 7, ST[0]);
  for (let x = 14; x < 18; x++) c.put(x, 4, ST[2]);
  c.put(14, 4, ST[3]);
  c.put(15, 1, RD[3]); c.put(16, 1, RD[2]);
  for (let y = 2; y < 4; y++) for (let x = 14; x < 18; x++) c.put(x, y, x === 14 ? RD[3] : RD[2]);
  // Bubble canopy with glint.
  for (let y = 11; y < 16; y++) for (let x = 14; x < 18; x++) c.put(x, y, y === 11 ? GL[2] : y === 15 ? GL[0] : GL[1]);
  c.put(15, 11, GL[3]); c.put(15, 12, GL[3]);
  for (let y = 24; y < 31; y++) { c.put(15, y, OL[1]); c.put(16, y, OL[1]); }
  c.bevel(1, -1);
  if (tilt) for (let y = 9; y < 18; y++) for (let x = 0; x < 32; x++) {
    const dx = x + .5 - 16, col = c.get(x, y);
    if (!col || Math.abs(dx) < 3) continue;
    c.put(x, y, shift(col, (dx < 0) === (tilt < 0) ? -1 : 1));
  }
  // Navigation lights: red port (left), green starboard (right).
  const tip = Math.round(16 - 14 * span - .5);
  c.put(tip, 12, RD[4]); c.put(31 - tip, 12, PAL.GN);
  return c.outline(K);
}

function fighterFrames(span, tilt) {
  const base = fighterBody(span, tilt);
  return [0, 1, 2, 3].map(f => { const c = base.clone(); propeller(c, 16, 3, 8, f); return c; });
}

// ---------------- Enemy bomber (48x40), four liveries ----------------
const wingB = i => i <= 12 ? [14, 21] : i <= 16 ? [15, 20] : i <= 19 ? [15, 19] : i <= 21 ? [16, 19] : i === 22 ? [16, 18] : null;
const tailB = i => i <= 7 ? [31, 35] : i <= 9 ? [32, 35] : i === 10 ? [33, 34] : null;
const fuseB = y => y < 2 ? 0 : y === 2 ? 1 : y === 3 ? 2 : y <= 6 ? 3 : y <= 29 ? 4 : y <= 33 ? 3 : y <= 36 ? 2 : y <= 38 ? 1 : 0;

function bomberBody(livery) {
  const { main, camo, mark } = LIVERY[livery];
  const c = new Canvas(48, 40);
  c.fill((x, y) => {
    const dx = x + .5 - 24, adx = Math.abs(dx), i = Math.floor(adx);
    let col = null;
    const w = wingB(i); if (w && y >= w[0] && y <= w[1]) col = main[2];
    const t = tailB(i); if (t && y >= t[0] && y <= t[1]) col = main[2];
    const e = Math.abs(adx - 10);
    if ((e <= 1.5 && y >= 9 && y <= 22) || (e <= .5 && y >= 23 && y <= 24)) col = e <= .5 ? main[2] : main[1];
    const hw = fuseB(y); if (i < hw) col = i === 0 ? main[3] : i === hw - 1 ? main[1] : main[2];
    if (col === main[2] && fbm(x * .16, y * .16, livery.length * 17) > .55) col = camo[1];
    if (col === main[3] && fbm(x * .16, y * .16, livery.length * 17) > .55) col = camo[2];
    return col;
  });
  const sym = (x, y, col) => { c.put(x, y, col); c.put(47 - x, y, col); };
  // Engine cowlings.
  for (let x = 12; x < 16; x++) { sym(x, 9, ST[3]); sym(x, 10, ST[2]); }
  // Glazed nose with frame and the cockpit.
  for (let y = 2; y < 6; y++) for (let x = 0; x < 48; x++) {
    const i = Math.floor(Math.abs(x + .5 - 24));
    if (i < fuseB(y)) c.put(x, y, y === 4 ? ST[0] : y === 2 ? GL[2] : GL[1]);
  }
  c.put(22, 3, GL[3]);
  for (let y = 9; y < 12; y++) for (let x = 22; x < 26; x++) c.put(x, y, y === 9 ? GL[2] : y === 11 ? GL[0] : GL[1]);
  c.put(22, 9, GL[3]);
  // Dorsal turret with twin guns, twin tail fins, wing insignia.
  for (let x = 23; x < 25; x++) { c.put(x, 18, GL[2]); c.put(x, 19, GL[1]); c.put(x, 21, ST[0]); c.put(x, 22, ST[0]); }
  c.put(23, 18, GL[3]);
  for (let y = 30; y < 37; y++) sym(14, y, main[0]);
  for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) sym(6 + ox, 17 + oy, mark[0]);
  sym(6, 17, mark[1]);
  c.bevel(1, -1);
  return c.outline(K);
}

function bomberFrames(livery, damaged) {
  const base = bomberBody(livery);
  if (damaged) {
    for (let y = 11; y < 24; y++) for (let x = 30; x < 39; x++) {
      const col = base.get(x, y);
      if (col && col !== K && hash(x, y, 9) < .32) base.put(x, y, hash(x, y, 4) < .5 ? SM[0] : SM[1]);
    }
    for (const [x, y] of [[40, 17], [9, 18], [27, 26], [19, 15]]) base.put(x, y, K);
  }
  return [0, 1, 2, 3].map(f => {
    const c = base.clone();
    propeller(c, 14, 8, 5, f); propeller(c, 34, 8, 5, damaged ? (f >> 1) : f + 1);
    if (damaged) {
      const fire = [FI[3], FI[2], FI[4], FI[2]][f];
      c.put(33, 12, fire); c.put(34, 13, f % 2 ? FI[3] : FI[4]); c.put(35, 12, f % 2 ? FI[2] : FI[3]);
      for (let k = 0; k < 4; k++) {
        const py = 25 + ((f * 4 + k * 5) % 16), r = 1 + (py - 24) / 9;
        const px = 34 + Math.sin(py * .7 + k) * 1.3;
        for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
          const d = Math.hypot(x + .5 - px, y + .5 - py);
          if (d <= r && dither(x, y, 1 - (py - 25) / 18)) c.paint(x, y, withAlpha(py < 30 ? SM[2] : SM[3], 230));
        }
      }
    }
    return c;
  });
}

// ---------------- Aircraft carrier (32x112) ----------------
function carrierBody() {
  const c = new Canvas(32, 112);
  const hullHW = y => y < 2 ? 0 : y <= 24 ? Math.max(1, Math.round((y - 2) / 22 * 10)) : y <= 100 ? 10 : y <= 108 ? Math.round(10 - (y - 100) * .5) : 0;
  const deckHW = y => y < 8 ? 0 : y <= 22 ? Math.round(3 + (y - 8) / 14 * 9) : y <= 103 ? 12 : 0;
  c.fill((x, y) => {
    const i = Math.floor(Math.abs(x + .5 - 16));
    const d = deckHW(y), h = hullHW(y);
    if (i < d) {
      if (i === d - 1) return WD[0];
      const plank = (x % 3 === 0) || ((y + x * 7) % 11 === 0);
      return plank ? WD[1] : WD[2];
    }
    if (y >= 24 && y <= 100 && i === d && d === 12) return ST[1];
    if (i < h) return i === h - 1 ? NV[1] : NV[2];
    return null;
  });
  // Flight-deck markings: dashed centre line, elevators, arrestor wires, hazard edge.
  for (let y = 14; y < 100; y++) if (y % 8 < 4) { c.put(15, y, CR[1]); c.put(16, y, CR[1]); }
  for (const top of [28, 58, 82]) for (let y = top; y < top + 8; y++) for (let x = 12; x < 20; x++)
    c.put(x, y, (y === top || y === top + 7 || x === 12 || x === 19) ? WD[0] : WD[3]);
  for (let y = 92; y < 100; y += 2) for (let x = 6; x < 26; x++) if (x % 2 === 0) c.put(x, y, ST[2]);
  for (let x = 5; x < 27; x++) c.put(x, 102, Math.floor(x / 2) % 2 ? CR[2] : K);
  // Island superstructure on the starboard side.
  for (let y = 40; y < 65; y++) for (let x = 24; x < 30; x++) c.put(x, y, NV[3]);
  for (let x = 25; x < 29; x++) c.put(x, 42, GL[1]);
  for (let y = 52; y < 59; y++) for (let x = 25; x < 29; x++) c.put(x, y, (y === 52 || y === 58 || x === 25 || x === 28) ? ST[1] : SM[0]);
  for (let y = 45; y < 50; y++) for (let x = 26; x < 28; x++) c.put(x, y, ST[2]);
  // Anti-aircraft gun tubs along both deck edges.
  const tub = (cx, cy) => { for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) c.put(cx + ox, cy + oy, NV[4]); c.put(cx, cy, ST[0]); c.put(cx, cy - 2, ST[1]); };
  for (const y of [30, 52, 76, 94]) tub(2, y);
  for (const y of [26, 72, 88]) tub(29, y);
  c.bevel(1, -1, 1, -1);
  return c.outline(K);
}

function carrierFrames() {
  const base = carrierBody();
  return [0, 1, 2, 3].map(f => {
    const c = base.clone();
    // Rotating search radar.
    const angle = f * Math.PI / 4;
    for (let s = -2; s <= 2; s++) c.put(Math.round(26.5 + Math.cos(angle) * s - .5), Math.round(47 + Math.sin(angle) * s), ST[4]);
    c.put(27, 41, f % 2 ? RD[1] : RD[4]);
    // Funnel smoke drifting aft.
    for (let k = 0; k < 3; k++) {
      const py = 58 + ((f * 3 + k * 6) % 18), r = 1 + (py - 58) / 10, px = 27 + (py - 58) * .12;
      for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++)
        if (Math.hypot(x + .5 - px, y + .5 - py) <= r && dither(x, y, 1 - (py - 58) / 20)) c.paint(x, y, withAlpha(SM[4], 170));
    }
    return c;
  });
}

// Bow wave (32x24) and stern churn (32x20) are separate so they show only while moving.
function bowWaveFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(32, 24);
    for (let y = 0; y < 24; y++) {
      const spread = 3 + y * .55;
      for (const side of [-1, 1]) for (let t = 0; t < 2; t++) {
        const x = Math.round(16 + side * (spread + t) - .5);
        if (hash(x, y + f * 7, 3) < .78 - y / 40) c.put(x, y, t ? withAlpha(WT[5], 200) : withAlpha(CR[3], 235));
      }
      if (y > 4 && hash(y, f, 8) < .3) c.put(Math.round(16 + (hash(y, f, 2) - .5) * spread * 2), y, withAlpha(WT[5], 150));
    }
    return c;
  });
}
function sternWakeFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(32, 20);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 32; x++) {
      const spread = 6 + y * .45, d = Math.abs(x + .5 - 16);
      if (d < spread && hash(x, y + f * 5, 6) < .55 * (1 - y / 22) * (1 - d / spread * .5)) c.put(x, y, withAlpha(hash(x, y, f) < .5 ? CR[3] : WT[5], 210));
    }
    return c;
  });
}

// ---------------- Rocket (12x36) ----------------
function rocketFrames(hot = false) {
  const tone = hot ? RD : ST;
  const body = new Canvas(12, 36);
  for (let y = 3; y < 25; y++) for (let x = 4; x < 8; x++) body.put(x, y, x === 5 ? tone[3] : x === 7 ? tone[1] : tone[2]);
  body.put(5, 0, GD[3]); body.put(6, 0, GD[2]);
  for (let y = 1; y < 4; y++) for (let x = 4; x < 8; x++) body.put(x, y, y === 3 ? GD[1] : x === 4 ? GD[3] : GD[2]);
  for (let x = 4; x < 8; x++) body.put(x, 9, hot ? GD[2] : RD[2]);
  const fin = (y, reach, col) => { for (let x = 0; x < 12; x++) { const d = Math.abs(x + .5 - 6); if (d > 2 && d <= reach) body.put(x, y, col); } };
  fin(12, 2.5, tone[1]); fin(13, 3.5, tone[1]); fin(14, 3.5, tone[1]); fin(15, 2.5, tone[1]);
  fin(18, 2.5, tone[2]); fin(19, 3.5, tone[2]); fin(20, 4.5, tone[2]); fin(21, 5.5, tone[2]); fin(22, 5.5, tone[2]); fin(23, 5.5, tone[1]);
  body.put(0, 22, RD[3]); body.put(11, 22, RD[3]); body.put(0, 21, RD[3]); body.put(11, 21, RD[3]);
  body.put(5, 25, ST[0]); body.put(6, 25, ST[0]);
  body.bevel(1, -1).outline(K);
  return [6, 9, 7, 10].map((len, f) => {
    const c = body.clone();
    for (let y = 26; y < 26 + len && y < 36; y++) {
      const t = (y - 26) / len;
      for (let x = 3; x < 9; x++) {
        const d = Math.abs(x + .5 - 6);
        let col = null;
        if (d <= .5 && t < .35) col = FI[4]; else if (d <= 1 && t < .65) col = FI[3]; else if (d <= 1.5 && t < .9) col = FI[2]; else if (d <= 2 && t < .4) col = FI[1];
        if (col && t > .5 && !dither(x, y + f, 1.3 - t)) col = null;
        if (col) c.put(x, y, col);
      }
    }
    return c;
  });
}

// ---------------- Supplies (18x18) ----------------
function glint(c, f) {
  const p = f * 7 - 6;
  return c.fill((x, y, col) => { if (!col || col === K) return undefined; const d = x + y - p; return d >= 0 && d <= 1 ? shift(col, 2) : undefined; });
}
function jerrycan() {
  const c = new Canvas(18, 18);
  for (let y = 4; y < 17; y++) for (let x = 4; x < 14; x++) c.put(x, y, RD[2]);
  for (let x = 5; x < 13; x++) { c.put(x, 1, RD[1]); c.put(x, 3, RD[1]); }
  for (const x of [5, 8, 9, 12]) c.put(x, 2, RD[1]);
  c.put(12, 2, ST[3]); c.put(13, 3, ST[3]);
  c.line(5, 6, 12, 15, RD[3]); c.line(12, 6, 5, 15, RD[3]);
  c.line(6, 6, 12, 14, RD[1]); c.line(12, 7, 6, 15, RD[1]);
  c.bevel(1, -1, 1, -1);
  return c.outline(K);
}
function armorPlate() {
  const c = new Canvas(18, 18);
  for (let y = 3; y < 16; y++) for (let x = 2; x < 16; x++) c.put(x, y, ST[2]);
  for (const [x, y] of [[4, 5], [13, 5], [4, 13], [13, 13]]) { c.put(x, y, ST[4]); c.put(x + 1, y + 1, ST[0]); }
  c.line(5, 13, 11, 7, GD[2]); c.line(6, 13, 12, 7, GD[1]);
  for (const [x, y] of [[11, 5], [13, 7], [13, 5], [12, 4], [14, 6]]) c.put(x, y, GD[2]);
  c.put(12, 6, null); c.put(4, 14, GD[2]); c.put(5, 15, GD[1]);
  c.bevel(1, -1, 1, -1);
  return c.outline(K);
}
function radioCrate() {
  const c = new Canvas(18, 18);
  for (let y = 6; y < 17; y++) for (let x = 2; x < 16; x++) c.put(x, y, y < 8 ? OL[3] : OL[2]);
  for (let y = 8; y < 15; y++) for (let x = 3; x < 15; x++) c.put(x, y, SM[0]);
  text5(c, 'R+', 4, 9, CR[3]);
  c.line(13, 5, 15, 0, ST[3]);
  c.bevel(1, -1, 1, -1);
  return c.outline(K);
}
function supplyFrames(kind) {
  const base = kind === 'fuel' ? jerrycan() : kind === 'metal' ? armorPlate() : radioCrate();
  return [0, 1, 2, 3].map(f => {
    const c = glint(base.clone(), f);
    if (kind === 'roll') c.put(15, 0, f < 2 ? FI[4] : RD[2]);
    return c;
  });
}

// ---------------- Effects ----------------
function explosionFrames() {
  const R = [4, 7, 10, 12, 13, 14, 15, 15];
  return R.map((radius, f) => {
    const c = new Canvas(32, 32);
    c.fill((x, y) => {
      const dist = Math.hypot(x + .5 - 16, y + .5 - 16);
      const d = dist / (radius * (.82 + .36 * fbm(x * .22 + f * 1.7, y * .22 - f, 5)));
      if (d >= 1) return null;
      const n = fbm(x * .3 - f, y * .3 + f * 2, 9);
      switch (f) {
        case 0: return d < .55 ? FI[4] : FI[3];
        case 1: return d < .35 ? FI[4] : d < .7 ? FI[3] : FI[2];
        case 2: return d < .3 ? FI[4] : d < .6 ? FI[3] : d < .85 ? FI[2] : FI[1];
        case 3: return d < .25 ? FI[3] : d < .55 ? FI[2] : d < .8 ? (n > .5 ? FI[1] : SM[1]) : SM[1];
        case 4: return d < .4 ? (dither(x, y, .5) ? FI[2] : FI[1]) : n > .55 ? SM[1] : SM[2];
        case 5: return dither(x, y, .85 - d * .3) ? (n > .62 && d < .5 ? FI[1] : SM[2]) : null;
        case 6: return dither(x, y, .55 - d * .3) ? SM[3] : null;
        default: return dither(x, y, .3 - d * .2) ? SM[4] : null;
      }
    });
    if (f >= 1 && f <= 4) for (let k = 0; k < 7; k++) {
      const a = hash(k, 1, 77) * Math.PI * 2, r = radius + 1 + f * .6 + hash(k, 2, 77) * 2;
      c.put(Math.floor(16 + Math.cos(a) * r), Math.floor(16 + Math.sin(a) * r), k % 3 ? K : FI[3]);
    }
    return c;
  });
}
function sparkFrames() {
  return [[2, 1], [5, 3], [4, 3], [2, 2]].map(([long, short], f) => {
    const c = new Canvas(12, 12);
    const col = [FI[4], FI[3], FI[2], FI[1]][f];
    for (let s = 0; s <= long; s++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (f < 2 || s % 2 === 0) c.put(6 + dx * s - (dx < 0 ? 1 : 0), 6 + dy * s - (dy < 0 ? 1 : 0), s < 2 ? FI[4] : col);
    for (let s = 1; s <= short; s++) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.put(6 + dx * s - (dx < 0 ? 1 : 0), 6 + dy * s - (dy < 0 ? 1 : 0), col);
    return c;
  });
}
function smokeFrames() {
  return [[1.6, 1], [2.4, 1], [3, .8], [3.5, .55], [3.8, .3]].map(([r, density], f) => {
    const c = new Canvas(8, 8);
    return c.fill((x, y) => Math.hypot(x + .5 - 4, y + .5 - 4) <= r && dither(x, y, density) ? (x + y < 7 ? SM[4] : SM[3]) : null);
  });
}
function shockwaveFrames() {
  return [0, 1, 2, 3, 4, 5].map(f => {
    const c = new Canvas(64, 64), r = 8 + f * 4.6, th = f < 3 ? 3 : 2;
    const col = [FI[4], FI[3], CR[3], CR[2], SM[4], SM[4]][f], density = [1, 1, .9, .7, .45, .25][f];
    return c.fill((x, y) => {
      const d = Math.hypot(x + .5 - 32, y + .5 - 32);
      if (Math.abs(d - r) <= th / 2 + .2 && dither(x, y, density)) return col;
      if (d < r - 2 && f < 3 && dither(x, y, .12)) return withAlpha(FI[3], 150);
      return null;
    });
  });
}
function iceShieldFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(40, 40);
    c.fill((x, y) => {
      const dx = x + .5 - 20, dy = y + .5 - 20;
      const d = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * .7071);
      if (d > 16.5 && d < 18.6) return dx + dy < 0 ? IC[2] : IC[1];
      if (d <= 16.5 && d > 15.2 && dither(x, y, .5)) return withAlpha(IC[3], 160);
      if (d <= 15.2 && dither(x + f, y, .06)) return withAlpha(IC[3], 120);
      return null;
    });
    for (let k = 0; k < 3; k++) {
      const a = f * Math.PI / 8 + k * Math.PI * 2 / 3, sx = Math.round(20 + Math.cos(a) * 17.5 - .5), sy = Math.round(20 + Math.sin(a) * 17.5 - .5);
      for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) c.put(sx + ox, sy + oy, ox || oy ? IC[3] : PAL.WHITE);
    }
    return c;
  });
}
function tracerFrames() {
  const c = new Canvas(4, 12);
  for (let y = 0; y < 12; y++) {
    const col = y < 3 ? FI[4] : y < 8 ? FI[3] : withAlpha(FI[2], 200 - (y - 8) * 40);
    c.put(1, y, col); c.put(2, y, col);
    if (y > 1 && y < 7) { c.put(0, y, withAlpha(FI[2], 110)); c.put(3, y, withAlpha(FI[2], 110)); }
  }
  return [c];
}
function muzzleFrames() {
  return [0, 1].map(f => {
    const c = new Canvas(8, 8);
    for (let s = 0; s < (f ? 3 : 4); s++) { c.put(3, 4 - s - 1, s < 1 ? FI[4] : FI[3]); c.put(4, 4 - s - 1, s < 1 ? FI[4] : FI[3]); }
    c.put(2, 3, FI[2]); c.put(5, 3, FI[2]); c.put(3, 4, FI[3]); c.put(4, 4, FI[3]);
    if (!f) { c.put(1, 2, FI[2]); c.put(6, 2, FI[2]); }
    return c;
  });
}
function splashFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(16, 10), rx = 2.5 + f * 1.8, ry = 1.3 + f * .9;
    return c.fill((x, y) => {
      const d = Math.hypot((x + .5 - 8) / rx, (y + .5 - 5) / ry);
      return Math.abs(d - 1) < .28 && dither(x, y, 1 - f * .22) ? withAlpha(f < 2 ? CR[3] : WT[5], 220) : null;
    });
  });
}

module.exports = {
  fighterFrames, fighterBody, bomberFrames, bomberBody, carrierFrames, bowWaveFrames, sternWakeFrames, rocketFrames,
  supplyFrames, explosionFrames, sparkFrames, smokeFrames, shockwaveFrames, iceShieldFrames, tracerFrames, muzzleFrames, splashFrames
};

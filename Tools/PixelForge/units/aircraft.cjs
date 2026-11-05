'use strict';
// Units: propeller, player fighter, enemy bomber liveries and attack frames (bank, guns).
// GUN_DEPLOY_FRAMES must match FlightBoardView.GunDeployFrames (C#).
const { PAL, LIVERY, K, shift, withAlpha, hash, fbm, dither, Canvas } = require('../lib.cjs');
const { OL, CR, GD, ST, GL, RD, FI, SM } = PAL;

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

// ---------------- Attack frames ----------------
// Banking bomber: the wings foreshorten around the fuselage and one wing catches the light.
function bomberBankFrames(livery, side) {
  const span = .8, src = bomberBody(livery), base = new Canvas(48, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) {
    const dx = x + .5 - 24;
    let col;
    if (Math.abs(dx) < 4.5) col = src.get(x, y);
    else { const sx = Math.round(24 + Math.sign(dx) * (4.5 + (Math.abs(dx) - 4.5) / span) - .5); col = src.get(sx, y); }
    if (col && col !== K && Math.abs(dx) >= 4.5) col = shift(col, (dx < 0) === (side < 0) ? -1 : 1);
    base.put(x, y, col);
  }
  return [0, 1, 2, 3].map(f => {
    const c = base.clone();
    propeller(c, 24 - 9.5 * span, 8, 4, f); propeller(c, 24 + 9.5 * span, 8, 4, f + 1);
    return c;
  });
}
// Gun overlay (same 48x40 frame as the bomber). Frames 0-8: the gun-bay hatches open and the
// barrels slide out one pixel at a time over the whole lock-on; frames 9-10: muzzle flashes.
const GUN_DEPLOY_FRAMES = 9;
function bomberGunFrames() {
  const ext = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8];
  return ext.map((e, f) => {
    const c = new Canvas(48, 40);
    for (const gx of [17, 30]) {
      // Hatch: a dark slot that widens before the barrel appears.
      const open = Math.min(2, f + 1);
      for (let y = 14 - open; y < 15; y++) { c.put(gx - 1, y, K); c.put(gx + 1, y, K); c.put(gx, y, K); }
      for (let y = 14 - e; y < 14; y++) { c.put(gx, y, y === 14 - e ? ST[4] : y % 3 === 0 ? ST[3] : ST[2]); c.put(gx - 1, y, K); c.put(gx + 1, y, K); }
      if (e > 0) c.put(gx, 13 - e, K);
      // Cooling jacket appears once the barrel is half out.
      if (e >= 4) for (let y = 14 - Math.min(e, 6); y < 13; y += 2) { c.put(gx - 1, y, ST[1]); c.put(gx + 1, y, ST[1]); }
      if (f >= GUN_DEPLOY_FRAMES) {
        const tip = 13 - e;
        c.put(gx, tip, FI[4]); c.put(gx, tip - 1, FI[3]); c.put(gx - 1, tip - 1, FI[2]); c.put(gx + 1, tip - 1, FI[2]);
        if (f === GUN_DEPLOY_FRAMES) { c.put(gx, tip - 2, FI[3]); c.put(gx - 2, tip - 2, FI[2]); c.put(gx + 2, tip - 2, FI[2]); c.put(gx, tip - 3, FI[2]); }
      }
    }
    // Chin cannon under the glazed nose.
    const n = Math.min(3, Math.floor(e / 3));
    for (let y = 2 - n; y < 2; y++) { c.put(23, y, ST[3]); c.put(24, y, ST[2]); }
    return c;
  });
}
function enemyTracerFrames() {
  const c = new Canvas(4, 12);
  for (let y = 0; y < 12; y++) {
    const col = y < 3 ? FI[4] : y < 7 ? RD[4] : withAlpha(RD[3], 210 - (y - 7) * 40);
    c.put(1, y, col); c.put(2, y, col);
    if (y > 1 && y < 7) { c.put(0, y, withAlpha(RD[3], 120)); c.put(3, y, withAlpha(RD[3], 120)); }
  }
  return [c];
}

module.exports = {
  propeller, fighterBody, fighterFrames, bomberBody, bomberFrames, bomberBankFrames,
  bomberGunFrames, enemyTracerFrames
};

'use strict';
// Units: aircraft carrier body, bow wave and stern wake.
const { PAL, K, withAlpha, hash, dither, Canvas } = require('../lib.cjs');
const { CR, ST, GL, RD, NV, WD, SM, WT } = PAL;

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

module.exports = {
  carrierFrames, bowWaveFrames, sternWakeFrames
};

'use strict';
// Units: supply pickups (fuel, armour, radio crate).
const { PAL, K, shift, Canvas, text5 } = require('../lib.cjs');
const { OL, CR, GD, ST, RD, FI, SM } = PAL;

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

module.exports = {
  supplyFrames
};

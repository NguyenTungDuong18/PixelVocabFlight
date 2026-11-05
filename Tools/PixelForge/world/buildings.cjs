'use strict';
// World models: main buildings (hangar, tower, HQ, barracks, mess, medical, academy, workshop, warehouse).
// Style: warm, readable "Stardew" look (deep eaves, fascia, trim, flower boxes, clutter, weathering)
// on a 1944 RAF/USAAF station (Nissen tin, whitewash, brick, tar paper, stencils, blast tape, sandbags).
const { PAL, hash, fbm, shift } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, GR, SN } = PAL;
const {
  BR, WH, CN, TN, CV, TP, PT, ix, flat, glow, mottled, tin, planks, brick, sandbag, canvasMat,
  concrete, rooftile, darkGlass, interior, steel, darkSteel, rubber, woodDark, woodPost,
  trimWhite, trimGreen, redPaint, lampGlow, blackPaint, windowOn, doorOn, steps, def, tarpaper,
  checker, railing, smokeOverlay, leaf, cross5, earth
} = require('./common.cjs');

// ---------- Local kit (quarters.cjs keeps its own copy: model modules never require each other) ----------
const FLOWERS = [RD[3], GD[3], CR[3], RD[4]];
const tw = s => s.length * 4 - 1;
// put(t, d, z, m) on a wall face: t along the wall (x for s/n, y for e/w), d outward from plane p.
const OUT = (g, face, p) => (t, d, z, m) => { if (face === 's') g.set(t, p + d, z, m); else if (face === 'n') g.set(t, p - d, z, m); else if (face === 'e') g.set(p + d, t, z, m); else g.set(p - d, t, z, m); };
// Weathering: grime at the wall foot, rain streaks, optional peeling paint showing `under`.
function aged(m, seed = 1, peel = 0, under = null) {
  return mat((x, y, z, f) => {
    const c = m.fn(x, y, z, f);
    if (f === 'u') return c;
    const u = ix(f === 's' || f === 'n' ? x : y), iz = ix(z);
    if (peel && fbm(u * .21, z * .3, seed + 3) > 1 - peel) return under || shift(c, 1);
    if (iz < 4 && hash(u, iz, seed) < .75 - iz * .17) return shift(c, -1);
    if (hash(u, 0, seed + 7) < .07 && hash(u, ix(z / 5), seed + 1) < .75) return shift(c, -1);
    return c;
  }, { flat: m.flat });
}
// Moss / lichen patches on roof tops.
function mossy(m, th = .74, seed = 5) {
  return mat((x, y, z, f) => (f === 'u' && fbm(x * .11, y * .11, seed) > th + .05 ? (hash(ix(x), ix(y), seed) < .5 ? GR[3] : GR[4]) : m.fn(x, y, z, f)), { flat: m.flat });
}
function bloom(seed = 1, cols = FLOWERS, p = .12) {
  const base = leaf(3, seed);
  return mat((x, y, z, f) => {
    if (hash(ix(x) * 7 + ix(z), ix(y) * 3, seed) < (f === 'u' ? p : p * .5)) return cols[ix(hash(ix(x), ix(y) + ix(z) * 13, seed + 2) * cols.length)];
    return base.fn(x, y, z, f);
  });
}
// Gable roof shells with overhang. o: {wall, w0, w1, inset} gable fill, barge, fascia, ridge, thick.
function roofX(g, x0, x1, y0, y1, z0, h, m, o = {}) {
  const c = (y0 + y1) / 2, hw = (y1 - y0) / 2, t = o.thick ?? 3.4, lim = z => hw * (1 - (z - z0) / h);
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const d = Math.abs(y - c), l = lim(z); return d <= l && d >= l - t; }, m);
  if (o.wall) g.shape(o.w0, y0 + o.inset, z0, o.w1, y1 - o.inset, z0 + h, (x, y, z) => Math.abs(y - c) <= lim(z) - 3, o.wall);
  if (o.barge) for (const x of [x0, x1 - 1]) g.paint(x, y0, z0, x + 1, y1, z0 + h, o.barge);
  if (o.fascia) for (const y of [y0, y1 - 1]) g.box(x0, y, z0 - 2, x1, y + 1, z0, o.fascia);
  if (o.ridge) g.box(x0, c - 1, z0 + h - 2, x1, c + 1, z0 + h, o.ridge);
}
function roofY(g, y0, y1, x0, x1, z0, h, m, o = {}) {
  const c = (x0 + x1) / 2, hw = (x1 - x0) / 2, t = o.thick ?? 3.4, lim = z => hw * (1 - (z - z0) / h);
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const d = Math.abs(x - c), l = lim(z); return d <= l && d >= l - t; }, m);
  if (o.wall) g.shape(x0 + o.inset, o.w0, z0, x1 - o.inset, o.w1, z0 + h, (x, y, z) => Math.abs(x - c) <= lim(z) - 3, o.wall);
  if (o.barge) for (const y of [y0, y1 - 1]) g.paint(x0, y, z0, x1, y + 1, z0 + h, o.barge);
  if (o.fascia) for (const x of [x0, x1 - 1]) g.box(x, y0, z0 - 2, x + 1, y1, z0, o.fascia);
  if (o.ridge) g.box(c - 1, y0, z0 + h - 2, c + 1, y1, z0 + h, o.ridge);
}
function hipRoof(g, x0, y0, x1, y1, z0, h, m, fascia) {
  g.hip(x0, y0, x1, y1, z0, h, m);
  if (fascia) g.shape(x0, y0, z0 - 2, x1, y1, z0, (x, y) => x < x0 + 1 || x > x1 - 1 || y < y0 + 1 || y > y1 - 1, fascia);
}
// Alternating corner stones on a rectangular block.
function quoins(g, x0, y0, x1, y1, z0, z1, m) {
  const rng = (c, s, n) => (s > 0 ? [c, c + n] : [c - n + 1, c + 1]);
  for (let z = z0, k = 0; z < z1; z += 4, k++) for (const [cx, sx] of [[x0, 1], [x1 - 1, -1]]) for (const [cy, sy] of [[y0, 1], [y1 - 1, -1]]) {
    const [a0, a1] = rng(cx, sx, k & 1 ? 3 : 6), [b0, b1] = rng(cy, sy, k & 1 ? 6 : 3);
    g.paint(a0, cy, z, a1, cy + 1, Math.min(z + 3, z1), m); g.paint(cx, b0, z, cx + 1, b1, Math.min(z + 3, z1), m);
  }
}
// Window with optional blast tape (o.tape) and a flower box (o.box = box material).
function win(g, face, a, p, z, w, h, o = {}) {
  windowOn(g, face, a, p, z, w, h, o);
  const put = OUT(g, face, p), tape = flat(CR[1]);
  if (o.tape) for (let t = 0; t < w; t++) { const k = Math.round((h - 1) * t / Math.max(1, w - 1)); put(a + t, -1, z + k, tape); put(a + t, -1, z + h - 1 - k, tape); }
  if (o.box) {
    const fl = bloom(o.seed || a, FLOWERS, .3);
    for (let t = -1; t <= w; t++) for (const d of [1, 2]) { put(a + t, d, z - 4, woodDark); put(a + t, d, z - 3, o.box); put(a + t, d, z - 2, o.box); }
    for (let t = -1; t <= w; t++) { if (hash(t, a, 9) < .85) put(a + t, 2, z - 1, fl); if (hash(t, a, 4) < .45) put(a + t, 2, z, fl); }
  }
}
function lamp(g, face, a, p, z, hood = trimGreen) {
  const put = OUT(g, face, p);
  put(a, 1, z + 4, darkSteel); put(a, 2, z + 4, darkSteel);
  for (let t = -1; t <= 1; t++) for (const d of [2, 3]) put(a + t, d, z + 3, hood);
  put(a, 2, z + 2, lampGlow); put(a, 3, z + 2, lampGlow);
}
// Painted sign board on a south face (front plane y).
function board(g, x0, y, ztop, w, str, tc = CR[3], bg = blackPaint, tr = trimWhite, h = 8) {
  g.box(x0, y, ztop - h, x0 + w, y + 1, ztop, bg);
  g.box(x0 - 1, y, ztop - 1, x0 + w + 1, y + 1, ztop, tr); g.box(x0 - 1, y, ztop - h, x0 + w + 1, y + 1, ztop - h + 1, tr);
  g.text('s', x0 + Math.floor((w - tw(str)) / 2), y, ztop - 2 - Math.floor((h - 8) / 2), str, tc);
}
function chimney(g, x, y, z0, z1, w = 7, d = 7, m = brick(BR, 2)) {
  g.box(x, y, z0, x + w, y + d, z1, m);
  g.box(x - 1, y - 1, z1 - 2, x + w + 1, y + d + 1, z1, flat(CN[3]));
  for (const px of w > 6 ? [x + 2, x + w - 2] : [x + w / 2]) { g.cylZ(px, y + d / 2, 1.4, z1, z1 + 3, flat(RD[3])); g.cylZ(px, y + d / 2, .8, z1 + 2, z1 + 3, flat(TP[0])); }
}
function downpipe(g, x, y, z1) { g.box(x, y, 0, x + 1, y + 1, z1, flat(ST[2])); g.box(x - 1, y, z1 - 2, x + 2, y + 1, z1, flat(ST[2])); }
const tuftM = mat((x, y, z) => GR[3 + (hash(ix(x), ix(y), 11) < .5 ? 1 : 0) + (z >= 1 ? 1 : 0)]);
// Sparse grass clumps on free ground hugging the building (p is scaled down: clumps, not noise).
function tufts(g, x0, y0, x1, y1, seed = 1, p = .1) {
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    if (hash(x, y, seed) > p * .22 || g.has(x, y, 0)) continue;
    let near = false;
    for (let d = 1; d <= 4 && !near; d++) near = g.has(x + d, y, 1) || g.has(x - d, y, 1) || g.has(x, y - d, 1) || g.has(x, y + d, 1);
    if (!near) continue;
    const h = hash(x, y, seed + 1);
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, 1], [1, 1, 0]]) if (!g.has(x + dx, y + dy, dz)) g.set(x + dx, y + dy, dz, tuftM);
    if (h < .25 && !g.has(x, y, 2)) g.set(x, y, 2, flat(FLOWERS[ix(h * 16) % 4]));
  }
}
function bush(g, cx, cy, r, seed = 1, cols = null) {
  const m = cols ? bloom(seed, cols, .1) : leaf(3, seed);
  g.ell(cx, cy, r * .75, r, r * .9, r * .85, m);
  g.ell(cx - r * .6, cy + r * .25, r * .5, r * .6, r * .6, r * .6, m);
  g.ell(cx + r * .55, cy - r * .1, r * .6, r * .65, r * .6, r * .7, m);
}
function bed(g, x0, y0, x1, y1, seed = 1, cols = FLOWERS, edge = flat(CN[3])) {
  g.box(x0, y0, 0, x1, y1, 2, edge); g.box(x0 + 1, y0 + 1, 1, x1 - 1, y1 - 1, 2, earth(2));
  const m = bloom(seed, cols, .22), ry = Math.max(1, (y1 - y0) / 2 - .7);
  for (let x = x0 + 2.5; x < x1 - 1.5; x += 3) { const j = hash(ix(x), y0, seed); g.ell(x, (y0 + y1) / 2 + (j - .5), 2.6, 1.7 + j * .6, ry, 1.4 + j * 1.2, m); }
}
function bags(g, x0, y0, x1, y1, h) {
  g.shape(x0, y0, 0, x1, y1, h, (x, y, z) => z < h - 1 || (x > x0 + 1 && x < x1 - 1 && y > y0 + .9 && y < y1 - .9), sandbag(SN, 2));
}
function drum(g, x, y, R = OL, i = 2, z = 0) {
  g.cylZ(x, y, 2.5, z, z + 9, mottled(R, i, 3, .7, .3));
  for (const zz of [z + 2, z + 6]) g.cylZ(x, y, 2.7, zz, zz + 1, flat(R[i - 1]));
  g.set(x + 1, y - 1, z + 9, flat(ST[1]));
}
function crate(g, x, y, z, w, d, h, R = WD) {
  const body = planks(R, 3, 3), edge = flat(R[1]);
  g.shape(x, y, z, x + w, y + d, z + h, (a, b, c) => ((a < x + 1 || a > x + w - 1) + (b < y + 1 || b > y + d - 1) + (c < z + 1 || c > z + h - 1) >= 2 ? edge : body));
}
function bench(g, x, y, len) { // against a south wall: back rest on its north edge
  const w = planks(WD, 3, 2);
  for (const lx of [x + 1, x + len - 2]) g.box(lx, y, 0, lx + 1, y + 4, 4, woodDark);
  g.box(x, y, 4, x + len, y + 4, 5, w); g.box(x, y, 5, x + len, y + 1, 10, w);
}
function bike(g, x, y) { // leaning on a south-facing wall at plane y-1, front wheel east
  const tyre = flat(TP[1]), fr = flat(OL[3]), hub = flat(ST[3]);
  for (const cx of [x + 4, x + 16]) g.shape(cx - 4, y, 0, cx + 4, y + 1, 8, (a, b, c) => { const d = Math.hypot(a - cx, c - 4); return d <= 4 && (d >= 3 ? tyre : d < 1 ? hub : null); });
  for (const [a, b, c, d] of [[4, 4, 9, 4], [9, 4, 14, 9], [4, 4, 8, 9], [8, 9, 14, 9], [9, 4, 8, 9], [14, 9, 16, 4], [14, 9, 14, 11]]) g.line(x + a, y, b, x + c, y, d, fr);
  g.box(x + 7, y, 10, x + 10, y + 1, 11, flat(TP[2])); g.box(x + 14, y, 11, x + 15, y + 2, 12, darkSteel);
  g.box(x + 16, y, 8, x + 19, y + 2, 11, planks(WD, 3, 2));
}
function washing(g, x0, x1, y, z) {
  for (const x of [x0, x1]) { g.box(x, y, 0, x + 1, y + 1, z + 2, woodPost); g.box(x - 1, y, z + 1, x + 2, y + 1, z + 2, woodPost); }
  g.line(x0, y, z + 1, x1, y, z + 1, flat(CR[1]));
  const cols = [WH[4], OL[3], CR[2], NV[4], WH[3], OL[4]];
  for (let x = x0 + 3, k = 0; x < x1 - 4; x += 6, k++) {
    const w = 3 + (k % 2), h = 4 + (k * 3) % 4;
    g.box(x, y, z + 1 - h, x + w, y + 1, z + 1, flat(cols[k % cols.length]));
    if (k % 3 === 1) g.erase(x + 1, y, z + 1 - h, x + w - 1, y + 1, z + 1 - h + 2);
  }
}
function ladder(g, x, y, z1, m = darkSteel) { for (const yy of [y, y + 5]) g.box(x, yy, 0, x + 1, yy + 1, z1, m); for (let z = 3; z < z1; z += 4) g.box(x, y, z, x + 1, y + 6, z + 1, m); }
function oil(R = CN, i = 3, seed = 9) {
  const base = concrete(R, i);
  return mat((x, y, z, f) => (f === 'u' && fbm(x * .09, y * .09, seed) > .69 ? R[Math.max(0, i - 2 + (hash(ix(x), ix(y), seed) < .3 ? 1 : 0))] : base.fn(x, y, z, f)));
}

// ===== Hangar: corrugated arch, glazed sliding doors half open on a fighter, lean-to annexes.
def('bld_hangar', 'World', [10, 8], 92, g => {
  const roof = mossy(tin(TN, 3, 'x', 16), .74, 8), wall = aged(tin(TN, 2, 'y', 20), 3), rib = flat(ST[2]);
  const cx = 80, rx = 66, rz = 78, y0 = 6, y1 = 124;
  g.box(-4, y0 - 4, 0, 164, y1 + 6, 1, oil(CN, 3, 4));
  g.vaultY(y0, y1, cx, rx, 0, rz, roof);
  for (let y = y0; y < y1; y += 16) g.shape(cx - rx - 1, y, 0, cx + rx + 1, y + 1, rz + 2, (x, yy, z) => { const r = ((x - cx) / (rx + 1)) ** 2 + (z / (rz + 1)) ** 2; return r <= 1 && r > .9; }, rib);
  for (const ye of [y0 - 1, y1]) g.shape(cx - rx - 2, ye, 0, cx + rx + 2, ye + 2, rz + 3, (x, yy, z) => { const r = ((x - cx) / (rx + 2)) ** 2 + (z / (rz + 2)) ** 2; return r <= 1 && r > .86; }, flat(ST[1]));
  for (let y = y0 + 4; y < y1 - 6; y += 16) for (const side of [-1, 1]) { const a = cx + side * 34, b = cx + side * 26; g.shape(Math.min(a, b), y, 30, Math.max(a, b), y + 9, rz + 1, (x, yy, z) => g.has(x, yy, z) && !g.has(x, yy, z + 1), mat(() => GL[1])); }
  // Roof ventilators along the crown.
  for (let y = y0 + 12; y < y1; y += 32) { g.cylZ(cx, y, 2.5, rz - 1, rz + 4, flat(ST[2])); g.cylZ(cx, y, 3.4, rz + 4, rz + 6, flat(ST[3])); }
  // Front gable wall: ribbed tin, door opening, a Spitfire-type nose inside.
  g.paint(cx - rx, y1 - 1, 0, cx + rx, y1, rz, wall);
  const dx0 = 26, dx1 = 134, dh = 50;
  g.erase(58, y1 - 16, 1, 102, y1, dh);
  g.box(58, y1 - 17, 1, 102, y1 - 16, dh, interior);
  g.box(58, y1 - 16, 0, 102, y1, 1, flat(CN[2]));
  const ol = mottled(OL, 2, 6, .66, .2);
  g.box(62, y1 - 14, 9, 98, y1 - 9, 11, ol);                                   // wing
  g.cylY(80, 13, 5.5, y1 - 16, y1 - 4, ol); g.cylY(80, 13, 5.8, y1 - 5, y1 - 3, flat(ST[2]));
  g.cylY(80, 13, 2.2, y1 - 3, y1 - 1, flat(RD[3])); g.box(79, y1 - 2, 3, 81, y1 - 1, 24, flat(TP[1]));   // spinner and prop
  g.box(77, y1 - 15, 18, 83, y1 - 10, 21, mat(() => GL[2], { flat: true }));     // canopy
  for (const x of [68, 92]) { g.box(x, y1 - 11, 1, x + 1, y1 - 10, 9, darkSteel); g.cylX(y1 - 10.5, 2, 2, x - 1, x + 2, rubber); }
  // Door leaves with glazed top row, slid panels, track header, lamps.
  const door = aged(tin(OL, 2, 'y', 18), 6), pane = mat(() => GL[2], { flat: true });
  for (const [a, b] of [[dx0, 58], [102, dx1]]) { g.box(a, y1, 1, b, y1 + 2, dh, door); for (let x = a; x < b; x += 16) g.box(x, y1 + 2, 1, x + 1, y1 + 3, dh, flat(OL[1])); }
  g.box(42, y1 + 2, 1, 58, y1 + 4, dh, door); g.box(102, y1 + 2, 1, 118, y1 + 4, dh, door);
  for (const [a, b, yy] of [[dx0, 42, y1 + 1], [42, 58, y1 + 3], [102, 118, y1 + 3], [118, dx1, y1 + 1]]) for (let x = a + 2; x < b - 2; x += 4) g.box(x, yy, dh - 9, x + 2, yy + 1, dh - 4, pane);
  for (const [a, b, yy] of [[42, 58, y1 + 3], [102, 118, y1 + 3]]) g.box(a + 1, yy, 1, b - 1, yy + 1, 3, flat(GD[2]));
  g.box(dx0 - 4, y1, dh, dx1 + 4, y1 + 5, dh + 4, flat(ST[1]));
  for (const x of [40, 80, 120]) { g.line(x, y1 + 5, dh + 8, x, y1 + 8, dh + 6, darkSteel); g.box(x - 1, y1 + 7, dh + 4, x + 2, y1 + 10, dh + 6, flat(PT[1])); g.set(x, y1 + 9, dh + 3, lampGlow); }
  g.text('s', 63, y1 - 1, dh + 19, 'H-2', CR[2], 3);
  for (const x0 of [40, 106]) for (let x = x0; x < x0 + 14; x++) for (let z = dh + 6; z < dh + 13; z++) if (z % 2 === 0) g.set(x, y1, z, darkSteel);
  // Lean-to annexes: whitewashed walls, tin roofs with fascia, office (west) and stores (east).
  const shedRoof = mossy(tin(TN, 2, 'y', 12), .7, 3), annex = aged(mottled(WH, 3, 2, .74, .14), 9, .1, BR[2]);
  for (const [a, b] of [[0, 16], [144, 160]]) {
    g.box(a, 20, 0, b, 112, 24, annex);
    g.box(a, 20, 0, b, 112, 2, flat(CN[2]));
    g.shape(a - 2, 17, 22, b + 2, 115, 33, (x, y, z) => { const t = a === 0 ? (x - a + 2) / (b - a + 4) : (b + 2 - x) / (b - a + 4); return z < 22 + 4 + t * 6 && z >= 22 + t * 6; }, shedRoof);
    const fx = a === 0 ? a - 2 : b + 1;
    g.box(fx, 17, 20, fx + 1, 115, 23, trimGreen);
    downpipe(g, a === 0 ? a - 1 : b, 18, 22); downpipe(g, a === 0 ? a - 1 : b, 113, 22);
  }
  win(g, 'w', 34, 0, 9, 10, 8, { tape: true, shutters: trimGreen }); win(g, 'w', 62, 0, 9, 10, 8, { tape: true, shutters: trimGreen }); doorOn(g, 'w', 86, 0, 0, 8, 19, { leaf: planks(PT, 1, 4), frame: trimGreen });
  board(g, 1, 111, 22, 14, 'OPS', CR[3], blackPaint, trimGreen);
  lamp(g, 'w', 90, 0, 19); bench(g, -5, 52, 3); g.erase(-5, 52, 5, -2, 53, 10);
  win(g, 's', 3, 111, 9, 9, 8, { bars: false, tape: true });
  doorOn(g, 'e', 40, 159, 0, 12, 19, { leaf: planks(PT, 1, 4), frame: trimGreen }); win(g, 'e', 74, 159, 9, 10, 8, { tape: true });
  g.text('e', 159, 52, 23, 'STORES', TP[1]);
  // Rear wall: personnel door, window, stove pipe.
  doorOn(g, 'n', 70, y0, 0, 9, 22, { leaf: planks(TN, 2, 3) });
  win(g, 'n', 96, y0, 14, 12, 7, { tape: true });
  g.cylZ(10, 30, 1.5, 24, 40, darkSteel); g.cone(10, 30, 3, .5, 40, 43, flat(ST[1]));
  // Fire point, NO SMOKING plate, sandbags guarding the office, drums, ladder, trolley.
  g.box(17, y1, 12, 25, y1 + 1, 28, redPaint);
  for (const x of [18.5, 21, 23.5]) { g.cylZ(x, y1 + 2, 1.2, 13, 17, redPaint); g.box(x - .5, y1 + 1, 17, x + .5, y1 + 2, 18, darkSteel); }
  g.box(17, y1 + 1, 21, 25, y1 + 2, 27, flat(CR[3])); g.text('s', 17, y1 + 1, 26, 'NO', RD[2]); g.box(17, y1 + 1, 22, 25, y1 + 2, 23, flat(RD[2]));
  bags(g, 1, 113, 18, 119, 8);
  for (const [x, y, R] of [[150, 117, OL], [155, 119, RD], [150, 122, OL]]) drum(g, x, y, R, 2, 0);
  ladder(g, 160, 60, 26);
  g.box(124, 126, 1, 136, 130, 6, flat(RD[2])); for (const x of [125, 134]) g.cylX(128, 1.5, 1.5, x, x + 1.5, rubber);
  tufts(g, -6, -6, 166, y1 + 10, 3, .1);
});

// ===== Control tower (Air Ministry watch office): whitewash with rain streaks, balcony, glass cab.
def('bld_control_tower', 'World', [5, 5], 124, g => {
  const wall = aged(mottled(WH, 3, 2, .78, .12), 2, .08, BR[2]), plinth = concrete(CN, 2), slab = concrete(CN, 3);
  const check = checker(GD[2], TP[1], 4, CN[3]), bl = flat(TP[2]);
  g.box(7, 11, 0, 73, 71, 4, plinth);
  g.box(9, 13, 4, 71, 69, 56, wall);
  g.box(8, 12, 36, 72, 70, 38, slab);
  g.box(3, 6, 56, 74, 76, 60, check);
  railing(g, 3, 6, 74, 76, 60, 7, trimWhite, 4);
  g.erase(73, 14, 60, 74, 22, 67);
  // Glass cab with mullions, sill, chequered roof fascia.
  g.box(18, 20, 60, 62, 62, 64, wall);
  g.box(18, 20, 64, 62, 62, 80, mat(() => GL[1], { flat: true }));
  g.erase(19, 21, 64, 61, 61, 80);
  for (let x = 18; x <= 61; x += 6) { g.box(x, 20, 64, x + 1, 21, 80, trimWhite); g.box(x, 61, 64, x + 1, 62, 80, trimWhite); }
  for (let y = 20; y <= 61; y += 6) { g.box(18, y, 64, 19, y + 1, 80, trimWhite); g.box(61, y, 64, 62, y + 1, 80, trimWhite); }
  g.box(18, 20, 71, 62, 62, 72, trimWhite); g.erase(19, 21, 71, 61, 61, 72);
  g.box(20, 22, 64, 60, 60, 67, flat(WD[1]));
  for (const x of [26, 40, 52]) { g.box(x, 58, 67, x + 4, 60, 70, flat(OL[2])); g.set(x + 1, 59, 70, flat(GD[3])); }
  g.box(15, 17, 80, 65, 65, 84, check);
  g.box(16, 18, 84, 64, 64, 85, flat(CN[2]));
  // Roof gear: radio mast with yards, beacon, siren, anemometer, signal lamp.
  g.box(50, 26, 85, 52, 28, 120, darkSteel);
  g.box(43, 26, 110, 59, 28, 111, darkSteel); g.box(46, 26, 116, 56, 28, 117, darkSteel);
  g.line(50, 27, 118, 36, 27, 85, flat(ST[3])); g.line(51, 27, 118, 63, 27, 85, flat(ST[3]));
  g.set(50, 26, 120, glow(RD[4])); g.set(51, 26, 120, glow(RD[4]));
  g.cylZ(26, 28, 2.5, 85, 87, flat(ST[2])); g.cylZ(26, 28, 1.6, 87, 91, glow(GD[3])); g.box(25, 27, 91, 27, 29, 92, flat(ST[1]));
  g.cylY(38, 89, 2.2, 54, 60, flat(ST[3])); g.box(37, 56, 85, 39, 58, 87, darkSteel);
  g.box(58, 56, 85, 59, 57, 96, darkSteel); for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.set(58 + dx, 56 + dy, 96, flat(ST[3]));
  // Front: double door, canopy with CONTROL lettering, sandbag blast walls, steps, lamps.
  doorOn(g, 's', 34, 68, 4, 12, 24, { leaf: planks(NV, 2, 4) });
  g.box(39.5, 67, 4, 40.5, 68, 28, flat(NV[1]));
  g.box(24, 69, 26, 56, 77, 34, slab); g.box(24, 76, 33, 56, 77, 34, trimWhite); g.box(24, 76, 26, 56, 77, 27, trimWhite);
  g.text('s', 27, 76, 32, 'CONTROL', TP[1]);
  steps(g, 30, 50, 70, 2, plinth, 1, 2, 3);
  bags(g, 8, 70, 29, 77, 9); bags(g, 51, 70, 72, 77, 9);
  for (const x of [30, 49]) lamp(g, 's', x + 1, 68, 20);
  // Windows (taped) and black-out shutters folded back.
  for (const x of [14, 56]) win(g, 's', x, 68, 14, 10, 13, { tape: true, shutters: bl });
  for (const x of [13, 27, 43, 57]) win(g, 's', x, 68, 42, 10, 10, { tape: x % 2 === 1, shutters: bl });
  for (const [face, p] of [['w', 9], ['e', 70]]) { for (const y of [20, 46]) win(g, face, y, p, 12, 10, 14, { tape: true }); for (const y of [18, 32, 46]) win(g, face, y, p, 42, 9, 10); }
  for (const x of [56, 30, 16]) win(g, 'n', x, 13, 42, 9, 10);
  win(g, 'n', 30, 13, 14, 9, 12, { tape: true });
  doorOn(g, 'n', 56, 13, 4, 9, 24, { leaf: planks(NV, 2, 4) });
  for (const [x, y] of [[8, 69], [71, 69], [8, 12], [71, 12]]) downpipe(g, x, y, 56);
  // External steel stair up the east side to the balcony.
  for (let k = 0; k < 13; k++) g.box(72, 68 - 4 * (k + 1), 4 + 4 * k, 78, 68 - 4 * k, 6 + 4 * k, flat(ST[2]));
  g.line(78.5, 70, 0, 78.5, 16, 58, darkSteel, .6); g.line(72, 70, 0, 72, 16, 58, darkSteel, .5);
  g.line(78.5, 70, 9, 78.5, 16, 66, flat(ST[3]));
  for (let y = 66; y > 16; y -= 12) g.line(78.5, y, (70 - y) * 58 / 54, 78.5, y, (70 - y) * 58 / 54 + 9, flat(ST[3]));
  g.box(72, 14, 56, 79, 22, 58, flat(ST[2]));
  g.text('s', 30, 61, 63, 'WW-44', TP[1]);
  // Life ring and extinguisher by the door, bike and a fire bucket.
  g.cylY(20, 22, 3, 69, 70, flat(RD[3])); g.cylY(20, 22, 1.6, 68.5, 70.5, null);
  g.cylZ(53, 78, 1.3, 0, 7, redPaint); bike(g, 8, 77);
  tufts(g, -6, -6, 86, 86, 5, .12);
});

// ===== Headquarters: two-storey Georgian brick block, quoins, hipped tile roof, pedimented portico.
def('bld_hq', 'World', [8, 5], 92, g => {
  const wall = aged(brick(BR, 2), 4), base = concrete(CN, 2), stone = aged(flat(WH[3]), 5), tile = mossy(rooftile(RD, 2, "x"), .8, 6);
  g.box(3, 11, 0, 125, 63, 3, base);
  g.box(6, 14, 3, 122, 60, 46, wall);
  quoins(g, 6, 14, 122, 60, 3, 44, stone);
  g.box(5, 13, 23, 123, 61, 25, stone);
  g.box(4, 12, 44, 124, 62, 47, stone);
  hipRoof(g, 1, 7, 127, 67, 47, 24, tile, flat(WD[1]));
  chimney(g, 20, 22, 55, 80, 8, 7); chimney(g, 100, 22, 55, 80, 8, 7);
  // Central bay with pediment and clock.
  g.box(46, 58, 3, 82, 66, 46, wall); quoins(g, 46, 58, 82, 66, 3, 44, stone);
  g.box(45, 57, 23, 83, 67, 25, stone); g.box(44, 56, 44, 84, 68, 47, stone);
  roofY(g, 46, 71, 42, 86, 47, 15, tile, { wall: stone, w0: 50, w1: 68, inset: 3, fascia: flat(WD[1]) });
  g.cylY(64, 54, 4, 67, 68, flat(CR[3])); g.cylY(64, 54, 4.6, 66.5, 67.5, flat(GD[1]));
  g.box(64, 68, 54, 65, 69, 57, flat(TP[0])); g.box(64, 68, 54, 67, 69, 55, flat(TP[0]));
  // Portico: columns, entablature with COMMAND, balustrade, steps.
  g.box(44, 66, 0, 84, 77, 3, base);
  for (const x of [47, 55, 72, 80]) { g.box(x - 1.5, 73, 3, x + 2.5, 77, 5, stone); g.cylZ(x + .5, 75, 1.5, 5, 22, trimWhite); g.box(x - 1.5, 73, 21, x + 2.5, 77, 23, stone); }
  g.box(44, 66, 23, 84, 78, 29, stone);
  railing(g, 44, 66, 84, 78, 29, 5, trimWhite, 3, 'sew');
  g.text('s', 51, 77, 28, 'COMMAND', TP[1]);
  steps(g, 48, 80, 77, 2, base, 1, 2, 2);
  doorOn(g, 's', 58, 65, 3, 12, 19, { leaf: planks(NV, 2, 4), frame: stone });
  g.box(63.5, 64, 3, 64.5, 65, 22, flat(NV[1]));
  lamp(g, 's', 54, 65, 13); lamp(g, 's', 74, 65, 13);
  // Windows: shutters, blast tape on the west wing, flower boxes on the east wing.
  const sh = trimGreen, box = flat(PT[1]);
  for (const x of [15, 33]) { win(g, 's', x, 59, 8, 8, 11, { shutters: sh, tape: true }); win(g, 's', x, 59, 29, 8, 12, { shutters: sh, tape: true }); }
  for (const x of [89, 107]) { win(g, 's', x, 59, 8, 8, 11, { shutters: sh }); win(g, 's', x, 59, 29, 8, 12, { shutters: sh, box, seed: x }); }
  for (const x of [50, 60, 70]) win(g, 's', x, 65, 29, 7, 12, { box, seed: x + 3 });
  for (const [face, p] of [['w', 6], ['e', 121]]) for (const y of [22, 42]) { win(g, face, y, p, 8, 8, 11, { shutters: sh }); win(g, face, y, p, 29, 8, 12, { shutters: sh }); }
  for (const x of [13, 33, 89, 109]) { win(g, 'n', x, 14, 8, 8, 11, { tape: true }); win(g, 'n', x, 14, 29, 8, 12); }
  win(g, 'n', 72, 14, 29, 8, 12);
  doorOn(g, 'n', 60, 14, 3, 10, 19, { leaf: planks(WD, 1, 4), frame: stone });
  g.box(54, 5, 0, 74, 14, 3, base); g.box(76, 6, 0, 88, 13, 8, brick(BR, 1)); g.box(75, 5, 8, 89, 14, 9, woodDark);
  for (const [x, y] of [[7, 60], [120, 60], [7, 13], [120, 13]]) downpipe(g, x, y, 46);
  // Sandbag blast wall (west), rose bed and bench (east), bike.
  bags(g, 8, 61, 45, 67, 9); bike(g, 22, 67);
  bed(g, 85, 61, 122, 66, 7);
  bench(g, 96, 67, 14);
  bush(g, 2, 66, 4, 3); bush(g, 126, 66, 4, 4, FLOWERS);
  tufts(g, -6, -6, 134, 86, 3, .1);
});

// ===== Barracks: Nissen hut, brick end walls, timber entry porch, dormers, washing line.
def('bld_barracks', 'World', [8, 4], 56, g => {
  const shell = mossy(tin(TN, 3, 'y', 12), .72, 2), end = aged(brick(BR, 2), 7), base = concrete(CN, 2), roof2 = tin(TN, 2, 'x', 12), wood = aged(planks(PT, 2, 3), 4, .12, WD[2]);
  g.box(2, 3, 0, 126, 61, 2, base);
  g.vaultX(6, 122, 32, 28, 2, 32, shell);
  for (let x = 10; x < 122; x += 14) g.shape(x, 2, 2, x + 1, 62, 36, (xx, y, z) => { const r = ((y - 32) / 29) ** 2 + ((z - 2) / 33) ** 2; return r <= 1 && r > .88; }, flat(ST[2]));
  g.paint(6, 0, 0, 9, 64, 40, end); g.paint(119, 0, 0, 122, 64, 40, end);
  for (const [face, p] of [['w', 6], ['e', 121]]) {
    doorOn(g, face, 27, p, 2, 10, 23, { leaf: wood, frame: trimWhite });
    win(g, face, 10, p, 10, 8, 9, { tape: true }); win(g, face, 46, p, 10, 8, 9, { tape: true });
    lamp(g, face, 32, p, 25);
  }
  g.box(1, 25, 0, 6, 39, 2, base); g.box(122, 25, 0, 127, 39, 2, base);
  g.text('w', 6, 26, 34, 'B3', CR[3]); g.text('e', 121, 38, 34, 'B3', CR[3]);
  // South entry porch.
  g.box(54, 48, 2, 74, 62, 26, wood);
  roofY(g, 45, 65, 51, 77, 26, 11, roof2, { wall: wood, w0: 48, w1: 62, inset: 3, fascia: trimWhite, barge: trimWhite });
  doorOn(g, 's', 59, 61, 2, 10, 22, { leaf: planks(PT, 1, 4) });
  g.box(55, 62, 0, 73, 65, 2, base);
  lamp(g, 's', 57, 61, 20);
  board(g, 61, 64, 34, 7, 'B3', TP[1], flat(CR[2]), trimWhite, 7);
  // Box dormers both long sides.
  for (const x of [16, 34, 86, 104]) {
    g.box(x, 50, 2, x + 10, 58, 20, wood); g.box(x - 1, 49, 20, x + 11, 60, 22, roof2); g.box(x - 1, 59, 18, x + 11, 60, 20, trimWhite);
    win(g, 's', x + 2, 57, 9, 6, 7, { tape: true });
    g.box(x, 6, 2, x + 10, 14, 20, wood); g.box(x - 1, 4, 20, x + 11, 15, 22, roof2);
    win(g, 'n', x + 2, 6, 9, 6, 7);
  }
  for (const x of [30, 98]) { g.cylZ(x, 24, 1.5, 30, 45, darkSteel); g.cone(x, 24, 3.2, .6, 45, 48, flat(ST[1])); }
  // Blast wall, bench, rain barrel, washing line, bike, bushes.
  bags(g, 76, 60, 96, 66, 8);
  bench(g, 38, 59, 13);
  g.cylZ(124, 52, 3, 0, 9, planks(WD, 2, 2)); g.cylZ(124, 52, 3.3, 3, 4, darkSteel); g.cylZ(124, 52, 2.2, 8.5, 9, flat(GL[1]));
  washing(g, 98, 126, 66, 18);
  bike(g, 6, 63);
  bush(g, 3, 6, 4, 2); bush(g, 125, 4, 3.5, 9, FLOWERS);
  tufts(g, -6, -6, 134, 70, 7, .12);
});

// ===== Mess hall: cream clapboard, mossy tar-paper roof, striped awning, kitchen yard, chimney smoke.
def('bld_mess_hall', 'World', [7, 5], 106, g => {
  const wall = aged(planks(CR, 2, 3), 3, .1, WD[2]), base = concrete(CN, 2), roof = mossy(rooftile(WD, 2, 'x'), .72, 4);
  for (let x = 6; x < 106; x += 16) for (const y of [12, 66]) g.box(x, y, 0, x + 3, y + 3, 4, base);
  g.box(105, 12, 0, 108, 15, 4, base); g.box(105, 66, 0, 108, 69, 4, base);
  g.box(6, 12, 3, 106, 69, 4, flat(WD[1]));
  g.box(7, 13, 4, 105, 68, 34, wall);
  g.box(6, 12, 31, 106, 69, 34, trimGreen);
  for (const [x, y] of [[7, 13], [104, 13], [7, 67], [104, 67]]) g.box(x - .5, y - .5, 4, x + 1.5, y + 1.5, 31, trimGreen);
  roofX(g, 1, 111, 5, 76, 34, 26, roof, { wall, w0: 7, w1: 105, inset: 8, barge: trimGreen, fascia: trimGreen, ridge: flat(TP[2]) });
  for (const [face, p] of [['w', 7], ['e', 104]]) win(g, face, 36, p, 42, 9, 7, { glass: darkGlass, frame: trimGreen });
  // Ridge ventilator lantern and the kitchen chimney (smoke overlay sits on its pots).
  g.box(30, 37, 57, 80, 44, 62, aged(tin(TN, 3, 'y'), 2)); g.box(28, 35, 62, 82, 46, 64, flat(TP[2]));
  chimney(g, 84, 22, 40, 74, 8, 8);
  // Front: screen double door under a striped canvas awning, steps, menu board.
  const screen = mat((x, y, z) => ((ix(x) + ix(z)) % 2 ? TP[2] : TP[1]));
  doorOn(g, 's', 50, 67, 4, 12, 24, { leaf: screen, frame: trimGreen });
  g.box(55.5, 66, 4, 56.5, 67, 28, trimGreen);
  const stripe = mat((x, y, z, f) => ((ix(x / 4) & 1) ? CR[3] : RD[2]));
  g.shed(40, 68, 72, 79, 25, 5, 1, stripe);
  for (let x = 40; x < 72; x += 4) g.box(x, 78, 22, x + 2, 79, 25, (ix(x / 4) & 1) ? flat(CR[3]) : flat(RD[2]));
  for (const x of [41, 70]) g.box(x, 77, 0, x + 1.5, 78, 27, woodPost);
  steps(g, 47, 65, 69, 2, base, 1, 2, 2);
  for (const x of [40, 71]) g.box(x, 76, 26, x + 1, 77, 30, darkSteel);
  board(g, 36, 76, 38, 40, 'MESS HALL', CR[3], blackPaint, trimGreen);
  g.line(68, 78, 17, 71, 78, 17, flat(ST[3])); g.line(68, 78, 17, 69.5, 78, 20, flat(ST[3])); g.line(71, 78, 17, 69.5, 78, 20, flat(ST[3]));
  for (const x of [12, 26, 76, 90]) win(g, 's', x, 67, 13, 9, 12, { frame: trimGreen, box: trimGreen, seed: x });
  for (const x of [96, 82, 30, 16]) win(g, 'n', x, 13, 14, 9, 12, { frame: trimGreen, tape: true });
  doorOn(g, 'n', 56, 13, 4, 10, 24, { leaf: planks(PT, 1, 4), frame: trimGreen });
  g.box(52, 4, 0, 72, 12, 4, base);
  for (const [face, p] of [['w', 7], ['e', 104]]) { win(g, face, 22, p, 14, 9, 12, { frame: trimGreen }); win(g, face, 50, p, 14, 9, 12, { frame: trimGreen }); }
  // Kitchen hood vent, swill bins, crates and potato sacks, milk churns, A-board menu, bench.
  g.cylZ(40, 20, 2, 44, 58, darkSteel); g.box(37, 17, 58, 44, 24, 60, darkSteel);
  for (const y of [56, 62]) { g.cylZ(110, y, 2.4, 0, 9, steel); g.cylZ(110, y, 2.6, 9, 10, flat(ST[3])); }
  crate(g, 57, 2, 0, 12, 7, 8); crate(g, 59, 3, 8, 8, 5, 5);
  for (const [x, y] of [[76, 6], [80, 7], [77, 10]]) g.ell(x, y, 3, 2.6, 2.3, 3.2, sandbag(SN, 3));
  for (const x of [22, 26.5]) { g.cylZ(x, 75, 1.8, 0, 7, flat(ST[3])); g.cylZ(x, 75, 1, 7, 9, flat(ST[3])); }
  g.line(84, 77, 0, 86, 74, 11, woodDark); g.line(90, 77, 0, 88, 74, 11, woodDark); g.box(84, 75, 3, 91, 76, 11, blackPaint);
  for (const z of [9, 7, 5]) g.box(85, 76, z, 90, 77, z + 1, flat(CR[2]));
  bench(g, 8, 69, 12);
  bush(g, 103, 75, 4, 6, FLOWERS); bush(g, 2, 74, 3, 8);
  tufts(g, -6, -6, 118, 86, 9, .1);
}, { frames: 4, fps: 6, overlay: smokeOverlay(88, 26, 77, 30) });

// ===== Medical station: white clapboard, red-cross roof, porch with ramp, stretchers, garden.
def('bld_medical', 'World', [6, 5], 72, g => {
  const wall = aged(planks(WH, 4, 3), 5, .06, WD[2]), base = concrete(CN, 2), roof = tin(TN, 4, 'y', 16);
  g.box(4, 12, 0, 92, 64, 4, base);
  g.box(6, 14, 4, 90, 62, 32, wall);
  g.box(5, 13, 30, 91, 63, 32, flat(WH[3]));
  roofX(g, 1, 95, 7, 69, 32, 24, roof, { wall, w0: 6, w1: 90, inset: 7, barge: flat(RD[2]), fascia: flat(RD[2]) });
  for (const [face, p] of [['w', 6], ['e', 89]]) win(g, face, 34, p, 40, 6, 6, { glass: darkGlass });
  const white = flat(WH[4]), red = flat(RD[2]);
  for (const cy of [53, 23]) g.topPaint(35, cy - 11, 61, cy + 11, (x, y) => {
    const dx = Math.abs(x - 48), dy = Math.abs(y - cy);
    if (dx > 13 || dy > 10) return null;
    return (dx <= 3 && dy <= 8) || (dy <= 3 && dx <= 9) ? red : white;
  });
  g.cylZ(70, 30, 1.4, 44, 58, darkSteel); g.cone(70, 30, 3, .5, 58, 61, flat(ST[1]));
  // Porch: deck, posts, shed roof with MEDICAL fascia, steps and a stretcher ramp.
  g.box(26, 62, 0, 70, 76, 4, base); g.box(27, 62, 3, 69, 75, 4, planks(WD, 3, 3, 'x'));
  steps(g, 36, 56, 76, 2, base, 1, 2, 1.5);
  g.shape(70, 66, 0, 88, 75, 4, (x, y, z) => z < 4 * (1 - (x - 70) / 18), base);
  railing(g, 70, 66, 88, 75, 4, 6, trimWhite, 4, 'sn');
  // Shallow door canopy (a deep porch roof would hide the door from above) carrying the sign.
  g.shed(36, 60, 60, 68, 27, 2, 1, flat(WH[3])); g.box(36, 67, 26, 60, 68, 28, red);
  for (const x of [37, 58]) g.line(x, 61, 22, x, 66, 27, trimWhite);
  for (const x of [1, 29]) g.box(x, 77, 0, x + 1, 78, 13, woodPost);
  board(g, 0, 78, 15, 31, 'MEDICAL', RD[2], white, red, 8);
  g.bitmap('s', 46, 67, 30, cross5, { r: RD[2] }); g.box(44, 67, 26, 53, 68, 31, white);
  for (const x of [28, 67]) g.box(x, 74, 4, x + 1, 75, 11, trimWhite);
  doorOn(g, 's', 42, 61, 4, 12, 23, { leaf: planks(WH, 2, 4) });
  g.box(47.5, 60, 4, 48.5, 61, 27, flat(WH[1]));
  g.bitmap('s', 43, 60, 20, cross5, { r: RD[2] }); g.bitmap('s', 49, 60, 20, cross5, { r: RD[2] });
  lamp(g, 's', 39, 61, 20, trimWhite);
  for (const x of [11, 76]) win(g, 's', x, 61, 12, 10, 12, { box: flat(WH[3]), seed: x });
  for (const x of [80, 54, 24]) win(g, 'n', x, 14, 13, 10, 12, { tape: true });
  for (const [face, p] of [['w', 6], ['e', 89]]) { win(g, face, 20, p, 13, 9, 12); win(g, face, 42, p, 13, 9, 12); }
  g.bitmap('w', 6, 33, 28, cross5, { r: RD[2] }); g.bitmap('e', 89, 37, 28, cross5, { r: RD[2] });
  for (const [x, y] of [[7, 62], [88, 62]]) downpipe(g, x, y, 32);
  // Stretchers on the porch, oxygen bottles, wheelchair, water tank on a stand at the back.
  for (const z of [4, 7]) { g.box(54, 64 + z * 0, z, 66, 65, z + 1, woodDark); g.box(54, 69, z, 66, 70, z + 1, woodDark); g.box(55, 65, z, 65, 69, z + 1, canvasMat(CV, 3, 6)); }
  for (const x of [29, 31.5]) { g.cylZ(x, 72, 1.2, 4, 14, flat(OL[3])); g.set(x, 72, 14, flat(ST[3])); }
  for (const y of [70, 74]) g.shape(80, y, 4, 88, y + 1, 12, (a, b, c) => { const d = Math.hypot(a - 84, c - 8); return d <= 3.6 && d >= 2.6; }, flat(TP[1]));
  g.box(81, 70, 8, 87, 75, 9, flat(CV[3])); g.box(81, 70, 9, 82, 75, 15, flat(CV[3]));
  for (const [x, y] of [[10, 5], [20, 5], [10, 11], [20, 11]]) g.box(x, y, 0, x + 1, y + 1, 22, woodPost);
  g.cylZ(15.5, 8.5, 6, 22, 32, flat(ST[2])); g.cylZ(15.5, 8.5, 6.3, 32, 33, flat(ST[3])); g.text('s', 12, 14, 30, 'H2O', CR[3]);
  bed(g, 4, 64, 25, 69, 5, [RD[3], CR[3], WH[4]]);
  bush(g, 93, 66, 4, 3, [WH[4], RD[3]]); bush(g, 2, 10, 4, 7);
  tufts(g, -6, -6, 102, 86, 4, .1);
});

// ===== Language school: timber schoolhouse, front gable, bell cupola, porch, blackboard, garden.
def('bld_academy', 'World', [7, 5], 96, g => {
  const wall = aged(planks(WD, 3, 3), 6), base = concrete(CN, 2), roof = mossy(rooftile(NV, 3, 'y'), .7, 9), deck = planks(WD, 2, 3, 'x');
  g.box(10, 6, 0, 102, 64, 4, base);
  g.box(12, 8, 4, 100, 62, 36, wall);
  g.box(11, 7, 33, 101, 63, 36, trimWhite);
  for (const [x, y] of [[12, 61], [99, 61], [12, 8], [99, 8]]) g.box(x - .5, y - .5, 4, x + 1.5, y + 1.5, 33, trimWhite);
  roofY(g, 1, 70, 4, 108, 36, 30, roof, { wall, w0: 8, w1: 63, inset: 6, barge: trimWhite, fascia: trimWhite });
  // Round gable vent and bell cupola on the ridge.
  g.cylY(56, 56, 3, 61, 63, trimWhite); g.cylY(56, 56, 2, 62.5, 63.5, flat(TP[1]));
  g.box(50, 40, 60, 62, 50, 70, planks(WH, 3, 3));
  g.erase(51, 40, 64, 61, 50, 70);
  for (const [x, y] of [[50, 40], [61, 40], [50, 49], [61, 49]]) g.box(x, y, 64, x + 1, y + 1, 70, trimWhite);
  g.cone(56, 45, 1.6, 3.6, 64, 69, flat(GD[1])); g.box(55, 44, 69, 57, 46, 70, darkSteel);
  g.pyramid(47, 37, 65, 53, 70, 10, roof); g.box(55.5, 44.5, 80, 56.5, 45.5, 85, darkSteel); g.box(53.5, 44.5, 83, 58.5, 45.5, 84, darkSteel);
  chimney(g, 76, 16, 46, 76, 7, 7);
  // Porch, steps, shed roof on posts, double door.
  g.box(36, 62, 0, 76, 74, 4, base); g.box(36, 62, 3, 76, 74, 4, deck);
  steps(g, 46, 66, 74, 2, deck, 1, 2, 3);
  for (const x of [37, 74]) g.box(x, 72, 4, x + 1.5, 73.5, 30, trimWhite);
  railing(g, 36, 62, 76, 74, 4, 8, trimWhite, 3, 'ew');
  g.shed(34, 60, 78, 76, 29, 5, 1, roof);
  g.box(34, 75, 27, 78, 76, 30, trimWhite);
  doorOn(g, 's', 50, 61, 4, 12, 24, { leaf: planks(PT, 1, 4) });
  g.box(55.5, 60, 4, 56.5, 61, 28, flat(PT[0]));
  lamp(g, 's', 46, 61, 20, trimWhite); lamp(g, 's', 66, 61, 20, trimWhite);
  // SCHOOL / ENGLISH board on the gable.
  g.box(38, 63, 38, 74, 64, 52, blackPaint); g.box(38, 63, 52, 74, 64, 53, trimWhite); g.box(38, 63, 37, 74, 64, 38, trimWhite);
  g.text('s', 45, 63, 50, 'SCHOOL', CR[3]); g.text('s', 43, 63, 44, 'ENGLISH', GD[3]);
  // Blackboard easel with chalk letters, notice board with pinned notes, globe on a stool.
  g.line(81, 77, 0, 82, 74, 22, woodPost); g.line(93, 77, 0, 92, 74, 22, woodPost); g.line(87, 70, 0, 87, 73, 20, woodPost);
  g.box(80, 74, 7, 95, 75, 21, flat(TP[1])); g.box(80, 74, 21, 95, 75, 22, woodDark); g.box(80, 75, 7, 95, 76, 8, woodDark);
  g.text('s', 82, 74, 18, 'ABC', CR[3]); g.box(82, 75, 11, 93, 76, 12, flat(CR[2]));
  g.box(22, 62, 12, 34, 63, 24, woodDark);
  for (const [x, z, c] of [[23, 22, CR[3]], [27, 22, GD[3]], [31, 21, CR[3]], [24, 17, RD[3]], [29, 16, CR[3]]]) g.box(x, 63, z - 3, x + 3, 64, z, flat(c));
  g.box(25, 70, 0, 26, 71, 6, woodDark); g.ell(25.5, 70.5, 9, 3, 3, 3, mat((x, y, z) => (fbm(x * .5, z * .5, 3) > .5 ? OL[3] : GL[2])));
  // Tall school windows with shutters and flower boxes.
  for (const x of [17, 85]) win(g, 's', x, 61, 12, 9, 17, { box: trimWhite, seed: x });
  for (const [face, p] of [['w', 12], ['e', 99]]) for (const y of [14, 30, 46]) win(g, face, y, p, 12, 8, 17, { shutters: trimGreen });
  for (const x of [90, 30]) win(g, 'n', x, 8, 12, 9, 17, { tape: true });
  doorOn(g, 'n', 62, 8, 4, 9, 24, { leaf: planks(PT, 1, 4) });
  bench(g, 14, 64, 14); bike(g, 79, 63);
  bed(g, 6, 70, 34, 76, 2); bush(g, 104, 70, 4.5, 5, FLOWERS); bush(g, 6, 6, 4, 1);
  tufts(g, -6, -6, 118, 86, 6, .1);
});

// ===== Workshop: tin shed, mono-pitch roof, open roller door, bench and radial engine inside.
def('bld_workshop', 'World', [7, 5], 72, g => {
  const wall = aged(tin(TN, 3, 'y', 20), 8), base = oil(CN, 2, 3), brk = aged(brick(BR, 2), 2);
  g.box(2, 6, 0, 110, 79, 2, base);
  g.box(6, 10, 2, 106, 66, 40, wall);
  g.box(6, 10, 2, 106, 66, 8, brk);
  g.shape(6, 10, 40, 106, 66, 52, (x, y, z) => z < 40 + 10 * (1 - (y - 6) / 61), wall);
  g.shed(3, 5, 109, 69, 40, 10, 2, mossy(tin(TN, 3, 'x', 16), .72, 7));
  g.box(3, 68, 38, 109, 69, 41, flat(ST[3]));
  for (const x of [20, 52, 84]) g.topPaint(x, 18, x + 8, 34, () => mat(() => GL[1], { flat: true }));
  // Open roller door with interior.
  g.erase(24, 50, 2, 88, 66, 34);
  const peg = mat((x, y, z) => (ix(x) % 3 === 0 && ix(z) % 3 === 0 ? ST[2] : ST[1]), { flat: true });
  g.box(24, 49, 2, 88, 50, 34, peg);
  g.box(24, 50, 33, 88, 66, 34, flat(ST[1]));
  for (const [x, z, rows] of [[30, 28, ['###', ' # ', ' # ', ' # ']], [36, 29, ['# #', '###', ' # ', ' # ', ' # ']], [42, 28, ['####', '   #']], [70, 28, ['#  #', '####', '#  #']], [78, 29, ['#', '#', '#', '##']]])
    g.bitmap('s', x, 49, z, rows, { '#': ST[4] });
  g.box(28, 50, 2, 58, 55, 12, planks(WD, 2, 2, 'x')); g.box(29, 51, 2, 31, 54, 11, woodDark); g.box(55, 51, 2, 57, 54, 11, woodDark);
  g.box(32, 51, 12, 36, 54, 15, flat(ST[2])); g.box(46, 51, 12, 53, 54, 16, redPaint); g.box(39, 52, 12, 42, 53, 18, flat(GD[2]));
  g.box(64, 56, 2, 76, 60, 4, darkSteel); g.box(69, 57, 4, 71, 59, 12, darkSteel);
  g.cylY(70, 16, 4, 55, 61, flat(ST[2]));
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.cylY(70 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 2.2, 56, 60, flat(ST[3])); }
  g.cylY(70, 16, 1.6, 54, 62, flat(ST[1]));
  // Chain hoist from the lintel beam.
  g.box(60, 52, 31, 80, 54, 33, flat(GD[1])); g.box(69, 52, 26, 71, 54, 31, darkSteel); g.line(70, 53, 26, 70, 53, 21, flat(ST[3])); g.box(69, 52, 20, 71, 54, 21, flat(GD[2]));
  g.box(22, 64, 2, 24, 67, 36, darkSteel); g.box(88, 64, 2, 90, 67, 36, darkSteel);
  g.cylX(65, 37, 2.6, 22, 90, flat(ST[3]));
  board(g, 30, 70, 47, 52, 'MAINTENANCE', CR[3], flat(OL[1]), flat(GD[2]));
  for (const x of [20, 92]) lamp(g, 's', x, 65, 28);
  // Outside: spare propeller, drums, compressor, tyre stack, gas bottles, workbench and vice.
  g.line(11, 67, 2, 15, 67, 32, flat(ST[1]), .7); g.set(15, 67, 32, flat(GD[2])); g.set(11, 67, 2, flat(GD[2])); g.cylY(13, 17, 1.6, 66, 68, flat(ST[2]));
  for (const [x, y, R] of [[96, 70, OL], [101, 72, RD], [96, 75, OL]]) drum(g, x, y, R, 2, 2);
  g.box(4, 70, 2, 20, 77, 10, flat(OL[2])); g.cylX(73.5, 12, 3.5, 6, 18, flat(OL[3])); g.box(18, 70, 2, 20, 77, 4, rubber);
  for (let k = 0; k < 3; k++) g.cylZ(106, 76, 4, 2 + k * 3, 5 + k * 3, rubber);
  g.cylZ(106, 76, 1.8, 2, 11, null);
  for (const x of [108, 110]) { g.cylZ(x, 60, 1.2, 2, 14, flat(x === 108 ? GD[2] : NV[3])); g.set(x, 60, 14, flat(ST[3])); }
  for (const [face, p] of [['w', 6], ['e', 105]]) { win(g, face, 20, p, 18, 12, 8, { frame: flat(ST[2]), tape: true }); win(g, face, 42, p, 18, 12, 8, { frame: flat(ST[2]) }); }
  doorOn(g, 'n', 70, 10, 2, 9, 24, { leaf: aged(tin(OL, 2, 'y'), 4), frame: flat(ST[1]) });
  win(g, 'n', 40, 10, 18, 14, 8, { frame: flat(ST[2]) });
  g.box(36, 3, 2, 60, 9, 10, planks(WD, 2, 2, 'x')); g.box(38, 4, 10, 42, 7, 13, darkSteel);
  for (const x of [30, 82]) { g.cylZ(x, 30, 2, 48, 55, flat(ST[3])); g.cylZ(x, 30, 3, 55, 57, flat(ST[2])); }
  for (const [x, y] of [[6, 67], [105, 67]]) downpipe(g, x, y, 40);
  tufts(g, -6, -6, 118, 86, 2, .1);
});

// ===== Warehouse: tin gable shed, ventilators, loading dock with pallets, half-open sliding door.
def('bld_warehouse', 'World', [7, 5], 74, g => {
  const wall = aged(tin(TN, 2, 'y', 20), 5), roof = mossy(tin(TN, 3, 'x', 20), .72, 1), base = concrete(CN, 2), dock = oil(CN, 3, 8);
  g.box(6, 6, 0, 106, 60, 3, base);
  g.box(8, 8, 3, 104, 58, 36, wall);
  g.box(8, 8, 3, 104, 58, 8, aged(brick(BR, 2), 3));
  roofX(g, 3, 109, 2, 64, 36, 22, roof, { wall, w0: 8, w1: 104, inset: 6, barge: flat(ST[3]), fascia: flat(ST[3]) });
  for (const [face, p] of [['w', 8], ['e', 103]]) for (let k = 0; k < 4; k++) g.box(face === 'w' ? 7 : 104, 29, 42 + k * 2, face === 'w' ? 8 : 105, 37, 43 + k * 2, darkSteel);
  const sky = mat(() => GL[1], { flat: true });
  g.topPaint(4, 3, 108, 63, (x, y) => ((ix(x) - 14) % 32 < 7 && (ix(x) - 14) % 32 >= 0 && ((y > 41 && y < 54) || (y > 12 && y < 25))) ? sky : null);
  for (const x of [30, 82]) { g.cylZ(x, 33, 2.5, 56, 60, flat(ST[2])); g.cylZ(x, 33, 3.6, 60, 64, flat(ST[3])); g.cone(x, 33, 3.6, .8, 64, 66, flat(ST[2])); }
  g.box(8, 58, 0, 104, 72, 6, dock);
  g.box(8, 71, 5, 104, 72, 6, flat(GD[2]));
  for (const x of [16, 40, 68, 94]) g.box(x, 72, 1, x + 3, 73, 5, rubber);
  g.box(2, 60, 0, 8, 70, 2, dock); g.box(4, 60, 2, 8, 70, 4, dock);
  // Canopy over the dock.
  g.shed(26, 56, 86, 68, 34, 4, 1, tin(TN, 3, 'y', 12));
  for (const x of [27, 84]) g.line(x, 58, 24, x, 66, 35, darkSteel);
  // Doors: west half open (crates inside), east sliding panel.
  g.erase(36, 52, 6, 76, 58, 30);
  g.box(36, 51, 6, 76, 52, 30, interior);
  crate(g, 38, 52, 6, 12, 5, 12); crate(g, 40, 53, 18, 8, 4, 7); crate(g, 51, 53, 6, 5, 4, 6);
  g.box(56, 58, 6, 77, 60, 30, aged(tin(OL, 2, 'y', 21), 3)); g.box(66, 60, 6, 67, 61, 30, flat(OL[1])); g.box(73, 60, 16, 75, 61, 18, darkSteel);
  g.box(32, 58, 30, 82, 60, 32, darkSteel);
  g.text('s', 60, 59, 27, 'QM', CR[3]); g.text('s', 60, 59, 20, '4', CR[3], 2);
  board(g, 34, 60, 48, 44, 'QM DEPOT 4', CR[3], flat(OL[1]), flat(GD[2]));
  for (const x of [32, 80]) lamp(g, 's', x, 57, 26);
  // Pallets: crates on the west, sacks on the east, hand truck.
  g.box(12, 61, 6, 28, 71, 7, woodDark);
  crate(g, 13, 62, 7, 7, 8, 7); crate(g, 20, 62, 7, 7, 8, 7); crate(g, 15, 63, 14, 10, 6, 6);
  g.text('s', 15, 69, 12, 'QM', TP[1]);
  g.box(84, 61, 6, 100, 71, 7, woodDark);
  g.shape(85, 62, 7, 99, 70, 16, (x, y, z) => z < 7 + 3 * (1 + ix((z - 7) / 3)) && (z - 7) < 9 - Math.abs(x - 92) * .3, sandbag(CR, 2));
  g.line(103, 69, 6, 101, 64, 18, darkSteel); g.line(106, 69, 6, 104, 64, 18, darkSteel); g.box(102, 68, 6, 107, 71, 7, darkSteel); g.cylX(70, 7, 1.5, 101, 102.5, rubber); g.cylX(70, 7, 1.5, 106.5, 108, rubber);
  for (const [face, p] of [['w', 8], ['e', 103]]) for (const y of [16, 36]) win(g, face, y, p, 22, 10, 6, { frame: flat(ST[2]) });
  doorOn(g, 'e', 44, 103, 3, 10, 23, { leaf: aged(tin(OL, 2, 'y'), 6), frame: flat(ST[1]) });
  ladder(g, 5, 22, 40);
  g.cylZ(102, 61, 1.5, 6, 13, redPaint);
  for (const [x, y] of [[8, 58], [103, 58], [8, 7], [103, 7]]) downpipe(g, x, y, 36);
  drum(g, 110, 30, OL, 2); drum(g, 110, 36, OL, 3);
  tufts(g, -6, -6, 118, 82, 8, .1);
});

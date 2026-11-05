'use strict';
// World models: base building variants (bld_*): Nissen huts, timber and brick barracks, grand HQ with
// flag, officers' club, large mess, NAAFI canteen, field and station hospitals, chapel, ablutions,
// post office, village cottages and the MT garage. Same warm "Stardew" 1944 style as buildings.cjs.
const { PAL, K, hash, fbm, shift } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, GR, SN } = PAL;
const {
  BR, WH, CN, TN, CV, TP, PT, cl, ix, flat, glow, mottled, tin, planks, brick, sandbag, canvasMat,
  concrete, rooftile, glass, darkGlass, interior, steel, darkSteel, rubber, woodDark, woodPost, rope,
  trimWhite, trimGreen, redPaint, lampGlow, blackPaint, windowOn, doorOn, steps, def, tarpaper,
  railing, smokeOverlay, leaf, cross5, earth
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

// ---------- Extra local helpers ----------
const both = (...os) => (c, p, f, o) => os.forEach(fn => fn(c, p, f, o));
// RAF ensign flying toward screen right from a pole top (model coords), 4 waving frames.
function flagOverlay(x, y, z) {
  const W = 16, H = 10;
  return (c, project, f) => {
    const [sx, sy] = project(x, y, z);
    for (let u = 0; u < W; u++) {
      const ph = u * .55 - f * Math.PI / 2, off = Math.round(Math.sin(ph) * 1.3 * (u + 2) / W), sh = Math.cos(ph) < -.5 ? -1 : Math.cos(ph) > .7 ? 1 : 0;
      for (let v = 0; v < H; v++) {
        let col = NV[4];
        if (u < 7 && v < 5) col = (u === 3 || v === 2) ? RD[2] : (Math.abs(u - 3) === 1 || Math.abs(v - 2) === 1) ? CR[3] : NV[1];
        const d = Math.hypot(u - 11.5, v - 6);
        if (d <= 1.2) col = RD[2]; else if (d <= 2.3) col = CR[3]; else if (d <= 3.3) col = NV[1];
        c.put(sx + 1 + u, sy + v + off, sh ? shift(col, sh) : col);
      }
      c.put(sx + 1 + u, sy - 1 + off, K); c.put(sx + 1 + u, sy + H + off, K);
    }
    for (let v = -1; v <= H; v++) c.put(sx + 1 + W, sy + v + Math.round(Math.sin((W - 1) * .55 - f * Math.PI / 2) * 1.3 * (W + 1) / W), K);
  };
}
// Rough-dressed field stone with dark pointing.
function stone(R = CN, i = 3, seed = 2) {
  return mat((x, y, z, f) => {
    const [u, v] = f === 'u' ? [x, y] : f === 's' || f === 'n' ? [x, z] : [y, z];
    const row = ix(v / 4), off = hash(row, 1, seed) * 7, len = 5 + ix(hash(row, 2, seed) * 4);
    const vv = ((ix(v) % 4) + 4) % 4, uu = ((ix(u + off) % len) + len) % len;
    if (vv === 3 || uu === 0) return cl(R, i - 2);
    const t = hash(ix((u + off) / len), row, seed + 3);
    return t > .9 ? SN[2] : cl(R, i + (t < .3 ? -1 : t > .75 ? 1 : 0));
  });
}
// Straw thatch: streaks run down the slope (along y for a ridge along x).
const thatch = (i = 2, along = 'y') => mat((x, y, z, f) => {
  if (f !== 'u') return cl(SN, i - 1 - (hash(ix(x) + ix(y), ix(z), 3) < .3 ? 1 : 0));
  const [a, b] = along === 'y' ? [x, y] : [y, x];
  const n = fbm(a * .55, b * .1, 77), h = hash(ix(x), ix(y), 5);
  return cl(SN, i + (n > .6 ? 1 : n < .4 ? -1 : 0) - (h < .08 ? 1 : 0));
});
// Pointed (lancet) window: a normal window plus a stepped pointed head.
function lancet(g, face, a, p, z, w, h, o = {}) {
  windowOn(g, face, a, p, z, w, h, { bars: false, ...o });
  const put = OUT(g, face, p), fr = o.frame || trimWhite, gl = o.glass || glass, m = Math.ceil(w / 2);
  for (let t = 0; t < w; t++) { put(a + t, 0, z + h, null); put(a + t, -1, z + h, gl); }
  for (let k = 1; k <= m; k++) {
    put(a + k - 2, 0, z + h + k - 1, fr); put(a + w - k + 1, 0, z + h + k - 1, fr);
    for (let t = k - 1; t <= w - k; t++) { put(a + t, 0, z + h + k, null); put(a + t, -1, z + h + k, gl); }
    if (k === m) for (let t = k - 2; t <= w - k + 1; t++) put(a + t, 0, z + h + k + 1, fr);
  }
}
function fence(g, x0, x1, y, h = 7, m = trimWhite, gap = null) {
  for (let x = x0; x < x1; x++) {
    if (gap && x >= gap[0] && x < gap[1]) continue;
    if (x % 2 === 0) { g.box(x, y, 0, x + 1, y + 1, h, m); }
    for (const z of [2, h - 2]) g.set(x, y, z, m);
  }
}
function parasol(g, x, y, col, seed = 1) {
  g.cylZ(x, y, 3.2, 6, 7, planks(WD, 3, 2)); g.box(x - .5, y - .5, 0, x + .5, y + .5, 16, flat(CR[2]));
  const st = mat((a, b) => ((ix((Math.atan2(b - y, a - x) + Math.PI) / (Math.PI / 4)) & 1) ? col : CR[3]));
  g.cone(x, y, 7.5, .6, 14, 18, st);
  for (const [dx, dy] of [[-5, 0], [5, 0], [0, 4]]) { g.box(x + dx - 1.5, y + dy - 1.5, 0, x + dx + 1.5, y + dy + 1.5, 4, planks(SN, 3, 2)); if (dy === 0) g.box(x + dx - 1.5, y - 1.5, 4, x + dx + 1.5, y - .5, 8, planks(SN, 3, 2)); }
}
function picnic(g, x, y, len) { // trestle table along x with two benches
  const w = planks(WD, 3, 2, 'x');
  g.box(x, y + 3, 6, x + len, y + 9, 7, w);
  for (const lx of [x + 2, x + len - 3]) g.box(lx, y + 4, 0, lx + 1, y + 8, 6, woodDark);
  for (const by of [y, y + 10]) { g.box(x, by, 3, x + len, by + 2, 4, w); for (const lx of [x + 2, x + len - 3]) g.box(lx, by, 0, lx + 1, by + 2, 3, woodDark); }
}
function cot(g, x, y, z = 0, w = 12, d = 5) {
  g.box(x, y, z, x + w, y + d, z + 4, darkSteel); g.box(x, y, z + 4, x + w, y + d, z + 5, flat(WH[4]));
  g.box(x + 4, y, z + 5, x + w, y + d, z + 6, flat(OL[3])); g.box(x, y + 1, z + 5, x + 3, y + d - 1, z + 6, flat(WH[4]));
}
function lampPost(g, x, y, h = 24) {
  g.cylZ(x, y, 1.2, 0, 3, flat(ST[1])); g.box(x - .5, y - .5, 3, x + .5, y + .5, h, flat(ST[1]));
  g.box(x - 2, y - 2, h, x + 2, y + 2, h + 1, flat(ST[2])); g.box(x - 1.5, y - 1.5, h + 1, x + 1.5, y + 1.5, h + 4, glow(GD[3])); g.pyramid(x - 2.5, y - 2.5, x + 2.5, y + 2.5, h + 4, 3, flat(PT[1]));
}
function sentry(g, x, y) { // striped sentry box, open to +y
  const st = mat((a, b, c) => ((ix(c / 4) & 1) ? CR[3] : RD[2]));
  g.box(x, y, 0, x + 9, y + 9, 24, st); g.erase(x + 1, y + 2, 1, x + 8, y + 9, 21);
  g.box(x + 1, y + 2, 0, x + 8, y + 9, 1, woodDark); g.pyramid(x - 1, y - 1, x + 10, y + 10, 24, 6, flat(TP[2]));
}
const kerb = mat((x, y) => ((ix(x / 3) + ix(y / 3)) & 1 ? WH[4] : WH[3]));

// ===== Nissen hut, small: arch along y, brick front end wall with door hood.
def('bld_barracks_nissen_small', 'World', [4, 6], 48, g => {
  const shell = mossy(tin(TN, 3, 'x', 12), .72, 11), end = aged(brick(BR, 2), 3), base = concrete(CN, 2), wood = aged(planks(PT, 2, 3), 6, .12, WD[2]), roof2 = tin(TN, 2, 'y', 12);
  g.box(2, 6, 0, 62, 91, 2, base);
  for (const [y0, x0, x1, face, p] of [[24, 3, 13, 'w', 3], [50, 3, 13, 'w', 3], [24, 51, 61, 'e', 60], [50, 51, 61, 'e', 60]]) {
    g.box(x0, y0, 2, x1, y0 + 10, 18, wood); g.box(x0 - 1, y0 - 1, 18, x1 + 1, y0 + 11, 20, roof2);
    win(g, face, y0 + 2, p, 8, 6, 7, { tape: true });
  }
  g.vaultY(8, 88, 32, 27, 2, 32, shell);
  for (let y = 12; y < 86; y += 12) g.shape(2, y, 2, 62, y + 1, 36, (x, yy, z) => { const r = ((x - 32) / 28) ** 2 + ((z - 2) / 33) ** 2; return r <= 1 && r > .88; }, flat(ST[2]));
  g.paint(0, 85, 0, 64, 88, 40, end); g.paint(0, 8, 0, 64, 11, 40, end);
  doorOn(g, 's', 26, 87, 2, 12, 22, { leaf: wood, frame: trimWhite }); g.box(31.5, 86, 2, 32.5, 87, 24, flat(PT[0]));
  win(g, 's', 10, 87, 10, 8, 9, { tape: true }); win(g, 's', 46, 87, 10, 8, 9, { tape: true, box: trimGreen, seed: 3 });
  g.shed(23, 86, 41, 93, 25, 3, 1, roof2); for (const x of [24, 39]) g.line(x, 87, 20, x, 92, 25, darkSteel);
  g.text('s', 28, 87, 33, 'N7', CR[3]);
  win(g, 'n', 28, 8, 12, 8, 9);
  g.cylZ(20, 22, 1.5, 28, 40, darkSteel); g.cone(20, 22, 3.2, .6, 40, 43, flat(ST[1]));
  bags(g, 2, 89, 22, 95, 8); g.cylZ(60, 92, 1.6, 0, 5, redPaint); bike(g, 42, 88);
  bush(g, 2, 4, 3.5, 2); bush(g, 62, 30, 3, 6, FLOWERS);
  tufts(g, -6, -6, 70, 102, 4);
});

// ===== Nissen hut, large: long arch, brick end, timber vestibule, dormers both sides, two stoves.
def('bld_barracks_nissen_large', 'World', [6, 10], 62, g => {
  const shell = mossy(tin(TN, 3, 'x', 12), .72, 12), end = aged(brick(BR, 2), 5), base = concrete(CN, 2), wood = aged(planks(PT, 2, 3), 2, .12, WD[2]), roof2 = tin(TN, 2, 'y', 12);
  g.box(2, 8, 0, 94, 153, 2, base);
  for (const y0 of [28, 56, 84, 112]) for (const [x0, x1, face, p] of [[3, 16, 'w', 3], [80, 93, 'e', 92]]) {
    g.box(x0, y0, 2, x1, y0 + 12, 24, wood); g.box(x0 - 1, y0 - 1, 24, x1 + 1, y0 + 13, 26, roof2);
    win(g, face, y0 + 2, p, 10, 8, 9, { tape: y0 % 56 === 0 });
  }
  g.vaultY(10, 150, 48, 42, 2, 46, shell);
  for (let y = 14; y < 148; y += 14) g.shape(4, y, 2, 92, y + 1, 50, (x, yy, z) => { const r = ((x - 48) / 43) ** 2 + ((z - 2) / 47) ** 2; return r <= 1 && r > .9; }, flat(ST[2]));
  g.paint(0, 147, 0, 96, 150, 50, end); g.paint(0, 10, 0, 96, 13, 50, end);
  // Vestibule.
  g.box(36, 146, 2, 60, 158, 28, wood);
  roofY(g, 143, 161, 33, 63, 28, 12, roof2, { wall: wood, w0: 146, w1: 158, inset: 3, barge: trimWhite, fascia: trimWhite });
  doorOn(g, 's', 42, 157, 2, 12, 23, { leaf: planks(PT, 1, 4) }); g.box(47.5, 156, 2, 48.5, 157, 25, flat(PT[0]));
  g.text('s', 44, 157, 36, '12', CR[3]);
  lamp(g, 's', 39, 157, 20);
  for (const x of [14, 72]) win(g, 's', x, 149, 12, 10, 11, { tape: true, box: x > 40 ? trimGreen : null, seed: x });
  win(g, 's', 44, 149, 34, 8, 6, { glass: darkGlass });
  g.text('s', 10, 149, 31, 'HUT', CR[3]);
  win(g, 'n', 30, 10, 12, 10, 11); doorOn(g, 'n', 54, 10, 2, 10, 22, { leaf: wood });
  for (const [x, y] of [[30, 50], [66, 110]]) { g.cylZ(x, y, 1.6, 40, 54, darkSteel); g.cone(x, y, 3.4, .6, 54, 57, flat(ST[1])); }
  // Clutter: blast walls, bikes, bench, rain barrel, drums, notice board.
  bags(g, 2, 151, 32, 158, 8); bags(g, 64, 151, 94, 158, 8);
  bike(g, 6, 158); bench(g, 66, 158, 14);
  g.cylZ(95, 140, 3, 0, 9, planks(WD, 2, 2)); g.cylZ(95, 140, 3.3, 3, 4, darkSteel);
  for (const [y, R] of [[20, OL], [26, RD]]) drum(g, 96, y, R, 2);
  for (const y of [70, 82]) g.box(-4, y, 0, -3, y + 1, 16, woodPost);
  g.box(-4, 68, 8, -3, 86, 17, woodDark); for (const [y, z, c] of [[70, 15, CR[3]], [75, 14, GD[3]], [80, 15, CR[3]], [72, 11, RD[3]]]) g.box(-5, y, z - 3, -4, y + 4, z, flat(c));
  bush(g, 2, 6, 4, 3); bush(g, 94, 156, 3.5, 5, FLOWERS);
  tufts(g, -6, -6, 102, 166, 6);
});

// ===== Timber barracks: two storeys, first-floor gallery on posts, outside stair, laundry on the rail.
def('bld_barracks_timber', 'World', [10, 6], 96, g => {
  const wall = aged(planks(CR, 2, 3), 8, .08, WD[2]), base = concrete(CN, 2), roof = mossy(rooftile(TN, 3, 'x'), .7, 13), deck = planks(WD, 2, 2);
  g.box(4, 10, 0, 156, 72, 3, base);
  g.box(8, 14, 3, 152, 70, 51, wall);
  g.box(7, 13, 26, 153, 71, 28, trimGreen);
  for (const x of [8, 151]) for (const y of [14, 69]) g.box(x - .5, y - .5, 3, x + 1.5, y + 1.5, 51, trimGreen);
  roofX(g, 2, 158, 5, 76, 51, 26, roof, { wall, w0: 8, w1: 152, inset: 8, barge: trimGreen, fascia: trimGreen, ridge: flat(TN[2]) });
  chimney(g, 38, 26, 60, 84, 8, 7); chimney(g, 116, 26, 60, 84, 8, 7);
  for (const x of [64, 96]) { g.cylZ(x, 38, 1.4, 70, 80, darkSteel); g.cone(x, 38, 3, .5, 80, 83, flat(ST[1])); }
  // Gallery: deck on posts at first-floor level with railing.
  g.box(8, 70, 25, 152, 80, 27, deck); g.box(8, 79, 23, 152, 80, 25, trimGreen);
  for (let x = 8; x <= 150; x += 18) g.box(x, 78, 3, x + 2, 80, 51, woodPost);
  railing(g, 8, 70, 152, 80, 27, 7, trimWhite, 3, 's');
  // Doors and windows on both floors.
  for (const x of [30, 76, 122]) { doorOn(g, 's', x, 69, 3, 10, 21, { leaf: planks(PT, 1, 4), frame: trimGreen }); doorOn(g, 's', x, 69, 27, 10, 20, { leaf: planks(PT, 1, 4), frame: trimGreen }); lamp(g, 's', x - 3, 69, 15); }
  for (const x of [14, 50, 62, 96, 108, 138]) { win(g, 's', x, 69, 8, 8, 11, { frame: trimGreen, tape: x % 4 === 2 }); win(g, 's', x, 69, 33, 8, 11, { frame: trimGreen }); }
  for (const x of [14, 34, 54, 74, 94, 114, 134]) { win(g, 'n', x, 14, 8, 8, 11, { frame: trimGreen }); win(g, 'n', x, 14, 33, 8, 11, { frame: trimGreen }); }
  for (const [face, p] of [['w', 8], ['e', 151]]) for (const y of [24, 48]) { win(g, face, y, p, 8, 8, 11, { frame: trimGreen }); win(g, face, y, p, 33, 8, 11, { frame: trimGreen }); }
  // Outside stair on the east end up to the gallery.
  for (let k = 0; k < 12; k++) { const z = 25 - 2 * (k + 1); g.box(153, 66 - 4 * k, Math.max(0, z), 159, 70 - 4 * k, z + 2, deck); }
  g.line(159, 70, 27, 159, 20, 2, woodDark, .5); g.line(159, 70, 34, 159, 20, 9, trimWhite);
  // Blankets and towels airing on the rail, block sign, bikes, bench, buckets.
  for (const [x, c] of [[20, RD[2]], [44, OL[3]], [88, CR[2]], [110, NV[3]], [132, WH[4]]]) g.box(x, 80, 22, x + 9, 81, 34, flat(c));
  board(g, 64, 81, 34, 30, 'BLOCK C', TP[1], flat(CR[2]), trimGreen, 8);
  bike(g, 40, 72); bike(g, 86, 72); bench(g, 102, 72, 14);
  for (const x of [148, 151]) g.cylZ(x, 76, 1.2, 0, 4, redPaint);
  bush(g, 3, 74, 4, 4, FLOWERS); bush(g, 4, 8, 4, 8);
  tufts(g, -6, -6, 166, 102, 7);
});

// ===== Brick barracks block, L-plan, two storeys, hipped tile roofs, courtyard with laundry and beds.
def('bld_barracks_brick_l', 'World', [12, 9], 100, g => {
  const wall = aged(brick(BR, 2), 9), base = concrete(CN, 2), stoneM = aged(flat(WH[3]), 4), tile = mossy(rooftile(RD, 2, 'x'), .76, 14);
  g.box(5, 9, 0, 187, 61, 3, base); g.box(5, 58, 0, 65, 131, 3, base);
  g.box(8, 12, 3, 184, 58, 47, wall); g.box(8, 56, 3, 62, 128, 47, wall);
  g.box(7, 11, 24, 185, 59, 26, stoneM); g.box(7, 55, 24, 63, 129, 26, stoneM);
  g.box(6, 10, 45, 186, 60, 48, stoneM); g.box(6, 54, 45, 64, 130, 48, stoneM);
  quoins(g, 8, 56, 62, 128, 3, 45, stoneM);
  hipRoof(g, 3, 6, 189, 64, 48, 26, tile, flat(WD[1]));
  hipRoof(g, 3, 50, 67, 134, 48, 26, tile, flat(WD[1]));
  for (const x of [76, 116, 156]) chimney(g, x, 28, 58, 90, 8, 7);
  chimney(g, 30, 90, 58, 90, 7, 8);
  // Main entrance with canopy, sign and lamps.
  doorOn(g, 's', 119, 57, 3, 12, 21, { leaf: planks(NV, 2, 4), frame: stoneM }); g.box(124.5, 56, 3, 125.5, 57, 24, flat(NV[1]));
  g.box(114, 57, 22, 136, 64, 24, flat(WH[3])); for (const x of [115, 134]) g.line(x, 58, 17, x, 63, 22, darkSteel);
  board(g, 113, 64, 32, 24, 'BLOCK A', CR[3], blackPaint, stoneM);
  steps(g, 116, 134, 58, 2, base, 1, 2, 2);
  lamp(g, 's', 110, 57, 13); lamp(g, 's', 139, 57, 13);
  // Windows.
  for (const x of [70, 86, 100, 146, 160, 174]) { win(g, 's', x, 57, 8, 8, 11, { tape: x < 100 }); win(g, 's', x, 57, 30, 8, 12, { box: x > 140 ? trimGreen : null, seed: x }); }
  win(g, 's', 120, 57, 30, 10, 12);
  for (const y of [68, 84, 100, 116]) { win(g, 'e', y, 61, 8, 8, 11, { tape: y === 84 }); win(g, 'e', y, 61, 30, 8, 12); }
  doorOn(g, 's', 30, 127, 3, 10, 21, { leaf: planks(PT, 1, 4), frame: stoneM });
  for (const x of [14, 46]) { win(g, 's', x, 127, 8, 8, 11, { tape: true }); win(g, 's', x, 127, 30, 8, 12, { box: trimGreen, seed: x }); }
  win(g, 's', 31, 127, 30, 8, 12);
  for (let x = 18; x < 180; x += 18) { win(g, 'n', x, 12, 8, 8, 11); win(g, 'n', x, 12, 30, 8, 12); }
  for (const y of [20, 40, 64, 88, 110]) { win(g, 'w', y, 8, 8, 8, 11); win(g, 'w', y, 8, 30, 8, 12); }
  for (const y of [20, 40]) { win(g, 'e', y, 183, 8, 8, 11); win(g, 'e', y, 183, 30, 8, 12); }
  for (const [x, y] of [[62, 57], [183, 58], [8, 128], [61, 128]]) downpipe(g, x, y, 46);
  // Courtyard: path, rose beds, bench, bikes, laundry, lamp post; sandbags at the wing door.
  g.box(116, 61, 0, 134, 144, 1, concrete(CN, 3, 6)); g.box(28, 131, 0, 42, 144, 1, concrete(CN, 3, 6));
  bed(g, 84, 58, 112, 63, 3); bed(g, 140, 58, 182, 63, 5);
  bike(g, 64, 59); bench(g, 150, 70, 14); bench(g, 90, 70, 14);
  washing(g, 142, 186, 120, 18);
  lampPost(g, 112, 100); lampPost(g, 138, 100);
  bags(g, 8, 130, 26, 136, 8); bags(g, 44, 130, 62, 136, 8);
  bush(g, 70, 132, 5, 3); bush(g, 184, 72, 4.5, 9, FLOWERS); bush(g, 76, 76, 3.5, 7, FLOWERS);
  tufts(g, -6, -6, 198, 150, 9);
});

// ===== Station headquarters (grand): central giant portico, clock cupola, wings, forecourt, RAF ensign.
def('bld_hq_grand', 'World', [12, 7], 112, g => {
  const wall = aged(brick(BR, 2), 11), base = concrete(CN, 2), stoneM = aged(flat(WH[3]), 6), tile = mossy(rooftile(NV, 3, 'x'), .78, 3);
  g.box(6, 8, 0, 186, 66, 3, base);
  g.box(10, 14, 3, 72, 58, 44, wall); g.box(120, 14, 3, 182, 58, 44, wall);
  g.box(72, 10, 3, 120, 62, 52, wall);
  for (const [a, b] of [[10, 72], [120, 182]]) { quoins(g, a, 14, b, 58, 3, 42, stoneM); g.box(a - 1, 13, 22, b + 1, 59, 24, stoneM); g.box(a - 2, 12, 42, b + 2, 60, 45, stoneM); }
  quoins(g, 72, 10, 120, 62, 3, 50, stoneM); g.box(70, 8, 50, 122, 64, 53, stoneM);
  hipRoof(g, 6, 9, 76, 63, 45, 20, tile, flat(WD[1])); hipRoof(g, 116, 9, 186, 63, 45, 20, tile, flat(WD[1]));
  hipRoof(g, 68, 5, 124, 67, 53, 22, tile, flat(WD[1]));
  for (const x of [24, 160]) chimney(g, x, 24, 50, 74, 8, 7);
  // Clock cupola.
  g.box(88, 26, 66, 104, 42, 84, planks(WH, 3, 3)); g.box(87, 25, 84, 105, 43, 86, stoneM);
  for (const [face, p] of [['s', 41], ['n', 26]]) { g.cylY(96, 76, 4.5, p === 41 ? 41 : 25, p === 41 ? 43 : 27, flat(CR[3])); }
  g.box(96, 42, 76, 97, 43, 80, flat(TP[0])); g.box(96, 42, 76, 99, 43, 77, flat(TP[0]));
  g.cone(96, 34, 9, 1, 86, 98, flat(GD[1])); g.box(95.5, 33.5, 98, 96.5, 34.5, 106, darkSteel); g.box(93, 33.5, 103, 100, 34.5, 104, darkSteel);
  // Giant portico.
  g.box(74, 62, 0, 118, 78, 4, base);
  for (const x of [78, 89, 102, 113]) { g.box(x - 2.5, 72, 4, x + 2.5, 77, 6, stoneM); g.cylZ(x, 74.5, 2, 6, 48, trimWhite); g.box(x - 2.5, 72, 46, x + 2.5, 77, 48, stoneM); }
  g.box(72, 60, 48, 120, 78, 55, stoneM);
  g.text('s', 77, 77, 53, 'STATION HQ', TP[1]);
  roofY(g, 56, 80, 70, 122, 55, 14, tile, { wall: stoneM, w0: 60, w1: 78, inset: 3, fascia: flat(WD[1]) });
  g.cylY(96, 61, 4, 78, 79, flat(NV[1])); g.cylY(96, 61, 2.8, 78.5, 79.5, flat(CR[3])); g.cylY(96, 61, 1.4, 79, 80, flat(RD[2]));
  steps(g, 76, 116, 78, 3, base, 1, 2, 2);
  doorOn(g, 's', 90, 61, 3, 12, 24, { leaf: planks(NV, 2, 4), frame: stoneM }); g.box(95.5, 60, 3, 96.5, 61, 27, flat(NV[1]));
  g.box(90, 60, 28, 102, 61, 31, glass);
  for (const x of [80, 106]) { win(g, 's', x, 61, 9, 7, 13); win(g, 's', x, 61, 31, 7, 13); }
  win(g, 's', 92, 61, 34, 8, 11);
  lamp(g, 's', 86, 61, 18); lamp(g, 's', 106, 61, 18);
  // Wing windows with shutters and flower boxes.
  for (const x of [18, 34, 52, 128, 146, 162]) { win(g, 's', x, 57, 8, 8, 11, { shutters: trimGreen, tape: x < 60 }); win(g, 's', x, 57, 28, 8, 11, { shutters: trimGreen, box: trimGreen, seed: x }); }
  for (let x = 20; x < 180; x += 18) if (x < 70 || x > 122) { win(g, 'n', x, 14, 8, 8, 11); win(g, 'n', x, 14, 28, 8, 11); }
  win(g, 'n', 92, 10, 30, 10, 14); doorOn(g, 'n', 80, 10, 3, 10, 22, { leaf: planks(WD, 1, 4) });
  for (const y of [22, 40]) { win(g, 'w', y, 10, 8, 8, 11, { shutters: trimGreen }); win(g, 'w', y, 10, 28, 8, 11, { shutters: trimGreen }); win(g, 'e', y, 181, 8, 8, 11, { shutters: trimGreen }); win(g, 'e', y, 181, 28, 8, 11, { shutters: trimGreen }); }
  for (const [x, y] of [[10, 58], [181, 58]]) downpipe(g, x, y, 44);
  // Forecourt: gravel, kerbs, flagpole in a round rose bed, sentry boxes, lamp posts, benches.
  g.box(4, 66, 0, 188, 112, 1, mat((x, y) => (hash(ix(x), ix(y), 4) < .25 ? SN[1] : hash(ix(x), ix(y), 5) < .35 ? CN[3] : SN[2])));
  g.box(4, 66, 0, 188, 68, 2, kerb); g.box(4, 110, 0, 72, 112, 2, kerb); g.box(120, 110, 0, 188, 112, 2, kerb);
  g.box(4, 66, 0, 6, 112, 2, kerb); g.box(186, 66, 0, 188, 112, 2, kerb);
  g.cylZ(96, 96, 11, 0, 2, kerb); g.cylZ(96, 96, 9.5, 1, 2, earth(2));
  const rose = bloom(17, [RD[3], RD[4], CR[3]], .25);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.ell(96 + Math.cos(a) * 6.5, 96 + Math.sin(a) * 6.5, 3, 2.3, 2.3, 2.2, rose); }
  g.cylZ(96, 96, 1.6, 1, 4, flat(WH[3])); g.box(95.5, 95.5, 4, 96.5, 96.5, 62, trimWhite); g.cylZ(96, 96, 1, 62, 64, flat(GD[2]));
  sentry(g, 62, 66); sentry(g, 121, 66);
  lampPost(g, 30, 92); lampPost(g, 162, 92);
  bench(g, 14, 72, 14); bench(g, 164, 72, 14);
  bags(g, 10, 59, 30, 64, 7); bags(g, 162, 59, 182, 64, 7);
  bed(g, 34, 59, 70, 64, 2); bed(g, 122, 59, 158, 64, 8);
  for (const x of [10, 182]) bush(g, x, 104, 5, x, FLOWERS);
  tufts(g, -6, -6, 198, 118, 10);
}, { frames: 4, fps: 6, overlay: flagOverlay(96.5, 96, 63) });

// ===== Officers' club: brick and half-timber, red tile roof with dormers, wide terrace with parasols.
def('bld_officers_club', 'World', [10, 7], 96, g => {
  const brk = aged(brick(BR, 2), 2), render = aged(mottled(CR, 2, 4, .74, .14), 3), base = concrete(CN, 2), tile = mossy(rooftile(RD, 2, 'x'), .76, 15), beam = flat(WD[1]);
  g.box(8, 10, 0, 152, 68, 3, base);
  g.box(10, 12, 3, 150, 66, 32, render); g.box(10, 12, 3, 150, 66, 13, brk);
  // Half-timbering on the long faces.
  for (const [y, yy] of [[65, 66], [12, 13]]) {
    for (let x = 10; x < 150; x += 10) g.paint(x, y, 13, x + 1, yy, 32, beam);
    g.paint(10, y, 13, 150, yy, 14, beam); g.paint(10, y, 31, 150, yy, 32, beam);
    for (let x = 10; x < 150; x += 20) for (let k = 0; k < 10; k++) g.paint(x + k, y, 14 + k * 1.7, x + k + 1, yy, 15.7 + k * 1.7, beam);
  }
  roofX(g, 4, 156, 5, 74, 32, 30, tile, { wall: render, w0: 10, w1: 150, inset: 7, barge: beam, fascia: beam, ridge: flat(RD[1]) });
  for (const x of [36, 110]) {
    g.box(x, 48, 36, x + 16, 66, 50, render);
    roofY(g, 45, 69, x - 2, x + 18, 50, 9, tile, { wall: render, w0: 48, w1: 66, inset: 3, barge: beam, fascia: beam });
    win(g, 's', x + 4, 65, 39, 8, 8);
  }
  chimney(g, 14, 30, 40, 78, 8, 9); chimney(g, 138, 30, 40, 78, 8, 9);
  // Bay window, door with fanlight, french windows.
  g.box(20, 66, 3, 46, 72, 26, render); g.box(20, 66, 3, 46, 72, 10, brk); g.box(19, 65, 26, 47, 73, 28, beam);
  win(g, 's', 23, 71, 11, 20, 12, { frame: trimWhite });
  doorOn(g, 's', 74, 65, 3, 12, 22, { leaf: planks(GD, 1, 4), frame: trimWhite }); g.box(79.5, 64, 3, 80.5, 65, 25, flat(WD[0]));
  for (const x of [56, 96, 116, 132]) doorOn(g, 's', x, 65, 3, 8, 20, { leaf: glass, frame: trimWhite, knob: false });
  lamp(g, 's', 70, 65, 18); lamp(g, 's', 90, 65, 18);
  for (const x of [20, 50, 80, 110, 136]) win(g, 'n', x, 12, 12, 8, 12);
  for (const [face, p] of [['w', 10], ['e', 149]]) for (const y of [20, 46]) win(g, face, y, p, 12, 8, 12, { box: trimGreen, seed: y });
  // Climbing roses on the wall.
  const rose = bloom(21, [RD[3], RD[4], CR[3]], .18);
  for (const x0 of [50, 108]) g.shape(x0, 66, 0, x0 + 5, 68, 26, (x, y, z) => hash(ix(x), ix(z), 4) < .55 - z * .012, rose);
  // Terrace: deck, railing (gap for steps), parasol tables, potted bay trees, sign.
  g.box(14, 68, 0, 146, 100, 3, planks(WD, 3, 3, 'x')); g.box(14, 99, 0, 146, 100, 3, flat(WD[1]));
  railing(g, 14, 68, 70, 100, 3, 6, trimWhite, 3, 'sw'); railing(g, 90, 68, 146, 100, 3, 6, trimWhite, 3, 'se');
  steps(g, 70, 90, 100, 2, base, 1, 1.5, 3);
  parasol(g, 34, 86, RD[2]); parasol(g, 58, 90, GD[2]); parasol(g, 104, 90, NV[3]); parasol(g, 128, 84, RD[2]);
  for (const x of [66, 94]) { g.box(x - 2, 69, 3, x + 2, 73, 8, flat(RD[2])); g.ell(x, 71, 13, 3.5, 3.5, 4.5, leaf(4, x)); g.box(x - .5, 70.5, 8, x + .5, 71.5, 10, woodDark); }
  board(g, 96, 101, 14, 52, 'OFFICERS MESS', GD[3], flat(NV[1]), flat(GD[2]));
  for (const x of [98, 144]) g.box(x, 101, 0, x + 1, 102, 6, woodPost);
  bed(g, 4, 100, 64, 108, 5); bush(g, 6, 70, 5, 9, FLOWERS); bush(g, 154, 72, 4.5, 3);
  tufts(g, -6, -6, 166, 118, 11);
});

// ===== Large mess hall with brick kitchen wing, two chimneys, trestle tables and a kitchen yard.
def('bld_mess_large', 'World', [12, 8], 110, g => {
  const wall = aged(planks(CR, 2, 3), 13, .1, WD[2]), base = concrete(CN, 2), roof = mossy(rooftile(WD, 2, 'x'), .72, 16), kit = aged(brick(BR, 2), 14), ktin = mossy(tin(TN, 3, 'y', 16), .74, 4);
  for (let x = 8; x < 138; x += 16) for (const y of [14, 82]) g.box(x, y, 0, x + 3, y + 3, 4, base);
  g.box(8, 14, 3, 138, 85, 4, flat(WD[1]));
  g.box(9, 15, 4, 137, 84, 36, wall); g.box(8, 14, 33, 138, 85, 36, trimGreen);
  roofX(g, 3, 142, 7, 92, 36, 32, roof, { wall, w0: 9, w1: 137, inset: 8, barge: trimGreen, fascia: trimGreen, ridge: flat(WD[1]) });
  for (const x of [30, 90]) { g.box(x, 45, 66, x + 22, 54, 72, aged(tin(TN, 3, 'y'), x)); g.box(x - 2, 43, 72, x + 24, 56, 74, flat(TP[2])); }
  // Kitchen wing.
  g.box(137, 22, 0, 186, 80, 30, kit);
  roofX(g, 134, 190, 17, 85, 30, 18, ktin, { wall: kit, w0: 137, w1: 186, inset: 6, barge: flat(ST[3]), fascia: flat(ST[3]) });
  chimney(g, 158, 34, 30, 70, 10, 9); chimney(g, 176, 62, 30, 58, 7, 7);
  g.cylZ(146, 40, 2, 40, 54, darkSteel); g.box(143, 37, 54, 150, 44, 56, darkSteel);
  // Hall front: entrance with striped awning and sign, windows with flower boxes.
  const screen = mat((x, y, z) => ((ix(x) + ix(z)) % 2 ? TP[2] : TP[1]));
  doorOn(g, 's', 64, 83, 4, 14, 24, { leaf: screen, frame: trimGreen }); g.box(70.5, 82, 4, 71.5, 83, 28, trimGreen);
  steps(g, 60, 82, 85, 2, base, 1, 2, 2);
  const stripe = mat(x => ((ix(x / 4) & 1) ? CR[3] : NV[3]));
  g.shed(54, 84, 88, 95, 26, 5, 1, stripe);
  for (let x = 54; x < 88; x += 4) g.box(x, 94, 23, x + 2, 95, 26, (ix(x / 4) & 1) ? flat(CR[3]) : flat(NV[3]));
  for (const x of [55, 86]) g.box(x, 93, 0, x + 1.5, 94, 28, woodPost);
  for (const x of [57, 84]) g.box(x, 92, 28, x + 1, 93, 32, darkSteel);
  board(g, 52, 92, 40, 38, 'MESS NO 2', CR[3], blackPaint, trimGreen);
  for (const x of [16, 32, 96, 112, 126]) win(g, 's', x, 83, 13, 9, 13, { frame: trimGreen, box: trimGreen, seed: x });
  for (let x = 18; x < 136; x += 18) win(g, 'n', x, 15, 14, 9, 13, { frame: trimGreen, tape: x % 36 === 0 });
  for (const y of [28, 52, 70]) win(g, 'w', y, 9, 14, 9, 13, { frame: trimGreen });
  // Kitchen front: back door, serving hatch, canopy.
  doorOn(g, 's', 146, 79, 0, 10, 22, { leaf: planks(PT, 1, 4), frame: trimWhite });
  win(g, 's', 162, 79, 10, 16, 9, { frame: trimWhite });
  g.shed(142, 79, 182, 86, 22, 3, 1, tin(TN, 3, 'y', 12));
  board(g, 156, 87, 30, 30, 'KITCHEN', CR[3], flat(RD[1]), trimWhite, 7);
  for (const y of [34, 58]) win(g, 'e', y, 185, 10, 10, 9, { frame: trimWhite });
  // Trestle tables, menu A-board, kitchen yard clutter.
  picnic(g, 12, 96, 30); picnic(g, 96, 96, 30);
  g.line(46, 108, 0, 48, 105, 12, woodDark); g.line(52, 108, 0, 50, 105, 12, woodDark); g.box(46, 106, 3, 53, 107, 12, blackPaint);
  for (const z of [10, 8, 6]) g.box(47, 107, z, 52, 108, z + 1, flat(CR[2]));
  for (const x of [142, 147.5, 153]) { g.cylZ(x, 92, 2.4, 0, 9, steel); g.cylZ(x, 92, 2.6, 9, 10, flat(ST[3])); }
  crate(g, 158, 90, 0, 12, 8, 8); crate(g, 160, 91, 8, 8, 6, 6); crate(g, 172, 90, 0, 10, 8, 10);
  for (const [x, y] of [[164, 104], [169, 106], [166, 109], [160, 108]]) g.ell(x, y, 3, 3, 2.4, 3.2, sandbag(SN, 3));
  for (const x of [178, 182.5]) { g.cylZ(x, 104, 1.9, 0, 7, flat(ST[3])); g.cylZ(x, 104, 1, 7, 9, flat(ST[3])); }
  g.cone(150, 110, 7, 1, 0, 6, mat((x, y) => (hash(ix(x), ix(y), 3) < .5 ? TP[0] : TP[1])));
  g.cylZ(178, 116, 3, 0, 5, planks(WD, 2, 2)); g.cylZ(178, 116, 2.4, 4.5, 5, flat(SN[3])); g.box(183, 115, 0, 186, 118, 4, woodDark);
  bush(g, 4, 90, 4.5, 6, FLOWERS); bush(g, 140, 116, 3.5, 2);
  tufts(g, -6, -6, 198, 134, 12);
}, { frames: 4, fps: 6, overlay: both(smokeOverlay(163, 38.5, 73, 34), smokeOverlay(179.5, 65.5, 61, 26)) });

// ===== NAAFI canteen: green timber hut, serving hatch with tea urn, striped awning, picnic tables.
def('bld_canteen', 'World', [6, 5], 72, g => {
  const wall = aged(planks(PT, 2, 3), 17, .12, WD[2]), base = concrete(CN, 2), roof = mossy(rooftile(NV, 3, 'x'), .72, 18);
  for (let x = 8; x < 88; x += 16) for (const y of [14, 54]) g.box(x, y, 0, x + 3, y + 3, 4, base);
  g.box(8, 14, 3, 88, 57, 4, flat(WD[1]));
  g.box(9, 15, 4, 87, 56, 30, wall); g.box(8, 14, 28, 88, 57, 30, trimWhite);
  roofX(g, 3, 93, 8, 63, 30, 20, roof, { wall, w0: 9, w1: 87, inset: 7, barge: trimWhite, fascia: trimWhite });
  g.cylZ(70, 26, 1.4, 36, 50, darkSteel); g.cone(70, 26, 3, .5, 50, 53, flat(ST[1]));
  // Serving hatch: counter, propped flap, urn, cups and buns.
  g.erase(28, 52, 12, 64, 56, 24); g.box(28, 51, 12, 64, 52, 24, interior);
  g.box(27, 55, 11, 65, 60, 12, planks(WD, 3, 2, 'x'));
  g.cylZ(36, 53.5, 2.6, 12, 21, steel); g.cylZ(36, 53.5, 1.4, 21, 23, flat(ST[3])); g.box(38, 55, 15, 40, 56, 16, flat(GD[2]));
  for (const x of [44, 47, 50, 53]) g.cylZ(x, 57.5, .8, 12, 14, flat(WH[4]));
  for (const x of [57, 60]) g.ell(x, 57, 12.5, 1.4, 1.4, 1.2, flat(GD[1]));
  const stripe = mat(x => ((ix(x / 4) & 1) ? CR[3] : RD[2]));
  g.shed(24, 55, 68, 66, 25, 4, 1, stripe);
  for (const x of [25, 66]) g.line(x, 56, 18, x, 65, 25, darkSteel);
  // Side door, chalk price board, sign on posts, picnic tables, bins, bikes.
  doorOn(g, 'e', 26, 87, 4, 10, 22, { leaf: planks(PT, 1, 4), frame: trimWhite }); steps(g, 88, 92, 24, 2, base, 1, 2, 1);
  g.box(70, 56, 10, 84, 57, 22, blackPaint); g.box(70, 56, 22, 84, 57, 23, woodDark); g.text('s', 71, 56, 20, 'TEA', CR[3]); g.text('s', 71, 56, 14, '1D', GD[3]);
  for (const x of [4, 25]) g.box(x, 76, 0, x + 1, 77, 12, woodPost);
  board(g, 3, 77, 15, 23, 'NAAFI', GD[3], flat(NV[1]), flat(RD[2]));
  picnic(g, 32, 66, 22); picnic(g, 62, 66, 22);
  for (const x of [91, 95]) { g.cylZ(x, 48, 2.2, 0, 8, steel); g.cylZ(x, 48, 2.4, 8, 9, flat(ST[3])); }
  bike(g, 6, 57);
  bush(g, 2, 14, 4, 4); bush(g, 92, 72, 3.5, 7, FLOWERS);
  tufts(g, -6, -6, 102, 86, 13);
});

// ===== Field hospital: large canvas ward tent, red crosses, flaps rolled up over cots, guy ropes.
def('bld_medical_tent', 'World', [10, 7], 56, g => {
  const cv = canvasMat(CV, 3, 10), cvd = canvasMat(CV, 2, 10), white = flat(WH[4]), red = flat(RD[2]);
  g.box(12, 22, 0, 148, 90, 1, flat(CV[1]));
  g.box(12, 22, 1, 148, 90, 21, cvd);
  roofX(g, 8, 152, 18, 94, 21, 24, cv, { wall: cvd, w0: 12, w1: 148, inset: 4 });
  for (const x of [50, 110]) { g.cylZ(x, 56, 1, 43, 49, woodPost); g.cylZ(x, 56, 1.5, 49, 50, flat(ST[2])); }
  for (const cy of [30, 82]) g.topPaint(64, cy - 12, 96, cy + 12, (x, y) => {
    const dx = Math.abs(x - 80), dy = Math.abs(y - cy);
    if (dx > 14 || dy > 9) return null;
    return (dx <= 3 && dy <= 7) || (dy <= 2.5 && dx <= 9) ? red : white;
  });
  // Rolled-up wall flaps showing cots inside.
  for (const [a, b] of [[18, 62], [98, 142]]) {
    g.erase(a, 88, 1, b, 90, 18); g.box(a, 60, 1, b, 88, 1.5, flat(CV[1]));
    g.cylX(89, 19.5, 1.6, a - 1, b + 1, flat(CV[2]));
    for (let x = a + 2; x < b - 12; x += 15) cot(g, x, 78, 1, 12, 6);
    g.box(a, 60, 1, b, 62, 18, interior); for (let x = a + 8; x < b; x += 20) { g.box(x, 70, 1, x + 1, 71, 18, woodPost); g.box(x - 1, 70, 15, x + 2, 72, 17, flat(ST[2])); g.set(x, 72, 15, lampGlow); }
  }
  // Porch tent with an open, tied-back flap.
  g.box(66, 88, 0, 94, 104, 14, cvd); g.erase(68, 88, 1, 92, 104, 14);
  roofY(g, 86, 106, 63, 97, 14, 11, cv, { thick: 3 });
  g.erase(70, 103, 1, 90, 106, 18);
  for (const x of [68, 89]) g.box(x, 103, 1, x + 3, 105, 14, flat(CV[2]));
  g.box(70, 88, 1, 90, 103, 2, flat(CV[1]));
  g.bitmap('s', 78, 105, 23, cross5, { r: RD[2] });
  // Guy ropes and pegs.
  for (let x = 14; x <= 146; x += 22) for (const [ey, py] of [[18, 8], [93, 104]]) { g.line(x, ey, 21, x, py, 0, rope); g.box(x, py, 0, x + 1, py + 1, 2, woodDark); }
  for (const [ex, px] of [[8, -2], [151, 160]]) for (const y of [36, 76]) { g.line(ex, y, 21, px, y, 0, rope); g.box(px, y, 0, px + 1, y + 1, 2, woodDark); }
  // Stretchers, medical crates, oxygen, lantern post, sandbags, sign.
  for (const [x, y] of [[100, 100], [100, 106]]) { g.box(x, y, 2, x + 16, y + 1, 3, woodDark); g.box(x, y + 4, 2, x + 16, y + 5, 3, woodDark); g.box(x + 1, y + 1, 2, x + 15, y + 4, 3, canvasMat(CV, 3, 6)); for (const lx of [x + 1, x + 14]) g.box(lx, y, 0, lx + 1, y + 5, 2, woodDark); }
  for (const [x, y, z] of [[126, 98, 0], [134, 98, 0], [128, 98, 7]]) { g.box(x, y, z, x + 7, y + 6, z + 7, white); g.bitmap('s', x + 1, y + 5, z + 6, cross5, { r: RD[2] }); }
  for (const x of [140, 142.5, 145]) { g.cylZ(x, 102, 1.1, 0, 10, flat(OL[3])); g.set(x, 102, 10, flat(ST[3])); }
  g.box(58, 104, 0, 59, 105, 22, woodPost); g.box(56, 103, 18, 61, 106, 22, flat(ST[2])); g.set(58, 106, 19, lampGlow); g.set(59, 106, 19, lampGlow);
  bags(g, 2, 92, 30, 98, 7);
  for (const x of [2, 56]) g.box(x, 106, 0, x + 1, 107, 10, woodPost);
  board(g, 0, 107, 14, 58, 'FIELD HOSPITAL', RD[2], white, red);
  tufts(g, -6, -6, 166, 118, 14);
});

// ===== Station hospital: brick admin block, two long wards with tall windows, ambulance canopy.
def('bld_medical_hospital', 'World', [12, 7], 92, g => {
  const wall = aged(brick(BR, 2), 19), base = concrete(CN, 2), white = aged(flat(WH[3]), 7), tile = mossy(rooftile(TN, 3, 'x'), .76, 19), red = flat(RD[2]), whiteP = flat(WH[4]);
  g.box(5, 9, 0, 187, 70, 3, base);
  g.box(72, 12, 3, 120, 68, 48, wall); quoins(g, 72, 12, 120, 68, 3, 46, white);
  g.box(71, 11, 24, 121, 69, 26, white); g.box(70, 10, 46, 122, 70, 49, white);
  g.box(70, 10, 48, 122, 70, 50, concrete(CN, 3, 12)); g.shape(69, 9, 49, 123, 71, 53, (x, y) => x < 71 || x > 121 || y < 11 || y > 69, flat(WH[3]));
  g.box(84, 16, 50, 96, 26, 58, flat(CN[3])); g.box(83, 15, 58, 97, 27, 59, flat(CN[2]));
  g.topPaint(84, 28, 108, 64, (x, y) => { const dx = Math.abs(x - 96), dy = Math.abs(y - 46); if (dx > 11 || dy > 11) return null; return (dx <= 3 && dy <= 9) || (dy <= 3 && dx <= 9) ? red : whiteP; });
  for (const [a, b] of [[8, 72], [120, 184]]) {
    g.box(a, 20, 3, b, 64, 30, wall); g.box(a, 20, 3, b, 64, 6, white); g.box(a - 1, 19, 28, b + 1, 65, 30, white);
    roofX(g, a === 8 ? 4 : 120, a === 8 ? 72 : 188, 14, 70, 30, 20, tile, { wall, w0: a, w1: b, inset: 6, barge: white, fascia: flat(WD[1]) });
    for (let x = a + 6; x < b - 6; x += 11) { win(g, 's', x, 63, 9, 6, 15, { frame: white }); win(g, 'n', x, 20, 9, 6, 15, { frame: white }); }
    g.cylZ(a + 32, 42, 1.6, 40, 52, darkSteel); g.cone(a + 32, 42, 3.2, .6, 52, 55, flat(ST[1]));
  }
  for (const [face, p] of [['w', 8], ['e', 183]]) { win(g, face, 28, p, 9, 8, 14, { frame: white }); win(g, face, 46, p, 9, 8, 14, { frame: white }); }
  for (const x of [76, 108]) { win(g, 's', x, 67, 9, 8, 12, { frame: white }); win(g, 's', x, 67, 31, 8, 12, { frame: white, box: trimGreen, seed: x }); }
  win(g, 's', 92, 67, 31, 8, 12, { frame: white });
  for (const x of [78, 92, 106]) { win(g, 'n', x, 12, 9, 8, 12, { frame: white }); win(g, 'n', x, 12, 31, 8, 12, { frame: white }); }
  chimney(g, 74, 20, 49, 72, 7, 7); chimney(g, 111, 20, 49, 72, 7, 7);
  // Ambulance canopy (shallow so the doors stay visible) with HOSPITAL fascia.
  doorOn(g, 's', 89, 67, 3, 14, 21, { leaf: planks(WH, 2, 4), frame: white }); g.box(95.5, 66, 3, 96.5, 67, 24, flat(WH[1]));
  g.box(80, 68, 24, 112, 80, 26, white); g.box(80, 79, 22, 112, 80, 30, white); g.box(80, 79, 22, 112, 80, 23, red);
  g.text('s', 81, 79, 28, 'HOSPITAL', RD[2]);
  for (const x of [81, 110]) g.box(x, 77, 3, x + 2, 79, 22, white);
  g.bitmap('s', 93, 67, 20 + 25, cross5, { r: RD[2] });
  steps(g, 86, 106, 70, 2, base, 1, 2, 2);
  // Ambulance bay markings, benches, wheelchair, beds and bushes.
  g.box(72, 74, 0, 120, 112, 1, concrete(CN, 3, 8));
  for (const x of [72, 119]) g.box(x, 82, 0, x + 1, 112, 1.2, flat(GD[3]));
  g.text('u', 78, 100, 0, 'AMBULANCE', GD[3]);
  for (const x of [20, 140]) bench(g, x, 65, 14);
  for (const y of [70, 74]) g.shape(52, y, 0, 60, y + 1, 8, (a, b, c) => { const d = Math.hypot(a - 56, c - 4); return d <= 3.6 && d >= 2.6; }, flat(TP[1]));
  g.box(53, 70, 4, 59, 75, 5, flat(CV[3])); g.box(53, 70, 5, 54, 75, 11, flat(CV[3]));
  bed(g, 8, 66, 18, 72, 4, [WH[4], RD[3]]); bed(g, 160, 66, 184, 72, 6, [WH[4], GD[3], RD[3]]);
  for (const [x, y] of [[4, 90], [188, 90], [64, 98], [128, 98]]) bush(g, x, y, 5, x + y, x % 3 ? FLOWERS : null);
  tufts(g, -6, -6, 198, 118, 15);
});

// ===== Chapel: white weatherboard nave, slate roof, front bell tower with spire, lancets, picket fence.
def('bld_chapel', 'World', [6, 9], 136, g => {
  const wall = aged(planks(WH, 4, 3), 23, .05, WD[2]), base = concrete(CN, 2), slate = mossy(rooftile(NV, 2, 'y'), .74, 22);
  g.box(18, 24, 0, 78, 122, 3, base);
  g.box(22, 28, 3, 74, 118, 34, wall);
  roofY(g, 20, 124, 15, 81, 34, 34, slate, { wall, w0: 28, w1: 118, inset: 7, barge: trimWhite, fascia: trimWhite });
  for (const y of [40, 58, 76, 94]) { lancet(g, 'w', y, 22, 9, 6, 15); lancet(g, 'e', y, 73, 9, 6, 15); }
  lancet(g, 'n', 44, 28, 10, 8, 16, { glass: mat((x, y, z) => [GL[1], RD[3], GD[3], NV[3]][(ix(x) + ix(z)) % 4], { flat: true }) });
  // Tower and spire.
  g.box(34, 112, 0, 62, 138, 3, base);
  g.box(36, 114, 3, 60, 136, 66, wall);
  g.box(35, 113, 64, 61, 137, 67, trimWhite); g.box(37, 115, 67, 59, 135, 82, wall); g.box(36, 114, 82, 60, 136, 84, trimWhite);
  for (const [face, p] of [['s', 134], ['n', 115], ['w', 37], ['e', 58]]) {
    const put = OUT(g, face, p), a0 = face === 's' || face === 'n' ? 41 : 119;
    for (let t = a0; t < a0 + 14; t++) for (let z = 69; z < 80; z++) { put(t, 0, z, z % 3 === 0 ? flat(WH[2]) : null); put(t, -1, z, z % 3 === 0 ? null : interior); }
  }
  g.pyramid(34, 112, 62, 138, 84, 36, slate);
  g.box(47.5, 124.5, 118, 48.5, 125.5, 130, flat(GD[2])); g.box(45, 124.5, 125, 51, 125.5, 126, flat(GD[2]));
  doorOn(g, 's', 42, 135, 3, 12, 24, { leaf: planks(RD, 1, 4), frame: trimWhite }); g.box(47.5, 134, 3, 48.5, 135, 27, flat(RD[0]));
  for (let k = 0; k < 4; k++) g.box(43 + k, 136, 27 + k, 53 - k, 137, 28 + k, trimWhite);
  g.cylY(48, 44, 4.5, 135, 137, trimWhite); g.cylY(48, 44, 3.5, 136.5, 137.5, mat((x, y, z) => ((ix(x) + ix(z)) & 1 ? RD[3] : GL[2]), { flat: true }));
  lancet(g, 's', 45, 135, 52, 6, 8);
  g.box(32, 136, 0, 64, 144, 1, stone(CN, 3, 4));
  steps(g, 40, 56, 138, 2, base, 1, 2, 2);
  lamp(g, 's', 39, 135, 18, trimWhite); lamp(g, 's', 57, 135, 18, trimWhite);
  // Picket fence with gate gap, sign, benches, yews and flower beds.
  fence(g, 0, 96, 143, 7, trimWhite, [36, 60]);
  for (const x of [4, 28]) g.box(x, 139, 0, x + 1, 140, 12, woodPost);
  board(g, 3, 140, 16, 26, 'CHAPEL', NV[2], flat(WH[4]), flat(NV[2]));
  for (const y of [124, 106]) { bed(g, 6, y, 20, y + 10, y); bed(g, 76, y, 90, y + 10, y + 1); }
  for (const [x, y] of [[8, 30], [88, 30], [12, 60], [84, 72]]) { g.ell(x, y, 9, 4.5, 4.5, 9, leaf(1, x)); g.cylZ(x, y, 1, 0, 2, woodDark); }
  bench(g, 4, 90, 14); bench(g, 78, 90, 14);
  tufts(g, -6, -6, 102, 150, 16);
});

// ===== Ablutions block: brick and render, ridge louvres, water tank on a stand, boiler flue, laundry.
def('bld_ablutions', 'World', [8, 5], 80, g => {
  const brk = aged(brick(BR, 2), 24), render = aged(mottled(WH, 3, 7, .74, .14), 25, .1, BR[2]), base = concrete(CN, 2), roof = mossy(tin(TN, 3, 'x', 16), .74, 24);
  g.box(6, 12, 0, 110, 64, 3, base);
  g.box(8, 14, 3, 108, 62, 30, render); g.box(8, 14, 3, 108, 62, 12, brk);
  roofX(g, 3, 113, 7, 69, 30, 20, roof, { wall: render, w0: 8, w1: 108, inset: 7, barge: flat(ST[3]), fascia: flat(ST[3]) });
  g.box(24, 34, 48, 92, 42, 54, flat(TN[3])); g.box(22, 32, 54, 94, 44, 56, flat(TN[2]));
  for (let x = 25; x < 92; x += 2) { g.box(x, 41, 49, x + 1, 42, 53, flat(TN[1])); g.box(x, 34, 49, x + 1, 35, 53, flat(TN[1])); }
  // Doors, frosted high windows, sign.
  const frost = mat(() => GL[2], { flat: true });
  for (const x of [26, 76]) { doorOn(g, 's', x, 61, 3, 10, 22, { leaf: planks(PT, 1, 4), frame: trimWhite }); g.box(x - 2, 62, 0, x + 12, 70, 1, planks(WD, 2, 2, 'x')); for (let y = 63; y < 70; y += 2) g.box(x - 2, y, 0, x + 12, y + 1, 1, null); }
  for (const x of [12, 42, 56, 92]) win(g, 's', x, 61, 19, 9, 6, { glass: frost });
  for (let x = 14; x < 104; x += 14) win(g, 'n', x, 14, 19, 9, 6, { glass: frost });
  for (const x of [93, 126]) g.box(x, 77, 0, x + 1, 78, 12, woodPost);
  board(g, 92, 78, 15, 36, 'ABLUTIONS', CR[3], blackPaint, trimWhite, 8);
  g.text('s', 26, 61, 30, 'MEN', TP[1]);
  lamp(g, 's', 50, 61, 18);
  // Water tank tower at the east end.
  for (const [x, y] of [[112, 20], [124, 20], [112, 34], [124, 34]]) g.box(x, y, 0, x + 2, y + 2, 34, woodPost);
  for (const z of [10, 22]) { g.box(112, 20, z, 126, 22, z + 1, woodDark); g.box(112, 34, z, 126, 36, z + 1, woodDark); }
  g.box(110, 18, 34, 128, 38, 36, planks(WD, 2, 2)); g.cylZ(119, 28, 8, 36, 50, mottled(ST, 2, 5, .7, .3)); g.cylZ(119, 28, 8.4, 43, 44, flat(ST[1])); g.cone(119, 28, 8.5, 1, 50, 53, flat(ST[3]));
  g.line(112, 28, 36, 108, 28, 24, darkSteel, .6); ladder(g, 126, 22, 36);
  // Boiler flue (smoke overlay), coal bunker.
  g.cylZ(14, 24, 2.2, 30, 64, darkSteel); g.cylZ(14, 24, 2.8, 62, 64, flat(ST[1]));
  for (const z of [40, 52]) g.line(14, 24, z, 8, 12, z - 8, darkSteel);
  g.box(-2, 20, 0, 8, 40, 9, brk); g.box(-3, 19, 9, 8, 41, 10, flat(CN[3]));
  // Laundry yard: lines, tubs, mangle.
  washing(g, 4, 58, 76, 18);
  for (const x of [66, 76]) { g.cylZ(x, 72, 4, 0, 6, planks(WD, 2, 2)); g.cylZ(x, 72, 3.2, 5.5, 6, flat(GL[2])); }
  g.box(88, 68, 0, 90, 76, 14, darkSteel); g.box(100, 68, 0, 102, 76, 14, darkSteel); for (const z of [9, 12.5]) g.cylX(72, z, 1.8, 89, 101, flat(CR[2])); g.line(102, 72, 13, 106, 72, 17, darkSteel); g.cylY(106, 17, 2.5, 71, 72, flat(ST[3]));
  bush(g, 3, 66, 3.5, 5, FLOWERS);
  tufts(g, -6, -6, 134, 86, 17);
}, { frames: 4, fps: 6, overlay: smokeOverlay(14, 24, 65, 26) });

// ===== Post office: red brick, shop window, POST OFFICE fascia, pillar box and telephone kiosk.
def('bld_post_office', 'World', [6, 5], 84, g => {
  const wall = aged(brick(BR, 2), 26), base = concrete(CN, 2), slate = mossy(rooftile(NV, 2, 'x'), .74, 26), cream = aged(flat(CR[2]), 9);
  g.box(6, 14, 0, 90, 64, 3, base);
  g.box(8, 16, 3, 88, 62, 34, wall); g.box(7, 15, 32, 89, 63, 35, cream);
  quoins(g, 8, 16, 88, 62, 3, 32, cream);
  roofX(g, 3, 93, 11, 67, 35, 24, slate, { wall, w0: 8, w1: 88, inset: 5, barge: cream, fascia: flat(RD[1]) });
  chimney(g, 66, 26, 44, 70, 8, 7);
  // Shop front.
  g.box(10, 62, 3, 86, 64, 6, flat(RD[1]));
  windowOn(g, 's', 13, 61, 7, 26, 12, { frame: flat(RD[1]) });
  for (const x of [19, 32]) g.box(x, 60, 7, x + 1, 61, 19, flat(RD[1]));
  for (const [x, c] of [[15, CR[3]], [24, GD[2]], [28, RD[3]], [36, CR[2]]]) g.box(x, 59, 7, x + 3, 60, 10, flat(c));
  doorOn(g, 's', 44, 61, 3, 10, 18, { leaf: planks(RD, 1, 4), frame: flat(RD[1]) }); g.box(45, 60, 13, 53, 61, 18, glass);
  windowOn(g, 's', 60, 61, 7, 22, 12, { frame: flat(RD[1]) }); g.box(70.5, 60, 7, 71.5, 61, 19, flat(RD[1]));
  board(g, 12, 63, 29, 72, 'POST OFFICE', GD[3], flat(RD[1]), flat(GD[2]));
  g.box(55, 62, 9, 67, 63, 16, flat(NV[2])); g.text('s', 56, 62, 14, 'GPO', CR[3]); g.box(55, 62, 15, 67, 63, 16, trimWhite);
  for (const x of [41, 57]) { g.box(x, 62, 19, x + 1, 66, 20, darkSteel); g.ell(x + .5, 66, 15, 2.5, 2.5, 2.5, bloom(x, FLOWERS, .3)); g.line(x + .5, 65, 19, x + .5, 66, 17, flat(TP[1])); }
  for (const x of [80, 52, 24]) win(g, 'n', x, 16, 12, 10, 12, { box: trimGreen, seed: x });
  for (const [face, p] of [['w', 8], ['e', 87]]) win(g, face, 34, p, 12, 9, 12, { shutters: trimGreen });
  // Pillar box, telephone kiosk, mail sacks, bikes.
  g.cylZ(8, 72, 3, 0, 2, flat(TP[1])); g.cylZ(8, 72, 2.7, 2, 14, redPaint); g.ell(8, 72, 14, 3, 3, 2.3, redPaint); g.box(6.5, 74.5, 10, 9.5, 75, 11, flat(TP[0]));
  const ph = mat((x, y, z, f) => RD[2]);
  g.box(74, 66, 0, 84, 76, 1, flat(CN[3]));
  g.box(75, 67, 1, 83, 75, 27, ph); g.ell(79, 71, 27, 4.5, 4.5, 3, ph);
  for (const face of ['s', 'e', 'w']) { const put = face === 's' ? OUT(g, 's', 74) : OUT(g, face, face === 'e' ? 82 : 75); const a0 = face === 's' ? 76 : 68; for (let t = a0; t < a0 + 6; t++) for (let z = 6; z < 22; z++) if ((t - a0) % 3 !== 2 && (z - 6) % 4 !== 3) put(t, 0, z, glass); }
  g.box(76, 74, 22, 82, 75, 25, flat(CR[3])); g.text('s', 76, 74, 24, 'TEL', TP[1]);
  for (const [x, y] of [[54, 66], [58, 67], [56, 70]]) g.ell(x, y, 3, 3, 2.4, 3.2, sandbag(CR, 1));
  bike(g, 22, 64);
  bush(g, 92, 20, 4, 8, FLOWERS); bush(g, 2, 20, 3.5, 2);
  tufts(g, -6, -6, 102, 86, 18);
});

// ===== Thatched cottage: whitewash over a stone plinth, deep straw roof, roses, picket fence, smoke.
def('bld_cottage_thatch', 'World', [6, 5], 86, g => {
  const wall = aged(mottled(WH, 3, 8, .74, .16), 27), plinth = stone(CN, 2, 5), th = thatch(2);
  g.box(10, 16, 0, 86, 62, 4, plinth);
  g.box(12, 18, 4, 84, 60, 28, wall);
  roofX(g, 5, 91, 8, 70, 26, 32, th, { thick: 6, wall, w0: 12, w1: 84, inset: 8 });
  g.box(5, 37, 54, 91, 42, 58, thatch(1, 'x'));
  for (let x = 6; x < 90; x += 6) g.shape(x, 34, 50, x + 6, 45, 55, (a, b, c) => Math.hypot(a - x - 3, (Math.abs(b - 39.5) - 3)) < 3.5 && c < 54 && c >= 51, thatch(1, 'x'));
  chimney(g, 74, 34, 22, 68, 8, 8, stone(CN, 3, 6));
  // Eyebrow dormer.
  g.ell(48, 58, 40, 9, 6, 7, th); g.erase(43, 62, 34, 53, 66, 42); g.box(43, 61, 34, 53, 62, 42, wall);
  windowOn(g, 's', 45, 61, 35, 6, 5, { frame: flat(WD[1]) });
  // Door with little gabled hood, casement windows with boxes, roses.
  doorOn(g, 's', 43, 59, 4, 10, 22, { leaf: planks(NV, 3, 4), frame: flat(WD[1]) });
  roofY(g, 58, 66, 39, 57, 26, 6, rooftile(RD, 2, 'y'), { thick: 2 });
  for (const x of [40, 55]) g.line(x, 60, 21, x, 64, 26, woodDark);
  for (const x of [20, 64]) win(g, 's', x, 59, 11, 10, 9, { frame: flat(WD[1]), box: flat(PT[1]), seed: x });
  for (const x of [26, 64]) win(g, 'n', x, 18, 12, 10, 9, { frame: flat(WD[1]) });
  for (const [face, p] of [['w', 12], ['e', 83]]) win(g, face, 34, p, 12, 8, 9, { frame: flat(WD[1]) });
  const rose = bloom(28, [RD[3], RD[4], CR[3]], .2);
  g.shape(34, 60, 0, 41, 62, 24, (x, y, z) => hash(ix(x), ix(z), 6) < .6 - z * .015, rose); g.shape(55, 60, 0, 61, 62, 22, (x, y, z) => hash(ix(x), ix(z), 7) < .6 - z * .015, rose);
  // Garden: path, picket fence with gate, beds, water butt, wheelbarrow, vegetable rows.
  g.box(42, 62, 0, 54, 80, 1, stone(CN, 3, 8));
  fence(g, 0, 96, 76, 7, trimWhite, [42, 54]);
  bed(g, 4, 64, 40, 72, 31); bed(g, 56, 64, 92, 72, 32, [GD[3], CR[3], NV[4]]);
  g.cylZ(8, 56, 3.5, 0, 10, planks(WD, 2, 2)); g.cylZ(8, 56, 3.8, 3, 4, darkSteel); g.cylZ(8, 56, 3.8, 7, 8, darkSteel);
  g.box(88, 40, 3, 96, 48, 6, flat(GR[3])); g.box(88, 40, 6, 96, 48, 7, flat(OL[3])); g.cylY(92, 3, 2.5, 47, 48, flat(TP[1])); for (const x of [88.5, 95.5]) g.line(x, 40, 5, x, 32, 2, woodDark);
  for (let y = 4; y < 14; y += 4) { g.box(10, y, 0, 60, y + 2, 1, earth(2)); for (let x = 12; x < 58; x += 4) g.ell(x, y + 1, 1.5, 1.6, 1.4, 1.6, leaf(4, x)); }
  bush(g, 2, 30, 4.5, 9); bush(g, 92, 20, 4, 3, FLOWERS);
  tufts(g, -6, -6, 102, 86, 19);
}, { frames: 4, fps: 6, overlay: smokeOverlay(78, 38, 71, 26) });

// ===== Stone cottage: two storeys, slate roof, end chimneys, gabled porch, dry-stone garden wall.
def('bld_cottage_stone', 'World', [7, 5], 96, g => {
  const wall = stone(CN, 3, 9), slate = mossy(rooftile(TN, 2, 'x'), .72, 29), trim = flat(CR[3]);
  g.box(8, 14, 0, 104, 62, 3, stone(CN, 2, 3));
  g.box(10, 16, 3, 102, 60, 46, wall);
  roofX(g, 4, 108, 8, 68, 46, 26, slate, { wall, w0: 10, w1: 102, inset: 8, barge: flat(WD[1]), fascia: flat(WD[1]) });
  chimney(g, 6, 34, 30, 80, 8, 9, stone(CN, 3, 1)); chimney(g, 98, 34, 30, 76, 8, 9, stone(CN, 3, 7));
  // Porch.
  g.box(48, 60, 3, 64, 70, 24, wall); g.erase(50, 62, 3, 62, 70, 22);
  roofY(g, 58, 73, 45, 67, 24, 9, slate, { wall, w0: 60, w1: 70, inset: 3, barge: flat(WD[1]), fascia: flat(WD[1]) });
  g.box(50, 62, 3, 62, 70, 4, stone(CN, 3, 2));
  doorOn(g, 's', 51, 59, 3, 10, 22, { leaf: planks(GR, 2, 4), frame: trim });
  for (const x of [52, 59]) g.ell(x, 68, 6, 2, 2, 3, bloom(x, FLOWERS, .3));
  for (const x of [18, 32, 74, 88]) win(g, 's', x, 59, 9, 9, 11, { frame: trim, box: x < 40 ? flat(PT[1]) : null, seed: x });
  for (const x of [22, 72]) win(g, 's', x, 59, 30, 9, 10, { frame: trim });
  win(g, 's', 50, 59, 31, 12, 9, { frame: trim });
  for (const x of [24, 50, 76]) { win(g, 'n', x, 16, 10, 9, 11, { frame: trim }); win(g, 'n', x, 16, 30, 9, 10, { frame: trim }); }
  for (const [face, p] of [['w', 10], ['e', 101]]) win(g, face, 22, p, 12, 8, 10, { frame: trim });
  // Dry-stone wall with gate gap, log pile, hollyhocks, bench, well.
  for (const [a, b] of [[0, 48], [64, 112]]) { g.box(a, 72, 0, b, 77, 6, stone(CN, 2, a + 3)); g.box(a, 72, 6, b, 77, 7, flat(CN[3])); }
  g.box(48, 62, 0, 64, 80, 1, stone(CN, 3, 8));
  const logEnd = mat((x, y, z, f) => (f === 's' || f === 'n' ? SN[3] : WD[2]));
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) g.cylY(105 + k * 3.2 + r * 1.6, 1.6 + r * 2.8, 1.6, 38, 54, logEnd);
  for (const x of [12, 18, 24, 36, 42]) { g.box(x, 66, 0, x + 1, 67, 16 + (x % 5), leaf(3, x)); g.ell(x + .5, 66.5, 12 + (x % 5), 1.6, 1.6, 4, bloom(x, [RD[4], NV[4], CR[3]], .45)); }
  bench(g, 70, 63, 14);
  g.cylZ(104, 67, 4.5, 0, 8, stone(CN, 3, 4)); g.cylZ(104, 67, 3.2, 2, 8, null); g.cylZ(104, 67, 3, 4, 5, flat(GL[0]));
  for (const x of [99.5, 108.5]) g.box(x - .5, 66.5, 8, x + .5, 67.5, 18, woodPost); g.gableX(98, 110, 62.5, 71.5, 18, 5, slate); g.cylX(67, 15, 1, 99, 109, woodDark);
  bush(g, 4, 66, 4, 10, FLOWERS); bush(g, 108, 30, 4.5, 11);
  tufts(g, -6, -6, 118, 92, 20);
}, { frames: 4, fps: 6, overlay: smokeOverlay(10, 38.5, 83, 28) });

// ===== MT garage: brick piers, three bays (open with lorry, roller half up, closed), petrol pump.
def('bld_garage', 'World', [8, 6], 74, g => {
  const wall = aged(brick(BR, 2), 30), base = concrete(CN, 2), roof = mossy(tin(TN, 3, 'y', 16), .74, 30), apron = (() => { const b = concrete(CN, 3); return mat((x, y, z, f) => (f === 'u' && fbm(x * .08, y * .08, 9) > .67 ? CN[1] : b.fn(x, y, z, f))); })();
  g.box(2, 70, 0, 126, 96, 1, apron);
  g.box(4, 12, 0, 124, 72, 2, base);
  g.box(6, 14, 2, 122, 70, 38, wall);
  roofX(g, 2, 126, 10, 74, 38, 16, roof, { wall, w0: 6, w1: 122, inset: 4, barge: flat(ST[3]), fascia: flat(OL[1]) });
  g.box(43, 69, 26, 85, 70, 34, flat(OL[1])); g.text('s', 45, 69, 32, 'MT SECTION', CR[3]); g.box(43, 70, 26, 85, 71, 27, flat(GD[2]));
  // Bay 1: open, lorry front inside.
  g.erase(12, 52, 2, 40, 70, 26); g.box(12, 51, 2, 40, 52, 26, interior); g.box(12, 52, 2, 40, 70, 2.5, flat(CN[1]));
  const ol = mottled(OL, 2, 31, .66, .2);
  g.box(15, 54, 4, 37, 66, 18, ol); g.box(17, 64, 18, 35, 67, 24, ol); g.box(18, 66, 19, 34, 67, 23, mat(() => GL[1], { flat: true }));
  g.box(20, 66, 6, 32, 67, 16, flat(OL[1])); for (let x = 21; x < 32; x += 2) g.box(x, 66.5, 7, x + 1, 67.5, 15, flat(ST[2]));
  for (const x of [17, 34]) { g.cylY(x + .5, 13, 2, 66, 67.5, glow(GD[3])); g.cylY(x + .5, 5, 3.5, 60, 66, rubber); }
  g.text('s', 22, 66, 5, 'RAF', CR[3]);
  // Bay 2: roller door half up.
  g.erase(50, 52, 2, 78, 70, 26); g.box(50, 51, 2, 78, 52, 26, interior); g.box(50, 52, 2, 78, 70, 2.5, flat(CN[1]));
  g.box(50, 68, 12, 78, 70, 26, aged(tin(OL, 2, 'y', 30), 3)); g.box(50, 69, 12, 78, 70, 13, darkSteel);
  g.cylZ(56, 60, 2.4, 2, 11, flat(RD[2])); for (const x of [64, 70]) g.box(x, 58, 2, x + 4, 66, 9, flat(OL[2]));
  // Bay 3: closed timber doors.
  g.box(88, 68, 2, 116, 70, 26, aged(planks(OL, 2, 4, 'x'), 7)); g.box(101.5, 69, 2, 102.5, 70, 26, flat(OL[1]));
  for (const z of [6, 20]) g.box(88, 69.5, z, 116, 70.5, z + 1, flat(OL[1]));
  for (let k = 0; k < 10; k++) g.line(88 + k * 1.3, 69.6, 6 + k * 1.4, 88 + k * 1.3, 69.6, 6 + k * 1.4, flat(OL[1]));
  g.text('s', 63, 69, 22, '2', CR[3]); g.text('s', 99, 69, 18, '3', CR[3], 2);
  for (const x of [44, 82]) lamp(g, 's', x - 3, 69, 22);
  win(g, 'w', 30, 6, 12, 12, 8, { tape: true }); doorOn(g, 'e', 40, 121, 2, 10, 22, { leaf: aged(tin(OL, 2, 'y'), 5) }); win(g, 'e', 24, 121, 12, 10, 8);
  for (let x = 16; x < 116; x += 20) win(g, 'n', x, 14, 16, 10, 7, { tape: x === 56 });
  // Petrol pump, drums, jerrycans, tyres, oil stain, trolley jack.
  g.box(116, 80, 1, 124, 86, 3, flat(CN[3])); g.box(117, 81, 3, 123, 85, 20, redPaint); g.box(118, 84.5, 10, 122, 85.5, 16, flat(CR[3]));
  g.ell(120, 83, 23, 3, 3, 3.5, glow(CR[3])); g.box(117, 81, 20, 123, 85, 21, flat(RD[1])); g.line(117, 83, 14, 112, 86, 4, flat(TP[1])); g.text('s', 118, 85, 15, 'P', RD[2]);
  for (const [x, y, R] of [[4, 78, OL], [9, 80, OL], [4, 84, RD], [9, 86, OL]]) drum(g, x, y, R, 2, 1);
  for (const x of [18, 23, 28]) { g.box(x, 74, 1, x + 4, 76, 10, flat(OL[3])); g.box(x + 1, 74, 9, x + 3, 76, 11, flat(OL[2])); g.line(x, 76, 2, x + 4, 76, 9, flat(OL[2])); }
  for (let k = 0; k < 4; k++) g.cylZ(127, 30, 4.2, 2 + k * 3, 5 + k * 3, rubber);
  g.cylZ(127, 30, 2, 2, 14, null);
  g.box(90, 80, 1, 102, 84, 3, flat(RD[2])); g.line(90, 82, 3, 82, 82, 10, darkSteel);
  tufts(g, -6, -6, 134, 102, 21);
});

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

'use strict';
// The opening's biscuit tin as 3D objects for scene3d: body, hinged lid (opens to 105 deg) and the
// six things kept inside, all present in every ending and none dating the scene or telling whose
// fate it is: closed pocket watch, small wooden music box with its key, worn leather notebook
// (the book of promises), small red notebook, a dried tulip bulb wrapped in a white handkerchief,
// a yellowed sheet folded in four. Nothing carries readable writing.
// Also: the scene light, the window patch on the table and the per-object shading.
const { fbm, hash, tone, clamp, SW, TABLE, TIN_P, TIN_O, TIN_M, RUST, HAND, WOOL, PAPER, LINEN, hex } = require('./common.cjs');
const { K, capsule, sphere, ellipsoid, rrect, extrude, smin, len2, len3, rotZ } = require('./scene3d.cjs');
const RR = (...h) => h.map(c => hex(c));

const LEATHER = RR('#140c08', '#24170f', '#382417', '#4f3421', '#69472d', '#86603d');
const REDB = RR('#260b0a', '#431412', '#64201b', '#872f25', '#a74333', '#c25c45');
const BRASS = RR('#2e200c', '#523a15', '#7a5a22', '#a37f35', '#c9a352', '#e6c97f', '#f8ecc0');
const WOODB = RR('#22130a', '#3b2111', '#58331a', '#784824', '#975f30', '#b27a43');
const BULB = RR('#2e1d10', '#4d321c', '#6f4c2d', '#916a43', '#b38c60', '#cfae84');
const TIN_I = RR('#2f3437', '#4a5154', '#5f6568', '#7e8588', '#9aa0a3', '#b4b9bb', '#c8ccce', '#e4e8e8');
const NAIL = RR('#6e4a40', '#956a5d', '#b88d7d', '#d2ab9a', '#e6c6b6', '#f3dccd');
const FLUSH = RR('#55322a', '#80503f', '#a46c59', '#c28872', '#d9a68f', '#ebc4ad');    // knuckles and fingertips: blood close under thin skin
const VEIN = RR('#4f3b38', '#725853', '#93766e', '#b09287', '#c8aa9d');               // dorsal veins: a shade darker and cooler than the skin
const OUTLINE = [9, 16, 17, 255];

// ---------------------------------------------------------------- light
const L = (() => { const v = [-.7, -.18, .69], l = Math.hypot(...v); return v.map(c => c / l); })();
// The window throws a skewed four-pane patch of grey daylight on the table: p = O + u*A + v*B.
const WO = [-46, 20], WA = [372, -31], WB = [118, 236];
const WDET = WA[0] * WB[1] - WA[1] * WB[0];
function winUV(x, y) { const px = x - WO[0], py = y - WO[1]; return [(px * WB[1] - py * WB[0]) / WDET, (WA[0] * py - WA[1] * px) / WDET]; }
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
function winLight(x, y) {
  const [u, v] = winUV(x, y);
  const e = Math.min(u, 1 - u, v, 1 - v) * 300, bar = Math.min(Math.abs(u - .5) * 372 - 5, Math.abs(v - .52) * 256 - 6);
  return smooth(Math.min(e, bar) / 7 + .5);
}
// Where the window ray through (x, y, z) lands on the table: the patch bends over the objects.
const onTable = (x, y, z) => [x - L[0] * z / L[2], y - L[1] * z / L[2]];
// Light value at a G-buffer cell (0 dark .. ~1 bright).
function lightAt(c) {
  const [tx, ty] = onTable(c.x, c.y, c.z), [u] = winUV(tx, ty);
  const amb = (.16 + .1 * (1 - c.x / SW)) * (.5 + .5 * c.ao) * (.78 + .22 * c.n[2]);
  const direct = Math.max(0, c.ndl) / L[2];
  return amb + winLight(tx, ty) * (.5 - .16 * clamp(u)) * Math.min(1.25, direct) * c.sh * (.6 + .4 * c.ao);
}
const VIEW = [0, K / Math.hypot(K, 1), 1 / Math.hypot(K, 1)];
function spec(c, p = 24) {
  const H = [L[0] + VIEW[0], L[1] + VIEW[1], L[2] + VIEW[2]], hl = Math.hypot(...H);
  return Math.pow(Math.max(0, (c.n[0] * H[0] + c.n[1] * H[1] + c.n[2] * H[2]) / hl), p) * c.sh;
}

// ---------------------------------------------------------------- geometry
const CX = 240, CY = 170, HX = 80, HY = 52, RC = 10, BH = 48;        // body: 160 x 104 x 48
const LZ0 = 44, LZ1 = 58, HINGE_Y = CY - HY - 2.5, HINGE_Z = 52;      // lid skirt 44..58
const LIDTOP = LZ1;
function bodySdf(x, y, z) {
  const u = x - CX, v = y - CY;
  const outer = extrude(rrect(u, v, HX, HY, RC), z, 0, BH - 1);
  const inner = extrude(rrect(u, v, HX - 2, HY - 2, RC - 2), z, 3, 90);
  const bead = len2(rrect(u, v, HX - 1, HY - 1, RC - 1), z - (BH - 1.4)) - 1.6;      // rolled top rim
  return Math.min(Math.max(outer, -inner), bead);
}
const lidLocal = (x, y, z, th) => {            // world -> closed-lid coordinates (u, v about the tin centre, z)
  const Y = y - HINGE_Y, Z = z - HINGE_Z, c = Math.cos(th), s = Math.sin(th);
  return [x - CX, Y * c + Z * s + HINGE_Y - CY, -Y * s + Z * c + HINGE_Z];
};
const lidWorld = (u, v, z, th) => {
  const Y = v + CY - HINGE_Y, Z = z - HINGE_Z, c = Math.cos(th), s = Math.sin(th);
  return [u + CX, Y * c - Z * s + HINGE_Y, Y * s + Z * c + HINGE_Z];
};
function lidSdfLocal(u, v, z) {
  const outer = extrude(rrect(u, v, HX + 2.5, HY + 2.5, RC + 2.5), z, LZ0 + 1, LZ1);
  const inner = extrude(rrect(u, v, HX + .5, HY + .5, RC + .5), z, 20, LZ1 - 2);
  const bead = len2(rrect(u, v, HX + 1.5, HY + 1.5, RC + 1.5), z - (LZ0 + 1.4)) - 1.4;   // rolled lower edge of the skirt
  return Math.min(Math.max(outer, -inner), bead);
}
function lidObj(deg) {
  const th = deg * Math.PI / 180;
  const corners = [];
  for (const u of [-HX - 4, HX + 4]) for (const v of [-HY - 4, HY + 4]) for (const z of [LZ0 - 2, LZ1 + 2]) corners.push(lidWorld(u, v, z, th));
  const box = [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]))).concat([0, 1, 2].map(i => Math.max(...corners.map(p => p[i]))));
  return { id: 'lid', th, box, sdf: (x, y, z) => { const [u, v, w] = lidLocal(x, y, z, th); return lidSdfLocal(u, v, w); } };
}
const body = { id: 'body', box: [CX - HX - 1, CY - HY - 1, 0, CX + HX + 1, CY + HY + 1, BH + 1] , sdf: bodySdf };

// Items: tin-local centre (u, v), rotation (deg), local sdf(a, b, z) in the item frame.
function item(id, cu, cv, deg, sdf, ext) {
  const r = -deg * Math.PI / 180;
  const loc = (x, y) => rotZ(x - CX - cu, y - CY - cv, r);
  return { id, box: [CX + cu - ext[0], CY + cv - ext[1], ext[2], CX + cu + ext[0], CY + cv + ext[1], ext[3]], sdf: (x, y, z) => { const [a, b] = loc(x, y); return sdf(a, b, z); }, loc };
}
const BOOK = [-34, 8, -6, 40, 28], RED = [-30, 13, 13, 26, 18], PAPR = [36, -24, 5, 31, 22], WATCH = [40, -22, -30, 13], MBOX = [50, 16, -8, 18, 13], BUND = [3, -28, 18];
const items = [
  item('book', BOOK[0], BOOK[1], BOOK[2], (a, b, z) => extrude(rrect(a, b, BOOK[3], BOOK[4], 3), z, 3, 13) - .6, [48, 40, 2, 15]),
  item('redbook', RED[0], RED[1], RED[2], (a, b, z) => extrude(rrect(a, b, RED[3], RED[4], 2), z, 13, 19) - .4, [34, 30, 11, 21]),
  item('paper', PAPR[0], PAPR[1], PAPR[2], (a, b, z) => extrude(rrect(a, b, PAPR[3], PAPR[4], 1), z, 3, 4.4 + 1.6 * clamp(1 - Math.abs(a) / 20)), [36, 28, 2, 8]),
  item('watch', WATCH[0], WATCH[1], WATCH[2], (a, b, z) => {
    let d = extrude(len2(a, b) - WATCH[3] + 2, z, 6, 11) - 2;                                   // domed hunter case
    d = Math.min(d, capsule(a, b, z, 0, -WATCH[3] + 1, 9, 0, -WATCH[3] - 3, 9, 2.2));          // pendant and crown
    d = Math.min(d, len2(len2(a, b + WATCH[3] + 6.5) - 4, z - 8.6) - 1.2);                       // bow ring, lying flat
    return d;
  }, [26, 26, 3, 14]),
  item('mbox', MBOX[0], MBOX[1], MBOX[2], (a, b, z) => {
    let d = extrude(rrect(a, b, MBOX[3], MBOX[4], 2), z, 3, 26) - .5;
    d = Math.max(d, -(len2(Math.max(Math.abs(b) - MBOX[4] + .2, 0), z - 19.5) - .6));          // lid seam groove
    d = Math.min(d, capsule(a, b, z, -MBOX[3], 1, 14, -MBOX[3] - 5, 1, 14, 1.2));               // winding key: shaft
    d = Math.min(d, ellipsoid(a + MBOX[3] + 6, b - 1, z - 14, 1.1, 4.6, 3));                       // and its bow
    return d;
  }, [28, 24, 2, 28]),
  // White handkerchief opened out (a diamond with a rolled hem), the bulb in the middle with one
  // flap of the cloth still folded up round its front.
  item('bundle', BUND[0], BUND[1], BUND[2], (a, b, z) => {
    const [p, q] = rotZ(a, b, Math.PI / 4), wave = fbm(a * .12 + 4, b * .12, 211) * 2.6;
    let d = extrude(rrect(p, q, 19, 19, 3), z, 3, 4.6 + wave);
    const bulb = bulbSdf(a, b, z);
    const flap = Math.max(Math.abs(ellipsoid(a - BULB_C[0], b - BULB_C[1], z - BULB_C[2], 11.4, 10.8, 9.4)) - .9, -(b - 1.5 + Math.sin(a * .5) * 1.5), z - BULB_C[2] - 2);
    d = Math.min(d, flap);
    return Math.min(d, bulb);
  }, [30, 30, 2, 34])
];
const BULB_C = [0, -1, 12.5];
function bulbSdf(a, b, z) { return smin(ellipsoid(a - BULB_C[0], b - BULB_C[1], z - BULB_C[2], 10, 9.4, 8.2), capsule(a, b, z, 0, -1, 18, 2, -4, 31, 3.6, .6), 3); }
const itemById = Object.fromEntries(items.map(o => [o.id, o]));

// Old print layout (the ornament, the medallion, the wear map were drawn on a 188 x 114 lid).
const PR = { x0: 146, y0: 82, x1: 334, y1: 196 };
function lidPrint(x, v) {
  const cx = (PR.x0 + PR.x1) / 2, cy = (PR.y0 + PR.y1) / 2, dx = x + .5 - cx, dy = v + .5 - cy;
  const ex = Math.min(x - PR.x0, PR.x1 - 1 - x), ey = Math.min(v - PR.y0, PR.y1 - 1 - v), e = Math.min(ex, ey);
  if (e === 7 || e === 8 || e === 11) return ex > 9 || ey > 9 ? 'o' : 'p';
  const fan = Math.hypot(ex - 12, ey - 12);
  if (ex >= 12 && ey >= 12 && fan < 15) { const a = Math.atan2(ey - 12, ex - 12); return fan > 13 || (fan > 3 && Math.floor(a * 7 / (Math.PI / 2)) % 2 === 0) ? 'o' : 'p'; }
  const m = Math.hypot(dx / 58, dy / 31);
  if (m > .93 && m <= 1) return 'o';
  if (m > 1 && m < 1.09 && Math.floor(Math.atan2(dy, dx * .53) * 22 / Math.PI) % 2 === 0) return 'o';
  if (m <= .93) {
    const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (r < 3.2) return 'o';
    if (r < 13 && r > 4.5 && Math.abs(Math.sin(a * 4)) * r > r - 2.6 + (r > 10 ? 2.4 : 0)) return 'o';
    for (const s of [-1, 1]) {
      const lx = dx * s - 16;
      if (lx > 0 && lx < 30) { const stem = Math.sin(lx * .18) * 5; if (Math.abs(dy - stem) < .8) return 'o'; const k = Math.floor(lx / 7); const ly = dy - stem - (k % 2 ? 4.5 : -4.5), lxx = lx - k * 7 - 3.5; if (k < 4 && (lxx / 3.4) ** 2 + (ly / 2.6) ** 2 < 1) return 'o'; }
    }
    return 'P';
  }
  return 'p';
}
function wear(x, y, edge) {
  const n = fbm(x * .09 + 3, y * .09 + 7, 91) + (edge < 6 ? (6 - edge) * .045 : 0) + (fbm(x * .3, y * .3, 97) - .5) * .25;
  for (const [ax, ay, bx, by] of [[176, 112, 232, 100], [262, 168, 301, 181], [205, 150, 216, 176]]) if (Math.hypot(...((t => [x + .5 - ax - (bx - ax) * t, y + .5 - ay - (by - ay) * t])(clamp(((x + .5 - ax) * (bx - ax) + (y + .5 - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))))) < .7) return 2;
  return n > .7 ? 2 : n > .665 ? 1 : 0;
}
const toPrint = (u, v) => [Math.floor(240 + u * 94 / (HX + 2.5)), Math.floor(139 + v * 57 / (HY + 2.5))];

// ---------------------------------------------------------------- shading
// Returns { col, L, key } for a G-buffer cell at screen (sx, sy). key identifies the surface so
// layers can tell "same thing, only darker" (shadow) from "something new".
function shadeCell(c, sx, sy, sceneObjs) {
  const Lv = lightAt(c), o = c.o;
  if (!o) return { col: tone(TABLE, Lv + grainTable(c.x, c.y) * .1 - cupRing(c.x, c.y), sx, sy, .8), L: Lv, key: 'table' };
  const id = o.id;
  if (id === 'body') {
    const u = c.x - CX, v = c.y - CY, inside = rrect(u, v, HX - 1, HY - 1, RC - 1) < 0 && c.z < BH - 2.6;
    if (c.z > BH - 3.2) return { col: tone(TIN_M, Lv * 1.15 + .12 + spec(c) * .6, sx, sy), L: Lv, key: 'rim' };
    if (inside) return { col: tone(TIN_I, Lv * 1.05 + spec(c, 16) * .4 + (fbm(c.x * .3, c.y * .3 + c.z, 7) > .74 ? -.08 : 0), sx, sy, .6), L: Lv, key: 'inner' };
    // Outer side: band the lid covered (rubbed bright), gilt bands, lattice print, rusty foot.
    const d = BH - c.z, n = fbm(c.x * .14, d * .4, 71), edge = Math.abs(u) > HX - 6 && Math.abs(v) > HY - 6;
    let col;
    const Lb = Lv * 1.15 + .1;
    if (d < 13) col = tone(TIN_M, Lb * .6 + n * .14, sx, sy);
    else if (c.z < 3) col = tone(RUST, Lb * .7 + n * .35, sx, sy, 1.5);
    else if (n > .72) col = tone(TIN_M, Lb * .5, sx, sy);
    else if (d === 22 || Math.abs(d - 22.5) < 1 || Math.abs(c.z - 7) < 1) col = tone(TIN_O, Lb * .62, sx, sy);
    else if (d > 24 && c.z > 8 && ((Math.floor(c.x) + Math.floor(d)) % 12 < 2 || (Math.floor(c.x) - Math.floor(d) + 240) % 12 < 2)) col = tone(TIN_O, Lb * .5, sx, sy);
    else col = tone(TIN_P, Lb * .55, sx, sy);
    if (edge) col = tone(TIN_P, Lb * .5, sx, sy);
    return { col, L: Lv, key: 'side' };
  }
  if (id === 'lid') {
    const [u, v, z] = lidLocal(c.x, c.y, c.z, o.th);
    const outerSkirt = rrect(u, v, HX + 1.5, HY + 1.5, RC + 1.5) > 0;
    const Lb = Lv * 1.18 + .1;
    if (z > LZ1 - .8 && outerSkirt === false && rrect(u, v, HX + 2, HY + 2, RC + 2) < 0) {
      // Printed outer face.
      const [px, pv] = toPrint(u, v), e = Math.min(px - PR.x0, PR.x1 - 1 - px, pv - PR.y0, PR.y1 - 1 - pv), w = wear(px, pv, e), k = lidPrint(px, pv);
      let col;
      if (e <= 1) col = tone(TIN_M, Lb * (u < -HX + 2 || v < -HY + 2 ? 1.2 : .72) + spec(c) * .5, sx, sy);
      else if (e === 2) col = tone(TIN_P, Lb * .45, sx, sy);
      else if (w === 2) col = tone(TIN_M, Lb * .78 + (fbm(px * .5, pv * .5, 5) - .5) * .2 + spec(c) * .4, sx, sy);
      else if (w === 1) col = tone(RUST, Lb * .9, sx, sy, 1.5);
      else if (k === 'o') col = tone(TIN_O, Lb * .95 + (hash(px, pv, 12) < .12 ? -.2 : 0) + spec(c) * .3, sx, sy);
      else col = tone(TIN_P, Lb * (k === 'P' ? .62 : .8) + (fbm(px * .06, pv * .06, 3) - .5) * .12, sx, sy);
      return { col, L: Lv, key: 'lidtop' };
    }
    if (z < LZ1 - 1.6 && rrect(u, v, HX + 1.2, HY + 1.2, RC + 1.2) < 0) {
      // Inside of the lid: bare tinplate, rust round the hinge and in the corners.
      const rust = fbm(u * .2, v * .2, 213) + (v < -HY + 6 ? .12 * fbm(u * .5, v, 215) : 0) + (Math.abs(u) > HX - 8 && Math.abs(v) > HY - 8 ? .15 : 0);
      return { col: rust > .82 ? tone(RUST, Lb * .8, sx, sy, 1.2) : tone(TIN_I, Lb * 1.08 + spec(c, 12) * .5 + (fbm(u * .08, v * .3, 214) - .5) * .12, sx, sy, .6), L: Lv, key: 'lidin' };
    }
    // Skirt: gilt rope band, rusty lower edge.
    const d = LZ1 - z, n = fbm((u + CX) * .16, d * .5, 55);
    let col;
    if (d < 1.2) col = tone(TIN_M, Lb * .8, sx, sy);
    else if (z < LZ0 + 2.8) col = tone(RUST, Lb * .7 + n * .3, sx, sy, 1.5);
    else if (n > .66) col = tone(TIN_M, Lb * .5, sx, sy);
    else if (Math.abs(d - 5.5) < 1) col = tone(TIN_O, Lb * .6 + ((u + 300) % 6 < 3 ? .1 : 0), sx, sy);
    else col = tone(TIN_P, Lb * .55, sx, sy);
    return { col, L: Lv, key: 'skirt' };
  }
  if (id === 'hand' || id === 'sleeve') return shadeHand(c, sx, sy, Lv, sceneObjs);
  return shadeItem(c, sx, sy, Lv);
}
function grainTable(x, y) {
  const boardH = 21, seed = 47, b = Math.floor(y / boardH), v = y - b * boardH, off = hash(b, 1, seed) * 300;
  if (v < 1) return -1.6;
  let g = fbm((x + off) * .035, (y + b * 9) * .55, seed) - .5;
  g += (fbm((x + off) * .012, b * 3.1, seed + 5) - .5) * .9;
  const kx = 40 + hash(b, 2, seed) * 400, ky = (b + .5) * boardH, kd = Math.hypot((x - kx) * .45, y - ky);
  if (hash(b, 3, seed) < .55 && kd < 5) g -= (5 - kd) * .22;
  return g * 2;
}
function cupRing(x, y) {
  const d = Math.hypot((x - 410) / 27, (y - 82) / 15);
  let k = d > .86 && d < 1 && fbm(x * .2, y * .2, 44) > .32 ? .07 : 0;
  for (const [ax, ay, bx, by] of [[52, 204, 121, 192], [372, 230, 441, 246], [30, 64, 58, 56]]) { const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)); if (Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t) < .6) k += .09; }
  return k;
}

function shadeItem(c, sx, sy, Lv) {
  const o = c.o, [a, b] = o.loc(c.x, c.y), top = c.n[2] > .72, z = c.z;
  const Lb = Lv * 1.2 + .08;
  switch (o.id) {
    case 'book': {
      const e = Math.min(BOOK[3] - Math.abs(a), BOOK[4] - Math.abs(b));
      if (!top && a > -BOOK[3] + 2.5 && z > 4 && z < 12) return { col: tone(PAPER, Lb * .75 + ((Math.floor(z * 1.5) & 1) ? -.08 : .04), sx, sy, .5), L: Lv, key: 'book' };   // page block
      let k = (fbm(a * .25, b * .25, 221) - .5) * .18 + (e < 3 ? .14 : 0) + (fbm(a * .6, b * .6, 222) > .7 ? .1 : 0);
      if (a < -BOOK[3] + 6) k -= .1;                                                            // spine
      if (Math.abs(a + BOOK[3] - 6) < .6) k -= .14;
      return { col: tone(LEATHER, Lb * .95 + k, sx, sy, .6), L: Lv, key: 'book' };
    }
    case 'redbook': {
      const e = Math.min(RED[3] - Math.abs(a), RED[4] - Math.abs(b));
      if (!top && a > -RED[3] + 2 && z > 14 && z < 18.5) return { col: tone(PAPER, Lb * .8 + ((Math.floor(z * 2) & 1) ? -.06 : .03), sx, sy, .5), L: Lv, key: 'red' };
      let k = (((Math.floor(c.x) + Math.floor(c.y)) & 1) ? .02 : -.02) + (e < 2 ? .12 : 0) + (fbm(a * .4, b * .4, 223) > .72 ? .1 : 0);
      if (a < -RED[3] + 4) k -= .12;
      return { col: tone(REDB, Lb * .95 + k, sx, sy, .6), L: Lv, key: 'red' };
    }
    case 'paper': {
      let k = (fbm(a * .1, b * .1, 224) - .5) * .12 + (fbm(a * .35, b * .35, 225) > .73 ? -.1 : 0);
      if (Math.abs(b) < .7) k -= .1; if (Math.abs(a) < .6) k += c.n[0] < 0 ? .1 : -.14;   // the two folds
      const e = Math.min(PAPR[3] - Math.abs(a), PAPR[4] - Math.abs(b));
      if (e < 2) k -= .06;
      return { col: tone(PAPER, Lb * 1.02 - .08 + k, sx, sy, .5), L: Lv, key: 'paper' };
    }
    case 'watch': {
      const r = len2(a, b);
      if (r > WATCH[3] - .5) return { col: tone(BRASS, Lb * .9 + spec(c) * .9, sx, sy, .5), L: Lv, key: 'watch' };
      const rings = Math.floor(r * 1.1) % 3 === 0 ? -.06 : 0, rim = r > WATCH[3] - 3 ? -.05 : 0;
      return { col: tone(BRASS, Lb * .85 + rings + rim + spec(c, 18) * .9 + (fbm(a * .5, b * .5, 226) > .72 ? -.1 : 0), sx, sy, .5), L: Lv, key: 'watch' };
    }
    case 'mbox': {
      if (a < -MBOX[3] - .3) return { col: tone(BRASS, Lb * .9 + spec(c) * .8, sx, sy, .5), L: Lv, key: 'mbox' };   // key
      const seam = Math.abs(z - 19.5) < .9 && !top;
      const grainV = (fbm(a * .05, (top ? b : z) * .6, 227) - .5) * .25 + (Math.sin(a * .9 + fbm(a * .1, b * .3, 228) * 6) > .8 ? -.06 : 0);
      let k = grainV + (seam ? -.25 : 0);
      if (top && Math.abs(a) < 5 && Math.abs(b) < 3.5) k += Math.abs(a) > 3.8 || Math.abs(b) > 2.4 ? -.12 : .05;   // inlaid lighter wood oval
      return { col: tone(WOODB, Lb * .95 + k + spec(c, 30) * .25, sx, sy, .6), L: Lv, key: 'mbox' };
    }
    case 'bundle': {
      const bulbD = bulbSdf(a, b, z);
      if (bulbD < .6) {
        const ang = Math.atan2(b - BULB_C[1], a - BULB_C[0]), stripe = Math.cos(ang * 7 + z * .15) > .55 ? -.12 : 0;
        return { col: tone(BULB, Lb * .95 + stripe + (z > 22 ? -.1 : 0) + (z > 26 ? .1 : 0) + (fbm(a, b, 229) - .5) * .12, sx, sy, .5), L: Lv, key: 'bulb' };
      }
      const [p, q] = rotZ(a, b, Math.PI / 4), e = Math.min(19 - Math.abs(p), 19 - Math.abs(q));
      const fold = (fbm(a * .22 + 9, b * .22, 230) - .5) * .3 + (Math.abs(p) < .6 || Math.abs(q) < .6 ? -.1 : 0) + (e > 1.4 && e < 2.4 ? -.1 : 0);
      return { col: tone(LINEN, Lb * .95 + fold - .1, sx, sy, .5), L: Lv, key: 'bundle' };
    }
  }
  return { col: [255, 0, 255, 255], L: Lv, key: '?' };
}

function shadeHand(c, sx, sy, Lv, objs) {
  const o = c.o;
  if (o.id === 'sleeve') {
    const ax = o.end[0] - o.start[0], ay = o.end[1] - o.start[1], az = o.end[2] - o.start[2], al = Math.hypot(ax, ay, az);
    const along = ((c.x - o.start[0]) * ax + (c.y - o.start[1]) * ay + (c.z - o.start[2]) * az) / al;
    const ang = Math.atan2(c.n[1] * ax / al - c.n[0] * ay / al, c.n[2]);
    const cuff = along < 13, rib = Math.floor(ang * 18 + 100) % 2;
    let k = cuff ? (rib ? -.12 : .06) : (((Math.floor(along / 2) + Math.floor(ang * 10 + 100)) & 1) ? -.06 : .04) + (fbm(c.x * .4, c.y * .4, 8) - .5) * .12;
    if (cuff && along < 1.5) k -= .1;
    return { col: tone(WOOL, Lv * 1.1 + .12 + k, sx, sy, .8), L: Lv, key: 'sleeve' };
  }
  const p = o.part(c.x, c.y, c.z), press = o.pose.press || 0, tendon = o.pose.tendon || 0, hw = o.hw;
  // Form light from the window side, cut into four planes whose edges are broken by noise: the hand
  // reads as bony facets laid in by hand (research: the back of the hand is hard, straight lines and
  // flat planes; no blending), not a smooth rubber gradient.
  // Kept deliberately coarse (user, 15/11/2026: the mesh hand read as CGI): three planes, the window
  // light in steps, little mottling and almost no dither, so the hand reads as painted flats.
  const kl = [-.45, -.55, .7], kn = Math.hypot(...kl), form = Math.max(0, (c.n[0] * kl[0] + c.n[1] * kl[1] + c.n[2] * kl[2]) / kn);
  const plane = clamp(Math.floor(form * 3 + (fbm(c.x * .3, c.y * .3, 301) - .5) * .9) / 3);
  Lv = Math.round(Lv * 5) / 5;
  let k = (fbm(c.x * .11, c.y * .11, 302) - .5) * .08;                                  // mottled skin
  const pore = hash(sx, sy, 303);
  if (pore < .03) k -= .06;                                                               // a few pores
  let ramp = HAND;
  if (p.kind === 'palm' && p.w > .04 * hw) {
    // Back of the hand. Hand-frame u runs wrist -> knuckles, v across.
    const sk = o.skeleton, seg = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = clamp(((p.u - ax) * dx + (p.v - ay) * dy) / (dx * dx + dy * dy)); return [Math.hypot(p.u - ax - dx * t, p.v - ay - dy * t), (p.u - ax) * dy - (p.v - ay) * dx]; };
    const vis = .35 + .65 * clamp(tendon / 1.3);
    sk.fingers.forEach((f, i) => {
      const [ku, kv] = f.J[0];
      // Extensor tendon: a straight raised cord from the middle of the wrist to the knuckle,
      // lit on top with a thin shadow on its far side; plainer when the hand is at ease.
      if (p.u > .22 * hw && p.u < ku - .06 * hw) {
        const [d, side] = seg(.05 * hw, kv * .25, ku - .06 * hw, kv);
        if (d < .028 * hw) k += .08 * vis; else if (d < .055 * hw && side > 0) k -= .07 * vis;
      }
      // Knuckle: flushed; skin stretched shiny over the bone when the finger bends, a few fine
      // wrinkle arcs when it is straight.
      const dk = Math.hypot(p.u - ku, p.v - kv);
      if (dk < f.r0 * 1.15) {
        ramp = FLUSH;
        const mcp = o.pose.f[i][0];
        if (mcp > 30 && dk < f.r0 * .55) k += .07;
        else if (mcp <= 30 && p.u < ku && Math.abs(dk - f.r0 * (.55 + .25 * (i & 1))) < .012 * hw) k -= .1;
      }
      // Valley between this metacarpal and the next one: a shallow gutter.
      if (i < 3) {
        const n = sk.fingers[i + 1].J[0], [d] = seg(.3 * hw, (kv + n[1]) * .2, (ku + n[0]) / 2 - .1 * hw, (kv + n[1]) / 2);
        if (d < .03 * hw && p.u > .4 * hw) k -= .05 + .04 * vis;
      }
    });
    // Two veins wandering down the gutters to the wrist (cool, soft, not on the tendons).
    for (const [v0, ph] of [[.08, 1.3], [-.2, 4.1]]) {
      const vc = (v0 + .045 * Math.sin(p.u / hw * 7 + ph) + .02 * Math.sin(p.u / hw * 17 + ph * 2)) * hw;
      if (p.u > .05 * hw && p.u < .75 * hw && Math.abs(p.v - vc) < .017 * hw) ramp = VEIN;
    }
    if (Math.abs(p.u + .33 * hw) < .012 * hw) k -= .07;                                    // wrist crease
  }
  if (p.kind === 'finger' || p.kind === 'thumb') {
    const isThumb = p.kind === 'thumb', sk = o.skeleton, J = isThumb ? sk.thumb.J : sk.fingers[p.i].J, kk = p.k;
    const a = J[kk], b = J[kk + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dl = Math.hypot(...d), dh = d.map(x => x / dl);
    // Back of the finger: hand-frame w (the thumb's nail faces half toward the index side) made
    // perpendicular to the bone; side = across the nail.
    const up0 = isThumb ? [0, .62, .78] : [0, 0, 1], dot = up0[0] * dh[0] + up0[1] * dh[1] + up0[2] * dh[2];
    const up = up0.map((x, i) => x - dh[i] * dot), ul = Math.hypot(...up);
    for (let i = 0; i < 3; i++) up[i] /= ul;
    const side = [dh[1] * up[2] - dh[2] * up[1], dh[2] * up[0] - dh[0] * up[2], dh[0] * up[1] - dh[1] * up[0]];
    const ax = [a[0] + d[0] * p.t, a[1] + d[1] * p.t, a[2] + d[2] * p.t], off = [p.u - ax[0], p.v - ax[1], p.w - ax[2]];
    const r = Math.hypot(...off) || 1, dorsal = (off[0] * up[0] + off[1] * up[1] + off[2] * up[2]) / r, lat = (off[0] * side[0] + off[1] * side[1] + off[2] * side[2]) / r;
    const s = p.t * dl, last = kk === 2;
    // Nail: about half the last phalanx, 70% of its width, short and rounded; cuticle and side
    // walls one step darker, free edge one step lighter, pale pink.
    if (last && dorsal > .35 && p.t > .45) {
      const inN = Math.abs(lat) < .56 && p.t > .5;
      if (inN) { ramp = NAIL; k += .08; if (p.t > .96) k += .14; if (p.t < .57 || Math.abs(lat) > .45) k -= .24; }
      else if (Math.abs(lat) < .7 && p.t > .46) k -= .1;                                  // nail fold
    }
    // Middle joint (research, Proko): about three wrinkle lines in a loose spiral while the finger is
    // straight, each a dark valley with a lit ridge after it; bent, the skin pulls taut and the bone
    // shows as a pale knob. The last joint has a single straight line.
    if (!isThumb && kk < 2 && dorsal > .5) {
      const dp = kk === 0 ? (p.t - 1) * dl : s, pip = o.pose.f[p.i][1], cv = dp + lat * lat * 1.6 + lat * .5;
      if (pip < 50) {
        for (const at of [-2.1, -.6, 1.1]) { const e = cv - at; if (Math.abs(e) < .45 && Math.abs(lat) < .62) k -= .13; else if (e > .45 && e < 1 && Math.abs(lat) < .5) k += .04; }
        if (Math.abs(dp) < 3) ramp = FLUSH;
      } else if (Math.abs(dp) < 2.2 && Math.abs(lat) < .45) { ramp = FLUSH; k += .09; }
    }
    if (!isThumb && kk === 2 && dorsal > .55 && Math.abs(lat) < .45 && Math.abs(s - 1.1 - lat * lat) < .45) k -= .11;   // one line over the last joint
    if (isThumb && kk === 1 && dorsal > .45 && Math.abs(lat) < .5 && (Math.abs(s - 1.6) < .45 || Math.abs(s - 2.9) < .4)) k -= .12;
    if (Math.abs(lat) > .78) k -= .07;                                                  // flanks fall away: fingers read as separate
    if (last && p.t > .55 && ramp === HAND) ramp = FLUSH;                               // fingertips flush
    if (last && p.t > .75 && dorsal < .2) k += .1 * press;                              // pressed pad blanches
    if (ramp === NAIL) k += .1 * press;                                                 // nail goes pale under pressure
  }
  if (press > 0 && ramp === FLUSH && p.kind === 'palm') k += .06 * press;               // knuckles go white under load
  const v = Lv * .6 + .1 + plane * .44 * (.55 + .45 * c.ao) + k;
  return { col: tone(ramp, v, sx, sy, .25), L: Lv, key: 'hand' };
}

function ink(o) { if (!o) return null; if (o.id === 'hand') return HAND[0]; if (o.id === 'sleeve') return WOOL[0]; if (o.id === 'book') return LEATHER[0]; if (o.id === 'redbook') return REDB[0]; if (o.id === 'mbox') return WOODB[0]; if (o.id === 'watch') return BRASS[0]; if (o.id === 'bundle' || o.id === 'paper') return PAPER[0]; return OUTLINE; }

module.exports = { L, winLight, winUV, onTable, lightAt, body, lidObj, items, itemById, shadeCell, ink, CX, CY, HX, HY, BH, LIDTOP, LZ0, LZ1, lidWorld, HINGE_Y, HINGE_Z, OUTLINE };

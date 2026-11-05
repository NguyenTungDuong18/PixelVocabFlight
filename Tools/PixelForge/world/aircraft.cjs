'use strict';
// World models: parked aircraft on the map (air_fighter, air_transport, air_bomber_enemy).
// Ids, footprints and frame counts are referenced by WorldModels.cs / AirbaseMap.cs.
// The airframe kit below is a copy of the one in fleet.cjs (modules may only require
// common.cjs): edit both together.
const { PAL, LIVERY, ramp, fbm, hash } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, SM, SN, WD } = PAL;
const { ix, cl, uv, flat, glow, glass, darkGlass, darkSteel, rubber, cream, def, DT, TP } = require('./common.cjs');

// ======================= Airframe kit =======================
const SB = ramp('#141b28', '#1e2a3f', '#2a3c58', '#3b5374', '#557093', '#7b95b2');   // navy sea blue
const ZC = ramp('#4d5222', '#6f7832', '#929e45', '#b5c063');                         // zinc chromate primer
const md = (a, n) => ((ix(a) % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth profile through [y, value] points (cosine eased), 0 outside.
const prof = pts => y => {
  if (y < pts[0][0] || y > pts[pts.length - 1][0]) return 0;
  for (let i = 0; i < pts.length - 1; i++) { const [a, ra] = pts[i], [b, rb] = pts[i + 1]; if (y <= b) return lerp(ra, rb, (1 - Math.cos(Math.PI * (y - a) / (b - a || 1))) / 2); }
  return 0;
};
const M = {
  chrome: flat(ST[4]), hub: flat(ST[3]), engine: flat(ST[2]), engineL: flat(ST[3]), engineD: flat(ST[0]),
  black: flat(TP[1]), white: flat(CR[3]), gold: flat(GD[2]), red: flat(RD[2]), redD: flat(RD[1]),
  stack: flat(RD[1]), soot0: flat(SM[1]), soot1: flat(SM[2]), chip: flat(ST[3]), blade: flat(ST[1]),
  wood: flat(WD[2]), woodD: flat(WD[1]), zinc: flat(ZC[2]), zincD: flat(ZC[1]), navG: glow(PAL.GN), navR: glow(RD[4]),
  tyre: rubber, glass, darkGlass, dark: darkSteel, cream
};
// Liveries: R = base ramp, i = base index, camo = blotch ramp, panels = bare-metal panel tones.
const LV = {
  olive: { R: OL, i: 2, chip: true },
  silver: { R: ST, i: 3, panels: true, outline: true },
  desert: { R: SN, i: 2, camo: DT, ci: 2, at: .55, chip: true, outline: true },
  navy: { R: SB, i: 3, chip: true, outline: true },
  yellow: { R: GD, i: 2, outline: true },
  enemy: { R: LIVERY.jungle.main, i: 2, camo: LIVERY.jungle.camo, ci: 1, at: .55, chip: true, enemy: LIVERY.jungle.mark }
};
const skinCache = new Map();
// Painted skin with panel lines (spanwise every py, chordwise every px on top faces) and
// a few rivet glints; o.fabric = rib tapes instead of panels.
function skin(lv, seed = 3, o = {}) {
  const k0 = lv.R[0].join() + seed + JSON.stringify(o);
  if (skinCache.has(k0)) return skinCache.get(k0);
  const py = o.py || 8, px = o.px || 10, R0 = o.R || lv.R, i0 = o.i ?? lv.i;
  const m = mat((x, y, z, f) => {
    const [u, v] = uv(x, y, z, f);
    let R = R0, i = i0;
    if (lv.camo && !o.R) { const n = fbm(u * .09 + seed, v * .09 + (f === 'u' ? 40 : 0), seed + 3); if (n > lv.at) { R = lv.camo; i = lv.ci; } }
    let k = 0;
    if (lv.panels && !o.R) { const h = hash(ix((x + 5) / px), ix(y / py), seed); k += h < .25 ? 1 : h > .88 ? -1 : 0; }
    const seamY = md(y, py) === 0, seamX = f === 'u' && md(x + px / 2, px) === 0;
    if (o.fabric) { if (f === 'u' && md(x, 5) === 0) k += 1; else if (seamY) k -= 1; }
    else if (seamY || seamX) k -= 1;
    else if (!lv.panels && md(y, py) === 1 && hash(ix(x), ix(y) + ix(z), seed + 5) < .18) k += 1;
    return cl(R, i + k);
  });
  skinCache.set(k0, m);
  return m;
}
// Fuselage around a centreline zc(y) with radius R(y); p > 2 makes it boxier.
function body(g, cx, y0, y1, R, zc, m, kz = 1.1, p = 2, maxR = 16) {
  g.shape(cx - maxR, y0, 0, cx + maxR, y1, g.H, (x, y, z) => { const r = R(y); return r > 0 && Math.abs(x - cx) ** p + Math.abs((z - zc(y)) * kz) ** p <= r ** p; }, m);
}
// Wing pair or tailplane. le/te(ax): leading/trailing edge y at distance ax from cx;
// zb(ax): underside; th..th2: thickness root..tip with an airfoil hump; tip: rounded tip length.
// from: start at ax (outer panels); side: +1/-1 = one side only.
function wing(g, o) {
  const { cx, span, le, te, zb, m } = o, th = o.th ?? 2, th2 = o.th2 ?? th * .55, tip = o.tip ?? 4, from = o.from ?? 0, side = o.side ?? 0;
  let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let a = from; a <= span; a += .5) { y0 = Math.min(y0, te(a)); y1 = Math.max(y1, le(a)); z0 = Math.min(z0, zb(a)); z1 = Math.max(z1, zb(a) + th + 1); }
  g.shape(side > 0 ? cx : cx - span - 1, y0 - 1, Math.max(0, z0 - 1), side < 0 ? cx : cx + span + 1, y1 + 1, z1, (x, y, z) => {
    const dx = x - cx, ax = Math.abs(dx);
    if (ax > span || ax < from || (side && Math.sign(dx) !== side)) return false;
    const k = tip > 0 ? Math.sqrt(Math.max(0, 1 - (Math.max(0, ax - span + tip) / tip) ** 2)) : 1;
    const L = le(ax), T = te(ax), c = T + (L - T) * .55, lo = c - (c - T) * k, hi = c + (L - c) * k;
    if (y < lo || y > hi) return false;
    const rel = (y - lo) / Math.max(1, hi - lo), t = lerp(th, th2, ax / span), b = zb(ax);
    return z >= b && z < b + Math.max(1, t * (.4 + .6 * Math.sin(Math.PI * Math.min(1, rel * rel))));
  }, m);
}
// Vertical fin centred on x = cx: trailing edge yt, leading edge yl at the base zb, height h.
function fin(g, cx, yt, yl, zb, h, m, o = {}) {
  const sw = o.sweep ?? .5, tsw = o.tsw ?? .1, r = o.round ?? 4, w = o.w ?? .9, fil = o.fillet ?? 0, fk = o.fk ?? 2.5;
  g.shape(cx - 2, yt - 3, zb, cx + 2, yl + fil * fk + 2, zb + h + 1, (x, y, z) => {
    const t = z - zb; if (t < 0 || t > h || Math.abs(x - cx) > w) return false;
    let L = yl - t * sw + (fil && t < fil ? (fil - t) ** 2 / fil * fk : 0), T = yt + t * tsw;
    if (t > h - r) { const q = Math.sqrt(Math.max(0, 1 - ((t - h + r) / r) ** 2)), c = T + (L - T) * .45; L = c + (L - c) * q; T = c - (c - T) * q; }
    return y >= T && y <= L;
  }, m);
}
// Propeller: n paddle blades with painted tips; axis 'y' (standing) or 'z' (lying flat).
function prop(g, cx, cy, cz, r, n, a0, o = {}) {
  const ang = [...Array(n)].map((_, k) => (a0 + k * 360 / n) * Math.PI / 180), bl = o.blade || M.blade, tp = o.tip === undefined ? M.gold : o.tip;
  const test = (du, dv) => {
    const d = Math.hypot(du, dv); if (d > r || d < 1.2) return false;
    for (const a of ang) {
      const ca = Math.cos(a), sa = Math.sin(a), al = du * ca + dv * sa, pp = Math.abs(-du * sa + dv * ca);
      if (al > 0 && pp <= .5 + (o.w ?? .8) * Math.sin(Math.PI * Math.min(.92, al / r))) return tp && al > r - 1.7 ? tp : bl;
    }
    return false;
  };
  if (o.axis === 'z') g.shape(cx - r - 1, cy - r - 1, cz, cx + r + 1, cy + r + 1, cz + 1, (x, y) => test(x - cx, y - cy));
  else g.shape(cx - r - 1, cy, cz - r - 1, cx + r + 1, cy + (o.th ?? 1), cz + r + 1, (x, y, z) => test(x - cx, z - cz));
}
// Rounded spinner pointing +y.
function spinner(g, cx, y0, len, cz, r, m) {
  g.shape(cx - r, y0, cz - r, cx + r, y0 + len, cz + r, (x, y, z) => { const t = (y - y0) / len, rr = r * Math.sqrt(Math.max(0, 1 - t * t)); return (x - cx) ** 2 + (z - cz) ** 2 <= rr * rr; }, m);
}
// Radial engine in a cowling (y0..y1): cowl flaps, coloured lip, recessed face with n cylinders.
function radial(g, cx, y0, y1, cz, r, cowl, o = {}) {
  const n = o.cyl ?? 9, lip = o.lip || cowl;
  g.shape(cx - r - 1, y0, cz - r - 1, cx + r + 1, y1, cz + r + 1, (x, y, z) => {
    const d = Math.hypot(x - cx, z - cz); if (d > r) return false;
    const a = Math.atan2(z - cz, x - cx), head = Math.cos(a * n) > .35 && d > r * .42 && d < r - 1.6;
    if (y > y1 - 1.5) return d >= r - 1.3 ? lip : head ? M.engineL : false;
    if (y > y1 - 2.5) return d < r * .4 ? M.engine : head || Math.cos(a * n) > -.2 ? M.engine : M.engineD;
    if (y < y0 + 1.2 && d > r - 1.2) return md(a * 12, 2) ? M.dark : cowl;
    return cowl;
  });
}
// Exposed radial (no cowl, biplanes): crankcase and finned cylinders sticking out radially.
function bareRadial(g, cx, y, cz, r, n = 7) {
  g.cylY(cx, cz, r * .45, y - 1, y + 2, M.engine);
  for (let k = 0; k < n; k++) { const a = (90 + k * 360 / n) * Math.PI / 180; g.cyl(cx + Math.cos(a) * r * .4, y + .5, cz + Math.sin(a) * r * .4, cx + Math.cos(a) * r, y + .5, cz + Math.sin(a) * r, 1, k % 2 ? M.engineL : M.engine); }
}
// Main gear leg (oleo + chrome piston), wheel, optional outboard door on side s.
function gear(g, x, y, zTop, r, o = {}) {
  const w = o.w ?? 1.4;
  g.cyl(x, y, zTop, x, y, r + 1.8, .8, M.dark);
  g.cyl(x, y, r + 2, x, y, r * .5, .55, M.chrome);
  g.cylX(y, r, r, x - w, x + w, M.tyre);
  g.cylX(y, r, r * .48, x - w - .3, x + w + .3, M.hub);
  if (o.door) { const s = o.side || 1, xd = s > 0 ? x + w + .4 : x - w - 1.4; g.box(xd, y - 2, r, xd + 1, y + 3, zTop, o.door); }
}
const tailWheel = (g, x, y, zTop, r = 1.6) => { g.cyl(x, y + .5, zTop, x, y, r, .55, M.dark); g.cylX(y, r, r, x - .8, x + .8, M.tyre); };
// Canopy: upper half ellipsoid on cz, frame bars every ribs voxels along y, windscreen bow.
function canopy(g, cx, cy, cz, rx, ry, rz, o = {}) {
  const fr = o.frame || M.dark, ribs = o.ribs ?? 0, bow = Math.round(cy + ry * .5);
  g.shape(cx - rx, cy - ry, cz, cx + rx, cy + ry, cz + rz, (x, y, z) => {
    const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (e > 1) return false;
    if (ribs && md(y - cy + ry, ribs) === 0) return fr;
    if (o.bow !== false && ix(y) === bow) return fr;
    if (o.spine && Math.abs(x - cx) < .5) return fr;
    return M.glass;
  });
}
// Recolours existing voxels in a box: fn(x, y, z) -> material or falsy.
function recolor(g, x0, y0, z0, x1, y1, z1, fn) {
  for (let z = Math.max(0, ix(z0)); z < Math.ceil(z1); z++) for (let y = ix(y0); y < Math.ceil(y1); y++) for (let x = ix(x0); x < Math.ceil(x1); x++)
    if (g.has(x, y, z)) { const m = fn(x + .5, y + .5, z + .5); if (m) g.set(x, y, z, m); }
}
// 1944 invasion stripes: five bands (white, black, white, black, white) of width w from u0.
const band5 = (u, u0, w = 2) => { const k = ix((u - u0) / w); return k >= 0 && k < 5 ? (k & 1 ? M.black : M.white) : null; };
// Exhaust soot streaking back (-y) along the fuselage sides from yStart.
function sootSide(g, cx, yStart, len, z0, z1, seed = 1, sides = [-1, 1]) {
  for (let y = yStart; y > yStart - len; y--) {
    const t = (yStart - y) / len, sp = ix(t * 1.6);
    for (let z = z0 - sp; z <= z1 + sp; z++) for (const s of sides) {
      if (hash(y, z * 3 + s, seed) > (1 - t) * .85 + .1) continue;
      for (let x = cx + s * 18, k = 0; k < 18; k++, x -= s) if (g.has(x, y, z)) { g.set(x, y, z, t < .4 ? M.soot0 : M.soot1); break; }
    }
  }
}
// Soot on top faces behind a nacelle (strip x0..x1 from yStart back).
function sootTop(g, x0, x1, yStart, len, seed = 2) {
  g.topPaint(x0, yStart - len, x1, yStart, (x, y) => { const t = (yStart - y) / len; return hash(ix(x), ix(y), seed) < (1 - t) * .6 ? (t < .25 ? M.soot0 : M.soot1) : null; });
}
// Chipped paint: worn leading edges and a few scuffs (top faces).
function chips(g, lv, x0, y0, x1, y1, seed = 4, p = .3) {
  if (!lv.chip) return;
  g.topPaint(x0, y0, x1, y1, (x, y, z) => { const X = ix(x), Y = ix(y), h = hash(X, Y, seed); return (!g.has(X, Y + 1, z) && !g.has(X, Y + 1, z + 1) && h < p) || h < .006 ? M.chip : null; });
}
const markPal = lv => lv.enemy ? { c: lv.enemy[0], g: lv.enemy[1], o: ST[1] } : { c: CR[2], g: GD[2], o: ST[1] };
// Roundel painted on the top surface.
function roundelTop(g, lv, cx, cy, r) {
  const P = markPal(lv), ring = flat(P.c), ctr = flat(P.g), out = lv.outline ? flat(P.o) : null;
  g.topPaint(cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r * .5 ? ctr : d <= r ? ring : out && d <= r + 1 ? out : null; });
}
// Roundel on both fuselage sides centred at (y, z).
function roundelSide(g, lv, y, z, r) {
  const P = markPal(lv), R2 = Math.ceil(r + (lv.outline ? 1 : 0)), rows = [];
  for (let dz = R2; dz >= -R2; dz--) { let s = ''; for (let k = -R2; k <= R2; k++) { const d = Math.hypot(k, dz); s += d <= r * .5 ? 'g' : d <= r ? 'c' : lv.outline && d <= r + 1 ? 'o' : ' '; } rows.push(s); }
  g.surfBitmap('w', y - R2, Math.round(z) + R2, rows, P); g.surfBitmap('e', y + R2, Math.round(z) + R2, rows, P);
}
// Stencil on both sides, centred on y.
function sideText(g, y, z, str, c = CR[2]) { const w = str.length * 4 - 1; g.surfText('w', Math.round(y - w / 2), Math.round(z), str, c); g.surfText('e', Math.round(y + w / 2), Math.round(z), str, c); }
// Transformed view of a model: build any part yawed / pitched / rolled / moved.
function xf(g, { yaw = 0, pitch = 0, roll = 0, pivot = [0, 0, 0], move = [0, 0, 0] }) {
  const d = Math.PI / 180, [a, b, c] = [yaw * d, pitch * d, roll * d];
  const Rz = [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
  const Rx = [[1, 0, 0], [0, Math.cos(b), -Math.sin(b)], [0, Math.sin(b), Math.cos(b)]];
  const Ry = [[Math.cos(c), 0, -Math.sin(c)], [0, 1, 0], [Math.sin(c), 0, Math.cos(c)]];
  const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const Mx = mul(Rz, mul(Rx, Ry)), P = pivot, T = move;
  const fwd = (x, y, z) => { const p = [x - P[0], y - P[1], z - P[2]]; return [0, 1, 2].map(i => Mx[i][0] * p[0] + Mx[i][1] * p[1] + Mx[i][2] * p[2] + P[i] + T[i]); };
  const inv = (x, y, z) => { const q = [x - P[0] - T[0], y - P[1] - T[1], z - P[2] - T[2]]; return [0, 1, 2].map(i => Mx[0][i] * q[0] + Mx[1][i] * q[1] + Mx[2][i] * q[2] + P[i]); };
  const w = Object.create(g), cen = v => Math.floor(v) + .5;
  w.set = (x, y, z, m) => { const p = fwd(cen(x), cen(y), cen(z)); g.set(p[0], p[1], p[2], m); };
  w.has = (x, y, z) => { const p = fwd(cen(x), cen(y), cen(z)); return g.has(p[0], p[1], p[2]); };
  w.decal = (f, x, y, z, col) => { const p = fwd(cen(x), cen(y), cen(z)); g.decal(f, p[0], p[1], p[2], col); };
  w.shape = (x0, y0, z0, x1, y1, z1, fn, m) => {
    const cs = [];
    for (const X of [x0, x1]) for (const Y of [y0, y1]) for (const Z of [z0, z1]) cs.push(fwd(X, Y, Z));
    const lo = [0, 1, 2].map(i => Math.floor(Math.min(...cs.map(p => p[i])))), hi = [0, 1, 2].map(i => Math.ceil(Math.max(...cs.map(p => p[i]))));
    for (let z = Math.max(0, lo[2]); z < hi[2]; z++) for (let y = lo[1]; y < hi[1]; y++) for (let x = lo[0]; x < hi[0]; x++) {
      const [sx, sy, sz] = inv(x + .5, y + .5, z + .5);
      if (sx < Math.floor(x0) || sx >= Math.ceil(x1) || sy < Math.floor(y0) || sy >= Math.ceil(y1) || sz < Math.floor(z0) || sz >= Math.ceil(z1)) continue;
      const r = fn(sx, sy, sz); if (r) g.set(x, y, z, r === true ? m : r);
    }
    return w;
  };
  w.box = (x0, y0, z0, x1, y1, z1, m) => w.shape(Math.round(x0), Math.round(y0), Math.round(z0), Math.round(x1), Math.round(y1), Math.round(z1), () => true, m);
  return w;
}

// Single-engine fighter recipe (64 x 64 frame, cx 32).
function fighter(g, o, v) {
  const lv = v.lv, cx = 32, sk = skin(lv, o.seed ?? 3), zc = y => o.zt + y / 60 * (o.zn - o.zt), R = prof(o.body), W = o.wing, T = o.tail, F = o.fin, N = o.nose;
  body(g, cx, 0, 64, R, zc, sk, o.kz ?? 1.1);
  const wle = a => W.le - a * W.sle, wte = a => W.te + a * W.ste;
  wing(g, { cx, span: W.span, le: wle, te: wte, zb: W.zb(zc), th: W.th ?? 2.6, th2: W.th2 ?? 1.2, tip: W.tip, m: sk });
  wing(g, { cx, span: T.span, le: a => T.le - a * (T.sle ?? .15), te: a => T.te + a * (T.ste ?? .1), zb: () => zc(T.te + 3) - .6, th: 1.6, th2: 1, tip: T.tip ?? 4, m: sk });
  fin(g, cx, F.yt, F.yl, zc(F.yt + 3) + 1, F.h, sk, F);
  const nz = zc(N.y1);
  if (!v.noNose) {
    if (N.type === 'radial') radial(g, cx, N.y0, N.y1, nz, N.r, sk, { lip: v.lip || sk, cyl: N.cyl });
    else {
      if (v.lip) recolor(g, cx - 8, N.y1 - 4, 0, cx + 8, N.y1 + 1, 30, () => v.lip);
      for (let k = 0; k < N.stacks; k++) for (const s of [-1, 1]) { const y = N.sy + k * 2, r = R(y); g.box(cx + s * (r + .2) - .5, y, zc(y) + N.sz, cx + s * (r + .2) + .5, y + 1, zc(y) + N.sz + 2, M.stack); }
      sootSide(g, cx, N.sy, 16, ix(zc(N.sy) + N.sz), ix(zc(N.sy) + N.sz) + 1, 7);
    }
    spinner(g, cx, N.y1, o.spin[0], nz, o.spin[1], v.spin || M.red);
    prop(g, cx, N.y1 + .6, nz, o.prop[0], o.prop[1], o.prop[2]);
  }
  const C = o.canopy;
  canopy(g, cx, C.y, zc(C.y) + R(C.y) * C.k, C.rx, C.ry, C.rz, { frame: sk, ribs: C.ribs, spine: C.spine });
  if (C.head) g.box(cx - 1, C.y - C.ry - 1, zc(C.y) + R(C.y) * C.k, cx + 1, C.y - C.ry + 1, zc(C.y) + R(C.y) * C.k + C.rz - 1, sk);
  if (!v.noGear) {
    const G = o.gear;
    for (const s of [-1, 1]) gear(g, cx + s * G.ax, G.y, W.zb(zc)(G.ax) + .5, G.r, { door: sk, side: s });
    tailWheel(g, cx, 3.5, zc(3.5) - R(3.5) + .5);
  }
  // Markings and wear.
  const K = o.marks;
  chips(g, lv, cx - W.span, 18, cx + W.span, W.le + 2, 4, .3);
  if (v.stripes) {
    recolor(g, cx - W.span, 0, 0, cx + W.span, 64, 40, (x, y, z) => { const ax = Math.abs(x - cx); return ax > K.st && z < W.zb(zc)(ax) + 4 && z >= W.zb(zc)(ax) && y < wle(ax) + 1 && y > wte(ax) - 1 ? band5(ax, K.st, 2) : null; });
    recolor(g, cx - 9, K.fs, 0, cx + 9, K.fs + 10, 40, (x, y, z) => Math.abs(x - cx) <= R(y) + .5 && Math.abs(z - zc(y)) <= R(y) + .5 ? band5(y, K.fs, 2) : null);
  }
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * K.r[0], K.r[1], K.r[2]);
  if (K.side) roundelSide(g, lv, K.side[0], zc(K.side[0]) + .5, K.side[1]);
  const tt = F.h * .58, fa = Math.round((F.yl - tt * (F.sweep ?? .5) + F.yt + tt * (F.tsw ?? .1)) / 2 - 3);
  g.surfText('w', fa, Math.round(zc(F.yt + 3) + 1 + tt), v.code || '07', CR[2]);
  g.surfText('e', fa + 6, Math.round(zc(F.yt + 3) + 1 + tt), v.code || '07', CR[2]);
  g.set(cx + W.span - .5, W.te + W.span * W.ste + 2, W.zb(zc)(W.span) + 1, M.navR); g.set(cx - W.span + .5, W.te + W.span * W.ste + 2, W.zb(zc)(W.span) + 1, M.navG);
  if (o.extra) o.extra(g, cx, zc, R, sk, v);
  return { zc, R, sk };
}

// Nacelle along y with a radial at the front and its prop; soot over the wing behind it.
function engine(g, x, y0, y1, cz, r, sk, o = {}) {
  g.shape(x - r - 1, y0, cz - r - 1, x + r + 1, y1, cz + r + 1, (X, y, z) => { const t = Math.min(1, (y - y0) / (o.taper ?? 10)), rr = r * (.35 + .65 * Math.sqrt(t)); return (X - x) ** 2 + ((z - cz) * 1.05) ** 2 <= rr * rr; }, sk);
  radial(g, x, y1 - 6, y1, cz, r + .3, sk, { lip: o.lip || sk, cyl: o.cyl ?? 9 });
  spinner(g, x, y1, 2.2, cz, 1.6, o.spin || M.dark);
  prop(g, x, y1 + .5, cz, o.pr ?? 8, o.n ?? 3, o.a0 ?? 90, { w: .7 });
  if (o.soot !== false) sootTop(g, x - r + 1, x + r - 1, y1 - 6, 14, ix(x));
}

// ===== Parked fighter: SKYLARK MK.I, same livery as fighter_level (olive, cream bands,
// cream/gold roundels, red spinner). Tail-dragger, nose (+y) slightly raised.
const SKYLARK = {
  zt: 7, zn: 13, kz: 1.1, seed: 11,
  body: [[1, .6], [4, 2], [14, 3.6], [34, 5.4], [50, 5.6], [55, 5.2]],
  wing: { span: 29.5, le: 46, sle: .06, te: 33, ste: .14, zb: zc => a => zc(40) - 3.4 + a * .09, th: 2.6, th2: 1.2, tip: 8 },
  tail: { span: 15, le: 11, te: 3, tip: 4 }, fin: { yt: 1.5, yl: 13, h: 12.5, sweep: .45, round: 4 },
  nose: { type: 'inline', y1: 55.5, stacks: 3, sy: 48, sz: 1 }, spin: [5.5, 3.2], prop: [12.5, 3, 90],
  canopy: { y: 37, ry: 6, rx: 2.6, rz: 4.2, k: .55, head: true },
  gear: { ax: 9, y: 42, r: 3.6 },
  marks: { r: [13, 39, 3.8] },
  extra: (g, cx, zc, R, sk) => {
    // Cream recognition bands on the wings and round the rear fuselage, side numbers.
    recolor(g, 0, 28, 0, 64, 50, 30, (x, y, z) => { const ax = Math.abs(x - cx); return ax >= 19 && ax < 22 && z >= zc(40) - 4 ? M.cream : null; });
    recolor(g, cx - 7, 15, 0, cx + 7, 19, 30, (x, y, z) => Math.abs(x - cx) <= R(y) + .5 && Math.abs(z - zc(y)) <= R(y) + .5 ? M.cream : null);
    sideText(g, 27, zc(27) + 2, '01', CR[2]);
    g.box(cx - 2, 47, ix(zc(47) + R(47)) - 1, cx + 2, 50, ix(zc(47) + R(47)) + 1, M.dark); // gun-camera hatch / fuel cap
  }
};
def('air_fighter', 'Aircraft', [4, 4], 34, g => fighter(g, SKYLARK, { lv: LV.olive, spin: M.red, code: '01' }), { margin: 8 });

// ======================= Parked twin-engine aircraft (6 x 5, nose +y) =======================
// Transport (C-47 like): round fuselage, cabin windows, cargo door, 1944 invasion stripes.
def('air_transport', 'Aircraft', [6, 5], 40, g => {
  const lv = LV.olive, cx = 48, sk = skin(lv, 23, { py: 8, px: 11 }), zc = y => 10 + y / 80 * 5;
  const R = prof([[1, 1.4], [8, 3.4], [28, 6.4], [66, 6.7], [74, 6], [78, 4.2], [80.5, 1.6]]);
  body(g, cx, 0, 81, R, zc, sk, 1.08);
  const le = a => 60 - a * .09, te = a => 44 + a * .1, zb = a => zc(52) - 4 + a * .06;
  wing(g, { cx, span: 46.5, le, te, zb, th: 3, th2: 1.5, tip: 7, m: sk });
  wing(g, { cx, span: 17.5, le: a => 13 - a * .18, te: a => 2 + a * .1, zb: () => zc(7) + .2, th: 1.8, th2: 1.2, tip: 4, m: sk });
  fin(g, cx, 1, 15, zc(6) + 3, 17, sk, { sweep: .5, round: 5, fillet: 5, fk: 2.2, w: 1 });
  for (const s of [-1, 1]) {
    const x = cx + s * 18, cz = zb(18) + 1.5;
    engine(g, x, 43, 67, cz, 4.8, sk, { pr: 10.5, a0: 90 + s * 20, taper: 7 });
    gear(g, x, 53, cz - 3, 4.6, { w: 1.6 });
  }
  tailWheel(g, cx, 4.5, zc(4.5) - R(4.5) + .5, 1.8);
  // Stepped windscreen panes, astrodome, cabin windows, cargo door, antenna wire.
  recolor(g, cx - 7, 70, 0, cx + 7, 76, 40, (x, y, z) => z > zc(y) + 2.5 && z < zc(y) + 6 && Math.abs(x - cx) > .6 ? (md(y, 3) === 0 ? M.dark : M.glass) : null);
  g.ell(cx, 62, zc(62) + 6.6, 1.8, 1.8, 1.6, M.glass);
  for (let y = 30; y < 62; y += 5) for (const s of [-1, 1]) { g.set(cx + s * (R(y) + .2), y, zc(y) + 2, M.darkGlass); g.set(cx + s * (R(y) + .2), y + 1, zc(y) + 2, M.darkGlass); }
  g.surfBitmap('e', 30, ix(zc(26)) + 4, ['ddddddd', 'd     d', 'd  g  d', 'd     d', 'd     d', 'd     d', 'd    kd', 'ddddddd'], { d: OL[0], g: GL[1], k: GD[2] });
  g.line(cx, 58, zc(58) + 6.6, cx, 9, zc(9) + 10, M.dark);
  // Markings: stripes, roundels, tail code, wear.
  chips(g, lv, cx - 47, 40, cx + 47, 62, 6, .28);
  recolor(g, cx - 47, 38, 0, cx + 47, 64, 40, (x, y, z) => { const ax = Math.abs(x - cx); return ax > 25 && z >= zb(ax) && z < zb(ax) + 4 && y <= le(ax) + 1 && y >= te(ax) - 1 ? band5(ax, 25, 2.4) : null; });
  recolor(g, cx - 8, 15, 0, cx + 8, 27, 40, (x, y, z) => Math.abs(x - cx) <= R(y) + .5 ? band5(y, 15, 2.4) : null);
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 37, 51, 4.6);
  roundelSide(g, lv, 33, zc(33) + 1, 3.4);
  g.surfText('w', 3, ix(zc(6) + 13), '43', CR[2]); g.surfText('e', 10, ix(zc(6) + 13), '43', CR[2]);
  g.set(cx + 46, 52, zb(46) + 1, M.navR); g.set(cx - 46, 52, zb(46) + 1, M.navG);
}, { margin: 8 });

// Captured enemy bomber (jungle livery): glazed stepless nose, twin end-plate fins,
// dorsal gun blister, tail gun.
def('air_bomber_enemy', 'Aircraft', [6, 5], 42, g => {
  const lv = LV.enemy, cx = 48, sk = skin(lv, 102, { py: 8, px: 11 }), zc = y => 10 + y / 80 * 5, mk = lv.enemy;
  const R = prof([[1, 1.4], [8, 3.2], [30, 6.4], [66, 6.6], [74, 5.8], [79, 3.6], [81, 1.4]]);
  body(g, cx, 0, 82, R, zc, sk, 1.08);
  recolor(g, cx - 8, 68, 0, cx + 8, 82, 40, (x, y, z) => z > zc(y) - 3 ? (md(y, 4) === 0 || Math.abs(x - cx) < .6 ? M.dark : M.glass) : null);
  g.cylY(cx, zc(78) - 2.5, .6, 79, 84, M.dark);
  const le = a => 60 - a * .09, te = a => 44 + a * .1, zb = a => zc(52) - 4 + a * .06;
  wing(g, { cx, span: 46.5, le, te, zb, th: 3, th2: 1.5, tip: 7, m: sk });
  wing(g, { cx, span: 21.5, le: a => 12 - a * .08, te: a => 2.5 + a * .05, zb: () => zc(7) + .5, th: 1.8, th2: 1.4, tip: 0, m: sk });
  const fm = skin(lv, 103, { R: lv.R, i: 1 });
  for (const s of [-1, 1]) fin(g, cx + s * 20.5, 1, 13, zc(7) - 3, 13, fm, { sweep: .2, tsw: .05, round: 4, w: 1 });
  for (const s of [-1, 1]) {
    const x = cx + s * 18, cz = zb(18) + 1.5;
    engine(g, x, 42, 67, cz, 4.8, sk, { pr: 10.5, a0: 90 + s * 20, taper: 7, lip: flat(ST[3]), spin: flat(lv.R[1]) });
    gear(g, x, 53, cz - 3, 4.6, { w: 1.6 });
  }
  tailWheel(g, cx, 4.5, zc(4.5) - R(4.5) + .5, 1.8);
  canopy(g, cx, 60, zc(60) + 5.2, 3.6, 5.5, 3.2, { frame: sk, ribs: 3, spine: true });
  g.ell(cx, 36, zc(36) + 6.2, 3, 3.4, 3, M.glass);
  g.line(cx, 34, zc(36) + 8, cx, 28, zc(36) + 9, M.dark, .6);
  g.cylY(cx, zc(2) + .5, .5, -3, 2, M.dark);
  for (const s of [-1, 1]) g.surfBitmap(s < 0 ? 'w' : 'e', s < 0 ? 22 : 26, ix(zc(24)) + 2, ['ddddd'], { d: ST[0] });
  chips(g, lv, cx - 47, 40, cx + 47, 62, 9, .3);
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 33, 50, 4.6);
  roundelSide(g, lv, 22, zc(22) + 1, 3);
  for (const s of [-1, 1]) g.surfBitmap(s < 0 ? 'w' : 'e', s < 0 ? 4 : 10, ix(zc(7) + 7), [' ccc ', 'cgggc', 'cgggc', ' ccc '], { c: mk[0], g: mk[1] });
  sideText(g, 32, zc(32) + 2, 'K7', CR[2]);
  g.set(cx + 46, 52, zb(46) + 1, M.navR); g.set(cx - 46, 52, zb(46) + 1, M.navG);
}, { margin: 8 });

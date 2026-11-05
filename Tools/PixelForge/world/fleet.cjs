'use strict';
// World models: more parked aircraft types (air_*). Every type is built from the small
// airframe kit below (panel-line skins, airfoil wings, fins, props, gear, markings, soot,
// chipped paint) and registered once per livery. Nose = +y, fictional names only.
// The kit is duplicated in aircraft.cjs (modules may only require common.cjs): keep in sync.
const { PAL, LIVERY, ramp, fbm, hash } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, SM, SN, WD } = PAL;
const { ix, cl, uv, flat, glow, glass, darkGlass, darkSteel, rubber, cream, def, DT, TP, CV, earth, planks, woodPost } = require('./common.cjs');

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

// ======================= Single-engine fighters (built in a 64 x 64 frame, cx 32) =======================
// o: zt/zn fuselage centre at tail (y 0) / nose (y 60), body profile, wing, tail, fin, nose,
// prop, canopy, gear, marks. v: livery variant { lv, spin, lip, stripes, code, nose }.
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

// Fat radial "BRAWLER" (P-47 like): 4-blade prop, elliptical wing, bubble canopy.
const BRAWLER = {
  zt: 7, zn: 12.6, kz: 1.05, seed: 5,
  body: [[.5, .6], [4, 2.2], [16, 4.8], [30, 6.5], [44, 7], [56, 7]],
  wing: { span: 31, le: 43, sle: .05, te: 28, ste: .2, zb: zc => a => zc(36) - 4.2 + a * .1, th: 2.8, th2: 1.2, tip: 10 },
  tail: { span: 12.5, le: 12, te: 3, tip: 4 }, fin: { yt: 1.2, yl: 13, h: 12, sweep: .55, round: 4.5 },
  nose: { type: 'radial', y0: 46, y1: 56.5, r: 7, cyl: 9 }, spin: [2.6, 2.2], prop: [12.5, 4, 45],
  canopy: { y: 31, ry: 5.5, rx: 2.8, rz: 4.2, k: .5, head: false },
  gear: { ax: 9.5, y: 40, r: 3.8 },
  marks: { r: [21.5, 36, 4], side: [21, 3.4], st: 8, fs: 5 },
  extra: (g, cx, zc, R) => { sootSide(g, cx, 44, 18, ix(zc(40) - 3), ix(zc(40) - 2), 3); }
};
// Slim inline "LANCER" (P-51 like): pointed nose, belly radiator scoop, straight-taper wing.
const LANCER = {
  zt: 7, zn: 12, kz: 1.1, seed: 9,
  body: [[.5, .6], [4, 2], [16, 3.9], [30, 4.9], [42, 5], [50, 4.6], [56, 3.6], [58, 3]],
  wing: { span: 29.5, le: 43, sle: .02, te: 29, ste: .23, zb: zc => a => zc(36) - 3.8 + a * .11, th: 2.4, th2: 1.2, tip: 3 },
  tail: { span: 11.5, le: 11, te: 3, tip: 2.5 }, fin: { yt: 1.2, yl: 12.5, h: 11.5, sweep: .6, round: 3, fillet: 4, fk: 2 },
  nose: { type: 'inline', y1: 58, stacks: 6, sy: 44, sz: 0 }, spin: [4.5, 2.9], prop: [12, 4, 45],
  canopy: { y: 33, ry: 5, rx: 2.6, rz: 4, k: .55 },
  gear: { ax: 8.5, y: 40, r: 3.6 },
  marks: { r: [20, 36, 3.8], side: [21, 3.2], st: 7, fs: 5 },
  extra: (g, cx, zc, R, sk, v) => {
    // Belly radiator scoop with a dark intake.
    g.shape(cx - 2.6, 17, 0, cx + 2.6, 34, 20, (x, y, z) => { const b = zc(y) - R(y); const d = y > 30 ? (34 - y) / 4 : y < 21 ? (y - 17) / 4 : 1; return z < b + 1.5 && z > b - 3 * d - .2; }, sk);
    g.box(cx - 1.5, 33, ix(zc(33) - R(33) - 2.5), cx + 1.5, 34, ix(zc(33) - R(33)), M.engineD);
    if (v.lv.panels) g.topPaint(cx - 2, 40, cx + 2, 56, () => flat(OL[1]));
    if (v.shark) for (const [face, a, sgn] of [['w', 50, 1], ['e', 54, -1]]) g.surfBitmap(face, a, ix(zc(52)) + 1, [' rrrrr', 'rwrwrwr', 'r rrrrrr', ' rwrwr ', '   rrr  '].map(s => sgn > 0 ? s : [...s].reverse().join('')), { r: RD[2], w: CR[3] });
  }
};
// Inverted-gull "SEAGULL" (Corsair like): long nose, cockpit far aft, 3-blade big prop.
const gullZ = zc => a => a < 9 ? zc(38) - 3 - a * .55 : zc(38) - 3 - 9 * .55 + (a - 9) * .24;
const SEAGULL = {
  zt: 7.5, zn: 13.5, kz: 1.08, seed: 13,
  body: [[.5, .6], [4, 2.2], [18, 4.5], [30, 5.4], [46, 5.8], [55, 5.8]],
  wing: { span: 32, le: 45, sle: .05, te: 30, ste: .15, zb: gullZ, th: 2.6, th2: 1.3, tip: 7 },
  tail: { span: 12, le: 12, te: 3, tip: 4 }, fin: { yt: 1.2, yl: 12, h: 11, sweep: .5, round: 4.5 },
  nose: { type: 'radial', y0: 48, y1: 56.5, r: 6.1, cyl: 9 }, spin: [2.5, 1.9], prop: [13, 3, 90],
  canopy: { y: 27, ry: 4.5, rx: 2.5, rz: 3.8, k: .55, ribs: 3 },
  gear: { ax: 9, y: 42, r: 3.6 },
  marks: { r: [23, 38, 3.8], side: [17, 3.2], st: 12, fs: 5 },
  extra: (g, cx, zc) => { sootSide(g, cx, 47, 16, ix(zc(46) - 2), ix(zc(46) - 1), 5); }
};
// Enemy "RAIDER" (Zero like): light radial, long greenhouse canopy, rounded wing tips.
const RAIDER = {
  zt: 7, zn: 12, kz: 1.1, seed: 17,
  body: [[.5, .5], [4, 1.8], [18, 3.8], [32, 4.6], [46, 4.8], [55, 4.8]],
  wing: { span: 29, le: 44, sle: .1, te: 30, ste: .12, zb: zc => a => zc(37) - 3.5 + a * .12, th: 2.2, th2: 1, tip: 7 },
  tail: { span: 11, le: 11, te: 3, tip: 4 }, fin: { yt: 1, yl: 11, h: 10, sweep: .45, round: 5 },
  nose: { type: 'radial', y0: 48, y1: 56, r: 5, cyl: 7 }, spin: [3, 2], prop: [11, 3, 90],
  canopy: { y: 31, ry: 7, rx: 2.4, rz: 3.6, k: .55, ribs: 3 },
  gear: { ax: 9, y: 41, r: 3.3 },
  marks: { r: [20, 37, 3.6], side: [17, 3] },
  extra: (g, cx, zc) => { sootSide(g, cx, 47, 14, ix(zc(46)), ix(zc(46)) + 1, 5); }
};
const F64 = { margin: 8 };
def('air_brawler', 'Aircraft', [4, 4], 34, g => fighter(g, BRAWLER, { lv: LV.olive, lip: M.white, stripes: true, code: 'B7' }), F64);
def('air_brawler_silver', 'Aircraft', [4, 4], 34, g => fighter(g, BRAWLER, { lv: LV.silver, lip: mat((x, y, z) => ((ix(x / 2) + ix(z / 2)) & 1) ? RD[2] : CR[3]), spin: M.red, code: 'C4' }), F64);
def('air_lancer', 'Aircraft', [4, 4], 34, g => fighter(g, LANCER, { lv: LV.silver, lip: mat((x, y, z) => ((ix(x / 2) + ix(z / 2) + ix(y / 2)) & 1) ? GD[2] : TP[1]), spin: M.gold, code: '51' }), F64);
def('air_lancer_olive', 'Aircraft', [4, 4], 34, g => fighter(g, LANCER, { lv: LV.olive, spin: M.white, stripes: true, code: '22' }), F64);
def('air_lancer_desert', 'Aircraft', [4, 4], 34, g => fighter(g, LANCER, { lv: LV.desert, spin: M.red, shark: true, code: 'GA' }), F64);
def('air_seagull', 'Aircraft', [4, 4], 34, g => fighter(g, SEAGULL, { lv: LV.navy, spin: flat(SB[3]), code: '29' }), F64);
def('air_raider_enemy', 'Aircraft', [4, 4], 32, g => fighter(g, RAIDER, { lv: LV.enemy, spin: flat(LIVERY.jungle.main[1]), lip: M.black, code: 'K2' }), F64);
// Seagull with the outer wing panels folded up for carrier / hangar parking.
def('air_seagull_folded', 'Aircraft', [3, 4], 40, g => {
  const W = SEAGULL.wing, w = xf(g, { move: [-8, 0, 0] });
  const inner = { ...SEAGULL, wing: { ...W, span: 15, tip: 0 }, marks: { ...SEAGULL.marks, r: [11, 38, 0] } };
  const { zc, sk } = fighter(w, inner, { lv: LV.navy, spin: flat(SB[3]), code: '31' });
  for (const s of [-1, 1]) {
    const hz = W.zb(zc)(15), p = xf(g, { roll: s * 98, pivot: [32 + s * 15, 0, hz + 1], move: [-8 - s * 1, 0, 0] });
    wing(p, { cx: 32, span: W.span, from: 15, side: s, le: a => W.le - a * W.sle, te: a => W.te + a * W.ste, zb: W.zb(zc), th: 2.2, th2: 1.3, tip: W.tip, m: sk });
    g.box(24 + s * 15 - .5, 37, hz, 24 + s * 15 + 1.5, 42, hz + 2, M.dark);
  }
}, F64);

// ======================= Multi-engine kit =======================
// Nacelle along y with a radial at the front and its prop; soot over the wing behind it.
function engine(g, x, y0, y1, cz, r, sk, o = {}) {
  g.shape(x - r - 1, y0, cz - r - 1, x + r + 1, y1, cz + r + 1, (X, y, z) => { const t = Math.min(1, (y - y0) / (o.taper ?? 10)), rr = r * (.35 + .65 * Math.sqrt(t)); return (X - x) ** 2 + ((z - cz) * 1.05) ** 2 <= rr * rr; }, sk);
  radial(g, x, y1 - 6, y1, cz, r + .3, sk, { lip: o.lip || sk, cyl: o.cyl ?? 9 });
  spinner(g, x, y1, 2.2, cz, 1.6, o.spin || M.dark);
  prop(g, x, y1 + .5, cz, o.pr ?? 8, o.n ?? 3, o.a0 ?? 90, { w: .7 });
  if (o.soot !== false) sootTop(g, x - r + 1, x + r - 1, y1 - 6, 14, ix(x));
}

// Heavy 4-engine "FORTRESS" (B-17 like), 10 x 8 tiles.
function fortress(g, lv, v) {
  const cx = 80, sk = skin(lv, 21, { py: 9, px: 12 }), zc = y => 12 + (y - 6) / 114 * 7;
  const R = prof([[5, 1.4], [12, 3.6], [30, 6.4], [50, 8], [70, 8.4], [100, 8.4], [112, 7.6], [118, 5.6], [121, 2.6]]);
  body(g, cx, 4, 122, R, zc, sk, 1.05);
  // Plexiglass nose cone and tail gunner glazing.
  recolor(g, cx - 9, 112, 0, cx + 9, 123, 40, (x, y, z) => z > zc(y) - 4 ? (md(y, 3) === 0 ? M.dark : M.glass) : null);
  recolor(g, cx - 4, 4, 0, cx + 4, 9, 40, (x, y, z) => z > zc(y) - 1 ? M.glass : null);
  g.cylY(cx, zc(5), .6, 0, 5, M.dark);
  const le = a => 88 - a * .12, te = a => 58 + a * .08, zb = a => zc(73) - 6 + a * .07;
  wing(g, { cx, span: 79, le, te, zb, th: 4.2, th2: 2, tip: 6, m: sk });
  wing(g, { cx, span: 26, le: a => 24 - a * .3, te: a => 7 + a * .06, zb: () => zc(14) - .5, th: 2, th2: 1.2, tip: 5, m: sk });
  fin(g, cx, 4, 24, zc(10) + 2, 26, sk, { sweep: .45, round: 6, fillet: 7, fk: 2.6, w: 1 });
  for (const s of [-1, 1]) for (const ax of [22, 45]) engine(g, cx + s * ax, 64, 97 - (ax > 30 ? 3 : 0), zb(ax) + 2, 4.8, sk, { pr: 8.5, lip: v.lip, a0: 90 + s * 15 });
  for (const s of [-1, 1]) gear(g, cx + s * 22, 84, zb(22) + 1, 5.4, { w: 2 });
  tailWheel(g, cx, 12, zc(12) - R(12) + .5, 2.2);
  // Cockpit, top turret, chin turret, waist guns, radio hatch.
  canopy(g, cx, 104, zc(104) + 5.5, 5, 5, 4.2, { frame: sk, ribs: 3, spine: true });
  g.ell(cx, 97, zc(97) + 8, 3.6, 3.6, 3.4, M.glass);
  for (const s of [-1, 1]) g.cylY(cx + s * .9, zc(97) + 9.5, .5, 99, 106, M.dark);
  g.ell(cx, 115, zc(115) - 6, 2.8, 2.8, 2.4, M.dark);
  for (const s of [-1, 1]) {
    g.surfBitmap(s < 0 ? 'w' : 'e', s < 0 ? 44 : 50, ix(zc(47)) + 2, ['dddddd', 'dddddd', 'dddddd'], { d: ST[0] });
    g.cyl(cx + s * 7.5, 47, zc(47) + 1, cx + s * 11, 47.5, zc(47) + 1, .5, M.dark);
    for (const y of [105, 108, 111]) g.set(cx + s * (R(y) + .3), y, zc(y) + 1, M.glass);
  }
  canopy(g, cx, 76, zc(76) + 7.6, 1.6, 3, 1.6, { bow: false });
  g.ell(cx, 70, zc(70) - 8, 3.4, 3.4, 3.4, mat((x, y, z) => ix(x + z) % 3 ? ST[2] : GL[1]));
  // Markings, wear, bomb tally on the nose.
  chips(g, lv, cx - 79, 55, cx + 79, 92, 8, .28);
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 58, 74, 6.4);
  roundelSide(g, lv, 34, zc(34) + .5, 5.4);
  sideText(g, 15, zc(15) + 21 - 10, v.code || '297', CR[2]);
  g.surfBitmap('w', 100, ix(zc(102)) + 1, ['b b b b b b', 'bbbbbbbbbbb'].map(s => s.replace(/b/g, 'k')), { k: GD[2] });
  g.surfBitmap('e', 108, ix(zc(102)) + 1, ['b b b b b b', 'bbbbbbbbbbb'].map(s => s.replace(/b/g, 'k')), { k: GD[2] });
  if (lv.panels) g.topPaint(cx - 3, 108, cx + 3, 118, (x, y, z) => z < zc(y) + 6 ? flat(OL[1]) : null);
  g.set(cx + 78.5, 66, zb(79) + 1, M.navR); g.set(cx - 78.5, 66, zb(79) + 1, M.navG);
}
def('air_fortress', 'Aircraft', [10, 8], 48, g => fortress(g, LV.olive, { code: '297', tail: 'A' }), { margin: 8 });
def('air_fortress_silver', 'Aircraft', [10, 8], 48, g => fortress(g, LV.silver, { code: '831', tail: 'B', lip: M.red }), { margin: 8 });

// Medium twin "STRIKER" (B-25 like): tricycle gear, gull-ish wing, twin fins, glazed nose, 7 x 5.
function striker(g, lv, v) {
  const cx = 56, sk = skin(lv, 31, { py: 8, px: 11 }), zc = y => 12.5 + y * .01;
  const R = prof([[2, 1.5], [8, 3.4], [20, 4.7], [58, 5.1], [70, 4.9], [76, 3.9], [80, 1.8]]);
  body(g, cx, 1, 81, R, zc, sk, 1.05);
  recolor(g, cx - 6, 72, 0, cx + 6, 82, 30, (x, y, z) => z > zc(y) - 2 ? (md(y, 3) === 0 ? M.dark : M.glass) : null);
  recolor(g, cx - 3, 1, 0, cx + 3, 6, 30, (x, y, z) => z > zc(y) - 1 ? M.glass : null);
  const le = a => 54 - a * .06, te = a => 38 + a * .1, zb = a => a < 16 ? 9.5 + a * .16 : 12 - (a - 16) * .015;
  wing(g, { cx, span: 54, le, te, zb, th: 3.2, th2: 1.6, tip: 4, m: sk });
  const tz = a => 13.5 + a * .06;
  wing(g, { cx, span: 20, le: a => 14 - a * .05, te: a => 3 + a * .03, zb: tz, th: 1.8, th2: 1.4, tip: 0, m: sk });
  for (const s of [-1, 1]) fin(g, cx + s * 20, 2, 13, tz(20) - 4, 14, sk, { sweep: .12, tsw: .05, round: 4, w: 1 });
  for (const s of [-1, 1]) {
    const x = cx + s * 16, cz = zb(16) + 1.5;
    g.cylY(x, cz, 3.8, 28, 46, sk);
    engine(g, x, 40, 65, cz, 4.6, sk, { pr: 7.5, lip: v.lip, a0: 90 + s * 20 });
    gear(g, x, 46, cz - 3, 4.4, { w: 1.6 });
  }
  gear(g, cx, 69, zc(69) - 4, 3.2, { w: 1.2 });
  canopy(g, cx, 64, zc(64) + 3.6, 4.2, 4, 3.4, { frame: sk, ribs: 3, spine: true });
  g.ell(cx, 56, zc(56) + 5, 3, 3, 3, M.glass);
  for (const s of [-1, 1]) g.cylY(cx + s * .8, zc(56) + 6.5, .5, 57, 63, M.dark);
  for (const s of [-1, 1]) { g.ell(cx + s * 5, 66, zc(66) - 1, 1.5, 3, 1.5, sk); g.cylY(cx + s * 5.5, zc(66) - 1, .5, 68, 72, M.dark); }
  for (const s of [-1, 1]) for (const y of [24, 30]) g.set(cx + s * (R(y) + .3), y, zc(y) + 1, M.darkGlass);
  chips(g, lv, cx - 54, 36, cx + 54, 56, 12, .28);
  if (v.stripes) {
    recolor(g, cx - 54, 30, 0, cx + 54, 60, 30, (x, y, z) => { const ax = Math.abs(x - cx); return ax > 24 && y < le(ax) + 1 && y > te(ax) - 1 && z >= zb(ax) && z < zb(ax) + 4 ? band5(ax, 25, 2.4) : null; });
    recolor(g, cx - 8, 16, 0, cx + 8, 28, 30, (x, y) => band5(y, 16, 2.4));
  }
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 40, 47, 4.8);
  roundelSide(g, lv, v.stripes ? 34 : 22, zc(22) + .5, 3.6);
  for (const s of [-1, 1]) g.surfText(s < 0 ? 'w' : 'e', s < 0 ? 3 : 10, ix(tz(20) + 7), v.code || '43', CR[2]);
  g.set(cx + 53.5, 45, zb(54) + 1, M.navR); g.set(cx - 53.5, 45, zb(54) + 1, M.navG);
}
def('air_striker', 'Aircraft', [7, 5], 34, g => striker(g, LV.olive, { stripes: true, code: '43' }), { margin: 8 });
def('air_striker_desert', 'Aircraft', [7, 5], 34, g => striker(g, LV.desert, { code: '17', lip: M.red }), { margin: 8 });

// Torpedo bomber "TRIDENT" (Avenger like): deep fuselage, long greenhouse, rear ball turret, 5 x 4.
function trident(g, lv, v) {
  const cx = 40, sk = skin(lv, 41), zc = y => 8.5 + y / 60 * 5;
  const R = prof([[1, .8], [7, 3], [22, 5.8], [36, 6.7], [48, 6.8], [56, 6.4]]);
  body(g, cx, 0, 58, R, zc, sk, .85);
  const le = a => 46 - a * .08, te = a => 30 + a * .1, zb = a => zc(38) - 5.5 + a * .1;
  wing(g, { cx, span: 39, le, te, zb, th: 3, th2: 1.4, tip: 4, m: sk });
  wing(g, { cx, span: 14, le: a => 12 - a * .15, te: a => 2.5 + a * .1, zb: () => zc(6) - .5, th: 1.6, th2: 1, tip: 4, m: sk });
  fin(g, cx, 1, 13, zc(4) + 3, 16, sk, { sweep: .32, tsw: .15, round: 7 });
  radial(g, cx, 50, 57, zc(57), 6.6, sk, { lip: v.lip || sk, cyl: 9 });
  spinner(g, cx, 57, 2.4, zc(57), 1.8, M.dark);
  prop(g, cx, 57.6, zc(57), 12.5, 3, 90);
  canopy(g, cx, 38, zc(38) + 4.6, 2.8, 9, 3.6, { frame: sk, ribs: 3, spine: true });
  g.ell(cx, 27.5, zc(28) + 5.5, 3.2, 3.2, 3.6, mat((x, y, z) => md(z, 3) === 0 ? ST[2] : GL[1], { flat: true }));
  g.cylY(cx, zc(28) + 7, .5, 20, 26, M.dark);
  g.surfBitmap('w', 22, ix(zc(22)) - 2, ['ddd', 'ddd'], { d: ST[0] }); g.surfBitmap('e', 24, ix(zc(22)) - 2, ['ddd', 'ddd'], { d: ST[0] });
  // Torpedo slung in the bay, nose poking out.
  g.cylY(cx, zc(40) - 6.8, 1.4, 30, 50, M.engine); g.ell(cx, 50, zc(40) - 6.8, 1.4, 2, 1.4, M.engineL);
  for (const s of [-1, 1]) gear(g, cx + s * 10, 40, zb(10) + .5, 4, { door: sk, side: s });
  tailWheel(g, cx, 5, zc(5) - R(5) + .5, 1.8);
  sootSide(g, cx, 49, 16, ix(zc(48) - 3), ix(zc(48) - 2), 9);
  chips(g, lv, cx - 39, 26, cx + 39, 48, 14, .3);
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 28, 38, 4);
  roundelSide(g, lv, 17, zc(17) + .5, 3.4);
  sideText(g, 9, zc(9) + 10, v.code || '8', CR[2]);
  g.set(cx + 38.5, 37, zb(39) + 1, M.navR); g.set(cx - 38.5, 37, zb(39) + 1, M.navG);
}
def('air_trident', 'Aircraft', [5, 4], 38, g => trident(g, LV.navy, { code: '12' }), { margin: 8 });
def('air_trident_olive', 'Aircraft', [5, 4], 38, g => trident(g, LV.olive, { code: '5', lip: M.gold }), { margin: 8 });

// Flying boat "PELICAN" (Catalina like) on beaching gear: parasol wing on a pylon, 10 x 7.
def('air_flyingboat', 'Aircraft', [10, 7], 56, g => {
  const lv = LV.navy, cx = 80, sk = skin(lv, 51, { py: 9, px: 12 }), belly = skin(lv, 52, { R: CR, i: 1 });
  const keel = y => y > 54 ? 7 : 7 + (54 - y) * .2, crown = prof([[4, 19], [20, 22], [50, 28], [80, 30], [96, 27], [104, 20], [107, 14]]), hw = prof([[4, 2], [20, 4.5], [46, 8], [86, 8], [100, 6.5], [106, 3]]);
  g.shape(cx - 10, 4, 0, cx + 10, 108, 34, (x, y, z) => {
    const w = hw(y), k = keel(y), c = crown(y); if (!w || z < k || z > c) return false;
    const dx = Math.abs(x - cx), vee = Math.min(1, (z - k + .8) / 3.5);
    if (dx > w * vee) return false;
    if (z > c - w && ((dx / w) ** 2 + ((z - (c - w)) / w) ** 2) > 1) return false;
    return z < k + 4 ? belly : sk;
  });
  g.box(cx - 8, 53, 5, cx + 8, 55, 7, flat(CR[0]));   // planing step
  recolor(g, cx - 4, 101, 0, cx + 4, 108, 40, (x, y, z) => z > 16 ? (md(y, 3) === 0 ? M.dark : M.glass) : null);
  canopy(g, cx, 88, 26, 5, 5, 3.6, { frame: sk, ribs: 3, spine: true });
  for (const s of [-1, 1]) { g.ell(cx + s * 6.5, 32, 19, 2.6, 5, 4.2, M.glass); g.box(cx + s * 6.5 - .5, 29, 19, cx + s * 6.5 + .5, 36, 20, M.dark); }
  // Pylon, parasol wing, struts, floats.
  g.shape(cx - 2.5, 56, 26, cx + 2.5, 78, 41, (x, y, z) => Math.abs(x - cx) <= 2.5 - (78 - y < 4 ? (4 - (78 - y)) * .5 : 0), sk);
  for (const y of [62, 68, 74]) g.set(cx + 2.5, y, 34, M.darkGlass), g.set(cx - 3, y, 34, M.darkGlass);
  wing(g, { cx, span: 79, le: () => 78, te: () => 53, zb: () => 40, th: 3.4, th2: 2.4, tip: 7, m: sk });
  for (const s of [-1, 1]) {
    for (const y of [60, 70]) g.line(cx + s * 7, y, 20, cx + s * 24, y, 40, M.dark, .6);
    g.ell(cx + s * 73, 66, 25, 2.2, 7, 2.2, sk); g.box(cx + s * 73 - .5, 63, 26, cx + s * 73 + .5, 70, 40, sk);
    const x = cx + s * 15;
    g.cylY(x, 43, 4.2, 58, 74, sk);
    engine(g, x, 64, 84, 43, 4.8, sk, { pr: 9, a0: 90 + s * 25, soot: false });
    sootTop(g, x - 3, x + 3, 62, 10, 3);
    // Beaching gear: wheel on a braced leg at each hull side.
    gear(g, cx + s * 11.5, 60, 14, 5, { w: 1.8 });
    g.line(cx + s * 11.5, 60, 13, cx + s * 7, 60, 16, M.dark, .7);
  }
  // Tail fin with tailplane mounted part way up, and the tail dolly.
  fin(g, cx, 3, 22, 19, 22, sk, { sweep: .5, round: 6, w: 1 });
  wing(g, { cx, span: 22, le: a => 21 - a * .2, te: a => 8, zb: () => 29, th: 1.8, th2: 1.2, tip: 5, m: sk });
  g.box(cx - 4, 12, 3, cx + 4, 16, 4, M.dark); g.line(cx, 14, 4, cx, 14, keel(14), M.dark, .7);
  for (const s of [-1, 1]) g.cylX(14, 2.4, 2.4, cx + s * 4 - 1, cx + s * 4 + 1, M.tyre);
  chips(g, lv, cx - 79, 50, cx + 79, 80, 16, .25);
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 56, 66, 6);
  roundelSide(g, lv, 44, 21, 4.6);
  sideText(g, 70, 21, '44-P', CR[2]);
  g.set(cx + 78.5, 58, 41, M.navR); g.set(cx - 78.5, 58, 41, M.navG);
}, { margin: 8 });

// Biplane trainer "BUMBLEBEE" (Stearman like): blue fuselage, yellow wings, bare radial, 3 x 3.
def('air_biplane_trainer', 'Aircraft', [3, 3], 30, g => {
  const cx = 24, lv = LV.yellow, sk = skin(lv, 61, { fabric: true, py: 12 }), fus = skin(LV.navy, 62, { py: 7 }), zc = y => 6.5 + y / 44 * 4;
  const R = prof([[2, .6], [6, 1.8], [20, 3.7], [34, 4.1], [40, 4], [41.5, 3.6]]);
  body(g, cx, 1, 42, R, zc, fus, 1.05, 2.6);
  bareRadial(g, cx, 42, zc(42), 4.6, 7);
  spinner(g, cx, 44, 1.6, zc(42), 1.3, M.dark);
  prop(g, cx, 45, zc(42), 9.5, 2, 70, { w: .6 });
  const lowZ = a => zc(32) - 3 + a * .1;
  wing(g, { cx, span: 23, le: () => 36, te: () => 27.5, zb: lowZ, th: 1.8, th2: 1.4, tip: 2.5, m: sk });
  wing(g, { cx, span: 24, le: () => 39, te: () => 30.5, zb: () => 18.5, th: 1.8, th2: 1.4, tip: 2.5, m: sk });
  wing(g, { cx, span: 9, le: a => 9 - a * .15, te: () => 2, zb: () => zc(5), th: 1.4, th2: 1, tip: 3, m: sk });
  fin(g, cx, 1, 9, zc(4) + 1, 9, sk, { sweep: .3, round: 4 });
  recolor(g, cx - 2, 0, 0, cx + 2, 5, 30, (x, y, z) => z > zc(4) + 2 && md(z, 2) === 0 ? M.red : null);
  // Cabane and N interplane struts with flying wires.
  for (const s of [-1, 1]) {
    for (const y of [32, 36]) { g.line(cx + s * 2, y, zc(y) + 3, cx + s * 3, y + 1, 18.5, M.dark, .5); g.line(cx + s * 16, y - .5, lowZ(16) + 1.5, cx + s * 16, y + 1.5, 18.5, M.dark, .6); }
    g.line(cx + s * 4, 33, lowZ(4) + 1, cx + s * 15, 34, 18.5, flat(ST[2])); g.line(cx + s * 4, 33, 18.5, cx + s * 15, 34, lowZ(15) + 1.5, flat(ST[2]));
    gear(g, cx + s * 7, 33, lowZ(7) + .5, 3.1, { w: 1 });
  }
  tailWheel(g, cx, 3, zc(3) - R(3) + .5, 1.3);
  // Two open cockpits with windscreens and leather coaming.
  for (const y of [17, 25]) {
    g.erase(cx - 2, y - 2, zc(y) + 2, cx + 2, y + 2, zc(y) + 6);
    g.box(cx - 2, y - 2, zc(y) + 1, cx + 2, y + 2, zc(y) + 2, M.engineD);
    recolor(g, cx - 3, y - 3, zc(y) + 2.5, cx + 3, y + 3, zc(y) + 5, () => M.redD);
    g.box(cx - 1.5, y + 2, zc(y) + 3, cx + 1.5, y + 3, zc(y) + 5, M.glass);
  }
  for (const s of [-1, 1]) roundelTop(g, LV.navy, cx + s * 17, 34.5, 3);
  roundelSide(g, LV.navy, 12, zc(12) + .5, 2.6);
  sideText(g, 30, zc(30) + 3, '7', CR[3]);
}, { margin: 8 });

// Liaison "GRASSHOPPER" (Cub like): high wing, boxy cabin, flat-four, wooden prop, 3 x 3.
function liaison(g, lv, v) {
  const cx = 24, sk = skin(lv, 71, { fabric: true, py: 10 }), zc = y => 6 + y / 40 * 3.5;
  const R = prof([[3, .6], [8, 1.8], [20, 3.4], [30, 3.8], [36, 3.6], [39, 3]]);
  body(g, cx, 2, 40, R, zc, sk, .78, 3);
  canopy(g, cx, 28, zc(28) + 2.5, 3.6, 5, 4.5, { frame: sk, ribs: 0, bow: false });
  for (const s of [-1, 1]) { g.ell(cx + s * 3.2, 36, zc(36) + .5, 1.2, 1.6, 1.2, M.engineL); g.ell(cx + s * 3.2, 33.5, zc(33) + .5, 1.2, 1.4, 1.2, M.engine); }
  spinner(g, cx, 39.5, 1.5, zc(39), 1.2, M.dark);
  prop(g, cx, 40, zc(39), 8, 2, 10, { blade: M.wood, tip: M.gold, w: .7 });
  wing(g, { cx, span: 26, le: () => 33, te: () => 24, zb: () => 15.5, th: 1.8, th2: 1.6, tip: 1.5, m: sk });
  wing(g, { cx, span: 9, le: a => 9 - a * .2, te: () => 3, zb: () => zc(5), th: 1.3, th2: 1, tip: 3, m: sk });
  fin(g, cx, 2, 9, zc(4) + 1, 8, sk, { sweep: .35, round: 4.5, w: .6 });
  for (const s of [-1, 1]) {
    for (const y of [25, 31]) g.line(cx + s * 3, y, zc(y) - 2, cx + s * 13, 28, 15.5, M.dark, .5);
    g.line(cx + s * 2, 31, zc(31) - 3, cx + s * 6.5, 31, 2.6, M.dark, .5); g.line(cx + s * 2, 27, zc(27) - 3, cx + s * 6.5, 31, 2.6, M.dark, .5);
    g.cylX(31, 2.6, 2.6, cx + s * 6.5 - .8, cx + s * 6.5 + .8, M.tyre); g.cylX(31, 2.6, 1, cx + s * 6.5 - 1, cx + s * 6.5 + 1, M.hub);
  }
  tailWheel(g, cx, 3.5, zc(3.5) - R(3.5) + .5, 1.2);
  if (v.bolt) { g.surfBitmap('w', 10, ix(zc(20)) + 1, ['kkk         kkk', ' kkkkkkkkkkkkkkkkkk', '  kkkk     kkkkkkkk', '   kk'], { k: TP[1] }); g.surfBitmap('e', 30, ix(zc(20)) + 1, ['kkk         kkk', ' kkkkkkkkkkkkkkkkkk', '  kkkk     kkkkkkkk', '   kk'], { k: TP[1] }); }
  else { for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 17, 28.5, 3.4); roundelSide(g, lv, 14, zc(14) + .5, 2.8); }
  g.set(cx + 25.5, 25, 16, M.navR); g.set(cx - 25.5, 25, 16, M.navG);
}
def('air_liaison', 'Aircraft', [3, 3], 26, g => liaison(g, LV.olive, {}), { margin: 8 });
def('air_liaison_yellow', 'Aircraft', [3, 3], 26, g => liaison(g, LV.yellow, { bolt: true }), { margin: 8 });

// Assault glider "HUSH" (Waco / Horsa like): boxy fabric fuselage, glazed nose, high wing, 8 x 5.
def('air_glider', 'Aircraft', [8, 5], 30, g => {
  const lv = LV.olive, cx = 64, sk = skin(lv, 81, { fabric: true, py: 12 }), wk = skin(lv, 82, { fabric: true, py: 16 }), zc = y => 10.5 - y / 72 * 1.5;
  const R = prof([[4, 1], [14, 3.2], [30, 5.8], [58, 6.2], [66, 5.6], [72, 3.6]]);
  body(g, cx, 3, 73, R, zc, sk, .82, 3.2);
  recolor(g, cx - 7, 62, 0, cx + 7, 74, 30, (x, y, z) => z > zc(y) + .5 ? (md(y, 3) === 0 || md(x, 4) === 0 ? M.dark : M.glass) : null);
  wing(g, { cx, span: 62, le: a => 58 - a * .03, te: a => 42 + a * .1, zb: () => zc(50) + 5.2, th: 2.4, th2: 1.6, tip: 2, m: wk });
  wing(g, { cx, span: 17, le: a => 15 - a * .15, te: () => 5, zb: () => zc(10) + 1, th: 1.6, th2: 1.2, tip: 3, m: wk });
  fin(g, cx, 3, 15, zc(8) + 2, 14, sk, { sweep: .35, round: 6, w: 1 });
  for (const s of [-1, 1]) {
    for (const y of [46, 54]) g.line(cx + s * 5.5, y, zc(y) - 4, cx + s * 22, 50, zc(50) + 5.2, M.dark, .55);
    g.line(cx + s * 5, 50, zc(50) - 4, cx + s * 9, 50, 3, M.dark, .7);
    g.cylX(50, 3.4, 3.4, cx + s * 9 - 1.3, cx + s * 9 + 1.3, M.tyre); g.cylX(50, 3.4, 1.4, cx + s * 9 - 1.5, cx + s * 9 + 1.5, M.hub);
    for (let y = 22; y < 58; y += 6) g.set(cx + s * 6.6, y, zc(y) + 1, M.darkGlass), g.set(cx + s * 6.6, y + 1, zc(y) + 1, M.darkGlass);
  }
  g.box(cx - 1, 56, 0, cx + 1, 68, 2, M.woodD);   // nose skid
  g.surfBitmap('w', 36, ix(zc(36)) + 2, ['dddd', 'dddd', 'dddd', 'dddd', 'dddd', 'dddd'], { d: WD[1] });
  recolor(g, cx - 62, 30, 0, cx + 62, 62, 30, (x, y, z) => { const ax = Math.abs(x - cx); return ax > 30 && z > zc(50) + 4 ? band5(ax, 30, 2.6) : null; });
  recolor(g, cx - 8, 12, 0, cx + 8, 26, 30, (x, y) => band5(y, 13, 2.6));
  for (const s of [-1, 1]) roundelTop(g, lv, cx + s * 48, 50, 4.6);
  roundelSide(g, lv, 30, zc(30) + .5, 3.6);
  sideText(g, 8, zc(8) + 13, 'G9', CR[2]);
}, { margin: 8 });

// Fighter under repair: Lancer with the nose cowling off, V-12 exposed, hoist gantry,
// scaffold with planks, prop and cowl panels on the ground, 5 x 5.
def('air_repair', 'Aircraft', [5, 5], 34, g => {
  const w = xf(g, { move: [8, 4, 0] }), lv = LV.silver;
  const { zc, R, sk } = fighter(w, LANCER, { lv, noNose: true, code: '51' });
  w.erase(20, 44, 0, 44, 64, 30);
  const ez = zc(50), z = y => ez + 1;
  // Firewall in zinc chromate, engine mount tubes, V-12 block, cam covers, exhaust stacks.
  w.shape(27, 44, ez - 5, 37, 45, ez + 5, (x, y, zz) => (x - 32) ** 2 + (zz - ez) ** 2 <= 22, M.zinc);
  for (const s of [-1, 1]) for (const dz of [-3, 2]) w.line(32 + s * 3.5, 45, ez + dz, 32 + s * 2, 53, ez + dz * .5, M.dark);
  w.box(30, 45, ez - 3, 34, 56, ez, M.engine);
  for (const s of [-1, 1]) {
    w.box(32 + s * 1.5 - 1.5, 45, ez, 32 + s * 1.5 + 1.5, 55, ez + 3, M.engine);
    w.box(32 + s * 2 - 1, 45, ez + 3, 32 + s * 2 + 1, 55, ez + 4, M.engineL);
    for (let k = 0; k < 6; k++) w.box(32 + s * 3.6 - .5, 46 + k * 1.6, ez + 1, 32 + s * 3.6 + .5, 47 + k * 1.6, ez + 2, M.stack);
  }
  w.cylY(32, ez - .5, 2.4, 55, 58, M.engineL); w.cylY(32, ez - .5, .8, 58, 60, M.chrome);
  w.box(29, 46, ez + 4, 31, 49, ez + 5, M.red);   // red oil-filler caps
  // Hoist gantry over the nose: two A-frames, beam, chain and hook block.
  for (const y of [44, 60]) for (const s of [-1, 1]) w.line(32 + s * 13, y + (y > 50 ? 1 : -1) * 2, 0, 32 + s * 1.5, y, 28, woodPost, .7);
  w.box(30, 44, 27, 34, 61, 29, flat(WD[2]));
  w.line(32, 52, 27, 32, 52, ez + 6.5, M.dark);
  w.box(31, 51, ez + 6, 33, 53, ez + 8, M.gold);
  // Scaffold with steel tube legs and a plank deck on the east side.
  for (const [x, y] of [[40, 45], [40, 57], [45, 45], [45, 57]]) w.line(x, y, 0, x, y, 12, flat(ST[2]), .5);
  for (const y of [45, 57]) w.line(40, y, 6, 45, y, 6, flat(ST[2]));
  w.box(39, 44, 12, 46, 59, 13, planks(WD, 2, 2, 'y'));
  w.box(42, 55, 13, 45, 57, 15, M.red);   // toolbox on the deck
  // Prop lying on the ground and cowl panels stacked beside it.
  prop(w, 4, 58, 0, 11, 4, 20, { axis: 'z' });
  w.cylZ(4, 58, 2.2, 0, 2, M.gold);
  for (let k = 0; k < 3; k++) w.shape(48 + k * 3, 46 + k * 7, 0, 56 + k * 3, 52 + k * 7, 3, (x, y, zz) => zz < .6 + Math.sin((x - 48 - k * 3) / 8 * Math.PI) * 1.8 && zz > Math.sin((x - 48 - k * 3) / 8 * Math.PI) * 1.8 - 1, k === 1 ? M.zinc : sk);
  // Wheel chocks.
  for (const s of [-1, 1]) w.box(32 + s * 8.5 - 1.5, 44, 0, 32 + s * 8.5 + 1.5, 46, 1.5, M.wood);
}, { margin: 10 });

// Belly-landed wreck: Brawler airframe on the ground, broken wing, tail torn off,
// bent prop, burnt cockpit, ploughed earth and debris, 5 x 4.
def('air_wreck', 'Aircraft', [5, 4], 30, g => {
  const lv = LV.olive, body0 = xf(g, { yaw: 12, roll: -6, pivot: [32, 32, 0], move: [10, 2, -5.5] });
  const o = { ...BRAWLER, wing: { ...BRAWLER.wing, span: 31 }, marks: { ...BRAWLER.marks, side: null } };
  const { zc, R, sk } = fighter(body0, o, { lv, noNose: true, noGear: true, stripes: true, code: '19' });
  // Cut the starboard outer wing and the tail, re-lay them broken on the ground.
  body0.erase(32 + 12, 20, 0, 70, 50, 30);
  body0.erase(10, -2, 0, 54, 15, 40);
  const wingP = xf(g, { yaw: 28, roll: 14, pivot: [44, 36, 0], move: [14, 8, -4] }), W = BRAWLER.wing;
  wing(wingP, { cx: 32, span: W.span, from: 12.5, side: 1, le: a => W.le - a * W.sle, te: a => W.te + a * W.ste, zb: W.zb(zc), th: 2.6, th2: 1.2, tip: W.tip, m: sk });
  recolor(wingP, 44, 20, 0, 64, 50, 30, (x, y, z) => band5(x - 32, 8, 2));
  roundelTop(wingP, lv, 32 + 21.5, 36, 4);
  const tail = xf(g, { yaw: -35, roll: 18, pivot: [32, 8, 0], move: [-2, 4, -3] });
  body(tail, 32, 0, 15, prof(BRAWLER.body), zc, sk, 1.05);
  wing(tail, { cx: 32, span: 12.5, le: a => 12 - a * .15, te: a => 3 + a * .1, zb: () => zc(6) - .6, th: 1.6, th2: 1, tip: 4, m: sk });
  fin(tail, 32, 1.2, 13, zc(4.2) + 1, 12, sk, BRAWLER.fin);
  recolor(tail, 26, 5, 0, 38, 15, 20, (x, y, z) => z < zc(y) + 4 ? band5(y, 5, 2) : null);
  tail.surfText('w', 3, ix(zc(4.2) + 8), '19', CR[2]);
  // Crumpled radial and bent prop blades curling back.
  radial(body0, 32, 46, 56.5, zc(56), 7, sk, { lip: M.white });
  for (const [a, bend] of [[45, 1], [135, -1], [225, 1], [315, -1]]) {
    const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), z0 = zc(56);
    const zz = d => z0 + Math.max(-z0 + 6, s * d);
    body0.line(32 + c * 2, 57.5, z0 + s * 2, 32 + c * 7.5, 58, zz(7.5), M.blade, .7);
    body0.line(32 + c * 7.5, 58, zz(7.5), 32 + c * 10 + bend * 2, 53, zz(10), M.blade, .7);
    body0.line(32 + c * 10 + bend * 2, 53, zz(10), 32 + c * 11 + bend * 3, 51, zz(11), M.gold, .6);
  }
  spinner(body0, 32, 56.5, 2.6, zc(56), 2.2, M.red);
  // Burnt cockpit area, smashed canopy, holes, missing panels showing frames.
  recolor(body0, 18, 18, 0, 46, 46, 30, (x, y, z) => { const n = fbm(x * .2, y * .2, 91); return n > .58 ? (n > .66 ? M.soot0 : M.soot1) : null; });
  body0.erase(29, 28, zc(31) + 7, 35, 34, 30);
  for (const [x, y] of [[26, 22], [38, 25], [30, 40], [21, 34]]) body0.erase(x, y, 0, x + 2, y + 2, 30);
  // Ploughed earth heap at the nose, furrow behind, scattered debris.
  g.shape(34, 64, 0, 62, 75, 5, (x, y, z) => ((x - 48) / 12) ** 2 + ((y - 70) / 4.5) ** 2 + (z / 4) ** 2 <= 1 + (hash(ix(x), ix(y), 7) - .5) * .3, earth(2));
  g.shape(26, 0, 0, 44, 30, 1, (x, y) => Math.abs(x - 35 + (30 - y) * .1) < 2 && hash(ix(x), ix(y), 3) < .55, earth(2));
  g.cylX(8, 3.6, 3.6, 66, 68.6, M.tyre); g.cylX(8, 3.6, 1.7, 65.8, 68.8, M.hub);
  for (const [x, y, k] of [[8, 46, 0], [14, 58, 1], [70, 30, 2], [62, 52, 3]]) g.box(x, y, 0, x + 3 + k % 2, y + 2, 1, k & 1 ? M.soot1 : sk);
}, { margin: 10 });

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

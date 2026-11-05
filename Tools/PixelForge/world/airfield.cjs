'use strict';
// World models: large airfield — big hangars, towers, terminal, fire station, revetments, lights (bld_*, prop_*).
const { PAL, hash, fbm, withAlpha, dither } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, RD, WD, NV, FI, GR, SN, SM } = PAL;
const {
  BR, WH, CN, TN, CV, DT, TP, PT, cl, uv, ix, flat, glow, mottled, tin, planks, brick, sandbag,
  canvasMat, concrete, rooftile, glass, darkGlass, interior, steel, darkSteel, rubber, woodPost,
  trimWhite, trimGreen, rope, redPaint, lampGlow, blackPaint, cream, windowOn, doorOn, steps, wheelX,
  def, tarpaper, gableRoofX, checker, stripes, railing, leaf
} = require('./common.cjs');

// ---------------- Shared flat paints ----------------
const P = {
  yel: flat(GD[2]), yelHi: flat(GD[3]), wht: flat(WH[4]), wht3: flat(WH[3]), blk: flat(TP[1]),
  red: flat(RD[2]), redDk: flat(RD[1]), redHi: flat(RD[3]), st1: flat(ST[1]), st2: flat(ST[2]), st3: flat(ST[3]),
  ol1: flat(OL[1]), ol2: flat(OL[2]), ol3: flat(OL[3]), wd1: flat(WD[1]), wd2: flat(WD[2]), wd3: flat(WD[3]),
  cn1: flat(CN[1]), cn2: flat(CN[2]), cn4: flat(CN[4]), cr1: flat(CR[1]), cr2: flat(CR[2]), nv2: flat(NV[2]),
  gRed: glow(RD[4]), gAmb: glow(FI[3]), gWht: glow(CR[3]), gGrn: glow(PAL.GN), brass: flat(GD[1])
};
const hazard = stripes(GD[2], TP[1], 3);

// Apron concrete: 32 px bays, fbm mottling and dark oil stains.
function apron(i = 3, seed = 1) {
  return mat((x, y, z, f) => {
    if (f !== 'u') return cl(CN, i - 1);
    const n = fbm(x * .18 + seed, y * .18, 33 + seed), st = fbm(x * .06 + seed * 5, y * .06, 71 + seed);
    let k = n > .68 ? 1 : n < .3 ? -1 : 0;
    if (st > .7) k = hash(ix(x), ix(y), 9) < .25 ? -1 : -2;
    if ((((ix(x) % 32) + 32) % 32) === 0 || (((ix(y) % 32) + 32) % 32) === 0) k = -1;
    return cl(CN, i + k);
  });
}
// Turf: grass on top, darker grass / earth flecks on the step faces.
const turf = (s = 1) => mat((x, y, z, f) => {
  const n = fbm(x * .2 + s, y * .2 + z * .15, 81 + s), h = hash(ix(x), ix(y) * 13 + ix(z), s);
  if (f === 'u') return cl(GR, 3 + (n > .62 ? 1 : n < .36 ? -1 : 0) + (h < .07 ? 1 : 0));
  return h < .22 ? cl(DT, 2) : cl(GR, 2 + (n > .6 ? 1 : 0));
});
// Corrugated sheet in a disruptive green/brown wartime camouflage (large soft-edged patches).
function camoTin(i = 2, ribAxis = 'y', seed = 3) {
  const A = tin(OL, i, ribAxis, 20), B = tin(DT, i, ribAxis, 20), C = tin(TN, i, ribAxis, 20);
  return mat((x, y, z, f) => {
    const n = fbm(x * .045 + seed, y * .045 + z * .03, 90 + seed);
    return (n > .58 ? B : n < .42 ? A : C).fn(x, y, z, f);
  });
}
// Grass tufts and small weeds at the foot of walls (breaks the hard ground line).
function tufts(g, x0, y0, x1, y1, n, seed, z0 = 1, hmax = 3) {
  const a = leaf(3, seed), b = leaf(4, seed + 1);
  for (let k = 0; k < n; k++) {
    const x = ix(x0 + hash(k, seed, 1) * (x1 - x0)), y = ix(y0 + hash(k, seed, 2) * (y1 - y0)), h = 1 + ix(hash(k, seed, 3) * hmax);
    if (g.has(x, y, z0)) continue;
    for (let z = 0; z < h; z++) g.set(x, y, z0 + z, z & 1 ? b : a);
    if (h > 1) { if (!g.has(x + 1, y, z0)) g.set(x + 1, y, z0, a); if (!g.has(x - 1, y, z0)) g.set(x - 1, y, z0, b); }
  }
}
// Straight tapered sandbag wall.
function bags(g, x0, y0, x1, y1, h, z0 = 0) {
  const alongX = x1 - x0 >= y1 - y0;
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const t = (z - z0) / h * 1.4; return alongX ? y >= y0 + t && y < y1 - t && x >= x0 + t * .5 && x < x1 - t * .5 : x >= x0 + t && x < x1 - t && y >= y0 + t * .5 && y < y1 - t * .5; }, sandbag(SN, 2));
}
function crate(g, x0, y0, z0, x1, y1, z1, R = WD, i = 3) {
  g.box(x0, y0, z0, x1, y1, z1, mat((x, y, z, f) => {
    const ex = x < x0 + 1 || x > x1 - 1, ey = y < y0 + 1 || y > y1 - 1, ez = z < z0 + 1 || z > z1 - 1;
    const edge = f === 'u' ? (ex || ey) : (f === 's' || f === 'n') ? (ex || ez) : (ey || ez);
    if (edge) return R[i - 1];
    const [, v] = uv(x, y, z, f);
    return cl(R, i + ((((ix(v) % 3) + 3) % 3) === 0 ? -1 : 0));
  }));
}
function drum(g, cx, cy, R = OL, i = 2, z0 = 0) {
  g.cylZ(cx, cy, 3.3, z0, z0 + 10, flat(R[i]));
  for (const z of [3, 6]) g.cylZ(cx, cy, 3.5, z0 + z, z0 + z + 1, flat(R[i - 1]));
  g.cylZ(cx, cy, 2.8, z0 + 9.6, z0 + 10, flat(R[i - 1])); g.set(cx + 1, cy - 1, z0 + 10, P.st3);
}
// Wall lamp: gooseneck bracket with a shade and a lit bulb, on a south/north face.
function wallLamp(g, x, y, z, dir = 1) {
  g.line(x, y, z, x, y + dir * 3, z + 2, P.st1); g.box(x - 1, dir > 0 ? y + 2 : y - 4, z, x + 2, dir > 0 ? y + 5 : y - 1, z + 2, P.st2);
  g.set(x, y + dir * 3, z - 1, lampGlow);
}
// Anti-blast tape cross on a window made by windowOn (glass sits 1 voxel inside the plane).
function tapeX(g, face, a, p, z, w, h) {
  const inward = face === 's' || face === 'e' ? -1 : 1;
  for (let t = 0; t < w; t++) for (let zz = z; zz < z + h; zz++) {
    const u = t / Math.max(1, w - 1), v = (zz - z) / Math.max(1, h - 1);
    if (Math.abs(u - v) > .12 && Math.abs(u + v - 1) > .12) continue;
    if (face === 's' || face === 'n') g.decal(face, a + t, p + inward, zz, CR[1]); else g.decal(face, p + inward, a + t, zz, CR[1]);
  }
}
// Window box with flowers under a south-facing window.
function flowerBox(g, a, p, z, w) {
  g.box(a - 1, p + 1, z - 4, a + w + 1, p + 3, z - 2, P.wd2);
  for (let x = a - 1; x < a + w + 1; x++) {
    g.set(x, p + 1 + (x & 1), z - 2, leaf(4, 3));
    if (hash(x, z, 5) < .45) g.set(x, p + 2, z - 1, hash(x, z, 6) < .5 ? P.redHi : flat(GD[3]));
  }
}
function bush(g, cx, cy, r, z0 = 0, s = 1) {
  g.ell(cx, cy, z0 + r * .8, r, r * .85, r * .8, leaf(3, s));
  g.ell(cx - r * .35, cy - r * .2, z0 + r * 1.15, r * .6, r * .55, r * .5, leaf(4, s + 1));
}
// Shell gable roof with the ridge along y (slopes face east/west).
function gableRoofY(g, x0, x1, y0, y1, z0, h, m) {
  const c = (x0 + x1) / 2, hw = (x1 - x0) / 2, th = hw / h + 2.5;
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const lim = hw * (1 - (z - z0) / h), d = Math.abs(x - c); return d <= lim && d >= lim - th; }, m);
}
// Model-space offset wrapper so small sub-models (aircraft, trucks) can be placed anywhere.
function at(g, ox, oy, oz = 0) {
  return {
    shape: (x0, y0, z0, x1, y1, z1, fn, m) => g.shape(x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz, (x, y, z) => fn(x - ox, y - oy, z - oz), m),
    box: (x0, y0, z0, x1, y1, z1, m) => g.box(x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz, m),
    erase: (x0, y0, z0, x1, y1, z1) => g.erase(x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz),
    set: (x, y, z, m) => g.set(x + ox, y + oy, z + oz, m),
    has: (x, y, z) => g.has(x + ox, y + oy, z + oz),
    line: (a, b, c, d, e, f, m, r) => g.line(a + ox, b + oy, c + oz, d + ox, e + oy, f + oz, m, r),
    cylX: (cy, cz, r, x0, x1, m, rz) => g.cylX(cy + oy, cz + oz, r, x0 + ox, x1 + ox, m, rz),
    cylY: (cx, cz, r, y0, y1, m, rz) => g.cylY(cx + ox, cz + oz, r, y0 + oy, y1 + oy, m, rz),
    cylZ: (cx, cy, r, z0, z1, m, ry) => g.cylZ(cx + ox, cy + oy, r, z0 + oz, z1 + oz, m, ry),
    ell: (cx, cy, cz, rx, ry, rz, m) => g.ell(cx + ox, cy + oy, cz + oz, rx, ry, rz, m),
    text: (face, x, y, z, s, c, sc) => g.text(face, x + ox, y + oy, z + oz, s, c, sc),
    decal: (face, x, y, z, c) => g.decal(face, x + ox, y + oy, z + oz, c)
  };
}

// ---------------- Sub-models ----------------
// Fighter (same airframe as air_fighter, 64 x 61, nose +y). o.service: cowling off, no prop.
function fighter(g0, ox, oy, o = {}) {
  const g = at(g0, ox, oy), R = o.R || OL, zc = y => 7 + y / 60 * 6;
  const skin = mat((x, y, z, f) => { const n = fbm(x * .2, y * .2, 11); return f === 'u' ? (n > .57 ? R[2] : R[3]) : (n > .57 ? R[1] : R[2]); });
  const rad = y => y < 2 ? 0 : y < 14 ? 1.6 + (y - 2) / 12 * 2 : y < 34 ? 3.6 + (y - 14) / 20 * 1.9 : y < 52 ? 5.5 : y < 56 ? 5.5 - (y - 52) * .35 : 0;
  g.shape(26, 1, 0, 38, 57, 26, (x, y, z) => { const r = rad(y); return r > 0 && (x - 32) ** 2 + ((z - zc(y)) * 1.1) ** 2 <= r * r; }, skin);
  const wingLE = x => 46 - Math.abs(x - 32) * .06, wingTE = x => 33 + Math.abs(x - 32) * .14;
  g.shape(2, 30, 0, 62, 47, 20, (x, y, z) => {
    const ax = Math.abs(x - 32); if (ax > 29.5) return false;
    const tip = Math.sqrt(Math.max(0, 1 - Math.max(0, ax - 22) ** 2 / 64)), mid = (wingLE(x) + wingTE(x)) / 2, half = (wingLE(x) - wingTE(x)) / 2 * tip, zw = zc(y) - 3 + ax * .09;
    return Math.abs(y - mid) <= half && z >= zw && z < zw + 1.6;
  }, skin);
  g.shape(17, 2, 0, 47, 12, 22, (x, y, z) => { const ax = Math.abs(x - 32); return ax < 15 && y > 3 + ax * .2 && y < 10.5 - ax * .12 && Math.abs(z - zc(y) - .5) < .8; }, skin);
  g.shape(31, 1, 0, 33, 14, 30, (x, y, z) => { const top = zc(y) + 13 - (y - 2) * .1; return z >= zc(y) && z <= top && y > 2 + (z - zc(y)) * .25 && y < 13 - (z - zc(y)) * .45; }, skin);
  g.ell(32, 37, zc(37) + 4, 2.6, 6, 4.2, glass);
  if (o.service) {
    g.erase(25, 46, zc(48) + 1, 39, 56, 26);
    g.box(28, 46, zc(48) - 2, 36, 55, zc(48) + 4, steel); for (let y = 47; y < 55; y += 2) g.box(27, y, zc(48) + 2, 37, y + 1, zc(48) + 4, P.st3);
    g.box(28, 55, zc(55) - 2, 36, 57, zc(55) + 3, P.st1);
  } else {
    g.shape(26, 47, 0, 38, 56, 26, (x, y, z) => (x - 32) ** 2 + ((z - zc(y)) * 1.1) ** 2 <= rad(y) ** 2, mottled(R, 1, 13, .6, .3));
    g.shape(28, 55, 0, 36, 61, 26, (x, y, z) => { const r = 3.2 * (1 - (y - 55) / 6.5); return (x - 32) ** 2 + (z - zc(55)) ** 2 <= r * r; }, mat((x, y) => (y > oy + 58 ? RD[3] : RD[2])));
    for (const a of [90, 210, 330]) { const r = a * Math.PI / 180, z0 = zc(56); g.line(32 + Math.cos(r) * 2, 57.5, z0 + Math.sin(r) * 2, 32 + Math.cos(r) * 12.5, 57.5, z0 + Math.sin(r) * 12.5, P.st1, .6); g.set(32 + Math.cos(r) * 12.5, 57, z0 + Math.sin(r) * 12.5, P.yel); }
  }
  for (const x of [23, 41]) { g.line(x, 41, zc(41) - 3, x, 42, 4, darkSteel, .6); g.cylX(42, 3.6, 3.6, x - 1.5, x + 1.5, rubber); g.cylX(42, 3.6, 1.4, x - 1.6, x + 1.6, steel); }
  g.line(32, 4, zc(4) - 1, 32, 4.5, 2, darkSteel); g.cylX(4.5, 1.6, 1.6, 31, 33, rubber);
  g.shape(26, 15, 0, 38, 19, 26, (x, y, z) => g.has(x, y, z), cream);
  for (const sx of [-1, 1]) {
    const rcx = 32 + sx * 13, rcy = 39;
    g.shape(rcx - 4, rcy - 4, 0, rcx + 4, rcy + 4, 26, (x, y, z) => { const d = Math.hypot(x - rcx, y - rcy); return d <= 3.6 && g.has(x, y, z) && !g.has(x, y, z + 1) ? (d <= 1.7 ? P.yel : cream) : false; });
  }
  if (o.code) { g.text('w', 26, 30, 13, o.code, CR[2]); g.text('e', 37, 36, 13, o.code, CR[2]); }
}
// Yellow two-seat biplane trainer (56 x 50, nose +y).
function biplane(g0, ox, oy) {
  const g = at(g0, ox, oy), zc = y => 9 + y / 50 * 3;
  const skin = mat((x, y, z, f) => { const n = fbm(x * .25, y * .25, 17); return f === 'u' ? (n > .6 ? GD[2] : GD[3]) : (n > .6 ? GD[1] : GD[2]); });
  const rad = y => y < 3 ? 0 : y < 34 ? 1.4 + (y - 3) / 31 * 3.2 : y < 46 ? 4.6 : y < 50 ? 4.6 - (y - 46) * .7 : 0;
  g.shape(22, 0, 0, 34, 50, 22, (x, y, z) => { const r = rad(y); return r > 0 && Math.abs(x - 28) <= r && Math.abs(z - zc(y)) <= r * 1.05; }, skin);
  g.box(24, 42, zc(44) - 4, 32, 49, zc(44) + 4, mottled(ST, 2, 4, .6, .3));
  for (const y of [21, 29]) g.box(26, y, zc(y) + 3, 30, y + 4, zc(y) + 5, P.blk);
  g.box(25, 34, zc(34) + 4, 31, 35, zc(34) + 7, glass);
  const wing = (z, x0, x1) => g.box(x0, 30, z, x1, 39, z + 1.5, skin);
  wing(zc(34) - 4, 2, 54); wing(zc(34) + 9, 0, 56);
  for (const x of [6, 50]) for (const y of [31, 37]) g.line(x, y, zc(34) - 3, x, y, zc(34) + 9, P.wd1);
  for (const x of [25, 31]) g.line(x, 33, zc(34) + 4, x, 34, zc(34) + 9, P.st1);
  g.box(18, 1, zc(3) - 1, 38, 7, zc(3), skin); g.shape(27, 0, 0, 29, 8, 26, (x, y, z) => z >= zc(y) && z < zc(y) + 10 - y * .6, skin);
  g.box(27, 0, zc(0), 29, 3, zc(0) + 8, P.red);
  g.line(28, 50.5, zc(50) - 9, 28, 50.5, zc(50) + 9, P.wd1, .6);
  for (const x of [20, 36]) { g.line(28, 36, zc(36) - 3, x, 38, 4, P.st1); g.cylX(38, 3.4, 3.4, x - 1, x + 1, rubber); }
  g.line(28, 3, zc(3) - 1, 28, 1, 1, P.st1);
  for (const sx of [-1, 1]) { const rcx = 28 + sx * 18, rcy = 34.5; g.shape(rcx - 4, rcy - 4, 0, rcx + 4, rcy + 4, 30, (x, y, z) => { const d = Math.hypot(x - rcx, y - rcy); return d <= 3.4 && g.has(x, y, z) && !g.has(x, y, z + 1) ? (d <= 1.5 ? P.red : cream) : false; }); }
  g.text('w', 22, 22, zc(22) + 2, 'T7', TP[1]); g.text('e', 33, 26, zc(22) + 2, 'T7', TP[1]);
}
// Fire tender (24 x 58, nose +y): red body, lockers, ladder, hose reel, bell, headlamps.
function fireTruck(g0, ox, oy) {
  const g = at(g0, ox, oy), red = mottled(RD, 2, 4, .72, .2);
  g.box(3, 2, 3, 21, 54, 6, P.st1);
  g.box(1, 0, 6, 23, 38, 17, red);
  for (const y of [9, 19, 29]) g.box(0, y, 7, 24, y + 1, 16, P.redDk);
  g.box(0, 0, 11, 24, 38, 12, P.st3);
  g.box(2, 38, 6, 22, 48, 22, red); g.box(1, 47, 6, 23, 49, 22, P.redDk);
  g.box(3, 48, 6, 21, 56, 14, red); g.box(4, 55, 6, 20, 57, 13, P.st3); for (let x = 5; x < 20; x += 2) g.box(x, 56, 7, x + 1, 57, 12, P.st1);
  g.box(0, 56, 4, 24, 58, 6, P.st2);
  g.box(3, 47, 15, 21, 48, 21, glass); g.box(11.5, 47, 15, 12.5, 48, 21, P.redDk);
  for (const x of [1, 22]) g.box(x, 40, 14, x + 1, 46, 20, glass);
  for (const x of [3, 18]) { g.box(x, 55, 10, x + 3, 58, 13, P.st3); g.set(x + 1, 57, 11, P.gWht); g.set(x + 2, 57, 11, P.gWht); }
  g.ell(4, 50, 16, 2, 2, 2, P.brass); g.set(4, 50, 18, P.st1);
  for (const x of [4, 19]) g.box(x, -4, 22, x + 1, 50, 23, P.st3);
  for (let y = -3; y < 50; y += 3) g.box(4, y, 22, 20, y + 1, 23, P.st2);
  for (const y of [6, 34]) for (const x of [4, 19]) g.box(x, y, 17, x + 1, y + 1, 22, P.st1);
  g.cylX(6, 20, 3.5, 6, 18, rubber); g.cylX(6, 20, 1, 5, 19, P.st3);
  for (const y of [10, 46]) for (const [a, b] of [[0, 4], [20, 24]]) wheelX(g, 0, y, 4.5, 4.5, a, b);
  g.text('e', 0, 34, 15, 'FIRE', CR[2]); g.text('w', 24, 18, 15, 'FIRE', CR[2]);
  g.set(12, 47, 23, P.gRed);
}

// ---------------- Big steel/timber hangar kit ----------------
// Body X0..X1 x Y0..Y1, eaves E, ridge rise R, door gantries at both gable ends (y faces).
// Door modes: 'open' (leaves stacked outside the opening), 'half' (centre gap), 'closed'.
function hangar(g, o) {
  const { X0, X1, Y0, Y1, E, R, oh, gh, gd, gx0, gx1, bay } = o;
  const cx = (X0 + X1) / 2, hw = (X1 - X0 + 6) / 2;
  g.box(gx0, Y0 - gd - 1, 0, gx1, Y1 + gd + 1, 1, concrete(CN, 2, 32));
  g.box(X0, Y0, 1, X1, Y1, E, o.wall);
  g.box(X0 - 1, Y0, 1, X1 + 1, Y1, 4, concrete(CN, 2));
  g.erase(X0 + 2, Y0 + 2, 1, X1 - 2, Y1 - 2, E + R);
  g.box(X0 + 2, Y0 + 2, 0, X1 - 2, Y1 - 2, 1, concrete(CN, 1, 24));
  gableRoofY(g, X0 - 3, X1 + 3, Y0 - 2, Y1 + 2, E, R, o.roof);
  for (const [ya, yb] of [[Y0, Y0 + 2], [Y1 - 2, Y1]]) g.shape(X0, ya, E, X1, yb, E + R, (x, y, z) => !g.has(x, y, z) && Math.abs(x - cx) <= hw * (1 - (z - E) / R) - 1.5, o.wall);
  // Rooflights, ridge cap and ventilators.
  const glassRoof = mat((x, y, z, f) => (((ix(x) + ix(y)) % 7) === 0 ? PAL.GL[3] : PAL.GL[1]), { flat: true });
  g.topPaint(X0 - 3, Y0 - 2, X1 + 3, Y1 + 2, (x, y, z) => {
    if (z < E) return null;
    const d = Math.abs(x - cx), yy = (((ix(y - Y0) % (bay * 2)) + bay * 2) % (bay * 2));
    if (d > hw * .22 && d < hw * .78 && yy >= 6 && yy < 6 + o.light) return yy === 6 || yy === 5 + o.light || Math.abs(d - hw * .5) < .6 ? P.st2 : glassRoof;
    return null;
  });
  g.box(cx - 2, Y0 - 2, E + R - 2, cx + 2, Y1 + 2, E + R, flat(TN[2]));
  for (let y = Y0 + bay; y < Y1 - 4; y += bay * 2) { g.cylZ(cx, y, 2.5, E + R - 2, E + R + 2, P.st2); g.cylZ(cx, y, 3.5, E + R + 2, E + R + 3, P.st1); }
  // Gutters, downpipes, stanchions, bracing, window band.
  for (const xs of [X0 - 5, X1 + 3]) { g.box(xs, Y0 - 2, E - 2, xs + 2, Y1 + 2, E, P.st1); for (let y = Y0 + 8; y < Y1; y += bay * 3) g.box(xs, y, 1, xs + 1, y + 1, E - 1, P.st1); }
  for (let y = Y0; y <= Y1 - 2; y += bay) {
    g.box(X0 - 2, y, 1, X0, y + 2, E, P.st1); g.box(X1, y, 1, X1 + 2, y + 2, E, P.st1);
    if (o.brace && y + bay <= Y1) for (const [xx, d] of [[X0 - 1, 0], [X1, 0]]) { g.line(xx, y + 2, 5, xx, y + bay, E - 3, P.st2); g.line(xx, y + bay, 5, xx, y + 2, E - 3, P.st2); }
    if (o.winH && y + bay <= Y1 - 2) { windowOn(g, 'w', y + 4, X0, o.winZ, bay - 7, o.winH, { bars: false, frame: P.st3, sill: false }); windowOn(g, 'e', y + 4, X1 - 1, o.winZ, bay - 7, o.winH, { bars: false, frame: P.st3, sill: false }); }
  }
  for (const end of ['s', 'n']) doorEnd(g, o, end);
}
function doorEnd(g, o, end) {
  const { X0, X1, Y0, Y1, E, R, oh, gh, gd, gx0, gx1 } = o;
  const s = end === 's', mode = s ? o.front : o.back, cx = (X0 + X1) / 2;
  const yr = (d0, d1) => s ? [Y1 + d0, Y1 + d1] : [Y0 - d1, Y0 - d0];
  const B = (x0, x1, d0, d1, z0, z1, m) => { const [a, b] = yr(d0, d1); g.box(x0, a, z0, x1, b, z1, m); };
  const fy = d => s ? Y1 + d : Y0 - 1 - d; // voxel row at depth d
  const ox0 = X0 + 4, ox1 = X1 - 4;
  if (mode !== 'closed') { g.erase(ox0, s ? Y1 - 2 : Y0, 1, ox1, s ? Y1 : Y0 + 2, oh); g.box(ox0, s ? Y1 - 2 : Y0, 0, ox1, s ? Y1 : Y0 + 2, 1, concrete(CN, 1)); }
  // Floor tracks and the lattice door gantry.
  const F1 = o.frame1 || P.st1, F2 = o.frame2 || P.st2;
  for (let d = 2; d < gd; d += 3) B(gx0, gx1, d, d + 1, 1, 2, P.st3);
  B(gx0, gx1, 0, gd, oh, oh + 2, F1);
  B(gx0, gx1, gd - 2, gd, oh + gh - 2, oh + gh, F1); B(gx0, gx1, 0, 2, oh + gh - 2, oh + gh, F1);
  B(gx0, gx1, 2, gd - 2, oh + gh - 1, oh + gh, F2);
  for (let x = gx0, k = 0; x < gx1 - 1; x += gh, k++) {
    const y = fy(gd - 1), xe = Math.min(gx1 - 1, x + gh);
    g.box(x, y, oh, x + 1, y + 1, oh + gh, F1);
    g.line(x, y, k & 1 ? oh + 1 : oh + gh - 2, xe, y, k & 1 ? oh + gh - 2 : oh + 1, F2);
  }
  for (const [p0, p1, on] of [[gx0, gx0 + 6, o.posts[0]], [gx1 - 6, gx1, o.posts[1]]]) {
    if (!on) continue;
    for (const px of [p0, p1 - 2]) for (const [d0, d1] of [[0, 2], [gd - 2, gd]]) B(px, px + 2, d0, d1, 1, oh + gh, F1);
    const y = fy(gd - 1);
    for (let z = 4; z < oh - 4; z += 8) { g.line(p0, y, z, p1 - 1, y, z + 8, F2); g.box(p0, y, z, p1, y + 1, z + 1, F1); }
    B(p0 - 1, p1 + 1, -1, gd + 1, 0, 2, concrete(CN, 3));
    g.paint(p0, Math.min(...yr(0, gd)), 2, p1, Math.max(...yr(0, gd)), 9, hazard);
  }
  // Leaves.
  const n = o.leaves, lw = (ox1 - ox0) / n, L = [];
  if (mode === 'closed') for (let k = 0; k < n; k++) L.push([ox0 + k * lw, k & 1, k]);
  else if (mode === 'open') {
    const nl = o.stack === 'west' ? n : Math.ceil(n / 2);
    for (let k = 0; k < nl; k++) L.push([gx0 + 6 + k * 3, nl - 1 - k, -1]);
    for (let k = 0; k < n - nl; k++) L.push([gx1 - 6 - k * 3 - lw, n - nl - 1 - k, -1]);
  } else {
    const c = n / 2, G = o.gap / 2;
    for (let k = 0; k < n; k++) {
      if (k >= c - G && k < c) L.push([ox0 + (k - G) * lw, 2, -1]);
      else if (k >= c && k < c + G) L.push([ox0 + (k + G) * lw, 2, -1]);
      else L.push([ox0 + k * lw, k & 1, k]);
    }
  }
  const edge = o.leafEdge, wick = s ? o.wicket : -2;
  for (const [lx, r, k] of L) {
    const x0 = Math.round(lx), x1 = Math.round(lx + lw), d0 = 1 + r * 2;
    B(x0, x1, d0, d0 + 2, 1, oh, o.leaf);
    B(x0, x0 + 1, d0 + 2, d0 + 3, 1, oh, edge); B(x1 - 1, x1, d0 + 2, d0 + 3, 1, oh, edge);
    for (const z of o.rails) B(x0, x1, d0 + 2, d0 + 3, z, z + 1, edge);
    if (o.glazed) { B(x0 + 3, x1 - 3, d0 + 1, d0 + 2, oh - 10, oh - 4, glass); B(Math.round((x0 + x1) / 2), Math.round((x0 + x1) / 2) + 1, d0 + 1, d0 + 2, oh - 10, oh - 4, edge); }
    if (k >= 0 && o.numbers) { const t = String(k + 1), xm = Math.round((x0 + x1) / 2); g.text(end, s ? xm - 1 : xm + 1, fy(d0 + 1), oh - 13, t, CR[2]); }
    if (k === wick) { const xm = Math.round((x0 + x1) / 2); B(xm - 4, xm + 4, d0 + 1, d0 + 3, 1, 19, edge); B(xm - 3, xm + 3, d0 + 2, d0 + 3, 2, 18, o.leaf); g.set(xm + 2, fy(d0 + 2), 9, P.yel); }
  }
  // Number on the gable, gooseneck lamps on the gantry.
  if (o.num) { const sc = o.numScale, w = (o.num.length * 4 - 1) * sc; g.text(end, s ? Math.round(cx - w / 2) : Math.round(cx + w / 2), s ? Y1 - 1 : Y0, Math.round(E + R * .55 + 2 * sc), o.num, CR[2], sc); }
  for (let x = ox0 + 20; x < ox1 - 10; x += o.lampStep) { const y = fy(gd); g.line(x, y - (s ? 1 : -1), oh + gh, x, y + (s ? 2 : -2), oh + gh + 2, P.st1); g.box(x - 1, s ? y + 1 : y - 3, oh + gh, x + 2, s ? y + 4 : y - 0, oh + gh + 2, P.st2); g.set(x, s ? y + 2 : y - 2, oh + gh - 1, lampGlow); }
  if (mode !== 'closed') {
    // Interior: hanging lamps just behind the opening, yellow floor lines.
    for (let x = ox0 + 26; x < ox1 - 10; x += 40) { const y = s ? Y1 - 14 : Y0 + 13; g.line(x, y, E - 1, x, y, oh - 16, P.st1); g.cylZ(x, y, 2.5, oh - 18, oh - 16, P.st2); g.set(x, y, oh - 19, lampGlow); }
    g.topPaint(ox0, s ? Y1 - 40 : Y0, ox1, s ? Y1 : Y0 + 40, (x, y, z) => z === 0 && (Math.abs(x - cx) < 1 && (ix(y) & 7) < 4 || Math.abs(x - ox0 - 6) < 1 || Math.abs(x - ox1 + 6) < 1) ? P.yel : null);
  }
}

// ===== T2 hangar (open): long steel-framed shed, sliding doors stacked out on the gantries,
// two fighters (one rolled out on the apron, one under service), lean-to annexes.
function t2(g, open) {
  const o = {
    X0: 34, X1: 254, Y0: 14, Y1: 154, E: 52, R: 22, oh: 46, gh: 8, gd: 12, gx0: 6, gx1: 282, bay: 16, light: 7,
    wall: camoTin(2, 'y', 3), roof: camoTin(2, 'x', 3), leaf: tin(OL, 2, 'y', 24), leafEdge: P.ol1, rails: [15, 32],
    leaves: 9, front: open ? 'open' : 'closed', back: 'closed', posts: [1, 1], numbers: true, wicket: 4, glazed: true,
    num: '3', numScale: 3, lampStep: 52, winZ: 30, winH: 6
  };
  hangar(g, o);
  g.box(0, o.Y1 + o.gd + 1, 0, 288, 192, 1, apron(3, 2));
  g.topPaint(142, o.Y1 + o.gd + 1, 146, 192, (x, y, z) => z === 0 && (x < 143 || x >= 145) ? P.yel : null);
  // West annex: brick offices with tar-paper lean-to roof.
  g.box(14, 34, 1, 32, 136, 22, brick(BR, 2)); g.box(13, 33, 0, 33, 137, 2, concrete(CN, 2));
  g.shed(10, 32, 33, 138, 22, 0, 2, tarpaper(TP, 3, 'y'));
  g.shape(10, 32, 22, 33, 138, 30, (x, y, z) => z < 22 + (x - 10) / 23 * 6 + 2 && z >= 22 + (x - 10) / 23 * 6, tarpaper(TP, 3, 'y'));
  for (const y of [42, 66, 102, 120]) { windowOn(g, 'w', y, 14, 9, 9, 8); tapeX(g, 'w', y, 14, 9, 9, 8); }
  doorOn(g, 'w', 84, 14, 1, 9, 17, { leaf: planks(PT, 1, 4) }); wallLamp(g, 14, 88, 20, 1);
  g.box(10, 82, 0, 14, 96, 2, concrete(CN, 3));
  windowOn(g, 's', 18, 135, 9, 9, 8); windowOn(g, 'n', 28, 34, 9, 9, 8);
  g.cylZ(20, 50, 1.5, 24, 38, darkSteel); g.cylZ(20, 50, 2.5, 38, 39, darkSteel);
  // East annex: tin store with a ladder and drums.
  g.box(256, 52, 1, 272, 120, 20, tin(TN, 2, 'y', 12));
  g.shape(256, 50, 18, 276, 122, 30, (x, y, z) => { const t = (276 - x) / 20; return z < 20 + t * 6 + 2 && z >= 20 + t * 6; }, tin(TN, 3, 'x', 12));
  doorOn(g, 'e', 74, 271, 1, 14, 17, { leaf: planks(TN, 2, 3) }); windowOn(g, 'e', 58, 271, 9, 8, 6);
  for (const [x, y, R] of [[277, 96, OL], [277, 103, RD], [281, 99, OL]]) drum(g, x, y, R, 2, 1);
  g.line(275, 128, 1, 272, 128, 26, P.wd2); g.line(279, 128, 1, 276, 128, 26, P.wd2); for (let z = 4; z < 26; z += 4) g.line(275 - z * .12, 128, z, 279 - z * .12, 128, z, P.wd2);
  // Fire point on the west gantry, NO SMOKING board, sandbags.
  g.box(2, o.Y1 + 6, 1, 6, o.Y1 + 7, 18, P.red); for (const z of [8, 13]) g.cylZ(3.5, o.Y1 + 8.5, 1.4, z, z + 3, P.red);
  g.box(40, o.Y1 + 13, 14, 60, o.Y1 + 14, 21, P.redDk); g.text('s', 41, o.Y1 + 14, 19, 'NO SMOK', CR[2]);
  g.line(42, o.Y1 + 13, 1, 42, o.Y1 + 13, 14, P.st1); g.line(58, o.Y1 + 13, 1, 58, o.Y1 + 13, 14, P.st1);
  bags(g, 262, 136, 284, 146, 8, 1); bags(g, 4, 30, 12, 60, 7, 1);
  tufts(g, 30, 2, 258, 8, 70, 3); tufts(g, 2, 20, 10, 150, 30, 4); tufts(g, 276, 20, 286, 150, 30, 5); tufts(g, 0, 175, 30, 190, 14, 6, 1, 2);
  if (open) {
    fighter(g, 112, 120, { code: '07' });
    fighter(g, 172, 94, { service: true, code: '12' });
    // Step ladder against the engine of the second fighter, cowling panels on the floor.
    for (const y of [140, 146]) g.line(218, y, 1, 212, y - 1, 16, P.wd2); for (let z = 3; z < 16; z += 3) g.line(218 - z * .4, 140, z, 218 - z * .4, 146, z, P.wd2);
    g.box(222, 128, 1, 232, 134, 2, P.ol2); g.box(224, 136, 1, 233, 141, 2, P.ol1);
    // Workbench, crates, drums and a tool trolley inside the door.
    g.box(40, 118, 1, 64, 126, 10, P.wd2); g.box(40, 118, 10, 64, 126, 11, planks(WD, 3)); g.box(44, 120, 11, 48, 123, 14, P.red); g.box(54, 119, 11, 58, 121, 13, P.st2);
    crate(g, 40, 132, 1, 52, 142, 9, OL, 3); crate(g, 41, 134, 9, 50, 141, 15); crate(g, 238, 120, 1, 250, 132, 10);
    drum(g, 244, 140, NV, 3, 1); drum(g, 238, 146, OL, 2, 1);
    g.box(84, 140, 3, 96, 147, 9, P.red); g.cylX(143.5, 2.5, 2.5, 83, 97, rubber); g.box(85, 141, 9, 95, 146, 10, P.st3);
  }
}
def('bld_hangar_t2', 'World', [18, 12], 84, g => t2(g, true));
def('bld_hangar_t2_closed', 'World', [18, 12], 84, g => t2(g, false));

// ===== Bellman hangar: lower, exposed X-braced steel frame, grey doors with a centre gap.
def('bld_hangar_bellman', 'World', [12, 9], 60, g => {
  const o = {
    X0: 28, X1: 164, Y0: 14, Y1: 116, E: 36, R: 12, oh: 32, gh: 6, gd: 10, gx0: 10, gx1: 182, bay: 17, light: 5,
    wall: tin(TN, 2, 'y', 18), roof: tin(TN, 2, 'x', 14), leaf: tin(NV, 3, 'y', 16), leafEdge: P.nv2, rails: [11, 22],
    leaves: 8, front: 'half', back: 'closed', gap: 4, posts: [1, 1], numbers: true, wicket: 1, glazed: false, brace: true,
    num: null, lampStep: 46
  };
  hangar(g, o);
  g.box(0, o.Y1 + o.gd + 1, 0, 192, 144, 1, apron(3, 4));
  fighter(g, 64, 66, { code: '21', R: NV });
  crate(g, 36, 100, 1, 48, 110, 9); drum(g, 54, 106, OL, 2, 1); drum(g, 148, 104, RD, 2, 1);
  // Brick office annex on the east side.
  g.box(166, 40, 1, 184, 84, 20, brick(BR, 2)); g.box(165, 39, 20, 186, 85, 22, flat(CN[2]));
  windowOn(g, 'e', 46, 183, 8, 9, 8); doorOn(g, 'e', 64, 183, 1, 8, 16, { leaf: planks(PT, 1, 4) }); wallLamp(g, 186, 70, 18, 1);
  g.cylZ(172, 50, 1.4, 22, 32, darkSteel);
  bags(g, 2, 40, 9, 90, 7, 1);
  tufts(g, 26, 2, 166, 8, 40, 7); tufts(g, 2, 16, 10, 110, 22, 8); tufts(g, 184, 90, 190, 112, 10, 9);
});

// ===== Blister hangars: corrugated arch springing from the ground, open front.
function blister(g, o) {
  const { X0, X1, Y0, Y1, RZ } = o, cx = (X0 + X1) / 2, rx = (X1 - X0) / 2, th = 2.4;
  const q = (x, z, k = 0) => ((x - cx) / (rx + k)) ** 2 + (z / (RZ + k)) ** 2;
  const arch = tin(TN, 3, 'x', 20), rib = P.st1;
  g.box(X0 - 6, Y0 - 3, 0, X1 + 6, Y1 + 3, 1, concrete(CN, 2, 24));
  g.shape(X0, Y0, 1, X1, Y1, RZ + 1, (x, y, z) => q(x, z) <= 1 && q(x, z, -th) > 1, arch);
  for (let y = Y0; y < Y1; y += o.rib) g.shape(X0 - 2, y, 1, X1 + 2, y + 1, RZ + 3, (x, yy, z) => q(x, z, 1.2) <= 1 && q(x, z, -.6) > 1, P.st2);
  for (const y of [Y0, Y1 - 2]) g.shape(X0 - 2, y, 1, X1 + 2, y + 2, RZ + 3, (x, yy, z) => q(x, z, 1.5) <= 1 && q(x, z, -th - 1) > 1, rib);
  // Ground sills with earth and turf banked against the feet.
  for (const [a, b] of [[X0 - 3, X0 + 4], [X1 - 4, X1 + 3]]) g.box(a, Y0 - 1, 1, b, Y1 + 1, 3, concrete(CN, 3));
  for (const sd of [-1, 1]) g.shape(X0 - 10, Y0 + 2, 1, X1 + 10, Y1 - 2, 9, (x, y, z) => { const d = sd < 0 ? X0 + 2 - x : x - X1 + 2; return d >= 0 && d < 10 && z < 1 + (10 - d) * .7; }, turf(sd + 3));
  if (o.back === 'canvas') {
    g.shape(X0, Y0 + 1, 1, X1, Y0 + 2, RZ, (x, y, z) => q(x, z, -th) <= 1 && (Math.abs(x - cx) > rx * .3 || z > RZ * .62), canvasMat(CV, 2, 9));
    g.cylX(Y0 + 2.5, RZ * .62, 1.8, cx - rx * .32, cx + rx * .32, canvasMat(CV, 3));
  } else {
    g.shape(X0, Y0 + 1, 1, X1, Y0 + 3, RZ, (x, y, z) => q(x, z, -th) <= 1, tin(TN, 2, 'y', 16));
    doorOn(g, 'n', cx + 6, Y0 + 1, 1, 12, 20, { leaf: planks(TN, 1, 3) });
    windowOn(g, 'n', cx + 30, Y0 + 1, 22, 10, 7); windowOn(g, 'n', cx - 20, Y0 + 1, 22, 10, 7);
  }
  // Bay number board on two posts beside the mouth.
  const bw = o.num.length * 4 + 1, bx = X0 + 12;
  for (const x of [bx + 1, bx + bw - 2]) g.box(x, Y1 + 4, 1, x + 1, Y1 + 5, 8, P.wd1);
  g.box(bx, Y1 + 5, 7, bx + bw, Y1 + 6, 14, P.blk); g.text('s', bx + 1, Y1 + 5, 12, o.num, CR[2]);
  bags(g, X0 - 12, Y1 - 2, X0 + 6, Y1 + 5, 8, 1); bags(g, X1 - 6, Y1 - 2, X1 + 12, Y1 + 5, 8, 1);
  tufts(g, X0 - 12, Y0, X0 - 2, Y1, 26, o.seed); tufts(g, X1 + 2, Y0, X1 + 12, Y1, 26, o.seed + 1); tufts(g, X0, Y0 - 4, X1, Y0 - 1, 20, o.seed + 2);
}
def('bld_hangar_blister', 'World', [8, 6], 46, g => {
  blister(g, { X0: 14, X1: 114, Y0: 8, Y1: 86, RZ: 40, rib: 10, back: 'canvas', num: 'B4', seed: 11 });
  // Engine on a stand, bench, crates, a spare propeller.
  g.box(48, 52, 1, 66, 62, 8, P.st1); g.cylY(57, 13, 6, 50, 62, mottled(ST, 2, 6, .6, .3)); for (let y = 51; y < 62; y += 2) g.cylY(57, 13, 6.6, y, y + 1, P.st3);
  g.box(24, 36, 1, 40, 46, 9, P.wd2); g.box(24, 36, 9, 40, 46, 10, planks(WD, 3)); g.box(28, 38, 10, 31, 41, 13, P.red);
  crate(g, 84, 40, 1, 98, 52, 10, OL, 3); crate(g, 86, 42, 10, 96, 50, 16); crate(g, 76, 64, 1, 88, 74, 8);
  g.line(70, 34, 1, 72, 34, 30, P.wd1, .6); g.ell(71, 34, 16, 2, 1, 2, P.st2); drum(g, 34, 70, OL, 2, 1); drum(g, 41, 74, RD, 2, 1);
});
def('bld_hangar_blister_large', 'World', [12, 8], 64, g => {
  blister(g, { X0: 12, X1: 180, Y0: 10, Y1: 120, RZ: 58, rib: 12, back: 'wall', num: 'B7', seed: 21 });
  fighter(g, 64, 66, { code: '09' });
  crate(g, 26, 40, 1, 40, 52, 11, OL, 3); drum(g, 156, 92, OL, 2, 1); drum(g, 163, 96, NV, 3, 1);
  g.box(150, 40, 1, 168, 50, 9, P.wd2); g.box(150, 40, 9, 168, 50, 10, planks(WD, 3));
});

// ===== Small timber hangar: weatherboard walls, tar-paper gable roof, yellow trainer biplane.
def('bld_hangar_wood', 'World', [8, 6], 54, g => {
  const o = {
    X0: 30, X1: 118, Y0: 12, Y1: 80, E: 32, R: 18, oh: 30, gh: 4, gd: 8, gx0: 8, gx1: 120, bay: 22, light: 0,
    wall: planks(WD, 2, 3), roof: tarpaper(TP, 3, 'y'), leaf: planks(WD, 3, 4), leafEdge: P.wd1, rails: [8, 16],
    leaves: 4, front: 'open', back: 'closed', stack: 'west', posts: [1, 0], numbers: false, wicket: -1, glazed: false,
    num: null, lampStep: 40, frame1: P.wd1, frame2: P.wd2
  };
  hangar(g, o);
  g.box(0, o.Y1 + o.gd + 1, 0, 128, 96, 1, apron(3, 6));
  biplane(g, 46, 44);
  for (const y of [22, 50]) { windowOn(g, 'e', y, 117, 11, 10, 7, { frame: trimWhite }); windowOn(g, 'w', y + 4, 30, 11, 10, 7, { frame: trimWhite }); }
  // Painted club board on the door gantry.
  g.box(52, 87, 34, 96, 88, 43, cream); g.box(51, 87, 33, 97, 88, 34, P.wd1); g.box(51, 87, 43, 97, 88, 44, P.wd1); g.text('s', 57, 87, 41, 'AERO CLUB', RD[1]);
  for (const x of [56, 92]) g.box(x, 86, 34, x + 1, 87, 44, P.wd1);
  g.box(120, 30, 0, 126, 46, 3, planks(WD, 2)); g.box(120, 30, 3, 122, 46, 8, P.wd1);
  drum(g, 22, 86, RD, 2, 1); crate(g, 108, 84, 1, 118, 93, 8);
  tufts(g, 26, 2, 120, 8, 30, 31); tufts(g, 120, 10, 127, 80, 20, 32); tufts(g, 0, 10, 8, 80, 18, 33);
});

// ======================= Towers =======================
// Lattice-free helper: open steel stair flight from (x, y0, z0) climbing toward -y.
function stairFlight(g, x0, x1, y0, z0, n, m = P.st2) {
  for (let k = 0; k < n; k++) g.box(x0, y0 - 3 * (k + 1), z0 + 3 * k, x1, y0 - 3 * k, z0 + 3 * k + 1, m);
  for (const x of [x0 - 1, x1]) { g.line(x, y0, z0 + 6, x, y0 - 3 * n, z0 + 3 * n + 6, P.st1); g.line(x, y0, z0, x, y0 - 3 * n, z0 + 3 * n, P.st1); }
}

// ===== Concrete watch office (Rougham type 12779/41): two storeys, wrap-around first-floor
// balcony, roof railing and a glazed visual control room on the roof, stair on the west side.
def('bld_tower_concrete', 'World', [7, 5], 92, g => {
  const wall = mottled(WH, 3, 5, .76, .14), slab = concrete(CN, 3), plinth = concrete(CN, 2);
  g.box(10, 18, 0, 102, 64, 2, plinth);
  g.box(14, 22, 2, 98, 60, 54, wall);
  g.box(13, 21, 26, 99, 61, 28, flat(CN[3]));
  // Balcony slab front + sides with railing.
  g.box(8, 16, 26, 104, 72, 28, slab); railing(g, 8, 16, 104, 72, 28, 7, trimWhite, 5);
  g.erase(8, 30, 28, 9, 40, 35);
  for (const x of [10, 50, 100]) g.box(x, 69, 2, x + 2, 71, 26, slab);
  // Roof: slab, railing, visual control room with mullions, small roof and gear.
  g.box(12, 20, 54, 100, 62, 56, slab); railing(g, 12, 20, 100, 62, 56, 6, trimWhite, 5);
  g.box(34, 26, 56, 78, 50, 59, wall);
  g.box(34, 26, 59, 78, 50, 70, glass); g.erase(35, 27, 59, 77, 49, 70);
  for (let x = 34; x <= 77; x += 5) { g.box(x, 26, 59, x + 1, 27, 70, trimWhite); g.box(x, 49, 59, x + 1, 50, 70, trimWhite); }
  for (let y = 26; y <= 49; y += 5) { g.box(34, y, 59, 35, y + 1, 70, trimWhite); g.box(77, y, 59, 78, y + 1, 70, trimWhite); }
  g.box(36, 28, 59, 76, 48, 62, P.wd1);
  g.box(32, 24, 70, 80, 52, 73, slab); g.box(34, 26, 73, 78, 50, 74, flat(CN[2]));
  // Mast with yard and red light, wind vane, Aldis signal lamp on the balcony.
  g.box(72, 30, 74, 74, 32, 90, darkSteel); g.box(66, 30, 86, 80, 32, 87, darkSteel); g.set(72, 30, 90, P.gRed); g.set(73, 30, 90, P.gRed);
  g.box(42, 34, 74, 43, 35, 82, darkSteel); g.line(39, 34.5, 82, 46, 34.5, 82, P.st3); g.box(45, 34, 81, 47, 35, 83, P.st3);
  g.box(90, 66, 28, 94, 70, 33, P.st1); g.cylY(92, 34, 2, 68, 72, P.st2); g.set(92, 71, 34, P.gWht);
  // Ground floor: door, windows with tape crosses, window boxes; first floor long windows.
  doorOn(g, 's', 52, 59, 2, 10, 20, { leaf: planks(NV, 2, 4) }); wallLamp(g, 50, 60, 22, 1); wallLamp(g, 63, 60, 22, 1);
  steps(g, 48, 66, 60, 1, plinth, 1, 2, 3);
  for (const x of [20, 36, 72, 86]) { windowOn(g, 's', x, 59, 8, 9, 11); tapeX(g, 's', x, 59, 8, 9, 11); flowerBox(g, x, 59, 8, 9); }
  for (const x of [18, 42, 66]) windowOn(g, 's', x, 59, 34, 20, 12);
  g.box(30, 71, 28, 88, 72, 35, cream); g.text('s', 31, 71, 33, 'FLYING CONTROL', TP[1]);
  for (const [face, p] of [['w', 14], ['e', 97]]) { windowOn(g, face, 30, p, 8, 9, 11); windowOn(g, face, 30, p, 34, 14, 12); }
  for (const x of [80, 54, 28]) windowOn(g, 'n', x, 22, 34, 12, 12);
  windowOn(g, 'n', 70, 22, 8, 9, 11); doorOn(g, 'n', 40, 22, 2, 9, 20, { leaf: planks(NV, 2, 4) });
  g.box(84, 22, 54, 90, 28, 64, brick(BR, 2)); g.box(83, 21, 64, 91, 29, 65, flat(CN[3]));
  // West stair: ground to balcony.
  stairFlight(g, 2, 8, 62, 2, 8);
  // Sandbags round the door, bicycle and fire bucket.
  bags(g, 40, 64, 48, 76, 9, 2); bags(g, 66, 64, 74, 76, 9, 2);
  g.box(100, 52, 2, 102, 54, 16, P.red); for (const z of [6, 11]) g.cylZ(103, 53, 1.3, z, z + 3, P.red);
  tufts(g, 2, 64, 110, 79, 30, 41); tufts(g, 2, 8, 110, 20, 25, 42);
});

// ===== Timber field control tower: braced four-leg trestle, look-out hut, ladder, windsock.
def('bld_tower_field', 'World', [3, 3], 86, (g, ctx) => {
  const post = woodPost, brace = P.wd2, H = 44;
  const legs = [[6, 6], [41, 6], [6, 41], [41, 41]], top = [[11, 11], [36, 11], [11, 36], [36, 36]];
  legs.forEach(([x, y], i) => { g.line(x + .5, y + .5, 0, top[i][0] + .5, top[i][1] + .5, H, post, 1.1); g.box(x - 1, y - 1, 0, x + 3, y + 3, 2, concrete(CN, 3)); });
  const at = (i, z) => { const t = z / H; return [legs[i][0] + (top[i][0] - legs[i][0]) * t + .5, legs[i][1] + (top[i][1] - legs[i][1]) * t + .5]; };
  for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) for (const [z0, z1] of [[2, 22], [22, 42]]) {
    const [ax0, ay0] = at(a, z0), [bx1, by1] = at(b, z1), [ax1, ay1] = at(a, z1), [bx0, by0] = at(b, z0);
    g.line(ax0, ay0, z0, bx1, by1, z1, brace); g.line(bx0, by0, z0, ax1, ay1, z1, brace); g.line(ax1, ay1, z1, bx1, by1, z1, post);
  }
  // Platform, hut with windows all round, shingle-ish tar roof, railing.
  g.box(6, 6, H, 42, 42, H + 2, planks(WD, 3, 3, 'y'));
  railing(g, 6, 6, 42, 42, H + 2, 6, P.wd2, 5); g.erase(21, 41, H + 2, 27, 42, H + 8);
  g.box(12, 12, H + 2, 36, 34, H + 20, planks(WD, 2, 3));
  for (const [face, p] of [['s', 33], ['n', 12]]) windowOn(g, face, 14, p, H + 10, 20, 7, { frame: trimWhite });
  for (const [face, p] of [['e', 35], ['w', 12]]) windowOn(g, face, 14, p, H + 10, 18, 7, { frame: trimWhite });
  doorOn(g, 's', 26, 33, H + 2, 6, 7, { leaf: planks(WD, 1, 3), knob: false });
  g.erase(26, 31, H + 2, 32, 33, H + 9);
  g.pyramid(9, 9, 39, 37, H + 20, 10, tarpaper(TP, 3));
  // Ladder up the south face.
  for (const x of [22, 26]) g.line(x, 46, 0, x, 41, H, P.wd1);
  for (let z = 3; z < H; z += 4) g.line(22, 46 - z / H * 5, z, 26, 46 - z / H * 5, z, P.wd2);
  // Windsock on the roof apex.
  g.box(23, 23, H + 30, 25, 25, H + 40, darkSteel);
  const [wx, wy] = ctx.wind, px = -wy, py = wx;
  for (let t = 0; t < 12; t += .4) { const r = 2.4 - t * .1, cx = 24 + wx * (1 + t), cy = 24 + wy * (1 + t), cz = H + 39 - t * t * .02; const m = ix(t / 3) % 2 ? P.wht : flat(FI[2]); for (let a = 0; a < 6.3; a += .3) g.set(cx + px * Math.cos(a) * r, cy + py * Math.cos(a) * r, cz + Math.sin(a) * r, m); }
  // Field telephone box and sandbag ring.
  g.box(38, 44, 6, 43, 46, 13, P.ol2); g.line(40, 45, 13, 38, 41, H, P.blk);
  bags(g, 0, 0, 47, 4, 5); bags(g, 0, 4, 4, 47, 5);
  tufts(g, 0, 40, 47, 47, 14, 51);
}, { margin: 14 });

// ===== Watch office on an operations block (Lavenham style): two-storey brick block,
// square tower rising from the east end with a glazed cab and balcony.
def('bld_tower_ops', 'World', [8, 6], 100, g => {
  const wall = brick(BR, 2), base = concrete(CN, 2), slab = concrete(CN, 3), rend = mottled(WH, 3, 7, .76, .14);
  g.box(4, 24, 0, 124, 92, 2, base);
  g.box(8, 30, 2, 120, 84, 44, wall);
  g.box(7, 29, 22, 121, 85, 24, slab); g.box(7, 29, 44, 121, 85, 47, slab);
  g.box(8, 30, 47, 120, 84, 48, tarpaper(TP, 3));
  railing(g, 7, 29, 121, 85, 47, 4, P.st2, 8);
  // Tower: rendered shaft, balcony, cab.
  g.box(80, 36, 47, 114, 76, 72, rend);
  g.box(76, 32, 72, 118, 80, 74, slab); railing(g, 76, 32, 118, 80, 74, 6, trimWhite, 5);
  g.box(82, 38, 74, 112, 74, 88, glass); g.erase(83, 39, 74, 111, 73, 88);
  for (let x = 82; x <= 111; x += 5) { g.box(x, 38, 74, x + 1, 39, 88, trimWhite); g.box(x, 73, 74, x + 1, 74, 88, trimWhite); }
  for (let y = 38; y <= 73; y += 6) { g.box(82, y, 74, 83, y + 1, 88, trimWhite); g.box(111, y, 74, 112, y + 1, 88, trimWhite); }
  g.box(84, 40, 74, 110, 72, 77, P.wd1);
  g.box(80, 36, 88, 114, 76, 91, checker(GD[2], TP[1], 4, CN[3]));
  g.box(81, 37, 91, 113, 75, 92, flat(CN[2]));
  g.cylZ(97, 56, 2, 92, 94, P.st2); g.cylZ(97, 56, 1.4, 94, 97, P.gAmb); g.box(96, 55, 97, 98, 57, 98, P.st1);
  for (const x of [86, 96, 106]) { windowOn(g, 's', x, 75, 54, 6, 10); }
  // Brick block: windows with tape, door with porch, sign.
  for (const x of [14, 30, 46, 62]) { windowOn(g, 's', x, 83, 7, 10, 11); tapeX(g, 's', x, 83, 7, 10, 11); windowOn(g, 's', x, 83, 29, 10, 10); }
  for (const x of [98, 110]) windowOn(g, 's', x, 83, 29, 6, 10);
  doorOn(g, 's', 82, 83, 2, 12, 18, { leaf: planks(NV, 2, 4) });
  g.box(78, 84, 20, 98, 92, 23, slab); for (const x of [78, 96]) g.box(x, 89, 2, x + 2, 91, 20, trimWhite);
  steps(g, 80, 96, 84, 1, base, 1, 2, 3);
  g.box(18, 84, 24, 66, 85, 30, P.blk); g.text('s', 20, 85, 28, 'OPERATIONS 2', CR[2]);
  for (const [face, p] of [['w', 8], ['e', 119]]) for (const y of [38, 60]) { windowOn(g, face, y, p, 7, 10, 11); windowOn(g, face, y, p, 29, 10, 10); }
  for (const x of [110, 90, 66, 42, 18]) windowOn(g, 'n', x, 30, 29, 10, 10);
  doorOn(g, 'n', 54, 30, 2, 9, 18, { leaf: planks(NV, 2, 4) });
  // Roof clutter: chimney stacks, water tank, wireless aerial.
  for (const x of [20, 56]) { g.box(x, 40, 47, x + 6, 46, 58, wall); g.box(x - 1, 39, 58, x + 7, 47, 59, slab); }
  g.box(32, 60, 48, 48, 72, 50, P.st1); g.box(33, 61, 50, 47, 71, 58, tin(TN, 3, 'y', 4));
  g.box(10, 34, 48, 12, 36, 80, darkSteel); g.line(11, 35, 79, 80, 40, 70, P.blk);
  // Ground details.
  bags(g, 66, 86, 76, 96, 8, 2); g.box(102, 86, 2, 108, 90, 10, P.red);
  bush(g, 14, 88, 4, 2, 3); bush(g, 44, 89, 3.5, 2, 4); tufts(g, 2, 14, 126, 28, 30, 61); tufts(g, 0, 30, 6, 90, 14, 62);
});

// ===== Terminal / station headquarters: symmetrical brick-and-render block, taller entrance
// hall with clock and flagpole, canopy, end pavilions, blast walls, benches, planters, bicycles.
def('bld_terminal', 'World', [14, 7], 92, g => {
  const brk = brick(BR, 2), rend = mottled(WH, 3, 9, .76, .14), slab = concrete(CN, 3), base = concrete(CN, 2);
  g.box(0, 18, 0, 224, 112, 1, concrete(CN, 3, 8));
  const block = (x0, y0, x1, y1, h, r = 0) => {
    const rnd = (x, y) => { if (!r) return true; for (const [cx, cy] of [[x0 + r, y1 - r], [x1 - r, y1 - r]]) if ((x < x0 + r && cx === x0 + r || x > x1 - r && cx === x1 - r) && y > y1 - r && Math.hypot(x - cx, y - cy) > r) return false; return true; };
    g.shape(x0, y0, 1, x1, y1, 20, (x, y) => rnd(x, y), brk);
    g.shape(x0, y0, 20, x1, y1, h, (x, y) => rnd(x, y), rend);
    g.shape(x0 - 1, y0 - 1, 19, x1 + 1, y1 + 1, 21, (x, y) => rnd(x, y), trimWhite);
    g.shape(x0 - 1, y0 - 1, h, x1 + 1, y1 + 1, h + 3, (x, y) => rnd(x, y) && (x < x0 + 1 || x > x1 - 1 || y < y0 + 1 || y > y1 - 1 || !rnd(x - 1.5, y) || !rnd(x + 1.5, y) || !rnd(x, y + 1.5)), trimWhite);
    g.box(x0 + 1, y0 + 1, h - 1, x1 - 1, y1 - 1, h, tarpaper(TP, 3));
  };
  block(16, 32, 208, 90, 40);
  block(6, 26, 44, 96, 46, 8); block(180, 26, 218, 96, 46, 8);
  block(84, 22, 140, 102, 60);
  // Entrance hall: tall stair window, clock, canopy, doors and steps.
  g.box(104, 101, 26, 120, 102, 56, glass); for (let z = 26; z < 56; z += 5) g.box(104, 101, z, 120, 102, z + 1, trimWhite); g.box(111.5, 101, 26, 112.5, 102, 56, trimWhite);
  g.erase(104, 101, 26, 120, 102, 56); g.box(104, 100, 26, 120, 101, 56, glass);
  for (let z = 26; z < 56; z += 5) g.box(104, 100, z, 120, 101, z + 1, trimWhite); g.box(111, 100, 26, 113, 101, 56, trimWhite);
  for (const x of [98, 124]) g.box(x, 101, 22, x + 2, 104, 60, rend);
  g.shape(88, 101, 44, 100, 103, 56, (x, y, z) => Math.hypot(x - 94, z - 50) <= 5.5 ? (Math.hypot(x - 94, z - 50) > 4.6 ? P.st1 : cream) : false);
  g.decal('s', 94, 102, 50, TP[1]); g.decal('s', 94, 102, 51, TP[1]); g.decal('s', 94, 102, 52, TP[1]); g.decal('s', 95, 102, 50, TP[1]); g.decal('s', 96, 102, 50, TP[1]);
  g.box(90, 102, 22, 134, 112, 25, slab); g.box(90, 111, 25, 134, 112, 28, trimWhite); g.text('s', 96, 111, 27, 'WORDWING', TP[1]);
  for (const x of [91, 131]) g.cylZ(x + 1, 109, 1.2, 1, 22, P.st2);
  doorOn(g, 's', 104, 101, 1, 16, 18, { leaf: darkGlass, knob: false });
  steps(g, 98, 126, 102, 2, base, 1, 1, 3);
  // Flagpole with a hanging flag, roof tank on the east pavilion.
  g.cylZ(112, 40, 1, 60, 92, P.wht); g.box(113, 40, 78, 114, 41, 91, P.red); g.box(113, 40, 82, 114, 41, 87, cream);
  g.box(190, 40, 46, 206, 56, 48, P.st1); g.box(191, 41, 48, 205, 55, 56, tin(TN, 3, 'y', 4));
  for (const x of [26, 64, 168]) { g.box(x, 50, 40, x + 6, 56, 50, brk); g.box(x - 1, 49, 50, x + 7, 57, 51, slab); }
  // Windows: ground (taped), first floor ribbon windows, pavilions, back and sides.
  for (const x of [50, 64, 152, 166]) { windowOn(g, 's', x, 89, 6, 9, 10); tapeX(g, 's', x, 89, 6, 9, 10); }
  for (const x of [50, 66, 150, 166]) windowOn(g, 's', x, 89, 25, 12, 9);
  for (const x of [14, 190]) { windowOn(g, 's', x, 95, 6, 9, 10); tapeX(g, 's', x, 95, 6, 9, 10); windowOn(g, 's', x + 14, 95, 6, 9, 10); windowOn(g, 's', x, 95, 26, 23, 10); }
  for (const x of [86, 128]) windowOn(g, 's', x, 101, 30, 8, 10);
  for (let x = 196; x > 20; x -= 18) { windowOn(g, 'n', x, 32, 6, 9, 10); windowOn(g, 'n', x, 32, 25, 9, 9); }
  doorOn(g, 'n', 116, 22, 1, 10, 18, { leaf: planks(NV, 2, 4) });
  for (const [face, p] of [['w', 6], ['e', 217]]) for (const y of [36, 60, 80]) { windowOn(g, face, y, p, 6, 9, 10); windowOn(g, face, y, p, 26, 9, 9); }
  // Blast walls, planters with shrubs, benches, lamp posts, bicycles.
  bags(g, 82, 104, 96, 110, 10, 1); bags(g, 128, 104, 142, 110, 10, 1);
  for (const x of [56, 160]) { g.box(x, 96, 1, x + 16, 103, 5, slab); bush(g, x + 4, 99.5, 4, 5, 5); bush(g, x + 12, 99.5, 3.6, 5, 6); g.box(x + 7, 99, 5, x + 9, 100, 7, P.redHi); }
  for (const x of [26, 186]) { g.box(x, 104, 3, x + 14, 107, 4, planks(WD, 3, 3)); g.box(x, 107, 4, x + 14, 108, 8, planks(WD, 3, 2)); for (const xx of [x + 1, x + 12]) g.box(xx, 104, 1, xx + 1, 108, 3, P.st1); }
  for (const x of [46, 176]) { g.box(x, 106, 1, x + 2, 108, 30, P.st1); g.box(x - 1, 105, 30, x + 3, 109, 33, P.st2); g.set(x, 107, 29, lampGlow); }
  for (const bx of [146, 152]) {
    for (const cy of [97, 106]) for (let a = 0; a < 6.3; a += .35) g.set(bx, cy + Math.cos(a) * 3.5, 4.5 + Math.sin(a) * 3.5, P.st1);
    g.line(bx, 97, 4.5, bx, 102, 8, P.redDk); g.line(bx, 102, 8, bx, 106, 4.5, P.redDk); g.line(bx, 99, 8, bx, 104, 8, P.redDk); g.box(bx - 1, 100, 9, bx + 1, 102, 10, P.blk); g.line(bx - 2, 105, 10, bx + 2, 105, 10, P.st2);
  }
  tufts(g, 0, 18, 224, 26, 50, 71); tufts(g, 0, 26, 5, 100, 14, 72); tufts(g, 219, 26, 224, 100, 14, 73);
});

// ===== Operations block: bomb-proof concrete core under an earth mound, blast-walled entrance,
// vents, plant room, aerial mast.
def('bld_ops_block', 'World', [8, 6], 64, g => {
  const core = concrete(CN, 3, 12), T = turf(4);
  g.box(28, 22, 0, 100, 74, 22, core);
  // Earth bank: north, west and east sides plus a thin cover on the roof.
  g.shape(0, 0, 0, 128, 84, 26, (x, y, z) => {
    const dx = Math.max(28 - x, 0, x - 100), dy = Math.max(22 - y, 0), d = Math.hypot(dx, dy);
    if (y > 74 && dx === 0) return false;
    let h = d === 0 ? 25 : 25 - d * .95;
    if (y > 70) h -= (y - 70) * 1.6;
    return z < h;
  }, T);
  g.erase(30, 72, 1, 98, 76, 22); g.box(28, 72, 0, 100, 74, 24, core); g.box(27, 73, 22, 101, 75, 25, flat(CN[3]));
  // Entrance: steel blast door, lamp, stencil, L-shaped blast wall.
  doorOn(g, 's', 58, 73, 0, 12, 17, { leaf: tin(ST, 2, 'y', 6), frame: P.st1 }); wallLamp(g, 64, 74, 19, 1);
  g.text('s', 34, 74, 18, 'OPS', TP[1], 2); g.box(80, 74, 8, 96, 75, 14, P.yel); g.text('s', 81, 75, 13, 'NO ADM', TP[1]);
  g.box(50, 84, 0, 80, 88, 16, core); g.box(76, 76, 0, 80, 84, 16, core); g.box(49, 83, 16, 81, 89, 17, flat(CN[4]));
  bags(g, 34, 80, 48, 88, 8);
  // Roof: plant room, mushroom vents, emergency hatch, aerial mast with guys.
  g.box(36, 28, 24, 56, 44, 38, brick(BR, 2)); g.box(35, 27, 38, 57, 45, 40, flat(CN[3]));
  for (let z = 28; z < 36; z += 2) g.box(40, 44, z, 52, 45, z + 1, P.st1);
  g.box(44, 32, 40, 48, 36, 52, brick(BR, 2)); g.box(43, 31, 52, 49, 37, 53, flat(CN[3]));
  for (const [x, y] of [[70, 34], [86, 50], [70, 60]]) { g.cylZ(x, y, 1.5, 24, 31, P.st2); g.ell(x, y, 31.5, 3.5, 3.5, 1.5, P.st1); }
  g.box(84, 30, 25, 94, 38, 27, P.st2);
  g.box(104, 30, 0, 106, 32, 62, darkSteel); for (const [x, y] of [[112, 18], [96, 18], [116, 44]]) g.line(105, 31, 58, x, y, 0, P.blk);
  g.box(98, 30, 54, 112, 32, 55, darkSteel);
  tufts(g, 2, 2, 126, 82, 50, 81, 1, 3);
});

// ===== Fire station: brick engine house with an open bay (fire tender inside) and a closed
// roller shutter, hose-drying tower, office annex, bell, hydrant.
def('bld_fire_station', 'World', [8, 6], 104, g => {
  const wall = brick(BR, 2), base = concrete(CN, 2), slab = concrete(CN, 3);
  g.box(0, 74, 0, 128, 96, 1, apron(3, 9));
  g.box(4, 16, 0, 124, 76, 1, base);
  g.box(8, 22, 1, 90, 76, 34, wall);
  gableRoofX(g, 5, 93, 18, 80, 34, 18, rooftile(RD, 2, 'x'), wall, 8, 90, 4);
  g.erase(10, 24, 1, 88, 74, 34);
  g.box(10, 24, 0, 88, 74, 1, concrete(CN, 1));
  g.box(8, 74, 1, 90, 76, 34, wall);
  // Bays: frames, open bay with the tender, roller shutter, shutter boxes.
  g.erase(14, 74, 1, 44, 76, 24); g.erase(52, 74, 1, 82, 76, 24);
  for (const [a, b] of [[12, 14], [44, 46], [50, 52], [82, 84]]) g.box(a, 75, 1, b, 77, 25, cream);
  g.box(12, 75, 24, 84, 77, 25, cream);
  fireTruck(g, 17, 20);
  const shutter = mat((x, y, z, f) => cl(RD, 2 + ((ix(z) % 3) === 0 ? -1 : 0)));
  g.box(52, 74, 1, 82, 75, 24, shutter); g.text('s', 66, 74, 16, '2', CR[2]);
  for (const [a, b] of [[14, 44], [52, 82]]) g.cylX(76.5, 22, 2, a, b, P.st2);
  g.box(24, 76, 25, 72, 77, 32, P.red); g.text('s', 25, 76, 30, 'FIRE STATION', CR[3]);
  // Hose tower.
  g.box(96, 24, 1, 118, 46, 82, wall);
  for (let z = 70; z < 82; z += 2) for (const [face, p] of [['s', 45], ['e', 117]]) { if (face === 's') g.box(100, p, z, 114, p + 1, z + 1, P.st1); else g.box(p, 28, z, p + 1, 42, z + 1, P.st1); }
  g.box(95, 23, 82, 119, 47, 84, slab); g.pyramid(94, 22, 120, 48, 84, 14, rooftile(RD, 2, 'x'));
  g.box(105, 34, 98, 107, 36, 104, P.st1);
  for (const x of [100, 107, 113]) { g.box(x - 1, 46, 64, x + 2, 48, 66, P.st1); for (let z = 30; z < 64; z++) g.set(x + Math.sin(z * .3 + x) * .5, 47, z, P.cr1); }
  for (const z of [10, 36, 56]) windowOn(g, 's', 103, 45, z, 8, 8, { bars: false });
  // Office annex.
  g.box(90, 46, 1, 122, 74, 24, wall); g.box(89, 45, 24, 123, 75, 27, slab);
  doorOn(g, 's', 96, 73, 1, 9, 17, { leaf: planks(RD, 1, 4) }); windowOn(g, 's', 110, 73, 8, 9, 9); flowerBox(g, 110, 73, 8, 9);
  // Bell on a bracket, hydrant, buckets, hose reel cart.
  g.box(91, 76, 20, 93, 80, 22, P.st1); g.ell(92, 80, 18, 2.2, 2.2, 2.5, P.brass);
  g.cylZ(102, 88, 2, 1, 9, P.red); g.ell(102, 88, 9.5, 2, 2, 1.5, P.red); g.cylY(102, 6, 1, 89, 91, P.red);
  g.box(46, 77, 6, 50, 78, 20, P.red); for (const z of [9, 14]) g.cylZ(48, 79.5, 1.3, z, z + 3, P.red);
  // Rear windows, chimney, side windows.
  for (const x of [80, 56, 32]) windowOn(g, 'n', x, 22, 12, 10, 10);
  windowOn(g, 'w', 34, 8, 12, 10, 10); windowOn(g, 'w', 54, 8, 12, 10, 10);
  g.box(20, 30, 40, 26, 36, 60, wall); g.box(19, 29, 60, 27, 37, 61, slab);
  tufts(g, 0, 10, 128, 20, 30, 91); tufts(g, 0, 20, 6, 76, 14, 92);
});

// ===== Met office: whitewashed hut, Stevenson screen, rain gauge, gas bottles, anemometer
// with spinning cups and a wind vane (animated).
def('bld_met_office', 'World', [5, 4], 66, (g, ctx) => {
  const wall = mottled(WH, 3, 11, .76, .14);
  g.box(4, 8, 0, 52, 46, 1, concrete(CN, 2));
  g.box(8, 12, 1, 48, 42, 22, wall);
  gableRoofX(g, 5, 51, 9, 45, 22, 12, tarpaper(TP, 3, 'x'), wall, 8, 48, 3);
  doorOn(g, 's', 14, 41, 1, 8, 17, { leaf: planks(PT, 1, 4) });
  windowOn(g, 's', 30, 41, 8, 12, 9, { shutters: trimGreen }); flowerBox(g, 30, 41, 8, 12);
  windowOn(g, 'n', 26, 12, 8, 10, 8); windowOn(g, 'e', 20, 47, 8, 10, 8);
  g.box(18, 42, 18, 46, 43, 22, P.blk); g.text('s', 20, 43, 21, 'MET OFFICE', CR[2]);
  g.cylZ(42, 18, 1.2, 28, 36, darkSteel);
  // Stevenson screen.
  for (const [x, y] of [[57, 42], [65, 42], [57, 49], [65, 49]]) g.box(x, y, 0, x + 1, y + 1, 12, P.wht3);
  g.box(55, 40, 12, 68, 51, 22, mat((x, y, z, f) => f === 'u' ? WH[4] : (ix(z) % 2 ? WH[3] : WH[2])));
  g.box(54, 39, 22, 69, 52, 24, P.wht);
  g.cylZ(54, 58, 2, 0, 6, flat(GD[1])); g.cylZ(54, 58, 1.2, 5.5, 6, P.blk);
  for (const x of [8, 12]) { g.cylZ(x, 52, 1.8, 0, 16, P.ol3); g.ell(x, 52, 16, 1.2, 1.2, 1, P.st2); }
  // Anemometer mast with rotating cups and a wind vane.
  const mx = 66, my = 20;
  g.cylZ(mx, my, 1, 0, 50, P.st2); g.box(mx - 3, my - 3, 0, mx + 4, my + 4, 2, concrete(CN, 3));
  for (const [x, y] of [[mx - 12, my], [mx + 10, my - 8], [mx + 6, my + 12]]) g.line(mx, my, 40, x, y, 0, P.blk);
  const a0 = ctx.frame / 4 * (Math.PI * 2 / 3);
  for (let k = 0; k < 3; k++) { const a = a0 + k * Math.PI * 2 / 3, cx = mx + Math.cos(a) * 6, cy = my + Math.sin(a) * 6; g.line(mx, my, 50, cx, cy, 50, P.st1); g.ell(cx, cy, 50, 1.6, 1.6, 1.4, k ? P.st3 : P.red); }
  g.cylZ(mx, my, 1.4, 50, 52, P.st1);
  const [wx, wy] = ctx.wind;
  g.line(mx - wx * 5, my - wy * 5, 45, mx + wx * 6, my + wy * 6, 45, P.st1);
  g.box(mx + wx * 6 - 1, my + wy * 6 - 1, 44, mx + wx * 6 + 1.5, my + wy * 6 + 1.5, 48, P.st1);
  g.ell(mx - wx * 6, my - wy * 6, 45, 1, 1, 1, P.yel);
  tufts(g, 0, 0, 80, 8, 18, 101); tufts(g, 50, 26, 80, 64, 18, 102);
}, { frames: 4, fps: 10, animated: true, margin: 8 });

// ======================= Dispersal and defence =======================
// U-shaped earth revetment open to the south: grassed bank, revetted inner face, ends sloping
// down toward the taxiway. o.face: 'bags' | 'timber'.
function revetment(g, FW, FD, o) {
  const ix0 = o.arm, ix1 = FW - o.arm, iy0 = o.arm, H = o.H, T = turf(o.seed);
  const dist = (x, y) => Math.hypot(Math.max(ix0 - x, 0, x - ix1), Math.max(iy0 - y, 0));
  const hAt = (x, y) => {
    const d = dist(x, y); if (d === 0) return 0;
    let h = d < 9 ? H : H * (1 - (d - 9) / (o.arm - 9));
    h *= Math.min(1, (FD + 2 - y) / 16);
    return h + fbm(x * .2, y * .2, o.seed) * 2 - 1;
  };
  g.shape(0, 0, 0, FW, FD, H + 2, (x, y, z) => z < hAt(x, y), T);
  // Inner revetting along the three inner faces.
  const face = o.face === 'bags' ? sandbag(SN, 2) : planks(WD, 2, 3);
  g.shape(ix0 - 3, iy0 - 3, 0, ix1 + 3, FD, H, (x, y, z) => { const d = dist(x, y); return d > 0 && d < 3 && z < hAt(x, y) - .5 && z < H - (y - FD + 18) * .8; }, face);
  if (o.face === 'timber') for (let t = 0; ; t += 12) {
    const pts = [];
    if (t < FD - iy0) pts.push([ix0 - 3, iy0 + t], [ix1 + 2, iy0 + t]);
    if (t < ix1 - ix0) pts.push([ix0 + t, iy0 - 3]);
    if (!pts.length) break;
    for (const [x, y] of pts) { const h = Math.min(H, hAt(x, y)); if (h > 2) g.box(x, y, 0, x + 1, y + 1, h + 1, P.wd1); }
  }
  g.shape(ix0, iy0, 0, ix1, FD, 1, () => true, mat((x, y, z, f) => cl(DT, 2 + (fbm(x * .15, y * .15, 5) > .6 ? 1 : 0) + (hash(ix(x), ix(y), 3) < .05 ? -1 : 0))));
  g.topPaint(ix0 + 2, iy0 + 2, ix1 - 2, FD, (x, y, z) => z === 0 && fbm(x * .1, y * .1, 9) > .5 ? leaf(3, 4) : null);
  // Bay number board, fire bucket stand, drum, chocks.
  const bx = ix0 + 4, by = iy0 + 2;
  g.box(bx, by, 0, bx + 1, by + 1, 14, P.wd1); g.box(bx + 12, by, 0, bx + 13, by + 1, 14, P.wd1);
  g.box(bx - 1, by + 1, 8, bx + 14, by + 2, 15, P.blk); g.text('s', bx, by + 1, 13, o.num, CR[2]);
  g.box(ix1 - 8, iy0 + 2, 0, ix1 - 6, iy0 + 4, 14, P.red); for (const z of [5, 10]) g.cylZ(ix1 - 7, iy0 + 5.5, 1.3, z, z + 3, P.red);
  drum(g, ix1 - 6, iy0 + 12, OL, 2, 0);
  tufts(g, 0, 0, FW, FD, o.tufts, o.seed + 3, 0, 3);
}
def('bld_revetment', 'World', [7, 6], 22, g => revetment(g, 112, 96, { arm: 24, H: 16, face: 'bags', num: 'D-4', seed: 3, tufts: 50 }), { margin: 4 });
def('bld_revetment_large', 'World', [10, 9], 26, g => revetment(g, 160, 144, { arm: 30, H: 20, face: 'timber', num: 'D-11', seed: 7, tufts: 80 }), { margin: 4 });

// ===== Hexagonal pillbox (type 22): thick concrete walls with splayed embrasures, turf on the
// roof, camouflage paint, blast wall in front of the rear entrance.
def('bld_pillbox', 'World', [3, 3], 24, g => {
  const cx = 24, cy = 26, A = 16;
  const ang = [90, 30, -30, -90, 210, 150].map(d => d * Math.PI / 180);
  const hexD = (x, y) => Math.max(...[90, 30, 150].map(d => { const a = d * Math.PI / 180; return Math.abs((x - cx) * Math.cos(a) + (y - cy) * Math.sin(a)); }));
  const camo = mat((x, y, z, f) => {
    if (hexD(x, y) < A - 2.5) return TP[1];
    const n = fbm(x * .12, y * .12 + z * .15, 13);
    return n > .6 ? cl(OL, 2) : n < .38 ? cl(SN, 2) : cl(CN, 3 + (hash(ix(x), ix(z), 2) < .1 ? -1 : 0));
  });
  g.shape(0, 0, 0, 48, 48, 14, (x, y) => hexD(x, y) <= A && hexD(x, y) > A - 4.5, camo);
  g.shape(0, 0, 0, 48, 48, 1, (x, y) => hexD(x, y) <= A - 4.5, flat(CN[1]));
  g.shape(0, 0, 14, 48, 48, 17, (x, y) => hexD(x, y) <= A + 1.5, concrete(CN, 2));
  g.shape(0, 0, 17, 48, 48, 21, (x, y, z) => hexD(x, y) <= A - 1 - (z - 17) * 2.2, turf(9));
  // Embrasures on five faces (the rear face, -90 deg, holds the door).
  for (const a of ang) {
    if (Math.abs(a + Math.PI / 2) < .01) continue;
    const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
    for (let z = 7; z < 11; z++) for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const px = x + .5 - cx, py = y + .5 - cy, d = px * nx + py * ny, t = px * tx + py * ty;
      if (d > A - 5 && d < A + 1 && Math.abs(t) < 2 + (d - (A - 5)) * .5) g.set(x, y, z, null);
    }
    const ex = cx + nx * (A + .5), ey = cy + ny * (A + .5);
    g.line(ex - tx * 6, ey - ty * 6, 11, ex + tx * 6, ey + ty * 6, 11, flat(CN[2]), .7);
  }
  g.erase(20, cy - A - 1, 1, 28, cy - A + 5, 12); g.box(20, cy - A + 4, 1, 28, cy - A + 5, 12, planks(WD, 1, 3));
  g.box(16, 1, 0, 32, 5, 11, concrete(CN, 2)); g.box(15, 0, 11, 33, 6, 12, flat(CN[3]));
  bags(g, 30, 41, 46, 47, 6); bags(g, 2, 40, 14, 46, 5);
  tufts(g, 0, 0, 48, 48, 40, 111, 0, 3);
}, { margin: 4 });

// ======================= Airfield props =======================
function runwayLight(g, lamp, lens) {
  g.cylZ(8, 8, 3.5, 0, 1.5, concrete(CN, 3)); g.cylZ(8, 8, 1, 1.5, 5, P.st1);
  g.cylZ(8, 8, 2.4, 5, 6, P.st2); g.ell(8, 8, 6.6, 2.1, 2.1, 1.8, lamp); g.set(8, 9, 7, lens);
  g.cylZ(8, 8, 2.6, 4.5, 5, P.yel);
}
def('prop_airfield_runway_light', 'World', [1, 1], 12, g => runwayLight(g, glow(CR[3]), glow(PAL.WHITE)), { margin: 3 });
def('prop_airfield_threshold_light', 'World', [1, 1], 12, g => runwayLight(g, P.gGrn, glow(PAL.WHITE)), { margin: 3 });
def('prop_airfield_obstruction_light', 'World', [1, 1], 12, g => runwayLight(g, P.gRed, glow(RD[4])), { margin: 3 });

// Rotating aerodrome beacon on a short lattice tripod: the lamp drum turns (8 frames) and the
// beam flares when it sweeps toward the viewer.
const BEACON_Z = 30;
def('prop_airfield_beacon', 'World', [1, 1], 38, (g, ctx) => {
  for (const [x, y] of [[2, 3], [14, 3], [8, 14]]) { g.line(x, y, 0, 8, 8, BEACON_Z - 6, P.st1); g.box(x - 1, y - 1, 0, x + 2, y + 2, 2, concrete(CN, 3)); }
  for (const z of [8, 16]) { const t = z / (BEACON_Z - 6); const p = [[2, 3], [14, 3], [8, 14]].map(([x, y]) => [x + (8 - x) * t, y + (8 - y) * t]); for (let k = 0; k < 3; k++) g.line(p[k][0], p[k][1], z, p[(k + 1) % 3][0], p[(k + 1) % 3][1], z, P.st2); }
  g.cylZ(8, 8, 4, BEACON_Z - 6, BEACON_Z - 5, P.st2);
  const a = ctx.frame / 8 * Math.PI * 2;
  g.shape(3, 3, BEACON_Z - 5, 13, 13, BEACON_Z + 1, (x, y) => {
    const r = Math.hypot(x - 8, y - 8); if (r > 3.2) return false;
    let da = Math.atan2(y - 8, x - 8) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
    return Math.abs(da) < .6 && r > 2.2 ? P.gAmb : Math.abs(Math.abs(da) - Math.PI) < .6 && r > 2.2 ? P.gWht : flat(GD[1]);
  });
  g.cone(8, 8, 3.6, 1, BEACON_Z + 1, BEACON_Z + 4, P.st1); g.set(8, 8, BEACON_Z + 4, P.st2);
}, {
  frames: 8, fps: 8, animated: true, margin: 14,
  overlay: (c, project, f) => {
    const a = f / 8 * Math.PI * 2;
    for (const [off, col] of [[0, FI[3]], [Math.PI, CR[3]]]) {
      const [sx, sy] = project(8, 8, BEACON_Z - 2), [ex, ey] = project(8 + Math.cos(a + off) * 4, 8 + Math.sin(a + off) * 4, BEACON_Z - 2);
      const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy) || 1;
      if (dy < -1) continue;
      const ux = dx / L, uy = dy / L, len = 4 + Math.max(0, dy) * 1.6;
      for (let t = 2; t < len; t += .5) for (let w = -t * .35; w <= t * .35; w += .5) {
        const x = sx + ux * (t + 2) - uy * w, y = sy + uy * (t + 2) + ux * w;
        if (dither(ix(x), ix(y), .9 - t / len * .8)) c.paint(x, y, withAlpha(col, 150));
      }
      if (dy > 2.5) for (let k = -3; k <= 3; k++) { c.paint(ex + k, ey, withAlpha(PAL.WHITE, 200)); c.paint(ex, ey + k, withAlpha(PAL.WHITE, 200)); }
    }
  }
});

// Apron floodlight tower: tapering lattice, platform with railing, six-lamp bank aimed south.
def('prop_airfield_floodlight', 'World', [2, 2], 82, g => {
  const H = 66, base = [[4, 4], [27, 4], [4, 27], [27, 27]], top = [[12, 12], [19, 12], [12, 19], [19, 19]];
  const p = (i, z) => [base[i][0] + (top[i][0] - base[i][0]) * z / H + .5, base[i][1] + (top[i][1] - base[i][1]) * z / H + .5];
  base.forEach(([x, y], i) => { g.line(...p(i, 0), 0, ...p(i, H), H, P.st1, .6); g.box(x - 1, y - 1, 0, x + 3, y + 3, 2, concrete(CN, 3)); });
  for (const [a, b] of [[0, 1], [1, 3], [3, 2], [2, 0]]) for (let z = 2; z < H; z += 13) {
    const z1 = Math.min(H, z + 13);
    g.line(...p(a, z), z, ...p(b, z1), z1, P.st2); g.line(...p(b, z), z, ...p(a, z1), z1, P.st2); g.line(...p(a, z1), z1, ...p(b, z1), z1, P.st1);
  }
  g.box(9, 9, H, 23, 23, H + 1, P.st2); railing(g, 9, 9, 23, 23, H + 1, 4, P.st1, 4);
  g.box(9, 21, H + 1, 23, 23, H + 13, P.st1);
  for (let k = 0; k < 6; k++) { const x = 10 + (k % 3) * 4.5, z = H + 3 + ix(k / 3) * 5; g.box(x, 22, z, x + 4, 25, z + 4, P.st2); g.box(x + 1, 25, z + 1, x + 3, 26, z + 3, glow(CR[3])); }
  for (let z = 2; z < H; z += 4) g.line(14, 24 - z / H * 5, z, 17, 24 - z / H * 5, z, P.st3);
  g.box(22, 28, 0, 28, 31, 8, P.ol2); g.line(25, 29, 8, 19, 20, H, P.blk); g.text('s', 23, 30, 6, '!', GD[3]);
}, { margin: 6 });

// Landing T: white boards on a low timber frame with a pivot, pegged into the grass.
def('prop_airfield_landing_t', 'World', [3, 3], 8, g => {
  const wh = mat((x, y, z, f) => f === 'u' ? (((ix(x) + ix(y)) % 7) === 0 ? WH[3] : WH[4]) : WH[2]);
  g.box(4, 4, 2, 44, 13, 3, wh); g.box(19, 13, 2, 29, 46, 3, wh);
  for (const [x, y] of [[5, 5], [42, 5], [5, 11], [42, 11], [20, 44], [27, 44], [20, 22], [27, 22]]) g.box(x, y, 0, x + 1, y + 1, 2, P.wd1);
  g.cylZ(24, 9, 2.5, 0, 2, P.st1); g.cylZ(24, 9, 1, 3, 4, P.st2);
  for (const [x, y] of [[2, 2], [46, 2], [24, 47]]) { g.box(x, y, 0, x + 1, y + 1, 3, P.wd2); g.line(x, y, 2, x < 10 ? 5 : x > 40 ? 43 : 24, y < 5 ? 5 : 45, 2, rope); }
}, { margin: 4 });

// Signal square: black panel in a white border inside a chained post fence, with a white
// dumbbell (use runways only) and a red square with yellow diagonals (landing prohibited).
def('prop_airfield_signal_square', 'World', [3, 3], 10, g => {
  g.box(3, 3, 0, 45, 45, 1, concrete(CN, 3));
  g.box(5, 5, 1, 43, 43, 2, P.wht); g.box(8, 8, 1, 40, 40, 2, P.blk);
  g.topPaint(10, 10, 38, 26, (x, y) => (Math.hypot(x - 14, y - 18) < 4 || Math.hypot(x - 34, y - 18) < 4 || (x > 14 && x < 34 && Math.abs(y - 18) < 1.5)) ? P.wht : null);
  g.topPaint(17, 28, 31, 38, (x, y) => (x < 18 || x >= 30 || y < 29 || y >= 37 ? P.red : (Math.abs((x - 17) - (y - 28)) < 1.3 || Math.abs((x - 17) + (y - 28) - 14) < 1.3) ? P.yel : P.red));
  const posts = []; for (let t = 0; t <= 4; t++) posts.push([1 + t * 11.5, 1], [1 + t * 11.5, 46], [1, 1 + t * 11.5], [46, 1 + t * 11.5]);
  for (const [x, y] of posts) { g.box(x, y, 0, x + 1, y + 1, 6, P.wht); g.set(x, y, 6, P.red); }
  for (const [a, b, c, d] of [[1, 1, 47, 1], [1, 46, 18, 46], [30, 46, 47, 46], [1, 1, 1, 47], [46, 1, 46, 47]]) g.line(a, b, 5, c, d, 5, P.st1);
}, { margin: 3 });

// Taxiway sign: black board with yellow letter and arrow on two posts with concrete feet.
def('prop_airfield_taxi_sign', 'World', [1, 1], 16, g => {
  for (const x of [2, 13]) { g.box(x - 1, 6, 0, x + 2, 9, 1, concrete(CN, 3)); g.box(x, 7, 1, x + 1, 8, 6, P.st1); }
  g.box(1, 7, 6, 15, 9, 13, P.blk); g.box(1, 9, 6, 15, 10, 7, P.yel); g.box(1, 9, 12, 15, 10, 13, P.yel);
  g.text('s', 3, 8, 11, 'A', GD[3]); g.bitmap('s', 9, 8, 11, ['#  ', '## ', '###', '## ', '#  '], { '#': GD[3] });
  g.text('n', 13, 7, 11, 'A', GD[3]);
}, { margin: 3 });

// Wheel chocks: a pair of timber wedges joined by a rope, ends painted yellow.
def('prop_airfield_chocks', 'World', [1, 1], 6, g => {
  const wedge = (x0, y0, flip) => g.shape(x0, y0, 0, x0 + 4, y0 + 9, 5, (x, y, z) => { const t = flip ? (y0 + 9 - y) / 9 : (y - y0) / 9; return z < 1 + t * 4; }, mat((x, y, z, f) => (x < x0 + 1 || x >= x0 + 3 ? GD[2] : WD[2 + (hash(ix(y), ix(z), 3) < .3 ? -1 : 0)])));
  wedge(3, 2, false); wedge(10, 5, true);
  g.line(5, 6, 3, 8, 10, 1, rope); g.line(8, 10, 1, 12, 9, 3, rope); g.ell(6, 13, .5, 2, 1.5, .6, rope);
}, { margin: 3 });

// Wheeled fire extinguisher trolley: red cylinder on two wheels, hose, handle, bell.
def('prop_airfield_fire_cart', 'World', [1, 1], 18, g => {
  g.cyl(8, 9, 4, 8, 4, 15, 3.4, mottled(RD, 2, 5, .7, .3)); g.ell(8, 4, 15.5, 2.4, 1.5, 1.2, P.redDk); g.set(8, 4, 17, P.brass);
  g.box(2, 7, 2, 14, 12, 3, P.st1); for (const [a, b] of [[1, 3], [13, 15]]) wheelX(g, 0, 10, 3.2, 3.2, a, b);
  g.line(4, 4, 6, 3, 1, 9, P.st1); g.line(12, 4, 6, 13, 1, 9, P.st1); g.line(3, 1, 9, 13, 1, 9, P.st2, .6);
  g.line(10, 6, 13, 13, 11, 6, rubber, .6); g.line(13, 11, 6, 12, 14, 2, rubber, .6); g.set(12, 14, 1, P.brass);
  g.text('s', 6, 12, 10, 'F', CR[2]);
}, { margin: 3 });

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

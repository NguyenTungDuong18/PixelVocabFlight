'use strict';
// World models: nature — trees (prop_tree_*), bushes (prop_bush*), small plants (prop_plant_*),
// rocks, stumps, logs and the falling-leaf effects (fx_leaves_*, fx_petals).
// Look: cozy and readable (round leaf clumps lit on top, darker underneath, branches showing
// between clumps, roots gripping the ground), 1944 airfield flavour. Plants sway toward the
// world wind (screen right) by shearing a cached base model per frame (see plant()).
const { PAL, ramp, hash, fbm, Canvas } = require('../lib.cjs');
const { Model, mat } = require('../voxel.cjs');
const { CR, GD, RD, WD, SM, SN, OL } = PAL;
const { cl, ix, flat, def, smokeOverlay } = require('./common.cjs');

// ---------------- Ramps (registered so the renderer can shade along them) ----------------
const LF = ramp('#1c2e17', '#284120', '#355829', '#467233', '#5b8c3b', '#78a84a', '#9cc463'); // warm leaf green
const CF = ramp('#11201a', '#183024', '#22422f', '#2e563a', '#3d6c47', '#548856');            // conifer
const AU = ramp('#4b1c0e', '#772f14', '#a3471a', '#cb6a22', '#e8932f', '#f5bd4a', '#fbe08a'); // autumn
const PK = ramp('#5c3b4c', '#8a5068', '#b9708a', '#df9cad', '#f4c6cc', '#fde6e4');            // blossom
const BK = ramp('#2c2a26', '#4d4a42', '#7d7a6d', '#b3b0a0', '#dcd9c9', '#f2f0e4');            // birch bark
const OB = ramp('#241e19', '#3a3028', '#524335', '#6b5843', '#877052', '#a38a66');            // grey-brown bark
const RK = ramp('#262623', '#3a3a34', '#53524a', '#706e62', '#8f8c7d', '#b1ad9a', '#d0ccb8'); // rock
const YG = ramp('#2c3812', '#43541a', '#5e7224', '#7d912e', '#a0b13f', '#c5d260');            // banana / palm yellow-green
const VI = ramp('#2d2547', '#47396e', '#675596', '#8e7dbd', '#b8abdd');                       // violet flowers
const CH = ramp('#141312', '#22201d', '#33302b', '#4a4640', '#67625a');                       // charcoal

const mod = (a, n) => ((ix(a) % n) + n) % n;
const TAU = Math.PI * 2;

// ---------------- Materials ----------------
// Leaf mass: staggered tufts (lit crest, dark notch) plus a top-to-bottom gradient across the
// clump, so each clump reads as one rounded ball like hand-painted foliage.
function foliage(R, base, cz, rz, s = 1) {
  return mat((x, y, z, f) => {
    const t = (z - cz) / rz;
    let k = base + (t > .5 ? 1 : t < -.7 ? -2 : t < -.15 ? -1 : 0);
    const u = f === 'u' || f === 's' || f === 'n' ? x : y, v = f === 'u' ? y : -z;
    const row = ix(v / 4), vv = mod(v, 4), uu = mod(u + (row & 1) * 3 + ix(hash(row, s, 3) * 6), 6);
    if (vv === 0 && uu > 0 && uu < 4 && t > -.3) k += 1;
    else if (vv === 3 && uu === 0) k -= 1;
    return cl(R, k);
  });
}
// Bark with vertical grain (u along the circumference, v = height).
function bark(R, base = 2, s = 1) {
  return mat((x, y, z, f) => {
    if (f === 'u') return cl(R, base + (hash(ix(x), ix(y), s) < .3 ? -1 : 0));
    const u = f === 's' || f === 'n' ? x : y, g = hash(ix(u), ix(z / 3), s);
    return cl(R, base + (g < .22 ? -1 : g > .9 ? 1 : 0) + (mod(u, 3) === 0 && hash(ix(u), ix(z / 5), s + 1) < .5 ? -1 : 0));
  });
}
// Birch: pale bark with dark horizontal lenticels, darker near the ground.
const birchBark = mat((x, y, z, f) => {
  const u = f === 's' || f === 'n' || f === 'u' ? x : y;
  if (z < 4) return cl(BK, 2 + (hash(ix(u), ix(z), 4) < .4 ? -1 : 0));
  if (hash(ix(z), ix(u / 3), 6) < .16 && mod(z, 2) === 0) return BK[1];
  return cl(BK, 4 + (hash(ix(u), ix(z / 4), 5) < .25 ? -1 : 0));
});
// Palm: ringed trunk.
const palmBark = mat((x, y, z, f) => cl(OB, 3 + (mod(z, 3) === 0 ? -1 : 0) + (f !== 'u' && hash(ix(x + y), ix(z), 7) < .15 ? 1 : 0)));
// Cut wood end with growth rings around (ax, ay) in face coordinates.
const rings = (cu, cv, R = WD, base = 3) => (u, v) => { const d = Math.hypot(u - cu, v - cv); return d >= 1.5 && mod(d + .5, 2) === 0 ? cl(R, base - 1) : cl(R, base + (d < 1 ? -1 : 0)); };
function stone(base = 3, s = 1, moss = 0) {
  return mat((x, y, z, f) => {
    const n = fbm(x * .22, y * .22 + z * .22, 200 + s);
    if (moss && (f === 'u') && fbm(x * .18, y * .18 + z * .1, 210 + s) > 1 - moss) return cl(LF, 3 + (n > .55 ? 1 : 0));
    return cl(RK, base + (n > .62 ? 1 : n < .36 ? -1 : 0) + (hash(ix(x), ix(y) + ix(z) * 13, s) < .04 ? -1 : 0));
  });
}
const tint = (R, i) => flat(cl(R, i));

// ---------------- Shapes ----------------
// Lumpy ellipsoid; flatter underside so clumps sit like cushions.
function blob(g, cx, cy, cz, rx, ry, rz, m, s = 1, lump = .32) {
  g.shape(cx - rx - 2, cy - ry - 2, Math.max(0, cz - rz - 2), cx + rx + 2, cy + ry + 2, cz + rz + 2, (x, y, z) => {
    let dz = (z - cz) / rz; if (dz < 0) dz *= 1.25;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + dz * dz;
    if (d > 1.6) return false;
    return d <= 1 + lump * (fbm(x * .2 + s * 3.1, y * .2 + z * .2, 90 + s) - .5) * 2.2;
  }, m);
}
// Tapered limb along a polyline (trunks, branches, stems).
function limb(g, pts, r0, r1, m) {
  let L = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); L += l; }
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], ra = r0 + (r1 - r0) * acc / L; acc += seg[i - 1];
    const rb = r0 + (r1 - r0) * acc / L, n = Math.max(1, Math.ceil(seg[i - 1] / 2));
    const p = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, r = ra + (rb - ra) * (t0 + t1) / 2;
      const [x0, y0, z0] = p(t0), [x1, y1, z1] = p(t1);
      if (r < .75) g.line(x0, y0, z0, x1, y1, z1, m); else g.cyl(x0, y0, z0, x1, y1, z1 + .01, r, m);
    }
  }
}
// Root flares that grip the ground.
function roots(g, cx, cy, n, len, r, m, s = 1) {
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU + hash(k, s, 11) * 1.1, l = len * (.6 + hash(k, s, 12) * .6);
    limb(g, [[cx, cy, 3.5], [cx + Math.cos(a) * l * .55, cy + Math.sin(a) * l * .55, 1.2], [cx + Math.cos(a) * l, cy + Math.sin(a) * l, .3]], r, .6, m);
  }
}
// Grass tufts around a base (3 blades each, lit tip).
function tufts(g, cx, cy, r0, r1, n, s = 1, R = LF, base = 3) {
  for (let k = 0; k < n; k++) {
    const a = hash(k, s, 31) * TAU, d = r0 + (r1 - r0) * hash(k, s, 32), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const h = 2 + ix(hash(k, s, 33) * 3);
    for (const [dx, hh] of [[0, h], [-1, h - 1], [1, h - 2]]) for (let z = 0; z < hh; z++) if (!g.has(x + dx, y, z)) g.set(x + dx, y, z, tint(R, base + (z === hh - 1 ? 1 : z === 0 ? -1 : 0)));
  }
}
// Flat carpet of fallen leaves / petals (one outlined patch, ragged edge) at z = 0.
function carpet(g, cx, cy, rx, ry, R, base, s = 1) {
  g.shape(cx - rx - 2, cy - ry - 2, 0, cx + rx + 2, cy + ry + 2, 1, (x, y) => {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry), n = fbm(x * .25, y * .25, 300 + s);
    if (d > 1 + (n - .5) * .45 || g.has(x, y, 0)) return false;
    const h = hash(ix(x), ix(y), s);
    return tint(R, base + (h < .3 ? -1 : h > .8 ? 1 : 0));
  });
}
// Small items stuck onto the outside of the leaf mass (fruit, flowers): ray from the crown
// centre outward, first empty voxel after the surface.
function studs(g, cx, cy, cz, n, size, m, s = 1, minZ = 0) {
  for (let k = 0; k < n; k++) {
    const a = hash(k, s, 41) * TAU, e = (hash(k, s, 42) - .35) * 1.3;
    const dx = Math.cos(a) * Math.cos(e), dy = Math.sin(a) * Math.cos(e), dz = Math.sin(e);
    let last = null;
    for (let t = 0; t < 40; t += .5) {
      const x = cx + dx * t, y = cy + dy * t, z = cz + dz * t;
      if (g.has(x, y, z)) last = [x, y, z]; else if (last) break;
    }
    if (!last || last[2] < minZ) continue;
    const [x, y, z] = last;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) for (let h = 0; h < size; h++) g.set(x + dx + i, y + dy + j, z + dz + h - (size > 1 ? 1 : 0), m);
  }
}

// ---------------- Broadleaf crown ----------------
// One top clump + a ring of satellite clumps on branches from the trunk top.
// o: x, y, z (crown centre), rx, ry (spread), r (clump radius), n (satellites), from (branch
// start height), tx/ty (branch origin), R/base (leaf ramp), bk (bark), s (seed), squash (rz/r).
function crown(g, o) {
  const { x, y, z, rx, ry = rx, r, n, from, R, base = 3, bk, s = 1, squash = .82 } = o, tx = o.tx ?? x, ty = o.ty ?? y;
  const cls = [[x + (hash(s, 1, 1) - .5) * 3, y + (hash(s, 1, 2) - .5) * 3, z + r * .45, r * (o.top ?? 1.12)]];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU + hash(k, s, 1) * .9 + s, d = .65 + hash(k, s, 2) * .4;
    cls.push([x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, z + (hash(k, s, 3) - .55) * r * 1.1, r * (.66 + hash(k, s, 4) * .38)]);
  }
  for (const c of o.extra || []) cls.push(c);
  for (const [cx, cy, cz, cr] of cls.slice(1)) {
    const zs = from + (cz - from) * .25;
    limb(g, [[tx, ty, from], [tx + (cx - tx) * .45, ty + (cy - ty) * .45, zs + (cz - zs) * .5], [cx, cy, cz - cr * .3]], o.br ?? 1.6, .7, bk);
  }
  cls.forEach(([cx, cy, cz, cr], i) => blob(g, cx, cy, cz, cr, cr, cr * squash, foliage(R, base, cz, cr * squash, s * 7 + i), s * 13 + i));
  return cls;
}

// ---------------- Sway: cached base model sheared per frame toward the wind ----------------
const CACHE = new Map();
function plant(id, foot, height, build, o = {}) {
  const frames = o.frames ?? 4, amp = o.amp ?? .9, lean = o.lean ?? .45, from = o.from ?? .25;
  def(id, 'World', foot, height, (g, ctx) => {
    let b = CACHE.get(id);
    if (!b) {
      b = new Model(g.fw, g.fh, g.H, g.m); build(b, ctx);
      b.topZ = 1; for (let i = 0; i < b.vox.length; i++) if (b.vox[i]) b.topZ = Math.max(b.topZ, ix(i / (b.W * b.D)) + 1);
      CACHE.set(id, b);
    }
    g.mats = b.mats; g.matIds = b.matIds; g.decals = b.decals;
    const ph = ctx.frame / frames * TAU, [wx, wy] = ctx.wind, W = b.W, D = b.D;
    for (let z = 0; z < b.topZ; z++) {
      const t = Math.max(0, z / b.topZ - from) / (1 - from), sh = frames > 1 ? (lean + amp * Math.sin(ph)) * t ** 1.7 : 0;
      const ox = Math.round(wx * sh), oy = Math.round(wy * sh), L = z * W * D;
      for (let y = 0; y < D; y++) {
        const ny = y + oy; if (ny < 0 || ny >= D) continue;
        for (let x = 0; x < W; x++) { const v = b.vox[L + y * W + x], nx = x + ox; if (v && nx >= 0 && nx < W) g.vox[L + ny * W + nx] = v; }
      }
    }
  }, { frames, fps: o.fps ?? 3, animated: frames > 1, margin: o.margin ?? 8, overlay: o.overlay });
}
const still = (id, foot, h, build, margin = 6) => plant(id, foot, h, build, { frames: 1, margin });

// ---------------- Broadleaf trees ----------------
function oak(foot, s, S, R = LF, base = 3) {
  const c = foot * 8;
  return g => {
    const bk = bark(WD, 3, s);
    roots(g, c, c, 5, 7 * S, 1.6 * S, bk, s);
    limb(g, [[c, c, 0], [c - .5, c + .5, 12 * S], [c + 1, c, 22 * S]], 3.4 * S, 2.4 * S, bk);
    limb(g, [[c, c, 14 * S], [c - 7 * S, c + 2, 24 * S]], 1.8 * S, 1, bk);
    crown(g, { x: c, y: c, z: 36 * S, rx: 15 * S, r: 9.5 * S, n: 6, from: 20 * S, tx: c + 1, ty: c, R, base, bk, s });
    tufts(g, c, c, 3 * S, 6 * S, 6, s);
  };
}
plant('prop_tree_oak', [3, 3], 72, oak(3, 1, 1.25), { margin: 12 });
plant('prop_tree_oak_m', [2, 2], 56, oak(2, 2, 1, LF, 3), { margin: 10 });

// Autumn maple (orange) and autumn beech (gold): round crowns over a carpet of fallen leaves.
function autumn(s, base) {
  return g => {
    const bk = bark(OB, 3, s), c = 16;
    roots(g, c, c, 4, 6, 1.4, bk, s);
    limb(g, [[c, c, 0], [c + 1, c, 10], [c - 1, c + 1, 20]], 2.8, 2, bk);
    crown(g, { x: c, y: c, z: 38, rx: 12, r: 9, n: 5, from: 22, R: AU, base, bk, s, squash: .88 });
  };
}
plant('prop_tree_autumn', [2, 2], 56, autumn(3, 3), { margin: 10 });
plant('prop_tree_autumn_y', [2, 2], 56, autumn(5, 4), { margin: 10 });

// Birch: slim leaning white trunk(s), loose light crown. Green and golden.
function birch(s, R, base, twin) {
  return g => {
    const c = 8, bk = birchBark;
    const trunks = twin ? [[[c - 1, c, 0], [c - 3, c, 18], [c - 5, c - 1, 36], [c - 5, c, 48]], [[c + 1, c + 1, 0], [c + 3, c + 1, 14], [c + 5, c + 2, 28], [c + 6, c + 1, 38]]]
      : [[[c, c, 0], [c + 1, c, 18], [c - 1, c + 1, 36], [c, c, 50]]];
    trunks.forEach((p, i) => {
      limb(g, p, 2.1 - i * .3, 1, bk);
      const [x, y, z] = p[p.length - 1];
      crown(g, { x, y, z: z - 9, rx: 9 - i, r: 6.5 - i * .6, n: 6, from: z - 20, tx: x, ty: y, R, base, bk: tint(BK, 1), s: s + i, squash: 1, br: .9, top: 1, extra: [[x + 5, y + 1, z - 16, 4.2], [x - 4, y + 2, z - 12, 4.6]] });
    });
    tufts(g, c, c, 2, 5, 5, s);
  };
}
plant('prop_tree_birch', [1, 1], 64, birch(11, LF, 4, false), { margin: 12 });
plant('prop_tree_birch_gold', [1, 1], 60, birch(12, AU, 5, true), { margin: 14 });

// Lombardy poplar: tall narrow column of stacked clumps (rows along European runways).
function poplar(h, s) {
  return g => {
    const c = 8, bk = bark(OB, 3, s), z0 = 8, n = Math.round(h / 6);
    roots(g, c, c, 4, 4, 1.1, bk, s);
    limb(g, [[c, c, 0], [c, c, h - 6]], 2, .8, bk);
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), z = z0 + 4 + t * (h - z0 - 12), r = 6.4 * Math.sin(Math.PI * (.12 + t * .8)) ** .7 + .8;
      const ox = (hash(k, s, 1) - .5) * 2.4, oy = (hash(k, s, 2) - .5) * 2.4;
      blob(g, c + ox, c + oy, z, r, r, 5.2, foliage(LF, 3, z, 5.2, s + k), s + k * 3, .25);
    }
  };
}
plant('prop_tree_poplar', [1, 1], 84, poplar(80, 21), { margin: 6, amp: 1.1 });
plant('prop_tree_poplar_s', [1, 1], 60, poplar(56, 22), { margin: 6, amp: 1 });

// Weeping willow: dome crown with a ragged curtain of hanging leaves.
plant('prop_tree_willow', [2, 2], 60, g => {
  const c = 16, bk = bark(OB, 3, 31);
  roots(g, c, c, 5, 7, 1.6, bk, 31);
  limb(g, [[c, c, 0], [c - 1, c + 1, 12], [c + 1, c, 26]], 3.4, 2.4, bk);
  crown(g, { x: c, y: c, z: 38, rx: 10, r: 9, n: 5, from: 24, R: LF, base: 4, bk, s: 31, squash: .7 });
  const rr = a => 15 + 2.5 * (fbm(Math.cos(a) * 2 + 9, Math.sin(a) * 2, 320) - .5) * 2;
  const bot = a => 8 + 10 * fbm(Math.cos(a) * 3, Math.sin(a) * 3 + 5, 321);
  const strand = mat((x, y, z) => { const a = Math.atan2(y - c, x - c), st = hash(ix((a + 4) * 22), 0, 322); return cl(LF, 4 + (z > 30 ? 1 : z < 16 ? -1 : 0) + (st < .35 ? -2 : st > .85 ? 1 : 0)); });
  g.shape(c - 20, c - 20, 6, c + 20, c + 20, 38, (x, y, z) => {
    const a = Math.atan2(y - c, x - c), d = Math.hypot(x - c, y - c), R0 = rr(a) - (38 - z) * .08 + (z > 30 ? (z - 30) * -.6 : 0);
    if (z < bot(a) || d > R0 || d < R0 - 2.2) return false;
    return fbm(Math.cos(a) * 5 + 3, Math.sin(a) * 5, 323) > .42;
  }, strand);
}, { margin: 12, amp: 1 });

// Apple tree: low split trunk, round crown studded with red apples, a couple fallen.
function fruitTree(s, R, base, fruit, petal) {
  return g => {
    const c = 16, bk = bark(OB, 3, s);
    roots(g, c, c, 4, 5, 1.3, bk, s);
    limb(g, [[c, c, 0], [c, c, 10]], 2.6, 2.2, bk);
    for (const [dx, dy] of [[-6, 1], [5, -2], [1, 5]]) limb(g, [[c, c, 9], [c + dx * .6, c + dy * .6, 15], [c + dx, c + dy, 21]], 1.7, 1, bk);
    const cls = crown(g, { x: c, y: c, z: 26, rx: 10, r: 8, n: 5, from: 18, R, base, bk, s, squash: .85 });
    if (fruit) {
      studs(g, c, c, 26, 14, 2, mat((x, y, z, f) => cl(RD, f === 'u' ? 4 : 3)), s, 16);
      for (const [x, y] of [[c + 9, c + 6], [c - 5, c + 9]]) g.box(x, y, 0, x + 2, y + 2, 2, mat((x, y, z, f) => cl(RD, f === 'u' ? 4 : 2)));
    }
    if (petal) studs(g, c, c, 26, 24, 1, tint(PK, 5), s + 5, 18);
    return cls;
  };
}
plant('prop_tree_apple', [2, 2], 44, fruitTree(41, LF, 3, true, false), { margin: 10, amp: .7 });
plant('prop_tree_blossom', [2, 2], 44, fruitTree(42, PK, 3, false, true), { margin: 10, amp: .7 });

// ---------------- Conifers ----------------
// Stacked drooping tiers (hollow underside so every tier casts a dark shelf on the next).
function pine(foot, h, rBase, n, s) {
  return g => {
    const c = foot * 8, bk = bark(WD, 2, s);
    roots(g, c, c, 4, 5, 1.4, bk, s);
    limb(g, [[c, c, 0], [c, c, h]], 2.4, .8, bk);
    const z0 = h * .16, H = h - z0;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, zb = z0 + H * t0 * .9, zt = zb + H / n * 1.3, rb = rBase * (1 - t0 * .78);
      const m = foliage(CF, 4, zb + (zt - zb) * .3, (zt - zb) * .5, s + k);
      g.shape(c - rb - 3, c - rb - 3, zb - 1, c + rb + 3, c + rb + 3, zt, (x, y, z) => {
        const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), ca = d ? dx / d : 1, sa = d ? dy / d : 0;
        const edge = rb * (1 + .45 * (fbm(ca * 2.2 + k * 3, sa * 2.2, 400 + s) - .5)) + (mod(Math.atan2(dy, dx) * 7 / Math.PI + k, 2) < .5 ? -1 : 0);
        const tt = (z - zb) / (zt - zb);
        return d <= edge * (1 - tt) ** .75 && z >= zb + 5 * (1 - d / edge) - 1.5;
      }, m);
    }
    tufts(g, c, c, 3, 7, 5, s, CF, 3);
  };
}
plant('prop_tree_pine', [2, 2], 84, pine(2, 80, 15, 5, 51), { margin: 8, amp: .8 });
plant('prop_tree_pine_s', [1, 1], 52, pine(1, 48, 9.5, 4, 52), { margin: 6, amp: .8 });

// ---------------- Tropical ----------------
// Palm crown: drooping pinnate fronds with leaflets, coconuts, a dead frond hanging.
function palmCrown(g, cx, cy, cz, n, L0, s) {
  for (let k = 0; k < n; k++) {
    const dead = k === 3 || k === 8;
    const a = k / n * TAU + hash(k, s, 9) * .5, L = (L0 + hash(k, s, 2) * 5) * (dead ? .7 : 1), lift = dead ? -4 : 4 + hash(k, s, 3) * 4;
    const dx = Math.cos(a), dy = Math.sin(a);
    const R = dead ? WD : YG, b = dead ? 3 : (k % 3 === 0 ? 3 : 4) - (lift < 5 ? 1 : 0);
    const rib = tint(R, b + 1), lf = tint(R, b), lo = tint(R, b - 1);
    const pos = t => [cx + dx * L * t, cy + dy * L * t, cz + 1 + lift * t * 2.2 - (lift * 2.2 + (dead ? 16 : 11)) * t * t];
    for (let t = 0; t <= 1; t += .02) {
      const [x, y, z] = pos(t); g.set(x, y, z, rib);
      if (t < .1) continue;
      const ll = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 3.6 + .6; if (mod(t * L * 1.4, 2) >= 1) continue;
      for (const sd of [-1, 1]) for (let u = .5; u <= ll; u += .5) g.set(x - dy * sd * u, y + dx * sd * u, z - u * .75, u > ll - 1.2 ? lo : lf);
    }
  }
  for (const [dx, dy] of [[-1.6, 1.4], [1.5, 1], [0, -1.6], [1, 2.2]]) g.ell(cx + dx, cy + dy, cz - 2, 1.5, 1.5, 1.5, mat((x, y, z, f) => cl(YG, f === 'u' ? 3 : 2)));
  g.ell(cx, cy, cz + 1, 2.4, 2.4, 2.2, tint(YG, 2));
}
function palm(trunks, s) {
  return g => {
    for (const [bx, by, ex, ey, h, n, L] of trunks) {
      const P = t => [bx + (ex - bx) * t * t, by + (ey - by) * t * t, h * t];
      for (let t = 0; t < 1; t += .02) { const [x, y, z] = P(t), [x1, y1, z1] = P(t + .02); g.cyl(x, y, z, x1, y1, z1 + .5, 2.5 - t * .8, palmBark); }
      g.cylZ(bx, by, 3.4, 0, 2, palmBark);
      const [cx, cy, cz] = P(1);
      palmCrown(g, cx, cy, cz, n, L, s + bx);
    }
  };
}
plant('prop_tree_palm', [2, 2], 92, palm([[15, 18, 21, 13, 72, 11, 19]], 61), { margin: 22, amp: 1.4, lean: .6 });
plant('prop_tree_palm_twin', [2, 2], 92, palm([[13, 17, 6, 12, 70, 10, 18], [18, 17, 26, 20, 50, 9, 15]], 62), { margin: 22, amp: 1.4, lean: .6 });
plant('prop_tree_palm_young', [1, 1], 40, g => {
  limb(g, [[8, 9, 0], [8, 8, 8], [9, 8, 16]], 2.2, 1.6, palmBark);
  palmCrown(g, 9, 8, 16, 8, 11, 63);
}, { margin: 14, amp: 1.2 });

// Banana: clustered pseudo-stems, broad torn paddle leaves, a hanging bunch.
plant('prop_tree_banana', [1, 1], 44, g => {
  const c = 8, stem = mat((x, y, z, f) => cl(YG, 2 + (hash(ix(x + y), ix(z / 3), 71) < .3 ? -1 : 0)));
  for (const [x, y, h, r] of [[c, c, 22, 2.2], [c + 3, c + 2, 14, 1.6], [c - 3, c + 2, 10, 1.4]]) limb(g, [[x, y, 0], [x, y, h]], r + .4, r, stem);
  const leafAt = (bx, by, bz, a, L, rise, k) => {
    const dx = Math.cos(a), dy = Math.sin(a), mid = tint(YG, 4), lf = mat((x, y, z) => cl(YG, 3 + (hash(ix(x), ix(y) + ix(z) * 9, k) < .12 ? 1 : 0)));
    for (let t = 0; t <= 1; t += .025) {
      const x = bx + dx * L * t, y = by + dy * L * t, z = bz + rise * t - (rise + 4) * t * t;
      g.set(x, y, z, mid);
      if (t < .12 || hash(ix(t * 40), k, 72) < .14) continue; // torn slits
      const w = Math.sin(Math.PI * t) * 2.8 + .4;
      for (const sd of [-1, 1]) for (let u = .5; u <= w; u += .5) g.set(x - dy * sd * u, y + dx * sd * u, z - u * .35, lf);
    }
  };
  for (let k = 0; k < 5; k++) leafAt(c, c, 22, k / 5 * TAU + .3, 15 + hash(k, 3, 73) * 4, 13 + hash(k, 4, 73) * 4, k);
  leafAt(c + 3, c + 2, 14, 1.2, 10, 6, 9); leafAt(c - 3, c + 2, 10, 2.4, 9, 5, 10);
  g.line(c + 1, c + 1, 21, c + 4, c + 3, 14, tint(YG, 2));
  for (let z = 14; z < 19; z++) g.cylZ(c + 4, c + 3, 2 - (z - 14) * .2, z, z + 1, mat((x, y, zz, f) => cl(GD, f === 'u' ? 3 : 2 - (z & 1))));
  g.ell(c + 4, c + 3.5, 12, 1.1, 1.1, 1.6, tint(RD, 1));
}, { margin: 14, amp: 1 });

// Jungle giant: buttress roots, tall grey trunk, layered umbrella crown, hanging vines.
plant('prop_tree_jungle', [2, 2], 90, g => {
  const c = 16, bk = bark(SM, 3, 81);
  limb(g, [[c, c, 0], [c, c, 30], [c + 1, c - 1, 54]], 3.2, 2, bk);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * TAU + .4, dx = Math.cos(a), dy = Math.sin(a);
    g.shape(c - 13, c - 13, 0, c + 13, c + 13, 16, (x, y, z) => { const ax = x - c, ay = y - c, al = ax * dx + ay * dy, sd = Math.abs(-ax * dy + ay * dx); return sd < .9 && al > 2 && al < 11 && z < 14 * (1 - (al - 2) / 9) ** 1.5; }, bk);
  }
  const cls = crown(g, { x: c, y: c, z: 60, rx: 15, r: 9, n: 6, from: 44, R: LF, base: 3, bk, s: 81, squash: .55, top: 1.25 });
  crown(g, { x: c + 2, y: c, z: 40, rx: 12, r: 5.5, n: 3, from: 30, R: LF, base: 2, bk, s: 82, squash: .6, top: .01 });
  const vine = tint(LF, 2), vl = tint(LF, 4);
  for (const [x, y, z, r] of cls.slice(1)) for (const o of [-.4, .5]) {
    const vx = x + r * o, vy = y + r * .6, z0 = g.top(ix(vx), ix(vy));
    if (z0 < 20) continue;
    const len = 10 + hash(ix(vx), ix(vy), 83) * 14;
    for (let t = 0; t < len; t++) { const xx = vx + Math.sin(t * .5) * .6; g.set(xx, vy, z0 - 4 - t, vine); if (t % 3 === 1) g.set(xx + 1, vy, z0 - 4 - t, vl); }
  }
  tufts(g, c, c, 5, 12, 10, 81);
}, { margin: 18, amp: .8 });

// Banyan / strangler fig: thick trunk, broad flat canopy, aerial roots dropping to the ground.
plant('prop_tree_jungle_b', [2, 2], 64, g => {
  const c = 16, bk = bark(OB, 3, 91), aer = bark(OB, 4, 92);
  roots(g, c, c, 6, 9, 2, bk, 91);
  limb(g, [[c, c, 0], [c + 1, c, 16], [c, c + 1, 30]], 4.6, 3.4, bk);
  const cls = crown(g, { x: c, y: c, z: 42, rx: 17, ry: 14, r: 9.5, n: 7, from: 28, R: LF, base: 3, bk, s: 91, squash: .58, br: 2.2 });
  for (const [x, y, z, r] of cls.slice(1)) for (const o of [.2]) {
    const ax = x + r * o, ay = y + r * .35;
    if (hash(ix(ax), ix(ay), 93) < .45) continue;
    limb(g, [[ax, ay, z - r * .4], [ax + .5, ay, 10], [ax + 1, ay + .5, 0]], .5, 1, aer);
  }
  tufts(g, c, c, 6, 14, 10, 91);
}, { margin: 18, amp: .6 });

// ---------------- Dead / bomb-damaged ----------------
// Bare tree: recursive forked branches.
function bare(g, x, y, z, a, e, len, r, depth, m, s) {
  const x1 = x + Math.cos(a) * Math.cos(e) * len, y1 = y + Math.sin(a) * Math.cos(e) * len, z1 = z + Math.sin(e) * len;
  limb(g, [[x, y, z], [x1, y1, z1]], r, r * .7, m);
  if (depth <= 0) return;
  for (const sd of [-1, 1]) {
    const h = hash(depth * 7 + sd, ix(x1 * 3 + y1), s);
    bare(g, x1, y1, z1, a + sd * (.55 + h * .6), Math.max(.15, e - .3 + h * .3), len * (.66 + h * .15), r * .66, depth - 1 - (h < .15 ? 1 : 0), m, s);
  }
}
plant('prop_tree_dead', [2, 2], 64, g => {
  const c = 16, bk = bark(OB, 3, 101);
  roots(g, c, c, 5, 7, 1.6, bk, 101);
  limb(g, [[c, c, 0], [c + 1, c, 14], [c, c + 1, 22]], 3, 2.2, bk);
  bare(g, c, c + 1, 22, .6, 1.25, 12, 2, 4, bk, 101);
  bare(g, c, c, 14, 3.4, .5, 9, 1.5, 3, bk, 102);
  tufts(g, c, c, 3, 8, 6, 101, SN, 2);
}, { margin: 14, amp: .4, lean: .2 });

// Shell-shattered trunk: charred, snapped, splintered top, scorched ground, smouldering.
plant('prop_tree_burnt', [1, 1], 40, g => {
  const c = 8, ch = bark(CH, 2, 111);
  carpet(g, c + 1, c + 1, 8, 6, CH, 3, 111);
  roots(g, c, c, 4, 5, 1.3, ch, 111);
  limb(g, [[c, c, 0], [c + 1, c, 16]], 3, 2.3, ch);
  g.shape(c - 4, c - 4, 16, c + 4, c + 4, 32, (x, y, z) => { const d = Math.hypot(x - c - 1, y - c); return d < 2.4 && z < 18 + 12 * hash(ix(x), ix(y), 112); }, ch);
  g.shape(c - 3, c - 3, 16, c + 4, c + 4, 26, (x, y, z) => { const d = Math.hypot(x - c - 1, y - c); return d < 1.2 && z < 25 && hash(ix(x), ix(y), 113) < .6; }, tint(WD, 4)); // pale splinters
  limb(g, [[c + 1, c, 12], [c + 6, c + 1, 17], [c + 9, c + 1, 16]], 1.2, .7, ch);
  for (const [x, y] of [[c + 6, c + 7], [c - 4, c + 5]]) limb(g, [[x, y, .5], [x + 4, y + 1, .5]], 1, .9, ch);
  g.set(c + 1, c + 2, 15, tint(AU, 5)); g.set(c, c + 2, 3, tint(AU, 4));
}, { frames: 4, fps: 6, amp: 0, lean: 0, margin: 10, overlay: smokeOverlay(9, 8, 27, 26) });

// ---------------- Stumps & logs ----------------
const stumpTop = (cx, cy) => mat((x, y, z, f) => f === 'u' ? rings(cx, cy, SN, 3)(x, y) : cl(WD, 2 + (hash(ix(x + y), ix(z / 2), 121) < .3 ? -1 : 0)));
still('prop_stump_cut', [1, 1], 14, g => {
  const c = 8;
  roots(g, c, c, 4, 5, 1.4, bark(WD, 2, 121), 121);
  g.cylZ(c, c, 4.6, 0, 6, stumpTop(c, c));
  for (const [x, y, h] of [[c + 4, c + 4, 2], [c + 5, c + 2, 3]]) { g.box(x, y, 0, x + 1, y + 1, h, tint(CR, 2)); g.ell(x + .5, y + .5, h, 1.6, 1.6, .8, mat((a, b, z, f) => cl(GD, f === 'u' ? 2 : 1))); }
  tufts(g, c, c, 4, 7, 4, 121);
});
still('prop_stump_old', [1, 1], 18, g => {
  const c = 8, bk = bark(OB, 3, 131);
  roots(g, c, c, 5, 5, 1.4, bk, 131);
  g.shape(c - 5, c - 5, 0, c + 5, c + 5, 14, (x, y, z) => { const d = Math.hypot(x - c, y - c); return d < 4.8 && d > 2 && z < 6 + 7 * fbm(x * .5, y * .5, 132); }, bk);
  g.cylZ(c, c, 2.2, 0, 2, tint(WD, 1));
  g.topPaint(c - 5, c - 5, c + 5, c + 5, (x, y, z) => z > 3 && fbm(x * .4, y * .4, 133) > .45 ? tint(LF, 4) : null);
  tufts(g, c, c, 4, 7, 5, 131);
});
// Fallen log along x: ringed end faces, moss on top, a snapped branch stub, mushrooms.
still('prop_log_fallen', [2, 1], 14, g => {
  const cy = 8, cz = 4.4, r = 4.4, x0 = 2, x1 = 29;
  const m = mat((x, y, z, f) => {
    if (f === 'e' || f === 'w') return rings(cy, cz, SN, 3)(y, z);
    if (f === 'u' && fbm(x * .2, y * .5, 141) > .55) return cl(LF, 3 + (hash(ix(x), ix(y), 142) < .3 ? 1 : 0));
    const v = f === 'u' ? y : z;
    return cl(WD, 2 + (mod(v, 2) === 0 && hash(ix(x / 4), ix(v), 143) < .5 ? -1 : 0) + (hash(ix(x), ix(v), 144) < .06 ? 1 : 0));
  });
  g.cylX(cy, cz, r, x0, x1, m, r * .95);
  g.cylX(cy, cz, r - 1.2, x0 - 1, x0 + 1, null);
  limb(g, [[20, cy - 3, 6], [23, cy - 6, 10]], 1.2, .8, bark(WD, 2, 145));
  for (const [x, h] of [[8, 1], [11, 2]]) { g.box(x, cy + 4, 1, x + 1, cy + 5, 1 + h, tint(CR, 2)); g.ell(x + .5, cy + 4.5, 1 + h, 1.4, 1.4, .7, mat((a, b, z, f) => cl(RD, f === 'u' ? 3 : 2))); }
  tufts(g, 16, 8, 6, 14, 6, 141);
});
// Stack of cut logs (camp firewood / timber).
still('prop_log_pile', [2, 1], 18, g => {
  // Logs run along y so the ringed ends face the front; 5 / 4 / 3 stacked, ends a little ragged.
  let k = 0;
  for (const [n, z] of [[5, 3], [4, 8.2], [3, 13.4]]) for (let i = 0; i < n; i++) {
    const cx = 16 + (i - (n - 1) / 2) * 5.8, off = hash(k, 0, 151) * 2, id = k++;
    const m = mat((x, y, zz, f) => (f === 's' || f === 'n') ? (Math.hypot(x - cx, zz - z) > 2.3 ? WD[1] : rings(cx, z, SN, 4 - (id & 1))(x, zz)) : cl(WD, 1 + (hash(ix(f === 'u' ? x : zz), ix(y / 3), id) < .3 ? -1 : 0)));
    g.cylY(cx, z, 2.8, 1 + off, 14 - off * .5, m);
  }
  for (const x of [1, 30]) g.box(x, 6, 0, x + 1, 8, 12, tint(WD, 1));
});

// ---------------- Bushes ----------------
// Cluster of cushion clumps; extras(g) adds flowers / berries.
function bush(clumps, R, base, s, deco) {
  return g => {
    clumps.forEach(([x, y, z, r, rz], i) => blob(g, x, y, z, r, r, rz ?? r * .85, foliage(R, base, z, rz ?? r * .85, s + i), s + i * 5, .28));
    if (deco) deco(g);
    tufts(g, 8, 9, 5, 8, 3, s);
  };
}
const dots = (R, i, n, s, x0 = 1, x1 = 15, y0 = 1, y1 = 15) => g => {
  for (let k = 0; k < n; k++) { const x = x0 + hash(k, s, 1) * (x1 - x0), y = y0 + hash(k, s, 2) * (y1 - y0), z = g.top(ix(x), ix(y)); if (z > 2) { g.set(x, y, z + 1, tint(R, i)); if (hash(k, s, 3) < .5) g.set(x + 1, y, z, tint(R, i - 1)); } }
};
plant('prop_bush', [1, 1], 18, bush([[5.5, 8, 5, 5], [11, 9, 4.5, 4.6], [8, 5.5, 7, 5], [9, 11.5, 4, 4.2]], LF, 3, 161), { margin: 4, amp: .5, lean: .3 });
plant('prop_bush_round', [1, 1], 18, bush([[8, 8, 6.5, 7, 6.2], [10, 10, 4, 4.5]], CF, 3, 171), { margin: 4, amp: .5, lean: .3 });
plant('prop_bush_flower', [1, 1], 18, bush([[5.5, 8, 5, 5], [11, 9, 4.5, 4.6], [8, 5.5, 7, 5]], LF, 3, 181, g => { dots(PK, 4, 14, 182)(g); dots(CR, 3, 6, 183)(g); }), { margin: 4, amp: .5, lean: .3 });
plant('prop_bush_large', [2, 1], 22, bush([[6, 9, 5, 5.5], [13, 7, 7, 7], [21, 8, 6, 6.5], [27, 10, 4, 4.5], [17, 11, 4, 5]], LF, 3, 191, dots(RD, 3, 16, 192, 1, 31)), { margin: 5, amp: .5, lean: .3 });
// Bramble: arching thorny canes with sparse leaves and dark berries.
plant('prop_bush_thorn', [1, 1], 16, g => {
  const cane = tint(RD, 1), lf = foliage(LF, 2, 6, 6, 201), berry = mat((x, y, z, f) => cl(VI, f === 'u' ? 2 : 0));
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * TAU + hash(k, 1, 201), L = 6 + hash(k, 2, 201) * 4, hgt = 7 + hash(k, 3, 201) * 5;
    let px = 8, py = 8;
    for (let t = 0; t <= 1; t += .05) {
      const x = 8 + Math.cos(a) * L * t, y = 8.5 + Math.sin(a) * L * t * .8, z = hgt * Math.sin(Math.PI * t * .9);
      g.line(px, py, z, x, y, z, cane); px = x; py = y;
      if (t > .2 && hash(ix(t * 20), k, 202) < .45) blob(g, x, y, z + .5, 1.6, 1.6, 1.3, lf, k * 9 + ix(t * 20), .1);
      if (t > .3 && hash(ix(t * 20), k, 203) < .18) g.set(x, y + 1, z, berry);
    }
  }
  tufts(g, 8, 9, 5, 8, 3, 204, SN, 2);
}, { margin: 4, amp: .5, lean: .3 });
// Box-clipped hedge (2×1): rounded block, a little uneven.
plant('prop_bush_hedge', [2, 1], 16, g => {
  const m = foliage(CF, 4, 9, 6, 211);
  g.shape(0, 1, 0, 32, 15, 14, (x, y, z) => {
    const ex = Math.max(0, Math.abs(x - 16) - 11) / 4.5, ey = Math.abs(y - 8) / 6.2, ez = Math.max(0, z - 6.5) / 6.5;
    return ex ** 2.4 + ey ** 2.4 + ez ** 2.4 <= 1 + .25 * (fbm(x * .3, y * .3 + z * .3, 212) - .5);
  }, m);
  for (let x = 4; x < 30; x += 5) g.box(x, 13, 0, x + 1, 14, 2, tint(WD, 1));
}, { frames: 1, margin: 4 });

// ---------------- Small plants ----------------
// Fern: arching pinnate fronds from a centre.
plant('prop_plant_fern', [1, 1], 12, g => {
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * TAU + hash(k, 1, 221) * .5, L = 6 + hash(k, 2, 221) * 3, dx = Math.cos(a), dy = Math.sin(a);
    const rib = tint(LF, 4), lf = tint(LF, k % 2 ? 4 : 3), tip = tint(LF, 5);
    for (let t = 0; t <= 1; t += .06) {
      const x = 8 + dx * L * t, y = 8.5 + dy * L * t, z = 1 + 7 * t - 8 * t * t;
      g.set(x, y, Math.max(0, z), rib);
      const w = (1 - t) * 2.2 + .3;
      if (t > .1) for (const sd of [-1, 1]) for (let u = 1; u <= w; u++) g.set(x - dy * sd * u, y + dx * sd * u, Math.max(0, z - .3 * u), t > .75 ? tip : lf);
    }
  }
  g.ell(8, 8.5, 1, 1.5, 1.5, 1.2, tint(LF, 2));
}, { margin: 4, amp: .6, lean: .3, fps: 4 });
// Tall grass / dry grass: bundles of curved blades with lit tips.
function grassClump(R, base, s, h0, n) {
  return g => {
    for (let k = 0; k < n; k++) {
      const a = hash(k, 1, s) * TAU, d = Math.sqrt(hash(k, 2, s)) * 6, bx = 8 + Math.cos(a) * d, by = 9 + Math.sin(a) * d * .8;
      const h = h0 * (.55 + hash(k, 3, s) * .5), lean = (hash(k, 4, s) - .5) * 4, ly = (hash(k, 5, s) - .5) * 2;
      for (let z = 0; z < h; z++) { const t = z / h; g.set(bx + lean * t * t, by + ly * t * t, z, tint(R, base + (t > .75 ? 1 : t < .25 ? -1 : 0) + (k % 3 === 0 ? -1 : 0))); }
    }
  };
}
plant('prop_plant_grass', [1, 1], 16, grassClump(LF, 4, 231, 13, 34), { margin: 4, amp: 1.2, lean: .5, from: .15, fps: 4 });
plant('prop_plant_grass_dry', [1, 1], 16, grassClump(SN, 2, 232, 12, 30), { margin: 4, amp: 1.2, lean: .5, from: .15, fps: 4 });
// Reeds / cattails: straight stems, brown seed heads, a few blade leaves.
plant('prop_plant_reeds', [1, 1], 24, g => {
  grassClump(OL, 3, 241, 15, 16)(g);
  for (let k = 0; k < 6; k++) {
    const x = 4 + hash(k, 1, 242) * 9, y = 5 + hash(k, 2, 242) * 7, h = 15 + hash(k, 3, 242) * 6;
    g.box(x, y, 0, x + 1, y + 1, h, tint(OL, 2));
    g.box(x, y, h - 5, x + 1, y + 1, h - 1, mat((a, b, z, f) => cl(WD, f === 'u' ? 2 : 1 + (z & 1))));
    g.set(x, y, h, tint(OL, 4));
  }
}, { margin: 4, amp: 1.2, lean: .5, from: .2, fps: 4 });
// Wildflower patches: leafy base, stems, coloured heads.
function flowers(heads, s) {
  return g => {
    grassClump(LF, 3, s, 5, 18)(g);
    for (let k = 0; k < 16; k++) {
      const x = 2 + hash(k, 1, s) * 12, y = 3 + hash(k, 2, s) * 11, h = 3 + hash(k, 3, s) * 5, [R, i, tall] = heads[k % heads.length];
      g.box(x, y, 0, x + 1, y + 1, h, tint(LF, 3));
      if (tall) { for (let z = 0; z < 4; z++) g.set(x, y, h + z, tint(R, i + (z === 3 ? 1 : z === 0 ? -1 : 0))); }
      else { g.set(x, y, h, tint(R, i + 1)); g.set(x + 1, y, h - 1, tint(R, i)); g.set(x - 1, y, h - 1, tint(R, i)); g.set(x, y + 1, h - 1, tint(R, i - 1)); g.set(x, y, h - 1, tint(GD, 3)); }
    }
  };
}
plant('prop_plant_flowers', [1, 1], 14, flowers([[RD, 3], [GD, 2], [CR, 2], [RD, 3]], 251), { margin: 4, amp: .8, lean: .4, from: .2, fps: 4 });
plant('prop_plant_flowers_b', [1, 1], 16, flowers([[VI, 3, true], [CR, 2], [VI, 2, true], [PK, 3]], 252), { margin: 4, amp: .8, lean: .4, from: .2, fps: 4 });

// ---------------- Rocks ----------------
function rocks(list, s, moss) {
  return g => {
    list.forEach(([x, y, rx, ry, rz], i) => g.shape(x - rx - 1, y - ry - 1, 0, x + rx + 1, y + ry + 1, rz * 1.3, (px, py, pz) => {
      const n = fbm(px * .3 + i * 5, py * .3 + pz * .3, 260 + s + i), d = ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 + (pz / rz) ** 2;
      return d <= 1 + (n - .5) * .7 && Math.abs((px - x) * .7 + pz * .5 - rx * .6) > .4; // faceted crack
    }, stone(3 + (i & 1), s + i, moss)));
  };
}
still('prop_rock_s', [1, 1], 10, rocks([[7, 9, 4.5, 3.5, 4], [12, 11, 2, 1.8, 2], [3, 12, 1.4, 1.2, 1.4]], 271, 0), 4);
still('prop_rock_m', [1, 1], 14, g => { rocks([[8, 8, 6.5, 5.5, 8], [13.5, 12, 2.5, 2, 3]], 281, .45)(g); tufts(g, 8, 8, 6, 8, 4, 281); }, 4);
still('prop_rock_l', [2, 2], 26, g => { rocks([[13, 14, 11, 9, 17], [24, 20, 6, 5, 9], [6, 23, 3, 2.5, 3.5], [28, 9, 2.4, 2, 2.6]], 291, .5)(g); tufts(g, 16, 16, 9, 15, 9, 291); }, 6);

// ---------------- Kept ids (placed on the map already) ----------------
// prop_tree_palm / prop_tree_jungle / prop_bush are defined above with the same footprint.

// ---------------- Falling-leaf effects (48×64, 12 frames, seamless loop) ----------------
// Each leaf falls the full height over two loops; it is drawn twice half a fall apart, so the
// set of leaves at frame 12 equals frame 0. Leaves drift right with the wind and tumble.
const LEAF_SHAPES = {
  wide: ['.LL.', 'LMMD', '.MD.'], tilt: ['..L', '.MD', 'D..'], edge: ['L', 'D'],
  petal: ['LM', '.M'], petalTilt: ['L', 'M'], dot: ['M']
};
function fallFrames(kind) {
  const W = 48, H = 64, N = 12;
  const cfg = {
    green: { n: 3, ramps: [[LF, 6], [LF, 5], [YG, 5]], s: 301 },
    autumn: { n: 4, ramps: [[AU, 5], [AU, 4], [AU, 3], [WD, 3]], s: 302 },
    palm: { n: 2, ramps: [[YG, 4], [YG, 3]], s: 303, palm: true },
    petals: { n: 6, ramps: [[PK, 4], [PK, 3], [CR, 3]], s: 304, petal: true }
  }[kind];
  const frames = [];
  for (let f = 0; f < N; f++) {
    const c = new Canvas(W, H);
    for (let k = 0; k < cfg.n; k++) {
      const s = cfg.s, x0 = 1 + (k + hash(k, 1, s) * .8) / cfg.n * 28, p = ([0, 3, 1, 5, 2, 4].filter(v => v < cfg.n)[k] + hash(k, 2, s) * .7) / cfg.n / 2, spins = 2 + ix(hash(k, 3, s) * 2), sway = 2 + hash(k, 4, s) * 3;
      const [R, i] = cfg.ramps[k % cfg.ramps.length];
      for (const half of [0, .5]) {
        const t = (p + half + f / (N * 2)) % 1, y = -8 + t * (H + 16), x = x0 + t * 14 + Math.sin(t * TAU * 2 + k * 2) * sway;
        const th = t * TAU * spins + p * TAU, cs = Math.cos(th), flip = Math.sin(th) < 0;
        const L = cl(R, cs < 0 ? i - 1 : i), M = cl(R, (cs < 0 ? i - 1 : i) - 1), D = cl(R, i - 2);
        if (cfg.palm) {
          const len = 2 + Math.abs(cs) * 5, ang = .55 + .45 * Math.sin(th * .5);
          for (let u = 0; u <= len; u++) { const px = x + Math.cos(ang) * u * (flip ? -1 : 1), py = y + Math.sin(ang) * u; c.put(px, py, u === 0 ? D : L); if (u % 2 && Math.abs(cs) > .4) c.put(px, py + 1, M); }
          continue;
        }
        const shape = cfg.petal ? (Math.abs(cs) > .5 ? LEAF_SHAPES.petal : Math.abs(cs) > .2 ? LEAF_SHAPES.petalTilt : LEAF_SHAPES.dot)
          : (Math.abs(cs) > .55 ? LEAF_SHAPES.wide : Math.abs(cs) > .18 ? LEAF_SHAPES.tilt : LEAF_SHAPES.edge);
        shape.forEach((row, r) => [...row].forEach((ch, q) => {
          const col = ch === 'L' ? L : ch === 'M' ? M : ch === 'D' ? D : null;
          if (col) c.put(Math.round(x) + (flip ? row.length - 1 - q : q), Math.round(y) + r, col);
        }));
      }
    }
    frames.push(c);
  }
  return frames;
}

// Non-model sprites (fx_*) of this module: called from world.cjs build(add).
function extra(add) {
  add('Effects', 'fx_leaves_green', fallFrames('green'), { fps: 10, loop: true });
  add('Effects', 'fx_leaves_autumn', fallFrames('autumn'), { fps: 10, loop: true });
  add('Effects', 'fx_leaves_palm', fallFrames('palm'), { fps: 10, loop: true });
  add('Effects', 'fx_petals', fallFrames('petals'), { fps: 10, loop: true });
}

module.exports = { extra };

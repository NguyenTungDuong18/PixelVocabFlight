'use strict';
// Tiny signed-distance raymarcher for story stills that need real 3D form (the opening's tin, its
// contents and the hand). Oblique parallel camera matching the world models: screenY = y - K*z
// (top faces unforeshortened, heights halved). Units are picture pixels; x east, y south, z up.
// render() returns a G-buffer (object, point, normal, shadow, ambient occlusion) that the caller
// shades with its own ramps, so the look stays hand-tuned pixel art rather than a plain render.
const K = .5;
const DN = Math.hypot(K, 1), DY = -K / DN, DZ = -1 / DN;          // view ray direction (0, DY, DZ)
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------- primitives
const len2 = (x, y) => Math.sqrt(x * x + y * y);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
// Tapered capsule a->b, radius ra at a, rb at b (approximate SDF, fine for marching at .9 step).
function capsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz || 1;
  const h = clamp(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2);
  return len3(px - ax - dx * h, py - ay - dy * h, pz - az - dz * h) - (ra + (rb - ra) * h);
}
function sphere(px, py, pz, cx, cy, cz, r) { return len3(px - cx, py - cy, pz - cz) - r; }
// Ellipsoid (approximate, Quilez).
function ellipsoid(px, py, pz, rx, ry, rz) {
  const k0 = len3(px / rx, py / ry, pz / rz), k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
// 2D rounded rectangle centred at 0 (half sizes hx, hy, corner radius r).
function rrect(px, py, hx, hy, r) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
  return len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
// Extrude a 2D distance d2 between z0 and z1.
function extrude(d2, pz, z0, z1) {
  const w = Math.abs(pz - (z0 + z1) / 2) - (z1 - z0) / 2;
  return len2(Math.max(d2, 0), Math.max(w, 0)) + Math.min(Math.max(d2, w), 0);
}

// ---------------------------------------------------------------- rendering
// obj: { id, box: [x0, y0, z0, x1, y1, z1], sdf(x, y, z) }. Optional obj.noShadow.
function boxDist(b, x, y, z) {
  const dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]);
  return len3(dx, dy, dz);
}
function sceneDist(objs, x, y, z, skip) {
  let best = 1e9, hit = null;
  for (const o of objs) {
    if (o === skip) continue;
    if (boxDist(o.box, x, y, z) > best) continue;
    const d = o.sdf(x, y, z);
    if (d < best) { best = d; hit = o; }
  }
  return { d: best, o: hit };
}
// Ray/box slab test along (dx, dy, dz) from (ox, oy, oz): [tmin, tmax] or null.
function slab(b, ox, oy, oz, dx, dy, dz, pad = 1) {
  let t0 = -1e9, t1 = 1e9;
  for (const [o, d, lo, hi] of [[ox, dx, b[0] - pad, b[3] + pad], [oy, dy, b[1] - pad, b[4] + pad], [oz, dz, b[2] - pad, b[5] + pad]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    let a = (lo - o) / d, c = (hi - o) / d;
    if (a > c) { const s = a; a = c; c = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return [Math.max(0, t0), t1];
}
function normalAt(o, x, y, z, e = .55) {
  const nx = o.sdf(x + e, y, z) - o.sdf(x - e, y, z), ny = o.sdf(x, y + e, z) - o.sdf(x, y - e, z), nz = o.sdf(x, y, z + e) - o.sdf(x, y, z - e);
  const l = len3(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
// Soft shadow toward the light L (unit vector): 1 lit .. 0 fully shadowed.
function softShadow(objs, x, y, z, L, k = 7) {
  let res = 1;
  const cand = [];
  for (const o of objs) { if (o.noShadow) continue; const s = slab(o.box, x, y, z, L[0], L[1], L[2], 2); if (s) cand.push([o, s]); }
  if (!cand.length) return 1;
  let t = .9;
  const tEnd = Math.max(...cand.map(c => c[1][1]));
  for (let i = 0; i < 90 && t < tEnd; i++) {
    const px = x + L[0] * t, py = y + L[1] * t, pz = z + L[2] * t;
    let d = 1e9;
    for (const [o] of cand) { if (boxDist(o.box, px, py, pz) > d) continue; d = Math.min(d, o.sdf(px, py, pz)); }
    if (d < .05) return 0;
    res = Math.min(res, k * d / t);
    t += clamp(d, .35, 6);
  }
  return clamp(res);
}
function ambientOcc(objs, x, y, z, n) {
  let occ = 0, w = 1;
  for (const s of [1.2, 2.6, 4.5, 7.5, 11]) {
    const d = Math.min(sceneDist(objs, x + n[0] * s, y + n[1] * s, z + n[2] * s).d, z + n[2] * s);   // the table counts too
    occ += (s - d) * w / s; w *= .62;
  }
  return clamp(1 - occ * .55);
}
// Renders W x H. Each cell: null (table, with x, y on the plane z = 0) or a hit record.
// Every cell also carries the table light inputs; the caller shades.
function render(objs, W, H, L, { region = null, zTop = 200 } = {}) {
  const G = new Array(W * H).fill(null);
  const [rx0, ry0, rx1, ry1] = region || [0, 0, W, H];
  for (let sy = ry0; sy < ry1; sy++) for (let sx = rx0; sx < rx1; sx++) {
    // Ray from z = zTop down to the table.
    const ox = sx + .5, oy = sy + .5 + K * zTop, oz = zTop;
    const tTable = -oz / DZ;
    const cand = [];
    for (const o of objs) { const s = slab(o.box, ox, oy, oz, 0, DY, DZ); if (s && s[0] < tTable) cand.push([o, s]); }
    let hit = null;
    if (cand.length) {
      let t = Math.min(...cand.map(c => c[1][0]));
      const tEnd = Math.min(tTable, Math.max(...cand.map(c => c[1][1])));
      for (let i = 0; i < 260 && t < tEnd; i++) {
        const px = ox, py = oy + DY * t, pz = oz + DZ * t;
        let d = 1e9, o = null;
        for (const [c] of cand) { if (boxDist(c.box, px, py, pz) > d) continue; const e = c.sdf(px, py, pz); if (e < d) { d = e; o = c; } }
        if (d < .04) { hit = { o, x: px, y: py, z: pz, t }; break; }
        t += Math.max(d * .9, .04);
      }
    }
    const cell = hit || { o: null, x: ox, y: oy + DY * tTable, z: 0, t: tTable };
    cell.n = hit ? normalAt(hit.o, cell.x, cell.y, cell.z) : [0, 0, 1];
    const lift = .6;
    const sx0 = cell.x + cell.n[0] * lift, sy0 = cell.y + cell.n[1] * lift, sz0 = cell.z + cell.n[2] * lift;
    const ndl = cell.n[0] * L[0] + cell.n[1] * L[1] + cell.n[2] * L[2];
    cell.ndl = ndl;
    cell.sh = ndl > 0 ? softShadow(objs, sx0, sy0, sz0, L) : 0;
    cell.ao = ambientOcc(objs, cell.x, cell.y, cell.z, cell.n);
    G[sy * W + sx] = cell;
  }
  return G;
}
// Rotation helpers: rotate (y, z) about the x axis by angle a.
const rotX = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotZ = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

module.exports = { K, clamp, len2, len3, smin, smax, capsule, sphere, ellipsoid, rrect, extrude, render, sceneDist, normalAt, softShadow, ambientOcc, rotX, rotZ };

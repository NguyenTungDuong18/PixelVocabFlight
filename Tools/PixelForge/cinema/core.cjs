'use strict';
// Title cinematic (pre-rendered pixel film): vectors, noise, camera, palette. Units are metres; x east, y north, z up.
// The film is rendered frame by frame at 480x270 in float RGB and then snapped to PALETTE with ordered dither.
const W = 480, H = 270, FPS = 30;
const DEG = Math.PI / 180, TAU = Math.PI * 2;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const sstep = (a, b, v) => smooth((v - a) / (b - a));
// 0 before a, 1 between b and c, 0 after d
const pulse = (a, b, c, d, v) => v < a || v > d ? 0 : v < b ? smooth((v - a) / (b - a)) : v > c ? 1 - smooth((v - c) / (d - c)) : 1;
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// ---------------------------------------------------------------- noise (deterministic)
function ih(x, y, z, s) {
  let h = (Math.imul(x, 0x27d4eb2d) + Math.imul(y, 0x165667b1) + Math.imul(z, 0x9e3779b1) + Math.imul(s, 0x85ebca6b)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const rnd = (i, s = 0) => ih(i | 0, s | 0, 0, 77);
function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = ih(xi, yi, zi, s), b = ih(xi + 1, yi, zi, s), c = ih(xi, yi + 1, zi, s), d = ih(xi + 1, yi + 1, zi, s);
  const e = ih(xi, yi, zi + 1, s), f = ih(xi + 1, yi, zi + 1, s), g = ih(xi, yi + 1, zi + 1, s), h = ih(xi + 1, yi + 1, zi + 1, s);
  const l0 = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy, l1 = e + (f - e) * fx + (g - e) * fy + (e - f - g + h) * fx * fy;
  return l0 + (l1 - l0) * fz;
}
function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = ih(xi, yi, 0, s), b = ih(xi + 1, yi, 0, s), c = ih(xi, yi + 1, 0, s), d = ih(xi + 1, yi + 1, 0, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm2 = (x, y, s = 0) => noise2(x, y, s) * .55 + noise2(x * 2.1, y * 2.1, s + 7) * .3 + noise2(x * 4.3, y * 4.3, s + 13) * .15;
// value noise whose lattice wraps every n cells in y (n = 0: no wrap); the looping ground tiles with the cloud deck
function noise2p(x, y, n, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), y0 = n ? ((yi % n) + n) % n : yi, y1 = n ? (y0 + 1) % n : yi + 1;
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = ih(xi, y0, 0, s), b = ih(xi + 1, y0, 0, s), c = ih(xi, y1, 0, s), d = ih(xi + 1, y1, 0, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm3 = (x, y, z, s = 0) => noise3(x, y, z, s) * .55 + noise3(x * 2.1, y * 2.1, z * 2.1, s + 7) * .3 + noise3(x * 4.3, y * 4.3, z * 4.3, s + 13) * .15;
// smooth 1D noise in -1..1 (camera shake, bobbing)
const wob = (t, s = 0) => noise2(t, s * 17.3, 91) * 2 - 1;

// ---------------------------------------------------------------- camera
// { pos, target, roll (rad, clockwise picture roll), fov (vertical, degrees) }
function makeCam(c) {
  const F = norm(sub(c.target, c.pos));
  let R = norm(cross(F, [0, 0, 1])), U = cross(R, F);
  if (c.roll) { const cr = Math.cos(c.roll), sr = Math.sin(c.roll); [R, U] = [mad(mul(R, cr), U, sr), mad(mul(U, cr), R, -sr)]; }
  const f = (H / 2) / Math.tan((c.fov || 50) * DEG / 2);
  const P = c.pos;
  return {
    pos: P, F, R, U, f,
    // world -> [sx, sy, view z]
    project(p) { const dx = p[0] - P[0], dy = p[1] - P[1], dz = p[2] - P[2], z = dx * F[0] + dy * F[1] + dz * F[2]; return [W / 2 + f * (dx * R[0] + dy * R[1] + dz * R[2]) / z, H / 2 - f * (dx * U[0] + dy * U[1] + dz * U[2]) / z, z]; },
    view(p) { const dx = p[0] - P[0], dy = p[1] - P[1], dz = p[2] - P[2]; return [dx * R[0] + dy * R[1] + dz * R[2], dx * U[0] + dy * U[1] + dz * U[2], dx * F[0] + dy * F[1] + dz * F[2]]; }
  };
}
// Orthonormal plane basis [forward, left, up] from a flight direction and a bank angle (rad, + = right wing down).
function flyBasis(dir, bank = 0) {
  const X = norm(dir);
  let Y = cross([0, 0, 1], X); const l = len(Y); Y = l < 1e-4 ? [0, 1, 0] : mul(Y, 1 / l);
  let Z = cross(X, Y);
  if (bank) { const c = Math.cos(bank), s = Math.sin(bank); [Y, Z] = [mad(mul(Y, c), Z, s), mad(mul(Z, c), Y, -s)]; }
  return [X, Y, Z];
}
// Basis rotated by Euler tumble (for debris): angles about x, y, z.
function tumble(ax, ay, az) {
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  return [[cy * cz, cy * sz, -sy], [sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy], [cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy]];
}
// local point (x forward, y left, z up) -> world
const toWorld = (B, pos, s, p) => [pos[0] + (B[0][0] * p[0] + B[1][0] * p[1] + B[2][0] * p[2]) * s, pos[1] + (B[0][1] * p[0] + B[1][1] * p[1] + B[2][1] * p[2]) * s, pos[2] + (B[0][2] * p[0] + B[1][2] * p[1] + B[2][2] * p[2]) * s];
const velOf = (fn, t, e = .02) => mul(sub(fn(t + e), fn(t - e)), 1 / (2 * e));

// ---------------------------------------------------------------- palette (dusk battle: ramps dark -> light)
const RAMPS = {
  sky: ['#0d1430', '#141f42', '#1c2c57', '#263a6b', '#34497c', '#4a5788', '#665f8f', '#876890', '#a8708c', '#c97c80', '#e58d6c', '#f6a65c', '#ffc169', '#ffdb8c', '#fff0b8'],
  cloud: ['#1b2040', '#272c50', '#353a66', '#464a7d', '#5e5890', '#7c5c98', '#a56a9a', '#cf7f8f', '#f2907c', '#ffb27a', '#ffd9a0', '#fff1cf'],   // dusk cumulus: blue-violet shade -> rose -> peach -> warm cream (research r3)
  smoke: ['#0b0a0e', '#17151a', '#252228', '#37323a', '#4c4650', '#655e69', '#827a84', '#a39ba2', '#c6bfc2'],
  fire: ['#3a0d0a', '#6b1a0e', '#a02c12', '#d04a16', '#ee6f1c', '#fb9a2a', '#ffc246', '#ffe27c', '#fff6c2', '#ffffff'],
  olive: ['#10140e', '#1b2216', '#28311d', '#364226', '#475531', '#5b6b41', '#76855a'],
  ocean: ['#171b22', '#272e37', '#3a444e', '#525e68', '#6e7b84', '#8f9ba1'],
  egg: ['#3c4a4c', '#586a6a', '#7a8e8a', '#9fb2aa', '#c2d1c5'],
  grey: ['#16191f', '#252a32', '#373e48', '#4e5762', '#69737e', '#88929b', '#aab3b8', '#cfd5d6'],
  blue: ['#33424f', '#4b5f70', '#687f92', '#8aa1b2', '#b0c4cf'],
  yellow: ['#5a3c0c', '#8f6214', '#c48f1e', '#e6b93a', '#f6dc74'],
  metal: ['#23272c', '#3d444b', '#5f6870', '#8a949b', '#bcc5c9', '#eef2f0'],
  glass: ['#0f1826', '#1e3046', '#3d5c7a', '#7fa0b8', '#cfe3ea'],
  brass: ['#4a3410', '#8a661e', '#c9a03a', '#f0d27a'],
  sea: ['#080d1c', '#0e1730', '#162445', '#22355c', '#35507a'],
  roundel: ['#d9772c', '#1f2f5c', '#f2efe4', '#7a3a14', '#0f1838'],
  tracer: ['#ff4020', '#ff7a30', '#b6ff8a', '#5fd870', '#eafff0'],
  // the ground under the raid (battle.cjs / ground.cjs): dusk land, rubble, oil smoke, fire-lit smoke
  land: ['#121419', '#191c24', '#20242e', '#282c39', '#323544', '#3d3d4b'],
  rubble: ['#2a2224', '#3b3130', '#4a4038', '#5d5046', '#726252'],
  soot: ['#141113', '#1e1a1c', '#2b2426', '#3a302f', '#4a3c38', '#5b4b46', '#6b5a55', '#7a6a6a', '#968683', '#b8aaa3', '#d8d0c8'],
  ember: ['#3a1812', '#5c2416', '#80321a', '#a8481f', '#cc672c', '#e8a060'],
  // the ports (ground.cjs, sky.cjs water): rivers and docks mirroring the fire-lit dusk, dark hulls, a ship's pale bridge
  port: ['#2a2742', '#45365a', '#6a4468', '#8f5272', '#b2607a', '#cc6e7c', '#e08a78', '#eea486', '#f6c49c'],
  dock: ['#1a1c26', '#c8c0b0'],
  // light flak from the ground (battle.cjs): self-destruct smoke, tracer tail, glow, muzzle flash, hot core
  flak: ['#6a6070', '#ff6a20', '#ffb040', '#ffe8a0', '#fff6d8'],
  ink: ['#05060a', '#0c0e14']
};
const RAMP = {};
for (const k in RAMPS) RAMP[k] = RAMPS[k].map(hex);
const PALETTE = [];
{ const seen = new Set(); for (const k in RAMPS) for (const h of RAMPS[k]) if (!seen.has(h)) { seen.add(h); PALETTE.push(hex(h)); } }
// hazed tones: clouds and smoke seen through warm or cool air (keeps distant shapes from snapping to an unrelated ramp)
{ const seen = new Set(PALETTE.map(p => p.join())), put = c => { const q = c.map(v => Math.round(v * 255) / 255), k = q.join(); if (!seen.has(k)) { seen.add(k); PALETTE.push(q); } };
  for (const hz of ['#ff9a48', '#6f6590', '#b97f7a']) { const h = hex(hz); for (const c of RAMP.cloud) put(mix3(c, h, .5)); }
  for (const c of RAMP.smoke) put(mix3(c, hex('#c47a5a'), .45));
  for (const k of ['grey', 'olive', 'ocean']) for (const c of RAMP[k]) put(mix3(c, hex('#8a6f8c'), .5)); }
if (PALETTE.length > 256) throw new Error('palette over 256');
// continuous ramp lookup, L 0..1
function rampAt(R, L, out) {
  const v = clamp(L) * (R.length - 1), i = Math.min(R.length - 2, Math.floor(v)), t = v - i, a = R[i], b = R[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
// nearest palette entry (weighted RGB), cached in a 64^3 table
const LUT = new Int16Array(64 * 64 * 64).fill(-1);
function nearest(r, g, b) {
  const ri = clamp(Math.round(r * 63), 0, 63), gi = clamp(Math.round(g * 63), 0, 63), bi = clamp(Math.round(b * 63), 0, 63), k = (ri << 12) | (gi << 6) | bi;
  let v = LUT[k];
  if (v >= 0) return v;
  const R0 = ri / 63, G0 = gi / 63, B0 = bi / 63;
  let best = 1e9;
  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i], dr = p[0] - R0, dg = p[1] - G0, db = p[2] - B0, rm = (p[0] + R0) / 2;
    const d = (2 + rm) * dr * dr + 4 * dg * dg + (3 - rm) * db * db;
    if (d < best) { best = d; v = i; }
  }
  return LUT[k] = v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);

module.exports = {
  W, H, FPS, DEG, TAU, add, sub, mul, mad, dot, cross, len, norm, mix3, clamp, lerp, smooth, sstep, pulse, hex,
  ih, rnd, noise2, noise2p, noise3, fbm2, fbm3, wob, makeCam, flyBasis, tumble, toWorld, velOf, RAMP, PALETTE, rampAt, nearest, BAYER
};

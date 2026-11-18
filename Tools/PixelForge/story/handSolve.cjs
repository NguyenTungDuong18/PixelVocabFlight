'use strict';
// Solving hand poses against the real skinned mesh (handRig.cjs): Levenberg-Marquardt over chosen pose
// parameters, with residuals measured on mesh vertices.
//   terms: { gap: [region, sdf, gap, w] }  nearest vertex of region at gap px from the surface
//          { pin: [indices, targets, w] }  those vertices at those world points (a contact that holds)
//          { off: [region, sdf, gap, w] }  every vertex of region at least gap px out of the surface
//          { prior: [param, value, w] }    a pose parameter near a value (the intended shape)
//          { fn: pose -> [residuals] }     anything else
// Parameters are paths into the pose: 'P.0', 'pitch', 'f.2.1', 'th.0', 'thRoll'.
const RIG = require('./handRig.cjs');

const get = (o, p) => p.split('.').reduce((a, k) => a[k], o);
function withParams(pose, params, x) {
  const q = { ...pose, P: pose.P.slice(), f: pose.f.map(a => a.slice()), th: pose.th.slice(), arm: pose.arm && pose.arm.slice() };
  params.forEach((p, k) => {
    const ks = p.split('.');
    let o = q;
    for (let j = 0; j < ks.length - 1; j++) o = o[ks[j]];
    o[ks[ks.length - 1]] = x[k];
  });
  return q;
}
const armOf = pose => RIG.load()[pose.left ? 'L' : 'R'];
const region = (pose, name) => armOf(pose).regions[name];
// World points of vertex indices for a pose.
function points(pose, idx) {
  const co = RIG.posed(pose, idx).co;
  return idx.map(i => [co[i * 3], co[i * 3 + 1], co[i * 3 + 2]]);
}
const thin = (a, n) => a.length <= n ? a : a.filter((_, k) => k % Math.ceil(a.length / n) === 0);

function residuals(pose, terms) {
  const need = new Set();
  for (const t of terms) {
    if (t.gap) region(pose, t.gap[0]).forEach(i => need.add(i));
    if (t.off) (t.offIdx || (t.offIdx = thin(region(pose, t.off[0]), t.off[4] || 400))).forEach(i => need.add(i));
    if (t.pin) t.pin[0].forEach(i => need.add(i));
  }
  const co = RIG.posed(pose, [...need]).co, P = i => [co[i * 3], co[i * 3 + 1], co[i * 3 + 2]];
  const r = [];
  for (const t of terms) {
    if (t.gap) { const [n, sdf, g, w = 1] = t.gap; let m = 1e9; for (const i of region(pose, n)) m = Math.min(m, sdf(...P(i))); r.push((m - g) * w); }
    if (t.off) { const [, sdf, g, w = 1] = t.off; let pen = 0; for (const i of t.offIdx) { const d = sdf(...P(i)); if (d < g) pen += (g - d) * (g - d); } r.push(Math.sqrt(pen) * w); }
    if (t.pin) { const [idx, tg, w = 1] = t.pin; idx.forEach((i, k) => { const p = P(i); for (let j = 0; j < 3; j++) r.push((p[j] - tg[k][j]) * w); }); }
    if (t.prior) { const [p, v, w = 1] = t.prior; r.push((get(pose, p) - v) * w); }
    if (t.fn) r.push(...t.fn(pose));
  }
  return r;
}

// Gaussian elimination with partial pivoting (small dense systems).
function solveLin(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-12); }
  return x;
}

// bounds: { param: [lo, hi] } (joint limits); a step is clamped into them.
function solve(pose, params, terms, { iters = 60, h = .02, tol = 1e-6, bounds = {} } = {}) {
  const clampX = y => y.map((v, k) => { const b = bounds[params[k]]; return b ? Math.max(b[0], Math.min(b[1], v)) : v; });
  let x = clampX(params.map(p => get(pose, p)));
  const cost = r => r.reduce((a, v) => a + v * v, 0);
  let r = residuals(withParams(pose, params, x), terms), c = cost(r), lam = 1e-3;
  for (let it = 0; it < iters; it++) {
    const J = params.map((_, k) => { const y = x.slice(); y[k] += h; return residuals(withParams(pose, params, y), terms).map((v, j) => (v - r[j]) / h); });
    const n = params.length, A = [], g = [];
    for (let a = 0; a < n; a++) {
      A.push([]); let s = 0;
      for (let j = 0; j < r.length; j++) s += J[a][j] * r[j];
      g.push(-s);
      for (let b = 0; b < n; b++) { let t = 0; for (let j = 0; j < r.length; j++) t += J[a][j] * J[b][j]; A[a].push(t); }
    }
    let improved = false;
    for (let tries = 0; tries < 8; tries++) {
      const Ad = A.map((row, a) => row.map((v, b) => a === b ? v * (1 + lam) + 1e-9 : v));
      const dx = solveLin(Ad, g), y = clampX(x.map((v, k) => v + dx[k]));
      const ry = residuals(withParams(pose, params, y), terms), cy = cost(ry);
      if (cy < c) { const gain = c - cy; x = y; r = ry; c = cy; lam = Math.max(1e-7, lam / 3); improved = true; if (gain < tol) it = iters; break; }
      lam *= 5;
    }
    if (!improved) break;
  }
  return { pose: withParams(pose, params, x), cost: c, r };
}

// Coordinate descent with shrinking steps: for nearest-vertex gaps, whose landscape is too ragged for LM
// (the nearest vertex jumps, so the local gradient can point away from the contact). scale: step per param.
function descend(pose, params, terms, { bounds = {}, steps = [8, 4, 2, 1, .5, .25], scale = {} } = {}) {
  const cost = q => residuals(q, terms).reduce((a, v) => a + v * v, 0);
  let x = params.map(p => get(pose, p)), c = cost(pose);
  for (const st of steps) for (let better = true; better;) {
    better = false;
    for (let j = 0; j < x.length; j++) for (const s of [st, -st]) {
      const y = x.slice(), b = bounds[params[j]];
      y[j] += s * (scale[params[j]] || 1);
      if (b) y[j] = Math.max(b[0], Math.min(b[1], y[j]));
      const cy = cost(withParams(pose, params, y));
      if (cy < c - 1e-9) { x = y; c = cy; better = true; }
    }
  }
  return withParams(pose, params, x);
}

module.exports = { solve, descend, residuals, points, region, withParams, get };

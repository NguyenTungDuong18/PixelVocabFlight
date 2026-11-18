'use strict';
// The opening's hands as a real skinned mesh, posed here in JS (Blender only renders the result).
// Mesh, skeleton and weights: MakeHuman base mesh (CC0, Tools/BlenderForge/makehuman/, LICENSE.md),
// the forearm and hand of each side. The bone posing is the one opening_hands.py used to do (palm turned
// as the code hand's frame, each finger bone swung to point along the code skeleton's segment, thumb
// bones oriented by their nail, forearm along the code sleeve), so the code poses keep their meaning;
// doing it here lets the poses be solved against the very vertices that are rendered.
// Rig fixes (user 18/11/2026: the hand on the table looked like jelly):
// - stiff phalanges: MakeHuman blends every finger vertex over 2-3 bones (only ~10% of a middle
//   phalanx followed its bone); here each vertex of a finger is re-weighted by where it lies along the
//   finger, 1.0 to its own phalanx, blended only over a short band at each joint (PIP/DIP 24%, MCP 36%
//   of the shorter segment), so a phalanx moves as one rigid piece;
// - dual-quaternion skinning (volume kept at bent joints, as Blender's Preserve Volume);
// - the thumb can turn about its own axis (pose.thRoll, deg) so its pad can face what it presses.
const fs = require('fs'), path = require('path');
const H = require('./hand.cjs');

const MH = path.join(__dirname, '../../BlenderForge/makehuman');
const PARTS = ['lowerarm01', 'lowerarm02', 'wrist', 'metacarpal1', 'metacarpal2', 'metacarpal3', 'metacarpal4'].concat([1, 2, 3, 4, 5].flatMap(f => [1, 2, 3].map(k => `finger${f}-${k}`)));
// Deform units: 0 palm (wrist + metacarpals move as one), 1 lowerarm01, 2 lowerarm02, then finger f-k.
const UNITS = ['palm', 'lowerarm01', 'lowerarm02'].concat([1, 2, 3, 4, 5].flatMap(f => [1, 2, 3].map(k => `finger${f}-${k}`)));
const unitOf = n => n === 'wrist' || n.startsWith('metacarpal') ? 0 : UNITS.indexOf(n);
// Vertex part (as handChecks.cjs): 0 palm/wrist, 1-4 index..little, 5 thumb, 6 forearm.
const partOfUnit = u => u === 0 ? 0 : u <= 2 ? 6 : (f => f === 1 ? 5 : f - 1)(Math.floor((u - 3) / 3) + 1);

// ---------------------------------------------------------------- small vector / matrix helpers (3x3 row-major)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(...a));
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const tr = M => [0, 1, 2].map(i => [M[0][i], M[1][i], M[2][i]]);
const cols = (a, b, c) => [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]];
function axisAngle(ax, ang) {
  const [x, y, z] = ax, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
// Shortest-arc rotation taking unit a onto unit b (mathutils rotation_difference).
function swing(a, b) {
  const c = dot(a, b), ax = cross(a, b), s = Math.hypot(...ax);
  if (s < 1e-9) return c > 0 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : axisAngle(norm(cross(a, Math.abs(a[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), Math.PI);
  return axisAngle(mul(ax, 1 / s), Math.atan2(s, c));
}
function frameOf(y, up) {                              // columns: across, along the bone, toward the nail
  const u = norm(sub(up, mul(y, dot(up, y))));
  return cols(cross(y, u), y, u);
}
function quat(M) {                                     // rotation matrix -> [w, x, y, z]
  const t = M[0][0] + M[1][1] + M[2][2];
  let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [s / 4, (M[2][1] - M[1][2]) / s, (M[0][2] - M[2][0]) / s, (M[1][0] - M[0][1]) / s]; }
  else if (M[0][0] > M[1][1] && M[0][0] > M[2][2]) { const s = Math.sqrt(1 + M[0][0] - M[1][1] - M[2][2]) * 2; q = [(M[2][1] - M[1][2]) / s, s / 4, (M[0][1] + M[1][0]) / s, (M[0][2] + M[2][0]) / s]; }
  else if (M[1][1] > M[2][2]) { const s = Math.sqrt(1 + M[1][1] - M[0][0] - M[2][2]) * 2; q = [(M[0][2] - M[2][0]) / s, (M[0][1] + M[1][0]) / s, s / 4, (M[1][2] + M[2][1]) / s]; }
  else { const s = Math.sqrt(1 + M[2][2] - M[0][0] - M[1][1]) * 2; q = [(M[1][0] - M[0][1]) / s, (M[0][2] + M[2][0]) / s, (M[1][2] + M[2][1]) / s, s / 4]; }
  return q;
}
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];

// ---------------------------------------------------------------- MakeHuman data -> two arms
let DATA = null;
function load() {
  if (DATA) return DATA;
  const verts = [], faces = [];
  let grp = null;
  for (const line of fs.readFileSync(path.join(MH, 'base.obj'), 'utf8').split('\n')) {
    if (line.startsWith('v ')) verts.push(line.split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith('g ')) grp = line.split(/\s+/)[1].trim();
    else if (line.startsWith('f ') && grp === 'body') faces.push(line.trim().split(/\s+/).slice(1).map(t => parseInt(t, 10) - 1));
  }
  const skel = JSON.parse(fs.readFileSync(path.join(MH, 'default.mhskel'), 'utf8'));
  const W = JSON.parse(fs.readFileSync(path.join(MH, 'default_weights.mhw'), 'utf8')).weights;
  const joint = n => { const ix = skel.joints[n]; return ix.reduce((a, i) => add(a, verts[i]), [0, 0, 0]).map(v => v / ix.length); };
  DATA = {};
  for (const side of 'RL') DATA[side] = buildArm(side, verts, faces, skel, W, joint);
  return DATA;
}

function buildArm(side, verts, faces, skel, W, joint) {
  const nm = n => n + '.' + side;
  const vw = new Map();
  for (const n of PARTS) for (const [i, w] of W[nm(n)]) { if (!vw.has(i)) vw.set(i, {}); vw.get(i)[n] = w; }
  const keep = new Set([...vw].filter(([, d]) => Object.values(d).reduce((a, b) => a + b, 0) > .5).map(([i]) => i));
  const fs_ = faces.filter(f => f.every(i => keep.has(i)));
  const used = [...new Set(fs_.flat())].sort((a, b) => a - b), remap = new Map(used.map((o, k) => [o, k]));
  const bones = {};
  for (const n of PARTS) {
    const b = skel.bones[nm(n)], head = joint(b.head), tail = joint(b.tail);
    bones[n] = { head, tail, len: Math.hypot(...sub(tail, head)), dir: norm(sub(tail, head)), parent: b.parent.slice(0, -2) };
  }
  const co = used.map(i => verts[i]);
  const weights = used.map((i, k) => sharpen(vw.get(i), co[k], bones));
  // Rest hand frame (as the posing): u to the middle knuckle, v toward the index, w out of the back.
  const u = norm(sub(bones['finger3-1'].head, bones.wrist.head));
  let v = sub(bones['finger2-1'].head, bones['finger5-1'].head); v = norm(sub(v, mul(u, dot(v, u))));
  const w = mul(cross(u, v), side === 'R' ? 1 : -1);
  const unit = weights.map(ws => ws.reduce((b, x) => x[1] > b[1] ? x : b)[0]);
  const arm = { side, co, faces: fs_.map(f => f.map(i => remap.get(i))), weights, unit, part: unit.map(partOfUnit), bones, rest: { u, v, w }, knuckleSpan: Math.hypot(...sub(bones['finger2-1'].head, bones['finger5-1'].head)) };
  arm.regions = regions(arm);
  return arm;
}

// Named skin regions (vertex index lists) for contact solving and checks, from the rest mesh.
// Local px coords: origin the wrist joint, u to the middle knuckle, v toward the index, w out of the back.
// pad1-4 / thPad: the fingertip pads (palm side of the distal phalanx); tip1-4 / thTip: the end of the
// tip (pad edge + nail end); nail1-4; mid1-4: palm side of the middle phalanx; thenar, hypo(thenar),
// centre (hollow of the palm, should stay off a surface the hand rests on), heel (both pads by the wrist).
function regions(arm) {
  const sk = H.skeleton({ f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], th: [0, 0, 0, 0] }).fingers;
  const s = Math.hypot(...sub(sk[0].J[0], sk[3].J[0])) / arm.knuckleSpan, o = arm.bones.wrist.head, { u, v, w } = arm.rest;
  const loc = p => { const d = sub(p, o); return [dot(d, u) * s, dot(d, v) * s, dot(d, w) * s]; };
  const nailR = norm(add(mul(v, .62), mul(w, .78)));
  const R = {};
  const along = (i, n) => { const b = arm.bones[n], d = sub(arm.co[i], b.head), t = dot(d, b.dir) / b.len, off = sub(d, mul(b.dir, t * b.len)); return { t, off, r: Math.hypot(...off) || 1 }; };
  const pick = (name, test) => { R[name] = []; arm.co.forEach((p, i) => { if (test(i, loc(p))) R[name].push(i); }); };
  for (let f = 2; f <= 5; f++) {
    const n3 = UNITS.indexOf(`finger${f}-3`), n2 = UNITS.indexOf(`finger${f}-2`), k = f - 1;
    pick('pad' + k, i => { if (arm.unit[i] !== n3) return false; const a = along(i, `finger${f}-3`); return a.t > .2 && dot(a.off, w) < -.45 * a.r; });
    pick('tip' + k, i => arm.unit[i] === n3 && along(i, `finger${f}-3`).t > .78);
    pick('nail' + k, i => { if (arm.unit[i] !== n3) return false; const a = along(i, `finger${f}-3`); return a.t > .3 && dot(a.off, w) > .5 * a.r; });
    pick('mid' + k, i => { if (arm.unit[i] !== n2) return false; const a = along(i, `finger${f}-2`); return dot(a.off, w) < -.45 * a.r; });
    pick('dig' + k, i => arm.part[i] === k);
  }
  const t3 = UNITS.indexOf('finger1-3');
  pick('thPad', i => { if (arm.unit[i] !== t3) return false; const a = along(i, 'finger1-3'); return a.t > .15 && dot(a.off, nailR) < -.4 * a.r; });
  pick('thTip', i => arm.unit[i] === t3 && along(i, 'finger1-3').t > .78);
  pick('thumb', i => arm.part[i] === 5);
  const palmish = i => arm.part[i] === 0 || arm.part[i] === 5;
  pick('thenar', (i, [a, b, c]) => palmish(i) && b > 6 && b < 34 && a > 4 && a < 44 && c < -9);
  pick('hypo', (i, [a, b, c]) => arm.part[i] === 0 && b < -12 && a > 2 && a < 46 && c < -7);
  pick('heel', (i, [a, b, c]) => palmish(i) && a > 0 && a < 34 && c < -12);
  pick('centre', (i, [a, b, c]) => arm.part[i] === 0 && Math.abs(b) < 10 && a > 36 && a < 62 && c < -3);
  pick('ulnar', (i, [a, b]) => arm.part[i] === 0 && b < -24);
  pick('palm', i => arm.part[i] === 0);
  pick('hand', i => arm.part[i] !== 6);
  pick('arm', i => arm.part[i] === 6);
  return R;
}

// Arc position along digit f's bone chain of the nearest point on it (a < 0: before the base joint),
// its distance dmin, and rmax: past that distance a vertex is web or palm skin, not the digit's tube.
const RMAX = [0, .31, .39, .33, .34, .36];               // x the digit's base length (thumb: its proximal phalanx): ~p90 of the vertices MakeHuman gives > .9 to the digit
function chainPos(f, p, bones) {
  const ch = [1, 2, 3].map(k => bones[`finger${f}-${k}`]), J = [ch[0].head, ch[1].head, ch[2].head], L = ch.map(b => b.len);
  let a = 0, dmin = 1e9;
  for (let k = 0; k < 3; k++) {
    const t = dot(sub(p, J[k]), ch[k].dir) / L[k], tc = Math.max(k ? 0 : -1, Math.min(k < 2 ? 1 : 2, t));
    const q = add(J[k], mul(ch[k].dir, tc * L[k])), dd = Math.hypot(...sub(p, q));
    if (dd < dmin) { dmin = dd; a = L.slice(0, k).reduce((x, y) => x + y, 0) + tc * L[k]; }
  }
  return { a, dmin, rmax: RMAX[f] * (f === 1 ? L[1] : L[0]) };
}
// Stiff fingers: a finger (or thumb) vertex gets its weights from its place along that digit's bone
// chain; palm, wrist and forearm vertices keep MakeHuman's (soft, as real skin there) weights.
const BAND = [.18, .12, .12];                          // half-width of the blend at MCP (CMC), PIP (MCP), DIP (IP), x shorter segment
function sharpen(d, p, bones) {
  const sum = ns => ns.reduce((a, n) => a + (d[n] || 0), 0);
  let best = null;
  for (let f = 1; f <= 5; f++) {
    const s = sum([1, 2, 3].map(k => `finger${f}-${k}`));
    if (!best || s > best.s) best = { f, s };
  }
  const out = new Map();
  const put = (u, w) => { if (w > 1e-4) out.set(u, (out.get(u) || 0) + w); };
  const along = best.s > .25 && chainPos(best.f, p, bones);
  if (process.env.RIG_SOFT || !along || along.dmin > along.rmax) for (const [n, w] of Object.entries(d)) put(unitOf(n), w);   // palm, web, wrist: MakeHuman's soft skin (RIG_SOFT: the old rig everywhere)
  else {
    const ch = [1, 2, 3].map(k => bones[`finger${best.f}-${k}`]), L = ch.map(b => b.len), a = along.a;
    const units = [0, ...[1, 2, 3].map(k => UNITS.indexOf(`finger${best.f}-${k}`))];
    const aj = [0, L[0], L[0] + L[1]];
    // Base joint: the thumb's CMC sits in the thenar, soft as MakeHuman has it (keep its palm/thumb split).
    let seg = 3, wNext = 1;
    for (let k = 0; k < 3; k++) {
      const h = BAND[k] * Math.min(k ? L[k - 1] : L[0], L[k]);
      if (a < aj[k] + h) { seg = k; const t = Math.max(0, Math.min(1, (a - aj[k] + h) / (2 * h))); wNext = t * t * (3 - 2 * t); break; }
    }
    if (seg === 0 && best.f === 1) {
      const base = (d['finger1-1'] || 0) + (d['finger1-2'] || 0) * .5, rest = sum(['wrist', 'metacarpal1', 'metacarpal2', 'metacarpal3', 'metacarpal4']);
      const k = base / Math.max(1e-6, base + rest);
      put(units[1], k); put(0, 1 - k);
    } else { put(units[seg], 1 - wNext); put(units[seg + 1] ?? units[3], wNext); }
  }
  if (!out.size) put(0, 1);
  let tot = 0; for (const w of out.values()) tot += w;
  return [...out].filter(([, w]) => w / tot > .01).map(([u, w]) => [u, w / tot]);
}

// ---------------------------------------------------------------- posing
const G2B = p => [p[0], -p[1], p[2]];
const D2R = Math.PI / 180;
// The code pose -> the bone transforms (Blender space, unscaled rig units): unit -> { M, t }, p' = M p + t.
function boneTransforms(arm, pose) {
  const F = H.frame(pose), S = H.skeleton(pose), sleeve = H.sleeveLine(pose);
  const Wd = j => [0, 1, 2].map(i => F.P[i] + F.U[i] * j[0] + F.V[i] * j[1] + F.W[i] * j[2]);
  const fingers = S.fingers.map(f => f.J.map(Wd)), thumb = S.thumb.J.map(Wd);
  const B = arm.bones;
  const s = Math.hypot(...sub(fingers[0][0], fingers[3][0])) / arm.knuckleSpan;
  const { u, v, w } = arm.rest;
  const R = mm(cols(G2B(F.U), G2B(F.V), G2B(F.W)), tr(cols(u, v, w)));
  const Kr = B['finger3-1'].head, Kt = mul(G2B(fingers[1][0]), 1 / s);
  const T = { palm: { M: R, t: sub(Kt, mv(R, Kr)) } };
  const ap = (X, p) => add(mv(X.M, p), X.t);
  const tOf = (n) => { const p = B[n].parent; return p === 'wrist' || p.startsWith('metacarpal') ? T.palm : T[p]; };
  for (let f = 2; f <= 5; f++) {
    const J = fingers[f - 2];
    for (let k = 1; k <= 3; k++) {
      const n = `finger${f}-${k}`, P = tOf(n), hp = ap(P, B[n].head);
      const dt = norm(sub(G2B(J[k]), G2B(J[k - 1]))), y0 = norm(mv(P.M, B[n].dir));
      const M = mm(swing(y0, dt), P.M);
      T[n] = { M, t: sub(hp, mv(M, B[n].head)) };
    }
  }
  // Thumb: full orientation from its nail (a bare swing twisted the base and pinched the web).
  const nailR = norm(add(mul(v, .62), mul(w, .78)));
  const nailT0 = norm(add(mul(G2B(F.V), .62), mul(G2B(F.W), .78)));
  for (let k = 1; k <= 3; k++) {
    const n = `finger1-${k}`, P = tOf(n), hp = ap(P, B[n].head);
    const dt = norm(sub(G2B(thumb[k]), G2B(thumb[k - 1])));
    const nailT = pose.thRoll ? mv(axisAngle(dt, -pose.thRoll * D2R * (pose.left ? -1 : 1)), nailT0) : nailT0;
    const M = mm(frameOf(dt, nailT), tr(frameOf(B[n].dir, nailR)));
    T[n] = { M, t: sub(hp, mv(M, B[n].head)) };
  }
  // Forearm: turns with the hand, lies along the sleeve, ends at the wrist.
  const axis = norm(sub(G2B(sleeve.start), G2B(sleeve.end)));
  let end = ap(T.palm, B.wrist.head);
  for (const n of ['lowerarm02', 'lowerarm01']) {
    const M = mm(swing(norm(mv(R, B[n].dir)), axis), R), start = sub(end, mul(axis, B[n].len));
    T[n] = { M, t: sub(start, mv(M, B[n].head)) };
    end = start;
  }
  return { T, s, B, ap };
}

// Dual quaternion of a rigid transform.
function dq({ M, t }) {
  const r = quat(M), d = qmul([0, ...t], r).map(x => x * .5);
  return { r, d };
}
// Posed hand: { co: Float64Array (game coords, flat), joints: { fingers, thumb } (game), s }.
// only: optional list of vertex indices to pose (the rest stay 0).
function posed(pose, only = null) {
  const arm = load()[pose.left ? 'L' : 'R'];
  const { T, s, B, ap } = boneTransforms(arm, pose);
  const Q = UNITS.map(n => T[n] ? dq(T[n]) : null);
  const n = arm.co.length, co = new Float64Array(n * 3);
  const idx = only || arm.co.keys();
  for (const i of idx) {
    const ws = arm.weights[i], q0 = Q[ws[0][0]].r;
    const r = [0, 0, 0, 0], d = [0, 0, 0, 0];
    for (const [u, w] of ws) {
      const q = Q[u], sg = (q.r[0] * q0[0] + q.r[1] * q0[1] + q.r[2] * q0[2] + q.r[3] * q0[3]) < 0 ? -w : w;
      for (let j = 0; j < 4; j++) { r[j] += q.r[j] * sg; d[j] += q.d[j] * sg; }
    }
    const l = Math.hypot(...r), c0 = r.map(x => x / l), ce = d.map(x => x / l);
    const p = arm.co[i], qv = [c0[1], c0[2], c0[3]], ev = [ce[1], ce[2], ce[3]];
    const a = add(cross(qv, p), mul(p, c0[0]));
    let x = add(p, mul(cross(qv, a), 2));
    x = add(x, mul(add(sub(mul(ev, c0[0]), mul(qv, ce[0])), cross(qv, ev)), 2));
    co[i * 3] = x[0] * s; co[i * 3 + 1] = -x[1] * s; co[i * 3 + 2] = x[2] * s;
  }
  const gp = v => [+(v[0] * s).toFixed(3), +(-v[1] * s).toFixed(3), +(v[2] * s).toFixed(3)];  const ch = f => [1, 2, 3].map(k => gp(ap(T[`finger${f}-${k}`], B[`finger${f}-${k}`].head))).concat([gp(ap(T[`finger${f}-3`], B[`finger${f}-3`].tail))]);
  return { co, joints: { fingers: [2, 3, 4, 5].map(ch), thumb: ch(1) }, s, arm, T };
}

// Skin gaps (px) between neighbouring fingers' ends: index-middle, middle-ring, ring-little, each the
// nearest distance from one finger's distal phalanx to any phalanx of the other (a shorter or more
// curled finger's tip lies beside its neighbour's middle or proximal one). co: posed coords, or posed here.
function fingerGaps(pose, co = null) {
  const arm = load()[pose.left ? 'L' : 'R'];
  if (!arm.ends) {
    const of = (f, ks) => arm.unit.reduce((a, u, i) => (ks.some(k => UNITS[u] === `finger${f}-${k}`) && arm.weights[i].length === 1 && i % 2 === 0 ? a.concat(i) : a), []);
    arm.ends = [2, 3, 4, 5].map(f => ({ tip: of(f, [3]), end: of(f, [1, 2, 3]) }));
  }
  if (!co) co = posed(pose, arm.ends.flatMap(e => e.end)).co;
  const d = (A, B) => { let m = 1e9; for (const a of A) for (const b of B) m = Math.min(m, Math.hypot(co[a * 3] - co[b * 3], co[a * 3 + 1] - co[b * 3 + 1], co[a * 3 + 2] - co[b * 3 + 2])); return m; };
  return [0, 1, 2].map(j => Math.min(d(arm.ends[j].tip, arm.ends[j + 1].end), d(arm.ends[j + 1].tip, arm.ends[j].end)));
}

module.exports = { load, posed, boneTransforms, chainPos, UNITS, partOfUnit, fingerGaps };

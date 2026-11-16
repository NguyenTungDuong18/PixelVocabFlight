'use strict';
// Anatomical right hand for the opening (research-hand.md). All sizes are fractions of the palm
// width HW (across the knuckles). Hand frame: u along the fingers, v toward the thumb, w out of
// the back of the hand. The palm is four metacarpals blended into one mass with a volar pad,
// thenar and hypothenar; knuckles sit on a shallow arc, fingertips on a deeper one; fingers fan
// (index -8, ring +7, little +18 deg) and every joint bends on its own.
// Neutral on purpose: no ring, no watch, no age marks; short plain nails, plain dark wool sleeve.
const { capsule, sphere, ellipsoid, smin, len3, clamp } = require('./scene3d.cjs');

const HW = 66;
const D = Math.PI / 180;
// [knuckle u, knuckle v, length from knuckle to fingertip, base radius, tip radius, splay deg]
// Knuckle arc: middle highest; index -.06 HW, ring -.09 HW, little -.2 HW.
// Fingers are about as wide as the knuckle spacing (they touch at the web) and taper ~20%; a
// relaxed hand barely fans (a few degrees) and the fingers converge as they curl (cascade sign).
const FINGERS = [
  [1.15 - .06, .38, .945, .118, .094, 4],
  [1.15, .125, 1.05, .12, .096, 0],
  [1.15 - .09, -.13, .975, .115, .092, -4],
  [1.15 - .2, -.37, .79, .102, .082, -9]
].map(([u, v, L, r0, r1, sp]) => ({ u: u * HW, v: v * HW, L: L * HW, r0: r0 * HW, r1: r1 * HW, sp }));
const SEG = [.42, .30, .28];                                   // proximal / middle / distal phalanx

// Pose: { P: [x, y, z] wrist centre, yaw (deg, direction of the fingers on the table), pitch (deg,
//   fingers down), roll (deg, thumb side up), tilt (deg about the world x axis), f: [[mcp, pip, dip, splay+] x4] deg,
//   th: [abduction, flexion, mcp, ip] deg, tendon 0..1, press 0..1 }
function frame(pose) {
  const y = pose.yaw * D, p = (pose.pitch || 0) * D, r = (pose.roll || 0) * D;
  // left: the mirror image (v, toward the thumb, flips side); roll still lifts the thumb side.
  const m = pose.left ? -1 : 1;
  const U0 = [Math.cos(y), Math.sin(y), 0], V0 = [m * Math.sin(y), -m * Math.cos(y), 0], W0 = [0, 0, 1];
  const U1 = U0.map((u, i) => u * Math.cos(p) - W0[i] * Math.sin(p)), W1 = U0.map((u, i) => u * Math.sin(p) + W0[i] * Math.cos(p));
  const V = V0.map((v, i) => v * Math.cos(r) + W1[i] * Math.sin(r)), W = W1.map((w, i) => w * Math.cos(r) - V0[i] * Math.sin(r));
  // shake: physiological tremor under load, a small rigid offset (px) applied after posing.
  const P = pose.shake ? pose.P.map((p, i) => p + (pose.shake[i] || 0)) : pose.P;
  // tilt: extra turn about the world x axis (the tin's hinge), so a hand riding the lid turns with it.
  const t = (pose.tilt || 0) * D, X = a => [a[0], a[1] * Math.cos(t) - a[2] * Math.sin(t), a[1] * Math.sin(t) + a[2] * Math.cos(t)];
  return { U: X(U1), V: X(V), W: X(W), P };
}
const toWorld = (F, u, v, w) => [0, 1, 2].map(i => F.P[i] + F.U[i] * u + F.V[i] * v + F.W[i] * w);

// Forward kinematics in the hand frame: joints of every finger and the thumb.
function skeleton(pose) {
  const fingers = FINGERS.map((g, i) => {
    const [mcp, pip, dip, spx = 0] = pose.f[i], s = (g.sp + spx) * D;
    const bone = g.L - g.r1, J = [[g.u, g.v, 0]];
    let A = 0;
    [mcp, pip, dip].forEach((a, k) => {
      A += a * D;
      // Curling fingers point toward the middle of the wrist: the fan closes as flexion builds.
      const sk = s - Math.max(0, A) * g.v / HW * .5;
      const l = bone * SEG[k], p = J[k];
      J.push([p[0] + Math.cos(sk) * Math.cos(A) * l, p[1] + Math.sin(sk) * Math.cos(A) * l, p[2] - Math.sin(A) * l]);
    });
    return { J, r0: g.r0, r1: g.r1, rm: (g.r0 + g.r1) / 2 };
  });
  // Thumb: carpometacarpal joint low on the radial side of the wrist; its metacarpal lies in the
  // thenar mass, the free part (.7 of the middle finger) leaves the palm .4 HW below the index knuckle.
  const [abd, flex, mcp, ip] = pose.th;
  const C = [.2 * HW, .2 * HW, -.1 * HW];
  let a = (34 + abd) * D, b = (16 + flex) * D;                    // at rest the thumb lies along the index, not out like a fifth finger
  const dir = () => [Math.cos(b) * Math.cos(a), Math.sin(a) * Math.cos(b), -Math.sin(b)];
  const T = [C];
  const lens = [.5 * HW, .4 * HW, .33 * HW];
  [0, mcp, ip].forEach((f, k) => {
    b += f * D * .8; a -= f * D * .45;                            // the thumb folds toward the palm as it flexes
    const d = dir(), p = T[k];
    T.push([p[0] + d[0] * lens[k], p[1] + d[1] * lens[k], p[2] + d[2] * lens[k]]);
  });
  return { fingers, thumb: { J: T, r: [.12 * HW, .115 * HW, .1 * HW, .09 * HW] } };
}

// Builds the hand (skin) and sleeve objects for scene3d. joints (optional, world coords
// { fingers: [4][4], thumb: [4] }): the joints of the Blender mesh posed on this pose, so the
// shading details (nails, knuckles, creases) sit on that mesh instead of on this skeleton.
function build(pose, joints) {
  const F = frame(pose), S = skeleton(pose), tendon = pose.tendon || 0;
  const loc = (x, y, z) => { const dx = x - F.P[0], dy = y - F.P[1], dz = z - F.P[2]; return [dx * F.U[0] + dy * F.U[1] + dz * F.U[2], dx * F.V[0] + dy * F.V[1] + dz * F.V[2], dx * F.W[0] + dy * F.W[1] + dz * F.W[2]]; };
  if (joints) {
    S.fingers.forEach((f, i) => { f.J = joints.fingers[i].map(p => loc(...p)); });
    S.thumb.J = joints.thumb.map(p => loc(...p));
  }
  const h = HW;
  // Palm parts (hand frame).
  const meta = FINGERS.map(g => [.12 * h, g.v * .42, .02 * h, g.u - 2, g.v, 0, (g.r0 + .02 * h)]);
  function palm(u, v, w) {
    let d = 1e9;
    for (const m of meta) d = smin(d, capsule(u, v, w, m[0], m[1], m[2], m[3], m[4], m[5], m[6]), .14 * h);
    d = smin(d, ellipsoid(u - .62 * h, v, w + .1 * h, .5 * h, .45 * h, .12 * h), .1 * h);                  // volar pad
    d = smin(d, capsule(u, v, w, .2 * h, .22 * h, -.1 * h, .6 * h, .42 * h, -.12 * h, .15 * h, .12 * h), .1 * h);   // thenar
    d = smin(d, capsule(u, v, w, .18 * h, -.3 * h, -.05 * h, .85 * h, -.38 * h, -.04 * h, .11 * h, .09 * h), .1 * h); // hypothenar
    // Wrist: wider than thick, narrower than the palm (.72 HW).
    const s = 1.45;
    d = smin(d, capsule(u, v, w * s, -.7 * h, 0, .05 * h * s, .05 * h, 0, .04 * h * s, .34 * h) / s, .12 * h);
    d = smin(d, sphere(u, v, w, -.02 * h, -.31 * h, .1 * h, .07 * h), .05 * h);                             // head of the ulna
    d = smin(d, ellipsoid(u - .62 * h, v - .36 * h, w - .02 * h, .2 * h, .1 * h, .1 * h), .08 * h);        // muscle between thumb and index
    for (const f of S.fingers) d = smin(d, sphere(u, v, w, f.J[0][0] - .02 * h, f.J[0][1], f.J[0][2] + .045 * h, f.r0 + .015 * h), .045 * h);   // knuckles
    if (tendon > 0) for (const f of S.fingers) d = smin(d, capsule(u, v, w, f.J[0][0] - .08 * h, f.J[0][1], .11 * h, .1 * h, f.J[0][1] * .3, .12 * h, .018 * h * tendon + .004 * h), .03 * h);
    return d;
  }
  function finger(f, u, v, w) {
    const J = f.J;
    let d = capsule(u, v, w, ...J[0], ...J[1], f.r0, f.rm + .004 * h);
    d = Math.min(d, capsule(u, v, w, ...J[1], ...J[2], f.rm + .004 * h, f.r1 + .006 * h));
    d = Math.min(d, capsule(u, v, w, ...J[2], ...J[3], f.r1 + .006 * h, f.r1));
    d = smin(d, sphere(u, v, w, J[1][0], J[1][1], J[1][2] + .006 * h, f.rm + .004 * h), .03 * h);       // PIP knuckle, a soft swelling, not a ring
    return d;
  }
  function thumb(u, v, w) {
    const { J, r } = S.thumb;
    let d = capsule(u, v, w, ...J[0], ...J[1], r[0], r[1]);
    d = Math.min(d, capsule(u, v, w, ...J[1], ...J[2], r[1], r[2]));
    d = Math.min(d, capsule(u, v, w, ...J[2], ...J[3], r[2], r[3]));
    // The web between thumb and index.
    const ix = S.fingers[0].J[0];
    d = smin(d, capsule(u, v, w, J[1][0], J[1][1], J[1][2], ix[0] - .1 * h, ix[1] - .02 * h, ix[2] - .03 * h, .05 * h), .07 * h);
    return d;
  }
  function skin(x, y, z) {
    const [u, v, w] = loc(x, y, z), p = palm(u, v, w);
    let d = smin(p, thumb(u, v, w), .1 * h);
    for (const f of S.fingers) d = Math.min(d, smin(p, finger(f, u, v, w), .06 * h));
    return d;
  }
  // Which part a surface point belongs to, for the shading details (nails, creases).
  function part(x, y, z) {
    const [u, v, w] = loc(x, y, z);
    let best = { kind: 'palm', d: palm(u, v, w) };
    S.fingers.forEach((f, i) => {
      for (let k = 0; k < 3; k++) {
        const a = f.J[k], b = f.J[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = len3(dx, dy, dz);
        const t = clamp(((u - a[0]) * dx + (v - a[1]) * dy + (w - a[2]) * dz) / (l * l));
        const d = len3(u - a[0] - dx * t, v - a[1] - dy * t, w - a[2] - dz * t) - f.rm;
        if (d < best.d - .5) best = { kind: 'finger', i, k, t, d, len: l };
      }
    });
    const T = S.thumb.J;
    for (let k = 1; k < 3; k++) {
      const a = T[k], b = T[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = len3(dx, dy, dz);
      const t = clamp(((u - a[0]) * dx + (v - a[1]) * dy + (w - a[2]) * dz) / (l * l));
      const d = len3(u - a[0] - dx * t, v - a[1] - dy * t, w - a[2] - dz * t) - S.thumb.r[k + 1];
      if (d < best.d - .5) best = { kind: 'thumb', k, t, d, len: l };
    }
    return { ...best, u, v, w };
  }
  // Bounding box from every joint.
  const pts = [];
  for (const f of S.fingers) for (const j of f.J) pts.push(j);
  for (const j of S.thumb.J) pts.push(j);
  pts.push([-.7 * h, 0, 0], [.05 * h, .45 * h, 0], [.05 * h, -.45 * h, 0], [.9 * h, -.5 * h, 0]);
  const wp = pts.map(p => toWorld(F, ...p)), pad = .2 * h;
  const box = [0, 1, 2].map(i => Math.min(...wp.map(p => p[i])) - pad).concat([0, 1, 2].map(i => Math.max(...wp.map(p => p[i])) + pad));
  const hand = { id: 'hand', hw: HW, box, sdf: skin, part, pose, frame: F, skeleton: S, toWorld: (u, v, w) => toWorld(F, u, v, w) };
  // Sleeve: plain dark wool from just behind the wrist, out of the picture.
  // The forearm keeps its own line (yaw only, rising gently to the elbow): the wrist does the bending.
  const yw = pose.yaw * D, Uf = [Math.cos(yw), Math.sin(yw)];
  const sa0 = toWorld(F, -.5 * h, 0, .04 * h), sa = [sa0[0] - Uf[0] * .14 * h, sa0[1] - Uf[1] * .14 * h, sa0[2]];
  const sb = [sa[0] - Uf[0] * 6 * h, sa[1] - Uf[1] * 6 * h, sa[2] + 6 * h * .14], sr = .5 * h;
  const sleeve = {
    id: 'sleeve', sdf: (x, y, z) => capsule(x, y, z, ...sa, ...sb, sr, sr * 1.15),
    box: [Math.min(sa[0], sb[0]) - sr * 1.2, Math.min(sa[1], sb[1]) - sr * 1.2, Math.min(sa[2], sb[2]) - sr * 1.2, Math.max(sa[0], sb[0]) + sr * 1.2, Math.max(sa[1], sb[1]) + sr * 1.2, Math.max(sa[2], sb[2]) + sr * 1.2],
    start: sa, end: sb, r: sr
  };
  return { hand, sleeve };
}

// World positions of the fingertip pads (lowest point of each tip) and of the thumb tip.
function tips(pose) {
  const F = frame(pose), S = skeleton(pose);
  return {
    fingers: S.fingers.map(f => toWorld(F, ...f.J[3])).map((p, i) => [p[0], p[1], p[2] - S.fingers[i].r1]),
    thumb: (() => { const p = toWorld(F, ...S.thumb.J[3]); return [p[0], p[1], p[2] - S.thumb.r[3]]; })()
  };
}
// Lowers or raises each finger at the knuckle (MCP) so its pad rests `gap` px above surface(x, y).
function seat(pose, surface, gaps = [0, 0, 0, 0]) {
  const f = pose.f.map(a => a.slice());
  for (let i = 0; i < 4; i++) {
    let lo = -25, hi = 80;
    for (let it = 0; it < 22; it++) {
      const mid = (lo + hi) / 2; f[i][0] = mid;
      const t = tips({ ...pose, f }).fingers[i];
      if (t[2] - surface(t[0], t[1]) > gaps[i]) lo = mid; else hi = mid;
    }
    f[i][0] = (lo + hi) / 2;
  }
  // The thumb rests on its side: its flexion brings the tip down to the surface too.
  const th = pose.th.slice(), gt = gaps.length > 4 ? gaps[4] : gaps[3];
  if (gt === null) return { ...pose, f };
  let lo = -40, hi = 90;
  for (let it = 0; it < 22; it++) {
    const mid = (lo + hi) / 2; th[1] = mid;
    const t = tips({ ...pose, f, th }).thumb;
    if (t[2] - surface(t[0], t[1]) > gt) lo = mid; else hi = mid;
  }
  th[1] = (lo + hi) / 2;
  return { ...pose, f, th };
}

// Grasp by contact: each finger (and the thumb) curls from `open` toward `closed` until its skin
// meets the surface `sdf` (world, <0 inside), leaving `gap` px. Per digit k in 0..1 is bisected,
// so fingers wrap round whatever they hold instead of passing through it.
function wrap(pose, sdf, open, closed, gap = 0, thumb = null) {
  const F = frame(pose), f = pose.f.map(a => a.slice());
  const lerpA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const clearance = (J, R) => {
    let m = 1e9;
    for (let k = 0; k < J.length - 1; k++) for (let s = 0; s <= 4; s++) {
      const t = s / 4, p = J[k].map((v, i) => v + (J[k + 1][i] - v) * t), r = R[k] + (R[k + 1] - R[k]) * t;
      m = Math.min(m, sdf(...toWorld(F, ...p)) - r);
    }
    return m;
  };
  for (let i = 0; i < 4; i++) {
    let lo = -.2, hi = 1;                                         // below 0: a finger that starts in contact lifts (MCP extends)
    for (let it = 0; it < 16; it++) {
      const mid = (lo + hi) / 2; f[i] = lerpA(open[i], closed[i], mid);
      const g = skeleton({ ...pose, f }).fingers[i];
      if (clearance(g.J, [g.r0, g.rm, g.r1, g.r1]) > gap) lo = mid; else hi = mid;
    }
    f[i] = lerpA(open[i], closed[i], lo);
  }
  let th = pose.th;
  if (thumb) {
    let lo = 0, hi = 1;
    for (let it = 0; it < 16; it++) {
      const mid = (lo + hi) / 2, t = lerpA(thumb[0], thumb[1], mid), T = skeleton({ ...pose, f, th: t }).thumb;
      if (clearance(T.J.slice(1), T.r.slice(1)) > gap) lo = mid; else hi = mid;
    }
    th = lerpA(thumb[0], thumb[1], lo);
  }
  return { ...pose, f, th };
}

// Pushes the whole hand (palm and finger bases) out of `sdf` so it rests on, never in, the table
// or the tin: the deepest sample is moved out along the surface normal until all clear `gap`.
function clear(pose, sdf, gap = .3) {
  const h = HW, pts = [[0, 0, 0, .3], [.55, 0, 0, .2], [.6, .3, -.05, .15], [.6, -.3, -.05, .14], [.25, .25, -.1, .13], [.25, -.3, -.05, .12]];
  let P = pose.P.slice();
  for (let it = 0; it < 30; it++) {
    const F = frame({ ...pose, P }), S = skeleton({ ...pose, P });
    const samples = pts.map(([u, v, w, r]) => [toWorld(F, u * h, v * h, w * h), r * h]).concat(S.fingers.map(f => [toWorld(F, ...f.J[0]), f.r0]));
    let worst = null;
    for (const [p, r] of samples) { const m = sdf(...p) - r; if (!worst || m < worst.m) worst = { m, p }; }
    if (worst.m >= gap) break;
    const e = .5, [x, y, z] = worst.p, n = [sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)], nl = Math.hypot(...n) || 1;
    P = P.map((v, i) => v + n[i] / nl * (gap - worst.m + .05));
  }
  return { ...pose, P };
}

// Thumb IK with contact: the abduction/flexion that brings the thumb pad nearest `target` without
// the thumb passing through `sdf` (mcp and ip bend as given, a pressing thumb keeps them bent).
function aimThumb(pose, sdf, target, [mcp, ip] = [20, 12], gap = .2) {
  const F = frame(pose);
  let best = null;
  for (let a = -30; a <= 120; a += 4) for (let b = -30; b <= 110; b += 4) {
    const th = [a, b, mcp, ip], T = skeleton({ ...pose, th }).thumb;
    let clear = 1e9;
    for (let k = 1; k < 3; k++) for (let s = 0; s <= 4; s++) {
      const t = s / 4, p = T.J[k].map((v, i) => v + (T.J[k + 1][i] - v) * t);
      clear = Math.min(clear, sdf(...toWorld(F, ...p)) - (T.r[k] + (T.r[k + 1] - T.r[k]) * t));
    }
    if (clear < gap) continue;
    const tip = toWorld(F, ...T.J[3]), d = Math.hypot(tip[0] - target[0], tip[1] - target[1], tip[2] - target[2]) + clear * .5;
    if (!best || d < best.d) best = { d, th };
  }
  return best ? { ...pose, th: best.th } : pose;
}

module.exports = { HW, build, tips, seat, wrap, clear, aimThumb, frame, skeleton };

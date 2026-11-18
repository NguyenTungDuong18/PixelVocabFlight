'use strict';
// Opening, the two hands frame by frame (P1.04 cut_open_tin_hand 20 @8, P1.05 cut_open_tin_lid 30 @8).
// Every pose is solved on the real skinned mesh (handRig.cjs, handSolve.cjs): contacts are vertices of
// the mesh at 0.3 px from the surface, held contacts are the same vertices kept in place (on the lid:
// carried with the lid) from frame to frame. Each frame's hands carry their contact list (CONTACTS,
// pose.contacts: [region, surface, pinned]) which Tools/BlenderForge/handChecks.cjs measures.
//
// P1.04 (sound-locked: right touches at 6, left at 9, both still from 12, 19 = P1.05 0): reach to grasp
// (research: fast out, long settle, travel 0 .14 .40 .65 .83 .95 1; the palm turns in the first half;
// the hand opens widest at ~2/3 of the reach then closes; thumb and index touch first, the others the
// next frame with the squeeze, then held identical).
// - Left (user 15/11): palm (thenar heel) on the left wall under the lid skirt, index round the
//   back-left corner on the back wall, middle/ring/little pads on the table, thumb pad on the wall
//   just under the skirt.
// - Right: palm heel on the right wall, index and middle pads on the tin, ring and little on the
//   table, thumb pad on the wall: a different hand, not the left one mirrored.
// P1.05, the lid (user 18/11: open it with the whole hand, not a flick):
//  0-1 hold; 2-4 the right hand leaves the wall for the front (release, travel, hover);
//  5 it takes the lid: fingertips 2-4 under the rolled lip, thumb pad on the body's front face below
//    (the counter-push), little finger and the heel of the hand on the table (the anchor);
//  6=7, 8 effort: the hand levers about its heel (wrist extends, forearm sinks), held frames, no
//    tremor; 9 the lid cracks (3.5 deg); 10 it gives (26 deg), the hand thrown up after it, fingers late;
//  11-15 the fingertips catch the rim and push it over to the stop (113 at 15): the forearm rises,
//    the wrist turns, the tips ride the rim (held on it, in the lid's frame);
//  16 the hand lets go (the lid bounces back to 106), 17-20 it travels down to the right (ease-out),
//  21 middle and ring pads land, 22 index, little and the heel, 23 the thumb: resting, 24-29 held.
// Left during P1.05: never moves (all its contacts held); it clamps harder through the effort
// (tendon/press), catches the jolt when the lid gives (10), then eases.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const S3 = require('./scene3d.cjs');
const T = require('./tin.cjs');
const H = require('./hand.cjs');
const HS = require('./handSolve.cjs');
const RIG = require('./handRig.cjs');

// ---------------------------------------------------------------- solids
const bodySolid = (x, y, z) => S3.extrude(S3.rrect(x - T.CX, y - T.CY, T.HX, T.HY, 10), z, 0, T.BH);
// The lid as a solid block at its angle (its render sdf is a thin shell).
function lidSolid(deg) {
  const th = deg * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  return (x, y, z) => {
    const Y = y - T.HINGE_Y, Z = z - T.HINGE_Z;
    return S3.extrude(S3.rrect(x - T.CX, Y * c + Z * s + T.HINGE_Y - T.CY, T.HX + 2.5, T.HY + 2.5, 12.5), -Y * s + Z * c + T.HINGE_Z, T.LZ0, T.LZ1);
  };
}
const table = (x, y, z) => z;
const solidAt = deg => { const lid = lidSolid(deg); return (x, y, z) => Math.min(bodySolid(x, y, z), lid(x, y, z), z); };
const tinAt = deg => { const lid = lidSolid(deg); return (x, y, z) => Math.min(bodySolid(x, y, z), lid(x, y, z)); };
const surface = (name, deg) => name === 'body' ? bodySolid : name === 'table' ? table : name === 'tin' ? tinAt(deg) : lidSolid(deg);
// A world point carried with the lid from angle d0 to d1 (turn about the hinge line, along x).
function withLid(p, d0, d1) {
  const a = (d1 - d0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), Y = p[1] - T.HINGE_Y, Z = p[2] - T.HINGE_Z;
  return [p[0], Y * c - Z * s + T.HINGE_Y, Y * s + Z * c + T.HINGE_Z];
}

// ---------------------------------------------------------------- pose helpers
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
function mix(A, B, t, tf = t) {
  const m = (x, y, k) => Array.isArray(x) ? x.map((v, i) => m(v, y[i], k)) : lerp(x, y, k);
  return { left: A.left, P: m(A.P, B.P, t), yaw: lerp(A.yaw, B.yaw, t), pitch: lerp(A.pitch, B.pitch, t), roll: lerp(A.roll, B.roll, t), f: m(A.f, B.f, tf), th: m(A.th, B.th, tf), thRoll: lerp(A.thRoll || 0, B.thRoll || 0, tf), arm: m(A.arm || [0, .14], B.arm || [0, .14], t), tendon: lerp(A.tendon || 0, B.tendon || 0, t), press: lerp(A.press || 0, B.press || 0, t) };
}
const moved = (p, d) => ({ ...p, P: p.P.map((v, i) => v + (d[i] || 0)) });
const minD = (p, n, sdf) => { let m = 1e9; for (const q of HS.points(p, HS.region(p, n))) m = Math.min(m, sdf(...q)); return m; };
const centre = (p, n) => { const pts = HS.points(p, HS.region(p, n)); return pts.reduce((a, b) => a.map((v, i) => v + b[i] / pts.length), [0, 0, 0]); };
// The k vertices of a region nearest a surface (the skin that touches it) and their world points.
function touching(p, n, sdf, k = 4) {
  const idx = HS.region(p, n), pts = HS.points(p, idx);
  const o = idx.map((i, j) => [sdf(...pts[j]), i, pts[j]]).sort((a, b) => a[0] - b[0]).slice(0, k);
  return { idx: o.map(x => x[1]), pts: o.map(x => x[2]) };
}
// Pushes a pose along dir until hand and forearm clear sdf by gap (for frames in the air).
function lift(p, sdf, dir, gap = .6) {
  const clear = q => Math.min(minD(q, 'hand', sdf), minD(q, 'arm', sdf));
  if (clear(p) >= gap) return p;
  let lo = 0, hi = 60;
  for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (clear(moved(p, dir.map(v => v * mid))) >= gap) hi = mid; else lo = mid; }
  return moved(p, dir.map(v => v * hi));
}

// ---------------------------------------------------------------- solving
const FING = [0, 1, 2, 3].flatMap(k => [`f.${k}.0`, `f.${k}.1`, `f.${k}.2`]);
const ALL = ['P.0', 'P.1', 'P.2', 'yaw', 'pitch', 'roll', ...FING, 'th.0', 'th.1', 'th.2', 'th.3', 'thRoll', 'arm.0', 'arm.1'];
// Joint limits (research: MCP flexion <= 85-90, active hyperextension <= 20; PIP 0..100; DIP <= 70,
// hyperextension <= 10; thumb MP <= 50, IP <= 80 / -15). Thumb base (abduction/flexion of the code
// thumb) and its turn are kept to a natural range.
const BOUNDS = { 'arm.0': [-35, 35], 'th.0': [-30, 60], 'th.1': [-50, 45], 'th.2': [0, 50], 'th.3': [-15, 75], thRoll: [-60, 60], 'arm.1': [-.6, .9], pitch: [-75, 70] };
for (let k = 0; k < 4; k++) { BOUNDS[`f.${k}.3`] = [-14, 14]; BOUNDS[`f.${k}.0`] = [-18, 85]; BOUNDS[`f.${k}.1`] = [0, 100]; BOUNDS[`f.${k}.2`] = [-8, 70]; }
// Wrist angles against the forearm (deg): + extension, + radial deviation.
function wrist(pose) {
  const F = H.frame(pose), s = H.sleeveLine(pose), a = [0, 1, 2].map(i => s.start[i] - s.end[i]), l = Math.hypot(...a), f = a.map(v => v / l);
  const d = V => f[0] * V[0] + f[1] * V[1] + f[2] * V[2], fu = d(F.U);
  return { ext: Math.atan2(-d(F.W), fu) * 180 / Math.PI, rad: Math.atan2(-d(F.V), fu) * 180 / Math.PI };
}
const wristOk = { fn: q => { const w = wrist(q); return [Math.max(0, Math.abs(w.ext) - 65), Math.max(0, w.rad - 17, -w.rad - 32)]; } };
const keepOut = (deg, w = 6) => [{ off: ['hand', solidAt(deg), .05, w, 1800] }, { off: ['arm', solidAt(deg), .05, w, 400] }, wristOk];
const fit = (p, terms, params = ALL, iters = 80) => HS.solve(p, params, terms, { bounds: BOUNDS, iters }).pose;
// Contact terms: [region, surface name, gap] -> gap residuals.
const gaps = (list, deg, w = 8) => list.map(([n, s, g = .3]) => ({ gap: [n, surface(s, deg), g, w] }));
// DIP follows PIP (0.7, little 0.6) on a free finger.
const coupled = ks => ks.map(k => ({ fn: q => [(q.f[k][2] - (k === 3 ? .6 : .7) * q.f[k][1]) * .5] }));
// Held contacts of a previous solved pose, optionally carried with the lid (deg0 -> deg1).
const pins = (prev, list, deg0, deg1 = deg0, w = 6) => pinsW(prev, list, deg0, deg1, w);
function pinsW(prev, list, deg0, deg1 = deg0, w = 6) {
  return list.map(([n, s]) => {
    const t = touching(prev, n, surface(s, deg0), 4);
    return { pin: [t.idx, s === 'lid' ? t.pts.map(q => withLid(q, deg0, deg1)) : t.pts, w] };
  });
}

// Closed fingers (user 18/11/2026: the hands read fanned, "high five"): neighbouring finger ends within
// g px skin to skin (handChecks 8c).
const closedT = (w = 3, g = 3.5, js = [0, 1, 2]) => ({ fn: q => { const G = RIG.fingerGaps(q); return js.map(j => Math.max(0, G[j] - g) * w); } });
// Curled: a finger seen from above (MCP -> tip) at most r of its length (handChecks 8c: 75% on the table).
const seenRatio = (J, j) => Math.hypot(J[j][3][0] - J[j][0][0], J[j][3][1] - J[j][0][1]) / [0, 1, 2].reduce((a, q) => a + Math.hypot(...J[j][q + 1].map((v, i) => v - J[j][q][i])), 0);
const curlT = (ks, w = 40, r = .7) => ({ fn: q => { const J = RIG.posed(q, []).joints.fingers; return ks.map(j => Math.max(0, seenRatio(J, j) - r) * w); } });
// The thumb tip along the side of the index (within d px of its proximal or middle bone), and seen beside
// it, not under it (>= s px apart on screen: row = y - z/2).
function thumbBy(d = 13, s = 12, w = 1) {
  const seg = (t, a, b, P) => { const A = P(a), B = P(b), T = P(t), ab = B.map((v, i) => v - A[i]), k = Math.max(0, Math.min(1, ab.reduce((u, v, i) => u + v * (T[i] - A[i]), 0) / ab.reduce((u, v) => u + v * v, 0))); return Math.hypot(...T.map((v, i) => v - A[i] - ab[i] * k)); };
  const id = p => p, scr = p => [p[0], p[1] - p[2] / 2];
  return { fn: q => {
    const J = RIG.posed(q, []).joints.fingers[0], t = centre(q, 'thTip');
    return [Math.max(0, Math.min(seg(t, J[0], J[1], id), seg(t, J[1], J[2], id)) - d) * w, Math.max(0, s - seg(t, J[0], J[2], scr)) * w];
  } };
}
// Fan: adjacent proximal phalanges at most lim deg apart in the palm plane (handChecks 8b).
const fanT = (lim = 9, w = 1) => ({ fn: q => {
  const J = RIG.posed(q, []).joints.fingers, W = H.frame(q).W;
  const dir = j => { const d = [0, 1, 2].map(i => J[j][1][i] - J[j][0][i]), n = d[0] * W[0] + d[1] * W[1] + d[2] * W[2], p = d.map((v, i) => v - n * W[i]), l = Math.hypot(...p); return p.map(v => v / l); };
  return [0, 1, 2].map(j => { const a = dir(j), b = dir(j + 1); return Math.max(0, Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180 / Math.PI - lim) * w; });
} });
// Fingers in the air lie side by side: this splay cancels the mesh's fan (index +4, ring -4, little -9).
const SPLAY_IN = [-4, 0, 4, 9];

// ---------------------------------------------------------------- key poses
// Resting on the table right of the tin (research: a relaxed hand lies in a cascade, fingers closed,
// pads, the heel pads and the thumb's side on the table, the hollow of the palm off it; the thumb lies
// along the index). The mesh's knuckles sit low, so the MCPs stay small and the cascade is in the
// PIP/DIP; the fingers converge (splay) instead of fanning.
// Research (relaxed hand on a table, MCP/PIP/DIP): index 25/30/12, middle 30/35/15, ring 35/40/18,
// little 40/45/20; the knuckles arch, the fingers curl down and close, the ring and little shortest seen
// from above.
// Curled, the fingertip's end (not the flat of the pad) is what meets the table.
const RELAX = [[25, 40, 28, -4], [30, 45, 31, 0], [36, 50, 35, 4], [34, 45, 27, 9]];
const REST_C = [['tip1', 'table'], ['tip2', 'table'], ['tip3', 'table'], ['tip4', 'table'], ['heel', 'table'], ['thumb', 'table']];
// Finger k curled down onto a surface: over MCP/PIP (DIP coupled), the tip 0..1 px off it, nothing of the
// finger inside anything, seen from above as near `seen` of its length as possible (a grid: the
// nearest-vertex landscape is too ragged for gradient steps). Returns the pose (unchanged if none fits).
// nb: already placed neighbour(s) (finger index or list) the finger should lie against (gap <= 4 px).
function curlOnto(p, k, sdf, seen, nb = null, solid = solidAt(0), sps = [p.f[k][3]]) {
  let best = null;
  for (const sp of sps) for (let m = -5; m <= 70; m += 2.5) for (let pp = 15; pp <= 95; pp += 2.5) {
    const q = { ...p, f: p.f.map(a => a.slice()) }; q.f[k] = [m, pp, Math.min(70, pp * DIPK[k]), sp];
    const tip = minD(q, 'tip' + (k + 1), sdf);
    if (tip < 0 || tip > 1 || minD(q, 'dig' + (k + 1), solid) < -.2) continue;
    const G = nb === null ? null : RIG.fingerGaps(q), g = nb === null ? 0 : [].concat(nb).reduce((a, n) => a + Math.max(0, G[Math.min(k, n)] - 4), 0);
    const e = Math.abs(seenRatio(RIG.posed(q, []).joints.fingers, k) - seen) + Math.abs(tip - .3) * .02 + g * .1 + Math.max(0, m - pp) * .005;      // relaxed: PIP bends at least as much as MCP
    if (!best || e < best.e) best = { e, q };
  }
  return best ? best.q : p;
}
function solveRest() {
  // 1: the heel of the hand (base of the thenar and hypothenar) down, the palm tilted up 12 deg to the
  //    knuckles (they arch ~30 px over the table), the forearm free to lift off behind the wrist
  let p = { P: [432, 266, 45], yaw: -100, pitch: -12, roll: 6, f: RELAX.map(a => a.slice()), th: [-25, -5, 10, 15], thRoll: 0, tendon: .15, press: 0, arm: [0, .2] };
  const heel = [{ gap: ['heel', table, .3, 6] }, { gap: ['hypo', table, .3, 2] }, { off: ['palm', table, .05, 12, 800] }, { off: ['arm', table, .05, 12, 400] }, { off: ['centre', table, 4, 2] }];
  p = HS.descend(p, ['P.2', 'roll', 'arm.1'], [...heel, wristOk], { bounds: { ...BOUNDS, 'arm.1': [0, .35] } });
  // 2: each finger curls down to the table, curled to ~60-65% of their length seen from above, each against its neighbour
  for (const [k, s, nb] of [[3, .68, null], [2, .5, 3], [1, .52, 2], [0, .6, 1]]) p = curlOnto(p, k, table, s, nb, solidAt(0), [-4, 0, 4, 8, 12, 14].map(v => v + [-4, 0, -4, 0][k]));
  // 3: the fingers close up (splay), the thumb lies on its side along the index, seen beside it
  p = HS.descend(p, [0, 1, 2, 3].flatMap(k => [`f.${k}.3`, `f.${k}.0`, `f.${k}.1`, `f.${k}.2`]), [closedT(6, 3.5), fanT(8, 2), ...coupled([0, 1, 2, 3]), ...[0, 1, 2, 3].flatMap(k => [{ gap: ['tip' + (k + 1), table, .3, 15] }, { off: ['dig' + (k + 1), table, .05, 12, 300] }])], { bounds: BOUNDS, steps: [2, 1, .5, .25] });
  return HS.descend(p, ['th.0', 'th.1', 'th.2', 'th.3', 'thRoll'], [{ gap: ['thumb', table, .3, 12] }, { off: ['thumb', table, .05, 12, 300] }, thumbBy(13, 11, 4), { prior: ['thRoll', 0, .05] }], { bounds: BOUNDS });
}

// Holding the tin at an end wall (user 18/11/2026: the old holds were flat, fanned, fingers straight):
// the hand rests as at rest, palm down on the heel, fingers curled onto the table and closed, but snug
// against the end wall: the thumb's pad pressed on it (the counter
// to the other hand). The two hands differ: the left comes in angled from the back-left and curls more,
// the right lies straighter along its wall, further to the front.
//   left: true for the left hand; x: wrist x to start from (outside the wall); yaw: finger direction;
//   seen: per finger, the curl seen from above (curlOnto), placed from the little to the index.
function solveHold(left, x, y, yaw, seen) {
  const C = holdC;
  let p = { left, P: [x, y, 45], yaw, pitch: -12, roll: 8, f: RELAX.map(a => a.slice()), th: [-5, -25, 15, 15], thRoll: 0, tendon: .9, press: .25, arm: [0, .2] };
  const S = solidAt(0);
  p = HS.descend(p, ['P.2', 'roll', 'arm.1'], [{ gap: ['heel', table, .3, 6] }, { gap: ['hypo', table, .3, 2] }, { off: ['palm', S, .05, 12, 800] }, { off: ['arm', S, .05, 12, 400] }, { off: ['centre', table, 4, 2] }, wristOk], { bounds: { ...BOUNDS, roll: [0, 16], 'arm.1': [0, .35] } });
  // in against the wall until the thumb's pad meets it (the fingers still loose, curled up out of the way)
  p.f = p.f.map((r, k) => [r[0], Math.max(r[1], 60), Math.max(r[1], 60) * DIPK[k], r[3]]);
  p.th = [-28, -5, 11, 27];                                                    // tucked along the index, as at rest
  p = HS.descend(p, ['P.0'], [{ gap: ['thumb', bodySolid, .3, 6] }, { off: ['hand', S, .05, 12, 800] }], { bounds: BOUNDS, steps: [8, 4, 2, 1, .5, .25] });
  for (const [k, nb] of [[3, null], [2, 3], [1, 2], [0, 1]]) p = curlOnto(p, k, table, seen[k], nb, S, [-4, 0, 4, 8, 12, 14].map(v => v + [-4, 0, -4, 0][k]));
  p = HS.descend(p, [0, 1, 2, 3].flatMap(k => [`f.${k}.3`, `f.${k}.0`, `f.${k}.1`, `f.${k}.2`]), [closedT(6, 3.5), fanT(8, 2), ...coupled([0, 1, 2, 3]), ...[0, 1, 2, 3].flatMap(k => [{ gap: ['tip' + (k + 1), table, .3, 15] }, { off: ['dig' + (k + 1), S, .05, 12, 300] }])], { bounds: BOUNDS, steps: [2, 1, .5, .25] });
  // the thumb's pad on the wall, low (under the lid's skirt)
  return HS.descend(p, ['th.0', 'th.1', 'th.2', 'th.3', 'thRoll'], [{ gap: ['thPad', bodySolid, .3, 6] }, { off: ['thumb', S, .05, 12, 300] }, thumbBy(14, 0, 1), { fn: q => [Math.max(0, Math.max(...HS.points(q, HS.region(q, 'thPad')).map(v => v[2])) - 40) * 2] }], { bounds: BOUNDS });
}
const holdC = [['thPad', 'body'], ['tip1', 'table'], ['tip2', 'table'], ['tip3', 'table'], ['tip4', 'table'], ['heel', 'table']];
const L_C = holdC, R_C = holdC;
const solveLeft = () => solveHold(true, 60, 196, -70, [.6, .55, .52, .66]);
const solveRight = () => solveHold(false, 425, 252, -100, [.66, .62, .58, .7]);

// Right hand on the lid (P1.05 5): fingertips 2-4 tucked under the rolled lip (crimped: PIP bent hard,
// DIP pressed straight, as fingertips pushing on an edge), thumb pad on the body's front face left of
// the index (the counter-push: the thumb pushes the tin down and away while the tips pull the lip up).
// The hand comes in angled (fingers up-right) so the thumb, shorter than the fingers, reaches the face.
// Measured on the mesh: with the tips and the thumb on, the little finger stays >= 16 px off the
// table over every hand angle, and the heel of the hand cannot also rest on it within the wrist's
// range (extension <= 70); so the little finger curls in beside the ring finger and the heel hangs a
// few px over the table (below the frame).
const PRY_C = [['tip1', 'lid'], ['tip2', 'lid'], ['tip3', 'lid'], ['thTip', 'body']];
const LITTLE_IN = [55, 70, 42, 6];
function solvePry() {
  const CURL = [[25, 55, 38, 0], [22, 58, 40, 0], [22, 58, 40, 0], LITTLE_IN];
  let p = { P: [0, 0, 0], yaw: -72.5, pitch: -40, roll: -10, f: CURL.map(a => a.slice()), th: [10, 0, 5, 5], thRoll: 0, tendon: .8, press: .3, arm: [0, .14] };
  const c = centre(p, 'tip2');
  p.P = [290 - c[0], 224.4 - c[1], 39 - c[2]];
  p = fit(p, [{ gap: ['thPad', bodySolid, .3, 3] }, { fn: q => [(centre(q, 'thPad')[2] - 34) * .2] }, { off: ['thumb', solidAt(0), 0, 3, 200] }], ['th.0', 'th.1', 'th.2', 'th.3', 'thRoll'], 30);
  const terms = w => [...gaps(PRY_C, 0, w), ...keepOut(0, Math.max(6, w)), ...coupled([3]), { gap: ['hypo', table, 2, .3] },
    { fn: q => [(centre(q, 'tip2')[0] - 290) * .1] }, { prior: ['f.3.0', LITTLE_IN[0], .2] }];
  p = fit(p, terms(4), ALL, 150);
  return fit(p, terms(12), ALL, 200);
}

// ---------------------------------------------------------------- P1.04: both hands take the tin
const REACH = [0, .14, .40, .65, .83, .95, 1];           // travel at frames c-6 .. c
const TURN = [0, .35, .75, .95, 1, 1, 1];                // the palm turns in the first half
const APERTURE = [.2, .4, .65, .85, 1, .7];              // hand opening, widest at ~2/3 of the reach
// Carried hand (research: always slightly flexed, MCP 10-25, PIP 20-40, fingers together).
const RELAXED_R = [[14, 28, 20, -4], [16, 32, 22, 0], [18, 36, 25, 4], [20, 40, 24, 9]];
// The reach's opening is the thumb's (aperture = thumb to fingers): the four fingers ease a little and
// stay together, still bent (user 18/11/2026: straight fingers read as a "high five"; MCP 12-22,
// PIP 30-40), the thumb swings out to face them, bent at both joints (not a straight stick).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function openOf(G) {
  return { f: G.f.map(([m, p], k) => [clamp(m, 12, 22), clamp(p * .55, 30, 40), clamp(p * .55, 30, 40) * DIPK[k], G.f[k][3]]), th: [G.th[0] + 16, G.th[1] - 4, Math.max(12, G.th[2]), Math.max(18, G.th[3])] };
}
// Fingers in the air close up side by side (splay only): no fan, tips within ~3.5 px skin to skin.
// From the parallel splay; the fan limit wins over the gap (the curled little finger sits a few px lower).
const closeUp = p => HS.descend({ ...p, f: p.f.map((a, k) => [a[0], a[1], a[2], SPLAY_IN[k]]) }, [0, 1, 2, 3].map(k => `f.${k}.3`), [closedT(2, 3.5), fanT(7, 10)], { bounds: BOUNDS, steps: [2, 1, .5] });
// A finger in the air: never straight (PIP >= 18), its DIP follows its PIP (research: DIP = 0.7 PIP,
// little 0.6); the splay is the closed one it comes from (SPLAY_IN, or a solved hold's).
const DIPK = [.7, .7, .7, .6];
const inAir = (f, which = [0, 1, 2, 3]) => f.map((a, k) => which.includes(k) ? [Math.max(-10, a[0]), Math.max(18, a[1]), Math.max(18, a[1]) * DIPK[k], a[3]] : a.slice());
// Hand reaching from far to G, contact frame c; side: +1 right hand (comes in from +x), -1 left.
function take(G, far, k, side) {
  if (k >= 2) return { ...G, contacts: G.contacts };
  const O = openOf(G);
  if (k === 1) return { ...G, tendon: G.tendon + .45, press: .6, contacts: G.contacts };          // the others close on, the squeeze
  if (k === 0) {                                                                                  // thumb and index on, the others a breath off
    const f = G.f.map((a, j) => j === 0 ? a.slice() : [a[0] - 7, a[1] - 4, (a[1] - 4) * DIPK[j], a[3]]);   // the knuckles lift the tips a breath off
    const g = HS.descend({ ...G, f }, ['f.1.3', 'f.2.3', 'f.3.3'], [fanT(9, 10)], { bounds: BOUNDS, steps: [1, .5] });   // lifted, they fan a touch: close them up
    return { ...g, tendon: .6, press: 0, contacts: G.contacts.filter(([n]) => /^(thenar|thPad|pad1)$/.test(n)) };
  }
  const i = Math.max(0, k + 6), s = REACH[i], r = TURN[i], a = k < -6 ? 0 : APERTURE[i];
  const shape = { f: inAir(G.f.map((row, j) => row.map((v, q) => lerp(v, O.f[j][q], a)))), th: G.th.map((v, q) => lerp(v, O.th[q], a)) };
  let p = mix(far, G, s);
  p.yaw = lerp(far.yaw, G.yaw, r); p.pitch = lerp(far.pitch, G.pitch, r); p.roll = lerp(far.roll, G.roll, r);
  p.f = far.f.map((row, j) => row.map((v, q) => lerp(v, shape.f[j][q], r)));
  p.th = far.th.map((v, q) => lerp(v, shape.th[q], r));
  p.P[0] += side * 60 * (1 - s);                           // the last bit comes straight in toward the wall
  p.P[2] += 12 * Math.sin(Math.PI * s) * (1 - s);
  p.tendon = .3; p.press = 0;
  return { ...lift(closeUp(p), solidAt(0), [side, 0, .4], .6), contacts: [] };
}

// ---------------------------------------------------------------- P1.05 timing
const LID = [0, 0, 0, 0, 0, 0, .6, .6, 1.5, 3.5, 26, 50, 74, 94, 108, 113, 106, 109.5, 108, 108, 108, 108, 108, 108, 108, 108, 108, 108, 108, 108];

function build() {
  const REST = { ...solveRest(), contacts: REST_C.map(c => [...c, true]) };
  const L = { ...solveLeft(), contacts: L_C.map(c => [...c, true]) };
  const R = { ...solveRight(), contacts: R_C.map(c => [...c, true]) };
  const PRY = solvePry();

  // ---- P1.04
  const lFar = { left: true, P: [-30, 330, 30], yaw: -50, pitch: -4, roll: 24, f: RELAXED_R.map(a => a.slice()), th: [-15, -5, 15, 20], thRoll: 0, tendon: .3, press: 0, arm: [0, .14] };
  const rFar = { P: [480, 380, 46], yaw: -120, pitch: -4, roll: 24, f: RELAXED_R.map(a => a.slice()), th: [-15, -5, 15, 20], thRoll: 0, tendon: .3, press: 0, arm: [0, .14] };
  const hand = [];
  for (let i = 0; i < 20; i++) hand.push({ deg: 0, hands: [take(L, lFar, i - 9, -1), take(R, rFar, i - 6, 1)] });

  // ---- P1.05 right hand
  const r = [];
  r[0] = r[1] = hand[19].hands[1];
  // effort: lever about the heel, all contacts held, tips carried by the lid; the forearm sinks (the wrist extends)
  // the tips slide up the front face as the lip rises: touching it, not held on it
  const pryC = PRY_C.map(([n, s]) => [n, s, !(n.startsWith('tip') && s === 'body')]);
  const PRY5 = { ...PRY, tendon: .9, press: .35, contacts: pryC };
  const effort = (prev, deg, tendon, press, sink) => {
    const pins = (a, b, c, d) => pinsW(a, b, c, d, 12);
    const q = fit({ ...prev }, [
      ...pins(prev, pryC.filter(([, s, h]) => h && s !== 'lid'), 0),
      ...pins(prev, pryC.filter(([, s]) => s === 'lid'), prev.deg, deg),
      ...gaps(pryC.filter(([, , h]) => !h), deg),
      ...keepOut(deg, 6), { prior: ['arm.1', prev.arm[1] - sink, 1] }, { prior: ['arm.0', prev.arm[0], 1] }
    ], ALL, 80);
    return { ...q, tendon, press, deg, contacts: pryC };
  };
  r[5] = { ...PRY5, deg: 0 };
  r[6] = effort(r[5], .6, 1.2, .6, .03);
  r[7] = r[6];
  r[8] = effort(r[7], 1.5, 1.45, .8, .03);
  r[9] = effort(r[8], 3.5, 1.7, 1, .04);
  // approach 2-4: off the wall, round the front-right corner, hovering just off the lid edge
  const hover = { ...moved(PRY, [0, 6, 5]), f: inAir(PRY.f.map(([m, p, d, s]) => [m - 10, p - 16, d - 10, s + 1])), th: [PRY.th[0] + 10, PRY.th[1] - 8, PRY.th[2], PRY.th[3] * .6], tendon: .5, press: 0 };
  const off = { ...moved(R, [6, 3, 6]), f: inAir(openOf(R).f), th: [R.th[0] + 8, R.th[1], R.th[2], R.th[3] * .6], tendon: .5, press: 0 };
  r[2] = { ...lift(closeUp(off), solidAt(0), [1, .3, .4], .6), contacts: [] };
  {
    const q = mix(off, hover, .72);
    q.P[1] += 30; q.P[2] += 14;                                                           // out round the front-right corner, coming in from the front
    r[3] = { ...lift(closeUp(q), solidAt(0), [.3, .6, .7], .6), contacts: [] };
  }
  r[4] = { ...lift(closeUp(hover), solidAt(0), [0, .5, .8], .6), contacts: [] };
  // 10: thrown up after the lid, fingers a frame late, thumb off the face
  // 11: the tips catch the rim (underside of the lid's front edge) and push it over to the stop (15)
  const catchAt = deg => {
    const base = { ...r[9], f: [[14, 30, 21, SPLAY_IN[0]], [14, 30, 21, 0], [14, 30, 21, SPLAY_IN[2]], LITTLE_IN], th: [-10, 0, 10, 10], thRoll: 0, pitch: r[9].pitch - 5 };
    // start: the hand moved so the tips' centre sits under the rim
    const rim = T.lidWorld(centre(r[9], 'tip2')[0] - T.CX, T.HY + 1.5, T.LZ0 - 4, deg * Math.PI / 180);
    const c = centre(base, 'tip2');
    const q = moved(base, [rim[0] - c[0], rim[1] - c[1] + 3, rim[2] - c[2] - 2]);
    q.arm = [r[9].arm[0], .25];
    const terms = [
      ...[1, 2, 3].map(k => ({ gap: ['tip' + k, lidSolid(deg), .3, 10] })), ...keepOut(deg, 8), ...coupled([3]),
      { fn: p => [(centre(p, 'tip2')[0] - centre(r[9], 'tip2')[0]) * .1] }, { fn: p => [(p.arm[1] - ELBOW(p)) * 4] }, { prior: ['arm.0', -32, .5] }, closedT(2, 3.5), thumbBy(14, 0, 1)        // forearm in from the bottom-right (ulnar deviation, near its limit): the tin's inside shows
    ];
    const g = fit(q, terms, ALL, 200);
    // LM leaves the shorter ring finger short of the rim; finish by coordinate descent (hand + fingers 1-3)
    const X = ['P.0', 'P.1', 'P.2', 'yaw', 'pitch', 'roll', ...[0, 1, 2].flatMap(k => [0, 1, 2].map(j => `f.${k}.${j}`))];
    return HS.descend(g, X, [...terms, ...[0, 1, 2].map(k => ({ fn: p => [(p.f[k][2] - .7 * p.f[k][1]) * .3] }))], { bounds: BOUNDS });
  };
  const rideC = [['tip1', 'lid'], ['tip2', 'lid'], ['tip3', 'lid']];
  // a hand raised to follow the rim: the elbow stays low (shoulder height ~100 px), so the forearm slopes
  // down from the wrist instead of up toward the camera (sleeve rise per px of run)
  const ELBOW = p => (100 - p.P[2]) / 250;
  r[11] = { ...catchAt(LID[11]), tendon: 1.1, press: .5, deg: LID[11], contacts: rideC.map(c => [...c, true]) };
  for (let i = 12; i <= 15; i++) {
    const prev = r[i - 1], terms = [
      ...pins(prev, rideC, LID[i - 1], LID[i], 24), ...keepOut(LID[i], 6), ...coupled([3]), { fn: p => [(p.arm[1] - ELBOW(p)) * 4] }, closedT(2, 3.5), thumbBy(14, 0, 1),
      ...['f.0.0', 'f.1.0', 'f.2.0', 'f.0.1', 'f.1.1', 'f.2.1'].map(n => ({ prior: [n, HS.get(prev, n), .03] }))
    ];
    // LM, then coordinate descent for what it leaves (a tip sliding on the lid, a finger into it)
    const q = HS.descend(fit({ ...prev, arm: [prev.arm[0], Math.min(prev.arm[1], ELBOW(prev))] }, terms, ALL, 80), ['P.0', 'P.1', 'P.2', 'yaw', 'pitch', 'roll', ...FING.slice(0, 9)], terms, { bounds: BOUNDS });
    r[i] = { ...q, tendon: 1.1, press: .5, deg: LID[i], contacts: rideC.map(c => [...c, true]) };
  }
  {
    const q = mix(r[9], r[11], .45, .15);
    q.th = mix(r[9], r[11], .6).th; q.f = inAir(q.f); q.tendon = 1.2; q.press = .1;
    r[10] = { ...lift(closeUp(q), solidAt(LID[10]), [0, .4, 1], .8), contacts: [] };
  }
  // 16: let go: back off the rim (the lid swings back toward the hand), fingers open a little
  r[16] = { ...lift(closeUp({ ...moved(r[15], [4, 22, 6]), f: inAir(r[15].f.map(([m, p, d, s]) => [m - 4, p - 10, d - 7, s])), tendon: .6, press: 0 }), solidAt(LID[16]), [0, .6, .8], 1), contacts: [] };
  // 21-23: landing (research: middle and ring first, index and little and the heel next, thumb last), all held
  const r22 = fit({ ...REST, th: [REST.th[0] + 6, REST.th[1] - 10, REST.th[2], REST.th[3]] }, [
    ...pins(REST, REST_C.filter(([n]) => n !== 'thumb'), 0), { gap: ['thumb', table, 2.5, 3] }, ...keepOut(0)
  ], ['th.0', 'th.1', 'thRoll'], 40);
  const r21 = fit({ ...moved(REST, [0, 0, 2.5]), pitch: REST.pitch - 2 }, [
    ...pins(REST, [['tip2', 'table'], ['tip3', 'table']], 0),
    { gap: ['tip1', table, 2, 3] }, { gap: ['tip4', table, 2, 3] }, { gap: ['heel', table, 2.5, 3] }, { gap: ['thumb', table, 4, 3] },
    ...keepOut(0), ...coupled([0, 3]), ...['f.1.0', 'f.2.0'].map(n => ({ prior: [n, HS.get(REST, n), .05] }))
  ], ['P.0', 'P.1', 'P.2', 'pitch', 'roll', ...FING, 'th.0', 'th.1'], 80);
  r[21] = { ...r21, tendon: .25, press: 0, contacts: [['tip2', 'table', true], ['tip3', 'table', true]] };
  r[22] = { ...r22, tendon: .2, press: 0, contacts: REST_C.filter(([n]) => n !== 'thumb').map(c => [...c, true]) };
  r[23] = REST;
  // 17-20: down to the right, ease-out (the reach decelerates into the landing)
  const hoverRest = { ...lift(moved(r21, [0, 0, 6]), table, [0, 0, 1], .6), f: inAir(r21.f.map(([m, p, d, s]) => [m - 4, p - 6, d - 4, s])) };
  const TRAVEL = [.38, .66, .86, .96];
  for (let i = 17; i <= 20; i++) {
    const s = TRAVEL[i - 17], q = mix(r[16], hoverRest, s, Math.min(1, s * 1.2));
    q.f = inAir(q.f);
    q.P[2] += 26 * Math.sin(Math.PI * s) * (1 - s);
    q.tendon = lerp(.6, .25, s);
    r[i] = { ...lift(closeUp(q), solidAt(LID[i]), [0, 0, 1], .6), contacts: [] };
  }
  for (let i = 24; i < 30; i++) r[i] = REST;

  // ---- P1.05 left hand: still; clamps harder through the effort, catches the jolt, eases
  const LT = [[.9, .25], [.9, .25], [.9, .25], [.95, .3], [1.05, .35], [1.15, .45], [1.3, .6], [1.3, .6], [1.5, .8], [1.65, 1], [1.8, .9], [1.3, .5], [1.05, .35], [.9, .25]];
  const lid = [];
  for (let i = 0; i < 30; i++) {
    const [tendon, press] = LT[Math.min(i, LT.length - 1)];
    lid.push({ deg: LID[i], hands: [{ ...L, tendon, press, contacts: L.contacts }, { ...r[i], left: false }] });
  }
  lid[0] = { deg: 0, hands: hand[19].hands };
  lid[1] = lid[0];
  return { hand, lid };
}

// ---------------------------------------------------------------- cache (solving takes a few seconds)
let SCENES = null;
function scenes() {
  if (SCENES) return SCENES;
  const src = ['openingHands.cjs', 'hand.cjs', 'handRig.cjs', 'handSolve.cjs', 'tin.cjs', 'scene3d.cjs'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  const key = crypto.createHash('sha1').update(src).digest('hex').slice(0, 16);
  const file = path.join(os.tmpdir(), `wordwing-opening-hands-${key}.json`);
  if (fs.existsSync(file)) return (SCENES = JSON.parse(fs.readFileSync(file, 'utf8')));
  const strip = s => s.map(({ deg, hands }) => ({ deg, hands: hands.map(h => { const { deg: _d, ...rest } = h; return rest; }) }));
  const b = build();
  SCENES = { hand: strip(b.hand), lid: strip(b.lid) };
  fs.writeFileSync(file, JSON.stringify(SCENES));
  return SCENES;
}
const handScenes = () => scenes().hand;
const lidScenes = () => scenes().lid;

module.exports = { handScenes, lidScenes, solidAt, lidSolid, bodySolid, surface, withLid, LID, _k: { solvePry, solveRest, solveLeft, solveRight, fit, gaps, keepOut, centre, minD, PRY_C, REST_C, L_C, R_C, ALL, closedT, curlT, thumbBy, fanT, curlOnto, SPLAY_IN, BOUNDS } };

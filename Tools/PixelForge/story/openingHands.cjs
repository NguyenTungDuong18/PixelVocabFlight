'use strict';
// Opening, the two hands frame by frame (P1.04 cut_open_tin_hand, P1.05 cut_open_tin_lid, both @8).
// research: physiological tremor ~8 Hz grows with grip force (20-60% of max) and is smaller in the
// non-dominant hand; at 8 fps it aliases to an irregular 1 px shiver, so it is drawn as seeded jitter.
// A stuck lid gives nothing at first (a long effort hold, stick-slip creaks), then lets go at once:
// the lid springs, the pulling hand overshoots, the holding hand jolts as the counter-force vanishes.
// Fingers hold by contact: H.clear keeps every hand out of the table and the tin, H.wrap curls each
// finger until it meets the metal, H.aimThumb places the thumb pad without passing through.
const { hash } = require('./common.cjs');
const S3 = require('./scene3d.cjs');
const T = require('./tin.cjs');
const H = require('./hand.cjs');

// Collision for the hands: the body as a solid block, the lid at its angle, the table.
const bodySolid = (x, y, z) => S3.extrude(S3.rrect(x - T.CX, y - T.CY, T.HX, T.HY, 10), z, 0, T.BH);
const solidAt = deg => { const lid = T.lidObj(deg); return (x, y, z) => Math.min(bodySolid(x, y, z), lid.sdf(x, y, z), z); };
const CLOSED = solidAt(0);

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
function mix(A, B, t) {
  const m = (x, y) => Array.isArray(x) ? x.map((v, i) => m(v, y[i])) : lerp(x, y, t);
  return { left: A.left, P: m(A.P, B.P), yaw: m(A.yaw, B.yaw), pitch: m(A.pitch, B.pitch), roll: m(A.roll, B.roll), tilt: m(A.tilt || 0, B.tilt || 0), f: m(A.f, B.f), th: m(A.th, B.th), tendon: m(A.tendon || 0, B.tendon || 0), press: m(A.press || 0, B.press || 0) };
}
// Tremor: a fresh small offset every frame (amp px), seeded so the forge is repeatable.
const shiver = (i, amp, seed) => [(hash(i, 1, seed) - .5) * 2 * amp, (hash(i, 2, seed) - .5) * amp, (hash(i, 3, seed) - .5) * 2 * amp];
const quiver = (f, i, deg, seed) => f.map((d, k) => [d[0] + (hash(i, k, seed + 7) - .5) * deg, d[1] + (hash(i, k, seed + 8) - .5) * deg * 1.5, d[2], d[3]]);
// Rigidly turns a hand about the lid hinge (the hinge runs along x, so the hand frame tilts about x).
function onLid(pose, deg) {
  const th = deg * Math.PI / 180, Y = pose.P[1] - T.HINGE_Y, Z = pose.P[2] - T.HINGE_Z;
  return { ...pose, P: [pose.P[0], Y * Math.cos(th) - Z * Math.sin(th) + T.HINGE_Y, Y * Math.sin(th) + Z * Math.cos(th) + T.HINGE_Z], tilt: (pose.tilt || 0) + deg };
}

// ---------------------------------------------------------------- key poses
const OPEN = [[0, 8, 4, 0], [0, 8, 4, 0], [0, 8, 4, 0], [0, 8, 4, 0]];
const SHUT = [[85, 100, 60, 0], [85, 100, 60, 0], [85, 100, 60, 0], [85, 100, 60, 0]];
const RELAX = [[8, 26, 12, 2], [10, 30, 14, 1], [12, 34, 16, 0], [14, 40, 18, -2]];            // resting cascade, index least
// Side grip: palm flat on the side wall near the front, fingers along it toward the back, the hand
// leaning out so its back faces up; thumb either on the lid's front corner (just holding the tin)
// or low on the body's front face (bracing it while the other hand pulls the lid).
// Roll 52: the back of the hand turns up toward the camera (at 75 it was seen edge-on, a flat sliver).
function side(left, thumbAt, mi, tendon, { y = 242, z = 44, yaw = -90, roll = 52 } = {}) {
  const s = left ? -1 : 1;
  let p = { left, P: [T.CX + s * 88, y, z], yaw, pitch: 0, roll, f: OPEN, th: [0, 0, 0, 0], tendon };
  p = H.clear(p, CLOSED, .5);
  p = H.wrap(p, CLOSED, OPEN, SHUT, .3);
  return H.aimThumb(p, CLOSED, [T.CX + s * thumbAt[0], thumbAt[1], thumbAt[2]], mi);
}
// The two hands do not mirror each other: the right takes the tin high (thumb on the lid's front
// corner); the left holds the body from the side (user, 15/11/2026): palm along the left wall 2.5 px
// off it, fingers pointing back and curling round the back-left corner so every pad sits on the
// metal (index and middle on the back wall, ring and little at the corner), thumb along the index.
// The palm stays left of the lid skirt (x < 157.5) and the curled tips stay below it (z < 45), so
// the lid never passes through the hand; checked against the body, the table and the lid at 0-113 deg.
const R_TOP = side(false, [66, 220, 62], [22, 14], .5);
const L_SIDE = { left: true, P: [135.5, 222.1, 46.9], yaw: -90, pitch: 10, roll: 74, f: [[0, 43, 29, 0], [0, 54, 37, 0], [4, 40, 27, 4], [10, -10, -7, 10]], th: [-50, -16, 4, 2], tendon: .8 };
// Right hand pinching the lid's front edge: fingers laid along the edge on top, thumb hooked under
// the rolled lip in front (thumb up, fingers down: the pinch that lifts it).
function pinch(f, tendon) {
  let p = { P: [348, 230, 74], yaw: -155, pitch: 8, roll: 12, f, th: [0, 30, 20, 10], tendon };
  p = H.clear(p, CLOSED, .3);
  p = H.seat(p, () => T.LIDTOP, [0, 0, 1, 2, null]);
  p = H.clear(p, CLOSED, .3);
  return H.aimThumb(p, CLOSED, [298, 229, 37], [24, 20]);
}
const PINCH = pinch([[0, 30, 14, 0], [0, 34, 16, 0], [0, 38, 18, -1], [0, 44, 20, -2]], .9);
const SQUEEZE = pinch([[0, 48, 26, 0], [0, 52, 28, 0], [0, 56, 30, -1], [0, 62, 32, -2]], 1.5);   // pads dig in, knuckles up
// Where the right hand ends: resting on the table off the front right corner, fingers relaxed.
const HOME = H.seat(H.clear({ P: [404, 262, 22], yaw: -116, pitch: -4, roll: 10, f: RELAX, th: [-6, 10, 14, 14], tendon: .15 }, CLOSED, .5), () => 0, [0, 0, 0, 1, 0]);
// Off screen below the frame, arriving: forearm low, hand a little open and turned.
const farFrom = (P, left) => ({ left, P, yaw: left ? -62 : -118, pitch: -4, roll: 30, f: RELAX.map(([a, b, c, d]) => [a - 8, b - 10, c - 4, d]), th: [20, 0, 6, 6], tendon: .3 });

// ---------------------------------------------------------------- P1.04: both hands take the tin
// 20 frames. The right hand comes first, up and over in an arc, and meets the wall at frame 10;
// the left follows three frames behind, low and flat, sliding in along the table to frame 13.
// Each slows, opens a touch just before contact, closes round and squeezes, then holds.
const ENTER = [0, .05, .14, .27, .42, .57, .70, .81, .89, .95, .985, 1];
function arrive(target, far, k, hump) {
  // Approach along a curve: lateral first, the last bit straight in toward the wall.
  const s = ENTER[Math.min(ENTER.length - 1, Math.max(0, k))];
  // The left hand slides in with its fingers straight along the wall (curled, the tips cut through
  // the back corner on the way); they curl round the corner as the grip closes (frames 11-14).
  const open = target.left ? target.f.map(([a, , , d]) => [a, 0, 0, d]) : RELAX.map(([a, b, c, d]) => [a - 6, b - 8, c - 2, d]);
  const p = mix(far, { ...target, f: open, th: target.left ? target.th : [target.th[0] + 10, 0, 6, 6] }, s);
  p.P[0] += (target.left ? -1 : 1) * 10 * (1 - s) * (1 - s);
  p.P[2] += hump * Math.sin(Math.PI * s * .9) * (1 - s);
  return H.clear(p, CLOSED, .4);
}
function handScenes() {
  const out = [];
  const lFar = { ...farFrom([-20, 320, 24], true), yaw: -40, roll: 20 }, rFar = farFrom([440, 360, 40], false);
  for (let i = 0; i < 20; i++) {
    const pose = (target, far, k, hump) => {
      if (k <= 11) return arrive(target, far, k, hump);
      const c = ease(Math.min(1, (k - 11) / 3));                                                // fingers close round the tin
      const settled = { ...arrive(target, far, 11, hump) };
      const p = mix(settled, target, c);
      p.tendon = lerp(.3, target.tendon + (k >= 13 && k <= 15 ? .3 : 0), c);                 // the squeeze, then easing to a hold
      if (k > 15) p.P = p.P.map((v, j) => v + (j === 2 ? Math.sin((k - 15) * .9) * .3 : 0));  // breathing
      return p;
    };
    out.push({ deg: 0, hands: [pose(L_SIDE, lFar, i - 3, 2), pose(R_TOP, rFar, i, 18)] });
  }
  return out;
}

// ---------------------------------------------------------------- P1.05: the lid
// 30 frames. 0-2 hold; 2-7 the left hand braces the body harder while the right hand leaves
// its side, lifts and takes the lid's front edge; 8-19 the struggle (nothing gives, stick-slip,
// shivering, tendons up, the pinch tightening); 20 it lets go; 21-25 the lid swings past and back;
// 22-29 the right hand drops back to the table, the left hand slowly lets its grip go soft.
const LID = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .15, .1, .35, .25, .6, .45, .9, .7, 1.3, 1.1, 18, 46, 78, 100, 113, 101, 107, 104.5, 105, 105];
function lidScenes() {
  const out = [];
  const rLift = { ...mix(R_TOP, PINCH, .5), P: [lerp(R_TOP.P[0], PINCH.P[0], .5) + 6, lerp(R_TOP.P[1], PINCH.P[1], .5) + 8, Math.max(R_TOP.P[2], PINCH.P[2]) + 14], f: RELAX, th: [10, 10, 10, 10], tendon: .4 };
  for (let i = 0; i < 30; i++) {
    const deg = LID[i];
    // Left hand: already low on the body; it braces harder as the right hand reaches for the lid.
    let l = { ...L_SIDE };
    if (i >= 2 && i <= 7) l.tendon = lerp(L_SIDE.tendon, 1, ease((i - 2) / 5));
    if (i >= 8 && i <= 19) { const k = (i - 8) / 11; l = { ...l, f: quiver(l.f, i, 2 + 2 * k, 33), tendon: lerp(1, 1.4, k), press: .6 + .4 * k, shake: shiver(i, .5 + .5 * k, 31) }; }
    else if (i === 20) l = { ...l, tendon: 1.1, press: .6, shake: [-.8, .6, 1.2] };                // the jolt as the pull lets go
    else if (i > 20) l = { ...l, tendon: lerp(1, .55, Math.min(1, (i - 20) / 5)), press: Math.max(0, .5 - (i - 20) * .1) };
    // Right hand.
    let r;
    if (i <= 1) r = R_TOP;
    else if (i <= 4) r = mix(R_TOP, rLift, ease((i - 1) / 3));
    else if (i <= 7) r = mix(rLift, PINCH, ease((i - 4) / 3));
    else if (i <= 19) {
      // The struggle: the pinch tightens over two frames, then holds under load with stick-slip.
      const k = (i - 8) / 11, g = mix(PINCH, SQUEEZE, Math.min(1, (i - 7) / 2));
      r = onLid({ ...g, f: quiver(g.f, i, 4 + 4 * k, 41), tendon: 1.3 + .4 * k, press: .5 + .5 * k, shake: shiver(i, .9 + .9 * k, 43) }, deg);
      // Heaves: the wrist comes up and back a little more each try, sags as the grip resets.
      const heave = [0, 1, 2, 1, 2.5, 1.5, 3, 2, 3.5, 2.5, 4, 3][i - 8];
      r.P[2] += heave; r.P[0] += heave * .4; r.pitch -= heave * .8;
    } else if (i <= 21) {
      r = onLid({ ...SQUEEZE, tendon: 1.2, press: .3 }, deg * (i === 20 ? 1 : .62));          // the lid jumps, the hand follows, then is outrun
      r.P[2] += i === 20 ? 6 : 12;
      if (i === 21) r.f = SQUEEZE.f.map(([a, b, c, d], k) => [a - 10, lerp(b, RELAX[k][1], .5), lerp(c, RELAX[k][2], .5), d]);
    } else {
      // Let go and rise clear of the swinging lid, move out to the right of the tin (never over the
      // open tin), then down onto the table and relax.
      // The released hand is already swinging out: fingers turn away from the open tin and the wrist
      // moves right at once (fast out, slow in), so it never hangs over the opening.
      const up = onLid({ ...SQUEEZE, f: RELAX, th: [10, 10, 10, 10], tendon: .6 }, 30);
      up.P[2] += 18; up.P[0] += 46; up.yaw += 42;
      const side = { ...HOME, P: [HOME.P[0] + 2, HOME.P[1] - 22, HOME.P[2] + 34], yaw: HOME.yaw - 8, pitch: HOME.pitch - 8, tilt: 6, tendon: .4 };
      const out = t => 1 - (1 - t) * (1 - t);
      r = i <= 25 ? mix(up, side, out((i - 21) / 4)) : mix(side, HOME, ease((i - 25) / 4));
      if (i <= 25) r.tilt = lerp(30, 6, out((i - 21) / 4));
    }
    out.push({ deg, hands: [l, r] });
  }
  return out;
}

module.exports = { handScenes, lidScenes, solidAt, onLid };

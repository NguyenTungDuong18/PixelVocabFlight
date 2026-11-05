'use strict';
// Characters: idle/walk/run/talk cycles, fx_dust, shadow and quest marker.
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, withAlpha } = require('../lib.cjs');
const { GD } = PAL;
const { FW, FH, R } = require('./palette.cjs');
const { renderFront, renderSide, mirror } = require('./figure.cjs');

// ---------------------------------------------------------------- cycles (8 frames each)
// Walk/run follow the classic 8-frame layout: 0 contact (right leg forward), 1 down, 2 passing,
// 3 up, 4 contact (left leg forward), 5 down, 6 passing, 7 up. Frames 0 and 4 have a foot planted
// (the view plays footsteps / dust there). Arms swing opposite the legs; the head (with hair and
// the scarf tail) uses the previous frame's bob so it trails the body by one frame.
const N8 = [0, 1, 2, 3, 4, 5, 6, 7];
const at8 = (a, i) => a[((i % 8) + 8) % 8];
const SWING = i => -Math.cos(Math.PI * i / 4);            // character's right arm: -1 back at frame 0
const lagHead = (bob, i) => Math.max(bob[i] - 1, Math.min(bob[i] + 1, at8(bob, i - 1)));

// Idle: breathe in (shoulders up) on 1-3, head follows one frame later, blink on frame 6.
const IDLE_CHEST = [0, 1, 1, 1, 0, 0, 0, 0];
const idleBase = i => ({ bob: 0, chest: IDLE_CHEST[i], head: -at8(IDLE_CHEST, i - 1), blink: i === 6, phase: i });

const WALK = {
  bob: [0, 1, 0, -1, 0, 1, 0, -1],
  // Front view, character's right leg (+ lifted, -1 planted forward toward the camera).
  lift: [-1, 0, 0, 0, 0, 1, 2, 1],
  // Side view, character's right (near) leg.
  side: [{ fx: 3 }, { fx: 1, kx: 2 }, { fx: 0, kx: 0 }, { fx: -2, kx: -1, toe: 1 },
    { fx: -3, toe: 1 }, { fx: -2, lift: 1, kx: 0 }, { fx: 0, lift: 2, kx: 2 }, { fx: 2, lift: 1, kx: 2 }],
  lean: 0, run: false
};
const RUN = {
  // Contact squashes (+1), push-off springs up (-2), frames 3/7 are airborne (-1).
  bob: [1, 0, -2, -1, 1, 0, -2, -1],
  lift: [-1, 0, 0, 1, 2, 3, 2, 1],
  side: [{ fx: 4, kx: 2 }, { fx: 1, kx: 2 }, { fx: -3, kx: -1, toe: 1 }, { fx: -4, lift: 2, kx: -1 },
    { fx: -2, lift: 3, kx: 0 }, { fx: 0, lift: 3, kx: 3 }, { fx: 2, lift: 3, kx: 4 }, { fx: 4, lift: 1, kx: 3 }],
  lean: 1, run: true
};

function cyclePose(C, i, view) {
  const base = { bob: C.bob[i], head: lagHead(C.bob, i), run: C.run, walk: true, phase: i };
  if (view === 'side') return { ...base, lean: C.lean, legs: [at8(C.side, i + 4), C.side[i]], arms: SWING(i) };
  const r = C.lift[i], l = at8(C.lift, i + 4), ar = SWING(i), al = -ar;
  // Front: screen-left is the character's right; back: screen-left is the character's left.
  return view === 'n' ? { ...base, lift: [l, r], arms: [al, ar] } : { ...base, lift: [r, l], arms: [ar, al] };
}

function frames(P, dir, kind) {
  const side = dir === 'e' || dir === 'w';
  let poses;
  if (kind === 'idle') poses = N8.map(i => side ? { ...idleBase(i), legs: [{ fx: -1 }, { fx: 1 }], arms: 0 } : { ...idleBase(i), lift: [0, 0], arms: [0, 0] });
  else poses = N8.map(i => cyclePose(kind === 'run' ? RUN : WALK, i, side ? 'side' : dir));
  if (!side) return poses.map(p => renderFront(P, p, dir === 'n'));
  const f = poses.map(p => renderSide(P, p));
  return dir === 'w' ? f.map(mirror) : f;
}

// Work (engineer): 8 frames @10, one wrench strike per loop. Per view, [upper arm, forearm, wrench]
// angles (0 = down, +PI/2 = +x): ready, wind-up, raised overhead, swing, IMPACT (spark burst),
// recoil (embers), settle, ready. Feet planted in a wide stance; the body rises on the wind-up and
// drops into the blow, the ponytail swings against the motion.
const WORK = {
  e: [[.6, 1.9, 2.5], [1.6, 2.6, 3.0], [2.7, 3.4, 3.8], [1.9, 2.0, 2.2], [.5, .8, .95], [.6, 1.0, 1.25], [.7, 1.5, 1.9], [.6, 1.8, 2.3]],
  s: [[-.15, .25, .5], [-2.5, -2.9, -2.9], [-2.6, -3.0, -3.5], [-.5, .9, 2.6], [-.25, .55, .95], [-.3, .4, .7], [-.2, .3, .6], [-.15, .25, .5]],
  n: [[.15, .1, .2], [2.5, 2.9, 2.9], [2.6, 3.0, 3.5], [.6, 2.2, 2.9], [.25, .35, .5], [.3, .45, .6], [.2, .3, .4], [.15, .1, .2]]
};
const WORK_BOB = [0, 0, -1, -1, 1, 1, 0, 0], WORK_TAIL = [.4, .3, .25, .55, .75, .6, .45, .4];
function workFrames(P, dir) {
  const side = dir === 'e' || dir === 'w';
  const f = N8.map(i => {
    const work = { e: WORK.e[i], s: WORK.s[i], n: WORK.n[i], spark: i === 4 ? 2 : i === 5 ? 1 : 0 };
    const base = { bob: WORK_BOB[i], head: lagHead(WORK_BOB, i), phase: i, work, tail: WORK_TAIL[i] };
    return side ? renderSide(P, { ...base, legs: [{ fx: -2 }, { fx: 2 }], arms: .3 })
      : renderFront(P, { ...base, lift: [0, 0], arms: [0, 0] }, dir === 'n');
  });
  return dir === 'w' ? f.map(mirror) : f;
}

function talkFrames(P) {
  const bob = [0, 0, -1, 0];
  return [0, 1, 2, 1].map((g, i) => renderFront(P, {
    bob: bob[i], head: bob[(i + 3) % 4], lift: [0, 0], arms: [0, 0], gesture: g, mouth: i === 1 || i === 2, blink: false
  }, false));
}

// Kicked-up dust puff for running feet: 16x8, anchor (8,7) = the ground point under the heel.
// Two tufts curl outward and up, a third rises in the middle, then the cloud breaks up and fades.
// Masks are the left half (x 0..7) and mirror onto the right; shading is derived from the shape
// (lit crown, dusty underside) so it matches the top-left light of the characters.
const DUST_W = 16, DUST_H = 8, DUST_ANCHOR = [8, 7];
const DUST_MASKS = [
  ['........', '........', '........', '........', '....##..', '...####.', '...#####', '....###.'],
  ['........', '........', '........', '..##....', '.####.##', '.#######', '.######.', '..###...'],
  ['........', '......##', '.##..###', '#####.##', '########', '.######.', '..####..', '........'],
  ['......#.', '.#.#.##.', '#.###.#.', '.####.#.', '#.#.##..', '.#.#.#..', '........', '........'],
  ['.....#..', '.#..#...', '#.#...#.', '..#..#..', '.#......', '........', '........', '........']
];
// Earthy, semi-transparent ramp (the 0.15 review found the cream CR ramp read as white cloud on grass).
const DUST = R('#5c4a36', '#7f6a50', '#a08a6c', '#bba687');
function dustFrames() {
  const alpha = [215, 205, 185, 145, 95];
  return DUST_MASKS.map((rows, f) => {
    const on = (x, y) => {
      if (x < 0 || y < 0 || x >= DUST_W || y >= DUST_H) return false;
      return rows[y][x < 8 ? x : 15 - x] === '#';
    };
    const c = new Canvas(DUST_W, DUST_H), fade = f >= 3 ? f - 2 : 0;
    for (let y = 0; y < DUST_H; y++) for (let x = 0; x < DUST_W; x++) {
      if (!on(x, y)) continue;
      let k = 2;
      if (!on(x, y - 1)) k = 3;
      else if (!on(x, y + 1)) k = y >= 6 ? 0 : 1;
      k = Math.max(0, k - fade);
      c.put(x, y, withAlpha(DUST[k], alpha[f]));
    }
    return c;
  });
}

function shadowFrame() {
  const c = new Canvas(FW, FH);
  // Wide and dark enough to read around the boots (0.15 review: the old 14x4 shadow vanished under the feet).
  c.ellipse(12, 30, 9, 2.6, [0, 0, 0, 80]);
  c.ellipse(12, 30, 7, 2, [0, 0, 0, 125]);
  return c;
}

function questMarkerFrames() {
  const bob = [0, -1, -2, -2, -1, 0];
  return bob.map((b, i) => {
    const c = new Canvas(8, 16), y = 3 + b;
    const rows = [[2, 5], [2, 5], [2, 5], [3, 4], [3, 4], [3, 4]];
    rows.forEach(([a, z], k) => { for (let x = a; x <= z; x++) c.put(x, y + k, x === a ? GD[3] : x === z ? GD[1] : GD[2]); });
    for (let x = 3; x <= 4; x++) { c.put(x, y + 8, x === 3 ? GD[3] : GD[1]); c.put(x, y + 9, GD[1]); }
    // Glint travelling down the bar.
    const g = i % 3; c.put(3, y + g * 2, hex('#fff6c8'));
    return c.outline(K);
  });
}

module.exports = {
  frames, talkFrames, workFrames, DUST_W, DUST_ANCHOR, dustFrames, shadowFrame, questMarkerFrames
};

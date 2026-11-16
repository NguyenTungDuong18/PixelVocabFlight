'use strict';
// Characters: idle/walk/run/talk cycles, fx_dust, shadow and quest marker.
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, withAlpha } = require('../lib.cjs');
const PFX = require('../pfx.cjs');
const { GD } = PAL;
const { FW, FH, R } = require('./palette.cjs');
const { renderFront, renderSide, mirror } = require('./figure.cjs');
const { drawHead, drawNeck, drawTorsoFront, drawArmFront, bentArm } = require('./body.cjs');

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

// ---------------------------------------------------------------- Act 0 poses (pilot_young, daan)
// Seated on the edge of a bed, facing south: hips 4 px lower; the thighs come toward the camera as a
// lap wider than the hips (knees a little apart, knee caps lit), a dark row of shin under the knees,
// feet planted at the usual anchor row.
function seated(P, pose, arms) {
  const c = new Canvas(FW, FH), o = 4, ch = pose.chest || 0, ho = o + (pose.head || 0), pr = P.pants, sh = P.shoes;
  drawTorsoFront(c, P, o, false, ch);
  for (const [x0, x1] of [[6, 11], [12, 17]]) {
    for (let x = x0; x <= x1; x++) {
      const inner = x === (x0 === 6 ? 11 : 12), outer = x === x0 || x === x1;
      c.put(x, 24, outer ? pr[2] : pr[3]);                                               // top of the thigh, lit
      c.put(x, 25, inner ? pr[1] : outer ? pr[1] : pr[2]);
      c.put(x, 26, inner || outer ? pr[0] : pr[1]);                                      // front of the knee turning under
    }
    c.put(x0 === 6 ? 8 : 14, 24, pr[4] || pr[3]); c.put(x0 === 6 ? 9 : 15, 25, pr[3]);  // knee caps catch the light
    for (let x = x0 + 1; x <= x1 - 1; x++) { c.put(x, 27, pr[0]); c.put(x, 28, x === x0 + 2 || x === x1 - 2 ? pr[2] : pr[1]); }   // shins hanging: shaded under the knee, then lit
  }
  for (const sx of [7, 13]) { for (let k = 0; k < 4; k++) { c.put(sx + k, 29, sh[2]); c.put(sx + k, 30, sh[1]); } c.put(sx + 1, 29, sh[3]); }
  const hands = arms(c, o, ch);
  drawNeck(c, P, 's', ho, 15 + o - ch);
  drawHead(c, P, 's', ho, pose.mouth, pose.blink, pose.hx || 0);
  if (hands) hands(c);
  c.outline(K);
  return c;
}
// Sit idle, 8 frames @5: breathing, blink on frame 6. Jonas leans on his hands planted on the
// mattress behind him (arms straight, out to the sides); Daan sits forward, hands on his knees,
// the notebook flat on his right knee.
function sitFrames(P) {
  const book = P.held === 'book';
  return N8.map(i => seated(P, idleBase(i), (c, o, ch) => {
    if (!book) { drawArmFront(c, P, 0, { dy: 1, dx: -1 }, o, ch, false); drawArmFront(c, P, 1, { dy: 1, dx: -1 }, o, ch, false); return null; }
    return cc => {
      const a = drawArmFront(cc, P, 0, { dy: 2, dx: 2 }, o, ch, false); drawArmFront(cc, P, 1, { dy: 2, dx: 2 }, o, ch, false);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) cc.put(a.x - 1 + x, a.y - 1 + y, y === 2 ? CR_PAGE : x === 0 ? BOOK[0] : BOOK[1]);
    };
  }));
}
const CR_PAGE = hex('#ddd4b0'), BOOK = [hex('#6a2117'), hex('#963826')];
// "Hands" (m1.P1.09), 8 frames @8: Jonas, seated, flies the glide with his right hand (flat hand =
// aeroplane: it comes round high, banks, and sinks to the knee = the landing cloth) while the left
// holds a pencil upright as the stick and eases it over. His head follows the hand; he talks.
const GLIDE = [[-2.5, -2.9, -1], [-2.2, -2.5, -1], [-1.9, -2.0, 0], [-1.6, -1.5, 1], [-1.3, -1.0, 1], [-1.0, -.6, 0], [-.7, -.3, 0], [-1.6, -2.2, -1]];
const STICK = [0, 0, -1, -1, 0, 1, 1, 0];
function handsFrames(P) {
  return N8.map(i => seated(P, { chest: i === 0 || i === 7 ? 1 : 0, head: i < 3 ? -1 : 0, hx: i >= 1 && i <= 4 ? -1 : 0, mouth: i === 1 || i === 2 || i === 5, blink: i === 6 }, (c, o, ch) => {
    const [au, af, bank] = GLIDE[i], sk = P.skin;
    const h = bentArm(c, P, 5, 16 + o - ch, au, 3.6, af, 3.2, true, false);
    const s = bentArm(c, P, 17, 16 + o - ch, .35, 3.4, -1.9, 2.6, true, false);
    return cc => {
      // The flat hand: four pixels, the leading edge dipped or lifted as it banks.
      for (let k = -2; k <= 2; k++) cc.put(h.x + k, h.y + (k < 0 ? bank : 0) * (k === -2 ? 1 : 0), k === 2 ? sk[1] : sk[3]);
      cc.put(h.x - 1, h.y + 1, sk[1]); cc.put(h.x, h.y + 1, sk[1]);
      // The pencil, held like a control column.
      for (let k = 1; k <= 4; k++) cc.put(s.x + Math.round(STICK[i] * k / 4), s.y - k, k === 4 ? hex('#3a2a1a') : GD[2]);
    };
  }));
}

// Kicked-up dust puff for running feet: 16x8, anchor (8,7) = the ground point under the heel.
// pixelfx-style soft puffs (blended, never dithered): two kicked out sideways from the heel, one rising in the
// middle, each lit on top and thinning as it swells; a few grains of grit hop out and drop back.
const DUST_W = 16, DUST_H = 8, DUST_ANCHOR = [8, 7], DUST_FPS = 14;
// Earthy ramp, light first (the 0.15 review found the cream CR ramp read as white cloud on grass).
const DUST = ['#bba687', '#a08a6c', '#7f6a50', '#5c4a36'].map(PFX.kit.H);
const DUST_PUFFS = [[-1, 30, 2.2, 1.5, 2.6, 0], [1, 26, 1.8, 1.4, 2.4, 0], [.15, 3, 3.6, 1.3, 2.3, .03], [-.4, 12, 1.2, 1.1, 1.8, .05]];
const DUST_GRIT = [[-1, 34, 40], [1, 30, 44], [-.5, 18, 36]];
function dustFrames() {
  const travel = (v, k, t) => v * (1 - Math.exp(-k * t)) / k;
  return PFX.frames(DUST_W, DUST_H, 6, (p, f) => {
    const t = f / DUST_FPS;
    for (const [dir, v, rise, r0, r1, delay] of DUST_PUFFS) {
      const age = t - delay + .02, u = age / .44; if (age < 0 || u >= 1) continue;
      const x = 8 + dir * (1.4 + travel(v, 7, age)), y = 6.6 - travel(rise * 6, 6, age), r = r0 + (r1 - r0) * Math.min(1, u * 1.6);
      PFX.kit.puff(p, x, y, r, Math.min(1.5, 1.6 * Math.pow(1 - u, 1.2)), .2 * u, DUST);
    }
    for (const [dir, v, up] of DUST_GRIT) {
      const h = up * t - 120 * t * t; if (t === 0 || h < 0) continue;
      p.px(8 + dir * travel(v, 4, t), 6.5 - h, DUST[3]);
    }
  });
}

function shadowFrame() {
  const c = new Canvas(FW, FH);
  // Wide and dark enough to read around the boots (0.15 review: the old 14x4 shadow vanished under the feet).
  c.ellipse(12, 30, 9, 2.6, [0, 0, 0, 80]);
  c.ellipse(12, 30, 7, 2, [0, 0, 0, 125]);
  return c;
}

// Quest marker over the professor: 16x24, a bold gold '!' (after pixelfx ui/exclamation) bobbing on a slow
// sine, lit down its left side with a dark outline, a glint running down the bar, a soft pulsing glow and a
// twinkle off its shoulder. BaseView reads the size from the sprite and stands it on the bottom row.
const MARK = ['#fff6c8', '#f0d47c', '#d2a845', '#a07a2a', '#6b4c17'].map(PFX.kit.H);
function questMarkerFrames() {
  const N = 12, { TAU, sparkle } = PFX.core;
  const inBar = (x, y) => y >= 0 && y < 11 && Math.abs(x - 8) < 2.6 - y * .12 && !(y < 1 && Math.abs(x - 8) > 1.6);
  const inDot = (x, y) => Math.hypot(x - 8, y - 14.2) < 2.1;
  return PFX.frames(16, 24, N, (p, f) => {
    const b = Math.round(1 - Math.cos(f / N * TAU)), top = 5 - b, glint = (f * 1.5) % 18 - 3, pulse = .5 + .5 * Math.sin(f / N * TAU);
    p.glow(8, top + 8, 11, MARK[1], .18 + .14 * pulse);
    const pix = [];
    for (let y = 0; y < 17; y++) for (let x = 4; x < 12; x++) {
      const cx = x + .5, cy = y + .5, bar = inBar(cx, cy), dot = inDot(cx, cy);
      if (!bar && !dot) continue;
      const w = bar ? 2.6 - cy * .12 : 2.1, q = (cx - 8 + w) / (2 * w);
      let c = q < .3 ? MARK[0] : q > .72 ? MARK[3] : MARK[1];
      if (bar && cy > 8 && q >= .3 && q <= .72) c = MARK[2];
      if (dot && Math.hypot(cx - 7.2, cy - 13.4) < .9) c = MARK[0];
      if (bar && Math.abs(cy - glint) < 1 && q < .8) c = PFX.kit.H('#ffffff');
      pix.push([x, top + y, c]);
    }
    PFX.kit.crisp(p, pix, PFX.kit.H('#2a1405'), .92);
    if (f >= 3 && f <= 5) sparkle(p, 4.5, top + 1.5, [1, 2, 1][f - 3], MARK[0], MARK[1], .3);
  });
}

module.exports = {
  frames, talkFrames, workFrames, sitFrames, handsFrames, DUST_W, DUST_ANCHOR, dustFrames, shadowFrame, questMarkerFrames
};

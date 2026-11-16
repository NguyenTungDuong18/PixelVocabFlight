'use strict';
// Units: explosions, sparks, smoke, shockwave, ice shield, tracers, splash, lock-on reticle.
// Drawn with the pixelfx Painter (pfx.cjs): opaque colour plus additive light, so every hot thing carries a
// translucent glow, smoke is soft (blended, never dithered) and motion follows drag (fast burst, slow decay).
const { Rng, TAU, ease, rand, noise, sparkle } = require('../pfx.cjs').core;
const { paint } = require('../pfx.cjs');
const { H, FIRE, SMOKE, flames, puff, streak, soft, crisp, frames } = require('../pfx.cjs').kit;

const WHITE = H('#ffffff');
const ICE = ['#e2f6fb', '#9fd5e8', '#5795b0', '#2c5568', '#17303d'].map(H);
const WATER = ['#ffffff', '#d6eef4', '#8cc3d6', '#4c8aa4', '#326a84', '#255268'].map(H);
const RED = ['#fff3c4', '#ffb08a', '#e58a63', '#c25a3d', '#963826', '#6a2117', '#3e130e'].map(H);
const GOLD = ['#fff6c8', '#f0d47c', '#d2a845', '#a07a2a', '#6b4c17'].map(H);
// position after t s of a launch at speed v with drag k (fast burst, slow drift)
const travel = (v, k, t) => v * (1 - Math.exp(-k * t)) / k;

// ---------------- Explosion (32x32, 8 frames: FlightGame.Verification checks the count) ----------------
// White hero frame and flare, a shock ring, flame balls that burst out and cool down the ramp into field-grey
// smoke, sparks and dark airframe debris flung out, light that flares and falls away.
const EXPLOSION_FPS = 12;
function explosionFrames() {
  const C = 16, R = new Rng(41);
  const balls = Array.from({ length: 10 }, (_, i) => {
    const a = i / 10 * TAU + R.range(-.3, .3);
    return { a, v: i < 2 ? R.range(5, 12) : R.range(28, 58), r: i < 2 ? R.range(5, 6) : R.range(2.8, 4.6), life: R.range(.22, .42) };
  });
  const smokes = balls.map(b => ({ ...b, born: b.life * .7, life: R.range(.38, .52), r: b.r * 1.15 }));
  const sparks = Array.from({ length: 12 }, () => ({ a: R.range(0, TAU), v: R.range(70, 140), life: R.range(.16, .36) }));
  const debris = Array.from({ length: 4 }, (_, i) => ({ a: i / 4 * TAU + R.range(.2, 1.2), v: R.range(55, 75), spin: R.range(0, 4) }));
  return frames(32, 32, 8, (p, f) => {
    const t = f / EXPLOSION_FPS;
    p.glow(C, C, 18, FIRE[4], .6 * Math.exp(-t / .1));
    // smoke under everything: puffs left where the flame balls die, swelling and thinning out
    for (const s of smokes) {
      const age = t - s.born; if (age <= 0 || age >= s.life) continue;
      const u = age / s.life, d = travel(s.v, 5, s.born) + travel(s.v * .25, 3, age);
      puff(p, C + Math.cos(s.a) * d, C + Math.sin(s.a) * d - 6 * age, s.r * (1 + .6 * u), Math.min(1, age * 14) * (1 - u) * .95, .25 + .45 * u);
    }
    // debris: dark tumbling chunks with a lit edge and a smoke trail
    for (const b of debris) {
      if (t < .03 || t > .5) continue;
      const d = 3 + travel(b.v, 4, t), x = C + Math.cos(b.a) * d, y = C + Math.sin(b.a) * d, ux = Math.cos(b.a), uy = Math.sin(b.a);
      puff(p, x - ux * 2.5, y - uy * 2.5, 1.2, .5 * (1 - t / .5), .5);
      const sp = Math.floor(t * 30 + b.spin) % 2;
      p.px(x, y, SMOKE[5]); p.px(x + (sp ? 1 : 0), y + (sp ? 0 : 1), SMOKE[4]); p.px(x - (sp ? 0 : 1), y - (sp ? 1 : 0), FIRE[5]);
    }
    // flame balls, older ones first so the hot ones sit on top
    flames(p, balls.filter(b => t < b.life).map(b => {
      const u = t / b.life, d = travel(b.v, 5, t);
      return { x: C + Math.cos(b.a) * d, y: C + Math.sin(b.a) * d - 5 * t, r: b.r * (.75 + .5 * Math.min(1, t * 12)) * (1 - .6 * u), heat: .9 * Math.pow(1 - u, 1.6) };
    }), .8);
    for (const s of sparks) {
      if (t >= s.life || t < .02) continue;
      const d = 4 + travel(s.v, 3.5, t), v = s.v * Math.exp(-3.5 * t);
      streak(p, C + Math.cos(s.a) * d, C + Math.sin(s.a) * d, Math.cos(s.a), Math.sin(s.a), Math.min(3.5, 1 + v * .025), 1 - t / s.life);
    }
    // the hero frame and the shock ring
    if (f === 0) {
      p.circle(C, C, 7, FIRE[4]); p.circle(C, C, 5.6, FIRE[2]); p.circle(C, C, 4, WHITE);
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8 + .2, L = k % 2 ? 9 : 13;
        p.line(C + Math.cos(a) * 5, C + Math.sin(a) * 5, C + Math.cos(a) * L, C + Math.sin(a) * L, u => u < .4 ? WHITE : u < .75 ? FIRE[2] : FIRE[4]);
      }
      p.glow(C, C, 10, WHITE, .6);
    } else if (t < .2) {
      // shock ring: solid, thinning, breaking into arcs (no dithered lace)
      const u = t / .2, r = 7 + 8 * ease.outCubic(u);
      p.ring(C, C, r, u < .5 ? 1.6 : 1, u < .5 ? FIRE[1] : FIRE[2], (v, g) => noise(g * 2.5 + 4, 3) > u - .6 ? 1 : 0);
      p.glowRing(C, C, r, 2.5, FIRE[3], .35 * (1 - u));
    }
  });
}

// ---------------- Spark (12x12) ----------------
// A star glint that throws five short streaks; they cool from white to orange and go out as embers with a glow.
const SPARK_FPS = 18;
function sparkFrames() {
  const C = 6, A = [-.35, .95, 2.2, 3.4, 4.6], V = [30, 22, 27, 20, 25];
  return frames(12, 12, 4, (p, f) => {
    const t = f / SPARK_FPS, k = 1 - f / 4.5;
    p.glow(C, C, 7, FIRE[3], .7 * Math.exp(-t / .07));
    if (f < 3) sparkle(p, C, C, [3, 2, 1][f], f ? FIRE[2] : FIRE[1], FIRE[4], 0);
    if (f === 0) { p.px(C - 1, C - 1, FIRE[2]); p.px(C + 1, C + 1, FIRE[2]); p.px(C - 1, C + 1, FIRE[3]); p.px(C + 1, C - 1, FIRE[3]); return; }
    A.forEach((a, i) => {
      const d = 1.5 + travel(V[i], 4, t);
      streak(p, C + Math.cos(a) * d, C + Math.sin(a) * d, Math.cos(a), Math.sin(a), f < 3 ? 2.2 : 1.6, k, 1.6);
    });
  });
}

// ---------------- Smoke puff (8x8): missile trail and take-off exhaust ----------------
// Born hot (a lick of flame inside a cream puff), it swells, greys and thins out; lobes billow as it grows.
function smokeFrames() {
  const S = [[1.5, 1, 0], [2.3, 1, .05], [2.9, .9, .15], [3.2, .72, .25], [3.5, .5, .35], [3.7, .26, .45]];
  return frames(8, 8, S.length, (p, f) => {
    const [r, a, tone] = S[f], C = 4 - f * .12;
    puff(p, C + .25, C + .3, r, a, tone);
    if (f > 0) puff(p, C - r * .45, C - r * .2 + .2, r * .55, a * .8, tone - .1);
    if (f > 1) puff(p, C + r * .4, C - r * .45, r * .5, a * .7, tone);
    if (f === 0) { p.px(C, C, WHITE); p.px(C - 1, C, FIRE[2]); p.px(C, C + 1, FIRE[3]); p.glow(C, C, 4, FIRE[4], .5); }
    if (f === 1) { p.px(C, C + 1, FIRE[5]); p.glow(C, C + 1, 3, FIRE[5], .25); }
  });
}

// ---------------- Shockwave (64x64) ----------------
// A white flash, then a pressure ring racing out: white leading edge, fire-tinted body, a dusty wake and a heat
// haze inside; it thins, cools to cream and breaks into arcs as it slows.
const SHOCK_FPS = 12;
function shockwaveFrames() {
  const C = 32;
  return frames(64, 64, 8, (p, f) => {
    const t = f / SHOCK_FPS, u = f / 7, R = 5 + 23 * ease.outCubic(Math.min(1, t / .55)), w = 1 + 3.2 * (1 - u);
    p.glow(C, C, 30, FIRE[4], .55 * Math.exp(-t / .12));
    if (f === 0) { p.circle(C, C, 8, FIRE[3]); p.circle(C, C, 6.5, FIRE[1]); p.circle(C, C, 4.5, WHITE); p.glow(C, C, 14, WHITE, .5); return; }
    // heat haze and the dusty wake inside the ring
    p.disc(C, C, R - w, FIRE[2], .15 * (1 - u) * (1 - u));
    p.ring(C, C, R - w + .5, 2.2, SMOKE[2], (v, g) => .4 * (1 - u) * (.6 + .4 * noise(g * 3 + 9, 5)));
    const broken = (g) => noise((g + Math.PI) * 4, 11) * .5 + .5 > u * .9 - .15;
    p.ring(C, C, R, w, (v) => {
      const hot = 1 - u;
      if (v > .7) return hot > .5 ? WHITE : FIRE[1];
      return hot > .6 ? (v > .35 ? FIRE[2] : FIRE[4]) : hot > .3 ? (v > .35 ? FIRE[1] : SMOKE[1]) : (v > .35 ? SMOKE[0] : SMOKE[1]);
    }, (v, g) => (broken(g) ? 1 : 0) * Math.min(1, 1.6 - u));
    p.glowRing(C, C, R - w / 2, 3.5, FIRE[3], .45 * (1 - u));
    // grit riding the front
    for (let k = 0; k < 14; k++) {
      const g = rand(k, 3) * TAU, rr = R + 1 + rand(k, 4) * 3;
      if (!broken(g) || f > 6) continue;
      const x = C + Math.cos(g) * rr, y = C + Math.sin(g) * rr;
      p.px(x, y, k % 3 ? SMOKE[3] : FIRE[5]); if (k % 4 === 0) p.px(x - Math.cos(g), y - Math.sin(g), SMOKE[4]);
    }
  });
}

// ---------------- Ice shield (40x40, loop) ----------------
// A faceted octagon of ice: lit upper-left facets, shaded lower-right, a dark rim so it reads on any livery,
// a thin frosted dome inside, a glint sweeping round the rim and frost stars twinkling at the corners.
const ICE_N = 8;
function iceShieldFrames() {
  const C = 20, oct = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * .7071);
  return frames(40, 40, ICE_N, (p, f) => {
    const sweep = f / ICE_N * TAU - 2.4;
    p.glowRing(C, C, 17.5, 3, ICE[1], .22);
    // translucent parts: dark rim outside, frost line inside, a frosted dome with faint facet lines to the corners
    soft(p, 0, 0, 40, 40, (x, y) => {
      const dx = x - C, dy = y - C, d = oct(dx, dy), g = Math.atan2(dy, dx);
      if (d > 18.9) return;
      if (d > 18.2) return [ICE[4], .6];
      if (d > 16.4) return;
      if (d > 15.4) return [ICE[0], .5];
      const facet = Math.abs(Math.sin(g * 4 + .3927)) < .07 && d > 5;
      return [facet ? ICE[0] : ICE[1], facet ? .3 : (d > 12 ? .16 : .08) + (dx + dy < -12 ? .1 : 0)];
    });
    p.shade(0, 0, 40, 40, (x, y, o) => {
      const dx = x - C, dy = y - C, d = oct(dx, dy), g = Math.atan2(dy, dx);
      if (d > 16.4 && d <= 18.2) {
        // facet light from the top-left, a white ridge on the outer row of lit facets
        const lit = -(dx + dy) / Math.max(1, Math.hypot(dx, dy)), ridge = d > 17.6;
        let c = lit > .45 ? (ridge ? ICE[0] : ICE[1]) : lit > -.45 ? (ridge ? ICE[1] : ICE[2]) : ICE[2];
        if (d < 17 && lit < -.2) c = ICE[3];
        let s = Math.abs(((g - sweep + Math.PI * 3) % TAU) - Math.PI);
        if (s < .25) { c = WHITE; o.k = .6; } else if (s < .6) { c = ICE[0]; o.k = .25; }
        o.c = c; o.l = ICE[1];
      }
    });
    for (let k = 0; k < 4; k++) {
      const ph = (f + k * 2) % ICE_N, a = k * TAU / 4 - Math.PI * .75 + .3927 * (k % 2), x = C + Math.cos(a) * 17.5, y = C + Math.sin(a) * 17.5;
      if (ph < 3) sparkle(p, x, y, [1, 2, 1][ph], ICE[0], ICE[1], .35);
    }
  }, 6);
}

// ---------------- Tracers (4x12, head up) ----------------
// White-hot head, yellow body tapering to an orange tail that fades; a halo of light around the hot end.
function tracerOf(R) {
  return paint(4, 12, p => {
    p.glowLine(2, 1.5, 2, 6, 2.6, R[2], .45);
    for (let y = 0; y < 12; y++) {
      const c = y < 2 ? R[0] : y < 4 ? R[1] : y < 7 ? R[2] : y < 9 ? R[3] : R[4], a = y < 9 ? 1 : 1 - (y - 8) * .24;
      p.blend(1, y, c, a); if (y < 8) p.blend(2, y, y < 2 ? R[0] : c, a);
    }
  });
}
const tracerFrames = () => [tracerOf([WHITE, FIRE[1], FIRE[3], FIRE[5], FIRE[6]])];
const enemyTracerFrames = () => [tracerOf([WHITE, RED[0], RED[2], RED[3], RED[4]])];

// ---------------- Muzzle flash (8x8, fires up) ----------------
// A white-hot core at the muzzle, a flame tongue forward and side petals, then a dimmer flash and a wisp of smoke.
function muzzleFrames() {
  return frames(8, 8, 3, (p, f) => {
    if (f === 0) {
      p.glow(4, 3.5, 6, FIRE[3], .8);
      for (const [x, y, c] of [[3, 0, FIRE[3]], [4, 0, FIRE[4]], [3, 1, FIRE[1]], [4, 1, FIRE[2]], [3, 2, WHITE], [4, 2, FIRE[1]],
        [2, 3, FIRE[2]], [3, 3, WHITE], [4, 3, WHITE], [5, 3, FIRE[2]], [1, 3, FIRE[4]], [6, 3, FIRE[4]], [0, 2, FIRE[5]], [7, 2, FIRE[5]],
        [3, 4, FIRE[1]], [4, 4, FIRE[2]], [2, 1, FIRE[5]], [5, 1, FIRE[5]]]) p.px(x, y, c);
    } else if (f === 1) {
      p.glow(4, 3.5, 5, FIRE[4], .5);
      for (const [x, y, c] of [[3, 1, FIRE[4]], [4, 1, FIRE[5]], [3, 2, FIRE[2]], [4, 2, FIRE[3]], [3, 3, FIRE[1]], [4, 3, FIRE[2]],
        [2, 3, FIRE[5]], [5, 3, FIRE[5]], [1, 2, FIRE[6]], [6, 2, FIRE[6]], [3, 4, FIRE[4]], [4, 4, FIRE[5]]]) p.px(x, y, c);
    } else {
      puff(p, 4, 2.2, 1.8, .55, .2);
      p.px(3, 3, FIRE[5]); p.px(4, 3, FIRE[6]); p.glow(4, 3, 3, FIRE[5], .3);
    }
  });
}

// ---------------- Water splash (16x10) ----------------
// A white plume, a crown of droplets thrown out and falling back, ripples spreading and fading on the water.
function splashFrames() {
  const C = 8, Y = 6, R = new Rng(9), drops = Array.from({ length: 8 }, (_, i) => ({ a: i / 8 * TAU + R.range(-.3, .3), v: R.range(22, 34), up: R.range(18, 30) }));
  return frames(16, 10, 6, (p, f) => {
    const t = f / 10;
    for (const [t0, c] of [[0, WATER[1]], [.18, WATER[2]]]) {
      const u = (t - t0) / .5; if (u <= 0 || u >= 1) continue;
      const rx = 2 + 5.5 * ease.outCubic(u);
      p.shade(0, 0, 16, 10, (x, y, o) => {
        const d = Math.hypot((x - C) / rx, (y - Y) / (rx * .45));
        if (Math.abs(d - 1) * rx < .6 && noise(Math.atan2(y - Y, x - C) * 3, 7) > u * 1.4 - .9) o.c = u < .45 ? c : WATER[3];
      });
    }
    if (f < 3) { p.ellipse(C, Y, 2.6 - f * .6, 1.3 - f * .3, WATER[f + 1]); p.circle(C, Y - 1 - f, 1.2 - f * .3, WHITE); p.glow(C, Y, 5, WATER[1], .4 - f * .12); }
    for (const d of drops) {
      if (t > .45 || f === 0) continue;
      const r = travel(d.v, 3, t), x = C + Math.cos(d.a) * r, h = d.up * t - 90 * t * t, y = Y + Math.sin(d.a) * r * .45 - Math.max(0, h);
      if (h < -.5) continue;
      p.px(x, y, t < .25 ? WHITE : WATER[1]);
    }
  });
}

// ---------------- Lock-on reticle (40x40, 8 frames) ----------------
// Frames 0-5 close in with the lock (FlightBoardView picks the frame from the lock progress), 6-7 blink locked.
// Brackets keep a translucent dark outline to read on any terrain and carry their own light.
function lockReticleFrames() {
  return frames(40, 40, 8, (p, f) => {
    const locked = f >= 6, d = locked ? 11 : Math.round(18 - f * 1.4), arm = locked ? 6 : 5;
    const col = locked ? (f === 6 ? RED[2] : FIRE[4]) : [GOLD[2], GOLD[2], GOLD[1], GOLD[1], FIRE[3], FIRE[3]][f];
    const hi = locked ? (f === 6 ? RED[0] : FIRE[1]) : GOLD[0], pix = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = 20 + sx * d - (sx > 0 ? 1 : 0), cy = 20 + sy * d - (sy > 0 ? 1 : 0);
      for (let s = 0; s < arm; s++) {
        pix.push([cx - sx * s, cy, s === 0 ? hi : col], [cx, cy - sy * s, s === 0 ? hi : col]);
        if (locked) pix.push([cx - sx * s, cy - sy, col], [cx - sx, cy - sy * s, col]);
      }
      p.glowLine(cx, cy, cx - sx * arm, cy, 2.5, col, locked ? .5 : .3);
      p.glowLine(cx, cy, cx, cy - sy * arm, 2.5, col, locked ? .5 : .3);
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let s = 0; s < 3; s++) {
      const r = d + 3 + s;
      pix.push([20 + dx * r - (dx > 0 ? 1 : 0), 20 + dy * r - (dy > 0 ? 1 : 0), s === 0 ? hi : col]);
    }
    if (locked) {
      for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) {
        const n = 4;
        for (let s = 0; s <= n; s++) pix.push([Math.round(20 + dx + (dy - dx) * s / n), Math.round(20 + dy + (-dx - dy) * s / n), col]);
      }
      pix.push([19, 19, WHITE], [20, 20, WHITE], [19, 20, hi], [20, 19, hi]);
      p.glow(20, 20, 9, col, f === 6 ? .55 : .3);
      if (f === 6) soft(p, 0, 0, 40, 40, (x, y) => Math.abs(Math.hypot(x - 20, y - 20) - 14.5) < .6 ? [col, .4] : null);
    }
    const seen = new Map(); for (const q of pix) seen.set(q[0] + ',' + q[1], q);
    crisp(p, [...seen.values()]);
  });
}

module.exports = {
  explosionFrames, sparkFrames, smokeFrames, shockwaveFrames, iceShieldFrames, tracerFrames, enemyTracerFrames,
  muzzleFrames, splashFrames, lockReticleFrames, EXPLOSION_FPS, SPARK_FPS, SHOCK_FPS, ICE_N
};

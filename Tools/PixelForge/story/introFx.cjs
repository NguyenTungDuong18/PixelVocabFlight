'use strict';
// Title intro effects (title_intro_fx_*): aerial explosion, flak, debris, fire trail, smoke, sparks,
// head-on tracers, speed lines, cloud wisps. Contract: title intro cinematic, part B (names, sizes, frame
// counts, fps and loop flags are read by TitleScene; do not change them here alone).
// Drawn with the pixelfx Painter (pfx.cjs): fire is kit.flames (one solid metaball mass down kit.FIRE), smoke is
// a union of lit spheres down kit.SMOKE with true alpha (never dithered), light is additive glow. Light comes
// from the top-left. Every random number comes from a seeded Rng or hash noise, so the art is deterministic.
const PFX = require('../pfx.cjs');
const { Rng, TAU, rand, noise2, fbm, clamp, sparkle } = PFX.core;
const { H, FIRE, SMOKE, flames, puff, streak, soft, frames, paint } = { ...PFX.kit, paint: PFX.paint };
const { PAL } = require('../lib.cjs');

const P = c => H('#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''));
const WHITE = FIRE[0];
const INK = P(PAL.K);
const METAL = PAL.ST.map(P);                 // airframe aluminium / grey paint, dark .. light
const CLOUD = [...PAL.SW.map(P), WHITE];     // vapour and cloud wisps, shadow .. sunlit
const AIR = P(PAL.IC[3]);                    // speed streaks: the pale sky-white of rushing air
const clampI = (r, i) => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];
// position after t s of a launch at speed v with drag k (fast burst, slow drift)
const travel = (v, k, t) => v * (1 - Math.exp(-k * t)) / k;

// ---------------- Rolling smoke: a union of lit spheres ----------------
// balls: {x, y, r, a (opacity), tone (0 light .. 1 dark), warm (0..1: fire glowing on the underside)}.
// Each pixel takes the sphere that stands highest toward the viewer, so lobes overlap like cauliflower and the
// crevices between them fall into shadow; the edge of each sphere wobbles with noise so billows never read as
// circles. tear (0..1) eats holes into thinning smoke. One blend per pixel: true alpha, no dither.
const LX = -.5, LY = -.6, LZ = .62;
function smokeMass(p, balls, { seed = 0, tear = 0, tearY = 0, fade = null } = {}) {
  balls = balls.filter(b => b.r >= .7 && b.a > .01);
  if (!balls.length) return;
  const x0 = Math.min(...balls.map(b => b.x - b.r * 1.2)), x1 = Math.max(...balls.map(b => b.x + b.r * 1.2));
  const y0 = Math.min(...balls.map(b => b.y - b.r * 1.2)), y1 = Math.max(...balls.map(b => b.y + b.r * 1.2));
  soft(p, x0, y0, x1, y1, (x, y) => {
    let best = null, bh = -1, nx = 0, ny = 0, nz = 0, bd = 0;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i], ex = x - b.x, ey = y - b.y, R2 = b.r * b.r * 1.44;
      if (ex * ex + ey * ey >= R2) continue;
      const rr = b.r * (1 + .16 * noise2(x * .21 + i * 7.3, y * .21, seed));
      const dx = ex / rr, dy = ey / rr, d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const z = Math.sqrt(1 - d2), hz = z * rr;
      if (hz > bh) { bh = hz; best = b; nx = dx; ny = dy; nz = z; bd = Math.sqrt(d2); }
    }
    if (!best) return;
    const lit = nx * LX + ny * LY + nz * LZ;
    let c = clampI(SMOKE, best.tone * (SMOKE.length - 1) + (.35 - lit) * 1.8);
    const w = (best.warm || 0) * (ny + .3);          // young smoke: fire glowing through all but the cap
    if (w > .15) c = clampI(FIRE, Math.max(5, 8.4 - w * 2.6));
    let a = best.a * (bd > .9 ? .72 : 1);
    if (tear > 0) a *= clamp((fbm(x * .07, y * .07 + tearY, seed + 3) * .5 + .5 - tear) * 4 + 1);
    if (fade) a *= fade(x, y);
    return [c, a];
  });
}

// ---------------- Billowing fire mass for big fireballs ----------------
// kit.flames sums inverse-square fields, so dozens of big balls flood their whole bounding box; a fireball of
// 40-80 balls needs a union instead. Same ramp (kit.FIRE) and lighting rules: each lobe is hottest in its middle,
// cools to a darker rim (cauliflower contours), the lower-right flank one step darker (light top-left), slow
// noise billows instead of per-pixel grain, its own additive light. balls: {x, y, r, heat 1 white .. 0 dull}.
function fireMass(p, balls, { seed = 0, glow = 1 } = {}) {
  balls = balls.filter(b => b.r >= .7);
  if (!balls.length) return;
  const x0 = Math.min(...balls.map(b => b.x - b.r * 1.2)), x1 = Math.max(...balls.map(b => b.x + b.r * 1.2));
  const y0 = Math.min(...balls.map(b => b.y - b.r * 1.2)), y1 = Math.max(...balls.map(b => b.y + b.r * 1.2));
  const n = FIRE.length - 3;
  p.shade(x0, y0, x1, y1, (x, y, o) => {
    let best = null, bh = -1, nx = 0, ny = 0, nz = 0, bd = 0;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i], ex = x - b.x, ey = y - b.y;
      if (ex * ex + ey * ey >= b.r * b.r * 1.44) continue;
      const rr = b.r * (1 + .17 * noise2(x * .16 + i * 5.1, y * .16, seed));
      const dx = ex / rr, dy = ey / rr, d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const z = Math.sqrt(1 - d2), hz = z * rr;
      if (hz > bh) { bh = hz; best = b; nx = dx; ny = dy; nz = z; bd = Math.sqrt(d2); }
    }
    if (!best) return;
    const lit = nx * LX + ny * LY + nz * LZ;
    const heat = best.heat * (.62 + .38 * nz) + fbm(x * .07, y * .07, seed + 2) * .12;
    const rim = bd > .93 ? 2 : bd > .8 ? 1 : 0;
    o.c = clampI(FIRE, (1 - heat) * n + rim + (lit < .05 ? 1 : 0) - (lit > .75 ? .6 : 0));
    o.l = clampI(FIRE, (1 - best.heat) * n + 2); o.k = .06 * best.heat * glow;
  });
}

// A soft translucent line (speed streaks): every pixel once, alpha tapering at both ends.
function softLine(p, x0, y0, x1, y1, c, a) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    p.blend(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, c, a * Math.sin(Math.PI * Math.min(1, .04 + u * .92)));
  }
}

// ---------------- title_intro_fx_explosion 160x160, 16 @16, once ----------------
// Aircraft fuel fireball, centre (80, 80). 0 white flash with rays; 1-3 burst (white core, yellow, orange, red
// rim, 6 flame tongues, a vapour ring racing out); 4-7 the fire rolls and black-brown smoke wells up from the
// core, lit by the fire from below, the lower-right flank burning longest; 8-10 black smoke with a few hot
// spots; 11-15 the smoke greys, tears and thins while embers fall. Burst in 3 frames, decay over 12.
const EXP_S = [12, 28, 44, 58, 64, 68, 70, 70, 72, 72, 72, 73, 74, 75, 75, 76]; // overall radius per frame
function explosionFrames() {
  const C = 80, R = new Rng(1944);
  const lobes = Array.from({ length: 7 }, (_, i) => ({ a: (i + R.range(-.3, .3)) / 7 * TAU, d: R.range(.34, .54), r: R.range(.34, .46), heat: R.range(.84, 1) }));
  const tongues = Array.from({ length: 6 }, (_, i) => ({ a: (i + .5 + R.range(-.35, .35)) / 6 * TAU, len: R.range(14, 22), w: R.range(5, 7), curl: R.range(-.35, .35) }));
  const flick = Array.from({ length: 34 }, () => ({ a: R.range(0, TAU), d: R.range(.74, .9), r: R.range(2.4, 4.6) }));
  const smokes = Array.from({ length: 28 }, () => {
    const a = R.range(0, TAU), d = Math.sqrt(R.next()) * .5;
    const lr = Math.max(0, Math.cos(a - Math.PI / 4));              // the lower-right flank keeps burning longest
    return { a, d, r: R.range(.24, .36), born: 3.6 + d * 4 + lr * 1.6 + R.range(0, .8), spin: R.range(-1, 1) };
  });
  const hots = Array.from({ length: 7 }, () => ({ a: Math.PI / 4 + R.range(-1.3, 1.3), d: R.range(.15, .55), r: R.range(2, 4.2) }));
  const embers = Array.from({ length: 40 }, () => ({ a: R.range(0, TAU), v: R.range(80, 190), k: R.range(3, 4), life: R.range(.4, .86), big: R.chance(.35) }));
  const debris = Array.from({ length: 6 }, (_, i) => ({ a: (i + R.range(.1, .9)) / 6 * TAU, v: R.range(230, 290), spin: R.int(0, 3) }));
  const FR = [0, 28, 44, 54, 58, 58, 54, 48], HC = [0, 1, .86, .72, .6, .52, .46, .4];

  const fireAt = (f, cx, cy) => {
    const out = [];
    if (f < 1 || f > 7) return out;
    const Rf = FR[f], hc = HC[f];
    out.push({ x: cx + 2, y: cy + 1, r: Rf * .52, heat: hc });
    for (const l of lobes) out.push({ x: cx + Math.cos(l.a) * l.d * Rf, y: cy + Math.sin(l.a) * l.d * Rf, r: l.r * Rf, heat: hc * l.heat - .06 });
    if (f >= 2 && f <= 4) {
      const grow = [0, 0, .7, 1, 1.08][f], thin = [0, 0, 1, 1, .75][f];
      for (const t of tongues) for (let k = 0; k < 5; k++) {
        const s = k / 4, a = t.a + t.curl * s * s, d = Rf * .8 + t.len * grow * s;
        out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d - (f - 2) * 2 * s, r: t.w * thin * (1 - .55 * s), heat: hc * (.92 - .4 * s) });
      }
    }
    if (f >= 3) flick.forEach((q, i) => {
      if (rand(i, f, 7) < (f > 4 ? .55 : .3)) return;
      out.push({ x: cx + Math.cos(q.a) * q.d * Rf, y: cy + Math.sin(q.a) * q.d * Rf, r: q.r * (f > 5 ? .7 : 1), heat: hc * .8 + rand(i, f, 8) * .15 });
    });
    return out;
  };

  return frames(160, 160, 16, (p, f) => {
    const t = f / 16, rise = f > 3 ? (f - 3) * .7 : 0, drift = f > 3 ? (f - 3) * .35 : 0;
    const cx = C + drift, cy = C - rise, S = EXP_S[f];
    if (f === 0) return flash(p, C);
    // the light of the fireball: a wide warm halo that falls away fast
    const halo = [0, .42, .32, .22, .14, .09, .06, .04][f] || 0;
    if (halo) p.glow(C, C, 76, f < 3 ? FIRE[2] : f < 5 ? FIRE[3] : FIRE[5], halo);
    // vapour ring racing out ahead of the fire (true alpha, broken into arcs)
    if (f <= 3) {
      const rr = [0, 42, 62, 74][f], al = [0, .5, .3, .13][f];
      soft(p, C - rr - 2, C - rr - 2, C + rr + 2, C + rr + 2, (x, y) => {
        const d = Math.hypot(x - C, y - C) - rr, g = Math.atan2(y - C, x - C);
        if (d > 0 || d < -2.6 || noise2(Math.cos(g) * 2.2, Math.sin(g) * 2.2, 17 + f) < -.25) return;
        return [d > -1.2 ? CLOUD[4] : CLOUD[3], al];
      });
    }
    fireMass(p, fireAt(f, cx, cy), { seed: f * 3 + 1, glow: .8 });
    // smoke wells up from the core and rolls outward
    if (f >= 4) {
      const fade = f <= 10 ? 1 : [.9, .78, .64, .48, .32][f - 11];
      const tone = f <= 10 ? .86 : .86 - (f - 10) * .08;
      smokeMass(p, smokes.map(s => {
        const g = clamp((f - s.born + 1) / 2);
        if (g <= 0) return { r: 0, a: 0 };
        const a = s.a + s.spin * .05 * Math.max(0, f - s.born);
        return {
          x: cx + Math.cos(a) * s.d * S, y: cy + Math.sin(a) * s.d * S, r: s.r * S * (.3 + .7 * g),
          a: fade * (.86 + .14 * clamp((f - s.born) / 1.5)), tone, warm: f <= 9 ? clamp(1 - (f - s.born) / 2.6) : 0,
        };
      }), { seed: 9, tear: f <= 10 ? 0 : (f - 10) * .09, tearY: f * .12 });
    }
    // hot spots still burning inside the smoke, flickering out
    if (f >= 6 && f <= 10) flames(p, hots.flatMap((h, i) => {
      if (rand(i, f, 3) < .25 + (f - 6) * .1) return [];
      return [{ x: cx + Math.cos(h.a) * h.d * S, y: cy + Math.sin(h.a) * h.d * S, r: h.r * (1 - (f - 6) * .13), heat: .5 - (f - 6) * .05 }];
    }), .5, f);
    // dark airframe debris flung out, each with a smoke trail and a burning edge
    if (f >= 1 && f <= 9) for (const [i, b] of debris.entries()) {
      const at = s => [C + Math.cos(b.a) * (8 + travel(b.v, 4, s)), C + Math.sin(b.a) * (8 + travel(b.v, 4, s)) + 25 * s * s];
      const [x, y] = at(t), sp = (f + b.spin + i) % 4;
      if (f <= 7 && Math.hypot(x - cx, y - cy) < FR[f] * .95) continue;   // still inside the fireball
      for (const k of [2, 1]) { const [qx, qy] = at(Math.max(0, t - k * .035)); puff(p, qx, qy, 1.2 + k * .5, .45 - k * .12, .65); }
      const pix = [[0, 0, INK], [1, 0, METAL[1]], [sp < 2 ? 0 : 1, sp % 2 ? 1 : -1, METAL[3]], [-1, sp % 2 ? 0 : 1, INK]];
      for (const [dx, dy, c] of pix) p.px(x + dx, y + dy, c);
      p.px(x - Math.cos(b.a), y - Math.sin(b.a), FIRE[3 + (f % 2)]);
      p.glow(x, y, 3.5, FIRE[4], .3);
    }
    // embers: hot streaks on the burst, then falling sparks that flicker and go out (gone by frame 14)
    if (f >= 1) embers.forEach((e, i) => {
      const age = t - .04;
      if (age >= e.life) return;
      const d = 6 + travel(e.v, e.k, age), x = C + Math.cos(e.a) * d, y = C + Math.sin(e.a) * d + 30 * age * age - rise * .5;
      const r = Math.hypot(x - C, y - C);
      if (r > 72 || (f <= 5 && r < FR[f] * .9)) return;
      const h = 1 - age / e.life;
      if (age < .13) return streak(p, x, y, Math.cos(e.a), Math.sin(e.a), 2 + e.v * .018 * (1 - age * 5), h, .8);
      if (f >= 6 && rand(i, f, 5) < .2) return;
      const c = h > .6 ? FIRE[2] : h > .4 ? FIRE[3] : h > .2 ? FIRE[5] : FIRE[6];
      p.px(x, y, c); if (e.big) p.px(x + 1, y, h > .4 ? FIRE[4] : FIRE[6]);
      p.glow(x, y, 2.5, c, .35 * h);
    });
  });
}
// Frame 0: the white flash, an irregular white-hot core with a cream halo and spiked rays (not a disc).
function flash(p, C) {
  p.glow(C, C, 76, FIRE[1], .5);
  p.glow(C, C, 44, WHITE, .85);
  const R = new Rng(7);
  for (let k = 0; k < 10; k++) {
    const a = (k + R.range(-.25, .25)) / 10 * TAU, L = k % 2 ? R.range(32, 40) : R.range(44, 54);
    const ex = C + Math.cos(a) * L, ey = C + Math.sin(a) * L;
    p.beam(C, C, C + Math.cos(a) * L * .55, C + Math.sin(a) * L * .55, k % 2 ? 3 : 4, u => u < .6 ? WHITE : FIRE[1]);
    p.line(C + Math.cos(a) * L * .5, C + Math.sin(a) * L * .5, ex, ey, u => u < .45 ? FIRE[1] : u < .8 ? FIRE[2] : FIRE[3]);
    p.glowLine(C, C, ex, ey, 4, FIRE[2], .35);
  }
  p.shade(C - 32, C - 32, C + 32, C + 32, (x, y) => {
    const dx = x - C, dy = y - C, g = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy) / (1 + .24 * noise2(Math.cos(g) * 1.8 + 3, Math.sin(g) * 1.8, 21));
    return d < 11 ? WHITE : d < 18 ? FIRE[1] : d < 24 ? FIRE[2] : d < 27 ? FIRE[3] : 0;
  });
}

// ---------------- title_intro_fx_flak 48x48, 10 @14, once ----------------
// An 88 mm shell bursting: orange-red flash (0-1), then the trademark BLACK smoke ball with a dying orange rim
// (2), swelling into 3-4 lobes and drifting up-right 1 px a frame (3-5), tearing and greying (6-7), wisps (8-9).
function flakFrames() {
  const C = 24, R = new Rng(88);
  const lobes = Array.from({ length: 5 }, (_, i) => ({ a: (i + R.range(-.3, .3)) / 5 * TAU, d: R.range(.32, .48), r: R.range(.36, .46), s: R.range(-1, 1) }));
  const rays = Array.from({ length: 4 }, (_, i) => ({ a: (i + R.range(.1, .9)) / 4 * TAU, L: R.range(9, 13) }));
  const VIS = [7, 10, 12, 15, 17, 18.5, 19.5, 20, 20.5, 21];
  const A = [1, 1, 1, 1, 1, .95, .78, .66, .42, .2], T = [.9, .9, .9, .88, .88, .85, .78, .72, .62, .58];
  const TEAR = [0, 0, 0, 0, 0, 0, .22, .32, .45, .55];
  return frames(48, 48, 10, (p, f) => {
    const dr = Math.max(0, f - 2) * .5, cx = C + dr, cy = C - dr, S = VIS[f];
    const ring = (k, r, heat) => lobes.map(l => ({ x: cx + Math.cos(l.a) * l.d * S * k, y: cy + Math.sin(l.a) * l.d * S * k, r: l.r * S * r, heat }));
    if (f <= 1) {
      p.glow(C, C, 20, FIRE[3], f ? .4 : .65);
      if (!f) p.glow(C, C, 9, WHITE, .7);
      for (const r of rays) {
        const a = r.a + f * .15, L = r.L * (f ? 1.15 : .8);
        p.line(C + Math.cos(a) * 4, C + Math.sin(a) * 4, C + Math.cos(a) * L, C + Math.sin(a) * L, u => u < .5 ? FIRE[2] : FIRE[4]);
        p.line(C + Math.cos(a) * 4 + .7, C + Math.sin(a) * 4, C + Math.cos(a) * L * .8 + .7, C + Math.sin(a) * L * .8, FIRE[3]);
      }
    }
    if (f === 0) return flames(p, [{ x: C, y: C, r: 4.6, heat: 1 }, ...ring(.6, .62, .82)], .7);
    if (f === 1) {
      flames(p, ring(1, .62, .5), .6, 4);
      return smokeMass(p, [{ x: C + .5, y: C, r: 5.2, a: 1, tone: .9, warm: .9 }, { x: C - 1.5, y: C - 1.5, r: 3.4, a: 1, tone: .9, warm: .6 }], { seed: 31 });
    }
    if (f === 2) { p.glow(C, C, 16, FIRE[5], .25); flames(p, ring(1.05, .5, .3), .4, 9); }
    const balls = [{ x: cx + .5, y: cy + .5, r: S * .5, a: A[f], tone: T[f], warm: f === 2 ? .7 : 0 },
      ...lobes.map(l => {
        const a = l.a + l.s * .04 * f, d = l.d * S * (1 + Math.max(0, f - 5) * .05);
        return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: l.r * S, a: A[f], tone: T[f], warm: f === 2 ? .8 : f === 3 ? .35 : 0 };
      })];
    smokeMass(p, balls, { seed: 31, tear: TEAR[f], tearY: f * .2 });
  });
}

// ---------------- title_intro_fx_debris 24x24, 8 @16, loop ----------------
// A torn wing panel tumbling end over end: 45 degrees a frame and a flip every 4 frames (lit face / dark
// underside), a ripped edge with a panel seam, ink outline, sunlit rim top-left, a burning corner that leaves
// a curl of smoke. The view throws several, rotated and mirrored.
const PANEL = [[-5.5, -2], [-1, -3], [4.5, -2.5], [5.5, .5], [3, 1.5], [3.8, 2.8], [1, 2.2], [-.5, 3.2], [-4.5, 2]];
function debrisFrames() {
  const C = 12;
  const at = (f, [x, y]) => {
    const a = f * TAU / 8, s = Math.cos(f * TAU / 4) * .8 + (Math.cos(f * TAU / 4) >= 0 ? .2 : -.2);
    const yy = y * s;
    return [C + x * Math.cos(a) - yy * Math.sin(a), C + x * Math.sin(a) + yy * Math.cos(a)];
  };
  return frames(24, 24, 8, (p, f) => {
    const front = Math.cos(f * TAU / 4) >= 0, pts = PANEL.map(q => at(f, q));
    // smoke curling off the burning corner from the last frames
    for (const k of [3, 2, 1]) { const [x, y] = at(f - k, PANEL[3]); puff(p, x, y - k * .6, .9 + k * .45, .5 - k * .12, .62); }
    const inside = (x, y) => {
      let s = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s;
      }
      return s;
    };
    const m = (x, y) => x >= 0 && y >= 0 && x < 24 && y < 24 && inside(x + .5, y + .5);
    const [sx, sy] = at(f, [-5.5, .5]), [ex, ey] = at(f, [5.5, .5]);       // panel seam along the span
    // ink outline just outside the panel; inside: sunlit rim top-left, darker rim bottom-right, seam, face
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const nb = [m(x - 1, y), m(x, y - 1), m(x + 1, y), m(x, y + 1)];
      if (!m(x, y)) { if (nb.some(Boolean)) p.px(x, y, INK); continue; }
      const seam = Math.abs((ex - sx) * (y + .5 - sy) - (ey - sy) * (x + .5 - sx)) / Math.hypot(ex - sx, ey - sy) < .55;
      let c = front ? METAL[3] : METAL[1];
      if (seam) c = front ? METAL[2] : METAL[0];
      if (!nb[2] || !nb[3]) c = front ? METAL[2] : METAL[0];
      if (!nb[0] || !nb[1]) c = front ? METAL[4] : METAL[2];
      p.px(x, y, c);
    }
    // scorch and fire on the torn corner
    const [fx, fy] = at(f, PANEL[3]), [gx, gy] = at(f, [3.8, -.6]);
    p.px(gx, gy, SMOKE[5]);
    flames(p, [{ x: fx, y: fy, r: 1.6 + (f % 2) * .5, heat: .9 }, { x: fx, y: fy - 1.6, r: 1.1, heat: .7 }], .9, f);
    p.glow(fx, fy, 5, FIRE[3], .35 + (f % 2) * .1);
  });
}

// ---------------- title_intro_fx_fire_trail 64x32, 8 @16, loop ----------------
// A segment of a burning aircraft's trail: flame at the RIGHT end (fixed to the engine), its top edge licking up
// and back, cooling into black-brown smoke that widens 6 -> 16 px, greys and thins toward the left. Particles
// ride a phase that advances 1/8 a frame, so frame 8 is frame 0 again.
function fireTrailFrames() {
  const N = 22, R = new Rng(64);
  const parts = Array.from({ length: N }, (_, i) => ({ o: (i + R.range(0, .8)) / N, wy: R.range(-1, 1), wr: R.range(.85, 1.15) }));
  const sparks = Array.from({ length: 5 }, (_, i) => ({ o: i / 5 + R.range(0, .15), wy: R.range(-1, 1) }));
  const X = u => 57 - Math.pow(u, .85) * 60;
  return frames(64, 32, 8, (p, f) => {
    const ph = parts.map(q => ({ ...q, u: (q.o + f / 8) % 1 }));
    smokeMass(p, ph.filter(q => q.u > .1).map(q => {
      const u = q.u, x = X(u);
      return { x, y: 17 + q.wy * (1 + u * 2.5) - u * 3, r: (2.6 + u * 5) * q.wr, a: Math.min(1, .5 + x / 32), tone: .92 - u * .5, warm: clamp(1 - (u - .1) / .14) };
    }), { seed: 5, fade: x => clamp((x - 1) / 12) });
    p.glow(54, 16, 15, FIRE[3], .3);
    const flick = k => 1 + .1 * Math.sin(f * TAU / 4 + k);
    // root at the engine, then flame licks torn back and curling up off the top edge
    fireMass(p, [
      { x: 51, y: 17.5, r: 6 * flick(0), heat: .66 }, { x: 55.5, y: 17.5, r: 4 * flick(2), heat: .9 }, { x: 57.5, y: 17.5, r: 2.2, heat: 1 },
      ...ph.filter(q => q.u < .3).map(q => ({ x: X(q.u) - 1, y: 17 + q.wy * 1.5 - q.u * 26 * (q.wy > 0 ? .45 : 1), r: (5.2 - q.u * 11) * q.wr, heat: .78 - q.u * 1.7 })),
    ], { seed: f % 8, glow: 1.2 });
    for (const s of sparks) {
      const u = (s.o + f / 8) % 1, x = 52 - u * 34, y = 13 + s.wy * 3 - u * 6;
      if (u > .7) continue;
      const c = u < .3 ? FIRE[2] : u < .5 ? FIRE[4] : FIRE[6];
      p.px(x, y, c); p.glow(x, y, 2.5, c, .3 * (1 - u));
    }
  });
}

// ---------------- title_intro_fx_smoke_puff 32x32, 8 @10, once ----------------
// A black-grey puff left along a falling wreck's path: born with an ember inside, swells 6 -> 26 px, then greys,
// tears and thins out (5-7).
function smokePuffFrames() {
  const C = 16, R = new Rng(12);
  const lobes = Array.from({ length: 5 }, (_, i) => ({ a: (i + R.range(-.3, .3)) / 5 * TAU, d: R.range(.34, .44), r: R.range(.42, .52) }));
  const RAD = [3, 6, 8.5, 10.5, 11.8, 12.6, 13, 13.4], A = [1, 1, 1, .95, .85, .7, .45, .2];
  const T = [.9, .88, .86, .82, .74, .64, .56, .5], TEAR = [0, 0, 0, 0, 0, .2, .35, .5];
  return frames(32, 32, 8, (p, f) => {
    const S = RAD[f], cx = C, cy = C + 1 - f * .4;
    smokeMass(p, [{ x: cx + .5, y: cy + .5, r: S * .6, a: A[f], tone: T[f], warm: f < 2 ? .7 : 0 },
      ...lobes.map(l => ({ x: cx + Math.cos(l.a + f * .03) * l.d * S, y: cy + Math.sin(l.a + f * .03) * l.d * S, r: l.r * S, a: A[f], tone: T[f], warm: f < 2 ? .8 : 0 }))],
    { seed: 44, tear: TEAR[f], tearY: f * .25 });
    if (f === 0) { p.px(cx, cy + 1, FIRE[3]); p.glow(cx, cy + 1, 5, FIRE[4], .45); }
    if (f === 1) p.glow(cx, cy + 1, 4, FIRE[5], .2);
  });
}

// ---------------- title_intro_fx_sparks 32x32, 6 @20, once ----------------
// Rounds striking metal: a white star flash (0), 8 sparks shooting out and cooling white -> orange -> red (1-3),
// red embers dropping and going out with a wisp of grey (4-5).
function sparksFrames() {
  const C = 16, R = new Rng(23);
  const rays = Array.from({ length: 8 }, (_, i) => ({ a: (i + R.range(-.35, .35)) / 8 * TAU, v: R.range(50, 82), len: R.range(3, 6) }));
  return frames(32, 32, 6, (p, f) => {
    const t = f / 20;
    p.glow(C, C, 13, FIRE[2], .75 * Math.exp(-f / 1.1));
    if (f === 0) { sparkle(p, C, C, 4, FIRE[1], FIRE[3], .6); p.glow(C, C, 7, WHITE, .7); return; }
    if (f >= 2) puff(p, C + 1, C - 1 - f * .6, 1.4 + f * .5, .5 * (1 - f / 6.5), .55);
    if (f === 1) sparkle(p, C, C, 2, FIRE[2], FIRE[4], .4);
    rays.forEach((r, i) => {
      const d = 2 + travel(r.v, 5, t), ux = Math.cos(r.a), uy = Math.sin(r.a), x = C + ux * d, y = C + uy * d + 40 * t * t;
      if (f <= 3) return streak(p, x, y, ux, uy, r.len * (1 - (f - 1) * .2), 1 - (f - 1) * .3, 1.2);
      if ((f === 5 && i % 2) || Math.hypot(x - C, y - C) > 14) return;
      const c = f === 4 ? FIRE[5] : FIRE[7];
      p.px(x, y, c); p.glow(x, y, 2.5, c, f === 4 ? .3 : .15);
    });
  });
}

// ---------------- title_intro_fx_tracer_head 24x24, 4 @16, loop ----------------
// A tracer round flying straight at the camera: white-hot head (~4 px, centred on the canvas) in an amber halo,
// a short tail trailing to the LEFT (the view rotates it to the direction of travel and scales it up as it
// flies out). The halo and tail flicker; the view grows it.
function tracerHeadFrames() {
  const X = 12, Y = 12;
  return frames(24, 24, 4, (p, f) => {
    const pulse = [0, 1, .4, 1.4][f], tail = [6, 7, 6, 8][f];
    p.glow(X, Y, 9.5 + pulse, FIRE[4], .5);
    p.glow(X, Y, 5, FIRE[1], .55);
    p.glowLine(X - tail, Y, X, Y, 3, FIRE[4], .3);
    p.beam(X - tail, Y, X - 1, Y, 2, u => u < .35 ? FIRE[5] : u < .7 ? FIRE[3] : FIRE[2]);
    p.circle(X, Y, 2.6 + (f % 2) * .3, d => d < .55 ? WHITE : FIRE[1]);
  });
}

// ---------------- title_intro_fx_speed_radial 480x270, 4 @20, loop ----------------
// Air rushing past the chase camera: faint streaks flying out from the centre (clear inside ~60 px), lengthening
// toward the edges. Each streak moves 1/4 or 2/4 of its path a frame, so the 4 frames loop.
function speedRadialFrames() {
  const W = 480, Hh = 270, CX = 240, CY = 135, RM = Math.hypot(CX, CY) + 40, R = new Rng(31);
  const lines = Array.from({ length: 64 }, () => ({ a: R.range(0, TAU), o: R.next(), len: R.range(30, 80), al: R.range(.12, .25), step: R.int(1, 2) }));
  return frames(W, Hh, 4, (p, f) => {
    for (const l of lines) {
      const u = (l.o + f * l.step / 4) % 1, r0 = 60 + u * (RM - 60), r1 = r0 + l.len * (.55 + u * .7);
      const ca = Math.cos(l.a), sa = Math.sin(l.a), a = l.al * Math.min(1, (r0 - 60) / 50 + .2);
      softLine(p, CX + ca * r0, CY + sa * r0, CX + ca * r1, CY + sa * r1, AIR, a);
      if (u > .55) softLine(p, CX + ca * r0 - sa, CY + sa * r0 + ca, CX + ca * r1 - sa, CY + sa * r1 + ca, AIR, a * .45);
    }
  }, 6);
}

// ---------------- title_intro_fx_speed_side 480x270, 4 @20, loop ----------------
// Side-on speed: faint horizontal streaks rushing LEFT, three speeds (120/240/360 px a frame, so 4 frames loop
// across 480 px), thinner and fainter through the middle band where the fighter sits.
function speedSideFrames() {
  const W = 480, R = new Rng(57);
  const lines = Array.from({ length: 48 }, () => ({ y: R.range(4, 266), x: R.range(0, W), len: R.range(30, 80) * (R.chance(.2) ? 1.6 : 1), al: R.range(.12, .25), step: R.int(1, 3), thick: R.chance(.25) }));
  return frames(W, 270, 4, (p, f) => {
    for (const l of lines) {
      const x = ((l.x - f * l.step * 120) % W + W) % W, band = l.y > 95 && l.y < 175 ? .5 : 1, a = l.al * band;
      for (const o of [0, -W, W]) {
        if (x + o > W || x + o + l.len < 0) continue;
        softLine(p, x + o, l.y, x + o + l.len, l.y, AIR, a);
        if (l.thick && band === 1) softLine(p, x + o + l.len * .15, l.y + 1, x + o + l.len * .85, l.y + 1, AIR, a * .5);
      }
    }
  }, 6);
}

// ---------------- title_intro_fx_wisp 240x90, 1 frame ----------------
// A thin veil of cloud whipping past the camera: three overlapping tilted sheets, torn by stretched noise,
// sunlit along the top, a cool grey underside; alpha 25-45 %, edges fade softly to nothing.
const WISP = [{ x: 92, y: 46, rx: 84, ry: 22, k: 1 }, { x: 150, y: 40, rx: 76, ry: 18, k: .85 }, { x: 128, y: 56, rx: 60, ry: 14, k: .7 }];
function wispFrame() {
  const dens = (x, y) => {
    let m = 0;
    for (const e of WISP) {
      const dx = (x - e.x) / e.rx, dy = (y - e.y + (x - e.x) * .1) / e.ry;   // tilted ~6 degrees, rising right
      m = Math.max(m, clamp(1 - dx * dx - dy * dy) * e.k);
    }
    const n = fbm(x * .022, y * .075, 11) * .5 + .5, streak = fbm(x * .006, y * .22, 4) * .5 + .5;
    return clamp(m * 1.5 * (.3 + n) * (.6 + .6 * streak) - .2);
  };
  return paint(240, 90, p => soft(p, 0, 0, 240, 90, (x, y) => {
    const d = dens(x, y);
    if (d <= .01) return;
    const up = dens(x, y - 4), dn = dens(x, y + 4);
    const c = up < d - .1 ? CLOUD[4] : dn < d - .1 ? CLOUD[2] : CLOUD[3];
    const s = Math.min(1, d / .55), edge = clamp(Math.min(x, 240 - x) / 20) * clamp(Math.min(y, 90 - y) / 10);
    return [c, .45 * s * s * (3 - 2 * s) * edge];
  }), 6);
}

function build(add) {
  add('Title', 'title_intro_fx_explosion', explosionFrames(), { fps: 16, loop: false });
  add('Title', 'title_intro_fx_flak', flakFrames(), { fps: 14, loop: false });
  add('Title', 'title_intro_fx_debris', debrisFrames(), { fps: 16, loop: true });
  add('Title', 'title_intro_fx_fire_trail', fireTrailFrames(), { fps: 16, loop: true });
  add('Title', 'title_intro_fx_smoke_puff', smokePuffFrames(), { fps: 10, loop: false });
  add('Title', 'title_intro_fx_sparks', sparksFrames(), { fps: 20, loop: false });
  add('Title', 'title_intro_fx_tracer_head', tracerHeadFrames(), { fps: 16, loop: true });
  add('Title', 'title_intro_fx_speed_radial', speedRadialFrames(), { fps: 20, loop: true });
  add('Title', 'title_intro_fx_speed_side', speedSideFrames(), { fps: 20, loop: true });
  add('Title', 'title_intro_fx_wisp', [wispFrame()], { fps: 1 });
}

module.exports = {
  build, explosionFrames, flakFrames, debrisFrames, fireTrailFrames, smokePuffFrames, sparksFrames,
  tracerHeadFrames, speedRadialFrames, speedSideFrames, wispFrame,
};

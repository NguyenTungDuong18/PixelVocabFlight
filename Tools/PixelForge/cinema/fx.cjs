'use strict';
// Transparent pass of the title cinematic. Primitives live in world space and are drawn far to near:
//   s  smoke puff   { p, r, a, tone 0 light..1 black, seed }      soft lit disc; also hides fire behind it
//   f  fire blob    { p, r, h }                                    adds to the heat buffer (post.cjs maps heat -> fire ramp)
//   g  glow         { p, r, c, i, nodepth }                        additive light
//   l  streak       { a, b, c, i, w }                              additive line with a hot core (tracers, sparks)
//   t  trail        { a, b, w (m), c, a0, a1 }                     soft alpha ribbon (contrails, wing-tip vapour)
//   d  shard        { p, r, rot, c }                               small opaque piece of wreckage
//   o  ring         { p, r, a }                                    thin additive ring (shock wave)
// The second half is the effect library: every effect is a pure function of time (no state), so any
// frame can be rendered on its own and the loop at the end of the film can repeat exactly.
const C = require('./core.cjs');
const { W, H, clamp, noise3, RAMP, rampAt, rnd, ih, TAU } = C;
const { SUN, FOG } = require('./sky.cjs');

const o3 = [0, 0, 0];
function draw(fr, cam, prims) {
  const { f, F, R, U } = cam, col = fr.col, zb = fr.z, heat = fr.heat, add = fr.add, hz = fr.haze;
  const lsx = C.dot(SUN, R), lsy = C.dot(SUN, U), back = Math.max(0, C.dot(SUN, F));
  const list = [];
  for (const q of prims) {
    if (q.k === 'l' || q.k === 't') { const a = cam.project(q.a), b = cam.project(q.b); if (a[2] < .5 && b[2] < .5) continue; q.sa = a; q.sb = b; q.z = (a[2] + b[2]) / 2; }
    else { const s = cam.project(q.p); if (s[2] < .3) continue; q.s = s; q.z = s[2]; q.rs = f * q.r / s[2]; if (q.s[0] + q.rs < 0 || q.s[0] - q.rs > W || q.s[1] + q.rs < 0 || q.s[1] - q.rs > H) continue; }
    list.push(q);
  }
  list.sort((a, b) => b.z - a.z);
  for (const q of list) {
    if (q.k === 's') {
      const cx = q.s[0], cy = q.s[1], rs = q.rs, z = q.z, fg = Math.min(.9, 1 - Math.exp(-z / FOG));
      if (rs < .6) { const x = Math.floor(cx), y = Math.floor(cy); if (x >= 0 && y >= 0 && x < W && y < H && z < zb[y * W + x]) { const j = (y * W + x) * 3, a = q.a * rs * 1.2 * (1 - fg * .5); rampAt(RAMP.smoke, (1 - q.tone) * .8 + .1, o3); col[j] += (o3[0] - col[j]) * a; col[j + 1] += (o3[1] - col[j + 1]) * a; col[j + 2] += (o3[2] - col[j + 2]) * a; } continue; }
      const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs)), y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs)), big = rs > 2.6, sd = q.seed || 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const ax = (x + .5 - cx) / rs, ay = (y + .5 - cy) / rs, d2 = ax * ax + ay * ay;
        if (d2 >= 1) continue;
        const i = y * W + x, dz = zb[i] - (z - q.r * .5);
        if (dz <= 0) continue;
        let a = q.a * (1 - d2) * Math.min(1, dz / (q.r * .6)), n = .5;
        if (big) { n = noise3(ax * 1.7 + sd, ay * 1.7 - sd * .3, sd * .71, 31) * .65 + noise3(ax * 4.1 + sd, ay * 4.1, sd, 33) * .35; a *= clamp(.25 + 1.7 * n - d2 * .5); }
        if (a < .012) continue;
        if (a > .96) a = .96;
        const L = (1 - q.tone) * .78 + .1 + (ax * lsx - ay * lsy) * .2 * (1.15 - q.tone * .5) + (n - .5) * .22 + back * d2 * .22;
        rampAt(RAMP.smoke, L, o3);
        const j = i * 3, wr = q.warm || 0;
        if (wr) { o3[0] += wr * .5; o3[1] += wr * .2; o3[2] += wr * .04; }
        o3[0] += (hz[j] - o3[0]) * fg; o3[1] += (hz[j + 1] - o3[1]) * fg; o3[2] += (hz[j + 2] - o3[2]) * fg;
        col[j] += (o3[0] - col[j]) * a; col[j + 1] += (o3[1] - col[j + 1]) * a; col[j + 2] += (o3[2] - col[j + 2]) * a;
        heat[i] *= 1 - a * .92; add[j] *= 1 - a * .8; add[j + 1] *= 1 - a * .8; add[j + 2] *= 1 - a * .8;
      }
    } else if (q.k === 'f') {
      const cx = q.s[0], cy = q.s[1], rs = Math.max(q.rs, .8), z = q.z, sd = q.seed || 0;
      const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs)), y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs)), big = rs > 2.2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const ax = (x + .5 - cx) / rs, ay = (y + .5 - cy) / rs, d2 = ax * ax + ay * ay;
        if (d2 >= 1) continue;
        const i = y * W + x; if (z - q.r * .6 > zb[i]) continue;
        let h = q.h * (1 - d2) * (1 - d2 * .5);
        if (big) h *= clamp(1.9 * (noise3(ax * 1.6 + sd, ay * 1.6 + sd * .5, sd * .3, 35) * .6 + noise3(ax * 4.2 - sd, ay * 4.2, sd, 37) * .4) - .12 - d2 * .3, 0, 1.4);
        heat[i] += h * Math.max(0, 1 - heat[i] / 1.7);
      }
    } else if (q.k === 'g') {
      const cx = q.s[0], cy = q.s[1], rs = Math.max(q.rs, 1), z = q.z;
      const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs)), y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + .5 - cx, y + .5 - cy) / rs; if (d >= 1) continue;
        const i = y * W + x; if (!q.nodepth && z - q.r > zb[i]) continue;
        const a = q.i * (1 - d) * (1 - d), j = i * 3; add[j] += q.c[0] * a; add[j + 1] += q.c[1] * a; add[j + 2] += q.c[2] * a;
      }
    } else if (q.k === 'l' || q.k === 't') {
      let a = q.sa, b = q.sb;
      if (a[2] < .5 || b[2] < .5) {                                // clip against the near plane in world space
        const va = cam.view(q.a), vb = cam.view(q.b), t = (.5 - va[2]) / (vb[2] - va[2]), m = [va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t, .5], sm = [W / 2 + f * m[0] / .5, H / 2 - f * m[1] / .5, .5];
        if (a[2] < .5) a = sm; else b = sm;
      }
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      if (n > 1400) continue;
      const ln = Math.hypot(dx, dy) || 1, nx = -dy / ln, ny = dx / ln;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = a[0] + dx * t, y = a[1] + dy * t, z = 1 / (1 / a[2] + (1 / b[2] - 1 / a[2]) * t);
        if (q.k === 'l') {
          const hw = Math.min(3, (q.w || 1) * .5 + (q.wm ? q.wm * f / z * .5 : 0));
          for (let e = -Math.ceil(hw); e <= Math.ceil(hw); e++) {
            const px = Math.floor(x + nx * e), py = Math.floor(y + ny * e); if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const i = py * W + px; if (z > zb[i]) continue;
            const w = q.i * (e === 0 ? 1 : clamp(1 - Math.abs(e) / (hw + .6)) * .55) * (q.taper ? .35 + .65 * t : 1), j = i * 3, bl = Math.min(1, w * .85);
            col[j] += (q.c[0] * 1.15 - col[j]) * bl; col[j + 1] += (q.c[1] * 1.15 - col[j + 1]) * bl; col[j + 2] += (q.c[2] * 1.15 - col[j + 2]) * bl;
            add[j] += q.c[0] * w * .3; add[j + 1] += q.c[1] * w * .3; add[j + 2] += q.c[2] * w * .3;
            if (e === 0 && q.core) { add[j] += q.core * t; add[j + 1] += q.core * t * .9; add[j + 2] += q.core * t * .6; }
          }
        } else {
          const hw = q.w * f / z * .5, al = (q.a0 + (q.a1 - q.a0) * t) * Math.min(1, hw * 2), fg = Math.min(.9, 1 - Math.exp(-z / FOG)), span = Math.max(0, Math.ceil(hw - .5));
          for (let e = -span; e <= span; e++) {
            const px = Math.floor(x + nx * e), py = Math.floor(y + ny * e); if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const i = py * W + px; if (z > zb[i]) continue;
            const j = i * 3, w = al * (span ? 1 - Math.abs(e) / (span + 1) * .7 : 1) * (1 - fg * .6);
            col[j] += (q.c[0] + (hz[j] - q.c[0]) * fg - col[j]) * w; col[j + 1] += (q.c[1] + (hz[j + 1] - q.c[1]) * fg - col[j + 1]) * w; col[j + 2] += (q.c[2] + (hz[j + 2] - q.c[2]) * fg - col[j + 2]) * w;
          }
        }
      }
    } else if (q.k === 'd') {
      const cx = q.s[0], cy = q.s[1], rs = Math.max(q.rs, .5), z = q.z, cr = Math.cos(q.rot || 0), sr = Math.sin(q.rot || 0), asp = q.asp || .45, c = q.c || [.08, .08, .1];
      const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs)), y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const ax = x + .5 - cx, ay = y + .5 - cy, u = ax * cr + ay * sr, v = -ax * sr + ay * cr;
        if (Math.abs(u) > rs || Math.abs(v) > Math.max(.5, rs * asp)) continue;
        const i = y * W + x; if (z > zb[i]) continue;
        const j = i * 3, k = v < 0 ? 1.7 : 1; col[j] = c[0] * k; col[j + 1] = c[1] * k; col[j + 2] = c[2] * k; heat[i] *= .1;
      }
    } else if (q.k === 'o') {
      const cx = q.s[0], cy = q.s[1], rs = q.rs, n = Math.ceil(rs * 6.3);
      for (let k = 0; k < n; k++) {
        const an = k / n * TAU, x = Math.floor(cx + Math.cos(an) * rs), y = Math.floor(cy + Math.sin(an) * rs * .92); if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = (y * W + x) * 3; add[j] += q.a; add[j + 1] += q.a * .95; add[j + 2] += q.a * .85;
      }
    }
  }
}

// ---------------------------------------------------------------- effect library
const dirOf = (i, s) => { const z = rnd(i, s) * 2 - 1, a = rnd(i, s + 1) * TAU, r = Math.sqrt(1 - z * z); return [Math.cos(a) * r, Math.sin(a) * r, z]; };
const FIREC = [1, .62, .2], G = -9.8;

// Mid-air explosion at p, started `tau` seconds ago; R = fireball radius (m); vel = drift of the wreck.
// out: { fx, lights }. Phases: white flash (2-3 frames) -> fireball lobes racing out and slowing -> lobes
// cool into rolling black smoke -> sparks and burning pieces on ballistic arcs trailing smoke -> shock ring.
function explosion(out, tau, p, R, seed = 1, vel = [0, 0, 0], o = {}) {
  if (tau < 0 || tau > (o.life || 6)) return;
  const life = o.life || 6, base = C.mad(p, vel, tau * Math.exp(-tau * .5));
  if (tau < .14) {
    const k = (1 - tau / .14) * (o.flash === undefined ? 1 : o.flash);
    out.fx.push({ k: 'g', p: base, r: R * 3.6, c: [1, .8, .5], i: .7 * k, nodepth: true }, { k: 'g', p: base, r: R * 1.3, c: [1, 1, .95], i: 1.1 * k, nodepth: true });
  }
  if (tau < 1.6) out.lights.push({ p: base, c: [1.1, .5, .14], i: 1.4 * Math.exp(-tau * 2.4), r: R * 22 });
  const nl = o.lobes || 12;
  for (let i = 0; i < nl; i++) {
    const d = dirOf(i, seed * 7), sp = .45 + .75 * rnd(i, seed + 3), grow = 1 - Math.exp(-tau * 8);
    const c = [base[0] + d[0] * R * sp * grow * 1.15, base[1] + d[1] * R * sp * grow * 1.15, base[2] + d[2] * R * sp * grow * .95 + tau * tau * 2.2 + tau * 3];
    const r = R * (.42 + .34 * rnd(i, seed + 5)) * (1 - Math.exp(-tau * 11)) * (1 + .35 * tau), h = 1.05 * Math.exp(-tau * (2.1 + 1.6 * rnd(i, seed + 6))) * (.75 + .5 * rnd(i, seed + 8));
    if (h > .05) out.fx.push({ k: 'f', p: c, r: r * 1.05, h, seed: seed * 3.3 + i + tau * 2.2 });
    const sa = C.sstep(.1, .55, tau) * .9 * Math.pow(Math.max(0, 1 - tau / life), 1.25);
    if (sa > .02) out.fx.push({ k: 's', p: [c[0] + d[0] * R * .25 * tau, c[1] + d[1] * R * .25 * tau, c[2] + tau * 2.5], r: r * (1.05 + .34 * tau), a: sa, tone: .97 - .25 * Math.min(1, tau / 3), seed: seed * 1.7 + i * 2.1 + tau * .35, warm: .5 * Math.exp(-tau * 2) });
  }
  if (tau < .5) out.fx.push({ k: 'f', p: base, r: R * (.5 + tau * 2.2), h: 1.5 * Math.exp(-tau * 7), seed: seed + tau * 5 });
  const ns = o.sparks === undefined ? 22 : o.sparks;                // sparks: fast, short lived
  for (let i = 0; i < ns; i++) {
    const d = dirOf(i, seed * 11 + 2), v = R * (9 + 14 * rnd(i, seed + 9)), lf = .45 + .5 * rnd(i, seed + 10); if (tau > lf) continue;
    const at = t => { const s = v * (1 - Math.exp(-t * 3)) / 3; return [base[0] + d[0] * s, base[1] + d[1] * s, base[2] + d[2] * s + .5 * G * t * t]; };
    out.fx.push({ k: 'l', a: at(Math.max(0, tau - .035)), b: at(tau), c: FIREC, i: 1.5 * (1 - tau / lf), core: .9 * (1 - tau / lf), w: 1 });
  }
  const nd = o.debris === undefined ? 7 : o.debris;                 // burning pieces with smoke tails
  for (let i = 0; i < nd; i++) {
    const d = dirOf(i, seed * 13 + 5), v = R * (2.6 + 3.4 * rnd(i, seed + 12)), lf = 2.2 + 1.8 * rnd(i, seed + 13);
    const at = t => { const s = v * (1 - Math.exp(-t * 1.1)) / 1.1; return [p[0] + vel[0] * t + d[0] * s, p[1] + vel[1] * t + d[1] * s, p[2] + vel[2] * t + (d[2] * .7 + .35) * s + .5 * G * t * t]; };
    if (tau < lf) {
      const q = at(tau), k = 1 - tau / lf;
      out.fx.push({ k: 'd', p: q, r: R * (.1 + .12 * rnd(i, seed + 14)), rot: tau * (4 + 9 * rnd(i, seed + 15)) + i, c: [.07, .07, .09] });
      out.fx.push({ k: 'f', p: q, r: R * .2 * (.6 + k), h: 1.3 * k, seed: i + tau * 9 });
    }
    for (let j = 0; j < 16; j++) {                                  // the tail: puffs left behind along the arc
      const te = tau - j * .055 - .02, age = tau - te; if (te < 0 || te > lf) continue;
      const q = at(te), a = .62 * Math.pow(1 - age / .95, 1.2) * (1 - te / lf); if (a < .03) continue;
      out.fx.push({ k: 's', p: [q[0], q[1], q[2] + age * 2], r: R * (.1 + .42 * age), a, tone: .9, seed: i * 5 + j, warm: j < 3 ? .5 : 0 });
    }
  }
}
// Heavy flak burst: 2-frame orange flash, a knot of black puffs that jumps out and then hangs, drifting and greying.
function flak(out, tau, p, seed = 1, size = 1, life = 7) {
  if (tau < 0 || tau > life) return;
  if (tau < .09) { const k = 1 - tau / .09; out.fx.push({ k: 'g', p, r: 11 * size, c: [1, .7, .3], i: .9 * k, nodepth: true }, { k: 'g', p, r: 3 * size, c: [1, .95, .8], i: 1.2 * k, nodepth: true }); out.lights.push({ p, c: [1, .6, .25], i: 1.2 * k, r: 160 * size }); }
  const fade = Math.pow(1 - tau / life, .9);
  for (let i = 0; i < 7; i++) {
    const d = dirOf(i, seed * 17 + 1), e = (7.5 * (1 - Math.exp(-tau * 11)) + .9 * tau) * size * (.5 + .7 * rnd(i, seed + 2));
    out.fx.push({ k: 's', p: [p[0] + d[0] * e + tau * 2.5, p[1] + d[1] * e, p[2] + d[2] * e * .8 + tau * .8], r: (4.2 * (1 - Math.exp(-tau * 13)) + .75 * tau) * size * (.75 + .5 * rnd(i, seed + 3)), a: .93 * fade, tone: 1 - .22 * Math.min(1, tau / 4), seed: seed * 2.3 + i });
  }
  if (tau < .3) for (let i = 0; i < 6; i++) { const d = dirOf(i, seed * 19 + 4), s0 = 70 * size * Math.max(0, tau - .04), s1 = 70 * size * tau; out.fx.push({ k: 'l', a: C.mad(p, d, s0), b: C.mad(p, d, s1), c: FIREC, i: 1.1 * (1 - tau / .3), w: 1 }); }
}
// Smoke left along a path: path(te) is where the source was at time te (the air stands still).
// o: { from, rate (puffs/s), life, r0, grow, tone, a, rise, spread, seed, warm }
function smokeTrail(out, path, t, o) {
  const rate = o.rate || 24, life = o.life || 4, k1 = Math.floor(Math.min(t, o.to === undefined ? t : o.to) * rate), k0 = Math.ceil(Math.max(o.from || 0, t - life) * rate);
  for (let k = k1; k >= k0; k--) {
    const te = k / rate, age = t - te, q = path(te), sp = (o.spread || 1.6) * age, sd = (o.seed || 0) * 31 + k;
    const a = (o.a || .8) * Math.pow(1 - age / life, o.pow || 1.3) * Math.min(1, age * rate * .7 + .35);
    if (a < .025) continue;
    out.fx.push({ k: 's', p: [q[0] + (rnd(sd, 1) - .5) * sp, q[1] + (rnd(sd, 2) - .5) * sp, q[2] + (rnd(sd, 3) - .5) * sp + (o.rise || 1.5) * age], r: (o.r0 || 1.2) + (o.grow || 2.4) * Math.pow(age, .75), a, tone: o.tone === undefined ? .95 : o.tone, seed: sd * .37, warm: o.warm && age < .25 ? o.warm * (1 - age / .25) : 0 });
  }
}
// Fire streaming back from a burning engine at p (back = unit vector downstream).
function fireJet(out, p, back, size, t, seed = 1, power = 1) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ph = (t * 3.1 + i / n + rnd(i, seed) * .2) % 1, w = size * ph * 1.1;
    out.fx.push({ k: 'f', p: [p[0] + back[0] * ph * size * 3.4 + (rnd(i, seed + 4) - .5) * w, p[1] + back[1] * ph * size * 3.4 + (rnd(i, seed + 5) - .5) * w, p[2] + back[2] * ph * size * 3.4 + (rnd(i, seed + 6) - .5) * w + ph * size * .5],
      r: size * (1.15 - ph * .65), h: .95 * power * Math.pow(1 - ph, 1.1) + .1, seed: seed * 5 + i + Math.floor(t * 30) * .7 });
  }
  out.fx.push({ k: 'g', p, r: size * 4, c: FIREC, i: .22 * power * (.8 + .4 * rnd(Math.floor(t * 30), seed)), nodepth: false });
  out.lights.push({ p, c: [1.05, .55, .18], i: .9 * power * (.8 + .4 * rnd(Math.floor(t * 30), seed)), r: size * 22 });
}
// A gun firing from t0 to t1: muzzle(te) -> world position, aim(te) -> unit direction, vel(te) -> shooter velocity.
// Tracers fly on from where they left the gun; reach = distance at which they burn out or strike. colour 0 ours (orange-red), 1 theirs (pale green).
const TRACER = [[[1, .36, .12], .38], [[.45, 1, .5], .28]];
function tracers(out, t, t0, t1, muzzle, aim, o = {}) {
  const rate = o.rate || 13, speed = o.speed || 620, rf = typeof o.reach === 'function' ? o.reach : null, reach = rf ? (o.maxReach || 900) : (o.reach || 700), len = o.len || 13, [col, core] = TRACER[o.colour || 0];
  const k0 = Math.ceil(Math.max(t0, t - reach / speed) * rate), k1 = Math.floor(Math.min(t, t1) * rate);
  for (let k = k0; k <= k1; k++) {
    const te = k / rate + (o.phase || 0) / rate, age = t - te; if (age < 0 || te < t0) continue;
    const d0 = aim(te), sd = (o.seed || 0) * 13 + k, sp = o.spread === undefined ? .008 : o.spread;
    const d = C.norm([d0[0] + (rnd(sd, 1) - .5) * sp, d0[1] + (rnd(sd, 2) - .5) * sp, d0[2] + (rnd(sd, 3) - .5) * sp]), m = muzzle(te), dist = speed * age;
    if (dist > (rf ? rf(te) : reach)) continue;
    const head = C.mad(m, d, dist), tail = C.mad(m, d, Math.max(0, dist - len));
    out.fx.push({ k: 'l', a: tail, b: head, c: col, i: (o.i || .95), core: core, w: 1, wm: o.wm || .22, taper: true });
  }
  if (t >= t0 && t <= t1 && o.flash !== false && Math.floor(t * 30 + (o.seed || 0)) % 2 === 0) {
    const m = muzzle(t);
    out.fx.push({ k: 'g', p: m, r: o.flashR || 1, c: [1, .8, .45], i: 1 }, { k: 'f', p: C.mad(m, aim(t), .4), r: (o.flashR || 1) * .42, h: 1.5 });
    out.lights.push({ p: m, c: [1, .75, .4], i: .8, r: 14 });
  }
}
// Rounds striking metal at p: a flash, sparks, a few chips.
function hit(out, tau, p, seed = 1, size = 1, vel = [0, 0, 0]) {
  if (tau < 0 || tau > .5) return;
  if (tau < .1) { const k = 1 - tau / .1; out.fx.push({ k: 'g', p, r: 2.2 * size, c: [1, .85, .55], i: 1.5 * k }, { k: 'f', p, r: .8 * size, h: 1.8 * k }); }
  for (let i = 0; i < 7; i++) {
    const d = dirOf(i, seed * 23), v = (22 + 30 * rnd(i, seed)) * size, lf = .2 + .25 * rnd(i, seed + 1); if (tau > lf) continue;
    const at = t => [p[0] + vel[0] * t * .6 + d[0] * v * t, p[1] + vel[1] * t * .6 + d[1] * v * t, p[2] + vel[2] * t * .6 + d[2] * v * t + .5 * G * t * t];
    out.fx.push({ k: 'l', a: at(Math.max(0, tau - .03)), b: at(tau), c: FIREC, i: 1.3 * (1 - tau / lf), core: .6, w: 1 });
  }
  if (tau > .03) out.fx.push({ k: 's', p: C.mad(p, vel, tau * .4), r: (.6 + 3 * tau) * size, a: .5 * (1 - tau / .5), tone: .7, seed });
}
// Condensation trail behind an aircraft flying straight: a ribbon from the tail back along -dir.
function contrail(out, tail, dir, length, width, alpha = .3, c = [1, .86, .8]) {
  const mid = C.mad(tail, dir, -length * .12);
  out.fx.push({ k: 't', a: tail, b: mid, w: width * .5, c, a0: 0, a1: alpha }, { k: 't', a: mid, b: C.mad(tail, dir, -length), w: width, c, a0: alpha, a1: 0 });
}

module.exports = { draw, explosion, flak, smokeTrail, fireJet, tracers, hit, contrail, dirOf };

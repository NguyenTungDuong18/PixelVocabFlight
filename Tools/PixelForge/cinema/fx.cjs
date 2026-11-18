'use strict';
// Transparent pass of the title cinematic. Primitives live in world space and are drawn far to near:
//   s  smoke puff   { p, r, a, tone 0 light..1 black, seed, warm, core, bot, hollow, c }
//                   soft lit disc; also hides fire behind it. core: red glow in the middle (fire inside the smoke),
//                   bot: orange light on the underside (fire below), hollow: a shell (condensation), c: fixed colour
//   f  fire blob    { p, r, h, mx }                                adds to the heat buffer (post.cjs maps heat -> fire ramp); mx: max-blend (billows stay apart)
//   k  flame tongue { a, b, ra, rb, h, seed }                      tapered capsule of heat from a (radius ra) to b (radius rb)
//   g  glow         { p, r, c, i, nodepth }                        additive light
//   l  streak       { a, b, c, i, w }                              additive line with a hot core (tracers, sparks, embers)
//   t  trail        { a, b, w (m), c, a0, a1 }                     soft alpha ribbon (contrails, wing-tip vapour, fuel spray)
//   d  shard        { p, r, rot, c, asp }                          small opaque piece of wreckage
//   o  ring         { p, r, a, w (px), c }                         additive ring (shock wave)
//   w  refraction   { p, r, w (m), a (px) }                        heat haze / shock ring bending what is behind it
//   h  lens streak  { p, len (px), a, c }                          horizontal anamorphic line through a blast (screen space)
// The second half is the effect library: every effect is a pure function of time (no state), so any
// frame can be rendered on its own and the loop at the end of the film can repeat exactly.
const C = require('./core.cjs');
const { W, H, clamp, noise3, RAMP, rampAt, rnd, ih, TAU } = C;
const { SUN, FOG } = require('./sky.cjs');

const o3 = [0, 0, 0];
const WARP = new Float32Array(W * H * 3);
function draw(fr, cam, prims) {
  const { f, F, R, U } = cam, col = fr.col, zb = fr.z, heat = fr.heat, add = fr.add, hz = fr.haze;
  const lsx = C.dot(SUN, R), lsy = C.dot(SUN, U), back = Math.max(0, C.dot(SUN, F));
  const list = [];
  for (const q of prims) {
    if (q.k === 'l' || q.k === 't' || q.k === 'k') { const a = cam.project(q.a), b = cam.project(q.b); if (a[2] < .5 && b[2] < .5) continue; if (q.k === 'k' && (a[2] < .5 || b[2] < .5)) continue; q.sa = a; q.sb = b; q.z = (a[2] + b[2]) / 2; }
    else { const s = cam.project(q.p); if (s[2] < .3) continue; q.s = s; q.z = s[2]; q.rs = f * (q.r || 0) / s[2]; const m = q.k === 'h' ? q.len : q.k === 'w' ? q.rs + f * q.w / s[2] + 2 : q.rs; if (q.s[0] + m < 0 || q.s[0] - m > W || q.s[1] + m < 0 || q.s[1] - m > H) continue; }
    list.push(q);
  }
  list.sort((a, b) => b.z - a.z);
  for (const q of list) {
    if (q.k === 's') {
      const cx = q.s[0], cy = q.s[1], rs = q.rs, z = q.z, fg = Math.min(.9, 1 - Math.exp(-z / FOG));
      if (rs < .6) { if (q.hollow) continue; const x = Math.floor(cx), y = Math.floor(cy); if (x >= 0 && y >= 0 && x < W && y < H && z < zb[y * W + x]) { const j = (y * W + x) * 3, a = q.a * rs * 1.2 * (1 - fg * .5); rampAt(RAMP.smoke, (1 - q.tone) * .8 + .1, o3); col[j] += (o3[0] - col[j]) * a; col[j + 1] += (o3[1] - col[j + 1]) * a; col[j + 2] += (o3[2] - col[j + 2]) * a; } continue; }
      const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs)), y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs)), big = rs > 2.6, sd = q.seed || 0;
      const wr = q.warm || 0, cr = q.core || 0, bt = q.bot || 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const ax = (x + .5 - cx) / rs, ay = (y + .5 - cy) / rs, d2 = ax * ax + ay * ay;
        if (d2 >= 1) continue;
        const i = y * W + x, dz = zb[i] - (z - q.r * .5);
        if (dz <= 0) continue;
        const prof = q.hollow ? Math.max(0, 1 - Math.abs(Math.sqrt(d2) - .78) / .22) : 1 - d2;
        let a = q.a * prof * Math.min(1, dz / (q.r * .6)), n = .5;
        if (big) { n = noise3(ax * 1.7 + sd, ay * 1.7 - sd * .3, sd * .71, 31) * .65 + noise3(ax * 4.1 + sd, ay * 4.1, sd, 33) * .35; a *= clamp(.25 + 1.7 * n - d2 * .5); }
        if (a < .012) continue;
        if (a > .96) a = .96;
        const L = (1 - q.tone) * .78 + .1 + (ax * lsx - ay * lsy) * .2 * (1.15 - q.tone * .5) + (n - .5) * .22 + back * d2 * .22;
        if (q.c) { const k = .85 + (L - .5) * .3; o3[0] = q.c[0] * k; o3[1] = q.c[1] * k; o3[2] = q.c[2] * k; } else rampAt(RAMP.smoke, L, o3);
        const j = i * 3;
        if (wr) { o3[0] += wr * .5; o3[1] += wr * .2; o3[2] += wr * .04; }
        if (cr) { const k = cr * (1 - d2) * (.6 + .8 * n); o3[0] += k * .44; o3[1] += k * .14; o3[2] += k * .04; }
        if (bt && ay > -.3) { const k = bt * Math.min(1, (ay + .3) * 1.1) * (.7 + .6 * n); o3[0] += k * .62; o3[1] += k * .26; o3[2] += k * .06; }
        o3[0] += (hz[j] - o3[0]) * fg; o3[1] += (hz[j + 1] - o3[1]) * fg; o3[2] += (hz[j + 2] - o3[2]) * fg;
        col[j] += (o3[0] - col[j]) * a; col[j + 1] += (o3[1] - col[j + 1]) * a; col[j + 2] += (o3[2] - col[j + 2]) * a;
        if (!q.hollow) { heat[i] *= 1 - a * .92; add[j] *= 1 - a * .8; add[j + 1] *= 1 - a * .8; add[j + 2] *= 1 - a * .8; }
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
        if (q.mx) heat[i] = Math.max(heat[i], h) + Math.min(heat[i], h) * q.mx; else heat[i] += h * Math.max(0, 1 - heat[i] / 1.7);   // mx: billows keep their own hot middles
      }
    } else if (q.k === 'k') {
      const A = q.sa, B = q.sb, ra = Math.max(.7, f * q.ra / A[2]), rb = Math.max(.5, f * q.rb / B[2]), sd = q.seed || 0;
      const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1e-6, mr = Math.max(ra, rb);
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0]) - mr)), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0]) + mr)), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1]) - mr)), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1]) + mr));
      if ((x1 - x0) * (y1 - y0) > W * H) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + .5 - A[0], py = y + .5 - A[1], t = clamp((px * dx + py * dy) / L2), ex = px - dx * t, ey = py - dy * t, r0 = ra + (rb - ra) * t;
        const rr = r0 > 3 ? r0 * (.72 + .56 * noise3(px / r0 * 1.3 + sd, py / r0 * 1.3, sd * .5, 41)) : r0, d2 = (ex * ex + ey * ey) / (rr * rr);   // ragged edge when close
        if (d2 >= 1) continue;
        const i = y * W + x, z = A[2] + (B[2] - A[2]) * t; if (z - rr * z / f * .6 > zb[i]) continue;
        let h = q.h * (1 - d2) * (1 - .45 * t);
        if (rr > 1.6) h *= clamp(1.7 * noise3(ex / rr * 1.4 + sd, t * 3.2 - sd * .5, sd * .37, 39) - .2, 0, 1.3);
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
        if (Math.abs(u) > rs || Math.abs(v) > Math.max(.5, rs * asp * (1 - .35 * Math.abs(u) / rs))) continue;
        const i = y * W + x; if (z > zb[i]) continue;
        const j = i * 3, k = v < 0 ? 1.7 : 1; col[j] = c[0] * k; col[j + 1] = c[1] * k; col[j + 2] = c[2] * k; heat[i] *= .1;
      }
    } else if (q.k === 'o') {
      const cx = q.s[0], cy = q.s[1], c = q.c || [1, .95, .85], hw = ((q.w || 1) - 1) / 2;
      for (let e = -hw; e <= hw + 1e-6; e += 1) {
        const rs = q.rs + e, n = Math.ceil(rs * 6.3), a = q.a * (hw ? 1 - Math.abs(e) / (hw + 1) * .6 : 1);
        for (let k = 0; k < n; k++) {
          const an = k / n * TAU, x = Math.floor(cx + Math.cos(an) * rs), y = Math.floor(cy + Math.sin(an) * rs * .92); if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const j = (y * W + x) * 3; add[j] += c[0] * a; add[j + 1] += c[1] * a; add[j + 2] += c[2] * a;
        }
      }
    } else if (q.k === 'w') {                                       // bend the picture across a ring: sample a little in or out
      const cx = q.s[0], cy = q.s[1], rs = q.rs, ww = Math.max(1.5, f * q.w / q.z), m = rs + ww + 1;
      const x0 = Math.max(0, Math.floor(cx - m)), x1 = Math.min(W - 1, Math.ceil(cx + m)), y0 = Math.max(0, Math.floor(cy - m)), y1 = Math.min(H - 1, Math.ceil(cy + m));
      for (let y = y0; y <= y1; y++) WARP.set(col.subarray((y * W + x0) * 3, (y * W + x1 + 1) * 3), (y * W + x0) * 3);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const ux = x + .5 - cx, uy = y + .5 - cy, d = Math.hypot(ux, uy) || 1, e = (d - rs) / ww; if (e <= -1 || e >= 1) continue;
        const s = q.a * Math.sin(Math.PI * e), sx = clamp(Math.round(x - ux / d * s), x0, x1), sy = clamp(Math.round(y - uy / d * s), y0, y1), j = (y * W + x) * 3, k = (sy * W + sx) * 3;
        col[j] = WARP[k]; col[j + 1] = WARP[k + 1]; col[j + 2] = WARP[k + 2];
      }
    } else if (q.k === 'h') {
      const cy = Math.floor(q.s[1]), cx = q.s[0], c = q.c || [1, .78, .5], len = q.len;
      for (let y = cy; y <= cy + 1; y++) { if (y < 0 || y >= H) continue;
        for (let x = Math.max(0, Math.floor(cx - len)); x <= Math.min(W - 1, Math.ceil(cx + len)); x++) {
          const u = 1 - Math.abs(x + .5 - cx) / len; if (u <= 0) continue;
          const a = q.a * u * u * (y === cy ? 1 : .55), j = (y * W + x) * 3; add[j] += c[0] * a; add[j + 1] += c[1] * a; add[j + 2] += c[2] * a;
        } }
    }
  }
}

// ---------------------------------------------------------------- effect library
const dirOf = (i, s) => { const z = rnd(i, s) * 2 - 1, a = rnd(i, s + 1) * TAU, r = Math.sqrt(1 - z * z); return [Math.cos(a) * r, Math.sin(a) * r, z]; };
const FIREC = [1, .62, .2], SPARK = [1, .83, .35], FUEL = [1, .91, .69], G = -9.8;
const fall25 = t => -25 * (t - (1 - Math.exp(-t * 1.2)) / 1.2);  // a falling drop of fuel: reaches ~25 m/s

// Layer counts per kind of blast (any can be overridden in `o`):
//   big  a wing or a fighter blowing up close to the lens (R ~ 9-10 m)
//   mid  an engine going up (R ~ 3-7 m)
//   far  a bomber exploding 500-1200 m away (R ~ 11-13 m, 10-30 px on screen)
const KINDS = {
  big: { lobes: 22, tongues: 6, sparks: 48, embers: 34, debris: 12, chunks: 3, fingers: 8, smoke: 26, life: 6, shock: 1, cond: true, lens: 1, glow: 5 },
  mid: { lobes: 10, tongues: 4, sparks: 16, embers: 12, debris: 4, chunks: 1, fingers: 3, smoke: 12, life: 3, shock: .6, cond: false, lens: .35, glow: 4 },
  far: { lobes: 13, tongues: 3, sparks: 16, embers: 0, debris: 8, chunks: 2, fingers: 5, smoke: 16, life: 5.2, shock: 0, cond: false, lens: .25, glow: 4 }
};

// Mid-air explosion at p, started `tau` seconds ago; R = fireball radius (m); vel = drift of the wreck.
// out: { fx, lights, post }. o: { kind, life, lobes, tongues, sparks, debris, embers, fingers, smoke, flash (0..1), pre (s), spray (dir), preVel, lens }.
// Beats: (pre) fuel spraying out, a few licks of flame -> flash + core fireball racing to 80 % of R in 0.1 s ->
// three tiers of rolling lobes (hot middle climbs, rim curls down and in), tongues, shock ring bending the sky ->
// black smoke with a red core and an orange-lit underside swallows the fire -> sparks, hanging embers, burning
// chunks trailing smoke, fingers of burning fuel falling away. Every layer is gone by `life`.
function explosion(out, tau, p, R, seed = 1, vel = [0, 0, 0], o = {}) {
  const kind = o.kind || (R >= 8 ? 'big' : 'mid'), K = KINDS[kind], life = o.life || K.life, pre = o.pre || 0, fl = o.flash === undefined ? 1 : o.flash;
  if (tau < -pre || tau > life) return;
  if (tau < 0) { anticipation(out, tau + pre, pre, C.mad(p, o.preVel || vel, tau), R, seed, o.spray || [0, 0, 1]); return; }   // preVel: how the source moved before the blast
  // o.age (slow motion): real seconds since the blast. Shapes follow tau, but heat, light and smoke age in real time,
  // so a slowed fireball still cools from white to orange-red and gets wrapped in smoke at the normal pace.
  const ag = o.age === undefined ? tau : Math.max(tau, o.age), so = o.soot === undefined ? .1 : o.soot;
  const gf = 1 - C.sstep(life * .78, life, tau), fx = out.fx, base = C.mad(p, vel, tau * Math.exp(-tau * .5));
  const far = kind === 'far', big = kind === 'big', ft = far ? .07 : .1;
  // flash: 2-3 frames, then the light goes from warm white to flickering orange
  if (ag < ft) { const k = (1 - ag / ft) * fl; fx.push({ k: 'g', p: base, r: R * K.glow, c: [1, .84, .58], i: .32 * k, nodepth: true }, { k: 'g', p: base, r: R * 1.3, c: [1, .97, .86], i: .9 * k, nodepth: true }); }
  if (ag < .12) out.lights.push({ p: base, c: [1, .92, .75], i: 2.2 * (1 - ag / .12) * fl, r: R * 30 });
  if (ag < 1.6) out.lights.push({ p: base, c: [1.1, .5, .14], i: 1.4 * Math.exp(-2 * ag) * (1 + .15 * Math.sin(TAU * 10 * ag + seed)) * (1 - C.sstep(1.1, 1.6, ag)), r: R * 22 });
  if (out.post && ag < .5) {                                       // lens: bloom jump, amber grade, horizontal streak
    const L = (o.lens === undefined ? K.lens : o.lens) * fl;
    if (ag < .15) out.post.bloom = Math.max(out.post.bloom || 1, 1 + .8 * L * (1 - ag / .15));
    out.post.amber = Math.max(out.post.amber || 0, L * .55 * C.pulse(0, .04, .2, .5, ag));
    if (big && ag < .25) fx.push({ k: 'h', p: base, r: 0, len: W * .3, a: .5 * L * (1 - ag / .25), c: [1, .8, .55] });
  }
  // core fireball: 80 % of R at 0.1 s, all of it at 0.2 s, 115 % at 0.35 s; the white-hot middle shrinks as it cools
  if (tau < .55 && ag < .9) fx.push({ k: 'f', p: base, r: R * (1 - Math.exp(-tau / .06)) * (1 + .45 * tau) * (o.age === undefined ? 1 : 1 - .55 * C.sstep(.06, .3, ag)), h: 1.65 * Math.exp(-ag * (o.age === undefined ? 5.5 : 3.5)), seed: seed + tau * 5 });
  // rolling lobes in three tiers (white-yellow, orange, red), each with its own delay and decay
  const nl = o.lobes || K.lobes, TH = [1.2, .9, .62], TD = [3.4, 2.3, 1.5], TR = [.8, 1, 1.12];
  for (let i = 0; i < nl; i++) {
    const tier = i % 3, ta = tau - rnd(i, seed + 21) * .12; if (ta <= 0) continue;
    const d = dirOf(i, seed * 7), edge = Math.hypot(d[0], d[1]), sp = .45 + .7 * rnd(i, seed + 3);
    const s = R * sp * (1 - Math.exp(-ta / .07)) * (1 + .25 * ta) * (1 - .2 * edge * C.sstep(.25, 1.2, ta));
    const lift = R * (.3 + .9 * Math.max(0, d[2])) * ta + .5 * R * ta * ta - R * .35 * edge * Math.sin(Math.min(Math.PI, ta * 2.6));
    const c = [base[0] + d[0] * s, base[1] + d[1] * s, base[2] + d[2] * s * .9 + lift];
    const r = R * (.33 + .33 * rnd(i, seed + 5)) * (1 - Math.exp(-ta / .05)) * (1 + .55 * ta) * TR[tier];
    const th = Math.max(ta, ag - rnd(i, seed + 21) * .12), h = TH[tier] * Math.exp(-th * TD[tier] * (.8 + .4 * rnd(i, seed + 6))) * (.82 + .36 * C.noise2(ag * 10, i + seed, 5));
    if (h > .05) fx.push({ k: 'f', p: c, r, h, mx: .3, seed: seed * 3.3 + i + ta * 2.2 });
  }
  // tongues: a few long licks of flame thrown out of the ball (break the round silhouette)
  const nt = o.tongues === undefined ? K.tongues : o.tongues;
  for (let i = 0; i < nt; i++) {
    const ta = tau - .04 - rnd(i, seed + 51) * .06; if (ta < 0 || ta > .42) continue;
    const d0 = dirOf(i, seed * 29 + 3), d = C.norm([d0[0], d0[1], Math.abs(d0[2]) * .7 + .15]), L = R * (1.5 + .5 * rnd(i, seed + 52)) * (1 - Math.exp(-ta * 9));
    const a = C.mad(base, d, R * .35), b = C.add(C.mad(base, d, R * .35 + L), [0, 0, ta * R * .9]);
    fx.push({ k: 'k', a, b, ra: R * .3 * (1 - ta / .6), rb: R * .09, h: 1.15 * Math.pow(1 - ta / .42, 1.2), seed: seed * 1.3 + i + ta * 3 });
  }
  // shock wave: one ring that races out and fades, bending the sky behind it; a pale condensation shell on big blasts
  if (K.shock && tau > .03 && tau < .45) {
    const ta = tau - .03, rr = R * (1 + 5 * (1 - Math.exp(-8 * ta))), k = 1 - ta / .42;
    fx.push({ k: 'o', p: base, r: rr, a: .28 * K.shock * k * k, w: big ? 2 : 1, c: [1, .93, .8] }, { k: 'w', p: base, r: rr, w: R * .45, a: (big ? 2.6 : 1.4) * k });
  }
  if (K.cond && tau > .06 && tau < .45) fx.push({ k: 's', p: base, r: R * (2 + 1.2 * (tau - .06) / .39), a: .2 * C.pulse(.06, .12, .25, .45, tau), tone: 0, hollow: true, c: [.91, .93, .95], seed: seed * .9 });
  // black smoke: big slow knots and thin wisps; red core and orange underside while the fire is still in it
  const ns = o.smoke || K.smoke;
  for (let i = 0; i < ns; i++) {
    const knot = i < ns * .45, ta = ag - so - rnd(i, seed + 31) * so * 1.5; if (ta <= 0) continue;   // smoke lives in real time (o.age)
    const d = dirOf(i, seed * 31 + 7), g = Math.pow(ta, .75), sp = R * (knot ? .35 + .55 * rnd(i, seed + 32) : .8 + .9 * rnd(i, seed + 33)) + (o.soot === undefined ? 0 : R * .55);
    const c = [base[0] + d[0] * sp * (.55 + .5 * g) + ta * 1.5, base[1] + d[1] * sp * (.55 + .5 * g), base[2] + d[2] * sp * (.5 + .4 * g) + R * .3 * ta + .25 * R * Math.pow(ta, 1.5)];
    const r = R * (knot ? .5 + .3 * rnd(i, seed + 34) : .22 + .18 * rnd(i, seed + 35)) * (.45 + .65 * g);
    const a = C.sstep(0, .1 + 3.5 * so, ta) * (knot ? .92 : .7) * Math.pow(Math.max(0, 1 - ag / life), .9) * gf;
    if (a < .02) continue;
    const inner = 1 - sp / (R * 1.7);
    fx.push({ k: 's', p: c, r, a, tone: (knot ? .98 : .9) - .2 * Math.min(1, ta / 4), seed: seed * 1.7 + i * 2.1 + ta * .3,
      core: inner > 0 ? .95 * inner * Math.exp(-ta / .45) : 0, bot: .85 * (1 - C.sstep(.3, .9, ta)), warm: .25 * Math.exp(-ta * 2.5) });
  }
  // sparks: fast, hot cored, slowed by the air
  const nsp = o.sparks === undefined ? K.sparks : o.sparks;
  for (let i = 0; i < nsp; i++) {
    const d = dirOf(i, seed * 11 + 2), v = R * (15 + 10 * rnd(i, seed + 9)), lf = .3 + .25 * rnd(i, seed + 10); if (tau > lf) continue;
    const at = t => { const s = v * (1 - Math.exp(-t * 4)) / 4; return [base[0] + d[0] * s, base[1] + d[1] * s, base[2] + d[2] * s + .5 * G * t * t]; };
    const k = 1 - tau / lf;
    fx.push({ k: 'l', a: at(Math.max(0, tau - .016)), b: at(tau), c: SPARK, i: 1.6 * k, core: k, w: 1 });
  }
  // embers: single hot pixels that hang, sink and wink out
  const ne = o.embers === undefined ? K.embers : o.embers;
  for (let i = 0; i < ne; i++) {
    const ta = tau - .25 - rnd(i, seed + 61) * .15, lf = Math.min(2 + rnd(i, seed + 62), life - .9); if (ta < 0 || ta > lf) continue;
    const d = dirOf(i, seed * 37 + 1), s = R * (1.1 + 1.4 * rnd(i, seed + 63)) * (1 - Math.exp(-(ta + .3) * 2.2)), q = [base[0] + d[0] * s + ta * 1.5, base[1] + d[1] * s, base[2] + d[2] * s - .9 * ta];
    const cool = ta / lf, tw = .55 + .45 * Math.sin(ta * 17 + i * 2.3);
    fx.push({ k: 'l', a: q, b: [q[0], q[1], q[2] + .01], c: [1 - .36 * cool, .6 - .44 * cool, .18 - .1 * cool], i: (.35 + .75 * tw) * (1 - cool), w: 1 });
  }
  // wreckage: three big chunks spinning slowly with fire on them that turns to smoke, smaller bits on faster arcs
  const nd = o.debris === undefined ? K.debris : o.debris, nc = Math.min(nd, K.chunks);
  for (let i = 0; i < nd; i++) {
    const chunk = i < nc, d = dirOf(i, seed * 13 + 5), v = R * (chunk ? 1.8 + 1.6 * rnd(i, seed + 11) : 2.6 + 3.4 * rnd(i, seed + 12)), lf = Math.min(life - .6, chunk ? 3 + rnd(i, seed + 13) : 2.2 + 1.5 * rnd(i, seed + 13));
    const at = t => { const s = v * (1 - Math.exp(-t * 1.1)) / 1.1; return [p[0] + vel[0] * t + d[0] * s, p[1] + vel[1] * t + d[1] * s, p[2] + vel[2] * t + (d[2] * .7 + .35) * s + .5 * G * t * t]; };
    const fk = te => chunk ? 1 - C.sstep(.45 * lf, .8 * lf, te) : 1 - te / lf;   // fire on the piece -> smoke only
    if (tau < lf) {
      const q = at(tau), k = 1 - tau / lf, burn = fk(tau);
      fx.push({ k: 'd', p: q, r: R * (chunk ? .15 + .05 * rnd(i, seed + 14) : .06 + .08 * rnd(i, seed + 14)), rot: tau * TAU * (chunk ? .5 + .5 * rnd(i, seed + 15) : 1 + 2 * rnd(i, seed + 15)) + i, asp: chunk ? .5 : .42, c: [.07, .07, .09] });
      if (burn > .03) fx.push({ k: 'f', p: q, r: R * (chunk ? .26 : .18) * (.6 + k), h: 1.3 * burn, seed: i + tau * 9 });
    }
    const n = chunk ? 22 : 14, dt = chunk ? .11 : .06, al = chunk ? 2.4 : .95;  // the tail: puffs left behind along the arc
    for (let j = 0; j < n; j++) {
      const te = tau - j * dt - .02, age = tau - te; if (te < 0 || te > lf) continue;
      const q = at(te), a = (chunk ? .7 : .6) * Math.pow(Math.max(0, 1 - age / al), 1.2) * (chunk ? 1 : 1 - te / lf) * gf; if (a < .03) continue;
      fx.push({ k: 's', p: [q[0], q[1], q[2] + age * 2], r: R * (.1 + (chunk ? .3 : .42) * age), a, tone: .92, seed: i * 5 + j, warm: j < 3 ? .5 : 0, bot: chunk && age < .5 ? .5 * (1 - age / .5) * fk(te) : 0 });
    }
  }
  // fingers of burning fuel: bright heads falling away, a streak of flame behind, then a thin black line
  const nf = o.fingers === undefined ? K.fingers : o.fingers;
  for (let i = 0; i < nf; i++) {
    const ta = tau - .1 - rnd(i, seed + 71) * .15, lf = Math.min(3.5, life - .7); if (ta < 0 || ta > lf) continue;
    const d0 = dirOf(i, seed * 41 + 9), d = C.norm([d0[0], d0[1], d0[2] * .4 - .2]), v0 = R * (2 + 1.5 * rnd(i, seed + 72));
    const pos = t => { const s = v0 * (1 - Math.exp(-t * 1.5)) / 1.5; return [p[0] + vel[0] * t * .5 + d[0] * s, p[1] + vel[1] * t * .5 + d[1] * s, p[2] + vel[2] * t * .5 + d[2] * s + fall25(t)]; };
    const hk = 1 - C.sstep(1.4, 2.8, ta), hr = R * .12;
    if (hk > .03) {
      fx.push({ k: 'f', p: pos(ta), r: hr * 1.3, h: 1.35 * hk, seed: i * 3 + ta * 6 });
      for (let j = 1; j <= 6; j++) { const t1 = ta - j * .07; if (t1 < 0) break; fx.push({ k: 'k', a: pos(t1 + .07), b: pos(t1), ra: hr * (1 - (j - 1) / 7), rb: hr * (1 - j / 7), h: 1.1 * hk * (1 - j / 7.5), seed: i + j }); }
    }
    for (let j = 0; j < 12; j++) {
      const te = ta - .3 - j * .12, age = ta - te; if (te < 0) break;
      const a = .55 * Math.pow(Math.max(0, 1 - age / 1.8), 1.3) * gf; if (a < .03) continue;
      fx.push({ k: 's', p: C.add(pos(te), [age * 1.5, 0, age * 1.2]), r: R * (.07 + .2 * age), a, tone: .96, seed: i * 7 + j });
    }
  }
}
// Before the blast: fuel spraying out of a ruptured tank (pale ribbons) and a few licks of flame that grow.
function anticipation(out, a, pre, p, R, seed, spray) {
  const k = a / pre, fx = out.fx;
  for (let i = 0; i < 4; i++) {
    const d = C.norm(C.mad(spray, dirOf(i, seed * 43 + 1), .55)), L = R * (.4 + 1.3 * k) * (.7 + .5 * rnd(i, seed + 81));
    fx.push({ k: 't', a: p, b: C.mad(p, d, L), w: R * (.1 + .12 * k), c: FUEL, a0: .45 * k, a1: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const d = dirOf(i, seed * 47 + 2), q = C.mad(p, d, R * .3 * rnd(i, seed + 82)), w = C.sstep(i * .2, i * .2 + .3, k);
    if (w > 0) fx.push({ k: 'f', p: q, r: R * (.12 + .15 * w), h: (.7 + .5 * w) * (.8 + .4 * Math.sin(a * 40 + i * 2)), seed: seed + i + a * 7 });
  }
  if (k > .6) fx.push({ k: 'g', p, r: R * 1.2, c: [1, .7, .35], i: .5 * (k - .6) / .4, nodepth: true });
  out.lights.push({ p, c: [1.05, .55, .18], i: .7 * k, r: R * 12 });
}
// Heavy flak burst: a red-cored flash for 2 frames, a knot of black puffs that pops out like popcorn and then hangs,
// drifting and greying; a few fragments and a faint ring for a few frames.
function flak(out, tau, p, seed = 1, size = 1, life = 7) {
  if (tau < 0 || tau > life) return;
  const fx = out.fx;
  if (tau < .07) { const k = 1 - tau / .07; fx.push({ k: 'f', p, r: 1.9 * size, h: 1.5 * k }, { k: 'g', p, r: 9 * size, c: [1, .62, .26], i: .75 * k, nodepth: true }, { k: 'g', p, r: 2.6 * size, c: [1, .9, .72], i: 1.1 * k, nodepth: true }); out.lights.push({ p, c: [1, .6, .25], i: 1.2 * k, r: 160 * size }); }
  if (tau > .02 && tau < .14) fx.push({ k: 'o', p, r: (2.5 + 60 * (tau - .02)) * size, a: .22 * (1 - (tau - .02) / .12) });
  const fade = Math.pow(1 - tau / life, .9);
  for (let i = 0; i < 11; i++) {
    const d = dirOf(i, seed * 17 + 1), pop = i < 3 ? .25 : .55 + .75 * rnd(i, seed + 2), e = (6.5 * (1 - Math.exp(-tau * 13)) + .8 * tau) * size * pop;
    const r = (3.4 * (1 - Math.exp(-tau * 15)) + .65 * tau) * size * (i < 3 ? 1.15 : .55 + .55 * rnd(i, seed + 3));
    fx.push({ k: 's', p: [p[0] + d[0] * e + tau * 2.5, p[1] + d[1] * e, p[2] + d[2] * e * .8 + tau * .8], r, a: .93 * fade, tone: 1 - .22 * Math.min(1, tau / 4), seed: seed * 2.3 + i, core: i < 4 ? .9 * Math.exp(-tau / .15) : 0 });
  }
  if (tau < .12) for (let i = 0; i < 7; i++) { const d = dirOf(i, seed * 19 + 4), s0 = 80 * size * Math.max(0, tau - .03), s1 = 80 * size * tau; fx.push({ k: 'l', a: C.mad(p, d, s0), b: C.mad(p, d, s1), c: SPARK, i: 1.2 * (1 - tau / .12), w: 1 }); }
}
// Smoke left along a path: path(te) is where the source was at time te (the air stands still).
// o: { from, rate (puffs/s), life, r0, grow, tone, a, rise, spread, seed, warm }
function smokeTrail(out, path, t, o) {
  const rate = o.rate || 24, life = o.life || 4, k1 = Math.floor(Math.min(t, o.to === undefined ? t : o.to) * rate), k0 = Math.ceil(Math.max(o.from || 0, t - life) * rate);
  for (let k = k1; k >= k0; k--) {
    const te = k / rate, age = t - te, q = path(te), sp = (o.spread || 1.6) * age, sd = (o.seed || 0) * 31 + k;
    const a = (o.a || .8) * Math.pow(1 - age / life, o.pow || 1.3) * Math.min(1, age * rate * .7 + .35);
    if (a < .025) continue;
    out.fx.push({ k: 's', p: [q[0] + (rnd(sd, 1) - .5) * sp, q[1] + (rnd(sd, 2) - .5) * sp, q[2] + (rnd(sd, 3) - .5) * sp + (o.rise || 1.5) * age], r: (o.r0 || 1.2) + (o.grow || 2.4) * Math.pow(age, .75), a, tone: o.tone === undefined ? .95 : o.tone, seed: sd * .37, warm: o.warm && age < .25 ? o.warm * (1 - age / .25) : 0, bot: o.warm && age < .5 ? o.warm * .6 * (1 - age / .5) : 0 });
  }
}
// Fire streaming back from a burning engine at p (back = unit vector downstream). Three tiers: a short pale core,
// an orange body, red tongues that tear off and lick 3-4 times a second; the length breathes at 7.5 Hz and a backfire
// every 1.6 s throws it out 1.6 times as far for 3 frames; dense black smoke right behind, a drop of burning oil
// every half second. All rates fit a whole number of times into the 8 s menu loop.
function fireJet(out, p, back, size, t, seed = 1, power = 1) {
  const fx = out.fx, bf = ((t / 1.6 + rnd(seed, 91)) % 1) < .0625, len = (1 + .22 * Math.sin(TAU * 7.5 * t + seed)) * (bf ? 1.6 : 1), fl = .8 + .4 * rnd(Math.floor(t * 30), seed);
  const side = C.norm(C.cross(back, Math.abs(back[2]) > .9 ? [1, 0, 0] : [0, 0, 1]));
  for (let i = 0; i < 3; i++) fx.push({ k: 'f', p: C.mad(p, back, size * .45 * i * len), r: size * (.75 - i * .12), h: 1.45 * power, seed: seed * 5 + i + Math.floor(t * 30) * .3 });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ph = (t * 3.125 + i / n + rnd(i, seed) * .2) % 1, w = size * ph * 1.1;
    fx.push({ k: 'f', p: [p[0] + back[0] * ph * size * 3.4 * len + (rnd(i, seed + 4) - .5) * w, p[1] + back[1] * ph * size * 3.4 * len + (rnd(i, seed + 5) - .5) * w, p[2] + back[2] * ph * size * 3.4 * len + (rnd(i, seed + 6) - .5) * w + ph * size * .5],
      r: size * (1.15 - ph * .65), h: .95 * power * Math.pow(1 - ph, 1.1) + .1, seed: seed * 5 + i + Math.floor(t * 30) * .7 });
  }
  for (let j = 0; j < 3; j++) {                                     // red tongues tearing off the tail of the flame
    const ph = (t * 3.75 + j / 3 + rnd(j, seed + 7) * .3) % 1, wv = Math.sin(TAU * (ph + j * .37)) * size * .5;
    const a = C.mad(C.mad(p, back, size * (1.4 + 2.6 * ph) * len), side, wv);
    fx.push({ k: 'k', a, b: C.add(C.mad(a, back, size * 1.5), [0, 0, size * .3]), ra: size * .5 * (1 - ph * .5), rb: size * .14, h: .72 * power * (1 - ph), seed: seed + j + ph * 2 });
  }
  for (let j = 0; j < 3; j++) fx.push({ k: 's', p: C.add(C.mad(p, back, size * (4.4 + 1.3 * j) * len), [0, 0, size * .3 * j]), r: size * (.8 + .3 * j), a: .5 * power, tone: 1, seed: seed * 3 + j + Math.floor(t * 15) * .2, bot: .4 });
  const ok = Math.floor(t * 2 + rnd(seed, 92)), oa = t * 2 + rnd(seed, 92) - ok;   // a drop of burning oil every half second
  if (oa < .7) { const age = oa * .5, q0 = C.add(C.mad(p, back, size * (3 + 18 * age)), [0, 0, -7 * age * age]), q1 = C.add(C.mad(p, back, size * (2.4 + 18 * Math.max(0, age - .04))), [0, 0, -7 * Math.max(0, age - .04) ** 2]); fx.push({ k: 'l', a: q1, b: q0, c: FIREC, i: 1.1 * (1 - oa / .7) * power, core: .5, w: 1 }); }
  fx.push({ k: 'g', p, r: size * 4, c: FIREC, i: .22 * power * fl * (bf ? 1.6 : 1), nodepth: false });
  out.lights.push({ p, c: [1.05, .55, .18], i: .9 * power * fl * (bf ? 1.4 : 1), r: size * 22 });
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
// Rounds striking metal at p: a one-frame white-yellow flash, sparks falling under gravity, a puff, a couple of chips.
function hit(out, tau, p, seed = 1, size = 1, vel = [0, 0, 0]) {
  if (tau < 0 || tau > .5) return;
  if (tau < .04) out.fx.push({ k: 'g', p, r: 2.4 * size, c: [1, .9, .62], i: 1.7 }, { k: 'f', p, r: .8 * size, h: 1.9 });
  else if (tau < .1) out.fx.push({ k: 'f', p, r: .6 * size, h: 1.1 * (1 - tau / .1) });
  for (let i = 0; i < 10; i++) {
    const d = dirOf(i, seed * 23), v = (22 + 30 * rnd(i, seed)) * size, lf = .15 + .2 * rnd(i, seed + 1); if (tau > lf) continue;
    const at = t => [p[0] + vel[0] * t * .6 + d[0] * v * t, p[1] + vel[1] * t * .6 + d[1] * v * t, p[2] + vel[2] * t * .6 + d[2] * v * t + .5 * G * 3 * t * t];
    out.fx.push({ k: 'l', a: at(Math.max(0, tau - .025)), b: at(tau), c: SPARK, i: 1.3 * (1 - tau / lf), core: .6, w: 1 });
  }
  for (let i = 0; i < 2; i++) { const d = dirOf(i, seed * 29 + 7), q = C.add(C.mad(p, vel, tau * .6), C.mul(C.add(d, [0, 0, -tau * 2]), 9 * size * tau)); out.fx.push({ k: 'd', p: q, r: .22 * size, rot: tau * 30 + i, c: [.1, .1, .12] }); }
  if (tau > .03) out.fx.push({ k: 's', p: C.mad(p, vel, tau * .4), r: (.6 + 3 * tau) * size, a: .5 * (1 - tau / .5), tone: .7, seed });
}
// Condensation trail behind an aircraft flying straight: a ribbon from the tail back along -dir.
function contrail(out, tail, dir, length, width, alpha = .3, c = [1, .86, .8]) {
  const mid = C.mad(tail, dir, -length * .12);
  out.fx.push({ k: 't', a: tail, b: mid, w: width * .5, c, a0: 0, a1: alpha }, { k: 't', a: mid, b: C.mad(tail, dir, -length), w: width, c, a0: alpha, a1: 0 });
}

// ---------------------------------------------------------------- camera kick (film.cjs adds it on top of the shot's camera)
// q: { tau (s since the blast), at (world centre of the blast), K (px jolt), A (px spring), f (Hz), decay (s), jitter (px),
//      roll (deg), zoom (fraction of FOV), dur (s) }. Returns the screen offset of the picture [x, y] in px, roll (rad)
// and a FOV factor: the picture is thrown away from the blast, then rings down like a spring.
function kickAt(q, cam) {
  const t = q.tau, dur = q.dur || 1.2; if (t < 0 || t > dur) return null;
  const s = cam.project(q.at); let dx = s[0] - W / 2, dy = s[1] - H / 2; if (s[2] < 0) { dx = -dx; dy = -dy; }
  const L = Math.hypot(dx, dy), w = clamp(L / (H * .3)); let ux = L ? dx / L * w : 0, uy = (L ? dy / L * w : 0) + (1 - w);   // dead ahead: the nose is shoved up
  const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const win = 1 - C.sstep(dur * .7, dur, t), ed = Math.exp(-t / (q.decay || .3)), fr = q.f || 9, fi = Math.round(t * 30);
  const main = (q.K || 0) * Math.exp(-t / .07) + (q.A || 0) * ed * Math.sin(TAU * fr * t), side = .35 * (q.A || 0) * ed * Math.sin(TAU * fr * 1.13 * t);
  const jit = (q.jitter || 0) * Math.exp(-t / .15), jx = jit * (fi % 2 ? 1 : -1) * (.6 + .4 * rnd(fi, 401)), jy = jit * (rnd(fi, 402) - .5);
  return {
    x: (ux * main - uy * side + jx) * win, y: (uy * main + ux * side + jy) * win,
    roll: (q.roll || 0) * C.DEG * Math.exp(-t / ((q.decay || .3) * .6)) * Math.sin(TAU * 6 * t) * (ux < 0 ? -1 : 1) * win,
    zoom: 1 + (q.zoom || 0) * Math.exp(-t / .2) * win
  };
}

module.exports = { draw, explosion, flak, smokeTrail, fireJet, tracers, hit, contrail, dirOf, kickAt, KINDS };

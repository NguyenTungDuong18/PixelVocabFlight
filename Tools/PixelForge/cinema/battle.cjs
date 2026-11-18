'use strict';
// The battle under the raid (the port city on the coast, ground.cjs): events of the background and their sound cues.
// shots.cjs calls populate(sc, info) once per frame after the shot has filled the scene:
//   info = { t (film seconds), shot (0..7), loopT (periodic clock 0..LOOP in shot 8, else null) }
// CUES: [{ k (cue kind), t (seconds, before the loop), pan (-100..100), level (0..200), dur (frames) }], merged into the film's cues.
// Everything is a pure function of time. In shot 8 and the menu loop the clock is loopT: whole cycles per 8 s, one-off
// events wrap with tau = (loopT - birth) mod 8. The ground never slides (sky.cjs draws it in world position), so neither does anything on it.
const C = require('./core.cjs');
const { clamp, smooth, ih, noise2, TAU } = C;
const S = require('./sky.cjs');
const Wd = require('./world.cjs');
const Gr = require('./ground.cjs');
const LOOP = 8;

// shots 1-7: the deck cumulus over the world deck (none over the clearing above the port)
let CLEARED = null;
const cleared = () => CLEARED || (CLEARED = Wd.deckWorld().concat(Wd.FAR));

// ---------------------------------------------------------------- smoke columns (static: they never slide)
// Soft puffs rising through each column: puff k sits at kf = k + time / 8, one spacing per 8 s, and every attribute is a
// smooth function of kf, so the column churns upward and the loop closes. Low: pencil-thin brown-black, fire-lit at
// the foot; high: grey-violet, flattening into an anvil that drifts downwind (east) at the inversion.
const nz = (kf, s) => noise2(kf * .45, s * 7.13, 501);
function plume(fx, c, time) {
  const Hc = c.top - Gr.ZG, n = c.kind === 'A' ? 30 : c.kind === 'B' ? 22 : 14, ph = (time / LOOP) % 1;
  for (let k = -1; k < n; k++) {
    const kf = k + ph, v = kf / (n - 1); if (v < 0 || v > 1) continue;
    const hh = v * Hc, r = Gr.colR(c, v) * (.8 + .4 * nz(kf + c.seed * 9, 1));
    const p = [c.x + Gr.lean(hh) + (nz(kf + c.seed * 9, 2) - .5) * r * .7, c.y + hh * .02 + (nz(kf + c.seed * 9, 3) - .5) * r * .7, Gr.ZG + hh];
    const a = .94 * clamp(kf + 1) * (1 - smooth((v - .9) / .1) * .6);
    fx.push({ k: 's', p, r, a, tone: c.kind === 'D' ? (c.tone || .7) - .4 * v : .97 - .5 * Math.pow(v, 1.4), seed: c.seed * 37 + kf * .8, warm: .75 * Math.exp(-hh / 300) });
  }
  // the fire at its foot: a flickering mass of flame (whole cycles per 8 s) and its glow
  const fk = .85 + .15 * Math.sin(TAU * (3 + c.seed % 4) * time / LOOP + c.seed);
  if (c.kind !== 'D') { fx.push({ k: 'f', p: [c.x, c.y, Gr.ZG + c.fire * .25], r: c.fire * .55, h: 1.5 * fk, seed: c.seed * 5 }); fx.push({ k: 'g', p: [c.x, c.y, Gr.ZG + c.fire * .4], r: c.fire * 2.2, c: [1, .45, .15], i: .35 * fk }); }
  if (c.kind !== 'A' && c.kind !== 'B') return;
  const rc = Gr.colR(c, 1), m = c.kind === 'A' ? 7 : 5, x0 = c.x + Gr.lean(Hc), sw = Math.sin(TAU * time / LOOP);
  for (let j = 0; j < m; j++) {
    const u = (j + 1) / m, r = rc * (1.1 - .35 * u) * (.85 + .3 * ih(j, c.seed, 1, 502));
    fx.push({ k: 's', p: [x0 + u * rc * 2.8 + sw * 20, c.y + (ih(j, c.seed, 2, 502) - .5) * rc * 1.3, c.top - rc * (.25 + .35 * u) + (ih(j, c.seed, 3, 502) - .5) * rc * .3], r, a: .8 - .25 * u, tone: .5 - .1 * u, seed: c.seed * 37 + 90 + j + sw * .3 });
  }
}

// ---------------------------------------------------------------- one bomb on the ground
// flash (2-3 frames) -> fireball (0.4 s) -> dust and smoke that rises and hangs (6 s). k: size (1 = 250 kg at a few km)
function bomb(fx, tau, p, k, seed) {
  if (tau < 0 || tau > 6) return;
  if (tau < .1) fx.push({ k: 'g', p: [p[0], p[1], p[2] + 30], r: 260 * k, c: [1, .92, .74], i: 1.9 * (1 - tau / .1), nodepth: false });
  if (tau < .45) fx.push({ k: 'f', p: [p[0], p[1], p[2] + 40 + tau * 160], r: (55 + 120 * Math.sqrt(tau / .45)) * k, h: 1.7 * Math.pow(1 - tau / .45, 1.2), seed: seed % 97 });
  if (tau > .12) for (let j = 0; j < 2; j++) {
    const g = Math.sqrt(tau - .12), r = (45 + 70 * g) * k * (1 - j * .3);
    fx.push({ k: 's', p: [p[0] + j * 40 * k + tau * 9, p[1], p[2] + (50 + 90 * g) * k + j * 60 * k], r, a: .6 * (1 - smooth((tau - 2) / 4)) * clamp((tau - .12) * 6), tone: .55 + .25 * j, seed: seed * 3 + j, warm: .45 * Math.exp(-tau * 1.6) });
  }
}
// a stick of bombs walking across the city: n bombs from a to b, dt seconds apart, from t0 (wrap: repeat every LOOP)
function chain(fx, time, ch, wrap) {
  for (let k = 0; k < ch.n; k++) {
    const tk = ch.t0 + k * ch.dt, u = k / (ch.n - 1), s = ch.seed * 31 + k;
    let tau = time - tk; if (wrap) tau = ((tau % LOOP) + LOOP) % LOOP;
    if (tau > 6) continue;
    const p = [ch.a[0] + (ch.b[0] - ch.a[0]) * u + (ih(s, 1, 0, 510) - .5) * ch.spread, ch.a[1] + (ch.b[1] - ch.a[1]) * u + (ih(s, 2, 0, 510) - .5) * ch.spread, Gr.ZG];
    bomb(fx, tau, p, ch.k * (.8 + .4 * ih(s, 3, 0, 510)), s);
  }
}
// an oil tank or a ship going up: white flash, a fireball that rolls up over 2.5 s, then black smoke boiling up
function blowUp(fx, tau, p, k, seed) {
  if (tau < 0 || tau > 7) return;
  if (tau < .15) fx.push({ k: 'g', p: [p[0], p[1], p[2] + 80 * k], r: 600 * k, c: [1, .9, .7], i: 2.4 * (1 - tau / .15) });
  for (let j = 0; j < 5; j++) {
    const tj = tau - j * .12; if (tj < 0) continue;
    const up = 120 * k * Math.sqrt(tj) * 3, life = 2.6;
    if (tj < life) fx.push({ k: 'f', p: [p[0] + (ih(j, seed, 1, 520) - .5) * 160 * k + tj * 30, p[1] + (ih(j, seed, 2, 520) - .5) * 160 * k, p[2] + 60 * k + up], r: (90 + 110 * Math.sqrt(tj)) * k * (1 - j * .1), h: 1.8 * Math.pow(1 - tj / life, 1.4), seed: seed + j });
    if (tj > .5) fx.push({ k: 's', p: [p[0] + tj * 40, p[1] + (ih(j, seed, 3, 520) - .5) * 200 * k, p[2] + 60 * k + up + 120 * k], r: (110 + 120 * Math.sqrt(tj)) * k, a: .8 * (1 - smooth((tj - 4) / 3)), tone: .9, seed: seed * 7 + j, warm: .6 * Math.exp(-(tj - .5) * .9) });
  }
}

// ---------------------------------------------------------------- the light flak of the city
// 2 cm quads and 3.7 cm guns in batteries round the two ports and along the burning belt. A gun fires a round every
// dt s along the barrel of that moment and the gunner swings it slowly, so the rounds in flight lie nose to tail on
// one smooth curve (the long exposures over Hamburg, IWM C 3371); the barrels of one emplacement swing together, so
// its streams run near parallel. Drag slows the beads and they bunch and dim near the top; the tracer burns out and
// the shell self-destructs at a slightly different height each time: a faint pinpoint flash and a small grey puff. Bursts of 1.4-3.2 s with pauses;
// every clock runs whole cycles per LOOP (dt divides it), so the menu loop closes. Muzzle flash: 2 frames on, 1 off.
const GUN = [
  { dt: .25, v: 900, k: .35, life: 3.7, puff: 2 },                 // 2 cm: 8-12 px between beads at 10 km, out at ~2 km
  { dt: .5, v: 850, k: .2, life: 5.6, puff: 3.2 }                   // 3.7 cm: sparse, climbs to ~3 km
];
const TRC = [{ c: [1, .62, .25], core: .75 }, { c: [1, .34, .13], core: .5 }, { c: [.62, 1, .52], core: .5 }];   // orange 62 %, red 31 %, now and then green
const STREAMS_W = [], STREAMS_S = [];
// a battery at (cx, cy): two emplacements, each 2-3 streams fanned toward the bomber stream (over x ~ 250, y ~ 0)
function battery(out, cx, cy, sd) {
  for (let s = 0; s < 2; s++) {
    const gx = cx + (ih(sd, s, 1, 540) - .5) * 800, gy = cy + (ih(sd, s, 2, 540) - .5) * 500, n = ih(sd, s, 3, 540) < .5 ? 3 : 2, K = GUN[ih(sd, s, 4, 540) < .3 ? 1 : 0];
    const az0 = Math.atan2(-gy, 250 - gx) + (ih(sd, s, 5, 540) - .5) * 1.6, e = q => ih(sd, s, q, 543);   // e: the emplacement (shared swing)
    const A = .05 + .07 * e(1), m = e(2) < .6 ? 1 : 2, p = e(3) * TAU, el0 = 1 + .35 * e(4), m2 = e(5) < .5 ? 1 : 2, p2 = e(6) * TAU;
    for (let j = 0; j < n; j++) {
      const id = sd * 8 + s * 4 + j, h = q => ih(id, q, 0, 541), per = h(1) < .55 ? 4 : 8, hc = h(12);
      out.push({ g: [gx + j * 30, gy, Gr.ZG + 15], K, id, az: az0 + (j - (n - 1) / 2) * .07, el: el0 + (h(3) - .5) * .06, A, m, p: p + j * .25,
        m2, p2, per, ph: h(9) * per, dur: per === 4 ? 1.4 + .8 * h(10) : 2 + 1.2 * h(10), life: K.life * (.85 + .3 * h(11)), T: TRC[hc < .62 ? 0 : hc < .93 ? 1 : 2] });
    }
  }
}
// the south port (shot 8, the menu loop; far off in shots 1 and 3): west of the comb dock, on the quays, by the tank farm, the far bank
for (const [x, y, s] of [[-9100, -10900, 1], [-6500, -10250, 2], [-2300, -10450, 3], [-7000, -13600, 4]]) battery(STREAMS_S, x, y, s);
// the north city and the belt (shots 1-7)
for (let k = 0; k < 9; k++) { const a = ih(k, 1, 0, 530) * TAU, r = 5000 + 2600 * ih(k, 2, 0, 530); battery(STREAMS_W, -2200 + Math.cos(a) * r * 1.2, 300 + Math.sin(a) * r, 10 + k); }
for (let k = 0; k < 4; k++) battery(STREAMS_W, -6500 + ih(k, 3, 0, 530) * 5000, -6000 - k * 3800, 30 + k);
STREAMS_W.push(...STREAMS_S);
const firing = (st, tf) => (((tf - st.ph) % st.per) + st.per) % st.per < st.dur;
function guns(fx, time, frame, cam, streams) {
  const th = Math.tan((cam.fov || 50) * C.DEG / 2) / (C.H / 2), on = frame % 3 !== 2;   // th: metres a pixel per metre of range
  for (const st of streams) {
    const { g, K } = st, pxm = Math.hypot(g[0] - cam.pos[0], g[1] - cam.pos[1], g[2] - cam.pos[2]) * th, nb = LOOP / K.dt;
    const at = (tf, a) => {                                         // where the round fired at tf is a s later
      const az = st.az + st.A * Math.sin(TAU * st.m * tf / LOOP + st.p), el = st.el + .04 * Math.sin(TAU * st.m2 * tf / LOOP + st.p2);
      const s = K.v / K.k * (1 - Math.exp(-K.k * a)), hz = s * Math.cos(el);
      return [g[0] + Math.cos(az) * hz + 6 * a, g[1] + Math.sin(az) * hz, g[2] + s * Math.sin(el) - 3.5 * a * a];
    };
    if (firing(st, time) && on) {
      fx.push({ k: 'g', p: g, r: 1.3 * pxm, c: [1, .91, .63], i: 1.2 }, { k: 'g', p: g, r: 6 * pxm, c: [1, .5, .18], i: .2 });
    }
    const n1 = Math.floor(time / K.dt), n0 = Math.ceil((time - st.life - 1.2) / K.dt);
    for (let n = n0; n <= n1; n++) {
      const tf = n * K.dt, a = time - tf; if (!firing(st, tf)) continue;
      const hb = ih(st.id, ((n % nb) + nb) % nb, 0, 542), life = st.life * (.93 + .14 * hb);
      if (a < life) {                                                // a dash .55 of the bead spacing long: the beads read as one dotted line
        const v = a / life;
        fx.push({ k: 'l', a: at(tf, Math.max(0, a - K.dt * .55)), b: at(tf, a), c: st.T.c, i: 1.25 - .85 * v, core: st.T.core * Math.max(0, 1 - v * 3), w: 1.2, taper: true });
      } else if (a < life + 1.1 && hb < .4) {                        // two in five self-destruct visibly: a faint flash, then a little grey puff that hangs
        const u = (a - life) / 1.1, p = at(tf, life);
        if (a - life < .07) fx.push({ k: 'g', p, r: 1.1 * pxm, c: [1, .9, .7], i: .7 });
        fx.push({ k: 's', p: [p[0] + 8 * u, p[1], p[2] + 10 * u], r: K.puff * pxm * (.8 + .9 * Math.sqrt(u)), a: .6 * (1 - u * u), tone: .3, seed: st.id * 7 + hb * 50 });
      }
    }
  }
}

// ---------------------------------------------------------------- the schedule
// world shots: sticks of bombs placed where each shot looks (shots.cjs): south for 1 and 3, the port under the
// whip down in 2, the coast in 6, west in 7
const CHAINS_W = [
  { t0: .25, n: 12, dt: .12, a: [-4600, -15800], b: [-1400, -14200], spread: 160, k: 1.6, seed: 1 },
  { t0: 1.95, n: 14, dt: .055, a: [-4300, 1200], b: [-900, -1700], spread: 120, k: 1, seed: 2 },
  { t0: 2.7, n: 10, dt: .14, a: [-7200, -11200], b: [-3900, -10200], spread: 200, k: 1.4, seed: 3 },
  { t0: 5.85, n: 12, dt: .1, a: [2400, -7200], b: [3600, -2600], spread: 150, k: 1.2, seed: 4 },
  { t0: 7.05, n: 12, dt: .09, a: [-9200, -3200], b: [-7000, 2600], spread: 180, k: 1.3, seed: 5 }
];
// loop: two sticks walking across the belt beyond the south port (right of the menu column)
const CHAINS_L = [
  { t0: .8, n: 12, dt: .18, a: [-6500, -14000], b: [-3200, -16500], spread: 200, k: 1.7, seed: 11 },
  { t0: 5.6, n: 10, dt: .2, a: [-9500, -19500], b: [-5200, -18000], spread: 220, k: 1.9, seed: 12 }
];
const CUES = [
  { k: 13, t: .95, pan: 30, level: 70, dur: 45 },                  // shot 1: the stick far south
  { k: 13, t: 2.4, pan: -15, level: 120, dur: 50 },                // shot 2: the stick across the port under the whip
  { k: 13, t: 6.35, pan: -45, level: 75, dur: 40 },                // shot 6: the stick along the coast
  { k: 13, t: 8.55, pan: 35, level: 90, dur: 60 }                  // shot 8: the second loop stick, as the title lands
];

function populate(sc, info) {
  const loop = info.loopT !== null && info.loopT !== undefined, time = loop ? info.loopT : info.t;
  const frame = loop ? Math.round(time * C.FPS) % (LOOP * C.FPS) : Math.round(time * C.FPS);
  sc.deck.loop = loop; sc.deck.time = time; sc.deck.frame = frame;
  if (!loop) sc.clouds = cleared();
  const fx = sc.fx;
  for (const c of Gr.COLS) plume(fx, c, time);
  if (loop) {
    for (const ch of CHAINS_L) chain(fx, time, ch, true);
    blowUp(fx, ((time - 3.2) % LOOP + LOOP) % LOOP, [Gr.COLS[1].x + 250, Gr.COLS[1].y - 150, Gr.ZG], 1.4, 7);   // refinery (static, far)
    guns(fx, time, frame, sc.cam, STREAMS_S);
  } else {
    for (const ch of CHAINS_W) chain(fx, time, ch, false);
    blowUp(fx, time - 2.02, [-2405, 2355, Gr.ZG], .9, 3);           // a tank at the farm by the port, under the whip down
    blowUp(fx, time - 5.25, [Gr.COLS[7].x, Gr.COLS[7].y, Gr.ZG], .6, 5); // the ship at sea
    blowUp(fx, time - 7.3, [-6680, -1450, Gr.ZG], 1, 6);            // a tank at the west farm, behind the fireball of shot 7
    guns(fx, time, frame, sc.cam, STREAMS_W);
    faller(fx, time);
  }
}

// ---------------------------------------------------------------- a bomber going down
// Shots 1-7: one hit earlier falls burning toward the coast south of us (left of the oil columns in shots 1 and 3), its
// smoke a thin bent trail from the stream down toward the ground; two parachutes hang near where it left the box.
const bez3 = (a, b, c, u) => [0, 1, 2].map(i => a[i] * (1 - u) * (1 - u) + 2 * b[i] * u * (1 - u) + c[i] * u * u);
const FALL = { a: [1400, -8600, 2700], b: [2100, -9400, 1300], c: [2500, -10700, Gr.ZG] };
function faller(fx, time) {
  const sh = Math.min(.97, .5 + .045 * time), n = Math.ceil(sh / .011);
  for (let k = 0; k <= n; k++) {
    const s = Math.min(sh, k * .011), age = sh - s, p = bez3(FALL.a, FALL.b, FALL.c, s);
    fx.push({ k: 's', p: [p[0] + age * 900, p[1], p[2]], r: 18 + 110 * age, a: .75 * (1 - .45 * age), tone: .85 - .35 * age, seed: 700 + k, warm: .7 * Math.exp(-age * 40) });
  }
  const h = bez3(FALL.a, FALL.b, FALL.c, sh), fk = .8 + .2 * Math.sin(time * 37);
  fx.push({ k: 'f', p: h, r: 22, h: 1.5 * fk, seed: 71 }); fx.push({ k: 'g', p: h, r: 90, c: [1, .55, .2], i: .5 * fk });
  for (let j = 0; j < 2; j++) fx.push({ k: 'd', p: [1250 + j * 170, -8300 - j * 120, 2150 - j * 140 - 6 * time], r: 10, rot: 0, asp: .9, c: [.95, .92, .86] });
}
module.exports = { populate, CUES };

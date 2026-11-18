'use strict';
// The title cinematic, shot by shot: 10 s of film (300 frames at 30 fps) and an 8 s loop that plays
// behind the main menu. sceneAt(frame) describes one frame (camera, aircraft, effects, post); nothing
// carries over between frames, so any frame renders on its own.
//   1  0.0-1.6  the raid: out of cloud head-on into a stream of 140 heavy bombers under flak
//   2  1.6-2.6  our flight rolls over and dives out of the sun past the lens
//   3  2.6-3.9  gun run: chase camera behind our leader, head-on through the lead box
//   4  3.9-4.7  the bomber's wing blows off (impact frame, half-speed fireball), our fighter flashes by
//   5  4.7-5.7  bounced: grey fighters come out of the sun firing, pass on both sides
//   6  5.7-7.0  turning fight: camera fixed to our aircraft, horizon on edge, the grey fighter catches fire
//   7  7.0-8.2  it blows up dead ahead and we fly through the fireball
//   8  8.2-10   out of the smoke: our fighter leads its flight, the battle behind; the logo lands at 8.95
//   loop 10-18  shot 8 held; everything in it repeats every 8 s
const C = require('./core.cjs');
const { DEG, TAU, add, sub, mul, mad, norm, clamp, lerp, smooth, sstep, pulse, wob, rnd, flyBasis, toWorld, FPS } = C;
const Wd = require('./world.cjs');
const Fx = require('./fx.cjs');
const { MODELS } = require('./models.cjs');
const Battle = require('./battle.cjs');

const INTRO = 10, LOOP = 8, LOOP_START = INTRO * FPS, FRAMES = (INTRO + LOOP) * FPS;
const STARTS = [0, 1.6, 2.6, 3.9, 4.7, 5.7, 7.0, 8.2];
const KIND = { shot: 0, burst: 1, boom: 2, bigboom: 3, whoosh: 4, flak: 5, title: 6, barsoff: 7, hit: 8, cannon: 9, gunners: 10, flaknear: 11, heavypass: 12, rumble: 13, fire: 14, fireball: 15 };
const TITLE_T = 8.95;
// Sound cues: t = the moment the sound is first heard (near: the frame it happens on; far: 0.3-0.8 s after the picture).
// pan -100 left edge .. +100 right edge (where the source is on screen), level 0-200 (100 = normal), dur in frames (0 = the kind's default).
const CUE_LIST = [
  ...STARTS.map(t => ({ k: 'shot', t, pan: 0, level: 100, dur: 0 })),
  // 1: the raid
  { k: 'flak', t: .3, pan: 40, level: 55, dur: 0 },
  { k: 'flak', t: .88, pan: 20, level: 60, dur: 0 },               // the burst at 0.50, 360 m out
  { k: 'flaknear', t: 1.0, pan: -10, level: 120, dur: 0 },          // the burst at 1.00, 95 m ahead, closing
  { k: 'boom', t: 1.2, pan: -15, level: 70, dur: 0 },               // the bomber's engine blows at 0.78, far off
  { k: 'heavypass', t: 1.52, pan: 35, level: 150, dur: 0 },
  // 2: the dive
  { k: 'flak', t: 1.75, pan: -50, level: 50, dur: 0 },
  { k: 'whoosh', t: 2.1, pan: -60, level: 140, dur: 0 },
  { k: 'whoosh', t: 2.3, pan: -40, level: 90, dur: 0 },
  // 3: gun run
  { k: 'flaknear', t: 2.7, pan: 55, level: 110, dur: 0 },
  { k: 'burst', t: 2.72, pan: 0, level: 120, dur: 11 },
  { k: 'gunners', t: 2.95, pan: 10, level: 70, dur: 28 },
  { k: 'flaknear', t: 2.9, pan: -45, level: 120, dur: 0 },
  { k: 'hit', t: 3.02, pan: 10, level: 60, dur: 0 },
  { k: 'burst', t: 3.22, pan: 0, level: 120, dur: 12 },
  { k: 'hit', t: 3.3, pan: 15, level: 60, dur: 0 },
  { k: 'flaknear', t: 3.32, pan: 45, level: 125, dur: 0 },
  { k: 'boom', t: 3.46, pan: 20, level: 110, dur: 0 },              // the engine goes up
  { k: 'fire', t: 3.5, pan: 20, level: 70, dur: 12 },
  { k: 'boom', t: 3.66, pan: 25, level: 70, dur: 0 },               // and again 0.2 s later
  { k: 'heavypass', t: 3.84, pan: 30, level: 130, dur: 0 },
  // 4: the wing goes
  { k: 'bigboom', t: 4.07, pan: 5, level: 170, dur: 0 },
  { k: 'fire', t: 4.12, pan: 0, level: 90, dur: 16 },
  { k: 'boom', t: 4.408, pan: 0, level: 90, dur: 0 },               // second blast (slow motion)
  { k: 'boom', t: 4.548, pan: -20, level: 75, dur: 0 },              // the falling wing
  { k: 'whoosh', t: 4.53, pan: -70, level: 130, dur: 0 },           // our fighter through the foreground
  // 5: bounced
  { k: 'cannon', t: 4.8, pan: 0, level: 110, dur: 20 },
  { k: 'hit', t: 5.12, pan: -35, level: 130, dur: 0 },
  { k: 'hit', t: 5.2, pan: -45, level: 120, dur: 0 },
  { k: 'hit', t: 5.28, pan: -55, level: 110, dur: 0 },
  { k: 'whoosh', t: 5.42, pan: -75, level: 150, dur: 0 },
  { k: 'whoosh', t: 5.49, pan: 75, level: 140, dur: 0 },
  { k: 'whoosh', t: 5.57, pan: 10, level: 120, dur: 0 },
  // 6: the turning fight
  { k: 'burst', t: 5.9, pan: 0, level: 120, dur: 9 },
  { k: 'burst', t: 6.42, pan: 0, level: 120, dur: 10 },
  { k: 'hit', t: 6.54, pan: 10, level: 80, dur: 0 },
  { k: 'hit', t: 6.64, pan: 10, level: 80, dur: 0 },
  { k: 'boom', t: 6.7, pan: 15, level: 120, dur: 0 },
  { k: 'fire', t: 6.74, pan: 15, level: 80, dur: 24 },
  { k: 'boom', t: 6.85, pan: 20, level: 70, dur: 0 },
  // 7: through the fireball
  { k: 'burst', t: 7.08, pan: 0, level: 120, dur: 10 },
  { k: 'hit', t: 7.14, pan: 0, level: 85, dur: 0 },
  { k: 'hit', t: 7.26, pan: 0, level: 85, dur: 0 },
  { k: 'bigboom', t: 7.55, pan: 0, level: 200, dur: 0 },
  { k: 'boom', t: 7.72, pan: 15, level: 100, dur: 0 },
  { k: 'boom', t: 7.84, pan: -25, level: 80, dur: 0 },
  { k: 'whoosh', t: 7.78, pan: -60, level: 130, dur: 0 },           // the torn wing tumbling past
  { k: 'fireball', t: 7.8, pan: 0, level: 150, dur: 10 },
  // 8: out of the smoke
  { k: 'flak', t: 8.5, pan: -40, level: 45, dur: 0 },
  { k: 'barsoff', t: 8.65, pan: 0, level: 100, dur: 0 },
  { k: 'title', t: TITLE_T, pan: 0, level: 100, dur: 0 },
  { k: 'bigboom', t: TITLE_T + .35, pan: 30, level: 110, dur: 0 },  // the bomber blowing up 520 m away as the title lands
  { k: 'flak', t: 9.6, pan: -30, level: 40, dur: 0 }
];
// frame = first frame at or after t (a cue never comes before its picture)
const CUES = CUE_LIST.concat(Battle.CUES || []).map(c => ({ k: typeof c.k === 'string' ? KIND[c.k] : c.k, f: Math.max(0, Math.ceil(c.t * FPS - 1e-6)), pan: Math.round(clamp(c.pan || 0, -100, 100)), level: Math.round(clamp(c.level === undefined ? 100 : c.level, 0, 200)), dur: Math.round(clamp(c.dur || 0, 0, 255)) }))
  .filter(c => c.f < LOOP_START).sort((a, b) => a.f - b.f || a.k - b.k);
// Camera kicks (film.cjs): a jolt thrown away from the blast, then a damped spring. Values are ~75 % of the research table
// ("shake gently"); s scales a preset for distance. Only in the intro: the menu loop never shakes for a blast.
const KICK = {
  wing: { K: 7.5, A: 5.2, f: 9, decay: .45, jitter: 1.5, roll: .6, zoom: .03, dur: 1.2 },
  ahead: { K: 9, A: 6, f: 10, decay: .5, jitter: 1.8, roll: .75, zoom: .045, dur: 1.3 },
  engine: { K: 3, A: 2.2, f: 10, decay: .25, jitter: .8, roll: 0, zoom: .012, dur: .6 },
  flaknear: { K: 4.5, A: 3, f: 10, decay: .25, jitter: 1.1, roll: .3, zoom: .008, dur: .5 },
  flakmid: { K: 1.9, A: 1.1, f: 10, decay: .2, jitter: .4, roll: 0, zoom: 0, dur: .4 },
  far: { K: 0, A: 1.6, f: 7.5, decay: .5, jitter: 0, roll: 0, zoom: 0, dur: .8 },
  hit: { K: 1.2, A: 0, f: 10, decay: .1, jitter: 1, roll: 0, zoom: 0, dur: 4 / 30 }
};
function kick(sc, tau, at, kind, s = 1, delay = 0) {
  const P = KICK[kind], ta = tau - delay; if (sc.t >= INTRO || ta < 0 || ta > P.dur) return;
  sc.kicks.push({ tau: ta, at, K: P.K * s, A: P.A * s, f: P.f, decay: P.decay, jitter: P.jitter * s, roll: P.roll * s, zoom: P.zoom * s, dur: P.dur });
}
// hit-stop: blast time for r s of real time after a big blast: jump to 0.03 s and hold ~2 frames, catch up by 0.45 s
const hitStop = r => r < 0 ? r : r < .1 ? .03 + r * .08 : r < .45 ? .038 + (r - .1) * (.412 / .35) : r;

const STATIC = Wd.deck().concat(Wd.FAR);
const propAng = t => t * 1200 * DEG;                       // 40 degrees a frame: whole thirds of a turn every loop
const VEL = MODELS.velmark, KRU = MODELS.kruland, HVY = MODELS.heavy;
const bez = (a, b, c, u) => { const v = 1 - u; return [a[0] * v * v + 2 * b[0] * v * u + c[0] * u * u, a[1] * v * v + 2 * b[1] * v * u + c[1] * u * u, a[2] * v * v + 2 * b[2] * v * u + c[2] * u * u]; };
const scene = () => ({ insts: [], fx: [], lights: [], post: {}, deck: { off: [0, 0] }, clouds: STATIC, shake: 0, kicks: [] });

// ---------------------------------------------------------------- the bomber stream
// A box of 12: four vics of three, stacked high right / low left / low trailing.
const BOX = [];
for (const [ex, ey, ez] of [[0, 0, 0], [95, -75, 52], [-95, -75, -52], [0, -165, -95]]) for (const [wx, wy, wz] of [[0, 0, 0], [40, -34, 8], [-40, -34, -8]]) BOX.push([ex + wx, ey + wy, ez + wz]);
const BOXES = [[0, 0, 0], [-420, -900, 150], [400, -1000, -150], [-80, -2100, 20], [-520, -3000, 200], [430, -3200, -190], [0, -4300, 60], [-460, -5400, 180], [380, -5600, -120], [-150, -6800, 60], [330, -8000, -80], [-380, -9200, 140]];
const NORTH = [0, 1, 0], BN = flyBasis(NORTH, 0);
// lead: position of the first bomber; tp: periodic clock for the bobbing; o: { skip: Set of ids, boxes, contrails, dim }
function bomberAt(lead, id, tp) {
  const b = BOXES[Math.floor(id / 12)], k = BOX[id % 12], w = TAU * (1 + id % 3) / LOOP;
  return [lead[0] + b[0] + k[0] + Math.sin(tp * w + id) * 1.6, lead[1] + b[1] + k[1] + Math.sin(tp * w * 2 + id * 2.3) * 1.2, lead[2] + b[2] + k[2] + Math.cos(tp * w + id * 1.7) * 2];
}
function stream(sc, lead, t, tp, o = {}) {
  const nb = o.boxes || BOXES.length, list = [];
  for (let id = 0; id < nb * 12; id++) {
    const pos = bomberAt(lead, id, tp);
    list.push(pos);
    if (o.skip && o.skip.has(id)) continue;
    sc.insts.push({ model: 'heavy', pos, B: flyBasis(NORTH, Math.sin(tp * TAU / LOOP * (1 + id % 2) + id) * .035), prop: propAng(t) + id });
    if (o.contrails !== false) for (const side of [-7, 7]) Fx.contrail(sc, [pos[0] + side, pos[1] - 16, pos[2] + 1], NORTH, o.trail || 1300, 5.5, .3);
  }
  return list;
}
// Flak bursting in a volume that travels with the stream: `rate` bursts a second, each hangs for `life` seconds.
function flakField(sc, t, centre, ext, rate, seed, life = 6, drift = [0, 0, 0]) {
  for (let k = Math.ceil((t - life) * rate); k <= Math.floor(t * rate); k++) {
    const tb = k / rate, c = centre(tb), tau = t - tb, s = seed * 97 + k;
    Fx.flak(sc, tau, [c[0] + (rnd(s, 1) - .5) * ext[0] + drift[0] * tau, c[1] + (rnd(s, 2) - .5) * ext[1] + drift[1] * tau, c[2] + (rnd(s, 3) - .5) * ext[2] + drift[2] * tau], s, .8 + .6 * rnd(s, 4), life);
  }
}
const inst = (model, pos, B, t, more) => ({ model, pos, B, prop: propAng(t), ...more });
const local = (m, B, pos, p) => toWorld(B, pos, m.scale, p);
// camera riding on an aircraft: offset in metres (forward, left, up) in its own frame
const ride = (B, pos, off) => toWorld(B, pos, 1, off);
// wing-tip vapour: ribbons along where the tips have been
function vapour(sc, tipAt, t, n = 9, dt = .035, alpha = .55) {
  for (let k = 0; k < n; k++) sc.fx.push({ k: 't', a: tipAt(t - k * dt), b: tipAt(t - (k + 1) * dt), w: .5 + k * .16, c: [1, .9, .86], a0: alpha * (1 - k / n), a1: alpha * (1 - (k + 1) / n) });
}

// ---------------------------------------------------------------- 1: the raid
function shot1(sc, u, t) {
  const lead = [0, 85 * t, 2800];
  const camAt = v => [90 - 4 * v, 780 - 62 * v, 2760 + 3 * v], cam = camAt(u), camE = camAt(1.6);
  sc.cam = { pos: cam, target: [cam[0] - 150, cam[1] - 3000, cam[2] + 80 - 10 * u], fov: 30, roll: -.05 + .02 * u };
  const hitId = 14, th = .78;                                    // a bomber in the second box takes a burst in an engine
  const all = stream(sc, lead, t, t, { skip: new Set([hitId]) });
  const hb = all[hitId], sink = u > th ? (u - th) * (u - th) * 18 : 0, hp = [hb[0], hb[1], hb[2] - sink], hB = flyBasis([0, 1, -sink * .01], u > th ? (u - th) * .5 : 0);
  sc.insts.push(inst('heavy', hp, hB, t, { marks: u > th ? [{ p: [8, 20, 5], r: 7 }] : null }));
  const engAt = te => { const q = bomberAt([0, 85 * te, 2800], hitId, te), s = te > th ? (te - th) * (te - th) * 18 : 0; return [q[0] - 4.6, q[1] + 2, q[2] - s + .9]; };
  Fx.flak(sc, u - th + .04, add(engAt(th), [-3, 0, 2]), 5, 1.1);
  Fx.explosion(sc, u - th, engAt(th), 7, 3, [0, 85, 0], { lobes: 9, debris: 4, sparks: 14, life: 3, pre: .15 });
  Fx.explosion(sc, u - th - .2, add(engAt(th + .2), [5, 0, 1.5]), 3.6, 31, [0, 85, 0], { debris: 2, sparks: 8, tongues: 2, fingers: 2, life: 2.4 });   // the tank next to it goes 0.2 s later
  kick(sc, u - th, engAt(th), 'far', .7, .45);
  if (u > th) { Fx.fireJet(sc, engAt(u), [0, -1, .1], 2.6, t, 4, 1.2); Fx.smokeTrail(sc, engAt, t, { from: th, rate: 26, life: 3, r0: 1.6, grow: 5, a: .85, seed: 4, warm: .5 }); }
  // the flight that passes over us: its leader's inner engine comes straight at the lens and wipes the frame
  const near = [camE[0] - 4.6 + .95, camE[1] - 5.2 - 85 * (1.6 - u), camE[2] - .39 - .35];      // its right inner engine meets the camera at u = 1.6
  for (const [dx, dy, dz, id] of [[0, 0, 0, 900], [46, -30, 9, 901], [-44, -36, -7, 902]]) {
    const p = [near[0] + dx, near[1] + dy, near[2] + dz];
    sc.insts.push(inst('heavy', p, flyBasis(NORTH, .02 * Math.sin(t * 2 + id)), t + id));
    for (const side of [-7, 7]) Fx.contrail(sc, [p[0] + side, p[1] - 16, p[2] + 1], NORTH, 900, 5.5, .4);
  }
  flakField(sc, t, tb => [0, 85 * tb - 1500, 2800], [1900, 4200, 520], 16, 1, 6);
  flakField(sc, t, tb => [cam[0] - 120, cam[1] - 520, 2880], [520, 700, 200], 5, 2, 5);
  const fk1 = add(camAt(.5), [-150, -330, 12]), fk2 = add(camAt(1), [-30, -92, -8]);           // hang in the air: we fly towards them
  Fx.flak(sc, u - .5, fk1, 11, 1.3); kick(sc, u - .5, fk1, 'flakmid', .6);
  Fx.flak(sc, u - 1.0, fk2, 12, 1.25); kick(sc, u - 1.0, fk2, 'flaknear', .8);
  // two that went down before we arrived: long smoke scars across the sky
  for (const [k, x, y, vz] of [[1, -1500, -2600, -55], [2, 900, -4200, -70]]) Fx.smokeTrail(sc, te => [x + te * 20, y + 85 * 0 + te * 40, 2700 + vz * (te + 9)], t, { from: -9, rate: 5, life: 10, r0: 6, grow: 9, a: .62, seed: 40 + k, pow: 1 });
  sc.post.white = 1 - sstep(0, .27, u);
  sc.shake = .7 + 6 * sstep(1.45, 1.6, u);                         // engines and the heavy's wash; blasts kick (see kick)
}

// ---------------------------------------------------------------- 2: the dive out of the sun
function shot2(sc, u, t) {
  const cam = [760, 0, 3420];
  const p0 = add(cam, [95, 16, 30]), p2 = add(cam, [-70, -12, -60]), mid = [cam[0] + 5, cam[1] + 8, cam[2] + 4];   // passes 10 m from the lens half way
  const ctrl = [2 * mid[0] - (p0[0] + p2[0]) / 2, 2 * mid[1] - (p0[1] + p2[1]) / 2, 2 * mid[2] - (p0[2] + p2[2]) / 2];
  const path = (v, k) => { const w = clamp(v), q = bez(p0, ctrl, p2, w); return k ? [q[0] + k[0], q[1] + k[1], q[2] + k[2]] : q; };
  const v = .08 + u * .84;
  for (const [i, off, lag] of [[0, null, 0], [1, [26, 30, 16], .1], [2, [44, -34, 26], .19], [3, [70, 12, 44], .29]]) {
    const w = v - lag, pos = path(w, off), dir = sub(path(w + .01, off), path(w - .01, off));
    sc.insts.push(inst('velmark', pos, flyBasis(dir, Math.PI * (1 - sstep(.05, .38, w)) + .25 * Math.sin(w * 9 + i)), t + i));
  }
  const look = path(clamp(v - .03 + .06 * sstep(.4, .7, v)));
  sc.cam = { pos: cam, target: look, fov: 58, roll: .14 - .3 * sstep(.4, .75, v) };
  stream(sc, [470, 60 + 85 * u, 3200], t, t, { boxes: 8 });
  flakField(sc, t, tb => [470, 85 * (tb - 1.6) - 600, 3210], [1500, 3200, 420], 14, 3, 6);
  sc.shake = 1 + 7 * pulse(.44, .52, .58, .8, u);
  sc.post.flash = .25 * pulse(.47, .52, .55, .62, u); sc.post.tint = [1, .93, .8];
}

// ---------------------------------------------------------------- 3: gun run
const S3 = (() => {
  const tb = u => [0, 85 * u, 2800], vf = mul(norm([.012, -1, -.03]), 105), pass = add(tb(1.27), [8.5, 0, -6.2]);
  const fp = u => mad(pass, vf, u - 1.27), bank = u => .16 * wob(u * 1.4, 3) + .22 * pulse(.55, .7, .8, 1, u) - .3 * sstep(1.05, 1.3, u);
  const fB = u => flyBasis(vf, bank(u));
  const eng = u => local(HVY, BN, tb(u), [10, -42, 5.2]);
  return { tb, vf, fp, fB, eng, fire: [[.12, .5], [.62, 1.02]], blow: .86 };
})();
function shot3(sc, u, t) {
  const { tb, vf, fp, fB, eng } = S3, dir = norm(vf), B = fB(u), pos = fp(u);
  const all = stream(sc, tb(u), t, t, { skip: new Set([0]), boxes: 9 });
  const burn = u > S3.blow;
  sc.insts.push(inst('heavy', tb(u), BN, t, { marks: u > .44 ? [{ p: [8, -42, 5.4], r: burn ? 7 : 3.5 }, { p: [3, -33, 4.2], r: 2.5 }] : null, stopped: burn ? [0] : null }));
  sc.insts.push(inst('velmark', pos, B, t));
  const lag = fp(u - .045), B0 = flyBasis(vf, 0);
  sc.cam = { pos: ride(B0, lag, [-13, -3.6, 2.3]), target: add(mad(pos, dir, 85), [0, 0, 5]), fov: 50, roll: .05 * wob(u * 2, 5) + bank3(u) };
  for (const [a, b] of S3.fire) for (const g of [0, 1]) {
    const mz = te => local(VEL, fB(te), fp(te), VEL.guns[g]);
    const aim = te => { const m = mz(te), d = Math.hypot(...sub(eng(te), m)), tg = add(eng(te + d / 800), [g ? 3.5 : 0, 0, g ? 2.2 : 0]); return norm(sub(tg, m)); };
    Fx.tracers(sc, t, t - u + a, t - u + b, te => mz(te - t + u), te => aim(te - t + u), { rate: 15, phase: g * .5, seed: 30 + g, reach: g ? 760 : te => Math.hypot(...sub(eng(te - t + u), mz(te - t + u))) * 1.02, maxReach: 760 });
  }
  // the gunners answer: pale green streams from the target and its wingmen, wide of us
  for (const [id, gun, sp, s] of [[0, 0, .028, 1], [0, 3, .035, 2], [1, 0, .05, 3], [2, 0, .05, 4], [4, 0, .06, 5]]) {
    const gp = te => local(HVY, BN, bomberAt(tb(te), id, te + 2.6), HVY.guns[gun]);
    Fx.tracers(sc, t, t - u + .02 + s * .04, t - u + 1.12, te => gp(te - t + u), te => norm(sub(add(fp(te - t + u + .35), [s * 2 - 5, 0, 3 - s]), gp(te - t + u))), { rate: 11, colour: 1, spread: sp, reach: 620, seed: 50 + s, flashR: 1.2 });
  }
  for (let k = 0; k < 9; k++) { const th = k < 3 ? .42 + k * .035 : .7 + (k - 3) * .045; Fx.hit(sc, u - th, local(HVY, BN, tb(th), [-1 + rnd(k, 60) * 12, -34 - rnd(k, 61) * 11, 5.4]), 60 + k, 1.5, [0, 85, 0]); }
  Fx.explosion(sc, u - S3.blow, eng(S3.blow), 4.6, 7, [0, 85, 0], { lobes: 9, debris: 4, sparks: 16, life: 2.5, pre: .25, spray: [-.3, 0, 1] });
  Fx.explosion(sc, u - S3.blow - .2, add(eng(S3.blow + .2), [-3.2, 0, 1.2]), 2.8, 77, [0, 85, 0], { debris: 2, sparks: 8, tongues: 2, fingers: 2, life: 2 });
  kick(sc, u - S3.blow, eng(S3.blow), 'engine', .75); kick(sc, u - S3.blow - .2, eng(S3.blow + .2), 'engine', .4);
  if (burn) { Fx.fireJet(sc, eng(u), [0, -1, .12], 2.3, t, 8, 1.3); Fx.smokeTrail(sc, te => eng(te - 2.6), t, { from: 2.6 + S3.blow, rate: 34, life: 2.4, r0: 1.3, grow: 6, a: .85, seed: 9, warm: .6 }); }
  flakField(sc, t, te => [0, 85 * (te - 2.6) - 900, 2800], [1500, 2600, 420], 9, 5, 6);
  for (const [th, at, s, sd, sz] of [[.3, add(fp(.66), [-17, 0, 7]), .9, 21, 1.2], [.72, add(fp(1.0), [15, 0, -6]), 1, 22, 1.1], [.1, add(fp(.52), [26, 0, 13]), .7, 23, 1]]) { Fx.flak(sc, u - th, at, sd, sz); kick(sc, u - th, at, 'flaknear', s); }
  const firing = S3.fire.some(([a, b]) => u >= a && u <= b);
  sc.shake = 1.1 + (firing ? 1.3 : 0) + 5 * sstep(1.12, 1.3, u);   // guns and the bomber's wash; blasts kick
}
const bank3 = u => .05 * pulse(.55, .7, .8, 1, u) - .12 * sstep(1.05, 1.3, u);

// ---------------------------------------------------------------- 4: the wing goes
const S4 = { blow: .17 };
// blast time for r s of real time: impact frame, a 2-frame hold, half speed until u = 0.5, then real time
const warp4 = r => r < 0 ? r : r < .1 ? .03 + (r - .03) * .1 : r < .33 ? .037 + (r - .1) * .5 : .152 + (r - .33);
function shot4(sc, u, t) {
  const xb = v => [0, 85 * v, 2800], u0 = S4.blow, r = u - u0;
  const tau = warp4(r);
  const c = xb(tau < 0 ? u : u0 + tau);                            // the camera and the rest of the stream slow down with the blast
  sc.cam = { pos: add(c, [62 - 6 * u, 22 - 12 * u, -11]), target: add(c, [0, 3 - 9 * Math.max(0, tau), 1 - 10 * Math.max(0, tau)]), fov: 27 - 2 * sstep(0, .8, u), roll: .04 };
  stream(sc, c, t, t, { skip: new Set([0]), boxes: 6 });
  const cut = local(HVY, BN, xb(u0), [2, -30, 3.6]), eng = v => local(HVY, BN, xb(v), [10, -42, 5.2]);
  Fx.explosion(sc, tau, cut, 9.5, 11, [0, 70, 0], { kind: 'big', pre: .17, preVel: [0, 85, 0], spray: [.4, -.3, 1], age: r, soot: .03 });   // fuel sprays from the wing root first; colour and smoke age in real time through the slow motion
  kick(sc, r, cut, 'wing');
  if (tau < 0) {
    sc.insts.push(inst('heavy', xb(u), BN, t, { marks: [{ p: [8, -42, 5.4], r: 7 }, { p: [3, -33, 4.2], r: 3 }], stopped: [0] }));
    Fx.fireJet(sc, eng(u), [0, -1, .12], 2.6, t, 8, 1.5);
  } else {
    const roll = -1.5 * tau * tau - .5 * tau, bp = add(xb(u0), [0, 85 * tau * (1 - .12 * tau), -6 * tau * tau]), bB = flyBasis([0, 1, -.22 * tau], roll);
    sc.insts.push(inst('heavy_body', bp, bB, t, { marks: [{ p: [3, -27, 4.2], r: 6 }], only: [1, 2, 3] }));
    const stub = local(HVY, bB, bp, [2, -29, 3.6]);
    Fx.fireJet(sc, stub, [0, -1, .2], 3.4, t, 12, 1.6);
    const wp = add(cut, [9 * tau, 85 * tau * (1 - .45 * tau), 7 * tau - 16 * tau * tau]);
    sc.insts.push({ model: 'heavy_wing', pos: wp, B: C.tumble(1.9 * tau, 5.2 * tau + .1, 1.1 * tau), pivot: [4, -48, 5.6], noProps: true, marks: [{ p: [8, -42, 5.4], r: 8 }] });
    Fx.fireJet(sc, wp, [0, -1, .5], 2.4, t, 13, 1.3);
    Fx.explosion(sc, tau - .16, add(cut, [-1, 9, 1]), 5.5, 12, [0, 75, 0], { lobes: 10, debris: 4, sparks: 14, age: r - .338 });          // the next tank, 0.16 s of blast time later
    Fx.explosion(sc, tau - .3, add(wp, [0, 2, 0]), 4.4, 13, [0, 40, 0], { lobes: 8, debris: 3, sparks: 10, tongues: 3, age: r - .478 });  // the wing's own tank
    kick(sc, r - .338, cut, 'engine', .6); kick(sc, r - .478, wp, 'engine', .45);
    Fx.smokeTrail(sc, te => { const ta = warp4(te - 3.9 - u0); return add(xb(u0), [6.9, 85 * ta * (1 - .12 * ta), -6 * ta * ta + .8]); }, t, { from: 3.9 + u0, rate: 40, life: 2, r0: 2, grow: 7, a: .9, seed: 14, warm: .7 });
    if (r < .04) sc.post.impact = 2;                                 // one 2-tone frame, then 2 frames of fading white
    else sc.post.flash = Math.min(.4, .4 * Math.exp(-(r - .06) / .03));
    sc.post.tint = [1, .92, .74];
    sc.post.ca = r < .2 ? 2 : r < .32 ? 1 : 0;
  }
  Fx.smokeTrail(sc, te => eng(te - 3.9), t, { from: 2.9, to: 3.9 + S4.blow, rate: 30, life: 2.2, r0: 1.4, grow: 6, a: .85, seed: 9, warm: .5 });
  // our fighter, the one that did it, flashes through the foreground
  const fu = (u - .6) * 176, fpz = [40, c[1] + 26 - fu, 2791 + (u - .6) * -12];
  if (u > .44 && u < .78) sc.insts.push(inst('velmark', fpz, flyBasis([0, -1, -.07], -.5), t));
  flakField(sc, t, te => [0, 85 * (te - 3.9) - 500, 2780], [1300, 2400, 420], 12, 6, 6);
  sc.shake = .6 + (r >= 0 ? 1.2 : 0);                               // buffeting after the blast; the blast itself kicks
}

// ---------------------------------------------------------------- 5: bounced out of the sun
function shot5(sc, u, t) {
  const fp = v => [160 * v, 0, 3000 + 4 * Math.sin(v * 2)], bank = -.62 * sstep(.6, .92, u) + .05 * wob(u * 2, 7), B = flyBasis([1, 0, .02 - .12 * sstep(.6, 1, u)], bank), pos = fp(u);
  const marks = [.42, .5, .58].map((th, i) => u > th ? { p: [3.5 - i * 2.2, 17 + i * 5, 1.2], r: 1.5 } : null).filter(Boolean);
  sc.insts.push(inst('velmark', pos, B, t, { marks: marks.length ? marks : null }));
  sc.cam = { pos: ride(B, pos, [1.75, 0, 1.0]), target: ride(B, pos, [100, 0, -1.6]), fov: 68, roll: -bank * .85 };
  const tp = .72;
  for (const [i, off, lag, vy, vz] of [[0, [0, 7.5, 3.4], 0, 6, -14], [1, [0, -9.5, 1.6], .07, -9, -11], [2, [0, 1.5, 7.5], .15, 2, -20]]) {
    const ev = [-168, vy, vz], cp = add(fp(tp + lag), off), ep = v => mad(cp, add(ev, [160, 0, 0]), 0).map((q, k) => cp[k] + ev[k] * (v - tp - lag));
    const eB = v => flyBasis(ev, (i === 2 ? 1.6 : i ? -.4 : .5) * sstep(tp + lag - .25, tp + lag + .1, v) + .1 * Math.sin(v * 7 + i));
    sc.insts.push(inst('kruland', ep(u), eB(u), t + i));
    for (const g of [0, 1]) {
      const mz = te => local(KRU, eB(te - t + u), ep(te - t + u), KRU.guns[g]);
      Fx.tracers(sc, t, t - u + .0 + i * .04, t - u + tp + lag - .14, mz, te => norm(sub(add(fp(te - t + u + .3), [0, (g ? 3 : -2.5) + i * 1.2, .9 + i * .5]), mz(te))), { rate: 14, colour: 1, spread: .011, reach: 520, seed: 70 + i * 2 + g, phase: g * .5, flashR: 1.6 });
    }
  }
  [.42, .5, .58].forEach((th, i) => { const hp = local(VEL, B, pos, [3.5 - i * 2.2, 17 + i * 5, 1.4]); Fx.hit(sc, u - th, hp, 80 + i, .8, [160, 0, 0]); kick(sc, u - th, hp, 'hit'); });
  sc.post.sight = { x: 240 + 3 * wob(u * 3, 23), y: 122 + 3 * wob(u * 3.4, 24), a: .8 };
  sc.shake = 1 + 1.5 * pulse(.4, .43, .6, .7, u) + 8 * pulse(.66, .72, .78, .95, u);   // rounds rattling the airframe, then the enemies' wash
  sc.post.flash = .18 * pulse(.4, .43, .45, .5, u) + .18 * pulse(.48, .51, .53, .58, u); sc.post.tint = [1, .95, .8];
}

// ---------------------------------------------------------------- 6: the turning fight
const S6 = (() => {
  const om = .5, th0 = -2.25, rad = 300, cc = [0, 0, 3000];
  const our = v => { const a = th0 + om * v; return [cc[0] + rad * Math.cos(a), cc[1] + rad * Math.sin(a), cc[2] - 9 * v]; };
  const dirAt = (v, d = 0) => { const a = th0 + om * v + d; return [-Math.sin(a), Math.cos(a), -.03]; };
  const enemy = v => { const a = th0 + om * v + .135 - .04 * sstep(.8, 1.3, v), r = rad - 5 + 6 * Math.sin(v * 5); return [cc[0] + r * Math.cos(a), cc[1] + r * Math.sin(a), cc[2] - 9 * v + 5 + 3 * Math.sin(v * 4)]; };
  const ob = v => flyBasis(dirAt(v), -1.3 + .06 * wob(v * 2, 9));
  const eb = v => flyBasis(dirAt(v, .135), -1.36 + .22 * Math.sin(v * 6) + 1.1 * sstep(1.02, 1.3, v));
  return { our, enemy, ob, eb, dirAt, burn: 1.0 };
})();
function shot6(sc, u, t) {
  const { our, enemy, ob, eb } = S6, B = ob(u), pos = our(u), ep = enemy(u), eB = eb(u), burn = u > S6.burn;
  sc.insts.push(inst('velmark', pos, B, t));
  sc.insts.push(inst('kruland', ep, eB, t + 1, { marks: u > .84 ? [{ p: [14, 0, 2.6], r: burn ? 5 : 2.4 }, { p: [2, 9, -1], r: 2 }] : null, stopped: u > 1.12 ? [0] : null }));
  const ahead = ride(B, pos, [95, 0, -11]);                       // aimed low: our aircraft must clear the letterbox (27 px) at the bottom
  sc.cam = { pos: ride(B, pos, [-7.4, 1.5, 2.9]), target: C.mix3(ahead, ep, .5), fov: 52, roll: 1.3 * .93 + .03 * wob(u * 3, 11) };
  for (const [a, b, lead] of [[.2, .5, 0], [.72, 1.06, 1]]) for (const g of [0, 1]) {
    const mz = te => local(VEL, ob(te - t + u), our(te - t + u), VEL.guns[g]);
    const aim = te => { const v = te - t + u, m = mz(te); return lead ? norm(sub(add(enemy(v + .17), [0, 0, g ? .6 : -.4]), m)) : norm(add(ob(v)[0], mul(ob(v)[2], .035))); };
    Fx.tracers(sc, t, t - u + a, t - u + b, mz, aim, { rate: 24, phase: g * .5, seed: 90 + g + lead * 2, reach: lead ? 41 + g * 300 : 640, speed: 380, len: 9 });
  }
  for (let k = 0; k < 6; k++) { const th = .84 + k * .035; Fx.hit(sc, u - th, local(KRU, eb(th), enemy(th), [14 - k * 3, (k % 2 ? 6 : -4), 1]), 100 + k, .9, mul(S6.dirAt(th, .135), 150)); }
  const eng = v => local(KRU, eb(v), enemy(v), [17, 0, 1.2]);
  const ev6 = mul(S6.dirAt(S6.burn, .135), 140);
  Fx.explosion(sc, u - S6.burn, eng(S6.burn), 3.4, 15, ev6, { lobes: 8, debris: 3, sparks: 14, life: 2, flash: .45, pre: .2, preVel: mul(S6.dirAt(S6.burn, .135), 150) });
  Fx.explosion(sc, u - S6.burn - .15, eng(S6.burn + .15), 2, 18, ev6, { debris: 2, sparks: 8, tongues: 2, fingers: 2, life: 1.6, flash: .4 });
  kick(sc, u - S6.burn, eng(S6.burn), 'engine', .8); kick(sc, u - S6.burn - .15, eng(S6.burn + .15), 'engine', .35);
  if (burn) { Fx.fireJet(sc, eng(u), mul(eB[0], -1), 1.5, t, 16, 1.4); Fx.smokeTrail(sc, te => eng(te - 5.7), t, { from: 5.7 + S6.burn, rate: 44, life: 1.8, r0: .8, grow: 4.6, a: .88, seed: 17, warm: .7 }); }
  for (const s of [0, 1]) { vapour(sc, te => local(VEL, ob(te - 5.7), our(te - 5.7), VEL.tips[s]), t); vapour(sc, te => local(KRU, eb(te - 5.7), enemy(te - 5.7), KRU.tips[s]), t, 11, .04, .6); }
  flakField(sc, t, te => [600, -300, 2900], [1400, 1400, 500], 3, 8, 6);
  const firing = (u >= .2 && u <= .5) || (u >= .72 && u <= 1.06);
  sc.shake = 1.5 + (firing ? 1.2 : 0);
}

// ---------------------------------------------------------------- 7: through the fireball
const S7 = (() => {
  const ev = [-128, 0, -5], ep = v => [ev[0] * v, 3.2, 3003.4 + ev[2] * v], fp = v => [ev[0] * v + 42 - 30 * v, .5, 3000 + ev[2] * v + .9];
  return { ev, ep, fp, blow: .55 };
})();
// Flying through: embers and torn metal hanging in the fireball stream past the lens (streaked by our own speed).
function throughFire(sc, tau, c0, drift, camVel) {
  if (tau < .12 || tau > 1) return;
  const k = C.pulse(.12, .22, .7, 1, tau);
  for (let i = 0; i < 46; i++) {
    const shard = i < 8, sy = (rnd(i, 501) < .5 ? -1 : 1) * (1.2 + 6 * rnd(i, 502)), sz = (rnd(i, 503) - .5) * 9, d = Fx.dirOf(i, 504), v = 6 + 12 * rnd(i, 505);
    const pv = C.mad(drift, d, v), p = add(add(c0, [(rnd(i, 506) - .5) * 30, .5 - 3.2 + sy, 1 + sz - .65]), mul(pv, tau));
    if (shard) {
      sc.fx.push({ k: 'd', p, r: .35 + .4 * rnd(i, 507), rot: tau * (5 + 6 * rnd(i, 508)) + i, asp: .4, c: [.07, .07, .09] });
      sc.fx.push({ k: 'f', p: C.mad(p, sub(pv, camVel), -.012), r: .45, h: 1.2 * k, seed: i });
    } else {
      const tail = C.mad(p, sub(pv, camVel), -.02), cool = rnd(i, 509);
      sc.fx.push({ k: 'l', a: tail, b: p, c: [1, .75 - .3 * cool, .3 - .2 * cool], i: (.8 + .6 * rnd(i, 510)) * k, core: .6 * k, w: 1 });
    }
  }
}
function shot7(sc, uR, t) {
  const { ev, ep, fp } = S7, u0 = S7.blow, r = uR - u0, u = r < 0 ? uR : u0 + hitStop(r);   // the whole shot holds for 2 frames on the blast
  const B = flyBasis([-1, 0, -.03], .07 * wob(u * 2.4, 13)), pos = fp(u), eB = v => flyBasis(ev, .35 * Math.sin(v * 4.2) + .3);
  sc.insts.push(inst('velmark', pos, B, t));
  sc.cam = { pos: ride(B, pos, [1.75, 0, 1.0]), target: ride(B, pos, [100, 0, -1.6]), fov: 64, roll: -.06 * wob(u * 2, 14) };
  const eng = v => local(KRU, eB(v), ep(v), [17, 0, 1.2]), tau = u - u0;
  Fx.explosion(sc, tau, ep(u0), 9.5, 19, mul(ev, .6), { kind: 'big', pre: .3, preVel: ev, spray: [.3, .6, 1] });   // its tanks spray fuel for 0.3 s
  kick(sc, r, ep(u0), 'ahead');
  if (tau < 0) {
    sc.insts.push(inst('kruland', ep(u), eB(u), t, { marks: [{ p: [14, 0, 2.6], r: 6 }, { p: [2, 9, -1], r: 2.5 }, { p: [-8, -5, 1], r: 2 }], stopped: [0] }));
    Fx.fireJet(sc, eng(u), [1, 0, .05], 1.8, t, 16, 1.6);
    for (const g of [0, 1]) { const mz = te => local(VEL, B, fp(te - t + u), VEL.guns[g]); Fx.tracers(sc, t, t - u + .08, t - u + .4, mz, te => norm(sub(add(ep(te - t + u + .06), [0, g ? 1 : -1.5, .4]), mz(te))), { rate: 15, phase: g * .5, seed: 110 + g, reach: te => 42 - 30 * (te - t + u) + 3, maxReach: 60, speed: 700 }); }
    for (let k = 0; k < 7; k++) { const th = .14 + k * .04; Fx.hit(sc, u - th, local(KRU, eB(th), ep(th), [-6 + k * 2.2, (k % 3 - 1) * 7, 1.5]), 120 + k, .8, ev); }
  } else {
    const drift = mul(ev, .6), c0 = ep(u0);
    Fx.explosion(sc, tau - .12, add(c0, [3, 2, -1]), 5, 20, drift, { lobes: 10, debris: 3, sparks: 12 });
    Fx.explosion(sc, tau - .26, add(c0, [-7, -4, 2.5]), 3.8, 23, drift, { lobes: 8, debris: 2, sparks: 8, tongues: 3 });
    kick(sc, r - .17, c0, 'engine', .5); kick(sc, r - .29, c0, 'engine', .35);
    throughFire(sc, tau, c0, drift, sub(fp(u + .01), fp(u - .01)).map(v => v * 50));
    const wp = add(c0, [ev[0] * .45 * tau + 4 * tau, 3 + 2 * tau, 2.2 + 9 * tau - 12 * tau * tau]);
    sc.insts.push({ model: 'kruland_wing', pos: wp, B: C.tumble(4 * tau, 6.5 * tau + .4, 2 * tau), pivot: [3, 20, 0], noProps: true });
    Fx.fireJet(sc, wp, [1, 0, .3], 1.2, t, 21, 1.2);
    sc.insts.push({ model: 'kruland_body', pos: add(c0, [ev[0] * .7 * tau, -4 * tau, -3 * tau - 14 * tau * tau]), B: flyBasis([-1, -.1, -.5 * tau], 2.2 * tau + .3), noProps: true, marks: [{ p: [14, 0, 2.6], r: 8 }, { p: [0, -6, 0], r: 5 }] });
    if (r < .04) sc.post.impact = 1;                                 // one inverted frame, 2 frames of fading white
    else sc.post.flash = Math.min(.4, .4 * Math.exp(-(r - .05) / .03));
    sc.post.tint = [1, .9, .7];
    sc.post.ca = r < .25 ? 2 : 0;
  }
  Fx.smokeTrail(sc, te => eng(te - 7), t, { from: 6.2, to: 7 + u0, rate: 46, life: 1.6, r0: .7, grow: 3, a: .62, seed: 17, warm: .7 });
  sc.post.sight = { x: 240 + 3 * wob(u * 3, 21), y: 122 + 3 * wob(u * 3.4, 22), a: .8 * (1 - sstep(.6, .8, u)) };
  // leaving the fireball: 2D layers close in from the edges while the 3D fire still fills the middle (no seam), far layers slow and dark,
  // the near one fast, big and soft, embers streaking out along our line of flight; then smoke. Shot 8 opens a hole from the centre.
  const hl = 1.1 * (1 - sstep(.77, .91, u));
  sc.post.wash = [
    { fire: true, a: pulse(.76, .86, 1.02, 1.14, u), seed: 3, t: u, speed: 3, scale: 1, tone: -.12, hole: hl },
    { fire: true, a: .9 * pulse(.8, .89, 1.0, 1.1, u), seed: 5, t: u, speed: 6.5, scale: .75, hole: hl * .8, streak: .09 },
    { fire: true, a: pulse(.85, .92, .99, 1.06, u), seed: 11, t: u, speed: 12, scale: .45, max: .5, hole: hl * .6 },
    ...SMOKE_WASH(u, 0)];
  sc.shake = 1.4 + (u > .08 && u < .4 ? 1.2 : 0) + 3 * pulse(.8, .9, 1.1, 1.2, u);   // the rumble of flying through the fire; the blast kicks
}

// Smoke over the lens across the cut 7 -> 8, in two layers (far slow, near fast and soft); tt = shot-7 clock (continues past 1.2 into shot 8),
// v = time into shot 8 (0 during shot 7): the hole opens from the centre, the near layer clears first.
const SMOKE_WASH = (tt, v) => [
  { a: sstep(1.0, 1.1, tt) * .96 * (1 - sstep(.05, .45, v)), seed: 8, t: tt, ember: true, speed: 3, scale: 1.3, warm: 1 - sstep(1.02, 1.16, tt), hole: sstep(0, .42, v) * 1.4 },
  { a: pulse(1.0, 1.08, 1.2, 1.4, tt), seed: 13, t: tt, ember: true, speed: 9, scale: .6, max: .7, tone: .06, streak: .05, hole: sstep(0, .2, v) * 1.6 }];

// ---------------------------------------------------------------- 8 + loop: our flight, the battle behind
// tl: periodic clock (0..LOOP); e: 1 -> 0 while the camera settles at the start of shot 8
function shot8(sc, t) {
  const tl = ((t - INTRO) % LOOP + LOOP) % LOOP, u = t - STARTS[7], e = t < INTRO ? 1 - smooth(u / 1.45) : 0, w = TAU / LOOP;
  const H0 = [0, 0, 3000], bob = (k, ph) => [Math.sin(tl * w * 2 + ph) * .35 * k, 0, Math.sin(tl * w * 3 + ph * 1.7) * .5 * k];
  const hero = add(H0, bob(1, 0)), hB = flyBasis([0, 1, .012 * Math.sin(tl * w * 3 + 1)], .07 * Math.sin(tl * w * 2) - .03);
  sc.insts.push(inst('velmark', hero, hB, tl));
  for (const [i, off] of [[1, [10, -27, 3.6]], [2, [23, -55, -2.5]]]) sc.insts.push(inst('velmark', add(add(H0, off), bob(1.8, i * 2.1)), flyBasis(NORTH, .09 * Math.sin(tl * w * (1 + i % 2) + i * 1.9)), tl + i));
  sc.cam = { pos: add(H0, [8.6 + 6 * e, 21.3 + 9 * e, 2.2 + 2.5 * e]), target: add(H0, [3.6 - 3 * e, -4, -.2 - e]), fov: 39 + 7 * e, roll: .035 * Math.sin(tl * w) + .1 * e };
  sc.deck = { off: [0, -300 * tl], loop: true }; sc.clouds = Wd.deck(sc.deck.off).concat(Wd.FAR);
  // the stream, parallel to us in the west, still under fire
  const lead = [-127, -436, 3075];
  stream(sc, lead, tl, tl, { boxes: 10, trail: 1300 });
  for (let k = 0; k < 44; k++) {                                   // flak that repeats with the loop: each burst hangs 4.5 s and drifts astern
    const tb = rnd(k, 201) * LOOP, tau = ((tl - tb) % LOOP + LOOP) % LOOP, b = BOXES[k % 8];
    Fx.flak(sc, tau, [lead[0] + b[0] + (rnd(k, 202) - .5) * 520, lead[1] + b[1] + (rnd(k, 203) - .5) * 700 - 80 * tau, lead[2] + b[2] + (rnd(k, 204) - .5) * 300], 200 + k, .9 + .6 * rnd(k, 205), 4.5);
  }
  // three crippled bombers drop out of the formation above, burning, and blow up in turn (the first as the title lands);
  // they come in over the top edge and explode clear of the logo and the menu column (source x > 190)
  const c0 = C.makeCam({ pos: add(H0, [8.6, 21.3, 2.2]), target: add(H0, [3.6, -4, -.2]), fov: 39 });
  const spot = (px, py, d) => add(c0.pos, mul(add(add(mul(c0.F, c0.f), mul(c0.R, px - 240)), mul(c0.U, 135 - py)), d / c0.f));
  for (const [k, ph, px, py, d, R] of [[0, LOOP + TITLE_T - INTRO, 296, 56, 520, 12], [1, 2.3, 258, 36, 1250, 13], [2, 4.9, 222, 62, 640, 11]]) {
    const tau = ((tl - ph) % LOOP + LOOP) % LOOP, s = tau > LOOP - 2.5 ? tau - LOOP : tau, c = spot(px, py, d), vin = [-8, 30, -.085 * d - 8];
    const come = v => mad(c, vin, v), fall = v => [c[0] - 30 * v, c[1] - 55 * v, c[2] - 20 * v - 30 * v * v];
    if (s < 0) {
      const p = come(s);
      sc.insts.push(inst('heavy', p, flyBasis([0, 1, -.25], .35 + .2 * s), tl + k, { marks: [{ p: [8, 20, 5], r: 8 }], stopped: [2] }));
      Fx.fireJet(sc, add(p, [-4.6, 2, 1]), [0, -1, .25], 3.2, tl, 330 + k, 1.3);
    }
    Fx.explosion(sc, s, c, R, 300 + k, [0, -40, -12], { kind: 'far', pre: .25, preVel: vin, spray: [0, .5, 1] });   // gone by s = 5.2, the loop needs it gone by 5.5
    Fx.explosion(sc, s - .22, add(c, [9, -6, -7]), R * .5, 360 + k, [0, -40, -12], { kind: 'far', life: 4.4, debris: 3, fingers: 2, smoke: 8, lobes: 7 });
    if (k === 0 && t < INTRO) kick(sc, t - TITLE_T, c, 'far', 1, .35);   // heard and felt a beat after the flash
    if (s >= 0) {
      if (s < 3.4) { Fx.fireJet(sc, fall(s), [.3, .6, .7], 5, tl, 310 + k, 1.2 * (1 - s / 3.4)); Fx.smokeTrail(sc, te => fall(te), s, { from: 0, rate: 9, life: 2.6, r0: 4, grow: 9, a: .8 * (1 - sstep(4.2, 5.2, s)), seed: 320 + k, warm: .5 }); }
    }
    Fx.smokeTrail(sc, te => add(come(te), [-4.6, 2, 1]), s, { from: -2.5, to: 0, rate: 12, life: 2.4, r0: 2.5, grow: 8, a: .8, seed: 340 + k, warm: .4 });
  }
  for (let k = 0; k < 16; k++) {                                   // far gunfire: short orange and green stitches among the boxes
    const tb = rnd(k, 231) * LOOP, tau = ((tl - tb) % LOOP + LOOP) % LOOP; if (tau > .5) continue;
    const b = BOXES[1 + k % 7], p = [lead[0] + b[0] + (rnd(k, 232) - .5) * 600, lead[1] + b[1] + (rnd(k, 233) - .5) * 600, lead[2] + b[2] + (rnd(k, 234) - .3) * 260], d = norm([rnd(k, 235) - .5, rnd(k, 236) - .5, (rnd(k, 237) - .5) * .4]);
    for (let j = 0; j < 4; j++) { const s = (tau * 520 + j * 46) % 300; sc.fx.push({ k: 'l', a: mad(p, d, s), b: mad(p, d, s + 22), c: k % 3 ? [1, .4, .14] : [.5, 1, .55], i: 1.1 * (1 - tau / .5), core: .5, w: 1 }); }
  }
  if (t < INTRO) {                                                 // one-offs: out of the smoke, soot leaving the lens, the title flash
    sc.post.wash = SMOKE_WASH(1.2 + u, u);
    sc.post.dirt = [[90, 70, 46], [380, 190, 60], [300, 60, 34], [150, 215, 40]].map(([x, y, r], i) => ({ x, y, r, a: .26 * (1 - sstep(.2, .9 + i * .1, u)) }));
    sc.post.flash = .5 * (1 - sstep(0, .1, t - TITLE_T)) * (t >= TITLE_T ? 1 : 0); sc.post.tint = [1, .9, .72];
    sc.shake = 3 * e + 1.5 * pulse(TITLE_T, TITLE_T + .03, TITLE_T + .06, TITLE_T + .4, t);   // the title slam; the far blast kicks
  }
  sc.post.vignette = .38;
}

const FN = [shot1, shot2, shot3, shot4, shot5, shot6, shot7];
function sceneAt(frame) {
  const t = frame / FPS, sc = scene();
  let k = 0; for (let i = 1; i < STARTS.length; i++) if (t >= STARTS[i] - 1e-6) k = i;
  sc.shot = k; sc.t = t;
  if (k === 7) shot8(sc, t); else FN[k](sc, t - STARTS[k], t);
  Battle.populate(sc, { t, shot: k, loopT: k === 7 ? ((t - INTRO) % LOOP + LOOP) % LOOP : null });
  return sc;
}

module.exports = { sceneAt, FRAMES, LOOP_START, CUES, STARTS, KIND };

'use strict';
// Title intro (about 10 s, played by the view): a 1944 dogfight high over a sea of cloud, seen from
// the side and a little above (not the top-down flight view).
//   title_intro_sky          480x270  high sky, sun glow upper left, haze down to the cloud sea
//   title_intro_clouds_far   960x270  distant cloud sea (tiles sideways; view scrolls it slowly)
//   title_intro_clouds_near  960x270  big cloud tops in front (tiles sideways; scrolls faster)
//   title_intro_fighter      96x48    our fighter (elliptical wing, Velmark roundel: orange disc,
//                                     navy ring, white centre), 12 @10 loop: level, banks, levels
//   title_intro_fighter_near 240x120  the same machine passing close to the camera, 6 @12 loop
//   title_intro_enemy        96x48    Kruland fighter, grey, a heron painted on the nose, 16 @10 once:
//                                     a short turn to the left, then pulls up and rolls on its back
//   title_intro_enemy_smoke  96x48    the grey fighter nosing down into the cloud trailing thin smoke, 8 @10 loop
//   title_intro_tracer       48x8     tracer streak, 4 @16 loop
//   title_intro_muzzle       16x16    muzzle flash, 3 @20 loop
// Cinematic shots (detailed models, renderHi; see the comments above each function):
//   title_intro_chase 160x96 8 @12 loop, title_intro_enemy_tail 128x80 8 @12 loop, title_intro_enemy_hit
//   128x80 10 @12 once, title_intro_enemy_head 192x112 8 @16 loop, title_intro_hero_approach 256x160
//   16 @16 once, title_intro_hero 256x160 12 @10 loop, title_intro_bomber_far 64x32 4 @8 loop.
// No people, no blood, no real insignia. Planes are signed-distance models raymarched with their own
// camera (renderPlane: azimuth, elevation, picture roll; defaults = the old side view).
const { Canvas, hex, hash, fbm } = require('../lib.cjs');
const { tone, clamp, SW, SH } = require('./common.cjs');
const { capsule, ellipsoid, smin, len2, len3 } = require('./scene3d.cjs');
const R = (...h) => h.map(c => hex(c));

const SKY = R('#16305e', '#1d3d73', '#274c86', '#345e98', '#4673a9', '#5c8aba', '#78a3c9', '#97bcd6', '#b8d2e1', '#d8e6ea');
const CLOUD = R('#56688a', '#6f83a3', '#8b9fbb', '#a9bad0', '#c7d4e1', '#e2e9ef', '#f6f7f4', '#fffdf2');
const SUN = [255, 247, 220];
const GREEN = R('#1b2116', '#2b3423', '#3d4a31', '#536340', '#6b7d52');      // dark green camouflage
const OCEAN = R('#2a2f33', '#41484e', '#5c646a', '#7b848a', '#9ba4a8');      // ocean grey
const SKYB = R('#5d6b63', '#7f8f86', '#a2b2a8', '#c3d0c6');                  // duck-egg underside
const GREY = R('#2c3136', '#454c53', '#646d74', '#868f95', '#a9b1b6', '#cfd4d6'); // Kruland grey
const MOTTLE = R('#30363a', '#4a5358', '#5f6a70');
const GLASS = R('#1a2430', '#2e4052', '#5a7690', '#a9c2d4');
const PROP = R('#141414', '#2a2a28', '#3e3d38');
const ORANGE = hex('#d9772c'), NAVY = hex('#1f2f5c'), WHITE = hex('#f2efe4'), OUT = [12, 14, 20, 255];

// x-periodic fbm (period W): blends two copies so x = 0 and x = W meet.
const pfbm = (x, y, W, s, k) => { const t = x / W; return fbm(x * k, y * k, s) * (1 - t) + fbm((x - W) * k, y * k, s) * t; };

// ---------------------------------------------------------------- sky
function sky() {
  const c = new Canvas(SW, SH);
  c.fill((x, y) => {
    const sun = Math.exp(-Math.hypot(x - 96, y - 40) / 70), v = y / SH;
    let L = .28 + .5 * Math.pow(v, 1.2) + .4 * sun + (fbm(x * .01, y * .03, 301) - .5) * .06;
    if (fbm(x * .006 + 3, y * .05, 302) > .62 && y < 120) L += .07;                       // high thin cirrus streaks
    return tone(SKY, L, x, y, .9);
  });
  for (let y = -22; y <= 22; y++) for (let x = -22; x <= 22; x++) { const d = Math.hypot(x, y); if (d < 22) c.paint(96 + x, 40 + y, [...SUN, Math.round(d < 6 ? 255 : 150 * Math.pow(1 - d / 22, 2) * (((x + y) & 1) || d < 12 ? 1 : .6))]); }
  return c;
}

// ---------------------------------------------------------------- cloud layers
// A cloud layer is a band of round puffs (each a half sphere seen from the side) over a flat sea of
// cloud. Each pixel takes the puff whose surface is nearest the camera and is lit by that puff's
// normal: sunlit tops near white with warm rims, cool blue shadow sides and bellies. Puffs repeat
// every W px so the layer tiles sideways.
function cloudLayer(W, { yTop, yBase, n, rMin, rMax, seed, far }) {
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const r = rMin + (rMax - rMin) * Math.pow(hash(i, 1, seed), 1.5);
    puffs.push({ x: (i + hash(i, 2, seed) * .8) * W / n, y: yBase - r * (.3 + .45 * hash(i, 3, seed)), r });
    // A smaller puff riding on top of every second one: clumps, not a row of balls.
    if (i % 2 === 0) { const r2 = r * (.45 + .25 * hash(i, 5, seed)); puffs.push({ x: puffs[puffs.length - 1].x + (hash(i, 6, seed) - .5) * r, y: yBase - r * .75 - r2 * .5 - (yBase - yTop) * .15 * hash(i, 4, seed), r: r2 }); }
  }
  const Ls = [-.55, -.6, .58];
  const c = new Canvas(W, SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < W; x++) {
    let best = null, bh = -1;
    for (const p of puffs) for (const ox of [-W, 0, W]) {
      const dx = x + .5 - p.x - ox, dy = y + .5 - p.y;
      if (Math.abs(dx) > p.r * 1.1 || Math.abs(dy) > p.r * 1.1) continue;
      const wob = 1 + (fbm((Math.atan2(dy, dx) + 4) * 2.2, p.r * .1, seed + 5) - .5) * .18;
      const rr = p.r * wob, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const h = Math.sqrt(rr * rr - d2) + p.y * .02;                                       // lower puffs sit in front
      if (h > bh) { bh = h; best = [dx / rr, dy / rr, Math.sqrt(1 - d2 / (rr * rr))]; }
    }
    let L;
    if (best) L = .38 + .52 * Math.max(0, best[0] * Ls[0] + best[1] * Ls[1] + best[2] * Ls[2]) + (best[2] < .3 && best[1] < 0 ? .08 : 0);
    else if (y >= yBase) L = .58 - (y - yBase) / 120 * .25 + (fbm(x * .02, y * .1, seed + 9) - .5) * .1;
    else continue;
    L -= clamp((y - yBase) / 200) * .15 + (far ? .08 : 0);
    c.put(x, y, tone(CLOUD, L, x, y, .9));
  }
  // Haze fringe just outside every edge so the layer sits in the air.
  const snap = c.px.slice();
  for (let y = 1; y < SH - 1; y++) for (let x = 0; x < W; x++) if (!snap[y * W + x] && (snap[(y + 1) * W + x] || snap[y * W + (x + 1) % W] || snap[y * W + (x + W - 1) % W])) c.put(x, y, [...CLOUD[6].slice(0, 3), far ? 70 : 110]);
  return c;
}
const cloudsFar = () => cloudLayer(960, { yTop: 160, yBase: 200, n: 54, rMin: 7, rMax: 18, seed: 311, far: true });
const cloudsNear = () => cloudLayer(960, { yTop: 196, yBase: 248, n: 30, rMin: 16, rMax: 40, seed: 321, far: false });

// ---------------------------------------------------------------- fighters
// Plane space: x forward (nose +x), y toward the right wing, z up; units = px at 96x48 scale 1.
function planeSdf(kind) {
  const enemy = kind === 'enemy';
  return (x, y, z) => {
    // Fuselage: rounded nose, slim tail.
    const t = clamp((x + 34) / 66), r = enemy ? 2.6 + 3.2 * Math.sin(Math.PI * Math.pow(t, .8)) : 2.2 + 3.5 * Math.sin(Math.PI * Math.pow(t, .75));
    let d = len2(y, (z - (enemy ? .4 : 0)) * 1.05) - r;
    d = Math.max(d, -(x + 35), x - 33);
    d = smin(d, ellipsoid(x - 31, y, z, 4, 3.6, 3.6), 2);                                 // spinner / cowl front
    // Wing: elliptical (ours) or straight tapered with square tips (theirs).
    const span = enemy ? 30 : 32, chord = enemy ? 8 : 9.5;
    const wy = Math.abs(y), c = enemy ? chord * (1 - wy / span * .45) : chord * Math.sqrt(Math.max(0, 1 - (wy / span) ** 2));
    const wx = x - 6 + wy * (enemy ? .1 : .02), wz = z + 1.8 - wy * .06;
    const wingD = Math.max(Math.abs(wx) - c, wy - span, Math.abs(wz) - .9 * (1 - Math.abs(wx) / Math.max(c, .1) * .5));
    d = Math.min(d, wingD);
    // Tailplane and fin.
    const tc = 4 * Math.sqrt(Math.max(0, 1 - (wy / 11) ** 2));
    d = Math.min(d, Math.max(Math.abs(x + 30) - tc, wy - 11, Math.abs(z - .6) - .6));
    const fh = enemy ? 8 : 9, fx = x + 31 + (z * .35);
    d = Math.min(d, Math.max(Math.abs(fx) - (4.2 * Math.sqrt(Math.max(0, 1 - (z / fh) ** 2))), -z, z - fh, Math.abs(y) - .7));
    // Canopy.
    d = smin(d, ellipsoid(x - (enemy ? 4 : 2), y, z - 3.8, enemy ? 6 : 7, 2.2, 2.6), .8);
    return d;
  };
}
// Paint at a surface point: returns [ramp, L offset] or a flat colour.
function planePaint(kind, x, y, z, n) {
  const enemy = kind === 'enemy', under = n[2] < -.35 && Math.abs(y) < 33;
  if (len3((x - (enemy ? 4 : 2)) / (enemy ? 6 : 7), y / 2.2, (z - 3.8) / 2.6) < 1.06 && z > 3.4) return [GLASS, (Math.abs(x - 2) % 3 < .5 ? -.3 : 0)];
  if (x > 29) return enemy ? [GREY, -.1] : [PROP, .1];                                  // spinner
  if (enemy) {
    // Heron on the nose (left and right side): white neck curve, grey body, yellow bill.
    const hx = x - 20, hz = z - .5;
    if (Math.abs(y) > 2) {
      if (Math.abs(hz - Math.sin(hx * .5) * 1.4 - hx * .25) < .9 && hx > -6 && hx < 3) return WHITE;
      if (hx >= 2.5 && hx < 7.5 && Math.abs(hz - .9 - (hx - 3) * .12) < .7) return hex('#e6b83a');
      if (hx > -11 && hx < -5 && Math.abs(hz + 1.6 + (hx + 8) * .1) < 1.6) return hex('#e8ebe8');
    }
    if (Math.abs(x + 14) < 1.6 && Math.abs(y) > 1.5) return hex('#1d2124');            // fuselage band... a plain dark bar, no insignia
    const m = fbm(x * .3 + 5, (y + z) * .3, 331) > .6;
    return under ? [GREY, .25] : [m ? MOTTLE : GREY, m ? .1 : 0];
  }
  // Roundels on the fuselage sides and the upper wings.
  const ring = (u, v, r) => { const d = len2(u, v); return d < r * .3 ? WHITE : d < r * .66 ? NAVY : d < r ? ORANGE : null; };
  if (Math.abs(y) > 2 && Math.abs(z) < 5) { const r = ring(x + 13, z - .3, 3.6); if (r) return r; }
  if (n[2] > .5 && Math.abs(y) > 18) { const r = ring(x - 6 + Math.abs(y) * .02, Math.abs(y) - 24, 4.2); if (r) return r; }
  if (under) return [SKYB, .2];
  const camo = fbm(x * .08 + 1, y * .08, 341) + (x * .01) > .5;                        // disruptive pattern, large soft-edged blotches
  return [camo ? GREEN : OCEAN, 0];
}
// Rotation: roll about x, pitch about y (nose up +), yaw about z.
function rot(p, roll, pitch, yaw) {
  let [x, y, z] = p;
  let c = Math.cos(roll), s = Math.sin(roll); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(pitch); s = Math.sin(pitch); [x, z] = [x * c - z * s, x * s + z * c];
  c = Math.cos(yaw); s = Math.sin(yaw); [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}
const inv = (p, roll, pitch, yaw) => {      // inverse of rot
  let [x, y, z] = p;
  let c = Math.cos(-yaw), s = Math.sin(-yaw); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(-pitch); s = Math.sin(-pitch); [x, z] = [x * c - z * s, x * s + z * c];
  c = Math.cos(-roll); s = Math.sin(-roll); [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
};
// Camera (parallel projection). az turns it around the plane: 0 = from the plane's left side, the
// old side view (screen right = +x, the plane flies right); 90 deg = in front of the nose; -90 deg =
// behind the tail. el raises it (default 26 deg above), bank rolls the picture. Returns screen right
// R, screen up U and view direction D (camera -> plane).
const DEG = Math.PI / 180, CAM_E = 26 * DEG;
function camera(az = 0, el = CAM_E, bank = 0) {
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  let R = [ca, sa, 0], U = [-sa * se, ca * se, ce];
  const D = [-sa * ce, ca * ce, -se];
  if (bank) { const cb = Math.cos(bank), sb = Math.sin(bank); [R, U] = [R.map((r, i) => r * cb + U[i] * sb), U.map((u, i) => u * cb - R[i] * sb)]; }
  return { R, U, D };
}
const SUNV = (() => { const v = [-.3, -.45, .84], l = Math.hypot(...v); return v.map(a => a / l); })();
// kind 'ours' / 'enemy': the small side-view models above (title_intro_fighter, _near, _enemy, _smoke).
// kind 'velmark' / 'kruland' / 'bomber': the detailed models below, drawn by renderHi.
// Defaults (az 0, el 26 deg, bank 0) give exactly the old side-view pictures.
function renderPlane(kind, W, H, scale, opts = {}) {
  if (HI[kind]) return renderHi(kind, W, H, scale, opts);
  const { roll = 0, pitch = 0, yaw = 0, prop = 0, flip = false, az = 0, el = CAM_E, bank = 0 } = opts;
  const { R: CR, U: CU, D: CD } = camera(az, el, bank);
  const sdf = planeSdf(kind), c = new Canvas(W, H), dep = new Float32Array(W * H).fill(1e9);
  const at = p => sdf(...inv(p, roll, pitch, yaw));
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const u = (sx + .5 - W / 2) / scale * (flip ? -1 : 1), v = -(sy + .5 - H / 2) / scale;
    // Ray origin far toward the camera (the camera is at -CD).
    let p = [CR[0] * u + CU[0] * v - CD[0] * 60, CR[1] * u + CU[1] * v - CD[1] * 60, CR[2] * u + CU[2] * v - CD[2] * 60], t = 0, hit = false;
    for (let i = 0; i < 200 && t < 120; i++) {
      const q = [p[0] + CD[0] * t, p[1] + CD[1] * t, p[2] + CD[2] * t], d = at(q);
      if (d < .03) { hit = true; p = q; break; }
      t += Math.max(d * .5, .02);
    }
    if (!hit) continue;
    const e = .25, n = [at([p[0] + e, p[1], p[2]]) - at([p[0] - e, p[1], p[2]]), at([p[0], p[1] + e, p[2]]) - at([p[0], p[1] - e, p[2]]), at([p[0], p[1], p[2] + e]) - at([p[0], p[1], p[2] - e])];
    const nl = Math.hypot(...n) || 1; for (let i = 0; i < 3; i++) n[i] /= nl;
    const local = inv(p, roll, pitch, yaw), ln = inv(n, roll, pitch, yaw);
    const paint = planePaint(kind, ...local, ln);
    const dif = Math.max(0, n[0] * SUNV[0] + n[1] * SUNV[1] + n[2] * SUNV[2]), sky = .5 + .5 * n[2];
    let L = .14 + .62 * dif + .18 * sky;
    const spec = Math.pow(Math.max(0, n[2] * .9 + n[1] * .3), 18) * .3;
    const col = Array.isArray(paint) && Array.isArray(paint[0]) ? tone(paint[0], L + paint[1] + spec, sx, sy, .5) : (() => { const k = .65 + .5 * dif; return [Math.round(paint[0] * k), Math.round(paint[1] * k), Math.round(paint[2] * k), 255]; })();
    c.put(sx, sy, col.map((v, i) => i < 3 ? Math.min(255, v) : v));
    dep[sy * W + sx] = t;
  }
  // Ink outline outside the silhouette and on big depth steps (wing over fuselage).
  const snap = c.px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (snap[y * W + x]) {
      const d = dep[y * W + x];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (y + dy) * W + x + dx; if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && snap[q] && dep[q] > d + 6) { c.px[y * W + x] = OUT; break; } }
      continue;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && snap[yy * W + xx]) { c.px[y * W + x] = OUT; break; } }
  }
  // Propeller: a faint disc and three blades turning (prop = blade phase in thirds of a turn).
  const proj = p => { const q = rot(p, roll, pitch, yaw); return [W / 2 + (CR[0] * q[0] + CR[1] * q[1] + CR[2] * q[2]) * scale * (flip ? -1 : 1), H / 2 - (CU[0] * q[0] + CU[1] * q[1] + CU[2] * q[2]) * scale]; };
  const pr = 8.5;
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, [px, py] = proj([35.5, Math.cos(a) * pr, Math.sin(a) * pr]); c.paint(Math.round(px), Math.round(py), [210, 214, 210, 60]); }
  for (let b = 0; b < 3; b++) {
    const ang = prop * Math.PI * 2 / 3 * .45 + b * Math.PI * 2 / 3;
    for (let r = 1.5; r <= pr; r += .4) { const [px, py] = proj([35.5, Math.cos(ang) * r, Math.sin(ang) * r]); c.paint(Math.round(px), Math.round(py), r > pr - 1.2 ? [230, 196, 70, 230] : [26, 26, 24, b === 0 ? 220 : 150]); }
  }
  return c;
}

// ---------------------------------------------------------------- detailed models (new camera shots)
// Plane space as above (x nose, y span, z up), 1 unit = 1 px at scale 1. Proportions from the
// research notes: Velmark (elliptical wing, span/length 1.23, dihedral 6 deg, cannon + blisters on the
// inner wing, 6 exhaust stacks a side, 3-blade prop of 0.29 span); Kruland (straight tapered wing with
// squarish tips, span/length 1.11, dihedral 6.5 deg, deep narrow body, two gun bumps on the cowl,
// framed box canopy, guns in the wing roots); the far twin-engine bomber (glazed bulb nose, one tall fin).
const ALU = R('#3f464b', '#646d72', '#8d969a', '#b7bfc1', '#dfe5e5');            // bare aluminium (paint chips)
const STACK = R('#211915', '#3f322a', '#6b5545', '#8a7462');                      // exhaust stacks
const SOOT = R('#15130f', '#26221d', '#39332b', '#4d463b');                       // exhaust soot / scorch
const KR_MOT = R('#2b3134', '#3f484c', '#556064', '#6c787c');                     // Kruland mottle
const KR_UND = R('#5e6a72', '#7f8d95', '#9fadb5', '#b8c7cf', '#d3dee3');           // Kruland pale blue belly
const KR_YEL = R('#5a4412', '#8f6b1e', '#c49a2f', '#e2bf55', '#f2da8a');           // yellow cowl band (theatre colour, no insignia)
const HOT = hex('#e0642a'), FLAME = [hex('#bfe0ff'), hex('#ffb347'), hex('#ff7a2a')];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = v => { const l = Math.hypot(...v) || 1; return v.map(a => a / l); };
const fract = v => v - Math.floor(v);
// Conservative distance to an ellipse (never more than the true distance, so marching never skips).
const ell2 = (a, b, ra, rb) => (len2(a / ra, b / rb) - 1) * Math.min(ra, rb);
const sdBox = (x, y, z, hx, hy, hz) => { const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz; return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
const ring = (u, v, r) => { const d = len2(u, v); return d < r * .36 ? WHITE : d < r * .68 ? NAVY : d < r ? ORANGE : null; };   // Velmark roundel
// Wing / tailplane panel out to half span S: at each span station a stadium section (round leading and
// trailing edges) of chord ch(a), centred at mid(a), at height zc(a), half thickness th(a).
// Parts are only evaluated inside their slab; outside it, out() + margin is a safe lower bound.
const out = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
function panel(x, ay, z, S, ch, mid, zc, th) {
  const a = Math.min(ay, S), c = ch(a) / 2, t = Math.min(th(a), c), f = len2(Math.max(Math.abs(x - mid(a)) - (c - t), 0), z - zc(a)) - t;
  return ay > S ? len2(ay - S, Math.max(f, 0)) : f;
}

// Velmark (ours): half span 36, nose at x 31.8, tail at -29.5.
const velR = x => x > 6 ? 3.25 - (x - 6) / 21 * .75 : .7 + 2.55 * Math.pow(clamp((x + 29) / 35), .62);
const velChord = a => 15.5 * Math.sqrt(Math.max(0, 1 - (a / 36) ** 2));
function velWing(x, ay, z) {
  const zc = -2.1 + ay * .105, th = Math.max(.16, 1.05 * (1 - .75 * ay / 36));
  let d = panel(x, ay, z, 36, velChord, a => 5.5 - .2 * velChord(a), a => -2.1 + a * .105, a => Math.max(.16, 1.05 * (1 - .75 * a / 36)));
  if (out(ay, 8, 17)) d = Math.min(d, out(ay, 8, 17) + .5);
  else {
    d = smin(d, ellipsoid(x - 3.6, ay - 12.6, z - zc - th * .65, 3.2, 1.1, .72), .4);           // gun bay blister
    d = Math.min(d, capsule(x, ay, z, 6, 11.5, -.92, 14.4, 11.5, -.92, .44, .38));               // cannon barrel ahead of the leading edge
  }
  return d;
}
function velSdf(x, y, z) {
  const ay = Math.abs(y), r = velR(x), zc = x < -4 ? (-4 - x) * .045 : 0;
  let d = Math.max(ell2(ay, z - zc, r * .92, r * 1.12), -(x + 29.5), x - 27.4);
  d = smin(d, capsule(x, ay, z, 26.6, 0, 0, 31.8, 0, 0, 2.5, .3), .6);                          // spinner
  if (out(x, -14, 10)) d = Math.min(d, out(x, -14, 10) + .5);
  else {
    d = smin(d, ellipsoid(x - 3.5, ay, z - 2.75, 5, 1.7, 1.95), .5);                          // teardrop canopy
    d = smin(d, ellipsoid(x + 4, ay, z - 2.4, 8, 1.35, 1.0), .8);                                // spine behind it
  }
  d = Math.min(d, out(x, 13, 25) ? out(x, 13, 25) + .5 : sdBox(x - 19, ay - 2.6, z - .9, 4.3, .45, .5) - .1);     // exhaust stack rows
  d = Math.min(d, out(x, -6, 18) ? out(x, -6, 18) + .5 : velWing(x, ay, z));
  if (x > -18) d = Math.min(d, x + 18.5);
  else {
    d = Math.min(d, panel(x, ay, z, 10.5, a => 6.8 * Math.sqrt(Math.max(0, 1 - (a / 10.5) ** 2)), a => -25 + a * .08, () => 1, () => .32));
    d = Math.min(d, Math.max(ellipsoid(x + 25.8 + (z - 1) * .2, ay, z - 1.2, 4.2, .38, 7), 1 - z)); // fin
  }
  return d;
}
function velPaint(x, y, z, n, s) {
  const ay = Math.abs(y), px = .55 / s, top = n[2] > .25, under = n[2] < -.3;
  if (x > -.9 && z > 2.5 && ellipsoid(x - 3.5, ay, z - 2.75, 5.2, 1.85, 2.1) < .05) {             // canopy: frame, sill, glass
    if (Math.abs(x - 6.1) < px * 1.3 || Math.abs(x - 1.4) < px || z < 2.5 + px * 2.2) return { r: GREEN, l: -.15 };
    return { r: GLASS, l: 0, glass: true };
  }
  if (x > 27.1) return { r: PROP, l: .2 };                                                       // black spinner
  if (x > 14.5 && x < 23.6 && ay > 2.3 && Math.abs(z - .9) < .78) {                             // exhaust stacks
    const k = (x - 14.8) / 1.45, f = fract(k);
    if (ay > 2.95 && Math.abs(z - .9) < .32 && Math.abs(f - .5) < .22 && k >= 0 && k < 6) return { c: HOT, e: true };
    return { r: STACK, l: f < .2 ? -.4 : 0 };
  }
  if (ay > 1 && Math.abs(n[1]) > .35 && z > -2.6) { const c = ring(x + 12, z - .2, 1.9); if (c) return { c }; }
  if (top && ay > 18 && ay < 30) { const c = ring(x - 3.2, ay - 24, 3.4); if (c) return { c }; }
  if (under && ay < 37) return { r: SKYB, l: .12 };
  if (ay > 10.9 && ay < 12.1 && x > 9.5 && z < 0) return { r: ALU, l: -.3 };                     // cannon barrel
  if (!under && x > -22.2 && x < -20.4) return { r: SKYB, l: .08 };                             // sky fuselage band
  let l = 0;
  // panel lines: fuselage frames, cowl panels, aileron and flap hinge lines
  for (const k of [-14, -3.6, 9.6, 14.2, 24]) if (Math.abs(x - k) < px && (ay < 4)) l -= .2;
  if (ay > 4 && ay < 35 && z < 2) { const ch = 15.5 * Math.sqrt(1 - (ay / 36) ** 2), te = 5.5 - .7 * ch; if (Math.abs(x - (te + ch * .22)) < px) l -= .18; }
  // soot streaks behind the exhaust stacks
  if (ay > 1.2 && x > 3 && x < 15 && z > -.8 && z < 2.4 && Math.abs(n[1]) > .3) l -= .42 * clamp((x - 3) / 12) * clamp(1 - Math.abs(z - .9) / 1.5) * (.6 + .4 * fbm(x * .5, z * 2, 353));
  // chipped paint: wing root walkway, cockpit sill, cowl panel edges
  const wear = (ay < 9 && top && z < 0) || (Math.abs(x - 3) < 6 && z > 1.4) || (x > 9 && x < 26 && z > 1.8);
  if (wear && s > 1.2 && fbm(x * 1.1 + 7, y * 1.1 + z, 351) > .74) return { r: ALU, l: .1 };
  // disruptive camouflage: straight-edged patches on a warped grid
  const w = fbm(x * .05 + 3, y * .05, 361) * 8, a = Math.floor((x * .75 + (y + z) * .66 + w) / 10), b = Math.floor(((y + z) * .75 - x * .66 + w) / 13);
  return hash(a, b, 371) > .48 ? { r: GREEN, l } : { r: OCEAN, l: l - .08 };
}

// Kruland (theirs): half span 32, nose at x 30, tail at -27.5.
const krR = x => x > 4 ? 3.0 - (x - 4) / 22 * .7 : .6 + 2.4 * Math.pow(clamp((x + 27) / 31), .7);
const krChord = ay => { let c = 13 - 5.5 * ay / 32; if (ay > 29) c *= Math.sqrt(Math.max(0, 1 - ((ay - 29) / 3) ** 2)); return c; };
function krWing(x, ay, z) {
  let d = panel(x, ay, z, 32, krChord, a => 5 - a * .03 - .2 * krChord(a), a => -2.3 + a * .114, a => Math.max(.16, .95 * (1 - .55 * a / 32)));
  if (ay > 3.5 && ay < 7.5) d = Math.min(d, capsule(x, ay, z, 7, 5.6, -1.75, 13.2, 5.6, -1.75, .34, .3)); // wing-root gun
  d = Math.min(d, out(ay, 6, 14) ? out(ay, 6, 14) + .5 : sdBox(x - 4.5, ay - 10, z + 2, 2.4, 1.7, .6) - .15);   // radiator under each wing
  return d;
}
function krSdf(x, y, z) {
  const ay = Math.abs(y), r = krR(x), zc = x < -4 ? (-4 - x) * .04 : 0;
  let d = Math.max(ell2(ay, z - zc, r * .88, r * 1.2), -(x + 27.5), x - 25.6);
  d = smin(d, capsule(x, ay, z, 24.8, 0, -.1, 30, 0, -.1, 2.3, .3), .5);                         // spinner
  d = out(x, 10, 22) ? Math.min(d, out(x, 10, 22) + .5) : smin(d, ellipsoid(x - 16, ay - 1.1, z - 3.15, 4.5, .6, .65), .35);  // gun bumps on the cowl
  d = out(x, -4, 9) ? Math.min(d, out(x, -4, 9) + .5) : smin(d, Math.max(sdBox(x - 2.5, ay, z - 2.9, 4.6, 1.3, 1.1) - .25, (x - 4.4) * .55 + (z - 3.6) * .83), .3); // box canopy
  d = Math.min(d, out(x, 12, 23) ? out(x, 12, 23) + .5 : sdBox(x - 17.5, ay - 2.3, z + .7, 3.8, .45, .45) - .1); // exhaust rows
  d = Math.min(d, out(x, -6, 15) ? out(x, -6, 15) + .5 : krWing(x, ay, z));
  d = out(x, 8, 18) ? Math.min(d, out(x, 8, 18) + .5) : smin(d, ellipsoid(x - 13, ay, z + 2.7, 3.2, 1.1, .8), .4); // oil cooler under the nose
  if (x > -17) d = Math.min(d, x + 17.5);
  else {
    d = Math.min(d, panel(x, ay, z, 9, a => 5.5 - a * .2, a => -23.3 + a * .06, () => 1.6, () => .3));
    d = Math.min(d, Math.max(ellipsoid(x + 24.2 + (z - 1) * .15, ay, z - 1.2, 3.8, .38, 5.8), 1 - z)); // fin
  }
  return d;
}
function krPaint(x, y, z, n, s, marks) {
  const ay = Math.abs(y), px = .55 / s, top = n[2] > .25, under = n[2] < -.3;
  if (marks) for (const m of marks) {                                                            // battle damage
    const d = len3(x - m.p[0], y - m.p[1], z - m.p[2]);
    if (d < m.r * .35) return { c: [18, 16, 14, 255] };
    if (d < m.r) return { r: SOOT, l: .15 + (fbm(x * 1.3, y * 1.3 + z, 357) - .5) * .5 };
  }
  if (x > -2.6 && x < 7.7 && ay < 1.65 && z > 3.25 && sdBox(x - 2.5, ay, z - 2.9, 4.6, 1.3, 1.1) < .35) {   // framed box canopy
    if ([-1.6, 1.0, 3.4, 5.6].some(k => Math.abs(x - k) < px * 1.2) || (Math.abs(n[1]) > .5 && Math.abs(z - 3.75) < px)) return { r: KR_MOT, l: -.1 };
    return { r: GLASS, l: 0, glass: true };
  }
  if (Math.abs(ay - 10) < 2 && z < -1.45 && x > 1.9 && x < 7.2) return { r: KR_MOT, l: x > 6.6 ? (fract(ay * 1.4) < .35 ? -.6 : -.35) : .1 };  // radiator, grille at the front
  if (x > 28.6) return { c: WHITE };                                                             // spinner tip
  if (x > 24.9) return { r: KR_MOT, l: -.1 };
  if (x > 22.3) return { r: KR_YEL, l: 0 };                                                      // yellow cowl band
  if (x > 13.2 && x < 21.8 && ay > 1.9 && Math.abs(z + .7) < .74) {                             // exhaust stacks
    const k = (x - 13.7) / 1.27, f = fract(k);
    if (ay > 2.65 && Math.abs(z + .7) < .3 && Math.abs(f - .5) < .22 && k >= 0 && k < 6) return { c: HOT, e: true };
    return { r: STACK, l: f < .2 ? -.4 : 0 };
  }
  if (ay > 1.2 && Math.abs(n[1]) > .35) {                                                        // heron on the nose: white neck, yellow bill, pale body
    const hx = (x - 12) / .7, hz = (z - .6) / .7;
    if (Math.abs(hz - Math.sin(hx * .5) * 1.4 - hx * .25) < .9 && hx > -6 && hx < 3) return { c: WHITE };
    if (hx >= 2.5 && hx < 7.5 && Math.abs(hz - .9 - (hx - 3) * .12) < .7) return { c: hex('#e6b83a') };
    if (hx > -11 && hx < -5 && Math.abs(hz + 1.6 + (hx + 8) * .1) < 1.6) return { c: hex('#e8ebe8') };
    if (Math.abs(x + 13) < .9) return { r: KR_MOT, l: -.35 };                                     // plain dark fuselage band
  }
  if (under) return { r: KR_UND, l: .05 };
  let l = 0;
  for (const k of [-12, -2.5, 8.5, 13]) if (Math.abs(x - k) < px && ay < 3.5) l -= .2;
  if (ay > 4 && ay < 31 && z < 2) { const ch = krChord(ay), te = 5 - ay * .03 - .7 * ch; if (Math.abs(x - (te + ch * .2)) < px) l -= .18; }
  if (ay > 1 && x > 3 && x < 13.5 && z > -1.8 && z < .6 && Math.abs(n[1]) > .3) l -= .4 * clamp((x - 3) / 10) * clamp(1 - Math.abs(z + .7) / 1.2);
  const wear = (ay < 8 && top && z < 0) || (x > 10 && x < 22 && z > 1.5);
  if (wear && s > 1.2 && fbm(x * 1.1 + 3, y * 1.1 + z, 359) > .72) return { r: ALU, l: .1 };
  const m = fbm(x * .22 + 5, (y + z) * .22, 331) > (Math.abs(n[1]) > .5 ? .5 : .6);
  return { r: m ? KR_MOT : GREY, l: (m ? .2 : 0) + l };
}

// Far twin-engine bomber: length 58, half span 40, engines at y = +-9.5.
const bR = x => x > 8 ? 4.4 : .9 + 3.5 * Math.pow(clamp((x + 29) / 37), .6);
function bSdf(x, y, z) {
  const ay = Math.abs(y);
  let d = Math.max(ell2(ay, z - (x < -10 ? (-10 - x) * .06 : 0), bR(x), bR(x) * 1.1), -(x + 29), x - 21);
  d = smin(d, ellipsoid(x - 21, ay, z + .2, 7.5, 4.3, 4.7), 1);                                 // glazed bulb nose
  d = Math.min(d, panel(x, ay, z, 40, a => 11 - .15 * a, a => 2.5 + a * .03, a => -1 + a * .07, a => .9 - a * .012));
  d = smin(d, capsule(x, Math.abs(ay - 9.5), z, -2, 0, -.4, 15, 0, -.4, 2.5, 2.0), .8);          // engine nacelles
  if (x > -15) d = Math.min(d, x + 15.5);
  else {
    d = Math.min(d, panel(x, ay, z, 10, a => 5 * Math.sqrt(Math.max(0, 1 - (a / 10) ** 2)), () => -25.5, () => 1.3, () => .3));
    d = Math.min(d, Math.max(ellipsoid(x + 26 + (z - 2) * .25, ay, z - 2.5, 3.8, .45, 8), 1.5 - z)); // tall fin
  }
  return d;
}
function bPaint(x, y, z, n, s) {
  const ay = Math.abs(y);
  if (x > 17 && ellipsoid(x - 21, ay, z + .2, 7.7, 4.5, 4.9) < .05) {                            // glazed nose with frames
    if (fract(x * .55) < .22 || fract((z + ay) * .5) < .2) return { r: KR_MOT, l: .1 };
    return { r: GLASS, l: .25, glass: true, lift: .3 };
  }
  if (Math.abs(ay - 9.5) < 2.7 && x > 13.5 && x < 15.5) return { r: KR_MOT, l: -.2 };          // cowl rings
  if (n[2] < -.3) return { r: KR_UND, l: .05 };
  const m = fbm(x * .2 + 9, (y + z) * .2, 381) > .58;
  return { r: m ? KR_MOT : GREY, l: m ? .2 : .05 };
}

// Per model: SDF, paint, bounding radius, propellers [x, y, z, radius], exhaust stacks, wing tips.
const HI = {
  velmark: { sdf: velSdf, paint: velPaint, bound: 40, props: [[31.4, 0, 0, 10.5]], tips: [[5.5, -36, 1.68], [5.5, 36, 1.68]],
    stacks: { x0: 15.5, dx: 1.45, n: 6, y: 3.15, z: .9 }, guns: [[14.6, -11.5, -.92], [14.6, 11.5, -.92]], canopy: [4, 0, 4.4] },
  kruland: { sdf: krSdf, paint: krPaint, bound: 37, props: [[30.2, 0, -.1, 9.6]], tips: [[3.6, -32, 1.35], [3.6, 32, 1.35]],
    stacks: { x0: 14.3, dx: 1.27, n: 6, y: 2.85, z: -.7 }, guns: [[13.4, -5.6, -1.75], [13.4, 5.6, -1.75], [22, -1.1, 3.5], [22, 1.1, 3.5]], canopy: [3, 0, 4.2] },
  bomber: { sdf: bSdf, paint: bPaint, bound: 46, props: [[16.6, -9.5, -.4, 5], [16.6, 9.5, -.4, 5]], tips: [[3, -40, 1.8], [3, 40, 1.8]] }
};

// Detailed render: raymarched inside a bounding sphere, soft sun shadow + ambient occlusion, dithered
// ramps, rim light on the edges facing the sun (upper left), ink outline outside, softer ink inside.
// Overlays: propeller disc with blurred blades (blade = angle in rad, stop 0..1 slows to visible
// blades), exhaust flames (exhaust = frame index, -1 off), canopy glint, haze toward the sky colour.
// marks: battle damage [{p: [x, y, z], r}] in plane space. The plane origin sits at the canvas centre.
function renderHi(kind, W, H, scale, o = {}) {
  const M = HI[kind];
  const { roll = 0, pitch = 0, yaw = 0, az = 0, el = CAM_E, bank = 0, blade = 0, stop = 0, exhaust = -1, glint = false, haze = 0, marks = null } = o;
  const { R: CR, U: CU, D: CD } = camera(az, el, bank);
  const B = [rot([1, 0, 0], roll, pitch, yaw), rot([0, 1, 0], roll, pitch, yaw), rot([0, 0, 1], roll, pitch, yaw)];
  const toL = q => [dot(B[0], q), dot(B[1], q), dot(B[2], q)];
  const toW = p => [0, 1, 2].map(i => B[0][i] * p[0] + B[1][i] * p[1] + B[2][i] * p[2]);
  const f = (x, y, z) => M.sdf(B[0][0] * x + B[0][1] * y + B[0][2] * z, B[1][0] * x + B[1][1] * y + B[1][2] * z, B[2][0] * x + B[2][1] * y + B[2][2] * z);
  const S = norm3([0, 1, 2].map(i => -.45 * CR[i] + .7 * CU[i] - .55 * CD[i])), Hv = norm3([0, 1, 2].map(i => S[i] - CD[i]));
  // hit distance grows at small sizes so thin parts stay solid; capped below the .5 margin of out()
  const eps = Math.min(.45, Math.max(.03, .3 / scale)), N = W * H, RB = M.bound;
  const dep = new Float32Array(N).fill(1e9), Lb = new Float32Array(N), Pb = new Array(N), gl = new Float32Array(N);
  const origin = (sx, sy) => { const u = (sx + .5 - W / 2) / scale, v = -(sy + .5 - H / 2) / scale; return [0, 1, 2].map(i => CR[i] * u + CU[i] * v - CD[i] * 60); };
  const screen = q => [W / 2 + dot(CR, q) * scale, H / 2 - dot(CU, q) * scale, dot(CD, q) + 60];
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const ro = origin(sx, sy), b = dot(ro, CD), disc = b * b - dot(ro, ro) + RB * RB;
    if (disc < 0) continue;
    let t = Math.max(0, -b - Math.sqrt(disc)), hit = false, p;
    const t1 = -b + Math.sqrt(disc);
    for (let i = 0; i < 260 && t < t1; i++) {
      p = [ro[0] + CD[0] * t, ro[1] + CD[1] * t, ro[2] + CD[2] * t];
      const d = f(...p);
      if (d < eps) { hit = true; break; }
      t += Math.max(d * .8, .01);
    }
    if (!hit) continue;
    const e = .15, n = norm3([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]);
    const paint = M.paint(...toL(p), toL(n), scale, marks);
    // soft shadow toward the sun and a little ambient occlusion
    let sh = 1;
    for (let k = 0, st = .25; k < 48 && st < 50; k++) {
      const d = f(p[0] + n[0] * .2 + S[0] * st, p[1] + n[1] * .2 + S[1] * st, p[2] + n[2] * .2 + S[2] * st);
      sh = Math.min(sh, 5 * d / st); if (sh < .02) { sh = 0; break; }
      st += Math.max(d, .15);
    }
    let occ = 0;
    for (let k = 1; k <= 4; k++) { const h = .45 * k; occ += Math.max(0, h - f(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)) / h * .3; }
    const ao = clamp(1 - occ), dif = Math.max(0, dot(n, S)) * (.3 + .7 * clamp(sh)), sky = .5 + .5 * n[2], spec = Math.pow(Math.max(0, dot(n, Hv)), 24) * clamp(sh);
    const i = sy * W + sx;
    dep[i] = t; Pb[i] = paint;
    if (paint.glass) { Lb[i] = (paint.lift || 0) + .2 + .35 * sky + .35 * dif + .9 * spec + (fract((p[0] - p[2]) * .12) < .18 ? .2 : 0); gl[i] = spec + dif * .2; }
    else Lb[i] = .13 + .58 * dif + (.2 + .12 * sky) * ao + .25 * spec + (paint.l || 0);
  }
  // colour, rim light (edge toward the upper-left sun), soft inner ink on depth steps, outer ink
  const c = new Canvas(W, H), has = i => Pb[i] !== undefined;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!has(i)) continue;
    const P = Pb[i], edgeLit = (x === 0 || !has(i - 1)) || (y === 0 || !has(i - W));
    let col;
    if (P.r) col = tone(P.r, Lb[i] + (edgeLit && !P.glass ? .2 : 0), x, y, .45);
    else if (P.e) col = P.c;
    else { const k = Math.min(1.15, .55 + .55 * clamp(Lb[i] + .15) + (edgeLit ? .1 : 0)); col = [P.c[0] * k, P.c[1] * k, P.c[2] * k].map(v => Math.min(255, Math.round(v))); }
    let inner = false;
    for (const q of [i + 1, i - 1, i + W, i - W]) if (q >= 0 && q < N && has(q) && Math.abs((q % W) - x) <= 1 && dep[q] > dep[i] + 2.5) { inner = true; break; }
    if (inner) col = [0, 1, 2].map(k => Math.round(col[k] * .35 + OUT[k] * .65));
    c.put(x, y, [col[0], col[1], col[2], 255]);
  }
  const snap = c.px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (snap[y * W + x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && snap[yy * W + xx]) { c.px[y * W + x] = OUT; break; } }
  }
  // propeller discs: per pixel, the ray meets the disc plane in front of the surface already drawn
  for (const [px0, py0, pz0, pr] of M.props) {
    const C = toW([px0, py0, pz0]), Nn = B[0], A1 = B[1], A2 = B[2], den = dot(CD, Nn), [cx, cy] = screen(C), rp = pr * scale + 1;
    if (Math.abs(den) < .12) {                                                                  // edge on: a faint line
      const seen = new Set();
      for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2, [qx, qy] = screen(toW([px0, py0 + Math.cos(a) * pr, pz0 + Math.sin(a) * pr])), key = Math.round(qx) + ',' + Math.round(qy); if (!seen.has(key)) { seen.add(key); c.paint(Math.round(qx), Math.round(qy), [200, 198, 188, 70]); } }
      continue;
    }
    for (let y = Math.floor(cy - rp); y <= cy + rp; y++) for (let x = Math.floor(cx - rp); x <= cx + rp; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const ro = origin(x, y), t = dot([C[0] - ro[0], C[1] - ro[1], C[2] - ro[2]], Nn) / den;
      if (t > dep[y * W + x] + .3) continue;
      const rel = [ro[0] + CD[0] * t - C[0], ro[1] + CD[1] * t - C[1], ro[2] + CD[2] * t - C[2]], a = dot(rel, A1), bb = dot(rel, A2), r = Math.hypot(a, bb) / pr;
      if (r > 1 || r < .2) continue;
      const ang = Math.atan2(bb, a);
      let col = null;
      for (let k = 0; k < 3; k++) {
        const dA = Math.abs(((ang - blade - k * Math.PI * 2 / 3) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        const wBlade = (.09 + .1 * Math.sin(Math.PI * Math.min(1, r * 1.1))) / Math.max(.4, r);
        if (dA < wBlade * (1 + (1 - stop) * 1.6)) col = stop > .5 ? (r > .9 ? [232, 200, 74, 255] : [...PROP[1].slice(0, 3), 255]) : [154, 149, 136, Math.round(105 * (1 - dA / (wBlade * 2.6)) + 40)];
      }
      if (!col && stop < .7) col = [217, 213, 200, Math.round(60 * (1 - stop))];
      if (r > 1 - 1.3 / (pr * scale) && stop < .5) col = [232, 200, 74, 110];
      if (col) c.paint(x, y, col);
    }
  }
  // exhaust flames: short, flickering, only on the stack row facing the camera
  if (M.stacks && exhaust >= 0) {
    const st = M.stacks, back = (() => { const a = screen(toW([0, 0, 0])), b2 = screen(toW([-1, 0, 0])); const l = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1; return [(b2[0] - a[0]) / l, (b2[1] - a[1]) / l, l]; })();
    for (const sd of [-1, 1]) {
      if (dot(toW([0, sd, 0]), CD) > .05) continue;
      for (let k = 0; k < st.n; k++) {
        if (hash(k + sd * 7, exhaust % 8, 391) < .2) continue;                                     // a stack gutters out now and then
        const [qx, qy, qt] = screen(toW([st.x0 + k * st.dx, sd * st.y, st.z])), X = Math.floor(qx), Y = Math.floor(qy);
        if (X < 0 || Y < 0 || X >= W || Y >= H || qt > dep[Y * W + X] + 1.2) continue;
        const len = scale < 1.4 ? 1 : 2 + Math.floor(hash(k, sd + exhaust, 393) * 2.4);
        for (let j = len - 1; j >= 0; j--) {
          const fx = qx + back[0] * j * Math.min(1, back[2] * 1.5 + .4), fy = qy + back[1] * j * Math.min(1, back[2] * 1.5 + .4);
          c.paint(Math.floor(fx), Math.floor(fy), j === 0 ? [...FLAME[0].slice(0, 3), 255] : j === 1 ? [...FLAME[1].slice(0, 3), 235] : [...FLAME[2].slice(0, 3), 170]);
        }
      }
    }
  }
  if (glint) {                                                                                  // one bright star on the canopy
    let bi = -1; for (let i = 0; i < N; i++) if (gl[i] > (bi < 0 ? 0 : gl[bi])) bi = i;
    if (bi >= 0) {
      const gx = bi % W, gy = Math.floor(bi / W);
      c.put(gx, gy, [255, 255, 244, 255]);
      for (const [dx, dy, a] of [[1, 0, 230], [-1, 0, 230], [0, 1, 230], [0, -1, 230], [2, 0, 120], [-2, 0, 120], [0, -2, 120], [0, 2, 120], [3, 0, 50], [-3, 0, 50]]) c.paint(gx + dx, gy + dy, [255, 246, 216, a]);
    }
  }
  if (haze) for (let i = 0; i < N; i++) { const p = c.px[i]; if (p) c.px[i] = [0, 1, 2].map(k => Math.round(p[k] * (1 - haze) + SKY[5][k] * haze)).concat(p[3]); }
  c.meta = { screen, toW, dep };
  return c;
}
// Screen distance between the two wing tips at scale 1 (used to size a shot to a target span in px).
function tipSpan(kind, o) {
  const { R: CR } = camera(o.az, o.el, o.bank), B = [rot([1, 0, 0], o.roll || 0, o.pitch || 0, o.yaw || 0), rot([0, 1, 0], o.roll || 0, o.pitch || 0, o.yaw || 0), rot([0, 0, 1], o.roll || 0, o.pitch || 0, o.yaw || 0)];
  const sx = p => dot(CR, [0, 1, 2].map(i => B[0][i] * p[0] + B[1][i] * p[1] + B[2][i] * p[2]));
  const [a, b] = HI[kind].tips; return Math.abs(sx(a) - sx(b));
}

// Our fighter: 4 level frames, 4 banking toward the camera, 4 back to level; prop turns 120 deg/frame.
const BANK = [0, 0, 0, 0, .25, .55, .8, .6, .35, .15, .05, 0];
const PITCH = [0, .01, 0, -.01, .03, .06, .08, .07, .05, .03, .01, 0];
const fighterFrames = () => BANK.map((b, i) => renderPlane('ours', 96, 48, 1.2, { roll: -b, pitch: PITCH[i], prop: i }));
const fighterNearFrames = () => [0, 1, 2, 3, 4, 5].map(i => {
  const c = renderPlane('ours', 240, 120, 3.1, { roll: -.12 + Math.sin(i / 6 * Math.PI * 2) * .03, pitch: .02, prop: i * 1.3 });
  return c;
});
// The grey fighter (flies right to left: mirrored): level, rolls left into a short turn, pulls up,
// goes over on its back.
const EN = [
  [0, 0, 0], [0, 0, 0], [-.3, .02, 0], [-.7, .05, .05], [-1.0, .08, .12], [-1.1, .1, .2], [-1.0, .12, .28], [-.8, .18, .3],
  [-.5, .22, .22], [-.2, .34, .15], [.2, .46, .08], [.7, .56, .03], [1.3, .62, 0], [2.0, .6, 0], [2.7, .5, 0], [3.14, .4, 0]
];
// Where the wing stands on edge mid-roll the span would leave the 48 px frame: those frames are drawn a
// touch smaller (about 10 percent, unnoticed inside the roll) so nothing is clipped.
function enemyFrames() {
  return EN.map(([roll, pitch, yaw], i) => {
    const at = s => renderPlane('enemy', 96, 48, s, { roll, pitch, yaw, prop: i, flip: true }), c = at(.9);
    let top = 48, bot = -1;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) { const p = c.get(x, y); if (p && p[3]) { top = Math.min(top, y); bot = Math.max(bot, y); } }
    return top > 1 && bot < 46 ? c : at(.9 * 42 / 50);
  });
}
// Hit: nose down into the cloud, a thin smoke trail streaming back over the tail, 8 @10 loop.
function enemySmokeFrames() {
  return Array.from({ length: 8 }, (_, i) => {
    const c = new Canvas(96, 48);
    const tail = [62, 17];
    for (let k = 0; k < 14; k++) {                                                       // puffs drifting back and up, growing, thinning
      const t = (k + i / 8 * 2) / 14, x = tail[0] + t * 34, y = tail[1] - t * 13 + Math.sin(k * 1.7 + i) * 1.2, r = 1.2 + t * 3.4;
      for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) { const d = Math.hypot(xx, yy); if (d < r) c.paint(Math.round(x + xx), Math.round(y + yy), [72, 74, 78, Math.round(150 * (1 - t) * (1 - d / r * .5))]); }
    }
    c.blit(renderPlane('enemy', 96, 48, .95, { roll: -.15 + Math.sin(i * .8) * .05, pitch: -.42, prop: i, flip: true }), -14, 6, true);
    return c;
  });
}
function tracerFrames() {
  return [0, 1, 2, 3].map(i => {
    const c = new Canvas(48, 8), len = 30 + (i % 2) * 6;
    for (let x = 0; x < len; x++) {
      const t = x / len, a = Math.round(255 * Math.pow(t, 1.6));
      c.put(47 - len + x, 3, [255, 236, 160, a]); c.put(47 - len + x, 4, [255, 200, 90, Math.round(a * .8)]);
      if (t > .7) { c.put(47 - len + x, 2, [255, 170, 60, Math.round(a * .35)]); c.put(47 - len + x, 5, [255, 150, 50, Math.round(a * .3)]); }
    }
    for (const [x, y] of [[46, 3], [47, 3], [46, 4], [47, 4]]) c.put(x, y, [255, 252, 236, 255]);
    if (i === 2) c.put(44, 2, [255, 240, 190, 200]);
    return c;
  });
}
function muzzleFrames() {
  return [0, 1, 2].map(i => {
    const c = new Canvas(16, 16), r = [7, 5, 3][i];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), star = Math.min(Math.abs(dx), Math.abs(dy)) < 1 || Math.abs(Math.abs(dx) - Math.abs(dy)) < .8 ? 1.5 : 1;
      if (d < r * .35 * star) c.put(x, y, [255, 252, 230, 255]);
      else if (d < r * .7 * star) c.put(x, y, [255, 214, 110, 235]);
      else if (d < r * star) c.put(x, y, [232, 118, 40, i === 2 ? 120 : 190]);
    }
    return c;
  });
}

// ---------------------------------------------------------------- new camera shots (detailed models)
const TAU = Math.PI * 2;
// title_intro_chase 160x96 8 @12 loop: ours from behind and above (15 deg), camera 10 deg off to the
// left of the tail; prop disc ahead, the two exhaust rows flickering, a gentle sway. Prop 45 deg/frame.
const CHASE = { az: -80 * DEG, el: 15 * DEG };
const chaseFrames = () => Array.from({ length: 8 }, (_, i) => renderPlane('velmark', 160, 96, 1.75, {
  ...CHASE, roll: .05 * Math.sin(i / 8 * TAU), pitch: .012 * Math.cos(i / 8 * TAU), blade: i * 45 * DEG, exhaust: i }));
// title_intro_enemy_tail 128x80 8 @12 loop: the grey fighter seen from behind, jinking +-20 deg of roll.
const TAIL = { az: -90 * DEG, el: 9 * DEG };
const tailPose = i => ({ roll: .34 * Math.sin(i / 8 * TAU), yaw: .05 * Math.sin(i / 8 * TAU + .6), pitch: .02 * Math.cos(i / 8 * TAU) });
const enemyTailFrames = () => Array.from({ length: 8 }, (_, i) => renderPlane('kruland', 128, 80, 1.6, { ...TAIL, ...tailPose(i), blade: i * 45 * DEG, exhaust: i }));
// title_intro_enemy_hit 128x80 10 @12 once, same camera: 0-2 hits spark on the wings and skin chips fly
// off, 3-4 scorched holes and a wisp of smoke, 5+ the engine burns (kit.flames) and black-brown smoke
// streams back toward the camera, 7+ the prop winds down until its three blades show.
const HITS = [[5, 21, -.1], [2, -16, -.8], [-8, 1.5, 2.2], [9, 26, .5], [1, -25, .1]];
function enemyHitFrames() {
  const pfx = require('../pfx.cjs'), { kit } = pfx, H = kit.H;
  let ang = 0;
  return Array.from({ length: 10 }, (_, i) => {
    const pose = { roll: tailPose(1).roll + .05 * i, yaw: .03 * Math.sin(i * .9), pitch: -.014 * i };
    ang += (45 - 3.6 * Math.max(0, i - 4)) * DEG;
    const c = renderPlane('kruland', 128, 80, 1.45, { ...TAIL, ...pose, blade: ang, stop: clamp((i - 6) / 2.5), exhaust: i < 5 ? i : -1, marks: i >= 2 ? HITS.slice(0, i >= 3 ? 5 : 3).map(p => ({ p, r: 1.9 })) : null });
    const { screen, toW } = c.meta, P = p => screen(toW(p)), eng = P([17, 0, 2.6]), down = P([-30, 0, 0]);
    const fx = pfx.paint(128, 80, p => {
      if (i <= 2) for (const [k, h] of HITS.entries()) {                                          // sparks where the rounds strike
        if (k % 3 !== i) continue;
        const [x, y] = P(h);
        p.glow(x, y, 9 - i * 2, kit.FIRE[1], .8 - i * .2);
        if (i < 2) p.rect(Math.floor(x) - (i ? 0 : 1), Math.floor(y) - (i ? 0 : 1), 2 + (i ? 0 : 1), 2 + (i ? 0 : 1), kit.FIRE[0]);
        for (let s = 0; s < 6; s++) { const a = hash(k, s, 401) * TAU, l = 4 + hash(k, s, 402) * 4 - i * 1.5; kit.streak(p, x + Math.cos(a) * (2 + i * 2), y + Math.sin(a) * (2 + i * 2), Math.cos(a), Math.sin(a), Math.max(1, l), 1 - i * .25); }
      }
      if (i <= 4) for (const [k, h] of HITS.slice(0, 3).entries()) {                              // skin chips flying off
        const [x, y] = P(h), a = -.9 - k * .7, d = 3 + i * 4;
        if (k > i) continue;
        p.rect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d + i * i * .4), 2, 3 - (i + k) % 2, H('#8a9396'));
        p.dot(Math.round(x + Math.cos(a) * d) + 1, Math.round(y + Math.sin(a) * d + i * i * .4), H('#c9d0d2'));
      }
      // Smoke streams back toward the camera: in this view it billows out and down from the engine,
      // each puff larger, lighter and thinner the nearer it comes; the stream flows a little every frame.
      if (i >= 3) {
        const n = i < 5 ? 3 : 4 + (i - 5) * 3, len = i < 5 ? 9 + (i - 3) * 6 : 18 + (i - 5) * 7;
        for (let k = n - 1; k >= 0; k--) {
          const s = clamp((k + fract(i * .37)) / n), a = Math.PI / 2 - .35 + .45 * Math.sin(k * .9 + i * .25) * s, d = Math.pow(s, 1.2) * len;
          const x = eng[0] + Math.cos(a) * d + (down[0] - eng[0]) * s * .4, y = eng[1] + Math.sin(a) * d + 2;
          kit.puff(p, x, y, (i < 5 ? 1.6 : 2) + s * (i < 5 ? 4 : 9), i < 5 ? .6 : .85 - s * .35, i < 5 ? .45 : .95 - s * .3);
        }
      }
      if (i >= 5) {                                                                               // engine fire: a hot heart, tongues licking back
        const g = Math.min(1, (i - 4) / 3), balls = [{ x: eng[0], y: eng[1] + 1, r: 2.2 + 1.6 * g, heat: 1 }];
        for (let k = 1; k < 7; k++) {
          const a = Math.PI / 2 - .35 + (hash(k, i, 405) - .5) * 1.4, d = k * (1.4 + 1.2 * g);
          balls.push({ x: eng[0] + Math.cos(a) * d, y: eng[1] + 1 + Math.sin(a) * d - (k % 2) * 2, r: (2.6 - k * .25) * (.6 + .5 * g), heat: .9 - k * .11 });
        }
        balls.push({ x: eng[0] - 2 + 4 * hash(i, 1, 407), y: eng[1] - 2 - 2 * g, r: 1.4 + g, heat: .75 });  // a lick upward
        kit.flames(p, balls, 1, i * 3);
      }
    });
    for (let y = 64; y < 80; y++) for (let x = 0; x < 128; x++) { const q = fx.get(x, y); if (q) fx.put(x, y, [q[0], q[1], q[2], Math.round(q[3] * (80 - y) / 17)]); }  // smoke thins out before the frame edge
    c.blit(fx, 0, 0, true);
    return c;
  });
}
// title_intro_enemy_head 192x112 8 @16 loop: head-on, camera just in front of the nose and a little
// low; prop disc; the wing-root guns flash on frames 0, 2, 4, 6 (left and right in turn, the cowl
// guns smaller in between).
const HEAD = { az: 90 * DEG, el: -6 * DEG };
function enemyHeadFrames() {
  return Array.from({ length: 8 }, (_, i) => {
    const c = renderPlane('kruland', 192, 112, 2.6, { ...HEAD, roll: .04 * Math.sin(i / 8 * TAU), pitch: .01 * Math.sin(i / 8 * TAU), blade: i * 45 * DEG });
    if (i % 2 === 0) {
      const { screen, toW } = c.meta, g = HI.kruland.guns, side = (i / 2) % 2;
      flash(c, screen(toW(g[side])), 1); flash(c, screen(toW(g[1 - side])), .55); flash(c, screen(toW(g[2 + side])), .45);
    }
    return c;
  });
}
// Muzzle star at screen point q, size k (1 = full): white core, gold, orange tips (the muzzle sprite's colours).
function flash(c, q, k) {
  const x0 = Math.floor(q[0]), y0 = Math.floor(q[1]), r = 2 + 5 * k;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y), star = Math.min(Math.abs(x), Math.abs(y)) < 1 ? 1 : Math.abs(Math.abs(x) - Math.abs(y)) < 1 ? .6 : .38, e = d / (r * star);
    if (e < .35) c.put(x0 + x, y0 + y, [255, 252, 230, 255]); else if (e < .7) c.paint(x0 + x, y0 + y, [255, 200, 58, 240]); else if (e < 1) c.paint(x0 + x, y0 + y, [232, 100, 30, 170]);
    else if (d < r * .8) c.paint(x0 + x, y0 + y, [255, 220, 140, 40]);
  }
}
// title_intro_hero 256x160 12 @10 loop: ours three-quarters from the front (camera 35 deg off the nose,
// 10 deg up), span about 200 px; breathes +-4 deg of roll, prop 40 deg/frame, flickering exhausts,
// one canopy glint per loop. title_intro_hero_approach 256x160 16 @16 once: the same view coming in
// from far away, span per frame from the cutscene timing, re-raymarched at every size; frame 15 =
// hero frame 0. The plane's origin is the canvas centre in every frame.
const HERO = { az: 125 * DEG, el: 10 * DEG };
const heroPose = i => ({ roll: .07 * Math.sin(i / 12 * TAU), pitch: .012 * Math.sin(i / 12 * TAU + 1.2) });
const APPROACH = [16, 45, 71, 95, 115, 133, 149, 162, 173, 181, 188, 193, 197, 199, 200, 200];
const heroScale = span => span / tipSpan('velmark', { ...HERO, ...heroPose(0) });
const heroFrames = () => Array.from({ length: 12 }, (_, i) => renderPlane('velmark', 256, 160, heroScale(200), { ...HERO, ...heroPose(i), blade: i * 40 % 120 * DEG, exhaust: i % 8, glint: i === 4 }));
const heroApproachFrames = () => APPROACH.map((s, i) => renderPlane('velmark', 256, 160, heroScale(s), { ...HERO, ...heroPose(0), blade: i * 40 % 120 * DEG, exhaust: (i + 1) % 8 }));   // frame 15 = hero frame 0
// title_intro_bomber_far 64x32 4 @8 loop: twin-engine Kruland bomber flying right, side on from a little
// behind and 18 deg above (so the long wings read as slanted slivers), hazed 30 percent toward the sky;
// props change, 1 px bob on frames 2-3.
const bomberFarFrames = () => [0, 1, 2, 3].map(i => {
  const c = renderPlane('bomber', 64, 32, .85, { az: -22 * DEG, el: 18 * DEG, blade: i * 30 * DEG, haze: .3 });
  return i < 2 ? c : new Canvas(64, 32).blit(c, 0, 1, false);
});

function build(add) {
  add('Title', 'title_intro_sky', [sky()], { fps: 1 });
  add('Title', 'title_intro_clouds_far', [cloudsFar()], { fps: 1 });
  add('Title', 'title_intro_clouds_near', [cloudsNear()], { fps: 1 });
  add('Title', 'title_intro_fighter', fighterFrames(), { fps: 10, loop: true });
  add('Title', 'title_intro_fighter_near', fighterNearFrames(), { fps: 12, loop: true });
  add('Title', 'title_intro_enemy', enemyFrames(), { fps: 10, loop: false });
  add('Title', 'title_intro_enemy_smoke', enemySmokeFrames(), { fps: 10, loop: true });
  add('Title', 'title_intro_tracer', tracerFrames(), { fps: 16, loop: true });
  add('Title', 'title_intro_muzzle', muzzleFrames(), { fps: 20, loop: true });
  add('Title', 'title_intro_chase', chaseFrames(), { fps: 12, loop: true });
  add('Title', 'title_intro_enemy_tail', enemyTailFrames(), { fps: 12, loop: true });
  add('Title', 'title_intro_enemy_hit', enemyHitFrames(), { fps: 12, loop: false });
  add('Title', 'title_intro_enemy_head', enemyHeadFrames(), { fps: 16, loop: true });
  add('Title', 'title_intro_hero_approach', heroApproachFrames(), { fps: 16, loop: false });
  add('Title', 'title_intro_hero', heroFrames(), { fps: 10, loop: true });
  add('Title', 'title_intro_bomber_far', bomberFarFrames(), { fps: 8, loop: true });
}

module.exports = {
  build, sky, cloudsFar, cloudsNear, fighterFrames, fighterNearFrames, enemyFrames, enemySmokeFrames, tracerFrames, muzzleFrames,
  chaseFrames, enemyTailFrames, enemyHitFrames, enemyHeadFrames, heroFrames, heroApproachFrames, bomberFarFrames, renderPlane, camera
};

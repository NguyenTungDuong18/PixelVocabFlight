'use strict';
// Title intro backdrops (title_intro_bg_*): one backdrop per camera angle of the cinematic, in the same
// world as title_intro_sky / title_intro_clouds_* (intro.cjs): SKY and CLOUD ramps, sun upper left,
// round cloud domes lit by their normal.
//   title_intro_bg_chase        480x270  from behind the tail looking ahead and down: horizon y 110, a
//                                        cloud sea in perspective (big domes below, flat hazy rows far),
//                                        three far towering cumulus on the horizon
//   title_intro_bg_head         480x270  looking up a little: sky deepening upward, warm sun glare upper
//                                        left, cumulus heads along the bottom edge, two far black smoke
//                                        trails and spent flak bursts (battle overhead); centre kept clear
//   title_intro_bg_hero         480x270  the held last shot under the menu: horizon y 180, a big cumulus
//                                        tower on the right (behind the plane, centre 335,130), the left
//                                        open and a touch darker (menu column x 12..170, y 90..250), a far
//                                        falling plane's smoke trail at the right edge (x >= 440, clear of the
//                                        held hero at x 225..430) in front of the tower, a 3 px ember at its foot
//   title_intro_bg_hero_clouds  960x270  translucent drifting cloud for that shot, tiles sideways (x 0 meets
//                                        x 960): soft banks in the upper sky, only faint wisps across
//                                        y 90..250, cloud tops below y 250
// Colours: SKY / CLOUD copied from intro.cjs (not imported: intro.cjs is edited separately), smoke and
// fire use the kit.SMOKE / kit.FIRE hexes of pfx.cjs. Deterministic (hash / fbm only).
const { Canvas, hex, hash, fbm } = require('../lib.cjs');
const { tone, clamp, lerp, smooth, SW, SH } = require('./common.cjs');
const R = (...h) => h.map(c => hex(c));

const SKY = R('#16305e', '#1d3d73', '#274c86', '#345e98', '#4673a9', '#5c8aba', '#78a3c9', '#97bcd6', '#b8d2e1', '#d8e6ea');
const CLOUD = R('#56688a', '#6f83a3', '#8b9fbb', '#a9bad0', '#c7d4e1', '#e2e9ef', '#f6f7f4', '#fffdf2');
const SMOKE = R('#242423', '#3b3b39', '#5c5c58', '#85857e', '#b1b1a9');                    // kit.SMOKE, dark -> light
const FIRE = R('#8a2a14', '#c2501c', '#e27a24', '#f5a83a', '#fbc64a', '#ffe48a', '#fff3c4'); // kit.FIRE, dark -> light
const SUN = [255, 247, 220], GLARE = [255, 246, 216];
const HAZE_L = .72;                                   // CLOUD tone that matches the sky's horizon haze
const LS = [-.55, -.6, .58];                          // sun direction for dome normals (x right, y down, z to camera)

// x-periodic fbm (period W): blends two copies so x = 0 and x = W meet.
const pfbm = (x, y, W, s, k) => { const t = x / W; return fbm(x * k, y * k, s) * (1 - t) + fbm((x - W) * k, y * k, s) * t; };

// ---------------------------------------------------------------- sky
// Dark at the top, pale haze at the horizon `hor`, glow round the sun; dark(x, y) lowers the light.
function skyFill(c, { hor, top, sun, glow, gain, seed, cirrus = () => 1, dark = () => 0 }) {
  c.fill((x, y) => {
    const v = clamp(y / hor), s = Math.exp(-Math.hypot(x - sun[0], y - sun[1]) / glow);
    let L = top + (.97 - top) * Math.pow(v, 1.6) + gain * s + (fbm(x * .01, y * .03, seed) - .5) * .06;
    const ci = fbm(x * .006 + 3, y * .05, seed + 1);                                      // high thin cirrus streaks
    if (y < hor * .75) L += smooth((ci - .6) / .06) * .07 * cirrus(x, y);
    return tone(SKY, L - dark(x, y), x, y, 1.25);                                        // spread > 1: no flat band where L sits on a ramp step
  });
}
// Sun disc and its warm glare (alpha in steps, ordered dither between them: no smooth banding).
function sunGlare(c, sx, sy, { disc = 6, r = 22, glare = 0, k = 110 }) {
  const R2 = Math.max(r, glare);
  for (let y = Math.floor(sy - R2); y <= sy + R2; y++) for (let x = Math.floor(sx - R2); x <= sx + R2; x++) {
    const d = Math.hypot(x - sx, y - sy);
    if (d < disc) { c.put(x, y, [...SUN, 255]); continue; }
    if (d < r) c.paint(x, y, [...SUN, Math.round(150 * Math.pow(1 - d / r, 2) * (((x + y) & 1) || d < disc * 2 ? 1 : .6))]);
    if (glare && d < glare) {
      const a = k * Math.pow(1 - d / glare, 1.6) / 30, lv = Math.floor(a) + ((a % 1) > (((x & 3) * 4 + (y & 3)) * 7 % 16 + .5) / 16 ? 1 : 0);
      if (lv) c.paint(x, y, [...GLARE, lv * 30]);
    }
  }
}

// ---------------------------------------------------------------- cloud domes
// One cloud dome: ellipse rx, ry with a wobbly rim, lit by its sphere normal (sun upper left), a bright
// rim facing the sun and a darker 1 px contour facing away (separates overlapping domes). haze pulls the
// tone toward the horizon haze, dim darkens (cloud shadow), shade darkens one side of a tower, clip cuts
// a flat dark base.
function puff(c, { x: cx, y: cy, rx, ry, haze = 0, dim = 0, shade = 0, seed = 0, clip = 1e9 }) {
  const wobK = rx > 3 ? .24 : 0;
  for (let y = Math.floor(cy - ry * 1.15); y <= cy + ry * 1.15; y++) {
    if (y > clip || y < 0 || y >= c.h) continue;
    for (let x = Math.floor(cx - rx * 1.15); x <= cx + rx * 1.15; x++) {
      if (x < 0 || x >= c.w) continue;
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, rr = Math.hypot(dx, dy);
      if (rr > 1.15) continue;
      const ca = dx / (rr || 1), sa = dy / (rr || 1);
      const wob = 1 + (fbm(ca * 1.4 + seed * .37, sa * 1.4 + seed * .61, 501) - .5) * wobK;
      if (rr >= wob) continue;
      const nx = dx / wob, ny = dy / wob, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let L = .32 + .58 * Math.max(0, nx * LS[0] + ny * LS[1] + nz * LS[2]);
      const edge = (wob - rr) * Math.min(rx, ry), facing = nx * LS[0] + ny * LS[1];
      if (edge < 1.1) L += facing > .15 ? .07 : facing < -.2 ? -.12 : 0;
      L += (fbm(x * .09 + seed, y * .12, 502) - .5) * .1 - shade;
      if (y > clip - 2.5) L -= .2;                                                          // flat shaded base
      c.put(x, y, tone(CLOUD, lerp(L, HAZE_L, haze) - dim, x, y, 1.1));
    }
  }
}
// A heap of round lobes {x, y, r, z} drawn as ONE cloud: each pixel takes the lobe whose surface stands
// nearest the camera (height + z), so lobes meet in creases instead of outlines. Lit by that lobe's
// normal; shade(x, y) darkens (tower side away from the sun), clip cuts a flat dark base, a bright rim
// on the sunward silhouette and a darker one opposite.
function heap(c, lobes, { haze = 0, dim = () => 0, shade = () => 0, clip = 1e9, seed = 0 }) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of lobes) { x0 = Math.min(x0, p.x - p.r * 1.15); x1 = Math.max(x1, p.x + p.r * 1.15); y0 = Math.min(y0, p.y - p.r * 1.15); y1 = Math.max(y1, p.y + p.r * 1.15); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(c.w - 1, Math.ceil(x1)); y1 = Math.min(c.h - 1, Math.ceil(Math.min(y1, clip)));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, Lb = new Float32Array(bw * bh).fill(NaN);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let best = -1e9, n = null;
    for (const p of lobes) {
      const dx = x + .5 - p.x, dy = y + .5 - p.y;
      if (Math.abs(dx) > p.r * 1.15 || Math.abs(dy) > p.r * 1.15) continue;
      const d = Math.hypot(dx, dy), ca = dx / (d || 1), sa = dy / (d || 1);
      const rr = p.r * (1 + (fbm(ca * 1.6 + p.s * .37, sa * 1.6 + p.s * .61, 501) - .5) * (p.r > 4 ? .22 : 0));
      if (d >= rr) continue;
      const hgt = Math.sqrt(rr * rr - d * d) + (p.z || 0);
      if (hgt > best) { best = hgt; n = [dx / rr, dy / rr, Math.sqrt(1 - (d / rr) ** 2)]; }
    }
    if (!n) continue;
    let L = .34 + .58 * Math.max(0, n[0] * LS[0] + n[1] * LS[1] + n[2] * LS[2]) + (fbm(x * .08 + seed, y * .1, 502) - .5) * .1 - shade(x, y);
    if (y > clip - 2.5) L -= .22;
    Lb[(y - y0) * bw + x - x0] = L;
  }
  const inside = (x, y) => x >= x0 && y >= y0 && x <= x1 && y <= y1 && !isNaN(Lb[(y - y0) * bw + x - x0]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let L = Lb[(y - y0) * bw + x - x0]; if (isNaN(L)) continue;
    if (!inside(x - 1, y) || !inside(x, y - 1)) L += .08; else if (!inside(x + 1, y) || !inside(x, y + 1)) L -= .06;
    c.put(x, y, tone(CLOUD, lerp(L, HAZE_L, haze) - dim(x, y), x, y, 1.1));
  }
}
// A towering cumulus (congestus): wide skirt on the cloud sea, a lumpy column narrowing upward, a
// cauliflower head; lobes in front (z) bulge, the right side falls into shade.
function tower(c, { x, base, top, w, haze = 0, seed, lean = 0, dim }) {
  const H = base - top, lobes = [], n = Math.max(4, Math.round(H / (w * .22)));
  const cxAt = t => x + lean * t * H + (fbm(t * 2.5, 1, seed) - .5) * w * .3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), width = w * (1.05 - .5 * t), cy = base - w * .18 - t * (H - w * .5), cx = cxAt(t);
    for (const [k, side] of [[0, -1], [1, 1], [2, 0]]) {
      const r = width * (side ? .34 + .16 * hash(i, k, seed) : .38 + .1 * hash(i, k, seed));
      lobes.push({ x: cx + side * width * (.42 + .1 * hash(i, k + 3, seed)), y: cy + (hash(i, k + 6, seed) - .5) * r * .5, r, z: side ? hash(i, k + 9, seed) * r * .3 : r * .35, s: seed + i * 5 + k });
      if (side && hash(i, k + 12, seed) > .35) { const q = width * (.13 + .08 * hash(i, k + 15, seed)); lobes.push({ x: cx + side * width * (.72 + .1 * hash(i, k + 18, seed)), y: cy - r * .3, r: q, z: 0, s: seed + i * 5 + k + 50 }); }
    }
  }
  const ht = cxAt(1), hy = top + w * .3;                                                 // the head: a few big domes
  for (let k = 0; k < 4; k++) lobes.push({ x: ht + (k - 1.5) * w * .26, y: hy + Math.abs(k - 1.5) * w * .12 + hash(k, 1, seed) * 3, r: w * (.3 + .08 * hash(k, 2, seed)), z: w * .1 * (k === 1 ? 1 : 0), s: seed + 90 + k });
  lobes.push({ x: x - w * .2, y: base - w * .05, r: w * .55, z: -w * .3, s: seed + 99 }, { x: x + w * .35, y: base - w * .02, r: w * .5, z: -w * .3, s: seed + 98 });   // skirt
  heap(c, lobes, { haze, dim, clip: base, seed, shade: (px, py) => .12 * clamp((px - (cxAt(clamp((base - py) / H)) - w * .1)) / w, -.6, 1) });
}
// A sea of cloud seen from above in perspective, horizon `hor` (camera height = 1, focal 240 px, so a
// screen row hor + K/d lies at distance d): a shaded valley deck with perspective texture, then rows of
// domes far to near. Domes gather into clumps (big, risen) and thin out in valleys (small, sparse)
// following a world-space noise; far rows tiny, flat and hazy, near rows big and rounder.
function cloudSea(c, { hor, K, R0, seed, dim = () => 0 }) {
  const W = c.w, H = c.h, depth = y => clamp((y - hor) / (H - hor)), hz = t => (1 - smooth(t * 2.4)) * .92;
  const clump = (sx, d) => fbm((sx - W / 2) * d / 240 * .9 + 7, d * .9, seed + 2);
  for (let y = hor; y < H; y++) for (let x = 0; x < W; x++) {
    const d = K / Math.max(.5, y - hor), X = (x - W / 2) * d / 240;
    const L = .42 + (clump(x, d) - .5) * .35 + (fbm(X * 3, d * 3, seed + 1) - .5) * .12;
    c.put(x, y, tone(CLOUD, lerp(L, HAZE_L, hz(depth(y))) - dim(x, y), x, y, 1.1));
  }
  let row = 0;
  for (let d = K / 1.5; d >= .8; d /= 1.1, row++) {
    const yRow = hor + K / d, r = R0 / d;
    if (r < 1.7 || yRow - r * .9 > H) continue;
    for (let sx = -r * (1 + hash(row, 0, seed)), i = 0; sx < W + r; i++) {
      const f = smooth((clump(sx, d) - .3) / .45), hr = hash(row, i * 3 + 1, seed);
      sx += r * (.6 + .8 * hash(row, i * 3 + 3, seed));
      if (f < .15 && hr < .4) continue;                                                     // open valley
      const size = r * (.55 + .7 * f + .3 * hr), cy = yRow + (hash(row, i * 3 + 2, seed) - .5) * r * .4 - size * .35 * f;
      const t = depth(cy);
      puff(c, { x: sx, y: cy, rx: size, ry: size * (.3 + .25 * t + .3 * f), haze: hz(t), seed: row * 31 + i, dim: dim(sx, cy) });
    }
  }
}

// ---------------------------------------------------------------- soft volumes (smoke, translucent cloud)
// Density 0..1 from soft ellipse blobs {x, y, rx, ry, w}, merged (1 - product of 1 - v; max = keep the
// strongest, for chains of overlapping blobs that must not saturate) and eroded by noise; wrap = the
// canvas tiles sideways.
function density(W, H, blobs, { wrap = false, seed, erode = .5, k = .07, max = false }) {
  const b = new Float32Array(W * H);
  for (const p of blobs) for (const ox of wrap ? [-W, 0, W] : [0]) {
    const x0 = Math.max(0, Math.floor(p.x + ox - p.rx)), x1 = Math.min(W - 1, Math.ceil(p.x + ox + p.rx));
    const y0 = Math.max(0, Math.floor(p.y - p.ry)), y1 = Math.min(H - 1, Math.ceil(p.y + p.ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + .5 - p.x - ox) / p.rx, dy = (y + .5 - p.y) / p.ry, d2 = dx * dx + dy * dy;
      if (d2 < 1) { const i = y * W + x, v = (max ? Math.sqrt(1 - d2) : 1 - d2) * (p.w ?? 1); b[i] = max ? Math.max(b[i], v) : 1 - (1 - b[i]) * (1 - v); }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!b[i]) continue;
    const n = wrap ? pfbm(x, y * 1.6, W, seed, k) : fbm(x * k, y * k * 1.6, seed);
    b[i] = clamp(b[i] * 1.15 - (n - .45) * erode - .08);
  }
  return b;
}
// Paints a density buffer with alpha: lit where the density falls off toward the sun (upper left),
// shaded toward the lower right; denser = darker by dk. alpha = amax * density^ap.
function volume(c, b, { ramp, L0, Lk = 1.3, dk = .2, amax, ap = 1.2, wrap = false, seed }) {
  const W = c.w, H = c.h, at = (x, y) => { if (wrap) x = (x + W) % W; return x < 0 || y < 0 || x >= W || y >= H ? 0 : b[y * W + x]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = b[y * W + x]; if (d < .02) continue;
    const n = wrap ? pfbm(x, y, W, seed + 3, .15) : fbm(x * .15, y * .15, seed + 3);
    const L = L0 + Lk * (d - at(x - 2, y - 2)) - dk * d + (n - .5) * .12;
    const col = tone(ramp, L, x, y, .7);
    c.paint(x, y, [col[0], col[1], col[2], Math.round(amax * Math.pow(clamp(d), ap))]);
  }
}
// Billows along a quadratic curve a (fresh end) -> m -> b (old end): radius r0 -> r1 swelling and
// pinching, weight w0 -> w1, the old end wandering (drift) and blown sideways (wind px at the old end).
function trail(a, m, b, { r0, r1, w0, w1, seed, drift = 4, wind = 0 }) {
  const out = [], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, r = lerp(r0, r1, t) * (.65 + .7 * fbm(t * 9, 3, seed + 1));
    const x = u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * m[1] + t * t * b[1];
    const o = (fbm(t * 5, 1, seed) - .5) * drift * 2 * t + wind * t * t;
    out.push({ x: x + o + (hash(i, 2, seed) - .5) * r * .5, y: y + (hash(i, 3, seed) - .5) * r * .4, rx: r * (1 + .25 * hash(i, 1, seed)), ry: r * .85, w: lerp(w0, w1, t) * (.75 + .25 * hash(i, 4, seed)) });
  }
  return out;
}
// A spent flak burst: 3-4 ragged lobes round (x, y).
const flak = (x, y, r, w, seed) => Array.from({ length: 3 + (hash(1, 1, seed) > .5 ? 1 : 0) }, (_, i) => {
  const a = i * 2.1 + hash(i, 2, seed) * 1.5, q = r * (.55 + .35 * hash(i, 3, seed));
  return { x: x + Math.cos(a) * r * .5, y: y + Math.sin(a) * r * .4, rx: q, ry: q * .8, w };
}).concat([{ x, y, rx: r * .6, ry: r * .5, w }]);
// A tiny far ember where the falling plane's trail meets the cloud (kit.FIRE): kept to 3 px so it
// never reads as a fire on our plane in front.
function fireGlow(c, x, y) {
  for (const [dx, dy, k] of [[0, 0, 4], [-1, 0, 2], [0, -1, 1]]) c.put(x + dx, y + dy, FIRE[k]);
}

// ---------------------------------------------------------------- backdrops
function bgChase() {
  const c = new Canvas(SW, SH), HOR = 110;
  skyFill(c, { hor: HOR, top: .3, sun: [30, -30], glow: 95, gain: .35, seed: 411 });
  tower(c, { x: 74, base: HOR + 3, top: 52, w: 36, haze: .5, seed: 421, lean: -.05 });
  tower(c, { x: 330, base: HOR + 2, top: 72, w: 26, haze: .6, seed: 422 });
  tower(c, { x: 436, base: HOR + 3, top: 44, w: 42, haze: .45, seed: 423, lean: .06 });
  cloudSea(c, { hor: HOR, K: 175, R0: 60, seed: 431 });
  return c;
}

function bgHead() {
  const c = new Canvas(SW, SH);
  skyFill(c, { hor: 340, top: .1, sun: [58, 30], glow: 80, gain: .5, seed: 441, cirrus: x => smooth((x - 130) / 70) });
  sunGlare(c, 58, 30, { disc: 7, r: 24, glare: 88, k: 120 });
  // Far smoke: an old wide trail on the right, a thin faint one on the left; spent flak up top.
  const smoke = [
    ...trail([480, 222], [436, 92], [330, -10], { r0: 2.5, r1: 13, w0: .95, w1: .55, seed: 451, drift: 8, wind: -14 }),
    ...trail([22, 182], [66, 74], [134, 10], { r0: 1.8, r1: 7, w0: .65, w1: .4, seed: 452, drift: 4, wind: 8 }),
    ...flak(196, 44, 12, .6, 461), ...flak(268, 24, 10, .5, 462), ...flak(330, 74, 13, .65, 463), ...flak(384, 36, 9, .45, 464),
    ...flak(150, 92, 9, .42, 465), ...flak(228, 84, 8, .38, 466), ...flak(406, 116, 11, .5, 467)
  ];
  volume(c, density(SW, SH, smoke, { seed: 471, erode: .45, k: .09, max: true }), { ramp: SMOKE, L0: .6, Lk: 1.4, dk: .4, amax: 175, ap: 1.4, seed: 472 });
  // Cumulus heads along the bottom: higher in the corners, low in the middle (the centre stays open).
  const lobes = [];
  for (let i = 0; i < 25; i++) {
    const x = i * 20 + (hash(i, 1, 481) - .5) * 14, edge = Math.abs(x - 250) / 250, topY = 254 - 46 * Math.pow(edge, 1.5) + (x > 250 ? 6 : 0) + (hash(i, 6, 481) - .5) * 10;
    const r = 13 + 22 * Math.pow(hash(i, 2, 481), 1.4) + 12 * edge;
    lobes.push({ x, y: topY + r, r, z: hash(i, 4, 481) * 10, s: i });
    // Small knobs on the crown: cauliflower, not a row of balls.
    for (let k = 0; k < 2; k++) if (hash(i, 7 + k, 481) > .4) { const r2 = r * (.28 + .2 * hash(i, 5 + k * 9, 481)); lobes.push({ x: x + (hash(i, 3 + k * 11, 481) - .5) * r * 1.2, y: topY + r2 * .6 - 1, r: r2, z: r * .6, s: i * 3 + k + 40 }); }
  }
  heap(c, lobes, { haze: .1, seed: 482 });
  return c;
}

// Left side under the menu column (x < ~170, y > ~60): a touch darker (about x0.9), open sky.
const menuShade = (x, y) => (1 - smooth((x - 160) / 130)) * smooth((y - 50) / 50);
function bgHero() {
  const c = new Canvas(SW, SH), HOR = 180;
  skyFill(c, { hor: HOR, top: .2, sun: [-10, -40], glow: 120, gain: .4, seed: 491, cirrus: x => smooth((x - 200) / 80), dark: (x, y) => .09 * menuShade(x, y) });
  // Behind the plane: a low hazy cumulus mid-right and the big tower on the right.
  tower(c, { x: 282, base: HOR + 2, top: 118, w: 40, haze: .45, seed: 501, lean: .04 });
  tower(c, { x: 408, base: HOR + 3, top: 22, w: 104, haze: .08, seed: 502, lean: .05 });
  // A far falling plane: the trail runs from high up (old, wide, pale) down to the cloud (fresh, dark).
  // Kept wholly at x >= 440, in front of the tower: the held hero plane covers about x 225..430, y 94..180.
  const foot = [454, HOR + 1];
  volume(c, density(SW, SH, trail(foot, [456, 100], [462, 4], { r0: 1.5, r1: 9, w0: 1, w1: .65, seed: 511, drift: 4, wind: 8 }), { seed: 512, erode: .45, k: .09, max: true }),
    { ramp: SMOKE, L0: .6, Lk: 1.4, dk: .5, amax: 225, ap: 1.2, seed: 513 });
  cloudSea(c, { hor: HOR, K: 95, R0: 52, seed: 521, dim: (x, y) => .32 * menuShade(x, y + 60) });
  fireGlow(c, foot[0], foot[1] + 1);
  return c;
}

// Translucent drifting cloud for the held shot (tiles sideways, period 960).
function bgHeroClouds() {
  const W = 960, c = new Canvas(W, SH), blobs = [];
  // Upper sky: soft banks of flattened blobs, clustered.
  for (let i = 0; i < 16; i++) {
    const cx = i * 60 + hash(i, 1, 531) * 40, cy = 26 + hash(i, 2, 531) * 52, n = 4 + Math.floor(hash(i, 3, 531) * 5);
    for (let j = 0; j < n; j++) blobs.push({ x: cx + (j - n / 2) * 11 + (hash(i, j + 4, 531) - .5) * 10, y: cy + (hash(i, j + 20, 531) - .5) * 8, rx: 12 + 16 * hash(i, j + 40, 531), ry: 5 + 6 * hash(i, j + 60, 531), w: .7 + .3 * hash(i, j + 80, 531) });
  }
  // Across the menu band: only thin, faint streaks.
  for (let i = 0; i < 9; i++) blobs.push({ x: i * 107 + hash(i, 1, 532) * 50, y: 104 + hash(i, 2, 532) * 130, rx: 40 + 40 * hash(i, 3, 532), ry: 2 + 2.5 * hash(i, 4, 532), w: .38 });
  // Below y 250: passing cloud tops.
  for (let i = 0; i < 22; i++) blobs.push({ x: i * 44 + hash(i, 1, 533) * 20, y: 272 + hash(i, 2, 533) * 4, rx: 22 + 18 * hash(i, 3, 533), ry: 18 + 5 * hash(i, 4, 533), w: 1 });
  volume(c, density(W, SH, blobs, { wrap: true, seed: 541, erode: .75, k: .06 }), { ramp: CLOUD, L0: .66, Lk: 1.6, dk: .25, amax: 185, ap: 1.5, wrap: true, seed: 542 });
  return c;
}

function build(add) {
  add('Title', 'title_intro_bg_chase', [bgChase()], { fps: 1 });
  add('Title', 'title_intro_bg_head', [bgHead()], { fps: 1 });
  add('Title', 'title_intro_bg_hero', [bgHero()], { fps: 1 });
  add('Title', 'title_intro_bg_hero_clouds', [bgHeroClouds()], { fps: 1 });
}

module.exports = { build, bgChase, bgHead, bgHero, bgHeroClouds };

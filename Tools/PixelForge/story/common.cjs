'use strict';
// Story art (cut_*, vista_*, their overlays): shared ramps and 2D painting helpers.
// Full-screen pictures are 480x270 px (shown x4 on the 1920x1080 reference canvas).
const { Canvas, hex, hash, fbm, withAlpha } = require('../lib.cjs');
// Plain colour lists: NOT lib.ramp(), which would re-register shared hexes and change voxel shading elsewhere.
const R = (...h) => h.map(c => hex(c));

const SW = 480, SH = 270;
// The M1 pictures were composed on 480x300: they paint on a tall canvas and keep rows oy..oy+270.
const TALL = 300;
const crop = (c, oy = 15) => new Canvas(SW, SH).blit(c, 0, -oy, false);
const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bay = (x, y) => (BAY[y & 3][x & 3] + .5) / 16;
// Picks a tone of ramp R from light L (0 dark .. 1 bright) with ordered dither between neighbours.
function tone(R, L, x, y, spread = .7) {
  const v = Math.max(0, Math.min(.9999, L)) * (R.length - 1) + (bay(x, y) - .5) * spread;
  return R[Math.max(0, Math.min(R.length - 1, Math.round(v)))];
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- ramps (dark -> light)
const TABLE = R('#15120f', '#272019', '#3b3128', '#544739', '#6f6250', '#8a7f6c', '#a59d8b'); // table wood in grey daylight
const TIN_P = R('#0f2326', '#17363a', '#214c50', '#2f6566', '#44817d', '#6aa39a');            // tin enamel, sea green
const TIN_O = R('#5a4520', '#8a6c30', '#b99647', '#dcc177', '#f0e0a8');                       // printed gilt ornament
const TIN_M = R('#2b3033', '#474e52', '#69747a', '#929da1', '#bcc6c8', '#e3ebeb');            // bare tinplate
const RUST = R('#3a1c10', '#5c2c17', '#844120', '#a85c2c');                                   // rust on the rims
const HAND = R('#4f352c', '#775446', '#9c7462', '#bb927c', '#d3ae96', '#e6c9b3');             // skin in cold grey light (no age)
const WOOL = R('#0c0f14', '#151a22', '#1f2631', '#2c3542', '#3d4856');                        // dark wool sleeve
const SEPIA = R('#1f150c', '#3a2817', '#5b4126', '#80603b', '#a68558', '#c9ab7c', '#e6d1a6', '#f6ebcd'); // photograph
const PAPER = R('#6f6142', '#96865f', '#bcab80', '#d9c99f', '#ece0bd', '#f8f1d9');            // old paper / card
const LINEN = R('#6d6a5c', '#93907f', '#b6b3a0', '#d3d0bd', '#e9e6d5', '#f7f5e9');            // washed handkerchief linen
const LINEN_B = R('#2f4257', '#46607a', '#6883a0', '#8fa8c0');                                // its faded blue woven border
const INK = R('#141a2c', '#27314c', '#45527a');                                               // blue-black writing ink
const PLAID = R('#2a130e', '#47211a', '#683226', '#874634', '#a35f46');                       // Jonas's rust wool blanket
const PLAID_L = R('#1c1a14', '#3b3626', '#6b6243', '#9a8f66');                                // blanket check lines
const YSKIN = R('#5a3020', '#8a513a', '#b9765a', '#dc9c79', '#f0bf9c', '#fad9bd');            // young skin in lamp light
const NIGHT = R('#070b17', '#0b1224', '#101b33', '#172644', '#213457', '#2e466d', '#415c84', '#5d7a9e', '#86a0bd'); // night sky
const MOON = R('#8fa3b8', '#b9c8d4', '#dbe4e6', '#f2f5ec', '#fffdf2');
const FIELD = R('#0a1418', '#0f1f23', '#162c2f', '#1f3b3b', '#2b4d48', '#3c6358', '#55806f');  // moonlit grass
const ROOF = R('#160f12', '#24161a', '#3a2226', '#553135', '#734647', '#8f5f5c', '#ab7f79');   // moonlit clay pantiles
const SIL = R('#05080f', '#0a0f1b', '#111829', '#1a2438', '#27344c');                          // far silhouettes
const WARM = R('#7a3d12', '#b8661e', '#e9983a', '#f2b65a', '#fbd98c', '#fff3c8');              // lamp / window light
const WALLW = R('#1d130c', '#33210f', '#4d3319', '#694826', '#866038', '#a37c4e');             // lamp-lit wall boards

// ---------------------------------------------------------------- painting helpers
// Signed distance to a capsule (segment a-b, radius r); negative inside.
function capsule(px, py, ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t) - r;
}
// Rounded rectangle test.
function rrect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = x < x0 + r ? x0 + r : x >= x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y >= y1 - r ? y1 - r : y;
  return (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r + .5 || (cx === x && cy === y);
}
// Soft translucent shadow blob (two-tier: dense core, soft fringe) painted with alpha.
function softShadow(c, test, core = 105, fringe = 55, grow = 3) {
  const w = c.w, h = c.h, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x, y)) m[y * w + x] = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (m[y * w + x]) { c.paint(x, y, [0, 0, 0, core]); continue; }
    let near = false;
    for (let dy = -grow; dy <= grow && !near; dy++) for (let dx = -grow; dx <= grow; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx] && dx * dx + dy * dy <= grow * grow) { near = true; break; }
    }
    if (near) c.paint(x, y, [0, 0, 0, fringe]);
  }
}
// Wood board texture value (-1..1) for boards running along x: long grain streaks, seams, knots.
function grain(x, y, boardH, seed) {
  const b = Math.floor(y / boardH), v = y - b * boardH, off = hash(b, 1, seed) * 300;
  if (v === 0) return -1.6;                                         // seam between boards
  let g = fbm((x + off) * .035, (y + b * 9) * .55, seed) - .5;
  g += (fbm((x + off) * .012, b * 3.1, seed + 5) - .5) * .9;        // board-to-board tone
  const kx = 40 + hash(b, 2, seed) * 400, ky = (b + .5) * boardH;
  const kd = Math.hypot((x - kx) * .45, y - ky);
  if (hash(b, 3, seed) < .55 && kd < 5) g -= (5 - kd) * .22;        // knot
  return g * 2;
}

// Shaded tube (limb, thumb, pole) from a to b with radius r0 -> r1: lit on the flank facing (lx, ly),
// darkest tone as an ink rim. L = base light (number or fn(x, y)); k = how round it looks.
function tube(c, ax, ay, bx, by, r0, r1, R, L, { lx = -.7, ly = -.7, k = .45, rim = true, spread = .7 } = {}) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, rm = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(ay, by) - rm); y <= Math.max(ay, by) + rm; y++) for (let x = Math.floor(Math.min(ax, bx) - rm); x <= Math.max(ax, bx) + rm; x++) {
    const t = clamp(((x + .5 - ax) * dx + (y + .5 - ay) * dy) / (len * len)), r = lerp(r0, r1, t);
    const qx = x + .5 - ax - dx * t, qy = y + .5 - ay - dy * t, d = Math.hypot(qx, qy);
    if (d > r) continue;
    const base = typeof L === "function" ? L(x, y) : L, e = d / r;
    c.put(x, y, rim && d > r - 1.2 ? R[0] : tone(R, base * (1 + k * (qx * lx + qy * ly) / r * e), x, y, spread));
  }
}

module.exports = {
  SW, SH, TALL, crop, Canvas, hex, hash, fbm, withAlpha, bay, tone, clamp, lerp, smooth, capsule, rrect, softShadow, grain, tube,
  TABLE, TIN_P, TIN_O, TIN_M, RUST, HAND, WOOL, SEPIA, PAPER, LINEN, LINEN_B, INK, PLAID, PLAID_L, YSKIN,
  NIGHT, MOON, FIELD, ROOF, SIL, WARM, WALLW
};

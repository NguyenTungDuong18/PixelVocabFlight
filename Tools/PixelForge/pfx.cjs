'use strict';
// pixelfx (vendor/pixelfx, MIT, patch-gg/pixelfx) inside PixelForge.
// - render(id, opts): plays one vendored effect at a low frame rate and returns PixelForge Canvas frames,
//   cropped to the box shared by every frame, with the effect's origin as anchor.
// - paint(w, h, draw): one frame drawn with the pixelfx Painter (color + additive light), for our own effects.
// - build(add): the library sprites fx_fire_*, fx_bird, fx_poof… (not placed on any map yet).
// The vendored files are ES modules; Node >= 22.12 loads them with require().
const { Canvas } = require('./lib.cjs');
const core = require('./vendor/pixelfx/src/core/index.js');

const fxModule = id => require('./vendor/pixelfx/src/fx/' + id + '.js');

// Light near the frame edge fades out over E px so glows never end in a hard line (as pixelfx's sheet export).
function edgeFade(f, E = 8) {
  const { w, h, light: L } = f;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, y, w - 1 - x, h - 1 - y), l = L[x + y * w];
    if (e >= E || !(l & 0xffffff)) continue;
    const u = (e + .5) / E, k = u * u * (3 - 2 * u);
    L[x + y * w] = (l & 0xff000000) | Math.round((l & 255) * k) | (Math.round(((l >>> 8) & 255) * k) << 8) | (Math.round(((l >>> 16) & 255) * k) << 16);
  }
}

// RGBA of a pixelfx frame over transparency; alpha below `cut` is dropped (invisible haze would only grow the box).
function rgbaOf(f, cut) {
  const out = new Uint8ClampedArray(f.w * f.h * 4);
  core.composite(f, out, null);
  for (let i = 3; i < out.length; i += 4) if (out[i] < cut) out[i] = 0;
  return out;
}
function canvasOf(rgba, w, x0 = 0, y0 = 0, cw = w, ch = rgba.length / 4 / w) {
  const c = new Canvas(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = ((y + y0) * w + x + x0) * 4;
    if (rgba[i + 3]) c.px[y * cw + x] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
  }
  return c;
}

// One frame drawn with a pixelfx Painter: draw(p, core) in frame pixels (origin top-left).
function paint(w, h, draw, cut = 10) {
  const f = core.createFrame(w, h);
  draw(core.painterFor(f), core);
  return canvasOf(rgbaOf(f, cut), w);
}

// n frames of one effect: draw(p, i, core).
const frames = (w, h, n, draw, cut) => Array.from({ length: n }, (_, i) => paint(w, h, p => draw(p, i, core), cut));

// ---- Kit for the game's own effects, in the game's ramps (pixelfx colour numbers, hot/light first).
const H = core.hex;
const FIRE = ['#ffffff', '#fff3c4', '#ffe48a', '#fbc64a', '#f5a83a', '#e27a24', '#c2501c', '#8a2a14', '#4c170b'].map(H);
const SMOKE = ['#d8d8d0', '#b1b1a9', '#85857e', '#5c5c58', '#3b3b39', '#242423'].map(H);
const clampI = (r, i) => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];
// Several flame balls melted into one mass (metaballs): one silhouette with a cool rim, hot heart, a lit
// top-left and its own light. balls: [{x, y, r, heat}], heat 1 white-hot .. 0 smouldering.
function flames(p, balls, glow = 1, seed = 0) {
  if (!balls.length) return;
  const x0 = Math.min(...balls.map(b => b.x - b.r * 1.6)), x1 = Math.max(...balls.map(b => b.x + b.r * 1.6));
  const y0 = Math.min(...balls.map(b => b.y - b.r * 1.6)), y1 = Math.max(...balls.map(b => b.y + b.r * 1.6));
  const field = (x, y) => {
    let s = 0, h = 0;
    for (const b of balls) { const w = b.r * b.r / ((x - b.x) ** 2 + (y - b.y) ** 2 + .3); s += w; h += w * b.heat; }
    return [s, s ? h / s : 0];
  };
  p.shade(x0, y0, x1, y1, (x, y, o) => {
    const [s, h] = field(x, y);
    if (s < 1) return;
    // billows: noise in the heat; the lower-right flank in shadow (light from the top-left)
    const heat = h + core.noise2(x * .45 + seed, y * .45, 5) * .18, shadow = field(x + 1.5, y + 1.5)[0] < 1 ? 1 : 0;
    const rim = s < 1.45 ? 2 : s < 2.3 ? 1 : 0;
    o.c = clampI(FIRE, (1 - heat) * (FIRE.length - 3) + rim + shadow);
    o.l = clampI(FIRE, (1 - h) * (FIRE.length - 3) + 2); o.k = .07 * h * glow;
  });
  for (const b of balls) p.glow(b.x, b.y, b.r * 2 + 2, clampI(FIRE, (1 - b.heat) * 5 + 2), .1 * b.heat * glow);
}
// A soft puff of smoke or dust: body, a denser low core, a lit cap (top-left light). a opacity, tone 0 light .. 1 dark.
function puff(p, x, y, r, a, tone = .4, ramp = SMOKE) {
  const i = tone * (ramp.length - 1);
  if (a <= .01) return;
  p.disc(x, y, r, clampI(ramp, i), a * .6);
  p.disc(x + r * .14, y + r * .18, r * .68, clampI(ramp, r < 2.2 ? i : i + 1), a * .5);
  p.disc(x - r * .26, y - r * .3, r * .48, clampI(ramp, i - 1), a * .5);
}
// A spark: speed streak with a hot head and cooler tail, plus a point of light. (dx, dy) unit motion, k heat 1..0.
function streak(p, x, y, dx, dy, len, k, glow = 1) {
  const head = clampI(FIRE, (1 - k) * 5), tail = clampI(FIRE, (1 - k) * 5 + 2);
  if (len > 1) p.line(x - dx * len, y - dy * len, x - dx * len * .45, y - dy * len * .45, tail);
  p.line(x - dx * Math.min(len, 1) * .5, y - dy * Math.min(len, 1) * .5, x, y, head);
  p.glow(x, y, 2.5, head, .5 * k * glow);
}
// Translucent fill (true alpha, never dithered): fn(x, y) at pixel centres returns [colour, alpha] or nothing.
function soft(p, x0, y0, x1, y1, fn) {
  p.each(x0, y0, x1, y1, (x, y, sx, sy) => { const r = fn(x, y); if (r) p.blendPx(sx, sy, r[0], r[1]); });
}
// Crisp pixels with a translucent dark outline under them (UI marks: reticle, quest marker).
function crisp(p, pix, ink = H('#14170f'), a = .66) {
  const key = new Set(pix.map(([x, y]) => x + ',' + y));
  for (const [x, y] of pix) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = (x + dx) + ',' + (y + dy);
    if (!key.has(k)) { key.add(k); p.blend(x + dx, y + dy, ink, a); }
  }
  for (const [x, y, c] of pix) p.px(x, y, c);
}
const kit = { H, FIRE, SMOKE, flames, puff, streak, soft, crisp, frames };

function render(id, { fps = 10, options = {}, cut = 12 } = {}) {
  const mod = fxModule(id), meta = mod.meta, [W, H] = meta.size, [OX, OY] = meta.origin;
  const fx = core.createFx(mod, { x: OX, y: OY, ...options });
  const n = Math.max(1, Math.round(meta.duration * fps) + (meta.loop ? 0 : 1));
  const f = core.createFrame(W, H), shots = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) fx.update(1 / fps);
    core.clearFrame(f);
    fx.draw(f);
    edgeFade(f);
    shots.push(rgbaOf(f, cut));
  }
  const empty = s => { for (let i = 3; i < s.length; i += 4) if (s[i]) return false; return true; };
  if (!meta.loop) while (shots.length > 1 && empty(shots[shots.length - 1])) shots.pop();
  // shared box, origin included so the anchor always lies inside the sprite
  let x0 = OX, y0 = OY, x1 = OX, y1 = OY;
  for (const s of shots) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (s[(y * W + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  return { frames: shots.map(s => canvasOf(s, W, x0, y0, cw, ch)), anchor: [OX - x0, OY - y0], loop: !!meta.loop };
}

// Game palette swaps (warm daylight 1944): steel instead of violet iron, field-grey smoke, a brown sparrow.
const STEEL = ['#14170f', '#262c30', '#3d464b', '#5d686d', '#8a959a'];
const LIBRARY = [
  ['fx_fire_brazier', 'fire/brazier', { iron: STEEL }],
  ['fx_fire_torch', 'fire/torch', { iron: STEEL }],
  ['fx_fire_camp', 'fire/campfire', {}],
  ['fx_bird', 'critters/bird', { palette: ['#14100b', '#2e2215', '#4d3820', '#6e5230', '#98774a', '#c7a26a', '#f3edd6'], breast: ['#5e472b', '#a98a57', '#e3cf9c', '#f3edd6'] }],
  ['fx_butterfly', 'critters/butterfly', { palette: ['#1a0c06', '#4c170b', '#a3351a', '#e27a24', '#fbc64a', '#fff3c4', '#ffffff'], spots: ['#14170f', '#3d2a17', '#f3edd6', '#ffffff'] }],
  ['fx_poof', 'spawn/poof', { palette: ['#3b3b39', '#5c5c58', '#85857e', '#b1b1a9', '#d8d8d0', '#ffffff'] }],
  ['fx_spark_arc', 'lightning/spark-arc', {}],
  ['fx_tesla_arcs', 'lightning/tesla-coil', { coil: false }],
  ['fx_explosion_barrel', 'explosions/barrel-explosion', {}],
  ['fx_explosion_dirt', 'explosions/dirt-explosion', {}],
  ['fx_splash_big', 'water/splash', {}],
  ['fx_burning', 'status/burning', { fireOnly: true }],
];
const FPS = 10;

function build(add) {
  for (const [name, id, options] of LIBRARY) {
    const { frames, anchor, loop } = render(id, { fps: FPS, options });
    add('Effects', name, frames, { fps: FPS, loop, anchor });
  }
}

module.exports = { core, fxModule, render, paint, frames, kit, build, LIBRARY, FPS };

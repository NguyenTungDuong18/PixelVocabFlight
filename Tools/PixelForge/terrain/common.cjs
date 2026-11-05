'use strict';
// Terrain: tile size, river curves (synced with Wildlife.cs), wrapping canvas, tree/hut/crater painters, blur.
const { PAL, shift, withAlpha, hash, noise, dither, Canvas } = require('../lib.cjs');
const { OL, WD, GR, SW } = PAL;

const TW = 680, TH = 560;
const TAU = Math.PI * 2;
const P = (y, k = 1, phase = 0) => Math.sin(TAU * k * y / TH + phase);
const jungleRiverX = y => 250 + 46 * P(y) + 22 * P(y, 2, 1.3);
const iceRiverX = y => 190 + 58 * P(y, 1, .5) + 16 * P(y, 3, 2.1);

// Canvas whose y axis wraps, so features drawn across the top/bottom edge tile seamlessly.
class Wrap extends Canvas {
  wy(y) { y = Math.floor(y); return ((y % this.h) + this.h) % this.h; }
  get(x, y) { return super.get(x, this.wy(y)); }
  put(x, y, c) { super.put(x, this.wy(y), c); }
  paint(x, y, c) { super.paint(x, this.wy(y), c); }
}

const shade = a => [10, 18, 12, a];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Rounded crown lit from the north-west; lumpy edge from value noise.
function crown(c, x, y, r, tones, seed, shadowA = 110) {
  c.ellipse(x + r * .5, y + r * .65, r * 1.02, r * .92, shade(shadowA), true);
  const R = Math.ceil(r + 2);
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const d = Math.hypot(xx + .5, yy + .5) / r;
    const n = noise((x + xx) * .45, (y + yy) * .45, seed);
    if (d > .78 + n * .38) continue;
    const l = -((xx + .5) * .62 + (yy + .5) * .78) / r + (1 - d) * .35;
    let i = l > .55 ? 3 : l > .12 ? 2 : l > -.35 ? 1 : 0;
    if (hash(x + xx, y + yy, seed) < .14) i = Math.max(0, i - 1);
    c.put(x + xx, y + yy, tones[Math.min(i, tones.length - 1)]);
  }
}
// Top-down conifer: eight-point star with snow on the lit side and a long low-sun shadow.
function conifer(c, x, y, r, snowy, seed) {
  for (let s = 1; s <= r * 1.6; s++) c.ellipse(x + s * .55, y + s * .45, r * .55, r * .5, [40, 60, 80, 22], true);
  const rot = hash(x, y, seed) * 3;
  const R = Math.ceil(r + 1);
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const a = Math.atan2(yy + .5, xx + .5), d = Math.hypot(xx + .5, yy + .5);
    const reach = r * (.55 + .45 * Math.pow(Math.abs(Math.cos(a * 4 + rot)), .8));
    if (d > reach) continue;
    const l = -((xx + .5) * .6 + (yy + .5) * .8) / r;
    let col = l > .25 ? GR[3] : l > -.2 ? GR[2] : GR[1];
    if (d < 1.2) col = GR[0];
    if (snowy && l > -.1 && hash(x + xx, y + yy, seed + 5) < .55 + l * .4) col = l > .35 ? SW[3] : SW[2];
    c.put(x + xx, y + yy, col);
  }
}
function palm(c, x, y, r, seed) {
  c.line(x + 2, y + 2, x + r + 3, y + r + 4, shade(80), true);
  for (let f = 0; f < 7; f++) {
    const a = f / 7 * TAU + hash(f, x, seed) * .5;
    for (let s = 1; s <= r; s++) {
      const bend = Math.sin(s / r * 1.6) * 1.2;
      const px = x + Math.cos(a) * s - Math.sin(a) * bend, py = y + Math.sin(a) * s + Math.cos(a) * bend;
      c.paint(px + 3, py + 3, shade(60));
      c.put(px, py, s < r * .4 ? OL[2] : (f + s) % 3 ? OL[3] : OL[4]);
      if (s > 2 && s < r - 1 && dither(Math.floor(px), Math.floor(py), .5)) c.put(px + Math.sin(a), py - Math.cos(a), GR[3]);
    }
  }
  c.put(x, y, WD[2]); c.put(x + 1, y, WD[1]);
}
// Gabled roof seen from above: lit northern slope, shaded southern slope, darker eaves.
function hut(c, x, y, w, h, tones, eave) {
  c.rect(x + 3, y + 3, w, h, shade(120), true);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    let col = yy < h / 2 ? tones[2] : tones[1];
    if (yy === Math.floor(h / 2) || yy === Math.floor(h / 2) - 1) col = tones[3];
    if ((xx + yy * 3) % 4 === 0 && hash(x + xx, y + yy, 3) < .5) col = shift(col, -1);
    if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) col = eave;
    c.put(x + xx, y + yy, col);
  }
}
function crater(c, x, y, r, soil, rim) {
  c.ellipse(x, y, r + 2, r + 1.6, withAlpha(rim, 200), true);
  c.ellipse(x, y, r, r * .9, soil[1]);
  c.ellipse(x + .6, y + .7, r * .7, r * .6, soil[0]);
  c.ellipse(x - r * .3, y - r * .35, r * .35, r * .3, soil[2]);
  for (let k = 0; k < 10; k++) { const a = hash(k, x, 7) * TAU, d = r + 2 + hash(k, y, 8) * 4; c.put(x + Math.cos(a) * d, y + Math.sin(a) * d, soil[0]); }
}

// ---------------- Separable blur (premultiplied, three box passes ~ Gaussian) ----------------
function blur(src, radius, wrapY, grade = { mul: .86, desat: .15 }) {
  const w = src.w, h = src.h, n = w * h;
  let ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { const p = src.px[i]; if (!p) continue; const a = p[3] / 255; ch[0][i] = p[0] * a; ch[1][i] = p[1] * a; ch[2][i] = p[2] * a; ch[3][i] = a; }
  const pass = (data, horizontal) => {
    const out = new Float32Array(n), len = horizontal ? w : h, lines = horizontal ? h : w, k = 2 * radius + 1;
    for (let l = 0; l < lines; l++) for (let i = 0; i < len; i++) {
      let s = 0;
      for (let o = -radius; o <= radius; o++) {
        let j = i + o;
        if (horizontal) { if (j < 0 || j >= len) continue; s += data[l * w + j]; }
        else { if (wrapY) j = ((j % len) + len) % len; else if (j < 0 || j >= len) continue; s += data[j * w + l]; }
      }
      out[horizontal ? l * w + i : i * w + l] = s / k;
    }
    return out;
  };
  for (let p = 0; p < 3; p++) ch = ch.map(d => pass(pass(d, true), false));
  const out = new Canvas(w, h);
  for (let i = 0; i < n; i++) {
    const a = ch[3][i]; if (a < .004) continue;
    let r = ch[0][i] / a, g = ch[1][i] / a, b = ch[2][i] / a;
    const l = r * .3 + g * .59 + b * .11;
    r = (r + (l - r) * grade.desat) * grade.mul; g = (g + (l - g) * grade.desat) * grade.mul; b = (b + (l - b) * grade.desat) * grade.mul;
    out.px[i] = [Math.round(clamp(r, 0, 255)), Math.round(clamp(g, 0, 255)), Math.round(clamp(b, 0, 255)), Math.round(a * 255)];
  }
  return out;
}

module.exports = {
  TW, TH, TAU, P, jungleRiverX, iceRiverX, Wrap, shade, clamp, crown, conifer, palm, hut, crater,
  blur
};

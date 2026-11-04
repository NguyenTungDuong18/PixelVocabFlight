'use strict';
// Shared pixel-art primitives for PixelForge. Every sprite is drawn on a real
// pixel grid: no scaling, anti-aliasing or smooth gradients reach the output.
const path = require('path');
const sharp = require(path.join(__dirname, '../ArtImport/node_modules/sharp'));

const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const key = c => c[0] + ',' + c[1] + ',' + c[2];
const rampIndex = new Map();
function ramp(...colours) {
  const r = colours.map(c => hex(c));
  r.forEach((c, i) => rampIndex.set(key(c), { r, i }));
  return r;
}
// Moves a colour along the ramp it was registered in; unknown colours stay unchanged.
function shift(c, n) {
  if (!c) return c;
  const e = rampIndex.get(key(c));
  if (!e) return c;
  const out = e.r[Math.max(0, Math.min(e.r.length - 1, e.i + n))];
  return c[3] === 255 ? out : [out[0], out[1], out[2], c[3]];
}
const withAlpha = (c, a) => [c[0], c[1], c[2], a];

// 1940s field palette: olive drab, khaki, gun metal, navy grey, weathered red.
const K = hex('#14170f');
const PAL = {
  K,
  OL: ramp('#232c18', '#36421f', '#4e5e2c', '#6b7d3b', '#91a258', '#b9c67e'),
  CR: ramp('#7f785a', '#b3aa86', '#ddd4b0', '#f3edd6'),
  GD: ramp('#6b4c17', '#a07a2a', '#d2a845', '#f0d47c'),
  ST: ramp('#262c30', '#3d464b', '#5d686d', '#8a959a', '#bcc6c8'),
  GL: ramp('#17303d', '#285a72', '#4f93b0', '#a9e0ee'),
  RD: ramp('#3e130e', '#6a2117', '#963826', '#c25a3d', '#e58a63'),
  WD: ramp('#3d2a17', '#5d4224', '#7e5d33', '#a17c48', '#c7a26a'),
  NV: ramp('#18212a', '#28353f', '#3c4c58', '#566a77', '#7c919c', '#a9bcc4'),
  FI: ramp('#4c170b', '#a3351a', '#e27a24', '#fbc64a', '#fff3c4'),
  SM: ramp('#242423', '#3b3b39', '#5c5c58', '#85857e', '#b1b1a9', '#d8d8d0'),
  GR: ramp('#1b2914', '#27391c', '#344a23', '#46602c', '#5c7a36', '#7a9a48'),
  SN: ramp('#5e472b', '#86683f', '#a98a57', '#c8ab72', '#e3cf9c'),
  SW: ramp('#7f8d93', '#a9b6b8', '#cfd8d6', '#eef3f0'),
  IC: ramp('#2c5568', '#5795b0', '#9fd5e8', '#e2f6fb'),
  WT: ramp('#132c3b', '#1b3d50', '#255268', '#326a84', '#4c8aa4', '#8cc3d6'),
  GN: hex('#5fbf6a'),
  WHITE: hex('#ffffff')
};

// Enemy squadron liveries, one per battlefield, chosen for contrast with that terrain.
const LIVERY = {
  jungle: { main: ramp('#2e110c', '#4f1d15', '#73301f', '#94462f', '#b8664a'), camo: ramp('#21180f', '#33261a', '#463626'), mark: [hex('#e9dfc0'), hex('#2a2a2a')] },
  desert: { main: ramp('#24221d', '#37342c', '#4f4a3e', '#6a6453', '#8a836e'), camo: ramp('#4d3d22', '#6d5631', '#8c7041'), mark: [hex('#e9dfc0'), hex('#7a2a1f')] },
  ice: { main: ramp('#23272a', '#363c40', '#4f565b', '#6c747a', '#8f979c'), camo: ramp('#b7bcb8', '#d3d7d1', '#edefea'), mark: [hex('#1e1e1e'), hex('#b3402d')] },
  ocean: { main: ramp('#1a1b1d', '#2a2b2e', '#3f4044', '#58595e', '#7a7b80'), camo: ramp('#5a2119', '#7b3022', '#9b432f'), mark: [hex('#e9dfc0'), hex('#9b432f')] }
};

// Deterministic noise so every regeneration produces byte-identical art.
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => noise(x, y, s) * .6 + noise(x * 2, y * 2, s + 7) * .28 + noise(x * 4, y * 4, s + 13) * .12;
// Periodic fbm for textures that must tile (clouds).
function tileFbm(x, y, w, h, s, scale) {
  const a = x / w * Math.PI * 2, b = y / h * Math.PI * 2, r = scale;
  return fbm(Math.cos(a) * r + 50, Math.sin(a) * r + Math.cos(b) * r + 50, s) * .5 + fbm(Math.sin(b) * r + 90, Math.cos(a) * r * .5 + 20, s + 3) * .5;
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dither = (x, y, t) => (BAYER[y & 3][x & 3] + .5) / 16 < t;

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.px[y * this.w + x] : null; }
  solid(x, y) { const c = this.get(x, y); return !!c && c[3] > 0; }
  put(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (c === undefined || !this.inside(x, y)) return; this.px[y * this.w + x] = c; }
  // Alpha-composites c over the existing pixel.
  paint(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (!c || !this.inside(x, y)) return;
    const o = this.px[y * this.w + x];
    if (!o || c[3] >= 255) { this.px[y * this.w + x] = c; return; }
    const a = c[3] / 255, oa = o[3] / 255, outA = a + oa * (1 - a);
    const mix = i => Math.round((c[i] * a + o[i] * oa * (1 - a)) / outA);
    this.px[y * this.w + x] = [mix(0), mix(1), mix(2), Math.round(outA * 255)];
  }
  fill(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = fn(x, y, this.get(x, y)); if (c !== undefined) this.px[y * this.w + x] = c; } return this; }
  rect(x, y, w, h, c, paint = false) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) paint ? this.paint(xx, yy, c) : this.put(xx, yy, c); return this; }
  ellipse(cx, cy, rx, ry, c, paint = false) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) paint ? this.paint(x, y, c) : this.put(x, y, c);
    }
    return this;
  }
  line(x0, y0, x1, y1, c, paint = false) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paint ? this.paint(x0, y0, c) : this.put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  clone() { const c = new Canvas(this.w, this.h); c.px = this.px.slice(); return c; }
  blit(src, dx, dy, paint = true) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) paint ? this.paint(dx + x, dy + y, c) : this.put(dx + x, dy + y, c); } return this; }
  // Adds a one-pixel outline around opaque pixels (4-neighbour, crisp pixel-art edge).
  outline(colour = K, diagonal = false) {
    const snap = this.px.slice(), w = this.w, h = this.h;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && snap[y * w + x] && snap[y * w + x][3] > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      let n = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
      if (!n && diagonal) n = solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1);
      if (n) this.px[y * w + x] = colour;
    }
    return this;
  }
  // Top-down lighting from the north-west: lit upper edges, shaded lower edges.
  bevel(up = 1, down = -1, sideLeft = 0, sideRight = 0) {
    const snap = this.px.slice(), w = this.w, h = this.h;
    const open = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return true; const c = snap[y * w + x]; return !c || c[3] === 0 || key(c) === key(K); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = snap[y * w + x];
      if (!c || key(c) === key(K)) continue;
      let n = 0;
      if (open(x, y - 1)) n = up; else if (open(x, y + 1)) n = down; else if (open(x - 1, y)) n = sideLeft; else if (open(x + 1, y)) n = sideRight;
      if (n) this.px[y * w + x] = shift(c, n);
    }
    return this;
  }
  silhouette(c) { const out = new Canvas(this.w, this.h); for (let i = 0; i < this.px.length; i++) if (this.px[i] && this.px[i][3] > 0) out.px[i] = c; return out; }
  recolour(map) { return this.fill((x, y, c) => { if (!c) return undefined; const m = map(c); return m === undefined ? undefined : m; }); }
  scaled(k) { const out = new Canvas(this.w * k, this.h * k); for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.px[y * out.w + x] = this.px[Math.floor(y / k) * this.w + Math.floor(x / k)]; return out; }
  raw() {
    const b = Buffer.alloc(this.w * this.h * 4);
    this.px.forEach((c, i) => { if (c) { b[i * 4] = c[0]; b[i * 4 + 1] = c[1]; b[i * 4 + 2] = c[2]; b[i * 4 + 3] = c[3]; } });
    return b;
  }
  png(file) { return sharp(this.raw(), { raw: { width: this.w, height: this.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file); }
}

// Mirrors the left half onto the right half for symmetric aircraft.
function mirrorX(c) { for (let y = 0; y < c.h; y++) for (let x = 0; x < Math.floor(c.w / 2); x++) c.put(c.w - 1 - x, y, c.get(x, y)); return c; }

// Tiny bitmap fonts drawn by hand for logos and stencils.
const FONT5 = {
  'R': ['111', '101', '110', '101', '101'], '+': ['000', '010', '111', '010', '000'], '1': ['010', '110', '010', '010', '111'],
  '9': ['111', '101', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '0': ['111', '101', '101', '101', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  'F': ['111', '100', '110', '100', '100'], 'E': ['111', '100', '110', '100', '111'], 'X': ['101', '101', '010', '101', '101']
};
function text5(c, s, x, y, colour) { for (const ch of s) { const g = FONT5[ch]; if (g) g.forEach((row, yy) => [...row].forEach((b, xx) => { if (b === '1') c.put(x + xx, y + yy, colour); })); x += 4; } }

module.exports = { hex, ramp, shift, withAlpha, PAL, LIVERY, K, hash, noise, fbm, tileFbm, dither, Canvas, mirrorX, FONT5, text5, sharp };

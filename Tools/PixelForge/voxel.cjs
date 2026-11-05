'use strict';
// Voxel model kit for the WORDWING 0.15 walkable base.
// A model is a 3D voxel grid (1 voxel = 1 image pixel, 16 voxels = 1 tile) built from
// primitives in model-local space: x east, y south (front of the model faces +y), z up.
// It is rendered in an oblique 3/4 projection (screenX = x, screenY = y - z): every
// voxel shows its top face on one pixel and its south face on the pixel below it.
// Turning the grid 90 degrees around z gives the four facings S/E/N/W, so the back,
// the sides and every asymmetric detail are real geometry, never a mirrored image.
// Lighting comes from the upper left (north-west, above); faces get a normal estimated
// from the surrounding voxels, self shadows are ray traced, and the model drops a soft
// shadow to the lower right on the ground.
const { PAL, K, shift, withAlpha, Canvas } = require('./lib.cjs');

const FACE_CODE = { u: 0, s: 1, e: 2, n: 3, w: 4, d: 5 };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + .5) / 16;

// Material: fn(x, y, z, face) -> colour (a colour registered in a lib ramp so it can be
// shaded with shift()). flat materials (glass, lamps) ignore lighting.
function mat(fn, opts = {}) { return { fn: typeof fn === 'function' ? fn : () => fn, flat: !!opts.flat, noShadow: !!opts.noShadow }; }

// 3x5 pixel font for stencils and signs (upper case, digits, a few marks).
const FONT3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101010010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '.': '000000000000010', '-': '000000111000000', '+': '000010111010000', '!': '010010010000010',
  '/': '001001010100100', ' ': '000000000000000', '>': '100010001010100', '<': '001010100010001'
};
const textWidth = s => s.length * 4 - 1;

class Model {
  // fw x fh tiles (facing S), height in voxels, margin = room for overhangs outside the footprint.
  constructor(fw, fh, height, margin = 6) {
    this.fw = fw; this.fh = fh; this.FW = fw * 16; this.FD = fh * 16; this.m = margin;
    this.W = this.FW + 2 * margin; this.D = this.FD + 2 * margin; this.H = height;
    this.vox = new Uint16Array(this.W * this.D * this.H);
    this.mats = [null]; this.matIds = new Map();
    this.decals = new Map();
    this.clipped = 0;
  }
  id(m) {
    if (!m) return 0;
    let k = this.matIds.get(m);
    if (k === undefined) { k = this.mats.length; if (k > 65535) throw new Error('Too many materials'); this.mats.push(m); this.matIds.set(m, k); }
    return k;
  }
  index(x, y, z) {
    x = Math.floor(x) + this.m; y = Math.floor(y) + this.m; z = Math.floor(z);
    if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.D || z >= this.H) return -1;
    return (z * this.D + y) * this.W + x;
  }
  set(x, y, z, m) { const i = this.index(x, y, z); if (i < 0) { if (m && z >= 0) this.clipped++; return; } this.vox[i] = this.id(m); }
  get(x, y, z) { const i = this.index(x, y, z); return i < 0 ? 0 : this.vox[i]; }
  has(x, y, z) { return this.get(x, y, z) !== 0; }
  // Generic solid: fn(x, y, z) at voxel centres returns a material, true (use m) or falsy.
  shape(x0, y0, z0, x1, y1, z1, fn, m) {
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const r = fn(x + .5, y + .5, z + .5);
      if (r) this.set(x, y, z, r === true ? m : r);
    }
    return this;
  }
  box(x0, y0, z0, x1, y1, z1, m) {
    for (let z = Math.round(z0); z < Math.round(z1); z++) for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) this.set(x, y, z, m);
    return this;
  }
  erase(x0, y0, z0, x1, y1, z1) { return this.box(x0, y0, z0, x1, y1, z1, null); }
  // Recolours voxels that already exist.
  paint(x0, y0, z0, x1, y1, z1, m) {
    for (let z = Math.round(z0); z < Math.round(z1); z++) for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) if (this.has(x, y, z)) this.set(x, y, z, m);
    return this;
  }
  cylZ(cx, cy, r, z0, z1, m, ry = r) { return this.shape(cx - r, cy - ry, z0, cx + r, cy + ry, z1, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1, m); }
  cylX(cy, cz, r, x0, x1, m, rz = r) { return this.shape(x0, cy - r, cz - rz, x1, cy + r, cz + rz, (x, y, z) => ((y - cy) / r) ** 2 + ((z - cz) / rz) ** 2 <= 1, m); }
  cylY(cx, cz, r, y0, y1, m, rz = r) { return this.shape(cx - r, y0, cz - rz, cx + r, y1, cz + rz, (x, y, z) => ((x - cx) / r) ** 2 + ((z - cz) / rz) ** 2 <= 1, m); }
  ell(cx, cy, cz, rx, ry, rz, m) { return this.shape(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1, m); }
  // Cone / frustum around a vertical axis.
  cone(cx, cy, r0, r1, z0, z1, m) {
    const R = Math.max(r0, r1);
    return this.shape(cx - R, cy - R, z0, cx + R, cy + R, z1, (x, y, z) => { const t = (z - z0) / (z1 - z0), r = r0 + (r1 - r0) * t; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; }, m);
  }
  // Half-cylinder roofs (Quonset / arch hangar). Axis along x or y, base at z0.
  vaultX(x0, x1, cy, ry, z0, rz, m) { return this.shape(x0, cy - ry, z0, x1, cy + ry, z0 + rz, (x, y, z) => ((y - cy) / ry) ** 2 + ((z - z0) / rz) ** 2 <= 1, m); }
  vaultY(y0, y1, cx, rx, z0, rz, m) { return this.shape(cx - rx, y0, z0, cx + rx, y1, z0 + rz, (x, y, z) => ((x - cx) / rx) ** 2 + ((z - z0) / rz) ** 2 <= 1, m); }
  // Gable prism: ridge along x (eaves at y0/y1) or along y (eaves at x0/x1).
  gableX(x0, x1, y0, y1, z0, h, m) { const c = (y0 + y1) / 2, hw = (y1 - y0) / 2; return this.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => Math.abs(y - c) <= hw * (1 - (z - z0) / h), m); }
  gableY(y0, y1, x0, x1, z0, h, m) { const c = (x0 + x1) / 2, hw = (x1 - x0) / 2; return this.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => Math.abs(x - c) <= hw * (1 - (z - z0) / h), m); }
  // Hipped roof: the slopes shrink on all four sides.
  hip(x0, y0, x1, y1, z0, h, m) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
    return this.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const k = (z - z0) / h * hy; return Math.abs(y - cy) <= hy - k && Math.abs(x - cx) <= hx - k; }, m);
  }
  // Pyramid (tent / tower roof).
  pyramid(x0, y0, x1, y1, z0, h, m) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
    return this.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const t = 1 - (z - z0) / h; return Math.abs(x - cx) <= hx * t && Math.abs(y - cy) <= hy * t; }, m);
  }
  // Mono-pitch roof sloping down toward +y (front) from z0+h at y0 to z0 at y1.
  shed(x0, y0, x1, y1, z0, h, thick, m) {
    return this.shape(x0, y0, z0, x1, y1, z0 + h + thick, (x, y, z) => { const top = z0 + h * (1 - (y - y0) / (y1 - y0)) + thick; return z <= top && z >= top - thick - 1; }, m);
  }
  // Thick 3D line (poles, braces, barrels, cables).
  line(x0, y0, z0, x1, y1, z1, m, r = 0) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      if (r <= .5) this.set(x, y, z, m);
      else this.shape(x - r, y - r, z - r, x + r, y + r, z + r, (a, b, c) => (a - x) ** 2 + (b - y) ** 2 + (c - z) ** 2 <= r * r, m);
    }
    return this;
  }
  // Paints one face of one voxel (signs, stencils, insignia). Colour must be a ramp colour
  // to take shading; pass { c, flat: true } for unshaded paint.
  decal(face, x, y, z, c) { const i = this.index(x, y, z); if (i >= 0) this.decals.set(i * 8 + FACE_CODE[face], c); }
  // Lays a bitmap onto a face. rows: strings; chars map through pal (' ' / '.' skipped).
  // Reading direction follows the face as seen from outside: s +x, n -x, e -y, w +y,
  // rows run down (-z). Top faces ('u') read with +x right and +y down.
  bitmap(face, x, y, z, rows, pal) {
    rows.forEach((row, r) => [...row].forEach((ch, k) => {
      const c = pal[ch]; if (!c) return;
      if (face === 's') this.decal('s', x + k, y, z - r, c);
      else if (face === 'n') this.decal('n', x - k, y, z - r, c);
      else if (face === 'e') this.decal('e', x, y - k, z - r, c);
      else if (face === 'w') this.decal('w', x, y + k, z - r, c);
      else if (face === 'u') this.decal('u', x + k, y + r, z, c);
    }));
    return this;
  }
  text(face, x, y, z, str, c, scale = 1) { return this.bitmap(face, x, y, z, textRows(str, scale), { '#': c }); }
  // Stencil on a curved surface (tank, fuselage): each pixel lands on the outermost voxel
  // of its column along the face normal. a = start along the reading direction.
  surfText(face, a, z, str, c, scale = 1) {
    const rows = textRows(str, scale), lo = -this.m, hiX = this.FW + this.m, hiY = this.FD + this.m;
    rows.forEach((row, r) => [...row].forEach((ch, k) => {
      if (ch !== '#') return;
      const zz = z - r;
      if (face === 's') { const x = a + k; for (let y = hiY - 1; y >= lo; y--) if (this.has(x, y, zz)) { this.decal('s', x, y, zz, c); break; } }
      else if (face === 'n') { const x = a - k; for (let y = lo; y < hiY; y++) if (this.has(x, y, zz)) { this.decal('n', x, y, zz, c); break; } }
      else if (face === 'e') { const y = a - k; for (let x = hiX - 1; x >= lo; x--) if (this.has(x, y, zz)) { this.decal('e', x, y, zz, c); break; } }
      else if (face === 'w') { const y = a + k; for (let x = lo; x < hiX; x++) if (this.has(x, y, zz)) { this.decal('w', x, y, zz, c); break; } }
    }));
    return this;
  }
  // Same as surfText for an arbitrary bitmap (insignia on curved hulls).
  surfBitmap(face, a, z, rows, pal) {
    const lo = -this.m, hiX = this.FW + this.m, hiY = this.FD + this.m;
    rows.forEach((row, r) => [...row].forEach((ch, k) => {
      const c = pal[ch]; if (!c) return;
      const zz = z - r;
      if (face === 's') { const x = a + k; for (let y = hiY - 1; y >= lo; y--) if (this.has(x, y, zz)) { this.decal('s', x, y, zz, c); break; } }
      else if (face === 'n') { const x = a - k; for (let y = lo; y < hiY; y++) if (this.has(x, y, zz)) { this.decal('n', x, y, zz, c); break; } }
      else if (face === 'e') { const y = a - k; for (let x = hiX - 1; x >= lo; x--) if (this.has(x, y, zz)) { this.decal('e', x, y, zz, c); break; } }
      else if (face === 'w') { const y = a + k; for (let x = lo; x < hiX; x++) if (this.has(x, y, zz)) { this.decal('w', x, y, zz, c); break; } }
    }));
    return this;
  }
  // Cylinder between two arbitrary points (tilted barrels, lamp drums, struts).
  cyl(x0, y0, z0, x1, y1, z1, r, m) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L2 = dx * dx + dy * dy + dz * dz;
    return this.shape(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.min(z0, z1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, Math.max(z0, z1) + r, (x, y, z) => {
      const t = ((x - x0) * dx + (y - y0) * dy + (z - z0) * dz) / L2;
      if (t < 0 || t > 1) return false;
      return (x - x0 - dx * t) ** 2 + (y - y0 - dy * t) ** 2 + (z - z0 - dz * t) ** 2 <= r * r;
    }, m);
  }
  // Highest voxel of a column (or -1).
  top(x, y) { for (let z = this.H - 1; z >= 0; z--) if (this.has(x, y, z)) return z; return -1; }
  // Recolours the top voxel of every column in a rectangle: fn(x, y, z) -> material or falsy.
  topPaint(x0, y0, x1, y1, fn) {
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) { const z = this.top(x, y); if (z < 0) continue; const m = fn(x + .5, y + .5, z); if (m) this.set(x, y, z, m); }
    return this;
  }
}
function textRows(str, scale = 1) {
  let rows = ['', '', '', '', ''];
  for (const ch of str) { const g = FONT3[ch] || FONT3[' ']; for (let r = 0; r < 5; r++) rows[r] += g.slice(r * 3, r * 3 + 3).replace(/0/g, ' ').replace(/1/g, '#') + ' '; }
  rows = rows.map(r => r.slice(0, -1));
  if (scale > 1) rows = rows.flatMap(r => Array(scale).fill([...r].map(ch => ch.repeat(scale)).join('')));
  return rows;
}

// ---------------- Renderer ----------------
const LIGHT = (() => { const v = [-.5, -.5, 1], l = Math.hypot(...v); return v.map(a => a / l); })();
const SHADOW = withAlpha(K, 92), SHADOW_SOFT = withAlpha(K, 56);
const TOP_DOT = LIGHT[2], SOUTH_DOT = LIGHT[1], FACE_W = .6;

function rotation(model, facing) {
  const { W, D } = model;
  switch (facing) {
    case 's': return { VW: W, VD: D, toLocal: (vx, vy) => [vx, vy], south: 's' };
    case 'e': return { VW: D, VD: W, toLocal: (vx, vy) => [W - 1 - vy, vx], south: 'w' };
    case 'n': return { VW: W, VD: D, toLocal: (vx, vy) => [W - 1 - vx, D - 1 - vy], south: 'n' };
    case 'w': return { VW: D, VD: W, toLocal: (vx, vy) => [vy, D - 1 - vx], south: 'e' };
  }
  throw new Error('Bad facing ' + facing);
}

// Renders one facing into an uncropped canvas. Returns canvas, anchor and a projector
// (model-local x, y, z -> screen) for 2D overlays such as smoke.
function renderView(model, facing) {
  const { W, D, H, m } = model;
  const { VW, VD, toLocal, south } = rotation(model, facing);
  const rv = new Uint16Array(VW * VD * H), lidx = new Int32Array(VW * VD);
  for (let vy = 0; vy < VD; vy++) for (let vx = 0; vx < VW; vx++) { const [lx, ly] = toLocal(vx, vy); lidx[vy * VW + vx] = ly * W + lx; }
  let topZ = 0;
  for (let vz = 0; vz < H; vz++) for (let i = 0; i < VW * VD; i++) { const v = model.vox[vz * W * D + lidx[i]]; rv[vz * VW * VD + i] = v; if (v) topZ = vz + 1; }
  const occ = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < VW && y < VD && z < H && rv[(z * VD + y) * VW + x] !== 0;

  const padL = 2, padT = 2, sh = Math.ceil(topZ * .5) + 3;
  const CW = VW + padL + sh, CH = padT + H + VD + sh;
  const SY = (vy, vz) => vy - vz + H + padT;
  const depth = new Float32Array(CW * CH).fill(-1e9);
  const rec = new Int32Array(CW * CH).fill(-1); // voxel index * 2 + face(0 top, 1 south)
  for (let vz = 0; vz < topZ; vz++) for (let vy = 0; vy < VD; vy++) for (let vx = 0; vx < VW; vx++) {
    const vi = (vz * VD + vy) * VW + vx;
    if (!rv[vi]) continue;
    const d = vy + vz;
    if (!occ(vx, vy, vz + 1)) { const p = (SY(vy, vz) - 1) * CW + vx + padL; if (d > depth[p]) { depth[p] = d; rec[p] = vi * 2; } }
    if (!occ(vx, vy + 1, vz)) { const p = SY(vy, vz) * CW + vx + padL; if (d + .25 > depth[p]) { depth[p] = d + .25; rec[p] = vi * 2 + 1; } }
  }
  // Ray towards the light; true if any voxel blocks it.
  const blocked = (x, y, z) => {
    const st = .5 / LIGHT[2];
    const dx = LIGHT[0] * st, dy = LIGHT[1] * st, dz = .5;
    x += dx * 2; y += dy * 2; z += dz * 2;
    for (; z < topZ; x += dx, y += dy, z += dz) {
      if (x < 0 || y < 0) return false;
      if (occ(Math.floor(x), Math.floor(y), Math.floor(z))) return true;
    }
    return false;
  };
  const out = new Canvas(CW, CH);
  const R = 2;
  for (let p = 0; p < CW * CH; p++) {
    const r = rec[p];
    if (r < 0) continue;
    const vi = r >> 1, face = r & 1;
    const vx = vi % VW, vy = Math.floor(vi / VW) % VD, vz = Math.floor(vi / (VW * VD));
    const li = vz * W * D + lidx[vy * VW + vx];
    const lx = li % W, ly = Math.floor(li / W) % D;
    const lf = face ? south : 'u';
    const mt = model.mats[rv[vi]];
    const dec = model.decals.get(li * 8 + FACE_CODE[lf]);
    let col, flat = mt.flat;
    if (dec) { if (dec.c) { col = dec.c; flat = flat || !!dec.flat; } else col = dec; }
    else col = mt.fn(lx - m, ly - m, vz, lf);
    if (!col) continue;
    const sx = p % CW, sy = Math.floor(p / CW);
    if (!flat) {
      // Normal: face normal blended with the occupancy gradient around the voxel.
      let nx = 0, ny = 0, nz = 0;
      for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (!dx && !dy && !dz) continue;
        if (occ(vx + dx, vy + dy, vz + dz)) { const w = 1 / (dx * dx + dy * dy + dz * dz); nx -= dx * w; ny -= dy * w; nz -= dz * w; }
      }
      let l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const fx = 0, fy = face ? 1 : 0, fz = face ? 0 : 1;
      nx = fx * FACE_W + nx; ny = fy * FACE_W + ny; nz = fz * FACE_W + nz;
      l = Math.hypot(nx, ny, nz) || 1;
      const dot = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l;
      let delta;
      if (dot > TOP_DOT) delta = (dot - TOP_DOT) * 3.2;
      else { const t = (TOP_DOT - dot) / (TOP_DOT - SOUTH_DOT); delta = -Math.min(1, Math.sqrt(t) * 1.12); }
      if (!mt.noShadow) {
        const ox = vx + .5, oy = vy + (face ? 1.05 : .5), oz = vz + (face ? .5 : 1.05);
        if (blocked(ox, oy, oz)) delta = Math.min(delta, 0) - 1;
      }
      const k = Math.floor(delta + bayer(sx, sy));
      if (k) col = shift(col, k);
    }
    out.put(sx, sy, col);
  }
  // Creases: darken pixels that sit just behind a much nearer surface.
  const snap = out.px.slice();
  for (let sy = 0; sy < CH; sy++) for (let sx = 0; sx < CW; sx++) {
    const p = sy * CW + sx;
    if (!snap[p]) continue;
    const d = depth[p];
    let near = false;
    for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const x = sx + ox, y = sy + oy;
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const q = y * CW + x;
      if (snap[q] && depth[q] > d + 3.5) { near = true; break; }
    }
    if (near) out.px[p] = shift(snap[p], -1);
  }
  out.outline(K);
  // Ground shadow (soft edge) under everything.
  const sh0 = new Uint8Array(CW * CH);
  for (let gy = 0; gy < VD + sh; gy++) for (let gx = 0; gx < VW + sh; gx++) {
    if (occ(gx, gy, 0)) continue;
    if (blocked(gx + .5, gy + .5, -.5)) { const sx = gx + padL, sy = SY(gy, 0); if (sx < CW && sy < CH) sh0[sy * CW + sx] = 1; }
  }
  for (let sy = 0; sy < CH; sy++) for (let sx = 0; sx < CW; sx++) {
    const p = sy * CW + sx;
    if (!sh0[p] || out.px[p]) continue;
    const edge = !(sh0[p - 1] && sh0[p + 1] && sh0[p - CW] && sh0[p + CW]);
    out.px[p] = edge ? SHADOW_SOFT : SHADOW;
  }
  const footW = (facing === 's' || facing === 'n') ? model.fw : model.fh, footH = (facing === 's' || facing === 'n') ? model.fh : model.fw;
  const anchor = [m + padL, SY(m + footH * 16, 0)];
  // Projector for overlays, from model-local coordinates.
  const inv = { s: (x, y) => [x, y], e: (x, y) => [y, W - 1 - x], n: (x, y) => [W - 1 - x, D - 1 - y], w: (x, y) => [D - 1 - y, x] }[facing];
  const project = (x, y, z) => { const [vx, vy] = inv(x + m, y + m); return [vx + padL, SY(vy, z)]; };
  return { canvas: out, anchor, foot: [footW, footH], project };
}

// Renders a model spec for all four facings. spec: { foot:[fw,fh], height, margin,
// frames, build(model, ctx), overlay?(canvas, project, frame, ctx) }; build runs per
// frame when spec.animated, otherwise once.
function renderModel(spec) {
  const out = {};
  const frames = spec.frames || 1;
  for (const facing of ['s', 'e', 'n', 'w']) {
    const views = [];
    let model = null;
    for (let f = 0; f < frames; f++) {
      if (!model || spec.animated) {
        model = new Model(spec.foot[0], spec.foot[1], spec.height, spec.margin ?? 6);
        spec.build(model, { frame: f, facing, wind: windLocal(facing) });
        if (model.clipped && f === 0 && facing === 's') console.warn('[voxel] ' + spec.id + ': ' + model.clipped + ' voxels outside the grid');
      }
      const v = renderView(model, facing);
      if (spec.overlay) spec.overlay(v.canvas, v.project, f, { facing });
      views.push(v);
    }
    // Crop to the union of all frames plus the footprint rectangle.
    const a = views[0].anchor, ft = views[0].foot;
    // The anchor row itself is kept inside the sprite (anchorY < height).
    let x0 = a[0], y0 = a[1] - ft[1] * 16, x1 = a[0] + ft[0] * 16, y1 = a[1] + 1;
    for (const v of views) {
      const c = v.canvas;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.px[y * c.w + x]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1; }
    }
    const crops = views.map(v => { const c = new Canvas(x1 - x0, y1 - y0); c.blit(v.canvas, -x0, -y0, false); return c; });
    out[facing] = { frames: crops, anchor: [a[0] - x0, a[1] - y0], foot: ft };
  }
  return out;
}

// Wind blows toward screen right (east) in the world; returns that direction in model space
// so flags and windsocks agree on every facing.
function windLocal(facing) { return { s: [1, 0], e: [0, 1], n: [-1, 0], w: [0, -1] }[facing]; }

module.exports = { Model, mat, renderModel, renderView, FONT3, textRows, textWidth, LIGHT };

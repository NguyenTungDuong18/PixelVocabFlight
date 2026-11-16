'use strict';
// Act 0 opening (open.P1.01-P1.06): the handwritten line, the biscuit tin on a table in grey
// window light, the hand, the lid opened right back, the six things inside, and the rain running
// down the glass. The tin, its contents and the hand are 3D (scene3d + tin + hand) so the hand
// can really bend at its joints and the lid can really swing; every layer is a full 480x270 frame
// that only holds what differs from cut_open_tin_bg (new pixels opaque, extra shadow as alpha).
// Nothing may date the scene or the hand (no ring, no watch on the wrist, no age marks).
const { PAL } = require('../lib.cjs');
const { SW, SH, Canvas, hash, fbm, clamp } = require('./common.cjs');
const { layout, ink, shade } = require('./script.cjs');
const S3 = require('./scene3d.cjs');
const T = require('./tin.cjs');
const H = require('./hand.cjs');
const OH = require('./openingHands.cjs');
const BH = require('./blenderHands.cjs');
const { CR } = PAL;

// ---------------------------------------------------------------- scene -> pixels
function paint(objs, G = S3.render(objs, SW, SH, T.L)) {
  const cells = G.map((c, i) => ({ c, ...T.shadeCell(c, i % SW, Math.floor(i / SW), objs) }));
  // Ink line on every silhouette: a pixel whose neighbour is clearly further away.
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const p = cells[y * SW + x], o = p.c.o;
    if (!o) continue;
    let edge = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const q = cells[yy * SW + xx];
      if (!q.c.o || (q.c.o !== o && q.c.t > p.c.t + 1.5)) edge = 2;
      else if (q.c.o === o && q.c.t > p.c.t + 7) edge = Math.max(edge, 1);
    }
    if (edge === 2) p.col = T.ink(o);
    else if (edge === 1 && (o.id === 'hand' || o.id === 'lid')) p.col = o.id === 'hand' ? [119, 84, 70, 255] : T.OUTLINE;
  }
  return cells;
}
const toCanvas = cells => { const c = new Canvas(SW, SH); cells.forEach((p, i) => c.put(i % SW, Math.floor(i / SW), p.col)); return c; };
// A layer: what differs from the background. Same surface only darker -> translucent shadow.
function layer(cells, bg) {
  const c = new Canvas(SW, SH);
  cells.forEach((p, i) => {
    const b = bg[i], x = i % SW, y = Math.floor(i / SW);
    if (p.col === b.col || (p.col[0] === b.col[0] && p.col[1] === b.col[1] && p.col[2] === b.col[2])) return;
    if (p.key === b.key && p.c.o === b.c.o && p.L < b.L) {
      const a = clamp(1 - p.L / Math.max(.05, b.L));
      const q = Math.round(a * 5 + ((x + y) & 1 ? .2 : -.2)) / 5;                          // five shadow steps, two-pixel dither
      if (q > 0) c.put(x, y, [10, 8, 9, Math.round(Math.min(.8, q) * 235)]);
      return;
    }
    c.put(x, y, p.col);
  });
  return c;
}

// ---------------------------------------------------------------- the scene states
const closedObjs = () => [T.body, T.lidObj(0)];
const openObjs = deg => [T.body, T.lidObj(deg), ...(deg > 1 ? T.items : [])];
let BG = null;
const bgCells = () => BG || (BG = paint(closedObjs()));

// The hands are posed frame by frame in openingHands.cjs.

// ---------------------------------------------------------------- public layers
function tinBackground() { return toCanvas(bgCells()); }
// A scene: { deg: lid angle, hands: [pose...] } -> the full painted frame (cells).
// bf (BH.frame): the hands come from the Blender mesh; the tin, the sleeves and the shading stay here.
const ZTOP = 200, TSCALE = Math.hypot(S3.K, 1);       // ray length per unit of height (render's t)
function sceneCells({ deg, hands }, bf = null) {
  const objs = deg > 0 ? openObjs(deg) : closedObjs();
  const built = hands.map((p, k) => H.build(p, bf && bf.joints[k]));
  if (!bf) { for (const { hand, sleeve } of built) objs.push(hand, sleeve); return paint(objs); }
  for (const { sleeve } of built) objs.push(sleeve);
  const G = S3.render(objs, SW, SH, T.L), L = T.L, lift = .6;
  // Forearm skin past the cuff is inside the wool (the mesh forearm is thicker than the sleeve near the elbow).
  const inSleeve = h => { const s = built[h.id - 1].sleeve, a = s.start, b = s.end, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return ((h.x - a[0]) * d[0] + (h.y - a[1]) * d[1] + (h.z - a[2]) * d[2]) / l > 1; };
  for (let i = 0; i < G.length; i++) {
    const c = G[i], h = bf.cell(i);
    if (h && (ZTOP - h.z) * TSCALE < c.t && !inSleeve(h)) {
      // The mesh is nearer than the code scene here: a hand cell, shadowed by the tin and the hands.
      const n = h.n, ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
      const sx = h.x + n[0] * lift, sy = h.y + n[1] * lift, sz = h.z + n[2] * lift;
      G[i] = { o: built[h.id - 1].hand, x: h.x, y: h.y, z: h.z, t: (ZTOP - h.z) * TSCALE, n, ndl, sh: ndl > 0 ? S3.softShadow(objs, sx, sy, sz, L) * bf.lightVis(sx, sy, sz) : 0, ao: Math.min(S3.ambientOcc(objs, h.x, h.y, h.z, n), h.ao) };
    } else if (c.sh > 0) c.sh *= bf.lightVis(c.x + c.n[0] * lift, c.y + c.n[1] * lift, c.z + c.n[2] * lift);
  }
  return paint(objs, G);
}
function handFrames() { const bg = bgCells(); return OH.handScenes().map((s, i) => layer(sceneCells(s, BH.frame('hand', i)), bg)); }
function lidFrames() { const bg = bgCells(); return OH.lidScenes().map((s, i) => layer(sceneCells(s, BH.frame('lid', i)), bg)); }

// ---------------------------------------------------------------- fx_rain_shadow
// Shadows of rain on the window, thrown through the light patch onto the table and bent over the
// closed tin (each pixel looks up where its window ray meets the table). Three layers with their
// own tempo: fat drops crawling down, thin fast runs, beads that stay and shimmer. 24 @8, seamless.
const RAIN_N = 24;
function rainFrames() {
  const drops = [], runs = [], beads = [];
  for (let k = 0; k < 7; k++) drops.push({ u: .08 + k * .135 + (hash(k, 1, 61) - .5) * .07, ph: hash(k, 2, 61), wob: 2 + hash(k, 3, 61) * 3, w: 2.3 + hash(k, 4, 61) * 1.4, len: .34 + hash(k, 5, 61) * .22 });
  for (let k = 0; k < 18; k++) runs.push({ u: hash(k, 1, 62), ph: hash(k, 2, 62), len: .1 + hash(k, 3, 62) * .1, cyc: 2 + (k % 2) });
  for (let k = 0; k < 46; k++) beads.push({ u: hash(k, 1, 63), v: hash(k, 2, 63), ph: hash(k, 3, 63), r: 1 + hash(k, 4, 63) * 1.6, per: [1, 2, 3][k % 3] });
  const bg = bgCells();
  const frames = [];
  for (let f = 0; f < RAIN_N; f++) {
    const c = new Canvas(SW, SH), Tt = f / RAIN_N;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const cell = bg[y * SW + x].c;
      if (cell.sh < .3 || cell.ndl <= 0) continue;                                       // faces the window cannot see get no rain
      const [tx, ty] = T.onTable(cell.x, cell.y, cell.z), wl = T.winLight(tx, ty) * Math.min(1, cell.ndl / T.L[2]);
      if (wl < .35) continue;
      const [u, v] = T.winUV(tx, ty), pu = u * 372, pv = v * 286;
      let dark = 0, bright = 0;
      for (const d of drops) {
        const head = ((d.ph + Tt) % 1) * 1.6 - .2, dv = head - v;
        if (dv < -.03 || dv > d.len) continue;
        const du = pu - (d.u * 372 + Math.sin(v * 11 + d.ph * 20) * d.wob + Math.sin(v * 29 + d.ph * 9) * 1.2);
        const hd = Math.hypot(du, (head - v) * 286 * .8);
        if (hd < d.w + 1.6) { dark = Math.max(dark, 105); continue; }
        const w = d.w * (1 - dv / d.len * .55) * .7;
        if (Math.abs(du) < w) dark = Math.max(dark, 74 * (1 - dv / d.len * .7));
        else if (du > 0 && du < w + 1.5 && dv < d.len * .5) bright = Math.max(bright, 46);
      }
      for (const r of runs) {
        const head = ((r.ph + Tt * r.cyc) % 1) * 1.4 - .2, dv = head - v;
        if (dv < 0 || dv > r.len) continue;
        if (Math.abs(pu - (r.u * 372 + Math.sin(v * 17 + r.ph * 30) * 1.5)) < .8) dark = Math.max(dark, 50 * (1 - dv / r.len));
      }
      for (const b of beads) {
        const d = Math.hypot(pu - b.u * 372, pv - b.v * 286);
        if (d > b.r + 1) continue;
        const s = .5 + .5 * Math.sin((Tt * b.per + b.ph) * Math.PI * 2);
        if (d < b.r) dark = Math.max(dark, 34 + 30 * s); else if (pu < b.u * 372 && s > .6) bright = Math.max(bright, 30);
      }
      const sheet = Math.sin((fbm(pu * .035, pv * .02, 66) * 3 + v * 2 - Tt) * Math.PI * 2);
      if (!dark && sheet > .86) bright = Math.max(bright, 16);
      if (dark) c.put(x, y, [8, 10, 14, Math.round(dark * wl)]);
      else if (bright) c.put(x, y, [214, 226, 232, Math.round(bright * wl)]);
    }
    frames.push(c);
  }
  return frames;
}

// ---------------------------------------------------------------- cut_open_ink
// "Hồi ấy tôi tưởng bầu trời là của mình." written stroke by stroke in cream ink, centred.
// Frame 0 is blank; the pen moves at a steady hand speed, lifts between strokes, and goes back
// for the marks after each word. The newest ink is still wet (brighter) and dries to cream.
const INK_LINE = 'Hồi ấy tôi tưởng bầu trời là của mình.';
const INK_FRAMES = 40, INK_DONE = 35;
function inkFrames() {
  const L = layout(INK_LINE, { scale: 13, slant: .12, wobble: .35, seed: 4 });
  const ox = Math.round((SW - L.width) / 2), oy = 142;
  const { pixels, travel } = ink(L.strokes, ox, oy, 9);
  shade(pixels);
  const wet = [255, 253, 242, 255], dry = CR[3], thin = CR[2];
  return Array.from({ length: INK_FRAMES }, (_, f) => {
    const c = new Canvas(SW, SH), t = travel * Math.min(1, f / INK_DONE);
    for (const p of pixels) {
      if (p.t > t || f === 0) break;
      const fresh = f <= INK_DONE && t - p.t < 26;
      c.put(p.x, p.y, fresh ? wet : p.edge || hash(p.x, p.y, 7) < .06 ? thin : dry);
    }
    return c;
  });
}

module.exports = { tinBackground, handFrames, lidFrames, rainFrames, inkFrames, INK_LINE, sceneCells, paint, toCanvas, closedObjs, openObjs };

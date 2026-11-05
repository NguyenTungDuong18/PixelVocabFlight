'use strict';
// World models: shared ramps, materials, building helpers and the MODELS registry (def).
const { PAL, ramp, hash, fbm, withAlpha, dither } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, SM, GR, SN } = PAL;

// Extra material ramps (registered with lib so shading can walk along them).
const BR = ramp('#36170f', '#562619', '#763523', '#944933', '#b0654a');          // brick
const WH = ramp('#55605d', '#7f8986', '#a9b0a9', '#cfd2c8', '#ecece1');          // whitewash
const CN = ramp('#33322d', '#4c4a42', '#696658', '#888472', '#a8a38f', '#c8c3ad'); // concrete
const TN = ramp('#252b2e', '#3a4245', '#545e61', '#717c7e', '#929d9d', '#b8c1bf'); // galvanised tin
const CV = ramp('#2b2f1d', '#41462b', '#595f3c', '#737950', '#8f9468');          // canvas
const DT = ramp('#33271a', '#4d3b27', '#685037', '#836949', '#9e835e');          // earth
const TP = ramp('#18191a', '#262829', '#363a3a', '#4a4f4e', '#626866');          // tar paper
const RB = ramp('#0f1011', '#1b1d1e', '#2a2d2e', '#3d4142');                     // rubber
const PT = ramp('#3c4a2a', '#56663a', '#728450', '#91a36a');                     // pale green paint (trim)
const BL = ramp('#1a2a3c', '#28405a', '#3b5a7c', '#5a7fa3');                     // blue enamel signs

const cl = (R, i) => R[Math.max(0, Math.min(R.length - 1, i))];
const uv = (x, y, z, f) => f === 'u' || f === 'd' ? [x, y] : f === 's' || f === 'n' ? [x, z] : [y, z];
const ix = Math.floor;

// ---------------- Materials ----------------
const flat = c => mat(() => c);
const glow = c => mat(() => c, { flat: true });
function mottled(R, i, s = 1, amt = .62, sc = .16) {
  return mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); const n = fbm(u * sc + s, v * sc + (f === 'u' ? 40 : 0), s); return cl(R, i + (n > amt ? 1 : n < 1 - amt ? -1 : 0)); });
}
// Corrugated sheet metal. ribAxis for top faces: 'x' = ribs run along x (stripes vary with y).
function tin(R = TN, i = 3, ribAxis = 'y', seam = 24) {
  return mat((x, y, z, f) => {
    let [u, v] = uv(x, y, z, f);
    if (f === 'u' && ribAxis === 'x') [u, v] = [y, x];
    const rib = ((ix(u) % 3) + 3) % 3, n = fbm(u * .35, v * .06, 7);
    let k = rib === 0 ? 1 : 0;
    if ((((ix(u) % seam) + seam) % seam) === 0) k = -1;
    if (f !== 'u' && (((ix(v) % 18) + 18) % 18) === 0) k = -1;
    if (n < .3 && hash(ix(u), ix(v), 3) < .6) k -= 1;
    return cl(R, i + k);
  });
}
function planks(R = WD, i = 2, h = 3, axis = 'x') {
  return mat((x, y, z, f) => {
    let [u, v] = uv(x, y, z, f);
    if (f === 'u' && axis === 'y') [u, v] = [v, u];
    const b = ix(v / h), seam = (((ix(v) % h) + h) % h) === 0;
    const len = 14 + ix(hash(b, 3, 5) * 12), joint = (((ix(u) + b * 7) % len) + len) % len === 0;
    let k = hash(b, ix((u + b * 7) / len), 9) < .3 ? -1 : 0;
    if (seam || joint) k = -1;
    if (!seam && hash(ix(u), b, 4) < .05) k = 1;
    return cl(R, i + k);
  });
}
function brick(R = BR, i = 2, mortar = CN[3]) {
  return mat((x, y, z, f) => {
    const [u, v] = uv(x, y, z, f);
    if (f === 'u') return cl(R, i);
    const row = ix(v / 3);
    if ((((ix(v) % 3) + 3) % 3) === 2) return mortar;
    if ((((ix(u) + (row & 1) * 3) % 6) + 6) % 6 === 0) return mortar;
    return cl(R, i + (hash(ix((u + (row & 1) * 3) / 6), row, 2) < .25 ? -1 : hash(ix((u + (row & 1) * 3) / 6), row, 3) < .15 ? 1 : 0));
  });
}
function sandbag(R = SN, i = 2) {
  return mat((x, y, z, f) => {
    let [u, v] = uv(x, y, z, f);
    if (f === 'u') { const row = ix(y / 5), bu = (((ix(x) + (row & 1) * 4) % 8) + 8) % 8, bv = (((ix(y) % 5) + 5) % 5); return cl(R, i + (bu === 0 || bv === 0 ? -1 : bv === 1 ? 1 : 0)); }
    const row = ix(v / 4), zz = (((ix(v) % 4) + 4) % 4), bu = (((ix(u) + (row & 1) * 4) % 8) + 8) % 8;
    if (bu === 0) return cl(R, i - 2);
    const tone = hash(ix((u + (row & 1) * 4) / 8), row, 6) < .3 ? -1 : 0;
    if (zz === 0) return cl(R, i - 2);
    return cl(R, i + tone + (zz === 3 ? 1 : 0) + (bu === 1 || bu === 7 ? -1 : 0));
  });
}
function canvasMat(R = CV, i = 2, seam = 10) {
  return mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); const n = fbm(u * .2, v * .2, 21); return cl(R, i + ((((ix(u) % seam) + seam) % seam) === 0 ? -1 : n > .64 ? 1 : n < .36 ? -1 : 0)); });
}
function concrete(R = CN, i = 3, joint = 16) {
  return mat((x, y, z, f) => {
    const [u, v] = uv(x, y, z, f);
    const n = fbm(u * .25, v * .25, 31);
    let k = n > .66 ? 1 : n < .33 ? -1 : 0;
    if ((((ix(u) % joint) + joint) % joint) === 0) k = -1;
    if (f !== 'u' && (((ix(v) % 10) + 10) % 10) === 0 && n < .5) k = -1;
    return cl(R, i + k);
  });
}
function rooftile(R = RD, i = 2, axis = 'x') {
  return mat((x, y, z, f) => {
    let [u, v] = uv(x, y, z, f);
    if (f !== 'u') return cl(R, i - 1);
    if (axis === 'y') [u, v] = [y, x];
    const row = ix(v / 3), vv = (((ix(v) % 3) + 3) % 3);
    let k = vv === 2 ? -1 : vv === 0 ? 1 : 0;
    if ((((ix(u) + (row & 1) * 2) % 4) + 4) % 4 === 0) k = Math.min(k, 0) - (vv === 1 ? 1 : 0);
    if (hash(ix(u / 4), row, 8) < .12) k -= 1;
    return cl(R, i + k);
  });
}
function grass(i = 3) { return mat((x, y, z, f) => { const n = fbm(x * .22 + z * .1, y * .22 + z * .1, 41), h = hash(ix(x), ix(y) + ix(z) * 31, 5); return cl(GR, i + (n > .6 ? 1 : n < .38 ? -1 : 0) + (h < .08 ? 1 : h > .94 ? -1 : 0)); }); }
function earth(i = 2) { return mat((x, y, z, f) => { const n = fbm(x * .3, y * .3 + z * .3, 51); return cl(DT, i + (n > .62 ? 1 : n < .38 ? -1 : 0)); }); }
const glass = mat((x, y, z, f) => {
  const [u, v] = uv(x, y, z, f);
  const d = (((ix(u) - ix(v) * (f === 'u' ? -1 : 1)) % 11) + 11) % 11;
  if (d === 0 || d === 1) return GL[3];
  if (d === 3) return GL[2];
  return f === 'u' ? GL[2] : GL[1];
}, { flat: true });
const darkGlass = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return (((ix(u) + ix(v)) % 9) + 9) % 9 === 0 ? GL[2] : GL[0]; }, { flat: true });
const interior = mat((x, y, z, f) => (f === 'u' ? ST[1] : (ix(z) % 7 === 0 ? ST[1] : ST[0])), { flat: true });
const olive = (s = 3, i = 2) => mottled(OL, i, s, .7, .12);
const steel = mottled(ST, 2, 9, .7, .2);
const darkSteel = flat(ST[1]);
const rubber = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return cl(RB, 2 + ((ix(u) + ix(v)) % 3 === 0 ? -1 : 0)); });
const wood = planks(WD, 2);
const woodDark = flat(WD[1]);
const woodPost = mat((x, y, z, f) => cl(WD, 2 + (hash(ix(x), ix(y), 3) < .3 ? -1 : 0) + (f === 'u' ? 0 : ((ix(z) % 9) === 0 ? -1 : 0))));
const trimWhite = flat(WH[3]);
const trimGreen = flat(PT[1]);
const rope = flat(CR[1]);
const redPaint = flat(RD[2]);
const yellowPaint = flat(GD[2]);
const lampGlow = glow(GD[3]);
const blackPaint = flat(TP[1]);
const cream = flat(CR[2]);

// ---------------- Building helpers ----------------
// Window on a wall face. face: 's'|'n'|'e'|'w'; for s/n: a = x start, p = outer wall plane (y);
// for e/w: a = y start, p = outer wall plane (x). Recessed glass, frame, sill and lintel.
function windowOn(g, face, a, p, z, w, h, opts = {}) {
  const frame = opts.frame || trimWhite, gl = opts.glass || glass, bars = opts.bars ?? true;
  const inward = face === 's' || face === 'e' ? -1 : 1;
  const put = (t, depth, zz, m) => {
    if (face === 's' || face === 'n') g.set(a + t, p + inward * depth, zz, m); else g.set(p + inward * depth, a + t, zz, m);
  };
  for (let t = -1; t <= w; t++) for (let zz = z - 1; zz <= z + h; zz++) {
    const edge = t === -1 || t === w || zz === z - 1 || zz === z + h;
    if (edge) put(t, 0, zz, frame);
    else {
      put(t, 0, zz, null);
      const mid = bars && (t === ix(w / 2) || zz === z + ix(h / 2));
      put(t, 1, zz, mid ? frame : gl);
    }
  }
  if (opts.sill !== false) for (let t = -1; t <= w; t++) put(t, -1, z - 1, frame);
  if (opts.shutters) for (const t of [-3, -2, w + 1, w + 2]) for (let zz = z; zz < z + h; zz++) put(t, -1, zz, opts.shutters);
}
// Door: recessed leaf with frame; returns nothing. Same face/plane convention as windowOn.
function doorOn(g, face, a, p, z, w, h, opts = {}) {
  const frame = opts.frame || trimWhite, leaf = opts.leaf || planks(WD, 1, 4), depth = opts.depth ?? 1;
  const inward = face === 's' || face === 'e' ? -1 : 1;
  const put = (t, d, zz, m) => { if (face === 's' || face === 'n') g.set(a + t, p + inward * d, zz, m); else g.set(p + inward * d, a + t, zz, m); };
  for (let t = -1; t <= w; t++) for (let zz = z; zz <= z + h; zz++) {
    if (t === -1 || t === w || zz === z + h) put(t, -1, zz, frame);
    else { for (let d = 0; d < depth; d++) put(t, d, zz, null); put(t, depth, zz, opts.open ? interior : leaf); }
  }
  if (opts.knob !== false && !opts.open) put(face === 's' || face === 'w' ? w - 2 : 1, depth - 1, z + ix(h * .45), flat(GD[2]));
}
function steps(g, x0, x1, y0, n, m, dir = 1, rise = 2, run = 3) {
  for (let k = 0; k < n; k++) g.box(x0, dir > 0 ? y0 : y0 - (n - k) * run, 0, x1, dir > 0 ? y0 + (n - k) * run : y0, (k + 1) * rise, m);
}
// Wheel with axis along x (vehicles face +y).
function wheelX(g, cx, cy, cz, r, x0, x1, hub = steel) {
  g.cylX(cy, cz, r, x0, x1, rubber);
  g.cylX(cy, cz, r * .45, x0 - .01, x1, hub);
}

// ---------------- Models ----------------
const MODELS = [];
const def = (id, group, foot, height, build, extra = {}) => MODELS.push({ id, group, foot, height, build, margin: 6, ...extra });

// ---------------- More helpers ----------------
function tarpaper(R = TP, i = 3, axis = 'x') {
  return mat((x, y, z, f) => {
    if (f !== 'u') return cl(R, i - 1);
    const v = axis === 'x' ? y : x, u = axis === 'x' ? x : y;
    const band = ix(v / 6), vv = (((ix(v) % 6) + 6) % 6);
    return cl(R, i + (vv === 0 ? -1 : 0) + (hash(ix(u / 9), band, 3) < .18 ? -1 : 0) + (hash(ix(u), ix(v), 4) < .04 ? 1 : 0));
  });
}
// Gable roof (ridge along x) built as a thin shell so the gable-end wall shows under the
// overhang; wallM fills the gable triangles between wx0 and wx1.
function gableRoofX(g, x0, x1, y0, y1, z0, h, m, wallM, wx0, wx1, inset) {
  const c = (y0 + y1) / 2, hw = (y1 - y0) / 2;
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const lim = hw * (1 - (z - z0) / h), d = Math.abs(y - c); return d <= lim && d >= lim - 3.4; }, m);
  if (wallM) g.shape(wx0, y0 + inset, z0, wx1, y1 - inset, z0 + h, (x, y, z) => Math.abs(y - c) <= hw * (1 - (z - z0) / h) - 3, wallM);
}
const checker = (a, b, s = 4, top = null) => mat((x, y, z, f) => { if (f === 'u' && top) return top; const [u, v] = uv(x, y, z, f); return ((ix(u / s) + ix(v / 2)) & 1) ? a : b; });
const stripes = (a, b, s = 4) => mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return (ix((u + v) / s) & 1) ? a : b; });
function railing(g, x0, y0, x1, y1, z, h, m, step = 4, sides = 'snew') {
  const post = (x, y) => g.box(x, y, z, x + 1, y + 1, z + h, m);
  if (sides.includes('s')) { for (let x = x0; x < x1; x += step) post(x, y1 - 1); post(x1 - 1, y1 - 1); g.box(x0, y1 - 1, z + h - 1, x1, y1, z + h, m); g.box(x0, y1 - 1, z + ix(h / 2), x1, y1, z + ix(h / 2) + 1, m); }
  if (sides.includes('n')) { for (let x = x0; x < x1; x += step) post(x, y0); post(x1 - 1, y0); g.box(x0, y0, z + h - 1, x1, y0 + 1, z + h, m); g.box(x0, y0, z + ix(h / 2), x1, y0 + 1, z + ix(h / 2) + 1, m); }
  if (sides.includes('w')) { for (let y = y0; y < y1; y += step) post(x0, y); g.box(x0, y0, z + h - 1, x0 + 1, y1, z + h, m); g.box(x0, y0, z + ix(h / 2), x0 + 1, y1, z + ix(h / 2) + 1, m); }
  if (sides.includes('e')) { for (let y = y0; y < y1; y += step) post(x1 - 1, y); g.box(x1 - 1, y0, z + h - 1, x1, y1, z + h, m); g.box(x1 - 1, y0, z + ix(h / 2), x1, y1, z + ix(h / 2) + 1, m); }
}
// Chimney smoke drawn over the rendered frame: puffs rise and drift right (world wind).
function smokeOverlay(x, y, z, rise = 30) {
  return (c, project, f) => {
    const frames = 4, [sx, sy] = project(x, y, z);
    for (let k = 0; k < 4; k++) {
      const t = (k + f / frames) / 4;
      const py = sy - 2 - t * rise, px = sx + .5 + t * 14 + Math.sin(t * 7 + k) * 1.2, r = 2.2 + t * 4.6;
      for (let yy = Math.floor(py - r); yy <= py + r; yy++) for (let xx = Math.floor(px - r); xx <= px + r; xx++) {
        const d = Math.hypot(xx + .5 - px, yy + .5 - py);
        if (d > r || !dither(xx, yy, 1.25 - t * .8 - d / r * .25)) continue;
        const lit = (xx + .5 - px) + (yy + .5 - py) < -r * .3;
        c.paint(xx, yy, withAlpha(lit ? SM[5] : t < .5 ? SM[4] : SM[3], Math.round(235 - t * 80)));
      }
    }
  };
}
const leaf = (i = 3, s = 1) => mat((x, y, z, f) => { const n = fbm(x * .3 + s, y * .3 + z * .2, 61 + s), h = hash(ix(x), ix(y) * 7 + ix(z), s); return cl(GR, i + (n > .6 ? 1 : n < .4 ? -1 : 0) + (h < .1 ? 1 : h > .93 ? -1 : 0)); });
const cross5 = ['  r  ', '  r  ', 'rrrrr', '  r  ', '  r  '];

const roundelRows = ['  ccc  ', ' ccccc ', 'ccgggcc', 'ccgggcc', 'ccgggcc', ' ccccc ', '  ccc  '];
const roundelPal = { c: CR[2], g: GD[2] };
const discTop = (g, cx, cy, r1, r2, ring, centre) => g.topPaint(cx - r1 - 1, cy - r1 - 1, cx + r1 + 1, cy + r1 + 1, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r2 ? centre : d <= r1 ? ring : null; });

module.exports = {
  BR, WH, CN, TN, CV, DT, TP, RB, PT, cl, uv, ix, flat, glow, mottled, tin, planks, brick, sandbag,
  canvasMat, concrete, rooftile, earth, glass, darkGlass, interior, olive, steel, darkSteel,
  rubber, woodDark, woodPost, trimWhite, trimGreen, rope, redPaint, lampGlow, blackPaint, cream,
  windowOn, doorOn, steps, wheelX, MODELS, def, tarpaper, gableRoofX, checker, stripes, railing,
  smokeOverlay, leaf, cross5, roundelRows, roundelPal, discTop
};

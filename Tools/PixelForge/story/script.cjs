'use strict';
// Handwriting for story art: a stroke font (pen paths, not bitmaps) so a line can be revealed in
// writing order (cut_open_ink) and slanted per writer (uncle Floris leans right).
// Glyph space: baseline y = 0, x-height = 1, ascender 1.9, descender -0.8, y up. Each glyph is
// { w: advance, s: [stroke, ...] } with stroke = [[x, y], ...] smoothed by Catmull-Rom.
// Vietnamese marks are separate strokes placed over the base letter (written after the word,
// as people do), so they never fuse with the letter body.

const BOWL = [[.62, .8], [.38, 1], [.1, .75], [.08, .3], [.28, 0], [.5, .12], [.63, .5]];
const G = {
  a: { w: .95, s: [BOWL, [[.65, 1], [.65, .2], [.72, .03], [.86, .1]]] },
  b: { w: .85, s: [[[.12, 1.9], [.12, 0]], [[.12, .7], [.35, 1], [.6, .8], [.66, .4], [.45, 0], [.12, .15]]] },
  c: { w: .75, s: [[[.62, .8], [.4, 1], [.12, .78], [.08, .3], [.3, 0], [.6, .15]]] },
  d: { w: .95, s: [BOWL, [[.65, 1.9], [.65, .2], [.72, .03], [.86, .1]]] },
  e: { w: .8, s: [[[.1, .5], [.6, .55], [.62, .8], [.4, 1], [.12, .78], [.08, .3], [.3, 0], [.62, .15]]] },
  g: { w: .9, s: [BOWL, [[.65, 1], [.65, -.45], [.45, -.8], [.15, -.62]]] },
  h: { w: .85, s: [[[.12, 1.9], [.12, 0]], [[.12, .65], [.35, 1], [.58, .85], [.62, .3], [.62, 0]]] },
  i: { w: .45, s: [[[.12, 1], [.12, .18], [.2, .02], [.34, .1]]], dot: true },
  l: { w: .45, s: [[[.12, 1.9], [.12, .2], [.2, .02], [.34, .1]]] },
  m: { w: 1.15, s: [[[.1, 1], [.1, 0]], [[.1, .7], [.3, 1], [.48, .8], [.5, 0]], [[.5, .7], [.7, 1], [.88, .8], [.9, 0]]] },
  n: { w: .85, s: [[[.12, 1], [.12, 0]], [[.12, .65], [.35, 1], [.58, .85], [.62, .3], [.62, 0]]] },
  o: { w: .85, s: [[[.6, .85], [.35, 1], [.08, .75], [.08, .3], [.3, 0], [.55, .1], [.68, .45], [.6, .85]]] },
  r: { w: .62, s: [[[.12, 1], [.12, 0]], [[.12, .6], [.3, .95], [.52, .95]]] },
  s: { w: .7, s: [[[.55, .85], [.35, 1], [.14, .82], [.2, .58], [.45, .42], [.55, .2], [.35, 0], [.1, .15]]] },
  t: { w: .58, s: [[[.2, 1.6], [.2, .2], [.3, .02], [.46, .1]], [[.02, 1], [.45, 1]]] },
  u: { w: .92, s: [[[.1, 1], [.1, .3], [.28, 0], [.5, .15], [.62, .5]], [[.62, 1], [.62, .15], [.7, .02], [.84, .1]]] },
  v: { w: .68, s: [[[.05, 1], [.32, 0], [.6, 1]]] },
  y: { w: .88, s: [[[.08, 1], [.1, .35], [.28, .02], [.5, .15], [.62, .5]], [[.62, 1], [.62, -.45], [.44, -.8], [.15, -.62]]] },
  H: { w: 1.0, s: [[[.12, 1.8], [.12, 0]], [[.72, 1.8], [.72, 0]], [[.12, .95], [.72, .95]]] },
  L: { w: .85, s: [[[.14, 1.8], [.14, 0], [.14, 0], [.7, 0]]] },
  F: { w: .8, s: [[[.14, 1.8], [.14, 0]], [[.14, 1.8], [.72, 1.8]], [[.14, .98], [.56, .98]]] },
  A: { w: .95, s: [[[.05, 0], [.42, 1.8], [.42, 1.8], [.8, 0]], [[.22, .65], [.63, .65]]] },
  1: { w: .7, s: [[[.12, 1.3], [.4, 1.6], [.4, 1.6], [.4, 0]]] },
  3: { w: .8, s: [[[.12, 1.4], [.35, 1.6], [.6, 1.35], [.38, .9], [.38, .9], [.62, .5], [.4, 0], [.1, .15]]] },
  5: { w: .8, s: [[[.6, 1.6], [.18, 1.6], [.18, 1.6], [.15, .95], [.15, .95], [.4, 1], [.62, .6], [.42, .02], [.1, .15]]] },
  9: { w: .8, s: [[[.62, 1.2], [.4, 1.6], [.15, 1.3], [.2, .95], [.45, .88], [.62, 1.2], [.6, .4], [.35, 0], [.15, .1]]] },
  '.': { w: .34, s: [[[.1, .08], [.14, .08]]] },
  ',': { w: .36, s: [[[.14, .1], [.06, -.28]]] },
  '—': { w: 1.15, s: [[[.05, .5], [.98, .5]]] },
  ' ': { w: .5, s: [] }
};
// Optical centre of each base letter (where marks sit) and where its horn hooks on.
const CX = { a: .37, e: .37, o: .37, u: .36, i: .12 };
const HORN = { o: [[.6, .88], [.78, 1.02], [.8, 1.28]], u: [[.62, 1], [.79, 1.1], [.83, 1.32]] };
// Marks: fn(cx, raised) -> strokes. Tone marks sit to the upper right of a circumflex.
const MARK = {
  '̂': cx => [[[cx - .24, 1.22], [cx, 1.5], [cx, 1.5], [cx + .24, 1.22]]],                              // circumflex
  '̀': (cx, up) => up ? [[[cx + .14, 1.86], [cx + .4, 1.52]]] : [[[cx - .16, 1.62], [cx + .1, 1.26]]],     // grave
  '́': (cx, up) => up ? [[[cx + .18, 1.52], [cx + .44, 1.86]]] : [[[cx - .06, 1.26], [cx + .2, 1.62]]],    // acute
  '̉': cx => [[[cx - .12, 1.6], [cx + .04, 1.74], [cx + .16, 1.6], [cx + .03, 1.42], [cx + .03, 1.3]]]       // hook above
};

// Catmull-Rom through the points; a repeated point makes a sharp corner.
function sample(pts, step) {
  if (pts.length === 2) { const [a, b] = pts, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); }
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
    const corner0 = i > 0 && pts[i - 1][0] === p1[0] && pts[i - 1][1] === p1[1];
    const corner1 = i + 2 < pts.length && pts[i + 2][0] === p2[0] && pts[i + 2][1] === p2[1];
    const p0 = corner0 || i === 0 ? p1 : pts[i - 1], p3 = corner1 || i + 2 >= pts.length ? p2 : pts[i + 2];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  return out;
}

// Lays out a line. Returns { width, strokes } with strokes in writing order: per word, the letter
// bodies left to right, then that word's marks and i-dots. Stroke points are in px (y down),
// origin = left end of the baseline. opts: scale (px per x-height), slant (x shift per unit up),
// gap (extra advance), wobble (hand tremor in px, deterministic).
function layout(text, { scale = 12, slant = .18, gap = .13, wobble = 0, seed = 1 } = {}) {
  const strokes = [];
  let x = 0, later = [], n = 0;
  const emit = (pts, ox) => {
    const k = n++;
    const px = sample(pts, .5 / scale).map(([gx, gy], i) => {
      const wx = wobble ? Math.sin(i * .21 + k * 1.7 + seed) * wobble : 0, wy = wobble ? Math.cos(i * .17 + k * 2.3 + seed) * wobble : 0;
      return [(ox + gx + gy * slant) * scale + wx, -gy * scale + wy];
    });
    return px;
  };
  for (const ch of text.normalize('NFD').replace(/ơ/g, 'ơ').replace(/ư/g, 'ư').match(/[^̀-ͯ][̀-ͯ]*/g) || []) {
    const base = ch[0], marks = [...ch.slice(1)], g = G[base];
    if (!g) throw new Error('script font: no glyph for "' + base + '" in "' + text + '"');
    if (base === ' ') { strokes.push(...later); later = []; x += g.w; continue; }
    for (const s of g.s) strokes.push(emit(s, x));
    const cx = CX[base], circ = marks.includes('̂');
    for (const m of marks) {
      if (m === '̛') { later.push(emit(HORN[base], x)); continue; }
      if (!MARK[m] || cx === undefined) throw new Error('script font: no mark U+' + m.codePointAt(0).toString(16) + ' on "' + base + '"');
      for (const s of MARK[m](cx, circ && m !== '̂')) later.push(emit(s, x));
    }
    if (g.dot && !marks.some(m => m !== '̛')) later.push(emit([[.12, 1.36], [.15, 1.42]], x));
    x += g.w + gap;
  }
  strokes.push(...later);
  return { width: (x - gap) * scale, strokes };
}

// Rasterises strokes with a 2 px wide nib (downstrokes two pixels wide, cross strokes one pixel
// tall). Returns pixels in writing order: [{ x, y, t }] with t = pen travel (px) when first inked;
// lifting the pen between strokes costs `lift` px of travel so the reveal pauses naturally.
function ink(strokes, ox, oy, lift = 6) {
  const seen = new Map(), out = [];
  let t = 0;
  for (const s of strokes) {
    for (let i = 0; i < s.length; i++) {
      if (i) t += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      const x = Math.round(ox + s[i][0]), y = Math.round(oy + s[i][1]);
      for (const xx of [x, x + 1]) { const k = xx + ',' + y; if (!seen.has(k)) { seen.set(k, 1); out.push({ x: xx, y, t }); } }
    }
    t += lift;
  }
  return { pixels: out, travel: t };
}

// Two-tone nib: a pixel on the right edge of a vertical run takes the lighter/thinner tone.
function shade(pixels) {
  const set = new Set(pixels.map(p => p.x + "," + p.y)), has = (x, y) => set.has(x + "," + y);
  for (const p of pixels) p.edge = !has(p.x + 1, p.y) && has(p.x - 1, p.y) && (has(p.x, p.y - 1) || has(p.x, p.y + 1));
  return pixels;
}

// Draws a whole line at once (photo back, note). colours: [core, edge].
function write(c, text, ox, oy, colours, opts) {
  const L = layout(text, opts);
  for (const p of shade(ink(L.strokes, ox, oy).pixels)) c.put(p.x, p.y, p.edge ? colours[1] : colours[0]);
  return L.width;
}

module.exports = { layout, ink, shade, write, G };

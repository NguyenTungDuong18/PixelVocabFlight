'use strict';
// Turns a font spec (vi.cjs / en.cjs) into pixel glyphs for every required code point.
// Accented letters are built from Unicode NFD: base glyph + mark bitmaps, so every
// Vietnamese and Latin-1 letter shares one set of carefully spaced marks.
// Glyph = { w, px: Set('x,r') } where r is the source row (0 = cap top, cap-1 sits on
// the baseline, negative = above the capitals).

function parse(spec) {
  const glyphs = new Map();
  for (const block of spec.src.split(/\n[ \t]*\n/)) {
    const lines = block.split('\n').filter(l => l.length);
    if (!lines.length) continue;
    const key = lines[0], rows = lines.slice(1);
    const ch = /^U\+[0-9A-F]{4,5}$/.test(key) ? String.fromCodePoint(parseInt(key.slice(2), 16)) : key;
    if ([...ch].length !== 1) throw new Error(spec.name + ': khoa glyph sai "' + key + '"');
    if (!rows.length || rows.length > spec.cap + spec.desc) throw new Error(spec.name + ' ' + key + ': ' + rows.length + ' hang');
    const w = rows[0].length;
    if (rows.some(r => r.length !== w || /[^.#]/.test(r))) throw new Error(spec.name + ' ' + key + ': hang khong deu');
    if (glyphs.has(ch)) throw new Error(spec.name + ': trung glyph ' + key);
    const px = new Set();
    rows.forEach((r, y) => [...r].forEach((b, x) => { if (b === '#') px.add(x + ',' + y); }));
    glyphs.set(ch, { w, px });
  }
  return glyphs;
}

const pts = g => [...g.px].map(k => k.split(',').map(Number));
const shape = (rows) => rows.flatMap((r, y) => [...r].map((b, x) => b === '#' ? [x, y] : null).filter(Boolean));
// Mark bitmaps; bias = which way an odd centring rounds (acute leans right, grave left).
const MARKS = {
  '̀': { s: shape(['#.', '.#']), bias: -1, side: -1 },
  '́': { s: shape(['.#', '#.']), bias: 1, side: 1 },
  '̂': { s: shape(['.#.', '#.#']), bias: 0 },
  '̃': { s: shape(['.#.#', '#.#.']), bias: 0, side: 1 },
  '̄': { s: shape(['###']), bias: 0 },
  '̆': { s: shape(['#..#', '.##.']), bias: 0 },
  '̈': { s: shape(['#.#']), bias: 0 },
  '̉': { s: shape(['##', '.#', '#.']), bias: 1, side: 1 },
  '̊': { s: shape(['.#.', '#.#', '.#.']), bias: 0 },
  '̣': { s: shape(['#']), below: true },
  '̧': { s: shape(['.#', '#.']), below: true, attach: true }
};
const HORN = '̛';

function compose(spec, glyphs, ch) {
  if (glyphs.has(ch)) return glyphs.get(ch);
  const nfd = ch.normalize('NFD');
  if ([...nfd].length < 2) return null;
  let [base, ...marks] = [...nfd];
  const top = marks.filter(m => MARKS[m] && !MARKS[m].below);
  if (top.length && base === 'i') base = 'ı';
  if (top.length && base === 'j') base = 'ȷ';
  const b = glyphs.get(base);
  if (!b || marks.some(m => m !== HORN && !MARKS[m])) return null;
  let P = pts(b), w = b.w;
  const centre = (w - 1) / 2, inkTop = Math.min(...P.map(p => p[1]));
  const minRow = spec.cap - spec.ascent, baseRow = spec.cap - 1;
  const has = (x, y) => P.some(p => p[0] === x && p[1] === y);
  if (marks.includes(HORN)) {
    // Horn: two pixels rising from the top-right shoulder of the bowl or stem.
    const col = Math.max(...P.map(p => p[0])), t = Math.min(...P.filter(p => p[0] === col).map(p => p[1]));
    P.push([col + 1, t - 1], [col + 1, t - 2]);
  }
  let prev = null; // [x0, x1, rTop, rBottom] of the mark placed last
  for (const m of top) {
    const M = MARKS[m], mw = Math.max(...M.s.map(p => p[0])) + 1, mh = Math.max(...M.s.map(p => p[1])) + 1;
    const off = (centre - (mw - 1) / 2);
    let x0 = M.bias > 0 ? Math.ceil(off) : Math.floor(off), y0;
    if (!prev) y0 = inkTop - 1 - mh;
    else {
      y0 = prev[2] - 1 - mh;
      if (y0 < minRow) {
        // No room to stack: sit beside the first mark, one column apart, raised one row.
        y0 = Math.max(minRow, prev[2] - 1);
        x0 = (M.side || 1) > 0 ? prev[1] + 2 : prev[0] - 1 - mw;
      }
    }
    if (y0 < minRow) throw new Error(spec.name + ': dau cua ' + ch + ' vuot ascent');
    M.s.forEach(([x, y]) => P.push([x0 + x, y0 + y]));
    prev = [x0, x0 + mw - 1, y0, y0 + mh - 1];
  }
  for (const m of marks.filter(m => MARKS[m] && MARKS[m].below)) {
    const M = MARKS[m], mw = Math.max(...M.s.map(p => p[0])) + 1;
    let x0 = Math.round(centre - (mw - 1) / 2), y0 = M.attach ? baseRow + 1 : baseRow + 2;
    if (!M.attach) {
      // Dot below: nudge right until it no longer touches a descender (ỵ, ỵ-like shapes).
      const clear = x => [-1, 0, 1].every(dx => [-1, 0, 1].every(dy => !has(x + dx, y0 + dy)));
      for (const d of [0, 1, -1, 2, -2, 3]) if (clear(x0 + d)) { x0 += d; break; }
    }
    M.s.forEach(([x, y]) => P.push([x0 + x, y0 + y]));
  }
  const minX = Math.min(0, ...P.map(p => p[0]));
  if (minX < 0) P = P.map(([x, y]) => [x - minX, y]);
  w = Math.max(w - minX, ...P.map(p => p[0] + 1));
  return { w, px: new Set(P.map(p => p.join(','))) };
}

// Spacing versions of the marks, sitting at cap-top height (cedilla below the baseline).
function spacingMark(spec, m, row) {
  const M = MARKS[m];
  return { w: Math.max(...M.s.map(p => p[0])) + 1, px: new Set(M.s.map(([x, y]) => x + ',' + (y + row))) };
}

// Every code point the fonts promise: printable ASCII, Latin-1, all Vietnamese letters,
// dialogue punctuation, arrows and HUD symbols.
function baseCharset() {
  const s = new Set();
  for (let c = 0x20; c < 0x7f; c++) s.add(String.fromCodePoint(c));
  for (let c = 0xa0; c <= 0xff; c++) s.add(String.fromCodePoint(c));
  const vowels = 'aăâeêioôơuưy', tones = ['', '̀', '́', '̉', '̃', '̣'];
  for (const v of vowels + vowels.toUpperCase()) for (const t of tones) s.add((v.normalize('NFD') + t).normalize('NFC'));
  for (const c of 'đĐıȷ…·–—“”‘’‚„→←↑↓•★✓×°‹›€™�') s.add(c);
  return s;
}
// Homoglyphs found in imported data (Cyrillic р in "рhù điêu") and invisible formatting.
const ALIAS = { ' ': ' ', '­': '-', 'р': 'p', '‐': '-', '‑': '-', '−': '-' };

module.exports = { parse, compose, spacingMark, baseCharset, ALIAS, MARKS };

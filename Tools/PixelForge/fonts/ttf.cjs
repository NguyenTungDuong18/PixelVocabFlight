'use strict';
// Minimal TrueType writer for pixel fonts, plus a reader that rasterises the file back
// (used to prove the output parses and to draw the preview from the real TTF).
// Outlines: one clockwise rectangle per run of pixels (horizontal runs, merged down
// through identical rows), all points on-curve, no hinting instructions.

// ---------- writer ----------
class Buf {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 255); return this; }
  u16(v) { return this.u8(v >> 8).u8(v); }
  i16(v) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { return this.u16(Math.floor(v / 65536) & 0xffff).u16(v & 0xffff); }
  tag(s) { for (const ch of s) this.u8(ch.charCodeAt(0)); return this; }
  bytes(a) { for (const v of a) this.u8(v); return this; }
  get length() { return this.b.length; }
  buffer() { return Buffer.from(this.b); }
}
const checksum = buf => { let s = 0; for (let i = 0; i < buf.length; i += 4) s = (s + ((buf[i] << 24) | ((buf[i + 1] || 0) << 16) | ((buf[i + 2] || 0) << 8) | (buf[i + 3] || 0))) >>> 0; return s; };
const pad4 = buf => buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - buf.length % 4)]) : buf;

// bitmap: { w, rows: string[] ('#' = ink), top } where top = pixel rows above the baseline
// for rows[0]. Returns rectangles in pixel units, y up from the baseline.
function rectangles(g) {
  const runs = [];
  g.rows.forEach((row, r) => {
    const y = g.top - 1 - r;
    for (let x = 0; x < row.length;) {
      if (row[x] !== '#') { x++; continue; }
      let e = x; while (e < row.length && row[e] === '#') e++;
      runs.push({ x0: x, x1: e, y0: y, y1: y + 1 }); x = e;
    }
  });
  // Merge vertically adjacent runs with the same span into taller rectangles.
  const out = [];
  for (const r of runs) {
    const m = out.find(o => o.x0 === r.x0 && o.x1 === r.x1 && o.y0 === r.y1);
    if (m) m.y0 = r.y0; else out.push({ ...r });
  }
  return out;
}

const NAME_IDS = (n) => ({ 0: n.copyright, 1: n.family, 2: 'Regular', 3: n.family + ' ' + n.version, 4: n.family, 5: 'Version ' + n.version, 6: n.family, 13: n.license });

// glyphs: [{ cp (or null for .notdef), adv (px), bitmap }]; first glyph must be .notdef.
// m: { unit, ascent, descent, lineGap, capHeight, xHeight, names, mono }
function writeTTF(glyphs, m) {
  const U = m.unit;
  const recs = glyphs.map(g => {
    const rects = g.bitmap ? rectangles(g.bitmap) : [];
    const b = new Buf();
    let box = [0, 0, 0, 0];
    if (rects.length) {
      box = [Math.min(...rects.map(r => r.x0)) * U, Math.min(...rects.map(r => r.y0)) * U, Math.max(...rects.map(r => r.x1)) * U, Math.max(...rects.map(r => r.y1)) * U];
      b.i16(rects.length).i16(box[0]).i16(box[1]).i16(box[2]).i16(box[3]);
      rects.forEach((r, i) => b.u16(i * 4 + 3));
      b.u16(0); // no instructions
      for (let i = 0; i < rects.length * 4; i++) b.u8(1); // on-curve, full int16 deltas
      // Clockwise with y up: bottom-left, top-left, top-right, bottom-right.
      const pts = rects.flatMap(r => [[r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x1, r.y0]]).map(([x, y]) => [x * U, y * U]);
      let px = 0; for (const [x] of pts) { b.i16(x - px); px = x; }
      let py = 0; for (const [, y] of pts) { b.i16(y - py); py = y; }
      while (b.length % 4) b.u8(0);
    }
    return { cp: g.cp, adv: g.adv * U, data: b.buffer(), box, points: rects.length * 4, contours: rects.length };
  });
  const inked = recs.filter(r => r.contours);
  const xMin = Math.min(0, ...inked.map(r => r.box[0])), yMin = Math.min(...inked.map(r => r.box[1]));
  const xMax = Math.max(...inked.map(r => r.box[2])), yMax = Math.max(...inked.map(r => r.box[3]));
  const em = 16 * U, asc = m.ascent * U, desc = m.descent * U, gap = m.lineGap * U;
  const T = {};

  const head = new Buf().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(em)
    .u32(0).u32(0xE3A1B200).u32(0).u32(0xE3A1B200) // created/modified: a fixed date so the output is byte-stable
    .i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(0).u16(8).i16(2).i16(1).i16(0);
  T.head = head.buffer();

  const advMax = Math.max(...recs.map(r => r.adv));
  T.hhea = new Buf().u32(0x00010000).i16(asc).i16(-desc).i16(gap).u16(advMax)
    .i16(Math.min(...inked.map(r => r.box[0]))).i16(Math.min(...inked.map(r => r.adv - r.box[2]))).i16(Math.max(...inked.map(r => r.box[2])))
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(recs.length).buffer();

  T.maxp = new Buf().u32(0x00010000).u16(recs.length).u16(Math.max(...recs.map(r => r.points))).u16(Math.max(...recs.map(r => r.contours)))
    .u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).buffer();

  const cps = recs.map(r => r.cp).filter(c => c != null);
  const avg = Math.round(recs.filter(r => r.adv).reduce((s, r) => s + r.adv, 0) / recs.filter(r => r.adv).length);
  const os2 = new Buf().u16(4).i16(avg).u16(400).u16(5).u16(0)
    .i16(10 * U).i16(11 * U).i16(0).i16(2 * U).i16(10 * U).i16(11 * U).i16(0).i16(8 * U).i16(U).i16(Math.round(m.xHeight / 2) * U)
    .i16(0).bytes([2, 11, 6, 9, m.mono ? 9 : 2, 2, 2, 2, 2, 4])
    .u32(((1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 29) | (1 << 31)) >>> 0).u32(1 << 5).u32(0).u32(0)
    .tag('WWNG').u16(0x40 | 0x80).u16(Math.min(...cps)).u16(Math.min(0xffff, Math.max(...cps)))
    .i16(asc).i16(-desc).i16(gap).u16(Math.max(asc, yMax)).u16(Math.max(desc, -yMin))
    .u32((1 << 0) | (1 << 8)).u32(0).i16(m.xHeight * U).i16(m.capHeight * U).u16(0).u16(32).u16(1);
  T['OS/2'] = os2.buffer();

  const names = Object.entries(NAME_IDS(m.names)).filter(([, v]) => v);
  const strs = names.map(([, v]) => Buffer.from(v, 'utf16le').swap16());
  const name = new Buf().u16(0).u16(names.length).u16(6 + names.length * 12);
  let off = 0;
  names.forEach(([id], i) => { name.u16(3).u16(1).u16(0x0409).u16(+id).u16(strs[i].length).u16(off); off += strs[i].length; });
  T.name = Buffer.concat([name.buffer(), ...strs]);

  // cmap format 4: glyphs are sorted by code point, so contiguous code points are contiguous ids.
  const segs = [];
  recs.forEach((r, gid) => {
    if (r.cp == null || r.cp > 0xffff) return;
    const s = segs[segs.length - 1];
    if (s && r.cp === s.end + 1 && gid === s.gid + (r.cp - s.start)) s.end = r.cp; else segs.push({ start: r.cp, end: r.cp, gid });
  });
  segs.push({ start: 0xffff, end: 0xffff, gid: 0 }); // required terminator, maps to .notdef
  const n = segs.length, sr = 2 * 2 ** Math.floor(Math.log2(n));
  const f4 = new Buf().u16(4).u16(16 + n * 8).u16(0).u16(n * 2).u16(sr).u16(Math.log2(sr / 2)).u16(n * 2 - sr);
  segs.forEach(s => f4.u16(s.end)); f4.u16(0);
  segs.forEach(s => f4.u16(s.start));
  segs.forEach((s, i) => f4.u16(i === n - 1 ? 1 : (s.gid - s.start + 65536) % 65536));
  segs.forEach(() => f4.u16(0));
  T.cmap = Buffer.concat([new Buf().u16(0).u16(2).u16(0).u16(3).u32(20).u16(3).u16(1).u32(20).buffer(), f4.buffer()]);

  const hmtx = new Buf(); recs.forEach(r => hmtx.u16(r.adv).i16(r.box[0])); T.hmtx = hmtx.buffer();
  const loca = new Buf(); let at = 0; recs.forEach(r => { loca.u32(at); at += r.data.length; }); loca.u32(at); T.loca = loca.buffer();
  T.glyf = Buffer.concat(recs.map(r => r.data));
  T.post = new Buf().u32(0x00030000).u32(0).i16(-2 * U).i16(U).u32(m.mono ? 1 : 0).u32(0).u32(0).u32(0).u32(0).buffer();

  const tags = Object.keys(T).sort();
  const nt = tags.length, er = 2 ** Math.floor(Math.log2(nt));
  const dir = new Buf().u32(0x00010000).u16(nt).u16(er * 16).u16(Math.log2(er)).u16(nt * 16 - er * 16);
  let offset = 12 + nt * 16; const body = [];
  for (const t of tags) { const d = pad4(T[t]); dir.tag(t.padEnd(4)).u32(checksum(d)).u32(offset).u32(T[t].length); body.push(d); offset += d.length; }
  const font = Buffer.concat([dir.buffer(), ...body]);
  const headAt = 12 + nt * 16 + body.slice(0, tags.indexOf('head')).reduce((s, d) => s + d.length, 0);
  font.writeUInt32BE((0xB1B0AFBA - checksum(font)) >>> 0, headAt + 8);
  return font;
}

// ---------- reader (for verification and previews) ----------
function readTTF(buf) {
  const nt = buf.readUInt16BE(4), tables = {};
  for (let i = 0; i < nt; i++) {
    const o = 12 + i * 16, tag = buf.toString('latin1', o, o + 4), off = buf.readUInt32BE(o + 8), len = buf.readUInt32BE(o + 12);
    if (checksum(pad4(buf.subarray(off, off + len))) !== buf.readUInt32BE(o + 4) && tag !== 'head') throw new Error('checksum ' + tag);
    tables[tag.trim()] = buf.subarray(off, off + len);
  }
  if (checksum(buf) !== 0xB1B0AFBA) throw new Error('checkSumAdjustment sai');
  const em = tables.head.readUInt16BE(18), hhea = tables.hhea, nh = hhea.readUInt16BE(34);
  const ascent = hhea.readInt16BE(4), descent = hhea.readInt16BE(6), lineGap = hhea.readInt16BE(8);
  const cmap = new Map(), c = tables.cmap;
  for (let i = 0; i < c.readUInt16BE(2); i++) {
    const off = c.readUInt32BE(4 + i * 8 + 4); if (c.readUInt16BE(off) !== 4) continue;
    const n = c.readUInt16BE(off + 6) / 2, e = off + 14, s = e + n * 2 + 2, d = s + n * 2, r = d + n * 2;
    for (let k = 0; k < n; k++) {
      const end = c.readUInt16BE(e + k * 2), start = c.readUInt16BE(s + k * 2), delta = c.readUInt16BE(d + k * 2);
      if (c.readUInt16BE(r + k * 2)) throw new Error('idRangeOffset khong ho tro');
      for (let cp = start; cp <= end && cp !== 0xffff; cp++) cmap.set(cp, (cp + delta) % 65536);
    }
  }
  const loca = i => tables.loca.readUInt32BE(i * 4);
  const glyph = gid => {
    const adv = tables.hmtx.readUInt16BE(Math.min(gid, nh - 1) * 4), g = tables.glyf, a = loca(gid), b = loca(gid + 1);
    if (a === b) return { adv, contours: [] };
    const nc = g.readInt16BE(a), ends = []; let p = a + 10;
    for (let i = 0; i < nc; i++) { ends.push(g.readUInt16BE(p)); p += 2; }
    p += 2 + g.readUInt16BE(p);
    const np = ends[nc - 1] + 1;
    for (let i = 0; i < np; i++) if (g[p + i] !== 1) throw new Error('flag ngoai du kien'); // writer only emits 1
    p += np;
    const xs = [], ys = []; let x = 0, y = 0;
    for (let i = 0; i < np; i++) { x += g.readInt16BE(p); p += 2; xs.push(x); }
    for (let i = 0; i < np; i++) { y += g.readInt16BE(p); p += 2; ys.push(y); }
    const contours = []; let s = 0;
    for (const e of ends) { contours.push(xs.slice(s, e + 1).map((xx, i) => [xx, ys[s + i]])); s = e + 1; }
    return { adv, contours };
  };
  return { em, ascent, descent, lineGap, cmap, glyph, numGlyphs: tables.maxp.readUInt16BE(4) };
}

// Non-zero winding fill sampled at pixel centres; scale = output pixels per font pixel unit.
function rasterize(font, text, pxPerEm, colour, Canvas, maxWidth = Infinity) {
  const s = pxPerEm / font.em, lineH = Math.round((font.ascent - font.descent + font.lineGap) * s);
  const lines = []; let line = [], x = 0;
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = []; x = 0; continue; }
    const gid = font.cmap.get(ch.codePointAt(0)) || 0, g = font.glyph(gid), adv = Math.round(g.adv * s);
    if (x + adv > maxWidth && ch !== ' ') { lines.push(line); line = []; x = 0; }
    line.push({ g, x }); x += adv;
  }
  lines.push(line);
  const w = Math.max(1, ...lines.map(l => l.length ? l[l.length - 1].x + Math.round(l[l.length - 1].g.adv * s) : 1));
  const c = new Canvas(w, lineH * lines.length), base = Math.round(font.ascent * s), wind = new Map();
  lines.forEach((l, li) => l.forEach(({ g, x: gx }) => {
    for (const ct of g.contours) for (let i = 0; i < ct.length; i++) {
      const [x0, y0] = ct[i], [x1, y1] = ct[(i + 1) % ct.length];
      if (x0 !== x1) continue; // writer emits axis-aligned rectangles: vertical edges carry the winding
      const dir = y1 > y0 ? 1 : -1, lo = Math.min(y0, y1) * s, hi = Math.max(y0, y1) * s, ex = x0 * s;
      for (let py = Math.ceil(lo - .5); py + .5 < hi; py++) for (let px = 0; px + .5 < ex; px++) {
        const X = gx + px, Y = li * lineH + base - py - 1;
        const k = Y * c.w + X; wind.set(k, (wind.get(k) || 0) + dir);
      }
    }
  }));
  for (const [k, v] of wind) if (v) c.px[k] = colour;
  return c;
}

module.exports = { writeTTF, readTTF, rasterize, rectangles };

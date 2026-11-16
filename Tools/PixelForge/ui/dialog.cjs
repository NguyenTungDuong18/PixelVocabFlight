'use strict';
// Base dialogue set (ui_dialog_*): walnut frame with brass corner brackets around cream
// paper, a brass-rimmed portrait well, an olive name plate, paper choice slips and the
// bobbing "next" arrow. All are nine-sliced (Image.Type.Sliced stretches the edge strips
// and the centre), so every detail lives in the corners: edge strips stay constant along
// their length and the centre is one flat colour. assertSliceable enforces that.
const { PAL, K, hex, hash, dither, Canvas } = require('../lib.cjs');
const { CR, GD, WD, OL } = PAL;

const PAPER = CR[2], PAPER_SHADE = hex('#c8bf9b'), PAPER_FOX = hex('#cdb98a');
const WELL = hex('#1a1f17'), WELL_SHADE = hex('#0e110c'), WELL_RIM = hex('#2b3326');

// Distance to the nearest edge and which edge that is; lit = top/left (light from the north-west).
function edge(w, h, x, y) {
  const d = [x, y, w - 1 - x, h - 1 - y], m = Math.min(...d), side = d.indexOf(m);
  return { d: m, lit: side < 2, side, du: d };
}
// Clips the three outer pixels of every corner so frames read as rounded, not boxy.
const clipped = (w, h, x, y) => Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) <= 1;

// Brass plate from a mask: ink rim, lit top/left, shaded bottom/right, a few patina flecks.
function brass(c, mask, seed) {
  const m = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && mask(x, y);
  const edgeOf = (x, y) => !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (!m(x, y)) continue;
    if (edgeOf(x, y)) { c.put(x, y, K); continue; }
    const up = !m(x, y - 2) || !m(x - 2, y), down = !m(x, y + 2) || !m(x + 2, y);
    // Bevel ring, then an engraved groove one pixel further in, then the polished face.
    let col = up ? GD[3] : down ? GD[1] : GD[2];
    if (!up && !down && (!m(x, y - 3) || !m(x - 3, y) || !m(x, y + 3) || !m(x + 3, y))) col = (!m(x, y + 3) || !m(x + 3, y)) ? GD[3] : GD[1];
    else if (col === GD[2] && dither(x, y, .1 + hash(x >> 1, y >> 1, seed) * .15)) col = hex('#b88e35');
    c.put(x, y, col);
  }
}
// Countersunk 4x4 rivet: dark seat, specular top-left, shaded bottom-right.
function rivet(c, x, y) {
  const R = ['.00.', '0hm0', '0md0', '.00.'], P = { 0: GD[0], h: CR[3], m: GD[3], d: GD[1] };
  R.forEach((row, j) => [...row].forEach((k, i) => { if (P[k]) c.put(x + i, y + j, P[k]); }));
}
// Small 2x2 stud for narrow rims.
function stud(c, x, y) { c.put(x, y, CR[3]); c.put(x + 1, y, GD[3]); c.put(x, y + 1, GD[3]); c.put(x + 1, y + 1, GD[0]); }
// Mirrors local corner coordinates into each of the four corners.
const corners = (w, h) => [[0, 0, 1, 1], [w - 1, 0, -1, 1], [0, h - 1, 1, -1], [w - 1, h - 1, -1, -1]];

// 48x48, border 16. Frame 0-6 px, recessed paper from 7 px, flat paper centre.
function dialogBox() {
  const w = 48, h = 48, c = new Canvas(w, h);
  const woodLit = [null, WD[4], WD[3], WD[2], WD[3], WD[1]];
  const woodDim = [null, WD[0], WD[1], WD[2], WD[1], WD[3]];
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit, du } = edge(w, h, x, y);
    if (d === 0 || d === 6) return K;
    if (d <= 5) {
      // Mitred joint: where two bands meet on the diagonal, a dark seam.
      const sorted = du.slice().sort((a, b) => a - b);
      if (sorted[0] === sorted[1] && d >= 1) return WD[0];
      return (lit ? woodLit : woodDim)[d];
    }
    if (d === 7) return lit ? CR[1] : CR[3];
    if (d === 8) return lit ? PAPER_SHADE : PAPER;
    return PAPER;
  });
  // Age spots on the paper corners, fading out well before the stretched strips.
  for (let y = 7; y < 16; y++) for (let x = 7; x < 16; x++) {
    const r = Math.hypot(x - 7, y - 7), t = Math.max(0, .55 - r / 12);
    for (const [ox, oy, sx, sy] of corners(w, h)) {
      const px = ox + sx * x, py = oy + sy * y;
      const cur = c.get(px, py);
      if ((cur === PAPER || cur === PAPER_SHADE) && dither(px, py, t * (.6 + hash(px, py, 5) * .8))) c.put(px, py, PAPER_FOX);
    }
  }
  // Brass L brackets with pointed arm tips, three rivets each.
  for (const [ox, oy, sx, sy] of corners(w, h)) {
    const local = (x, y) => [(x - ox) * sx, (y - oy) * sy];
    brass(c, (x, y) => {
      const [u, v] = local(x, y);
      if (u < 0 || v < 0 || clipped(w, h, x, y)) return false;
      return (u <= 7 && v <= 7) || (v <= 7 && u + Math.abs(v - 3.5) <= 14) || (u <= 7 && v + Math.abs(u - 3.5) <= 14);
    }, ox + oy);
    for (const [u, v] of [[2, 2], [9, 2], [2, 9]]) rivet(c, ox + sx * u - (sx < 0 ? 3 : 0), oy + sy * v - (sy < 0 ? 3 : 0));
  }
  return c;
}

// 48x48, border 16, same metrics as ui_dialog_box so text sits identically. For lines nobody is
// seen to speak (opening: "Anh giữ hết à.") and for writing on objects: no brass, no rivets, nothing
// that dates it. A dark stained frame with one inlaid cream line and the same paper, a soft stain
// in each corner. No name slot, no portrait well.
function dialogPlain() {
  const w = 48, h = 48, c = new Canvas(w, h);
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit } = edge(w, h, x, y);
    if (d === 0 || d === 6) return K;
    if (d === 1) return lit ? WD[2] : WD[0];
    if (d === 3) return lit ? CR[1] : CR[0];
    if (d <= 5) return d === 5 ? (lit ? WD[0] : WD[2]) : WD[1];
    if (d === 7) return lit ? CR[1] : CR[3];
    if (d === 8) return lit ? PAPER_SHADE : PAPER;
    return PAPER;
  });
  for (let y = 7; y < 16; y++) for (let x = 7; x < 16; x++) {
    const t = Math.max(0, .7 - Math.hypot(x - 7, y - 7) / 11);
    for (const [ox, oy, sx, sy] of corners(w, h)) {
      const px = ox + sx * x, py = oy + sy * y, cur = c.get(px, py);
      if ((cur === PAPER || cur === PAPER_SHADE) && dither(px, py, t * (.6 + hash(px, py, 9) * .8))) c.put(px, py, PAPER_FOX);
    }
  }
  // Mitre seams and a worn, lighter patch on each corner of the frame.
  for (const [ox, oy, sx, sy] of corners(w, h)) for (let k = 1; k <= 5; k++) { c.put(ox + sx * k, oy + sy * k, K); if (k === 2 || k === 3) c.put(ox + sx * (k + 3), oy + sy * k, WD[3]); }
  return c;
}

// 40x40, border 12: 4 px brass rim (0-3), dark well from 4 px with an inner shadow.
function dialogPortrait() {
  const w = 40, h = 40, c = new Canvas(w, h);
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit } = edge(w, h, x, y);
    if (d === 0 || d === 3) return K;
    if (d === 1) return lit ? GD[3] : GD[1];
    if (d === 2) return lit ? GD[2] : GD[1];
    if (d === 4) return lit ? WELL_SHADE : WELL_RIM;
    return WELL;
  });
  for (const [ox, oy, sx, sy] of corners(w, h)) {
    brass(c, (x, y) => { const u = (x - ox) * sx, v = (y - oy) * sy; return u >= 0 && v >= 0 && u + v <= 8 && !clipped(w, h, x, y); }, 3);
    stud(c, ox + sx * 2 - (sx < 0 ? 1 : 0), oy + sy * 2 - (sy < 0 ? 1 : 0));
  }
  return c;
}

// 24x16, border 7: olive enamel plate in a brass rim, cream lettering goes on top.
function dialogName() {
  const w = 24, h = 16, c = new Canvas(w, h);
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit, side } = edge(w, h, x, y);
    if (d === 0 || d === 2) return K;
    if (d === 1) return side === 1 ? GD[3] : lit ? GD[2] : GD[1];
    if (d === 3) return side === 1 ? OL[2] : side === 3 ? OL[0] : OL[1];
    return OL[1];
  });
  for (const [ox, oy, sx, sy] of corners(w, h)) stud(c, ox + sx * 4 - (sx < 0 ? 1 : 0), oy + sy * 4 - (sy < 0 ? 1 : 0));
  return c;
}

// 32x24, border 8: paper slip with an index tab on the left. Selected = bright paper, brass rim.
function dialogChoice(selected) {
  const w = 32, h = 24, c = new Canvas(w, h);
  const fill = selected ? CR[3] : hex('#cbc29d');
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit } = edge(w, h, x, y);
    if (d === 0) return K;
    if (selected) {
      if (d === 1) return lit ? GD[3] : GD[1];
      if (d === 2) return GD[2];
      if (d === 3) return K;
      if (d === 4) return lit ? fill : CR[2];
      return fill;
    }
    if (d === 1) return lit ? CR[2] : CR[0];
    if (d === 2 && !lit) return CR[1];
    return fill;
  });
  // Index tab: a vertical strip at the left edge (constant down its length).
  const tab = selected ? [GD[3], GD[2], GD[1]] : [WD[3], WD[2], WD[1]];
  const x0 = selected ? 4 : 2;
  for (let y = x0; y < h - x0; y++) { c.put(x0, y, tab[0]); c.put(x0 + 1, y, tab[1]); c.put(x0 + 2, y, tab[2]); c.put(x0 + 3, y, K); }
  for (let i = 0; i < 4; i++) { c.put(x0 + i, x0 - 1, K); c.put(x0 + i, h - x0, K); }
  return c;
}

// 10x10, 6 frames @8: brass down-arrow bobbing 0-2 px with a glint sweeping across.
function dialogNextFrames() {
  const bob = [0, 1, 2, 2, 1, 0];
  return bob.map((b, f) => {
    const c = new Canvas(10, 10);
    // Contact shadow on the paper: wider and darker as the arrow dips toward it.
    for (let x = 4 - b; x <= 4 + b; x++) c.put(x, 9, [20, 23, 15, 70 + b * 25]);
    const rows = [[1, 7], [2, 6], [3, 5], [4, 4]];
    const arrow = new Canvas(10, 10);
    rows.forEach(([a, z], i) => { for (let x = a; x <= z; x++) arrow.put(x, 1 + b + i, i === 0 ? (x === a ? GD[2] : GD[3]) : x < 4 ? GD[2] : x === 4 ? GD[2] : GD[1]); });
    arrow.put(2, 2 + b, GD[3]); arrow.put(3, 2 + b, GD[3]);
    arrow.outline(K);
    c.blit(arrow, 0, 0);
    const glint = [null, [2, 1], [4, 1], [5, 2], null, null][f];
    if (glint) c.put(glint[0], glint[1] + b, CR[3]);
    if (f === 2) { c.put(8, 1, CR[3]); c.put(8, 0, GD[3]); c.put(9, 1, GD[3]); c.put(7, 1, GD[3]); c.put(8, 2, GD[3]); }
    if (f === 3) c.put(8, 1, GD[3]);
    return c;
  });
}

// Throws if a stretched region of the nine-slice is not constant along its stretch axis.
function assertSliceable(name, c, b) {
  const same = (p, q) => String(c.get(...p)) === String(c.get(...q));
  for (let y = 0; y < c.h; y++) for (let x = b; x < c.w - b; x++) if (!same([x, y], [b, y])) throw new Error(name + ': hang ' + y + ' khong deu tai x=' + x);
  for (let x = 0; x < c.w; x++) for (let y = b; y < c.h - b; y++) if (!same([x, y], [x, b])) throw new Error(name + ': cot ' + x + ' khong deu tai y=' + y);
}

function build(add) {
  const sliced = (name, c, border) => { assertSliceable(name, c, border); add('UI', name, [c], { fps: 1, border }); };
  sliced('ui_dialog_box', dialogBox(), 16);
  sliced('ui_dialog_plain', dialogPlain(), 16);
  sliced('ui_dialog_portrait', dialogPortrait(), 12);
  sliced('ui_dialog_name', dialogName(), 7);
  sliced('ui_dialog_choice', dialogChoice(false), 8);
  sliced('ui_dialog_choice_selected', dialogChoice(true), 8);
  add('UI', 'ui_dialog_next', dialogNextFrames(), { fps: 8, loop: true });
}

module.exports = { build, dialogBox, dialogPortrait, dialogName, dialogChoice, dialogNextFrames, edge, clipped, brass, rivet, stud, corners, assertSliceable, PAPER, PAPER_SHADE, PAPER_FOX, WELL, WELL_SHADE, WELL_RIM };

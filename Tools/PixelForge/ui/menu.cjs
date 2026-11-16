'use strict';
// Title menu / settings / save screens (same family as ui_dialog_*: walnut, brass, cream paper).
//   ui_slider_track       24x8, border 3: a groove routed in walnut, brass lip below (stretches sideways)
//   ui_slider_knob        12x16: brass lever knob with grip grooves and a pointer at its foot
//   ui_save_slot          48x48, border 16: cream record card in a thin walnut frame, brass clip, dog-ear
//   ui_save_slot_selected 48x48, border 16: the same card brought forward: brighter paper, brass frame
const { PAL, K, hex, hash, dither, Canvas } = require('../lib.cjs');
const { edge, clipped, brass, rivet, stud, corners, assertSliceable, PAPER, PAPER_SHADE, PAPER_FOX, WELL, WELL_SHADE, WELL_RIM } = require('./dialog.cjs');
const { CR, GD, WD, RD, ST, OL, NV, FI, SM } = PAL;

function sliderTrack() {
  const w = 24, h = 8, c = new Canvas(w, h);
  const rows = [K, WD[2], WELL_SHADE, WELL, WELL, WELL_RIM, GD[2], K];
  c.fill((x, y) => {
    const ex = Math.min(x, w - 1 - x);
    if (ex === 0 && (y === 0 || y === h - 1)) return null;                              // rounded ends
    if (ex === 0) return K;
    if (ex === 1 && y > 0 && y < h - 1) return y === h - 2 ? GD[1] : WD[1];            // end grain of the groove
    return rows[y];
  });
  return c;
}

function sliderKnob() {
  const w = 12, h = 16, c = new Canvas(w, h);
  // Body 12x13 with rounded top corners, then a 3-row pointer.
  const mask = (x, y) => {
    if (y < 13) return !((x === 0 || x === w - 1) && (y === 0 || y === 12)) && !((x === 0 || x === w - 1) && y === 1 && false);
    const half = 15 - y;                                                                 // 2, 1, 0
    return Math.abs(x - 5.5) <= half + .5;
  };
  brass(c, mask, 7);
  for (const gy of [4, 6, 8]) for (let x = 3; x <= 8; x++) { c.put(x, gy, GD[0]); c.put(x, gy + 1, x === 3 ? GD[2] : CR[3]); }   // grip grooves
  c.put(3, 2, CR[3]); c.put(4, 2, CR[3]);                                                 // glint
  return c;
}

function saveSlot(selected) {
  const w = 48, h = 48, c = new Canvas(w, h);
  const paper = selected ? CR[3] : PAPER, shade = selected ? CR[2] : PAPER_SHADE;
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit } = edge(w, h, x, y);
    if (d === 0 || d === 4) return K;
    if (selected) {
      if (d === 1) return lit ? GD[3] : GD[1];
      if (d === 2) return GD[2];
      if (d === 3) return lit ? GD[1] : GD[0];
    } else {
      if (d === 1) return lit ? WD[3] : WD[1];
      if (d === 2) return WD[2];
      if (d === 3) return lit ? WD[1] : WD[0];
    }
    if (d === 5) return lit ? shade : paper;
    if (x === 11 && y > 5 && y < h - 5) return selected ? RD[3] : hex('#c79b86');          // red margin rule down the card
    return paper;
  });
  // Foxing in the paper corners, fading before the stretched strips.
  for (let y = 5; y < 16; y++) for (let x = 5; x < 16; x++) {
    const t = Math.max(0, .5 - Math.hypot(x - 5, y - 5) / 12);
    for (const [ox, oy, sx, sy] of corners(w, h)) {
      const px = ox + sx * x, py = oy + sy * y, cur = c.get(px, py);
      if ((cur === paper || cur === shade) && dither(px, py, t * (.5 + hash(px, py, 13) * .8))) c.put(px, py, PAPER_FOX);
    }
  }
  // Brass paper clip over the top edge, top-left corner.
  for (let y = 1; y <= 10; y++) for (let x = 5; x <= 9; x++) {
    const loopOuter = x === 5 || x === 9 || y === 1 || y === 10, inner = (x === 7 && y >= 3 && y <= 8) || (y === 3 && x >= 7 && x <= 7);
    if (loopOuter || inner) c.put(x, y, (x === 5 || y === 1) ? GD[3] : x === 9 ? GD[1] : GD[2]);
  }
  c.put(5, 1, K); c.put(9, 10, K);
  // Dog-eared bottom-right corner: the fold shows the back of the card.
  for (let k = 0; k < 7; k++) for (let j = 0; j <= k; j++) {
    const x = w - 6 - 6 + k, y = h - 6 - j;
    if (j === k) c.put(x, y, K);
    else c.put(x, y, j === k - 1 ? CR[1] : shade);
  }
  if (selected) for (const [ox, oy, sx, sy] of corners(w, h)) if (!(sx < 0 && sy < 0)) stud(c, ox + sx * 2 - (sx < 0 ? 1 : 0), oy + sy * 2 - (sy < 0 ? 1 : 0));
  return c;
}

// ---------- Title menu rows (ui_menu_*): riveted aircraft placards over the sky.
//   ui_menu_option          64x24, border 10: olive-painted steel plate, gun-metal rim with a 3-step bevel
//                           (raised edge, groove, recessed lip), riveted corner doublers, chipped paint and
//                           rust at the right corners, a yellow/black stencil tab on the left holding an
//                           unlit warning lamp. Flat dark olive centre for cream text.
//   ui_menu_option_selected same plate brought up: polished brass rim and doublers, an amber line inside
//                           the rim, lighter face, the tab lamp glowing orange-red and warming the tab.
//   ui_menu_marker          12x12, 6 @10 loop: brass pointer, nudges 1 px right, glint sweeps across.
//   ui_menu_footer          32x20, border 6: dark riveted strip for the key-hint bar.
const AMBER = hex('#f2b65a');               // warm accent light (quality bar 1.6), same as the selected text
const STRIPE = [GD[2], SM[0]];              // stencil yellow / black paint on the tab
const RUST = [RD[0], RD[1], WD[1], RD[2]];

// Gun-metal plate from a mask: ink rim, lit top/left bevel, shaded bottom/right.
function steel(c, mask) {
  const m = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && mask(x, y);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (!m(x, y)) continue;
    const edgeOf = !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1);
    // Blue-grey primer so the doubler reads apart from the grey rim.
    c.put(x, y, edgeOf ? K : (!m(x, y - 2) || !m(x - 2, y)) ? NV[4] : (!m(x, y + 2) || !m(x + 2, y)) ? NV[1] : NV[2]);
  }
}

function menuOption(selected) {
  const w = 64, h = 24, c = new Canvas(w, h);
  // Rim profile by distance to the edge: [lit, dim] for d = 1..5, then the face.
  const rim = selected
    ? [[GD[3], GD[1]], [GD[2], GD[1]], [GD[1], GD[0]], [AMBER, AMBER], [OL[1], OL[4]]]
    : [[ST[4], ST[1]], [ST[3], ST[2]], [ST[2], ST[1]], [ST[0], ST[0]], [OL[0], OL[3]]];
  const face = selected ? OL[2] : OL[1];
  // Lamp housing on the tab: rounded pill x 2..7, y 7..16 (constant through the stretched rows 10..13).
  const pill = (x, y) => x >= 2 && x <= 7 && y >= 7 && y <= 16 && !((x === 2 || x === 7) && (y === 7 || y === 16));
  const pillRing = (x, y) => pill(x, y) && (!pill(x - 1, y) || !pill(x + 1, y) || !pill(x, y - 1) || !pill(x, y + 1));
  const lens = (x, y) => x >= 4 && x <= 5 && y >= 9 && y <= 14;
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    if (x <= 9) {                                                                        // the stencil tab
      if (x === 0 || x === 9 || y === 0 || y === h - 1) return K;
      const glow = selected && y >= 5 && y <= 18;                                        // lamp light spilling on the rails
      if (x === 1) return glow ? AMBER : selected ? GD[3] : ST[4];
      if (x === 8) return glow ? FI[2] : selected ? GD[1] : ST[1];
      if (y === 1) return selected ? GD[2] : ST[3];
      if (y === h - 2) return selected ? GD[1] : ST[1];
      if (pillRing(x, y)) return K;
      if (lens(x, y)) {
        if (selected) return y === 9 ? FI[4] : y === 14 ? FI[2] : x === 4 ? FI[4] : FI[3];
        return y === 9 && x === 4 ? RD[4] : y === 14 ? RD[0] : x === 4 ? RD[2] : RD[1];
      }
      if (pill(x, y)) { const lt = x === 3 || y === 8; return selected ? (lt ? AMBER : FI[2]) : (lt ? ST[4] : ST[2]); }   // bezel
      const s = STRIPE[(x + y) % 6 < 3 ? 0 : 1];
      if (selected && (y === 6 || y === 17)) return s === STRIPE[0] ? FI[3] : RD[1];      // warm halo next to the lamp
      return s;
    }
    const { d, lit, du } = edge(w, h, x, y);
    if (d === 0) return K;
    if (d <= 3) {
      const sorted = du.slice().sort((a, b) => a - b);
      if (sorted[0] === sorted[1]) return selected ? GD[0] : ST[0];                      // mitred corner seam
    }
    if (d <= 5) return rim[d - 1][lit ? 0 : 1];
    return face;
  });
  // Wear on the tab: stencil paint chipped to bare metal, never in the stretched rows.
  for (let y = 2; y < h - 2; y++) for (let x = 2; x <= 7; x++) {
    if ((y >= 7 && y <= 16) || hash(x, y, selected ? 31 : 30) > .2) continue;
    c.put(x, y, hash(x, y, 32) > .5 ? ST[2] : WD[1]);
  }
  // Riveted corner doublers on the right, rust bleeding from under them, chipped olive paint.
  for (const [ox, oy, sx, sy] of corners(w, h)) {
    if (sx > 0) continue;
    const plate = (x, y) => { const u = (x - ox) * sx, v = (y - oy) * sy; return u >= 0 && v >= 0 && u <= 9 && v <= 9 && u + v <= 11 && !clipped(w, h, x, y); };
    // Chipped paint (bare steel) and rust creeping out from under the doubler, inside the corner only.
    if (!selected) for (let v = 0; v < 10; v++) for (let u = 0; u < 10; u++) {             // the polished plate has none
      const px = ox + sx * u, py = oy + sy * v, cur = c.get(px, py);
      if (!cur || cur === K || plate(px, py) || u + v > 15) continue;
      const t = 1.05 - (u + v) / 13;
      if (dither(px, py, t * (.45 + hash(px, py, 33) * .8))) c.put(px, py, cur === face ? (hash(px, py, 34) > .55 ? ST[3] : RUST[2]) : RUST[(hash(px, py, 35) * 3) | 0]);
    }
    (selected ? brass : steel)(c, plate, 41);
    rivet(c, ox + sx * 2 - (sx < 0 ? 3 : 0), oy + sy * 2 - (sy < 0 ? 3 : 0));
    stud(c, ox + sx * 6 - 1, oy + sy * 2 - (sy < 0 ? 1 : 0));
    stud(c, ox + sx * 2 - 1, oy + sy * 6 - (sy < 0 ? 1 : 0));
    if (!selected) for (const [u, v] of [[5, 8], [8, 5], [9, 2]]) c.put(ox + sx * u, oy + sy * v, RUST[1]);   // rust at the plate seam
  }
  // Rust run-off down the right rim from the top doubler (one column, so it stretches cleanly).
  if (!selected) for (let y = 10; y <= 14; y++) c.put(w - 3, y, y === 14 ? RUST[2] : RUST[3]);
  return c;
}

function menuMarkerFrames() {
  const nudge = [0, 1, 1, 1, 0, 0], sweep = [null, 1, 4, 7, null, null];
  return nudge.map((n, f) => {
    const c = new Canvas(12, 12);
    const tri = (x, y) => y >= 1 && y <= 10 && x >= n && x - n <= 2 * (5 - Math.abs(y - 5.5)) + .5;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (tri(x - 1, y - 1) && !tri(x, y)) c.put(x, y, [20, 23, 15, 110]);   // drop shadow
    brass(c, tri, 7);
    if (sweep[f] !== null) for (let y = 2; y <= 9; y++) for (let x = 1; x <= 10; x++) {
      const cur = c.get(x, y);
      if (tri(x, y) && cur !== K && Math.abs(x - n - sweep[f] + (y - 5.5) * .5) < .8) c.put(x, y, CR[3]);
    }
    return c;
  });
}

function menuFooter() {
  const w = 32, h = 20, c = new Canvas(w, h);
  c.fill((x, y) => {
    if (clipped(w, h, x, y)) return null;
    const { d, lit } = edge(w, h, x, y);
    if (d === 0) return K;
    if (d === 1) return lit ? ST[3] : ST[1];
    if (d === 2) return lit ? ST[2] : ST[1];
    if (d === 3) return ST[0];
    if (d === 4) return lit ? NV[0] : NV[2];
    return NV[1];
  });
  for (const [ox, oy, sx, sy] of corners(w, h)) {
    for (let v = 1; v < 6; v++) for (let u = 1; u < 6; u++) {
      const px = ox + sx * u, py = oy + sy * v, cur = c.get(px, py);
      if (cur && cur !== K && dither(px, py, (.55 - (u + v) / 12) * (.5 + hash(px, py, 51) * .8))) c.put(px, py, RUST[(hash(px, py, 52) * 3) | 0]);
    }
    stud(c, ox + sx * 2 - (sx < 0 ? 1 : 0), oy + sy * 2 - (sy < 0 ? 1 : 0));
  }
  return c;
}

function build(add) {
  const sliced = (name, c, border) => { assertSliceable(name, c, border); add('UI', name, [c], { fps: 1, border }); };
  sliced('ui_slider_track', sliderTrack(), 3);
  add('UI', 'ui_slider_knob', [sliderKnob()], { fps: 1 });
  sliced('ui_save_slot', saveSlot(false), 16);
  sliced('ui_save_slot_selected', saveSlot(true), 16);
  sliced('ui_menu_option', menuOption(false), 10);
  sliced('ui_menu_option_selected', menuOption(true), 10);
  add('UI', 'ui_menu_marker', menuMarkerFrames(), { fps: 10, loop: true });
  sliced('ui_menu_footer', menuFooter(), 6);
}

module.exports = { build };

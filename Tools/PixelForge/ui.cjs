'use strict';
// Interface art: nine-slice panels and buttons, HUD icons, logo, battlefield cards
// and the animated top-down airbase used by the title screen.
const { PAL, LIVERY, K, hex, shift, withAlpha, hash, fbm, tileFbm, dither, Canvas, text5 } = require('./lib.cjs');
const U = require('./units.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, FI, SM, GR, SN, SW, IC, WT } = PAL;

// ---------- nine-slice frames ----------
function box(w, h, { base, light, dark, lightW = 1, darkW = 2, outline = K, sunken = false }) {
  const c = new Canvas(w, h);
  c.fill((x, y) => {
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) return null;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return outline;
    const top = sunken ? dark : light, bottom = sunken ? light : dark;
    if (y <= lightW || x <= lightW) return top;
    if (y >= h - 1 - darkW || x >= w - 1 - darkW) return bottom;
    return base;
  });
  return c;
}
function rivet(c, x, y) { c.put(x, y, CR[1]); c.put(x + 1, y, CR[0]); c.put(x, y + 1, CR[0]); c.put(x + 1, y + 1, K); }

function panel() {
  const c = box(24, 24, { base: hex('#2a3125'), light: hex('#4b5639'), dark: hex('#161a12') });
  for (let i = 3; i < 21; i++) { c.put(i, 3, hex('#20261b')); c.put(3, i, hex('#20261b')); c.put(i, 20, hex('#353e2c')); c.put(20, i, hex('#353e2c')); }
  for (const [x, y] of [[5, 5], [17, 5], [5, 17], [17, 17]]) rivet(c, x, y);
  return c;
}
const BUTTONS = {
  olive: [['#4c573a', '#6f7c52', '#2c3322'], ['#5e6b47', '#8a976a', '#363f29'], ['#3a4330', '#262c1d', '#525c40']],
  gold: [['#cfa443', '#f0d47c', '#8a6620'], ['#e2b955', '#fbe8a2', '#9a7426'], ['#b48a33', '#7d5d1b', '#d8b25a']],
  cream: [['#ddd4b0', '#f3edd6', '#8f8766'], ['#ebe3c2', '#fffaea', '#9d9473'], ['#c7bd98', '#8f8766', '#e4dcbc']],
  red: [['#963826', '#c25a3d', '#5a1d14'], ['#a8442f', '#d36c4c', '#64221a'], ['#7f2e1f', '#4a1810', '#ad4a33']]
};
function button(style, state) {
  const [b, l, d] = BUTTONS[style][state];
  return box(16, 16, { base: hex(b), light: hex(l), dark: hex(d), lightW: state === 2 ? 2 : 1, darkW: state === 2 ? 1 : 2 });
}
function card(selected) {
  const c = box(32, 32, { base: hex(selected ? '#3a3420' : '#232a1f'), light: hex(selected ? '#f0d47c' : '#4a543b'), dark: hex(selected ? '#a07a2a' : '#151912'), lightW: 2, darkW: 2 });
  if (selected) for (const [x, y, dx, dy] of [[4, 4, 1, 1], [27, 4, -1, 1], [4, 27, 1, -1], [27, 27, -1, -1]])
    for (let s = 0; s < 5; s++) { c.put(x + dx * s, y, GD[3]); c.put(x, y + dy * s, GD[3]); }
  return c;
}
const ink = () => box(16, 16, { base: hex('#141812'), light: hex('#30382a'), dark: hex('#080a07'), sunken: true, lightW: 1, darkW: 1 });
const keycap = () => box(14, 14, { base: CR[2], light: CR[3], dark: CR[0], lightW: 1, darkW: 3 });
function plate() { return box(16, 16, { base: hex('#191d15'), light: hex('#2b3224'), dark: hex('#0c0e0a'), lightW: 1, darkW: 1 }); }

// ---------- HUD cells and icons (12x12) ----------
function cell(kind) {
  const c = new Canvas(8, 12);
  const [b, l, d] = kind === 'full' ? [OL[3], OL[4], OL[1]] : kind === 'low' ? [RD[3], RD[4], RD[1]] : [hex('#262c20'), hex('#2f3628'), hex('#1b2016')];
  c.fill((x, y) => x === 0 || y === 0 || x === 7 || y === 11 ? K : y === 1 ? l : y >= 9 ? d : b);
  if (kind !== 'empty') { c.put(2, 3, CR[2]); c.put(5, 3, CR[2]); }
  return c;
}
function icon(kind) {
  const c = new Canvas(12, 12);
  const P = (pts, col) => pts.forEach(([x, y]) => c.put(x, y, col));
  switch (kind) {
    case 'fuel': c.rect(3, 3, 6, 8, RD[2]); c.rect(4, 1, 4, 1, RD[1]); c.put(8, 2, ST[3]); c.line(4, 4, 7, 9, RD[3]); c.line(7, 4, 4, 9, RD[3]); break;
    case 'clock': c.ellipse(6, 6, 5, 5, CR[2]); c.ellipse(6, 6, 4, 4, hex('#1d2219')); c.line(6, 6, 6, 3, CR[3]); c.line(6, 6, 8, 7, GD[2]); break;
    case 'speed': for (const o of [0, 4]) { c.line(2, 7 - o + 2, 5, 4 - o + 2, GD[2]); c.line(6, 4 - o + 2, 9, 7 - o + 2, GD[2]); c.line(2, 8 - o + 2, 5, 5 - o + 2, GD[1]); c.line(6, 5 - o + 2, 9, 8 - o + 2, GD[1]); } break;
    case 'medal': c.rect(3, 0, 2, 4, RD[2]); c.rect(7, 0, 2, 4, RD[2]); c.ellipse(6, 7, 4, 4, GD[2]); c.ellipse(6, 7, 2.2, 2.2, GD[3]); c.put(5, 6, GD[1]); break;
    case 'sound_on': c.rect(1, 4, 3, 4, CR[2]); P([[4, 3], [5, 2], [4, 8], [5, 9]], CR[2]); c.rect(4, 4, 2, 4, CR[2]); P([[7, 4], [7, 7], [8, 5], [8, 6]], GD[2]); P([[9, 2], [10, 4], [10, 5], [10, 6], [10, 7], [9, 9]], GD[2]); break;
    case 'sound_off': c.rect(1, 4, 3, 4, CR[1]); P([[4, 3], [5, 2], [4, 8], [5, 9]], CR[1]); c.rect(4, 4, 2, 4, CR[1]); c.line(7, 4, 10, 7, RD[3]); c.line(10, 4, 7, 7, RD[3]); break;
    case 'pause': c.rect(3, 2, 2, 8, CR[2]); c.rect(7, 2, 2, 8, CR[2]); break;
    case 'armor': c.fill((x, y) => { const w = y < 7 ? 4.5 : 4.5 - (y - 6) * .8; return Math.abs(x + .5 - 6) < w && y > 0 && y < 11 ? (x < 6 ? OL[4] : OL[3]) : null; }); c.put(6, 4, CR[2]); break;
    case 'radio': c.rect(2, 4, 8, 7, OL[3]); c.rect(3, 6, 4, 3, SM[0]); c.put(8, 6, GD[2]); c.put(8, 8, GD[2]); c.line(8, 4, 10, 0, ST[3]); break;
    case 'arrow_right': for (let i = 0; i < 4; i++) { c.line(3 + i, 2 + i, 3 + i, 9 - i, CR[2]); } break;
    case 'arrow_left': for (let i = 0; i < 4; i++) { c.line(8 - i, 2 + i, 8 - i, 9 - i, CR[2]); } break;
    case 'check': c.line(2, 6, 4, 8, OL[1]); c.line(4, 8, 9, 3, OL[1]); c.line(2, 5, 4, 7, K); c.line(4, 7, 9, 2, K); break;
    case 'target': c.ellipse(6, 6, 5, 5, RD[3]); c.ellipse(6, 6, 4, 4, null); c.rect(5, 0, 2, 12, RD[3]); c.rect(0, 5, 12, 2, RD[3]); c.rect(5, 5, 2, 2, null); break;
  }
  return c.outline(K);
}
function pointerFrames() {
  return [0, 1].map(f => { const c = new Canvas(8, 10); for (let i = 0; i < 4; i++) c.line(1 + f + i, 1 + i, 1 + f + i, 8 - i, i === 0 ? GD[3] : GD[2]); return c.outline(K); });
}

// ---------- logo ----------
const LETTERS = {
  W: ['XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX.XX.XX', 'XX.XX.XX', 'XXXXXXXX', 'XXX..XXX', 'XX....XX', 'X......X'],
  O: ['.XXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XXXXXXXX', '.XXXXXX.'],
  R: ['XXXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XXXXXXXX', 'XXXXXXX.', 'XX..XX..', 'XX...XX.', 'XX....XX', 'XX....XX'],
  D: ['XXXXXX..', 'XXXXXXX.', 'XX...XXX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX...XXX', 'XXXXXXX.', 'XXXXXX..'],
  I: ['XXXXXX', 'XXXXXX', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..', 'XXXXXX', 'XXXXXX'],
  N: ['XX....XX', 'XXX...XX', 'XXXX..XX', 'XX.XX.XX', 'XX.XX.XX', 'XX..XXXX', 'XX..XXXX', 'XX...XXX', 'XX....XX', 'XX....XX'],
  G: ['.XXXXXX.', 'XXXXXXXX', 'XX....XX', 'XX......', 'XX..XXXX', 'XX..XXXX', 'XX....XX', 'XX....XX', 'XXXXXXXX', '.XXXXXX.']
};
function logo() {
  const word = 'WORDWING';
  const width = [...word].reduce((a, ch) => a + LETTERS[ch][0].length + 2, 0) + 4;
  const c = new Canvas(width, 34);
  // Winged emblem above the lettering: fictional squadron badge.
  const cx = width / 2, ey = 8;
  for (let row = 0; row < 4; row++) {
    const len = 17 - row * 3, y = ey - 3 + row * 2;
    for (const side of [-1, 1]) for (let s = 0; s < len; s++) {
      const x = Math.floor(cx + side * (6 + s) - (side < 0 ? 1 : 0)), yy = y + Math.floor(s / 6);
      c.put(x, yy, row % 2 ? CR[1] : CR[2]); c.put(x, yy + 1, CR[0]);
    }
  }
  c.ellipse(cx, ey + 1, 5.5, 5.5, CR[2]); c.ellipse(cx, ey + 1, 4, 4, OL[2]); c.ellipse(cx, ey + 1, 1.8, 1.8, GD[3]);
  let x = 2;
  const top = 19, shadow = hex('#3b2a0e');
  const glyph = (ch, ox, oy, colourAt) => LETTERS[ch].forEach((row, yy) => [...row].forEach((b, xx) => { if (b === 'X') c.put(ox + xx, oy + yy, colourAt(yy)); }));
  for (const ch of word) { glyph(ch, x + 1, top + 1, () => shadow); glyph(ch, x + 2, top + 2, () => shadow); x += LETTERS[ch][0].length + 2; }
  x = 2;
  for (const ch of word) { glyph(ch, x, top, yy => yy < 2 ? GD[3] : yy === 5 ? GD[1] : yy < 7 ? GD[2] : GD[1]); x += LETTERS[ch][0].length + 2; }
  return c.outline(K);
}

// ---------- battlefield cards (64x36) ----------
function miniBomber(c, x, y, livery) {
  const m = LIVERY[livery].main;
  c.rect(x, y + 3, 11, 2, m[2]); c.rect(x + 5, y, 1, 9, m[3]); c.rect(x + 3, y + 7, 5, 1, m[2]);
  c.put(x + 2, y + 2, m[1]); c.put(x + 8, y + 2, m[1]); c.put(x + 5, y, GL[2]);
}
function thumbnail(kind) {
  const c = new Canvas(64, 36);
  if (kind === 'jungle') {
    c.fill((x, y) => { const n = fbm(x * .2, y * .2, 3); return n > .62 ? GR[4] : n > .5 ? GR[3] : n > .4 ? GR[2] : GR[1]; });
    for (let y = 0; y < 36; y++) { const rx = 20 + Math.sin(y * .22) * 6; for (let x = Math.floor(rx); x < rx + 5; x++) c.put(x, y, x === Math.floor(rx) ? SN[1] : WT[3]); }
    for (let k = 0; k < 18; k++) { const tx = Math.floor(hash(k, 1, 4) * 60), ty = Math.floor(hash(k, 2, 4) * 32); if (Math.abs(tx - 22) > 6) { c.ellipse(tx + 2, ty + 2, 2.5, 2.5, GR[0]); c.ellipse(tx + 1.5, ty + 1.5, 2, 2, GR[4]); c.put(tx + 1, ty + 1, GR[5]); } }
    miniBomber(c, 44, 8, 'jungle');
  } else if (kind === 'desert') {
    c.fill((x, y) => { const d = Math.sin(x * .18 + y * .35 + fbm(x * .1, y * .1, 5) * 4); return d > .7 ? SN[4] : d > .1 ? SN[3] : d > -.6 ? SN[2] : SN[1]; });
    for (let x = 0; x < 64; x++) { const ry = 26 + Math.round(Math.sin(x * .08) * 2); c.put(x, ry, WD[1]); c.put(x, ry + 1, WD[2]); }
    c.ellipse(10, 9, 2, 2, GR[2]); c.put(10, 8, GR[4]);
    miniBomber(c, 40, 6, 'desert');
  } else if (kind === 'ice') {
    c.fill((x, y) => { const n = fbm(x * .15, y * .15, 8); return n > .6 ? SW[3] : n > .45 ? SW[2] : SW[1]; });
    c.ellipse(16, 22, 10, 6, IC[2]); c.ellipse(16, 22, 8, 4.5, IC[3]);
    for (let k = 0; k < 14; k++) { const tx = Math.floor(hash(k, 3, 9) * 62), ty = Math.floor(hash(k, 4, 9) * 32); if (Math.hypot(tx - 16, (ty - 22) * 1.6) > 12) { c.put(tx, ty, GR[1]); c.put(tx - 1, ty + 1, GR[1]); c.put(tx, ty + 1, GR[2]); c.put(tx + 1, ty + 1, GR[1]); c.put(tx, ty + 2, WD[0]); } }
    miniBomber(c, 42, 7, 'ice');
  } else {
    c.fill((x, y) => { const n = fbm(x * .18, y * .3, 12); return n > .64 ? WT[4] : n > .5 ? WT[3] : WT[2]; });
    for (let k = 0; k < 20; k++) { const wx = Math.floor(hash(k, 5, 2) * 60), wy = Math.floor(hash(k, 6, 2) * 34); c.put(wx, wy, WT[5]); c.put(wx + 1, wy, WT[5]); }
    c.ellipse(8, 28, 6, 4, SN[3]); c.ellipse(8, 28, 4.5, 3, GR[3]);
    c.rect(28, 6, 5, 24, WD[2]); c.rect(28, 6, 5, 1, WD[0]); for (let y = 8; y < 28; y += 3) c.put(30, y, CR[2]); c.rect(32, 14, 2, 5, NV[3]);
    miniBomber(c, 46, 14, 'ocean');
  }
  // Frame and vignette edge.
  return c.fill((x, y, col) => (x === 0 || y === 0 || x === 63 || y === 35) ? K : (x === 1 || y === 1) ? shift(col, 1) : (x === 62 || y === 34) ? shift(col, -1) : undefined);
}

// ---------- title airbase (360x225, top-down, 4 frames) ----------
function airbase(frame) {
  const W = 360, H = 225, c = new Canvas(W, H);
  c.fill((x, y) => {
    const n = fbm(x * .06, y * .06, 21), m = fbm(x * .4, y * .4, 22);
    let i = n > .62 ? 4 : n > .48 ? 3 : n > .36 ? 2 : 1;
    if (x > 120 && x < 210 && ((x + y >> 3) & 1)) i = Math.min(5, i + (m > .5 ? 1 : 0));
    return m > .72 ? GR[i + 1 > 5 ? 5 : i + 1] : m < .2 ? GR[i - 1] : GR[i];
  });
  const shadow = [8, 18, 4, 105];
  const shade = (x, y, w, h) => c.rect(x + 3, y + 3, w, h, shadow, true);
  // Dirt road from the south-east corner to the apron.
  for (let t = 0; t <= 1; t += .002) {
    const x = 360 - t * 250, y = 225 - Math.sin(t * Math.PI * .5) * 70;
    for (let k = -3; k <= 3; k++) c.put(x, y + k, Math.abs(k) === 3 ? WD[1] : hash(Math.floor(x), Math.floor(y + k), 3) < .2 ? WD[1] : WD[2]);
  }
  // Concrete apron with expansion joints.
  for (let y = 92; y < 182; y++) for (let x = 36; x < 140; x++) c.put(x, y, (x % 13 === 0 || y % 13 === 0) ? ST[2] : hash(x, y, 7) < .08 ? ST[2] : ST[3]);
  // Runway: asphalt, edge lines, centre dashes, threshold bars, tyre marks.
  for (let y = 0; y < H; y++) for (let x = 140; x < 186; x++) {
    let col = hash(x, y, 2) < .1 ? ST[0] : hash(x, y, 5) < .06 ? ST[2] : ST[1];
    if (x === 142 || x === 183) col = CR[1];
    if ((x === 162 || x === 163) && y % 16 < 8) col = CR[2];
    if ((y < 14 || y > 208) && y % 2 === 0 && x > 145 && x < 181 && (x - 146) % 5 < 3 && (y < 4 || y > 220 || y % 14 < 12)) col = CR[2];
    if (y > 186 && y < 206 && (x === 156 || x === 157 || x === 168 || x === 169) && hash(y, x, 1) < .6) col = ST[0];
    c.put(x, y, col);
  }
  for (let y = 4; y < H; y += 14) for (const x of [139, 186]) { const lit = (Math.floor(y / 14) + frame) % 4 === 0; c.put(x, y, lit ? FI[4] : GD[1]); if (lit) { c.paint(x - 1, y, withAlpha(FI[3], 120)); c.paint(x + 1, y, withAlpha(FI[3], 120)); } }
  // Taxi line from apron to runway centre.
  for (let x = 100; x < 162; x++) c.put(x, 150, GD[2]);
  // Two curved-roof hangars.
  const hangar = (hx, hy, w, h) => {
    shade(hx, hy, w, h);
    for (let y = hy; y < hy + h; y++) for (let x = hx; x < hx + w; x++) {
      const t = Math.abs((x - hx + .5) / w - .5) * 2, ring = (y - hy) % 3 === 0;
      let col = t < .25 ? ST[4] : t < .55 ? ST[3] : t < .82 ? ST[2] : ST[1];
      if (ring) col = shift(col, -1);
      c.put(x, y, col);
    }
    c.rect(hx + 3, hy + h - 2, w - 6, 2, SM[0]);
    for (let x = hx; x < hx + w; x++) { c.put(x, hy - 1, K); c.put(x, hy + h, K); }
    for (let y = hy; y < hy + h; y++) { c.put(hx - 1, y, K); c.put(hx + w, y, K); }
  };
  hangar(14, 44, 44, 40); hangar(68, 38, 50, 46);
  // Control tower with rotating beacon.
  shade(120, 100, 14, 14); c.rect(120, 100, 14, 14, CR[1]); c.rect(122, 102, 10, 10, GL[1]); c.rect(124, 104, 6, 6, CR[2]);
  c.put(126 + (frame % 2), 106 + (frame >> 1), frame % 2 ? RD[4] : FI[4]);
  // Parked fighters on the apron (same sprite as the player, at scene scale).
  const parked = U.fighterBody(1, 0);
  for (const [px, py] of [[44, 120], [80, 124]]) { c.blit(parked.silhouette([0, 0, 0, 80]), px + 4, py + 5); c.blit(parked, px, py); }
  // Fuel drums and a fuel truck.
  for (let k = 0; k < 6; k++) { const dx = 110 + (k % 3) * 5, dy = 160 + Math.floor(k / 3) * 5; c.ellipse(dx + 2, dy + 2, 2, 2, RD[2]); c.put(dx + 1, dy + 1, RD[4]); }
  shade(44, 160, 22, 9); c.rect(44, 160, 22, 9, OL[2]); c.rect(44, 160, 6, 9, OL[3]); c.rect(46, 161, 3, 3, GL[1]); c.rect(52, 161, 13, 7, RD[2]); c.rect(52, 161, 13, 1, RD[3]);
  // Tents, sandbagged AA pit, windsock and tree lines.
  for (const [tx, ty] of [[196, 60], [196, 84], [196, 108], [214, 72]]) {
    shade(tx, ty, 16, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) c.put(tx + x, ty + y, x < 8 ? OL[3] : OL[2]);
    c.line(tx + 8, ty, tx + 8, ty + 11, OL[1]); c.rect(tx + 6, ty + 11, 4, 1, SM[0]);
  }
  for (const [cx, cy] of [[26, 204], [218, 168]]) {
    for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2; c.ellipse(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8, 2, 1.6, a % 2 ? SN[3] : SN[2]); }
    c.ellipse(cx, cy, 5, 5, GR[1]); c.rect(cx - 1, cy - 1, 3, 3, ST[1]); c.line(cx, cy, cx + 5, cy - 6, ST[0]);
  }
  c.rect(200, 34, 1, 8, ST[3]);
  for (let s = 0; s < 8; s++) c.put(201 + s, 34 + Math.round(Math.sin(s * .7 + frame * 1.4) * .9), (s >> 1) % 2 ? CR[3] : FI[2]);
  const tree = (tx, ty, r) => {
    c.ellipse(tx + 3, ty + 3, r, r, shadow, true);
    c.ellipse(tx, ty, r, r, GR[1]); c.ellipse(tx - r * .2, ty - r * .2, r * .75, r * .75, GR[3]); c.ellipse(tx - r * .35, ty - r * .35, r * .35, r * .35, GR[5]);
  };
  for (let k = 0; k < 90; k++) {
    const tx = hash(k, 1, 31) * W, ty = hash(k, 2, 31) * H, r = 3 + hash(k, 3, 31) * 4;
    const clear = (tx > 6 && tx < 232 && ty > 30 && ty < 186) || (tx > 132 && tx < 194) || (ty > 190 && tx < 60);
    if (!clear) tree(tx, ty, r);
  }
  return c;
}
function clouds() {
  const W = 360, H = 225, c = new Canvas(W, H);
  return c.fill((x, y) => {
    const n = tileFbm(x, y, W, H, 41, 2.2);
    const s = tileFbm((x - 18 + W) % W, (y - 26 + H) % H, W, H, 41, 2.2);
    if (n > .67) return dither(x, y, (n - .67) * 8) ? withAlpha(n > .72 ? CR[3] : SW[3], 130) : withAlpha(SW[2], 55);
    if (s > .67 && dither(x, y, .5)) return [6, 14, 4, 55];
    return null;
  });
}

function build(add) {
  add('UI', 'ui_panel', [panel()], { fps: 1, border: 8 });
  add('UI', 'ui_ink', [ink()], { fps: 1, border: 4 });
  add('UI', 'ui_plate', [plate()], { fps: 1, border: 4 });
  add('UI', 'ui_keycap', [keycap()], { fps: 1, border: 5 });
  add('UI', 'ui_card', [card(false)], { fps: 1, border: 10 });
  add('UI', 'ui_card_selected', [card(true)], { fps: 1, border: 10 });
  for (const style of Object.keys(BUTTONS)) add('UI', 'ui_button_' + style, [0, 1, 2].map(s => button(style, s)), { fps: 1, border: 5 });
  for (const kind of ['full', 'low', 'empty']) add('UI', 'ui_cell_' + kind, [cell(kind)], { fps: 1 });
  for (const kind of ['fuel', 'clock', 'speed', 'medal', 'sound_on', 'sound_off', 'pause', 'armor', 'radio', 'arrow_right', 'arrow_left', 'check', 'target'])
    add('UI', 'icon_' + kind, [icon(kind)], { fps: 1 });
  add('UI', 'ui_pointer', pointerFrames(), { fps: 3 });
  add('Title', 'logo', [logo()], { fps: 1 });
  for (const kind of ['jungle', 'desert', 'ice', 'ocean']) add('Title', 'card_' + kind, [thumbnail(kind)], { fps: 1 });
  add('Title', 'title_airbase', [0, 1, 2, 3].map(airbase), { fps: 3 });
  add('Title', 'title_clouds', [clouds()], { fps: 1 });
}

module.exports = { build };

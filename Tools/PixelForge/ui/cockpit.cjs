'use strict';
// UI: cockpit instrument panel. COCKPIT must match FlightView (C#), see Docs/map/ops/sync-constants.md.
const { PAL, K, hex, shift, withAlpha, hash, Canvas, text5 } = require('../lib.cjs');
const { OL, CR, GD, ST, RD } = PAL;
const { box } = require('./widgets.cjs');

// ---------- cockpit instrument panel (720x124, shown at 2x = 1440x248) ----------
// Layout in art pixels; FlightView.cs places its UI at exactly twice these numbers (keep in sync).
const COCKPIT = {
  fuel: [42, 48], speed: [582, 48], clock: [644, 48], gaugeR: 28,
  lamps: { x: 82, y: 24, step: 17, size: 14 }, placard: [78, 43, 168, 76],
  roll: [14, 83, 168, 111], crt: [180, 18, 540, 77], input: [180, 83, 426, 111], pos: [432, 83, 540, 111],
  lever: [678, 18, 710, 76], fire: [554, 83, 712, 111]
};
const FACE = hex('#1f221d');
function screw(c, x, y) { c.put(x, y, ST[3]); c.put(x + 1, y, ST[2]); c.put(x, y + 1, ST[2]); c.put(x + 1, y + 1, ST[1]); c.put(x + 1, y, ST[0]); }
function recess(c, x0, y0, x1, y1, fill = hex('#0c0e0b')) {
  c.rect(x0, y0, x1 - x0, y1 - y0, fill);
  for (let x = x0; x < x1; x++) { c.put(x, y0, K); c.put(x, y1 - 1, hex('#3a4036')); }
  for (let y = y0; y < y1; y++) { c.put(x0, y, K); c.put(x1 - 1, y, hex('#3a4036')); }
}
function plateArea(c, x0, y0, x1, y1) {
  c.fill((x, y, col) => x >= x0 && x < x1 && y >= y0 && y < y1 ? (hash(x, y, 61) < .1 ? hex('#262a24') : hash(x, y, 62) < .08 ? hex('#191c17') : FACE) : undefined);
  for (let x = x0; x < x1; x++) { c.put(x, y0, hex('#3d4339')); c.put(x, y1 - 1, hex('#0f110e')); }
  for (let y = y0; y < y1; y++) { c.put(x0, y, hex('#3d4339')); c.put(x1 - 1, y, hex('#0f110e')); }
  for (const [x, y] of [[x0 + 2, y0 + 2], [x1 - 4, y0 + 2], [x0 + 2, y1 - 4], [x1 - 4, y1 - 4]]) screw(c, x, y);
}
const polar = (cx, cy, deg, r) => [cx + Math.sin(deg * Math.PI / 180) * r, cy - Math.cos(deg * Math.PI / 180) * r];
function gauge(c, [cx, cy], kind) {
  const R = COCKPIT.gaugeR;
  for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
    const d = Math.hypot(x + .5, y + .5);
    if (d > R) continue;
    const l = -(x * .6 + y * .8) / R;
    c.put(cx + x, cy + y, d > R - 1 ? K : d > R - 3 ? (l > .2 ? ST[3] : l > -.3 ? ST[2] : ST[1]) : d > R - 4 ? K : hex('#111310'));
  }
  const tick = (deg, len, col) => { for (let s = 0; s < len; s++) { const [x, y] = polar(cx, cy, deg, R - 6 - s); c.put(x, y, col); } };
  if (kind === 'clock') {
    for (let i = 0; i < 60; i++) tick(i * 6, i % 5 === 0 ? 3 : 1, i % 5 === 0 ? CR[3] : CR[1]);
    text5(c, '12', cx - 4, cy - 19, CR[2]); text5(c, '3', cx + 13, cy - 2, CR[2]); text5(c, '6', cx - 1, cy + 14, CR[2]); text5(c, '9', cx - 16, cy - 2, CR[2]);
  } else {
    for (let i = 0; i <= 20; i++) {
      const deg = -135 + i * 13.5;
      const col = kind === 'fuel' && i <= 3 ? RD[3] : kind === 'speed' && i >= 18 ? RD[3] : i % 5 === 0 ? CR[3] : CR[1];
      tick(deg, i % 5 === 0 ? 4 : 2, col);
    }
    if (kind === 'fuel') { text5(c, 'E', cx - 14, cy + 10, RD[4]); text5(c, 'F', cx + 12, cy + 10, CR[3]); }
    else { text5(c, '100', cx - 19, cy + 9, CR[2]); text5(c, '150', cx + 8, cy + 9, RD[4]); text5(c, '125', cx - 5, cy - 16, CR[2]); }
  }
  for (let a = 200; a < 300; a += 4) { const [x, y] = polar(cx, cy, a, R - 5); c.paint(x, y, [255, 255, 255, 40]); }
  for (const a of [45, 135, 225, 315]) { const [x, y] = polar(cx, cy, a, R + 2); screw(c, Math.round(x) - 1, Math.round(y) - 1); }
}
function cockpit() {
  const W = 720, H = 124, c = new Canvas(W, H);
  // Interior-green airframe behind black crackle-finish instrument plates.
  c.fill((x, y) => hash(x, y, 60) < .12 ? OL[1] : OL[2]);
  for (let y = 0; y < 13; y++) for (let x = 0; x < W; x++) {
    const col = y === 0 || y === 12 ? K : y < 3 ? hex('#5a4330') : y < 10 ? (hash(x, y, 63) < .15 ? hex('#3f2d1b') : hex('#46331f')) : hex('#2a1d12');
    c.put(x, y, col);
  }
  for (let x = 2; x < W; x += 4) c.put(x, 10, CR[0]);
  plateArea(c, 6, 15, 174, 118); plateArea(c, 176, 15, 546, 118); plateArea(c, 548, 15, 716, 118);
  for (let x = 0; x < W; x++) { c.put(x, 118, OL[3]); c.put(x, 123, K); }
  for (let x = 12; x < W; x += 60) screw(c, x, 120);
  gauge(c, COCKPIT.fuel, 'fuel'); gauge(c, COCKPIT.speed, 'speed'); gauge(c, COCKPIT.clock, 'clock');
  // Armour warning-lamp sockets.
  for (let i = 0; i < 5; i++) {
    const x = COCKPIT.lamps.x + i * COCKPIT.lamps.step - 1, y = COCKPIT.lamps.y - 1;
    c.ellipse(x + 8, y + 8, 8, 8, ST[1]); c.ellipse(x + 8, y + 8, 7, 7, K);
  }
  // Brass data placard for supply status.
  const [px0, py0, px1, py1] = COCKPIT.placard;
  c.rect(px0, py0, px1 - px0, py1 - py0, hex('#3a3120'));
  for (let x = px0; x < px1; x++) { c.put(x, py0, GD[1]); c.put(x, py1 - 1, hex('#1e180c')); }
  for (let y = py0; y < py1; y++) { c.put(px0, y, GD[1]); c.put(px1 - 1, y, hex('#1e180c')); }
  screw(c, px0 + 2, py0 + 2); screw(c, px1 - 4, py0 + 2); screw(c, px0 + 2, py1 - 4); screw(c, px1 - 4, py1 - 4);
  // Radar-style decoder screen: rounded bezel, phosphor glass with grid and scanlines.
  const [sx0, sy0, sx1, sy1] = COCKPIT.crt;
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
    const ex = Math.min(x - sx0, sx1 - 1 - x), ey = Math.min(y - sy0, sy1 - 1 - y);
    if (ex + ey < 3) continue;
    const inner = ex >= 5 && ey >= 5 && ex + ey >= 9;
    if (!inner) { c.put(x, y, ex === 0 || ey === 0 || ex + ey === 3 ? K : (y - sy0 < 3 || x - sx0 < 3) ? ST[2] : ST[1]); continue; }
    const vig = Math.min(ex, ey * 2.6) / 24;
    let col = vig < .25 ? hex('#08140b') : vig < .6 ? hex('#0b1a0f') : hex('#0d2012');
    if ((x - sx0) % 24 === 12 || (y - sy0) % 12 === 6) col = hex('#123220');
    if ((y - sy0) % 2) col = shift(col, 0) && [col[0] * .8 | 0, col[1] * .8 | 0, col[2] * .8 | 0, 255];
    c.put(x, y, col);
  }
  recess(c, ...COCKPIT.input); recess(c, ...COCKPIT.pos); recess(c, ...COCKPIT.roll);
  // Hazard stripes around the trigger recess.
  const [fx0, fy0, fx1, fy1] = COCKPIT.fire;
  for (let y = fy0 - 3; y < fy1 + 3; y++) for (let x = fx0 - 3; x < fx1 + 3; x++) if (((x + y) >> 2) % 2) c.put(x, y, GD[2]); else c.put(x, y, K);
  recess(c, fx0, fy0, fx1, fy1);
  recess(c, ...COCKPIT.lever);
  return c;
}
function needleFrames() {
  return Array.from({ length: 48 }, (_, f) => {
    const c = new Canvas(56, 56), deg = f * 7.5;
    const [tx, ty] = polar(28, 28, deg, 21), [mx, my] = polar(28, 28, deg, 15), [bx, by] = polar(28, 28, deg + 180, 5);
    c.line(bx, by, 28, 28, CR[1]); c.line(28, 28, mx, my, CR[3]); c.line(mx, my, tx, ty, RD[4]);
    c.outline(withAlpha(K, 200));
    c.rect(27, 27, 2, 2, ST[3]); c.put(27, 27, ST[4]);
    return c;
  });
}
function lamp(kind) {
  const c = new Canvas(14, 14);
  const L = { green: [hex('#1f4a24'), hex('#3c9a46'), hex('#8fe08a')], amber: [hex('#5a3a0c'), GD[2], GD[3]], red: [RD[1], RD[3], RD[4]], off: [hex('#141712'), hex('#222620'), hex('#2e332b')] }[kind];
  c.ellipse(7, 7, 6, 6, ST[2]); c.ellipse(7, 7, 5, 5, L[0]); c.ellipse(7, 7, 4, 4, L[1]); c.ellipse(6, 6, 2, 2, L[2]);
  if (kind !== 'off') c.put(5, 5, PAL.WHITE);
  return c.outline(K);
}
function leverFrames() {
  return [8, 28, 49].map(ky => {
    const c = new Canvas(32, 58);
    c.rect(14, 4, 4, 50, K); c.rect(15, 5, 2, 48, hex('#2a2e27'));
    for (const y of [6, 51]) c.rect(10, y, 12, 1, ST[2]);
    c.rect(15, Math.min(ky, 29), 2, Math.abs(ky - 29) + 1, ST[3]);
    c.ellipse(16, ky, 7, 6, RD[1]); c.ellipse(16, ky, 6, 5, RD[3]); c.ellipse(14.5, ky - 1.5, 2.5, 2, RD[4]); c.put(13, ky - 2, PAL.WHITE);
    return c.outline(K);
  });
}
function inputFrame(focus) {
  const c = box(16, 16, { base: hex('#120e07'), light: ST[1], dark: ST[3], sunken: true, lightW: 1, darkW: 1 });
  if (focus) for (let i = 2; i < 14; i++) { c.put(i, 2, GD[2]); c.put(i, 13, GD[1]); c.put(2, i, GD[2]); c.put(13, i, GD[1]); }
  return c;
}

module.exports = {
  cockpit, needleFrames, lamp, leverFrames, inputFrame
};

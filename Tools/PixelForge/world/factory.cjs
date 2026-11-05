'use strict';
// World models: aircraft factory complex — assembly halls, wing/engine/dope shops, boiler house,
// works office, gate, alloy stores, canteen (bld_factory_*), assembly jigs (prop_jig_*) and
// goliath cranes (prop_gantry*). Brick + steel 1944 works, sawtooth north-light roofs, camouflage.
const { PAL, ramp, hash, fbm, shift } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, GR } = PAL;
const {
  BR, WH, CN, TN, DT, TP, PT, cl, uv, ix, flat, glow, tin, planks, brick, sandbag, canvasMat,
  concrete, rooftile, glass, darkGlass, interior, steel, darkSteel, rubber, woodDark, woodPost,
  trimWhite, trimGreen, redPaint, lampGlow, blackPaint, windowOn, doorOn, def, tarpaper,
  gableRoofX, stripes, railing, smokeOverlay, leaf, roundelRows, roundelPal
} = require('./common.cjs');

// ---------------- Local ramps / materials ----------------
const AL = ramp('#3b4448', '#5d696e', '#86939a', '#b0bcc0', '#d9e2e2');   // bare aluminium
const YL = ramp('#5a4012', '#8a6619', '#b98d27', '#dcb246', '#f0d47c');   // crane yellow
const alu = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return cl(AL, 3 + ((((ix(u) % 9) + 9) % 9) === 0 ? -1 : 0) + (hash(ix(u / 3), ix(v / 5), 11) < .12 ? -1 : 0)); });
const aluFlat = flat(AL[3]);
const yellow = mat((x, y, z, f) => cl(YL, 3 + (hash(ix(x), ix(y) + ix(z) * 7, 4) < .07 ? -1 : 0)));
const hazard = stripes(YL[3], TP[1], 3);
const dkSteel = flat(ST[1]), midSteel = flat(ST[2]), ltSteel = flat(ST[3]);
const coping = flat(CN[4]);
const soot = flat(TP[1]);

// Camouflage blotches (olive / earth / green) on corrugated tin; patches follow screen space so
// they flow across faces.
function camoTin(i = 3, s = 1, sc = .028) {
  return mat((x, y, z, f) => {
    const n = fbm(x * sc + s, (y - z) * sc, 70 + s);
    const [R, b] = n > .6 ? [DT, i] : n < .42 ? [GR, i] : [OL, i - 1];
    const u = f === 'e' || f === 'w' ? y : x;
    let k = (((ix(u) % 3) + 3) % 3) === 0 ? 1 : 0;
    if (hash(ix(u), ix((y - z) / 3), s) < .05) k -= 1;
    return cl(R, b + k);
  });
}
// Rain streaks below zTop and a dirty band at the foot of a wall.
function grime(m, zTop, s = 1, amt = .16) {
  return mat((x, y, z, f) => {
    const c = m.fn(x, y, z, f);
    if (!c || f === 'u' || f === 'd') return c;
    const cu = ix(uv(x, y, z, f)[0] / 2);
    if (z < 3 + hash(cu, 3, s) * 4) return shift(c, -1);
    if (hash(cu, 0, 90 + s) < amt && z > zTop - 4 - hash(cu, 1, 91 + s) * 22) return shift(c, -1);
    return c;
  }, { flat: m.flat });
}
// Small-pane steel factory glazing.
const paneGlass = mat((x, y, z, f) => {
  const [u, v] = uv(x, y, z, f);
  if ((((ix(u) % 4) + 4) % 4) === 0 || (((ix(v) % 5) + 5) % 5) === 0) return ST[1];
  const d = (((ix(u) - ix(v)) % 13) + 13) % 13;
  if (d < 2) return GL[3];
  return hash(ix(u / 4), ix(v / 5), 7) < .14 ? GL[2] : hash(ix(u / 4), ix(v / 5), 8) < .06 ? ST[2] : GL[1];
}, { flat: true });
const bigWin = (g, face, a, p, z, w, h, frame = coping) => windowOn(g, face, a, p, z, w, h, { frame, glass: paneGlass, bars: false });

// Face helper: t runs along the wall, d outward from the wall plane p (d = 1 is the first
// voxel outside), z up. s/n: t = x; e/w: t = y.
function face(g, f, p) {
  const put = (t, d, z, m) => { if (f === 's') g.set(t, p + d, z, m); else if (f === 'n') g.set(t, p - d, z, m); else if (f === 'e') g.set(p + d, t, z, m); else g.set(p - d, t, z, m); };
  const box = (t0, t1, d0, d1, z0, z1, m) => { for (let z = Math.round(z0); z < Math.round(z1); z++) for (let d = Math.round(d0); d < Math.round(d1); d++) for (let t = Math.round(t0); t < Math.round(t1); t++) put(t, d, z, m); };
  return { put, box };
}
// Rain-water downpipe with hopper head and shoe.
function downpipe(g, f, t, p, zTop) {
  const F = face(g, f, p);
  F.box(t, t + 2, 1, 2, 1, zTop, darkSteel);
  F.box(t - 1, t + 3, 1, 3, zTop - 3, zTop, midSteel);
  F.box(t - 1, t + 2, 1, 3, 0, 1, darkSteel);
}
// Gooseneck lamp on a wall.
function wallLamp(g, f, t, p, z) {
  const F = face(g, f, p);
  F.box(t, t + 1, 1, 4, z, z + 1, darkSteel); F.box(t, t + 1, 1, 2, z - 2, z, darkSteel);
  F.box(t - 1, t + 2, 3, 6, z - 1, z, flat(OL[2])); F.put(t, 4, z - 2, lampGlow); F.put(t, 5, z - 2, lampGlow);
}
// Straight external steel stair along a wall, rising toward +t to a landing at zTop.
function extStair(g, f, t0, p, zTop, w = 6) {
  const F = face(g, f, p), n = Math.ceil(zTop / 4);
  for (let k = 0; k < n; k++) F.box(t0 + k * 4, t0 + k * 4 + 4, 1, w + 1, k * 4 + 3, k * 4 + 4, midSteel);
  const tl = t0 + n * 4;
  F.box(tl, tl + 8, 1, w + 1, zTop - 1, zTop + 1, midSteel);
  for (let k = 0; k <= n; k++) { const t = t0 + k * 4, z = k * 4 + 3; F.box(t, t + 1, w, w + 1, z, z + 8, darkSteel); }
  for (let k = 0; k < n * 4; k++) { const z = k + 3; F.put(t0 + k, w, z + 7, ltSteel); F.put(t0 + k, w, z, darkSteel); }
  F.box(tl, tl + 8, w, w + 1, zTop + 6, zTop + 7, ltSteel); F.box(tl + 7, tl + 8, 1, w + 1, zTop + 6, zTop + 7, ltSteel);
  for (const t of [tl + 1, tl + 7]) F.box(t, t + 1, w - 1, w, 0, zTop - 1, darkSteel);
}
// Rotating roof ventilator (cowl).
function cowl(g, x, y, z, h = 4) {
  g.box(x - 2, y - 2, z, x + 3, y + 3, z + 1, darkSteel);
  g.cylZ(x + .5, y + .5, 1.6, z + 1, z + h, midSteel);
  g.ell(x + .5, y + .5, z + h + 1, 3, 3, 2.2, flat(AL[3]));
  g.set(x, y, z + h + 3, darkSteel);
}
// Grass tufts and weeds along a rectangle's outline (ground z = gz).
function tufts(g, x0, y0, x1, y1, s = 1, gz = 1, dens = .45) {
  const a = leaf(3, s), b = leaf(4, s + 2);
  const put = (x, y) => {
    if (fbm(x * .15, y * .15, 80 + s) < .45 || hash(x, y, s) > dens) return;
    const h = 1 + ix(hash(x, y, s + 1) * 3.4);
    for (let z = gz; z < gz + h; z++) g.set(x, y, z, z === gz + h - 1 ? b : a);
  };
  for (let x = x0; x < x1; x++) for (const d of [0, 1, 2]) { put(x, y1 + d); put(x, y0 - 1 - d); }
  for (let y = y0; y < y1; y++) for (const d of [0, 1, 2]) { put(x1 + d, y); put(x0 - 1 - d, y); }
}
// Fuselage along x: nose at x0, tail at x1, centre line (cy, cz), radius r. skin(x, y, z, t, d, rr)
// may hollow it out (formers/stringers). Tail rises.
function fuselageX(g, x0, x1, cy, cz, r, m, skin) {
  g.shape(x0, cy - r - 1, cz - r - 1, x1, cy + r + 1, cz + r * 1.6, (x, y, z) => {
    const t = (x - x0) / (x1 - x0);
    const k = t < .16 ? .62 + t * 2.4 : t < .5 ? 1 : 1 - (t - .5) * 1.5;
    const rr = r * k, zc = cz + (t > .5 ? (t - .5) * r * 1.1 : 0);
    const d = Math.hypot(y - cy, (z - zc) * 1.05);
    if (d > rr) return false;
    return skin ? skin(x, y, z, t, d, rr, zc) : true;
  }, m);
}
// Open frame: former rings every `step` and 8 stringers.
const skeleton = (x0, cy, step = 6) => (x, y, z, t, d, rr, zc) => {
  if (d < rr - 1.3) return false;
  if ((((ix(x - x0) % step) + step) % step) === 0) return true;
  const a = Math.atan2(z - zc, y - cy) / (Math.PI / 3);
  return Math.abs(a - Math.round(a)) < .5 / Math.max(1, rr * .5);
};
// Half-built fuselage: olive-over-aluminium skin to tSkin, zinc-chromate frames behind it,
// glazed canopy on the spine; nothing past xMax.
const ZC = ramp('#4f5418', '#7a8226', '#a6ad3c', '#c9cf62', '#e2e59a'); // zinc-chromate primer
const primer = flat(ZC[2]), olTop = flat(OL[2]), cavity = flat(ST[0]);
const lit = m => mat(m.fn, { flat: m.flat, noShadow: true }); // indoor props: keep shape shading, no roof shadow
const fuselageSkin = (x0, cy, tSkin, xMax = 1e9, step = 5, indoor = false) => {
  const frame = skeleton(x0, cy, step), [O, A, P, C] = indoor ? [lit(olTop), lit(alu), lit(primer), lit(cavity)] : [olTop, alu, primer, cavity];
  return (x, y, z, t, d, rr, zc) => {
    if (x >= xMax) return false;
    if (t < tSkin) {
      if (t > .22 && t < .36 && z > zc + rr * .55 && Math.abs(y - cy) < rr * .55) return (ix(x) % 4 === 0 ? dkSteel : glass);
      return z > zc + 1 ? O : A;
    }
    return frame(x, y, z, t, d, rr, zc) ? P : d < rr - 3 && d > rr - 4.2 ? C : false;
  };
};
// Radial engine face (axis along x, facing -x).
function radialX(g, x, cy, cz, r) {
  g.cylX(cy, cz, r, x, x + 3, flat(OL[2]));
  g.cylX(cy, cz, r - 1.4, x - .5, x + 1, darkSteel);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; g.set(x - 1, cy + Math.cos(a) * (r - 2.5), cz + Math.sin(a) * (r - 2.5), ltSteel); }
  g.cylX(cy, cz, 1.4, x - 3, x, midSteel);
}

// ===== Main assembly hall: 18x12, brick + steel piers, six north-light sawtooth bays with camouflaged
// tin, tall central portal with the giant sliding doors half open on a fuselage in its jig.
def('bld_factory_assembly', 'World', [18, 12], 112, g => {
  const wall = grime(brick(BR, 2), 62, 1), plinth = brick(BR, 1), pier = brick(BR, 3);
  const X0 = 24, X1 = 280, Y0 = 30, Y1 = 180, ZW = 62;
  g.box(0, 18, 0, 288, 192, 1, concrete(CN, 2, 32));
  g.box(196, 0, 0, 220, 30, 1, concrete(CN, 1, 12));
  // Railway siding into the back door.
  for (let y = 0; y < 30; y += 3) g.box(198, y, 1, 218, y + 2, 2, woodDark);
  for (const x of [202, 213]) g.box(x, 0, 2, x + 1, 30, 3, ltSteel);
  // Shell.
  g.box(X0, Y0, 1, X1, Y1, 10, plinth);
  g.box(X0, Y0, 10, X1, Y1, ZW, wall);
  g.box(X0 - 1, Y0 - 1, 9, X1 + 1, Y1 + 1, 11, coping);
  g.box(X0 - 1, Y0 - 1, ZW - 3, X1 + 1, Y1 + 1, ZW, coping);
  // Piers every 32 px with concrete caps.
  for (let x = X0; x <= X1 - 4; x += 32) for (const [y0, y1] of [[Y0 - 2, Y0], [Y1, Y1 + 2]]) { g.box(x, y0, 1, x + 4, y1, ZW - 3, pier); g.box(x - 1, y0 - (y0 < Y0 ? 1 : 0), ZW - 4, x + 5, y1 + (y1 > Y1 ? 1 : 0), ZW - 2, coping); }
  for (let y = Y0; y <= Y1 - 4; y += 30) for (const [x0, x1] of [[X0 - 2, X0], [X1, X1 + 2]]) g.box(x0, y, 1, x1, y + 4, ZW - 3, pier);
  // Sawtooth roof: glazed faces look north (-y), camouflaged tin slopes fall to the south.
  const roof = camoTin(2, 2), endWall = grime(brick(BR, 2), 82, 3), n = 6, z0 = ZW, h = 20, ry0 = Y0 - 3, ry1 = Y1 + 3, P = (ry1 - ry0) / n;
  g.shape(X0 - 3, ry0, z0, X1 + 3, ry1, z0 + h + 1, (x, y, z) => {
    const k = Math.floor((y - ry0) / P), tt = (y - ry0 - k * P), t = tt / P, top = z0 + h * (1 - t);
    if (z > top + .5) return false;
    const inside = x > X0 && x < X1;
    if (tt < 1.8 && inside) return z > top - 1.5 || z < z0 + 1.5 ? roof : (ix(x) % 8 === 0 || ix(z) === z0 + 10 ? dkSteel : paneGlass);
    if (z > top - 2.2) return roof;
    if (tt > P - 1.6 && z < z0 + 1.6) return darkSteel; // valley gutter
    return inside || (x > X0 - 1 && x < X1 + 1) ? endWall : false;
  });
  // Ridge cappings and roof ventilators.
  for (let k = 0; k < n; k++) { const y = Math.round(ry0 + k * P); g.box(X0 - 3, y, z0 + h - 1, X1 + 3, y + 2, z0 + h + 1, flat(OL[1])); }
  for (const [x, k] of [[60, 1], [120, 1], [180, 3], [240, 3], [90, 4], [210, 5], [150, 2]]) { const y = Math.round(ry0 + k * P + P * .55); cowl(g, x, y, z0 + Math.round(h * .45)); }
  // Central head house: taller brick portal with stepped parapet, sign board and number.
  const HX0 = 96, HX1 = 196;
  g.box(HX0, Y1 - 6, 1, HX1, Y1 + 4, 96, wall);
  g.box(HX0 + 22, Y1 - 6, 96, HX1 - 22, Y1 + 4, 106, wall);
  g.box(HX0 - 1, Y1 - 7, 96, HX1 + 1, Y1 + 5, 98, coping); g.box(HX0 + 21, Y1 - 7, 106, HX1 - 21, Y1 + 5, 108, coping);
  for (const x of [HX0 - 4, HX1]) { g.box(x, Y1 - 6, 1, x + 4, Y1 + 6, 100, pier); g.box(x - 1, Y1 - 7, 100, x + 5, Y1 + 7, 102, coping); g.box(x, Y1 - 6, 102, x + 4, Y1 + 6, 106, pier); g.box(x - 1, Y1 - 7, 106, x + 5, Y1 + 7, 108, coping); }
  g.box(HX0 + 6, Y1 + 4, 72, HX1 - 6, Y1 + 5, 88, blackPaint);
  g.box(HX0 + 6, Y1 + 4, 88, HX1 - 6, Y1 + 5, 89, trimWhite); g.box(HX0 + 6, Y1 + 4, 71, HX1 - 6, Y1 + 5, 72, trimWhite);
  g.text('s', 121, Y1 + 4, 85, 'ASSEMBLY HALL', CR[3]);
  g.text('s', 130, Y1 + 4, 78, 'WORDWING', GD[3]);
  g.text('s', 143, Y1 + 3, 99, '2', CR[3], 2);
  // Round ventilation oculus either side of the number.
  for (const x of [128, 164]) g.shape(x - 4, Y1 + 3, 90, x + 5, Y1 + 5, 100, (xx, yy, z) => { const d = Math.hypot(xx - x - .5, z - 95); return d < 4.6 ? (d > 3.4 ? coping : (ix(z) % 2 ? dkSteel : midSteel)) : false; });
  // Giant doorway, interior and fuselage in its jig.
  const DX0 = 102, DX1 = 190, DZ = 54;
  g.erase(DX0, Y1 - 24, 1, DX1, Y1 + 4, DZ);
  g.box(DX0, Y1 - 25, 1, DX1, Y1 - 24, DZ, interior);
  g.box(DX0, Y1 - 24, DZ - 1, DX1, Y1 + 4, DZ, flat(ST[0]));
  g.box(DX0, Y1 - 24, 0, DX1, Y1 + 4, 1, concrete(CN, 1, 16));
  for (let x = DX0 + 2; x < DX1; x += 12) g.box(x, Y1 - 24, DZ - 4, x + 1, Y1 + 2, DZ - 1, flat(ST[1]));
  g.box(DX0, Y1 - 14, DZ - 6, DX1, Y1 - 12, DZ - 4, yellow); // crane runway glimpsed
  for (const x of [118, 150, 176]) { g.box(x, Y1 - 10, DZ - 6, x + 1, Y1 - 9, DZ - 1, dkSteel); g.box(x - 1, Y1 - 11, DZ - 8, x + 2, Y1 - 8, DZ - 6, flat(OL[2])); g.set(x, Y1 - 9, DZ - 9, lampGlow); }
  fuselageX(g, 130, 214, Y1 - 13, 20, 9, null, fuselageSkin(130, Y1 - 13, .42, DX1, 5, true));
  radialX(g, 127, Y1 - 13, 20, 8.5);
  g.box(150, Y1 - 24, 17, 166, Y1 - 2, 19, flat(OL[2])); // wing root stub
  g.surfBitmap('s', 146, 25, roundelRows, roundelPal);
  for (const x of [136, 170, 186]) { g.box(x, Y1 - 2, 1, x + 2, Y1, 34, yellow); g.box(x - 1, Y1 - 3, 1, x + 3, Y1 + 1, 2, yellow); }
  g.box(134, Y1 - 2, 34, 190, Y1, 36, hazard);
  g.line(176, Y1 - 13, 52, 176, Y1 - 13, 36, dkSteel); g.box(174, Y1 - 15, 34, 179, Y1 - 11, 36, flat(YL[2]));
  g.box(106, Y1 - 4, 1, 120, Y1, 6, planks(WD, 2, 2)); g.box(108, Y1 - 3, 6, 112, Y1 - 1, 9, flat(RD[2])); // trestle + toolbox
  // Sliding doors: one leaf closed on the west, three stacked open to the east on the long track.
  const door = camoTin(2, 5, .05), dbar = flat(OL[1]);
  g.box(DX0 - 6, Y1 + 4, DZ, 232, Y1 + 9, DZ + 4, dkSteel);
  for (let x = DX0; x < 228; x += 10) g.box(x, Y1 + 6, DZ - 1, x + 3, Y1 + 8, DZ, ltSteel);
  const leafAt = (a, b, y) => { g.box(a, y, 1, b, y + 2, DZ, door); for (let x = a; x < b; x += 11) g.box(x, y + 2, 1, x + 1, y + 3, DZ, dbar); g.box(a, y + 2, 24, b, y + 3, 25, dbar); g.box(a, y + 2, 2, b, y + 3, 3, dbar); };
  leafAt(DX0, 124, Y1 + 4);
  leafAt(184, 206, Y1 + 4); leafAt(196, 218, Y1 + 6); leafAt(208, 230, Y1 + 8);
  g.box(DX0 - 2, Y1 + 9, 0, 232, Y1 + 10, 1, ltSteel);
  g.text('s', 108, Y1 + 5, 46, '2', CR[3], 3); g.text('s', 211, Y1 + 9, 40, 'KEEP', CR[3]); g.text('s', 210, Y1 + 9, 33, 'CLEAR', CR[3]);
  // Flanking facade: tall steel windows between the piers, small doors, lamps, pipes.
  for (const x of [X0 + 8, X0 + 40, X0 + 72, 238, 260]) bigWin(g, 's', x, Y1 - 1, 16, 14, 32);
  doorOn(g, 's', 210, Y1 - 1, 1, 10, 22, { leaf: planks(OL, 2, 4), frame: coping });
  for (const x of [HX0 - 10, HX1 + 8]) wallLamp(g, 's', x, Y1 + 1, 50);
  for (const x of [X0 + 2, X1 - 3, HX0 - 6, HX1 + 4]) downpipe(g, 's', x, Y1 + (x === HX0 - 6 || x === HX1 + 4 ? 1 : 0), ZW - 2);
  // West: two-storey office lean-to with door, windows and nameplate.
  g.box(4, 64, 1, X0, 150, 34, grime(brick(BR, 3), 34, 4));
  g.box(3, 63, 33, X0, 151, 35, coping);
  g.shed(2, 62, X0 + 1, 152, 35, 0, 2, tin(TN, 3, 'x', 18));
  g.shape(2, 62, 35, X0 + 1, 152, 46, (x, y, z) => z < 35 + (x - 2) * .45 + 1 && z > 35 + (x - 2) * .45 - 2, tin(TN, 3, 'y', 18));
  for (const y of [70, 86, 134]) { windowOn(g, 'w', y, 4, 8, 12, 12, { frame: trimWhite }); windowOn(g, 'w', y, 4, 23, 12, 8, { frame: trimWhite }); }
  doorOn(g, 'w', 112, 4, 1, 10, 20, { leaf: planks(NV, 2, 4) });
  g.box(3, 104, 24, 4, 131, 31, blackPaint); g.text('w', 3, 106, 29, 'OFFICE', CR[3]);
  for (const y of [40, 160]) { bigWin(g, 'w', y, X0, 18, 12, 30); }
  // East: tall windows, personnel door, iron stair to the roof gutter.
  for (const y of [40, 70, 132, 162]) bigWin(g, 'e', y, X1 - 1, 16, 14, 32);
  extStair(g, 'e', 90, X1 - 1, ZW - 2, 6);
  doorOn(g, 'e', 140 - 30, X1 - 1, 1, 9, 22, { leaf: planks(OL, 2, 4), frame: coping });
  for (const y of [Y0 + 6, Y1 - 8]) downpipe(g, 'e', y, X1 + 1, ZW - 2);
  // North: rail door with track, windows, compressor house.
  g.erase(196, Y0, 1, 222, Y0 + 3, 44); g.box(196, Y0 + 2, 1, 222, Y0 + 3, 44, tin(OL, 2, 'y', 13));
  g.box(192, Y0 - 3, 44, 226, Y0, 47, dkSteel);
  for (const x of [X0 + 10, X0 + 50, 90, 130, 240]) bigWin(g, 'n', x, Y0, 16, 14, 30);
  g.box(140, 16, 1, 176, Y0, 26, grime(brick(BR, 2), 26, 7)); g.box(139, 15, 26, 177, Y0, 28, coping);
  g.cylZ(170, 22, 3, 28, 44, darkSteel); g.cylZ(170, 22, 3.6, 44, 46, midSteel);
  windowOn(g, 'n', 146, 16, 10, 10, 8, { frame: coping, glass: darkGlass });
  doorOn(g, 'w', 18, 140, 1, 8, 18, { leaf: tin(OL, 2, 'y') });
  // Yard clutter: drums, crates, a fire-point, weeds along the walls.
  for (const [x, y, c] of [[236, 186, OL[2]], [241, 188, RD[1]], [236, 191, OL[3]], [62, 186, AL[2]]]) { g.cylZ(x, y, 2.4, 1, 10, flat(c)); g.cylZ(x, y, 2.5, 5, 6, darkSteel); g.set(x, y - 1, 10, darkSteel); }
  g.box(48, 184, 1, 58, 192, 9, planks(WD, 2, 2)); g.box(50, 185, 9, 57, 191, 15, planks(WD, 3, 2)); g.text('s', 49, 191, 7, 'WW', TP[1]);
  g.box(270, 182, 1, 272, 183, 20, redPaint); g.box(266, 183, 12, 276, 184, 20, redPaint);
  for (const x of [267.5, 270.5, 273.5]) g.cylZ(x, 185.5, 1.4, 6, 11, redPaint);
  g.box(265, 183, 5, 277, 187, 6, dkSteel);
  tufts(g, X0, Y0, X1, Y1 + 2, 1);
  tufts(g, 4, 64, X0, 150, 3);
}, { margin: 8 });

// Gable roof shell with ridge along y; wallM fills the gable triangles between wy0 and wy1.
function gableShellY(g, y0, y1, x0, x1, z0, h, m, wallM, wy0, wy1, th = 3) {
  const c = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const lim = hw * (1 - (z - z0) / h), d = Math.abs(x - c); return d <= lim && d >= lim - th; }, m);
  if (wallM) g.shape(x0, wy0, z0, x1, wy1, z0 + h, (x, y, z) => Math.abs(x - c) <= hw * (1 - (z - z0) / h) - th + .4, wallM);
}
// Round louvred vent on a gable (s/n face plane p).
function oculus(g, f, cx, p, cz, r = 4) {
  const F = face(g, f, p);
  for (let t = -r - 1; t <= r + 1; t++) for (let z = -r - 1; z <= r + 1; z++) {
    const d = Math.hypot(t, z);
    if (d > r + .6) continue;
    F.put(cx + t, 0, cz + z, d > r - .6 ? coping : (z & 1 ? dkSteel : midSteel));
  }
}
// Bomber wing section with two nacelles facing +y (seen through hall doors). Indoor lighting.
function bomberSection(g, cx, yb, yf, zw) {
  const O = lit(olTop), A = lit(alu), N = lit(flat(OL[2]));
  g.box(cx - 62, yb, zw, cx + 62, yf - 2, zw + 3, O); g.box(cx - 62, yb, zw - 1, cx + 62, yf - 2, zw, A);
  g.cylY(cx, zw + 4, 8, yb - 4, yf - 6, A); g.cylY(cx, zw + 6, 6, yb - 4, yf - 6, O);
  g.ell(cx, yf - 6, zw + 4, 7, 6, 7, lit(glass)); // glazed nose
  for (let a = 0; a < 6; a++) g.line(cx - 7 + a * 2.8, yf - 6, zw - 2, cx - 7 + a * 2.8, yf - 1, zw + 8, dkSteel);
  for (const s of [-1, 1]) {
    const nx = cx + s * 34;
    g.cylY(nx, zw + 1, 6, yb - 2, yf - 1, N);
    g.cylY(nx, zw + 1, 4.4, yf - 1, yf, dkSteel);
    g.cylY(nx, zw + 1, 1.5, yf, yf + 2, ltSteel);
    for (const [dx, dz] of [[0, 1], [.87, -.5], [-.87, -.5]]) g.line(nx, yf + 1, zw + 1, nx + dx * 11, yf + 1, zw + 1 + dz * 11, flat(TP[2]), .6);
    g.box(nx - 1, yf - 6, 4, nx + 1, yf - 4, zw - 4, darkSteel);
    g.cylX(yf - 5, 5, 4.5, nx - 2, nx + 2, rubber);
  }
}

// Bicycle (frame in the x-z plane at y) leaning on a wall.
function bike(g, x, y, c = redPaint) {
  for (const wx of [x, x + 11]) g.shape(wx - 4, y, 1, wx + 4, y + 1, 10, (xx, yy, z) => { const d = Math.hypot(xx - wx, z - 5); return d < 4.2 && d > 3.1; }, rubber);
  g.line(x, y, 5, x + 5, y, 5, c); g.line(x + 5, y, 5, x + 4, y, 10, c); g.line(x + 4, y, 9, x + 10, y, 10, c); g.line(x + 10, y, 10, x + 11, y, 5, c); g.line(x, y, 5, x + 4, y, 9, c);
  g.box(x + 3, y, 10, x + 6, y + 1, 11, blackPaint); g.line(x + 10, y, 10, x + 10, y, 12, darkSteel); g.box(x + 9, y - 1, 12, x + 10, y + 2, 13, darkSteel);
}
// Bare radial engine, crankcase axis along y, nose toward +y: drum y0..y0+8, reduction case, shaft.
function radialY(g, cx, y0, cz, m = null) {
  g.cylY(cx, cz, 6, y0, y0 + 8, m || flat(ST[2]));
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; g.cylY(cx + Math.cos(a) * 7.5, cz + Math.sin(a) * 7.5, 2.2, y0 + 1, y0 + 7, m || flat(ST[3])); }
  g.cylY(cx, cz, 3.5, y0 + 7, y0 + 11, darkSteel); g.cylY(cx, cz, 1.2, y0 + 11, y0 + 14, ltSteel);
  g.cylY(cx, cz, 4, y0 - 4, y0, flat(OL[2]));
}

// ===== Assembly hall B: 14x10 steel barrel vault on brick walls with tapered buttresses, rendered
// arch front with a glazed lunette and folding doors open on a bomber centre section.
def('bld_factory_assembly_b', 'World', [14, 10], 96, g => {
  const X0 = 16, X1 = 208, Y0 = 18, Y1 = 146, ZW = 40, cx = 112, rx = 103, rz = 32;
  const wall = grime(brick(BR, 2), ZW, 11), pier = brick(BR, 3), front = grime(concrete(WH, 2, 24), 80, 12), roof = camoTin(2, 9, .024);
  g.box(2, 8, 0, 222, 160, 1, concrete(CN, 2, 32));
  g.box(X0, Y0, 1, X1, Y1, 8, brick(BR, 1)); g.box(X0, Y0, 8, X1, Y1, ZW, wall);
  g.box(X0 - 1, Y0 - 1, 7, X1 + 1, Y1 + 1, 9, coping);
  g.vaultY(Y0 - 3, Y1 + 3, cx, rx, ZW - 1, rz, roof);
  // Arch ribs and crown roof-lights.
  for (let y = Y0 + 4; y < Y1; y += 21) {
    g.shape(cx - rx - 2, y, ZW - 2, cx + rx + 2, y + 2, ZW + rz + 2, (x, yy, z) => { const r = ((x - cx) / (rx + 1.5)) ** 2 + ((z - ZW + 1) / (rz + 1.5)) ** 2; return r <= 1 && r > .93; }, dkSteel);
    for (const [a, b] of [[X0 - 5, X0], [X1, X1 + 5]]) { g.shape(a, y - 1, 1, b, y + 4, ZW, (x, yy, z) => (a < X0 ? X0 - x : x - X1) < 5 * (1 - z / (ZW + 12)), pier); }
  }
  g.topPaint(cx - 14, Y0, cx + 14, Y1, (x, y) => ((((ix(y) - Y0) % 21) + 21) % 21) > 3 && (((ix(y) - Y0) % 21) + 21) % 21 < 18 ? paneGlass : null);
  for (const k of [-1, 1]) for (let y = Y0 + 14; y < Y1; y += 42) cowl(g, cx + k * 48, y, ZW + 27, 3);
  // Front: rendered arch wall standing proud of the vault, coping ring.
  const arch = (x, z, grow = 0) => z < ZW ? x >= X0 - 2 - grow && x < X1 + 2 + grow : ((x - cx) / (rx + 1 + grow)) ** 2 + ((z - ZW + 1) / (rz + 1 + grow)) ** 2 <= 1;
  g.shape(X0 - 3, Y1 - 2, 1, X1 + 3, Y1 + 4, ZW + rz + 3, (x, y, z) => arch(x, z, 1) ? (arch(x, z, -1.2) ? front : coping) : false);
  g.shape(X0 - 3, Y0 - 6, 1, X1 + 3, Y0, ZW + rz + 3, (x, y, z) => arch(x, z, 1) ? (arch(x, z, -1.2) ? wall : coping) : false);
  // Doorway with folding leaves, lunette, sign band.
  const DX0 = 46, DX1 = 178, DZ = 46;
  g.erase(DX0, Y1 - 26, 1, DX1, Y1 + 4, DZ);
  g.box(DX0, Y1 - 27, 1, DX1, Y1 - 26, DZ, interior); g.box(DX0, Y1 - 26, DZ - 1, DX1, Y1 + 4, DZ, flat(ST[0]));
  g.box(DX0, Y1 - 26, 0, DX1, Y1 + 4, 1, concrete(CN, 1, 16));
  for (let x = DX0 + 4; x < DX1; x += 16) { g.box(x, Y1 - 20, DZ - 6, x + 1, Y1 - 19, DZ - 1, dkSteel); g.box(x - 1, Y1 - 21, DZ - 8, x + 2, Y1 - 18, DZ - 6, flat(OL[2])); g.set(x, Y1 - 19, DZ - 9, lampGlow); }
  bomberSection(g, cx, Y1 - 24, Y1 - 2, 18);
  const leafM = camoTin(2, 13, .06);
  const fold = (a, b, s) => g.shape(a, Y1 + 2, 1, b, Y1 + 9, DZ, (x, y) => { const p = (x - a) % 8, w = p < 4 ? p : 8 - p; return Math.abs(y - (Y1 + 3.5 + w * 1.2)) < 1; }, leafM);
  fold(DX0, DX0 + 16, 1); fold(DX1 - 16, DX1, -1);
  g.box(DX0 - 4, Y1 + 2, DZ, DX1 + 4, Y1 + 7, DZ + 6, coping);
  g.text('s', cx - 29, Y1 + 6, DZ + 5, 'ASSEMBLY HALL 3', TP[1]);
  g.shape(cx - 46, Y1 + 1, DZ + 6, cx + 46, Y1 + 4, ZW + rz, (x, y, z) => {
    const e = ((x - cx) / 44) ** 2 + ((z - DZ - 6) / 22) ** 2;
    if (e > 1) return false;
    if (y > Y1 + 3) return e > .82 ? coping : null;
    const a = Math.atan2(z - DZ - 6, x - cx) / Math.PI * 8;
    return Math.abs(a - Math.round(a)) < .12 || Math.abs(e - .4) < .05 ? dkSteel : paneGlass;
  });
  g.erase(cx - 40, Y1 + 3, DZ + 7, cx + 40, Y1 + 4, ZW + rz);
  g.shape(cx - 46, Y1 + 3, DZ + 6, cx + 46, Y1 + 4, ZW + rz, (x, y, z) => { const e = ((x - cx) / 44) ** 2 + ((z - DZ - 6) / 22) ** 2; return e <= 1 && e > .82 ? coping : arch(x, z, -1.2) && e > 1 ? front : false; });
  for (const x of [DX0 - 12, DX1 + 8]) wallLamp(g, 's', x, Y1 + 3, 38);
  for (const x of [24, 190]) bigWin(g, 's', x, Y1 + 3, 12, 12, 22);
  // Sides: windows between buttresses, downpipes; east boiler lean-to; west roof stair.
  for (let y = Y0 + 9; y < Y1 - 12; y += 21) { bigWin(g, 'e', y, X1 - 1, 14, 10, 20); if (y > 60) bigWin(g, 'w', y, X0, 14, 10, 20); }
  for (const y of [Y0 + 1, Y1 - 3]) { downpipe(g, 'e', y, X1, ZW - 1); downpipe(g, 'w', y, X0 - 1, ZW - 1); }
  g.box(X1, 52, 1, 220, 104, 24, grime(brick(BR, 2), 24, 14)); g.box(X1, 51, 24, 221, 105, 25, coping);
  g.shape(X1, 50, 24, 222, 106, 32, (x, y, z) => z < 24 + (222 - x) * .5 + 1 && z > 24 + (222 - x) * .5 - 2, tin(TN, 3, 'y', 14));
  doorOn(g, 'e', 70, 219, 1, 9, 18, { leaf: tin(OL, 2, 'y'), frame: coping });
  windowOn(g, 'e', 88, 219, 10, 8, 7, { frame: coping, glass: darkGlass });
  for (const y of [60, 94]) { g.cylZ(214, y, 1.6, 24, 46, darkSteel); g.box(212, y - 2, 46, 217, y + 3, 47, darkSteel); }
  extStair(g, 'w', 22, X0 - 5, ZW - 2, 5);
  // North: personnel door and small sliding door.
  doorOn(g, 'n', 80, Y0 - 6, 1, 10, 22, { leaf: planks(OL, 2, 4), frame: coping });
  g.erase(120, Y0 - 6, 1, 150, Y0 - 3, 32); g.box(120, Y0 - 4, 1, 150, Y0 - 3, 32, tin(OL, 2, 'y', 15)); g.box(116, Y0 - 9, 32, 154, Y0 - 6, 35, dkSteel);
  oculus(g, 'n', cx, Y0 - 6, 62, 6);
  for (const x of [40, 170]) bigWin(g, 'n', x, Y0 - 6, 12, 12, 22);
  // Yard: oil drums, gas bottles, crate stack.
  for (const [x, y, c] of [[26, 152, OL[2]], [31, 154, OL[3]], [26, 157, RD[1]]]) { g.cylZ(x, y, 2.4, 1, 10, flat(c)); g.cylZ(x, y, 2.5, 5, 6, darkSteel); }
  for (const x of [196, 199, 202]) { g.cylZ(x, 152, 1.3, 1, 15, flat(x === 199 ? RD[2] : NV[3])); g.set(x, 152, 15, ltSteel); }
  g.box(180, 151, 1, 192, 158, 8, planks(WD, 2, 2)); g.box(182, 152, 8, 190, 157, 13, planks(WD, 3, 2));
  tufts(g, X0 - 4, Y0 - 6, X1 + 4, Y1 + 4, 5);
}, { margin: 8 });

// ===== Wing shop: 12x8, four parallel gables (ridges run north-south), brick plinth and tin
// walls, roof-lights; bay 2 door open on a wing on trestles, bay 3 door shut.
def('bld_factory_wingshop', 'World', [12, 8], 80, g => {
  const X0 = 6, X1 = 186, Y0 = 20, Y1 = 112, ZW = 34, B = 45, H = 18;
  const tinW = grime(tin(TN, 2, 'y', 15), ZW + H, 21), roofM = tin(TN, 3, 'y', 16), gab = tin(TN, 3, 'y', 15);
  g.box(0, 10, 0, 192, 128, 1, concrete(CN, 2, 32));
  g.box(X0, Y0, 1, X1, Y1, 12, brick(BR, 2)); g.box(X0, Y0, 12, X1, Y1, ZW, tinW);
  g.box(X0 - 1, Y0 - 1, 11, X1 + 1, Y1 + 1, 13, coping);
  for (let k = 0; k < 4; k++) {
    const xa = X0 + k * B, xb = xa + B, c = (xa + xb) / 2;
    gableShellY(g, Y0 - 3, Y1 + 3, xa - 1.5, xb + 1.5, ZW, H + 1, roofM, gab, Y0, Y1, 3);
    g.box(c - .5, Y0 - 3, ZW + H - 1, c + 1, Y1 + 3, ZW + H + 1, flat(TN[1]));
    for (let y = Y0 + 10 + (k & 1) * 24; y < Y1 - 10; y += 48) g.topPaint(c - 12, y, c - 3, y + 16, () => paneGlass);
    if (k) g.box(xa - 1, Y0 - 3, ZW, xa + 1, Y1 + 3, ZW + 2, darkSteel);
    oculus(g, 's', c, Y1 - 1, ZW + 8, 3); oculus(g, 'n', c, Y0, ZW + 8, 3);
  }
  // Bay doors: bay 1 (x 51-96) open on a wing, bay 2 (96-141) shut.
  const D0 = 55, D1 = 92;
  g.erase(D0, Y1 - 20, 1, D1, Y1, 30);
  g.box(D0, Y1 - 21, 1, D1, Y1 - 20, 30, interior); g.box(D0, Y1 - 20, 29, D1, Y1, 30, flat(ST[0])); g.box(D0, Y1 - 20, 0, D1, Y1, 1, concrete(CN, 1, 16));
  const P = lit(primer), A = lit(alu);
  for (const x of [60, 86]) { g.box(x, Y1 - 16, 1, x + 2, Y1 - 4, 10, lit(woodPost)); }
  g.shape(D0 + 1, Y1 - 17, 10, D1 - 1, Y1 - 2, 14, (x, y, z) => { const c = (y - (Y1 - 17)) / 15, th = 3.6 * Math.sin(Math.PI * Math.min(1, c * 1.1 + .02)); if (z - 10 > th) return false; if (x < 73) return A; return (ix(x) % 4 === 0 || ix(y) === Y1 - 10 || z - 10 > th - 1) ? P : false; });
  g.set(70, Y1 - 3, 22, lampGlow);
  g.box(D0 - 3, Y1, 30, D1 + 30, Y1 + 3, 33, dkSteel);
  g.box(D1, Y1, 1, D1 + 26, Y1 + 2, 30, camoTin(2, 17, .06)); g.box(D1 + 6, Y1 + 2, 16, D1 + 20, Y1 + 3, 26, blackPaint); g.text('s', D1 + 9, Y1 + 2, 23, 'W2', CR[3]);
  const shut = camoTin(2, 19, .06);
  g.box(100, Y1, 1, 137, Y1 + 2, 30, shut); g.box(118, Y1 + 2, 1, 119, Y1 + 3, 30, flat(OL[1])); g.box(100, Y1 + 2, 14, 137, Y1 + 3, 15, flat(OL[1]));
  g.box(96, Y1, 30, 141, Y1 + 3, 33, dkSteel); g.box(104, Y1 + 2, 16, 114, Y1 + 3, 24, blackPaint); g.text('s', 106, Y1 + 2, 22, 'W3', CR[3]);
  // Bay 0: windows and door; bay 3: sign board and windows.
  windowOn(g, 's', 12, Y1 - 1, 15, 10, 12, { frame: coping, glass: paneGlass, bars: false });
  doorOn(g, 's', 32, Y1 - 1, 1, 9, 20, { leaf: planks(OL, 2, 4), frame: coping });
  for (const x of [146, 168]) bigWin(g, 's', x, Y1 - 1, 15, 12, 12);
  g.box(144, Y1, 28, 184, Y1 + 1, 34, blackPaint); g.text('s', 147, Y1, 32, 'WING SHOP', CR[3]);
  for (const x of [48, 141]) wallLamp(g, 's', x, Y1 - 1, 28);
  // Sides and back.
  for (const y of [28, 52, 76]) { bigWin(g, 'w', y, X0, 15, 14, 12); bigWin(g, 'e', y, X1 - 1, 15, 14, 12); }
  for (const x of [20, 66, 110, 156]) bigWin(g, 'n', x, Y0, 15, 14, 12);
  doorOn(g, 'n', 140, Y0, 1, 9, 20, { leaf: planks(OL, 2, 4), frame: coping });
  for (const y of [Y0 + 1, Y1 - 3]) { downpipe(g, 'e', y, X1, ZW); downpipe(g, 'w', y, X0 - 1, ZW); }
  // East timber lean-to with rib stock.
  g.box(X1, 36, 1, 191, 90, 22, planks(WD, 2, 3)); g.shed(X1, 34, 192, 92, 22, 0, 2, tin(TN, 3, 'x', 14));
  g.shape(X1, 34, 22, 192, 92, 28, (x, y, z) => z < 22 + (192 - x) * .9 + 1 && z > 22 + (192 - x) * .9 - 2, tin(TN, 3, 'y', 14));
  g.box(2, 116, 1, 24, 124, 2, woodDark); for (let k = 0; k < 4; k++) g.box(3, 117, 2 + k, 23, 123, 3 + k, k & 1 ? aluFlat : flat(AL[2]));
  for (const [x, y] of [[160, 118], [166, 120]]) { g.cylZ(x, y, 2.4, 1, 10, flat(OL[2])); g.cylZ(x, y, 2.5, 5, 6, darkSteel); }
  tufts(g, X0, Y0, X1 + 5, Y1, 9);
}, { margin: 8 });

// ===== Fuselage shop: 10x7 timber-clad works on a brick plinth, tar-paper gable with a glazed
// monitor along the ridge, sliding doors open on a fuselage, bicycle by the porch.
def('bld_factory_fuselage', 'World', [10, 7], 88, g => {
  const X0 = 8, X1 = 152, Y0 = 22, Y1 = 94, ZW = 36;
  const wall = grime(planks(WD, 2, 3), ZW, 23), roof = tarpaper(TP, 3, 'x');
  g.box(2, 12, 0, 158, 112, 1, concrete(CN, 2, 32));
  g.box(X0, Y0, 1, X1, Y1, 8, brick(BR, 2)); g.box(X0, Y0, 8, X1, Y1, ZW, wall);
  g.box(X0 - 1, Y0 - 1, 7, X1 + 1, Y1 + 1, 9, coping);
  for (let x = X0; x <= X1; x += 18) for (const y of [Y0 - 1, Y1]) g.box(Math.min(x, X1 - 2), y, 8, Math.min(x, X1 - 2) + 2, y + 1, ZW, woodDark);
  gableRoofX(g, 3, 157, Y0 - 6, Y1 + 6, ZW, 26, roof, wall, X0, X1, 6);
  // Ridge monitor: glazed clerestory with its own little gable.
  g.box(24, 50, 48, 136, 66, 66, wall);
  for (const [f, p] of [['s', 65], ['n', 50]]) for (let x = 28; x < 132; x += 14) windowOn(g, f, f === 's' ? x : x + 10, p, 54, 10, 8, { frame: trimWhite, glass: paneGlass, bars: false });
  gableRoofX(g, 21, 139, 45, 71, 66, 9, roof, wall, 24, 136, 3);
  for (const x of [40, 120]) cowl(g, x, 32, 50, 3);
  // Doors: big timber sliders, west leaf drawn back on the porch track.
  const D0 = 50, D1 = 110, DZ = 32;
  g.erase(D0, Y1 - 22, 1, D1, Y1, DZ);
  g.box(D0, Y1 - 23, 1, D1, Y1 - 22, DZ, interior); g.box(D0, Y1 - 22, DZ - 1, D1, Y1, DZ, flat(ST[0])); g.box(D0, Y1 - 22, 0, D1, Y1, 1, concrete(CN, 1, 16));
  fuselageX(g, 62, 130, Y1 - 11, 15, 7, null, fuselageSkin(62, Y1 - 11, .5, D1, 5, true));
  for (const x of [72, 96]) g.box(x, Y1 - 13, 1, x + 2, Y1 - 9, 8, lit(yellow));
  g.set(80, Y1 - 4, 28, lampGlow); g.set(100, Y1 - 4, 28, lampGlow);
  const slider = planks(PT, 2, 4, 'x');
  g.box(28, Y1, 1, D0 + 4, Y1 + 2, DZ, slider); g.box(D1 - 4, Y1, 1, D1 + 2, Y1 + 2, DZ, slider);
  for (const [a, b] of [[28, D0 + 4], [D1 - 4, D1 + 2]]) { g.line(a, Y1 + 2, 1, b - 1, Y1 + 2, DZ - 1, flat(PT[0])); g.box(a, Y1 + 2, DZ - 2, b, Y1 + 3, DZ - 1, flat(PT[0])); }
  g.box(24, Y1, DZ, 116, Y1 + 4, DZ + 3, dkSteel);
  g.box(52, Y1, DZ + 3, 108, Y1 + 1, DZ + 11, blackPaint); g.text('s', 54, Y1, DZ + 9, 'FUSELAGE SHOP', CR[3]);
  for (const x of [16, 122, 138]) windowOn(g, 's', x, Y1 - 1, 14, 10, 12, { frame: trimWhite, glass: paneGlass, bars: false });
  for (const x of [18, 50, 82, 114]) windowOn(g, 'n', x, Y0, 14, 12, 12, { frame: trimWhite, glass: paneGlass, bars: false });
  for (const [f, p] of [['w', X0], ['e', X1 - 1]]) { windowOn(g, f, 34, p, 14, 10, 12, { frame: trimWhite, glass: paneGlass, bars: false }); doorOn(g, f, 62, p, 1, 9, 20, { leaf: planks(PT, 1, 4), frame: trimWhite }); oculus(g, f === 'w' ? 'w' : 'e', 58, p, 48, 3); }
  wallLamp(g, 's', 46, Y1 - 1, 30); wallLamp(g, 's', 114, Y1 - 1, 30);
  // Bicycle leaning on the wall, bench and fire buckets.
  bike(g, 124, Y1 + 2); bike(g, 138, Y1 + 3);
  g.box(14, Y1 + 2, 1, 30, Y1 + 6, 5, planks(WD, 3, 2)); g.erase(16, Y1 + 2, 1, 28, Y1 + 6, 3);
  for (const x of [10, 13]) g.cylZ(x, Y1 + 3, 1.5, 6, 10, redPaint); g.box(9, Y1, 10, 15, Y1 + 1, 18, redPaint);
  g.box(140, 10, 1, 150, Y0 - 1, 8, planks(WD, 2, 2));
  tufts(g, X0, Y0, X1, Y1, 13);
}, { margin: 8 });

// ===== Jigs: steel assembly jigs with zinc-chromate frames.
const jigBase = (g, x0, x1, ys) => { for (const y of ys) g.box(x0, y, 0, x1, y + 2, 2, flat(ST[2])); for (let x = x0 + 2; x < x1; x += 12) g.box(x, ys[0], 0, x + 2, ys[ys.length - 1] + 2, 1, darkSteel); };
def('prop_jig_fuselage', 'World', [5, 2], 44, g => {
  jigBase(g, 0, 80, [5, 25]);
  for (const x of [3, 74]) {
    for (const y of [5, 25]) { g.box(x, y, 2, x + 3, y + 2, 34, yellow); g.box(x - 1, y - 1, 2, x + 4, y + 3, 4, hazard); }
    g.box(x, 5, 34, x + 3, 27, 37, yellow); g.line(x + 1, 6, 4, x + 1, 16, 33, yellow, .6); g.line(x + 1, 26, 4, x + 1, 16, 33, yellow, .6);
  }
  g.box(3, 15, 34, 77, 17, 37, yellow); // spine beam
  fuselageX(g, 8, 76, 16, 17, 9, null, fuselageSkin(8, 16, .26, 1e9, 5));
  for (const x of [22, 40, 58]) { g.box(x, 14, 2, x + 2, 18, 9, yellow); g.box(x - 2, 12, 8, x + 4, 20, 10, flat(YL[2])); }
  for (const x of [30, 52]) { g.line(x, 16, 36, x, 16, 25, dkSteel); g.box(x - 1, 15, 25, x + 2, 18, 27, darkSteel); }
  // Step platform and riveter's toolbox.
  g.box(26, 26, 0, 48, 31, 8, planks(WD, 2, 2)); g.erase(28, 26, 0, 46, 31, 6); g.box(28, 28, 0, 30, 30, 6, woodPost); g.box(44, 28, 0, 46, 30, 6, woodPost);
  g.box(60, 28, 0, 68, 31, 4, redPaint); g.box(63, 28, 4, 65, 31, 5, darkSteel);
  g.line(52, 30, 0, 60, 30, 0, rubber); g.line(40, 30, 8, 52, 30, 0, rubber);
});
def('prop_jig_fuselage_b', 'World', [5, 2], 40, g => {
  jigBase(g, 2, 78, [6, 24]);
  fuselageX(g, 10, 78, 16, 16, 9, null, fuselageSkin(10, 16, .88, 1e9, 5));
  // Bare tubular engine mount at the nose, firewall plate.
  g.cylX(16, 16, 6.5, 9, 10, flat(ST[3]));
  for (const [dy, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) g.line(9, 16 + dy, 16 + dz, 3, 16 + dy * .5, 16 + dz * .5, darkSteel);
  g.cylX(16, 16, 3.5, 2, 4, flat(ST[3]));
  // Open inspection panel, stencils, roundel, fin.
  g.erase(44, 22, 12, 52, 26, 19); g.box(44, 22, 10, 52, 23, 11, darkSteel);
  g.surfText('s', 26, 23, 'WW-2087', CR[2]);
  g.surfBitmap('s', 56, 22, roundelRows, roundelPal);
  g.shape(64, 15, 22, 79, 17, 38, (x, y, z) => x > 64 + (z - 22) * .55 && x < 79 - (z - 22) * .1, olTop); g.box(66, 6, 22, 79, 26, 24, olTop);
  for (const x of [20, 48, 68]) { g.box(x, 14, 2, x + 3, 18, 8, yellow); g.box(x - 2, 12, 6, x + 5, 20, 8, hazard); }
  // Ladder against the fuselage.
  g.line(34, 28, 0, 34, 25, 20, woodPost); g.line(38, 28, 0, 38, 25, 20, woodPost);
  for (let k = 1; k < 6; k++) g.line(34, 28 - k * .6, k * 3.4, 38, 28 - k * .6, k * 3.4, woodPost);
});
def('prop_jig_wing', 'World', [4, 2], 44, g => {
  jigBase(g, 0, 64, [10, 20]);
  for (const x of [2, 31, 60]) { g.box(x, 13, 2, x + 2, 18, 38, yellow); g.box(x - 1, 12, 36, x + 3, 19, 39, yellow); g.box(x - 1, 12, 2, x + 3, 19, 4, hazard); }
  g.box(2, 13, 37, 62, 18, 39, yellow);
  // Wing standing on its leading edge: chord in z, span in x; skinned to the west, ribs to the east.
  g.shape(4, 11, 6, 60, 21, 35, (x, y, z) => {
    const c = (z - 6) / 29, th = 4.4 * Math.sqrt(Math.max(0, c)) * (1 - c * .8) + .6;
    if (Math.abs(y - 15.5) > th) return false;
    if (x < 30) return alu;
    const rib = ix(x) % 5 === 0, spar = Math.abs(z - 12) < 1 || Math.abs(z - 26) < 1;
    return rib || spar || Math.abs(Math.abs(y - 15.5) - th) < .7 && (rib || ix(z) % 6 === 0) ? primer : false;
  });
  for (const x of [16, 46]) for (const z of [12, 28]) { g.box(x, 10, z, x + 2, 12, z + 2, flat(ST[3])); g.box(x, 19, z, x + 2, 21, z + 2, flat(ST[3])); }
  g.box(38, 24, 0, 50, 30, 3, planks(WD, 2, 2)); g.box(40, 25, 3, 46, 29, 6, redPaint);
});
def('prop_jig_wing_b', 'World', [4, 3], 30, g => {
  for (const x of [8, 28, 50]) { g.line(x, 6, 0, x, 14, 10, woodPost); g.line(x, 34, 0, x, 26, 10, woodPost); g.box(x - 1, 6, 10, x + 2, 34, 12, planks(WD, 2, 2, 'y')); }
  // Wing lying flat: olive top, aluminium edge, aileron line, roundel, open rib bay.
  g.shape(2, 6, 12, 62, 34, 18, (x, y, z) => {
    const taper = 1 - (x - 2) / 60 * .3, yc = 20, half = 13 * taper, c = (y - (yc - half)) / (2 * half);
    if (c < 0 || c > 1) return false;
    const th = 4.5 * taper * Math.sqrt(1 - c) * Math.min(1, c * 5);
    return z - 12 < th + .5 ? (z - 12 > th - 1 ? (c < .12 ? flat(AL[3]) : olTop) : alu) : false;
  });
  g.topPaint(40, 8, 58, 14, () => darkSteel);
  g.topPaint(10, 6, 62, 34, (x, y) => (Math.abs(y - (20 - 13 * (1 - (x - 2) / 200)) - 5) < .5 && x > 30) ? flat(OL[1]) : null);
  g.erase(14, 18, 13, 24, 28, 18);
  for (let x = 14; x < 24; x += 3) g.box(x, 18, 13, x + 1, 28, 16, primer);
  g.bitmap('u', 46, 22, g.top(48, 24), roundelRows, roundelPal);
  g.box(40, 38, 0, 52, 44, 3, planks(WD, 2, 2)); g.cylZ(56, 41, 2.4, 0, 9, flat(OL[3]));
});

// ===== Gantries: goliath crane on rails and a portable engine hoist.
def('prop_gantry', 'World', [5, 3], 70, g => {
  for (const x of [4, 72]) { g.box(x, 0, 0, x + 4, 48, 1, darkSteel); g.box(x + 1, 0, 1, x + 3, 48, 2, ltSteel); for (let y = 1; y < 48; y += 4) g.box(x - 2, y, 0, x + 6, y + 2, 1, woodDark); }
  for (const x of [6, 74]) {
    g.box(x - 3, 4, 2, x + 3, 16, 7, yellow); g.box(x - 3, 32, 2, x + 3, 44, 7, yellow);
    for (const y of [7, 13, 35, 41]) g.cylX(y, 4, 2.6, x - 4, x + 4, darkSteel);
    g.line(x, 10, 6, x, 22, 56, yellow, 1.6); g.line(x, 38, 6, x, 26, 56, yellow, 1.6);
    g.line(x, 13, 24, x, 35, 24, yellow, .8);
    g.box(x - 3, 4, 3, x + 3, 16, 4, hazard); g.box(x - 3, 32, 3, x + 3, 44, 4, hazard);
  }
  // Box girder with walkway and rail, trolley, hook block.
  g.box(2, 20, 54, 78, 28, 63, yellow); for (const x of [2, 74]) g.box(x, 20, 62, x + 4, 28, 63, hazard);
  for (let x = 4; x < 78; x += 6) { g.line(x, 28, 55, x + 3, 28, 61, flat(YL[2])); }
  g.text('s', 26, 28, 60, '10 TONS', TP[1]);
  g.box(2, 28, 60, 78, 31, 61, planks(ST, 3, 2, 'x')); railing(g, 2, 28, 78, 31, 61, 5, ltSteel, 6, 's');
  g.box(34, 18, 63, 48, 30, 69, flat(OL[2])); g.box(35, 19, 69, 47, 29, 70, flat(OL[1]));
  for (const x of [36, 46]) g.cylY(x, 63, 1.4, 17, 31, darkSteel);
  for (const y of [23, 25]) g.line(41, y, 54, 41, y, 22, darkSteel);
  g.box(38, 21, 18, 44, 27, 22, yellow); g.box(38, 21, 18, 44, 27, 19, hazard);
  g.line(41, 24, 18, 41, 24, 15, dkSteel); g.line(41, 24, 15, 43, 24, 13, dkSteel); g.line(43, 24, 13, 41, 24, 11, dkSteel);
  // Operator cab hung under the girder by the east leg.
  g.box(62, 30, 42, 72, 38, 52, flat(OL[2])); g.box(63, 37, 45, 71, 38, 50, glass); g.box(61, 29, 52, 73, 39, 54, flat(OL[1]));
  g.line(66, 34, 54, 66, 28, 56, darkSteel);
});
def('prop_gantry_b', 'World', [3, 2], 54, g => {
  // Portable A-frame hoist on castors with a radial engine on the chain block.
  for (const y of [4, 28]) { g.box(4, y, 2, 44, y + 3, 5, yellow); for (const x of [6, 42]) { g.cylX(y + 1.5, 2, 2, x - 1, x + 2, rubber); } }
  for (const y of [5.5, 29.5]) { g.line(8, y, 4, 24, y, 46, yellow, 1.2); g.line(40, y, 4, 24, y, 46, yellow, 1.2); g.line(14, y, 18, 34, y, 18, flat(YL[2]), .6); }
  g.box(22, 4, 45, 26, 32, 49, yellow); g.box(22, 4, 48, 26, 32, 49, hazard);
  g.box(21, 15, 38, 27, 21, 45, flat(RD[2])); g.line(24, 18, 38, 24, 18, 30, dkSteel);
  for (const k of [0, 1, 2]) g.line(24, 18, 30 - k, 24 - 3 + k * 3, 18, 26, dkSteel);
  radialY(g, 24, 14, 20);
  g.box(34, 26, 0, 46, 32, 2, woodDark); g.box(35, 27, 2, 44, 31, 7, redPaint); g.box(36, 28, 7, 43, 30, 8, darkSteel);
});

// Horizontal louvre slats on a wall face (intakes, vents).
function louvre(g, f, t0, p, z0, w, h, m = dkSteel) { const F = face(g, f, p); for (let z = z0; z < z0 + h; z += 2) F.box(t0, t0 + w, 0, 2, z, z + 1, m); }
const mergeOverlays = (...o) => (c, p, f, x) => o.forEach(fn => fn(c, p, f, x));
const heatHaze = (x, y, z) => smokeOverlay(x, y, z, 18);

// ===== Engine shop: 11x7 brick block with roof lantern; east test cell in heavy concrete with a
// louvred intake tower and a sooty exhaust stack (haze); engine on its stand behind the door.
def('bld_factory_engine', 'World', [11, 7], 92, g => {
  const wall = grime(brick(BR, 2), 44, 31), conc = grime(concrete(CN, 3, 14), 64, 32), X0 = 8, X1 = 120, Y0 = 20, Y1 = 96;
  g.box(0, 10, 0, 176, 112, 1, concrete(CN, 2, 32));
  g.box(X0, Y0, 1, X1, Y1, 8, brick(BR, 1)); g.box(X0, Y0, 8, X1, Y1, 44, wall);
  g.box(X0 - 1, Y0 - 1, 7, X1 + 1, Y1 + 1, 9, coping); g.box(X0 - 1, Y0 - 1, 44, X1 + 1, Y1 + 1, 48, coping); g.erase(X0 + 1, Y0 + 1, 45, X1 - 1, Y1 - 1, 48);
  g.box(X0 + 1, Y0 + 1, 44, X1 - 1, Y1 - 1, 45, tarpaper(TP, 3, 'x'));
  g.box(X1 - 1, 33, 37, 169, 93, 39, coping); g.erase(X1, 34, 38, 168, 92, 39); g.box(X1, 34, 37, 168, 92, 38, tarpaper(TP, 2, 'x'));
  for (const y of [70, 82]) cowl(g, 140, y, 37, 2);
  // Roof lantern.
  g.box(26, 44, 46, 102, 72, 56, dkSteel);
  for (const [f, p] of [['s', 71], ['n', 44]]) g.box(27, f === 's' ? 71 : 44, 47, 101, f === 's' ? 72 : 45, 55, paneGlass);
  gableRoofX(g, 24, 104, 41, 75, 56, 8, tin(TN, 3, 'x', 16), dkSteel, 26, 102, 3);
  for (const x of [16, 110]) { g.box(x, 28, 46, x + 6, 34, 56, brick(BR, 2)); g.box(x - 1, 27, 56, x + 7, 35, 58, coping); }
  // Test cell.
  g.box(X1, 34, 1, 168, 92, 34, conc); g.box(X1 - 1, 33, 34, 169, 93, 37, coping);
  g.box(126, 36, 1, 148, 54, 64, conc); g.box(125, 35, 64, 149, 55, 67, coping);
  for (const [f, p] of [['n', 36], ['e', 147], ['w', 126]]) louvre(g, f, f === 'n' ? 129 : 39, p, 40, f === 'n' ? 16 : 12, 20);
  g.box(150, 62, 1, 166, 80, 72, conc); g.box(149, 61, 72, 167, 81, 74, coping);
  g.cylZ(158, 71, 5.5, 72, 80, darkSteel); g.cylZ(158, 71, 4, 79, 80, soot); g.cylZ(158, 71, 6.2, 76, 77, midSteel);
  g.paint(150, 62, 60, 166, 80, 72, mat((x, y, z, f) => (hash(ix(x / 2), 0, 3) < .5 + (z - 60) / 24 ? TP[2] : CN[2])));
  windowOn(g, 's', 124, 91, 14, 18, 7, { frame: flat(ST[1]), glass: darkGlass, bars: false });
  g.box(127, 92, 24, 158, 93, 30, blackPaint); g.text('s', 129, 92, 29, 'TESTING', RD[3]); g.set(161, 93, 27, glow(RD[4])); g.set(162, 93, 27, glow(RD[4]));
  doorOn(g, 's', 150, 91, 1, 9, 22, { leaf: flat(ST[2]), frame: coping, depth: 2 });
  for (let k = 0; k < 3; k++) g.cylX(98 - k * 0, 26 + k * 3, 1.2, X1, 126, k === 1 ? redPaint : flat(GD[1]));
  // Front: doorway with an engine on its stand, sign, engine trolley outside.
  g.erase(40, Y1 - 18, 1, 80, Y1, 32);
  g.box(40, Y1 - 19, 1, 80, Y1 - 18, 32, interior); g.box(40, Y1 - 18, 31, 80, Y1, 32, flat(ST[0])); g.box(40, Y1 - 18, 0, 80, Y1, 1, concrete(CN, 1, 16));
  g.box(52, Y1 - 12, 1, 68, Y1 - 6, 4, lit(flat(ST[1]))); g.box(58, Y1 - 10, 4, 62, Y1 - 7, 12, lit(flat(ST[1])));
  radialY(g, 60, Y1 - 14, 18, lit(flat(ST[3])));
  g.set(48, Y1 - 3, 27, lampGlow); g.set(72, Y1 - 3, 27, lampGlow);
  g.box(36, Y1, 32, 84, Y1 + 3, 35, dkSteel); g.box(38, Y1, 35, 82, Y1 + 1, 42, blackPaint); g.text('s', 40, Y1, 40, 'ENGINE SHOP', CR[3]);
  for (const x of [14, 90, 104]) bigWin(g, 's', x, Y1 - 1, 14, 10, 20);
  for (const x of [16, 46, 76, 100]) bigWin(g, 'n', x, Y0, 14, 10, 20);
  for (const y of [28, 56]) bigWin(g, 'w', y, X0, 14, 12, 20);
  doorOn(g, 'w', 78, X0, 1, 8, 20, { leaf: planks(OL, 2, 4), frame: coping });
  for (const x of [X0 + 1, 86]) downpipe(g, 's', x, Y1 + 1, 46);
  g.box(86, 100, 1, 104, 110, 3, flat(OL[2])); for (const x of [88, 102]) for (const y of [101, 109]) g.cylX(y, 2, 1.6, x - 1, x + 1, rubber);
  radialY(g, 95, 99, 11);
  for (const [x, y, c] of [[16, 104, OL[2]], [21, 106, RD[1]], [16, 108, OL[3]]]) { g.cylZ(x, y, 2.4, 1, 10, flat(c)); g.cylZ(x, y, 2.5, 5, 6, darkSteel); }
  tufts(g, X0, Y0, 168, Y1, 33);
}, { margin: 8, frames: 4, fps: 6, overlay: heatHaze(158, 71, 80) });

// ===== Engine test bed: 6x5 open run-up stand with a propeller, blast wall behind it and a
// low concrete observation bunker with slit windows.
def('bld_factory_testcell', 'World', [6, 5], 62, g => {
  const conc = grime(concrete(CN, 3, 12), 30, 41);
  g.box(0, 0, 0, 96, 80, 1, concrete(CN, 2, 24));
  for (let x = 4; x < 92; x += 12) g.topPaint(x, 40, x + 6, 42, () => flat(GD[2]));
  // Blast wall (sandbags) curving behind the stand.
  g.shape(8, 2, 1, 70, 14, 34, (x, y, z) => { const c = 8 - Math.abs(x - 39) * .1; return y > c - 4 && y < c + 4 && z < 34 - Math.abs(x - 39) * .3; }, sandbag());
  // Stand: steel frame, engine, nacelle ring, three-blade prop (vertical disc in the x-z plane).
  g.box(28, 20, 1, 50, 34, 3, flat(ST[2]));
  for (const [x, y] of [[30, 22], [47, 22], [30, 31], [47, 31]]) g.line(x, y, 2, 39 + (x - 39) * .3, 27, 20, yellow, .8);
  g.cylY(39, 22, 5, 18, 30, flat(OL[2])); radialY(g, 39, 28, 22); g.cylY(39, 22, 2.2, 40, 43, flat(ST[3]));
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189]) g.line(39, 42, 22, 39 + Math.cos(a) * 17, 42, 22 + Math.sin(a) * 17, flat(TP[2]), .9);
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189]) g.set(39 + Math.cos(a) * 16.5, 42, 22 + Math.sin(a) * 16.5, flat(GD[3]));
  g.box(32, 34, 1, 46, 40, 2, flat(ST[1]));
  // Bunker.
  g.box(60, 38, 1, 92, 72, 20, conc); g.box(59, 37, 20, 93, 73, 22, coping); g.shape(61, 39, 22, 91, 71, 27, (x, y, z) => z < 22 + Math.min(x - 60, 92 - x, y - 38, 72 - y) * .6, earthBerm);
  g.shape(57, 35, 1, 95, 75, 14, (x, y, z) => { const d = Math.min(x - 57, 95 - x, y - 35, 75 - y); return d < 4 && z < 14 - (4 - d) * 3; }, earthBerm);
  windowOn(g, 'w', 44, 60, 12, 20, 3, { frame: flat(ST[1]), glass: darkGlass, bars: false, sill: false });
  windowOn(g, 's', 66, 71, 12, 18, 3, { frame: flat(ST[1]), glass: darkGlass, bars: false, sill: false });
  doorOn(g, 's', 82, 71, 1, 7, 16, { leaf: flat(ST[2]), frame: coping, depth: 2 });
  g.cylZ(88, 44, 1.2, 23, 34, darkSteel); g.box(85, 44, 34, 92, 45, 35, darkSteel);
  // Danger board, windsock-style pennant pole, fuel bowser drums.
  for (const x of [3, 26]) g.box(x, 74, 1, x + 1, 75, 20, woodPost);
  g.box(1, 75, 12, 29, 76, 20, redPaint); g.text('s', 4, 75, 18, 'DANGER', CR[3]);
  for (const [x, y] of [[8, 54], [13, 56], [8, 59]]) { g.cylZ(x, y, 2.4, 1, 10, flat(RD[1])); g.cylZ(x, y, 2.5, 5, 6, darkSteel); }
  g.text('u', 18, 47, 0, 'TEST BED 1', CR[2]);
});
const earthBerm = mat((x, y, z) => { const n = fbm(x * .3, y * .3 + z * .2, 91); return n > .55 ? GR[3] : n > .45 ? GR[2] : DT[2]; });

// ===== Dope shop: 9x6 whitewashed paint shop, tar-paper roof with three extractor fans, a duct
// to a tall vent stack, hazard-striped doors, dope drums and fire point.
def('bld_factory_dope', 'World', [9, 6], 82, g => {
  const X0 = 8, X1 = 126, Y0 = 20, Y1 = 82, wall = grime(mottled_(WH, 3), 34, 51);
  g.box(0, 10, 0, 144, 96, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 6, concrete(CN, 2)); g.box(X0, Y0, 6, X1, Y1, 34, wall);
  g.box(X0 - 1, Y0 - 1, 32, X1 + 1, Y1 + 1, 34, flat(PT[1]));
  gableRoofX(g, 4, 130, Y0 - 5, Y1 + 5, 34, 20, tarpaper(TP, 3, 'x'), wall, X0, X1, 5);
  for (const x of [30, 64, 98]) {
    const y = 34;
    g.box(x - 6, y - 5, 46, x + 7, y + 6, 54, flat(ST[2])); g.box(x - 7, y - 6, 54, x + 8, y + 7, 55, darkSteel);
    g.shape(x - 5, y - 4, 55, x + 6, y + 5, 56, (xx, yy) => { const d = Math.hypot(xx - x - .5, yy - y - .5); return d < 5.2 ? (d < 1.2 || Math.abs(Math.atan2(yy - y - .5, xx - x - .5) % 1.05) < .25 ? midSteel : soot) : false; });
  }
  // Duct to the vent stack on the east end.
  g.box(X1, 40, 22, 136, 48, 30, flat(ST[3])); g.box(132, 40, 1, 140, 48, 30, flat(ST[3]));
  g.cylZ(136, 44, 3.6, 30, 76, flat(ST[3])); g.cylZ(136, 44, 4.4, 76, 78, darkSteel); for (const z of [40, 56, 70]) g.cylZ(136, 44, 4, z, z + 1, darkSteel);
  for (const [dx, dy] of [[-12, -12], [12, -12], [0, 14]]) g.line(136, 44, 66, 136 + dx, 44 + dy, 0, flat(ST[1]));
  // Front doors with hazard frame, signs.
  doorOn(g, 's', 50, Y1 - 1, 1, 20, 24, { leaf: tin(OL, 2, 'y', 10), frame: hazard });
  g.box(59.5, Y1 - 1, 1, 60.5, Y1, 25, flat(OL[1]));
  g.box(42, Y1, 26, 82, Y1 + 1, 32, blackPaint); g.text('s', 45, Y1, 30, 'DOPE SHOP', CR[3]);
  g.box(84, Y1, 12, 118, Y1 + 1, 24, flat(CR[2])); g.text('s', 86, Y1, 22, 'NO NAKED', RD[2]); g.text('s', 86, Y1, 16, 'LIGHTS', RD[2]);
  for (const x of [16, 30]) windowOn(g, 's', x, Y1 - 1, 12, 10, 12, { frame: flat(PT[1]), glass: paneGlass, bars: false });
  for (const x of [20, 50, 80, 104]) windowOn(g, 'n', x, Y0, 12, 10, 12, { frame: flat(PT[1]), glass: paneGlass, bars: false });
  windowOn(g, 'w', 34, X0, 12, 14, 12, { frame: flat(PT[1]), glass: paneGlass, bars: false });
  // Dope drums (red/green/silver), fire extinguishers, sand buckets.
  for (const [x, y, c] of [[90, 86, RD[2]], [95, 88, PT[2]], [100, 86, AL[3]], [92, 91, RD[1]], [97, 92, PT[1]]]) { g.cylZ(x, y, 2.3, 1, 9, flat(c)); g.cylZ(x, y, 2.4, 4, 5, darkSteel); g.set(x, y - 1, 9, darkSteel); }
  g.box(112 + 8, Y1, 6, 122 + 2, Y1 + 1, 24, redPaint); for (const x of [121, 124 - 1]) { g.cylZ(x, Y1 + 2, 1.4, 8, 16, redPaint); g.set(x, Y1 + 2, 16, darkSteel); }
  for (const x of [113, 117, 121]) g.cylZ(x, Y1 + 3, 1.4, 1, 5, flat(RD[3]));
  g.box(8, 88, 1, 30, 92, 3, woodDark); g.box(9, 88, 3, 29, 92, 4, flat(OL[3])); g.box(10, 88, 4, 28, 92, 5, aluFlat); // painted panels drying
  tufts(g, X0, Y0, X1, Y1, 52);
});
function mottled_(R, i) { return mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); const n = fbm(u * .12, v * .12, 57); return cl(R, i + (n > .64 ? 1 : n < .34 ? -1 : 0)); }); }

// ===== Spray booth: 6x4 tin booth, canvas curtain half drawn on a camouflaged wing panel,
// two wall extractor fans with filter boxes.
def('bld_factory_dope_b', 'World', [6, 4], 60, g => {
  const X0 = 6, X1 = 90, Y0 = 10, Y1 = 54;
  g.box(0, 4, 0, 96, 64, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 30, tin(TN, 3, 'y', 14));
  g.shed(X0 - 3, Y0 - 3, X1 + 3, Y1 + 3, 30, 8, 2, tin(TN, 2, 'y', 14));
  g.shape(X0, Y0, 30, X1, Y1, 40, (x, y, z) => z < 30 + 8 * (1 - (y - Y0 + 3) / (Y1 - Y0 + 6)) + 1, tin(TN, 3, 'y', 14));
  g.erase(X0 + 6, Y1 - 16, 1, X1 - 6, Y1, 26);
  g.box(X0 + 6, Y1 - 17, 1, X1 - 6, Y1 - 16, 26, interior); g.box(X0 + 6, Y1 - 16, 25, X1 - 6, Y1, 26, flat(ST[0]));
  // Wing panel on easels, half-sprayed camouflage.
  for (const x of [30, 64]) g.box(x, Y1 - 10, 1, x + 2, Y1 - 8, 8, lit(woodPost));
  g.box(20, Y1 - 12, 8, 76, Y1 - 6, 10, mat((x, y, z) => x > 50 ? AL[3] : (fbm(x * .1, y * .1, 3) > .5 ? DT[3] : OL[3]), { noShadow: true }));
  g.box(54, Y1 - 6, 1, 56, Y1 - 4, 14, lit(flat(ST[2]))); g.line(55, Y1 - 5, 14, 52, Y1 - 8, 11, darkSteel);
  // Curtain on the west half.
  g.shape(X0 + 6, Y1 - 1, 1, 44, Y1 + 2, 26, (x, y) => Math.abs(y - (Y1 + .5 + Math.sin(x * .7) * .9)) < .8, canvasMat(undefined, 3, 4));
  g.box(X0 + 4, Y1, 26, X1 - 4, Y1 + 2, 27, darkSteel);
  // Extractor fans on the east wall with filter boxes and ducts.
  for (const y of [18, 36]) {
    g.box(X1, y - 6, 8, X1 + 4, y + 7, 22, flat(ST[2]));
    g.shape(X1 + 4, y - 6, 8, X1 + 5, y + 7, 22, (x, yy, z) => { const d = Math.hypot(yy - y - .5, z - 15); return d < 6 ? (d < 1.3 || Math.abs(Math.sin(Math.atan2(z - 15, yy - y - .5) * 2)) < .3 ? ltSteel : soot) : flat(ST[2]); });
  }
  g.box(X0 - 4, 20, 1, X0, 44, 16, flat(ST[3])); g.box(X0 - 5, 19, 16, X0 + 1, 45, 17, darkSteel); g.text('w', X0 - 4, 24, 12, 'FILTER', TP[1]);
  g.box(X0 + 4, Y1, 28, X0 + 28, Y1 + 1, 30, blackPaint);
  g.box(X0 + 40, Y1, 27, X1 - 8, Y1 + 1, 34, flat(CR[2])); g.text('s', X0 + 42, Y1, 32, 'SPRAY BAY', RD[2]);
  for (const [x, y, c] of [[84, 58, PT[2]], [89, 59, DT[3]]]) { g.cylZ(x, y, 2.3, 1, 9, flat(c)); g.cylZ(x, y, 2.4, 4, 5, darkSteel); }
});

// ===== Boiler house: 7x7 brick gable with tall windows, coal heap, steam main, and a tall
// tapered brick chimney with stone bands, iron ladder and lightning rod; animated smoke.
def('bld_factory_boiler', 'World', [7, 7], 182, g => {
  const wall = grime(brick(BR, 2), 44, 61), X0 = 8, X1 = 76, Y0 = 30, Y1 = 100, cx = 94, cy = 42;
  g.box(0, 14, 0, 112, 112, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 8, brick(BR, 1)); g.box(X0, Y0, 8, X1, Y1, 42, wall); g.box(X0 - 1, Y0 - 1, 7, X1 + 1, Y1 + 1, 9, coping);
  // Ridge along y: gable ends face south/north.
  gableShellY(g, Y0 - 4, Y1 + 4, X0 - 4, X1 + 4, 42, 24, rooftile(TP, 3, 'y'), wall, Y0, Y1, 3);
  g.box(40, Y0 + 6, 52, 46, Y1 - 6, 70, flat(TN[2])); gableShellY(g, Y0 + 4, Y1 - 4, 37, 49, 70, 6, tin(TN, 3, 'y'), null);
  for (let y = Y0 + 8; y < Y1 - 8; y += 4) for (const x of [40, 45]) g.box(x, y, 58, x + 1, y + 2, 66, darkSteel);
  // Tall round-headed windows on the gables and sides.
  const archWin = (f, a, p, z, w, h) => { bigWin(g, f, a, p, z, w, h); const F = face(g, f, p); for (let t = -2; t <= w + 1; t++) F.put(a + t, 1, z + h + 1 + (t > 0 && t < w - 1 ? 1 : 0), coping); };
  for (const x of [18, 54]) archWin('s', x, Y1 - 1, 12, 10, 24);
  for (const y of [40, 60, 80]) archWin('w', y, X0, 12, 10, 24);
  doorOn(g, 's', 36, Y1 - 1, 1, 12, 28, { leaf: planks(OL, 2, 4), frame: coping });
  oculus(g, 's', 42, Y1 - 1, 52, 5);
  g.box(26, Y1, 32, 58, Y1 + 1, 38, blackPaint); g.text('s', 29, Y1, 36, 'BOILERS', CR[3]);
  // Chimney.
  const chim = grime(brick(BR, 2), 170, 62, .1);
  g.box(cx - 11, cy - 11, 1, cx + 11, cy + 11, 22, brick(BR, 1)); g.box(cx - 12, cy - 12, 22, cx + 12, cy + 12, 24, coping);
  g.cone(cx, cy, 9, 6, 24, 166, chim);
  for (const z of [60, 110, 150]) g.cone(cx, cy, 9 - (z - 24) / 142 * 3 + .8, 9 - (z - 24) / 142 * 3 + .8, z, z + 2, coping);
  g.cone(cx, cy, 6.2, 7.6, 162, 168, brick(BR, 3)); g.cone(cx, cy, 7.6, 7.6, 168, 170, coping);
  g.cylZ(cx, cy, 5, 166, 171, null); g.cylZ(cx, cy, 4.6, 165, 170, soot);
  g.paint(cx - 9, cy - 9, 140, cx + 9, cy + 9, 168, mat((x, y, z, f) => cl(BR, 1 - (hash(ix(x), ix(z / 3), 5) < (z - 140) / 40 ? 1 : 0))));
  for (let z = 26; z < 160; z += 4) g.box(cx - 2, cy + 9 - (z - 24) / 142 * 3 + .5, z, cx + 2, cy + 10 - (z - 24) / 142 * 3 + .5, z + 1, darkSteel);
  g.line(cx + 2, cy, 170, cx + 2, cy, 178, darkSteel);
  // Flue from the boiler house into the chimney base.
  g.box(X1, 46, 10, cx - 10, 56, 20, brick(BR, 2)); g.box(X1, 45, 20, cx - 10, 57, 22, coping);
  // Coal heap and barrow, steam main on trestles running north.
  g.shape(78, 70, 1, 110, 108, 18, (x, y, z) => { const d = Math.hypot((x - 94) / 16, (y - 89) / 18); return z < 1 + 16 * (1 - d) * (1 - d * .3) + hash(ix(x), ix(y), 3) * 1.5; }, mat((x, y, z) => hash(ix(x), ix(y) + ix(z) * 7, 9) < .2 ? TP[3] : TP[1]));
  g.box(70, 104, 1, 80, 110, 6, flat(ST[2])); g.cylX(107, 2, 2, 68, 70, rubber); g.line(80, 105, 5, 86, 104, 9, woodPost); g.line(80, 109, 5, 86, 110, 9, woodPost);
  for (let y = 2; y < Y0; y += 12) { g.box(20, y, 1, 22, y + 2, 26, woodPost); g.box(18, y, 26, 28, y + 2, 28, woodPost); }
  g.cylY(23, 30, 2.6, 0, Y0, flat(CR[1])); for (let y = 3; y < Y0; y += 8) g.cylY(23, 30, 3, y, y + 1, flat(ST[2]));
  g.cylZ(60, 26, 1.4, 42, 60, ltSteel); g.box(58, 24, 60, 63, 29, 61, darkSteel);
  tufts(g, X0, Y0, X1, Y1, 63);
}, { frames: 4, fps: 6, overlay: smokeOverlay(94, 42, 171, 44) });

// ===== Boiler house B: 6x5 Lancashire boilers under an open tin roof, guyed steel stack with
// smoke, water tank on a steel tower.
def('bld_factory_boiler_b', 'World', [6, 5], 150, g => {
  g.box(0, 0, 0, 96, 80, 1, concrete(CN, 2, 24));
  // Open shed: posts and mono-pitch roof.
  for (const x of [6, 30, 54]) for (const y of [20, 64]) g.box(x, y, 1, x + 2, y + 2, y === 20 ? 36 : 30, flat(ST[2]));
  g.shed(3, 17, 59, 69, 30, 7, 2, tin(TN, 3, 'y', 14));
  // Two boilers on brick settings.
  for (const y of [32, 52]) {
    g.box(8, y - 7, 1, 52, y + 7, 8, brick(BR, 2));
    g.cylX(y, 14, 7, 6, 50, flat(ST[2])); for (let x = 10; x < 50; x += 8) g.cylX(y, 14, 7.4, x, x + 1, darkSteel);
    g.cylX(y, 14, 7.4, 4, 6, flat(ST[1])); g.cylX(y, 16, 2, 2, 4, soot); g.set(3, y - 3, 10, glow(PAL.FI[3])); g.set(3, y - 2, 10, glow(PAL.FI[2]));
    g.cylZ(28, y, 1.2, 20, 26, ltSteel); g.box(26, y - 2, 26, 31, y + 2, 27, redPaint);
  }
  g.text('w', 3, 26, 26, 'NO1', CR[3]);
  // Flue and guyed stack.
  g.box(50, 30, 6, 72, 54, 18, brick(BR, 2));
  const sx = 72, sy = 42;
  g.box(sx - 8, sy - 8, 1, sx + 8, sy + 8, 20, brick(BR, 1)); g.box(sx - 9, sy - 9, 20, sx + 9, sy + 9, 22, coping);
  g.cylZ(sx, sy, 5, 22, 138, steel); for (let z = 30; z < 138; z += 14) g.cylZ(sx, sy, 5.5, z, z + 1, darkSteel);
  g.cylZ(sx, sy, 6, 136, 139, darkSteel); g.cylZ(sx, sy, 4, 130, 139, soot); g.cylZ(sx, sy, 3.6, 131, 139, null);
  g.paint(sx - 6, sy - 6, 110, sx + 6, sy + 6, 136, mat((x, y, z) => hash(ix(x), ix(z / 2), 4) < (z - 110) / 30 ? ST[0] : ST[1]));
  for (const [dx, dy] of [[-30, -38], [22, -40], [20, 36], [-34, 34]]) { g.line(sx, sy, 110, sx + dx, sy + dy, 1, dkSteel); g.box(sx + dx - 1, sy + dy - 1, 0, sx + dx + 2, sy + dy + 2, 2, coping); }
  // Water tank tower.
  for (const [x, y] of [[74, 62], [90, 62], [74, 76], [90, 76]]) g.box(x, y, 1, x + 2, y + 2, 44, flat(ST[1]));
  g.line(75, 63, 4, 91, 77, 40, darkSteel); g.line(91, 63, 4, 75, 77, 40, darkSteel);
  g.box(70, 58, 44, 96, 80, 62, mat((x, y, z, f) => cl(TN, 3 + ((ix(z) % 6) === 0 ? -1 : 0))));
  g.box(69, 57, 62, 97, 81, 63, darkSteel); g.text('s', 76, 79, 57, 'WATER', CR[3]);
  for (let z = 4; z < 62; z += 4) g.box(92, 79, z, 95, 80, z + 1, darkSteel);
  g.box(6, 72, 1, 28, 80, 9, mat((x, y, z) => hash(ix(x), ix(y) + ix(z) * 9, 2) < .2 ? TP[3] : TP[1]));
}, { frames: 4, fps: 6, overlay: smokeOverlay(72, 42, 139, 40) });

// ===== Works office: 9x5 three-storey brick with stone bands, central clock tower with copper
// pyramid roof and flag, columned porch with the company name.
const COP = ramp('#24443a', '#33614f', '#4a8269', '#6aa685', '#99cba8'); // verdigris copper
def('bld_factory_office', 'World', [9, 5], 128, (g, ctx) => {
  const wall = grime(brick(BR, 2), 62, 71), X0 = 6, X1 = 138, Y0 = 18, Y1 = 66, cop = mottled_(COP, 2);
  g.box(0, 6, 0, 144, 80, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 6, concrete(CN, 2)); g.box(X0, Y0, 6, X1, Y1, 60, wall);
  for (const z of [5, 24, 42]) g.box(X0 - 1, Y0 - 1, z, X1 + 1, Y1 + 1, z + 2, coping);
  g.box(X0 - 2, Y0 - 2, 58, X1 + 2, Y1 + 2, 61, coping); g.box(X0, Y0, 61, X1, Y1, 64, wall); g.box(X0 - 1, Y0 - 1, 64, X1 + 1, Y1 + 1, 65, coping);
  g.erase(X0 + 2, Y0 + 2, 62, X1 - 2, Y1 - 2, 65); g.box(X0 + 2, Y0 + 2, 61, X1 - 2, Y1 - 2, 62, tarpaper(TP, 3, 'x'));
  for (const [x, y] of [[30, 40], [112, 50]]) g.box(x, y, 62, x + 10, y + 8, 64, paneGlass);
  // Clock tower.
  const TX0 = 56, TX1 = 88;
  g.box(TX0, Y0 + 4, 1, TX1, Y1 + 4, 92, wall);
  for (const z of [24, 42, 60, 90]) g.box(TX0 - 1, Y0 + 3, z, TX1 + 1, Y1 + 5, z + 2, coping);
  for (const x of [TX0 - 1, TX1 - 3]) g.box(x, Y1 + 3, 6, x + 4, Y1 + 6, 90, brick(BR, 3));
  g.pyramid(TX0 - 3, Y0 + 1, TX1 + 3, Y1 + 7, 92, 22, cop);
  g.box(71, 42, 114, 73, 44, 124, darkSteel);
  const wind = ctx.wind;
  for (let i = 1; i <= 9; i++) for (let z = 118; z < 124; z++) g.set(72 + wind[0] * i, 43 + wind[1] * i, z - (i > 5 && hash(i, z, 3) < .3 ? 1 : 0), i < 4 ? flat(NV[3]) : i < 7 ? flat(CR[3]) : redPaint);
  for (const [f, p, c] of [['s', Y1 + 3, 72], ['n', Y0 + 4, 72]]) {
    const F = face(g, f, p);
    for (let t = -9; t <= 9; t++) for (let z = -9; z <= 9; z++) { const d = Math.hypot(t, z); if (d <= 8.6) F.put(c + t, 1, 76 + z, d > 7.4 ? flat(GD[2]) : flat(CR[3])); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; F.put(Math.round(c + Math.cos(a) * 6), 1, Math.round(76 + Math.sin(a) * 6), flat(TP[1])); }
    for (let r = 0; r <= 5; r++) F.put(c + (f === 's' ? 0 : 0), 1, 76 + r, flat(TP[1]));
    for (let r = 0; r <= 4; r++) F.put(c + (f === 's' ? r : -r), 1, 76 - Math.round(r * .4), flat(TP[1]));
  }
  for (const [f, p] of [['e', TX1 - 1], ['w', TX0]]) { const F = face(g, f, p); for (let t = -7; t <= 7; t++) for (let z = -7; z <= 7; z++) if (Math.hypot(t, z) < 6.5) F.put(Y0 + 30 + t, 1, 76 + z, Math.hypot(t, z) > 5.4 ? flat(GD[2]) : flat(CR[3])); }
  // Porch with columns and name board, steps, double door.
  g.box(TX0 - 4, Y1 + 4, 0, TX1 + 4, Y1 + 14, 4, concrete(CN, 3));
  for (let k = 0; k < 2; k++) g.box(TX0, Y1 + 14 + k * 2, 0, TX1, Y1 + 16 + k * 2, 3 - k * 1.5, concrete(CN, 3));
  for (const x of [TX0 - 2, TX0 + 9, TX1 - 10, TX1 + 1]) g.cylZ(x + .5, Y1 + 12, 1.6, 4, 24, coping);
  g.box(TX0 - 4, Y1 + 4, 24, TX1 + 4, Y1 + 15, 27, coping);
  g.box(TX0 - 4, Y1 + 14, 27, TX1 + 4, Y1 + 15, 33, blackPaint); g.text('s', 57, Y1 + 14, 32, 'WORDWING', GD[3]);
  doorOn(g, 's', 66, Y1 + 3, 4, 12, 18, { leaf: planks(WD, 1, 4), frame: coping });
  g.box(66, Y1 + 3, 18, 78, Y1 + 4, 21, glass);
  // Windows: three floors.
  for (const z of [10, 29, 47]) {
    for (const x of [12, 26, 40, 96, 110, 124]) windowOn(g, 's', x, Y1 - 1, z, 9, 12, { frame: trimWhite });
    for (const x of [124, 110, 96, 40, 26, 12]) windowOn(g, 'n', x, Y0, z, 9, 12, { frame: trimWhite });
    for (const y of [26, 46]) { windowOn(g, 'w', y, X0, z, 9, 12, { frame: trimWhite }); windowOn(g, 'e', y, X1 - 1, z, 9, 12, { frame: trimWhite }); }
    if (z > 10) windowOn(g, 's', 67, Y1 + 3, z + 2, 10, 10, { frame: trimWhite });
  }
  for (const x of [20, 120]) { g.box(x, 28, 64, x + 6, 34, 72, brick(BR, 2)); g.box(x - 1, 27, 72, x + 7, 35, 74, coping); }
  for (const x of [X0 + 1, X1 - 3]) downpipe(g, 's', x, Y1, 60);
  // Flower beds and a staff-car bollard chain.
  for (const [a, b] of [[8, 52], [92, 136]]) g.shape(a, Y1 + 1, 1, b, Y1 + 6, 6, (x, y, z) => z < 2.5 + (hash(ix(x), ix(y), 2) < .45 ? 1.5 : 0), mat((x, y, z) => hash(ix(x), ix(y) * 3 + ix(z), 7) < .12 ? (hash(ix(x), ix(y), 8) < .5 ? RD[3] : GD[3]) : GR[3 + (hash(ix(x), ix(z), 4) < .3 ? 1 : 0)]));
  for (const [a, b] of [[8, 52], [92, 136]]) g.box(a, Y1 + 6, 1, b, Y1 + 7, 2, coping);
});

// ===== Drawing office: 7x5 streamline-moderne block: rendered walls, rounded corner with ribbon
// windows, glass-block stair tower, flat roof with railing.
def('bld_factory_office_b', 'World', [7, 5], 70, g => {
  const X0 = 22, X1 = 106, Y0 = 18, Y1 = 68, R = 18, ren = grime(mottled_(WH, 3), 42, 81);
  const inside = (x, y, grow = 0) => { if (x < X0 - grow || x > X1 + grow || y < Y0 - grow || y > Y1 + grow) return false; const cx = X1 - R, cy = Y1 - R; return !(x > cx && y > cy) || Math.hypot(x - cx, y - cy) <= R + grow; };
  g.box(0, 6, 0, 112, 80, 1, concrete(CN, 2, 24));
  g.shape(X0, Y0, 1, X1, Y1, 42, (x, y) => inside(x, y), ren);
  for (const z of [4, 21, 40]) g.shape(X0 - 1, Y0 - 1, z, X1 + 1, Y1 + 1, z + 2, (x, y) => inside(x, y, 1), trimWhite);
  // Ribbon windows: a band of glass wrapped round the curved corner.
  for (const z0 of [9, 27]) g.shape(X0 - 1, Y0 - 1, z0, X1 + 1, Y1 + 1, z0 + 8, (x, y, z) => {
    if (!inside(x, y) || inside(x, y, -1.2)) return false;
    const t = x > X1 - R && y > Y1 - R ? Math.atan2(y - (Y1 - R), x - (X1 - R)) * R : (y > Y1 - 1.5 ? x : y);
    if (y < Y0 + 1.5 && x < X1 - 10) return false;
    return (((ix(t) % 8) + 8) % 8) === 0 ? flat(ST[1]) : darkGlass_();
  });
  g.box(X0 + 2, Y0 + 2, 41, X1 - 2, Y1 - 2, 42, tarpaper(TP, 2, 'x'));
  g.shape(X0, Y0, 42, X1, Y1, 48, (x, y, z) => inside(x, y) && !inside(x, y, -1.2) && (z > 46 || ix(x + y) % 5 === 0), ltSteel);
  // Glass-block stair tower and entrance canopy.
  const gb = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return (ix(u) % 3 === 0 || ix(v) % 3 === 0) ? WH[3] : (hash(ix(u / 3), ix(v / 3), 2) < .3 ? GL[3] : GL[2]); }, { flat: true });
  g.box(6, 26, 1, X0, 56, 56, ren); g.box(5, 25, 54, X0 + 1, 57, 57, trimWhite);
  g.box(10, 55, 6, 18, 57, 50, gb); g.box(5, 34, 6, 7, 48, 50, gb);
  doorOn(g, 's', 52, Y1 - 1, 1, 12, 18, { leaf: glass, frame: flat(ST[1]) });
  g.box(44, Y1, 19, 74, Y1 + 10, 21, trimWhite); for (const x of [45, 72]) g.cylZ(x, Y1 + 8, 1, 1, 19, ltSteel);
  g.box(30, Y1, 22, 88, Y1 + 1, 28, trimWhite); g.text('s', 32, Y1, 27, 'DRAWING OFFICE', NV[2]);
  for (const x of [26, 40, 60, 80]) windowOn(g, 'n', x, Y0, 10, 10, 8, { frame: trimWhite, glass: darkGlass_() });
  g.box(30, 52, 42, 40, 58, 50, ren); g.box(29, 51, 50, 41, 59, 51, trimWhite);
  // Bicycles and a hedge.
  bike(g, 80, Y1 + 6, flat(NV[3])); bike(g, 92, Y1 + 8, flat(OL[3]));
  g.shape(0, 70, 1, 40, 78, 8, (x, y, z) => ((y - 74) / 4) ** 2 + ((z - 1) / 7) ** 2 <= 1 + hash(ix(x), ix(z), 4) * .3, leaf(3, 7));
});
let _dg; const darkGlass_ = () => _dg || (_dg = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return ((ix(u) - ix(v)) % 10 + 10) % 10 < 2 ? GL[2] : GL[0]; }, { flat: true }));

// ===== Works gate: 9x3 brick piers with lamp globes, lattice arch carrying the name board, open
// steel gates, striped boom, brick gatehouse with tile roof and HALT sign.
def('bld_factory_gate', 'World', [9, 3], 70, g => {
  const pier = grime(brick(BR, 2), 40, 91);
  g.box(0, 0, 0, 144, 48, 1, concrete(CN, 2, 16));
  g.box(46, 0, 0, 98, 48, 1, mat((x, y) => hash(ix(x), ix(y), 5) < .1 ? TP[3] : TP[2]));
  g.topPaint(70, 0, 73, 48, (x, y) => (ix(y) % 8 < 4 ? flat(CR[2]) : null));
  for (const x of [36, 98]) { g.box(x, 20, 1, x + 10, 30, 40, pier); g.box(x - 1, 19, 40, x + 11, 31, 42, coping); g.box(x + 2, 22, 42, x + 8, 28, 44, coping); g.ell(x + 5, 25, 48, 3, 3, 3.5, glow(CR[3])); g.box(x + 4, 24, 44, x + 6, 26, 45, darkSteel); }
  // Lattice arch and board.
  g.shape(46, 24, 34, 98, 26, 58, (x, y, z) => { const top = 52 + 4 * Math.sin((x - 46) / 52 * Math.PI); const bot = 34 + 4 * Math.sin((x - 46) / 52 * Math.PI); if (z > top || z < bot) return false; return z > top - 1.5 || z < bot + 1.5 || (((ix(x + z) % 6) + 6) % 6) === 0 || (((ix(x - z) % 6) + 6) % 6) === 0; }, dkSteel);
  g.box(52, 26, 41, 92, 27, 50, blackPaint); g.box(52, 26, 50, 92, 27, 51, flat(GD[2])); g.box(52, 26, 40, 92, 27, 41, flat(GD[2]));
  g.text('s', 56, 26, 48, 'WORDWING', GD[3]); g.text('s', 62, 26, 42, 'WORKS', CR[3]);
  // Gates swung open (north), bars with spear tips.
  for (const x of [46, 96]) for (let y = 2; y < 20; y++) { g.box(x, y, 1, x + 2, y + 1, 2, darkSteel); if (y % 3 === 0) g.box(x, y, 1, x + 2, y + 1, 30, dkSteel); if (y % 3 === 0) g.set(x, y, 30, flat(GD[2])); g.box(x, y, 14, x + 2, y + 1, 15, darkSteel); g.box(x, y, 27, x + 2, y + 1, 28, darkSteel); }
  // Boom barrier.
  g.box(100, 34, 1, 104, 38, 12, flat(CR[2])); g.box(99, 33, 8, 106, 39, 12, redPaint);
  g.box(50, 35, 10, 100, 37, 12, stripes(RD[2], CR[3], 5)); g.box(48, 35, 1, 50, 37, 10, flat(CR[2]));
  // Gatehouse.
  const gh = grime(brick(BR, 2), 26, 92);
  g.box(110, 14, 1, 138, 42, 26, gh); g.box(109, 13, 25, 139, 43, 27, coping);
  g.hip(106, 10, 142, 46, 27, 13, rooftile(RD, 2, 'x'));
  g.box(130, 22, 36, 134, 26, 44, brick(BR, 2));
  windowOn(g, 'w', 22, 110, 10, 12, 10, { frame: trimWhite }); windowOn(g, 's', 114, 41, 10, 10, 10, { frame: trimWhite });
  doorOn(g, 's', 128, 41, 1, 7, 18, { leaf: planks(NV, 2, 4) });
  g.box(111, 41, 18, 125, 42, 24, blackPaint); g.text('s', 113, 41, 22, 'GATE', CR[3]);
  g.box(108, 30, 14, 110, 34, 18, flat(TP[2])); g.set(109, 31, 13, darkSteel);
  // HALT sign, low walls with railings either side, sandbags, lamp.
  g.box(30, 40, 1, 31, 41, 22, woodPost); g.box(24, 41, 16, 38, 42, 24, flat(CR[3])); g.text('s', 26, 41, 22, 'HALT', RD[2]);
  for (const [a, b] of [[0, 36], [138, 144]]) { g.box(a, 23, 1, b, 27, 12, pier); g.box(a, 22, 12, b, 28, 13, coping); for (let x = a + 1; x < b; x += 3) g.box(x, 24, 13, x + 1, 26, 24, dkSteel); g.box(a, 24, 22, b, 26, 23, dkSteel); }
  g.shape(4, 30, 1, 26, 40, 9, (x, y, z) => z < 9 - Math.abs(y - 35) * .8, sandbag());
  tufts(g, 110, 14, 138, 42, 93);
});

// ===== Back gate: 7x3 striped sentry box, chain-link sliding gate half open with barbed wire,
// sandbag post and pass-control board.
def('bld_factory_gate_b', 'World', [7, 3], 48, g => {
  g.box(0, 0, 0, 112, 48, 1, concrete(CN, 2, 16));
  const mesh = mat((x, y, z, f) => { const [u, v] = uv(x, y, z, f); return (((ix(u + v) % 4) + 4) % 4 === 0 || (((ix(u - v) % 4) + 4) % 4) === 0) ? ST[3] : null; });
  const post = x => { g.box(x, 22, 1, x + 2, 24, 30, flat(ST[2])); g.line(x + 1, 23, 30, x + 1, 19, 34, flat(ST[2])); };
  for (const x of [0, 20, 40, 92, 110]) post(x);
  for (const [a, b] of [[0, 42], [92, 112]]) { g.box(a, 23, 1, b, 24, 28, mesh); for (const k of [0, 1, 2]) g.line(a, 23 - k * 1.3, 30 + k * 1.3, b, 23 - k * 1.3, 30 + k * 1.3, darkSteel); }
  // Sliding leaf parked behind the west fence, on wheels.
  g.box(22, 20, 1, 60, 21, 28, mesh); g.box(22, 20, 27, 60, 21, 28, flat(ST[2])); g.box(22, 20, 2, 60, 21, 3, flat(ST[2])); g.box(59, 20, 1, 60, 21, 28, flat(ST[2]));
  for (const x of [26, 56]) g.cylY(x, 2, 1.8, 19, 22, rubber);
  // Sentry box: striped, pyramid roof.
  const sentry = stripes(CR[3], RD[2], 4);
  g.box(64, 28, 1, 76, 40, 26, sentry); g.erase(65, 34, 2, 75, 40, 24); g.box(65, 33, 2, 75, 34, 24, interior);
  g.pyramid(62, 26, 78, 42, 26, 8, flat(OL[2])); g.box(68, 32, 34, 72, 36, 36, darkSteel);
  // Sandbag post with a rifle rack, pass board.
  g.shape(78, 30, 1, 104, 46, 12, (x, y, z) => { const d = Math.hypot(x - 91, y - 38); return d < 12 && d > 7 && z < 12 - Math.max(0, d - 10) * 2; }, sandbag());
  for (const x of [8, 30]) g.box(x, 40, 1, x + 1, 41, 22, woodPost);
  g.box(6, 41, 12, 33, 42, 22, flat(CR[3])); g.text('s', 8, 41, 20, 'NO ENTRY', RD[2]); g.text('s', 8, 41, 14, 'PASS ONLY', TP[1]);
  g.box(64, 42, 1, 76, 46, 4, planks(WD, 2, 2)); g.cylZ(80, 44, 1.6, 1, 6, flat(OL[3]));
});

// ===== Alloy stores: 10x6 open-fronted steel shed, camouflaged mono-pitch roof, racks of
// aluminium sheet and tube stock, closed brick end bay with a door.
def('bld_factory_store', 'World', [10, 6], 66, g => {
  const X0 = 6, X1 = 154, Y0 = 14, Y1 = 82;
  g.box(0, 6, 0, 160, 96, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y0 + 3, 44, tin(TN, 2, 'y', 18));
  for (let x = X0; x < 116; x += 22) g.box(x, Y1 - 2, 1, x + 3, Y1, 36, flat(ST[2]));
  g.shed(X0 - 3, Y0 - 4, X1 + 3, Y1 + 4, 36, 10, 2, camoTin(2, 23, .04));
  g.shape(X0, Y0, 36, X0 + 2, Y1, 47, (x, y, z) => z < 36 + 10 * (1 - (y - Y0 + 4) / (Y1 - Y0 + 8)) + 1, tin(TN, 2, 'y'));
  g.box(X0, Y0, 1, X0 + 2, Y1, 36, tin(TN, 2, 'y', 18));
  // Sheet stacks on bearers.
  const sheet = s => mat((x, y, z, f) => f === 'u' ? AL[3 + (hash(ix(x / 9), ix(y / 7), s) < .3 ? 1 : 0)] : (ix(z) % 2 ? AL[2] : AL[4]));
  for (const [x, y, h, s] of [[12, 56, 10, 1], [36, 58, 7, 2], [60, 56, 12, 3], [84, 60, 5, 4]]) {
    g.box(x, y, 1, x + 20, y + 16, 3, woodDark); g.box(x + 1, y + 1, 3, x + 19, y + 15, 3 + h, sheet(s));
    g.box(x - 1, y + 4, 1, x + 21, y + 6, 4, woodDark);
  }
  // Leaning sheet rack against the back wall and tube cantilever rack.
  for (let x = 12; x < 70; x += 3) g.line(x, Y0 + 4, 1, x + 1, Y0 + 12, 30, sheet(x), .5);
  for (const x of [80, 98, 110]) { g.box(x, Y0 + 3, 1, x + 2, Y0 + 5, 34, darkSteel); for (const z of [8, 18, 28]) g.box(x, Y0 + 3, z, x + 2, Y0 + 18, z + 1, darkSteel); }
  for (const z of [9, 19, 29]) for (let k = 0; k < 6; k++) g.cylX(Y0 + 6 + k * 2, z + 1.5, 1, 78, 114, k % 2 ? flat(AL[2]) : flat(AL[3]));
  // Brick end bay.
  const brk = grime(brick(BR, 2), 36, 101);
  g.box(116, Y0 + 3, 1, X1, Y1, 36, brk);
  doorOn(g, 's', 124, Y1 - 1, 1, 16, 24, { leaf: tin(OL, 2, 'y', 8), frame: coping });
  windowOn(g, 'e', 30, X1 - 1, 14, 12, 10, { frame: coping, glass: paneGlass, bars: false }); windowOn(g, 'e', 54, X1 - 1, 14, 12, 10, { frame: coping, glass: paneGlass, bars: false });
  g.box(118, Y1, 28, 152, Y1 + 1, 35, blackPaint); g.text('s', 124, Y1, 33, 'ALLOYS', CR[3]);
  // Hand trolley with sheets, offcut bin.
  g.box(40, 84, 2, 62, 92, 4, flat(OL[2])); for (const x of [42, 60]) for (const y of [85, 91]) g.cylX(y, 2, 1.6, x - 1, x + 1, rubber);
  g.box(41, 85, 4, 61, 91, 7, sheet(9)); g.line(62, 88, 4, 68, 88, 12, darkSteel);
  g.box(80, 84, 1, 92, 92, 9, flat(OL[2])); g.box(81, 85, 9, 91, 91, 10, aluFlat);
  tufts(g, X0, Y0, X1, Y1, 103, 1, .3);
});

// ===== Stores B: 8x5 brick warehouse with a loading dock under a canopy, one door open on
// crates, ramp, drums and a stencilled number.
def('bld_factory_store_b', 'World', [8, 5], 74, g => {
  const X0 = 6, X1 = 122, Y0 = 10, Y1 = 56, wall = grime(brick(BR, 2), 34, 111);
  g.box(0, 2, 0, 128, 80, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 34, wall); g.box(X0 - 1, Y0 - 1, 32, X1 + 1, Y1 + 1, 34, coping);
  gableRoofX(g, 2, 126, Y0 - 5, Y1 + 5, 34, 18, tin(TN, 3, 'x', 20), wall, X0, X1, 5);
  for (const [f, p] of [['w', X0], ['e', X1 - 1]]) oculus(g, f, (Y0 + Y1) / 2, p, 42, 4);
  // Dock and canopy.
  g.box(X0, Y1, 0, X1, Y1 + 14, 8, concrete(CN, 3, 12));
  g.shape(X1, Y1, 0, X1 + 6, Y1 + 14, 8, (x, y, z) => z < 8 * (1 - (x - X1) / 6), concrete(CN, 3));
  for (const x of [16, 52, 88]) g.box(x, Y1 + 14, 2, x + 6, Y1 + 15, 7, rubber);
  g.shed(X0 - 2, Y1 - 1, X1 + 2, Y1 + 18, 26, 4, 1, tin(TN, 3, 'y', 14));
  for (const x of [X0, 62, X1 - 2]) g.line(x, Y1 + 1, 30, x, Y1 + 16, 27, darkSteel);
  g.erase(18, Y1 - 12, 8, 46, Y1, 30); g.box(18, Y1 - 13, 8, 46, Y1 - 12, 30, interior);
  for (const [x, z] of [[20, 8], [31, 8], [24, 17]]) g.box(x, Y1 - 10, z, x + 10, Y1 - 2, z + 9, lit(planks(WD, 2, 2)));
  g.box(46, Y1, 8, 74, Y1 + 2, 30, tin(OL, 2, 'y', 14)); g.box(14, Y1, 30, 78, Y1 + 2, 32, darkSteel);
  g.box(80, Y1, 8, 108, Y1 + 1, 30, tin(OL, 2, 'y', 14)); g.box(78, Y1, 30, 110, Y1 + 2, 32, darkSteel);
  g.text('s', 87, Y1, 26, 'STORES', CR[3]);
  g.text('s', 57, Y1 + 1, 26, '7', CR[3], 2);
  // Dock cargo.
  g.box(52, Y1 + 4, 8, 60, Y1 + 12, 16, planks(WD, 2, 2)); g.box(61, Y1 + 5, 8, 68, Y1 + 12, 14, planks(WD, 3, 2)); g.text('s', 53, Y1 + 11, 14, 'WW', TP[1]);
  for (const [x, y, c] of [[96, Y1 + 6, OL[2]], [101, Y1 + 8, OL[3]], [96, Y1 + 11, RD[1]]]) { g.cylZ(x, y, 2.4, 8, 17, flat(c)); g.cylZ(x, y, 2.5, 12, 13, darkSteel); }
  g.box(24, Y1 + 6, 8, 36, Y1 + 12, 10, woodDark); g.line(36, Y1 + 9, 10, 42, Y1 + 9, 16, darkSteel);
  for (const x of [28, 98]) windowOn(g, 'n', x, Y0, 16, 10, 8, { frame: coping, glass: paneGlass, bars: false });
  doorOn(g, 'n', 60, Y0, 1, 9, 20, { leaf: planks(OL, 2, 4), frame: coping });
  tufts(g, X0, Y0, X1, Y1, 113);
});

// ===== Works canteen: 8x5 cream clapboard, red tile roof, brick chimney with smoke, serving
// hatch under a striped awning, benches, bicycle rack and a chalk menu board.
def('bld_factory_canteen', 'World', [8, 5], 90, g => {
  const X0 = 6, X1 = 106, Y0 = 16, Y1 = 60, wall = grime(planks(CR, 2, 3), 32, 121);
  g.box(0, 6, 0, 128, 80, 1, concrete(CN, 2, 24));
  g.box(X0, Y0, 1, X1, Y1, 5, brick(BR, 2)); g.box(X0, Y0, 5, X1, Y1, 32, wall); g.box(X0 - 1, Y0 - 1, 31, X1 + 1, Y1 + 1, 33, trimGreen);
  gableRoofX(g, 2, 110, Y0 - 6, Y1 + 6, 33, 20, rooftile(RD, 2, 'x'), wall, X0, X1, 6);
  g.box(80, 22, 36, 88, 30, 64, brick(BR, 2)); g.box(79, 21, 64, 89, 31, 66, coping); g.cylZ(84, 26, 1.6, 65, 68, soot);
  // Front: door with porch, windows with flower boxes, sign.
  doorOn(g, 's', 34, Y1 - 1, 5, 10, 22, { leaf: planks(PT, 1, 4), frame: trimGreen });
  g.box(30, Y1, 0, 48, Y1 + 6, 5, concrete(CN, 3)); g.shed(28, Y1 - 1, 50, Y1 + 8, 28, 3, 1, tin(TN, 3, 'y'));
  for (const x of [29, 48]) g.box(x, Y1 + 6, 5, x + 1, Y1 + 7, 30, woodPost);
  for (const x of [12, 56, 72, 88]) { windowOn(g, 's', x, Y1 - 1, 14, 10, 10, { frame: trimGreen }); g.box(x - 1, Y1, 11, x + 11, Y1 + 3, 13, woodDark); for (let k = 0; k < 10; k += 2) g.set(x + k, Y1 + 1, 13, flat(k % 4 ? RD[3] : GD[3])); }
  g.box(52, Y1, 25, 104, Y1 + 1, 31, flat(GR[3])); g.text('s', 53, Y1, 29, 'WORKS CANTEEN', CR[3]);
  // East serving hatch with striped awning and counter.
  windowOn(g, 'e', 30, X1 - 1, 12, 16, 10, { frame: trimGreen, glass: interior, bars: false });
  g.box(X1, 29, 11, X1 + 4, 47, 12, planks(WD, 3, 2));
  g.shape(X1, 27, 22, X1 + 10, 49, 28, (x, y, z) => Math.abs(z - (27 - (x - X1) * .45)) < 1, stripes(RD[2], CR[3], 3));
  for (const [y, c] of [[34, CR[3]], [38, CR[3]], [43, ST[3]]]) g.cylZ(X1 + 2, y, 1.2, 12, 14, flat(c));
  // Tables with benches, bike rack, menu board, bins.
  for (const x of [58, 86]) { g.box(x, 66, 6, x + 16, 72, 7, planks(WD, 3, 2)); for (const dx of [1, 14]) g.box(x + dx, 68, 1, x + dx + 1, 70, 6, woodPost); for (const y of [63, 74]) { g.box(x, y, 3, x + 16, y + 2, 4, planks(WD, 2, 2)); g.box(x + 1, y, 1, x + 2, y + 2, 3, woodPost); g.box(x + 14, y, 1, x + 15, y + 2, 3, woodPost); } }
  g.set(64, 68, 7, flat(CR[3])); g.set(92, 69, 7, flat(CR[3]));
  g.box(4, 70, 1, 44, 71, 4, darkSteel); bike(g, 6, 72); bike(g, 20, 73, flat(NV[3])); bike(g, 32, 72, flat(OL[3]));
  g.line(106, 66, 1, 107, 63, 18, woodPost); g.line(127, 66, 1, 126, 63, 18, woodPost);
  g.box(104, 63, 6, 130, 64, 18, flat(TP[1])); g.text('s', 106, 63, 16, 'TEA 1D', CR[3]); g.text('s', 106, 63, 10, 'STEW', CR[2]);
  for (const x of [10, 15]) { g.cylZ(x, 10, 2.3, 1, 9, steel); g.cylZ(x, 10, 2.5, 9, 10, ltSteel); }
  for (const [f, p] of [['w', X0]]) { windowOn(g, f, 24, p, 14, 10, 10, { frame: trimGreen }); windowOn(g, f, 42, p, 14, 8, 10, { frame: trimGreen }); }
  for (const x of [90, 60, 24]) windowOn(g, 'n', x, Y0, 14, 10, 10, { frame: trimGreen });
  doorOn(g, 'n', 70, Y0, 5, 9, 20, { leaf: planks(PT, 1, 4), frame: trimGreen });
}, { frames: 4, fps: 6, overlay: smokeOverlay(84, 26, 67, 30) });

function extra(add) {}

module.exports = { extra };

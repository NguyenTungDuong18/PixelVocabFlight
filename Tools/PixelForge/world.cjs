'use strict';
// WORDWING 0.15 world models: buildings, props, vehicles and parked aircraft of a 1944
// airbase. Every model is an independent voxel recipe (see voxel.cjs) rendered in four
// facings, so any map can reuse it. Model-local space: x east, y south, z up; the front
// (door, nose, muzzle) always faces +y in the recipe and turns with the facing.
const { PAL, LIVERY, K, ramp, hash, fbm, withAlpha, dither } = require('./lib.cjs');
const { Model, mat, renderModel, textWidth } = require('./voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, FI, SM, GR, SN } = PAL;

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

// ===== Hangar: corrugated arch, sliding doors half open, lean-to annexes on both sides.
def('bld_hangar', 'World', [10, 8], 92, g => {
  const roof = tin(TN, 3, 'x', 16), wall = tin(TN, 2, 'y', 20), rib = flat(ST[2]);
  const cx = 80, rx = 66, rz = 78, y0 = 6, y1 = 124;
  g.box(-2, y0 - 2, 0, 162, y1 + 3, 1, concrete(CN, 2));
  g.vaultY(y0, y1, cx, rx, 0, rz, roof);
  // Raised arch ribs every 16 px and at both ends.
  for (let y = y0; y < y1; y += 16) g.shape(cx - rx - 1, y, 0, cx + rx + 1, y + 1, rz + 2, (x, yy, z) => { const r = ((x - cx) / (rx + 1)) ** 2 + (z / (rz + 1)) ** 2; return r <= 1 && r > .9; }, rib);
  for (const ye of [y0 - 1, y1]) g.shape(cx - rx - 2, ye, 0, cx + rx + 2, ye + 2, rz + 3, (x, yy, z) => { const r = ((x - cx) / (rx + 2)) ** 2 + (z / (rz + 2)) ** 2; return r <= 1 && r > .86; }, flat(ST[1]));
  // Skylight strips on the upper arch.
  for (let y = y0 + 4; y < y1 - 6; y += 16) for (const side of [-1, 1]) { const a = cx + side * 34, b = cx + side * 26; g.shape(Math.min(a, b), y, 30, Math.max(a, b), y + 9, rz + 1, (x, yy, z) => g.has(x, yy, z) && !g.has(x, yy, z + 1), mat(() => GL[1])); }
  // Front gable wall: vertical ribbed tin; door opening with panels slid apart.
  g.paint(cx - rx, y1 - 1, 0, cx + rx, y1, rz, wall);
  const dx0 = 26, dx1 = 134, dh = 50;
  g.erase(58, y1 - 10, 1, 102, y1, dh);
  g.box(58, y1 - 10, 1, 102, y1 - 9, dh, interior);
  g.box(58, y1 - 10, 0, 102, y1, 1, concrete(CN, 1));
  // Parked fighter tail glimpsed inside.
  g.box(77, y1 - 9, 6, 83, y1 - 8, 24, flat(OL[2])); g.box(70, y1 - 9, 6, 90, y1 - 8, 9, flat(OL[1]));
  const door = tin(OL, 2, 'y', 18);
  for (const [a, b] of [[dx0, 58], [102, dx1]]) { g.box(a, y1, 1, b, y1 + 2, dh, door); for (let x = a; x < b; x += 16) g.box(x, y1 + 2, 1, x + 1, y1 + 3, dh, flat(OL[1])); }
  // Stacked slid panels in front of the outer panels.
  g.box(42, y1 + 2, 1, 58, y1 + 4, dh, door); g.box(102, y1 + 2, 1, 118, y1 + 4, dh, door);
  // Door track header and lamps.
  g.box(dx0 - 4, y1, dh, dx1 + 4, y1 + 5, dh + 4, flat(ST[1]));
  for (const x of [40, 80, 120]) { g.line(x, y1 + 5, dh + 8, x, y1 + 8, dh + 6, darkSteel); g.box(x - 1, y1 + 7, dh + 4, x + 2, y1 + 10, dh + 6, flat(ST[3])); g.set(x, y1 + 9, dh + 3, lampGlow); }
  // Hangar number on the gable.
  g.text('s', 63, y1 - 1, dh + 19, 'H-2', CR[2], 3);
  // Louvre vents either side of the number.
  for (const x0 of [40, 106]) for (let x = x0; x < x0 + 14; x++) for (let z = dh + 6; z < dh + 13; z++) if (z % 2 === 0) g.set(x, y1, z, darkSteel);
  // Lean-to annexes: west one with office door/windows, east one a tool store.
  const shedRoof = tin(TN, 2, 'y', 12);
  for (const [a, b] of [[0, 16], [144, 160]]) {
    g.box(a, 20, 0, b, 112, 24, planks(WD, 2, 3));
    g.shape(a - 1, 18, 22, b + 1, 114, 32, (x, y, z) => { const t = a === 0 ? (x - a + 1) / (b - a + 2) : (b + 1 - x) / (b - a + 2); return z < 22 + 4 + t * 6 && z >= 22 + t * 6; }, shedRoof);
  }
  windowOn(g, 'w', 34, 0, 9, 10, 8); windowOn(g, 'w', 62, 0, 9, 10, 8); doorOn(g, 'w', 86, 0, 0, 8, 19);
  windowOn(g, 's', 4, 111, 9, 8, 8, { bars: false });
  doorOn(g, 'e', 40, 159, 0, 12, 19, { leaf: planks(PT, 1, 4) }); windowOn(g, 'e', 74, 159, 9, 10, 8);
  // Rear wall: personnel door and stove pipe.
  doorOn(g, 'n', 70, y0, 0, 9, 22, { leaf: planks(TN, 2, 3) });
  windowOn(g, 'n', 96, y0, 14, 12, 7);
  g.cylZ(10, 30, 1.5, 24, 40, darkSteel);
  // Stencil "NO SMOKING" plate by the door and fire bucket rack.
  g.box(20, y1, 18, 24, y1 + 1, 26, redPaint);
  for (const x of [20.5, 23.5]) g.cylZ(x, y1 + 2.5, 1.5, 6, 10, redPaint);
  g.box(19, y1 + 1, 10, 26, y1 + 4, 11, darkSteel);
});

// ===== Jeep (Willys MB style).
def('veh_jeep', 'Vehicles', [2, 3], 30, g => {
  const od = olive(5, 2), odDark = flat(OL[1]);
  for (const [cy] of [[12], [38]]) { wheelX(g, 5, cy, 5.5, 5.5, 3, 8); wheelX(g, 27, cy, 5.5, 5.5, 24, 29); }
  // Chassis, rear tub, hood, flat fenders.
  g.box(6, 4, 4, 26, 46, 6, odDark);
  g.box(5, 5, 6, 27, 31, 15, od);
  g.erase(7, 7, 10, 25, 30, 15);
  g.box(8, 31, 6, 24, 45, 15, od);
  g.box(8, 31, 14, 24, 45, 15, olive(6, 3));
  for (const [a, b] of [[3, 8], [24, 29]]) { g.box(a, 32, 11, b, 46, 13, od); g.box(a, 4, 11, b, 18, 13, od); }
  // Grille (vertical slots) and headlights.
  for (let x = 9; x < 23; x++) for (let z = 6; z < 14; z++) g.set(x, 45, z, x % 2 ? flat(OL[1]) : darkSteel);
  for (const x of [5, 26]) { g.cylY(x + .5, 12.5, 1.6, 45, 47, glow(CR[3])); }
  g.box(4, 46, 4, 28, 48, 7, steel);
  // Windshield frame and glass.
  g.box(7, 30, 15, 25, 32, 16, od); g.box(7, 30, 24, 25, 32, 25, od);
  g.box(7, 30, 16, 8, 32, 24, od); g.box(24, 30, 16, 25, 32, 24, od); g.box(15.5, 30, 16, 16.5, 32, 24, od);
  g.box(8, 31, 16, 24, 32, 24, glass);
  // Seats, steering wheel (left-hand drive: driver on the vehicle's left = +x).
  const seat = canvasMat(CV, 1, 6);
  for (const x0 of [9, 17]) { g.box(x0, 22, 8, x0 + 6, 28, 11, seat); g.box(x0, 21, 11, x0 + 6, 22, 18, seat); }
  g.box(9, 9, 8, 23, 15, 11, seat); g.box(9, 8, 11, 23, 9, 17, seat);
  g.line(20, 29, 17, 20, 27, 14, darkSteel); g.shape(17, 28, 16, 24, 30, 19, (x, y, z) => Math.abs(Math.hypot(x - 20.5, z - 17.5) - 2.5) < .8, darkSteel);
  // Spare wheel and jerrycan on the rear, antenna whip.
  g.cylY(16, 13, 5, 2, 5, rubber); g.cylY(16, 13, 2, 1.5, 5, steel);
  g.box(22, 2, 5, 26, 5, 14, flat(OL[3]));
  g.line(24, 6, 12, 24, 6, 29, darkSteel);
  // Star roundel on the hood and serial stencil on the bumper.
  g.bitmap('u', 13, 34, 14, [' ccc ', 'cgggc', 'cgygc', 'cgggc', ' ccc '], { c: CR[2], g: OL[2], y: GD[2] });
  g.text('s', 9, 47, 6, '2', CR[2]); g.text('s', 20, 47, 6, '7', CR[2]);
});

// ===== Parked fighter: SKYLARK MK.I, same livery as fighter_level (olive, cream bands,
// cream/gold roundels, red spinner). Tail-dragger, nose (+y) slightly raised.
def('air_fighter', 'Aircraft', [4, 4], 34, g => {
  const zc = y => 7 + y / 60 * 6;
  const skin = mat((x, y, z, f) => { const n = fbm(x * .2, y * .2, 11); return n > .57 ? OL[1] : OL[2]; });
  const skinTop = mat((x, y, z, f) => { const n = fbm(x * .2, y * .2, 11); return f === 'u' ? (n > .57 ? OL[2] : OL[3]) : (n > .57 ? OL[1] : OL[2]); });
  // Fuselage radius along y.
  const rad = y => y < 2 ? 0 : y < 14 ? 1.6 + (y - 2) / 12 * 2 : y < 34 ? 3.6 + (y - 14) / 20 * 1.9 : y < 52 ? 5.5 : y < 56 ? 5.5 - (y - 52) * .35 : 0;
  g.shape(26, 1, 0, 38, 57, 26, (x, y, z) => { const r = rad(y); return r > 0 && (x - 32) ** 2 + ((z - zc(y)) * 1.1) ** 2 <= r * r; }, skinTop);
  // Low wing with dihedral; chord 14 at root tapering to 8; elliptical tips.
  const wingLE = x => 46 - Math.abs(x - 32) * .06, wingTE = x => 33 + Math.abs(x - 32) * .14;
  g.shape(2, 30, 0, 62, 47, 20, (x, y, z) => {
    const ax = Math.abs(x - 32), span = 29.5;
    if (ax > span) return false;
    const tip = Math.sqrt(Math.max(0, 1 - Math.max(0, ax - 22) ** 2 / 64));
    const mid = (wingLE(x) + wingTE(x)) / 2, half = (wingLE(x) - wingTE(x)) / 2 * tip;
    const zw = zc(y) - 3 + ax * .09;
    return Math.abs(y - mid) <= half && z >= zw && z < zw + 1.6;
  }, skinTop);
  // Tailplane and fin.
  g.shape(17, 2, 0, 47, 12, 22, (x, y, z) => { const ax = Math.abs(x - 32); return ax < 15 && y > 3 + ax * .2 && y < 10.5 - ax * .12 && Math.abs(z - zc(y) - .5) < .8; }, skinTop);
  g.shape(31, 1, 0, 33, 14, 30, (x, y, z) => { const top = zc(y) + 13 - (y - 2) * .1; return z >= zc(y) && z <= top && y > 2 + (z - zc(y)) * .25 && y < 13 - (z - zc(y)) * .45; }, skin);
  g.box(31, 2, 7, 33, 4, 20, flat(OL[1]));
  // Canopy bubble and headrest.
  g.ell(32, 37, zc(37) + 4, 2.6, 6, 4.2, glass);
  g.box(31, 30, zc(30) + 4, 33, 32, zc(30) + 7, flat(OL[1]));
  // Cowling, exhausts, red spinner.
  g.shape(26, 47, 0, 38, 56, 26, (x, y, z) => (x - 32) ** 2 + ((z - zc(y)) * 1.1) ** 2 <= rad(y) ** 2, mottled(OL, 1, 13, .6, .3));
  for (let y = 48; y < 53; y += 2) for (const x of [26, 37]) g.set(x, y, zc(y) + 1, darkSteel);
  g.shape(28, 55, 0, 36, 61, 26, (x, y, z) => { const r = 3.2 * (1 - (y - 55) / 6.5); return (x - 32) ** 2 + (z - zc(55)) ** 2 <= r * r; }, mat((x, y, z) => (y > 58 ? RD[3] : RD[2])));
  // Three-blade propeller standing still, one blade up.
  for (const a of [90, 210, 330]) {
    const r = a * Math.PI / 180, z0 = zc(56);
    g.line(32 + Math.cos(r) * 2, 57.5, z0 + Math.sin(r) * 2, 32 + Math.cos(r) * 12.5, 57.5, z0 + Math.sin(r) * 12.5, flat(ST[1]), .6);
    g.set(32 + Math.cos(r) * 12.5, 57, z0 + Math.sin(r) * 12.5, flat(GD[2]));
  }
  // Main gear legs, wheels, tail wheel.
  for (const x of [23, 41]) { g.line(x, 41, zc(41) - 3, x, 42, 4, darkSteel, .6); g.cylX(42, 3.6, 3.6, x - 1.5, x + 1.5, rubber); g.cylX(42, 3.6, 1.4, x - 1.6, x + 1.6, steel); g.box(x - 2, 40, 6, x + 2, 44, 7, flat(OL[1])); }
  g.line(32, 4, zc(4) - 1, 32, 4.5, 2, darkSteel); g.cylX(4.5, 1.6, 1.6, 31, 33, rubber);
  // Livery: cream recognition bands, roundels, fuselage band, number 01, nav lights.
  g.shape(0, 0, 0, 64, 64, 34, (x, y, z) => { const ax = Math.abs(x - 32); return ax >= 19 && ax < 22 && y > 30 && y < 48 && g.has(x, y, z) && !g.has(x, y, z + 1); }, cream);
  g.shape(26, 15, 0, 38, 19, 26, (x, y, z) => g.has(x, y, z), cream);
  const gold = flat(GD[2]);
  for (const sx of [-1, 1]) {
    const rcx = 32 + sx * 13, rcy = 39;
    g.shape(rcx - 4, rcy - 4, 0, rcx + 4, rcy + 4, 26, (x, y, z) => { const d = Math.hypot(x - rcx, y - rcy); return d <= 3.6 && g.has(x, y, z) && !g.has(x, y, z + 1) ? (d <= 1.7 ? gold : cream) : false; });
  }
  g.text('w', 26, 30, 13, '01', CR[2]);
  g.text('e', 37, 36, 13, '01', CR[2]);
  g.set(32 + 29, 40, zc(40) - 3 + 29 * .09 + 1, glow(RD[4]));
  g.set(32 - 29, 40, zc(40) - 3 + 29 * .09 + 1, glow(PAL.GN));
  for (const sx of [-1, 1]) g.set(32 + sx * 16, 46, zc(46) - 3 + 16 * .09, darkSteel);
});

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

// ===== Control tower: two storeys, glass cab, checkered balcony and roof fascia, stair.
def('bld_control_tower', 'World', [5, 5], 124, g => {
  const wall = mottled(WH, 3, 2, .78, .12), plinth = concrete(CN, 2), slab = concrete(CN, 3);
  const check = checker(GD[2], TP[1], 4, CN[3]);
  g.box(8, 12, 0, 72, 70, 4, plinth);
  g.box(9, 13, 4, 71, 69, 56, wall);
  g.box(8, 12, 36, 72, 70, 38, slab);
  // Balcony, checker fascia, railing (gap where the stair lands).
  g.box(3, 6, 56, 72, 76, 60, check);
  railing(g, 3, 6, 72, 76, 60, 7, trimWhite, 4);
  g.erase(71, 14, 60, 72, 22, 67);
  // Glass cab with mullions, sill and checkered roof.
  g.box(18, 20, 60, 62, 62, 64, wall);
  g.box(18, 20, 64, 62, 62, 80, glass);
  g.erase(19, 21, 64, 61, 61, 80);
  for (let x = 18; x <= 61; x += 6) { g.box(x, 20, 64, x + 1, 21, 80, trimWhite); g.box(x, 61, 64, x + 1, 62, 80, trimWhite); }
  for (let y = 20; y <= 61; y += 6) { g.box(18, y, 64, 19, y + 1, 80, trimWhite); g.box(61, y, 64, 62, y + 1, 80, trimWhite); }
  for (const [x, y] of [[18, 20], [61, 20], [18, 61], [61, 61]]) g.box(x, y, 64, x + 1, y + 1, 80, trimWhite);
  g.box(18, 20, 71, 62, 62, 72, trimWhite); g.erase(19, 21, 71, 61, 61, 72);
  g.box(30, 30, 85, 38, 36, 87, flat(CN[1])); g.box(31, 31, 87, 37, 35, 88, flat(ST[2]));
  g.box(20, 22, 64, 60, 60, 67, flat(WD[1]));  // consoles inside the cab
  g.box(15, 17, 80, 65, 65, 84, check);
  g.box(16, 18, 84, 64, 64, 85, flat(CN[2]));
  // Roof gear: radio mast with yards, rotating beacon, siren, anemometer.
  g.box(50, 26, 85, 52, 28, 120, darkSteel);
  g.box(43, 26, 110, 59, 28, 111, darkSteel); g.box(46, 26, 116, 56, 28, 117, darkSteel);
  g.set(50, 26, 120, glow(RD[4])); g.set(51, 26, 120, glow(RD[4]));
  g.cylZ(26, 28, 2.5, 85, 87, flat(ST[2])); g.cylZ(26, 28, 1.6, 87, 91, glow(GD[3])); g.box(25, 27, 91, 27, 29, 92, flat(ST[1]));
  g.cylY(38, 89, 2.2, 54, 60, flat(ST[3])); g.box(37, 56, 85, 39, 58, 87, darkSteel);
  g.box(58, 56, 85, 59, 57, 96, darkSteel); for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.set(58 + dx, 56 + dy, 96, flat(ST[3]));
  // Ground floor front: double door, canopy with CONTROL lettering, steps, lamps.
  doorOn(g, 's', 34, 68, 4, 12, 26, { leaf: planks(NV, 2, 4) });
  g.box(39.5, 67, 4, 40.5, 68, 30, flat(NV[1]));
  g.box(24, 69, 30, 56, 76, 36, slab);
  g.text('s', 27, 75, 35, 'CONTROL', TP[1]);
  steps(g, 30, 50, 70, 2, plinth, 1, 2, 3);
  for (const x of [30, 49]) { g.box(x, 69, 24, x + 2, 71, 27, flat(ST[2])); g.set(x, 70, 23, lampGlow); g.set(x + 1, 70, 23, lampGlow); }
  // Windows: ground floor, operations room above, sides and back.
  for (const x of [14, 54]) windowOn(g, 's', x, 68, 12, 12, 14);
  for (const x of [13, 27, 43, 57]) windowOn(g, 's', x, 68, 42, 10, 10);
  for (const [face, p] of [['w', 9], ['e', 70]]) { for (const y of [20, 46]) windowOn(g, face, y, p, 12, 10, 14); for (const y of [18, 32, 46]) windowOn(g, face, y, p, 42, 9, 10); }
  for (const x of [56, 30, 16]) windowOn(g, 'n', x, 13, 42, 9, 10);
  windowOn(g, 'n', 30, 13, 14, 9, 12);
  doorOn(g, 'n', 56, 13, 4, 9, 24, { leaf: planks(NV, 2, 4) });
  // External steel stair up the east side to the balcony.
  for (let k = 0; k < 13; k++) g.box(72, 68 - 4 * (k + 1), 4 + 4 * k, 78, 68 - 4 * k, 6 + 4 * k, flat(ST[2]));
  g.line(78.5, 70, 0, 78.5, 16, 58, darkSteel, .6); g.line(72, 70, 0, 72, 16, 58, darkSteel, .5);
  g.line(78.5, 70, 9, 78.5, 16, 66, flat(ST[3]));
  for (let y = 66; y > 16; y -= 12) g.line(78.5, y, (70 - y) * 58 / 54, 78.5, y, (70 - y) * 58 / 54 + 9, flat(ST[3]));
  g.box(72, 14, 56, 79, 22, 58, flat(ST[2]));
  // Painted board with the station call sign under the cab sill.
  g.text('s', 30, 61, 63, 'WW-44', TP[1]);
});

// ===== Headquarters: brick, hipped clay-tile roof, columned portico with pediment.
def('bld_hq', 'World', [8, 5], 78, g => {
  const wall = brick(BR, 2), base = concrete(CN, 2), tile = rooftile(RD, 2, 'x');
  g.box(2, 12, 0, 126, 68, 3, base);
  g.box(4, 14, 3, 124, 66, 36, wall);
  g.box(3, 13, 34, 125, 67, 37, trimWhite);
  g.hip(0, 8, 128, 72, 37, 26, tile);
  for (const x of [22, 100]) { g.box(x, 28, 50, x + 7, 35, 70, brick(BR, 2)); g.box(x - 1, 27, 70, x + 8, 36, 72, flat(CN[3])); g.box(x + 2, 30, 72, x + 5, 33, 74, flat(TP[1])); }
  // Portico.
  g.box(44, 66, 0, 84, 76, 4, base);
  steps(g, 48, 80, 76, 2, base, 1, 2, 2);
  for (const x of [46, 55, 72, 81]) { g.cylZ(x + .5, 74, 1.6, 4, 36, trimWhite); g.box(x - 1, 72, 4, x + 2, 76, 5, trimWhite); }
  g.box(43, 64, 36, 85, 77, 38, trimWhite);
  g.gableY(62, 78, 42, 86, 38, 14, tile);
  g.shape(44, 77, 38, 84, 78, 52, (x, y, z) => Math.abs(x - 64) <= 19 * (1 - (z - 38) / 14) - 2.5, trimWhite);
  g.text('s', 61, 77, 44, 'HQ', TP[1]);
  // Double door with fanlight, lamps.
  doorOn(g, 's', 58, 65, 3, 12, 27, { leaf: planks(WD, 1, 4) });
  g.box(63.5, 64, 3, 64.5, 65, 30, flat(WD[0]));
  g.box(58, 64, 27, 70, 65, 30, glass);
  for (const x of [53, 75]) { g.box(x, 66, 22, x + 2, 68, 26, flat(ST[1])); g.set(x, 67, 21, lampGlow); g.set(x + 1, 67, 21, lampGlow); }
  // Windows with green shutters.
  for (const x of [10, 26, 92, 108]) windowOn(g, 's', x, 65, 12, 10, 16, { shutters: trimGreen });
  for (const x of [112, 92, 26]) windowOn(g, 'n', x, 14, 12, 10, 16, { shutters: trimGreen });
  doorOn(g, 'n', 66, 14, 3, 10, 26, { leaf: planks(WD, 1, 4) });
  for (const y of [22, 44]) { windowOn(g, 'w', y, 4, 12, 10, 16, { shutters: trimGreen }); windowOn(g, 'e', y, 123, 12, 10, 16, { shutters: trimGreen }); }
  // Notice board on posts in front of the west wing.
  for (const x of [8, 39]) g.box(x, 74, 0, x + 1, 75, 16, woodPost);
  g.box(6, 75, 8, 42, 76, 17, blackPaint);
  g.box(6, 75, 17, 42, 76, 18, trimWhite);
  g.text('s', 10, 75, 15, 'COMMAND', CR[2]);
  // Flower beds along the facade.
  for (const [a, b] of [[6, 42], [86, 122]]) g.shape(a, 66, 0, b, 70, 4, (x, y, z) => z < 2.5 + (hash(ix(x), ix(y), 2) < .4 ? 1 : 0), leaf(3, 4));
});

// ===== Barracks: Quonset hut, plywood end walls with doors, entry vestibule, dormers.
def('bld_barracks', 'World', [8, 4], 48, g => {
  const shell = tin(TN, 3, 'y', 12), end = planks(PT, 2, 3), base = concrete(CN, 2), roof2 = tin(TN, 2, 'x', 12);
  g.box(2, 3, 0, 126, 61, 2, base);
  g.vaultX(4, 124, 32, 28, 2, 32, shell);
  g.paint(4, 0, 0, 6, 64, 40, end); g.paint(122, 0, 0, 124, 64, 40, end);
  for (const [face, p] of [['w', 4], ['e', 123]]) {
    doorOn(g, face, 27, p, 2, 10, 24, { leaf: planks(PT, 1, 4) });
    windowOn(g, face, 10, p, 10, 7, 8); windowOn(g, face, 47, p, 10, 7, 8);
  }
  g.box(0, 25, 0, 4, 39, 2, base); g.box(124, 25, 0, 128, 39, 2, base);
  g.text('w', 4, 29, 34, 'B3', CR[3]); g.text('e', 123, 35, 34, 'B3', CR[3]);
  // South entry vestibule.
  g.box(56, 48, 2, 72, 62, 28, end);
  g.gableY(46, 63, 54, 74, 28, 9, roof2);
  doorOn(g, 's', 60, 61, 2, 8, 24, { leaf: planks(PT, 1, 4) });
  g.box(57, 62, 0, 71, 64, 2, base);
  g.box(58, 62, 18, 60, 64, 21, flat(ST[1])); g.set(58, 63, 17, lampGlow);
  // Box dormers with windows on both long sides.
  for (const x of [14, 32, 86, 104]) {
    g.box(x, 50, 2, x + 10, 58, 20, end); g.box(x - 1, 49, 20, x + 11, 59, 22, roof2);
    windowOn(g, 's', x + 2, 57, 9, 6, 7);
    g.box(x, 6, 2, x + 10, 14, 20, end); g.box(x - 1, 5, 20, x + 11, 15, 22, roof2);
    windowOn(g, 'n', x + 2, 6, 9, 6, 7);
  }
  // Stove pipes.
  for (const x of [34, 96]) { g.cylZ(x, 24, 1.5, 30, 45, darkSteel); g.box(x - 2, 22, 45, x + 3, 27, 46, darkSteel); }
  // Fire bucket and a bench by the vestibule.
  g.cylZ(77, 60, 1.6, 0, 5, redPaint); g.box(36, 59, 0, 52, 62, 5, planks(WD, 2, 2)); g.erase(38, 59, 0, 50, 62, 3);
});

// ===== Mess hall: cream clapboard, tar-paper gable roof, brick chimney with smoke.
def('bld_mess_hall', 'World', [7, 5], 106, g => {
  const wall = planks(CR, 2, 3), base = concrete(CN, 2), roof = tarpaper(TP, 3, 'x');
  for (let x = 6; x < 106; x += 16) for (const y of [12, 66]) g.box(x, y, 0, x + 3, y + 3, 4, base);
  g.box(105, 12, 0, 108, 15, 4, base); g.box(105, 66, 0, 108, 69, 4, base);
  g.box(6, 12, 3, 106, 69, 4, flat(WD[1]));
  g.box(7, 13, 4, 105, 68, 36, wall);
  g.box(6, 12, 34, 106, 69, 36, trimGreen);
  gableRoofX(g, 2, 110, 6, 75, 36, 24, roof, wall, 7, 105, 7);
  for (const [face, p] of [['w', 7], ['e', 104]]) windowOn(g, face, 37, p, 44, 7, 6, { glass: darkGlass, frame: trimGreen });
  g.box(30, 38, 57, 80, 44, 62, tin(TN, 3, 'y'));
  g.box(84, 22, 40, 92, 30, 72, brick(BR, 2)); g.box(83, 21, 72, 93, 31, 74, flat(CN[3]));
  // Front: screen double door, awning on posts, steps, sign board.
  const screen = mat((x, y, z) => ((ix(x) + ix(z)) % 2 ? TP[2] : TP[1]));
  doorOn(g, 's', 50, 67, 4, 12, 26, { leaf: screen, frame: trimGreen });
  g.box(55.5, 66, 4, 56.5, 67, 30, trimGreen);
  g.shed(44, 68, 68, 78, 30, 4, 1, tin(TN, 3, 'y'));
  for (const x of [45, 66]) g.box(x, 75, 0, x + 1.5, 76, 32, woodPost);
  steps(g, 47, 65, 69, 2, base, 1, 2, 2);
  g.box(38, 77, 34, 78, 78, 42, blackPaint); g.box(38, 77, 42, 78, 78, 43, trimGreen);
  g.text('s', 40, 77, 40, 'MESS HALL', CR[3]);
  // Dinner triangle hanging from the awning post.
  g.line(68, 77, 22, 71, 77, 22, flat(ST[3])); g.line(68, 77, 22, 69.5, 77, 25, flat(ST[3])); g.line(71, 77, 22, 69.5, 77, 25, flat(ST[3]));
  for (const x of [12, 26, 76, 90]) windowOn(g, 's', x, 67, 14, 9, 12, { frame: trimGreen });
  for (const x of [96, 82, 30, 16]) windowOn(g, 'n', x, 13, 14, 9, 12, { frame: trimGreen });
  doorOn(g, 'n', 56, 13, 4, 10, 26, { leaf: planks(PT, 1, 4), frame: trimGreen });
  g.box(52, 4, 0, 72, 12, 4, base);
  for (const [face, p] of [['w', 7], ['e', 104]]) { windowOn(g, face, 22, p, 14, 9, 12, { frame: trimGreen }); windowOn(g, face, 50, p, 14, 9, 12, { frame: trimGreen }); }
  // Kitchen hood vent on the back slope and garbage cans.
  g.cylZ(40, 20, 2, 44, 58, darkSteel); g.box(37, 17, 58, 44, 24, 60, darkSteel);
  for (const y of [56, 62]) { g.cylZ(109, y, 2.4, 0, 9, steel); g.cylZ(109, y, 2.6, 9, 10, flat(ST[3])); }
  g.box(57, 3, 0, 69, 8, 9, planks(WD, 2, 3)); g.box(58, 4, 9, 66, 8, 14, planks(WD, 3, 3));
}, { frames: 4, fps: 6, overlay: smokeOverlay(88, 26, 74, 30) });

// ===== Medical station: white clapboard, red crosses on roof and doors, ramp and porch.
def('bld_medical', 'World', [6, 5], 66, g => {
  const wall = planks(WH, 4, 3), base = concrete(CN, 2), roof = tin(TN, 4, 'y', 16);
  g.box(4, 12, 0, 92, 70, 4, base);
  g.box(6, 14, 4, 90, 68, 34, wall);
  g.box(5, 13, 32, 91, 69, 34, flat(WH[3]));
  gableRoofX(g, 2, 94, 8, 75, 34, 22, roof, wall, 6, 90, 6);
  for (const [face, p] of [['w', 6], ['e', 89]]) windowOn(g, face, 38, p, 42, 6, 5, { glass: darkGlass });
  const white = flat(WH[4]), red = flat(RD[2]);
  for (const cy of [58, 25]) g.topPaint(34, cy - 11, 62, cy + 11, (x, y) => {
    const dx = Math.abs(x - 48), dy = Math.abs(y - cy);
    if (dx > 13 || dy > 10) return null;
    return (dx <= 3 && dy <= 8) || (dy <= 3 && dx <= 9) ? red : white;
  });
  // Porch with roof, steps and a stretcher ramp on the east.
  g.box(28, 68, 0, 68, 78, 4, base);
  steps(g, 34, 56, 78, 2, base, 1, 2, 1);
  g.shape(68, 70, 0, 84, 78, 4, (x, y, z) => z < 4 * (1 - (x - 68) / 16), base);
  g.shed(26, 66, 70, 80, 30, 4, 1, flat(WH[3]));
  for (const x of [28, 67]) g.box(x, 77, 4, x + 1.5, 78, 32, trimWhite);
  g.box(28, 79, 30, 68, 80, 37, white);
  g.text('s', 34, 79, 35, 'MEDICAL', RD[2]);
  doorOn(g, 's', 42, 67, 4, 12, 26, { leaf: planks(WH, 2, 4) });
  g.box(47.5, 66, 4, 48.5, 67, 30, flat(WH[1]));
  g.bitmap('s', 43, 66, 22, cross5, { r: RD[2] }); g.bitmap('s', 49, 66, 22, cross5, { r: RD[2] });
  for (const x of [12, 76]) windowOn(g, 's', x, 67, 13, 10, 12);
  for (const x of [80, 54, 24]) windowOn(g, 'n', x, 14, 13, 10, 12);
  for (const [face, p] of [['w', 6], ['e', 89]]) { windowOn(g, face, 22, p, 13, 9, 12); windowOn(g, face, 46, p, 13, 9, 12); }
  g.bitmap('w', 6, 36, 28, cross5, { r: RD[2] }); g.bitmap('e', 89, 40, 28, cross5, { r: RD[2] });
  // Stretchers on the porch, oxygen bottles, water tank on a stand at the back.
  for (const z of [4, 6]) { g.box(70, 70, z, 84, 71, z + 1, woodDark); g.box(70, 74, z, 84, 75, z + 1, woodDark); g.box(71, 70, z, 83, 75, z + 1, canvasMat(CV, 3, 6)); }
  for (const x of [24, 26.5]) { g.cylZ(x, 75, 1.2, 4, 14, flat(OL[3])); g.set(x, 75, 14, flat(ST[3])); }
  for (const [x, y] of [[10, 6], [20, 6], [10, 11], [20, 11]]) g.box(x, y, 0, x + 1, y + 1, 22, woodPost);
  g.cylZ(15.5, 8.5, 6, 22, 32, flat(ST[2])); g.cylZ(15.5, 8.5, 6.3, 32, 33, flat(ST[3]));
  g.cylZ(70, 30, 1.4, 44, 56, darkSteel);
});

// ===== Language school: timber schoolhouse, front gable, bell cupola, SCHOOL board, blackboard.
def('bld_academy', 'World', [7, 5], 92, g => {
  const wall = planks(WD, 3, 3), base = concrete(CN, 2), roof = rooftile(NV, 3, 'y'), deck = planks(WD, 2, 3, 'x');
  g.box(10, 6, 0, 102, 66, 4, base);
  g.box(12, 8, 4, 100, 64, 38, wall);
  g.box(11, 7, 36, 101, 65, 38, trimWhite);
  // Roof shell (front gable) with gable wall behind it.
  g.shape(4, 2, 38, 108, 70, 66, (x, y, z) => { const hw = 52 * (1 - (z - 38) / 27), d = Math.abs(x - 56); return d <= hw && d >= hw - 5; }, roof);
  g.shape(12, 8, 38, 100, 64, 66, (x, y, z) => Math.abs(x - 56) <= 52 * (1 - (z - 38) / 27) - 4, wall);
  g.shape(4, 68, 38, 108, 70, 66, (x, y, z) => { const hw = 52 * (1 - (z - 38) / 27), d = Math.abs(x - 56); return d <= hw && d >= hw - 5; }, trimWhite);
  // Bell cupola on the ridge.
  g.box(50, 48, 58, 62, 58, 68, planks(WH, 3, 3));
  g.erase(51, 48, 62, 61, 58, 68);
  for (const [x, y] of [[50, 48], [61, 48], [50, 57], [61, 57]]) g.box(x, y, 62, x + 1, y + 1, 68, trimWhite);
  g.cone(56, 53, 1.6, 3.6, 63, 67, flat(GD[1])); g.box(55, 52, 67, 57, 54, 68, darkSteel);
  g.pyramid(48, 46, 64, 60, 68, 9, roof); g.box(55.5, 52.5, 77, 56.5, 53.5, 81, darkSteel);
  // Porch, steps, shed roof on posts, double door.
  g.box(38, 64, 0, 74, 74, 4, base); g.box(38, 64, 3, 74, 74, 4, deck);
  steps(g, 46, 66, 74, 2, deck, 1, 2, 3);
  for (const x of [39, 72]) g.box(x, 72, 4, x + 1.5, 73.5, 32, trimWhite);
  railing(g, 38, 64, 74, 74, 4, 8, trimWhite, 3, 'ew');
  g.shed(36, 62, 76, 76, 31, 4, 1, roof);
  g.box(36, 75, 31, 76, 76, 33, trimWhite);
  doorOn(g, 's', 50, 63, 4, 12, 28, { leaf: planks(PT, 1, 4) });
  g.box(55.5, 62, 4, 56.5, 63, 32, flat(PT[0]));
  // SCHOOL / ENGLISH board on the gable.
  g.box(40, 64, 40, 72, 65, 55, blackPaint); g.box(40, 64, 55, 72, 65, 56, trimWhite); g.box(40, 64, 39, 72, 65, 40, trimWhite);
  g.text('s', 45, 64, 53, 'SCHOOL', CR[3]); g.text('s', 43, 64, 46, 'ENGLISH', GD[3]);
  // Blackboard easel with chalk letters, notice board.
  g.line(79, 75, 0, 80, 72, 22, woodPost); g.line(91, 75, 0, 90, 72, 22, woodPost); g.line(85, 68, 0, 85, 71, 20, woodPost);
  g.box(78, 72, 7, 93, 73, 21, flat(TP[1])); g.box(78, 72, 21, 93, 73, 22, woodDark); g.box(78, 73, 7, 93, 74, 8, woodDark);
  g.text('s', 80, 72, 18, 'ABC', CR[3]); g.box(80, 73, 11, 91, 74, 12, flat(CR[2]));
  g.box(24, 64, 12, 36, 65, 24, woodDark);
  for (const [x, z] of [[25, 22], [29, 22], [33, 21], [26, 17], [31, 16]]) g.box(x, 65, z - 3, x + 3, 66, z, flat(CR[3]));
  // Tall school windows.
  for (const x of [17, 85]) windowOn(g, 's', x, 63, 12, 9, 18);
  for (const [face, p] of [['w', 12], ['e', 99]]) for (const y of [14, 30, 46]) windowOn(g, face, y, p, 12, 8, 18, { shutters: trimGreen });
  for (const x of [90, 30]) windowOn(g, 'n', x, 8, 12, 9, 18);
  doorOn(g, 'n', 62, 8, 4, 9, 26, { leaf: planks(PT, 1, 4) });
  g.box(76, 14, 46, 83, 21, 72, brick(BR, 2)); g.box(75, 13, 72, 84, 22, 74, flat(CN[3]));
});

// ===== Workshop: tin shed, mono-pitch roof, open roller door, bench and engine inside.
def('bld_workshop', 'World', [7, 5], 72, g => {
  const wall = tin(TN, 3, 'y', 20), base = concrete(CN, 2);
  g.box(2, 6, 0, 110, 79, 2, base);
  g.box(6, 10, 2, 106, 66, 40, wall);
  g.shape(6, 10, 40, 106, 66, 52, (x, y, z) => z < 40 + 10 * (1 - (y - 6) / 61), wall);
  g.shed(3, 6, 109, 67, 40, 10, 2, tin(TN, 3, 'x', 16));
  // Open roller door with interior.
  g.erase(24, 50, 2, 88, 66, 34);
  const peg = mat((x, y, z) => (ix(x) % 3 === 0 && ix(z) % 3 === 0 ? ST[2] : ST[1]), { flat: true });
  g.box(24, 49, 2, 88, 50, 34, peg);
  g.box(24, 50, 33, 88, 66, 34, flat(ST[1]));
  for (const [x, z, rows] of [[30, 28, ['###', ' # ', ' # ', ' # ']], [36, 29, ['# #', '###', ' # ', ' # ', ' # ']], [42, 28, ['####', '   #']], [70, 28, ['#  #', '####', '#  #']], [78, 29, ['#', '#', '#', '##']]])
    g.bitmap('s', x, 49, z, rows, { '#': ST[4] });
  g.box(28, 50, 2, 58, 55, 12, planks(WD, 2, 2, 'x')); g.box(29, 51, 2, 31, 54, 11, woodDark); g.box(55, 51, 2, 57, 54, 11, woodDark);
  g.box(32, 51, 12, 36, 54, 15, flat(ST[2])); g.box(46, 51, 12, 53, 54, 16, redPaint);
  // Radial engine on a stand.
  g.box(64, 56, 2, 76, 60, 4, darkSteel); g.box(69, 57, 4, 71, 59, 12, darkSteel);
  g.cylY(70, 16, 4, 55, 61, flat(ST[2]));
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; g.cylY(70 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 2.2, 56, 60, flat(ST[3])); }
  g.cylY(70, 16, 1.6, 54, 62, flat(ST[1]));
  // Door guides, rolled drum, lintel lettering.
  g.box(22, 64, 2, 24, 67, 36, darkSteel); g.box(88, 64, 2, 90, 67, 36, darkSteel);
  g.cylX(65, 37, 2.6, 22, 90, flat(ST[3]));
  g.text('s', 35, 65, 40, 'MAINTENANCE', CR[3]);
  // Outside: spare propeller leaning on the wall, drums, compressor.
  g.line(11, 67, 2, 15, 67, 32, flat(ST[1]), .7); g.set(15, 67, 32, flat(GD[2])); g.set(11, 67, 2, flat(GD[2])); g.cylY(13, 17, 1.6, 66, 68, flat(ST[2]));
  for (const [x, y, c] of [[96, 70, OL[2]], [101, 72, RD[1]], [96, 75, OL[3]]]) { g.cylZ(x, y, 2.4, 2, 11, flat(c)); g.cylZ(x, y, 2.5, 5, 6, darkSteel); }
  g.box(4, 70, 2, 20, 77, 10, flat(OL[2])); g.cylX(73.5, 12, 3.5, 6, 18, flat(OL[3])); g.box(18, 70, 2, 20, 77, 4, rubber);
  for (const [face, p] of [['w', 6], ['e', 105]]) { windowOn(g, face, 20, p, 18, 12, 8, { frame: flat(ST[2]) }); windowOn(g, face, 42, p, 18, 12, 8, { frame: flat(ST[2]) }); }
  doorOn(g, 'n', 70, 10, 2, 9, 26, { leaf: tin(OL, 2, 'y'), frame: flat(ST[1]) });
  windowOn(g, 'n', 40, 10, 18, 14, 8, { frame: flat(ST[2]) });
  for (const x of [30, 82]) { g.cylZ(x, 30, 2, 48, 55, flat(ST[3])); g.cylZ(x, 30, 3, 55, 57, flat(ST[2])); }
});

// ===== Warehouse: tin gable shed, loading dock with pallets, half-open sliding doors.
def('bld_warehouse', 'World', [7, 5], 74, g => {
  const wall = tin(TN, 2, 'y', 20), roof = tin(TN, 3, 'x', 20), base = concrete(CN, 2), dock = concrete(CN, 3, 12);
  g.box(6, 6, 0, 106, 60, 3, base);
  g.box(8, 8, 3, 104, 58, 36, wall);
  gableRoofX(g, 4, 108, 3, 63, 36, 22, roof, wall, 8, 104, 5);
  for (const [face, p] of [['w', 8], ['e', 103]]) for (let k = 0; k < 4; k++) g.box(face === 'w' ? 7 : 104, 29, 42 + k * 2, face === 'w' ? 8 : 105, 37, 43 + k * 2, darkSteel);
  const sky = flat(GL[1]);
  g.topPaint(4, 3, 108, 63, (x, y) => ((ix(x) - 14) % 32 < 7 && (ix(x) - 14) % 32 >= 0 && ((y > 41 && y < 54) || (y > 12 && y < 25))) ? sky : null);
  g.box(8, 58, 0, 104, 72, 6, dock);
  for (const x of [16, 40, 68, 94]) g.box(x, 72, 1, x + 3, 73, 5, rubber);
  g.box(2, 60, 0, 8, 70, 2, dock); g.box(4, 60, 2, 8, 70, 4, dock);
  // Doors: west half open (crates inside), east half closed sliding panel.
  g.erase(36, 52, 6, 76, 58, 30);
  g.box(36, 51, 6, 76, 52, 30, interior);
  g.box(38, 52, 6, 50, 57, 18, planks(WD, 2, 3)); g.box(40, 53, 18, 48, 57, 25, planks(WD, 3, 3)); g.box(51, 53, 6, 56, 57, 12, planks(WD, 1, 3));
  g.box(56, 58, 6, 77, 60, 30, tin(OL, 2, 'y', 21)); g.box(66, 60, 6, 67, 61, 30, flat(OL[1])); g.box(73, 60, 16, 75, 61, 18, darkSteel);
  g.box(32, 58, 30, 82, 60, 32, darkSteel);
  g.text('s', 37, 57, 35, 'QM DEPOT 4', CR[3]);
  // Pallets: crates on the west, sacks on the east.
  g.box(12, 61, 6, 28, 71, 7, woodDark);
  g.box(13, 62, 7, 20, 70, 14, planks(WD, 2, 2)); g.box(20, 62, 7, 27, 70, 14, planks(WD, 3, 2)); g.box(14, 63, 14, 26, 69, 20, planks(WD, 2, 2));
  g.text('s', 15, 69, 12, 'QM', TP[1]);
  g.box(84, 61, 6, 100, 71, 7, woodDark);
  g.shape(85, 62, 7, 99, 70, 16, (x, y, z) => z < 7 + 3 * (1 + ix((z - 7) / 3)) && (z - 7) < 9 - Math.abs(x - 92) * .3, sandbag(CR, 2));
  // Side windows and door, ladder to roof.
  for (const [face, p] of [['w', 8], ['e', 103]]) for (const y of [16, 36]) windowOn(g, face, y, p, 22, 10, 6, { frame: flat(ST[2]) });
  doorOn(g, 'e', 46, 103, 3, 8, 24, { leaf: tin(OL, 2, 'y'), frame: flat(ST[1]) });
  for (const y of [22, 27]) g.box(5, y, 0, 6, y + 1, 40, darkSteel);
  for (let z = 4; z < 40; z += 4) g.box(5, 22, z, 6, 28, z + 1, darkSteel);
  g.cylZ(102, 61, 1.5, 6, 13, redPaint);
});

// ===== Fuel depot: earth berm, two horizontal avgas tanks, vertical tank, pipes and pump.
def('bld_fuel_depot', 'World', [5, 4], 48, g => {
  const bermM = mat((x, y, z, f) => f === 'u' ? cl(GR, 3 + (fbm(x * .3, y * .3, 3) > .6 ? 1 : 0) - (hash(ix(x), ix(y), 1) < .1 ? 1 : 0)) : cl(DT, 2 + (fbm(x * .3, z * .4, 5) > .6 ? 1 : 0)));
  g.shape(0, 0, 0, 80, 64, 8, (x, y, z) => {
    const d = Math.min(x, y, 80 - x, 64 - y);
    const h = d < 4 ? d * 1.6 : d < 6 ? 6.4 : d < 9 ? (9 - d) * 2.1 : 0;
    return z < h && !(y > 50 && x > 33 && x < 49);
  }, bermM);
  g.box(6, 6, 0, 74, 58, 1, mottled(SN, 1, 4, .6, .4));
  const tank = mottled(ST, 3, 7, .7, .1), saddle = concrete(CN, 3);
  for (const cy of [19, 37]) {
    for (const x of [15, 29, 43]) g.box(x, cy - 5, 0, x + 3, cy + 5, 5, saddle);
    g.cylX(cy, 10, 6.5, 12, 48, tank);
    g.ell(12, cy, 10, 1.8, 6.5, 6.5, tank); g.ell(48, cy, 10, 1.8, 6.5, 6.5, tank);
    for (const x of [20, 36]) g.cylX(cy, 10, 6.8, x, x + 1, flat(ST[2]));
    g.cylZ(30, cy, 1.8, 15, 18, flat(ST[1]));
    g.surfText('s', 22, 12, 'AVGAS', RD[2]);
  }
  // Vertical tank with conical roof and ladder.
  g.cylZ(61, 24, 9, 1, 34, tank); g.cone(61, 24, 9.6, 1.2, 34, 41, flat(ST[2]));
  for (const z of [12, 24]) g.cylZ(61, 24, 9.3, z, z + 1, flat(ST[2]));
  for (const x of [58, 62]) g.box(x, 33, 1, x + 1, 34, 36, darkSteel);
  for (let z = 4; z < 36; z += 3) g.box(58, 33, z, 63, 34, z + 1, darkSteel);
  g.surfText('s', 55, 22, '100', RD[2]);
  // Pipes to a valve manifold and a pump at the gap.
  const pipe = flat(ST[1]);
  for (const cy of [19, 37]) g.line(48, cy, 6, 52, cy, 6, pipe, .8);
  g.line(52, 19, 6, 52, 48, 6, pipe, .8); g.line(61, 33, 4, 61, 48, 4, pipe, .8); g.line(30, 48, 4, 64, 48, 4, pipe, .8);
  for (const x of [36, 46, 56]) { g.box(x, 48, 4, x + 1, 49, 9, pipe); g.cylY(x + .5, 9, 2, 49, 50, redPaint); }
  g.box(38, 51, 0, 44, 55, 14, redPaint); g.box(38, 51, 14, 44, 55, 15, flat(ST[1])); g.box(39, 55, 7, 43, 56, 11, glass);
  g.shape(44, 52, 0, 52, 58, 3, (x, y, z) => Math.abs(Math.hypot(x - 48, y - 55) - 2.5) < .9, flat(RB[1]));
  // NO SMOKING board on the berm and fire point.
  for (const x of [6, 30]) g.box(x, 59, 0, x + 1, 60, 20, woodPost);
  g.box(4, 60, 8, 33, 61, 21, flat(WH[4]));
  g.text('s', 15, 60, 19, 'NO', RD[2]); g.text('s', 5, 60, 13, 'SMOKING', RD[2]);
  g.cylZ(53, 58, 1.5, 0, 8, redPaint); g.box(70, 52, 0, 76, 58, 6, flat(RD[1]));
});

// ===== Ammunition bunker: earth-covered concrete magazine, steel doors, danger sign.
def('bld_ammo_bunker', 'World', [5, 4], 44, g => {
  const turf = mat((x, y, z, f) => f === 'u' ? cl(GR, 3 + (fbm(x * .25, y * .25, 8) > .6 ? 1 : 0) - (hash(ix(x), ix(y), 2) < .12 ? 1 : 0)) : cl(GR, 2 + (hash(ix(x), ix(z), 4) < .3 ? -1 : 0)));
  const conc = concrete(CN, 3, 12);
  g.shape(2, 0, 0, 78, 58, 30, (x, y, z) => ((x - 40) / 37) ** 2 + (Math.max(0, Math.abs(y - 30) - 12) / 19) ** 2 + ((z + 3) / 30) ** 2 <= 1, turf);
  g.box(22, 50, 0, 58, 60, 30, conc); g.box(21, 50, 30, 59, 61, 32, flat(CN[3]));
  g.shape(8, 54, 0, 22, 60, 30, (x, y, z) => z < 30 * (x - 8) / 14, conc);
  g.shape(58, 54, 0, 72, 60, 30, (x, y, z) => z < 30 * (72 - x) / 14, conc);
  const steelDoor = mat((x, y, z) => (ix(x) % 5 === 0 || ix(z) % 6 === 0) ? ST[1] : (ix(x) % 5 === 2 && ix(z) % 6 === 3 ? ST[3] : ST[2]));
  doorOn(g, 's', 30, 59, 0, 20, 21, { leaf: steelDoor, frame: flat(CN[4]), depth: 2, knob: false });
  g.box(39.5, 57, 0, 40.5, 58, 21, flat(ST[0]));
  g.box(38, 57, 9, 39, 58, 12, flat(GD[2])); g.box(41, 57, 9, 42, 58, 12, flat(GD[2]));
  g.box(27, 60, 22, 53, 61, 30, redPaint);
  g.text('s', 29, 60, 28, 'DANGER', WH[4]);
  g.box(39, 60, 30, 41, 62, 33, lampGlow);
  // Hazard stripes on the threshold.
  g.box(28, 59, 0, 52, 62, 1, stripes(GD[2], TP[1], 3));
  // Vents, lightning rod, turf tufts.
  for (const x of [26, 54]) { g.cylZ(x, 22, 1.5, 18, 31, darkSteel); g.cylZ(x, 22, 3, 31, 33, darkSteel); }
  g.line(40, 16, 25, 40, 16, 42, flat(ST[3]));
  for (const [x, y] of [[16, 30], [62, 18], [48, 8], [30, 40]]) g.ell(x, y, g.top(x, y), 3, 3, 2.5, leaf(2, x));
  for (const x of [10, 62]) g.box(x, 60, 0, x + 8, 64, 8, sandbag(SN, 2));
});

// ===== Radar station: cabin, lattice mast, rotating bedspring array (8 frames).
def('bld_radar', 'World', [3, 3], 66, (g, ctx) => {
  g.box(2, 2, 0, 46, 46, 2, concrete(CN, 2));
  g.shape(0, 0, 0, 48, 48, 8, (x, y, z) => { const d = Math.max(Math.abs(x - 24), Math.abs(y - 24)); return d >= 20 && d < 24 && z < 8 - (d - 20) * .6 && !(y > 40 && Math.abs(x - 24) < 5); }, sandbag(SN, 2));
  g.box(9, 25, 2, 39, 41, 26, tin(OL, 2, 'y', 15));
  g.box(8, 24, 26, 40, 42, 28, flat(OL[1]));
  doorOn(g, 's', 20, 40, 2, 8, 20, { leaf: planks(OL, 1, 4), frame: flat(OL[1]) });
  windowOn(g, 's', 30, 40, 12, 5, 5, { frame: flat(OL[1]) });
  g.text('s', 28, 40, 25, 'SCR', CR[3]);
  g.line(26, 24, 18, 26, 18, 30, flat(TP[1])); g.line(26, 18, 30, 24, 16, 32, flat(TP[1]));
  // Lattice mast.
  for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.line(24 + dx, 16 + dy, 0, 24 + dx * .4, 16 + dy * .4, 34, darkSteel);
  for (let z = 4; z < 34; z += 6) { const k = 1 - z / 34 * .6; g.line(24 - 3 * k, 16 - 3 * k, z, 24 + 3 * k, 16 + 3 * k, z + 6, darkSteel); g.line(24 + 3 * k, 16 - 3 * k, z, 24 - 3 * k, 16 + 3 * k, z + 6, darkSteel); }
  g.cylZ(24, 16, 2.5, 34, 37, flat(ST[3]));
  // Bedspring array: dipoles on the front face, reflector mesh behind.
  const a = ctx.frame * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const dip = flat(ST[4]), mesh = flat(ST[1]);
  for (let t = -14; t <= 14; t += .5) for (let zz = 0; zz <= 16; zz++) {
    const ti = Math.round(t * 2);
    if (ti % 8 === 0 || zz % 4 === 0) g.set(24 + ca * t - nx * 1.2, 16 + sa * t - ny * 1.2, 38 + zz, mesh);
    if (ti % 4 === 0 && zz % 4 === 2) for (const s of [.5, 1.5]) g.set(24 + ca * t + nx * s, 16 + sa * t + ny * s, 38 + zz, dip);
  }
  for (let zz = 0; zz <= 16; zz++) g.set(24, 16, 38 + zz, mesh);
  g.box(38, 6, 2, 46, 18, 12, flat(OL[2])); g.box(40, 8, 12, 42, 10, 18, darkSteel);
}, { frames: 8, fps: 6, animated: true });

// ===== Radio hut: small timber hut, lattice mast with guy wires, aerial lead, generator.
def('bld_radio_hut', 'World', [3, 3], 86, g => {
  const wall = planks(OL, 2, 3);
  g.box(6, 18, 0, 32, 42, 2, concrete(CN, 2));
  g.box(7, 19, 2, 31, 41, 30, wall);
  g.shape(7, 19, 30, 31, 41, 36, (x, y, z) => z < 30 + 5 * (1 - (y - 19) / 22), wall);
  g.shed(4, 16, 34, 45, 30, 5, 2, tin(TN, 3, 'y'));
  doorOn(g, 's', 11, 40, 2, 9, 24, { leaf: planks(OL, 1, 4), frame: flat(OL[1]) });
  windowOn(g, 's', 23, 40, 12, 5, 6, { frame: flat(OL[1]) });
  windowOn(g, 'w', 24, 7, 12, 8, 7, { frame: flat(OL[1]) });
  windowOn(g, 'e', 26, 30, 12, 8, 7, { frame: flat(OL[1]) });
  g.text('s', 12, 40, 31, 'RADIO', CR[3]);
  // Mast: three-legged lattice.
  const legs = [[38, 7], [44, 12], [37, 13]];
  for (const [x, y] of legs) g.line(x, y, 0, 39.7 + (x - 39.7) * .3, 10.7 + (y - 10.7) * .3, 78, darkSteel);
  for (let z = 6; z < 76; z += 6) { const k = 1 - z / 78 * .7; const p = legs.map(([x, y]) => [39.7 + (x - 39.7) * k, 10.7 + (y - 10.7) * k]); for (let i = 0; i < 3; i++) { const q = p[(i + 1) % 3]; g.line(p[i][0], p[i][1], z, q[0], q[1], z + 3, darkSteel); } }
  g.box(32, 10, 74, 48, 11, 75, darkSteel); g.box(35, 10, 68, 45, 11, 69, darkSteel);
  g.set(40, 11, 79, glow(RD[4])); g.set(39, 11, 79, glow(RD[4]));
  for (const [x, y] of [[50, 0], [28, 0], [50, 24]]) g.line(39.7, 10.7, 62, x, y, 0, flat(ST[3]));
  for (let t = 0; t <= 1; t += .02) g.set(39.7 + (20 - 39.7) * t, 10.7 + (30 - 10.7) * t, 66 + (36 - 66) * t - Math.sin(t * Math.PI) * 6, flat(TP[1]));
  g.box(19, 29, 33, 21, 31, 38, flat(CR[1]));
  // Generator with exhaust and fuel can.
  g.box(34, 30, 0, 46, 40, 10, flat(OL[2])); g.box(35, 31, 10, 45, 39, 11, flat(OL[3]));
  g.cylZ(44, 32, 1, 11, 18, darkSteel); for (let x = 35; x < 45; x += 2) g.box(x, 40, 2, x + 1, 41, 8, darkSteel);
  g.box(41, 41, 0, 45, 44, 8, flat(OL[3]));
  g.line(34, 35, 4, 31, 35, 6, flat(TP[1]));
  g.line(14, 22, 36, 14, 22, 50, darkSteel);
});

// ===== Watchtower: timber legs with X bracing, enclosed lookout, tin pyramid roof, ladder.
def('bld_watchtower', 'World', [2, 2], 96, g => {
  const wallP = planks(WD, 2, 3);
  for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.line(x + .5, y + .5, 0, x + (x < 16 ? 2 : -2) + .5, y + (y < 16 ? 2 : -2) + .5, 52, woodPost, 1.1);
  for (const [a, b] of [[[2, 2], [29, 2]], [[2, 29], [29, 29]], [[2, 2], [2, 29]], [[29, 2], [29, 29]]]) {
    for (const [z0, z1] of [[4, 26], [26, 48]]) {
      const k0 = z0 / 52 * 2, k1 = z1 / 52 * 2, sx = p => p < 16 ? 1 : -1;
      const P = (p, k) => [p[0] + sx(p[0]) * k + .5, p[1] + sx(p[1]) * k + .5];
      const [ax0, ay0] = P(a, k0), [bx1, by1] = P(b, k1), [bx0, by0] = P(b, k0), [ax1, ay1] = P(a, k1);
      g.line(ax0, ay0, z0, bx1, by1, z1, woodDark); g.line(bx0, by0, z0, ax1, ay1, z1, woodDark);
    }
  }
  for (const [x, y] of [[0, 0], [28, 0], [0, 28], [28, 28]]) g.box(x, y, 0, x + 4, y + 4, 2, concrete(CN, 2));
  g.box(-3, -3, 50, 35, 35, 52, planks(WD, 2, 3, 'x'));
  g.box(-2, -2, 52, 34, 34, 61, wallP);
  g.erase(0, 0, 52, 32, 32, 61);
  for (const [x, y] of [[-2, -2], [33, -2], [-2, 33], [33, 33]]) g.box(x, y, 61, x + 1, y + 1, 74, woodPost);
  g.box(-2, -2, 61, 34, 34, 62, woodDark); g.erase(-1, -1, 61, 33, 33, 62);
  g.pyramid(-6, -6, 38, 38, 74, 16, tin(TN, 3, 'y', 12));
  g.box(15, 15, 90, 17, 17, 93, darkSteel);
  g.text('s', 10, 33, 59, 'T-1', CR[3]);
  // Searchlight on the front rail, field phone inside.
  g.box(14, 33, 61, 18, 35, 63, darkSteel);
  g.cylY(16, 66, 3, 32, 37, flat(ST[2])); g.cylY(16, 66, 2.2, 36.5, 37.5, glow(CR[3]));
  g.box(2, 2, 52, 8, 6, 58, flat(OL[2]));
  // Ladder to the platform.
  for (const x of [12, 19]) g.line(x, 38, 0, x, 34, 50, woodPost);
  for (let z = 4; z < 50; z += 4) g.line(12, 38 - z / 50 * 4, z, 19, 38 - z / 50 * 4, z, woodDark);
}, { margin: 8 });

// ===== Water tower: steel trestle, timber-stave tank with hoops, conical roof, ladder.
def('bld_water_tower', 'World', [3, 3], 100, g => {
  const leg = flat(ST[2]);
  const C = [[4, 4], [44, 4], [4, 44], [44, 44]], top = p => [24 + (p[0] - 24) * .55, 24 + (p[1] - 24) * .55];
  for (const p of C) { g.line(p[0], p[1], 0, ...top(p), 57, leg, 1); g.box(p[0] - 2, p[1] - 2, 0, p[0] + 2, p[1] + 2, 2, concrete(CN, 2)); }
  const at = (p, z) => { const t = top(p), k = z / 57; return [p[0] + (t[0] - p[0]) * k, p[1] + (t[1] - p[1]) * k]; };
  for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3]]) for (const [z0, z1] of [[2, 28], [28, 55]]) {
    const a0 = at(C[i], z0), b1 = at(C[j], z1), b0 = at(C[j], z0), a1 = at(C[i], z1);
    g.line(a0[0], a0[1], z0, b1[0], b1[1], z1, darkSteel); g.line(b0[0], b0[1], z0, a1[0], a1[1], z1, darkSteel);
    g.line(a1[0], a1[1], z1, b1[0], b1[1], z1, leg);
  }
  g.cylZ(24, 24, 1.8, 0, 58, flat(ST[1]));
  g.cylZ(24, 24, 18.5, 56, 58, flat(ST[1]));
  g.shape(4, 4, 58, 44, 44, 64, (x, y, z) => { const d = Math.hypot(x - 24, y - 24); return d > 17.4 && d <= 18.5 && (z === 63.5 || Math.round(Math.atan2(y - 24, x - 24) * 6) % 2 === 0); }, darkSteel);
  const staves = mat((x, y, z, f) => {
    if (f === 'u') return WD[2];
    if (ix(z) % 6 === 0) return ST[1];
    const b = ix((Math.atan2(y - 24, x - 24) + Math.PI) * 9);
    return cl(WD, 2 + (b % 2 ? 0 : 1) + (hash(b, 1, 3) < .3 ? -1 : 0));
  });
  g.cylZ(24, 24, 15, 58, 84, staves);
  g.cone(24, 24, 17, 1.5, 84, 95, tin(TN, 3, 'x', 8));
  g.box(23, 23, 95, 25, 25, 98, darkSteel);
  g.surfText('s', 15, 76, 'WATER', CR[3]);
  for (const x of [21, 27]) g.line(x, 45, 0, x, 41, 56, darkSteel);
  for (let z = 4; z < 56; z += 4) g.line(21, 45 - z / 56 * 4, z, 27, 45 - z / 56 * 4, z, darkSteel);
  for (const x of [22, 26]) g.box(x, 39, 58, x + 1, 40, 82, darkSteel);
  for (let z = 60; z < 82; z += 4) g.box(22, 39, z, 27, 40, z + 1, darkSteel);
});

// ===== Guardhouse: glazed sentry booth, striped fascia, sandbag breastwork, HALT board.
def('bld_guardhouse', 'World', [3, 3], 56, g => {
  g.box(8, 6, 0, 40, 34, 2, concrete(CN, 2));
  g.box(10, 8, 2, 38, 32, 30, planks(WH, 3, 3));
  windowOn(g, 's', 13, 31, 15, 20, 10);
  windowOn(g, 'w', 11, 10, 15, 18, 10);
  windowOn(g, 'n', 14, 8, 15, 20, 10);
  doorOn(g, 'e', 14, 37, 2, 9, 26, { leaf: planks(OL, 2, 4) });
  g.box(6, 4, 30, 42, 36, 32, stripes(RD[2], WH[4], 4));
  g.hip(6, 4, 42, 36, 32, 10, tin(TN, 3, 'y', 10));
  g.box(23, 19, 41, 25, 21, 46, darkSteel); g.box(22, 18, 46, 26, 22, 47, darkSteel);
  // HALT board, lamp, field telephone.
  g.box(16, 32, 3, 32, 33, 12, flat(WH[4]));
  g.text('s', 17, 32, 10, 'HALT', RD[2]);
  g.box(39, 26, 22, 41, 28, 26, flat(ST[1])); g.set(40, 28, 22, lampGlow);
  g.box(38, 10, 12, 40, 13, 17, flat(OL[2]));
  // Sandbag breastwork in front and on the west.
  g.shape(1, 37, 0, 36, 46, 12, (x, y, z) => z < 12 && y >= 37 + z * .2 && y < 46 - z * .2 && x < 36 - z * .2, sandbag(SN, 2));
  g.shape(1, 14, 0, 8, 46, 12, (x, y, z) => z < 12 && x >= 1 + z * .2 && x < 8 - z * .2, sandbag(SN, 2));
});

// ===== AA emplacement: sandbag ring, twin 40 mm on a pedestal; barrels point to the front.
def('bld_aa_emplacement', 'World', [4, 4], 44, g => {
  g.box(4, 4, 0, 60, 60, 1, earth(2));
  g.shape(0, 0, 0, 64, 64, 13, (x, y, z) => { const d = Math.hypot(x - 32, y - 32); return d >= 24 && d <= 31 - z * .3 && !(y < 20 && Math.abs(x - 32) < 5); }, sandbag(SN, 2));
  for (const x of [9, 47]) { g.box(x, 26, 1, x + 8, 38, 6, planks(OL, 2, 3)); g.box(x, 28, 6, x + 8, 34, 10, planks(OL, 3, 3)); }
  g.cylZ(32, 32, 7, 1, 7, olive(4, 2)); g.cylZ(32, 32, 9, 7, 9, flat(OL[1]));
  g.box(25, 25, 9, 39, 40, 19, olive(7, 2));
  for (const x of [20, 40]) { g.box(x, 28, 9, x + 4, 33, 11, flat(TP[2])); g.box(x, 27, 11, x + 4, 28, 16, flat(TP[2])); g.cylX(35, 15, 2.5, x === 20 ? 23.5 : 39, x === 20 ? 25 : 40.5, flat(ST[3])); }
  const el = 35 * Math.PI / 180;
  for (const bx of [29.5, 34.5]) {
    g.line(bx, 33, 17, bx, 39, 21, flat(OL[1]), 1.8);
    g.line(bx, 37, 19, bx, 37 + 26 * Math.cos(el), 19 + 26 * Math.sin(el), darkSteel, 1.05);
    g.line(bx, 37 + 22 * Math.cos(el), 19 + 22 * Math.sin(el), bx, 37 + 26.5 * Math.cos(el), 19 + 26.5 * Math.sin(el), flat(ST[1]), 1.6);
    g.box(bx - 1, 30, 19, bx + 1, 33, 25, flat(GD[2])); g.box(bx - 1, 30, 25, bx + 1, 33, 26, flat(GD[1]));
  }
  g.shape(28, 44, 24, 37, 45, 33, (x, y, z) => Math.abs(Math.hypot(x - 32.5, z - 28.5) - 3.5) < .6, darkSteel);
  for (const [x, y] of [[20, 44], [22, 46], [44, 22], [41, 45]]) g.box(x, y, 1, x + 2, y + 1, 2, flat(GD[2]));
});

// ===== Field tent: olive canvas ridge tent, open flaps at the front, guy ropes and pegs.
def('bld_tent', 'World', [3, 3], 40, g => {
  const cv = canvasMat(CV, 2, 8);
  g.box(6, 6, 0, 42, 42, 6, cv);
  g.gableY(4, 44, 4, 44, 6, 22, cv);
  const door = (x, z) => Math.abs(x - 24) <= 8 * (1 - z / 24);
  g.shape(8, 40, 0, 40, 41, 24, (x, y, z) => door(x, z), interior);
  for (let z = 0; z < 24; z++) for (let x = 8; x < 40; x++) if (door(x + .5, z + .5)) g.erase(x, 41, z, x + 1, 44, z + 1);
  g.box(18, 41, 0, 30, 46, 1, flat(CV[0]));
  g.box(20, 40, 0, 23, 41, 4, flat(OL[1])); g.box(25, 40, 0, 29, 41, 6, planks(WD, 2, 2));
  // Tied-back door flaps.
  for (const s of [-1, 1]) g.shape(24 + s * 6 - 3, 43, 0, 24 + s * 6 + 3, 46, 20, (x, y, z) => Math.abs(x - (24 + s * (7 * (1 - z / 22)))) < 1.5 - z / 30 && y < 44 + (1 - z / 20) * 1.5, flat(CV[3]));
  g.box(23.5, 2, 27, 24.5, 46, 29, woodDark);
  for (const y of [8, 24, 40]) { g.line(4, y, 6, 0, y, 0, rope); g.line(43, y, 6, 47, y, 0, rope); g.box(0, y, 0, 1, y + 1, 2, woodDark); g.box(47, y, 0, 48, y + 1, 2, woodDark); }
  g.line(24, 46, 28, 24, 52, 0, rope); g.box(24, 52, 0, 25, 53, 2, woodDark);
  g.surfText('w', 18, 13, '12', CV[0]); g.surfText('e', 30, 13, '12', CV[0]);
});

// ======================= Props =======================
const roundelRows = ['  ccc  ', ' ccccc ', 'ccgggcc', 'ccgggcc', 'ccgggcc', ' ccccc ', '  ccc  '];
const roundelPal = { c: CR[2], g: GD[2] };

def('prop_sandbags', 'World', [3, 1], 18, g => {
  g.shape(0, 1, 0, 48, 16, 14, (x, y, z) => z < 13 && y >= 2 + z * .28 && y < 15 - z * .28 && x >= 1 + Math.max(0, z - 7) * .5 && x < 47 - Math.max(0, z - 7) * .5, sandbag(SN, 2));
}, { margin: 4 });

def('prop_barrels', 'World', [1, 1], 16, g => {
  const drum = (cx, cy, R, i) => {
    g.cylZ(cx, cy, 3.4, 0, 11, flat(R[i]));
    for (const z of [3, 7]) g.cylZ(cx, cy, 3.6, z, z + 1, flat(R[i - 1]));
    g.cylZ(cx, cy, 3, 10.6, 11, flat(R[i - 1])); g.set(cx + 1, cy - 1, 11, darkSteel); g.set(cx - 1.5, cy + .5, 11, flat(ST[3]));
  };
  drum(4.5, 4.5, OL, 2); drum(11.5, 5, NV, 3);
  g.cylX(12.5, 3.4, 3.4, 2, 13, flat(RD[2]));
  for (const x of [5, 9]) g.cylX(12.5, 3.4, 3.6, x, x + 1, flat(RD[1]));
  g.cylX(12.5, 3.4, 2.8, 13, 13.6, flat(RD[1]));
}, { margin: 4 });

function crate(g, x0, y0, z0, x1, y1, z1, R = WD, i = 3) {
  g.box(x0, y0, z0, x1, y1, z1, mat((x, y, z, f) => {
    const ex = x < x0 + 1.5 || x > x1 - 1.5, ey = y < y0 + 1.5 || y > y1 - 1.5, ez = z < z0 + 1.5 || z > z1 - 1.5;
    const edge = f === 'u' ? (ex || ey) : (f === 's' || f === 'n') ? (ex || ez) : (ey || ez);
    if (edge) return R[i - 1];
    const [u, v] = uv(x, y, z, f), b = ix(v / 3);
    return cl(R, i + ((((ix(v) % 3) + 3) % 3) === 0 ? -1 : 0) + (hash(b, ix(x0), 7) < .3 ? -1 : 0));
  }));
}
def('prop_crates', 'World', [2, 1], 24, g => {
  crate(g, 1, 2, 0, 16, 14, 12); crate(g, 17, 3, 0, 31, 14, 10, OL, 3); crate(g, 5, 4, 12, 15, 13, 20);
  g.text('s', 3, 13, 8, 'QM', TP[1]); g.text('s', 20, 13, 7, '.30', CR[2]); g.text('s', 7, 12, 18, '>', TP[1]);
  g.line(1, 14, 12, 16, 14, 0, flat(WD[0]));
}, { margin: 4 });

def('prop_jerrycans', 'World', [1, 1], 14, g => {
  const can = (x0, y0, R, i) => {
    g.box(x0, y0, 0, x0 + 4, y0 + 6, 9, mat((x, y, z, f) => {
      const [u, v] = uv(x, y, z, f);
      const lu = (f === 's' || f === 'n') ? x - x0 : y - y0;
      const X = f !== 'u' && (f === 'e' || f === 'w') && Math.abs(Math.abs(lu - 3) - Math.abs(z - 4.5) * .55) < .6;
      return cl(R, i + (X ? 1 : 0));
    }));
    for (const y of [y0 + 1, y0 + 3, y0 + 5]) g.set(x0 + 1.5, y, 9, flat(R[i - 1]));
    g.set(x0 + 2.5, y0 + 1, 9, flat(ST[3]));
  };
  can(1, 1, OL, 2); can(6, 1, OL, 3); can(11, 1, RD, 2);
  g.box(3, 9, 0, 9, 15, 4, flat(OL[2])); g.box(4, 10, 4, 8, 14, 5, flat(OL[1])); g.set(8, 10, 4, flat(ST[3]));
}, { margin: 4 });

def('prop_flagpole', 'World', [1, 1], 90, (g, ctx) => {
  g.box(3, 3, 0, 13, 13, 3, concrete(CN, 3)); g.box(5, 5, 3, 11, 11, 4, concrete(CN, 4));
  g.cylZ(8, 8, 1.2, 4, 83, flat(WH[3])); g.ell(8, 8, 84, 1.7, 1.7, 1.7, flat(GD[3]));
  g.line(9.5, 8.5, 12, 9.5, 8.5, 81, rope); g.box(9, 8, 12, 11, 9, 13, darkSteel);
  const [wx, wy] = ctx.wind, px = -wy, py = wx, f = ctx.frame;
  const olv = flat(OL[3]), crm = flat(CR[2]), gld = flat(GD[2]), red = flat(RD[2]);
  const L = 24, HH = 15;
  for (let t = 0; t < L; t += .5) for (let s = 0; s < HH; s++) {
    const ph = t / L, w = Math.sin(t * .42 - f * Math.PI / 3);
    const off = w * 1.8 * (ph + .15), sag = ph * ph * 2.5 + Math.cos(t * .42 - f * Math.PI / 3) * .5 * ph;
    const x = 8 + wx * (t + 1.5) + px * off, y = 8 + wy * (t + 1.5) + py * off, z = 81 - s - sag;
    const d = Math.hypot(t - 9, s - 7);
    const m = s <= 1 || s >= HH - 2 ? crm : t > L - 3 ? red : d <= 2.2 ? gld : d <= 4.6 ? crm : olv;
    g.set(x, y, z, m);
  }
}, { frames: 6, fps: 8, animated: true, margin: 30 });

def('prop_windsock', 'World', [1, 1], 56, (g, ctx) => {
  g.box(3, 3, 0, 13, 13, 2, concrete(CN, 3));
  g.cylZ(8, 8, 1.1, 2, 46, stripes(RD[2], WH[4], 3));
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) g.line(8 + dx, 8 + dy, 2, 8, 8, 16, darkSteel);
  const [wx, wy] = ctx.wind, px = -wy, py = wx, f = ctx.frame;
  const orange = flat(FI[2]), white = flat(WH[4]);
  g.box(7, 7, 45, 10, 10, 46, darkSteel);
  for (let t = 0; t < 21; t += .4) {
    const r = 3.8 - t * .11, ph = t / 21;
    const wob = Math.sin(t * .35 - f * Math.PI / 3) * 1.6 * ph, droop = ph * ph * 3 + Math.cos(t * .35 - f * Math.PI / 3) * .5 * ph;
    const cx = 8 + wx * (2 + t) + px * wob, cy = 8 + wy * (2 + t) + py * wob, cz = 44 - droop;
    const m = Math.floor(t / 4.2) % 2 ? white : orange;
    for (let a = 0; a < Math.PI * 2; a += .2) for (const rr of [r, r - .8]) g.set(cx + px * Math.cos(a) * rr, cy + py * Math.cos(a) * rr, cz + Math.sin(a) * rr, m);
  }
  for (let a = 0; a < Math.PI * 2; a += .15) g.set(8 + wx * 2 + px * Math.cos(a) * 4.2, 8 + wy * 2 + py * Math.cos(a) * 4.2, 44 + Math.sin(a) * 4.2, darkSteel);
}, { frames: 6, fps: 8, animated: true, margin: 28 });

def('prop_searchlight', 'World', [1, 1], 30, g => {
  g.cylZ(8, 8, 5.5, 0, 2, darkSteel); g.cylZ(8, 8, 2.2, 2, 9, olive(3, 2));
  for (const x of [2.5, 12.5]) g.box(x, 7, 8, x + 1.5, 9, 18, flat(OL[2]));
  g.box(2.5, 7, 8, 14, 9, 9, flat(OL[2]));
  const el = 25 * Math.PI / 180, dy = Math.cos(el), dz = Math.sin(el), cz = 15;
  g.cyl(8, 8 - dy * 5, cz - dz * 5, 8, 8 + dy * 4, cz + dz * 4, 5, olive(5, 2));
  for (const s of [-3.5, -1.5]) g.cyl(8, 8 + dy * s, cz + dz * s, 8, 8 + dy * (s + .8), cz + dz * (s + .8), 5.5, flat(OL[1]));
  g.cyl(8, 8 + dy * 4, cz + dz * 4, 8, 8 + dy * 5, cz + dz * 5, 4.2, glow(CR[3]));
  g.cyl(8, 8 + dy * 4.6, cz + dz * 4.6, 8, 8 + dy * 5.2, cz + dz * 5.2, 1.6, glow(PAL.WHITE));
  g.line(8, 4, 1, 8, -2, 0, flat(TP[1]));
}, { margin: 6 });

def('prop_lamp_post', 'World', [1, 1], 62, g => {
  const paint = flat(PT[0]);
  g.box(5, 5, 0, 11, 11, 3, concrete(CN, 3)); g.cylZ(8, 8, 2, 3, 8, paint);
  g.cylZ(8, 8, 1, 8, 54, paint); g.ell(8, 8, 55, 1.6, 1.6, 1.6, paint);
  g.line(8, 8, 52, 8, 13, 53, paint); g.line(8, 9, 48, 8, 12, 52, paint);
  g.cone(8, 13.5, 4, 1.2, 47, 52, flat(PT[1])); g.cylZ(8, 13.5, 4, 47, 48, flat(PT[0]));
  g.cylZ(8, 13.5, 1.3, 45, 47, glow(GD[3]));
  g.box(7, 9, 20, 9, 10, 26, flat(WH[4])); g.box(7, 10, 22, 9, 10.5, 24, redPaint);
}, { margin: 6 });

def('prop_signpost', 'World', [1, 1], 48, g => {
  g.box(7, 7, 0, 9, 9, 44, woodPost); g.box(6.5, 6.5, 44, 9.5, 9.5, 45, woodDark);
  const board = flat(CR[2]), edge = flat(WD[1]);
  // East arrow: RUNWAY.
  g.shape(9, 8, 35, 27, 9, 42, (x, y, z) => x < 23 || Math.abs(z - 38.5) < (27 - x) * .9, board);
  g.text('s', 10, 8, 40, 'RWY', TP[1]); g.text('n', 24, 8, 40, 'RWY', TP[1]);
  // West arrow: HQ.
  g.shape(-11, 7, 27, 7, 8, 34, (x, y, z) => x > -7 || Math.abs(z - 30.5) < (x + 11) * .9, board);
  g.text('s', -4, 7, 32, 'HQ', TP[1]); g.text('n', 2, 7, 32, 'HQ', TP[1]);
  // South arrow: MESS (towards the viewer of the facing).
  g.shape(8, 9, 19, 9, 27, 26, (x, y, z) => y < 23 || Math.abs(z - 22.5) < (27 - y) * .9, flat(GD[3]));
  g.text('e', 8, 24, 24, 'MESS', TP[1]); g.text('w', 8, 10, 24, 'MESS', TP[1]);
  for (const [a, b] of [[9, 35], [-11, 27]]) g.box(a, 7, b - 1, a + 18, 9, b, edge);
}, { margin: 14 });

def('prop_bench', 'World', [2, 1], 18, g => {
  const slat = planks(WD, 3, 2, 'x'), iron = flat(TP[1]);
  for (const y of [5, 7.5, 10]) g.box(2, y, 7, 30, y + 1.5, 8, slat);
  for (const z of [10, 13]) g.box(2, 3.5, z, 30, 4.5, z + 2, slat);
  for (const x of [4, 27]) { g.line(x, 11, 0, x, 6, 7, iron); g.line(x, 4, 0, x, 4, 15, iron); g.line(x, 4, 7, x, 11, 7, iron); g.line(x, 4, 9, x, 10, 9, iron); }
}, { margin: 4 });

def('prop_barbed_wire', 'World', [2, 1], 20, g => {
  for (const x of [3, 29]) { g.line(x, 2, 0, x, 14, 14, woodPost, .7); g.line(x, 14, 0, x, 2, 14, woodPost, .7); }
  g.line(3, 8, 7, 29, 8, 7, woodDark);
  const wire = flat(ST[3]), barb = flat(ST[1]);
  for (let x = 1; x < 31; x += .12) { const a = x * 1.15; g.set(x, 8 + Math.cos(a) * 5.6, 7 + Math.sin(a) * 5.6, wire); }
  for (let x = 1; x < 31; x += 2.3) { const a = x * 1.15; g.set(x, 8 + Math.cos(a) * 6.6, 7 + Math.sin(a) * 6.6, barb); }
  for (const [y, z] of [[2, 1], [14, 1], [8, 14]]) g.line(0, y, z, 32, y, z, wire);
}, { margin: 4 });

def('prop_gate_barrier', 'World', [3, 1], 64, g => {
  g.box(1, 4, 0, 8, 12, 2, concrete(CN, 3));
  g.box(2, 5, 2, 7, 11, 16, stripes(RD[2], WH[4], 4));
  g.box(1.5, 4.5, 16, 7.5, 11.5, 18, flat(TP[1]));
  const a = 78 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const arm = mat((x, y, z) => (ix((z - 14) / 5) & 1) ? RD[2] : WH[4]);
  g.cyl(6 - ca * 5, 8, 15 - sa * 5, 6 + ca * 44, 8, 15 + sa * 44, 1.4, arm);
  g.box(4 - ca * 8 - 2, 6, 15 - sa * 8 - 2, 4 - ca * 8 + 3, 10, 15 - sa * 8 + 3, flat(ST[2]));
  g.cylY(6, 15, 1.6, 4, 12, darkSteel);
  g.set(6 + ca * 44, 8, 15 + sa * 44 + 1, glow(RD[4]));
  // Rest fork on the far side.
  g.box(42, 7, 0, 45, 10, 12, stripes(RD[2], WH[4], 4)); g.box(41, 7, 12, 46, 10, 13, darkSteel); g.box(41, 7, 13, 42, 10, 15, darkSteel); g.box(45, 7, 13, 46, 10, 15, darkSteel);
  g.box(39, 10, 3, 48, 11, 12, flat(WH[4]));
  g.bitmap('s', 40, 10, 11, ['  rrr  ', ' rrrrr ', 'rrrrrrr', 'rwwwwwr', 'rrrrrrr', ' rrrrr ', '  rrr  '], { r: RD[2], w: WH[4] });
}, { margin: 6 });

def('prop_tree_palm', 'World', [2, 2], 92, g => {
  const bark = mat((x, y, z) => cl(WD, 2 + ((ix(z) % 3) === 0 ? -1 : 0) + (hash(ix(x), ix(z), 5) < .2 ? 1 : 0)));
  const P = t => [15 + 6 * t * t, 18 - 5 * t * t, 72 * t];
  for (let t = 0; t < 1; t += .02) { const [x, y, z] = P(t), [x1, y1, z1] = P(t + .02); g.cyl(x, y, z, x1, y1, z1 + .5, 2.6 - t * .9, bark); }
  const [cx, cy, cz] = P(1);
  g.ell(cx, cy, cz + 1, 2.6, 2.6, 2.4, flat(WD[1]));
  for (const [dx, dy] of [[-1.5, 1.5], [1.5, 1], [0, -1.5]]) g.ell(cx + dx, cy + dy, cz - 1.5, 1.4, 1.4, 1.4, flat(WD[0]));
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2 + hash(k, 1, 9) * .4, L = 19 + hash(k, 2, 9) * 6, lift = 5 + hash(k, 3, 9) * 3;
    const dx = Math.cos(a), dy = Math.sin(a), m = leaf(k % 2 ? 3 : 4, k);
    const pos = t => [cx + dx * L * t, cy + dy * L * t, cz + 1 + lift * t * 2.2 - (lift * 2.2 + 12) * t * t];
    for (let t = 0; t <= 1; t += .015) {
      const [x, y, z] = pos(t); g.set(x, y, z, m);
      if (t > .08) for (const s of [-1, 1]) { const ll = (1 - t) * 4.5 + 1.2; for (let u = .5; u <= ll; u += .5) g.set(x - dy * s * u, y + dx * s * u, z - u * .7, m); }
    }
  }
}, { margin: 22 });

def('prop_tree_jungle', 'World', [2, 2], 88, g => {
  const bark = mat((x, y, z) => cl(SM, 2 + ((ix(z * .5 + x) % 4) === 0 ? -1 : 0) + (hash(ix(x), ix(z), 3) < .25 ? 1 : 0)));
  g.cylZ(16, 16, 3, 0, 50, bark);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + .4, dx = Math.cos(a), dy = Math.sin(a);
    g.shape(4, 4, 0, 28, 28, 14, (x, y, z) => { const ax = x - 16, ay = y - 16, along = ax * dx + ay * dy, side = Math.abs(-ax * dy + ay * dx); return side < .8 && along > 2 && along < 10 && z < 13 * (1 - (along - 2) / 8); }, bark);
  }
  for (const [x, y, z] of [[7, 21, 46], [26, 10, 50], [21, 25, 58], [10, 9, 58]]) g.line(16, 16, 34, x, y, z, bark, 1.2);
  const clumps = [[16, 16, 60, 15, 14, 11], [7, 21, 49, 9, 9, 8], [26, 10, 52, 10, 9, 8], [21, 25, 64, 9, 8, 7], [10, 9, 66, 9, 8, 7], [17, 15, 70, 8, 8, 6]];
  clumps.forEach(([x, y, z, rx, ry, rz], i) => g.shape(x - rx, y - ry, z - rz, x + rx, y + ry, z + rz, (px, py, pz) => {
    const d = ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 + ((pz - z) / rz) ** 2;
    return d <= 1 - .35 * fbm(px * .25, py * .25 + pz * .25, 70 + i);
  }, leaf(3, i + 10)));
  for (const [x, y] of [[5, 26], [28, 18], [12, 4], [22, 30]]) { const z0 = g.top(x, y); if (z0 > 20) g.line(x, y, z0 - 6, x + .5, y + .5, z0 - 26, flat(GR[1])); }
}, { margin: 18 });

def('prop_bush', 'World', [1, 1], 16, g => {
  for (const [x, y, z, r] of [[6, 8, 4, 5], [11, 9, 4, 4.5], [8, 5, 6, 4.5], [9, 11, 3, 4]]) g.shape(x - r, y - r, 0, x + r, y + r, z + r, (px, py, pz) => ((px - x) / r) ** 2 + ((py - y) / r) ** 2 + ((pz - z) / r) ** 2 <= 1 - .3 * fbm(px * .4, py * .4 + pz * .4, 81), leaf(3, 5));
  for (const [x, y] of [[5, 6], [10, 7], [8, 10], [12, 11]]) { const z = g.top(x, y); if (z >= 0) g.set(x, y, z, flat(CR[3])); }
}, { margin: 4 });

// ======================= Vehicles =======================
function truckFront(g, od) {
  wheelX(g, 0, 54, 6, 6, 2, 7); wheelX(g, 0, 54, 6, 6, 25, 30);
  for (const cy of [22, 9]) { wheelX(g, 0, cy, 6, 6, 1, 8); wheelX(g, 0, cy, 6, 6, 24, 31); }
  g.box(7, 3, 4, 25, 62, 8, darkSteel);
  g.box(9, 46, 8, 23, 61, 21, od); g.box(10, 46, 20, 22, 61, 21, olive(8, 3));
  for (let y = 49; y < 57; y += 2) { g.box(8.5, y, 13, 9, y + 1, 18, flat(OL[1])); g.box(23, y, 13, 23.5, y + 1, 18, flat(OL[1])); }
  for (let x = 10; x < 22; x++) for (let z = 9; z < 20; z++) g.set(x, 60, z, x % 2 ? flat(OL[1]) : darkSteel);
  g.box(9, 61, 8, 23, 62, 9, darkSteel); g.box(9, 61, 20, 23, 62, 21, darkSteel);
  for (const [a, b] of [[2, 9], [23, 30]]) g.shape(a, 46, 8, b, 62, 16, (x, y, z) => z >= 13 + (y > 56 ? -(y - 56) * .6 : 0) && z < 15 + (y > 56 ? -(y - 56) * .6 : 0), od);
  for (const x of [5.5, 26.5]) { g.cylY(x, 16.5, 1.7, 58, 61, flat(OL[2])); g.cylY(x, 16.5, 1.3, 60.5, 61.5, glow(CR[3])); }
  g.box(2, 62, 6, 30, 64, 9, steel); g.box(12, 61, 9, 20, 63, 12, darkSteel);
  g.box(5, 36, 8, 27, 46, 30, od);
  g.box(4.5, 35.5, 29, 27.5, 46.5, 32, canvasMat(CV, 2, 5));
  g.box(6, 45, 20, 26, 46, 29, od);
  g.box(7, 45, 21, 15, 46, 28, glass); g.box(17, 45, 21, 25, 46, 28, glass);
  windowOn(g, 'w', 38, 5, 20, 6, 7, { frame: od, bars: false, sill: false }); windowOn(g, 'e', 38, 26, 20, 6, 7, { frame: od, bars: false, sill: false });
  g.box(3, 36, 8, 5, 46, 9, darkSteel); g.box(27, 36, 8, 29, 46, 9, darkSteel);
  g.bitmap('u', 13, 50, 20, roundelRows, roundelPal);
  g.bitmap('w', 5, 37, 17, roundelRows, roundelPal); g.bitmap('e', 26, 43, 17, roundelRows, roundelPal);
  g.text('s', 3, 63, 8, 'W-24', CR[2]);
}

def('veh_truck', 'Vehicles', [2, 4], 40, g => {
  const od = olive(5, 2), side = planks(OL, 2, 3);
  truckFront(g, od);
  g.box(3, 3, 9, 29, 35, 12, od);
  g.box(3, 3, 12, 4, 35, 18, side); g.box(28, 3, 12, 29, 35, 18, side); g.box(3, 34, 12, 29, 35, 18, side); g.box(3, 3, 12, 29, 4, 18, side);
  g.vaultY(4, 35, 16, 13, 17, 13, canvasMat(CV, 2, 7));
  for (const y of [7, 15, 23, 31]) g.vaultY(y, y + 1, 16, 13.6, 17, 13.6, flat(CV[1]));
  g.shape(6, 3, 17, 26, 5, 28, (x, y, z) => ((x - 16) / 10) ** 2 + ((z - 17) / 10) ** 2 <= 1, null);
  g.box(6, 4, 12, 26, 5, 26, interior);
  g.box(8, 5, 12, 14, 9, 18, planks(WD, 2, 2)); g.box(15, 5, 12, 22, 9, 16, flat(OL[3]));
  g.shape(5, 3, 26, 27, 5, 30, (x, y, z) => { const d = ((x - 16) / 13) ** 2 + ((z - 17) / 13) ** 2; return d <= 1 && d > .7; }, flat(CV[3]));
  for (const x of [4, 27]) g.box(x, 2, 9, x + 1, 3, 11, glow(RD[3]));
  g.text('n', 22, 3, 16, 'W-24', CR[2]);
}, { margin: 6 });

def('veh_fuel_truck', 'Vehicles', [2, 4], 40, g => {
  const od = olive(5, 2);
  truckFront(g, od);
  g.box(3, 3, 9, 29, 35, 11, darkSteel);
  const tank = olive(9, 2);
  g.shape(3, 4, 10, 29, 35, 31, (x, y, z) => { const e = Math.max(0, 6 - (y - 4), y - 33); return ((x - 16) / (12.5 - e * .25)) ** 2 + ((z - 20) / (9.5 - e * .25)) ** 2 <= 1; }, tank);
  for (const y of [12, 22]) g.shape(3, y, 10, 29, y + 1, 31, (x, yy, z) => ((x - 16) / 12.8) ** 2 + ((z - 20) / 9.8) ** 2 <= 1, flat(OL[1]));
  g.box(13, 6, 29, 19, 33, 30, mat((x, y) => (ix(y) % 2 ? ST[2] : ST[1])));
  for (const y of [9, 19, 29]) { g.cylZ(16, y, 2.2, 29, 31, flat(ST[2])); g.cylZ(16, y, 1.4, 31, 32, flat(ST[3])); }
  for (const x of [12, 20]) { for (const y of [7, 18, 32]) g.box(x, y, 30, x + 1, y + 1, 33, darkSteel); g.box(x, 7, 32, x + 1, 33, 33, darkSteel); }
  g.box(5, 1, 9, 27, 4, 20, flat(ST[1]));
  g.cylX(2.5, 16, 3, 8, 24, flat(RB[2])); g.box(6, 1, 15, 8, 3, 18, flat(ST[3]));
  g.box(22, 1, 9, 26, 2, 13, redPaint);
  g.surfText('w', 9, 24, 'AVGAS', RD[2]); g.surfText('e', 27, 24, 'AVGAS', RD[2]);
  g.text('n', 21, 1, 19, 'FUEL', RD[3]);
  for (const x of [4, 27]) g.box(x, 2, 9, x + 1, 3, 11, glow(RD[3]));
}, { margin: 6 });

def('veh_tank', 'Vehicles', [3, 4], 56, g => {
  const hull = olive(6, 2), trk = mat((x, y, z, f) => f === 'u' ? (ix(y) % 3 === 0 ? RB[0] : RB[2]) : (ix(y) % 3 === 0 ? RB[1] : RB[2]));
  for (const [a, b] of [[1, 11], [37, 47]]) g.shape(a, 2, 0, b, 62, 15, (x, y, z) => { const yy = y < 9.5 ? 9.5 : y > 54.5 ? 54.5 : y; return (y - yy) ** 2 + (z - 7) ** 2 <= 49; }, trk);
  for (const [a, b] of [[0, 1.5], [46.5, 48]]) {
    for (let k = 0; k < 6; k++) g.cylX(13 + k * 7.2, 5, 3.4, a, b, flat(ST[2]));
    g.cylX(56, 9, 4.2, a, b, flat(ST[1])); g.cylX(7, 8, 3.6, a, b, flat(ST[1]));
    for (let k = 0; k < 3; k++) g.box(a, 15 + k * 14.4, 6, b, 22 + k * 14.4, 10, flat(OL[1]));
  }
  g.box(11, 4, 4, 37, 60, 14, hull);
  g.shape(3, 6, 14, 45, 61, 26, (x, y, z) => z < 25 - Math.max(0, y - 46) * .82 - Math.max(0, 10 - y) * .6, hull);
  g.topPaint(12, 7, 36, 17, (x, y) => (ix(x) % 3 === 0 ? flat(OL[1]) : null));
  const hatch = flat(OL[3]), rim = flat(OL[1]);
  for (const x of [14, 29]) g.topPaint(x, 46, x + 7, 52, (px, py) => (px < x + 1 || px > x + 6 || py < 47 || py > 51) ? rim : hatch);
  g.cylY(29.5, 20, 1.6, 54, 57, flat(ST[1])); g.cylY(29.5, 20, .8, 56, 58, flat(ST[0]));
  for (const x of [5, 41]) { g.box(x - 2, 59, 17, x + 2, 61, 19, darkSteel); g.cylY(x, 18, 1.3, 60, 62, glow(CR[3])); }
  for (let x = 10; x < 38; x += 6) g.box(x, 55, 15, x + 5, 59, 18, flat(RB[2]));
  // Rounded cast turret, mantlet, 75 mm gun, cupola with .50 cal.
  g.shape(11, 16, 25, 37, 44, 37, (x, y, z) => ((x - 24) / 12.5) ** 2 + ((y - 29) / 13.5) ** 2 + ((z - 25) / 11.5) ** 2 <= 1 && z < 35, hull);
  g.box(18, 40, 25, 30, 45, 33, olive(11, 1));
  g.cylY(24, 29.5, 1.35, 44, 70, flat(ST[1])); g.cylY(24, 29.5, 1.8, 66, 70, flat(ST[2]));
  g.cylZ(29, 25, 3.6, 34, 37, flat(OL[1])); g.box(25, 22, 37, 32, 24, 39, flat(OL[2]));
  g.line(29, 27, 38, 29, 33, 38.5, flat(ST[0]), .6);
  g.cylZ(18, 25, 2.4, 34, 36, flat(OL[3]));
  g.line(19, 18, 34, 19, 16, 52, darkSteel);
  g.bitmap('w', 3, 14, 24, roundelRows, roundelPal); g.bitmap('e', 44, 50, 24, roundelRows, roundelPal);
  discTop(g, 22, 31, 3.6, 1.7, cream, flat(GD[2]));
  g.text('w', 3, 30, 22, 'A-14', CR[2]); g.text('e', 44, 34, 22, 'A-14', CR[2]);
  g.line(14, 5, 25, 34, 5, 25, woodDark); g.line(14, 6, 25, 22, 6, 25, flat(ST[3]));
  g.cylZ(24, 4, 1.6, 23, 26, flat(ST[1]));
}, { margin: 8 });

def('veh_aa_gun', 'Vehicles', [2, 2], 36, g => {
  const od = olive(12, 2);
  for (const [x, y] of [[1, 16], [31, 16], [16, 1], [16, 31]]) { g.cyl(16, 16, 4, x, y, 2, 1.3, od); g.cylZ(x, y, 2.2, 0, 1.2, darkSteel); g.box(x - .5, y - .5, 1, x + .5, y + .5, 4, darkSteel); }
  g.box(9, 9, 3, 23, 23, 6, od); g.cylZ(16, 16, 3, 6, 10, flat(OL[1]));
  g.box(11, 11, 10, 21, 21, 17, od);
  for (const x0 of [8, 19]) g.box(x0, 21, 11, x0 + 5, 22, 21, flat(OL[3]));
  const el = 40 * Math.PI / 180, cy = Math.cos(el), sz = Math.sin(el);
  g.cyl(16, 15, 16, 16, 15 + 7 * cy, 16 + 7 * sz, 1.9, flat(OL[1]));
  g.cyl(16, 15, 16, 16, 15 + 22 * cy, 16 + 22 * sz, 1.05, darkSteel);
  g.cyl(16, 15 + 19 * cy, 16 + 19 * sz, 16, 15 + 23 * cy, 16 + 23 * sz, 1.6, flat(ST[1]));
  g.box(15, 11, 17, 17, 14, 24, flat(GD[2])); g.box(15, 11, 24, 17, 14, 25, flat(GD[1]));
  for (const x of [6, 23]) { g.box(x, 12, 9, x + 3, 15, 11, flat(TP[2])); g.box(x, 11, 11, x + 3, 12, 15, flat(TP[2])); g.cylX(18, 14, 2.2, x === 6 ? 9 : 22, x === 6 ? 10 : 23, flat(ST[3])); }
  g.shape(12, 22, 20, 20, 23, 28, (x, y, z) => Math.abs(Math.hypot(x - 16, z - 24) - 3) < .6, darkSteel);
}, { margin: 8 });

def('veh_artillery', 'Vehicles', [2, 3], 30, g => {
  const od = olive(14, 2);
  for (const [a, b] of [[1, 6], [26, 31]]) { g.cylX(26, 7, 7, a, b, rubber); g.cylX(26, 7, 3.4, a - .1, b + .1, od); g.cylX(26, 7, 1.2, a - .2, b + .2, darkSteel); }
  g.box(6, 25, 6, 26, 28, 9, od);
  g.box(11, 17, 7, 21, 34, 13, od);
  g.shape(3, 29, 6, 29, 34, 23, (x, y, z) => Math.abs(y - (30 + (z - 6) * .14)) < .8 && !(Math.abs(x - 16) < 3.5 && z > 12) && z < 23 - Math.abs(x - 16) * .25, flat(OL[3]));
  const el = 8 * Math.PI / 180;
  g.cyl(16, 20, 14, 16, 20 + 30 * Math.cos(el), 14 + 30 * Math.sin(el), 1.45, flat(ST[1]));
  g.cyl(16, 20 + 27 * Math.cos(el), 14 + 27 * Math.sin(el), 16, 20 + 30.5 * Math.cos(el), 14 + 30.5 * Math.sin(el), 1.9, flat(ST[2]));
  g.cyl(16, 20, 11, 16, 38, 13.4, 1.8, flat(OL[1]));
  g.box(14, 15, 12, 18, 21, 17, flat(OL[2]));
  for (const s of [-1, 1]) {
    g.cyl(16 + s * 4, 22, 8, 16 + s * 11, 3, 2.5, 1.4, od);
    g.box(16 + s * 11 - 3, 0, 0, 16 + s * 11 + 3, 3, 4, flat(ST[2]));
    g.line(16 + s * 10, 6, 4, 16 + s * 10, 6, 8, darkSteel);
  }
  g.box(20, 32, 13, 22, 34, 17, darkSteel); g.cylY(21, 18, 1, 33, 35, glass);
  g.box(2, 34, 0, 8, 40, 5, planks(OL, 3, 2));
}, { margin: 6 });

def('veh_motorcycle', 'Vehicles', [1, 2], 24, g => {
  const od = olive(15, 2), leather = flat(WD[1]);
  for (const cy of [6, 26]) { g.cylX(cy, 5, 5, 7, 9, rubber); g.cylX(cy, 5, 3.6, 6.9, 9.1, flat(ST[3])); g.cylX(cy, 5, 1.2, 6.5, 9.5, darkSteel); }
  g.line(8, 6, 5, 8, 12, 11, darkSteel, .7); g.line(8, 12, 11, 8, 22, 13, darkSteel, .7); g.line(8, 12, 5, 8, 22, 13, darkSteel, .7);
  for (const x of [7, 9]) g.line(x, 26, 5, x, 22.5, 15, flat(ST[3]));
  g.ell(8, 17, 13.5, 2.6, 4.5, 2.2, od);
  g.box(6.5, 9, 12, 9.5, 14, 14, leather); g.box(7, 7, 11, 9, 9, 13, leather);
  g.line(2, 22.5, 17, 14, 22.5, 17, darkSteel); g.set(2, 22.5, 17, flat(TP[1])); g.set(14, 22.5, 17, flat(TP[1]));
  g.cylY(8, 14, 1.8, 24, 26.5, flat(ST[2])); g.cylY(8, 14, 1.3, 26, 27, glow(CR[3]));
  g.shape(6, 21, 8, 10, 31, 12, (x, y, z) => { const d = Math.hypot(y - 26, z - 5); return d > 5.5 && d < 6.6 && z > 5 && Math.abs(x - 8) < 1.5; }, od);
  g.shape(6, 1, 8, 10, 11, 12, (x, y, z) => { const d = Math.hypot(y - 6, z - 5); return d > 5.5 && d < 6.6 && z > 5 && Math.abs(x - 8) < 1.5; }, od);
  for (const x0 of [3.5, 10]) g.box(x0, 2, 5, x0 + 2.5, 8, 10, leather);
  g.box(6, 2, 10, 10, 8, 11, darkSteel);
  g.line(12, 25, 6, 12, 19, 15, leather, .8);
  g.box(6, 12, 3, 10, 18, 9, flat(ST[2])); g.line(7, 13, 9, 6, 15, 12, flat(ST[3]), .8); g.line(9, 16, 9, 10, 14, 12, flat(ST[3]), .8);
  g.line(10.5, 14, 4, 10.5, 1, 6, flat(ST[1]), .7);
  g.bitmap('w', 5.5, 15, 15, ['ccc', 'cgc', 'ccc'], roundelPal); g.bitmap('e', 10.5, 19, 15, ['ccc', 'cgc', 'ccc'], roundelPal);
}, { margin: 6 });

// ======================= Parked twin-engine aircraft =======================
// Shared airframe: nose +y, tail-dragger. o: { skin, radius(y), nose(g), tail(g, zc), marks(g, zc) }.
function twinAirframe(g, o) {
  const zc = y => 10 + y / 80 * 5;
  g.shape(40, 0, 0, 56, 81, 30, (x, y, z) => { const r = o.radius(y); return r > 0 && (x - 48) ** 2 + ((z - zc(y)) * 1.08) ** 2 <= r * r; }, o.skin);
  const LE = x => 60 - Math.abs(x - 48) * .09, TE = x => 44 + Math.abs(x - 48) * .1;
  g.shape(1, 40, 0, 95, 62, 24, (x, y, z) => {
    const ax = Math.abs(x - 48);
    if (ax > 46.5) return false;
    const tip = Math.sqrt(Math.max(0, 1 - Math.max(0, ax - 38) ** 2 / 90));
    const mid = (LE(x) + TE(x)) / 2, half = (LE(x) - TE(x)) / 2 * tip, zw = zc(y) - 4 + ax * .06;
    return Math.abs(y - mid) <= half && z >= zw && z < zw + 2.2 - ax * .015;
  }, o.skin);
  // Engines: nacelles, cowlings, three-blade props standing still.
  for (const s of [-1, 1]) {
    const cx = 48 + s * 18, nz = zc(58) - 1.5;
    g.shape(cx - 5, 36, nz - 5, cx + 5, 66, nz + 5, (x, y, z) => { const r = y > 50 ? 4.6 : 4.6 * Math.max(.2, (y - 34) / 16); return (x - cx) ** 2 + (z - nz) ** 2 <= r * r; }, o.skin);
    g.cylY(cx, nz, 4.9, 60, 66, o.cowl); g.cylY(cx, nz, 3.4, 65.5, 66.5, flat(ST[1]));
    g.shape(cx - 2, 66, nz - 2, cx + 2, 70, nz + 2, (x, y, z) => (x - cx) ** 2 + (z - nz) ** 2 <= (1.8 * (1 - (y - 66) / 4.2)) ** 2, o.spinner);
    for (const a of [90, 210, 330]) {
      const r = a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      for (const w of [-.45, .45]) g.line(cx + c * 1.5 - sn * w, 67, nz + sn * 1.5 + c * w, cx + c * 10.5 - sn * w * .6, 67, nz + sn * 10.5 + c * w * .6, flat(ST[1]));
      g.line(cx + c * 9.2, 67, nz + sn * 9.2, cx + c * 10.6, 67, nz + sn * 10.6, flat(GD[2]));
    }
    for (const y of [52, 56]) { g.set(cx + s * 5, y, nz + 1, darkSteel); g.set(cx + s * 5, y + 1, nz + 1, flat(ST[0])); }
    g.cyl(cx, 52, nz - 3, cx, 53, 4.5, .8, darkSteel); g.cylX(53, 4.5, 4.5, cx - 1.6, cx + 1.6, rubber); g.cylX(53, 4.5, 1.8, cx - 1.7, cx + 1.7, steel);
  }
  g.cyl(48, 4, zc(4) - 1.5, 48, 4.5, 2, .6, darkSteel); g.cylX(4.5, 1.8, 1.8, 47, 49, rubber);
  o.tail(g, zc);
  o.nose(g, zc);
  o.marks(g, zc);
}
const fuseRadius = (nose = 9) => y => y < 2 ? 0 : y < 30 ? 1.8 + (y - 2) / 28 * 4.8 : y < 80 - nose ? 6.6 : 6.6 * Math.sqrt(Math.max(0, 1 - ((y - (80 - nose)) / (nose + .5)) ** 2));
const discTop = (g, cx, cy, r1, r2, ring, centre) => g.topPaint(cx - r1 - 1, cy - r1 - 1, cx + r1 + 1, cy + r1 + 1, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r2 ? centre : d <= r1 ? ring : null; });

def('air_transport', 'Aircraft', [6, 5], 40, g => {
  const skin = mat((x, y, z, f) => { const n = fbm(x * .15, y * .15, 23); return f === 'u' ? (n > .58 ? OL[2] : OL[3]) : (n > .58 ? OL[1] : OL[2]); });
  twinAirframe(g, {
    skin, radius: fuseRadius(9), cowl: flat(OL[1]), spinner: flat(ST[2]),
    tail: (g, zc) => {
      g.shape(30, 1, 0, 66, 13, 24, (x, y, z) => { const ax = Math.abs(x - 48); return ax < 17.5 && y > 2 + ax * .18 && y < 12 - ax * .12 && Math.abs(z - zc(y) - 1) < .9; }, skin);
      g.shape(47, 0, 0, 49, 18, 34, (x, y, z) => z >= zc(y) && z <= zc(y) + 17 && y > 1 + (z - zc(y)) * .35 && y < 17 - (z - zc(y)) * .5, skin);
    },
    nose: (g, zc) => {
      for (const s of [-1, 1]) g.shape(48 + s * 1, 69, 0, 48 + s * 6, 75, 30, (x, y, z) => { const r = 6.6; return Math.abs((x - 48) ** 2 + ((z - zc(y)) * 1.08) ** 2 - r * r) < 14 && z > zc(y) + 2 && z < zc(y) + 6.5 && Math.abs(x - 48) > .6; }, glass);
      g.ell(48, 58, zc(58) + 6.6, 1.8, 1.8, 1.6, glass);
      g.line(48, 54, zc(54) + 6.6, 48, 12, zc(12) + 9, flat(ST[0])); g.box(47.5, 54, zc(54) + 6, 48.5, 55, zc(54) + 9, darkSteel);
    },
    marks: (g, zc) => {
      g.shape(40, 18, 0, 56, 21, 30, (x, y, z) => g.has(x, y, z), cream);
      for (const s of [-1, 1]) discTop(g, 48 + s * 32, 50, 5, 2.4, cream, flat(GD[2]));
      for (let y = 34; y < 64; y += 5) for (const [face, k] of [['w', 0], ['e', 0]]) g.surfBitmap(face, face === 'w' ? y : y + 1, zc(y) + 3, ['gg', 'gg'], { g: GL[1] });
      g.surfBitmap('e', 30, zc(26) + 4, ['ddddddd', 'd     d', 'd     d', 'd     d', 'd     d', 'd     d', 'd     d', 'ddddddd'], { d: OL[0] });
      g.surfBitmap('w', 22, zc(24) + 3, ['  ccc  ', ' ccccc ', 'ccgggcc', 'ccgggcc', ' ccccc ', '  ccc  '], roundelPal);
      g.surfBitmap('e', 28, zc(24) + 3, ['  ccc  ', ' ccccc ', 'ccgggcc', 'ccgggcc', ' ccccc ', '  ccc  '], roundelPal);
      g.text('w', 47, 4, 28, '43', CR[2]); g.text('e', 48, 10, 28, '43', CR[2]);
      g.set(48 + 46, 52, zc(52) - 4 + 46 * .06 + 1, glow(RD[4])); g.set(48 - 46, 52, zc(52) - 4 + 46 * .06 + 1, glow(PAL.GN));
    }
  });
}, { margin: 8 });

def('air_bomber_enemy', 'Aircraft', [6, 5], 42, g => {
  const { main, camo, mark } = LIVERY.jungle;
  const skin = mat((x, y, z, f) => { const n = fbm(x * .1, y * .1, 102); const top = f === 'u'; return n > .55 ? (top ? camo[2] : camo[1]) : (top ? main[3] : main[2]); });
  twinAirframe(g, {
    skin, radius: fuseRadius(10), cowl: flat(ST[3]), spinner: flat(main[1]),
    tail: (g, zc) => {
      g.shape(26, 1, 0, 70, 12, 24, (x, y, z) => { const ax = Math.abs(x - 48); return ax < 21.5 && y > 2 + ax * .1 && y < 11.5 - ax * .1 && Math.abs(z - zc(y) - 1) < .9; }, skin);
      for (const s of [-1, 1]) g.shape(48 + s * 20 - 1, 0, 0, 48 + s * 20 + 1, 14, 34, (x, y, z) => { const b = zc(y) + 1; return z >= b - 4 && z <= b + 10 && y > 1 + Math.abs(z - b) * .2 && y < 13 - Math.abs(z - b) * .35; }, flat(main[1]));
    },
    nose: (g, zc) => {
      g.shape(40, 70, 0, 56, 81, 30, (x, y, z) => { const r = fuseRadius(10)(y); return r > 0 && (x - 48) ** 2 + ((z - zc(y)) * 1.08) ** 2 <= r * r; }, mat((x, y, z) => (ix(y) % 4 === 0 || Math.abs(x - 48) < .6) ? ST[1] : (z > zc(y) + 3 ? GL[2] : GL[1]), { flat: true }));
      g.ell(48, 61, zc(61) + 5.5, 3.6, 5.5, 3.2, mat((x, y) => ix(y) % 3 === 0 ? ST[1] : GL[1], { flat: true }));
      g.ell(48, 36, zc(36) + 6.5, 3, 3, 3, glass);
      for (const s of [-1, 1]) g.line(48 + s * 1, 35, zc(36) + 8, 48 + s * 1, 28, zc(36) + 9, darkSteel);
      g.cylY(48, zc(77) - 3, .7, 79, 83, darkSteel);
    },
    marks: (g, zc) => {
      for (const s of [-1, 1]) discTop(g, 48 + s * 33, 50, 4.8, 2, flat(mark[0]), flat(mark[1]));
      for (const s of [-1, 1]) {
        const fx = 48 + s * 20;
        g.surfBitmap(s < 0 ? 'w' : 'e', s < 0 ? 4 : 10, zc(7) + 8, [' ccc ', 'cdddc', 'cdddc', ' ccc '], { c: mark[0], d: mark[1] });
      }
      g.surfBitmap('w', 22, zc(24) + 3, [' ccc ', 'cdddc', 'cdddc', ' ccc '], { c: mark[0], d: mark[1] });
      g.surfBitmap('e', 26, zc(24) + 3, [' ccc ', 'cdddc', 'cdddc', ' ccc '], { c: mark[0], d: mark[1] });
      g.surfText('w', 30, zc(30) + 2, 'K7', CR[2]); g.surfText('e', 36, zc(36) + 2, 'K7', CR[2]);
      g.set(48 + 46, 52, zc(52) - 4 + 46 * .06 + 1, glow(RD[4])); g.set(48 - 46, 52, zc(52) - 4 + 46 * .06 + 1, glow(PAL.GN));
    }
  });
}, { margin: 8 });

function build(add) {
  for (const spec of MODELS) {
    const r = renderModel(spec);
    for (const dir of ['s', 'e', 'n', 'w']) {
      const v = r[dir];
      add(spec.group, spec.id + '_' + dir, v.frames, { fps: spec.fps || 1, loop: true, anchor: v.anchor, foot: v.foot });
    }
  }
}

module.exports = { build, MODELS, renderModel };

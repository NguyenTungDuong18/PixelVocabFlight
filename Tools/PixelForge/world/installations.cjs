'use strict';
// World models: field installations (fuel, ammo, radar, radio, towers, guardhouse, AA, tent).
// Warm, readable Stardew-like massing with 1944 detail: weathered metal, moss at the foot of
// walls, grass tufts, crates and drums, lamps and stencils. Ids, footprints and frame counts
// are fixed by WorldModels.cs.
const { PAL, hash, fbm } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, RD, WD, GR, SN } = PAL;
const {
  WH, CN, TN, CV, DT, TP, RB, BR, cl, uv, ix, flat, glow, mottled, tin, planks, brick, sandbag, canvasMat,
  concrete, earth, glass, interior, olive, darkSteel, woodDark, woodPost, rope, redPaint, lampGlow,
  windowOn, doorOn, def, stripes, leaf, tarpaper, railing
} = require('./common.cjs');

// ---------------- Local helpers ----------------
const LEAVES = [leaf(2, 3), leaf(3, 5), leaf(4, 7)];
const PETALS = [flat(CR[3]), flat(GD[3]), flat(RD[3])];
// Grass tuft of 1-3 voxel blades (sometimes a flower) on the ground or on top of a surface.
function tuft(g, x, y, s, onTop = false) {
  for (let k = 0; k < 6; k++) {
    const X = ix(x + hash(k, s, 11) * 4 - 2), Y = ix(y + hash(k, s, 12) * 3 - 1);
    if (!onTop && g.has(X, Y, 0)) continue;
    const z0 = onTop ? g.top(X, Y) + 1 : 0, h = 1 + ix(hash(k, s, 13) * 2.6);
    g.box(X, Y, z0, X + 1, Y + 1, z0 + h, LEAVES[ix(hash(k, s, 14) * 3)]);
    if (k === 0 && hash(s, 1, 15) < .2) g.set(X, Y, z0 + h, PETALS[ix(hash(s, 2, 16) * 3)]);
  }
}
const tufts = (g, x0, y0, x1, y1, n, s, onTop) => { for (let k = 0; k < n; k++) tuft(g, x0 + hash(k, s, 21) * (x1 - x0), y0 + hash(k, s, 22) * (y1 - y0), s * 37 + k, onTop); };
// Rust / water streaks under horizontal seams and damp moss at the foot (mossZ < 0: none).
function weather(base, s = 1, mossZ = 0, stain = RD) {
  return mat((x, y, z, f) => {
    const c = base.fn(x, y, z, f);
    if (f === 'u') return c;
    const [u, v] = uv(x, y, z, f);
    if (mossZ >= 0 && z < mossZ + 3 && fbm(u * .35, z * .5, s + 3) > .48 + (z - mossZ) * .07) return cl(GR, 2 + (hash(ix(u), ix(z), s) < .3 ? 1 : 0));
    const len = 3 + hash(ix(u), 1, s) * 9, vv = ((ix(v) % 18) + 18) % 18;
    if (hash(ix(u), 2, s) < .08 && vv > 17 - len) return cl(stain, vv > 15 ? 2 : 1);
    return c;
  });
}
const CRATE = planks(WD, 3, 3), CRATE_E = flat(WD[1]), AMMO = planks(OL, 2, 3), AMMO_E = flat(OL[0]);
// Crate with darker edge battens.
function crate(g, x, y, z, w, d, h, body = CRATE, edge = CRATE_E) {
  g.shape(x, y, z, x + w, y + d, z + h, (X, Y, Z) => ((X < x + 1 || X > x + w - 1) + (Y < y + 1 || Y > y + d - 1) + (Z < z + 1 || Z > z + h - 1)) >= 2 ? edge : body);
}
const ring9 = (R, i) => mat((x, y, z, f) => f === 'u' ? cl(R, i - 1) : ([2, 6].includes(((ix(z) % 9) + 9) % 9) ? cl(R, i + 1) : cl(R, i)));
const DRUM_OL = ring9(OL, 2), DRUM_RD = ring9(RD, 2), DRUM_ST = ring9(ST, 2);
// 55-gallon drum standing on z (stack drums in steps of 9).
function drum(g, x, y, z = 0, m = DRUM_OL) { g.cylZ(x, y, 3.5, z, z + 9, m); g.set(x - 2, y - 1, z + 9, darkSteel); g.set(x + 1, y + 1, z + 9, darkSteel); }
function drumLying(g, x, y, z, m = DRUM_OL) { g.cylX(y, z + 3.5, 3.5, x, x + 9, m); g.cylX(y, z + 3.5, 3.7, x + 2, x + 3, m); g.cylX(y, z + 3.5, 3.7, x + 6, x + 7, m); }
// Gooseneck lamp from a wall point (x, y, z) leaning out along (dx, dy).
function lamp(g, x, y, z, dx, dy) {
  g.line(x, y, z, x + dx * 3, y + dy * 3, z + 1, darkSteel);
  g.box(x + dx * 3 - 1, y + dy * 3 - 1, z, x + dx * 3 + 2, y + dy * 3 + 2, z + 1, flat(OL[1]));
  g.set(x + dx * 3, y + dy * 3, z - 1, lampGlow);
}
// Spiral stair around a vertical tank: treads between radii r0..r1 from angle a0 to a1.
function spiralStair(g, cx, cy, r0, r1, a0, a1, z0, z1, step, rail) {
  const n = Math.ceil(Math.abs(a1 - a0) * r1 / 2), top = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = a0 + (a1 - a0) * t, z = z0 + (z1 - z0) * t, c = Math.cos(a), s = Math.sin(a);
    g.line(cx + c * r0, cy + s * r0, z, cx + c * r1, cy + s * r1, z, step);
    const p = [cx + c * (r1 + .5), cy + s * (r1 + .5), z];
    if (top.length) { const q = top[top.length - 1]; g.line(q[0], q[1], q[2] + 5, p[0], p[1], p[2] + 5, rail); }
    if (k % 3 === 0) g.line(p[0], p[1], z, p[0], p[1], z + 5, rail);
    top.push(p);
  }
}
const GRAVEL = mottled(SN, 1, 4, .6, .4);
const SB = sandbag(SN, 2);
const PIPE = flat(ST[2]);
const BUCKET = flat(RD[3]);

// ===== Fuel depot: grassy earth berm, two avgas tanks on saddles, vertical tank with a spiral
// stair, pipe manifold with valves, pump hut, drums, fire point and a NO SMOKING board.
def('bld_fuel_depot', 'World', [5, 4], 50, g => {
  const berm = mat((x, y, z, f) => {
    const n = fbm(x * .3, y * .3, 3);
    if (f === 'u') { const h = hash(ix(x), ix(y), 1); return h < .0012 ? CR[3] : h > .9988 ? GD[3] : cl(GR, 3 + (n > .62 ? 1 : n < .35 ? -1 : 0)); }
    return z > 5 ? cl(GR, 2) : cl(DT, 2 + (fbm(x * .3, z * .4, 5) > .6 ? 1 : 0));
  });
  g.shape(0, 0, 0, 80, 64, 9, (x, y, z) => {
    const d = Math.min(x, y, 80 - x, 64 - y) + (fbm(x * .15, y * .15, 4) - .5) * 2.2;
    const h = d < 4 ? d * 1.7 : d < 6.5 ? 6.8 : d < 9.5 ? (9.5 - d) * 2.3 : 0;
    return z < h && !(y > 46 && x > 32 && x < 50);
  }, berm);
  g.box(7, 7, 0, 73, 57, 1, GRAVEL);
  g.box(33, 48, 0, 49, 66, 1, concrete(CN, 2, 8));
  for (const x of [30, 49]) g.box(x, 49, 0, x + 3, 64, 7, SB);
  // Horizontal avgas tanks: weld bands, saddles, manholes, vents, short ladders.
  const tank = weather(mottled(ST, 3, 7, .7, .1), 3, -1), band = flat(ST[2]), saddle = concrete(CN, 3);
  for (const cy of [18, 36]) {
    for (const x of [14, 28, 42]) g.box(x, cy - 5, 0, x + 3, cy + 5, 6, saddle);
    g.cylX(cy, 11, 6.5, 11, 48, tank);
    g.ell(11, cy, 11, 1.8, 6.5, 6.5, tank); g.ell(48, cy, 11, 1.8, 6.5, 6.5, tank);
    for (const x of [21, 34]) g.cylX(cy, 11, 6.8, x, x + 1, band);
    g.cylZ(19, cy, 2.2, 16, 19, band); g.box(18, cy - 1, 19, 21, cy + 1, 20, flat(ST[3]));
    g.cylZ(42, cy, .8, 16, 21, darkSteel); g.box(41, cy - 1, 21, 44, cy + 2, 22, darkSteel);
  }
  g.surfText('s', 18, 13, 'AVGAS', RD[2]); g.surfText('n', 40, 13, 'AVGAS', RD[2]);
  for (const x of [8, 11]) g.box(x, 42, 0, x + 1, 43, 17, darkSteel);
  for (let z = 3; z < 17; z += 3) g.box(8, 42, z, 12, 43, z + 1, darkSteel);
  // Vertical tank, conical roof with rail, spiral stair on the east side.
  const vt = weather(mottled(OL, 3, 9, .7, .12), 5, -1);
  g.cylZ(61, 23, 8.5, 1, 32, vt); g.cone(61, 23, 9.2, 1.2, 32, 39, flat(ST[2]));
  for (const z of [11, 22]) g.cylZ(61, 23, 8.8, z, z + 1, flat(OL[1]));
  for (let a = 0; a < 6.28; a += .55) g.box(61 + Math.cos(a) * 8, 23 + Math.sin(a) * 8, 32, 62 + Math.cos(a) * 8, 24 + Math.sin(a) * 8, 36, darkSteel);
  g.shape(52, 14, 35, 71, 33, 36, (x, y) => Math.abs(Math.hypot(x - 61, y - 23) - 8.3) < .6, darkSteel);
  spiralStair(g, 61, 23, 8.6, 11, 1.6, -.9, 1, 31, flat(WD[3]), darkSteel);
  g.surfText('s', 57, 22, '100', CR[3]); g.surfText('s', 54, 15, 'OCT', CR[3]);
  // Pipes to a manifold with red hand wheels, dispenser pump at the gap.
  for (const cy of [18, 36]) g.line(49, cy, 6, 52, cy, 6, PIPE, .8);
  g.line(52, 18, 6, 52, 47, 6, PIPE, .8); g.line(61, 31, 3, 61, 47, 3, PIPE, .8); g.line(26, 47, 3, 66, 47, 3, PIPE, .8);
  for (const x of [36, 45, 56]) { g.box(x, 47, 3, x + 1, 48, 9, PIPE); g.cylY(x + .5, 9, 2, 48, 49, redPaint); g.set(x, 49, 9, flat(RD[1])); }
  g.box(38, 51, 0, 44, 56, 14, weather(flat(RD[2]), 9, -1)); g.box(37, 50, 14, 45, 57, 15, flat(ST[1]));
  g.box(39, 56, 7, 43, 57, 11, glass); g.box(39, 56, 4, 43, 57, 5, flat(GD[2]));
  g.shape(44, 52, 0, 52, 59, 3, (x, y) => Math.abs(Math.hypot(x - 48, y - 55.5) - 2.6) < .9, flat(RB[1]));
  g.line(44, 54, 10, 46.5, 55, 3, flat(RB[1]));
  // Pump hut in the north-east corner of the pad.
  g.box(63, 39, 0, 73, 47, 13, planks(OL, 2, 3)); g.shed(62, 38, 74, 49, 13, 3, 1, weather(tin(TN, 3, 'y'), 8, -1));
  doorOn(g, 's', 65, 46, 0, 5, 11, { leaf: planks(OL, 1, 4), frame: flat(OL[1]) });
  g.text('s', 70, 46, 11, 'P', CR[3]);
  // Drums, fire point with buckets and extinguisher, NO SMOKING board, lamp post.
  drum(g, 12, 47, 0, DRUM_RD); drum(g, 19, 48); drum(g, 12, 47, 9, DRUM_OL); drumLying(g, 9, 53, 0, DRUM_RD);
  g.box(23, 50, 0, 30, 51, 13, flat(RD[2])); g.box(23, 50, 13, 30, 52, 14, flat(RD[1]));
  for (const x of [24.5, 28.5]) g.cylZ(x, 52, 1.5, 6, 9, BUCKET);
  g.box(26, 51, 1, 27, 53, 6, flat(RD[3]));
  for (const x of [5, 27]) g.box(x, 59, 0, x + 1, 60, 21, woodPost);
  g.box(3, 60, 9, 31, 61, 22, flat(RD[2])); g.box(4, 60, 10, 30, 61, 21, flat(WH[4]));
  g.text('s', 13, 60, 20, 'NO', RD[2]); g.text('s', 4, 60, 14, 'SMOKING', RD[2]);
  g.box(52, 58, 0, 53, 59, 24, darkSteel); lamp(g, 52.5, 58.5, 24, -1, 0);
  // Grass tufts on the berm and at the pad edge.
  tufts(g, 0, 0, 80, 8, 10, 1, true); tufts(g, 0, 56, 30, 64, 4, 2, true); tufts(g, 52, 56, 80, 64, 4, 3, true);
  tufts(g, 0, 8, 6, 56, 5, 4, true); tufts(g, 74, 8, 80, 56, 5, 5, true); tufts(g, 6, 40, 30, 57, 3, 6);
});

// ===== Ammunition bunker: turfed concrete magazine with sloping wing walls, riveted steel doors
// under a canopy, narrow-gauge rails with a shell trolley, vents, lightning mast, blast bags.
def('bld_ammo_bunker', 'World', [5, 4], 48, g => {
  const turf = mat((x, y, z, f) => {
    const n = fbm(x * .22, y * .22, 8), h = hash(ix(x), ix(y), 2);
    if (f === 'u') return h < .0012 ? CR[3] : h > .9988 ? GD[3] : cl(GR, 3 + (n > .62 ? 1 : n < .36 ? -1 : 0));
    return cl(GR, 2 + (hash(ix(x), ix(z), 4) < .25 ? -1 : 0));
  });
  const conc = weather(concrete(CN, 3, 12), 4, 0, DT);
  g.shape(2, 0, 0, 78, 56, 33, (x, y, z) => {
    const ex = (x - 40) / 37, fy = Math.min(1, Math.max(0, (y - 1) / 15));
    if (Math.abs(ex) >= 1) return false;
    let h = 30 * Math.pow(1 - ex * ex, .85) * Math.pow(fy, .6) + (fbm(x * .2, y * .2, 8) - .5) * 3;
    // Toward the front the turf slumps onto the wing walls instead of ending in a cliff.
    if (y > 42) { const wing = x < 20 ? 6 + 27 * (x - 4) / 16 : x > 60 ? 6 + 27 * (76 - x) / 16 : 40; h = Math.max(Math.min(h, wing), h * (57 - y) / 15); }
    return z < h;
  }, turf);
  // Headwall with coping, sloping wing walls.
  g.box(20, 50, 0, 60, 58, 31, conc); g.box(19, 49, 31, 61, 59, 33, concrete(CN, 4));
  g.shape(4, 52, 0, 20, 58, 31, (x, y, z) => z < 4 + 27 * (x - 4) / 16, conc);
  g.shape(60, 52, 0, 76, 58, 31, (x, y, z) => z < 4 + 27 * (76 - x) / 16, conc);
  for (const x of [4, 75]) g.box(x, 51, 0, x + 1, 59, 5, concrete(CN, 4));
  const door = mat((x, y, z) => (ix(x) % 8 === 0 || ix(z) % 7 === 0) ? OL[1] : (ix(x) % 8 === 4 && ix(z) % 7 === 3 ? OL[3] : OL[2]));
  doorOn(g, 's', 32, 57, 0, 16, 20, { leaf: door, frame: flat(CN[4]), depth: 2, knob: false });
  g.box(39.5, 55, 0, 40.5, 56, 20, flat(OL[0]));
  for (const x of [37, 42]) g.box(x, 55, 9, x + 1, 56, 12, flat(GD[2]));
  for (const x of [32, 47]) for (const z of [3, 16]) g.box(x, 55, z, x + 1, 56, z + 2, flat(ST[1]));
  g.box(28, 58, 21, 52, 63, 23, concrete(CN, 4)); lamp(g, 40, 58, 21, 0, 1);
  g.box(28, 57, 24, 52, 58, 31, redPaint); g.text('s', 29, 57, 30, 'DANGER', WH[4]);
  g.text('s', 22, 57, 19, 'MAG', CR[3]); g.text('s', 24, 57, 12, '4', CR[3], 2);
  g.box(54, 57, 8, 58, 58, 14, flat(WH[3])); g.text('s', 55, 57, 13, '1', RD[2]);
  // Narrow-gauge rails with sleepers and a trolley of shell crates.
  for (let y = 57; y < 68; y += 3) g.box(33, y, 0, 47, y + 1, 1, woodDark);
  for (const x of [35, 44]) g.box(x, 56, 1, x + 1, 69, 2, flat(ST[3]));
  g.box(33, 61, 3, 47, 67, 5, planks(WD, 2, 2, 'y'));
  for (const x of [35, 44]) for (const y of [62.5, 65.5]) g.cylX(y, 3, 1.5, x - .5, x + 1.5, flat(ST[1]));
  crate(g, 34, 61.5, 5, 6, 5, 4, AMMO, AMMO_E); crate(g, 40, 61.5, 5, 6, 5, 4, AMMO, AMMO_E); crate(g, 37, 62, 9, 6, 4, 3, AMMO, AMMO_E);
  // Vents, lightning mast with down wire, bushes and tufts.
  for (const x of [24, 56]) { const z = g.top(x, 26); g.cylZ(x, 26, 1.5, z - 2, z + 5, darkSteel); g.cylZ(x, 26, 3, z + 5, z + 7, flat(ST[2])); g.cylZ(x, 26, 1.5, z + 7, z + 8, darkSteel); }
  g.line(40, 12, g.top(40, 12), 40, 12, 45, flat(ST[3]));
  g.line(40, 12, 44, 63, 4, 0, flat(ST[3]));
  for (const [x, y, s] of [[12, 30, 1], [66, 22, 2], [50, 10, 3], [30, 44, 4], [70, 44, 5]]) g.ell(x, y, g.top(x, y), 3.5, 3, 2.5, leaf(2 + (s & 1), s));
  for (const x of [6, 66]) g.box(x, 59, 0, x + 9, 64, 7, SB);
  drum(g, 59, 61, 0, DRUM_RD);
  tufts(g, 2, 2, 78, 50, 18, 7, true); tufts(g, 0, 56, 80, 64, 6, 8);
});

// ===== Radar station: rounded sandbag pit, operator cabin with tar-paper roof, cable trench,
// lattice mast with a rotating bedspring array (8 frames), generator trailer.
def('bld_radar', 'World', [3, 3], 66, (g, ctx) => {
  g.box(3, 3, 0, 45, 45, 1, GRAVEL);
  g.shape(0, 0, 0, 48, 48, 8, (x, y, z) => {
    const dx = Math.abs(x - 24), dy = Math.abs(y - 24), d = Math.pow(dx ** 4 + dy ** 4, .25);
    return d >= 19.5 && d < 23.8 - z * .3 && !(y > 36 && dx < 5);
  }, SB);
  const wall = weather(tin(OL, 2, 'y', 15), 6, 1);
  g.box(9, 26, 1, 39, 40, 22, wall);
  g.shed(7, 24, 41, 43, 22, 4, 1, tarpaper(TP, 3, 'x'));
  g.box(7, 42, 21, 41, 43, 22, flat(ST[2]));
  doorOn(g, 's', 20, 39, 1, 8, 15, { leaf: planks(OL, 1, 4), frame: flat(OL[1]) });
  windowOn(g, 's', 31, 39, 10, 5, 5, { frame: flat(OL[1]), shutters: flat(OL[1]) });
  windowOn(g, 'w', 29, 9, 10, 6, 5, { frame: flat(OL[1]) });
  g.box(19, 40, 0, 29, 43, 1, concrete(CN, 3)); g.box(20, 40, 1, 28, 42, 2, concrete(CN, 4));
  g.text('s', 11, 39, 20, 'SCR', CR[3]); g.text('s', 11, 39, 14, '268', CR[2]);
  g.box(12, 28, 25, 18, 33, 28, flat(ST[2])); for (let x = 12; x < 18; x += 2) g.box(x, 33, 25, x + 1, 34, 27, darkSteel);
  lamp(g, 30, 39, 18, 0, 1);
  // Cable from the cabin to the mast.
  g.line(26, 26, 18, 25, 19, 30, flat(TP[1])); g.line(25, 19, 30, 24, 17, 33, flat(TP[1]));
  // Lattice mast.
  for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.line(24 + dx, 15 + dy, 0, 24 + dx * .4, 15 + dy * .4, 34, darkSteel);
  for (let z = 4; z < 34; z += 6) { const k = 1 - z / 34 * .6; g.line(24 - 3 * k, 15 - 3 * k, z, 24 + 3 * k, 15 + 3 * k, z + 6, darkSteel); g.line(24 + 3 * k, 15 - 3 * k, z, 24 - 3 * k, 15 + 3 * k, z + 6, darkSteel); }
  g.box(19, 10, 0, 29, 20, 1, concrete(CN, 4));
  g.cylZ(24, 15, 2.5, 34, 37, flat(ST[3]));
  // Bedspring array: dipoles on the front face, reflector mesh behind.
  const a = ctx.frame * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const dip = flat(ST[4]), mesh = flat(ST[1]);
  for (let t = -14; t <= 14; t += .5) for (let zz = 0; zz <= 16; zz++) {
    const ti = Math.round(t * 2);
    if (ti % 8 === 0 || zz % 4 === 0) g.set(24 + ca * t - nx * 1.2, 15 + sa * t - ny * 1.2, 38 + zz, mesh);
    if (ti % 4 === 0 && zz % 4 === 2) for (const s of [.5, 1.5]) g.set(24 + ca * t + nx * s, 15 + sa * t + ny * s, 38 + zz, dip);
  }
  for (let zz = 0; zz <= 18; zz++) g.set(24, 15, 38 + zz, mesh);
  g.set(24, 15, 57, glow(RD[4]));
  // Generator trailer, jerrycans, tufts.
  g.box(35, 5, 3, 45, 17, 12, weather(flat(OL[2]), 7, -1)); g.box(34, 4, 12, 46, 18, 13, flat(OL[1]));
  for (let y = 6; y < 16; y += 2) g.box(45, y, 5, 46, y + 1, 10, darkSteel);
  for (const y of [7, 14]) g.cylX(y, 3, 3, 34, 46, flat(RB[1]));
  g.line(35, 11, 4, 31, 11, 1, darkSteel); g.cylZ(43, 7, .8, 13, 18, darkSteel);
  for (const x of [5, 9]) g.box(x, 34, 1, x + 3, 39, 8, flat(OL[3]));
  tufts(g, 2, 2, 46, 46, 8, 9);
}, { frames: 8, fps: 6, animated: true });

// ===== Radio hut: painted timber hut with a tin gable roof and porch hood, three-legged lattice
// mast with guy wires and aerial lead, whip aerial, generator, bench and sandbags.
def('bld_radio_hut', 'World', [3, 3], 86, g => {
  const wall = weather(planks(PAL.OL, 3, 3), 2, 2);
  g.box(5, 17, 0, 33, 43, 2, concrete(CN, 2));
  g.box(7, 19, 2, 31, 41, 26, wall);
  for (const [x, y] of [[7, 19], [30, 19], [7, 40], [30, 40]]) g.box(x, y, 2, x + 1, y + 1, 26, flat(OL[1]));
  const roof = weather(tin(TN, 3, 'x', 12), 11, -1);
  g.shape(4, 16, 26, 34, 44, 38, (x, y, z) => { const lim = 14 * (1 - (z - 26) / 12), d = Math.abs(y - 30); return d <= lim && d >= lim - 2.6; }, roof);
  g.shape(7, 20, 26, 31, 40, 38, (x, y, z) => Math.abs(y - 30) <= 14 * (1 - (z - 26) / 12) - 2.2, wall);
  g.box(4, 43, 25, 34, 44, 26, flat(ST[2])); g.box(32, 43, 2, 33, 44, 25, flat(ST[2]));
  doorOn(g, 's', 11, 40, 2, 8, 19, { leaf: planks(OL, 1, 4), frame: flat(CR[1]) });
  g.shed(9, 41, 21, 45, 21, 2, 1, flat(TN[2]));
  windowOn(g, 's', 23, 40, 11, 5, 6, { frame: flat(CR[1]), shutters: flat(OL[1]) });
  windowOn(g, 'w', 24, 7, 11, 8, 6, { frame: flat(CR[1]) });
  windowOn(g, 'e', 26, 30, 11, 8, 6, { frame: flat(CR[1]) });
  g.box(21, 40, 23, 30, 41, 26, flat(CR[2])); g.text('s', 21, 40, 25, 'RT', TP[1]);
  lamp(g, 15, 40, 23, 0, 1);
  // Whip aerial and insulators on the roof.
  g.line(10, 30, 36, 10, 30, 56, darkSteel); g.box(9, 29, 36, 12, 32, 37, flat(CR[2]));
  // Mast: three-legged lattice.
  const legs = [[38, 7], [44, 12], [37, 13]];
  for (const [x, y] of legs) { g.line(x, y, 0, 39.7 + (x - 39.7) * .3, 10.7 + (y - 10.7) * .3, 78, darkSteel); g.box(x - 1, y - 1, 0, x + 2, y + 2, 2, concrete(CN, 3)); }
  for (let z = 6; z < 76; z += 6) { const k = 1 - z / 78 * .7; const p = legs.map(([x, y]) => [39.7 + (x - 39.7) * k, 10.7 + (y - 10.7) * k]); for (let i = 0; i < 3; i++) { const q = p[(i + 1) % 3]; g.line(p[i][0], p[i][1], z, q[0], q[1], z + 3, darkSteel); } }
  g.box(32, 10, 74, 48, 11, 75, darkSteel); g.box(35, 10, 68, 45, 11, 69, darkSteel);
  g.set(40, 11, 79, glow(RD[4])); g.set(39, 11, 79, glow(RD[4]));
  for (const [x, y] of [[50, 0], [28, 0], [50, 24]]) { g.line(39.7, 10.7, 62, x, y, 0, flat(ST[3])); g.box(x - 1, y - 1, 0, x + 1, y + 1, 1, concrete(CN, 3)); }
  for (let t = 0; t <= 1; t += .02) g.set(39.7 + (20 - 39.7) * t, 10.7 + (30 - 10.7) * t, 66 + (38 - 66) * t - Math.sin(t * Math.PI) * 6, flat(TP[1]));
  // Generator with exhaust, fuel can, bench, sandbags.
  g.box(34, 30, 0, 46, 40, 10, weather(flat(OL[2]), 3, -1)); g.box(35, 31, 10, 45, 39, 11, flat(OL[3]));
  g.cylZ(44, 32, 1, 11, 18, darkSteel); for (let x = 35; x < 45; x += 2) g.box(x, 40, 2, x + 1, 41, 8, darkSteel);
  g.box(41, 41, 0, 45, 44, 8, flat(OL[3]));
  g.line(34, 35, 4, 31, 35, 6, flat(TP[1]));
  g.box(21, 43, 4, 30, 46, 5, planks(WD, 3, 2)); for (const x of [22, 28]) g.box(x, 44, 0, x + 1, 45, 4, woodDark);
  g.box(0, 22, 0, 6, 42, 6, SB);
  tufts(g, 0, 0, 48, 48, 10, 10);
});

// ===== Watchtower: timber legs with X bracing, plank parapet with sandbags, open lookout under a
// tin pyramid roof, searchlight, ladder with a mid landing.
def('bld_watchtower', 'World', [2, 2], 98, g => {
  const wallP = weather(planks(WD, 2, 3), 12, -1, DT);
  for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.line(x + .5, y + .5, 0, x + (x < 16 ? 2 : -2) + .5, y + (y < 16 ? 2 : -2) + .5, 52, woodPost, 1.1);
  for (const [a, b] of [[[2, 2], [29, 2]], [[2, 29], [29, 29]], [[2, 2], [2, 29]], [[29, 2], [29, 29]]]) {
    for (const [z0, z1] of [[4, 26], [26, 48]]) {
      const k0 = z0 / 52 * 2, k1 = z1 / 52 * 2, sx = p => p < 16 ? 1 : -1;
      const P = (p, k) => [p[0] + sx(p[0]) * k + .5, p[1] + sx(p[1]) * k + .5];
      const [ax0, ay0] = P(a, k0), [bx1, by1] = P(b, k1), [bx0, by0] = P(b, k0), [ax1, ay1] = P(a, k1);
      g.line(ax0, ay0, z0, bx1, by1, z1, woodDark); g.line(bx0, by0, z0, ax1, ay1, z1, woodDark);
      g.line(ax1, ay1, z1, bx1, by1, z1, woodPost);
    }
  }
  for (const [x, y] of [[0, 0], [28, 0], [0, 28], [28, 28]]) g.box(x, y, 0, x + 4, y + 4, 2, concrete(CN, 2));
  // Platform, parapet, corner posts, roof.
  g.box(-3, -3, 50, 35, 35, 52, planks(WD, 2, 3, 'x'));
  for (let x = -3; x < 35; x += 4) g.box(x, 34, 49, x + 1, 35, 50, woodDark);
  g.box(-2, -2, 52, 34, 34, 61, wallP); g.erase(0, 0, 52, 32, 32, 61);
  g.box(-2, -2, 61, 34, 34, 62, woodDark); g.erase(-1, -1, 61, 33, 33, 62);
  g.box(3, 33, 62, 27, 36, 65, SB);
  for (const [x, y] of [[-2, -2], [33, -2], [-2, 33], [33, 33]]) g.box(x, y, 61, x + 1, y + 1, 75, woodPost);
  g.pyramid(-7, -7, 39, 39, 74, 17, weather(tin(TN, 3, 'y', 12), 13, -1));
  g.box(-7, 38, 73, 39, 39, 74, flat(ST[2]));
  g.box(15, 15, 90, 17, 17, 95, darkSteel); g.ell(16, 16, 96, 1.5, 1.5, 1.5, flat(GD[2]));
  g.box(8, 34, 53, 24, 35, 59, flat(CR[2])); g.text('s', 10, 34, 58, 'T-1', TP[1]);
  // Searchlight on the front rail, MG barrel, field phone inside.
  g.box(28, 33, 62, 31, 35, 64, darkSteel);
  g.cylY(29.5, 67, 3, 32, 37, flat(ST[2])); g.cylY(29.5, 67, 2.2, 36.5, 37.5, glow(CR[3]));
  g.line(8, 30, 64, 8, 39, 65, darkSteel, .7);
  g.box(2, 2, 52, 8, 6, 58, flat(OL[2]));
  // Ladder with a landing halfway.
  for (const x of [12, 19]) g.line(x, 39, 0, x, 37, 26, woodPost);
  for (let z = 4; z < 26; z += 4) g.line(12, 39 - z / 26 * 2, z, 19, 39 - z / 26 * 2, z, woodDark);
  g.box(10, 31, 26, 22, 38, 27, planks(WD, 3, 2));
  for (const x of [12, 19]) g.line(x, 36, 27, x, 34, 50, woodPost);
  for (let z = 30; z < 50; z += 4) g.line(12, 36 - (z - 27) / 23 * 2, z, 19, 36 - (z - 27) / 23 * 2, z, woodDark);
  tufts(g, -4, -4, 36, 36, 8, 11);
}, { margin: 8 });

// ===== Water tower: steel trestle, timber-stave tank with hoops, balcony rail, conical roof,
// ladder, inlet pipe, small brick pump house under the trestle.
def('bld_water_tower', 'World', [3, 3], 100, g => {
  const leg = flat(ST[2]);
  const C = [[4, 4], [44, 4], [4, 44], [44, 44]], top = p => [24 + (p[0] - 24) * .55, 24 + (p[1] - 24) * .55];
  for (const p of C) { g.line(p[0], p[1], 0, ...top(p), 57, leg, 1); g.box(p[0] - 2, p[1] - 2, 0, p[0] + 3, p[1] + 3, 3, concrete(CN, 3)); }
  const at = (p, z) => { const t = top(p), k = z / 57; return [p[0] + (t[0] - p[0]) * k, p[1] + (t[1] - p[1]) * k]; };
  for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3]]) for (const [z0, z1] of [[3, 28], [28, 55]]) {
    const a0 = at(C[i], z0), b1 = at(C[j], z1), b0 = at(C[j], z0), a1 = at(C[i], z1);
    g.line(a0[0], a0[1], z0, b1[0], b1[1], z1, darkSteel); g.line(b0[0], b0[1], z0, a1[0], a1[1], z1, darkSteel);
    g.line(a1[0], a1[1], z1, b1[0], b1[1], z1, leg);
  }
  g.cylZ(24, 24, 1.8, 0, 58, flat(ST[1]));
  // Balcony with rail.
  g.cylZ(24, 24, 19, 56, 58, planks(WD, 2, 2));
  g.shape(4, 4, 58, 44, 44, 64, (x, y, z) => { const d = Math.hypot(x - 24, y - 24); return d > 17.8 && d <= 19 && (z > 62.5 || Math.round(Math.atan2(y - 24, x - 24) * 6) % 2 === 0); }, darkSteel);
  const staves = mat((x, y, z, f) => {
    if (f === 'u') return WD[2];
    if (ix(z) % 6 === 0) return ST[1];
    const b = ix((Math.atan2(y - 24, x - 24) + Math.PI) * 9);
    if (hash(b, ix(z / 3), 7) < .06) return cl(GR, 2);
    return cl(WD, 2 + (b % 2 ? 0 : 1) + (hash(b, 1, 3) < .3 ? -1 : 0));
  });
  g.cylZ(24, 24, 15, 58, 84, staves);
  g.cylZ(24, 24, 15.4, 82, 84, flat(ST[1]));
  g.cone(24, 24, 17.5, 1.5, 84, 95, weather(tin(TN, 3, 'x', 8), 14, -1));
  g.box(23, 23, 95, 25, 25, 98, darkSteel); g.ell(24, 24, 98, 1.4, 1.4, 1.4, flat(GD[2]));
  g.surfText('s', 15, 76, 'WATER', CR[3]); g.surfText('n', 33, 76, 'NO.2', CR[3]);
  for (const x of [21, 27]) g.line(x, 45, 0, x, 41, 56, darkSteel);
  for (let z = 4; z < 56; z += 4) g.line(21, 45 - z / 56 * 4, z, 27, 45 - z / 56 * 4, z, darkSteel);
  for (const x of [22, 26]) g.box(x, 39, 58, x + 1, 40, 82, darkSteel);
  for (let z = 60; z < 82; z += 4) g.box(22, 39, z, 27, 40, z + 1, darkSteel);
  // Overflow pipe down the east leg, pump house with tiled roof under the trestle.
  g.line(39, 24, 70, 41, 24, 70, PIPE, .8); g.line(41, 24, 70, 41, 24, 3, PIPE, .8); g.box(40, 23, 0, 43, 26, 1, concrete(CN, 4));
  g.box(10, 12, 0, 22, 22, 13, weather(brick(BR, 2), 15, 0)); g.gableY(10, 24, 9, 23, 13, 5, flat(RD[2]));
  doorOn(g, 's', 13, 21, 0, 5, 10, { leaf: planks(PAL.OL, 2, 4), frame: flat(CR[1]) });
  g.line(22, 17, 6, 24, 17, 6, PIPE, .8); g.line(24, 17, 6, 24, 24, 6, PIPE, .8);
  tufts(g, 0, 0, 48, 48, 12, 12);
});

// ===== Guardhouse: brick-based sentry booth with glazed upper walls, striped fascia, hipped tin
// roof with gutter, sandbag breastwork, HALT board, flower box, bench, fire bucket, lamp.
def('bld_guardhouse', 'World', [3, 3], 56, g => {
  g.box(7, 5, 0, 41, 35, 2, concrete(CN, 2));
  g.box(10, 8, 2, 38, 32, 13, weather(brick(BR, 2), 16, 2));
  g.box(10, 8, 13, 38, 32, 30, planks(WH, 3, 3));
  g.box(9, 7, 12, 39, 33, 13, flat(WH[2]));
  windowOn(g, 's', 13, 31, 16, 20, 10);
  windowOn(g, 'w', 11, 10, 16, 18, 10);
  windowOn(g, 'n', 14, 8, 16, 20, 10);
  doorOn(g, 'e', 14, 37, 2, 9, 26, { leaf: planks(OL, 2, 4) });
  g.box(6, 4, 30, 42, 36, 32, stripes(RD[2], WH[4], 4));
  g.hip(5, 3, 43, 37, 32, 10, weather(tin(TN, 3, 'y', 10), 17, -1));
  g.box(5, 36, 31, 43, 37, 32, flat(ST[2])); g.box(42, 36, 2, 43, 37, 31, flat(ST[2]));
  g.box(23, 19, 41, 25, 21, 46, darkSteel); g.box(22, 18, 46, 26, 22, 47, darkSteel);
  // Flower box under the front window.
  g.box(13, 32, 12, 33, 35, 15, planks(WD, 2, 2));
  for (let x = 13; x < 33; x++) if (hash(x, 1, 18) < .7) { g.set(x, 33 + (x & 1), 15, LEAVES[x % 3]); if (hash(x, 2, 18) < .35) g.set(x, 33 + (x & 1), 16, PETALS[x % 3]); }
  // HALT board on posts, lamp, field telephone, fire bucket, bench.
  for (const x of [17, 31]) g.box(x, 44, 0, x + 1, 45, 14, woodPost);
  g.box(15, 45, 6, 34, 46, 15, flat(RD[2])); g.box(16, 45, 7, 33, 46, 14, flat(WH[4]));
  g.text('s', 17, 45, 13, 'HALT', RD[2]);
  lamp(g, 37.5, 26, 26, 1, 0);
  g.box(38, 10, 12, 40, 13, 17, flat(OL[2]));
  g.box(38, 28, 8, 40, 31, 9, darkSteel); g.cylZ(40.5, 29.5, 1.5, 4, 8, BUCKET);
  g.box(42, 10, 4, 46, 24, 5, planks(WD, 3, 2)); for (const y of [11, 22]) g.box(43, y, 0, 45, y + 1, 4, woodDark);
  // Sandbag breastwork on the west and in front.
  g.shape(1, 37, 0, 14, 44, 10, (x, y, z) => y >= 37 + z * .2 && y < 44 - z * .2 && x >= 1 + z * .2, SB);
  g.shape(1, 12, 0, 8, 44, 10, (x, y, z) => x >= 1 + z * .2 && x < 8 - z * .2, SB);
  tufts(g, 0, 0, 48, 48, 9, 13);
});

// ===== AA emplacement: rounded sandbag ring, ready-use lockers with shell clips, twin 40 mm with
// shield plates and crew seats on a pedestal (barrels to the front), rangefinder, casings.
def('bld_aa_emplacement', 'World', [4, 4], 46, g => {
  g.box(4, 4, 0, 60, 60, 1, earth(2));
  g.shape(0, 0, 0, 64, 64, 14, (x, y, z) => { const d = Math.hypot(x - 32, y - 32) + (fbm(x * .3, y * .3, 9) - .5) * 1.2; return d >= 24 && d <= 31.5 - z * .35 && !(y < 20 && Math.abs(x - 32) < 5); }, SB);
  // Ready-use lockers with clips of brass shells on top.
  for (const x of [9, 47]) {
    g.box(x, 26, 1, x + 8, 38, 7, planks(OL, 2, 3)); g.box(x, 26, 7, x + 8, 38, 8, flat(OL[1]));
    for (let y = 27; y < 37; y += 3) { g.box(x + 1, y, 8, x + 7, y + 2, 10, flat(GD[2])); g.box(x + 1, y, 10, x + 3, y + 2, 11, flat(GD[3])); }
  }
  g.cylZ(32, 32, 7, 1, 7, olive(4, 2)); g.cylZ(32, 32, 9, 7, 9, flat(OL[1]));
  g.box(25, 25, 9, 39, 40, 19, olive(7, 2));
  // Shield plates either side of the breech.
  for (const x of [23, 40]) g.shape(x, 34, 9, x + 1, 42, 24, (X, Y, Z) => Z < 24 - (Y - 34) * .6, olive(8, 3));
  for (const x of [19, 41]) { g.box(x, 28, 9, x + 4, 33, 11, flat(TP[2])); g.box(x, 27, 11, x + 4, 28, 16, flat(TP[2])); g.cylX(35, 15, 2.5, x === 19 ? 22.5 : 40, x === 19 ? 24 : 41.5, flat(ST[3])); }
  const el = 35 * Math.PI / 180;
  for (const bx of [29.5, 34.5]) {
    g.line(bx, 33, 17, bx, 39, 21, flat(OL[1]), 1.8);
    g.line(bx, 37, 19, bx, 37 + 26 * Math.cos(el), 19 + 26 * Math.sin(el), darkSteel, 1.05);
    g.line(bx, 37 + 22 * Math.cos(el), 19 + 22 * Math.sin(el), bx, 37 + 26.5 * Math.cos(el), 19 + 26.5 * Math.sin(el), flat(ST[1]), 1.6);
    g.box(bx - 1, 30, 19, bx + 1, 33, 25, flat(GD[2])); g.box(bx - 1, 30, 25, bx + 1, 33, 26, flat(GD[1]));
  }
  g.shape(28, 44, 24, 37, 45, 33, (x, y, z) => Math.abs(Math.hypot(x - 32.5, z - 28.5) - 3.5) < .6, darkSteel);
  // Rangefinder on a tripod, ammo crates, spent casings.
  for (const [dx, dy] of [[-2, 2], [2, 2], [0, -2]]) g.line(14, 14, 12, 14 + dx, 14 + dy, 1, darkSteel);
  g.cylX(14, 13, 1.2, 8, 20, flat(OL[2])); g.box(13, 13, 12, 15, 15, 14, flat(OL[1]));
  crate(g, 44, 10, 1, 8, 5, 4, AMMO, AMMO_E); crate(g, 45, 10, 5, 6, 5, 3, AMMO, AMMO_E);
  for (const [x, y] of [[20, 44], [22, 46], [44, 22], [41, 45], [36, 48], [26, 18]]) g.box(x, y, 1, x + 2, y + 1, 2, flat(GD[2]));
  tufts(g, 0, 0, 64, 64, 10, 14);
});

// ===== Field tent: olive wall tent with low side walls, rolled side flap, tied-back door flaps,
// cot and lantern inside, guy ropes and pegs, stool and crate at the door.
def('bld_tent', 'World', [3, 3], 40, g => {
  const cv = canvasMat(CV, 2, 8), cvLit = canvasMat(CV, 3, 8), floor = flat(CV[0]);
  // Hollow side walls, thin roof shell (ridge along y) and gable-end walls.
  g.box(6, 6, 0, 42, 42, 10, cv); g.erase(7, 7, 0, 41, 41, 10); g.box(7, 7, 0, 41, 41, 1, floor);
  g.shape(4, 4, 10, 44, 44, 30, (x, y, z) => { const lim = 20 * (1 - (z - 10) / 19), d = Math.abs(x - 24); return d <= lim && d >= lim - 2.2; }, cvLit);
  for (const y of [6, 41]) g.shape(6, y, 10, 42, y + 1, 29, (x, y2, z) => Math.abs(x - 24) <= 18 * (1 - (z - 10) / 18), cv);
  g.box(4, 4, 9, 5, 44, 10, flat(CV[1])); g.box(43, 4, 9, 44, 44, 10, flat(CV[1]));
  // Rolled-up east flap shows the inside.
  g.erase(41, 14, 1, 42, 34, 9); g.cylY(42.5, 9.5, 1.5, 13, 35, flat(CV[3]));
  // Door opening in the front gable.
  const door = (x, z) => z < 19 && Math.abs(x - 24) <= 7 - z * .2;
  for (let z = 1; z < 24; z++) for (let x = 14; x < 34; x++) if (door(x + .5, z + .5)) g.erase(x, 41, z, x + 1, 42, z + 1);
  // Cot, kit bag and lantern inside.
  g.box(29, 16, 3, 39, 36, 4, canvasMat(CV, 3, 6)); for (const [x, y] of [[29, 16], [38, 16], [29, 35], [38, 35]]) g.box(x, y, 0, x + 1, y + 1, 3, woodDark);
  g.box(30, 17, 4, 37, 21, 5, flat(CR[2])); g.box(30, 24, 4, 37, 33, 5, flat(OL[2]));
  g.box(11, 30, 1, 16, 38, 5, flat(OL[2])); g.box(17, 34, 1, 21, 38, 6, planks(WD, 2, 2)); g.box(18, 35, 6, 20, 37, 8, lampGlow);
  g.box(18, 42, 0, 30, 47, 1, floor); g.line(24, 32, 27, 24, 32, 19, rope); g.box(23, 31, 16, 26, 34, 19, lampGlow);
  // Tied-back door flaps.
  for (const s of [-1, 1]) g.shape(24 + s * 8 - 3, 42, 0, 24 + s * 8 + 3, 45, 22, (x, y, z) => Math.abs(x - (24 + s * (6.5 * (1 - z / 24) + 1.5))) < 1.7 - z / 28 && y < 43 + (1 - z / 22) * 1.6, flat(CV[3]));
  g.box(23.5, 1, 28, 24.5, 47, 30, woodDark);
  for (const y of [10, 24, 38]) { g.line(4, y, 10, 0, y, 0, rope); g.line(43, y, 10, 47, y, 0, rope); g.box(0, y, 0, 1, y + 1, 2, woodDark); g.box(47, y, 0, 48, y + 1, 2, woodDark); }
  g.line(24, 47, 29, 24, 52, 0, rope); g.box(24, 52, 0, 25, 53, 2, woodDark);
  g.surfText('w', 18, 8, '12', CV[0]); g.text('s', 9, 41, 20, '12', CV[0]);
  // Stool, crate, sandbag at the corner.
  g.box(10, 46, 4, 14, 49, 5, planks(WD, 3, 2)); for (const x of [10, 13]) g.box(x, 47, 0, x + 1, 48, 4, woodDark);
  crate(g, 34, 45, 0, 7, 5, 5);
  g.box(0, 41, 0, 7, 46, 5, SB);
  tufts(g, 0, 0, 48, 48, 10, 15);
});

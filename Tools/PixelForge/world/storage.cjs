'use strict';
// World models: storage — warehouses, Quonset stores, steel sheds, cold store, parts store with a
// gable hoist, tank farm, horizontal tank, earth-covered magazines, lumber store, camouflaged dump,
// small sheds, drum dump. Prefixes: bld_store_*, bld_depot_*, bld_tank_*, bld_bunker_*, bld_shed_*.
// Library models (not placed on a map yet). Front (doors) faces +y.
const { PAL, hash, fbm } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, GR, SN } = PAL;
const {
  WH, CN, TN, CV, DT, TP, RB, BR, cl, uv, ix, flat, glow, mottled, tin, planks, brick, sandbag,
  canvasMat, concrete, glass, interior, darkSteel, rubber, woodDark, woodPost, rope, redPaint, lampGlow,
  windowOn, doorOn, def, leaf, tarpaper, gableRoofX, railing, smokeOverlay
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
// Roof sheet with rust patches on the top faces.
function rustRoof(base, s) {
  return mat((x, y, z, f) => {
    const c = base.fn(x, y, z, f);
    if (f !== 'u') return c;
    const n = fbm(x * .07 + s, y * .07, s + 40);
    return n > .76 ? cl(RD, 1) : n > .7 && hash(ix(x), ix(y), s) < .5 ? cl(DT, 2) : c;
  });
}
const CRATE = planks(WD, 3, 3), CRATE_E = flat(WD[1]), AMMO = planks(OL, 2, 3), AMMO_E = flat(OL[0]);
function crate(g, x, y, z, w, d, h, body = CRATE, edge = CRATE_E) {
  g.shape(x, y, z, x + w, y + d, z + h, (X, Y, Z) => ((X < x + 1 || X > x + w - 1) + (Y < y + 1 || Y > y + d - 1) + (Z < z + 1 || Z > z + h - 1)) >= 2 ? edge : body);
}
const ring9 = (R, i) => mat((x, y, z, f) => f === 'u' ? cl(R, i - 1) : ([2, 6].includes(((ix(z) % 9) + 9) % 9) ? cl(R, i + 1) : cl(R, i)));
const ringX = (R, i) => mat((x, y, z, f) => [2, 6].includes(((ix(x) % 9) + 9) % 9) ? cl(R, i + 1) : cl(R, i));
const DRUM = { OL: ring9(OL, 2), RD: ring9(RD, 2), ST: ring9(ST, 2), BL: ring9(TP, 3) }, DRUMX = { OL: ringX(OL, 2), RD: ringX(RD, 2), ST: ringX(ST, 2) };
function drum(g, x, y, z = 0, k = 'OL') { g.cylZ(x, y, 3.5, z, z + 9, DRUM[k]); g.set(x - 2, y - 1, z + 9, darkSteel); g.set(x + 1, y + 1, z + 9, darkSteel); }
function drumLying(g, x, y, z = 0, k = 'OL') { g.cylX(y, z + 3.5, 3.5, x, x + 9, DRUMX[k]); }
function lamp(g, x, y, z, dx, dy) {
  g.line(x, y, z, x + dx * 3, y + dy * 3, z + 1, darkSteel);
  g.box(x + dx * 3 - 1, y + dy * 3 - 1, z, x + dx * 3 + 2, y + dy * 3 + 2, z + 1, flat(OL[1]));
  g.set(x + dx * 3, y + dy * 3, z - 1, lampGlow);
}
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
const GRAVEL = mottled(SN, 2, 4, .66, .25), SB = sandbag(SN, 2), PIPE = flat(ST[2]), FLOOR = concrete(CN, 2, 8);
const PALLET = flat(WD[3]), SACK = mottled(SN, 3, 12, .65, .3), BUCKET = flat(RD[3]);
const ROLL = mat((x, y, z, f) => f === 'u' ? TN[2] : (((ix(z) % 3) + 3) % 3 === 0 ? TN[1] : TN[3]));
// Roller shutter in a south wall (outer plane p); open 0..1 rolls the curtain up into the housing.
function rollerS(g, x, p, z, w, h, open = 0) {
  const zc = z + Math.round(h * open);
  g.erase(x, p - 1, z, x + w, p + 1, z + h);
  g.box(x, p - 1, zc, x + w, p, z + h, ROLL);
  if (zc > z) { g.erase(x, p - 12, z, x + w, p - 1, zc); g.box(x, p - 13, z, x + w, p - 12, zc, interior); g.box(x, p - 13, z - 1, x + w, p + 1, z, FLOOR); }
  g.box(x, p - 1, zc, x + w, p, zc + 1, flat(ST[1]));
  for (const gx of [x - 1, x + w]) g.box(gx, p, z, gx + 1, p + 1, z + h, flat(ST[2]));
  g.box(x - 1, p, z + h, x + w + 1, p + 2, z + h + 3, flat(TN[2]));
}
// Sliding door leaf hung in front of a south wall plane p: framed, X-braced.
function leafS(g, x, p, z, w, h, m) {
  g.box(x, p + 1, z, x + w, p + 2, z + h, m);
  const L = Math.hypot(w, h);
  g.shape(x, p + 2, z, x + w, p + 3, z + h, (X, Y, Z) => X < x + 1 || X > x + w - 1 || Z < z + 1 || Z > z + h - 1 || Math.abs((X - x) * h - (Z - z) * w) / L < .7 || Math.abs((x + w - X) * h - (Z - z) * w) / L < .7, darkSteel);
  for (const xx of [x + 2, x + w - 3]) g.box(xx, p + 1, z + h, xx + 1, p + 3, z + h + 2, darkSteel);
}
function pallet(g, x, y, z, w, d) {
  for (const yy of [y, y + ix((d - 1) / 2), y + d - 1]) g.box(x, yy, z, x + w, yy + 1, z + 1, woodDark);
  for (let xx = x; xx < x + w; xx += 2) g.box(xx, y, z + 1, xx + 1, y + d, z + 2, PALLET);
}
function sacks(g, x, y, z, nx, ny, layers = 1) {
  for (let l = 0; l < layers; l++) for (let j = 0; j < ny - l; j++) for (let i = 0; i < nx - l; i++) g.ell(x + 3 + i * 6 + l * 3, y + 2.5 + j * 5 + l * 2.5, z + 1.6 + l * 3, 3.1, 2.6, 1.8, SACK);
}
function tyres(g, x, y, n) { for (let k = 0; k < n; k++) g.shape(x - 5, y - 5, k * 3, x + 5, y + 5, k * 3 + 3, (X, Y, Z) => { const d = Math.hypot(X - x, Y - y); return d <= 4.8 - (Z - k * 3 - 1.5) ** 2 * .2 && d >= 2.2; }, rubber); }
// Downpipe on a wall (pipe at x, y) from the gutter height to a shoe at the ground.
function downpipe(g, x, y, z, dy = 1) {
  g.box(x, y, 0, x + 1, y + 1, z, PIPE); g.box(x, dy > 0 ? y : y - 2, 0, x + 1, dy > 0 ? y + 3 : y + 1, 1, PIPE);
  for (let zz = 6; zz < z; zz += 10) g.box(x - 1, y, zz, x + 2, y + 1, zz + 1, darkSteel);
}
// Gable roof with the ridge along y (gable ends face front/back): thin shell + gable infill.
function gableRoofY(g, x0, x1, y0, y1, z0, h, m, wallM, wy0, wy1, inset, th = 3.4) {
  const c = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  g.shape(x0, y0, z0, x1, y1, z0 + h, (x, y, z) => { const lim = hw * (1 - (z - z0) / h), d = Math.abs(x - c); return d <= lim && d >= lim - th; }, m);
  if (wallM) g.shape(x0 + inset, wy0, z0, x1 - inset, wy1, z0 + h, (x, y, z) => Math.abs(x - c) <= hw * (1 - (z - z0) / h) - th + .5, wallM);
}
// Plate with stencil text on a south face (plane p): background box then letters.
function plateS(g, x, p, z, w, h, str, bg, fg, scale = 1) { g.box(x, p, z, x + w, p + 1, z + h, flat(bg)); g.text('s', x + 1, p, z + h - 2, str, fg, scale); }
const TURF = mat((x, y, z, f) => {
  const n = fbm(x * .22, y * .22, 8), h = hash(ix(x), ix(y), 2);
  if (f === 'u') return h < .0012 ? CR[3] : h > .9988 ? GD[3] : cl(GR, 3 + (n > .62 ? 1 : n < .36 ? -1 : 0));
  return cl(GR, 2 + (hash(ix(x), ix(z), 4) < .25 ? -1 : 0));
});

// ===== Large brick warehouse (14x9): pilastered brick shed under a rusty tin gable roof with
// skylights and ventilators, raised loading dock with rubber bumpers, three roller shutters
// (one open, one half open), stencil board, lamps, gutters, office stove chimney with smoke,
// yard with pallets, drums, sacks, tyres and crates.
def('bld_store_brick', 'World', [14, 9], 90, g => {
  const wall = weather(brick(BR, 2), 21, 0), pil = weather(brick(BR, 1), 22, 0), conc = concrete(CN, 3, 12);
  g.box(6, 10, 0, 218, 102, 1, conc);
  g.box(8, 12, 0, 216, 100, 46, wall);
  g.box(8, 12, 0, 216, 100, 3, concrete(CN, 2, 30));
  const PX = [8, 38, 68, 98, 128, 158, 188, 213];
  for (const x of PX) { g.box(x, 99, 0, x + 3, 101, 44, pil); g.box(x - 1, 99, 44, x + 4, 102, 46, concrete(CN, 4)); }
  const roof = rustRoof(tin(TN, 3, 'y', 24), 23);
  gableRoofX(g, 3, 221, 6, 106, 46, 30, roof, wall, 8, 216, 6);
  g.box(3, 106, 45, 221, 107, 46, PIPE); g.box(3, 5, 45, 221, 6, 46, PIPE);
  // Skylights on the front slope, ventilators on the ridge.
  for (const x of [20, 80, 140, 196]) g.topPaint(x, 76, x + 10, 92, () => glass);
  for (const x of [50, 112, 174]) { g.cylZ(x, 56, 3, 74, 80, flat(TN[3])); g.cone(x, 56, 5, 1, 80, 84, flat(TN[2])); }
  // Chimney of the office stove on the west end (smoke overlay).
  g.box(16, 30, 30, 22, 36, 80, weather(brick(BR, 1), 24, -1)); g.box(15, 29, 80, 23, 37, 82, concrete(CN, 4));
  // Loading dock, west steps, east ramp.
  g.box(30, 100, 0, 200, 114, 8, conc); g.box(30, 113, 7, 200, 114, 8, flat(ST[3]));
  for (let x = 36; x < 196; x += 20) g.box(x, 114, 1, x + 3, 116, 6, flat(RB[1]));
  g.box(22, 106, 0, 30, 114, 3, conc); g.box(26, 106, 3, 30, 114, 6, conc);
  g.shape(200, 100, 0, 216, 114, 8, (x, y, z) => z < 8 * (216 - x) / 16, conc);
  // Roller shutters with hoods and number plates; personnel door; windows.
  [[41, 0], [101, .72], [161, .35]].forEach(([x, open], i) => {
    rollerS(g, x, 99, 8, 24, 26, open);
    g.text('s', x + 11, 113, 6, String(i + 1), WH[4]);
    lamp(g, x - 3, 101, 33, 0, 1);
  });
  crate(g, 103, 92, 8, 8, 6, 7); crate(g, 112, 91, 8, 9, 7, 9); crate(g, 104, 92, 15, 6, 5, 5); drum(g, 121, 90, 8, 'RD');
  crate(g, 163, 92, 8, 9, 6, 6, AMMO, AMMO_E); crate(g, 173, 92, 8, 9, 6, 6, AMMO, AMMO_E);
  doorOn(g, 's', 79, 99, 8, 9, 18, { leaf: planks(OL, 2, 4), frame: flat(CR[1]) });
  plateS(g, 71, 99, 29, 25, 7, 'OFFICE', CR[2], TP[1]);
  for (const [x, w] of [[16, 14], [136, 14], [194, 14]]) windowOn(g, 's', x, 99, 22, w, 10, { frame: flat(CR[1]) });
  for (const y of [36, 64]) { windowOn(g, 'w', y, 8, 16, 12, 12, { frame: flat(CR[1]) }); windowOn(g, 'e', y, 215, 16, 12, 12, { frame: flat(CR[1]) }); }
  for (const x of [30, 82, 134, 186]) windowOn(g, 'n', x, 12, 20, 14, 10, { frame: flat(CR[1]) });
  doorOn(g, 'e', 80, 215, 0, 9, 18, { leaf: planks(OL, 2, 4), frame: flat(CR[1]) });
  g.text('w', 8, 46, 58, 'DEPOT', CR[3]); g.text('e', 215, 63, 58, 'NO 3', CR[3]);
  for (const x of [11, 211]) downpipe(g, x, 101, 45);
  for (const x of [11, 211]) { g.line(x, 101, 45, x, 106, 46, PIPE); downpipe(g, x, 11, 45, -1); g.line(x, 11, 45, x, 5, 46, PIPE); }
  // Yard clutter.
  pallet(g, 36, 120, 0, 18, 12); crate(g, 37, 121, 2, 8, 10, 8); crate(g, 45, 121, 2, 8, 10, 8); crate(g, 39, 122, 10, 10, 8, 6);
  pallet(g, 60, 122, 0, 18, 12); sacks(g, 60, 122, 2, 3, 2, 2);
  drum(g, 92, 122); drum(g, 100, 123); drum(g, 96, 130, 0, 'RD'); drum(g, 92, 122, 9); drumLying(g, 104, 132, 0, 'ST');
  tyres(g, 130, 128, 4); tyres(g, 141, 126, 2);
  crate(g, 176, 118, 0, 12, 10, 9, AMMO, AMMO_E); crate(g, 189, 119, 0, 10, 9, 8, AMMO, AMMO_E); crate(g, 179, 119, 9, 10, 8, 7, AMMO, AMMO_E);
  g.box(150, 120, 0, 152, 122, 26, woodPost); lamp(g, 151, 121, 26, -1, 0);
  tufts(g, 0, 0, 224, 12, 22, 31); tufts(g, 0, 12, 8, 120, 10, 32); tufts(g, 216, 12, 224, 120, 10, 33); tufts(g, 0, 116, 224, 144, 14, 34);
}, { frames: 4, fps: 6, overlay: smokeOverlay(19, 33, 82, 34) });

// ===== Quonset store (small and large): ribbed half-cylinder with a lip over the timber end
// wall, double doors, windows, vent louvre, sandbagged flanks, sign and clutter.
function quonset(g, W, D, r, opts) {
  const cx = W / 2, y0 = 4, y1 = D - 6, hull = rustRoof(tin(TN, 3, 'x', 16), opts.s);
  g.box(cx - r - 2, y0 - 2, 0, cx + r + 2, y1 + 4, 1, GRAVEL);
  g.vaultY(y0, y1 + 2, cx, r, 0, r, hull);
  for (let y = y0 + 8; y < y1; y += 16) g.vaultY(y, y + 1, cx, r + .5, 0, r + .5, flat(TN[2]));
  // Recessed end walls under a 2-voxel lip.
  const endWall = weather(planks(opts.endR || WD, 3, 3), opts.s, 0, DT);
  for (const [ya, yb, yw] of [[y1 - 1, y1 + 2, y1 - 1], [y0, y0 + 2, y0 + 1]]) {
    g.shape(cx - r, ya, 0, cx + r, yb, r, (x, y, z) => ((x - cx) / (r - 2)) ** 2 + (z / (r - 2)) ** 2 <= 1, null);
    g.shape(cx - r, yw, 0, cx + r, yw + 1, r, (x, y, z) => ((x - cx) / (r - 2)) ** 2 + (z / (r - 2)) ** 2 <= 1, endWall);
  }
  const p = y1 - 1, dw = opts.door, dh = opts.doorH;
  if (opts.sliding) {
    g.erase(cx - dw / 2, p, 0, cx + dw / 2, p + 1, dh); g.box(cx - dw / 2, p - 8, 0, cx + dw / 2, p - 7, dh, interior); g.erase(cx - dw / 2, p - 7, 0, cx + dw / 2, p, dh);
    g.box(cx - dw / 2, p - 8, 0, cx + dw / 2, p + 1, 1, FLOOR);
    leafS(g, cx - dw / 2 - dw / 2 + 2, p, 0, dw / 2, dh, planks(OL, 2, 4));
    leafS(g, cx + 6, p, 0, dw / 2, dh, planks(OL, 2, 4));
    g.box(cx - dw - 2, p + 1, dh, cx + dw / 2 + 8, p + 3, dh + 2, darkSteel);
    crate(g, cx - 6, p - 7, 0, 10, 6, 8); crate(g, cx - 4, p - 7, 8, 7, 5, 5);
  } else doorOn(g, 's', cx - dw / 2, p, 0, dw, dh, { leaf: planks(OL, 1, 4), frame: flat(CR[1]) });
  for (const s of opts.sliding ? [1] : [-1, 1]) windowOn(g, 's', cx + s * (dw / 2 + 6) - (s < 0 ? opts.win : 0), p, ix(dh * .45), opts.win, ix(dh * .35), { frame: flat(CR[1]) });
  // Louvre vent (when the arch is tall enough) and sign above the door.
  const lz = dh + 3, lw = 12, tall = lz + 15 < r - 3;
  if (tall) for (let z = lz; z < lz + 6; z += 2) g.box(cx - lw / 2, p + 1, z, cx + lw / 2, p + 2, z + 1, flat(OL[1]));
  plateS(g, cx - opts.sign.length * 2 - 1, p + 1, tall ? lz + 7 : dh + 2, opts.sign.length * 4 + 1, 7, opts.sign, CR[2], TP[1]);
  lamp(g, cx + dw / 2 + 2, p + 1, dh + 2, 0, 1);
  // Roof vents, sandbags along the flanks, rear door.
  for (const y of [y0 + 20, y1 - 20]) { const z = g.top(cx, y); g.cylZ(cx, y, 1.5, z, z + 6, darkSteel); g.cylZ(cx, y, 3, z + 6, z + 8, flat(TN[2])); }
  doorOn(g, 'n', cx - 4, y0 + 1, 0, 8, ix(dh * .8), { leaf: planks(OL, 1, 4), frame: flat(CR[1]) });
  for (const s of [-1, 1]) g.shape(cx - r - 4, y0 + 6, 0, cx + r + 4, y1 - 4, 6, (x, y, z) => { const d = Math.abs(x - cx) - r; return d > -2.5 + z * .4 && d < 3.5 - z * .4 && Math.sign(x - cx) === s && ((ix(y) % 48) < 30); }, SB);
}
def('bld_store_quonset_s', 'World', [4, 6], 34, g => {
  quonset(g, 64, 96, 26, { s: 41, door: 12, doorH: 14, win: 6, sign: 'Q2' });
  drum(g, 8, 92); drum(g, 15, 93, 0, 'RD'); crate(g, 46, 88, 0, 9, 7, 7); crate(g, 48, 89, 7, 6, 5, 5);
  tufts(g, 0, 0, 64, 96, 14, 42);
}, { margin: 6 });
def('bld_store_quonset_l', 'World', [7, 10], 58, g => {
  quonset(g, 112, 160, 50, { s: 43, door: 40, doorH: 32, win: 10, sign: 'STORES Q7', sliding: true, endR: CV });
  // Entrance vestibule on the east flank.
  const vx = 104;
  g.box(vx - 6, 70, 0, vx + 6, 86, 18, weather(planks(CV, 2, 3), 44, 0, DT)); g.gableY(68, 88, vx - 8, vx + 8, 18, 8, flat(TN[3]));
  doorOn(g, 'e', 74, vx + 5, 0, 8, 15, { leaf: planks(OL, 1, 4), frame: flat(CR[1]) });
  pallet(g, 6, 150, 0, 16, 10); sacks(g, 6, 150, 2, 3, 2, 2);
  drum(g, 94, 152); drum(g, 101, 150, 0, 'RD'); drum(g, 97, 150, 9);
  tufts(g, 0, 0, 112, 160, 20, 44);
}, { margin: 8 });

// ===== Steel-frame store (10x8): tin cladding on steel columns, gable end with a pair of big
// sliding doors on a top rail (one slid open on crates), clerestory, skylights, fire point.
def('bld_store_steel', 'World', [10, 8], 84, g => {
  const clad = weather(tin(TN, 3, 'y', 20), 51, 0), roof = rustRoof(tin(TN, 3, 'x', 20), 52);
  g.box(8, 8, 0, 152, 112, 1, FLOOR);
  g.box(10, 10, 0, 150, 108, 46, clad);
  g.box(10, 10, 0, 150, 108, 3, concrete(CN, 2, 30));
  gableRoofY(g, 5, 155, 5, 113, 46, 22, roof, clad, 10, 108, 5);
  g.box(5, 5, 45, 6, 113, 46, PIPE); g.box(154, 5, 45, 155, 113, 46, PIPE);
  for (let y = 10; y <= 108; y += 20) for (const x of [9, 150]) g.box(x, Math.min(y, 106), 0, x + 1, Math.min(y, 106) + 2, 46, flat(ST[1]));
  for (const x of [9, 149]) for (let y = 14; y < 104; y += 20) windowOn(g, x < 20 ? 'w' : 'e', y, x < 20 ? 10 : 149, 34, 12, 6, { frame: flat(ST[1]) });
  for (const y of [24, 60, 92]) g.topPaint(18, y, 40, y + 8, () => glass), g.topPaint(120, y, 142, y + 8, () => glass);
  // Opening with interior, two leaves on a rail (left slid open), personnel door, big number.
  const p = 107;
  g.erase(50, p - 14, 0, 110, p + 1, 40); g.box(50, p - 15, 0, 110, p - 14, 40, interior); g.box(50, p - 15, 0, 110, p + 1, 1, FLOOR);
  g.box(49, p, 0, 50, p + 1, 41, flat(ST[1])); g.box(110, p, 0, 111, p + 1, 41, flat(ST[1])); g.box(49, p, 40, 111, p + 1, 41, flat(ST[1]));
  const leafM = weather(tin(OL, 3, 'y', 30), 53, -1);
  leafS(g, 18, p, 0, 31, 40, leafM); leafS(g, 80, p, 0, 31, 40, leafM);
  g.box(14, p + 1, 40, 114, p + 3, 42, darkSteel);
  for (const x of [16, 112]) g.box(x, p + 1, 37, x + 1, p + 4, 43, darkSteel);
  crate(g, 54, p - 13, 1, 12, 10, 10); crate(g, 66, p - 13, 1, 10, 10, 14); crate(g, 55, p - 12, 11, 9, 8, 7); drum(g, 74, p - 4, 1, 'RD');
  doorOn(g, 's', 124, p, 0, 9, 18, { leaf: planks(OL, 1, 4), frame: flat(ST[1]) });
  g.text('s', 69, p, 61, 'B7', CR[3], 3);
  lamp(g, 128, p + 1, 22, 0, 1);
  g.box(136, p + 1, 4, 146, p + 2, 18, flat(RD[2])); g.cylY(141, 12, 3.5, p + 2, p + 4, flat(RD[3])); g.cylY(141, 12, 1.5, p + 4, p + 5, flat(ST[3]));
  for (const x of [15, 145]) downpipe(g, x, 108, 45);
  // Apron clutter.
  pallet(g, 116, 114, 0, 14, 10); crate(g, 117, 115, 2, 6, 8, 6); crate(g, 123, 115, 2, 6, 8, 8);
  tyres(g, 22, 120, 3); drum(g, 34, 118); drum(g, 41, 120, 0, 'ST');
  tufts(g, 0, 0, 160, 10, 16, 54); tufts(g, 0, 10, 10, 112, 8, 55); tufts(g, 150, 10, 160, 112, 8, 56); tufts(g, 0, 112, 160, 128, 8, 57);
});

// ===== Open-sided timber shed (8x5): posts with knee braces, mono-pitch tin roof, plank back
// wall, stacks of crates, tyres, drum rack, sacks.
def('bld_shed_open', 'World', [8, 5], 50, g => {
  const roof = rustRoof(weather(tin(TN, 3, 'y', 24), 61, -1), 62);
  g.box(2, 4, 0, 126, 76, 1, mottled(DT, 2, 5, .6, .3));
  g.box(4, 6, 0, 124, 9, 40, weather(planks(WD, 2, 3), 63, 0, DT));
  g.box(4, 6, 0, 7, 72, 34, weather(planks(WD, 2, 3), 64, 0, DT));
  const zAt = y => 40 - (y - 6) / 66 * 8;
  for (const x of [5, 34, 63, 92, 120]) for (const y of [7, 39, 71]) {
    const zt = zAt(y);
    g.box(x, y, 0, x + 2, y + 2, zt, woodPost); g.box(x - 1, y - 1, 0, x + 3, y + 3, 1, concrete(CN, 3));
    if (y > 7) { g.line(x + 1, y + 1, zt - 7, x + 1, y - 6, zt, woodDark); }
    if (x < 120) g.line(x + 2, y + 1, zt - 6, x + 8, y + 1, zt, woodDark);
  }
  for (const y of [7, 39, 71]) g.box(4, y, zAt(y), 124, y + 2, zAt(y) + 2, woodDark);
  g.shed(0, 2, 128, 78, 32, 9.5, 1, roof);
  g.box(0, 77, 31, 128, 78, 32, PIPE);
  // Contents: crates, tyres, drum rack, sacks, a cart wheel against the back wall.
  // (kept in the front half: the roof hides everything deeper than ~y 45 in the oblique view)
  crate(g, 10, 50, 1, 12, 10, 10); crate(g, 11, 60, 1, 10, 9, 8); crate(g, 12, 51, 11, 9, 8, 7);
  crate(g, 24, 52, 1, 10, 10, 12, AMMO, AMMO_E); crate(g, 25, 62, 1, 9, 8, 7, AMMO, AMMO_E);
  for (const [x, y] of [[44, 56], [55, 55], [49, 66]]) tyres(g, x, y, x === 49 ? 3 : 5);
  for (const x of [68, 88]) g.box(x, 46, 1, x + 2, 70, 4, woodDark);
  for (const y of [47, 55, 63]) drumLying(g, 70, y + 3, 4, y === 55 ? 'RD' : 'OL'), drumLying(g, 79, y + 3, 4, 'OL');
  pallet(g, 96, 52, 1, 20, 14); sacks(g, 96, 52, 3, 3, 2, 2);
  g.shape(100, 9, 2, 116, 11, 18, (x, y, z) => { const d = Math.hypot(x - 108, z - 10); return d <= 7.5 && (d >= 6.3 || d < 1.5 || Math.abs(x - 108) < .7 || Math.abs(z - 10) < .7); }, woodDark);
  crate(g, 20, 20, 1, 12, 10, 12); crate(g, 60, 14, 1, 14, 12, 14); drum(g, 22, 74); drum(g, 30, 75, 0, 'RD'); tyres(g, 118, 74, 2);
  tufts(g, 0, 0, 128, 6, 12, 65); tufts(g, 0, 72, 128, 80, 10, 66);
});

// ===== Cold store (6x5): thick whitewashed walls, parapet, insulated door with big latches,
// refrigeration plant with fan on the roof, pipes, chiller cabinet, loading step.
def('bld_store_cold', 'World', [6, 5], 56, g => {
  const plaster = weather(mottled(WH, 3, 71, .66, .14), 71, 0, DT);
  g.box(6, 8, 0, 90, 70, 1, FLOOR);
  g.box(8, 10, 0, 88, 64, 34, plaster); g.box(8, 10, 0, 88, 64, 3, concrete(CN, 2, 30));
  g.box(7, 9, 34, 89, 65, 37, flat(WH[2])); g.erase(9, 11, 35, 87, 63, 37); g.box(9, 11, 35, 87, 63, 36, tarpaper(TP, 3, 'x'));
  g.box(8, 63, 27, 88, 64, 33, flat(RD[1])); g.text('s', 29, 63, 32, 'COLD STORE', WH[4]);
  // Insulated door: padded leaf, strap hinges, latch handles, frame, rubber step.
  const p = 63;
  g.erase(36, p - 1, 2, 58, p + 1, 24);
  g.box(36, p - 1, 2, 58, p, 24, interior);
  g.box(37, p, 3, 57, p + 3, 23, mat((x, y, z) => (ix(x) % 5 === 0 || ix(z) % 5 === 0) ? CR[1] : CR[2]));
  for (const z of [6, 18]) g.box(37, p + 3, z, 47, p + 4, z + 2, darkSteel);
  for (const z of [9, 15]) { g.box(53, p + 3, z, 55, p + 5, z + 2, flat(ST[3])); g.box(54, p + 5, z - 3, 55, p + 6, z + 2, flat(ST[3])); }
  g.box(34, p, 2, 36, p + 2, 26, flat(ST[2])); g.box(58, p, 2, 60, p + 2, 26, flat(ST[2])); g.box(34, p, 24, 60, p + 2, 26, flat(ST[2]));
  g.box(32, p + 1, 0, 62, p + 7, 2, concrete(CN, 4)); g.box(32, p + 6, 1, 62, p + 7, 2, flat(RB[1]));
  lamp(g, 62, p + 1, 26, 0, 1);
  windowOn(g, 's', 16, p, 14, 8, 6, { frame: flat(WH[1]) });
  // Roof plant: compressor housing with louvres, fan shroud, pipes down the east wall.
  g.box(18, 18, 36, 46, 34, 46, weather(flat(OL[2]), 72, -1)); g.box(17, 17, 46, 47, 35, 47, flat(OL[1]));
  for (let x = 20; x < 44; x += 3) g.box(x, 34, 38, x + 1, 35, 44, darkSteel);
  g.cylZ(60, 26, 7, 36, 42, flat(ST[2])); g.shape(53, 19, 42, 67, 33, 43, (x, y) => { const d = Math.hypot(x - 60, y - 26); return d < 7 && (d > 6 || Math.abs(x - 60) < .6 || Math.abs(y - 26) < .6 || d < 1.5); }, darkSteel);
  g.line(46, 26, 40, 53, 26, 40, PIPE, .8); g.line(70, 40, 38, 89, 40, 38, PIPE, .8); g.line(89, 40, 38, 89, 40, 2, PIPE, .8); g.line(70, 46, 38, 90, 46, 38, PIPE, .8); g.line(90, 46, 38, 90, 46, 2, PIPE, .8);
  g.box(89, 30, 0, 95, 50, 14, weather(flat(ST[2]), 73, -1)); for (let y = 32; y < 48; y += 2) g.box(95, y, 3, 96, y + 1, 12, darkSteel);
  crate(g, 12, 66, 0, 10, 8, 7); crate(g, 13, 67, 7, 8, 6, 5);
  g.cylZ(70, 70, 2.5, 0, 4, flat(ST[3]));
  tufts(g, 0, 0, 96, 10, 10, 74); tufts(g, 0, 10, 8, 80, 6, 75); tufts(g, 0, 70, 96, 80, 8, 76);
});

// ===== Parts store (8x6): two-storey — brick ground floor, cream boarded upper floor, gable end
// to the front with a hoist beam, pulley, chain and a crate on the hook, hayloft doors, external
// stair on the east side, lean-to on the west.
def('bld_store_parts', 'World', [8, 6], 100, g => {
  const br = weather(brick(BR, 2), 81, 0), board = weather(planks(CR, 2, 3), 82, -1, DT), roof = rustRoof(tin(TN, 3, 'x', 16), 83);
  g.box(18, 8, 0, 102, 84, 1, FLOOR);
  g.box(22, 10, 0, 98, 80, 24, br); g.box(22, 10, 24, 98, 80, 52, board);
  g.box(21, 9, 23, 99, 81, 25, flat(WD[1]));
  gableRoofY(g, 17, 103, 5, 85, 52, 30, roof, board, 10, 80, 5);
  g.box(17, 5, 51, 18, 85, 52, PIPE); g.box(102, 5, 51, 103, 85, 52, PIPE);
  const p = 79;
  // Ground floor: big sliding door, windows.
  g.erase(46, p - 1, 0, 74, p + 1, 20); g.box(46, p - 1, 0, 74, p, 20, interior);
  leafS(g, 46, p, 0, 14, 20, planks(OL, 2, 4)); leafS(g, 30, p, 0, 14, 20, planks(OL, 2, 4)); g.box(28, p + 1, 20, 76, p + 3, 22, darkSteel);
  crate(g, 62, p + 2, 0, 9, 6, 8);
  windowOn(g, 's', 82, p, 8, 8, 8, { frame: flat(CR[1]) });
  plateS(g, 47, p + 1, 26, 27, 7, 'SPARES', CR[3], TP[1]);
  // Upper loading doors (open leaves), small balcony, windows.
  g.erase(52, p - 1, 34, 68, p + 1, 50); g.box(52, p - 1, 34, 68, p, 50, interior);
  for (const [x, s] of [[51, -1], [68, 1]]) g.box(x, p + 1, 34, x + 1, p + 9, 50, planks(OL, 2, 4)), g.box(x, p + 1, 34, x + 1, p + 2, 50, flat(OL[1]));
  g.box(50, p + 1, 33, 70, p + 6, 34, planks(WD, 3, 2)); for (const x of [51, 68]) g.line(x, p + 1, 26, x, p + 5, 33, woodDark);
  for (const x of [30, 82]) windowOn(g, 's', x, p, 36, 8, 9, { frame: flat(WD[1]) });
  windowOn(g, 's', 56, p, 60, 8, 6, { frame: flat(WD[1]) });
  // Hoist beam from the apex, pulley, chain, hook with a crate.
  g.box(58, 60, 72, 62, 96, 76, woodPost); g.line(58, p, 64, 58, 92, 74, woodDark); g.line(62, p, 64, 62, 92, 74, woodDark);
  g.cylX(93, 70, 2.8, 59, 61, flat(ST[2])); g.cylX(93, 70, 1, 58.5, 61.5, flat(ST[1]));
  g.line(60, 95.5, 70, 60, 95.5, 44, darkSteel); g.shape(58, 94, 40, 62, 97, 44, (x, y, z) => Math.abs(Math.hypot(x - 60, z - 42) - 1.5) < .6, flat(ST[3]));
  for (const dx of [-3, 3]) g.line(60, 95.5, 41, 60 + dx, 95.5, 37, rope);
  crate(g, 55, 92, 29, 11, 8, 8);
  // External stair on the east wall up to an upper door.
  for (let k = 0; k < 13; k++) g.box(99, 76 - k * 3.6, k * 2, 107, 80 - k * 3.6, k * 2 + 2, planks(WD, 3, 2));
  g.box(99, 20, 24, 107, 34, 26, planks(WD, 3, 2)); for (const y of [20, 33]) g.box(106, y, 0, 107, y + 1, 24, woodPost);
  g.line(107, 80, 6, 107, 33, 30, woodDark); g.line(106, 33, 30, 106, 20, 30, woodDark);
  for (const t of [.2, .5, .8]) g.line(107, 80 - t * 47, 6 + t * 24 - 6, 107, 80 - t * 47, 6 + t * 24, woodDark);
  doorOn(g, 'e', 23, 97, 26, 8, 18, { leaf: planks(OL, 2, 4), frame: flat(WD[1]) });
  windowOn(g, 'e', 46, 97, 8, 10, 8, { frame: flat(CR[1]) }); windowOn(g, 'w', 40, 22, 36, 10, 8, { frame: flat(WD[1]) });
  // Lean-to on the west.
  g.box(6, 30, 0, 22, 78, 20, weather(planks(WD, 2, 3), 84, 0, DT)); g.erase(7, 50, 0, 22, 78, 18);
  g.shape(2, 28, 18, 22, 80, 28, (x, y, z) => { const top = 18 + (x - 2) / 20 * 8; return z <= top && z >= top - 1.5; }, flat(TN[3]));
  for (const y of [50, 77]) g.box(6, y, 0, 8, y + 1, 18, woodPost);
  tyres(g, 14, 58, 4); drum(g, 14, 70, 0, 'RD'); drum(g, 14, 70, 9);
  tufts(g, 0, 0, 128, 10, 12, 85); tufts(g, 0, 80, 128, 96, 10, 86); tufts(g, 108, 10, 128, 80, 6, 87);
});

// ===== Tank farm (10x8): bund wall with stiles, two big vertical tanks with spiral stairs and
// roof railings, pipe rack to a pump house, fire monitor, foam drums, warning board.
def('bld_tank_farm', 'World', [10, 8], 76, g => {
  const conc = weather(concrete(CN, 3, 14), 91, 0, DT);
  g.box(4, 4, 0, 156, 124, 1, mottled(CN, 3, 95, .64, .3));
  g.shape(2, 2, 0, 158, 126, 8, (x, y, z) => Math.min(x - 2, y - 2, 158 - x, 126 - y) < 3, conc);
  g.box(2, 2, 8, 158, 126, 9, concrete(CN, 4)); g.erase(5, 5, 8, 155, 123, 9);
  // Stile over the front wall.
  for (let k = 0; k < 3; k++) { g.box(70, 120 - k * 3, 0, 84, 123 - k * 3, 9 - k * 2, planks(WD, 3, 2)); g.box(70, 126 + k * 3, 0, 84, 129 + k * 3, 9 - k * 2, planks(WD, 3, 2)); }
  for (const x of [70, 83]) g.line(x, 114, 13, x, 134, 13, darkSteel), g.line(x, 124, 9, x, 124, 13, darkSteel);
  const tA = weather(mottled(ST, 3, 92, .7, .1), 93, -1), tB = weather(mottled(OL, 3, 94, .7, .12), 95, -1);
  for (const [cx, cy, r, h, m, a0, a1, txt] of [[46, 50, 24, 42, tA, 2.2, -1.2, 'AVGAS'], [114, 44, 19, 36, tB, .9, -2.2, 'MT 80']]) {
    g.cylZ(cx, cy, r + 2, 0, 3, concrete(CN, 4));
    g.cylZ(cx, cy, r, 3, h, m);
    for (let z = 12; z < h; z += 10) g.cylZ(cx, cy, r + .3, z, z + 1, flat(ST[2]));
    g.cone(cx, cy, r + .6, 2, h, h + 7, flat(ST[2]));
    g.shape(cx - r - 1, cy - r - 1, h, cx + r + 1, cy + r + 1, h + 5, (x, y, z) => { const d = Math.hypot(x - cx, y - cy); return d > r - 1 && d <= r && (z > h + 4 || Math.round(Math.atan2(y - cy, x - cx) * r / 3) % 2 === 0); }, darkSteel);
    spiralStair(g, cx, cy, r + .4, r + 3.5, a0, a1, 3, h, planks(WD, 3, 2), darkSteel);
    g.surfText('s', cx - 9, h - 10, txt, RD[2]);
    g.cylZ(cx + 6, cy - 4, 1, h + 4, h + 10, darkSteel); g.box(cx + 4, cy - 6, h + 10, cx + 9, cy - 1, h + 11, darkSteel);
  }
  g.surfText('s', 41, 22, '100', CR[3]);
  // Pipe rack to the pump house.
  for (const x of [30, 60, 90, 120]) { g.box(x, 86, 0, x + 2, 88, 10, darkSteel); g.box(x - 2, 86, 10, x + 4, 88, 11, darkSteel); }
  for (const [dz, c] of [[11.5, PIPE], [13.5, flat(OL[2])]]) g.line(24, 87, dz, 140, 87, dz, c, .9);
  g.line(46, 74, 4, 46, 87, 11.5, PIPE, .9); g.line(114, 63, 4, 114, 87, 13.5, flat(OL[2]), .9);
  for (const x of [52, 104]) { g.box(x, 88, 11, x + 1, 90, 16, PIPE); g.cylY(x + .5, 16, 2, 90, 91, redPaint); }
  g.box(16, 92, 0, 40, 114, 16, weather(brick(BR, 2), 96, 0)); g.gableY(90, 116, 14, 42, 16, 8, rustRoof(tin(TN, 3, 'y', 12), 97));
  doorOn(g, 's', 24, 113, 0, 8, 13, { leaf: planks(OL, 2, 4), frame: flat(CR[1]) }); g.line(24, 87, 11.5, 24, 92, 8, PIPE, .9);
  windowOn(g, 'e', 98, 39, 6, 8, 5, { frame: flat(CR[1]) });
  // Fire monitor, foam drums, board, lamp.
  g.cylZ(138, 104, 2, 0, 10, redPaint); g.line(138, 104, 10, 141, 108, 13, redPaint, 1); g.cylZ(138, 104, 3, 1, 3, flat(RD[1]));
  drum(g, 124, 110, 0, 'RD'); drum(g, 131, 112, 0, 'RD'); drum(g, 124, 110, 9, 'RD');
  for (const x of [96, 118]) g.box(x, 127, 0, x + 1, 128, 18, woodPost);
  g.box(93, 128, 8, 124, 129, 19, flat(RD[2])); g.box(94, 128, 9, 123, 129, 18, flat(WH[4]));
  g.text('s', 97, 128, 17, 'DANGER', RD[2]); g.text('s', 95, 128, 11, 'NO FIRE', RD[2]);
  g.box(150, 120, 0, 152, 122, 28, woodPost); lamp(g, 151, 121, 28, -1, 0);
  tufts(g, 6, 6, 154, 122, 14, 98); tufts(g, 0, 0, 160, 3, 8, 99, true);
}, { margin: 8 });

// ===== Horizontal fuel tank (6x3): big rusty cylinder on saddles, ladder to a railed top
// walkway, manhole, vents, dispenser stand with hose, drip tray.
def('bld_tank_horizontal', 'World', [6, 3], 40, g => {
  const tank = weather(mottled(ST, 3, 101, .7, .1), 102, -1);
  g.box(4, 4, 0, 92, 46, 1, GRAVEL);
  for (const x of [16, 44, 72]) g.box(x, 13, 0, x + 6, 35, 8, concrete(CN, 3));
  g.cylX(24, 16, 12, 10, 86, tank); g.ell(10, 24, 16, 3, 12, 12, tank); g.ell(86, 24, 16, 3, 12, 12, tank);
  for (const x of [28, 48, 68]) g.cylX(24, 16, 12.3, x, x + 1, flat(ST[2]));
  g.box(26, 22, 28, 74, 27, 29, planks(WD, 3, 2));
  railing(g, 26, 22, 74, 27, 29, 5, darkSteel, 6, 'sn');
  g.cylZ(40, 24, 3, 27, 30, flat(ST[2])); g.box(38, 22, 30, 43, 26, 31, flat(ST[3]));
  for (const x of [58, 64]) { g.cylZ(x, 24, .8, 27, 33, darkSteel); g.box(x - 1, 23, 33, x + 2, 26, 34, darkSteel); }
  for (const x of [22, 26]) g.box(x, 36, 0, x + 1, 37, 29, darkSteel);
  for (let z = 3; z < 29; z += 3) g.box(22, 36, z, 27, 37, z + 1, darkSteel);
  g.surfText('s', 36, 22, 'AVGAS', RD[2]); g.surfText('s', 37, 15, 'NO 2', CR[3]);
  // Dispenser and hose.
  g.box(78, 38, 0, 84, 43, 14, weather(flat(RD[2]), 103, -1)); g.box(77, 37, 14, 85, 44, 15, flat(ST[1])); g.box(79, 43, 7, 83, 44, 11, glass);
  g.line(86, 24, 6, 86, 40, 4, PIPE, .8); g.line(84, 40, 10, 88, 44, 2, flat(RB[1]));
  g.shape(86, 40, 0, 94, 47, 2, (x, y) => Math.abs(Math.hypot(x - 90, y - 43.5) - 2.5) < .9, flat(RB[1]));
  g.box(30, 37, 0, 70, 44, 1, flat(ST[1])); g.box(30, 37, 1, 70, 38, 2, flat(ST[2]));
  drum(g, 8, 40, 0, 'RD'); g.box(0, 6, 0, 6, 40, 6, SB);
  tufts(g, 0, 0, 96, 48, 10, 104);
});

// ===== Earth-covered magazine A (6x5): long low turf mound with two concrete portals (A / B),
// steel shutters, earth traverses between them, vents, sandbag blast walls.
def('bld_bunker_mag_a', 'World', [6, 5], 40, g => {
  const conc = weather(concrete(CN, 3, 12), 111, 0, DT);
  g.shape(0, 0, 0, 96, 80, 26, (x, y, z) => {
    const dx = Math.max(0, Math.abs(x - 48) - 30), dy = Math.max(0, Math.abs(y - 30) - 18);
    return z < 22 - (dx * dx + dy * dy) * .045 + (fbm(x * .2, y * .2, 112) - .5) * 2.5;
  }, TURF);
  for (const [x, lbl] of [[18, 'A'], [58, 'B']]) {
    // Approach cut through the mound with sloping concrete retaining walls.
    g.erase(x, 64, 0, x + 20, 80, 30); g.box(x, 64, 0, x + 20, 80, 1, FLOOR);
    for (const wx of [x - 1, x + 20]) g.shape(wx, 64, 0, wx + 2, 80, 22, (X, Y, Z) => Z < 22 - (Y - 64) * 1.4, conc);
    g.box(x, 54, 0, x + 20, 64, 22, conc); g.box(x - 2, 53, 22, x + 22, 65, 24, concrete(CN, 4));
    g.erase(x + 4, 62, 0, x + 16, 64, 12);
    g.box(x + 4, 62, 0, x + 16, 63, 12, ROLL); g.box(x + 3, 63, 12, x + 17, 65, 14, flat(TN[2]));
    g.box(x + 6, 63, 15, x + 14, 64, 21, redPaint); g.text('s', x + 9, 63, 20, lbl, WH[4]);
    lamp(g, x + 2, 64, 19, 0, 1);
  }
  for (const x of [30, 68]) { const z = g.top(x, 28); g.cylZ(x, 28, 1.5, z - 2, z + 5, darkSteel); g.cylZ(x, 28, 3, z + 5, z + 7, flat(ST[2])); }
  g.line(48, 18, g.top(48, 18), 48, 18, 36, flat(ST[3])); g.line(48, 18, 35, 92, 30, 0, flat(ST[3]));
  for (const [x, y, s] of [[14, 20, 1], [82, 18, 2], [48, 40, 3]]) g.ell(x, y, g.top(x, y), 3.5, 3, 2.5, leaf(2 + (s & 1), s + 110));
  tufts(g, 0, 0, 96, 60, 16, 113, true); tufts(g, 0, 66, 96, 80, 6, 114);
});

// ===== Earth-covered magazine B (5x5): igloo — turfed barrel vault behind an arched concrete
// headwall with a riveted steel door, lightning mast, gravel apron and a shell trolley.
def('bld_bunker_mag_b', 'World', [5, 5], 46, g => {
  const conc = weather(concrete(CN, 3, 12), 121, 0, DT);
  g.vaultY(4, 60, 40, 30, 0, 30, conc);
  g.shape(0, 0, 0, 80, 62, 40, (x, y, z) => { const ex = (x - 40) / 38, ey = Math.max(0, 8 - y) / 8; return ex * ex + (z / 36) ** 2 + ey * ey <= 1 && y < 58 - Math.max(0, z - 20) * .2; }, TURF);
  // Arched headwall, wing walls, door.
  g.shape(6, 56, 0, 74, 64, 34, (x, y, z) => ((x - 40) / 32) ** 2 + (z / 33) ** 2 <= 1, conc);
  g.shape(5, 55, 0, 75, 65, 35, (x, y, z) => { const e = ((x - 40) / 33) ** 2 + (z / 34) ** 2; return e <= 1 && e > .87 && y < 58 + 3; }, concrete(CN, 4));
  for (const s of [-1, 1]) g.shape(40 + s * 30 - 10, 58, 0, 40 + s * 30 + 10, 64, 14, (x, y, z) => z < 14 - Math.abs(x - (40 + s * 26)) * 1.1 && Math.abs(x - 40) > 26, conc);
  const door = mat((x, y, z) => (ix(x) % 6 === 0 || ix(z) % 6 === 0) ? OL[1] : (ix(x) % 6 === 3 && ix(z) % 6 === 3 ? OL[3] : OL[2]));
  doorOn(g, 's', 32, 63, 0, 16, 20, { leaf: door, frame: flat(CN[4]), depth: 2, knob: false });
  g.box(39.5, 61, 0, 40.5, 62, 20, flat(OL[0]));
  g.box(30, 63, 22, 50, 64, 28, redPaint); g.text('s', 31, 63, 27, 'MAG B', WH[4]);
  lamp(g, 40, 64, 30, 0, 1);
  g.box(26, 64, 0, 54, 80, 1, GRAVEL);
  // Shell trolley, lightning mast, vents, bushes.
  g.box(30, 68, 3, 42, 76, 5, planks(WD, 2, 2, 'y')); for (const x of [31, 41]) for (const y of [69.5, 74.5]) g.cylX(y, 2.5, 2, x - .5, x + 1.5, flat(ST[1]));
  for (let k = 0; k < 4; k++) g.cylY(32.5 + k * 2.5, 6.5, 1.1, 68.5, 75.5, flat(GD[2]));
  g.line(40, 20, g.top(40, 20), 40, 20, 45, flat(ST[3])); g.line(40, 20, 44, 72, 6, 0, flat(ST[3]));
  for (const x of [26, 54]) { const z = g.top(x, 30); g.cylZ(x, 30, 1.5, z - 2, z + 5, darkSteel); g.cylZ(x, 30, 3, z + 5, z + 7, flat(ST[2])); }
  for (const [x, y, s] of [[10, 30, 1], [70, 26, 2], [20, 52, 3], [62, 50, 4]]) g.ell(x, y, g.top(x, y), 3.5, 3, 2.5, leaf(2 + (s & 1), s + 120));
  for (const x of [8, 60]) g.box(x, 66, 0, x + 12, 72, 7, SB);
  tufts(g, 0, 0, 80, 56, 14, 122, true); tufts(g, 0, 64, 80, 80, 6, 123);
}, { margin: 6 });

// ===== Lumber store (8x5): low gable-roofed rack shed full of sawn planks, log pile with bark and
// end-grain rings, sawhorse with a bucksaw, sawdust heap.
def('bld_store_lumber', 'World', [8, 5], 48, g => {
  const roof = rustRoof(weather(tin(TN, 3, 'x', 20), 131, -1), 132);
  g.box(2, 2, 0, 126, 78, 1, mottled(DT, 2, 133, .6, .3));
  for (const x of [6, 34, 62, 90, 118]) for (const y of [8, 46]) { g.box(x, y, 0, x + 2, y + 2, 30, woodPost); g.box(x - 1, y - 1, 0, x + 3, y + 3, 1, concrete(CN, 3)); }
  for (const y of [8, 46]) g.box(6, y, 30, 120, y + 2, 32, woodDark);
  gableRoofX(g, 2, 124, 2, 54, 32, 12, roof, null);
  g.box(6, 7, 0, 120, 8, 30, weather(planks(WD, 2, 3), 134, 0, DT));
  // Racks of sawn planks: board ends show as light end grain at the front.
  const plank = mat((x, y, z, f) => f === 's' || f === 'n' ? cl(WD, 4 - (((ix(z) % 2) + 2) % 2)) : cl(WD, 3 - (((ix(z) % 2) + 2) % 2) - (hash(ix(x / 12), ix(z), 135) < .2 ? 1 : 0)));
  for (const [x0, x1, h] of [[9, 32, 22], [37, 60, 16], [65, 88, 26], [93, 116, 12]]) {
    for (let z = 1; z < h; z += 5) { g.box(x0, 12, z, x1, 44, z + 4, plank); g.box(x0, 18, z + 4, x1, 20, z + 5, woodDark); g.box(x0, 36, z + 4, x1, 38, z + 5, woodDark); }
    g.box(x0 - 1, 12, 0, x0, 44, 1, woodDark);
  }
  // Log pile with bark and ring ends.
  const bark = mat((x, y, z, f) => f === 's' || f === 'n' ? (Math.round(Math.hypot((x % 9) - 4.5, z % 9 - 4.5)) % 2 ? WD[4] : WD[3]) : cl(DT, 1 + (hash(ix(x / 2), ix(z), 136) < .4 ? 1 : 0)));
  const logs = [[14, 62, 4.5], [24, 62, 4.5], [34, 62, 4.5], [19, 62, 12], [29, 62, 12], [24, 62, 19.5]];
  for (const [x, y, z] of logs) g.cylY(x, z, 4.5, 52, 76, mat((X, Y, Z, f) => f === 's' || f === 'n' ? (Math.round(Math.hypot(X - x, Z - z)) % 2 ? WD[4] : WD[3]) : bark.fn(X, Y, Z, f)));
  for (const y of [55, 72]) for (const x of [9, 39]) g.box(x, y, 0, x + 1, y + 1, 8, woodDark);
  // Sawhorse with a log and a bucksaw, sawdust heap.
  for (const x of [72, 90]) { g.line(x, 60, 0, x, 64, 10, woodDark); g.line(x, 68, 0, x, 64, 10, woodDark); }
  g.cylX(64, 12, 2.5, 68, 96, bark);
  g.box(80, 63, 15, 81, 65, 22, woodPost); g.box(80, 63, 22, 92, 65, 23, woodPost); g.line(80, 64, 15, 92, 64, 15, flat(ST[3]));
  g.ell(102, 66, 0, 9, 7, 3.5, mottled(SN, 3, 137, .6, .4));
  tufts(g, 0, 0, 128, 8, 10, 138); tufts(g, 0, 70, 128, 80, 10, 139);
});

// ===== Camouflaged dump (8x8): garnished scrim net on poles draped over stacked stores, holes
// show crates and drums underneath; ropes to pegs at the edges.
def('bld_store_camo', 'World', [8, 8], 36, g => {
  g.box(4, 4, 0, 124, 124, 1, mottled(DT, 2, 141, .6, .3));
  // Stores under the net.
  for (const [x, y] of [[18, 20], [40, 22], [20, 46], [44, 48]]) { pallet(g, x, y, 1, 18, 16); crate(g, x + 1, y + 1, 3, 8, 14, 14, AMMO, AMMO_E); crate(g, x + 9, y + 1, 3, 8, 14, 10, AMMO, AMMO_E); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) drum(g, 76 + i * 8, 22 + j * 8, 1, (i + j) % 3 ? 'OL' : 'RD');
  for (let i = 0; i < 3; i++) drum(g, 80 + i * 8, 26, 10);
  pallet(g, 72, 60, 1, 24, 18); sacks(g, 72, 60, 3, 4, 3, 2);
  crate(g, 22, 76, 1, 30, 20, 17); g.text('s', 26, 95, 9, 'ENG', CR[3]);
  crate(g, 70, 84, 1, 14, 12, 9); crate(g, 86, 84, 1, 14, 12, 9);
  for (let i = 0; i < 4; i++) drum(g, 34 + i * 8, 106, 1, i === 2 ? 'RD' : 'OL');
  crate(g, 80, 100, 1, 12, 10, 8); crate(g, 93, 102, 1, 10, 9, 6);
  // Net height field: tall poles lift the middle, the back and sides fall to pegs, the front
  // hangs from short poles so the stacked stores show underneath.
  const poles = [[34, 34, 22], [92, 34, 22], [62, 70, 26], [24, 112, 14], [62, 116, 14], [100, 112, 14]];
  const hNet = (x, y) => {
    let h = 0; for (const [px, py, pk] of poles) h = Math.max(h, pk - Math.hypot(x - px, y - py) * .7);
    const e = Math.min(x - 4, 124 - x, y - 4);
    return Math.min(h + (fbm(x * .1, y * .1, 142) - .5) * 2, 1 + e * .9);
  };
  const net = mat((x, y, z, f) => { const n = fbm(x * .12, y * .12, 143), k = hash(ix(x / 2), ix(y / 2), 144); return n > .62 ? cl(GR, 2 + (k < .4 ? 1 : 0)) : n > .45 ? cl(OL, 2 + (k < .3 ? 1 : 0)) : n > .32 ? cl(DT, 2 + (k < .3 ? 1 : 0)) : cl(CV, 2); });
  // The net drapes over the stacks (column tops dilated by 2), so their outlines read through it.
  const tops = new Int16Array(128 * 128), lump = new Int16Array(128 * 128).fill(-1);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) tops[y * 128 + x] = g.top(x, y) + 1;
  for (let y = 2; y < 126; y++) for (let x = 2; x < 126; x++) { let m = -1; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m = Math.max(m, tops[(y + dy) * 128 + x + dx] - (Math.abs(dx) + Math.abs(dy) > 2 ? 1 : 0)); if (m > 2) lump[y * 128 + x] = m; }
  for (let y = 4; y < 124; y++) for (let x = 4; x < 124; x++) {
    if (hash(x, y, 145) < .07 || (fbm(x * .3, y * .3, 146) < .3 && hash(x, y, 147) < .5)) continue;
    const z = Math.max(ix(hNet(x + .5, y + .5)), lump[y * 128 + x]); if (z < 0) continue;
    g.box(x, y, z, x + 1, y + 1, z + 1, net);
    if (hash(x, y, 148) < .22) g.set(x, y, z + 1, net);
  }
  for (const [px, py] of poles) g.box(px, py, 0, px + 1, py + 1, ix(hNet(px, py)) + 2, woodPost);
  for (const [x, y] of [[0, 0], [62, 0], [126, 0], [0, 64], [126, 64], [10, 126], [114, 126]]) {
    const cx = Math.min(122, Math.max(6, x)), cy = Math.min(122, Math.max(6, y));
    g.line(cx, cy, 3, x, y, 0, rope); g.box(x, y, 0, x + 1, y + 1, 2, woodDark);
  }
  tufts(g, 0, 0, 128, 128, 14, 149);
}, { margin: 8 });

// ===== Small timber shed A (2x2): boarded shed with a rusty tin gable roof, ledged-and-braced
// door, small window, water butt, spade.
def('bld_shed_small_a', 'World', [2, 2], 36, g => {
  const wall = weather(planks(WD, 2, 3), 151, 0, DT);
  g.box(3, 4, 0, 29, 26, 18, wall);
  gableRoofX(g, 1, 31, 2, 29, 18, 11, rustRoof(tin(TN, 3, 'y', 12), 152), wall, 3, 29, 2);
  doorOn(g, 's', 7, 25, 0, 8, 15, { leaf: planks(OL, 2, 4), frame: flat(WD[1]) });
  g.line(8, 25, 2, 14, 25, 13, flat(OL[1])); g.box(7, 25, 3, 15, 26, 4, flat(OL[1])); g.box(7, 25, 11, 15, 26, 12, flat(OL[1]));
  windowOn(g, 's', 19, 25, 8, 6, 5, { frame: flat(CR[1]) });
  g.cylZ(27, 28, 3, 0, 8, mat((x, y, z, f) => f === 'u' ? GL[1] : ix(z) % 4 === 0 ? ST[1] : WD[2]));
  g.line(1, 24, 0, 1, 25, 14, woodPost); g.box(0, 24, 0, 3, 26, 3, darkSteel);
  tufts(g, 0, 0, 32, 32, 6, 153);
}, { margin: 4 });

// ===== Small timber shed B (3x2): lean-to store with a half-open front showing drums and tools,
// mono-pitch roof, jerrycans, firewood.
def('bld_shed_small_b', 'World', [3, 2], 36, g => {
  const wall = weather(planks(OL, 2, 3), 161, 0, DT);
  g.box(3, 3, 0, 45, 6, 24, wall); g.box(3, 3, 0, 6, 27, 22, wall); g.box(42, 3, 0, 45, 27, 22, wall);
  g.box(6, 3, 0, 24, 27, 18, wall); g.erase(7, 6, 0, 23, 26, 17);
  doorOn(g, 's', 11, 26, 0, 8, 15, { leaf: planks(OL, 1, 4), frame: flat(OL[1]) });
  g.box(4, 6, 0, 44, 26, 1, FLOOR);
  g.shed(1, 1, 47, 30, 18, 7, 1, rustRoof(weather(tin(TN, 3, 'y', 12), 162, -1), 163));
  for (const x of [24, 43]) g.box(x, 25, 0, x + 1, 26, 19, woodPost);
  drum(g, 30, 11, 1, 'RD'); drum(g, 37, 11, 1); drum(g, 33, 18, 1, 'ST');
  for (const x of [27, 29, 31]) g.box(x, 6, 4, x + 1, 7, 18, x === 29 ? flat(ST[3]) : woodPost);
  for (const x of [26, 31]) g.box(x, 27, 0, x + 4, 29, 6, flat(OL[3]));
  for (let k = 0; k < 3; k++) g.cylY(40 - k * 3.5, 1.8 + (k === 1 ? 2.8 : 0), 1.8, 27, 31, flat(WD[2]));
  tufts(g, 0, 0, 48, 32, 6, 164);
}, { margin: 4 });

// ===== Drum dump (5x4): rows of fuel drums on dunnage, stacked and lying, jerrycan stack, drum
// hand pump, sandbag wall at the back, POL board.
def('bld_depot_drums', 'World', [5, 4], 32, g => {
  g.box(2, 2, 0, 78, 62, 1, GRAVEL);
  for (const y of [10, 18, 26, 34]) g.box(6, y, 1, 54, y + 1, 2, woodDark);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
    const k = hash(i, j, 171) < .25 ? 'RD' : hash(i, j, 172) < .2 ? 'ST' : 'OL';
    drum(g, 10 + i * 8, 10 + j * 8, 2, k);
    if (j < 2 && i < 4 && hash(i, j, 173) < .6) drum(g, 10 + i * 8, 10 + j * 8, 11, k);
  }
  for (let k = 0; k < 3; k++) drumLying(g, 58, 12 + k * 7.5, 1, k === 1 ? 'RD' : 'OL');
  drumLying(g, 61, 16, 8);
  for (const x of [58, 65]) g.box(x, 8, 0, x + 1, 36, 1, woodDark);
  // Jerrycan stack, pump on a drum, board.
  for (let i = 0; i < 4; i++) for (let l = 0; l < 2; l++) g.box(8 + i * 5, 46 + l, l * 7, 12 + i * 5, 52 + l, l * 7 + 7, flat(OL[3 - l]));
  drum(g, 44, 50, 1, 'RD'); g.cylZ(44, 50, .8, 10, 18, darkSteel); g.line(44, 50, 17, 49, 50, 17, darkSteel); g.line(42, 50, 15, 36, 54, 1, flat(RB[1]));
  g.box(2, 0, 0, 78, 5, 8, SB);
  for (const x of [56, 72]) g.box(x, 52, 0, x + 1, 53, 18, woodPost);
  g.box(54, 53, 9, 75, 54, 19, flat(GD[2])); g.text('s', 56, 53, 17, 'POL', TP[1]); g.text('s', 56, 53, 11, 'DUMP', TP[1]);
  tufts(g, 0, 0, 80, 64, 10, 174);
});

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

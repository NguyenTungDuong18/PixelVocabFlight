'use strict';
// World models: workshop — the young engineer's tools, maintenance gear and inventions (prop_*).
// Library models (not placed on a map yet). Front of every recipe faces +y.
const { PAL, ramp, hash, fbm, withAlpha } = require('../lib.cjs');
const { mat, FONT3 } = require('../voxel.cjs');
const { OL, CR, GD, ST, GL, RD, WD, NV, FI, SM, IC } = PAL;
const {
  CN, TP, RB, CV, cl, uv, ix, flat, glow, mottled, planks, concrete, olive, steel, darkSteel,
  rubber, woodDark, woodPost, rope, def, stripes, wheelX, smokeOverlay
} = require('./common.cjs');

// ---------------- Local ramps (unique hexes so shading never collides with other ramps) ----------------
const CU = ramp('#4a2413', '#7a3e1d', '#a8602d', '#d18b4b', '#f1ba7a');            // copper wire / brass-red
const BP = ramp('#152f4e', '#20477a', '#2e61a1', '#5d8ec9', '#c9ddf1');            // blueprint paper
const CB = ramp('#17221c', '#223128', '#2e4135', '#3e5546');                       // chalkboard slate
const MG = ramp('#28332f', '#3a4843', '#51635c', '#6f847b', '#95a9a0', '#c0cec6'); // machinery grey-green
const OX = ramp('#173322', '#22492f', '#306340', '#47825a', '#6aa57b');            // oxygen bottle green
const MS = ramp('#3d2d1c', '#5a4228', '#7a5c38', '#9a7a4e', '#b99a68');            // masonite pegboard

// ---------------- Local helpers ----------------
const chrome = flat(ST[4]);
const tyre = rubber;
const red = (i = 2) => flat(RD[i]);
const chalk = { c: CR[3], flat: true };
// Small caster: dark wheel with a steel fork.
function caster(g, x, y, z = 0) { g.box(x, y, z, x + 2, y + 2, z + 2, flat(RB[1])); g.box(x, y + .5, z + 2, x + 2, y + 1.5, z + 3, darkSteel); }
// Material with horizontal seams on the front ('s') face: drawer fronts on chests and cabinets.
function drawersMat(R, i, seams, x0 = -99, x1 = 99) {
  return mat((x, y, z, f) => {
    if (f === 's' && x >= x0 && x < x1 && seams.some(s => ix(z) === s)) return cl(R, i - 2);
    if (f === 's' && (ix(x) === x0 || ix(x) === x1 - 1)) return cl(R, i - 1);
    return cl(R, i);
  });
}
// Drawer pulls: chrome bars one voxel proud of the front plane y.
function pulls(g, x0, x1, y, zs, w = 4) { const c = (x0 + x1) / 2; for (const z of zs) g.box(c - w / 2, y, z, c + w / 2, y + 1, z + 1, chrome); }
// Text with a few extra glyphs (= and ^) for chalk formulas; rows -> bitmap on a face.
const GLYPH = { ...FONT3, '=': '000111000111000', '^': '010101000000000', '(': '010100100100010', ')': '010001001001010', '*': '000101010101000' };
function glyphRows(str) {
  const rows = ['', '', '', '', ''];
  for (const ch of str) { const gl = GLYPH[ch] || GLYPH[' ']; for (let r = 0; r < 5; r++) rows[r] += gl.slice(r * 3, r * 3 + 3).replace(/0/g, ' ').replace(/1/g, '#') + ' '; }
  return rows.map(r => r.slice(0, -1));
}
// Pegboard: masonite with a 2 px hole grid on the front.
const pegboard = mat((x, y, z, f) => (f === 's' || f === 'n') && (ix(x) & 1) === 0 && (ix(z) & 1) === 0 ? MS[0] : MS[3]);
// Bench top: clean planks along x (seam every 3 px), lighter edge.
const benchTop = mat((x, y, z, f) => f === 'u' ? (ix(y) % 3 === 0 ? WD[2] : WD[3]) : WD[2]);
// Overlay spark burst (welding, grinding): short bright streaks falling from a point.
function sparkOverlay(px, py, pz, n = 9, seed = 1) {
  return (c, project, f) => {
    const [sx, sy] = project(px, py, pz);
    for (let k = 0; k < n; k++) {
      const life = ((k * 7 + f * 3 + seed) % 6) / 6, a = hash(k, seed, 3) * Math.PI * 2, sp = 2 + hash(k, seed, 5) * 5;
      const x = sx + .5 + Math.cos(a) * sp * life * 1.4, y = sy + Math.sin(a) * sp * life * .8 - 3 * life + 7 * life * life;
      const col = life < .3 ? FI[4] : life < .65 ? FI[3] : FI[2];
      c.put(x, y, col);
      if (life < .5) c.put(x - Math.cos(a), y - Math.sin(a) * .6, withAlpha(FI[3], 170));
    }
    c.put(sx, sy, PAL.WHITE); c.put(sx + 1, sy, FI[4]); c.put(sx, sy - 1, FI[4]);
  };
}
const canvasRoll = mat((x, y, z, f) => cl(CV, 1 + ((ix(x) & 1) ? 0 : -1)));

// ======================= Benches =======================

// Shared workbench body: thick plank top, four legs, lower shelf, a drawer bank on the right.
function benchBase(g, { top = benchTop, drawers = true } = {}) {
  g.box(1, 4, 10, 31, 15, 12, top);
  g.box(1, 14.5, 10, 31, 15.5, 12, flat(WD[1]));
  for (const [x, y] of [[2, 5], [28, 5], [2, 12], [28, 12]]) g.box(x, y, 0, x + 2, y + 2, 10, woodPost);
  g.box(2, 5, 3, 30, 14, 4, planks(WD, 2, 3, 'x'));
  if (drawers) {
    g.box(18, 6, 6, 30, 14, 10, drawersMat(WD, 3, [8], 18, 30));
    g.box(23.6, 13, 6, 24.4, 14, 10, flat(WD[1]));
    pulls(g, 18, 24, 14, [7, 9], 2); pulls(g, 24, 30, 14, [7, 9], 2);
  }
}

def('prop_bench_work', 'World', [2, 1], 30, g => {
  benchBase(g);
  // Pegboard with a wooden frame and a small top shelf.
  g.box(1, 2, 12, 31, 4, 28, pegboard);
  g.box(1, 2, 27, 31, 4, 28, woodDark); g.box(0, 2, 12, 1, 4, 28, woodDark); g.box(31, 2, 12, 32, 4, 28, woodDark);
  g.box(1, 4, 24, 12, 6, 25, woodDark);
  for (const [x, R] of [[2, GD], [4.5, RD], [7, OL], [9.5, CR]]) g.cylZ(x + .5, 5, 1, 25, 27, flat(R[2]));
  // Hanging tools (one voxel in front of the board).
  const y = 4;
  g.line(3, y, 14, 3, y, 21, flat(WD[3])); g.box(1.5, y, 21, 5.5, y + 1, 23, steel);                 // hammer
  for (const [x, z1] of [[7, 20], [8.6, 21], [10.2, 22]]) { g.line(x, y, 15, x, y, z1, chrome); g.box(x - .6, y, z1, x + 1.4, y + 1, z1 + 1, chrome); }
  g.shape(13, y, 15, 21, y + 1, 21, (x, yy, z) => z - 15 < (x - 13) * .7 + 1.5, flat(ST[3]));  // handsaw blade
  g.box(20, y, 17, 23, y + 1, 21, flat(WD[2])); g.set(21, y, 18, flat(WD[0])); g.set(21, y, 19, flat(WD[0]));
  for (const [x, R] of [[25, RD], [26.6, GD], [28.2, OL]]) { g.line(x, y, 15, x, y, 18, chrome); g.box(x - .3, y, 18, x + .7, y + 1, 21, flat(R[3])); }
  for (let a = 0; a < Math.PI * 2; a += .2) g.set(19 + Math.cos(a) * 2.5, y, 24.5 + Math.sin(a) * 2, flat(CU[3])); // coil of wire
  // Bench vice at the front left: jaws, screw and T-handle.
  g.box(3, 10, 12, 9, 14, 13, flat(MG[2])); g.box(4, 10.5, 13, 8, 14, 16, flat(MG[3]));
  g.box(3.5, 13.5, 13, 8.5, 14.5, 17, flat(MG[2])); g.box(3.5, 11, 15, 8.5, 12, 17, flat(MG[2]));
  g.line(6, 14.5, 14.5, 6, 18, 14.5, chrome); g.line(4, 18, 14.5, 8, 18, 14.5, chrome);
  g.box(5, 12, 16, 7, 13.5, 18, flat(CU[2]));                                                   // part in the jaws
  // Bench clutter: oil can, carburettor body, tap-and-die case, rag.
  g.cylZ(12.5, 8, 1.6, 12, 16, flat(GD[2])); g.line(12.5, 8, 16, 14.5, 9.5, 17.5, flat(GD[1]));
  g.box(15, 8, 12, 19, 11, 15, flat(ST[2])); g.cylZ(17, 9.5, 1.3, 15, 17, flat(ST[3])); g.box(14, 9, 13, 15, 10, 14, flat(ST[1]));
  g.box(21, 9, 12, 28, 13, 13, flat(WD[3])); for (let x = 22; x < 27; x += 1.5) g.set(x, 11, 13, chrome); g.box(21, 8, 12, 28, 9, 15, flat(WD[2]));
  g.box(10, 11, 12, 14, 14, 12.6, flat(CR[1])); g.set(11, 12, 12.6, flat(CR[2]));
  // Shelf below: a box and a can.
  g.box(4, 7, 4, 10, 12, 8, flat(OL[2])); g.cylZ(13, 9, 1.8, 4, 8, flat(RD[2]));
}, { margin: 6 });

def('prop_bench_work_electric', 'World', [2, 1], 30, (g, ctx) => {
  benchBase(g);
  // Small-parts cabinet on the back edge: grid of tiny drawers.
  g.box(1, 2, 12, 13, 5, 26, mat((x, y, z, f) => f === 's' && (ix(x) % 3 === 1 || ix(z) % 3 === 0) ? MG[1] : MG[3]));
  for (let x = 2.5; x < 13; x += 3) for (let z = 13; z < 26; z += 3) g.set(x, 5, z + 1, chrome);
  // Shelf with copper spools.
  g.box(13, 2, 20, 31, 5, 21, woodDark); g.box(13, 2, 12, 14, 5, 20, woodDark); g.box(30, 2, 12, 31, 5, 20, woodDark);
  for (const [x, i] of [[16, 3], [21, 2], [26, 3]]) { g.cylX(3.5, 23.5, 2.3, x, x + 3, flat(CU[i])); g.cylX(3.5, 23.5, 2.8, x - .6, x, woodDark); g.cylX(3.5, 23.5, 2.8, x + 3, x + 3.6, woodDark); }
  // Radio chassis with glowing valves.
  g.box(3, 7, 12, 12, 13, 14, flat(ST[3]));
  for (const [x, yy] of [[5, 9], [7.5, 9], [10, 9], [6, 11.5]]) { g.cylZ(x, yy, .9, 14, 17, glow(GL[1])); g.set(x, yy, 15, glow(FI[ctx.frame % 2 ? 3 : 2])); g.set(x, yy, 17, flat(ST[1])); }
  g.box(9, 11, 14, 11.5, 12.5, 15.5, flat(CU[3]));
  // Voltmeter with a cream dial.
  g.box(14, 8, 12, 20, 12, 18, flat(WD[1])); g.box(14.5, 12, 13, 19.5, 12.5, 17, flat(CR[3]));
  g.set(17, 12.5, 15, flat(RD[2])); g.set(16, 12.5, 16, flat(TP[1]));
  for (const x of [15.5, 18.5]) g.set(x, 12, 12.5, flat(x < 17 ? RD[3] : TP[1]));
  // Soldering iron on its stand with a wire running to the meter.
  g.box(22, 10, 12, 26, 13, 13, darkSteel); g.line(22.5, 11.5, 13, 26.5, 11.5, 15, chrome); g.line(26.5, 11.5, 15, 28.5, 11.5, 16, flat(WD[3]));
  g.line(22, 11.5, 13, 20, 10, 12.5, flat(RD[2]));
  g.line(20, 13.6, 12, 27, 13.6, 12, flat(RD[2]));
  // Lower shelf: coil of cable and a battery.
  for (let a = 0; a < Math.PI * 2; a += .15) for (const r of [2.2, 3]) g.set(8 + Math.cos(a) * r, 9.5 + Math.sin(a) * r, 4, flat(TP[3]));
  g.box(12, 7, 4, 17, 11, 8, flat(TP[2])); g.set(13, 8, 8, flat(RD[3])); g.set(16, 8, 8, flat(ST[3]));
}, { frames: 2, fps: 3, animated: true, margin: 6 });

// Scale model aeroplane, nose toward +y, wings along x. biplane = trainer with an upper wing.
function modelPlane(g, cx, cy, z, { body, wing, prop = red(2), span = 7, len = 6, biplane = false }) {
  g.cylY(cx, z + 1, 1.3, cy - len, cy + len - 1, body);
  g.box(cx - span, cy, z, cx + span + 1, cy + 3, z + 1, wing);
  if (biplane) { g.box(cx - span + 1, cy + 1, z + 3.5, cx + span, cy + 4, z + 4.5, wing); for (const x of [cx - span + 2, cx + span - 2]) g.box(x, cy + 2, z + 1, x + 1, cy + 3, z + 3.5, flat(WD[1])); }
  g.box(cx - 3, cy - len, z + 1, cx + 4, cy - len + 2, z + 2, wing);
  g.box(cx, cy - len, z + 1, cx + 1, cy - len + 2, z + 4, wing);
  g.box(cx, cy - 1, z + 2, cx + 1, cy + 1, z + 3, glow(GL[2]));
  g.box(cx - 2, cy + len - 1, z + 1, cx + 3, cy + len, z + 2, prop); g.set(cx, cy + len - 1, z + 1, flat(ST[1]));
}
def('prop_bench_work_models', 'World', [2, 1], 30, g => {
  benchBase(g);
  // Plan sheet on the bench top with a small olive fighter model resting on it.
  g.box(3, 5, 12, 15, 11, 12.4, mat((x, y) => (ix(x) % 4 === 0 || ix(y) % 3 === 0) ? BP[3] : BP[2], { flat: true }));
  modelPlane(g, 9, 6.5, 12.4, { body: flat(ST[3]), wing: flat(ST[4]), prop: flat(TP[1]), span: 5, len: 4 });
  g.set(9, 8, 14.5, flat(CR[3]));
  // Yellow trainer biplane on a display stand: blue fuselage, yellow wings, red prop.
  g.box(19, 7, 12, 25, 11, 13, woodDark); g.line(22, 9, 13, 22, 9, 17, chrome);
  modelPlane(g, 22, 8, 17, { body: flat(NV[3]), wing: flat(GD[3]), biplane: true, span: 6, len: 6 });
  // Balsa sheets, wing ribs, glue pot and hobby knife.
  g.box(3, 12, 12, 9, 14.5, 12.6, flat(CR[2]));
  for (let x = 10; x < 16; x += 2) g.shape(x, 11.5, 12, x + 1, 14.5, 14, (xx, yy, z) => Math.abs(yy - 13) < 1.6 - (z - 12) * .5, flat(CR[3]));
  g.cylZ(28, 12, 1.4, 12, 14.5, flat(WD[1])); g.cylZ(28, 12, .9, 14.5, 15, flat(GD[3]));
  g.line(23, 13.5, 12, 26, 12.5, 12, chrome); g.line(26, 12.5, 12, 27, 12.2, 12, flat(WD[3]));
}, { margin: 6 });

// ======================= Tool chests and carts =======================

function toolChest(g, R, i, open) {
  for (const [x, y] of [[2, 5], [12, 5], [2, 11], [12, 11]]) caster(g, x, y);
  g.box(2, 5, 3, 14, 13, 13, drawersMat(R, i, [6, 9, 11], 2, 14));
  g.box(2, 5, 12.6, 14, 13, 13.3, flat(R[i - 1]));
  // Top chest with its own small drawers and a lid.
  g.box(2.5, 6, 13.3, 13.5, 12, 19, drawersMat(R, i, [15, 17], 2.5, 13.5));
  if (!open) {
    pulls(g, 2, 14, 13, [4, 7, 10]); pulls(g, 2.5, 13.5, 12, [14, 16, 18]);
    g.box(2.2, 5.8, 19, 13.8, 12.2, 20, flat(R[i + 1])); g.box(5, 8.5, 20, 11, 9.5, 21, chrome);
  } else {
    pulls(g, 2, 14, 13, [4, 10]); pulls(g, 2.5, 13.5, 12, [14, 18]);
    // Middle drawer pulled out, tools inside.
    g.box(2.5, 9, 6.5, 13.5, 17, 9, flat(R[i]));
    g.box(3.5, 9, 8, 12.5, 16, 9, flat(ST[1]));
    g.line(4.5, 10.5, 8, 11.5, 10.5, 8, chrome); g.line(4.5, 12.5, 8, 10, 12.5, 8, chrome); g.line(5, 14.5, 8, 9, 14.5, 8, flat(RD[3])); g.line(9, 14.5, 8, 12, 14.5, 8, chrome);
    g.box(5, 16.6, 7, 11, 17.4, 8, chrome);
    // Lid raised on its back hinge, tray of sockets visible.
    g.box(2.2, 5, 19, 13.8, 6, 26, flat(R[i + 1])); g.box(5, 4.4, 22, 11, 5, 23, chrome);
    g.box(3, 6.5, 18.6, 13, 11.5, 19, flat(ST[1]));
    for (let x = 4; x < 12.5; x += 1.6) g.set(x, 8, 19, chrome);
    g.line(4, 10, 19, 12, 10, 19, flat(GD[2]));
  }
  // Side handles.
  g.box(14, 8, 9, 15, 10, 10, chrome); g.box(1, 8, 9, 2, 10, 10, chrome);
}
def('prop_tool_chest_red', 'World', [1, 1], 22, g => { toolChest(g, RD, 2, false); g.text('s', 3, 13, 12, 'USAAF', RD[0]); }, { margin: 4 });
def('prop_tool_chest_olive_open', 'World', [1, 1], 28, g => { toolChest(g, OL, 3, true); }, { margin: 5 });

def('prop_cart_tools', 'World', [1, 1], 18, g => {
  for (const [x, y] of [[2, 4], [12, 4], [2, 11], [12, 11]]) { caster(g, x, y); g.box(x, y, 2, x + 2, y + 2, 12, flat(ST[2])); }
  const tray = (z, R, i) => { g.box(2, 4, z, 14, 13, z + 1, flat(R[i])); for (const [a, b, c, d] of [[2, 4, 14, 5], [2, 12, 14, 13], [2, 4, 3, 13], [13, 4, 14, 13]]) g.box(a, b, z + 1, c, d, z + 2, flat(R[i - 1])); };
  tray(4, RD, 2); tray(11, RD, 3);
  g.line(14, 5, 13, 16.5, 5, 15, chrome); g.line(14, 12, 13, 16.5, 12, 15, chrome); g.line(16.5, 5, 15, 16.5, 12, 15, chrome);
  // Top: wrenches, screwdriver, rag; bottom: oil can and a parts box.
  for (const yy of [6, 7.5, 9]) g.line(4, yy, 12, 10 - (yy - 6), yy, 12, chrome);
  g.line(4, 11, 12, 8, 11, 12, chrome); g.line(8, 11, 12, 10, 11, 12, flat(RD[3]));
  g.ell(11.5, 7, 12.5, 1.6, 1.4, .8, flat(CR[1]));
  g.cylZ(5, 8, 1.6, 5, 9, flat(GD[2])); g.line(5, 8, 9, 6.5, 7, 10.5, flat(GD[1]));
  g.box(8, 6, 5, 12.5, 11, 8, flat(OL[2]));
}, { margin: 5 });

def('prop_tool_box_set', 'World', [1, 1], 12, g => {
  // Canvas tool roll laid open with spanners in their pockets.
  g.box(1, 9, 0, 15, 15, 1, canvasRoll);
  for (let k = 0; k < 6; k++) { const x = 2.5 + k * 2; g.line(x, 10, 1, x, 13 - (k % 2), 1, chrome); g.set(x - .5, 10, 1, chrome); g.set(x + .5, 10, 1, chrome); }
  g.cylX(14.5, 1.2, 1.2, 1, 15, canvasRoll);
  // Cantilever tool box, open, red.
  g.box(2, 2, 0, 12, 7, 5, flat(RD[2])); g.box(2.5, 2.5, 4, 11.5, 6.5, 5, flat(RD[0]));
  g.box(1, 1.5, 5, 6.5, 4.5, 6, flat(RD[3])); g.box(7.5, 1.5, 5, 13, 4.5, 6, flat(RD[3]));
  for (const x of [2, 4, 9, 11]) g.set(x, 3, 6, chrome);
  g.box(6, 4, 5, 8, 5, 8, chrome); g.box(6.5, 4, 8, 7.5, 5, 9, chrome);
}, { margin: 4 });

// ======================= Engines and propellers =======================

// Cooling fins: alternate shades with the distance from an axis point (radial cylinders).
const finsAround = (cx, cz, R, a, b) => mat((x, y, z) => cl(R, (ix(Math.hypot(x - cx, z - cz) * 1.4) & 1) ? a : b));

def('prop_engine_radial', 'World', [2, 1], 30, g => {
  const cx = 11, cy = 8, cz = 14;
  // Stand: grey-green rails on casters, two posts holding the rear mount ring.
  const frame = flat(MG[3]);
  g.box(3, 4, 1.5, 20, 6, 3, frame); g.box(3, 11, 1.5, 20, 13, 3, frame); g.box(3, 4, 1.5, 5, 13, 3, frame); g.box(18, 4, 1.5, 20, 13, 3, frame);
  for (const [x, y] of [[3, 4], [18, 4], [3, 11], [18, 11]]) caster(g, x, y, -1.5);
  for (const x of [6, 15]) { g.box(x, 3, 3, x + 2, 5, cz - 2, frame); g.line(x + 1, 5, 3, x + 1, 3.5, cz - 4, frame); }
  for (let a = 0; a < Math.PI * 2; a += .08) g.set(cx + Math.cos(a) * 5.5, cy - 4, cz + Math.sin(a) * 5.5, flat(MG[2]));
  g.box(6, 3, cz - 3, 17, 5, cz - 1, frame);
  // Exhaust collector ring behind, crankcase, nose case, prop shaft.
  for (let a = 0; a < Math.PI * 2; a += .05) for (const d of [0, .7]) g.set(cx + Math.cos(a) * (5.4 + d), cy - 2.5, cz + Math.sin(a) * (5.4 + d), flat(RD[0]));
  g.cylY(cx, cz, 4.4, cy - 3, cy + 3, flat(ST[2]));
  g.cyl(cx, cy + 3, cz, cx, cy + 6, cz, 3, flat(ST[3]));
  g.cylY(cx, cz, 1.9, cy + 6, cy + 7, flat(ST[2])); g.cylY(cx, cz, 1, cy + 7, cy + 9.5, chrome);
  // Seven finned cylinders: dark steel barrels, silver heads with rocker boxes and pushrods.
  for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + k * Math.PI * 2 / 7, ca = Math.cos(a), sa = Math.sin(a);
    g.cyl(cx + ca * 3.8, cy, cz + sa * 3.8, cx + ca * 7, cy, cz + sa * 7, 1.6, finsAround(cx, cz, ST, 1, 2));
    g.cyl(cx + ca * 7, cy, cz + sa * 7, cx + ca * 9.8, cy, cz + sa * 9.8, 1.9, finsAround(cx, cz, ST, 3, 4));
    g.ell(cx + ca * 8.6, cy + 1.7, cz + sa * 8.6, 1.1, 1, 1.1, flat(ST[4]));
    g.line(cx + ca * 3.8, cy + 2.6, cz + sa * 3.8, cx + ca * 8.1, cy + 1.9, cz + sa * 8.1, flat(ST[1]));
  }
  // Brass ignition harness ring and the nose data plate.
  for (let a = 0; a < Math.PI * 2; a += .05) g.set(cx + Math.cos(a) * 4.8, cy + 3, cz + Math.sin(a) * 4.8, flat(GD[2]));
  // Side: a pulled cylinder on a crate, spark plugs and a drip pan.
  g.box(22, 4, 0, 30, 11, 6, planks(WD, 3, 3, 'x')); g.box(22, 4, 5.5, 30, 11, 6.2, flat(WD[2]));
  g.cylX(7.5, 8.5, 2, 23, 27, finsAround(0, 8.5, ST, 1, 2)); g.cylX(7.5, 8.5, 2.2, 27, 29.5, finsAround(0, 8.5, ST, 3, 4));
  for (let x = 23; x < 30; x += 1.5) g.set(x, 10, 6.2, flat(CR[3]));
  g.box(21, 12, 0, 30, 15, .6, flat(TP[2])); g.box(23, 13, .6, 25, 14, 1, flat(TP[0]));
}, { margin: 6 });

def('prop_engine_v12', 'World', [2, 1], 24, g => {
  const cy = 8, black = flat(TP[2]), case_ = flat(ST[3]);
  // Stand: two yellow A-frames on a base, cradle bars.
  const stand = flat(GD[2]);
  g.box(3, 2, 0, 29, 3.5, 1.5, stand); g.box(3, 12.5, 0, 29, 14, 1.5, stand);
  for (const x of [6, 23]) { g.line(x, 2.7, 1, x, cy - 2, 8, stand, .8); g.line(x, 13.3, 1, x, cy + 2, 8, stand, .8); g.box(x - 1, 4, 7, x + 1, 12, 8.5, stand); }
  // Crankcase and sump, cylinder banks in a 60 degree V, valve covers.
  g.cylX(cy, 9.5, 3.2, 5, 27, case_); g.cylX(cy, 8.2, 2.2, 8, 24, flat(ST[2]));
  g.shape(5, 2, 10, 26, 14, 18, (x, y, z) => { const d = Math.abs(y - cy), o = (z - 10) * .55 + 1.3; return d >= o - 1 && d <= o + 2.4; }, finsAround(-1e3, 0, ST, 2, 2));
  for (const s of [-1, 1]) {
    g.cylX(cy + s * (.55 * 8 + 2.3), 18.2, 1.6, 5.5, 25.5, black);
    for (let x = 7; x < 25; x += 3) g.set(x, cy + s * (.55 * 8 + 2.3), 19.5, flat(ST[3]));
    // Six short exhaust stubs per bank.
    for (let k = 0; k < 6; k++) { const x = 6.5 + k * 3.2; g.box(x, s < 0 ? 1 : cy + 6.5, 13, x + 1.6, s < 0 ? 2.5 : cy + 8, 15, flat(RD[1])); g.set(x + .5, s < 0 ? 0.6 : cy + 8.2, 14, flat(RD[0])); }
  }
  g.box(5, cy - 1, 10, 26, cy + 1, 13, flat(ST[2]));
  // Front reduction gearbox and prop shaft (+x), supercharger and carburettor at the back.
  g.cylX(cy, 11, 3.8, 26, 29, case_); g.cylX(cy, 11, 1, 29, 31.5, chrome);
  g.cylX(cy, 10, 3.4, 2, 5, flat(ST[2])); g.box(2.5, cy - 1.5, 13, 4.5, cy + 1.5, 16, flat(ST[1]));
  g.line(4, cy, 12, 7, cy, 16, flat(ST[1]), .7);
  g.text('s', 9, cy + 3.5, 11, 'V-1710', TP[1]);
}, { margin: 6 });

def('prop_prop_stand', 'World', [2, 1], 42, g => {
  const hx = 16, hy = 7, hz = 22;
  // Heavy wooden cradle with a steel post and shaft.
  g.box(8, 1, 0, 24, 6, 2, planks(WD, 2, 3, 'x')); g.box(14, -1, 0, 18, 10, 2, planks(WD, 3, 3, 'y'));
  g.box(14.5, 2, 2, 17.5, 5, hz - 1, flat(MG[3]));
  g.line(10, 3.5, 2, 15, 3.5, 12, flat(MG[2]), .6); g.line(22, 3.5, 2, 17, 3.5, 12, flat(MG[2]), .6);
  g.cylY(hx, hz, 1.3, 4, hy, chrome);
  // Three-blade propeller: black blades, yellow tips, steel hub and spinner.
  const blade = (x, y, z) => {
    const dx = x - hx, dz = z - hz;
    for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189]) {
      const r = dx * Math.cos(a) + dz * Math.sin(a), t = Math.abs(-dx * Math.sin(a) + dz * Math.cos(a));
      if (r < 2.5 || r > 18) continue;
      const w = 1 + 1.7 * Math.sin(Math.PI * Math.min(1, (r - 2.5) / 16.5) * .85) - (r > 16.5 ? (r - 16.5) * .7 : 0);
      if (t <= w) return r > 15.5 ? flat(GD[3]) : flat(TP[r > 14 || t > w - .7 ? 2 : 1]);
    }
    return false;
  };
  g.shape(hx - 18, hy - .5, hz - 18, hx + 18, hy + 1.5, hz + 18, blade);
  g.cylY(hx, hz, 3.2, hy - 1, hy + 2, flat(ST[3]));
  g.ell(hx, hy + 2, hz, 2.6, 2.2, 2.6, flat(ST[4]));
  // Tag hanging from the hub: inspection card.
  g.box(hx + 3, hy + 1.6, hz - 7, hx + 6, hy + 2.2, hz - 3, flat(CR[3])); g.line(hx + 2, hy + 1.8, hz - 2, hx + 4, hy + 1.8, hz - 3, rope);
}, { margin: 8 });

// ======================= Lifting gear =======================

def('prop_hoist_gantry', 'World', [2, 1], 48, g => {
  const yel = flat(GD[2]), dark = flat(GD[1]);
  for (const x of [2, 29]) {
    g.box(x - 1, 0, 1.5, x + 2, 16, 3, dark);
    caster(g, x - 1, 0, -1.5); caster(g, x - 1, 14, -1.5);
    g.line(x + .5, 1, 3, x + .5, 7.5, 41, yel, .9); g.line(x + .5, 15, 3, x + .5, 8.5, 41, yel, .9);
    g.box(x - .2, 4, 14, x + 1.2, 12, 15.4, yel);
  }
  // I-beam with a rolling trolley and a chain block.
  g.box(0, 6.5, 41, 32, 9.5, 42, yel); g.box(0, 7.5, 42, 32, 8.5, 44, dark); g.box(0, 6.5, 44, 32, 9.5, 45, yel);
  g.box(13, 6, 39, 19, 10, 41, flat(ST[1]));
  g.box(14, 6.5, 32, 18, 9.5, 38, flat(RD[2])); g.cylX(8, 35, 2.4, 13.4, 14.2, flat(RD[1]));
  g.line(16, 8, 39, 16, 8, 38, darkSteel);
  // Load chain (alternating links) and a dangling hand chain.
  for (let z = 14; z < 32; z++) g.set(16, 8, z, flat(ST[(z & 1) ? 4 : 2]));
  for (let z = 10; z < 34; z++) { g.set(13, 7.5, z, flat(ST[(z & 1) ? 3 : 1])); g.set(13, 9, z + 1, flat(ST[(z & 1) ? 1 : 3])); }
  // Hook.
  g.box(15, 7, 12, 17.5, 9, 14.5, flat(ST[3]));
  for (let a = 0; a < Math.PI * 1.4; a += .12) g.set(16.2 + Math.sin(a) * 2, 8, 10 - Math.cos(a) * 2.3 + .3, flat(ST[3]));
  g.set(17.6, 8, 8, flat(ST[4]));
}, { margin: 6 });

def('prop_hoist_crane', 'World', [2, 1], 34, g => {
  const paint = flat(RD[2]), dark = flat(RD[1]);
  // Base legs along x with casters, mast at the back (west) end.
  g.box(2, 3, 1.5, 30, 5, 3, dark); g.box(2, 11, 1.5, 30, 13, 3, dark); g.box(2, 3, 1.5, 6, 13, 3, dark);
  for (const [x, y] of [[2, 3], [28, 3], [2, 11], [28, 11]]) caster(g, x, y, -1.5);
  g.box(3, 6.5, 3, 6, 9.5, 25, paint); g.box(2.5, 6, 3, 6.5, 10, 5, dark);
  g.line(1, 8, 20, -1, 8, 22, chrome);
  // Boom on a pivot, hydraulic ram underneath (red barrel, chrome rod, pump handle).
  g.cyl(4.5, 8, 23, 27, 8, 29, 1.3, paint); g.cylY(4.5, 23, 1.6, 6, 10, flat(ST[2]));
  g.cyl(5, 8, 7, 10, 8, 17, 1.4, dark); g.cyl(10, 8, 17, 14.5, 8, 25.5, .8, chrome);
  g.line(5, 8, 9, 2, 10, 15, chrome);
  // Chain and hook at the boom tip, a strap sling.
  g.box(25.5, 7, 26.5, 28, 9, 28.5, flat(ST[2]));
  for (let z = 13; z < 27; z++) g.set(26.5, 8, z, flat(ST[(z & 1) ? 4 : 2]));
  for (let a = 0; a < Math.PI * 1.4; a += .12) g.set(26.8 + Math.sin(a) * 1.8, 8, 11 - Math.cos(a) * 2, flat(ST[3]));
  g.text('s', 7.5, 13, 2.5, '1T', TP[0]);
}, { margin: 6 });

// ======================= Welding, air and power =======================

def('prop_welder_cart', 'World', [2, 1], 30, (g, ctx) => {
  // Two-wheel bottle cart: green oxygen, red acetylene, regulators with cream gauges.
  g.box(2, 5, 1, 13, 12, 2, darkSteel);
  wheelX(g, 0, 7, 2.8, 2.8, .5, 2); wheelX(g, 0, 7, 2.8, 2.8, 13, 14.5);
  for (const x of [2, 12]) g.box(x, 4, 2, x + 1, 5, 24, flat(ST[2]));
  g.box(2, 4, 14, 13, 5, 15, flat(ST[2])); g.box(2, 4, 23, 13, 5, 24, flat(ST[2]));
  g.line(2.5, 4.5, 24, 2.5, 2, 27, chrome); g.line(12.5, 4.5, 24, 12.5, 2, 27, chrome); g.line(2.5, 2, 27, 12.5, 2, 27, chrome);
  const bottle = (x, r, h, R, i) => { g.cylZ(x, 8, r, 2, h, flat(R[i])); g.ell(x, 8, h, r, r, 1.6, flat(R[i])); g.cylZ(x, 8, .9, h, h + 2.5, flat(ST[3])); g.box(x - 1.5, 8.5, h + 1, x + 1.5, 10, h + 3, flat(GD[2])); g.box(x - 1, 10, h + 1.5, x + 1, 10.5, h + 2.5, flat(CR[3])); };
  bottle(5.5, 2.4, 22, OX, 2); bottle(10, 2.6, 18, RD, 2);
  g.box(3, 10, 12, 8, 10.6, 13, flat(CR[3]));
  // Hoses across the floor to the welding table.
  const hose = (pts, m) => { for (let k = 0; k < pts.length - 1; k++) g.line(...pts[k], ...pts[k + 1], m); };
  hose([[5.5, 10, 24], [6, 12, 14], [9, 14, .5], [16, 14, .5], [19, 12, 6], [22, 10, 10.5]], flat(OX[3]));
  hose([[10, 10, 20], [11, 13, 10], [13, 15, .5], [17, 15, .5], [20, 13, 6], [22.5, 10.5, 10.5]], flat(RD[3]));
  // Steel welding table, a plate on the jig, goggles and the torch pointing at the seam.
  g.box(17, 4, 9, 31, 13, 10, flat(ST[2])); for (const [x, y] of [[17, 4], [30, 4], [17, 12], [30, 12]]) g.box(x, y, 0, x + 1, y + 1, 9, darkSteel);
  g.box(18, 5, 10, 28, 11, 11, flat(ST[3])); g.box(23, 5, 10, 24, 11, 11.4, flat(ST[1]));
  g.box(28.5, 6, 10, 30.5, 9, 13, darkSteel);
  g.line(22, 10.2, 10.6, 26.5, 12.5, 13, flat(GD[2])); g.set(22, 10, 11, flat(GD[1]));
  g.box(26, 11.8, 12.5, 28, 13, 14, flat(GD[1]));
  g.box(28, 10, 10, 30, 12, 11, flat(GL[1])); g.set(29, 11, 11, flat(TP[1]));
  // Bright weld pool flickers.
  g.set(23.5, 9, 11, glow(ctx.frame % 2 ? PAL.WHITE : FI[4]));
}, { frames: 6, fps: 12, animated: true, margin: 8, overlay: sparkOverlay(23.5, 9, 11.5, 11, 3) });

def('prop_compressor', 'World', [2, 1], 20, g => {
  // Air receiver tank on skids, wheel at one end and a handle at the other.
  const tank = flat(OL[3]);
  for (const x of [6, 22]) g.box(x, 4, 0, x + 2, 12, 2.5, darkSteel);
  g.cylX(8, 6.5, 4.5, 4, 27, tank); g.ell(4, 8, 6.5, 2, 4.5, 4.5, tank); g.ell(27, 8, 6.5, 2, 4.5, 4.5, tank);
  wheelX(g, 0, 8, 3, 3, 27.5, 30);
  g.line(1, 5, 7, -1, 5, 10, chrome); g.line(1, 11, 7, -1, 11, 10, chrome); g.line(-1, 5, 10, -1, 11, 10, chrome);
  // Electric motor, finned pump with two heads, red belt guard on the front.
  g.box(6, 5, 10.5, 25, 11, 11.5, darkSteel);
  g.cylX(8, 14, 2.8, 6, 13, flat(ST[3])); g.cylX(8, 14, 1, 13, 15, chrome);
  g.box(17, 5.5, 11, 24, 10.5, 14, flat(ST[2]));
  for (const x of [18, 21.5]) g.cylZ(x + 1, 8, 1.7, 14, 19, mat((xx, yy, z) => cl(ST, (ix(z) & 1) ? 3 : 1)));
  g.box(10, 11, 11, 23, 12.5, 18, flat(RD[2])); g.box(11, 12.5, 12, 22, 13, 17, flat(RD[3]));
  // Pressure gauge, valve and a coil of rubber hose on the ground.
  g.cylY(16, 11.5, 1.3, 11.5, 13, flat(CR[3])); g.set(16, 13, 12, flat(RD[1])); g.box(15.5, 10.5, 10.5, 16.5, 11.5, 11, darkSteel);
  g.box(27, 6.5, 6, 29, 8.5, 8, flat(GD[2]));
  for (let a = 0; a < Math.PI * 2; a += .1) for (const r of [2, 3]) g.set(10 + Math.cos(a) * r, 14.5 + Math.sin(a) * r * .6, 0, flat(RB[3]));
}, { margin: 6 });

def('prop_generator', 'World', [2, 1], 22, (g, ctx) => {
  const paint = olive(4, 3), dark = flat(OL[1]);
  g.box(1, 3, 0, 31, 13, 1.5, darkSteel); for (const x of [1, 29]) g.box(x, 2, 0, x + 2, 14, 1, darkSteel);
  // Engine with radiator grille, fuel tank, generator drum, control panel.
  g.box(4, 4, 1.5, 16, 12, 11, paint);
  g.box(2.5, 4.5, 1.5, 4, 11.5, 10.5, mat((x, y, z) => (ix(z) & 1) ? OL[1] : OL[3]));
  g.box(5, 5, 11, 14, 11, 13.5, flat(OL[3])); g.cylZ(12.5, 6.5, .9, 13.5, 14.5, flat(GD[2]));
  g.cylX(8, 7.5, 4.3, 16, 25, paint); for (let x = 17; x < 25; x += 2) g.cylX(8, 7.5, 4.5, x, x + .6, dark);
  g.box(25, 4, 1.5, 30, 12, 15, flat(OL[2])); g.box(25.5, 12, 3, 29.5, 12.5, 14, flat(OL[1]));
  g.cylY(26.8, 11.5, 1, 12.5, 13, flat(CR[3])); g.cylY(28.5, 11.5, 1, 12.5, 13, flat(CR[3]));
  g.set(27.6, 12.6, 8, glow(ctx.frame % 2 ? GD[3] : GD[1])); g.set(27.6, 12.6, 6, glow(ctx.frame % 2 ? RD[1] : RD[4]));
  g.box(26, 12.5, 4, 28, 13, 5, flat(TP[1])); g.text('s', 5, 12, 9, 'US', CR[2]);
  // Exhaust pipe with muffler and rain cap.
  g.cylX(4.5, 12, 1.4, 6, 12, flat(ST[1])); g.cylZ(12, 4.5, .9, 11, 21, flat(ST[1])); g.box(11, 3.5, 21, 13, 5.5, 21.6, flat(ST[2]));
  // Cables coiled on the ground.
  for (let a = 0; a < Math.PI * 2; a += .12) g.set(29 + Math.cos(a) * 2.2, 15 + Math.sin(a) * 1.4, 0, flat(TP[3]));
}, { frames: 4, fps: 8, animated: true, margin: 6, overlay: smokeOverlay(12, 4.5, 22, 24) });

// ======================= Ladders and jacks =======================

def('prop_ladder_stand', 'World', [1, 2], 36, g => {
  // Rolling maintenance stand: aluminium stringers, yellow-nosed treads, checker-plate platform, rails.
  const al = flat(ST[3]), alD = flat(ST[2]);
  for (const x of [2, 13]) {
    g.line(x + .5, 30, 1, x + .5, 13, 24, al, .7);
    g.box(x, 3, 1, x + 1, 4, 24, alD); g.box(x, 12, 1, x + 1, 13, 24, alD);
    g.line(x + .5, 30, 9, x + .5, 13, 32, al); g.box(x, 3, 24, x + 1, 4, 33, al); g.box(x, 12, 24, x + 1, 13, 33, al);
    g.box(x, 3, 32, x + 1, 13, 33, al); g.box(x, 3, 28, x + 1, 13, 28.6, al);
    g.box(x, 3, 1, x + 1, 30, 2, alD);
  }
  for (const [x, y] of [[2, 3], [12, 3], [2, 28], [12, 28]]) caster(g, x, y, -1.5);
  for (let k = 0; k < 6; k++) { const z = 4 + k * 3.4, y = 27 - k * 2.4; g.box(3, y, z, 13, y + 2.4, z + 1, flat(ST[3])); g.box(3, y + 1.8, z, 13, y + 2.4, z + 1, flat(GD[3])); }
  g.box(2, 3, 24, 14, 13, 25, mat((x, y, z, f) => f === 'u' && ((ix(x) + ix(y)) % 3 === 0) ? ST[4] : ST[3]));
  g.box(2, 12.4, 23.5, 14, 13, 24, flat(GD[3]));
  g.box(3, 3, 3, 13, 4, 4, alD); g.line(3, 4, 4, 12, 12, 22, alD);
}, { margin: 5 });

def('prop_ladder_step', 'World', [1, 1], 36, g => {
  // Wooden A-frame step ladder with a paint-can shelf.
  const rail = woodPost;
  for (const x of [3, 12]) { g.line(x, 13, 0, x, 8.5, 30, rail, .7); g.line(x, 2.5, 0, x, 7, 29, rail, .7); }
  for (let k = 1; k < 7; k++) { const z = k * 4.2, y = 13 - z * (4.5 / 30); g.box(3.5, y - 1.2, z, 12.5, y + .6, z + .8, planks(WD, 3, 2, 'x')); }
  g.box(2, 6, 30, 14, 10, 31.5, planks(WD, 3, 2, 'x'));
  g.box(3, 4, 18, 12.5, 7, 19, flat(WD[2]));
  g.cylZ(8, 8, 1.6, 31.5, 34, flat(GD[2])); g.set(8, 7.5, 34, flat(GD[1]));
  g.line(3, 6, 12, 12, 6, 12, rope);
}, { margin: 4 });

def('prop_jack_tripod', 'World', [1, 1], 30, g => {
  // Aircraft tripod jack: yellow legs and ram, chrome screw, pump handle and gauge.
  const yel = flat(GD[2]), dk = flat(GD[1]);
  for (const [x, y] of [[1.5, 13.5], [14.5, 13.5], [8, 1.5]]) { g.line(8, 8, 12, x, y, 1, yel, .8); g.box(x - 1.3, y - 1.3, 0, x + 1.3, y + 1.3, 1, darkSteel); }
  g.cylZ(8, 8, 2.4, 9, 21, yel); g.cylZ(8, 8, 2.7, 9, 10.5, dk); g.cylZ(8, 8, 2.7, 19.5, 21, dk);
  g.cylZ(8, 8, 1.2, 21, 27, mat((x, y, z) => (ix(z) & 1) ? ST[4] : ST[3])); g.cylZ(8, 8, 2, 27, 28, flat(ST[2]));
  g.box(10, 7, 12, 12.5, 9, 14, dk); g.line(12, 8, 13.5, 15, 8, 20, chrome); g.box(14.5, 7.5, 19.5, 15.5, 8.5, 21, flat(RB[2]));
  g.cylY(6, 15, 1.3, 9.5, 11, flat(CR[3])); g.set(6, 11, 15, flat(RD[1]));
  g.text('s', 5, 10.4, 19, '5T', GD[0]);
}, { margin: 5 });

// ======================= Machine tools and smithing =======================

def('prop_lathe', 'World', [2, 1], 22, g => {
  const body = flat(MG[3]), dark = flat(MG[2]);
  g.box(3, 5, 0, 9, 11, 9, drawersMat(MG, 3, [5], 3, 9)); g.box(23, 5, 0, 29, 11, 9, drawersMat(MG, 3, [5], 23, 29));
  pulls(g, 3, 9, 11, [3], 2); pulls(g, 23, 29, 11, [3], 2);
  g.box(2, 4, 9, 30, 12.5, 10, dark); g.box(2, 12, 9.5, 30, 12.5, 10.5, dark);
  g.box(3, 6, 10, 29, 7.5, 12, flat(ST[3])); g.box(3, 8.5, 10, 29, 10, 12, flat(ST[3]));
  // Headstock with gear cover and levers, chuck, brass work piece.
  g.box(3, 4.5, 12, 10, 11.5, 19, body); g.box(3, 4.5, 19, 10, 11.5, 19.6, dark);
  g.line(5, 11.5, 17, 5, 13.5, 18, chrome); g.line(8, 11.5, 15, 8, 13, 17, chrome); g.set(5, 13.5, 18, flat(RD[3])); g.set(8, 13, 17, flat(RD[3]));
  g.cylX(8, 15.5, 2.7, 10, 12, flat(ST[3])); for (const dz of [-2.5, 2]) g.box(12, 7.5, 15 + dz, 13, 8.5, 16 + dz, flat(ST[2]));
  g.cylX(8, 15.5, 1.4, 12, 21, flat(GD[3]));
  // Carriage with tool post and hand wheel, tailstock and its wheel.
  g.box(15, 4, 12, 20, 12.5, 13.2, dark); g.box(16, 10, 13, 19, 12, 14.5, body); g.box(17, 9.5, 14, 18, 10.5, 15, darkSteel);
  g.cylY(17.5, 11, 1.6, 12.5, 13.3, flat(RD[2])); g.set(17.5, 13.5, 12, chrome);
  g.box(23, 6, 12, 27.5, 10, 18, body); g.cylX(8, 15.5, .8, 20, 23, chrome); g.cylX(8, 15.5, 1.8, 27.5, 28.3, flat(RD[2]));
  // Motor behind, belt up to the headstock, curls of swarf in the chip tray.
  g.cylX(3, 6, 2.2, 3, 9, flat(MG[2])); g.line(6, 3, 8, 6, 4.5, 17, flat(TP[1]));
  for (const [x, y] of [[13, 11], [14, 10], [20.5, 11.3], [21.5, 10.6], [22, 11.6]]) g.set(x, y, 10, flat(GD[3]));
}, { margin: 6 });

def('prop_drill_press', 'World', [1, 1], 32, g => {
  const body = flat(MG[3]), dark = flat(MG[2]);
  g.box(3.5, 1, 0, 12.5, 12, 1.5, dark); g.box(4.5, 8, 1.5, 11.5, 11, 2, flat(MG[4]));
  g.cylZ(8, 3, 1.2, 1.5, 25, chrome);
  // Table on its bracket with a small machine vice.
  g.box(6.5, 2, 11, 9.5, 6, 13, dark); g.cylZ(8, 7.5, 3.2, 12, 13, body);
  g.box(6, 6.5, 13, 10, 9, 14.5, flat(ST[2])); g.box(7.5, 9, 13.5, 8.5, 11, 14, chrome);
  // Head, belt cover, motor at the back, spindle, chuck, bit and three-spoke feed.
  g.box(5, 1, 20, 11, 9, 25, body); g.box(4, 0, 25, 12, 7, 27.5, mat((x, y, z, f) => f === 'u' ? MG[4] : MG[3])); g.ell(8, 3.5, 27.5, 3.5, 3.2, 1, flat(MG[4]));
  g.cylZ(8, -1.5, 2.3, 19, 25.5, flat(MG[2]));
  g.cylZ(8, 7.5, .9, 17, 20, chrome); g.cylZ(8, 7.5, 1.3, 15.5, 17, flat(ST[2])); g.cylZ(8, 7.5, .4, 14, 15.5, chrome);
  for (const a of [0, 2.1, 4.2]) { const ex = 13, ey = 5 + Math.cos(a) * 3, ez = 22.5 + Math.sin(a) * 3; g.line(11, 5, 22.5, ex, ey, ez, chrome); g.set(ex, ey, ez, flat(RD[3])); }
  g.set(6, 9, 23.5, glow(GD[3])); g.box(9.5, 9, 21, 10.5, 9.5, 23, flat(RD[2]));
}, { margin: 5 });

def('prop_anvil', 'World', [1, 1], 16, g => {
  // Elm stump, a London-pattern anvil with horn, hammer on the face, tongs and a quench bucket.
  g.cylZ(7.5, 8, 3.8, 0, 6, woodPost); g.cylZ(7.5, 8, 3.8, 5.6, 6, mat((x, y) => (ix(Math.hypot(x - 7.5, y - 8)) & 1) ? WD[3] : WD[2]));
  const iron = flat(ST[1]);
  g.box(4.5, 6, 6, 10.5, 10, 7.5, iron); g.box(5.5, 6.5, 7.5, 9.5, 9.5, 9, iron);
  g.box(3, 5.8, 9, 12, 10.2, 11, mat((x, y, z, f) => f === 'u' ? ST[3] : ST[1]));
  g.shape(12, 6, 9, 16, 10, 11, (x, y, z) => { const r = 2.1 * (1 - (x - 12) / 4.3); return (y - 8) ** 2 / 4 + (z - 10.3) ** 2 <= r * r * .6; }, iron);
  g.box(2, 6.8, 9.8, 3, 9.2, 11, iron);
  g.line(5, 7.5, 11, 10, 9, 11, flat(WD[3])); g.box(9.5, 7.8, 11, 11.5, 10, 12.5, flat(ST[2]));
  g.line(1.5, 12.5, 0, 2.5, 10.5, 8, darkSteel); g.line(2.5, 12.5, 0, 3, 10.6, 8, darkSteel);
  g.cylZ(12.5, 13, 2, 0, 4.5, flat(WD[2])); g.cylZ(12.5, 13, 1.5, 4, 4.5, glow(GL[1])); g.cylZ(12.5, 13, 2.1, 1.5, 2, darkSteel);
}, { margin: 4 });

// Flickering flames and rising embers over a fire bed.
function fireOverlay(px, py, pz, w = 4, seed = 2) {
  return (c, project, f) => {
    const [sx, sy] = project(px, py, pz);
    for (let k = 0; k < 7; k++) {
      const x = Math.round(sx - w + (k + .5) * (2 * w / 7)), h = 2 + Math.floor(hash(k, f, seed) * 4) + (k > 1 && k < 5 ? 2 : 0);
      for (let t = 0; t < h; t++) c.put(x, sy - t, t < h * .35 ? FI[3] : t < h * .75 ? FI[2] : FI[1]);
      if (hash(k, f, seed + 1) < .5) c.put(x, sy - h, FI[4]);
    }
    for (let k = 0; k < 4; k++) { const life = ((k * 5 + f * 2) % 6) / 6; c.put(sx + Math.sin(k * 2.3 + life * 4) * 2 - 1 + k, sy - 6 - life * 10, life < .5 ? FI[3] : FI[2]); }
  };
}

def('prop_forge_portable', 'World', [1, 1], 22, (g, ctx) => {
  // Riveted forge pan on three legs, hand-crank blower, glowing coals, tongs and a bar heating.
  for (const [x, y] of [[3, 12.5], [13, 12.5], [8, 3]]) g.line(8, 8, 8, x, y, 0, darkSteel, .6);
  g.cylZ(8, 8, 5.6, 8, 10.5, flat(ST[1])); g.cylZ(8, 8, 6, 10, 10.8, flat(ST[2]));
  g.shape(3, 3, 10, 13, 13, 11, (x, y) => Math.hypot(x - 8, y - 8) < 4.8, mat((x, y) => { const h = hash(ix(x), ix(y) + ctx.frame * 13, 7); return h < .35 ? FI[3] : h < .7 ? FI[2] : h < .9 ? FI[1] : SM[1]; }, { flat: true }));
  g.cylX(8, 5.5, 2.6, 13, 15.5, flat(RD[2])); g.cylX(8, 5.5, .7, 15.5, 16.5, chrome); g.line(11, 8, 7, 13, 8, 5.5, darkSteel, .6);
  const a = ctx.frame * Math.PI / 3, hy = 8 + Math.cos(a) * 2, hz = 5.5 + Math.sin(a) * 2;
  g.line(16.5, 8, 5.5, 16.5, hy, hz, chrome); g.box(16.5, hy - .5, hz - .5, 18, hy + .5, hz + .5, flat(WD[2]));
  g.line(2, 9, 11, -2, 11, 12.5, darkSteel); g.line(5, 8.5, 11, 9, 8, 11, glow(FI[3]));
  g.line(3, 12, 10.5, 0, 14, 12, darkSteel); g.line(3, 12.6, 10.5, 0, 14.6, 12, darkSteel);
}, { frames: 6, fps: 10, animated: true, margin: 6, overlay: fireOverlay(8, 8, 11, 3.5, 4) });

// ======================= Racks and shelves =======================

def('prop_rack_parts', 'World', [2, 1], 34, g => {
  const up = flat(MG[2]), shelf = flat(MG[3]);
  for (const [x, y] of [[1, 3], [30, 3], [1, 12], [30, 12]]) g.box(x, y, 0, x + 1, y + 1, 32, up);
  for (const z of [1, 11, 21]) g.box(1, 3, z, 31, 13, z + 1, shelf);
  for (const y of [3, 12]) g.box(1, y, 31, 31, y + 1, 32, up);
  g.line(1.5, 3.5, 1, 30.5, 3.5, 31, up);
  // Bottom: two tyres on their treads and a crate.
  for (const x of [6.5, 15]) { g.cylY(x, 6.6, 4.5, 6, 10, tyre); g.cylY(x, 6.6, 2.2, 5.8, 10.2, flat(ST[3])); g.cylY(x, 6.6, .8, 5.6, 10.4, darkSteel); }
  g.box(21, 5, 2, 29, 12, 8, planks(WD, 3, 3, 'x')); g.text('s', 22, 12, 6, 'AN', WD[0]);
  // Middle: pipes and tubes, a coil of hose.
  for (const [y, z, R, i] of [[5, 13, ST, 3], [7.5, 13, CU, 3], [10, 13, ST, 4], [6.2, 15, CU, 2], [8.8, 15, ST, 3]]) g.cylX(y, z, 1.1, 2, 20, flat(R[i]));
  for (let a = 0; a < Math.PI * 2; a += .1) for (const r of [2.4, 3.3]) g.set(25 + Math.cos(a) * r, 8 + Math.sin(a) * r * .8, 12, flat(RB[3]));
  // Top: oil cans, boxed spark plugs, a spare magneto.
  for (let k = 0; k < 4; k++) g.cylZ(3.5 + k * 3, 8, 1.3, 22, 26, flat(k & 1 ? GD[2] : OL[3]));
  for (let k = 0; k < 3; k++) { g.box(16 + k * 3.5, 6, 22, 18.8 + k * 3.5, 11, 25, flat(k === 1 ? CR[2] : RD[2])); }
  g.box(26, 6, 22, 30, 10, 26, flat(ST[2])); g.cylY(28, 24, 1.3, 10, 11, flat(GD[2]));
}, { margin: 5 });

def('prop_rack_manuals', 'World', [1, 1], 40, g => {
  // Bookcase of War Department technical manuals, binders, and rolled blueprints on top.
  g.box(1, 4, 0, 15, 5, 30, woodDark);
  for (const x of [1, 14]) g.box(x, 4, 0, x + 1, 12, 30, flat(WD[2]));
  for (const z of [0, 10, 20, 29]) g.box(1, 4, z, 15, 12, z + 1, planks(WD, 3, 2, 'x'));
  const cols = [OL[3], RD[2], NV[3], CR[2], OL[2], GD[2], NV[2], RD[3], OL[3]];
  for (const [z0, seed] of [[1, 1], [11, 2]]) {
    let x = 2, k = 0;
    while (x < 13.5) {
      const w = 1 + (hash(k, seed, 3) < .4 ? 1 : 0), h = 6 + ix(hash(k, seed, 4) * 3), c = cols[(k * 3 + seed) % cols.length];
      if (seed === 2 && k === 4) { g.line(x + .5, 7.5, z0, x + 3, 7.5, z0 + h - 1, flat(c), .6); x += 3; k++; continue; }
      g.box(x, 5, z0, x + w, 11.5, z0 + h, flat(c)); g.set(x, 11.5, z0 + h - 2, flat(GD[3]));
      x += w; k++;
    }
  }
  // Third shelf: two fat binders, a field telephone and a tin.
  g.box(2, 5, 21, 5, 11.5, 28, flat(OL[2])); g.box(5, 5, 21, 8, 11.5, 28, flat(NV[3])); g.text('s', 2, 11.5, 26, 'TM', CR[3]);
  g.box(9, 6, 21, 13.5, 11, 24, flat(OL[1])); g.box(9.5, 7, 24, 13, 8.5, 25, darkSteel);
  for (const [x, y, h] of [[4, 7, 6], [5.5, 8.5, 8], [7, 7, 5]]) g.cylZ(x, y, .9, 30, 30 + h, flat(BP[3]));
  g.cylZ(11, 8, 2, 30, 32, flat(WD[3]));
}, { margin: 6 });

// ======================= The engineer's inventions =======================

// Blueprint fighter drawn in white line work (top view, nose up).
const PLAN = [
  '         #         ',
  '        # #        ',
  '        # #        ',
  '  ###### # ######  ',
  ' #       #       # ',
  '  ######   ######  ',
  '        # #        ',
  '        # #        ',
  '      ### ###      ',
  '      #     #      ',
  '       #####       '
];
def('prop_drafting_table', 'World', [2, 1], 36, g => {
  // Tilted drawing board: rows of the blueprint follow screen rows on the south facing.
  const x0 = 3, x1 = 29, zF = 14, slope = 1.4, yF = 13, yB = 5;
  const sv0 = Math.floor(yB - (zF + (yF - yB) * slope)) - 1;
  const paper = mat((x, y, z, f) => {
    if (f === 'n' || f === 'e' || f === 'w' || f === 'd') return WD[2];
    const u = ix(x) - x0, v = ix(y) - ix(z) - (f === 'u' ? 1 : 0) - sv0;
    if (u < 1 || u > x1 - x0 - 2) return WD[3];
    if (v < 1 || v > 20) return v < 1 ? WD[3] : WD[2];
    const pr = PLAN[v - 4], pc = pr && pr[u - 2];
    if (pc === '#') return BP[4];
    if (u >= 20 && u <= 23 && v >= 14 && v <= 17) return (u === 20 || v === 14) ? BP[4] : BP[3];
    if (u === 21 && v < 12 && v > 2) return BP[3];
    return (u % 4 === 0 || v % 4 === 0) ? BP[2] : BP[1];
  }, { flat: true });
  g.shape(x0, yB, zF - 1, x1, yF + 1, zF + (yF - yB) * slope + 2, (x, y, z) => y >= yB && y < yF + 1 && Math.abs(z - (zF + (yF - y) * slope)) <= 1, paper);
  // Pins in the corners, a T-square on the edge, triangle and pencils.
  for (const [x, y] of [[x0 + 2, yB + 1], [x1 - 3, yB + 1]]) g.set(x, y, zF + (yF - y) * slope + 2, flat(RD[3]));
  g.box(x0, yF + .5, zF - 1, x1, yF + 1.5, zF + 1, flat(WD[3])); g.box(x0 - 2, 9, zF + 1, x0, 12, zF + 7, flat(WD[3]));
  g.set(x1 - 6, yF + 1, zF + 1, flat(GD[3])); g.set(x1 - 4, yF + 1, zF + 1, flat(RD[2]));
  // Trestle legs and footrest, articulated lamp clamped on the right.
  for (const x of [4, 26]) { g.box(x, 4, 0, x + 2, 6, zF + 9, woodPost); g.box(x, 11, 0, x + 2, 13, zF - 1, woodPost); g.box(x, 4, 4, x + 2, 13, 5, woodDark); }
  g.box(4, 8, 2, 28, 9, 3, woodDark);
  g.line(29, 5, zF + 11, 29, 4, zF + 18, darkSteel, .5); g.line(29, 4, zF + 18, 25, 7, zF + 20, darkSteel, .5);
  g.cone(24, 8, 1, 2.6, zF + 17, zF + 20, flat(OX[2])); g.cylZ(24, 8, 1.2, zF + 16.5, zF + 17, glow(GD[3]));
  // Stool.
  g.cylZ(16, 18, 2.6, 8, 9, flat(WD[3])); for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.line(16 + dx * .5, 18 + dy * .5, 8, 16 + dx, 18 + dy, 0, woodPost);
}, { margin: 8 });

def('prop_blackboard', 'World', [2, 1], 34, g => {
  // Double-sided chalkboard on a rolling A-frame stand; lift equation in front, E=MC2 on the back.
  const frame = flat(WD[2]);
  for (const x of [1, 30]) { g.line(x + .5, 2, 0, x + .5, 7.5, 31, woodPost, .7); g.line(x + .5, 13, 0, x + .5, 8.5, 31, woodPost, .7); g.box(x, 2, 0, x + 1, 14, 1.5, frame); caster(g, x - .5, 1, -1.5); caster(g, x - .5, 13, -1.5); }
  g.box(2, 7, 10, 30, 9, 30, mat((x, y, z, f) => f === 'u' ? WD[2] : CB[(ix(x) * 7 + ix(z) * 3) % 11 === 0 ? 2 : 1]));
  g.box(2, 7, 30, 30, 9, 31, frame); g.box(1.5, 6.5, 9, 30.5, 9.5, 10, frame);
  g.box(2, 7, 10, 3, 9, 30, frame); g.box(29, 7, 10, 30, 9, 30, frame);
  g.box(4, 9, 9.5, 29, 11, 10.5, frame); g.box(6, 9.5, 10.5, 8, 10.5, 11, flat(CR[3])); g.box(20, 9, 10.5, 24, 10.5, 12, flat(WD[0]));
  g.box(20, 9, 11.5, 24, 10.5, 12, flat(CR[1]));
  const front = glyphRows('L=CL*Q'), mid = glyphRows('Q=PV2'), back1 = glyphRows('E=MC2'), back2 = glyphRows('2+2=4');
  g.bitmap('s', 4, 8, 28, front, { '#': chalk }); g.bitmap('s', 4, 8, 22, mid, { '#': chalk });
  const wing = ['     ######     ', '  ###      ###  ', ' #            ##', '  ############   '];
  g.bitmap('s', 6, 8, 15, wing, { '#': chalk }); g.bitmap('s', 3, 8, 16, ['#', '#', '#'], { '#': { c: GD[3], flat: true } });
  g.bitmap('s', 23, 8, 17, [' # ', '###', ' # ', ' # '], { '#': { c: GD[3], flat: true } });
  g.bitmap('n', 27, 7, 27, back1, { '#': chalk }); g.bitmap('n', 27, 7, 20, back2, { '#': chalk });
}, { margin: 6 });

def('prop_invention_tesla', 'World', [1, 1], 40, g => {
  // Home-built Tesla coil: walnut base with knife switch, copper primary, wound secondary, chrome toroid.
  g.box(2, 3, 0, 14, 13, 5, planks(WD, 2, 2, 'x')); g.box(1.5, 2.5, 4.5, 14.5, 13.5, 5.5, flat(WD[3]));
  g.box(3, 11, 5.5, 6, 13, 6, darkSteel); g.line(3.5, 12, 6, 6.5, 12, 8.5, chrome); g.set(6.5, 12, 8.5, flat(RD[2]));
  g.box(10, 11, 5.5, 13, 13, 7, flat(TP[2])); g.set(11.5, 13, 6.5, glow(RD[4]));
  for (const z of [6, 7.5]) for (let a = 0; a < Math.PI * 2; a += .1) g.set(8 + Math.cos(a) * 4.2, 8 + Math.sin(a) * 4.2, z, flat(CU[3]));
  for (const a of [0, 2.1, 4.2]) g.line(8 + Math.cos(a) * 4.2, 8 + Math.sin(a) * 4.2, 5.5, 8 + Math.cos(a) * 4.2, 8 + Math.sin(a) * 4.2, 8, flat(CR[1]));
  g.cylZ(8, 8, 1.6, 5.5, 29, mat((x, y, z) => (ix(z) & 1) ? CU[3] : CU[2]));
  g.cylZ(8, 8, 2, 5.5, 7, flat(CR[2])); g.cylZ(8, 8, .6, 29, 31, chrome);
  for (let a = 0; a < Math.PI * 2; a += .06) for (let b = 0; b < Math.PI * 2; b += .4) {
    const R = 3.8 + 1.5 * Math.cos(b); g.set(8 + R * Math.cos(a), 8 + R * Math.sin(a), 31.5 + 1.5 * Math.sin(b), flat(ST[3]));
  }
  g.line(13, 4, 5, 15, 2, 0, flat(TP[3]));
}, {
  frames: 6, fps: 12, margin: 12,
  overlay: (c, project, f) => {
    // Three jagged arcs jump from the toroid into the air; cyan glow around a white core.
    for (let k = 0; k < 3; k++) {
      const th = hash(k, f, 9) * Math.PI * 2, [sx0, sy0] = project(8 + Math.cos(th) * 5.3, 8 + Math.sin(th) * 5.3, 31.5);
      let x = sx0, y = sy0, dx = Math.cos(th) * .9 + (hash(k, f, 2) - .5) * .4, dy = -.5 - hash(k, f, 3) * .6 + Math.sin(th) * .4;
      const n = 6 + ix(hash(k, f, 4) * 7);
      for (let s = 0; s < n; s++) {
        const px = Math.round(x), py = Math.round(y);
        x += dx * 1.6 + (hash(s, k * 9 + f, 5) - .5) * 2.2; y += dy * 1.6 + (hash(s, k * 9 + f, 6) - .5) * 2;
        c.line(px + 1, py, Math.round(x) + 1, Math.round(y), withAlpha(IC[1], 140), true);
        c.line(px, py, Math.round(x), Math.round(y), s < n - 2 ? PAL.WHITE : IC[2]);
      }
    }
  }
});

def('prop_invention_dynamo', 'World', [2, 1], 26, (g, ctx) => {
  const f = ctx.frame;
  g.box(1, 3, 0, 31, 14, 2, planks(WD, 3, 3, 'x'));
  // Hand-cranked flywheel (spokes turn per frame) on two posts.
  for (const y of [4, 9]) g.box(5.5, y, 2, 7.5, y + 1.5, 11, woodPost);
  const cx = 6.5, cz = 12, rim = flat(RD[2]);
  for (let a = 0; a < Math.PI * 2; a += .04) for (const r of [5.2, 6]) g.set(cx + Math.cos(a) * r, 7, cz + Math.sin(a) * r, rim);
  for (let k = 0; k < 4; k++) { const a = f * Math.PI / 8 + k * Math.PI / 2; g.line(cx, 7, cz, cx + Math.cos(a) * 5.2, 7, cz + Math.sin(a) * 5.2, flat(RD[1])); }
  g.cylY(cx, cz, 1.2, 6, 8.5, chrome);
  const ha = f * Math.PI / 2; g.line(cx, 8.5, cz, cx + Math.cos(ha) * 3.5, 8.5, cz + Math.sin(ha) * 3.5, chrome); g.cylY(cx + Math.cos(ha) * 3.5, cz + Math.sin(ha) * 3.5, .8, 8.5, 11, flat(WD[3]));
  // Belt to the armature: copper drum inside a red horseshoe magnet with silver poles.
  g.line(cx, 6.5, cz + 6, 16, 6.5, 9.5, flat(TP[1])); g.line(cx, 6.5, cz - 6, 16, 6.5, 6.5, flat(TP[1]));
  g.cylX(8, 8, 2.4, 13, 20, mat((x) => (ix(x) & 1) ? CU[3] : CU[2])); g.cylX(8, 8, .8, 11, 22, chrome);
  for (const x of [11.5, 20.5]) g.box(x - .5, 6.5, 2, x + .5, 9.5, 8, woodDark);
  g.shape(13.5, 4, 2, 19.5, 13, 15, (x, y, z) => { const d = Math.hypot(y - 8.5, z - 8); return z >= 7 && d >= 3.3 && d <= 5.2; }, flat(RD[3]));
  for (const y of [3.6, 11.6]) g.box(13.5, y, 2, 19.5, y + 1.8, 7, flat(ST[4]));
  // Lamp board: four bulbs chase in turn, needle gauge swings, copper wiring.
  g.box(22, 4, 2, 30, 5.5, 18, planks(WD, 2, 2, 'x')); g.box(21.5, 3.5, 18, 30.5, 6, 19, flat(WD[3]));
  [[24, 15], [28, 15], [24, 10.5], [28, 10.5]].forEach(([x, z], k) => {
    g.box(x - .5, 5.5, z - 2, x + .5, 6.5, z - 1, flat(GD[1]));
    const lit = (k === f) || (k === (f + 2) % 4);
    g.ell(x, 6.6, z, 1.4, 1.2, 1.5, lit ? glow(GD[3]) : flat(GL[1]));
    if (lit) g.set(x, 7.6, z, glow(FI[4]));
  });
  g.cylY(26, 6, 1.6, 5.5, 6.2, flat(CR[3])); g.set(26 + [-1, 0, 1, 0][f], 6.4, 6.6, flat(RD[1]));
  g.line(20, 10, 2.5, 22, 10, 2.5, flat(CU[3])); g.line(22, 10, 2.5, 22, 6, 8, flat(CU[3])); g.line(20, 6, 2.5, 22, 5.5, 4, flat(CU[2]));
  for (let a = 0; a < Math.PI * 2; a += .15) g.set(27 + Math.cos(a) * 2, 11 + Math.sin(a), 2, flat(CU[3]));
}, { frames: 4, fps: 6, animated: true, margin: 6 });

def('prop_invention_lab', 'World', [2, 1], 30, (g, ctx) => {
  benchBase(g);
  // Back shelf with labelled jars.
  g.box(1, 2, 12, 31, 4, 13, woodDark); g.box(1, 2, 19, 31, 4, 20, woodDark); for (const x of [1, 30]) g.box(x, 2, 12, x + 1, 4, 20, woodDark);
  [OL[4], GD[3], RD[3], CR[3], NV[4], GD[2]].forEach((c, k) => { g.cylZ(4 + k * 4.5, 3, 1.3, 13, 17, glow(GL[1])); g.cylZ(4 + k * 4.5, 3, 1.3, 13, 15, glow(c)); g.cylZ(4 + k * 4.5, 3, 1.4, 17, 18, flat(WD[1])); });
  // Test-tube rack with coloured liquids.
  g.box(3, 8, 12, 12, 11, 13, flat(WD[3])); g.box(3, 8, 15, 12, 11, 16, flat(WD[3])); for (const x of [3, 11]) g.box(x, 8, 12, x + 1, 11, 16, flat(WD[3]));
  [FI[3], OX[4], RD[4], IC[2]].forEach((c, k) => { g.box(4.5 + k * 1.8, 9, 13, 5.5 + k * 1.8, 10, 18, glow(GL[2])); g.box(4.5 + k * 1.8, 9, 13, 5.5 + k * 1.8, 10, 16, glow(c)); });
  // Round flask on a tripod over a burner (flame flickers), coiled condenser into a beaker.
  for (const [dx, dy] of [[-2, -1.5], [2, -1.5], [0, 2]]) g.line(17 + dx, 9 + dy, 12, 17, 9, 17, darkSteel);
  g.cylZ(17, 9, 1, 12, 14, flat(ST[2])); g.cylZ(17, 9, .7, 14, 14 + 1 + (ctx.frame & 1), glow(ctx.frame & 1 ? IC[2] : IC[1]));
  g.ell(17, 9, 19.5, 2.6, 2.6, 2.6, glow(OX[4])); g.ell(17, 9, 21.5, 2.2, 2.2, 1, glow(GL[3])); g.cylZ(17, 9, .7, 21, 24, glow(GL[3]));
  for (let t = 0; t < 1; t += .03) g.set(19 + t * 6, 9 + Math.sin(t * 18) * 1.2, 23 - t * 7 + Math.cos(t * 18) * .8, glow(GL[3]));
  g.cylZ(26, 10, 1.8, 12, 16, glow(GL[2])); g.cylZ(26, 10, 1.6, 12, 14, glow(OX[4]));
  // Open notebook.
  g.box(21, 12, 12, 25, 14.5, 12.4, flat(CR[3])); g.box(25, 12, 12, 29, 14.5, 12.4, flat(CR[2])); g.line(21.5, 13, 12.4, 24, 13, 12.4, flat(NV[2]));
}, {
  frames: 4, fps: 6, animated: true, margin: 6,
  overlay: (c, project, f) => {
    // Bubbles rising out of the flask neck.
    const [sx, sy] = project(17, 9, 24);
    for (let k = 0; k < 3; k++) { const t = ((k * 4 + f * 3) % 12) / 12; c.put(sx + Math.round(Math.sin(t * 9 + k) * 1.2), sy - 1 - Math.round(t * 9), t < .6 ? withAlpha(OX[4], 220) : withAlpha(CR[3], 160)); }
  }
});

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

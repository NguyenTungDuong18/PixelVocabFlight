'use strict';
// World models: vehicles (veh_*).
const { PAL } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, RD, WD } = PAL;
const {
  CV, TP, RB, ix, flat, glow, planks, canvasMat, glass, interior, olive, steel, darkSteel, rubber,
  woodDark, redPaint, cream, windowOn, wheelX, def, roundelRows, roundelPal, discTop
} = require('./common.cjs');

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

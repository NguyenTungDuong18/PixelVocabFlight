'use strict';
// World models: dorm — the attic dormitory room of the Brandhaven flying school, night of 9 May 1940
// (map m1_dorm, Act 0 / M1 part 1). Style VL-2 interior: Dutch gable-end attic, pine wainscot,
// faded striped wallpaper. The room is cut away: walls show their dark top.
// Placement contract (DormRoomMap): bld_dorm_wall on the wall row (y = 1) behind the floor; everything
// "on the wall" (prop_wall_*, photo, handkerchief, sketchbook shelf, letter, poster, window) is a
// Layer = Wall placement on that SAME row: its footprint's south edge is the foot of the wall, and its
// picture sits on the wall face (onWall: voxel row 16, just in front of the face) from 28 px up to
// under the purlins, so it never reaches the floor and stays above the head of a character standing
// on the first floor row. These props drop no floor shadow; they get a small two-tier shadow on the wall.
const { PAL, ramp, hash, fbm, hex } = require('../lib.cjs');
const { mat, textRows } = require('../voxel.cjs');
const { CR, GD, ST, RD, WD, NV, FI, GL } = PAL;
const { WH, TP, cl, ix, flat, glow, planks, woodDark, woodPost, def } = require('./common.cjs');

// ---------------- Local ramps (unique hexes) ----------------
const WP = ramp('#575240', '#736d55', '#8f886c', '#a9a286', '#c1ba9f');           // wallpaper ground, faded sage cream
const WS = ramp('#5d4c3a', '#7a654c', '#967e60', '#b09877');                      // wallpaper stripe, tobacco
const BJ = ramp('#3d1b14', '#5c2b20', '#7b3e2d', '#98543d', '#b26f53');           // Jonas: rust plaid blanket
const BD = ramp('#27323c', '#3a4955', '#51636f', '#6c808b', '#8b9da6');           // Daan: grey-blue issue blanket
const TK = ramp('#6e6a5c', '#938e7c', '#b5b09c', '#d2cdb9', '#e9e5d4');           // mattress ticking / sheets
const CD = ramp('#27323f', '#3a4a5c', '#51657a', '#6e8398');                      // cadet jacket blue-grey
const RG = ramp('#3a1d1f', '#57292a', '#753a36', '#8f5146');                      // rug madder red
const RC = ramp('#4c4631', '#6b6345', '#8a815c', '#a69d75');                      // rug ochre pattern
const BS = ramp('#5a4318', '#86662a', '#b28c3f', '#d6b25c', '#f0d68a');           // lamp brass
const F = (h) => ({ c: hex(h), flat: true });                                     // unshaded decal colour

// ---------------- Helpers ----------------
// Paints a w x h picture on the south face of the slab at voxel row y: fn(i, j) -> decal or null (j down).
function picture(g, x0, zTop, w, h, fn, y = 0) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(i, j); if (c) g.decal('s', x0 + i, y, zTop - j, c); } }
// Wall-hung props: remove the floor shadow voxel.cjs drops and cast a soft two-tier one on the wall.
function wallShadow(c) {
  for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i][3] < 255) c.px[i] = null;
  const snap = c.px.slice(), solid = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && snap[y * c.w + x];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y - 1) || solid(x - 2, y - 1) || solid(x - 1, y - 2)) c.px[y * c.w + x] = [20, 23, 15, 96];
    else if (solid(x - 2, y - 2) || solid(x - 3, y - 2) || solid(x - 2, y - 3)) c.px[y * c.w + x] = [20, 23, 15, 50];
  }
}
const hung = { overlay: wallShadow, margin: 10 };
// Recipe space for wall props: y = 0 is the wall face (the south edge of the wall row), z raised by dz.
const WALL_Y = 16;
function onWall(g, dz = 0) {
  const Y = WALL_Y;
  return {
    box: (x0, y0, z0, x1, y1, z1, m) => g.box(x0, y0 + Y, z0 + dz, x1, y1 + Y, z1 + dz, m),
    shape: (x0, y0, z0, x1, y1, z1, fn, m) => g.shape(x0, y0 + Y, z0 + dz, x1, y1 + Y, z1 + dz, (x, y, z) => fn(x, y - Y, z - dz), m),
    decal: (f, x, y, z, c) => g.decal(f, x, y + Y, z + dz, c),
    line: (x0, y0, z0, x1, y1, z1, m, r) => g.line(x0, y0 + Y, z0 + dz, x1, y1 + Y, z1 + dz, m, r)
  };
}
// Brass drawing pin (one lit pixel, one shaded) at the top of a sheet.
const pin = (g, x, z) => { g.decal('s', x, 0, z, F('#f0d47c')); g.decal('s', x + 1, 0, z, F('#a07a2a')); };
const wallpaper = mat((x, y, z, f) => {
  if (f === 'u') return TP[1];                                                   // cut-away top of the wall
  const u = ix(f === 's' || f === 'n' ? x : y), s = ((u % 8) + 8) % 8;
  const damp = fbm(u * .05, z * .08, 77) > .7 && z > 40;                          // damp bloom under the roof
  if (s === 0 || s === 1) return cl(WS, 2 + (damp ? -1 : 0) + (ix(z) % 6 === 0 ? 1 : 0));
  if (s === 4 && ix(z) % 6 === 3) return cl(WS, 3);                               // little sprig motif
  return cl(WP, 3 + (damp ? -1 : 0) + (hash(u, ix(z), 5) < .06 ? -1 : 0));
});
const wainscot = mat((x, y, z, f) => {
  if (f === 'u') return TP[1];
  const u = ix(f === 's' || f === 'n' ? x : y), s = ((u % 6) + 6) % 6;
  if (ix(z) < 2) return WD[1];                                                    // skirting board
  return cl(WD, 3 + (s === 0 ? -2 : s === 1 ? 1 : 0) + (hash(ix(u / 6), 2, 9) < .3 ? -1 : 0) + (hash(u, ix(z), 6) < .05 ? -1 : 0));
});
const iron = flat(TP[2]), ironLit = flat(TP[4]), brass = flat(BS[3]);
const ticking = mat((x, y, z, f) => cl(TK, 3 + (ix(x) % 4 === 0 ? -2 : 0)));
const sheet = mat((x, y, z, f) => cl(TK, 4 + (fbm(x * .3, y * .3, 3) > .62 ? -1 : 0)));
const plaid = (R, lineA, lineB, seed) => mat((x, y, z, f) => {
  const u = ix(x), v = ix(f === 'u' ? y : z), a = ((u % 8) + 8) % 8, b = ((v % 8) + 8) % 8;
  if (lineA && (a === 0 || b === 0)) return lineA;
  if (lineB && (a === 3 || b === 3)) return lineB;
  return cl(R, 2 + (a < 3 && b < 3 ? -1 : 0) + (fbm(x * .25, y * .25, seed) > .64 ? 1 : 0));
});

// ======================= Walls =======================

// VL-2 attic gable end. Signature: the pentagon outline of a room under the roof, with the tarred
// purlins following the slope. History: damp bloom under the roof, a strip of paper peeled off the
// boards, scuffed skirting. 12 x 1, face 48 px at the eaves rising to 72 px at the ridge.
const gableH = x => 48 + 24 * (1 - Math.abs(x - 96) / 96);
def('bld_dorm_wall', 'World', [12, 1], 78, g => {
  g.shape(0, 0, 0, 192, 16, 76, (x, y, z) => z <= gableH(x) ? (z < 17 ? wainscot : wallpaper) : null);
  g.shape(0, 14, 16, 192, 17, 19, () => true, flat(WD[2]));                                  // dado rail
  g.shape(0, 14, 40, 192, 17, 76, (x, y, z) => { const h = gableH(x); return z <= h && z > h - 3.2; }, flat(TP[2]));   // purlins along the roof slope
  g.box(94, 14, 40, 98, 17, 72, woodPost);                                                    // king post under the ridge
  g.shape(150, 15, 26, 160, 16, 40, (x, y, z) => fbm(x * .3, z * .3, 12) > .5, planks(WD, 4, 4));   // paper peeled back to the boards
  for (const x of [22, 70, 122, 170]) g.box(x, 15, 17, x + 1, 16, gableH(x) - 3, flat(WP[1]));        // seams between paper drops
}, { margin: 4 });

// Side wall seen from above: the cut top and the board end. 1 x 8, 48 px tall like the gable eaves.
def('bld_dorm_wall_side', 'World', [1, 8], 50, g => {
  g.box(0, 0, 0, 16, 128, 17, wainscot); g.box(0, 0, 17, 16, 128, 48, wallpaper);
  g.box(0, 0, 47, 16, 128, 48, flat(TP[1]));
  g.box(0, 0, 47, 2, 128, 48, flat(TP[3])); g.box(14, 0, 47, 16, 128, 48, flat(TP[2]));        // lit / shaded arris of the cut
  for (let y = 15; y < 128; y += 32) g.box(2, y, 47, 14, y + 1, 48, flat(TP[0]));               // stud ends
  g.box(0, 126, 16, 16, 128, 19, flat(WD[2]));
}, { margin: 4 });

// ======================= Window =======================

// Attic casement in the gable (the way out onto the roof), 34 px up the wall, no deep sill. Frame 0 closed: dark panes holding the
// lamp's reflection. Frame 1 open: both leaves folded back, the May night and the neighbour roof.
def('prop_dorm_window', 'World', [2, 1], 66, (g0, ctx) => {
  const g = onWall(g0, 6);
  const open = ctx.frame === 1, white = flat(WH[3]), shade = flat(WH[1]);
  g.box(1, 0, 22, 31, 1, 56, white);                                                          // frame slab on the wall
  g.box(0, 0, 20, 32, 3, 22, flat(WD[3])); g.box(0, 2, 20, 32, 3, 21, flat(WD[1]));           // narrow sill, flush under the frame
  g.box(0, 0, 56, 32, 2, 58, flat(WD[2]));                                                    // head
  picture(g, 3, 54, 26, 31, (i, j) => {
    const mull = i === 12 || i === 13, bar = j === 15;
    if (!open) {
      if (mull || bar) return F('#cfd2c8');
      const refl = Math.hypot(i - 19, j - 22);                                                // the oil lamp, mirrored in the glass
      if (refl < 1.5) return F('#fbc64a'); if (refl < 3.2) return F('#7a5a2c');
      return F((i - j + 40) % 11 < 2 ? '#28405a' : j < 3 ? '#0e1622' : '#141f30');
    }
    if (i < 4 || i > 21) return (i === 3 || i === 22) ? F('#7f8986') : F(j % 8 === 0 ? '#a9b0a9' : '#cfd2c8');   // leaves folded back against the reveals
    if (j > 26) return F(j === 27 ? '#553135' : (i + j) % 4 === 0 ? '#24161a' : '#3a2226');      // roof tiles just outside
    const star = hash(i, j, 44) < .05;
    return F(star ? '#b9c8d4' : j > 20 ? '#213457' : j > 10 ? '#172644' : '#101b33');
  });
  if (open) { g.box(1, 1, 22, 4, 9, 54, shade); g.box(28, 1, 22, 31, 9, 54, shade); }           // the open leaves stand out into the room
  g.box(15, 0, 36, 17, 2, 39, brass);                                                          // espagnolette handle
  g.box(6, 1, 22, 11, 3, 25, flat(RD[2])); g.box(7, 1, 25, 10, 3, 28, flat(PAL.GR[3]));        // geranium pot on the sill
}, { frames: 2, fps: 1, animated: true, ...hung });

// ======================= Beds =======================

// Iron hospital-pattern bedstead: head at the north, tubular rails, brass knobs, ticking mattress.
function bedstead(g) {
  for (const x of [2, 28]) { g.box(x, 2, 0, x + 2, 4, 25, iron); g.box(x, 2, 25, x + 2, 4, 27, brass); g.box(x, 44, 0, x + 2, 46, 16, iron); g.box(x, 44, 16, x + 2, 46, 18, brass); }
  g.box(2, 2, 23, 30, 4, 25, ironLit); g.box(2, 2, 12, 30, 4, 13, iron);
  for (let x = 6; x < 28; x += 4) g.box(x, 2, 13, x + 1, 4, 23, iron);
  g.box(2, 44, 14, 30, 46, 16, ironLit);
  for (let x = 6; x < 28; x += 4) g.box(x, 44, 7, x + 1, 46, 14, iron);
  g.box(3, 4, 5, 29, 44, 7, flat(TP[1]));                                                     // side rails and springs
  g.box(4, 4, 7, 28, 44, 11, ticking);
}
// Jonas: the bed of someone who gets up fast. Rust plaid thrown back in a diagonal, pillow knocked
// askew, cadet jacket hung on the head post, boots kicked half under the foot.
def('prop_dorm_bed_jonas', 'World', [2, 3], 30, g => {
  bedstead(g);
  g.box(4, 4, 11, 28, 44, 12, sheet);
  g.shape(6, 5, 12, 22, 15, 15, (x, y, z) => ((x - 14 - (y - 10) * .3) / 8) ** 2 + ((y - 10) / 5) ** 2 + ((z - 12) / 3) ** 2 <= 1 && !(Math.hypot(x - 13, y - 10) < 2.5 && z > 13), sheet);   // dented pillow
  const pl = plaid(BJ, BJ[0], CR[1], 21);
  g.shape(4, 14, 12, 28, 44, 16, (x, y, z) => y > 17 + (x - 4) * .55 && z < 13 + fbm(x * .3, y * .3, 8) * 2.4, pl);            // blanket, thrown back
  g.shape(12, 14, 13, 28, 30, 17, (x, y, z) => { const d = y - (17 + (x - 4) * .55); return d > 0 && d < 6 && z < 15.5; }, flat(BJ[1]));   // the folded-back lip (underside)
  g.shape(26, 20, 5, 31, 44, 12, (x, y, z) => z < 12 - (x - 26) * 1.2, pl);                                                    // blanket sliding off the side
  g.box(-1, 2, 9, 4, 6, 25, flat(CD[2])); g.box(-1, 5, 9, 4, 6, 25, flat(CD[1])); g.box(0, 2, 23, 3, 6, 26, flat(CD[3])); g.box(1, 6, 14, 2, 7, 22, flat(CD[0]));   // jacket on the post
  g.box(8, 46, 0, 12, 50, 6, flat(TP[1])); g.box(8, 49, 0, 12, 52, 3, flat(TP[2])); g.box(15, 45, 0, 21, 48, 3, flat(TP[1])); g.box(19, 45, 0, 21, 48, 5, flat(TP[2]));   // boots, one fallen
}, { margin: 6 });
// Daan: made square. Issue blanket pulled tight with the sheet turned down, wool cap on the pillow,
// slippers side by side.
def('prop_dorm_bed_daan', 'World', [2, 3], 30, g => {
  bedstead(g);
  g.box(4, 4, 11, 28, 44, 12, sheet);
  g.box(7, 5, 12, 25, 14, 15, sheet); g.box(7, 13, 12, 25, 14, 15, flat(TK[2]));
  g.box(4, 16, 12, 28, 44, 13, mat((x, y) => cl(BD, 2 + (ix(y) === 38 || ix(y) === 40 ? 2 : 0) + (fbm(x * .2, y * .2, 4) > .66 ? 1 : 0))));
  g.box(4, 16, 12, 28, 20, 14, sheet); g.box(4, 19, 12, 28, 20, 14, flat(TK[2]));                                               // sheet turned down
  g.ell(16, 9, 16, 4.5, 3.5, 2.2, mat((x, y, z) => cl(RD, 2 + (ix(x) & 1 ? 0 : -1)))); g.box(12, 11, 15, 20, 13, 16, flat(RD[1]));   // wool cap, cuff toward us
  g.box(10, 47, 0, 14, 51, 2, flat(WD[2])); g.box(17, 47, 0, 21, 51, 2, flat(WD[2])); g.box(10, 47, 2, 14, 49, 3, flat(WD[1])); g.box(17, 47, 2, 21, 49, 3, flat(WD[1]));   // slippers
}, { margin: 6 });

// ======================= Desk, chair, trunk, rug =======================

// Shared study table. Signature: the burning oil lamp (flame + breathing glow, 4 frames @6) over
// the exam diagram: figure of eight, the glide circle and the white landing cloth. Ink ring, a
// candle-burn, books left open by two different people.
const LAMP = [37, 10, 14];
def('prop_dorm_desk', 'World', [3, 2], 30, g => {
  g.box(2, 4, 12, 46, 27, 14, planks(WD, 3, 4)); g.box(2, 26, 12, 46, 27, 14, flat(WD[1]));
  for (const [x, y] of [[3, 5], [43, 5], [3, 24], [43, 24]]) g.box(x, y, 0, x + 2, y + 2, 12, woodPost);
  g.box(5, 25, 8, 43, 26, 12, flat(WD[2])); g.box(18, 26, 9, 30, 27, 11, flat(WD[1])); g.box(23, 27, 10, 25, 28, 11, brass);   // apron, drawer, pull
  // The exam diagram, weighted with an ink bottle.
  g.box(6, 8, 14, 28, 23, 14.6, flat(CR[3]));
  g.topPaint(6, 8, 28, 23, (x, y) => {
    const i = x - 6, j = y - 8;
    const e8 = Math.abs(Math.hypot(i - 6.5, j - 5) - 3.4) < .6 || Math.abs(Math.hypot(i - 13.5, j - 5) - 3.4) < .6;   // figure of eight
    const glide = Math.abs(Math.hypot(i - 13, j - 11.5) - 2.6) < .55;                                               // 150 yard circle
    if (Math.abs(i - 13) < 1 && Math.abs(j - 11.5) < 1) return flat(WH[4]);                                         // the white cloth
    if (e8) return flat(NV[2]); if (glide) return flat(RD[2]);
    if (j > 3 && j < 12 && Math.abs(i - 19 - (11 - j) * .2) < .5) return flat(NV[3]);                                // glide path arrow
    return i < 1 || j < 1 ? flat(CR[2]) : null;
  });
  g.cylZ(8, 21, 1.6, 14.6, 17.5, flat(NV[1])); g.set(8, 21, 17.5, flat(TP[1]));
  g.line(22, 20, 14.8, 29, 23, 14.8, flat(GD[2])); g.set(29, 23, 14.8, flat(TP[1]));                                 // the pencil Jonas uses as a stick
  // Daan's side: books squared up, mug. Jonas's side: one book face down.
  g.box(38, 17, 14, 45, 25, 16, flat(RD[1])); g.box(38, 17, 16, 45, 25, 17.5, flat(NV[2])); g.box(38, 24, 14, 45, 25, 17.5, flat(CR[2]));
  g.cylZ(32, 22, 1.8, 14, 17, flat(WH[3])); g.set(32, 22, 16, flat(WD[1]));
  g.shape(11, 3, 14, 20, 8, 16, (x, y, z) => z < 14.6 + (1 - Math.abs(x - 15.5) / 4.5) * 1.4, flat(OLIVE));
  // Oil lamp: brass font and burner, glass chimney (flame and glow are the overlay).
  const [lx, ly, lz] = LAMP;
  g.cylZ(lx, ly, 3.2, lz, lz + 2, flat(BS[2])); g.cylZ(lx, ly, 2.4, lz + 2, lz + 4, flat(BS[3])); g.cylZ(lx, ly, 1.4, lz + 4, lz + 5, flat(BS[1]));
  g.cylZ(lx, ly, 2.2, lz + 5, lz + 10, glow(hex('#f6d98a'))); g.cylZ(lx, ly, 1.3, lz + 10, lz + 14, glow(hex('#cdbb86')));
  g.box(lx + 3, ly, lz + 3, lx + 5, ly + 1, lz + 4, flat(BS[1]));                                                   // wick wheel
}, {
  frames: 4, fps: 6, margin: 6,
  overlay(c, project, f) {
    const [sx, sy] = project(LAMP[0], LAMP[1], LAMP[2] + 8), pulse = [0, 1, 0, -1][f], lean = [0, 0, 1, 0][f];
    // Halo: breathes one pixel; warm light on the table top around the lamp.
    for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) {
      const d = Math.hypot(x, y * 1.15), r = 11 + pulse;
      if (d < r) c.paint(sx + x, sy + y + 2, [242, 182, 90, Math.round(72 * (1 - d / r) ** 1.4)]);
    }
    // Flame: white core, yellow body, orange tip that leans and stretches.
    c.put(sx, sy + 1, FI[4]); c.put(sx, sy, FI[4]); c.put(sx - 1, sy + 1, FI[3]); c.put(sx + 1, sy + 1, FI[3]);
    c.put(sx, sy - 1, FI[3]); c.put(sx + lean, sy - 2, FI[3]); c.put(sx + lean, sy - 3, FI[2]);
    if (pulse > 0) c.put(sx + lean, sy - 4, FI[2]); if (pulse < 0) c.put(sx - 1, sy, FI[2]);
  }
});
const OLIVE = PAL.OL[2];

// Bentwood school chair, back to the north.
def('prop_dorm_chair', 'World', [1, 1], 22, g => {
  for (const [x, y] of [[3, 4], [11, 4], [3, 11], [11, 11]]) g.box(x, y, 0, x + 2, y + 2, 8, woodPost);
  g.box(3, 4, 8, 13, 13, 10, planks(WD, 3, 3)); g.box(3, 12, 8, 13, 13, 10, flat(WD[1]));
  g.box(3, 4, 10, 5, 6, 20, woodPost); g.box(11, 4, 10, 13, 6, 20, woodPost);
  g.box(3, 4, 17, 13, 6, 20, flat(WD[3])); g.box(5, 4, 12, 11, 5, 14, flat(WD[2]));
  g.box(4, 12, 3, 12, 13, 4, flat(WD[1]));
}, { margin: 4 });

// Cadet's travelling trunk: tarred canvas over pine, wooden battens, tin corners, leather strap.
def('prop_dorm_trunk', 'World', [2, 1], 14, g => {
  const body = mat((x, y, z, f) => cl(NV, 2 + (fbm(x * .2, (f === 'u' ? y : z) * .3, 14) > .62 ? 1 : 0) + (f !== 'u' && ix(z) === 8 ? -2 : 0)));
  g.box(2, 3, 0, 30, 14, 11, body);
  for (const x of [8, 22]) { g.box(x, 3, 0, x + 2, 14.4, 11.4, flat(WD[3])); }
  for (const [x, y] of [[2, 3], [28, 3], [2, 12], [28, 12]]) { g.box(x, y, 0, x + 2, y + 2, 2, flat(ST[3])); g.box(x, y, 9, x + 2, y + 2, 11, flat(ST[3])); }
  g.box(15, 3, 0, 17, 14.6, 11.6, flat(WD[1])); g.box(15, 14, 5, 17, 15, 7, brass);                                   // strap and buckle
  g.box(4, 14, 5, 6, 15, 6, flat(ST[1])); g.box(26, 14, 5, 28, 15, 6, flat(ST[1]));                                  // handles
  g.box(23, 5, 11, 28, 9, 11.6, flat(CR[2])); g.set(24, 6, 11.6, flat(RD[2]));                                       // steamer label, half scraped off
}, { margin: 4 });

// Worn rug between the beds: madder field, ochre border and lozenges, bare threads where feet land.
def('prop_dorm_rug', 'World', [3, 2], 3, g => {
  g.box(1, 2, 0, 47, 30, 1, mat((x, y) => {
    const e = Math.min(x - 1, 46 - x, y - 2, 29 - y), worn = fbm(x * .12, y * .12, 31) > .66;
    if (worn && e > 3) return CL_WORN;
    if (e >= 2 && e < 4) return RC[2];
    if (e >= 5 && e < 6) return RC[1];
    const u = Math.abs(((x + 2) % 12) - 6) + Math.abs(((y + 4) % 12) - 6);
    return u < 2 ? RC[3] : u === 4 ? RC[1] : cl(RG, 2 + (hash(ix(x), ix(y), 3) < .12 ? -1 : 0));
  }));
  for (let y = 3; y < 30; y += 2) { g.set(0, y, 0, flat(RC[3])); g.set(47, y, 0, flat(RC[2])); }                     // fringe
}, { margin: 3 });
const CL_WORN = WD[3];

// ======================= Jonas's wall =======================

// Mail-route chart to the islands: coast, three islands, the Amelsand run in red with a pin at every leg.
// Drawn on a 28 x 22 grid, shown 28 x 18 so it fits between 27 px and the purlin at the eaves.
const MAP_J = j => j === 17 ? 21 : Math.round(j * 21 / 17), MAP_Z = j => 44 - Math.round(j * 17 / 21);
def('prop_wall_mailmap', 'World', [2, 1], 52, g0 => {
  const g = onWall(g0);
  g.box(2, 0, 27, 30, 1, 45, flat(CR[2]));
  picture(g, 2, 44, 28, 18, (i, jj) => {
    const j = MAP_J(jj);
    if (i === 0 || j === 0 || i === 27 || j === 21) return F(j === 21 || i === 27 ? '#b3aa86' : '#f3edd6');
    const coast = 15 + Math.sin(i * .5) * 1.6 + i * .12;                                       // mainland along the bottom
    if (j > coast) return F(j - coast < 1.2 ? '#7f785a' : (i + j) % 5 === 0 ? '#b9b07f' : '#cdc392');
    for (const [cx, cy, rx, ry] of [[7, 5, 3.2, 1.6], [15, 4, 2.6, 1.4], [23, 6, 3, 1.5]]) { const d = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2; if (d < 1) return F(d > .6 ? '#7f785a' : '#cdc392'); }
    for (const [ax, ay, bx, by] of [[4, 15, 7, 6], [7, 6, 15, 5], [15, 5, 23, 7]]) { const t = ((i - ax) * (bx - ax) + (j - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2); if (t >= 0 && t <= 1 && Math.hypot(i - ax - (bx - ax) * t, j - ay - (by - ay) * t) < .6) return F('#c25a3d'); }
    return F((i * 3 + j * 5) % 11 === 0 ? '#8fb0b8' : '#a9c4c8');                               // shoal-green sea
  });
  for (const [i, j] of [[4, 15], [7, 6], [15, 5], [23, 7]]) { g.decal('s', 2 + i, 0, MAP_Z(j), F('#fff3c4')); g.decal('s', 2 + i, 0, MAP_Z(j) + 1, F('#963826')); }   // pins
  g.decal('s', 28, 0, 28, F('#7f785a')); g.decal('s', 29, 0, 28, F('#7f785a')); g.decal('s', 29, 0, 29, F('#7f785a'));                                         // curled corner
}, hung);

// Uncle Floris by his mail plane: small print, white border, one pin.
def('prop_photo_floris', 'World', [1, 1], 46, g0 => {
  const g = onWall(g0);
  g.box(3, 0, 30, 13, 1, 43, flat(CR[3]));
  picture(g, 4, 41, 8, 10, (i, j) => {
    if (j < 5) return F(j === 2 && i > 2 ? '#5b4126' : j === 3 && i > 3 ? '#80603b' : '#c9ab7c');   // sky, the wing over him
    if (i >= 2 && i <= 3 && j >= 3 && j <= 4) return F('#3a2817');
    if (j > 7) return F('#80603b');
    if (i >= 1 && i <= 4) return F(j === 5 && (i === 2 || i === 3) ? '#e6d1a6' : i === 1 || i === 4 ? '#3a2817' : '#5b4126');   // the man: face, coat
    return F(i > 5 && j === 6 ? '#3a2817' : '#a68558');
  });
  pin(g, 7, 43);
  g.decal('s', 12, 0, 30, F('#b3aa86'));
}, hung);

// The last handkerchief he dropped, still knotted, hung on a nail.
def('prop_handkerchief_nail', 'World', [1, 1], 46, g0 => {
  const g = onWall(g0);
  g.box(7, 0, 42, 9, 2, 43, flat(ST[3]));                                                       // the nail
  g.shape(4, 0, 30, 12, 3, 42, (x, y, z) => ((x - 8) / (3.6 - (z - 30) * .08)) ** 2 + ((y - 1) / 1.6) ** 2 + ((z - 34.5) / 4.6) ** 2 <= 1, flat(TK[3]));   // the bundle
  g.box(7, 0, 39, 9, 2, 42, flat(TK[4])); g.box(5, 0, 40, 7, 1, 43, flat(TK[3])); g.box(9, 0, 40, 11, 1, 43, flat(TK[2]));                              // knot and its two ears
  for (const [x, z] of [[5, 34], [6, 32], [8, 31], [10, 32], [11, 34], [6, 37], [10, 37]]) g.decal('s', x, 2, z, F('#6883a0'));                          // faded blue border
  g.decal('s', 8, 2, 35, F('#93907f')); g.decal('s', 7, 2, 34, F('#b6b3a0'));
}, hung);

// Floris's sketchbook open on a little bracket shelf: a glider tail in pencil, his slanting notes.
def('prop_sketchbook_floris', 'World', [1, 1], 50, g0 => {
  const g = onWall(g0, 6);
  g.box(2, 0, 27, 14, 5, 28, flat(WD[3])); g.box(2, 4, 27, 14, 5, 28, flat(WD[1]));
  g.shape(3, 0, 22, 5, 4, 27, (x, y, z) => y < (z - 22) * .8 + .5, flat(WD[1])); g.shape(11, 0, 22, 13, 4, 27, (x, y, z) => y < (z - 22) * .8 + .5, flat(WD[1]));
  g.box(3, 0, 28, 13, 1, 39, flat(CR[3])); g.box(3, 1, 28, 13, 2, 29, flat(RD[1]));              // the open book and its cloth cover
  picture(g, 3, 38, 10, 10, (i, j) => {
    if (i === 5) return F('#b3aa86');                                                           // gutter
    if (i < 5) { if (j === 6 - i || (j === 7 && i > 0) || (i === 3 && j > 2 && j < 7)) return F('#5d686d'); return F('#f3edd6'); }   // tail fin and rudder post
    return F(j % 2 === 1 && i - Math.floor(j / 4) > 5 && i < 9 ? '#7f8d93' : '#ece6cf');           // lines of slanted writing
  });
  g.line(6, 3, 28, 12, 4, 28, flat(GD[2]));                                                     // pencil stub
}, hung);

// ======================= Daan's wall =======================

// Airline poster (fictional Noordzee Lucht Lijn), 1930s: sunburst, silver airliner climbing, "LONDON".
// 24 x 20 on the wall between 28 px and the purlin.
def('prop_poster_airline', 'World', [2, 1], 52, g0 => {
  const g = onWall(g0);
  g.box(4, 0, 28, 28, 1, 48, flat(CR[2]));
  const london = textRows('LONDON');
  picture(g, 4, 47, 24, 20, (i, j) => {
    if (i === 0 || i === 23 || j === 0 || j === 19) return F('#ddd4b0');
    if (j >= 13) {                                                                              // navy foot with the lettering
      const r = j - 14, ch = r >= 0 && r < 5 ? london[r][i - 1] : null;
      return F(ch === '#' ? '#f3edd6' : '#28405a');
    }
    if (Math.abs(j - 6 + (i - 12) * .25) < 1.1 && i > 4 && i < 20) return F(j < 6 ? '#eef3f0' : '#a9b6b8');   // fuselage climbing right
    if (i >= 9 && i <= 14 && Math.abs(j - 7 - (i - 12) * .9) < 1.2) return F('#cfd8d6');                       // wing
    if (i >= 5 && i <= 6 && j >= 5 && j <= 7) return F('#c25a3d');                                             // tail flash
    const a = Math.atan2(j - 13, i - 12);
    return F(Math.floor((a + 3.2) * 5) % 2 ? '#f0d47c' : '#e9b65a');                                           // sunburst
  });
  pin(g, 15, 47);
  g.decal('s', 4, 0, 29, F('#8a7a4c')); g.decal('s', 5, 0, 29, F('#b3aa86')); g.decal('s', 26, 0, 38, F('#b3aa86')); g.decal('s', 27, 0, 39, F('#b3aa86'));   // torn corner, tear
}, hung);

// The English notebook on the apple crate by Daan's bed, alarm clock beside it. The notebook is
// the object of the whole game: red cloth, spine rubbed pale, a pencil shut in it.
def('prop_notebook_english', 'World', [1, 1], 16, g => {
  const slat = mat((x, y, z, f) => f === 'u' ? cl(WD, 3 + (ix(y) % 4 === 0 ? -2 : 0)) : cl(WD, 3 + (ix(z) % 4 === 3 ? -2 : 0) + (hash(ix(x), ix(z), 4) < .08 ? -1 : 0)));
  g.box(2, 3, 0, 14, 14, 9, slat);
  for (const x of [2, 13]) g.box(x, 13, 0, x + 1, 14.4, 9, flat(WD[1]));
  g.box(4, 14, 4, 12, 14.4, 6, flat(WD[1]));                                                    // hand hole, shadowed
  g.box(4, 6, 9, 11, 12, 11, flat(RD[2])); g.box(4, 6, 9, 5, 12, 11, flat(RD[4])); g.box(5, 11, 9, 11, 12, 10.4, flat(CR[3]));   // notebook: rubbed spine, page edge
  g.box(6, 8, 11, 10, 9, 11.4, flat(CR[2]));                                                    // paper label
  g.line(9, 12, 10, 12, 13, 10, flat(GD[2]));                                                   // pencil
  g.cylZ(11.5, 5.5, 1.8, 9, 12, flat(BS[2])); g.box(10.5, 6.8, 9.5, 12.5, 7.4, 11.5, flat(CR[3])); g.set(11.5, 5.5, 12, brass);   // alarm clock
}, { margin: 4 });

// His mother's letter (wear your warm things), pinned over its envelope.
def('prop_letter_daan_mother', 'World', [1, 1], 46, g0 => {
  const g = onWall(g0);
  g.box(3, 0, 28, 10, 1, 34, flat(NV[4])); g.decal('s', 8, 0, 32, F('#963826')); g.decal('s', 8, 0, 31, F('#c25a3d'));    // envelope with its stamp
  g.box(5, 0, 30, 13, 1, 43, flat(CR[3]));
  picture(g, 5, 42, 8, 12, (i, j) => {
    if (j === 6) return F('#ddd4b0');                                                           // fold
    if (j > 0 && j < 11 && j % 2 === 1 && i > 0 && i < 7 - (j === 9 ? 3 : (j * 3) % 2)) return F('#566a77');   // rounded careful handwriting
    return F(i === 7 || j === 11 ? '#ddd4b0' : '#f3edd6');
  });
  pin(g, 8, 43);
}, hung);

module.exports = {};

'use strict';
// M1 part 1 close-ups, lit by the desk oil lamp (warm, from the lower right):
//   cut_m1_floris_photo      (m1.P1.04) uncle Floris laughing beside his mail plane, and the back of the print
//   cut_m1_handkerchief_note (m1.P1.05) the old handkerchief opened on Jonas's blanket with Floris's last note
// Floris's handwriting leans to the right (script slant .32).
const { textRows } = require('../voxel.cjs');
const {
  SW, TALL, crop, Canvas, hash, fbm, tone, clamp, lerp, smooth, capsule, softShadow, grain, tube,
  SEPIA, PAPER, LINEN, LINEN_B, INK, PLAID, PLAID_L, YSKIN, WARM, WALLW
} = require('./common.cjs');
const { layout, ink, shade } = require('./script.cjs');

const FLORIS = { scale: 11, slant: .32, wobble: .2, seed: 9 };
function writeCentred(c, text, cx, y, colours, opts = FLORIS) {
  const L = layout(text, opts), ox = Math.round(cx - L.width / 2);
  for (const p of shade(ink(L.strokes, ox, y).pixels)) c.put(p.x, p.y, p.edge || hash(p.x, p.y, 3) < .1 ? colours[1] : colours[0]);
}
// Lamp falloff over the whole picture (0..1), brightest lower right.
const lamp = (x, y) => clamp(1.08 - Math.hypot(x - 440, y - 330) / 560);

// ---------------------------------------------------------------- the photograph (value painting)
// The picture is painted as light values (0 black .. 1 white) and printed through the sepia ramp
// with film grain, so it reads as one old print rather than as coloured shapes.
const PW = 172, PH = 216;
function florisImage() {
  const V = new Float32Array(PW * PH);
  const set = (x, y, v) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < PW && y < PH) V[y * PW + x] = v; };
  const get = (x, y) => V[Math.floor(y) * PW + Math.floor(x)];
  const each = fn => { for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const v = fn(x, y, V[y * PW + x]); if (v !== undefined) V[y * PW + x] = v; } };
  const line = (x0, y0, x1, y1, w, v) => each((x, y) => capsule(x + .5, y + .5, x0, y0, x1, y1, w) < 0 ? (typeof v === 'function' ? v(x, y) : v) : undefined);
  // Sky with soft summer cloud, low dunes on the horizon, the grass strip of Amelsand.
  each((x, y) => {
    if (y < 148) return .8 - y / 148 * .1 + (fbm(x * .03, y * .07, 5) - .5) * .16;
    if (y < 152) return .5 + (fbm(x * .2, 1, 6) - .5) * .2;
    return .52 - (y - 152) / 64 * .16 + (fbm(x * .3, y * .5, 7) - .5) * .14 + (hash(x, y, 8) < .04 ? .12 : 0);
  });
  each((x, y) => y > 138 && y < 149 && y > 148 - 9 * fbm(x * .05, 2, 9) ? .58 : undefined);
  // --- the mail biplane, nose to the left, behind him
  const wingTop = x => 34 - (x - 52) * 12 / 120;
  each((x, y) => { const t = wingTop(x); if (x >= 52 && y >= t && y < t + 10) return y < t + 2 ? .9 : (x % 9 === 0 ? .36 : .46 - (y - t) * .012); });   // upper wing: lit edge, ribbed underside
  each((x, y) => { const t = 119 - (x - 96) * 5 / 76; if (x >= 96 && y >= t && y < t + 8) return y < t + 2 ? .86 : .44; });                                // lower wing
  for (const [ax, ay, bx, by] of [[150, 30, 153, 114], [124, 34, 128, 116]]) line(ax, ay, bx, by, 1.6, .26);                                           // interplane struts
  for (const [ax, ay, bx, by] of [[126, 37, 151, 113], [151, 31, 127, 115]]) line(ax, ay, bx, by, .55, .38);                                           // bracing wires
  each((x, y) => { if (x < 116) return; const t = 77 + (x - 116) * .04, b = 117 - (x - 116) * .13; if (y >= t && y <= b) { const k = (y - t) / (b - t); return (y - t < 1.5 ? .86 : .68 - k * .22) - ((x - 116) % 11 === 0 ? .06 : 0); } });   // doped fabric fuselage
  each((x, y) => x >= 148 && x < 168 && y >= 72 && y < 80 ? (y < 74 ? .3 : .16) : undefined);                                                           // cockpit rim
  line(146, 78, 150, 68, 1, .9);                                                                                                                        // windscreen glint
  textRows('POST', 2).forEach((row, r) => [...row].forEach((ch, k) => { if (ch === '#') set(136 + k, 86 + r, .2); }));
  each((x, y) => { const d = Math.hypot(x - 112, y - 97); if (d < 21) { const a = Math.atan2(y - 97, x - 112); return d > 18 ? .3 : d < 6 ? .22 : Math.cos(a * 7) > .2 ? .5 - d * .008 : .2; } }); // radial engine
  line(113, 116, 106, 148, 1.5, .3); line(126, 116, 109, 150, 1.2, .3);                                                                                 // undercarriage
  each((x, y) => { const d = Math.hypot(x - 106, y - 152); if (d < 12) return d < 4 ? .6 : d > 9.5 ? .12 : .2; });                                      // wheel
  each((x, y, v) => ((x - 128) / 44) ** 2 + ((y - 166) / 5) ** 2 < 1 ? v - .16 : undefined);                                                            // ground shadow
  line(104, 46, 104, 148, 3.2, (x, y) => x < 103 ? .5 : .24);                                                                                           // propeller blade, stopped upright
  each((x, y) => Math.hypot(x - 104, y - 97) < 5.5 ? (x < 103 && y < 96 ? .8 : .42) : undefined);                                                       // spinner
  // --- uncle Floris, knees up, close to the lens: leather flying coat, fleece collar, white scarf
  const cx = 62;
  each((x, y) => {
    if (y < 114) return;
    const hw = 31 + (y - 114) * .08 - (y < 130 ? Math.pow((130 - y) / 16, 1.6) * 15 : 0);   // sloping shoulders
    if (Math.abs(x + .5 - cx) > hw) return;
    const u = (x + .5 - cx) / hw;
    let v = .2 - u * .07 + (fbm(x * .09, y * .05, 21) - .5) * .12 + (Math.sin(y * .35 + u * 4) > .8 && y > 140 ? -.05 : 0);
    if (u < -.55 && u > -.82) v += .13;                                               // sheen down the lit sleeve
    if (Math.abs(u) > .93) v = .1;
    if (Math.abs(x - cx - 1) < 1 && y > 140) v = .09;                                 // front closure
    if (y >= 178 && y < 185) v = Math.abs(x - cx - 1) < 5 ? .7 : .1;                  // belt and buckle
    if ((y === 150 || y === 165) && Math.abs(x - cx - 5) < 1.5) v = .5;               // buttons
    return v;
  });
  // His left arm (screen right) up, hand resting on the propeller blade.
  line(88, 124, 99, 141, 7, (x, y) => .2 + (x < 92 ? .08 : 0)); line(99, 141, 101, 121, 5.5, (x, y) => .22 + (x < 99 ? .08 : 0));
  each((x, y) => Math.hypot(x - 101, y - 116) < 5.2 ? (x < 100 ? .82 : .66) : undefined);
  for (const fy of [113, 116, 119]) line(101, fy, 107, fy, .7, .56);
  // Fleece collar and scarf.
  each((x, y) => { for (const s of [-1, 1]) { const lx = (x + .5 - cx) * s; if (y >= 108 && y < 142 && lx > 2 + (y - 108) * .12 && lx < 20 - (y - 122) * (y > 122 ? .9 : 0)) return (s < 0 ? .84 : .7) + (hash(x >> 1, y >> 1, 23) - .5) * .2; } });
  each((x, y) => y >= 104 && y < 118 && Math.abs(x + .5 - cx) < 9 - (y > 112 ? (y - 112) * 1.2 : 0) ? .93 - (x > cx + 2 ? .12 : 0) - (y === 110 ? .12 : 0) : undefined);
  each((x, y) => y >= 116 && y < 141 && Math.abs(x + .5 - cx) <= 2.5 + (y - 108) * .12 - (y > 134 ? (y - 134) * .9 : 0) ? .9 - (x > cx ? .1 : 0) - ((y + x) % 6 === 0 ? .1 : 0) : undefined);   // scarf tucked into the coat
  // Head: a lit volume (key from the upper left): forehead, cheekbones, a narrower jaw.
  const hx = cx, hy = 84;
  each((x, y) => {
    const jaw = Math.max(0, y + .5 - hy - 5) * .42, dx = (x + .5 - hx) / (15.5 - jaw), dy = (y + .5 - hy) / (y < hy ? 18 : 20.5);
    const r2 = dx * dx + dy * dy;
    if (r2 > 1) return;
    const nz = Math.sqrt(1 - r2);
    let v = .44 + .44 * Math.max(0, -dx * .55 - dy * .3 + nz * .78);
    if (r2 > .84) v -= .1;                                                                  // turning edge
    return v;
  });
  // Leather flying helmet with ear flaps, goggles pushed up on the forehead.
  each((x, y) => {
    const dx = (x + .5 - hx) / 17.5, dy = (y + .5 - (hy - 3)) / 20;
    const crown = dx * dx + dy * dy <= 1 && y < 77, flap = Math.abs(x + .5 - hx) > 12.5 && Math.abs(x + .5 - hx) < 17.5 - Math.max(0, y - 90) * .5 && y >= 77 && y < 99;
    if (!crown && !flap) return;
    return .2 + (dx < -.3 && dy < -.5 ? .14 : 0) + (x === hx || x === hx - 9 || x === hx + 9 ? .08 : 0) - (dx > .5 ? .06 : 0);
  });
  for (const gx of [hx - 8, hx + 8]) each((x, y) => { const d = Math.hypot((x + .5 - gx) / 7.4, (y + .5 - 69) / 5.4); if (d <= 1) return d > .72 ? .1 : (x - gx) - (y - 69) < -3 ? .95 : (x - gx) + (y - 69) > 3 ? .42 : .6; });
  each((x, y) => y === 69 && (Math.abs(x - hx) < 2 || Math.abs(x - hx) > 14) && Math.abs(x - hx) < 18 ? .08 : undefined);
  line(hx + 15, 97, hx + 18, 110, .8, .16);                                            // chin strap hanging loose
  // Face. He is laughing straight at whoever holds the camera: eyes squeezed into arcs by the
  // cheeks, brows up, mouth open on the upper teeth. Light from the upper left, so the right side
  // of every form (sockets, nose, folds) is the shaded one.
  const F = (x, y, v) => set(hx + x, y, v), Fd = (x, y, k) => { const v = get(hx + x, y); set(hx + x, y, v + k); };
  for (const s of [-1, 1]) {
    const ex = s * 6.5;
    for (let y = 79; y <= 86; y++) for (let x = -5; x <= 5; x++) if ((x / 4.6) ** 2 + ((y - 82.4) / 3) ** 2 < 1) Fd(Math.round(ex + x), y, s > 0 ? -.12 : -.05);   // eye sockets
    for (let k = -3; k <= 3; k++) F(Math.round(ex + k), 78 - (Math.abs(k) < 2 ? 1 : 0) + (k * s > 2 ? 1 : 0), .2);      // brows lifted, outer ends down
    for (let k = -3; k <= 3; k++) F(Math.round(ex + k), 83 - (Math.abs(k) < 2 ? 1 : 0), .12);                         // the closed laughing eye: an arc
    F(Math.round(ex - s), 83, .5);
    for (let k = -3; k <= 3; k++) Fd(Math.round(ex + k), 85, s < 0 ? .1 : .04);                                       // cheek pushed up under the eye
    F(Math.round(ex + s * 4.5), 84, .4); F(Math.round(ex + s * 5), 85, .44);                                          // crow's feet
  }
  for (const [x, y, k] of [[-10, 88, .08], [-9, 89, .1], [-8, 90, .08], [-9, 90, .06], [-10, 89, .06]]) Fd(x, y, k);      // lit cheekbone
  for (let y = 82; y <= 89; y++) { F(-1, y, .76); F(2, y, .4); }                                                        // nose: lit bridge, shaded flank
  F(0, 89, .86); F(-1, 90, .7); F(-2, 91, .3); F(2, 91, .26); F(1, 92, .34); F(2, 92, .32); F(3, 92, .38);              // tip, nostrils, its shadow
  for (let k = 0; k < 5; k++) { F(-4 - Math.round(k * .7), 92 + k, .5); F(4 + Math.round(k * .7), 92 + k, .34); }        // smile folds
  for (let x = -8; x <= 8; x++) F(x, 95 - (Math.abs(x) > 6 ? 1 : 0), .24);                                             // upper lip, corners lifted
  for (let x = -6; x <= 6; x++) F(x, 96, x % 3 === 0 ? .8 : .94);                                                       // upper teeth
  for (let x = -5; x <= 5; x++) F(x, 97, .13); for (let x = -4; x <= 4; x++) F(x, 98, .16);                              // open mouth
  F(-8, 94, .12); F(8, 94, .12); F(-7, 96, .2); F(7, 96, .2);                                                           // deep corners
  for (let x = -4; x <= 4; x++) F(x, 99, x < 0 ? .66 : .54); F(-1, 99, .8);                                             // lower lip, lit on the left
  for (let x = -3; x <= 3; x++) F(x, 100, .4);
  for (let x = -3; x <= 2; x++) F(x, 103, .7); for (let x = -4; x <= 4; x++) F(x, 105, .36);                            // chin and its underside
  // Print: vignette, grain, dust specks, one long scratch, a light leak on the left edge.
  each((x, y, v) => v - Math.pow(Math.hypot((x - PW / 2) / PW, (y - PH / 2) / PH), 2.2) * .5 + (hash(x, y, 31) - .5) * .06 + (x < 10 ? (10 - x) * .012 : 0));
  line(24, 8, 33, 70, .5, .96); for (let k = 0; k < 26; k++) set(hash(k, 1, 33) * PW, hash(k, 2, 33) * PH, .97);
  return { V, get };
}

// Aged card: tone map over a rectangle with darker toning to the edges, foxing and a worn rim.
function card(c, x0, y0, x1, y1, base, seed, fn) {
  softShadow(c, (x, y) => x >= x0 + 4 && x < x1 + 5 && y >= y0 + 5 && y < y1 + 6, 96, 44, 3);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    if (e === 0 && hash(x, y, seed) < .18) continue;                                    // nibbled edge
    let L = base - Math.max(0, 9 - e) * .012 + (fbm(x * .05, y * .05, seed) - .5) * .12;
    if (fbm(x * .22, y * .22, seed + 1) > .74) L -= .13;                                // foxing
    const o = fn && fn(x, y, e);
    if (o) { c.put(x, y, o); continue; }
    c.put(x, y, e === 0 ? PAPER[1] : tone(PAPER, L * (.8 + .26 * lamp(x, y)), x, y));
  }
}

function florisPhoto() {
  const c = new Canvas(SW, TALL);
  // Board wall of the dormitory, vertical planks.
  c.fill((x, y) => tone(WALLW, .16 + lamp(x, y) * .62 + grain(y, x, 38, 77) * .06, x, y, .8));
  for (const [nx, ny] of [[19, 40], [19, 250], [57, 150], [247, 290], [461, 96]]) { c.put(nx, ny, WALLW[0]); c.put(nx + 1, ny, WALLW[0]); c.put(nx, ny + 1, WALLW[1]); c.put(nx - 1, ny - 1, WALLW[4]); }   // nail heads
  // Front of the print.
  const fx = 28, fy = 22, img = florisImage();
  card(c, fx, fy, fx + 190, fy + 250, .86, 41, (x, y, e) => {
    const ix = x - fx - 9, iy = y - fy - 9;
    if (ix < -1 || iy < -1 || ix > PW || iy > PH) return null;
    if (ix < 0 || iy < 0 || ix >= PW || iy >= PH) return PAPER[2];                       // pressed edge of the image
    return tone(SEPIA, img.get(ix, iy) * (.84 + .22 * lamp(x, y)), x, y, .9);
  });
  // A crease across the lower left corner and a curled corner showing the back.
  for (let k = 0; k < 46; k++) { const x = fx + 2 + k, y = fy + 206 + k; if (y < fy + 249) { c.put(x, y, PAPER[5]); c.put(x, y + 1, SEPIA[2]); } }
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15 - y; x++) c.put(fx + 189 - x, fy + 249 - y, x + y > 12 ? PAPER[1] : x + y > 10 ? PAPER[4] : null);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13 - y; x++) c.put(fx + 189 - 14 + x + y, fy + 249 - 14 + y - x + 13 - 13, undefined);
  // Brass drawing pin through the top margin.
  const pin = (px, py) => { softShadow(c, (x, y) => Math.hypot(x - px - 3, y - py - 3) < 3.5, 80, 30, 1); for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.hypot(x, y); if (d <= 3.4) c.put(px + x, py + y, d > 2.6 ? WARM[0] : x + y < -2 ? WARM[5] : x + y > 2 ? WARM[1] : WARM[3]); } };
  pin(fx + 95, fy + 5);
  // Back of the same print, turned over beside it.
  const bx = 250, by = 30;
  card(c, bx, by, bx + 190, by + 250, .76, 43, (x, y, e) => {
    const ring = Math.hypot((x - bx - 150) / 30, (y - by - 208) / 22);
    if (ring > .88 && ring < 1 && fbm(x * .2, y * .2, 45) > .35) return tone(PAPER, .5 * (.8 + .26 * lamp(x, y)), x, y);   // cup ring
    if (e === 9 && (x + y) % 3) return tone(PAPER, .66 * (.8 + .26 * lamp(x, y)), x, y);                                  // ghost of the plate mark
    return null;
  });
  for (const [gx, gy] of [[bx + 8, by + 8], [bx + 170, by + 8], [bx + 8, by + 228], [bx + 170, by + 228]]) for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (fbm((gx + x) * .3, (gy + y) * .3, 47) > .42) c.put(gx + x, gy + y, tone(PAPER, .52, gx + x, gy + y));   // old album glue
  c.put(bx + 95, by + 6, SEPIA[2]); c.put(bx + 96, by + 6, SEPIA[1]); c.put(bx + 95, by + 7, SEPIA[3]); c.put(bx + 94, by + 5, PAPER[1]);   // the pin hole, rust-ringed
  writeCentred(c, 'F. Hartveld,', bx + 95, by + 92, [INK[0], INK[2]]);
  writeCentred(c, 'tuyến Amelsand,', bx + 95, by + 130, [INK[0], INK[2]]);
  writeCentred(c, '1935', bx + 95, by + 168, [INK[0], INK[2]]);
  return crop(c);
}

// ---------------------------------------------------------------- the handkerchief and the note
function handkerchiefNote() {
  const c = new Canvas(SW, TALL);
  // Jonas's wool blanket: rust plaid with soft folds.
  c.fill((x, y) => {
    const fold = Math.sin((x * .6 + y) * .028 + fbm(x * .01, y * .01, 81) * 5) * .09;
    let L = .2 + lamp(x, y) * .5 + fold + (hash(x, y, 82) - .5) * .05;
    const u = (x + Math.round(fold * 30) + 400) % 64, v = (y + 400) % 64;
    const lineA = u < 3 || v < 3, lineB = (u >= 10 && u < 12) || (v >= 10 && v < 12);
    if (lineA) return tone(PLAID_L, L * .7 + (((x + y) & 1) ? .1 : 0), x, y);
    if (lineB) return tone(PLAID_L, L * 1.25, x, y);
    if (u < 22 && v < 22) L *= .78;
    return tone(PLAID, L + (((x >> 1) + (y >> 1)) & 1 ? .03 : -.02), x, y);
  });
  // The handkerchief: a washed linen square that has lived knotted for years, so it never lies flat.
  const X0 = 92, Y0 = 20, X1 = 388, Y1 = 270;
  const edgeIn = (x, y) => {
    const wob = (fbm(x * .04, y * .04, 85) - .5) * 14;
    return Math.min(x - X0 + wob - Math.abs(y - 145) * .035, X1 - x + wob * .6 - Math.abs(y - 145) * .03, y - Y0 + wob * .7 - Math.abs(x - 240) * .03, Y1 - y - wob * .5 - Math.abs(x - 240) * .035);
  };
  softShadow(c, (x, y) => edgeIn(x - 5, y - 6) > 0 && edgeIn(x, y) <= 0, 92, 40, 3);
  // Creases: the cross of the old folds, plus rays out of the corners that were tied.
  const crease = (x, y) => {
    let k = 0;
    k += Math.exp(-Math.abs(x - 238 - Math.sin(y * .05) * 3) / 1.6) * .16 + Math.exp(-Math.abs(y - 150 - Math.sin(x * .04) * 3) / 1.6) * .16;
    for (const [qx, qy] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) { const d = Math.hypot(x - qx, y - qy), a = Math.atan2(y - qy, x - qx); if (d < 95) k += Math.sin(a * 14 + d * .05) * .12 * (1 - d / 95); }
    return k;
  };
  for (let y = 0; y < TALL; y++) for (let x = 0; x < SW; x++) {
    const e = edgeIn(x, y);
    if (e <= 0) continue;
    let L = .5 + lamp(x, y) * .42 + (fbm(x * .03, y * .03, 87) - .5) * .2 - crease(x, y) + (((x + y) & 1) ? .012 : -.012);
    if (fbm(x * .05 + 9, y * .05, 88) > .7 && x > 250 && y > 170) L -= .08;                 // an old tea stain
    if (e < 1.5) { c.put(x, y, LINEN[0]); continue; }
    if (e < 4) L -= .1;                                                                    // rolled hem
    const band = (e >= 14 && e < 17) || (e >= 20 && e < 26) || (e >= 29 && e < 31);
    c.put(x, y, band && hash(x, y, 89) > .12 ? tone(LINEN_B, L * 1.05 - .12, x, y) : tone(LINEN, L, x, y));
  }
  // The note: a strip torn from a pilot's pad, kept rolled inside the knot, so it still curls.
  const nx0 = 128, ny0 = 96, nx1 = 352, ny1 = 196;
  softShadow(c, (x, y) => x >= nx0 + 3 && x < nx1 + 4 && y >= ny0 + 4 && y < ny1 + 5, 86, 40, 2);
  for (let y = ny0; y < ny1; y++) for (let x = nx0; x < nx1; x++) {
    const tear = 2.5 + (fbm(y * .35, 3, 91) - .5) * 5;
    if (x - nx0 < tear) continue;                                                          // torn left edge
    const v = (y - ny0) / (ny1 - ny0), e = Math.min(x - nx0 - tear, nx1 - 1 - x, y - ny0, ny1 - 1 - y);
    let L = .66 + lamp(x, y) * .3 + Math.sin(v * Math.PI) * .1 - (v < .1 ? (.1 - v) * 2.2 : 0) - (v > .9 ? (v - .9) * 1.6 : 0);   // curl: lit belly, shaded ends
    L -= Math.exp(-Math.abs(x - 203) / 1.2) * .1 + Math.exp(-Math.abs(x - 279) / 1.2) * .1;                                      // roll marks
    L += (fbm(x * .06, y * .06, 92) - .5) * .1;
    c.put(x, y, e < 1 ? PAPER[1] : (y - ny0) % 14 === 11 && x > nx0 + 10 ? tone(PAPER, L - .1, x, y) : tone(PAPER, L, x, y));     // faint ruled lines
  }
  const pencil = [[38, 36, 44, 255], [96, 92, 96, 255]];
  writeCentred(c, 'Lần sau chú cho', 240, 136, pencil);
  writeCentred(c, 'cháu cầm lái. — F.', 240, 177, pencil);
  // Jonas's thumbs holding the cloth open, cadet cuffs at the picture edge.
  const CUFF = [[25, 34, 46, 255], [41, 55, 72, 255], [60, 78, 98, 255], [84, 104, 125, 255], [112, 132, 150, 255]];
  for (const s of [-1, 1]) {
    const bx = 240 + s * 176, tx = 240 + s * 112;
    softShadow(c, (x, y) => capsule(x - 4, y - 4, bx, 318, tx, 244, 15) < 0, 80, 36, 2);
    tube(c, bx + s * 26, 330, bx + s * 4, 286, 34, 30, CUFF, (x, y) => .3 + lamp(x, y) * .5, { k: .5 });
    tube(c, bx, 318, tx, 244, 16, 12.5, YSKIN, (x, y) => .42 + lamp(x, y) * .5, { k: .4 });
    const nxp = tx + s * 5, nyp = 250;                                                     // thumbnail
    for (let y = -8; y <= 8; y++) for (let x = -7; x <= 7; x++) if ((x / 6.5) ** 2 + (y / 8) ** 2 <= 1) { const px = Math.round(nxp + x - s * y * .5), py = nyp + y; c.put(px, py, (x / 6.5) ** 2 + (y / 8) ** 2 > .72 ? YSKIN[2] : y < -4 ? YSKIN[5] : x * -s > 2 ? YSKIN[4] : YSKIN[5]); }
    for (const k of [0, 1]) c.line(tx + s * 26 + k, 276, tx + s * 20 + k, 284, YSKIN[1]);   // knuckle crease
  }
  return crop(c);
}

module.exports = { florisPhoto, handkerchiefNote, lamp };

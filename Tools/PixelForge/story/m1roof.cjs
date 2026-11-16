'use strict';
// M1 part 1, the dormitory roof (m1.P1.12-P1.16):
//   vista_m1_roof           night view from the pantile roof: Jonas and Daan on their backs, moon,
//                           the school water tower, the grass airfield, trainer no. 7, Brandhaven on the horizon
//   fx_village_lights       overlay: the village lamps twinkling (last time a whole village is lit)
//   fx_bomber_stream_night  overlay: blocks of bomber shadows crossing the moonlit sky, 3 depths
// Painted on a 480x300 canvas and cropped to rows 15..285 (480x270). Hotspot contract on the 270
// picture (px): water_tower (300,44,60,90), airfield_grass (120,116,150,46), plane_seven (200,98,60,36).
const {
  SW, TALL, crop, Canvas, hash, fbm, tone, clamp, lerp, smooth, capsule, softShadow, tube,
  NIGHT, MOON, FIELD, ROOF, SIL, WARM, YSKIN
} = require('./common.cjs');

const HORIZON = 120, EAVE = 196, MOONX = 118, MOONY = 44, MOONR = 15;
const R = (...h) => h.map(s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255]);
const STEEL = R('#0b111c', '#141d2c', '#22304a', '#3a4d6b', '#6a82a0', '#a9bccd');       // moonlit tank steel
const WING = R('#1c2636', '#33435a', '#566b84', '#8da2b6', '#c5d2d8');                    // doped fabric under the moon
const SHIRT = R('#141c2a', '#243247', '#3b4d66', '#5b7089', '#8499ad');                   // Jonas: cadet shirt
const TROUS = R('#0a0d14', '#141923', '#212938', '#323d50');
const KNIT = R('#1d1a1c', '#35302e', '#544c45', '#7a7062', '#a09683');                    // Daan: oatmeal jumper
const CAP = R('#200d0f', '#3a1618', '#5a2422', '#7d3a33');                                // Daan: wool cap
const STRAW = R('#3a3020', '#6b5a34', '#a08c52', '#cdbb7a');                              // Jonas: straw hair
const BRICK = R('#120b0c', '#20120f', '#341c17', '#4c2a21', '#683d2f');

// Village: house silhouettes on the horizon [x, width, height, kind] and their lamps.
const HOUSES = [];
{
  let x = 6;
  for (let k = 0; x < 196; k++) { const w = 7 + Math.floor(hash(k, 1, 51) * 8), h = 5 + Math.floor(hash(k, 2, 51) * 6); HOUSES.push([x, w, h, k === 4 ? 'church' : k === 9 ? 'mill' : 'house']); x += w + Math.floor(hash(k, 3, 51) * 5) - 1; }
  x = 372;
  for (let k = 20; x < 474; k++) { const w = 7 + Math.floor(hash(k, 1, 51) * 8), h = 5 + Math.floor(hash(k, 2, 51) * 6); HOUSES.push([x, w, h, 'house']); x += w + Math.floor(hash(k, 3, 51) * 6) - 1; }
}
const LIGHTS = [];
HOUSES.forEach(([x, w, h, kind], i) => {
  if (kind === 'mill') return;
  const n = kind === 'church' ? 2 : 1 + (hash(i, 4, 51) < .45 ? 1 : 0);
  for (let k = 0; k < n; k++) LIGHTS.push({ x: x + 1 + Math.floor(hash(i, 5 + k, 51) * (w - 3)), y: HORIZON - 2 - Math.floor(hash(i, 8 + k, 51) * Math.max(1, h - 4)), ph: hash(i, 11 + k, 51), per: [1, 2, 3, 4][(i + k) % 4], street: false });
});
for (const x of [30, 78, 132, 176, 392, 428, 458]) LIGHTS.push({ x, y: HORIZON - 1, ph: hash(x, 1, 52), per: 2, street: true });
LIGHTS.push({ x: 446, y: HORIZON + 3, ph: .3, per: 1, street: true });                       // hangar lamp on the field edge

function vista() {
  const c = new Canvas(SW, TALL), sky = new Uint8Array(SW * TALL);
  // ---- sky: deep above, hazy toward the horizon, halo round the moon, thin lit cloud
  for (let y = 0; y < HORIZON; y++) for (let x = 0; x < SW; x++) {
    const d = Math.hypot(x - MOONX, y - MOONY);
    let L = .1 + .42 * Math.pow(y / HORIZON, 1.7) + .5 * Math.exp(-d / 34) + .12 * Math.exp(-d / 120);
    const cl = fbm(x * .012 + 3, y * .06, 11);
    if (cl > .56) L += (cl - .56) * 1.1 * (.5 + Math.exp(-d / 110));
    let col = tone(NIGHT, L, x, y, .9);
    if (d > 30 && hash(x, y, 13) < .0032 && cl < .56) col = hash(x, y, 14) < .3 ? MOON[2] : NIGHT[8];   // stars
    c.put(x, y, col); sky[y * SW + x] = 1;
  }
  for (let y = -MOONR; y <= MOONR; y++) for (let x = -MOONR; x <= MOONR; x++) {
    const d = Math.hypot(x + .5, y + .5);
    if (d > MOONR) continue;
    const mare = fbm((x + 20) * .16, (y + 20) * .16, 17) > .58;
    c.put(MOONX + x, MOONY + y, d > MOONR - 1.2 ? MOON[2] : mare ? MOON[1] : x + y < -6 ? MOON[4] : MOON[3]);
  }
  // ---- horizon: tree line, Brandhaven (church spire, mill), dark windows the overlay lights up
  for (let x = 0; x < SW; x++) { const h = 2 + Math.floor(fbm(x * .09, 1, 19) * 5); for (let y = HORIZON - h; y < HORIZON + 1; y++) { c.put(x, y, SIL[1]); sky[y * SW + x] = 0; } }
  const block = (x0, y0, x1, y1, col) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { c.put(x, y, col); if (y < HORIZON) sky[y * SW + x] = 0; } };
  for (const [x, w, h, kind] of HOUSES) {
    block(x, HORIZON - h, x + w, HORIZON + 1, SIL[2]);
    for (let k = 0; k < Math.ceil(w / 2); k++) block(x + k, HORIZON - h - 1 - k, x + w - k, HORIZON - h - k, k === 0 ? SIL[3] : SIL[2]);   // gable roof, moon on the eave
    block(x, HORIZON - h, x + 1, HORIZON, SIL[3]);
    if (kind === 'church') { block(x + 2, HORIZON - h - 16, x + 6, HORIZON - h, SIL[2]); block(x + 2, HORIZON - h - 16, x + 3, HORIZON - h, SIL[3]); for (let k = 0; k < 8; k++) block(x + 4 - Math.ceil((8 - k) / 4), HORIZON - h - 17 - k, x + 4 + Math.ceil((8 - k) / 4), HORIZON - h - 16 - k, SIL[2]); }
    if (kind === 'mill') { block(x + 2, HORIZON - h - 8, x + 6, HORIZON - h, SIL[2]); for (let k = -9; k <= 9; k++) { block(x + 4 + k, HORIZON - h - 9 + Math.round(k * .7), x + 5 + k, HORIZON - h - 8 + Math.round(k * .7), SIL[2]); block(x + 4 + Math.round(k * .7), HORIZON - h - 9 - k, x + 5 + Math.round(k * .7), HORIZON - h - 8 - k, SIL[2]); } }
  }
  for (const l of LIGHTS) if (!l.street) c.put(l.x, l.y, [58, 44, 30, 255]);
  // ---- the canal (frogs) and the grass airfield under the moon
  for (let y = HORIZON + 1; y < EAVE; y++) for (let x = 0; x < SW; x++) {
    const v = (y - HORIZON) / (EAVE - HORIZON);
    if (y < HORIZON + 6 && x < 214 - (y - HORIZON) * 5) {   // canal
      const glit = Math.abs(x - MOONX) < 9 - (y - HORIZON) && hash(x, y, 23) < .6;
      c.put(x, y, glit ? MOON[1 + (hash(x, y, 24) < .4 ? 1 : 0)] : tone(NIGHT, .3 + (hash(x >> 2, y, 25) < .2 ? .12 : 0), x, y));
      continue;
    }
    const stripe = Math.floor((x - 240) / (10 + v * 34) + 40) % 2;                             // mown strips fanning toward us
    let L = .34 + v * .22 + (stripe ? .05 : -.03) + (fbm(x * .05, y * .12, 27) - .5) * .2 + .2 * Math.exp(-Math.hypot((x - 150) / 110, (y - 135) / 26));
    if (hash(x, y, 28) < .02) L += .14;
    c.put(x, y, tone(FIELD, L, x, y, .9));
  }
  // Hangar of the school at the far edge of the field (right), windsock mast.
  for (let x = 398; x < 470; x++) { const h = Math.round(10 * Math.sqrt(Math.max(0, 1 - ((x - 434) / 36) ** 2))); for (let y = HORIZON + 4 - h; y < HORIZON + 5; y++) { c.put(x, y, y === HORIZON + 4 - h ? SIL[4] : x < 404 ? SIL[3] : SIL[2]); if (y < HORIZON) sky[y * SW + x] = 0; } }
  block(284, HORIZON - 14, 285, HORIZON + 6, SIL[3]); for (let k = 0; k < 7; k++) block(285 + k, HORIZON - 14 + (k > 3 ? 1 : 0), 286 + k, HORIZON - 11 - (k > 4 ? 1 : 0), k % 3 === 1 ? MOON[1] : [150, 84, 50, 255]);
  // ---- trainer no. 7, parked on the grass, moon on its upper wing (painted, then set 4 px lower)
  const p = new Canvas(SW, TALL);
  softShadow(p, (x, y) => ((x - 236) / 27) ** 2 + ((y - 141) / 4.5) ** 2 < 1, 90, 40, 2);
  tube(p, 240, 113, 227, 141, 2.6, 4.2, WING, .5, { k: .6 });                                   // fuselage, nose toward us
  for (let y = 112; y < 117; y++) for (let x = 231; x < 250; x++) p.put(x, y, y === 112 ? WING[4] : WING[2]);   // tailplane
  for (let y = 105; y < 115; y++) for (let x = 239; x < 243; x++) if (y > 105 + (242 - x)) p.put(x, y, x === 239 ? WING[3] : WING[1]);   // fin
  for (let y = 130; y < 136; y++) for (let x = 207; x < 257; x++) p.put(x, y, y === 130 ? WING[3] : WING[1]);   // lower wing
  for (const sx of [212, 224, 240, 252]) for (let y = 127; y < 131; y++) p.put(sx, y, WING[0]);                  // struts
  for (let y = 119; y < 128; y++) for (let x = 203; x < 259; x++) p.put(x, y, y === 119 ? WING[4] : y === 127 ? WING[1] : x < 206 || x > 255 ? WING[2] : WING[3]);   // upper wing
  ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'].forEach((row, r) => [...row].forEach((b, k) => { if (b === '#') p.put(245 + k, 120 + r, WING[0]); }));
  for (let x = 213; x < 219; x++) for (let y = 121; y < 126; y++) { const d = Math.hypot(x - 215.5, y - 123.5); if (d < 2.6) p.put(x, y, d < 1.2 ? MOON[3] : [164, 92, 52, 255]); }   // Velmark roundel
  // Nose: the radial engine almost head-on (ring cowling lit on top, cylinder heads, dark centre),
  // the two-blade propeller stopped across it, moonlight on one blade tip.
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x);
    if (d > 5.6) continue;
    p.put(227 + x, 142 + y, d > 4.5 ? (y < -1 || x < -2 ? STEEL[4] : STEEL[1]) : d < 1.5 ? STEEL[3] : Math.cos(a * 7) > .2 ? STEEL[2] : STEEL[0]);
  }
  for (let k = -10; k <= 10; k++) { const x = 227 + k, y = 142 - Math.round(k * .45); if (Math.abs(k) > 1) { p.put(x, y, Math.abs(k) > 8 ? MOON[k < 0 ? 2 : 1] : STEEL[k < 0 ? 3 : 1]); p.put(x, y + 1, STEEL[0]); } }
  p.put(227, 142, MOON[2]); p.put(223, 147, STEEL[3]); p.put(224, 148, STEEL[2]);                                        // spinner glint, exhaust stub
  for (const wx of [220, 233]) { p.put(wx, 143, STEEL[2]); for (let y = 144; y < 147; y++) for (let x = wx - 1; x < wx + 2; x++) p.put(x, y, STEEL[0]); }
  c.blit(p, 0, 4, true);
  // ---- the school water tower: riveted tank on four braced legs, ladder up the near leg
  const TX = 330;
  softShadow(c, (x, y) => x > TX + 6 && x < TX + 52 && Math.abs(y - 149 - (x - TX) * .06) < 2.5, 80, 34, 2);
  for (let y = 98; y < 149; y++) { const s = (y - 98) / 51; for (const [x0, lit] of [[TX - 15 - s * 7, 1], [TX + 13 + s * 7, 0], [TX - 5 - s * 2, 0], [TX + 4 + s * 2, 0]]) { c.put(Math.round(x0), y, STEEL[lit ? 4 : 2]); c.put(Math.round(x0) + 1, y, STEEL[1]); if (y < HORIZON) { sky[y * SW + Math.round(x0)] = 0; sky[y * SW + Math.round(x0) + 1] = 0; } } }
  for (const [ya, yb] of [[100, 116], [116, 132], [132, 147]]) { const sa = (ya - 98) / 51, sb = (yb - 98) / 51; c.line(TX - 15 - sa * 7, ya, TX + 14 + sb * 7, yb, STEEL[2]); c.line(TX + 14 + sa * 7, ya, TX - 15 - sb * 7, yb, STEEL[1]); c.line(TX - 15 - sb * 7, yb, TX + 14 + sb * 7, yb, STEEL[3]); }
  for (let y = 98; y < 149; y++) { c.put(TX - 1, y, STEEL[1]); c.put(TX, y, STEEL[3]); }               // riser pipe
  for (let y = 100; y < 148; y += 2) { const s = (y - 98) / 51, x0 = Math.round(TX - 20 - s * 7); c.put(x0, y, STEEL[4]); c.put(x0 + 1, y, STEEL[3]); c.put(x0 + 2, y, STEEL[4]); }   // ladder rungs
  for (let y = 62; y < 99; y++) for (let x = TX - 20; x < TX + 20; x++) {
    const u = (x + .5 - TX) / 19;
    let col = null;
    if (y < 72) { if (Math.abs(u) < (y - 61) / 10.5) col = tone(STEEL, .46 - u * .5 + (y === 71 ? .2 : 0), x, y); }      // conical roof
    else if (Math.abs(u) < 1) col = y === 72 || y === 85 || y === 97 ? STEEL[u < -.3 ? 4 : 1] : tone(STEEL, .16 + .8 * Math.pow(Math.max(0, .5 - u * .62), 1.6) + (fbm(x * .3, y * .2, 31) - .5) * .12 - (y > 86 && x % 7 === 3 ? .1 : 0), x, y, .9);
    if (col) { c.put(x, y, Math.abs(u) > .93 && y >= 72 ? STEEL[0] : col); if (y < HORIZON) sky[y * SW + x] = 0; }
  }
  c.put(TX, 60, STEEL[4]); c.put(TX, 61, STEEL[3]); sky[60 * SW + TX] = 0; sky[61 * SW + TX] = 0;
  for (let y = 88; y < 97; y++) { c.put(TX + 6, y, [62, 38, 26, 255]); if (y > 91) c.put(TX + 7, y, [46, 30, 24, 255]); }   // rust streak under the overflow
  // ---- the roof we lie on: gutter, clay pantiles, moss, the dormer we climbed out of, a chimney
  const dormerGlow = (x, y) => y > 240 ? 0 : Math.exp(-(((x - 46) / 40) ** 2 + ((y - 236) / 22) ** 2));
  for (let y = EAVE; y < TALL; y++) for (let x = 0; x < SW; x++) {
    if (y < EAVE + 4) { c.put(x, y, y === EAVE ? STEEL[3] : y === EAVE + 1 ? STEEL[1] : y === EAVE + 3 ? STEEL[0] : x % 46 === 9 ? STEEL[3] : STEEL[2]); continue; }   // zinc gutter with brackets
    const row = Math.floor((y - EAVE - 4) / 9), vy = (y - EAVE - 4) % 9, off = (row % 2) * 5, tx = (x + off) % 10, tile = Math.floor((x + off) / 10);
    let L = .34 + (y - EAVE) / 104 * .12 + (fbm(x * .02, y * .03, 37) - .5) * .16 + (hash(tile, row, 38) - .5) * .13;
    L += tx < 2 ? .16 : tx < 5 ? .05 : tx < 8 ? -.06 : -.2;                                    // S profile: lit hump, dark channel
    if (vy === 8) L -= .22; else if (vy === 0) L += .07;                                       // lap of the row above
    if (hash(tile, row, 39) < .035) L -= .14;                                                  // replaced tile
    const moss = fbm(x * .07, y * .09, 41) + (y < EAVE + 22 ? .12 : 0) + (tx >= 8 ? .08 : 0);
    const g = dormerGlow(x, y);
    const base = moss > .78 ? tone(FIELD, L * .9, x, y) : hash(x, y, 42) < .012 ? ROOF[6] : tone(ROOF, L + g * .25, x, y, .9);
    const m = Math.min(.62, g * .7);                                                            // lamp light from the open window warms the tiles
    c.put(x, y, m > .06 ? [Math.round(lerp(base[0], 242, m)), Math.round(lerp(base[1], 170, m)), Math.round(lerp(base[2], 84, m)), 255] : base);
  }
  // Dormer (seen from behind and above): little tiled gable, lead flashing, open casement throwing light.
  softShadow(c, (x, y) => x >= 86 && x < 100 && y >= 246 && y < TALL, 84, 36, 2);
  for (let y = 238; y < TALL; y++) for (let x = 6; x < 87; x++) {
    const ridge = 46, dx = x - ridge, row = Math.floor((y - 238) / 8), t = (y - 238) % 8, u = (Math.abs(dx) + (row % 2) * 4) % 9;
    let col;
    if (y < 241) col = x < 9 || x > 83 ? BRICK[0] : y === 238 ? WARM[4] : y === 239 ? WARM[2] : BRICK[1];      // barge board; lamp light leaking under it
    else if (Math.abs(dx) < 2) col = dx < 0 ? ROOF[5] : ROOF[2];                                                // ridge tiles
    else if (x < 8 || x > 84) col = STEEL[dx < 0 ? 4 : 1];                                                      // lead flashing
    else col = tone(ROOF, (dx < 0 ? .62 : .22) + (u < 2 ? .1 : u > 6 ? -.12 : 0) - (t === 7 ? .18 : 0) + (hash(Math.floor(Math.abs(dx) / 9), row, 46) - .5) * .1, x, y);
    c.put(x, y, col);
  }
  // Chimney on the right with a pot.
  softShadow(c, (x, y) => x >= 446 && x < 474 && y >= 262 && y < 280, 90, 40, 2);
  for (let y = 214; y < 272; y++) for (let x = 414; x < 446; x++) {
    const top = y < 220, by = (y - 220) % 5, bx = (x + (Math.floor((y - 220) / 5) % 2) * 5) % 10;
    c.put(x, y, x === 414 || x === 445 || y === 271 ? BRICK[0] : top ? (y === 214 ? STEEL[4] : STEEL[2]) : by === 4 || bx === 0 ? BRICK[1] : tone(BRICK, (x < 424 ? .78 : .5) + (hash(Math.floor((x + (Math.floor((y - 220) / 5) % 2) * 5) / 10), Math.floor((y - 220) / 5), 43) - .5) * .3, x, y));
  }
  tube(c, 430, 213, 430, 202, 6, 5, BRICK, .7, { k: .7 });
  // ---- the two of them, on their backs, heads up-slope toward us, feet toward the gutter
  const boy = (hx, hy, P) => {
    softShadow(c, (x, y) => capsule(x - 5, y - 3, hx, hy - 8, hx + P.lean, hy - 62, 11) < 0, 84, 36, 2);
    // legs (toward the eave), ankles crossed or apart
    tube(c, hx - 4, hy - 34, hx - 5 + P.legs[0], hy - 66, 5.4, 4, P.trousers, .55); tube(c, hx + 4, hy - 34, hx + 5 + P.legs[1], hy - 64, 5.4, 4, P.trousers, .46);
    for (const [fx, fy] of [[hx - 5 + P.legs[0], hy - 69], [hx + 5 + P.legs[1], hy - 67]]) tube(c, fx, fy + 2, fx, fy - 3, 3.6, 3, BRICK, .55);   // boots
    tube(c, hx, hy - 10, hx, hy - 36, 10.5, 9, P.top, .6, { k: .5 });                           // chest
    if (P.rib) for (let y = hy - 40; y < hy - 8; y++) for (let x = hx - 11; x <= hx + 11; x++) { const p = c.get(x, y); if (p && P.top.includes(p) && p !== P.top[0] && (x + 100) % 3 === 0) c.put(x, y, P.top[Math.max(1, P.top.indexOf(p) - 1)]); }   // knit ribs
    P.arms(hx, hy);
    // head: crown toward us, face to the sky
    for (let y = -9; y <= 9; y++) for (let x = -8; x <= 8; x++) {
      const d = (x / 8.2) ** 2 + (y / 9.2) ** 2;
      if (d > 1) continue;
      c.put(hx + x, hy + y, d > .8 ? YSKIN[0] : tone(YSKIN, .5 - x * .03 - y * .012, hx + x, hy + y));
    }
    c.put(hx - 3, hy - 3, P.eye); c.put(hx + 3, hy - 3, P.eye); c.put(hx - 3, hy - 4, YSKIN[5]); c.put(hx + 3, hy - 4, YSKIN[4]);   // eyes open on the sky
    c.put(hx, hy - 5, YSKIN[4]); c.put(hx, hy - 6, YSKIN[1]); c.put(hx - 1, hy - 8, YSKIN[1]); c.put(hx, hy - 8, YSKIN[1]);       // nose, mouth (toward the feet)
    P.hair(hx, hy);
  };
  // Jonas: hands laced behind his head, elbows out, ankles crossed. Straw hair.
  boy(206, 269, {
    top: SHIRT, trousers: TROUS, lean: 2, legs: [5, -3], eye: [30, 40, 60, 255],
    arms: (hx, hy) => { for (const s of [-1, 1]) { tube(c, hx + s * 9, hy - 14, hx + s * 19, hy + 1, 4.6, 4.2, SHIRT, s < 0 ? .66 : .5); tube(c, hx + s * 19, hy + 1, hx + s * 8, hy + 7, 4.2, 3.6, SHIRT, s < 0 ? .6 : .46); } },
    hair: (hx, hy) => { for (let y = -1; y <= 11; y++) for (let x = -9; x <= 9; x++) { const d = (x / 9.4) ** 2 + ((y - 2) / 9.6) ** 2; if (d <= 1 && y > -1 + Math.abs(x) * .25 - (x < -2 ? 2 : 0)) c.put(hx + x, hy + y, d > .82 ? STRAW[0] : (x * 2 + y * 3 + 40) % 5 === 0 ? STRAW[1] : x < -1 && y < 7 ? STRAW[3] : STRAW[2]); } }
  });
  // Daan: wool cap pulled down, hands folded on his jumper over the English notebook.
  boy(274, 272, {
    top: KNIT, trousers: TROUS, lean: -1, legs: [-2, 2], rib: true, eye: [40, 28, 20, 255],
    arms: (hx, hy) => {
      for (let y = hy - 29; y < hy - 17; y++) for (let x = hx - 5; x < hx + 6; x++) c.put(x, y, y === hy - 29 || x === hx - 5 || x === hx + 5 || y === hy - 18 ? [44, 14, 12, 255] : x === hx - 4 ? [226, 214, 180, 255] : [140, 54, 38, 255]);   // notebook
      for (const s of [-1, 1]) { tube(c, hx + s * 10, hy - 13, hx + s * 14, hy - 26, 4.6, 4.2, KNIT, s < 0 ? .66 : .5); tube(c, hx + s * 14, hy - 26, hx + s * 3, hy - 22, 4.2, 3.4, KNIT, s < 0 ? .62 : .46); tube(c, hx + s * 3, hy - 22, hx + s * 1, hy - 22, 3, 3, YSKIN, .5); }
    },
    hair: (hx, hy) => { for (let y = -3; y <= 11; y++) for (let x = -10; x <= 10; x++) { const d = (x / 10) ** 2 + ((y - 2) / 9.8) ** 2; if (d <= 1 && y > -3 + Math.abs(x) * .12) c.put(hx + x, hy + y, d > .84 ? CAP[0] : y < 0 ? ((x + 50) % 2 ? CAP[2] : CAP[1]) : (x + y * 2 + 50) % 4 === 0 ? CAP[1] : x < -2 && y < 7 ? CAP[3] : CAP[2]); } c.put(hx, hy + 11, CAP[3]); c.put(hx + 1, hy + 11, CAP[2]); }
  });
  return { canvas: crop(c), sky };
}

// ---------------------------------------------------------------- fx_village_lights
// 24 frames @4 = 6 s loop. Three layers: window/street lamps flickering at their own pace (one
// or two go out and come back), a soft warm halo, and the lamps' shimmer in the canal.
const LIGHT_N = 24;
function villageLights() {
  return Array.from({ length: LIGHT_N }, (_, f) => {
    const c = new Canvas(SW, TALL), T = f / LIGHT_N;
    LIGHTS.forEach((l, i) => {
      let s = .72 + .28 * Math.sin((T * l.per + l.ph) * Math.PI * 2);
      if (hash(i, Math.floor(T * 6 + l.ph * 6) % 6, 57) < .1) s *= .45;                         // a flicker
      if (i % 9 === 4 && ((T + l.ph) % 1) > .7) s = 0;                                          // somebody turns in for the night... and a lamp is relit
      if (s <= 0) return;
      const core = s > .85 ? WARM[5] : s > .6 ? WARM[4] : WARM[3];
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.hypot(x, y); if (d > 0 && d <= (l.street ? 3.2 : 2.3)) c.paint(l.x + x, l.y + y, [242, 182, 90, Math.round((l.street ? 70 : 54) * s * (1 - d / 3.6))]); }
      c.put(l.x, l.y, core);
      if (l.street) c.put(l.x, l.y - 1, [...WARM[4].slice(0, 3), Math.round(190 * s)]);
      if (l.x < 200 && l.y > HORIZON - 8) for (let k = 2; k < 6; k++) if ((k + f + i) % 3) c.put(l.x + ((k + f + i) % 2 ? 0 : 1), HORIZON + k - 1, [242, 182, 90, Math.round(120 * s * (1 - k / 7))]);   // canal shimmer
    });
    return crop(c);
  });
}

// ---------------------------------------------------------------- fx_bomber_stream_night
// 48 frames @8 = 6 s loop, flying right to left (east to west). Three depths, each moving by
// exactly one pattern period per loop so the loop is seamless: far specks (96 px, 2 px/frame),
// middle (192 px, 4 px/frame), near shapes (288 px, 6 px/frame). Only masses of
// shadow: no markings, no detail. Clipped to the open sky of the vista.
const BOMB_N = 48;
const SHAPES = {
  far: ['.#.', '###', '.#.'],
  mid: ['..#...', '..#..#', '######', '..#..#', '..#...'],
  near: ['....#.....', '....#.....', '...##....#', '##########', '...##....#', '....#.....', '....#.....']
};
// One formation block per period: staggered vics, the leader in front (left).
const block = (n, dx, dy) => Array.from({ length: n }, (_, i) => { const r = Math.floor(i / 3), k = i % 3; return [r * dx + (k ? Math.round(dx * .45) : 0), (k === 1 ? -dy : k === 2 ? dy : 0) + (r % 2) * Math.round(dy * .5)]; });
function bomberStream(sky) {
  const layers = [
    { shape: SHAPES.far, period: 96, y: 78, alpha: 110, planes: [...block(12, 9, 5), ...block(9, 9, 5).map(([x, y]) => [x + 52, y - 22])] },
    { shape: SHAPES.mid, period: 192, y: 50, alpha: 165, planes: [...block(9, 17, 9), ...block(6, 17, 9).map(([x, y]) => [x + 100, y + 14])] },
    { shape: SHAPES.near, period: 288, y: 22, alpha: 215, planes: [...block(6, 30, 13), ...block(3, 30, 13).map(([x, y]) => [x + 150, y + 16])] }
  ];
  return Array.from({ length: BOMB_N }, (_, f) => {
    const c = new Canvas(SW, TALL);
    for (const L of layers) {
      const shift = f / BOMB_N * L.period;
      for (let rep = -1; rep <= Math.ceil(SW / L.period); rep++) for (const [bx, by] of L.planes) {
        const ox = Math.round(rep * L.period + bx + SW * .1 - shift), oy = L.y + by;
        L.shape.forEach((row, r) => [...row].forEach((ch, k) => {
          const x = ox + k, y = oy + r;
          if (ch === '#' && x >= 0 && x < SW && y >= 0 && y < TALL && sky[y * SW + x]) c.put(x, y, [5, 8, 15, L.alpha]);
        }));
      }
    }
    return crop(c);
  });
}

module.exports = { vista, villageLights, bomberStream, HORIZON };

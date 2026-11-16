'use strict';
// Characters: Act 0 portraits (portrait.youth) for the two eighteen-year-olds, at the portrait.soft
// standard: warm lamplit backdrop, dithered soft light from the upper left on skin, hair and cloth,
// eyes with iris, pupil and catchlight, warm rim light on the left edges.
//   pilot_young  Jonas: straw hair falling across the forehead in locks, small scar on the chin,
//                a sure half-smile (smirk), open-collared cadet tunic.
//   daan         Daan: wine wool cap down to the brows with a ribbed cuff, softer rounder face,
//                shy closed smile, roll-neck jumper.
const { Canvas, PAL, K, hex } = require('../lib.cjs');
const { CR } = PAL;
const { hl } = require('./body.cjs');

const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bay = (x, y) => (BAY[y & 3][x & 3] + .5) / 16;
const tone = (R, L, x, y, spread = .32) => { const v = L + (bay(x, y) - .5) * spread; return R[v > 1 ? 3 : v > .58 ? 2 : v > .2 ? 1 : 0]; };

function youthPortrait(P, mouthOpen) {
  const pp = P.portrait, c = new Canvas(48, 48), fig = new Canvas(48, 48);
  const sk = P.skin, hr = P.hair, t = P.top, bg = pp.bg, glowC = pp.glow || bg[2], cap = P.hat === 'beanie';
  c.fill((x, y) => {
    const L = 1.05 - Math.hypot(x - 7, y - 5) / 34 - y / 120 + (bay(x, y) - .5) * .28;
    return L > .78 ? glowC : L > .5 ? bg[2] : L > .2 ? bg[1] : bg[0];
  });
  // Shoulders: Jonas narrow and square, Daan rounder under the thick knit.
  for (let y = 37; y < 48; y++) {
    const hw = Math.min(cap ? 22 : 20, (cap ? 12 : 10) + (y - 37) * (cap ? 1.5 : 1.7));
    for (let x = Math.ceil(24 - hw); x < 24 + hw; x++) {
      const u = (x + .5 - 24) / hw, rib = cap && (x % 3 === 0) ? -.22 : 0;
      fig.put(x, y, tone(t, .92 - u * .6 - (y - 37) * .015 + rib, x, y));
    }
  }
  for (let y = 30; y < 41; y++) for (let x = 20; x < 28; x++) fig.put(x, y, tone(sk, .62 - (x - 20) * .08 - (y < 35 ? (35 - y) * .09 : 0), x, y, .16));   // neck
  // Head. Jonas: lean, longer jaw. Daan: fuller cheeks.
  const jaw = cap ? [9, 8.8, 8.4, 7.8, 7, 6, 4.8, 3.4, 2] : [8.6, 8, 7.4, 6.8, 6, 5, 4, 3, 2];
  const hwAt = y => y < 10 ? 0 : y === 10 ? 5 : y === 11 ? 7 : y === 12 ? 8 : y <= 26 ? 9 : jaw[y - 27] || 0;
  for (let y = 10; y <= 35; y++) {
    const hw = hwAt(y);
    for (let x = Math.ceil(24 - hw); x < 24 + hw; x++) {
      const u = (x + .5 - 24) / hw, v = (y - 22) / 13;
      const L = .9 - .6 * u - .2 * v + .25 * Math.exp(-((x - 18.5) ** 2 + (y - 25.5) ** 2) / 9) - (y >= 33 ? .25 : 0) - (!cap && u > .3 && y > 26 ? .05 : 0);
      fig.put(x, y, tone(sk, L, x, y, .14));
    }
  }
  for (let y = 22; y <= 27; y++) { fig.put(14, y, sk[2]); fig.put(33, y, sk[1]); }
  fig.put(14, 24, sk[1]); fig.put(33, 24, sk[0]); fig.put(14, 25, sk[1]);
  if (cap) for (const [x, y] of [[17, 27], [18, 27], [18, 26], [29, 27], [30, 27]]) fig.put(x, y, hex('#d98f76'));   // Daan flushes easily
  // Eyes.
  const catchL = hex('#fff8e8'), irisD = [Math.round(pp.iris[0] * .6), Math.round(pp.iris[1] * .6), Math.round(pp.iris[2] * .6), 255];
  for (const [x0, right] of [[17, false], [26, true]]) {
    hl(fig, x0, x0 + 4, 21, P.eye);
    fig.put(x0, 22, CR[3]); fig.put(x0 + 1, 22, catchL); fig.put(x0 + 2, 22, P.eye); fig.put(x0 + 3, 22, pp.iris); fig.put(x0 + 4, 22, CR[2]);
    fig.put(x0, 23, sk[1]); fig.put(x0 + 1, 23, pp.iris); fig.put(x0 + 2, 23, irisD); fig.put(x0 + 3, 23, pp.iris); fig.put(x0 + 4, 23, sk[1]);
    hl(fig, x0 + 1, x0 + 3, 24, sk[1]);
    if (cap) fig.put(right ? x0 + 4 : x0, 21, sk[1]);                                                    // softer outer corner
  }
  // Brows: Jonas's left one cocked a pixel higher; Daan's slope gently outward (a little worried).
  const brow = pp.smirk ? [[16, 19], [17, 18], [18, 18], [19, 18], [20, 18], [21, 19], [26, 18], [27, 17], [28, 17], [29, 17], [30, 17], [31, 18]]
    : [[16, 19], [17, 19], [18, 18], [19, 18], [20, 18], [21, 18], [26, 18], [27, 18], [28, 18], [29, 18], [30, 19], [31, 19]];
  for (const [x, y] of brow) fig.put(x, y, cap ? hr[1] : hr[0]);
  if (!cap) for (const [x, y] of brow) fig.put(x, y - 1, fig.get(x, y - 1) === undefined ? undefined : sk[2]);
  // Nose.
  for (let y = 23; y <= 26; y++) { fig.put(23, y, sk[3]); fig.put(25, y, sk[1]); }
  fig.put(23, 27, sk[3]); fig.put(24, 28, sk[0]); fig.put(25, 28, sk[0]); fig.put(22, 28, sk[1]);
  // Mouth.
  const lipD = hex('#7a3a30'), lipL = hex('#b06a5a'), dark = hex('#3a1610');
  if (mouthOpen) {
    hl(fig, 21, 26, 30, lipD); hl(fig, 21, 26, 31, dark); hl(fig, 22, 25, 31, CR[2]); hl(fig, 22, 25, 32, hex('#5a2218')); hl(fig, 22, 25, 33, lipL);
  } else if (pp.smirk) {
    hl(fig, 21, 26, 30, lipD); fig.put(27, 29, lipD); fig.put(28, 28, sk[1]); fig.put(20, 30, sk[1]);   // one corner up
    hl(fig, 22, 25, 31, lipL); fig.put(27, 30, sk[1]);
  } else {
    hl(fig, 21, 26, 30, lipD); fig.put(20, 29, sk[1]); fig.put(27, 29, sk[1]);                           // small closed smile
    hl(fig, 22, 25, 31, lipL); fig.put(23, 31, hex('#c98576'));
  }
  // Bicycle fall, years ago: a pale raised nick slanting across the chin, its shadow tucked under it.
  if (pp.scar) { for (const [x, y] of [[27, 32], [26, 33], [25, 34]]) { fig.put(x, y, sk[3].map((v, i) => i < 3 ? (v + CR[3][i] * 2) / 3 | 0 : 255)); fig.put(x + 1, y, sk[0]); } fig.put(25, 35, sk[1]); }
  if (cap) {
    // Tufts of dark hair under the cap at the temples, then the cap: knitted crown, ribbed cuff.
    for (let y = 17; y <= 23; y++) for (const x of [14, 15, 32, 33]) fig.put(x, y, hr[x > 30 ? 1 : 2]);
    const hc = P.hatCol, cf = P.band || hc;
    for (let y = 2; y <= 17; y++) for (let x = 9; x <= 38; x++) {
      const dx = (x + .5 - 24) / (y >= 12 ? 11.6 : 11), dy = (y + .5 - 14) / 12;
      if (dx * dx + dy * dy > 1 && y < 12) continue;
      if (y >= 12 && Math.abs(x + .5 - 24) > 11.8 - (y === 17 ? 1 : 0)) continue;
      const L = .86 - dx * .55 - (y - 2) * .012;
      if (y >= 12) fig.put(x, y, x % 2 ? tone(cf, L + .1, x, y, .2) : tone(hc, L - .25, x, y, .2));       // cuff ribs
      else fig.put(x, y, tone(hc, L + ((x + y * 2) % 4 === 0 ? -.3 : (x + y * 2) % 4 === 2 ? .12 : 0), x, y, .2));   // knit rows
      if (y === 12) fig.put(x, y, hc[0]);
    }
    fig.put(24, 1, hc[3]); fig.put(23, 1, hc[2]); fig.put(25, 1, hc[1]);
  } else {
    // Straw hair, uncut: a heavy fringe swept from his left to his right in separate locks, a cowlick.
    const fringe = x => 15.5 + Math.sin((x - 12) * .55) * 1.6 + (x - 14) * .16 - (x > 29 ? (x - 29) * 1.2 : 0);
    for (let y = 4; y <= 27; y++) for (let x = 11; x <= 37; x++) {
      const dx = (x + .5 - 24) / 12.6, dy = (y + .5 - 17) / 12.6, crown = dx * dx + dy * dy <= 1 && y < fringe(x);
      const side = y >= 14 && y <= 23 && ((x >= 12 && x <= 14) || (x >= 33 && x <= 35));
      if (!crown && !side) continue;
      const s = (Math.floor((x - 30) * .8 + y * 1.15) % 5 + 5) % 5, left = x < 26;
      let L = (left ? .78 : .42) - (y - 6) * .012 + (s === 0 ? -.42 : s === 2 || s === 3 ? .28 : 0);
      if (y >= 7 && y <= 9 && x >= 15 && x <= 23) L += .3;                                              // sheen
      if (crown && y > fringe(x) - 1.6) L -= .3;                                                        // lock tips
      fig.put(x, y, tone(hr, L, x, y, .2));
    }
    for (const [x, y, k] of [[22, 3, 3], [23, 3, 2], [24, 4, 3], [21, 4, 1], [16, 17, 2], [16, 18, 1], [20, 18, 2], [20, 19, 1], [25, 19, 1]]) fig.put(x, y, hr[k]);
  }
  // Clothes.
  if (P.topStyle === 'cadet') {
    const sh = P.shirt;
    for (let k = 0; k < 6; k++) { for (let w = 0; w < 4; w++) { fig.put(17 + k + w, 37 + k, sh[w < 2 ? 3 : 2]); fig.put(30 - k - w, 37 + k, sh[w < 2 ? 2 : 1]); } }   // open collar points
    for (let y = 37; y <= 41; y++) for (let x = 24 - (41 - y); x <= 23 + (41 - y); x++) fig.put(x, y, sk[y > 39 ? 0 : 1]);
    for (let y = 43; y < 48; y++) fig.put(24, y, t[0]);
    fig.put(24, 44, hex('#d2a845')); fig.put(24, 47, hex('#d2a845'));                                     // tunic buttons
    for (let x = 30; x < 36; x++) fig.put(x, 45, t[0]);                                                 // breast pocket flap
    fig.put(13, 44, hex('#c25a3d')); fig.put(14, 44, hex('#f3edd6')); fig.put(15, 44, hex('#3b5a7c'));    // school flash: orange, white, blue
  } else {
    for (let y = 34; y <= 38; y++) for (let x = 17; x <= 30; x++) { const u = (x - 23.5) / 7; fig.put(x, y, x % 2 ? tone(t, .9 - u * .5, x, y, .2) : tone(t, .5 - u * .5, x, y, .2)); }   // roll neck
    for (let x = 17; x <= 30; x++) fig.put(x, 39, t[0]);
    for (let y = 40; y < 48; y++) for (const x of [20, 27]) { fig.put(x, y, t[0]); fig.put(x + 1, y, t[3]); }   // cable
  }
  // Warm rim light from the lamp on the left edges.
  const rim = fig.clone();
  for (let y = 2; y < 48; y++) for (let x = 1; x < 47; x++) {
    const p = rim.get(x, y);
    if (!p || rim.get(x - 1, y)) continue;
    for (const R of [hr, sk, t, P.hatCol || t]) { const k = R.indexOf(p); if (k >= 0) { fig.put(x, y, R[Math.min(3, k + 2)]); break; } }
  }
  fig.outline(K);
  c.blit(fig, 0, 0);
  for (let i = 0; i < 48; i++) { c.put(i, 0, K); c.put(i, 47, K); c.put(0, i, K); c.put(47, i, K); }
  for (let i = 1; i < 47; i++) { c.put(i, 1, bg[2]); c.put(1, i, bg[2]); }
  return c;
}

module.exports = { youthPortrait };

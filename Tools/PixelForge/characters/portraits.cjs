'use strict';
// Characters: 48x48 dialogue portraits.
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, withAlpha, hash } = require('../lib.cjs');
const { CR, GD, ST, RD, GL, OL, WD, NV } = PAL;
const { hl } = require('./body.cjs');

// ---------------------------------------------------------------- portraits (48x48)
const PORTRAIT = 48;
function portrait(P, mouthOpen) {
  const pp = P.portrait, c = new Canvas(PORTRAIT, PORTRAIT), fig = new Canvas(PORTRAIT, PORTRAIT);
  // Backdrop: vertical light falloff with ordered dither and a soft window glow top-left.
  const bg = pp.bg;
  c.fill((x, y) => {
    const t = (y / 47) * .8 + Math.hypot(x - 10, y - 8) / 90;
    const b = (BAY[y & 3][x & 3] + .5) / 16;
    return t + b * .3 < .45 ? bg[2] : t + b * .3 < .85 ? bg[1] : bg[0];
  });
  const sk = P.skin, hr = P.hair, t = P.top;
  // Torso / shoulders.
  for (let y = 37; y < 48; y++) {
    const hw = Math.min(22, 12 + (y - 37) * 1.6);
    for (let x = Math.ceil(24 - hw); x < 24 + hw; x++) {
      const u = (x + .5 - 24) / hw;
      fig.put(x, y, u < -.7 ? t[3] : u > .6 ? t[1] : t[2]);
    }
  }
  // Neck.
  for (let y = 31; y < 41; y++) for (let x = 19; x < 29; x++) fig.put(x, y, x > 25 || y < 34 ? sk[0] : sk[1]);
  // Head.
  const hwAt = y => y < 10 ? 0 : y === 10 ? 5 : y === 11 ? 7 : y === 12 ? 8 : y <= 27 ? 9 : [8.5, 8, 7.5, 7, 6, 5, 4, 3][y - 28] || 0;
  for (let y = 10; y <= 35; y++) {
    const hw = hwAt(y);
    for (let x = Math.ceil(24 - hw); x < 24 + hw; x++) {
      const u = (x + .5 - 24) / hw;
      let col = sk[2];
      if (u > .62) col = sk[1];
      if (y >= 33) col = sk[1];
      if (u < -.45 && y > 13 && y < 27) col = sk[3];
      if (u > .8 && y > 26) col = sk[0];
      fig.put(x, y, col);
    }
  }
  // Ears.
  for (let y = 22; y <= 27; y++) { fig.put(14, y, sk[2]); fig.put(33, y, sk[1]); }
  fig.put(14, 24, sk[1]); fig.put(33, 24, sk[0]); fig.put(14, 25, sk[1]); fig.put(33, 25, sk[0]);
  // Eyes (looking at the viewer), brows, nose, mouth.
  const iris = pp.iris, white = CR[3];
  for (const [ex, mirrorEye] of [[18, false], [27, true]]) {
    fig.put(ex, 22, hr[1]); fig.put(ex + 1, 22, P.eye); fig.put(ex + 2, 22, P.eye);
    if (mirrorEye) { fig.put(ex, 22, P.eye); fig.put(ex + 2, 22, hr[1]); }
    fig.put(ex, 23, mirrorEye ? iris : white); fig.put(ex + 1, 23, P.eye); fig.put(ex + 2, 23, mirrorEye ? white : iris);
    fig.put(ex, 24, sk[1]); fig.put(ex + 1, 24, iris); fig.put(ex + 2, 24, sk[1]);
    if (pp.age > 45) { fig.put(ex, 25, sk[1]); fig.put(ex + 2, 25, sk[1]); }
    if (pp.female) { fig.put(mirrorEye ? ex + 3 : ex - 1, 22, P.eye); }
  }
  const browCol = pp.age > 60 ? hr[2] : hr[0];
  for (let x = 17; x <= 21; x++) fig.put(x, x === 17 ? 21 : 20, browCol);
  for (let x = 26; x <= 30; x++) fig.put(x, x === 30 ? 21 : 20, browCol);
  if (pp.age > 45) { fig.put(23, 20, sk[1]); fig.put(24, 20, sk[1]); hl(fig, 20, 27, 15, sk[1]); hl(fig, 21, 26, 17, sk[1]); }
  for (let y = 23; y <= 27; y++) fig.put(25, y, sk[1]);
  fig.put(24, 26, sk[3]);
  hl(fig, 22, 25, 28, sk[1]); fig.put(22, 28, sk[0]); fig.put(25, 28, sk[0]);
  if (mouthOpen) {
    hl(fig, 21, 26, 30, hex('#3a1610')); hl(fig, 21, 26, 31, hex('#3a1610')); hl(fig, 22, 25, 32, hex('#5a2218'));
    hl(fig, 22, 25, 30, CR[2]);
  } else if (pp.smile) {
    // Confident lopsided grin: corners up, the right one higher, a hint of teeth.
    hl(fig, 22, 25, 30, hex('#7a3528')); fig.put(21, 29, hex('#7a3528')); fig.put(26, 29, hex('#7a3528')); fig.put(27, 28, hex('#7a3528'));
    hl(fig, 22, 25, 31, P.lips || sk[0]); hl(fig, 23, 24, 30, CR[2]);
    fig.put(20, 28, sk[1]); fig.put(28, 27, sk[1]);
  } else {
    hl(fig, 21, 26, 30, P.lips || sk[0]); hl(fig, 22, 25, 31, P.lips ? P.lips : sk[3]);
    if (P.lips) hl(fig, 22, 25, 31, hex('#c8706a'));
  }
  if (P.freckles) {
    for (const x of [17, 18, 29, 30]) fig.put(x, 27, hex('#e8907c'));          // blush
    for (const [x, y] of [[18, 26], [20, 27], [17, 28], [28, 26], [30, 27], [22, 25], [26, 25]]) fig.put(x, y, sk[1]);
  }
  if (pp.age > 45) { fig.put(19, 29, sk[1]); fig.put(28, 29, sk[1]); fig.put(20, 30, sk[1]); fig.put(27, 30, sk[1]); }
  if (P.grease) { fig.put(30, 27, sk[0]); fig.put(31, 28, sk[0]); fig.put(29, 28, sk[1]); }
  if (pp.stubble) for (let y = 29; y <= 35; y++) for (let x = 16; x <= 32; x++) {
    const c0 = fig.get(x, y);
    if ((c0 === sk[2] || c0 === sk[3]) && ((x + y * 3) % 4 === 0) && !(y >= 30 && y <= 31 && x >= 21 && x <= 26)) fig.put(x, y, sk[1]);
  }
  if (pp.thinMustache) { hl(fig, 21, 26, 29, hr[1]); fig.put(20, 29, hr[0]); fig.put(27, 29, hr[0]); }
  portraitClothes(fig, P);
  portraitHair(fig, P);
  if (P.mustache) {
    for (let x = 19; x <= 28; x++) { fig.put(x, 29, hr[x < 24 ? 3 : 2]); if (x > 19 && x < 28) fig.put(x, 28, hr[2]); }
    fig.put(18, 30, hr[2]); fig.put(29, 30, hr[1]); fig.put(23, 28, hr[1]); fig.put(24, 28, hr[1]);
    if (!mouthOpen) hl(fig, 21, 26, 30, sk[0]);
  }
  if (P.glasses) {
    for (const cx of [19.5, 28.5]) for (let a = 0; a < 40; a++) {
      const x = Math.round(cx + Math.cos(a / 40 * Math.PI * 2) * 3.3 - .5), y = Math.round(23.5 + Math.sin(a / 40 * Math.PI * 2) * 2.6 - .5);
      fig.put(x, y, GD[1]);
    }
    hl(fig, 23, 24, 22, GD[1]); fig.put(16, 22, GD[1]); fig.put(15, 22, GD[0]); fig.put(32, 22, GD[0]);
    fig.put(17, 22, GL[3]); fig.put(26, 22, GL[3]);
  }
  portraitHat(fig, P);
  fig.outline(K);
  c.blit(fig, 0, 0);
  // Frame.
  for (let i = 0; i < 48; i++) { c.put(i, 0, K); c.put(i, 47, K); c.put(0, i, K); c.put(47, i, K); }
  for (let i = 1; i < 47; i++) { c.put(i, 1, withAlpha(bg[2], 255)); c.put(1, i, bg[2]); }
  return c;
}
const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function portraitClothes(f, P) {
  const t = P.top, sk = P.skin;
  switch (P.topStyle) {
    case 'jacket': {
      // Sheepskin collar, white silk scarf, A-2 zip.
      for (let y = 36; y < 48; y++) {
        const w = Math.max(0, 8 - Math.abs(y - 40));
        for (let k = 0; k < w + 2; k++) { f.put(11 + k - (y > 40 ? y - 40 : 0), y, P.collar[k < 2 ? 3 : 2]); f.put(36 - k + (y > 40 ? y - 40 : 0), y, P.collar[k < 2 ? 2 : 1]); }
      }
      // Silk scarf wrapped twice round the neck, knotted, tail falling to his right.
      for (let y = 34; y < 40; y++) {
        const x0 = 18 - (y > 36 ? 1 : 0), x1 = 29 + (y > 36 ? 1 : 0);
        for (let x = x0; x <= x1; x++) {
          const fold = (x - y * 2 + 60) % 6;
          let k = fold === 0 ? 1 : fold === 1 ? 3 : 2;
          if (x > 26) k = Math.max(1, k - 1);
          if (y === 36 || y === 39) k = 1;
          f.put(x, y, P.scarf[k]);
        }
      }
      for (let y = 38; y < 42; y++) for (let x = 20; x < 25; x++) f.put(x, y, x === 20 || y === 41 ? P.scarf[1] : x === 21 ? P.scarf[3] : P.scarf[2]);
      for (let y = 42; y < 48; y++) { const x = 20 - Math.floor((y - 42) / 2); f.put(x, y, P.scarf[1]); f.put(x + 1, y, P.scarf[3]); f.put(x + 2, y, P.scarf[2]); f.put(x + 3, y, P.scarf[1]); }
      for (let y = 41; y < 48; y++) { f.put(27, y, t[0]); f.put(28, y, GD[1 + (y & 1)]); }
      break;
    }
    case 'suit':
      for (let y = 37; y < 48; y++) { const w = Math.max(1, 8 - (y - 37) * .35); for (let x = Math.round(24 - w); x < Math.round(24 + w); x++) f.put(x, y, P.shirt[x < 24 ? 3 : 2]); }
      for (let y = 37; y < 48; y++) { const w = Math.min(3, 1 + (y - 37) * .3); for (let x = Math.round(24 - w); x < Math.round(24 + w); x++) f.put(x, y, y === 37 || y === 38 ? P.tie[3] : x < 24 ? P.tie[2] : P.tie[1]); }
      for (let y = 37; y < 48; y++) { f.put(Math.round(15 + (y - 37) * .5), y, t[0]); f.put(Math.round(32 - (y - 37) * .5), y, t[0]); }
      for (let k = 0; k < 4; k++) { f.put(18 + k, 36 + k, P.shirt[3]); f.put(29 - k, 36 + k, P.shirt[2]); }
      for (let y = 37; y < 48; y++) for (let x = 0; x < 48; x++) if (f.get(x, y) === t[2] && hash(x, y, 851) < .18) f.put(x, y, hash(x, y, 852) < .5 ? t[1] : t[3]);
      break;
    case 'field':
      for (let k = 0; k < 6; k++) { f.put(17 + k, 36 + k, t[3]); f.put(30 - k, 36 + k, t[1]); f.put(18 + k, 36 + k, t[3]); f.put(29 - k, 36 + k, t[1]); }
      for (let y = 40; y < 48; y++) f.put(24, y, t[1]);
      f.put(24, 42, ST[3]); f.put(24, 45, ST[3]);
      for (let k = 0; k < 12; k++) { f.put(8 + k, 47 - k, WD[1]); f.put(9 + k, 47 - k, WD[2]); }
      // Rifle muzzle over the shoulder.
      for (let y = 26; y < 44; y++) { f.put(8, y, y < 36 ? ST[2] : WD[2]); f.put(9, y, y < 36 ? ST[1] : WD[1]); }
      break;
    case 'coverall':
      for (let k = 0; k < 6; k++) { f.put(17 + k, 36 + k, t[3]); f.put(30 - k, 36 + k, t[1]); f.put(18 + k, 37 + k, t[3]); f.put(29 - k, 37 + k, t[1]); }
      for (let y = 42; y < 48; y++) { f.put(24, y, t[0]); f.put(25, y, ST[3]); }
      for (let y = 42; y < 46; y++) for (let x = 30; x < 35; x++) f.put(x, y, y === 42 ? t[0] : t[1]);
      f.put(14, 44, t[0]); f.put(15, 45, t[0]); f.put(13, 45, t[1]);
      break;
    case 'dress':
      for (let k = 0; k < 5; k++) { f.put(18 + k, 37 + k, t[3]); f.put(29 - k, 37 + k, t[1]); }
      for (let y = 38; y < 48; y++) { f.put(23, y, t[1]); }
      f.put(24, 42, ST[3]); f.put(24, 45, ST[3]);
      // Red-cross armband on the left shoulder edge and a cross pin.
      for (let y = 41; y < 47; y++) for (let x = 3; x < 9; x++) f.put(x, y, CR[3]);
      for (let y = 42; y < 46; y++) f.put(6, y, RD[3]); for (let x = 4; x < 8; x++) f.put(x, 44, RD[3]); f.put(5, 43, RD[3]);
      f.put(6, 43, RD[3]); f.put(6, 44, RD[3]);
      for (let k = -1; k <= 1; k++) { f.put(32 + k, 42, RD[3]); f.put(32, 42 + k, RD[3]); }
      break;
    case 'officer':
      for (let y = 37; y < 48; y++) { const w = Math.max(1, 6 - (y - 37) * .45); for (let x = Math.round(24 - w); x < Math.round(24 + w); x++) f.put(x, y, P.shirt[x < 24 ? 3 : 2]); }
      for (let y = 37; y < 48; y++) for (let x = 23; x < 26; x++) f.put(x, y, x === 25 ? P.tie[0] : P.tie[1]);
      for (let y = 37; y < 48; y++) { f.put(Math.round(17 + (y - 37) * .4), y, t[0]); f.put(Math.round(30 - (y - 37) * .4), y, t[0]); }
      // Lapel insignia and ribbon bars.
      f.put(15, 41, GD[3]); f.put(16, 41, GD[2]); f.put(32, 41, GD[3]); f.put(33, 41, GD[2]);
      const ribbons = [[RD[3], CR[3], RD[3]], [NV[4], GD[2], NV[4]], [OL[4], RD[3], OL[4]], [GD[2], NV[3], GD[2]]];
      ribbons.forEach((rb, i) => { const bx = 29 + (i % 2) * 4, by = 43 + Math.floor(i / 2) * 2; rb.forEach((col, k) => { f.put(bx + k, by, col); }); f.put(bx + 3, by, K); });
      f.put(30, 47, GD[2]); f.put(31, 47, GD[3]);
      for (let x = 2; x < 8; x++) f.put(x, 40 + Math.floor((x - 2) / 3), GD[2]);
      break;
  }
}

function portraitHair(f, P) {
  const h = P.hair, style = P.hairStyle, n = (x, y) => hash(x, y, 871);
  const put = (x, y, k) => f.put(x, y, h[k]);
  if (style === 'tousled') {
    // Chestnut tousled hair, side-swept fringe falling to his right.
    // Fringe line: low on his right (screen-left), lifted at the part on the other side.
    const fringe = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 24, 22, 20, 20, 21, 20, 19, 19, 18, 18, 17, 17, 16, 16, 15, 15, 16, 22, 24, 25, 24, 0, 0];
    for (let y = 5; y <= 26; y++) for (let x = 12; x <= 35; x++) {
      const dx = (x + .5 - 24) / 12, dy = (y + .5 - 17) / 12;
      if (dx * dx + dy * dy > 1) continue;
      const edge = fringe[x] || 0;
      if (y > edge) continue;
      // Strands sweep from the part (x 29) towards his right.
      const s = (Math.floor((x - 29) * .7 + y * 1.1) % 4 + 4) % 4;
      let k = s === 0 ? 1 : s === 2 ? 3 : 2;
      if (y < 9 && x < 25 && s !== 0) k = 3;
      if (x > 30) k = 1;
      if (y >= edge - 1 && x < 30) k = 1;
      if (x === 29 || x === 30) k = y < 12 ? 0 : 1;
      put(x, y, k);
    }
    // Loose locks over the forehead and a cowlick.
    put(17, 21, 2); put(17, 22, 1); put(20, 21, 2); put(21, 22, 1); put(24, 19, 2); put(25, 19, 1);
    put(22, 4, 2); put(23, 4, 3); put(21, 5, 1); put(24, 5, 3);
  } else if (style === 'receding') {
    for (let y = 9; y <= 15; y++) for (let x = 14; x <= 33; x++) {
      const dx = (x + .5 - 24) / 10, dy = (y + .5 - 18) / 9;
      if (dx * dx + dy * dy > 1) continue;
      if (Math.abs(x - 24) < 6 && y > 11 && n(x, y) < .7) continue;
      put(x, y, n(x, y) < .25 ? 3 : x > 28 ? 1 : 2);
    }
    for (let y = 13; y <= 29; y++) for (const [x0, x1] of [[11, 16], [32, 37]]) for (let x = x0; x <= x1; x++) {
      const out = x0 < 20 ? 16 - x : x - 32;
      if (out > 4 - Math.abs(y - 20) * .25 || (y > 24 && out > 2)) continue;
      if (x0 < 20 && x === 14 && y >= 22 && y <= 27) continue;
      if (x0 > 20 && x === 33 && y >= 22 && y <= 27) continue;
      put(x, y, n(x, y) < .3 ? 3 : x0 > 20 ? 1 : 2);
    }
  } else if (style === 'bun') {
    for (let y = 7; y <= 30; y++) for (let x = 12; x <= 35; x++) {
      const dx = (x + .5 - 24) / 11.5, dy = (y + .5 - 18) / 11.5;
      if (dx * dx + dy * dy > 1 && y < 22) continue;
      const side = x < 16 || x > 31;
      if (y > 17 && !side) continue;
      if (y >= 22 && (x < 12 || x > 35 || (x > 14 && x < 33))) continue;
      if ((x === 14 || x === 33) && y >= 22 && y <= 27) continue;
      const wave = (x + Math.floor(y / 2)) % 5;
      put(x, y, x === 24 ? 0 : wave === 0 ? 3 : x > 28 ? 1 : 2);
    }
    for (let x = 17; x <= 30; x++) if (f.get(x, 17)) put(x, 17, x < 24 ? 2 : 1);
  } else if (style === 'ponytail') {
    // Golden hair pulled back: side-swept fringe from a part on her left, two loose locks framing
    // the face, ears showing, high ponytail swinging out behind (drawn only into empty pixels so the
    // head and shoulders stay in front of it).
    const edge = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 21, 21, 29, 29, 19, 18, 18, 17, 17, 16, 15, 15, 14, 14, 13, 12, 14, 15, 16, 27, 20, 21, 21, 21];
    for (let y = 4; y <= 30; y++) for (let x = 12; x <= 36; x++) {
      const dx = (x + .5 - 24) / 12.5, dy = (y + .5 - 18) / 13;
      if (y > edge[x] || (dx * dx + dy * dy > 1 && y < 18)) continue;
      const st = (Math.floor((x - 28) * .6 + y * .9) % 4 + 4) % 4;
      let k = st === 0 ? 1 : st === 2 ? 3 : 2;
      if (y >= 7 && y <= 9 && x < 28 && st !== 0) k = 3;            // sheen across the crown
      if (x > 31 && k > 1) k--;
      if (y >= edge[x] - 1 && x > 16 && x < 32) k = 1;
      if (x === 28 && y < 13) k = 0;
      if ((x === 15 || x === 32) && y > 20) k = x === 15 ? 2 : 1;
      put(x, y, k);
    }
    put(16, 30, 1); put(15, 30, 2); put(32, 28, 1); put(33, 28, 0);       // lock tips curl
    const tail = [[35, 11], [38, 13], [40, 17], [41, 22], [41, 27], [40, 32], [38, 36], [37, 39]];
    for (let i = 0; i < tail.length - 1; i++) for (let s = 0; s < 1; s += .1) {
      const u = (i + s) / (tail.length - 1), r = 3.4 - 2.3 * u;
      const cx = tail[i][0] + (tail[i + 1][0] - tail[i][0]) * s, cy = tail[i][1] + (tail[i + 1][1] - tail[i][1]) * s;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const q = (x + .5 - cx) / r;
        if (Math.hypot(x + .5 - cx, y + .5 - cy) > r || f.get(x, y)) continue;
        const strand = (x * 2 + y) % 5 === 0;
        put(x, y, q < -.45 ? 3 : q > .5 || strand ? 1 : 2);
      }
    }
    for (const [x, y, k] of [[42, 21, 2], [43, 23, 1], [36, 40, 1], [30, 4, 2]]) if (!f.get(x, y)) put(x, y, k);   // flyaways
    const tie = P.hairTie || h[0];
    for (const [x, y] of [[34, 10], [35, 10], [34, 11], [35, 11], [36, 12], [35, 12]]) f.put(x, y, tie);
  } else if (style === 'crop') {
    for (let y = 12; y <= 26; y++) for (const x of [15, 16, 31, 32]) if (y < 22 || x === 16 || x === 31) put(x, y, x > 30 ? 1 : 2);
    if (P.portrait.age > 40) for (let y = 19; y <= 21; y++) { put(15, y, 3); put(32, y, 3); }
  }
}

function portraitHat(f, P) {
  if (P.goggles) {
    // Welding goggles (custom lens) get a steel frame so they read against blonde hair.
    const L = P.goggleLens || GL, F = P.goggleLens ? ST : GD;
    // Flying goggles pushed up on the forehead.
    for (let x = 12; x <= 35; x++) f.put(x, 11 + (x < 16 || x > 32 ? 1 : 0), hex('#2a1a10'));
    for (let x = 12; x <= 35; x++) if (x < 16 || x > 32) f.put(x, 12 + (x < 14 || x > 34 ? 1 : 0), hex('#3d2718'));
    for (const cx of [19.5, 28.5]) {
      for (let y = 7; y <= 14; y++) for (let x = Math.floor(cx - 5); x <= cx + 5; x++) {
        const d = Math.hypot((x + .5 - cx) / 3.6, (y + .5 - 10.5) / 2.9);
        if (d > 1) continue;
        f.put(x, y, d > .7 ? (y < 10 ? F[3] : x < cx ? F[2] : F[1]) : (y < 10 && x < cx ? L[2] : L[1]));
      }
      f.put(Math.floor(cx) - 1, 9, L[3]); f.put(Math.floor(cx), 9, L[2]);
    }
    f.put(24, 10, F[1]); f.put(23, 10, F[2]); f.put(24, 11, F[0]); f.put(23, 11, F[1]);
  }
  if (!P.hat) return;
  const h = P.hatCol;
  if (P.hat === 'helmet') {
    for (let y = 2; y <= 19; y++) for (let x = 6; x <= 41; x++) {
      const dx = (x + .5 - 24) / 15.5, dy = (y + .5 - 19) / 16;
      const rim = y >= 17 && Math.abs(x + .5 - 24) < 17.5;
      if (dx * dx + dy * dy > 1 && !rim) continue;
      let col = rim ? (y === 19 ? h[0] : h[1]) : dx < -.35 && dy < -.4 ? h[3] : dx > .55 ? h[1] : h[2];
      if (!rim && hash(x, y, 881) < .12) col = h[1];
      f.put(x, y, col);
    }
    for (let y = 20; y <= 33; y++) { f.put(16 - Math.floor((y - 20) / 7), y, h[0]); f.put(31 + Math.floor((y - 20) / 7), y, h[0]); }
    hl(f, 18, 30, 34, h[0]);
  } else if (P.hat === 'cap') {
    for (let y = 6; y <= 15; y++) for (let x = 12; x <= 35; x++) {
      const dx = (x + .5 - 24) / 12, dy = (y + .5 - 15.5) / 9.5;
      if (dx * dx + dy * dy > 1) continue;
      f.put(x, y, y >= 14 ? h[1] : dx < -.3 && dy < -.3 ? h[3] : dx > .5 ? h[1] : h[2]);
    }
    for (let x = 22; x <= 25; x++) f.put(x, 7, h[0]);
    for (let y = 15; y <= 18; y++) for (let x = 11 + (y - 15); x <= 36 - (y - 15); x++) f.put(x, y, y === 15 ? h[3] : y === 18 ? h[0] : h[1]);
    hl(f, 15, 32, 19, P.skin[1]);
  } else if (P.hat === 'kepi') {
    for (let y = 3; y <= 13; y++) for (let x = 7; x <= 40; x++) {
      const dx = (x + .5 - 24) / 17, dy = (y + .5 - 12) / 9;
      if (dx * dx + dy * dy > 1) continue;
      f.put(x, y, dx < -.4 && dy < -.2 ? h[3] : dx > .6 ? h[1] : h[2]);
    }
    for (let y = 12; y <= 15; y++) for (let x = 13; x <= 34; x++) f.put(x, y, y === 12 ? P.band[2] : P.band[1]);
    for (let y = 16; y <= 18; y++) for (let x = 13 + (y - 16); x <= 34 - (y - 16); x++) f.put(x, y, y === 16 ? P.brim[3] : P.brim[1]);
    f.put(16, 16, hex('#9a9288'));
    hl(f, 15, 32, 19, P.skin[1]);
    // Eagle badge.
    for (const [x, y, k] of [[23, 6, 3], [24, 6, 3], [21, 7, 2], [22, 7, 3], [23, 7, 2], [24, 7, 2], [25, 7, 3], [26, 7, 2], [20, 8, 1], [22, 8, 2], [23, 8, 3], [24, 8, 3], [25, 8, 2], [27, 8, 1], [23, 9, 2], [24, 9, 1], [23, 10, 1], [24, 10, 1]]) f.put(x, y, GD[k]);
  } else if (P.hat === 'nurse') {
    for (let y = 5; y <= 12; y++) for (let x = 14; x <= 33; x++) {
      const w = 10 - Math.max(0, 8 - y) * 1.2;
      if (Math.abs(x + .5 - 24) > w) continue;
      f.put(x, y, y === 12 ? h[1] : x > 29 ? h[2] : h[3]);
    }
    for (let k = -2; k <= 2; k++) { f.put(23 + (k > 0 ? 1 : 0) + k, 8, RD[3]); }
    for (let y = 6; y <= 10; y++) { f.put(23, y, RD[3]); f.put(24, y, RD[3]); }
    for (let x = 21; x <= 26; x++) { f.put(x, 8, RD[3]); f.put(x, 7, x === 21 || x === 26 ? f.get(x, 7) : RD[3]); }
    for (let x = 21; x <= 26; x++) f.put(x, 7, (x === 23 || x === 24) ? RD[3] : f.get(x, 7));
    for (let x = 21; x <= 26; x++) f.put(x, 9, x >= 21 && x <= 26 ? RD[2] : f.get(x, 9));
  }
}

module.exports = {
  portrait
};

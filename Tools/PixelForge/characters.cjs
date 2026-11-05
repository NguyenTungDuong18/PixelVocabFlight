'use strict';
// WORDWING 0.15.0: walkable-base characters (24x32, anchor 12,30), dialogue portraits (48x48)
// and the quest marker. Every character comes from ONE parametric rig: a new NPC only needs a
// parameter set in CHARACTERS (skin, hair + hairStyle, top + topStyle, pants, shoes, hat, held,
// goggles/glasses/mustache/scarf/collar/medals/armband...). Facing W is the mirror of facing E.
// Animation: idle / walk / run are 8-frame cycles (breathing + blink, classic contact-down-passing-up
// walk, leaning run with an airborne frame); see "cycles" below. fx_dust is the running-foot puff.
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, withAlpha, hash } = require('./lib.cjs');
const { CR, GD, ST, RD, GL, OL, WD, NV } = PAL;

const FW = 24, FH = 32, ANCHOR = [12, 30];
const R = (...h) => h.map(c => hex(c));

// Material ramps: index 0 deepest shade, 1 shade, 2 base, 3 light.
const M = {
  skinFair: R('#7a4630', '#b9765a', '#e2a27c', '#f4c9a2'),
  skinWarm: R('#6a3b26', '#a5664a', '#d29270', '#ebb792'),
  skinTan: R('#5a3220', '#8f5638', '#bd8058', '#d9a27a'),
  skinOld: R('#76493a', '#b0806a', '#dcb095', '#f1d3bd'),
  hairChestnut: R('#2e1608', '#5e3112', '#91531f', '#c07b37'),
  hairSilver: R('#55595d', '#8a8e92', '#c2c5c7', '#eceeee'),
  hairBlack: R('#110e0c', '#221c18', '#383029', '#4f443b'),
  hairDark: R('#1a110b', '#30200f', '#4a321b', '#664829'),
  hairGreying: R('#1f1c19', '#3a3530', '#5a544c', '#9a958d'),
  leather: R('#1e120b', '#3a2317', '#5a3722', '#7c5132'),
  fleece: R('#8c7752', '#bca57a', '#ddc9a0', '#f4e9cd'),
  scarf: R('#9ea29b', '#cfd3ca', '#eef0ea', '#ffffff'),
  khaki: R('#4f4429', '#7a6a42', '#a08e5c', '#c2b17c'),
  boot: R('#120c08', '#2a1c13', '#47301f', '#6a4a2f'),
  tweed: R('#33271c', '#57442f', '#7c6446', '#9c8461'),
  shirt: R('#8f948c', '#c4c8bf', '#e8ebe2', '#fbfcf6'),
  tie: R('#3e130e', '#6a2117', '#963826', '#c25a3d'),
  greyTrouser: R('#25272b', '#3c3f45', '#585c63', '#777b82'),
  olive: [OL[1], OL[2], OL[3], OL[4]],
  helmet: R('#262e18', '#3d4a24', '#56672f', '#738842'),
  webbing: R('#4a4128', '#6d6240', '#94875a', '#b3a776'),
  coverall: R('#18222d', '#283b4d', '#3d5a74', '#5c7f9a'),
  capBlue: R('#141c25', '#22303e', '#344b60', '#4f6c86'),
  nurse: R('#87918f', '#b6c0bd', '#dde4df', '#f8faf6'),
  stocking: R('#6b5a48', '#8e7a64', '#b09a80', '#c8b398'),
  odJacket: R('#262414', '#3f3c24', '#5c5836', '#7c774d'),
  pinks: R('#6a5a4a', '#938069', '#b7a387', '#d3c1a4'),
  khakiShirt: R('#7d7050', '#a39570', '#c4b78f', '#dcd1ac'),
  brownLeather: R('#24130a', '#45261a', '#6b3d22', '#8f5631'),
  blackLeather: R('#0d0b0a', '#1d1a17', '#332e29', '#5a534b')
};

// ---------------------------------------------------------------- rig parameters
// Fields (all optional except skin/hair/top/pants/shoes):
//   hairStyle: tousled | receding | bun | crop          hat: helmet | cap | kepi | nurse
//   topStyle: jacket | suit | field | coverall | dress | officer
//   held: book | wrench | rifle                          skirt, goggles, glasses, mustache, scarf,
//   collar (ramp), belt (ramp), tie (ramp), shirt (ramp), medals, armband, grease, lips
//   portrait: { bg: [dark, mid, light], iris, age, female }
const CHARACTERS = {
  pilot: {
    skin: M.skinFair, hair: M.hairChestnut, hairStyle: 'tousled', eye: hex('#24140a'), brows: true,
    top: M.leather, topStyle: 'jacket', collar: M.fleece, scarf: M.scarf,
    pants: M.khaki, shoes: M.boot, goggles: true,
    portrait: { bg: R('#16222c', '#22384a', '#35546a'), iris: hex('#6b4423'), age: 22 }
  },
  professor: {
    skin: M.skinOld, hair: M.hairSilver, hairStyle: 'receding', eye: hex('#2a2620'), brows: true,
    top: M.tweed, topStyle: 'suit', shirt: M.shirt, tie: M.tie, pants: M.greyTrouser, shoes: M.brownLeather,
    glasses: true, mustache: true, held: 'book',
    portrait: { bg: R('#121d16', '#1d3125', '#2b4736'), iris: hex('#4a6a7a'), age: 64 }
  },
  guard: {
    skin: M.skinTan, hair: M.hairDark, hairStyle: 'crop', eye: hex('#1c120a'), brows: true,
    top: M.olive, topStyle: 'field', belt: M.webbing, pants: M.olive, shoes: M.boot, leggings: M.webbing,
    hat: 'helmet', hatCol: M.helmet, held: 'rifle',
    portrait: { bg: R('#1a1d12', '#2a2f1c', '#3d442a'), iris: hex('#3d2a18'), age: 24 }
  },
  mechanic: {
    skin: M.skinWarm, hair: M.hairBlack, hairStyle: 'crop', eye: hex('#1a120c'), brows: true,
    top: M.coverall, topStyle: 'coverall', pants: M.coverall, shoes: M.boot,
    hat: 'cap', hatCol: M.capBlue, held: 'wrench', grease: true,
    portrait: { bg: R('#1a1d1f', '#2b3134', '#40494d'), iris: hex('#2e2014'), age: 35, stubble: true }
  },
  medic: {
    skin: M.skinFair, hair: M.hairDark, hairStyle: 'bun', eye: hex('#1c1210'), brows: true, lips: hex('#b0534a'),
    top: M.nurse, topStyle: 'dress', skirt: true, pants: M.stocking, shoes: M.shirt,
    hat: 'nurse', hatCol: M.nurse, armband: true,
    portrait: { bg: R('#1a2224', '#2a3a3d', '#3f5658'), iris: hex('#3d5a3a'), age: 26, female: true }
  },
  officer: {
    skin: M.skinTan, hair: M.hairGreying, hairStyle: 'crop', eye: hex('#1a120c'), brows: true,
    top: M.odJacket, topStyle: 'officer', shirt: M.khakiShirt, tie: M.odJacket, belt: M.brownLeather,
    pants: M.pinks, shoes: M.brownLeather, hat: 'kepi', hatCol: M.odJacket, band: M.brownLeather, brim: M.blackLeather,
    medals: true, mustache: false,
    portrait: { bg: R('#24140f', '#3a2219', '#553428'), iris: hex('#2a1c10'), age: 48, thinMustache: true }
  }
};

// ---------------------------------------------------------------- masks
// Head-level masks are 14 columns wide (x 5..18) and start 3 rows above the skull (y0 - 3).
const MX = 5;
function checkMask(name, rows) { rows.forEach((r, i) => { if (r.length !== 14) throw new Error(`mask ${name} row ${i} has ${r.length} chars`); }); return rows; }
function stamp(c, rows, ox, oy, pal) {
  rows.forEach((row, ry) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const col = pal[ch]; if (col === undefined) throw new Error('mask char ' + ch); if (col) c.put(ox + i, oy + ry, col); } });
}

const HEAD = {
  s: checkMask('head s', [
    '..............',
    '..............',
    '..............',
    '...sssssssS...',
    '..ssssssssSS..',
    '..lsssssssSS..',
    '..lsssssssSS..',
    '..sbbssssbbS..',
    '.sssessssesSZ.',
    '.SssesssseSSZ.',
    '..ssssssssSS..',
    '..ssssmmssSS..',
    '...SSSSSSSS...',
    '.....ZZZZ.....']),
  n: checkMask('head n', [
    '..............',
    '..............',
    '..............',
    '...sssssssS...',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '.ssssssssssSZ.',
    '.SsssssssssSZ.',
    '..ssssssssSS..',
    '..ssssssssSS..',
    '...SSSSSSSS...',
    '.....ZZZZ.....']),
  e: checkMask('head e', [
    '..............',
    '..............',
    '..............',
    '....sssssss...',
    '...sssssssss..',
    '...lssssssss..',
    '...lssssssss..',
    '...sssssssbs..',
    '...sssSSsses..',
    '...sssZSsses..',
    '...ssssssssss.',
    '...ssssssssm..',
    '....SSSSSSS...',
    '......ZZZ.....'])
};

const HAIR = {
  tousled: {
    s: ['......H.......', '...dhhHHhhd...', '..dhHHhhhHhd..', '..hHhhhhhhhd..', '.dhhhhhhhhhhd.',
      '.dhhhhhhh..hd.', '..dhhhd....hd.', '..d........d..', '..d........d..'],
    n: ['......H.......', '...dhhHHhhd...', '..dhHHhhhHhd..', '..hhhhHhhhhd..', '.dhhhhhhhhhhd.', '.dhhhhhhhhhhd.',
      '.dhhhhhhhhhhd.', '..dhhhhhhhhd..', '..dhhhhhhhhd..', '..ddhhhhhhdd..', '...ddhdhhdd...'],
    e: ['.......H......', '....dhhHHhd...', '...dhHHhhhHd..', '..dhhhHhhhhhd.', '..dhhhhhhhhhd.',
      '..dhhhhhhhhd..', '..dhhhhd......', '..dhhd........', '..dhhd........', '...dhd........', '....d.........']
  },
  receding: {
    s: ['..............', '..............', '...dhhhhhhd...', '..dh......hd..', '.dhh......hhd.',
      '.dhh......hhd.', '.dh........hd.', '..h........h..', '..d........d..'],
    n: ['..............', '..............', '...dhhhhhhd...', '..dhhhhhhhhd..', '.dhhhHhhhhhhd.', '.dhhhhhhhhhhd.',
      '.dhhhhhhhhhhd.', '..hhhhhhhhhh..', '..dhhhhhhhhd..', '...dhhhhhhd...', '....dddddd....'],
    e: ['..............', '..............', '....dhhhhd....', '...dhhh.......', '..dhhhh.......',
      '..dhhhh.......', '..dhhhh.......', '..dhhd........', '..dhhd........', '...dhd........', '....d.........']
  },
  bun: {
    s: ['..............', '....dhhhhd....', '...dhHhhHhd...', '..dhhhhhhhhd..', '..hhhh..hhhh..',
      '..hhd....dhh..', '..h........h..', '..h........h..', '..d........d..', '..d........d..'],
    n: ['..............', '....dhhhhd....', '...dhhHHhhd...', '..dhhhhhhhhd..', '..hhhhhhhhhh..', '..hhhhhhhhhh..',
      '..hhhdDDdhhh..', '..hhdhHhhdhh..', '..hhdhhhhdhh..', '..dhhdDDdhhd..', '...dhhhhhhd...'],
    e: ['..............', '....dhhhhd....', '...dhhHhhhd...', '..dhhhhhhhhd..', '.ddhhhhhhhd...',
      'dhdhhhhh.hd...', 'dHhdhhhd......', 'dhhdhhd.......', '.ddhhd........', '...dhd........']
  },
  crop: {
    s: ['..............', '..............', '..............', '..............', '..dhhhhhhhhd..',
      '..dh......hd..', '..d........d..', '..d........d..'],
    n: ['..............', '..............', '..............', '...dhhhhhhd...', '..dhhhhhhhhd..', '..dhhhhhhhhd..',
      '..dhhhhhhhhd..', '..dhhhhhhhhd..', '..dhhHhhhhhd..', '..ddhhhhhhdd..', '...dddddddd...'],
    e: ['..............', '..............', '..............', '....dhhhhd....', '...dhhhhhhd...', '..dhhhhhhhhd..',
      '..dhhhh.......', '..dhhd........', '..dhd.........', '...d..........']
  }
};
for (const [k, v] of Object.entries(HAIR)) for (const d of 'sne') checkMask('hair ' + k + d, v[d]);

const HAT = {
  helmet: {
    s: ['..............', '....kcCCck....', '...kcCCccck...', '..kcCCcccckk..', '..cCcccccckk..', '.cccccccccckk.',
      '.cccccccccckk.', 'kkkkkkkkkkkkKK', '..K........K..', '..K........K..', '..K........K..', '...K......K...'],
    n: ['..............', '....kcCCck....', '...kcCCccck...', '..cCcccccckk..', '..cccccccckk..', '.cccccccccckk.',
      '.cccccccccckk.', '.cccccccccckk.', 'kkkkkkkkkkkkKK'],
    e: ['..............', '....kcCCcck...', '...kcCCcccck..', '..kcCcccccckk.', '..cCccccccckk.', '.ccccccccccckk',
      '.ccccccccccckk', 'kkkkkkkkkkkkKK', '........K.....', '........K.....', '.........K....', '..........K...']
  },
  cap: {
    s: ['..............', '..............', '....kcCCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..kkkkkkkkkk..', '.bbbbbbbbbbbb.'],
    n: ['..............', '..............', '....kcCCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..cccccccckk..', '..kkkkkkkkkk..'],
    e: ['..............', '..............', '.....kcCck....', '...kcCCccck...', '..kcCcccccck..', '..cccccccckk..',
      '..kkkkkkkkkk..', '........bbbbbb']
  },
  kepi: {
    s: ['..............', '...kcCCCcck...', 'kcCCccxxcccckK', '.kccccxxccckk.', '..BBBBBBBBBB..', '..bgbbbbbbbb..'],
    n: ['..............', '...kcCCCcck...', 'kcCCcccccccckK', '.kcccccccccck.', '..BBBBBBBBBB..'],
    e: ['..............', '....kcCCck....', '.kcCCccccxcck.', '..kccccccccck.', '...BBBBBBBBB..', '.........bgbbb']
  },
  nurse: {
    s: ['..............', '..............', '....wwxxww....', '...wwxxxxwk...', '...kwwxxwwk...'],
    n: ['..............', '..............', '....wwwwww....', '...wwwwwwwk...', '...kwwwwwwk...'],
    e: ['..............', '..............', '.....wwxww....', '....wwxxxwk...', '....kwwxwwk...']
  }
};
for (const [k, v] of Object.entries(HAT)) for (const d of 'sne') checkMask('hat ' + k + d, v[d]);

const GOGGLES = {
  s: ['..............', '..............', '..............', '..tgLiggLigt..', '..tgLLggLLgt..'],
  n: ['..............', '..............', '..............', '..............', '..ttttggtttt..'],
  e: ['..............', '..............', '..............', '.........gLig.', '..tttttttgLLg.']
};
const GLASSES = {
  s: ['...glgggglg...', '...g.g..g.g...'],
  e: ['......gggglg..', '.........g.g..']
};
const MUSTACHE = { s: ['....uuuuuu....', '....u....u....'], e: ['.........uuu..', '..............'] };
for (const g of [GOGGLES, GLASSES, MUSTACHE]) for (const d of Object.keys(g)) checkMask('acc', g[d]);

// ---------------------------------------------------------------- body parts
// Pose fields shared by every view:
//   bob    torso + arms vertical offset (+ down). Legs stretch to fill when the body rises.
//   head   head vertical offset; the cycles feed it the previous frame's bob (head lags 1 frame).
//   chest  1 = shoulders/chest raised one pixel while the belt line stays (breathing).
//   lean   side views only: torso, arms and head shift this many pixels toward the facing.
//   blink  eyes closed.   run  bent arms + flying scarf.   phase  frame index for cloth flutter.
const hl = (c, x0, x1, y, col) => { for (let x = x0; x <= x1; x++) c.put(x, y, col); };
const vl = (c, x, y0, y1, col) => { for (let y = y0; y <= y1; y++) c.put(x, y, col); };

function headPalette(P, mouthOpen) {
  const s = P.skin;
  return {
    s: s[2], S: s[1], Z: s[0], l: s[3], e: P.eye || K,
    b: P.brows ? P.hair[1] : s[2],
    m: mouthOpen ? hex('#4a1a12') : (P.lips || s[1])
  };
}

// Eye columns inside the head masks (mask rows 8 and 9 hold the two eye pixels).
const EYE_COLS = { s: [4, 9], e: [10] };
function closeEyes(c, P, dir, X, oy) {
  const sk = P.skin;
  for (const ex of EYE_COLS[dir]) {
    // Upper pixel becomes the lid (seen through the lens for glasses), lower pixel a soft lash line.
    c.put(X + ex, oy + 8, P.glasses ? sk[1] : sk[2]);
    c.put(X + ex, oy + 9, sk[0]);
    const out = dir === 's' ? (ex < 7 ? ex - 1 : ex + 1) : ex - 1;
    if (!P.glasses) c.put(X + out, oy + 9, sk[1]);
  }
}

function drawHead(c, P, dir, o, mouthOpen, blink = false, hx = 0) {
  const y0 = 4 + o, oy = y0 - 3, back = dir === 'n', X = MX + hx;
  stamp(c, HEAD[dir], X, oy, headPalette(P, mouthOpen));
  const hp = { h: P.hair[2], H: P.hair[3], d: P.hair[1], D: P.hair[0] };
  if (P.hairStyle) stamp(c, HAIR[P.hairStyle][dir], X, oy, hp);
  if (P.grease && !back) c.put((dir === 'e' ? 13 : 9) + hx, y0 + 7, P.skin[0]);
  if (P.glasses && !back) stamp(c, GLASSES[dir], X, y0 + 5, { g: GD[1], l: GL[3] });
  if (P.mustache && !back) {
    stamp(c, MUSTACHE[dir], X, y0 + 8, { u: P.hair[2] });
    if (mouthOpen) c.put((dir === 'e' ? 16 : 11) + hx, y0 + 9, hex('#4a1a12')), dir === 's' && c.put(12 + hx, y0 + 9, hex('#4a1a12'));
  }
  if (P.goggles) stamp(c, GOGGLES[dir], X, oy, { t: hex('#2a1a10'), g: GD[1], L: GL[1], i: GL[3] });
  if (blink && !back) closeEyes(c, P, dir, X, oy);
  if (P.hat) {
    const h = P.hatCol;
    stamp(c, HAT[P.hat][dir], X, oy, {
      c: h[2], C: h[3], k: h[1], K: h[0], w: h[3], x: P.hat === 'nurse' ? RD[3] : GD[2],
      B: (P.band || h)[1], b: (P.brim || h)[1], g: (P.brim || h)[3]
    });
  }
}

// Fills the neck when the lagging head sits above the shoulders (no see-through gap).
function drawNeck(c, P, dir, ho, top) {
  const [x0, x1] = dir === 'e' ? [11, 13] : [10, 13];
  for (let y = 15 + ho; y < top; y++) hl(c, x0, x1, y, P.skin[0]);
}

// Front/back legs: lift[screenLeft, screenRight] (+ up, -1 = planted one row toward the camera).
function drawLegsFront(c, P, pose) {
  const pr = P.pants, sh = P.shoes, hip = 21 + Math.min(0, pose.bob);
  if (!P.skirt) for (let y = hip; y <= 23; y++) hl(c, 8, 15, y, pr[1]);
  for (let i = 0; i < 2; i++) {
    const lift = pose.lift[i], foot = 29 - lift;
    const x0 = P.skirt ? (i ? 13 : 9) : (i ? 13 : 8), w = P.skirt ? 2 : 3;
    // A raised knee comes toward the camera: one lit row reads as the kneecap.
    const kneeY = lift >= 2 ? foot - (P.leggings ? 5 : 3) : -99;
    for (let y = hip; y <= foot - 2; y++) for (let k = 0; k < w; k++) {
      let col = k === w - 1 ? pr[1] : pr[2];
      if (i === 0 && k === 0 && w === 3) col = pr[3];
      if (P.leggings && y >= foot - 4) col = k === w - 1 ? P.leggings[1] : P.leggings[2];
      if (y === kneeY) col = k === w - 1 ? pr[2] : pr[3];
      c.put(x0 + k, y, col);
    }
    const sx0 = i ? x0 : x0 - 1, sx1 = i ? x0 + w : x0 + w - 1;
    hl(c, sx0, sx1, foot - 1, sh[2]); hl(c, sx0, sx1, foot, sh[1]);
    c.put(i ? sx1 - 1 : sx0 + 1, foot - 1, sh[3]);
  }
}

// Side legs: legs[far, near] = { fx: foot x (+ forward), lift, kx: knee x, toe: heel raised }.
// Each leg is a hip -> knee -> ankle polyline, so a lifted leg bends instead of just shrinking.
function drawLegsSide(c, P, pose) {
  const pr = P.pants, sh = P.shoes, hip = 21 + Math.min(0, pose.bob);
  for (let i = 0; i < 2; i++) {
    const L = pose.legs[i], near = i === 1, fx = L.fx, lift = L.lift || 0, foot = 29 - lift;
    const kx = L.kx !== undefined ? L.kx : fx / 2, bottom = foot - 2;
    const kneeY = hip + Math.max(1, Math.round((bottom - hip) * .45));
    for (let y = hip; y <= bottom; y++) {
      const xs = 10 + Math.round(y <= kneeY ? kx * (y - hip) / Math.max(1, kneeY - hip)
        : kx + (fx - kx) * (y - kneeY) / Math.max(1, bottom - kneeY));
      for (let k = 0; k < 3; k++) {
        let col = near ? (k === 0 ? pr[1] : pr[2]) : (k === 2 ? pr[0] : pr[1]);
        if (near && y === kneeY && kx > fx + 1 && k === 2) col = pr[3];
        if (P.leggings && y >= foot - 4) col = near ? P.leggings[k === 0 ? 1 : 2] : P.leggings[1];
        if (P.skirt && y <= 25) continue;
        if (P.skirt && k === 0) continue;
        c.put(xs + k, y, col);
      }
    }
    const xf = 10 + fx;
    if (L.toe) {
      // Pushing off: heel up, weight on the ball of the foot.
      hl(c, xf + 1, xf + 2, foot - 1, near ? sh[2] : sh[1]); hl(c, xf + 1, xf + 3, foot, near ? sh[1] : sh[0]);
    } else {
      hl(c, xf, xf + 2, foot - 1, near ? sh[2] : sh[1]); hl(c, xf, xf + 3, foot, near ? sh[1] : sh[0]);
      if (near) c.put(xf + 2, foot - 1, sh[3]);
    }
  }
}

function torsoDetailsFront(c, P, o, back, ch = 0) {
  const t = P.top, y0 = 15 + o - ch, y1 = 22 + o;
  switch (P.topStyle) {
    case 'jacket':
      if (!back) {
        vl(c, 12, y0 + 3, y1 - 1, t[0]);
        hl(c, 8, 9, y0 + 4, t[1]); hl(c, 14, 15, y0 + 4, t[1]);
        for (const [x, y] of [[8, 0], [9, 0], [10, 0], [13, 0], [14, 0], [15, 0], [7, 1], [8, 1], [9, 1], [14, 1], [15, 1], [16, 1], [8, 2], [15, 2]])
          c.put(x, y0 + y, P.collar[x < 12 ? (y === 0 ? 3 : 2) : (y === 0 ? 2 : 1)]);
      } else {
        hl(c, 8, 15, y0, P.collar[2]); hl(c, 7, 16, y0 + 1, P.collar[1]);
        // Painted squadron emblem on the back of the A-2 jacket.
        hl(c, 11, 12, y0 + 3, RD[3]); hl(c, 10, 13, y0 + 4, CR[2]); hl(c, 11, 12, y0 + 5, RD[2]);
      }
      for (let x = 7; x <= 16; x++) c.put(x, y1, (x & 1) ? t[0] : t[1]);
      break;
    case 'suit':
      if (!back) {
        hl(c, 10, 13, y0, P.shirt[3]); hl(c, 10, 13, y0 + 1, P.shirt[2]); hl(c, 11, 12, y0 + 2, P.shirt[2]);
        hl(c, 11, 12, y0, P.tie[3]); vl(c, 11, y0 + 1, y0 + 4, P.tie[2]); vl(c, 12, y0 + 1, y0 + 4, P.tie[1]); c.put(11, y0 + 5, P.tie[1]);
        vl(c, 9, y0 + 1, y0 + 3, t[0]); vl(c, 14, y0 + 1, y0 + 3, t[0]);
        c.put(10, y0 + 5, GD[1]); c.put(13, y0 + 5, GD[1]);
        hl(c, 8, 9, y0 + 5, t[1]);
      } else { hl(c, 10, 13, y0, P.shirt[2]); vl(c, 12, y1 - 2, y1, t[0]); }
      for (let y = y0; y <= y1; y++) for (let x = 7; x <= 16; x++) if (hash(x, y - o, 811) < .14 && c.get(x, y) === t[2]) c.put(x, y, hash(x, y - o, 812) < .5 ? t[1] : t[3]);
      break;
    case 'field':
      if (!back) {
        c.put(10, y0, t[3]); c.put(13, y0, t[3]); c.put(11, y0, t[0]); c.put(12, y0, t[0]);
        hl(c, 8, 9, y0 + 2, t[0]); hl(c, 14, 15, y0 + 2, t[0]); hl(c, 8, 9, y0 + 3, t[1]); hl(c, 14, 15, y0 + 3, t[1]);
        vl(c, 12, y0 + 1, y1 - 1, t[1]);
        if (P.held === 'rifle') c.line(9, y0, 15, y1 - 1, WD[1]);
      } else if (P.held !== 'rifle') vl(c, 12, y0, y1, t[1]);
      if (P.belt) { hl(c, 7, 16, y1, P.belt[2]); if (!back) { c.put(11, y1, ST[3]); c.put(12, y1, ST[2]); } }
      break;
    case 'coverall':
      if (!back) {
        hl(c, 9, 10, y0, t[3]); hl(c, 13, 14, y0, t[3]);
        vl(c, 12, y0 + 1, y1 + 1, t[0]);
        hl(c, 13, 15, y0 + 2, t[0]); hl(c, 13, 15, y0 + 3, t[1]);
        c.put(14, y0 + 2, ST[3]);
        if (P.grease) { c.put(9, y0 + 5, t[0]); c.put(10, y0 + 6, t[0]); c.put(15, y1 + 2, t[0]); }
      } else { hl(c, 9, 14, y0, t[1]); hl(c, 9, 10, y0 + 4, t[1]); }
      hl(c, 7, 16, y1, t[1]);
      break;
    case 'dress':
      if (!back) {
        hl(c, 9, 10, y0, P.top[3]); hl(c, 13, 14, y0, P.top[3]); c.put(11, y0, P.skin[1]); c.put(12, y0, P.skin[1]);
        c.put(12, y0 + 2, ST[3]); c.put(12, y0 + 4, ST[3]);
        // Small red-cross pin on the chest.
        c.put(14, y0 + 2, RD[3]); c.put(14, y0 + 3, RD[3]); c.put(13, y0 + 2, RD[3]); c.put(15, y0 + 2, RD[3]); c.put(14, y0 + 1, RD[3]);
      } else { hl(c, 9, 14, y0, t[3]); hl(c, 10, 13, y1 - 1, t[3]); c.put(11, y1, t[1]); c.put(12, y1, t[1]); }
      hl(c, 7, 16, y1 - 1, t[1]);
      break;
    case 'officer':
      if (!back) {
        hl(c, 10, 13, y0, P.shirt[3]); hl(c, 11, 12, y0 + 1, P.shirt[2]);
        vl(c, 11, y0, y0 + 3, P.tie[0]); vl(c, 12, y0, y0 + 3, P.tie[1]);
        vl(c, 10, y0 + 1, y0 + 3, t[0]); vl(c, 13, y0 + 1, y0 + 3, t[0]);
        c.put(14, y0 + 2, RD[3]); c.put(15, y0 + 2, GD[2]); c.put(14, y0 + 3, NV[4]); c.put(15, y0 + 3, RD[2]);
        c.put(12, y0 + 5, GD[2]); c.put(11, y0 + 5, t[1]);
        c.put(9, y0 + 1, GD[2]);
        c.line(9, y0 + 1, 14, y1 - 1, P.belt[1]);
      } else c.line(14, y0 + 1, 9, y1 - 1, P.belt[1]);
      c.put(8, y0, GD[2]); c.put(15, y0, GD[2]);
      hl(c, 7, 16, y1, P.belt[2]); if (!back) c.put(12, y1, GD[2]);
      break;
  }
}

function drawTorsoFront(c, P, o, back, ch = 0) {
  const t = P.top, y0 = 15 + o - ch, y1 = 22 + o;
  for (let y = y0; y <= y1; y++) {
    const xa = y === y0 ? 8 : 7, xb = y === y0 ? 15 : 16;
    for (let x = xa; x <= xb; x++) {
      let col = t[2];
      if (y === y0) col = t[3];
      else if (x === 7 || x === 16) col = t[1];
      else if (x === 8 && !back) col = t[3];
      else if (x === 15) col = t[1];
      if (y === y1 && y !== y0) col = t[1];
      c.put(x, y, col);
    }
  }
  if (P.skirt) for (let y = y1 + 1; y <= 25 + Math.max(0, o); y++) {
    const xa = y >= 25 ? 6 : 7, xb = y >= 25 ? 17 : 16;
    for (let x = xa; x <= xb; x++) c.put(x, y, (x - xa) % 3 === 2 ? t[1] : x === xa ? t[3] : t[2]);
  }
  torsoDetailsFront(c, P, o, back, ch);
}

function torsoDetailsSide(c, P, o, ch = 0) {
  const t = P.top, y0 = 15 + o - ch, y1 = 22 + o;
  switch (P.topStyle) {
    case 'jacket':
      hl(c, 10, 13, y0, P.collar[3]); hl(c, 10, 12, y0 + 1, P.collar[2]); c.put(14, y0 + 1, P.collar[2]); c.put(14, y0 + 2, P.collar[1]);
      hl(c, 12, 13, y0 + 4, t[1]);
      for (let x = 9; x <= 15; x++) c.put(x, y1, (x & 1) ? t[0] : t[1]);
      break;
    case 'suit':
      hl(c, 13, 14, y0, P.shirt[3]); c.put(14, y0 + 1, P.shirt[2]);
      vl(c, 15, y0 + 1, y0 + 4, P.tie[2]); c.put(15, y0, P.tie[3]);
      vl(c, 13, y0 + 1, y0 + 3, t[0]);
      for (let y = y0; y <= y1; y++) for (let x = 9; x <= 15; x++) if (hash(x, y - o, 813) < .14 && c.get(x, y) === t[2]) c.put(x, y, hash(x, y - o, 814) < .5 ? t[1] : t[3]);
      break;
    case 'field':
      c.put(13, y0, t[3]); c.put(14, y0, t[0]); hl(c, 13, 14, y0 + 2, t[0]); hl(c, 13, 14, y0 + 3, t[1]);
      if (P.belt) { hl(c, 9, 15, y1, P.belt[2]); c.put(15, y1, ST[3]); }
      break;
    case 'coverall':
      c.put(13, y0, t[3]); vl(c, 15, y0 + 1, y1, t[0]); hl(c, 13, 14, y0 + 2, t[0]); hl(c, 9, 15, y1, t[1]);
      if (P.grease) c.put(11, y0 + 5, t[0]);
      break;
    case 'dress':
      hl(c, 12, 14, y0, t[3]); c.put(15, y0 + 2, ST[3]); c.put(14, y0 + 2, RD[3]); hl(c, 9, 15, y1 - 1, t[1]);
      break;
    case 'officer':
      hl(c, 13, 14, y0, P.shirt[3]); vl(c, 15, y0, y0 + 3, P.tie[0]); vl(c, 13, y0 + 1, y0 + 3, t[0]);
      c.put(13, y0 + 2, RD[3]); c.put(14, y0 + 2, GD[2]); c.put(14, y0 + 3, NV[4]);
      c.put(10, y0, GD[2]); c.put(15, y0 + 5, GD[2]);
      hl(c, 9, 15, y1, P.belt[2]);
      break;
  }
}

function drawTorsoSide(c, P, o, ch = 0) {
  const t = P.top, y0 = 15 + o - ch, y1 = 22 + o;
  for (let y = y0; y <= y1; y++) {
    const xa = y === y0 ? 10 : 9, xb = y === y0 ? 14 : 15;
    for (let x = xa; x <= xb; x++) c.put(x, y, y === y0 ? t[3] : y === y1 ? t[1] : x === 15 ? t[1] : t[2]);
  }
  if (P.skirt) for (let y = y1 + 1; y <= 25 + Math.max(0, o); y++) {
    const xa = y >= 25 ? 8 : 9, xb = y >= 25 ? 16 : 15;
    for (let x = xa; x <= xb; x++) c.put(x, y, x === xb ? t[1] : (x - xa) % 3 === 2 ? t[1] : t[2]);
  }
  torsoDetailsSide(c, P, o, ch);
}

// Pilot's silk scarf. The knot rides on the shoulders; the loose tail follows the lagging head
// (walk) or streams out behind (run), rippling with the frame phase.
function drawScarf(c, P, view, pose) {
  if (!P.scarf) return;
  const s = P.scarf, o = pose.bob || 0, y0 = 15 + o - (pose.chest || 0);
  const ho = pose.head !== undefined ? pose.head : o, lr = Math.max(-1, Math.min(1, ho - o));
  const ph = pose.phase || 0, run = !!pose.run;
  if (view === 's') {
    hl(c, 10, 13, y0 - 1, s[2]); hl(c, 10, 13, y0, s[3]); hl(c, 11, 12, y0 + 1, s[2]);
    if (!run) { vl(c, 13, y0 + 1, y0 + 3 + lr, s[2]); c.put(13, y0 + 4 + lr, s[1]); }
    else {
      // Tail blown back over the right shoulder, flicking up and down.
      const w = [0, 1, 1, 0][ph & 3];
      c.put(14, y0 - 1, s[2]); c.put(15, y0 - 1 - w, s[3]); c.put(16, y0 - 1 - w, s[2]); c.put(16, y0 - w, s[1]);
      c.put(17, y0 - 2 + w, s[2]); c.put(18, y0 - 2 + w * 2, s[1]);
    }
  } else if (view === 'n') {
    hl(c, 10, 13, y0 - 1, s[2]);
    if (run) for (let k = 0; k < 5; k++) {
      // Streaming back toward the camera, down over the jacket.
      const x = 12 + Math.round(Math.sin(k * 1.1 - ph * Math.PI / 2) * Math.min(1, k / 2)) + (k > 2 ? 1 : 0);
      c.put(x, y0 + k, s[k ? 2 : 3]); c.put(x + 1, y0 + k, s[1]);
    }
  } else {
    hl(c, 13, 15, y0 - 1, s[2]); c.put(14, y0, s[3]); c.put(15, y0, s[2]);
    if (!run) vl(c, 15, y0 + 1, y0 + 3 + lr, s[2]);
    else for (let i = 0; i <= 7; i++) {
      // Streams back and a little up off the collar, a travelling ripple along its length.
      const x = 11 - i, a = Math.min(1.1, i / 3);
      const y = Math.round(y0 - 1 - i * .3 + Math.sin(i * 1.05 - ph * Math.PI / 2) * a);
      c.put(x, y, s[i < 3 ? 3 : 2]); c.put(x, y + 1, s[i < 5 ? 1 : 0]);
      if (i === 7) c.put(x, y + 2, s[0]);
    }
  }
}

// Front/back arm on screen side 0 (left, x 5..6) or 1 (right, x 17..18). Returns the hand position.
// a = { dy: hand drop (+ forward toward the camera, - swung back), dx: hand pulled inward, elbow: elbow out }.
function drawArmFront(c, P, side, a, o, ch, armband) {
  const t = P.top, sk = P.skin, x0 = side ? 17 : 5, top = 16 + o - ch;
  const handY = 22 + o + (a.dy || 0), inw = a.dx ? (side ? -a.dx : a.dx) : 0;
  for (let y = top; y < handY; y++) {
    c.put(x0, y, side ? t[2] : t[3]); c.put(x0 + 1, y, side ? t[1] : t[2]);
    if (y === top) { c.put(x0, y, t[3]); }
  }
  if (a.elbow) c.put(side ? x0 + 2 : x0 - 1, top + 2, side ? t[1] : t[2]);
  const hx = x0 + inw;
  if (P.topStyle === 'jacket') hl(c, hx, hx + 1, handY - 1, t[0]);
  if (armband) { hl(c, x0, x0 + 1, top + 2, RD[3]); hl(c, x0, x0 + 1, top + 3, RD[2]); }
  c.put(hx, handY, sk[2]); c.put(hx + 1, handY, side ? sk[1] : sk[2]);
  c.put(hx, handY + 1, sk[1]); c.put(hx + 1, handY + 1, sk[1]);
  return { x: hx, y: handY };
}
// Swing value (-1 back .. 1 forward) -> front arm shape. Walk: straight arm, hand +-2 px.
// Run: elbow bent, so the hand rides higher, tucks inward when forward and the elbow juts out when back.
function frontArm(s, run) {
  if (!run) return { dy: Math.round(s * 2) };
  return { dy: Math.round(s * 2) - 1, dx: s > .3 ? 1 : 0, elbow: s < -.3 };
}

// Professor talk gesture with the screen-right arm (level 0 rest, 1 hand at chest, 2 raised finger).
function drawGestureArm(c, P, level, o, ch = 0) {
  if (!level) return drawArmFront(c, P, 1, { dy: 0 }, o, ch, false);
  const t = P.top, sk = P.skin, top = 16 + o - ch;
  if (level === 1) {
    for (let y = top; y <= top + 3; y++) { c.put(17, y, t[2]); c.put(18, y, t[1]); }
    hl(c, 14, 18, top + 4, t[2]); hl(c, 14, 18, top + 5, t[1]);
    c.put(13, top + 4, sk[2]); c.put(12, top + 4, sk[2]); c.put(13, top + 5, sk[1]); c.put(12, top + 5, sk[1]);
    return { x: 12, y: top + 4 };
  }
  for (let y = top; y <= top + 3; y++) { c.put(17, y, t[2]); c.put(18, y, t[1]); }
  vl(c, 19, top - 1, top + 3, t[2]); vl(c, 20, top - 1, top + 3, t[1]);
  c.put(19, top - 2, sk[2]); c.put(20, top - 2, sk[1]); c.put(19, top - 3, sk[2]); c.put(20, top - 3, sk[1]); c.put(19, top - 4, sk[2]);
  return { x: 19, y: top - 3 };
}

// Side arm, straight (walk/idle): shoulder at x 11, swing -1..1 (positive = forward/right).
function drawArmSide(c, P, swing, o, ch, near, armband) {
  const t = P.top, sk = P.skin, top = 16 + o - ch, handY = 22 + o - (Math.abs(swing) > .5 ? 1 : 0);
  const base = near ? 11 : 10, span = handY - top;
  let xc = base;
  for (let y = top; y < handY; y++) {
    xc = base + Math.round(swing * 3 * (y - top) / span);
    if (near) {
      c.put(xc - 1, y, y === top ? t[2] : t[0]);
      c.put(xc, y, t[3]); c.put(xc + 1, y, t[2]); c.put(xc + 2, y, t[1]);
      if (armband && y >= top + 2 && y <= top + 3) { c.put(xc, y, RD[3]); c.put(xc + 1, y, RD[3]); c.put(xc + 2, y, RD[2]); }
    } else { c.put(xc, y, t[1]); c.put(xc + 1, y, t[1]); c.put(xc + 2, y, t[0]); }
  }
  if (near && P.topStyle === 'jacket') hl(c, xc, xc + 2, handY - 1, t[0]);
  const hx = xc + (swing > .3 ? 1 : 0);
  const s0 = near ? sk[2] : sk[1], s1 = near ? sk[1] : sk[0];
  c.put(hx, handY, s0); c.put(hx + 1, handY, s0); c.put(hx, handY + 1, s1); c.put(hx + 1, handY + 1, s1);
  return { x: hx, y: handY };
}

function linePoints(x0, y0, x1, y1) {
  const pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return pts;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Side arm, bent at the elbow (run). s -1 = elbow driven back, +1 = fist punched forward to the chin.
// The near arm gets a dark rim where it crosses the torso so it never melts into the jacket.
function drawArmSideBent(c, P, s, o, ch, near, armband) {
  const t = P.top, sk = P.skin, sx = near ? 12 : 11, sy = 16 + o - ch;
  const au = s * (s < 0 ? 1.35 : .95), af = au + 1.45, ua = s < 0 ? 3.7 - s * .6 : 3.7;
  const ex = Math.round(sx + Math.sin(au) * ua), ey = Math.round(sy + Math.cos(au) * ua);
  const hx = Math.round(ex + Math.sin(af) * 3), hy = Math.round(ey + Math.cos(af) * 3);
  const A = new Canvas(FW, FH);
  const brush = (pts, upper) => pts.forEach(([x, y]) => {
    A.put(x, y, near ? (upper ? t[3] : t[2]) : t[1]); A.put(x + 1, y, near ? t[2] : t[1]);
    A.put(x, y + 1, near ? t[2] : t[0]); A.put(x + 1, y + 1, near ? t[1] : t[0]);
  });
  brush(linePoints(sx, sy, ex, ey), true);
  brush(linePoints(ex, ey, hx, hy), false);
  if (armband && near) { const m = linePoints(sx, sy, ex, ey)[1]; A.put(m[0], m[1], RD[3]); A.put(m[0] + 1, m[1], RD[3]); A.put(m[0], m[1] + 1, RD[2]); A.put(m[0] + 1, m[1] + 1, RD[2]); }
  A.put(hx, hy, near ? sk[2] : sk[1]); A.put(hx + 1, hy, near ? sk[2] : sk[1]);
  A.put(hx, hy + 1, near ? sk[1] : sk[0]); A.put(hx + 1, hy + 1, near ? sk[1] : sk[0]);
  if (near) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (A.get(x, y) || !c.get(x, y)) continue;
    if (A.get(x - 1, y) || A.get(x + 1, y) || A.get(x, y - 1) || A.get(x, y + 1)) c.put(x, y, t[0]);
  }
  c.blit(A, 0, 0);
  return { x: hx, y: hy };
}

// ---------------------------------------------------------------- held items
function drawBook(c, hand, dir) {
  const { x, y } = hand;
  if (dir === 'e') {
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 2; xx++) c.put(xx, yy, yy === y - 2 ? CR[2] : xx === x - 1 ? RD[0] : RD[2]);
    c.put(x + 1, y, GD[2]);
  } else {
    for (let yy = y - 1; yy <= y + 3; yy++) for (let xx = x - 1; xx <= x + 1; xx++) c.put(xx, yy, yy === y + 3 ? CR[2] : xx === x - 1 ? RD[0] : xx === x + 1 ? RD[1] : RD[2]);
    c.put(x, y + 1, GD[2]);
  }
}
function drawWrench(c, hand) {
  const x = hand.x + 1, y = hand.y;
  vl(c, x, y + 2, y + 5, ST[3]);
  c.put(x - 1, y + 5, ST[2]); c.put(x + 1, y + 5, ST[2]); c.put(x - 1, y + 6, ST[2]); c.put(x + 1, y + 6, ST[2]);
  c.put(x, y + 2, ST[4]);
}
function drawRifle(c, x0, y0, x1, y1) {
  // Muzzle (x0,y0) to butt (x1,y1); steel barrel on the upper 45 percent, wooden stock below.
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (t < .45) { c.put(x, y, ST[2]); c.put(x + 1, y, ST[1]); }
    else { c.put(x, y, WD[3]); c.put(x + 1, y, WD[1]); if (t > .8) c.put(x - 1, y, WD[2]); }
  }
}

// ---------------------------------------------------------------- full figure
function renderFront(P, pose, back) {
  const c = new Canvas(FW, FH), o = pose.bob || 0, ch = pose.chest || 0, run = !!pose.run;
  const ho = pose.head !== undefined ? pose.head : o;
  // Character's right hand is screen-left from the front and screen-right from behind.
  const itemSide = back ? 1 : 0;
  const armShape = i => {
    if (i === itemSide && P.held === 'rifle') return run ? { dy: -1 } : { dy: 0 };   // hand on the sling
    if (i === itemSide && P.held === 'book' && run) return { dy: -2, dx: 1 };        // book hugged to the chest
    return frontArm(pose.arms[i], run);
  };
  const arms = [armShape(0), armShape(1)];
  if (P.held === 'rifle' && !back) drawRifle(c, 5, 3 + o, 7, 22 + o);
  if ((P.held === 'book' || P.held === 'wrench') && back) {
    const hy = 22 + o + (arms[itemSide].dy || 0);
    if (P.held === 'book') drawBook(c, { x: 18, y: hy }, 'n'); else drawWrench(c, { x: 17, y: hy });
  }
  drawLegsFront(c, P, pose);
  drawTorsoFront(c, P, o, back, ch);
  if (P.held === 'rifle' && back) drawRifle(c, 18, 3 + o, 12, 25 + o);
  const hands = [];
  const armbandSide = back ? 0 : 1; // character's left arm
  hands[0] = drawArmFront(c, P, 0, arms[0], o, ch, P.armband && armbandSide === 0);
  hands[1] = pose.gesture !== undefined ? drawGestureArm(c, P, pose.gesture, o, ch) : drawArmFront(c, P, 1, arms[1], o, ch, P.armband && armbandSide === 1);
  drawScarf(c, P, back ? 'n' : 's', pose);
  drawNeck(c, P, 's', ho, 15 + o - ch);
  drawHead(c, P, back ? 'n' : 's', ho, pose.mouth, pose.blink);
  if (!back && P.held === 'book') drawBook(c, hands[0], 's');
  if (!back && P.held === 'wrench') drawWrench(c, hands[0]);
  return c.outline(K);
}

function renderSide(P, pose) {
  const c = new Canvas(FW, FH), o = pose.bob || 0, ch = pose.chest || 0, run = !!pose.run, lean = pose.lean || 0;
  const ho = pose.head !== undefined ? pose.head : o;
  // Torso, arms, head and held items share the lean; legs stay planted on the hip line.
  const layer = fn => { const t = new Canvas(FW, FH); const r = fn(t); c.blit(t, lean, 0); return r; };
  let near = pose.arms;
  if (P.held === 'rifle') near = run ? .2 : 0;          // hand stays on the sling
  if (P.held === 'book' && run) near = .55;             // book hugged to the chest
  const arm = (t, s, isNear) => run ? drawArmSideBent(t, P, s, o, ch, isNear, isNear && P.armband)
    : drawArmSide(t, P, s, o, ch, isNear, isNear && P.armband);
  layer(t => {
    if (P.held === 'rifle') drawRifle(t, 6, 2 + o, 13, 25 + o);
    arm(t, -pose.arms, false);
  });
  drawLegsSide(c, P, pose);
  layer(t => {
    drawTorsoSide(t, P, o, ch);
    drawScarf(t, P, 'e', pose);
    drawNeck(t, P, 'e', ho, 15 + o - ch);
    drawHead(t, P, 'e', ho, pose.mouth, pose.blink);
    const hand = arm(t, near, true);
    if (P.held === 'book') drawBook(t, hand, 'e');
    if (P.held === 'wrench') drawWrench(t, hand);
  });
  return c.outline(K);
}

function mirror(c) { const m = new Canvas(c.w, c.h); for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) m.px[y * c.w + x] = c.px[y * c.w + (c.w - 1 - x)]; return m; }

// ---------------------------------------------------------------- cycles (8 frames each)
// Walk/run follow the classic 8-frame layout: 0 contact (right leg forward), 1 down, 2 passing,
// 3 up, 4 contact (left leg forward), 5 down, 6 passing, 7 up. Frames 0 and 4 have a foot planted
// (the view plays footsteps / dust there). Arms swing opposite the legs; the head (with hair and
// the scarf tail) uses the previous frame's bob so it trails the body by one frame.
const N8 = [0, 1, 2, 3, 4, 5, 6, 7];
const at8 = (a, i) => a[((i % 8) + 8) % 8];
const SWING = i => -Math.cos(Math.PI * i / 4);            // character's right arm: -1 back at frame 0
const lagHead = (bob, i) => Math.max(bob[i] - 1, Math.min(bob[i] + 1, at8(bob, i - 1)));

// Idle: breathe in (shoulders up) on 1-3, head follows one frame later, blink on frame 6.
const IDLE_CHEST = [0, 1, 1, 1, 0, 0, 0, 0];
const idleBase = i => ({ bob: 0, chest: IDLE_CHEST[i], head: -at8(IDLE_CHEST, i - 1), blink: i === 6, phase: i });

const WALK = {
  bob: [0, 1, 0, -1, 0, 1, 0, -1],
  // Front view, character's right leg (+ lifted, -1 planted forward toward the camera).
  lift: [-1, 0, 0, 0, 0, 1, 2, 1],
  // Side view, character's right (near) leg.
  side: [{ fx: 3 }, { fx: 1, kx: 2 }, { fx: 0, kx: 0 }, { fx: -2, kx: -1, toe: 1 },
    { fx: -3, toe: 1 }, { fx: -2, lift: 1, kx: 0 }, { fx: 0, lift: 2, kx: 2 }, { fx: 2, lift: 1, kx: 2 }],
  lean: 0, run: false
};
const RUN = {
  // Contact squashes (+1), push-off springs up (-2), frames 3/7 are airborne (-1).
  bob: [1, 0, -2, -1, 1, 0, -2, -1],
  lift: [-1, 0, 0, 1, 2, 3, 2, 1],
  side: [{ fx: 4, kx: 2 }, { fx: 1, kx: 2 }, { fx: -3, kx: -1, toe: 1 }, { fx: -4, lift: 2, kx: -1 },
    { fx: -2, lift: 3, kx: 0 }, { fx: 0, lift: 3, kx: 3 }, { fx: 2, lift: 3, kx: 4 }, { fx: 4, lift: 1, kx: 3 }],
  lean: 1, run: true
};

function cyclePose(C, i, view) {
  const base = { bob: C.bob[i], head: lagHead(C.bob, i), run: C.run, phase: i };
  if (view === 'side') return { ...base, lean: C.lean, legs: [at8(C.side, i + 4), C.side[i]], arms: SWING(i) };
  const r = C.lift[i], l = at8(C.lift, i + 4), ar = SWING(i), al = -ar;
  // Front: screen-left is the character's right; back: screen-left is the character's left.
  return view === 'n' ? { ...base, lift: [l, r], arms: [al, ar] } : { ...base, lift: [r, l], arms: [ar, al] };
}

function frames(P, dir, kind) {
  const side = dir === 'e' || dir === 'w';
  let poses;
  if (kind === 'idle') poses = N8.map(i => side ? { ...idleBase(i), legs: [{ fx: -1 }, { fx: 1 }], arms: 0 } : { ...idleBase(i), lift: [0, 0], arms: [0, 0] });
  else poses = N8.map(i => cyclePose(kind === 'run' ? RUN : WALK, i, side ? 'side' : dir));
  if (!side) return poses.map(p => renderFront(P, p, dir === 'n'));
  const f = poses.map(p => renderSide(P, p));
  return dir === 'w' ? f.map(mirror) : f;
}

function talkFrames(P) {
  const bob = [0, 0, -1, 0];
  return [0, 1, 2, 1].map((g, i) => renderFront(P, {
    bob: bob[i], head: bob[(i + 3) % 4], lift: [0, 0], arms: [0, 0], gesture: g, mouth: i === 1 || i === 2, blink: false
  }, false));
}

// Kicked-up dust puff for running feet: 16x8, anchor (8,7) = the ground point under the heel.
// Two tufts curl outward and up, a third rises in the middle, then the cloud breaks up and fades.
// Masks are the left half (x 0..7) and mirror onto the right; shading is derived from the shape
// (lit crown, dusty underside) so it matches the top-left light of the characters.
const DUST_W = 16, DUST_H = 8, DUST_ANCHOR = [8, 7];
const DUST_MASKS = [
  ['........', '........', '........', '........', '....##..', '...####.', '...#####', '....###.'],
  ['........', '........', '........', '..##....', '.####.##', '.#######', '.######.', '..###...'],
  ['........', '......##', '.##..###', '#####.##', '########', '.######.', '..####..', '........'],
  ['......#.', '.#.#.##.', '#.###.#.', '.####.#.', '#.#.##..', '.#.#.#..', '........', '........'],
  ['.....#..', '.#..#...', '#.#...#.', '..#..#..', '.#......', '........', '........', '........']
];
// Earthy, semi-transparent ramp (the 0.15 review found the cream CR ramp read as white cloud on grass).
const DUST = R('#5c4a36', '#7f6a50', '#a08a6c', '#bba687');
function dustFrames() {
  const alpha = [215, 205, 185, 145, 95];
  return DUST_MASKS.map((rows, f) => {
    const on = (x, y) => {
      if (x < 0 || y < 0 || x >= DUST_W || y >= DUST_H) return false;
      return rows[y][x < 8 ? x : 15 - x] === '#';
    };
    const c = new Canvas(DUST_W, DUST_H), fade = f >= 3 ? f - 2 : 0;
    for (let y = 0; y < DUST_H; y++) for (let x = 0; x < DUST_W; x++) {
      if (!on(x, y)) continue;
      let k = 2;
      if (!on(x, y - 1)) k = 3;
      else if (!on(x, y + 1)) k = y >= 6 ? 0 : 1;
      k = Math.max(0, k - fade);
      c.put(x, y, withAlpha(DUST[k], alpha[f]));
    }
    return c;
  });
}

function shadowFrame() {
  const c = new Canvas(FW, FH);
  // Wide and dark enough to read around the boots (0.15 review: the old 14x4 shadow vanished under the feet).
  c.ellipse(12, 30, 9, 2.6, [0, 0, 0, 80]);
  c.ellipse(12, 30, 7, 2, [0, 0, 0, 125]);
  return c;
}

function questMarkerFrames() {
  const bob = [0, -1, -2, -2, -1, 0];
  return bob.map((b, i) => {
    const c = new Canvas(8, 16), y = 3 + b;
    const rows = [[2, 5], [2, 5], [2, 5], [3, 4], [3, 4], [3, 4]];
    rows.forEach(([a, z], k) => { for (let x = a; x <= z; x++) c.put(x, y + k, x === a ? GD[3] : x === z ? GD[1] : GD[2]); });
    for (let x = 3; x <= 4; x++) { c.put(x, y + 8, x === 3 ? GD[3] : GD[1]); c.put(x, y + 9, GD[1]); }
    // Glint travelling down the bar.
    const g = i % 3; c.put(3, y + g * 2, hex('#fff6c8'));
    return c.outline(K);
  });
}

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
  } else {
    hl(fig, 21, 26, 30, P.lips || sk[0]); hl(fig, 22, 25, 31, P.lips ? P.lips : sk[3]);
    if (P.lips) hl(fig, 22, 25, 31, hex('#c8706a'));
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
  } else if (style === 'crop') {
    for (let y = 12; y <= 26; y++) for (const x of [15, 16, 31, 32]) if (y < 22 || x === 16 || x === 31) put(x, y, x > 30 ? 1 : 2);
    if (P.portrait.age > 40) for (let y = 19; y <= 21; y++) { put(15, y, 3); put(32, y, 3); }
  }
}

function portraitHat(f, P) {
  if (P.goggles) {
    // Flying goggles pushed up on the forehead.
    for (let x = 12; x <= 35; x++) f.put(x, 11 + (x < 16 || x > 32 ? 1 : 0), hex('#2a1a10'));
    for (let x = 12; x <= 35; x++) if (x < 16 || x > 32) f.put(x, 12 + (x < 14 || x > 34 ? 1 : 0), hex('#3d2718'));
    for (const cx of [19.5, 28.5]) {
      for (let y = 7; y <= 14; y++) for (let x = Math.floor(cx - 5); x <= cx + 5; x++) {
        const d = Math.hypot((x + .5 - cx) / 3.6, (y + .5 - 10.5) / 2.9);
        if (d > 1) continue;
        f.put(x, y, d > .7 ? (y < 10 ? GD[3] : x < cx ? GD[2] : GD[1]) : (y < 10 && x < cx ? GL[2] : GL[1]));
      }
      f.put(Math.floor(cx) - 1, 9, GL[3]); f.put(Math.floor(cx), 9, GL[2]);
    }
    f.put(24, 10, GD[1]); f.put(23, 10, GD[2]); f.put(24, 11, GD[0]); f.put(23, 11, GD[1]);
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

// ---------------------------------------------------------------- previews
function sheetBackground(w, h) {
  const s = new Canvas(w, h);
  return s.fill((x, y) => ((x >> 3) + (y >> 3)) % 2 ? hex('#3a3f36') : hex('#2c3029'));
}

function charactersSheet(all) {
  // One block per character: rows idle / walk / run, columns s | e | n | w (8 frames each).
  // A faint baseline at row 30 (the anchor) shows that planted feet sit on the ground line.
  const SC = 2, cell = FW * SC + 4, rowH = FH * SC + 4, pad = 10, gap = 10;
  const kinds = ['idle', 'walk', 'run'];
  const blockW = 4 * 8 * cell + 3 * gap, blockH = kinds.length * rowH + pad;
  const ids = Object.keys(all);
  const extraH = rowH + pad;
  const sheet = sheetBackground(blockW + 2 * pad, ids.length * blockH + extraH + pad);
  const shadow = shadowFrame();
  const put = (f, x, y) => {
    const tmp = new Canvas(FW, FH); tmp.blit(shadow, 0, 0);
    for (let xx = 0; xx < FW; xx += 2) tmp.put(xx, ANCHOR[1], hex('#5a6050'));
    tmp.blit(f, 0, 0); sheet.blit(tmp.scaled(SC), x, y);
  };
  ids.forEach((id, i) => {
    const bx = pad, by = pad + i * blockH, A = all[id];
    sheet.rect(bx - 4, by - 4, blockW + 8, blockH - pad + 4, hex('#232720'));
    kinds.forEach((k, r) => {
      let x = bx;
      for (const d of 'senw') { for (const f of A[k + '_' + d]) { put(f, x, by + r * rowH); x += cell; } x += gap; }
    });
  });
  const ty = pad + ids.length * blockH;
  let x = pad;
  for (const f of all.professor.talk_s) { put(f, x, ty); x += cell; }
  x += gap;
  for (const f of questMarkerFrames()) { sheet.blit(f.scaled(SC), x, ty); x += 8 * SC + 6; }
  x += gap;
  for (const f of dustFrames()) { sheet.blit(f.scaled(SC * 2), x, ty + 8); x += DUST_W * SC * 2 + 6; }
  return sheet;
}

function portraitsSheet(ports) {
  const SC = 4, pad = 10, cell = 48 * SC + pad;
  const ids = Object.keys(ports);
  const sheet = sheetBackground(pad + 6 * cell, pad + 2 * cell);
  ids.forEach((id, i) => ports[id].forEach((f, k) => sheet.blit(f.scaled(SC), pad + i * cell, pad + k * cell)));
  return sheet;
}

// ---------------------------------------------------------------- build
function buildAll() {
  const out = {};
  for (const [id, P] of Object.entries(CHARACTERS)) {
    const A = {};
    for (const d of 'senw') for (const k of ['idle', 'walk', 'run']) A[k + '_' + d] = frames(P, d, k);
    if (id === 'professor') A.talk_s = talkFrames(P);
    out[id] = A;
  }
  return out;
}

function buildPortraits() {
  const out = {};
  for (const [id, P] of Object.entries(CHARACTERS)) out[id] = [portrait(P, false), portrait(P, true)];
  return out;
}

const PREVIEW = path.resolve(__dirname, '../../SourceAssets/PixelArt/Pixel1944');

// Extra contact sheets (one block per character, portraits side by side). Names differ from the
// per-group sheets forge writes (preview-characters.png etc.) so the two never race.
function writePreviews(dir = PREVIEW, all = buildAll(), ports = buildPortraits()) {
  fs.mkdirSync(dir, { recursive: true });
  return Promise.all([
    charactersSheet(all).png(path.join(dir, 'preview-characters-sheet.png')),
    portraitsSheet(ports).png(path.join(dir, 'preview-portraits-sheet.png'))
  ]);
}

function build(add) {
  const all = buildAll(), ports = buildPortraits();
  const opt = (fps, loop = true) => ({ fps, loop, anchor: ANCHOR });
  for (const [id, A] of Object.entries(all)) {
    for (const d of 'senw') {
      add('Characters', `chr_${id}_idle_${d}`, A['idle_' + d], opt(5));
      add('Characters', `chr_${id}_walk_${d}`, A['walk_' + d], opt(16));
      add('Characters', `chr_${id}_run_${d}`, A['run_' + d], opt(20));
    }
    if (A.talk_s) add('Characters', `chr_${id}_talk_s`, A.talk_s, opt(6));
  }
  add('Characters', 'chr_shadow', [shadowFrame()], opt(1));
  add('Effects', 'fx_quest_marker', questMarkerFrames(), { fps: 8, loop: true });
  add('Effects', 'fx_dust', dustFrames(), { fps: 14, loop: false, anchor: DUST_ANCHOR });
  for (const [id, f] of Object.entries(ports)) add('Portraits', `portrait_${id}`, f, { fps: 4, loop: true });
  writePreviews(PREVIEW, all, ports).catch(e => { console.error('characters preview failed', e); process.exitCode = 1; });
}

module.exports = { build, writePreviews, CHARACTERS, M, renderFront, renderSide, portrait, dustFrames, FW, FH, ANCHOR, DUST_ANCHOR };

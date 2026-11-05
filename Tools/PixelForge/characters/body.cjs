'use strict';
// Characters: body parts (head, legs, torso, scarf, arms).
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, hash } = require('../lib.cjs');
const { CR, GD, ST, RD, GL, WD, NV } = PAL;
const { FW, FH } = require('./palette.cjs');
const { MX, stamp, HEAD, HAIR, HAT, GOGGLES, GLASSES, MUSTACHE } = require('./masks.cjs');

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
  if (P.freckles && !back) for (const [fx, fy] of dir === 'e' ? [[10, 10], [12, 10]] : [[3, 10], [9, 10], [10, 11]]) c.put(X + fx, oy + fy, P.skin[1]);
  const lens = P.goggleLens || [0, GL[1], 0, GL[3]];
  if (P.goggles) stamp(c, GOGGLES[dir], X, oy, { t: hex('#2a1a10'), g: P.goggleLens ? ST[1] : GD[1], L: lens[1], i: lens[3] });
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
  if (P.toolbelt) toolbeltFront(c, P, y1, back);
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
  if (P.toolbelt) toolbeltSide(c, P, y1);
}

// Leather tool belt on the waist line: brass buckle, a pouch on one hip, screwdriver + spanner on the other.
function toolbeltFront(c, P, y1, back) {
  const b = P.toolbelt, [px, tx] = back ? [14, 8] : [8, 15];
  hl(c, 7, 16, y1, b[2]); c.put(7, y1, b[1]); c.put(16, y1, b[1]);
  if (!back) { c.put(11, y1, GD[3]); c.put(12, y1, GD[1]); }
  hl(c, px, px + 1, y1 + 1, b[3]); hl(c, px, px + 1, y1 + 2, b[1]); c.put(px + (back ? 0 : 1), y1 + 1, b[2]);
  c.put(tx, y1 + 1, RD[3]); c.put(tx, y1 + 2, ST[3]);              // screwdriver: red grip, steel shank
  c.put(tx + (back ? -1 : 1), y1 + 1, ST[4]); c.put(tx + (back ? -1 : 1), y1 + 2, ST[2]);   // spanner
}
function toolbeltSide(c, P, y1) {
  const b = P.toolbelt;
  hl(c, 9, 15, y1, b[2]); c.put(15, y1, GD[3]);
  hl(c, 9, 10, y1 + 1, b[3]); hl(c, 9, 10, y1 + 2, b[1]);
  c.put(14, y1 + 1, RD[3]); c.put(14, y1 + 2, ST[3]);
}

// High ponytail. Root at the crown; it sways with the walk phase, streams back on the run.
// view 's' = the tip peeking out behind the head (draw before the torso), 'n' over the back, 'e' behind.
function drawPonytail(c, P, view, ho, pose) {
  const h = P.hair, oy = 1 + ho, ph = pose.phase || 0, run = !!pose.run, walk = pose.walk;
  const sw = Math.sin(ph * Math.PI / 4), tie = P.hairTie || h[0];
  const amp = run ? 1 : walk ? .6 : .15;
  if (view === 's') {
    const dx = Math.round(sw * amp);
    for (let y = oy + 4; y <= oy + 12; y++) {
      const x = 17 + (y > oy + 8 ? 1 + (y > oy + 10 ? dx : 0) : 0);
      c.put(x, y, h[2]); c.put(x + 1, y, y < oy + 11 ? h[1] : h[0]);
    }
    return;
  }
  if (view === 'n') {
    const L = run ? 11 : 12;
    hl(c, 11, 12, oy + 4, tie); hl(c, 11, 12, oy + 5, tie);
    for (let i = 0; i <= L; i++) {
      const u = i / L, x = Math.round(11 + sw * amp * 1.6 * u * u + (u > .2 && u < .7 ? -.4 : 0)), y = oy + 6 + i;
      // Dark rims on both sides keep the tail readable against the back of the head.
      const w = i < 5 ? 4 : i < 9 ? 3 : 2, x0 = x - (w >= 3 ? 1 : 0);
      for (let k = 0; k < w; k++) c.put(x0 + k, y, w === 2 ? h[2 - 2 * k] : k === 0 || k === w - 1 ? h[0] : k === 1 ? h[3] : h[2]);
      if (i === L) hl(c, x0, x0 + w - 1, y, h[0]);
    }
    return;
  }
  // Side: falls from the back of the head; angle 0 = straight down, grows as it streams back (-x).
  const a0 = pose.tail !== undefined ? pose.tail : run ? .78 + .2 * sw : walk ? .5 + .18 * sw : .38 + .04 * sw;
  const L = 9;
  let x = 6, y = oy + 4;
  c.put(7, oy + 3, tie); c.put(7, oy + 4, tie); c.put(6, oy + 3, tie);
  for (let i = 0; i <= L; i++) {
    const u = i / L, a = a0 * (1 - .45 * u) + (run ? .25 * Math.sin(ph * Math.PI / 2 + i * .9) * u : 0);
    const px = Math.round(x), py = Math.round(y), w = i < 3 ? 3 : i < 7 ? 2 : 1;
    if (Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a))) for (let k = 0; k < w; k++) c.put(px - k, py, k === w - 1 && w > 1 ? h[1] : k === 0 ? h[3] : h[2]);
    else for (let k = 0; k < w; k++) c.put(px, py + k, k === 0 ? h[3] : k === w - 1 ? h[1] : h[2]);
    x -= Math.sin(a); y += Math.cos(a);
  }
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
    // Rolled sleeves: cuff, then bare forearm down to the hand.
    if (P.rolled && y >= handY - 3) {
      const cuff = y === handY - 3;
      c.put(x0, y, cuff ? t[3] : side ? sk[1] : sk[2]); c.put(x0 + 1, y, cuff ? t[2] : side ? sk[0] : sk[1]);
    }
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
    if (P.rolled && y >= handY - 3) {
      const cuff = y === handY - 3;
      if (near) { c.put(xc, y, cuff ? t[3] : sk[2]); c.put(xc + 1, y, cuff ? t[3] : sk[2]); c.put(xc + 2, y, cuff ? t[2] : sk[1]); }
      else { c.put(xc, y, cuff ? t[2] : sk[1]); c.put(xc + 1, y, cuff ? t[2] : sk[1]); c.put(xc + 2, y, cuff ? t[1] : sk[0]); }
    }
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
  const sx = near ? 12 : 11, sy = 16 + o - ch;
  const au = s * (s < 0 ? 1.35 : .95), af = au + 1.45, ua = s < 0 ? 3.7 - s * .6 : 3.7;
  return bentArm(c, P, sx, sy, au, ua, af, 3, near, armband);
}

// Two-segment arm from shoulder (sx,sy): upper arm at angle au (0 = straight down, +PI/2 = toward +x),
// length ua; forearm at angle af, length fa. Returns the hand position.
function bentArm(c, P, sx, sy, au, ua, af, fa, near, armband) {
  const t = P.top, sk = P.skin;
  const ex = Math.round(sx + Math.sin(au) * ua), ey = Math.round(sy + Math.cos(au) * ua);
  const hx = Math.round(ex + Math.sin(af) * fa), hy = Math.round(ey + Math.cos(af) * fa);
  const A = new Canvas(FW, FH);
  // Rolled sleeves show the bare forearm.
  const lo = P.rolled ? sk : t;
  const brush = (pts, upper) => pts.forEach(([x, y]) => {
    const r = upper ? t : lo;
    A.put(x, y, near ? (upper ? r[3] : r[2]) : r[1]); A.put(x + 1, y, near ? r[2] : r[1]);
    A.put(x, y + 1, near ? r[2] : r[0]); A.put(x + 1, y + 1, near ? r[1] : r[0]);
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

module.exports = {
  hl, vl, drawHead, drawNeck, drawLegsFront, drawLegsSide, drawTorsoFront, drawTorsoSide,
  drawScarf, drawArmFront, frontArm, drawGestureArm, drawArmSide, drawArmSideBent, bentArm, drawPonytail, linePoints
};

'use strict';
// Characters: held items and the full figure (front/back/side, mirror).
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K } = require('../lib.cjs');
const { CR, GD, ST, RD, WD, FI } = PAL;
const { FW, FH } = require('./palette.cjs');
const {
  vl, drawHead, drawNeck, drawLegsFront, drawLegsSide, drawTorsoFront, drawTorsoSide, drawScarf,
  drawArmFront, frontArm, drawGestureArm, drawArmSide, drawArmSideBent, bentArm, drawPonytail
} = require('./body.cjs');

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

// Big adjustable spanner held in the fist at (hx,hy), pointing along angle a (0 = down, +PI/2 = +x).
// Returns the striking point just past the open jaw (where work sparks fly).
function drawBigWrench(c, hx, hy, a) {
  const ux = Math.sin(a), uy = Math.cos(a), cx = hx + 1, cy = hy + 1;
  const fist = (x, y) => x >= hx && x <= hx + 1 && y >= hy && y <= hy + 1;
  for (let t = -2.2; t <= 3.8; t += .25) {
    const x = Math.floor(cx + ux * t), y = Math.floor(cy + uy * t);
    if (!fist(x, y)) c.put(x, y, t < -1 ? ST[2] : ST[3]);
  }
  const hcx = cx + ux * 4.8, hcy = cy + uy * 4.8;
  for (let y = Math.floor(hcy - 3); y <= hcy + 3; y++) for (let x = Math.floor(hcx - 3); x <= hcx + 3; x++) {
    const qx = x + .5 - hcx, qy = y + .5 - hcy, al = qx * ux + qy * uy, pe = qy * ux - qx * uy;
    if (Math.abs(pe) > 1.6 || al < -1.3 || al > 1.6) continue;
    if (Math.abs(pe) < .65 && al > .1) continue;                 // open jaw
    if (pe > .65 && al > .9) continue;                            // short lower jaw
    c.put(x, y, al < -.6 ? ST[2] : pe < 0 ? ST[4] : ST[3]);
  }
  return { x: Math.floor(hcx + ux * 1.6), y: Math.floor(hcy + uy * 1.6) };
}

// Work sparks: 2 = impact burst, 1 = scattered embers flying off.
function drawSpark(c, x, y, k) {
  if (k === 2) {
    c.put(x, y, FI[4]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.put(x + dx, y + dy, FI[3]);
    for (const [dx, dy] of [[2, -2], [-2, -1], [2, 1], [-1, 2], [0, -3], [3, -1]]) c.put(x + dx, y + dy, dx * dx + dy * dy > 5 ? FI[2] : FI[3]);
  } else for (const [dx, dy, col] of [[3, -3, FI[3]], [-2, -3, FI[2]], [4, 0, FI[2]], [-3, 1, FI[3]], [1, 3, FI[1]]]) c.put(x + dx, y + dy, col);
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
  const work = pose.work;
  if (P.hairStyle === 'ponytail' && !back) drawPonytail(c, P, 's', ho, pose);
  if (P.held === 'rifle' && !back) drawRifle(c, 5, 3 + o, 7, 22 + o);
  if ((P.held === 'book' || P.held === 'wrench') && back) {
    const hy = 22 + o + (arms[itemSide].dy || 0);
    if (P.held === 'book') drawBook(c, { x: 18, y: hy }, 'n'); else drawWrench(c, { x: 17, y: hy });
  }
  if (P.held === 'bigwrench' && back && !work) drawBigWrench(c, 17 - (arms[1].dx || 0), 22 + o + (arms[1].dy || 0), 0);
  drawLegsFront(c, P, pose);
  drawTorsoFront(c, P, o, back, ch);
  if (P.held === 'rifle' && back) drawRifle(c, 18, 3 + o, 12, 25 + o);
  const hands = [];
  const armbandSide = back ? 0 : 1; // character's left arm
  if (!(work && itemSide === 0)) hands[0] = drawArmFront(c, P, 0, arms[0], o, ch, P.armband && armbandSide === 0);
  if (work && itemSide === 1) hands[1] = null; else hands[1] = pose.gesture !== undefined ? drawGestureArm(c, P, pose.gesture, o, ch) : drawArmFront(c, P, 1, arms[1], o, ch, P.armband && armbandSide === 1);
  drawScarf(c, P, back ? 'n' : 's', pose);
  drawNeck(c, P, 's', ho, 15 + o - ch);
  drawHead(c, P, back ? 'n' : 's', ho, pose.mouth, pose.blink);
  if (P.hairStyle === 'ponytail' && back) drawPonytail(c, P, 'n', ho, pose);
  let tip = null;
  if (work) {
    const k = work[back ? 'n' : 's'], h = bentArm(c, P, itemSide ? 17 : 5, 16 + o - ch, k[0], 3.7, k[1], 3, true, false);
    tip = drawBigWrench(c, h.x, h.y, k[2]);
  } else if (!back && P.held === 'bigwrench') drawBigWrench(c, hands[0].x, hands[0].y, 0);
  if (!back && P.held === 'book') drawBook(c, hands[0], 's');
  if (!back && P.held === 'wrench') drawWrench(c, hands[0]);
  c.outline(K);
  if (tip && work.spark) drawSpark(c, tip.x, tip.y, work.spark);
  return c;
}

function renderSide(P, pose) {
  const c = new Canvas(FW, FH), o = pose.bob || 0, ch = pose.chest || 0, run = !!pose.run, lean = pose.lean || 0;
  const ho = pose.head !== undefined ? pose.head : o;
  // Torso, arms, head and held items share the lean; legs stay planted on the hip line.
  const layer = fn => { const t = new Canvas(FW, FH); const r = fn(t); c.blit(t, lean, 0); return r; };
  let near = pose.arms, tip = null;
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
    if (P.hairStyle === 'ponytail') drawPonytail(t, P, 'e', ho, pose);
    if (pose.work) {
      const k = pose.work.e, h = bentArm(t, P, 12, 16 + o - ch, k[0], 3.7, k[1], 3, true, P.armband);
      const p = drawBigWrench(t, h.x, h.y, k[2]);
      tip = { x: p.x + lean, y: p.y };
      return;
    }
    const hand = arm(t, near, true);
    if (P.held === 'book') drawBook(t, hand, 'e');
    if (P.held === 'wrench') drawWrench(t, hand);
    if (P.held === 'bigwrench') drawBigWrench(t, hand.x, hand.y, run ? 2.5 : near * .35);
  });
  c.outline(K);
  if (tip && pose.work.spark) drawSpark(c, tip.x, tip.y, pose.work.spark);
  return c;
}

function mirror(c) { const m = new Canvas(c.w, c.h); for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) m.px[y * c.w + x] = c.px[y * c.w + (c.w - 1 - x)]; return m; }

module.exports = {
  renderFront, renderSide, mirror, drawBigWrench
};

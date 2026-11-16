'use strict';
// Units: rocket cruise and boost frames.
const { PAL, K, Canvas } = require('../lib.cjs');
const { paint } = require('../pfx.cjs');
const { rgb } = require('../pfx.cjs').core;
const { FIRE, streak } = require('../pfx.cjs').kit;
const { GD, ST, RD, FI } = PAL;

// ---------------- Rocket (12x36) ----------------
function rocketBody(hot) {
  const tone = hot ? RD : ST;
  const body = new Canvas(12, 36);
  for (let y = 3; y < 25; y++) for (let x = 4; x < 8; x++) body.put(x, y, x === 5 ? tone[3] : x === 7 ? tone[1] : tone[2]);
  body.put(5, 0, GD[3]); body.put(6, 0, GD[2]);
  for (let y = 1; y < 4; y++) for (let x = 4; x < 8; x++) body.put(x, y, y === 3 ? GD[1] : x === 4 ? GD[3] : GD[2]);
  for (let x = 4; x < 8; x++) body.put(x, 9, hot ? GD[2] : RD[2]);
  const fin = (y, reach, col) => { for (let x = 0; x < 12; x++) { const d = Math.abs(x + .5 - 6); if (d > 2 && d <= reach) body.put(x, y, col); } };
  fin(12, 2.5, tone[1]); fin(13, 3.5, tone[1]); fin(14, 3.5, tone[1]); fin(15, 2.5, tone[1]);
  fin(18, 2.5, tone[2]); fin(19, 3.5, tone[2]); fin(20, 4.5, tone[2]); fin(21, 5.5, tone[2]); fin(22, 5.5, tone[2]); fin(23, 5.5, tone[1]);
  body.put(0, 22, RD[3]); body.put(11, 22, RD[3]); body.put(0, 21, RD[3]); body.put(11, 21, RD[3]);
  body.put(5, 25, ST[0]); body.put(6, 25, ST[0]);
  body.bevel(1, -1).outline(K);
  return body;
}

// Exhaust under the nozzle (row 26 down), drawn with the pixelfx Painter: a white-hot throat, shock diamonds
// pinching the plume, a yellow-orange sheath cooling to a translucent red tail, sparks shed behind, and light
// that spills back onto the airframe. cx: plume axis (pixel edge), len: plume length, half: half width at the throat.
function exhaust(p, cx, len, half, f, boost) {
  const top = 26, wob = k => Math.sin(f * 2.1 + k) * .5 + .5;
  p.glow(cx, top + 1, half * 3 + 3, FIRE[4], boost ? .45 : .35);
  p.glowLine(cx, top + 2, cx, top + len * .7, half + 2.5, FIRE[5], boost ? .18 : .12);
  for (let y = top; y <= top + len; y++) for (let x = Math.floor(cx - half - 2); x < cx + half + 2; x++) {
    const t = (y + .5 - top) / len; if (t > 1) continue;
    const ph = (y - top) / (boost ? 6.5 : 4.5) - f * .25, diamond = .5 + .5 * Math.cos(ph * Math.PI * 2);
    const w = half * (1 - .72 * t) * (.8 + .32 * diamond) + (wob(y) - .5) * .6 * t, d = Math.abs(x + .5 - cx) / Math.max(.45, w);
    if (d > 1) continue;
    const heat = (1 - t) * (1.05 - d * .75) + diamond * .3 * (1 - t) - .08 + (t < .12 ? .3 : 0);
    const c = FIRE[Math.max(0, Math.min(FIRE.length - 1, Math.round((1 - heat) * 7)))];
    // the tail cools into a truly translucent red (blended, not dithered)
    if (t > .6) p.blend(x, y, c, Math.min(1, (1 - t) / .4 * 1.1)); else p.px(x, y, c);
  }
  // sparks shed down the plume, two px long so they survive being scaled down
  for (let k = 0; k < (boost ? 5 : 2); k++) {
    const u = ((k * .37 + f * .23) % 1), x = cx + (Math.sin(k * 7.1 + f * 1.3)) * half * .9, y = top + len * (.45 + .6 * u);
    streak(p, x, y, 0, 1, 1.5, 1 - u * .8, .8);
  }
}
const drawCanvas = (p, c, dx = 0) => { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { const q = c.get(x, y); if (q) p.blend(x + dx, y, rgb(q[0], q[1], q[2]), q[3] / 255); } };

function rocketFrames(hot = false) {
  const body = rocketBody(hot);
  return [7, 9, 8, 10].map((len, f) => paint(12, 36, p => { drawCanvas(p, body); exhaust(p, 6, len, 1.6, f, false); }));
}

// Boosting rocket: same airframe, the plume three times longer and twice as wide.
function rocketBoostFrames() {
  const body = rocketBody(true);
  return [26, 29, 27, 30].map((len, f) => paint(16, 56, p => { drawCanvas(p, body, 2); exhaust(p, 8, len, 3.4, f, true); }));
}

module.exports = {
  rocketFrames, rocketBoostFrames
};

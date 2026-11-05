'use strict';
// Units: rocket cruise and boost frames.
const { PAL, K, hash, dither, Canvas } = require('../lib.cjs');
const { GD, ST, RD, FI } = PAL;

// ---------------- Rocket (12x36) ----------------
function rocketFrames(hot = false) {
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
  return [6, 9, 7, 10].map((len, f) => {
    const c = body.clone();
    for (let y = 26; y < 26 + len && y < 36; y++) {
      const t = (y - 26) / len;
      for (let x = 3; x < 9; x++) {
        const d = Math.abs(x + .5 - 6);
        let col = null;
        if (d <= .5 && t < .35) col = FI[4]; else if (d <= 1 && t < .65) col = FI[3]; else if (d <= 1.5 && t < .9) col = FI[2]; else if (d <= 2 && t < .4) col = FI[1];
        if (col && t > .5 && !dither(x, y + f, 1.3 - t)) col = null;
        if (col) c.put(x, y, col);
      }
    }
    return c;
  });
}

// Boosting rocket: same airframe, flame doubled in length and width.
function rocketBoostFrames() {
  const body = rocketFrames(true)[0];
  return [20, 26, 23, 28].map((len, f) => {
    const c = new Canvas(16, 56);
    for (let y = 0; y < 26; y++) for (let x = 0; x < 12; x++) { const p = body.get(x, y); if (p) c.put(x + 2, y, p); }
    for (let y = 26; y < 26 + len && y < 56; y++) {
      const t = (y - 26) / len;
      for (let x = 0; x < 16; x++) {
        const d = Math.abs(x + .5 - 8), w = 3.6 * (1 - t * .7) + (f % 2) * .4;
        let col = null;
        if (d <= w * .35 && t < .45) col = PAL.WHITE; else if (d <= w * .6 && t < .7) col = FI[4]; else if (d <= w * .85) col = FI[3]; else if (d <= w) col = FI[2];
        if (col && t > .55 && !dither(x, y + f, 1.35 - t)) col = t < .8 ? FI[1] : null;
        if (col) c.put(x, y, col);
      }
    }
    for (let k = 0; k < 4; k++) c.put(Math.floor(2 + hash(k, f, 41) * 12), Math.floor(30 + hash(k, f, 42) * 24), FI[3]);
    return c;
  });
}

module.exports = {
  rocketFrames, rocketBoostFrames
};

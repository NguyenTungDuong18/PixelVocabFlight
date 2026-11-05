'use strict';
// Units: explosions, sparks, smoke, shockwave, ice shield, tracers, splash, lock-on reticle.
const { PAL, K, withAlpha, hash, fbm, dither, Canvas } = require('../lib.cjs');
const { CR, GD, RD, FI, SM, IC, WT } = PAL;

// ---------------- Effects ----------------
function explosionFrames() {
  const R = [4, 7, 10, 12, 13, 14, 15, 15];
  return R.map((radius, f) => {
    const c = new Canvas(32, 32);
    c.fill((x, y) => {
      const dist = Math.hypot(x + .5 - 16, y + .5 - 16);
      const d = dist / (radius * (.82 + .36 * fbm(x * .22 + f * 1.7, y * .22 - f, 5)));
      if (d >= 1) return null;
      const n = fbm(x * .3 - f, y * .3 + f * 2, 9);
      switch (f) {
        case 0: return d < .55 ? FI[4] : FI[3];
        case 1: return d < .35 ? FI[4] : d < .7 ? FI[3] : FI[2];
        case 2: return d < .3 ? FI[4] : d < .6 ? FI[3] : d < .85 ? FI[2] : FI[1];
        case 3: return d < .25 ? FI[3] : d < .55 ? FI[2] : d < .8 ? (n > .5 ? FI[1] : SM[1]) : SM[1];
        case 4: return d < .4 ? (dither(x, y, .5) ? FI[2] : FI[1]) : n > .55 ? SM[1] : SM[2];
        case 5: return dither(x, y, .85 - d * .3) ? (n > .62 && d < .5 ? FI[1] : SM[2]) : null;
        case 6: return dither(x, y, .55 - d * .3) ? SM[3] : null;
        default: return dither(x, y, .3 - d * .2) ? SM[4] : null;
      }
    });
    if (f >= 1 && f <= 4) for (let k = 0; k < 7; k++) {
      const a = hash(k, 1, 77) * Math.PI * 2, r = radius + 1 + f * .6 + hash(k, 2, 77) * 2;
      c.put(Math.floor(16 + Math.cos(a) * r), Math.floor(16 + Math.sin(a) * r), k % 3 ? K : FI[3]);
    }
    return c;
  });
}
function sparkFrames() {
  return [[2, 1], [5, 3], [4, 3], [2, 2]].map(([long, short], f) => {
    const c = new Canvas(12, 12);
    const col = [FI[4], FI[3], FI[2], FI[1]][f];
    for (let s = 0; s <= long; s++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (f < 2 || s % 2 === 0) c.put(6 + dx * s - (dx < 0 ? 1 : 0), 6 + dy * s - (dy < 0 ? 1 : 0), s < 2 ? FI[4] : col);
    for (let s = 1; s <= short; s++) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.put(6 + dx * s - (dx < 0 ? 1 : 0), 6 + dy * s - (dy < 0 ? 1 : 0), col);
    return c;
  });
}
function smokeFrames() {
  return [[1.6, 1], [2.4, 1], [3, .8], [3.5, .55], [3.8, .3]].map(([r, density], f) => {
    const c = new Canvas(8, 8);
    return c.fill((x, y) => Math.hypot(x + .5 - 4, y + .5 - 4) <= r && dither(x, y, density) ? (x + y < 7 ? SM[4] : SM[3]) : null);
  });
}
function shockwaveFrames() {
  return [0, 1, 2, 3, 4, 5].map(f => {
    const c = new Canvas(64, 64), r = 8 + f * 4.6, th = f < 3 ? 3 : 2;
    const col = [FI[4], FI[3], CR[3], CR[2], SM[4], SM[4]][f], density = [1, 1, .9, .7, .45, .25][f];
    return c.fill((x, y) => {
      const d = Math.hypot(x + .5 - 32, y + .5 - 32);
      if (Math.abs(d - r) <= th / 2 + .2 && dither(x, y, density)) return col;
      if (d < r - 2 && f < 3 && dither(x, y, .12)) return withAlpha(FI[3], 150);
      return null;
    });
  });
}
function iceShieldFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(40, 40);
    c.fill((x, y) => {
      const dx = x + .5 - 20, dy = y + .5 - 20;
      const d = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * .7071);
      if (d > 16.5 && d < 18.6) return dx + dy < 0 ? IC[2] : IC[1];
      if (d <= 16.5 && d > 15.2 && dither(x, y, .5)) return withAlpha(IC[3], 160);
      if (d <= 15.2 && dither(x + f, y, .06)) return withAlpha(IC[3], 120);
      return null;
    });
    for (let k = 0; k < 3; k++) {
      const a = f * Math.PI / 8 + k * Math.PI * 2 / 3, sx = Math.round(20 + Math.cos(a) * 17.5 - .5), sy = Math.round(20 + Math.sin(a) * 17.5 - .5);
      for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) c.put(sx + ox, sy + oy, ox || oy ? IC[3] : PAL.WHITE);
    }
    return c;
  });
}
function tracerFrames() {
  const c = new Canvas(4, 12);
  for (let y = 0; y < 12; y++) {
    const col = y < 3 ? FI[4] : y < 8 ? FI[3] : withAlpha(FI[2], 200 - (y - 8) * 40);
    c.put(1, y, col); c.put(2, y, col);
    if (y > 1 && y < 7) { c.put(0, y, withAlpha(FI[2], 110)); c.put(3, y, withAlpha(FI[2], 110)); }
  }
  return [c];
}
function muzzleFrames() {
  return [0, 1].map(f => {
    const c = new Canvas(8, 8);
    for (let s = 0; s < (f ? 3 : 4); s++) { c.put(3, 4 - s - 1, s < 1 ? FI[4] : FI[3]); c.put(4, 4 - s - 1, s < 1 ? FI[4] : FI[3]); }
    c.put(2, 3, FI[2]); c.put(5, 3, FI[2]); c.put(3, 4, FI[3]); c.put(4, 4, FI[3]);
    if (!f) { c.put(1, 2, FI[2]); c.put(6, 2, FI[2]); }
    return c;
  });
}
function splashFrames() {
  return [0, 1, 2, 3].map(f => {
    const c = new Canvas(16, 10), rx = 2.5 + f * 1.8, ry = 1.3 + f * .9;
    return c.fill((x, y) => {
      const d = Math.hypot((x + .5 - 8) / rx, (y + .5 - 5) / ry);
      return Math.abs(d - 1) < .28 && dither(x, y, 1 - f * .22) ? withAlpha(f < 2 ? CR[3] : WT[5], 220) : null;
    });
  });
}

// Lock-on sight drawn over the player: brackets close in, then turn red and blink.
function lockReticleFrames() {
  const frames = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(40, 40), locked = f >= 6, d = locked ? 11 : Math.round(18 - f * 1.4);
    const col = locked ? (f === 6 ? RD[4] : FI[3]) : f % 2 ? GD[3] : GD[2], arm = locked ? 6 : 5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = 20 + sx * d - (sx > 0 ? 1 : 0), cy = 20 + sy * d - (sy > 0 ? 1 : 0);
      for (let s = 0; s < arm; s++) {
        c.put(cx - sx * s, cy, col); c.put(cx, cy - sy * s, col);
        if (locked) { c.put(cx - sx * s, cy - sy, col); c.put(cx - sx, cy - sy * s, col); }
      }
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let s = 0; s < 3; s++) {
      const r = d + 3 + s;
      c.put(20 + dx * r - (dx > 0 ? 1 : 0), 20 + dy * r - (dy > 0 ? 1 : 0), col);
    }
    if (locked) {
      for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) c.line(20 + dx, 20 + dy, 20 + dy, 20 - dx, col);
      c.put(19, 19, PAL.WHITE); c.put(20, 20, PAL.WHITE); c.put(19, 20, col); c.put(20, 19, col);
    }
    frames.push(c.outline(withAlpha(K, 170)));
  }
  return frames;
}

module.exports = {
  explosionFrames, sparkFrames, smokeFrames, shockwaveFrames, iceShieldFrames, tracerFrames,
  muzzleFrames, splashFrames, lockReticleFrames
};

'use strict';
// WORDWING 0.15.0: ground tiles for the walkable airbase (group Ground, 16x16, frames = variants).
// Every variant of a type tiles seamlessly against every other variant in any arrangement:
// textures are per-pixel or periodic with a period that divides 16, and every larger feature
// (tufts, pebbles, cracks, stains) stays at least one pixel inside the tile.
// tile_fence is 16x24, anchor (0,24): the post stands at ground point (8, 20) of the sprite.
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, K, hex, withAlpha, hash, dither } = require('./lib.cjs');
const { CR, GD, ST, RD, WD, GR, SN, WT, OL, SM } = PAL;

const T = 16;
const tile = fn => new Canvas(T, T).fill(fn);
// Deterministic interior positions for features (inset keeps them off the edges).
function spots(n, seed, inset = 2) {
  const out = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const x = inset + Math.floor(hash(i, 1, seed) * (T - 2 * inset)), y = inset + Math.floor(hash(i, 2, seed) * (T - 2 * inset));
    if (out.some(p => Math.abs(p[0] - x) < 3 && Math.abs(p[1] - y) < 3)) continue;
    out.push([x, y]);
  }
  return out;
}

// ---------------------------------------------------------------- grass
function grass(v) {
  const c = tile((x, y) => {
    const r = hash(x, y, 300 + v);
    return r < .14 ? GR[2] : r > .9 ? GR[4] : GR[3];
  });
  const blade = (x, y, tall) => {
    c.put(x, y + 1, GR[2]); c.put(x, y, GR[4]);
    if (tall) { c.put(x, y - 1, GR[5]); c.put(x - 1, y, GR[4]); c.put(x + 1, y + 1, GR[2]); }
  };
  const n = [5, 7, 4, 4][v];
  spots(n, 310 + v).forEach(([x, y], i) => blade(x, y, (i + v) % 2 === 0));
  if (v === 1) spots(3, 320, 3).forEach(([x, y]) => { blade(x - 1, y, false); blade(x + 1, y - 1, true); });
  if (v === 2) {
    // Tiny wild flowers.
    spots(2, 330, 3).forEach(([x, y], i) => {
      const petal = i % 2 ? CR[2] : GD[2];
      c.put(x, y - 1, petal); c.put(x - 1, y, petal); c.put(x + 1, y, petal); c.put(x, y + 1, petal); c.put(x, y, i % 2 ? GD[2] : RD[3]);
    });
  }
  if (v === 3) {
    // Darker clover patch fading out well before the edges.
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, (y - 7.5) * 1.2);
      if (d < 4.6 && dither(x, y, 1 - d / 5.2)) c.put(x, y, hash(x, y, 340) < .3 ? GR[3] : GR[2]);
    }
    c.put(6, 6, GR[4]); c.put(9, 8, GR[4]); c.put(7, 9, GR[5]);
  }
  return c;
}

// ---------------------------------------------------------------- dirt
function dirt(v) {
  const c = tile((x, y) => {
    const r = hash(x, y, 400 + v);
    return r < .16 ? WD[1] : r > .88 ? WD[3] : r > .84 ? SN[1] : WD[2];
  });
  const pebble = (x, y, big) => {
    c.put(x + 1, y + 1, WD[1]); c.put(x, y, big ? SN[3] : ST[3]);
    if (big) { c.put(x + 1, y, SN[2]); c.put(x, y + 1, SN[2]); c.put(x + 1, y + 1, SN[1]); c.put(x + 2, y + 1, WD[1]); c.put(x + 1, y + 2, WD[1]); }
  };
  spots([3, 6, 2, 3][v], 410 + v, 3).forEach(([x, y], i) => pebble(x, y, v === 1 && i % 3 === 0));
  if (v === 2) {
    // Dry cracks.
    let x = 3, y = 4;
    for (let k = 0; k < 6; k++) { c.put(x, y, WD[1]); if (k % 2) c.put(x + 1, y, hex('#6e5030')); x += hash(k, 0, 421) < .6 ? 1 : 0; y += 1; if (x > 12 || y > 12) break; }
    for (let k = 0; k < 3; k++) c.put(5 + k, 7 + (k >> 1), WD[1]);
  }
  if (v === 3) {
    // Boot prints.
    for (const [bx, by] of [[4, 4], [8, 9]]) {
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 2; xx++) c.put(bx + xx, by + yy, yy === 2 ? WD[2] : WD[1]);
      c.put(bx, by + 4, WD[1]); c.put(bx + 1, by + 4, WD[0]);
    }
  }
  return c;
}

// ---------------------------------------------------------------- concrete slabs
const JOINT = hex('#6c787d');
function concrete(v) {
  const c = tile((x, y) => {
    if (x === 0 || y === 0) return hash(x, y, 500) < .2 ? ST[2] : JOINT;
    if (x === 1 || y === 1) return hash(x, y, 501) < .5 ? ST[4] : ST[3];
    const r = hash(x, y, 510 + v);
    return r < .08 ? ST[2] : r > .93 ? ST[4] : r > .86 ? hex('#7f8b90') : ST[3];
  });
  if (v === 1) {
    // Hairline crack across the slab.
    let x = 4, y = 3;
    for (let k = 0; k < 7; k++) { c.put(x, y, k % 3 === 0 ? ST[2] : hex('#76838a')); y++; x += hash(k, 1, 520) < .5 ? 1 : 0; if (y > 13 || x > 13) break; }
  }
  if (v === 2) {
    // Oil stain.
    for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) {
      const d = Math.hypot(x - 8, (y - 8) * 1.25);
      if (d < 4.2) c.paint(x, y, withAlpha(hex('#2a2f33'), d < 2.2 ? 80 : 40));
    }
    c.put(7, 7, hex('#5e6a72'));
  }
  if (v === 3) {
    // Aircraft tie-down ring set into the slab.
    for (const [x, y, col] of [[7, 6, ST[1]], [8, 6, ST[1]], [6, 7, ST[1]], [9, 7, ST[2]], [6, 8, ST[1]], [9, 8, ST[2]], [7, 9, ST[2]], [8, 9, ST[4]]]) c.put(x, y, col);
    c.put(7, 7, ST[2]); c.put(8, 8, ST[2]); c.put(7, 8, ST[2]); c.put(8, 7, ST[2]);
    c.put(10, 10, hex('#7f8b90')); c.put(4, 12, ST[2]);
  }
  return c;
}

// ---------------------------------------------------------------- asphalt and runway
function asphaltBase(x, y, seed) {
  const r = hash(x, y, seed), r2 = hash(x, y, seed + 1);
  return r < .1 ? ST[0] : r2 < .06 ? ST[2] : ST[1];
}
function asphalt(v) {
  const c = tile((x, y) => asphaltBase(x, y, 600 + v * 2));
  if (v === 1) {
    let x = 3, y = 9;
    for (let k = 0; k < 10; k++) { c.put(x, y, ST[0]); c.put(x, y + 1, hex('#343c40')); x++; y += hash(k, 2, 611) < .35 ? -1 : hash(k, 3, 611) < .3 ? 1 : 0; if (x > 13) break; }
  }
  if (v === 2) {
    // Tar patch.
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) { const d = Math.hypot(x - 7.5, (y - 7.5) * 1.3) + (hash(x, y, 614) - .5) * 1.6; if (d < 4.2) c.put(x, y, d > 3.4 ? ST[0] : hash(x, y, 612) < .08 ? ST[2] : hex('#353d42')); }
  }
  if (v === 3) {
    for (let y = 4; y < 13; y++) for (let x = 5; x < 14; x++) { const d = Math.hypot(x - 9, (y - 8) * 1.3); if (d < 3.6) c.paint(x, y, withAlpha(hex('#15191c'), d < 2 ? 120 : 70)); }
    spots(3, 613, 2).forEach(([x, y]) => { c.put(x, y, ST[3]); });
  }
  return c;
}

const MARK = (x, y, base) => hash(x, y, 709) < .1 ? base : (hash(x, y, 710) < .25 ? CR[1] : CR[2]);
function runway(v) {
  return tile((x, y) => {
    const base = asphaltBase(x, y, 700);
    // Centre dash hugs the tile's right edge: AirbaseMap puts it in the column just left of the
    // centre seam of an even-width runway (6 tiles), so the line sits on the true runway centre.
    if (v === 1 && (x === 14 || x === 15) && y >= 3 && y <= 12) return MARK(x, y, base);
    if (v === 2 && (x === 1 || x === 2)) return MARK(x, y, base);
    if (v === 3 && (x === 13 || x === 14)) return MARK(x, y, base);
    if (v === 4 && ((x >= 2 && x <= 5) || (x >= 10 && x <= 13))) return MARK(x, y, base);
    // Faint tyre rubber on plain and centre tiles.
    if ((v === 0 || v === 1) && (x === 4 || x === 11) && hash(x, y, 711) < .35) return ST[0];
    return base;
  });
}

// ---------------------------------------------------------------- sand and water
function sand(v) {
  const c = tile((x, y) => {
    const ripple = Math.sin((x + 2 * y) / 16 * Math.PI * 2 + Math.sin(y / 8 * Math.PI * 2) * .6);
    const r = hash(x, y, 800 + v);
    if (ripple > .82) return r < .3 ? SN[3] : SN[4];
    if (ripple < -.86) return r < .3 ? SN[3] : SN[2];
    return r < .1 ? SN[2] : r > .93 ? SN[4] : SN[3];
  });
  if (v === 1) {
    spots(2, 810, 3).forEach(([x, y]) => { c.put(x, y, ST[3]); c.put(x + 1, y + 1, SN[1]); });
    // Dry grass tuft.
    for (const [x, y, col] of [[10, 9, OL[2]], [9, 8, OL[3]], [11, 8, OL[3]], [10, 7, OL[4]], [12, 9, OL[2]], [10, 10, SN[1]], [11, 10, SN[1]]]) c.put(x, y, col);
  }
  return c;
}

function water(v) {
  const c = tile((x, y) => {
    const band = Math.sin((x + y * 2) / 16 * Math.PI * 2);
    const r = hash(x, y, 900 + v);
    if (band > .9 && r < .5) return WT[3];
    return r < .12 ? WT[1] : r > .9 ? WT[3] : WT[2];
  });
  spots([3, 4, 3, 2][v], 910 + v, 2).forEach(([x, y], i) => {
    const len = 2 + (i + v) % 3;
    for (let k = 0; k < len; k++) c.put(Math.min(14, x + k - 1), y, k === 1 ? WT[5] : WT[4]);
    c.put(Math.min(14, x), y + 1, WT[1]);
  });
  if (v === 3) { c.put(6, 9, WT[5]); c.put(5, 10, WT[4]); c.put(7, 10, WT[4]); }
  return c;
}

// ---------------------------------------------------------------- perimeter fence (16x24)
const FB = 20; // ground row of the post inside the sprite
const SHADE = [0, 0, 0, 70];
function meshH(c, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    c.paint(x, FB + 1, SHADE); if (x % 2 === 0) c.paint(x + 1, FB + 2, SHADE);
    for (let y = FB - 14; y <= FB - 1; y++) if (((x + y) & 3) === 0 || ((x - y) & 3) === 0) c.put(x, y, y < FB - 10 ? ST[4] : ST[3]);
    c.put(x, FB - 15, ST[4]); c.put(x, FB, ST[2]);
    // Two strands of barbed wire above the rail, barbs every 4 px.
    c.put(x, FB - 17, ST[2]); c.put(x, FB - 19, ST[2]);
    if ((x & 3) === 1) { c.put(x, FB - 18, ST[3]); c.put(x, FB - 16, ST[3]); }
  }
}
// Vertical run seen from above: a narrow mesh band; rows a..b are screen rows.
function meshV(c, a, b) {
  for (let y = Math.max(0, a); y <= Math.min(23, b); y++) {
    c.paint(10, y + 1, SHADE); if (y & 1) c.paint(11, y + 1, SHADE);
    c.put(7, y, (y & 1) ? ST[4] : ST[3]); c.put(8, y, (y & 3) === 1 ? ST[3] : ST[2]);
    if ((y & 3) === 0) c.put(6, y, ST[3]);
    if ((y & 3) === 2) c.put(9, y, ST[3]);
  }
}
// Post on a north-south run, seen from above: cap and footing only, so the run stays a mesh band.
function postV(c) {
  const cap = [WD[4], WD[3], WD[2], WD[1]], foot = [WD[3], WD[2], WD[2], WD[1]];
  for (let k = 0; k < 4; k++) { c.put(6 + k, FB - 20, cap[k]); c.put(6 + k, FB - 19, foot[k]); c.put(6 + k, FB - 1, foot[k]); c.put(6 + k, FB, WD[0]); }
  c.put(5, FB, K); c.put(10, FB, K); c.paint(10, FB + 1, SHADE); c.paint(11, FB + 1, SHADE);
}
function post(c) {
  c.paint(9, FB + 1, SHADE); c.paint(10, FB + 1, SHADE); c.paint(10, FB + 2, SHADE);
  for (let y = FB - 19; y <= FB; y++) { c.put(7, y, WD[3]); c.put(8, y, WD[1]); }
  c.put(7, FB - 20, WD[4]); c.put(8, FB - 20, WD[2]);
  c.put(6, FB, K); c.put(9, FB, K); c.put(9, FB - 1, WD[0]);
}
function fence(v) {
  const c = new Canvas(16, 24);
  switch (v) {
    case 0: meshH(c, 0, 15); post(c); break;                     // horizontal
    case 1: meshV(c, 0, 23); postV(c); break;                     // vertical
    case 2: meshH(c, 8, 15); meshV(c, FB - 19, 23); post(c); break; // top-left corner
    case 3: meshH(c, 0, 8); meshV(c, FB - 19, 23); post(c); break;  // top-right corner
    case 4: meshH(c, 8, 15); meshV(c, 0, FB); post(c); break;       // bottom-left corner
    case 5: meshH(c, 0, 8); meshV(c, 0, FB); post(c); break;        // bottom-right corner
    case 6: {
      // Gate pillar (concrete, red/white band, lamp) with mesh stubs so either neighbour joins.
      meshH(c, 0, 3); meshH(c, 12, 15);
      for (let y = FB + 1; y <= FB + 3; y++) for (let x = 5; x <= 13; x++) c.paint(x, y, SHADE);
      for (let y = FB - 16; y <= FB; y++) for (let x = 4; x <= 11; x++) {
        let col = x === 4 ? ST[4] : x === 11 ? ST[2] : ST[3];
        if (y >= FB - 11 && y <= FB - 8) col = ((x + y) >> 1) & 1 ? CR[3] : RD[3];
        if (y === FB - 16) col = ST[4];
        if (hash(x, y, 950) < .08) col = ST[2];
        c.put(x, y, col);
      }
      for (let x = 3; x <= 12; x++) { c.put(x, FB - 17, ST[2]); c.put(x, FB - 18, ST[3]); c.put(x, FB - 19, K); }
      // Gate lamp on top of the pillar.
      c.put(7, FB - 19, ST[1]); c.put(8, FB - 19, ST[1]); c.put(7, FB - 20, GD[3]); c.put(8, FB - 20, GD[2]);
      c.put(6, FB - 20, K); c.put(9, FB - 20, K); c.put(7, FB - 21, K); c.put(8, FB - 21, K);
      for (let y = FB - 18; y <= FB; y++) { c.put(3, y, K); c.put(12, y, K); }
      for (let x = 3; x <= 12; x++) c.put(x, FB + 1, K);
      break;
    }
  }
  return c;
}

// ---------------------------------------------------------------- preview
const KINDS = {
  tile_grass: [4, grass], tile_dirt: [4, dirt], tile_concrete: [4, concrete], tile_asphalt: [4, asphalt],
  tile_sand: [2, sand], tile_runway: [5, runway], tile_water: [4, water], tile_fence: [7, fence]
};
function buildAll() { const o = {}; for (const [n, [k, f]] of Object.entries(KINDS)) o[n] = Array.from({ length: k }, (_, i) => f(i)); return o; }

function tilingSheet(all) {
  const SC = 3, N = 8, pad = 12, block = N * T * SC + pad;
  const types = ['tile_grass', 'tile_dirt', 'tile_concrete', 'tile_asphalt', 'tile_sand', 'tile_water'];
  const W = pad + 4 * block, H = pad + 3 * block;
  const s = new Canvas(W, H).fill((x, y) => ((x >> 3) + (y >> 3)) % 2 ? hex('#3a3f36') : hex('#2c3029'));
  const vh = (x, y, n) => Math.floor(hash(x, y, 4242) * n);
  // 8x8 random variant grids, one per type.
  types.forEach((name, i) => {
    const g = new Canvas(N * T, N * T), fr = all[name];
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) g.blit(fr[vh(tx + i * 13, ty + 5, fr.length)], tx * T, ty * T, false);
    s.blit(g.scaled(SC), pad + (i % 4) * block, pad + Math.floor(i / 4) * block);
  });
  // Runway strip: grass | edge L, plain, centre dash (every other row), plain..., edge R | grass, thresholds at both ends.
  {
    const g = new Canvas(N * T, N * T), rw = all.tile_runway;
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      let f;
      if (tx === 0 || tx === 7) f = all.tile_grass[vh(tx, ty, 4)];
      else if (ty === 0 || ty === 7) f = rw[4];
      else if (tx === 1) f = rw[2];
      else if (tx === 6) f = rw[3];
      else if ((tx === 3 || tx === 4) && ty % 2 === 1) f = rw[1];
      else f = rw[0];
      g.blit(f, tx * T, ty * T, false);
    }
    s.blit(g.scaled(SC), pad + 2 * block, pad + block);
  }
  // Closed rectangular fence on grass with a 3-tile gate in the bottom side.
  {
    const g = new Canvas(N * T, N * T + 8);
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) g.blit(all.tile_grass[vh(tx + 3, ty + 9, 4)], tx * T, 8 + ty * T, false);
    const F = all.tile_fence, x0 = 1, y0 = 1, x1 = 6, y1 = 6;
    const at = (tx, ty) => {
      if (tx === x0 && ty === y0) return 2; if (tx === x1 && ty === y0) return 3;
      if (tx === x0 && ty === y1) return 4; if (tx === x1 && ty === y1) return 5;
      if (ty === y1 && (tx === 2 || tx === 5)) return 6;
      if (ty === y1 && tx > 2 && tx < 5) return -1;
      if (ty === y0 || ty === y1) return tx > x0 && tx < x1 ? 0 : -1;
      if (tx === x0 || tx === x1) return ty > y0 && ty < y1 ? 1 : -1;
      return -1;
    };
    // y-sorted: row by row, so lower fences overlap upper ones.
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) { const v = at(tx, ty); if (v >= 0) g.blit(F[v], tx * T, 8 + ty * T + T - 24); }
    s.blit(g.scaled(SC), pad + 3 * block, pad + block);
  }
  // Every frame at 4x along the bottom.
  let x = pad, y = pad + 2 * block;
  for (const name of Object.keys(KINDS)) {
    for (const f of all[name]) { s.blit(f.scaled(4), x, y + (24 - f.h) * 4); x += f.w * 4 + 4; }
    x += 12;
    if (x > W - 200) { x = pad; y += 24 * 4 + 8; }
  }
  return s;
}

const PREVIEW = path.resolve(__dirname, '../../SourceAssets/PixelArt/Pixel1944');
function writePreviews(dir = PREVIEW, all = buildAll()) {
  fs.mkdirSync(dir, { recursive: true });
  return tilingSheet(all).png(path.join(dir, 'preview-ground-tiling.png'));
}

function build(add) {
  const all = buildAll();
  for (const [name, frames] of Object.entries(all)) {
    if (name === 'tile_fence') add('Ground', name, frames, { fps: 1, loop: true, anchor: [0, 24] });
    else add('Ground', name, frames, { fps: 1, loop: true });
  }
  writePreviews(PREVIEW, all).catch(e => { console.error('ground preview failed', e); process.exitCode = 1; });
}

module.exports = { build, writePreviews, grass, dirt, concrete, asphalt, runway, sand, water, fence, FENCE_GROUND_ROW: FB };

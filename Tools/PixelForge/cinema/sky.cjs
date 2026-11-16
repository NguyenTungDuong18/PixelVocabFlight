'use strict';
// Frame buffers, the dusk sky dome, the undercast (a sea of cloud at z = 0) and cumulus built from
// sphere impostors: depths are smooth-blended per pixel, normals come from the blended depth, so a
// cluster of spheres shades as one billowing mass in banded tones (no "bag of balls").
const C = require('./core.cjs');
const { W, H, clamp, smooth, noise2, noise3, fbm2, RAMP, rampAt } = C;
const N = W * H;

const SUN_EL = 7 * C.DEG;
const SUN = C.norm([Math.cos(SUN_EL), 0, Math.sin(SUN_EL)]);       // toward the sun: low in the east (+x)
const FOG = 30000;                                                   // metres to 63 percent haze

function newFrame() {
  return {
    col: new Float32Array(N * 3), z: new Float32Array(N), haze: new Float32Array(N * 3), dir: new Float32Array(N * 3),
    cz: new Float32Array(N), ch: new Float32Array(N), ck: new Uint8Array(N),
    heat: new Float32Array(N), add: new Float32Array(N * 3), glow: new Float32Array(N * 3),
    gid: new Int16Array(N), gp: new Float32Array(N * 3), gn: new Float32Array(N * 3), gao: new Float32Array(N), gz: new Float32Array(N)
  };
}

// ---------------------------------------------------------------- sky dome
const K = { hCool: C.hex('#6f6590'), hWarm: C.hex('#ff9a48'), hSun: C.hex('#ffd884'), mCool: C.hex('#34497c'), mWarm: C.hex('#b8627c'),
  zCool: C.hex('#101a3c'), zWarm: C.hex('#1c2c57'), deep: C.hex('#1b2040'), cirCool: C.hex('#8e7aa6'), cirWarm: C.hex('#ffb97a') };
// colour of the sky in direction (dx, dy, dz); flat = true gives the haze colour at the horizon in that direction
function sky(dx, dy, dz, out, flat) {
  const hl = Math.hypot(dx, dy) || 1e-6, s = (dx * SUN[0] + dy * SUN[1]) / (hl * Math.hypot(SUN[0], SUN[1])), s01 = (s + 1) / 2;
  const w = s01 * s01 * Math.sqrt(s01), near = Math.pow(s01, 14);
  let hr = K.hCool[0] + (K.hWarm[0] - K.hCool[0]) * w, hg = K.hCool[1] + (K.hWarm[1] - K.hCool[1]) * w, hb = K.hCool[2] + (K.hWarm[2] - K.hCool[2]) * w;
  hr += (K.hSun[0] - hr) * near; hg += (K.hSun[1] - hg) * near; hb += (K.hSun[2] - hb) * near;
  if (flat) { out[0] = hr * .96; out[1] = hg * .96; out[2] = hb * .98; return out; }
  const u = dz, wm = Math.pow(s01, 1.5);
  let r, g, b;
  if (u < 0) { const k = smooth(-u / .3); r = hr + (K.deep[0] - hr) * k; g = hg + (K.deep[1] - hg) * k; b = hb + (K.deep[2] - hb) * k; }
  else {
    const mr = K.mCool[0] + (K.mWarm[0] - K.mCool[0]) * wm, mg = K.mCool[1] + (K.mWarm[1] - K.mCool[1]) * wm, mb = K.mCool[2] + (K.mWarm[2] - K.mCool[2]) * wm;
    if (u < .2) { const k = smooth(u / .2); r = hr + (mr - hr) * k; g = hg + (mg - hg) * k; b = hb + (mb - hb) * k; }
    else {
      const k = Math.pow((u - .2) / .8, .55), zr = K.zCool[0] + (K.zWarm[0] - K.zCool[0]) * s01, zg = K.zCool[1] + (K.zWarm[1] - K.zCool[1]) * s01, zb = K.zCool[2] + (K.zWarm[2] - K.zCool[2]) * s01;
      r = mr + (zr - mr) * k; g = mg + (zg - mg) * k; b = mb + (zb - mb) * k;
    }
    // high cirrus: long streaks on a plane far above, lit from below by the low sun
    if (u > .02) {
      const px = dx / (u + .38), py = dy / (u + .38);
      let c = fbm2(px * .6 + py * .15 + 3, py * 1.7 - px * .2, 41);
      c = smooth((c - .5) / .22) * clamp(u * 7) * (1 - smooth((u - .35) / .4));
      if (c > 0) {
        const a = c * .5, cr = K.cirCool[0] + (K.cirWarm[0] - K.cirCool[0]) * w, cg = K.cirCool[1] + (K.cirWarm[1] - K.cirCool[1]) * w, cb = K.cirCool[2] + (K.cirWarm[2] - K.cirCool[2]) * w;
        r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a;
      }
    }
  }
  const gdot = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
  if (gdot > 0) {
    const g1 = Math.pow(gdot, 24) * .36, g2 = Math.pow(gdot, 900) * .7;
    r += g1 + g2; g += g1 * .7 + g2 * .85; b += g1 * .34 + g2 * .55;
    if (gdot > .99978) { r = 1.6; g = 1.5; b = 1.2; }
  }
  out[0] = r; out[1] = g; out[2] = b;
  return out;
}

// ---------------------------------------------------------------- pass 1: sky + undercast
// deck: { off: [x, y] } scroll of the cloud sea (the loop shot slides it under a camera that stays put)
const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
function drawSky(fr, cam, deck) {
  const { F, R, U, f, pos } = cam, ox = (deck && deck.off[0]) || 0, oy = (deck && deck.off[1]) || 0;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const a = x + .5 - W / 2, b = H / 2 - y - .5;
    let dx = F[0] * f + R[0] * a + U[0] * b, dy = F[1] * f + R[1] * a + U[1] * b, dz = F[2] * f + R[2] * a + U[2] * b;
    const l = 1 / Math.hypot(dx, dy, dz), cosv = f * l; dx *= l; dy *= l; dz *= l;
    fr.dir[i * 3] = dx; fr.dir[i * 3 + 1] = dy; fr.dir[i * 3 + 2] = dz;
    sky(dx, dy, dz, tmp2, true); fr.haze[i * 3] = tmp2[0]; fr.haze[i * 3 + 1] = tmp2[1]; fr.haze[i * 3 + 2] = tmp2[2];
    let zv = 1e9;
    sky(dx, dy, dz, tmp, false);
    if (dz < -1e-4 && pos[2] > 0) {
      const t = -pos[2] / dz, px = pos[0] + dx * t - ox, py = pos[1] + dy * t - oy;
      if (t < 160000) {
        zv = t * cosv;
        // stratus relief: fbm height, lit by the low sun (slope along the sun azimuth), holes down to a dark sea
        const foot = t / (f * Math.max(.05, -dz)), h0 = deckH(px, py, foot), h1 = deckH(px + 140, py, foot);
        let L = .36 + .26 * h0 + clamp((h0 - h1) * 2.4, -.13, .2);
        const pv = py / DECK_P, pt = pv - Math.floor(pv), pya = pt * DECK_P;      // the holes repeat with the deck (the loop shot scrolls it)
        const hole = smooth((.34 - (noise2(px / 3100 + 9, pya / 3100, 55) * (1 - pt) + noise2(px / 3100 + 9, (pya - DECK_P) / 3100, 55) * pt)) / .1) * smooth((.5 - h0) / .2);
        rampAt(RAMP.cloud, L, tmp2);
        if (hole > 0) {
          const gl = noise2(px / 26, pya / 9, 61), sr = clamp((dx * SUN[0] + dy * SUN[1]) / (Math.hypot(dx, dy) || 1));
          const sea = gl > .78 ? .5 + sr * sr * sr * 1.4 : .18 + .2 * noise2(px / 400, pya / 400, 63);
          const sc = rampAt(sea > 1 ? RAMP.sky : RAMP.sea, sea > 1 ? .8 : sea, [0, 0, 0]);
          tmp2[0] += (sc[0] - tmp2[0]) * hole; tmp2[1] += (sc[1] - tmp2[1]) * hole; tmp2[2] += (sc[2] - tmp2[2]) * hole;
        }
        const fg = 1 - Math.exp(-t / FOG), hz = fr.haze;
        tmp[0] = tmp2[0] + (hz[i * 3] - tmp2[0]) * fg; tmp[1] = tmp2[1] + (hz[i * 3 + 1] - tmp2[1]) * fg; tmp[2] = tmp2[2] + (hz[i * 3 + 2] - tmp2[2]) * fg;
      }
    }
    fr.col[i * 3] = tmp[0]; fr.col[i * 3 + 1] = tmp[1]; fr.col[i * 3 + 2] = tmp[2];
    fr.z[i] = zv; fr.cz[i] = 1e9; fr.ch[i] = 0; fr.ck[i] = 0; fr.heat[i] = 0; fr.gid[i] = -1; fr.gz[i] = 1e9;
    fr.add[i * 3] = fr.add[i * 3 + 1] = fr.add[i * 3 + 2] = 0;
  }
}
// The deck tiles every DECK_P metres along y (the loop shot scrolls it by whole periods).
const DECK_P = 2400;
function deckH(x, y, foot = 1) {
  const v = y / DECK_P, t = v - Math.floor(v), ya = t * DECK_P, yb = ya - DECK_P;
  const w7 = clamp(700 / (foot * 5) - .2), w4 = clamp(430 / (foot * 5) - .2), w1 = clamp(120 / (foot * 5) - .2);   // features smaller than a few pixels fade to their mean (no moire toward the horizon)
  const h = (yy) => { const b = w4 ? noise2(x / 430, yy / 430, 53) : .5; return noise2(x / 1500, yy / 1500, 51) * .4 + (w7 ? (noise2(x / 700, yy / 700, 52) - .5) * w7 : 0) * .3 + .15 + ((1 - Math.abs(2 * b - 1)) - .5) * w4 * .3 + .15 + (w1 ? (noise2(x / 120, yy / 120, 57) - .5) * w1 * .08 : 0); };
  return h(ya) * (1 - t) + h(yb) * t;
}

// ---------------------------------------------------------------- pass 2: cumulus (sphere impostors)
// puff: [x, y, z, r, height 0..1 inside its cloud, kind, seed]; kind 0 deck cumulus (slides with off), 1 storm tower (darker),
// 2 smoke column, 3 far bright tower. off: the deck scroll, so the shading detail travels with the deck clouds.
function drawClouds(fr, cam, puffs, off) {
  const oy = (off && off[1]) || 0, ox = (off && off[0]) || 0;
  const { R, U, F, f, pos } = cam, cz = fr.cz, ch = fr.ch, ck = fr.ck;
  // far to near, so the blend never depends on the order of the list (the loop shot rebuilds the list every frame)
  const order = [];
  for (let k = 0; k < puffs.length; k++) { const p = puffs[k], vz = (p[0] - pos[0]) * F[0] + (p[1] - pos[1]) * F[1] + (p[2] - pos[2]) * F[2]; if (vz >= p[3] * .6 + 2) order.push([vz, k]); }
  order.sort((u, v) => v[0] - u[0] || u[1] - v[1]);
  for (const [vz, k] of order) {
    const p = puffs[k], dx = p[0] - pos[0], dy = p[1] - pos[1], dz = p[2] - pos[2], r = p[3];
    const vx = dx * R[0] + dy * R[1] + dz * R[2], vy = dx * U[0] + dy * U[1] + dz * U[2];
    const cx = W / 2 + f * vx / vz, cy = H / 2 - f * vy / vz, rs = f * r / vz, rm = rs * 1.16;
    if (cx + rm < 0 || cx - rm > W || cy + rm < 0 || cy - rm > H || rs < .45) continue;
    const x0 = Math.max(0, Math.floor(cx - rm)), x1 = Math.min(W - 1, Math.ceil(cx + rm)), y0 = Math.max(0, Math.floor(cy - rm)), y1 = Math.min(H - 1, Math.ceil(cy + rm));
    const seed = p[6], hgt = p[4], kind = p[5], kk = r * .4, zr = vz / f, lump = rs > 2.5;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ax = x + .5 - cx, ay = y + .5 - cy, d2 = ax * ax + ay * ay;
      if (d2 >= rm * rm) continue;
      let rr = rs;
      if (lump) {
        const nx = ax / rm, ny = -ay / rm, nz = -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const wx = R[0] * nx + U[0] * ny + F[0] * nz, wy = R[1] * nx + U[1] * ny + F[1] * nz, wz = R[2] * nx + U[2] * ny + F[2] * nz;
        rr = rs * (.74 + .42 * (noise3(wx * 2.2 + seed, wy * 2.2, wz * 2.2, 7) * .8 + noise3(wx * 5.6, wy * 5.6 + seed, wz * 5.6, 9) * .2));
      }
      if (d2 >= rr * rr) continue;
      const zs = vz - Math.sqrt(rr * rr - d2) * zr, i = y * W + x, a = cz[i];
      if (a > 1e8) { cz[i] = zs; ch[i] = hgt; ck[i] = kind + 1; continue; }
      const h = Math.max(kk - Math.abs(a - zs), 0) / kk, m = Math.min(a, zs) - h * h * kk * .25;
      const wgt = zs < a ? 1 - h * .5 : h * .5;                    // share of the new sphere in the blend
      cz[i] = m; ch[i] += (hgt - ch[i]) * wgt; if (zs < a) ck[i] = kind + 1;
    }
  }
  // shade from the blended depth
  const col = fr.col, zb = fr.z, hz = fr.haze, dir = fr.dir, o = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = cz[i];
    if (z >= zb[i]) continue;
    // view-space neighbours (fall back to the other side across a depth break)
    const jx = x + 1 < W && Math.abs(cz[i + 1] - z) < Math.abs((x > 0 ? cz[i - 1] : 1e9) - z) ? 1 : -1;
    const jy = y + 1 < H && Math.abs(cz[i + W] - z) < Math.abs((y > 0 ? cz[i - W] : 1e9) - z) ? 1 : -1;
    const zx = x + jx >= 0 && x + jx < W ? cz[i + jx] : z, zy = y + jy >= 0 && y + jy < H ? cz[i + jy * W] : z;
    const edge = Math.abs(zx - z) > z * .04 + 30 || Math.abs(zy - z) > z * .04 + 30;
    const px = (x + .5 - W / 2) / f, py = (H / 2 - y - .5) / f;
    // tangent vectors in view space
    let tx0 = (px + jx / f) * zx - px * z, tx1 = py * zx - py * z, tx2 = zx - z;
    let ty0 = px * zy - px * z, ty1 = (py - jy / f) * zy - py * z, ty2 = zy - z;
    if (edge) { tx0 = jx * z / f; tx1 = 0; tx2 = 0; ty0 = 0; ty1 = -jy * z / f; ty2 = 0; }
    let nx = tx1 * ty2 - tx2 * ty1, ny = tx2 * ty0 - tx0 * ty2, nz = tx0 * ty1 - tx1 * ty0;
    if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl;
    const wx = R[0] * nx + U[0] * ny + F[0] * nz, wy = R[1] * nx + U[1] * ny + F[1] * nz, wz = R[2] * nx + U[2] * ny + F[2] * nz;
    const ddx = dir[i * 3], ddy = dir[i * 3 + 1], ddz = dir[i * 3 + 2];
    const ndl = wx * SUN[0] + wy * SUN[1] + wz * SUN[2], wrap = clamp((ndl + .4) / 1.4), toSun = Math.max(0, ddx * SUN[0] + ddy * SUN[1] + ddz * SUN[2]);
    const facing = Math.abs(wx * ddx + wy * ddy + wz * ddz), kind = ck[i] - 1, hgt = ch[i];
    const t = z / (F[0] * ddx + F[1] * ddy + F[2] * ddz), pwx = pos[0] + ddx * t, pwy = pos[1] + ddy * t, pwz = pos[2] + ddz * t;
    let L = .2 + .5 * wrap * wrap + .16 * (wz * .5 + .5);
    L *= .7 + .3 * hgt;
    if (kind === 0) { const yy = ((pwy - oy) % DECK_P + DECK_P) % DECK_P, tt = yy / DECK_P; L += (noise3((pwx - ox) / 85, yy / 85, pwz / 85, 21) * (1 - tt) + noise3((pwx - ox) / 85, (yy - DECK_P) / 85, pwz / 85, 21) * tt - .5) * .07; }
    else L += (noise3(pwx / 85, pwy / 85, pwz / 85, 21) - .5) * .07;
    const rim = (1 - facing) * (1 - facing) * toSun * toSun * toSun;
    L += rim * .95 + Math.pow(toSun, 10) * .22;
    if (edge) L += .1 * toSun + .03;
    if (kind === 1) L = L * .7 - .02;
    if (kind === 2) { rampAt(RAMP.smoke, clamp(L * .62 + .04), o); const g = .5 * Math.exp(-Math.max(0, pwz) / 170) * Math.max(0, -wz + .2) * (.5 + .5 * noise3(pwx / 60, pwy / 60, pwz / 60 - 3, 23)); o[0] += g * .95; o[1] += g * .34; o[2] += g * .06; }
    else rampAt(RAMP.cloud, L, o);
    const fg = 1 - Math.exp(-t / FOG);
    col[i * 3] = o[0] + (hz[i * 3] - o[0]) * fg; col[i * 3 + 1] = o[1] + (hz[i * 3 + 1] - o[1]) * fg; col[i * 3 + 2] = o[2] + (hz[i * 3 + 2] - o[2]) * fg;
    zb[i] = z;
  }
}

module.exports = { N, SUN, FOG, DECK_P, newFrame, sky, drawSky, drawClouds, deckH };

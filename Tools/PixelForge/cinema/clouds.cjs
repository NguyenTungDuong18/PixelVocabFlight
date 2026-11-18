'use strict';
// Cumulus as sphere impostors (split out of sky.cjs), traced per pixel against the real view ray:
//  - every sphere is displaced by 4-octave fbm on its own surface (octaves smaller than a pixel drop out), so a cloud
//    reads big mass -> lobes -> fine curd instead of a bag of equal balls;
//  - a flat base (puff[7]): rays that enter a sphere below the cloud base miss it, seen from below they hit a flat floor;
//  - depths are smooth-blended per pixel (one billowing mass), normals come from the blended depth;
//  - soft edges: alpha from the chord through the sphere, eroded by the finest octave (wisps), composited over the deck/ground;
//  - light: wrapped sun times a screen-space shadow march toward the low sun (lobes shade their neighbours), crevice
//    occlusion, cool sky fill from above, silver lining (Henyey-Greenstein) on thin edges toward the sun, the glow of the
//    burning city on the undersides, its own aerial perspective (cloud fades into the haze over ~13 km).
const C = require('./core.cjs');
const { W, H, clamp, smooth, noise3, RAMP, rampAt } = C;
const { SUN, FOG, DECK_P } = require('./sky.cjs');
const Gr = require('./ground.cjs');

const FOG_CL = 13000;                                                // deck cumulus: metres to 63 percent haze (the storm towers keep FOG)
const OCT = [[2.1, .5], [4.6, .27], [9.8, .15], [21, .08]];            // displacement octaves: frequency on the unit sphere, amplitude
const SH_PX = [2, 4, 7, 11, 17, 26];                                 // shadow march toward the sun, in pixels
const SH_DECK = [3, 6, 10, 15, 22, 32, 45, 62, 85, 115, 150];        // the same from the deck (shadows run ~8 x the cloud height)
const AO_DIR = [[1, 0], [.71, .71], [0, 1], [-.71, .71], [-1, 0], [-.71, -.71], [0, -1], [.71, -.71]];
const NB = new Float32Array(W * H * 3), NS = new Float32Array(W * H * 3), EB = new Uint8Array(W * H);   // normals, blurred normals, 0 / 1 edge / 2 no cloud
const CR = new Float32Array(W * H), NM = new Float32Array(W * H * 3);                                 // how near the outline of its own front lobe a pixel is (lobe linings)
const HG = cs => { const g = .72; return (1 - g * g) / Math.pow(1 + g * g - 2 * g * cs, 1.5); };   // x 4 pi: 1 = isotropic

// the burning belt and the big fires light the cloud from below (smooth; world position)
function fireGlow(x, y) {
  let g = smooth((-900 - x) / 1600) * smooth((x + 11500) / 2500) * .55;
  for (const c of Gr.COLS) if (c.fire > 200) { const d = Math.hypot(x - c.x, y - c.y), R = c.fire * 7; if (d < R) g = Math.max(g, smooth(1 - d / R)); }
  return g;
}

// ---------------------------------------------------------------- pass 2: cumulus (sphere impostors)
// puff: [x, y, z, r, height 0..1 inside its cloud, kind, seed, base z (optional)]; kind 0 deck cumulus (slides with off),
// 1 storm tower (darker), 2 smoke column, 3 far bright tower. off: the deck scroll, so the shading detail travels with the deck clouds.
function drawClouds(fr, cam, puffs, off) {
  const oy = (off && off[1]) || 0, ox = (off && off[0]) || 0;
  const { R, U, F, f, pos } = cam, cz = fr.cz, ch = fr.ch, ck = fr.ck, ca = fr.ca, dir = fr.dir;
  // far to near, so the blend never depends on the order of the list (the loop shot rebuilds the list every frame)
  const order = [];
  for (let k = 0; k < puffs.length; k++) { const p = puffs[k], vz = (p[0] - pos[0]) * F[0] + (p[1] - pos[1]) * F[1] + (p[2] - pos[2]) * F[2]; if (vz >= p[3] * .6 + 2) order.push([vz, k]); }
  order.sort((u, v) => v[0] - u[0] || u[1] - v[1]);
  for (const [vz, k] of order) {
    const p = puffs[k], dx = p[0] - pos[0], dy = p[1] - pos[1], dz = p[2] - pos[2], r = p[3];
    const vx = dx * R[0] + dy * R[1] + dz * R[2], vy = dx * U[0] + dy * U[1] + dz * U[2];
    const cx = W / 2 + f * vx / vz, cy = H / 2 - f * vy / vz, rs = f * r / vz, lump = rs > 2;
    const rb = r * (lump ? 1.24 : 1), rm = rs * (lump ? 1.36 : 1.1);
    if (cx + rm < 0 || cx - rm > W || cy + rm < 0 || cy - rm > H || rs < .45) continue;
    const x0 = Math.max(0, Math.floor(cx - rm)), x1 = Math.min(W - 1, Math.ceil(cx + rm)), y0 = Math.max(0, Math.floor(cy - rm)), y1 = Math.min(H - 1, Math.ceil(cy + rm));
    const seed = p[6], hgt = p[4], kind = p[5], base = p[7] === undefined ? -1e9 : p[7], tw = kind === 1 || kind === 3, crown = tw ? smooth((hgt - .55) / .3) : 0, kk = r * (tw ? .5 - .3 * crown : .55);   // smooth union: tower trunks fuse into one column, crown lobes keep their creases
    const ex = -dx, ey = -dy, ez = -dz, ee = ex * ex + ey * ey + ez * ez;   // camera relative to the centre
    let no = 0; for (const o of OCT) if (rs / o[0] > 1.1) no++;
    const geo = tw ? (crown > .5 ? 4 : 3) : 2, gsum = OCT[0][1] + OCT[1][1] + (geo > 2 ? OCT[2][1] : 0) + (geo > 3 ? OCT[3][1] : 0);   // towers: more octaves of lobes, the crown the finest
    const soft = rs * (kind === 2 ? .7 : .36 - .16 * crown), ero = kind === 2 ? .7 : .45;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, ddx = dir[i * 3], ddy = dir[i * 3 + 1], ddz = dir[i * 3 + 2];
      const b = ex * ddx + ey * ddy + ez * ddz, bd = b * b - ee + rb * rb;
      if (bd <= 0) continue;
      let rr = r, en = .5;
      if (lump) {
        // displacement: fbm on the direction from the centre where the ray meets the bounding sphere
        const t0 = -b - Math.sqrt(bd), nx = (ex + ddx * t0) / rb, ny = (ey + ddy * t0) / rb, nz = (ez + ddz * t0) / rb;
        // the big octaves (2, towers 3) bend the surface; the fine ones only eat the edge (wisps) and grain the light (shade pass);
        // octaves under a pixel are replaced by their mean
        let s = 0;
        for (let o = 0; o < OCT.length; o++) {
          if (o >= no) { if (o < geo) s += OCT[o][1] * .5; continue; }
          const fq = OCT[o][0], v = noise3(nx * fq + seed, ny * fq - seed * .7, nz * fq + o * 17.3, 7 + o);
          if (o < geo) s += OCT[o][1] * v; else en = o === geo ? v : en * .6 + v * .4;
        }
        rr = r * (.8 + .44 * s / gsum);
      }
      const d2 = b * b - ee + rr * rr;
      if (d2 <= 0) continue;
      const sq = Math.sqrt(d2);
      let tIn = -b - sq, tOut = -b + sq;
      if (tIn < 1) continue;
      const zi = pos[2] + ddz * tIn, zo = pos[2] + ddz * tOut;
      if (zi < base) { if (ddz <= 0 || zo < base) continue; tIn = (base - pos[2]) / ddz; }   // from below: the flat floor
      else if (zo < base) tOut = (base - pos[2]) / ddz;
      const cosv = F[0] * ddx + F[1] * ddy + F[2] * ddz, zs = tIn * cosv;
      const cn = (tOut - tIn) * cosv * f / vz;                        // chord in pixels
      // the feet melt into the deck / low haze (no floor line; a tower anvil keeps its flat underside), the rest has a soft, wisp-eaten edge
      const al = smooth((cn - ero * soft * (en - .3)) / soft) * (base > -1e8 ? smooth((zi - base) / (tw ? 25 + .9 * r * (1 - crown) : 25 + .3 * r)) : 1);
      if (al <= 0) continue;
      const a = cz[i], le = Math.max(0, 1 - (tOut - tIn) / (2 * rr));               // le: 0 mid-lobe .. 1 at the lobe's own outline
      if (a > 1e8) { cz[i] = zs; ch[i] = hgt; ck[i] = kind + 1; ca[i] = al; CR[i] = le; continue; }
      const h = Math.max(kk - Math.abs(a - zs), 0) / kk, m = Math.min(a, zs) - h * h * kk * .25;
      const wgt = zs < a ? 1 - h * .5 : h * .5;                    // share of the new sphere in the blend
      cz[i] = m; ch[i] += (hgt - ch[i]) * wgt; if (zs < a) { ck[i] = kind + 1; CR[i] = le * (1 - h * .7); }
      ca[i] = 1 - (1 - ca[i]) * (1 - al);
    }
  }
  // shade from the blended depth
  const col = fr.col, zb = fr.z, hz = fr.haze, o = [0, 0, 0];
  const sR = SUN[0] * R[0] + SUN[1] * R[1] + SUN[2] * R[2], sU = SUN[0] * U[0] + SUN[1] * U[1] + SUN[2] * U[2], sF = SUN[0] * F[0] + SUN[1] * F[1] + SUN[2] * F[2];
  const sPerp = Math.max(.3, Math.hypot(sR, sU));
  // the cumulus throw long shadows across the deck, away from the low sun (march from the deck point toward the sun
  // through the cloud depth buffer; the deck colour is already in col, the cloud is composited over it below)
  if (pos[2] > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, ddz = dir[i * 3 + 2]; if (ddz > -1e-3) continue;
    const cosv = F[0] * dir[i * 3] + F[1] * dir[i * 3 + 1] + F[2] * ddz, z = zb[i], zd = -pos[2] / ddz * cosv;
    if (Math.abs(z - zd) > zd * 1e-3 + .5) continue;                  // not the deck
    const foot = z / f, vx0 = (x + .5 - W / 2) / f * z, vy0 = (H / 2 - y - .5) / f * z;
    let sh = 0;
    for (const k of SH_DECK) {
      const s = k * foot / sPerp, qz = z + sF * s; if (qz < 10) break;
      const qx = Math.floor(W / 2 + f * (vx0 + sR * s) / qz), qy = Math.floor(H / 2 - f * (vy0 + sU * s) / qz);
      if (qx < 0 || qx >= W || qy < 0 || qy >= H) break;
      const j = qy * W + qx, gap = qz - cz[j];
      if (ck[j] === 1 && gap > foot + 10 && gap < 900) { sh += .4 * ca[j]; if (sh >= 1) break; }
    }
    if (sh > 0) { sh = Math.min(1, sh); col[i * 3] *= 1 - .42 * sh; col[i * 3 + 1] *= 1 - .4 * sh; col[i * 3 + 2] *= 1 - .3 * sh; }
  }
  // normals from the blended depth, then a depth-aware 5x5 blur mixed back in: the cloud keeps its big rounded form and
  // its lobes but loses the faceted, rock-like breaks
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = cz[i];
    if (z >= zb[i] || ca[i] < .02) { EB[i] = 2; continue; }
    // view-space neighbours (fall back to the other side across a depth break)
    const jx = x + 1 < W && Math.abs(cz[i + 1] - z) < Math.abs((x > 0 ? cz[i - 1] : 1e9) - z) ? 1 : -1;
    const jy = y + 1 < H && Math.abs(cz[i + W] - z) < Math.abs((y > 0 ? cz[i - W] : 1e9) - z) ? 1 : -1;
    const zx = x + jx >= 0 && x + jx < W ? cz[i + jx] : z, zy = y + jy >= 0 && y + jy < H ? cz[i + jy * W] : z;
    const eg = z * (ck[i] === 2 || ck[i] === 4 ? .1 - .06 * smooth((ch[i] - .55) / .3) : .04) + 30, edge = Math.abs(zx - z) > eg || Math.abs(zy - z) > eg;   // tower trunk: lobes in front of lobes are not outlined
    const px = (x + .5 - W / 2) / f, py = (H / 2 - y - .5) / f;
    // tangent vectors in view space
    let tx0 = (px + jx / f) * zx - px * z, tx1 = py * zx - py * z, tx2 = zx - z;
    let ty0 = px * zy - px * z, ty1 = (py - jy / f) * zy - py * z, ty2 = zy - z;
    if (edge) { tx0 = jx * z / f; tx1 = 0; tx2 = 0; ty0 = 0; ty1 = -jy * z / f; ty2 = 0; }
    let nx = tx1 * ty2 - tx2 * ty1, ny = tx2 * ty0 - tx0 * ty2, nz = tx0 * ty1 - tx1 * ty0;
    if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl;
    NB[i * 3] = R[0] * nx + U[0] * ny + F[0] * nz; NB[i * 3 + 1] = R[1] * nx + U[1] * ny + F[1] * nz; NB[i * 3 + 2] = R[2] * nx + U[2] * ny + F[2] * nz; EB[i] = edge ? 1 : 0;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (EB[i] === 2) continue;
    const z = cz[i], lim = z * .03 + 40;
    let sx = 0, sy = 0, sz = 0;
    for (let v = Math.max(0, y - 2); v <= Math.min(H - 1, y + 2); v++) for (let u = Math.max(0, x - 2); u <= Math.min(W - 1, x + 2); u++) {
      const j = v * W + u; if (EB[j] === 2 || Math.abs(cz[j] - z) > lim) continue;
      sx += NB[j * 3]; sy += NB[j * 3 + 1]; sz += NB[j * 3 + 2];
    }
    const l = Math.hypot(sx, sy, sz) || 1; NS[i * 3] = sx / l; NS[i * 3 + 1] = sy / l; NS[i * 3 + 2] = sz / l;
    // the mass as a whole (13 x 13, every 3rd pixel): sunward side of the whole cloud warm, the far side in shade
    if (ck[i] !== 1) continue;
    const lm = z * .08 + 150; sx = 0; sy = 0; sz = 0;
    for (let v = y - 6; v <= y + 6; v += 3) for (let u = x - 6; u <= x + 6; u += 3) {
      if (v < 0 || v >= H || u < 0 || u >= W) continue;
      const j = v * W + u; if (EB[j] === 2 || Math.abs(cz[j] - z) > lm) continue;
      sx += NB[j * 3]; sy += NB[j * 3 + 1]; sz += NB[j * 3 + 2];
    }
    const lq = Math.hypot(sx, sy, sz) || 1; NM[i * 3] = sx / lq; NM[i * 3 + 1] = sy / lq; NM[i * 3 + 2] = sz / lq;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (EB[i] === 2) continue;
    const z = cz[i], edge = EB[i] === 1, px = (x + .5 - W / 2) / f, py = (H / 2 - y - .5) / f;
    const tw = ck[i] === 2 || ck[i] === 4, crown = tw ? smooth((ch[i] - .55) / .3) : 0, kf = tw ? .45 + .45 * crown : .4;   // tower crowns keep their sharp lobes, the trunk reads as one column
    let wx = NB[i * 3] * kf + NS[i * 3] * (1 - kf), wy = NB[i * 3 + 1] * kf + NS[i * 3 + 1] * (1 - kf), wz = NB[i * 3 + 2] * kf + NS[i * 3 + 2] * (1 - kf);
    if (ck[i] === 1) { wx = wx * .6 + NM[i * 3] * .4; wy = wy * .6 + NM[i * 3 + 1] * .4; wz = wz * .6 + NM[i * 3 + 2] * .4; }
    { const l = Math.hypot(wx, wy, wz) || 1; wx /= l; wy /= l; wz /= l; }
    const ddx = dir[i * 3], ddy = dir[i * 3 + 1], ddz = dir[i * 3 + 2];
    const ndl = wx * SUN[0] + wy * SUN[1] + wz * SUN[2], wrap = clamp((ndl + .5) / 1.5), cosT = ddx * SUN[0] + ddy * SUN[1] + ddz * SUN[2];
    const facing = Math.abs(wx * ddx + wy * ddy + wz * ddz), kind = ck[i] - 1, hgt = ch[i];
    const t = z / (F[0] * ddx + F[1] * ddy + F[2] * ddz), pwx = pos[0] + ddx * t, pwy = pos[1] + ddy * t, pwz = pos[2] + ddz * t;
    const foot = z / f;
    // the low sun: march toward it through the depth buffer; a lobe in front of the ray point shades this one
    let occ = 0;
    if (kind !== 2) {
      const vx0 = px * z, vy0 = py * z;
      for (const k of SH_PX) {
        const s = k * foot / sPerp, qz = z + sF * s; if (qz < 10) break;
        const qx = Math.floor(W / 2 + f * (vx0 + sR * s) / qz), qy = Math.floor(H / 2 - f * (vy0 + sU * s) / qz);
        if (qx < 0 || qx >= W || qy < 0 || qy >= H) break;
        const j = qy * W + qx, cj = cz[j], gap = qz - cj;
        if (gap > foot * 1.5 + 15 && gap < (ck[j] === 1 || ck[j] === 3 ? 900 : 7000)) { occ += .25 * ca[j]; if (occ >= 1) break; }
      }
    }
    const vis = 1 - (kind === 0 ? .65 : .62) * Math.min(1, occ);   // towers: the crown shades the trunk below it
    // crevices: neighbours a little nearer the camera close the sky over this point
    let ao = 0;
    { const ra = clamp((kind === 1 || kind === 3 ? 220 : 70) / foot, 1.5, 6), lim = ra * foot * 1.6;
      for (const [ax, ay] of AO_DIR) {
        const qx = Math.round(x + ax * ra), qy = Math.round(y + ay * ra); if (qx < 0 || qx >= W || qy < 0 || qy >= H) continue;
        const g = z - cz[qy * W + qx]; if (g > 0 && g < lim * 5) ao += Math.min(1, g / lim);
      }
      ao /= 8; }
    // target tones (ramp L): shade side ~.42 violet, tops in grazing light ~.6 rose, sunward faces ~.85 peach, rims ~1
    // (cloud scatters: soft terminator, values kept close; a lobe's shadow is two steps, never near black)
    let L = .28 + .18 * (wz * .5 + .5) + .5 * smooth(wrap) * vis - .16 * ao;   // the sky lights every lobe's top, even against the sun
    L *= .84 + .16 * hgt;
    // grain of the cloud surface (curd), 85 m and 30 m, the fine one only where it spans a few pixels; deck cumulus: periodic in y
    const wf = clamp(30 / foot - .7) * (.4 + .6 * wrap);
    if (kind === 0) { const yy = ((pwy - oy) % DECK_P + DECK_P) % DECK_P, tt = yy / DECK_P, qx = pwx - ox;
      L += (noise3(qx / 85, yy / 85, pwz / 85, 21) * (1 - tt) + noise3(qx / 85, (yy - DECK_P) / 85, pwz / 85, 21) * tt - .5) * .07;
      if (wf > 0) L += (noise3(qx / 30, yy / 30, pwz / 30, 22) * (1 - tt) + noise3(qx / 30, (yy - DECK_P) / 30, pwz / 30, 22) * tt - .5) * .09 * wf; }
    else { L += (noise3(pwx / 85, pwy / 85, pwz / 85, 21) - .5) * .07; if (wf > 0) L += (noise3(pwx / 30, pwy / 30, pwz / 30, 22) - .5) * .09 * wf;
      if (tw) L += (noise3(pwx / 380, pwy / 380, pwz / 2600, 24) - .5) * .16 * (1 - crown); }   // trunk: vertical fibres
    // silver lining: thin edges and wisps glow toward the sun (forward scattering), lit faces get a hot rim
    // (the unblurred normal, so every lobe gets its own lining)
    const ff = 1 - Math.abs(NB[i * 3] * ddx + NB[i * 3 + 1] * ddy + NB[i * 3 + 2] * ddz), thin = Math.max(ff * ff, (1 - facing) * (1 - facing), 1 - ca[i], (kind === 0 ? .6 * Math.pow(CR[i], 3) : Math.pow(CR[i], 1.5) * crown)) * (edge ? 1 : .75);
    if (kind === 1) L = L * .6 - .05;                                  // dark storm walls (thick: little light gets through) ...
    L += Math.min(.62, (kind === 0 ? .075 : .1) * HG(cosT) * thin) * (kind === 0 ? .35 + .65 * vis : 1) + (edge ? .08 * Math.max(0, cosT) * vis : 0);   // ... but lined toward the sun
    if (kind === 2) { rampAt(RAMP.smoke, clamp(L * .62 + .04), o); const g = .5 * Math.exp(-Math.max(0, pwz) / 170) * Math.max(0, -wz + .2) * (.5 + .5 * noise3(pwx / 60, pwy / 60, pwz / 60 - 3, 23)); o[0] += g * .95; o[1] += g * .34; o[2] += g * .06; }
    else {
      rampAt(RAMP.cloud, L, o);
      if (kind === 0) {                                                // the burning city lights the undersides
        const g = fireGlow(pwx, pwy) * clamp(.55 - wz * .6) * (1 - .7 * hgt) * .22;
        if (g > 0) { o[0] += g * .95; o[1] += g * .38; o[2] += g * .12; }
      }
    }
    // haze: deck cumulus over ~13 km, the towers over FOG (a far tower must read paler than a near one, or two overlapping
    // towers merge into one stone arch); the bright towers sink into the denser low haze toward their feet
    let fg = 1 - Math.exp(-t / (kind === 0 ? FOG_CL : FOG));
    if (kind === 3) fg += (1 - fg) * .5 * Math.pow(1 - hgt, 1.5);
    const a = ca[i] * (kind === 3 ? .6 + .4 * smooth(hgt / .35) : 1);   // far towers: feet thin out into the low haze
    const cr = o[0] + (hz[i * 3] - o[0]) * fg, cg = o[1] + (hz[i * 3 + 1] - o[1]) * fg, cb = o[2] + (hz[i * 3 + 2] - o[2]) * fg;
    col[i * 3] += (cr - col[i * 3]) * a; col[i * 3 + 1] += (cg - col[i * 3 + 1]) * a; col[i * 3 + 2] += (cb - col[i * 3 + 2]) * a;
    if (a > .5) zb[i] = z;
  }
}

module.exports = { drawClouds };

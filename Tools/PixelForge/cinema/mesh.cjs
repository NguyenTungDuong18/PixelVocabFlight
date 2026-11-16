'use strict';
// Aircraft pass: triangle rasteriser into a G-buffer (instance, plane-space point and normal, ambient
// occlusion), then deferred shading with the model's paint function evaluated per pixel (so roundels and
// panel lines stay crisp at any size), low sun + sky + point lights (explosions, muzzle flashes), haze,
// ink outlines on near aircraft, propeller discs, and a guaranteed "cross" silhouette for far ones.
const C = require('./core.cjs');
const { W, H, clamp, RAMP, rampAt } = C;
const { SUN, FOG } = require('./sky.cjs');
const { MODELS, LOD_CELLS } = require('./models.cjs');
const N = W * H, NEAR = .6;
const INK = RAMP.ink[1], COOL = [.86, .9, 1.1], WARM = [1.1, 1, .88];

// ---- one-time mesh preparation: interleaved attributes, consistent outward winding, bounds
function prep(m) {
  if (m.ready) return;
  for (const l of m.lods) {
    const nv = l.pos.length / 3, att = new Float32Array(nv * 7);
    for (let i = 0; i < nv; i++) { att.set(l.pos.subarray(i * 3, i * 3 + 3), i * 7); att.set(l.nrm.subarray(i * 3, i * 3 + 3), i * 7 + 3); att[i * 7 + 6] = l.ao[i]; }
    let s = 0; const p = l.pos, n = l.nrm, ix = l.idx;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      s += (uy * vz - uz * vy) * (n[a] + n[b] + n[c]) + (uz * vx - ux * vz) * (n[a + 1] + n[b + 1] + n[c + 1]) + (ux * vy - uy * vx) * (n[a + 2] + n[b + 2] + n[c + 2]);
    }
    if (s < 0) for (let t = 0; t < ix.length; t += 3) { const q = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = q; }
    l.att = att; l.sx = new Float32Array(nv); l.sy = new Float32Array(nv); l.sz = new Float32Array(nv);
  }
  const b = m.box; m.bound = Math.hypot(Math.max(-b[0], b[3]), Math.max(-b[1], b[4]), Math.max(-b[2], b[5]));
  m.span = m.tips ? Math.hypot(m.tips[0][0] - m.tips[1][0], m.tips[0][1] - m.tips[1][1]) : m.bound * 2;
  m.ready = true;
}
// The sign of the screen-space area of a triangle whose outward normal faces the camera.
const FRONT = (() => {
  const cam = C.makeCam({ pos: [0, 0, 0], target: [0, 1, 0], fov: 50 }), a = cam.project([0, 5, 0]), b = cam.project([1, 5, 0]), c = cam.project([0, 5, 1]);
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
})();

function tri(fr, id, x0, y0, z0, x1, y1, z1, x2, y2, z2, A0, o0, A1, o1, A2, o2) {
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area * FRONT <= 0) return;
  let xa = Math.floor(Math.min(x0, x1, x2)), xb = Math.ceil(Math.max(x0, x1, x2)), ya = Math.floor(Math.min(y0, y1, y2)), yb = Math.ceil(Math.max(y0, y1, y2));
  if (xb < 0 || yb < 0 || xa >= W || ya >= H) return;
  if (xa < 0) xa = 0; if (ya < 0) ya = 0; if (xb > W - 1) xb = W - 1; if (yb > H - 1) yb = H - 1;
  const inv = 1 / area, i0 = 1 / z0, i1 = 1 / z1, i2 = 1 / z2, zb = fr.z, gz = fr.gz, gp = fr.gp, gn = fr.gn;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + .5, py = y + .5;
    const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const iz = w0 * i0 + w1 * i1 + w2 * i2, z = 1 / iz, i = y * W + x;
    if (z >= zb[i] || z >= gz[i]) continue;
    const k0 = w0 * i0 * z, k1 = w1 * i1 * z, k2 = w2 * i2 * z, j = i * 3;
    gz[i] = z; fr.gid[i] = id;
    gp[j] = A0[o0] * k0 + A1[o1] * k1 + A2[o2] * k2; gp[j + 1] = A0[o0 + 1] * k0 + A1[o1 + 1] * k1 + A2[o2 + 1] * k2; gp[j + 2] = A0[o0 + 2] * k0 + A1[o1 + 2] * k1 + A2[o2 + 2] * k2;
    gn[j] = A0[o0 + 3] * k0 + A1[o1 + 3] * k1 + A2[o2 + 3] * k2; gn[j + 1] = A0[o0 + 4] * k0 + A1[o1 + 4] * k1 + A2[o2 + 4] * k2; gn[j + 2] = A0[o0 + 5] * k0 + A1[o1 + 5] * k1 + A2[o2 + 5] * k2;
    fr.gao[i] = A0[o0 + 6] * k0 + A1[o1 + 6] * k1 + A2[o2 + 6] * k2;
  }
}
// A triangle that crosses the near plane: clip in view space, then draw the fan.
const CL = new Float32Array(7 * 8);
function clipped(fr, id, f, V, att, ia, ib, ic) {
  const src = [ia, ib, ic], pts = [];
  for (let e = 0; e < 3; e++) {
    const a = src[e], b = src[(e + 1) % 3], za = V[a * 3 + 2], zb = V[b * 3 + 2];
    if (za >= NEAR) pts.push([V[a * 3], V[a * 3 + 1], za, a, a, 0]);
    if ((za >= NEAR) !== (zb >= NEAR)) { const t = (NEAR - za) / (zb - za); pts.push([V[a * 3] + (V[b * 3] - V[a * 3]) * t, V[a * 3 + 1] + (V[b * 3 + 1] - V[a * 3 + 1]) * t, NEAR, a, b, t]); }
  }
  pts.forEach((p, k) => { for (let q = 0; q < 7; q++) CL[k * 7 + q] = att[p[3] * 7 + q] + (att[p[4] * 7 + q] - att[p[3] * 7 + q]) * p[5]; p[6] = W / 2 + f * p[0] / p[2]; p[7] = H / 2 - f * p[1] / p[2]; });
  for (let k = 1; k + 1 < pts.length; k++) tri(fr, id, pts[0][6], pts[0][7], pts[0][2], pts[k][6], pts[k][7], pts[k][2], pts[k + 1][6], pts[k + 1][7], pts[k + 1][2], CL, 0, CL, k * 7, CL, (k + 1) * 7);
}
let VB = new Float32Array(3 * 4096);
// inst: { model, pos, B: [fwd, left, up], scale?, prop (rad), marks, flash 0..1, stopped: [engine index...] }
function drawMesh(fr, cam, inst, id) {
  const m = MODELS[inst.model]; prep(m);
  const s = (inst.scale || 1) * m.scale, B = inst.B, vc = cam.view(inst.pos), dist = Math.max(1, Math.hypot(vc[0], vc[1], vc[2])), rad = m.bound * s, f = cam.f;
  inst.ppu = f * s / dist; inst.s = s; inst.far = false;
  if (vc[2] < -rad) return;
  const zz = Math.max(vc[2], NEAR), lim = rad * f / zz;
  if (Math.abs(vc[0]) * f / zz - lim > W / 2 || Math.abs(vc[1]) * f / zz - lim > H / 2) return;
  let lod = 0;
  for (let l = LOD_CELLS.length - 1; l >= 1; l--) if (inst.ppu * LOD_CELLS[l] * m.step < .8) { lod = l; break; }
  inst.far = inst.ppu * m.span < 22;
  const L = m.lods[lod], att = L.att, nv = att.length / 7, sx = L.sx, sy = L.sy, sz = L.sz, { R, U, F } = cam;
  if (VB.length < nv * 3) VB = new Float32Array(nv * 3);
  const M = [R, U, F].map(ax => [0, 1, 2].map(c => (ax[0] * B[c][0] + ax[1] * B[c][1] + ax[2] * B[c][2]) * s));
  if (inst.pivot) for (let k = 0; k < 3; k++) vc[k] -= M[k][0] * inst.pivot[0] + M[k][1] * inst.pivot[1] + M[k][2] * inst.pivot[2];
  let anyNear = false;
  for (let i = 0; i < nv; i++) {
    const x = att[i * 7], y = att[i * 7 + 1], z = att[i * 7 + 2];
    const vx = vc[0] + M[0][0] * x + M[0][1] * y + M[0][2] * z, vy = vc[1] + M[1][0] * x + M[1][1] * y + M[1][2] * z, vz = vc[2] + M[2][0] * x + M[2][1] * y + M[2][2] * z;
    VB[i * 3] = vx; VB[i * 3 + 1] = vy; VB[i * 3 + 2] = vz; sz[i] = vz;
    if (vz >= NEAR) { sx[i] = W / 2 + f * vx / vz; sy[i] = H / 2 - f * vy / vz; } else anyNear = true;
  }
  const ix = L.idx;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t], b = ix[t + 1], c = ix[t + 2];
    if (anyNear && (sz[a] < NEAR || sz[b] < NEAR || sz[c] < NEAR)) { if (sz[a] >= NEAR || sz[b] >= NEAR || sz[c] >= NEAR) clipped(fr, id, f, VB, att, a, b, c); continue; }
    tri(fr, id, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], sx[c], sy[c], sz[c], att, a * 7, att, b * 7, att, c * 7);
  }
}

// lights: [{ p: [x,y,z], c: [r,g,b], i: intensity, r: reach in metres }]
function shade(fr, cam, insts, lights) {
  const { F, pos } = cam, col = fr.col, dir = fr.dir, gp = fr.gp, gn = fr.gn, hz = fr.haze, o = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const id = fr.gid[i]; if (id < 0) continue;
    const inst = insts[id], m = MODELS[inst.model], B = inst.B, j = i * 3;
    let nx = gn[j], ny = gn[j + 1], nz = gn[j + 2]; const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl;
    n[0] = nx; n[1] = ny; n[2] = nz;
    const lx = gp[j], ly = gp[j + 1], lz = gp[j + 2];
    let P = m.paint(lx, ly, lz, n, inst.ppu);
    if (inst.marks) for (const k of inst.marks) { const d = Math.hypot(lx - k.p[0], ly - k.p[1], lz - k.p[2]); if (d < k.r) { P = d < k.r * .4 ? { r: RAMP.smoke, l: -.5 } : { r: RAMP.smoke, l: -.1 }; break; } }
    const wx = B[0][0] * nx + B[1][0] * ny + B[2][0] * nz, wy = B[0][1] * nx + B[1][1] * ny + B[2][1] * nz, wz = B[0][2] * nx + B[1][2] * ny + B[2][2] * nz;
    const dx = dir[j], dy = dir[j + 1], dz = dir[j + 2], z = fr.gz[i], t = z / (F[0] * dx + F[1] * dy + F[2] * dz);
    const dif = Math.max(0, wx * SUN[0] + wy * SUN[1] + wz * SUN[2]), sky = .5 + .5 * wz, ao = fr.gao[i];
    let hx = SUN[0] - dx, hy = SUN[1] - dy, hzz = SUN[2] - dz; const hl = 1 / (Math.hypot(hx, hy, hzz) || 1);
    const spec = Math.pow(Math.max(0, (wx * hx + wy * hy + wz * hzz) * hl), 28);
    const back = Math.max(0, dx * SUN[0] + dy * SUN[1] + dz * SUN[2]), fres = 1 - Math.max(0, -(wx * dx + wy * dy + wz * dz)), rim = fres * fres * fres * back * back;
    const bounce = Math.max(0, -wz) * .14;
    let emis = false;
    if (P.e) { o[0] = P.c[0] * 1.2; o[1] = P.c[1] * 1.2; o[2] = P.c[2] * 1.2; emis = true; }
    else if (P.glass) rampAt(P.r, .18 + .3 * sky + .28 * dif + 1.3 * spec + (P.l || 0) + rim * .9 + ((lx - lz) * .12 - Math.floor((lx - lz) * .12) < .18 ? .14 : 0), o);
    else {
      const L = .1 + .36 * dif + (.2 + .1 * sky) * ao + bounce + .3 * spec + rim * .85;
      if (P.r) rampAt(P.r, L * .84 + (P.l || 0) * .8 + .05, o);
      else { const k = .34 + 1.0 * L; o[0] = P.c[0] * k; o[1] = P.c[1] * k; o[2] = P.c[2] * k; }
    }
    if (!emis) {
      const wk = clamp(dif * 1.4 + rim);
      o[0] *= COOL[0] + (WARM[0] - COOL[0]) * wk; o[1] *= COOL[1] + (WARM[1] - COOL[1]) * wk; o[2] *= COOL[2] + (WARM[2] - COOL[2]) * wk;
      if (lights) {
        const pwx = pos[0] + dx * t, pwy = pos[1] + dy * t, pwz = pos[2] + dz * t;
        let lr = 0, lg = 0, lb = 0;
        for (const li of lights) {
          const vx = li.p[0] - pwx, vy = li.p[1] - pwy, vz = li.p[2] - pwz, d = Math.hypot(vx, vy, vz);
          if (d >= li.r) continue;
          const a = .4 * li.i * (1 - d / li.r) * (1 - d / li.r) * (.3 + .7 * Math.max(0, (wx * vx + wy * vy + wz * vz) / (d || 1)));
          lr += li.c[0] * a; lg += li.c[1] * a; lb += li.c[2] * a;
        }
        // fire light: never more than a warm wash, stronger on light paint than on dark
        const mx = Math.max(lr, lg, lb); if (mx > 0) { const k = Math.min(1, .3 / mx) * (.35 + .9 * Math.max(o[0], o[1], o[2])); o[0] += lr * k; o[1] += lg * k; o[2] += lb * k; }
      }
    }
    if (inst.flash) { o[0] += (1.2 - o[0]) * inst.flash; o[1] += (1.1 - o[1]) * inst.flash; o[2] += (.9 - o[2]) * inst.flash; }
    if (inst.dim) { o[0] *= 1 - inst.dim; o[1] *= 1 - inst.dim; o[2] *= 1 - inst.dim; }
    const fg = Math.min(.82, 1 - Math.exp(-t / (FOG * .8)));
    col[j] = o[0] + (hz[j] - o[0]) * fg; col[j + 1] = o[1] + (hz[j + 1] - o[1]) * fg; col[j + 2] = o[2] + (hz[j + 2] - o[2]) * fg;
    if (P.glass && spec > .55) { fr.add[j] += spec * .5; fr.add[j + 1] += spec * .48; fr.add[j + 2] += spec * .4; }
  }
  // ink: inner lines on depth steps, then a dark line just outside near silhouettes
  const gid = fr.gid, gz = fr.gz, zb = fr.z;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, id = gid[i];
    if (id >= 0) {
      const inst = insts[id]; if (inst.ppu * MODELS[inst.model].span < 34) continue;
      const thr = 2.4 * inst.s; let inner = false;
      if (x + 1 < W && gid[i + 1] >= 0 && gz[i + 1] > gz[i] + thr) inner = true;
      else if (x > 0 && gid[i - 1] >= 0 && gz[i - 1] > gz[i] + thr) inner = true;
      else if (y + 1 < H && gid[i + W] >= 0 && gz[i + W] > gz[i] + thr) inner = true;
      else if (y > 0 && gid[i - W] >= 0 && gz[i - W] > gz[i] + thr) inner = true;
      if (inner) { col[i * 3] = col[i * 3] * .42 + INK[0] * .58; col[i * 3 + 1] = col[i * 3 + 1] * .42 + INK[1] * .58; col[i * 3 + 2] = col[i * 3 + 2] * .42 + INK[2] * .58; }
      continue;
    }
    let near = -1, nz = 0;
    if (x + 1 < W && gid[i + 1] >= 0 && gz[i + 1] < zb[i]) { near = gid[i + 1]; nz = gz[i + 1]; }
    else if (x > 0 && gid[i - 1] >= 0 && gz[i - 1] < zb[i]) { near = gid[i - 1]; nz = gz[i - 1]; }
    else if (y + 1 < H && gid[i + W] >= 0 && gz[i + W] < zb[i]) { near = gid[i + W]; nz = gz[i + W]; }
    else if (y > 0 && gid[i - W] >= 0 && gz[i - W] < zb[i]) { near = gid[i - W]; nz = gz[i - W]; }
    if (near < 0) continue;
    const inst = insts[near], sp = inst.ppu * MODELS[inst.model].span;
    if (sp < 34) continue;
    const a = clamp((sp - 34) / 40, .35, .8) * Math.exp(-nz / FOG);
    col[i * 3] += (INK[0] - col[i * 3]) * a; col[i * 3 + 1] += (INK[1] - col[i * 3 + 1]) * a; col[i * 3 + 2] += (INK[2] - col[i * 3 + 2]) * a;
  }
  for (let i = 0; i < N; i++) if (gid[i] >= 0) zb[i] = gz[i];
}

// Propeller discs (translucent, blurred blades) and the cross silhouette of far aircraft.
function extras(fr, cam, insts) {
  const { pos, f } = cam, col = fr.col, zb = fr.z, dir = fr.dir;
  for (const inst of insts) {
    const m = MODELS[inst.model], B = inst.B, s = inst.s;
    if (inst.ppu === undefined || !m.props) continue;
    if (inst.far && m.tips) {                                      // far: wing line + body line so the shape never breaks up
      const a = cam.project(C.toWorld(B, inst.pos, s, m.tips[0])), b = cam.project(C.toWorld(B, inst.pos, s, m.tips[1]));
      const c = cam.project(C.toWorld(B, inst.pos, s, [m.box[3] * .9, 0, 0])), d = cam.project(C.toWorld(B, inst.pos, s, [m.box[0] * .9, 0, 0]));
      if (a[2] > 1 && b[2] > 1 && c[2] > 1 && d[2] > 1) {
        const fg = Math.min(.8, 1 - Math.exp(-a[2] / (FOG * .8))), k = inst.dim ? 1 - inst.dim : 1;
        line(fr, a, b, [.2 * k, .21 * k, .27 * k], fg); line(fr, c, d, [.16 * k, .17 * k, .22 * k], fg);
      }
      continue;
    }
    for (let e = 0; e < m.props.length; e++) {
      if (inst.noProps || (inst.only && !inst.only.includes(e))) continue;
      const [px0, py0, pz0, pr] = m.props[e], Cw = C.toWorld(B, inst.pos, s, [px0, py0, pz0]), sc = cam.project(Cw), R = pr * s;
      if (sc[2] < NEAR) continue;
      const rp = R * f / sc[2] + 1; if (rp < 3 || sc[0] + rp < 0 || sc[0] - rp > W || sc[1] + rp < 0 || sc[1] - rp > H) continue;
      const Nn = B[0], A1 = B[1], A2 = B[2], rel0 = [Cw[0] - pos[0], Cw[1] - pos[1], Cw[2] - pos[2]], num = C.dot(rel0, Nn);
      const stop = inst.stopped && inst.stopped.includes(e), blade = (inst.prop || 0) * (e % 2 ? -1 : 1) + e;
      const x0 = Math.max(0, Math.floor(sc[0] - rp)), x1 = Math.min(W - 1, Math.ceil(sc[0] + rp)), y0 = Math.max(0, Math.floor(sc[1] - rp)), y1 = Math.min(H - 1, Math.ceil(sc[1] + rp));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, j = i * 3, dx = dir[j], dy = dir[j + 1], dz = dir[j + 2], den = dx * Nn[0] + dy * Nn[1] + dz * Nn[2];
        if (Math.abs(den) < .03) continue;
        const t = num / den; if (t <= 0) continue;
        const zv = t * (cam.F[0] * dx + cam.F[1] * dy + cam.F[2] * dz); if (zv > zb[i] + .25 * s) continue;
        const rx = dx * t - rel0[0], ry = dy * t - rel0[1], rz = dz * t - rel0[2], u = C.dot([rx, ry, rz], A1), v = C.dot([rx, ry, rz], A2), r = Math.hypot(u, v) / R;
        if (r > 1 || r < .16) continue;
        const ang = Math.atan2(v, u); let a = stop ? 0 : .1, cr = .8, cg = .78, cb = .72;
        for (let k = 0; k < 3; k++) {
          const dA = Math.abs(((ang - blade - k * C.TAU / 3) % C.TAU + C.TAU * 1.5) % C.TAU - Math.PI), wB = (.09 + .1 * Math.sin(Math.PI * Math.min(1, r * 1.1))) / Math.max(.4, r);
          if (stop) { if (dA < wB) { a = 1; cr = r > .9 ? .9 : .12; cg = r > .9 ? .75 : .12; cb = r > .9 ? .25 : .11; } }
          else if (dA < wB * 2.6) { a = Math.max(a, .16 + .3 * (1 - dA / (wB * 2.6))); cr = .5; cg = .48; cb = .46; }
        }
        if (!stop && rp > 7 && r > 1 - 1.3 / rp) { a = .26; cr = .92; cg = .78; cb = .3; }
        if (a <= 0) continue;
        col[j] += (cr - col[j]) * a; col[j + 1] += (cg - col[j + 1]) * a; col[j + 2] += (cb - col[j + 2]) * a;
      }
    }
  }
}
// 1 px line between two projected points [sx, sy, z] with a depth test; colour mixed toward the haze by fg.
function line(fr, a, b, c, fg = 0, alpha = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  if (n > 2000) return;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = Math.floor(a[0] + (b[0] - a[0]) * t), y = Math.floor(a[1] + (b[1] - a[1]) * t);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x, z = a[2] + (b[2] - a[2]) * t; if (z > fr.z[i]) continue;
    const j = i * 3, hz = fr.haze;
    fr.col[j] += (c[0] + (hz[j] - c[0]) * fg - fr.col[j]) * alpha; fr.col[j + 1] += (c[1] + (hz[j + 1] - c[1]) * fg - fr.col[j + 1]) * alpha; fr.col[j + 2] += (c[2] + (hz[j + 2] - c[2]) * fg - fr.col[j + 2]) * alpha;
  }
}

module.exports = { drawMesh, shade, extras, line, prep };

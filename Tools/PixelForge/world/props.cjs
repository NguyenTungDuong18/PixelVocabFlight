'use strict';
// World models: props (prop_*) placed on the base map. Logistics helpers below are a local
// copy of the ones in clutter.cjs (modules may only require common.cjs), kept in step by hand.
const { PAL, ramp, hash, fbm } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, RD, WD, NV, FI, SN } = PAL;
const {
  WH, CN, TP, PT, cl, uv, ix, flat, glow, concrete, olive, darkSteel, woodDark,
  woodPost, rope, redPaint, def, stripes
} = require('./common.cjs');

const RU = ramp('#2b170d', '#4c2814', '#6e3c1c', '#925426', '#b47137'); // rust (same as clutter.cjs)
const steelM = flat(ST[3]), steelD = flat(ST[2]);

// ---------------- Logistics helpers (see clutter.cjs) ----------------
function paint(R, i, s = 1, rust = .2, streaks = true) {
  return mat((x, y, z, f) => {
    const n = fbm(x * .45 + s * 3, (f === 'u' ? y : z) * .45 + y * .2, s + 5);
    if (n < rust) return cl(RU, n < rust - .1 ? 1 : 2);
    let k = 0;
    if (streaks && f !== 'u') { const h = hash(ix(x) * 7 + ix(y) * 13, 0, s); if (h < .14) k = -1; else if (h > .93) k = 1; }
    if (hash(ix(x), ix(y) * 31 + ix(z), s + 9) < .03) k += 1;
    return cl(R, i + k);
  });
}
function boards(R, i, s, z0, y0) {
  return mat((x, y, z, f) => {
    const [u] = uv(x, y, z, f), v = f === 'u' ? y - y0 : z - z0, b = ix(v / 3);
    if ((((ix(v) % 3) + 3) % 3) === 0 && v >= 1) return cl(R, i - 1);
    const h = hash(b, ix(u / 5), s);
    return cl(R, i + (hash(b, 3, s) < .3 ? -1 : 0) + (h < .06 ? -1 : h > .95 ? 1 : 0));
  });
}
const battens = (R, i, s) => mat((x, y, z, f) => cl(R, i + (hash(ix(x) * 3 + ix(y), ix(z), s) < .1 ? -1 : 0)));
// Crate: battens + border frame proud of recessed plank panels, diagonal braces, chipped top edges.
function crate(g, x0, y0, z0, x1, y1, z1, o = {}) {
  const R = o.R || WD, i = o.i ?? 4, s = o.s ?? 1, brace = o.brace ?? 'ew', bw = 1;
  const panel = boards(R, i - 1, s, z0, y0), frame = battens(R, i, s);
  g.shape(x0, y0, z0, x1, y1, z1, (x, y, z) => {
    const sx = x < x0 + 1 || x > x1 - 1, sy = y < y0 + 1 || y > y1 - 1, sz = z > z1 - 1, n = sx + sy + sz;
    if (n === 0) return panel;
    if (n >= 2) return frame;
    let u, v, U0, U1, V0, V1, face;
    if (sy) { u = x; v = z; U0 = x0; U1 = x1; V0 = z0; V1 = z1; face = 's'; }
    else if (sx) { u = y; v = z; U0 = y0; U1 = y1; V0 = z0; V1 = z1; face = 'e'; }
    else { u = x; v = y; U0 = x0; U1 = x1; V0 = y0; V1 = y1; face = 'u'; }
    if (Math.min(u - U0, U1 - u, v - V0, V1 - v) < 1 + bw) return frame;
    if (brace.includes(face)) {
      const W = U1 - U0 - 2 - 2 * bw, H = V1 - V0 - 2 - 2 * bw, a = (u - U0 - 1 - bw) / W, b = (v - V0 - 1 - bw) / H;
      if (Math.abs(a - b) * Math.min(W, H) < .8) return frame;
    }
    return false;
  });
  for (let x = x0; x < x1; x++) for (const y of [y0, y1 - 1]) if (hash(x, y * 7 + z1, s + 3) < .12) g.set(x, y, z1 - 1, null);
  for (let y = y0 + 1; y < y1 - 1; y++) for (const x of [x0, x1 - 1]) if (hash(x * 5, y + z1, s + 4) < .12) g.set(x, y, z1 - 1, null);
}
// 55-gallon drum along axis a from base centre b: light hoops over dark grooves, recessed lid, bungs.
function drum(g, b, a, o = {}) {
  const r = o.r ?? 3.4, h = o.h ?? 12, R = o.R || OL, i = (o.i ?? 2) + 1, s = o.s ?? 1, rust = o.rust ?? .18, pro = o.hoop ?? .9;
  const body = paint(R, i, s, rust), lite = paint(R, i + 1, s + 1, rust * .5, false), dark = paint(R, i - 1, s + 2, rust, false);
  const lid = paint(R, i - 1, s + 3, rust * .7, false), band = o.band ? flat(o.band) : null;
  const L = Math.hypot(...a), [ax, ay, az] = a.map(v => v / L), e = h + r + 2, hp = [h * .34, h * .66];
  g.shape(b[0] - e, b[1] - e, b[2] - e, b[0] + e, b[1] + e, b[2] + e, (x, y, z) => {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], t = dx * ax + dy * ay + dz * az;
    if (t < 0 || t > h) return false;
    const rad = Math.hypot(dx - ax * t, dy - ay * t, dz - az * t);
    const hoop = Math.min(...hp.map(p => Math.abs(t - p))) < .5, chime = t < 1 || t > h - 1;
    if (rad > (hoop || chime ? r + pro : r)) return false;
    if (t > h - 1 && rad < r - .7) return false;
    if (hoop || t > h - 1) return lite;
    if (chime || hp.some(p => t < p && p - t < 1.5)) return dark;
    if (t > h - 2 && rad < r - .7) return lid;
    if (band && Math.abs(t - h * .5) < 1) return band;
    return body;
  });
  let u = Math.abs(az) > .9 ? [.8, -.6, 0] : [-ay, ax, 0];
  const ul = Math.hypot(...u); u = u.map(v => v / ul);
  const v = [ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]];
  const c = [b[0] + ax * (h - .5), b[1] + ay * (h - .5), b[2] + az * (h - .5)];
  const p = (k, l) => [c[0] + u[0] * k + v[0] * l, c[1] + u[1] * k + v[1] * l, c[2] + u[2] * k + v[2] * l];
  const q = p(r * .5, r * .2), w = p(-r * .55, -r * .1);
  g.set(q[0], q[1], q[2], steelM); g.set(w[0], w[1], w[2], steelD);
}
// Jerrycan standing, wide face along x (or y): embossed X, weld seam, 3 handles, spout.
function jerry(g, x0, y0, z0, R = OL, i = 2, o = {}) {
  i++;
  const ay = !!o.alongY, W = ay ? 3 : 6, D = ay ? 6 : 3, H = 8;
  const m = mat((x, y, z, f) => {
    const wide = ay ? (f === 'e' || f === 'w') : (f === 's' || f === 'n');
    if (wide) {
      const u = (ay ? y - y0 : x - x0), v = z - z0;
      return cl(R, i + (u > 1 && u < 5 && v > 1 && v < 7 && Math.abs(Math.abs(u - 3) * 1.6 - Math.abs(v - 4)) < .8 ? 1 : 0));
    }
    if (f !== 'u' && Math.abs((ay ? x - x0 : y - y0) - 1.5) < .5) return cl(R, i - 1);
    return cl(R, i);
  });
  g.shape(x0, y0, z0, x0 + W, y0 + D, z0 + H, (x, y, z) => { const u = ay ? y - y0 : x - x0; return !((u < 1 || u > 5) && z > z0 + H - 1); }, m);
  const hm = flat(R[Math.max(0, i - 1)]);
  for (const k of [1.5, 2.5, 3.5]) ay ? g.set(x0 + 1.5, y0 + k, z0 + H, hm) : g.set(x0 + k, y0 + 1.5, z0 + H, hm);
  ay ? g.set(x0 + 1.5, y0 + 5.2, z0 + H - 1, steelD) : g.set(x0 + 5.2, y0 + 1.5, z0 + H - 1, steelD);
  ay ? g.set(x0 + 1.5, y0 + 5.2, z0 + H, steelM) : g.set(x0 + 5.2, y0 + 1.5, z0 + H, steelM);
}
// Plump sandbag (superellipsoid), long axis at angle th; darker tied ends and flanks.
function bag(g, cx, cy, cz, th, o = {}) {
  const L = (o.L ?? 7) / 2, W = (o.W ?? 4) / 2, H = (o.H ?? 2.8) / 2, s = o.s ?? 1, R = o.R || SN;
  const c = Math.cos(th), sn = Math.sin(th), hv = hash(ix(cx * 3), ix(cy * 3) + ix(cz) * 7, s), i0 = (o.i ?? 3) + (hv < .3 ? -1 : 0);
  const m = mat((x, y, z) => {
    const a = Math.abs((x - cx) * c + (y - cy) * sn), b = Math.abs(-(x - cx) * sn + (y - cy) * c), n = fbm(x * .5, y * .5 + z * .5, 77);
    return cl(R, i0 + (n > .72 ? 1 : n < .22 ? -1 : 0) + (a > L - .7 ? -2 : a > L - 1.6 ? -1 : 0) + (b > W - .6 ? -1 : 0));
  });
  g.shape(cx - L - 1, cy - L - 1, cz - H - 1, cx + L + 1, cy + L + 1, cz + H + 1, (x, y, z) => {
    const dx = x - cx, dy = y - cy, a = dx * c + dy * sn, b = -dx * sn + dy * c;
    return Math.abs(a / L) ** 2.6 + Math.abs(b / W) ** 2.6 + Math.abs((z - cz) / H) ** 2.2 <= 1;
  }, m);
}
// Sandbag wall along a polyline; courses stagger half a bag, rows(k) bags across.
function bagWall(g, pts, courses, o = {}) {
  const L = o.L ?? 7, H = o.H ?? 2.8, W = o.W ?? 4, rows = o.rows || (() => 1), s = o.s ?? 1;
  const seg = []; let tot = 0;
  for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push([tot, l, pts[k - 1], pts[k]]); tot += l; }
  const at = d => { for (const [t0, l, a, b] of seg) if (d <= t0 + l + 1e-6) { const t = (d - t0) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])]; } const [, , a, b] = seg[seg.length - 1]; return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  for (let k = 0; k < courses; k++) {
    const nr = rows(k), inset = k * (o.batter ?? .35), n = Math.max(1, Math.round((tot - inset * 2) / (L - .3))), st = (tot - inset * 2) / n;
    for (let j = 0; j < n + (k & 1); j++) {
      const [px, py, th] = at(Math.min(tot, inset + st * (j + (k & 1 ? 0 : .5))));
      for (let r = 0; r < nr; r++) {
        const off = (r - (nr - 1) / 2) * (W - .6), jx = (hash(j, k * 9 + r, s) - .5) * .6, jt = (hash(j, k * 9 + r, s + 1) - .5) * .22;
        bag(g, px - Math.sin(th) * off + jx, py + Math.cos(th) * off + jx * .5, H / 2 + k * (H - .55), th + jt, { ...o, s: s + j * 3 + k });
      }
    }
  }
}
// Ring of whitewashed edging stones (flagpole, signpost beds).
function stones(g, cx, cy, R, n, s = 1) {
  const white = mat((x, y, z) => cl(WH, 3 + (hash(ix(x), ix(y), s) < .3 ? -1 : 0))), grey = mat(() => CN[3]);
  for (let k = 0; k < n; k++) {
    const a = (k + (hash(k, 1, s) - .5) * .4) / n * Math.PI * 2 + s, sz = .9 + hash(k, 2, s) * .6;
    g.ell(cx + Math.cos(a) * R, cy + Math.sin(a) * R, .5, sz, sz * .9, .9 + sz * .3, hash(k, 3, s) < .25 ? grey : white);
  }
}

// ======================= Props =======================

def('prop_sandbags', 'World', [3, 1], 18, g => {
  bagWall(g, [[2, 9.5], [14, 7.5], [34, 7.5], [46, 9.5]], 5, { rows: k => k < 2 ? 2 : 1, s: 2 });
}, { margin: 4 });

def('prop_barrels', 'World', [1, 1], 16, g => {
  drum(g, [4.5, 4.5, 0], [0, 0, 1], { r: 3.2, h: 12, R: OL, i: 2, s: 1, rust: .15 });
  drum(g, [11.5, 5.5, 0], [0, 0, 1], { r: 3.2, h: 11, R: NV, i: 2, s: 2, rust: .25 });
  drum(g, [1.5, 12.5, 3.3], [1, .05, 0], { r: 3.2, h: 12, R: RD, i: 1, s: 3, band: WH[4] });
}, { margin: 4 });

def('prop_crates', 'World', [2, 1], 24, g => {
  crate(g, 1, 2, 0, 16, 14, 12, { s: 1 });
  crate(g, 17, 3, 0, 31, 14, 10, { R: OL, i: 4, s: 2, brace: '' });
  crate(g, 4, 4, 12, 14, 13, 20, { s: 3, brace: 's' });
  g.text('s', 5, 12, 8, 'QM', TP[1]); g.text('s', 21, 12, 7, 'US', CR[2]);
  g.bitmap('n', 12, 5, 18, ['  #  ', ' ### ', '# # #', '  #  ', '  #  '], { '#': TP[1] });
  g.line(18, 15, 0, 22, 16, 0, steelD); // dropped pry bar
}, { margin: 4 });

def('prop_jerrycans', 'World', [1, 1], 14, g => {
  jerry(g, 1, 2, 0, OL, 2); jerry(g, 8, 2, 0, OL, 3, {}); jerry(g, 1, 7, 0, RD, 1); jerry(g, 8, 7, 0, OL, 2);
  jerry(g, 12, 11, 0, OL, 2, { alongY: true });
  g.text('s', 3, 9, 6, 'W', WH[4]);
}, { margin: 4 });

def('prop_flagpole', 'World', [1, 1], 90, (g, ctx) => {
  g.box(3, 3, 0, 13, 13, 3, concrete(CN, 3)); g.box(5, 5, 3, 11, 11, 4, concrete(CN, 4));
  g.box(6, 12.5, 1, 10, 13, 2.5, flat(GD[2])); // brass plaque
  stones(g, 8, 8, 7.3, 14, 3);
  g.cylZ(8, 8, 1.2, 4, 83, flat(WH[3])); g.cylZ(8, 8, 1.5, 4, 6, flat(WH[2])); g.ell(8, 8, 84, 1.7, 1.7, 1.7, flat(GD[3]));
  g.line(9.5, 8.5, 12, 9.5, 8.5, 81, rope); g.box(9, 8, 12, 11, 9, 13, darkSteel);
  const [wx, wy] = ctx.wind, px = -wy, py = wx, f = ctx.frame;
  const olv = flat(OL[3]), crm = flat(CR[2]), gld = flat(GD[2]), red = flat(RD[2]);
  const L = 24, HH = 15;
  for (let t = 0; t < L; t += .5) for (let s = 0; s < HH; s++) {
    const ph = t / L, w = Math.sin(t * .42 - f * Math.PI / 3);
    const off = w * 1.8 * (ph + .15), sag = ph * ph * 2.5 + Math.cos(t * .42 - f * Math.PI / 3) * .5 * ph;
    const x = 8 + wx * (t + 1.5) + px * off, y = 8 + wy * (t + 1.5) + py * off, z = 81 - s - sag;
    const d = Math.hypot(t - 9, s - 7);
    const m = s <= 1 || s >= HH - 2 ? crm : t > L - 3 ? red : d <= 2.2 ? gld : d <= 4.6 ? crm : olv;
    g.set(x, y, z, m);
  }
}, { frames: 6, fps: 8, animated: true, margin: 30 });

def('prop_windsock', 'World', [1, 1], 56, (g, ctx) => {
  g.box(3, 3, 0, 13, 13, 2, concrete(CN, 3));
  stones(g, 8, 8, 7.3, 12, 5);
  g.cylZ(8, 8, 1.1, 2, 46, stripes(RD[2], WH[4], 3));
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) g.line(8 + dx, 8 + dy, 2, 8, 8, 16, darkSteel);
  const [wx, wy] = ctx.wind, px = -wy, py = wx, f = ctx.frame;
  const orange = flat(FI[2]), white = flat(WH[4]);
  g.box(7, 7, 45, 10, 10, 46, darkSteel); g.set(8, 8, 47, glow(RD[4])); // obstruction light
  for (let t = 0; t < 21; t += .4) {
    const r = 3.8 - t * .11, ph = t / 21;
    const wob = Math.sin(t * .35 - f * Math.PI / 3) * 1.6 * ph, droop = ph * ph * 3 + Math.cos(t * .35 - f * Math.PI / 3) * .5 * ph;
    const cx = 8 + wx * (2 + t) + px * wob, cy = 8 + wy * (2 + t) + py * wob, cz = 44 - droop;
    const m = Math.floor(t / 4.2) % 2 ? white : orange;
    for (let a = 0; a < Math.PI * 2; a += .2) for (const rr of [r, r - .8]) g.set(cx + px * Math.cos(a) * rr, cy + py * Math.cos(a) * rr, cz + Math.sin(a) * rr, m);
  }
  for (let a = 0; a < Math.PI * 2; a += .15) g.set(8 + wx * 2 + px * Math.cos(a) * 4.2, 8 + wy * 2 + py * Math.cos(a) * 4.2, 44 + Math.sin(a) * 4.2, darkSteel);
}, { frames: 6, fps: 8, animated: true, margin: 28 });

def('prop_searchlight', 'World', [1, 1], 30, g => {
  g.cylZ(8, 8, 5.5, 0, 2, darkSteel); g.cylZ(8, 8, 5.9, 0, 1, flat(ST[2]));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.set(8 + Math.cos(a) * 4.6, 8 + Math.sin(a) * 4.6, 2, steelM); } // bolts
  g.cylZ(8, 8, 2.2, 2, 9, olive(3, 2));
  for (const x of [2.5, 12.5]) g.box(x, 7, 8, x + 1.5, 9, 18, flat(OL[2]));
  g.box(2.5, 7, 8, 14, 9, 9, flat(OL[2]));
  for (const x of [2, 13.5]) g.cylX(8, 15, 1.4, x, x + .9, steelM); // trunnion knobs
  const el = 25 * Math.PI / 180, dy = Math.cos(el), dz = Math.sin(el), cz = 15;
  g.cyl(8, 8 - dy * 5, cz - dz * 5, 8, 8 + dy * 4, cz + dz * 4, 5, olive(5, 2));
  for (const s of [-3.5, -1.5]) g.cyl(8, 8 + dy * s, cz + dz * s, 8, 8 + dy * (s + .8), cz + dz * (s + .8), 5.5, flat(OL[1]));
  g.cyl(8, 8 - dy * 5.5, cz - dz * 5.5 + 3, 8, 8 - dy * 5.5, cz - dz * 5.5 + 6, 1.2, flat(ST[2])); // vent stack
  g.cyl(8, 8 + dy * 4, cz + dz * 4, 8, 8 + dy * 5, cz + dz * 5, 4.2, glow(CR[3]));
  g.cyl(8, 8 + dy * 4.6, cz + dz * 4.6, 8, 8 + dy * 5.2, cz + dz * 5.2, 1.6, glow(PAL.WHITE));
  // Power cable snaking off to the generator.
  for (let t = 0; t <= 1; t += .04) g.set(8 - t * 9 + Math.sin(t * 7) * 1.5, 4 - t * 4, 0, flat(TP[1]));
}, { margin: 6 });

def('prop_lamp_post', 'World', [1, 1], 62, g => {
  const paint0 = flat(PT[0]), paint1 = flat(PT[1]);
  g.box(5, 5, 0, 11, 11, 3, concrete(CN, 3)); g.cylZ(8, 8, 2.4, 3, 5, paint0); g.cylZ(8, 8, 2, 5, 9, paint0); g.cylZ(8, 8, 1.6, 9, 11, paint1);
  g.cylZ(8, 8, 1, 11, 54, paint0); g.ell(8, 8, 55, 1.6, 1.6, 1.6, paint0); g.set(8, 8, 57, flat(PT[1]));
  for (const z of [28, 44]) g.cylZ(8, 8, 1.5, z, z + 1, paint1); // collars
  for (const z of [16, 34]) g.box(6.5, 8, z, 9.5, 9, z + 1, darkSteel); // ladder rests
  g.line(8, 8, 52, 8, 13, 53, paint0); g.line(8, 9, 48, 8, 12, 52, paint0);
  for (let t = 0; t <= 1; t += .1) g.set(8, 9.5 + t * 2, 49 + Math.sin(t * Math.PI) * 2, paint1); // scroll bracket
  g.cone(8, 13.5, 4, 1.2, 47, 52, flat(PT[1])); g.cylZ(8, 13.5, 4, 47, 48, flat(PT[0]));
  g.cylZ(8, 13.5, 1.3, 45, 47, glow(GD[3]));
  g.box(7, 9, 20, 9, 10, 26, flat(WH[4])); g.box(7, 10, 22, 9, 10.5, 24, redPaint);
}, { margin: 6 });

def('prop_signpost', 'World', [1, 1], 48, g => {
  stones(g, 8, 8, 4.8, 7, 7);
  g.box(7, 7, 0, 9, 9, 44, woodPost); g.pyramid(6.5, 6.5, 9.5, 9.5, 44, 2, woodDark);
  const board = flat(CR[2]), edge = flat(WD[1]), nail = steelD;
  // East arrow: RUNWAY.
  g.shape(9, 8, 35, 27, 9, 42, (x, y, z) => x < 23 || Math.abs(z - 38.5) < (27 - x) * .9, board);
  g.text('s', 10, 8, 40, 'RWY', TP[1]); g.text('n', 24, 8, 40, 'RWY', TP[1]);
  // West arrow: HQ.
  g.shape(-11, 7, 27, 7, 8, 34, (x, y, z) => x > -7 || Math.abs(z - 30.5) < (x + 11) * .9, board);
  g.text('s', -4, 7, 32, 'HQ', TP[1]); g.text('n', 2, 7, 32, 'HQ', TP[1]);
  // South arrow: MESS (towards the viewer of the facing).
  g.shape(8, 9, 19, 9, 27, 26, (x, y, z) => y < 23 || Math.abs(z - 22.5) < (27 - y) * .9, flat(GD[3]));
  g.text('e', 8, 24, 24, 'MESS', TP[1]); g.text('w', 8, 10, 24, 'MESS', TP[1]);
  for (const [a, b] of [[9, 35], [-11, 27]]) g.box(a, 7, b - 1, a + 18, 9, b, edge);
  for (const [x, y, z] of [[9, 9, 38], [6, 8, 30], [8, 10, 22]]) g.set(x, y, z, nail);
}, { margin: 14 });

def('prop_bench', 'World', [2, 1], 18, g => {
  const slat = battens(WD, 3, 5), iron = flat(TP[1]);
  for (const y of [5, 7.5, 10]) g.box(2, y, 7, 30, y + 1.5, 8, slat);
  for (const z of [10, 13]) g.box(2, 3.5, z, 30, 4.5, z + 2, slat);
  g.erase(2, 3.5, 14, 3, 4.5, 15); g.erase(29, 3.5, 14, 30, 4.5, 15); // rounded backrest corners
  for (const x of [4, 27]) {
    g.line(x, 11, 0, x, 6, 7, iron); g.line(x, 4, 0, x, 4, 15, iron); g.line(x, 4, 7, x, 11, 7, iron); g.line(x, 4, 9, x, 10, 9, iron);
    for (let t = 0; t <= 1; t += .1) g.set(x, 4.5 + t * 6, 10 + Math.sin(t * Math.PI) * 1.5 - t * 1.5, iron); // armrest curl
  }
  // A helmet left on the seat.
  g.shape(19, 6, 8, 25, 11, 12, (x, y, z) => ((x - 22) / 2.8) ** 2 + ((y - 8.5) / 2.5) ** 2 + ((z - 8) / 2.6) ** 2 <= 1, olive(7, 2));
  g.cylZ(22, 8.5, 3.2, 8, 9, flat(OL[1]));
}, { margin: 4 });

def('prop_barbed_wire', 'World', [2, 1], 20, g => {
  for (const x of [3, 29]) { g.line(x, 2, 0, x, 14, 14, woodPost, .7); g.line(x, 14, 0, x, 2, 14, woodPost, .7); }
  g.line(3, 8, 7, 29, 8, 7, woodDark);
  const wire = mat((x, y, z) => hash(ix(x), ix(y) + ix(z) * 7, 3) < .3 ? RU[3] : ST[3]), barb = flat(ST[1]);
  for (let x = 1; x < 31; x += .12) { const a = x * 1.15; g.set(x, 8 + Math.cos(a) * 5.6, 7 + Math.sin(a) * 5.6, wire); }
  for (let x = 1; x < 31; x += 2.3) { const a = x * 1.15; g.set(x, 8 + Math.cos(a) * 6.6, 7 + Math.sin(a) * 6.6, barb); }
  for (const [y, z] of [[2, 1], [14, 1], [8, 14]]) g.line(0, y, z, 32, y, z, wire);
  // Tin-can alarm hanging from the top strand.
  for (const x of [11, 21]) { g.set(x, 8, 13, barb); g.cylZ(x + .5, 8.5, 1, 10, 12.5, flat(ST[3])); g.decal('s', x, 9, 11, RD[2]); }
}, { margin: 4 });

def('prop_gate_barrier', 'World', [3, 1], 64, g => {
  g.box(1, 4, 0, 8, 12, 2, concrete(CN, 3));
  g.box(2, 5, 2, 7, 11, 16, stripes(RD[2], WH[4], 4));
  g.box(1.5, 4.5, 16, 7.5, 11.5, 18, flat(TP[1]));
  const a = 78 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const arm = mat((x, y, z) => (ix((z - 14) / 5) & 1) ? RD[2] : WH[4]);
  g.cyl(6 - ca * 5, 8, 15 - sa * 5, 6 + ca * 44, 8, 15 + sa * 44, 1.4, arm);
  g.box(4 - ca * 8 - 2, 6, 15 - sa * 8 - 2, 4 - ca * 8 + 3, 10, 15 - sa * 8 + 3, flat(ST[2]));
  g.cylY(6, 15, 1.6, 4, 12, darkSteel);
  g.set(6 + ca * 44, 8, 15 + sa * 44 + 1, glow(RD[4]));
  // Sandbags banked against the post.
  bag(g, 4.5, 14.5, 1.4, 0, { s: 4 }); bag(g, 11, 13.5, 1.4, .3, { s: 5 }); bag(g, 7.5, 14, 3.8, .1, { s: 6 }); bag(g, 10.5, 9, 1.4, 1.4, { s: 7 });
  // Rest fork on the far side.
  g.box(42, 7, 0, 45, 10, 12, stripes(RD[2], WH[4], 4)); g.box(41, 7, 12, 46, 10, 13, darkSteel); g.box(41, 7, 13, 42, 10, 15, darkSteel); g.box(45, 7, 13, 46, 10, 15, darkSteel);
  g.box(39, 10, 3, 48, 11, 12, flat(WH[4]));
  g.bitmap('s', 40, 10, 11, ['  rrr  ', ' rrrrr ', 'rrrrrrr', 'rwwwwwr', 'rrrrrrr', ' rrrrr ', '  rrr  '], { r: RD[2], w: WH[4] });
}, { margin: 6 });

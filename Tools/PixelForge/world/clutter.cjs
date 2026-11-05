'use strict';
// World models: small logistics props — crates, oil drums, jerrycans, pallets, tarps, bombs,
// ammo, tyres, sandbag works, fences, warning signs, mail and air-drop cargo (prop_*).
// Rounded, worn and slightly uneven (bags are ellipsoids, drums have rolling hoops, crates
// have recessed panels and braces) so they read warm and soft next to the characters.
const { PAL, ramp, hash, fbm } = require('../lib.cjs');
const { mat } = require('../voxel.cjs');
const { OL, CR, GD, ST, RD, WD, SN } = PAL;
const { WH, TP, RB, CV, cl, uv, ix, flat, def, rope, woodPost } = require('./common.cjs');

const RU = ramp('#2b170d', '#4c2814', '#6e3c1c', '#925426', '#b47137');   // rust
const BU = ramp('#18263a', '#233a56', '#335275', '#4a6f94', '#6d91b3');   // blue drum paint
const OIL = ramp('#0d0e10', '#17191c', '#24282c', '#3a4247', '#5d6b70'); // oil puddle sheen
const steelM = flat(ST[3]), steelD = flat(ST[2]);

// ---------------- Materials ----------------
// Weathered paint: rust patches, vertical streaks, a few bright chips.
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
// Board planks for crate panels: boards 3 voxels high (sides) / wide (top), seams darker.
function boards(R, i, s, z0, y0) {
  return mat((x, y, z, f) => {
    const [u] = uv(x, y, z, f), v = f === 'u' ? y - y0 : z - z0, b = ix(v / 3);
    if ((((ix(v) % 3) + 3) % 3) === 0 && v >= 1) return cl(R, i - 1);
    const h = hash(b, ix(u / 5), s);
    return cl(R, i + (hash(b, 3, s) < .3 ? -1 : 0) + (h < .06 ? -1 : h > .95 ? 1 : 0));
  });
}
const battens = (R, i, s) => mat((x, y, z, f) => cl(R, i + (hash(ix(x) * 3 + ix(y), ix(z), s) < .1 ? -1 : 0)));
const straw = mat((x, y, z) => { const h = hash(ix(x), ix(y) * 17 + ix(z), 4); return h < .3 ? GD[3] : h < .6 ? GD[2] : h < .85 ? SN[3] : GD[1]; });

// ---------------- Helpers ----------------
// Wooden crate: corner battens + border frame proud of recessed plank panels, optional
// diagonal braces on 'sn' / 'ew' faces, worn top edges. hollow = open box (no lid).
function crate(g, x0, y0, z0, x1, y1, z1, o = {}) {
  const R = o.R || WD, i = o.i ?? 4, s = o.s ?? 1, brace = o.brace ?? 'ew', top = !o.hollow, bw = o.bw ?? 1;
  const panel = boards(R, i - 1, s, z0, y0), frame = battens(R, i, s);
  g.shape(x0, y0, z0, x1, y1, z1, (x, y, z) => {
    const sx = x < x0 + 1 || x > x1 - 1, sy = y < y0 + 1 || y > y1 - 1, sz = top && z > z1 - 1;
    const n = sx + sy + sz;
    if (n === 0) return o.hollow && z > z0 + 1 && x > x0 + 2 && x < x1 - 2 && y > y0 + 2 && y < y1 - 2 ? false : panel;
    if (n >= 2) return frame;
    let u, v, U0, U1, V0, V1, face;
    if (sy) { u = x; v = z; U0 = x0; U1 = x1; V0 = z0; V1 = z1; face = 'sn'; }
    else if (sx) { u = y; v = z; U0 = y0; U1 = y1; V0 = z0; V1 = z1; face = 'ew'; }
    else { u = x; v = y; U0 = x0; U1 = x1; V0 = y0; V1 = y1; face = 'u'; }
    if (Math.min(u - U0, U1 - u, v - V0, V1 - v) < 1 + bw) return frame;
    if (o.hollow) return panel;
    if (brace.includes(face[0]) && face !== 'u') {
      const W = U1 - U0 - 2 - 2 * bw, H = V1 - V0 - 2 - 2 * bw, a = (u - U0 - 1 - bw) / W, b = (v - V0 - 1 - bw) / H;
      if (Math.abs(a - b) * Math.min(W, H) < .8) return frame;
    }
    return false;
  });
  // Chipped top edges.
  if (top) for (let x = x0; x < x1; x++) for (const y of [y0, y1 - 1]) if (hash(x, y * 7 + z1, s + 3) < (o.wear ?? .12)) g.set(x, y, z1 - 1, null);
  if (top) for (let y = y0 + 1; y < y1 - 1; y++) for (const x of [x0, x1 - 1]) if (hash(x * 5, y + z1, s + 4) < (o.wear ?? .12)) g.set(x, y, z1 - 1, null);
}
// Stencil centred on a crate panel. face s/n/e/w/u; c = centre along the face, zTop = first row.
function stencil(g, face, x0, y0, x1, y1, z1, c, zTop, str, col) {
  const w = str.length * 4 - 1;
  if (face === 's') g.text('s', Math.round(c - w / 2), y1 - 2, zTop, str, col);
  else if (face === 'n') g.text('n', Math.round(c + w / 2 - 1), y0 + 1, zTop, str, col);
  else if (face === 'e') g.text('e', x1 - 2, Math.round(c + w / 2 - 1), zTop, str, col);
  else if (face === 'w') g.text('w', x0 + 1, Math.round(c - w / 2), zTop, str, col);
}
const ARROW = ['  #  ', ' ### ', '# # #', '  #  ', '  #  '];

// 55-gallon drum along an arbitrary axis: base centre b, axis a, radius r, length h.
// Two rolling hoops, rolled chimes, recessed lid with two bung caps.
function drum(g, b, a, o = {}) {
  const r = o.r ?? 3.4, h = o.h ?? 12, R = o.R || OL, i = (o.i ?? 2) + 1, s = o.s ?? 1, rust = o.rust ?? .18, pro = o.hoop ?? .9;
  // Light hoops/top chime over dark grooves so the rings read at 1 px; lid sits darker.
  const body = paint(R, i, s, rust), lite = paint(R, i + 1, s + 1, rust * .5, false), dark = paint(R, i - 1, s + 2, rust, false);
  const lid = paint(R, i - 1, s + 3, rust * .7, false), band = o.band ? flat(o.band) : null;
  const L = Math.hypot(...a), [ax, ay, az] = a.map(v => v / L), e = h + r + 2, hp = [h * .34, h * .66];
  g.shape(b[0] - e, b[1] - e, b[2] - e, b[0] + e, b[1] + e, b[2] + e, (x, y, z) => {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], t = dx * ax + dy * ay + dz * az;
    if (t < 0 || t > h) return false;
    const rad = Math.hypot(dx - ax * t, dy - ay * t, dz - az * t);
    const hd = Math.min(...hp.map(p => Math.abs(t - p))), hoop = hd < .5, chime = t < 1 || t > h - 1;
    if (rad > (hoop || chime ? r + pro : r)) return false;
    if (t > h - 1 && rad < r - .7) return false;
    if (hoop || t > h - 1) return lite;
    if (chime || hp.some(p => t < p && p - t < 1.5)) return dark;
    if (t > h - 2 && rad < r - .7) return lid;
    if (band && Math.abs(t - h * .5) < 1) return band;
    return body;
  });
  // Bung caps on the lid (big filler + small vent).
  let u = Math.abs(az) > .9 ? [.8, -.6, 0] : [-ay, ax, 0];
  const ul = Math.hypot(...u); u = u.map(v => v / ul);
  const v = [ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]];
  const c = [b[0] + ax * (h - .5), b[1] + ay * (h - .5), b[2] + az * (h - .5)];
  const p = (k, l) => [c[0] + u[0] * k + v[0] * l, c[1] + u[1] * k + v[1] * l, c[2] + u[2] * k + v[2] * l];
  const q = p(r * .5, r * .2); g.set(q[0], q[1], q[2], o.open ? flat(TP[0]) : steelM);
  if (r > 3.8 && !o.open) { const q2 = p(r * .5 + .9, r * .2); g.set(q2[0], q2[1], q2[2], steelM); }
  const w = p(-r * .55, -r * .1); g.set(w[0], w[1], w[2], steelD);
  return c;
}
// Standing drum shortcut.
const drumZ = (g, cx, cy, z0, o) => drum(g, [cx, cy, z0], [0, 0, 1], o);

// Jerrycan standing; wide face along x (or y with alongY). Embossed X, weld seam, 3 handles, spout.
function jerry(g, x0, y0, z0, R = OL, i = 2, o = {}) { i++;
  const ay = !!o.alongY, W = ay ? 3 : 6, D = ay ? 6 : 3, H = 8;
  const m = mat((x, y, z, f) => {
    const wide = ay ? (f === 'e' || f === 'w') : (f === 's' || f === 'n');
    if (wide) {
      const u = (ay ? y - y0 : x - x0), v = z - z0;
      if (u > 1 && u < 5 && v > 1 && v < 7 && Math.abs(Math.abs(u - 3) * 1.6 - Math.abs(v - 4)) < .8) return cl(R, i + 1);
      return cl(R, i);
    }
    if (f !== 'u' && Math.abs((ay ? x - x0 : y - y0) - 1.5) < .5) return cl(R, i - 1);
    return cl(R, i);
  });
  g.shape(x0, y0, z0, x0 + W, y0 + D, z0 + H, (x, y, z) => {
    const u = ay ? y - y0 : x - x0;
    return !((u < 1 || u > 5) && z > z0 + H - 1);
  }, m);
  const hm = flat(R[Math.max(0, i - 1)]);
  for (const k of [1.5, 2.5, 3.5]) ay ? g.set(x0 + 1.5, y0 + k, z0 + H, hm) : g.set(x0 + k, y0 + 1.5, z0 + H, hm);
  ay ? g.set(x0 + 1.5, y0 + 5.2, z0 + H - 1, steelD) : g.set(x0 + 5.2, y0 + 1.5, z0 + H - 1, steelD);
  ay ? g.set(x0 + 1.5, y0 + 5.2, z0 + H, steelM) : g.set(x0 + 5.2, y0 + 1.5, z0 + H, steelM);
}

// Wooden pallet w x d (w = 3k + 2): three runners along x with fork notches, deck boards along y.
function pallet(g, x0, y0, z0, w = 14, d = 12, s = 1) {
  const run = battens(WD, 2, s), deck = mat((x, y, z) => cl(WD, 3 + (hash(ix(x / 3), 1, s) < .35 ? -1 : 0) + (hash(ix(x), ix(y), s) < .06 ? 1 : 0)));
  for (const yy of [y0, y0 + Math.floor(d / 2) - 1, y0 + d - 2]) {
    g.box(x0, yy, z0, x0 + w, yy + 2, z0 + 2, run);
    g.erase(x0 + 3, yy, z0, x0 + 5, yy + 2, z0 + 1); g.erase(x0 + w - 5, yy, z0, x0 + w - 3, yy + 2, z0 + 1);
  }
  for (let x = x0; x <= x0 + w - 2; x += 3) g.box(x, y0, z0 + 2, x + 2, y0 + d, z0 + 3, deck);
}

// Plump sandbag (superellipsoid) centred at c, long axis at angle th in the xy plane.
function bag(g, cx, cy, cz, th, o = {}) {
  const L = (o.L ?? 7) / 2, W = (o.W ?? 4) / 2, H = (o.H ?? 2.8) / 2, s = o.s ?? 1, R = o.R || SN;
  const c = Math.cos(th), sn = Math.sin(th), hv = hash(ix(cx * 3), ix(cy * 3) + ix(cz) * 7, s);
  const i0 = (o.i ?? 3) + (hv < .3 ? -1 : 0);
  const m = mat((x, y, z) => {
    const a = Math.abs((x - cx) * c + (y - cy) * sn), b = Math.abs(-(x - cx) * sn + (y - cy) * c), n = fbm(x * .5, y * .5 + z * .5, 77);
    // Darker tied ends and flanks so neighbouring bags separate.
    return cl(R, i0 + (n > .72 ? 1 : n < .22 ? -1 : 0) + (a > L - .7 ? -2 : a > L - 1.6 ? -1 : 0) + (b > W - .6 ? -1 : 0));
  });
  const e = L + 1;
  g.shape(cx - e, cy - e, cz - H - 1, cx + e, cy + e, cz + H + 1, (x, y, z) => {
    const dx = x - cx, dy = y - cy, a = dx * c + dy * sn, b = -dx * sn + dy * c;
    return Math.abs(a / L) ** 2.6 + Math.abs(b / W) ** 2.6 + Math.abs((z - cz) / H) ** 2.2 <= 1;
  }, m);
}
// Sandbag wall along a polyline: courses stagger by half a bag; rows = bags across per course.
function bagWall(g, pts, courses, o = {}) {
  const L = o.L ?? 7, H = o.H ?? 2.8, W = o.W ?? 4, rows = o.rows || (() => 1), s = o.s ?? 1;
  const seg = []; let tot = 0;
  for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push([tot, l, pts[k - 1], pts[k]]); tot += l; }
  const at = d => { for (const [t0, l, a, b] of seg) if (d <= t0 + l + 1e-6) { const t = (d - t0) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])]; } const [, , a, b] = seg[seg.length - 1]; return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  for (let k = 0; k < courses; k++) {
    const nr = rows(k), step = L - .3, inset = k * (o.batter ?? .35);
    const n = Math.max(1, Math.round((tot - inset * 2) / step)), st = (tot - inset * 2) / n;
    // Even courses: n bags centred in their slots; odd courses: n + 1 bags on the joints.
    for (let j = 0; j < n + (k & 1); j++) {
      const d = inset + st * (j + (k & 1 ? 0 : .5));
      const [px, py, th] = at(Math.min(tot, d));
      for (let r = 0; r < nr; r++) {
        const off = (r - (nr - 1) / 2) * (W - .6), jx = (hash(j, k * 9 + r, s) - .5) * .6, jt = (hash(j, k * 9 + r, s + 1) - .5) * .22;
        bag(g, px - Math.sin(th) * off + jx, py + Math.cos(th) * off + jx * .5, H / 2 + k * (H - .55), th + jt, { ...o, s: s + j * 3 + k });
      }
    }
  }
}

// Tyre along axis a with base centre b: rounded tube cross-section, tread on the outer face.
function tire(g, b, a, o = {}) {
  const R = o.R ?? 5, ri = o.ri ?? 2.2, h = o.h ?? 3, Rc = (R + ri) / 2, w = (R - ri) / 2, hz = h / 2;
  const L = Math.hypot(...a), [ax, ay, az] = a.map(v => v / L), e = R + h + 1;
  const m = mat((x, y, z) => {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], t = dx * ax + dy * ay + dz * az;
    const px = dx - ax * t, py = dy - ay * t, pz = dz - az * t, rad = Math.hypot(px, py, pz);
    if (rad > R - .9) return ix((Math.atan2(py, px + pz) + 4) * R / 1.4) & 1 ? TP[2] : TP[3];
    return rad < ri + .8 ? TP[1] : TP[3];
  });
  g.shape(b[0] - e, b[1] - e, b[2] - e, b[0] + e, b[1] + e, b[2] + e, (x, y, z) => {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], t = dx * ax + dy * ay + dz * az;
    const rad = Math.hypot(dx - ax * t, dy - ay * t, dz - az * t);
    return Math.abs((rad - Rc) / w) ** 2.4 + Math.abs((t - hz) / hz) ** 2.4 <= 1;
  }, m);
  if (o.hub) g.shape(b[0] - e, b[1] - e, b[2] - e, b[0] + e, b[1] + e, b[2] + e, (x, y, z) => {
    const dx = x - b[0], dy = y - b[1], dz = z - b[2], t = dx * ax + dy * ay + dz * az;
    const rad = Math.hypot(dx - ax * t, dy - ay * t, dz - az * t);
    return t > .5 && t < h - .5 && rad < ri + .6 ? (rad < 1 ? steelD : o.hub) : false;
  });
}

// GP bomb along x: tail at xs, nose toward +x (dir 1) or -x (dir -1). Olive with yellow bands,
// box tail fins, suspension lugs and a nose fuze.
function bomb(g, xs, cy, cz, Lb, r, dir = 1, s = 1) {
  const body = paint(OL, 2, s, .04, false), bandM = flat(GD[2]), fin = paint(OL, 2, s + 2, 0, false);
  const x0 = dir > 0 ? xs - 3 : xs - Lb - 1, x1 = dir > 0 ? xs + Lb + 1 : xs + 3;
  g.shape(x0, cy - r - 3, cz - r - 3, x1, cy + r + 3, cz + r + 3, (x, y, z) => {
    const t = (x - xs) * dir / Lb, dy = y - cy, dz = z - cz, rad = Math.hypot(dy, dz);
    if (t >= 0 && t <= 1) {
      const rr = t < .22 ? r * (.45 + .55 * Math.sqrt(t / .22)) : t > .7 ? r * Math.sqrt(Math.max(0, 1 - ((t - .7) / .3) ** 2)) : r;
      if (rad <= Math.max(rr, t > .97 ? .8 : 0)) return t > .97 ? steelM : (Math.abs(t - .78) < .035 || Math.abs(t - .26) < .035) ? bandM : body;
    }
    // Tail fins (+ shape) and the square box fin around them.
    if (t > -.1 && t < .2 && ((Math.abs(dy) < .6 || Math.abs(dz) < .6) && rad < r + 2.2)) return fin;
    if (t > -.1 && t < .06 && Math.max(Math.abs(dy), Math.abs(dz)) > r + 1.3 && Math.max(Math.abs(dy), Math.abs(dz)) < r + 2.2) return fin;
    return false;
  });
  for (const t of [.38, .6]) g.set(xs + dir * Lb * t, cy, cz + r + .3, steelD);
}

// Draped tarpaulin over a height field: items(x,y) -> height, blurred so it sags to the ground.
function tarp(g, x0, y0, x1, y1, items, m, ropes = []) {
  const W = x1 - x0, D = y1 - y0, hf = new Float32Array(W * D), out = new Float32Array(W * D);
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) hf[y * W + x] = items(x0 + x + .5, y0 + y + .5);
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    let sum = 0, n = 0;
    for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) { const xx = x + k, yy = y + j; n++; if (xx >= 0 && yy >= 0 && xx < W && yy < D) sum += hf[yy * W + xx]; }
    out[y * W + x] = Math.max(hf[y * W + x] > 0 ? hf[y * W + x] - .3 : 0, sum / n) + (hf[y * W + x] > 0 ? 1 : 0);
  }
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) { const h = out[y * W + x]; if (h >= .6) g.box(x0 + x, y0 + y, 0, x0 + x + 1, y0 + y + 1, Math.round(h), m); }
  // Ropes over the top (lines of constant x or y) ending at ground pegs.
  for (const [ax, v] of ropes) {
    const n = ax === 'x' ? D : W;
    for (let k = 0; k < n; k++) { const x = ax === 'x' ? v : x0 + k, y = ax === 'x' ? y0 + k : v, z = g.top(x, y); if (z >= 0) g.set(x, y, z, rope); }
    if (ax === 'x') { g.box(v, y0 - 1, 0, v + 1, y0, 2, flat(WD[1])); g.box(v, y1, 0, v + 1, y1 + 1, 2, flat(WD[1])); }
    else { g.box(x0 - 1, v, 0, x0, v + 1, 2, flat(WD[1])); g.box(x1, v, 0, x1 + 1, v + 1, 2, flat(WD[1])); }
  }
}
const boxH = (x0, y0, x1, y1, h) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1 ? h : 0;
const discH = (cx, cy, r, h) => (x, y) => Math.hypot(x - cx, y - cy) <= r ? h : 0;
const unionH = (...fs) => (x, y) => Math.max(...fs.map(f => f(x, y)));
const foldCanvas = (R, i, s) => mat((x, y, z, f) => { const n = fbm(x * .22 + s, y * .22, 21 + s), fold = Math.sin(x * .9 + y * .45 + n * 4); return cl(R, i + (fold > .75 ? 1 : fold < -.8 ? -1 : 0) + (n < .3 ? -1 : 0)); });

// Ammo can (.50 cal M2): 6 long (x) x 3 wide x 4 high, lid lip, latch, folding handle.
function ammoCan(g, x0, y0, z0, i = 2, s = 1) {
  const m = paint(OL, i, s, .05, false);
  g.box(x0, y0, z0, x0 + 6, y0 + 3, z0 + 4, m);
  g.box(x0 - .01, y0, z0 + 3, x0 + 6, y0 + 3, z0 + 4, flat(OL[i + 1]));
  g.set(x0 + 6, y0 + 1, z0 + 2, steelD); g.set(x0 + 6, y0 + 1, z0 + 3, steelM);
  g.set(x0 + 2, y0 + 1, z0 + 4, flat(OL[i - 1])); g.set(x0 + 3, y0 + 1, z0 + 4, flat(OL[i - 1]));
  g.decal('s', x0 + 1, y0 + 2, z0 + 1, GD[2]); g.decal('s', x0 + 2, y0 + 2, z0 + 1, GD[2]);
}

// Canvas sack standing (mail bag): fat bottom, cinched neck, tuft.
function sack(g, cx, cy, z0, h, rad, m, s = 1) {
  g.shape(cx - rad - 1, cy - rad - 1, z0, cx + rad + 1, cy + rad + 1, z0 + h + 2, (x, y, z) => {
    const t = (z - z0) / h, rr = t < .75 ? rad * (.82 + .18 * Math.sin(t / .75 * Math.PI)) : t < .87 ? rad * .42 : t < 1.05 ? rad * .62 : 0;
    return Math.hypot(x - cx, y - cy) <= rr;
  }, m);
  g.cylZ(cx, cy, rad * .42, z0 + h * .8, z0 + h * .8 + 1, rope);
}

// Sign board between posts, double-sided; lines = [[text, colour], ...] drawn top down.
function signBoard(g, x0, x1, y, z0, z1, bg, border, lines) {
  g.box(x0, y, z0, x1, y + 1, z1, flat(bg));
  g.shape(x0, y, z0, x1, y + 1, z1, (x, yy, z) => x < x0 + 1 || x > x1 - 1 || z < z0 + 1 || z > z1 - 1, flat(border));
  const c = (x0 + x1) / 2;
  let zt = z1 - 2;
  for (const [str, col, gap] of lines) {
    const w = str.length * 4 - 1;
    g.text('s', Math.round(c - w / 2), y, zt, str, col); g.text('n', Math.round(c + w / 2 - 1), y, zt, str, col);
    zt -= 6 + (gap || 0);
  }
}

// ======================= Crates =======================
def('prop_crate_small', 'World', [1, 1], 14, g => {
  crate(g, 2, 3, 0, 14, 13, 10, { s: 2 });
  stencil(g, 's', 2, 3, 14, 13, 10, 8, 7, 'QM', TP[1]);
  g.bitmap('n', 10, 4, 7, ARROW, { '#': TP[1] });
}, { margin: 4 });

def('prop_crate_large', 'World', [2, 1], 20, g => {
  crate(g, 2, 1, 0, 30, 15, 16, { s: 5, brace: 'ew' });
  stencil(g, 's', 2, 1, 30, 15, 16, 16, 12, 'U.S.', TP[1]); stencil(g, 's', 2, 1, 30, 15, 16, 16, 6, 'A-12', TP[1]);
  stencil(g, 'n', 2, 1, 30, 15, 16, 16, 12, 'UP', TP[1]); g.bitmap('n', 12, 2, 6, ARROW, { '#': TP[1] }); g.bitmap('n', 24, 2, 6, ARROW, { '#': TP[1] });
  g.text('u', 5, 4, 14, 'U.S.', TP[1]);
  // Crowbar left on the lid.
  g.line(17, 13, 16, 27, 11, 16, steelD); g.set(27, 10, 16, steelD);
}, { margin: 4 });

def('prop_crate_open', 'World', [1, 1], 14, g => {
  crate(g, 2, 3, 0, 13, 13, 9, { hollow: true, s: 7 });
  g.shape(3, 4, 2, 12, 12, 10, (x, y, z) => z < 7.5 + fbm(x * .6, y * .6, 3) * 2.2, straw);
  for (const [x, y] of [[5.5, 6.5], [8.5, 9.5], [9.5, 6.5]]) { g.cylZ(x, y, 1, 6, 10, flat(GD[2])); g.set(x, y, 10, flat(GD[1])); }
  for (const [x, y, z] of [[1, 8, 0], [2, 13, 0], [12, 2, 8], [13, 9, 9], [6, 13, 0]]) g.set(x, y, z, straw);
  // Lid leaning on the east side.
  g.shape(13, 4, 0, 18, 13, 10, (x, y, z) => { const p = 13 + (10 - z) * .4; return x >= p && x < p + 1 ? (Math.abs(y - 8.5) < .5 || z < 1.5 || z > 8 ? battens(WD, 2, 7) : boards(WD, 3, 8, 0, 0)) : false; });
}, { margin: 5 });

def('prop_crate_stack', 'World', [2, 1], 30, g => {
  crate(g, 1, 2, 0, 14, 14, 11, { s: 11 });
  crate(g, 14, 3, 0, 30, 14, 12, { R: OL, i: 4, s: 12, brace: 'sn' });
  crate(g, 3, 3, 11, 13, 13, 19, { s: 13 });
  crate(g, 17, 4, 12, 28, 13, 20, { R: OL, i: 4, s: 14, brace: '' });
  crate(g, 6, 5, 19, 13, 11, 24, { s: 15, brace: '' });
  stencil(g, 's', 1, 2, 14, 14, 11, 7.5, 7, 'QM', TP[1]);
  stencil(g, 's', 17, 4, 28, 13, 20, 22.5, 16, 'US', CR[2]);
  stencil(g, 'e', 14, 3, 30, 14, 12, 8.5, 8, '30', CR[2]);
  g.bitmap('s', 6, 11, 16, ARROW, { '#': TP[1] });
}, { margin: 4 });

def('prop_crate_rifle', 'World', [2, 1], 22, g => {
  crate(g, 1, 4, 0, 31, 13, 9, { R: WD, i: 3, s: 21, brace: '' });
  crate(g, 3, 5, 9, 30, 12, 18, { R: OL, i: 4, s: 22, brace: '' });
  stencil(g, 's', 1, 4, 31, 13, 9, 16, 6, 'RIFLES', CR[2]);
  stencil(g, 's', 3, 5, 30, 12, 18, 16.5, 15, 'M1', CR[2]);
  // Rope handles.
  for (const [x, z] of [[0, 5], [31, 5], [2, 13], [30, 13]]) { g.set(x, 7, z, rope); g.set(x, 10, z, rope); g.box(x, 7, z - 1, x + 1, 11, z, rope); }
}, { margin: 4 });

// ======================= Ammo =======================
def('prop_ammo_cans', 'World', [1, 1], 16, g => {
  let s = 1;
  for (const [x, y, z] of [[1, 2, 0], [1, 6, 0], [1, 10, 0], [8, 3, 0], [8, 7, 0], [8, 11, 0], [2, 4, 4], [2, 8, 4], [8, 6, 4], [5, 6, 8]]) ammoCan(g, x, y, z, (s++ % 3) ? 2 : 3, s);
}, { margin: 4 });

def('prop_ammo_crate', 'World', [1, 1], 14, g => {
  crate(g, 0, 4, 0, 16, 12, 9, { R: OL, i: 4, s: 31, brace: '' });
  stencil(g, 's', 0, 4, 16, 12, 9, 8, 6, '.50', CR[2]);
  for (const x of [-1, 16]) { g.box(x, 6, 5, x + 1, 10, 6, rope); g.set(x, 6, 6, rope); g.set(x, 9, 6, rope); }
  // Loose belt of rounds on the lid.
  for (let k = 0; k < 9; k++) { g.set(3 + k, 7, 9, flat(k & 1 ? GD[2] : GD[3])); g.set(3 + k, 8, 9, flat(ST[1])); }
}, { margin: 4 });

// ======================= Drums =======================
def('prop_drum_olive', 'World', [1, 1], 18, g => { drumZ(g, 8.5, 8.5, 0, { r: 4.3, h: 14, R: OL, i: 2, s: 41, band: GD[2] }); }, { margin: 4 });
def('prop_drum_red', 'World', [1, 1], 18, g => {
  g.shape(4, 8, 0, 16, 16, 1, (x, y) => fbm(x * .4, y * .4, 9) > .45 && Math.hypot(x - 10, y - 11) < 5.5, mat(() => OIL[1]));
  drumZ(g, 8.5, 8.5, 0, { r: 4.3, h: 14, R: RD, i: 1, s: 42, band: WH[4] });
}, { margin: 4 });
def('prop_drum_blue', 'World', [1, 1], 18, g => { drumZ(g, 8.5, 8.5, 0, { r: 4.3, h: 14, R: BU, i: 2, s: 43, rust: .24 }); }, { margin: 4 });
def('prop_drum_rust', 'World', [1, 1], 18, g => {
  drumZ(g, 8.5, 8.5, 0, { r: 4.3, h: 14, R: RU, i: 2, s: 44, rust: .45, open: true });
  g.erase(11, 11, 4, 13, 13, 7); // dent
}, { margin: 4 });

def('prop_drum_pump', 'World', [1, 1], 26, g => {
  const c = drumZ(g, 8.5, 8.5, 0, { r: 4.3, h: 14, R: OL, i: 2, s: 45, band: GD[2] });
  const px = 10.5, py = 7.5;
  g.cylZ(px, py, 1, 14, 22, steelD); g.cylZ(px, py, 1.4, 21, 23, steelM);
  g.line(px, py, 23, px - 4, py, 24, steelM); g.set(px - 4, py, 25, flat(RD[2]));
  g.line(px + 1, py, 19, px + 3, py + 1, 19, steelD);
  // Hose hanging down to a nozzle.
  for (let t = 0; t <= 1; t += .05) g.set(px + 3 + t * 3, py + 1 + t * 4, 19 - Math.sin(t * Math.PI) * 4 - t * 14, flat(RB[1]));
  g.set(px + 6, py + 5, 1, steelM); g.set(px + 6, py + 6, 1, steelM);
}, { margin: 5 });

def('prop_drum_lying', 'World', [1, 1], 12, g => {
  for (const x of [3, 12]) { g.box(x, 4, 0, x + 2, 6, 2, battens(WD, 2, 3)); g.box(x, 11, 0, x + 2, 13, 2, battens(WD, 2, 4)); }
  drum(g, [1.5, 8.5, 5.3], [1, 0, 0], { r: 4, h: 14, R: OL, i: 2, s: 46, band: GD[2] });
}, { margin: 4 });

def('prop_drum_pyramid', 'World', [2, 1], 30, g => {
  for (const y of [2, 11]) g.box(1, y, 0, 31, y + 2, 2, battens(WD, 2, y));
  const C = [[OL, 2, 0], [OL, 3, 0], [RD, 1, WH[4]], [BU, 2, 0], [OL, 2, GD[2]], [RU, 2, 0]];
  const P = [[7.5, 6.5], [16.5, 6.5], [25.5, 6.5], [12, 14.3], [21, 14.3], [16.5, 22.1]];
  P.forEach(([x, z], k) => { const [R, i, band] = C[k]; drum(g, [x, 1.5, z], [0, 1, 0], { r: 3.6, h: 13, R, i, s: 50 + k, band: band || null, rust: R === RU ? .45 : .15 }); });
  for (const y of [5, 11]) for (const x of [2, 31]) g.box(x - 1, y - 1, 0, x + 1, y + 1, 4, battens(WD, 2, 9));
}, { margin: 4 });

def('prop_drum_pallet', 'World', [1, 1], 18, g => {
  pallet(g, 1, 2, 0, 14, 12, 61);
  let k = 0;
  for (const [x, y] of [[4.5, 4.5], [11.5, 4.5], [4.5, 11.5], [11.5, 11.5]]) drumZ(g, x, y, 3, { r: 3.2, h: 12, R: [OL, OL, RD, OL][k], i: 2 - (k === 1), s: 60 + k++, hoop: 1.1 });
  g.box(0, 7, 8, 16, 9, 9, flat(ST[2])); // steel strap
}, { margin: 4 });

def('prop_drum_spill', 'World', [2, 1], 16, g => {
  // Oil pool spreading from the open bung.
  g.shape(10, 1, 0, 31, 16, 1, (x, y) => { const d = Math.hypot((x - 17) * .8, y - 9), n = fbm(x * .3, y * .3, 12); return d < 6 + n * 5 || (x > 12 && x < 26 && Math.abs(y - 9 - Math.sin(x * .5)) < 1 + n); },
    mat((x, y) => { const h = hash(ix(x), ix(y), 5); return h < .03 ? OIL[4] : h < .07 ? OIL[3] : fbm(x * .5, y * .5, 4) > .55 ? OIL[2] : OIL[1]; }, { flat: true }));
  drum(g, [1.5, 5, 4.1], [1, .3, 0], { r: 4, h: 14, R: RD, i: 1, s: 71, open: true });
  drumZ(g, 26.5, 4.5, 0, { r: 3.8, h: 13, R: OL, i: 2, s: 72, rust: .3 });
}, { margin: 4 });

// ======================= Jerrycans =======================
def('prop_can_jerry_stack', 'World', [1, 1], 20, g => {
  jerry(g, 1, 3, 0, OL, 2); jerry(g, 8, 3, 0, OL, 3); jerry(g, 1, 8, 0, OL, 3); jerry(g, 8, 8, 0, RD, 2);
  jerry(g, 4, 5, 8, OL, 2); jerry(g, 11, 5, 8, OL, 2, { alongY: true });
  g.text('s', 9, 10, 6, 'W', WH[4]);
}, { margin: 4 });

def('prop_can_jerry_row', 'World', [2, 1], 14, g => {
  [[1, OL, 2], [8, OL, 3], [15, OL, 2], [22, RD, 2]].forEach(([x, R, i]) => jerry(g, x, 6, 0, R, i));
  // Funnel and a loose spout.
  g.cone(30, 8.5, 1, 2.8, 0, 6, flat(ST[3])); g.erase(29, 8, 5, 31, 9, 6);
  g.line(26, 13, 0, 31, 14, 1, flat(ST[2]));
}, { margin: 4 });

// ======================= Pallets & tarps =======================
def('prop_pallet', 'World', [1, 1], 6, g => {
  pallet(g, 1, 2, 0, 14, 12, 81);
  g.box(3, 13, 0, 14, 15, 1, battens(WD, 2, 82)); // a loose board
}, { margin: 4 });

def('prop_pallet_stack', 'World', [1, 1], 16, g => {
  [[1, 2], [2, 2], [1, 3], [0, 2], [2, 1]].forEach(([x, y], k) => pallet(g, x, y, k * 3, 14, 12, 83 + k));
}, { margin: 4 });

def('prop_tarp_pile', 'World', [2, 1], 18, g => {
  tarp(g, 1, 1, 27, 15, unionH(boxH(3, 3, 14, 13, 12), boxH(13, 4, 25, 13, 9), discH(19, 8, 3, 13)), foldCanvas(CV, 2, 3), [['x', 8], ['x', 19], ['y', 8]]);
  drumZ(g, 29.5, 10.5, 0, { r: 3, h: 10, R: OL, i: 2, s: 91 });
}, { margin: 4 });

// ======================= Bombs =======================
def('prop_bomb_rack', 'World', [2, 1], 18, g => {
  for (const x of [6, 23]) {
    g.box(x, 1, 0, x + 3, 15, 3, battens(WD, 2, x));
    g.box(x, 1, 3, x + 3, 2, 7, battens(WD, 2, x + 1)); g.box(x, 14, 3, x + 3, 15, 7, battens(WD, 2, x + 2));
    g.box(x, 7.5, 3, x + 3, 8.5, 5, battens(WD, 2, x + 3));
  }
  bomb(g, 3, 4, 5.6, 24, 2.6, 1, 1); bomb(g, 29, 12, 5.6, 24, 2.6, -1, 2); bomb(g, 5, 8, 10.6, 24, 2.6, 1, 3);
}, { margin: 6 });

def('prop_bomb_trolley', 'World', [2, 1], 16, g => {
  const fr = paint(ST, 2, 5, .08, false);
  for (const y of [4, 12]) g.box(3, y, 3, 29, y + 1, 5, fr);
  for (const x of [5, 15, 25]) g.box(x, 4, 3, x + 2, 13, 4, fr);
  for (const x of [8, 22]) { g.box(x, 5, 4, x + 2, 12, 6, flat(WD[2])); }
  for (const [x, y] of [[6, 2], [6, 13], [24, 2], [24, 13]]) tire(g, [x, y, 2.2], [0, 1, 0], { R: 2.4, ri: .9, h: 2, hub: flat(ST[3]) });
  // Tow bar with T handle.
  g.line(29, 8.5, 4, 36, 8.5, 9, fr); g.line(36, 6, 9, 36, 11, 9, fr);
  bomb(g, 4, 8.5, 9.2, 24, 3.2, 1, 7);
}, { margin: 8 });

// ======================= Tyres =======================
def('prop_tire_stack', 'World', [1, 1], 18, g => {
  [[8, 8], [8.5, 7.5], [7.5, 8.5], [8.5, 8.5]].forEach(([x, y], k) => tire(g, [x, y, k * 3], [0, 0, 1], { R: 5.2, ri: 2.3, h: 3 }));
  tire(g, [14, 11, 5], [1, .2, .9], { R: 4.5, ri: 2, h: 2.6 });
}, { margin: 5 });

def('prop_tire_pile', 'World', [1, 1], 16, g => {
  tire(g, [6, 9, 0], [0, 0, 1], { R: 5, ri: 2.2, h: 3 });
  tire(g, [9, 7, 2.5], [.25, -.1, 1], { R: 5, ri: 2.2, h: 3 });
  // Aircraft main wheel on its rim, standing.
  tire(g, [12, 9, 6.3], [1, 0, 0], { R: 6, ri: 3, h: 3.5, hub: flat(ST[3]) });
}, { margin: 5 });

// ======================= Sandbag works =======================
def('prop_sandbag_corner', 'World', [2, 2], 14, g => {
  const pts = [[31, 5]];
  for (let a = 0; a <= 1.0001; a += .125) { const t = Math.PI * 1.5 - a * Math.PI / 2; pts.push([18 + Math.cos(t) * 13, 18 + Math.sin(t) * 13]); }
  pts.push([5, 31]);
  bagWall(g, pts, 4, { rows: k => k < 2 ? 2 : 1, s: 3 });
}, { margin: 5 });

def('prop_sandbag_ring', 'World', [3, 3], 14, g => {
  const pts = [];
  for (let a = Math.PI * .5 + .45; a <= Math.PI * 2.5 - .44; a += .2) pts.push([24 + Math.cos(a) * 18, 24 + Math.sin(a) * 18]);
  bagWall(g, pts, 4, { rows: k => k < 2 ? 2 : 1, s: 5 });
  // Ends of the entrance get a short return.
  for (const sx of [-1, 1]) bag(g, 24 + sx * 9, 41, 1.4, Math.PI / 2 - sx * .25, { s: 9 + sx });
}, { margin: 5 });

def('prop_sandbag_pile', 'World', [1, 1], 12, g => {
  let k = 0;
  for (const [x, y, z, th] of [[4, 5, 1.4, .2], [11, 5, 1.4, -.1], [5, 11, 1.4, -.3], [12, 11, 1.4, .4], [8, 8, 3.8, .9], [7.5, 4.5, 3.6, 0], [10, 10.5, 3.9, -.6], [8.5, 7, 6.1, .3]]) bag(g, x, y, z, th, { s: 30 + k++ });
}, { margin: 5 });

// ======================= Fences =======================
def('prop_fence_wood', 'World', [2, 1], 16, g => {
  for (const [x, lean, h] of [[0, 0, 12], [10.5, .6, 11], [21, -.4, 12]]) g.shape(x - 1, 7, 0, x + 3, 10, h + 1, (xx, y, z) => { const o = lean * z / h; return xx >= x + o && xx < x + 2 + o && y >= 7.5 && y < 9.5 && z < h - (xx > x + 1 + o ? .6 : 0); }, woodPost);
  const rail = battens(WD, 3, 4);
  for (const z of [4, 9]) g.box(0, 9.5, z, 32, 10.5, z + 2, rail);
  g.erase(25, 9, 9, 32, 11, 11); g.line(25, 10, 10, 31, 10, 7, rail); g.line(25, 10, 9, 31, 10, 6, rail); // broken top rail
  for (const [x, z] of [[1, 5], [1, 10], [11.5, 5], [11.5, 10], [22, 5]]) g.set(x, 10.5, z, steelD);
}, { margin: 4 });

def('prop_fence_gate', 'World', [2, 1], 18, g => {
  for (const x of [0, 29]) { g.box(x, 6, 0, x + 3, 9, 15, woodPost); g.box(x - .5, 5.5, 15, x + 3.5, 9.5, 16, flat(WD[1])); }
  const rail = battens(WD, 3, 6);
  for (const z of [2, 6, 10]) g.box(4, 7, z, 28, 8, z + 2, rail);
  for (const x of [4, 26]) g.box(x, 7, 2, x + 2, 8, 12, rail);
  g.line(5, 7.5, 3, 27, 7.5, 11, rail); g.line(5, 7.5, 4, 27, 7.5, 12, rail);
  for (const z of [3, 10]) g.box(3, 8, z, 6, 9, z + 1, flat(ST[1]));
  g.box(26, 8, 7, 29, 9, 8, flat(ST[2]));
}, { margin: 4 });

// ======================= Signs =======================
function posts(g, xs, h, y = 7) { for (const x of xs) { g.box(x, y, 0, x + 2, y + 2, h, woodPost); g.box(x - .3, y - .3, h, x + 2.3, y + 2.3, h + 1, flat(WD[1])); } }
def('prop_sign_no_smoking', 'World', [2, 1], 24, g => {
  posts(g, [-1, 31], 22);
  signBoard(g, 1, 31, 8, 9, 22, WH[4], RD[2], [['NO', RD[2], 0], ['SMOKING', RD[2]]]);
  // Fire bucket on a hook.
  g.set(32, 9, 15, steelD); g.set(32, 10, 14, steelD); g.cone(32, 11, 1.2, 1.8, 10, 14, flat(RD[2])); g.cylZ(32, 11, 1.3, 13, 14, null);
}, { margin: 4 });

def('prop_sign_danger', 'World', [2, 1], 24, g => {
  posts(g, [-1, 31], 22);
  signBoard(g, 1, 31, 8, 9, 22, WH[4], TP[1], [['DANGER', WH[4], 0], ['FUEL', TP[1]]]);
  g.shape(2, 8, 15, 30, 9, 21, () => true, flat(RD[2]));
}, { margin: 4 });

def('prop_sign_keep_out', 'World', [1, 1], 24, g => {
  posts(g, [7], 23);
  const yl = GD[3];
  g.box(-2, 9, 9, 18, 10, 22, flat(yl));
  g.shape(-2, 9, 9, 18, 10, 22, (x, y, z) => (x < -1 || x > 17 || z < 10 || z > 21) && (ix(x + z) % 4 < 2), flat(TP[1]));
  for (const [str, zt] of [['KEEP', 19], ['OUT', 13]]) { const w = str.length * 4 - 1; g.text('s', Math.round(8 - w / 2), 9, zt, str, TP[1]); g.text('n', Math.round(8 + w / 2 - 1), 9, zt, str, TP[1]); }
}, { margin: 6 });

// ======================= Mail =======================
def('prop_mailbags', 'World', [1, 1], 16, g => {
  const m1 = paint(CR, 1, 3, 0, false), m2 = paint(CV, 3, 5, 0, false), m3 = paint(SN, 2, 4, 0, false);
  sack(g, 4.5, 5.5, 0, 11, 3.2, m1); sack(g, 10.5, 4.5, 0, 10, 3, m2); sack(g, 13, 9.5, 0, 9, 2.8, m3);
  g.ell(6, 12, 2.4, 4.5, 2.6, 2.4, m1); g.cylX(12, 2.4, .9, 10.4, 12, rope); g.ell(11.6, 12, 2.4, 1.2, 1, 1, m1);
  g.surfText('s', 3, 6, 'US', RD[1]);
  // Small parcel tied with string.
  g.box(0, 9, 0, 4, 14, 3, flat(SN[3])); g.box(2, 9, 0, 3, 14, 3.01, rope); g.box(0, 11, 2, 4, 12, 3, rope);
}, { margin: 4 });

// ======================= Cargo =======================
def('prop_cargo_airdrop', 'World', [2, 1], 14, g => {
  // A-5 delivery bundle: canvas-wrapped, webbing straps, yellow ID panel.
  const wrap = foldCanvas(CV, 2, 7), web = flat(OL[1]);
  g.shape(2, 3, 0, 16, 14, 9, (x, y, z) => Math.abs((x - 9) / 7) ** 4 + Math.abs((y - 8.5) / 5.5) ** 4 + Math.abs((z - 4.5) / 4.5) ** 4 <= 1, wrap);
  for (const x of [5, 9, 13]) g.shape(x, 2, 0, x + 1, 15, 10, (xx, y, z) => g.has(xx, y, z) && !g.has(xx, y + 1, z) || !g.has(xx, y, z + 1) && g.has(xx, y, z) || !g.has(xx, y - 1, z) && g.has(xx, y, z) ? web : false);
  g.shape(2, 6, 0, 17, 11, 9, (x, y, z) => g.has(x, y, z) && !g.has(x, y, z + 1) ? web : false);
  g.box(6, 13, 4, 9, 14, 7, flat(GD[2]));
  // Parachute canopy bundled on the ground, shroud lines to the load.
  const silk = mat((x, y, z) => { const n = fbm(x * .4, y * .4 + z * .3, 33); return ((ix(x + y * .5) % 6) + 6) % 6 === 0 ? CR[1] : cl(CR, 2 + (n > .6 ? 1 : n < .4 ? -1 : 0)); });
  for (const [x, y, z, a, b, c] of [[22, 7, 2, 5, 4, 2.5], [26, 10, 2, 4.5, 4, 2.4], [24, 9, 4, 4, 3.5, 2.4], [28, 6, 1.6, 3.4, 3, 1.8], [21, 12, 1.4, 3, 2.6, 1.5]]) g.ell(x, y, z, a, b, c, silk);
  g.ell(25, 8, 5.8, 2.4, 2, 1.4, mat(() => RD[3]));
  for (const [y0, y1] of [[6, 7], [8, 9], [10, 11]]) g.line(16, y0, 6, 20, y1, 3, flat(CR[1]));
}, { margin: 4 });

def('prop_cargo_heap', 'World', [2, 2], 32, g => {
  // Back: tarp over a pallet load.
  pallet(g, 2, 2, 0, 26, 12, 101);
  tarp(g, 1, 1, 29, 15, unionH(boxH(3, 3, 15, 13, 14), boxH(15, 3, 27, 13, 11), discH(21, 8, 3.5, 15)), foldCanvas(CV, 2, 9), [['x', 9], ['x', 21]]);
  // Front left: drums, front right: crates and cans.
  drumZ(g, 4.5, 21.5, 0, { r: 3.6, h: 13, R: OL, i: 2, s: 111, band: GD[2] });
  drumZ(g, 11.5, 22.5, 0, { r: 3.6, h: 13, R: RD, i: 1, s: 112 });
  drum(g, [1, 28.5, 3.6], [1, .1, 0], { r: 3.6, h: 13, R: BU, i: 2, s: 113 });
  crate(g, 17, 17, 0, 30, 28, 10, { s: 114 }); crate(g, 19, 19, 10, 28, 27, 16, { R: OL, i: 4, s: 115, brace: '' });
  stencil(g, 's', 17, 17, 30, 28, 10, 23.5, 7, 'US', TP[1]);
  jerry(g, 16, 28, 0, OL, 2); jerry(g, 23, 28.5, 0, OL, 3);
}, { margin: 5 });

// Non-model sprites of this module (optional): called from world.cjs build(add).
function extra(add) {}

module.exports = { extra };

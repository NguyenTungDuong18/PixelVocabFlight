'use strict';
// Aircraft of the title cinematic as signed-distance models (plane space: x toward the nose, y toward the
// left wing, z up) with a paint function per surface point. Velmark (ours: elliptical wing, olive/ocean
// camouflage, orange-navy-white roundel) and Kruland (theirs: grey, straight tapered wing, yellow cowl
// band, a heron on the nose) keep the shapes of the earlier title art; the Kruland heavy bomber is new
// (four engines, twin fins, glazed nose, three turrets). No real insignia, no people beyond a helmet shape.
// meshes(): each model is turned into triangles once (surface nets on the SDF), with coarser levels made
// by vertex clustering, and cached on disk keyed by this file's text.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const C = require('./core.cjs');
const { clamp, RAMP, fbm2, ih } = C;

const len2 = (x, y) => Math.sqrt(x * x + y * y), len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const fract = v => v - Math.floor(v);
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
function capsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz || 1;
  const h = clamp(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2);
  return len3(px - ax - dx * h, py - ay - dy * h, pz - az - dz * h) - (ra + (rb - ra) * h);
}
function ellipsoid(px, py, pz, rx, ry, rz) {
  const k0 = len3(px / rx, py / ry, pz / rz), k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
const ell2 = (a, b, ra, rb) => (len2(a / ra, b / rb) - 1) * Math.min(ra, rb);
const sdBox = (x, y, z, hx, hy, hz) => { const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz; return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
// Wing / tailplane panel out to half span S: a stadium section of chord ch(a) centred at mid(a), height zc(a), half thickness th(a).
function panel(x, ay, z, S, ch, mid, zc, th) {
  const a = Math.min(ay, S), c = ch(a) / 2, t = Math.min(th(a), c), f = len2(Math.max(Math.abs(x - mid(a)) - (c - t), 0), z - zc(a)) - t;
  return ay > S ? len2(ay - S, Math.max(f, 0)) : f;
}
const ROUND = RAMP.roundel, ORANGE = ROUND[0], NAVY = ROUND[1], WHITE = ROUND[2];
const ring = (u, v, r) => { const d = len2(u, v); return d < r * .36 ? WHITE : d < r * .68 ? NAVY : d < r ? ORANGE : null; };
const HOT = C.hex('#ff8a3a'), DARK = C.hex('#0c0e14'), LEATHER = C.hex('#3a2a1c'), BILL = C.hex('#e6b83a'), PALE = C.hex('#e8ebe8');

// ---------------------------------------------------------------- Velmark fighter (half span 36, nose x 31.8, tail -29.5)
const velR = x => x > 6 ? 3.25 - (x - 6) / 21 * .75 : .7 + 2.55 * Math.pow(clamp((x + 29) / 35), .62);
const velChord = a => 15.5 * Math.sqrt(Math.max(0, 1 - (a / 36) ** 2));
function velSdf(x, y, z) {
  const ay = Math.abs(y), r = velR(x), zc = x < -4 ? (-4 - x) * .045 : 0;
  let d = Math.max(ell2(ay, z - zc, r * .92, r * 1.12), -(x + 29.5), x - 27.4);
  d = smin(d, capsule(x, ay, z, 26.6, 0, 0, 31.8, 0, 0, 2.5, .3), .6);                          // spinner
  d = smin(d, ellipsoid(x - 3.5, ay, z - 2.75, 5, 1.7, 1.95), .5);                              // teardrop canopy
  d = smin(d, ellipsoid(x + 4, ay, z - 2.4, 8, 1.35, 1.0), .8);                                  // spine behind it
  d = Math.min(d, sdBox(x - 19, ay - 2.6, z - .9, 4.3, .45, .5) - .1);                           // exhaust stack rows
  const wzc = -2.1 + ay * .105, wth = Math.max(.16, 1.05 * (1 - .75 * ay / 36));
  let w = panel(x, ay, z, 36, velChord, a => 5.5 - .2 * velChord(a), a => -2.1 + a * .105, a => Math.max(.16, 1.05 * (1 - .75 * a / 36)));
  w = smin(w, ellipsoid(x - 3.6, ay - 12.6, z - wzc - wth * .65, 3.2, 1.1, .72), .4);            // gun bay blister
  w = Math.min(w, capsule(x, ay, z, 6, 11.5, -.92, 14.4, 11.5, -.92, .44, .38));                 // cannon
  w = smin(w, sdBox(x - 1, ay - 7.5, z + 2.5, 3.6, 1.5, .55) - .2, .5);                          // radiator bath under each wing
  d = Math.min(d, w);
  d = Math.min(d, panel(x, ay, z, 10.5, a => 6.8 * Math.sqrt(Math.max(0, 1 - (a / 10.5) ** 2)), a => -25 + a * .08, () => 1, () => .32));
  d = Math.min(d, Math.max(ellipsoid(x + 25.8 + (z - 1) * .2, ay, z - 1.2, 4.2, .38, 7), 1 - z)); // fin
  d = Math.min(d, capsule(x, ay, z, -6, 0, 3, -7.5, 0, 6.2, .16, .1));                           // aerial mast
  return d;
}
function velPaint(x, y, z, n, s) {
  const ay = Math.abs(y), px = .55 / s, top = n[2] > .25, under = n[2] < -.3;
  if (x > -.9 && z > 2.5 && ellipsoid(x - 3.5, ay, z - 2.75, 5.2, 1.85, 2.1) < .05) {             // canopy: frame, sill, glass, pilot
    if (Math.abs(x - 6.1) < px * 1.3 || Math.abs(x - 1.4) < px || z < 2.5 + px * 2.2) return { r: RAMP.olive, l: -.15 };
    if (len3(x - 3.2, ay, (z - 3.5) * 1.1) < 1.05) return { c: LEATHER };
    return { r: RAMP.glass, l: 0, glass: true };
  }
  if (x > 27.1) return { r: RAMP.smoke, l: -.15 };                                               // black spinner
  if (x > 14.5 && x < 23.6 && ay > 2.3 && Math.abs(z - .9) < .78) {                             // exhaust stacks
    const k = (x - 14.8) / 1.45, f = fract(k);
    if (ay > 2.95 && Math.abs(z - .9) < .32 && Math.abs(f - .5) < .22 && k >= 0 && k < 6) return { c: HOT, e: true };
    return { r: RAMP.smoke, l: f < .2 ? -.2 : .1 };
  }
  if (ay > 1 && Math.abs(n[1]) > .35 && z > -2.6) { const c = ring(x + 12, z - .2, 1.9); if (c) return { c }; }
  if (top && ay > 18 && ay < 30) { const c = ring(x - 3.2, ay - 24, 3.4); if (c) return { c }; }
  if (under && ay > 18 && ay < 30) { const c = ring(x - 3.2, ay - 24, 3.4); if (c) return { c }; }
  if (under && ay < 37) return { r: RAMP.egg, l: .1 - (Math.abs(ay - 7.5) < 1.6 && x > 3.6 ? .5 : 0) };
  if (ay > 10.9 && ay < 12.1 && x > 9.5 && z < 0) return { r: RAMP.metal, l: -.25 };              // cannon barrel
  if (!under && x > -22.2 && x < -20.4) return { r: RAMP.egg, l: .12 };                          // sky fuselage band
  if (ay < .6 && z > 3 && x < -5 && x > -9) return { r: RAMP.metal, l: -.2 };
  let l = 0;
  for (const k of [-14, -3.6, 9.6, 14.2, 24]) if (Math.abs(x - k) < px && ay < 4) l -= .16;      // panel lines
  if (ay > 4 && ay < 35 && z < 2) { const ch = velChord(ay), te = 5.5 - .7 * ch; if (Math.abs(x - (te + ch * .22)) < px) l -= .14; }
  if (ay > 1.2 && x > 3 && x < 15 && z > -.8 && z < 2.4 && Math.abs(n[1]) > .3) l -= .34 * clamp((x - 3) / 12) * clamp(1 - Math.abs(z - .9) / 1.5) * (.6 + .4 * fbm2(x * .5, z * 2, 353)); // soot
  const wear = (ay < 9 && top && z < 0) || (Math.abs(x - 3) < 6 && z > 1.4) || (x > 9 && x < 26 && z > 1.8);
  if (wear && s > 2 && fbm2(x * .7 + 7, y * .7 + z, 351) > .8) return { r: RAMP.metal, l: .1 };
  const w = fbm2(x * .05 + 3, y * .05, 361) * 8, a = Math.floor((x * .75 + (y + z) * .66 + w) / 10), b = Math.floor(((y + z) * .75 - x * .66 + w) / 13);
  return ih(a, b, 0, 371) > .48 ? { r: RAMP.olive, l: l + .06 } : { r: RAMP.ocean, l: l - .04 };
}

// ---------------------------------------------------------------- Kruland fighter (half span 32, nose x 30, tail -27.5)
const krR = x => x > 4 ? 3.0 - (x - 4) / 22 * .7 : .6 + 2.4 * Math.pow(clamp((x + 27) / 31), .7);
const krChord = ay => { let c = 13 - 5.5 * ay / 32; if (ay > 29) c *= Math.sqrt(Math.max(0, 1 - ((ay - 29) / 3) ** 2)); return c; };
function krSdf(x, y, z) {
  const ay = Math.abs(y), r = krR(x), zc = x < -4 ? (-4 - x) * .04 : 0;
  let d = Math.max(ell2(ay, z - zc, r * .88, r * 1.2), -(x + 27.5), x - 25.6);
  d = smin(d, capsule(x, ay, z, 24.8, 0, -.1, 30, 0, -.1, 2.3, .3), .5);                         // spinner
  d = smin(d, ellipsoid(x - 16, ay - 1.1, z - 3.15, 4.5, .6, .65), .35);                         // gun bumps on the cowl
  d = smin(d, Math.max(sdBox(x - 2.5, ay, z - 2.9, 4.6, 1.3, 1.1) - .25, (x - 4.4) * .55 + (z - 3.6) * .83), .3); // box canopy
  d = Math.min(d, sdBox(x - 17.5, ay - 2.3, z + .7, 3.8, .45, .45) - .1);                         // exhaust rows
  let w = panel(x, ay, z, 32, krChord, a => 5 - a * .03 - .2 * krChord(a), a => -2.3 + a * .114, a => Math.max(.16, .95 * (1 - .55 * a / 32)));
  w = Math.min(w, capsule(x, ay, z, 7, 5.6, -1.75, 13.2, 5.6, -1.75, .34, .3));                   // wing-root gun
  w = Math.min(w, sdBox(x - 4.5, ay - 10, z + 2, 2.4, 1.7, .6) - .15);                            // radiator under each wing
  d = Math.min(d, w);
  d = smin(d, ellipsoid(x - 13, ay, z + 2.7, 3.2, 1.1, .8), .4);                                 // oil cooler under the nose
  d = Math.min(d, panel(x, ay, z, 9, a => 5.5 - a * .2, a => -23.3 + a * .06, () => 1.6, () => .3));
  d = Math.min(d, Math.max(ellipsoid(x + 24.2 + (z - 1) * .15, ay, z - 1.2, 3.8, .38, 5.8), 1 - z)); // fin
  return d;
}
function krPaint(x, y, z, n, s) {
  const ay = Math.abs(y), px = .55 / s, top = n[2] > .25, under = n[2] < -.3;
  if (x > -2.6 && x < 7.7 && ay < 1.65 && z > 3.25 && sdBox(x - 2.5, ay, z - 2.9, 4.6, 1.3, 1.1) < .35) {   // framed box canopy
    if ([-1.6, 1.0, 3.4, 5.6].some(k => Math.abs(x - k) < px * 1.2) || (Math.abs(n[1]) > .5 && Math.abs(z - 3.75) < px)) return { r: RAMP.grey, l: -.25 };
    return { r: RAMP.glass, l: -.1, glass: true };
  }
  if (Math.abs(ay - 10) < 2 && z < -1.45 && x > 1.9 && x < 7.2) return { r: RAMP.grey, l: x > 6.6 ? -.5 : -.1 };  // radiator
  if (x > 28.6) return { c: WHITE };                                                             // spinner tip
  if (x > 24.9) return { r: RAMP.grey, l: -.3 };
  if (x > 22.3) return { r: RAMP.yellow, l: .1 };                                                // yellow cowl band
  if (x > 13.2 && x < 21.8 && ay > 1.9 && Math.abs(z + .7) < .74) {                             // exhaust stacks
    const k = (x - 13.7) / 1.27, f = fract(k);
    if (ay > 2.65 && Math.abs(z + .7) < .3 && Math.abs(f - .5) < .22 && k >= 0 && k < 6) return { c: HOT, e: true };
    return { r: RAMP.smoke, l: f < .2 ? -.2 : .1 };
  }
  if (ay > 1.2 && Math.abs(n[1]) > .35) {                                                        // heron on the nose
    const hx = (x - 12) / .7, hz = (z - .6) / .7;
    if (Math.abs(hz - Math.sin(hx * .5) * 1.4 - hx * .25) < .9 && hx > -6 && hx < 3) return { c: WHITE };
    if (hx >= 2.5 && hx < 7.5 && Math.abs(hz - .9 - (hx - 3) * .12) < .7) return { c: BILL };
    if (hx > -11 && hx < -5 && Math.abs(hz + 1.6 + (hx + 8) * .1) < 1.6) return { c: PALE };
    if (Math.abs(x + 13) < .9) return { r: RAMP.grey, l: -.4 };                                   // plain dark fuselage band
  }
  if (under && ay > 25) return { r: RAMP.yellow, l: 0 };                                         // yellow under the wing tips
  if (under) return { r: RAMP.blue, l: .05 };
  let l = 0;
  for (const k of [-12, -2.5, 8.5, 13]) if (Math.abs(x - k) < px && ay < 3.5) l -= .16;
  if (ay > 4 && ay < 31 && z < 2) { const ch = krChord(ay), te = 5 - ay * .03 - .7 * ch; if (Math.abs(x - (te + ch * .2)) < px) l -= .14; }
  if (ay > 1 && x > 3 && x < 13.5 && z > -1.8 && z < .6 && Math.abs(n[1]) > .3) l -= .3 * clamp((x - 3) / 10) * clamp(1 - Math.abs(z + .7) / 1.2);
  const wear = (ay < 8 && top && z < 0) || (x > 10 && x < 22 && z > 1.5);
  if (wear && s > 2 && fbm2(x * .7 + 3, y * .7 + z, 359) > .8) return { r: RAMP.metal, l: .1 };
  const m = fbm2(x * .22 + 5, (y + z) * .22, 331) > (Math.abs(n[1]) > .5 ? .5 : .6);
  return { r: RAMP.grey, l: (m ? -.14 : .04) + l };
}

// ---------------------------------------------------------------- Kruland heavy bomber (half span 68, nose x 46, tail -50)
const hvK = x => x > -20 ? 1 : .3 + .7 * Math.pow(clamp((x + 50) / 30), .7);
const hvZc = x => x < -20 ? (-20 - x) * .07 : 0;
const hvChord = a => { let c = 22 - 14 * a / 68; if (a > 63) c *= Math.sqrt(Math.max(0, 1 - ((a - 63) / 5) ** 2)); return c; };
const hvWz = a => 1.6 + a * .06;
const HV_ENG = [20, 42];
function hvSdf(x, y, z) {
  const ay = Math.abs(y), k = hvK(x), zc = hvZc(x);
  let d = Math.max(ell2(ay, z - zc, 4.6 * k, 5.4 * k), -(x + 50), x - 36);
  d = smin(d, ellipsoid(x - 34, ay, z + .3, 12, 4.3, 4.9), 1);                                   // glazed nose
  d = smin(d, ellipsoid(x - 23, ay, z - 5, 7.5, 2.7, 2.5), .8);                                  // flight deck greenhouse
  d = Math.min(d, len3(x - 4, ay, z - 5.5) - 2.3);                                               // dorsal turret
  d = Math.min(d, len3(x + 7, ay, z + 5.3) - 2.2);                                               // ventral turret
  d = smin(d, ellipsoid(x + 50, ay, z - 2.1, 3.2, 1.7, 2), .5);                                  // tail gun position
  d = Math.min(d, capsule(x, ay, z, 4, 1, 6.6, 8.2, 1, 7.4, .18, .14));                          // turret guns
  d = Math.min(d, capsule(x, ay, z, -52, .7, 2.1, -56.5, .7, 2.1, .18, .14));
  let w = panel(x, ay, z, 68, hvChord, a => 6 - a * .05, hvWz, a => 2 - 1.5 * a / 68);
  for (const e of HV_ENG) {
    const ez = hvWz(e) - 1.1;
    w = smin(w, capsule(x, ay - e, z, -5, 0, ez, 19, 0, ez, 2.6, 3.1), .9);                       // nacelle
    w = Math.min(w, capsule(x, ay - e, z, 19, 0, ez, 22.4, 0, ez, 1.5, .3));                      // spinner
  }
  d = Math.min(d, w);
  d = Math.min(d, panel(x, ay, z, 25, a => 10.5 - a * .12, a => -43, () => 2.6, () => .5));       // tailplane
  d = Math.min(d, ellipsoid(x + 44.5, ay - 24.5, z - 3.4, 6.2, .5, 7.2));                        // twin fins
  return d;
}
function hvPaint(x, y, z, n, s) {
  const ay = Math.abs(y), px = .6 / s, under = n[2] < -.3, top = n[2] > .25;
  if (x > 28 && ellipsoid(x - 34, ay, z + .3, 12.2, 4.5, 5.1) < .05 && (x > 37.5 || z > -1.5)) {   // nose glazing with frames
    if (fract(x * .42) < .2 || fract((z + ay * .6) * .45) < .2) return { r: RAMP.grey, l: -.2 };
    return { r: RAMP.glass, l: .1, glass: true };
  }
  if (z > 4.9 && x > 16.5 && x < 30 && ellipsoid(x - 23, ay, z - 5, 7.7, 2.9, 2.7) < .05) {       // flight deck
    if (fract(x * .5) < .22 || (ay < .35)) return { r: RAMP.grey, l: -.2 };
    return { r: RAMP.glass, l: 0, glass: true };
  }
  if (len3(x - 4, ay, z - 5.5) < 2.45 && z > 5.3) return fract(Math.atan2(ay, x - 4) * 1.6) < .22 ? { r: RAMP.grey, l: -.2 } : { r: RAMP.glass, l: 0, glass: true };
  if (len3(x + 7, ay, z + 5.3) < 2.35 && z < -5.2) return { r: RAMP.glass, l: -.2, glass: true };
  if (x < -49.5 && ellipsoid(x + 50, ay, z - 2.1, 3.4, 1.9, 2.2) < .05) return fract(z * .9) < .25 ? { r: RAMP.grey, l: -.2 } : { r: RAMP.glass, l: 0, glass: true };
  for (const e of HV_ENG) {
    const ez = hvWz(e) - 1.1, rr = len2(ay - e, z - ez);
    if (rr < 3.6 && x > 6) {
      if (x > 19.4) return { r: RAMP.smoke, l: -.1 };                                             // spinner
      if (x > 17.2) return { r: RAMP.yellow, l: .05 };                                            // yellow cowl ring
      if (x > 16.6) return { r: RAMP.grey, l: -.45 };
      if (x > 13 && x < 15.2 && fract(Math.atan2(z - ez, ay - e) * 2.2) < .3) return { c: HOT, e: true };  // exhaust collector glow
    }
    if (top && Math.abs(ay - e) < 2.4 && x < 2 && x > -12) return { r: RAMP.smoke, l: .1 + .25 * clamp((x + 12) / 14) + (fbm2(x * .4, ay * 1.5, 383) - .5) * .2 };  // exhaust stain over the wing
  }
  if (Math.abs(n[1]) > .35 && ay > 2 && ay < 5 && x < 30) {                                       // heron on the nose, band aft
    const hx = (x - 22) / 1.25, hz = (z + .4) / 1.25;
    if (Math.abs(hz - Math.sin(hx * .5) * 1.4 - hx * .25) < .9 && hx > -6 && hx < 3) return { c: WHITE };
    if (hx >= 2.5 && hx < 7.5 && Math.abs(hz - .9 - (hx - 3) * .12) < .7) return { c: BILL };
    if (hx > -11 && hx < -5 && Math.abs(hz + 1.6 + (hx + 8) * .1) < 1.6) return { c: PALE };
    if (Math.abs(x + 26) < 1.3) return { r: RAMP.yellow, l: 0 };
  }
  if (ay > 23.6 && ay < 25.4 && x < -38 && z > 5.5 && x > -47) return { r: RAMP.yellow, l: 0 };   // fin tops
  if (under && ay > 56) return { r: RAMP.yellow, l: 0 };
  if (under) return { r: RAMP.blue, l: (Math.abs(x - 2) < 9 && ay < 2.2 ? -.45 : .02) };           // bomb bay doors
  const ch = hvChord(Math.min(ay, 68)), le = 6 - ay * .05 + ch / 2;
  if (ay > 5 && ay < 67 && x > le - 1.1 && z < hvWz(ay) + 1.2) return { r: RAMP.smoke, l: -.05 }; // de-icer boots
  let l = 0;
  for (const k of [-34, -20, -8, 10, 17]) if (Math.abs(x - k) < px && ay < 5) l -= .14;
  if (ay > 5 && ay < 66 && Math.abs(x - (le - ch * .72)) < px) l -= .14;                          // flap / aileron line
  if (top && ay < 12 && Math.abs(x - 2) < 9 && fbm2(x * .9, y * .9, 387) > .7) return { r: RAMP.metal, l: 0 };   // walkway wear
  const m = fbm2(x * .13 + 9, (y + z) * .13, 381) > .55;
  return { r: RAMP.grey, l: (m ? -.13 : .05) + l };
}

// ---------------------------------------------------------------- catalogue
// scale: metres per model unit. props: [x, y, z, radius]. engines: where fire sits. guns: muzzles. cut: break-up parts.
const cutPaint = (paint, side, at) => (x, y, z, n, s) => Math.abs(y - at) < .7 && Math.abs(n[1]) > .6
  ? (fbm2(x * 1.3, z * 1.9, 395) > .62 ? { c: HOT, e: true } : { r: RAMP.smoke, l: -.2 + .4 * fbm2(x * .7, z * .9, 397) }) : paint(x, y, z, n, s);
const part = (m, side, at) => ({ ...m, sdf: (x, y, z) => Math.max(m.sdf(x, y, z), side * (at - y)), paint: cutPaint(m.paint, side, at) });
const BASE = {
  velmark: { sdf: velSdf, paint: velPaint, box: [-31, -37.5, -5, 33, 37.5, 9.5], step: .36, scale: .16, props: [[31.4, 0, 0, 10.5]],
    tips: [[5.5, -36, 1.68], [5.5, 36, 1.68]], guns: [[14.6, -11.5, -.92], [14.6, 11.5, -.92]], engines: [[20, 0, 1]], stacks: [[16, 3.2, .9], [16, -3.2, .9]], ink: 1.2 },
  kruland: { sdf: krSdf, paint: krPaint, box: [-29, -33.5, -5, 31.5, 33.5, 8.5], step: .36, scale: .16, props: [[30.2, 0, -.1, 9.6]],
    tips: [[3.6, -32, 1.35], [3.6, 32, 1.35]], guns: [[13.4, -5.6, -1.75], [13.4, 5.6, -1.75], [22, -1.1, 3.5], [22, 1.1, 3.5]], engines: [[17, 0, 1]], stacks: [[15, 2.9, -.7], [15, -2.9, -.7]], ink: 1.2 },
  heavy: { sdf: hvSdf, paint: hvPaint, box: [-58, -70, -9, 48, 70, 13], step: .55, scale: .23,
    props: [[22.6, -42, hvWz(42) - 1.1, 9], [22.6, -20, hvWz(20) - 1.1, 9], [22.6, 20, hvWz(20) - 1.1, 9], [22.6, 42, hvWz(42) - 1.1, 9]],
    tips: [[3, -68, 5.7], [3, 68, 5.7]], guns: [[6, 0, 7], [-56, 0, 2.1], [-7, 0, -7.5], [44, 0, -1]],
    engines: [[10, -42, hvWz(42)], [10, -20, hvWz(20)], [10, 20, hvWz(20)], [10, 42, hvWz(42)]], ink: 1.6 }
};
const MODELS = {
  ...BASE,
  heavy_wing: part(BASE.heavy, 1, 30), heavy_body: part(BASE.heavy, -1, 30),          // outer left wing with its engine / the rest
  heavy_tail: part({ ...BASE.heavy, sdf: (x, y, z) => Math.max(BASE.heavy.sdf(x, y, z), x + 24) }, -1, 80),
  kruland_wing: part(BASE.kruland, 1, 8), kruland_body: part(BASE.kruland, -1, 8)
};
for (const k in MODELS) MODELS[k].name = k;

// ---------------------------------------------------------------- meshing
// Surface nets on sdf - iso over the model box; returns { pos, nrm, ao, idx } (model units).
function surfaceNets(sdf, box, step, iso) {
  const [x0, y0, z0, x1, y1, z1] = box, nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1, nz = Math.ceil((z1 - z0) / step) + 1;
  const val = new Float32Array(nx * ny * nz), at = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[at(i, j, k)] = sdf(x0 + i * step, y0 + j * step, z0 + k * step) - iso;
  const vid = new Int32Array(nx * ny * nz).fill(-1), pos = [], idx = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = [], c = at(i, j, k); let mask = 0;
    for (let q = 0; q < 8; q++) { const f = val[at(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2))]; v.push(f); if (f < 0) mask |= 1 << q; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; cnt++;
    }
    vid[c] = pos.length / 3;
    pos.push(x0 + (i + sx / cnt) * step, y0 + (j + sy / cnt) * step, z0 + (k + sz / cnt) * step);
  }
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s = val[at(i, j, k)] < 0;
    if (s !== (val[at(i + 1, j, k)] < 0)) quad(vid[at(i, j - 1, k - 1)], vid[at(i, j, k - 1)], vid[at(i, j, k)], vid[at(i, j - 1, k)], !s);
    if (s !== (val[at(i, j + 1, k)] < 0)) quad(vid[at(i - 1, j, k - 1)], vid[at(i, j, k - 1)], vid[at(i, j, k)], vid[at(i - 1, j, k)], s);
    if (s !== (val[at(i, j, k + 1)] < 0)) quad(vid[at(i - 1, j - 1, k)], vid[at(i, j - 1, k)], vid[at(i, j, k)], vid[at(i - 1, j, k)], !s);
  }
  const nv = pos.length / 3, P = new Float32Array(pos), Nn = new Float32Array(nv * 3), A = new Float32Array(nv), e = step * .45;
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    Nn[i * 3] = gx; Nn[i * 3 + 1] = gy; Nn[i * 3 + 2] = gz;
    let occ = 0;
    for (let q = 1; q <= 4; q++) { const h = step * 1.4 * q; occ += Math.max(0, h - (sdf(x + gx * h, y + gy * h, z + gz * h) - iso)) / h * .3; }
    A[i] = clamp(1 - occ);
  }
  return { pos: P, nrm: Nn, ao: A, idx: new Uint32Array(idx) };
}
// Vertex clustering: every vertex in a grid cell of size `cell` becomes one.
function decimate(m, cell) {
  const nv = m.pos.length / 3, map = new Map(), remap = new Int32Array(nv), acc = [];
  for (let i = 0; i < nv; i++) {
    const key = Math.floor(m.pos[i * 3] / cell) * 73856093 ^ Math.floor(m.pos[i * 3 + 1] / cell) * 19349663 ^ Math.floor(m.pos[i * 3 + 2] / cell) * 83492791 ^ (m.nrm[i * 3 + 2] > .2 ? 1 : m.nrm[i * 3 + 2] < -.2 ? 2 : 0) * 5;
    let j = map.get(key);
    if (j === undefined) { j = acc.length; map.set(key, j); acc.push([0, 0, 0, 0, 0, 0, 0, 0]); }
    const a = acc[j]; a[0] += m.pos[i * 3]; a[1] += m.pos[i * 3 + 1]; a[2] += m.pos[i * 3 + 2]; a[3] += m.nrm[i * 3]; a[4] += m.nrm[i * 3 + 1]; a[5] += m.nrm[i * 3 + 2]; a[6] += m.ao[i]; a[7]++;
    remap[i] = j;
  }
  const n = acc.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), ao = new Float32Array(n), idx = [];
  acc.forEach((a, j) => { pos[j * 3] = a[0] / a[7]; pos[j * 3 + 1] = a[1] / a[7]; pos[j * 3 + 2] = a[2] / a[7]; const l = Math.hypot(a[3], a[4], a[5]) || 1; nrm[j * 3] = a[3] / l; nrm[j * 3 + 1] = a[4] / l; nrm[j * 3 + 2] = a[5] / l; ao[j] = a[6] / a[7]; });
  for (let t = 0; t < m.idx.length; t += 3) { const a = remap[m.idx[t]], b = remap[m.idx[t + 1]], c = remap[m.idx[t + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  return { pos, nrm, ao, idx: new Uint32Array(idx) };
}
const LOD_CELLS = [0, 2.6, 6, 13];                 // in steps of the finest mesh
const CACHE = path.join(os.tmpdir(), 'wordwing-cinema-' + crypto.createHash('md5').update(fs.readFileSync(__filename)).digest('hex').slice(0, 12));
function buildModel(name) {
  const m = MODELS[name], fine = surfaceNets(m.sdf, m.box, m.step, m.step * .42);
  return LOD_CELLS.map(c => c ? decimate(fine, c * m.step) : fine);
}
function save(file, lods) {
  const head = JSON.stringify(lods.map(l => [l.pos.length / 3, l.idx.length])), hb = Buffer.from(head), parts = [Buffer.from(new Uint32Array([hb.length]).buffer), hb];
  for (const l of lods) for (const a of [l.pos, l.nrm, l.ao, l.idx]) parts.push(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  fs.writeFileSync(file, Buffer.concat(parts));
}
function load(file) {
  const b = fs.readFileSync(file), hl = b.readUInt32LE(0), head = JSON.parse(b.slice(4, 4 + hl).toString());
  let o = 4 + hl; const take = (T, n) => { const a = new T(n); Buffer.from(a.buffer).set(b.subarray(o, o + a.byteLength)); o += a.byteLength; return a; };
  return head.map(([nv, ni]) => ({ pos: take(Float32Array, nv * 3), nrm: take(Float32Array, nv * 3), ao: take(Float32Array, nv), idx: take(Uint32Array, ni) }));
}
// Loads (building and caching when needed) the meshes of the named models; sets MODELS[name].lods.
function meshes(names = Object.keys(MODELS), log = () => {}) {
  if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });
  for (const name of names) {
    if (MODELS[name].lods) continue;
    const file = path.join(CACHE, name + '.bin');
    if (!fs.existsSync(file)) { const t = Date.now(), lods = buildModel(name); save(file, lods); log(name + ': ' + lods.map(l => l.idx.length / 3).join(' / ') + ' triangles, ' + (Date.now() - t) + ' ms'); }
    MODELS[name].lods = load(file);
  }
  return MODELS;
}

module.exports = { MODELS, meshes, LOD_CELLS };

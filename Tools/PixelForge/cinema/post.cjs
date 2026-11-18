'use strict';
// Last steps of a frame: fire from the heat buffer, additive light, bloom, lens effects, grade, then
// the snap to the film palette with ordered dither (this is what makes the render pixel art).
const C = require('./core.cjs');
const { W, H, clamp, RAMP, rampAt, nearest, BAYER } = C;
const N = W * H;
const blurA = new Float32Array(N * 3), blurB = new Float32Array(N * 3);

// separable box blur of src (rgb) into dst, radius r, at half cost by running sums
function box(src, dst, r) {
  const t = blurA;
  for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) {
    let s = 0; const row = y * W;
    for (let x = -r; x <= r; x++) s += src[(row + clamp(x, 0, W - 1)) * 3 + c];
    for (let x = 0; x < W; x++) { t[(row + x) * 3 + c] = s / (2 * r + 1); s += src[(row + Math.min(W - 1, x + r + 1)) * 3 + c] - src[(row + Math.max(0, x - r)) * 3 + c]; }
  }
  for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += t[(clamp(y, 0, H - 1) * W + x) * 3 + c];
    for (let y = 0; y < H; y++) { dst[(y * W + x) * 3 + c] = s / (2 * r + 1); s += t[(Math.min(H - 1, y + r + 1) * W + x) * 3 + c] - t[(Math.max(0, y - r) * W + x) * 3 + c]; }
  }
}

// post: { flash 0..1 (white), tint [r,g,b] flash colour, impact (bool: 2-tone impact frame), ca (px), vignette, gain, lift, white 0..1 (cloud white-out), whiteSeed, dirt [{x,y,r,a}], bars,
//         bloom (bloom multiplier, 1 = normal), amber 0..1 (warm grade after a blast), grade [r,g,b] }
function finish(fr, post = {}, out = new Uint8Array(N)) {
  const col = fr.col, heat = fr.heat, add = fr.add, glow = fr.glow, o = [0, 0, 0];
  // fire: heat -> ramp, laid over the picture; everything bright feeds the bloom
  for (let i = 0; i < N; i++) {
    const h = heat[i]; let gr = add[i * 3], gg = add[i * 3 + 1], gb = add[i * 3 + 2];
    if (h > .06) {
      rampAt(RAMP.fire, 1 - Math.exp(-(h - .06) * .8), o);
      const a = clamp((h - .06) * 5);
      col[i * 3] += (o[0] - col[i * 3]) * a; col[i * 3 + 1] += (o[1] - col[i * 3 + 1]) * a; col[i * 3 + 2] += (o[2] - col[i * 3 + 2]) * a;
      const e = Math.min(1, h); gr += o[0] * e * .28; gg += o[1] * e * .2; gb += o[2] * e * .1;
    }
    const lum = clamp(Math.max(col[i * 3], col[i * 3 + 1]) - 1.02, 0, .5);      // the sun and hot sky bloom a little too
    glow[i * 3] = gr + lum; glow[i * 3 + 1] = gg + lum * .8; glow[i * 3 + 2] = gb + lum * .5;
    col[i * 3] += add[i * 3]; col[i * 3 + 1] += add[i * 3 + 1]; col[i * 3 + 2] += add[i * 3 + 2];
  }
  const bk = post.bloom || 1;                                       // blasts double the bloom for a few frames
  box(glow, blurB, 3);
  for (let i = 0; i < N * 3; i++) col[i] += blurB[i] * .24 * bk;
  box(blurB, glow, 9);
  for (let i = 0; i < N * 3; i++) col[i] += glow[i] * .3 * bk;
  // anamorphic streak: a wide horizontal smear of the hottest light
  if (post.streak !== 0) {
    for (let y = 0; y < H; y++) {
      let s = 0, sg = 0, sb = 0; const r = 46, row = y * W;
      for (let x = 0; x < W + r; x++) {
        if (x < W) { const k = (row + x) * 3; s += Math.max(0, blurB[k] - .5); sg += Math.max(0, blurB[k + 1] - .5); sb += Math.max(0, blurB[k + 2] - .5); }
        const xo = x - 2 * r; if (xo >= 0) { const k = (row + xo) * 3; s -= Math.max(0, blurB[k] - .5); sg -= Math.max(0, blurB[k + 1] - .5); sb -= Math.max(0, blurB[k + 2] - .5); }
        const xc = x - r; if (xc >= 0 && xc < W) { const k = (row + xc) * 3; col[k] += s * .014; col[k + 1] += sg * .012; col[k + 2] += sb * .012; }
      }
    }
  }
  const gain = post.gain || 1, lift = post.lift || 0, vig = post.vignette === undefined ? .3 : post.vignette, fl = post.flash || 0, ft = post.tint || [1, 1, 1];
  const am = post.amber || 0, g0 = post.grade || [1, 1, 1], tintC = [g0[0] * (1 + .14 * am), g0[1] * (1 + .02 * am), g0[2] * (1 - .22 * am)];   // amber: the whole frame warms just after a blast
  const white = post.white || 0, ca = Math.round(post.ca || 0), shx = Math.round(post.shx || 0), shy = Math.round(post.shy || 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const sx = clamp(x + shx, 0, W - 1), sy = clamp(y + shy, 0, H - 1), j = sy * W + sx;
    let r = col[(sy * W + clamp(sx + ca, 0, W - 1)) * 3], g = col[j * 3 + 1], b = col[(sy * W + clamp(sx - ca, 0, W - 1)) * 3 + 2];
    if (white > 0) {                                                   // inside cloud: billowing white-out
      const n = C.fbm2(x / 70 + (post.whiteSeed || 0), y / 46, 71), a = clamp(white * 1.6 - (1 - white) * n * 1.6);
      rampAt(RAMP.cloud, .62 + .3 * n, o);
      r += (o[0] - r) * a; g += (o[1] - g) * a; b += (o[2] - b) * a;
    }
    // flying through fire / smoke: turbulence rushing outward. Stack several with different speed/scale for depth:
    // w = { a, t, seed, fire, ember, hole (opening at the centre, x300 px), speed (outward rush, 5), scale (feature
    //       frequency, 1; < 1 = big soft near layer), max (alpha cap), tone (ramp shift), streak (share of rays with embers), warm (smoke lit red) }
    if (post.wash) for (const w of post.wash) {
      if (w.a <= 0) continue;
      const ux = x - W / 2, uy = y - H / 2, rr = Math.hypot(ux, uy) + 1, ang = Math.atan2(uy, ux), sp = w.speed || 5, sk = w.scale || 1;
      if (w.streak && rr > 12) {                                        // embers streaking out along the line of flight
        const cell = Math.floor((ang / (2 * Math.PI) + .5) * 240), hs = C.ih(cell, w.seed | 0, 5, 79);
        if (hs < w.streak) { const ph = Math.log(rr) * 1.4 - w.t * sp * .45 + hs * 37, f = ph - Math.floor(ph); if (f < .2) { const k = (1 - f / .2) * w.a * Math.min(1, rr / 60); r += (1.25 - r) * k; g += (.62 - g) * k; b += (.2 - b) * k; } }
      }
      const n = C.fbm3(Math.cos(ang) * 2 * sk + w.seed, Math.sin(ang) * 2 * sk, Math.log(rr) * 2.4 * sk - w.t * sp, 73) * .62 + C.fbm2(x / 38 * sk + w.seed, y / 30 * sk + w.t * 3, 75) * .38;
      const a = clamp(w.a * 1.9 - (1 - w.a) * n * 2.1 - (w.hole ? clamp(1 - rr / (w.hole * 300)) * 1.6 : 0)) * (w.max === undefined ? 1 : w.max);
      if (a <= 0) continue;
      if (w.fire) rampAt(RAMP.fire, Math.max(0, n * 1.5 - .28) + (1 - rr / 300) * .1 + (w.tone || 0), o); else { rampAt(RAMP.smoke, .04 + n * .34 + (w.tone || 0), o); if (w.ember && n > .7) { o[0] += (n - .7) * 3; o[1] += (n - .7) * 1.1; } if (w.warm) { o[0] += w.warm * .42; o[1] += w.warm * .12; o[2] += w.warm * .03; } }   // warm: soot still lit by the fire it swallows
      r += (o[0] - r) * a; g += (o[1] - g) * a; b += (o[2] - b) * a;
    }
    if (post.sight) {                                                  // reflector gunsight: ring, pips and centre dot
      const sx = x - post.sight.x, sy = y - post.sight.y, rr = Math.hypot(sx, sy), a = post.sight.a;
      if (Math.abs(rr - 30) < .7 || rr < 1.2 || ((Math.abs(sx) < .6 || Math.abs(sy) < .6) && rr > 36 && rr < 46)) { r += (1.25 - r) * a; g += (.72 - g) * a; b += (.25 - b) * a; }
      else if (Math.abs(rr - 30) < 2.2) { r += .22 * a; g += .1 * a; }
    }
    if (post.dirt) for (const d of post.dirt) { const dd = Math.hypot(x - d.x, (y - d.y) * 1.2) / d.r; if (dd < 1) { const a = d.a * (1 - dd * dd); r *= 1 - a; g *= 1 - a; b *= 1 - a; } }
    const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2), v = 1 - vig * clamp((vx * vx + vy * vy - .35) / 1.4);
    r = (r * gain + lift) * v * tintC[0]; g = (g * gain + lift) * v * tintC[1]; b = (b * gain + lift) * v * tintC[2];
    r = .44 + (r - .44) * 1.12; g = .44 + (g - .44) * 1.12; b = .44 + (b - .44) * 1.12;   // a little more contrast than the raw render
    if (fl > 0) { r += (ft[0] * 1.1 - r) * fl; g += (ft[1] * 1.1 - g) * fl; b += (ft[2] * 1.1 - b) * fl; }
    if (post.impact) { const l = r * .4 + g * .45 + b * .15; if (post.impact === 1) { const k = l > .5 ? 0 : 1; r = k; g = k * .96; b = k * .84; } else { const k = l > .42 ? 1 : 0; r = k ? 1 : .2; g = k ? .93 : .02; b = k ? .7 : .02; } }
    const d = BAYER[(y & 3) * 4 + (x & 3)] * (post.impact ? 0 : .05);
    out[i] = nearest(clamp(r + d), clamp(g + d), clamp(b + d));
  }
  return out;
}

module.exports = { finish };

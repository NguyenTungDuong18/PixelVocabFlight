'use strict';
// Frame buffers, the dusk sky dome, the broken undercast (cloud at z = 0) over the burning port city (ground.cjs), and cumulus built from
// sphere impostors: depths are smooth-blended per pixel, normals come from the blended depth, so a
// cluster of spheres shades as one billowing mass in banded tones (no "bag of balls").
const C = require('./core.cjs');
const { W, H, TAU, clamp, smooth, ih, noise2, noise2p, noise3, fbm2, RAMP, rampAt } = C;
const Gr = require('./ground.cjs');
const N = W * H;

const SUN_EL = 7 * C.DEG;
const SUN = C.norm([Math.cos(SUN_EL), 0, Math.sin(SUN_EL)]);       // toward the sun: low in the east (+x)
const FOG = 30000;                                                   // metres to 63 percent haze

function newFrame() {
  return {
    col: new Float32Array(N * 3), z: new Float32Array(N), haze: new Float32Array(N * 3), dir: new Float32Array(N * 3),
    cz: new Float32Array(N), ch: new Float32Array(N), ck: new Uint8Array(N), ca: new Float32Array(N),   // ca: cloud alpha (clouds.cjs)
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

// ---------------------------------------------------------------- pass 1: sky, broken undercast, the ground under it
// deck: { off: [x, y] scroll of the cloud deck and the ground (the loop shot slides them under a camera that stays put),
//         loop (ground in its periodic form), time (s, the clock of fires and glitter: loopT in the loop), frame }
// Down the view: the ragged deck at z = 0 (coverage deckCov), and through its holes the smoke blanket over the
// burning districts (z = ZB) and the ground (z = ZG, ground.cjs): land, the port, fires, the sea with its sun glitter.
const tmp = [0, 0, 0], tmp2 = [0, 0, 0], gc = [0, 0, 0], wc = [0, 0, 0], gs = { col: [0, 0, 0], emit: [0, 0, 0], water: 0, fd: 0, oil: 0 }, bs = {};
const ZB = Gr.ZG + 480, SH_X = -Gr.ZG / Gr.TAN_SUN, DEEP = C.hex('#0e1730'), GENV = { loop: false, time: 0, frame: 0 };
// what the water mirrors: per ground pixel of this frame (stamp n) its water share and fire light, filled row by row so a
// water pixel can look up the rows above it for the far bank; and the smoke columns' feet on screen [x, y, half width, length]
const RF = { cam: null, n: 0, st: new Int32Array(N), w: new Float32Array(N), e: new Float32Array(N), cols: [] };
function newRefl(cam) {
  RF.cam = cam; RF.n++; RF.cols = [];
  for (const c of Gr.COLS) if (c.kind === 'A' || c.kind === 'B') { const p = cam.project([c.x, c.y, Gr.ZG]); if (p[2] > 1) { const hw = Math.max(1.5, cam.f * Gr.colR(c, .1) / p[2]); RF.cols.push([p[0], p[1], hw, 8 + hw * 5]); } }
}
function drawSky(fr, cam, deck) {
  const { F, R, U, f, pos } = cam, ox = (deck && deck.off[0]) || 0, oy = (deck && deck.off[1]) || 0;
  const env = { loop: !!(deck && deck.loop), time: (deck && deck.time) || 0, frame: (deck && deck.frame) || 0 }, world = !env.loop;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const a = x + .5 - W / 2, b = H / 2 - y - .5;
    let dx = F[0] * f + R[0] * a + U[0] * b, dy = F[1] * f + R[1] * a + U[1] * b, dz = F[2] * f + R[2] * a + U[2] * b;
    const l = 1 / Math.hypot(dx, dy, dz), cosv = f * l; dx *= l; dy *= l; dz *= l;
    fr.dir[i * 3] = dx; fr.dir[i * 3 + 1] = dy; fr.dir[i * 3 + 2] = dz;
    sky(dx, dy, dz, tmp2, true); fr.haze[i * 3] = tmp2[0]; fr.haze[i * 3 + 1] = tmp2[1]; fr.haze[i * 3 + 2] = tmp2[2];
    let zv = 1e9;
    sky(dx, dy, dz, tmp, false);
    const tg = (Gr.ZG - pos[2]) / dz;
    if (dz < -1e-4 && tg < 160000) {
      const hz = fr.haze, hr = hz[i * 3], hg = hz[i * 3 + 1], hb = hz[i * 3 + 2], down = Math.max(.05, -dz);
      // ---- the ground: always in world position (4 km down the loop's 8 s barely moves it, so the menu loop shows the
      // real south port and still closes); only the deck and its shadows slide
      const gx = pos[0] + dx * tg, gy = pos[1] + dy * tg, lx = gx - ox, ly = gy - oy, footG = tg / (f * down);
      GENV.time = env.time; GENV.frame = env.frame; gs.footH = tg / f;
      Gr.surface(gx, gy, gx, gy, footG, GENV, gs);
      if (cam !== RF.cam) newRefl(cam);
      const cs = deckCov(lx + SH_X, ly, footG * 3, world), shade = 1 - .4 * cs - Gr.columnShadow(gx, gy, Gr.ZG);
      gc[0] = gs.col[0] * shade; gc[1] = gs.col[1] * shade; gc[2] = gs.col[2] * shade;
      let er = gs.emit[0], eg = gs.emit[1], eb = gs.emit[2];
      RF.st[i] = RF.n; RF.w[i] = gs.water; RF.e[i] = er;
      if (gs.water > 0) {
        // water: deep blue plus the sky in it (stylised Fresnel), fire light and burning oil, the sun glitter (Cox-Munk).
        // Looking steeply down it mirrors the dark zenith; only toward grazing (the loop, the horizon) the rivers and docks
        // turn to the warm, bright dusk. Everywhere: ripples, glints, wakes and foam, the shadows of quays, cloud and smoke
        // on it, the far bank's fires hanging down in it as broken columns of light, the smoke columns as dark ones.
        const cosi = -dz, fres = .55 + .45 * Math.pow(1 - cosi, 5);
        { const rz = -dz * .45, rl = 1 / Math.hypot(dx, dy, rz); sky(dx * rl, dy * rl, rz * rl, wc, false); wc[0] = Math.min(wc[0], .8); wc[1] = Math.min(wc[1], .62); wc[2] = Math.min(wc[2], .6); }   // stylised: mirrors the low sunset sky, not the dark zenith
        let r = DEEP[0] + (wc[0] - DEEP[0]) * fres, g = DEEP[1] + (wc[1] - DEEP[1]) * fres, bl = DEEP[2] + (wc[2] - DEEP[2]) * fres;
        const rip = (noise2(gx / 1100, gy / 240, 72) - .5) * clamp(240 / (footG * 2.5)) + (noise2(gx / 300, gy / 60, 73) - .5) * .6 * clamp(60 / (footG * 2.5));   // fades out under ~2.5 px (no moire)
        const gw = gs.footH * 3, gd = Math.max(footG, 30), glint = ih(Math.floor(gx / gw), Math.floor(gy / gd), Math.floor(env.time * 4) % 32, 74) < .07;   // short bright dashes along the ripples, 4 changes a second (32 a loop)
        { const k = 1 + rip * .45 + (glint ? .3 : 0), q = Math.max(0, rip) * .16 + (glint ? .1 : 0); r = r * k + q; g = g * k + q * .9; bl = bl * k + q * 1.1; }   // lighter streaks show on dark water too
        const graze = smooth((.62 - cosi) / .22);
        if (gs.inland > 0 && graze > 0) {
          rampAt(RAMP.port, .05 + .6 * clamp((.6 - cosi) / .35) + rip * .55 + (glint ? .3 : 0), wc);   // brighter toward the far side of the band
          const e = smooth(gx / 3000), k = gs.inland * .9 * (1 - .7 * e) * graze, dm = 1 - .5 * e * gs.inland;   // dark east of x 0: under the menu column in the loop
          r += (wc[0] - r) * k; g += (wc[1] - g) * k; bl += (wc[2] - bl) * k; r *= dm; g *= dm; bl *= dm;
        }
        { const k = (1 - .5 * gs.qsh) * (.5 + .5 * shade); r *= k; g *= k; bl *= k; }
        for (const c of RF.cols) { const d = y - c[1]; if (d > 0 && d < c[3] && Math.abs(x + .5 - c[0]) < c[2]) { const k = 1 - .6 * (1 - d / c[3]); r *= k; g *= k; bl *= k; } }
        if (gs.foam > 0) { rampAt(RAMP.port, .95, wc); const k = Math.min(.8, gs.foam); r += (wc[0] - r) * k; g += (wc[1] - g) * k; bl += (wc[2] - bl) * k; }
        { // the far bank's fire light mirrored: look up the rows above for the first pixel of land (or a ship); wobbling, broken
          const km = Math.round(4 + 11 * clamp((.7 - cosi) / .35)); let rf = 0;
          for (let k = 1; k <= km && k <= y; k++) {
            const xx = Math.min(W - 1, Math.max(0, x + Math.round(.9 * Math.sin(k * 1.3 + (y - k) * .7 + env.time * TAU * 3 / 8)))), j = (y - k) * W + xx;
            if (RF.st[j] !== RF.n) break;
            if (RF.w[j] < .5) { rf = RF.e[j] * (1 - k / (km + 1)); break; }
          }
          if (rf > .15 && ih(x >> 1, y, Math.floor(env.time * 6) % 48, 75) < .62) { const k = Math.min(1, rf) * .5 * gs.water; er += k; eg += k * .45; eb += k * .1; }
        }
        const fl = gs.fd * (.5 - .4 * gs.inland) + gs.oil; rampAt(RAMP.ember, .35 + .5 * Math.min(1, fl), wc); r += (wc[0] - r) * Math.min(.8, fl); g += (wc[1] - g) * Math.min(.8, fl); bl += (wc[2] - bl) * Math.min(.8, fl);
        const hx = SUN[0] - dx, hy = SUN[1] - dy, hzz = SUN[2] - dz, t2 = (hx * hx + hy * hy) / (hzz * hzz);
        let gl = Math.exp(-t2 / .008) * 1.5 + Math.exp(-t2 / .04) * .25;
        if (gl > .01) { const sp = ih(Math.floor(gx / 22), Math.floor(gy / 9), env.frame % 240, 70), tw0 = sp > .55 ? .5 + (sp - .55) * 3.4 : .25 * sp, ws = clamp(25 / footG - .3), tw = .62 + (tw0 - .62) * ws; gl *= tw * (1 - cs) * (1 - gs.oil); }
        const ow = gs.oil > .2 ? gs.oil * (.6 + .5 * ih(Math.floor(gx / 25), Math.floor(gy / 25), env.frame % 240, 71)) : 0;
        er += (gl * 1.05 + ow * 1.4) * gs.water; eg += (gl * .9 + ow * .62) * gs.water; eb += (gl * .62 + ow * .16) * gs.water;
        gc[0] += (r - gc[0]) * gs.water; gc[1] += (g - gc[1]) * gs.water; gc[2] += (bl - gc[2]) * gs.water;
      }
      let fg = (1 - Math.exp(-tg / FOG)) * (1 - .55 * gs.water * gs.inland), ef = Math.exp(-tg / (FOG * 2.2));   // stylised: dock water keeps its colour through the haze
      gc[0] += (hr - gc[0]) * fg; gc[1] += (hg - gc[1]) * fg; gc[2] += (hb - gc[2]) * fg;
      // ---- the smoke blanket over the burning districts, drifting out to sea
      const tbk = (ZB - pos[2]) / dz;
      if (tbk > 0) {
        const bx = pos[0] + dx * tbk, by = pos[1] + dy * tbk;                // world position, like the ground under it
        Gr.districts(bx - 900, by, bx - 900, by, false, true, bs);
        const n = Gr.pn(bx * .4, by, 600, 480, false) * .6 + Gr.pn(bx * .4, by, 150, 481, false) * .4 * Math.min(1, 300 / (tbk / (f * down)));   // streaks along the wind
        const ab = clamp((bs.fd * .8 + bs.city * .2) * (1.5 * n - .35)) * .5 * (1 - .85 * Gr.portMask(bx, by));
        if (ab > 0) {
          rampAt(RAMP.soot, .55 + .3 * n, wc);
          const lt = Math.min(1, bs.fd * 1.2) * .4; rampAt(RAMP.ember, .3 + .4 * bs.fd, tmp2);
          wc[0] += (tmp2[0] - wc[0]) * lt; wc[1] += (tmp2[1] - wc[1]) * lt; wc[2] += (tmp2[2] - wc[2]) * lt;
          const fgb = 1 - Math.exp(-tbk / FOG);
          wc[0] += (hr - wc[0]) * fgb; wc[1] += (hg - wc[1]) * fgb; wc[2] += (hb - wc[2]) * fgb;
          gc[0] += (wc[0] - gc[0]) * ab; gc[1] += (wc[1] - gc[1]) * ab; gc[2] += (wc[2] - gc[2]) * ab;
          ef *= 1 - ab * .8;
        }
      }
      tmp[0] = gc[0] + er * ef; tmp[1] = gc[1] + eg * ef; tmp[2] = gc[2] + eb * ef;
      zv = tg * cosv;
      // ---- the broken deck
      if (pos[2] > 0) {
        const t = -pos[2] / dz, px = pos[0] + dx * t - ox, py = pos[1] + dy * t - oy;
        const foot = t / (f * down);
        let c = deckCov(px, py, foot, world), cs = deckCov(px + 160 + foot, py, foot, world);   // cs: one step toward the sun
        c = 1 - (1 - c) * (.3 + .7 * clamp((down - .03) / .14));            // seen edge-on the deck closes up
        let rim = 0;
        if (env.loop) {                                                     // the window onto the port, fixed on screen (sky.portHoleE)
          const tq = (Gr.ZG - pos[2]) / dz, gx = pos[0] + dx * tq, gy = pos[1] + dy * tq, e = portHoleE(gx, gy), es = portHoleE(gx + 420, gy);
          const op = 1 - smooth((e - .75) / .45), ops = 1 - smooth((es - .75) / .45);
          c *= 1 - .96 * op; cs *= 1 - .96 * ops;
        }
        rim = clamp((c - cs) * 3, -1, 1);                                   // > 0: a wall facing the sun across a hole; < 0: the far wall, in shade
        if (c > 0) {
          const h0 = deckH(px, py, foot), h1 = deckH(px + 140, py, foot);
          c *= .5 + .5 * smooth((h0 - .18) / .32);                          // the cloud thins in the troughs between its cells: the ground glows through
          let L = .34 + .32 * h0 + clamp((h0 - h1) * 3.2, -.16, .24) - (1 - c) * .1 + (rim > 0 ? .34 * rim : .14 * rim);
          rampAt(RAMP.cloud, L, tmp2);
          // soot stains round the columns that punch through, and their long shadows across the deck
          const wx = px + ox, wy = py + oy, st = stain(wx, wy), sh = Gr.columnShadow(wx, wy, 0);
          if (st > 0) { rampAt(RAMP.soot, .55 + .2 * h0, wc); tmp2[0] += (wc[0] - tmp2[0]) * st; tmp2[1] += (wc[1] - tmp2[1]) * st; tmp2[2] += (wc[2] - tmp2[2]) * st; }
          if (sh > 0) { const k = 1 - sh * .55; tmp2[0] *= k; tmp2[1] *= k; tmp2[2] *= k * 1.05; }
          const fd = 1 - Math.exp(-t / FOG_DECK);
          tmp2[0] += (hr - tmp2[0]) * fd; tmp2[1] += (hg - tmp2[1]) * fd; tmp2[2] += (hb - tmp2[2]) * fd;
          tmp[0] += (tmp2[0] - tmp[0]) * c; tmp[1] += (tmp2[1] - tmp[1]) * c; tmp[2] += (tmp2[2] - tmp[2]) * c;
          if (c > .5) zv = t * cosv;
        }
      }
      // far off, the light of the burning belt glows in the haze over it, cloud or not: a red band along the horizon
      const hg2 = gs.fd * .3 * smooth((tg - 9000) / 16000) * Math.exp(-tg / 90000);
      if (hg2 > 0) { tmp[0] += hg2 * .95; tmp[1] += hg2 * .36; tmp[2] += hg2 * .1; }
    }
    fr.col[i * 3] = tmp[0]; fr.col[i * 3 + 1] = tmp[1]; fr.col[i * 3 + 2] = tmp[2];
    fr.z[i] = zv; fr.cz[i] = 1e9; fr.ch[i] = 0; fr.ck[i] = 0; fr.heat[i] = 0; fr.gid[i] = -1; fr.gz[i] = 1e9;
    fr.add[i * 3] = fr.add[i * 3 + 1] = fr.add[i * 3 + 2] = 0;
  }
}
// Coverage 0..1 of the broken deck at deck point (x, y): tiles every DECK_P along y; in world shots a wide clearing
// over the port (so the whip down in shot 2 sees the city). foot: metres per pixel (small rags fade far off).
function deckCov(x, y, foot, world) {
  // world: broken cloud that never repeats; loop: cloud streets along the flight that tile every DECK_P. Their edges wave
  // (three harmonics of DECK_P, phase wandering with x) so they never rule straight lines to the horizon; the y-periodic
  // parts fade out only far off (there they would line up into rows of dashes), and the edge softens with distance.
  const wm = world ? 0 : clamp(1.6 - foot / 220), ph = world ? 0 : noise2(x / 2500, 3.5, 62) * TAU, q = y * TAU / DECK_P;
  const warp = world ? 0 : wm * (330 * Math.sin(q + ph) + 170 * Math.sin(2 * q + ph * 1.7 + 1) + 90 * Math.sin(3 * q + ph * 2.3 + 2));
  const a = world ? noise2(x / 2600 + 9, y / 2300, 55) * .55 + noise2(x / 1100, y / 1000, 58) * .45
    : noise2((x + warp) / 1500 + 9, .5, 55) * .7 + (.5 + (noise2p(x / 1100, y / 1200, 2, 60) - .5) * wm) * .12 + (.5 + (noise2p(x / 700, y / 600, 4, 58) - .5) * wm) * .18;
  const wr = world ? clamp(300 / (foot * 4) - .2) : clamp(1.5 - foot / 90), n = a + (wr ? ((world ? noise2(x / 300, y / 300, 59) : noise2p(x / 300, y / 300, 8, 59)) - .5) * .26 * wr : 0);
  let c = smooth((n - TH[world ? 1 : 0]) / (.07 + .12 * clamp(foot / 250)));
  if (world && c > 0) c *= 1 - .92 * clearing(x, y);
  if (!world) c *= 1 - .8 * smooth((-800 - x - warp * .7) / 2200);   // the loop: mostly open over the burning belt (right half of shot 8)
  return c * (1 - .85 * smooth((x - 9000) / 7000));                   // the sky clears over the open sea (sun glitter)
}
const TH = [.45, .45];
const FOG_DECK = 18000;                                              // the deck hazes out sooner than the ground (aerial perspective of white cloud)
// clear sky over the port (the whip down of shot 2) and over the coast south-east (the turning fight of shot 6 looks there)
function clearing(x, y) {
  const e = (noise2(x / 900, y / 900, 66) - .5) * 1800;
  return Math.max(smooth((Math.min(x + 6800, -300 - x, y + 4600, 4300 - y) + e) / 900), smooth((Math.min(x - 1600, 6500 - x, y + 6500, -300 - y) + e) / 700));
}
// The loop's window onto the port: elliptic distance of a GROUND point (world, not slid) from Gr.LOOP_PORT, 1 = rim of
// the hole (~130 x 50 px round screen (330, 238) from the shot-8 camera); the edge is ragged but fixed in place.
function portHoleE(gx, gy) {
  const P = Gr.LOOP_PORT;
  return Math.hypot((gx - P.x) / (P.rx * .7), (gy - P.y) / (P.ry * 1.2)) + (noise2(gx / 900, gy / 900, 68) - .5) * .3;
}
// brown soot on the deck where a column comes through it (world position)
function stain(x, y) {
  let s = 0;
  for (const c of Gr.COLS) if (c.top > 300) { const d = Math.hypot(x - c.x - Gr.lean(-Gr.ZG), (y - c.y) * 1.3), R = c.r * 7; if (d < R) s = Math.max(s, smooth(1 - d / R) * (.35 + .4 * noise2(x / 300, y / 300, 67))); }
  return s;
}
// The deck tiles every DECK_P metres along y (the loop shot scrolls it by whole periods).
const DECK_P = 2400;
function deckH(x, y, foot = 1) {
  const v = y / DECK_P, t = v - Math.floor(v), ya = t * DECK_P, yb = ya - DECK_P;
  const w7 = clamp(700 / (foot * 5) - .2), w4 = clamp(430 / (foot * 5) - .2), w2 = clamp(200 / (foot * 5) - .2), w1 = clamp(120 / (foot * 5) - .2);   // features smaller than a few pixels fade to their mean (no moire toward the horizon)
  // stratocumulus: broad swells, then billowed cells (bright domes, dark creases between them), then curd
  const h = (yy) => { const b = w4 ? noise2(x / 430, yy / 430, 53) : .5; return noise2(x / 1500, yy / 1500, 51) * .4 + (w7 ? (noise2(x / 700, yy / 700, 52) - .5) * w7 : 0) * .35 + .3 + (Math.abs(2 * b - 1) - .5) * w4 * .4 + (w2 ? (noise2(x / 200, yy / 200, 56) - .5) * w2 * .22 : 0) + (w1 ? (noise2(x / 120, yy / 120, 57) - .5) * w1 * .12 : 0); };
  return h(ya) * (1 - t) + h(yb) * t;
}

module.exports = { N, SUN, FOG, DECK_P, newFrame, sky, drawSky, deckH, deckCov, clearing, portHoleE };

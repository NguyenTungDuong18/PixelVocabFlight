// node Tools/BlenderForge/handChecks.cjs [--js] [--png] [-v]
// Checks of the opening's hands on the real mesh, PASS/FAIL per item (exit code 1 on any FAIL):
//   1 no part of either hand (forearm included) more than 0.3 px inside the tin body, the lid at that
//     frame's angle, or the table;
//   2 every contact listed for a frame (story/openingHands.cjs, pose.contacts) is 0..1 px off its surface
//     (-0.3 allowed, as 1);
//   3 held contacts do not slide: the 4 vertices touching at the start of the hold move <= 0.5 px per
//     frame (on the lid: in the lid's own frame);
//   4 rigid phalanges: the farthest pair of vertices that follow only one bone keeps its rest length
//     within 3% in every frame (each finger bone, thumb bones, palm);
//   5 joint limits (MCP -20..90, PIP 0..100, DIP -10..70, wrist ext/flex <= 70, radial <= 20, ulnar <= 35,
//     thumb base/MP/IP in range) and DIP = 0.7 PIP (little 0.6) +-0.2 on fingers not touching anything;
//   6 smooth motion: no vertex jumps back and forth (two reversals in a row over 0.5 px) except the
//     lid's bounce; the reaches and the return decelerate (speed peaks in the first half, then falls);
//     with --png: held frames identical to the pixel (P1.04 12-19, P1.05 24-29, P1.04 19 = P1.05 0);
//   7 the resting hand (P1.05 23-29): fingertips, heel of the palm and thumb on the table, the hollow of the palm
//     >= 2 px off it, the fingers in a cascade (each ulnar finger bends more than the index) and closed, the
//     thumb beside the index.
// Vertices: `node Tools/BlenderForge/render.cjs verts` (read back from Blender), or --js (posed here, the same).
const fs = require('fs'), path = require('path'), os = require('os');
const RIG = require('../PixelForge/story/handRig.cjs');
const H = require('../PixelForge/story/hand.cjs');
const OH = require('../PixelForge/story/openingHands.cjs');

const args = process.argv.slice(2), JS = args.includes('--js'), PNG = args.includes('--png'), VERB = args.includes('-v');
const SC = { hand: OH.handScenes(), lid: OH.lidScenes() };
const V = JS ? null : JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'wordwing-opening-verts', 'verts.json'), 'utf8'));
const vertsOf = (part, i, k) => V ? V[`${part}_${i}`][k] : Array.from(RIG.posed(SC[part][i].hands[k]).co);
const FR = [];                                                    // every frame: { part, i, deg, hands: [{ pose, co }] }
for (const part of ['hand', 'lid']) SC[part].forEach((s, i) => FR.push({ part, i, deg: s.deg, hands: s.hands.map((pose, k) => ({ pose, co: vertsOf(part, i, k) })) }));
const R = RIG.load();
const armOf = pose => R[pose.left ? 'L' : 'R'];
const P = (co, i) => [co[i * 3], co[i * 3 + 1], co[i * 3 + 2]];
const name = f => `${f.part === 'hand' ? 'P1.04' : 'P1.05'} f${f.i}`;
const out = [];
const report = (n, ok, msg, detail = []) => { out.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${msg}`); if (!ok || VERB) for (const d of detail.slice(0, VERB ? 200 : 14)) out.push('     ' + d); };

// ---- 1 penetration
{
  let worst = { d: 1e9 }; const bad = [];
  for (const f of FR) {
    const lid = OH.lidSolid(f.deg);
    f.hands.forEach(({ co }, k) => {
      let m = { d: 1e9 };
      for (let i = 0; i < co.length / 3; i++) {
        const p = P(co, i);
        for (const [d, s] of [[OH.bodySolid(...p), 'body'], [lid(...p), 'lid'], [p[2], 'table']]) if (d < m.d) m = { d, s, part: armOf(f.hands[k].pose).part[i] };
      }
      if (m.d < worst.d) worst = { ...m, at: `${name(f)} ${k ? 'R' : 'L'}` };
      if (m.d < -.3) bad.push(`${name(f)} ${k ? 'R' : 'L'} ${m.d.toFixed(2)} px into the ${m.s} (part ${m.part})`);
    });
  }
  report(1, !bad.length, `penetration: deepest ${worst.d.toFixed(2)} px (${worst.at}, ${worst.s})`, bad);
}

// ---- 2 contacts in 0..1 px; 3 held contacts do not slide
{
  const bad = [], slide = [];
  let n = 0, maxSlide = 0;
  const regionMin = (f, k, reg, s) => {
    const sdf = OH.surface(s, f.deg), co = f.hands[k].co;
    let m = 1e9; for (const i of armOf(f.hands[k].pose).regions[reg]) m = Math.min(m, sdf(...P(co, i)));
    return m;
  };
  for (const f of FR) f.hands.forEach((h, k) => (h.pose.contacts || []).forEach(([reg, s]) => {
    n++; const d = regionMin(f, k, reg, s);
    if (d < -.3 || d > 1) bad.push(`${name(f)} ${k ? 'R' : 'L'} ${reg} -> ${s}: ${d.toFixed(2)} px`);
  }));
  report(2, !bad.length, `contacts: ${n} contact-frames, all within -0.3..1 px`, bad);
  // runs of consecutive frames (within a part, and P1.04 19 -> P1.05 0) holding the same contact
  const seq = FR;                                              // P1.04 0..19 then P1.05 0..29
  for (let a = 0; a + 1 < seq.length; a++) for (let k = 0; k < 2; k++) {
    const A = seq[a], B = seq[a + 1];
    if (A.part !== B.part && !(A.part === 'hand' && A.i === 19)) continue;
    const ca = A.hands[k].pose.contacts || [], cb = B.hands[k].pose.contacts || [];
    for (const [reg, s, held] of cb) {
      if (!held || !ca.some(([r2, s2, h2]) => r2 === reg && s2 === s && h2)) continue;
      // the 4 vertices touching in the frame where this hold began
      let st = a; while (st > 0) { const Z = seq[st - 1], cz = Z.hands[k].pose.contacts || []; if ((Z.part === seq[st].part || (Z.part === 'hand' && Z.i === 19)) && cz.some(([r2, s2, h2]) => r2 === reg && s2 === s && h2)) st--; else break; }
      const S = seq[st], sdf = OH.surface(s, S.deg), arm = armOf(S.hands[k].pose);
      const idx = arm.regions[reg].map(i => [sdf(...P(S.hands[k].co, i)), i]).sort((x, y) => x[0] - y[0]).slice(0, 4).map(x => x[1]);
      const loc = (fr, p) => s === 'lid' ? OH.withLid(p, fr.deg, 0) : p;
      for (const i of idx) {
        const pa = loc(A, P(A.hands[k].co, i)), pb = loc(B, P(B.hands[k].co, i)), d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
        maxSlide = Math.max(maxSlide, d);
        if (d > .5) slide.push(`${name(A)} -> ${name(B)} ${k ? 'R' : 'L'} ${reg} on ${s}: vertex ${i} slides ${d.toFixed(2)} px`);
      }
    }
  }
  report(3, !slide.length, `held contacts: largest slide ${maxSlide.toFixed(2)} px per frame`, slide);
}

// ---- 4 rigid bones
{
  const bad = []; let worst = 0;
  for (const side of 'RL') {
    const arm = R[side], groups = {};
    arm.weights.forEach((ws, i) => { if (ws.length === 1 && arm.part[i] !== 6) (groups[ws[0][0]] = groups[ws[0][0]] || []).push(i); });
    const pairs = Object.entries(groups).filter(([, ix]) => ix.length >= 2).map(([u, ix]) => {
      let best = [0, ix[0], ix[1]];
      for (const a of ix) for (const b of ix) { const d = Math.hypot(...[0, 1, 2].map(j => arm.co[a][j] - arm.co[b][j])); if (d > best[0]) best = [d, a, b]; }
      return { u: RIG.UNITS[u], rest: best[0], a: best[1], b: best[2] };
    });
    for (const f of FR) f.hands.forEach(({ pose, co }) => {
      if (!!pose.left !== (side === 'L')) return;
      const s = RIG.posed(pose, []).s;
      for (const q of pairs) {
        const d = Math.hypot(...[0, 1, 2].map(j => co[q.a * 3 + j] - co[q.b * 3 + j])), e = Math.abs(d / (q.rest * s) - 1);
        worst = Math.max(worst, e);
        if (e > .03) bad.push(`${name(f)} ${side} ${q.u}: ${(e * 100).toFixed(1)}%`);
      }
    });
  }
  report(4, !bad.length, `rigid bones: largest change ${(worst * 100).toFixed(2)}% of rest length`, bad);
}

// ---- 5 joint limits (code pose angles; the mesh bones follow them)
const D = 180 / Math.PI;
function wristAngles(pose) {
  const F = H.frame(pose), s = H.sleeveLine(pose), a = [0, 1, 2].map(i => s.start[i] - s.end[i]), l = Math.hypot(...a), f = a.map(v => v / l);
  const fu = f[0] * F.U[0] + f[1] * F.U[1] + f[2] * F.U[2], fv = f[0] * F.V[0] + f[1] * F.V[1] + f[2] * F.V[2], fw = f[0] * F.W[0] + f[1] * F.W[1] + f[2] * F.W[2];
  return { ext: Math.atan2(-fw, fu) * D, rad: Math.atan2(-fv, fu) * D };     // + extension, + radial deviation
}
{
  const bad = [], rows = [];
  for (const f of FR) f.hands.forEach(({ pose }, k) => {
    const touch = new Set((pose.contacts || []).map(([n]) => +(n.match(/^(?:pad|tip|mid)(\d)$/) || [])[1]).filter(Boolean));
    const w = wristAngles(pose), id = `${name(f)} ${k ? 'R' : 'L'}`;
    rows.push(`${id.padEnd(13)} ${pose.f.map(([m, p, d]) => `${m.toFixed(0)}/${p.toFixed(0)}/${d.toFixed(0)}`).join(' ')}  wrist ${w.ext.toFixed(0)}/${w.rad.toFixed(0)}  thumb ${pose.th.map(v => v.toFixed(0)).join('/')} r${(pose.thRoll || 0).toFixed(0)}`);
    pose.f.forEach(([m, p, d], j) => {
      if (m < -20 || m > 90) bad.push(`${id} finger ${j + 1} MCP ${m.toFixed(1)}`);
      if (p < 0 || p > 100) bad.push(`${id} finger ${j + 1} PIP ${p.toFixed(1)}`);
      if (d < -10 || d > 70) bad.push(`${id} finger ${j + 1} DIP ${d.toFixed(1)}`);
      const r = j === 3 ? .6 : .7;
      if (!touch.has(j + 1) && Math.abs(d - r * p) > .2 * Math.max(p, 15)) bad.push(`${id} finger ${j + 1} DIP ${d.toFixed(1)} vs PIP ${p.toFixed(1)} (free finger)`);
    });
    if (w.ext > 70 || w.ext < -70) bad.push(`${id} wrist extension ${w.ext.toFixed(1)}`);
    if (w.rad > 20 || w.rad < -35) bad.push(`${id} wrist deviation ${w.rad.toFixed(1)}`);
    const [ab, fl, mp, ip] = pose.th;
    if (ab < -30 || ab > 60 || fl < -50 || fl > 45 || mp < 0 || mp > 50 || ip < -15 || ip > 80 || Math.abs(pose.thRoll || 0) > 60) bad.push(`${id} thumb ${pose.th.map(v => v.toFixed(0)).join('/')} r${(pose.thRoll || 0).toFixed(0)}`);
  });
  report(5, !bad.length, 'joint limits (MCP/PIP/DIP per finger, wrist ext/radial, thumb base/MP/IP/turn)', VERB ? rows.concat(bad) : bad);
}

// ---- 6 smooth motion
{
  const bad = [];
  const BOUNCE = new Set(['lid_15', 'lid_16', 'lid_17']);          // the lid's bounce off its stop (and the hand letting go)
  for (let k = 0; k < 2; k++) for (const part of ['hand', 'lid']) {
    const fr = FR.filter(f => f.part === part);
    const n = fr[0].hands[k].co.length / 3;
    for (let t = 0; t + 3 < fr.length; t++) {
      if (BOUNCE.has(`${part}_${t + 1}`) || BOUNCE.has(`${part}_${t + 2}`)) continue;
      for (let i = 0; i < n; i += 7) {
        const p = [0, 1, 2, 3].map(j => P(fr[t + j].hands[k].co, i)), d = [0, 1, 2].map(j => p[j + 1].map((v, q) => v - p[j][q]));
        const L = d.map(v => Math.hypot(...v)), cos = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
        if (L[0] > .5 && L[1] > .5 && L[2] > .5 && cos(d[0], d[1]) < -.3 && cos(d[1], d[2]) < -.3) { bad.push(`${part} ${k ? 'R' : 'L'} frames ${t}-${t + 3}: vertex ${i} jitters`); break; }
      }
    }
  }
  // reaches: wrist speed per frame peaks in the first half, then does not rise again
  const REACHES = [['hand', 1, 0, 6], ['hand', 0, 3, 9], ['lid', 1, 16, 21]];
  const speeds = [];
  for (const [part, k, a, b] of REACHES) {
    const fr = FR.filter(f => f.part === part), w = i => H.frame(fr[i].hands[k].pose).P;
    const v = []; for (let i = a; i < b; i++) v.push(Math.hypot(...w(i + 1).map((x, q) => x - w(i)[q])));
    const pk = v.indexOf(Math.max(...v));
    speeds.push(`${part} ${k ? 'R' : 'L'} ${a}-${b}: ${v.map(x => x.toFixed(0)).join(' ')}`);
    if (pk > (v.length - 1) / 2) bad.push(`${part} ${k ? 'R' : 'L'} reach ${a}-${b}: speed peaks late (${v.map(x => x.toFixed(1)).join(' ')})`);
    for (let i = pk + 1; i < v.length; i++) if (v[i] > v[i - 1] + .3) bad.push(`${part} ${k ? 'R' : 'L'} reach ${a}-${b}: speeds up again at ${a + i} (${v.map(x => x.toFixed(1)).join(' ')})`);
  }
  if (PNG) {
    const { readPng } = require('../PixelForge/story/pngRead.cjs');
    const dir = path.join(__dirname, '../../Game/Assets/_Project/Art/Resources/Pixel/Story/Opening');
    const img = (n, i) => fs.readFileSync(path.join(dir, `cut_open_tin_${n}_${i}.png`));
    const same = (a, b) => Buffer.compare(img(...a), img(...b)) === 0 || (() => { const A = readPng(path.join(dir, `cut_open_tin_${a[0]}_${a[1]}.png`)).data, B = readPng(path.join(dir, `cut_open_tin_${b[0]}_${b[1]}.png`)).data; let n = 0; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) n++; return n === 0; })();
    const holds = [];
    for (let i = 13; i < 20; i++) holds.push([['hand', 12], ['hand', i]]);
    for (let i = 25; i < 30; i++) holds.push([['lid', 24], ['lid', i]]);
    holds.push([['hand', 19], ['lid', 0]], [['lid', 0], ['lid', 1]], [['lid', 6], ['lid', 7]]);
    for (const [a, b] of holds) if (!same(a, b)) bad.push(`held frames differ: ${a.join(' ')} vs ${b.join(' ')}`);
  }
  report(6, !bad.length, `smooth motion (no jitter, reaches decelerate${PNG ? ', held frames identical' : ''})`, VERB ? speeds.concat(bad) : bad);
}

// ---- 7 resting hand
{
  const bad = [], f = FR.find(x => x.part === 'lid' && x.i === 23), { pose, co } = f.hands[1], arm = armOf(pose);
  const zmin = reg => Math.min(...arm.regions[reg].map(i => co[i * 3 + 2]));
  // what rests on the table: the curled fingertips, the heel of the palm (its ulnar side rolled down) and
  // the thumb on its radial side (openingHands REST_C)
  for (const reg of ['tip1', 'tip2', 'tip3', 'tip4', 'heel', 'thumb']) { const z = zmin(reg); if (z < -.3 || z > 1) bad.push(`${reg} ${z.toFixed(2)} px off the table`); }
  if (zmin('centre') < 2) bad.push(`hollow of the palm ${zmin('centre').toFixed(2)} px off the table`);
  const tot = pose.f.map(([m, p, d]) => m + p + d);
  // cascade: the ulnar fingers bend more than the index (the mesh's short little finger sits closed beside
  // the ring only with less PIP than the ring, so the order among middle/ring/little is not imposed)
  for (let j = 1; j < 4; j++) if (tot[j] < tot[0] + 5) bad.push(`no cascade: finger ${j + 1} bends ${tot[j].toFixed(0)}, index ${tot[0].toFixed(0)}`);
  // closed: neighbouring fingertips (pad centres) no further apart across the hand than 1.4 finger widths
  const c = reg => { const ix = arm.regions[reg]; return [0, 1, 2].map(j => ix.reduce((a, i) => a + co[i * 3 + j], 0) / ix.length); };
  const tips = [1, 2, 3, 4].map(k => c('pad' + k)), gapsTxt = [];
  const V = H.frame(pose).V;
  for (let j = 0; j < 3; j++) { const d = Math.abs([0, 1, 2].reduce((a, q) => a + (tips[j + 1][q] - tips[j][q]) * V[q], 0)); gapsTxt.push(d.toFixed(1)); if (d > 19) bad.push(`fingertips ${j + 1}-${j + 2} ${d.toFixed(1)} px apart (fanned)`); }
  // thumb beside the index: thumb tip centre within 19 px of the axis of the index's proximal or middle
  // phalanx (touching skin to skin is ~13: index radius ~7 + thumb tip ~6; up to ~6 px of skin between: on the table the
  // thumb lies on its side just off the curled index, which is raised on its tip; closer and it hides under it, 8c)
  const J = RIG.posed(pose, []).joints.fingers[0], tt = c('thTip');
  const segD = (a, b) => { const ab = b.map((v, i) => v - a[i]), t = Math.max(0, Math.min(1, ab.reduce((s, v, i) => s + v * (tt[i] - a[i]), 0) / ab.reduce((s, v) => s + v * v, 0))); return Math.hypot(...tt.map((v, i) => v - a[i] - ab[i] * t)); };
  const dt = Math.min(segD(J[0], J[1]), segD(J[1], J[2]));
  if (dt > 19) bad.push(`thumb tip ${dt.toFixed(1)} px from the index`);
  report(7, !bad.length, `resting hand: contacts on the table, palm hollow ${zmin('centre').toFixed(1)} px up, flexion ${tot.map(v => v.toFixed(0)).join('<')}, fingertip gaps ${gapsTxt.join('/')} px, thumb ${dt.toFixed(1)} px from the index`, bad);
}

// ---- 8b fingers closed: adjacent proximal phalanges <= 10 deg apart in the palm plane (the fan; flexion
// differences are not spread), <= 14 at the reach's widest opening (P1.04 R f4, L f7)
const PEAK = new Set(['hand 4 1', 'hand 7 0']);
{
  const bad = []; let worst = 0, at = '';
  for (const f of FR) f.hands.forEach(({ pose }, k) => {
    const J = RIG.posed(pose, []).joints.fingers, W = H.frame(pose).W, lim = PEAK.has(`${f.part} ${f.i} ${k}`) ? 14 : 10;
    const dir = j => { const d = [0, 1, 2].map(q => J[j][1][q] - J[j][0][q]), n = d[0] * W[0] + d[1] * W[1] + d[2] * W[2], p = d.map((v, q) => v - n * W[q]), l = Math.hypot(...p); return p.map(v => v / l); };
    for (let j = 0; j < 3; j++) {
      const a = dir(j), b = dir(j + 1), ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * D;
      if (ang > worst) { worst = ang; at = `${name(f)} ${k ? 'R' : 'L'} ${j + 1}-${j + 2}`; }
      if (ang > lim) bad.push(`${name(f)} ${k ? 'R' : 'L'} fingers ${j + 1}-${j + 2} ${ang.toFixed(1)} deg apart (limit ${lim})`);
    }
  });
  report('8b', !bad.length, `fingers closed: widest fan ${worst.toFixed(1)} deg (${at})`, bad);
}

// ---- 8c holding (P1.04 12-19) and resting (P1.05 23-29): neighbouring fingertips <= 5 px apart (skin to
// skin, unless the tin is between them); fingers on the table curled (MCP -> tip seen from above <= 75% of
// the finger's length); the thumb shows (>= THUMB_PX px of thumb skin in the render, needs the G-buffer)
const THUMB_PX = 150, THUMB_FREE = new Set(['finger1-2', 'finger1-3']);   // the free thumb (not its metacarpal in the thenar): ~450 px at 1x seen whole, 150 = a third
{
  const bad = []; const rows = [];
  const SET = FR.filter(f => (f.part === 'hand' && f.i >= 12) || (f.part === 'lid' && f.i >= 23));
  const solid = p => Math.min(OH.bodySolid(...p), p[2]);
  const gbuf = !JS && fs.existsSync(path.join(__dirname, '../../SourceAssets/Blender/OpeningHands/hand_12_pos.png'));
  const { readPng } = require('../PixelForge/story/pngRead.cjs');
  for (const f of SET) f.hands.forEach(({ pose, co }, k) => {
    if (f.part === 'lid' && k === 0) return;                     // the left hand there is the hold, checked in P1.04
    const id = `${name(f)} ${k ? 'R' : 'L'}`, arm = armOf(pose), J = RIG.posed(pose, []).joints.fingers;
    const gaps = [], G = RIG.fingerGaps(pose, co);
    for (let j = 0; j < 3; j++) {
      const m = G[j], ca = J[j][3], cb = J[j + 1][3];
      let wall = false; for (let t = .1; t < 1; t += .1) if (solid(ca.map((v, q) => v + (cb[q] - v) * t)) < 0) wall = true;
      gaps.push(m.toFixed(1) + (wall ? '(wall)' : ''));
      if (m > 5 && !wall) bad.push(`${id} fingertips ${j + 1}-${j + 2} ${m.toFixed(1)} px apart`);
    }
    const onTable = new Set((pose.contacts || []).filter(([n, s]) => s === 'table' && /^(pad|tip)\d$/.test(n)).map(([n]) => +n.slice(-1) - 1));
    const ratios = [];
    for (const j of onTable) {
      const L = [0, 1, 2].reduce((a, q) => a + Math.hypot(...J[j][q + 1].map((v, i) => v - J[j][q][i])), 0), r = Math.hypot(J[j][3][0] - J[j][0][0], J[j][3][1] - J[j][0][1]) / L;
      ratios.push(`${j + 1}:${(r * 100).toFixed(0)}%`);
      if (r > .75) bad.push(`${id} finger ${j + 1} on the table straight: seen ${(r * 100).toFixed(0)}% of its length`);
    }
    let thumb = '';
    if (gbuf) {
      const base = path.join(__dirname, `../../SourceAssets/Blender/OpeningHands/${f.part}_${f.i}_`), pos = readPng(base + 'pos.png'), ida = readPng(base + 'idao.png');
      const W = pos.w, Hh = pos.h, sc = W / 480, ch = pos.ch, ci = ida.ch;
      const val = (img, c, i, q) => img.data[i * c + q];
      // nearest vertex part per covered pixel (grid hash of the hand's vertices)
      const G = new Map(), key = (x, y, z) => `${Math.floor(x / 4)},${Math.floor(y / 4)},${Math.floor(z / 4)}`;
      for (let i = 0; i < co.length / 3; i++) { const kk = key(co[i * 3], co[i * 3 + 1], co[i * 3 + 2]); (G.get(kk) || G.set(kk, []).get(kk)).push(i); }
      let n = 0;
      for (let i = 0; i < W * Hh; i++) {
        if (val(pos, ch, i, 3) < .5 || Math.round(val(ida, ci, i, 0) * 10) !== k + 1) continue;
        const p = [val(pos, ch, i, 0) * 512, val(pos, ch, i, 1) * 512, val(pos, ch, i, 2) * 320 - 64];
        let best = [1e9, -1];
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const v of G.get(`${Math.floor(p[0] / 4) + a},${Math.floor(p[1] / 4) + b},${Math.floor(p[2] / 4) + c}`) || []) {
          const d = Math.hypot(co[v * 3] - p[0], co[v * 3 + 1] - p[1], co[v * 3 + 2] - p[2]); if (d < best[0]) best = [d, v];
        }
        if (best[1] < 0 || !THUMB_FREE.has(RIG.UNITS[arm.unit[best[1]]])) continue;
        // hidden behind the tin? (the camera looks along -(0, .5, 1): screen row = y - z/2)
        let hid = false; for (let t = 1; t < 160 && !hid; t += 1) if (OH.bodySolid(p[0], p[1] + .5 * t, p[2] + t) < 0) hid = true;
        if (!hid) n++;
      }
      n /= sc * sc;
      thumb = ` thumb ${n.toFixed(0)} px`;
      if (n < THUMB_PX) bad.push(`${id} thumb shows ${n.toFixed(0)} px (< ${THUMB_PX})`);
    }
    rows.push(`${id} tip gaps ${gaps.join('/')} on-table ${ratios.join(' ')}${thumb}`);
  });
  report('8c', !bad.length, `holding and resting hands closed and curled${gbuf ? ', thumb visible' : ' (thumb: needs the G-buffer, skipped with --js)'}`, VERB ? rows.concat(bad) : bad);
}

// ---- 8d no finger held straight in the air: PIP >= 15 on every finger not pressing a surface
{
  const bad = [];
  for (const f of FR) f.hands.forEach(({ pose }, k) => {
    const touch = new Set((pose.contacts || []).map(([n]) => +(n.match(/^(?:pad|tip|mid)(\d)$/) || [])[1]).filter(Boolean));
    pose.f.forEach(([, p], j) => { if (!touch.has(j + 1) && p < 15) bad.push(`${name(f)} ${k ? 'R' : 'L'} finger ${j + 1} PIP ${p.toFixed(1)}`); });
  });
  report('8d', !bad.length, 'no straight fingers (PIP >= 15 unless pressing)', bad);
}

console.log(out.join('\n'));
process.exitCode = out.some(l => l.startsWith('FAIL')) ? 1 : 0;

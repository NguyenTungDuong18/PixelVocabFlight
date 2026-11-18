'use strict';
// The opening's hands as a real mesh: handRig.cjs poses the MakeHuman (CC0) arm for each pose of
// openingHands.cjs (dual-quaternion skinning, stiff finger weights); Tools/BlenderForge renders those
// vertices into G-buffer passes under SourceAssets/Blender/OpeningHands/:
//   <part>_<i>_pos.png   16-bit world point (x/512, y/512, (z+64)/320), alpha = hand covers the pixel
//   <part>_<i>_nrm.png   16-bit normal * .5 + .5
//   <part>_<i>_idao.png  R: hand number / 10 (1-based, order of scene.hands), G: occlusion among the hands
//   <part>_<i>_depth.png 16-bit light-space depth of the hands (shadow map, axes in meta.json)
// meta.json holds the posed mesh joints per frame and the hash of the poses it was rendered from.
// If the cache is missing or stale the opening falls back to the code-drawn SDF hands (with a warning).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { readPng } = require('./pngRead.cjs');
const H = require('./hand.cjs');
const OH = require('./openingHands.cjs');
const RIG = require('./handRig.cjs');

const DIR = path.join(__dirname, '../../../SourceAssets/Blender/OpeningHands');
const r3 = a => a.map(v => +v.toFixed(3));

// Every frame's hands as the posed mesh (handRig.cjs) + its joints + the sleeve (game coords): the
// input of the Blender render (faces once per side).
function exportPoses() {
  const R = RIG.load();
  const hand = pose => {
    const p = RIG.posed(pose), { sleeve } = H.build(pose);
    return { left: !!pose.left, co: Array.from(p.co, v => +v.toFixed(3)), joints: p.joints, sleeve: [r3(sleeve.start), r3(sleeve.end), sleeve.r] };
  };
  const scenes = s => s.map(({ deg, hands }) => ({ deg, hands: hands.map(hand) }));
  return { meshes: { R: { faces: R.R.faces, co: Array.from(R.R.co.flat(), v => +v.toFixed(4)) }, L: { faces: R.L.faces, co: Array.from(R.L.co.flat(), v => +v.toFixed(4)) } }, hand: scenes(OH.handScenes()), lid: scenes(OH.lidScenes()) };
}
const hashOf = poses => crypto.createHash('sha1').update(JSON.stringify(poses)).digest('hex').slice(0, 16);

let META;
function meta() {
  if (META !== undefined) return META;
  META = null;
  const file = path.join(DIR, 'meta.json');
  if (!fs.existsSync(file)) { console.warn('WARNING: SourceAssets/Blender/OpeningHands missing; opening hands drawn from code (run node Tools/BlenderForge/render.cjs)'); return META; }
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (m.hash !== hashOf(exportPoses())) { console.warn('WARNING: SourceAssets/Blender/OpeningHands is older than openingHands.cjs/hand.cjs; opening hands drawn from code (run node Tools/BlenderForge/render.cjs)'); return META; }
  return (META = m);
}

// One frame: { joints: per hand, cell(i) -> hand sample at pixel i or null, lightVis(x, y, z) 0..1 }.
function frame(part, i) {
  const m = meta(), key = `${part}_${i}`;
  if (!m || !m.frames[key]) return null;
  const pass = k => readPng(path.join(DIR, `${key}_${k}.png`)).data;
  const P = pass('pos'), N = pass('nrm'), A = pass('idao'), D = readPng(path.join(DIR, `${key}_depth.png`)), S = m.shadow;
  function cell(i) {
    const k = i * 4;
    if (P[k + 3] < .5) return null;
    return { x: P[k] * 512, y: P[k + 1] * 512, z: P[k + 2] * 320 - 64, n: [N[k] * 2 - 1, N[k + 1] * 2 - 1, N[k + 2] * 2 - 1], id: Math.round(A[k] * 10), ao: A[k + 1] };
  }
  // Shadow of the hands at a point: 5x5 percentage-closer filter over the light-space depth map.
  function lightVis(x, y, z) {
    const dx = x - S.centre[0], dy = y - S.centre[1], dz = z - S.centre[2];
    const u = ((dx * S.x[0] + dy * S.x[1] + dz * S.x[2]) / S.scale + .5) * S.res - .5;
    const v = (.5 - (dx * S.y[0] + dy * S.y[1] + dz * S.y[2]) / S.scale) * S.res - .5;
    const q = x * S.L[0] + y * S.L[1] + z * S.L[2] + .8;
    let lit = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const px = Math.round(u + a * 1.5), py = Math.round(v + b * 1.5);
      if (px < 0 || py < 0 || px >= S.res || py >= S.res) { lit++; continue; }
      const k = (py * S.res + px) * 4;
      if (D.data[k + 3] < .5 || D.data[k] * S.enc[0] + S.enc[1] <= q) lit++;
    }
    return lit / 25;
  }
  return { joints: m.frames[key], cell, lightVis };
}

module.exports = { DIR, exportPoses, hashOf, frame };

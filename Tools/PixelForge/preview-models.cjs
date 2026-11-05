'use strict';
// Preview ONE world module without running forge (safe while other modules are being edited,
// and never touches Art/Resources). Writes a sheet: per model its 4 facings (frame 0) over the
// 16 px grid with the footprint tinted, then every frame of animated models and extra(add) sprites.
// Usage: node Tools/PixelForge/preview-models.cjs <module> <out.png> [scale=2] [idRegex]
//   <module>: world module name (nature, factory, …) e.g. node Tools/PixelForge/preview-models.cjs nature C:/tmp/nature.png 3
const path = require('path');
const { Canvas, hex } = require('./lib.cjs');
const { renderModel } = require('./voxel.cjs');
const { MODELS } = require('./world/common.cjs');

const [mod, out, scaleArg, filter] = process.argv.slice(2);
if (!mod || !out) { console.error('usage: preview-models.cjs <module> <out.png> [scale] [idRegex]'); process.exit(2); }
const M = require('./world/' + mod.replace(/\.cjs$/, '') + '.cjs');
const scale = +scaleArg || 2, re = filter ? new RegExp(filter) : null;

const rows = [];
for (const spec of MODELS.filter(s => !re || re.test(s.id))) {
  const t0 = Date.now(), r = renderModel(spec);
  const views = ['s', 'e', 'n', 'w'].map(d => r[d]);
  const v = views[0];
  console.log(`${spec.id}: foot ${spec.foot.join('×')} h${spec.height} frames ${v.frames.length} sprite ${v.frames[0].w}×${v.frames[0].h} anchor ${v.anchor.map(Math.round)} (${Date.now() - t0} ms)`);
  rows.push(views.map(x => ({ frames: x.frames, anchor: x.anchor.map(Math.round), foot: x.foot })));
  if (v.frames.length > 1) rows.push(v.frames.map(f => ({ frames: [f], anchor: v.anchor.map(Math.round), foot: v.foot })));
}
const extras = [];
if (M.extra) M.extra((group, name, frames, o = {}) => { if (!re || re.test(name)) { extras.push({ frames: frames.map(f => f), anchor: [0, frames[0].h], foot: [0, 0] }); console.log(`${name}: ${group} ${frames.length} frames ${frames[0].w}×${frames[0].h} fps ${o.fps}`); } });
for (const e of extras) rows.push(e.frames.map(f => ({ frames: [f], anchor: e.anchor, foot: [0, 0] })));
if (!rows.length) { console.error('nothing to preview'); process.exit(1); }

const pad = 8, gap = 6;
const cells = rows.map(r => r.map(m => ({ m, w: m.frames[0].w * scale, h: m.frames[0].h * scale })));
const W = Math.min(6000, Math.max(...cells.map(r => r.reduce((a, c) => a + c.w + gap, pad))) + pad);
const H = cells.reduce((a, r) => a + Math.max(...r.map(c => c.h)) + gap, pad) + pad;
const sheet = new Canvas(W, H);
sheet.fill(() => hex('#232820'));
const bg = hex('#4a5a34'), line = hex('#5c6d44'), foot = hex('#5f7040'), footLine = hex('#8a9a5a');
let y = pad;
for (const r of cells) {
  let x = pad;
  for (const { m, w, h } of r) {
    if (x + w > W) break;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const px = Math.floor(xx / scale) - m.anchor[0], py = Math.floor(yy / scale) - m.anchor[1];
      const grid = (((px % 16) + 16) % 16 === 0 && xx % scale === 0) || (((py % 16) + 16) % 16 === 0 && yy % scale === 0);
      const inFoot = px >= 0 && px < m.foot[0] * 16 && py < 0 && py >= -m.foot[1] * 16;
      sheet.put(x + xx, y + yy, inFoot ? (grid ? footLine : foot) : (grid ? line : bg));
    }
    sheet.blit(m.frames[0].scaled(scale), x, y);
    x += w + gap;
  }
  y += Math.max(...r.map(c => c.h)) + gap;
}
sheet.png(path.resolve(out)).then(() => console.log('wrote', path.resolve(out), W + '×' + H));

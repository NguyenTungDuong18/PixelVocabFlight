'use strict';
// PixelForge — regenerates every WORDWING 1944 sprite, frame by frame.
// Usage (from the project root):  node Tools/PixelForge/forge.cjs
// Output: Game/Assets/_Project/Art/Resources/Pixel/<Group>/<name>_<frame>.png
//         Game/Assets/_Project/Art/Resources/Pixel/pixel-manifest.json
//         SourceAssets/PixelArt/Pixel1944/preview-<group>.png (4x contact sheets)
const fs = require('fs');
const path = require('path');
const { Canvas, PAL, hex } = require('./lib.cjs');
const U = require('./units.cjs');
const T = require('./terrain.cjs');
const RW = require('./runway.cjs');
// Optional modules: a missing file is skipped, any other error is fatal.
function optional(file) {
  try { return require(file); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(file.slice(2))) throw e; return null; }
}
const UI = optional('./ui.cjs');
const C = optional('./characters.cjs');
const G = optional('./ground.cjs');
const W = require('./world.cjs');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'Game/Assets/_Project/Art/Resources/Pixel');
const PREVIEW = path.join(ROOT, 'SourceAssets/PixelArt/Pixel1944');
const VERSION = '0.15.0';

const manifest = [];
const groups = new Map();
const models = []; // sprites with a footprint (world models), previewed on their own sheets

// anchor: [ax, ay] px from the sprite's top-left; foot: [fw, fh] tiles in the sprite's own facing.
// Both are written for every entry (0 when absent) so Unity's JsonUtility can read them.
function add(group, name, frames, { fps = 8, loop = true, border = 0, anchor = null, foot = null } = {}) {
  if (!frames.length) throw new Error('No frames for ' + name);
  const { w, h } = frames[0];
  if (frames.some(f => f.w !== w || f.h !== h)) throw new Error('Frame size mismatch in ' + name);
  if (manifest.some(m => m.name === name)) throw new Error('Duplicate sprite name ' + name);
  const [anchorX, anchorY] = anchor ? anchor.map(Math.round) : [0, 0];
  const [footW, footH] = foot ? foot.map(Math.round) : [0, 0];
  if (foot && (anchorX < 0 || anchorY < 0 || anchorX + footW * 16 > w || anchorY >= h || anchorY - footH * 16 < 0)) throw new Error('Footprint outside sprite in ' + name);
  manifest.push({ name, path: group + '/' + name, frames: frames.length, width: w, height: h, fps, loop, border, anchorX, anchorY, footW, footH });
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ name, frames, model: !!foot });
  if (foot) models.push({ name, frames, anchor: [anchorX, anchorY], foot: [footW, footH] });
}

function buildUnits() {
  add('Aircraft', 'fighter_level', U.fighterFrames(1, 0), { fps: 24 });
  add('Aircraft', 'fighter_bank_left', U.fighterFrames(.86, -1), { fps: 24 });
  add('Aircraft', 'fighter_bank_right', U.fighterFrames(.86, 1), { fps: 24 });
  add('Aircraft', 'fighter_shadow', [U.fighterBody(1, 0).silhouette([0, 0, 0, 95])], { fps: 1 });
  for (const livery of ['jungle', 'desert', 'ice', 'ocean']) {
    add('Aircraft', 'bomber_' + livery, U.bomberFrames(livery, false), { fps: 20 });
    add('Aircraft', 'bomber_' + livery + '_damaged', U.bomberFrames(livery, true), { fps: 12 });
  }
  add('Aircraft', 'bomber_shadow', [U.bomberBody('jungle').silhouette([0, 0, 0, 95])], { fps: 1 });
  for (const livery of ['jungle', 'desert', 'ice', 'ocean']) {
    add('Aircraft', 'bomber_' + livery + '_bank_left', U.bomberBankFrames(livery, -1), { fps: 20 });
    add('Aircraft', 'bomber_' + livery + '_bank_right', U.bomberBankFrames(livery, 1), { fps: 20 });
  }
  add('Aircraft', 'bomber_guns', U.bomberGunFrames(), { fps: 8, loop: false });
  add('Weapons', 'enemy_tracer', U.enemyTracerFrames(), { fps: 1 });
  add('Weapons', 'rocket_boost', U.rocketBoostFrames(), { fps: 20 });
  add('Effects', 'fx_lock_reticle', U.lockReticleFrames(), { fps: 8 });
  add('Naval', 'carrier', U.carrierFrames(), { fps: 4 });
  add('Naval', 'carrier_bow_wave', U.bowWaveFrames(), { fps: 8 });
  add('Naval', 'carrier_stern_wake', U.sternWakeFrames(), { fps: 8 });
  add('Weapons', 'rocket', U.rocketFrames(false), { fps: 16 });
  add('Weapons', 'rocket_hot', U.rocketFrames(true), { fps: 20 });
  add('Weapons', 'tracer', U.tracerFrames(), { fps: 1 });
  add('Weapons', 'muzzle_flash', U.muzzleFrames(), { fps: 20 });
  add('Supplies', 'supply_fuel', U.supplyFrames('fuel'), { fps: 6 });
  add('Supplies', 'supply_metal', U.supplyFrames('metal'), { fps: 6 });
  add('Supplies', 'supply_roll', U.supplyFrames('roll'), { fps: 6 });
  add('Effects', 'fx_explosion', U.explosionFrames(), { fps: 14, loop: false });
  add('Effects', 'fx_spark', U.sparkFrames(), { fps: 18, loop: false });
  add('Effects', 'fx_smoke', U.smokeFrames(), { fps: 10, loop: false });
  add('Effects', 'fx_shockwave', U.shockwaveFrames(), { fps: 12, loop: false });
  add('Effects', 'fx_ice_shield', U.iceShieldFrames(), { fps: 6 });
  add('Effects', 'fx_splash', U.splashFrames(), { fps: 8, loop: false });
}

// Contact sheet: one row per animation, frames scaled 4x over a checkerboard.
function contactSheet(items, scale) {
  const pad = 6;
  const rows = items.map(it => ({ it, w: it.frames.length * (it.frames[0].w * scale + pad), h: it.frames[0].h * scale + pad }));
  const W = Math.min(4000, Math.max(...rows.map(r => r.w)) + pad), H = rows.reduce((a, r) => a + r.h, pad);
  const sheet = new Canvas(W, H);
  sheet.fill((x, y) => ((x >> 3) + (y >> 3)) % 2 ? hex('#3a3f36') : hex('#2c3029'));
  let y = pad;
  for (const r of rows) {
    let x = pad;
    for (const f of r.it.frames) { if (x + f.w * scale <= W) sheet.blit(f.scaled(scale), x, y); x += f.w * scale + pad; }
    y += r.h;
  }
  return sheet;
}

// World model sheet: one row per model, its four facings (frame 0) side by side over a
// 16 px tile grid aligned to each sprite's anchor; the footprint tiles are tinted.
function worldSheet(rows, scale) {
  const pad = 8, gap = 6;
  const cells = rows.map(r => r.map(m => ({ m, w: m.frames[0].w * scale, h: m.frames[0].h * scale })));
  const W = Math.max(...cells.map(r => r.reduce((a, c) => a + c.w + gap, pad))) + pad;
  const H = cells.reduce((a, r) => a + Math.max(...r.map(c => c.h)) + gap, pad) + pad;
  const sheet = new Canvas(W, H);
  sheet.fill(() => hex('#232820'));
  const bg = hex('#4a5a34'), line = hex('#5c6d44'), foot = hex('#5f7040'), footLine = hex('#8a9a5a');
  let y = pad;
  for (const r of cells) {
    let x = pad;
    for (const { m, w, h } of r) {
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
  return sheet;
}

async function writeWorldPreviews() {
  const byId = new Map();
  for (const m of models) { const id = m.name.replace(/_[senw]$/, ''); if (!byId.has(id)) byId.set(id, []); byId.get(id).push(m); }
  const sheets = { buildings: ['bld_', 2], props: ['prop_', 3], vehicles: ['veh_', 3], aircraft: ['air_', 3] };
  for (const [file, [prefix, scale]] of Object.entries(sheets)) {
    const rows = [...byId].filter(([id]) => id.startsWith(prefix)).map(([, r]) => r);
    if (rows.length) await worldSheet(rows, scale).png(path.join(PREVIEW, `preview-world-${file}.png`));
  }
}

async function main() {
  buildUnits();
  if (UI) UI.build(add);
  T.build(add);
  RW.build(add);
  if (C) C.build(add);
  if (G) G.build(add);
  W.build(add);
  // Replace PNGs but keep Unity .meta files of frames that still exist (stable GUIDs);
  // frames that are no longer generated lose both their PNG and their .meta.
  const expected = new Set();
  for (const [group, items] of groups) for (const it of items) for (let i = 0; i < it.frames.length; i++) expected.add(path.join(group, `${it.name}_${i}.png`));
  if (fs.existsSync(OUT)) for (const group of fs.readdirSync(OUT)) {
    const dir = path.join(OUT, group);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      const png = file.endsWith('.meta') ? file.slice(0, -5) : file;
      if (file.endsWith('.png') || !expected.has(path.join(group, png))) fs.rmSync(path.join(dir, file));
    }
  }
  fs.mkdirSync(PREVIEW, { recursive: true });
  let files = 0;
  for (const [group, items] of groups) {
    fs.mkdirSync(path.join(OUT, group), { recursive: true });
    for (const it of items) for (let i = 0; i < it.frames.length; i++) { await it.frames[i].png(path.join(OUT, group, `${it.name}_${i}.png`)); files++; }
    const plain = items.filter(it => !it.model);
    const big = plain.filter(it => it.frames[0].w > 200);
    const small = plain.filter(it => it.frames[0].w <= 200);
    if (small.length) await contactSheet(small, 4).png(path.join(PREVIEW, `preview-${group.toLowerCase()}.png`));
    for (const it of big) await contactSheet([{ name: it.name, frames: [it.frames[0]] }], 2).png(path.join(PREVIEW, `preview-${it.name}.png`));
  }
  await writeWorldPreviews();
  if (C && C.writePreviews) await C.writePreviews(PREVIEW);
  if (G && G.writePreviews) await G.writePreviews(PREVIEW);
  fs.writeFileSync(path.join(OUT, 'pixel-manifest.json'), JSON.stringify({ version: VERSION, sprites: manifest }, null, 2));
  console.log(`PixelForge ${VERSION}: ${manifest.length} animations, ${files} frame files -> ${path.relative(ROOT, OUT)}`);
}

main().catch(e => { console.error(e); process.exit(1); });

'use strict';
// WORDWING 0.15.0: walkable-base characters (24x32, anchor 12,30), dialogue portraits (48x48)
// and the quest marker. Every character comes from ONE parametric rig: a new NPC only needs a
// parameter set in CHARACTERS (skin, hair + hairStyle, top + topStyle, pants, shoes, hat, held,
// goggles/glasses/mustache/scarf/collar/medals/armband...). Facing W is the mirror of facing E.
// Animation: idle / walk / run are 8-frame cycles (breathing + blink, classic contact-down-passing-up
// walk, leaning run with an airborne frame); see "cycles" below. fx_dust is the running-foot puff.
const fs = require('fs');
const path = require('path');
const { Canvas, hex } = require('./lib.cjs');
const { FW, FH, ANCHOR, M } = require('./characters/palette.cjs');
const { CHARACTERS } = require('./characters/roster.cjs');
require('./characters/masks.cjs');
require('./characters/body.cjs');
const { renderFront, renderSide } = require('./characters/figure.cjs');
const {
  frames, talkFrames, workFrames, DUST_W, DUST_ANCHOR, dustFrames, shadowFrame, questMarkerFrames
} = require('./characters/cycles.cjs');
const { portrait } = require('./characters/portraits.cjs');

// ---------------------------------------------------------------- previews
function sheetBackground(w, h) {
  const s = new Canvas(w, h);
  return s.fill((x, y) => ((x >> 3) + (y >> 3)) % 2 ? hex('#3a3f36') : hex('#2c3029'));
}

function charactersSheet(all) {
  // One block per character: rows idle / walk / run, columns s | e | n | w (8 frames each).
  // A faint baseline at row 30 (the anchor) shows that planted feet sit on the ground line.
  const SC = 2, cell = FW * SC + 4, rowH = FH * SC + 4, pad = 10, gap = 10;
  const kinds = ['idle', 'walk', 'run'];
  const blockW = 4 * 8 * cell + 3 * gap, blockH = kinds.length * rowH + pad;
  const ids = Object.keys(all);
  const extraH = rowH + pad;
  // Extra row: professor talk + engineer work (4 x 8) + quest marker + dust.
  const extraW = (4 + 32) * cell + 6 * gap + 6 * (8 * SC + 6) + 5 * (16 * SC * 2 + 6) + 3 * gap;
  const sheet = sheetBackground(Math.max(blockW, extraW) + 2 * pad, ids.length * blockH + extraH + pad);
  const shadow = shadowFrame();
  const put = (f, x, y) => {
    const tmp = new Canvas(FW, FH); tmp.blit(shadow, 0, 0);
    for (let xx = 0; xx < FW; xx += 2) tmp.put(xx, ANCHOR[1], hex('#5a6050'));
    tmp.blit(f, 0, 0); sheet.blit(tmp.scaled(SC), x, y);
  };
  ids.forEach((id, i) => {
    const bx = pad, by = pad + i * blockH, A = all[id];
    sheet.rect(bx - 4, by - 4, blockW + 8, blockH - pad + 4, hex('#232720'));
    kinds.forEach((k, r) => {
      let x = bx;
      for (const d of 'senw') { for (const f of A[k + '_' + d]) { put(f, x, by + r * rowH); x += cell; } x += gap; }
    });
  });
  const ty = pad + ids.length * blockH;
  let x = pad;
  for (const f of all.professor.talk_s) { put(f, x, ty); x += cell; }
  x += gap;
  if (all.engineer) for (const d of 'senw') { for (const f of all.engineer['work_' + d]) { put(f, x, ty); x += cell; } x += gap; }
  x += gap;
  for (const f of questMarkerFrames()) { sheet.blit(f.scaled(SC), x, ty); x += 8 * SC + 6; }
  x += gap;
  for (const f of dustFrames()) { sheet.blit(f.scaled(SC * 2), x, ty + 8); x += DUST_W * SC * 2 + 6; }
  return sheet;
}

function portraitsSheet(ports) {
  const SC = 4, pad = 10, cell = 48 * SC + pad;
  const ids = Object.keys(ports);
  const sheet = sheetBackground(pad + ids.length * cell, pad + 2 * cell);
  ids.forEach((id, i) => ports[id].forEach((f, k) => sheet.blit(f.scaled(SC), pad + i * cell, pad + k * cell)));
  return sheet;
}

// ---------------------------------------------------------------- build
function buildAll() {
  const out = {};
  for (const [id, P] of Object.entries(CHARACTERS)) {
    const A = {};
    for (const d of 'senw') for (const k of ['idle', 'walk', 'run']) A[k + '_' + d] = frames(P, d, k);
    if (id === 'professor') A.talk_s = talkFrames(P);
    if (id === 'engineer') for (const d of 'senw') A['work_' + d] = workFrames(P, d);
    out[id] = A;
  }
  return out;
}

function buildPortraits() {
  const out = {};
  for (const [id, P] of Object.entries(CHARACTERS)) out[id] = [portrait(P, false), portrait(P, true)];
  return out;
}

const PREVIEW = path.resolve(__dirname, '../../SourceAssets/PixelArt/Pixel1944');

// Extra contact sheets (one block per character, portraits side by side). Names differ from the
// per-group sheets forge writes (preview-characters.png etc.) so the two never race.
function writePreviews(dir = PREVIEW, all = buildAll(), ports = buildPortraits()) {
  fs.mkdirSync(dir, { recursive: true });
  return Promise.all([
    charactersSheet(all).png(path.join(dir, 'preview-characters-sheet.png')),
    portraitsSheet(ports).png(path.join(dir, 'preview-portraits-sheet.png'))
  ]);
}

function build(add) {
  const all = buildAll(), ports = buildPortraits();
  const opt = (fps, loop = true) => ({ fps, loop, anchor: ANCHOR });
  for (const [id, A] of Object.entries(all)) {
    for (const d of 'senw') {
      add('Characters', `chr_${id}_idle_${d}`, A['idle_' + d], opt(5));
      add('Characters', `chr_${id}_walk_${d}`, A['walk_' + d], opt(16));
      add('Characters', `chr_${id}_run_${d}`, A['run_' + d], opt(20));
    }
    if (A.talk_s) add('Characters', `chr_${id}_talk_s`, A.talk_s, opt(6));
    if (A.work_s) for (const d of 'senw') add('Characters', `chr_${id}_work_${d}`, A['work_' + d], opt(10));
  }
  add('Characters', 'chr_shadow', [shadowFrame()], opt(1));
  add('Effects', 'fx_quest_marker', questMarkerFrames(), { fps: 8, loop: true });
  add('Effects', 'fx_dust', dustFrames(), { fps: 14, loop: false, anchor: DUST_ANCHOR });
  for (const [id, f] of Object.entries(ports)) add('Portraits', `portrait_${id}`, f, { fps: 4, loop: true });
  writePreviews(PREVIEW, all, ports).catch(e => { console.error('characters preview failed', e); process.exitCode = 1; });
}

module.exports = { build, writePreviews, CHARACTERS, M, renderFront, renderSide, portrait, dustFrames, FW, FH, ANCHOR, DUST_ANCHOR };

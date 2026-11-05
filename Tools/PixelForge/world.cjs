'use strict';
// WORDWING 0.15 world models: buildings, props, vehicles and parked aircraft of a 1944
// airbase. Every model is an independent voxel recipe (see voxel.cjs) rendered in four
// facings, so any map can reuse it. Model-local space: x east, y south, z up; the front
// (door, nose, muzzle) always faces +y in the recipe and turns with the facing.
// Models in the library but not placed on any map yet are fine: only WorldModels.cs ids are checked.
const { renderModel } = require('./voxel.cjs');
const { MODELS } = require('./world/common.cjs');
// Order = manifest order. Each module only requires common.cjs (never another model module).
const MODULES = ['buildings', 'quarters', 'installations', 'storage', 'factory', 'airfield', 'props', 'clutter', 'workshop', 'nature', 'vehicles', 'aircraft', 'fleet'];
// spec.module tags each model with its file so forge writes one preview sheet per module.
const mods = MODULES.map(n => { const before = MODELS.length, m = require('./world/' + n + '.cjs'); for (const spec of MODELS.slice(before)) spec.module = n; return m; });

function build(add) {
  for (const spec of MODELS) {
    const r = renderModel(spec);
    for (const dir of ['s', 'e', 'n', 'w']) {
      const v = r[dir];
      add(spec.group, spec.id + '_' + dir, v.frames, { fps: spec.fps || 1, loop: true, anchor: v.anchor, foot: v.foot });
    }
  }
  for (const m of mods) if (m && m.extra) m.extra(add); // non-model sprites (fx_leaves_* …)
}

module.exports = { build, MODELS, renderModel };

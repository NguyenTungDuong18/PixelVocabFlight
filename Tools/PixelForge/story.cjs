'use strict';
// Story art: full-screen cut-ins (cut_*), vistas (vista_*) and their overlays, all 480x270.
// story/common.cjs (ramps, helpers) <- script.cjs (handwriting), scene3d.cjs (raymarcher) <- tin.cjs, hand.cjs
// <- opening.cjs; m1cuts.cjs, m1roof.cjs. The title intro is no longer sprites: it is the pre-rendered film of
// Tools/PixelForge/cinema/ (node Tools/PixelForge/cinema/film.cjs). story/intro*.cjs (the old sprite intro) are kept
// on disk but not built.
// Names, sizes, frame counts and loop flags are a contract with Logic/Story (Act0Content) and StoryView.
const O = require('./story/opening.cjs');
const C = require('./story/m1cuts.cjs');
const R = require('./story/m1roof.cjs');

function build(add) {
  add('Story', 'cut_open_ink', O.inkFrames(), { fps: 8, loop: false });
  add('Story', 'cut_open_tin_bg', [O.tinBackground()], { fps: 1 });
  add('Story', 'cut_open_tin_hand', O.handFrames(), { fps: 8, loop: false });
  add('Story', 'cut_open_tin_lid', O.lidFrames(), { fps: 8, loop: false });
  add('Effects', 'fx_rain_shadow', O.rainFrames(), { fps: 8, loop: true });
  add('Story', 'cut_m1_floris_photo', [C.florisPhoto()], { fps: 1 });
  add('Story', 'cut_m1_handkerchief_note', [C.handkerchiefNote()], { fps: 1 });
  const v = R.vista();
  add('Story', 'vista_m1_roof', [v.canvas], { fps: 1 });
  add('Effects', 'fx_village_lights', R.villageLights(), { fps: 4, loop: true });
  add('Effects', 'fx_bomber_stream_night', R.bomberStream(v.sky), { fps: 8, loop: true });
}

module.exports = { build };

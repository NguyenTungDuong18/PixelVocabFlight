'use strict';
// Interface art: nine-slice panels and buttons, HUD icons, logo, battlefield cards
// and the animated top-down airbase used by the title screen.
const { Canvas } = require('./lib.cjs');
const {
  panel, BUTTONS, button, card, ink, keycap, plate, cell, icon, pointerFrames, logo, thumbnail
} = require('./ui/widgets.cjs');
const { airbase, clouds } = require('./ui/title.cjs');
const { cockpit, needleFrames, lamp, leverFrames, inputFrame } = require('./ui/cockpit.cjs');

function build(add) {
  add('UI', 'cockpit_panel', [cockpit()], { fps: 1 });
  add('UI', 'gauge_needle', needleFrames(), { fps: 1 });
  for (const kind of ['green', 'amber', 'red', 'off']) add('UI', 'ui_lamp_' + kind, [lamp(kind)], { fps: 1 });
  add('UI', 'ui_lever', leverFrames(), { fps: 12, loop: false });
  add('UI', 'ui_input', [inputFrame(false)], { fps: 1, border: 5 });
  add('UI', 'ui_input_focus', [inputFrame(true)], { fps: 1, border: 5 });
  add('UI', 'ui_scanline', [new Canvas(2, 2).fill((x, y) => y ? [0, 0, 0, 70] : null)], { fps: 1 });
  add('UI', 'ui_panel', [panel()], { fps: 1, border: 8 });
  add('UI', 'ui_ink', [ink()], { fps: 1, border: 4 });
  add('UI', 'ui_plate', [plate()], { fps: 1, border: 4 });
  add('UI', 'ui_keycap', [keycap()], { fps: 1, border: 5 });
  add('UI', 'ui_card', [card(false)], { fps: 1, border: 10 });
  add('UI', 'ui_card_selected', [card(true)], { fps: 1, border: 10 });
  for (const style of Object.keys(BUTTONS)) add('UI', 'ui_button_' + style, [0, 1, 2].map(s => button(style, s)), { fps: 1, border: 5 });
  for (const kind of ['full', 'low', 'empty']) add('UI', 'ui_cell_' + kind, [cell(kind)], { fps: 1 });
  for (const kind of ['fuel', 'clock', 'speed', 'medal', 'sound_on', 'sound_off', 'pause', 'armor', 'radio', 'arrow_right', 'arrow_left', 'check', 'target'])
    add('UI', 'icon_' + kind, [icon(kind)], { fps: 1 });
  add('UI', 'ui_pointer', pointerFrames(), { fps: 3 });
  add('Title', 'logo', [logo()], { fps: 1 });
  for (const kind of ['jungle', 'desert', 'ice', 'ocean']) add('Title', 'card_' + kind, [thumbnail(kind)], { fps: 1 });
  add('Title', 'title_airbase', [0, 1, 2, 3].map(airbase), { fps: 3 });
  add('Title', 'title_clouds', [clouds()], { fps: 1 });
}

module.exports = { build };

'use strict';
// Characters: rig parameters per character. A new NPC = one entry in CHARACTERS.
const fs = require('fs');
const path = require('path');
const { hex, PAL } = require('../lib.cjs');
const { RD } = PAL;
const { R, M } = require('./palette.cjs');

// ---------------------------------------------------------------- rig parameters
// Fields (all optional except skin/hair/top/pants/shoes):
//   hairStyle: tousled | receding | bun | crop | ponytail (+ hairTie colour)   hat: helmet | cap | kepi | nurse
//   topStyle: jacket | suit | field | coverall | dress | officer
//   held: book | wrench | bigwrench | rifle                          skirt, goggles, glasses, mustache, scarf,
//   collar (ramp), belt (ramp), tie (ramp), shirt (ramp), medals, armband, grease, lips,
//   freckles, rolled (sleeves), toolbelt (ramp), goggleLens (ramp)
//   portrait: { bg: [dark, mid, light], iris, age, female }
const CHARACTERS = {
  pilot: {
    skin: M.skinFair, hair: M.hairChestnut, hairStyle: 'tousled', eye: hex('#24140a'), brows: true,
    top: M.leather, topStyle: 'jacket', collar: M.fleece, scarf: M.scarf,
    pants: M.khaki, shoes: M.boot, goggles: true,
    portrait: { bg: R('#16222c', '#22384a', '#35546a'), iris: hex('#6b4423'), age: 22 }
  },
  professor: {
    skin: M.skinOld, hair: M.hairSilver, hairStyle: 'receding', eye: hex('#2a2620'), brows: true,
    top: M.tweed, topStyle: 'suit', shirt: M.shirt, tie: M.tie, pants: M.greyTrouser, shoes: M.brownLeather,
    glasses: true, mustache: true, held: 'book',
    portrait: { bg: R('#121d16', '#1d3125', '#2b4736'), iris: hex('#4a6a7a'), age: 64 }
  },
  guard: {
    skin: M.skinTan, hair: M.hairDark, hairStyle: 'crop', eye: hex('#1c120a'), brows: true,
    top: M.olive, topStyle: 'field', belt: M.webbing, pants: M.olive, shoes: M.boot, leggings: M.webbing,
    hat: 'helmet', hatCol: M.helmet, held: 'rifle',
    portrait: { bg: R('#1a1d12', '#2a2f1c', '#3d442a'), iris: hex('#3d2a18'), age: 24 }
  },
  mechanic: {
    skin: M.skinWarm, hair: M.hairBlack, hairStyle: 'crop', eye: hex('#1a120c'), brows: true,
    top: M.coverall, topStyle: 'coverall', pants: M.coverall, shoes: M.boot,
    hat: 'cap', hatCol: M.capBlue, held: 'wrench', grease: true,
    portrait: { bg: R('#1a1d1f', '#2b3134', '#40494d'), iris: hex('#2e2014'), age: 35, stubble: true }
  },
  medic: {
    skin: M.skinFair, hair: M.hairDark, hairStyle: 'bun', eye: hex('#1c1210'), brows: true, lips: hex('#b0534a'),
    top: M.nurse, topStyle: 'dress', skirt: true, pants: M.stocking, shoes: M.shirt,
    hat: 'nurse', hatCol: M.nurse, armband: true,
    portrait: { bg: R('#1a2224', '#2a3a3d', '#3f5658'), iris: hex('#3d5a3a'), age: 26, female: true }
  },
  officer: {
    skin: M.skinTan, hair: M.hairGreying, hairStyle: 'crop', eye: hex('#1a120c'), brows: true,
    top: M.odJacket, topStyle: 'officer', shirt: M.khakiShirt, tie: M.odJacket, belt: M.brownLeather,
    pants: M.pinks, shoes: M.brownLeather, hat: 'kepi', hatCol: M.odJacket, band: M.brownLeather, brim: M.blackLeather,
    medals: true, mustache: false,
    portrait: { bg: R('#24140f', '#3a2219', '#553428'), iris: hex('#2a1c10'), age: 48, thinMustache: true }
  },
  // Young genius engineer (~19): golden ponytail, welding goggles up on the forehead, freckles and an
  // oil smudge, petrol-teal coveralls with rolled sleeves, tool belt, big wrench. Has a work cycle.
  engineer: {
    skin: M.skinFair, hair: M.hairGold, hairStyle: 'ponytail', hairTie: RD[3], eye: hex('#1c2a3a'), brows: true,
    lips: hex('#c0675a'), freckles: true, grease: true,
    top: M.petrol, topStyle: 'coverall', rolled: true, toolbelt: M.brownLeather, pants: M.petrol, shoes: M.brownLeather,
    goggles: true, goggleLens: M.weldLens, held: 'bigwrench',
    portrait: { bg: R('#1c1a14', '#2e2a1e', '#463f2a'), iris: hex('#3f7fa8'), age: 19, female: true, smile: true }
  }
};

module.exports = {
  CHARACTERS
};

'use strict';
// Characters: frame size/anchor and material ramps (M) shared by the rig and portraits.
const fs = require('fs');
const path = require('path');
const { PAL, hex } = require('../lib.cjs');
const { OL } = PAL;

const FW = 24, FH = 32, ANCHOR = [12, 30];
const R = (...h) => h.map(c => hex(c));

// Material ramps: index 0 deepest shade, 1 shade, 2 base, 3 light.
const M = {
  skinFair: R('#7a4630', '#b9765a', '#e2a27c', '#f4c9a2'),
  skinWarm: R('#6a3b26', '#a5664a', '#d29270', '#ebb792'),
  skinTan: R('#5a3220', '#8f5638', '#bd8058', '#d9a27a'),
  skinOld: R('#76493a', '#b0806a', '#dcb095', '#f1d3bd'),
  hairChestnut: R('#2e1608', '#5e3112', '#91531f', '#c07b37'),
  hairSilver: R('#55595d', '#8a8e92', '#c2c5c7', '#eceeee'),
  hairBlack: R('#110e0c', '#221c18', '#383029', '#4f443b'),
  hairDark: R('#1a110b', '#30200f', '#4a321b', '#664829'),
  hairGreying: R('#1f1c19', '#3a3530', '#5a544c', '#9a958d'),
  leather: R('#1e120b', '#3a2317', '#5a3722', '#7c5132'),
  fleece: R('#8c7752', '#bca57a', '#ddc9a0', '#f4e9cd'),
  scarf: R('#9ea29b', '#cfd3ca', '#eef0ea', '#ffffff'),
  khaki: R('#4f4429', '#7a6a42', '#a08e5c', '#c2b17c'),
  boot: R('#120c08', '#2a1c13', '#47301f', '#6a4a2f'),
  tweed: R('#33271c', '#57442f', '#7c6446', '#9c8461'),
  shirt: R('#8f948c', '#c4c8bf', '#e8ebe2', '#fbfcf6'),
  tie: R('#3e130e', '#6a2117', '#963826', '#c25a3d'),
  greyTrouser: R('#25272b', '#3c3f45', '#585c63', '#777b82'),
  olive: [OL[1], OL[2], OL[3], OL[4]],
  helmet: R('#262e18', '#3d4a24', '#56672f', '#738842'),
  webbing: R('#4a4128', '#6d6240', '#94875a', '#b3a776'),
  coverall: R('#18222d', '#283b4d', '#3d5a74', '#5c7f9a'),
  capBlue: R('#141c25', '#22303e', '#344b60', '#4f6c86'),
  nurse: R('#87918f', '#b6c0bd', '#dde4df', '#f8faf6'),
  stocking: R('#6b5a48', '#8e7a64', '#b09a80', '#c8b398'),
  odJacket: R('#262414', '#3f3c24', '#5c5836', '#7c774d'),
  pinks: R('#6a5a4a', '#938069', '#b7a387', '#d3c1a4'),
  khakiShirt: R('#7d7050', '#a39570', '#c4b78f', '#dcd1ac'),
  brownLeather: R('#24130a', '#45261a', '#6b3d22', '#8f5631'),
  blackLeather: R('#0d0b0a', '#1d1a17', '#332e29', '#5a534b'),
  hairGold: R('#6a4614', '#a87a26', '#dcb144', '#f8e08a'),
  petrol: R('#132326', '#1f3a3b', '#2f5753', '#477a70'),
  weldLens: R('#173322', '#2c5e3c', '#4f9a62', '#a8e0b0')
};

module.exports = {
  FW, FH, ANCHOR, R, M
};

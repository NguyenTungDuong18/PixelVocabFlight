'use strict';
// Aircraft, ships, weapons, supplies and effects. All units face north (nose up);
// the game rotates them at runtime, so one set of frames serves every heading.
const {
  propeller, fighterBody, fighterFrames, bomberBody, bomberFrames, bomberBankFrames,
  bomberGunFrames, enemyTracerFrames
} = require('./units/aircraft.cjs');
const { carrierFrames, bowWaveFrames, sternWakeFrames } = require('./units/carrier.cjs');
const { rocketFrames, rocketBoostFrames } = require('./units/rocket.cjs');
const { supplyFrames } = require('./units/supplies.cjs');
const {
  explosionFrames, sparkFrames, smokeFrames, shockwaveFrames, iceShieldFrames, tracerFrames,
  muzzleFrames, splashFrames, lockReticleFrames
} = require('./units/effects.cjs');

module.exports = {
  fighterFrames, fighterBody, bomberFrames, bomberBody, carrierFrames, bowWaveFrames, sternWakeFrames, rocketFrames,
  supplyFrames, explosionFrames, sparkFrames, smokeFrames, shockwaveFrames, iceShieldFrames, tracerFrames, muzzleFrames, splashFrames,
  bomberBankFrames, bomberGunFrames, enemyTracerFrames, lockReticleFrames, rocketBoostFrames, propeller
};

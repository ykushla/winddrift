import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  parseAppliedBallisticsCsv,
  chooseWindCalibration
} from '../src/core/abCsvParser.js';
import {
  calculateWindCorrection
} from '../src/core/windCorrection.js';
import {
  mcCoyLitzSegmentWeights
} from '../src/core/trajectory.js';

const csvPath = new URL('../samples/AB-Rangecard-example.csv', import.meta.url);
const profile = parseAppliedBallisticsCsv(fs.readFileSync(csvPath, 'utf8'));
const calibration = chooseWindCalibration(profile);

const endpoints = (speed, clock = 3) => [
  { positionMode: 'percent', position: 0, speed, clock },
  { positionMode: 'percent', position: 50, speed, clock },
  { positionMode: 'percent', position: 100, speed, clock }
];

for (const model of ['linear', 'pchip']) {
  let result = calculateWindCorrection({
    profile,
    calibration,
    targetDistance: 800,
    windPoints: endpoints(0),
    interpolation: model
  });
  assert.ok(Math.abs(result.correctionMrad) < 1e-12);

  result = calculateWindCorrection({
    profile,
    calibration,
    targetDistance: 800,
    windPoints: endpoints(10),
    interpolation: model
  });

  const row800 = profile.trajectory.find(x => x.range === 800);
  assert.ok(row800);
  assert.ok(
    Math.abs(Math.abs(result.correctionMrad) - row800.windage2) < 1e-10,
    `${model}: uniform 10 m/s must reproduce AB Windage 2 at 800 m`
  );

  result = calculateWindCorrection({
    profile,
    calibration,
    targetDistance: 800,
    windPoints: endpoints(1),
    interpolation: model
  });
  assert.ok(
    Math.abs(Math.abs(result.correctionMrad) - row800.windage2 / 10) < 1e-10,
    `${model}: uniform 1 m/s must equal AB Windage 2 / 10 at 800 m`
  );
}

const weights = mcCoyLitzSegmentWeights(profile, 800);
assert.ok(Math.abs(weights.segments.reduce((a, s) => a + s.weight, 0) - 1) < 1e-12);

const mixed = [
  { positionMode: 'percent', position: 0, speed: 2, clock: 3 },
  { positionMode: 'distance', position: 300, speed: 5, clock: 3 },
  { positionMode: 'percent', position: 100, speed: 2, clock: 3 }
];

const result800 = calculateWindCorrection({
  profile,
  calibration,
  targetDistance: 800,
  windPoints: mixed,
  interpolation: 'linear'
});
const result600 = calculateWindCorrection({
  profile,
  calibration,
  targetDistance: 600,
  windPoints: mixed,
  interpolation: 'linear'
});

assert.equal(result800.activeWindPoints.find(x => x.positionMode === 'distance').x, 300);
assert.equal(result600.activeWindPoints.find(x => x.positionMode === 'distance').x, 300);

const right = calculateWindCorrection({
  profile,
  calibration,
  targetDistance: 800,
  windPoints: endpoints(4, 3),
  interpolation: 'linear'
});
const left = calculateWindCorrection({
  profile,
  calibration,
  targetDistance: 800,
  windPoints: endpoints(4, 9),
  interpolation: 'linear'
});

assert.ok(Math.abs(right.correctionMrad + left.correctionMrad) < 1e-12);
assert.equal(right.side, 'R');
assert.equal(left.side, 'L');

console.log('calculator.test.mjs PASS');

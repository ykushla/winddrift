import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  parseAppliedBallisticsCsv,
  chooseWindCalibration,
  validateWindProfile
} from '../src/core/abCsvParser.js';

const csvPath = new URL('../samples/AB-Rangecard-example.csv', import.meta.url);
const profile = parseAppliedBallisticsCsv(fs.readFileSync(csvPath, 'utf8'));

assert.equal(profile.trajectory.length, 199);
assert.equal(profile.trajectory[0].range, 5);
assert.equal(profile.trajectory.at(-1).range, 995);
assert.equal(validateWindProfile(profile).ok, true);

const calibration = chooseWindCalibration(profile);
assert.equal(calibration.id, 2);
assert.equal(calibration.speed, 10);
assert.equal(calibration.direction, '3:00');
assert.ok(Math.abs(calibration.crosswind - 10) < 1e-12);
assert.equal(calibration.windageKey, 'windage2');

console.log('parser.test.mjs PASS');

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


// Validation: coarse but regular 50 m step should import with a warning, not an error.
const coarseProfile = structuredClone(profile);
coarseProfile.trajectory = Array.from({ length: 20 }, (_, i) => ({
  ...profile.trajectory[Math.min(i * 10 + 9, profile.trajectory.length - 1)],
  range: (i + 1) * 50
}));
const coarseValidation = validateWindProfile(coarseProfile);
assert.equal(coarseValidation.ok, true);
assert.ok(coarseValidation.warnings.some(w => w.includes('50 м')));

// Validation: irregular gap should produce a warning.
const irregularProfile = structuredClone(profile);
irregularProfile.trajectory = irregularProfile.trajectory.filter(row => row.range !== 50);
const irregularValidation = validateWindProfile(irregularProfile);
assert.equal(irregularValidation.ok, true);
assert.ok(irregularValidation.warnings.some(w => w.includes('нерівномірні прогалини')));

// Validation: missing MV is an error.
const noMvProfile = structuredClone(profile);
noMvProfile.metadata.muzzleVelocity = null;
const noMvValidation = validateWindProfile(noMvProfile);
assert.equal(noMvValidation.ok, false);
assert.ok(noMvValidation.errors.some(e => e.includes('MV [M/S]')));

// Validation: Range Card shorter than 100 m is an error.
const shortProfile = structuredClone(profile);
shortProfile.trajectory = shortProfile.trajectory.filter(row => row.range <= 95);
const shortValidation = validateWindProfile(shortProfile);
assert.equal(shortValidation.ok, false);
assert.ok(shortValidation.errors.some(e => e.includes('100 м')));

console.log('parser.test.mjs PASS');

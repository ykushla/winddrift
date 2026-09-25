import assert from 'node:assert/strict';
import {
  getPointCoordinates,
  getPointBounds,
  setPointFromPercent,
  setPointFromDistance,
  normalizeWindPointPositions,
  findLargestGapMidpoint,
  clampTargetDistance,
  getProfileMaxRange
} from '../src/ui/state.js';

let p = { id: 'p', locked: false, positionMode: 'percent', position: 50 };
p = setPointFromPercent(p, 40, 500);
assert.equal(p.positionMode, 'percent');
assert.equal(getPointCoordinates(p, 500).distance, 200);

p = setPointFromDistance(p, 300, 500);
assert.equal(p.positionMode, 'distance');
assert.equal(getPointCoordinates(p, 500).percent, 60);
assert.equal(getPointCoordinates(p, 800).distance, 300);
assert.equal(getPointCoordinates(p, 800).percent, 37.5);

p = setPointFromPercent(p, 25, 800);
assert.equal(p.positionMode, 'percent');
assert.equal(getPointCoordinates(p, 800).distance, 200);
assert.equal(getPointCoordinates(p, 600).distance, 150);

assert.equal(clampTargetDistance(50), 100);
assert.equal(clampTargetDistance(100), 100);
assert.equal(clampTargetDistance(650), 650);
assert.equal(clampTargetDistance(1200, 995), 995);
assert.equal(clampTargetDistance(800, 995), 800);
assert.equal(getProfileMaxRange({ trajectory: [{ range: 5 }, { range: 995 }] }), 995);
assert.equal(getProfileMaxRange(null), Infinity);

const points = [
  { id: 'start', locked: true, positionMode: 'percent', position: 0 },
  { id: 'a', locked: false, positionMode: 'distance', position: 200 },
  { id: 'b', locked: false, positionMode: 'distance', position: 350 },
  { id: 'end', locked: true, positionMode: 'percent', position: 100 }
];

let bounds = getPointBounds(points, 1, 500);
assert.equal(bounds.minDistance, 1);
assert.equal(bounds.maxDistance, 349);

let a = setPointFromDistance(points[1], 400, 500, bounds);
assert.equal(a.position, 349);
a = setPointFromDistance(points[1], 0, 500, bounds);
assert.equal(a.position, 1);

a = setPointFromPercent(points[1], 99, 500, bounds);
assert.equal(getPointCoordinates(a, 500).distance, 349);

const invalid = [
  { id: 'start', locked: true, positionMode: 'percent', position: 0 },
  { id: 'a', locked: false, positionMode: 'distance', position: 300 },
  { id: 'b', locked: false, positionMode: 'distance', position: 300 },
  { id: 'end', locked: true, positionMode: 'percent', position: 100 }
];
const normalized = normalizeWindPointPositions(invalid, 500);
assert.ok(getPointCoordinates(normalized[2], 500).distance - getPointCoordinates(normalized[1], 500).distance >= 1);

const midpoint = findLargestGapMidpoint(points, 500);
assert.equal(midpoint.index, 1);
assert.equal(midpoint.distance, 100);

console.log('state.test.mjs: OK');

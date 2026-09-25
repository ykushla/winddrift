import assert from 'node:assert/strict';
import { getPointCoordinates, setPointFromPercent, setPointFromDistance } from '../src/ui/state.js';

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

console.log('state.test.mjs: OK');

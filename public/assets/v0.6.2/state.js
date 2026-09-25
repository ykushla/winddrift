export const createInitialState = () => ({
  profile: null,
  calibration: null,
  targetDistance: 500,
  interpolation: 'linear',
  windPoints: [
    { id: crypto.randomUUID(), locked: true, positionMode: 'percent', position: 0, speed: 0, clock: 3 },
    { id: crypto.randomUUID(), locked: false, positionMode: 'percent', position: 50, speed: 0, clock: 3 },
    { id: crypto.randomUUID(), locked: true, positionMode: 'percent', position: 100, speed: 0, clock: 3 }
  ],
  result: null,
  error: null,
  importWarnings: []
});

export function updatePointPositionMode(point, nextMode, targetDistance) {
  if (point.locked) return point;
  if (nextMode === point.positionMode) return point;

  const absolute = point.positionMode === 'percent'
    ? targetDistance * Number(point.position) / 100
    : Number(point.position);

  const position = nextMode === 'percent'
    ? (targetDistance > 0 ? absolute / targetDistance * 100 : 0)
    : absolute;

  return { ...point, positionMode: nextMode, position };
}

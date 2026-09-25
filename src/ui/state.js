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

export function getPointCoordinates(point, targetDistance) {
  if (point.locked) {
    const percent = Number(point.position) || 0;
    return {
      percent,
      distance: targetDistance * percent / 100
    };
  }

  if (point.positionMode === 'distance') {
    const distance = Number(point.position) || 0;
    return {
      distance,
      percent: targetDistance > 0 ? distance / targetDistance * 100 : 0
    };
  }

  const percent = Number(point.position) || 0;
  return {
    percent,
    distance: targetDistance * percent / 100
  };
}

export function setPointFromPercent(point, percent, targetDistance) {
  if (point.locked) return point;
  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return {
    ...point,
    positionMode: 'percent',
    position: clampedPercent
  };
}

export function setPointFromDistance(point, distance, targetDistance) {
  if (point.locked) return point;
  const maxDistance = Math.max(0, Number(targetDistance) || 0);
  const clampedDistance = Math.max(0, Math.min(maxDistance, Number(distance) || 0));
  return {
    ...point,
    positionMode: 'distance',
    position: clampedDistance
  };
}

export const MIN_TARGET_DISTANCE = 100;
export const MIN_POINT_GAP_METERS = 1;

export const createInitialState = () => ({
  profile: null,
  calibration: null,
  targetDistance: MIN_TARGET_DISTANCE,
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

export function clampTargetDistance(value, maxDistance = Infinity) {
  const numeric = Number(value);
  const maxNumeric = Number(maxDistance);
  const safeMax = Number.isFinite(maxNumeric)
    ? Math.max(MIN_TARGET_DISTANCE, maxNumeric)
    : Infinity;
  if (!Number.isFinite(numeric)) return MIN_TARGET_DISTANCE;
  return Math.min(safeMax, Math.max(MIN_TARGET_DISTANCE, numeric));
}

export function getProfileMaxRange(profile) {
  const rows = profile?.trajectory;
  if (!Array.isArray(rows) || rows.length === 0) return MIN_TARGET_DISTANCE;
  const maxRange = Number(rows.at(-1)?.range);
  return Number.isFinite(maxRange) ? Math.max(MIN_TARGET_DISTANCE, maxRange) : MIN_TARGET_DISTANCE;
}

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

export function getPointBounds(points, index, targetDistance) {
  const previous = points[index - 1];
  const next = points[index + 1];
  const previousDistance = previous ? getPointCoordinates(previous, targetDistance).distance : 0;
  const nextDistance = next ? getPointCoordinates(next, targetDistance).distance : targetDistance;

  const minDistance = Math.min(targetDistance, previousDistance + MIN_POINT_GAP_METERS);
  const maxDistance = Math.max(0, nextDistance - MIN_POINT_GAP_METERS);

  return {
    minDistance,
    maxDistance,
    minPercent: targetDistance > 0 ? minDistance / targetDistance * 100 : 0,
    maxPercent: targetDistance > 0 ? maxDistance / targetDistance * 100 : 100
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

export function setPointFromPercent(point, percent, targetDistance, bounds = null) {
  if (point.locked) return point;
  const numeric = Number(percent) || 0;
  const minPercent = bounds?.minPercent ?? 0;
  const maxPercent = bounds?.maxPercent ?? 100;
  const clampedPercent = clamp(numeric, minPercent, maxPercent);
  return {
    ...point,
    positionMode: 'percent',
    position: clampedPercent
  };
}

export function setPointFromDistance(point, distance, targetDistance, bounds = null) {
  if (point.locked) return point;
  const maxTarget = Math.max(0, Number(targetDistance) || 0);
  const minDistance = bounds?.minDistance ?? 0;
  const maxDistance = bounds?.maxDistance ?? maxTarget;
  const numeric = Number(distance) || 0;
  const clampedDistance = clamp(numeric, minDistance, maxDistance);
  return {
    ...point,
    positionMode: 'distance',
    position: clampedDistance
  };
}

export function normalizeWindPointPositions(points, targetDistance) {
  if (points.length <= 2) return points;
  const result = points.map(point => ({ ...point }));

  // Forward pass: each point must be at least 1 m after the previous point.
  for (let i = 1; i < result.length - 1; i += 1) {
    const prevDistance = getPointCoordinates(result[i - 1], targetDistance).distance;
    const current = getPointCoordinates(result[i], targetDistance);
    const minDistance = prevDistance + MIN_POINT_GAP_METERS;
    if (current.distance < minDistance) {
      result[i] = result[i].positionMode === 'percent'
        ? { ...result[i], position: minDistance / targetDistance * 100 }
        : { ...result[i], position: minDistance };
    }
  }

  // Backward pass: each point must be at least 1 m before the next point.
  for (let i = result.length - 2; i >= 1; i -= 1) {
    const nextDistance = getPointCoordinates(result[i + 1], targetDistance).distance;
    const current = getPointCoordinates(result[i], targetDistance);
    const maxDistance = nextDistance - MIN_POINT_GAP_METERS;
    if (current.distance > maxDistance) {
      result[i] = result[i].positionMode === 'percent'
        ? { ...result[i], position: maxDistance / targetDistance * 100 }
        : { ...result[i], position: maxDistance };
    }
  }

  return result;
}

export function findLargestGapMidpoint(points, targetDistance) {
  let best = null;
  let bestGap = -Infinity;

  for (let i = 0; i < points.length - 1; i += 1) {
    const left = getPointCoordinates(points[i], targetDistance).distance;
    const right = getPointCoordinates(points[i + 1], targetDistance).distance;
    const gap = right - left;
    if (gap > bestGap) {
      bestGap = gap;
      best = { index: i + 1, distance: left + gap / 2 };
    }
  }

  if (!best || bestGap < MIN_POINT_GAP_METERS * 2) return null;
  return best;
}

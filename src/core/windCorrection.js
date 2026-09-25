import { buildWindInterpolator } from './windInterpolation.js?v=0.6.1';
import { interpolateTrajectoryValue, mcCoyLitzSegmentWeights } from './trajectory.js?v=0.6.1';

const EPS = 1e-12;

export function calibrationSensitivityAtRange(profile, calibration, targetDistance) {
  const windage = interpolateTrajectoryValue(profile, targetDistance, calibration.windageKey);
  return Math.abs(windage) / calibration.crosswind;
}

export function calculateWindCorrection({
  profile,
  calibration,
  targetDistance,
  windPoints,
  interpolation = 'linear'
}) {
  if (!calibration) throw new Error('Wind calibration is required');

  const { valueAt, points } = buildWindInterpolator(windPoints, targetDistance, interpolation);
  const weights = mcCoyLitzSegmentWeights(profile, targetDistance);

  let effectiveWind = 0;
  const contributions = [];

  for (const segment of weights.segments) {
    const crosswind = valueAt(segment.xMid);
    effectiveWind += crosswind * segment.weight;
    contributions.push({
      ...segment,
      crosswind,
      weighted: crosswind * segment.weight
    });
  }

  const sensitivity = calibrationSensitivityAtRange(profile, calibration, targetDistance);
  const correctionMrad = sensitivity * effectiveWind;

  return {
    targetDistance,
    interpolation,
    effectiveWind,
    sensitivity,
    calibration,
    correctionMrad,
    side: correctionMrad > EPS ? 'R' : correctionMrad < -EPS ? 'L' : 'NONE',
    activeWindPoints: points,
    contributions
  };
}

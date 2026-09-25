const EPS = 1e-12;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function interpolateTrajectoryValue(profile, x, key) {
  const rows = profile.trajectory;
  const muzzleVelocity = profile.metadata.muzzleVelocity;

  if (x <= 0) {
    if (key === 'velocity') return muzzleVelocity;
    if (key === 'windage1' || key === 'windage2') return 0;
  }

  if (x <= rows[0].range) {
    const t = x / rows[0].range;
    const a = key === 'velocity' ? muzzleVelocity : 0;
    return lerp(a, rows[0][key], t);
  }

  if (x > rows.at(-1).range) {
    throw new Error(`Target ${x} m exceeds profile max range ${rows.at(-1).range} m`);
  }

  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (rows[m].range <= x) lo = m;
    else hi = m;
  }

  if (Math.abs(rows[lo].range - x) < EPS) return rows[lo][key];

  const t = (x - rows[lo].range) / (rows[hi].range - rows[lo].range);
  return lerp(rows[lo][key], rows[hi][key], t);
}

export function buildTrajectoryToTarget(profile, targetDistance) {
  const rows = profile.trajectory;
  const mv = profile.metadata.muzzleVelocity;

  if (!Number.isFinite(mv)) throw new Error('Muzzle velocity missing');
  if (!(targetDistance > 0)) throw new Error('Target distance must be > 0');
  if (targetDistance > rows.at(-1).range) {
    throw new Error(`Target exceeds profile max range ${rows.at(-1).range} m`);
  }

  const xs = [0];
  for (const r of rows) {
    if (r.range < targetDistance - EPS) xs.push(r.range);
  }
  if (Math.abs(xs.at(-1) - targetDistance) > EPS) xs.push(targetDistance);

  const nodes = xs.map(x => ({
    x,
    velocity: interpolateTrajectoryValue(profile, x, 'velocity')
  }));

  // AB exports ToF rounded to 0.01 s. Reconstruct it from velocity samples.
  nodes[0].tof = 0;
  for (let i = 1; i < nodes.length; i++) {
    const dx = nodes[i].x - nodes[i - 1].x;
    nodes[i].tof = nodes[i - 1].tof
      + dx * (1 / nodes[i - 1].velocity + 1 / nodes[i].velocity) / 2;
  }

  return nodes;
}

export function mcCoyLitzSegmentWeights(profile, targetDistance) {
  const nodes = buildTrajectoryToTarget(profile, targetDistance);
  const R = targetDistance;
  const tR = nodes.at(-1).tof;

  for (const n of nodes) {
    n.F = tR - n.tof - (R - n.x) / n.velocity;
  }

  const segments = [];
  let sum = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    let factor = nodes[i].F - nodes[i + 1].F;

    if (factor < 0 && factor > -1e-10) factor = 0;
    if (factor < -1e-10) {
      throw new Error(`Negative McCoy/Litz segment factor near ${nodes[i].x} m: ${factor}`);
    }

    sum += factor;
    segments.push({
      x0: nodes[i].x,
      x1: nodes[i + 1].x,
      xMid: (nodes[i].x + nodes[i + 1].x) / 2,
      factor
    });
  }

  if (!(sum > 0)) throw new Error('McCoy/Litz weight sum is not positive');

  for (const segment of segments) {
    segment.weight = segment.factor / sum;
  }

  return { segments, factorSum: sum, nodes };
}

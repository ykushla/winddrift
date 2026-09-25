const EPS = 1e-12;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clockToCorrectionComponent(speed, clock) {
  // Clock is WIND-FROM direction.
  // 3 o'clock wind pushes bullet left, so required correction is RIGHT (+).
  const hour = ((Number(clock) % 12) + 12) % 12;
  const theta = hour * Math.PI / 6;
  return Number(speed) * Math.sin(theta);
}

export function windPointToSignedCrosswind(point) {
  if (Number.isFinite(point.crosswind)) return point.crosswind;
  return clockToCorrectionComponent(point.speed, point.clock);
}

export function resolveWindPointX(point, targetDistance) {
  if (point.positionMode === 'percent') return targetDistance * Number(point.position) / 100;
  if (point.positionMode === 'distance') return Number(point.position);
  throw new Error(`Unknown positionMode: ${point.positionMode}`);
}

export function normalizeWindPoints(points, targetDistance) {
  const active = points
    .map((p, index) => ({
      ...p,
      index,
      x: resolveWindPointX(p, targetDistance),
      crosswind: windPointToSignedCrosswind(p)
    }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.crosswind) && p.x >= 0 && p.x <= targetDistance);

  active.sort((a, b) => a.x - b.x);

  if (!active.length || active[0].x > EPS || active[active.length - 1].x < targetDistance - EPS) {
    throw new Error('Active wind points must include 0% and 100% endpoints');
  }

  const dedup = [];
  for (const p of active) {
    if (dedup.length && Math.abs(dedup[dedup.length - 1].x - p.x) < EPS) {
      dedup[dedup.length - 1] = p;
    } else {
      dedup.push(p);
    }
  }

  return dedup;
}

function linearInterpolator(points) {
  return x => {
    if (x <= points[0].x) return points[0].crosswind;
    if (x >= points.at(-1).x) return points.at(-1).crosswind;

    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (points[m].x <= x) lo = m;
      else hi = m;
    }

    const a = points[lo];
    const b = points[hi];
    return lerp(a.crosswind, b.crosswind, (x - a.x) / (b.x - a.x));
  };
}

function pchipInterpolator(points) {
  if (points.length === 2) return linearInterpolator(points);

  const x = points.map(p => p.x);
  const y = points.map(p => p.crosswind);
  const n = points.length;
  const h = Array(n - 1);
  const delta = Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    delta[i] = (y[i + 1] - y[i]) / h[i];
  }

  const d = Array(n).fill(0);

  for (let k = 1; k < n - 1; k++) {
    if (delta[k - 1] === 0 || delta[k] === 0 || Math.sign(delta[k - 1]) !== Math.sign(delta[k])) {
      d[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
    }
  }

  const endpoint = (h0, h1, del0, del1) => {
    let val = ((2 * h0 + h1) * del0 - h0 * del1) / (h0 + h1);
    if (Math.sign(val) !== Math.sign(del0)) val = 0;
    else if (Math.sign(del0) !== Math.sign(del1) && Math.abs(val) > Math.abs(3 * del0)) val = 3 * del0;
    return val;
  };

  d[0] = endpoint(h[0], h[1], delta[0], delta[1]);
  d[n - 1] = endpoint(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);

  return q => {
    if (q <= x[0]) return y[0];
    if (q >= x[n - 1]) return y[n - 1];

    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (x[m] <= q) lo = m;
      else hi = m;
    }

    const hh = x[hi] - x[lo];
    const t = (q - x[lo]) / hh;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
    const h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2;
    const h11 = t ** 3 - t ** 2;

    return h00 * y[lo] + h10 * hh * d[lo] + h01 * y[hi] + h11 * hh * d[hi];
  };
}

export function buildWindInterpolator(points, targetDistance, model = 'linear') {
  const normalized = normalizeWindPoints(points, targetDistance);
  if (model === 'linear') return { points: normalized, valueAt: linearInterpolator(normalized) };
  if (model === 'pchip') return { points: normalized, valueAt: pchipInterpolator(normalized) };
  throw new Error(`Unknown interpolation model: ${model}`);
}

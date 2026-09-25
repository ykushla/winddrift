function parseDirectional(value, positiveLetter = 'R', negativeLetter = 'L') {
  if (value == null || value === '') return NaN;
  const s = String(value).trim();
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*([A-Za-z])?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  const dir = (m[2] || '').toUpperCase();
  if (dir === negativeLetter) return -Math.abs(n);
  if (dir === positiveLetter) return Math.abs(n);
  return n;
}

function pairsToObject(cells) {
  const o = {};
  for (let i = 0; i + 1 < cells.length; i += 2) {
    o[cells[i].trim()] = cells[i + 1].trim();
  }
  return o;
}

export function parseClockDirection(value) {
  if (value == null) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (!(h >= 1 && h <= 12) || !(min >= 0 && min < 60)) return null;
  if (h === 12) h = 0;
  return h + min / 60;
}

export function crosswindMagnitude(speed, clock) {
  if (!Number.isFinite(speed) || !Number.isFinite(clock)) return null;
  const theta = clock * Math.PI / 6;
  return Math.abs(speed * Math.sin(theta));
}

export function parseAppliedBallisticsCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length || !lines[0].startsWith('Rangecard Export')) {
    throw new Error('Not an Applied Ballistics Rangecard Export');
  }

  const titleMatch = lines[0].match(/^Rangecard Export(?: \((.*)\))?$/);
  const metadata = { title: titleMatch?.[1] || 'Applied Ballistics profile' };
  let headerIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('Range [M],')) {
      headerIndex = i;
      break;
    }
    Object.assign(metadata, pairsToObject(lines[i].split(',')));
  }
  if (headerIndex < 0) throw new Error('Trajectory header not found');

  const headers = lines[headerIndex].split(',').map(s => s.trim());
  const required = ['Range [M]', 'Windage [MRAD]', 'Windage 2 [MRAD]', 'ToF [SEC]', 'Velocity [M/S]'];
  for (const h of required) {
    if (!headers.includes(h)) throw new Error(`Required column missing: ${h}`);
  }

  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const trajectory = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const range = Number(c[idx['Range [M]']]);
    if (!Number.isFinite(range)) continue;

    const velocity = Number(c[idx['Velocity [M/S]']]);
    const tofCsv = Number(c[idx['ToF [SEC]']]);
    const windage1Signed = parseDirectional(c[idx['Windage [MRAD]']], 'R', 'L');
    const windage2Signed = parseDirectional(c[idx['Windage 2 [MRAD]']], 'R', 'L');

    if (![velocity, tofCsv, windage1Signed, windage2Signed].every(Number.isFinite)) {
      throw new Error(`Invalid numeric trajectory data at range ${range} m`);
    }

    trajectory.push({
      range,
      velocity,
      tofCsv,
      windage1: Math.abs(windage1Signed),
      windage2: Math.abs(windage2Signed)
    });
  }

  if (trajectory.length < 2) throw new Error('Too few trajectory rows');

  const num = key => {
    const v = metadata[key];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const windDirectionRaw = metadata['Wind Direction'] || null;
  const windClock = parseClockDirection(windDirectionRaw);

  return {
    format: 'applied-ballistics-rangecard-v2',
    name: metadata.title,
    metadata: {
      muzzleVelocity: num('MV [M/S]'),
      bulletWeightGr: num('BW [GR]'),
      bulletDiameterMm: num('BD [MM]'),
      windSpeed1: num('Wind Speed [M/S]'),
      windSpeed2: num('Wind Speed 2 [M/S]'),
      windDirection: windDirectionRaw,
      windClock,
      temperatureC: num('TEMP [°C]'),
      pressureMbar: num('Pressure [MBAR]'),
      humidityPct: num('Humidity [%]'),
      inclinationDeg: num('Inclination [°]'),
      headingDeg: num('Heading [°]'),
      raw: metadata
    },
    trajectory
  };
}

export function chooseWindCalibration(profile, { minCrosswind = 1e-6 } = {}) {
  const m = profile?.metadata || {};
  if (!Number.isFinite(m.windClock)) {
    throw new Error(`Unsupported or missing Wind Direction: ${m.windDirection ?? 'none'}`);
  }

  const candidates = [
    { id: 1, speed: m.windSpeed1, windageKey: 'windage1' },
    { id: 2, speed: m.windSpeed2, windageKey: 'windage2' }
  ]
    .filter(c => Number.isFinite(c.speed))
    .sort((a, b) => Math.abs(b.speed) - Math.abs(a.speed));

  for (const c of candidates) {
    const crosswind = crosswindMagnitude(c.speed, m.windClock);
    if (Number.isFinite(crosswind) && crosswind > minCrosswind) {
      return {
        ...c,
        direction: m.windDirection,
        clock: m.windClock,
        crosswind
      };
    }
  }

  throw new Error('No usable crosswind in the AB Range Card. Export with wind having a lateral component.');
}

export function validateWindProfile(profile) {
  const errors = [];
  const warnings = [
    'Generate the Applied Ballistics Range Card with Spin Drift, Coriolis and other non-wind horizontal corrections disabled.'
  ];

  try {
    chooseWindCalibration(profile);
  } catch (e) {
    errors.push(e.message);
  }

  const rows = profile?.trajectory || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].range <= rows[i - 1].range) errors.push('Ranges are not strictly increasing');
  }
  if (rows[0]?.range > 5) warnings.push(`First trajectory row is ${rows[0].range} m; 5 m is preferred`);

  return { ok: errors.length === 0, errors, warnings };
}

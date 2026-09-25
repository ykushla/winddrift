import {
  parseAppliedBallisticsCsv,
  chooseWindCalibration,
  validateWindProfile,
  calculateWindCorrection
} from '../core/index.js';
import { createInitialState, getPointCoordinates, setPointFromPercent, setPointFromDistance } from './state.js';
import { windPointTemplate, formatNumber, clockLabel, clockFaceTemplate, normalizeClock } from './components.js';

const state = createInitialState();
const $ = selector => document.querySelector(selector);

const els = {
  profileName: $('#profile-name'),
  profileMeta: $('#profile-meta'),
  importInput: $('#csv-input'),
  importButton: $('#import-button'),
  importMessage: $('#import-message'),
  targetDistance: $('#target-distance'),
  windPoints: $('#wind-points'),
  addPoint: $('#add-point'),
  resultSide: $('#result-side'),
  resultNumber: $('#result-number'),
  effectiveWind: $('#effective-wind'),
  resultDetails: $('#result-details'),
  clockDialog: $('#clock-dialog'),
  clockFace: $('#clock-face'),
  clockTitle: $('#clock-title')
};

let editingClockPointId = null;
let clockDragging = false;
let previewClock = null;

function trimRedundantLeadingZeros(input) {
  const value = input.value;
  if (!value) return;
  const normalized = value.replace(/^0+(?=\d)/, '');
  if (normalized !== value) input.value = normalized;
}

function setImportMessage(message, type = 'info') {
  els.importMessage.className = `message ${type}`;
  els.importMessage.textContent = message;
}

function renderProfile() {
  if (!state.profile) {
    els.profileName.textContent = 'Профіль не завантажено';
    els.profileMeta.textContent = 'Імпортуй CSV Range Card з Applied Ballistics.';
    return;
  }

  els.profileName.textContent = state.profile.name;
  const m = state.profile.metadata;
  els.profileMeta.textContent = [
    Number.isFinite(m.muzzleVelocity) ? `${m.muzzleVelocity} м/с V₀` : null,
    Number.isFinite(m.bulletWeightGr) ? `${m.bulletWeightGr} gr` : null,
    state.calibration ? `калібрування: ${state.calibration.speed} м/с @ ${state.calibration.direction}` : null
  ].filter(Boolean).join(' · ');
}

function renderWindPoints() {
  els.windPoints.innerHTML = state.windPoints
    .map(p => windPointTemplate(p, state.targetDistance))
    .join('');
}

function renderResult() {
  if (!state.profile) {
    els.resultSide.textContent = '—';
    els.resultNumber.textContent = '—';
    els.effectiveWind.textContent = 'Імпортуй профіль для розрахунку';
    els.resultDetails.textContent = '';
    return;
  }

  if (state.error || !state.result) {
    els.resultSide.textContent = '!';
    els.resultNumber.textContent = '—';
    els.effectiveWind.textContent = state.error || 'Не вдалося виконати розрахунок';
    els.resultDetails.textContent = '';
    return;
  }

  const r = state.result;
  els.resultSide.textContent = r.side === 'NONE' ? '—' : r.side;
  els.resultNumber.textContent = formatNumber(Math.abs(r.correctionMrad), 2);
  els.effectiveWind.textContent = `Ефективний поперечний вітер: ${formatNumber(r.effectiveWind, 2)} м/с`;
  els.resultDetails.textContent = `Чутливість: ${formatNumber(r.sensitivity, 4)} mrad/(м/с)`;
}

function recalculate() {
  state.error = null;
  state.result = null;

  if (!state.profile || !state.calibration) {
    renderResult();
    return;
  }

  try {
    state.result = calculateWindCorrection({
      profile: state.profile,
      calibration: state.calibration,
      targetDistance: state.targetDistance,
      windPoints: state.windPoints,
      interpolation: 'linear'
    });
  } catch (error) {
    state.error = error.message;
  }

  renderResult();
}

function setClockPreview(clock) {
  previewClock = normalizeClock(clock);
  els.clockTitle.textContent = clockLabel(previewClock);
  els.clockFace.querySelectorAll('[data-clock-value]').forEach(mark => {
    const selected = Math.abs(normalizeClock(mark.dataset.clockValue) - previewClock) < 1e-9;
    mark.classList.toggle('selected', selected);
    mark.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function clockFromPointer(event) {
  const rect = els.clockFace.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  let degrees = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (degrees < 0) degrees += 360;
  const rawClock = degrees / 30;
  const rounded = Math.round(rawClock * 2) / 2;
  return rounded === 0 ? 12 : rounded;
}

function openClock(pointId) {
  const point = state.windPoints.find(p => p.id === pointId);
  if (!point) return;
  editingClockPointId = pointId;
  previewClock = point.clock;
  els.clockTitle.textContent = clockLabel(point.clock);
  els.clockFace.innerHTML = clockFaceTemplate(point.clock);
  els.clockDialog.hidden = false;
  document.body.classList.add('modal-open');
}

function closeClock() {
  editingClockPointId = null;
  previewClock = null;
  clockDragging = false;
  els.clockDialog.hidden = true;
  document.body.classList.remove('modal-open');
}

function commitClock(clock) {
  const point = state.windPoints.find(p => p.id === editingClockPointId);
  if (!point) return;
  point.clock = normalizeClock(clock);
  renderWindPoints();
  recalculate();
  closeClock();
}

async function importCsv(file) {
  const text = await file.text();
  const profile = parseAppliedBallisticsCsv(text);
  const validation = validateWindProfile(profile);
  if (!validation.ok) throw new Error(validation.errors.join(' '));

  const calibration = chooseWindCalibration(profile);
  state.profile = profile;
  state.calibration = calibration;
  state.importWarnings = validation.warnings;

  const maxRange = profile.trajectory.at(-1).range;
  if (state.targetDistance > maxRange) {
    state.targetDistance = Math.min(500, maxRange);
    els.targetDistance.value = state.targetDistance;
  }

  renderProfile();
  renderWindPoints();
  recalculate();

  const warningText = validation.warnings.length
    ? ` Попередження: ${validation.warnings.join(' ')}`
    : '';
  setImportMessage(`Профіль «${profile.name}» імпортовано.${warningText}`, 'success');
}

els.importButton.addEventListener('click', () => els.importInput.click());
els.importInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await importCsv(file);
  } catch (error) {
    setImportMessage(error.message, 'error');
  } finally {
    event.target.value = '';
  }
});

els.targetDistance.addEventListener('input', event => {
  trimRedundantLeadingZeros(event.target);
  const value = Number(event.target.value);
  if (!(value > 0)) return;
  state.targetDistance = value;
  renderWindPoints();
  recalculate();
});

els.addPoint.addEventListener('click', () => {
  state.windPoints.splice(state.windPoints.length - 1, 0, {
    id: crypto.randomUUID(),
    locked: false,
    positionMode: 'percent',
    position: 50,
    speed: 0,
    clock: 3
  });
  renderWindPoints();
  recalculate();
});

function updatePositionControls(point, card) {
  const { percent, distance } = getPointCoordinates(point, state.targetDistance);
  const slider = card.querySelector('.position-slider');
  const percentValue = card.querySelector('.percent-value-number');
  const distanceInput = card.querySelector('.position-input');

  if (slider) slider.value = Math.max(0, Math.min(100, percent));
  if (percentValue) percentValue.textContent = formatNumber(percent, 0);
  if (distanceInput && document.activeElement !== distanceInput) {
    distanceInput.value = formatNumber(distance, 0);
  }
}

els.windPoints.addEventListener('input', event => {
  const card = event.target.closest('[data-point-id]');
  if (!card) return;
  const index = state.windPoints.findIndex(p => p.id === card.dataset.pointId);
  if (index < 0) return;
  let point = state.windPoints[index];

  if (event.target.matches('.position-input, .speed-input')) trimRedundantLeadingZeros(event.target);

  if (event.target.matches('.position-slider')) {
    point = setPointFromPercent(point, Number(event.target.value), state.targetDistance);
    state.windPoints[index] = point;
    const coords = getPointCoordinates(point, state.targetDistance);
    const distanceInput = card.querySelector('.position-input');
    const percentValue = card.querySelector('.percent-value-number');
    if (distanceInput) distanceInput.value = formatNumber(coords.distance, 0);
    if (percentValue) percentValue.textContent = formatNumber(coords.percent, 0);
  }

  if (event.target.matches('.position-input')) {
    point = setPointFromDistance(point, Number(event.target.value), state.targetDistance);
    state.windPoints[index] = point;
    const coords = getPointCoordinates(point, state.targetDistance);
    const slider = card.querySelector('.position-slider');
    const percentValue = card.querySelector('.percent-value-number');
    if (slider) slider.value = Math.max(0, Math.min(100, coords.percent));
    if (percentValue) percentValue.textContent = formatNumber(coords.percent, 0);
  }

  if (event.target.matches('.speed-input')) point.speed = Number(event.target.value);

  recalculate();
});

els.windPoints.addEventListener('change', event => {
  if (!event.target.matches('.position-input')) return;
  const card = event.target.closest('[data-point-id]');
  if (!card) return;
  const point = state.windPoints.find(p => p.id === card.dataset.pointId);
  if (!point) return;
  const { distance } = getPointCoordinates(point, state.targetDistance);
  event.target.value = formatNumber(distance, 0);
});

els.windPoints.addEventListener('click', event => {
  const card = event.target.closest('[data-point-id]');
  if (!card) return;
  const index = state.windPoints.findIndex(p => p.id === card.dataset.pointId);
  if (index < 0) return;

  if (event.target.closest('.clock-button')) {
    openClock(state.windPoints[index].id);
    return;
  }

  if (event.target.closest('.remove-point')) {
    state.windPoints.splice(index, 1);
    renderWindPoints();
    recalculate();
  }
});

els.clockFace.addEventListener('pointerdown', event => {
  if (!editingClockPointId) return;
  clockDragging = true;
  els.clockFace.setPointerCapture?.(event.pointerId);
  setClockPreview(clockFromPointer(event));
  event.preventDefault();
});

els.clockFace.addEventListener('pointermove', event => {
  if (!clockDragging || !editingClockPointId) return;
  setClockPreview(clockFromPointer(event));
  event.preventDefault();
});

els.clockFace.addEventListener('pointerup', event => {
  if (!clockDragging || !editingClockPointId) return;
  setClockPreview(clockFromPointer(event));
  clockDragging = false;
  commitClock(previewClock);
  event.preventDefault();
});

els.clockFace.addEventListener('pointercancel', () => {
  clockDragging = false;
});

els.clockDialog.addEventListener('click', event => {
  if (event.target.closest('[data-clock-close]')) closeClock();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.clockDialog.hidden) closeClock();
});

els.targetDistance.value = state.targetDistance;
renderProfile();
renderWindPoints();
renderResult();

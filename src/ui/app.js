import {
  parseAppliedBallisticsCsv,
  chooseWindCalibration,
  validateWindProfile,
  calculateWindCorrection
} from '../core/index.js';
import { createInitialState, updatePointPositionMode } from './state.js';
import { windPointTemplate, formatNumber, clockLabel, clockFaceTemplate } from './components.js';

const state = createInitialState();
const $ = selector => document.querySelector(selector);

const els = {
  profileName: $('#profile-name'),
  profileMeta: $('#profile-meta'),
  importInput: $('#csv-input'),
  importButton: $('#import-button'),
  importMessage: $('#import-message'),
  targetDistance: $('#target-distance'),
  interpolation: $('#interpolation'),
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

function setImportMessage(message, type = 'info') {
  els.importMessage.className = `message ${type}`;
  els.importMessage.textContent = message;
}

function renderProfile() {
  if (!state.profile) {
    els.profileName.textContent = 'No profile loaded';
    els.profileMeta.textContent = 'Import an Applied Ballistics Range Card CSV.';
    return;
  }

  els.profileName.textContent = state.profile.name;
  const m = state.profile.metadata;
  els.profileMeta.textContent = [
    Number.isFinite(m.muzzleVelocity) ? `${m.muzzleVelocity} m/s MV` : null,
    Number.isFinite(m.bulletWeightGr) ? `${m.bulletWeightGr} gr` : null,
    state.calibration ? `cal: ${state.calibration.speed} m/s @ ${state.calibration.direction}` : null
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
    els.effectiveWind.textContent = 'Import a profile to calculate';
    els.resultDetails.textContent = '';
    return;
  }

  if (state.error || !state.result) {
    els.resultSide.textContent = '!';
    els.resultNumber.textContent = '—';
    els.effectiveWind.textContent = state.error || 'Unable to calculate';
    els.resultDetails.textContent = '';
    return;
  }

  const r = state.result;
  els.resultSide.textContent = r.side === 'NONE' ? '—' : r.side;
  els.resultNumber.textContent = formatNumber(Math.abs(r.correctionMrad), 2);
  els.effectiveWind.textContent = `Effective crosswind ${formatNumber(r.effectiveWind, 2)} m/s`;
  els.resultDetails.textContent = `Sensitivity ${formatNumber(r.sensitivity, 4)} mrad/(m/s)`;
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
      interpolation: state.interpolation
    });
  } catch (error) {
    state.error = error.message;
  }

  renderResult();
}

function openClock(pointId) {
  const point = state.windPoints.find(p => p.id === pointId);
  if (!point) return;
  editingClockPointId = pointId;
  els.clockTitle.textContent = clockLabel(point.clock);
  els.clockFace.innerHTML = clockFaceTemplate(point.clock);
  els.clockDialog.hidden = false;
  document.body.classList.add('modal-open');
}

function closeClock() {
  editingClockPointId = null;
  els.clockDialog.hidden = true;
  document.body.classList.remove('modal-open');
}

function chooseClock(clock) {
  const point = state.windPoints.find(p => p.id === editingClockPointId);
  if (!point) return;
  point.clock = Number(clock);
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
    ? ` Imported. Warning: ${validation.warnings.join(' ')}`
    : ' Imported.';
  setImportMessage(`Profile ${profile.name}.${warningText}`, 'success');
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
  const value = Number(event.target.value);
  if (!(value > 0)) return;
  state.targetDistance = value;
  renderWindPoints();
  recalculate();
});

els.interpolation.addEventListener('click', event => {
  const button = event.target.closest('button[data-model]');
  if (!button) return;
  state.interpolation = button.dataset.model;
  [...els.interpolation.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b === button));
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

els.windPoints.addEventListener('input', event => {
  const card = event.target.closest('[data-point-id]');
  if (!card) return;
  const point = state.windPoints.find(p => p.id === card.dataset.pointId);
  if (!point) return;

  if (event.target.matches('.position-input')) point.position = Number(event.target.value);
  if (event.target.matches('.speed-input')) point.speed = Number(event.target.value);
  recalculate();
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

  const modeButton = event.target.closest('button[data-mode]');
  if (modeButton) {
    state.windPoints[index] = updatePointPositionMode(state.windPoints[index], modeButton.dataset.mode, state.targetDistance);
    renderWindPoints();
    recalculate();
    return;
  }

  if (event.target.closest('.remove-point')) {
    if (!state.windPoints[index].locked) state.windPoints.splice(index, 1);
    renderWindPoints();
    recalculate();
  }
});

els.clockFace.addEventListener('click', event => {
  const mark = event.target.closest('[data-clock-value]');
  if (!mark) return;
  chooseClock(mark.dataset.clockValue);
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

import { APP_VERSION } from '../version.js';
import {
  parseAppliedBallisticsCsv,
  chooseWindCalibration,
  validateWindProfile,
  calculateWindCorrection
} from '../core/index.js';
import {
  createInitialState,
  getPointCoordinates,
  getPointBounds,
  setPointFromPercent,
  setPointFromDistance,
  normalizeWindPointPositions,
  findLargestGapMidpoint,
  clampTargetDistance,
  getProfileMaxRange,
  MIN_TARGET_DISTANCE
} from './state.js';
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
  clockTitle: $('#clock-title'),
  appVersion: $('#app-version'),
  navMenuButton: $('#nav-menu-button'),
  navMenu: $('#nav-menu'),
  themeToggle: $('#theme-toggle'),
  themeLabel: $('#theme-label'),
  themeIcon: $('#theme-icon'),
  themeColorMeta: $('#theme-color-meta'),
  referenceHome: $('#reference-home'),
  referenceMirage: $('#reference-mirage')
};


if (els.appVersion) {
  els.appVersion.textContent = APP_VERSION;
}


const pageLabels = {
  calculator: 'Вітрова поправка',
  about: 'Як працює додаток',
  reference: 'Довідник'
};

const THEME_STORAGE_KEY = 'wind-drift-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = safeTheme;
  localStorage.setItem(THEME_STORAGE_KEY, safeTheme);

  const nextTheme = safeTheme === 'dark' ? 'light' : 'dark';
  if (els.themeLabel) els.themeLabel.textContent = nextTheme === 'light' ? 'Світла тема' : 'Темна тема';
  if (els.themeIcon) els.themeIcon.textContent = nextTheme === 'light' ? '☀︎' : '☾';
  if (els.themeToggle) els.themeToggle.setAttribute(
    'aria-label',
    nextTheme === 'light' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'
  );
  if (els.themeColorMeta) els.themeColorMeta.content = safeTheme === 'light' ? '#f3f7fb' : '#06101d';
}

function closeNavMenu() {
  if (!els.navMenu || !els.navMenuButton) return;
  els.navMenu.hidden = true;
  els.navMenuButton.setAttribute('aria-expanded', 'false');
}

function openNavMenu() {
  if (!els.navMenu || !els.navMenuButton) return;
  els.navMenu.hidden = false;
  els.navMenuButton.setAttribute('aria-expanded', 'true');
}

function showPage(pageName) {
  const safePage = pageLabels[pageName] ? pageName : 'calculator';
  document.querySelectorAll('[data-page]').forEach(page => {
    const active = page.dataset.page === safePage;
    page.hidden = !active;
    page.classList.toggle('active', active);
  });
  document.querySelectorAll('[data-page-target]').forEach(item => {
    item.classList.toggle('active', item.dataset.pageTarget === safePage);
  });
  closeNavMenu();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showReferenceView(viewName) {
  const showMirage = viewName === 'mirage';
  if (els.referenceHome) els.referenceHome.hidden = showMirage;
  if (els.referenceMirage) els.referenceMirage.hidden = !showMirage;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

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
    .map((p, index) => windPointTemplate(
      p,
      state.targetDistance,
      p.locked ? null : getPointBounds(state.windPoints, index, state.targetDistance)
    ))
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

  const maxRange = getProfileMaxRange(profile);
  els.targetDistance.max = Number.isFinite(maxRange) ? maxRange : '';
  state.targetDistance = clampTargetDistance(state.targetDistance, maxRange);
  els.targetDistance.value = formatNumber(state.targetDistance, 0);

  renderProfile();
  renderWindPoints();
  recalculate();

  els.importMessage.hidden = true;
  els.importMessage.textContent = '';
}

els.importButton.addEventListener('click', () => els.importInput.click());
els.importInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await importCsv(file);
  } catch (error) {
    els.importMessage.hidden = false;
    setImportMessage(error.message, 'error');
  } finally {
    event.target.value = '';
  }
});

function commitTargetDistanceInput(input) {
  const rawValue = input.value.trim();
  const requested = rawValue === '' ? NaN : Number(rawValue);

  if (!Number.isFinite(requested)) {
    input.value = formatNumber(state.targetDistance, 0);
    return;
  }

  const value = clampTargetDistance(requested, getProfileMaxRange(state.profile));
  state.targetDistance = value;
  input.value = formatNumber(value, 0);
  state.windPoints = normalizeWindPointPositions(state.windPoints, state.targetDistance);
  renderWindPoints();
  recalculate();
}

els.targetDistance.addEventListener('change', event => {
  commitTargetDistanceInput(event.target);
});

els.targetDistance.addEventListener('blur', event => {
  commitTargetDistanceInput(event.target);
});

els.targetDistance.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitTargetDistanceInput(event.target);
    event.target.blur();
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    requestAnimationFrame(() => commitTargetDistanceInput(event.target));
  }
});

els.addPoint.addEventListener('click', () => {
  const candidate = findLargestGapMidpoint(state.windPoints, state.targetDistance);
  if (!candidate || candidate.distance < 1 || candidate.distance > state.targetDistance - 1) return;

  state.windPoints.splice(candidate.index, 0, {
    id: crypto.randomUUID(),
    locked: false,
    positionMode: 'distance',
    position: Math.round(candidate.distance),
    speed: 0,
    clock: 3
  });
  state.windPoints = normalizeWindPointPositions(state.windPoints, state.targetDistance);
  renderWindPoints();
  recalculate();
});

function updatePositionControls(point, card, index) {
  const { percent, distance } = getPointCoordinates(point, state.targetDistance);
  const bounds = getPointBounds(state.windPoints, index, state.targetDistance);
  const slider = card.querySelector('.position-slider');
  const percentValue = card.querySelector('.percent-value-number');
  const distanceInput = card.querySelector('.position-input');
  const scaleLabels = card.querySelectorAll('.slider-scale span');

  if (slider) {
    slider.min = bounds.minPercent;
    slider.max = bounds.maxPercent;
    slider.value = Math.max(bounds.minPercent, Math.min(bounds.maxPercent, percent));
  }
  if (percentValue) percentValue.textContent = formatNumber(percent, 1);
  if (distanceInput) {
    distanceInput.min = Math.ceil(bounds.minDistance);
    distanceInput.max = Math.floor(bounds.maxDistance);
    if (document.activeElement !== distanceInput) distanceInput.value = formatNumber(distance, 0);
  }
  if (scaleLabels[0]) scaleLabels[0].textContent = `${formatNumber(bounds.minPercent, 1)}%`;
  if (scaleLabels[1]) scaleLabels[1].textContent = `${formatNumber(bounds.maxPercent, 1)}%`;
}

function refreshPositionConstraints() {
  els.windPoints.querySelectorAll('[data-point-id]').forEach(card => {
    const index = state.windPoints.findIndex(p => p.id === card.dataset.pointId);
    if (index <= 0 || index >= state.windPoints.length - 1) return;
    updatePositionControls(state.windPoints[index], card, index);
  });
}

els.windPoints.addEventListener('input', event => {
  const card = event.target.closest('[data-point-id]');
  if (!card) return;
  const index = state.windPoints.findIndex(p => p.id === card.dataset.pointId);
  if (index < 0) return;
  let point = state.windPoints[index];

  if (event.target.matches('.speed-input')) trimRedundantLeadingZeros(event.target);

  if (event.target.matches('.position-slider')) {
    const bounds = getPointBounds(state.windPoints, index, state.targetDistance);
    point = setPointFromPercent(point, Number(event.target.value), state.targetDistance, bounds);
    state.windPoints[index] = point;
    const coords = getPointCoordinates(point, state.targetDistance);
    const distanceInput = card.querySelector('.position-input');
    const percentValue = card.querySelector('.percent-value-number');
    if (distanceInput) distanceInput.value = formatNumber(coords.distance, 0);
    if (percentValue) percentValue.textContent = formatNumber(coords.percent, 1);
    refreshPositionConstraints();
  }

  if (event.target.matches('.speed-input')) point.speed = Number(event.target.value);

  recalculate();
});

function commitDistanceInput(input) {
  const card = input.closest('[data-point-id]');
  if (!card) return;
  const index = state.windPoints.findIndex(p => p.id === card.dataset.pointId);
  if (index <= 0 || index >= state.windPoints.length - 1) return;

  const currentPoint = state.windPoints[index];
  const rawValue = input.value.trim();
  const requested = rawValue === '' ? NaN : Number(rawValue);

  // Empty/invalid drafts are allowed while editing, but on commit we restore
  // the last valid position instead of forcing a transient value into state.
  if (!Number.isFinite(requested)) {
    const { distance } = getPointCoordinates(currentPoint, state.targetDistance);
    input.value = formatNumber(distance, 0);
    return;
  }

  const bounds = getPointBounds(state.windPoints, index, state.targetDistance);
  const updatedPoint = setPointFromDistance(currentPoint, requested, state.targetDistance, bounds);
  state.windPoints[index] = updatedPoint;

  const coords = getPointCoordinates(updatedPoint, state.targetDistance);
  input.value = formatNumber(coords.distance, 0);
  const slider = card.querySelector('.position-slider');
  const percentValue = card.querySelector('.percent-value-number');
  if (slider) slider.value = coords.percent;
  if (percentValue) percentValue.textContent = formatNumber(coords.percent, 1);

  refreshPositionConstraints();
  recalculate();
}

els.windPoints.addEventListener('change', event => {
  if (!event.target.matches('.position-input')) return;
  commitDistanceInput(event.target);
});

els.windPoints.addEventListener('keydown', event => {
  if (!event.target.matches('.position-input')) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    commitDistanceInput(event.target);
    event.target.blur();
    return;
  }

  // Preserve immediate behavior of the native numeric stepper / keyboard arrows.
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    requestAnimationFrame(() => commitDistanceInput(event.target));
  }
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

els.navMenuButton?.addEventListener('click', event => {
  event.stopPropagation();
  if (els.navMenu.hidden) openNavMenu();
  else closeNavMenu();
});

els.navMenu?.addEventListener('click', event => {
  const item = event.target.closest('[data-page-target]');
  if (!item) return;
  const pageName = item.dataset.pageTarget;
  showPage(pageName);
  if (pageName === 'reference') showReferenceView('home');
});

document.addEventListener('click', event => {
  const target = event.target.closest('[data-reference-target]');
  if (target) {
    showPage('reference');
    showReferenceView(target.dataset.referenceTarget);
    return;
  }

  if (event.target.closest('[data-reference-back]')) {
    showReferenceView('home');
  }
});

els.themeToggle?.addEventListener('click', event => {
  event.stopPropagation();
  const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
  closeNavMenu();
});

document.addEventListener('click', event => {
  if (!event.target.closest('.nav-dropdown')) closeNavMenu();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.clockDialog.hidden) closeClock();
  if (event.key === 'Escape') closeNavMenu();
});

els.targetDistance.min = MIN_TARGET_DISTANCE;
els.targetDistance.max = getProfileMaxRange(state.profile);
els.targetDistance.value = state.targetDistance;
applyTheme(getPreferredTheme());
renderProfile();
renderWindPoints();
renderResult();

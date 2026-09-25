export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace(/\.00$/, '');
}

export function normalizeClock(clock) {
  let value = Number(clock);
  if (!Number.isFinite(value)) value = 12;
  value = ((value % 12) + 12) % 12;
  if (Math.abs(value) < 1e-9) value = 12;
  return Math.round(value * 2) / 2;
}

export function clockLabel(clock) {
  const normalized = normalizeClock(clock);
  const hour = Math.floor(normalized);
  const minutes = normalized % 1 ? '30' : '00';
  return `${hour}:${minutes}`;
}

export function clockFaceTemplate(selectedClock) {
  const selected = normalizeClock(selectedClock);
  const values = Array.from({ length: 24 }, (_, i) => {
    const raw = i * 0.5;
    return raw === 0 ? 12 : raw;
  });

  return `
    <div class="clock-ring" aria-hidden="true"></div>
    <div class="clock-axis vertical" aria-hidden="true"></div>
    <div class="clock-axis horizontal" aria-hidden="true"></div>
    <div class="clock-center" aria-hidden="true"></div>
    ${values.map(clock => {
      const angle = (clock % 12) * 30;
      const isSelected = Math.abs(normalizeClock(clock) - selected) < 1e-9;
      return `
        <button type="button"
          class="clock-mark ${isSelected ? 'selected' : ''}"
          data-clock-value="${clock}"
          style="--clock-angle:${angle}deg"
          aria-label="${clockLabel(clock)}"
          aria-pressed="${isSelected}">
          <span>${clockLabel(clock).replace(':00', '').replace(':30', '½')}</span>
        </button>`;
    }).join('')}
  `;
}

export function windPointTemplate(point, targetDistance, bounds = null) {
  if (point.locked) {
    const isShooter = Number(point.position) === 0;
    const absoluteDistance = isShooter ? 0 : targetDistance;
    const caption = isShooter ? 'Позиція стрільця' : 'Дистанція цілі';

    return `
      <article class="wind-point locked-point" data-point-id="${point.id}">
        <div class="point-position static-position">
          <div class="locked-position-line">
            <div class="position-caption">${caption}</div>
            <div class="static-distance">${formatNumber(absoluteDistance, 0)} <span>м</span></div>
          </div>
        </div>

        <div class="point-wind">
          <label>ВІТЕР</label>
          <div class="wind-row">
            <div class="speed-wrap">
              <input class="field speed-input" inputmode="decimal" type="number" min="0" step="0.1" value="${escapeHtml(point.speed)}">
              <span>м/с</span>
            </div>
            <button type="button" class="field clock-button" aria-label="Напрямок вітру ${clockLabel(point.clock)}">
              <span class="clock-button-arrow">◷</span>
              <span>${clockLabel(point.clock)}</span>
            </button>
          </div>
        </div>
      </article>`;
  }

  const isDistanceSource = point.positionMode === 'distance';
  const distance = isDistanceSource
    ? Number(point.position)
    : targetDistance * Number(point.position) / 100;
  const percent = isDistanceSource
    ? (targetDistance > 0 ? Number(point.position) / targetDistance * 100 : 0)
    : Number(point.position);

  const minDistance = bounds?.minDistance ?? 0;
  const maxDistance = bounds?.maxDistance ?? targetDistance;
  const minPercent = bounds?.minPercent ?? 0;
  const maxPercent = bounds?.maxPercent ?? 100;

  return `
    <article class="wind-point" data-point-id="${point.id}">
      <div class="point-position dual-position-control">
        <label>ПОЗИЦІЯ</label>
        <div class="position-dual-head">
          <div class="percent-readout"><span class="percent-value-number">${formatNumber(percent, 1)}</span>%</div>
          <div class="distance-entry-row">
            <input class="field position-input" inputmode="numeric" type="number" min="${escapeHtml(formatNumber(minDistance, 0))}" max="${escapeHtml(formatNumber(maxDistance, 0))}" step="1" value="${escapeHtml(formatNumber(distance, 0))}" aria-label="Позиція в метрах">
            <span class="distance-unit">м</span>
          </div>
        </div>
        <div class="percent-control">
          <input class="position-slider" type="range" min="${escapeHtml(minPercent)}" max="${escapeHtml(maxPercent)}" step="0.1" value="${escapeHtml(percent)}" aria-label="Позиція у відсотках">
          <div class="slider-scale"><span>${formatNumber(minPercent, 1)}%</span><span>${formatNumber(maxPercent, 1)}%</span></div>
        </div>
      </div>

      <div class="point-wind">
        <label>ВІТЕР</label>
        <div class="wind-row">
          <div class="speed-wrap">
            <input class="field speed-input" inputmode="decimal" type="number" min="0" step="0.1" value="${escapeHtml(point.speed)}">
            <span>м/с</span>
          </div>
          <button type="button" class="field clock-button" aria-label="Напрямок вітру ${clockLabel(point.clock)}">
            <span class="clock-button-arrow">◷</span>
            <span>${clockLabel(point.clock)}</span>
          </button>
        </div>
      </div>

      <button type="button" class="remove-point" aria-label="Видалити точку вітру">×</button>
    </article>`;
}

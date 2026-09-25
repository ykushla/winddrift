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

export function windPointTemplate(point, targetDistance) {
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

  const isPercent = point.positionMode === 'percent';
  const distance = targetDistance * Number(point.position) / 100;
  const percent = targetDistance > 0 ? Number(point.position) / targetDistance * 100 : 0;

  const positionControl = isPercent
    ? `
      <div class="position-primary-line percent-primary-line">
        <div class="percent-value"><span class="percent-value-number">${formatNumber(Number(point.position), 0)}</span>%</div>
        <div class="coordinate-companion">${formatNumber(distance, 0)} <span>м</span></div>
      </div>
      <div class="percent-control">
        <input class="position-slider" type="range" min="0" max="100" step="1" value="${escapeHtml(point.position)}" aria-label="Позиція у відсотках">
        <div class="slider-scale"><span>0%</span><span>100%</span></div>
      </div>`
    : `
      <div class="position-primary-line distance-primary-line">
        <div class="position-row distance-entry-row">
          <input class="field position-input" inputmode="decimal" type="number" min="0" step="1" value="${escapeHtml(point.position)}" aria-label="Позиція в метрах">
          <span class="distance-unit">м</span>
        </div>
        <div class="coordinate-companion">${formatNumber(percent, 0)}%</div>
      </div>`;

  return `
    <article class="wind-point" data-point-id="${point.id}">
      <div class="point-position">
        <div class="point-position-head">
          <label>ПОЗИЦІЯ</label>
          <div class="segmented compact position-mode">
            <button type="button" data-mode="percent" class="${isPercent ? 'active' : ''}">%</button>
            <button type="button" data-mode="distance" class="${!isPercent ? 'active' : ''}">м</button>
          </div>
        </div>
        ${positionControl}
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

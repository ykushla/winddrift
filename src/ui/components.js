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
  const isPercent = point.positionMode === 'percent';
  const derived = isPercent
    ? `${formatNumber(targetDistance * Number(point.position) / 100, 0)} m`
    : `${formatNumber(targetDistance > 0 ? Number(point.position) / targetDistance * 100 : 0, 0)}%`;

  return `
    <article class="wind-point" data-point-id="${point.id}">
      <div class="point-position">
        <label>Position</label>
        <div class="position-row">
          <input class="field position-input" inputmode="decimal" type="number" min="0" step="1" value="${escapeHtml(point.position)}" ${point.locked ? 'disabled' : ''}>
          <div class="segmented compact position-mode ${point.locked ? 'disabled' : ''}">
            <button type="button" data-mode="percent" class="${isPercent ? 'active' : ''}" ${point.locked ? 'disabled' : ''}>%</button>
            <button type="button" data-mode="distance" class="${!isPercent ? 'active' : ''}" ${point.locked ? 'disabled' : ''}>m</button>
          </div>
        </div>
        <div class="derived-position">${derived}</div>
      </div>

      <div class="point-wind">
        <label>Wind</label>
        <div class="wind-row">
          <div class="speed-wrap">
            <input class="field speed-input" inputmode="decimal" type="number" min="0" step="0.1" value="${escapeHtml(point.speed)}">
            <span>m/s</span>
          </div>
          <button type="button" class="field clock-button" aria-label="Wind direction ${clockLabel(point.clock)}">
            <span class="clock-button-arrow">◷</span>
            <span>${clockLabel(point.clock)}</span>
          </button>
        </div>
      </div>

      ${point.locked ? '<div class="point-lock">fixed</div>' : '<button type="button" class="remove-point" aria-label="Remove wind point">×</button>'}
    </article>`;
}

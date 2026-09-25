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

export function clockLabel(clock) {
  if (!Number.isFinite(clock)) return '—';
  const normalized = ((clock - 1) % 12 + 12) % 12 + 1;
  return `${formatNumber(normalized, normalized % 1 ? 1 : 0)}h`;
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
          <select class="field clock-input" aria-label="Wind direction">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<option value="${h}" ${Number(point.clock) === h ? 'selected' : ''}>${h}:00</option>`).join('')}
          </select>
        </div>
      </div>

      ${point.locked ? '<div class="point-lock">fixed</div>' : '<button type="button" class="remove-point" aria-label="Remove wind point">×</button>'}
    </article>`;
}

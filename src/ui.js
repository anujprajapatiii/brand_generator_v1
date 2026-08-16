import { BORDER_WIDTHS, CANVAS_SIZE, EDGE_KEYS, GRID, SIZE_PRESETS } from './config.js';
import { getGridMetrics, getSizePreset, gridRect, normalizeGutter } from './grid.js';
import { PRIMITIVES, renderPrimitive } from './primitives.js';
import { getStackPosition } from './stack.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function tidyMetric(value) {
  return Number(value.toFixed(4));
}

function gridMarkup(gutter) {
  const metrics = getGridMetrics(gutter);
  const cells = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let column = 0; column < GRID.columns; column += 1) {
      cells.push(`<rect class="grid-cell" x="${tidyMetric(column * metrics.pitch)}" y="${tidyMetric(row * metrics.pitch)}" width="${tidyMetric(metrics.cell)}" height="${tidyMetric(metrics.cell)}"/>`);
    }
  }
  return `<g class="grid-layer" aria-hidden="true">${cells.join('')}</g>`;
}

function selectionMarkup(item, gutter) {
  if (!item) return '';
  const rect = gridRect(item, gutter);
  const handles = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ];

  return `<g class="selection-layer" aria-hidden="true">
    <rect data-selection-outline x="${rect.x + 2}" y="${rect.y + 2}" width="${rect.width - 4}" height="${rect.height - 4}" rx="8"/>
    ${handles.map(([x, y], index) => `<rect data-selection-handle="${index}" x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2"/>`).join('')}
  </g>`;
}

function canvasMarkup(document, tokens, selectedId) {
  const gutter = normalizeGutter(document.gutter);
  const selectedItem = document.items.find((item) => item.id === selectedId);
  return `${gridMarkup(gutter)}
    ${document.items.map((item) => renderPrimitive(item, tokens, { gutter })).join('')}
    ${selectionMarkup(selectedItem, gutter)}`;
}

function primitiveLibraryMarkup() {
  return Object.entries(PRIMITIVES).map(([type, definition]) => `
    <button class="primitive-card" data-add-primitive="${type}" type="button">
      <span class="primitive-icon ${definition.iconClass}" aria-hidden="true"></span>
      <span><strong>${definition.label}</strong><small>${definition.description}</small></span>
      <span class="add-glyph" aria-hidden="true">+</span>
    </button>
  `).join('');
}

function sizePresetMarkup(selectedItem) {
  return Object.entries(SIZE_PRESETS).map(([key, preset]) => `
    <button class="size-preset ${selectedItem.size === key ? 'active' : ''}" data-size-preset="${key}" type="button" aria-pressed="${selectedItem.size === key}">
      <span class="size-preview" style="--columns:${preset.columns};--rows:${preset.rows}"></span>
      <strong>${preset.label}</strong>
    </button>
  `).join('');
}

function edgeButton(edge, selectedItem) {
  const state = selectedItem.edges[edge];
  return `<button class="edge-control edge-${edge}" data-edge="${edge}" data-state="${state}" type="button" aria-label="${edge} edge: ${state}. Click to cycle.">
    <span>${edge}</span><strong>${state}</strong>
  </button>`;
}

function edgeControlsMarkup(selectedItem) {
  return `<div class="edge-map">
    ${edgeButton('top', selectedItem)}
    ${edgeButton('left', selectedItem)}
    <button class="invert-control" id="invert-edges" type="button"><span aria-hidden="true">⇄</span><strong>Invert</strong></button>
    ${edgeButton('right', selectedItem)}
    ${edgeButton('bottom', selectedItem)}
  </div>
  <div class="edge-presets" aria-label="Connector presets">
    ${['flat', 'slots', 'tabs', 'alternate'].map((preset) => `<button data-edge-preset="${preset}" type="button">${preset}</button>`).join('')}
  </div>`;
}

function appearanceMarkup(selectedItem) {
  return `<div class="segmented appearance-options">
    ${['solid', 'outline'].map((appearance) => `<button class="${selectedItem.appearance === appearance ? 'active' : ''}" data-appearance="${appearance}" type="button" aria-pressed="${selectedItem.appearance === appearance}">${appearance}</button>`).join('')}
  </div>
  <div class="border-options ${selectedItem.appearance === 'outline' ? '' : 'muted'}">
    <span>Border</span>
    <div class="segmented compact">
      ${BORDER_WIDTHS.map((width) => `<button class="${selectedItem.borderWidth === width ? 'active' : ''}" data-border-width="${width}" type="button" aria-pressed="${selectedItem.borderWidth === width}">${width}</button>`).join('')}
    </div>
  </div>`;
}

function gutterControlsMarkup(gutter) {
  const value = normalizeGutter(gutter);
  const progress = (value / GRID.maxGutter) * 100;
  return `<section class="control-section gutter-section">
    <div class="section-heading"><p class="eyebrow">Grid gutters</p><span>Canvas-wide</span></div>
    <div class="gutter-readout"><span>Gap between cells</span><output id="grid-gutter-value" for="grid-gutter">${value}px</output></div>
    <input class="gutter-slider" id="grid-gutter" type="range" min="${GRID.defaultGutter}" max="${GRID.maxGutter}" step="1" value="${value}" style="--range-progress:${progress}%" aria-label="Grid gutter in pixels">
    <div class="range-scale"><span>${GRID.defaultGutter}px</span><span>${GRID.maxGutter}px</span></div>
  </section>`;
}

function stackControlsMarkup(selectedItem, items) {
  const position = getStackPosition(items, selectedItem.id);
  const atBack = position.index <= 0;
  const atFront = position.index >= position.count - 1;
  const controls = [
    { action: 'back', label: 'Move back', glyph: '↓', disabled: atBack },
    { action: 'front', label: 'Move front', glyph: '↑', disabled: atFront },
    { action: 'send-back', label: 'Send to back', glyph: '⇊', disabled: atBack },
    { action: 'send-front', label: 'Send to front', glyph: '⇈', disabled: atFront },
  ];

  return `<div class="stack-actions">
    ${controls.map((control) => `<button data-stack-action="${control.action}" type="button" ${control.disabled ? 'disabled' : ''}><span aria-hidden="true">${control.glyph}</span>${control.label}</button>`).join('')}
  </div>`;
}

function shapeControlsMarkup(selectedItem, tokens, items) {
  if (!selectedItem) {
    return `<section class="control-section selected-empty">
      <span class="empty-symbol" aria-hidden="true">□</span>
      <h2>Select a shape</h2>
      <p>Choose a shape on the canvas to edit its footprint, edges, border, and colour.</p>
    </section>`;
  }

  const definition = PRIMITIVES[selectedItem.type];
  const size = getSizePreset(selectedItem.size);
  return `<section class="control-section selected-shape">
    <div class="selected-head">
      <div>
        <p class="eyebrow">Shape controls</p>
        <h2>${escapeHtml(selectedItem.name)}</h2>
        <span class="type-badge">${definition.label} · ${size.label}</span>
      </div>
      <button class="remove" id="remove" type="button" aria-label="Delete ${escapeHtml(selectedItem.name)}">×</button>
    </div>

    <div class="control-group">
      <div class="section-heading"><p class="eyebrow">Footprint</p><span>Grid units</span></div>
      <div class="size-presets">${sizePresetMarkup(selectedItem)}</div>
    </div>

    <div class="control-group">
      <div class="section-heading"><p class="eyebrow">Stack order</p><span>${getStackPosition(items, selectedItem.id).index + 1} of ${items.length}</span></div>
      ${stackControlsMarkup(selectedItem, items)}
    </div>

    <div class="control-group connector-group">
      <div class="section-heading"><p class="eyebrow">Edge connectors</p><span>Click an edge to cycle</span></div>
      ${edgeControlsMarkup(selectedItem)}
      <p class="hint">Slots subtract. Tabs add. Invert makes the complementary piece.</p>
    </div>

    <div class="control-group">
      <div class="section-heading"><p class="eyebrow">Appearance</p><span>Independent of shape</span></div>
      ${appearanceMarkup(selectedItem)}
    </div>

    <div class="control-group">
      <label class="wide-field">Colour token
        <select class="input" id="fill-token">
          ${Object.keys(tokens).map((token) => `<option value="${token}" ${selectedItem.token === token ? 'selected' : ''}>${token}</option>`).join('')}
        </select>
      </label>
    </div>
  </section>`;
}

function tokensMarkup(tokens) {
  return Object.entries(tokens).map(([key, value]) => `
    <label class="token">
      <input class="color" type="color" value="${value}" data-token-color="${key}">
      <span><strong>${key}</strong><small>${value}</small></span>
      <i style="--token-color:${value}"></i>
    </label>
  `).join('');
}

export function renderApp({ document, tokens, selectedId, theme }) {
  const selectedItem = document.items.find((item) => item.id === selectedId);
  const gutter = normalizeGutter(document.gutter);
  const gridMetrics = getGridMetrics(gutter);

  return `<main class="app">
    <header class="topbar">
      <div class="brand"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Motif</div>
      <div class="project"><span>/</span><strong>${escapeHtml(document.name)}</strong><span class="save-status"><i></i>Saved locally</span></div>
      <div class="top-actions">
        <span class="grid-status" id="grid-status-copy"><i aria-hidden="true"></i>${GRID.columns} × ${GRID.rows} grid · ${gutter}px gap</span>
        <button class="btn" id="remix" type="button">Remix layout</button>
        <button class="theme-switch ${theme === 'dark' ? 'active' : ''}" id="theme" type="button" aria-label="Toggle dark mode"><span></span></button>
        <button class="btn primary" id="export" type="button">Export SVG <span aria-hidden="true">↓</span></button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-intro">
          <p class="eyebrow">Primitive library</p>
          <p>Start clean, then build a reusable edge language.</p>
        </div>
        <div class="primitive-list">${primitiveLibraryMarkup()}</div>

        ${gutterControlsMarkup(gutter)}

        ${shapeControlsMarkup(selectedItem, tokens, document.items)}

        <section class="control-section token-section">
          <div class="section-heading"><p class="eyebrow">Design tokens</p><span>Global</span></div>
          <div class="tokens">${tokensMarkup(tokens)}</div>
          <button class="btn full-width" id="save-tokens" type="button">Save colour system</button>
        </section>
      </aside>

      <section class="stage">
        <div class="canvas-frame">
          <div class="canvas-meta"><span>Composition plane</span><span id="grid-metrics">${tidyMetric(gridMetrics.cell)}px cell · ${gutter}px gutter · ${CANVAS_SIZE}px</span></div>
          <div class="canvas-shell">
            <svg id="canvas" class="canvas" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grid-based brand composition">
              ${canvasMarkup(document, tokens, selectedId)}
            </svg>
          </div>
          <div class="canvas-footer"><span>Select or drag a shape · edges cycle flat / slot / tab</span><span>Schema v${document.version}</span></div>
        </div>
      </section>
    </div>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite">Saved</div>`;
}

export function updateGutterPreview(root, { document, tokens, selectedId }) {
  const gutter = normalizeGutter(document.gutter);
  const metrics = getGridMetrics(gutter);
  const canvas = root.querySelector('#canvas');
  if (canvas) canvas.innerHTML = canvasMarkup(document, tokens, selectedId);

  const value = root.querySelector('#grid-gutter-value');
  if (value) value.textContent = `${gutter}px`;
  const slider = root.querySelector('#grid-gutter');
  slider?.style.setProperty('--range-progress', `${(gutter / GRID.maxGutter) * 100}%`);
  const metricCopy = root.querySelector('#grid-metrics');
  if (metricCopy) metricCopy.textContent = `${tidyMetric(metrics.cell)}px cell · ${gutter}px gutter · ${CANVAS_SIZE}px`;
  const statusCopy = root.querySelector('#grid-status-copy');
  if (statusCopy) statusCopy.innerHTML = `<i aria-hidden="true"></i>${GRID.columns} × ${GRID.rows} grid · ${gutter}px gap`;
}

export function updateDraggedItem(root, item, gutter = GRID.defaultGutter) {
  const rect = gridRect(item, gutter);
  const primitive = root.querySelector(`[data-id="${item.id}"]`);
  primitive?.setAttribute('transform', `translate(${rect.x} ${rect.y})`);
  primitive?.setAttribute('data-grid-column', item.column);
  primitive?.setAttribute('data-grid-row', item.row);

  const outline = root.querySelector('[data-selection-outline]');
  if (outline) {
    outline.setAttribute('x', rect.x + 2);
    outline.setAttribute('y', rect.y + 2);
    outline.setAttribute('width', rect.width - 4);
    outline.setAttribute('height', rect.height - 4);
  }

  const handles = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ];
  root.querySelectorAll('[data-selection-handle]').forEach((handle, index) => {
    handle.setAttribute('x', handles[index][0] - 5);
    handle.setAttribute('y', handles[index][1] - 5);
  });
}

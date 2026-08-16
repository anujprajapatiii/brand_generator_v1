import { BORDER_WIDTHS, CANVAS_SIZE, EDGE_KEYS, GRID, SIZE_PRESETS } from './config.js';
import { getGridMetrics, getSizePreset, gridRect, normalizeGutter } from './grid.js';
import { PRIMITIVES, renderGridExclusion, renderPrimitive } from './primitives.js';
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

const ICON_PATHS = Object.freeze({
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkle: '<path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z"/><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
  shuffle: '<path d="M4 7h3.5c3.5 0 5 10 9 10H20"/><path d="m17 14 3 3-3 3M4 17h3.5c1.2 0 2.1-1.1 3-2.7M14.5 9.7C15.2 8.1 16 7 17 7h3"/><path d="m17 4 3 3-3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16V4Z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  invert: '<path d="M5 8h12l-3-3M19 16H7l3 3"/>',
  down: '<path d="M12 5v14M7 14l5 5 5-5"/>',
  up: '<path d="M12 19V5M7 10l5-5 5 5"/>',
  sendDown: '<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>',
  sendUp: '<path d="M12 20V10M8 14l4-4 4 4M5 5h14"/>',
});

function iconMarkup(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

function gridMarkup(gutter, items, visible) {
  if (!visible) return '';
  const metrics = getGridMetrics(gutter);
  const cells = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let column = 0; column < GRID.columns; column += 1) {
      cells.push(`<rect class="grid-cell" x="${tidyMetric(column * metrics.pitch)}" y="${tidyMetric(row * metrics.pitch)}" width="${tidyMetric(metrics.cell)}" height="${tidyMetric(metrics.cell)}"/>`);
    }
  }
  const exclusions = items.map((item) => renderGridExclusion(item, gutter)).join('');
  return `<defs>
    <mask id="grid-visibility-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="#fff"/>
      ${exclusions}
    </mask>
  </defs>
  <g class="grid-layer" mask="url(#grid-visibility-mask)" aria-hidden="true">${cells.join('')}</g>`;
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
  const showGrid = document.showGrid !== false;
  const selectedItem = document.items.find((item) => item.id === selectedId);
  return `${gridMarkup(gutter, document.items, showGrid)}
    ${document.items.map((item) => renderPrimitive(item, tokens, { gutter })).join('')}
    ${selectionMarkup(selectedItem, gutter)}`;
}

function primitiveLibraryMarkup() {
  return Object.entries(PRIMITIVES).map(([type, definition]) => `
    <button class="primitive-card" data-add-primitive="${type}" type="button" aria-label="Add randomised ${definition.label.toLowerCase()}">
      <span class="primitive-icon ${definition.iconClass}" aria-hidden="true"></span>
      <span><strong>${definition.label}</strong><small>${definition.description}</small></span>
      ${iconMarkup('plus')}
    </button>
  `).join('');
}

function boardActionsMarkup(itemCount) {
  return `<section class="control-section board-section">
    <div class="section-heading"><p class="eyebrow">Board</p><span>${itemCount} shape${itemCount === 1 ? '' : 's'}</span></div>
    <button class="action-button featured" id="generate-composition" type="button">${iconMarkup('sparkle')}<span><strong>Add composition</strong><small>Random shapes, sizes and connectors</small></span></button>
    <div class="board-actions">
      <button class="action-button" id="remix" type="button" ${itemCount ? '' : 'disabled'}>${iconMarkup('shuffle')}<span>Remix layout</span></button>
      <button class="action-button danger" id="clear-board" type="button" ${itemCount ? '' : 'disabled'}>${iconMarkup('trash')}<span>Clear board</span></button>
    </div>
  </section>`;
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
    <button class="invert-control" id="invert-edges" type="button">${iconMarkup('invert')}<strong>Invert</strong></button>
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

function gutterControlsMarkup(gutter, showGrid) {
  const value = normalizeGutter(gutter);
  const progress = (value / GRID.maxGutter) * 100;
  return `<section class="control-section gutter-section">
    <div class="section-heading"><p class="eyebrow">Grid gutters</p><span>Canvas-wide</span></div>
    <div class="grid-visibility-row">
      <span>Show grid</span>
      <button class="grid-visibility-toggle ${showGrid ? 'active' : ''}" id="toggle-grid" type="button" role="switch" aria-checked="${showGrid}" aria-label="Show grid"><span></span></button>
    </div>
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
    { action: 'back', label: 'Move back', icon: 'down', disabled: atBack },
    { action: 'front', label: 'Move front', icon: 'up', disabled: atFront },
    { action: 'send-back', label: 'Send to back', icon: 'sendDown', disabled: atBack },
    { action: 'send-front', label: 'Send to front', icon: 'sendUp', disabled: atFront },
  ];

  return `<div class="stack-actions">
    ${controls.map((control) => `<button data-stack-action="${control.action}" type="button" ${control.disabled ? 'disabled' : ''}>${iconMarkup(control.icon)}<span>${control.label}</span></button>`).join('')}
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
      <button class="icon-button remove" id="remove" type="button" aria-label="Delete ${escapeHtml(selectedItem.name)}">${iconMarkup('close')}</button>
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
  const showGrid = document.showGrid !== false;
  const gridMetrics = getGridMetrics(gutter);

  return `<main class="app">
    <header class="topbar">
      <div class="brand"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Motif</div>
      <div class="project"><span>/</span><strong>${escapeHtml(document.name)}</strong><span class="save-status"><i></i>Saved locally</span></div>
      <div class="top-actions">
        <span class="grid-status" id="grid-status-copy"><i aria-hidden="true"></i>${showGrid ? `${GRID.columns} × ${GRID.rows} grid · ${gutter}px gap` : 'Grid hidden'}</span>
        <button class="btn ${theme === 'dark' ? 'active' : ''}" id="theme" type="button" aria-pressed="${theme === 'dark'}" aria-label="Toggle colour theme">${iconMarkup('theme')}<span>Theme</span></button>
        <button class="btn primary" id="export" type="button">${iconMarkup('download')}<span>Export SVG</span></button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-intro">
          <p class="eyebrow">Primitive library</p>
          <p>Start clean, then build a reusable edge language.</p>
        </div>
        <div class="primitive-list">${primitiveLibraryMarkup()}</div>

        ${boardActionsMarkup(document.items.length)}

        ${gutterControlsMarkup(gutter, showGrid)}

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
          <div class="canvas-shell ${showGrid ? '' : 'grid-hidden'}">
            <svg id="canvas" class="canvas" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grid-based brand composition">
              ${canvasMarkup(document, tokens, selectedId)}
            </svg>
          </div>
          <div class="canvas-footer"><span>Drag to move · ⌘D duplicate · Delete remove</span><span>Schema v${document.version}</span></div>
        </div>
      </section>
    </div>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite">Saved</div>`;
}

export function updateGutterPreview(root, { document, tokens, selectedId }) {
  const gutter = normalizeGutter(document.gutter);
  const showGrid = document.showGrid !== false;
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
  if (statusCopy) statusCopy.innerHTML = `<i aria-hidden="true"></i>${showGrid ? `${GRID.columns} × ${GRID.rows} grid · ${gutter}px gap` : 'Grid hidden'}`;
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

import { CANVAS_SIZE, GRID, SIZE_PRESETS } from './config.js';
import { getSizePreset, gridRect } from './grid.js';
import { PRIMITIVES, renderPrimitive } from './primitives.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function selectionMarkup(item) {
  if (!item) return '';
  const rect = gridRect(item);
  const handles = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ];

  return `<g class="selection-layer" aria-hidden="true">
    <rect data-selection-outline x="${rect.x + 2}" y="${rect.y + 2}" width="${rect.width - 4}" height="${rect.height - 4}" rx="4"/>
    ${handles.map(([x, y], index) => `<rect data-selection-handle="${index}" x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2"/>`).join('')}
  </g>`;
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

function layersMarkup(items, selectedId, tokens) {
  if (!items.length) return '<p class="empty-state">Add a primitive to begin.</p>';

  return [...items].reverse().map((item) => `
    <button class="layer ${item.id === selectedId ? 'active' : ''}" data-select-item="${item.id}" type="button">
      <span class="layer-swatch primitive-swatch-${item.type}" style="--swatch:${tokens[item.token]}"></span>
      <span><strong>${escapeHtml(item.name)}</strong><small>${item.size} · ${item.token}</small></span>
      <span class="drag-glyph" aria-hidden="true">⠿</span>
    </button>
  `).join('');
}

function sizePresetMarkup(selectedItem) {
  return Object.entries(SIZE_PRESETS).map(([key, preset]) => `
    <button class="size-preset ${selectedItem.size === key ? 'active' : ''}" data-size-preset="${key}" type="button">
      <span class="size-preview" style="--columns:${preset.columns};--rows:${preset.rows}"></span>
      <strong>${preset.label}</strong>
    </button>
  `).join('');
}

function inspectorMarkup(selectedItem, tokens) {
  if (!selectedItem) {
    return `<div class="inspector-empty">
      <span class="empty-symbol">□</span>
      <h2>No primitive selected</h2>
      <p>Select a layer or add a primitive to edit its grid footprint.</p>
    </div>`;
  }

  const definition = PRIMITIVES[selectedItem.type];
  const size = getSizePreset(selectedItem.size);
  const maxColumn = GRID.columns - size.columns + 1;
  const maxRow = GRID.rows - size.rows + 1;

  return `<div class="property-head">
    <div>
      <p class="eyebrow">Inspector</p>
      <h2>${escapeHtml(selectedItem.name)}</h2>
      <span class="type-badge">${definition.label}</span>
    </div>
    <button class="remove" id="remove" type="button" aria-label="Delete ${escapeHtml(selectedItem.name)}">×</button>
  </div>

  <div class="inspector-section">
    <div class="section-heading">
      <p class="eyebrow">Grid position</p>
      <span>Cell coordinates</span>
    </div>
    <div class="field-row">
      <label class="field">Column
        <input class="input" data-grid-coordinate="column" type="number" min="1" max="${maxColumn}" step="1" value="${selectedItem.column + 1}">
      </label>
      <label class="field">Row
        <input class="input" data-grid-coordinate="row" type="number" min="1" max="${maxRow}" step="1" value="${selectedItem.row + 1}">
      </label>
    </div>
  </div>

  <div class="inspector-section">
    <div class="section-heading">
      <p class="eyebrow">Footprint</p>
      <span>Approved sizes</span>
    </div>
    <div class="size-presets">${sizePresetMarkup(selectedItem)}</div>
  </div>

  <div class="inspector-section">
    <label class="wide-field">Colour token
      <select class="input" id="fill-token">
        ${Object.keys(tokens).map((token) => `<option value="${token}" ${selectedItem.token === token ? 'selected' : ''}>${token}</option>`).join('')}
      </select>
    </label>
  </div>`;
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
  const gridCellPercent = 100 / GRID.columns;

  return `<main class="app">
    <header class="topbar">
      <div class="brand"><span class="brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Motif</div>
      <div class="project"><span>/</span><strong>${escapeHtml(document.name)}</strong><span class="save-status"><i></i>Saved locally</span></div>
      <div class="top-actions">
        <span class="grid-status"><i aria-hidden="true"></i>${GRID.columns} × ${GRID.rows} grid</span>
        <button class="btn" id="remix" type="button">Remix layout</button>
        <button class="theme-switch ${theme === 'dark' ? 'active' : ''}" id="theme" type="button" aria-label="Toggle dark mode"><span></span></button>
        <button class="btn primary" id="export" type="button">Export SVG <span aria-hidden="true">↓</span></button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-intro">
          <p class="eyebrow">Primitive library</p>
          <p>Clean geometry only. Every new object begins at one grid unit.</p>
        </div>
        <div class="primitive-list">${primitiveLibraryMarkup()}</div>

        <div class="sidebar-section">
          <div class="section-heading"><p class="eyebrow">Composition</p><span>${document.items.length} layers</span></div>
          <div class="layers">${layersMarkup(document.items, selectedId, tokens)}</div>
        </div>
      </aside>

      <section class="stage">
        <div class="canvas-frame">
          <div class="canvas-meta"><span>Composition plane</span><span>${GRID.cell}px unit · ${CANVAS_SIZE}px</span></div>
          <div class="canvas-shell" style="--grid-cell:${gridCellPercent}%">
            <svg id="canvas" class="canvas" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grid-based brand composition">
              ${document.items.map((item) => renderPrimitive(item, tokens)).join('')}
              ${selectionMarkup(selectedItem)}
            </svg>
          </div>
          <div class="canvas-footer"><span>Drag to move · all movement snaps to cells</span><span>Schema v${document.version}</span></div>
        </div>
      </section>

      <aside class="rightbar">
        ${inspectorMarkup(selectedItem, tokens)}

        <div class="right-section structure-section">
          <div class="section-heading"><p class="eyebrow">System structure</p><span>Foundation</span></div>
          <div class="structure-flow">
            <span>Primitive</span><i>→</i><span>Grid footprint</span><i>→</i><span>Composition</span>
          </div>
          <p class="hint">Geometry, footprint, position, and colour remain independent so future rules can compose without changing the document model.</p>
        </div>

        <div class="right-section">
          <div class="section-heading"><p class="eyebrow">Design tokens</p><span>Global</span></div>
          <div class="tokens">${tokensMarkup(tokens)}</div>
          <button class="btn full-width" id="save-tokens" type="button">Save colour system</button>
        </div>
      </aside>
    </div>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite">Saved</div>`;
}

export function updateDraggedItem(root, item) {
  const rect = gridRect(item);
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

  const columnInput = root.querySelector('[data-grid-coordinate="column"]');
  const rowInput = root.querySelector('[data-grid-coordinate="row"]');
  if (columnInput) columnInput.value = item.column + 1;
  if (rowInput) rowInput.value = item.row + 1;
}

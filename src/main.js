import { CANVAS_SIZE, DEFAULT_EDGES, DEFAULT_TOKENS, DOCUMENT_VERSION, GRID } from './config.js';
import { applyEdgePreset, cycleEdge, invertEdges, normalizeEdges } from './edges.js';
import {
  canvasPointToGrid,
  findAvailablePosition,
  gridRect,
  normalizeGridItem,
  normalizeGutter,
} from './grid.js';
import { PRIMITIVES, renderPrimitive } from './primitives.js';
import { reorderStack } from './stack.js';
import {
  loadTheme,
  loadWorkspace,
  saveDocument,
  saveTheme,
  saveTokens,
} from './store.js';
import { renderApp, updateDraggedItem, updateGutterPreview } from './ui.js';

const root = document.querySelector('#app');
const workspace = loadWorkspace();
const motifDocument = workspace.document;
const tokens = workspace.tokens;
let theme = loadTheme();
let selectedId = motifDocument.items.at(-1)?.id ?? null;
let dragState = null;

function selectedItem() {
  return motifDocument.items.find((item) => item.id === selectedId) ?? null;
}

function applyThemeAndTokens() {
  document.body.classList.toggle('dark', theme === 'dark');
  Object.entries(tokens).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--token-${key}`, value);
  });
}

function persistDocument() {
  saveDocument(motifDocument);
}

function commitDocument(message) {
  persistDocument();
  render();
  if (message) showToast(message);
}

function render() {
  applyThemeAndTokens();
  root.innerHTML = renderApp({
    document: motifDocument,
    tokens,
    selectedId,
    theme,
  });
  bindInterface();
}

function addPrimitive(type) {
  const definition = PRIMITIVES[type];
  if (!definition) return;

  const itemNumber = motifDocument.nextItemId;
  const size = '1x1';
  const position = findAvailablePosition(motifDocument.items, size, itemNumber * 3);
  const item = {
    id: `${type}-${itemNumber}`,
    name: `${definition.label} ${itemNumber}`,
    type,
    ...position,
    size,
    token: definition.defaultToken,
    edges: { ...DEFAULT_EDGES },
    appearance: 'solid',
    borderWidth: 8,
  };

  motifDocument.nextItemId += 1;
  motifDocument.items.push(item);
  selectedId = item.id;
  commitDocument(`${definition.label} added at 1 × 1`);
}

function updateSelected(mutator, message) {
  const item = selectedItem();
  if (!item) return;
  mutator(item);
  commitDocument(message);
}

function setSizePreset(size) {
  updateSelected((item) => {
    Object.assign(item, normalizeGridItem({ ...item, size }));
  }, `Footprint set to ${size}`);
}

function setEdge(edge) {
  updateSelected((item) => {
    item.edges = normalizeEdges(item.edges);
    item.edges[edge] = cycleEdge(item.edges[edge]);
  }, `${edge[0].toUpperCase()}${edge.slice(1)} edge updated`);
}

function setEdgePreset(preset) {
  updateSelected((item) => {
    item.edges = applyEdgePreset(preset);
  }, `${preset[0].toUpperCase()}${preset.slice(1)} connector preset applied`);
}

function invertSelectedEdges() {
  updateSelected((item) => {
    item.edges = invertEdges(item.edges);
  }, 'Connectors inverted');
}

function reorderSelected(action) {
  const item = selectedItem();
  if (!item) return;
  const before = motifDocument.items.findIndex((candidate) => candidate.id === item.id);
  motifDocument.items = reorderStack(motifDocument.items, item.id, action);
  const after = motifDocument.items.findIndex((candidate) => candidate.id === item.id);
  if (before === after) return;
  const labels = {
    back: 'Moved back one level',
    front: 'Moved forward one level',
    'send-back': 'Sent to back',
    'send-front': 'Sent to front',
  };
  commitDocument(labels[action]);
}

function remixLayout() {
  const placed = [];
  motifDocument.items.forEach((item, index) => {
    const start = Math.floor(Math.random() * GRID.columns * GRID.rows) + index;
    Object.assign(item, findAvailablePosition(placed, item.size, start));
    placed.push(item);
  });
  commitDocument('Layout remixed on the grid');
}

function deleteSelectedItem() {
  const item = selectedItem();
  if (!item) return;
  const index = motifDocument.items.findIndex((candidate) => candidate.id === item.id);
  motifDocument.items.splice(index, 1);
  selectedId = motifDocument.items.at(Math.max(0, index - 1))?.id ?? motifDocument.items.at(-1)?.id ?? null;
  commitDocument(`${PRIMITIVES[item.type].label} removed`);
}

function clientPointToCanvas(event, svg) {
  const bounds = svg.getBoundingClientRect();
  const scale = CANVAS_SIZE / bounds.width;
  return {
    x: (event.clientX - bounds.left) * scale,
    y: (event.clientY - bounds.top) * scale,
  };
}

function startDrag(event) {
  const primitive = event.target.closest('[data-id]');
  if (!primitive) return;

  const item = motifDocument.items.find((candidate) => candidate.id === primitive.dataset.id);
  if (!item) return;

  event.preventDefault();
  selectedId = item.id;
  render();

  const svg = root.querySelector('#canvas');
  const point = clientPointToCanvas(event, svg);
  const rect = gridRect(item, motifDocument.gutter);
  dragState = {
    pointerId: event.pointerId,
    itemId: item.id,
    grabOffset: { x: point.x - rect.x, y: point.y - rect.y },
  };
  svg.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const svg = root.querySelector('#canvas');
  const item = motifDocument.items.find((candidate) => candidate.id === dragState.itemId);
  if (!svg || !item) return;

  const point = clientPointToCanvas(event, svg);
  const next = canvasPointToGrid(point.x, point.y, item.size, dragState.grabOffset, motifDocument.gutter);
  if (next.column === item.column && next.row === item.row) return;

  Object.assign(item, next);
  updateDraggedItem(root, item, motifDocument.gutter);
}

function endDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState = null;
  persistDocument();
  render();
  showToast('Position snapped to grid');
}

function escapeXml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;',
  })[character]);
}

function exportSvg() {
  const metadata = escapeXml(JSON.stringify({
    generator: 'Motif',
    documentVersion: DOCUMENT_VERSION,
    grid: GRID,
    document: motifDocument,
    tokens,
  }));
  const primitives = motifDocument.items.map((item) => renderPrimitive(item, tokens, {
    interactive: false,
    gutter: motifDocument.gutter,
  })).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}"><metadata id="motif-document">${metadata}</metadata>${primitives}</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'motif-composition.svg';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  showToast('Structured SVG exported');
}

function showToast(message) {
  const toast = root.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function bindInterface() {
  root.querySelectorAll('[data-add-primitive]').forEach((button) => {
    button.addEventListener('click', () => addPrimitive(button.dataset.addPrimitive));
  });

  root.querySelectorAll('[data-size-preset]').forEach((button) => {
    button.addEventListener('click', () => setSizePreset(button.dataset.sizePreset));
  });

  root.querySelectorAll('[data-edge]').forEach((button) => {
    button.addEventListener('click', () => setEdge(button.dataset.edge));
  });

  root.querySelectorAll('[data-edge-preset]').forEach((button) => {
    button.addEventListener('click', () => setEdgePreset(button.dataset.edgePreset));
  });

  root.querySelector('#invert-edges')?.addEventListener('click', invertSelectedEdges);

  root.querySelectorAll('[data-stack-action]').forEach((button) => {
    button.addEventListener('click', () => reorderSelected(button.dataset.stackAction));
  });

  const gutterSlider = root.querySelector('#grid-gutter');
  gutterSlider?.addEventListener('input', () => {
    motifDocument.gutter = normalizeGutter(gutterSlider.value);
    persistDocument();
    updateGutterPreview(root, {
      document: motifDocument,
      tokens,
      selectedId,
    });
  });
  gutterSlider?.addEventListener('change', () => showToast(`Grid gutter set to ${motifDocument.gutter}px`));

  root.querySelectorAll('[data-appearance]').forEach((button) => {
    button.addEventListener('click', () => updateSelected((item) => {
      item.appearance = button.dataset.appearance;
    }, `Appearance set to ${button.dataset.appearance}`));
  });

  root.querySelectorAll('[data-border-width]').forEach((button) => {
    button.addEventListener('click', () => updateSelected((item) => {
      item.borderWidth = Number(button.dataset.borderWidth);
      item.appearance = 'outline';
    }, `Border set to ${button.dataset.borderWidth}px`));
  });

  root.querySelectorAll('[data-token-color]').forEach((input) => {
    input.addEventListener('change', () => {
      tokens[input.dataset.tokenColor] = input.value.toUpperCase();
      render();
    });
  });

  root.querySelector('#fill-token')?.addEventListener('change', (event) => {
    updateSelected((item) => {
      if (Object.hasOwn(DEFAULT_TOKENS, event.target.value)) item.token = event.target.value;
    }, 'Colour token updated');
  });

  root.querySelector('#remove')?.addEventListener('click', deleteSelectedItem);
  root.querySelector('#remix')?.addEventListener('click', remixLayout);
  root.querySelector('#export')?.addEventListener('click', exportSvg);
  root.querySelector('#save-tokens')?.addEventListener('click', () => {
    saveTokens(tokens);
    showToast('Colour system saved');
  });
  root.querySelector('#theme')?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    saveTheme(theme);
    render();
  });

  const canvas = root.querySelector('#canvas');
  canvas?.addEventListener('pointerdown', startDrag);
  canvas?.addEventListener('pointermove', moveDrag);
  canvas?.addEventListener('pointerup', endDrag);
  canvas?.addEventListener('pointercancel', endDrag);
}

render();

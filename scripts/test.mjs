import assert from 'node:assert/strict';

import { DEFAULT_TOKENS, EDGE_KEYS, GRID, SIZE_PRESETS, STORAGE_KEYS } from '../src/config.js';
import { applyEdgePreset, cycleEdge, invertEdges, normalizeEdges } from '../src/edges.js';
import {
  canvasPointToGrid,
  findAvailablePosition,
  getSizePreset,
  gridRect,
  normalizeGridItem,
  itemsOverlap,
} from '../src/grid.js';
import { PRIMITIVES, renderPrimitive } from '../src/primitives.js';
import { loadWorkspace } from '../src/store.js';
import { renderApp } from '../src/ui.js';

assert.deepEqual(Object.keys(PRIMITIVES), ['rectangle', 'ellipse']);
assert.equal(PRIMITIVES.line, undefined);
assert.deepEqual(Object.keys(SIZE_PRESETS), ['1x1', '1x2', '2x2', '2x3', '3x3']);
assert.equal(GRID.cell, 80);

for (const [type, definition] of Object.entries(PRIMITIVES)) {
  for (const size of Object.keys(SIZE_PRESETS)) {
    const item = {
      id: `${type}-${size}`,
      type,
      column: 1,
      row: 2,
      size,
      token: definition.defaultToken,
      edges: { top: 'slot', right: 'tab', bottom: 'flat', left: 'slot' },
      appearance: 'solid',
      borderWidth: 8,
    };
    const markup = renderPrimitive(item, DEFAULT_TOKENS);
    assert.match(markup, new RegExp(`data-motif-type="${type}"`));
    assert.match(markup, new RegExp(`data-grid-size="${size}"`));
    assert.match(markup, /data-edge-top="slot"/);
    assert.match(markup, /data-edge-right="tab"/);
    assert.match(markup, /<mask/);
  }
}

const outline = renderPrimitive({
  id: 'rectangle-outline',
  type: 'rectangle',
  column: 0,
  row: 0,
  size: '1x1',
  token: 'blue',
  edges: applyEdgePreset('tabs'),
  appearance: 'outline',
  borderWidth: 12,
}, DEFAULT_TOKENS);
assert.match(outline, /data-appearance="outline"/);
assert.match(outline, /data-border-width="12"/);
assert.match(outline, /feMorphology/);
assert.match(outline, /operator="erode"/);

const attachedTab = renderPrimitive({
  id: 'ellipse-tab', type: 'ellipse', column: 0, row: 0, size: '2x3', token: 'yellow',
  edges: { top: 'flat', right: 'tab', bottom: 'flat', left: 'flat' },
  appearance: 'solid', borderWidth: 8,
}, DEFAULT_TOKENS);
assert.match(attachedTab, /x="144" y="94" width="32" height="52" fill="#fff"/);

assert.equal(cycleEdge('flat'), 'slot');
assert.equal(cycleEdge('slot'), 'tab');
assert.equal(cycleEdge('tab'), 'flat');
assert.deepEqual(invertEdges({ top: 'slot', right: 'tab', bottom: 'flat', left: 'slot' }), {
  top: 'tab', right: 'slot', bottom: 'flat', left: 'tab',
});
assert.deepEqual(normalizeEdges({ top: 'invalid', right: 'tab' }), {
  top: 'flat', right: 'tab', bottom: 'flat', left: 'flat',
});
assert.deepEqual(Object.keys(applyEdgePreset('alternate')), EDGE_KEYS);

const interfaceMarkup = renderApp({
  document: {
    version: 2,
    name: 'Test composition',
    items: [{
      id: 'rectangle-1', name: 'Rectangle 1', type: 'rectangle', column: 0, row: 0,
      size: '1x1', token: 'blue', edges: applyEdgePreset('alternate'),
      appearance: 'outline', borderWidth: 8,
    }],
  },
  tokens: DEFAULT_TOKENS,
  selectedId: 'rectangle-1',
  theme: 'light',
});
assert.match(interfaceMarkup, /Shape controls/);
assert.match(interfaceMarkup, /Edge connectors/);
assert.match(interfaceMarkup, /id="invert-edges"/);
assert.match(interfaceMarkup, /data-edge="top"/);
assert.doesNotMatch(interfaceMarkup, /data-grid-coordinate|data-select-item|Inspector|System structure|layers/i);
assert.doesNotMatch(interfaceMarkup, /data-add-primitive="line"/);

const memoryStorage = new Map([[STORAGE_KEYS.legacyDocument, JSON.stringify({
  version: 1,
  name: 'Legacy composition',
  nextItemId: 3,
  items: [
    { id: 'rectangle-1', name: 'Rectangle 1', type: 'rectangle', column: 0, row: 0, size: '2x2', token: 'blue' },
    { id: 'line-2', name: 'Line 2', type: 'line', column: 2, row: 2, size: '1x1', token: 'clay' },
  ],
})]]);
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, String(value)),
};
const migratedWorkspace = loadWorkspace();
assert.equal(migratedWorkspace.document.version, 2);
assert.deepEqual(migratedWorkspace.document.items.map((item) => item.type), ['rectangle']);
assert.deepEqual(migratedWorkspace.document.items[0].edges, {
  top: 'slot', right: 'tab', bottom: 'flat', left: 'flat',
});

for (const size of Object.keys(SIZE_PRESETS)) {
  const preset = getSizePreset(size);
  const normalized = normalizeGridItem({ column: 99, row: -20, size });
  assert.equal(normalized.column, GRID.columns - preset.columns);
  assert.equal(normalized.row, 0);
  const rect = gridRect(normalized);
  assert.equal(rect.width, preset.columns * GRID.cell);
  assert.equal(rect.height, preset.rows * GRID.cell);
}

assert.deepEqual(canvasPointToGrid(168, 247, '2x2', { x: 12, y: 7 }), { column: 2, row: 3 });
assert.equal(itemsOverlap(
  { column: 0, row: 0, size: '2x2' },
  { column: 2, row: 0, size: '2x2' },
), false);
assert.equal(itemsOverlap(
  { column: 0, row: 0, size: '2x2' },
  { column: 1, row: 1, size: '2x2' },
), true);

const occupied = [{ column: 0, row: 0, size: '2x2' }];
const openPosition = findAvailablePosition(occupied, '1x1', 0);
assert.deepEqual(openPosition, { column: 2, row: 0 });

console.log('Motif grid, connector, and primitive tests passed.');

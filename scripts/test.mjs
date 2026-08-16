import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DEFAULT_TOKENS, EDGE_KEYS, GRID, SIZE_PRESETS, STORAGE_KEYS } from '../src/config.js';
import { applyEdgePreset, cycleEdge, invertEdges, normalizeEdges } from '../src/edges.js';
import {
  canvasPointToGrid,
  findAvailablePosition,
  getGridMetrics,
  getSizePreset,
  gridRect,
  normalizeGutter,
  normalizeGridItem,
  itemsOverlap,
} from '../src/grid.js';
import { createDuplicateItem } from '../src/items.js';
import { PRIMITIVES, renderPrimitive } from '../src/primitives.js';
import { createRandomComposition, createRandomPrimitive, randomEdges } from '../src/random.js';
import { getStackPosition, reorderStack } from '../src/stack.js';
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
assert.match(attachedTab, /x="152" y="94" width="16" height="52" fill="#fff"/);

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
    gutter: 12,
    showGrid: true,
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
assert.match(interfaceMarkup, /id="grid-gutter"/);
assert.match(interfaceMarkup, /id="toggle-grid"/);
assert.match(interfaceMarkup, /id="grid-visibility-mask"/);
assert.match(interfaceMarkup, /y="-1.5"/);
assert.match(interfaceMarkup, /12px gutter/);
assert.match(interfaceMarkup, /data-stack-action="send-front"/);
assert.match(interfaceMarkup, /⌘D duplicate/);
assert.match(interfaceMarkup, /Delete remove/);
assert.match(interfaceMarkup, /id="generate-composition"/);
assert.match(interfaceMarkup, /id="clear-board"/);
assert.match(interfaceMarkup, /Add composition/);
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
assert.equal(migratedWorkspace.document.gutter, 0);
assert.equal(migratedWorkspace.document.showGrid, true);
assert.deepEqual(migratedWorkspace.document.items.map((item) => item.type), ['rectangle']);
assert.deepEqual(migratedWorkspace.document.items[0].edges, {
  top: 'slot', right: 'tab', bottom: 'flat', left: 'flat',
});

memoryStorage.set(STORAGE_KEYS.document, JSON.stringify({
  version: 2,
  name: 'Cleared composition',
  gutter: 10,
  showGrid: false,
  nextItemId: 12,
  items: [],
}));
const clearedWorkspace = loadWorkspace();
assert.equal(clearedWorkspace.document.name, 'Cleared composition');
assert.equal(clearedWorkspace.document.items.length, 0);
assert.equal(clearedWorkspace.document.nextItemId, 12);

for (const size of Object.keys(SIZE_PRESETS)) {
  const preset = getSizePreset(size);
  const normalized = normalizeGridItem({ column: 99, row: -20, size });
  assert.equal(normalized.column, GRID.columns - preset.columns);
  assert.equal(normalized.row, 0);
  const rect = gridRect(normalized);
  assert.equal(rect.width, preset.columns * GRID.cell);
  assert.equal(rect.height, preset.rows * GRID.cell);
}

assert.equal(normalizeGutter(999), GRID.maxGutter);
assert.equal(normalizeGutter(-10), GRID.defaultGutter);
const gutterMetrics = getGridMetrics(18);
assert.deepEqual(gutterMetrics, { gutter: 18, cell: 64, pitch: 82 });
assert.deepEqual(gridRect({ column: 2, row: 3, size: '2x2' }, 18), {
  x: 164,
  y: 246,
  width: 146,
  height: 146,
});
assert.deepEqual(canvasPointToGrid(176, 253, '2x2', { x: 12, y: 7 }, 18), { column: 2, row: 3 });

const stack = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
assert.deepEqual(reorderStack(stack, 'b', 'front').map((item) => item.id), ['a', 'c', 'b', 'd']);
assert.deepEqual(reorderStack(stack, 'c', 'back').map((item) => item.id), ['a', 'c', 'b', 'd']);
assert.deepEqual(reorderStack(stack, 'd', 'send-back').map((item) => item.id), ['d', 'a', 'b', 'c']);
assert.deepEqual(reorderStack(stack, 'a', 'send-front').map((item) => item.id), ['b', 'c', 'd', 'a']);
assert.deepEqual(getStackPosition(stack, 'c'), { index: 2, count: 4 });

const duplicateSource = {
  id: 'rectangle-2', name: 'Rectangle 2', type: 'rectangle', column: 1, row: 1,
  size: '2x2', token: 'blue', edges: { top: 'slot', right: 'tab', bottom: 'flat', left: 'flat' },
  appearance: 'outline', borderWidth: 8,
};
const duplicate = createDuplicateItem(duplicateSource, 8, { column: 4, row: 5 }, 'Rectangle');
assert.equal(duplicate.id, 'rectangle-8');
assert.equal(duplicate.name, 'Rectangle 8');
assert.equal(duplicate.column, 4);
assert.equal(duplicate.row, 5);
assert.deepEqual(duplicate.edges, duplicateSource.edges);
assert.notEqual(duplicate.edges, duplicateSource.edges);

const randomValues = [0.99, 0.8, 0.4, 0.2];
const deterministicRandom = () => randomValues.shift() ?? 0;
const randomPrimitive = createRandomPrimitive({
  type: 'ellipse',
  itemNumber: 9,
  items: [],
  random: deterministicRandom,
});
assert.equal(randomPrimitive.id, 'ellipse-9');
assert.equal(randomPrimitive.size, '3x3');
assert.equal(randomPrimitive.token, 'ink');
assert.deepEqual(randomPrimitive.edges, {
  top: 'flat', right: 'slot', bottom: 'tab', left: 'flat',
});
assert.notDeepEqual(randomPrimitive.edges, { top: 'flat', right: 'flat', bottom: 'flat', left: 'flat' });

const randomPattern = randomEdges(() => 0.75);
assert.deepEqual(Object.keys(randomPattern), EDGE_KEYS);
assert.ok(Object.values(randomPattern).some((state) => state !== 'flat'));

const generated = createRandomComposition({ items: [], nextItemId: 20, random: () => 0.1 });
assert.equal(generated.items.length, 5);
assert.equal(generated.nextItemId, 25);
assert.deepEqual(generated.items.map((item) => item.id), [
  'rectangle-20', 'rectangle-21', 'rectangle-22', 'rectangle-23', 'rectangle-24',
]);
for (let first = 0; first < generated.items.length; first += 1) {
  for (let second = first + 1; second < generated.items.length; second += 1) {
    assert.equal(itemsOverlap(generated.items[first], generated.items[second]), false);
  }
}

const hiddenGridMarkup = renderApp({
  document: {
    version: 2, name: 'Hidden grid', gutter: 18, showGrid: false,
    items: [{ ...duplicate, id: 'rectangle-8' }],
  },
  tokens: DEFAULT_TOKENS,
  selectedId: 'rectangle-8',
  theme: 'light',
});
assert.match(hiddenGridMarkup, /canvas-shell grid-hidden/);
assert.match(hiddenGridMarkup, /aria-checked="false"/);
assert.doesNotMatch(hiddenGridMarkup, /class="grid-cell"/);

assert.deepEqual(canvasPointToGrid(168, 247, '2x2', { x: 12, y: 7 }), { column: 2, row: 3 });
assert.equal(itemsOverlap(
  { column: 0, row: 0, size: '2x2' },
  { column: 2, row: 0, size: '2x2' },
), false);
assert.equal(itemsOverlap(
  { column: 0, row: 0, size: '2x2' },
  { column: 1, row: 1, size: '2x2' },
), true);

const [indexSource, stylesSource, mainSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
]);
assert.match(indexSource, /tasa-orbiter/);
assert.doesNotMatch(indexSource, /Manrope|DM\+Mono|fonts\.googleapis/);
assert.match(stylesSource, /--font: "TASA Orbiter", sans-serif/);
assert.doesNotMatch(stylesSource, /font-mono|font-sans|Manrope|DM Mono/);
assert.match(mainSource, /\['Backspace', 'Delete'\]/);
assert.match(mainSource, /window\.confirm\('Clear every shape from this board\?'\)/);

const occupied = [{ column: 0, row: 0, size: '2x2' }];
const openPosition = findAvailablePosition(occupied, '1x1', 0);
assert.deepEqual(openPosition, { column: 2, row: 0 });

console.log('Motif grid, connector, and primitive tests passed.');

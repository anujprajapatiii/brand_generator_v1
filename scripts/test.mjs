import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_TOKENS,
  EDGE_KEYS,
  GRID,
  MOTIF_DENSITIES,
  MOTIF_GLOWS,
  MOTIF_KINDS,
  SIZE_PRESETS,
  STORAGE_KEYS,
} from '../src/config.js';
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
import { createRandomMotif, normalizeMotif, renderMotifLayer, resolvedMotifKind } from '../src/motifs.js';
import { PRIMITIVES, renderPrimitive } from '../src/primitives.js';
import { createRandomComposition, createRandomPrimitive, randomEdges } from '../src/random.js';
import { getStackPosition, reorderStack } from '../src/stack.js';
import { loadWorkspace } from '../src/store.js';
import { renderApp } from '../src/ui.js';

assert.deepEqual(Object.keys(PRIMITIVES), ['rectangle', 'ellipse']);
assert.equal(PRIMITIVES.line, undefined);
assert.deepEqual(Object.keys(SIZE_PRESETS), ['1x1', '1x2', '2x2', '2x3', '3x3']);
assert.equal(GRID.cell, 80);
assert.deepEqual(MOTIF_KINDS, ['auto', 'none', 'fragments', 'scribble', 'dots']);
assert.deepEqual(MOTIF_DENSITIES, ['sparse', 'balanced', 'rich']);
assert.deepEqual(MOTIF_GLOWS, ['off', 'soft', 'bright']);

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
    assert.match(markup, /class="motif-layer"/);
    assert.doesNotMatch(markup, /NaN|undefined/);
  }
}

for (const kind of MOTIF_KINDS.filter((candidate) => !['auto', 'none'].includes(candidate))) {
  for (const size of Object.keys(SIZE_PRESETS)) {
    const motifItem = {
      id: `${kind}-${size}`,
      type: 'rectangle',
      column: 0,
      row: 0,
      size,
      token: 'green',
      edges: { top: 'slot', right: 'tab', bottom: 'slot', left: 'tab' },
      appearance: 'solid',
      borderWidth: 8,
      motif: { kind, seed: 813, density: 'rich', glow: 'bright' },
    };
    const motifMarkup = renderPrimitive(motifItem, DEFAULT_TOKENS, { gutter: 24 });
    assert.match(motifMarkup, new RegExp(`data-content-kind="${kind}"`));
    assert.match(motifMarkup, /data-content-density="rich"/);
    assert.match(motifMarkup, /data-content-glow="bright"/);
    assert.match(motifMarkup, /mask="url\(#shape-mask-/);
    assert.match(motifMarkup, /feGaussianBlur/);
    assert.doesNotMatch(motifMarkup, /NaN|undefined/);
  }
}

const stableMotifItem = {
  id: 'stable-motif', type: 'ellipse', column: 0, row: 0, size: '1x1', token: 'yellow',
  edges: applyEdgePreset('alternate'), appearance: 'solid', borderWidth: 8,
  motif: { kind: 'auto', seed: 995, density: 'balanced', glow: 'off' },
};
const stableSmall = renderPrimitive(stableMotifItem, DEFAULT_TOKENS);
const stableRepeat = renderPrimitive(stableMotifItem, DEFAULT_TOKENS);
const stableLarge = renderPrimitive({ ...stableMotifItem, size: '3x3' }, DEFAULT_TOKENS);
assert.equal(stableSmall, stableRepeat);
assert.notEqual(stableSmall, stableLarge);
assert.match(stableSmall, /data-content-mode="auto"/);
assert.doesNotMatch(stableSmall, /feGaussianBlur/);
assert.equal(resolvedMotifKind(normalizeMotif(stableMotifItem.motif)), resolvedMotifKind(stableMotifItem.motif));

const hiddenMotif = renderPrimitive({ ...stableMotifItem, motif: { ...stableMotifItem.motif, kind: 'none' } }, DEFAULT_TOKENS);
assert.doesNotMatch(hiddenMotif, /class="motif-layer"/);

function fragmentLayerAt(width, height, density = 'rich') {
  const markup = renderMotifLayer({
    id: `fragments-${width}-${height}-${density}`, type: 'rectangle', edges: applyEdgePreset('alternate'),
    motif: { kind: 'fragments', seed: 813, density, glow: 'off' },
  }, width, height, `fragment-mask-${width}-${height}-${density}`);
  const rects = [...markup.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" fill="#fff"\/>/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]), radius: Number(match[5]) }));
  return {
    markup,
    rects,
    unit: Number(markup.match(/data-fragment-unit="(\d+)"/)[1]),
    patternCount: Number(markup.match(/data-fragment-pattern-count="(\d+)"/)[1]),
    patterns: markup.match(/data-fragment-patterns="([^"]+)"/)[1].split(','),
    spread: Number(markup.match(/data-fragment-spread="([\d.]+)"/)[1]),
  };
}

const fragmentDensityMatrix = [
  { width: 80, height: 80, counts: [1, 2, 3] },
  { width: 80, height: 160, counts: [1, 3, 4] },
  { width: 160, height: 160, counts: [2, 3, 5] },
  { width: 160, height: 240, counts: [2, 4, 7] },
  { width: 240, height: 240, counts: [3, 5, 9] },
];
fragmentDensityMatrix.forEach(({ width, height, counts }) => {
  const coverage = [];
  MOTIF_DENSITIES.forEach((density, densityIndex) => {
    const fragmentLayer = fragmentLayerAt(width, height, density);
    assert.equal(fragmentLayer.unit, 8);
    assert.equal(fragmentLayer.patternCount, counts[densityIndex]);
    assert.equal(fragmentLayer.spread, [0.38, 0.66, 0.92][densityIndex]);
    assert.equal(fragmentLayer.patterns.length, fragmentLayer.patternCount);
    assert.ok(fragmentLayer.rects.length >= fragmentLayer.patternCount);
    assert.ok(fragmentLayer.rects.every((rect) => rect.width % fragmentLayer.unit === 0));
    assert.ok(fragmentLayer.rects.every((rect) => rect.height % fragmentLayer.unit === 0));
    assert.ok(fragmentLayer.rects.every((rect) => rect.radius === 2.25));
    assert.equal(Number(((Math.min(...fragmentLayer.rects.map((rect) => rect.x)) + Math.max(...fragmentLayer.rects.map((rect) => rect.x + rect.width))) / 2).toFixed(1)), width / 2);
    assert.equal(Number(((Math.min(...fragmentLayer.rects.map((rect) => rect.y)) + Math.max(...fragmentLayer.rects.map((rect) => rect.y + rect.height))) / 2).toFixed(1)), height / 2);
    const boundsWidth = Math.max(...fragmentLayer.rects.map((rect) => rect.x + rect.width)) - Math.min(...fragmentLayer.rects.map((rect) => rect.x));
    const boundsHeight = Math.max(...fragmentLayer.rects.map((rect) => rect.y + rect.height)) - Math.min(...fragmentLayer.rects.map((rect) => rect.y));
    coverage.push(boundsWidth * boundsHeight);
  });
  assert.ok(coverage[1] > coverage[0]);
  assert.ok(coverage[2] > coverage[1]);
});

const richLargeFragments = fragmentLayerAt(240, 240, 'rich');
assert.deepEqual(new Set(richLargeFragments.patterns), new Set(['bar', 'split', 'step', 'corner', 'dot']));
assert.ok(new Set(richLargeFragments.rects.map((rect) => rect.width)).size >= 3);

const rectangularScribbles = ['sparse', 'balanced', 'rich'].map((density) => renderMotifLayer({
  id: `scribble-${density}`, type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'scribble', seed: 41, density, glow: 'off' },
}, 240, 120, `scribble-${density}-mask`));
const rectangularCommandCounts = rectangularScribbles.map((markup) => (markup.match(/ C/g) ?? []).length);
assert.deepEqual(rectangularCommandCounts, [5, 6, 7]);
assert.ok(rectangularScribbles.every((markup) => /<path d="M[^"]+ C/.test(markup)));
assert.ok(rectangularScribbles.every((markup) => !/ L| A/.test(markup)));
assert.ok(rectangularScribbles.every((markup) => /stroke-linecap="round" stroke-linejoin="round"/.test(markup)));
assert.ok(rectangularScribbles.every((markup) => /data-scribble-structure="gesture"/.test(markup)));

const rerolledRectanglePaths = [40, 41, 42, 43].map((seed) => renderMotifLayer({
  id: `scribble-structure-${seed}`, type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'scribble', seed, density: 'balanced', glow: 'off' },
}, 240, 120, `scribble-structure-${seed}-mask`).match(/<path d="([^"]+)"/)[1]);
assert.equal(new Set(rerolledRectanglePaths).size, 4);

const ellipseSpirals = ['sparse', 'balanced', 'rich'].map((density) => renderMotifLayer({
  id: `spiral-${density}`, type: 'ellipse', edges: applyEdgePreset('flat'),
  motif: { kind: 'scribble', seed: 41, density, glow: 'off' },
}, 160, 160, `spiral-${density}-mask`));
const spiralLaps = ellipseSpirals.map((markup) => Number(markup.match(/data-scribble-laps="(\d+)"/)[1]));
assert.equal(spiralLaps[0], 1);
assert.ok([2, 3].includes(spiralLaps[1]));
assert.ok([3, 4].includes(spiralLaps[2]));
assert.ok(ellipseSpirals.every((markup) => /data-scribble-structure="spiral"/.test(markup)));
assert.ok(ellipseSpirals.every((markup) => !/ L| A/.test(markup)));

const spiralStrokeWidths = [[80, 80], [80, 160], [160, 160], [160, 240], [240, 240]].map(([width, height]) => {
  const markup = renderMotifLayer({
    id: `spiral-stroke-${width}-${height}`, type: 'ellipse', edges: applyEdgePreset('flat'),
    motif: { kind: 'scribble', seed: 41, density: 'balanced', glow: 'off' },
  }, width, height, `spiral-stroke-mask-${width}-${height}`);
  return Number(markup.match(/stroke-width="([\d.]+)"/)[1]);
});
assert.ok(spiralStrokeWidths.every((width, index) => index === 0 || width > spiralStrokeWidths[index - 1]));

const horizontalDots = renderMotifLayer({
  id: 'dots-horizontal', type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'dots', seed: 812, density: 'balanced', glow: 'off' },
}, 160, 160, 'dots-horizontal-mask');
const horizontalCircles = [...horizontalDots.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
assert.equal(horizontalCircles.length, 3);
assert.deepEqual([...new Set(horizontalCircles.map((circle) => circle.y))], [80]);
assert.equal(horizontalCircles.reduce((sum, circle) => sum + circle.x, 0) / horizontalCircles.length, 80);
assert.ok((horizontalCircles[1].x - horizontalCircles[0].x) - (horizontalCircles[0].radius * 2) >= 10);

const richHorizontalDots = renderMotifLayer({
  id: 'dots-horizontal-rich', type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'dots', seed: 812, density: 'rich', glow: 'off' },
}, 160, 160, 'dots-horizontal-rich-mask');
const richHorizontalCircles = [...richHorizontalDots.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
assert.equal(richHorizontalCircles.length, 5);
assert.ok(richHorizontalCircles[0].radius < horizontalCircles[0].radius);
assert.ok((richHorizontalCircles[1].x - richHorizontalCircles[0].x) - (richHorizontalCircles[0].radius * 2) >= 10);

const verticalDots = renderMotifLayer({
  id: 'dots-vertical', type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'dots', seed: 812, density: 'rich', glow: 'off' },
}, 80, 160, 'dots-vertical-mask');
const verticalCircles = [...verticalDots.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
assert.equal(verticalCircles.length, 5);
assert.deepEqual([...new Set(verticalCircles.map((circle) => circle.x))], [40]);
assert.equal(verticalCircles.reduce((sum, circle) => sum + circle.y, 0) / verticalCircles.length, 80);

const singleDot = renderMotifLayer({
  id: 'dot-single', type: 'rectangle', edges: applyEdgePreset('flat'),
  motif: { kind: 'dots', seed: 812, density: 'sparse', glow: 'off' },
}, 160, 160, 'dot-single-mask');
const singleDotRadius = Number(singleDot.match(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/)[1]);
assert.ok(singleDotRadius > horizontalCircles[0].radius);

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
assert.match(interfaceMarkup, /Inner motif/);
assert.match(interfaceMarkup, /id="motif-kind"/);
assert.match(interfaceMarkup, /id="reroll-motif"/);
assert.match(interfaceMarkup, /data-motif-density="balanced"/);
assert.match(interfaceMarkup, /data-motif-glow="soft"/);
assert.doesNotMatch(interfaceMarkup, /<option value="curve"/);
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
assert.equal(migratedWorkspace.document.items[0].motif.kind, 'auto');
assert.ok(migratedWorkspace.document.items[0].motif.seed > 0);

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
  motif: { kind: 'scribble', seed: 41, density: 'rich', glow: 'bright' },
};
const duplicate = createDuplicateItem(duplicateSource, 8, { column: 4, row: 5 }, 'Rectangle');
assert.equal(duplicate.id, 'rectangle-8');
assert.equal(duplicate.name, 'Rectangle 8');
assert.equal(duplicate.column, 4);
assert.equal(duplicate.row, 5);
assert.deepEqual(duplicate.edges, duplicateSource.edges);
assert.notEqual(duplicate.edges, duplicateSource.edges);
assert.deepEqual(duplicate.motif, duplicateSource.motif);
assert.notEqual(duplicate.motif, duplicateSource.motif);

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
assert.equal(randomPrimitive.motif.kind, 'auto');
assert.ok(randomPrimitive.motif.seed > 0);
assert.ok(MOTIF_DENSITIES.includes(randomPrimitive.motif.density));
assert.ok(MOTIF_GLOWS.includes(randomPrimitive.motif.glow));

const generatedMotif = createRandomMotif(() => 0.5);
assert.deepEqual(generatedMotif, { kind: 'auto', seed: 1073741823, density: 'balanced', glow: 'soft' });

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
assert.match(indexSource, /src\/main\.js\?v=motif-refine/);
assert.doesNotMatch(indexSource, /Manrope|DM\+Mono|fonts\.googleapis/);
assert.match(stylesSource, /--font: "TASA Orbiter", sans-serif/);
assert.doesNotMatch(stylesSource, /font-mono|font-sans|Manrope|DM Mono/);
assert.match(mainSource, /\['Backspace', 'Delete'\]/);
assert.match(mainSource, /window\.confirm\('Clear every shape from this board\?'\)/);
assert.match(mainSource, /sidebarScrollTop = root\.querySelector\('\.sidebar'\)\?\.scrollTop \?\? 0/);
assert.match(mainSource, /sidebar\.scrollTop = sidebarScrollTop/);
const motifSource = await readFile(new URL('../src/motifs.js', import.meta.url), 'utf8');
assert.doesNotMatch(motifSource, /curveGeometry|kind === 'curve'/);
const buildSource = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
assert.match(buildSource, /GITHUB_SHA/);
assert.match(buildSource, /styles\\\.css/);
assert.match(buildSource, /main\\\.js/);

const occupied = [{ column: 0, row: 0, size: '2x2' }];
const openPosition = findAvailablePosition(occupied, '1x1', 0);
assert.deepEqual(openPosition, { column: 2, row: 0 });

console.log('Motif grid, connector, and primitive tests passed.');

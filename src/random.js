import { DEFAULT_TOKENS, GRID, SIZE_PRESETS } from './config.js';
import { findAvailablePosition, itemsOverlap } from './grid.js';
import { PRIMITIVES } from './primitives.js';

const TOKEN_KEYS = Object.freeze(Object.keys(DEFAULT_TOKENS));
const SIZE_KEYS = Object.freeze(Object.keys(SIZE_PRESETS));
const PRIMITIVE_KEYS = Object.freeze(Object.keys(PRIMITIVES));

const EDGE_PATTERNS = Object.freeze([
  Object.freeze({ top: 'slot', right: 'tab', bottom: 'flat', left: 'flat' }),
  Object.freeze({ top: 'tab', right: 'slot', bottom: 'flat', left: 'flat' }),
  Object.freeze({ top: 'flat', right: 'tab', bottom: 'slot', left: 'flat' }),
  Object.freeze({ top: 'flat', right: 'slot', bottom: 'tab', left: 'flat' }),
  Object.freeze({ top: 'slot', right: 'tab', bottom: 'slot', left: 'tab' }),
  Object.freeze({ top: 'tab', right: 'slot', bottom: 'tab', left: 'slot' }),
  Object.freeze({ top: 'slot', right: 'flat', bottom: 'tab', left: 'slot' }),
  Object.freeze({ top: 'tab', right: 'slot', bottom: 'flat', left: 'tab' }),
]);

const COMPOSITION_RECIPES = Object.freeze([
  Object.freeze([
    Object.freeze({ size: '2x3', start: 19 }),
    Object.freeze({ size: '2x2', start: 39 }),
    Object.freeze({ size: '1x2', start: 23 }),
    Object.freeze({ size: '1x1', start: 51 }),
    Object.freeze({ size: '2x2', start: 42 }),
  ]),
  Object.freeze([
    Object.freeze({ size: '3x3', start: 28 }),
    Object.freeze({ size: '1x2', start: 22 }),
    Object.freeze({ size: '2x2', start: 48 }),
    Object.freeze({ size: '1x1', start: 16 }),
  ]),
  Object.freeze([
    Object.freeze({ size: '2x2', start: 10 }),
    Object.freeze({ size: '2x3', start: 31 }),
    Object.freeze({ size: '1x2', start: 52 }),
    Object.freeze({ size: '2x2', start: 56 }),
    Object.freeze({ size: '1x1', start: 25 }),
    Object.freeze({ size: '1x1', start: 44 }),
  ]),
]);

export function pickRandom(values, random = Math.random) {
  if (!values.length) return undefined;
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function randomEdges(random = Math.random) {
  return { ...pickRandom(EDGE_PATTERNS, random) };
}

export function randomShapeTraits(random = Math.random, forcedSize = null) {
  return {
    size: SIZE_PRESETS[forcedSize] ? forcedSize : pickRandom(SIZE_KEYS, random),
    token: pickRandom(TOKEN_KEYS, random),
    edges: randomEdges(random),
    appearance: 'solid',
    borderWidth: 8,
  };
}

function openPosition(items, size, start) {
  const position = findAvailablePosition(items, size, start);
  const candidate = { ...position, size };
  return items.every((item) => !itemsOverlap(candidate, item)) ? position : null;
}

export function createRandomPrimitive({
  type,
  itemNumber,
  items = [],
  random = Math.random,
  size = null,
  startIndex = null,
}) {
  const definition = PRIMITIVES[type];
  if (!definition) return null;

  const traits = randomShapeTraits(random, size);
  const start = startIndex ?? Math.floor(random() * GRID.columns * GRID.rows);
  const preferredIndex = SIZE_KEYS.indexOf(traits.size);
  const sizeCandidates = [
    ...SIZE_KEYS.slice(preferredIndex),
    ...SIZE_KEYS.slice(0, preferredIndex),
  ];
  const actualSize = sizeCandidates.find((candidateSize) => openPosition(items, candidateSize, start));
  const position = actualSize ? openPosition(items, actualSize, start) : null;
  if (!position) return null;

  return {
    id: `${type}-${itemNumber}`,
    name: `${definition.label} ${itemNumber}`,
    type,
    ...position,
    ...traits,
    size: actualSize,
  };
}

export function createRandomComposition({
  items = [],
  nextItemId = 1,
  random = Math.random,
}) {
  const recipe = pickRandom(COMPOSITION_RECIPES, random);
  const placed = [...items];
  const created = [];
  let itemNumber = nextItemId;

  recipe.forEach((step, index) => {
    const type = pickRandom(PRIMITIVE_KEYS, random);
    const item = createRandomPrimitive({
      type,
      itemNumber,
      items: placed,
      random,
      size: step.size,
      startIndex: step.start + index,
    });
    if (!item) return;
    placed.push(item);
    created.push(item);
    itemNumber += 1;
  });

  return { items: created, nextItemId: itemNumber };
}

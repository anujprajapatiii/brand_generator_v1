import assert from 'node:assert/strict';
import { DEFAULT_TOKENS, GRID, SIZE_PRESETS } from '../src/config.js';
import {
  canvasPointToGrid,
  findAvailablePosition,
  gridRect,
  itemsOverlap,
  normalizeGridItem,
} from '../src/grid.js';
import { PRIMITIVES, renderPrimitive } from '../src/primitives.js';

assert.deepEqual(Object.keys(PRIMITIVES), ['rectangle', 'ellipse', 'line']);

for (const [sizeKey, size] of Object.entries(SIZE_PRESETS)) {
  const normalized = normalizeGridItem({ column: 999.4, row: 999.4, size: sizeKey });
  assert.equal(normalized.column, GRID.columns - size.columns);
  assert.equal(normalized.row, GRID.rows - size.rows);
  assert.ok(Number.isInteger(normalized.column));
  assert.ok(Number.isInteger(normalized.row));

  const rect = gridRect({ column: 2, row: 3, size: sizeKey });
  assert.equal(rect.x, 2 * GRID.cell);
  assert.equal(rect.y, 3 * GRID.cell);
  assert.equal(rect.width, size.columns * GRID.cell);
  assert.equal(rect.height, size.rows * GRID.cell);
}

for (const primitiveType of Object.keys(PRIMITIVES)) {
  for (const sizeKey of Object.keys(SIZE_PRESETS)) {
    const markup = renderPrimitive({
      id: `${primitiveType}-${sizeKey}`,
      type: primitiveType,
      column: 0,
      row: 0,
      size: sizeKey,
      token: PRIMITIVES[primitiveType].defaultToken,
    }, DEFAULT_TOKENS);
    assert.match(markup, new RegExp(`data-motif-type="${primitiveType}"`));
    assert.match(markup, new RegExp(`data-grid-size="${sizeKey}"`));
  }
}

assert.deepEqual(
  canvasPointToGrid(GRID.cell * 2.49, GRID.cell * 4.51, '1x1'),
  { column: 2, row: 5 },
);
assert.deepEqual(
  canvasPointToGrid(GRID.cell * 8.9, GRID.cell * 8.9, '3x3'),
  { column: 6, row: 6 },
);

assert.equal(
  itemsOverlap(
    { column: 0, row: 0, size: '2x2' },
    { column: 1, row: 1, size: '1x1' },
  ),
  true,
);
assert.equal(
  itemsOverlap(
    { column: 0, row: 0, size: '2x2' },
    { column: 2, row: 0, size: '1x1' },
  ),
  false,
);

assert.deepEqual(
  findAvailablePosition([{ column: 0, row: 0, size: '1x1' }], '1x1', 0),
  { column: 1, row: 0 },
);

console.log(`Grid model verified for ${Object.keys(PRIMITIVES).length} primitives across ${Object.keys(SIZE_PRESETS).length} approved footprints.`);

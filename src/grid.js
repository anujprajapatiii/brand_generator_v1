import { GRID, SIZE_PRESETS } from './config.js';

export function getSizePreset(sizeKey) {
  return SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS['1x1'];
}

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeGutter(value) {
  return clamp(Math.round(Number(value) || 0), GRID.defaultGutter, GRID.maxGutter);
}

export function getGridMetrics(gutter = GRID.defaultGutter) {
  const normalizedGutter = normalizeGutter(gutter);
  const cell = (GRID.cell * GRID.columns - (normalizedGutter * (GRID.columns - 1))) / GRID.columns;
  return {
    gutter: normalizedGutter,
    cell,
    pitch: cell + normalizedGutter,
  };
}

export function clampGridPosition(column, row, sizeKey) {
  const size = getSizePreset(sizeKey);
  return {
    column: clamp(Math.round(Number(column) || 0), 0, GRID.columns - size.columns),
    row: clamp(Math.round(Number(row) || 0), 0, GRID.rows - size.rows),
  };
}

export function normalizeGridItem(item) {
  const size = SIZE_PRESETS[item.size] ? item.size : '1x1';
  return {
    ...item,
    size,
    ...clampGridPosition(item.column, item.row, size),
  };
}

export function gridRect(item, gutter = GRID.defaultGutter) {
  const normalized = normalizeGridItem(item);
  const size = getSizePreset(normalized.size);
  const metrics = getGridMetrics(gutter);
  return {
    x: normalized.column * metrics.pitch,
    y: normalized.row * metrics.pitch,
    width: (size.columns * metrics.cell) + ((size.columns - 1) * metrics.gutter),
    height: (size.rows * metrics.cell) + ((size.rows - 1) * metrics.gutter),
  };
}

export function canvasPointToGrid(
  x,
  y,
  sizeKey,
  grabOffset = { x: 0, y: 0 },
  gutter = GRID.defaultGutter,
) {
  const metrics = getGridMetrics(gutter);
  return clampGridPosition(
    Math.round((x - grabOffset.x) / metrics.pitch),
    Math.round((y - grabOffset.y) / metrics.pitch),
    sizeKey,
  );
}

export function itemsOverlap(first, second) {
  const a = normalizeGridItem(first);
  const b = normalizeGridItem(second);
  const aSize = getSizePreset(a.size);
  const bSize = getSizePreset(b.size);

  return !(
    a.column + aSize.columns <= b.column
    || b.column + bSize.columns <= a.column
    || a.row + aSize.rows <= b.row
    || b.row + bSize.rows <= a.row
  );
}

export function findAvailablePosition(items, sizeKey, startIndex = 0) {
  const size = getSizePreset(sizeKey);
  const candidates = [];

  for (let row = 0; row <= GRID.rows - size.rows; row += 1) {
    for (let column = 0; column <= GRID.columns - size.columns; column += 1) {
      candidates.push({ column, row });
    }
  }

  if (!candidates.length) return { column: 0, row: 0 };

  const offset = Math.abs(Math.round(startIndex)) % candidates.length;
  const ordered = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return ordered.find((candidate) => (
    items.every((item) => !itemsOverlap({ ...candidate, size: sizeKey }, item))
  )) ?? ordered[0];
}

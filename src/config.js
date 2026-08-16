export const CANVAS_SIZE = 720;

export const GRID = Object.freeze({
  columns: 9,
  rows: 9,
  cell: CANVAS_SIZE / 9,
});

export const SIZE_PRESETS = Object.freeze({
  '1x1': Object.freeze({ columns: 1, rows: 1, label: '1 × 1' }),
  '1x2': Object.freeze({ columns: 1, rows: 2, label: '1 × 2' }),
  '2x2': Object.freeze({ columns: 2, rows: 2, label: '2 × 2' }),
  '2x3': Object.freeze({ columns: 2, rows: 3, label: '2 × 3' }),
  '3x3': Object.freeze({ columns: 3, rows: 3, label: '3 × 3' }),
});

export const DEFAULT_TOKENS = Object.freeze({
  blue: '#315BD6',
  yellow: '#FFB800',
  green: '#087765',
  clay: '#B76645',
  ink: '#12191A',
});

export const STORAGE_KEYS = Object.freeze({
  document: 'motif-document-v1',
  tokens: 'motif-tokens',
  theme: 'motif-theme',
});

export const DOCUMENT_VERSION = 1;

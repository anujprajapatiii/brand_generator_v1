import {
  BORDER_WIDTHS,
  DEFAULT_TOKENS,
  DOCUMENT_VERSION,
  GRID,
  SIZE_PRESETS,
  STORAGE_KEYS,
} from './config.js';
import { normalizeEdges } from './edges.js';
import { normalizeGridItem, normalizeGutter } from './grid.js';
import { PRIMITIVES } from './primitives.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LEGACY_EDGE_PATTERNS = [
  { top: 'slot', right: 'tab', bottom: 'flat', left: 'flat' },
  { top: 'flat', right: 'tab', bottom: 'slot', left: 'slot' },
  { top: 'slot', right: 'flat', bottom: 'tab', left: 'slot' },
];

function createInitialDocument() {
  return {
    version: DOCUMENT_VERSION,
    id: 'untitled-composition',
    name: 'Untitled composition',
    gutter: GRID.defaultGutter,
    showGrid: true,
    nextItemId: 4,
    items: [
      {
        id: 'rectangle-1', name: 'Rectangle 1', type: 'rectangle', column: 1, row: 2,
        size: '2x3', token: 'blue', appearance: 'outline', borderWidth: 8,
        edges: { top: 'slot', right: 'tab', bottom: 'flat', left: 'flat' },
      },
      {
        id: 'ellipse-2', name: 'Ellipse 2', type: 'ellipse', column: 3, row: 2,
        size: '2x3', token: 'yellow', appearance: 'solid', borderWidth: 8,
        edges: { top: 'flat', right: 'tab', bottom: 'slot', left: 'slot' },
      },
      {
        id: 'rectangle-3', name: 'Rectangle 3', type: 'rectangle', column: 5, row: 2,
        size: '2x3', token: 'green', appearance: 'solid', borderWidth: 8,
        edges: { top: 'slot', right: 'flat', bottom: 'tab', left: 'slot' },
      },
    ],
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeTokens(candidate) {
  return Object.fromEntries(Object.entries(DEFAULT_TOKENS).map(([key, fallback]) => [
    key,
    HEX_COLOR.test(candidate?.[key] ?? '') ? candidate[key].toUpperCase() : fallback,
  ]));
}

function sanitizeItem(item, index, migrateLegacy = false) {
  if (!item || !PRIMITIVES[item.type]) return null;
  const type = item.type;
  const numericId = index + 1;
  const id = String(item.id || `${type}-${numericId}`).replace(/[^a-z0-9-_]/gi, '-');
  const size = SIZE_PRESETS[item.size] ? item.size : '1x1';
  const token = Object.hasOwn(DEFAULT_TOKENS, item.token) ? item.token : PRIMITIVES[type].defaultToken;
  const borderWidth = BORDER_WIDTHS.includes(Number(item.borderWidth)) ? Number(item.borderWidth) : 8;
  const edges = migrateLegacy && !item.edges
    ? normalizeEdges(LEGACY_EDGE_PATTERNS[index % LEGACY_EDGE_PATTERNS.length])
    : normalizeEdges(item.edges);

  return normalizeGridItem({
    id,
    name: String(item.name || `${PRIMITIVES[type].label} ${numericId}`).slice(0, 80),
    type,
    column: item.column,
    row: item.row,
    size,
    token,
    edges,
    appearance: item.appearance === 'outline' ? 'outline' : 'solid',
    borderWidth,
  });
}

function sanitizeDocument(candidate, migrateLegacy = false) {
  const expectedVersion = migrateLegacy ? 1 : DOCUMENT_VERSION;
  if (!candidate || candidate.version !== expectedVersion || !Array.isArray(candidate.items)) {
    return null;
  }

  const items = candidate.items
    .map((item, index) => sanitizeItem(item, index, migrateLegacy))
    .filter(Boolean);

  return {
    version: DOCUMENT_VERSION,
    id: 'untitled-composition',
    name: String(candidate.name || 'Untitled composition').slice(0, 80),
    gutter: normalizeGutter(candidate.gutter),
    showGrid: candidate.showGrid !== false,
    nextItemId: Math.max(Number(candidate.nextItemId) || 1, items.length + 1),
    items,
  };
}

export function loadWorkspace() {
  const tokens = sanitizeTokens(safeParse(localStorage.getItem(STORAGE_KEYS.tokens)));
  const current = sanitizeDocument(safeParse(localStorage.getItem(STORAGE_KEYS.document)));
  const legacy = current
    ? null
    : sanitizeDocument(safeParse(localStorage.getItem(STORAGE_KEYS.legacyDocument)), true);
  const document = current ?? legacy ?? createInitialDocument();
  return { document, tokens };
}

export function saveDocument(document) {
  localStorage.setItem(STORAGE_KEYS.document, JSON.stringify(document));
}

export function saveTokens(tokens) {
  localStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
}

export function loadTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

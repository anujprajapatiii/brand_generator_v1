import {
  DEFAULT_TOKENS,
  DOCUMENT_VERSION,
  SIZE_PRESETS,
  STORAGE_KEYS,
} from './config.js';
import { normalizeGridItem } from './grid.js';
import { PRIMITIVES } from './primitives.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function createInitialDocument() {
  return {
    version: DOCUMENT_VERSION,
    id: 'untitled-composition',
    name: 'Untitled composition',
    nextItemId: 5,
    items: [
      { id: 'rectangle-1', name: 'Rectangle 1', type: 'rectangle', column: 1, row: 1, size: '2x3', token: 'blue' },
      { id: 'ellipse-2', name: 'Ellipse 2', type: 'ellipse', column: 4, row: 1, size: '2x2', token: 'yellow' },
      { id: 'line-3', name: 'Line 3', type: 'line', column: 3, row: 4, size: '3x3', token: 'clay' },
      { id: 'rectangle-4', name: 'Rectangle 4', type: 'rectangle', column: 6, row: 5, size: '2x3', token: 'green' },
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

function sanitizeItem(item, index) {
  if (!item || !PRIMITIVES[item.type]) return null;
  const type = item.type;
  const numericId = index + 1;
  const id = String(item.id || `${type}-${numericId}`).replace(/[^a-z0-9-_]/gi, '-');
  const size = SIZE_PRESETS[item.size] ? item.size : '1x1';
  const token = Object.hasOwn(DEFAULT_TOKENS, item.token) ? item.token : PRIMITIVES[type].defaultToken;

  return normalizeGridItem({
    id,
    name: String(item.name || `${PRIMITIVES[type].label} ${numericId}`).slice(0, 80),
    type,
    column: item.column,
    row: item.row,
    size,
    token,
  });
}

function sanitizeDocument(candidate) {
  if (!candidate || candidate.version !== DOCUMENT_VERSION || !Array.isArray(candidate.items)) {
    return createInitialDocument();
  }

  const items = candidate.items.map(sanitizeItem).filter(Boolean);
  return {
    version: DOCUMENT_VERSION,
    id: 'untitled-composition',
    name: String(candidate.name || 'Untitled composition').slice(0, 80),
    nextItemId: Math.max(Number(candidate.nextItemId) || 1, items.length + 1),
    items,
  };
}

export function loadWorkspace() {
  const tokens = sanitizeTokens(safeParse(localStorage.getItem(STORAGE_KEYS.tokens)));
  const document = sanitizeDocument(safeParse(localStorage.getItem(STORAGE_KEYS.document)));
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

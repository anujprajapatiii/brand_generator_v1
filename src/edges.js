import { DEFAULT_EDGES, EDGE_KEYS, EDGE_STATES } from './config.js';

export const EDGE_PRESETS = Object.freeze({
  flat: Object.freeze({ ...DEFAULT_EDGES }),
  slots: Object.freeze({ top: 'slot', right: 'slot', bottom: 'slot', left: 'slot' }),
  tabs: Object.freeze({ top: 'tab', right: 'tab', bottom: 'tab', left: 'tab' }),
  alternate: Object.freeze({ top: 'slot', right: 'tab', bottom: 'slot', left: 'tab' }),
});

export function normalizeEdges(candidate) {
  return Object.fromEntries(EDGE_KEYS.map((edge) => [
    edge,
    EDGE_STATES.includes(candidate?.[edge]) ? candidate[edge] : DEFAULT_EDGES[edge],
  ]));
}

export function cycleEdge(currentState) {
  const index = EDGE_STATES.indexOf(currentState);
  return EDGE_STATES[(index + 1) % EDGE_STATES.length];
}

export function invertEdges(candidate) {
  const edges = normalizeEdges(candidate);
  return Object.fromEntries(EDGE_KEYS.map((edge) => [
    edge,
    edges[edge] === 'slot' ? 'tab' : edges[edge] === 'tab' ? 'slot' : 'flat',
  ]));
}

export function applyEdgePreset(presetName) {
  return normalizeEdges(EDGE_PRESETS[presetName] ?? EDGE_PRESETS.flat);
}

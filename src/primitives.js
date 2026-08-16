import { DEFAULT_TOKENS } from './config.js';
import { gridRect } from './grid.js';

function rectangleGeometry(width, height, color) {
  return `<rect width="${width}" height="${height}" rx="6" fill="${color}"/>`;
}

function ellipseGeometry(width, height, color) {
  return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${color}"/>`;
}

function lineGeometry(width, height, color) {
  const inset = Math.min(width, height) * 0.16;
  const strokeWidth = Math.max(6, Math.min(width, height) * 0.1);
  return `<line x1="${inset}" y1="${height - inset}" x2="${width - inset}" y2="${inset}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

export const PRIMITIVES = Object.freeze({
  rectangle: Object.freeze({
    label: 'Rectangle',
    description: 'Four-sided plane',
    defaultToken: 'blue',
    iconClass: 'rectangle',
    render: rectangleGeometry,
  }),
  ellipse: Object.freeze({
    label: 'Ellipse',
    description: 'Circular plane',
    defaultToken: 'yellow',
    iconClass: 'ellipse',
    render: ellipseGeometry,
  }),
  line: Object.freeze({
    label: 'Line',
    description: 'Linear stroke',
    defaultToken: 'clay',
    iconClass: 'line',
    render: lineGeometry,
  }),
});

export function renderPrimitive(item, tokens, { interactive = true } = {}) {
  const definition = PRIMITIVES[item.type];
  if (!definition) return '';

  const rect = gridRect(item);
  const color = tokens[item.token] ?? DEFAULT_TOKENS.ink;
  const interactionAttributes = interactive
    ? ` data-id="${item.id}" class="primitive primitive-${item.type}"`
    : '';

  return `<g${interactionAttributes} transform="translate(${rect.x} ${rect.y})" data-motif-type="${item.type}" data-grid-column="${item.column}" data-grid-row="${item.row}" data-grid-size="${item.size}" data-token="${item.token}">${definition.render(rect.width, rect.height, color)}</g>`;
}

import { DEFAULT_TOKENS } from './config.js';
import { normalizeEdges } from './edges.js';
import { gridRect } from './grid.js';

function safeId(value) {
  return String(value).replace(/[^a-z0-9-_]/gi, '-');
}

function connectorMetrics(width, height) {
  const shortestSide = Math.min(width, height);
  return {
    depth: Math.max(10, Math.min(16, shortestSide * 0.18)),
    horizontalSpan: Math.max(22, Math.min(52, width * 0.34)),
    verticalSpan: Math.max(22, Math.min(52, height * 0.34)),
  };
}

function baseGeometry(type, width, height) {
  if (type === 'ellipse') {
    return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="#fff"/>`;
  }

  const radius = Math.max(8, Math.min(18, Math.min(width, height) * 0.12));
  return `<rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/>`;
}

function connectorGeometry(edge, state, width, height, metrics) {
  if (state === 'flat') return '';

  const fill = state === 'tab' ? '#fff' : '#000';
  const { depth, horizontalSpan, verticalSpan } = metrics;
  const positions = {
    top: {
      x: (width - horizontalSpan) / 2,
      y: state === 'tab' ? -depth : 0,
      width: horizontalSpan,
      height: state === 'tab' ? depth * 2 : depth,
    },
    right: {
      x: width - depth,
      y: (height - verticalSpan) / 2,
      width: state === 'tab' ? depth * 2 : depth,
      height: verticalSpan,
    },
    bottom: {
      x: (width - horizontalSpan) / 2,
      y: height - depth,
      width: horizontalSpan,
      height: state === 'tab' ? depth * 2 : depth,
    },
    left: {
      x: state === 'tab' ? -depth : 0,
      y: (height - verticalSpan) / 2,
      width: state === 'tab' ? depth * 2 : depth,
      height: verticalSpan,
    },
  };
  const rect = positions[edge];
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${fill}"/>`;
}

function silhouetteMarkup(item, width, height, color) {
  const edges = normalizeEdges(item.edges);
  const metrics = connectorMetrics(width, height);
  const id = safeId(item.id);
  const maskId = `shape-mask-${id}`;
  const outlineId = `shape-outline-${id}`;
  const expandedX = -metrics.depth;
  const expandedY = -metrics.depth;
  const expandedWidth = width + (metrics.depth * 2);
  const expandedHeight = height + (metrics.depth * 2);
  const connectors = Object.entries(edges)
    .map(([edge, state]) => connectorGeometry(edge, state, width, height, metrics))
    .join('');
  const borderWidth = [4, 8, 12].includes(Number(item.borderWidth)) ? Number(item.borderWidth) : 8;
  const outline = item.appearance === 'outline';

  return `<defs>
    <mask id="${maskId}" maskUnits="userSpaceOnUse" x="${expandedX}" y="${expandedY}" width="${expandedWidth}" height="${expandedHeight}">
      <rect x="${expandedX}" y="${expandedY}" width="${expandedWidth}" height="${expandedHeight}" fill="#000"/>
      ${baseGeometry(item.type, width, height)}
      ${connectors}
    </mask>
    ${outline ? `<filter id="${outlineId}" filterUnits="userSpaceOnUse" x="${expandedX - borderWidth}" y="${expandedY - borderWidth}" width="${expandedWidth + (borderWidth * 2)}" height="${expandedHeight + (borderWidth * 2)}" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius="${borderWidth}" result="eroded"/>
      <feComposite in="SourceGraphic" in2="eroded" operator="out"/>
    </filter>` : ''}
  </defs>
  <g${outline ? ` filter="url(#${outlineId})"` : ''}>
    <rect x="${expandedX}" y="${expandedY}" width="${expandedWidth}" height="${expandedHeight}" fill="${color}" mask="url(#${maskId})"/>
  </g>`;
}

export const PRIMITIVES = Object.freeze({
  rectangle: Object.freeze({
    label: 'Rectangle',
    description: 'Rounded modular plane',
    defaultToken: 'blue',
    iconClass: 'rectangle',
  }),
  ellipse: Object.freeze({
    label: 'Ellipse',
    description: 'Circular modular plane',
    defaultToken: 'yellow',
    iconClass: 'ellipse',
  }),
});

export function renderPrimitive(item, tokens, { interactive = true } = {}) {
  const definition = PRIMITIVES[item.type];
  if (!definition) return '';

  const rect = gridRect(item);
  const color = tokens[item.token] ?? DEFAULT_TOKENS.ink;
  const edges = normalizeEdges(item.edges);
  const interactionAttributes = interactive
    ? ` data-id="${safeId(item.id)}" class="primitive primitive-${item.type}"`
    : '';

  return `<g${interactionAttributes} transform="translate(${rect.x} ${rect.y})" data-motif-type="${item.type}" data-grid-column="${item.column}" data-grid-row="${item.row}" data-grid-size="${item.size}" data-token="${item.token}" data-edge-top="${edges.top}" data-edge-right="${edges.right}" data-edge-bottom="${edges.bottom}" data-edge-left="${edges.left}" data-appearance="${item.appearance === 'outline' ? 'outline' : 'solid'}" data-border-width="${item.borderWidth ?? 8}">${silhouetteMarkup(item, rect.width, rect.height, color)}</g>`;
}

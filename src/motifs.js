import { MOTIF_DENSITIES, MOTIF_GLOWS, MOTIF_KINDS } from './config.js';
import { normalizeEdges } from './edges.js';

const RENDERABLE_KINDS = Object.freeze(MOTIF_KINDS.filter((kind) => !['auto', 'none'].includes(kind)));

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function tidy(value) {
  return Number(value.toFixed(2));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function motifSeedFrom(value) {
  return hashString(value) || 1;
}

export function normalizeMotif(candidate, fallback = 1) {
  const seed = Math.max(1, Math.floor(Number(candidate?.seed) || motifSeedFrom(fallback)));
  return {
    kind: MOTIF_KINDS.includes(candidate?.kind) ? candidate.kind : 'auto',
    seed,
    density: MOTIF_DENSITIES.includes(candidate?.density) ? candidate.density : 'balanced',
    glow: MOTIF_GLOWS.includes(candidate?.glow) ? candidate.glow : 'soft',
  };
}

export function createRandomMotif(random = Math.random) {
  return {
    kind: 'auto',
    seed: Math.max(1, Math.floor(random() * 2147483647)),
    density: pick(MOTIF_DENSITIES, random),
    glow: pick(['soft', 'soft', 'bright'], random),
  };
}

export function resolvedMotifKind(candidate) {
  const motif = normalizeMotif(candidate);
  if (motif.kind !== 'auto') return motif.kind;
  return RENDERABLE_KINDS[motif.seed % RENDERABLE_KINDS.length];
}

function contentFrame(item, width, height) {
  const edges = normalizeEdges(item.edges);
  const shortest = Math.min(width, height);
  const basePadding = clamp(shortest * 0.17, 10, 30);
  const connectorPadding = clamp(shortest * 0.045, 3, 8);
  const inset = {
    top: basePadding + (edges.top === 'slot' ? connectorPadding : 0),
    right: basePadding + (edges.right === 'slot' ? connectorPadding : 0),
    bottom: basePadding + (edges.bottom === 'slot' ? connectorPadding : 0),
    left: basePadding + (edges.left === 'slot' ? connectorPadding : 0),
  };
  const attraction = (state) => (state === 'tab' ? 1 : state === 'slot' ? -1 : 0);
  const bias = shortest * 0.035;
  const dx = (attraction(edges.right) - attraction(edges.left)) * bias;
  const dy = (attraction(edges.bottom) - attraction(edges.top)) * bias;
  const frameWidth = Math.max(12, width - inset.left - inset.right);
  const frameHeight = Math.max(12, height - inset.top - inset.bottom);

  return {
    x: clamp(inset.left + dx, 5, width - frameWidth - 5),
    y: clamp(inset.top + dy, 5, height - frameHeight - 5),
    width: frameWidth,
    height: frameHeight,
    shortest,
  };
}

function densityCount(density, values) {
  return values[MOTIF_DENSITIES.indexOf(density)];
}

function fragmentsGeometry(frame, motif, random) {
  const areaScale = clamp((frame.width * frame.height) / 14000, 0.55, 1.7);
  const count = clamp(Math.round(densityCount(motif.density, [2, 4, 6]) * areaScale), 1, 8);
  const unit = clamp(frame.shortest * 0.055, 4, 10);
  const band = clamp(unit * 1.15, 5, 12);
  const rows = Math.max(1, Math.floor(frame.height / (band * 2.1)));
  const elements = [];

  for (let index = 0; index < count; index += 1) {
    const row = index % rows;
    const rowY = frame.y + ((row + 0.5) / rows) * frame.height;
    const widthUnits = 1 + Math.floor(random() * 5);
    const elementWidth = Math.min(frame.width * 0.46, widthUnits * unit * 1.8);
    const maxX = Math.max(0, frame.width - elementWidth);
    const x = frame.x + (random() * maxX);
    const y = clamp(rowY - (band / 2) + ((random() - 0.5) * band), frame.y, frame.y + frame.height - band);
    const stepped = random() > 0.62 && elementWidth > unit * 3;

    if (stepped) {
      const split = elementWidth * (0.38 + (random() * 0.24));
      elements.push(`<path d="M${tidy(x)} ${tidy(y)}h${tidy(split)}v${tidy(band * 0.65)}h${tidy(elementWidth - split)}v${tidy(band)}h-${tidy(elementWidth - split)}v-${tidy(band * 0.65)}h-${tidy(split)}Z" fill="#fff"/>`);
    } else {
      elements.push(`<rect x="${tidy(x)}" y="${tidy(y)}" width="${tidy(elementWidth)}" height="${tidy(band)}" rx="${tidy(Math.min(2, band * 0.18))}" fill="#fff"/>`);
    }
  }

  return elements.join('');
}

function scribbleGeometry(frame, motif, random) {
  const vertical = frame.height > frame.width * 1.18;
  const count = densityCount(motif.density, [3, 5, 7]);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    if (vertical) {
      points.push({
        x: frame.x + (frame.width * (0.22 + (random() * 0.56))),
        y: frame.y + (frame.height * progress),
      });
    } else {
      points.push({
        x: frame.x + (frame.width * progress),
        y: frame.y + (frame.height * (0.22 + (random() * 0.56))),
      });
    }
  }
  const strokeWidth = clamp(frame.shortest * 0.045, 3, 10);
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${tidy(point.x)} ${tidy(point.y)}`).join(' ');
  return `<path d="${path}" fill="none" stroke="#fff" stroke-width="${tidy(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
}

function dotsGeometry(frame, motif, random) {
  const vertical = frame.height > frame.width * 1.18;
  const count = densityCount(motif.density, [1, 3, 5]);
  const radius = clamp(frame.shortest * (count === 1 ? 0.13 : 0.075), 4, 14);
  const elements = [];
  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    const jitterX = (random() - 0.5) * Math.min(radius, frame.width * 0.08);
    const jitterY = (random() - 0.5) * Math.min(radius, frame.height * 0.08);
    const cx = vertical
      ? frame.x + (frame.width * 0.5) + jitterX
      : frame.x + radius + ((frame.width - (radius * 2)) * progress);
    const cy = vertical
      ? frame.y + radius + ((frame.height - (radius * 2)) * progress)
      : frame.y + (frame.height * 0.5) + jitterY;
    elements.push(`<circle cx="${tidy(cx)}" cy="${tidy(cy)}" r="${tidy(radius)}" fill="#fff"/>`);
  }
  return elements.join('');
}

function curveGeometry(frame, motif, random) {
  const radius = Math.max(5, Math.min(frame.width, frame.height) * (0.32 + (random() * 0.13)));
  const centerX = frame.x + (frame.width * (0.42 + (random() * 0.16)));
  const centerY = frame.y + (frame.height * (0.42 + (random() * 0.16)));
  const startAngle = random() * Math.PI * 2;
  const sweepDegrees = densityCount(motif.density, [95, 155, 225]);
  const sweep = (sweepDegrees * Math.PI) / 180;
  const endAngle = startAngle + sweep;
  const startX = centerX + (Math.cos(startAngle) * radius);
  const startY = centerY + (Math.sin(startAngle) * radius);
  const endX = centerX + (Math.cos(endAngle) * radius);
  const endY = centerY + (Math.sin(endAngle) * radius);
  const largeArc = sweepDegrees > 180 ? 1 : 0;
  const strokeWidth = clamp(frame.shortest * 0.045, 3, 10);
  return `<path d="M${tidy(startX)} ${tidy(startY)} A${tidy(radius)} ${tidy(radius)} 0 ${largeArc} 1 ${tidy(endX)} ${tidy(endY)}" fill="none" stroke="#fff" stroke-width="${tidy(strokeWidth)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
}

function motifGeometry(kind, frame, motif, random) {
  if (kind === 'fragments') return fragmentsGeometry(frame, motif, random);
  if (kind === 'scribble') return scribbleGeometry(frame, motif, random);
  if (kind === 'dots') return dotsGeometry(frame, motif, random);
  if (kind === 'curve') return curveGeometry(frame, motif, random);
  return '';
}

export function renderMotifLayer(item, width, height, maskId) {
  const motif = normalizeMotif(item.motif, item.id);
  const kind = resolvedMotifKind(motif);
  if (kind === 'none') return '';

  const frame = contentFrame(item, width, height);
  const random = seededRandom(motif.seed);
  const geometry = motifGeometry(kind, frame, motif, random);
  const blur = clamp(frame.shortest * (motif.glow === 'bright' ? 0.055 : 0.035), 2, 12);
  const glowOpacity = motif.glow === 'bright' ? 0.56 : motif.glow === 'soft' ? 0.34 : 0;
  const glowId = `motif-glow-${String(item.id).replace(/[^a-z0-9-_]/gi, '-')}`;
  const expansion = blur * 5;

  return `<defs>
    ${glowOpacity ? `<filter id="${glowId}" filterUnits="userSpaceOnUse" x="${tidy(-expansion)}" y="${tidy(-expansion)}" width="${tidy(width + (expansion * 2))}" height="${tidy(height + (expansion * 2))}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${tidy(blur)}"/></filter>` : ''}
  </defs>
  <g class="motif-layer" data-content-kind="${kind}" data-content-mode="${motif.kind}" data-content-density="${motif.density}" data-content-glow="${motif.glow}" mask="url(#${maskId})" pointer-events="none">
    ${glowOpacity ? `<g opacity="${glowOpacity}" filter="url(#${glowId})">${geometry}</g>` : ''}
    <g>${geometry}</g>
  </g>`;
}

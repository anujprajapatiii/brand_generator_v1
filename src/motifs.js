import { MOTIF_DENSITIES, MOTIF_GLOWS, MOTIF_KINDS } from './config.js';

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
  const shortest = Math.min(width, height);
  const basePadding = clamp(shortest * (item.type === 'ellipse' ? 0.22 : 0.17), 10, 32);
  const frameWidth = Math.max(12, width - (basePadding * 2));
  const frameHeight = Math.max(12, height - (basePadding * 2));

  return {
    x: (width - frameWidth) / 2,
    y: (height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
    shortest,
    centerX: width / 2,
    centerY: height / 2,
  };
}

function densityCount(density, values) {
  return values[MOTIF_DENSITIES.indexOf(density)];
}

function fragmentsGeometry(frame, motif, random) {
  const count = densityCount(motif.density, [2, 4, 6]);
  const rowCount = count / 2;
  const band = clamp(frame.shortest * 0.09, 6, 12);
  const gap = clamp(frame.shortest * 0.055, 4, 9);
  const totalHeight = (rowCount * band) + ((rowCount - 1) * gap);
  const startY = frame.centerY - (totalHeight / 2);
  const widthScales = [0.24, 0.34, 0.46, 0.6];
  const elements = [];

  for (let row = 0; row < rowCount; row += 1) {
    const rawWidths = [0, 1].map(() => {
      const scale = pick(widthScales, random);
      return clamp(frame.width * scale, 10, frame.width * 0.6);
    });
    const rawTotal = rawWidths[0] + rawWidths[1] + gap;
    const fitScale = Math.min(1, frame.width / rawTotal);
    const widths = rawWidths.map((width) => width * fitScale);
    const rowWidth = widths[0] + widths[1] + gap;
    let x = frame.centerX - (rowWidth / 2);
    const y = startY + (row * (band + gap));

    widths.forEach((elementWidth) => {
      elements.push(`<rect x="${tidy(x)}" y="${tidy(y)}" width="${tidy(elementWidth)}" height="${tidy(band)}" rx="${tidy(band * 0.45)}" fill="#fff"/>`);
      x += elementWidth + gap;
    });
  }

  return elements.join('');
}

function centerPoints(points, frame) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const dx = frame.centerX - ((Math.min(...xs) + Math.max(...xs)) / 2);
  const dy = frame.centerY - ((Math.min(...ys) + Math.max(...ys)) / 2);
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

function smoothPath(points) {
  const tension = 1.05;
  let path = `M${tidy(points[0].x)} ${tidy(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const controlOne = {
      x: start.x + (((end.x - previous.x) * tension) / 6),
      y: start.y + (((end.y - previous.y) * tension) / 6),
    };
    const controlTwo = {
      x: end.x - (((next.x - start.x) * tension) / 6),
      y: end.y - (((next.y - start.y) * tension) / 6),
    };
    path += ` C${tidy(controlOne.x)} ${tidy(controlOne.y)} ${tidy(controlTwo.x)} ${tidy(controlTwo.y)} ${tidy(end.x)} ${tidy(end.y)}`;
  }
  return path;
}

function scribbleGeometry(frame, motif, random) {
  const vertical = frame.height > frame.width * 1.18;
  const anchors = {
    sparse: [[0, 0.58], [0.28, 0.72], [0.22, 0.12], [0.7, 0.61], [0.82, 0.48], [1, 0.69]],
    balanced: [[0, 0.58], [0.28, 0.72], [0.22, 0.12], [0.7, 0.61], [0.82, 0.48], [0.9, 0.56], [1, 0.69]],
    rich: [[0, 0.58], [0.28, 0.72], [0.22, 0.12], [0.7, 0.61], [0.82, 0.48], [0.89, 0.56], [0.95, 0.52], [1, 0.69]],
  };
  const sourcePoints = anchors[motif.density];
  const flip = random() > 0.5;
  const normalized = sourcePoints.map(([x, y], index) => ({
    x: clamp(x + (index > 0 && index < sourcePoints.length - 1 ? (random() - 0.5) * 0.018 : 0), 0, 1),
    y: clamp((flip ? 1 - y : y) + ((random() - 0.5) * 0.035), 0.05, 0.95),
  }));
  const mapped = normalized.map((point) => (vertical ? {
    x: frame.x + ((1 - point.y) * frame.width),
    y: frame.y + (point.x * frame.height),
  } : {
    x: frame.x + (point.x * frame.width),
    y: frame.y + (point.y * frame.height),
  }));
  const points = centerPoints(mapped, frame);
  const strokeWidth = clamp(frame.shortest * 0.055, 4, 10);
  const path = smoothPath(points);
  return `<path d="${path}" fill="none" stroke="#fff" stroke-width="${tidy(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
}

function dotsGeometry(frame, motif) {
  const square = Math.abs(frame.width - frame.height) / Math.max(frame.width, frame.height) < 0.18;
  const vertical = frame.height > frame.width * 1.18 || (square && motif.seed % 2 === 1);
  const count = densityCount(motif.density, [1, 3, 5]);
  const radius = clamp(frame.shortest * (count === 1 ? 0.15 : 0.055), count === 1 ? 6 : 3, count === 1 ? 18 : 8);
  const axisLength = vertical ? frame.height : frame.width;
  const spacing = count === 1 ? 0 : Math.min(radius * 2.8, (axisLength - (radius * 2)) / (count - 1));
  const start = -(spacing * (count - 1)) / 2;
  const elements = [];
  for (let index = 0; index < count; index += 1) {
    const offset = start + (index * spacing);
    const cx = frame.centerX + (vertical ? 0 : offset);
    const cy = frame.centerY + (vertical ? offset : 0);
    elements.push(`<circle cx="${tidy(cx)}" cy="${tidy(cy)}" r="${tidy(radius)}" fill="#fff"/>`);
  }
  return elements.join('');
}

function motifGeometry(kind, frame, motif, random) {
  if (kind === 'fragments') return fragmentsGeometry(frame, motif, random);
  if (kind === 'scribble') return scribbleGeometry(frame, motif, random);
  if (kind === 'dots') return dotsGeometry(frame, motif);
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

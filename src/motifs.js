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
    outerWidth: width,
    outerHeight: height,
    centerX: width / 2,
    centerY: height / 2,
  };
}

function densityCount(density, values) {
  return values[MOTIF_DENSITIES.indexOf(density)];
}

function fragmentRowCount(frame, density) {
  const baseRows = densityCount(density, [1, 2, 3]);
  const heightTier = frame.outerHeight >= 140 ? 1 : 0;
  const largeTier = frame.outerHeight >= 220 ? 1 : 0;
  const portraitTier = frame.outerHeight > frame.outerWidth * 1.35 ? 1 : 0;
  const expansion = heightTier + largeTier + portraitTier;
  const densityResponse = densityCount(density, [0.5, 0.75, 1]);
  return Math.min(6, baseRows + Math.round(expansion * densityResponse));
}

function fragmentsGeometry(frame, motif, random) {
  const rowCount = fragmentRowCount(frame, motif.density);
  const portrait = frame.outerHeight > frame.outerWidth * 1.35;
  const compositionWidth = frame.width * 0.88;
  const band = clamp(frame.shortest * 0.078, 5, 10);
  const gap = clamp(frame.shortest * (portrait ? 0.075 : 0.05), 4, 10);
  const totalHeight = (rowCount * band) + ((rowCount - 1) * gap);
  const startY = frame.centerY - (totalHeight / 2);
  const widthScales = [0.2, 0.28, 0.38, 0.5];
  const elements = [];

  for (let row = 0; row < rowCount; row += 1) {
    const rawWidths = [0, 1].map(() => {
      const scale = pick(widthScales, random);
      return clamp(compositionWidth * scale, 10, compositionWidth * 0.5);
    });
    const rawTotal = rawWidths[0] + rawWidths[1] + gap;
    const fitScale = Math.min(1, compositionWidth / rawTotal);
    const widths = rawWidths.map((width) => width * fitScale);
    const rowWidth = widths[0] + widths[1] + gap;
    let x = frame.centerX - (rowWidth / 2);
    const y = startY + (row * (band + gap));

    widths.forEach((elementWidth) => {
      elements.push(`<rect x="${tidy(x)}" y="${tidy(y)}" width="${tidy(elementWidth)}" height="${tidy(band)}" rx="${tidy(band * 0.28)}" fill="#fff"/>`);
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

function smoothPath(points, tension = 0.92) {
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

function rectangularScribblePoints(frame, motif, random) {
  const vertical = frame.height > frame.width * 1.18;
  const anchors = {
    sparse: [[0, 0.58], [0.3, 0.76], [0.16, 0.06], [0.7, 0.61], [0.82, 0.48], [1, 0.69]],
    balanced: [[0, 0.58], [0.3, 0.76], [0.16, 0.06], [0.7, 0.61], [0.82, 0.48], [0.9, 0.56], [1, 0.69]],
    rich: [[0, 0.58], [0.3, 0.76], [0.16, 0.06], [0.7, 0.61], [0.82, 0.48], [0.89, 0.56], [0.95, 0.52], [1, 0.69]],
  };
  const sourcePoints = anchors[motif.density];
  const flip = random() > 0.5;
  const normalized = sourcePoints.map(([x, y], index) => ({
    x: clamp(x + (index > 0 && index < sourcePoints.length - 1 ? (random() - 0.5) * 0.018 : 0), 0, 1),
    y: clamp((flip ? 1 - y : y) + ((random() - 0.5) * 0.035), 0.05, 0.95),
  }));
  const gestureDepth = vertical
    ? Math.min(frame.width, frame.height * 0.4)
    : Math.min(frame.height, frame.width * 0.4);
  const mapped = normalized.map((point) => (vertical ? {
    x: frame.centerX + ((0.5 - point.y) * gestureDepth),
    y: frame.y + (point.x * frame.height),
  } : {
    x: frame.x + (point.x * frame.width),
    y: frame.centerY + ((point.y - 0.5) * gestureDepth),
  }));
  return { points: centerPoints(mapped, frame), structure: 'gesture' };
}

function spiralScribblePoints(frame, motif, random) {
  const lapRanges = {
    sparse: [1],
    balanced: [2, 3],
    rich: [3, 4],
  };
  const laps = pick(lapRanges[motif.density], random);
  const direction = random() > 0.5 ? 1 : -1;
  const phase = random() * Math.PI * 2;
  const sampleCount = (laps * 11) + 2;
  const points = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / (sampleCount - 1);
    const angle = phase + (direction * t * laps * Math.PI * 2);
    const baseRadius = 0.07 + (t * 0.41);
    const wobble = 1 + (Math.sin((angle * 1.7) + phase) * 0.035) + ((random() - 0.5) * 0.018);
    const radius = baseRadius * wobble;
    points.push({
      x: frame.centerX + (Math.cos(angle) * radius * frame.width * 0.94),
      y: frame.centerY + (Math.sin(angle) * radius * frame.height * 0.94),
    });
  }

  return { points: centerPoints(points, frame), laps };
}

function scribbleGeometry(item, frame, motif, random) {
  const ellipse = item.type === 'ellipse';
  const generated = ellipse
    ? spiralScribblePoints(frame, motif, random)
    : rectangularScribblePoints(frame, motif, random);
  const equivalentSize = Math.sqrt(frame.outerWidth * frame.outerHeight);
  const spiralDensityAdjustment = densityCount(motif.density, [1.06, 1, 0.94]);
  const strokeWidth = ellipse
    ? clamp((2.6 + (equivalentSize * 0.031)) * spiralDensityAdjustment, 4.8, 10.5)
    : clamp(frame.shortest * 0.055, 4, 10);
  const path = smoothPath(generated.points, ellipse ? 0.92 : 1.05);
  const structure = ellipse ? 'spiral' : generated.structure;
  const laps = ellipse ? ` data-scribble-laps="${generated.laps}"` : '';
  return `<path d="${path}" data-scribble-structure="${structure}"${laps} fill="none" stroke="#fff" stroke-width="${tidy(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
}

function dotsGeometry(frame, motif) {
  const square = Math.abs(frame.width - frame.height) / Math.max(frame.width, frame.height) < 0.18;
  const vertical = frame.height > frame.width * 1.18 || (square && motif.seed % 2 === 1);
  const count = densityCount(motif.density, [1, 3, 5]);
  const radiusScale = densityCount(motif.density, [0.15, 0.04, 0.032]);
  const radius = clamp(frame.shortest * radiusScale, count === 1 ? 6 : 2.5, count === 1 ? 18 : 7);
  const axisLength = vertical ? frame.height : frame.width;
  const visualGap = clamp(frame.shortest * 0.07, 5, 12);
  const spacing = count === 1 ? 0 : Math.min((radius * 2) + visualGap, (axisLength - (radius * 2)) / (count - 1));
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

function motifGeometry(kind, item, frame, motif, random) {
  if (kind === 'fragments') return fragmentsGeometry(frame, motif, random);
  if (kind === 'scribble') return scribbleGeometry(item, frame, motif, random);
  if (kind === 'dots') return dotsGeometry(frame, motif);
  return '';
}

export function renderMotifLayer(item, width, height, maskId) {
  const motif = normalizeMotif(item.motif, item.id);
  const kind = resolvedMotifKind(motif);
  if (kind === 'none') return '';

  const frame = contentFrame(item, width, height);
  const random = seededRandom(motif.seed);
  const geometry = motifGeometry(kind, item, frame, motif, random);
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

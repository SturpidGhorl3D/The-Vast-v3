import type { Camera } from './engine/camera';
import {
  EDITOR_MAX_VIEWPORT_FACTOR,
  EDITOR_MIN_VIEWPORT_M,
  GLOBAL_MAX_VIEWPORT_M,
  GLOBAL_MIN_VIEWPORT_M,
  TACTICAL_MIN_VIEWPORT_M,
  TACTICAL_MAX_VIEWPORT_M,
  LOCAL_RADAR_BASE,
} from './constants';

function segmentIntersect(
  a1: {x: number; y: number},
  a2: {x: number; y: number},
  b1: {x: number; y: number},
  b2: {x: number; y: number}
): boolean {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(det) < 1e-12) return false;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / det;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / det;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function isPolygonSelfIntersecting(points: {x: number; y: number}[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function getLargestShipDimension(hull: {decks: {points: {x: number; y: number}[]}[]; size?: number} | null): number {
  if (!hull || !hull.decks || hull.decks.length === 0) return hull?.size ?? 30;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const deck of hull.decks) {
    if (!deck.points || !Array.isArray(deck.points)) continue;
    for (const p of deck.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (minX === Infinity) return hull.size ?? 30;
  const w = maxX - minX;
  const h = maxY - minY;
  return Math.max(w, h, 1);
}

/** Compute max local-view viewport radius based on ship's bridge radar level.
 *  Formula: LOCAL_RADAR_BASE × shipDimension. Subclasses can override via bridge radarBonus.
 */
export function getLocalMaxViewport(hull: any | null): number {
  const dim = getLargestShipDimension(hull);
  let radarBonus = 0;
  if (hull?.compartments) {
    for (const c of hull.compartments) {
      if (c.type === 'BRIDGE' && c.bridgeConfig?.radarBonus) {
        radarBonus += c.bridgeConfig.radarBonus;
      }
    }
  }
  return (LOCAL_RADAR_BASE + radarBonus) * dim;
}

export function clampCameraZoom(
  camera: Camera,
  canvasW: number,
  canvasH: number,
  mode: 'editor' | 'local' | 'tactical' | 'global',
  hull: any | null
): void {
  const viewMin = Math.max(Math.min(canvasW, canvasH), 100); // Prevent 0
  let minZoom: number;
  let maxZoom: number;

  if (mode === 'global') {
    minZoom = viewMin / GLOBAL_MAX_VIEWPORT_M;
    maxZoom = viewMin / GLOBAL_MIN_VIEWPORT_M;
  } else if (mode === 'tactical') {
    minZoom = viewMin / TACTICAL_MAX_VIEWPORT_M;
    maxZoom = viewMin / TACTICAL_MIN_VIEWPORT_M;
  } else if (mode === 'local') {
    const localMaxViewport = getLocalMaxViewport(hull);
    minZoom = viewMin / localMaxViewport;
    maxZoom = viewMin / EDITOR_MIN_VIEWPORT_M;
  } else {
    // editor
    const D = getLargestShipDimension(hull);
    maxZoom = viewMin / EDITOR_MIN_VIEWPORT_M;
    minZoom = viewMin / (EDITOR_MAX_VIEWPORT_FACTOR * Math.max(D, 1));
  }

  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || minZoom <= 0) {
    minZoom = 0.01;
    maxZoom = 20;
  }
  if (minZoom > maxZoom) {
    const t = minZoom; minZoom = maxZoom; maxZoom = t;
  }

  camera.targetZoom = Math.max(minZoom, Math.min(maxZoom, camera.targetZoom));
  
  if (camera.targetZoom <= 0 || !Number.isFinite(camera.targetZoom)) {
    camera.targetZoom = 1;
  }
  camera.zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom));
  if (camera.zoom <= 0 || !Number.isFinite(camera.zoom)) {
    camera.zoom = 1;
  }
}

import { isPolygonSelfIntersecting } from '@/game/hullGeometry';
import { getCompartmentOutlinePoints } from '@/game/compartmentUtils';
import type { Point, Deck, Compartment, Beam, StructuralCell, BeamPattern } from './types';
// @ts-ignore
import pc from 'polygon-clipping';

export function isPointInPolygon(px: number, py: number, points: Point[]): boolean {
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function doLinesIntersect(
  a: Point, b: Point, c: Point, d: Point
): boolean {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (det === 0) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / det;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / det;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function doPolygonsIntersect(poly1: Point[], poly2: Point[]): boolean {
  if (!poly1 || !poly2 || poly1.length < 3 || poly2.length < 3) return false;
  for (const p of poly1) {
    if (isPointInPolygon(p.x, p.y, poly2)) return true;
  }
  for (const p of poly2) {
    if (isPointInPolygon(p.x, p.y, poly1)) return true;
  }
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % poly2.length];
      if (doLinesIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function findBestInsertIndex(points: Point[], x: number, y: number): number {
  let bestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / (dx * dx + dy * dy || 1)));
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = i + 1;
    }
  }
  return bestIdx;
}

/**
 * Find the mirror indices for a vertex at srcIdx in the given deck's points array.
 * Uses geometric symmetry to find partners.
 */
export function findMirroredVertexIndices(
  points: Point[],
  srcIdx: number,
  symHoriz: boolean,
  symVert: boolean
): number[] {
  const src = points[srcIdx];
  const result: number[] = [];
  const epsilon = 0.1;

  if (symHoriz) {
    const tx = -src.x;
    const ty = src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push(idx);
  }
  if (symVert) {
    const tx = src.x;
    const ty = -src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && !result.includes(i) && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push(idx);
  }
  if (symHoriz && symVert) {
    const tx = -src.x;
    const ty = -src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && !result.includes(i) && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push(idx);
  }

  return result;
}

/**
 * Compute the mirrored position of a moved vertex.
 * mirrorType: 'X' = mirror across Y axis (Horizontal Reflection), 'Y' = mirror across X axis (Vertical Reflection), 'XY' = both
 */
export function mirroredPosition(newX: number, newY: number, mirrorType: 'X' | 'Y' | 'XY'): Point {
  if (mirrorType === 'X') return { x: -newX, y: newY }; // Mirror X axis (Left/Right flip)
  if (mirrorType === 'Y') return { x: newX, y: -newY }; // Mirror Y axis (Front/Back flip)
  return { x: -newX, y: -newY };
}

export interface MirrorTarget {
  index: number;
  mirrorType: 'X' | 'Y' | 'XY';
}

/**
 * Resolve which mirror type each mirrored vertex index represents.
 */
export function resolveMirrorTargets(
  points: Point[],
  srcIdx: number,
  symHoriz: boolean,
  symVert: boolean
): MirrorTarget[] {
  const src = points[srcIdx];
  const result: MirrorTarget[] = [];
  const epsilon = 0.1;

  if (symHoriz) {
    const tx = -src.x;
    const ty = src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push({ index: idx, mirrorType: 'X' });
  }
  if (symVert) {
    const tx = src.x;
    const ty = -src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push({ index: idx, mirrorType: 'Y' });
  }
  if (symHoriz && symVert) {
    const tx = -src.x;
    const ty = -src.y;
    const idx = points.findIndex((p, i) => i !== srcIdx && Math.abs(p.x - tx) < epsilon && Math.abs(p.y - ty) < epsilon);
    if (idx !== -1) result.push({ index: idx, mirrorType: 'XY' });
  }

  return result;
}



export function symmetrizeHull(
  hull: any,
  symHoriz: boolean,
  symVert: boolean
): void {
  if (!hull) return;
  const deck = hull.decks[hull.activeDeckIndex];
  let newPoints = [...deck.points];
  const epsilon = 0.1;

  deck.points.forEach((p: any) => {
    if (symHoriz || symVert) {
      const targets: {x: number, y: number}[] = [];
      if (symHoriz) targets.push({ x: -p.x, y: p.y });
      if (symVert) targets.push({ x: p.x, y: -p.y });
      if (symHoriz && symVert) targets.push({ x: -p.x, y: -p.y });
      
      targets.forEach(t => {
        // Only add if it's actually a different position and doesn't exist yet
        if (Math.abs(t.x - p.x) > epsilon || Math.abs(t.y - p.y) > epsilon) {
          const exists = newPoints.some((np: any) => Math.abs(np.x - t.x) < epsilon && Math.abs(np.y - t.y) < epsilon);
          if (!exists) {
            const idx = findBestInsertIndex(newPoints, t.x, t.y);
            newPoints.splice(idx, 0, { x: t.x, y: t.y });
          }
        }
      });
    }
  });
  deck.points = newPoints;
}

export function generateStructuralBeams(
  points: Point[], 
  compartments: Compartment[], 
  pattern: BeamPattern, 
  density: number = 2.0,
  symHoriz: boolean = false,
  symVert: boolean = false
): { beams: Beam[], cells: StructuralCell[] } {
  if (pattern === 'NONE' || points.length < 3) return { beams: [], cells: [] };
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { beams: [], cells: [] };

  // 1. Convert hull points to clipping polygon (ensure closed ring)
  const hullRing = points.map(p => [p.x, p.y] as [number, number]);
  if (hullRing.length > 0 && (hullRing[0][0] !== hullRing[hullRing.length-1][0] || hullRing[0][1] !== hullRing[hullRing.length-1][1])) {
    hullRing.push([...hullRing[0]]);
  }
  let voidGeom: any = [[hullRing]];

  // 2. Convert compartments to clipping polygons and subtract from hull
  const compGeoms: any[] = [];
  compartments.forEach(c => {
    const pts = getCompartmentOutlinePoints(c);
    if (pts.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    const ring = pts.map(p => [p.x, p.y] as [number, number]);
    if (ring.length > 0 && (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1])) {
      ring.push([...ring[0]]);
    }
    compGeoms.push([[ring]]);
  });

  if (compGeoms.length > 0) {
    try {
      voidGeom = pc.difference(voidGeom, ...compGeoms);
    } catch (e) {
      console.warn("Polygon clipping difference failed. Skipping compartments subtraction.", e);
    }
  }

  // 3. Generate base pattern geometries
  let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minX -= 20; maxX += 20; minY -= 20; maxY += 20;
  
  if (maxX - minX > 2000 || maxY - minY > 2000) {
      console.warn("Ship is too large, skipping beam generation");
      return { beams: [], cells: [] };
  }

  const step = (pattern === 'HEX' ? 30 : 20) / Math.max(0.1, density || 1); 
  const patternGeoms: any[] = [];

  if (pattern === 'SQUARE' || pattern === 'VORONOI' || pattern === 'PENROSE' || pattern === 'SPIRAL') {
    // Treat unknown/WIP patterns as square for now or jittered square
    const startX = Math.floor(minX / step) * step;
    const endX = Math.ceil(maxX / step) * step;
    const startY = Math.floor(minY / step) * step;
    const endY = Math.ceil(maxY / step) * step;

    const seedX = 123, seedY = 456;
    const getJittered = (tx: number, ty: number) => {
      if (pattern !== 'VORONOI') return [tx, ty] as [number, number];
      const jX = (Math.sin(tx * 0.1 + ty * 0.2 + seedX) * 0.35) * step;
      const jY = (Math.cos(tx * 0.2 + ty * 0.1 + seedY) * 0.35) * step;
      return [tx + jX, ty + jY] as [number, number];
    };

    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        patternGeoms.push([[
          [getJittered(x, y), getJittered(x + step, y), getJittered(x + step, y + step), getJittered(x, y + step), getJittered(x, y)]
        ]]);
      }
    }
  } else if (pattern === 'HEX') {
    const r = step / 1.5;
    const dy = r * Math.sqrt(3);
    const dx = r * 1.5;

    const startJ = Math.floor(minY / dy) - 1;
    const endJ = Math.ceil(maxY / dy) + 1;
    const startI = Math.floor(minX / dx) - 1;
    const endI = Math.ceil(maxX / dx) + 1;

    for (let j = startJ; j <= endJ; j++) {
      const offsetY = j * dy;
      for (let i = startI; i <= endI; i++) {
        const offsetX = i * dx;
        const cy = offsetY + ((i % 2 !== 0) ? dy / 2 : 0);
        const cx = offsetX;
        
        const hexPts: [number, number][] = [];
        for (let a = 0; a <= 6; a++) {
          const angle = (a % 6) * Math.PI / 3;
          hexPts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        patternGeoms.push([[hexPts]]);
      }
    }
  }

  // 4. Intersect pattern against void geometry
  const cells: StructuralCell[] = [];
  let nextCellId = 0;

  for (const patternCell of patternGeoms) {
    try {
      const result = pc.intersection(patternCell, voidGeom);
      for (const poly of result) {
        // Only take outer ring (poly[0]) to simplify cell structure
        const outerRing = poly[0];
        if (!outerRing || outerRing.length < 3) continue;

        // Note: outerRing first and last points are the same
        const cellPts = outerRing.slice(0, -1).map(p => ({ x: p[0], y: p[1] }));
        
        let area = 0;
        for (let i = 0, j = cellPts.length - 1; i < cellPts.length; j = i++) {
          area += (cellPts[j].x + cellPts[i].x) * (cellPts[j].y - cellPts[i].y);
        }
        area = Math.abs(area / 2.0);

        // Filter tiny speckles (1.0 sq meters)
        if (area > 1.0) {
          cells.push({
            id: `c-${Date.now()}-${nextCellId++}`,
            points: cellPts,
            hp: 200,
            maxHp: 200,
            cellType: 'STRUCTURAL'
          });
        }
      }
    } catch (e) {
      // Ignored degenerate clippings
    }
  }

  // 5. Extract unique edges as beams
  const beams: Beam[] = [];
  let nextBeamId = 0;
  const beamMap = new Set<string>();

  const ptsMap: Map<string, Point> = new Map();
  const hullPoints = points;
  const compPolys = compartments.map(c => getCompartmentOutlinePoints(c));
  const threshold = 0.1; // 1 decimeter

  const getPt = (x: number, y: number) => {
    // 1. Precise snap to existing vertices (Hull and Compartments)
    // This implements the requested deduplication where user-placed vertices take priority
    for (const p of hullPoints) {
      if (Math.hypot(p.x - x, p.y - y) <= threshold) return p;
    }
    for (const poly of compPolys) {
      for (const p of poly) {
        if (Math.hypot(p.x - x, p.y - y) <= threshold) return p;
      }
    }

    // 2. Snap close float values to prevent micro-gaps visually
    const rx = Math.round(x * 100) / 100;
    const ry = Math.round(y * 100) / 100;
    const key = `${rx},${ry}`;
    if (ptsMap.has(key)) return ptsMap.get(key)!;
    const p = { x, y };
    ptsMap.set(key, p);
    return p;
  };

  for (const cell of cells) {
    cell.points = cell.points.map(p => getPt(p.x, p.y));
    for (let i = 0; i < cell.points.length; i++) {
       const p1 = cell.points[i];
       const p2 = cell.points[(i + 1) % cell.points.length];
       
       const keyX1 = Math.min(p1.x, p2.x);
       const keyX2 = Math.max(p1.x, p2.x);
       const keyY1 = Math.min(p1.y, p2.y);
       const keyY2 = Math.max(p1.y, p2.y);
       const key = `${keyX1},${keyY1}-${keyX2},${keyY2}`;
       
       if (!beamMap.has(key)) {
           beamMap.add(key);
           beams.push({
               id: `b-${Date.now()}-${nextBeamId++}`,
               p1,
               p2,
               type: 'AUTO',
               hp: 100,
               maxHp: 100
           });
       }
    }
  }

  return { beams, cells };
}

export function checkValidation(hull: any): void {
  if (!hull) return;
  const activeDeckIdx = hull.activeDeckIndex;

  hull.decks.forEach((d: any, idx: number) => {
    d.isSelfIntersecting =
      d.points && d.points.length >= 4 && isPolygonSelfIntersecting(d.points);
    
    // Check contact with neighbors
    d.hasContactWithLower = true;
    d.hasContactWithUpper = true;
    
    if (idx > 0) {
      const prev = hull.decks[idx - 1];
      if (prev.points && d.points) {
        // Simple check: do any points of D fall into Prev, or vice-versa?
        // A more robust check would be polygon intersection, but for "point of contact" this is a start.
        const d_in_prev = d.points.some((p: any) => isPointInPolygon(p.x, p.y, prev.points));
        const prev_in_d = prev.points.some((p: any) => isPointInPolygon(p.x, p.y, d.points));
        // Also check if any segments intersect (which means contact)
        const intersects = doPolygonsIntersect(d.points, prev.points);
        
        if (!d_in_prev && !prev_in_d && !intersects) {
          d.hasContactWithLower = false;
        }
      }
    }
    
    if (idx < hull.decks.length - 1) {
      const next = hull.decks[idx + 1];
      if (next.points && d.points) {
        const d_in_next = d.points.some((p: any) => isPointInPolygon(p.x, p.y, next.points));
        const next_in_d = next.points.some((p: any) => isPointInPolygon(p.x, p.y, d.points));
        const intersects = doPolygonsIntersect(d.points, next.points);
        
        if (!d_in_next && !next_in_d && !intersects) {
          d.hasContactWithUpper = false;
        }
      }
    }
  });

  hull.compartments.forEach((c1: any) => {
    c1.isOutsideHull = false;
    c1.isIntersecting = false;
    c1.isBlocked = false;

    const outline = getCompartmentOutlinePoints(c1);
    const d0 = Math.min(c1.startDeck, c1.endDeck);
    const d1 = Math.max(c1.startDeck, c1.endDeck);
    
    // Check Turret Clearance
    const isTurret = c1.type === 'WEAPON' || c1.type === 'MINING';
    if (isTurret) {
      const config = c1.type === 'WEAPON' ? c1.turretConfig : c1.miningConfig;
      const mount = config?.mount || 'NONE';
      
      if (mount === 'DORSAL') {
        // Check decks above d1
        for (let di = d1 + 1; di < hull.decks.length; di++) {
          const dk = hull.decks[di];
          if (dk?.points && isPointInPolygon(c1.x, c1.y, dk.points)) {
            c1.isBlocked = true;
            break;
          }
        }
      } else if (mount === 'VENTRAL') {
        // Check decks below d0
        for (let di = d0 - 1; di >= 0; di--) {
          const dk = hull.decks[di];
          if (dk?.points && isPointInPolygon(c1.x, c1.y, dk.points)) {
            c1.isBlocked = true;
            break;
          }
        }
      }
    }

    for (let di = d0; di <= d1; di++) {
      const dk = hull.decks[di];
      if (!dk?.points) continue;
      if (outline.some((p: any) => !isPointInPolygon(p.x, p.y, dk.points))) {
        c1.isOutsideHull = true;
        break;
      }
    }

    hull.compartments.forEach((c2: any) => {
      if (c1 === c2) return;
      const d1_min = Math.min(c1.startDeck, c1.endDeck);
      const d1_max = Math.max(c1.startDeck, c1.endDeck);
      const d2_min = Math.min(c2.startDeck, c2.endDeck);
      const d2_max = Math.max(c2.startDeck, c2.endDeck);
      const shareDeck = Math.max(d1_min, d2_min) <= Math.min(d1_max, d2_max);
      if (shareDeck && c1.points && c2.points) {
        if (doPolygonsIntersect(c1.points, c2.points)) {
          c1.isIntersecting = true;
        }
      }
    });
  });
}

export function validateHullForApply(hull: any): string | null {
  checkValidation(hull);
  for (let i = 0; i < hull.decks.length; i++) {
    const d = hull.decks[i];
    if (d.isSelfIntersecting) {
      return `Deck ${d.level}: hull outline self-intersects. Fix the shape before saving.`;
    }
    if (!d.hasContactWithLower && i > 0) {
      return `Deck ${d.level}: No contact point with the deck below it!`;
    }
    if (!d.hasContactWithUpper && i < hull.decks.length - 1) {
      return `Deck ${d.level}: No contact point with the deck above it!`;
    }
  }
  for (const comp of hull.compartments) {
    if (comp.isOutsideHull) {
      return `Compartment ${comp.type} (ID: ${comp.id}) is outside the hull boundary!`;
    }
    if (comp.isIntersecting) {
      return `Compartment ${comp.type} (ID: ${comp.id}) is intersecting with another compartment!`;
    }
    if (comp.isBlocked) {
      return `Turret in compartment ${comp.id} is blocked by another deck!`;
    }
  }
  return null;
}

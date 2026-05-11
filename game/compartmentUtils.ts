
import {
  HULL_IRON_PER_M3,
  HULL_TITANIUM_PER_M3,
  ARMOR_TITANIUM_PER_M3,
  ARMOR_IRON_PER_M3,
  COMPARTMENT_IRON_PER_M3,
  COMPARTMENT_TITANIUM_PER_M3,
  PERIMETER_THICKNESS,
  PERIMETER_IRON_PER_M3,
  PERIMETER_TITANIUM_PER_M3,
  BEAM_IRON_COST,
  DEFAULT_REACTOR_POWER,
  DEFAULT_ENGINE_THRUST_BONUS,
  DEFAULT_GYRO_TURN_BONUS,
  DEFAULT_MACHINERY_REPAIR_RATE,
  DEFAULT_FABRIC_HULL_POOL,
  DEFAULT_WEAPON_DAMAGE,
  DEFAULT_WEAPON_RANGE,
  DEFAULT_WEAPON_ROF,
  DEFAULT_WEAPON_SPEED,
} from './constants';
import type { Compartment, CompartmentType, TurretConfig } from '@/components/game/types';

export function legacyRectPoints(comp: {
  x: number;
  y: number;
  width: number;
  height: number;
}): {x: number; y: number}[] {
  const w = comp.width;
  const h = comp.height;
  return [
    {x: comp.x - w / 2, y: comp.y - h / 2},
    {x: comp.x + w / 2, y: comp.y - h / 2},
    {x: comp.x + w / 2, y: comp.y + h / 2},
    {x: comp.x - w / 2, y: comp.y + h / 2},
  ];
}

export function getCompartmentOutlinePoints(comp: {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: {x: number; y: number}[];
}): {x: number; y: number}[] {
  if (comp.points && comp.points.length >= 3) return comp.points;
  return legacyRectPoints(comp);
}

export function isPointInPolygon(px: number, py: number, poly: {x: number, y: number}[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function compartmentFitsDeckSpan(
  hull: {decks: {points: {x: number; y: number}[]}[]},
  comp: {x: number; y: number; width: number; height: number; points?: {x: number; y: number}[]},
  startDeck: number,
  endDeck: number,
  isPointInPolygon: (px: number, py: number, poly: {x: number; y: number}[]) => boolean
): boolean {
  const pts = getCompartmentOutlinePoints(comp);
  const lo = Math.min(startDeck, endDeck);
  const hi = Math.max(startDeck, endDeck);
  for (let d = lo; d <= hi; d++) {
    const deck = hull.decks[d];
    if (!deck?.points || deck.points.length < 3) return false;
    for (const p of pts) {
      if (!isPointInPolygon(p.x, p.y, deck.points)) return false;
    }
  }
  return true;
}

export function polygonSignedArea(points: {x: number; y: number}[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    area += p0.x * p1.y - p1.x * p0.y;
  }
  return area / 2;
}

export function polygonArea(points: {x: number; y: number}[]): number {
  return Math.abs(polygonSignedArea(points));
}

export function polygonPerimeter(points: {x: number; y: number}[]): number {
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

export function getDeckHeight(deck: any): number {
  return deck?.height || 4; // Defaults to 4 meters
}

export function getCompartmentVolume(comp: any, decks: any[]): number {
  const area = polygonArea(getCompartmentOutlinePoints(comp as any));
  if (comp.personalHeight) return area * comp.personalHeight;
  
  let totalHeight = 0;
  const start = comp.startDeck || 0;
  const end = comp.endDeck || 0;
  for(let i = start; i <= end; i++) {
    totalHeight += getDeckHeight(decks[i]);
  }
  if (totalHeight === 0) totalHeight = 4;
  return area * totalHeight;
}

export function getTotalDeckSpanHeight(comp: any, decks: any[]): number {
  let totalHeight = 0;
  const start = comp.startDeck || 0;
  const end = comp.endDeck || 0;
  for(let i = start; i <= end; i++) {
    totalHeight += getDeckHeight(decks[i]);
  }
  return totalHeight;
}

export function getDeckAreas(deck: any) {
   let hullArea = 0, armorArea = 0;
   if (deck && deck.cells) {
      deck.cells.forEach((c: any) => {
         const a = polygonArea(c.points);
         if (c.cellType === 'ARMOR') armorArea += a;
         else hullArea += a;
      });
   } else if (deck && deck.points) {
      hullArea += polygonArea(deck.points);
   }
   return { hullArea, armorArea };
}

export function calcHullBuildCost(
  oldDecks: any[],
  newDecks: any[]
): { 
  cost: { IRON: number; TITANIUM: number }; 
  refund: { IRON: number; TITANIUM: number };
} {
  let ironCost = 0;
  let tiCost = 0;
  let ironRefund = 0;
  let tiRefund = 0;

  // Helper to ensure compatibility with decks that might not yet have an ID
  const getDeckId = (deck: any, index: number) => deck?.id || `legacy-deck-${index}`;

  const getDeckBeams = (deck: any) => deck?.beams?.length || 0;

  // Create maps for better matching
  const oldDeckMap = new Map(oldDecks.map((d, i) => [getDeckId(d, i), d]));
  const newDeckMap = new Map(newDecks.map((d, i) => [getDeckId(d, i), d]));
  
  // Combine all IDs to iterate
  const allDeckIds = new Set([...oldDeckMap.keys(), ...newDeckMap.keys()]);

  for (const deckId of allDeckIds) {
    const oldDeck = oldDeckMap.get(deckId);
    const newDeck = newDeckMap.get(deckId);
    
    // If a deck is completely new (not in old), cost is full.
    // If a deck is deleted (not in new), cost is refund.

    const oldAreas = getDeckAreas(oldDeck);
    const newAreas = getDeckAreas(newDeck);
    const oldH = getDeckHeight(oldDeck);
    const newH = getDeckHeight(newDeck);
    
    // 1. Hull Volume Changes
    const hullArea = newAreas.hullArea;
    const oldHullArea = oldAreas.hullArea;
    
    const newThickness = newDeck?.globalHullThickness || PERIMETER_THICKNESS;
    const oldThickness = oldDeck?.globalHullThickness || PERIMETER_THICKNESS;

    const hullVolDelta = (hullArea * 1.25 * newThickness) - (oldHullArea * 1.25 * oldThickness);
    
    if (hullVolDelta > 0) {
      ironCost += hullVolDelta * HULL_IRON_PER_M3;
      tiCost += hullVolDelta * HULL_TITANIUM_PER_M3;
    } else if (hullVolDelta < 0) {
      const absDelta = Math.abs(hullVolDelta);
      
      const rawIronRefund = absDelta * HULL_IRON_PER_M3 * 0.8;
      const deconstructionIronCost = absDelta * HULL_IRON_PER_M3 * 0.2;
      
      const rawTiRefund = absDelta * HULL_TITANIUM_PER_M3 * 0.8;
      const deconstructionTiCost = absDelta * HULL_TITANIUM_PER_M3 * 0.2;

      ironCost += deconstructionIronCost;
      ironRefund += rawIronRefund;
      tiCost += deconstructionTiCost;
      tiRefund += rawTiRefund;
    }

    // 2. Armor Volume Changes
    const armorVolDelta = (newAreas.armorArea * newH) - (oldAreas.armorArea * oldH);
    if (armorVolDelta > 0) {
      ironCost += armorVolDelta * ARMOR_IRON_PER_M3;
      tiCost += armorVolDelta * ARMOR_TITANIUM_PER_M3;
    } else if (armorVolDelta < 0) {
      const absDelta = Math.abs(armorVolDelta);
      ironCost += absDelta * ARMOR_IRON_PER_M3 * 0.2;
      ironRefund += absDelta * ARMOR_IRON_PER_M3 * 0.8;
      tiCost += absDelta * ARMOR_TITANIUM_PER_M3 * 0.2;
      tiRefund += absDelta * ARMOR_TITANIUM_PER_M3 * 0.8;
    }
    
    // 3. Perimeter cost
    const oldPerimeter = oldDeck?.points ? polygonPerimeter(oldDeck.points) : 0;
    const newPerimeter = newDeck?.points ? polygonPerimeter(newDeck.points) : 0;
    
    const perimeterVolDelta = (newPerimeter * newThickness * newH) - (oldPerimeter * oldThickness * oldH);
    if (perimeterVolDelta > 0) {
      ironCost += perimeterVolDelta * PERIMETER_IRON_PER_M3;
      tiCost += perimeterVolDelta * PERIMETER_TITANIUM_PER_M3;
    } else if (perimeterVolDelta < 0) {
      const absDelta = Math.abs(perimeterVolDelta);
      ironCost += absDelta * PERIMETER_IRON_PER_M3 * 0.2;
      ironRefund += absDelta * PERIMETER_IRON_PER_M3 * 0.8;
      tiCost += absDelta * PERIMETER_TITANIUM_PER_M3 * 0.2;
      tiRefund += absDelta * PERIMETER_TITANIUM_PER_M3 * 0.8;
    }
    
    // 4. Beams
    const ob = getDeckBeams(oldDeck);
    const nb = getDeckBeams(newDeck);
    if (nb > ob) ironCost += (nb - ob) * BEAM_IRON_COST;
  }
  
  return {
    cost: { IRON: ironCost, TITANIUM: tiCost },
    refund: { IRON: ironRefund, TITANIUM: tiRefund }
  };
}

export function calcCompartmentBuildCost(comp: any, decks: any[]): { IRON: number; TITANIUM: number } {
  const area = polygonArea(getCompartmentOutlinePoints(comp as any));
  const perimeter = polygonPerimeter(getCompartmentOutlinePoints(comp as any));
  const height = comp.personalHeight || getTotalDeckSpanHeight(comp, decks) || 4;
  
  // Formula: (2*Area + Perimeter*Height) * Density
  const surfaceFactor = (2 * area + (perimeter * height));
  
  return {
    IRON: Math.ceil(surfaceFactor * COMPARTMENT_IRON_PER_M3),
    TITANIUM: Math.ceil(surfaceFactor * COMPARTMENT_TITANIUM_PER_M3),
  };
}

export function getShipMass(hull: any): number {
   let massC = 0;
   // Compartments compute their volume - bringing density in line with resource cost (1.2 + 0.4 = 1.6)
   // We use 1.6 (equivalent to 1.6 tons per m3)
   for (const comp of hull.compartments) {
      massC += getCompartmentVolume(comp, hull.decks) * (COMPARTMENT_IRON_PER_M3 + COMPARTMENT_TITANIUM_PER_M3); 
   }
   
   let massH = 0;
   // Hull, armor and perimeter mass - brought in line with resource costs by applying INFRASTRUCTURE_COST_FACTOR
   const INFRASTRUCTURE_COST_FACTOR = 0.2; 

   for (let i = 0; i < hull.decks.length; i++) {
      const deck = hull.decks[i];
      const a = getDeckAreas(deck);
      const h = getDeckHeight(deck);
      
      // Standard hull: cost is HULL_IRON_PER_M3 + HULL_TITANIUM_PER_M3 = 4.8
      const hullThickness = deck.globalHullThickness || PERIMETER_THICKNESS;
      massH += (a.hullArea * 1.25 * hullThickness) * (HULL_IRON_PER_M3 + HULL_TITANIUM_PER_M3) * INFRASTRUCTURE_COST_FACTOR;
      // Armor: cost is ARMOR_IRON_PER_M3 + ARMOR_TITANIUM_PER_M3 = 6.0
      massH += (a.armorArea * h) * (ARMOR_IRON_PER_M3 + ARMOR_TITANIUM_PER_M3) * INFRASTRUCTURE_COST_FACTOR; 
      
      // Perimeter (Outer hull walls): cost is PERIMETER_IRON_PER_M3 + PERIMETER_TITANIUM_PER_M3 = 4.0
      const perimeter = deck.points ? polygonPerimeter(deck.points) : 0;
      const thickness = deck.globalHullThickness || PERIMETER_THICKNESS;
      massH += (perimeter * thickness * h) * (PERIMETER_IRON_PER_M3 + PERIMETER_TITANIUM_PER_M3) * INFRASTRUCTURE_COST_FACTOR;
      
      // Beams - BEAM_IRON_COST is a flat cost (50 units). 
      const beamCount = deck.beams?.length || 0;
      massH += (beamCount * BEAM_IRON_COST * INFRASTRUCTURE_COST_FACTOR); 
   }
   
   return (massC + massH) * 1000; // in kg for physics
}
export function calcBlueprintCost(
  oldDecks: any[],
  newDecks: any[],
  newCompartments: any[],
  oldCompartments: any[]
): { cost: { IRON: number; TITANIUM: number }, refund: { IRON: number; TITANIUM: number } } {
  const hullResult = calcHullBuildCost(oldDecks, newDecks);
  
  const INFRASTRUCTURE_COST_FACTOR = 0.2; 
  
  let costIron = hullResult.cost.IRON * INFRASTRUCTURE_COST_FACTOR;
  let costTi = hullResult.cost.TITANIUM * INFRASTRUCTURE_COST_FACTOR;
  let refundIron = hullResult.refund.IRON * INFRASTRUCTURE_COST_FACTOR;
  let refundTi = hullResult.refund.TITANIUM * INFRASTRUCTURE_COST_FACTOR;

  // IMPORTANT: The dual system (Deck Area vs Structural Cells) works as follows:
  // Deck Area represents the ship's infrastructure, communications, and power layout.
  // Structural Cells and Compartments represent the actual physical structure, volume, and utility.
  // Both systems are necessary for complex physical simulations and layout management.
  
  // 2. Compartment changes
  for (const nc of newCompartments) {
    const old = oldCompartments.find((oc: any) => oc.id === nc.id);
    if (!old) {
      const c = calcCompartmentBuildCost(nc, newDecks);
      costIron += c.IRON;
      costTi += c.TITANIUM;
    } else {
      const oldVol = getCompartmentVolume(old, oldDecks);
      const newVol = getCompartmentVolume(nc, newDecks);
      const deltaVol = newVol - oldVol;
      
      const typeChangeMultiplier = old.type !== nc.type ? 1.5 : 1;
      
      if (deltaVol > 0) {
        costIron += deltaVol * COMPARTMENT_IRON_PER_M3 * typeChangeMultiplier;
        costTi += deltaVol * COMPARTMENT_TITANIUM_PER_M3 * typeChangeMultiplier;
      } else if (deltaVol < 0) {
        // Deconstruction / Reducing (Labor + Refund)
        costIron += Math.abs(deltaVol) * COMPARTMENT_IRON_PER_M3 * 0.2 * typeChangeMultiplier;
        costTi += Math.abs(deltaVol) * COMPARTMENT_TITANIUM_PER_M3 * 0.2 * typeChangeMultiplier;
        refundIron += Math.abs(deltaVol) * COMPARTMENT_IRON_PER_M3 * 0.8;
        refundTi += Math.abs(deltaVol) * COMPARTMENT_TITANIUM_PER_M3 * 0.8;
      }
    }
  }

  // Handle fully deleted compartments
  for (const oc of oldCompartments) {
    if (!newCompartments.find(nc => nc.id === oc.id)) {
      const oldVol = getCompartmentVolume(oc, oldDecks);
      costIron += oldVol * COMPARTMENT_IRON_PER_M3 * 0.2;
      costTi += oldVol * COMPARTMENT_TITANIUM_PER_M3 * 0.2;
      refundIron += oldVol * COMPARTMENT_IRON_PER_M3 * 0.8;
      refundTi += oldVol * COMPARTMENT_TITANIUM_PER_M3 * 0.8;
    }
  }

  return {
    cost: { IRON: Math.ceil(costIron), TITANIUM: Math.ceil(costTi) },
    refund: { IRON: Math.floor(refundIron), TITANIUM: Math.floor(refundTi) }
  };
}

export interface MirrorTarget {
  index: number;
  axis: 'x' | 'y' | 'xy';
}

export function resolveMirrorTargets(
  points: {x: number; y: number}[],
  activeIndex: number,
  symY: boolean, // Left/Right (mirrors X coordinate)
  symX: boolean  // Top/Bottom (mirrors Y coordinate)
): MirrorTarget[] {
  const targets: MirrorTarget[] = [];
  if (!symY && !symX) return targets;

  const source = points[activeIndex];
  const threshold = 0.1; // meters

  const findMatch = (tx: number, ty: number): number => {
    return points.findIndex((p, idx) => {
      if (idx === activeIndex) return false;
      return Math.abs(p.x - tx) < threshold && Math.abs(p.y - ty) < threshold;
    });
  };

  // 1. Mirror X (Left/Right symmetry)
  if (symY && Math.abs(source.x) > 0.01) {
    const idx = findMatch(-source.x, source.y);
    if (idx !== -1) targets.push({ index: idx, axis: 'x' });
  }

  // 2. Mirror Y (Top/Bottom symmetry)
  if (symX && Math.abs(source.y) > 0.01) {
    const idx = findMatch(source.x, -source.y);
    if (idx !== -1) targets.push({ index: idx, axis: 'y' });
  }

  // 3. Mirror both
  if (symX && symY && (Math.abs(source.x) > 0.01 || Math.abs(source.y) > 0.01)) {
    const idx = findMatch(-source.x, -source.y);
    if (idx !== -1) targets.push({ index: idx, axis: 'xy' });
  }

  return targets;
}

export const COMPARTMENT_COLORS: Record<string, string> = {
  BRIDGE: '#5555ff',
  ENGINE: '#ff5555',
  WARP_ENGINE: '#aa44ff',
  CARGO: '#886600',
  WEAPON: '#ff4444',
  MINING: '#44ff44',
  REACTOR: '#ffaa00',
  GYRO: '#00aaff',
  MACHINERY: '#ff8800',
  FABRIC: '#00cc88',
  COMMUNICATION: '#22cc22',
  RESEARCH: '#ff55aa',
};

const defaultTurretVisual = {
  scale: 1.0,
  mountLayers: [{ id: 'ml-1', zIndex: 0, color: '#444444', points: [{x: -6, y: -6}, {x: 6, y: -6}, {x: 6, y: 6}, {x: -6, y: 6}] }],
  headLayers: [{ id: 'hl-1', zIndex: 1, color: '#555555', points: [{x: -5, y: -5}, {x: 2, y: -5}, {x: 7, y: 0}, {x: 2, y: 5}, {x: -5, y: 5}] }],
  barrelLayers: [{ id: 'bl-1', zIndex: 0, color: '#333333', points: [{x: 0, y: -1}, {x: 10, y: -1}, {x: 10, y: 1}, {x: 0, y: 1}] }],
};

export function makeDefaultTurretConfig(): TurretConfig {
  return {
    fireMode: 'ROUNDS',
    weaponGroup: 'MAIN',
    damage: DEFAULT_WEAPON_DAMAGE,
    range: DEFAULT_WEAPON_RANGE,
    rateOfFire: DEFAULT_WEAPON_ROF,
    projectileSpeed: DEFAULT_WEAPON_SPEED,
    homingStrength: 0.8,
    beamDuration: 0.5,
    barrelCount: 2,
    shaftCount: 1,
    mount: 'DORSAL',
    visual: defaultTurretVisual
  };
}

export function makeDefaultCompartmentExtras(type: CompartmentType): Partial<Compartment> {
  switch (type) {
    case 'WEAPON':
      return { turretConfig: makeDefaultTurretConfig() };
    case 'MINING':
      return { 
        miningConfig: { 
          miningRate: 10, 
          range: 1500, 
          level: 0, 
          mount: 'DORSAL', 
          barrelCount: 1, 
          visual: JSON.parse(JSON.stringify(defaultTurretVisual)) 
        }
      };
    case 'REACTOR':
      return { reactorConfig: { powerOutput: DEFAULT_REACTOR_POWER, fuelEfficiency: 1.0 } };
    case 'ENGINE':
      return { engineConfig: { thrust: DEFAULT_ENGINE_THRUST_BONUS, fuelPerSec: 0.1 } };
    case 'GYRO':
      return { gyroConfig: { turnBonus: DEFAULT_GYRO_TURN_BONUS } };
    case 'MACHINERY':
      return { machineryConfig: { repairRate: DEFAULT_MACHINERY_REPAIR_RATE } };
    case 'FABRIC':
      return { fabricConfig: { hullPool: DEFAULT_FABRIC_HULL_POOL } };
    case 'CARGO':
      return { cargoConfig: { level: 0, capacityMultiplier: 1.0 } };
    case 'RESEARCH':
      return { personalHeight: undefined, relativeHeight: 0 };
    case 'COMMUNICATION':
      return { personalHeight: undefined, relativeHeight: 0 };
    default:
      return {};
  }
}

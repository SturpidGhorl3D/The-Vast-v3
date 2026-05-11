
export type MaterialTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Material {
  id: string;
  label: string;
  shortLabel: string;
  tier: MaterialTier;
  color: string;
  description: string;
  density: number;
}

export interface ComponentRecipe {
  id: string;
  label: string;
  tier: MaterialTier;
  inputs: { materialId: string; amount: number }[];
  outputAmount: number;
  techRequired?: string;
  productionTime: number; // Base production units (default 1000)
  shipType?: string[]; // Optional: restricted to certain constructor types
  category?: 'BASIC' | 'BIO' | 'ORGANIC' | 'CRYSTAL' | 'MINING' | 'WEAPON' | 'REACTOR';
}

export const MATERIALS: Material[] = [
  { id: 'IRON',      label: 'Iron',       shortLabel: 'Fe', tier: 0, color: '#cc7755', description: 'Common structural metal', density: 7874 },
  { id: 'TITANIUM',  label: 'Titanium',   shortLabel: 'Ti', tier: 0, color: '#aabbcc', description: 'Lightweight structural metal', density: 4507 },
  { id: 'ALUMINIUM', label: 'Aluminium',  shortLabel: 'Al', tier: 0, color: '#bbddee', description: 'Light alloy material', density: 2700 },
  { id: 'SILICON',   label: 'Silicon',    shortLabel: 'Si', tier: 0, color: '#444466', description: 'Basic crystal backbone', density: 2330 },
  { id: 'NICKEL',    label: 'Nickel',     shortLabel: 'Ni', tier: 0, color: '#aabb99', description: 'Corrosion-resistant metal', density: 8908 },
  { id: 'SULFUR',    label: 'Sulfur',     shortLabel: 'S',  tier: 0, color: '#ddcc44', description: 'Reactive non-metal', density: 2070 },
  { id: 'ICE',       label: 'Ice',        shortLabel: 'H₂O',tier: 0, color: '#cceeff', description: 'Water ice, hydrogen source', density: 917 },
  { id: 'LITHIUM',   label: 'Lithium',    shortLabel: 'Li', tier: 0, color: '#ff88cc', description: 'Rare alkali metal', density: 534 },
  { id: 'MAGNESIUM', label: 'Magnesium',  shortLabel: 'Mg', tier: 0, color: '#eeddaa', description: 'Light reactive metal', density: 1738 },
  { id: 'RUBIDIUM',  label: 'Rubidium',   shortLabel: 'Rb', tier: 0, color: '#ffaacc', description: 'Rare alkali metal', density: 1532 },
  { id: 'THORIUM',   label: 'Thorium',    shortLabel: 'Th', tier: 0, color: '#88ff88', description: 'Radioactive fuel element', density: 11724 },
  { id: 'URANIUM',   label: 'Uranium',    shortLabel: 'U',  tier: 0, color: '#44ff44', description: 'Dense radioactive metal', density: 19050 },
  { id: 'PLATINUM',  label: 'Platinum',   shortLabel: 'Pt', tier: 0, color: '#ddddff', description: 'Rare catalyst metal', density: 21450 },
  { id: 'GOLD',      label: 'Gold',       shortLabel: 'Au', tier: 0, color: '#ffdd44', description: 'Rare conductive metal', density: 19300 },
  { id: 'COMP_T1_STRUCTURAL', label: 'Structural Frame', shortLabel: 'SF',  tier: 1, color: '#cc9966', description: 'Basic structural component', density: 0 },
  { id: 'COMP_T1_ELECTRONIC', label: 'Circuit Board',   shortLabel: 'CB',  tier: 1, color: '#6699cc', description: 'Basic electronic component', density: 0 },
  { id: 'COMP_T1_POWER',      label: 'Power Cell',      shortLabel: 'PC',  tier: 1, color: '#ffcc33', description: 'Basic power storage unit', density: 0 },
  { id: 'COMP_T1_THERMAL',    label: 'Heat Tink',       shortLabel: 'HS',  tier: 1, color: '#ff6633', description: 'Basic thermal management', density: 0 },
  { id: 'COMP_T2_ALLOY',      label: 'Titanium Alloy',  shortLabel: 'TA',  tier: 2, color: '#99bbdd', description: 'Advanced structural alloy', density: 0 },
  { id: 'COMP_T2_PROCESSOR',  label: 'AI Processor',    shortLabel: 'AIP', tier: 2, color: '#4488ff', description: 'Advanced computing unit', density: 0 },
  { id: 'COMP_T2_REACTOR',    label: 'Reactor Core',    shortLabel: 'RC',  tier: 2, color: '#ff8800', description: 'Advanced power generation', density: 0 },
  { id: 'COMP_T3_ADVANCED',   label: 'Adv. Component',  shortLabel: 'AC',  tier: 3, color: '#cc44ff', description: 'Composite advanced component', density: 0 },
];

import { ALL_MATERIALS } from './data/materials/registry';

export const COMPONENT_RECIPES: ComponentRecipe[] = [
  ...ALL_MATERIALS
];

export const MATERIAL_MAP: Record<string, Material> = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

export const COST_COEFFICIENTS: Record<string, number> = {
  HULL: 1.0,
  BRIDGE: 2.5,
  ENGINE: 3.0,
  WARP_ENGINE: 5.0,
  CARGO: 0.8,
  WEAPON: 4.0,
  MINING: 3.5,
  REACTOR: 4.5,
  GYRO: 2.0,
  MACHINERY: 2.0,
  FABRIC: 6.0,
};

export function calculatePolygonArea(points: { x: number; y: number }[]): number {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function calculateShipModificationCost(oldDecks: any[], newDecks: any[], oldComps: any[], newComps: any[]): Record<string, number> {
  const cost: Record<string, number> = { IRON: 0, TITANIUM: 0 };
  const deckHeight = 3; // meters

  // Hull cost (Iron)
  let oldHullArea = 0;
  oldDecks.forEach(d => oldHullArea += calculatePolygonArea(d.points));
  let newHullArea = 0;
  newDecks.forEach(d => newHullArea += calculatePolygonArea(d.points));

  const areaDiff = Math.max(0, newHullArea - oldHullArea);
  // 1 m2 * 3m height * ~7.8 density / 1000 = ~23 tons per m2
  // Let's use a simpler scale: 1 m2 = 10 units of Iron
  cost.IRON += Math.ceil(areaDiff * 10 * COST_COEFFICIENTS.HULL);

  // Compartment costs
  newComps.forEach(nc => {
    const oc = oldComps.find(c => c.id === nc.id);
    const newArea = calculatePolygonArea(nc.points || []);
    const oldArea = oc ? calculatePolygonArea(oc.points || []) : 0;
    const diff = Math.max(0, newArea - oldArea);
    
    const coeff = COST_COEFFICIENTS[nc.type] || 1.0;
    cost.IRON += Math.ceil(diff * 5 * coeff);
    cost.TITANIUM += Math.ceil(diff * 2 * coeff);
  });

  return cost;
}

export function makeStartingInventory(): Record<string, number> {
  return { IRON: 100, TITANIUM: 50 };
}

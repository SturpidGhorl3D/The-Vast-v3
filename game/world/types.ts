
export enum PlanetType {
  ROCKY    = 'ROCKY',
  GAS_GIANT = 'GAS_GIANT',
  ICE      = 'ICE',
  VOLCANIC = 'VOLCANIC',
  OCEAN    = 'OCEAN',
  DESERT   = 'DESERT',
}

export enum ClimateClass {
  TERRAN = 'TERRAN',
  ARID = 'ARID',
  TUNDRA = 'TUNDRA',
  OCEANIC = 'OCEANIC',
  TOXIC = 'TOXIC',
  BARREN = 'BARREN',
  VOLCANIC = 'VOLCANIC',
  GAS_GIANT = 'GAS_GIANT',
  ICE_GIANT = 'ICE_GIANT',
}

export enum SatelliteClass {
  ROCKY_MOON = 'ROCKY_MOON',
  ICE_MOON = 'ICE_MOON',
  VOLCANIC_MOON = 'VOLCANIC_MOON',
  CAPTURED_ASTEROID = 'CAPTURED_ASTEROID',
  HABITABLE_MOON = 'HABITABLE_MOON',
  BIOLUMINESCENT_MOON = 'BIOLUMINESCENT_MOON',
}

export enum StarClass {
  O = 'O', B = 'B', A = 'A', F = 'F', G = 'G', K = 'K', M = 'M',
  WD = 'WD', NS = 'NS', BH = 'BH'
}

export interface OrbitData {
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle?: number; 
  orbitCenterId?: string; // id of parent. if omitted, assume the immediate parent in hierarchy
}

export type DistrictType = 'residential' | 'energy' | 'mining' | 'food' | 'industrial' | 'government';
export type JobType = 'ruler' | 'technician' | 'miner' | 'farmer' | 'worker' | 'researcher' | 'entertainer';

export interface District {
  id: string;
  type: DistrictType;
  specialization?: string;
  buildingSlots: number;
}

export interface Colony {
  factionId: string;
  population: bigint;
  jobs: { [key in JobType]?: bigint };
  districts: District[];
  maxDistricts: number;
  housing: bigint;
  amenities: number;
  growthRate: number;
  growthProgress?: number; // 0 to 1
  productionModifiers: { [key: string]: number };
  lastProduction?: { [key: string]: number };
  lastConsumption?: { [key: string]: number };
}

export interface Satellite {
  id: string;
  type: SatelliteClass;
  isHabitable?: boolean;
  radius: number;
  mass: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle?: number;
  orbitCenterId?: string;
  color: string;
  rotationSpeed: number;
  axisTilt: number;
  cloudRotationSpeed: number;
  atmosphereHeight: number;
  atmosphereDensity: number;
  scatteringColor: string;
  humidity: number;
  resources: { [key: string]: number };
}

export interface PlanetaryRing {
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  color: string;
  isAsteroids?: boolean; // if true, render as an asteroid belt visually
}

export interface PlanetData {
  id: string;
  type: PlanetType;
  climate: ClimateClass;
  isHabitable: boolean;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle?: number;
  orbitCenterId?: string;
  rotationSpeed: number;
  axisTilt: number;
  cloudRotationSpeed: number;
  atmosphereHeight: number;
  atmosphereDensity: number;
  color: string;
  scatteringColor: string;
  humidity: number;
  heightAccessibility: number;
  resources: { [key: string]: number };
  mass: number;
  satellites: Satellite[];
  ring?: PlanetaryRing;
  colony?: Colony;
}

export interface Star {
  id: string;
  name: string;
  starClass: StarClass;
  radius: number;
  mass: number;
  color: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  orbitCenterId?: string;
}


export interface AsteroidObject {
  id: string;
  entityId?: number;
  sectorX: bigint;
  sectorY: bigint;
  offsetX: number;
  offsetY: number;
  rx: number;       // legacy field, keep for compatibility temporarily
  ry: number;       // legacy field, keep for compatibility temporarily
  radius: number;
  isPlanetoid: boolean;
  color: string;
  totalCapacity?: number;
  resources: { [key: string]: number };
  depleted?: boolean;
  depletedAt?: number;
}

export interface AsteroidCluster {
  id: string;
  sectorX: bigint;
  sectorY: bigint;
  offsetX: number;
  offsetY: number;
  radius: number;
  clusterOffsetX: number;
  clusterOffsetY: number;
  density: number;
  isRing: boolean;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  inSystem: boolean;
  boundaryPoints: { x: number; y: number }[];
  resources: { [key: string]: number };
  visualCount: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export type GridType = 'GLOBAL' | 'SYSTEM' | 'PLANETARY';

export interface HexChunk {
  q: number; // Axial coords
  r: number;
  cx?: number; // Center points in world meters for rendering
  cy?: number;
  gridType: GridType;
  parentId: string; // "GLOBAL", "sys-{id}", or "planet-{id}"
  isAsteroidField: boolean;
  avgValue: number;
  avgCount: number;
  avgRarity: number;
  avgRegen: number;
  asteroids: AsteroidObject[] | null; // null if not loaded
  polyPoints?: {x: number, y: number}[]; // when merged into a polygonal area
}

export interface AsteroidBelt {
  id?: string;
  minRadius: number;
  maxRadius: number;
  threshold: number;
  orbitCenterId?: string; // If it revolves around a specific body
  orbitSpeed?: number; // angular speed
}

export interface SpaceStation {
  id: string;
  factionId: string;
  offsetX: number;
  offsetY: number;
  orbitRadius?: number; 
  orbitSpeed?: number;
  orbitTarget?: string; 
  orbitTargetType?: 'STAR' | 'PLANET' | 'SATELLITE' | 'ASTEROID_BELT';
  name: string;
  stationType: 'TRADING_POST' | 'SHIPYARD' | 'MILITARY_OUTPOST' | 'CAPITAL' | 'CONTROL_STATION';
}

export interface StarSystem {
  id: string;
  sectorX: bigint;
  sectorY: bigint;
  offsetX: number;
  offsetY: number;
  name: string;
  starColor: string; // Keep for compatibility / primary star
  starRadius: number; // Keep for compatibility / primary star
  stars: Star[];
  planets: PlanetData[];
  asteroidClusters: AsteroidCluster[];
  asteroidBelts: AsteroidBelt[];
  factionId?: string;
  spaceStations: SpaceStation[];
  gravisphereRadius: number;
  connectedSystemIds?: string[]; // IDs of systems connected by gravitational lanes
}

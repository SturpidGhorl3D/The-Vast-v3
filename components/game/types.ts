export type ViewMode = 'STRATEGIC' | 'LOCAL' | 'TACTICAL';
export type EditorMode =
  | 'PAN'
  | 'SELECT'
  | 'EDIT_VERTICES'
  | 'ADD_HULL_VERTEX'
  | 'ADD_COMPARTMENT'
  | 'MOVE_COMPARTMENT'
  | 'EDIT_COMPARTMENTS'
  | 'ADD_COMPARTMENT_VERTEX'
  | 'DELETE_COMPARTMENT_VERTEX'
  | 'PLACE_TURRETS'
  | 'EDIT_BEAMS'
  | 'ADD_BEAM'
  | 'BUILD_ARMOR'
  | 'EDIT_ARMOR'
  | 'EDIT_TURRET'
  | 'SET_TURRET_PIVOT';

export type SelectionType = 'deck' | 'compartment' | null;

export type InteractionMode = 'NONE' | 'MINING' | 'COMBAT' | 'WAYPOINT';
export type MovementMode = 'MANUAL' | 'TACTICAL';

export type BeamPattern = 'HEX' | 'SQUARE' | 'SPIRAL' | 'PENROSE' | 'VORONOI' | 'NONE';

export interface Beam {
  id: string;
  p1: Point;
  p2: Point;
  type: 'AUTO' | 'MANUAL';
  hp: number;
  maxHp: number;
  armorClass?: number;
}

export type CellType = 'STRUCTURAL' | 'ARMOR';

export interface StructuralCell {
  id: string;
  points: Point[];
  hp: number;
  maxHp: number;
  cellType: CellType;
  armorClass?: number;
  isManual?: boolean;
  inheritsHullColor?: boolean;
}

export interface Point {
  x: number;
  y: number;
  segmentType?: 'STRAIGHT' | 'CONVEX' | 'CONCAVE' | 'SINUSOIDAL';
  localThickness?: number;
  armorClass?: number;
  /** Index-based symmetry: references to other vertices in the same array */
  mirrorX?: number;
  mirrorY?: number;
  mirrorXY?: number;
}

export type CompartmentType =
  | 'BRIDGE'
  | 'ENGINE'
  | 'WARP_ENGINE'
  | 'CARGO'
  | 'WEAPON'
  | 'MINING'
  | 'REACTOR'
  | 'GYRO'
  | 'MACHINERY'
  | 'FABRIC'
  | 'COMMUNICATION'
  | 'RESEARCH';

export type FireMode = 'ROUNDS' | 'BEAM' | 'HOMING';

export type WeaponGroup = 'MAIN' | 'SECONDARY' | 'DEFENCE';

export interface TurretLayer {
  id: string;
  points: Point[];
  color: string;
  zIndex: number;
}

export interface TurretVisualConfig {
  mountLayers: TurretLayer[];
  headLayers: TurretLayer[];
  barrelLayers: TurretLayer[];
  scale: number;
  mountAttachmentPoint?: Point; // placement in compartment coords
  headAttachmentPoint?: Point;  // head rotation axis relative to mount
  barrelAttachmentPoints?: Point[]; // barrel roots relative to head
}

export interface TurretConfig {
  fireMode: FireMode;
  weaponGroup: WeaponGroup;
  damage: number;
  range: number;
  rateOfFire: number;
  projectileSpeed: number;
  beamDuration?: number;
  homingStrength?: number;
  barrelCount?: number;
  shaftCount?: number;
  mount?: 'DORSAL' | 'VENTRAL' | 'NONE';
  visual?: TurretVisualConfig;
}

export interface ReactorConfig {
  powerOutput: number;
  fuelEfficiency: number;
}

export interface EngineConfig {
  thrust: number;
  fuelPerSec: number;
}

export interface GyroConfig {
  turnBonus: number;
}

export interface MachineryConfig {
  repairRate: number;
}

export interface FabricConfig {
  hullPool: number;
}

export interface CargoConfig {
  capacityMultiplier: number; // 1.0 base, increases with upgrades
  level: number;
}

export interface MiningConfig {
  miningRate: number;
  range: number;
  level: number;
  mount?: 'DORSAL' | 'VENTRAL' | 'NONE';
  barrelCount?: number;
  visual?: TurretVisualConfig;
}

export interface Compartment {
  id: string;
  type: CompartmentType;
  x: number;
  y: number;
  width: number;
  height: number;
  personalHeight?: number;
  relativeHeight?: number; // 0 to 1, offset within the deck stack
  points?: Point[];
  startDeck: number;
  endDeck: number;
  color: string;
  isOutsideHull?: boolean;
  isIntersecting?: boolean;
  pairedWith?: string;
  pairAxis?: 'X' | 'Y';
  turretConfig?: TurretConfig;
  reactorConfig?: ReactorConfig;
  engineConfig?: EngineConfig;
  gyroConfig?: GyroConfig;
  machineryConfig?: MachineryConfig;
  fabricConfig?: FabricConfig;
  cargoConfig?: CargoConfig;
  miningConfig?: MiningConfig;
  buildProgress?: number;
  isBuilding?: boolean;
}

export interface HullPolygon {
  points: Point[];
  durability: number;
  maxDurability: number;
  isDamaged?: boolean;
  damageProgress?: number;
  deformOffset?: Point;
}

export interface Deck {
  id: string;
  level: number;
  points: Point[];
  color: string;
  name?: string;
  height?: number;
  isSelfIntersecting?: boolean;
  polygons?: HullPolygon[];
  // Structural integrity system
  beams?: Beam[];
  cells?: StructuralCell[];
  beamPattern?: BeamPattern;
  beamDensity?: number;
  globalHullThickness?: number;
}

export interface BuildAnimation {
  active: boolean;
  startTime: number;
  duration: number;
  oldDecks: Deck[];
  newDecks: Deck[];
  progress: number;
  scaffoldPhase: boolean;
  buildPhase: boolean;
  oldCompartments: Compartment[];
  cost: Record<string, number>;
}

export interface ShipHull {
  style: string;
  size: number;
  decks: Deck[];
  compartments: Compartment[];
  activeDeckIndex: number;
  buildAnimation?: BuildAnimation;
  turrets?: TurretMount[];
  population?: bigint;
  maxPopulation?: bigint;
}

export interface GameSettings {
  dithering: boolean;
  vignette: boolean;
  panning: boolean;
  spaceBackground: string;
  gridMode: 'OFF' | '10' | '100' | '1000';
  showAsteroidFields: boolean;
  showAsteroidChunks: boolean;
}

export interface ShipBlueprint {
  id: string;
  name: string;
  savedAt: number;
  hull: ShipHull;
}

export interface GlobalCoords {
  sectorX: bigint;
  sectorY: bigint;
  offsetX: number;
  offsetY: number;
}

export interface TacticalWaypoint extends GlobalCoords {}

export type TurretWeaponType = 'BALLISTIC' | 'LASER' | 'MISSILE' | 'MINING';

export interface TurretMount {
  id: string;
  /** Hull-local position (meters from ship center) */
  x: number;
  y: number;
  /** Mounting angle offset in radians (0 = forward) */
  angle: number;
  /** Arc of fire in radians (Math.PI = 180°) */
  arc: number;
  weaponType: TurretWeaponType;
  size: number; // barrel length in meters
  barrels: number; // 1, 2, 3
}

export interface SectorCoord {
  /** Sector column index (each sector = SYSTEM_GRID_SPACING_M units wide) */
  sx: number;
  /** Sector row index */
  sy: number;
  /** Human-readable name e.g. "SECTOR α7·3" */
  label: string;
}

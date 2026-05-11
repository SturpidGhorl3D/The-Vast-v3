
import { GlobalCoords, CompartmentType, Point, CargoConfig, MiningConfig, TurretConfig } from '../../components/game/types';

export type { GlobalCoords, CompartmentType, Point, CargoConfig, MiningConfig, TurretConfig };
import { Entity } from './ecs';

export interface Position extends GlobalCoords {
  angle: number;
}

export interface Velocity { 
  vx: number; 
  vy: number; 
  va: number 
}

export interface Compartment {
   id: string;
   type: CompartmentType;
   x: number;
   y: number;
   points?: Point[];
   width: number;
   height: number;
   startDeck: number;
   endDeck: number;
   color: string;
   isSelfIntersecting?: boolean;
   engineConfig?: { thrust: number; fuelPerSec: number; level?: number };
   gyroConfig?: { turnBonus: number; level?: number };
   reactorConfig?: { power: number; level?: number };
   turretConfig?: TurretConfig;
   cargoConfig?: CargoConfig;
   miningConfig?: MiningConfig;
   isBuilding?: boolean;
}

export interface Deck {
  level: number;
  name?: string;
  height?: number;
  points: Point[];
  color: string;
  isSelfIntersecting?: boolean;
}

export interface Hull {
  style: 'STEEL' | 'CRYSTAL' | 'ORGANIC';
  size: number;
  decks: Deck[];
  compartments: Compartment[];
  activeDeckIndex: number;
  population?: bigint;
  maxPopulation?: bigint;
}

export interface Inventory { 
  resources: { [key: string]: number };
  maxCapacity: number;
}

export interface Loot {
  resources: { [key: string]: number };
  creationTime: number;
}

export interface Player {
  playerId: string;
}

export enum FactionRelation {
    HOSTILE = 'HOSTILE',
    NEUTRAL = 'NEUTRAL',
    FRIENDLY = 'FRIENDLY'
}

export interface Ideology {
    foreignPolicy: number; // -1 (Defense) to 1 (Aggression)
    values: number;         // -1 (Material) to 1 (Spiritual)
    aliens: number;         // -1 (Xenophobe) to 1 (Xenophile)
    power: number;          // -1 (Liberal) to 1 (Authoritarian)
    social: number;         // -1 (Pluralism) to 1 (Elitism)
    economy: number;        // -1 (Cooperation) to 1 (Competition)
    ecology: number;        // -1 (Coexistence) to 1 (Selfish)
}

export interface FactionPerk {
    id: string;
    name: string;
    description: string;
    isPositive: boolean;
}

export type AITaskType = 'MOVE' | 'MINE' | 'TRANSPORT' | 'ATTACK' | 'ORBIT' | 'JUMP';

export interface AITask {
   id: string;
   type: AITaskType;
   targetPos?: GlobalCoords;
   targetEntityId?: Entity;
   route?: GlobalCoords[];
   systemId?: string;
}

export interface Fleet {
   id: string;
   factionId: string;
   name: string;
   tasks: AITask[];
   leaderEntityId?: Entity;
   memberEntities: Entity[];
   unloadedShipCount: number;
   position: GlobalCoords;
   isLoaded: boolean;
   formationType?: 'WEDGE' | 'LINE' | 'SPHERE';
}

export interface Faction {
    id: string;
    name: string;
    shortName?: string;
    description?: string;
    relationToPlayer: FactionRelation;
    color: string;
    isPlayer?: boolean;
    discoveredByPlayer?: boolean;
    ideology?: Ideology;
    perks?: FactionPerk[];
    species?: any; // SpeciesDefinition
    inventory?: Inventory;
    fleets?: Fleet[];
    blueprints?: any[]; // Hull[]
}

export enum AIBehavior {
    IDLE = 'IDLE',
    ROAMING = 'ROAMING',
    DEFENDING = 'DEFENDING',
    ATTACKING = 'ATTACKING',
    MINING = 'MINING',
    FLEEING = 'FLEEING'
}

export type TurretTargetType = 'ENTITY' | 'RELATIVE_ANGLE' | 'MANUAL_POINT';

export interface TurretTarget {
    type: TurretTargetType;
    entityId?: Entity;
    angleOffset?: number; // For relative pointing
    manualPoint?: { x: number, y: number };
}

export interface Weapon {
  group: 'MAIN' | 'SECONDARY' | 'DEFENCE';
  reloadTime: number; 
  lastFireTime: number;
  damage: number;
  range: number;
  projectileSpeed: number;
  fireMode: 'ROUNDS' | 'BEAM' | 'HOMING';
  barrelCount: number;
  turretId: string;
  turretAngle: number;
  rotationSpeed?: number;
  isMining?: boolean;
  fireCounter?: number;
  
  // New: Targeting state
  target: TurretTarget | null;
  autoFire: boolean;
}

export interface Projectile {
  ownerId: Entity;
  damage: number;
  speed: number;
  range: number;
  distanceTraveled: number;
  type: 'BALLISTIC' | 'MISSILE';
}

export interface AIState {
    behavior: AIBehavior;
    targetEntity?: Entity | null;
    roamTarget?: Position | null;
    timer?: number;
    homeLocation?: Position | null;
    attackRange?: number;
    tasks?: AITask[];
    fleetId?: string;
    isLeader?: boolean;
}

export interface Disconnected {
  timestamp: number;
}

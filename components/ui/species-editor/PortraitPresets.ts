
import { CreaturePart } from './types';

export const DEFAULT_TORSO: CreaturePart = {
  id: 'root-torso',
  type: 'TORSO',
  name: 'Торс (Гуманоид)',
  parentId: null,
  width: 80,
  height: 140,
  nodes: [
    { id: 'n1', x: 0.5, y: 0.21, radius: 24 }, // chest
    { id: 'n2', x: 0.5, y: 0.5, radius: 20 }, // stomach
    { id: 'n3', x: 0.5, y: 0.78, radius: 26 }, // hips
  ],
  color: '#0a0a0a',
  attachX: 40,
  attachY: 70,
  rotation: 0,
  zIndex: 10,
  anchorX: 40,
  anchorY: 70,
  animSpeed: 2,
  animAmplitude: 2,
  animPhase: 0,
  animType: 'SKELETAL',
  ikTargetX: 0,
  ikTargetY: 100,
  physicsMode: 'RIGID',
  customTexture: null,
};

export const HUMAN_PREFABS: Record<string, Partial<CreaturePart>> = {
  TORSO: {
    type: 'TORSO',
    name: 'Человеческое тело (Аниме)',
    color: '#fff1eb',
    width: 80,
    height: 140,
    zIndex: 10,
    nodes: [
      { id: '1', x: 0.5, y: 0.15, radius: 24 },
      { id: '2', x: 0.5, y: 0.45, radius: 18 },
      { id: '3', x: 0.5, y: 0.75, radius: 26 }
    ],
    anchorX: 40,
    anchorY: 70,
  },
  HEAD: {
    type: 'HEAD',
    name: 'Голова (Аниме)',
    color: '#fff1eb',
    width: 70,
    height: 85,
    zIndex: 20,
    nodes: [
      { id: '1', x: 0.5, y: 0.35, radius: 32 },
      { id: '2', x: 0.5, y: 0.75, radius: 20 }
    ],
    parentId: 'root-torso',
    attachX: 40,
    attachY: 10,
    anchorX: 35,
    anchorY: 75,
    animType: 'IK', 
    ikTargetX: 300,
    ikTargetY: 100,
  },
  HAIR: {
    type: 'APPENDAGE',
    name: 'Длинные волосы',
    color: '#3b251d',
    width: 70,
    height: 220,
    zIndex: 5,
    physicsMode: 'VERLET',
    verletSegments: 10,
    verletStiffness: 0.6,
    verletDamping: 0.92,
    verletGravity: 0.3,
    verletGravityEnabled: true,
    verletWiggleEnabled: true,
    verletWiggleType: 'SWAY',
    verletWigglePulse: 0.8,
    verletWiggleAmplitude: 4,
    nodes: [
      { id: '1', x: 0.5, y: 0.1, radius: 20 },
      { id: '2', x: 0.5, y: 0.5, radius: 15 },
      { id: '3', x: 0.5, y: 0.9, radius: 8 }
    ],
    parentId: 'HEAD',
    attachX: 35,
    attachY: 15,
    anchorX: 35,
    anchorY: 5,
  }
  // ... more can be added later or copied if needed
};

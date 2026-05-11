
export interface CreaturePartNode {
  id: string;
  x: number; // 0..1 relative to width
  y: number; // 0..1 relative to height
  radius: number;
}

export interface CreaturePart {
  id: string;
  type: 'TORSO' | 'HEAD' | 'LIMB' | 'TAIL' | 'APPENDAGE';
  name: string;
  parentId: string | null;
  
  width: number;
  height: number;
  
  nodes: CreaturePartNode[];
  
  color: string;
  
  // Pivot point on THIS part (in pixels 0..width, 0..height)
  anchorX: number;
  anchorY: number;
  
  // Point on PARENT part where this part attaches (in parent's pixels local space 0..parentWidth, 0..parentHeight)
  attachX: number;
  attachY: number;
  
  rotation: number;
  zIndex: number;
  
  animSpeed: number;
  animAmplitude: number;
  animPhase: number;
  
  animType: 'NONE' | 'SKELETAL' | 'IK' | 'DEFORMATION';
  ikTargetX?: number;
  ikTargetY?: number;
  ikWeight?: number; // 0..1 weight of IK influence
  
  // Mixed animations
  secondaryAnimType?: 'NONE' | 'SKELETAL' | 'IK' | 'DEFORMATION';
  animMixFactor?: number; // 0..1 blend between main and secondary
  
  // Physics & Adaptation
  physicsMode: 'RIGID' | 'VERLET';
  verletAdaptationWeight?: number; // How much a RIGID part follows a virtual VERLET sim
  
  // Joint limits in degrees
  minRotation?: number;
  maxRotation?: number;
  
  // Verlet simulation params
  verletSegments?: number;
  verletStiffness?: number;
  verletDamping?: number;
  verletGravity?: number;
  verletGravityEnabled?: boolean;
  verletIKEnabled?: boolean;
  verletJointLimit?: number; // max angle from parent
  verletWiggleEnabled?: boolean;
  verletWiggleType?: 'SWAY' | 'WRIGGLE' | 'TWITCH';
  verletWigglePulse?: number;
  verletWiggleAmplitude?: number;
  
  customTexture: string | null;
  hideBaseShape?: boolean;
}

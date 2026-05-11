
import { ECS, Entity } from './engine/ecs';
import { Camera } from './engine/camera';
import { Renderer } from './engine/renderer';
import { StarSystem, AsteroidCluster } from './world/generator';
import { CARGO_BASE_CAPACITY_PER_M3, CARGO_UPGRADE_EFFICIENCY_STEP } from './constants';
import { polygonArea, getCompartmentOutlinePoints } from './compartmentUtils';
import { Position, Velocity, Hull, Inventory, Compartment, Deck } from './engine/types';

export * from './engine/types';
export { movementSystem } from './systems/movementSystem';
export { miningSystem } from './systems/miningSystem';
export { renderSystem } from './systems/renderSystem';
export { combatSystem } from './systems/combatSystem';
export { turretSystem } from './systems/turretSystem';
export { projectileSystem } from './systems/projectileSystem';

/** Calculate total cargo capacity based on CARGO compartments volume. */
export function calculateMaxCapacity(hull: Hull): number {
  let totalCapacity = 100; // Base capacity for any ship
  if (!hull?.compartments) return totalCapacity;

  for (const c of hull.compartments as any[]) {
    if (c.type === 'CARGO') {
      const volume = getCompartmentVolume(c, hull.decks);
      const efficiency = 1.0 + (c.cargoConfig?.level || 0) * CARGO_UPGRADE_EFFICIENCY_STEP;
      totalCapacity += volume * CARGO_BASE_CAPACITY_PER_M3 * efficiency;
    }
  }
  return totalCapacity;
}

export function getReactorPower(hull: Hull): number {
  if (!hull?.compartments) return 0;
  let total = 0;
  for (const c of hull.compartments as any[]) {
    if (c.type === 'REACTOR') {
      const vol = getCompartmentVolume(c, hull.decks);
      const efficiency = 1.0 + (c.reactorConfig?.level || 0) * 0.2;
      total += vol * 50 * efficiency; // Adjusted scaling
    }
  }
  return total;
}

import { getCompartmentVolume, getShipMass } from './compartmentUtils';

export { getCompartmentVolume, getShipMass };

export function getEngineThrust(hull: Hull): number {
  let totalThrust = 0; // base thrust is 0 without engines
  if (!hull?.compartments) return 0;
  for (const c of hull.compartments) {
    if (c.type === 'ENGINE') {
      const vol = getCompartmentVolume(c, hull.decks);
      const level = c.engineConfig?.level || 0;
      totalThrust += vol * 10000 * (1 + level * 0.2); // F = ma ... volume * some large number
    }
  }
  return totalThrust;
}

export function getGyroTorque(hull: Hull): number {
  if (!hull?.compartments) return 0;
  let total = 0;
  for (const c of hull.compartments as any[]) {
    if (c.type === 'GYRO') {
      const vol = getCompartmentVolume(c, hull.decks);
      const level = c.gyroConfig?.level || 0;
      total += vol * 1875 * (1 + level * 0.2);
    }
  }
  return total;
}


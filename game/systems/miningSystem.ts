
import { ECS, Entity } from '../engine/ecs';
import { Camera, SECTOR_SIZE_M } from '../engine/camera';
import { Renderer } from '../engine/renderer';
import { StarSystem, AsteroidCluster } from '../world/generator';
import { Position, Hull, Inventory } from '../engine/types';
import { MINING_BEAM_RANGE_DEFAULT, MINING_BEAM_RATE_DEFAULT } from '../constants';
import type { GameEngine } from '../engine/GameEngine';

import { getCompartmentVolume } from '../compartmentUtils';

export function miningSystem(
  ecs: ECS, 
  engine: GameEngine,
  dt: number
) {
  const playerEntity = engine.player;
  if (playerEntity === null) return;

  const camera = engine.camera;
  const playerPos = ecs.getPosition(playerEntity)!;
  const playerHull = ecs.getHull(playerEntity)!;
  const playerInv = ecs.getComponent<Inventory>(playerEntity, 'Inventory')!;

  // 1. Reset mining states on all compartments first
  playerHull.compartments.forEach(c => {
    if (c.type === 'MINING') {
      (c as any).isMiningActive = false;
      (c as any).miningTargetPos = null;
    }
  });

  // 2. Mode gating: Only mine if interactionMode is 'MINING'
  if (engine.interactionMode !== 'MINING') {
      engine.miningTargetId = null;
      engine.targetAsteroidId = null;
      engine.targetingStartTime = 0;
      return;
  }

  // Find mining compartments
  const miningComps = playerHull.compartments.filter(c => c.type === 'MINING' && !c.isBuilding);
  if (miningComps.length === 0) return;

  // Global inventory space check
  let currentTotal = Object.values(playerInv.resources).reduce((a, b) => a + b, 0);
  if (currentTotal >= playerInv.maxCapacity - 0.001) return;

  // Only check asteroids within a reasonable range (50km) to avoid performance degradation
  const rangeMargin = 50000;
  const sSize = Number(SECTOR_SIZE_M);
  const playerWorldX = Number(playerPos.sectorX) * sSize + playerPos.offsetX;
  const playerWorldY = Number(playerPos.sectorY) * sSize + playerPos.offsetY;

  const visibleAsteroids = engine.asteroidGrid.getVisibleAsteroids(
      playerWorldX - rangeMargin, playerWorldY - rangeMargin,
      playerWorldX + rangeMargin, playerWorldY + rangeMargin
  );
  const lockedTarget = engine.miningTargetId ? visibleAsteroids.find(a => a.id === engine.miningTargetId) : null;
  
  if (engine.miningTargetId && (!lockedTarget || lockedTarget.depleted)) {
      engine.miningTargetId = null;
  }

  // ONLY proceed if we have an explicit locked target
  if (lockedTarget === null || lockedTarget === undefined) return;

  const SECTOR_SIZE = 10_000_000_000;
  // Use a clamped dt to prevent huge extraction spikes during lag
  // dt is frame-ratio (1.0 = ~16.6ms), so we divide by 60 to get units per second extraction
  const safeDt = Math.min(dt, 5.0);
  const dtSeconds = safeDt / 60.0;

  for (const comp of miningComps) {
    const config = (comp as any).miningConfig;
    const level = config?.level || 0;
    const baseRange = config?.range || MINING_BEAM_RANGE_DEFAULT;
    // Tie range strictly to compartment level
    const range = baseRange * (1 + level * 0.2);

    let target: any = null;

    const dx = Number(lockedTarget.sectorX - playerPos.sectorX) * SECTOR_SIZE + (lockedTarget.offsetX - playerPos.offsetX);
    const dy = Number(lockedTarget.sectorY - playerPos.sectorY) * SECTOR_SIZE + (lockedTarget.offsetY - playerPos.offsetY);
    const worldDist = Math.hypot(dx, dy);
    
    if (worldDist < range) {
        target = lockedTarget;
    }

    if (target) {
      // Mark compartment as active for rendering
      (comp as any).isMiningActive = true;
      (comp as any).miningTargetPos = {
        sectorX: target.sectorX,
        sectorY: target.sectorY,
        offsetX: target.offsetX,
        offsetY: target.offsetY
      };

      // Recalculate space available
      currentTotal = Object.values(playerInv.resources).reduce((a, b) => a + b, 0);
      const spaceLeft = Math.max(0, playerInv.maxCapacity - currentTotal);
      if (spaceLeft <= 0.0001) continue;

      const vol = getCompartmentVolume(comp, playerHull.decks);
      const baseRate = vol * 0.2; // 0.2 tons per second per m3 of compiler volume? Sure.
      // Level scaling: +50% per level
      const miningRate = baseRate * (1 + level * 0.5);
      const totalRateThisFrame = miningRate * dtSeconds;
      
      const asteroidResources = target.resources as Record<string, number>;
      const totalInAsteroid = Object.values(asteroidResources).reduce((a, b) => a + b, 0);
      
      // Resource depletion visuals initialization
      if (target.originalRadius === undefined) {
          target.originalRadius = target.radius;
          target.originalCapacity = target.totalCapacity || totalInAsteroid;
          if (target.originalCapacity <= 0) target.originalCapacity = 0.001;
      }

      if (totalInAsteroid > 0) {
          // Take proportionately from all resources in the asteroid
          // But cap the total taken by the mining speed and remaining space
          const actualToTakeTotal = Math.min(totalRateThisFrame, totalInAsteroid, spaceLeft);
          
          if (actualToTakeTotal > 0) {
              for (const [res, amount] of Object.entries(asteroidResources)) {
                const proportion = totalInAsteroid > 0 ? amount / totalInAsteroid : 1;
                const resToTake = actualToTakeTotal * proportion;
                
                playerInv.resources[res] = (playerInv.resources[res] || 0) + resToTake;
                asteroidResources[res] -= resToTake;
              }
          }
          
          const remaining = Object.values(asteroidResources).reduce((a, b) => a + b, 0);
          const actualRatio = Math.max(0, remaining / target.originalCapacity);
          target.radius = target.originalRadius * Math.pow(actualRatio, 1/3);

          if (remaining <= 0.01) {
            target.depleted = true;
            target.depletedAt = Date.now();
            if (engine.miningTargetId === target.id) engine.miningTargetId = null;
          }
      }
    }
  }
}

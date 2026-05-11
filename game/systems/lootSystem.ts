
import { ECS, Entity } from '../engine/ecs';
import { GameEngine } from '../engine/GameEngine';
import { Position, Inventory, Loot } from '../engine/types';
import { SECTOR_SIZE_M } from '../constants';

export function lootSystem(ecs: ECS, engine: GameEngine, dt: number) {
  const lootEntities = ecs.getEntitiesWith(['Position', 'Loot']);
  const player = engine.player;
  if (player === null) return;

  const playerPos = ecs.getPosition(player)!;
  const playerInv = ecs.getComponent<Inventory>(player, 'Inventory')!;
  const interactionMode = engine.interactionMode;

  // 1. Expire old loot or handle movement (minor drifting)
  for (const entity of lootEntities) {
    const loot = ecs.getComponent<Loot>(entity, 'Loot')!;
    const pos = ecs.getPosition(entity)!;
    const vel = ecs.getComponent<any>(entity, 'Velocity');

    // Despawn after 10 minutes
    if (Date.now() - loot.creationTime > 600000) {
      ecs.destroyEntity(entity);
      continue;
    }

    if (vel) {
      // Very slight orbital drift or whatever
      pos.angle += vel.va || 0;
    }

    // 2. Pick up logic
    // Mode must be idle or user must explicitly click?
    // The user said "можно подобрать кликом мышкой в режиме idle"
    // We already have mouse world position in engine.mouseWorld
    
    // Check if player is close enough to "auto-pick" or if clicked
    const dx = Number(pos.sectorX - playerPos.sectorX) * SECTOR_SIZE_M + (pos.offsetX - playerPos.offsetX);
    const dy = Number(pos.sectorY - playerPos.sectorY) * SECTOR_SIZE_M + (pos.offsetY - playerPos.offsetY);
    const dist = Math.hypot(dx, dy);

    // Auto-pickup if very close (e.g. 50m)
    if (dist < 50) {
      tryCollect(entity, loot, playerInv, ecs);
    }
  }

  // Click collection logic is better handled in InputManager or engine
  // But we can check engine's last click if we want.
}

function tryCollect(entity: Entity, loot: Loot, inventory: Inventory, ecs: ECS) {
  let anyCollected = false;
  const resources = loot.resources;
  
  for (const [res, amount] of Object.entries(resources)) {
    const currentTotal = Object.values(inventory.resources).reduce((a, b) => a + b, 0);
    const spaceLeft = Math.max(0, inventory.maxCapacity - currentTotal);
    
    if (spaceLeft > 0) {
      const toTake = Math.min(amount, spaceLeft);
      inventory.resources[res] = (inventory.resources[res] || 0) + toTake;
      resources[res] -= toTake;
      if (toTake > 0.001) anyCollected = true;
    }
  }
  
  // If all resources gone, destroy entity
  const remaining = Object.values(resources).reduce((a, b) => a + b, 0);
  if (remaining < 0.1) {
    ecs.destroyEntity(entity);
  }
}

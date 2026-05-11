
import { GlobalCoords } from '../../../components/game/types';
import { Position, Velocity } from '../../systems';
import type { GameEngine } from '../GameEngine';

export class LootManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public spawnLoot(pos: GlobalCoords, resources: Record<string, number>) {
    const lootEntity = this.engine.ecs.createEntity();
    this.engine.ecs.addComponent<Position>(lootEntity, 'Position', {
      sectorX: pos.sectorX,
      sectorY: pos.sectorY,
      offsetX: pos.offsetX,
      offsetY: pos.offsetY,
      angle: 0
    });
    this.engine.ecs.addComponent<Velocity>(lootEntity, 'Velocity', { vx: 0, vy: 0, va: (Math.random() - 0.5) * 0.1 });
    this.engine.ecs.addComponent(lootEntity, 'Loot', {
      resources: { ...resources },
      creationTime: Date.now()
    });
    return lootEntity;
  }

  public tryPickUpLoot(mouseX: number, mouseY: number) {
    if (this.engine.player === null) return;
    const cw = this.engine.renderer.width;
    const ch = this.engine.renderer.height;
    
    const lootEntities = this.engine.ecs.getEntitiesWith(['Position', 'Loot']);
    for (const entity of lootEntities) {
      const pos = this.engine.ecs.getPosition(entity)!;
      const screenPos = this.engine.camera.worldToScreen(pos, cw, ch);
      
      const dist = Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY);
      if (dist < 20) {
        const loot = this.engine.ecs.getComponent<any>(entity, 'Loot')!;
        const inv = this.engine.ecs.getComponent<any>(this.engine.player, 'Inventory')!;
        
        let anyCollected = false;
        for (const [res, amount] of Object.entries(loot.resources)) {
          const currentTotal = Object.values(inv.resources).reduce((a: any, b: any) => a + b, 0) as number;
          const spaceLeft = Math.max(0, inv.maxCapacity - currentTotal);
          if (spaceLeft > 0) {
            const toTake = Math.min(amount as number, spaceLeft);
            inv.resources[res] = (inv.resources[res] || 0) + toTake;
            loot.resources[res] = (loot.resources[res] as number) - toTake;
            if (toTake > 0.001) anyCollected = true;
          }
        }
        
        const remaining = Object.values(loot.resources).reduce((a: any, b: any) => a + b, 0) as number;
        if (remaining < 0.1) {
          this.engine.ecs.destroyEntity(entity);
        }
        if (anyCollected) return true;
      }
    }
    return false;
  }
}

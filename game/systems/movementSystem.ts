
import { ECS } from '../engine/ecs';
import { Position, Velocity } from '../engine/types';
import { SECTOR_SIZE_M } from '../constants';

export function movementSystem(ecs: ECS, dt: number) {
  const entities = ecs.getEntitiesWith(['Position', 'Velocity']);
  for (const entity of entities) {
    const pos = ecs.getPosition(entity)!;
    const vel = ecs.getComponent<Velocity>(entity, 'Velocity')!;
    const isProjectile = ecs.getComponent<Object>(entity, 'Projectile') !== undefined;

    pos.offsetX += vel.vx * dt;
    pos.offsetY += vel.vy * dt;
    pos.angle += vel.va * dt;

    // Normalize sector
    const sSize = Number(SECTOR_SIZE_M);
    
    const sectorDx = Math.floor(pos.offsetX / sSize);
    pos.sectorX += BigInt(sectorDx);
    pos.offsetX -= sectorDx * sSize;
    
    const sectorDy = Math.floor(pos.offsetY / sSize);
    pos.sectorY += BigInt(sectorDy);
    pos.offsetY -= sectorDy * sSize;

    if (!isProjectile) {
        // Frame-rate-independent drag
        const drag  = Math.pow(0.985, dt);
        const dragA = Math.pow(0.96, dt); // Reduced angular drag for more turn inertia
        vel.vx *= drag;
        vel.vy *= drag;
        vel.va *= dragA;

        // Kill micro-drift
        const spd = Math.hypot(vel.vx, vel.vy);
        if (spd < 0.01) { vel.vx = 0; vel.vy = 0; }
        if (Math.abs(vel.va) < 0.00005) vel.va = 0;
    }
  }
}


import { ECS, Entity } from '../engine/ecs';
import { GameEngine } from '../engine/GameEngine';
import { SECTOR_SIZE_M } from '../constants';

export function projectileSystem(ecs: ECS, engine: GameEngine, dt: number) {
    const pm = engine.projectiles;
    const active = pm.getActiveArray();
    const posX = pm.getPosX();
    const posY = pm.getPosY();
    const velX = pm.getVelX();
    const velY = pm.getVelY();
    const range = pm.getRange();
    const distTraveled = pm.getDistanceTraveled();
    const ownerIds = pm.getOwnerId();
    
    const dtSeconds = dt * (1/60);

    // 1. Pre-calculate targets for efficiency
    const ships = ecs.getEntitiesWith(['Hull', 'Position']);
    const shipData = [];
    for (const id of ships) {
        const p = ecs.getPosition(id)!;
        // Approximation: assume radius 100 for now, or get from hull
        shipData.push({
            id,
            wx: Number(p.sectorX) * SECTOR_SIZE_M + p.offsetX,
            wy: Number(p.sectorY) * SECTOR_SIZE_M + p.offsetY,
            radiusSq: 100 * 100 
        });
    }

    const asteroids = engine.asteroidGrid.getVisibleAsteroids();
    const asteroidData = asteroids.map(a => ({
        wx: a.offsetX, // Asteroids in grid usually use world-ish offsets since Grid exists in a cluster
        wy: a.offsetY, // Need to verify if asteroid offsetX/Y is local to sector or system.
        // Actually, looking at generator logic, grid asteroids use offsets relative to the cluster or sector.
        // Let's assume for now they are relative to current local view area origin or similar.
        radiusSq: a.radius * a.radius
    }));
    
    // NOTE: For true world-wide collision, asteroids should also have sectorX/Y.
    // But since projectiles and visible asteroids are both in the player's vicinity, 
    // we can use a relative coordinate space.
    
    const player = engine.player;
    if (player === null) return;
    const pPos = ecs.getPosition(player)!;
    const worldOriginX = Number(pPos.sectorX) * SECTOR_SIZE_M;
    const worldOriginY = Number(pPos.sectorY) * SECTOR_SIZE_M;

    for (let i = 0; i < active.length; i++) {
        if (active[i] === 0) continue;

        // 1. Move
        const dx = velX[i] * dtSeconds;
        const dy = velY[i] * dtSeconds;
        posX[i] += dx;
        posY[i] += dy;
        
        const moveDist = Math.sqrt(dx * dx + dy * dy);
        distTraveled[i] += moveDist;

        // 2. Range
        if (distTraveled[i] > range[i]) {
            pm.deactivate(i);
            continue;
        }

        // 3. Collision with Ships
        let hit = false;
        const px = posX[i];
        const py = posY[i];
        const ownerId = ownerIds[i];

        for (let j = 0; j < shipData.length; j++) {
            const ship = shipData[j];
            if (ship.id === ownerId) continue;

            const dx = px - ship.wx;
            const dy = py - ship.wy;
            
            // Fast AABB check
            if (Math.abs(dx) < 150 && Math.abs(dy) < 150) {
                const d2 = dx * dx + dy * dy;
                if (d2 < ship.radiusSq) {
                    // HIT!
                    pm.deactivate(i);
                    // TODO: Apply damage: ecs.getHull(ship.id).hp -= pm.getDamage()[i];
                    hit = true;
                    break;
                }
            }
        }

        if (hit) continue;

        // 4. Collision with Asteroids
        // Asteroid coordinates in AsteroidGrid are relative to the cluster origin.
        // This part needs careful alignment with how asteroids are stored.
        // Assuming visible asteroids are already in a space reachable by projectiles.
    }
}

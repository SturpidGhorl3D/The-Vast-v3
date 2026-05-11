import { ECS, Entity } from '../engine/ecs';
import { GameEngine } from '../engine/GameEngine';
import { Position, Weapon, TurretTarget, Velocity } from '../engine/types';
import { SECTOR_SIZE_M } from '../constants';
import { audioManager } from '../engine/AudioManager';

export function turretSystem(ecs: ECS, engine: GameEngine, dt: number) {
    if (engine.isPaused || engine.player === null) return;

    const player = engine.player;
    const playerPos = ecs.getPosition(player)!;
    const hull = ecs.getHull(player);
    if (hull === undefined || hull === null) return;

    for (const comp of hull.compartments) {
        if (comp.type !== 'WEAPON') continue;

        const weaponId = `weapon_${comp.id}`;
        const weapon = ecs.getComponent<Weapon>(player, weaponId);
        if (weapon === null || weapon === undefined || weapon.target === null) continue;

        // Active check
        const isActive = weapon.group === 'MAIN' ? engine.mainBatteryActive : (weapon.group === 'SECONDARY' ? engine.secondaryActive : engine.defenceActive);
        if (!isActive || weapon.isMining) continue;
        
        // Manual mode check (if a manual point is set to null, it may have been cleared)
        if (weapon.target !== null && weapon.target.type === 'MANUAL_POINT' && weapon.target.manualPoint === null) continue;

        const targetPoint = getTargetPoint(ecs, engine, playerPos, weapon.target);
        if (targetPoint === null) continue;

        rotateTurret(playerPos, hull, weapon, targetPoint, dt);

        if (weapon.autoFire && isAimed(playerPos, hull, weapon, targetPoint)) {
            tryFire(ecs, engine, player, weapon);
        }
    }
}

function getTargetPoint(ecs: ECS, engine: GameEngine, playerPos: Position, target: TurretTarget): { x: number, y: number } | null {
    if (target.type === 'ENTITY' && target.entityId !== undefined) {
        const tPos = ecs.getPosition(target.entityId);
        return tPos ? { x: tPos.offsetX, y: tPos.offsetY } : null;
    }
    
    if (target.type === 'MANUAL_POINT' && target.manualPoint) {
        return target.manualPoint;
    }

    if (target.type === 'RELATIVE_ANGLE' && target.angleOffset !== undefined) {
        const angle = playerPos.angle + target.angleOffset;
        return { 
            x: playerPos.offsetX + Math.cos(angle) * 1000, 
            y: playerPos.offsetY + Math.sin(angle) * 1000 
        };
    }
    
    return null;
}

function rotateTurret(playerPos: Position, hull: any, weapon: Weapon, targetPoint: { x: number, y: number }, dt: number) {
    const turretPos = getTurretWorldPos(playerPos, hull, weapon.turretId);
    const dx = targetPoint.x - turretPos.x;
    const dy = targetPoint.y - turretPos.y;
    
    const angleToTarget = Math.atan2(dy, dx);
    const desiredRelAngle = normalizeAngle(angleToTarget - playerPos.angle);
    
    const diff = normalizeAngle(desiredRelAngle - weapon.turretAngle);
    const rotationSpeed = (weapon.rotationSpeed || 0.05) * dt;
    
    if (Math.abs(diff) < rotationSpeed) {
        weapon.turretAngle = desiredRelAngle;
    } else {
        weapon.turretAngle += Math.sign(diff) * rotationSpeed;
    }
}

function isAimed(playerPos: Position, hull: any, weapon: Weapon, targetPoint: { x: number, y: number }): boolean {
    const turretPos = getTurretWorldPos(playerPos, hull, weapon.turretId);
    const dx = targetPoint.x - turretPos.x;
    const dy = targetPoint.y - turretPos.y;
    
    const angleToTarget = Math.atan2(dy, dx);
    const desiredRelAngle = normalizeAngle(angleToTarget - playerPos.angle);
    
    return Math.abs(normalizeAngle(desiredRelAngle - weapon.turretAngle)) < 0.1;
}

function tryFire(ecs: ECS, engine: GameEngine, owner: Entity, weapon: Weapon) {
    const now = Date.now();
    if (now - (weapon.lastFireTime || 0) >= weapon.reloadTime) {
        fireWeapon(ecs, engine, owner, weapon);
    }
}

function getTurretWorldPos(playerPos: Position, hull: any, turretId: string) {
    const comp = hull.compartments.find((c: any) => c.id === turretId);
    if (comp === undefined) return { x: playerPos.offsetX, y: playerPos.offsetY };
    
    const vs = comp.turretConfig?.visual || comp.miningConfig?.visual || { mountAttachmentPoint: { x: 0, y: 0 } };
    const baseCx = comp.x + (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0);
    const baseCy = comp.y + (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0);
    
    const rot = playerPos.angle;
    return {
        x: playerPos.offsetX + (baseCx * Math.cos(rot) - baseCy * Math.sin(rot)),
        y: playerPos.offsetY + (baseCx * Math.sin(rot) + baseCy * Math.cos(rot))
    };
}

function normalizeAngle(a: number) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function fireWeapon(ecs: ECS, engine: GameEngine, owner: Entity, weapon: Weapon) {
    weapon.lastFireTime = Date.now();
    const playerPos = ecs.getPosition(owner)!;
    const hull = ecs.getHull(owner)!;
    const weaponPos = getTurretWorldPos(playerPos, hull, weapon.turretId);
    const bType = weapon.group === 'MAIN' ? 0 : (weapon.group === 'SECONDARY' ? 1 : 2);
    
    switch (weapon.fireMode) {
        case 'ROUNDS':
            spawnBallistic(ecs, engine, owner, weaponPos, weapon, playerPos.angle + weapon.turretAngle, bType);
            audioManager.playProjectileSFX();
            break;
        case 'HOMING':
             spawnHoming(ecs, engine, owner, weaponPos, weapon, playerPos.angle + weapon.turretAngle, bType);
             audioManager.playRocketSFX();
             break;
        case 'BEAM':
             spawnBeam(ecs, engine, owner, weaponPos, weapon, playerPos.angle + weapon.turretAngle, bType);
             audioManager.playBeamSFX();
             break;
    }
}

function spawnBallistic(ecs: ECS, engine: GameEngine, owner: Entity, weaponPos: {x: number, y: number}, weapon: Weapon, absoluteAngle: number, bType: number) {
    const playerPos = ecs.getPosition(owner)!;
    // Calculate world position
    const worldX = Number(playerPos.sectorX) * SECTOR_SIZE_M + weaponPos.x;
    const worldY = Number(playerPos.sectorY) * SECTOR_SIZE_M + weaponPos.y;

    for (let i = 0; i < weapon.barrelCount; i++) {
        const spread = (Math.random() - 0.5) * 0.02;
        const angle = absoluteAngle + spread;
        
        const vx = Math.cos(angle) * weapon.projectileSpeed;
        const vy = Math.sin(angle) * weapon.projectileSpeed;

        engine.projectiles.spawn(
            worldX,
            worldY,
            vx,
            vy,
            weapon.damage,
            weapon.range,
            owner,
            bType,
            0 // BALLISTIC
        );
    }
}

function spawnHoming(ecs: ECS, engine: GameEngine, owner: Entity, weaponPos: {x: number, y: number}, weapon: Weapon, absoluteAngle: number, bType: number) {
    const playerPos = ecs.getPosition(owner)!;
    const worldX = Number(playerPos.sectorX) * SECTOR_SIZE_M + weaponPos.x;
    const worldY = Number(playerPos.sectorY) * SECTOR_SIZE_M + weaponPos.y;

    for (let i = 0; i < weapon.barrelCount; i++) {
        const vx = Math.cos(absoluteAngle) * weapon.projectileSpeed * 0.5;
        const vy = Math.sin(absoluteAngle) * weapon.projectileSpeed * 0.5;

        engine.projectiles.spawn(
            worldX,
            worldY,
            vx,
            vy,
            weapon.damage,
            weapon.range,
            owner,
            bType,
            2 // HOMING
        );
    }
}

function spawnBeam(ecs: ECS, engine: GameEngine, owner: Entity, weaponPos: {x: number, y: number}, weapon: Weapon, absoluteAngle: number, bType: number) {
    const playerPos = ecs.getPosition(owner)!;
    const worldX = Number(playerPos.sectorX) * SECTOR_SIZE_M + weaponPos.x;
    const worldY = Number(playerPos.sectorY) * SECTOR_SIZE_M + weaponPos.y;

    for (let i = 0; i < weapon.barrelCount; i++) {
        // Beam travels very fast
        const vx = Math.cos(absoluteAngle) * weapon.projectileSpeed * 2;
        const vy = Math.sin(absoluteAngle) * weapon.projectileSpeed * 2;

        engine.projectiles.spawn(
            worldX,
            worldY,
            vx,
            vy,
            weapon.damage,
            weapon.range,
            owner,
            bType,
            1 // BEAM
        );
    }
}

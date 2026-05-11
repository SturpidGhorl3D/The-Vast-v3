
import { ECS, Entity } from '../engine/ecs';
import { GameEngine } from '../engine/GameEngine';
import { Position, Velocity, Weapon, TurretTarget } from '../engine/types';
import { SECTOR_SIZE_M } from '../constants';

export function combatSystem(ecs: ECS, engine: GameEngine, dt: number) {
    if (engine.isPaused || engine.player === null) return;

    const player = engine.player;
    const playerPos = ecs.getPosition(player)!;
    const interactionMode = engine.interactionMode;

    if (interactionMode !== 'COMBAT') {
        engine.combatLockProgress = 0;
        return;
    }

    const hull = ecs.getHull(player);
    if (hull === undefined || hull === null) return;

    const shipRotation = playerPos.angle;

    // 1. Identify weapon groups
    const weaponGroups: Record<string, { componentName: string, weapon: Weapon }[]> = {
        MAIN: [],
        SECONDARY: [],
        DEFENCE: []
    };

    for (const comp of hull.compartments) {
        if (comp.type === 'WEAPON') {
            const weaponId = `weapon_${comp.id}`;
            const weapon = ecs.getComponent<Weapon>(player, weaponId);
            if (weapon) {
                weaponGroups[weapon.group].push({ componentName: weaponId, weapon });
            }
        }
    }

    // 2. Handle Targeting Progress (Lock-on / Fixed Angle / Target Designation)
    handleTargeting(ecs, engine, dt);

    // Only calculate manual angle for visual reference if necessary
    const isMainManual = !engine.fireGroupSemiAuto['MAIN'];
    
    if (engine.interactionMode === 'COMBAT' && isMainManual) {
      const playerPos = ecs.getPosition(engine.player)!;
      const dx = engine.mouseWorld.offsetX - playerPos.offsetX + Number(BigInt(engine.mouseWorld.sectorX) - BigInt(playerPos.sectorX)) * Number(SECTOR_SIZE_M);
      const dy = engine.mouseWorld.offsetY - playerPos.offsetY + Number(BigInt(engine.mouseWorld.sectorY) - BigInt(playerPos.sectorY)) * Number(SECTOR_SIZE_M);
      const angleToMouse = Math.atan2(dy, dx);
      engine.lastManualAngle = normalizeAngle(angleToMouse - playerPos.angle);
    } else {
      engine.lastManualAngle = null;
    } 

    // 3. Process each group

    for (const group of ['MAIN', 'SECONDARY', 'DEFENCE'] as const) {
        const weapons = weaponGroups[group];
        if (weapons.length === 0) continue;

        const isActive = group === 'MAIN' ? engine.mainBatteryActive : (group === 'SECONDARY' ? engine.secondaryActive : engine.defenceActive);
        if (isActive === false) continue;

        const isSemiAuto = group === 'MAIN' ? engine.fireGroupSemiAuto[group] : true; 
        const isSync = group === 'DEFENCE' ? false : engine.fireGroupSync[group];
        
        let targetPoint: { x: number, y: number } | null = null;
        let isReadyToFire = false;

        // Determine target for the group
        if (group === 'MAIN') {
            if (isSemiAuto) {
                // AUTO/SEMI-AUTO MAIN
                // Target list has priority, then relative fire point
                let foundTarget = false;
                
                if (engine.designatedTargets && engine.designatedTargets.length > 0) {
                    for (const dId of engine.designatedTargets) {
                        const tPos = ecs.getPosition(dId);
                        if (tPos && getDistance(playerPos, tPos) <= weapons[0].weapon.range) {
                            targetPoint = { x: tPos.offsetX, y: tPos.offsetY };
                            isReadyToFire = true;
                            foundTarget = true;
                            break;
                        }
                    }
                }
                
                if (!foundTarget && engine.relativeFirePointOffset) {
                    const offset = engine.relativeFirePointOffset;
                    targetPoint = { 
                        x: playerPos.offsetX + offset.x, 
                        y: playerPos.offsetY + offset.y 
                    };
                    isReadyToFire = true;
                    foundTarget = true;
                }

                if (!foundTarget && engine.combatTargetId) {
                    const tPos = ecs.getPosition(engine.combatTargetId);
                    if (tPos && getDistance(playerPos, tPos) <= weapons[0].weapon.range) {
                        targetPoint = { x: tPos.offsetX, y: tPos.offsetY };
                        isReadyToFire = true;
                        foundTarget = true;
                    }
                }
            } else {
                // MANUAL MAIN: follows mouse
                if (engine.interactionMode === 'COMBAT') {
                    const dx = engine.mouseWorld.offsetX - playerPos.offsetX + Number(BigInt(engine.mouseWorld.sectorX) - BigInt(playerPos.sectorX)) * Number(SECTOR_SIZE_M);
                    const dy = engine.mouseWorld.offsetY - playerPos.offsetY + Number(BigInt(engine.mouseWorld.sectorY) - BigInt(playerPos.sectorY)) * Number(SECTOR_SIZE_M);
                    targetPoint = { x: playerPos.offsetX + dx, y: playerPos.offsetY + dy };
                    isReadyToFire = engine.inputManager.isKeyDown('LMB');
                }
            }
        } else {
            // SECONDARY & DEFENCE: Autonomous
            // 1. Check if any designated target is in range
            let localTarget: Entity | null = null;
            
            for (const dtEntity of engine.designatedTargets) {
                const dtPos = ecs.getPosition(dtEntity);
                if (dtPos) {
                    const d = getDistance(playerPos, dtPos);
                    if (d <= weapons[0].weapon.range) {
                        localTarget = dtEntity;
                        break;
                    }
                }
            }

            // 2. If no designated in range, use current lock if exists
            if (localTarget === null && engine.combatTargetId !== null) {
                const tPos = ecs.getPosition(engine.combatTargetId);
                if (tPos && getDistance(playerPos, tPos) <= weapons[0].weapon.range) {
                   localTarget = engine.combatTargetId;
                }
            }

            // 3. Fallback: find nearest
            if (localTarget === null) {
               localTarget = findNearestEnemy(ecs, engine, playerPos, weapons[0].weapon.range);
            }

            if (localTarget) {
                const tPos = ecs.getPosition(localTarget);
                if (tPos) {
                    targetPoint = { x: tPos.offsetX, y: tPos.offsetY };
                    isReadyToFire = true;
                }
            }
        }

        // 4. Set target for the group
        if (targetPoint) {
            for (const w of weapons) {
                // Determine target type based on how targetPoint was derived
                let target: TurretTarget;
                if (group === 'MAIN' && !isSemiAuto) {
                    target = { type: 'MANUAL_POINT', manualPoint: targetPoint };
                } else if (engine.combatTargetId) {
                    target = { type: 'ENTITY', entityId: engine.combatTargetId };
                } else if (engine.combatFireAngle !== null) {
                    target = { type: 'RELATIVE_ANGLE', angleOffset: engine.combatFireAngle };
                } else {
                    target = { type: 'MANUAL_POINT', manualPoint: targetPoint };
                }
                w.weapon.target = target;
                w.weapon.autoFire = isReadyToFire;
            }
        } else {
            // Idling
            for (const w of weapons) {
                w.weapon.target = { type: 'RELATIVE_ANGLE', angleOffset: 0 };
                w.weapon.autoFire = false;
            }
        }
    }
}

function findNearestEnemy(ecs: ECS, engine: GameEngine, pos: Position, range: number): Entity | null {
    const enemies = ecs.getEntitiesWith(['Position', 'Faction', 'Hull']);
    let nearest: Entity | null = null;
    let minDist = range;

    for (const enemy of enemies) {
        if (enemy === engine.player) continue;
        const ePos = ecs.getPosition(enemy)!;
        const d = getDistance(pos, ePos);
        if (d < minDist) {
            minDist = d;
            nearest = enemy;
        }
    }
    return nearest;
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
    weapon.fireCounter = 0; // RESET COUNTER
    const playerPos = ecs.getPosition(owner)!;
    const hull = ecs.getHull(owner)!;
    const weaponPos = getTurretWorldPos(playerPos, hull, weapon.turretId);
    const absoluteAngle = playerPos.angle + weapon.turretAngle;

    for (let i = 0; i < weapon.barrelCount; i++) {
        const proj = ecs.createEntity();
        const spread = (Math.random() - 0.5) * 0.02;
        const angle = absoluteAngle + spread;
        
        ecs.addComponent<Position>(proj, 'Position', {
            sectorX: playerPos.sectorX,
            sectorY: playerPos.sectorY,
            offsetX: weaponPos.x,
            offsetY: weaponPos.y,
            angle: angle
        });

        ecs.addComponent<Velocity>(proj, 'Velocity', {
            vx: Math.cos(angle) * weapon.projectileSpeed,
            vy: Math.sin(angle) * weapon.projectileSpeed,
            va: 0
        });

        ecs.addComponent(proj, 'Projectile', {
            ownerId: owner,
            damage: weapon.damage,
            speed: weapon.projectileSpeed,
            range: weapon.range,
            distanceTraveled: 0,
            type: 'BALLISTIC'
        });
    }
}

function handleTargeting(ecs: ECS, engine: GameEngine, dt: number) {
    const mouseWorld = engine.mouseWorld;
    
    // Find enemies near mouse
    const entities = ecs.getEntitiesWith(['Position', 'Hull']); 
    let hoverEntity: Entity | null = null;
    let minHoverDist = 100 / engine.camera.zoom; 

    for (const entity of entities) {
        if (entity === engine.player) continue;
        const pos = ecs.getPosition(entity)!;
        const dx = pos.offsetX - mouseWorld.offsetX + Number(BigInt(pos.sectorX) - BigInt(mouseWorld.sectorX)) * Number(SECTOR_SIZE_M);
        const dy = pos.offsetY - mouseWorld.offsetY + Number(BigInt(pos.sectorY) - BigInt(mouseWorld.sectorY)) * Number(SECTOR_SIZE_M);
        const dist = Math.hypot(dx, dy);
        if (dist < minHoverDist) {
            hoverEntity = entity;
            minHoverDist = dist;
        }
    }

    const isMainManual = !engine.fireGroupSemiAuto['MAIN'];

    if (engine.inputManager.isKeyDown('LMB')) {
        // In manual mode, we don't trigger locking logic on mouse click
        if (isMainManual) {
            engine.combatLockProgress = 0;
            engine.combatLockTarget = null;
            return;
        }

        // Only start lock if targetDesignationMode is on
        if (!engine.targetDesignationMode) {
            engine.combatLockProgress = 0;
            return;
        }

        if (hoverEntity !== engine.combatLockTarget) {
            engine.combatLockProgress = 0;
            engine.combatLockTarget = hoverEntity;
        }

        engine.combatLockProgress += dt / 60; // 1s = 60 frames approx
        
        const threshold = hoverEntity === null ? 2 : 3; // 2s for empty space, 3s for entity
        
        if (engine.combatLockProgress >= threshold) {
            if (hoverEntity !== null) {
                // Add to designated list if not already there
                if (!engine.designatedTargets.includes(hoverEntity)) {
                    engine.designatedTargets.push(hoverEntity);
                }
            } else {
                // Set relative fire point offset
                const playerPos = ecs.getPosition(engine.player!)!;
                const dx = mouseWorld.offsetX - playerPos.offsetX + Number(BigInt(mouseWorld.sectorX) - BigInt(playerPos.sectorX)) * Number(SECTOR_SIZE_M);
                const dy = mouseWorld.offsetY - playerPos.offsetY + Number(BigInt(mouseWorld.sectorY) - BigInt(playerPos.sectorY)) * Number(SECTOR_SIZE_M);
                engine.relativeFirePointOffset = { x: dx, y: dy };
                engine.relativeFirePoint = { ...mouseWorld }; // Keep for UI/Reference
            }
            engine.combatLockProgress = -1; // Flag handled
        }
    } else {
        if (engine.combatLockProgress > 0) {
            engine.combatLockProgress = Math.max(0, engine.combatLockProgress - dt / 15);
        } else if (engine.combatLockProgress === -1) {
            engine.combatLockProgress = 0;
            engine.combatLockTarget = null;
        }
    }
}

function getDistance(p1: Position, p2: Position) {
    const dx = p1.offsetX - p2.offsetX + Number(BigInt(p1.sectorX) - BigInt(p2.sectorX)) * Number(SECTOR_SIZE_M);
    const dy = p1.offsetY - p2.offsetY + Number(BigInt(p1.sectorY) - BigInt(p2.sectorY)) * Number(SECTOR_SIZE_M);
    return Math.sqrt(dx * dx + dy * dy);
}

import { ECS, Entity } from '../engine/ecs';
import { Position, Velocity, AIState, AIBehavior, Faction } from '../engine/types';
import { globalFactionManager } from '../world/FactionManager';

const MAX_SPEED = 50;
const ACCELERATION = 20;
const ROTATION_SPEED = Math.PI; // 180 deg / sec

function distance(p1: Position, p2: Position) {
    const dx = p1.offsetX - p2.offsetX + Number(p1.sectorX - p2.sectorX) * 10000;
    const dy = p1.offsetY - p2.offsetY + Number(p1.sectorY - p2.sectorY) * 10000;
    return Math.sqrt(dx * dx + dy * dy);
}

function angleTowards(p1: Position, p2: Position) {
   const dx = p2.offsetX - p1.offsetX + Number(p2.sectorX - p1.sectorX) * 10000;
   const dy = p2.offsetY - p1.offsetY + Number(p2.sectorY - p1.sectorY) * 10000;
   return Math.atan2(dy, dx);
}

function normalizeAngle(a: number) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

export function aiSystem(ecs: ECS, dt: number) {
    const entities = ecs.getEntitiesWith(['AIState', 'Position', 'Velocity']);

    for (const entity of entities) {
        const state = ecs.getComponent<AIState>(entity, 'AIState');
        const pos = ecs.getComponent<Position>(entity, 'Position');
        const vel = ecs.getComponent<Velocity>(entity, 'Velocity');
        const faction = ecs.getComponent<Faction>(entity, 'Faction');

        if (!state || !pos || !vel) continue;

        // Decrease timer if any
        if (state.timer !== undefined && state.timer > 0) {
            state.timer -= dt;
        }

        switch(state.behavior) {
            case AIBehavior.IDLE:
                // Process tasks queue if any
                if (state.tasks && state.tasks.length > 0 && (state.timer === undefined || state.timer <= 0)) {
                    const task = state.tasks[0];
                    if (task.type === 'MOVE' && task.targetPos) {
                        state.roamTarget = { ...task.targetPos, angle: 0 };
                        state.behavior = AIBehavior.ROAMING;
                        state.timer = 0;
                        break;
                    } else if (task.type === 'ORBIT' && task.targetPos) {
                        // Dummy orbit setup by converting to ROAMING to target
                        state.roamTarget = { ...task.targetPos, angle: 0 };
                        state.behavior = AIBehavior.ROAMING;
                        break;
                    } else {
                        // Unimplemented task, skip
                        state.tasks.shift();
                    }
                }

                // Just drift or slow down
                vel.vx *= 0.95;
                vel.vy *= 0.95;
                vel.va *= 0.95;
                if (state.timer !== undefined && state.timer <= 0 && (!state.tasks || state.tasks.length === 0)) {
                     state.behavior = AIBehavior.ROAMING;
                }
                break;
                
            case AIBehavior.ROAMING:
                // Find a roam target if none
                if (!state.roamTarget) {
                    state.roamTarget = {
                        sectorX: pos.sectorX,
                        sectorY: pos.sectorY,
                        offsetX: pos.offsetX + (Math.random() - 0.5) * 5000,
                        offsetY: pos.offsetY + (Math.random() - 0.5) * 5000,
                        angle: 0
                    };
                }

                const dist = distance(pos, state.roamTarget);
                if (dist < 100) {
                    state.roamTarget = null;
                    state.behavior = AIBehavior.IDLE;
                    state.timer = 1 + Math.random();
                    vel.vx *= 0.8;
                    vel.vy *= 0.8;
                    
                    if (state.tasks && state.tasks.length > 0 && state.tasks[0].type === 'MOVE') {
                        state.tasks.shift(); // complete task
                        state.timer = 0; // instantly process next task
                    }
                } else {
                    const targetAngle = angleTowards(pos, state.roamTarget);
                    const angleDiff = normalizeAngle(targetAngle - pos.angle);
                    
                    vel.va = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff) * 5, ROTATION_SPEED);
                    
                    // Move forward if reasonably aligned
                    if (Math.abs(angleDiff) < 0.5) {
                        vel.vx = Math.cos(pos.angle) * MAX_SPEED;
                        vel.vy = Math.sin(pos.angle) * MAX_SPEED;
                    } else {
                        vel.vx *= 0.95;
                        vel.vy *= 0.95;
                    }
                }
                
                // Aggro check: if hostile faction nearby
                if (faction) {
                   const others = ecs.getEntitiesWith(['Position', 'Faction']);
                   for (const other of others) {
                       if (other === entity) continue;
                       const otherFaction = ecs.getComponent<Faction>(other, 'Faction');
                       if (otherFaction && globalFactionManager.getRelation(faction.id, otherFaction.id) === 'HOSTILE') {
                           const otherPos = ecs.getComponent<Position>(other, 'Position');
                           if (otherPos && distance(pos, otherPos) < 2000) {
                               state.behavior = AIBehavior.ATTACKING;
                               state.targetEntity = other;
                               break;
                           }
                       }
                   }
                }
                break;
                
            case AIBehavior.ATTACKING:
                if (state.targetEntity !== undefined && state.targetEntity !== null) {
                    const targetPos = ecs.getComponent<Position>(state.targetEntity, 'Position');
                    if (!targetPos) {
                        state.behavior = AIBehavior.ROAMING;
                        state.targetEntity = null;
                        break;
                    }
                    
                    const tDist = distance(pos, targetPos);
                    if (tDist > 3000) {
                        // Lost target
                        state.behavior = AIBehavior.ROAMING;
                        state.targetEntity = null;
                        break;
                    }
                    
                    const tAngle = angleTowards(pos, targetPos);
                    const tAngleDiff = normalizeAngle(tAngle - pos.angle);
                    vel.va = Math.sign(tAngleDiff) * Math.min(Math.abs(tAngleDiff) * 10, ROTATION_SPEED);
                    
                    // Simple maintain distance behavior
                    if (Math.abs(tAngleDiff) < 0.3) {
                        if (tDist > 500) {
                            vel.vx = Math.cos(pos.angle) * MAX_SPEED;
                            vel.vy = Math.sin(pos.angle) * MAX_SPEED;
                        } else if (tDist < 200) {
                            vel.vx = -Math.cos(pos.angle) * MAX_SPEED;
                            vel.vy = -Math.sin(pos.angle) * MAX_SPEED;
                        } else {
                            vel.vx *= 0.95;
                            vel.vy *= 0.95;
                        }
                    }
                    
                    // TODO: Firing logic
                } else {
                    state.behavior = AIBehavior.ROAMING;
                }
                break;
        }
    }
}


import { Entity, ECS } from '../ecs';
import { Velocity, Position, getEngineThrust, getGyroTorque } from '../../systems';
import { GlobalCoords, MovementMode, ViewMode } from '../../../components/game/types';
import { 
  SECTOR_SIZE_M, 
  SHIP_WARP_RAMP_RATE, 
  SHIP_ACCEL_RAMP_RATE, 
  WARP_ACCEL_MULT,
  SHIP_MAX_SPEED_WARP
} from '../../constants';
import { getShipMass } from '../../compartmentUtils';
import type { GameEngine } from '../GameEngine';

export class MovementManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public handleMovement(dt: number) {
    const { player, ecs, inputManager, viewMode, movementMode } = this.engine;
    const keys = inputManager.keys;
    if (player === null) return;

    const pos = ecs.getPosition(player)!;
    const vel = ecs.getComponent<Velocity>(player, 'Velocity')!;
    
    this.handleGravityWell(pos, dt);

    const hull = ecs.getHull(player)!;
    const hasWarp = hull?.compartments?.some((c: any) => c.type === 'WARP_ENGINE');

    const force = getEngineThrust(hull);
    const torque = getGyroTorque(hull);
    const mass = getShipMass(hull) || 1000;
    
    const baseAccel = force / mass;
    const isWarping  = hasWarp && keys.has('Tab');
    const rampRate = isWarping ? SHIP_WARP_RAMP_RATE : SHIP_ACCEL_RAMP_RATE;
    
    if (viewMode === 'LOCAL' && (keys.has('KeyW') || keys.has('KeyS'))) {
      this.engine.thrust = Math.min(1, this.engine.thrust + rampRate * dt);
    } else {
      this.engine.thrust = Math.max(0, this.engine.thrust - rampRate * 4 * dt);
      if (this.engine.thrust < 0.005) this.engine.thrust = 0;
    }
    const throttle = this.engine.thrust;

    const limitSpeed = isWarping ? SHIP_MAX_SPEED_WARP : (baseAccel * 150);
    const currentSpeed = Math.hypot(vel.vx, vel.vy);
    const burstFactor = Math.max(1.0, 5.0 * (1.0 - Math.min(1.0, currentSpeed / Math.max(1, limitSpeed))));

    let accel = baseAccel * throttle * burstFactor;
    if (isWarping) accel = baseAccel * throttle * WARP_ACCEL_MULT;
    const turnAccel = (torque / mass) * 0.1;

    if (viewMode === 'LOCAL') {
      if (keys.has('KeyW')) {
        vel.vx += Math.cos(pos.angle) * accel;
        vel.vy += Math.sin(pos.angle) * accel;
        const newSpeed = Math.hypot(vel.vx, vel.vy);
        if (newSpeed > limitSpeed) {
           vel.vx = (vel.vx / newSpeed) * limitSpeed;
           vel.vy = (vel.vy / newSpeed) * limitSpeed;
        }
      }
      if (keys.has('KeyS')) {
        const fwdDot = vel.vx * Math.cos(pos.angle) + vel.vy * Math.sin(pos.angle);
        if (fwdDot > 0) {
          vel.vx -= Math.cos(pos.angle) * Math.min(accel, fwdDot);
          vel.vy -= Math.sin(pos.angle) * Math.min(accel, fwdDot);
        }
      }
      
      if (keys.has('KeyA')) {
          vel.va -= turnAccel * dt;
      } else if (keys.has('KeyD')) {
          vel.va += turnAccel * dt;
      } else {
          if (Math.abs(vel.va) < 0.001) vel.va = 0;
          else vel.va *= Math.pow(0.95, dt);
      }
      
      if (!keys.has('KeyW') && !keys.has('KeyS')) {
          const speed = Math.hypot(vel.vx, vel.vy);
          if (speed < 0.1) {
              vel.vx = 0;
              vel.vy = 0;
          }
      }
    }

    if (movementMode === 'TACTICAL' && this.engine.tacticalRoute.length > 0) {
      this.processTacticalRoute(pos, vel, baseAccel, turnAccel, dt);
    }
  }

  public handleGravityWell(pos: any, dt: number) {
    if (this.engine.currentGravityWell && this.engine.currentSystem) {
        const wellTarget = this.engine.currentGravityWell.target;
        const objRadius = wellTarget.radius || 1000;
        
        const posNow = this.engine.getCelestialLocalPos(wellTarget, this.engine.currentTime);
        
        if (!this.engine.currentGravityWell.lastLocalPos) {
            this.engine.currentGravityWell.lastLocalPos = posNow;
        }

        const dx_ship = posNow.x - this.engine.currentGravityWell.lastLocalPos.x;
        const dy_ship = posNow.y - this.engine.currentGravityWell.lastLocalPos.y;
        this.engine.currentGravityWell.lastLocalPos = posNow;

        pos.offsetX += dx_ship;
        pos.offsetY += dy_ship;

        const secSize = Number(SECTOR_SIZE_M);
        const secDxW = Number(BigInt(pos.sectorX) - BigInt(this.engine.currentSystem.sectorX));
        const secDyW = Number(BigInt(pos.sectorY) - BigInt(this.engine.currentSystem.sectorY));
        
        const dxW = secDxW * secSize + (pos.offsetX - (this.engine.currentSystem.offsetX + posNow.x));
        const dyW = secDyW * secSize + (pos.offsetY - (this.engine.currentSystem.offsetY + posNow.y));
        
        const distToPlanet = Math.hypot(dxW, dyW);
        
        if (distToPlanet > objRadius * 25) {
            this.engine.currentGravityWell = null;
        } else {
            for (let i = 0; i < this.engine.tacticalRoute.length; i++) {
                if (i === 0 && (this.engine.followTarget || this.engine.orbitTarget)) continue;
                
                this.engine.tacticalRoute[i].offsetX += dx_ship;
                this.engine.tacticalRoute[i].offsetY += dy_ship;
                
                const sSize = Number(SECTOR_SIZE_M);
                const sdx = Math.floor(this.engine.tacticalRoute[i].offsetX / sSize);
                this.engine.tacticalRoute[i].sectorX += BigInt(sdx);
                this.engine.tacticalRoute[i].offsetX -= sdx * sSize;
                const sdy = Math.floor(this.engine.tacticalRoute[i].offsetY / sSize);
                this.engine.tacticalRoute[i].sectorY += BigInt(sdy);
                this.engine.tacticalRoute[i].offsetY -= sdy * sSize;
            }

            if (this.engine.viewMode !== 'LOCAL') {
                this.engine.mapPos.offsetX += dx_ship;
                this.engine.mapPos.offsetY += dy_ship;
                const sSize = Number(SECTOR_SIZE_M);
                const sdx = Math.floor(this.engine.mapPos.offsetX / sSize);
                this.engine.mapPos.sectorX += BigInt(sdx);
                this.engine.mapPos.offsetX -= sdx * sSize;
                const sdy = Math.floor(this.engine.mapPos.offsetY / sSize);
                this.engine.mapPos.sectorY += BigInt(sdy);
                this.engine.mapPos.offsetY -= sdy * sSize;
            }
        }
    }
  }

  public processTacticalRoute(pos: any, vel: any, baseAccel: number, turnAccel: number, dt: number) {
    const wp = this.engine.tacticalRoute[0];
    const rel = this.engine.camera.getRelativePos(wp);
    const playerRel = this.engine.camera.getRelativePos(pos);
    const dx = rel.x - playerRel.x;
    const dy = rel.y - playerRel.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 200) {
      this.engine.tacticalRoute.shift();
    } else {
      const tactAccel = baseAccel * 0.6;
      const targetAngle = Math.atan2(dy, dx);
      const angleDiff = ((targetAngle - pos.angle) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      vel.va += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff) * 0.3, turnAccel * 5);
      
      const currentSpeed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      const stopDist = (currentSpeed * currentSpeed) / (2 * tactAccel * 0.8);
      
      if (Math.abs(angleDiff) < 0.4) {
        if (dist > stopDist + 100) {
          vel.vx += Math.cos(pos.angle) * tactAccel;
          vel.vy += Math.sin(pos.angle) * tactAccel;
        } else {
          const fwdDot = vel.vx * Math.cos(pos.angle) + vel.vy * Math.sin(pos.angle);
          if (fwdDot > 0) {
            vel.vx -= Math.cos(pos.angle) * Math.min(tactAccel, fwdDot);
            vel.vy -= Math.sin(pos.angle) * Math.min(tactAccel, fwdDot);
          }
        }
      }
    }
  }
}


import { GlobalCoords } from '../../../components/game/types';
import { SECTOR_SIZE_M } from '../../constants';
import type { GameEngine } from '../GameEngine';

export class CelestialManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  /**
   * Calculates the current position of a celestial body (planet, satellite, star, station)
   * relative to its parent system center in meters.
   */
  public getCelestialLocalPos(obj: any, time: number): { x: number, y: number } {
    const now = time * 0.001;
    const sys = this.engine.currentSystem;
    if (!sys) return { x: 0, y: 0 };

    let baseX = 0;
    let baseY = 0;

    let centerId = obj.orbitCenterId;
    if (!centerId && obj.orbitTarget) {
      centerId = obj.orbitTarget;
    }

    if (centerId && centerId !== 'barycenter' && centerId !== 'star') {
      const parentObj = sys.stars?.find((s: any) => s.id === centerId) ||
                        sys.planets?.find((p: any) => p.id === centerId) ||
                        sys.planets?.flatMap((p: any) => p.satellites || []).find((s: any) => s.id === centerId);
      
      if (parentObj && parentObj.id !== obj.id) {
        const pPos = this.getCelestialLocalPos(parentObj, time);
        baseX = pPos.x;
        baseY = pPos.y;
      }
    } else if (!centerId) {
      // Find implicit parent for satellites
      if (sys.planets) {
        for (let i = 0; i < sys.planets.length; i++) {
          const p = sys.planets[i];
          if (p.satellites?.some((s: any) => s.id === obj.id)) {
            const pPos = this.getCelestialLocalPos(p, time);
            baseX = pPos.x;
            baseY = pPos.y;
            break;
          }
        }
      }
    }

    const radius = obj.orbitRadius || 0;
    if (radius === 0) return { x: baseX, y: baseY };

    const speed = obj.orbitSpeed || 0;
    const angle = obj.orbitAngle || 0;
    // We add angle directly instead of index
    return {
      x: baseX + Math.cos(now * speed * 10 + angle) * radius,
      y: baseY + Math.sin(now * speed * 10 + angle) * radius
    };
  }

  public getDynamicTargetPos(target: any): GlobalCoords | null {
    const secSizeBI = BigInt(SECTOR_SIZE_M);
    
    if (target.type === 'SHIP' && target.entity !== undefined) {
      const pos = this.engine.ecs.getPosition(target.entity);
      return pos ? { ...pos } : null;
    }
    
    const sys = target.parentSystem || this.engine.currentSystem;
    if (sys) {
      if (target.type === 'STAR') {
        return { sectorX: sys.sectorX, sectorY: sys.sectorY, offsetX: sys.offsetX, offsetY: sys.offsetY };
      }

      const localPos = this.getCelestialLocalPos(target, this.engine.currentTime);
      const res = {
        sectorX: sys.sectorX,
        sectorY: sys.sectorY,
        offsetX: sys.offsetX + localPos.x,
        offsetY: sys.offsetY + localPos.y
      };
      this.engine.camera.normalize(res);
      return res;
    }
    return null;
  }
}

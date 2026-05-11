
import { BaseRenderer } from './BaseRenderer';
import { Camera } from '../camera';
import { SECTOR_SIZE_M } from '../../constants';

export class ProjectileRenderer extends BaseRenderer {
    public draw(engine: any, camera: Camera, width: number, height: number) {
        const pm = engine.projectiles;
        if (!pm) return;
        
        const active = pm.getActiveArray();
        const posX = pm.getPosX();
        const posY = pm.getPosY();
        const velX = pm.getVelX();
        const velY = pm.getVelY();
        const bTypes = pm.getBatteryType();
        
        const pTypes = pm.getProjType();
        
        const camPos = camera.pos;
        const camWorldX = Number(camPos.sectorX) * SECTOR_SIZE_M + camPos.offsetX;
        const camWorldY = Number(camPos.sectorY) * SECTOR_SIZE_M + camPos.offsetY;
        
        const zoom = camera.zoom;
        const halfW = width / 2;
        const halfH = height / 2;

        // Base styles per battery type
        const baseStyles = [
            { color: 0xffff00 }, // MAIN
            { color: 0x00ffff }, // SECONDARY
            { color: 0xff4444 }, // DEFENCE
            { color: 0xffffff }
        ];

        for (let i = 0; i < active.length; i++) {
            if (active[i] === 0) continue;
            
            const relX = posX[i] - camWorldX;
            const relY = posY[i] - camWorldY;
            
            const sx = relX * zoom + halfW;
            const sy = relY * zoom + halfH;
            
            if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) continue;
            
            const bType = bTypes[i];
            const pType = pTypes[i];
            const style = baseStyles[bType < 3 ? bType : 3];

            const vx = velX[i];
            const vy = velY[i];
            const speedSq = vx * vx + vy * vy;
            if (speedSq <= 0) continue;

            const speed = Math.sqrt(speedSq);
            const dirX = vx / speed;
            const dirY = vy / speed;

            if (pType === 1) { // BEAM
                const len = 80 * zoom;
                this.graphics.beginPath();
                this.graphics.moveTo(sx, sy);
                this.graphics.lineTo(sx - dirX * len, sy - dirY * len);
                this.graphics.stroke({ color: style.color, width: 1.5 * zoom, alpha: 0.6 });
                
                // Inner core
                this.graphics.beginPath();
                this.graphics.moveTo(sx, sy);
                this.graphics.lineTo(sx - dirX * len * 0.8, sy - dirY * len * 0.8);
                this.graphics.stroke({ color: 0xffffff, width: 0.8 * zoom, alpha: 0.9 });
            } else if (pType === 2) { // HOMING
                const len = 30 * zoom;
                const width = 4 * zoom;
                this.graphics.beginPath();
                this.graphics.moveTo(sx, sy);
                this.graphics.lineTo(sx - dirX * len, sy - dirY * len);
                this.graphics.stroke({ color: 0xffaa00, width: width, alpha: 0.5 });
                
                this.graphics.beginPath();
                this.graphics.circle(sx, sy, 2 * zoom);
                this.graphics.fill({ color: 0xffffff, alpha: 0.9 });
            } else { // BALLISTIC
                const len = 40 * zoom;
                this.graphics.beginPath();
                this.graphics.moveTo(sx, sy);
                this.graphics.lineTo(sx - dirX * len, sy - dirY * len);
                this.graphics.stroke({ color: style.color, width: 2 * zoom, alpha: 0.9 });
            }
        }
    }
}


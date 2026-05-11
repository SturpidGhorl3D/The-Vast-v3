
import { GlobalCoords } from '../../components/game/types';

export const SECTOR_SIZE_M = BigInt(10_000_000_000);

export class Camera {
  // Global coordinates
  pos: GlobalCoords = { sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 };
  
  zoom: number = 1;
  angle: number = 0;
  
  targetPos: GlobalCoords = { sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 };
  targetZoom: number = 1;
  targetAngle: number = 0;
  smoothing: number = 0.1;

  setPos(coords: GlobalCoords) {
    this.pos = { ...coords };
    this.targetPos = { ...coords };
  }

  setTargetPos(coords: GlobalCoords) {
    this.targetPos = { ...coords };
  }

  setTargetAngle(v: number) { this.targetAngle = v; }
  setAngle(v: number) { this.angle = v; }
  setZoom(v: number) { this.zoom = v; }
  setTargetZoom(v: number) { this.targetZoom = v; }

  update(maxLag?: number) {
    // Smoothly interpolate offsetX/offsetY
    const dx = Number(BigInt(this.targetPos.sectorX) - BigInt(this.pos.sectorX)) * Number(SECTOR_SIZE_M) + (this.targetPos.offsetX - this.pos.offsetX);
    const dy = Number(BigInt(this.targetPos.sectorY) - BigInt(this.pos.sectorY)) * Number(SECTOR_SIZE_M) + (this.targetPos.offsetY - this.pos.offsetY);
    
    this.pos.offsetX += dx * this.smoothing;
    this.pos.offsetY += dy * this.smoothing;
    
    // If maxLag is provided, ensure we don't lag more than that
    if (maxLag !== undefined && maxLag > 0) {
      const currentDx = Number(BigInt(this.targetPos.sectorX) - BigInt(this.pos.sectorX)) * Number(SECTOR_SIZE_M) + (this.targetPos.offsetX - this.pos.offsetX);
      const currentDy = Number(BigInt(this.targetPos.sectorY) - BigInt(this.pos.sectorY)) * Number(SECTOR_SIZE_M) + (this.targetPos.offsetY - this.pos.offsetY);
      const dist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
      if (dist > maxLag) {
        const factor = (dist - maxLag) / dist;
        this.pos.offsetX += currentDx * factor;
        this.pos.offsetY += currentDy * factor;
      }
    }
    
    this.normalize(this.pos);
    
    this.zoom += (this.targetZoom - this.zoom) * this.smoothing;
    if (this.zoom < 1e-18) this.zoom = 1e-18;
    this.angle += (this.targetAngle - this.angle) * this.smoothing;
  }

  normalize(coords: GlobalCoords) {
    const sSize = Number(SECTOR_SIZE_M);
    
    const sectorDx = Math.floor(coords.offsetX / sSize);
    coords.sectorX += BigInt(sectorDx);
    coords.offsetX -= sectorDx * sSize;
    
    const sectorDy = Math.floor(coords.offsetY / sSize);
    coords.sectorY += BigInt(sectorDy);
    coords.offsetY -= sectorDy * sSize;
  }

  screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): GlobalCoords {
    const dx = (screenX - canvasWidth / 2) / this.zoom;
    const dy = (screenY - canvasHeight / 2) / this.zoom;
    
    // Un-rotate
    const rotX = dx * Math.cos(this.angle) - dy * Math.sin(this.angle);
    const rotY = dx * Math.sin(this.angle) + dy * Math.cos(this.angle);
    
    const worldCoords: GlobalCoords = {
      sectorX: this.pos.sectorX,
      sectorY: this.pos.sectorY,
      offsetX: this.pos.offsetX + rotX,
      offsetY: this.pos.offsetY + rotY
    };
    
    this.normalize(worldCoords);
    return worldCoords;
  }

  screenToLocal(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const dx = (screenX - canvasWidth / 2) / this.zoom;
    const dy = (screenY - canvasHeight / 2) / this.zoom;
    
    // Un-rotate
    const rotX = dx * Math.cos(this.angle) - dy * Math.sin(this.angle);
    const rotY = dx * Math.sin(this.angle) + dy * Math.cos(this.angle);
    
    // Calculate total offset from sector (0,0) origin
    const totalX = Number(BigInt(this.pos.sectorX)) * Number(SECTOR_SIZE_M) + this.pos.offsetX + rotX;
    const totalY = Number(BigInt(this.pos.sectorY)) * Number(SECTOR_SIZE_M) + this.pos.offsetY + rotY;
    
    return { x: totalX, y: totalY };
  }

  getRelativePos(target: GlobalCoords): { x: number; y: number } {
    if (!target || target.sectorX === undefined || this.pos.sectorX === undefined) {
      return { x: 0, y: 0 };
    }
    const secDx = Number(BigInt(target.sectorX) - BigInt(this.pos.sectorX));
    const secDy = Number(BigInt(target.sectorY) - BigInt(this.pos.sectorY));
    
    const dx = secDx * Number(SECTOR_SIZE_M) + ((target.offsetX ?? 0) - (this.pos.offsetX ?? 0));
    const dy = secDy * Number(SECTOR_SIZE_M) + ((target.offsetY ?? 0) - (this.pos.offsetY ?? 0));
    return { x: dx, y: dy };
  }

  worldToScreen(target: GlobalCoords, canvasWidth: number, canvasHeight: number) {
    const rel = this.getRelativePos(target);
    
    const rotX = rel.x * Math.cos(-this.angle) - rel.y * Math.sin(-this.angle);
    const rotY = rel.x * Math.sin(-this.angle) + rel.y * Math.cos(-this.angle);

    return {
      x: rotX * this.zoom + canvasWidth / 2,
      y: rotY * this.zoom + canvasHeight / 2,
    };
  }

  // For PixiJS, we often want coordinates relative to camera in world units, 
  // then Pixi handles the rest (or we handle it in a container)
  getPixiCoords(target: GlobalCoords): { x: number; y: number } {
    return this.getRelativePos(target);
  }
}

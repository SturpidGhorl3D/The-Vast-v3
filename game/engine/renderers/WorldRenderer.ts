
import { BaseRenderer } from './BaseRenderer';
import { Camera } from '../camera';
import { GlobalCoords } from '../../../components/game/types';
import { ASTEROID_CHUNK_SIZE } from '../../world/AsteroidGridManager';
import { SECTOR_SIZE_M } from '../camera';

import * as BABYLON from '@babylonjs/core';
import { CelestialRenderer } from './CelestialRenderer';

export class WorldRenderer extends BaseRenderer {
  private celestialRenderer: CelestialRenderer | null = null;
  private scene: BABYLON.Scene | null = null;
  
  private noiseTex: BABYLON.DynamicTexture | null = null;
  private noiseMat: BABYLON.StandardMaterial | null = null;
  private noiseMesh: BABYLON.Mesh | null = null;

  constructor(graphics: any, scene?: BABYLON.Scene) {
    super(graphics);
    if (scene) {
       this.scene = scene;
       this.initNoiseMap(scene);
    }
  }

  public setCelestialRenderer(celestial: CelestialRenderer) {
    this.celestialRenderer = celestial;
  }
  
  public setScene(scene: BABYLON.Scene) {
      this.scene = scene;
      this.initNoiseMap(scene);
  }

  public setApp(app: any) {
     // No-op, was used for PIXI
  }

  private initNoiseMap(scene: BABYLON.Scene) {
     if (this.noiseMesh) return;
     this.noiseMesh = BABYLON.MeshBuilder.CreatePlane("noiseMap", {size: 1}, scene);
     this.noiseMat = new BABYLON.StandardMaterial("noiseMat", scene);
     this.noiseMat.disableLighting = true;
     this.noiseMat.useAlphaFromDiffuseTexture = true;
     this.noiseMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
     this.noiseMesh.material = this.noiseMat;
     this.noiseMesh.isVisible = false;
  }

  public updateAsteroidInstances(asteroids: any[], camera: Camera, width: number, height: number, now: number, targetId: string | null = null, miningTargetId: string | null = null) {
    const zoom = camera.zoom;
    const isZoomedOut = zoom < 0.05;
    const isVeryZoomedOut = zoom < 0.01;

    // Cache pre-calculated camera constants
    const halfW = width / 2;
    const halfH = height / 2;
    const camX = camera.pos.offsetX;
    const camY = camera.pos.offsetY;
    const camSecX = camera.pos.sectorX;
    const camSecY = camera.pos.sectorY;
    const cosA = Math.cos(-camera.angle);
    const sinA = Math.sin(-camera.angle);
    const secSize = Number(SECTOR_SIZE_M);

    // Limit number of rendered asteroids to prevent GPU overload
    const maxAsteroids = 2000;
    let count = 0;

    for (let i = 0; i < asteroids.length && count < maxAsteroids; i++) {
      const ast = asteroids[i];
      if (ast.depleted) continue;

      // LOD: Faster skips
      if (isVeryZoomedOut && ast.radius < 1000) continue;
      if (isZoomedOut && ast.radius < 400) continue;

      const screenRadius = ast.radius * zoom;
      if (screenRadius < 0.5) continue;

      const dx = Number(ast.sectorX - camSecX) * secSize + (ast.offsetX - camX);
      const dy = Number(ast.sectorY - camSecY) * secSize + (ast.offsetY - camY);
      
      const rotX = dx * cosA - dy * sinA;
      const rotY = dx * sinA + dy * cosA;
      
      const sx = rotX * zoom + halfW;
      const sy = rotY * zoom + halfH;

      if (sx + screenRadius < -50 || sx - screenRadius > width + 50 ||
          sy + screenRadius < -50 || sy - screenRadius > height + 50) {
        continue;
      }

      count++;
      
      const isTarget = ast.id === targetId || ast.id === miningTargetId;
      
      // Setup appearance
      const numColor = this.colorToNumber(ast.color);
      
      const isGlobal = zoom < 0.005;
      let finalRadius = screenRadius;
      if (isTarget && !isGlobal) {
        finalRadius = Math.max(screenRadius, 3.0);
      }
      
      const alpha = Math.min(1.0, Math.max(0, (screenRadius - 0.5) / (5.0 - 0.5)));
      
      this.graphics.circle(sx, sy, finalRadius);
      this.graphics.fill({ color: isTarget ? 0xffffaa : numColor, alpha });
      
      if (isTarget) {
          const sz = finalRadius * 1.5;
          this.graphics.moveTo(sx - sz, sy); this.graphics.lineTo(sx - sz/2, sy);
          this.graphics.moveTo(sx + sz, sy); this.graphics.lineTo(sx + sz/2, sy);
          this.graphics.moveTo(sx, sy - sz); this.graphics.lineTo(sx, sy - sz/2);
          this.graphics.moveTo(sx, sy + sz); this.graphics.lineTo(sx, sy + sz/2);
          this.graphics.stroke({ color: 0xff4444, width: 2, alpha: 1 });
      }
    }
  }

  public removeAsteroidInstance(id: string) {
    // Handled by re-rendering
  }

  public clearAllAsteroidInstances() {
    // Handled by Graphics2D clear
  }

  public drawStar(data: any, camera: Camera, width: number, height: number, isGlobal: boolean, now: number) {
    if (this.celestialRenderer && !isGlobal) {
      const handled = this.celestialRenderer.drawCelestial(data, camera, width, height, now / 1000);
      if (handled) return;
    }

    const coords = { 
      sectorX: data.sectorX ?? 0n, 
      sectorY: data.sectorY ?? 0n, 
      offsetX: data.offsetX ?? 0, 
      offsetY: data.offsetY ?? 0 
    };
    const radius = data.starRadius;
    const color = data.starColor;

    const screen = camera.worldToScreen(coords, width, height);
    const screenRadius = radius * camera.zoom;
    const screenX = screen.x;
    const screenY = screen.y;

    if (screenX + screenRadius * 8.0 < 0 || screenX - screenRadius * 8.0 > width ||
        screenY + screenRadius * 8.0 < 0 || screenY - screenRadius * 8.0 > height) {
      return;
    }

    const colorNum = this.colorToNumber(color);

    if (isGlobal) {
      const alpha = Math.min(1, screenRadius * 0.5);
      if (alpha < 0.005) return;
      this.graphics.circle(screenX, screenY, Math.max(1, screenRadius));
      this.graphics.fill({ color: colorNum, alpha });
      return;
    }

    // Fallback: draw 4-pointed tactical marker if too small for WebGPU
    this.drawTacticalMarker(screenX, screenY, colorNum, 5);
  }

  public drawLoot(pos: GlobalCoords, camera: Camera, width: number, height: number) {
    const screen = camera.worldToScreen(pos, width, height);
    if (!screen || screen.x < 0 || screen.x > width || screen.y < 0 || screen.y > height) return;
    
    // Draw white dots using base graphics circle
    this.graphics.circle(screen.x, screen.y, 1.5);
    this.graphics.fill({ color: 0xffffff, alpha: 0.8 });
    
    // If very close, draw a small halo
    if (camera.zoom > 10) {
      this.graphics.circle(screen.x, screen.y, 3);
      this.graphics.fill({ color: 0xffffff, alpha: 0.2 });
    }
  }

  public drawPlanet(data: any, camera: Camera, width: number, height: number, now: number, lightDir: {x: number, y: number} = {x: 0, y: 0}) {
    if (this.celestialRenderer) {
      const handled = this.celestialRenderer.drawCelestial(data, camera, width, height, now / 1000, lightDir);
      if (handled) return;
    }

    const coords = { 
      sectorX: data.sectorX ?? 0n, 
      sectorY: data.sectorY ?? 0n, 
      offsetX: data.offsetX ?? 0, 
      offsetY: data.offsetY ?? 0 
    };
    const radius = data.radius;
    const color = data.color;

    const screen = camera.worldToScreen(coords, width, height);
    const screenRadius = radius * camera.zoom;
    const screenX = screen.x;
    const screenY = screen.y;

    if (screenX + screenRadius < -100 || screenX - screenRadius > width + 100 ||
        screenY + screenRadius < -100 || screenY - screenRadius > height + 100) {
      return;
    }

    const alpha = Math.min(1, screenRadius * 1.5);
    if (alpha <= 0.01) return;

    if (screenRadius < 4.0) {
      this.drawTacticalMarker(screenX, screenY, this.colorToNumber(color), 3);
    } else {
      this.drawLargeCircle(screenX, screenY, Math.max(0.5, screenRadius), this.colorToNumber(color), alpha);
    }
  }

  public drawAsteroidRing(
    coords: GlobalCoords,
    minRadius: number,
    maxRadius: number,
    camera: Camera,
    width: number,
    height: number,
    now: number
  ) {
    const screen = camera.worldToScreen(coords, width, height);
    const screenMin = minRadius * camera.zoom;
    const screenMax = maxRadius * camera.zoom;

    if (screen.x + screenMax < 0 || screen.x - screenMax > width ||
        screen.y + screenMax < 0 || screen.y - screenMax > height) {
      return;
    }

    if (screenMax < 1.0) return;

    const midRadius = (screenMin + screenMax) / 2;
    const thickness = Math.max(1.0, screenMax - screenMin);

    // Draw using simple alpha line
    this.graphics.circle(screen.x, screen.y, midRadius);
    // Draw dashed-like stroke if zoomed in enough, else solid alpha
    if (thickness > 2) {
      this.graphics.stroke({ color: 0xaa8866, width: thickness, alpha: 0.2 });
    } else {
      this.graphics.stroke({ color: 0xaa8866, width: Math.max(1, thickness), alpha: 0.1 });
    }
  }

  public drawSpaceStation(coords: GlobalCoords, camera: Camera, width: number, height: number, color: string) {
    const screen = camera.worldToScreen(coords, width, height);
    const renderSize = Math.max(4, 1000 * camera.zoom); // Base size 1000m, but keep visible at high zoom

    if (screen.x + renderSize < -100 || screen.x - renderSize > width + 100 ||
        screen.y + renderSize < -100 || screen.y - renderSize > height + 100) {
      return;
    }

    const colorNum = this.colorToNumber(color);
    
    this.graphics.moveTo(screen.x, screen.y - renderSize);
    this.graphics.lineTo(screen.x + renderSize, screen.y);
    this.graphics.lineTo(screen.x, screen.y + renderSize);
    this.graphics.lineTo(screen.x - renderSize, screen.y);
    this.graphics.closePath();
    this.graphics.fill({ color: colorNum });
    this.graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
    
    // Draw a small dot in center
    this.graphics.circle(screen.x, screen.y, renderSize * 0.3);
    this.graphics.fill({ color: 0xffffff });
  }

  public drawAsteroid(asteroid: any, cluster: any, camera: Camera, width: number, height: number, isMarked: boolean = false, isMiningTarget: boolean = false) {
    let coords;
    if (asteroid.sectorX !== undefined) {
      coords = {
        sectorX: asteroid.sectorX,
        sectorY: asteroid.sectorY,
        offsetX: asteroid.offsetX,
        offsetY: asteroid.offsetY
      };
    } else {
      coords = {
        sectorX: cluster.sectorX,
        sectorY: cluster.sectorY,
        offsetX: cluster.offsetX + asteroid.rx,
        offsetY: cluster.offsetY + asteroid.ry
      };
    }
    
    const screen = camera.worldToScreen(coords, width, height);
    let screenRadius = asteroid.radius * camera.zoom;

    if (isMarked || isMiningTarget) {
      screenRadius = Math.max(screenRadius, 2);
    } else if (screenRadius < 0.5) {
      return;
    }

    if (screen.x + screenRadius < 0 || screen.x - screenRadius > width ||
        screen.y + screenRadius < 0 || screen.y - screenRadius > height) {
      return;
    }

    const colorNum = this.colorToNumber(asteroid.color);
    
    if (isMiningTarget) {
      this.graphics.circle(screen.x, screen.y, screenRadius * 1.5);
      this.graphics.stroke({ color: 0xff4444, width: 2, alpha: 0.8 });
      // Draw crosshair corners
      const sz = screenRadius * 2;
      this.graphics.moveTo(screen.x - sz, screen.y); this.graphics.lineTo(screen.x - sz/2, screen.y);
      this.graphics.moveTo(screen.x + sz, screen.y); this.graphics.lineTo(screen.x + sz/2, screen.y);
      this.graphics.moveTo(screen.x, screen.y - sz); this.graphics.lineTo(screen.x, screen.y - sz/2);
      this.graphics.moveTo(screen.x, screen.y + sz); this.graphics.lineTo(screen.x, screen.y + sz/2);
      this.graphics.stroke({ color: 0xff4444, width: 1, alpha: 1 });
    }

    if (isMarked) {
      this.graphics.circle(screen.x, screen.y, screenRadius * 1.5);
      this.graphics.fill({ color: 0x00ffcc, alpha: 0.4 });
      this.graphics.circle(screen.x, screen.y, screenRadius);
      this.graphics.fill({ color: 0x00ffcc });
    } else {
      const rng = this.createStaticRNG(asteroid.id);
      const sides = 5 + Math.floor(rng() * 5);
      this.graphics.moveTo(screen.x + screenRadius, screen.y);
      for (let i = 1; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = screenRadius * (0.7 + rng() * 0.4);
        this.graphics.lineTo(screen.x + Math.cos(angle) * r, screen.y + Math.sin(angle) * r);
      }
      this.graphics.closePath();
      this.graphics.fill({ color: colorNum });
      
      if (screenRadius > 5) {
        this.graphics.circle(screen.x + screenRadius * 0.3, screen.y - screenRadius * 0.3, screenRadius * 0.2);
        this.graphics.fill({ color: 0x000000, alpha: 0.2 });
      }
    }
  }

  public drawAsteroidCluster(cluster: any, camera: Camera, width: number, height: number, isFaint: boolean = false) {
    // Re-implemented to draw Hexagonal Chunk Territory
    // cluster here is actually a HexChunk object passed from renderUtils
    const cx = cluster.cx || 0; 
    const cy = cluster.cy || 0;
    
    // Coarse chunks represent a large area - render as soft technical blobs for better performance
    if (cluster.isCoarse) {
        const s = cluster.size || (1_000_000 * 10);
        const coords = { sectorX: 0n, sectorY: 0n, offsetX: cx, offsetY: cy };
        camera.normalize(coords);
        const screen = camera.worldToScreen(coords, width, height);
        const size = s * camera.zoom;
        
        if (size < 1) return;
        
        // Solid fast circle for coarse view - grey and more transparent per user request
        this.graphics.circle(screen.x, screen.y, size * 0.5);
        this.graphics.fill({ color: 0x444444, alpha: 0.1 });
        return;
    }

    // High fidelity Hexagonal Territory rendering
    const s = ASTEROID_CHUNK_SIZE + 20;
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const px = cx + s * Math.cos(angle);
        const py = cy + s * Math.sin(angle);
        const coords = { sectorX: 0n, sectorY: 0n, offsetX: px, offsetY: py };
        camera.normalize(coords);
        points.push(camera.worldToScreen(coords, width, height));
    }

    // Draw the main area
    this.graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) this.graphics.lineTo(points[i].x, points[i].y);
    this.graphics.closePath();
    
    // Fill with a subtle technological pattern (blue-grey and more transparent)
    const fillAlpha = isFaint ? 0.05 : 0.12;
    this.graphics.fill({ color: 0x224466, alpha: fillAlpha });
    
    // No technical outline per user request - removing stroke logic
  }

  private noiseCanvas: HTMLCanvasElement | null = null;
  private noiseCtx: CanvasRenderingContext2D | null = null;

  public updateAsteroidNoiseMap(buffer: Uint8Array, width: number, height: number) {
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) return;
    if (!this.noiseCanvas) {
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCanvas.width = width;
        this.noiseCanvas.height = height;
        this.noiseCtx = this.noiseCanvas.getContext('2d');
        if (!this.noiseCtx || !this.scene) return;
        
        this.noiseTex = new BABYLON.DynamicTexture("noiseTex", {width, height}, this.scene, false);
        if (this.noiseMat) {
           this.noiseMat.diffuseTexture = this.noiseTex;
           this.noiseMat.emissiveTexture = this.noiseTex;
        }
    }

    if (this.noiseCanvas.width !== width || this.noiseCanvas.height !== height) {
        this.noiseCanvas.width = width;
        this.noiseCanvas.height = height;
        if (this.noiseTex) this.noiseTex.dispose();
        if (this.scene) {
            this.noiseTex = new BABYLON.DynamicTexture("noiseTex", {width, height}, this.scene, false);
            if (this.noiseMat) {
                this.noiseMat.diffuseTexture = this.noiseTex;
                this.noiseMat.emissiveTexture = this.noiseTex;
            }
        }
    }

    const imgData = new ImageData(Math.max(1, width), Math.max(1, height));
    imgData.data.set(new Uint8ClampedArray(buffer));
    this.noiseCtx!.putImageData(imgData, 0, 0);
    
    if (this.noiseTex) {
        this.noiseTex.update();
    }
  }

  public drawAsteroidNoiseMap(camera: Camera, width: number, height: number, minX: number, minY: number, maxX: number, maxY: number) {
    if (!this.noiseMesh || isNaN(width) || isNaN(height) || isNaN(minX) || isNaN(minY)) return;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    const center = { sectorX: 0n, sectorY: 0n, offsetX: midX, offsetY: midY };
    camera.normalize(center);

    const screenCenter = camera.worldToScreen(center, width, height);

    this.noiseMesh.position.x = screenCenter.x;
    this.noiseMesh.position.y = -screenCenter.y;
    this.noiseMesh.position.z = 1.0; // Render behind 2D stuff
    this.noiseMesh.scaling.x = (maxX - minX) * camera.zoom;
    this.noiseMesh.scaling.y = -(maxY - minY) * camera.zoom;
    this.noiseMesh.rotation.z = camera.angle;
    
    const visualAlpha = Math.max(0.3, 1 - camera.zoom * 1.5);
    if (this.noiseMat) {
       this.noiseMat.alpha = visualAlpha;
    }
    this.noiseMesh.isVisible = visualAlpha > 0.05;
  }

  private drawTacticalMarker(x: number, y: number, colorNum: number, size: number) {
    const outer = size * 1.5;
    const inner = size * 0.4;
    
    this.graphics.beginPath();
    this.graphics.moveTo(x, y - outer);
    this.graphics.lineTo(x + inner, y - inner);
    this.graphics.lineTo(x + outer, y);
    this.graphics.lineTo(x + inner, y + inner);
    this.graphics.lineTo(x, y + outer);
    this.graphics.lineTo(x - inner, y + inner);
    this.graphics.lineTo(x - outer, y);
    this.graphics.lineTo(x - inner, y - inner);
    this.graphics.closePath();
    this.graphics.fill({ color: colorNum, alpha: 0.9 });
  }

  private drawLargeCircle(x: number, y: number, radius: number, color: number, alpha: number = 1) {
    if (radius < 2000) {
      this.graphics.circle(x, y, radius);
    } else {
      const segments = 128;
      const step = (Math.PI * 2) / segments;
      this.graphics.moveTo(x + radius, y);
      for (let i = 1; i <= segments; i++) {
        this.graphics.lineTo(x + Math.cos(i * step) * radius, y + Math.sin(i * step) * radius);
      }
      this.graphics.closePath();
    }
    this.graphics.fill({ color, alpha });
  }

  public drawGrid(camera: Camera, width: number, height: number, spacing: number) {
    if (!spacing || spacing <= 0 || isNaN(spacing)) return;
    
    const color = 0x1a2a3a;
    const zoom = camera.zoom;
    if (!zoom || zoom <= 0 || isNaN(zoom)) return;

    const diag = Math.hypot(width, height) / zoom;
    
    // Safety check: if we are trying to draw more than 2000 lines, it will most likely
    // cause performance issues or "Invalid array length" error in PIXI buffers.
    if (diag / spacing > 2000) return;

    const startX = Math.floor(-diag / 2 / spacing) * spacing;
    const startY = Math.floor(-diag / 2 / spacing) * spacing;
    const endX = -startX;
    const endY = -startY;

    const offsetX = camera.pos.offsetX % spacing;
    const offsetY = camera.pos.offsetY % spacing;

    const cosA = Math.cos(-camera.angle);
    const sinA = Math.sin(-camera.angle);

    for (let x = startX; x <= endX; x += spacing) {
      const rx = x - offsetX;
      const ry1 = startY - offsetY;
      const ry2 = endY - offsetY;
      const rotX1 = rx * cosA - ry1 * sinA;
      const rotY1 = rx * sinA + ry1 * cosA;
      const rotX2 = rx * cosA - ry2 * sinA;
      const rotY2 = rx * sinA + ry2 * cosA;
      this.graphics.moveTo(rotX1 * zoom + width / 2, rotY1 * zoom + height / 2);
      this.graphics.lineTo(rotX2 * zoom + width / 2, rotY2 * zoom + height / 2);
    }

    for (let y = startY; y <= endY; y += spacing) {
      const ry = y - offsetY;
      const rx1 = startX - offsetX;
      const rx2 = endX - offsetX;
      const rotX1 = rx1 * cosA - ry * sinA;
      const rotY1 = rx1 * sinA + ry * cosA;
      const rotX2 = rx2 * cosA - ry * sinA;
      const rotY2 = rx2 * sinA + ry * cosA;
      this.graphics.moveTo(rotX1 * zoom + width / 2, rotY1 * zoom + height / 2);
      this.graphics.lineTo(rotX2 * zoom + width / 2, rotY2 * zoom + height / 2);
    }
    this.graphics.stroke({ color, width: 1 });
  }
}

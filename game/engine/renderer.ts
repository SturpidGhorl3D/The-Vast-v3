
import * as BABYLON from '@babylonjs/core';
import { Camera } from './camera';
import { GlobalCoords } from '../../components/game/types';
import { WorldRenderer } from './renderers/WorldRenderer';
import { ShipRenderer } from './renderers/ShipRenderer';
import { HUDOverlayRenderer } from './renderers/HUDOverlayRenderer';
import { ProjectileRenderer } from './renderers/ProjectileRenderer';
import { CelestialRenderer } from './renderers/CelestialRenderer';
import { Graphics2D } from './babylon/Graphics2D';

export class Renderer {
  public engine: BABYLON.WebGPUEngine | BABYLON.Engine | null = null;
  public scene!: BABYLON.Scene;
  public camera!: BABYLON.TargetCamera;

  public graphics!: Graphics2D;
  public projectileGraphics!: Graphics2D;
  public canvas: HTMLCanvasElement;
  private _logicalWidth: number = 0;
  private _logicalHeight: number = 0;

  private worldRenderer!: WorldRenderer;
  private shipRenderer!: ShipRenderer;
  private hudOverlayRenderer!: HUDOverlayRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private celestialRenderer!: CelestialRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(seed: string = 'THE-VAST-SEED-2026') {
    this._logicalWidth = this.canvas.clientWidth || window.innerWidth;
    this._logicalHeight = this.canvas.clientHeight || window.innerHeight;

    // Try starting WebGPU, fallback to WebGL if not supported
    try {
        const webGPUEngine = new BABYLON.WebGPUEngine(this.canvas);
        await webGPUEngine.initAsync();
        this.engine = webGPUEngine;
        console.log("WebGPU Engine started");
    } catch (e) {
        console.warn("WebGPU not supported, falling back to WebGL", e);
        this.engine = new BABYLON.Engine(this.canvas, true);
    }

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = BABYLON.Color4.FromHexString("#050505ff");

    // We will render in 2D by using an orthographic camera looking at +Z (Z goes into screen)
    // Babylon orthographic camera:
    this.camera = new BABYLON.TargetCamera("OrthoCam", new BABYLON.Vector3(0, 0, -1000), this.scene);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.resize(this._logicalWidth, this._logicalHeight);

    this.scene.activeCamera = this.camera;

    this.graphics = new Graphics2D(this.scene);
    this.projectileGraphics = new Graphics2D(this.scene);

    this.worldRenderer = new WorldRenderer(this.graphics as any);
    this.shipRenderer = new ShipRenderer(this.graphics as any);
    this.shipRenderer.setFXGraphics(this.projectileGraphics as any);
    
    this.hudOverlayRenderer = new HUDOverlayRenderer(this.graphics as any);
    this.projectileRenderer = new ProjectileRenderer(this.projectileGraphics as any);
    
    this.celestialRenderer = new CelestialRenderer(this.scene);
    this.worldRenderer.setCelestialRenderer(this.celestialRenderer);
  }

  public render() {
      if (this.scene && this.engine) {
          this.graphics.update();
          this.projectileGraphics.update();
          this.engine.beginFrame();
          this.scene.render();
          this.engine.endFrame();
      }
  }

  updateAsteroidInstances(asteroids: any[], camera: Camera, now: number, targetId: string | null = null, miningTargetId: string | null = null) {
    this.worldRenderer.updateAsteroidInstances(asteroids, camera, this.width, this.height, now, targetId, miningTargetId);
  }

  removeAsteroidInstance(id: string) {
    this.worldRenderer.removeAsteroidInstance(id);
  }

  clearAsteroidInstances() {
    if (this.worldRenderer) {
      this.worldRenderer.clearAllAsteroidInstances();
    }
  }

  get width() { 
    return this._logicalWidth > 0 ? this._logicalWidth : (this.canvas.clientWidth || window.innerWidth); 
  }
  get height() { 
    return this._logicalHeight > 0 ? this._logicalHeight : (this.canvas.clientHeight || window.innerHeight); 
  }

  clear(color: string = '#050505', now: number = 0) {
    if (!this.graphics) return;

    if (this.celestialRenderer) {
      this.celestialRenderer.beginFrame();
    }

    this.graphics.clear();
    this.projectileGraphics.clear();
    
    if (this.scene && color !== 'transparent') {
        let sc = this.shipRenderer.parseColor(color).color;
        let r = ((sc >> 16) & 0xFF) / 255;
        let g = ((sc >> 8) & 0xFF) / 255;
        let b = (sc & 0xFF) / 255;
        this.scene.clearColor = new BABYLON.Color4(r, g, b, 1.0);
    }
  }

  drawStar(data: any, camera: Camera, isGlobal: boolean, now: number = 0) {
    this.worldRenderer.drawStar(data, camera, this.width, this.height, isGlobal, now);
  }

  drawPlanet(data: any, camera: Camera, now: number = 0, lightDir: {x: number, y: number} = {x: 0, y: 0}) {
    this.worldRenderer.drawPlanet(data, camera, this.width, this.height, now, lightDir);
  }

  drawAsteroidRing(
    coords: GlobalCoords,
    minRadius: number,
    maxRadius: number,
    camera: Camera,
    now: number
  ) {
    this.worldRenderer.drawAsteroidRing(coords, minRadius, maxRadius, camera, this.width, this.height, now);
  }

  drawLoot(pos: GlobalCoords, camera: Camera) {
    this.worldRenderer.drawLoot(pos, camera, this.width, this.height);
  }

  drawAsteroid(asteroid: any, cluster: any, camera: Camera, isMarked: boolean = false, isMiningTarget: boolean = false) {
    this.worldRenderer.drawAsteroid(asteroid, cluster, camera, this.width, this.height, isMarked, isMiningTarget);
  }

  drawAsteroidCluster(cluster: any, camera: Camera, isFaint: boolean = false) {
    this.worldRenderer.drawAsteroidCluster(cluster, camera, this.width, this.height, isFaint);
  }

  drawSpaceStation(coords: GlobalCoords, camera: Camera, width: number, height: number, color: string) {
    this.worldRenderer.drawSpaceStation(coords, camera, width, height, color);
  }

  public updateAsteroidNoiseMap(buffer: Uint8Array, width: number, height: number) {
    this.worldRenderer.updateAsteroidNoiseMap(buffer, width, height);
  }

  public drawAsteroidNoiseMap(camera: Camera, minX: number, minY: number, maxX: number, maxY: number) {
    this.worldRenderer.drawAsteroidNoiseMap(camera, this.width, this.height, minX, minY, maxX, maxY);
  }

  drawGrid(camera: Camera, spacing: number) {
    this.worldRenderer.drawGrid(camera, this.width, this.height, spacing);
  }

  drawProjectiles(engine: any, camera: Camera) {
    this.projectileRenderer.draw(engine, camera, this.width, this.height);
  }

  drawShip(coords: GlobalCoords, angle: number, hull: any, camera: Camera, isEditor = false, internalView = false, engine?: any, ecs?: any, entity?: any) {
    this.shipRenderer.drawShip(coords, angle, hull, camera, this.width, this.height, isEditor, internalView, engine, ecs, entity);
  }

  drawMiningBeam(from: {x: number, y: number}, to: {x: number, y: number}, color: string = '#44ff44') {
    this.hudOverlayRenderer.drawMiningBeam(from, to, color);
  }

  drawCombatLock(screenPos: {x: number, y: number}, progress: number, color: string = '#ff4444') {
    this.hudOverlayRenderer.drawCombatLock(screenPos, progress, color);
  }

  drawTargetIndicator(screenPos: {x: number, y: number}, color: string = '#ff4444', isSelected: boolean = false) {
    this.hudOverlayRenderer.drawTargetIndicator(screenPos, color, isSelected);
  }

  drawManualCrosshair(screenPos: {x: number, y: number}, color: string = '#00ffff') {
    this.hudOverlayRenderer.drawManualCrosshair(screenPos, color);
  }

  drawRelativeFirePoint(screenPos: {x: number, y: number}, shipScreenPos: {x: number, y: number}, color: string = '#00ffff') {
    this.hudOverlayRenderer.drawRelativeFirePoint(screenPos, shipScreenPos, color);
  }

  drawText(pos: GlobalCoords, text: string, fontSize: number, color: string, camera: Camera) {
      // Not implemented in webgpu for now, HUD is HTML.
  }

  drawCircle(pos: {x?: number, y?: number, sectorX?: bigint, sectorY?: bigint, offsetX?: number, offsetY?: number}, radius: number, color: string, camera: Camera, isUI: boolean = false) {
    const coords = {
      sectorX: pos.sectorX ?? camera.pos.sectorX,
      sectorY: pos.sectorY ?? camera.pos.sectorY,
      offsetX: pos.offsetX ?? pos.x ?? 0,
      offsetY: pos.offsetY ?? pos.y ?? 0
    };
    const screen = camera.worldToScreen(coords, this.width, this.height);
    this.graphics.circle(screen.x, screen.y, isUI ? radius : radius * camera.zoom);
    this.graphics.fill({ color: this.shipRenderer.parseColor(color).color, alpha: this.shipRenderer.parseColor(color).alpha });
  }

  drawRect(x: number, y: number, w: number, h: number, color: string, camera: Camera, fill = true) {
    const coords = {
      sectorX: camera.pos.sectorX,
      sectorY: camera.pos.sectorY,
      offsetX: x,
      offsetY: y
    };
    const screen = camera.worldToScreen(coords, this.width, this.height);
    const { color: colorNum, alpha } = this.shipRenderer.parseColor(color);
    if (fill) {
      this.graphics.rect(screen.x, screen.y, w * camera.zoom, h * camera.zoom);
      this.graphics.fill({ color: colorNum, alpha });
    } else {
      this.graphics.rect(screen.x, screen.y, w * camera.zoom, h * camera.zoom);
      this.graphics.stroke({ color: colorNum, width: 1, alpha });
    }
  }

  drawLine(p1: {x?: number, y?: number, sectorX?: bigint, sectorY?: bigint, offsetX?: number, offsetY?: number}, p2: {x?: number, y?: number, sectorX?: bigint, sectorY?: bigint, offsetX?: number, offsetY?: number}, color: string, width: number, camera: Camera, isUI: boolean = false) {
    const coords1 = {
      sectorX: p1.sectorX ?? camera.pos.sectorX,
      sectorY: p1.sectorY ?? camera.pos.sectorY,
      offsetX: p1.offsetX ?? p1.x ?? 0,
      offsetY: p1.offsetY ?? p1.y ?? 0
    };
    const coords2 = {
      sectorX: p2.sectorX ?? camera.pos.sectorX,
      sectorY: p2.sectorY ?? camera.pos.sectorY,
      offsetX: p2.offsetX ?? p2.x ?? 0,
      offsetY: p2.offsetY ?? p2.y ?? 0
    };
    
    const r1 = camera.worldToScreen(coords1, this.width, this.height);
    const r2 = camera.worldToScreen(coords2, this.width, this.height);

    const { color: colorNum, alpha } = this.shipRenderer.parseColor(color);
    this.graphics.beginPath();
    this.graphics.moveTo(r1.x, r1.y);
    this.graphics.lineTo(r2.x, r2.y);
    this.graphics.stroke({ color: colorNum, width: isUI ? width : width * camera.zoom, alpha });
  }

  drawHexagon(q: number, r: number, size: number, color: string, camera: Camera, fill = true) {
    const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = size * (3 / 2 * r);
    
    const coords = {
      sectorX: camera.pos.sectorX,
      sectorY: camera.pos.sectorY,
      offsetX: x,
      offsetY: y
    };
    const screen = camera.worldToScreen(coords, this.width, this.height);
    const { color: colorNum, alpha } = this.shipRenderer.parseColor(color);
    
    const s = size * camera.zoom;
    const pts: {x: number, y: number}[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 - Math.PI / 6;
        pts.push({ x: screen.x + Math.cos(angle) * s, y: screen.y + Math.sin(angle) * s });
    }

    if (fill) {
        this.graphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 6; i++) this.graphics.lineTo(pts[i].x, pts[i].y);
        this.graphics.closePath();
        this.graphics.fill({ color: colorNum, alpha });
    } else {
        this.graphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 6; i++) this.graphics.lineTo(pts[i].x, pts[i].y);
        this.graphics.closePath();
        this.graphics.stroke({ color: colorNum, width: 1, alpha });
    }
  }

  resize(width: number, height: number) {
    this._logicalWidth = width;
    this._logicalHeight = height;
    if (this.engine) {
        this.engine.resize();
    }
    if (this.camera) {
        this.camera.orthoLeft = 0;
        this.camera.orthoRight = width;
        this.camera.orthoTop = 0;
        this.camera.orthoBottom = -height;
    }
  }

  applyVignette() {}
  applyDithering() {}
}



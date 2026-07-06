
import * as BABYLON from '@babylonjs/core';
import { Camera } from './camera';
import { GlobalCoords } from '../../components/game/types';
import { WorldRenderer } from './renderers/WorldRenderer';
import { ShipRenderer } from './renderers/ShipRenderer';
import { HUDOverlayRenderer } from './renderers/HUDOverlayRenderer';
import { CelestialRenderer } from './renderers/CelestialRenderer';
import { Graphics2D } from './babylon/Graphics2D';

export class Renderer {
  public engine: BABYLON.WebGPUEngine | BABYLON.Engine | null = null;
  public scene!: BABYLON.Scene;
  public camera!: BABYLON.TargetCamera;
  public dirLight!: BABYLON.DirectionalLight;
  public ambientLight!: BABYLON.HemisphericLight;

  public bgGraphics!: Graphics2D;
  public graphics!: Graphics2D;
  public shipGraphics!: Graphics2D;
  public canvas: HTMLCanvasElement;
  private _logicalWidth: number = 0;
  private _logicalHeight: number = 0;

  private worldRenderer!: WorldRenderer;
  private shipRenderer!: ShipRenderer;
  private hudOverlayRenderer!: HUDOverlayRenderer;
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

    // Add lighting for specular highlights and shadows on decks
    this.dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0, 0, 1), this.scene);
    this.dirLight.intensity = 0.8;
    this.dirLight.specular = new BABYLON.Color3(1, 1, 1);
    
    this.ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 0, -1), this.scene);
    this.ambientLight.intensity = 0.4;
    this.ambientLight.specular = new BABYLON.Color3(0.1, 0.1, 0.1);

    this.bgGraphics = new Graphics2D(this.scene, 0);
    this.graphics = new Graphics2D(this.scene, 3);
    
    // Create lit material for ship
    const shipMat = new BABYLON.StandardMaterial("shipGraphicsMat", this.scene) as any;
    shipMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    shipMat.diffuseColor = BABYLON.Color3.White();
    shipMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    shipMat.specularPower = 16;
    shipMat.disableLighting = false;
    shipMat.backFaceCulling = false;
    shipMat.useVertexColors = true;
    shipMat.hasAlpha = true;
    shipMat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    shipMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    shipMat.disableDepthWrite = true;
    shipMat.needDepthPrePass = false;

    this.shipGraphics = new Graphics2D(this.scene, 2, shipMat);

    this.worldRenderer = new WorldRenderer(this.bgGraphics as any, this.scene);
    this.shipRenderer = new ShipRenderer(this.shipGraphics as any);
    this.shipRenderer.setFXGraphics(this.graphics as any);
    
    this.hudOverlayRenderer = new HUDOverlayRenderer(this.graphics as any);
    
    this.celestialRenderer = new CelestialRenderer(this.scene);
    this.worldRenderer.setCelestialRenderer(this.celestialRenderer);
  }

  public render() {
      if (this.scene && this.engine) {
          this.bgGraphics.update();
          this.graphics.update();
          this.shipGraphics.update();
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
    if (this.worldRenderer) {
      this.worldRenderer.beginFrame();
    }

    this.bgGraphics.clear();
    this.graphics.clear();
    if (this.shipGraphics) this.shipGraphics.clear();
    
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
    if (!isGlobal) {
        // Calculate light direction from center of screen (ship focus) to star
        const cx = this.width / 2;
        const cy = this.height / 2;
        const sx = (data.x - camera.x) * camera.zoom + cx;
        const sy = (data.y - camera.y) * camera.zoom + cy;
        // Direction from star to ship (center) in screen space
        const dx = cx - sx;
        const dy = cy - sy;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 0.001) {
            // Babylon DirectionalLight direction is the direction the light is travelling.
            // Screen +Y is down, but Babylon physical +Y is up. So we use -dy.
            // Our camera is at Z=-1000 looking at 0,0,0 (+Z). So light shining on the ship should have +Z direction.
            // A slight Z angle to mimic top-down lighting.
            this.dirLight.direction = new BABYLON.Vector3(dx / len, -dy / len, 1.0).normalize();
        }
    }
  }

  drawPlanet(data: any, camera: Camera, now: number = 0, lightDir: {x: number, y: number} = {x: 0, y: 0}) {
    this.worldRenderer.drawPlanet(data, camera, this.width, this.height, now, lightDir);
  }

  drawAsteroidChunk(coords: GlobalCoords, radius: number, camera: Camera) {
    this.worldRenderer.drawAsteroidChunk(coords, radius, camera, this.width, this.height);
  }

  drawAsteroidFieldDensity(gridManager: any, camera: Camera, currentSystem: any, now: number) {
    this.worldRenderer.drawAsteroidFieldDensity(gridManager, camera, currentSystem, this.width, this.height, now);
  }

  hideAsteroidFieldDensity() {
    this.worldRenderer.hideAsteroidFieldDensity();
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

  drawSpaceStation(coords: GlobalCoords, camera: Camera, width: number, height: number, color: string) {
    this.worldRenderer.drawSpaceStation(coords, camera, width, height, color);
  }

  drawGrid(camera: Camera, spacing: number) {
    this.worldRenderer.drawGrid(camera, this.width, this.height, spacing);
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



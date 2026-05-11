
import { NetworkPlayerState } from './networkTypes';
import { GameCore } from './GameCore';
import { ECS, Entity } from './ecs';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { WorldGenerator } from '../world/generator';
import { AsteroidGridManager } from '../world/AsteroidGridManager';
import { GlobalMapRenderer } from '../world/global_map/GlobalMapRenderer';
import { 
  movementSystem, 
  miningSystem, 
  combatSystem,
  turretSystem,
  projectileSystem,
  Position,
  Velocity,
  Hull,
  Inventory,
  getEngineThrust,
  getGyroTorque
} from '../systems';
import { lootSystem } from '../systems/lootSystem';
import { aiSystem } from '../systems/aiSystem';
import { factionSpawnerSystem } from '../systems/factionSpawnerSystem';
import { getShipMass } from '../compartmentUtils';
import { InputManager } from './InputManager';
import { globalFactionManager } from '../world/FactionManager';
import { GlobalCoords, ViewMode, MovementMode, EditorMode, CompartmentType } from '../../components/game/types';
import { 
  CHUNK_SIZE_M, 
  SECTOR_SIZE_M,
  WARP_COOLDOWN_MS,
  SHIP_WARP_RAMP_RATE,
  SHIP_ACCEL_RAMP_RATE,
  SHIP_ACCEL_NORMAL,
  WARP_ACCEL_MULT,
  SHIP_TURN_SPEED,
  SHIP_MAX_SPEED_WARP,
  SHIP_MAX_SPEED_NORMAL,
  PERIMETER_THICKNESS
} from '../constants';
import { symmetrizeHull } from '@/components/game/editorLogic';
import { getHexCoords } from '../world/generator';
import { getLargestShipDimension, clampCameraZoom } from '@/game/hullGeometry';
import { LIGHT_YEAR_M } from '@/game/constants';

import { SaveManager, WorldState } from '@/lib/SaveManager';
import { GameSave } from '@/components/ui/main-menu/MainMenu';

import { ProjectileManager } from './ProjectileManager';
import { audioManager } from './AudioManager';

import { EditorManager } from './managers/EditorManager';
import { MultiplayerManager } from './managers/MultiplayerManager';
import { DiscoveryManager } from './managers/DiscoveryManager';
import { MovementManager } from './managers/MovementManager';
import { LootManager } from './managers/LootManager';
import { CelestialManager } from './managers/CelestialManager';
import { ResearchManager } from './managers/ResearchManager';
import { EconomyManager } from './managers/EconomyManager';
import { ProductionManager } from './managers/ProductionManager';
import { TECHNOLOGIES } from '@/components/game/technologyTypes';

export class GameEngine {
  public app!: any;
  public core!: GameCore;
  public ecs: ECS;
  public camera: Camera;
  public renderer: Renderer;
  public projectiles: ProjectileManager;
  public world: WorldGenerator;
  public asteroidGrid!: AsteroidGridManager;
  public globalMapRenderer: GlobalMapRenderer | null = null;
  public inputManager: InputManager;
  
  // Managers
  public editor: EditorManager;
  public multiplayer: MultiplayerManager;
  public discovery: DiscoveryManager;
  public movement: MovementManager;
  public loot: LootManager;
  public celestial: CelestialManager;
  public research: ResearchManager;
  public economy: EconomyManager;
  public production: ProductionManager;
  public playerSpecies: any = null;

  public player: Entity | null = null;
  public remotePlayers: Record<string, Entity> = {};
  public playerId: string | null = null; 
  
  // Game State
  public isPaused: boolean = false;
  public isInitialized: boolean = false;
  public viewMode: ViewMode = 'LOCAL';
  public movementMode: MovementMode = 'MANUAL';
  public interactionMode: string = 'NONE';
  
  public lastAsteroidScan: number = 0;
  public scannedChunkKey: string | null = null;
  public scannedClusterId: string | null = null;
  public scannedChunkCoords: GlobalCoords | null = null;
  public inAsteroidCluster: boolean = false;
  
  public warpCooldownEndTime: number = 0;
  public warpTarget: (GlobalCoords & { name?: string }) | null = null;
  public followTarget: any | null = null;
  public orbitTarget: any | null = null;
  public orbitRadius: number = 0;
  public orbitSpeed: number = 0;
  public orbitDirection: number = 1; // 1 for clockwise, -1 for counter-clockwise
  
  // Mining state
  public targetingStartTime: number = 0;
  public targetAsteroidId: string | null = null;
  public miningTargetId: string | null = null;
  public currentGravityWell: any = null;
  public mouseActionHold: { startTime: number; duration: number; pos: {x: number; y: number}; color?: string } | null = null;
  
  // Combat state
  public combatTargetId: Entity | null = null;
  public designatedTargets: Entity[] = [];
  public targetDesignationMode: boolean = false;
  public combatLockProgress: number = 0;
  public combatLockTarget: Entity | null = null;
  public combatFireAngle: number | null = null;
  public relativeFirePoint: GlobalCoords | null = null;
  public relativeFirePointOffset: { x: number, y: number } | null = null;
  public lastManualAngle: number | null = null;
  public fireGroupSync: Record<string, boolean> = { MAIN: true, SECONDARY: false, DEFENCE: false };
  public fireGroupSemiAuto: Record<string, boolean> = { MAIN: false, SECONDARY: true, DEFENCE: true };
  public mainBatteryActive: boolean = true;
  public secondaryActive: boolean = true;
  public defenceActive: boolean = true;
  
  public tacticalRoute: (GlobalCoords & { name?: string })[] = [];
  public tacticalClickMode: 'NONE' | 'WAYPOINT' | 'WARP_TARGET' | 'ASTEROID_DETECT' = 'NONE';

  // Editor State
  public isEditorOpen: boolean = false;
  public isTurretEditor: boolean = false;
  public turretEditPart: 'MOUNT' | 'HEAD' | 'BARREL' = 'MOUNT';
  public turretActiveLayerId: string | null = null;
  public turretTargetBarrelIdx: number = 0;
  public editorMode: EditorMode = 'SELECT';
  public draftHull: any = null;
  public activeVertex: number | null = null;
  public activeCompartment: any = null;
  public activeCompartmentVertex: number | null = null;
  public pendingCompartmentType: CompartmentType | null = null;
  public symmetryX: boolean = false;
  public symmetryY: boolean = false;
  public selectionType: 'deck' | 'compartment' | null = null;
  public selectedElementIndex: number | string | null = null;
  public mapPos: GlobalCoords = { sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 };
  public editorCameraPos: { x: number; y: number } = { x: 0, y: 0 };
  public mouseWorld: GlobalCoords = { sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 };
  public thrust: number = 0;
  public visited: Set<string> = new Set();
  public scanned: Set<string> = new Set();
  public lastAutoSave: number = 0;
  public saveId: string | null = null;
  public totalPlayTime: number = 0;
  
  public orgType: string = 'CAPTAIN';
  public originId: string = 'captain-freelance';
  public researchedTechs: string[] = [];
  public innovationPoints: number = 0;
  public activeResearch: { techId: string; progress: number; totalCost: number } | null = null;
  public availableTechOptions: string[] = [];
  public pendingInnovationChoices: string[] = [];
  public techNodePositions: Record<string, { x: number; y: number }> = {};
  public techBranchingCounts: Record<string, number> = {}; // Tracks how many times we branched from a specific node
  public pendingBranchChoices: Record<string, string[]> = {}; 

  public getNetworkState(): NetworkPlayerState | null {
    return this.multiplayer.getNetworkState();
  }

  public applyRemotePlayerState(state: NetworkPlayerState) {
    this.multiplayer.applyRemotePlayerState(state);
  }

  public markPlayerDisconnected(playerId: string) {
    this.multiplayer.markPlayerDisconnected(playerId);
  }

  public spawnLoot(pos: GlobalCoords, resources: Record<string, number>) {
    return this.loot.spawnLoot(pos, resources);
  }

  public tryPickUpLoot(mouseX: number, mouseY: number) {
    return this.loot.tryPickUpLoot(mouseX, mouseY);
  }

  public saveState() {
    console.log("GameEngine.saveState triggered", { player: this.player, saveId: this.saveId });
    if (this.player === null || !this.saveId) return;
    
    // Refresh weapon components before saving or transition
    this.refreshWeaponComponents(this.player);

    const pos = this.ecs.getPosition(this.player)!;
    const vel = this.ecs.getComponent<Velocity>(this.player, 'Velocity')!;
    const hull = this.ecs.getHull(this.player)!;
    const inv = this.ecs.getComponent<Velocity>(this.player, 'Inventory') as any; // typing fix
    
    // the original line uses Inventory interface but imports might miss it, using any for now since it's correctly retrieved below
    const invData = this.ecs.getComponent<any>(this.player, 'Inventory');

    const state: WorldState = {
      saveId: this.saveId,
      shipHull: hull,
      playerPosition: { ...pos },
      playerVelocity: { ...vel },
      inventory: invData?.resources || {},
      visitedSectors: Array.from(this.visited),
      scannedSystems: Array.from(this.scanned),
      lastUpdate: Date.now(),
      orgType: this.orgType,
      originId: this.originId,
      species: this.playerSpecies,
      researchedTechs: this.researchedTechs,
      innovationPoints: this.innovationPoints,
      activeResearch: this.activeResearch,
      availableTechOptions: this.availableTechOptions,
      pendingInnovationChoices: this.pendingInnovationChoices,
      pendingBranchChoices: this.pendingBranchChoices,
      techNodePositions: this.techNodePositions,
      techBranchingCounts: this.techBranchingCounts
    };

    SaveManager.saveWorldState(state);
    this.lastAutoSave = Date.now();
  }

  public loadState(save: GameSave) {
    this.saveId = save.id;
    this.orgType = save.orgType;
    this.originId = save.originId;
    this.playerSpecies = save.species || null;
    
    // Load state from GameSave
    if ('researchedTechs' in save) this.researchedTechs = (save as any).researchedTechs;
    if ('innovationPoints' in save) this.innovationPoints = (save as any).innovationPoints;
    if ('activeResearch' in save) this.activeResearch = (save as any).activeResearch;
    if ('availableTechOptions' in save) this.availableTechOptions = (save as any).availableTechOptions || [];
    if ('pendingInnovationChoices' in save) this.pendingInnovationChoices = (save as any).pendingInnovationChoices || [];
    if ('pendingBranchChoices' in save) this.pendingBranchChoices = (save as any).pendingBranchChoices || {};
    if ('techNodePositions' in save) this.techNodePositions = (save as any).techNodePositions || {};
    if ('techBranchingCounts' in save) this.techBranchingCounts = (save as any).techBranchingCounts || {};

    // Ensure initial available tech if none are present
    if (this.availableTechOptions.length === 0) {
      if (this.orgType === 'NOMAD' || this.orgType === 'CAPTAIN') {
         // Use ResearchManager to roll initial options
         this.research.rollInitialOptions();
      }
    }
    
    const state = SaveManager.loadWorldState(save.id);
    if (state === null) return null;

    if (state.visitedSectors) {
      this.visited = new Set(state.visitedSectors);
    }
    if (state.scannedSystems) {
      this.scanned = new Set(state.scannedSystems);
    }
    
    return state;
  }
  public switchViewMode(newMode: ViewMode) {
    this.viewMode = newMode;
    if (this.renderer) this.renderer.clearAsteroidInstances();
    
    const pl2 = this.player;
    const hl2 = pl2 !== null ? this.ecs.getHull(pl2) : null;
    const cw = this.renderer?.width || window.innerWidth;
    const ch = this.renderer?.height || window.innerHeight;
    const viewMin = Math.min(cw, ch);

    if (newMode === 'LOCAL') {
      this.camera.targetZoom = 5;
      clampCameraZoom(this.camera, cw, ch, 'local', hl2);
    } else if (newMode === 'TACTICAL') {
      const pl2pos = pl2 !== null ? this.ecs.getPosition(pl2) : null;
      if (pl2pos) this.mapPos = { sectorX: pl2pos.sectorX, sectorY: pl2pos.sectorY, offsetX: pl2pos.offsetX, offsetY: pl2pos.offsetY };
      this.camera.targetZoom = viewMin / 50_000_000_000;
      clampCameraZoom(this.camera, cw, ch, 'tactical', hl2);
      this.inputManager.keys.delete('Tab');
    } else if (newMode === 'STRATEGIC') {
      // Start zoomed out enough to see a few LY
      this.camera.targetZoom = viewMin / (LIGHT_YEAR_M * 2); 
      const pl2pos = pl2 !== null ? this.ecs.getPosition(pl2) : null;
      if (pl2pos) this.mapPos = { sectorX: pl2pos.sectorX, sectorY: pl2pos.sectorY, offsetX: pl2pos.offsetX, offsetY: pl2pos.offsetY };
      clampCameraZoom(this.camera, cw, ch, 'global', hl2);
      this.inputManager.keys.delete('Tab');
    }
  }

  public cycleViewMode() {
    if (this.viewMode === 'LOCAL') this.switchViewMode('TACTICAL');
    else if (this.viewMode === 'TACTICAL') this.switchViewMode('STRATEGIC');
    else this.switchViewMode('LOCAL');
  }

  public performAsteroidScan() {
    this.discovery.performAsteroidScan();
  }

  public setIsPaused(v: boolean) { this.isPaused = v; }
  public setIsEditorOpen(v: boolean) { this.editor.setIsEditorOpen(v); }
  public setEditorMode(v: EditorMode) { this.editor.setEditorMode(v); }
  public setDraftHull(v: any) { this.editor.setDraftHull(v); }

  public updateDraftHull(newHull: any) {
    this.editor.updateDraftHull(newHull);
  }

  public setIsTurretEditor(v: boolean) { this.editor.setIsTurretEditor(v); }
  public setTurretTargetBarrelIdx(v: number) { this.editor.setTurretTargetBarrelIdx(v); }
  public setTurretActiveLayerId(v: string | null) { this.editor.setTurretActiveLayerId(v); }
  public setActiveCompartment(v: any) { this.editor.setActiveCompartment(v); }
  public setTurretEditPart(v: 'MOUNT' | 'HEAD' | 'BARREL') { this.editor.setTurretEditPart(v); }
  public setActiveVertex(v: number | null) { this.editor.setActiveVertex(v); }
  public setActiveCompartmentVertex(v: number | null) { this.editor.setActiveCompartmentVertex(v); }
  public setPendingCompartmentType(v: CompartmentType | null) { this.editor.setPendingCompartmentType(v); }
  public setSymmetryX(v: boolean) { this.editor.setSymmetryX(v); }
  public setSymmetryY(v: boolean) { this.editor.setSymmetryY(v); }
  public setSelectionType(v: 'deck' | 'compartment' | null) { this.editor.setSelectionType(v); }
  public setSelectedElementIndex(v: number | string | null) { this.editor.setSelectedElementIndex(v); }

  public setWarpCooldownEndTime(v: number) { this.warpCooldownEndTime = v; }
  public setWarpTarget(v: (GlobalCoords & { name?: string }) | null) { this.warpTarget = v; }
  public setMapPos(pos: GlobalCoords) { this.mapPos = { ...pos }; }

  public scanCurrentSystem() {
    return this.discovery.scanCurrentSystem();
  }

  public updateDeckHeight(deckIndex: number, delta: number) {
    this.editor.updateDeckHeight(deckIndex, delta);
  }

  public updateDeckThickness(deckIndex: number, delta: number) {
    this.editor.updateDeckThickness(deckIndex, delta);
  }

  public deleteVertex(deckIndex: number, vertexIndex: number) {
    this.editor.deleteVertex(deckIndex, vertexIndex);
  }

  public deleteVertices(deckIndex: number, indices: number[]) {
    this.editor.deleteVertices(deckIndex, indices);
  }

  public updateVertexSegment(deckIndex: number, vertexIndex: number, segmentType: string) {
    this.editor.updateVertexSegment(deckIndex, vertexIndex, segmentType);
  }

  public deleteCompartment(compId: string | number) {
    this.editor.deleteCompartment(compId);
  }

  public deleteCompartmentVertex(compId: string | number, vertexIndex: number) {
    return this.editor.deleteCompartmentVertex(compId, vertexIndex);
  }

  public symmetrizeCurrentHull() {
    this.editor.symmetrizeCurrentHull();
  }

  public currentTime: number = 0;
  private lastTime: number = 0;
  public lastSectorKey: string = '';
  public currentSystem: any = null;

  constructor(canvas: HTMLCanvasElement) {
    this.core = new GameCore('THE-VAST-SEED-2026');
    this.ecs = this.core.ecs;
    this.camera = new Camera();
    this.renderer = new Renderer(canvas);
    this.projectiles = new ProjectileManager();
    this.world = this.core.world;
    this.asteroidGrid = this.core.asteroidGrid;
    
    // Connect Asteroid Grid Manager to ECS (the one wrapped in core)
    this.asteroidGrid.onChunkLoaded = (chunk) => {
      // Performance optimization: Asteroids are no longer added to ECS.
      // They are static world objects handled by the Grid and Renderer directly.
    };
    
    this.asteroidGrid.onChunkUnloaded = (chunk) => {
      if (!chunk.asteroids) return;
      for (const ast of chunk.asteroids) {
        if (this.renderer) {
          this.renderer.removeAsteroidInstance(ast.id);
        }
      }
    };
    
    this.inputManager = new InputManager(this);
    this.editor = new EditorManager(this);
    this.multiplayer = new MultiplayerManager(this);
    this.discovery = new DiscoveryManager(this);
    this.movement = new MovementManager(this);
    this.loot = new LootManager(this);
    this.celestial = new CelestialManager(this);
    this.research = new ResearchManager(this);
    this.economy = new EconomyManager(this);
    this.production = new ProductionManager(this);
  }

  public setWorldConfig(seed: string, clusterRadius?: number, density?: number) {
    this.world = new WorldGenerator(seed, clusterRadius, density);
    this.asteroidGrid = new AsteroidGridManager(this.world.noise2D);
    this.asteroidGrid.setWorldGenerator(this.world);
    this.asteroidGrid.initWorker(seed); 
    if (this.renderer) {
      this.renderer.clearAsteroidInstances();
    }
  }

  async init(seed?: string, clusterRadius?: number, density?: number) {
    if (seed) {
      this.world = new WorldGenerator(seed, clusterRadius, density);
      this.asteroidGrid = new AsteroidGridManager(this.world.noise2D);
      this.asteroidGrid.setWorldGenerator(this.world);
      this.asteroidGrid.initWorker(seed);
    }
    await this.renderer.init(seed || 'THE-VAST-SEED-2026');
    this.globalMapRenderer = new GlobalMapRenderer(this.renderer);
  }

  public clearGravityWell() {
    this.currentGravityWell = null;
    this.followTarget = null;
    this.orbitTarget = null;
    this.tacticalRoute = [];
  }

  /**
   * Calculates the current position of a celestial body (planet, satellite, star, station)
   * relative to its parent system center in meters.
   */
  public getCelestialLocalPos(obj: any, time: number): { x: number, y: number } {
    return this.celestial.getCelestialLocalPos(obj, time);
  }

  public getDynamicTargetPos(target: any): GlobalCoords | null {
    return this.celestial.getDynamicTargetPos(target);
  }

  private toSectorCoords(wx: bigint, wy: bigint): GlobalCoords {
    const sSize = BigInt(SECTOR_SIZE_M);
    let sx = wx / sSize;
    let ox = Number(wx % sSize);
    if (ox < 0) {
      sx -= 1n;
      ox += Number(sSize);
    }
    let sy = wy / sSize;
    let oy = Number(wy % sSize);
    if (oy < 0) {
      sy -= 1n;
      oy += Number(sSize);
    }
    return { sectorX: sx, sectorY: sy, offsetX: ox, offsetY: oy };
  }

  private updateDynamicTargets(dt: number) {
    if (this.followTarget) {
      const pos = this.getDynamicTargetPos(this.followTarget);
      if (pos) {
        // Update first waypoint if we are following
        if (this.movementMode === 'TACTICAL') {
          this.tacticalRoute[0] = { ...pos, name: `СЛЕДОВАНИЕ ЗА: ${this.followTarget.name || this.followTarget.type}` };
        }
      } else {
        this.followTarget = null;
      }
    }

    if (this.orbitTarget && this.player) {
      const center = this.getDynamicTargetPos(this.orbitTarget);
      const playerPos = this.ecs.getPosition(this.player);
      if (center && playerPos) {
        const secDx = Number(BigInt(playerPos.sectorX) - BigInt(center.sectorX));
        const secDy = Number(BigInt(playerPos.sectorY) - BigInt(center.sectorY));
        const dx = secDx * Number(SECTOR_SIZE_M) + (playerPos.offsetX - center.offsetX);
        const dy = secDy * Number(SECTOR_SIZE_M) + (playerPos.offsetY - center.offsetY);
        const currentAngle = Math.atan2(dy, dx);
        
        // Target angle based on orbit speed
        const nextAngle = currentAngle + this.orbitSpeed * this.orbitDirection * dt;
        const txNum = center.offsetX + Math.cos(nextAngle) * this.orbitRadius;
        const tyNum = center.offsetY + Math.sin(nextAngle) * this.orbitRadius;
        
        if (this.movementMode === 'TACTICAL') {
          const wp = {
            sectorX: center.sectorX,
            sectorY: center.sectorY,
            offsetX: txNum,
            offsetY: tyNum,
            name: `ОРБИТА: ${this.orbitTarget.name || this.orbitTarget.type}`
          };
          this.camera.normalize(wp);
          this.tacticalRoute[0] = wp;
        }
      } else {
        this.orbitTarget = null;
      }
    }
  }

  /**
   * Main game logic tick.
   * Runs exactly 30 times per second (fixed logical timestep).
   * 
   * Handles:
   * - Movement (Manual and Tactical)
   * - Ship Throttle/Acceleration Limits
   * - Calling Game Systems (Movement, Mining)
   * - Collision/Sector checking
   * - Camera tracking & scaling constraints
   * - System discovery
   */
  public tick(dt: number) {
    const { player, ecs } = this;

    if ((this as any).mouseScreenX !== undefined && (this as any).mouseScreenY !== undefined && this.renderer && this.camera) {
       this.mouseWorld = this.camera.screenToWorld((this as any).mouseScreenX, (this as any).mouseScreenY, this.renderer.width, this.renderer.height);
    }

    if (!this.isPaused && player !== null) {
      this.movement.handleMovement(dt);
      
      // Update follow/orbit targets
      this.updateDynamicTargets(dt);

      // ECS System Processing
      aiSystem(ecs, dt);
      factionSpawnerSystem(ecs, this, dt);
      movementSystem(ecs, dt);
      miningSystem(ecs, this, dt);
      combatSystem(ecs, this, dt);
      turretSystem(ecs, this, dt);
      projectileSystem(ecs, this, dt);
      lootSystem(this.ecs, this, dt);
    }

    if (player !== null) {
      // Research Processing
      this.research.update(dt);
      this.economy.update(dt);
      this.production.update(dt);

      this.handleCamera(dt);
      
      const posRef = ecs.getPosition(player)!;
      this.discovery.update(posRef, dt);
    } else {
      this.handleCamera(dt);
    }
  }

  private handleMovement(dt: number) {
    this.movement.handleMovement(dt);
  }

  private handleGravityWell(pos: any, dt: number) {
    this.movement.handleGravityWell(pos, dt);
  }

  private processTacticalRoute(pos: any, vel: any, baseAccel: number, turnAccel: number, dt: number) {
    this.movement.processTacticalRoute(pos, vel, baseAccel, turnAccel, dt);
  }

  private handleCamera(dt: number) {
    const { player, camera, ecs, mapPos, renderer } = this;
    const keys = this.inputManager.keys;
    const curMode = this.viewMode;

    if (!this.isEditorOpen && player !== null) {
      const pos = ecs.getPosition(player)!;
      if (curMode === 'LOCAL') {
        camera.setTargetPos(pos);
        camera.targetAngle = 0;
      } else {
        const isGlobal = curMode === 'STRATEGIC';
        const baseSpeed = isGlobal ? 90 : 40;
        const mapSpeed = baseSpeed / Math.max(camera.zoom, 1e-20);
        if (keys.has('KeyW')) { mapPos.offsetX += Math.sin(camera.angle) * mapSpeed; mapPos.offsetY -= Math.cos(camera.angle) * mapSpeed; }
        if (keys.has('KeyS')) { mapPos.offsetX -= Math.sin(camera.angle) * mapSpeed; mapPos.offsetY += Math.cos(camera.angle) * mapSpeed; }
        if (keys.has('KeyA')) { mapPos.offsetX -= Math.cos(camera.angle) * mapSpeed; mapPos.offsetY -= Math.sin(camera.angle) * mapSpeed; }
        if (keys.has('KeyD')) { mapPos.offsetX += Math.cos(camera.angle) * mapSpeed; mapPos.offsetY += Math.sin(camera.angle) * mapSpeed; }
        if (keys.has('KeyQ')) camera.targetAngle -= 0.05;
        if (keys.has('KeyE')) camera.targetAngle += 0.05;
        camera.normalize(mapPos);
        camera.setTargetPos(mapPos);
      }
    }

    const hullRef = player !== null ? ecs.getHull(player) : null;
    let maxLag = undefined;
    if (curMode === 'LOCAL' && !this.isEditorOpen && hullRef) {
      const dim = getLargestShipDimension(hullRef);
      maxLag = dim * 2;
    }
    camera.update(maxLag);
    const zm = curMode === 'STRATEGIC' ? 'global' : curMode === 'TACTICAL' ? 'tactical' : 'local';
    clampCameraZoom(camera, renderer.width, renderer.height, zm, hullRef as any);
  }

  public static readonly TICK_RATE = 30;
  public static readonly MS_PER_TICK = 1000 / 30;
  private accumulator: number = 0;

  public update(time: number) {
    if (this.lastTime === 0) {
      this.lastTime = time;
      this.currentTime = time;
    }
    
    let frameTime = time - this.lastTime;
    if (frameTime > 250) frameTime = 250; // Cap to prevent death spiral
    this.lastTime = time;
    
    this.accumulator += frameTime;

    while (this.accumulator >= GameEngine.MS_PER_TICK) {
      this.currentTime += GameEngine.MS_PER_TICK;
      this.tick(2.0); // 2.0 "60-fps equivalent frames" per fixed 30 TPS tick
      this.accumulator -= GameEngine.MS_PER_TICK;
    }
  }

  public resize(width: number, height: number) {
    this.renderer.resize(width, height);
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public refreshWeaponComponents(entity: Entity) {
    const hull = this.ecs.getHull(entity);
    if (!hull) return;

    const comps = hull.compartments || [];
    for (const comp of comps) {
      if (comp.type === 'WEAPON' && comp.turretConfig) {
        const tc = comp.turretConfig;
        const weaponId = `weapon_${comp.id}`;
        
        // Preserve lastFireTime if already exists
        const existing = this.ecs.getComponent<any>(entity, weaponId);
        const lastFireTime = existing ? (existing.lastFireTime || 0) : 0;

        this.ecs.addComponent(entity, weaponId, {
           group: tc.weaponGroup || 'MAIN',
           reloadTime: 1000 / (tc.rateOfFire || 1),
           lastFireTime: lastFireTime,
           damage: tc.damage || 10,
           range: tc.range || 1000,
           projectileSpeed: tc.projectileSpeed || 200,
           fireMode: tc.fireMode || 'ROUNDS',
           barrelCount: tc.barrelCount || 1,
           turretId: comp.id,
           turretAngle: 0,
           rotationSpeed: 0.05,
           target: null,
           autoFire: true
        });
      }
    }
  }

  public doWarpJump() {
    if (this.player === null || !this.warpTarget) return;
    const pos = this.ecs.getPosition(this.player)!;
    
    // Check range/cool-down
    const secSize = BigInt(SECTOR_SIZE_M);
    const pWX = BigInt(pos.sectorX) * secSize + BigInt(Math.floor(pos.offsetX));
    const pWY = BigInt(pos.sectorY) * secSize + BigInt(Math.floor(pos.offsetY));
    const tWX = BigInt(this.warpTarget.sectorX) * secSize + BigInt(Math.floor(this.warpTarget.offsetX));
    const tWY = BigInt(this.warpTarget.sectorY) * secSize + BigInt(Math.floor(this.warpTarget.offsetY));

    const dist = Math.hypot(Number(tWX - pWX), Number(tWY - pWY));
    if (Date.now() < this.warpCooldownEndTime) return;
    
    audioManager.playWarpSFX();

    // Perform Warp
    pos.sectorX = this.warpTarget.sectorX;
    pos.sectorY = this.warpTarget.sectorY;
    pos.offsetX = this.warpTarget.offsetX;
    pos.offsetY = this.warpTarget.offsetY;
    
    this.warpCooldownEndTime = Date.now() + WARP_COOLDOWN_MS;
    this.warpTarget = null;
  }

  public getNearbyFactionsWithStations(): string[] {
    return this.discovery.getNearbyFactionsWithStations();
  }

  public destroy() {
    this.inputManager.destroy();
    if (this.renderer && this.renderer.engine) {
      this.renderer.engine.dispose();
    }
  }
}

import { AsteroidObject, GridType, HexChunk, StarSystem } from './types';
import { getHexCoords, createRNG } from './utils';
import { CHUNK_SIZE_M, SECTOR_SIZE_M } from '../constants';
import { makeAsteroidResources } from './AsteroidGenerator';
import { WorldGenerator } from './WorldGenerator';

// The size of a single local chunk where we spawn individual asteroids
export const ASTEROID_CHUNK_SIZE = 1_000_000; 

// We maintain a cache of loaded chunks
export class AsteroidGridManager {
  private noise: (x: number, y: number) => number;
  public loadedChunks = new Map<string, HexChunk>();
  private pendingChunks = new Set<string>();
  private worldGenerator: WorldGenerator | null = null;
  public onChunkLoaded?: (chunk: HexChunk) => void;
  public onChunkUnloaded?: (chunk: HexChunk) => void;
  
  private worker: Worker | null = null;
  
  public isRequestingNoiseMap = false;
  public latestNoiseMap: any = null;

  constructor(noiseFn: (x: number, y: number) => number) {
    this.noise = noiseFn;
    if (typeof window !== 'undefined') {
        try {
            this.worker = new Worker(new URL('./world.worker.ts', import.meta.url));
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
        } catch (e) {
            console.error("Failed to initialize World Worker", e);
        }
    }
  }

  public initWorker(seed: string) {
      if (this.worker) {
          this.worker.postMessage({ type: 'INIT', payload: { seed }, id: 'INIT' });
      }
  }

  public setWorldGenerator(wg: WorldGenerator) {
    this.worldGenerator = wg;
  }

  public requestNoiseMap(minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, worldInfo: { currentSystem: StarSystem | null, playerPos: {x: number, y: number} }) {
      if (!this.worker || this.isRequestingNoiseMap || isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) return;
      this.isRequestingNoiseMap = true;
      
      let nearbySystems: any[] = [];
      if (this.worldGenerator) {
          const secSize = Number(SECTOR_SIZE_M);
          // Get systems in the bounding box of the noise map + a small margin
          const secMinX = BigInt(Math.floor(minX / secSize));
          const secMinY = BigInt(Math.floor(minY / secSize));
          const secMaxX = BigInt(Math.ceil(maxX / secSize));
          const secMaxY = BigInt(Math.ceil(maxY / secSize));
          // We can afford 2 sectors margin to safely capture neighboring stars influencing this area
          const rawSystems = this.worldGenerator.getSystemsInViewport(secMinX - 2n, secMinY - 2n, secMaxX + 2n, secMaxY + 2n);
          nearbySystems = rawSystems.map(s => ({
              id: s.id,
              cx: Number(s.sectorX) * secSize + s.offsetX,
              cy: Number(s.sectorY) * secSize + s.offsetY,
              starRadius: s.starRadius,
              asteroidBelts: s.asteroidBelts
          }));
      }

      this.worker.postMessage({
          type: 'GENERATE_NOISE_MAP', id: 'NOISE_MAP',
          payload: { 
              minX, minY, maxX, maxY, width, height, 
              currentSystemData: worldInfo.currentSystem, 
              nearbySystems,
              playerPos: worldInfo.playerPos
          }
      });
  }

  private handleWorkerMessage(e: MessageEvent) {
      const { type, id, payload } = e.data;
      if (type === 'NOISE_MAP_DONE') {
          this.isRequestingNoiseMap = false;
          // Set needsUpload so the render loop knows it's fresh data to upload to GPU
          this.latestNoiseMap = { ...payload, needsUpload: true };
      } else if (type === 'CHUNK_DONE') {
          const chunk = this.loadedChunks.get(id);
          this.pendingChunks.delete(id);
          if (chunk) {
              const asteroids = payload.asteroids || [];
              chunk.asteroids = asteroids;
              
              // Calculate stats for visualization (Minecraft-style biome/richness mapping)
              chunk.avgCount = asteroids.length;
              let totalValue = 0;
              let totalRarity = 0;
              
              asteroids.forEach((a: any) => {
                  totalRarity += (a.isPlanetoid ? 0.8 : 0.2);
                  if (a.resources) {
                      Object.values(a.resources).forEach((v: any) => totalValue += Number(v));
                  }
              });
              
              chunk.avgRarity = asteroids.length > 0 ? totalRarity / asteroids.length : 0;
              chunk.avgValue = asteroids.length > 0 ? totalValue / asteroids.length : 0;

              if (this.onChunkLoaded) this.onChunkLoaded(chunk);
          }
      }
  }

  private cachedCoarseMeshes: {x: number, y: number}[][] | null = null;
  private cachedCoarseBounds: {minX: number, minY: number, maxX: number, maxY: number} | null = null;

  public getAsteroidFieldStrength(cx: number, cy: number, worldInfo: { currentSystem: StarSystem | null }): { isAsteroidField: boolean, gridType: GridType, parentId: string } {
    let isAsteroidField = false;
    let gridType: GridType = 'GLOBAL';
    let parentId = 'GLOBAL';
    
    // Determine controlling system for THIS specific point, not just where player is
    let controllingSystem = worldInfo.currentSystem;
    if (this.worldGenerator) {
       const secSize = Number(SECTOR_SIZE_M);
       const sX = BigInt(Math.floor(cx / secSize));
       const sY = BigInt(Math.floor(cy / secSize));
       const oX = cx - Number(sX) * secSize;
       const oY = cy - Number(sY) * secSize;
       controllingSystem = this.worldGenerator.getNearestSystem(sX, sY, oX, oY);
    }

    const baseNoise = (this.noise(cx * 1e-10, cy * 1e-10) + 1) / 2;
    
    if (controllingSystem) {
      const sys = controllingSystem;
      const sx = Number(sys.sectorX) * Number(SECTOR_SIZE_M) + sys.offsetX;
      const sy = Number(sys.sectorY) * Number(SECTOR_SIZE_M) + sys.offsetY;
      
      const dx = cx - sx;
      const dy = cy - sy;
      const distSq = dx*dx + dy*dy;
      const systemLimitSq = 1.40625e27; // (3.75e13)^2, approx 250 AU

      if (distSq < systemLimitSq) {
        const distToStar = Math.sqrt(distSq);
        if (distToStar >= sys.starRadius * 4 && sys.asteroidBelts) {
          for (const belt of sys.asteroidBelts) {
            const margin = 500_000;
            if (distToStar > belt.minRadius - margin && distToStar < belt.maxRadius + margin) {
               if (baseNoise >= belt.threshold) {
                 isAsteroidField = true;
                 break;
               }
            }
          }
        }
        // CRITICAL: Inside star system radius, we never use deep space noise.
        // Return with the result of the belt check.
        return { isAsteroidField, gridType: 'SYSTEM', parentId: `sys-${sys.id}` };
      } else {
        const deepNoise = (this.noise(cx * 4e-11, cy * 4e-11) + 1) / 2;
        // Adjusted to match worker thresholds (allowing slightly faint edges to actually spawn asteroids)
        if (deepNoise > 0.55 && baseNoise >= 0.35) isAsteroidField = true;
      }
    } else {
      const deepNoise = (this.noise(cx * 4e-11, cy * 4e-11) + 1) / 2;
      if (deepNoise > 0.55 && baseNoise >= 0.35) isAsteroidField = true;
    }

    if (controllingSystem) {
      gridType = 'SYSTEM';
      parentId = `sys-${controllingSystem.id}`;
    }

    return { isAsteroidField, gridType, parentId };
  }

  private lastUpdateWorldX = -BigInt(1e18);
  private lastUpdateWorldY = -BigInt(1e18);
  private lastUpdateZoom = 0;

  public update(pos: { sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number }, worldInfo: { currentSystem: StarSystem | null }, zoom: number = 1.0) {
    const secSizeBI = BigInt(SECTOR_SIZE_M);
    const worldX = pos.sectorX * secSizeBI + BigInt(Math.floor(pos.offsetX));
    const worldY = pos.sectorY * secSizeBI + BigInt(Math.floor(pos.offsetY));

    // Only update if moved significantly or zoom changed significantly
    const dx = Number(worldX - this.lastUpdateWorldX);
    const dy = Number(worldY - this.lastUpdateWorldY);
    const dz = Math.abs(this.lastUpdateZoom - zoom);

    if (dx*dx + dy*dy < (ASTEROID_CHUNK_SIZE * 0.4) ** 2 && dz < 0.1 && this.loadedChunks.size > 0) {
      return; 
    }
    
    this.lastUpdateWorldX = worldX;
    this.lastUpdateWorldY = worldY;
    this.lastUpdateZoom = zoom;

    let radius = 1;
    if (zoom < 0.2) radius = 2;
    if (zoom < 0.05) radius = 4;
    if (zoom < 0.01) radius = 8;
    if (zoom < 0.002) radius = 12;

    // Convert player position to axial coords using safe BigInt math before converting to small Numbers
    const chunkSizeBI = BigInt(ASTEROID_CHUNK_SIZE);
    
    // axial q = (sqrt(3)/3 * x - 1/3 * y) / size
    // We do this by scaling up, doing BigInt math, then scaling down
    // Or simpler: q = (x * 0.57735 - y * 0.33333) / size
    const x = Number(worldX);
    const y = Number(worldY);
    // Even if x is 1e17, x/size is 1e11, which is safe for Number.
    const { q: pq, r: pr } = getHexCoords(x, y, ASTEROID_CHUNK_SIZE);
    
    const neededKeys = new Set<string>();
    
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        const q = pq + dq;
        const r = pr + dr;
        const key = `${q},${r}`;
        neededKeys.add(key);
        
        if (!this.loadedChunks.has(key)) {
          this.loadChunk(q, r, worldInfo, zoom);
          this.cachedVisibleAsteroids = []; // Invalidate cache on new chunk
        }
      }
    }
    
    // Unload chunks that are out of bounds
    for (const key of this.loadedChunks.keys()) {
      if (!neededKeys.has(key)) {
        const chunk = this.loadedChunks.get(key);
        if (chunk && this.onChunkUnloaded) this.onChunkUnloaded(chunk);
        this.loadedChunks.delete(key);
        this.cachedVisibleAsteroids = []; // Invalidate cache on chunk removal
      }
    }
  }

  private loadChunk(q: number, r: number, worldInfo: { currentSystem: StarSystem | null }, zoom: number = 1.0) {
    // Keep high precision for chunk centers using BigInt math
    const chunkSizeBI = BigInt(ASTEROID_CHUNK_SIZE);
    
    // x = size * sqrt(3) * (q + r/2)
    const cxBI = (chunkSizeBI * BigInt(Math.floor(Math.sqrt(3) * 1000000)) * BigInt(q) + chunkSizeBI * BigInt(Math.floor(Math.sqrt(3) * 500000)) * BigInt(r)) / 1000000n;
    // y = size * 3/2 * r
    const cyBI = chunkSizeBI * 3n * BigInt(r) / 2n;

    const cx = Number(cxBI);
    const cy = Number(cyBI);
    
    const { isAsteroidField, gridType, parentId } = this.getAsteroidFieldStrength(cx, cy, worldInfo);

    const chunk: HexChunk = {
      q, r, cx, cy, gridType, parentId, isAsteroidField,
      avgValue: isAsteroidField ? 10000 : 0,
      avgCount: isAsteroidField ? 2000 : 0,
      avgRarity: 0.5,
      avgRegen: 0.01,
      asteroids: null
    };

    if (isAsteroidField) {
      if (this.worker && (zoom > 0.01 || this.pendingChunks.size < 48)) {
          this.pendingChunks.add(`${q},${r}`);
          this.worker.postMessage({
              type: 'GENERATE_CHUNK',
              id: `${q},${r}`,
              payload: { q, r, cx, cy, isAsteroidField, isSystem: gridType === 'SYSTEM' }
          });
      } else {
          this.populateAsteroidsForChunk(chunk, cx, cy);
          if (this.onChunkLoaded) this.onChunkLoaded(chunk);
      }
    } else {
       if (this.onChunkLoaded) this.onChunkLoaded(chunk);
    }
    
    this.loadedChunks.set(`${q},${r}`, chunk);
  }

  private populateAsteroidsForChunk(chunk: HexChunk, cx: number, cy: number) {
    chunk.asteroids = [];
    const rng = createRNG(`chunk-${chunk.q}-${chunk.r}`);
    
    // Significantly more asteroids per million meter chunk per user request
    const count = Math.floor(500 + rng() * 4500);
    
    for (let i = 0; i < count; i++) {
        // Exponential distribution for radius: higher exponent makes large ones much rarer
        // and shifts the bulk of population towards smaller sizes (100-500m)
        const radius = 100 + Math.pow(rng(), 10) * 4900; 
        const isPlanetoid = radius > 2500; 
        const gray = Math.floor(80 + rng() * 120);
        const color = `rgb(${gray},${gray},${Math.floor(gray * 0.95)})`;
        
        const dx = (rng() - 0.5) * ASTEROID_CHUNK_SIZE * 1.1;
        const dy = (rng() - 0.5) * ASTEROID_CHUNK_SIZE * 1.1;
        
        // Use BigInt for world position calculation to keep meters precision
        const secSizeBI = BigInt(SECTOR_SIZE_M);
        const chunkSizeBI = BigInt(ASTEROID_CHUNK_SIZE);
        
        const worldXBI = BigInt(chunk.q + chunk.r/2) * chunkSizeBI * BigInt(173205) / 100000n + BigInt(Math.floor(dx));
        const worldYBI = BigInt(chunk.r) * chunkSizeBI * 3n / 2n + BigInt(Math.floor(dy));
        
        const secX = worldXBI / secSizeBI;
        const secY = worldYBI / secSizeBI;
        const oX = Number(worldXBI % secSizeBI);
        const oY = Number(worldYBI % secSizeBI);

        // Calculate total resource capacity based on volume (r^3)
        // 100m -> ~1k tons, 1km -> ~1M tons, 5km -> ~125M tons
        const totalCapacity = Math.floor(Math.pow(radius / 100, 3) * 1000);
        
        chunk.asteroids.push({
           id: `ast-${chunk.q}-${chunk.r}-${i}`,
           sectorX: secX,
           sectorY: secY,
           offsetX: oX,
           offsetY: oY,
           rx: Number(worldXBI), // For backward compat but we should use sector info mostly
           ry: Number(worldYBI),
           radius,
           isPlanetoid,
           color,
           totalCapacity,
           resources: makeAsteroidResources(rng, isPlanetoid, chunk.gridType === 'SYSTEM', totalCapacity)
        });
    }
  }

  private cachedVisibleAsteroids: AsteroidObject[] = [];
  private lastViewMinX = -1e20;
  private lastViewMinY = -1e20;
  private lastViewMaxX = -1e20;
  private lastViewMaxY = -1e20;

  public getVisibleAsteroids(viewMinX?: number, viewMinY?: number, viewMaxX?: number, viewMaxY?: number): AsteroidObject[] {
    const checkBounds = viewMinX !== undefined && viewMaxX !== undefined;
    if (!checkBounds) return this.cachedVisibleAsteroids;

    // Caching loop to prevent massive O(N) iteration 60 times a second
    // Only re-calculate if camera moved more than 20 meters or significant zoom jump
    const movementThreshold = 50; 
    if (Math.abs(viewMinX! - this.lastViewMinX) < movementThreshold &&
        Math.abs(viewMinY! - this.lastViewMinY) < movementThreshold &&
        Math.abs(viewMaxX! - this.lastViewMaxX) < movementThreshold &&
        this.cachedVisibleAsteroids.length > 0) {
        return this.cachedVisibleAsteroids;
    }

    this.lastViewMinX = viewMinX!;
    this.lastViewMinY = viewMinY!;
    this.lastViewMaxX = viewMaxX!;
    this.lastViewMaxY = viewMaxY!;

    const list: AsteroidObject[] = [];
    const margin = ASTEROID_CHUNK_SIZE * 2.0; 

    for (const chunk of this.loadedChunks.values()) {
      if (!chunk.asteroids || chunk.asteroids.length === 0) continue;
      
      const cx = chunk.cx || 0;
      const cy = chunk.cy || 0;

      if (cx + margin < viewMinX! || cx - margin > viewMaxX! ||
          cy + margin < viewMinY! || cy - margin > viewMaxY!) {
        continue; 
      }
      
      const astMargin = 100000; 
      for (let i = 0; i < chunk.asteroids.length; i++) {
        const ast = chunk.asteroids[i];
        if (ast.depleted) continue;

        const ax = ast.rx;
        const ay = ast.ry;
        const ar = ast.radius;

        if (ax + ar < viewMinX! - astMargin || ax - ar > viewMaxX! + astMargin ||
            ay + ar < viewMinY! - astMargin || ay - ar > viewMaxY! + astMargin) {
          continue;
        }
        list.push(ast);
      }
    }
    
    this.cachedVisibleAsteroids = list;
    return list;
  }

  public getActiveChunks(): HexChunk[] {
    return Array.from(this.loadedChunks.values()).filter(c => c.isAsteroidField);
  }

}

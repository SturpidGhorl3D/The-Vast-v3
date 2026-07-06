import { AsteroidObject, GridType, StarSystem } from './types';
import { createRNG } from './utils';
import { CHUNK_SIZE_M, SECTOR_SIZE_M } from '../constants';
import { makeAsteroidResources } from './AsteroidGenerator';
import { WorldGenerator } from './WorldGenerator';

export const ASTEROID_CHUNK_SIZE = 1_000_000; 

export interface AsteroidChunk {
  x: number;
  y: number;
  cx: number;
  cy: number;
  gridType: GridType;
  parentId: string;
  isAsteroidField: boolean;
  density: number;
  asteroids: AsteroidObject[];
}

/**
 * AsteroidGridManager - Система управления астероидным полем.
 * Управляет чанками астероидов, процедурной генерацией через Worker и 
 * аналитическим расчетом плотности полей.
 */
export class AsteroidGridManager {
  public noise: (x: number, y: number) => number;
  public loadedChunks = new Map<string, AsteroidChunk>();
  public worldGenerator: WorldGenerator | null = null;
  public onChunkLoaded?: (chunk: AsteroidChunk) => void;
  public onChunkUnloaded?: (chunk: AsteroidChunk) => void;
  public modifiedChunks = new Map<string, { lastModified: number; asteroids: any[] }>();
  
  /** 
   * Отдельный воркер для выноса тяжелых расчётов генерации из основного потока.
   * Предотвращает фризы UI при спавне тысяч астероидов в новых чанках.
   */
  public worker?: Worker;
  
  constructor(noiseFn: (x: number, y: number) => number) {
    this.noise = noiseFn;
  }

  public registerAsteroidModification(asteroid: AsteroidObject) {
    const chunkX = Math.floor(asteroid.rx / ASTEROID_CHUNK_SIZE);
    const chunkY = Math.floor(asteroid.ry / ASTEROID_CHUNK_SIZE);
    const key = `${chunkX},${chunkY}`;
    const chunk = this.loadedChunks.get(key);
    if (chunk) {
      const compoundKey = `${chunk.parentId}_${chunk.x}_${chunk.y}`;
      this.modifiedChunks.set(compoundKey, {
        lastModified: Date.now(),
        asteroids: chunk.asteroids.map(ast => ({
          id: ast.id,
          rx: ast.rx,
          ry: ast.ry,
          radius: ast.radius,
          color: ast.color ?? '#8c8c80',
          isPlanetoid: ast.isPlanetoid ?? (ast.radius > 2500),
          resources: { ...ast.resources },
          depleted: ast.depleted,
          depletedAt: ast.depletedAt,
          sectorX: ast.sectorX.toString(),
          sectorY: ast.sectorY.toString(),
          offsetX: ast.offsetX,
          offsetY: ast.offsetY,
          originalRadius: ast.originalRadius ?? ast.radius,
          originalCapacity: ast.originalCapacity ?? ast.totalCapacity,
          totalCapacity: ast.totalCapacity,
        }))
      });
    }
  }

  /**
   * Инициализирует фоновый поток генерации астероидов.
   */
  public initWorker(seed: string) {
    this.worker = new Worker(new URL('./asteroid.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'CHUNK_DONE') {
            const { chunkKey, asteroids } = payload;
            const chunk = this.loadedChunks.get(chunkKey);
            if (chunk) {
                // Восстанавливаем BigInt после сериализации через Worker boundary
                for (let i = 0; i < asteroids.length; i++) {
                    asteroids[i].sectorX = BigInt(asteroids[i].sectorX);
                    asteroids[i].sectorY = BigInt(asteroids[i].sectorY);
                }
                chunk.asteroids = asteroids;
                if (this.onChunkLoaded) this.onChunkLoaded(chunk);
                this.cachedVisibleAsteroids = []; // Сброс кэша видимых объектов
            }
        }
    };
    this.worker.postMessage({ type: 'INIT', payload: { seed } });
  }

  public setWorldGenerator(wg: WorldGenerator) {
    this.worldGenerator = wg;
  }

  public getDeepSpaceHazeStrength(cx: number, cy: number): boolean {
      return this.getAsteroidFieldStrength(cx, cy, { currentSystem: null }).isAsteroidField;
  }
  
  /**
   * Аналитический расчет плотности астероидного поля в конкретной точке мира.
   * Используется для отрисовки "дымки" (haze) и принятия решения о генерации объектов.
   * 
   * @param cx Мировая координата X
   * @param cy Мировая координата Y
   * @param worldInfo Контекст текущей звездной системы
   * @returns Объект с флагом наличия поля и его плотностью (0.0 - 1.0)
   */
  public getAsteroidFieldStrength(cx: number, cy: number, worldInfo: { currentSystem: StarSystem | null }): { isAsteroidField: boolean, gridType: GridType, parentId: string, density: number } {
    let isAsteroidField = false;
    let gridType: GridType = 'GLOBAL';
    let parentId = 'GLOBAL';
    let density = 0.0;
    
    let controllingSystem = worldInfo.currentSystem;
    
    if (controllingSystem) {
      const sys = controllingSystem;
      const info = worldInfo as any;
      
      const sx = info.sysWorldX !== undefined ? info.sysWorldX : Number(BigInt(sys.sectorX) * BigInt(SECTOR_SIZE_M) + BigInt(Math.floor(sys.offsetX)));
      const sy = info.sysWorldY !== undefined ? info.sysWorldY : Number(BigInt(sys.sectorY) * BigInt(SECTOR_SIZE_M) + BigInt(Math.floor(sys.offsetY)));
      
      const dx = cx - sx;
      const dy = cy - sy;
      const distSq = dx*dx + dy*dy;
      const distToStar = Math.sqrt(distSq);
      
      const systemLimit = 3.75e13; // approx 250 AU

      // 1. ASTEROID BELTS
      if (sys.asteroidBelts) {
        for (const belt of sys.asteroidBelts) {
          const R_min = belt.minRadius;
          const R_max = belt.maxRadius;
          
          if (distToStar > R_min * 0.8 && distToStar < R_max * 1.25) {
            const R_c = (R_min + R_max) / 2;
            const H_w = (R_max - R_min) / 2;
            const sigma = H_w / 2.5; 
            
            const pBelt = Math.exp(-Math.pow(distToStar - R_c, 2) / (2 * sigma * sigma));
            if (pBelt > density) {
              density = pBelt;
              gridType = 'SYSTEM';
              parentId = `sys-${sys.id}`;
            }
          }
        }
      }

      // 2. ORBITAL CLUSTERS
      if (sys.asteroidClusters) {
        for (const cluster of sys.asteroidClusters) {
          const cAngle = cluster.orbitAngle || 0;
          const cRadius = cluster.orbitRadius || 0;
          const cX = Math.cos(cAngle) * cRadius;
          const cY = Math.sin(cAngle) * cRadius;
          const distToCluster = Math.hypot(dx - cX, dy - cY);
          
          const noiseVal = this.noise(dx * 2e-6, dy * 2e-6);
          const distortedDist = distToCluster + noiseVal * (cluster.radius * 0.25);
          
          if (distortedDist < cluster.radius) {
            const cDensity = (cluster.density || 0.4) * (1.0 - distortedDist / cluster.radius);
            if (cDensity > density) {
              density = cDensity;
              gridType = 'SYSTEM';
              parentId = `sys-${sys.id}`;
            }
          }
        }
      }

      // 3. BACKGROUND OORT HAZE
      if (density < 0.15) {
        let backgroundDensity = 0.0;
        
        if (distToStar >= systemLimit) {
          const haloDist = distToStar - systemLimit;
          const decayDist = 1.5e13; // 100 AU decay scale
          const oortProb = 0.25 * Math.exp(-haloDist / decayDist);
          
          const anchorM = 1e15;
          const nx = cx - Math.floor(cx / anchorM) * anchorM;
          const ny = cy - Math.floor(cy / anchorM) * anchorM;
          const lowFreqNoise = (this.noise(nx * 1e-12, ny * 1e-12) + 1) / 2;
          backgroundDensity = oortProb * (0.7 + 0.3 * lowFreqNoise);
        }
        
        if (distToStar > systemLimit) {
          const anchorM = 1e15;
          const nx = cx - Math.floor(cx / anchorM) * anchorM;
          const ny = cy - Math.floor(cy / anchorM) * anchorM;
          const nebNoise = (this.noise(nx * 1e-11, ny * 1e-11) + 1) / 2;
          if (nebNoise > 0.4) {
            const nebulousProb = 0.04 + (nebNoise - 0.4) * 0.12;
            if (nebulousProb > backgroundDensity) {
              backgroundDensity = nebulousProb;
            }
          }
        }
        
        if (backgroundDensity > density) {
          density = backgroundDensity;
          gridType = 'SYSTEM';
          parentId = `oort-${sys.id}`;
        }
      }

      if (density > 0.01) {
          isAsteroidField = true;
      }
      
      return { isAsteroidField, gridType, parentId, density };
    }

    // ----- GLOBAL DEEP SPACE TOPOLOGY -----
    // 3. Rogue System Pockets
    const anchorM = 1e15;
    const nx = cx - Math.floor(cx / anchorM) * anchorM;
    const ny = cy - Math.floor(cy / anchorM) * anchorM;

    const rogueNoise = (this.noise(nx * 1.5e-12, ny * 1.5e-12) + 1) / 2;
    if (rogueNoise > 0.88) {
       const localPocketNoise = (this.noise(nx * 3e-11, ny * 3e-11) + 1) / 2;
       if (localPocketNoise > 0.65) {
          const rogueDensity = Math.min(1.0, (localPocketNoise - 0.65) / 0.35);
          if (rogueDensity > density) {
            density = rogueDensity;
          }
          if (density > 0.01) {
             return { isAsteroidField: true, gridType: 'GLOBAL', parentId: 'ROGUE_POCKET', density };
          }
       }
    }

    // 4. Sparse Nebulous Zones
    const nebNoise = (this.noise(nx * 1e-11, ny * 1e-11) + 1) / 2;
    if (nebNoise > 0.4) {
       const nebulousProb = 0.04 + (nebNoise - 0.4) * 0.12;
       if (nebulousProb > density) {
         density = nebulousProb;
       }
       if (density > 0.01) {
          return { isAsteroidField: true, gridType: 'GLOBAL', parentId: 'NEBULA', density };
       }
    }

    // 5. Absolute Voids: density is zero, no spawn.
    return { isAsteroidField: density > 0.01, gridType, parentId, density };
  }

  public lastWorldInfo: { currentSystem: StarSystem | null } = { currentSystem: null };
  private lastUpdateWorldX = -1e20;
  private lastUpdateWorldY = -1e20;
  private lastUpdateZoom = 0;
  private lastSystemId: string | null = null;

  /**
   * Обновляет состояние загруженных чанков вокруг заданной позиции.
   * Переключает мировую сетку при входе/выходе из звездных систем.
   */
  public update(pos: { sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number }, worldInfo: { currentSystem: StarSystem | null }, zoom: number = 1.0) {
    this.lastWorldInfo = worldInfo;
    const secSizeBI = BigInt(SECTOR_SIZE_M);
    // Maintain precision by breaking down coordinates into chunk steps
    // Since ASTEROID_CHUNK_SIZE is 1_000_000, we find chunk coordinates easily
    
    // Number() casting is completely safe up to 9 quadrillion.
    const worldX = Number(pos.sectorX * secSizeBI) + pos.offsetX;
    const worldY = Number(pos.sectorY * secSizeBI) + pos.offsetY;

    const currentSysId = worldInfo.currentSystem ? worldInfo.currentSystem.id : null;
    const systemChanged = currentSysId !== this.lastSystemId;

    const dx = Math.abs(worldX - this.lastUpdateWorldX);
    const dy = Math.abs(worldY - this.lastUpdateWorldY);
    const dz = Math.abs(this.lastUpdateZoom - zoom);

    if (!systemChanged && dx < ASTEROID_CHUNK_SIZE * 0.4 && dy < ASTEROID_CHUNK_SIZE * 0.4 && dz < 0.1 && this.loadedChunks.size > 0) {
      return; 
    }
    
    if (systemChanged) {
        for (const chunk of this.loadedChunks.values()) {
            if (this.onChunkUnloaded) this.onChunkUnloaded(chunk);
        }
        this.loadedChunks.clear();
        this.lastSystemId = currentSysId;
        this.cachedVisibleAsteroids = [];
    }

    this.lastUpdateWorldX = worldX;
    this.lastUpdateWorldY = worldY;
    this.lastUpdateZoom = zoom;

    const chunkX = Math.floor(worldX / ASTEROID_CHUNK_SIZE);
    const chunkY = Math.floor(worldY / ASTEROID_CHUNK_SIZE);

    let radius = 2; 

    const neededKeys = new Set<string>();
    
    for (let cx = chunkX - radius; cx <= chunkX + radius; cx++) {
      for (let cy = chunkY - radius; cy <= chunkY + radius; cy++) {
        const key = `${cx},${cy}`;
        neededKeys.add(key);
        
        if (!this.loadedChunks.has(key)) {
          this.loadChunk(cx, cy, worldInfo);
          this.cachedVisibleAsteroids = []; // Invalidate cache
        }
      }
    }
    
    // Unload chunks that are out of bounds
    for (const key of this.loadedChunks.keys()) {
      if (!neededKeys.has(key)) {
        const chunk = this.loadedChunks.get(key);
        if (chunk && this.onChunkUnloaded) this.onChunkUnloaded(chunk);
        this.loadedChunks.delete(key);
        this.cachedVisibleAsteroids = [];
      }
    }
  }

  private loadChunk(x: number, y: number, worldInfo: { currentSystem: StarSystem | null }) {
    const cx = x * ASTEROID_CHUNK_SIZE + (ASTEROID_CHUNK_SIZE / 2);
    const cy = y * ASTEROID_CHUNK_SIZE + (ASTEROID_CHUNK_SIZE / 2);
    
    // Find highest density at the corners and center to determine if this chunk spans any asteroid field
    const pts = [
        [cx, cy],
        [cx - ASTEROID_CHUNK_SIZE * 0.45, cy - ASTEROID_CHUNK_SIZE * 0.45],
        [cx + ASTEROID_CHUNK_SIZE * 0.45, cy - ASTEROID_CHUNK_SIZE * 0.45],
        [cx - ASTEROID_CHUNK_SIZE * 0.45, cy + ASTEROID_CHUNK_SIZE * 0.45],
        [cx + ASTEROID_CHUNK_SIZE * 0.45, cy + ASTEROID_CHUNK_SIZE * 0.45],
        [cx, cy + ASTEROID_CHUNK_SIZE * 0.45],
        [cx + ASTEROID_CHUNK_SIZE * 0.45, cy],
    ];

    let maxDensity = 0;
    let finalIsField = false;
    let finalGridType: GridType = 'GLOBAL';
    let finalParentId = 'GLOBAL';

    for(const p of pts) {
       const str = this.getAsteroidFieldStrength(p[0], p[1], worldInfo);
       if (str.density > maxDensity) {
           maxDensity = str.density;
           finalIsField = str.isAsteroidField;
           finalGridType = str.gridType;
           finalParentId = str.parentId;
       }
    }

    const chunk: AsteroidChunk = {
      x, y, cx, cy,
      gridType: finalGridType,
      parentId: finalParentId,
      isAsteroidField: finalIsField,
      density: maxDensity,
      asteroids: []
    };

    const chunkKey = `${x},${y}`;
    this.loadedChunks.set(chunkKey, chunk);

    // Проверяем наличие частично сохраненного чанка
    const compoundKey = `${finalParentId}_${x}_${y}`;
    const modified = this.modifiedChunks.get(compoundKey);
    const thirtyMinutesMs = 30 * 60 * 1000;

    if (modified && (Date.now() - modified.lastModified < thirtyMinutesMs)) {
       // Восстанавливаем сохранённое состояние со всеми BigInt
       chunk.asteroids = modified.asteroids.map((ast: any) => ({
         ...ast,
         sectorX: BigInt(ast.sectorX),
         sectorY: BigInt(ast.sectorY),
       }));
       if (this.onChunkLoaded) this.onChunkLoaded(chunk);
       this.cachedVisibleAsteroids = []; // Сброс кэша видимых объектов
    } else {
       if (modified) {
          // Удаляем просроченный чанк из истории модификаций
          this.modifiedChunks.delete(compoundKey);
       }
       
       if (finalIsField && maxDensity > 0.01 && this.worker) {
          let sysPayload = null;
          if (worldInfo && worldInfo.currentSystem) {
             const sys = worldInfo.currentSystem;
             sysPayload = {
                id: sys.id,
                sectorX: sys.sectorX.toString(),
                sectorY: sys.sectorY.toString(),
                offsetX: sys.offsetX,
                offsetY: sys.offsetY,
                sysWorldX: (worldInfo as any).sysWorldX,
                sysWorldY: (worldInfo as any).sysWorldY,
                asteroidBelts: sys.asteroidBelts,
                asteroidClusters: sys.asteroidClusters
             };
          }

          this.worker.postMessage({
            type: 'GENERATE',
            payload: {
               chunkKey,
               x,
               y,
               chunkDensity: maxDensity,
               gridType: finalGridType,
               sys: sysPayload
            }
          });
       } else {
          if (this.onChunkLoaded) this.onChunkLoaded(chunk);
       }
    }
  }

  private cachedVisibleAsteroids: AsteroidObject[] = [];
  private lastViewMinX = -1e20;
  private lastViewMinY = -1e20;
  private lastViewMaxX = -1e20;
  private lastViewMaxY = -1e20;
  private lastViewMinRadius = 0;
  private lastViewTargetIds = '';
 
  public getVisibleAsteroids(
      viewMinX?: number, viewMinY?: number, viewMaxX?: number, viewMaxY?: number,
      minRadius: number = 0, targetId1: string | null = null, targetId2: string | null = null
  ): AsteroidObject[] {
    const checkBounds = viewMinX !== undefined && viewMaxX !== undefined;
    if (!checkBounds) return this.cachedVisibleAsteroids;
 
    const viewWidth = viewMaxX! - viewMinX!;
    const movementThreshold = Math.max(50, viewWidth * 0.05);
    const targetIdStr = `${targetId1 || ''}-${targetId2 || ''}`;
    
    if (Math.abs(viewMinX! - this.lastViewMinX) < movementThreshold &&
        Math.abs(viewMinY! - this.lastViewMinY) < movementThreshold &&
        Math.abs(viewMaxX! - this.lastViewMaxX) < movementThreshold &&
        this.lastViewMinRadius === minRadius &&
        this.lastViewTargetIds === targetIdStr &&
        this.cachedVisibleAsteroids.length > 0) {
        return this.cachedVisibleAsteroids;
    }
 
    this.lastViewMinX = viewMinX!;
    this.lastViewMinY = viewMinY!;
    this.lastViewMaxX = viewMaxX!;
    this.lastViewMaxY = viewMaxY!;
    this.lastViewMinRadius = minRadius;
    this.lastViewTargetIds = targetIdStr;
 
    const list: AsteroidObject[] = [];
    const chunkMargin = (ASTEROID_CHUNK_SIZE * 0.5) + movementThreshold; 
 
    for (const chunk of this.loadedChunks.values()) {
      if (chunk.asteroids.length === 0) continue;
      
      const cx = chunk.cx;
      const cy = chunk.cy;
 
      // Fast AABB check for the chunk
      if (cx + chunkMargin < viewMinX! || cx - chunkMargin > viewMaxX! ||
          cy + chunkMargin < viewMinY! || cy - chunkMargin > viewMaxY!) {
        continue; 
      }
      
      const astMargin = 100000 + movementThreshold; 
      for (let i = 0; i < chunk.asteroids.length; i++) {
        const ast = chunk.asteroids[i];
        if (ast.depleted) continue;

        if (ast.radius < minRadius && ast.id !== targetId1 && ast.id !== targetId2) {
            continue;
        }
 
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

  public getActiveChunks(): AsteroidChunk[] {
    return Array.from(this.loadedChunks.values()).filter(c => c.isAsteroidField);
  }
}


import { createNoise2D } from 'simplex-noise';
import {
  MACRO_CELL_SIZE,
  MIN_STAR_DIST,
  CLUSTER_RADIUS_CELLS,
  SECTOR_SIZE_M,
  CHUNK_SIZE_M,
  DEEP_SPACE_CLUSTER_RADIUS_MIN_M,
  DEEP_SPACE_CLUSTER_RADIUS_MAX_M,
} from '../constants';
import { StarSystem, AsteroidCluster, AsteroidObject } from './types';
import { createRNG, hashString } from './utils';
import { StarSystemGenerator, buildBlobPolygon } from './StarSystemGenerator';

// Re-export types
export * from './types';

import { globalFactionManager } from './FactionManager';

export class WorldGenerator {
  public noise2D: (x: number, y: number) => number;
  private noise2D_b: (x: number, y: number) => number;
  private noise2D_c: (x: number, y: number) => number;
  private seed: string;
  
  private generatedMacroCells = new Set<string>();
  private starsInMacroCells = new Map<string, { sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number, id: string }[]>();
  private systemCache = new Map<string, StarSystem | null>();
  private factionTerritories = new Map<string, { factionId: string, isCapital: boolean, hasControlStation: boolean, hasShipyard: boolean, colonizedWorlds: number }>();
  
  private generatedSectors = new Set<string>();
  private systemGenerator: StarSystemGenerator;

  public clusterRadiusCells: number = CLUSTER_RADIUS_CELLS;
  public densityMultiplier: number = 1.0;

  constructor(seed: string, clusterRadius?: number, density?: number) {
    this.seed = seed;
    if (clusterRadius !== undefined) this.clusterRadiusCells = clusterRadius;
    if (density !== undefined) this.densityMultiplier = density;
    
    const s0 = hashString(seed);
    const s1 = hashString(seed + '_oct2');
    const s2 = hashString(seed + '_oct3');
    this.noise2D   = createNoise2D(() => s0);
    this.noise2D_b = createNoise2D(() => s1);
    this.noise2D_c = createNoise2D(() => s2);
    this.systemGenerator = new StarSystemGenerator(seed, this.noise2D);

    this.initializeProceduralFactions();
  }

  private initializeProceduralFactions() {
    const rng = createRNG(this.seed + '-territories');
    // Generate some procedural factions
    const numStates = 4 + Math.floor(rng() * 4); // 4 to 7 factions
    globalFactionManager.generateProceduralFactions(this.seed, numStates);
    const proceduralFactions = globalFactionManager.getAllFactions().filter(f => f.id.startsWith('PROC_FACTION_'));

    // Pre-calculate stars for a central area (e.g. macro cells -5, -5 to 5, 5)
    const bounds = 5;
    for (let mx = -bounds; mx <= bounds; mx++) {
      for (let my = -bounds; my <= bounds; my++) {
        this._generateMacroCell(mx, my);
      }
    }

    // Collect all stars in bounds to pick capitals and run BFS
    const allStarsInBounds: { id: string; mx: number; my: number }[] = [];
    for (let mx = -bounds; mx <= bounds; mx++) {
      for (let my = -bounds; my <= bounds; my++) {
         const stars = this.starsInMacroCells.get(`${mx},${my}`) || [];
         for (const s of stars) {
             allStarsInBounds.push({ id: s.id, mx, my });
         }
      }
    }

    // Deterministically scramble for picking capitals without bias
    allStarsInBounds.sort((a,b) => a.id.localeCompare(b.id));

    interface FactionStateInfo {
        factionId: string;
        potential: number;
        queue: { id: string, mx: number, my: number }[];
    }

    const expandingFactions: FactionStateInfo[] = [];

    // Assign capitals
    for (const f of proceduralFactions) {
       if (allStarsInBounds.length === 0) break;
       // We don't want start system to be capital of random faction
       let capIndex = Math.floor(rng() * allStarsInBounds.length);
       let capitalSystem = allStarsInBounds[capIndex];
       
       allStarsInBounds.splice(capIndex, 1);
       
       this.factionTerritories.set(capitalSystem.id, {
           factionId: f.id,
           isCapital: true,
           hasControlStation: true,
           hasShipyard: true,
           colonizedWorlds: 1 + Math.floor(rng() * 2) 
       });

       const startingPotential = 10 + Math.floor(rng() * 20); // 10 to 30 points

       expandingFactions.push({
           factionId: f.id,
           potential: startingPotential - 1, // 1 spent on capital
           queue: this._getStarConnections(capitalSystem.id, capitalSystem.mx, capitalSystem.my).map(cId => {
               // need to find mx, my of neighbor. we'll do search
               const match = allStarsInBounds.find(st => st.id === cId);
               return match ? { id: cId, mx: match.mx, my: match.my } : null;
           }).filter((c): c is {id:string,mx:number,my:number} => c !== null)
       });
    }

    // BFS expansion
    let active = true;
    while(active) {
        active = false;
        for (const info of expandingFactions) {
            if (info.potential > 0 && info.queue.length > 0) {
                active = true;
                // Pop front
                const current = info.queue.shift()!;
                if (!this.factionTerritories.has(current.id)) {
                    // Claim it
                    let cost = 1; // 1 for system claim
                    const buildControlStation = true; 
                    const buildShipyard = rng() > 0.7;
                    const colonies = rng() > 0.5 ? 1 : 0;
                    
                    if (buildShipyard) cost++;
                    if (colonies > 0) cost += colonies;

                    if (info.potential >= cost) {
                        this.factionTerritories.set(current.id, {
                            factionId: info.factionId,
                            isCapital: false,
                            hasControlStation: true,
                            hasShipyard: buildShipyard,
                            colonizedWorlds: colonies
                        });
                        info.potential -= cost;

                        // Add neighbors
                        const neighbors = this._getStarConnections(current.id, current.mx, current.my);
                        for (const n of neighbors) {
                            if (!this.factionTerritories.has(n)) {
                                // finding mx, my for it
                                const mxStr = n.split('-')[1];
                                const myStr = n.split('-')[2];
                                info.queue.push({ id: n, mx: parseInt(mxStr), my: parseInt(myStr) });
                            }
                        }
                    } else {
                        // Not enough potential to claim this system fully with these rolls.
                        // We could either scale back (no shipyard/colony) or just stop expanding here.
                        // Let's just claim the system with remaining potential if possible.
                        if (info.potential >= 1) {
                            this.factionTerritories.set(current.id, {
                                factionId: info.factionId,
                                isCapital: false,
                                hasControlStation: true,
                                hasShipyard: false,
                                colonizedWorlds: 0
                            });
                            info.potential -= 1;
                            
                            const neighbors = this._getStarConnections(current.id, current.mx, current.my);
                            for (const n of neighbors) {
                                if (!this.factionTerritories.has(n)) {
                                    const mxStr = n.split('-')[1];
                                    const myStr = n.split('-')[2];
                                    info.queue.push({ id: n, mx: parseInt(mxStr), my: parseInt(myStr) });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
  }

  private galaxyDensity(gx: number, gy: number): number {
    const oct1 = this.noise2D(gx * 0.02, gy * 0.02);
    const oct2 = this.noise2D_b(gx * 0.08, gy * 0.08);
    const oct3 = this.noise2D_c(gx * 0.3, gy * 0.3);
    let combined = oct1 * 0.6 + oct2 * 0.3 + oct3 * 0.1;
    
    // Create sharp clusters and deep voids
    if (combined > 0.0) combined = Math.pow(combined, 1.4);
    else combined = -Math.pow(Math.abs(combined), 0.8);
    
    return combined;
  }

  private _generateMacroCell(mx: number, my: number) {
    const key = `${mx},${my}`;
    if (this.generatedMacroCells.has(key)) return;
    this.generatedMacroCells.add(key);

    const distFromCenter = Math.sqrt(mx * mx + my * my);
    if (distFromCenter > this.clusterRadiusCells) {
      this.starsInMacroCells.set(key, []);
      return;
    }

    const rng = createRNG(`${this.seed}-macro-${mx}-${my}`);
    const rawDensity = this.galaxyDensity(mx, my);
    const density = Math.max(0, rawDensity);
    
    // Non-linear distribution: creates tightly packed clusters and sparse regions
    const maxStars = 25;
    const numStars = Math.floor(Math.pow(density, 2.0) * maxStars * this.densityMultiplier * (1 - distFromCenter / this.clusterRadiusCells));
    
    const stars: { sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number, id: string }[] = [];

    const macroSizeBI = BigInt(Math.floor(MACRO_CELL_SIZE || 9.46e16)); 
    const sectorSizeBI = BigInt(Number(SECTOR_SIZE_M));

    for (let i = 0; i < numStars; i++) {
      const macroOffsetX = rng() * Number(macroSizeBI);
      const macroOffsetY = rng() * Number(macroSizeBI);
      
      const absX = BigInt(mx) * macroSizeBI + BigInt(Math.floor(macroOffsetX));
      const absY = BigInt(my) * macroSizeBI + BigInt(Math.floor(macroOffsetY));
      
      let valid = true;
      for (const s of stars) {
        const sx = s.sectorX * sectorSizeBI + BigInt(Math.floor(s.offsetX));
        const sy = s.sectorY * sectorSizeBI + BigInt(Math.floor(s.offsetY));
        const dx = sx - absX;
        const dy = sy - absY;
        const distSq = dx * dx + dy * dy;
        const minDist = BigInt(Math.floor(MIN_STAR_DIST));
        if (distSq < minDist * minDist) {
          valid = false;
          break;
        }
      }
      if (valid) {
        const sectorX = absX / sectorSizeBI;
        const sectorY = absY / sectorSizeBI;
        const offsetX = Number(absX % sectorSizeBI);
        const offsetY = Number(absY % sectorSizeBI);
        
        stars.push({ 
          sectorX, 
          sectorY, 
          offsetX, 
          offsetY, 
          id: `sys-${mx}-${my}-${i}` 
        });
      }
    }
    this.starsInMacroCells.set(key, stars);
  }

  private _getStarConnections(starId: string, mx: number, my: number): string[] {
    const key = `${mx},${my}`;
    const stars = this.starsInMacroCells.get(key) || [];
    const sourceStar = stars.find(s => s.id === starId);
    if (!sourceStar) return [];

    const neighbors: { id: string, x: number, y: number }[] = [];
    for (let ox = -2; ox <= 2; ox++) {
      for (let oy = -2; oy <= 2; oy++) {
        const nKey = `${mx + ox},${my + oy}`;
        this._generateMacroCell(mx + ox, my + oy);
        const nStars = this.starsInMacroCells.get(nKey) || [];
        for (const ns of nStars) {
          if (ns.id === starId) continue;
          neighbors.push({
            id: ns.id,
            x: Number(ns.sectorX) * Number(SECTOR_SIZE_M) + ns.offsetX,
            y: Number(ns.sectorY) * Number(SECTOR_SIZE_M) + ns.offsetY
          });
        }
      }
    }

    const sx = Number(sourceStar.sectorX) * Number(SECTOR_SIZE_M) + sourceStar.offsetX;
    const sy = Number(sourceStar.sectorY) * Number(SECTOR_SIZE_M) + sourceStar.offsetY;

    const rng = createRNG(`${this.seed}-conn-${starId}`);
    
    // Increased search radius to handle sparse regions better
    const reachRadius = (15 + rng() * 15) * 9.46e15; 
    const reachRadiusSq = reachRadius * reachRadius;

    // Divide space into 6 sectors to ensure reaching out in all directions
    const sectors: { id: string, d2: number }[][] = Array.from({ length: 6 }, () => []);
    
    for (const n of neighbors) {
      const dx = n.x - sx;
      const dy = n.y - sy;
      const d2 = dx * dx + dy * dy;
      
      if (d2 > reachRadiusSq || d2 < (1.0e15 ** 2)) continue; // Too far or too close

      const angle = Math.atan2(dy, dx);
      // Map angle from [-PI, PI] to [0, 6)
      let sectorIndex = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 6);
      if (sectorIndex >= 6) sectorIndex = 5;
      
      sectors[sectorIndex].push({ id: n.id, d2 });
    }

    const connections: string[] = [];
    for (const sList of sectors) {
      if (sList.length > 0) {
        // Pick nearest in this direction
        sList.sort((a, b) => a.d2 - b.d2);
        connections.push(sList[0].id);
      }
    }

    // If still have very few connections, pick a couple more closest ones regardless of sector
    if (connections.length < 2) {
       const allValid = neighbors
         .map(n => ({ id: n.id, d2: (n.x - sx)**2 + (n.y - sy)**2 }))
         .filter(d => d.d2 < reachRadiusSq * 1.5)
         .sort((a,b) => a.d2 - b.d2)
         .slice(0, 3);
       
       for(const v of allValid) {
         if (!connections.includes(v.id)) connections.push(v.id);
       }
    }

    return connections.slice(0, 6); // Limit to 6 connections total
  }

  getSystemsInViewport(minSectorX: bigint, minSectorY: bigint, maxSectorX: bigint, maxSectorY: bigint): StarSystem[] {
    const systems: StarSystem[] = [];
    const sectorSizeBI = BigInt(Number(SECTOR_SIZE_M));
    const macroSizeBI = BigInt(Math.floor(MACRO_CELL_SIZE || 9.46e16));
    const sectorsPerMacroBI = macroSizeBI / sectorSizeBI;

    const minMacroX = Number(minSectorX >= 0n ? minSectorX / sectorsPerMacroBI : (minSectorX - sectorsPerMacroBI + 1n) / sectorsPerMacroBI);
    const minMacroY = Number(minSectorY >= 0n ? minSectorY / sectorsPerMacroBI : (minSectorY - sectorsPerMacroBI + 1n) / sectorsPerMacroBI);
    const maxMacroX = Number(maxSectorX >= 0n ? maxSectorX / sectorsPerMacroBI : (maxSectorX - sectorsPerMacroBI + 1n) / sectorsPerMacroBI);
    const maxMacroY = Number(maxSectorY >= 0n ? maxSectorY / sectorsPerMacroBI : (maxSectorY - sectorsPerMacroBI + 1n) / sectorsPerMacroBI);

    for (let mx = minMacroX; mx <= maxMacroX; mx++) {
      for (let my = minMacroY; my <= maxMacroY; my++) {
        this._generateMacroCell(mx, my);
        const stars = this.starsInMacroCells.get(`${mx},${my}`) || [];
        for (const s of stars) {
          const sys = this.getSystemById(s.id, s.sectorX, s.sectorY, s.offsetX, s.offsetY, mx, my);
          if (sys) systems.push(sys);
        }
      }
    }
    return systems;
  }

  getSystemById(id: string, sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number, mx?: number, my?: number): StarSystem | null {
    if (this.systemCache.has(id)) return this.systemCache.get(id)!;
    const system = this.systemGenerator.generate(id, sectorX, sectorY, offsetX, offsetY);
    
    // Add connections if mx/my provided
    if (mx !== undefined && my !== undefined) {
      system.connectedSystemIds = this._getStarConnections(id, mx, my);
    }

    // Apply faction territory
    const territory = this.factionTerritories.get(id);
    if (territory) {
        system.factionId = territory.factionId;
        
        const rng = createRNG(this.seed + '-station-' + id);
        // Add Control Station / Capital
        if (territory.isCapital || territory.hasControlStation) {
            system.spaceStations.push({
                id: `${id}-control-st`,
                factionId: territory.factionId,
                offsetX: 0,
                offsetY: 0,
                orbitRadius: system.stars[0].radius + 50_000_000,
                orbitSpeed: 2e-7,
                orbitTarget: system.stars[0].id,
                orbitTargetType: 'STAR',
                name: `${globalFactionManager.getFaction(territory.factionId)?.name || 'Unknown'} ${territory.isCapital ? 'Capital' : 'Control Station'}`,
                stationType: territory.isCapital ? 'CAPITAL' : 'CONTROL_STATION'
            });
        }
        
        // Add Shipyard
        if (territory.hasShipyard) {
            system.spaceStations.push({
                id: `${id}-shipyard-st`,
                factionId: territory.factionId,
                offsetX: 0,
                offsetY: 0,
                orbitRadius: system.stars[0].radius + 70_000_000,
                orbitSpeed: 1.8e-7,
                orbitTarget: system.stars[0].id,
                orbitTargetType: 'STAR',
                name: `${globalFactionManager.getFaction(territory.factionId)?.name || 'Unknown'} Shipyard`,
                stationType: 'SHIPYARD'
            });

            const faction = globalFactionManager.getFaction(territory.factionId);
            if (faction) {
                if (!faction.fleets) faction.fleets = [];
                faction.fleets.push({
                   id: `fl-${id}-${Math.floor(rng() * 10000)}`,
                   factionId: faction.id,
                   name: `Патрульный Флот`,
                   tasks: [],
                   memberEntities: [],
                   unloadedShipCount: 3 + Math.floor(rng() * 5),
                   position: { sectorX: system.sectorX, sectorY: system.sectorY, offsetX: system.offsetX, offsetY: system.offsetY },
                   isLoaded: false
                });
            }
        }

        // Apply colonies
        if (territory.colonizedWorlds > 0) {
            const habitablePlanets = system.planets.filter(p => p.isHabitable);
            let toColonize = territory.colonizedWorlds;
            const targets = habitablePlanets.length > 0 ? habitablePlanets : system.planets;
            for (let i = 0; i < toColonize && i < targets.length; i++) {
                const p = targets[i];
                const basePop = BigInt(100_000_000 + Math.floor(rng() * 5_000_000_000));
                const maxDistricts = Math.floor((p.radius / 300000) * (p.heightAccessibility || 1));
                p.colony = {
                    factionId: territory.factionId,
                    population: basePop,
                    jobs: {
                      worker: basePop / 2n,
                      farmer: basePop / 3n,
                    },
                    districts: [
                      { id: `c-${system.id}-${i}-d0`, type: 'government', buildingSlots: 3, specialization: "capital" },
                      { id: `c-${system.id}-${i}-d1`, type: 'residential', buildingSlots: 1 },
                      { id: `c-${system.id}-${i}-d2`, type: 'industrial', buildingSlots: 1 }
                    ],
                    maxDistricts: Math.max(3, maxDistricts),
                    housing: basePop * 2n,
                    amenities: 50,
                    growthRate: 1.0,
                    growthProgress: 0,
                    productionModifiers: {}
                };
            }
        }
    }

    this.systemCache.set(id, system);
    return system;
  }

  generateDeepSpaceClustersForSector(sectorX: bigint, sectorY: bigint): void {
    // Legacy support, now using AsteroidGridManager
  }

  getDeepSpaceClusters(): AsteroidCluster[] {
    return [];
  }

  getAllSystems(): StarSystem[] {
    return Array.from(this.systemCache.values()).filter(Boolean) as StarSystem[];
  }

  getNearestSystem(sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number): StarSystem | null {
    // Looking about 2000 sectors away (20 Trillion m) to catch stars whose influence covers this point
    const range = 2000n;
    const systems = this.getSystemsInViewport(sectorX - range, sectorY - range, sectorX + range, sectorY + range);
    if (systems.length === 0) return null;
    
    let nearest = systems[0];
    let minDist = Infinity;
    
    const worldX = Number(sectorX) * Number(SECTOR_SIZE_M) + offsetX;
    const worldY = Number(sectorY) * Number(SECTOR_SIZE_M) + offsetY;
    
    for (const s of systems) {
      const sx = Number(s.sectorX) * Number(SECTOR_SIZE_M) + s.offsetX;
      const sy = Number(s.sectorY) * Number(SECTOR_SIZE_M) + s.offsetY;
      const dist = Math.hypot(sx - worldX, sy - worldY);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    return nearest;
  }
}

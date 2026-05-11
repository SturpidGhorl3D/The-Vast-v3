import { GameEngine } from '../GameEngine';
import { Colony, District, JobType } from '../../world/types';
import { globalFactionManager } from '../../world/FactionManager';

export class EconomyManager {
  private engine: GameEngine;
  private lastUpdate: number = 0;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  update(dt: number) {
    const now = Date.now();
    
    // Smoothly interpolate unloaded fleets
    this.processUnloadedFleets(dt);

    // Proceed once per second for simulation
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = now;

    this.processColonies();
    this.processAsteroidStations();
    this.processShipUpkeep();
    this.processFactionAI();
  }

  private processUnloadedFleets(dt: number) {
    const MAX_STRAT_SPEED = 200000; // units per second in strat mode
    const factions = globalFactionManager.getAllFactions();
    for (const f of factions) {
      if (!f.fleets) continue;
      for (const fl of f.fleets) {
        if (!fl.isLoaded) {
          if (!fl.tasks || fl.tasks.length === 0) {
             // Generate a random roam task locally
             if (!fl.tasks) fl.tasks = [];
             fl.tasks.push({
                 id: `t-${Date.now()}`,
                 type: 'MOVE',
                 targetPos: {
                     sectorX: fl.position.sectorX + BigInt(Math.floor(Math.random() * 3) - 1),
                     sectorY: fl.position.sectorY + BigInt(Math.floor(Math.random() * 3) - 1),
                     offsetX: Math.random() * 10000,
                     offsetY: Math.random() * 10000
                 }
             });
          }

          const t = fl.tasks[0];
          if ((t.type === 'MOVE') && t.targetPos) {
             const dx = Number(t.targetPos.sectorX - fl.position.sectorX) * 10000 + (t.targetPos.offsetX - fl.position.offsetX);
             const dy = Number(t.targetPos.sectorY - fl.position.sectorY) * 10000 + (t.targetPos.offsetY - fl.position.offsetY);
             const dist = Math.hypot(dx, dy);
             
             if (dist < MAX_STRAT_SPEED * dt) {
                 fl.position = { ...t.targetPos };
                 fl.tasks.shift();
             } else {
                 const stepX = (dx / dist) * MAX_STRAT_SPEED * dt;
                 const stepY = (dy / dist) * MAX_STRAT_SPEED * dt;
                 fl.position.offsetX += stepX;
                 fl.position.offsetY += stepY;
                 
                 // Normalize sectors
                 if (fl.position.offsetX > 10000) { fl.position.offsetX -= 10000; fl.position.sectorX++; }
                 if (fl.position.offsetX < 0) { fl.position.offsetX += 10000; fl.position.sectorX--; }
                 if (fl.position.offsetY > 10000) { fl.position.offsetY -= 10000; fl.position.sectorY++; }
                 if (fl.position.offsetY < 0) { fl.position.offsetY += 10000; fl.position.sectorY--; }
             }
          }
        }
      }
    }
  }

  private processFactionAI() {
    const factions = globalFactionManager.getAllFactions();
    const systems = this.engine.world.getAllSystems ? this.engine.world.getAllSystems() : [];

    for (const faction of factions) {
      if (faction.isPlayer || !faction.inventory) continue;

      const inv = faction.inventory.resources;
      const energy = inv['ENERGY'] || 0;
      const ron = inv['GENERAL_PURPOSE_RESOURCES'] || 0;
      const foodKey = idxFoodKey(faction);
      const food = inv[foodKey] || 0;
      const civGoods = inv['CIVILIAN_GOODS'] || 0;

      // Find faction colonies
      let myCols: { planet: any, colony: Colony }[] = [];
      for (const sys of systems) {
        for (const p of sys.planets) {
          if (p.colony && p.colony.factionId === faction.id) {
            myCols.push({ planet: p, colony: p.colony });
          }
        }
      }
      if (myCols.length === 0) continue;

      // Deficit checks & reactions
      if (food < 100) {
        // Starving danger! Assign more farmers or build food districts
        for (const { colony } of myCols) {
           if (colony.districts.filter(d => d.type === 'food').length < colony.maxDistricts / 2) {
              const dId = `dist-food-${Date.now()}-${Math.random()}`;
              colony.districts.push({ id: dId, type: 'food', buildingSlots: 1 });
           }
           // Move workers to farmers
           if (colony.jobs.worker && colony.jobs.worker > 1000000n) {
             colony.jobs.worker -= 1000000n;
             colony.jobs.farmer = (colony.jobs.farmer || 0n) + 1000000n;
           }
        }
      }

      if (energy < 100) {
        for (const { colony } of myCols) {
           if (colony.districts.filter(d => d.type === 'energy').length < colony.maxDistricts / 2) {
              colony.districts.push({ id: `dist-energy-${Date.now()}-${Math.random()}`, type: 'energy', buildingSlots: 1 });
           }
           if (colony.jobs.worker && colony.jobs.worker > 1000000n) {
             colony.jobs.worker -= 1000000n;
             colony.jobs.technician = (colony.jobs.technician || 0n) + 1000000n;
           }
        }
      }

      if (ron < 100) {
        for (const { colony } of myCols) {
           if (colony.districts.filter(d => d.type === 'mining').length < colony.maxDistricts / 2) {
              colony.districts.push({ id: `dist-mining-${Date.now()}-${Math.random()}`, type: 'mining', buildingSlots: 1 });
           }
           if (colony.jobs.worker && colony.jobs.worker > 1000000n) {
             colony.jobs.worker -= 1000000n;
             colony.jobs.miner = (colony.jobs.miner || 0n) + 1000000n;
           }
        }
        // Build mining stations? (Handled at world scale)
      }

      if (civGoods < 100) {
        for (const { colony } of myCols) {
           if (colony.districts.filter(d => d.type === 'industrial').length < colony.maxDistricts / 2) {
              colony.districts.push({ id: `dist-ind-${Date.now()}-${Math.random()}`, type: 'industrial', buildingSlots: 1 });
           }
           // Need more workers, convert from entertainers or miners if abundant
           if (colony.jobs.entertainer && colony.jobs.entertainer > 1000000n) {
             colony.jobs.entertainer -= 1000000n;
             colony.jobs.worker = (colony.jobs.worker || 0n) + 1000000n;
           }
        }
      }
    }
  }

  private processColonies() {
    const factions = globalFactionManager.getAllFactions();

    // In a real scenario we'd query all colonies, but we can iterate loaded/cached systems or global faction colonies.
    // For now we will iterate over all systems' planets.
    const systems = this.engine.world.getAllSystems ? this.engine.world.getAllSystems() : [];
    
    for (const sys of systems) {
      for (const planet of sys.planets) {
        let col = planet.colony;
        if (!col) continue;

        const faction = globalFactionManager.getFaction(col.factionId);
        if (!faction) continue;

        // Base traits based on species
        let averageSize = 1.8; // Default
        let reproductiveFactor = 1.0; 
        
        // Let's assume faction has a primarySpeciesId or we use traits
        if (faction.species) {
          averageSize = faction.species.averageSizeMeters || 1.8;
          if (faction.species.traits?.includes('rapid_breeders')) reproductiveFactor += 0.1;
          if (faction.species.traits?.includes('slow_breeders')) reproductiveFactor -= 0.1;
        }

        // Habitability % (dummy logic for now, should calculate based on planet climate vs species preference)
        // Need habitability rules: e.g. matching climate = 1.0, adjacent = 0.6, else 0.2
        let habitability = 0.8; 

        // Size affects housing required per pop:
        // A 1.8m pop takes 1 housing space. 0.9m takes 0.5. 3.6m takes 2.0.
        const housingPerPop = averageSize / 1.8;
        
        // Calculate current total population
        const currentPopNumber = Number(col.population);

        // Update growth
        // Growth progress 0-1. Base growth depends on reproductiveFactor and habitability.
        // Size inversely affects reproduction speed (smaller = faster)
        const sizeGrowthModifier = 1.8 / Math.max(0.1, averageSize);
        let growthAdd = (0.01 * reproductiveFactor * habitability * sizeGrowthModifier);
        
        col.growthProgress = (col.growthProgress || 0) + growthAdd;
        if (col.growthProgress >= 1.0 && Number(col.population) * housingPerPop < Number(col.housing)) {
          col.population = col.population + 1n;
          col.growthProgress -= 1.0;
        }

        // Max housing from districts (e.g. residential gives 1000 base housing slots)
        let totalHousing = 0n;
        for (const d of col.districts) {
          if (d.type === 'residential') totalHousing += 1000n * BigInt(d.buildingSlots);
        }
        col.housing = totalHousing;

        // Produce resources
        if (!faction.inventory) faction.inventory = { resources: {}, maxCapacity: 1000000 };
        
        const production: { [key: string]: number } = {};
        const consumption: { [key: string]: number } = {};
        
        // Work efficiency relies on habitability, amenities, size
        const workEfficiency = habitability * (averageSize / 1.8);
        
        const jobs = col.jobs;
        if (jobs) {
          // Miner jobs -> РОН
          if (jobs.miner) {
             const ronProduced = Number(jobs.miner) * 10 * workEfficiency; // 10 tons per miner
             faction.inventory.resources['GENERAL_PURPOSE_RESOURCES'] = (faction.inventory.resources['GENERAL_PURPOSE_RESOURCES'] || 0) + ronProduced;
             production['GENERAL_PURPOSE_RESOURCES'] = ronProduced;
          }
          // Technician -> Energy
          if (jobs.technician) {
             const energyProduced = Number(jobs.technician) * 20 * workEfficiency;
             faction.inventory.resources['ENERGY'] = (faction.inventory.resources['ENERGY'] || 0) + energyProduced;
             production['ENERGY'] = energyProduced;
          }
          // Farmer -> Food
          if (jobs.farmer) {
             const foodKey = idxFoodKey(faction);
             const foodProduced = Number(jobs.farmer) * 15 * workEfficiency;
             faction.inventory.resources[foodKey] = (faction.inventory.resources[foodKey] || 0) + foodProduced;
             production[foodKey] = foodProduced;
          }
          // Worker -> Civilian goods
          if (jobs.worker) {
             const cgProduced = Number(jobs.worker) * 5 * workEfficiency;
             faction.inventory.resources['CIVILIAN_GOODS'] = (faction.inventory.resources['CIVILIAN_GOODS'] || 0) + cgProduced;
             production['CIVILIAN_GOODS'] = cgProduced;
          }
        }

        // Upkeep (Pop costs food and amenities)
        const foodNeed = currentPopNumber * (averageSize / 1.8);
        const foodKey = idxFoodKey(faction);
        consumption[foodKey] = foodNeed;
        
        if (faction.inventory.resources[foodKey] >= foodNeed) {
           faction.inventory.resources[foodKey] -= foodNeed;
        } else {
           // Starvation: halt growth
           col.growthProgress = Math.max(0, (col.growthProgress || 0) - 0.05);
        }

        col.lastProduction = production;
        col.lastConsumption = consumption;
      }
    }
  }

  private processAsteroidStations() {
     // Станции ... собирают РОН от шахтёрских флотов внутри непрогруженных астероидных чанков.
     const factions = globalFactionManager.getAllFactions();
     const systems = this.engine.world.getAllSystems ? this.engine.world.getAllSystems() : [];
     for (const sys of systems) {
       for (const station of sys.spaceStations) {
         if (station.stationType === 'TRADING_POST' || station.stationType === 'MILITARY_OUTPOST') {
            const faction = globalFactionManager.getFaction(station.factionId);
            if (!faction) continue;
            // station requires energy
            const energyUpkeep = 100;
            if (!faction.inventory) faction.inventory = { resources: {}, maxCapacity: 1000000 };
            if (faction.inventory.resources['ENERGY'] >= energyUpkeep) {
               faction.inventory.resources['ENERGY'] -= energyUpkeep;
               // "mining in unloaded asteroid chunks" -> abstract mechanic: generate GPR
               faction.inventory.resources['GENERAL_PURPOSE_RESOURCES'] = (faction.inventory.resources['GENERAL_PURPOSE_RESOURCES'] || 0) + 100;
            }
         }
       }
     }
  }

  private processShipUpkeep() {
     const playerEntity = this.engine.player;
     if (!playerEntity) return;

     // Iterate relevant ships (For now logic primarily handles player ship, but can apply to AI ships later)
     const entities = this.engine.ecs.getEntitiesWith(['Hull', 'Inventory']);
     for (const entity of entities) {
        const hull = this.engine.ecs.getHull(entity);
        const inv = this.engine.ecs.getComponent<any>(entity, 'Inventory');
        
        if (hull && inv) {
           // Calculate maxPopulation based on compartments
           let averageSize = 1.8;
           if (entity === playerEntity && this.engine.playerSpecies) {
              averageSize = this.engine.playerSpecies.averageSizeMeters || 1.8;
           }

           let space = 0;
           for (const comp of hull.compartments) {
              if (comp.type === 'BRIDGE') space += 10;
              // Maybe add other compartments
           }
           
           hull.maxPopulation = BigInt(Math.floor(space / (averageSize / 1.8)));
           if (!hull.population) hull.population = 1n; // Default crew of 1

           // Upkeep
           let ronNeed = 0;
           for (const comp of hull.compartments) {
              if (comp.type === 'REACTOR' || comp.type === 'ENGINE') {
                 ronNeed += 1;
              }
           }
           
           if (inv.resources['GENERAL_PURPOSE_RESOURCES'] >= ronNeed) {
               inv.resources['GENERAL_PURPOSE_RESOURCES'] -= ronNeed;
           } else {
               // Out of fuel logic could go here
           }
        }
     }
  }
}

function idxFoodKey(faction: any) {
  const t = faction.species?.speciesClass || 'ORGANIC';
  return `FOOD_${t}`;
}

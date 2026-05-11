import { StarSystem, PlanetData, PlanetType, AsteroidCluster, SpaceStation, ClimateClass, Satellite, PlanetaryRing, Colony, StarClass, Star, SatelliteClass } from './types';
import { createRNG } from './utils';
import { globalFactionManager } from './FactionManager';

// ... other imports
// we will replace the random assignment

import {
  PLANET_ORBIT_BASE_M,
  PLANET_ORBIT_STEP_M,
  PLANET_RADIUS_MAX_M,
  PLANET_RADIUS_MIN_M,
  STAR_RADIUS_MAX_M,
  STAR_RADIUS_MIN_M,
  ASTEROID_CLUSTER_RADIUS_MIN_M,
  ASTEROID_CLUSTER_RADIUS_MAX_M,
  AU_M,
  LIGHT_YEAR_M,
} from '../constants';

export function buildBlobPolygon(
  cx: number, cy: number, r: number, sides: number,
  rng: () => number, scaleX = 1, scaleY = 1, rotation = 0
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rotation;
    const noise = 0.55 + rng() * 0.9;
    const lx = Math.cos(a) * r * noise * scaleX;
    const ly = Math.sin(a) * r * noise * scaleY;
    pts.push({ x: cx + lx, y: cy + ly });
  }
  return pts;
}

export function buildRingPolygon(
  cx: number, cy: number, innerR: number, outerR: number, sides: number, rng: () => number
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a     = (i / sides) * Math.PI * 2;
    const noise = 0.88 + rng() * 0.24;
    pts.push({ x: cx + Math.cos(a) * outerR * noise, y: cy + Math.sin(a) * outerR * noise });
  }
  for (let i = sides - 1; i >= 0; i--) {
    const a     = (i / sides) * Math.PI * 2;
    const noise = 0.88 + rng() * 0.24;
    pts.push({ x: cx + Math.cos(a) * innerR * noise, y: cy + Math.sin(a) * innerR * noise });
  }
  return pts;
}

export class StarSystemGenerator {
  private seed: string;
  private noise: (x: number, y: number) => number;

  constructor(seed: string, noise: (x: number, y: number) => number) {
    this.seed = seed;
    this.noise = noise;
  }

  private randomStarClass(rng: () => number): StarClass {
      const r = rng();
      if (r < 0.001) return StarClass.O;
      if (r < 0.01) return StarClass.B;
      if (r < 0.04) return StarClass.A;
      if (r < 0.12) return StarClass.F;
      if (r < 0.35) return StarClass.G;
      if (r < 0.65) return StarClass.K;
      if (r < 0.95) return StarClass.M;
      if (r < 0.98) return StarClass.WD;
      if (r < 0.995) return StarClass.NS;
      return StarClass.BH;
  }

  private getStarColor(sc: StarClass, rng: () => number): string {
      switch (sc) {
          case StarClass.O: return '#99bbff';
          case StarClass.B: return '#aabbff';
          case StarClass.A: return '#ffffff';
          case StarClass.F: return '#ffffdd';
          case StarClass.G: return '#ffeeaa';
          case StarClass.K: return '#ffcc88';
          case StarClass.M: return '#ffaa66';
          case StarClass.WD: return '#ddddff';
          case StarClass.NS: return '#88ffff';
          case StarClass.BH: return '#000000';
      }
      return '#ffffff';
  }

  private getStarProps(sc: StarClass, rng: () => number): { radius: number, mass: number } {
      switch (sc) {
          case StarClass.O: return { radius: 10e9, mass: 60 }; 
          case StarClass.B: return { radius: 4e9, mass: 15 }; 
          case StarClass.A: return { radius: 1.6e9, mass: 2.1 }; 
          case StarClass.F: return { radius: 1.1e9, mass: 1.4 }; 
          case StarClass.G: return { radius: 7e8, mass: 1.0 }; 
          case StarClass.K: return { radius: 5.5e8, mass: 0.8 }; 
          case StarClass.M: return { radius: 3.5e8, mass: 0.4 }; 
          case StarClass.WD: return { radius: 1.2e7 + rng() * 1e8, mass: 0.8 }; 
          case StarClass.NS: return { radius: 2.5e4, mass: 1.4 }; 
          case StarClass.BH: return { radius: 1.5e5, mass: 15 }; 
      }
      return { radius: 7e8, mass: 1 };
  }

  generate(id: string, sectorX: bigint, sectorY: bigint, offsetX: number, offsetY: number): StarSystem {
    const rng = createRNG(`${this.seed}-${id}`);
    
    // Generate Stars
    const stars: Star[] = [];
    const systemTypeRoll = rng();
    
    let starCount = 1;
    if (systemTypeRoll > 0.95) starCount = 3;
    else if (systemTypeRoll > 0.70) starCount = 2; // Binary chance up

    let maxStarRadius = 0;
    
    for (let i = 0; i < starCount; i++) {
       const sClass = this.randomStarClass(rng);
       const props = this.getStarProps(sClass, rng);
       // Add some variation
       const radius = props.radius * (0.8 + rng() * 0.4);
       const mass = props.mass * (0.8 + rng() * 0.4);
       const color = this.getStarColor(sClass, rng);
       
       let orbitRadius = 0;
       let orbitSpeed = 0;
       let orbitAngle = rng() * Math.PI * 2;
       
       if (starCount === 2) {
           orbitRadius = (i === 0 ? 0.3 : 0.7) * (150 * AU_M * rng()); // Barycenter offset
           orbitSpeed = (1e-8 + rng() * 3e-8) * (i === 0 ? 1 : -1);
           if (i === 1) orbitAngle = stars[0].orbitAngle + Math.PI;
       } else if (starCount === 3) {
           if (i < 2) {
               orbitRadius = (i === 0 ? 0.2 : 0.4) * (20 * AU_M * rng());
               orbitSpeed = (1e-7 + rng() * 3e-7) * (i === 0 ? 1 : -1);
               if (i === 1) orbitAngle = stars[0].orbitAngle + Math.PI;
           } else {
               orbitRadius = 50 * AU_M + rng() * 100 * AU_M;
               orbitSpeed = 1e-9 + rng() * 5e-9;
           }
       }
       if (orbitRadius + radius > maxStarRadius) maxStarRadius = orbitRadius + radius;
       
       stars.push({
           id: `${id}-star-${i}`,
           name: `Star ${i === 0 ? 'Primary' : (i===1 ? 'Secondary' : 'Tertiary')}`,
           starClass: sClass,
           radius,
           mass,
           color,
           orbitRadius,
           orbitSpeed,
           orbitAngle,
           orbitCenterId: starCount > 1 ? 'barycenter' : undefined
       });
    }

    const starRadius = stars[0].radius; // keep for compat
    const starColor = stars[0].color; // keep for compat

    const baseGravisphere = (120 * AU_M) + rng() * (1 * LIGHT_YEAR_M); 
    const starSizeBonus = (maxStarRadius / STAR_RADIUS_MAX_M) * (1 * LIGHT_YEAR_M);
    const gravisphereRadius = Math.min(2 * LIGHT_YEAR_M, baseGravisphere + starSizeBonus);

    // Planets and Asteroid Belts mixed
    const planetCount = Math.floor(rng() * 8) + 1;
    const planets: PlanetData[] = [];
    const asteroidBelts: any[] = [];

    const isStartSystem = (sectorX === 0n && sectorY === 0n);

    // Faction assignment is now handled dynamically by FactionManager and WorldGenerator via state territory map.
    let factionId: string | undefined = undefined;

    // Начальное расстояние первой планеты от звезды (увеличено для реализма)
    let currentOrbit = maxStarRadius + PLANET_ORBIT_BASE_M * (2.5 + rng() * 4.5);

    for (let i = 0; i < planetCount + 2; i++) { // Intermix belts and planets
      const isBeltOrbit = rng() > 0.8;
      
      // Расстояние между орбитами планет: увеличено общее расстояние и добавлен большой случайный разброс
      const orbitSeparation = PLANET_ORBIT_STEP_M * (1.2 + rng() * 12.0);
      currentOrbit += orbitSeparation;
      
      if (isBeltOrbit) {
          const thickness = AU_M * (1.0 + rng() * 99.0); // 1 to 100 AU thickness 
          const beltSpeed = (1e-9 + rng() * 5e-8) * (rng() > 0.5 ? 1 : -1);
          asteroidBelts.push({
            id: `${id}-starbelt-${i}`,
            minRadius: currentOrbit,
            maxRadius: currentOrbit + thickness,
            threshold: 0.12 + rng() * 0.55,
            orbitCenterId: 'barycenter',
            orbitSpeed: beltSpeed
          });
          currentOrbit += thickness;
          continue;
      }
      
      const nearStar = currentOrbit < maxStarRadius + PLANET_ORBIT_BASE_M * 2.5;
      const type = this.randomPlanetType(rng());
      
      let radius = PLANET_RADIUS_MIN_M + rng() * (PLANET_RADIUS_MAX_M - PLANET_RADIUS_MIN_M);
      if (type === PlanetType.GAS_GIANT) {
          radius = 45_000_000 + rng() * 80_000_000; // 45k - 125k km
      } else if (type === PlanetType.ICE) {
          radius = 25_000_000 + rng() * 45_000_000; // 25k - 70k km (Ice giants are smaller than gas giants usually)
      } else if (type === PlanetType.ROCKY) {
          radius = 4_000_000 + rng() * 12_000_000; // Earth is 6.4M m
      }

      const mass = Math.pow(radius / PLANET_RADIUS_MIN_M, 2.5); 
      
      const isHabitable = type === PlanetType.OCEAN || type === PlanetType.ROCKY || type === PlanetType.DESERT;
      const climate = this.randomClimate(type, rng);

      const satellites: Satellite[] = [];
      if (rng() < (mass / 15.0) + 0.2) {
          const maxSatellites = Math.min(Math.floor(mass / 1.5) + 1, 8);
          const numSatellites = Math.floor(rng() * maxSatellites) + 1;
          // Расстояние первой луны от планеты увеличено (минимум 12 радиусов), чтобы избежать аномально близких орбит
          let currentSatOrbit = radius * (12.0 + rng() * 20.0);
          for (let sm = 0; sm < numSatellites; sm++) {
              let satType = SatelliteClass.ROCKY_MOON;
              const satRoll = rng();
              
              if (satRoll > 0.95) satType = SatelliteClass.BIOLUMINESCENT_MOON;
              else if (satRoll > 0.85) satType = SatelliteClass.HABITABLE_MOON;
              else if (satRoll > 0.7) satType = SatelliteClass.VOLCANIC_MOON;
              else if (satRoll > 0.5) satType = SatelliteClass.CAPTURED_ASTEROID;
              else if ((type === PlanetType.GAS_GIANT || type === PlanetType.ICE) && rng() > 0.4) satType = SatelliteClass.ICE_MOON;

              const satRadius = radius * (0.05 + rng() * 0.25); 
              let atmosphereHeight = 0;
              let atmosphereDensity = 0;
              let scatteringColor = '#aaccff';
              let humidity = 0;
              let color = '#999999';
              let isHabitable = false;

              // Усиливаем рандом расстояний между спутниками, используя аддитивный шаг для предотвращения экспоненциального разлета
              const orbitStep = radius * (15.0 + rng() * 35.0); 
              currentSatOrbit += orbitStep;

              if (satType === SatelliteClass.HABITABLE_MOON) {
                  const rDist = 4_000_000 + rng() * 4_000_000;
                  // Radius is directly set here instead of using multiplier
                  satellites.push({
                      id: `${id}-p${i}-s${sm}`,
                      type: satType,
                      isHabitable: true,
                      radius: rDist,
                      mass: Math.pow(rDist / 2_000_000, 2.5),
                      orbitRadius: currentSatOrbit,
                      orbitSpeed: 2e-5 * Math.pow(radius * 12.0 / currentSatOrbit, 1.5) * (0.5 + rng() * 1.5) * (rng() > 0.5 ? 1 : -1),
                      orbitAngle: rng() * Math.PI * 2,
                      orbitCenterId: `${id}-p${i}`,
                      rotationSpeed: (5e-6 + rng() * 5e-5), 
                      axisTilt: (rng() * 0.1),
                      cloudRotationSpeed: 2e-6 + rng() * 1e-5, 
                      atmosphereHeight: 0.04 + rng() * 0.04,
                      atmosphereDensity: 0.4 + rng() * 0.4,
                      scatteringColor: '#aaccff',
                      humidity: 0.4 + rng() * 0.5,
                      color: '#22aa44', // Greenish
                      resources: { IRON: Math.floor(rng() * 50), ICE: 20 }
                  });
                  continue;
              } else if (satType === SatelliteClass.BIOLUMINESCENT_MOON) {
                  color = '#112244';
                  scatteringColor = '#00ffaa';
                  atmosphereHeight = 0.08;
                  atmosphereDensity = 1.0;
              } else if (satType === SatelliteClass.VOLCANIC_MOON) {
                  color = '#442211';
                  scatteringColor = '#ff4400';
                  atmosphereHeight = 0.06;
                  atmosphereDensity = 0.8;
              } else if (satType === SatelliteClass.ICE_MOON) {
                  color = '#ddddff';
                  scatteringColor = '#88ccff';
              } else if (satType === SatelliteClass.CAPTURED_ASTEROID) {
                  const aRadius = 10_000 + rng() * 500_000;
                  satellites.push({
                      id: `${id}-p${i}-s${sm}`,
                      type: satType,
                      radius: aRadius,
                      mass: 0.0001,
                      orbitRadius: currentSatOrbit,
                      orbitSpeed: 2e-5 * Math.pow(radius * 12.0 / currentSatOrbit, 1.5) * (0.5 + rng() * 1.5) * (rng() > 0.5 ? 1 : -1),
                      orbitAngle: rng() * Math.PI * 2,
                      orbitCenterId: `${id}-p${i}`,
                      rotationSpeed: (5e-5 + rng() * 5e-4), 
                      axisTilt: (rng() * 0.5),
                      cloudRotationSpeed: 0, 
                      atmosphereHeight: 0,
                      atmosphereDensity: 0,
                      scatteringColor: '#ffffff',
                      humidity: 0,
                      color: '#666666',
                      resources: { IRON: Math.floor(rng() * 30) }
                  });
                  continue;
              }

              satellites.push({
                  id: `${id}-p${i}-s${sm}`,
                  type: satType,
                  isHabitable: satType === SatelliteClass.BIOLUMINESCENT_MOON,
                  radius: satRadius,
                  mass: Math.pow(satRadius / (PLANET_RADIUS_MIN_M * 0.5), 2.5),
                  orbitRadius: currentSatOrbit,
                  orbitSpeed: 2e-5 * Math.pow(radius * 12.0 / currentSatOrbit, 1.5) * (0.5 + rng() * 1.5) * (rng() > 0.5 ? 1 : -1),
                  orbitAngle: rng() * Math.PI * 2,
                  orbitCenterId: `${id}-p${i}`,
                  rotationSpeed: (5e-6 + rng() * 5e-5), 
                  axisTilt: (rng() * 0.1),
                  cloudRotationSpeed: rng() > 0.8 ? (2e-6 + rng() * 1e-5) : 0, 
                  atmosphereHeight,
                  atmosphereDensity,
                  scatteringColor,
                  humidity,
                  color,
                  resources: { IRON: Math.floor(rng() * 50) }
              });
          }
      }

      let ring: PlanetaryRing | undefined = undefined;
      if (mass > 4.0 && rng() > 0.5) {
          const innerR = radius * (1.2 + rng() * 0.8);
          const thickness = radius * (0.2 + rng() * 1.5);
          const isAsteroids = rng() > 0.5; // Make it actual asteroids
          
          if (isAsteroids) {
              const beltSpeed = (2e-6 + rng() * 1e-5) * (rng() > 0.5 ? 1 : -1);
              asteroidBelts.push({
                  id: `${id}-p${i}-belt`,
                  minRadius: innerR,
                  maxRadius: innerR + thickness,
                  threshold: 0.2 + rng() * 0.5,
                  orbitCenterId: `${id}-p${i}`, 
                  orbitSpeed: beltSpeed
              });
          } else {
              ring = {
                  innerRadius: innerR,
                  outerRadius: innerR + thickness,
                  thickness,
                  color: `rgba(${Math.floor(100+rng()*155)}, ${Math.floor(100+rng()*155)}, ${Math.floor(100+rng()*155)}, 0.4)`
              };
          }
      }

      let colony: Colony | undefined;
      const heightAccessibility = 0.5 + rng() * 0.5; // From 0.5 to 1.0 usable altitude span

      if (factionId && isHabitable && rng() > 0.3) {
          const basePop = BigInt(100_000_000 + Math.floor(rng() * 5_000_000_000));
          const maxDistricts = Math.floor((radius / 300000) * heightAccessibility);
          colony = {
              factionId,
              population: basePop,
              jobs: {
                worker: basePop / 2n,
                farmer: basePop / 3n,
              },
              districts: [
                { id: `${id}-p${i}-d0`, type: 'government', buildingSlots: 3 }
              ],
              maxDistricts: Math.max(1, maxDistricts),
              housing: basePop * 2n,
              amenities: 50,
              growthRate: 1.01 + rng() * 0.04,
              growthProgress: 0,
              productionModifiers: { IRON: 1.0 }
          };
      }

      // Орбитальная скорость планеты: замедляется с удалением от звезды (Кеплеровское движение)
      // Базовая скорость приведения к AU (1.5e11 м) ~2e-7 rad/s (земная норма)
      const baseAngularSpeed = 2e-7 * Math.pow(AU_M / currentOrbit, 1.5);
      // Добавляем случайное варьирование +- 200% (от -100% до +300% от базы)
      const orbitalSpeed = baseAngularSpeed * (1.0 + (rng() * 4.0 - 2.0));

      planets.push({
        id: `${id}-p${i}`,
        type,
        climate,
        isHabitable,
        mass,
        radius,
        orbitRadius: currentOrbit,
        orbitSpeed: orbitalSpeed, 
        orbitAngle: rng() * Math.PI * 2,
        orbitCenterId: starCount > 1 ? 'barycenter' : `${id}-star-0`,
        rotationSpeed: (2e-6 + rng() * 8e-5), 
        axisTilt: (rng() * 0.5), 
        cloudRotationSpeed: (1e-6 + rng() * 2e-5),
        atmosphereHeight: this.getAtmosphereHeight(type, radius, rng),
        heightAccessibility,
        atmosphereDensity: this.getAtmosphereDensity(type, rng),
        scatteringColor: this.getScatteringColor(type, rng),
        humidity: rng(),
        color: this.planetColor(type),
        satellites,
        ring,
        colony,
        resources: {
          IRON: Math.floor(rng() * 100),
          TITANIUM: Math.floor(rng() * 50),
          NICKEL: Math.floor(rng() * 40),
          ...(nearStar ? {} : { ICE: Math.floor(rng() * 60) }),
        },
      });
    }

    const oortThickness = (50 * AU_M) + rng() * (200 * AU_M);
    const oortInner = gravisphereRadius - oortThickness;
    asteroidBelts.push({
      id: `${id}-oort`,
      minRadius: oortInner,
      maxRadius: gravisphereRadius,
      threshold: 0.04 + rng() * 0.08,
      orbitCenterId: 'barycenter',
      orbitSpeed: 5e-11 + rng() * 5e-10
    });

    const spaceStations: SpaceStation[] = [];
    if (factionId && (rng() > 0.2 || isStartSystem)) {
      const numStations = isStartSystem ? Math.max(1, Math.floor(rng() * 3) + 1) : Math.floor(rng() * 3) + 1;
      for (let i = 0; i < numStations; i++) {
        const targetOption = rng();
        let targetId = "star";
        let targetType: 'STAR' | 'PLANET' | 'SATELLITE' | 'ASTEROID_BELT' = 'STAR';
        let orbitBase = starRadius;
        let pidx = -1;
        
        if (targetOption > 0.3 && planets.length > 0) {
           targetType = 'PLANET';
           pidx = Math.floor(rng() * planets.length);
           targetId = planets[pidx].id;
           orbitBase = planets[pidx].radius;
           
           if (planets[pidx].satellites.length > 0 && rng() > 0.5) {
               targetType = 'SATELLITE';
               const sidx = Math.floor(rng() * planets[pidx].satellites.length);
               targetId = planets[pidx].satellites[sidx].id;
               orbitBase = planets[pidx].satellites[sidx].radius;
           }
        } else if (targetOption > 0.1 && asteroidBelts.length > 0 && !asteroidBelts[0].orbitCenterId?.includes('-p')) {
            targetType = 'ASTEROID_BELT';
            const beltx = asteroidBelts.filter(b => !b.orbitCenterId?.includes('-p'));
            const bidx = Math.floor(rng() * beltx.length);
            targetId = beltx[bidx].id;
            orbitBase = beltx[bidx].minRadius + (beltx[bidx].maxRadius - beltx[bidx].minRadius) / 2;
        }

        const typeRoll = rng();
        const stationType = typeRoll > 0.8 ? 'SHIPYARD' : (typeRoll > 0.4 ? 'MILITARY_OUTPOST' : 'TRADING_POST');
        
        const orbitRadius = targetType === 'ASTEROID_BELT' ? orbitBase : orbitBase + (10_000_000 + rng() * 40_000_000); 
        const orbitSpeed = targetType === 'ASTEROID_BELT' ? (1e-9 + rng() * 3e-9) : (1e-7 + rng() * 5e-7) * (rng() > 0.5 ? 1 : -1);

        spaceStations.push({
          id: `${id}-st${i}`,
          factionId,
          offsetX: 0, 
          offsetY: 0,
          orbitRadius,
          orbitSpeed,
          orbitTarget: targetType === 'ASTEROID_BELT' ? 'star' : targetId,
          orbitTargetType: targetType,
          name: `${globalFactionManager.getFaction(factionId)?.name} ${stationType.replace('_', ' ')}`,
          stationType: stationType as SpaceStation['stationType']
        });
      }
    }

    return {
      id, sectorX, sectorY, offsetX, offsetY,
      name: `System ${id.split('-').slice(1).join('-')}`,
      starColor,
      starRadius,
      stars,
      planets,
      asteroidClusters: [],
      asteroidBelts,
      factionId,
      spaceStations,
      gravisphereRadius
    };
  }

  private randomPlanetType(val: number): PlanetType {
    if (val < 0.2) return PlanetType.ROCKY;
    if (val < 0.4) return PlanetType.GAS_GIANT;
    if (val < 0.6) return PlanetType.ICE;
    if (val < 0.8) return PlanetType.VOLCANIC;
    if (val < 0.9) return PlanetType.OCEAN;
    return PlanetType.DESERT;
  }

  private randomClimate(type: PlanetType, rng: () => number): ClimateClass {
      switch (type) {
          case PlanetType.GAS_GIANT: return ClimateClass.GAS_GIANT;
          case PlanetType.ICE: return ClimateClass.ICE_GIANT;
          case PlanetType.VOLCANIC: return ClimateClass.VOLCANIC;
          case PlanetType.OCEAN: return rng() > 0.5 ? ClimateClass.OCEANIC : ClimateClass.TOXIC;
          case PlanetType.DESERT: return rng() > 0.5 ? ClimateClass.ARID : ClimateClass.BARREN;
          case PlanetType.ROCKY: 
          default:
              const r = rng();
              if (r < 0.3) return ClimateClass.TERRAN;
              if (r < 0.6) return ClimateClass.TUNDRA;
              return ClimateClass.BARREN;
      }
  }

  private planetColor(type: PlanetType): string {
    switch (type) {
      case PlanetType.ROCKY: return '#888888';
      case PlanetType.GAS_GIANT: return '#ffaa44';
      case PlanetType.ICE: return '#88ccff';
      case PlanetType.VOLCANIC: return '#ff4400';
      case PlanetType.OCEAN: return '#0044ff';
      case PlanetType.DESERT: return '#ccaa88';
    }
  }

  private getAtmosphereHeight(type: PlanetType, radius: number, rng: () => number): number {
    switch (type) {
      case PlanetType.GAS_GIANT: return 0.15 + rng() * 0.1;
      case PlanetType.OCEAN: return 0.05 + rng() * 0.05;
      case PlanetType.ROCKY: return 0.02 + rng() * 0.04;
      case PlanetType.DESERT: return 0.01 + rng() * 0.02;
      case PlanetType.ICE: return 0.03 + rng() * 0.03;
      case PlanetType.VOLCANIC: return 0.08 + rng() * 0.07;
      default: return 0.02;
    }
  }

  private getAtmosphereDensity(type: PlanetType, rng: () => number): number {
    switch (type) {
      case PlanetType.GAS_GIANT: return 0.8 + rng() * 0.2;
      case PlanetType.OCEAN: return 0.4 + rng() * 0.4;
      case PlanetType.ROCKY: return 0.2 + rng() * 0.3;
      case PlanetType.VOLCANIC: return 0.6 + rng() * 0.4;
      default: return 0.3;
    }
  }

  private getScatteringColor(type: PlanetType, rng: () => number): string {
    switch (type) {
      case PlanetType.GAS_GIANT: return rng() > 0.5 ? '#ffaa44' : '#44ccff';
      case PlanetType.OCEAN: return '#4488ff';
      case PlanetType.DESERT: return '#ffaa88';
      case PlanetType.VOLCANIC: return '#ff4422';
      case PlanetType.ICE: return '#aaccff';
      default: return '#ffffff';
    }
  }
}

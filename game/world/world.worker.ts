import { createNoise2D } from 'simplex-noise';
import { hashString } from './utils';
import { makeAsteroidResources } from './AsteroidGenerator';

const ASTEROID_CHUNK_SIZE = 1_000_000; 

let noise2D: ((x: number, y: number) => number) | null = null;
let seedStr: string = '';

// Re-implemented fast logic for workers without depending on main game state
function checkFieldStrength(cx: number, cy: number, currentSystemData: any, nearbySystems: any[]): number {
  if (!noise2D) return 0;

  // Faster skip: if base noise is extremely low, it won't be a field anyway
  const baseNoise = (noise2D(cx * 1.5e-5, cy * 1.5e-5) + 1) / 2;
  if (baseNoise < 0.25) return 0;
  
  let maxStrength = 0;
  const systemLimitSq = 1.40625e27; // (3.75e13)^2, approx 250 AU

  const checkOneSystem = (sys: any) => {
    const dx = cx - sys.cx;
    const dy = cy - sys.cy;
    const dSq = dx * dx + dy * dy;
    
    if (dSq < systemLimitSq) {
       const distToStar = Math.sqrt(dSq);
       if (distToStar >= sys.starRadius * 4) {
         if (sys.asteroidBelts) {
           for (let j = 0; j < sys.asteroidBelts.length; j++) {
             const belt = sys.asteroidBelts[j];
             const margin = 1000000; // Match manager margin 1000km
             if (distToStar > belt.minRadius - margin && distToStar < belt.maxRadius + margin) {
               const noiseVal = baseNoise - (belt.threshold * 0.9); // Match manager threshold leniency
               if (noiseVal > 0) {
                   const beltMid = (belt.minRadius + belt.maxRadius) / 2;
                   const beltHalfWidth = (belt.maxRadius - belt.minRadius) / 2 + margin;
                   const distFromMid = Math.abs(distToStar - beltMid);
                   const edgeFade = 1.0 - Math.min(1.0, distFromMid / beltHalfWidth);
                   
                   const strength = Math.min(1.0, noiseVal / (1.1 - belt.threshold)) * edgeFade;
                   if (strength > maxStrength) maxStrength = strength;
               }
             }
           }
         }
         
         if (sys.asteroidClusters) {
           for (let j = 0; j < sys.asteroidClusters.length; j++) {
             const cluster = sys.asteroidClusters[j];
             const cX = Math.cos(cluster.orbitAngle) * cluster.orbitRadius;
             const cY = Math.sin(cluster.orbitAngle) * cluster.orbitRadius;
             const distToCluster = Math.hypot(dx - cX, dy - cY);
             
             if (distToCluster < cluster.radius) {
               const noiseVal = baseNoise - (1.0 - cluster.density * 0.5); // Density affects threshold
               if (noiseVal > 0) {
                   const edgeFade = 1.0 - (distToCluster / cluster.radius);
                   const strength = Math.min(1.0, noiseVal / 0.5) * edgeFade;
                   if (strength > maxStrength) maxStrength = strength;
               }
             }
           }
         }
         
         return maxStrength;
       }
    }
    return maxStrength;
  };

  if (nearbySystems && nearbySystems.length > 0) {
      for (let i = 0; i < nearbySystems.length; i++) {
          const s = checkOneSystem(nearbySystems[i]);
          if (s > maxStrength) maxStrength = s;
          
          // If we are strictly inside a system's asteroid-relevant radius, 
          // we should be careful about deep space noise.
          const dx = cx - nearbySystems[i].cx;
          const dy = cy - nearbySystems[i].cy;
          if (dx*dx + dy*dy < systemLimitSq) {
              // We are inside a system. In a system, ONLY belts allowed.
              // So we return maxStrength immediately and skip deep noise check.
              return maxStrength;
          }

          if (maxStrength >= 0.95) break; 
      }
  } else if (currentSystemData) {
      maxStrength = checkOneSystem(currentSystemData);
      const dx = cx - currentSystemData.cx;
      const dy = cy - currentSystemData.cy;
      if (dx*dx + dy*dy < systemLimitSq) {
          return maxStrength; // Inside current system
      }
  }

  // Deep space: if no strong system field, check deep noise
  if (maxStrength < 1.0) {
    const deepNoise = (noise2D(cx * 4e-11, cy * 4e-11) + 1) / 2;
    if (deepNoise > 0.42 && baseNoise > 0.3) {
       const deepStrength = Math.min(1, (deepNoise - 0.42) / 0.4) * Math.min(1, (baseNoise - 0.3) / 0.6);
       const finalDeep = deepStrength * 0.75;
       if (finalDeep > maxStrength) maxStrength = finalDeep;
    }
  }

  return maxStrength;
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  if (type === 'INIT') {
    seedStr = payload.seed;
    noise2D = createNoise2D(() => hashString(seedStr));
    self.postMessage({ type: 'INIT_DONE', id });
  } 
  
  else if (type === 'GENERATE_CHUNK') {
    if (!noise2D) return;
    const { q, r, cx, cy, isAsteroidField, isSystem } = payload;
    
    // Seeded random for this specific chunk
    const rngSeed = hashString(`${seedStr}_chunk_${q}_${r}`);
    let m_w = rngSeed;
    let m_z = 987654321;
    const rng = () => {
        m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & 0xffffffff;
        m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & 0xffffffff;
        let res = ((m_z << 16) + m_w) & 0x7fffffff;
        return res / 2147483648;
    };

    // Increased count to matches AsteroidGridManager's intended density
    // User requested doubling: min 2k, max 10k
    const count = Math.floor(2000 + rng() * 8000); 
    const asteroids = [];
    
    for (let i = 0; i < count; i++) {
        const radius = 100 + Math.pow(rng(), 10) * 4900; 
        const isPlanetoid = radius > 2500; 
        const gray = Math.floor(80 + rng() * 120);
        const color = `rgb(${gray},${gray},${Math.floor(gray * 0.95)})`;
        
        // Scattered position. Using 2.0 multiplier to stay within the 2.1x margin
        const ax = cx + (rng() - 0.5) * ASTEROID_CHUNK_SIZE * 2.0;
        const ay = cy + (rng() - 0.5) * ASTEROID_CHUNK_SIZE * 2.0;
        
        const secSize = 10_000_000_000n;
        const axBI = BigInt(Math.floor(ax));
        const ayBI = BigInt(Math.floor(ay));
        
        const secX = axBI / secSize;
        const secY = ayBI / secSize;
        const oX = Number(axBI % secSize);
        const oY = Number(ayBI % secSize);
        
        const totalCapacity = Math.floor(Math.pow(radius / 100, 3) * 1000);
        
        asteroids.push({
           id: `ast-${q}-${r}-${i}`,
           sectorX: secX,
           sectorY: secY,
           offsetX: oX,
           offsetY: oY,
           rx: ax, 
           ry: ay,
           radius,
           isPlanetoid,
           color,
           totalCapacity,
           resources: makeAsteroidResources(rng, isPlanetoid, isSystem, totalCapacity)
        });
    }

    self.postMessage({ type: 'CHUNK_DONE', id, payload: { asteroids } });
  }
};

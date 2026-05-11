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
  const baseNoise = (noise2D(cx * 1e-10, cy * 1e-10) + 1) / 2;
  if (baseNoise < 0.3) return 0;
  
  let maxStrength = 0;
  const systemLimitSq = 1.40625e27; // (3.75e13)^2, approx 250 AU

  const checkOneSystem = (sys: any) => {
    const dx = cx - sys.cx;
    const dy = cy - sys.cy;
    const dSq = dx * dx + dy * dy;
    
    if (dSq < systemLimitSq && sys.asteroidBelts) {
       const distToStar = Math.sqrt(dSq);
       if (distToStar >= sys.starRadius * 4) {
         for (let j = 0; j < sys.asteroidBelts.length; j++) {
           const belt = sys.asteroidBelts[j];
           const margin = 150_000_000;
           if (distToStar > belt.minRadius - margin && distToStar < belt.maxRadius + margin) {
             const noiseVal = baseNoise - belt.threshold;
             if (noiseVal > 0) {
                 const beltMid = (belt.minRadius + belt.maxRadius) / 2;
                 const beltHalfWidth = (belt.maxRadius - belt.minRadius) / 2 + margin;
                 const distFromMid = Math.abs(distToStar - beltMid);
                 const edgeFade = 1.0 - Math.min(1.0, distFromMid / beltHalfWidth);
                 
                 // Resulting strength 0..1
                 return Math.min(1.0, noiseVal / (1.1 - belt.threshold)) * edgeFade;
             }
           }
         }
       }
    }
    return 0;
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
    if (deepNoise > 0.55 && baseNoise > 0.35) {
       const deepStrength = Math.min(1, (deepNoise - 0.55) / 0.4) * Math.min(1, (baseNoise - 0.35) / 0.6);
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
        
        const secSize = 10_000_000_000;
        const secX = BigInt(Math.floor(ax / secSize));
        const secY = BigInt(Math.floor(ay / secSize));

        const totalCapacity = Math.floor(Math.pow(radius / 100, 3) * 1000);
        
        asteroids.push({
           id: `ast-${q}-${r}-${i}`,
           sectorX: secX,
           sectorY: secY,
           offsetX: ax - Number(secX) * secSize,
           offsetY: ay - Number(secY) * secSize,
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

  else if (type === 'GENERATE_NOISE_MAP') {
      const { minX, minY, maxX, maxY, width, height, currentSystemData, playerPos, nearbySystems } = payload;
      
      const iWidth = Math.floor(width);
      const iHeight = Math.floor(height);
      const len = iWidth * iHeight * 4;
      
      if (!isFinite(len) || len <= 0 || len > 10 * 1024 * 1024) {
          console.warn("Invalid noise map dimensions:", width, height);
          self.postMessage({ type: 'NOISE_MAP_DONE', payload: { buffer: new Uint8Array(0), width: 0, height: 0 } });
          return;
      }
      
      const buffer = new Uint8Array(len);
      const stepX = (maxX - minX) / iWidth;
      const stepY = (maxY - minY) / iHeight;

      // Distance limit: 10 LY = 9.46e16 meters
      const LIMIT_SQ = Math.pow(9.46e16, 2);
      
      // Secondary filter for systems actually inside or near this noise map viewport
      // to avoid checking 20 systems if only 2 are relevant for the current slice
      const margin = (maxX - minX) * 0.5 + 1.25e13;
      const activeSystems = nearbySystems ? nearbySystems.filter((s: any) => {
          const dx = s.cx - (minX + maxX) / 2;
          const dy = s.cy - (minY + maxY) / 2;
          return (dx * dx + dy * dy) < margin * margin;
      }) : [];

      for (let y = 0; y < iHeight; y++) {
          const wy = minY + y * stepY;
          const rowOffset = y * iWidth;
          for (let x = 0; x < iWidth; x++) {
              const wx = minX + x * stepX;
              const i = (rowOffset + x) * 4;
              
              // Skip if too far from player ship
              const dx = wx - playerPos.x;
              const dy = wy - playerPos.y;
              if (dx*dx + dy*dy > LIMIT_SQ) {
                  continue;
              }

              const strength = checkFieldStrength(wx, wy, currentSystemData, activeSystems);
              if (strength > 0.02) {
                  // Core field (dark blue-grey mist) darkened per request
                  // Slightly higher alpha for clarity, modulated by strength
                  const alpha = Math.floor(strength * 90);
                  buffer[i] = 40; buffer[i+1] = 50; buffer[i+2] = 65; buffer[i+3] = alpha; 
              }
          }
      }

      (self as unknown as Worker).postMessage({ 
          type: 'NOISE_MAP_DONE', 
          id, 
          payload: { buffer, minX, minY, maxX, maxY, width: iWidth, height: iHeight, systemId: currentSystemData?.id } 
      }, [buffer.buffer]);
  }
};

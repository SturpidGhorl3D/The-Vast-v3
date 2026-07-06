/**
 * Asteroid Worker - Фоновый поток для тяжёлых процедурных вычислений.
 * Исключает блокировку основного UI-потока при генерации тысяч астероидов.
 */
import { createNoise2D } from 'simplex-noise';
import { createRNG } from './utils';
import { ASTEROID_CHUNK_SIZE } from './AsteroidGridManager';
import { SECTOR_SIZE_M } from '../constants';
import { makeAsteroidResources } from './AsteroidGenerator';

let noise2D: ((x: number, y: number) => number) | null = null;
let seedStr: string = '';

/**
 * Локальная копия функции расчёта плотности для использования внутри воркера.
 */
function getAsteroidFieldStrength(cx: number, cy: number, sys: any): { isAsteroidField: boolean, density: number } {
    let isAsteroidField = false;
    let density = 0.0;
    
    if (sys) {
        const sx = sys.sysWorldX !== undefined ? sys.sysWorldX : Number(BigInt(sys.sectorX) * BigInt(SECTOR_SIZE_M) + BigInt(Math.floor(sys.offsetX)));
        const sy = sys.sysWorldY !== undefined ? sys.sysWorldY : Number(BigInt(sys.sectorY) * BigInt(SECTOR_SIZE_M) + BigInt(Math.floor(sys.offsetY)));
        
        const dx = cx - sx;
        const dy = cy - sy;
        const distSq = dx*dx + dy*dy;
        const distToStar = Math.sqrt(distSq);
        
        const systemLimit = 3.75e13; // approx 250 AU

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
                    }
                }
            }
        }

        if (sys.asteroidClusters) {
            for (const cluster of sys.asteroidClusters) {
                const cAngle = cluster.orbitAngle || 0;
                const cRadius = cluster.orbitRadius || 0;
                const cX = Math.cos(cAngle) * cRadius;
                const cY = Math.sin(cAngle) * cRadius;
                const distToCluster = Math.hypot(dx - cX, dy - cY);
                
                const noiseVal = noise2D!(dx * 2e-6, dy * 2e-6);
                const distortedDist = distToCluster + noiseVal * (cluster.radius * 0.25);
                
                if (distortedDist < cluster.radius) {
                    const cDensity = (cluster.density || 0.4) * (1.0 - distortedDist / cluster.radius);
                    if (cDensity > density) {
                        density = cDensity;
                    }
                }
            }
        }

        if (density < 0.15) {
            let backgroundDensity = 0.0;
            if (distToStar >= systemLimit) {
                const haloDist = distToStar - systemLimit;
                const decayDist = 1.5e13;
                const oortProb = 0.25 * Math.exp(-haloDist / decayDist);
                const anchorM = 1e15;
                const nx = cx - Math.floor(cx / anchorM) * anchorM;
                const ny = cy - Math.floor(cy / anchorM) * anchorM;
                const lowFreqNoise = (noise2D!(nx * 1e-12, ny * 1e-12) + 1) / 2;
                backgroundDensity = oortProb * (0.7 + 0.3 * lowFreqNoise);
            }
            if (distToStar > systemLimit) {
                const anchorM = 1e15;
                const nx = cx - Math.floor(cx / anchorM) * anchorM;
                const ny = cy - Math.floor(cy / anchorM) * anchorM;
                const nebNoise = (noise2D!(nx * 1e-11, ny * 1e-11) + 1) / 2;
                if (nebNoise > 0.4) {
                    const nebulousProb = 0.04 + (nebNoise - 0.4) * 0.12;
                    if (nebulousProb > backgroundDensity) {
                        backgroundDensity = nebulousProb;
                    }
                }
            }
            if (backgroundDensity > density) {
                density = backgroundDensity;
            }
        }
        if (density > 0.01) isAsteroidField = true;
        return { isAsteroidField, density };
    }

    const anchorM = 1e15;
    const nx = cx - Math.floor(cx / anchorM) * anchorM;
    const ny = cy - Math.floor(cy / anchorM) * anchorM;

    const rogueNoise = (noise2D!(nx * 1.5e-12, ny * 1.5e-12) + 1) / 2;
    if (rogueNoise > 0.88) {
       const localPocketNoise = (noise2D!(nx * 3e-11, ny * 3e-11) + 1) / 2;
       if (localPocketNoise > 0.65) {
          const rogueDensity = Math.min(1.0, (localPocketNoise - 0.65) / 0.35);
          if (rogueDensity > density) density = rogueDensity;
          if (density > 0.01) return { isAsteroidField: true, density };
       }
    }

    const nebNoise = (noise2D!(nx * 1e-11, ny * 1e-11) + 1) / 2;
    if (nebNoise > 0.4) {
       const nebulousProb = 0.04 + (nebNoise - 0.4) * 0.12;
       if (nebulousProb > density) density = nebulousProb;
       if (density > 0.01) return { isAsteroidField: true, density };
    }

    return { isAsteroidField: density > 0.01, density };
}

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        seedStr = payload.seed;
        noise2D = createNoise2D(createRNG(seedStr + '_oct1'));
        self.postMessage({ type: 'INIT_DONE' });
    } 
    else if (type === 'GENERATE') {
        if (!noise2D) return;
        
        const { chunkKey, x, y, chunkDensity, gridType, sys } = payload;
        
        const rng = createRNG(`chunk-${x}-${y}`);
        const baseCount = 1000 + rng() * 3000;
        const targetCount = Math.floor(baseCount * Math.pow(chunkDensity, 0.75));
        
        let generated = 0;
        let attempts = 0;
        const maxAttempts = targetCount * 5;

        const secSizeBI = BigInt(SECTOR_SIZE_M);
        const asteroids = [];

        while(generated < targetCount && attempts < maxAttempts) {
            attempts++;
            
            const rx = x * ASTEROID_CHUNK_SIZE + rng() * ASTEROID_CHUNK_SIZE;
            const ry = y * ASTEROID_CHUNK_SIZE + rng() * ASTEROID_CHUNK_SIZE;

            const strength = getAsteroidFieldStrength(rx, ry, sys);
            if (!strength.isAsteroidField || strength.density < 0.01) {
                continue; 
            }

            const radius = 100 + Math.pow(rng(), 10) * 4900; 
            const isPlanetoid = radius > 2500; 
            const gray = Math.floor(80 + rng() * 120);
            const color = `rgb(${gray},${gray},${Math.floor(gray * 0.95)})`;

            const worldXBI = BigInt(Math.floor(rx));
            const worldYBI = BigInt(Math.floor(ry));
            
            let secXBI = worldXBI / secSizeBI;
            let oXBI = worldXBI % secSizeBI;
            if (oXBI < 0n) {
                secXBI -= 1n;
                oXBI += secSizeBI;
            }
            
            let secYBI = worldYBI / secSizeBI;
            let oYBI = worldYBI % secSizeBI;
            if (oYBI < 0n) {
                secYBI -= 1n;
                oYBI += secSizeBI;
            }

            const totalCapacity = Math.floor(Math.pow(radius / 100, 3) * 1000);

            asteroids.push({
                id: `ast-${x}-${y}-${generated}`,
                sectorX: secXBI.toString(),
                sectorY: secYBI.toString(),
                offsetX: Number(oXBI),
                offsetY: Number(oYBI),
                rx: rx, 
                ry: ry,
                radius,
                isPlanetoid,
                color,
                totalCapacity,
                resources: makeAsteroidResources(rng, isPlanetoid, gridType === 'SYSTEM', totalCapacity)
            });

            generated++;
        }

        self.postMessage({ type: 'CHUNK_DONE', payload: { chunkKey, asteroids } });
    }
};

import { Hull, Compartment, Deck, Point } from '../engine/types';
import { SPECIES_CLASS_LABELS, ShipConstructionType } from '../../components/game/speciesTypes';

const MARGIN = 10;
const TILE = 50;

function createRectPolygon(w: number, h: number, cx: number, cy: number): Point[] {
    const hw = w / 2;
    const hh = h / 2;
    return [
        { x: cx - hw, y: cy - hh },
        { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh },
    ];
}

export interface DesignDNA {
    hullStyle: 'ORGANIC' | 'CRYSTALLID' | 'INDUSTRIAL' | 'BRUTALIST' | 'AVIAN';
    aggressiveness: number; // 0..1 (spikes, length)
    density: number; // 0..1 (fat vs thin)
    symmetry: 'MIRROR' | 'RADIAL' | 'ASYMMETRIC';
    colorMode: 'VIBRANT' | 'DULL' | 'MONO';
}

function generateProceduralShape(dna: DesignDNA, length: number, width: number, rng: () => number): Point[] {
    const points: Point[] = [];
    const segments = 8 + Math.floor(dna.hullStyle === 'ORGANIC' ? 12 : 4);
    
    if (dna.hullStyle === 'CRYSTALLID') {
        const spikes = 3 + Math.floor(rng() * 4);
        for(let i = 0; i < spikes; i++) {
            const angle = (Math.PI * 2 * i) / spikes;
            const r = width * (0.5 + rng() * 1.5);
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * length * 0.5 });
        }
    } else if (dna.hullStyle === 'ORGANIC') {
        for(let i = 0; i < segments; i++) {
            const t = i / segments;
            const angle = t * Math.PI * 2;
            const bulge = Math.sin(t * Math.PI) * width;
            const noise = (rng() - 0.5) * width * 0.2;
            points.push({ 
                x: Math.cos(angle) * (width + noise), 
                y: Math.sin(angle) * length * 0.5 
            });
        }
    } else if (dna.hullStyle === 'AVIAN') {
        // Forward beak
        points.push({ x: 0, y: -length * 0.6 });
        // Wings
        points.push({ x: width * 1.5, y: -length * 0.1 });
        points.push({ x: width * 0.5, y: length * 0.2 });
        // Tail
        points.push({ x: 0, y: length * 0.4 });
        points.push({ x: -width * 0.5, y: length * 0.2 });
        points.push({ x: -width * 1.5, y: -length * 0.1 });
    } else {
        // INDUSTRIAL / BRUTALIST (Blocky)
        points.push({ x: -width * 0.5, y: -length * 0.5 });
        points.push({ x: width * 0.5, y: -length * 0.5 });
        points.push({ x: width * 0.8, y: 0 });
        points.push({ x: width * 0.5, y: length * 0.5 });
        points.push({ x: -width * 0.5, y: length * 0.5 });
        points.push({ x: -width * 0.8, y: 0 });
    }

    return points;
}

export function generateProceduralHull(factionId: string, shipType: ShipConstructionType, seed: number): Hull {
    const rng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Construct DNA from seed or type
    const dna: DesignDNA = {
        hullStyle: shipType === 'CRYSTALLID' ? 'CRYSTALLID' : 
                   shipType === 'ORGANIC' ? 'ORGANIC' : 
                   shipType === 'BIOMECHANICAL' ? 'AVIAN' : 'INDUSTRIAL',
        aggressiveness: rng(),
        density: 0.3 + rng() * 0.7,
        symmetry: rng() > 0.1 ? 'MIRROR' : 'ASYMMETRIC',
        colorMode: 'VIBRANT'
    };

    let color = '#ccc';
    if (shipType === 'CRYSTALLID') color = '#00ffff';
    else if (shipType === 'BIOMECHANICAL') color = '#cc3300';
    else if (shipType === 'ORGANIC') color = '#44cc44';

    const hullLength = 4 + Math.floor(rng() * 6); 
    const hullWidth = 1 + Math.floor(rng() * 3);

    const mainDeckWidth = hullWidth * TILE * dna.density * 2;
    const mainDeckLength = hullLength * TILE * 2;

    const mainPoints = generateProceduralShape(dna, mainDeckLength, mainDeckWidth, rng);

    const decks: Deck[] = [{
        level: 0,
        color: color,
        points: mainPoints
    }];

    const compartments: Compartment[] = [];
    let curId = 0;

    // Bridge - always forward-ish
    compartments.push({
        id: `c_${curId++}`,
        type: 'BRIDGE',
        x: 0, y: -mainDeckLength * 0.25,
        width: Math.min(mainDeckWidth * 0.4, TILE), height: TILE,
        startDeck: 0, endDeck: 0,
        color: '#aaaaaa'
    });

    // Engine - always back
    const engineWidth = Math.max(TILE, mainDeckWidth * 0.6);
    compartments.push({
        id: `c_${curId++}`,
        type: 'ENGINE',
        x: 0, y: mainDeckLength * 0.4,
        width: engineWidth, height: TILE * 2,
        startDeck: 0, endDeck: 0,
        color: '#ff4400',
        engineConfig: { thrust: 50 * hullLength, fuelPerSec: 10 }
    });

    // Reactor
    compartments.push({
        id: `c_${curId++}`,
        type: 'REACTOR',
        x: 0, y: mainDeckLength * 0.1,
        width: TILE, height: TILE,
        startDeck: 0, endDeck: 0,
        color: '#ffdd00',
        reactorConfig: { power: 100 }
    });

    // Weapons based on aggressiveness
    const weaponCount = 1 + Math.floor(dna.aggressiveness * 4);
    for (let i = 0; i < weaponCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const yOffset = (rng() - 0.5) * mainDeckLength * 0.4;
        compartments.push({
            id: `w_${curId++}`,
            type: 'WEAPON',
            x: side * (mainDeckWidth * 0.4), y: yOffset,
            width: TILE, height: TILE,
            startDeck: 0, endDeck: 0,
            color: '#ff2222',
            turretConfig: {
                fireMode: 'ROUNDS',
                weaponGroup: 'MAIN',
                damage: 10 + Math.floor(dna.aggressiveness * 20),
                range: 1000 + Math.floor(rng() * 1000),
                rateOfFire: 1 + rng() * 2,
                projectileSpeed: 800 + rng() * 800,
                barrelCount: 1 + Math.floor(rng() * 3)
            }
        });
    }

    return {
        style: 'STEEL',
        size: hullLength,
        decks,
        compartments,
        activeDeckIndex: 0
    };
}


import { Hull } from '../engine/types';
import { ShipConstructionType } from '../../components/game/speciesTypes';
import { generateProceduralHull as generateProceduralHullModular } from './ship_generator/generator';

// Re-export old interface in case it's used elsewhere
export interface DesignDNA {
    hullStyle: 'ORGANIC' | 'CRYSTALLID' | 'INDUSTRIAL' | 'BRUTALIST' | 'AVIAN';
    aggressiveness: number;
    density: number;
    symmetry: 'MIRROR' | 'RADIAL' | 'ASYMMETRIC';
    colorMode: 'VIBRANT' | 'DULL' | 'MONO';
}

export function generateProceduralHull(factionId: string, shipType: ShipConstructionType, seed: number): Hull {
    return generateProceduralHullModular(factionId, shipType, seed);
}

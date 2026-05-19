import { Deck, Hull } from "../../engine/types";
import { ShipConstructionType } from "../../../components/game/speciesTypes";
import { generateRandomDNA } from "./dna";
import { generateSkeleton } from "./skeleton";
import { generateHullPoints } from "./hull";
import { generateCompartments } from "./compartments";

export function generateProceduralHull(factionId: string, shipType: ShipConstructionType, seed: number): Hull {
    const rng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    
    const dna = generateRandomDNA(rng);
    
    if (shipType === 'CRYSTALLID') {
        dna.sharpness = Math.max(0.6, dna.sharpness);
        dna.strictness = Math.max(0.7, dna.strictness);
    } else if (shipType === 'ORGANIC') {
        dna.softness = Math.max(0.7, dna.softness);
        dna.whimsicality = Math.max(0.6, dna.whimsicality);
        dna.strictness = Math.min(0.3, dna.strictness);
    } else if (shipType === 'BIOMECHANICAL') {
        dna.figurativeness = Math.max(0.5, dna.figurativeness);
        dna.complexity = Math.max(0.6, dna.complexity);
    } else {
        dna.strictness = Math.max(0.8, dna.strictness);
        dna.softness = Math.min(0.2, dna.softness);
        dna.monumentality = Math.max(0.6, dna.monumentality);
    }

    let color = '#ccc';
    if (shipType === 'CRYSTALLID') color = '#00ffff';
    else if (shipType === 'BIOMECHANICAL') color = '#cc3300';
    else if (shipType === 'ORGANIC') color = '#44cc44';
    
    const baseSize = 250 + rng() * 250;
    
    const skeleton = generateSkeleton(dna, rng, baseSize);
    const deckCount = 1 + Math.floor(dna.heightness * 2.99);
    const decks: Deck[] = [];

    const basePoints = generateHullPoints(skeleton, dna);
    
    for (let d = 0; d < deckCount; d++) {
        const deckScale = 1 - (d * 0.15);
        const deckPoints = basePoints.map(p => ({ x: p.x * deckScale, y: p.y * deckScale, mirrorX: p.mirrorX }));
        
        decks.push({
            level: d,
            color: color,
            points: deckPoints
        });
    }

    const compartments = generateCompartments(skeleton, dna, rng);

    return {
        style: shipType,
        size: skeleton.baseLength,
        decks,
        compartments,
        activeDeckIndex: 0
    };
}

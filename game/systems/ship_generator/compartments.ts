import { ShipSkeleton } from "./skeleton";
import { ShipDNA } from "./dna";
import { Compartment } from "../../../components/game/types";

// TODO: Генерацию отсеков потом усложним и дополним. Сейчас используем базовую расстановку отсеков, но потом добавим алгоритмы (Lagrangian relaxation / Constrained Delaunay Triangulation) для создания сложных форм отсеков, адаптированных под форму палубы.
export function generateCompartments(skeleton: ShipSkeleton, dna: ShipDNA, rng: () => number): Compartment[] {
    const compartments: Compartment[] = [];
    const TILE = 50;
    let curId = 0;
    
    const sortedNodes = [...skeleton.nodes].sort((a,b) => a.y - b.y);
    if(sortedNodes.length === 0) return compartments;
    
    // +Y is the front of the ship
    const frontNode = sortedNodes[sortedNodes.length - 1];
    const backNode = sortedNodes[0];
    
    compartments.push({
        id: `c_${curId++}`,
        type: 'BRIDGE',
        x: frontNode.x, y: frontNode.y + TILE,
        width: Math.max(TILE, frontNode.size), height: Math.max(TILE, frontNode.size * 0.8),
        startDeck: 0, endDeck: 0,
        color: '#aaaaaa'
    });
    
    compartments.push({
        id: `c_${curId++}`,
        type: 'ENGINE',
        x: backNode.x, y: backNode.y - TILE,
        width: Math.max(TILE * 1.5, backNode.size * 1.5), height: Math.max(TILE * 2, backNode.size * 1.2),
        points: [
            { x: -TILE * 0.75, y: -TILE },
            { x: TILE * 0.75, y: -TILE },
            { x: TILE * 0.5, y: TILE },
            { x: -TILE * 0.5, y: TILE }
        ],
        startDeck: 0, endDeck: 0,
        color: '#ff4400',
        engineConfig: { thrust: 100 * (1 + dna.balance), fuelPerSec: 10 }
    });
    
    const coreNodes = skeleton.nodes.filter(n => n.type === 'CORE');
    if (coreNodes.length > 0) {
        const midNode = coreNodes[Math.floor(coreNodes.length / 2)];
        compartments.push({
            id: `c_${curId++}`,
            type: 'REACTOR',
            x: midNode.x, y: midNode.y,
            width: Math.max(TILE, midNode.size * 0.8), height: Math.max(TILE, midNode.size * 0.8),
            startDeck: 0, endDeck: 0,
            color: '#ffdd00',
            reactorConfig: { powerOutput: 200, fuelEfficiency: 1 }
        });
    }
    
    const branchNodes = skeleton.nodes.filter(n => n.type === 'BRANCH' || n.type === 'TIP');
    for (const node of branchNodes) {
        if (node.id === frontNode.id || node.id === backNode.id) continue;
        if (rng() > 0.6) continue;
        
        compartments.push({
            id: `w_${curId++}`,
            type: 'WEAPON',
            x: node.x, y: node.y,
            width: TILE, height: TILE,
            startDeck: 0, endDeck: 0,
            color: '#ff2222',
            turretConfig: {
                fireMode: 'ROUNDS',
                weaponGroup: 'MAIN',
                damage: 10 + Math.floor(dna.sharpness * 20),
                range: 1000 + Math.floor(rng() * 1000),
                rateOfFire: 1 + rng() * 2,
                projectileSpeed: 800 + rng() * 800,
                barrelCount: 1 + Math.floor(rng() * 3)
            }
        });
    }
    
    if (dna.symmetry === 1.0) {
        const weapons = compartments.filter(c => c.type === 'WEAPON');
        for (const w of weapons) {
            if (w.x !== 0 && !weapons.some(other => Math.abs(other.x - (-w.x)) < 1 && Math.abs(other.y - w.y) < 1)) {
                 compartments.push({
                    ...w,
                    id: `w_${curId++}`,
                    x: -w.x
                });
            }
        }
    }
    
    return compartments;
}

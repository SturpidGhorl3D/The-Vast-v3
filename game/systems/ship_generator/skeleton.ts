import { ShipDNA } from "./dna";
import { Point } from "../../../components/game/types";

export interface SkeletonNode {
    id: string;
    x: number;
    y: number;
    size: number;
    type: 'CORE' | 'BRANCH' | 'TIP';
    mirrorX?: string;
}

export interface SkeletonEdge {
    source: string;
    target: string;
    type: 'MAIN' | 'LATERAL';
}

export interface ShipSkeleton {
    nodes: SkeletonNode[];
    edges: SkeletonEdge[];
    baseWidth: number;
    baseLength: number;
}

export function generateSkeleton(dna: ShipDNA, rng: () => number, seedSize: number): ShipSkeleton {
    // Make ships much longer when balance is high
    const length = seedSize * (0.5 + Math.pow(dna.balance, 1.5) * 6.0);
    const width = seedSize * (0.2 + Math.pow(1 - dna.balance, 1.5) * 2.0);
    
    const nodes: SkeletonNode[] = [];
    const edges: SkeletonEdge[] = [];
    let nodeIdCounter = 0;
    
    const getId = () => `n_${nodeIdCounter++}`;
    
    const coreSegments = Math.max(2, Math.floor(3 + dna.resolution * 5 + dna.monumentality * 2));
    const segmentLength = length / coreSegments;
    
    let prevId: string | null = null;
    
    for (let i = 0; i <= coreSegments; i++) {
        const id = getId();
        const yOffset = -length/2 + (i * segmentLength);
        
        let widthMod = 1.0;
        if (dna.figurativeness > 0.3) {
           widthMod += Math.sin(i / coreSegments * Math.PI * (1 + dna.figurativeness * 3)) * dna.figurativeness;
        }
        
        nodes.push({
            id,
            x: 0,
            y: yOffset, // Forward is now negative Y
            size: Math.max(10, width * widthMod * (dna.monumentality * 0.5 + 0.5)),
            type: i === 0 || i === coreSegments ? 'TIP' : 'CORE'
        });
        
        if (prevId) {
            edges.push({ source: prevId, target: id, type: 'MAIN' });
        }
        prevId = id;
    }
    
    // Increase branch density
    const branchCount = Math.floor(dna.complexity * coreSegments * 4);
    const isSymmetric = rng() <= dna.symmetry; 
    
    for (let i = 0; i < branchCount; i++) {
        const coreNodeIndex = 1 + Math.floor(rng() * (coreSegments - 1));
        const coreNode = nodes[coreNodeIndex];
        
        // Increase branch length based on seed size rather than just width
        const branchLength = (seedSize * 0.4 + width * 0.4) * (0.5 + dna.strangeness * 2.5);
        // Branches might sweep backwards or forwards like wings Instead of always 0 or random
        let angleBase = 0;
        if (dna.strictness > 0.6) {
           angleBase = 0; // Straight out
        } else if (dna.strictness > 0.3) {
           angleBase = Math.PI * 0.15 * (rng() > 0.5 ? 1 : -1); // Sweep back or forward
        } else {
           angleBase = (rng() - 0.5) * Math.PI * 0.5; // Random
        } 
        
        const addBranch = (baseX: number, bDir: 1 | -1, mirrorMatchId?: string): string => {
           let cx = baseX;
           let cy = coreNode.y;
           let currentSource = coreNode.id;
           let branchLevels = 1 + Math.floor(dna.complexity * 3);
           
           for(let b=0; b<branchLevels; b++) {
               const id = getId();
               const isCurved = dna.whimsicality > 0.5 ? (rng() - 0.5) * dna.whimsicality * Math.PI : 0;
               const finalAngle = angleBase + isCurved;
               
               // Rotated branch coords
               const bx = cx + Math.cos(finalAngle) * bDir * branchLength;
               const by = cy + Math.sin(finalAngle) * branchLength;
               
               nodes.push({
                   id,
                   x: bx,
                   y: by,
                   size: Math.max(5, coreNode.size * (1 - (b / branchLevels) * dna.sharpness)),
                   type: b === branchLevels - 1 ? 'TIP' : 'BRANCH',
                   mirrorX: mirrorMatchId
               });
               
               edges.push({ source: currentSource, target: id, type: 'LATERAL' });
               
               cx = bx;
               cy = by;
               currentSource = id;
           }
           return currentSource;
        };
        
        const rEndId = addBranch(coreNode.x, 1);
        if (isSymmetric) {
            addBranch(coreNode.x, -1, rEndId);
        } else if (rng() > 0.5) {
            addBranch(coreNode.x, -1);
        }
    }
    
    return { nodes, edges, baseWidth: width, baseLength: length };
}

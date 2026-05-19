import { ShipSkeleton } from "./skeleton";
import { ShipDNA } from "./dna";
import { Point } from "../../../components/game/types";

export function generateHullPoints(skeleton: ShipSkeleton, dna: ShipDNA): Point[] {
    const points: Point[] = [];
    
    // We will generate the right half (from top to bottom), then mirror it to the left
    // Use fewer segments for a more polygonal (less rounded) shape
    let halfSegments = Math.max(4, Math.floor(4 + dna.resolution * 16));
    if (dna.softness < 0.5) {
         // Sharp, blocky ships have very few segments
         halfSegments = Math.max(3, Math.floor(3 + dna.resolution * 6));
    }
    
    const rightHalf: Point[] = [];
    
    for (let i = 0; i <= halfSegments; i++) {
        const t = i / halfSegments;
        // From Top (-PI/2) to Bottom (PI/2)
        const angle = -Math.PI / 2 + t * Math.PI;
        const rayDx = Math.cos(angle);
        const rayDy = Math.sin(angle);
        
        let maxDist = 0;
        
        for (const node of skeleton.nodes) {
            const proj = (node.x * rayDx + node.y * rayDy);
            const perpSq = Math.pow(node.x - proj * rayDx, 2) + Math.pow(node.y - proj * rayDy, 2);
            
            // Influence of skeleton node size and sharpness
            const nodeInfluence = node.size * (1 + dna.sharpness * (1 - Math.abs(proj) / (skeleton.baseLength * 0.5)));
            
            if (perpSq <= nodeInfluence * nodeInfluence) {
                const distAlongRay = proj + Math.sqrt(nodeInfluence * nodeInfluence - perpSq);
                if (distAlongRay > maxDist) maxDist = distAlongRay;
            }
        }
        
        // More aggressive noise for less rounding
        const noise = (Math.random() - 0.5) * (1 - dna.softness) * (40 * dna.complexity);
        maxDist += noise;
        
        if (dna.sharpness > 0.5 && (Math.abs(rayDx) < 0.2 || Math.abs(rayDy) < 0.2)) {
            maxDist *= 1 + (dna.sharpness * 1.0);
        }
        
        if (maxDist < 5) maxDist = 5;
        
        rightHalf.push({ x: rayDx * maxDist, y: rayDy * maxDist });
    }
    
    // Ensure top and bottom are exactly on the Y axis
    rightHalf[0].x = 0;
    rightHalf[halfSegments].x = 0;
    
    // Now construct the full loop: Right half (Top -> Bottom), then Left half (Bottom -> Top)
    for (let i = 0; i < rightHalf.length; i++) {
        points.push(rightHalf[i]);
    }
    
    // For left half, we go backwards from bottom-1 to top+1
    for (let i = rightHalf.length - 2; i > 0; i--) {
        const p = rightHalf[i];
        let newX = -p.x;
        // Only mirror if symmetry is high, otherwise just add random wiggle
        if (dna.symmetry < 0.5) {
            newX += (Math.random() - 0.5) * 20 * (1 - dna.symmetry);
        }
        
        points.push({ x: newX, y: p.y, mirrorX: dna.symmetry > 0.5 ? i : undefined });
        if (dna.symmetry > 0.5) {
             rightHalf[i].mirrorX = points.length - 1;
        }
    }
    
    return points;
}

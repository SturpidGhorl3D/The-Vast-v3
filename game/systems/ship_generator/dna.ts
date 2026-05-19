export interface ShipDNA {
    balance: number;
    monumentality: number;
    figurativeness: number;
    strictness: number;
    complexity: number;
    strangeness: number;
    whimsicality: number;
    symmetry: number;
    sharpness: number;
    softness: number;
    resolution: number;
    heightness: number;
}

export function generateRandomDNA(rng: () => number): ShipDNA {
    return {
        balance: rng(),
        monumentality: rng(),
        figurativeness: rng(),
        strictness: rng(),
        complexity: rng(),
        strangeness: rng(),
        whimsicality: rng(),
        symmetry: rng() > 0.5 ? 1.0 : rng() * 0.8,
        sharpness: rng(),
        softness: rng(),
        resolution: rng(),
        heightness: rng()
    };
}

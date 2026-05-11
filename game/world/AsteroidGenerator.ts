
import { AsteroidObject, AsteroidCluster } from './types';
import { getHexCoords } from './utils';
import { CHUNK_SIZE_M } from '../constants';

const RESOURCE_RARITY: { [key: string]: number } = {
  IRON:     0.95,
  TITANIUM:  0.90,
  NICKEL:   0.85,
  CARBON:   0.70,
  ICE:      0.25,
  COBALT:   0.28,
  PLATINUM: 0.07,
  IRIDIUM:  0.04,
  GOLD:     0.03,
};

export function makeAsteroidResources(rng: () => number, isPlanetoid: boolean, nearStar: boolean, totalCapacity: number): { [key: string]: number } {
  const res: { [key: string]: number } = {};
  let distributed = 0;
  
  // Sort materials to process non-rare first for baseline filling
  const entries = Object.entries(RESOURCE_RARITY).sort((a, b) => b[1] - a[1]);

  for (const [name, prob] of entries) {
    let p = prob;
    if (name === 'ICE' && nearStar) p *= 0.1;
    if (name === 'ICE' && !nearStar) p *= 1.8;
    if (isPlanetoid) p = Math.min(1, p * 1.5);
    
    if (rng() < p) {
      // Rare materials (prob < 0.1) get 1-2% concentration
      // Common materials get 10-40% 
      const isRare = prob < 0.1;
      const concentration = isRare ? (0.01 + rng() * 0.02) : (0.1 + rng() * 0.3);
      
      const amount = Math.floor(totalCapacity * concentration);
      if (amount > 0 && distributed + amount <= totalCapacity) {
        res[name] = amount;
        distributed += amount;
      }
    }
  }
  
  // If we have remaining capacity, add some IRON/TITANIUM as buffer
  if (distributed < totalCapacity) {
    const buffer = totalCapacity - distributed;
    const major = rng() > 0.5 ? 'IRON' : 'TITANIUM';
    res[major] = (res[major] || 0) + buffer;
  }

  return res;
}

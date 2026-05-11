import { GameSave } from '@/components/ui/main-menu/MainMenu';
import { GlobalCoords } from '@/components/game/types';

export interface WorldState {
  saveId: string;
  shipHull: any;
  playerPosition: GlobalCoords & { angle: number };
  playerVelocity: { vx: number, vy: number, va: number };
  inventory: { [key: string]: number };
  visitedSectors: string[];
  scannedSystems?: string[];
  lastUpdate: number;
  orgType: string;
  originId: string;
  species?: any;
  researchedTechs?: string[];
  innovationPoints?: number;
  activeResearch?: { techId: string; progress: number; totalCost: number } | null;
  availableTechOptions?: string[];
  pendingInnovationChoices?: string[];
  pendingBranchChoices?: Record<string, string[]>;
  techNodePositions?: Record<string, { x: number; y: number }>;
  techBranchingCounts?: Record<string, number>;
}

const SAVE_PREFIX = 'the_vast_state_';

// Helper to recursively convert BigInt to string markers
function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return `__bigint__${obj.toString()}`;
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        res[k] = serializeBigInts(obj[k]);
      }
    }
    return res;
  }
  return obj;
}

export const SaveManager = {
  saveWorldState(state: WorldState) {
    console.log("Saving world state: ", state.saveId);
    const key = SAVE_PREFIX + state.saveId;
    try {
      const serializableState = serializeBigInts(state);
      localStorage.setItem(key, JSON.stringify(serializableState));
      console.log("Save successful!");
    } catch(e) {
      console.error("Save failure:", e);
    }
    
    // Also update the main save index's last_played_at
    const savedStr = localStorage.getItem('astraeus_saves');
    if (savedStr) {
      const saves: GameSave[] = JSON.parse(savedStr);
      const idx = saves.findIndex(s => s.id === state.saveId);
      if (idx !== -1) {
        saves[idx].lastPlayedAt = Date.now();
        localStorage.setItem('astraeus_saves', JSON.stringify(saves));
      }
    }
  },

  loadWorldState(saveId: string): WorldState | null {
    const key = SAVE_PREFIX + saveId;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored, (key, value) => {
        if (typeof value === 'string' && value.startsWith('__bigint__')) {
          return BigInt(value.substring(10));
        }
        return value;
      });
    } catch (e) {
      console.error('Failed to load world state:', e);
      return null;
    }
  },

  deleteWorldState(saveId: string) {
    const key = SAVE_PREFIX + saveId;
    localStorage.removeItem(key);
  }
};


export interface NetworkPlayerState {
  playerId: string;
  position: {
    sectorX: number;
    sectorY: number;
    offsetX: number;
    offsetY: number;
    angle: number;
  };
  velocity: {
    vx: number;
    vy: number;
    va: number;
  };
  // We can add more, like hull or inventory, later
}

// Map of playerId to their current state
export type GameStateUpdate = {
  players: Record<string, NetworkPlayerState>;
  timestamp: number;
};


import { GameEngine } from '../GameEngine';
import { NetworkPlayerState } from '../networkTypes';
import { Velocity } from '@/game/systems';

export class MultiplayerManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public getNetworkState(): NetworkPlayerState | null {
    if (this.engine.player === null || this.engine.playerId === null) return null;
    const pos = this.engine.ecs.getPosition(this.engine.player)!;
    const vel = this.engine.ecs.getComponent<Velocity>(this.engine.player, 'Velocity')!;
    
    return {
      playerId: this.engine.playerId,
      position: { 
        ...pos, 
        sectorX: Number(pos.sectorX),
        sectorY: Number(pos.sectorY)
      },
      velocity: { ...vel }
    };
  }

  public applyRemotePlayerState(state: NetworkPlayerState) {
    let entity = this.engine.remotePlayers[state.playerId];
    if (entity === undefined) {
      entity = this.engine.ecs.createEntity();
      this.engine.remotePlayers[state.playerId] = entity;
      this.engine.ecs.addComponent(entity, 'Position', {
        sectorX: BigInt(state.position.sectorX),
        sectorY: BigInt(state.position.sectorY),
        offsetX: state.position.offsetX,
        offsetY: state.position.offsetY,
        angle: state.position.angle
      });
      this.engine.ecs.addComponent(entity, 'Velocity', state.velocity);
      
      if (this.engine.player !== null) {
          const localHull = this.engine.ecs.getHull(this.engine.player);
          if (localHull) {
              this.engine.ecs.addComponent(entity, 'Hull', { ...localHull });
          }
      }
    } else {
      this.engine.ecs.addComponent(entity, 'Position', {
        sectorX: BigInt(state.position.sectorX),
        sectorY: BigInt(state.position.sectorY),
        offsetX: state.position.offsetX,
        offsetY: state.position.offsetY,
        angle: state.position.angle
      });
      this.engine.ecs.addComponent(entity, 'Velocity', state.velocity);
    }
  }

  public markPlayerDisconnected(playerId: string) {
    const entity = this.engine.remotePlayers[playerId];
    if (entity !== undefined) {
        this.engine.ecs.addComponent(entity, 'Disconnected', { timestamp: Date.now() });
    }
  }
}

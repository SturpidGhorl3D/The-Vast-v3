
/**
 * GameCore.ts
 * 
 * Provides an isolated, renderer-agnostic core for the game simulation.
 * This handles ECS, World, and System updates.
 * It does NOT contain any DOM, Canvas, or Graphics (PIXI) logic.
 * 
 * FOR OTHER AI: 
 * - Do not add rendering or browser-specific dependencies here.
 * - This class should be portable to a Node.js server environment.
 */

import { ECS } from './ecs';
import { WorldGenerator } from '../world/generator';
import { AsteroidGridManager } from '../world/AsteroidGridManager';
import { movementSystem, miningSystem } from '../systems';
import { lootSystem } from '../systems/lootSystem';
import { aiSystem } from '../systems/aiSystem';

export class GameCore {
  public ecs: ECS;
  public world: WorldGenerator;
  public asteroidGrid: AsteroidGridManager;

  constructor(seed: string, clusterRadius?: number, density?: number) {
    this.ecs = new ECS();
    this.world = new WorldGenerator(seed, clusterRadius, density);
    this.asteroidGrid = new AsteroidGridManager(this.world.noise2D);
    this.asteroidGrid.setWorldGenerator(this.world);
    this.asteroidGrid.initWorker(seed);
  }

  // Core simulation steps that don't depend on rendering
  public tick(dt: number, engineRef: any) {
    // 1. Process Simulation Systems
    aiSystem(this.ecs, dt);
    movementSystem(this.ecs, dt);
    miningSystem(this.ecs, engineRef, dt);
    lootSystem(this.ecs, engineRef, dt);
  }
}


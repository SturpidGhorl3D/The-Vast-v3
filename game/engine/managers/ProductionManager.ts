import { GameEngine } from '../GameEngine';
import { ComponentRecipe } from '../../materials';

export interface ProductionQueueItem {
  recipeId: string;
  count: number;
}

export interface ProductionKernel {
  compartmentId: string;
  volume: number;
  queue: ProductionQueueItem[];
  currentProgress: number;
  isPaused: boolean;
}

export class ProductionManager {
  private engine: GameEngine;
  private lastUpdate: number = Date.now();

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public get kernels(): ProductionKernel[] {
    const playerEntity = this.engine.player;
    if (playerEntity === null) return [];
    const prod = this.engine.ecs.getComponent<any>(playerEntity, 'Production');
    return prod?.kernels || [];
  }

  update(dt: number) {
    const playerEntity = this.engine.player;
    if (playerEntity === null) return;

    const hull = this.engine.ecs.getHull(playerEntity);
    if (!hull) return;

    // Check if we have machinery
    const hasMachinery = hull.compartments.some(c => c.type === 'MACHINERY');
    if (!hasMachinery) return;

    const inventory = this.engine.ecs.getComponent<any>(playerEntity, 'Inventory');
    if (!inventory) return;

    // We store kernels on the inventory component or a dedicated Production component
    // For simplicity, let's inject a 'Production' component if missing
    let prod = this.engine.ecs.getComponent<any>(playerEntity, 'Production');
    if (!prod) {
      prod = { kernels: [] };
      this.engine.ecs.addComponent(playerEntity, 'Production', prod);
    }

    // Sync kernels with compartments
    this.syncKernels(hull, prod);

    // Update progress
    prod.kernels.forEach((kernel: ProductionKernel) => {
      if (kernel.isPaused || kernel.queue.length === 0) return;

      const currentItem = kernel.queue[0];
      const recipe = this.getRecipe(currentItem.recipeId);
      if (!recipe) {
        kernel.queue.shift(); // Invalid recipe
        return;
      }

      // 1 progress unit per 1 m3 per second (dt is in seconds)
      const progressAdd = kernel.volume * dt;
      kernel.currentProgress += progressAdd;

      if (kernel.currentProgress >= recipe.productionTime) {
        // Finished one item
        this.finishItem(inventory, recipe);
        currentItem.count--;
        kernel.currentProgress = 0;

        if (currentItem.count <= 0) {
          kernel.queue.shift();
        }
      }
    });

    this.lastUpdate = Date.now();
  }

  private syncKernels(hull: any, prod: any) {
    const fabComps = hull.compartments.filter((c: any) => c.type === 'FABRIC');
    
    // Remove kernels for missing compartments
    prod.kernels = prod.kernels.filter((k: any) => fabComps.some((c: any) => c.id === k.compartmentId));

    // Add kernels for new compartments
    fabComps.forEach((comp: any) => {
      if (!prod.kernels.some((k: any) => k.compartmentId === comp.id)) {
        // Calculate volume: width * height * depth (deckHeight)
        const area = this.calculateCompArea(comp);
        const volume = area * 3; // 3m deck height
        
        prod.kernels.push({
          compartmentId: comp.id,
          volume: volume,
          queue: [],
          currentProgress: 0,
          isPaused: false
        });
      }
    });
  }

  private calculateCompArea(comp: any): number {
    if (comp.points && comp.points.length >= 3) {
      let area = 0;
      for (let i = 0; i < comp.points.length; i++) {
        const j = (i + 1) % comp.points.length;
        area += comp.points[i].x * comp.points[j].y;
        area -= comp.points[j].x * comp.points[i].y;
      }
      return Math.abs(area) / 2;
    }
    return comp.width * comp.height;
  }

  private getRecipe(id: string): ComponentRecipe | undefined {
    const { COMPONENT_RECIPES } = require('../../materials');
    return COMPONENT_RECIPES.find((r: any) => r.id === id);
  }

  private finishItem(inventory: any, recipe: ComponentRecipe) {
    inventory.resources[recipe.id] = (inventory.resources[recipe.id] || 0) + recipe.outputAmount;
  }

  addToQueue(entityId: number, recipeId: string, count: number = 1, kernelId?: string) {
    const prod = this.engine.ecs.getComponent<any>(entityId, 'Production');
    if (!prod || prod.kernels.length === 0) return;

    const recipe = this.getRecipe(recipeId);
    if (!recipe) return;

    // Check resources
    const inventory = this.engine.ecs.getComponent<any>(entityId, 'Inventory');
    if (!inventory) return;

    const canAfford = recipe.inputs.every(input => 
      (inventory.resources[input.materialId] || 0) >= input.amount * count
    );

    if (!canAfford) return;

    // Deduct resources immediately when queuing (or should it be when starting?)
    // Game logic usually deducts when queuing to prevent front-running.
    recipe.inputs.forEach(input => {
      inventory.resources[input.materialId] -= input.amount * count;
    });

    if (kernelId) {
      const kernel = prod.kernels.find((k: any) => k.compartmentId === kernelId);
      if (kernel) {
        this.addItemToKernel(kernel, recipeId, count);
        return;
      }
    }

    // Default: Add to kernel with shortest queue duration
    const bestKernel = prod.kernels.reduce((prev: any, curr: any) => {
      const prevTime = this.calculateQueueTime(prev);
      const currTime = this.calculateQueueTime(curr);
      return prevTime < currTime ? prev : curr;
    });

    this.addItemToKernel(bestKernel, recipeId, count);
  }

  private addItemToKernel(kernel: ProductionKernel, recipeId: string, count: number) {
    const lastItem = kernel.queue[kernel.queue.length - 1];
    if (lastItem && lastItem.recipeId === recipeId) {
      lastItem.count += count;
    } else {
      kernel.queue.push({ recipeId, count });
    }
  }

  private calculateQueueTime(kernel: ProductionKernel): number {
    let total = 0;
    kernel.queue.forEach(item => {
      const recipe = this.getRecipe(item.recipeId);
      if (recipe) {
        total += (recipe.productionTime * item.count) / kernel.volume;
      }
    });
    return total - (kernel.currentProgress / kernel.volume);
  }
}

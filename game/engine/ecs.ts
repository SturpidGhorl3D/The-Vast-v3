
export type Entity = number;

export interface ComponentMap {
  [key: string]: any;
}

export class ECS {
  private nextEntityId: Entity = 0;
  private entities: Set<Entity> = new Set();
  private components: Map<string, Map<Entity, any>> = new Map();
  
  // Query caching to prevent GC pauses
  private queryCache: Map<string, Entity[]> = new Map();

  createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  destroyEntity(entity: Entity) {
    this.entities.delete(entity);
    for (const componentStore of this.components.values()) {
      componentStore.delete(entity);
    }
    this.queryCache.clear(); // Simple invalidation
  }

  addComponent<T>(entity: Entity, componentName: string, data: T) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, data);
    this.queryCache.clear(); // Simple invalidation
  }

  getComponent<T>(entity: Entity, componentName: string): T | undefined {
    return this.components.get(componentName)?.get(entity);
  }

  getHull(entity: Entity) {
    return this.getComponent<import('../systems').Hull>(entity, 'Hull');
  }

  getPosition(entity: Entity) {
    return this.getComponent<import('../systems').Position>(entity, 'Position');
  }

  removeComponent(entity: Entity, componentName: string) {
    this.components.get(componentName)?.delete(entity);
    this.queryCache.clear(); // Simple invalidation
  }

  getEntitiesWith(componentNames: string[]): Entity[] {
    if (componentNames.length === 0) return Array.from(this.entities);

    const queryKey = componentNames.join(',');
    if (this.queryCache.has(queryKey)) {
        return this.queryCache.get(queryKey)!;
    }

    const firstStore = this.components.get(componentNames[0]);
    if (!firstStore) return [];

    let result = Array.from(firstStore.keys());
    for (let i = 1; i < componentNames.length; i++) {
      const store = this.components.get(componentNames[i]);
      if (!store) return [];
      result = result.filter(e => store.has(e));
    }
    
    this.queryCache.set(queryKey, result);
    return result;
  }
}

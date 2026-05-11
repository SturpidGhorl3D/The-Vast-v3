
'use client';

import { useCallback } from 'react';
import { COMPONENT_RECIPES } from '@/game/materials';

interface ProductionLogicProps {
  engine: any;
  setInventory: (inv: Record<string, number>) => void;
  setMaxCapacity: (cap: number) => void;
}

export function useProductionLogic({ engine, setInventory, setMaxCapacity }: ProductionLogicProps) {
  const handleProduce = useCallback((recipeId: string, count: number = 1, kernelId?: string) => {
    if (!engine || !engine.production) return;
    const player = engine.player;
    if (player === null) return;

    engine.production.addToQueue(player, recipeId, count, kernelId);
    
    const inv = engine.ecs.getComponent(player, 'Inventory') as any;
    if (inv) {
      setInventory({ ...inv.resources });
      setMaxCapacity(inv.maxCapacity || 1000);
    }
  }, [engine, setInventory, setMaxCapacity]);

  return { handleProduce };
}

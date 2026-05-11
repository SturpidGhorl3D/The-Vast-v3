import { ComponentRecipe } from '../../../materials';

export const PLASMA_MODULATOR: ComponentRecipe = {
  id: 'PLASMA_MODULATOR',
  label: 'Плазматические модуляторы',
  tier: 1,
  outputAmount: 1,
  productionTime: 1500,
  category: 'MINING',
  inputs: [
    { materialId: 'LITHIUM', amount: 8 },
    { materialId: 'THORIUM', amount: 2 }
  ],
  techRequired: 'mining_t1_lasers'
};

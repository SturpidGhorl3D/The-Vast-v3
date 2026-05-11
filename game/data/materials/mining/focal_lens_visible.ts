import { ComponentRecipe } from '../../../materials';

export const FOCAL_LENS_VISIBLE: ComponentRecipe = {
  id: 'FOCAL_LENS_VISIBLE',
  label: 'Фокальные компоненты видимого спектра',
  tier: 1,
  outputAmount: 1,
  productionTime: 1200,
  category: 'MINING',
  inputs: [
    { materialId: 'ALUMINIUM', amount: 5 },
    { materialId: 'PLATINUM', amount: 1 }
  ],
  techRequired: 'mining_t1_lasers'
};

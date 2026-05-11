import { ComponentRecipe } from '../../../materials';

export const DISCHARGE_CAPACITOR: ComponentRecipe = {
  id: 'DISCHARGE_CAPACITOR',
  label: 'Накопительные разрядники',
  tier: 1,
  outputAmount: 1,
  productionTime: 1200,
  category: 'WEAPON',
  inputs: [
    { materialId: 'LITHIUM', amount: 10 },
    { materialId: 'GOLD', amount: 2 }
  ],
  techRequired: 'wpn_t1_ballistics'
};

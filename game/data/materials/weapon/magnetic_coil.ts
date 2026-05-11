import { ComponentRecipe } from '../../../materials';

export const MAGNETIC_COIL: ComponentRecipe = {
  id: 'MAGNETIC_COIL',
  label: 'Магнитные катушки',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  category: 'WEAPON',
  inputs: [
    { materialId: 'IRON', amount: 15 },
    { materialId: 'ALUMINIUM', amount: 5 }
  ],
  techRequired: 'wpn_t1_ballistics'
};

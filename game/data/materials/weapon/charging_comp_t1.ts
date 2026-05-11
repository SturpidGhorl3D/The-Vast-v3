import { ComponentRecipe } from '../../../materials';

export const CHARGING_COMP_T1: ComponentRecipe = {
  id: 'CHARGING_COMP_T1',
  label: 'Зарядные компоненты первой категории',
  tier: 1,
  outputAmount: 1,
  productionTime: 1100,
  category: 'WEAPON',
  inputs: [
    { materialId: 'RUBIDIUM', amount: 3 },
    { materialId: 'ALUMINIUM', amount: 8 }
  ],
  techRequired: 'wpn_t1_ballistics'
};

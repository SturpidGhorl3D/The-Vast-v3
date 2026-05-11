import { ComponentRecipe } from '../../../materials';

export const WEAPON_STRUCTURAL_COMP: ComponentRecipe = {
  id: 'WEAPON_STRUCTURAL_COMP',
  label: 'Структурные компоненты орудий',
  tier: 1,
  outputAmount: 1,
  productionTime: 800,
  category: 'WEAPON',
  inputs: [
    { materialId: 'TITANIUM', amount: 12 }
  ],
  techRequired: 'wpn_t1_ballistics'
};

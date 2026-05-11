import { ComponentRecipe } from '../../../materials';

export const STANDARD_COMPOSITES: ComponentRecipe = {
  id: 'STANDARD_COMPOSITES',
  label: 'Базовые композиты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['STANDARD'],
  category: 'BASIC',
  inputs: [
    { materialId: 'IRON', amount: 5 },
    { materialId: 'ALUMINIUM', amount: 5 }
  ],
  techRequired: 'eng_basic_construction'
};

import { ComponentRecipe } from '../../../materials';

export const BIOGENIC_COMPONENTS: ComponentRecipe = {
  id: 'BIOGENIC_COMPONENTS',
  label: 'Биогенные компоненты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['BIOMECHANICAL'],
  category: 'BIO',
  inputs: [
    { materialId: 'SULFUR', amount: 5 },
    { materialId: 'ICE', amount: 5 }
  ],
  techRequired: 'eng_basic_construction'
};

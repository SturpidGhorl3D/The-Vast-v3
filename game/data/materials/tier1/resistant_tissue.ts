import { ComponentRecipe } from '../../../materials';

export const RESISTANT_TISSUE: ComponentRecipe = {
  id: 'RESISTANT_TISSUE',
  label: 'Резистентные покровные ткани',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['ORGANIC'],
  category: 'ORGANIC',
  inputs: [
    { materialId: 'SULFUR', amount: 10 },
    { materialId: 'ICE', amount: 10 }
  ],
  techRequired: 'eng_basic_construction'
};

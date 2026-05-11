import { ComponentRecipe } from '../../../materials';

export const BIOCERAMIC: ComponentRecipe = {
  id: 'BIOCERAMIC',
  label: 'Биокерамика',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['BIOMECHANICAL'],
  category: 'BIO',
  inputs: [
    { materialId: 'SILICON', amount: 8 }, // Added SILICON if not exist, or use GPR
    { materialId: 'IRON', amount: 2 }
  ],
  techRequired: 'eng_basic_construction'
};

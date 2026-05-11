import { ComponentRecipe } from '../../../materials';

export const POLYSILICATE_T1: ComponentRecipe = {
  id: 'POLYSILICATE_T1',
  label: 'Полисиликаты первой категории',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['CRYSTALLID'],
  category: 'CRYSTAL',
  inputs: [
    { materialId: 'SILICON', amount: 12 }
  ],
  techRequired: 'eng_basic_construction'
};

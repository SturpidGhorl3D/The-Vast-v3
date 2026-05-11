import { ComponentRecipe } from '../../../materials';

export const SKELETAL_COMPONENTS: ComponentRecipe = {
  id: 'SKELETAL_COMPONENTS',
  label: 'Скелетарные компоненты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['ORGANIC'],
  category: 'ORGANIC',
  inputs: [
    { materialId: 'IRON', amount: 3 },
    { materialId: 'TITANIUM', amount: 1 },
    { materialId: 'ALUMINIUM', amount: 5 }
  ],
  techRequired: 'eng_basic_construction'
};

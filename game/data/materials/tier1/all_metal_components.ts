import { ComponentRecipe } from '../../../materials';

export const ALL_METAL_COMPONENTS: ComponentRecipe = {
  id: 'ALL_METAL_COMPONENTS',
  label: 'Цельнометаллические компоненты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['STANDARD'],
  category: 'BASIC',
  inputs: [
    { materialId: 'IRON', amount: 10 },
    { materialId: 'TITANIUM', amount: 2 }
  ],
  techRequired: 'eng_basic_construction'
};

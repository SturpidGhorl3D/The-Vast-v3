import { ComponentRecipe } from '../../../materials';

export const CRYSTAL_SLAG_COMPONENTS: ComponentRecipe = {
  id: 'CRYSTAL_SLAG_COMPONENTS',
  label: 'Кристалло-шлаковые компоненты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1000,
  shipType: ['CRYSTALLID'],
  category: 'CRYSTAL',
  inputs: [
    { materialId: 'IRON', amount: 5 },
    { materialId: 'MAGNESIUM', amount: 5 }
  ],
  techRequired: 'eng_basic_construction'
};

import { ComponentRecipe } from '../../../materials';

export const REACTOR_CORE_COMP: ComponentRecipe = {
  id: 'REACTOR_CORE_COMP',
  label: 'Компоненты ядерного реактора',
  tier: 1,
  outputAmount: 1,
  productionTime: 2000,
  category: 'REACTOR',
  inputs: [
    { materialId: 'URANIUM', amount: 10 },
    { materialId: 'TITANIUM', amount: 15 }
  ],
  techRequired: 'eng_reactors_t1'
};

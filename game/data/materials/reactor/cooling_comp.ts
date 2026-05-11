import { ComponentRecipe } from '../../../materials';

export const COOLING_COMP: ComponentRecipe = {
  id: 'COOLING_COMP',
  label: 'Охладительные компоненты',
  tier: 1,
  outputAmount: 1,
  productionTime: 1200,
  category: 'REACTOR',
  inputs: [
    { materialId: 'ICE', amount: 20 },
    { materialId: 'ALUMINIUM', amount: 10 }
  ],
  techRequired: 'eng_reactors_t1'
};

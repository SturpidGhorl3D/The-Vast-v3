import { Technology } from '../../../components/game/technologyTypes';

export const mod_root: Technology = {
  id: 'mod_root', name: 'Биологические основы', description: 'Понимание жизни и её пределов.', category: 'MODIFICATIONS', subtype: 'FOUNDATION', cost: 5000, requirements: [], unlocks: {}
};

export const mod_cybernetics: Technology = {
  id: 'mod_cybernetics', name: 'Кибернетические аугментации', description: 'Улучшает эффективность экипажа.', category: 'MODIFICATIONS', subtype: 'CYBERNETICS', cost: 40000, requirements: ['mod_root'], unlocks: { stats: { 'crew_efficiency': 1.1 } }
};

export const mod_genetic_tailoring: Technology = {
  id: 'mod_genetic_tailoring', name: 'Генетическое конструирование', description: 'Увеличивает выживаемость населения.', category: 'MODIFICATIONS', subtype: 'GENETICS', cost: 80000, requirements: ['mod_root'], unlocks: { stats: { 'pop_growth': 1.2 } }
};

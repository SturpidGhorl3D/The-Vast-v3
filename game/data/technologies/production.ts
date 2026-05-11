import { Technology } from '../../../components/game/technologyTypes';

export const prod_root: Technology = {
  id: 'prod_root', name: 'Основы экстракции', description: 'Принципы добычи и очистки ресурсов.', category: 'PRODUCTION', subtype: 'FOUNDATION', cost: 5000, requirements: [], unlocks: {}
};

export const prod_basic_refining: Technology = {
  id: 'prod_basic_refining', name: 'Базовая переработка', description: 'Позволяет перерабатывать руду в сплавы.', category: 'PRODUCTION', subtype: 'REFINING', cost: 10000, requirements: ['prod_root'], unlocks: { recipes: ['ore_to_alloy'] }
};

export const prod_advanced_refining: Technology = {
  id: 'prod_advanced_refining', name: 'Усовершенствованная металлургия', description: 'Открывает доступ к производству редких сплавов.', category: 'PRODUCTION', subtype: 'REFINING', cost: 30000, requirements: ['prod_basic_refining'], unlocks: { recipes: ['advanced_alloy'] }
};

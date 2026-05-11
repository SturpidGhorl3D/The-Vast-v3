import { Technology } from '../../../components/game/technologyTypes';

export const eng_root: Technology = {
  id: 'eng_root', name: 'Принципы механики', description: 'Корневая технология инженерного дела.', category: 'ENGINEERING', subtype: 'FOUNDATION', cost: 5000, requirements: ['phys_approach'], unlocks: {}
};

export const eng_basic_construction: Technology = {
  id: 'eng_basic_construction', name: 'Базовое кораблестроение', description: 'Позволяет проектировать корабли.', category: 'ENGINEERING', subtype: 'CONSTRUCTION', cost: 10000, requirements: ['eng_root'], unlocks: { compartments: ['basic_hull'] }
};

export const eng_modular_decks: Technology = {
  id: 'eng_modular_decks', name: 'Мульти-палубные структуры', description: 'Добавление новых палуб к кораблю.', category: 'ENGINEERING', subtype: 'CONSTRUCTION', cost: 20000, requirements: ['eng_basic_construction'], unlocks: { compartments: ['deck_stairs'] }
};

export const eng_armor_plates: Technology = {
  id: 'eng_armor_plates', name: 'Навесная броня', description: 'Позволяет устанавливать внешние бронеплиты.', category: 'ENGINEERING', subtype: 'CONSTRUCTION', cost: 15000, requirements: ['eng_basic_construction'], unlocks: { compartments: ['armor_plate'] }
};

export const eng_research_labs: Technology = {
  id: 'eng_research_labs', name: 'Исследовательские отсеки', description: 'Позволяет изучать и внедрять технологии прямо на кораблях.', category: 'ENGINEERING', subtype: 'RESEARCH', cost: 30000, requirements: ['eng_basic_construction'], unlocks: { compartments: ['research_lab'] }
};

export const upgrade_t2_systems: Technology = {
  id: 'upgrade_t2_systems', name: 'Системы Второго Поколения', description: 'Позволяет улучшать базовые отсеки (Двигатели, Реакторы) до 2 уровня.', category: 'ENGINEERING', subtype: 'SYSTEMS', cost: 50000, requirements: ['eng_basic_construction'], unlocks: { }
};

export const upgrade_t3_systems: Technology = {
  id: 'upgrade_t3_systems', name: 'Системы Третьего Поколения', description: 'Предел инженерной мысли для вспомогательных систем.', category: 'ENGINEERING', subtype: 'SYSTEMS', cost: 150000, requirements: ['upgrade_t2_systems'], unlocks: { }
};

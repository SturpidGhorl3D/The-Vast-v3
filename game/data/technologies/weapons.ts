import { Technology } from '../../../components/game/technologyTypes';

export const weap_root: Technology = {
  id: 'weap_root', name: 'Теория баллистики', description: 'Основы космического вооружения.', category: 'WEAPONS', subtype: 'FOUNDATION', cost: 5000, requirements: [], unlocks: {}
};

export const weap_coilguns: Technology = {
  id: 'weap_coilguns', name: 'Электромагнитные пушки', description: 'Использование электромагнитных явлений для ускорения баллистических снарядов подвергалось сомнению в условиях атмосфер многими цивилизациями... Но в космосе многие проблемы данной технологии устранены благодаря вакууму. Открывает базовые кинетические орудия. Открывает доступ к технологиям практического применения электромагнитного ускорения в небоевых системах', category: 'WEAPONS', subtype: 'KINETIC', cost: 10000, requirements: ['weap_root'], unlocks: { weapons: ['coilgun'] }
};

export const weap_lasers: Technology = {
  id: 'weap_lasers', name: 'Лазерное вооружение', description: 'Открытия в области применения лазеров тяжело было применить на практике, но не невозможно. Простые инфракрасные лазеры уже могли наносить тепловой урон структуре твёрдых объектов, но открытие парной модуляции частот позволило параллельное испоьзование обычного красного спектра видимого света для гарантированной дестабилизации твёрдых структур. Открывает базовое лазерное вооружение.', category: 'WEAPONS', subtype: 'ENERGY', cost: 11000, requirements: ['weap_root', 'las_tech_root'], unlocks: { weapons: ['red_laser']}
};

export const weap_railguns: Technology = {
  id: 'weap_railguns', name: 'Рельсотроны', description: 'Продвинутая кинетика.', category: 'WEAPONS', subtype: 'KINETIC', cost: 30000, requirements: ['weap_coilguns'], unlocks: { weapons: ['railgun'] }
};

export const weap_plasma: Technology = {
  id: 'weap_plasma', name: 'Плазменные ускорители', description: 'Наносит бонусный урон по броне.', category: 'WEAPONS', subtype: 'ENERGY', cost: 40000, requirements: ['weap_coilguns'], unlocks: { weapons: ['plasma_cannon'] }
};

export const weap_tachyon_lances: Technology = {
  id: 'weap_tachyon_lances', name: 'Тахионные копья', description: 'Разрушительное сфокусированное энергетическое оружие сверхдальнего радиуса.', category: 'WEAPONS', subtype: 'ENERGY', cost: 250000, requirements: ['weap_plasma'], isBreakthrough: true, unlocks: { weapons: ['tachyon_lance'] }
};

export const upgrade_combat_t2: Technology = {
  id: 'upgrade_combat_t2', name: 'Боевая Эффективность II', description: 'Позволяет улучшать орудийные палубы до 2 уровня.', category: 'WEAPONS', subtype: 'MAINTENANCE', cost: 60000, requirements: ['weap_coilguns'], unlocks: { }
};

export const upgrade_combat_t3: Technology = {
  id: 'upgrade_combat_t3', name: 'Боевая Эффективность III', description: 'Разблокирует 3 уровень для всех типов вооружения.', category: 'WEAPONS', subtype: 'MAINTENANCE', cost: 180000, requirements: ['upgrade_combat_t2'], isBreakthrough: true, unlocks: { }
};

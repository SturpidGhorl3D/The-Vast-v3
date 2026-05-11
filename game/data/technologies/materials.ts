import { Technology } from '../../../components/game/technologyTypes';

export const mat_durasteel: Technology = {
  id: 'mat_durasteel', name: 'Дюрасталь', description: 'Стандартный броневой сплав.', category: 'MATERIALS', subtype: 'ALLOY', cost: 10000, requirements: ['phys_particle_theory'], unlocks: { materials: ['durasteel'] }, shipTypeRestriction: ['STANDARD', 'BIOMECHANICAL']
};

export const mat_crystal_structure: Technology = {
  id: 'mat_crystal_structure', name: 'Кристаллическая решетка', description: 'Основа для манипуляции структурой кристаллов.', category: 'MATERIALS', subtype: 'CRYSTAL', cost: 10000, requirements: ['phys_particle_theory'], unlocks: { materials: ['basic_crystal'] }, shipTypeRestriction: ['CRYSTALLID']
};

export const mat_organic_lattice: Technology = {
  id: 'mat_organic_lattice', name: 'Органическая решетка', description: 'Основа для выращивания живых корпусов.', category: 'MATERIALS', subtype: 'ORGANIC', cost: 10000, requirements: ['phys_approach'], unlocks: { materials: ['basic_organic'] }, shipTypeRestriction: ['ORGANIC']
};

export const mat_plasteel: Technology = {
  id: 'mat_plasteel', name: 'Пласталь', description: 'Улучшенный полимерно-металлический композит.', category: 'MATERIALS', subtype: 'ALLOY', cost: 25000, requirements: ['mat_durasteel'], unlocks: { materials: ['plasteel'] }, shipTypeRestriction: ['STANDARD', 'BIOMECHANICAL']
};

export const mat_pure_crystals: Technology = {
  id: 'mat_pure_crystals', name: 'Чистые кристаллы', description: 'Выращивание сверхпрочных монокристаллов.', category: 'MATERIALS', subtype: 'CRYSTAL', cost: 25000, requirements: ['mat_crystal_structure'], unlocks: { materials: ['pure_crystal'] }, shipTypeRestriction: ['CRYSTALLID']
};

export const mat_crystal_alloys: Technology = {
  id: 'mat_crystal_alloys', name: 'Кристалл-совместимые сплавы', description: 'Гибридные материалы для гибкости структуры.', category: 'MATERIALS', subtype: 'CRYSTAL_HYBRID', cost: 25000, requirements: ['mat_crystal_structure'], unlocks: { materials: ['crystal_alloy'] }, shipTypeRestriction: ['CRYSTALLID']
};

export const mat_ceramo_metal: Technology = {
  id: 'mat_ceramo_metal', name: 'Керамо-металлическая броня', description: 'Сплав с устойчивостью к энергетическому урону.', category: 'MATERIALS', subtype: 'ALLOY', cost: 50000, requirements: ['mat_plasteel'], unlocks: { materials: ['ceramo_metal'] }, shipTypeRestriction: ['STANDARD', 'BIOMECHANICAL']
};

export const mat_neutronium: Technology = {
  id: 'mat_neutronium', name: 'Нейтрониевая ковка', description: 'Сверхплотные материалы защищают от кинетики.', category: 'MATERIALS', subtype: 'ALLOY', cost: 100000, requirements: ['mat_ceramo_metal'], unlocks: { materials: ['neutronium'] }, shipTypeRestriction: ['STANDARD', 'BIOMECHANICAL']
};

export const mat_dragon_scales: Technology = {
  id: 'mat_dragon_scales', name: 'Чешуя Дракона', description: 'Органическая само-восстанавливающаяся броня.', category: 'MATERIALS', subtype: 'ORGANIC', cost: 200000, requirements: ['mat_organic_lattice'], unlocks: { materials: ['dragon_scales'] }, shipTypeRestriction: ['ORGANIC']
};

export const mat_dark_matter: Technology = {
  id: 'mat_dark_matter', name: 'Дефлекторы Темной Материи', description: 'Материал с пространственными искажениями.', category: 'MATERIALS', subtype: 'VOID', cost: 400000, requirements: ['mat_dragon_scales'], isBreakthrough: true, unlocks: { materials: ['dark_matter'] }
};

export const mat_stellarite: Technology = {
  id: 'mat_stellarite', name: 'Стелларитовая ковка', description: 'Финальный рубеж корпусной инженерии.', category: 'MATERIALS', subtype: 'VOID', cost: 800000, requirements: ['mat_dark_matter'], unlocks: { materials: ['stellarite'] }
};

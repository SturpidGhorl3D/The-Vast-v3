export type SpeciesClass = 'SILICOID' | 'ORGANIC' | 'MACHINE' | 'SOLID_LIGHT' | 'GAS_DWELLER';

export type EnvironmentType = 'OCEAN' | 'DESERT' | 'TUNDRA' | 'TROPICAL' | 'CONTINENTAL' | 'ARID' | 'ALPINE' | 'SAVANNAH';

export type HivemindType = 'INDIVIDUAL' | 'MULTI_HIVEMIND' | 'PSEUDO_HIVEMIND' | 'TRUE_HIVEMIND';

export type ShipConstructionType = 'CRYSTALLID' | 'BIOMECHANICAL' | 'ORGANIC' | 'STANDARD';

export type CreatureType = 'BIPEDAL' | 'QUADRUPEDAL' | 'AVIARY' | 'AQUATIC' | 'AMORPHOUS' | 'INSECTOID';

export interface SpeciesTrait {
  id: string;
  name: string;
  description: string;
  cost: number;
  conflictsWith?: string[];
}

export const SPECIES_TRAITS: SpeciesTrait[] = [
  { id: 'strong', name: 'Сильные', description: 'Увеличенный урон в ближнем бою и грузоподъемность.', cost: 1, conflictsWith: ['weak'] },
  { id: 'weak', name: 'Слабые', description: 'Сниженный урон в ближнем бою и грузоподъемность.', cost: -1, conflictsWith: ['strong', 'very_strong'] },
  { id: 'very_strong', name: 'Очень сильные', description: 'Значительно увеличенный урон в ближнем бою.', cost: 3, conflictsWith: ['weak', 'strong'] },
  { id: 'intelligent', name: 'Интеллектуальные', description: '+10% к скорости исследований.', cost: 2, conflictsWith: ['slow_learners'] },
  { id: 'slow_learners', name: 'Тупые', description: '-10% к скорости исследований.', cost: -1, conflictsWith: ['intelligent'] },
  { id: 'adaptive', name: 'Адаптивные', description: '+10% к приспособленности на всех планетах.', cost: 2, conflictsWith: ['nonadaptive', 'extremely_adaptive'] },
  { id: 'nonadaptive', name: 'Неадаптивные', description: '-10% к приспособленности.', cost: -1, conflictsWith: ['adaptive', 'extremely_adaptive'] },
  { id: 'extremely_adaptive', name: 'Крайне адаптивные', description: '+20% к приспособленности.', cost: 4, conflictsWith: ['adaptive', 'nonadaptive'] },
  { id: 'rapid_breeders', name: 'Плодовитые', description: '+10% к скорости роста населения.', cost: 1, conflictsWith: ['slow_breeders'] },
  { id: 'slow_breeders', name: 'Медленно размножающиеся', description: '-10% к скорости роста населения.', cost: -1, conflictsWith: ['rapid_breeders'] },
  { id: 'industrious', name: 'Трудолюбивые', description: '+15% к производству минералов.', cost: 2, conflictsWith: ['decadent'] },
  { id: 'decadent', name: 'Декадентные', description: 'Снижено производство, если нет рабов или роботов.', cost: -1, conflictsWith: ['industrious'] },
];

export interface SpeciesDefinition {
  id: string;
  name: string;
  pluralName: string;
  adjective: string;
  portraitDataUrl?: string | null;
  portraitParts?: any[]; // The raw JSON parts from the portrait editor
  speciesClass: SpeciesClass;
  environment: EnvironmentType;
  organization: HivemindType;
  traits: string[]; // array of trait IDs
  shipType: ShipConstructionType;
  creatureType: CreatureType;
  averageSizeMeters: number; // Size affects housing, ship spacing, reproduction, efficiency, and consumption
}

export const SPECIES_CLASS_LABELS: Record<SpeciesClass, string> = {
  SILICOID: 'Литоиды (Кремниевые)',
  ORGANIC: 'Органические',
  MACHINE: 'Машины',
  SOLID_LIGHT: 'Твёрдые светоформы',
  GAS_DWELLER: 'Обитатели газовых гигантов'
};

export const ENVIRONMENT_LABELS: Record<EnvironmentType, string> = {
  OCEAN: 'Океанические условия',
  DESERT: 'Пустынные условия',
  TUNDRA: 'Условия тундры',
  TROPICAL: 'Тропические условия',
  CONTINENTAL: 'Континентальные условия',
  ARID: 'Засушливые условия',
  ALPINE: 'Альпийские условия',
  SAVANNAH: 'Условия саванны'
};

export const HIVEMIND_LABELS: Record<HivemindType, string> = {
  INDIVIDUAL: 'Индивиды',
  MULTI_HIVEMIND: 'Мульти-Разум Улья',
  PSEUDO_HIVEMIND: 'Псевдо-Разум Улья',
  TRUE_HIVEMIND: 'Истинный Разум Улья'
};

export const SHIP_TYPE_LABELS: Record<ShipConstructionType, string> = {
  CRYSTALLID: 'Кристаллиды',
  BIOMECHANICAL: 'Биомеханические',
  ORGANIC: 'Органические',
  STANDARD: 'Космический стандарт'
};

export const CREATURE_TYPE_LABELS: Record<CreatureType, string> = {
  BIPEDAL: 'Двуногие',
  QUADRUPEDAL: 'Четвероногие',
  AVIARY: 'Птицеподобные',
  AQUATIC: 'Водные',
  AMORPHOUS: 'Аморфные',
  INSECTOID: 'Инсектоиды'
};

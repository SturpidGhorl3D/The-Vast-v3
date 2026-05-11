import { Technology } from '../../../components/game/technologyTypes';

export const dip_root: Technology = {
  id: 'dip_root', name: 'Лингвистическая теория', description: 'Основы межзвездной коммуникации.', category: 'DIPLOMACY', subtype: 'FOUNDATION', cost: 5000, requirements: [], unlocks: {}
};

export const dip_translation_matrices: Technology = {
  id: 'dip_translation_matrices', name: 'Матрицы перевода', description: 'Позволяет контактировать с другими расами без агрессии по умолчанию.', category: 'DIPLOMACY', subtype: 'COMMS', cost: 10000, requirements: ['dip_root'], unlocks: { }
};

export const dip_galactic_market: Technology = {
  id: 'dip_galactic_market', name: 'Доступ к Галактическому Рынку', description: 'Позволяет торговать с нейтральными станциями.', category: 'DIPLOMACY', subtype: 'TRADE', cost: 50000, requirements: ['dip_translation_matrices'], unlocks: { }
};

import { Technology } from '../../../components/game/technologyTypes';

export const soc_root: Technology = {
  id: 'soc_root', name: 'Социальная динамика', description: 'Основы управления массами.', category: 'SOCIOLOGY', subtype: 'FOUNDATION', cost: 5000, requirements: [], unlocks: {}
};

export const soc_bureaucratic_apparatus: Technology = {
  id: 'soc_bureaucratic_apparatus', name: 'Бюрократический аппарат', description: 'Снижает штрафы от размера государства.', category: 'SOCIOLOGY', subtype: 'ADMIN', cost: 20000, requirements: ['soc_root'], unlocks: { stats: { 'admin_cap': 1.2 } }
};

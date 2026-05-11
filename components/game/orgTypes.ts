export type OrganizationType = 'STATE' | 'NOMAD' | 'CAPTAIN';

export interface Origin {
  id: string;
  name: string;
  description: string;
  orgType: OrganizationType;
  baseBudget: number;
}

export const ORIGINS: Origin[] = [
  { id: 'state-planet', name: 'Планетарное государство', description: 'Осели на планете, развивая сельское хозяйство и индустрию.', orgType: 'STATE', baseBudget: 1000 },
  { id: 'nomad-ark', name: 'Ковчег', description: 'Живёте на огромном корабле-городе, путешествуя между звёздами.', orgType: 'NOMAD', baseBudget: 500 },
  { id: 'captain-freelance', name: 'Независимый капитан', description: 'Свободный охотник за удачей на собственном корабле.', orgType: 'CAPTAIN', baseBudget: 100 },
];

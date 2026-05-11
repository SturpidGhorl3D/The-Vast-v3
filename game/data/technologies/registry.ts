import { Technology } from '../../../components/game/technologyTypes';
import * as materials from './materials';
import * as engineering from './engineering';
import * as weapons from './weapons';
import * as production from './production';
import * as modifications from './modifications';
import * as sociology from './sociology';
import * as diplomacy from './diplomacy';
import * as physics from './physics';

const moduleList = [
  physics,
  materials,
  engineering,
  weapons,
  production,
  modifications,
  sociology,
  diplomacy
];

export const ALL_TECHNOLOGIES: Record<string, Technology> = {};

moduleList.forEach(mod => {
  Object.values(mod).forEach(item => {
    if (item && typeof item === 'object' && 'id' in item && 'name' in item && 'category' in item) {
      ALL_TECHNOLOGIES[(item as any).id] = item as Technology;
    }
  });
});

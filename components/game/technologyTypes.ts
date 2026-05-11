export type TechCategory = 
  | 'MATERIALS'
  | 'ENGINEERING'
  | 'WEAPONS'
  | 'MODIFICATIONS'
  | 'PRODUCTION'
  | 'SOCIOLOGY'
  | 'DIPLOMACY'
  | 'PHYSICS';

export interface Technology {
  id: string;
  name: string;
  description: string;
  category: TechCategory;
  subtype: string; // "Line" or branch of tech
  cost: number; // Cost in research points (x10 from original)
  requirements: string[]; // IDs of required tech
  resourceCost?: Record<string, number>; // Extra resource costs
  unlocks: {
    materials?: string[];
    compartments?: string[];
    weapons?: string[];
    recipes?: string[];
    stats?: Record<string, number>;
  };
  isBreakthrough?: boolean;
  shipTypeRestriction?: ('CRYSTALLID' | 'BIOMECHANICAL' | 'ORGANIC' | 'STANDARD')[];
}

import { ALL_TECHNOLOGIES } from '../../game/data/technologies/registry';

export const TECHNOLOGIES: Record<string, Technology> = ALL_TECHNOLOGIES;


export const COMPARTMENT_TECH_REQUIREMENTS: Record<string, string> = {
  BRIDGE: 'eng_basic_construction',
  ENGINE: 'eng_basic_construction',
  WARP_ENGINE: 'eng_modular_decks', 
  CARGO: 'eng_basic_construction',
  WEAPON: 'weap_coilguns', // basic weapon tech
  MINING: 'eng_basic_construction',
  REACTOR: 'eng_basic_construction',
  GYRO: 'eng_basic_construction',
  MACHINERY: 'prod_basic_refining',
  FABRIC: 'prod_advanced_refining',
  COMMUNICATION: 'dip_translation_matrices',
  RESEARCH: 'eng_research_labs',
};

export const COMPARTMENT_UPGRADE_TECH_REQUIREMENTS: Record<string, Record<number, string>> = {
  ENGINE: { 1: 'upgrade_t2_systems', 2: 'upgrade_t3_systems' },
  REACTOR: { 1: 'upgrade_t2_systems', 2: 'upgrade_t3_systems' },
  WEAPON: { 1: 'upgrade_combat_t2', 2: 'upgrade_combat_t3' },
  MINING: { 1: 'upgrade_t2_systems', 2: 'upgrade_t3_systems' },
  CARGO: { 1: 'upgrade_t2_systems', 2: 'upgrade_t3_systems' },
};

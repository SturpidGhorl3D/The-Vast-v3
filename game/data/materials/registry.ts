import { ComponentRecipe } from '../../materials';
import { STANDARD_COMPOSITES } from './tier1/standard_composites';
import { ALL_METAL_COMPONENTS } from './tier1/all_metal_components';
import { BIOCERAMIC } from './tier1/bioceramic';
import { BIOGENIC_COMPONENTS } from './tier1/biogenic_components';
import { RESISTANT_TISSUE } from './tier1/resistant_tissue';
import { SKELETAL_COMPONENTS } from './tier1/skeletal_components';
import { POLYSILICATE_T1 } from './tier1/polysilicate_t1';
import { CRYSTAL_SLAG_COMPONENTS } from './tier1/crystal_slag_components';
import { FOCAL_LENS_VISIBLE } from './mining/focal_lens_visible';
import { PLASMA_MODULATOR } from './mining/plasma_modulator';
import { MAGNETIC_COIL } from './weapon/magnetic_coil';
import { DISCHARGE_CAPACITOR } from './weapon/discharge_capacitor';
import { CHARGING_COMP_T1 } from './weapon/charging_comp_t1';
import { WEAPON_STRUCTURAL_COMP } from './weapon/weapon_structural_comp';
import { REACTOR_CORE_COMP } from './reactor/reactor_core_comp';
import { COOLING_COMP } from './reactor/cooling_comp';

export const ALL_MATERIALS: ComponentRecipe[] = [
  STANDARD_COMPOSITES,
  ALL_METAL_COMPONENTS,
  BIOCERAMIC,
  BIOGENIC_COMPONENTS,
  RESISTANT_TISSUE,
  SKELETAL_COMPONENTS,
  POLYSILICATE_T1,
  CRYSTAL_SLAG_COMPONENTS,
  FOCAL_LENS_VISIBLE,
  PLASMA_MODULATOR,
  MAGNETIC_COIL,
  DISCHARGE_CAPACITOR,
  CHARGING_COMP_T1,
  WEAPON_STRUCTURAL_COMP,
  REACTOR_CORE_COMP,
  COOLING_COMP
];

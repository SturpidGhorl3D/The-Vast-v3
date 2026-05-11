import { Technology } from '../../../components/game/technologyTypes';

// --- ROOT FUNDAMENTALS ---

export const phys_method_root: Technology = {
  id: 'phys_meth_root',
  name: 'Естественно-научная методология',
  description: 'Основа любого познания. Установление строгих правил наблюдения, эксперимента и воспроизводимости результатов. Без этого фундамента наука остается лишь набором разрозненных догадок.',
  category: 'PHYSICS',
  subtype: 'FOUNDATION',
  cost: 500,
  requirements: [],
  unlocks: { stats: { research_speed: 0.1 } }
};

export const phys_approach: Technology = {
  id: 'phys_approach',
  name: 'Физический подход',
  description: 'Принятие концепции, согласно которой вселенную можно описать через объективные законы материи и движения. Переход от исключительно эмпирического наблюдения к теоретическому моделированию и совмещению данных подходов в единое целое, расширяя возможности науки как таковой.',
  category: 'PHYSICS',
  subtype: 'FOUNDATION',
  cost: 600,
  requirements: ['phys_method_root'],
  unlocks: {}
};

export const phys_comp_basics: Technology = {
  id: 'phys_comp_basics',
  name: 'Основы вычислительных процессов',
  description: 'Понимание того, что информация — это физическая сущность, которой можно манипулировать. Первые шаги к созданию систем обработки данных космического класса.',
  category: 'PHYSICS',
  subtype: 'COMPUTING',
  cost: 700,
  requirements: ['phys_approach'],
  unlocks: {}
};

export const phys_adv_algorithms: Technology = {
  id: 'phys_adv_algorithms',
  name: 'Продвинутое алгоритмирование',
  description: 'С развитием общества растёт и сложность систем на которые оно полагается. Автоматизация, дистанционное управление, контроль процессов... И с каждым разом алгоритмы для таких задач требуются всё сложнее и сложнее. Но именно они определяют успех цивилизации',
  category: 'PHYSICS',
  subtype: 'COMPUTING',
  cost: 1200,
  requirements: ['phys_comp_basics'],
  unlocks: {}
};

export const phys_space_electronics: Technology = {
  id: 'phys_space_electronics',
  name: 'Электроника космической эпохи',
  description: 'Создание компонентов, способных работать в условиях радиации, вакуума и экстремальных температур колыбели звезд, а так-же заточенных именно под особые задачи требуемые для функцинала космических объектов.',
  category: 'PHYSICS',
  subtype: 'ENGINEERING',
  cost: 1500,
  requirements: ['phys_approach'],
  unlocks: {}
};

export const phys_particle_theory: Technology = {
  id: 'phys_particle_theory',
  name: 'Основы теории частиц',
  description: 'Частицы - это основа основ нашего мира, его связующие и строительные компоненты. От передатчиков взаимодействия до составных частей материи. Без знания частиц в современной физике, инженерии, и многих других естественных науках невозможно добиться прогресса.',
  category: 'PHYSICS',
  subtype: 'THEORY',
  cost: 2000,
  requirements: ['phys_approach'],
  unlocks: {}
};

export const phys_field_theory: Technology = {
  id: 'phys_field_theory',
  name: 'Основы теории полей',
  description: 'Электромагнитные, гравитационные и квантовые поля. Понимание того, как силы пронизывают пространство, необходимо для огромного перечня практических и теоретических наук и технологий.',
  category: 'PHYSICS',
  subtype: 'THEORY',
  cost: 2200,
  requirements: ['phys_approach'],
  unlocks: {}
};

export const phys_energy_theory: Technology = {
  id: 'phys_energy_theory',
  name: 'Основы теории энергий',
  description: 'Во вселенной есть множество видов взаимодействия материи и энергии... если материю ещё можно пощупать, то энергию нет, а потому так важно знать - что это, и какие есть её виды для того чтобы не замереть на месте в технологическом прогрессе',
  category: 'PHYSICS',
  subtype: 'THEORY',
  cost: 2500,
  requirements: ['phys_particle_theory', 'phys_approach'],
  unlocks: {}
};

export const phys_space_theory: Technology = {
  id: 'phys_space_theory',
  name: 'Основы теории пространства',
  description: 'Геометрия, топология, те науки что позволяют цивилизациям мерять пространство вокруг себя, необходимые знания для любых симуляций и современной архитектуре и инженерии',
  category: 'PHYSICS',
  subtype: 'THEORY',
  cost: 3000,
  requirements: ['phys_approach'],
  unlocks: {}
};

// --- EARLY APPLICATIONS (Previously existing or related to roots) ---

export const las_tech_root: Technology = {
  id: 'las_tech_root',
  name: 'Практические лазерные технологии',
  description: 'Удешевление методов проведения экспериментов с лазерами и оптикой, а так-же создание надёжных лазерных установок - необходимый шаг для дальнейшего развития науки.',
  category: 'PHYSICS',
  subtype: 'PARTICLES',
  cost: 7500,
  requirements: ['phys_space_electronics', 'phys_particle_theory'],
  unlocks: {}
};

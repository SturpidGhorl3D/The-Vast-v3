import React, { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft, ArrowRight, UserCircle, Cpu, Droplet, Wind, Mountain, Globe2, Trees, Leaf, Check, Search, Shell, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import { 
  SpeciesDefinition, 
  SpeciesClass, 
  EnvironmentType, 
  HivemindType, 
  ShipConstructionType,
  CreatureType,
  SPECIES_CLASS_LABELS, 
  ENVIRONMENT_LABELS, 
  HIVEMIND_LABELS, 
  SHIP_TYPE_LABELS,
  CREATURE_TYPE_LABELS,
  SPECIES_TRAITS 
} from '@/components/game/speciesTypes';

const SPECIES_PRESETS: Partial<SpeciesDefinition>[] = [
  {
    name: 'Люди',
    pluralName: 'Люди',
    adjective: 'Человеческий',
    speciesClass: 'ORGANIC',
    environment: 'CONTINENTAL',
    organization: 'INDIVIDUAL',
    shipType: 'STANDARD',
    creatureType: 'BIPEDAL',
    traits: ['intelligent', 'adaptive']
  },
  {
    name: 'Литоидный Рой',
    pluralName: 'Литоиды',
    adjective: 'Литоидный',
    speciesClass: 'SILICOID',
    environment: 'DESERT',
    organization: 'TRUE_HIVEMIND',
    shipType: 'CRYSTALLID',
    creatureType: 'AMORPHOUS',
    traits: ['strong', 'industrious', 'nonadaptive']
  },
  {
    name: 'Синтетическая Сеть',
    pluralName: 'Машины',
    adjective: 'Машинный',
    speciesClass: 'MACHINE',
    environment: 'ARID',
    organization: 'PSEUDO_HIVEMIND',
    shipType: 'STANDARD',
    creatureType: 'BIPEDAL',
    traits: ['intelligent', 'industrious']
  }
];

import PortraitEditor from '@/components/ui/species-editor/PortraitEditor';

interface Props {
  onExit: () => void;
  onSave?: (species: SpeciesDefinition) => void;
  initialData?: SpeciesDefinition;
}

export default function SpeciesDesigner({ onExit, onSave, initialData }: Props) {
  const [mode, setMode] = useState<'DETAILS' | 'PORTRAIT'>('DETAILS');
  const isMobile = useIsMobile();
  const [showPreview, setShowPreview] = useState(false);

  // Fields
  const [name, setName] = useState(initialData?.name || '');
  const [pluralName, setPluralName] = useState(initialData?.pluralName || '');
  const [adjective, setAdjective] = useState(initialData?.adjective || '');
  const [speciesClass, setSpeciesClass] = useState<SpeciesClass>(initialData?.speciesClass || 'ORGANIC');
  const [environment, setEnvironment] = useState<EnvironmentType>(initialData?.environment || 'CONTINENTAL');
  const [organization, setOrganization] = useState<HivemindType>(initialData?.organization || 'INDIVIDUAL');
  const [shipType, setShipType] = useState<ShipConstructionType>(initialData?.shipType || 'STANDARD');
  const [creatureType, setCreatureType] = useState<CreatureType>(initialData?.creatureType || 'BIPEDAL');
  const [averageSizeMeters, setAverageSizeMeters] = useState<number>(initialData?.averageSizeMeters || 1.8);
  
  const [selectedTraits, setSelectedTraits] = useState<string[]>(initialData?.traits || []);
  const [portraitDataUrl, setPortraitDataUrl] = useState<string | null>(initialData?.portraitDataUrl || null);
  const [portraitParts, setPortraitParts] = useState<any[]>(initialData?.portraitParts || []);

  // Trait Cost Logic
  const TRAIT_POINTS_MAX = 2;
  const TRAIT_PICKS_MAX = 5;

  const currentPoints = selectedTraits.reduce((acc, traitId) => {
    const t = SPECIES_TRAITS.find(x => x.id === traitId);
    return acc - (t?.cost || 0);
  }, TRAIT_POINTS_MAX);

  const toggleTrait = (traitId: string) => {
    if (selectedTraits.includes(traitId)) {
      setSelectedTraits(selectedTraits.filter(t => t !== traitId));
      return;
    }

    if (selectedTraits.length >= TRAIT_PICKS_MAX) return;

    const trait = SPECIES_TRAITS.find(t => t.id === traitId);
    if (!trait) return;

    // Check conflicts
    const hasConflict = trait.conflictsWith?.some(c => selectedTraits.includes(c));
    if (hasConflict) return;

    setSelectedTraits([...selectedTraits, traitId]);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        id: initialData?.id || crypto.randomUUID(),
        name,
        pluralName,
        adjective,
        speciesClass,
        environment,
        organization,
        shipType,
        creatureType,
        averageSizeMeters,
        traits: selectedTraits,
        portraitDataUrl,
        portraitParts
      });
    } else {
      // Stand-alone save behavior
      console.log('Saved species locally.', {
        name, pluralName, adjective, speciesClass, environment, organization, shipType, creatureType, averageSizeMeters, traits: selectedTraits, portraitParts
      });
      onExit();
    }
  };


  if (mode === 'PORTRAIT') {
    return (
       <PortraitEditor 
          onExit={() => setMode('DETAILS')}
          initialParts={portraitParts.length > 0 ? portraitParts : undefined}
          onSavePortrait={(dataUrl: string, parts: any[]) => {
              setPortraitDataUrl(dataUrl);
              setPortraitParts(parts);
              setMode('DETAILS');
          }}
       />
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Left Menu / Navigation */}
      <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-white/10 flex flex-col shrink-0 relative z-20 shadow-2xl">
        <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
          <button onClick={onExit} className="p-2 -ml-2 text-white/50 hover:bg-white/10 hover:text-white rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm tracking-widest text-neutral-400 uppercase">ОПЕРАЦИЯ</span>
          {isMobile && (
            <button 
              onClick={() => setShowPreview(!showPreview)} 
              className="p-2 text-blue-400 hover:bg-white/10 rounded-full transition-colors"
            >
              {showPreview ? <X size={20} /> : <Eye size={20} />}
            </button>
          )}
        </div>
        
        <div className={cn("p-4 space-y-4 flex-1 overflow-y-auto", isMobile && !showPreview && "max-h-[200px] md:max-h-none")}>
          <div className="space-y-4">
             <div>
                <div className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase mb-2 ml-2">СТРОЕНИЕ</div>
                <div className="space-y-1">
                   <button className={cn("w-full text-left px-4 py-3 rounded text-sm font-medium transition-all shadow-md relative overflow-hidden", "bg-white/5 hover:bg-white/10")}>
                     <span>Биология</span>
                   </button>
                   <button 
                       onClick={() => setMode('PORTRAIT')}
                       className={cn("w-full text-left px-4 py-3 rounded text-sm font-medium transition-all shadow-md relative overflow-hidden", "bg-blue-600/20 hover:bg-blue-600/30 text-blue-100")}
                    >
                     <span className="flex items-center gap-2"><UserCircle size={16} />Редактор портрета</span>
                   </button>
                </div>
             </div>

             <div className={cn(isMobile && "hidden md:block")}>
                <div className="text-[10px] text-amber-400 font-mono tracking-widest uppercase mb-2 ml-2">ПРЕСЕТЫ</div>
                <div className="space-y-1">
                   {SPECIES_PRESETS.map((p, idx) => (
                      <button 
                         key={idx}
                         onClick={() => {
                            setName(p.name || '');
                            setPluralName(p.pluralName || '');
                            setAdjective(p.adjective || '');
                            setSpeciesClass(p.speciesClass || 'ORGANIC');
                            setEnvironment(p.environment || 'CONTINENTAL');
                            setOrganization(p.organization || 'INDIVIDUAL');
                            setSelectedTraits(p.traits || []);
                         }}
                         className="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors border border-transparent hover:border-white/10"
                      >
                         {p.name}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-neutral-900 sticky bottom-0">
          <button 
             onClick={handleSave}
             disabled={!name.trim()}
             className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-bold tracking-tighter shadow-lg shadow-blue-500/20 uppercase text-xs sm:text-sm"
          >
             Завершить создание
          </button>
        </div>
      </aside>

      {/* Preview Overlay for Mobile */}
      {isMobile && showPreview && (
        <div className="absolute inset-x-0 top-16 bottom-0 z-30 bg-neutral-950 p-6 overflow-y-auto animate-in slide-in-from-top duration-200">
           <div className="space-y-6 max-w-md mx-auto">
              <div className="aspect-square bg-black border border-white/10 flex items-center justify-center relative shadow-inner overflow-hidden rounded-xl">
                 {portraitDataUrl ? (
                    <img src={portraitDataUrl} alt="Portrait" className="w-full h-full object-cover" />
                 ) : (
                    <div className="text-center text-neutral-500 text-xs p-6 space-y-2">
                      <UserCircle className="mx-auto w-10 h-10 opacity-20" />
                      <div>Портрет не задан</div>
                    </div>
                 )}
              </div>

              <div className="text-center">
                  <h3 className="font-bold text-2xl mb-1">{name || 'Неизвестный Вид'}</h3>
                  <div className="text-sm text-neutral-400 mb-4">{SPECIES_CLASS_LABELS[speciesClass]}</div>
                  
                  <div className="bg-black/50 p-4 border border-white/5 text-left text-sm space-y-3 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Организация:</span>
                        <span className="text-white">{HIVEMIND_LABELS[organization]}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Предпочитаемый мир:</span>
                        <span className="text-white">{ENVIRONMENT_LABELS[environment]}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                        <span className="text-neutral-500 block mb-2">Выбранные таланты:</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedTraits.length > 0 ? selectedTraits.map(t => {
                              const tg = SPECIES_TRAITS.find(st => st.id === t);
                              return <span key={t} className="text-xs bg-blue-600/20 border border-blue-500/30 px-2.5 py-1 rounded-full text-blue-100">{tg?.name}</span>
                          }) : <span className="text-neutral-600 text-xs italic">Нет талантов</span>}
                        </div>
                    </div>
                  </div>
              </div>
              
              <button 
                onClick={() => setShowPreview(false)}
                className="w-full py-4 bg-neutral-800 text-neutral-400 rounded-lg text-sm font-medium uppercase tracking-widest mt-4"
              >
                Вернуться к редактированию
              </button>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
         <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 max-w-4xl pt-8 md:pt-12">
            
            {/* Header Identity */}
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-4xl font-light tracking-tight">Идентичность Вида</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                 <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Название (Напр. Человек)</label>
                    <input 
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-3 text-base sm:text-lg outline-none focus:border-blue-500/50" 
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Множественное (Напр. Люди)</label>
                    <input 
                      type="text" value={pluralName} onChange={e => setPluralName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-3 text-base sm:text-lg outline-none focus:border-blue-500/50" 
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Прилагательное (Напр. Человеческий)</label>
                    <input 
                      type="text" value={adjective} onChange={e => setAdjective(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-3 text-base sm:text-lg outline-none focus:border-blue-500/50" 
                    />
                 </div>
              </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Класс Вида</h3>
               <div className="flex flex-wrap gap-2 sm:gap-3">
                 {Object.entries(SPECIES_CLASS_LABELS).map(([key, label]) => {
                    const isSelected = speciesClass === key as SpeciesClass;
                    return (
                        <button 
                           key={key} 
                           onClick={() => setSpeciesClass(key as SpeciesClass)}
                           className={cn(
                             "px-4 sm:px-6 py-3 sm:py-4 border transition-all text-xs sm:text-sm font-medium rounded-md", 
                             isSelected ? "bg-blue-600/20 border-blue-400 text-white" : "bg-neutral-900 border-white/5 hover:border-white/20 text-neutral-400"
                           )}
                        >
                           {label}
                        </button>
                    )
                 })}
               </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Тип кораблей</h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                 {Object.entries(SHIP_TYPE_LABELS).map(([key, label]) => {
                    const isSelected = shipType === key as ShipConstructionType;
                    return (
                        <button 
                           key={key} 
                           onClick={() => setShipType(key as ShipConstructionType)}
                           className={cn(
                             "px-3 py-3 border transition-all text-xs sm:text-sm font-medium flex items-center justify-center gap-2 rounded-md", 
                             isSelected ? "bg-purple-600/20 border-purple-400 text-purple-50" : "bg-neutral-900 border-white/5 hover:border-white/20 text-neutral-400"
                           )}
                        >
                           {label}
                        </button>
                    )
                 })}
               </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Физиология</h3>
               <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-md">
                 <div className="flex justify-between items-end mb-4">
                    <label className="block text-sm font-medium text-neutral-300">Средний размер (метры)</label>
                    <span className="text-2xl font-mono text-emerald-400">{averageSizeMeters.toFixed(2)} м</span>
                 </div>
                 <input 
                   type="range" 
                   min="0.1" 
                   max="10.0" 
                   step="0.1" 
                   value={averageSizeMeters} 
                   onChange={e => setAverageSizeMeters(parseFloat(e.target.value))}
                   className="w-full h-2 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                 />
                 <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
                   Размер особи напрямую влияет на их физические потребности. Крупные существа занимают больше места на кораблях и планетах, требуют больше пищи и производят больше ресурсов за единицу времени, но при этом медленнее размножаются. Мелкие виды размножаются стремительно и требуют мало места, но их индивидуальная производительность ниже.
                 </p>
               </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Тип существ</h3>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                 {Object.entries(CREATURE_TYPE_LABELS).map(([key, label]) => {
                    const isSelected = creatureType === key as CreatureType;
                    return (
                        <button 
                           key={key} 
                           onClick={() => setCreatureType(key as CreatureType)}
                           className={cn(
                             "px-3 py-3 border transition-all text-xs sm:text-sm font-medium flex items-center justify-center gap-2 rounded-md", 
                             isSelected ? "bg-indigo-600/20 border-indigo-400 text-indigo-50" : "bg-neutral-900 border-white/5 hover:border-white/20 text-neutral-400"
                           )}
                        >
                           {label}
                        </button>
                    )
                 })}
               </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Предпочитаемые условия</h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                 {Object.entries(ENVIRONMENT_LABELS).map(([key, label]) => {
                    const isSelected = environment === key as EnvironmentType;
                    return (
                        <button 
                           key={key} 
                           onClick={() => setEnvironment(key as EnvironmentType)}
                           className={cn(
                             "px-3 py-3 border transition-all text-xs sm:text-sm font-medium flex items-center justify-center gap-2 rounded-md", 
                             isSelected ? "bg-emerald-600/20 border-emerald-400 text-emerald-50" : "bg-neutral-900 border-white/5 hover:border-white/20 text-neutral-400"
                           )}
                        >
                           {label}
                        </button>
                    )
                 })}
               </div>
            </section>

            <hr className="border-white/10" />

            <section className="space-y-4">
               <h3 className="text-xl sm:text-2xl font-light tracking-tight">Тип организации</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                 {Object.entries(HIVEMIND_LABELS).map(([key, label]) => {
                    const isSelected = organization === key as HivemindType;
                    return (
                        <button 
                           key={key} 
                           onClick={() => setOrganization(key as HivemindType)}
                           className={cn(
                             "px-4 py-4 border transition-all text-sm font-medium text-left rounded-md", 
                             isSelected ? "bg-amber-600/20 border-amber-400 shadow-[inset_0_0_20px_rgba(251,191,36,0.1)] text-amber-50" : "bg-neutral-900 border-white/5 hover:border-white/20 text-neutral-400"
                           )}
                        >
                           <div className="font-bold">{label}</div>
                           <div className="text-[10px] text-neutral-500 uppercase mt-1">
                              {key === 'INDIVIDUAL' && 'Традиционное общество'}
                              {key === 'TRUE_HIVEMIND' && 'Единое сознание'}
                              {(key === 'MULTI_HIVEMIND' || key === 'PSEUDO_HIVEMIND') && 'Коллективная структура'}
                           </div>
                        </button>
                    )
                 })}
               </div>
            </section>

            <hr className="border-white/10" />

            {/* Traits System */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <h3 className="text-xl sm:text-2xl font-light tracking-tight">Таланты</h3>
                  <div className="flex gap-2">
                     <div className="text-[10px] font-mono uppercase bg-neutral-800 px-3 py-1 rounded">
                       Очки: <span className={currentPoints < 0 ? "text-red-400" : "text-emerald-400"}>{currentPoints}</span>
                     </div>
                     <div className="text-[10px] font-mono uppercase bg-neutral-800 px-3 py-1 rounded">
                       Выборов: <span className={selectedTraits.length >= TRAIT_PICKS_MAX ? "text-orange-400" : "text-blue-400"}>{TRAIT_PICKS_MAX - selectedTraits.length}</span>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                   {SPECIES_TRAITS.map(trait => {
                       const isSelected = selectedTraits.includes(trait.id);
                       const hasConflict = trait.conflictsWith?.some(c => selectedTraits.includes(c)) && !isSelected;
                       const costColor = trait.cost > 0 ? "text-red-400" : "text-emerald-400";
                       
                       return (
                           <button 
                               key={trait.id}
                               onClick={() => toggleTrait(trait.id)}
                               disabled={hasConflict}
                               className={cn(
                                   "text-left p-3 sm:p-4 border transition-all relative overflow-hidden rounded-md",
                                   isSelected ? "bg-blue-900/20 border-blue-500/50" : 
                                   hasConflict ? "bg-neutral-900 border-white/5 opacity-40 cursor-not-allowed" : 
                                   "bg-neutral-900 border-white/5 hover:border-white/20 hover:bg-neutral-800"
                               )}
                           >
                               <div className="flex justify-between items-start mb-1 gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm">{trait.name}</h4>
                                  <span className={cn("text-[10px] sm:text-xs font-mono font-bold", costColor)}>{trait.cost > 0 ? `-${trait.cost}` : `+${Math.abs(trait.cost)}`}</span>
                               </div>
                               <p className="text-[10px] sm:text-xs text-neutral-400 leading-relaxed">{trait.description}</p>
                               {isSelected && <Check className="absolute bottom-2 right-2 text-blue-500 w-3 h-3 sm:w-4 sm:h-4 opacity-50" />}
                           </button>
                       )
                   })}
                </div>
            </section>
            
            <div className="h-24 sm:h-32" /> {/* Bottom padding */}
         </div>

         {/* Visual Output Panel (Desktop only) */}
         <aside className="w-80 bg-neutral-900/50 border-l border-white/10 shrink-0 p-6 flex flex-col gap-6 relative z-10 hidden xl:flex">
             <div className="space-y-4">
                <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest text-center">Обзор Вида</div>
                
                <div className="aspect-square bg-black border border-white/10 flex items-center justify-center relative shadow-inner overflow-hidden rounded">
                   {portraitDataUrl ? (
                      <img src={portraitDataUrl} alt="Portrait" className="w-full h-full object-cover" />
                   ) : (
                      <div className="text-center text-neutral-500 text-xs p-6 space-y-2">
                        <UserCircle className="mx-auto w-10 h-10 opacity-20" />
                        <div>Портрет не задан</div>
                      </div>
                   )}
                </div>

                <div className="text-center">
                    <h3 className="font-bold text-xl">{name || 'Неизвестный Вид'}</h3>
                    <div className="text-sm text-neutral-400">{SPECIES_CLASS_LABELS[speciesClass]}</div>
                </div>
             </div>

             <div className="bg-black/50 p-4 border border-white/5 text-sm space-y-2">
                 <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Организация:</span>
                    <span className="text-white text-right">{HIVEMIND_LABELS[organization]}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Предпочитаемый мир:</span>
                    <span className="text-white text-right">{ENVIRONMENT_LABELS[environment]}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Средний размер:</span>
                    <span className="text-white text-right">{averageSizeMeters.toFixed(2)} м</span>
                 </div>
                 <div className="flex justify-between items-start pt-2 border-t border-white/10 mt-2">
                    <span className="text-neutral-500">Таланты:</span>
                    <div className="text-right flex flex-col gap-1 items-end">
                       {selectedTraits.length > 0 ? selectedTraits.map(t => {
                          const tg = SPECIES_TRAITS.find(st => st.id === t);
                          return <span key={t} className="text-xs bg-white/10 px-2 py-0.5 rounded text-white">{tg?.name}</span>
                       }) : <span className="text-neutral-600 text-xs">Нет талантов</span>}
                    </div>
                 </div>
             </div>
         </aside>

      </main>
    </div>
  );
}

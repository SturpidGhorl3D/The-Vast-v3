'use client';

import React from 'react';
import { Faction } from '@/game/engine/types';
import { SpeciesDefinition, SPECIES_CLASS_LABELS, HIVEMIND_LABELS, SPECIES_TRAITS } from '@/components/game/speciesTypes';

interface DiplomacyWindowProps {
  faction: Faction;
  onClose: () => void;
  // you might want to pass more context like systems count, capital name etc.
  systemsCount?: number;
  capitalName?: string;
  relationValue?: number;
}

export const DiplomacyWindow: React.FC<DiplomacyWindowProps> = ({ 
  faction, onClose, systemsCount = 0, capitalName = 'Неизвестно', relationValue = 0
}) => {
  if (!faction) return null;
  const species = faction.species as SpeciesDefinition;

  // Helper to map ideo values to labels
  const getIdeoLabel = (key: string, val: number) => {
    const labels: Record<string, [string, string]> = {
      foreignPolicy: ['ОБОРОНА', 'ЭКСПАНСИЯ'],
      values: ['МАТЕРИАЛИЗМ', 'ДУХОВНОСТЬ'],
      aliens: ['КСЕНОФОБИЯ', 'КCЕНОФИЛИЯ'],
      power: ['ЛИБЕРАЛИЗМ', 'АВТОРИТАРИЗМ'],
      social: ['ПЛЮРАЛИЗМ', 'ЭЛИТИЗМ'],
      economy: ['КООПЕРАЦИЯ', 'КОНКУРЕНЦИЯ'],
      ecology: ['СОСУЩЕСТВОВАНИЕ', 'ЭГОИЗМ']
    };
    const pair = labels[key];
    if (!pair) return null;
    return val < 0 ? pair[0] : pair[1];
  };

  return (
    <div className="absolute top-[5%] md:top-[10%] left-1/2 -translate-x-1/2 pointer-events-auto bg-[#05070a]/98 border border-purple-500/40 p-0 w-[95vw] md:w-[700px] max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,1),0_0_20px_rgba(168,85,247,0.2)] z-50 font-mono text-purple-100 flex flex-col overflow-hidden rounded-sm">
      
      {/* Top Banner / Scanned effect line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent w-full opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>

      {/* Header */}
      <div className="flex justify-between items-center p-4 md:p-6 border-b border-purple-500/20 bg-purple-900/5">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <div className="w-2 h-8 md:w-3 md:h-12 flex-shrink-0" style={{backgroundColor: faction.color}}></div>
          <div className="truncate">
            <div className="text-lg md:text-2xl font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] truncate" style={{color: faction.color || '#a855f7'}}>
              {faction.name}
            </div>
            <div className="text-[8px] md:text-[10px] uppercase text-purple-400/60 tracking-wider flex items-center gap-2 mt-0.5">
              <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="truncate">Канал связи: {contactId.toString(16).padEnd(8, '4').slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-purple-500/10 transition-colors text-purple-500/50 hover:text-purple-400 flex-shrink-0">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex flex-col md:flex-row overflow-y-auto">
        {/* Left Side: Visuals & Traits */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-purple-500/20 p-4 md:p-6 flex flex-row md:flex-col gap-4 md:gap-6 bg-black/20">
          <div className="relative group w-24 h-24 md:w-full md:h-auto md:aspect-square flex-shrink-0">
             <div className="absolute inset-0 bg-purple-500/10 blur-xl group-hover:bg-purple-500/20 transition-all"></div>
             <div className="relative w-full h-full bg-black/60 border border-purple-500/30 flex items-center justify-center overflow-hidden">
                {species?.portraitDataUrl ? (
                   <img src={species.portraitDataUrl} alt="Portrait" className="object-contain w-full h-full p-2" />
                ) : (
                   <div className="flex flex-col items-center gap-1 opacity-30">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <p className="text-[8px] uppercase text-center hidden md:block">Визуальный шум</p>
                   </div>
                )}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
             </div>
          </div>

          <div className="flex-1 space-y-2 md:space-y-4">
             <div>
                <div className="text-[9px] text-purple-400/50 uppercase mb-1 tracking-widest border-b border-purple-500/10 pb-0.5">Черты вида</div>
                <div className="flex flex-wrap gap-1">
                   {species?.traits && species.traits.length > 0 ? (
                      species.traits.map(tId => {
                        const trait = SPECIES_TRAITS.find(st => st.id === tId);
                        return (
                          <div key={tId} className="px-1.5 py-0.5 bg-purple-900/20 border border-purple-500/30 text-[8px] uppercase font-bold text-purple-200" title={trait?.description}>
                             {trait?.name || tId}
                          </div>
                        );
                      })
                   ) : (
                      <span className="text-[8px] opacity-30 italic uppercase">Нет данных</span>
                   )}
                </div>
             </div>

             <div className="hidden md:block">
                <div className="text-[10px] text-purple-400/50 uppercase mb-2 tracking-widest border-b border-purple-500/10 pb-1">Физиология</div>
                <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                   <div className="opacity-50 uppercase">Класс:</div>
                   <div className="text-right font-bold text-purple-200 lowercase italic truncate break-all">{species ? SPECIES_CLASS_LABELS[species.speciesClass] : 'Unknown'}</div>
                   <div className="opacity-50 uppercase">Размер:</div>
                   <div className="text-right font-bold text-purple-200">{species ? species.averageSizeMeters : '?'} м</div>
                </div>
             </div>
          </div>
        </div>

        {/* Right Side: Geopolitics & Action */}
        <div className="flex-1 p-4 md:p-8 flex flex-col gap-6 md:gap-8">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {/* Column 1: State Stats */}
              <div className="space-y-3 md:space-y-4">
                 <div className="text-[10px] md:text-xs text-purple-400/60 uppercase tracking-widest border-l-2 border-purple-500/40 pl-3">Гос. показатели</div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] md:text-xs">
                       <span className="opacity-60 uppercase">Отношения:</span>
                       <span className={`font-bold px-1.5 py-0.5 rounded ${relationValue < -50 ? 'bg-red-500/20 text-red-400' : relationValue > 50 ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {faction.relationToPlayer} ({relationValue})
                       </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] md:text-xs">
                       <span className="opacity-60 uppercase">Системы:</span>
                       <span className="text-white font-bold">{systemsCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] md:text-xs md:hidden">
                       <span className="opacity-60 uppercase">Разум:</span>
                       <span className="text-white font-bold truncate text-right">{species ? HIVEMIND_LABELS[species.organization] : 'Неизвестно'}</span>
                    </div>
                 </div>
              </div>

              {/* Column 2: Ideology */}
              <div className="space-y-3 md:space-y-4">
                 <div className="text-[10px] md:text-xs text-purple-400/60 uppercase tracking-widest border-l-2 border-purple-500/40 pl-3">Идеология</div>
                 <div className="space-y-1.5">
                    {faction.ideology && Object.entries(faction.ideology).slice(0, 4).map(([key, val]) => {
                       const label = getIdeoLabel(key, val as number);
                       if (!label) return null;
                       return (
                          <div key={key} className="space-y-0.5">
                             <div className="flex justify-between text-[8px] md:text-[9px] uppercase opacity-40">
                                <span className="truncate mr-2">{key.replace(/([A-Z])/g, ' $1')}</span>
                                <span className="text-purple-300 flex-shrink-0">{label}</span>
                             </div>
                             <div className="h-0.5 bg-black/40 w-full relative">
                                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/20 z-10"></div>
                                <div className="absolute top-0 bottom-0 bg-purple-500/40" style={{
                                   left: val as number < 0 ? `${50 + (val as number * 50)}%` : '50%',
                                   right: val as number < 0 ? '50%' : `${50 - (val as number * 50)}%`
                                }}></div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>

           {/* Description Area */}
           <div className="bg-purple-900/10 border border-purple-500/20 p-3 md:p-4 relative">
              <div className="text-[8px] uppercase text-purple-400/40 absolute -top-2 left-3 md:left-4 bg-[#0a0f1a] px-2 tracking-tighter">Брифинг</div>
              <p className="text-[10px] md:text-xs text-purple-200/80 leading-relaxed italic line-clamp-4 md:line-clamp-none">
                 {faction.description || `Это сообщество классифицируется как ${species ? HIVEMIND_LABELS[species.organization].toLowerCase() : 'неизвестная структура'}. 
                 Они предпочитают ${faction.ideology && faction.ideology.aliens > 0 ? 'открытые контакты' : 'изолированное развитие'} и 
                 их экономика ориентирована на ${faction.ideology && faction.ideology.economy > 0 ? 'жёсткую конкуренцию' : 'кооперативные модели'}.`}
              </p>
           </div>

           {/* Actions */}
           <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-auto">
              <button className="flex-1 relative group overflow-hidden">
                 <div className="absolute inset-0 bg-purple-600 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                 <div className="relative border border-purple-500 px-4 py-2 md:py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-purple-100 flex items-center justify-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Сделка
                 </div>
              </button>
              <button className="flex-1 relative group overflow-hidden">
                 <div className="absolute inset-0 bg-red-600 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                 <div className="relative border border-red-500/50 px-4 py-2 md:py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest text-red-400 flex items-center justify-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Война
                 </div>
              </button>
           </div>

        </div>
      </div>
      
      {/* Footer info line */}
      <div className="bg-purple-900/20 px-4 md:px-6 py-1.5 md:py-2 border-t border-purple-500/20 flex justify-between text-[8px] md:text-[10px] items-center">
         <div className="opacity-40 uppercase truncate mr-4">Сектор: <span className="text-purple-300">{capitalName}</span></div>
         <div className="flex gap-3 opacity-40 uppercase flex-shrink-0">
            <span className="hidden sm:inline">Шифр: AES-512</span>
            <span>Сеть: {relationValue > 0 ? 'OK' : relationValue < -50 ? 'ERR' : '??'}</span>
         </div>
      </div>
    </div>
  );
}


'use client';

import React from 'react';

// Add this function up top to map jobs
const getJobLabel = (job: string) => {
  const map: Record<string, string> = { worker: 'Рабочие', farmer: 'Фермеры', miner: 'Шахтеры', technician: 'Техники', ruler: 'Управленцы', researcher: 'Ученые', entertainer: 'Артисты' };
  return map[job] || job;
};

// Add this function up top to map districts
const getDistrictLabel = (type: string) => {
  const map: Record<string, string> = { residential: 'Жилые', energy: 'Энергетические', mining: 'Добывающие', industrial: 'Промышленные', food: 'Агро', government: 'Государственные' };
  return map[type] || type;
};

interface AnalysisWindowProps {
  target: any;
  onClose: () => void;
  onOpenDiplomacy?: (factionId: string) => void;
}

export const AnalysisWindow: React.FC<AnalysisWindowProps> = ({ target, onClose, onOpenDiplomacy }) => {
  if (!target) return null;

  return (
    <div className="absolute top-[20%] left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0a0f1a]/95 border border-teal-500/30 p-4 min-w-[300px] shadow-[0_0_20px_rgba(20,184,166,0.1)] z-50 font-mono">
      <div className="flex justify-between items-start mb-4 border-b border-teal-500/20 pb-2">
        <div>
          <div className="text-teal-400 font-bold tracking-wider text-sm uppercase">АНАЛИЗ: {target.type}</div>
          <div className="text-teal-500/60 text-[10px] uppercase">ID: {target.id || target.entity?.toString()}</div>
        </div>
        <button onClick={onClose} className="text-teal-500/50 hover:text-teal-400 font-bold">✕</button>
      </div>
      
      <div className="space-y-2 text-xs text-teal-100/70">
        {target.type === 'STAR' && (
          <>
            <div className="flex justify-between"><span>КЛАСС:</span> <span className="uppercase text-teal-300 font-bold">{target.starClass || 'НЕИЗВЕСТНО'}</span></div>
            <div className="flex justify-between"><span>МАССА:</span> <span>{typeof target.mass === 'number' ? target.mass.toFixed(1) : '?'} M☉</span></div>
            <div className="flex justify-between"><span>РАДИУС:</span> <span>{(target.radius / 1000).toLocaleString()} км</span></div>
          </>
        )}
        
        {target.type === 'PLANET' && (
          <>
            <div className="flex justify-between"><span>ТИП:</span> <span className="text-teal-300 font-bold uppercase">{target.climate || 'ROCKY'}</span></div>
            <div className="flex justify-between"><span>МАССА:</span> <span>{target.mass.toFixed(1)} M⊕</span></div>
            <div className="flex justify-between"><span>РАДИУС:</span> <span>{(target.radius / 1000).toLocaleString()} км</span></div>
            <div className="flex justify-between"><span>ОБИТАЕМОСТЬ:</span> <span className={target.isHabitable ? "text-green-400" : "text-red-400"}>{target.isHabitable ? 'ДА' : 'НЕТ'}</span></div>
            {target.colony && (
              <div className="mt-2 p-2 border border-teal-500/20 bg-teal-900/20 space-y-2">
                <div className="flex justify-between items-center border-b border-teal-500/30 pb-1">
                  <span className="text-teal-300 font-bold uppercase">КОЛОНИЯ ({target.colony.factionId})</span>
                  {onOpenDiplomacy && target.colony.factionId && target.colony.factionId !== 'PLAYER' && (
                    <button 
                      onClick={() => onOpenDiplomacy(target.colony.factionId)}
                      className="ml-2 bg-purple-900/50 hover:bg-purple-800 border border-purple-500/50 text-purple-200 text-[9px] px-2 py-0.5"
                    >
                      СВЯЗЬ
                    </button>
                  )}
                </div>
                <div className="flex justify-between"><span>НАСЕЛЕНИЕ:</span> <span className="font-bold">{target.colony.population.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>ЖИЛЬЁ:</span> <span>{(target.colony.housing || 0n).toLocaleString()}</span></div>
                
                {target.colony.lastProduction && (
                  <div className="border-t border-teal-500/10 pt-1 mt-1">
                    <div className="text-teal-400 text-[10px] mb-1 font-bold">ЭКОНОМИКА (ДОХОД / РАСХОД)</div>
                    <div className="space-y-0.5">
                      {Object.keys({...target.colony.lastProduction, ...target.colony.lastConsumption}).map(res => {
                        const prod = target.colony.lastProduction?.[res] || 0;
                        const cons = target.colony.lastConsumption?.[res] || 0;
                        const net = prod - cons;
                        return (
                          <div key={res} className="flex justify-between text-[9px] items-center">
                            <span className="opacity-60">{res.replace('GENERAL_PURPOSE_RESOURCES', 'РОН').replace('CIVILIAN_GOODS', 'ТНП')}</span>
                            <div className="flex gap-2">
                              {prod > 0 && <span className="text-green-500">+{Math.floor(prod)}</span>}
                              {cons > 0 && <span className="text-red-500">-{Math.floor(cons)}</span>}
                              <span className={`font-bold ${net >= 0 ? 'text-teal-400' : 'text-orange-500'}`}>({Math.floor(net)})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-teal-500/10 pt-1 mt-1">
                  <div className="text-teal-400 text-[10px] mb-1 font-bold">РАЙОНЫ ({target.colony.districts?.length || 0} / {target.colony.maxDistricts || 0})</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {target.colony.districts?.reduce((acc: any, d: any) => {
                       acc[d.type] = (acc[d.type] || 0) + 1;
                       return acc;
                    }, Object.create(null)) && Object.entries(
                       target.colony.districts.reduce((acc: any, d: any) => {
                         acc[d.type] = (acc[d.type] || 0) + 1;
                         return acc;
                       }, {})
                    ).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-[10px] opacity-80">
                        <span>{getDistrictLabel(type)}:</span> <span>{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-teal-500/10 pt-1 mt-1">
                  <div className="text-teal-400 text-[10px] mb-1 font-bold">РАБОТЫ</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {Object.entries(target.colony.jobs || {}).map(([job, count]) => (
                      <div key={job} className="flex justify-between text-[10px] opacity-80">
                        <span>{getJobLabel(job)}:</span> <span>{typeof count === 'bigint' ? count.toLocaleString() : count as any}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {target.type === 'SATELLITE' && (
          <>
            <div className="flex justify-between"><span>МАССА:</span> <span>{(target.mass || 0).toFixed(2)} M⊕</span></div>
            <div className="flex justify-between"><span>РАДИУС:</span> <span>{(target.radius / 1000).toLocaleString()} км</span></div>
            <div className="flex justify-between"><span>КЛАСС:</span> <span className="uppercase text-teal-300 font-bold">{target.satelliteType?.replace('_', ' ') || 'Спутник'}</span></div>
            <div className="flex justify-between"><span>ОБИТАЕМОСТЬ:</span> <span className={target.isHabitable ? "text-green-400" : "text-red-400"}>{target.isHabitable ? 'ДА' : 'НЕТ'}</span></div>
          </>
        )}
        
        {target.type === 'STATION' && (
          <>
            <div className="flex justify-between items-center mb-1">
              <span className="text-teal-300 font-bold uppercase">{target.name}</span>
              {onOpenDiplomacy && target.factionId && target.factionId !== 'PLAYER' && (
                <button 
                  onClick={() => onOpenDiplomacy(target.factionId)}
                  className="bg-purple-900/50 hover:bg-purple-800 border border-purple-500/50 text-purple-200 text-[9px] px-2 py-0.5"
                >
                  СВЯЗЬ
                </button>
              )}
            </div>
            <div className="flex justify-between mt-1"><span>ФРАКЦИЯ:</span> <span className="uppercase text-yellow-300 font-bold" style={{color: target.color}}>{target.factionId}</span></div>
            <div className="flex justify-between"><span>ТИП:</span> <span className="uppercase">{target.stationType?.replace('_', ' ')}</span></div>
          </>
        )}

        {target.type === 'SHIP' && (
          <>
            <div className="flex justify-between"><span>КЛАСС:</span> <span className="text-white font-bold">{target.hull?.style || 'НЕИЗВЕСТНО'}</span></div>
            <div className="flex justify-between"><span>РАЗМЕР:</span> <span>КЛАСС {target.hull?.size || '?'}</span></div>
            <div className="flex justify-between"><span>ПАЛУБЫ:</span> <span>{target.hull?.decks?.length || 0}</span></div>
          </>
        )}

        {target.type === 'ASTEROID' && (
          <>
            <div className="flex justify-between"><span>РАДИУС:</span> <span>{(target.radius).toLocaleString()} м</span></div>
            <div className="flex justify-between"><span>СОСТАВ:</span> <span className="text-yellow-400 font-bold text-[10px]">НЕИЗВЕСТНЫЕ ЗАЛЕЖИ</span></div>
            <div className="mt-2 p-2 bg-yellow-900/20 text-yellow-500/80 text-[9px] text-center border border-yellow-500/20 w-full whitespace-pre-wrap">
              Переключитесь в режим ДОБЫЧИ и используйте сканер для глубокого анализа ресурсов.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

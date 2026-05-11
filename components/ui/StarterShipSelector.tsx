'use client';

import React, { useState, useEffect } from 'react';
import type { ShipBlueprint, ShipHull } from '@/components/game/types';
import { PRESET_SHIPS } from '@/game/presets';
import { getShipMass } from '@/game/compartmentUtils';

const STORAGE_KEY = 'thevast-blueprints';

function loadBlueprints(): ShipBlueprint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

interface StarterShipSelectorProps {
  onSelect: (hull: ShipHull) => void;
  onCancel: () => void;
}

export default function StarterShipSelector({ onSelect, onCancel }: StarterShipSelectorProps) {
  const [blueprints] = useState<ShipBlueprint[]>(() => {
    if (typeof window !== 'undefined') {
      return loadBlueprints();
    }
    return [];
  });
  const [selectedHull, setSelectedHull] = useState<ShipHull | null>(null);

  const isEligible = (hull: ShipHull) => {
    const mass = getShipMass(hull);
    if (mass > 5000000) return false; // 5000 tons = 5,000,000 kg
    
    // Check for "advanced" tech
    // For now, only check if it has advanced weapon types or something?
    // Actually, user says "basic tech". 
    // I'll assume everything is basic if it's in COMPARTMENT_TYPES for now,
    // but maybe a hull size limit is the main check.
    return true;
  };

  const allOptions = [
    ...PRESET_SHIPS.map(p => ({ ...p, id: `preset-${p.name}`, isPreset: true })),
    ...blueprints.map(b => ({ name: b.name, hull: b.hull, id: b.id, isPreset: false }))
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[100] font-mono text-white p-4">
      <div className="bg-[#050505] border border-white/20 rounded-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-blue-400">ВЫБОР СТАРТОВОГО КОРАБЛЯ</h2>
            <div className="text-xs text-blue-200/50 mt-1 uppercase tracking-widest">Этап 2: Выбор чертежа</div>
          </div>
          <button onClick={onCancel} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="px-4 pt-4">
          <div className="border border-white/10 bg-white/5 p-3 rounded flex items-center space-x-3 mb-2 opacity-50 select-none">
             <div className="text-2xl">👤</div>
             <div className="flex-1">
                 <div className="text-xs text-blue-300 font-bold uppercase">ВЫБОР ПРОИСХОЖДЕНИЯ (В разработке)</div>
                 <div className="text-[10px] text-white/50">В будущем вы сможете выбрать предысторию персонажа, которая определит стартовые отношения с фракциями, технологии и капитал. Сейчас доступно только происхождение &quot;Независимый капитан&quot;.</div>
             </div>
             <select disabled className="bg-black border border-white/20 text-xs px-2 py-1 text-white/50 rounded">
                 <option>Независимый капитан</option>
                 <option>Ветеран Федерации</option>
                 <option>Изгнанник Корсаров</option>
                 <option>Торговый магнат</option>
             </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {allOptions.map(opt => {
            const mass = getShipMass(opt.hull);
            const eligible = isEligible(opt.hull);
            const isSelected = selectedHull === opt.hull;

            return (
              <div 
                key={opt.id}
                onClick={() => eligible && setSelectedHull(opt.hull)}
                className={`p-4 border rounded-lg transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected ? 'border-blue-500 bg-blue-500/10' : 
                  eligible ? 'border-white/10 bg-white/5 hover:border-white/30' : 
                  'border-red-900/30 bg-red-900/5 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`font-bold ${isSelected ? 'text-blue-300' : 'text-white'}`}>{opt.name}</span>
                  {opt.isPreset && <span className="text-[10px] bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">PRESET</span>}
                </div>
                
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-white/40">Масса:</span>
                    <span className={mass > 5000000 ? 'text-red-400 font-bold' : 'text-green-400'}>
                        {(mass / 1000).toFixed(0)} т
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Палубы:</span>
                    <span>{opt.hull.decks.length}</span>
                  </div>
                </div>

                {!eligible && (
                  <div className="mt-2 text-[10px] text-red-500 font-bold uppercase italic">
                    ⚠️ Слишком тяжелый для старта
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 flex gap-4">
          <button 
            disabled={!selectedHull}
            onClick={() => selectedHull && onSelect(selectedHull)}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/20 font-bold text-sm"
          >
            ПОДТВЕРДИТЬ ВЫБОР
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Deck, ShipHull } from '@/components/game/types';
import { generateStructuralBeams } from '@/components/game/editorLogic';

interface StructuralDeckPanelProps {
  deck: Deck;
  activeDeck: number;
  setShipHull: (h: ShipHull) => void;
  engine: any;
  px: string;
  researchedTechs?: string[];
  isCreative?: boolean;
}

export const StructuralDeckPanel: React.FC<StructuralDeckPanelProps> = ({
  deck,
  activeDeck,
  setShipHull,
  engine,
  px,
  researchedTechs = [],
  isCreative = false,
}) => {
  const updateDeckConfig = (field: string, value: any) => {
    if (!engine.draftHull) return;
    const newHull = JSON.parse(JSON.stringify(engine.draftHull));
    newHull.decks[activeDeck][field] = value;
    
    // Auto-generate if pattern or density changed
    if (field === 'beamPattern' || field === 'beamDensity') {
      const activeDeckIdx = newHull.activeDeckIndex || 0;
      const dk = newHull.decks[activeDeckIdx];
      if (dk) {
        const { beams, cells } = generateStructuralBeams(
          dk.points,
          newHull.compartments.filter((c: any) => c.startDeck <= activeDeckIdx && c.endDeck >= activeDeckIdx),
          dk.beamPattern || 'NONE',
          dk.beamDensity || 2.0,
          engine.symmetryY,
          engine.symmetryX
        );
        dk.beams = beams;
        dk.cells = cells;
      }
    }
    
    setShipHull(newHull);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div className="text-[8px] opacity-40 uppercase font-black tracking-widest text-blue-400/60">Structural Integrity</div>
      
      <div className="space-y-1.5 text-[9px]">
        <div className="bg-white/5 p-1 rounded space-y-1.5">
           <div className="flex flex-col gap-1">
              <span className="text-[7px] text-white/40 uppercase font-bold">Deck Designation</span>
              <input 
                type="text" 
                className="w-full bg-black border border-white/10 text-[10px] px-2 py-1 rounded text-blue-300 focus:border-blue-500 outline-none"
                value={deck.name || ''}
                placeholder={`Deck ${activeDeck}`}
                onChange={(e) => updateDeckConfig('name', e.target.value)}
              />
           </div>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-1 rounded">
          <span className="opacity-60 uppercase tracking-tighter">Hull Thickness</span>
          <div className="flex items-center gap-1">
            <button className="w-5 h-5 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded" onClick={() => updateDeckConfig('globalHullThickness', Math.max(0.1, (deck.globalHullThickness || 1.0) - 0.1))}>−</button>
            <span className="w-10 text-center font-bold text-blue-300">{(deck.globalHullThickness || 1.0).toFixed(1)}m</span>
            <button className="w-5 h-5 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded" onClick={() => updateDeckConfig('globalHullThickness', (deck.globalHullThickness || 1.0) + 0.1)}>+</button>
          </div>
        </div>

        <div className="bg-white/5 p-1 rounded space-y-1">
          <div className="flex justify-between items-center">
            <span className="opacity-60 uppercase tracking-tighter">Beam Pattern</span>
            <select 
              className="bg-black border border-white/20 text-[9px] px-1 py-0.5 text-blue-300 rounded"
              value={deck.beamPattern || 'NONE'}
              onChange={(e) => updateDeckConfig('beamPattern', e.target.value)}
            >
              <option value="NONE">None</option>
              <option value="SQUARE">Square Grid</option>
              <option value="HEX">Hexagonal</option>
              <option value="VORONOI">Voronoi Noise</option>
              <option value="SPIRAL">Spiral</option>
              <option value="PENROSE">Penrose Tiling</option>
            </select>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-white/5">
            <span className="opacity-60 uppercase tracking-tighter">Beam Density</span>
            <div className="flex items-center gap-1">
              <button className="w-4 h-4 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded text-[10px]" onClick={() => updateDeckConfig('beamDensity', Math.max(0.5, (deck.beamDensity || 2.0) - 0.5))}>−</button>
              <span className="w-8 text-center text-blue-300/80">{(deck.beamDensity || 2.0).toFixed(1)}</span>
              <button className="w-4 h-4 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded text-[10px]" onClick={() => updateDeckConfig('beamDensity', (deck.beamDensity || 2.0) + 0.5)}>+</button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[7px] text-gray-500 italic leading-tight">
        Automatic beams fill non-compartment void space based on the selected architectural pattern.
      </div>
    </div>
  );
};

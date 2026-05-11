'use client';

import React from 'react';
import { polygonArea } from '@/game/compartmentUtils';

interface CellPanelProps {
  cell: any;
  engine: any;
  setShipHull: (h: any) => void;
  onDelete: () => void;
}

export const CellPanel: React.FC<CellPanelProps> = ({ cell, engine, setShipHull, onDelete }) => {
  const isArmor = cell.cellType === 'ARMOR';
  const updateField = (f: string, v: any) => {
    if (!engine || !engine.draftHull) return;
    const newHull = JSON.parse(JSON.stringify(engine.draftHull));
    let found = false;
    newHull.decks.forEach((deck: any) => {
       if (deck.cells) {
          const c = deck.cells.find((c: any) => c.id === cell.id);
          if (c) {
             c[f] = v;
             found = true;
          }
       }
    });
    if (found) {
       engine.setDraftHull(newHull);
       setShipHull(newHull);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-[#0a0a10] border border-white/10 rounded pointer-events-auto">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-bold text-xs uppercase tracking-tight">{isArmor ? 'ARMOR PLATE' : 'STRUCTURAL CELL'}</h3>
        <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-[10px] uppercase font-bold">Delete</button>
      </div>
      
      <div className="space-y-3">
         {isArmor && (
            <div>
               <div className="text-white/40 uppercase text-[7px] mb-1">Thickness (m)</div>
               <input 
                  type="range" min="0.1" max="5" step="0.1" 
                  value={cell.thickness || 2.0} 
                  onChange={(e) => updateField('thickness', parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
               />
               <div className="flex justify-between text-[10px] mt-1">
                 <span className="text-blue-300 font-mono">{(cell.thickness || 2.0).toFixed(1)} m</span>
                 <span className="text-blue-300/50 font-mono">Max 5.0m</span>
               </div>
            </div>
         )}
         
         <div className="bg-white/5 p-2 rounded border border-white/5 text-[9px] space-y-1">
            <div className="flex justify-between">
               <span className="opacity-50">Density:</span>
               <span className="text-orange-300">{isArmor ? 'High (6.0 t/m³)' : 'Structural (2.0 t/m³)'}</span>
            </div>
            <div className="flex justify-between">
               <span className="opacity-50">Surface Area:</span>
               <span>{polygonArea(cell.points).toFixed(1)} m²</span>
            </div>
            <div className="flex justify-between">
               <span className="opacity-50">Est. Weight:</span>
               <span className="text-white">{(polygonArea(cell.points) * (isArmor ? (cell.thickness || 2.0) * 6.0 : 2.0)).toFixed(1)} t</span>
            </div>
         </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { EditorMode } from '@/components/game/types';

interface TurretEditorLeftPanelProps {
  engine: any;
  turretEditPart: 'MOUNT' | 'HEAD' | 'BARREL';
  setTurretEditPart: (v: 'MOUNT' | 'HEAD' | 'BARREL') => void;
  turretActiveLayerId: string | null;
  setTurretActiveLayerId: (id: string | null) => void;
  turretTargetBarrelIdx: number;
  setTurretTargetBarrelIdx: (idx: number) => void;
  getTurretLayers: () => any[];
  setTurretLayers: (layers: any[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  tc: any;
}

export const TurretEditorLeftPanel: React.FC<TurretEditorLeftPanelProps> = ({
  engine,
  turretEditPart,
  setTurretEditPart,
  turretActiveLayerId,
  setTurretActiveLayerId,
  turretTargetBarrelIdx,
  setTurretTargetBarrelIdx,
  getTurretLayers,
  setTurretLayers,
  setEditorMode,
  tc,
}) => {
  return (
    <>
      <div className="text-[12px] text-blue-400 font-bold mb-2 uppercase">Turret Editor</div>
      
      <div className="text-[8px] opacity-40 uppercase mb-1">Part Selection</div>
      <div className="flex bg-white/5 p-1 rounded gap-1 mb-2">
         {(['MOUNT', 'HEAD', 'BARREL'] as const).map(part => (
            <button
              key={part}
              className={`flex-1 text-[9px] py-1 border transition-colors ${turretEditPart === part ? 'bg-blue-500/30 border-blue-400 text-blue-300' : 'border-transparent text-white/60 hover:text-white'}`}
              onClick={() => { 
                 setTurretEditPart(part); 
                 setTurretActiveLayerId(null); 
                 if(engine) { engine.turretEditPart = part; engine.turretActiveLayerId = null; }
              }}
            >{part}</button>
         ))}
      </div>

      {turretEditPart === 'BARREL' && tc && tc.barrelCount > 1 && (
         <div className="mb-2">
            <div className="text-[8px] opacity-40 uppercase mb-1">Target Barrel</div>
            <select 
               className="w-full bg-[#050505] border border-white/20 text-[10px] p-1 text-white"
               value={turretTargetBarrelIdx}
               onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setTurretTargetBarrelIdx(v);
                  if(engine) engine.setTurretTargetBarrelIdx(v);
               }}
            >
               {Array.from({ length: tc.barrelCount }).map((_, i) => (
                  <option key={i} value={i}>Barrel {i + 1}</option>
               ))}
            </select>
         </div>
      )}

      <div className="text-[8px] opacity-40 uppercase mb-1">{turretEditPart} Layers</div>
      <div className="space-y-1 mb-2">
         {getTurretLayers().slice().reverse().map((lay: any, revIdx: number, arr: any[]) => {
            const idx = arr.length - 1 - revIdx;
            const isActive = turretActiveLayerId === lay.id;
            return (
               <div key={lay.id} className={`flex border p-2 items-center justify-between text-[10px] cursor-pointer ${isActive ? 'bg-orange-500/20 border-orange-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`} onClick={() => { setTurretActiveLayerId(lay.id); if(engine) engine.turretActiveLayerId = lay.id; }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm border border-white/20" style={{ background: lay.color }} />
                    <span>Layer {idx+1} {idx === arr.length - 1 ? '(TOP)' : idx === 0 ? '(BTM)' : ''}</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="px-1 hover:text-white text-white/50" onClick={e => {
                       e.stopPropagation();
                       const ls = [...getTurretLayers()];
                       if(idx < ls.length - 1) {
                         [ls[idx+1], ls[idx]] = [ls[idx], ls[idx+1]];
                         ls[idx+1].zIndex = idx+1; ls[idx].zIndex = idx;
                         setTurretLayers(ls);
                       }
                    }}>↑</button>
                    <button className="px-1 hover:text-white text-white/50" onClick={e => {
                       e.stopPropagation();
                       const ls = [...getTurretLayers()];
                       if(idx > 0) {
                         [ls[idx-1], ls[idx]] = [ls[idx], ls[idx-1]];
                         ls[idx-1].zIndex = idx-1; ls[idx].zIndex = idx;
                         setTurretLayers(ls);
                       }
                    }}>↓</button>
                  </div>
               </div>
            );
         })}
      </div>
      <button className="w-full py-1 text-[10px] bg-white/10 hover:bg-white/20 border border-white/20" onClick={() => {
          const ls = [...getTurretLayers()];
          const newId = Date.now().toString();
          ls.push({ id: newId, zIndex: ls.length, color: '#888888', points: [{x:-2,y:2},{x:2,y:2},{x:2,y:-2},{x:-2,y:-2}] });
          setTurretLayers(ls);
          setTurretActiveLayerId(newId);
          if(engine) engine.setTurretActiveLayerId(newId);
      }}>+ ADD LAYER</button>
      
      <button className="w-full mt-auto py-2 text-[10px] bg-red-500/20 hover:bg-red-500/40 border border-red-500 text-red-200" onClick={() => {
         engine.setIsTurretEditor(false);
         engine.setEditorMode('SELECT');
         setEditorMode('SELECT');
      }}>EXIT TURRET EDITOR</button>
    </>
  );
};

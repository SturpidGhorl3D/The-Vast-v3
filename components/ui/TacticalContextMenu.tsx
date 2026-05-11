
'use client';

import React from 'react';
import { GlobalCoords } from '@/components/game/types';
import { SECTOR_SIZE_M } from '@/game/constants';

interface TacticalContextMenuProps {
  x: number;
  y: number;
  target: any;
  onClose: () => void;
  onSetCourse: (pos: GlobalCoords) => void;
  engine: any;
}

export const TacticalContextMenu: React.FC<TacticalContextMenuProps> = ({ 
  x, y, target, onClose, onSetCourse, engine 
}) => {
  const getTargetPos = (): GlobalCoords => {
    const dynamicPos = engine?.getDynamicTargetPos ? engine.getDynamicTargetPos(target) : null;
    if (dynamicPos) return dynamicPos;
    return { 
      sectorX: target.sectorX !== undefined ? BigInt(target.sectorX) : (target.parentSystem?.sectorX !== undefined ? BigInt(target.parentSystem.sectorX) : 0n), 
      sectorY: target.sectorY !== undefined ? BigInt(target.sectorY) : (target.parentSystem?.sectorY !== undefined ? BigInt(target.parentSystem.sectorY) : 0n), 
      offsetX: target.offsetX !== undefined ? target.offsetX : (target.globalX || 0), 
      offsetY: target.offsetY !== undefined ? target.offsetY : (target.globalY || 0)
    };
  };

  return (
    <div 
      className="absolute pointer-events-auto bg-[#0a0f1a]/95 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] font-mono z-50 flex flex-col min-w-[200px]"
      style={{ left: x, top: y }}
    >
      <div className="bg-blue-900/30 text-blue-300 text-[10px] uppercase px-3 py-1 font-bold border-b border-blue-500/30 flex justify-between">
        <span>ЦЕЛЬ: {target.name || target.type}</span>
        <button onClick={onClose} className="hover:text-white px-1">✕</button>
      </div>
      <button 
        className="text-left px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20 hover:text-white transition-colors border-b border-white/5"
        onClick={() => {
            const targetPos = getTargetPos();
            
            // Set dynamic follow
            engine.followTarget = target;
            engine.orbitTarget = null;
            engine.movementMode = 'TACTICAL';
            engine.tacticalRoute = [targetPos];
            
            onSetCourse(targetPos);
            onClose();
        }}
      >
        ▸ ПРОЛОЖИТЬ КУРС (СЛЕДОВАТЬ)
      </button>
      <button 
        className="text-left px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20 hover:text-white transition-colors"
        onClick={() => {
            const targetPos = getTargetPos();

            // Setup Orbit
            const secSizeBI = BigInt(SECTOR_SIZE_M);
            const p = engine.ecs.getPosition(engine.player);
            if (p) {
              const pWX = BigInt(p.sectorX) * secSizeBI + BigInt(Math.floor(p.offsetX));
              const pWY = BigInt(p.sectorY) * secSizeBI + BigInt(Math.floor(p.offsetY));
              const cWX = BigInt(targetPos.sectorX) * secSizeBI + BigInt(Math.floor(targetPos.offsetX));
              const cWY = BigInt(targetPos.sectorY) * secSizeBI + BigInt(Math.floor(targetPos.offsetY));
              
              const dx = Number(pWX - cWX);
              const dy = Number(pWY - cWY);
              const dist = Math.hypot(dx, dy);
              
              engine.orbitRadius = dist;
              engine.orbitSpeed = 2000 / Math.max(1e6, dist); // Orbit speed inversely proportional to distance
              engine.orbitDirection = 1; // Clockwise
              engine.orbitTarget = target;
              engine.followTarget = null;
              engine.movementMode = 'TACTICAL';
              engine.tacticalRoute = [targetPos]; // Route to target area first

              onSetCourse(targetPos);
            }
            onClose();
        }}
      >
        ⟳ УДЕРЖИВАТЬ ОРБИТУ
      </button>
    </div>
  );
};

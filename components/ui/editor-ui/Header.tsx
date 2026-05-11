'use client';

import React from 'react';
import { EditorMode } from '@/components/game/types';

interface HeaderProps {
  isMobile: boolean;
  isCreative: boolean;
  hasIntersections: boolean;
  canAfford: boolean;
  applyChanges: () => void;
  cancelEditor: () => void;
  setIsEditorMenuOpen: (v: boolean) => void;
  isEditorMenuOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isMobile,
  isCreative,
  hasIntersections,
  canAfford,
  applyChanges,
  cancelEditor,
  setIsEditorMenuOpen,
  isEditorMenuOpen,
}) => {
  const px = isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';

  return (
    <div className={`w-full flex justify-between items-center border-b border-white/20 ${isMobile ? 'px-2 py-1.5' : 'px-4 py-2'} bg-[#050505] pointer-events-auto shrink-0`}>
      <div>
        <div className={`text-blue-400 font-bold tracking-tighter ${isMobile ? 'text-base' : 'text-xl'}`}>SHIP ARCHITECT</div>
        {hasIntersections && (
          <div className="text-[9px] text-red-400 uppercase">self-intersects — fix before applying</div>
        )}
      </div>
      <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
        {!isCreative && (
          <>
            <button
              disabled={!canAfford}
              className={`${px} transition-all ${
                canAfford 
                  ? 'bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 text-green-400' 
                  : 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed opacity-50'
              }`}
              onClick={applyChanges}
            >APPLY</button>
            <button className={`${px} bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400`} onClick={cancelEditor}>CANCEL</button>
          </>
        )}
        <button className={`${px} bg-white/5 hover:bg-white/10 border border-white/20`} onClick={() => setIsEditorMenuOpen(!isEditorMenuOpen)}>MENU</button>
      </div>
    </div>
  );
};

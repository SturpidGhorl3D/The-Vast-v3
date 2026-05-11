'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import BlueprintManager from '../BlueprintManager';
import { ShipHull } from '@/components/game/types';

interface EditorMenuOverlayProps {
  isEditorMenuOpen: boolean;
  setIsEditorMenuOpen: (v: boolean) => void;
  isMobile: boolean;
  isCreative: boolean;
  costInfo: { cost: { IRON: number; TITANIUM: number }; refund: { IRON: number; TITANIUM: number } } | null;
  applyChanges: () => void;
  cancelEditor: () => void;
  showBlueprints: boolean;
  setShowBlueprints: (v: boolean) => void;
  shipHull: ShipHull;
  setShipHull: (hull: ShipHull) => void;
  setActiveDeck: (i: number) => void;
  engine: any;
}

export const EditorMenuOverlay: React.FC<EditorMenuOverlayProps> = ({
  isEditorMenuOpen,
  setIsEditorMenuOpen,
  isMobile,
  isCreative,
  costInfo,
  applyChanges,
  cancelEditor,
  showBlueprints,
  setShowBlueprints,
  shipHull,
  setShipHull,
  setActiveDeck,
  engine,
}) => {
  const px = isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';

  return (
    <>
      {isEditorMenuOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[70] pointer-events-auto">
          <div className={`bg-[#050505] ${isMobile ? 'p-3' : 'p-6'} border border-white/20 rounded-lg ${isMobile ? 'w-48' : 'w-60'} space-y-3`}>
            <div className="text-blue-400 font-bold text-sm uppercase">Editor Menu</div>
            {costInfo && !isCreative && (costInfo.cost.IRON > 0 || costInfo.cost.TITANIUM > 0) && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 text-[9px] text-yellow-300">
                Build cost: {costInfo.cost.IRON} Fe · {costInfo.cost.TITANIUM} Ti
              </div>
            )}
            {!isCreative && <button className={`w-full ${px} bg-green-500/20 hover:bg-green-500/40 border border-green-500/50`} onClick={applyChanges}>Apply Changes</button>}
            <button className={`w-full ${px} bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50`} onClick={() => setShowBlueprints(true)}>Load/Save Schematics</button>
            <button className={`w-full ${px} bg-white/5 hover:bg-white/10 border border-white/20`} onClick={cancelEditor}>{isCreative ? 'Exit Creative Editor' : 'Exit Without Saving'}</button>
            <button className={`w-full ${px} bg-red-500/20 hover:bg-red-500/40 border border-red-500/50`} onClick={() => setIsEditorMenuOpen(false)}>Close Menu</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showBlueprints && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] pointer-events-none"
          >
            <BlueprintManager 
              isMobile={isMobile}
              currentHull={shipHull}
              onLoad={(h) => {
                setShipHull(h);
                if(engine) engine.setDraftHull(h);
                setActiveDeck(h.activeDeckIndex || 0);
                setShowBlueprints(false);
                setIsEditorMenuOpen(false);
              }}
              onClose={() => setShowBlueprints(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

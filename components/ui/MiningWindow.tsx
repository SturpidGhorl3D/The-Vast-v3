'use client';

import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Pickaxe, Info, X, Zap, Box, Database } from 'lucide-react';

interface MiningWindowProps {
  asteroid: any | null;
  isOpen: boolean;
  onClose: () => void;
  onStartMining: (id: string) => void;
  isMining: boolean;
  resources: Record<string, number>;
  maxCapacity: number;
}

export default function MiningWindow({
  asteroid,
  isOpen,
  onClose,
  onStartMining,
  isMining,
  resources,
  maxCapacity
}: MiningWindowProps) {
  const usedCapacity = Object.values(resources).reduce((a, b) => a + b, 0);
  const isFull = usedCapacity >= maxCapacity;
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {isOpen && asteroid && (
        <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-80 bg-black/90 border border-cyan-500/30 rounded-lg overflow-hidden font-mono z-[100] shadow-2xl shadow-cyan-900/20"
      >
        {/* Header - Drag Handle */}
        <div 
          className="bg-cyan-500/20 px-3 py-2 border-b border-cyan-500/40 flex justify-between items-center cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
             dragControls.start(e);
          }}
        >
          <div className="flex items-center gap-2">
            <Pickaxe className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-100 uppercase tracking-widest">Asteroid Analysis</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden">
               {/* Visual representation of asteroid */}
               <div 
                 className="w-10 h-10 rounded-full bg-zinc-600 shadow-inner"
                 style={{ backgroundColor: asteroid.color }}
               />
               {asteroid.isPlanetoid && (
                 <div className="absolute top-0 right-0 bg-yellow-500/20 text-yellow-400 text-[6px] px-1 font-bold">PLANETOID</div>
               )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-white font-bold text-xs">Object ID: {asteroid.id.split('-').pop()}</div>
              <div className="text-[10px] text-white/50 flex items-center gap-1">
                <Box className="w-3 h-3" /> Radius: {Math.round(asteroid.radius)}m
              </div>
              <div className="text-[10px] text-white/50 flex items-center gap-1">
                <Database className="w-3 h-3" /> Mass: {(asteroid.totalCapacity / 1000).toFixed(1)}k tons
              </div>
            </div>
          </div>

          {/* Resources List */}
          <div className="space-y-2">
            <div className="text-[8px] uppercase tracking-widest text-cyan-400/60 font-bold flex items-center gap-1">
              <Info className="w-3 h-3" /> Composition
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(asteroid.resources).map(([res, amount]: [string, any]) => (
                <div key={res} className="bg-white/5 p-2 border border-white/10 rounded flex flex-col gap-0.5">
                  <span className="text-[8px] text-white/40 uppercase">{res}</span>
                  <span className="text-[10px] text-white font-bold">{(amount).toLocaleString()} t</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-white/10">
            {isFull ? (
              <div className="bg-red-500/20 border border-red-500/30 p-2 text-center text-red-400 text-[10px] uppercase font-bold animate-pulse">
                Cargo Hold Full
              </div>
            ) : isMining ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                   <motion.div 
                     className="h-full bg-cyan-400"
                     animate={{ x: [-100, 300] }}
                     transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                     style={{ width: '40%' }}
                   />
                </div>
                <span className="text-[9px] text-cyan-400 animate-pulse font-bold tracking-widest">MINING OPERATIONS IN PROGRESS</span>
                <button 
                  onClick={() => onStartMining('')}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-200 text-[10px] uppercase tracking-widest transition-all"
                >
                  Terminate Operations
                </button>
              </div>
            ) : (
              <button
                onClick={() => onStartMining(asteroid.id)}
                className="w-full py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-200 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Pickaxe className="w-4 h-4" /> Start Extraction
              </button>
            )}
          </div>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

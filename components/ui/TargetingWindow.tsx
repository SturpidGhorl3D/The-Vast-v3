'use client';

import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Target, X, Shield, Crosshair, Trash2 } from 'lucide-react';
import { Entity } from '@/game/engine/ecs';

interface TargetInfo {
  id: Entity;
  name: string;
  factionColor: string;
  distance: number;
  isSelected?: boolean;
}

interface TargetingWindowProps {
  isOpen: boolean;
  onClose: () => void;
  targets: TargetInfo[];
  onRemoveTarget: (id: Entity) => void;
  onSelectTarget: (id: Entity) => void;
  designationMode: boolean;
  onToggleDesignationMode: () => void;
}

export default function TargetingWindow({
  isOpen,
  onClose,
  targets,
  onRemoveTarget,
  onSelectTarget,
  designationMode,
  onToggleDesignationMode
}: TargetingWindowProps) {
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-20 right-4 w-64 bg-black/90 border border-red-500/30 rounded-lg overflow-hidden font-mono z-[100] shadow-2xl shadow-red-900/20"
        >
          {/* Header - Drag Handle */}
          <div 
            className="bg-red-500/20 px-3 py-2 border-b border-red-500/40 flex justify-between items-center cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
               dragControls.start(e);
            }}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-red-100" />
              <span className="text-[10px] font-bold text-red-100 uppercase tracking-widest">ЦЕЛЕУКАЗАНИЕ</span>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Controls */}
          <div className="p-2 border-b border-white/10 bg-white/5">
            <button
              onClick={onToggleDesignationMode}
              className={`w-full py-1.5 px-2 text-[9px] uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                designationMode 
                  ? 'bg-red-600/30 border-red-500/50 text-red-200' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              <Crosshair className={`w-3 h-3 ${designationMode ? 'animate-pulse' : ''}`} />
              {designationMode ? 'РЕЖИМ ЗАХВАТА: ВКЛ' : 'ВКЛЮЧИТЬ ЗАХВАТ'}
            </button>
            <div className="text-[7px] text-white/30 text-center mt-1 uppercase tracking-tight">
              {designationMode ? 'Удерживайте мышь над целью для занесения в список' : 'Нажмите для активации режима выбора'}
            </div>
          </div>

          {/* Targets List */}
          <div className="max-h-60 overflow-y-auto">
            {targets.length === 0 ? (
              <div className="py-8 text-center text-white/20 text-[10px] uppercase tracking-widest italic">
                Список целей пуст
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {targets.map((t) => (
                  <div 
                    key={String(t.id)} 
                    className={`group flex items-center gap-2 p-2 hover:bg-white/5 transition-colors cursor-pointer ${t.isSelected ? 'bg-red-500/10' : ''}`}
                    onClick={() => onSelectTarget(t.id)}
                  >
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: t.factionColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight">{t.name}</span>
                        <span className="text-[8px] text-white/40">{(t.distance / 1000).toFixed(1)} км</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-2.5 h-2.5 text-blue-400" />
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500 w-full" />
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveTarget(t.id); }}
                      className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-white/10 bg-black/40">
             <div className="text-[8px] text-white/30 text-center uppercase tracking-widest leading-relaxed">
               Вторичные орудия ведут огонь<br/>по списку автоматически
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import React from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';

interface CostPanelProps {
  isCreative: boolean;
  costInfo: { cost: { IRON: number; TITANIUM: number }; refund: { IRON: number; TITANIUM: number } } | null;
  resources: { IRON: number; TITANIUM: number; [key: string]: any };
  totalShipValue: { cost: { IRON: number; TITANIUM: number } };
  canAfford: boolean;
}

export const CostPanel: React.FC<CostPanelProps> = ({
  isCreative,
  costInfo,
  resources,
  totalShipValue,
  canAfford,
}) => {
  const dragControls = useDragControls();
  const netIronCost = costInfo ? (costInfo.cost.IRON - costInfo.refund.IRON) : 0;
  const netTiCost = costInfo ? (costInfo.cost.TITANIUM - costInfo.refund.TITANIUM) : 0;

  return (
    <>
      {/* ── Cost Panel (Sliding) ── */}
      <AnimatePresence>
        {!isCreative && costInfo && (
          <motion.div
            key="cost-panel"
            initial={{ height: 0, opacity: 0, y: -40 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -40 }}
            className="w-full bg-black/95 border-b border-yellow-500/60 px-4 py-2 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-8 pointer-events-auto overflow-hidden z-[100] shadow-[0_8px_30px_rgba(234,179,8,0.3)]"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${canAfford ? 'bg-yellow-400 shadow-[0_0_12px_rgba(234,179,8,1)]' : 'bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,1)]'}`} />
              <span className="text-[9px] md:text-[11px] text-yellow-500 font-black uppercase tracking-[0.25em]">Construction Manifest</span>
            </div>
            <div className="flex items-center gap-4 md:gap-8">
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <span className="text-[8px] md:text-[10px] text-white/50 uppercase font-bold">Fe:</span>
                <span className={`text-[11px] md:text-[14px] font-black ${resources.IRON < netIronCost ? 'text-red-500 underline decoration-red-500/50 underline-offset-4' : (netIronCost < 0 ? 'text-green-400' : 'text-yellow-400')}`}>
                  {netIronCost > 0 ? `+${Math.ceil(netIronCost)}` : (netIronCost < 0 ? `${Math.floor(netIronCost)}` : '0')}
                  <span className="text-[8px] md:text-[10px] opacity-40 font-normal ml-1">/ {Math.floor(resources.IRON)}</span>
                </span>
                {costInfo.refund.IRON > costInfo.cost.IRON && (
                   <span className="text-[8px] md:text-[10px] text-green-400 ml-1 uppercase font-bold">Refund</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <span className="text-[8px] md:text-[10px] text-white/50 uppercase font-bold">Ti:</span>
                <span className={`text-[11px] md:text-[14px] font-black ${resources.TITANIUM < netTiCost ? 'text-red-400 underline decoration-red-500/50 underline-offset-4' : (netTiCost < 0 ? 'text-green-400' : 'text-yellow-400')}`}>
                  {netTiCost > 0 ? `+${Math.ceil(netTiCost)}` : (netTiCost < 0 ? `${Math.floor(netTiCost)}` : '0')}
                  <span className="text-[8px] md:text-[10px] opacity-40 font-normal ml-1">/ {Math.floor(resources.TITANIUM)}</span>
                </span>
                {costInfo.refund.TITANIUM > costInfo.cost.TITANIUM && (
                   <span className="text-[8px] md:text-[10px] text-green-400 ml-1 uppercase font-bold">Refund</span>
                )}
              </div>
            </div>
            {!canAfford && (
              <div className="text-[8px] md:text-[10px] text-red-500 font-black uppercase tracking-widest animate-pulse bg-red-500/20 px-2 py-0.5 md:px-3 md:py-1 border border-red-500/50 rounded-sm">
                [ Deficit ]
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Total Cost Panel (Creative Only) ── */}
      <AnimatePresence>
        {isCreative && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="absolute top-16 right-4 p-3 bg-[#050505]/95 border border-cyan-500/50 rounded shadow-[0_0_20px_rgba(6,182,212,0.2)] pointer-events-auto z-[100] flex flex-col min-w-[160px]"
          >
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-2 border-b border-cyan-500/20 pb-1 flex items-center gap-2 select-none cursor-grab active:cursor-grabbing"
            >
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,1)]" />
              SHIP ESTIMATE
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center gap-6">
                <span className="text-[10px] text-white/50 uppercase">Iron (Fe):</span>
                <span className="text-xs font-bold text-white tabular-nums">{Math.floor(totalShipValue.cost.IRON)}</span>
              </div>
              <div className="flex justify-between items-center gap-6">
                <span className="text-[10px] text-white/50 uppercase">Titanium (Ti):</span>
                <span className="text-xs font-bold text-white tabular-nums">{Math.floor(totalShipValue.cost.TITANIUM)}</span>
              </div>
              <div className="pt-1.5 mt-1.5 border-t border-white/5 flex justify-between items-center gap-6">
                <span className="text-[9px] text-blue-400/70 uppercase font-black">Total Build Rating</span>
                <span className="text-[10px] font-black text-blue-400">{(totalShipValue.cost.IRON + totalShipValue.cost.TITANIUM).toLocaleString()} pts</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

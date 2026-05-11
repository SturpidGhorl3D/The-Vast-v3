'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { COMPONENT_RECIPES } from '@/game/materials';
import { useEffect } from 'react';

interface ProductionWindowProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Record<string, number>;
  onProduce: (recipeId: string, count?: number, kernelId?: string) => void;
  hasMachinery: boolean;
  kernels: any[];
  researchedTechs?: string[];
  shipType?: string;
  hudOpen?: boolean;
  isMobile?: boolean;
}

export default function ProductionWindow({
  isOpen,
  onClose,
  resources,
  onProduce,
  hasMachinery,
  kernels = [],
  researchedTechs = [],
  shipType = 'STANDARD',
  hudOpen = false,
  isMobile = false
}: ProductionWindowProps) {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'BASIC' | 'BIO' | 'ORGANIC' | 'CRYSTAL' | 'MINING' | 'WEAPON' | 'REACTOR'>('ALL');
  const [activeTier, setActiveTier] = useState<number>(1);
  const [size, setSize] = useState({ width: 750, height: 550 });
  const [selectedKernelId, setSelectedKernelId] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState<number>(1);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const filteredRecipes = COMPONENT_RECIPES.filter(r => 
    (activeCategory === 'ALL' || r.category === activeCategory) &&
    r.tier === activeTier &&
    (!r.shipType || r.shipType.includes(shipType))
  );

  const canAfford = (recipe: any, count: number) => {
    return recipe.inputs.every((input: any) => 
      (resources[input.materialId] || 0) >= input.amount * count
    );
  };

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 400 });
  const [midPos1, setMidPos1] = useState({ x: 0, y: 0 });
  const [midPos2, setMidPos2] = useState({ x: 0, y: 0 });
  const [midPos3, setMidPos3] = useState({ x: 0, y: 0 });

  // Update position for the connection line
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      // HUD width is 240px (desktop) or 208px (mobile)
      const hudWidth = hudOpen ? (isMobile ? 208 : 240) : 0;
      setStartPos({ x: hudWidth, y: window.innerHeight / 2 });
      
      if (windowRef.current) {
        const rect = windowRef.current.getBoundingClientRect();
        const newTarget = { x: rect.left, y: rect.top + rect.height / 2 };
        setPos(newTarget);
        
        const time = Date.now() / 1000;
        const dx = newTarget.x - hudWidth;
        const dy = newTarget.y - (window.innerHeight / 2);
        
        setMidPos1({
          x: hudWidth + dx * 0.25 + Math.sin(time * 0.7) * 20,
          y: window.innerHeight / 2 + dy * 0.15 + Math.cos(time * 0.5) * 25
        });
        
        setMidPos2({
          x: hudWidth + dx * 0.5 + Math.cos(time * 1.2) * 15,
          y: window.innerHeight / 2 + dy * 0.5 + Math.sin(time * 0.8) * 35
        });

        setMidPos3({
          x: hudWidth + dx * 0.75 + Math.sin(time * 0.9) * 12,
          y: window.innerHeight / 2 + dy * 0.85 + Math.cos(time * 1.1) * 18
        });
      }
    };
    const interval = setInterval(update, 30);
    return () => clearInterval(interval);
  }, [isOpen, hudOpen, isMobile]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <svg className="fixed inset-0 pointer-events-none z-[90] overflow-visible">
            <motion.path
              d={`M ${startPos.x} ${startPos.y} L ${midPos1.x} ${midPos1.y} L ${midPos2.x} ${midPos2.y} L ${midPos3.x} ${midPos3.y} L ${pos.x} ${pos.y}`}
              fill="none"
              stroke="rgba(0, 163, 255, 0.4)"
              strokeWidth="1"
              strokeDasharray="3 5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
            />
            {[startPos, midPos1, midPos2, midPos3, pos].map((pt, i) => (
              <g key={i} transform={`translate(${pt.x}, ${pt.y})`}>
                <motion.line x1="-6" y1="0" x2="6" y2="0" stroke="rgba(0,220,255,0.9)" strokeWidth="1" 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.7, 1.5, 0.7] }} transition={{ repeat: Infinity, duration: 2 + i * 0.4 }} />
                <motion.line x1="0" y1="-6" x2="0" y2="6" stroke="rgba(0,220,255,0.9)" strokeWidth="1" 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.7, 1.5, 0.7] }} transition={{ repeat: Infinity, duration: 2 + i * 0.4 }} />
                <circle cx="0" cy="0" r="1.2" fill="white" />
              </g>
            ))}
          </svg>

        <motion.div
            ref={windowRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="fixed z-[100] bg-[#0c0f14]/95 border border-blue-500/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] font-mono text-white select-none pointer-events-auto overflow-hidden flex flex-col"
            style={{ 
              backdropFilter: 'blur(20px)',
              width: size.width,
              height: size.height,
              left: '50.3%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '2px'
            }}
          >
            {/* Header / Drag Handle */}
            <div 
              className="flex items-center justify-between px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 cursor-move"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                   {[0,1,2].map(i => <div key={i} className="w-1 h-3 bg-blue-400/50" />)}
                </div>
                <span className="text-xs font-bold tracking-[0.3em] uppercase text-blue-200">Production Matrix Control</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] text-blue-400/50 uppercase">Sync Status:</span>
                    <span className={`text-[8px] uppercase ${hasMachinery ? 'text-green-400' : 'text-red-400'}`}>
                       {hasMachinery ? 'Machinery Linked' : 'No Machinery Control'}
                    </span>
                 </div>
                 <button onClick={onClose} className="hover:text-blue-400 transition-colors">✕</button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
               {/* Left Panel: Kernels & Queues */}
               <div className="w-64 border-r border-blue-500/10 bg-black/20 flex flex-col">
                  <div className="p-3 border-b border-blue-500/10 bg-blue-500/5">
                     <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">Active Kernels</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                     {!hasMachinery && (
                       <div className="p-4 text-center border border-dashed border-red-500/20 rounded bg-red-900/5">
                          <span className="text-[8px] text-red-400 uppercase leading-relaxed font-bold">
                             Control Interrupted: Build MACHINERY compartment to manage fabrication.
                          </span>
                       </div>
                     )}
                     
                     {hasMachinery && (kernels || []).map((kernel, idx) => (
                        <div 
                           key={kernel.compartmentId}
                           onClick={() => setSelectedKernelId(kernel.compartmentId === selectedKernelId ? null : kernel.compartmentId)}
                           className={`p-2 border transition-all cursor-pointer ${
                             selectedKernelId === kernel.compartmentId 
                              ? 'bg-blue-500/20 border-blue-500/50' 
                              : 'bg-white/5 border-white/5 hover:border-white/10'
                           }`}
                        >
                           <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-bold text-white/80">KERNEL #{idx + 1}</span>
                              <span className="text-[7px] text-blue-400/60 uppercase">{Math.floor(kernel.volume)} m³</span>
                           </div>
                           
                           {/* Progress Bar */}
                           <div className="h-1 bg-black/40 rounded-full overflow-hidden mb-2">
                              <motion.div 
                                 className="h-full bg-blue-400"
                                 initial={false}
                                 animate={{ width: `${(kernel.currentProgress / (COMPONENT_RECIPES.find(r => r.id === kernel.queue[0]?.recipeId)?.productionTime || 1000)) * 100}%` }}
                              />
                           </div>

                           {/* Queue Icons */}
                           <div className="flex gap-1 overflow-hidden">
                              {kernel.queue.map((item: any, i: number) => (
                                 <div key={i} className="relative group">
                                    <div className="w-6 h-6 border border-blue-500/30 flex items-center justify-center bg-blue-900/40">
                                       <span className="text-[7px] font-bold text-blue-200">{item.recipeId.charAt(0)}</span>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-[6px] px-0.5 rounded-sm font-bold">
                                       {item.count}
                                    </div>
                                 </div>
                              ))}
                              {kernel.queue.length === 0 && (
                                 <span className="text-[7px] text-white/20 italic">IDLE</span>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Right Panel: Recipe Selection */}
               <div className="flex-1 flex flex-col">
                  {/* Category Filters */}
                  <div className="flex border-b border-blue-500/10 overflow-x-auto no-scrollbar">
                        {(['ALL', 'BASIC', 'BIO', 'ORGANIC', 'CRYSTAL', 'MINING', 'WEAPON', 'REACTOR'] as const).map(cat => (
                           <button
                              key={cat}
                              onClick={() => setActiveCategory(cat)}
                              className={`px-3 py-2 text-[8px] uppercase whitespace-nowrap border-r border-blue-500/10 transition-colors ${
                                 activeCategory === cat ? 'bg-blue-500/20 text-blue-200' : 'text-white/40 hover:bg-white/5'
                              }`}
                           >
                              {cat}
                           </button>
                        ))}
                  </div>
                  
                  {/* Tier Selector */}
                  <div className="flex items-center gap-1 px-3 py-1 border-b border-blue-500/20 bg-black/40">
                    <span className="text-[8px] text-white/30 mr-2">TIER:</span>
                    {[1,2,3,4,5,6,7,8,9,10].map(t => (
                        <button
                          key={t}
                          onClick={() => setActiveTier(t)}
                          className={`w-5 h-5 flex items-center justify-center text-[9px] transition-all rounded-sm ${
                              activeTier === t ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-white/20 hover:text-white/50'
                          }`}
                        >
                          {t}
                        </button>
                    ))}
                  </div>

                  {/* Settings Bar */}
                  <div className="px-4 py-2 border-b border-blue-500/10 flex justify-between items-center bg-white/2">
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] text-blue-400">Order:</span>
                           <input 
                              type="number" 
                              value={orderCount}
                              onChange={(e) => setOrderCount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-10 bg-black/40 border border-blue-500/30 text-[9px] px-1 text-blue-200 outline-none"
                           />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] text-blue-400">Target:</span>
                           <span className="text-[8px] text-white/80 uppercase">
                              {selectedKernelId ? `Kernel (ID: ${selectedKernelId.slice(0,4)})` : 'Auto-Distribution'}
                           </span>
                        </div>
                     </div>
                  </div>

                  {/* Recipe Grid */}
                  <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 custom-scrollbar">
                     {filteredRecipes.map(recipe => {
                        const affordable = canAfford(recipe, orderCount);
                        const hasTech = !recipe.techRequired || researchedTechs.includes(recipe.techRequired);

                        return (
                           <div 
                              key={recipe.id}
                              className={`p-3 border transition-all flex flex-col group ${
                                 hasTech 
                                    ? (affordable ? 'bg-white/5 border-white/10 hover:border-blue-500/50' : 'bg-black/40 border-white/5 opacity-60')
                                    : 'bg-red-900/10 border-red-500/10 opacity-30 pointer-events-none'
                              }`}
                           >
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <div className="text-[10px] font-bold text-blue-100 mb-0.5">{recipe.label}</div>
                                    <div className="text-[7px] text-white/30 uppercase tracking-tighter">
                                      Cycle: {Math.floor(recipe.productionTime / (kernels.find(k => k.compartmentId === selectedKernelId)?.volume || kernels[0]?.volume || 10))}s
                                    </div>
                                 </div>
                                 <div className="w-8 h-8 border border-white/10 bg-white/5 flex items-center justify-center">
                                    <span className="text-[10px] opacity-20">⚙</span>
                                 </div>
                              </div>

                              <div className="flex-1 space-y-1 my-2">
                                 {recipe.inputs.map((input: any) => {
                                    const has = resources[input.materialId] || 0;
                                    const required = input.amount * orderCount;
                                    return (
                                       <div key={input.materialId} className="flex justify-between items-center">
                                          <span className="text-[7px] uppercase text-white/40">{input.materialId.split('_').pop()}</span>
                                          <span className={`text-[8px] ${has >= required ? 'text-white/60' : 'text-red-400 font-bold'}`}>{Math.floor(has)}/{required}</span>
                                       </div>
                                    );
                                 })}
                              </div>

                              <button
                                 disabled={!affordable || !hasTech || !hasMachinery}
                                 onClick={() => onProduce(recipe.id, orderCount, selectedKernelId || undefined)}
                                 className={`w-full py-2 text-[9px] uppercase tracking-widest transition-all border ${
                                    !hasTech 
                                       ? 'bg-red-900/20 text-red-500/50 border-red-900/30'
                                       : affordable
                                          ? 'bg-blue-500/10 hover:bg-blue-500/30 text-blue-300 border-blue-500/40'
                                          : 'bg-white/5 text-white/20 border-white/5'
                                 }`}
                              >
                                 {!hasTech ? 'Locked' : !hasMachinery ? 'No Link' : affordable ? 'Queue' : 'No Mats'}
                              </button>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            {/* Matrix Data Footer */}
            <div className="px-4 py-2 bg-black border-t border-blue-500/10 flex justify-between items-center">
               <div className="text-[7px] text-white/20 uppercase tracking-[0.4em] animate-pulse">
                  System.Log :: Ready
               </div>
            </div>

            {/* Resize handle */}
            <div 
              className="absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize opacity-20 hover:opacity-100 transition-opacity"
              onPointerDown={(e: any) => {
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = size.width;
                const startH = size.height;
                const onMove = (me: PointerEvent) => {
                  setSize({ width: Math.max(600, startW + me.clientX - startX), height: Math.max(400, startH + me.clientY - startY) });
                };
                const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
            >
              ◢
            </div>
        </motion.div>
      </>
      )}
    </AnimatePresence>
  );
}

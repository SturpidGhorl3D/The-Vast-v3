'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TECHNOLOGIES, TechCategory, Technology } from '@/components/game/technologyTypes';
import { cn } from '@/lib/utils';
import { SpeciesDefinition } from '@/components/game/speciesTypes';

interface TechnologyWindowProps {
  isOpen: boolean;
  onClose: () => void;
  orgType: string;
  innovationPoints: number;
  researchedTechs: string[];
  species?: SpeciesDefinition | null;
  activeResearch?: { techId: string; progress: number; totalCost: number } | null;
  availableTechOptions?: string[];
  pendingInnovationChoices?: string[];
  pendingBranchChoices?: Record<string, string[]>;
  nodePositions?: Record<string, { x: number; y: number }>;
  branchingCounts?: Record<string, number>;
  onResearch: (techId: string) => void;
  onSelectInnovation?: (techId: string, parentId?: string) => void;
  onUnlockOption?: (techId: string) => void;
  onUpdateNodePosition?: (techId: string, pos: { x: number; y: number }) => void;
  onBranchOut?: (baseTechId: string) => void;
  hudOpen?: boolean;
  isMobile?: boolean;
}

export default function TechnologyWindow({
  isOpen,
  onClose,
  orgType,
  innovationPoints,
  researchedTechs,
  species,
  activeResearch,
  availableTechOptions = [],
  pendingInnovationChoices = [],
  pendingBranchChoices = {},
  nodePositions = {},
  branchingCounts = {},
  onResearch,
  onSelectInnovation,
  onUnlockOption,
  onUpdateNodePosition,
  onBranchOut,
  hudOpen = false,
  isMobile = false
}: TechnologyWindowProps) {
  const [activeCategory, setActiveCategory] = useState<TechCategory>('PHYSICS');
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNode, setDraggedNode] = useState<{ id: string, startX: number, startY: number, x: number, y: number } | null>(null);

  // Time for floating effects
  const [time, setTime] = useState(0);
  useEffect(() => {
    let frame = requestAnimationFrame(function loop(t) {
      setTime(t / 1000);
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const shipType = species?.shipType || 'STANDARD';

  // Filter techs by category AND ship type restriction
  const allTechs = useMemo(() => Object.values(TECHNOLOGIES).filter(t => {
    if (t.category !== activeCategory) return false;
    if (t.shipTypeRestriction && !t.shipTypeRestriction.includes(shipType)) return false;
    return true;
  }), [activeCategory, shipType]);

  const isVisible = React.useCallback((tech: Technology) => {
    // Show if it's a root in the global sense
    if (tech.requirements.length === 0) return true; 
    
    // Show if it's a "local root" (start of a branch) in this category view
    const hasParentInCategory = allTechs.some(other => 
      other.id !== tech.id && tech.requirements.includes(other.id)
    );
    if (!hasParentInCategory) return true;
    
    // Standard visibility rules
    if (researchedTechs.includes(tech.id)) return true;
    if (activeResearch?.techId === tech.id) return true;
    if (availableTechOptions.includes(tech.id)) return true;
    if (pendingInnovationChoices.includes(tech.id)) return true;
    const isBranchChoice = Object.values(pendingBranchChoices).some(list => list.includes(tech.id));
    if (isBranchChoice) return true;
    return false;
  }, [allTechs, researchedTechs, activeResearch, availableTechOptions, pendingInnovationChoices, pendingBranchChoices]);

  const visibleTechs = useMemo(() => allTechs.filter(isVisible), [allTechs, researchedTechs, activeResearch, availableTechOptions, pendingInnovationChoices, pendingBranchChoices, isVisible]);
  
  const reqsMet = (tech: Technology) => {
    return tech.requirements.length === 0 || tech.requirements.every(req => researchedTechs.includes(req));
  };
  
  const isAvailable = (tech: Technology) => {
    if (researchedTechs.includes(tech.id)) return false;
    if (!reqsMet(tech)) return false;
    if (tech.requirements.length === 0) return true; // Roots always available to start
    return availableTechOptions.includes(tech.id);
  };

  // Calculate coordinates if not present
  const activePositions = useMemo(() => {
    const pos = { ...nodePositions };
    
    // Override with currently dragged node for smooth line updates
    if (draggedNode) {
      pos[draggedNode.id] = { x: draggedNode.x, y: draggedNode.y };
    }

    // Effective roots for this view (no parents WITHIN the current category)
    const roots = allTechs.filter(tech => 
      !allTechs.some(other => other.id !== tech.id && tech.requirements.includes(other.id))
    );
    
    // Position roots in a ring if not set
    roots.forEach((root, i) => {
      if (!pos[root.id]) {
        if (roots.length <= 1) {
          pos[root.id] = { x: 400, y: 400 };
        } else if (roots.length <= 2) {
          pos[root.id] = { x: (i - (roots.length-1)/2) * 500 + 400, y: 400 };
        } else {
          const angle = (i / roots.length) * Math.PI * 2;
          const radius = 350;
          pos[root.id] = { 
            x: Math.cos(angle) * radius + 500, 
            y: Math.sin(angle) * radius + 400 
          };
        }
      }
    });

    // Simple BFS to position children relative to parents if not set
    const queue = [...roots];
    const visited = new Set(roots.map(r => r.id));
    
    while (queue.length > 0) {
      const parent = queue.shift()!;
      // Filter children where THIS parent is the FIRST valid parent within this category 
      // (to keep visual tree logical and matching the line rendering)
      const children = allTechs.filter(t => {
        if (visited.has(t.id)) return false;
        const inCategoryReqs = t.requirements.filter(reqId => allTechs.some(other => other.id === reqId));
        return inCategoryReqs[0] === parent.id;
      });
      
      children.forEach((child, i) => {
        if (!pos[child.id]) {
          const parentPos = pos[parent.id];
          const angle = (i - (children.length-1)/2) * 0.5; // Spread children
          const dir = parentPos ? { x: parentPos.x - 500, y: parentPos.y - 400 } : { x: 1, y: 0 };
          const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
          const norm = { x: dir.x / mag, y: dir.y / mag };
          
          // Rotate norm by spread angle
          const rx = norm.x * Math.cos(angle) - norm.y * Math.sin(angle);
          const ry = norm.x * Math.sin(angle) + norm.y * Math.cos(angle);
          
          pos[child.id] = {
            x: (parentPos?.x || 500) + rx * 400,
            y: (parentPos?.y || 400) + ry * 400
          };
        }
        visited.add(child.id);
        queue.push(child);
      });
    }

    return pos;
  }, [allTechs, nodePositions, draggedNode]);

  // Auto-center camera when category changes
  useEffect(() => {
    if (!isOpen) return;
    
    // We want to center the tree nodes in the current view
    const visiblePosValues = visibleTechs.map(t => activePositions[t.id]).filter(Boolean);
    if (visiblePosValues.length > 0 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const avgX = visiblePosValues.reduce((sum, p) => sum + p!.x, 0) / visiblePosValues.length;
      const avgY = visiblePosValues.reduce((sum, p) => sum + p!.y, 0) / visiblePosValues.length;
      
      // We want avgX * scale + panX = rect.width / 2
      setPan({
        x: rect.width / 2 - (avgX + 140) * scale, // +140 to center the card width
        y: rect.height / 2 - (avgY + 40) * scale  // +40 to center the card height
      });
    }
  }, [activeCategory, isOpen]);

  const CATEGORIES: { id: TechCategory, label: string }[] = [
    { id: 'PHYSICS', label: 'Физика'},
    { id: 'MATERIALS', label: 'Материалы' },
    { id: 'ENGINEERING', label: 'Инженерия' },
    { id: 'WEAPONS', label: 'Оружие' },
    { id: 'MODIFICATIONS', label: 'Модификации' },
    { id: 'PRODUCTION', label: 'Производство' },
    { id: 'SOCIOLOGY', label: 'Социология' },
    { id: 'DIPLOMACY', label: 'Дипломатия' },
  ];

  const handleBackgroundDrag = (e: React.PointerEvent) => {
    // Only pan if we aren't clicking a node or its contents
    if ((e.target as HTMLElement).closest('.tech-node')) return;
    
    setIsPanning(true);
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const onMove = (me: PointerEvent) => {
      setPan({ x: me.clientX - startX, y: me.clientY - startY });
    };
    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleScroll = (e: React.WheelEvent) => {
    if (!canvasRef.current) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.2), 2);
    
    if (newScale === scale) return;

    // Zoom towards the cursor position relative to the container
    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // We want the primary content under the cursor to stay in the same place.
    // ScreenX = ContentX * scale + panX
    // => ContentX = (ScreenX - panX) / scale
    // We want: ScreenX = ContentX * newScale + newPanX
    // => newPanX = ScreenX - ContentX * newScale
    
    const worldX = (cursorX - pan.x) / scale;
    const worldY = (cursorY - pan.y) / scale;

    const newPanX = cursorX - worldX * newScale;
    const newPanY = cursorY - worldY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center pointer-events-auto font-sans"
        >
          <div className="w-full h-full relative overflow-hidden flex flex-col">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10 z-10">
               <div className="flex items-center gap-6">
                 <h2 className="text-xl font-light tracking-[0.3em] uppercase text-white/80">Матрица Технологий</h2>
                 <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[500px]">
                   {CATEGORIES.map(cat => (
                     <button
                       key={cat.id}
                       onClick={() => { setActiveCategory(cat.id); setPan({x:0, y:0}); }}
                       className={cn(
                         "px-4 py-2 text-[10px] uppercase tracking-widest transition-all whitespace-nowrap",
                         activeCategory === cat.id ? "bg-white/10 text-white border-b border-purple-500" : "text-white/40 hover:text-white/70"
                       )}
                     >
                       {cat.label}
                     </button>
                   ))}
                 </div>
               </div>
               
               <div className="flex items-center gap-6">
                 {innovationPoints > 0 && (
                   <button 
                     onClick={() => onUnlockOption?.('')}
                     className="flex items-center gap-2 px-4 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-full transition-all group"
                   >
                     <span className="text-[10px] text-yellow-400 font-bold tracking-[0.2em] uppercase group-hover:text-yellow-300">
                       ИНИЦИИРОВАТЬ ПРОРЫВ ({innovationPoints})
                     </span>
                   </button>
                 )}
                 <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                   <span className="text-xs uppercase tracking-widest">Закрыть</span>
                 </button>
               </div>
            </div>

            {/* Removed Innovation Choice Overlay as per user request to have it in-matrix */}

            {/* Tree Canvas */}
            <div 
              ref={canvasRef}
              className="flex-1 cursor-grab active:cursor-grabbing relative overflow-hidden select-none touch-none"
              onPointerDown={handleBackgroundDrag}
              onWheel={handleScroll}
            >
              <motion.div 
                className="absolute inset-0"
                style={{ x: pan.x, y: pan.y, scale, transformOrigin: '0 0' }}
              >
                {/* Background Grid */}
                <div className="absolute inset-[-8000px] opacity-10 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

                <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full">
                  {visibleTechs.map(tech => {
                    const pos = activePositions[tech.id];
                    if (!pos) return null;

                    const lx = Math.sin(time * 0.5 + pos.x) * 5;
                    const ly = Math.cos(time * 0.4 + pos.y) * 5;

                    // ONLY draw line to the FIRST valid requirement to keep visual tree clean (one parent rule)
                    const validReqs = tech.requirements.filter(reqId => visibleTechs.some(t => t.id === reqId));
                    const primaryReqId = validReqs[0];
                    if (!primaryReqId) return null;

                    const rPos = activePositions[primaryReqId];
                    if (!rPos) return null;

                    const rlx = Math.sin(time * 0.5 + rPos.x) * 5;
                    const rly = Math.cos(time * 0.4 + rPos.y) * 5;

                    const isResearched = researchedTechs.includes(tech.id);
                    return (
                      <motion.path
                        key={`${tech.id}-${primaryReqId}`}
                        d={`M ${rPos.x + 140 + rlx} ${rPos.y + 40 + rly} L ${pos.x + 140 + lx} ${pos.y + 40 + ly}`}
                        stroke={isResearched ? "rgba(34, 197, 94, 0.4)" : "rgba(168, 85, 247, 0.2)"}
                        strokeWidth="1.5"
                        strokeDasharray={isResearched ? "" : "4 4"}
                        fill="none"
                      />
                    );
                  })}
                </svg>

                {visibleTechs.map(tech => {
                  const pos = activePositions[tech.id];
                  if (!pos) return null;

                  const isResearched = researchedTechs.includes(tech.id);
                  const isResearching = activeResearch?.techId === tech.id;
                  const isGlobalChoice = pendingInnovationChoices.includes(tech.id);
                  
                  let parentIdOfChoice: string | undefined = undefined;
                  for (const pid of Object.keys(pendingBranchChoices)) {
                    if (pendingBranchChoices[pid].includes(tech.id)) {
                      parentIdOfChoice = pid;
                      break;
                    }
                  }
                  const isBranchChoice = !!parentIdOfChoice;
                  const isPending = isGlobalChoice || isBranchChoice;
                  
                  const available = isAvailable(tech) || isResearching;
                  
                  // Float
                  const lx = Math.sin(time * 0.5 + pos.x) * 5;
                  const ly = Math.cos(time * 0.4 + pos.y) * 5;

                  const branchCost = Math.pow(2, branchingCounts[tech.id] || 0);

                  const handleNodeDrag = (e: React.PointerEvent) => {
                    e.stopPropagation();
                    const startMouseX = e.clientX;
                    const startMouseY = e.clientY;
                    const startNodeX = pos.x;
                    const startNodeY = pos.y;
                    
                    setDraggedNode({ id: tech.id, startX: startNodeX, startY: startNodeY, x: startNodeX, y: startNodeY });

                    const onMove = (me: PointerEvent) => {
                      const dx = (me.clientX - startMouseX) / scale;
                      const dy = (me.clientY - startMouseY) / scale;
                      setDraggedNode({ 
                        id: tech.id, 
                        startX: startNodeX, 
                        startY: startNodeY, 
                        x: startNodeX + dx, 
                        y: startNodeY + dy 
                      });
                    };

                    const onUp = (ue: PointerEvent) => {
                      const dx = (ue.clientX - startMouseX) / scale;
                      const dy = (ue.clientY - startMouseY) / scale;
                      onUpdateNodePosition?.(tech.id, { 
                        x: startNodeX + dx, 
                        y: startNodeY + dy 
                      });
                      setDraggedNode(null);
                      window.removeEventListener('pointermove', onMove);
                      window.removeEventListener('pointerup', onUp);
                    };

                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  };

                  return (
                    <motion.div
                      key={tech.id}
                      onPointerDown={handleNodeDrag}
                      className={cn(
                        "absolute w-[280px] p-4 transition-colors duration-500 select-none group border backdrop-blur-md tech-node",
                        isResearched ? "bg-green-500/10 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : 
                        isResearching ? "bg-blue-500/15 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.3)]" :
                        isPending ? "bg-yellow-500/15 border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.2)] border-dashed" :
                        available ? "bg-purple-900/15 border-purple-500/40 hover:border-purple-300 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.1)]" :
                        "bg-black/60 border-white/5 opacity-50 grayscale"
                      )}
                      style={{ left: pos.x + lx, top: pos.y + ly, zIndex: isResearching || isPending ? 20 : 10 }}
                    >
                      {/* Node Content */}
                      <div>
                        <div className="flex justify-between items-start mb-2">
                           <div className="flex items-center gap-2">
                             <div className={cn("w-2 h-2 rounded-full", isResearched ? "bg-green-400" : isResearching ? "bg-blue-400 animate-pulse" : isPending ? "bg-yellow-400 animate-pulse" : "bg-purple-400")} />
                             <span className={cn("text-xs font-bold tracking-wider leading-tight uppercase", isResearched ? "text-green-200" : "text-white/90")}>
                               {tech.name}
                             </span>
                           </div>
                           <div className="text-[10px] font-mono text-white/30">{tech.cost}</div>
                        </div>

                        <p className="text-[9px] text-white/50 leading-relaxed min-h-[30px] mb-3 font-mono">
                          {tech.description}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col gap-2 mt-auto">
                        {isResearching ? (
                          <div className="space-y-1.5">
                             <div className="text-[8px] text-blue-400 font-bold animate-pulse tracking-[0.2em]">АНАЛИЗ: {Math.round((activeResearch.progress / activeResearch.totalCost) * 100)}%</div>
                             <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                               <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (activeResearch.progress / activeResearch.totalCost) * 100)}%` }} />
                             </div>
                          </div>
                        ) : isPending ? (
                          <button 
                             onClick={(e) => { e.stopPropagation(); onSelectInnovation?.(tech.id, parentIdOfChoice); }}
                             className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 text-[9px] uppercase tracking-[0.3em] border border-yellow-500/50 transition-all font-bold"
                          >
                             Принять гипотезу
                          </button>
                        ) : isResearched ? (
                          <div className="flex justify-between items-center gap-2">
                             <span className="text-[8px] text-green-500/60 uppercase tracking-widest font-bold">Отработано</span>
                             
                             <button 
                               onClick={(e) => { e.stopPropagation(); onBranchOut?.(tech.id); }}
                               disabled={innovationPoints < branchCost}
                               className="text-[9px] bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500/80 px-2.5 py-1 border border-yellow-500/30 uppercase tracking-[0.2em] transition-all disabled:opacity-20 flex items-center gap-2"
                             >
                               Разветвить ({branchCost})
                             </button>
                          </div>
                        ) : available ? (
                          <button 
                             onClick={(e) => { e.stopPropagation(); onResearch(tech.id); }}
                             disabled={!!activeResearch}
                             className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 text-white text-[9px] uppercase tracking-[0.3em] border border-purple-500/50 transition-all disabled:opacity-20 font-bold"
                          >
                             Начать изучение
                          </button>
                        ) : (
                          <div className="w-full py-1.5 bg-white/5 text-white/20 text-[9px] uppercase tracking-widest text-center">
                            Вне доступа
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Footer Tip */}
            <div className="px-6 py-4 bg-black/80 border-t border-white/5 text-[9px] text-white/30 flex justify-between items-center uppercase tracking-[0.4em]">
               <div className="flex gap-8">
                 <span className="flex items-center gap-2">◈ ЛКМ (фон) - Перемещение</span>
                 <span className="flex items-center gap-2">◈ ЛКМ (узел) - Перетаскивание</span>
               </div>
               <div className="text-yellow-500/50">Ветвление требует Очки Инноваций</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

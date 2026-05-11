'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import type { EditorMode, ShipHull, CompartmentType, Point, Deck } from '@/components/game/types';
import { validateHullForApply, symmetrizeHull, checkValidation, generateStructuralBeams } from '@/components/game/editorLogic';
import { calcBlueprintCost, COMPARTMENT_COLORS, polygonArea } from '@/game/compartmentUtils';
import { calculateMaxCapacity, getCompartmentVolume } from '@/game/systems';
import { Inventory } from '@/game/engine/types';
import { Header } from './editor-ui/Header';
import { CostPanel } from './editor-ui/CostPanel';
import { EditorMenuOverlay } from './editor-ui/EditorMenuOverlay';
import { DecksPanel } from './editor-ui/DecksPanel';
import { TurretEditorLeftPanel } from './editor-ui/TurretEditorLeftPanel';
import { BottomToolbar } from './editor-ui/BottomToolbar';
import { CompartmentPanel } from './editor-ui/CompartmentPanel';
import { StructuralDeckPanel } from './editor-ui/StructuralDeckPanel';
import { CellPanel } from './editor-ui/CellPanel';
import { TECHNOLOGIES, COMPARTMENT_TECH_REQUIREMENTS } from '@/components/game/technologyTypes';
import { useEditorOperations } from '@/hooks/useEditorOperations';

interface EditorUIProps {
  isMobile: boolean;
  shipHull: ShipHull;
  setShipHull: (hull: ShipHull) => void;
  activeDeck: number;
  setActiveDeck: (i: number) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  symmetryX: boolean;
  setSymmetryX: (v: boolean) => void;
  symmetryY: boolean;
  setSymmetryY: (v: boolean) => void;
  activeVertex: number | null;
  setActiveVertex: (v: number | null) => void;
  activeCompartment: any;
  setActiveCompartment: (c: any) => void;
  activeCompartmentVertex: number | null;
  resources: { IRON: number; TITANIUM: number; COBALT?: number; MAGNESIUM?: number; CARBON?: number; [key: string]: any };
  costInfo: { cost: { IRON: number; TITANIUM: number }; refund: { IRON: number; TITANIUM: number } } | null;
  selectionType: 'deck' | 'compartment' | 'cell' | null;
  setSelectionType: (v: 'deck' | 'compartment' | 'cell' | null) => void;
  selectedElementIndex: number | string | null;
  setSelectedElementIndex: (v: number | string | null) => void;
  isEditorMenuOpen: boolean;
  setIsEditorMenuOpen: (v: boolean) => void;
  setInternalView: (v: boolean) => void;
  setIsEditorOpen: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  engine: any;
  isCreative?: boolean;
  researchedTechs: string[];
}

const COMPARTMENT_LABELS: Record<string, string> = {
  BRIDGE: 'Bridge', ENGINE: 'Engine', WARP_ENGINE: 'Warp Drive', CARGO: 'Cargo Bay',
  WEAPON: 'Weapon Turret', MINING: 'Mining Turret', REACTOR: 'Reactor',
  GYRO: 'Gyro Array', MACHINERY: 'Machinery', FABRIC: 'Fabricator',
  COMMUNICATION: 'Comm Array', RESEARCH: 'Research Lab',
};

const ALL_COMPARTMENT_TYPES: CompartmentType[] = [
  'BRIDGE', 'ENGINE', 'WARP_ENGINE', 'CARGO',
  'WEAPON', 'MINING', 'REACTOR', 'GYRO', 'MACHINERY', 'FABRIC',
  'COMMUNICATION', 'RESEARCH',
];

function calcCost(engine: any): { cost: { IRON: number; TITANIUM: number }; refund: { IRON: number; TITANIUM: number } } | null {
  const draftHull = engine.draftHull;
  const player = engine.player;
  if (!draftHull || player === null) return null;
  const currentHull = engine.ecs.getComponent(player, 'Hull');
  if (!currentHull) return null;
  return calcBlueprintCost(currentHull.decks, draftHull.decks, draftHull.compartments, currentHull.compartments);
}

function hasCargo(engine: any): boolean {
  const draftHull = engine.draftHull;
  if (!draftHull) return false;
  return draftHull.compartments.some((c: any) => c.type === 'CARGO');
}

export default function EditorUI({
  isMobile,
  shipHull,
  setShipHull,
  activeDeck,
  setActiveDeck,
  editorMode,
  setEditorMode,
  symmetryX,
  setSymmetryX,
  symmetryY,
  setSymmetryY,
  activeVertex,
  setActiveVertex,
  activeCompartment,
  setActiveCompartment,
  activeCompartmentVertex,
  resources,
  costInfo,
  selectionType,
  setSelectionType,
  selectedElementIndex,
  setSelectedElementIndex,
  isEditorMenuOpen,
  setIsEditorMenuOpen,
  setInternalView,
  setIsEditorOpen,
  setIsPaused,
  engine,
  isCreative = false,
  researchedTechs,
}: EditorUIProps) {
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(!isMobile);
  const [pendingCompType, setPendingCompType] = useState<CompartmentType>('CARGO');
  const [showBlueprints, setShowBlueprints] = useState(false);
  const deckCount = shipHull.decks.length;

  const [turretEditPart, setTurretEditPart] = useState<'MOUNT' | 'HEAD' | 'BARREL'>('MOUNT');
  const [turretActiveLayerId, setTurretActiveLayerId] = useState<string | null>(null);
  const [turretTargetBarrelIdx, setTurretTargetBarrelIdx] = useState<number>(0);

  const isTurretEditor = !!(engine && engine.isTurretEditor);

  const totalShipValue = React.useMemo(() => {
    return calcBlueprintCost([], shipHull.decks, shipHull.compartments, []);
  }, [shipHull]);

  const { applyChanges, cancelEditor } = useEditorOperations(
    engine, 
    setIsEditorOpen, 
    setIsPaused, 
    setInternalView, 
    setActiveDeck, 
    setIsEditorMenuOpen, 
    isCreative
  );

  // Sync to engine upon first entering EDIT_TURRET
  useEffect(() => {
    if (editorMode === 'EDIT_TURRET' && engine) {
      engine.setIsTurretEditor(true);
    }
  }, [editorMode, engine]);

  const activeComp = isTurretEditor && engine ? engine.activeCompartment : null;
  const tc = activeComp ? (activeComp.turretConfig || activeComp.miningConfig) : null;
  const tvs = tc ? tc.visual : null;

  const getTurretLayers = () => {
     if(!tvs) return [];
     if(turretEditPart === 'MOUNT') return tvs.mountLayers || [];
     if(turretEditPart === 'HEAD') return tvs.headLayers || [];
     return tvs.barrelLayers || [];
  };

  const setTurretLayers = (newLayers: any[]) => {
     if(!tc || !tvs || !engine) return;
     const newHull = JSON.parse(JSON.stringify(engine.draftHull));
     const newComp = newHull.compartments.find((c:any) => c.id === activeComp.id);
     
     if(newComp) {
        const config = newComp.turretConfig || newComp.miningConfig;
        if(turretEditPart === 'MOUNT') config.visual.mountLayers = newLayers;
        if(turretEditPart === 'HEAD') config.visual.headLayers = newLayers;
        if(turretEditPart === 'BARREL') config.visual.barrelLayers = newLayers;
        
        engine.updateDraftHull(newHull);
        setActiveCompartment(engine.activeCompartment);
        setShipHull(newHull);
     }
  };

  const regenerateBeams = (newHull: ShipHull) => {
    if (!engine || !newHull) return;
    const activeDeckIdx = newHull.activeDeckIndex || 0;
    const dk = newHull.decks[activeDeckIdx];
    if (dk) {
      const { beams, cells } = generateStructuralBeams(
        dk.points,
        newHull.compartments.filter((c: any) => c.startDeck <= activeDeckIdx && c.endDeck >= activeDeckIdx),
        dk.beamPattern || 'NONE',
        dk.beamDensity || 2.0,
        engine.symmetryY,
        engine.symmetryX
      );
      dk.beams = beams;
      dk.cells = cells;
    }
  };

  const updateCompartmentField = (field: string, value: any, subField?: string) => {
    if (!engine || !engine.draftHull || !activeCompartment) return;
    const newHull = JSON.parse(JSON.stringify(engine.draftHull));
    const compIdx = newHull.compartments.findIndex((c: any) => c.id === activeCompartment.id);
    if (compIdx === -1) return;
    const coreComp = newHull.compartments[compIdx];

    // Core logic: Shared settings for paired compartments
    const targets = newHull.compartments.filter((c: any) => 
       c.id === coreComp.id || 
       c.parentId === coreComp.id || 
       (coreComp.parentId && c.id === coreComp.parentId)
    );

    targets.forEach((comp: any) => {
      if (subField) {
        if (!comp[field]) comp[field] = {};
        comp[field][subField] = value;
      } else {
        comp[field] = value;
      }
    });

    regenerateBeams(newHull);
    
    // Sync state to engine and refresh references
    engine.updateDraftHull(newHull);
    setActiveCompartment(engine.activeCompartment); // Keep React in sync with fresh engine ref
    setShipHull(newHull);
  };

  const px = isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';
  const panelW = isMobile ? 'w-44' : 'w-60';

  const netIronCost = costInfo ? (costInfo.cost.IRON - costInfo.refund.IRON) : 0;
  const netTiCost = costInfo ? (costInfo.cost.TITANIUM - costInfo.refund.TITANIUM) : 0;
  const canAfford = costInfo ? (resources.IRON >= netIronCost && resources.TITANIUM >= netTiCost) : true;

  const dragControls = useDragControls();

  return (
    <div className="absolute inset-0 flex flex-col bg-transparent z-[60] font-mono text-white pointer-events-none">
      <Header 
        isMobile={isMobile}
        isCreative={isCreative}
        hasIntersections={shipHull.decks?.some((d: any) => d.isSelfIntersecting)}
        canAfford={canAfford}
        applyChanges={applyChanges}
        cancelEditor={cancelEditor}
        setIsEditorMenuOpen={setIsEditorMenuOpen}
        isEditorMenuOpen={isEditorMenuOpen}
      />

      <CostPanel 
        isCreative={isCreative}
        costInfo={costInfo}
        resources={resources}
        totalShipValue={totalShipValue}
        canAfford={canAfford}
      />

      <EditorMenuOverlay 
        isEditorMenuOpen={isEditorMenuOpen}
        setIsEditorMenuOpen={setIsEditorMenuOpen}
        isMobile={isMobile}
        isCreative={isCreative}
        costInfo={costInfo}
        applyChanges={applyChanges}
        cancelEditor={cancelEditor}
        showBlueprints={showBlueprints}
        setShowBlueprints={setShowBlueprints}
        shipHull={shipHull}
        setShipHull={setShipHull}
        setActiveDeck={setActiveDeck}
        engine={engine}
      />

      {/* ── Main panels row ── */}
      <div className="flex-1 flex overflow-hidden pointer-events-none relative min-h-0">

        {/* ── Left Panel: Decks + Compartments ── */}
        <div className="flex pointer-events-auto shrink-0">
          {leftOpen ? (
            <div className={`${panelW} flex flex-col bg-[#050505]/95 border-r border-white/10 ${isMobile ? 'p-2' : 'p-4'} overflow-y-auto`}>
              <button className="self-end mb-1 text-white/40 hover:text-white text-xs px-1" onClick={() => setLeftOpen(false)}>◀ hide</button>

              {isTurretEditor ? (
                 <TurretEditorLeftPanel 
                   engine={engine}
                   turretEditPart={turretEditPart}
                   setTurretEditPart={setTurretEditPart}
                   turretActiveLayerId={turretActiveLayerId}
                   setTurretActiveLayerId={setTurretActiveLayerId}
                   turretTargetBarrelIdx={turretTargetBarrelIdx}
                   setTurretTargetBarrelIdx={setTurretTargetBarrelIdx}
                   getTurretLayers={getTurretLayers}
                   setTurretLayers={setTurretLayers}
                   setEditorMode={setEditorMode}
                   tc={tc}
                 />
              ) : (
                 <DecksPanel 
                   isMobile={isMobile}
                   shipHull={shipHull}
                   setShipHull={setShipHull}
                   activeDeck={activeDeck}
                   setActiveDeck={setActiveDeck}
                   selectionType={selectionType}
                   setSelectionType={setSelectionType}
                   setSelectedElementIndex={setSelectedElementIndex}
                   setInternalView={setInternalView}
                   resources={resources}
                   costInfo={costInfo}
                   engine={engine}
                 />
              )}
            </div>
          ) : (
            <button className="w-6 bg-[#050505]/90 border-r border-white/10 text-white/40 hover:text-white flex items-start justify-center pt-4 pointer-events-auto text-[9px]" onClick={() => setLeftOpen(true)}>▶</button>
          )}
        </div>

        {/* ── Center: Canvas Area (transparent) ── */}
        <div className="flex-1 pointer-events-none" />

        {/* ── Right Panel: Contextual Options (depends on selection) ── */}
        <div className="flex pointer-events-auto shrink-0">
          {rightOpen ? (
            <div className={`${panelW} flex flex-col bg-[#050505]/95 border-l border-white/10 ${isMobile ? 'p-2' : 'p-4'} overflow-y-auto`}>
              <button className="self-start mb-1 text-white/40 hover:text-white text-xs px-1" onClick={() => setRightOpen(false)}>hide ▶</button>

              {/* ── TURRET EDITOR context ── */}
              {isTurretEditor && editorMode === 'EDIT_VERTICES' && activeVertex !== null && getTurretLayers()?.find((l:any) => l.id === turretActiveLayerId)?.points[activeVertex] && (
                <div className="space-y-3 mb-4">
                  <div className="text-[8px] opacity-40 uppercase">Turret Vertex Tools</div>
                  <div className="p-2 bg-white/5 border border-white/10 text-[9px] space-y-1.5">
                    <div className="text-blue-400 flex justify-between items-center">
                      <span>VERTEX {activeVertex}</span>
                      <button className="text-red-400 hover:text-red-300 pointer-events-auto" onClick={() => {
                        const ls = [...getTurretLayers()];
                        const layer = ls.find((l:any) => l.id === turretActiveLayerId);
                        if (!layer || layer.points.length <= 3) return;
                        
                        let toDelete = [activeVertex];
                        if (engine && (engine.symmetryX || engine.symmetryY)) {
                          const oldP = layer.points[activeVertex];
                          const targets: any[] = [];
                          if (engine.symmetryY) targets.push({ x: -oldP.x, y: oldP.y });
                          if (engine.symmetryX) targets.push({ x: oldP.x, y: -oldP.y });
                          if (engine.symmetryX && engine.symmetryY) targets.push({ x: -oldP.x, y: -oldP.y });
                          
                          targets.forEach(t => {
                             for (let i = 0; i < layer.points.length; i++) {
                               if (!toDelete.includes(i) && Math.abs(layer.points[i].x - t.x) < 2 && Math.abs(layer.points[i].y - t.y) < 2) {
                                  toDelete.push(i); break;
                               }
                             }
                          });
                        }
                        
                        toDelete.sort((a,b) => b - a).forEach(di => {
                           if (layer.points.length > 3) {
                               layer.points.splice(di, 1);
                           }
                        });
                        
                        setTurretLayers(ls);
                        setActiveVertex(null);
                        if(engine) engine.setActiveVertex(null);
                      }}>Delete + Mirrors</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DECK selected ── */}
              {selectionType === 'deck' && (
                <div className="space-y-3">
                  <div className="text-[8px] opacity-40 uppercase">Deck Tools</div>
                  <div className="text-[9px] text-gray-400 mb-1">Selected: <span className="text-blue-300">{shipHull.decks[activeDeck]?.name || `Deck ${activeDeck}`}</span></div>

                  {editorMode === 'EDIT_VERTICES' && activeVertex !== null && shipHull.decks[activeDeck]?.points[activeVertex] && (
                    <div className="p-2 bg-white/5 border border-white/10 text-[9px] space-y-1.5">
                      <div className="text-blue-400 flex justify-between items-center">
                        <span>VERTEX {activeVertex}</span>
                        <button className="text-red-400 hover:text-red-300" onClick={() => {
                          if (!engine.draftHull || activeVertex === null) return;
                          engine.deleteVertex(engine.draftHull.activeDeckIndex, activeVertex);
                          setActiveVertex(null); 
                          engine.setActiveVertex(null); 
                          setShipHull({ ...engine.draftHull });
                        }}>DEL</button>
                      </div>
                      <div className="flex justify-between items-center gap-1">
                        <span className="shrink-0">Seg:</span>
                        <select
                          className="bg-black border border-white/20 text-white text-[9px] px-1 py-0.5 w-full"
                          value={shipHull.decks[activeDeck].points[activeVertex].segmentType || 'STRAIGHT'}
                          onChange={e => {
                            if (!engine.draftHull || engine.activeVertex === null) return;
                            engine.updateVertexSegment(engine.draftHull.activeDeckIndex, engine.activeVertex, e.target.value);
                            setShipHull({ ...engine.draftHull });
                          }}
                        >
                          <option value="STRAIGHT">Straight</option>
                          <option value="CONVEX">Convex</option>
                          <option value="CONCAVE">Concave</option>
                          <option value="SINUSOIDAL">Sinusoidal</option>
                        </select>
                      </div>
                      <button
                        className={`w-full ${px} bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400`}
                        onClick={() => {
                          if (!engine.draftHull || activeVertex === null) return;
                          const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                          const deck = newHull.decks[newHull.activeDeckIndex];
                          if (deck.points.length <= 3) return;
                          const oldP = deck.points[activeVertex];
                          let toDelete = [activeVertex];
                          if (engine.symmetryX || engine.symmetryY) {
                            const targets: any[] = [];
                            if (engine.symmetryY) targets.push({ x: -oldP.x, y: oldP.y });
                            if (engine.symmetryX) targets.push({ x: oldP.x, y: -oldP.y });
                            if (engine.symmetryX && engine.symmetryY) targets.push({ x: -oldP.x, y: -oldP.y });
                            targets.forEach(t => {
                              for (let i = 0; i < deck.points.length; i++) {
                                if (!toDelete.includes(i) && Math.abs(deck.points[i].x - t.x) < 5 && Math.abs(deck.points[i].y - t.y) < 5) { toDelete.push(i); break; }
                              }
                            });
                          }
                          toDelete.sort((a, b) => b - a).forEach(di => deck.points.splice(di, 1));
                          regenerateBeams(newHull);
                          setActiveVertex(null); engine.setActiveVertex(null);
                          setShipHull(newHull);
                        }}
                      >Delete + Mirrors</button>
                    </div>
                  )}

                  {editorMode === 'EDIT_VERTICES' && (
                    <button
                      className={`w-full ${px} bg-white/10 hover:bg-white/20 border border-white/30 uppercase`}
                      onClick={() => {
                        if (engine.draftHull) {
                          const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                          symmetrizeHull(newHull, engine.symmetryY, engine.symmetryX);
                          regenerateBeams(newHull);
                          setShipHull(newHull);
                        }
                      }}
                    >Symmetrize Hull</button>
                  )}

                  {editorMode === 'PAN' && (
                    <div className="text-[9px] text-gray-400">Deck selected. Use tools below to edit vertices or add vertices.</div>
                  )}

                  <StructuralDeckPanel 
                    deck={shipHull.decks[activeDeck]} 
                    activeDeck={activeDeck}
                    setShipHull={setShipHull}
                    engine={engine}
                    px={px}
                    researchedTechs={researchedTechs}
                    isCreative={isCreative}
                  />
                </div>
              )}

              {/* ── COMPARTMENT selected ── */}
              {selectionType === 'compartment' && activeCompartment && (
                <CompartmentPanel
                  comp={activeCompartment}
                  px={px}
                  engine={engine}
                  editorMode={editorMode}
                  setEditorMode={setEditorMode}
                  activeCompartmentVertex={activeCompartmentVertex}
                  updateField={updateCompartmentField}
                  resources={resources}
                  setShipHull={setShipHull}
                  shipHull={shipHull}
                  deckCount={deckCount}
                  researchedTechs={researchedTechs}
                  isCreative={isCreative}
                  onDelete={() => {
                    if (engine.draftHull && activeCompartment) {
                      const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                      const compId = activeCompartment.id;
                      newHull.compartments = newHull.compartments.filter((c: any) => c.id !== compId && c.pairedWith !== compId);
                      regenerateBeams(newHull);
                      engine.setDraftHull(newHull);
                      engine.setSelectionType(null);
                      setSelectionType(null);
                      setSelectedElementIndex(null);
                      setActiveCompartment(null); 
                      engine.setActiveCompartment(null);
                      setShipHull(newHull);
                    }
                  }}
                />
              )}

              {/* ── CELL selected (Armor) ── */}
              {selectionType === 'cell' && (engine as any).activeCell && (
                <CellPanel 
                   cell={(engine as any).activeCell}
                   engine={engine}
                   setShipHull={setShipHull}
                   onDelete={() => {
                      if (engine.draftHull && (engine as any).activeCell) {
                         const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                         const cellId = (engine as any).activeCell.id;
                         newHull.decks.forEach((d: any) => {
                            if (d.cells) d.cells = d.cells.filter((c: any) => c.id !== cellId);
                         });
                         engine.setDraftHull(newHull);
                         setShipHull(newHull);
                         engine.setSelectionType(null);
                         setSelectionType(null);
                      }
                   }}
                />
              )}

              {/* ── ADD COMPARTMENT mode ── */}
              {editorMode === 'ADD_COMPARTMENT' && (
                <div className="space-y-2">
                  <div className="text-[8px] opacity-40 uppercase">Add Compartment</div>
                  <div className="text-[9px] text-gray-400">Select type and click hull to place.</div>
                  <div className="relative">
                    <select
                      className="w-full bg-[#050505] border border-blue-500/50 text-[10px] p-2 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                      value={pendingCompType}
                      onChange={(e) => {
                        const type = e.target.value as CompartmentType;
                        setPendingCompType(type);
                        engine.setPendingCompartmentType(type);
                        setShipHull({ ...shipHull });
                      }}
                    >
                      {ALL_COMPARTMENT_TYPES.map(type => {
                        const reqTechId = COMPARTMENT_TECH_REQUIREMENTS[type];
                        const isUnlocked = isCreative || !reqTechId || (engine?.researchedTechs?.includes(reqTechId));
                        return (
                          <option key={type} value={type} className="bg-[#050505]" disabled={!isUnlocked}>
                            {COMPARTMENT_LABELS[type] || type} {!isUnlocked ? `(Req: ${TECHNOLOGIES[reqTechId]?.name || reqTechId})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none" style={{ background: COMPARTMENT_COLORS[pendingCompType] || '#888' }} />
                  </div>
                  <div className="mt-2 text-[8px] text-white/50 leading-tight">
                    Current selection: <span className="text-blue-400 font-bold">{COMPARTMENT_LABELS[pendingCompType]}</span>
                  </div>
                </div>
              )}

              {/* ── No selection ── */}
              {!selectionType && editorMode !== 'ADD_COMPARTMENT' && (
                <div className="space-y-1">
                  <div className="text-[8px] opacity-40 uppercase">Selection</div>
                  <div className="text-[9px] text-gray-400">
                    Click a <span className="text-blue-300">deck</span> or <span className="text-yellow-300">compartment</span> in the left panel to select it, then use tools below.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="w-6 bg-[#050505]/90 border-l border-white/10 text-white/40 hover:text-white flex items-start justify-center pt-4 pointer-events-auto text-[9px]" onClick={() => setRightOpen(true)}>◀</button>
          )}
        </div>
      </div>

      <BottomToolbar 
        isMobile={isMobile}
        selectionType={selectionType}
        editorMode={editorMode}
        setEditorMode={setEditorMode}
        isTurretEditor={isTurretEditor}
        engine={engine}
        symmetryX={symmetryX}
        setSymmetryX={setSymmetryX}
        symmetryY={symmetryY}
        setSymmetryY={setSymmetryY}
        activeCompartment={activeCompartment}
        setActiveCompartment={setActiveCompartment}
        setShipHull={setShipHull}
        regenerateBeams={regenerateBeams}
      />
    </div>
  );
}







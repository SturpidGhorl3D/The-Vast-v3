'use client';

import React from 'react';
import { EditorMode, ShipHull, CompartmentType } from '@/components/game/types';
import { COMPARTMENT_COLORS, getCompartmentVolume } from '@/game/compartmentUtils';
import { getReactorPower, getEngineThrust } from '@/game/systems';
import { checkValidation } from '@/components/game/editorLogic';
import { TurretConfigPanel } from './TurretConfigPanel';
import { COMPARTMENT_UPGRADE_TECH_REQUIREMENTS } from '@/components/game/technologyTypes';

const COMPARTMENT_LABELS: Record<string, string> = {
  BRIDGE: 'Bridge', ENGINE: 'Engine', WARP_ENGINE: 'Warp Drive', CARGO: 'Cargo Bay',
  WEAPON: 'Weapon Turret', MINING: 'Mining Turret', REACTOR: 'Reactor',
  GYRO: 'Gyro Array', MACHINERY: 'Machinery', FABRIC: 'Fabricator',
  COMMUNICATION: 'Comm Array', RESEARCH: 'Research Lab',
};

interface CompartmentPanelProps {
  comp: any;
  px: string;
  engine: any;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  activeCompartmentVertex: number | null;
  updateField: (field: string, value: any, subField?: string) => void;
  onDelete: () => void;
  deckCount: number;
  resources: any;
  setShipHull: (h: any) => void;
  shipHull: ShipHull;
  researchedTechs?: string[];
  isCreative?: boolean;
}

export const CompartmentPanel: React.FC<CompartmentPanelProps> = ({
  comp,
  px,
  engine,
  editorMode,
  setEditorMode,
  activeCompartmentVertex,
  updateField,
  onDelete,
  deckCount,
  resources,
  setShipHull,
  shipHull,
  researchedTechs = [],
  isCreative = false,
}) => {
  const isUpgradeUnlocked = (type: string, nextLevel: number) => {
    if (isCreative) return true;
    const reqs = COMPARTMENT_UPGRADE_TECH_REQUIREMENTS[type];
    if (!reqs) return true; // No tech gate defined
    const reqTechId = reqs[nextLevel];
    if (!reqTechId) return true; // Level doesn't have a gate
    return researchedTechs.includes(reqTechId);
  };

  const adjustDeckSpan = (field: 'startDeck' | 'endDeck', delta: number) => {
    const current = comp[field] ?? 0;
    const newVal = Math.max(0, Math.min(deckCount - 1, current + delta));
    updateField(field, newVal);
  };

  const totalDeckHeight = engine.draftHull ? shipHull.decks.slice(Math.min(comp.startDeck, comp.endDeck), Math.max(comp.startDeck, comp.endDeck) + 1).reduce((acc: number, d: any) => acc + (d.height || 5), 0) : 0;
  const intermediateDecksHeight = engine.draftHull && Math.abs(comp.endDeck - comp.startDeck) > 1 
    ? shipHull.decks.slice(Math.min(comp.startDeck, comp.endDeck) + 1, Math.max(comp.startDeck, comp.endDeck)).reduce((acc: number, d: any) => acc + (d.height || 5), 0) 
    : 0;

  const strengthBonus = comp.personalHeight ? Math.max(0, (totalDeckHeight - comp.personalHeight) / totalDeckHeight) : 0;

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      <div className="text-[8px] opacity-40 uppercase font-black tracking-widest text-yellow-500/70">Compartment Config</div>
      <div className="p-2 bg-white/5 border border-white/10 rounded space-y-2">
        <div className="text-yellow-400 uppercase font-black text-[11px] mb-1">{COMPARTMENT_LABELS[comp.type] || comp.type}</div>
        
        <div className="space-y-1 border-t border-white/5 pt-1.5 mt-1.5">
          <div className="flex justify-between items-center text-[9px]">
            <span className="opacity-50">Volume:</span>
            <span className="text-blue-300 font-bold">{(engine && engine.draftHull ? getCompartmentVolume(comp, shipHull.decks) : 0).toFixed(1)} m³</span>
          </div>
          <div className="flex justify-between items-center text-[9px]">
            <span className="opacity-50">Height Span:</span>
            <span className="text-white/80">{totalDeckHeight.toFixed(1)}m</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1.5 border-t border-white/5">
           <div className="flex justify-between items-center text-[9px]">
              <span className="opacity-70">Personal Height</span>
              <div className="flex items-center gap-1">
                 <button className="w-5 h-5 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded" onClick={() => updateField('personalHeight', Math.max(intermediateDecksHeight + 0.1, (comp.personalHeight || totalDeckHeight) - 0.5))}>−</button>
                 <span className="w-12 text-center font-bold text-yellow-200">{(comp.personalHeight || totalDeckHeight).toFixed(1)}m</span>
                 <button className="w-5 h-5 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded" onClick={() => updateField('personalHeight', Math.min(totalDeckHeight, (comp.personalHeight || totalDeckHeight) + 0.5))}>+</button>
              </div>
           </div>
           
           {comp.personalHeight && comp.personalHeight < totalDeckHeight - 0.01 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[8px] opacity-60 font-medium">
                   <span>Смещение от палубы</span>
                   <span className="text-blue-300 font-bold tracking-tight">
                      {((comp.relativeHeight || 0) * (totalDeckHeight - comp.personalHeight)).toFixed(2)}м
                   </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                  value={comp.relativeHeight || 0} 
                  onChange={(e) => updateField('relativeHeight', parseFloat(e.target.value))}
                />
              </div>
           )}

           {strengthBonus > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 p-1 rounded text-[8px] flex justify-between items-center">
                 <span className="text-green-400 font-bold uppercase tracking-tighter">Strength Bonus</span>
                 <span className="text-green-300">+{Math.round(strengthBonus * 100)}%</span>
              </div>
           )}
        </div>

        <div className="space-y-1.5 pt-1.5 border-t border-white/5">
          <div className="flex items-center justify-between gap-1 text-[9px]">
            <span className="opacity-50">Start Deck:</span>
            <div className="flex items-center gap-0.5">
              <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => adjustDeckSpan('startDeck', -1)}>−</button>
              <span className="w-6 text-center text-blue-300">{comp.startDeck}</span>
              <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => adjustDeckSpan('startDeck', 1)}>+</button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 text-[9px]">
            <span className="opacity-50">End Deck:</span>
            <div className="flex items-center gap-0.5">
              <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => adjustDeckSpan('endDeck', -1)}>−</button>
              <span className="w-6 text-center text-blue-300">{comp.endDeck}</span>
              <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => adjustDeckSpan('endDeck', 1)}>+</button>
            </div>
          </div>
        </div>
      </div>

      {comp.type === 'WEAPON' && comp.turretConfig && (
        <div className="space-y-1 text-[9px] mb-2">
           <div className="flex justify-between items-center bg-white/5 p-1 rounded">
            <span>Upgrade Level:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('turretConfig', Math.max(0, (comp.turretConfig?.level || 0) - 1), 'level')}>−</button>
              <span className="w-8 text-center text-red-300 font-bold">{comp.turretConfig?.level || 0}</span>
              <button 
                disabled={!isUpgradeUnlocked('WEAPON', (comp.turretConfig?.level || 0) + 1)}
                className={`px-1 rounded ${isUpgradeUnlocked('WEAPON', (comp.turretConfig?.level || 0) + 1) ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 opacity-50 cursor-not-allowed'}`}
                onClick={() => updateField('turretConfig', Math.min(2, (comp.turretConfig?.level || 0) + 1), 'level')}
              >+</button>
            </div>
          </div>
        </div>
      )}

      {(comp.type === 'WEAPON' || comp.type === 'MINING') && (comp.turretConfig || comp.miningConfig) && (
        <TurretConfigPanel comp={comp} px={px} updateField={updateField} setEditorMode={setEditorMode} engine={engine} />
      )}

      {comp.type === 'REACTOR' && comp.reactorConfig && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Reactor</div>
          <div className="flex justify-between items-center bg-white/5 p-1 rounded">
            <span>Upgrade Level:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('reactorConfig', Math.max(0, (comp.reactorConfig?.level || 0) - 1), 'level')}>−</button>
              <span className="w-8 text-center text-yellow-300 font-bold">{comp.reactorConfig?.level || 0}</span>
              <button 
                disabled={!isUpgradeUnlocked('REACTOR', (comp.reactorConfig?.level || 0) + 1)}
                className={`px-1 rounded ${isUpgradeUnlocked('REACTOR', (comp.reactorConfig?.level || 0) + 1) ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 opacity-50 cursor-not-allowed'}`}
                onClick={() => updateField('reactorConfig', Math.min(2, (comp.reactorConfig?.level || 0) + 1), 'level')}
              >+</button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Power Output:</span>
            <span className="text-yellow-400 font-bold">{(engine && engine.draftHull ? getReactorPower(engine.draftHull) : 0).toFixed(0)} MW</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Efficiency:</span>
            <span className="text-blue-300">{(comp.reactorConfig.fuelEfficiency * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {comp.type === 'ENGINE' && comp.engineConfig && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Engine</div>
          <div className="flex justify-between items-center bg-white/5 p-1 rounded">
            <span>Upgrade Level:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('engineConfig', Math.max(0, (comp.engineConfig?.level || 0) - 1), 'level')}>−</button>
              <span className="w-8 text-center text-cyan-300 font-bold">{comp.engineConfig?.level || 0}</span>
              <button 
                disabled={!isUpgradeUnlocked('ENGINE', (comp.engineConfig?.level || 0) + 1)}
                className={`px-1 rounded ${isUpgradeUnlocked('ENGINE', (comp.engineConfig?.level || 0) + 1) ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 opacity-50 cursor-not-allowed'}`}
                onClick={() => updateField('engineConfig', Math.min(2, (comp.engineConfig?.level || 0) + 1), 'level')}
              >+</button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Thrust:</span>
            <span className="text-cyan-400 font-bold">{(engine && engine.draftHull ? getEngineThrust(engine.draftHull) / 1000000 : 0).toFixed(1)} MN</span>
          </div>
        </div>
      )}

      {comp.type === 'GYRO' && comp.gyroConfig && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Gyro Array</div>
          <div className="flex justify-between items-center">
            <span>Turn Bonus:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('gyroConfig', Math.max(0.05, (comp.gyroConfig.turnBonus || 0.3) - 0.05), 'turnBonus')}>−</button>
              <span className="w-12 text-center">+{((comp.gyroConfig.turnBonus || 0.3) * 100).toFixed(0)}%</span>
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('gyroConfig', (comp.gyroConfig.turnBonus || 0.3) + 0.05, 'turnBonus')}>+</button>
            </div>
          </div>
        </div>
      )}

      {comp.type === 'MACHINERY' && comp.machineryConfig && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Machinery</div>
          <div className="flex justify-between items-center">
            <span>Repair Rate:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('machineryConfig', Math.max(0.1, (comp.machineryConfig.repairRate || 1) - 0.1), 'repairRate')}>−</button>
              <span className="w-10 text-center">{(comp.machineryConfig.repairRate || 1).toFixed(1)}/s</span>
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('machineryConfig', (comp.machineryConfig.repairRate || 1) + 0.1, 'repairRate')}>+</button>
            </div>
          </div>
        </div>
      )}

      {comp.type === 'FABRIC' && comp.fabricConfig && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Fabricator</div>
          <div className="flex justify-between items-center">
            <span>Hull Pool:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('fabricConfig', Math.max(10, (comp.fabricConfig.hullPool || 50) - 10), 'hullPool')}>−</button>
              <span className="w-8 text-center">{comp.fabricConfig.hullPool || 50}</span>
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('fabricConfig', (comp.fabricConfig.hullPool || 50) + 10, 'hullPool')}>+</button>
            </div>
          </div>
        </div>
      )}

      {comp.type === 'CARGO' && (
        <div className="space-y-1 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Cargo Bay</div>
          <div className="flex justify-between items-center">
            <span>Upgrade Level:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('cargoConfig', Math.max(0, (comp.cargoConfig?.level || 0) - 1), 'level')}>−</button>
              <span className="w-8 text-center">{comp.cargoConfig?.level || 0}</span>
              <button 
                disabled={!isUpgradeUnlocked('CARGO', (comp.cargoConfig?.level || 0) + 1)}
                className={`px-1 rounded ${isUpgradeUnlocked('CARGO', (comp.cargoConfig?.level || 0) + 1) ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 opacity-50 cursor-not-allowed'}`}
                onClick={() => updateField('cargoConfig', Math.min(2, (comp.cargoConfig?.level || 0) + 1), 'level')}
              >+</button>
            </div>
          </div>
          <div className="text-[7px] text-gray-400 italic">
            Level {comp.cargoConfig?.level || 0} efficiency: {((1 + (comp.cargoConfig?.level || 0) * 0.2) * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {comp.type === 'MINING' && (
        <div className="space-y-1.5 text-[9px]">
          <div className="text-[8px] opacity-40 uppercase">Mining Bay</div>
          
          <div className="flex justify-between items-center bg-white/5 p-1 rounded">
            <span>Upgrade Level:</span>
            <div className="flex items-center gap-1">
              <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField('miningConfig', Math.max(0, (comp.miningConfig?.level || 0) - 1), 'level')}>−</button>
              <span className="w-8 text-center text-blue-300 font-bold">{comp.miningConfig?.level || 0}</span>
              <button 
                disabled={!isUpgradeUnlocked('MINING', (comp.miningConfig?.level || 0) + 1)}
                className={`px-1 rounded ${isUpgradeUnlocked('MINING', (comp.miningConfig?.level || 0) + 1) ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/20 text-red-500 opacity-50 cursor-not-allowed'}`}
                onClick={() => updateField('miningConfig', Math.min(5, (comp.miningConfig?.level || 0) + 1), 'level')}
              >+</button>
            </div>
          </div>
        </div>
      )}

      {comp.type === 'BRIDGE' && (
        <div className="text-[9px] text-gray-400 p-1.5 bg-white/5 border border-white/10">
          Bridge — command center. Required for navigation and warp operations.
        </div>
      )}

      {comp.type === 'WARP_ENGINE' && (
        <div className="text-[9px] text-gray-400 p-1.5 bg-white/5 border border-white/10">
          Warp Drive — enables warp jump. Hold Tab for warp thrust in local space.
        </div>
      )}

      {editorMode === 'EDIT_COMPARTMENTS' && activeCompartmentVertex !== null && (
        <div className="p-1.5 bg-white/5 border border-white/10 text-[9px] text-blue-300 space-y-1">
          <div>Vertex {activeCompartmentVertex} selected</div>
          <button
            className={`w-full ${px} bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400`}
            onClick={() => {
              if (activeCompartmentVertex === null) return;
              const c = engine.deleteCompartmentVertex(comp.id, activeCompartmentVertex);
              if (!c) return;
              engine.setActiveCompartmentVertex(null);
              engine.setActiveCompartment(c);
              checkValidation(engine.draftHull);
              updateField('points', c.points);
            }}
          >✕ DELETE VERTEX</button>
        </div>
      )}

      <button
        className={`w-full ${px} bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400 mt-2`}
        onClick={onDelete}
      >Delete Compartment</button>
    </div>
  );
};

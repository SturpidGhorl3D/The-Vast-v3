'use client';

import React, { useState } from 'react';
import type { ViewMode } from '@/components/game/types';

interface HUDProps {
  isMobile: boolean;
  isLandscape: boolean;
  hudOpen: boolean;
  setHudOpen: (open: boolean) => void;
  currentSystem: any;
  visited: Set<string>;
  scanned: Set<string>;
  onScanSystem: () => void;
  maxCapacity: number;
  resources: Record<string, number>;
  warpTarget: any;
  cooldownLeft: number;
  viewMode: ViewMode;
  onToggleMap: () => void;
  onCycleView: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  internalView: boolean;
  onToggleInternalView: () => void;
  onOpenEditor: () => void;
  onPause: () => void;
  isPaused: boolean;
  interactionMode: string;
  setInteractionMode: (m: any) => void;
  movementMode: string;
  setMovementMode: (m: any) => void;
  tacticalClickMode: string;
  setTacticalClickMode: (m: any) => void;
  tacticalRoute: any[];
  setTacticalRoute: (r: any[]) => void;
  hasCommunication: boolean;
  factions: any[];
  nearbyFactions?: string[];
  isGravityWellActive: boolean;
  followTarget?: any | null;
  orbitTarget?: any | null;
  onLeaveOrbit: () => void;
  playerPos?: { sectorX: bigint; sectorY: bigint; offsetX: number; offsetY: number } | null;
}

export default function HUD({
  isMobile,
  isLandscape,
  hudOpen,
  setHudOpen,
  currentSystem,
  visited,
  scanned,
  onScanSystem,
  maxCapacity,
  resources,
  warpTarget,
  cooldownLeft,
  viewMode,
  onToggleMap,
  onCycleView,
  onSetViewMode,
  internalView,
  onToggleInternalView,
  onOpenEditor,
  onPause,
  isPaused,
  interactionMode,
  setInteractionMode,
  movementMode,
  setMovementMode,
  tacticalClickMode,
  setTacticalClickMode,
  tacticalRoute,
  setTacticalRoute,
  hasCommunication,
  factions,
  nearbyFactions = [],
  isGravityWellActive,
  followTarget,
  orbitTarget,
  onLeaveOrbit,
  playerPos,
}: HUDProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'modes' | 'fab' | 'diplomacy' | 'tech'>('status');
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);

  const viewLabel = viewMode === 'LOCAL' ? 'ЛОКАЛЬНЫЙ' : viewMode === 'TACTICAL' ? 'ТАКТИЧЕСКИЙ' : 'СТРАТЕГИЧЕСКИЙ';
  const nextViewLabel = viewMode === 'LOCAL' ? '→ ТАКТИЧЕСКИЙ' : viewMode === 'TACTICAL' ? '→ СТРАТЕГИЧЕСКИЙ' : '→ ЛОКАЛЬНЫЙ';

  const tabCls = (t: string) =>
    `flex-1 py-1 text-[8px] uppercase tracking-widest border-b-2 transition-colors ${
      activeTab === t
        ? 'border-cyan-400 text-cyan-300'
        : 'border-transparent text-white/30 hover:text-white/60'
    }`;

  return (
    <>
      {/* ── Sliding side panel toggle button ── */}
      <div className="absolute top-2 left-2 z-20 flex gap-1">
        <button
          className={`flex items-center gap-1 px-2 py-1.5 bg-black/80 border border-white/20 text-white font-mono text-[9px] uppercase tracking-widest hover:bg-white/10 active:bg-white/20 transition-colors select-none`}
          onClick={() => setHudOpen(!hudOpen)}
        >
          <span className="text-orange-400 font-bold text-[11px]">☰</span>
          {!isMobile && <span className="text-[8px] opacity-60">PANEL</span>}
        </button>

        {isGravityWellActive && tacticalRoute.length === 0 && (
          <button
            className={`flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-200 font-mono text-[9px] uppercase tracking-widest hover:bg-red-600/40 active:scale-95 transition-all shadow-lg`}
            onClick={onLeaveOrbit}
           title="Normalize movement / Exit local coordinates">
            <span className="text-red-400">⚡</span>
            <span>НОРМАЛИЗАЦИЯ ДВИЖЕНИЯ</span>
          </button>
        )}

        {(followTarget || orbitTarget || tacticalRoute.length > 0) && (
          <div className="flex flex-col gap-1">
            {(followTarget || orbitTarget) && (
              <div className={`flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-200 font-mono text-[9px] uppercase tracking-widest shadow-lg animate-pulse`}>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                <span>{followTarget ? 'СОПРОВОЖДЕНИЕ' : 'ОРБИТАЛЬНЫЙ ЗАХВАТ'}</span>
              </div>
            )}
            {tacticalRoute.length > 0 && (
              <button
                className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[8px] uppercase tracking-[0.2em] transition-all flex items-center gap-2"
                onClick={onLeaveOrbit}
              >
                <span className="text-red-500 font-bold">×</span>
                ОТСЕЧЬ КУРС
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sliding side panel ── */}
      <div
        className={`absolute top-0 left-0 h-full z-30 flex flex-col bg-black/92 border-r border-white/15 font-mono text-white transition-transform duration-200 ease-in-out ${
          hudOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isMobile ? 'w-52' : 'w-60'}`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div>
            <div className="text-orange-400 font-bold tracking-tight text-sm">THE VAST</div>
            <div className="text-[7px] opacity-30 uppercase tracking-widest">Prototype v0.1</div>
          </div>
          <button
            className="text-white/40 hover:text-white text-xs px-1"
            onClick={() => setHudOpen(false)}
          >✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/10">
          <button className={tabCls('status')} onClick={() => setActiveTab('status')}>Status</button>
          <button className={tabCls('modes')} onClick={() => setActiveTab('modes')}>Modes</button>
          <button className={tabCls('fab')} onClick={() => setActiveTab('fab')}>Fab</button>
          <button className={tabCls('tech')} onClick={() => setActiveTab('tech')}>Tech</button>
          {hasCommunication && (
            <button className={tabCls('diplomacy')} onClick={() => setActiveTab('diplomacy')}>Dipl</button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">

          {/* STATUS TAB */}
          {activeTab === 'status' && (
            <>
              {/* System */}
              <div>
                <div className="text-[7px] opacity-40 uppercase tracking-widest mb-0.5">Местоположение</div>
                <div className="text-[9px] text-blue-300">{currentSystem ? currentSystem.name : 'ГЛУБОКИЙ КОСМОС'}</div>
                <div className="text-[8px] opacity-50">Обзор: {viewLabel}</div>
              </div>

              {/* Resources */}
              <div>
                <div className="flex justify-between items-end mb-1">
                  <div className="text-[7px] opacity-40 uppercase tracking-widest">Ресурсы</div>
                  {maxCapacity > 0 && (
                    <div className="text-[7px] text-blue-300/60 uppercase tracking-widest">
                      {Math.floor(Object.entries(resources).filter(([k, v]) => typeof v === 'number').reduce((acc, [_, v]) => acc + (v as number), 0))} / {maxCapacity} т
                    </div>
                  )}
                </div>
                
                {maxCapacity > 0 && (
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (Object.entries(resources).filter(([k, v]) => typeof v === 'number').reduce((acc, [_, v]) => acc + (v as number), 0)) / maxCapacity * 100)}%` 
                      }}
                    />
                  </div>
                )}

                <div className="space-y-0.5">
                  {Object.entries(resources)
                    .filter(([id, amount]) => id !== 'maxCapacity' && typeof amount === 'number' && amount > 0.01)
                    .map(([id, amount]) => (
                      <div key={id} className="flex justify-between text-[9px]">
                        <span className="opacity-60">{id.charAt(0) + id.slice(1).toLowerCase()}</span>
                        <span className="text-blue-300">{Math.floor(amount as number)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Warp status */}
              <div>
                <div className="text-[7px] opacity-40 uppercase tracking-widest mb-0.5">Варп-двигатель</div>
                {cooldownLeft > 0 ? (
                  <div className="text-yellow-400 text-[9px]">Перезарядка: {cooldownLeft}с</div>
                ) : warpTarget ? (
                  <div className="text-cyan-400 text-[9px] truncate">→ {warpTarget.name ?? 'ПУТЕВАЯ ТОЧКА'}</div>
                ) : (
                  <div className="text-white/30 text-[9px]">
                    {viewMode === 'STRATEGIC' ? 'Выберите цель на карте' : 'Откройте стратегическую карту'}
                  </div>
                )}
              </div>

              {/* Keyboard hints */}
              {!isMobile && (
                <div className="text-[7px] opacity-30 border-t border-white/10 pt-2">
                  WASD · Q/E rotate · Scroll zoom<br/>
                  Tab = warp thrust · Space = jump<br/>
                  G = cycle view
                </div>
              )}
            </>
          )}

          {/* MODES TAB */}
          {activeTab === 'modes' && (
            <>
              {/* View mode */}
              <div>
                <div className="text-[7px] opacity-40 uppercase tracking-widest mb-1">Режим Обзора</div>
                <div className="flex flex-col gap-1">
                  {(['LOCAL', 'TACTICAL', 'STRATEGIC'] as ViewMode[]).map(m => (
                    <button
                      key={m}
                      className={`px-2 py-1 text-[9px] border transition-colors ${
                        viewMode === m
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                      }`}
                      onClick={() => { onSetViewMode(m); setHudOpen(false); }}
                    >
                      {m === 'LOCAL' ? '◎ ЛОКАЛЬНЫЙ (ближний бой)' : m === 'TACTICAL' ? '◉ ТАКТИЧЕСКИЙ (система)' : '○ СТРАТЕГИЧЕСКИЙ (карта звезд)'}
                    </button>
                  ))}
                </div>
                <div className="text-[7px] opacity-30 mt-1">Нажмите G для переключения</div>
              </div>

              {/* Movement mode */}
              <div>
                <div className="text-[7px] opacity-40 uppercase tracking-widest mb-1">Movement Mode</div>
                <div className="flex gap-1">
                  {['MANUAL', 'TACTICAL'].map(m => (
                    <button
                      key={m}
                      className={`flex-1 px-1 py-1 text-[9px] border transition-colors ${
                        movementMode === m
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'
                      }`}
                      onClick={() => setMovementMode(m)}
                    >
                      {m === 'MANUAL' ? '✦ Manual' : '⬡ Tactical'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interaction mode */}
              <div>
                <div className="text-[7px] opacity-40 uppercase tracking-widest mb-1">Action Mode</div>
                <div className="flex flex-col gap-1">
                  {[
                    { key: 'NONE', label: '— Idle', color: 'white/30' },
                    { key: 'MINING', label: '⛏ Mining', color: 'cyan-400' },
                    { key: 'COMBAT', label: '⚔ Combat', color: 'red-400' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <button
                        className={`px-2 py-1 text-[9px] border transition-colors ${
                          interactionMode === key
                            ? `bg-${color.split('-')[0]}-500/20 border-${color.split('-')[0]}-500/50 text-${color}`
                            : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'
                        }`}
                        onClick={() => setInteractionMode(key)}
                      >
                        {label}
                      </button>
                      {key === 'COMBAT' && interactionMode === 'COMBAT' && (
                        <button
                          className="px-2 py-1 text-[8px] bg-red-900/20 border border-red-500/30 text-red-200 hover:bg-red-900/40 transition-colors uppercase tracking-widest mt-1"
                          onClick={() => {
                            (window as any).openTargetingWindow?.();
                            setHudOpen(false);
                          }}
                        >
                          ⊹ Целеуказание
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* FABRICATION TAB - Now just a hint to open the window */}
          {activeTab === 'fab' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                <div className="text-blue-300 text-[10px] font-bold mb-1 uppercase tracking-wider">Production Module</div>
                <div className="text-white/60 text-[9px] leading-relaxed">
                  Access advanced fabrication systems via the dedicated production interface.
                </div>
              </div>
              <button
                className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-200 text-[10px] uppercase tracking-widest transition-all"
                onClick={() => {
                  (window as any).openProductionWindow?.();
                  setHudOpen(false);
                }}
              >
                Open Production Interface
              </button>
              <div className="text-[7px] opacity-30 italic">
                Requires FABRIC compartment to be operational.
              </div>
            </div>
          )}

          {/* TECHNOLOGY TAB */}
          {activeTab === 'tech' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                <div className="text-purple-300 text-[10px] font-bold mb-1 uppercase tracking-wider">Technology Archive</div>
                <div className="text-white/60 text-[9px] leading-relaxed">
                  Access research and development systems.
                </div>
              </div>
              <button
                className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 text-[10px] uppercase tracking-widest transition-all"
                onClick={() => {
                  (window as any).openTechnologyWindow?.();
                  setHudOpen(false);
                }}
              >
                Open Technology Matrix
              </button>
              <div className="text-[7px] opacity-30 italic">
                Available capabilities depend on organizational structure.
              </div>
            </div>
          )}

          {/* DIPLOMACY TAB */}
          {activeTab === 'diplomacy' && hasCommunication && (
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">Diplomatic Relations</div>
              
              <div className="space-y-2">
                {factions.filter(f => !f.isPlayer && f.discoveredByPlayer).map(faction => (
                  <div key={faction.id} 
                    className={`p-2 border bg-white/5 rounded transition-all cursor-pointer ${selectedFactionId === faction.id ? 'border-blue-500/50' : 'border-white/10 hover:border-white/30'}`}
                    onClick={() => setSelectedFactionId(selectedFactionId === faction.id ? null : faction.id)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-white" style={{ color: faction.color }}>{faction.name}</span>
                      <span className={`text-[8px] uppercase tracking-widest ${faction.relationToPlayer === 'HOSTILE' ? 'text-red-400' : faction.relationToPlayer === 'FRIENDLY' ? 'text-green-400' : 'text-yellow-400'}`}>{faction.relationToPlayer}</span>
                    </div>
                    <div className="text-[8px] text-white/50 leading-tight">
                      {faction.description || 'No data available about this faction.'}
                    </div>
                    
                    {selectedFactionId === faction.id && faction.ideology && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                        <div className="text-[8px] font-bold text-blue-300">IDEOLOGICAL PROFILE</div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[7px] text-white/70">
                          <div className="flex justify-between"><span>Defense</span><span>Aggression</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-blue-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.foreignPolicy) * 50}%`, marginLeft: faction.ideology.foreignPolicy < 0 ? `-${Math.abs(faction.ideology.foreignPolicy) * 50}%` : 0 }}></div></div>
                          
                          <div className="flex justify-between"><span>Material</span><span>Spiritual</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-purple-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.values) * 50}%`, marginLeft: faction.ideology.values < 0 ? `-${Math.abs(faction.ideology.values) * 50}%` : 0 }}></div></div>

                          <div className="flex justify-between"><span>Xenophobe</span><span>Xenophile</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-green-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.aliens) * 50}%`, marginLeft: faction.ideology.aliens < 0 ? `-${Math.abs(faction.ideology.aliens) * 50}%` : 0 }}></div></div>

                          <div className="flex justify-between"><span>Liberal</span><span>Auth</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-red-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.power) * 50}%`, marginLeft: faction.ideology.power < 0 ? `-${Math.abs(faction.ideology.power) * 50}%` : 0 }}></div></div>
                          
                          <div className="flex justify-between"><span>Pluralism</span><span>Elitism</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-yellow-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.social) * 50}%`, marginLeft: faction.ideology.social < 0 ? `-${Math.abs(faction.ideology.social) * 50}%` : 0 }}></div></div>

                          <div className="flex justify-between"><span>Coop</span><span>Compet</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-orange-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.economy) * 50}%`, marginLeft: faction.ideology.economy < 0 ? `-${Math.abs(faction.ideology.economy) * 50}%` : 0 }}></div></div>
                          
                          <div className="flex justify-between"><span>Coexist</span><span>Selfish</span></div>
                          <div className="h-1 bg-white/10 w-full mt-1 relative"><div className="absolute top-0 bottom-0 bg-teal-400" style={{ left: '50%', width: `${Math.abs(faction.ideology.ecology) * 50}%`, marginLeft: faction.ideology.ecology < 0 ? `-${Math.abs(faction.ideology.ecology) * 50}%` : 0 }}></div></div>
                        </div>

                        {faction.perks && faction.perks.length > 0 && (
                          <div className="mt-2 text-[7px]">
                            <div className="font-bold text-blue-300 mb-1">FACTION TRAITS</div>
                            {faction.perks.map((perk: any) => (
                              <div key={perk.id} className="mb-1">
                                <span className={perk.isPositive ? "text-green-300 font-bold" : "text-red-300 font-bold"}>{perk.name}: </span>
                                <span className="text-white/60">{perk.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {nearbyFactions.includes(faction.id) && (
                      <button 
                        className="mt-2 w-full px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 text-[8px] uppercase tracking-wider text-blue-200 transition-colors rounded"
                        onClick={(e) => { e.stopPropagation(); alert(`Канал связи с ${faction.name} открыт (Функционал в разработке)`); }}
                      >
                        ОТКРЫТЬ КАНАЛ СВЯЗИ
                      </button>
                    )}
                  </div>
                ))}
                {factions.filter(f => !f.isPlayer && f.discoveredByPlayer).length === 0 && (
                  <div className="text-[9px] text-white/30 italic">No external factions discovered yet.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="border-t border-white/10 px-3 py-2 space-y-1.5">
          <button
            className="w-full px-2 py-1.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/40 text-[9px] uppercase tracking-wide text-blue-300 transition-colors"
            onClick={() => { onCycleView(); setHudOpen(false); }}
          >
            {nextViewLabel}
          </button>
          <button
            className={`w-full px-2 py-1.5 border text-[9px] uppercase tracking-wide transition-colors ${
              internalView
                ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                : 'bg-white/5 border-white/15 text-white/50 hover:bg-white/10'
            }`}
            onClick={() => { onToggleInternalView(); setHudOpen(false); }}
          >
            {internalView ? '◈ EXTERNAL VIEW' : '◇ INTERNAL VIEW'}
          </button>
          <button
            className="w-full px-2 py-1.5 bg-green-500/15 hover:bg-green-500/30 border border-green-500/40 text-[9px] uppercase tracking-wide text-green-300 transition-colors"
            onClick={() => { onOpenEditor(); setHudOpen(false); }}
          >
            ✦ SHIP EDITOR
          </button>
        </div>
      </div>

      {/* ── Backdrop to close panel on click-outside — blocks UI beneath when open ── */}
      {hudOpen && (
        <div
          className="absolute inset-0 z-[29]"
          onClick={() => setHudOpen(false)}
        />
      )}

      {/* Pause button — mobile only, top-right */}
      {isMobile && (
        <button
          className="absolute top-2 right-2 z-20 w-9 h-9 flex items-center justify-center bg-black/70 border border-white/20 text-white text-sm active:bg-white/20"
          onClick={onPause}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      )}

      {/* System detected panel — bottom-center */}
      {currentSystem && viewMode === 'LOCAL' && (() => {
        let distanceStr = '';
        let isInGravisphere = true;
        if (playerPos) {
          const secSizeBI = BigInt(10_000_000_000); // SECTOR_SIZE_M
          const dx = (BigInt(currentSystem.sectorX) - playerPos.sectorX) * secSizeBI + BigInt(Math.floor(currentSystem.offsetX - playerPos.offsetX));
          const dy = (BigInt(currentSystem.sectorY) - playerPos.sectorY) * secSizeBI + BigInt(Math.floor(currentSystem.offsetY - playerPos.offsetY));
          const distM = Math.sqrt(Number(dx * dx + dy * dy));
          
          isInGravisphere = distM <= (currentSystem.gravisphereRadius || 1.8e13);
          
          if (distM > 1.496e11 * 1000) { // > 1000 AU
            distanceStr = `${(distM / 9.46e15).toFixed(3)} СВ. ЛЕТ`;
          } else {
            distanceStr = `${(distM / 1.496e11).toFixed(2)} A.Е.`;
          }
        }

        return (
          <div className={`absolute ${isMobile ? 'bottom-20' : 'bottom-8'} left-1/2 -translate-x-1/2 p-2 bg-black/80 border border-white/20 text-white font-mono text-xs text-center shadow-xl flex flex-col gap-1 items-center z-20`}>
            <div className="flex flex-col items-center">
              <div className="text-blue-400 text-[10px] font-bold tracking-widest flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isInGravisphere ? 'bg-blue-400 animate-pulse' : 'bg-blue-900'}`} />
                {currentSystem.name.toUpperCase()}
              </div>
              {distanceStr && (
                <div className="text-[9px] text-white/60 font-medium">{distanceStr}</div>
              )}
            </div>
            
            <div className="text-[7px] opacity-40 uppercase tracking-widest">
              {isInGravisphere ? (currentSystem.planets?.length ?? 0) + ' ПЛАНЕТ ОБНАРУЖЕНО' : 'ГРАНИЦА ГРАВИСФЕРЫ'}
            </div>
            
            {!scanned.has(currentSystem.id) && (
              <button
                className="mt-1 px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-[9px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                onClick={onScanSystem}
              >
                📡 СКАНИРОВАТЬ СИСТЕМУ
              </button>
            )}
            {scanned.has(currentSystem.id) && (
              <div className="text-[7px] text-green-400/60 uppercase tracking-widest mt-1">ОБЪЕКТ ИССЛЕДОВАН</div>
            )}
          </div>
        );
      })()}
    </>
  );
}

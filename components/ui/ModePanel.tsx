'use client';

import React, { useState } from 'react';
import type { InteractionMode, MovementMode, ViewMode, TacticalWaypoint } from '@/components/game/types';

interface ModePanelProps {
  isMobile: boolean;
  interactionMode: InteractionMode;
  setInteractionMode: (m: InteractionMode) => void;
  movementMode: MovementMode;
  setMovementMode: (m: MovementMode) => void;
  secondaryActive: boolean;
  setSecondaryActive: (v: boolean) => void;
  defenceActive: boolean;
  setDefenceActive: (v: boolean) => void;
  mainActive: boolean;
  setMainActive: (v: boolean) => void;
  fireGroupSync: Record<string, boolean>;
  setFireGroupSync: (group: string, v: boolean) => void;
  fireGroupSemiAuto: Record<string, boolean>;
  setFireGroupSemiAuto: (group: string, v: boolean) => void;
  viewMode: ViewMode;
  tacticalClickMode: any;
  setTacticalClickMode: (m: any) => void;
  tacticalRoute?: TacticalWaypoint[];
  setTacticalRoute?: (r: TacticalWaypoint[]) => void;
}

export default function ModePanel({
  isMobile,
  interactionMode,
  setInteractionMode,
  movementMode,
  setMovementMode,
  secondaryActive,
  setSecondaryActive,
  defenceActive,
  setDefenceActive,
  mainActive,
  setMainActive,
  fireGroupSync,
  setFireGroupSync,
  fireGroupSemiAuto,
  setFireGroupSemiAuto,
  viewMode,
  tacticalClickMode,
  setTacticalClickMode,
  tacticalRoute = [],
  setTacticalRoute,
}: ModePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (viewMode !== 'LOCAL' && viewMode !== 'TACTICAL') return null;

  const px = isMobile ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]';

  const interactionColor: Record<InteractionMode, string> = {
    NONE:     'bg-white/10 border-white/20 text-white/50',
    MINING:   'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
    COMBAT:   'bg-red-500/20 border-red-500/50 text-red-300',
    WAYPOINT: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  };
  const movementColor: Record<MovementMode, string> = {
    MANUAL:   'bg-blue-500/20 border-blue-500/50 text-blue-300',
    TACTICAL: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  };

  return (
    <div
      className={`absolute ${isMobile ? 'bottom-[120px] right-2' : 'bottom-6 right-6'} z-20 font-mono select-none`}
    >
      <div className="flex flex-col items-end gap-1">

        {/* ── Expanded combat sub-panel ── */}
        {interactionMode === 'COMBAT' && expanded && (
          <div className={`bg-black/95 border border-red-500/30 p-2 space-y-2 rounded w-48 shadow-xl shadow-red-900/20`}>
            <div className={`text-[8px] text-red-400 font-bold uppercase tracking-[0.2em] border-b border-red-500/20 pb-1 flex justify-between`}>
              <span>Weapon Systems</span>
              <span className="text-white/40">v0.1</span>
            </div>

            {/* MAIN GROUP */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                 <button
                   className={`${px} border ${mainActive ? 'bg-red-600/30 border-red-500/70 text-red-200' : 'bg-white/5 border-white/20 text-white/40'} font-bold flex-1 mr-1 transition-colors`}
                   onClick={() => setMainActive(!mainActive)}
                 >
                   {mainActive ? '⬥ MAIN ON' : '◇ MAIN OFF'}
                 </button>
                 <div className="flex gap-0.5">
                    <button 
                      className={`${px} border ${fireGroupSync.MAIN ? 'border-red-400 text-red-200 bg-red-500/20' : 'border-white/10 text-white/30'} hover:border-red-400/50`}
                      title="Sync Salvo"
                      onClick={() => setFireGroupSync('MAIN', !fireGroupSync.MAIN)}
                    >
                      {fireGroupSync.MAIN ? '⚡' : '〰️'}
                    </button>
                    <button 
                      className={`${px} border ${fireGroupSemiAuto.MAIN ? 'border-red-400 text-red-200 bg-red-500/20' : 'border-white/10 text-white/30'} hover:border-red-400/50`}
                      title="Semi-Auto"
                      onClick={() => setFireGroupSemiAuto('MAIN', !fireGroupSemiAuto.MAIN)}
                    >
                      {fireGroupSemiAuto.MAIN ? 'A' : 'M'}
                    </button>
                 </div>
              </div>
            </div>

            {/* SECONDARY GROUP (Autonomous) */}
            <div className="flex items-center gap-1">
                <button
                  className={`flex-1 ${px} border ${secondaryActive ? 'bg-orange-500/30 border-orange-400/60 text-orange-200' : 'bg-white/5 border-white/20 text-white/40'} transition-colors text-left`}
                  onClick={() => setSecondaryActive(!secondaryActive)}
                >
                  {secondaryActive ? '● ' : '○ '}SECONDARY
                </button>
                <div className="flex gap-0.5">
                    <button 
                      className={`${px} border ${fireGroupSync.SECONDARY ? 'border-orange-400 text-orange-200 bg-orange-500/20' : 'border-white/10 text-white/30'}`}
                      title="Sync Salvo"
                      onClick={() => setFireGroupSync('SECONDARY', !fireGroupSync.SECONDARY)}
                    >
                      {fireGroupSync.SECONDARY ? '⚡' : '〰️'}
                    </button>
                    <div className={`${px} border border-white/5 text-white/20 grayscale opacity-50 cursor-not-allowed`} title="Always Autonomous">A</div>
                 </div>
            </div>

            {/* DEFENCE GROUP (Autonomous & Async) */}
            <div className="flex items-center gap-1">
                <button
                  className={`flex-1 ${px} border ${defenceActive ? 'bg-yellow-500/30 border-yellow-400/60 text-yellow-200' : 'bg-white/5 border-white/20 text-white/40'} transition-colors text-left`}
                  onClick={() => setDefenceActive(!defenceActive)}
                >
                  {defenceActive ? '● ' : '○ '}DEFENCE
                </button>
                <div className="flex gap-0.5">
                    <div className={`${px} border border-white/5 text-white/20 grayscale opacity-50 cursor-not-allowed`} title="Always Async">〰️</div>
                    <div className={`${px} border border-white/5 text-white/20 grayscale opacity-50 cursor-not-allowed`} title="Always Autonomous">A</div>
                 </div>
            </div>

            <div className={`text-[7px] text-white/40 leading-tight border-t border-white/10 pt-1 mt-1 font-mono italic`}>
              {fireGroupSemiAuto.MAIN ? 'Lock target / Fix angle' : 'Aim with Mouse / Click to Fire'}
            </div>
          </div>
        )}

        {/* ── Waypoint management (Only if active or has route) ── */}
        {tacticalRoute.length > 0 && setTacticalRoute && (
          <div className="flex gap-1 mb-1">
            <button
               className={`${px} border rounded bg-purple-900/40 border-purple-500/40 text-purple-300/60 hover:text-purple-200 uppercase tracking-widest`}
               onClick={() => { setTacticalRoute([]); setInteractionMode('NONE'); }}
            >
              ✕ ОЧИСТИТЬ {tacticalRoute.length} WPT
            </button>
          </div>
        )}

        {/* ── WPT toggle (Only in TACTICAL movement mode) ── */}
        {movementMode === 'TACTICAL' && (
          <div className="flex gap-1 mb-1">
             <button
              className={`${px} border rounded transition-colors flex-1 text-center ${interactionMode === 'WAYPOINT' ? interactionColor['WAYPOINT'] : 'bg-black/80 border-white/10 text-white/30'}`}
              onClick={() => {
                const next = interactionMode === 'WAYPOINT' ? 'NONE' : 'WAYPOINT';
                setInteractionMode(next);
                setExpanded(false);
                
                // Sync with tacticalClickMode
                if (next === 'WAYPOINT') setTacticalClickMode('WAYPOINT');
                else if (tacticalClickMode === 'WAYPOINT') setTacticalClickMode('NONE');
              }}
            >
              ⬡ WPT (ВЕЙПОИНТЫ)
            </button>
          </div>
        )}

        {/* ── Movement mode row ── */}
        <div className="flex gap-1">
          {(['MANUAL', 'TACTICAL'] as MovementMode[]).map(m => (
            <button
              key={m}
              className={`${px} border rounded transition-colors flex-1 text-center ${movementMode === m ? movementColor[m] : 'bg-white/5 border-white/10 text-white/30'}`}
              onClick={() => {
                setMovementMode(m);
                // When switching to tactical movement, default to idle interaction unless overridden
                if (m === 'TACTICAL' && interactionMode === 'NONE') {
                  // user might want waypoints by default in tactical? 
                }
              }}
            >
              {m === 'MANUAL' ? '✦ MANUAL' : '⬡ TACTICAL'}
            </button>
          ))}
        </div>

        {/* ── Interaction mode row ── */}
        <div className="flex gap-1">
          {(['NONE', 'MINING', 'COMBAT'] as InteractionMode[]).map(m => (
            <button
              key={m}
              className={`${px} border rounded transition-colors ${interactionMode === m ? interactionColor[m] : 'bg-black/60 border-white/10 text-white/30'}`}
              onClick={() => {
                setInteractionMode(m);
                if (m === 'COMBAT') setExpanded(true);
                else setExpanded(false);
                
                // If switching away from waypoints, disable click mode
                if (tacticalClickMode === 'WAYPOINT') setTacticalClickMode('NONE');
              }}
            >
              {m === 'NONE' ? '— IDLE' : m === 'MINING' ? '⛏ MINE' : '⚔ CMBT'}
            </button>
          ))}
        </div>

        {/* ── Combat expand toggle ── */}
        {interactionMode === 'COMBAT' && (
          <div className="flex gap-1 self-end">
             <button
                className={`flex-1 ${px} border border-teal-500/30 bg-black/60 text-teal-400/70 uppercase`}
                onClick={() => (window as any).openTargetingWindow?.()}
             >
                ◎ ЦЕЛЕУКАЗАНИЕ
             </button>
             <button
                className={`flex-1 ${px} border border-red-500/30 bg-black/60 text-red-400/70 uppercase`}
                onClick={() => setExpanded(v => !v)}
             >
                {expanded ? '▼ СКРЫТЬ' : '▲ ОРУЖИЕ'}
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

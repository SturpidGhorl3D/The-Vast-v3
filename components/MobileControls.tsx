import React from 'react';
import { WARP_COOLDOWN_MS } from '@/game/constants';
import type { ViewMode } from '@/components/game/types';

interface MobileControlsProps {
  isMobile: boolean;
  isLandscape: boolean;
  viewMode: ViewMode;
  movementMode: string;
  warpTarget: any;
  cooldownLeft: number;
  thrustActive: boolean;
  setThrustActive: (v: boolean) => void;
  engine: any;
  setWarpTarget: (target: any) => void;
  setWarpCooldownEnd: (end: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setHudOpen: (open: boolean) => void;
}

export default function MobileControls({
  isMobile,
  isLandscape,
  viewMode,
  movementMode,
  warpTarget,
  cooldownLeft,
  thrustActive,
  setThrustActive,
  engine,
  setWarpTarget,
  setWarpCooldownEnd,
  setViewMode,
  setHudOpen,
}: MobileControlsProps) {
  if (!isMobile || !engine) return null;

  // D-pad only shown in LOCAL + MANUAL movement mode
  const showDpad = viewMode === 'LOCAL' && movementMode === 'MANUAL';

  const dpadGrid = isLandscape ? 'w-24 h-24' : 'w-28 h-28';
  const dBtn = isLandscape
    ? 'flex items-center justify-center bg-black/60 border border-white/20 text-white text-base rounded active:bg-white/20 select-none'
    : 'flex items-center justify-center bg-black/60 border border-white/20 text-white text-lg rounded active:bg-white/20 select-none';
  const actionW = isLandscape ? 'w-16 h-8 text-[9px]' : 'w-20 h-9 text-[10px]';
  const rotBtn = isLandscape ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-base';

  return (
    <div
      className={`absolute left-0 right-0 flex justify-between items-end px-2 pointer-events-none z-20 ${isLandscape ? 'bottom-1' : 'bottom-3'}`}
    >
      {/* D-pad — only LOCAL + MANUAL */}
      <div className={`${dpadGrid}`}>
        {showDpad ? (
          <div className={`grid grid-cols-3 grid-rows-3 gap-0.5 w-full h-full pointer-events-auto`}>
            <div />
            <button
              className={dBtn}
              onPointerDown={() => engine.inputManager.keys.add('KeyW')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyW')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyW')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyW')}
            >▲</button>
            <div />
            <button
              className={dBtn}
              onPointerDown={() => engine.inputManager.keys.add('KeyA')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyA')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyA')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyA')}
            >◀</button>
            <div className="rounded bg-white/5 border border-white/10" />
            <button
              className={dBtn}
              onPointerDown={() => engine.inputManager.keys.add('KeyD')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyD')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyD')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyD')}
            >▶</button>
            <div />
            <button
              className={dBtn}
              onPointerDown={() => engine.inputManager.keys.add('KeyS')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyS')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyS')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyS')}
            >▼</button>
            <div />
          </div>
        ) : null}
      </div>

      {/* Right-side action buttons */}
      <div className="flex flex-col gap-1.5 items-end pointer-events-auto">
        {/* Warp JUMP */}
        {warpTarget && cooldownLeft === 0 && (
          <button
            className={`flex items-center justify-center bg-cyan-900/70 border border-cyan-400/60 text-cyan-200 font-mono rounded active:bg-cyan-500/40 select-none uppercase tracking-wide ${actionW}`}
            onClick={() => {
              const t = engine.warpTarget;
              if (!t) return;
              const now = Date.now();
              const p = engine.player;
              const ecs = engine.ecs;
              if (p !== null) {
                const pos = ecs.getPosition(p);
                const vel = ecs.getComponent(p, 'Velocity');
                if (pos && vel) {
                  pos.sectorX = t.sectorX;
                  pos.sectorY = t.sectorY;
                  pos.offsetX = t.offsetX;
                  pos.offsetY = t.offsetY;
                  vel.vx = 0; vel.vy = 0;
                  engine.camera.setPos(t);
                  engine.setMapPos({ ...t });
                  engine.camera.setZoom(5);
                  engine.camera.setTargetZoom(5);
                  engine.setWarpCooldownEndTime(now + WARP_COOLDOWN_MS);
                  engine.setWarpTarget(null);
                  setWarpTarget(null);
                  setWarpCooldownEnd(engine.warpCooldownEndTime);
                  setViewMode('LOCAL');
                  setHudOpen(false);
                }
              }
            }}
          >⚡ JUMP</button>
        )}
        {cooldownLeft > 0 && (
          <div className={`flex items-center justify-center bg-black/60 border border-yellow-500/40 text-yellow-400 font-mono rounded select-none ${actionW}`}>
            {cooldownLeft}s
          </div>
        )}
        {/* Map rotation — global or tactical view */}
        {(viewMode === 'STRATEGIC' || viewMode === 'TACTICAL') && (
          <div className="flex gap-1">
            <button
              className={`flex items-center justify-center bg-black/60 border border-white/20 text-white rounded active:bg-white/20 select-none ${rotBtn}`}
              onPointerDown={() => engine.inputManager.keys.add('KeyQ')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyQ')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyQ')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyQ')}
            >↺</button>
            <button
              className={`flex items-center justify-center bg-black/60 border border-white/20 text-white rounded active:bg-white/20 select-none ${rotBtn}`}
              onPointerDown={() => engine.inputManager.keys.add('KeyE')}
              onPointerUp={() => engine.inputManager.keys.delete('KeyE')}
              onPointerLeave={() => engine.inputManager.keys.delete('KeyE')}
              onPointerCancel={() => engine.inputManager.keys.delete('KeyE')}
            >↻</button>
          </div>
        )}
        {/* Thrust toggle — local view only */}
        {viewMode === 'LOCAL' && (
          <button
            className={`flex items-center justify-center border font-mono rounded select-none uppercase tracking-wide transition-colors ${actionW} ${thrustActive ? 'bg-purple-500/50 border-purple-300 text-purple-100' : 'bg-purple-900/60 border-purple-500/50 text-purple-200'}`}
            onClick={() => {
              const next = !thrustActive;
              setThrustActive(next);
              if (next) engine.inputManager.keys.add('Tab');
              else engine.inputManager.keys.delete('Tab');
            }}
          >⚡ {thrustActive ? 'ON' : 'THRUST'}</button>
        )}
      </div>
    </div>
  );
}

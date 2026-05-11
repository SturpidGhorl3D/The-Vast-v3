'use client';

import React, { useState, useEffect } from 'react';
import type { ShipBlueprint, ShipHull } from '@/components/game/types';

const STORAGE_KEY = 'thevast-blueprints';

function loadBlueprints(): ShipBlueprint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBlueprints(bps: ShipBlueprint[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bps)); } catch {}
}

interface BlueprintManagerProps {
  isMobile: boolean;
  currentHull: ShipHull;
  onLoad: (hull: ShipHull) => void;
  onClose: () => void;
}

export default function BlueprintManager({ isMobile, currentHull, onLoad, onClose }: BlueprintManagerProps) {
  const [blueprints, setBlueprints] = useState<ShipBlueprint[]>(() => {
    if (typeof window !== 'undefined') {
      return loadBlueprints();
    }
    return [];
  });
  const [saveName, setSaveName]     = useState('My Ship');

  useEffect(() => {
    // Initial load handled by useState initializer
  }, []);

  const handleSave = () => {
    const name = saveName.trim() || 'Unnamed Blueprint';
    const bp: ShipBlueprint = {
      id:      `bp-${Date.now()}`,
      name,
      savedAt: Date.now(),
      hull:    JSON.parse(JSON.stringify(currentHull)),
    };
    const next = [bp, ...blueprints].slice(0, 20); // keep at most 20
    setBlueprints(next);
    saveBlueprints(next);
    setSaveName('My Ship');
  };

  const handleDelete = (id: string) => {
    const next = blueprints.filter(b => b.id !== id);
    setBlueprints(next);
    saveBlueprints(next);
  };

  const px = isMobile ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-xs';
  const W  = isMobile ? 280 : 360;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-[75] font-mono pointer-events-auto">
      <div className="bg-[#050505] border border-white/20 rounded-lg overflow-hidden shadow-2xl"
           style={{ width: W, maxWidth: '95vw', maxHeight: '80vh' }}>
        <div className="flex justify-between items-center px-4 py-2 border-b border-white/10">
          <div className="text-blue-400 font-bold text-sm uppercase">Ship Blueprints</div>
          <button className="text-white/40 hover:text-white text-xs px-2" onClick={onClose}>✕</button>
        </div>

        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="text-[8px] text-white/40 uppercase">Save current design</div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-black border border-white/20 text-white text-[10px] px-2 py-1 outline-none focus:border-blue-500/60"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              maxLength={32}
              placeholder="Blueprint name..."
            />
            <button className={`${px} bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 shrink-0`} onClick={handleSave}>
              SAVE
            </button>
          </div>
        </div>

        <div className="p-2 overflow-y-auto" style={{ maxHeight: 280 }}>
          {blueprints.length === 0 && (
            <div className="text-white/30 text-[9px] text-center py-6">No blueprints saved yet.</div>
          )}
          {blueprints.map(bp => (
            <div key={bp.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-white/5 hover:bg-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white truncate">{bp.name}</div>
                <div className="text-[8px] text-white/30">
                  {bp.hull.decks.length}d · {bp.hull.compartments.length}c · {new Date(bp.savedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                className="px-2 py-0.5 text-[9px] bg-green-500/20 hover:bg-green-500/40 border border-green-500/40 text-green-300 shrink-0"
                onClick={() => { onLoad(JSON.parse(JSON.stringify(bp.hull))); onClose(); }}
              >LOAD</button>
              <button
                className="px-2 py-0.5 text-[9px] bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-400 shrink-0"
                onClick={() => handleDelete(bp.id)}
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

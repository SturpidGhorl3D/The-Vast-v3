import React, { useState } from 'react';
import type { GameSettings } from '@/components/game/types';
import { AudioSettingsOverlay } from './AudioSettingsOverlay';

interface PauseMenuProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  engine: any;
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  isMobile: boolean;
  onExit?: () => void;
}

export default function PauseMenu({
  isPaused,
  setIsPaused,
  engine,
  settings,
  setSettings,
  isMobile,
  onExit,
}: PauseMenuProps) {
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  if (!isPaused) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 font-mono">
      {showAudioSettings && <AudioSettingsOverlay onClose={() => setShowAudioSettings(false)} />}
      <div className={`bg-[#050505] ${isMobile ? 'p-4 w-72' : 'p-8 w-80'} border border-white/20 rounded-lg space-y-4`}>
        <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-blue-400 uppercase tracking-tighter`}>Система Паузы</div>
        
        <div className="flex flex-col gap-2">
          <button
            className={`w-full ${isMobile ? 'px-2 py-2 text-sm' : 'px-4 py-2'} bg-blue-600 hover:bg-blue-500 text-white transition-colors font-bold uppercase tracking-widest`}
            onClick={() => {
              setIsPaused(false);
            }}
          >
            Продолжить
          </button>
          
          <button
            className={`w-full ${isMobile ? 'px-2 py-2 text-sm' : 'px-4 py-2'} bg-orange-600 hover:bg-orange-500 text-white transition-colors font-bold uppercase tracking-widest`}
            onClick={() => setShowAudioSettings(true)}
          >
            Настройки Звука
          </button>

          <button
            className={`w-full ${isMobile ? 'px-2 py-2 text-sm' : 'px-4 py-2'} border border-white/20 hover:bg-white/10 text-white transition-colors font-bold uppercase tracking-widest`}
            onClick={() => {
              if (onExit) onExit();
              else window.location.reload();
            }}
          >
            В Главное Меню
          </button>
        </div>

        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="text-xs opacity-50 uppercase">Graphics</div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Dithering</span>
            <input
              type="checkbox"
              checked={settings.dithering}
              onChange={e => setSettings(s => ({ ...s, dithering: e.target.checked }))}
              className="w-4 h-4"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Vignette</span>
            <input
              type="checkbox"
              checked={settings.vignette}
              onChange={e => setSettings(s => ({ ...s, vignette: e.target.checked }))}
              className="w-4 h-4"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Asteroid Fields</span>
            <input
              type="checkbox"
              checked={settings.showAsteroidFields}
              onChange={e => setSettings(s => ({ ...s, showAsteroidFields: e.target.checked }))}
              className="w-4 h-4"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm">Grid</span>
            <select
              className="bg-black border border-white/20 text-white text-xs px-2 py-1"
              value={settings.gridMode}
              onChange={e =>
                setSettings(s => ({
                  ...s,
                  gridMode: e.target.value as GameSettings['gridMode'],
                }))
              }
            >
              <option value="OFF">OFF</option>
              <option value="10">10 m</option>
              <option value="100">100 m</option>
              <option value="1000">1 km</option>
            </select>
          </div>
        </div>

        <div className="border-t border-white/10 pt-2 text-[10px] opacity-40">
          WASD / D-pad to move · Scroll / pinch to zoom
        </div>
      </div>
    </div>
  );
}


import React from 'react';
import { ViewMode, GlobalCoords } from '@/components/game/types';

interface NavigationPanelProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  isWarping: boolean;
  warpCooldownEnd: number;
  warpTarget: (GlobalCoords & { name?: string }) | null;
  onWarp: () => void;
  onScan: () => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  viewMode,
  setViewMode,
  isWarping,
  warpCooldownEnd,
  warpTarget,
  onWarp,
  onScan
}) => {
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    setNow(Date.now());
    let interval: NodeJS.Timeout;
    if (warpTarget) {
      interval = setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [warpTarget, warpCooldownEnd]);

  const isWarpAvailable = warpTarget && now >= warpCooldownEnd;

  return (
    <div className="absolute top-20 right-4 flex flex-col gap-2 z-40 pointer-events-auto">
      <div className="flex bg-[#0a0f1a]/80 border border-blue-500/30 p-1 rounded-sm gap-1">
        <button 
          onClick={() => setViewMode('LOCAL')}
          className={`px-3 py-1 text-[10px] uppercase font-bold transition-all ${viewMode === 'LOCAL' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-blue-400 hover:bg-blue-500/20'}`}
        >
          LOCAL
        </button>
        <button 
          onClick={() => setViewMode('TACTICAL')}
          className={`px-3 py-1 text-[10px] uppercase font-bold transition-all ${viewMode === 'TACTICAL' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-blue-400 hover:bg-blue-500/20'}`}
        >
          TACTICAL
        </button>
        <button 
          onClick={() => setViewMode('STRATEGIC')}
          className={`px-3 py-1 text-[10px] uppercase font-bold transition-all ${viewMode === 'STRATEGIC' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-blue-400 hover:bg-blue-500/20'}`}
        >
          STRATEGIC
        </button>
      </div>

      {viewMode === 'STRATEGIC' && (
        <div className="flex flex-col gap-2">
            <button 
              onClick={onScan}
              className="bg-[#0a0f1a]/80 border border-teal-500/30 px-4 py-2 text-teal-400 text-[10px] font-bold uppercase hover:bg-teal-500/20 hover:text-white transition-all shadow-sm"
            >
              SCAN SECTOR
            </button>
            <button 
              onClick={onWarp}
              disabled={!isWarpAvailable}
              className={`border px-4 py-2 text-[10px] font-bold uppercase transition-all shadow-sm flex flex-col items-center ${
                isWarpAvailable 
                ? 'bg-purple-900/40 border-purple-500 text-purple-300 hover:bg-purple-500 hover:text-white cursor-pointer' 
                : 'bg-black/50 border-gray-700 text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              <span>INITIATE WARP</span>
              {warpTarget && (
                <span className="text-[8px] opacity-70">TARGET: {warpTarget.name || 'UNKNOWN'}</span>
              )}
              {!isWarpAvailable && warpTarget && (
                <span className="text-[8px] text-red-400">COOLDOWN: {Math.ceil((warpCooldownEnd - now) / 1000)}s</span>
              )}
            </button>
        </div>
      )}
    </div>
  );
};

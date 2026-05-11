'use client';
import React from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';

export const AudioSettingsOverlay = ({ onClose }: { onClose: () => void }) => {
  const { settings, setSettings } = useAudioSettings();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151619] border border-white/10 p-8 rounded-lg w-full max-w-md text-white">
        <h2 className="text-xl font-mono mb-6 uppercase tracking-wider text-center">Audio Settings</h2>
        
        {[
          { key: 'master', label: 'Master' },
          { key: 'sfx', label: 'SFX' },
          { key: 'music', label: 'Music' },
        ].map((item) => (
          <div key={item.key} className="mb-6">
            <div className="flex justify-between mb-2 font-mono text-sm text-gray-400">
              <label>{item.label}</label>
              <span>{Math.round(settings[item.key as keyof typeof settings] * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings[item.key as keyof typeof settings]}
              onChange={(e) => setSettings({ ...settings, [item.key]: parseFloat(e.target.value) })}
              className="w-full accent-[#F27D26] h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ))}
        
        <button 
          onClick={onClose}
          className="w-full bg-[#353639] hover:bg-[#F27D26] text-white py-2 rounded transition-colors font-mono uppercase"
        >
          Close
        </button>
      </div>
    </div>
  );
};

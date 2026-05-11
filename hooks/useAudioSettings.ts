import { useState, useEffect } from 'react';
import { audioManager } from '../game/engine/AudioManager';

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
}

export const useAudioSettings = () => {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('audioSettings');
      return saved ? JSON.parse(saved) : { master: 0.8, sfx: 0.8, music: 0.5 };
    }
    return { master: 0.8, sfx: 0.8, music: 0.5 };
  });

  useEffect(() => {
    localStorage.setItem('audioSettings', JSON.stringify(settings));
    audioManager.setVolumes(settings.master, settings.sfx, settings.music);
  }, [settings]);

  return { settings, setSettings };
};

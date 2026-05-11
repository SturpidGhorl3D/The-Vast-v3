
'use client';

import { useEffect } from 'react';
import { ViewMode } from '@/components/game/types';

interface KeyStateProps {
  engine: any;
  setIsEditorMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setInteractionMode: React.Dispatch<React.SetStateAction<any>>;
  setTargetDesignationMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useKeyAndMouseState = ({
  engine,
  setIsEditorMenuOpen,
  setIsPaused,
  setInteractionMode,
  setTargetDesignationMode,
}: KeyStateProps) => {
  useEffect(() => {
    if (!engine) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (engine.isEditorOpen) {
          setIsEditorMenuOpen(prev => !prev);
        } else {
          setIsPaused(prev => {
            const next = !prev;
            engine.isPaused = next;
            if (next && engine.isInitialized) {
              engine.saveState();
            }
            return next;
          });
        }
      }
      
      if (e.code === 'Space' && !engine.isEditorOpen) {
        e.preventDefault();
        engine.doWarpJump();
      }

      if (e.code === 'Digit1') { engine.interactionMode = 'NONE'; setInteractionMode('NONE'); }
      if (e.code === 'Digit2') { engine.interactionMode = 'MINING'; setInteractionMode('MINING'); }
      if (e.code === 'Digit3') { engine.interactionMode = 'COMBAT'; setInteractionMode('COMBAT'); }
      
      if (e.code === 'KeyT' && !engine.isEditorOpen) {
        engine.targetDesignationMode = !engine.targetDesignationMode;
        setTargetDesignationMode(engine.targetDesignationMode);
      }

      engine.inputManager.keys.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engine.inputManager.keys.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine, setIsEditorMenuOpen, setIsPaused, setInteractionMode, setTargetDesignationMode]);
};

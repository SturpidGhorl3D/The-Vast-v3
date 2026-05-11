
'use client';

import { RefObject, MutableRefObject, useRef } from 'react';
import type { ShipHull, ViewMode, GlobalCoords } from '@/components/game/types';
import { useKeyAndMouseState } from './game-input/useKeyAndMouseState';
import { useCameraControls } from './game-input/useCameraControls';
import { useGameplayInteraction } from './game-input/useGameplayInteraction';
import { useEditorInteraction } from './game-input/useEditorInteraction';

interface UseGameInputProps {
  engine: any;
  isReady: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewModeRef: MutableRefObject<ViewMode>;
  setIsEditorMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  setThrustActive: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveVertex: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveCompartmentVertex: React.Dispatch<React.SetStateAction<number | null>>;
  setShipHull: React.Dispatch<React.SetStateAction<ShipHull>>;
  setWarpTarget: React.Dispatch<React.SetStateAction<GlobalCoords | null>>;
  setSchematicSystem: React.Dispatch<React.SetStateAction<any | null>>;
  setTacticalClickMode: React.Dispatch<React.SetStateAction<'NONE' | 'WARP_TARGET' | 'WAYPOINT' | 'ASTEROID_DETECT'>>;
  setTacticalRoute: React.Dispatch<React.SetStateAction<GlobalCoords[]>>;
  setSelectionType: React.Dispatch<React.SetStateAction<'deck' | 'compartment' | 'cell' | null>>;
  setSelectedElementIndex: React.Dispatch<React.SetStateAction<number | string | null>>;
  setActiveCompartment: React.Dispatch<React.SetStateAction<any>>;
  setActiveDeck: React.Dispatch<React.SetStateAction<number>>;
  setInternalView: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMiningWindowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAsteroid: React.Dispatch<React.SetStateAction<any>>;
  setAnalyzedTarget: React.Dispatch<React.SetStateAction<any>>;
  interactionMode: string;
  setInteractionMode: React.Dispatch<React.SetStateAction<any>>;
  setTargetDesignationMode: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Orchestrator hook for game input. 
 * Refactored into modular sub-hooks for maintainability.
 */
export const useGameInput = (props: UseGameInputProps) => {
  const { engine, isReady, canvasRef } = props;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mirrorTargetsRef = useRef<Array<{ index: number; mirrorType: 'X' | 'Y' | 'XY' }>>([]);

  // 1. Basic Key & Mouse state logic
  useKeyAndMouseState({
    engine,
    setIsEditorMenuOpen: props.setIsEditorMenuOpen,
    setIsPaused: props.setIsPaused,
    setInteractionMode: props.setInteractionMode,
    setTargetDesignationMode: props.setTargetDesignationMode,
  });

  // 2. Camera controls (zoom, pan)
  useCameraControls({
    engine,
    viewModeRef: props.viewModeRef,
    canvasRef: props.canvasRef,
  });

  // 3. Gameplay interactions (combat, mining, tactical, strategic)
  useGameplayInteraction({
    engine,
    canvasRef: props.canvasRef,
    viewModeRef: props.viewModeRef,
    holdTimerRef,
    setWarpTarget: props.setWarpTarget,
    setSchematicSystem: props.setSchematicSystem,
    setTacticalClickMode: props.setTacticalClickMode,
    setTacticalRoute: props.setTacticalRoute,
    setIsMiningWindowOpen: props.setIsMiningWindowOpen,
    setSelectedAsteroid: props.setSelectedAsteroid,
    setAnalyzedTarget: props.setAnalyzedTarget,
    setViewMode: props.setViewMode,
    setThrustActive: props.setThrustActive,
    setTargetDesignationMode: props.setTargetDesignationMode,
  });

  // 4. Editor interactions (building, dragging, selection)
  useEditorInteraction({
    engine,
    canvasRef: props.canvasRef,
    setShipHull: props.setShipHull,
    setActiveVertex: props.setActiveVertex,
    setActiveCompartmentVertex: props.setActiveCompartmentVertex,
    setSelectionType: props.setSelectionType,
    setSelectedElementIndex: props.setSelectedElementIndex,
    setActiveCompartment: props.setActiveCompartment,
    setActiveDeck: props.setActiveDeck,
    setInternalView: props.setInternalView,
    mirrorTargetsRef,
  });

  return { mirrorTargetsRef };
};

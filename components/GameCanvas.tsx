
'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useGameInput } from '@/hooks/useGameInput';
import { renderWorldObjects, renderTacticalOverlays } from '@/game/renderUtils';
import { Camera } from '@/game/engine/camera';
import { Renderer } from '@/game/engine/renderer';
import { ShipRenderer } from '@/game/engine/renderers/ShipRenderer';
import { WorldGenerator, StarSystem, getHexCoords } from '@/game/world/generator';
import { TECHNOLOGIES } from '@/components/game/technologyTypes';
import { GlobalMapRenderer } from '@/game/world/global_map/GlobalMapRenderer';
import { globalFactionManager } from '@/game/world/FactionManager';
import { ECS, Entity } from '@/game/engine/ecs';
import { movementSystem, miningSystem, renderSystem, calculateMaxCapacity, getReactorPower, Inventory, Hull } from '@/game/systems';
import { SYSTEM_GRID_SPACING_M, BUILD_ANIM_DURATION_MS } from '@/game/constants';
import { clampCameraZoom, getLargestShipDimension } from '@/game/hullGeometry';

import {
  LOCAL_ORBIT_DRAW_RADIUS_M,
  PLAYER_CURRENT_SYSTEM_RADIUS_M,
  PLAYER_DISCOVER_SYSTEM_RADIUS_M,
  SHIP_ACCEL_NORMAL,
  SHIP_ACCEL_RAMP_RATE,
  SHIP_WARP_RAMP_RATE,
  SHIP_MAX_SPEED_NORMAL,
  SHIP_MAX_SPEED_WARP,
  SHIP_TURN_SPEED,
  WARP_ACCEL_MULT,
  WARP_COOLDOWN_MS,
  WARP_JUMP_RADIUS_M,
  SECTOR_SIZE_M,
  CHUNK_SIZE_M,
} from '@/game/constants';
import {
  isPointInPolygon,
  doPolygonsIntersect,
  findBestInsertIndex,
  checkValidation,
  validateHullForApply,
  resolveMirrorTargets,
  findMirroredVertexIndices,
  mirroredPosition,
} from '@/components/game/editorLogic';
import type { ShipHull, GameSettings, EditorMode, ViewMode, CompartmentType, InteractionMode, MovementMode, TacticalWaypoint, GlobalCoords } from '@/components/game/types';
import { COMPARTMENT_COLORS, makeDefaultCompartmentExtras, calcBlueprintCost } from '@/game/compartmentUtils';
import HUD from '@/components/HUD';
import MobileControls from '@/components/MobileControls';
import EditorUI from '@/components/ui/EditorUI';
import PauseMenu from '@/components/ui/PauseMenu';
import ModePanel from '@/components/ui/ModePanel';
import ProductionWindow from '@/components/ui/ProductionWindow';
import { COMPONENT_RECIPES } from '@/game/materials';
import BlueprintManager from '@/components/ui/BlueprintManager';
import MiningWindow from '@/components/ui/MiningWindow';
import TechnologyWindow from '@/components/ui/TechnologyWindow';
import TargetingWindow from '@/components/ui/TargetingWindow';
import { TacticalContextMenu } from '@/components/ui/TacticalContextMenu';
import { AnalysisWindow } from '@/components/ui/AnalysisWindow';
import { DiplomacyWindow } from '@/components/ui/DiplomacyWindow';
import { NavigationPanel } from '@/components/ui/NavigationPanel';

import { useGameEngineInit, makeStarterCompartments } from '@/hooks/useGameEngineInit';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useGameStateSync } from '@/hooks/useGameStateSync';
import { useProductionLogic } from '@/hooks/useProductionLogic';
import { EditorRenderer } from '@/game/engine/renderers/EditorRenderer';

import { SettingsMenu, type AppState, type GameSave } from '@/components/ui/main-menu/MainMenu';

/** Returns the index of the point in `pts` closest to (tx, ty) */
function closestVertexIndex(pts: { x: number; y: number }[], tx: number, ty: number): number {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - tx) ** 2 + (pts[i].y - ty) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/** Mirror a point using compartment pairAxis convention:
 *  'X' = Mirror across Y-axis (Left/Right) → (-x, y)
 *  'Y' = Mirror across X-axis (Front/Back) → ( x, -y) */
function mirrorByPairAxis(x: number, y: number, pairAxis: 'X' | 'Y'): { x: number; y: number } {
  return pairAxis === 'X' ? { x: -x, y } : { x, y: -y };
}

export default function GameCanvas({ 
  save, 
  multiplayerInfo, 
  onExit,
  isCreative = false
}: { 
  save: GameSave; 
  multiplayerInfo: { isHost: boolean; roomId: string } | null;
  onExit: () => void;
  isCreative?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { engine, isReady } = useGameEngine(
    canvasRef, 
    save.seed, 
    Math.floor(save.clusterRadius / 10), 
    save.density
  );

  useGameEngineInit(engine, isReady, save, isCreative);

  const handleOpenEditor = useCallback(() => {
    if (!engine) return;
    const ecs = engine.ecs;
    const player = engine.player;
    
    // If player is still null, we can't get the hull yet. 
    // The useEffect will retry this when engine.player is set.
    if (player === null) {
      console.log("handleOpenEditor called but player is null, waiting...");
      return;
    }

    const hull = ecs.getHull(player);
    if (hull) {
      engine.draftHull = structuredClone(hull);
      engine.editorCameraPos = { x: 0, y: 0 };
      engine.camera.setPos({ sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 });
      engine.camera.angle = Math.PI / 2;
      engine.camera.targetAngle = Math.PI / 2;
      engine.camera.zoom = 2;
      engine.camera.targetZoom = 2;
      setSelectionType(null);
      setSelectedElementIndex(null);
      engine.selectionType = null;
      engine.selectedElementIndex = null;
      const r = engine.renderer;
      if (r) {
        clampCameraZoom(engine.camera, r.width, r.height, 'editor', engine.draftHull);
      }
      setShipHull({ ...engine.draftHull });
      setActiveDeck(engine.draftHull.activeDeckIndex);
      
      setIsEditorOpen(true);
      setIsPaused(true);
      engine.isPaused = true;
      engine.isEditorOpen = true;
    }
  }, [engine]);

  // Creative mode initialization
  useEffect(() => {
    if (isCreative && engine && isReady) {
      const initInterval = setInterval(() => {
        if (engine.player !== null && !engine.isEditorOpen) {
          handleOpenEditor();
          setIsLoading(false);
          clearInterval(initInterval);
        }
      }, 50);
      return () => clearInterval(initInterval);
    }
  }, [isCreative, engine, isReady, handleOpenEditor]);

  useEffect(() => {
    const handleExit = () => { if (isCreative) onExit(); };
    window.addEventListener('exit-creative-mode', handleExit);
    return () => window.removeEventListener('exit-creative-mode', handleExit);
  }, [isCreative, onExit]);
  
  const { emitGameStateUpdate, onGameStateUpdate, onPlayerDisconnected, socketId } = useMultiplayer(!isCreative);

  useEffect(() => {
    if (!multiplayerInfo || !engine) return;
    
    engine.playerId = socketId || null;

    // Listen for updates from other players
    const unsubscribeState = onGameStateUpdate((data) => {
        if (data.senderId !== engine.playerId) {
            engine.applyRemotePlayerState(data);
        }
    });

    const unsubscribeDisconnect = onPlayerDisconnected((data) => {
        engine.markPlayerDisconnected(data.playerId);
    });
    
    return () => {
        unsubscribeState();
        unsubscribeDisconnect();
    };
  }, [multiplayerInfo, engine, onGameStateUpdate, onPlayerDisconnected, socketId]);

  // Periodic state emission
  useEffect(() => {
    if (!multiplayerInfo || !engine) return;
    
    const interval = setInterval(() => {
        const state = engine.getNetworkState();
        if (state) {
            emitGameStateUpdate(multiplayerInfo.roomId, state);
        }
    }, 100); // 10Hz sync
    
    return () => clearInterval(interval);
  }, [multiplayerInfo, engine, emitGameStateUpdate]);
  const [viewMode, setViewMode] = useState<ViewMode>('LOCAL');
  const [currentSystem, setCurrentSystem] = useState<StarSystem | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [hasFabricator, setHasFabricator] = useState(false);
  const [hasMachinery, setHasMachinery] = useState(false);
  const [hasCommunication, setHasCommunication] = useState(false);
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const [internalView, setInternalView] = useState(false);
  const [isTechnologyOpen, setIsTechnologyOpen] = useState(false);
  const [researchedTechs, setResearchedTechs] = useState<string[]>([]);
  const [innovationPoints, setInnovationPoints] = useState(0);
  const [activeResearch, setActiveResearch] = useState<{ techId: string; progress: number; totalCost: number } | null>(null);
  const [availableTechOptions, setAvailableTechOptions] = useState<string[]>([]);
  const [pendingInnovationChoices, setPendingInnovationChoices] = useState<string[]>([]);
  const [pendingBranchChoices, setPendingBranchChoices] = useState<Record<string, string[]>>({});
  const [techNodePositions, setTechNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [techBranchingCounts, setTechBranchingCounts] = useState<Record<string, number>>({});
  const [productionTick, setProductionTick] = useState(0);

  const [shipHull, setShipHull] = useState<ShipHull>({
    style: 'STEEL',
    size: 26,
    decks: [
      { 
        id: 'deck-main',
        level: 0, 
        points: [{ x: 30, y: 0 }, { x: -15, y: 15 }, { x: -15, y: -15 }], 
        color: '#444444', 
        name: 'Main Deck', 
        globalHullThickness: 0.8,
        beamPattern: 'SQUARE',
        beamDensity: 3.0,
        beams: [],
        cells: []
      },
    ],
    compartments: makeStarterCompartments(30),
    activeDeckIndex: 0,
  });
  const [activeDeck, setActiveDeck] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>('PAN');
  const [activeVertex, setActiveVertex] = useState<number | null>(null);
  const [activeCompartment, setActiveCompartment] = useState<any>(null);
  const [activeCompartmentVertex, setActiveCompartmentVertex] = useState<number | null>(null);
  const [symmetryX, setSymmetryX] = useState(true);
  const [symmetryY, setSymmetryY] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    dithering: true,
    vignette: true,
    panning: false,
    spaceBackground: '#050505',
    gridMode: '10',
    showAsteroidFields: true,
    showAsteroidChunks: false,
  });
  const [hudOpen, setHudOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [warpTarget, setWarpTarget] = useState<(GlobalCoords & { name?: string }) | null>(null);
  const [warpCooldownEnd, setWarpCooldownEnd] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [thrustActive, setThrustActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('NONE');
  const [movementMode, setMovementMode] = useState<MovementMode>('MANUAL');
  const [secondaryActive, setSecondaryActive] = useState(true);
  const [defenceActive, setDefenceActive] = useState(true);
  const [mainActive, setMainActive] = useState(true);
  const [fireGroupSync, setFireGroupSync] = useState<Record<string, boolean>>({ MAIN: true, SECONDARY: false, DEFENCE: false });
  const [fireGroupSemiAuto, setFireGroupSemiAuto] = useState<Record<string, boolean>>({ MAIN: false, SECONDARY: true, DEFENCE: true });
  const [tacticalRoute, setTacticalRoute] = useState<TacticalWaypoint[]>([]);
  const [playerPos, setPlayerPos] = useState<{ sectorX: bigint; sectorY: bigint; offsetX: number; offsetY: number } | null>(null);
  const [followTarget, setFollowTarget] = useState<any | null>(null);
  const [orbitTarget, setOrbitTarget] = useState<any | null>(null);
  const [tacticalClickMode, setTacticalClickMode] = useState<'NONE' | 'WAYPOINT' | 'WARP_TARGET' | 'ASTEROID_DETECT'>('NONE');
  const [isGravityWellActive, setIsGravityWellActive] = useState(false);
  const [lastAsteroidScan, setLastAsteroidScan] = useState<number>(0);
  const [inAsteroidCluster, setInAsteroidCluster] = useState<boolean>(false);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [maxCapacity, setMaxCapacity] = useState(1000);
  const [schematicSystem, setSchematicSystem] = useState<any>(null);
  const [showBlueprintManager, setShowBlueprintManager] = useState(false);
  const [isMiningWindowOpen, setIsMiningWindowOpen] = useState(false);
  const [isTargetingWindowOpen, setIsTargetingWindowOpen] = useState(false);
  const [designatedTargetsData, setDesignatedTargetsData] = useState<any[]>([]);
  const [targetDesignationMode, setTargetDesignationMode] = useState(false);
  const [selectedAsteroid, setSelectedAsteroid] = useState<any>(null);
  const [analyzedTarget, setAnalyzedTarget] = useState<any>(null);
  const [diplomacyFactionId, setDiplomacyFactionId] = useState<string | null>(null);
  const [nearbyFactions, setNearbyFactions] = useState<string[]>([]);
  const [tacticalContextMenu, setTacticalContextMenu] = useState<{x: number, y: number, target: any} | null>(null);

  // Attach setTacticalContextMenu to window for useGameInput
  useEffect(() => {
    (window as any).setTacticalContextMenu = setTacticalContextMenu;
    return () => { delete (window as any).setTacticalContextMenu; };
  }, []);
  const selectedAsteroidRef = useRef<any>(null);
  useEffect(() => { selectedAsteroidRef.current = selectedAsteroid; }, [selectedAsteroid]);
  const lastSectorRef = useRef<string>('');
  const engineRef = useRef<any>(null);
  useEffect(() => { engineRef.current = engine; }, [engine]);

  const [selectionType, setSelectionType] = useState<'deck' | 'compartment' | 'cell' | null>(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | string | null>(null);

  const isMobile = useIsMobile();
  const viewModeRef = useRef(viewMode);
  const settingsRef = useRef(settings);

  useEffect(() => {
    (window as any).openTargetingWindow = () => setIsTargetingWindowOpen(true);
    (window as any).openTechnologyWindow = () => setIsTechnologyOpen(true);
    return () => { 
      delete (window as any).openTargetingWindow; 
      delete (window as any).openTechnologyWindow; 
    };
  }, []);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { if (engine) engine.interactionMode = interactionMode; }, [interactionMode, engine]);
  useEffect(() => { if (engine) engine.viewMode = viewMode; }, [viewMode, engine]);
  useEffect(() => { if (engine) engine.movementMode = movementMode; }, [movementMode, engine]);
  useEffect(() => { if (engine) engine.fireGroupSync = { ...fireGroupSync }; }, [fireGroupSync, engine]);
  useEffect(() => { if (engine) engine.fireGroupSemiAuto = { ...fireGroupSemiAuto }; }, [fireGroupSemiAuto, engine]);
  useEffect(() => { if (engine) engine.mainBatteryActive = mainActive; }, [mainActive, engine]);
  useEffect(() => { if (engine) engine.secondaryActive = secondaryActive; }, [secondaryActive, engine]);
  useEffect(() => { if (engine) engine.defenceActive = defenceActive; }, [defenceActive, engine]);
  useEffect(() => { if (engine) engine.tacticalRoute = [...tacticalRoute]; }, [tacticalRoute, engine]);
  useEffect(() => { if (engine) engine.tacticalClickMode = tacticalClickMode; }, [tacticalClickMode, engine]);

  useEffect(() => {
    if (warpCooldownEnd === 0) { setCooldownLeft(0); return; }
    const tick = () => setCooldownLeft(Math.max(0, Math.ceil((warpCooldownEnd - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [warpCooldownEnd]);

  useEffect(() => {
    const id = setInterval(() => {
      if (engine) {
        setInAsteroidCluster(engine.inAsteroidCluster);
      }
    }, 500);
    return () => clearInterval(id);
  }, [engine]);

  useEffect(() => {
    setIsLandscape(window.innerWidth > window.innerHeight);
    // Show loading screen briefly for compilation warmup
    const t = setTimeout(() => setIsLoading(false), 1200);

    // Expose production window opener to window for HUD
    (window as any).openProductionWindow = () => setIsProductionOpen(true);
    (window as any).openTargetingWindow = () => setIsTargetingWindowOpen(true);
    (window as any).openTechnologyWindow = () => setIsTechnologyOpen(true);

    return () => {
      clearTimeout(t);
      delete (window as any).openProductionWindow;
      delete (window as any).openTargetingWindow;
      delete (window as any).openTechnologyWindow;
    };
  }, []);

  useEffect(() => {
    // Update hasFabricator, hasMachinery and hasCommunication status
    const fab = shipHull.compartments.some(c => c.type === 'FABRIC' && !c.isBuilding);
    const mach = shipHull.compartments.some(c => c.type === 'MACHINERY' && !c.isBuilding);
    const comm = shipHull.compartments.some(c => c.type === 'COMMUNICATION' && !c.isBuilding);
    setHasFabricator(fab);
    setHasMachinery(mach);
    setHasCommunication(comm);
  }, [shipHull.compartments]);


  const { handleProduce } = useProductionLogic({ engine, setInventory, setMaxCapacity });

  // Sync engine state to React state for UI
  useGameStateSync({
    engine,
    isReady,
    setInventory,
    setMaxCapacity,
    setShipHull,
    setSelectedAsteroid,
    setIsPaused,
    setViewMode,
    setVisited,
    setScanned,
    setInAsteroidCluster,
    setWarpCooldownEnd,
    setWarpTarget,
    setLastAsteroidScan,
    setTargetDesignationMode,
    setNearbyFactions,
    setDesignatedTargetsData,
    setInnovationPoints,
    setResearchedTechs,
    setActiveResearch,
    setAvailableTechOptions,
    setPendingInnovationChoices,
    setPendingBranchChoices,
    setNodePositions: setTechNodePositions,
    setBranchingCounts: setTechBranchingCounts,
    setProductionTick,
    selectedAsteroidRef,
  });

  // Handle Resize
  useEffect(() => {
    if (!engine || !isReady || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) return;
        engine.resize(width, height);
        setIsLandscape(width > height);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [engine, isReady]);

  // Initialization of player is handled earlier

  useEffect(() => {
    if (!engine || !isReady || isCreative) return;
    const interval = setInterval(() => {
      if (engine.isInitialized) {
        engine.saveState();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [engine, isReady, isCreative]);

  // @ai-context: Input Handlers Extracted to Hook
  const { mirrorTargetsRef } = useGameInput({
    engine,
    isReady,
    canvasRef,
    viewModeRef,
    setIsEditorMenuOpen,
    setIsPaused,
    setViewMode,
    setThrustActive,
    setActiveVertex,
    setActiveCompartmentVertex,
    setShipHull,
    setWarpTarget,
    setSchematicSystem,
    setTacticalClickMode,
    setTacticalRoute,
    setSelectionType,
    setSelectedElementIndex,
    setActiveCompartment,
    setActiveDeck,
    setInternalView,
    setIsMiningWindowOpen,
    setSelectedAsteroid,
    setAnalyzedTarget,
    interactionMode,
    setInteractionMode,
    setTargetDesignationMode
  });

  const handleStartMining = (id: string) => {
    if (!engine) return;
    engine.miningTargetId = id;
    if (id === '') {
      setIsMiningWindowOpen(false);
      setSelectedAsteroid(null);
      engine.targetAsteroidId = null;
      engine.targetingStartTime = 0;
    }
  };

  useEffect(() => {
    if (!engine || !isReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Game loop
    let animationFrame: number;
    let lastTime = performance.now();

    let isLoopActive = true;
    const loop = (time: number) => {
      if (!isLoopActive) return;
      if (!engine || !engine.renderer) {
        animationFrame = requestAnimationFrame(loop);
        return;
      }
      try {
        const dt = (time - lastTime) / 16.66;
        lastTime = time;
        // Always update build animations — runs even when paused/editor open
        if (engine.player !== null) {
          const ecs = engine.ecs as ECS;
          const _hull = ecs.getComponent<any>(engine.player, 'Hull');
          if (_hull) {
            if (_hull.buildAnimation?.active) {
              const elapsed = Date.now() - _hull.buildAnimation.startTime;
              _hull.buildAnimation.progress = Math.min(1, elapsed / _hull.buildAnimation.duration);
              if (_hull.buildAnimation.progress >= 1) _hull.buildAnimation.active = false;
            }
            _hull.compartments?.forEach((c: any) => {
              if (c.isBuilding) {
                c.buildProgress = Math.min(1, (c.buildProgress || 0) + 0.002 * dt);
                if (c.buildProgress >= 1) c.isBuilding = false;
              }
            });
          }
        }
        
        // Let and random updates
        if (!engine.isPaused && engine.player !== null) {
          engine.update(time);
          setIsGravityWellActive(engine.currentGravityWell !== null);
          setFollowTarget(engine.followTarget);
          setOrbitTarget(engine.orbitTarget);
          setResearchedTechs([...engine.researchedTechs]);
          setInnovationPoints(engine.innovationPoints);
          if (engine.activeResearch) {
             setActiveResearch({ ...engine.activeResearch });
          } else {
             setActiveResearch(null);
          }
          setAvailableTechOptions([...engine.availableTechOptions]);
          if (Math.random() < 0.1) {
             const ecs = engine.ecs as ECS;
             const inv = ecs.getComponent<any>(engine.player, 'Inventory')!;
             setInventory({ ...inv.resources });
             setMaxCapacity(inv.maxCapacity || 1000);
             const pPos = ecs.getPosition(engine.player);
             if (pPos) setPlayerPos({ ...pPos });
           }
           if (engine.miningTargetId && !selectedAsteroid) {
             // Sync selected asteroid if mining started elsewhere
             const target = engine.asteroidGrid.getVisibleAsteroids().find((a: any) => a.id === engine.miningTargetId);
             if (target) setSelectedAsteroid(target);
           }
           setCurrentSystem(prev => prev?.id !== engine.currentSystem?.id ? engine.currentSystem : prev);
           if (engine.visited.size > visited.size) {
             setVisited(new Set(engine.visited));
           }
        }

        draw(time);
      } catch (e) {
        console.error('[GameCanvas] loop error:', e);
      }
      animationFrame = requestAnimationFrame(loop);
    };

    const draw = (now: number) => {
      if (isCreative && (!engine || !engine.isEditorOpen)) return; // Wait for editor initialization in creative mode
      if (!engine || !engine.renderer) return;
      const { renderer, camera, world, ecs, player } = engine;
      if (!renderer || player === null) return;
      const pos = ecs.getPosition(player)!;
      const curMode = viewModeRef.current;

      renderer.clear(engine.isEditorOpen ? '#0a0f1a' : settingsRef.current.spaceBackground, now);

      if (engine.isEditorOpen) {
        EditorRenderer.draw(engine, renderer, camera, settingsRef.current, mirrorTargetsRef.current);
      } else {
        const cw = renderer.width;
        const ch = renderer.height;
        const corners = [
            camera.screenToWorld(0, 0, cw, ch),
            camera.screenToWorld(cw, 0, cw, ch),
            camera.screenToWorld(0, ch, cw, ch),
            camera.screenToWorld(cw, ch, cw, ch)
        ];

        let minSecX = corners[0].sectorX;
        let maxSecX = corners[0].sectorX;
        let minSecY = corners[0].sectorY;
        let maxSecY = corners[0].sectorY;

        for (const c of corners) {
            if (c.sectorX < minSecX) minSecX = c.sectorX;
            if (c.sectorX > maxSecX) maxSecX = c.sectorX;
            if (c.sectorY < minSecY) minSecY = c.sectorY;
            if (c.sectorY > maxSecY) maxSecY = c.sectorY;
        }

        const margin = curMode === 'STRATEGIC' ? 10000n : 1n;
        minSecX -= margin;
        maxSecX += margin;
        minSecY -= margin;
        maxSecY += margin;

        const bounds = { minSecX, minSecY, maxSecX, maxSecY };

        renderWorldObjects(
            renderer, camera, world, pos, curMode, now, engine, bounds, settingsRef.current
        );

        renderer.drawProjectiles(engine, camera);

        if (curMode === 'STRATEGIC') {
            const gmr = engine.globalMapRenderer;
            if (gmr) {
                gmr.drawWarpRadius(pos, WARP_JUMP_RADIUS_M, camera);
                const wt = engine.warpTarget;
                if (wt) gmr.drawWarpTarget(wt, camera);
            }
        }

        renderTacticalOverlays(renderer, camera, engine, pos, curMode, now, 'VENTRAL');
        renderSystem(ecs, renderer, camera, internalView, engine);
        renderTacticalOverlays(renderer, camera, engine, pos, curMode, now, 'DORSAL');
      }

      renderer.render();
    };

    // Draw immediately so canvas is never white
    try { draw(performance.now()); } catch (e) { console.error('[GameCanvas] initial draw error:', e); }
    animationFrame = requestAnimationFrame(loop);

    return () => {
      isLoopActive = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [engine, isReady, currentSystem, viewMode, internalView, isEditorOpen, editorMode, activeDeck, activeVertex, activeCompartment, activeCompartmentVertex, mirrorTargetsRef, visited.size, selectedAsteroid, isCreative]);

  const handleToggleMap = () => {
    if (!engine) return;
    if (viewMode === 'LOCAL') {
      engine.switchViewMode('STRATEGIC');
      setViewMode('STRATEGIC');
      setThrustActive(false);
    } else {
      engine.switchViewMode('LOCAL');
      setViewMode('LOCAL');
    }
  };

    const costInfo = useMemo(() => {
    if (!shipHull || !engine || engine.player === null) return null;
    const player = engine.player;
    const currentHull = engine.ecs.getHull(player);
    if (!currentHull) return null;
    return calcBlueprintCost(currentHull.decks, shipHull.decks, shipHull.compartments, currentHull.compartments);
  }, [shipHull, engine]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh', touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full bg-[#050505]" />

      {/* Loading screen */}
      {(isLoading || (isCreative && !isEditorOpen)) && (
        <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center z-[200] font-mono">
          <div className="text-blue-400 text-3xl font-bold tracking-widest mb-2">THE VAST</div>
          <div className="text-white/40 text-xs uppercase tracking-widest mb-8">
            {isCreative ? 'Initializing Editor...' : 'Prototype v0.1'}
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <div className="text-white/20 text-[10px] mt-4 uppercase">Initializing systems...</div>
        </div>
      )}

      {/* HUD + pause button (flight mode only) */}
      {!isCreative && !isEditorOpen && !isLoading && (
        <HUD
          isMobile={isMobile}
          isLandscape={isLandscape}
          hudOpen={hudOpen}
          setHudOpen={setHudOpen}
          currentSystem={currentSystem}
          visited={visited}
          scanned={scanned}
          onScanSystem={() => {
            if (engine) engine.scanCurrentSystem();
          }}
          maxCapacity={maxCapacity}
          resources={inventory}
          warpTarget={warpTarget}
          cooldownLeft={cooldownLeft}
          viewMode={viewMode}
          onToggleMap={handleToggleMap}
          onCycleView={() => {
            if (!engine) return;
            engine.cycleViewMode();
            setViewMode(engine.viewMode);
            if (engine.viewMode !== 'LOCAL') setThrustActive(false);
          }}
          internalView={internalView}
          onToggleInternalView={() => setInternalView(v => !v)}
          onSetViewMode={(m) => {
            if (!engine) return;
            engine.switchViewMode(m);
            setViewMode(m);
          }}
          onOpenEditor={handleOpenEditor}
          onPause={() => setIsPaused(p => { const next = !p; if (engine) engine.isPaused = next; return next; })}
          isPaused={isPaused}
          interactionMode={interactionMode}
          setInteractionMode={setInteractionMode}
          movementMode={movementMode}
          setMovementMode={setMovementMode}
          tacticalClickMode={tacticalClickMode}
          setTacticalClickMode={setTacticalClickMode}
          tacticalRoute={tacticalRoute}
          setTacticalRoute={setTacticalRoute}
          hasCommunication={hasCommunication}
          factions={globalFactionManager.getAllFactions()}
          nearbyFactions={nearbyFactions}
          isGravityWellActive={isGravityWellActive}
          followTarget={followTarget}
          orbitTarget={orbitTarget}
          onLeaveOrbit={() => { if (engine) engine.clearGravityWell(); }}
          playerPos={playerPos}
        />
      )}

      {/* Tactical view left panel — warp target + click mode */}
      {!isCreative && !isEditorOpen && !isLoading && viewMode === 'TACTICAL' && (
        <div className="absolute left-4 bottom-4 z-20 font-mono select-none flex flex-col gap-2">
          <div className="bg-black/80 border border-cyan-500/30 p-2 text-white text-[9px] space-y-1.5 min-w-[120px]">
            <div className="text-cyan-400 uppercase tracking-widest text-[8px] font-bold">Tactical Nav</div>
            {inAsteroidCluster && (
              <button
                className={`w-full px-2 py-1 border rounded text-[9px] transition-colors ${
                  Date.now() - lastAsteroidScan < 10000 
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200' 
                    : 'bg-black/60 border-cyan-500/30 text-cyan-400/70 hover:text-cyan-300 active:bg-cyan-500/30'
                }`}
                onClick={() => {
                  if (!engine) return;
                  if (Date.now() - engine.lastAsteroidScan < 10000) {
                    setLastAsteroidScan(0);
                    engine.lastAsteroidScan = 0;
                    engine.scannedClusterId = null;
                    engine.scannedChunkKey = null;
                    engine.scannedChunkCoords = null;
                    return;
                  }
                  engine.performAsteroidScan();
                  setLastAsteroidScan(engine.lastAsteroidScan);
                }}
              >
                {Date.now() - lastAsteroidScan < 10000 ? '⚲ SCANNING...' : '⚲ DETECT ASTEROIDS'}
              </button>
            )}
            <button
              className={`w-full px-2 py-1 border rounded text-[9px] transition-colors ${
                settings.showAsteroidChunks
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                  : 'bg-black/60 border-amber-500/30 text-amber-400/70 hover:text-amber-300'
              }`}
              onClick={() => setSettings(s => ({ ...s, showAsteroidChunks: !s.showAsteroidChunks }))}
            >
              {settings.showAsteroidChunks ? '▧ HIDE CHUNKS' : '▧ SHOW CHUNKS'}
            </button>
            <button
              className={`w-full px-2 py-1 border rounded text-[9px] transition-colors ${
                tacticalClickMode === 'WARP_TARGET'
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                  : 'bg-black/60 border-cyan-500/30 text-cyan-400/70 hover:text-cyan-300'
              }`}
              onClick={() => setTacticalClickMode(tacticalClickMode === 'WARP_TARGET' ? 'NONE' : 'WARP_TARGET')}
            >
              {tacticalClickMode === 'WARP_TARGET' ? '● SET TARGET' : '⊕ WARP TARGET'}
            </button>
            {warpTarget && (
              <div className="text-white/40 text-[8px] leading-tight">
                <div className="text-white/60">Target locked:</div>
                <div>{warpTarget.name ?? `(${(warpTarget.offsetX / 1e9).toFixed(1)}, ${(warpTarget.offsetY / 1e9).toFixed(1)}) Gm`}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode panel — bottom-right controls (LOCAL + TACTICAL views) */}
      {!isCreative && !isEditorOpen && !isLoading && (
        <ModePanel
          isMobile={isMobile}
          viewMode={viewMode}
          interactionMode={interactionMode}
          setInteractionMode={setInteractionMode}
          movementMode={movementMode}
          setMovementMode={setMovementMode}
          secondaryActive={secondaryActive}
          setSecondaryActive={setSecondaryActive}
          defenceActive={defenceActive}
          setDefenceActive={setDefenceActive}
          mainActive={mainActive}
          setMainActive={setMainActive}
          fireGroupSync={fireGroupSync}
          setFireGroupSync={(group, v) => setFireGroupSync(prev => ({ ...prev, [group]: v }))}
          fireGroupSemiAuto={fireGroupSemiAuto}
          setFireGroupSemiAuto={(group, v) => setFireGroupSemiAuto(prev => ({ ...prev, [group]: v }))}
          tacticalClickMode={tacticalClickMode}
          setTacticalClickMode={setTacticalClickMode}
          tacticalRoute={tacticalRoute}
          setTacticalRoute={setTacticalRoute}
        />
      )}

      {/* Mobile flight controls */}
      {!isCreative && isMobile && !isEditorOpen && !isLoading && (
        <MobileControls
          isMobile={isMobile}
          isLandscape={isLandscape}
          viewMode={viewMode}
          movementMode={movementMode}
          warpTarget={warpTarget}
          cooldownLeft={cooldownLeft}
          thrustActive={thrustActive}
          setThrustActive={setThrustActive}
          engine={engine}
          setWarpTarget={setWarpTarget}
          setWarpCooldownEnd={setWarpCooldownEnd}
          setViewMode={setViewMode}
          setHudOpen={setHudOpen}
        />
      )}

      {/* Desktop ship config stub */}
      {!isCreative && !isEditorOpen && !isLoading && (
        <div className="hidden sm:block absolute top-4 right-4 p-4 bg-black/80 border border-white/20 text-white font-mono text-xs space-y-2 opacity-50">
          <div className="text-blue-400 uppercase font-bold">Ship Configuration</div>
          <div className="text-white/40">Open Ship Editor to modify</div>
        </div>
      )}

      {/* Pause / settings menu */}
      {!isCreative && !isEditorOpen && !isLoading && (
        <PauseMenu
          isPaused={isPaused}
          setIsPaused={v => { setIsPaused(v); if (engine) engine.setIsPaused(v); }}
          engine={engine}
          settings={settings}
          setSettings={setSettings}
          isMobile={isMobile}
          onExit={() => {
            if (engine) engine.saveState();
            onExit();
          }}
        />
      )}

      {/* Production Window */}
      <ProductionWindow
        isOpen={isProductionOpen}
        onClose={() => setIsProductionOpen(false)}
        resources={inventory}
        onProduce={handleProduce}
        hasMachinery={hasMachinery}
        kernels={engine?.production?.kernels || []}
        researchedTechs={researchedTechs}
        shipType={engine?.playerSpecies?.shipType || 'STANDARD'}
        hudOpen={hudOpen}
        isMobile={isMobile}
      />

      <TechnologyWindow
        isOpen={isTechnologyOpen}
        onClose={() => setIsTechnologyOpen(false)}
        orgType={engine?.orgType || 'CAPTAIN'}
        innovationPoints={innovationPoints}
        researchedTechs={researchedTechs}
        species={engine?.playerSpecies}
        activeResearch={activeResearch}
        availableTechOptions={availableTechOptions}
        pendingInnovationChoices={pendingInnovationChoices}
        pendingBranchChoices={pendingBranchChoices}
        nodePositions={techNodePositions}
        branchingCounts={techBranchingCounts}
        onResearch={(techId) => {
          if (!engine) return;
          const tech = TECHNOLOGIES[techId];
          if (!tech) return;
          
          const techCost = tech.cost || 1000;
          const isRoot = tech.requirements.length === 0;
          const isResearched = engine.researchedTechs.includes(techId);
          const isResearching = engine.activeResearch !== null;
          // allow roots even if not in availableTechOptions
          const isAvailable = engine.availableTechOptions.includes(techId) || isRoot;

          if (!isResearched && !isResearching && isAvailable) {
            engine.activeResearch = { techId, progress: 0, totalCost: techCost };
            engine.saveState();
          }
        }}
        onUnlockOption={(techId) => {
           if (!engine) return;
           engine.research.rollInnovationChoices(); // Global innovation roll
           setInnovationPoints(engine.innovationPoints);
           setPendingInnovationChoices([...engine.pendingInnovationChoices]);
        }}
        onSelectInnovation={(techId, parentId) => {
           if (!engine) return;
           engine.research.selectInnovationChoice(techId, parentId);
           
           // Position the newly available tech near its parent
           if (parentId && engine.techNodePositions[parentId] && !engine.techNodePositions[techId]) {
              const pPos = engine.techNodePositions[parentId];
              const angle = (Math.random() - 0.5) * 2; // Random-ish spread
              engine.techNodePositions[techId] = {
                x: pPos.x + 350,
                y: pPos.y + angle * 150
              };
           }

           setAvailableTechOptions([...engine.availableTechOptions]);
           setPendingInnovationChoices([]);
           setPendingBranchChoices({...engine.pendingBranchChoices});
        }}
        onUpdateNodePosition={(techId, pos) => {
           if (!engine) return;
           engine.techNodePositions[techId] = pos;
           setTechNodePositions({...engine.techNodePositions});
           engine.saveState();
        }}
        onBranchOut={(baseTechId) => {
           if (!engine) return;
           engine.research.branchOut(baseTechId);
           setInnovationPoints(engine.innovationPoints);
           setPendingInnovationChoices([...engine.pendingInnovationChoices]);
        }}
        hudOpen={hudOpen}
        isMobile={isMobile}
      />

      {/* Mining Window */}
      <MiningWindow
        asteroid={selectedAsteroid}
        isOpen={isMiningWindowOpen}
        onClose={() => {
          setIsMiningWindowOpen(false);
          if (engine) {
            engine.targetAsteroidId = null;
            engine.targetingStartTime = 0;
            if (!engine.miningTargetId) setSelectedAsteroid(null);
          }
        }}
        onStartMining={handleStartMining}
        isMining={engine?.miningTargetId === selectedAsteroid?.id && !!engine?.miningTargetId}
        resources={inventory}
        maxCapacity={maxCapacity}
      />

      {/* Tactical Context Menu */}
      {tacticalContextMenu && (
        <TacticalContextMenu
          x={tacticalContextMenu.x}
          y={tacticalContextMenu.y}
          target={tacticalContextMenu.target}
          onClose={() => setTacticalContextMenu(null)}
          onSetCourse={(pos) => {
            if (engine) engine.tacticalRoute = [pos];
            setTacticalRoute([pos]);
          }}
          engine={engine}
        />
      )}

      {/* Analysis Window */}
      {analyzedTarget && (
        <AnalysisWindow 
          target={analyzedTarget} 
          onClose={() => setAnalyzedTarget(null)} 
          onOpenDiplomacy={(fId) => setDiplomacyFactionId(fId)}
        />
      )}

      {/* Diplomacy Window */}
      {diplomacyFactionId && engine && globalFactionManager.getFaction(diplomacyFactionId) && (
        <DiplomacyWindow 
          faction={globalFactionManager.getFaction(diplomacyFactionId)!} 
          onClose={() => setDiplomacyFactionId(null)}
          systemsCount={Array.from((engine.world as any).factionTerritories.values()).filter((t: any) => t.factionId === diplomacyFactionId).length}
          capitalName={'Столица'}
        />
      )}

      <TargetingWindow
        isOpen={isTargetingWindowOpen}
        onClose={() => setIsTargetingWindowOpen(false)}
        targets={designatedTargetsData}
        onRemoveTarget={(id) => {
          if (engine) {
              if ((id as any) === -999) {
                  engine.relativeFirePoint = null;
                  engine.relativeFirePointOffset = null;
              } else {
                  engine.designatedTargets = engine.designatedTargets.filter((t: any) => t !== id);
                  if (engine.combatTargetId === id) engine.combatTargetId = null;
              }
          }
        }}
        onSelectTarget={(id) => {
          if (engine) {
            engine.combatTargetId = id;
            engine.combatFireAngle = null;
          }
        }}
        designationMode={targetDesignationMode}
        onToggleDesignationMode={() => {
          if (engine) engine.targetDesignationMode = !engine.targetDesignationMode;
        }}
      />

      {/* Editor */}
      {isEditorOpen && (
        <EditorUI
          isMobile={isMobile}
          shipHull={shipHull}
          setShipHull={h => { setShipHull(h); if (engine) engine.setDraftHull(h); }}
          activeDeck={activeDeck}
          setActiveDeck={i => { setActiveDeck(i); if (engine && engine.draftHull) engine.draftHull.activeDeckIndex = i; }}
          editorMode={editorMode}
          setEditorMode={m => { setEditorMode(m); if (engine) engine.setEditorMode(m); }}
          symmetryX={symmetryX}
          setSymmetryX={v => { setSymmetryX(v); if (engine) engine.setSymmetryX(v); }}
          symmetryY={symmetryY}
          setSymmetryY={v => { setSymmetryY(v); if (engine) engine.setSymmetryY(v); }}
          activeVertex={activeVertex}
          setActiveVertex={v => { setActiveVertex(v); if (engine) engine.setActiveVertex(v); }}
          activeCompartment={activeCompartment}
          setActiveCompartment={c => { setActiveCompartment(c); if (engine) engine.setActiveCompartment(c); }}
          activeCompartmentVertex={activeCompartmentVertex}
          resources={{ IRON: inventory.IRON || 0, TITANIUM: inventory.TITANIUM || 0 }}
          costInfo={costInfo}
          selectionType={selectionType}
          setSelectionType={setSelectionType}
          selectedElementIndex={selectedElementIndex}
          setSelectedElementIndex={setSelectedElementIndex}
          isEditorMenuOpen={isEditorMenuOpen}
          setIsEditorMenuOpen={setIsEditorMenuOpen}
          setInternalView={setInternalView}
          setIsEditorOpen={setIsEditorOpen}
          setIsPaused={v => { setIsPaused(v); if (engine) engine.setIsPaused(v); }}
          engine={engine}
          isCreative={isCreative}
          researchedTechs={researchedTechs}
        />
      )}
    </div>
  );
}

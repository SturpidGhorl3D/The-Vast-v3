
'use client';

import { useEffect, useRef } from 'react';
import { Entity, ECS } from '@/game/engine/ecs';
import { Inventory } from '@/game/systems';
import { SECTOR_SIZE_M } from '@/game/constants';

interface GameStateSyncProps {
  engine: any;
  isReady: boolean;
  setInventory: (inv: Record<string, number>) => void;
  setMaxCapacity: (cap: number) => void;
  setShipHull: (hull: any) => void;
  setSelectedAsteroid: (ast: any) => void;
  setIsPaused: (p: boolean) => void;
  setViewMode: (m: any) => void;
  setVisited: (v: Set<string>) => void;
  setScanned: (s: Set<string>) => void;
  setInAsteroidCluster: (v: boolean) => void;
  setWarpCooldownEnd: (v: number) => void;
  setWarpTarget: (v: any) => void;
  setLastAsteroidScan: (v: number) => void;
  setTargetDesignationMode: (v: boolean) => void;
  setNearbyFactions: (v: string[]) => void;
  setDesignatedTargetsData: (targets: any[]) => void;
  setInnovationPoints: (v: number) => void;
  setResearchedTechs: (v: string[]) => void;
  setActiveResearch: (v: any) => void;
  setAvailableTechOptions: (v: string[]) => void;
  setPendingInnovationChoices: (v: string[]) => void;
  setPendingBranchChoices: (v: Record<string, string[]>) => void;
  setNodePositions: (v: Record<string, { x: number; y: number }>) => void;
  setBranchingCounts: (v: Record<string, number>) => void;
  setProductionTick: (v: number) => void;
  selectedAsteroidRef: React.MutableRefObject<any>;
}

export function useGameStateSync({
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
  setNodePositions,
  setBranchingCounts,
  setProductionTick,
  selectedAsteroidRef,
}: GameStateSyncProps) {
  useEffect(() => {
    if (!engine || !isReady) return;

    const syncInterval = setInterval(() => {
      if (engine.player !== null) {
        const ecs = engine.ecs as ECS;
        const inv = ecs.getComponent<Inventory>(engine.player, 'Inventory');
        if (inv) {
          setInventory({ ...inv.resources });
          setMaxCapacity(inv.maxCapacity);
        }
        const hull = ecs.getHull(engine.player);
        if (hull && !engine.isEditorOpen) {
          setShipHull({ ...hull } as any);
        }
        
        // Update selected asteroid if window is open to reflect resource changes
        if (selectedAsteroidRef.current) {
          const updated = engine.asteroidGrid.getVisibleAsteroids().find((a: any) => a.id === selectedAsteroidRef.current.id);
          if (updated) {
            setSelectedAsteroid({ ...updated });
          }
        }
      }
      setIsPaused(engine.isPaused);
      setViewMode(engine.viewMode);
      setVisited(new Set(engine.visited));
      setScanned(new Set(engine.scanned));
      setInAsteroidCluster(engine.inAsteroidCluster);
      setWarpCooldownEnd(engine.warpCooldownEndTime);
      setWarpTarget(engine.warpTarget);
      setLastAsteroidScan(engine.lastAsteroidScan);
      setTargetDesignationMode(engine.targetDesignationMode);
      setNearbyFactions(engine.getNearbyFactionsWithStations());
      
      // Research sync
      setInnovationPoints(engine.innovationPoints);
      setResearchedTechs([...engine.researchedTechs]);
      setActiveResearch(engine.activeResearch ? { ...engine.activeResearch } : null);
      setAvailableTechOptions([...engine.availableTechOptions]);
      setPendingInnovationChoices([...engine.pendingInnovationChoices]);
      setPendingBranchChoices({ ...engine.pendingBranchChoices });
      setNodePositions({ ...engine.techNodePositions });
      setBranchingCounts({ ...engine.techBranchingCounts });
      
      // Sync production kernels
      if (engine.production) {
          setProductionTick(Date.now());
      }

      // Sync designated targets info
      const ecs = engine.ecs as ECS;
      const playerPos = engine.player !== null ? ecs.getPosition(engine.player) : null;
      const targetList = engine.designatedTargets.map((id: Entity) => {
          const faction = ecs.getComponent<any>(id, 'Faction');
          const pos = ecs.getPosition(id);
          let dist = 0;
          if (playerPos && pos) {
              const dx = pos.offsetX - playerPos.offsetX + Number(BigInt(pos.sectorX) - BigInt(playerPos.sectorX)) * Number(SECTOR_SIZE_M);
              const dy = pos.offsetY - playerPos.offsetY + Number(BigInt(pos.sectorY) - BigInt(playerPos.sectorY)) * Number(SECTOR_SIZE_M);
              dist = Math.sqrt(dx * dx + dy * dy);
          }
          return {
              id,
              name: faction?.name || `Вражеский объект ${id}`,
              factionColor: faction?.color || '#ff4444',
              distance: dist,
              isSelected: engine.combatTargetId === id
          };
      });

      // Add relative fire point to list if it exists
      if (engine.relativeFirePointOffset && playerPos) {
          const dist = Math.hypot(engine.relativeFirePointOffset.x, engine.relativeFirePointOffset.y);
          targetList.unshift({
              id: -999 as any,
              name: 'ОТНОСИТЕЛЬНАЯ ТОЧКА',
              factionColor: '#00ffff',
              distance: dist,
              isSelected: false
          });
      }
      setDesignatedTargetsData(targetList);
    }, 100);

    return () => clearInterval(syncInterval);
  }, [
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
    setNodePositions,
    setBranchingCounts,
    setProductionTick,
    selectedAsteroidRef
  ]);
}

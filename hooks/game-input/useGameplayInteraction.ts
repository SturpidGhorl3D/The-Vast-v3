
'use client';

import { useEffect, MutableRefObject, RefObject } from 'react';
import { ViewMode, GlobalCoords } from '@/components/game/types';
import { SECTOR_SIZE_M } from '@/game/constants';
import { clampCameraZoom } from '@/game/hullGeometry';

interface GameplayInteractionProps {
  engine: any;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewModeRef: MutableRefObject<ViewMode>;
  holdTimerRef: MutableRefObject<NodeJS.Timeout | null>;
  setWarpTarget: React.Dispatch<React.SetStateAction<GlobalCoords | null>>;
  setSchematicSystem: React.Dispatch<React.SetStateAction<any | null>>;
  setTacticalClickMode: React.Dispatch<React.SetStateAction<'NONE' | 'WARP_TARGET' | 'WAYPOINT' | 'ASTEROID_DETECT'>>;
  setTacticalRoute: React.Dispatch<React.SetStateAction<GlobalCoords[]>>;
  setIsMiningWindowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAsteroid: React.Dispatch<React.SetStateAction<any>>;
  setAnalyzedTarget: React.Dispatch<React.SetStateAction<any>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  setThrustActive: React.Dispatch<React.SetStateAction<boolean>>;
  setTargetDesignationMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useGameplayInteraction = ({
  engine,
  canvasRef,
  viewModeRef,
  holdTimerRef,
  setWarpTarget,
  setSchematicSystem,
  setTacticalClickMode,
  setTacticalRoute,
  setIsMiningWindowOpen,
  setSelectedAsteroid,
  setAnalyzedTarget,
  setViewMode,
  setThrustActive,
  setTargetDesignationMode,
}: GameplayInteractionProps) => {

  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyG' && !engine.isEditorOpen) {
        e.preventDefault();
        const cam = engine.camera;
        const pl2 = engine.player;
        const hl2 = pl2 !== null ? engine.ecs.getHull(pl2) : null;
        const cur = viewModeRef.current;
        const r = engine.renderer;
        if (!r) return;
        const cw = r.width;
        const ch = r.height;
        const viewMin = Math.min(cw, ch);
        if (cur === 'LOCAL') {
          viewModeRef.current = 'TACTICAL';
          setViewMode('TACTICAL');
          engine.viewMode = 'TACTICAL';
          const pl2pos = pl2 !== null ? engine.ecs.getPosition(pl2) : null;
          if (pl2pos) { engine.mapPos = { ...pl2pos }; }
          cam.targetZoom = viewMin / 50_000_000_000;
          clampCameraZoom(cam, cw, ch, 'tactical', hl2);
          setThrustActive(false);
          engine.inputManager.keys.delete('Tab');
        } else if (cur === 'TACTICAL') {
          viewModeRef.current = 'STRATEGIC';
          setViewMode('STRATEGIC');
          engine.viewMode = 'STRATEGIC';
          cam.targetZoom = viewMin / 50_000_000_000_000;
          clampCameraZoom(cam, cw, ch, 'global', hl2);
        } else {
          viewModeRef.current = 'LOCAL';
          setViewMode('LOCAL');
          engine.viewMode = 'LOCAL';
          cam.targetZoom = 5;
          clampCameraZoom(cam, cw, ch, 'local', hl2);
        }
      }
    };

    const handleMouseDown = (e: PointerEvent) => {
      if (e.target !== canvasRef.current || engine.isEditorOpen) return;

      const rect = canvas.getBoundingClientRect();
      const r = engine.renderer;
      if (!r) return;
      const scaleX = r.width / rect.width;
      const scaleY = r.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      const viewMode = viewModeRef.current;
      const worldPos = engine.camera.screenToWorld(mouseX, mouseY, r.width, r.height);

      if (viewMode === 'STRATEGIC') {
        const viewMin = engine.camera.screenToWorld(mouseX - 20, mouseY - 20, r.width, r.height);
        const viewMax = engine.camera.screenToWorld(mouseX + 20, mouseY + 20, r.width, r.height);
        const systems = engine.world.getSystemsInViewport(viewMin.sectorX, viewMin.sectorY, viewMax.sectorX, viewMax.sectorY);
        
        let bestSystem = null;
        let bestDist = Infinity;
        for (const sys of systems) {
          const screenA = engine.camera.worldToScreen(sys, r.width, r.height);
          const d = Math.hypot(screenA.x - mouseX, screenA.y - mouseY);
          if (d < 20 && d < bestDist) { bestDist = d; bestSystem = sys; }
        }

        if (bestSystem) {
          if (e.button === 2) {
             const holdSystem = bestSystem;
             holdTimerRef.current = setTimeout(() => {
               holdTimerRef.current = null;
               setSchematicSystem(holdSystem);
             }, 1000);
          }
          const safeOrbit = bestSystem.starRadius * 4;
          engine.warpTarget = { sectorX: bestSystem.sectorX, sectorY: bestSystem.sectorY, offsetX: bestSystem.offsetX + safeOrbit, offsetY: bestSystem.offsetY, name: bestSystem.name };
        } else {
          engine.warpTarget = { ...worldPos };
        }
        setWarpTarget(engine.warpTarget);
        return;
      }

      if (e.button === 0) {
        engine.inputManager.keys.add('LMB');
        if (engine.interactionMode === 'NONE') {
          engine.mouseActionHold = { startTime: performance.now(), duration: 600, pos: { x: mouseX, y: mouseY }, worldPos };
          holdTimerRef.current = setTimeout(() => {
            const worldPosToScan = engine.mouseActionHold?.worldPos;
            holdTimerRef.current = null;
            engine.mouseActionHold = null;
            
            if (!worldPosToScan) return;
            const target = findBestTargetAt(worldPosToScan, engine);
            if (target) setAnalyzedTarget(target);
          }, 600);
        }

        if (engine.interactionMode === 'WAYPOINT' && worldPos && worldPos.sectorX !== undefined) {
           (engine as any)._pendingWaypoint = worldPos;
           return;
        }

        if (engine.tacticalClickMode === 'WARP_TARGET') {
          // REMOVED SNAP TO OBJECT CENTERS - USER REQUEST
          engine.warpTarget = { ...worldPos };
          setWarpTarget(engine.warpTarget);
          engine.tacticalClickMode = 'NONE';
          setTacticalClickMode('NONE');
          return;
        }

        if (engine.movementMode === 'TACTICAL') {
          if (engine.tacticalClickMode === 'WAYPOINT') {
            (engine as any)._pendingWaypoint = worldPos;
          } else {
            (engine as any)._pendingWaypoint = null;
          }
          return;
        }

        if (viewMode === 'LOCAL') {
          if (engine.interactionMode === 'MINING') {
            const asteroids = engine.asteroidGrid.getVisibleAsteroids();
            let targetAsteroid = null;
            for (const ast of asteroids) {
              const screenPos = engine.camera.worldToScreen(ast, r.width, r.height);
              if (Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY) < Math.max(20, ast.radius * engine.camera.zoom)) {
                targetAsteroid = ast; break;
              }
            }
            if (targetAsteroid) {
              setSelectedAsteroid(targetAsteroid);
              setIsMiningWindowOpen(true);
              engine.targetAsteroidId = targetAsteroid.id;
            }
            return;
          }

          if (engine.interactionMode === 'COMBAT') {
            const entities = engine.ecs.getEntitiesWith(['Position', 'Hull']);
            let hoverEntity = null;
            let minHoverDist = 100 / engine.camera.zoom;
            for (const entity of entities) {
                if (entity === engine.player) continue;
                const pos = engine.ecs.getPosition(entity)!;
                const sX1 = pos.sectorX ?? 0n;
                const sX2 = worldPos.sectorX ?? 0n;
                const sY1 = pos.sectorY ?? 0n;
                const sY2 = worldPos.sectorY ?? 0n;
                const dx = pos.offsetX - worldPos.offsetX + Number(BigInt(sX1) - BigInt(sX2)) * Number(SECTOR_SIZE_M);
                const dy = pos.offsetY - worldPos.offsetY + Number(BigInt(sY1) - BigInt(sY2)) * Number(SECTOR_SIZE_M);
                if (Math.hypot(dx, dy) < minHoverDist) { hoverEntity = entity; minHoverDist = Math.hypot(dx, dy); }
            }
            if (hoverEntity !== null) {
                if (engine.targetDesignationMode) {
                    if (!engine.designatedTargets.includes(hoverEntity)) engine.designatedTargets.push(hoverEntity);
                } else {
                    engine.combatTargetId = hoverEntity;
                    engine.combatFireAngle = null;
                }
            } else {
                const pl = engine.player;
                const pPos = pl !== null ? engine.ecs.getPosition(pl) : null;
                if (pPos) {
                    const sX1 = worldPos.sectorX ?? 0n;
                    const sX2 = pPos.sectorX ?? 0n;
                    const sY1 = worldPos.sectorY ?? 0n;
                    const sY2 = pPos.sectorY ?? 0n;
                    const dx = worldPos.offsetX - pPos.offsetX + Number(BigInt(sX1) - BigInt(sX2)) * Number(SECTOR_SIZE_M);
                    const dy = worldPos.offsetY - pPos.offsetY + Number(BigInt(sY1) - BigInt(sY2)) * Number(SECTOR_SIZE_M);
                    engine.combatFireAngle = Math.atan2(dy, dx) - pPos.angle;
                    engine.combatTargetId = null;
                }
            }
            return;
          }
          if (engine.tryPickUpLoot(mouseX, mouseY)) return;
        }
      }

      if (e.button === 2) {
        engine.inputManager.keys.add('RMB');
        engine.mouseActionHold = { startTime: performance.now(), duration: 600, pos: { x: mouseX, y: mouseY } };
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          engine.mouseActionHold = null;
          
          // Only trigger grav-anchoring if in WAYPOINT mode as requested
          if (engine.interactionMode !== 'WAYPOINT') return;

          const bestTarget = findBestTargetAt(worldPos, engine, false);
          if (bestTarget) {
            if (bestTarget.type === 'PLANET' || bestTarget.type === 'STAR' || bestTarget.type === 'SATELLITE') {
              // Grav-anchoring: X20 radius
              const radius = bestTarget.radius || 0;
              const distToCenter = Math.hypot(
                  bestTarget.offsetX - worldPos.offsetX,
                  bestTarget.offsetY - worldPos.offsetY
              );
              if (distToCenter <= radius * 20) {
                 engine.currentGravityWell = { type: bestTarget.type, target: bestTarget };
              }
            } else if (bestTarget.type === 'STATION' || bestTarget.type === 'SHIP') {
              // Context menu for man-made / non-grav
              if ((window as any).setTacticalContextMenu) {
                (window as any).setTacticalContextMenu({ x: mouseX, y: mouseY, target: bestTarget });
              }
            }
          }
        }, 600);
      }
    };

    const handleMouseUp = (e: PointerEvent) => {
      if (engine.isEditorOpen) return;
      if (e.button === 0) engine.inputManager.keys.delete('LMB');
      if (e.button === 2) engine.inputManager.keys.delete('RMB');

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        engine.mouseActionHold = null;
      }
      
      if ((engine as any)._pendingWaypoint && engine.interactionMode === 'WAYPOINT') {
        const newRoute = [...engine.tacticalRoute, (engine as any)._pendingWaypoint];
        engine.tacticalRoute = newRoute;
        setTacticalRoute(newRoute);
      }
      (engine as any)._pendingWaypoint = null;
    };

    const handleMouseMove = (e: PointerEvent) => {
      if (engine.isEditorOpen) return;
      const rect = canvas.getBoundingClientRect();
      const r = engine.renderer;
      if (!r) return;
      const scaleX = r.width / rect.width;
      const scaleY = r.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      const worldPos = engine.camera.screenToWorld(mouseX, mouseY, r.width, r.height);

      if (holdTimerRef.current && engine.mouseActionHold) {
        const dist = Math.hypot(mouseX - engine.mouseActionHold.pos.x, mouseY - engine.mouseActionHold.pos.y);
        if (dist > 5) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          engine.mouseActionHold = null;
        }
      }

      engine.mouseWorld = worldPos;

      // Drag-to-select targets in COMBAT mode with targetDesignationMode enabled
      if (engine.interactionMode === 'COMBAT' && engine.targetDesignationMode && engine.inputManager.keys.has('LMB')) {
        const entities = engine.ecs.getEntitiesWith(['Position', 'Hull']);
        let minHoverDist = 100 / engine.camera.zoom;
        for (const entity of entities) {
          if (entity === engine.player) continue;
          const pos = engine.ecs.getPosition(entity)!;
          const sX1 = pos.sectorX ?? 0n;
          const sX2 = worldPos.sectorX ?? 0n;
          const sY1 = pos.sectorY ?? 0n;
          const sY2 = worldPos.sectorY ?? 0n;
          const dx = pos.offsetX - worldPos.offsetX + Number(BigInt(sX1) - BigInt(sX2)) * Number(SECTOR_SIZE_M);
          const dy = pos.offsetY - worldPos.offsetY + Number(BigInt(sY1) - BigInt(sY2)) * Number(SECTOR_SIZE_M);
          if (Math.hypot(dx, dy) < minHoverDist) {
            if (!engine.designatedTargets.includes(entity)) {
              engine.designatedTargets.push(entity);
            }
          }
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || engine.isEditorOpen) return;
      const touch = e.touches[0];
      const simulatedEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        target: canvas,
        preventDefault: () => {}
      } as unknown as MouseEvent;
      handleMouseDown(simulatedEvent);
      if (e.cancelable) e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || engine.isEditorOpen) return;
      const touch = e.touches[0];
      handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: canvas
      } as unknown as MouseEvent);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (engine.isEditorOpen) return;
      if (e.touches.length === 0) {
        handleMouseUp({ button: 0 } as unknown as MouseEvent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('pointerdown', handleMouseDown);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointermove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handleMouseDown);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointermove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [engine, canvasRef, viewModeRef, holdTimerRef, setWarpTarget, setSchematicSystem, setTacticalClickMode, setTacticalRoute, setIsMiningWindowOpen, setSelectedAsteroid, setAnalyzedTarget, setViewMode, setThrustActive]);

};

function toSectorCoords(wx: bigint, wy: bigint) {
  const sSize = BigInt(SECTOR_SIZE_M);
  let sx = wx / sSize;
  let ox = Number(wx % sSize);
  if (ox < 0) {
      sx -= 1n;
      ox += Number(sSize);
  }
  let sy = wy / sSize;
  let oy = Number(wy % sSize);
  if (oy < 0) {
      sy -= 1n;
      oy += Number(sSize);
  }
  return { sectorX: sx, sectorY: sy, offsetX: ox, offsetY: oy };
}

function findBestTargetAt(worldPos: any, engine: any, includeStaticOnly: boolean = false) {
  if (!worldPos || worldPos.sectorX === undefined) return null;
  let target: any = null;
  let d = Math.max(1000, 200 / engine.camera.zoom);

  const secSizeBI = BigInt(SECTOR_SIZE_M);
  // Absolute world position of the mouse click/scan point
  const worldX2 = BigInt(worldPos.sectorX) * secSizeBI + BigInt(Math.floor(worldPos.offsetX));
  const worldY2 = BigInt(worldPos.sectorY) * secSizeBI + BigInt(Math.floor(worldPos.offsetY));

  // Determine which system to search in. Use currentSystem or find nearby systems
  let searchSystems = engine.currentSystem ? [engine.currentSystem] : [];
  const r = engine.renderer;
  if (r) {
    const viewMin = engine.camera.screenToWorld(0, 0, r.width, r.height);
    const viewMax = engine.camera.screenToWorld(r.width, r.height, r.width, r.height);
    const nearby = engine.world.getSystemsInViewport(viewMin.sectorX, viewMin.sectorY, viewMax.sectorX, viewMax.sectorY);
    for (const s of nearby) {
      if (!searchSystems.find(ss => ss.id === s.id)) searchSystems.push(s);
    }
  }

  if (!includeStaticOnly) {
    const entities = engine.ecs.getEntitiesWith(['Position', 'Hull']);
    for (const entity of entities) {
      if (entity === engine.player) continue;
      const pos = engine.ecs.getPosition(entity)!;
      const worldX1 = BigInt(pos.sectorX ?? 0n) * secSizeBI + BigInt(Math.floor(pos.offsetX));
      const worldY1 = BigInt(pos.sectorY ?? 0n) * secSizeBI + BigInt(Math.floor(pos.offsetY));
      
      const dx = Number(worldX1 - worldX2);
      const dy = Number(worldY1 - worldY2);
      const dist = Math.hypot(dx, dy);
      if (dist < d) { 
        d = dist; 
        target = { 
          type: 'SHIP', 
          entity, 
          id: `ship_${entity}`,
          ...pos, 
          hull: engine.ecs.getHull(entity) 
        }; 
      }
    }
  }

  const now = engine.currentTime * 0.001;
  for (const sys of searchSystems) {
    const sysX = BigInt(sys.sectorX) * secSizeBI + BigInt(Math.floor(sys.offsetX));
    const sysY = BigInt(sys.sectorY) * secSizeBI + BigInt(Math.floor(sys.offsetY));

    // Stars
    if (sys.stars) {
      for (const st of sys.stars) {
        const starAngle = st.orbitAngle !== undefined ? st.orbitAngle : 0;
        const stLX = Math.cos(now * (st.orbitSpeed||0) * 10 + starAngle) * (st.orbitRadius||0);
        const stLY = Math.sin(now * (st.orbitSpeed||0) * 10 + starAngle) * (st.orbitRadius||0);
        const stWorldX = sysX + BigInt(Math.floor(stLX));
        const stWorldY = sysY + BigInt(Math.floor(stLY));
        const dx = Number(stWorldX - worldX2);
        const dy = Number(stWorldY - worldY2);
        const dist = Math.hypot(dx, dy);
        if (dist < Math.max(d, st.radius * 1.5)) {
          d = dist;
          const coords = toSectorCoords(stWorldX, stWorldY);
          target = { ...st, type: 'STAR', ...coords, parentSystem: sys };
        }
      }
    } else {
      const dx = Number(sysX - worldX2);
      const dy = Number(sysY - worldY2);
      const dist = Math.hypot(dx, dy);
      if (dist < Math.max(d, sys.starRadius * 1.5)) {
        d = dist;
        target = { ...sys, type: 'STAR', radius: sys.starRadius, ...toSectorCoords(sysX, sysY), parentSystem: sys };
      }
    }

    // Planets
    for (const p of (sys.planets || [])) {
      const pIdx = sys.planets.indexOf(p);
      const pAngle = p.orbitAngle !== undefined ? p.orbitAngle : pIdx;
      const pLX = Math.cos(now * p.orbitSpeed * 10 + pAngle) * p.orbitRadius;
      const pLY = Math.sin(now * p.orbitSpeed * 10 + pAngle) * p.orbitRadius;
      
      const pWorldX = sysX + BigInt(Math.floor(pLX));
      const pWorldY = sysY + BigInt(Math.floor(pLY));
      
      const dx = Number(pWorldX - worldX2);
      const dy = Number(pWorldY - worldY2);
      const dist = Math.hypot(dx, dy);
      
      if (dist < Math.max(d, p.radius * 1.5)) {
        d = dist; 
        const coords = toSectorCoords(pWorldX, pWorldY);
        target = { 
          ...p,
          type: 'PLANET', 
          planetType: p.type,
          ...coords,
          parentSystem: sys
        };
      }

      // Satellites
      (p.satellites || []).forEach((sat: any, sIdx: number) => {
        const satAngle = sat.orbitAngle !== undefined ? sat.orbitAngle : sIdx;
        const satLX = pLX + Math.cos(now * sat.orbitSpeed * 10 + satAngle) * sat.orbitRadius;
        const satLY = pLY + Math.sin(now * sat.orbitSpeed * 10 + satAngle) * sat.orbitRadius;
        
        const satWorldX = sysX + BigInt(Math.floor(satLX));
        const satWorldY = sysY + BigInt(Math.floor(satLY));
        
        const ddx = Number(satWorldX - worldX2);
        const ddy = Number(satWorldY - worldY2);
        const sDist = Math.hypot(ddx, ddy);
        
        if (sDist < Math.max(d, sat.radius * 1.5)) {
          d = sDist;
          const coords = toSectorCoords(satWorldX, satWorldY);
          target = { 
            ...sat,
            type: 'SATELLITE', 
            satelliteType: sat.type,
            ...coords,
            parentSystem: sys
          };
        }
      });
    }

    // Space Stations
    for (const st of (sys.spaceStations || [])) {
      const stIdx = sys.spaceStations.indexOf(st);
      let localBaseX = 0;
      let localBaseY = 0;

      if (st.orbitTargetType === 'PLANET') {
        const pt = sys.planets?.find((p: any) => p.id === st.orbitTarget);
        if (pt) {
          const ptAngle = pt.orbitAngle !== undefined ? pt.orbitAngle : sys.planets.indexOf(pt);
          localBaseX = Math.cos(now * pt.orbitSpeed * 10 + ptAngle) * pt.orbitRadius;
          localBaseY = Math.sin(now * pt.orbitSpeed * 10 + ptAngle) * pt.orbitRadius;
        }
      } else if (st.orbitTargetType === 'SATELLITE') {
        for (const p of (sys.planets || [])) {
          const sat = p.satellites?.find((s: any) => s.id === st.orbitTarget);
          if (sat) {
            const pAngle = p.orbitAngle !== undefined ? p.orbitAngle : sys.planets.indexOf(p);
            const sAngle = sat.orbitAngle !== undefined ? sat.orbitAngle : p.satellites.indexOf(sat);
            localBaseX = Math.cos(now * p.orbitSpeed * 10 + pAngle) * p.orbitRadius + Math.cos(now * sat.orbitSpeed * 10 + sAngle) * sat.orbitRadius;
            localBaseY = Math.sin(now * p.orbitSpeed * 10 + pAngle) * p.orbitRadius + Math.sin(now * sat.orbitSpeed * 10 + sAngle) * sat.orbitRadius;
            break;
          }
        }
      } else if (st.orbitTargetType === 'ASTEROID_BELT' && st.orbitTarget?.includes('-p')) {
        const pt = sys.planets?.find((p: any) => st.orbitTarget.includes(p.id));
        if (pt) {
            const pAngle = pt.orbitAngle !== undefined ? pt.orbitAngle : sys.planets.indexOf(pt);
            localBaseX = Math.cos(now * pt.orbitSpeed * 10 + pAngle) * pt.orbitRadius;
            localBaseY = Math.sin(now * pt.orbitSpeed * 10 + pAngle) * pt.orbitRadius;
        }
      }

      const stLX = localBaseX + Math.cos(now * (st.orbitSpeed || 1e-8) * 10 + stIdx) * (st.orbitRadius || 20_000_000);
      const stLY = localBaseY + Math.sin(now * (st.orbitSpeed || 1e-8) * 10 + stIdx) * (st.orbitRadius || 20_000_000);
      
      const stWorldX = sysX + BigInt(Math.floor(stLX));
      const stWorldY = sysY + BigInt(Math.floor(stLY));
      
      const ddx = Number(stWorldX - worldX2);
      const ddy = Number(stWorldY - worldY2);
      const dist = Math.hypot(ddx, ddy);
      
      if (dist < Math.max(d, (st.radius || 1500) * 2.0)) {
        d = dist;
        const coords = toSectorCoords(stWorldX, stWorldY);
        target = { 
          ...st,
          type: 'STATION', 
          ...coords,
          parentSystem: sys
        };
      }
    }
  }
  return target;
}

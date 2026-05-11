// @ai-ignore-auto-remove: Core renderer methods used to draw world elements.
// Keep these methods and signatures intact for the rendering pipeline.

import { Camera } from '../game/engine/camera';
import { Renderer } from '../game/engine/renderer';
import { GlobalCoords } from '../components/game/types';
import { getHexCoords } from '../game/world/generator';
import { globalFactionManager } from './world/FactionManager';
import { ECS } from './engine/ecs';
import { CHUNK_SIZE_M, LOCAL_ORBIT_DRAW_RADIUS_M, PLAYER_CURRENT_SYSTEM_RADIUS_M, WARP_JUMP_RADIUS_M, SECTOR_SIZE_M } from '../game/constants';
import { ASTEROID_CHUNK_SIZE } from './world/AsteroidGridManager';

export const renderWorldObjects = (
  renderer: Renderer,
  camera: Camera,
  world: any,
  pos: any,
  curMode: string,
  now: number,
  engine: any,
  bounds: { minSecX: bigint, minSecY: bigint, maxSecX: bigint, maxSecY: bigint },
  settings: any
) => {
  const { minSecX, minSecY, maxSecX, maxSecY } = bounds;
  const showFields = settings?.showAsteroidFields !== false;

  // 2. Draw Stars and System-bound entities separately (User requested decoupling stars from asteroids/planets visually)
  const visibleSystems = world.getSystemsInViewport(minSecX, minSecY, maxSecX, maxSecY);

  const wx = Number(camera.pos.sectorX * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetX;
  const wy = Number(camera.pos.sectorY * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetY;

  if (curMode === 'STRATEGIC' && engine.globalMapRenderer) {
    engine.globalMapRenderer.drawConnectionsAndFactions(visibleSystems, camera, engine);
    engine.globalMapRenderer.drawUnloadedFleets(camera);
  }

  for (const system of visibleSystems) {
    const isVisited = engine.visited.has(system.id);
    const relPos = camera.getRelativePos(pos);
    const relSystem = camera.getRelativePos(system);
    const distToPlayer = Math.sqrt((relPos.x - relSystem.x) ** 2 + (relPos.y - relSystem.y) ** 2);

    // Star rendering logic
    if (curMode === 'LOCAL' && !isVisited && distToPlayer > PLAYER_CURRENT_SYSTEM_RADIUS_M * 2) {
      // Don't render undiscovered stars in local
    } else if (curMode === 'STRATEGIC') {
      const gmr = engine.globalMapRenderer;
      if (gmr) {
        const wt = engine.warpTarget;
        const relWt = wt ? camera.getRelativePos(wt) : null;
        const isTarget = !!relWt && relWt.x === relSystem.x && relWt.y === relSystem.y;
        const inRange = distToPlayer <= WARP_JUMP_RADIUS_M;
        gmr.drawStarSystemSpark(system, camera, now, isVisited, isTarget, inRange);
        
        // Draw the system boundary circle in strategic mode
        const screenSystem = camera.worldToScreen(system, renderer.width, renderer.height);
        const boundaryRadius = WARP_JUMP_RADIUS_M * camera.zoom;
        if (boundaryRadius > 2) {
          renderer.graphics.circle(screenSystem.x, screenSystem.y, boundaryRadius);
          renderer.graphics.stroke({ width: 1, color: 0x4488ff, alpha: 0.15 });
        }
      }
    } else {
      // Draw actual star body
      if (system.stars) {
          system.stars.forEach((star: any) => {
              const localPos = engine.celestial.getCelestialLocalPos(star, engine.currentTime);
              const starWithPos = { ...system, ...star, offsetX: system.offsetX + localPos.x, offsetY: system.offsetY + localPos.y, starRadius: star.radius, starColor: star.color };
              renderer.drawStar(starWithPos, camera, false, now);

              // FIXME: эти линии орбит чуток смещены относительно центра тел что на них крутятся
              if (curMode === 'TACTICAL' && star.orbitRadius && star.orbitRadius > 0) {
                 const parentPos = engine.celestial.getCelestialLocalPos({ orbitCenterId: star.orbitCenterId, id: 'virtual_parent_star' }, engine.currentTime);
                 const centerCoords = { sectorX: system.sectorX, sectorY: system.sectorY, offsetX: system.offsetX + parentPos.x, offsetY: system.offsetY + parentPos.y };
                 renderer.drawAsteroidRing(centerCoords, star.orbitRadius, star.orbitRadius, camera, now);
              }
          });
      } else {
          renderer.drawStar(system, camera, false, now);
      }
    }

    // Planetary / Asteroid rendering logic decoupled from star visibility checks
    if (curMode !== 'STRATEGIC') {
      // Planetary Asteroid Belts (visually)
      system.asteroidBelts?.forEach((belt: any) => {
         const localPos = engine.celestial.getCelestialLocalPos({ orbitCenterId: belt.orbitCenterId, id: belt.id, orbitRadius: 0 }, engine.currentTime);
         const centerCoords = {
             sectorX: system.sectorX,
             sectorY: system.sectorY,
             offsetX: system.offsetX + localPos.x,
             offsetY: system.offsetY + localPos.y
         };
         renderer.drawAsteroidRing(centerCoords, belt.minRadius, belt.maxRadius, camera, now);
         
         // FIXME: эти линии орбит чуток смещены относительно центра тел что на них крутятся
         if (curMode === 'TACTICAL') {
             // Optional: middle hint line or bounding rings
             renderer.drawAsteroidRing(centerCoords, belt.minRadius, belt.minRadius, camera, now);
             renderer.drawAsteroidRing(centerCoords, belt.maxRadius, belt.maxRadius, camera, now);
         }
      });
      
      // Planets
      system.planets?.forEach((p: any) => {
        const localPos = engine.celestial.getCelestialLocalPos(p, engine.currentTime);
        
        const planetWithPos = {
            ...p,
            sectorX: system.sectorX,
            sectorY: system.sectorY,
            offsetX: system.offsetX + localPos.x,
            offsetY: system.offsetY + localPos.y
        };
        
        // Draw Planet itself
        renderer.drawPlanet(planetWithPos, camera, now, { x: -localPos.x, y: -localPos.y });
        
        // FIXME: эти линии орбит чуток смещены относительно центра тел что на них крутятся
        if (curMode === 'TACTICAL' && p.orbitRadius && p.orbitRadius > 0) {
           const parentPos = engine.celestial.getCelestialLocalPos({ orbitCenterId: p.orbitCenterId, id: 'virtual_parent_planet' }, engine.currentTime);
           const centerCoords = { sectorX: system.sectorX, sectorY: system.sectorY, offsetX: system.offsetX + parentPos.x, offsetY: system.offsetY + parentPos.y };
           renderer.drawAsteroidRing(centerCoords, p.orbitRadius, p.orbitRadius, camera, now);
        }

        // Draw Satellites
        p.satellites?.forEach((sat: any) => {
            const satLocalPos = engine.celestial.getCelestialLocalPos(sat, engine.currentTime);
            
            const satWithPos = {
               ...sat,
               sectorX: system.sectorX,
               sectorY: system.sectorY,
               offsetX: system.offsetX + satLocalPos.x,
               offsetY: system.offsetY + satLocalPos.y
            };
            
            renderer.drawPlanet(satWithPos, camera, now, { x: -satLocalPos.x, y: -satLocalPos.y });
            
            // FIXME: эти линии орбит чуток смещены относительно центра тел что на них крутятся
            if (curMode === 'TACTICAL' && sat.orbitRadius && sat.orbitRadius > 0) {
               const centerCoords = planetWithPos; // satellite orbits planet
               renderer.drawAsteroidRing(centerCoords, sat.orbitRadius, sat.orbitRadius, camera, now);
            }
        });
      });

      // Space Stations
      system.spaceStations?.forEach((st: any) => {
        const localPos = engine.celestial.getCelestialLocalPos(st, engine.currentTime);
        const centerCoords = {
             sectorX: system.sectorX,
             sectorY: system.sectorY,
             offsetX: system.offsetX + localPos.x,
             offsetY: system.offsetY + localPos.y
        };
        camera.normalize(centerCoords);
        const factionColor = globalFactionManager.getFaction(st.factionId)?.color || '#aa88ff';
        renderer.drawSpaceStation(centerCoords, camera, renderer.width, renderer.height, factionColor);

        if (curMode === 'TACTICAL' && st.orbitRadius && st.orbitRadius > 0) {
           const parentPos = engine.celestial.getCelestialLocalPos({ orbitCenterId: st.orbitTarget || st.orbitCenterId, id: 'virtual_parent_station' }, engine.currentTime);
           const parentCoords = { sectorX: system.sectorX, sectorY: system.sectorY, offsetX: system.offsetX + parentPos.x, offsetY: system.offsetY + parentPos.y };
           // FIXME: эти линии орбит чуток смещены относительно центра тел что на них крутятся
           renderer.drawAsteroidRing(parentCoords, st.orbitRadius, st.orbitRadius, camera, now);
        }
      });
    }
  }

  // --- ASTEROID FIELD VISUALIZATION (Old style "Fog" based on Chunks) ---
  if (showFields) {
      engine.asteroidGrid.loadedChunks.forEach((chunk: any) => {
          if (chunk.isAsteroidField) {
              const isFaint = curMode === 'STRATEGIC';
              renderer.drawAsteroidCluster(chunk, camera, renderer.width, renderer.height, isFaint);
          }
      });
  }

  // High performance limit: only render individual sprites when zoomed in enough 
  // to actually distinguish them (zoom > 0.005)
  if ((curMode === 'LOCAL' || curMode === 'TACTICAL') && camera.zoom > 0.005) {
    const r = renderer;
    const viewW = r.width / camera.zoom;
    const viewH = r.height / camera.zoom;
    // Tighter boundary for visible asteroids to reduce CPU iteration count
    const boundMult = curMode === 'TACTICAL' ? 1.1 : 1.3;
    let visibleAsteroids = engine.asteroidGrid.getVisibleAsteroids(
      wx - viewW * boundMult, wy - viewH * boundMult, 
      wx + viewW * boundMult, wy + viewH * boundMult
    );
    
    // 1. Draw all asteroids first
    if (curMode === 'TACTICAL') {
       visibleAsteroids = visibleAsteroids.filter((ast: any) => {
         const isMiningTarget = ast.id === engine.miningTargetId;
         const isTargeting = ast.id === engine.targetAsteroidId;
         // In tactical, only show medium/large asteroids if scanned, plus targets
         return (now - engine.lastAsteroidScan < 10000 && ast.radius > 800) || isTargeting || isMiningTarget;
       });
    }

    renderer.updateAsteroidInstances(visibleAsteroids, camera, now, engine.targetAsteroidId, engine.miningTargetId);

    // 2. Draw targeting frames on top of everything
    visibleAsteroids.forEach((ast: any) => {
       if (ast.depleted) return;
       const isTargeting = ast.id === engine.targetAsteroidId;
       
       if (isTargeting && engine.targetingStartTime > 0) {
          const progress = Math.min(1, (now - engine.targetingStartTime) / 5000);
          const screen = camera.worldToScreen({
            sectorX: ast.sectorX, sectorY: ast.sectorY,
            offsetX: ast.offsetX, offsetY: ast.offsetY
          }, renderer.width, renderer.height);
          
          // Technical Targeter - Dynamic radius based on asteroid size
          // Multiplier increased for visibility on massive objects
          const r = Math.max(ast.radius * camera.zoom * 2.2, 30); 
          const pts: {x: number, y: number}[] = [];
          for (let i = 0; i < 5; i++) {
            const angle = i * (Math.PI * 2 / 5) - Math.PI / 2;
            pts.push({ x: screen.x + Math.cos(angle) * r, y: screen.y + Math.sin(angle) * r });
          }
          
          const edges = 5;
          const totalProgress = progress * edges;
          
          // Draw faint background frame
          renderer.graphics.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) renderer.graphics.lineTo(pts[i].x, pts[i].y);
          renderer.graphics.closePath();
          renderer.graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.15 });

          // Draw active progress edges
          renderer.graphics.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i <= edges; i++) {
            const prev = pts[i-1];
            const next = pts[i % edges];
            if (totalProgress >= i) renderer.graphics.lineTo(next.x, next.y);
            else if (totalProgress > i - 1) {
              const part = totalProgress - (i - 1);
              renderer.graphics.lineTo(prev.x + (next.x - prev.x) * part, prev.y + (next.y - prev.y) * part);
              break;
            }
          }
          renderer.graphics.stroke({ color: 0x00ffff, width: 3, alpha: 0.9 });
          
          // Technical crosshair corners inside the pentagon
          const crossSize = 10;
          renderer.graphics.moveTo(screen.x - crossSize, screen.y); renderer.graphics.lineTo(screen.x + crossSize, screen.y);
          renderer.graphics.moveTo(screen.x, screen.y - crossSize); renderer.graphics.lineTo(screen.x, screen.y + crossSize);
          renderer.graphics.stroke({ color: 0x00ffff, width: 1, alpha: 0.5 });
          
          // Inner pulsing lock-core
          const pulse = 0.4 + Math.sin(now * 0.015) * 0.3;
          renderer.graphics.circle(screen.x, screen.y, 3);
          renderer.graphics.fill({ color: 0x00ffff, alpha: pulse });
       }
    });
  } else {
    renderer.updateAsteroidInstances([], camera, now);
  }
};

export const renderTacticalOverlays = (
    renderer: Renderer,
    camera: Camera,
    engine: any,
    pos: any,
    curMode: string,
    now: number,
    layer: 'DORSAL' | 'VENTRAL' = 'DORSAL'
) => {
  // ── Tactical route visualization (LOCAL + TACTICAL views) ──
  // Only draw route on dorsal layer to avoid complex splitting unless requested
  if (layer === 'DORSAL') {
    const route = engine.tacticalRoute;
    if ((curMode === 'LOCAL' || curMode === 'TACTICAL') && route.length > 0) {
      let prevPos = pos;
      route.forEach((wp: any, idx: number) => {
        renderer.drawLine(prevPos, wp, 'rgba(160,100,255,0.45)', 2, camera, true);
        renderer.drawCircle(wp, 2.5, idx === 0 ? 'rgba(180,120,255,0.9)' : 'rgba(120,80,200,0.7)', camera, true);
        prevPos = wp;
      });
    }
  }

  // Old mining beam logic removed (now rendered by ShipRenderer)

  // ── Warp target crosshair (TACTICAL view) ──
  if (layer === 'DORSAL') {
    const wt = engine.warpTarget;
    if (curMode === 'TACTICAL' && wt) {
      renderer.drawCircle(wt, 5, 'rgba(0,220,255,0.8)', camera, true);
    }
  }

  // ── Combat Lock Progress (LOCAL + TACTICAL) ──
  if (layer === 'DORSAL') {
    const isMainManual = !engine.fireGroupSemiAuto['MAIN'];
    const playerPos = engine.ecs.getPosition(engine.player!);
    
    if (isMainManual && curMode === 'LOCAL' && playerPos && engine.interactionMode === 'COMBAT') {
       const screenPos = camera.worldToScreen(engine.mouseWorld, renderer.width, renderer.height);
       renderer.drawManualCrosshair(screenPos);
    } else {
        if (engine.combatLockProgress > 0 && playerPos) {
          // Normalize progress based on hover state (2s vs 3s)
          // We can't easily know threshold here without re-checking hover, so we'll just check hoverEntity again
          // or assume 2s for now as a baseline
          const threshold = engine.combatLockTarget === null ? 2 : 3;
          const displayProgress = Math.min(1, engine.combatLockProgress / threshold);
          const screenPos = camera.worldToScreen(engine.mouseWorld, renderer.width, renderer.height);
          renderer.drawCombatLock(screenPos, displayProgress);
        }
    }
    
    // Draw relative fire point if it exists
    if (engine.relativeFirePointOffset && playerPos) {
      // Calculate current world position from offset
      const rfpWorld: GlobalCoords = {
          sectorX: playerPos.sectorX,
          sectorY: playerPos.sectorY,
          offsetX: playerPos.offsetX + engine.relativeFirePointOffset.x,
          offsetY: playerPos.offsetY + engine.relativeFirePointOffset.y
      };
      camera.normalize(rfpWorld);
      
      const screenPos = camera.worldToScreen(rfpWorld, renderer.width, renderer.height);
      const shipScreen = camera.worldToScreen(playerPos, renderer.width, renderer.height);
      
      renderer.drawRelativeFirePoint(screenPos, shipScreen);
    }

    // Draw indicators for designated targets
    engine.designatedTargets.forEach((id: any) => {
        const targetPos = engine.ecs.getPosition(id);
        if (targetPos) {
            const screen = camera.worldToScreen(targetPos, renderer.width, renderer.height);
            // Only draw if on screen
            if (screen.x > 0 && screen.x < renderer.width && screen.y > 0 && screen.y < renderer.height) {
                const isSelected = engine.combatTargetId === id;
                const faction = (engine.ecs as ECS).getComponent<any>(id, 'Faction');
                renderer.drawTargetIndicator(screen, faction?.color || '#ff4444', isSelected);
            }
        }
    });

    // Draw fire angle indicator if set
    if (engine.lastManualAngle !== null) {
      const playerPos = engine.ecs.getPosition(engine.player!);
      if (playerPos) {
          const angle = playerPos.angle + engine.lastManualAngle;
          const dist = 300 / camera.zoom;
          const targetWorld = {
              ...playerPos,
              offsetX: playerPos.offsetX + Math.cos(angle) * dist,
              offsetY: playerPos.offsetY + Math.sin(angle) * dist
          };
          const screenPos = camera.worldToScreen(targetWorld, renderer.width, renderer.height);
          renderer.drawCircle(screenPos, 4, 'rgba(255, 100, 100, 0.7)', camera, true);
          renderer.drawLine(camera.worldToScreen(playerPos, renderer.width, renderer.height), screenPos, 'rgba(255, 100, 100, 0.2)', 1, camera, true);
      }
    }
  }

  // ── Asteroid Scan Effect (TACTICAL view) ──
  if (layer === 'DORSAL') {
    const scanTime = now - engine.lastAsteroidScan;
    if (curMode === 'TACTICAL' && scanTime < 10000 && engine.scannedChunkCoords) {
      const scanProgress = Math.min(1, scanTime / 2000); // Expands over 2 seconds
      if (scanProgress < 1) {
        const scanRadius = scanProgress * CHUNK_SIZE_M;
        renderer.drawCircle(engine.scannedChunkCoords, scanRadius, `rgba(0, 255, 200, ${0.3 * (1 - scanProgress)})`, camera);
      }
    }
  }
};

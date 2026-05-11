
import { ECS } from '../engine/ecs';
import { Renderer } from '../engine/renderer';
import { Camera } from '../engine/camera';
import { Position, Hull, Faction, GlobalCoords } from '../engine/types';
import { getLargestShipDimension } from '../hullGeometry';

export function renderSystem(ecs: ECS, renderer: Renderer, camera: Camera, internalView: boolean = false, engine?: any) {
  const entities = ecs.getEntitiesWith(['Position', 'Hull']);
  
  const cw = renderer.width;
  const ch = renderer.height;

  for (const entity of entities) {
    // Skip player ship rendering in ECS system if the editor is open (it's drawn via draftHull manually)
    if (engine?.isEditorOpen && ecs.getComponent(entity, 'Player')) {
      continue;
    }

    const pos  = ecs.getPosition(entity)!;
    const hull = ecs.getHull(entity)!;
    const isLocalPlayer = ecs.getComponent(entity, 'Player') !== undefined;

    // Quick frustum cull
    const screen = camera.worldToScreen(pos, cw, ch);
    const maxDim = getLargestShipDimension(hull) * camera.zoom;
    if (screen.x + maxDim < 0 || screen.x - maxDim > cw ||
        screen.y + maxDim < 0 || screen.y - maxDim > ch) {
      continue;
    }

    if (camera.zoom < 0.005 || engine?.viewMode === 'STRATEGIC') { // strategic map scale
      // Performance optimization: 
      // In Strategic mode, only draw local player dot
      // In Tactical mode, skip dots if zoomed out too far to prevent screen clutter and lag
      if (engine?.viewMode === 'STRATEGIC' && !isLocalPlayer) {
          continue;
      }
      
      if (engine?.viewMode === 'TACTICAL' && camera.zoom < 0.00001 && !isLocalPlayer) {
          continue;
      }
      
      const r = isLocalPlayer ? 4 : 2;
      const faction = ecs.getComponent<Faction>(entity, 'Faction');
      const color = isLocalPlayer ? '#00ffff' : (faction ? faction.color : '#ffffff');
      renderer.drawCircle(pos, r, color, camera, true);
      if (isLocalPlayer) {
          // Extra ping effect for player on map
          const time = performance.now() * 0.003;
          const pingR = r + Math.sin(time) * 4;
          renderer.drawCircle(pos, pingR, color, camera, true);
      }
    } else {
      renderer.drawShip(pos, pos.angle, hull, camera, false, isLocalPlayer ? internalView : false, engine, ecs, entity);
      
      // Draw faction name / label 
      if (!isLocalPlayer && camera.zoom > 0.05) {
          const faction = ecs.getComponent<Faction>(entity, 'Faction');
          if (faction) {
             renderer.drawText({
                sectorX: pos.sectorX,
                sectorY: pos.sectorY,
                offsetX: pos.offsetX,
                offsetY: pos.offsetY - maxDim / camera.zoom - 20 // above the ship
             }, faction.name, 12, faction.color, camera);
          }
      }
    }
  }

  // Render Loot
  const lootEntities = ecs.getEntitiesWith(['Position', 'Loot']);
  for (const entity of lootEntities) {
    const pos = ecs.getPosition(entity)!;
    renderer.drawLoot(pos, camera);
  }

  // Render Projectiles
  renderer.drawProjectiles(engine, camera);

  // Render Target Indicator for Analyzed Target
  if (engine?.analyzedTarget) {
    const target = engine.analyzedTarget;
    let coords: GlobalCoords;
    if (target.type === 'SHIP' && target.entity !== undefined) {
       const pos = ecs.getPosition(target.entity);
       if (pos) coords = pos;
       else coords = target;
    } else {
       coords = target;
    }
    
    const screen = camera.worldToScreen(coords, cw, ch);
    // Determine color based on target type
    const color = target.type === 'SHIP' ? '#ff4444' : (target.type === 'PLANET' ? '#ffff00' : '#00ffff');
    renderer.drawTargetIndicator(screen, color, true);
    
    // Draw text label
    const label = target.type === 'SHIP' ? (target.hull?.name || 'Enemy Ship') : (target.name || target.type);
    renderer.drawText({
        ...coords,
        offsetY: coords.offsetY - 40 / camera.zoom
    }, label, 14, color, camera);
  }

  // Render mouse action hold progress
  if (engine?.mouseActionHold) {
    const hold = engine.mouseActionHold;
    const progress = Math.min(1, Math.max(0, (performance.now() - hold.startTime) / hold.duration));
    renderer.drawCombatLock(hold.pos, progress, hold.color || '#00ffff');
  }
}


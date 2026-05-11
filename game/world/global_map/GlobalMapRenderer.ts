import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { Camera } from '../../engine/camera';
import { GlobalCoords } from '../../../components/game/types';
import { StarSystem } from '../types';
import { globalFactionManager } from '../FactionManager';
import { ACCENT_COLOR, WARP_JUMP_RADIUS_M, SECTOR_SIZE_M } from '../../constants';
import { Renderer } from '../../engine/renderer';

type TerritoryRegion = {
    factionId: string;
    points: [number, number][][][]; // MultiPolygon
    color: number;
};

export class GlobalMapRenderer {
  private renderer: Renderer;
  private regionCache: TerritoryRegion[] = [];
  private lastSystemsIdHash: string = '';

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  clear() {
    // No longer needed as renderer.clear() clears the shared graphics
  }

  private colorToNumber(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16);
    }
    return 0xffffff;
  }

  drawStarSystemSpark(
    system: StarSystem,
    camera: Camera,
    time: number,
    discovered: boolean,
    isSelected: boolean,
    inRange: boolean,
  ) {
    const screen = camera.worldToScreen(system, this.renderer.width, this.renderer.height);
    const screenX = screen.x;
    const screenY = screen.y;

    if (
      screenX + 12 < 0 || screenX - 12 > this.renderer.width ||
      screenY + 12 < 0 || screenY - 12 > this.renderer.height
    ) return;

    const graphics = this.renderer.graphics;

    if (!discovered) {
      graphics.circle(screenX, screenY, 1);
      graphics.fill({ color: 0xffffff, alpha: 0.06 });
      return;
    }

    const hash = system.id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
    const phase = (hash & 0xffff) / 0xffff * Math.PI * 2;
    const twinkle = 0.55 + 0.45 * Math.sin(time * 0.001 * (1.2 + (hash & 0xff) / 512) + phase);

    const baseColor = this.colorToNumber(system.starColor);
    const alpha = twinkle;

    const r = isSelected ? 4 : 2;
    graphics.circle(screenX, screenY, r);
    graphics.fill({ color: isSelected ? this.colorToNumber(ACCENT_COLOR) : baseColor, alpha });

    const haloR = isSelected ? 12 : 7;
    graphics.circle(screenX, screenY, haloR);
    graphics.fill({ color: isSelected ? this.colorToNumber(ACCENT_COLOR) : baseColor, alpha: alpha * 0.3 });

    if (inRange && !isSelected) {
      graphics.circle(screenX, screenY, 6);
      graphics.stroke({ width: 1, color: this.colorToNumber(ACCENT_COLOR), alpha: 0.3 });
    }

    if (isSelected) {
      const s = 10;
      const accent = this.colorToNumber(ACCENT_COLOR);
      graphics.beginPath();
      graphics.moveTo(screenX - s, screenY);
      graphics.lineTo(screenX + s, screenY);
      graphics.moveTo(screenX, screenY - s);
      graphics.lineTo(screenX, screenY + s);
      graphics.stroke({ width: 1, color: accent, alpha: 0.8 });
    }
  }

  drawWarpRadius(pos: GlobalCoords, radius: number, camera: Camera) {
    const screen = camera.worldToScreen(pos, this.renderer.width, this.renderer.height);
    const screenX = screen.x;
    const screenY = screen.y;
    const screenR = radius * camera.zoom;

    if (screenR < 2) return;

    const graphics = this.renderer.graphics;
    graphics.circle(screenX, screenY, screenR);
    graphics.stroke({ width: 1, color: this.colorToNumber(ACCENT_COLOR), alpha: 0.2 });
  }

  drawWarpTarget(pos: GlobalCoords, camera: Camera) {
    const screen = camera.worldToScreen(pos, this.renderer.width, this.renderer.height);
    const screenX = screen.x;
    const screenY = screen.y;
    
    const s = 4;
    const accent = this.colorToNumber(ACCENT_COLOR);
    const graphics = this.renderer.graphics;
    graphics.beginPath();
    graphics.moveTo(screenX - s, screenY);
    graphics.lineTo(screenX + s, screenY);
    graphics.moveTo(screenX, screenY - s);
    graphics.lineTo(screenX, screenY + s);
    graphics.stroke({ width: 1, color: accent, alpha: 0.9 });
    
    graphics.circle(screenX, screenY, s * 0.6);
    graphics.stroke({ width: 1, color: accent, alpha: 0.9 });
  }

  drawUnloadedFleets(camera: Camera) {
    const factions = globalFactionManager.getAllFactions();
    const graphics = this.renderer.graphics;

    for (const faction of factions) {
      if (!faction.fleets) continue;
      for (const fleet of faction.fleets) {
        if (!fleet.isLoaded) {
          const screen = camera.worldToScreen({
              sectorX: fleet.position.sectorX,
              sectorY: fleet.position.sectorY,
              offsetX: fleet.position.offsetX,
              offsetY: fleet.position.offsetY
          }, this.renderer.width, this.renderer.height);
          
          if (screen.x < -10 || screen.x > this.renderer.width + 10 ||
              screen.y < -10 || screen.y > this.renderer.height + 10) continue;

          // Draw a small triangle for the fleet
          const size = Math.max(3, camera.zoom * 100000);
          graphics.beginPath();
          graphics.moveTo(screen.x, screen.y - size);
          graphics.lineTo(screen.x + size * 0.866, screen.y + size * 0.5);
          graphics.lineTo(screen.x - size * 0.866, screen.y + size * 0.5);
          graphics.closePath();
          graphics.fill({ color: this.colorToNumber(faction.color), alpha: 0.3 });
          graphics.stroke({ width: 1, color: this.colorToNumber(faction.color), alpha: 0.8 });
          
          this.renderer.drawText(
              { sectorX: fleet.position.sectorX, sectorY: fleet.position.sectorY, offsetX: fleet.position.offsetX, offsetY: fleet.position.offsetY - 2000000 },
              `${fleet.name} (${fleet.unloadedShipCount})`,
              8,
              faction.color,
              camera
          );
        }
      }
    }
  }

  drawConnectionsAndFactions(
    systems: StarSystem[],
    camera: Camera,
    engine: any
  ) {
    const graphics = this.renderer.graphics;
    const drawnConnections = new Set<string>();

    // STRATEGIC Mode Territorial Regions (Voronoi)
    if (engine.viewMode === 'STRATEGIC' && systems.length > 2 && camera.zoom > 1e-15) {
        this.updateTerritorialRegions(systems, engine, camera);
        this.drawTerritorialRegions(camera);
    }

    const factionLabelsDrawn = new Set<string>();
    const sysMap = new Map<string, StarSystem>();
    for (const s of systems) if (s) sysMap.set(s.id, s);

    for (const sysA of systems) {
      if (!sysA) continue;
      const isVisitedA = engine.visited.has(sysA.id);
      const isScannedA = engine.scanned.has(sysA.id);
      
      const screenA = camera.worldToScreen(sysA, this.renderer.width, this.renderer.height);
      
      // Faction territory labels - refined to prevent clutter
      if (sysA.factionId && isVisitedA && camera.zoom > 1e-11) {
         const faction = globalFactionManager.getFaction(sysA.factionId);
         if (faction) {
             const labelKey = `${sysA.factionId}_${sysA.sectorX}_${sysA.sectorY}`;
             // Only draw label for "important" systems or spaced out labels
             if (camera.zoom > 1e-10 || !factionLabelsDrawn.has(sysA.factionId)) {
                const baseRadius = WARP_JUMP_RADIUS_M * 0.4;
                this.renderer.drawText(
                    { sectorX: sysA.sectorX, sectorY: sysA.sectorY, offsetX: sysA.offsetX, offsetY: sysA.offsetY - baseRadius - 2000 },
                    faction.shortName || faction.name,
                    camera.zoom > 1e-9 ? 10 : 8,
                    faction.color,
                    camera
                );
                factionLabelsDrawn.add(sysA.factionId);
             }
         }
      }

      // Draw Gravitational Lanes (Connections)
      if (isScannedA && sysA.connectedSystemIds) {
        for (const targetId of sysA.connectedSystemIds) {
          const hashId = sysA.id < targetId ? `${sysA.id}-${targetId}` : `${targetId}-${sysA.id}`;
          if (drawnConnections.has(hashId)) continue;

          // Find target system locally (if in viewport)
          const sysB = sysMap.get(targetId);
          if (sysB) {
            const isScannedB = engine.scanned.has(targetId);
            const screenB = camera.worldToScreen(sysB, this.renderer.width, this.renderer.height);
            
            if (isScannedB) {
              // Full line between scanned systems
              graphics.beginPath();
              graphics.moveTo(screenA.x, screenA.y);
              graphics.lineTo(screenB.x, screenB.y);
              graphics.stroke({ width: 1.5, color: 0x4488ff, alpha: 0.25 });
              drawnConnections.add(hashId);
            } else {
              // Half line to unscanned system
              const midX = screenA.x + (screenB.x - screenA.x) * 0.5;
              const midY = screenA.y + (screenB.y - screenA.y) * 0.5;

              graphics.beginPath();
              graphics.moveTo(screenA.x, screenA.y);
              graphics.lineTo(midX, midY);
              graphics.stroke({ width: 1.2, color: 0x4488ff, alpha: 0.15 });
            }
          }
        }
      }
    }
  }

  private updateTerritorialRegions(systems: StarSystem[], engine: any, camera: Camera) {
    const idHash = `${systems.length}_${systems[0]?.id}_${systems[0]?.factionId}_${systems[systems.length - 1]?.id}_${systems[systems.length - 1]?.factionId}`;
    if (idHash === this.lastSystemsIdHash) return;
    this.lastSystemsIdHash = idHash;

    const points: [number, number][] = [];
    const factionMap: string[] = [];
    
    const centerX = systems.length > 0 ? systems[0].sectorX : 0n;
    const centerY = systems.length > 0 ? systems[0].sectorY : 0n;

    for (const sys of systems) {
        if (!sys) continue;
        const x = Number(sys.sectorX - BigInt(centerX)) * SECTOR_SIZE_M + sys.offsetX;
        const y = Number(sys.sectorY - BigInt(centerY)) * SECTOR_SIZE_M + sys.offsetY;
        points.push([x, y]);
        factionMap.push(sys.factionId || 'NEUTRAL');
    }

    if (points.length < 3) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });
    
    const pad = 1e18;
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([minX - pad, minY - pad, maxX + pad, maxY + pad]);

    const regionsByFaction: Record<string, [number, number][][][]> = {};

    for (let i = 0; i < points.length; i++) {
        const factionId = factionMap[i];
        if (factionId === 'NEUTRAL') continue;

        const poly = voronoi.cellPolygon(i);
        if (!poly) continue;

        const polyFormatted: [number, number][][][] = [[poly as [number, number][]]];

        if (!regionsByFaction[factionId]) {
            regionsByFaction[factionId] = polyFormatted;
        } else {
            regionsByFaction[factionId] = polygonClipping.union(regionsByFaction[factionId], polyFormatted) as [number, number][][][];
        }
    }

    this.regionCache = Object.entries(regionsByFaction).map(([factionId, polys]) => {
        const faction = globalFactionManager.getFaction(factionId);
        return {
            factionId,
            points: polys, 
            color: this.colorToNumber(faction?.color || '#ffffff'),
            refSectorX: centerX,
            refSectorY: centerY
        };
    });
  }

  private drawTerritorialRegions(camera: Camera) {
    const graphics = this.renderer.graphics;

    for (const region of this.regionCache) {
        const refX = (region as any).refSectorX;
        const refY = (region as any).refSectorY;

        for (const multiPoly of region.points) {
            const poly = multiPoly as any as [number, number][][]; // Polygon [Ring, Ring, ...]
            
            for (let r = 0; r < poly.length; r++) {
                const ring = poly[r];
                if (ring.length < 3) continue;

                graphics.beginPath();
                for (let i = 0; i < ring.length; i++) {
                    const [wx, wy] = ring[i];
                    const screen = camera.worldToScreen({
                        sectorX: refX,
                        sectorY: refY,
                        offsetX: wx,
                        offsetY: wy
                    }, this.renderer.width, this.renderer.height);
                    if (i === 0) graphics.moveTo(screen.x, screen.y);
                    else graphics.lineTo(screen.x, screen.y);
                }
                graphics.closePath();
                
                graphics.fill({ color: region.color, alpha: 0.05 });
                if (r === 0) {
                    graphics.stroke({ width: 1.5, color: region.color, alpha: 0.2 });
                } else {
                    graphics.stroke({ width: 0.8, color: region.color, alpha: 0.1 });
                }
            }
        }
    }
  }
}

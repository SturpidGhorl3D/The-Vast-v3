
import { GameEngine } from '../GameEngine';
import { SECTOR_SIZE_M, LIGHT_YEAR_M, PLAYER_DISCOVER_SYSTEM_RADIUS_M } from '@/game/constants';
import { globalFactionManager } from '@/game/world/FactionManager';

export class DiscoveryManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public update(posRef: any, dt: number) {
    const { world, camera, renderer } = this.engine;
    const sectorKey = `${posRef.sectorX},${posRef.sectorY}`;

    if (sectorKey !== (this.engine as any).lastSectorKey) {
      (this.engine as any).lastSectorKey = sectorKey;
      if (typeof (world as any).generateDeepSpaceClustersForSector === 'function') {
        (world as any).generateDeepSpaceClustersForSector(posRef.sectorX, posRef.sectorY);
      }
    }

    const width = renderer.width;
    const height = renderer.height;
    const viewMin = camera.screenToWorld(0, 0, width, height);
    const viewMax = camera.screenToWorld(width, height, width, height);
    
    // Explicitly use BigInt for large world coordinate multiplications to avoid safe integer overflow
    const secSizeBI = BigInt(SECTOR_SIZE_M);
    this.engine.asteroidGrid.update({
      sectorX: posRef.sectorX,
      sectorY: posRef.sectorY,
      offsetX: posRef.offsetX,
      offsetY: posRef.offsetY
    }, { currentSystem: this.engine.currentSystem }, camera.zoom);

    const nearbySystems = world.getSystemsInViewport(viewMin.sectorX, viewMin.sectorY, viewMax.sectorX, viewMax.sectorY);

    let newCurrentSystem = null;
    let minSystemDist = Infinity;
    for (const sys of nearbySystems) {
      // Use BigInt for distance to avoid precision loss at large sector offsets
      const dxBI = (sys.sectorX - posRef.sectorX) * secSizeBI + BigInt(Math.floor(sys.offsetX - posRef.offsetX));
      const dyBI = (sys.sectorY - posRef.sectorY) * secSizeBI + BigInt(Math.floor(sys.offsetY - posRef.offsetY));
      const dist = Math.sqrt(Number(dxBI * dxBI + dyBI * dyBI));
      
      if (dist < PLAYER_DISCOVER_SYSTEM_RADIUS_M && !this.engine.visited.has(sys.id)) {
        this.engine.visited.add(sys.id);
        
        // Grant Innovation Point for discovery
        if (this.engine.orgType !== 'STATE') {
           this.engine.innovationPoints += 1;
        }
      }

      if (dist < 2 * LIGHT_YEAR_M) {
        if (dist < minSystemDist) {
          minSystemDist = dist;
          newCurrentSystem = sys;
        }
      }
    }
    this.engine.currentSystem = newCurrentSystem;
  }

  public performAsteroidScan() {
    this.engine.lastAsteroidScan = Date.now();
    if (this.engine.player === null) return;
    
    const pos = this.engine.ecs.getComponent<any>(this.engine.player, 'Position')!;
    const playerRel = this.engine.camera.getRelativePos(pos);
    const nearestSystem = this.engine.world.getNearestSystem(pos.sectorX, pos.sectorY, pos.offsetX, pos.offsetY);
    let foundCluster = null;

    const isPointInCluster = (px: number, py: number, cluster: any, clusterRel: {x: number, y: number}) => {
      const dist = Math.sqrt((px - clusterRel.x) ** 2 + (py - clusterRel.y) ** 2);
      if (dist > cluster.radius) return false;
      if (cluster.isRing) {
        return dist >= (cluster.ringInnerRadius || 0) && dist <= (cluster.ringOuterRadius || cluster.radius);
      }
      if (cluster.boundaryPoints && cluster.boundaryPoints.length >= 3) {
        let inside = false;
        for (let i = 0, j = cluster.boundaryPoints.length - 1; i < cluster.boundaryPoints.length; j = i++) {
          const xi = clusterRel.x + cluster.boundaryPoints[i].x - cluster.clusterOffsetX;
          const yi = clusterRel.y + cluster.boundaryPoints[i].y - cluster.clusterOffsetY;
          const xj = clusterRel.x + cluster.boundaryPoints[j].x - cluster.clusterOffsetX;
          const yj = clusterRel.y + cluster.boundaryPoints[j].y - cluster.clusterOffsetY;
          const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
      return true;
    };

    if (nearestSystem) {
      for (const cluster of nearestSystem.asteroidClusters || []) {
        const clusterRel = this.engine.camera.getRelativePos(cluster);
        if (isPointInCluster(playerRel.x, playerRel.y, cluster, clusterRel)) {
          foundCluster = cluster;
          this.engine.scannedClusterId = cluster.id;
          this.populateScannedChunk(playerRel, cluster, clusterRel);
          break;
        }
      }
    }
    if (foundCluster === null) {
      for (const cluster of this.engine.world.getDeepSpaceClusters()) {
        const clusterRel = this.engine.camera.getRelativePos(cluster);
        if (isPointInCluster(playerRel.x, playerRel.y, cluster, clusterRel)) {
          this.engine.scannedClusterId = cluster.id;
          this.populateScannedChunk(playerRel, cluster, clusterRel);
          break;
        }
      }
    }
  }

  private populateScannedChunk(playerRel: {x: number, y: number}, cluster: any, clusterRel: {x: number, y: number}) {
    const { getHexCoords, CHUNK_SIZE_M } = require('../../world/generator');
    const { q, r } = getHexCoords(playerRel.x - clusterRel.x, playerRel.y - clusterRel.y, CHUNK_SIZE_M);
    this.engine.scannedChunkKey = `${q},${r}`;
    const cx = CHUNK_SIZE_M * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
    const cy = CHUNK_SIZE_M * (3/2 * r);
    this.engine.scannedChunkCoords = {
      sectorX: cluster.sectorX,
      sectorY: cluster.sectorY,
      offsetX: cluster.offsetX + cx,
      offsetY: cluster.offsetY + cy
    };
  }

  public getNearbyFactionsWithStations(): string[] {
    if (this.engine.player === null || !this.engine.currentSystem) return [];
    
    const pos = this.engine.ecs.getPosition(this.engine.player);
    if (!pos) return [];

    const factions = new Set<string>();
    const now = performance.now() * 0.001;
    const secSizeBI = BigInt(SECTOR_SIZE_M);

    for (const st of (this.engine.currentSystem.spaceStations || [])) {
        const orbitSpeed = st.orbitSpeed || 1e-8;
        const orbitRadius = st.orbitRadius || 20_000_000;
        let baseOffsetX = 0;
        let baseOffsetY = 0;

        if (st.orbitTargetType === 'PLANET' || st.orbitTargetType === 'SATELLITE') {
            const pt = this.engine.currentSystem.planets?.find((p: any) => p.id === st.orbitTarget);
            if (pt) {
                baseOffsetX = Math.cos(now * pt.orbitSpeed * 10 + this.engine.currentSystem.planets!.indexOf(pt)) * pt.orbitRadius;
                baseOffsetY = Math.sin(now * pt.orbitSpeed * 10 + this.engine.currentSystem.planets!.indexOf(pt)) * pt.orbitRadius;
            } else if (st.orbitTargetType === 'SATELLITE') {
                for (const p of (this.engine.currentSystem.planets || [])) {
                    const sat = p.satellites?.find((s: any) => s.id === st.orbitTarget);
                    if (sat) {
                        const targetPX = Math.cos(now * p.orbitSpeed * 10 + this.engine.currentSystem.planets!.indexOf(p)) * p.orbitRadius;
                        const targetPY = Math.sin(now * p.orbitSpeed * 10 + this.engine.currentSystem.planets!.indexOf(p)) * p.orbitRadius;
                        const targetSX = Math.cos(now * sat.orbitSpeed * 10 + p.satellites!.indexOf(sat)) * sat.orbitRadius;
                        const targetSY = Math.sin(now * sat.orbitSpeed * 10 + p.satellites!.indexOf(sat)) * sat.orbitRadius;
                        baseOffsetX = targetPX + targetSX;
                        baseOffsetY = targetPY + targetSY;
                        break;
                    }
                }
            }
        }
        
        const stIndex = this.engine.currentSystem.spaceStations.indexOf(st);
        const orbitX = Math.cos(now * orbitSpeed * 10 + stIndex) * orbitRadius;
        const orbitY = Math.sin(now * orbitSpeed * 10 + stIndex) * orbitRadius;
        
        const stWorldX = BigInt(this.engine.currentSystem.sectorX) * secSizeBI + BigInt(Math.floor(this.engine.currentSystem.offsetX + baseOffsetX + orbitX));
        const stWorldY = BigInt(this.engine.currentSystem.sectorY) * secSizeBI + BigInt(Math.floor(this.engine.currentSystem.offsetY + baseOffsetY + orbitY));
        const pWX = BigInt(pos.sectorX) * secSizeBI + BigInt(Math.floor(pos.offsetX));
        const pWY = BigInt(pos.sectorY) * secSizeBI + BigInt(Math.floor(pos.offsetY));

        const dx = Number(stWorldX - pWX);
        const dy = Number(stWorldY - pWY);
        
        if (Math.hypot(dx, dy) < 20_000_000) { 
            factions.add(st.factionId);
            globalFactionManager.discoverFaction(st.factionId);
        }
    }
    
    return Array.from(factions);
  }

  public scanCurrentSystem(): boolean {
    if (this.engine.currentSystem && !this.engine.scanned.has(this.engine.currentSystem.id)) {
      this.engine.scanned.add(this.engine.currentSystem.id);
      this.engine.saveState();
      return true;
    }
    return false;
  }
}

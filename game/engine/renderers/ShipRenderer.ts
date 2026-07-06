
import { BaseRenderer } from './BaseRenderer';
import { Camera } from '../camera';
import { GlobalCoords } from '../../../components/game/types';

export class ShipRenderer extends BaseRenderer {
  private fxGraphics: any | null = null;

  public setFXGraphics(graphics: any) {
    this.fxGraphics = graphics;
  }
  private getGlobalPos(lx: number, ly: number, ox: number, oy: number, rot: number) {
    const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
    const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
    return { x: ox + rx, y: oy + ry };
  }

  public static getTurretScale(config: any, limit?: number): number {
    const vs = config.visual;
    if (!vs) return 1;
    let scale = vs.scale || 1;
    if (limit === undefined) return scale;

    const mountLayers = vs.mountLayers || [];
    const headLayers = vs.headLayers || [];
    const barrelLayers = vs.barrelLayers || [];
    const bCount = config.barrelCount || 1;
    const spread = bCount > 1 ? 6 * scale : 0;
    const hPivotL = vs.headAttachmentPoint || { x: 0, y: 0 };

    let maxDesignR = 0;
    const checkPt = (lx: number, ly: number, ox: number, oy: number, rot: number) => {
        const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
        const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
        const d = Math.sqrt((ox + rx)**2 + (oy + ry)**2);
        if (d > maxDesignR) maxDesignR = d;
    };

    mountLayers.forEach((l: any) => l.points.forEach((p: any) => checkPt(p.x * scale, p.y * scale, 0, 0, 0)));
    // headLayers and barrelLayers are excluded from base radius limit as requested by user
    // to prevent turrets "shrinking" when moving barrels forward.
    
    // Scale must be positive and finite
    if (!isFinite(scale) || scale <= 0) return 0.001;

    if (maxDesignR > limit && limit > 0) {
        const factor = limit / maxDesignR;
        if (isFinite(factor)) return scale * factor;
    }
    return scale;
  }

  private renderTurret(
    config: any,
    targetX: number,
    targetY: number,
    shipRotation: number,
    camera: Camera,
    alpha: number = 1,
    options: {
      headRot?: number;
      mountRot?: number;
      isEditor?: boolean;
      editPart?: string;
      activeLayerId?: string;
      isDorsal?: boolean;
      originX?: number;
      originY?: number;
      minDistConstraint?: number;
      beamTargetScreen?: { x: number, y: number, color?: number };
      muzzleFlashProgress?: number;
      fireMode?: 'ROUNDS' | 'BEAM' | 'HOMING';
      isMining?: boolean;
    } = {}
  ) {
    const vs = config.visual;
    if (!vs) return;

    let scale = ShipRenderer.getTurretScale(config, options.minDistConstraint);
    const mountRot = options.mountRot || 0;
    const headRot = options.headRot || 0;
    const isEditor = options.isEditor || false;
    const editPart = options.editPart || 'MOUNT';
    const activeLayerId = options.activeLayerId || null;
    const isDorsal = options.isDorsal !== false;

    const baseCx = options.originX !== undefined ? options.originX : (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0);
    const baseCy = options.originY !== undefined ? options.originY : (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0);

    const hPivotL = vs.headAttachmentPoint || { x: 0, y: 0 };
    const hPivotG = this.getGlobalPos(hPivotL.x * scale, hPivotL.y * scale, baseCx, baseCy, mountRot);
    
    const mountLayers = (vs.mountLayers || []).slice().sort((a: any, b: any) => a.zIndex - b.zIndex);
    const headLayers = (vs.headLayers || []).slice().sort((a: any, b: any) => a.zIndex - b.zIndex);
    const barrelLayers = (vs.barrelLayers || []).slice().sort((a: any, b: any) => a.zIndex - b.zIndex);
    const bCount = config.barrelCount || 1;
    const spread = bCount > 1 ? 6 * scale : 0;
    const muzzleFlashProgress = options.muzzleFlashProgress || 0;

    const getAlphaForLayer = (layer: any, partType: string) => {
      if (!isEditor) return alpha;
      const isEditedPart = partType === editPart;
      if (!isEditedPart) return 0.2 * alpha;
      
      const partLayers = partType === 'MOUNT' ? vs.mountLayers : (partType === 'HEAD' ? vs.headLayers : vs.barrelLayers);
      const activeIdx = partLayers.findIndex((l: any) => l.id === activeLayerId);
      if (activeIdx === -1) return 1 * alpha;
      
      const myIdx = partLayers.findIndex((l: any) => l.id === layer.id);
      if (myIdx > activeIdx) return 0;
      if (myIdx < activeIdx) return 0.5 * alpha;
      return 1 * alpha;
    };

    const drawLayer = (layer: any, rot: number, originX: number, originY: number, partType: string) => {
      const lAlpha = getAlphaForLayer(layer, partType);
      if (lAlpha <= 0 || !layer.points || layer.points.length < 3) return;

      const sPts = layer.points.map((p: any) => {
        const abs = this.getGlobalPos(p.x * scale, p.y * scale, originX, originY, rot);
        const scX = abs.x * camera.zoom;
        const scY = abs.y * camera.zoom;
        const frX = scX * Math.cos(shipRotation) - scY * Math.sin(shipRotation);
        const frY = scX * Math.sin(shipRotation) + scY * Math.cos(shipRotation);
        return { x: targetX + frX, y: targetY + frY };
      });

      this.graphics.moveTo(sPts[0].x, sPts[0].y);
      for (let i = 1; i < sPts.length; i++) this.graphics.lineTo(sPts[i].x, sPts[i].y);
      this.graphics.closePath();
      this.graphics.fill({ color: this.colorToNumber(layer.color), alpha: lAlpha });
      this.graphics.stroke({ color: 0x111111, width: 1, alpha: lAlpha });
    };

    const renderMount = () => mountLayers.forEach((l: any) => drawLayer(l, mountRot, baseCx, baseCy, 'MOUNT'));
    const renderHead = () => {
      headLayers.forEach((l: any) => drawLayer(l, headRot, hPivotG.x, hPivotG.y, 'HEAD'));
      
      if (options.beamTargetScreen) {
        const tSc = options.beamTargetScreen;
        for (let b = 0; b < bCount; b++) {
          const bPivotL = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || 
                          { x: (bCount > 1 ? (-spread / 2 + (b / (bCount - 1)) * spread) / Math.max(0.001, scale) : 0), y: -4 };
          const bPivotG = this.getGlobalPos(bPivotL.x * scale, bPivotL.y * scale, hPivotG.x, hPivotG.y, headRot);
          const scX = bPivotG.x * camera.zoom;
          const scY = bPivotG.y * camera.zoom;
          const frX = scX * Math.cos(shipRotation) - scY * Math.sin(shipRotation);
          const frY = scX * Math.sin(shipRotation) + scY * Math.cos(shipRotation);
          const fromScreen = { x: targetX + frX, y: targetY + frY };
          
          const time = Date.now() * 0.005;
          const jitter = Math.sin(time + b) * 2;
          const c = tSc.color !== undefined ? tSc.color : 0x44ff44;
          
          this.graphics.moveTo(fromScreen.x, fromScreen.y);
          this.graphics.lineTo(tSc.x, tSc.y);
          this.graphics.stroke({ color: c, width: (6 + jitter) * camera.zoom, alpha: 0.3 * alpha });
          
          this.graphics.moveTo(fromScreen.x, fromScreen.y);
          this.graphics.lineTo(tSc.x, tSc.y);
          this.graphics.stroke({ color: 0xffffff, width: 1.5 * camera.zoom, alpha: 0.9 * alpha });
        }
      }

      barrelLayers.forEach((l: any) => {
        for (let b = 0; b < bCount; b++) {
          const bPivotL = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || 
                          { x: (bCount > 1 ? (-spread / 2 + (b / (bCount - 1)) * spread) / Math.max(0.001, scale) : 0), y: -4 };
          const bPivotG = this.getGlobalPos(bPivotL.x * scale, bPivotL.y * scale, hPivotG.x, hPivotG.y, headRot);
          drawLayer(l, headRot, bPivotG.x, bPivotG.y, 'BARREL');

          // Draw muzzle flash at barrel tip
          if (muzzleFlashProgress > 0) {
            // Estimate barrel tip: find outermost point in layer
            let maxLX = 5;
            if (l.points) {
               l.points.forEach((p: any) => { if (p.x > maxLX) maxLX = p.x; });
            }
            const tipG = this.getGlobalPos(maxLX * scale, 0, bPivotG.x, bPivotG.y, headRot);
            const scX = tipG.x * camera.zoom;
            const scY = tipG.y * camera.zoom;
            const frX = scX * Math.cos(shipRotation) - scY * Math.sin(shipRotation);
            const frY = scX * Math.sin(shipRotation) + scY * Math.cos(shipRotation);
            const flashScreen = { x: targetX + frX, y: targetY + frY };
            
            this.drawMuzzleFlash(flashScreen, muzzleFlashProgress, options.fireMode || 'ROUNDS', options.isMining || false, camera.zoom);
          }
        }
      });
    };

    if (isDorsal) {
      renderMount();
      renderHead();
    } else {
      renderHead();
      renderMount();
    }
  }

  private drawMuzzleFlash(pos: { x: number, y: number }, progress: number, mode: string, isMining: boolean, zoom: number) {
    const g = this.fxGraphics || this.graphics;
    const alpha = progress * 0.9;
    const time = Date.now() * 0.01;
    
    let color = 0xffaa00; // Default Ballistic
    if (isMining) color = 0x44ff44;
    else if (mode === 'BEAM') color = 0xaa44ff;
    else if (mode === 'HOMING') color = 0xff6600;

    if (mode === 'BEAM') {
        // Laser/Beam flash: sharp, cross-like with inner core
        const s = (12 + progress * 24) * zoom;
        const innerS = s * 0.6;
        
        g.beginPath();
        g.moveTo(pos.x - s, pos.y); g.lineTo(pos.x + s, pos.y);
        g.moveTo(pos.x, pos.y - s); g.lineTo(pos.x, pos.y + s);
        g.stroke({ color, width: 2 * zoom, alpha: alpha * 0.5 });
        
        g.beginPath();
        g.moveTo(pos.x - innerS, pos.y); g.lineTo(pos.x + innerS, pos.y);
        g.moveTo(pos.x, pos.y - innerS); g.lineTo(pos.x, pos.y + innerS);
        g.stroke({ color: 0xffffff, width: 1.5 * zoom, alpha: alpha });

        g.beginPath();
        g.circle(pos.x, pos.y, (4 + progress * 8) * zoom);
        g.fill({ color: 0xffffff, alpha: alpha * 0.8 });
    } else if (isMining) {
        // Green mining flash: fuzzy pulses
        const r = (6 + progress * 14) * zoom;
        const jitter = Math.sin(time) * 2 * zoom;
        g.beginPath();
        g.circle(pos.x, pos.y, r + jitter);
        g.fill({ color, alpha: alpha * 0.4 });
        
        g.beginPath();
        g.circle(pos.x, pos.y, (r * 0.5) + jitter * 0.5);
        g.fill({ color: 0xffffff, alpha: alpha * 0.7 });
    } else {
        // Standard ballistic: classic flash with spikes
        const r = (5 + progress * 15) * zoom;
        
        // Outer glow
        g.beginPath();
        g.circle(pos.x, pos.y, r * 1.5);
        g.fill({ color, alpha: alpha * 0.3 });
        
        // Main fireball
        g.beginPath();
        g.circle(pos.x, pos.y, r);
        g.fill({ color, alpha: alpha * 0.8 });
        
        // White core
        g.beginPath();
        g.circle(pos.x, pos.y, r * 0.4);
        g.fill({ color: 0xffffff, alpha });
        
        // Spike lines with jitter
        g.beginPath();
        const spikeCount = mode === 'HOMING' ? 6 : 4;
        for (let i = 0; i < spikeCount; i++) {
            const seed = (i * 123.456 + Math.floor(time * 0.1)) % 100;
            const jitterAng = (seed / 100 - 0.5) * 0.2;
            const ang = (i / spikeCount) * Math.PI * 2 + jitterAng;
            const s1 = (3 * zoom);
            const s2 = (14 * zoom) * progress * (0.8 + (seed % 10) / 25);
            g.moveTo(pos.x + Math.cos(ang) * s1, pos.y + Math.sin(ang) * s1);
            g.lineTo(pos.x + Math.cos(ang) * s2, pos.y + Math.sin(ang) * s2);
        }
        g.stroke({ color, width: 2 * zoom, alpha: alpha * 0.7 });
    }
  }

  public drawShip(coords: GlobalCoords, angle: number, hull: any, camera: Camera, width: number, height: number, isEditor = false, internalView = false, engine?: any, ecs?: any, entity?: any) {
    if (!hull) return;
    
    const screen = camera.worldToScreen(coords, width, height);
    const screenX = screen.x;
    const screenY = screen.y;
    const shipRotation = angle - camera.angle;

    const isTurretEditor = isEditor && engine && engine.isTurretEditor;
    const activeCompartment = engine && engine.activeCompartment;
    
    if (isTurretEditor && activeCompartment) {
      const tc = activeCompartment.turretConfig || activeCompartment.miningConfig;
      if (tc && tc.visual && tc.mount !== 'NONE') {
        const origin = camera.worldToScreen({ sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 }, width, height);
        
        const vs = tc.visual;
        const baseCx = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0;
        const baseCy = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0;
        
        let minDist = 10;
        if (activeCompartment.points) {
           const cPts = activeCompartment.points.map((p: any) => {
              const lx = p.x - (activeCompartment.x + baseCx);
              const ly = p.y - (activeCompartment.y + baseCy);
              const { x: frX, y: frY } = this.getGlobalPos(lx * camera.zoom, ly * camera.zoom, 0, 0, -camera.angle);
              return { x: origin.x + frX, y: origin.y + frY };
           });
           this.graphics.moveTo(cPts[0].x, cPts[0].y);
           for(let i=1; i<cPts.length; i++) this.graphics.lineTo(cPts[i].x, cPts[i].y);
           this.graphics.closePath();
           this.graphics.stroke({ color: 0x555555, width: 2, alpha: 0.5 });
           
           minDist = Infinity;
           const pPoint = { x: activeCompartment.x + baseCx, y: activeCompartment.y + baseCy };
           for (let i = 0; i < activeCompartment.points.length; i++) {
             const p1 = activeCompartment.points[i];
             const p2 = activeCompartment.points[(i + 1) % activeCompartment.points.length];
             const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
             if (l2 === 0) continue;
             let t = ((pPoint.x - p1.x) * (p2.x - p1.x) + (pPoint.y - p1.y) * (p2.y - p1.y)) / l2;
             t = Math.max(0, Math.min(1, t));
             const projX = p1.x + t * (p2.x - p1.x);
             const projY = p1.y + t * (p2.y - p1.y);
             const d = Math.sqrt((pPoint.x - projX)**2 + (pPoint.y - projY)**2);
             if (d < minDist) minDist = d;
           }
           if (minDist === Infinity || isNaN(minDist)) minDist = 10;
           this.graphics.circle(origin.x, origin.y, minDist * camera.zoom);
           this.graphics.stroke({ color: 0xffff00, width: 1, alpha: 0.2 });
        }

        const fwd = this.getGlobalPos(30 * camera.zoom, 0, 0, 0, -camera.angle);
        const fwdSide = this.getGlobalPos(25 * camera.zoom, 5 * camera.zoom, 0, 0, -camera.angle);
        const fwdSide2 = this.getGlobalPos(25 * camera.zoom, -5 * camera.zoom, 0, 0, -camera.angle);
        this.graphics.moveTo(origin.x, origin.y);
        this.graphics.lineTo(origin.x + fwd.x, origin.y + fwd.y);
        this.graphics.lineTo(origin.x + fwdSide.x, origin.y + fwdSide.y);
        this.graphics.moveTo(origin.x + fwd.x, origin.y + fwd.y);
        this.graphics.lineTo(origin.x + fwdSide2.x, origin.y + fwdSide2.y);
        this.graphics.stroke({ color: 0x00ff00, width: 2, alpha: 0.8 });

        this.renderTurret(tc, origin.x, origin.y, -camera.angle, camera, 1, {
          isEditor: true,
          editPart: engine.turretEditPart,
          activeLayerId: engine.turretActiveLayerId,
          originX: 0,
          originY: 0,
          minDistConstraint: minDist,
          fireMode: (tc as any).fireMode || 'BEAM',
          isMining: activeCompartment.type === 'MINING'
        });
      }
      return;
    }

    const anim = hull.buildAnimation;
    const isAnimating = anim && anim.active;
    const decksToDraw = isAnimating ? anim.newDecks : hull.decks;
    const activeIdx = hull.activeDeckIndex ?? 0;
    const compsList = isAnimating ? [] : (hull.compartments || []);

    const drawTurret = (comp: any, alphaMulti: number = 1, showOnlyMount = false) => {
        const tc = comp.turretConfig || comp.miningConfig;
        if (!tc || !tc.visual || tc.mount === 'NONE') return;
        const vs = tc.visual;
        const isDorsal = tc.mount === 'DORSAL';
        
        const baseCx = comp.x + (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0);
        const baseCy = comp.y + (vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0);
        
        // Calculate targeting angle
        let headRot = 0; 
        let beamTargetScreen: any = undefined;
        
        // 1. Check for Combat Turret Angle (from Weapon component)
        if (ecs && entity !== undefined) {
           const weapon = ecs.getComponent(entity, `weapon_${comp.id}`);
           if (weapon) {
              headRot = weapon.turretAngle;
           }
        }
        
        // 2. Fallback to mining logic
        if (headRot === 0 && comp.isMiningActive && comp.miningTargetPos) {
           const headPivotLocal = vs.headAttachmentPoint || { x: 0, y: 0 };
           const pivotGlobal = this.getGlobalPos(headPivotLocal.x * vs.scale, headPivotLocal.y * vs.scale, baseCx, baseCy, 0);
           
           const tgtRel = camera.getEngineCoords(comp.miningTargetPos);
           const srcRel = camera.getEngineCoords(coords);
           const dx = tgtRel.x - (srcRel.x + (pivotGlobal.x * Math.cos(angle) - pivotGlobal.y * Math.sin(angle)));
           const dy = tgtRel.y - (srcRel.y + (pivotGlobal.x * Math.sin(angle) + pivotGlobal.y * Math.cos(angle)));
           
           headRot = Math.atan2(dy, dx) - angle;
           
           beamTargetScreen = camera.worldToScreen(comp.miningTargetPos, width, height);
           beamTargetScreen.color = 0x00ffcc;
        }

        // Calculate and apply scaling constraint for all ship turrets
        let minDist = 10;
        let muzzleFlashProgress = 0;
        
        if (comp && comp.points) {
           minDist = Infinity;
           const vsAtt = vs.mountAttachmentPoint ? vs.mountAttachmentPoint : { x: 0, y: 0 };
           const pPoint = { x: comp.x + vsAtt.x, y: comp.y + vsAtt.y };
           for (let i = 0; i < comp.points.length; i++) {
             const p1 = comp.points[i];
             const p2 = comp.points[(i + 1) % comp.points.length];
             const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
             if (l2 === 0) continue;
             let t = ((pPoint.x - p1.x) * (p2.x - p1.x) + (pPoint.y - p1.y) * (p2.y - p1.y)) / l2;
             t = Math.max(0, Math.min(1, t));
             const projX = p1.x + t * (p2.x - p1.x);
             const projY = p1.y + t * (p2.y - p1.y);
             const d = Math.sqrt((pPoint.x - projX)**2 + (pPoint.y - projY)**2);
             if (d < minDist) minDist = d;
           }
        }

        if (ecs && entity !== undefined) {
          const weapon = ecs.getComponent(entity, `weapon_${comp.id}`);
          if (weapon) {
            const flashDuration = weapon.fireMode === 'BEAM' ? 200 : 150;
            if (Date.now() - weapon.lastFireTime < flashDuration) {
              muzzleFlashProgress = 1 - (Date.now() - weapon.lastFireTime) / flashDuration;
            }
          }
        }

        this.renderTurret(tc, screenX, screenY, shipRotation, camera, alphaMulti, {
          headRot,
          isDorsal,
          originX: baseCx,
          originY: baseCy,
          minDistConstraint: minDist,
          beamTargetScreen,
          muzzleFlashProgress,
          fireMode: (tc as any).fireMode || 'BEAM',
          isMining: comp.type === 'MINING'
        });
    };
    
    // Gradient color helper
    const getGradientColor = (baseColorNum: number, idx: number, totalDecks: number) => {
        if (totalDecks <= 1) return baseColorNum;
        const r = (baseColorNum >> 16) & 255;
        const g = (baseColorNum >> 8) & 255;
        const b = baseColorNum & 255;
        // From -0.2 (bottom) to +0.2 (top)
        const factor = -0.3 + 0.6 * (idx / (totalDecks - 1));
        const adjust = (c: number) => Math.max(0, Math.min(255, c + c * factor)) | 0;
        return (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
    };

    const compsToDraw = isAnimating ? anim.oldCompartments : compsList;

    decksToDraw.forEach((deck: any, idx: number) => {
      compsList.forEach((comp: any) => {
         const tc = comp.turretConfig || comp.miningConfig;
         if (tc && tc.mount === 'VENTRAL' && comp.startDeck === idx) {
           if (isEditor) {
              // In editor, show ventral turrets as transparent mount-only 
              drawTurret(comp, 0.3, true);
           } else {
              drawTurret(comp, 1, false);
           }
        }
      });

      if (!deck.points || deck.points.length < 3) return;
      
      // Editor ghosting logic
      let alpha = 1;
      let isGhost = false;
      let isDeckAbove = false;
      
      if (isEditor && !isAnimating) {
        if (idx === activeIdx) {
          alpha = 1;
        } else if (idx < activeIdx) {
          alpha = 1.0; 
          isGhost = true;
        } else if (idx === activeIdx + 1) {
          alpha = 0.2; 
          isDeckAbove = true;
          isGhost = true;
        } else {
          return; 
        }
      }
      
      let pts = deck.points;
      if (isAnimating) {
        const progress = anim.progress || 0;
        const oldDeck = anim.oldDecks[idx] || { points: [] };
        const oldPts = oldDeck.points || [];
        const maxX = deck.points.reduce((max: number, p: any) => Math.max(max, p.x), -Infinity);
        const minX = deck.points.reduce((min: number, p: any) => Math.min(min, p.x), Infinity);
        const rangeX = Math.max(1, maxX - minX);
        const maxY = deck.points.reduce((max: number, p: any) => Math.max(max, Math.abs(p.y)), 0.1);

        pts = pts.map((np: any, i: number) => {
          const op = oldPts[i] || (oldPts.length > 0 ? oldPts[oldPts.length - 1] : { x: 0, y: 0 });
          const distFromNose = (maxX - np.x) / rangeX;
          const distFromCenter = Math.abs(np.y) / maxY;
          const delay = distFromNose * 0.4 + distFromCenter * 0.2; 
          const localProgress = Math.max(0, Math.min(1, (progress - delay) / 0.4));
          return {
            x: op.x + (np.x - op.x) * localProgress,
            y: op.y + (np.y - op.y) * localProgress
          };
        });
      }
      
      const toScreen = (p: any) => {
        const rx = p.x * camera.zoom;
        const ry = p.y * camera.zoom;
        const rotX = rx * Math.cos(shipRotation) - ry * Math.sin(shipRotation);
        const rotY = rx * Math.sin(shipRotation) + ry * Math.cos(shipRotation);
        return { x: screenX + rotX, y: screenY + rotY };
      };

      const screenPts = pts.map(toScreen);

      this.graphics.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        this.graphics.lineTo(screenPts[i].x, screenPts[i].y);
      }
      this.graphics.closePath();
      
      let baseColorNum = this.colorToNumber(deck.color);
      baseColorNum = getGradientColor(baseColorNum, idx, decksToDraw.length);
      let color = baseColorNum;
      
      if (isAnimating) color = 0x888888; 
      else if (isEditor && isGhost && idx < activeIdx) {
          // Keep hull color but slightly darker to distinguish it as non-active
          const r = (color >> 16) & 255;
          const g = (color >> 8) & 255;
          const b = color & 255;
          color = ((r * 0.7) << 16) | ((g * 0.7) << 8) | (b * 0.7);
      }
      
      const baseAlpha = deck.isBuilding ? 0.3 + (deck.buildProgress || 0) * 0.7 : 1;
      // Placeholder for future texture implementation
      // if (deck.textureId) { applyTexture(deck.textureId, pts); }
      this.graphics.fill({ color, alpha: baseAlpha * alpha });
      
      // Draw hull thickness border if applicable
      const thickness = deck.globalHullThickness || 0;
      if (thickness > 0) {
        // Use a darker version of the deck color or a metallic grey for the hull plating
        this.graphics.stroke({ color: baseColorNum, width: Math.max(2, thickness * camera.zoom), alpha: 1.0 * alpha, join: 'round' });
      } else {
        this.graphics.stroke({ color: baseColorNum, width: 1, alpha: 0.3 * alpha, join: 'round' });
      }

      // Draw Beams and Armor in Internal View / Editor
      const shouldDrawInternalStructure = (internalView && !isDeckAbove) || (isEditor && idx === activeIdx);
      if (shouldDrawInternalStructure) {
        // Overlay a very dark tint on the entire active deck to make the internal structure deeply shaded
        this.graphics.fill({ color: 0x000000, alpha: 0.65 });
        
        // ... (Joint Marker drawing helper stays)
        const drawJointMarker = (p: any) => {
          if (!this.fxGraphics) return;
          const s = 4;
          this.fxGraphics.moveTo(p.x - s, p.y); this.fxGraphics.lineTo(p.x + s, p.y);
          this.fxGraphics.moveTo(p.x, p.y - s); this.fxGraphics.lineTo(p.x, p.y + s);
          this.fxGraphics.stroke({ color: baseColorNum, width: 2, alpha: 0.8 });
        };

        // 1. Draw Armor Plates (Cells)
        if (deck.cells) {
          deck.cells.forEach((cell: any) => {
            if (cell.points && cell.points.length >= 3) {
              const cpts = cell.points.map(toScreen);
              this.graphics.moveTo(cpts[0].x, cpts[0].y);
              for (let i = 1; i < cpts.length; i++) this.graphics.lineTo(cpts[i].x, cpts[i].y);
              this.graphics.closePath();
              
              const isArmor = cell.cellType === 'ARMOR';
              const isSelectedCell = engine?.activeCell?.id === cell.id;
              if (isArmor) {
                // Armor visual: Darker metallic plates with inherit color support
                let armorColor = 0x111115; // Default even darker armor
                if (cell.inheritsHullColor) {
                  const ar = (baseColorNum >> 16) & 255;
                  const ag = (baseColorNum >> 8) & 255;
                  const ab = baseColorNum & 255;
                  armorColor = ((ar * 0.4) << 16) | ((ag * 0.4) << 8) | (ab * 0.4);
                }
                // Placeholder for cell texture: if (cell.textureId) { ... }
                this.graphics.fill({ color: armorColor, alpha: 0.9 });
                this.graphics.stroke({ color: baseColorNum, width: 1, alpha: 0.6 });
              } else {
                // Regular structural cell (void space filler)
                // Placeholder for structural cell texture: if (cell.textureId) { ... }
                this.graphics.fill({ color: 0x050505, alpha: 0.6 });
                this.graphics.stroke({ color: baseColorNum, width: 1, alpha: 0.3 });
              }
              
              if (isSelectedCell && this.fxGraphics) {
                 this.fxGraphics.moveTo(cpts[0].x, cpts[0].y);
                 for (let i = 1; i < cpts.length; i++) this.fxGraphics.lineTo(cpts[i].x, cpts[i].y);
                 this.fxGraphics.closePath();
                 this.fxGraphics.stroke({ color: isArmor ? 0xffff00 : 0xff00ff, width: 2, alpha: 1.0 });
              }
            }
          });
        }

        // 2. Draw Beams
        if (deck.beams) {
          this.graphics.beginPath();
          deck.beams.forEach((beam: any) => {
            const p1 = toScreen(beam.p1);
            const p2 = toScreen(beam.p2);
            this.graphics.moveTo(p1.x, p1.y);
            this.graphics.lineTo(p2.x, p2.y);
          });
          this.graphics.stroke({ color: baseColorNum, width: 1, alpha: 0.5 });
        }

        // 3. Draw Joint Markers (Pluses)
        if (deck.beams) {
          deck.beams.forEach((beam: any) => {
            drawJointMarker(toScreen(beam.p1));
            drawJointMarker(toScreen(beam.p2));
          });
        }
        screenPts.forEach(drawJointMarker);
        compsList.forEach((comp: any) => {
          if (comp.points && comp.startDeck <= activeIdx && comp.endDeck >= activeIdx) {
            comp.points.forEach((p: any) => drawJointMarker(toScreen(p)));
          }
        });
      }

      // Draw compartments that belong to this deck (to ensure proper depth sorting behind higher decks)
      if (internalView || isEditor) {
        compsToDraw.forEach((comp: any) => {
          if (!comp.points || comp.points.length < 3) return;
          const e = Math.max(comp.startDeck, comp.endDeck);
          
          let shouldDraw = false;
          if (isEditor && hull.activeDeckIndex !== undefined) {
             const s = Math.min(comp.startDeck, comp.endDeck);
             if (s > hull.activeDeckIndex) return; // Completely hidden
             // Draw the compartment only on its topmost visible layer (either its true endDeck or the activeDeck if it extends above)
             const topVisibleDeck = Math.min(e, hull.activeDeckIndex);
             if (idx === topVisibleDeck) shouldDraw = true;
          } else {
             if (idx === e) shouldDraw = true;
          }

          if (shouldDraw) {
            const pts = comp.points.map((p: any) => {
              const rx = p.x * camera.zoom;
              const ry = p.y * camera.zoom;
              const rotX = rx * Math.cos(shipRotation) - ry * Math.sin(shipRotation);
              const rotY = rx * Math.sin(shipRotation) + ry * Math.cos(shipRotation);
              return { x: screenX + rotX, y: screenY + rotY };
            });
            this.graphics.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              this.graphics.lineTo(pts[i].x, pts[i].y);
            }
            this.graphics.closePath();
            
            const colorNum = this.colorToNumber(comp.color);
            const r = (colorNum >> 16) & 255;
            const g = (colorNum >> 8) & 255;
            const b = colorNum & 255;
            const darkColor = ((r * 0.3) << 16) | ((g * 0.3) << 8) | (b * 0.3);

            const compAlpha = comp.isBuilding ? 0.3 + (comp.buildProgress || 0) * 0.7 : (isDeckAbove ? 0.4 : 0.85); // Ghost above compartments too just in case
            
            // Placeholder for future compartment texture: if (comp.textureId) { ... }
            // Fill the floor with a much darker tone
            this.graphics.fill({ color: darkColor, alpha: compAlpha });
            
            // Draw the thin wall illuminated by the deck color (baseColorNum), as requested
            const wallThickness = 2; // Thin lines in screen space, not scaled by zoom
            this.graphics.stroke({ color: baseColorNum, width: wallThickness, alpha: compAlpha, join: 'round' });
            
            // Inner thin line to give more structure
            this.graphics.stroke({ color: 0x000000, width: 1, alpha: 0.6 });
            
            const isSelected = activeCompartment?.id === comp.id || (activeCompartment && comp.pairedWith === activeCompartment.id) || (activeCompartment?.pairedWith === comp.id);
            if (isSelected && this.fxGraphics) {
              this.fxGraphics.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) this.fxGraphics.lineTo(pts[i].x, pts[i].y);
              this.fxGraphics.closePath();
              this.fxGraphics.stroke({ color: 0xffff00, width: wallThickness + 2, alpha: 1.0 });
            }
          }
        });
      }
    });

    // Draw Dorsal turrets after compartments
    compsList.forEach((comp: any) => {
       const tc = comp.turretConfig || comp.miningConfig;
       if (tc && tc.mount === 'DORSAL') {
          if (isEditor) {
             const isCurrentDeck = comp.startDeck <= activeIdx && comp.endDeck >= activeIdx;
             if (!isCurrentDeck) {
                if (comp.startDeck < activeIdx) {
                   drawTurret(comp, 0.4, false); // Draw opaquely-visible but partially transparent for decks below
                }
                return; 
             }
             // Always show faint mount-only in editor to avoid blocking hull/compartment editing
             drawTurret(comp, 0.3, true); 
          } else {
             drawTurret(comp, 1, false);
          }
       }
    });

  }
}

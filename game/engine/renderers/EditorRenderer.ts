
import { Camera } from '../camera';
import { Renderer } from '../renderer';
import { ShipRenderer } from './ShipRenderer';
import { clampCameraZoom } from '@/game/hullGeometry';
import { GameEngine } from '../GameEngine';

export class EditorRenderer {
    public static draw(engine: GameEngine, renderer: Renderer, camera: Camera, settings: any, mirrorTargets: any[]) {
        if (!engine.isEditorOpen || !engine.draftHull) return;

        camera.setTargetPos({ 
            sectorX: 0n, 
            sectorY: 0n, 
            offsetX: engine.editorCameraPos.x, 
            offsetY: engine.editorCameraPos.y 
        });
        camera.update();
        clampCameraZoom(camera, renderer.width, renderer.height, 'editor', engine.draftHull);

        const gm = settings.gridMode;
        if (gm !== 'OFF') renderer.drawGrid(camera, Number(gm));

        renderer.drawShip({ sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0 }, 0, engine.draftHull, camera, true, false, engine);

        if (engine.isTurretEditor && engine.activeCompartment) {
            this.drawTurretEditorOverlays(engine, renderer, camera);
        } else {
            this.drawHullEditorOverlays(engine, renderer, camera, mirrorTargets);
        }
        
    }

    private static drawTurretEditorOverlays(engine: GameEngine, renderer: Renderer, camera: Camera) {
        const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
        if (!tc || !tc.visual) return;

        const vs = tc.visual;
        const editPart = engine.turretEditPart || 'MOUNT';
        const activeId = engine.turretActiveLayerId;
        const partLayers = editPart === 'MOUNT' ? vs.mountLayers : (editPart === 'HEAD' ? vs.headLayers : vs.barrelLayers);
        const layer = partLayers?.find((l:any) => l.id === activeId);
        
        const bCount = tc.barrelCount || 1;
        const spread = bCount > 1 ? 6 * vs.scale : 0;
        
        let minDistCons = 10;
        if (engine.activeCompartment.points && engine.activeCompartment.points.length > 2) {
            const vsAtt = vs.mountAttachmentPoint ? vs.mountAttachmentPoint : { x: 0, y: 0 };
            const pPoint = { x: vsAtt.x + engine.activeCompartment.x, y: vsAtt.y + engine.activeCompartment.y };
            let bestD = Infinity;
            for (let i = 0; i < engine.activeCompartment.points.length; i++) {
                const p1 = engine.activeCompartment.points[i];
                const p2 = engine.activeCompartment.points[(i + 1) % engine.activeCompartment.points.length];
                const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
                if (l2 === 0) continue;
                let t = ((pPoint.x - p1.x) * (p2.x - p1.x) + (pPoint.y - p1.y) * (p2.y - p1.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                const projX = p1.x + t * (p2.x - p1.x);
                const projY = p1.y + t * (p2.y - p1.y);
                const d = Math.sqrt((pPoint.x - projX)**2 + (pPoint.y - projY)**2);
                if (d < bestD) bestD = d;
            }
            minDistCons = bestD;
        }
        const turretEffScale = ShipRenderer.getTurretScale(tc, minDistCons);

        if (layer && (engine.editorMode === 'EDIT_VERTICES' || engine.editorMode === 'ADD_HULL_VERTEX')) {
            layer.points.forEach((p: any, i: number) => {
                 const isActive = engine.activeVertex === i;
                 const color = isActive ? '#00ff00' : '#ff0000';
                 
                 const baseLayerCx = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0;
                 const baseLayerCy = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0;
                 
                 const getGlobalPosBase = (lx: number, ly: number, originX: number, originY: number, rot: number) => {
                     const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
                     const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
                     return { x: originX + rx, y: originY + ry };
                 };

                 let pivotGlobal = { x: baseLayerCx, y: baseLayerCy };
                 if (editPart === 'HEAD' || editPart === 'BARREL') {
                     const hPivotLocal = vs.headAttachmentPoint || { x: 0, y: 0 };
                     pivotGlobal = getGlobalPosBase(hPivotLocal.x * turretEffScale, hPivotLocal.y * turretEffScale, baseLayerCx, baseLayerCy, 0); 
                 }
                 
                 if (editPart === 'BARREL') {
                     const b = engine.turretTargetBarrelIdx || 0;
                     const bPivotLocal = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || 
                                         { x: (bCount > 1 ? (-spread / 2 + (b / (bCount - 1)) * spread) / vs.scale : 0), y: -4 };
                     pivotGlobal = getGlobalPosBase(bPivotLocal.x * turretEffScale, bPivotLocal.y * turretEffScale, pivotGlobal.x, pivotGlobal.y, 0);
                 }

                 const absP = getGlobalPosBase(p.x * turretEffScale, p.y * turretEffScale, pivotGlobal.x, pivotGlobal.y, 0);
                 renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: absP.x, offsetY: absP.y }, isActive ? 4 / camera.zoom : 2 / camera.zoom, color, camera);
            });
        }
        
        const getGlobalPos = (lx: number, ly: number, originX: number, originY: number, rot: number) => {
            const rx = lx * Math.cos(rot) - ly * Math.sin(rot);
            const ry = lx * Math.sin(rot) + ly * Math.cos(rot);
            return { x: originX + rx, y: originY + ry };
        };
        
        const baseCx = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.x : 0;
        const baseCy = vs.mountAttachmentPoint ? vs.mountAttachmentPoint.y : 0;
        
        if (editPart === 'MOUNT') {
             renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: baseCx, offsetY: baseCy }, minDistCons, 'rgba(255,255,0,0.2)', camera, false);
        }
        
        renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: baseCx, offsetY: baseCy }, 6 / camera.zoom, '#ffff00', camera);
        
        const hPivotLocal = vs.headAttachmentPoint || { x: 0, y: 0 };
        const hPivotGlobal = getGlobalPos(hPivotLocal.x * turretEffScale, hPivotLocal.y * turretEffScale, baseCx, baseCy, 0);
        
        if (editPart === 'HEAD' || editPart === 'BARREL') {
            if (editPart === 'HEAD') {
                 renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: hPivotGlobal.x, offsetY: hPivotGlobal.y }, minDistCons * 2, 'rgba(255,165,0,0.2)', camera, false);
            }
            renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: hPivotGlobal.x, offsetY: hPivotGlobal.y }, 6 / camera.zoom, '#ffa500', camera);
            
            if (editPart === 'BARREL') {
                for (let b = 0; b < bCount; b++) {
                    const bPivotLocal = vs.barrelAttachmentPoints?.[b] || { x: 0, y: -4 };
                    const bPivotGlobal = getGlobalPos(bPivotLocal.x * turretEffScale, bPivotLocal.y * turretEffScale, hPivotGlobal.x, hPivotGlobal.y, 0);
                    renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: bPivotGlobal.x, offsetY: bPivotGlobal.y }, 4 / camera.zoom, '#00ffff', camera);
                }
            }
        }
    }

    private static drawHullEditorOverlays(engine: GameEngine, renderer: Renderer, camera: Camera, mirrorTargets: any[]) {
        if (engine.editorMode === 'EDIT_VERTICES' || engine.editorMode === 'ADD_HULL_VERTEX') {
            const activeIdx = engine.draftHull.activeDeckIndex || 0;
            const deck = engine.draftHull.decks[activeIdx];
            if (deck && deck.points) {
                deck.points.forEach((p: any, i: number) => {
                    const isActive = engine.activeVertex === i;
                    const isMirror = mirrorTargets.some((mt: any) => mt.index === i);
                    const color = isActive ? '#00ff00' : isMirror ? '#ff8800' : '#ff0000';
                    renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: p.x, offsetY: p.y }, isActive ? 4 / camera.zoom : 3 / camera.zoom, color, camera);
                });
            }
        }

        if (engine.editorMode === 'EDIT_COMPARTMENTS' || engine.editorMode === 'ADD_COMPARTMENT') {
            const hull = engine.draftHull;
            const activeDeckIdx = hull.activeDeckIndex;
            hull.compartments
                .filter((c: any) => {
                    const s = Math.min(c.startDeck, c.endDeck);
                    const e = Math.max(c.startDeck, c.endDeck);
                    return s <= activeDeckIdx && e >= activeDeckIdx;
                })
                .forEach((comp: any) => {
                    if (comp.points) {
                        comp.points.forEach((p: any, i: number) => {
                            const isActive = engine.activeCompartment === comp && engine.activeCompartmentVertex === i;
                            const color = isActive ? '#00ff00' : '#ffffff';
                            renderer.drawCircle({ sectorX: 0n, sectorY: 0n, offsetX: p.x, offsetY: p.y }, 2 / camera.zoom, color, camera);
                        });
                    }
                });
        }
    }
}

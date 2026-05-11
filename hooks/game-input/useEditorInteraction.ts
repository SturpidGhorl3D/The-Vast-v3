
'use client';

import { useEffect, useRef, MutableRefObject, RefObject } from 'react';
import { ShipHull, ViewMode, CompartmentType, Point } from '@/components/game/types';
import { ShipRenderer } from '@/game/engine/renderers/ShipRenderer';
import { COMPARTMENT_COLORS, makeDefaultCompartmentExtras } from '@/game/compartmentUtils';
import {
  isPointInPolygon,
  findBestInsertIndex,
  checkValidation,
  resolveMirrorTargets,
  findMirroredVertexIndices,
  mirroredPosition,
  generateStructuralBeams,
} from '@/components/game/editorLogic';
import { rectPoints, closestVertexIndex, mirrorByPairAxis } from './inputUtils';

interface EditorInteractionProps {
  engine: any;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  setShipHull: React.Dispatch<React.SetStateAction<ShipHull>>;
  setActiveVertex: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveCompartmentVertex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectionType: React.Dispatch<React.SetStateAction<'deck' | 'compartment' | 'cell' | null>>;
  setSelectedElementIndex: React.Dispatch<React.SetStateAction<number | string | null>>;
  setActiveCompartment: React.Dispatch<React.SetStateAction<any>>;
  setActiveDeck: React.Dispatch<React.SetStateAction<number>>;
  setInternalView: React.Dispatch<React.SetStateAction<boolean>>;
  mirrorTargetsRef: MutableRefObject<Array<{ index: number; mirrorType: 'X' | 'Y' | 'XY' }>>;
}

export const useEditorInteraction = ({
  engine,
  canvasRef,
  setShipHull,
  setActiveVertex,
  setActiveCompartmentVertex,
  setSelectionType,
  setSelectedElementIndex,
  setActiveCompartment,
  setActiveDeck,
  setInternalView,
  mirrorTargetsRef,
}: EditorInteractionProps) => {

  const turretDragScaleRef = useRef<number>(1);
  const dragStatesRef = useRef({
    isDragging: false,
    isDraggingCompartment: false,
    isDraggingCompartmentVertex: false,
    isDraggingVertex: false,
  });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);

  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engine.isEditorOpen) return;

      if (e.code === 'Delete' || e.code === 'Backspace') {
        const editMode = engine.editorMode;
        const draftHull = engine.draftHull;
        if (!draftHull) return;

        if (editMode === 'EDIT_COMPARTMENTS' && engine.activeCompartment !== null && engine.activeCompartmentVertex !== null) {
          const comp = engine.activeCompartment;
          const vi = engine.activeCompartmentVertex as number;
          if (comp.points && comp.points.length > 3) {
            const p = comp.points[vi];
            if (comp.pairedWith) {
              const twin = draftHull.compartments.find((c: any) => c.id === comp.pairedWith);
              if (twin && twin.points && twin.points.length > 3) {
                const mirPt = mirrorByPairAxis(p.x, p.y, comp.pairAxis ?? 'X');
                const twinVi = closestVertexIndex(twin.points, mirPt.x, mirPt.y);
                if (twinVi >= 0) {
                  twin.points.splice(twinVi, 1);
                  twin.x = twin.points.reduce((s: number, p: any) => s + p.x, 0) / twin.points.length;
                  twin.y = twin.points.reduce((s: number, p: any) => s + p.y, 0) / twin.points.length;
                }
              }
              comp.points.splice(vi, 1);
            } else {
              const symHoriz = engine.symmetryY;
              const symVert = engine.symmetryX;
              const mirrorIndices = findMirroredVertexIndices(comp.points, vi, symHoriz, symVert);
              const allIndices = [vi, ...mirrorIndices].sort((a, b) => b - a);
              if (comp.points.length - allIndices.length >= 3) {
                for (const idx of allIndices) { comp.points.splice(idx, 1); }
              } else {
                comp.points.splice(vi, 1);
              }
            }
            comp.x = comp.points.reduce((s: number, p: any) => s + p.x, 0) / comp.points.length;
            comp.y = comp.points.reduce((s: number, p: any) => s + p.y, 0) / comp.points.length;
            engine.activeCompartmentVertex = null;
            setActiveCompartmentVertex(null);
            checkValidation(draftHull);
            setShipHull({ ...draftHull });
          }
          e.preventDefault();
        } else if (editMode === 'EDIT_VERTICES' && engine.activeVertex !== null) {
          if (engine.isTurretEditor && engine.turretActiveLayerId && engine.activeCompartment) {
            const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
            const vs = tc?.visual;
            const partLayers = engine.turretEditPart === 'MOUNT' ? vs?.mountLayers : (engine.turretEditPart === 'HEAD' ? vs?.headLayers : vs?.barrelLayers);
            const layer = partLayers?.find((l:any) => l.id === engine.turretActiveLayerId);
            if (layer && layer.points && layer.points.length > 3) {
                const srcIdx = engine.activeVertex;
                const symHoriz = engine.symmetryY;
                const symVert = engine.symmetryX;
                const mirrorIndices = findMirroredVertexIndices(layer.points, srcIdx, symHoriz, symVert);
                const allIndices = [srcIdx, ...mirrorIndices].sort((a:any, b:any) => b - a);
                if (layer.points.length - allIndices.length >= 3) {
                    for (const idx of allIndices) { layer.points.splice(idx, 1); }
                } else {
                    layer.points.splice(srcIdx, 1);
                }
                engine.activeVertex = null;
                setActiveVertex(null);
                setShipHull({ ...draftHull });
            }
            e.preventDefault();
          } else {
            const deck = draftHull.decks[draftHull.activeDeckIndex];
            if (deck.points.length > 3) {
                const srcIdx = engine.activeVertex;
                const symHoriz = engine.symmetryY;
                const symVert = engine.symmetryX;
                const mirrorIndices = findMirroredVertexIndices(deck.points, srcIdx, symHoriz, symVert);
                const allIndices = [srcIdx, ...mirrorIndices].sort((a:any, b:any) => b - a);
                if (deck.points.length - allIndices.length >= 3) {
                    for (const idx of allIndices) { deck.points.splice(idx, 1); }
                } else {
                    deck.points.splice(srcIdx, 1);
                }
                engine.activeVertex = null;
                setActiveVertex(null);
                checkValidation(draftHull);
                setShipHull({ ...draftHull });
            }
            e.preventDefault();
          }
        }
      }
    };

    const handleMouseDown = (e: PointerEvent) => {
      if (e.target !== canvasRef.current || !engine.isEditorOpen) return;

      const now = performance.now();
      if (now - lastClickTimeRef.current < 250) return;
      lastClickTimeRef.current = now;

      const rect = canvas.getBoundingClientRect();
      const r = engine.renderer;
      if (!r) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldPos = engine.camera.screenToLocal(mouseX, mouseY, r.width, r.height);
      engine.mouseWorld = { ...engine.mouseWorld, x: worldPos.x, y: worldPos.y } as any;

      const mode = engine.editorMode;
      const hull = engine.draftHull;
      if (!hull) return;

      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (e.button === 1 || e.button === 2) {
          dragStatesRef.current.isDragging = true;
          e.preventDefault();
          return;
      }

      if (mode === 'EDIT_VERTICES') {
        if (engine.isTurretEditor && engine.turretActiveLayerId && engine.activeCompartment) {
            const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
            const vs = tc?.visual;
            const partLayers = engine.turretEditPart === 'MOUNT' ? vs?.mountLayers : (engine.turretEditPart === 'HEAD' ? vs?.headLayers : vs?.barrelLayers);
            const layer = partLayers?.find((l:any) => l.id === engine.turretActiveLayerId);
            if (layer && layer.points) {
                let minDistCons = 10;
                if (engine.activeCompartment.points && engine.activeCompartment.points.length > 2) {
                    const vsAtt = vs.mountAttachmentPoint ? vs.mountAttachmentPoint : { x: 0, y: 0 };
                    const pPoint = { x: vsAtt.x + engine.activeCompartment.x, y: vsAtt.y + engine.activeCompartment.y };
                    minDistCons = getMinDistToPolygon(pPoint, engine.activeCompartment.points);
                }
                const effScale = ShipRenderer.getTurretScale(tc, minDistCons);
                turretDragScaleRef.current = effScale;
                const bCount = tc.barrelCount || 1;
                const spread = bCount > 1 ? 6 * effScale : 0;
                
                let finalOffsetX = 0;
                let finalOffsetY = 0;
                if (engine.turretEditPart === 'HEAD' || engine.turretEditPart === 'BARREL') {
                    const hp = vs.headAttachmentPoint || { x: 0, y: 0 };
                    finalOffsetX += hp.x * effScale;
                    finalOffsetY += hp.y * effScale;
                }
                if (engine.turretEditPart === 'BARREL') {
                    const b = engine.turretTargetBarrelIdx || 0;
                    const bOffX = bCount > 1 ? -spread/2 + (b / (bCount-1)) * spread : 0;
                    const bp = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || { x: bOffX / effScale, y: -4 };
                    finalOffsetX += bp.x * effScale;
                    finalOffsetY += bp.y * effScale;
                }

                const spX = (worldPos.x - finalOffsetX) / effScale;
                const spY = (worldPos.y - finalOffsetY) / effScale;

                let closestIdx: number | null = null;
                let mDist = 12 / engine.camera.zoom / effScale;
                layer.points.forEach((p: any, i: number) => {
                    const d = Math.sqrt((p.x - spX) ** 2 + (p.y - spY) ** 2);
                    if (d < mDist) { mDist = d; closestIdx = i; }
                });
                if (closestIdx !== null) {
                    dragStatesRef.current.isDraggingVertex = true;
                    setActiveVertex(closestIdx);
                    engine.activeVertex = closestIdx;
                    mirrorTargetsRef.current = resolveMirrorTargets(layer.points, closestIdx, engine.symmetryY, engine.symmetryX) as any;
                } else {
                   dragStatesRef.current.isDragging = true;
                   setActiveVertex(null);
                   engine.activeVertex = null;
               }
            }
            return;
        }

        const activeIdx = hull.activeDeckIndex || 0;
        const deck = hull.decks[activeIdx];
        if (!deck || !deck.points) return;
        let closestIdx: number | null = null;
        let minDist = 12 / engine.camera.zoom;
        deck.points.forEach((p: any, i: number) => {
          const d = Math.sqrt((p.x - worldPos.x) ** 2 + (p.y - worldPos.y) ** 2);
          if (d < minDist) { minDist = d; closestIdx = i; }
        });
        if (closestIdx !== null) {
          dragStatesRef.current.isDraggingVertex = true;
          setActiveVertex(closestIdx);
          engine.activeVertex = closestIdx;
          mirrorTargetsRef.current = resolveMirrorTargets(deck.points, closestIdx, engine.symmetryY, engine.symmetryX) as any;
        } else {
          dragStatesRef.current.isDragging = true;
          setActiveVertex(null);
          engine.activeVertex = null;
        }
        return;
      }

      if (mode === 'SELECT') {
        const activeDeckIdx = hull.activeDeckIndex;
        let foundComp: any = null;
        for (const comp of hull.compartments) {
          const s = Math.min(comp.startDeck, comp.endDeck);
          const e = Math.max(comp.startDeck, comp.endDeck);
          if (s <= activeDeckIdx && e >= activeDeckIdx && comp.points) {
            if (isPointInPolygon(worldPos.x, worldPos.y, comp.points)) { foundComp = comp; break; }
          }
        }
        
        let foundCell: any = null;
        const deck = hull.decks[activeDeckIdx];
        if (!foundComp && deck && deck.cells) {
           for (const cell of deck.cells) {
              if (isPointInPolygon(worldPos.x, worldPos.y, cell.points)) { foundCell = cell; break; }
           }
        }

        if (foundComp) {
          engine.selectionType = 'compartment';
          engine.selectedElementIndex = foundComp.id;
          setSelectionType('compartment');
          setSelectedElementIndex(foundComp.id);
          engine.activeCompartment = foundComp;
          setActiveCompartment(foundComp);
          if (engine.draftHull) {
            engine.draftHull.activeDeckIndex = foundComp.startDeck;
            setActiveDeck(foundComp.startDeck);
          }
          setInternalView(true);
        } else if (foundCell) {
          engine.selectionType = 'cell';
          engine.selectedElementIndex = foundCell.id;
          setSelectionType('cell');
          setSelectedElementIndex(foundCell.id);
          (engine as any).activeCell = foundCell;
        } else {
          dragStatesRef.current.isDragging = true;
          setSelectionType(null);
          setSelectedElementIndex(null);
          engine.selectionType = null;
          engine.selectedElementIndex = null;
        }
        return;
      }

      if (mode === 'SET_TURRET_PIVOT') {
        if (engine.isTurretEditor && engine.activeCompartment) {
            const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
            const vs = tc?.visual;
            if (vs) {
                let minDistCons = 50;
                if (engine.activeCompartment.points && engine.activeCompartment.points.length > 2) {
                    const vsAtt = vs.mountAttachmentPoint ? vs.mountAttachmentPoint : { x: 0, y: 0 };
                    const pPoint = { x: vsAtt.x + engine.activeCompartment.x, y: vsAtt.y + engine.activeCompartment.y };
                    minDistCons = getMinDistToPolygon(pPoint, engine.activeCompartment.points);
                }
                const effScale = ShipRenderer.getTurretScale(tc, minDistCons);
                const step = engine.turretEditPart === 'MOUNT' ? 1 : 0.25;
                const spX = Math.round(worldPos.x / step) * step;
                const spY = Math.round(worldPos.y / step) * step;
                
                if (engine.turretEditPart === 'MOUNT') {
                    vs.mountAttachmentPoint = { 
                        x: (vs.mountAttachmentPoint?.x || 0) + spX, 
                        y: (vs.mountAttachmentPoint?.y || 0) + spY 
                    };
                } else if (engine.turretEditPart === 'HEAD') {
                    vs.headAttachmentPoint = { x: spX / effScale, y: spY / effScale };
                } else if (engine.turretEditPart === 'BARREL') {
                    const hx = vs.headAttachmentPoint ? vs.headAttachmentPoint.x * effScale : 0;
                    const hy = vs.headAttachmentPoint ? vs.headAttachmentPoint.y * effScale : 0;
                    if (!vs.barrelAttachmentPoints) vs.barrelAttachmentPoints = [];
                    const b = engine.turretTargetBarrelIdx || 0;
                    vs.barrelAttachmentPoints[b] = { x: (spX - hx) / effScale, y: (spY - hy) / effScale };
                }
                
                setShipHull({ ...hull });
            }
        }
        return;
      }

      if (mode === 'ADD_HULL_VERTEX') {
        if (engine.isTurretEditor) {
            if (engine.turretActiveLayerId && engine.activeCompartment) {
                const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
                const vs = tc?.visual;
                const partLayers = engine.turretEditPart === 'MOUNT' ? vs?.mountLayers : (engine.turretEditPart === 'HEAD' ? vs?.headLayers : vs?.barrelLayers);
                const layer = partLayers?.find((l:any) => l.id === engine.turretActiveLayerId);
                if (layer && layer.points) {
                    let minDistCons = 10;
                    if (engine.activeCompartment.points && engine.activeCompartment.points.length > 2) {
                        const vsAtt = vs.mountAttachmentPoint ? vs.mountAttachmentPoint : { x: 0, y: 0 };
                        const pPoint = { x: vsAtt.x + engine.activeCompartment.x, y: vsAtt.y + engine.activeCompartment.y };
                        minDistCons = getMinDistToPolygon(pPoint, engine.activeCompartment.points);
                    }
                    const effScale = ShipRenderer.getTurretScale(tc, minDistCons);
                    const bCount = tc.barrelCount || 1;
                    const spread = bCount > 1 ? 6 * effScale : 0;
                    
                    let finalOffsetX = 0;
                    let finalOffsetY = 0;
                    if (engine.turretEditPart === 'HEAD' || engine.turretEditPart === 'BARREL') {
                        const hp = vs.headAttachmentPoint || { x: 0, y: 0 };
                        finalOffsetX += hp.x * effScale;
                        finalOffsetY += hp.y * effScale;
                    }
                    if (engine.turretEditPart === 'BARREL') {
                        const b = engine.turretTargetBarrelIdx || 0;
                        const bOffX = bCount > 1 ? -spread/2 + (b / (bCount-1)) * spread : 0;
                        const bp = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || { x: bOffX / effScale, y: -4 };
                        finalOffsetX += bp.x * effScale;
                        finalOffsetY += bp.y * effScale;
                    }

                    const maxLocalDist = engine.turretEditPart === 'MOUNT' ? minDistCons : (engine.turretEditPart === 'HEAD' ? minDistCons * 2 : 200);
                    const targetX = worldPos.x - finalOffsetX;
                    const targetY = worldPos.y - finalOffsetY;
                    const distX = Math.sqrt(targetX**2 + targetY**2);
                    let finalMVX = targetX;
                    let finalMVY = targetY;
                    if (distX > maxLocalDist) {
                        finalMVX = (targetX / distX) * maxLocalDist;
                        finalMVY = (targetY / distX) * maxLocalDist;
                    }
                    const step = 0.25;
                    const spX = Math.round(finalMVX / effScale / step) * step;
                    const spY = Math.round(finalMVY / effScale / step) * step;

                    addPtToPoly(layer.points, spX, spY);
                    if (engine.symmetryY && Math.abs(spX) > 0.01) addPtToPoly(layer.points, -spX, spY);
                    if (engine.symmetryX && Math.abs(spY) > 0.01) addPtToPoly(layer.points, spX, -spY);
                    if (engine.symmetryX && engine.symmetryY && Math.abs(spX) > 0.01 && Math.abs(spY) > 0.01) addPtToPoly(layer.points, -spX, -spY);
                    setShipHull({ ...hull });
                }
            }
            return;
        }

        const activeIdx = hull.activeDeckIndex || 0;
        const deck = hull.decks[activeIdx];
        if (!deck || !deck.points) return;
        
        const snX = Math.round(worldPos.x);
        const snY = Math.round(worldPos.y);
        
        addPtToPoly(deck.points, snX, snY);
        
        if (engine.symmetryX || engine.symmetryY) {
          if (engine.symmetryY && Math.abs(snX) > 0.5) addPtToPoly(deck.points, -snX, snY);
          if (engine.symmetryX && Math.abs(snY) > 0.5) addPtToPoly(deck.points, snX, -snY);
          if (engine.symmetryX && engine.symmetryY && Math.abs(snX) > 0.5 && Math.abs(snY) > 0.5) addPtToPoly(deck.points, -snX, -snY);
        }
        
        regenerateBeams(hull, activeIdx, engine);
        setShipHull(JSON.parse(JSON.stringify(hull)));
        return;
      }

      if (mode === 'ADD_COMPARTMENT') {
        const type: CompartmentType = (engine.pendingCompartmentType as CompartmentType) || 'CARGO';
        const sz = hull.size * 0.3;
        const extras = makeDefaultCompartmentExtras(type);
        const newId = `comp-${Date.now()}`;
        const newComp: any = {
          id: newId, type,
          x: Math.round(worldPos.x), y: Math.round(worldPos.y),
          width: sz, height: sz,
          points: rectPoints(Math.round(worldPos.x), Math.round(worldPos.y), sz, sz),
          startDeck: hull.activeDeckIndex,
          endDeck: hull.activeDeckIndex,
          color: COMPARTMENT_COLORS[type] || '#888888',
          ...extras,
        };
        hull.compartments.push(newComp);
        const snapX = Math.round(worldPos.x);
        const snapY = Math.round(worldPos.y);
        let twinSpawned = false;
        if (engine.symmetryX || engine.symmetryY) {
          if (engine.symmetryY && Math.abs(snapX) > sz * 0.25) {
            const twinId = `comp-${Date.now() + 1}`;
            const twin: any = {
              ...JSON.parse(JSON.stringify(newComp)),
              id: twinId, x: -snapX, y: snapY,
              points: rectPoints(-snapX, snapY, sz, sz),
              pairedWith: newId, pairAxis: 'X' as const,
            };
            newComp.pairedWith = twinId; newComp.pairAxis = 'X' as const;
            hull.compartments.push(twin);
            twinSpawned = true;
          }
          if (engine.symmetryX && Math.abs(snapY) > sz * 0.25) {
            const twinId = `comp-${Date.now() + (twinSpawned ? 2 : 1)}`;
            const twin: any = {
              ...JSON.parse(JSON.stringify(newComp)),
              id: twinId, x: snapX, y: -snapY,
              points: rectPoints(snapX, -snapY, sz, sz),
              pairedWith: newId, pairAxis: 'Y' as const,
            };
            if (!newComp.pairedWith) {
               newComp.pairedWith = twinId; 
               newComp.pairAxis = 'Y' as const;
            }
            hull.compartments.push(twin);
          }
        }
        
        regenerateBeams(hull, hull.activeDeckIndex, engine);
        setShipHull(JSON.parse(JSON.stringify(hull)));
        return;
      }

      if (mode === 'MOVE_COMPARTMENT') {
        const activeDeckIdx = hull.activeDeckIndex;
        const visibleCompartments = hull.compartments.filter((c: any) => {
          const s = Math.min(c.startDeck, c.endDeck);
          const e = Math.max(c.startDeck, c.endDeck);
          return s <= activeDeckIdx && e >= activeDeckIdx;
        });
        let found: any = null;
        for (const comp of visibleCompartments) {
          const pts = comp.points || [];
          if (pts.length >= 3 && isPointInPolygon(worldPos.x, worldPos.y, pts)) { found = comp; break; }
        }
        if (found) {
          dragStatesRef.current.isDraggingCompartment = true;
          setActiveCompartment(found);
          engine.activeCompartment = found;
        } else {
          dragStatesRef.current.isDragging = true;
        }
        return;
      }

      if (mode === 'EDIT_COMPARTMENTS') {
        const activeDeckIdx = hull.activeDeckIndex;
        const visibleCompartments = hull.compartments.filter((c: any) => c.startDeck <= activeDeckIdx && c.endDeck >= activeDeckIdx);
        let foundComp: any = null;
        let foundVertIdx: number | null = null;
        const hitRadius = 8 / engine.camera.zoom;
        outer: for (const comp of visibleCompartments) {
          if (comp.points) {
            for (let i = 0; i < comp.points.length; i++) {
              const p = comp.points[i];
              if (Math.sqrt((p.x - worldPos.x) ** 2 + (p.y - worldPos.y) ** 2) < hitRadius) {
                foundComp = comp; foundVertIdx = i; break outer;
              }
            }
          }
        }
        if (foundComp !== null) {
          dragStatesRef.current.isDraggingCompartmentVertex = true;
          setActiveCompartment(foundComp);
          engine.activeCompartment = foundComp;
          setActiveCompartmentVertex(foundVertIdx);
          engine.activeCompartmentVertex = foundVertIdx;

          if (foundComp.pairedWith) {
            const twin = hull.compartments.find((c: any) => c.id === foundComp.pairedWith);
            if (twin && twin.points) {
              const p = foundComp.points[foundVertIdx!];
              const mirPt = mirrorByPairAxis(p.x, p.y, foundComp.pairAxis ?? 'X');
              (engine as any).activeTwinVertexIndex = closestVertexIndex(twin.points, mirPt.x, mirPt.y);
            }
          } else {
             mirrorTargetsRef.current = resolveMirrorTargets(foundComp.points, foundVertIdx!, engine.symmetryY, engine.symmetryX) as any;
          }
        } else {
          dragStatesRef.current.isDragging = true;
        }
        return;
      }

      if (mode === 'ADD_COMPARTMENT_VERTEX') {
        const comp = engine.activeCompartment;
        if (comp && comp.points && comp.points.length >= 3) {
          const snX = Math.round(worldPos.x);
          const snY = Math.round(worldPos.y);
          
          addPtToPoly(comp.points, snX, snY);

          if (comp.pairedWith) {
            const twin = hull.compartments.find((c: any) => c.id === comp.pairedWith);
            if (twin && twin.points) {
              const mirPt = mirrorByPairAxis(snX, snY, comp.pairAxis ?? 'Y');
              addPtToPoly(twin.points, mirPt.x, mirPt.y);
            }
          } else {
            const symHoriz = engine.symmetryY;
            const symVert = engine.symmetryX;
            if (symHoriz && Math.abs(snX) > 0.5) addPtToPoly(comp.points, -snX, snY);
            if (symVert && Math.abs(snY) > 0.5) addPtToPoly(comp.points, snX, -snY);
            if (symHoriz && symVert && Math.abs(snX) > 0.5 && Math.abs(snY) > 0.5) addPtToPoly(comp.points, -snX, -snY);
          }
          comp.x = comp.points.reduce((s: number, p: any) => s + p.x, 0) / comp.points.length;
          comp.y = comp.points.reduce((s: number, p: any) => s + p.y, 0) / comp.points.length;
          
          regenerateBeams(hull, hull.activeDeckIndex, engine);
          setShipHull(JSON.parse(JSON.stringify(hull)));
        } else {
          dragStatesRef.current.isDragging = true;
        }
        return;
      }

      if (mode === 'BUILD_ARMOR') {
        if (e.button === 2) { (engine as any).lastArmorPoint = null; e.preventDefault(); return; }
        const activeIdx = hull.activeDeckIndex || 0;
        const deck = hull.decks[activeIdx];
        if (!deck) return;
        
        let clickedPt = getClickedVertex(worldPos, hull, deck, activeIdx, engine.camera.zoom);

        if (clickedPt) {
          if ((engine as any).lastArmorPoint && (engine as any).lastArmorPoint !== clickedPt) {
            const p1: Point = (engine as any).lastArmorPoint;
            const p2: Point = clickedPt;

            const hasBeam = (deck.beams || []).some((b: any) => 
               (Math.abs(b.p1.x - p1.x) < 0.1 && Math.abs(b.p1.y - p1.y) < 0.1 && Math.abs(b.p2.x - p2.x) < 0.1 && Math.abs(b.p2.y - p2.y) < 0.1) ||
               (Math.abs(b.p1.x - p2.x) < 0.1 && Math.abs(b.p1.y - p2.y) < 0.1 && Math.abs(b.p2.x - p1.x) < 0.1 && Math.abs(b.p2.y - p1.y) < 0.1)
            );

            if (hasBeam) {
              addArmorCell(deck, p1, p2, engine, hull);
              setShipHull({ ...hull });
            } else {
              (engine as any).lastArmorPoint = clickedPt;
              return;
            }
          }
          (engine as any).lastArmorPoint = clickedPt;
        }
        return;
      }

      dragStatesRef.current.isDragging = true;
    };

    const handleMouseMove = (e: PointerEvent) => {
      if (!engine.isEditorOpen) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const r = engine.renderer;
      if (!r) return;
      const worldPos = engine.camera.screenToLocal(mouseX, mouseY, r.width, r.height);
      engine.mouseWorld = worldPos;

      const hull = engine.draftHull;
      if (!hull) return;

      const { isDraggingVertex, isDraggingCompartment, isDraggingCompartmentVertex, isDragging } = dragStatesRef.current;

      if (isDraggingVertex && engine.activeVertex !== null) {
        handleVertexDrag(worldPos, engine, hull, turretDragScaleRef.current, mirrorTargetsRef.current);
        setShipHull({ ...hull });
        return;
      }

      if (isDraggingCompartmentVertex && engine.activeCompartment !== null && engine.activeCompartmentVertex !== null) {
        handleCompartmentVertexDrag(worldPos, engine, hull, mirrorTargetsRef.current);
        setShipHull({ ...hull });
        return;
      }

      if (isDraggingCompartment && engine.activeCompartment !== null) {
        handleCompartmentDrag(worldPos, engine, hull);
        setShipHull({ ...hull });
        return;
      }

      if (isDragging) {
        const worldLast = engine.camera.screenToLocal(lastMouseRef.current.x - rect.left, lastMouseRef.current.y - rect.top, r.width, r.height);
        const dx = worldPos.x - worldLast.x;
        const dy = worldPos.y - worldLast.y;
        engine.editorCameraPos.x -= dx;
        engine.editorCameraPos.y -= dy;
        engine.camera.targetPos.offsetX -= dx;
        engine.camera.targetPos.offsetY -= dy;
        engine.camera.pos.offsetX -= dx;
        engine.camera.pos.offsetY -= dy;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = (e: PointerEvent) => {
      if (!engine.isEditorOpen) return;
      const wasDragging = dragStatesRef.current.isDraggingVertex || dragStatesRef.current.isDraggingCompartment || dragStatesRef.current.isDraggingCompartmentVertex;
      
      dragStatesRef.current.isDragging = false;
      dragStatesRef.current.isDraggingCompartment = false;
      dragStatesRef.current.isDraggingCompartmentVertex = false;
      dragStatesRef.current.isDraggingVertex = false;
      (engine as any).activeTwinVertexIndex = null;

      if (engine.draftHull) {
        let finalHull = engine.draftHull;
        if (wasDragging) {
          regenerateBeams(finalHull, finalHull.activeDeckIndex, engine);
          if (engine.updateDraftHull) engine.updateDraftHull(finalHull);
        }
        checkValidation(finalHull);
        setShipHull({ ...finalHull });
        if (engine.activeCompartment) setActiveCompartment(engine.activeCompartment);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('pointerdown', handleMouseDown);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointermove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handleMouseDown);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointermove', handleMouseMove);
    };
  }, [engine, canvasRef, setShipHull, setActiveVertex, setActiveCompartmentVertex, setSelectionType, setSelectedElementIndex, setActiveCompartment, setActiveDeck, setInternalView, mirrorTargetsRef]);
};

// --- Helpers ---

function getMinDistToPolygon(p: Point, poly: Point[]): number {
  let minD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const d = distToSegment(p, p1, p2);
    if (d < minD) minD = d;
  }
  return minD;
}

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2);
}

function addPtToPoly(pts: Point[], x: number, y: number) {
  const insertIdx = findBestInsertIndex(pts, x, y);
  pts.splice(insertIdx, 0, { x, y });
}

function regenerateBeams(hull: any, activeIdx: number, engine: any) {
  const dk = hull.decks[activeIdx];
  if (!dk) return;
  const { beams, cells } = generateStructuralBeams(
    dk.points,
    hull.compartments.filter((c: any) => c.startDeck <= activeIdx && c.endDeck >= activeIdx),
    dk.beamPattern || 'NONE',
    dk.beamDensity || 2.0,
    engine.symmetryY,
    engine.symmetryX
  );
  const manualCells = (dk.cells || []).filter((c: any) => c.isManual);
  dk.beams = beams;
  dk.cells = [...cells, ...manualCells];
}

function getClickedVertex(mouse: Point, hull: any, deck: any, activeIdx: number, zoom: number): Point | null {
  let clickedPt: Point | null = null;
  let minDist = 12 / zoom;
  deck.points.forEach((p: any) => {
    const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
    if (d < minDist) { minDist = d; clickedPt = p; }
  });
  hull.compartments.forEach((comp: any) => {
    if (comp.points && comp.startDeck <= activeIdx && comp.endDeck >= activeIdx) {
      comp.points.forEach((p: any) => {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < minDist) { minDist = d; clickedPt = p; }
      });
    }
  });
  deck.beams?.forEach((beam: any) => {
    [beam.p1, beam.p2].forEach(p => {
       const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
       if (d < minDist) { minDist = d; clickedPt = p; }
    });
  });
  return clickedPt;
}

function addArmorCell(deck: any, p1: Point, p2: Point, engine: any, hull: any) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const thickness = 2.0;
  const tip = Math.min(len * 0.2, 0.8);
  const isHullP1 = deck.points.some((p: any) => p.x === p1.x && p.y === p1.y);
  const isHullP2 = deck.points.some((p: any) => p.x === p2.x && p.y === p2.y);
  const inheritsHullColor = isHullP1 && isHullP2;

  const createHex = (pt1: Point, pt2: Point) => {
    const dX = pt2.x - pt1.x;
    const dY = pt2.y - pt1.y;
    const l = Math.hypot(dX, dY);
    const uX = dX / l;
    const uY = dY / l;
    const pX = -uY;
    const pY = uX;
    return [
      { x: pt1.x, y: pt1.y },
      { x: pt1.x + uX * tip + pX * (thickness/2), y: pt1.y + uY * tip + pY * (thickness/2) },
      { x: pt2.x - uX * tip + pX * (thickness/2), y: pt2.y - uY * tip + pY * (thickness/2) },
      { x: pt2.x, y: pt2.y },
      { x: pt2.x - uX * tip - pX * (thickness/2), y: pt2.y - uY * tip - pY * (thickness/2) },
      { x: pt1.x + uX * tip - pX * (thickness/2), y: pt1.y + uY * tip - pY * (thickness/2) },
    ];
  };

  if (!deck.cells) deck.cells = [];
  deck.cells.push({ id: `armor-${Date.now()}`, points: createHex(p1, p2), cellType: 'ARMOR', isManual: true, inheritsHullColor });

  const symmetry = [];
  if (engine.symmetryY) symmetry.push('X');
  if (engine.symmetryX) symmetry.push('Y');
  if (engine.symmetryX && engine.symmetryY) symmetry.push('XY');

  symmetry.forEach(type => {
    const mp1 = mirroredPosition(p1.x, p1.y, type as any);
    const mp2 = mirroredPosition(p2.x, p2.y, type as any);
    deck.cells.push({ id: `armor-sym-${Date.now()}-${type}`, points: createHex(mp1, mp2), cellType: 'ARMOR', isManual: true, inheritsHullColor });
  });
}

function handleVertexDrag(worldPos: Point, engine: any, hull: any, dragScale: number, mirrors: any[]) {
  if (engine.isTurretEditor && engine.turretActiveLayerId && engine.activeCompartment) {
    const tc = engine.activeCompartment.turretConfig || engine.activeCompartment.miningConfig;
    const vs = tc?.visual;
    const partLayers = engine.turretEditPart === 'MOUNT' ? vs?.mountLayers : (engine.turretEditPart === 'HEAD' ? vs?.headLayers : vs?.barrelLayers);
    const layer = partLayers?.find((l:any) => l.id === engine.turretActiveLayerId);
    if (!layer) return;

    let finalOffsetX = 0; let finalOffsetY = 0;
    const bCount = tc.barrelCount || 1;
    const effSpread = bCount > 1 ? 6 * dragScale : 0;
    if (engine.turretEditPart === 'HEAD' || engine.turretEditPart === 'BARREL') {
      const hp = vs.headAttachmentPoint || { x: 0, y: 0 };
      finalOffsetX += hp.x * dragScale; finalOffsetY += hp.y * dragScale;
    }
    if (engine.turretEditPart === 'BARREL') {
      const b = engine.turretTargetBarrelIdx || 0;
      const bOffX = bCount > 1 ? -effSpread/2 + (b / (bCount-1)) * effSpread : 0;
      const bp = (vs.barrelAttachmentPoints && vs.barrelAttachmentPoints[b]) || { x: bOffX / dragScale, y: -4 };
      finalOffsetX += bp.x * dragScale; finalOffsetY += bp.y * dragScale;
    }

    const targetX = worldPos.x - finalOffsetX;
    const targetY = worldPos.y - finalOffsetY;
    const spX = Math.round(targetX / dragScale / 0.25) * 0.25;
    const spY = Math.round(targetY / dragScale / 0.25) * 0.25;
    layer.points[engine.activeVertex] = { x: spX, y: spY };
    mirrors.forEach(mt => {
      const mir = mirroredPosition(spX, spY, mt.mirrorType);
      layer.points[mt.index] = { ...mir };
    });
  } else {
    const deck = hull.decks[hull.activeDeckIndex];
    const snX = Math.round(worldPos.x); const snY = Math.round(worldPos.y);
    deck.points[engine.activeVertex] = { x: snX, y: snY };
    mirrors.forEach(mt => {
      const mir = mirroredPosition(snX, snY, mt.mirrorType);
      deck.points[mt.index] = { ...mir };
    });
  }
}

function handleCompartmentVertexDrag(worldPos: Point, engine: any, hull: any, mirrors: any[]) {
  const comp = engine.activeCompartment;
  const vi = engine.activeCompartmentVertex;
  const snX = Math.round(worldPos.x); const snY = Math.round(worldPos.y);
  comp.points[vi] = { x: snX, y: snY };
  comp.x = comp.points.reduce((s: number, p: any) => s + p.x, 0) / comp.points.length;
  comp.y = comp.points.reduce((s: number, p: any) => s + p.y, 0) / comp.points.length;

  if (comp.pairedWith) {
    const twin = hull.compartments.find((c: any) => c.id === comp.pairedWith);
    if (twin?.points) {
      const mir = mirrorByPairAxis(snX, snY, comp.pairAxis ?? 'X');
      const twinVi = (engine as any).activeTwinVertexIndex ?? closestVertexIndex(twin.points, mir.x, mir.y);
      twin.points[twinVi!] = { ...mir };
      twin.x = twin.points.reduce((s: number, p: any) => s + p.x, 0) / twin.points.length;
      twin.y = twin.points.reduce((s: number, p: any) => s + p.y, 0) / twin.points.length;
    }
  } else {
    mirrors.forEach(mt => {
      const mir = mirroredPosition(snX, snY, mt.mirrorType);
      comp.points[mt.index] = { ...mir };
    });
  }
}

function handleCompartmentDrag(worldPos: Point, engine: any, hull: any) {
  const comp = engine.activeCompartment;
  const snX = Math.round(worldPos.x); const snY = Math.round(worldPos.y);
  const dx = snX - comp.x; const dy = snY - comp.y;
  if (dx !== 0 || dy !== 0) {
    comp.x = snX; comp.y = snY;
    comp.points = comp.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
    if (comp.pairedWith) {
      const twin = hull.compartments.find((c: any) => c.id === comp.pairedWith);
      if (twin) {
        const mir = mirrorByPairAxis(snX, snY, comp.pairAxis ?? 'X');
        const tdx = mir.x - twin.x; const tdy = mir.y - twin.y;
        twin.x = mir.x; twin.y = mir.y;
        twin.points = twin.points.map((p: any) => ({ x: p.x + tdx, y: p.y + tdy }));
      }
    }
  }
}

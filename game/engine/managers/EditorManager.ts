
import { GameEngine } from '../GameEngine';
import { EditorMode, CompartmentType, GlobalCoords } from '@/components/game/types';
import { symmetrizeHull } from '@/components/game/editorLogic';
import { PERIMETER_THICKNESS } from '@/game/constants';

export class EditorManager {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public setIsEditorOpen(v: boolean) { this.engine.isEditorOpen = v; }
  public setEditorMode(v: EditorMode) { this.engine.editorMode = v; }
  public setDraftHull(v: any) { this.engine.draftHull = v; }

  public updateDraftHull(newHull: any) {
    const oldActiveComp = this.engine.activeCompartment;
    this.engine.draftHull = newHull;
    
    if (oldActiveComp && newHull && newHull.compartments) {
      const freshComp = newHull.compartments.find((c: any) => c.id === oldActiveComp.id);
      if (freshComp) {
        this.engine.activeCompartment = freshComp;
      }
    }
  }

  public setIsTurretEditor(v: boolean) { this.engine.isTurretEditor = v; }
  public setTurretTargetBarrelIdx(v: number) { this.engine.turretTargetBarrelIdx = v; }
  public setTurretActiveLayerId(v: string | null) { this.engine.turretActiveLayerId = v; }
  public setActiveCompartment(v: any) { this.engine.activeCompartment = v; }
  public setTurretEditPart(v: 'MOUNT' | 'HEAD' | 'BARREL') { this.engine.turretEditPart = v; }
  public setActiveVertex(v: number | null) { this.engine.activeVertex = v; }
  public setActiveCompartmentVertex(v: number | null) { this.engine.activeCompartmentVertex = v; }
  public setPendingCompartmentType(v: CompartmentType | null) { this.engine.pendingCompartmentType = v; }
  public setSymmetryX(v: boolean) { this.engine.symmetryX = v; }
  public setSymmetryY(v: boolean) { this.engine.symmetryY = v; }
  public setSelectionType(v: 'deck' | 'compartment' | null) { this.engine.selectionType = v; }
  public setSelectedElementIndex(v: number | string | null) { this.engine.selectedElementIndex = v; }
  public setEditorCameraPos(v: { x: number; y: number }) { this.engine.editorCameraPos = v; }

  public updateDeckHeight(deckIndex: number, delta: number) {
    if (!this.engine.draftHull) return;
    const deck = this.engine.draftHull.decks[deckIndex];
    if (deck) {
      deck.height = Math.max(1, (deck.height || 5) + delta);
    }
  }

  public updateDeckThickness(deckIndex: number, delta: number) {
    if (!this.engine.draftHull) return;
    const deck = this.engine.draftHull.decks[deckIndex];
    if (deck) {
      const current = deck.globalHullThickness || PERIMETER_THICKNESS;
      deck.globalHullThickness = Math.max(0.1, Math.round((current + delta * 0.1) * 10) / 10);
    }
  }

  public deleteVertex(deckIndex: number, vertexIndex: number) {
    if (!this.engine.draftHull) return;
    const deck = this.engine.draftHull.decks[deckIndex];
    if (deck && deck.points.length > 3) {
      deck.points.splice(vertexIndex, 1);
    }
  }

  public deleteVertices(deckIndex: number, indices: number[]) {
    if (!this.engine.draftHull) return;
    const deck = this.engine.draftHull.decks[deckIndex];
    if (deck) {
      indices.sort((a, b) => b - a).forEach(di => {
        if (deck.points.length > 3) deck.points.splice(di, 1);
      });
    }
  }

  public updateVertexSegment(deckIndex: number, vertexIndex: number, segmentType: string) {
    if (!this.engine.draftHull) return;
    const deck = this.engine.draftHull.decks[deckIndex];
    if (deck && deck.points[vertexIndex]) {
      deck.points[vertexIndex].segmentType = segmentType;
    }
  }

  public deleteCompartment(compId: string | number) {
    if (!this.engine.draftHull) return;
    this.engine.draftHull.compartments = this.engine.draftHull.compartments.filter((c: any) => c.id !== compId);
  }

  public deleteCompartmentVertex(compId: string | number, vertexIndex: number) {
    if (!this.engine.draftHull) return;
    const c = this.engine.draftHull.compartments.find((x: any) => x.id === compId);
    if (!c || !c.points || c.points.length <= 3) return;
    c.points.splice(vertexIndex, 1);
    c.x = c.points.reduce((s: number, p: any) => s + p.x, 0) / c.points.length;
    c.y = c.points.reduce((s: number, p: any) => s + p.y, 0) / c.points.length;
    
    if (c.pairedWith) {
      const twin = this.engine.draftHull.compartments.find((x: any) => x.id === c.pairedWith);
      if (twin && twin.points && vertexIndex < twin.points.length && twin.points.length > 3) {
        twin.points.splice(vertexIndex, 1);
        twin.x = twin.points.reduce((s: number, p: any) => s + p.x, 0) / twin.points.length;
        twin.y = twin.points.reduce((s: number, p: any) => s + p.y, 0) / twin.points.length;
      }
    }
    return c;
  }

  public symmetrizeCurrentHull() {
    if (!this.engine.draftHull) return;
    symmetrizeHull(this.engine.draftHull, this.engine.symmetryY, this.engine.symmetryX);
  }
}

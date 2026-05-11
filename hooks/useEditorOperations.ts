
'use client';

import { validateHullForApply } from '@/components/game/editorLogic';
import { calcBlueprintCost } from '@/game/compartmentUtils';
import { calculateMaxCapacity } from '@/game/systems';
import { Inventory } from '@/game/engine/types';

export function useEditorOperations(engine: any, setIsEditorOpen: (v: boolean) => void, setIsPaused: (v: boolean) => void, setInternalView: (v: boolean) => void, setActiveDeck: (v: number) => void, setIsEditorMenuOpen: (v: boolean) => void, isCreative: boolean) {
  
  const calcCost = (currentEngine: any) => {
    const draftHull = currentEngine.draftHull;
    const player = currentEngine.player;
    if (!draftHull || player === null) return null;
    const currentHull = currentEngine.ecs.getComponent(player, 'Hull');
    if (!currentHull) return null;
    return calcBlueprintCost(currentHull.decks, draftHull.decks, draftHull.compartments, currentHull.compartments);
  };

  const hasCargo = (currentEngine: any) => {
    const draftHull = currentEngine.draftHull;
    if (!draftHull) return false;
    return draftHull.compartments.some((c: any) => c.type === 'CARGO');
  };

  const applyChanges = () => {
    if (!engine) return;
    const player = engine.player;
    if (player !== null && engine.draftHull) {
      const draftHull = engine.draftHull;
      const err = validateHullForApply(draftHull);
      if (err) { alert(err); return; }

      // Cost check
      const blueprintData = calcCost(engine);
      if (!isCreative) {
        if (blueprintData) {
          const { cost, refund } = blueprintData;
          const inv = engine.ecs.getComponent(player, 'Inventory') as Inventory;
          if (inv) {
            if (!hasCargo(engine)) {
              alert('You need a Cargo Bay to store materials for ship construction!');
              return;
            }
            
            // Pay the net cost
            const netIron = Math.max(0, cost.IRON - refund.IRON);
            const netTi = Math.max(0, cost.TITANIUM - refund.TITANIUM);
            
            if (inv.resources.IRON < netIron || inv.resources.TITANIUM < netTi) {
               alert(`Insufficient materials!\nRequired: ${netIron} Fe, ${netTi} Ti\nAvailable: ${Math.floor(inv.resources.IRON)} Fe, ${Math.floor(inv.resources.TITANIUM)} Ti`);
               return;
            }

            // Apply Net Cost
            inv.resources.IRON -= netIron;
            inv.resources.TITANIUM -= netTi;
            
            if (refund.IRON > cost.IRON) inv.resources.IRON += (refund.IRON - cost.IRON);
            if (refund.TITANIUM > cost.TITANIUM) inv.resources.TITANIUM += (refund.TITANIUM - cost.TITANIUM);
          }
        }
      }

      const hull = engine.ecs.getComponent(player, 'Hull');
      const cleanDraft = JSON.parse(JSON.stringify(draftHull));
      const oldDecks = JSON.parse(JSON.stringify(hull.decks));
      const oldCompartments = JSON.parse(JSON.stringify(hull.compartments));

      const decksSame = JSON.stringify(oldDecks) === JSON.stringify(cleanDraft.decks);
      const existingIds = new Set(oldCompartments.map((c: any) => c.id));
      const newCompIds = new Set(cleanDraft.compartments.map((c: any) => c.id));
      const compartmentsSame = [...existingIds].every(id => newCompIds.has(id)) && [...newCompIds].every(id => existingIds.has(id));
      const hasChanges = !decksSame || !compartmentsSame;

      Object.assign(hull, cleanDraft);
      hull.activeDeckIndex = 0;

      const inv = engine.ecs.getComponent(player, 'Inventory');
      if (inv) {
        inv.maxCapacity = calculateMaxCapacity(hull);
      }

      const wasExisting = new Set(oldCompartments.map((c: any) => c.id));
      hull.compartments.forEach((c: any) => {
        if (!wasExisting.has(c.id)) {
          c.isBuilding = true;
          c.buildProgress = 0;
        }
      });

      if (hasChanges) {
        hull.buildAnimation = {
          active: true,
          startTime: Date.now(),
          duration: 6000,
          oldDecks,
          newDecks: JSON.parse(JSON.stringify(draftHull.decks)),
          progress: 0,
          scaffoldPhase: true,
          buildPhase: false,
          oldCompartments,
          cost: blueprintData?.cost || { IRON: 0, TITANIUM: 0 },
        };
      }

      setInternalView(false);
      setActiveDeck(0);
      const pos = engine.ecs.getComponent(player, 'Position');
      if (pos) {
        engine.camera.setPos({
          sectorX: pos.sectorX,
          sectorY: pos.sectorY,
          offsetX: pos.offsetX,
          offsetY: pos.offsetY
        });
        engine.camera.setTargetAngle(pos.angle);
        engine.camera.setAngle(pos.angle);
      }
    }
    setIsEditorOpen(false);
    setIsPaused(false);
    if (engine) {
      engine.setIsPaused(false);
      engine.setIsEditorOpen(false);
      engine.setDraftHull(null);
      engine.saveState();
    }
    setIsEditorMenuOpen(false);
  };

  const cancelEditor = () => {
    if (!engine) return;
    const player = engine.player;
    if (player !== null) {
      const pos = engine.ecs.getComponent(player, 'Position');
      if (pos) {
        engine.camera.setPos({
          sectorX: pos.sectorX,
          sectorY: pos.sectorY,
          offsetX: pos.offsetX,
          offsetY: pos.offsetY
        });
        engine.camera.setTargetAngle(pos.angle);
        engine.camera.setAngle(pos.angle);
      }
    }
    setIsEditorOpen(false);
    setIsPaused(false);
    engine.setIsPaused(false);
    engine.setIsEditorOpen(false);
    engine.setDraftHull(null);
    setIsEditorMenuOpen(false);
  };

  return { applyChanges, cancelEditor };
}

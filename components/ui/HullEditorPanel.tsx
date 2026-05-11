// @ai-ignore-auto-remove: Editor UI component for hull vertices and deck control.
// This handles vertex selection, deck cycling, and symmetry toggles.

import React from 'react';
import type { EditorMode, ShipHull } from '@/components/game/types';

interface HullEditorPanelProps {
  shipHull: ShipHull;
  activeDeck: number;
  setActiveDeck: (i: number) => void;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  symmetryX: boolean;
  setSymmetryX: (v: boolean) => void;
  symmetryY: boolean;
  setSymmetryY: (v: boolean) => void;
  deleteDeck: () => void;
}

export const HullEditorPanel = ({
  shipHull, activeDeck, setActiveDeck, editorMode, setEditorMode,
  symmetryX, setSymmetryX, symmetryY, setSymmetryY, deleteDeck
}: HullEditorPanelProps) => {
  return (
    <div className="bg-black/80 border border-cyan-500/30 p-4 text-white space-y-4">
      <h3 className="font-bold text-cyan-400">Hull Geometry</h3>
      
      {/* TODO: Implement Deck/Symmetry Controls */}
      <div className="text-xs text-gray-400">Deck: {activeDeck} / {shipHull.decks.length}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setEditorMode('EDIT_VERTICES')} className={editorMode === 'EDIT_VERTICES' ? 'text-green-500' : 'text-gray-400'}>Edit Vertices</button>
        <button onClick={() => setEditorMode('EDIT_ARMOR')} className={editorMode === 'EDIT_ARMOR' ? 'text-green-500' : 'text-gray-400'}>Edit Armor</button>
        {shipHull.decks.length > 1 && (
          <button onClick={deleteDeck} className="text-red-500 text-xs">Delete Deck</button>
        )}
      </div>
      
      <div className="flex gap-2">
        <label title="Mirror Left/Right (Negate X)"><input type="checkbox" checked={symmetryY} onChange={(e) => setSymmetryY(e.target.checked)} /> Symmetry X (Л/П)</label>
        <label title="Mirror Top/Bottom (Negate Y)"><input type="checkbox" checked={symmetryX} onChange={(e) => setSymmetryX(e.target.checked)} /> Symmetry Y (В/Н)</label>
      </div>
    </div>
  );
};

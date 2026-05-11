'use client';

import React from 'react';
import { EditorMode, ShipHull } from '@/components/game/types';

interface BottomToolbarProps {
  isMobile: boolean;
  selectionType: 'deck' | 'compartment' | 'cell' | null;
  editorMode: EditorMode;
  setEditorMode: (m: EditorMode) => void;
  isTurretEditor: boolean;
  engine: any;
  symmetryX: boolean;
  setSymmetryX: (v: boolean) => void;
  symmetryY: boolean;
  setSymmetryY: (v: boolean) => void;
  activeCompartment: any;
  setActiveCompartment: (c: any) => void;
  setShipHull: (hull: ShipHull) => void;
  regenerateBeams: (newHull: ShipHull) => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  isMobile,
  selectionType,
  editorMode,
  setEditorMode,
  isTurretEditor,
  engine,
  symmetryX,
  setSymmetryX,
  symmetryY,
  setSymmetryY,
  activeCompartment,
  setActiveCompartment,
  setShipHull,
  regenerateBeams,
}) => {
  const getAvailableTools = (st: string | null, em?: string, ite?: boolean): [string, string][] => {
    if (ite) {
       return [
         ['PAN', 'PAN'],
         ['EDIT_VERTICES', 'VERTEX'],
         ['ADD_HULL_VERTEX', '+VERT'],
         ['SET_TURRET_PIVOT', 'PIVOT']
       ];
    }
    if (st === 'deck') {
      return [
        ['SELECT', 'SELECT'],
        ['PAN', 'PAN'],
        ['EDIT_VERTICES', 'VERTEX'],
        ['ADD_HULL_VERTEX', '+VERT'],
        ['ADD_COMPARTMENT', '+COMP'],
        ['BUILD_ARMOR', '+ARMOR'],
      ];
    }
    if (st === 'compartment') {
      return [
        ['SELECT', 'SELECT'],
        ['PAN', 'PAN'],
        ['MOVE_COMPARTMENT', 'MOVE'],
        ['EDIT_COMPARTMENTS', 'RESHAPE'],
        ['ADD_COMPARTMENT_VERTEX', '+VERT'],
        ['ADD_COMPARTMENT', '+COMP'],
      ];
    }
    return [
      ['SELECT', 'SELECT'],
      ['PAN', 'PAN'],
      ['ADD_COMPARTMENT', '+COMP'],
    ];
  };

  return (
    <div className={`absolute ${isMobile ? 'bottom-2' : 'bottom-6'} left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto`}>
      <div className={`flex ${isMobile ? 'gap-0.5' : 'gap-1'} bg-[#050505] ${isMobile ? 'p-1.5' : 'p-3'} border border-white/10 rounded-lg shadow-2xl max-w-[92vw] overflow-x-auto`}>
        {getAvailableTools(selectionType, editorMode, isTurretEditor).map(([mode, label]) => (
          <button
            key={mode}
            className={`${isMobile ? 'px-1.5 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'} border transition-colors whitespace-nowrap rounded ${editorMode === mode ? 'bg-blue-500/30 border-blue-500' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
            onClick={() => { setEditorMode(mode as EditorMode); engine.setEditorMode(mode as EditorMode); }}
          >{label}</button>
        ))}
      </div>
      {/* Symmetry toggles */}
      {(selectionType === 'deck' || !selectionType) && (
        <div className="flex gap-1">
          {(
            [
              ['X (Л/П)', symmetryY, setSymmetryY, 'symmetryY'],
              ['Y (В/Н)', symmetryX, setSymmetryX, 'symmetryX']
            ] as [string, boolean, (v: boolean) => void, string][]
          ).map(([label, val, setter, key]) => (
            <button
              key={key}
              className={`${isMobile ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} border transition-colors rounded ${val ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
              onClick={() => {
                const next = !val;
                if (engine && engine.draftHull) {
                  if (key === 'symmetryX') engine.setSymmetryX(next);
                  else if (key === 'symmetryY') engine.setSymmetryY(next);
                  const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                  regenerateBeams(newHull);
                  setShipHull(newHull);
                }
                setter(next);
              }}
            >СИММЕТРИЯ {label}: {val ? 'ВКЛ' : 'ВЫКЛ'}</button>
          ))}
        </div>
      )}
      {selectionType === 'compartment' && (
        <div className="flex flex-col gap-1 items-center">
          <div className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} text-white/30`}>
            {activeCompartment?.pairedWith
              ? 'Парный отсек — зеркальное редактирование'
              : 'Одиночный отсек — применяется симметрия корпуса'}
          </div>
          <div className="flex gap-1">
            {(
              [
                ['X (Л/П)', symmetryY, setSymmetryY, 'symmetryY'],
                ['Y (В/Н)', symmetryX, setSymmetryX, 'symmetryX']
              ] as [string, boolean, (v: boolean) => void, string][]
            ).map(([label, val, setter, key]) => (
              <button
                key={key}
                disabled={!!activeCompartment?.pairedWith}
                className={`${isMobile ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} border transition-colors rounded ${val ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' : 'bg-white/5 border-white/20 hover:bg-white/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                onClick={() => {
                  const next = !val;
                  if (key === 'symmetryX') engine.setSymmetryX(next);
                  else if (key === 'symmetryY') engine.setSymmetryY(next);
                  if (engine.draftHull) {
                    const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                    regenerateBeams(newHull);
                    setShipHull(newHull);
                  }
                  setter(next);
                }}
              >СИММЕТРИЯ {label}: {val ? 'ВКЛ' : 'ВЫКЛ'}</button>
            ))}
          </div>
          {activeCompartment?.pairedWith && (
            <button 
              className={`${isMobile ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} border border-red-500 bg-red-500/20 text-red-200 mt-1 uppercase`}
              onClick={() => {
                if (engine.draftHull && activeCompartment) {
                  const newHull = JSON.parse(JSON.stringify(engine.draftHull));
                  const c1 = newHull.compartments.find((c: any) => c.id === activeCompartment.id);
                  const c2 = newHull.compartments.find((c: any) => c.id === activeCompartment.pairedWith);
                  if (c1) { delete c1.pairedWith; delete c1.pairAxis; }
                  if (c2) { delete c2.pairedWith; delete c2.pairAxis; }
                  engine.setDraftHull(newHull);
                  setActiveCompartment(c1);
                  engine.setActiveCompartment(c1);
                  setShipHull(newHull);
                }
              }}
            >Сделать Одиночными (Разделить)</button>
          )}
        </div>
      )}
    </div>
  );
};

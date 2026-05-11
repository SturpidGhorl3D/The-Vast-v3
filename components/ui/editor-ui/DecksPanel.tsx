'use client';

import React from 'react';
import { ShipHull, Deck } from '@/components/game/types';
import { generateStructuralBeams } from '@/components/game/editorLogic';

interface DecksPanelProps {
  isMobile: boolean;
  shipHull: ShipHull;
  setShipHull: (hull: ShipHull) => void;
  activeDeck: number;
  setActiveDeck: (i: number) => void;
  selectionType: 'deck' | 'compartment' | 'cell' | null;
  setSelectionType: (v: 'deck' | 'compartment' | 'cell' | null) => void;
  setSelectedElementIndex: (v: number | string | null) => void;
  setInternalView: (v: boolean) => void;
  resources: { IRON: number; TITANIUM: number; [key: string]: any };
  costInfo: { cost: { IRON: number; TITANIUM: number }; refund: { IRON: number; TITANIUM: number } } | null;
  engine: any;
  researchedTechs?: string[];
  isCreative?: boolean;
}

export const DecksPanel: React.FC<DecksPanelProps> = ({
  isMobile,
  shipHull,
  setShipHull,
  activeDeck,
  setActiveDeck,
  selectionType,
  setSelectionType,
  setSelectedElementIndex,
  setInternalView,
  resources,
  costInfo,
  engine,
  researchedTechs = [],
  isCreative = false,
}) => {
  const px = isMobile ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';

  return (
    <>
      {/* Resources */}
      <div className="text-[8px] opacity-40 uppercase mb-1">Materials</div>
      <div className={`mb-2 p-1.5 bg-white/5 border border-white/10 text-[10px] space-y-0.5`}>
        <div className="flex justify-between">
          <span>Fe:</span>
          <span className={costInfo && costInfo.cost.IRON > resources.IRON ? 'text-red-400' : 'text-blue-400'}>{Math.floor(resources.IRON)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ti:</span>
          <span className={costInfo && costInfo.cost.TITANIUM > resources.TITANIUM ? 'text-red-400' : 'text-blue-400'}>{Math.floor(resources.TITANIUM)}</span>
        </div>
      </div>

      {/* Decks */}
      <div className="text-[8px] opacity-40 uppercase mb-1">Hull Decks</div>
      <div className="space-y-1 flex-1 overflow-y-auto pr-0.5 mb-2">
        {[...shipHull.decks].reverse().map((_: any, ri: number) => {
          const idx = shipHull.decks.length - 1 - ri;
          const deck = shipHull.decks[idx];
          const isSelected = activeDeck === idx && selectionType === 'deck';
          return (
            <div
              key={idx}
              className={`border transition-colors text-[10px] ${isSelected ? 'bg-blue-500/20 border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div
                className="flex justify-between items-center px-2 py-1 cursor-pointer"
                onClick={() => {
                  if (engine && engine.draftHull) {
                    const hull = engine.draftHull;
                    hull.activeDeckIndex = idx;
                    engine.setSelectionType('deck');
                    engine.setSelectedElementIndex(idx);
                    setSelectionType('deck');
                    setSelectedElementIndex(idx);
                    setActiveDeck(idx);
                    setShipHull({ ...hull });
                  }
                  setInternalView(true);
                }}
              >
                <span className="font-bold truncate">{deck.name || `Deck ${idx}`}</span>
                <div className="flex gap-0.5 shrink-0">
                  <button className="px-1 hover:bg-white/20 rounded disabled:opacity-20" disabled={idx === shipHull.decks.length - 1}
                    onClick={e => {
                      e.stopPropagation();
                      if (!engine.draftHull) return;
                      const hull = JSON.parse(JSON.stringify(engine.draftHull));
                      hull.decks.splice(idx + 1, 0, hull.decks.splice(idx, 1)[0]);
                      hull.decks.forEach((dk: any, i: number) => (dk.level = i));
                      hull.compartments.forEach((c: any) => {
                        const s = c.startDeck, en = c.endDeck;
                        if (s === idx) c.startDeck = idx + 1; else if (s === idx + 1) c.startDeck = idx;
                        if (en === idx) c.endDeck = idx + 1; else if (en === idx + 1) c.endDeck = idx;
                      });
                      setShipHull(hull); engine.updateDraftHull(hull); setActiveDeck(idx + 1);
                    }}>↑</button>
                  <button className="px-1 hover:bg-white/20 rounded disabled:opacity-20" disabled={idx === 0}
                    onClick={e => {
                      e.stopPropagation();
                      if (!engine.draftHull) return;
                      const hull = JSON.parse(JSON.stringify(engine.draftHull));
                      hull.decks.splice(idx - 1, 0, hull.decks.splice(idx, 1)[0]);
                      hull.decks.forEach((dk: any, i: number) => (dk.level = i));
                      hull.compartments.forEach((c: any) => {
                        const s = c.startDeck, en = c.endDeck;
                        if (s === idx) c.startDeck = idx - 1; else if (s === idx - 1) c.startDeck = idx;
                        if (en === idx) c.endDeck = idx - 1; else if (en === idx - 1) c.endDeck = idx;
                      });
                      setShipHull(hull); engine.updateDraftHull(hull); setActiveDeck(idx - 1);
                    }}>↓</button>
                  <button className="px-1 hover:bg-red-500/20 rounded text-red-500 hover:text-red-300"
                    onClick={e => {
                      e.stopPropagation();
                      if (!engine.draftHull) return;
                      const hull = JSON.parse(JSON.stringify(engine.draftHull));
                      if (hull.decks.length <= 1) return;
                      
                      // Remove deck
                      hull.decks.splice(idx, 1);
                      hull.decks.forEach((dk: any, i: number) => (dk.level = i));
                      
                      // Remove or adjust compartments
                      hull.compartments = hull.compartments.filter((c: any) => {
                         const s = c.startDeck, en = c.endDeck;
                         if (s === idx && en === idx) return false;
                         if (s > idx) c.startDeck--;
                         if (en > idx) c.endDeck--;
                         c.startDeck = Math.min(c.startDeck, hull.decks.length - 1);
                         c.endDeck = Math.min(c.endDeck, hull.decks.length - 1);
                         return true;
                      });

                      setShipHull(hull); engine.updateDraftHull(hull); setActiveDeck(Math.max(0, idx - 1));
                    }}>X</button>
                </div>
              </div>
              {activeDeck === idx && selectionType === 'deck' && (
                <>
                  <div className="px-2 pb-1 border-t border-white/10 flex justify-between items-center text-[9px]">
                    <span>h:</span>
                    <div className="flex gap-1 items-center">
                      <button className="px-1.5 bg-white/10 hover:bg-white/20" onClick={e => { e.stopPropagation(); engine.updateDeckHeight(idx, -1); setShipHull({ ...engine.draftHull }); }}>−</button>
                      <span>{deck.height || 5}m</span>
                      <button className="px-1.5 bg-white/10 hover:bg-white/20" onClick={e => { e.stopPropagation(); engine.updateDeckHeight(idx, 1); setShipHull({ ...engine.draftHull }); }}>+</button>
                    </div>
                  </div>
                  <div className="px-2 pb-1 border-t border-white/10 flex justify-between items-center text-[9px]">
                    <span>thick:</span>
                    <div className="flex gap-1 items-center">
                      <button className="px-1.5 bg-white/10 hover:bg-white/20" onClick={e => { e.stopPropagation(); engine.updateDeckThickness(idx, -1); setShipHull({ ...engine.draftHull }); }}>−</button>
                      <span>{(deck.globalHullThickness || 0.5).toFixed(1)}m</span>
                      <button className="px-1.5 bg-white/10 hover:bg-white/20" onClick={e => { e.stopPropagation(); engine.updateDeckThickness(idx, 1); setShipHull({ ...engine.draftHull }); }}>+</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button
          disabled={!isCreative && !researchedTechs.includes('eng_modular_decks')}
          className={`w-full ${px} border transition-all ${
            isCreative || researchedTechs.includes('eng_modular_decks')
              ? 'bg-white/10 hover:bg-white/20 border-white/30 text-white'
              : 'bg-red-900/10 border-red-900/30 text-red-500/50 cursor-not-allowed grayscale'
          }`}
          onClick={() => {
            if (!engine.draftHull) return;
            const hull = JSON.parse(JSON.stringify(engine.draftHull));
            const newLevel = hull.decks.length;
            const newDeck: Deck = { 
              id: `deck-${Date.now()}`,
              level: newLevel, 
              points: [...hull.decks[0].points], 
              color: '#555555', 
              height: 5, 
              name: `Deck ${newLevel + 1}`,
              beamPattern: 'SQUARE',
              beamDensity: 2.0,
              beams: [],
              cells: []
            };
            
            const { beams, cells } = generateStructuralBeams(
              newDeck.points,
              hull.compartments.filter((c: any) => c.startDeck <= newLevel && c.endDeck >= newLevel),
              'SQUARE',
              newDeck.beamDensity,
              engine.symmetryY,
              engine.symmetryX
            );
            newDeck.beams = beams;
            newDeck.cells = cells;
            
            hull.decks.push(newDeck);
            hull.activeDeckIndex = newLevel;
            engine.updateDraftHull(hull);
            setActiveDeck(newLevel);
            setShipHull(hull);
          }}
        >+ ADD DECK</button>
      </div>
    </>
  );
};

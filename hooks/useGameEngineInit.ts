import { useEffect } from 'react';
import type { GameEngine } from '@/game/engine/GameEngine';
import { makeDefaultCompartmentExtras } from '@/game/compartmentUtils';

function rectPoints(cx: number, cy: number, w: number, h: number) {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

export function makeStarterCompartments(size: number) {
  return [
    {
      id: 'bridge-1', type: 'BRIDGE' as const,
      x: 16, y: 0, width: 8, height: 4,
      points: rectPoints(16, 0, 8, 4),
      startDeck: 0, endDeck: 0, color: '#5577ff',
    },
    {
      id: 'reactor-1', type: 'REACTOR' as const,
      x: 0, y: 0, width: 6, height: 6,
      points: rectPoints(0, 0, 6, 6),
      startDeck: 0, endDeck: 0, color: '#ff9900',
      ...makeDefaultCompartmentExtras('REACTOR'),
    },
    {
      id: 'gyro-1', type: 'GYRO' as const,
      x: -6, y: 0, width: 4, height: 4,
      points: rectPoints(-6, 0, 4, 4),
      startDeck: 0, endDeck: 0, color: '#33cc66',
      ...makeDefaultCompartmentExtras('GYRO'),
    },
    {
      id: 'warp-1', type: 'WARP_ENGINE' as const,
      x: -11, y: 0, width: 4, height: 4,
      points: rectPoints(-11, 0, 4, 4),
      startDeck: 0, endDeck: 0, color: '#aa44ff',
    },
    {
      id: 'cargo-1', type: 'CARGO' as const,
      x: 0, y: 6, width: 5, height: 4,
      points: rectPoints(0, 6, 5, 4),
      startDeck: 0, endDeck: 0, color: '#886600',
      pairedWith: 'cargo-2', pairAxis: 'Y' as const,
      ...makeDefaultCompartmentExtras('CARGO'),
    },
    {
      id: 'cargo-2', type: 'CARGO' as const,
      x: 0, y: -6, width: 5, height: 4,
      points: rectPoints(0, -6, 5, 4),
      startDeck: 0, endDeck: 0, color: '#886600',
      pairedWith: 'cargo-1', pairAxis: 'Y' as const,
      ...makeDefaultCompartmentExtras('CARGO'),
    },
    {
      id: 'mining-1', type: 'MINING' as const,
      x: 7, y: 0, width: 4, height: 4,
      points: rectPoints(7, 0, 4, 4),
      startDeck: 0, endDeck: 0, color: '#44ff44',
      ...makeDefaultCompartmentExtras('MINING'),
    },
    {
      id: 'engine-1', type: 'ENGINE' as const,
      x: -18, y: 3.5, width: 8, height: 4,
      points: rectPoints(-18, 3.5, 8, 4),
      startDeck: 0, endDeck: 0, color: '#ff5533',
      pairedWith: 'engine-2', pairAxis: 'Y' as const,
      ...makeDefaultCompartmentExtras('ENGINE'),
    },
    {
      id: 'engine-2', type: 'ENGINE' as const,
      x: -18, y: -3.5, width: 8, height: 4,
      points: rectPoints(-18, -3.5, 8, 4),
      startDeck: 0, endDeck: 0, color: '#ff5533',
      pairedWith: 'engine-1', pairAxis: 'Y' as const,
      ...makeDefaultCompartmentExtras('ENGINE'),
    },
    {
      id: 'machinery-1', type: 'MACHINERY' as const,
      x: -6, y: 6, width: 4, height: 4,
      points: rectPoints(-6, 6, 4, 4),
      startDeck: 0, endDeck: 0, color: '#999999',
      ...makeDefaultCompartmentExtras('MACHINERY'),
    },
    {
      id: 'fabric-1', type: 'FABRIC' as const,
      x: -6, y: -6, width: 4, height: 4,
      points: rectPoints(-6, -6, 4, 4),
      startDeck: 0, endDeck: 0, color: '#33ccff',
      ...makeDefaultCompartmentExtras('FABRIC'),
    },
  ];
}

import { GameSave } from '@/components/ui/main-menu/MainMenu';
import { generateStructuralBeams } from '@/components/game/editorLogic';

export function useGameEngineInit(engine: GameEngine | undefined | null, isReady: boolean, save?: GameSave, isCreative?: boolean) {
  useEffect(() => {
    if (!engine || !isReady || engine.player !== null) return;

    if (isCreative) {
      // In creative mode, skip world dependency and give empty/light setup
      const player = engine.ecs.createEntity();
      const defaultDecks = [
        { 
          level: 0, 
          points: [
            {x: 21, y: 0}, {x: 12, y: 3}, {x: 4, y: 9}, {x: -4, y: 9}, 
            {x: -12, y: 5}, {x: -23, y: 6}, {x: -23, y: -6}, {x: -12, y: -5}, 
            {x: -4, y: -9}, {x: 4, y: -9}, {x: 12, y: -3}
          ], 
          color: '#444444', 
          name: 'Main Deck',
          beamPattern: 'SQUARE' as const,
          beamDensity: 3.0,
          globalHullThickness: 0.5,
          cells: [],
          beams: []
        }
      ];
      
      const hullComp = { 
        style: 'STEEL', 
        size: 30, 
        decks: defaultDecks, 
        compartments: makeStarterCompartments(30), 
        activeDeckIndex: 0 
      };

      hullComp.decks.forEach((dk: any, index: number) => {
         const deckCompartments = hullComp.compartments.filter((c: any) => c.startDeck <= index && c.endDeck <= index);
         const { beams, cells } = generateStructuralBeams(dk.points, deckCompartments, dk.beamPattern || 'SQUARE', dk.beamDensity || 3.0, false, false);
         dk.beams = beams;
         dk.cells = cells;
      });

      engine.ecs.addComponent(player, 'Position', { sectorX: 0n, sectorY: 0n, offsetX: 0, offsetY: 0, angle: 0 });
      engine.ecs.addComponent(player, 'Velocity', { vx: 0, vy: 0, va: 0 });
      engine.ecs.addComponent(player, 'Hull', hullComp);
      engine.ecs.addComponent(player, 'Inventory', { 
        resources: { IRON: 9999999, TITANIUM: 9999999 }, // Infinite resources
        maxCapacity: 9999999 
      });
      engine.player = player;
      engine.refreshWeaponComponents(player);
      return;
    }

    const state = (save && engine.loadState) ? engine.loadState(save) : null;
    
    // Ensure Org Settings are set even for new games
    if (save && !state) {
        engine.orgType = save.orgType;
        engine.originId = save.originId;
        engine.playerSpecies = save.species || null;

        // Set initial technologies based on species / origin
        const shipType = engine.playerSpecies?.shipType || 'STANDARD';
        if (shipType === 'CRYSTALLID') {
           engine.researchedTechs = ['eng_root', 'eng_basic_construction', 'mat_crystal_structure'];
        } else if (shipType === 'ORGANIC') {
           engine.researchedTechs = ['eng_root', 'eng_basic_construction', 'mat_organic_lattice'];
        } else if (shipType === 'BIOMECHANICAL') {
           engine.researchedTechs = ['eng_root', 'eng_basic_construction', 'mat_biomech_base'];
        } else {
           engine.researchedTechs = ['eng_root', 'eng_basic_construction', 'mat_durasteel'];
        }
        
        // Also add tech for initial special modules if requested
        engine.researchedTechs.push('mining_t1_lasers', 'wpn_t1_ballistics', 'eng_reactors_t1');
    }
    
    if (state) {
        engine.playerSpecies = state.species || save?.species || null;
    }
    
    // Check if we have specific starter data for this world id
    let starterData: any = null;
    if (save) {
      const stored = localStorage.getItem(`thevast-player-${save.id}`);
      if (stored) {
        try {
          starterData = JSON.parse(stored);
        } catch(e) {}
      }
    }
    
    const defaultDecks = [
      { 
        level: 0, 
        points: [
          {x: 21, y: 0}, {x: 12, y: 3}, {x: 4, y: 9}, {x: -4, y: 9}, 
          {x: -12, y: 5}, {x: -23, y: 6}, {x: -23, y: -6}, {x: -12, y: -5}, 
          {x: -4, y: -9}, {x: 4, y: -9}, {x: 12, y: -3}
        ], 
        color: '#444444', 
        name: 'Main Deck',
        beamPattern: 'SQUARE' as const,
        beamDensity: 3.0,
        globalHullThickness: 0.5,
        cells: [],
        beams: []
      }
    ];

    const startSys = engine.world.getNearestSystem(0n, 0n, 0, 0);
    // Let's try to find a station in the starting system to spawn near
    let spawnOffsetX = startSys ? startSys.offsetX : 0;
    let spawnOffsetY = startSys ? startSys.offsetY : 0;
    
    if (startSys && startSys.spaceStations && startSys.spaceStations.length > 0) {
      const st = startSys.spaceStations[0];
      // We know orbitRadius and orbitTarget, but for simplicity let's just use some random offset relative to star for now
      // Properly, resolving station coordinates requires computing orbit.
      spawnOffsetX += 2000;
      spawnOffsetY += 2000;
    }

    const defaultSectorX = startSys ? startSys.sectorX : 0n;
    const defaultSectorY = startSys ? startSys.sectorY : 0n;

    const player = engine.ecs.createEntity();
    import('@/game/systems').then(({ calculateMaxCapacity }) => {
      const hullComp = state ? state.shipHull : (starterData?.shipHull || { 
        style: 'STEEL', 
        size: 30, 
        decks: defaultDecks, 
        compartments: makeStarterCompartments(30), 
        activeDeckIndex: 0 
      });

      if (!state && !starterData?.shipHull) {
        hullComp.decks.forEach((dk: any, index: number) => {
           const deckCompartments = hullComp.compartments.filter((c: any) => c.startDeck <= index && c.endDeck >= index);
           const { beams, cells } = generateStructuralBeams(dk.points, deckCompartments, dk.beamPattern || 'SQUARE', dk.beamDensity || 3.0);
           dk.beams = beams;
           dk.cells = cells;
        });
      }
      
      const pos = state ? state.playerPosition : (starterData?.playerPosition || { 
        sectorX: defaultSectorX, 
        sectorY: defaultSectorY, 
        offsetX: spawnOffsetX, 
        offsetY: spawnOffsetY, 
        angle: 0 
      });

      const vel = state ? state.playerVelocity : { vx: 0, vy: 0, va: 0 };
      
      let playerResources: Record<string, number> = { IRON: 100, TITANIUM: 50 };
      if (engine.playerSpecies?.shipType === 'CRYSTALLID') {
        playerResources = { SILICON: 150, IRON: 20 };
      } else if (engine.playerSpecies?.shipType === 'BIOMECHANICAL') {
        playerResources = { SILICON: 100, IRON: 50 };
      } else if (engine.playerSpecies?.shipType === 'ORGANIC') {
        playerResources = { SULFUR: 100, ICE: 50, IRON: 20 };
      }
      
      const inventory = state ? state.inventory : (starterData?.inventory || playerResources);

      engine.ecs.addComponent(player, 'Position', pos);
      engine.ecs.addComponent(player, 'Velocity', vel);
      engine.ecs.addComponent(player, 'Hull', hullComp);
      engine.ecs.addComponent(player, 'Inventory', { 
        resources: inventory,
        maxCapacity: calculateMaxCapacity(hullComp as any)
      });
      engine.player = player;
      engine.refreshWeaponComponents(player);
      engine.mapPos = { ...pos };
      engine.isInitialized = true;

      import('../game/engine/types').then(({ AIBehavior, FactionRelation }) => {
        engine.ecs.addComponent(player, 'Faction', { id: 'PLAYER', name: 'Player', color: '#00ffcc', relationToPlayer: FactionRelation.FRIENDLY, isPlayer: true });
        
        // NPCs are now spawned dynamically by the factionSpawnerSystem.
      });
    });
  }, [engine, isReady, save, isCreative]);
}

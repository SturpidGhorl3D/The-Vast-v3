import { ECS, Entity } from '../engine/ecs';
import { Position, Velocity, Hull, Faction, AIState, AIBehavior, FactionRelation } from '../engine/types';
import { globalFactionManager } from '../world/FactionManager';
import { GameEngine } from '../engine/GameEngine';
import { getLargestShipDimension } from '../hullGeometry';

const MAX_NPCS_PER_SYSTEM = 10;
let spawnerTimer = 0;

export function factionSpawnerSystem(ecs: ECS, engine: any, dt: number) {
  spawnerTimer += dt;
  // only try to spawn once every few seconds
  if (spawnerTimer < 60) return; // approx 1 second at 60fps
  spawnerTimer = 0;

  const currentSystem = engine.currentSystem;
  if (!currentSystem) return;

  // Count current NPCs
  const npcs = ecs.getEntitiesWith(['AIState', 'Position', 'Faction']);
  
  if (npcs.length >= MAX_NPCS_PER_SYSTEM) return;

  // We should spawn ships based on space stations or planets controlling the system.
  const stations = currentSystem.spaceStations || [];
  if (stations.length === 0) return;

  const station = stations[Math.floor(Math.random() * stations.length)];
  if (!station.factionId) return;

  const faction = globalFactionManager.getFaction(station.factionId);
  if (!faction) return;

  // PICK BLUEPRINT
  let hull: Hull | null = null;
  if (faction.blueprints && faction.blueprints.length > 0) {
    // Clone the blueprint to avoid messing with original
    hull = JSON.parse(JSON.stringify(faction.blueprints[Math.floor(Math.random() * faction.blueprints.length)]));
  }

  // Fallback if no blueprints found
  if (!hull) {
    const npcDecks: any[] = [
      { 
        level: 0, 
        points: [ {x: 12, y: 0}, {x: -8, y: 8}, {x: -8, y: -8} ], 
        color: faction.color, 
        name: 'Fighter Deck',
        beamPattern: 'SQUARE', beamDensity: 2.0, globalHullThickness: 0.5,
        cells: [], beams: []
      }
    ];
    
    const compColor = faction.color;
    const npcCompartments = [
      {
        id: 'reactor-1', type: 'REACTOR' as const,
        x: -2, y: 0, width: 4, height: 4,
        points: [{x:0,y:-2}, {x:4,y:-2}, {x:4,y:2}, {x:0,y:2}],
        startDeck: 0, endDeck: 0, color: compColor,
        structureLevel: 1, baseMaxIntegrity: 100, currentIntegrity: 100, isDestroyed: false, armorRating: 5
      },
      {
        id: 'engine-1', type: 'ENGINE' as const,
        x: -6, y: 0, width: 4, height: 6,
        points: [{x:-2,y:-3}, {x:2,y:-3}, {x:2,y:3}, {x:-2,y:3}],
        startDeck: 0, endDeck: 0, color: compColor,
        structureLevel: 1, baseMaxIntegrity: 100, currentIntegrity: 100, isDestroyed: false, armorRating: 5
      },
      {
        id: 'weapon-1', type: 'WEAPON' as const,
        x: 2, y: 0, width: 4, height: 4,
        points: [{x:0,y:-2}, {x:4,y:-2}, {x:4,y:2}, {x:0,y:2}],
        startDeck: 0, endDeck: 0, color: '#ff2222',
        structureLevel: 1, baseMaxIntegrity: 100, currentIntegrity: 100, isDestroyed: false, armorRating: 5,
        turretConfig: {
            fireMode: 'ROUNDS' as const, weaponGroup: 'MAIN' as const,
            damage: 10, range: 800, rateOfFire: 2, projectileSpeed: 800, barrelCount: 1
        }
      }
    ];

    hull = {
      style: 'STEEL', size: 20,
      decks: npcDecks,
      compartments: npcCompartments,
      activeDeckIndex: 0
    };
  }

  // Calculate station logical position on map
  // Note: the orbit changes over time, we just spawn them near the station loosely based on orbit at current time
  // For simplicity, spawn them directly at the station's base coordinates plus a small random offset.
  const time = engine.currentTime;
  
  const stationLocalPos = engine.getCelestialLocalPos(station, time);

  const spawnOffsetX = currentSystem.offsetX + stationLocalPos.x + (Math.random() - 0.5) * 5000;
  const spawnOffsetY = currentSystem.offsetY + stationLocalPos.y + (Math.random() - 0.5) * 5000;

  // CREATE NPC
  const npc = ecs.createEntity();
  ecs.addComponent<Position>(npc, 'Position', {
    sectorX: currentSystem.sectorX,
    sectorY: currentSystem.sectorY,
    offsetX: spawnOffsetX,
    offsetY: spawnOffsetY,
    angle: Math.random() * Math.PI * 2
  });

  ecs.addComponent<Velocity>(npc, 'Velocity', { vx: 0, vy: 0, va: 0 });
  
  ecs.addComponent(npc, 'Hull', hull);

  engine.refreshWeaponComponents(npc);
  
  ecs.addComponent<Faction>(npc, 'Faction', {
      id: faction.id,
      name: faction.name,
      color: faction.color,
      isPlayer: false,
      relationToPlayer: globalFactionManager.getRelation(faction.id, 'PLAYER') as FactionRelation
  });

  ecs.addComponent<AIState>(npc, 'AIState', { behavior: AIBehavior.IDLE });
}

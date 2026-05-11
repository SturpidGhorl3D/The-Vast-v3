# Alpha 3.1.0 Development Guide: AI System Stack

This file serves as the master reference for the game's architecture, system interactions, and the complex TODO roadmap for the Alpha 3.1.0 milestone.

## ⚠️ Warning: Interconnected Systems
Alpha 3.1.0 introduces highly coupled systems. We cannot isolate development completely. All architectural changes must account for effects on:
- Races/Origins/Gameplay Trifecta (Personal/State/Nomad)
- Technology Tree & Crafting
- Population Management & Crew Mechanics
- Hull Editor Cost Rework
- Macro-Simulation (AI States & State Simulation)

---

## 1. Core Architecture Reference

### Engine Foundation (`/game/engine/`)
- `GameCore.ts`: Main entry point/orchestration.
- `GameEngine.ts`: ECS Heart.
- `ecs.ts`: Component management.
- `renderer.ts` & `/game/engine/renderers/`: All rendering logic.

### World & Simulation (`/game/world/`)
- `WorldGenerator.ts`: System generation.
- `AsteroidGridManager.ts`: Spatial partitioning.
- `World.worker.ts`: Off-main-thread spatial queries.

### Game Systems (ECS) (`/game/systems/`)
- `combatSystem.ts`: Weapons/Health.
- `movementSystem.ts`: Physics.
- `turretSystem.ts`: Auto-aiming/firing.
- `miningSystem.ts`: Resource extraction.
- `aiSystem.ts`: Basic NPC behavior (Needs rework for Macro-Sim).
- `projectileSystem.ts`: Projectile lifecycle.

### UI Stack (`/components/`)
- `/components/ui/`: Complex interface modules (Mining, Production, Targeting, HullEditor).
- `/components/ui/editor-ui/`: Ship building components.

---

## 2. Existing Game Mechanics Summary (Dev Reference)
- **ECS Physics/Movement**: Relies on `movementSystem.ts` processing components.
- **Ship Editor**: Uses `/game/hullGeometry.ts` and `/components/ui/editor-ui/*.ts`. Operates on mutable vertex arrays.
- **Asteroids**: Managed spatially via `AsteroidGenerator.ts` and `AsteroidGridManager.ts`.

## 2.5. Current Achievements (Alpha 3.1.0 Progress)
- **Visual Technology Tree**: Implemented dynamic SVG-based tech tree visualization.
- **Time-based Research System**: Added `activeResearch` tracking, lab-dependent speed calculation, and tech-rolling logic upon completion.
- **Tech-Locked Editor**: Editor functions (like modular decks and module upgrades) are now conditionally unlocked based on researched technologies.
- **Dynamic Research Options**: Implemented probabilistic tech tree rollout for Nomad-style gameplay.

---

## 3. Alpha 3.1.0 Roadmap & TODOs

### Phase A: Data Foundations & Backbone
- [ ] Define Race/Origin/Tech data types in `/game/types.ts` or new `/game/dataTypes.ts`.
- [ ] Implement Population/Crew component structure.
- [ ] Refactor `/game/presets.ts` to support race/origin modifiers.

### Phase B: Mechanics Implementation (Parallel Focus)
- [ ] **Trifecta Gameplay**: Implement logic for Personal vs State vs Nomad interactions.
- [ ] **Tech Tree/Crafting**: Build the backend system (`/game/systems/craftingSystem.ts`).
- [ ] **Editor Rework**: Update cost calculation logic in `/components/game/editorLogic.ts` and UI in `/components/ui/editor-ui/CostPanel.tsx`.

### Phase C: Simulation & AI
- [ ] **Macro-Simulation**: Implement logic for AI States in `/game/systems/aiSystem.ts` and new `/game/world/aiSimulation.ts`.
- [ ] **Population Sim**: Implement dynamic birth/crew management system.

### Phase D: UI Integration
- [ ] Create Tech Tree UI.
- [ ] Create Population/Crew management UI windows.

---

## 4. Maintenance & Safety Rules
- **ECS Rule**: Never use truthiness checks for entities (Entity ID 0 is falsy). Always use `=== null`.
- **Symmetry (Editor)**:
    - Vertical UI (`symmetryY`) -> Horizontal Symmetry (mirror -X).
    - Horizontal UI (`symmetryX`) -> Vertical Symmetry (mirror -Y).
- **Geometry Arrays**: When deleting elements by index, **always sort descending** (`b - a`) and **splice backwards** to avoid index shifting.
- **BigInt Safety**: When logging/serializing entities with `BigInt`, use custom replacer/serialization to avoid JSON crashes.

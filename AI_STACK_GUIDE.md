# 🌌 THE VAST: Master Architecture & Mechanics Stack

## 1. Overview
**THE VAST** is a high-performance 2D space simulation game with procedural generation, an ECS (Entity Component System) architecture, and complex logistics, economy, and ship-building elements.

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Rendering**: Babylon.js (Core) / WebGPU with custom Shaders (`WorldRenderer.ts`, `CelestialRenderer.ts`, `Graphics2D.ts`) 
- **Networking**: `socket.io-client` for Multiplayer State Sync
- **Geometry/Math**: `d3-delaunay`, `earcut`, `simplex-noise`, `polygon-clipping`
- **State Management**: Custom React Hooks interfacing with the ECS (`GameCore`, `GameEngine`)

---

## 2. Global Architecture & Project Structure
```
app/                     # Next.js App Router (Entry & HTML layout)
components/
  GameCanvas.tsx         # Main entry point for the WebGL Canvas viewport
  HUD.tsx                # Contextual sliding HUD overlays
  MobileControls.tsx     # Touch-based D-pad / interaction overlays
  game/                  
    types.ts             # Global TS definitions (Hull, Compartment, GlobalCoords)
    editorLogic.ts       # Mirroring, validation, geometry resolution
  ui/                    # ALL React Overlays
    editor-ui/           # Modular Sub-components of the Editor
    species-editor/      # Pixel-art portrait generator, genetics tree
    main-menu/           # Start/MainMenu screens
    DiplomacyWindow.tsx  # Faction relations
    MiningWindow.tsx     # Resource extraction UI
    TechnologyWindow.tsx # Research & Tech Tree UI
    TacticalContextMenu  # Right-click context menus for targeting
game/
  constants.ts           # Physics limits, costs, grid spacing, network ticks
  data/                  # Game Content Registries
    materials/           # Extracted elements (tier1, reactor, mining, weapons)
    technologies/        # Physics, Sociology, Engineering tech trees
  engine/                # ECS & Logic Core
    GameCore.ts          # Logic loop entrypoint
    GameEngine.ts        # The actual ECS state container
    ecs.ts               # Component bitmask querying and layout
    camera.ts            # Screen<->World transformations + BigInt Grid logic
    renderers/           # Babylon.js specific mesh/material dispatchers
    managers/            # Lifecycle orchestrators (Economy, Discovery, Multiplayer, Loot)
  systems/               # ECS Update Loops
    aiSystem, combatSystem, miningSystem, movementSystem, turretSystem, etc.
    ship_generator/      # Algorithmic ship geometry & component spawner
  world/                 
    WorldGenerator.ts    # Macro-galaxy generation
    AsteroidGenerator.ts # Spatial chunks of resources
    global_map/          # Abstract galaxy-view UI overlay representations
```

---

## 3. Core Engine Mechanics

### Coordinate System (BigInt)
Because spatial limits are effectively infinite, World coordinates are managed via `GlobalCoords`:
- `sectorX: bigint`, `sectorY: bigint` (Chunks of `10,000,000,000` meters).
- `offsetX: number`, `offsetY: number` (Standard coordinates within the chunk).
- *Warning*: Any logging or stringifying of ECS components with `BigInt` MUST map them to explicitly serializable primitives (e.g. `Number(num)` or string cast) to prevent Next.js rendering crashes.

### Rendering (Babylon.js)
The game utilizes purely custom `.ts` renderers abstracting Babylon.js:
- **`BaseRenderer` / `Graphics2D`**: Custom Batched procedural primitives (lines, polygons) mimicking pure Canvas2D but GPU accelerated.
- **`CelestialRenderer`**: Shader-based volumetric suns/stars using `@babylonjs/core`.
- **`NoiseLUT`**: Volumetric 3D noisemap textures to generate fog-of-war and cosmic dust dynamically on the GPU.

### Multiplayer / Networking
- Handled primarily by `MultiplayerManager.ts` & `useMultiplayer.ts`.
- Synchronization of `NetworkPlayerState` (Pos/Vel), ensuring remote ships are rendered accurately on top of local simulated environments.

---

## 4. Entity Component System (ECS)
The core simulation runs irrespective of the UI via `GameEngine.ts`:

### Standard Components
- **Velocity/Position**: Handled by `movementSystem.ts` with `SHIP_ACCEL_NORMAL`, applying physics based on `.mass` and `.drag`.
- **Ship/Hull**: Holds references to structural modularity (Decks/Compartments).
- **AI/Faction**: Determines behavior states driven by `aiSystem.ts`.

### ECS Null Safety (Rule of 0)
Because `Entity` types are represented by numbers implicitly, an entity with ID `0` is completely valid. 
- ❌ `if (!engine.player)`
- ✅ `if (engine.player !== null)` 

---

## 5. Major Gameplay Systems

### Ship Architect (Editor)
- **Decks (`HullEditorPanel`)**: Construct custom hulls through Vertex manipulation (`polygon-clipping`).
- **Symmetry Axes**: X/Y symmetry swaps are actively translated. (e.g., `symmetryY` button applies horizontal mirroring logically via `-x`).
- **Compartments (`CompartmentPanel`)**: Functional blocks `BRIDGE, ENGINE, WARP_ENGINE, CARGO, WEAPON, MINING, REACTOR, GYRO, MACHINERY, FABRIC`. 
- **Build Cost**: `getShipMass()` scales material requirements based on area & materials used. Deductions happen against inventory storage dynamically.

### Procedural Generation (World & Ships)
- **NPC Ships (`proceduralShipGenerator.ts`)**: Procedural DNA algorithm (`/ship_generator/dna.ts`) combining skeletons and assigning logical module layouts purely through algorithmic weighting based on NPC Faction preferences.
- **World & Resources**: `StarSystemGenerator` + `AsteroidGridManager` partition the universe into star systems with distinct gravitational bodies and resources.

### Tech Tree & Research (`TechnologyWindow.tsx`)
- Research operates over time based on active computational allocation (Labs).
- Technologies unlock Ship Compartments and sub-tiers (e.g. unlocking advanced Lasers vs Ballistics).

### Economy, Mining & Production
- Materials array from basic composites (Bioceramic, Silicate) to complex alloys.
- **`miningSystem.ts`**: Active beam/projectile collection from Asteroids -> deposited to `.inventory` component of the ship -> processed in `ProductionWindow.tsx`.
- **Loot**: Wreckages leave `LootManager.ts` spawned droplets that get scooped up interactively.

### Species & Origin Designer
- `SpeciesDesigner.tsx` allowing players to architect their avatar.
- `PortraitCanvas` facilitates in-game pixel-level structural drawing of characters mapped logically to Anatomy Trees (`AnatomyTree.tsx`).

### Diplomacy & Factions (`FactionManager.ts`)
- Factions evaluate the player conditionally.
- "Personal vs State vs Nomad" alignment: Factions dynamically adjust their stance based on player origin, interactions, and cargo metrics.

---

## 6. Mobile & UI Specifics
- **Responsiveness**: Tailwind configurations mapped deeply. Font sizes are adjusted dynamically: `html { font-size: 14px; }` on Mobile transitioning to `18px` on Tablet/Desktop for maximum screen real-estate usage.
- **Controls**: `MobileControls.tsx` renders a virtual Touch D-pad detecting `pointer: coarse` inputs automatically to circumvent keyboard commands (`WASD`).
- **Context Menus**: Right-click (or Long-press on mobile) targets an entity passing it into `TacticalContextMenu.tsx` to handle Attack / Hail / Scan interactions.

---

## 7. Development Guidelines Summarized
- **Never rely on standard APIs like `window.alert` or `window.open`**. Use React contextual portals/modals (`ui/*`).
- **Never use truthy checks for `entities`** due to `0`-index entities.
- **Component Separation**: All UI is compartmentalized exactly to its feature context (e.g., `ui/editor-ui/CostPanel.tsx`).
- **Symmetry Arrays**: To delete elements/vertices, sort numerically descending (`a, b => b - a`) and splice backwards to prevent layout mismatches.
- **BigInt Logging**: Wrap `BigInt` inside explicit `String()` before any `console.log()` calls interacting with `JSON.stringify()`.

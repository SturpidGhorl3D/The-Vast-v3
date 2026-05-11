# THE VAST — Space Game Prototype

## Overview
A space exploration / ship-building game prototype built with Next.js 15, React 19, and a custom canvas-based engine. No external game frameworks — pure TypeScript with an ECS (Entity Component System) architecture.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Rendering**: HTML5 Canvas via custom `Renderer` class
- **Animation/Physics**: Custom ECS loop, `simplex-noise` for world generation

## Project Structure
```
app/                     # Next.js App Router
  layout.tsx             # Root layout
  page.tsx               # Main page → mounts GameCanvas
  globals.css            # Tailwind import
components/
  GameCanvas.tsx         # Main game component: HUD, editor, flight, build animation
  HUD.tsx                # Heads-up display (resources, warp, map toggle)
  MobileControls.tsx     # Mobile D-pad + thrust/jump buttons
  game/
    types.ts             # All TypeScript types: hull, compartments, build state, etc.
    editorLogic.ts       # Polygon math, symmetry, validation, mirror vertex resolution
  ui/
    EditorUI.tsx         # Full ship editor UI: selection-first tools, compartment configs
    PauseMenu.tsx        # Pause / settings overlay
game/
  constants.ts           # World scale, warp, build costs, asteroid params
  systems.ts             # ECS systems: movement, mining, render
  hullGeometry.ts        # Polygon math, camera zoom clamping
  compartmentUtils.ts    # Compartment utils, build cost calculation, default configs
  engine/
    camera.ts            # Smooth camera with world↔screen transforms
    ecs.ts               # Entity Component System
    renderer.ts          # Canvas drawing: stars, ship, scaffolding, asteroids, build anim
  world/
    generator.ts         # Procedural star system + asteroid cluster generation
    global_map/
      GlobalMapRenderer.ts  # Global map: animated sparks, fog-of-war, warp overlays
hooks/
  use-mobile.ts          # Touch-device detection via (pointer: coarse)
lib/
  utils.ts               # Tailwind class merging utility (clsx + twMerge)
```

## Running
- Dev server: `npm run dev` → port 5000 (Replit-compatible)
- Workflow `Start application` runs `next dev -p 5000 -H 0.0.0.0`

## Environment Variables
- `GEMINI_API_KEY` — Google Gemini API key (for future AI features)
- `APP_URL` — Hosting URL (auto-injected in production)

## View Modes
| Mode | Description |
|------|-------------|
| LOCAL | Close-range flight view — ship visible, star drawn at real scale |
| TACTICAL | System-wide tactical view — entire solar system visible |
| GLOBAL | Star map view — galaxy-wide, warp navigation |
Press **G** to cycle through all three modes.

## Game Controls
| Key | Action |
|-----|--------|
| WASD | Move/turn ship (LOCAL) or pan map (TACTICAL/GLOBAL) |
| Q/E | Rotate global/tactical map |
| Scroll / Pinch | Zoom |
| Tab (hold) | Warp thrust (requires WARP_ENGINE compartment) |
| Space | Execute warp jump to selected target |
| G | Cycle view mode: LOCAL → TACTICAL → GLOBAL → LOCAL |
| ESC | Pause / editor menu |
| Delete/Backspace | Delete selected vertex in editor |
| Click (global map) | Set warp jump target or click asteroid cluster |

## Ship Editor (Ship Architect)
- **Selection-first workflow**: Click a deck or compartment in the left panel first, then tools appear contextually in the bottom toolbar
- **Deck tools** (when deck selected): PAN, VERTEX edit, +VERTEX add, +COMP add
- **Compartment tools** (when compartment selected): PAN, MOVE, RESHAPE, +COMP add
- **Symmetry**: X/Y symmetry for hull editing — mirror vertices are highlighted orange
- **Build costs**: Applying a blueprint deducts materials (Fe/Si) from Cargo Bay
- **Build animation**: 6-second animated transition (scaffolding → polygon-by-polygon hull construction → compartments appear dark → brighten)
- **Compartment types**: BRIDGE, ENGINE, WARP_ENGINE, CARGO, WEAPON, MINING, REACTOR, GYRO, MACHINERY, FABRIC
- **Each compartment has a config panel** in the right panel when selected

## Compartment System
| Type | Function |
|------|----------|
| BRIDGE | Command center, navigation |
| ENGINE | Thrust bonus (configurable %) |
| WARP_ENGINE | Enables warp jump + warp thrust |
| CARGO | Stores materials — required for building operations |
| WEAPON | Turret with 3 fire modes: ROUNDS, BEAM, HOMING |
| MINING | Auto mining turret, beam-based |
| REACTOR | Power output (configurable) |
| GYRO | Turn rate bonus (configurable) |
| MACHINERY | Repair rate (configurable) |
| FABRIC | Hull pool (configurable) |

## Build Cost System
- Hull cost: 0.08 Fe + 0.02 Si per m² of polygon area changed
- Compartment cost: 0.15 Fe + 0.05 Si per m² of compartment area
- Requires CARGO compartment on ship
- Resources deducted from ECS Inventory on Apply

## Asteroid Clusters
- **In-system**: 1–3 rings per star system, rendered as concave ring shapes with animated dots
- **Deep space**: 80 clusters scattered across the galaxy, rendered as polygonal fog areas
- Deep-space clusters are selectable warp targets on the global map

## Loading Screen
- Brief retro loading screen on page load ("INITIALIZING SYSTEMS...")
- Covers compilation warmup time on first visit

## Warp Jump System
1. Open global map
2. Click any star system or asteroid cluster to set warp target
3. Press Space (desktop) or ⚡ JUMP (mobile) to jump
4. 30-second cooldown shown in HUD

## Architecture Notes
- `engineRef` holds all mutable engine state (camera, ECS, world, warp target, editor state, selection state)
- `engineRef.current.selectionType`: `'deck' | 'compartment' | null` — drives EditorUI tool context
- `engineRef.current.selectedElementIndex`: current selected deck index or compartment id
- Build animation stored in `hull.buildAnimation` — updated each frame in the game loop
- Mirror vertex resolution uses `resolveMirrorTargets()` for correct per-axis symmetry
- `mirrorTargets` is a typed array of `{ index, mirrorType: 'X'|'Y'|'XY' }` tracking which vertices to co-move

## Physics (game/constants.ts)
- `SHIP_ACCEL_NORMAL` = 0.8 m/s² base acceleration
- `SHIP_ACCEL_RAMP_RATE` = 0.025/frame — throttle ramps to 1.0 in ~1.6s, decays 4× faster
- `SHIP_TURN_SPEED` = 0.003 rad per update (requires at least 1 GYRO compartment)
- `DEFAULT_GYRO_TURN_BONUS` = 1.0 — each GYRO multiplies turn by this bonus
- Without any GYRO compartment the ship **cannot turn at all**

## Constants (game/constants.ts)
- `SYSTEM_GRID_SPACING_M` = 120 billion m (grid cell size)
- `GLOBAL_MIN_VIEWPORT_M` = 10 billion m (minimum global zoom)
- `WARP_COOLDOWN_MS` = 30 000 ms
- `BUILD_ANIM_DURATION_MS` = 6 000 ms
- `HULL_IRON_PER_M2` = 0.08, `HULL_SILICON_PER_M2` = 0.02
- `COMPARTMENT_IRON_PER_M2` = 0.15, `COMPARTMENT_SILICON_PER_M2` = 0.05
- `ACCENT_COLOR` = `#00d4ff`

## HUD (components/HUD.tsx)
- Sliding side panel with 3 tabs: **Status** (resources, hull, reactor), **Modes** (view/movement/interaction), **Fab** (ship editor)
- Open/close toggle button anchored to the right edge
- D-pad only shown in LOCAL + MANUAL movement mode (components/MobileControls.tsx)

## Ship Editor Features
- **1m grid snap** for MOVE_COMPARTMENT operations
- **Paired compartments**: ADD_COMPARTMENT with X-symmetry spawns mirror twin automatically
- **Twin sync**: MOVE_COMPARTMENT moves paired mirror twin to exact mirrored coords
- **Vertex delete**: Delete/Backspace removes selected vertex (minimum 3 preserved)

## Starter Ship (makeStarterCompartments)
Default ship spawns with: BRIDGE, REACTOR, GYRO, WARP_ENGINE, CARGO×2 (paired), ENGINE×2 (paired) — all hull-safe compartments verified against polygon bounds. Ship spawns at `starRadius × 4` from the home star.

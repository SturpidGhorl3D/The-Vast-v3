# AI Agent Instructions

## General Project Conventions
- **BigInt Serialization Warning:** When using `BigInt` (e.g. for sector coordinates like `sectorX`, `sectorY`), be fully aware that Next.js development overlay overloads `console.log()` and parses objects using `JSON.stringify()`. Passing an object containing `BigInt` directly to `console.log()` will cause a "Do not know how to serialize a BigInt" crash. Always log specific primitive values instead of complex objects containing BigInt, or safely serialize the object beforehand.
- Same logic applies to `JSON.stringify` itself. Always use a proper replacer handling `bigint` (e.g., returning string representation with a delimiter) or a pre-serialization technique mapping `bigint` properties to a serializable format explicitly.

## UI Architecture
- **Modular UI Construction:** Panels and widgets for complex UI interfaces MUST be decomposed. Subcomponents belonging to a specific parent feature/UI (e.g., `EditorUI`) should be placed in a dedicated subdirectory named after the parent (or its lowercase/kebab-case equivalent, e.g., `components/ui/editor-ui/`). Do not pile all UI components into a single root UI folder.

## Input Handling
- **Input System Modularity:** When adding new inputs or input handling logic (like in `useGameInput`), break the logic into smaller, focused hooks or handler files (e.g., separating camera controls, hotkeys, drag-and-drop, touch controls). Do not bloat a single massive hook.

## Rendering System
- Use optimized rendering methods, especially in case of large amount of objects
- Develop features with mobile users in mind
- Use russian language as basis

## Entity System & Javascript Truthiness
- **Player/Entity ID Checks:** In our ECS, `Entity` is a `number`, which means the first entity (e.g., the player) often has an ID of `0`. Because JavaScript evaluates `0` as falsy, you must **NEVER** use truthiness checks like `if (!player)` or `if (engine.player)`. Always use strict comparisons like `if (player === null)` or `if (engine.player !== null)`. This prevents bugs where player 0 is incorrectly treated as missing.

## Symmetry System
- **UI vs Logic Axis Swapping:** In the ship editor, the boolean properties `engine.symmetryY` and `engine.symmetryX` are mapped counter-intuitively relative to their axis name, because they represent the *axis of reflection*:
  - `engine.symmetryY` (Vertical Mirror UI button) enables **Horizontal Symmetry**. It means mirroring across the Y-axis. So you must calculate targets by negating the X coordinate (`-x`).
  - `engine.symmetryX` (Horizontal Mirror UI button) enables **Vertical Symmetry**. It means mirroring across the X-axis. So you must calculate targets by negating the Y coordinate (`-y`).
- **Careful with Mutable Geometry Arrays:** When deleting vertices based on symmetry (e.g., in polygon editing), always gather the indices of target mirrored points first. Then, **always sort the index array in descending order** (`toDelete.sort((a,b) => b - a)`) and splice backwards (`splice(index, 1)`) so that removing an element does not shift the index of subsequent deletions!
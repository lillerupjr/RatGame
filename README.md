# Rat Game (Rat Survivors prototype)

Rat underworld where a lone survivor cuts through escalating floors, bosses, and branching routes.
Engine is a lightweight TypeScript + Vite + Canvas2D ECS-lite stack with isometric tile maps.

## Current State
- Canvas2D, ECS-lite systems, and isometric tile maps.
- Menu flow: welcome, main menu, map selection, weapon selection.
- Timed floors (120s) ending in a boss, chest rewards, and level-up upgrades.
- Weapons and items with evolutions, plus a 4-slot inventory HUD.
- Map selection supports static JSON maps and procedural rooms/maze.
- Delve map overlay for route choices and depth-based scaling.

## Gameplay
Pick a map and starter weapon, clear a floor, beat the boss, then choose your next node.

## Controls
- Move: WASD or arrow keys.

## Dev
```bash
npm install
npm run dev
```

```bash
npm run build
npm run test
```

## Agents
See `src/ai/AGENTS.md`.

# Rat Noir Survivors (Working Title)

A **Vampire Survivors–style top-down roguelike** set in a sleazy, faction-driven rat underworld.  
Built with **TypeScript + Vite + HTML5 Canvas**, using a **data-driven, ECS-lite architecture** designed for scalability, determinism, and fast iteration.

This repo currently contains the **Slice v0.1** foundation:
- Modular weapons & items
- Upgrade-driven progression
- Event-queue–based system decoupling
- Canvas-based rendering (engine-agnostic)

---

## Requirements

- **Node.js** ≥ 18 (recommended: latest LTS)
- **npm** (comes with Node)

Check versions:
```bash
node -v
npm -v
```

---

## Install & Run (Development)

1. **Install dependencies**
```bash
npm install
```

2. **Start dev server**
```bash
npm run dev
```

3. **Open the game**
- Vite will print a local URL (usually `http://localhost:5173`)
- Open it in your browser

The game reloads automatically on file changes.

---

## Controls

- **WASD / Arrow keys** — Move
- Weapons auto-fire
- Level-up screen pauses the game until you choose an upgrade

---

## Project Structure (Simplified)

```
src/
  main.ts                # App bootstrap + RAF loop
  game/
    game.ts              # Game state machine
    world.ts             # World state + entity storage
    events.ts            # Global event definitions
    content/             # Data-only definitions
      weapons.ts
      items.ts
      upgrades.ts
      stages.ts
    systems/             # ECS-lite systems
      input.ts
      movement.ts
      spawn.ts
      combat.ts
      collisions.ts
      xp.ts
      pickups.ts
      render.ts
    util/
      rng.ts
      time.ts
```

**Key rule:**
> Systems do not directly depend on each other.  
> Communication happens via shared world state and the event queue.

---

## Creating a Zip of the Repo (for sharing or review)

### Recommended (git-based, clean)
If the project is a git repo:

```bash
git archive --format=zip -o RatGame.zip HEAD
```

This:
- Includes only tracked files
- Excludes `node_modules`, `dist`, `.vite`, etc.
- Produces a clean `RatGame.zip`

---

### Manual Zip (without git)
If you’re zipping manually, **exclude**:

- `node_modules/`
- `dist/`
- `.vite/`
- `.git/`

On macOS / Linux:
```bash
zip -r RatGame.zip . -x "node_modules/*" "dist/*" ".git/*" ".vite/*"
```

On Windows (PowerShell):
```powershell
Compress-Archive -Path * -DestinationPath RatGame.zip -Exclude node_modules,dist,.git,.vite
```

---

## Git Ignore Notes

Make sure your `.gitignore` includes:
```gitignore
node_modules/
dist/
.vite/
RatGame.zip
```

---

## Design Goals

- **Data-driven content** (weapons, items, upgrades)
- **ECS-lite** for performance and clarity
- **Event queue** to decouple systems
- **No engine lock-in**
- Evolutions, synergies, bosses added without rewriting core systems

---

## Status

🚧 **Active development**  
Current focus:
- Solidifying core architecture
- Preparing for evolutions & bosses
- Performance hardening for large enemy counts

---

## License
TBD

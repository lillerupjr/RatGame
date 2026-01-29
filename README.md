# Rat Noir Survivors (Working Title)

A **Vampire Survivors–style top-down roguelike** set in a sleazy, faction-driven rat underworld.  
Built with **TypeScript + Vite + HTML5 Canvas**, using a **data-driven, ECS-lite architecture** designed for scalability, determinism, and fast iteration.

This repo currently contains **Slice v0.5.0** — the first **fully playable run**:
- Complete **multi-floor run structure**
- **Boss encounters** with clear win / loss conditions
- Modular weapons with **evolutions**
- New weapons (Bazooka, Bouncer) with unique mechanics
- Status effects (poison, burn, aura damage)
- Explosion, chaining, and wave-based effects
- Run map (`runMap`) inspired by *Slay the Spire*
- Proper **Run Complete** and **Game Over** screens
- Player, enemy, projectile sprites, and seamless backgrounds

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
  main.ts                # App bootstrap + RAF loop + starter selection
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
      zones.ts
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
- Evolutions, synergies, bosses, and zones added without rewriting core systems

---

## Status

**Next focus (v0.6+):**
- Meta-progression between runs
- Faction identity & zone theming
- More boss variety and mechanics
- Run map depth (branching, node types)
- Balance, polish, and performance scaling

---

## License

TBD
